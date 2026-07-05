#!/usr/bin/env node
'use strict';

/**
 * smoke-mvp.js — the ONE canonical MVP smoke runner for Basset Hound Browser.
 *
 * Per docs/planning/QA-VERIFICATION-PLAN.md: a short, honest smoke set that proves the
 * browser is stable and shippable end-to-end. It is deliberately LEAN — one command,
 * one observable, against a real page — not an exhaustive suite.
 *
 * What it does, with zero manual setup:
 *   1. Boots the browser HEADLESS on an ISOLATED, OS-assigned WS port (so it never
 *      collides with another running browser). ELECTRON_RUN_AS_NODE is deleted from the
 *      child env, a throwaway --user-data-dir is used, and the child is spawned detached
 *      in its own process group.
 *   2. Drives the live WS API (flat JSON {command,id,...params}; reply echoes {id,...})
 *      through the proven + fixed command set against REAL pages, asserting concrete
 *      observable outputs (the strongest proof — e.g. extract_links.count tracks the live
 *      document.links.length; get_cookies{url} returns the just-set URL-scoped cookie).
 *   3. Prints a clean PASS/FAIL table, exits 0 on all-pass / 1 otherwise.
 *   4. ALWAYS reaps its whole process group on exit (SIGTERM then SIGKILL) and removes its
 *      temp dir — no strays, temp under /home/devel/bhb-*.
 *
 * Three page targets:
 *   - https://example.com/                       tiny, "Example Domain" marker, http origin
 *   - a LOCAL loopback http page (this script)   deterministic form + real jQuery/Bootstrap
 *                                                 markers — for click/fill and tech-detect,
 *                                                 with no external-network dependency
 *   - https://en.wikipedia.org/wiki/Web_scraping many links → live document.links ground truth
 *
 * Run:  npm run smoke:mvp
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const PROJECT_ROOT = path.resolve(__dirname, '..');
// require('electron') in a plain Node process resolves to the electron executable path.
const ELECTRON_BIN = require('electron');

const HOST = '127.0.0.1';
const BOOT_TIMEOUT_MS = 60000; // headless Electron cold start + WS listen
const CMD_TIMEOUT_MS = 45000; // per-command; comfortably above browser-side adaptive timeouts

const EXAMPLE_URL = 'https://example.com/';
const WIKI_URL = 'https://en.wikipedia.org/wiki/Web_scraping';

// A self-contained page that is BOTH an interaction form and a tech-detection target.
// The jQuery <script src> + inline "$.fn.jquery" and the Bootstrap css/js/classes are real
// fingerprints the detector matches from the live rendered HTML — no external fetch needed
// (the tags persist in the DOM regardless of whether the relative assets 404 locally).
const PAGE_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><title>bhb-smoke</title>' +
  '<link rel="stylesheet" href="./bootstrap.min.css">' +
  '<script src="./jquery-3.6.0.min.js"></script>' +
  '<script src="./bootstrap.bundle.min.js"></script>' +
  '</head><body>' +
  '<div class="container"><div class="row"><div class="col-md-6">' +
  '<h1>Basset Hound smoke form</h1>' +
  '<form id="f"><input id="n" name="n" type="text" value="">' +
  '<button id="b" type="button" class="btn btn-primary">go</button></form>' +
  '</div></div></div>' +
  '<script>/* tech-marker */ var _v = window.jQuery && $.fn.jquery;</script>' +
  '</body></html>';

const TMP_DIR = `/home/devel/bhb-smoke-${process.pid}-${Date.now()}`;
const USER_DATA_DIR = path.join(TMP_DIR, 'user-data');
const BOOT_LOG = path.join(TMP_DIR, 'boot.log');

let child = null;
let formServer = null;
let reaped = false;
let bootTail = ''; // ring buffer of recent child output for diagnostics

// --------------------------------------------------------------------------------------
// Process hygiene: spawn detached (own process group), always reap the whole group.
// --------------------------------------------------------------------------------------
function killGroup(signal) {
  if (!child || !child.pid) return;
  try {
    process.kill(-child.pid, signal); // negative pid => signal the entire process group
  } catch (_) {
    try { process.kill(child.pid, signal); } catch (__) { /* already gone */ }
  }
}

function closeFormServer() {
  if (formServer) { try { formServer.close(); } catch (_) {} formServer = null; }
}

async function reap() {
  if (reaped) return;
  reaped = true;
  closeFormServer();
  killGroup('SIGTERM');
  await sleep(1200);
  killGroup('SIGKILL');
  try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch (_) { /* best effort */ }
}

function reapSyncBestEffort() {
  if (reaped) return;
  reaped = true;
  closeFormServer();
  killGroup('SIGKILL');
  try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch (_) { /* best effort */ }
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { reapSyncBestEffort(); process.exit(1); });
}
process.on('uncaughtException', (err) => {
  console.error('[smoke] uncaughtException:', (err && err.stack) || err);
  reapSyncBestEffort();
  process.exit(1);
});

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Ask the OS for a guaranteed-free port right now, then reuse it.
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, HOST, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// Tiny loopback server for the deterministic form + tech-detection page.
function startFormServer() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      if (req.url === '/' || req.url.startsWith('/?')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(PAGE_HTML);
      } else {
        res.writeHead(404); res.end('not found'); // relative assets 404 harmlessly
      }
    });
    srv.on('error', reject);
    srv.listen(0, HOST, () => {
      formServer = srv;
      const { port } = srv.address();
      resolve(`http://${HOST}:${port}/`);
    });
  });
}

// --------------------------------------------------------------------------------------
// Launch the headless browser.
// --------------------------------------------------------------------------------------
function launchBrowser(port) {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  const bootFd = fs.openSync(BOOT_LOG, 'a');

  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE; // <-- critical: run as Electron, not as Node
  delete env.ELECTRON_NO_ATTACH_CONSOLE;
  env.NODE_ENV = 'production';
  env.ELECTRON_DISABLE_SANDBOX = '1';
  env.BASSET_WS_PORT = String(port);
  env.BASSET_PORT = String(port);
  env.BASSET_WS_REQUIRE_AUTH = 'false';
  env.BASSET_HOME_PAGE = 'about:blank'; // avoid a network-bound startup homepage
  // Permit navigation to our own loopback form server (QA-only; smoke runs on loopback).
  env.BASSET_WS_ALLOW_PRIVATE_NETWORK = '1';
  // Allow forensic_capture to write its bundle under the smoke temp dir (PathValidator gate).
  env.BASSET_ALLOWED_WRITE_DIRS = TMP_DIR;

  const args = [
    '.',
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    `--user-data-dir=${USER_DATA_DIR}`,
  ];

  child = spawn(ELECTRON_BIN, args, {
    cwd: PROJECT_ROOT,
    env,
    detached: true, // own process group => process.kill(-pid) reaps everything
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const onChunk = (buf) => {
    const s = buf.toString();
    try { fs.writeSync(bootFd, s); } catch (_) { /* ignore */ }
    bootTail = (bootTail + s).slice(-4000);
  };
  child.stdout.on('data', onChunk);
  child.stderr.on('data', onChunk);
  child.on('exit', (code, signal) => {
    if (!reaped) bootTail += `\n[child exited early code=${code} signal=${signal}]`;
  });
}

// Poll-connect until the WS server answers on the isolated port (or boot times out).
function waitForWs(port) {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (Date.now() > deadline) {
        return reject(new Error(`WS did not come up on ${HOST}:${port} within ${BOOT_TIMEOUT_MS}ms`));
      }
      if (child && child.exitCode !== null) {
        return reject(new Error(`browser process exited (code=${child.exitCode}) before WS was ready`));
      }
      const ws = new WebSocket(`ws://${HOST}:${port}`);
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        try { ws.removeAllListeners(); } catch (_) {}
        if (ok) { try { ws.close(); } catch (_) {} resolve(); }
        else { try { ws.terminate(); } catch (_) {} setTimeout(attempt, 500); }
      };
      ws.on('open', () => done(true));
      ws.on('error', () => done(false));
      setTimeout(() => done(false), 2000);
    };
    attempt();
  });
}

// --------------------------------------------------------------------------------------
// Minimal WS client: one persistent connection, correlate replies by id.
// --------------------------------------------------------------------------------------
class WsClient {
  constructor(port) {
    this.url = `ws://${HOST}:${port}`;
    this.ws = null;
    this.pending = new Map(); // id -> {resolve, reject, timer, command}
    this.seq = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.on('open', () => resolve());
      this.ws.on('error', (e) => reject(e));
      this.ws.on('message', (data) => this._onMessage(data));
      this.ws.on('close', () => {
        for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(new Error('WS connection closed')); }
        this.pending.clear();
      });
    });
  }

  _onMessage(data) {
    let frame;
    try { frame = JSON.parse(data.toString()); } catch (_) { return; }
    if (!frame || typeof frame !== 'object') return;
    const id = frame.id;
    if (id != null && this.pending.has(id)) {
      const p = this.pending.get(id);
      clearTimeout(p.timer);
      this.pending.delete(id);
      p.resolve(frame);
      return;
    }
    // ErrorFormatter validation errors reply with id:null but echo the command name.
    if (id == null || id === 'null') {
      for (const [pid, p] of this.pending) {
        if (frame.command && frame.command === p.command) {
          clearTimeout(p.timer);
          this.pending.delete(pid);
          p.resolve(frame);
          return;
        }
      }
    }
    // otherwise: unsolicited/stray frame — ignore.
  }

  call(command, params = {}) {
    const id = `smoke-${++this.seq}-${Math.random().toString(36).slice(2, 8)}`;
    const msg = Object.assign({ command, id }, params);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`timeout waiting for reply to "${command}" (${CMD_TIMEOUT_MS}ms)`));
      }, CMD_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer, command });
      try {
        this.ws.send(JSON.stringify(msg));
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(e);
      }
    });
  }

  close() { try { this.ws.close(); } catch (_) {} }
}

// Navigate then confirm the true current URL via get_url (the authoritative source —
// navigate's own reply can echo a stale URL during the startup-homepage settle because
// navigation-complete events are not strictly 1:1 with the request). Polls until the
// target host appears or the budget is exhausted.
async function navConfirm(cli, target, needle, { settleMs = 700, tries = 12 } = {}) {
  const nav = await cli.call('navigate', { url: target, timeout: 30000 });
  let last = '';
  for (let i = 0; i < tries; i++) {
    await sleep(settleMs);
    const u = await cli.call('get_url', {});
    last = String((u && u.url) || '');
    if (last.includes(needle)) return { nav, url: last, ok: true };
  }
  return { nav, url: last, ok: false };
}

// --------------------------------------------------------------------------------------
// The smoke checks.
// --------------------------------------------------------------------------------------
function fail(detail) { return { pass: false, detail }; }
function pass(detail) { return { pass: true, detail }; }

async function runChecks(cli, formUrl) {
  const results = [];
  const add = (name, res) => results.push({ name, pass: res.pass, detail: res.detail });
  const run = async (name, fn) => {
    try { add(name, await fn()); }
    catch (e) { add(name, fail(`threw: ${e.message}`)); }
  };

  // Warm-up: one real navigation to drain the startup-homepage navigation race so the
  // first asserted navigate below correlates to the page it actually loads.
  await cli.call('navigate', { url: formUrl, timeout: 30000 });
  await sleep(1500);

  // ---- Phase 1: example.com ----
  let ex = null;
  await run('navigate (example.com)', async () => {
    ex = await navConfirm(cli, EXAMPLE_URL, 'example.com');
    if (!ex.nav.success) return fail(`success=${ex.nav.success} error=${ex.nav.error}`);
    if (!ex.ok) return fail(`current url never reached example.com (last=${ex.url})`);
    return pass(`loaded, get_url=${ex.url}`);
  });

  await run('get_url', async () => {
    const r = await cli.call('get_url', {});
    const url = String((r && r.url) || '');
    if (!r.success) return fail(`success=${r.success} error=${r.error}`);
    if (!url.includes('example.com')) return fail(`url=${url}`);
    return pass(`url=${url}`);
  });

  await run('get_content (Example Domain marker)', async () => {
    const r = await cli.call('get_content', {});
    const content = typeof r.content === 'string' ? r.content : '';
    if (!r.success) return fail(`success=${r.success} error=${r.error}`);
    if (content.length <= 500) return fail(`content length ${content.length} <= 500`);
    if (!content.includes('Example Domain')) return fail('missing "Example Domain" marker');
    return pass(`len=${content.length}, marker present`);
  });

  await run('screenshot (non-empty base64)', async () => {
    const r = await cli.call('screenshot', { format: 'png' });
    if (!r.success) return fail(`success=${r.success} error=${r.error}`);
    const dataUrl = r.data || r.screenshot || r.image || r.dataUrl || '';
    if (typeof dataUrl !== 'string' || !/^data:image\/\w+;base64,/.test(dataUrl)) {
      return fail(`no base64 data URL (got ${typeof dataUrl}, len=${String(dataUrl).length})`);
    }
    const b64 = dataUrl.split('base64,')[1] || '';
    const bytes = Buffer.from(b64, 'base64').length;
    if (bytes < 1000) return fail(`decoded bytes ${bytes} < 1000`);
    return pass(`${bytes} bytes${r.captureMethod ? ` via ${r.captureMethod}` : ''}`);
  });

  await run('set_local_storage -> get_local_storage round-trip', async () => {
    const key = 'bhb_smoke_ls';
    const value = 'ok-' + Math.random().toString(36).slice(2, 10);
    const setR = await cli.call('set_local_storage', { origin: EXAMPLE_URL, key, value });
    if (!setR.success) return fail(`set failed: ${setR.error}`);
    const getR = await cli.call('get_local_storage', { origin: EXAMPLE_URL });
    if (!getR.success) return fail(`get failed: ${getR.error}`);
    const store = getR.data || {};
    if (store[key] !== value) return fail(`readback mismatch: got ${JSON.stringify(store[key])}, want ${value}`);
    return pass(`${key}=${value} round-tripped`);
  });

  // Session-persistence fix (task b): save -> restore must round-trip. The restore path
  // takes the (default-on) validateFirst branch that previously threw
  // "ReferenceError: stateCapture is not defined".
  await run('save_session_state -> restore_session_state (fix verification)', async () => {
    const saveR = await cli.call('save_session_state', { profileId: 'smoke' });
    if (!saveR.success || !saveR.sessionId) return fail(`save failed: ${saveR.error || 'no sessionId'}`);
    const restoreR = await cli.call('restore_session_state', { sessionId: saveR.sessionId });
    if (/stateCapture is not defined/.test(String(restoreR.error || ''))) return fail('ReferenceError still present');
    if (!restoreR.success) {
      return fail(`restore failed: ${restoreR.error || 'unknown'}${restoreR.issues ? ' issues=' + JSON.stringify(restoreR.issues) : ''}`);
    }
    return pass(`saved+restored ${saveR.sessionId} (restoreTime=${restoreR.restoreTime}ms, validateFirst path OK)`);
  });

  // ---- Phase 2: local loopback form page (click/fill + tech-detect) ----
  let fp = null;
  await run('navigate (local form page)', async () => {
    fp = await navConfirm(cli, formUrl, '127.0.0.1');
    if (!fp.nav.success) return fail(`success=${fp.nav.success} error=${fp.nav.error}`);
    if (!fp.ok) return fail(`current url never reached form page (last=${fp.url})`);
    return pass(`loaded ${fp.url}`);
  });

  await run('fill (form input value round-trip)', async () => {
    const value = 'basset-smoke';
    const r = await cli.call('fill', { selector: '#n', value, humanize: false });
    if (!r.success) return fail(`fill success=${r.success} error=${r.error}`);
    const chk = await cli.call('execute_script', { script: "document.querySelector('#n').value" });
    if (chk.result !== value) return fail(`readback: got ${JSON.stringify(chk.result)}, want ${value}`);
    return pass(`input value === "${value}"`);
  });

  await run('click (form button)', async () => {
    const r = await cli.call('click', { selector: '#b', humanize: false });
    if (!r.success) return fail(`success=${r.success} error=${r.error}`);
    return pass('button clicked');
  });

  await run('detect_technologies (real detection)', async () => {
    const r = await cli.call('detect_technologies', {});
    if (!r.success) return fail(`success=${r.success} error=${r.error}`);
    const techs = Array.isArray(r.technologies) ? r.technologies : [];
    if (techs.length < 1) return fail('no technologies detected (0 — would indicate shell HTML)');
    const names = techs.map((t) => (t && (t.name || t.technology)) || t).slice(0, 8);
    return pass(`${techs.length} detected: ${names.join(', ')}`);
  });

  // ---- Phase 3: Wikipedia (extract_links cross-check / cookies / export) ----
  let wk = null;
  await run('navigate (Wikipedia Web_scraping)', async () => {
    wk = await navConfirm(cli, WIKI_URL, 'wikipedia.org', { settleMs: 900 });
    if (!wk.nav.success) return fail(`success=${wk.nav.success} error=${wk.nav.error}`);
    if (!wk.ok) return fail(`current url never reached wikipedia (last=${wk.url})`);
    return pass(`loaded ${wk.url}`);
  });

  await sleep(1200); // let the article settle so the anchor set stabilizes

  await run('extract_links (count tracks live document.links.length)', async () => {
    // Wikipedia lazy-loads a variable number of anchors, so read the DOM count both
    // before and after extraction and require extract_links.count to fall within that
    // window (exact match when the DOM is quiescent). count===all.length is exact.
    const domA = await cli.call('execute_script', { script: 'document.links.length' });
    const r = await cli.call('extract_links', {});
    const domB = await cli.call('execute_script', { script: 'document.links.length' });
    const before = Number(domA.result);
    const after = Number(domB.result);
    if (!r.success) return fail(`success=${r.success} error=${r.error}`);
    const allLen = Array.isArray(r.all) ? r.all.length : null;
    if (r.count !== allLen) return fail(`count=${r.count} !== all.length=${allLen}`);
    if (!Number.isFinite(before) || !Number.isFinite(after) || before < 50) {
      return fail(`bad DOM link counts before=${domA.result} after=${domB.result}`);
    }
    const lo = Math.min(before, after);
    const hi = Math.max(before, after);
    if (r.count < lo || r.count > hi) {
      return fail(`count=${r.count} outside live document.links window [${lo}, ${hi}]`);
    }
    const firstHref = Array.isArray(r.all) && r.all[0] ? r.all[0].href : '';
    return pass(`count=${r.count} in document.links window [${lo}, ${hi}] (first href ${firstHref})`);
  });

  await run('set_cookie -> get_cookies { url } (URL-scoped)', async () => {
    const name = 'bhb_smoke_url';
    const setR = await cli.call('set_cookie', { cookie: { name, value: '1', url: WIKI_URL } });
    if (!setR.success) return fail(`set_cookie failed: ${setR.error}`);
    const getR = await cli.call('get_cookies', { url: WIKI_URL });
    if (!getR.success) return fail(`get_cookies failed: ${getR.error}`);
    const cookies = Array.isArray(getR.cookies) ? getR.cookies : [];
    const names = cookies.map((c) => c.name);
    if (!names.includes(name)) return fail(`test cookie not URL-scoped; got ${JSON.stringify(names)}`);
    return pass(`count=${cookies.length}, includes ${name}`);
  });

  await run('export_raw_html (real page HTML, not shell)', async () => {
    const r = await cli.call('export_raw_html', {});
    if (!r.success) return fail(`success=${r.success} error=${r.error}`);
    const html = typeof r.html === 'string' ? r.html : '';
    const lower = html.toLowerCase();
    if (html.length < 5000) return fail(`html length ${html.length} < 5000 (likely shell)`);
    const looksLikePage = lower.includes('web scraping') || lower.includes('wikipedia') || lower.includes('mw-');
    if (!looksLikePage) return fail('html lacks real page markers (looks like shell)');
    return pass(`htmlLength=${r.htmlLength || html.length}, real page markers present`);
  });

  // ---- Phase 4: one-shot forensic_capture (bundle write + hash determinism) ----
  await run('forensic_capture (bundle + page.html sha256 determinism)', async () => {
    const outDir = path.join(TMP_DIR, 'captures');
    const r = await cli.call('forensic_capture', { url: EXAMPLE_URL, output_dir: outDir });
    if (!r.success) return fail(`success=${r.success} error=${r.error}`);
    const bundleDir = r.bundle_dir;
    if (!bundleDir || !fs.existsSync(bundleDir)) return fail(`bundle_dir missing on disk: ${bundleDir}`);
    for (const f of ['page.html', 'network.har', 'cookies.json', 'storage.json', 'metadata.json', 'manifest.json', 'chain_of_custody.json']) {
      if (!fs.existsSync(path.join(bundleDir, f))) return fail(`missing ${f} in bundle`);
    }
    // Self-proving determinism: recompute page.html sha256 from disk, compare to manifest.
    const manifest = JSON.parse(fs.readFileSync(path.join(bundleDir, 'manifest.json'), 'utf8'));
    const entry = (manifest.files || []).find((x) => x.name === 'page.html');
    if (!entry) return fail('manifest has no page.html entry');
    const recomputed = crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(bundleDir, 'page.html'))).digest('hex');
    if (recomputed !== entry.sha256) {
      return fail(`page.html sha256 mismatch: manifest=${entry.sha256} recompute=${recomputed}`);
    }
    return pass(`${manifest.files.length} files, page.html sha256 verified (${entry.sha256.slice(0, 12)}...)`);
  });

  return results;
}

// --------------------------------------------------------------------------------------
// Reporting.
// --------------------------------------------------------------------------------------
function printTable(results) {
  const nameWidth = Math.max(...results.map((r) => r.name.length), 12);
  const line = '-'.repeat(nameWidth + 62);
  console.log('');
  console.log(line);
  console.log(`  ${'CHECK'.padEnd(nameWidth)}   RESULT   DETAIL`);
  console.log(line);
  for (const r of results) {
    const status = r.pass ? 'PASS' : 'FAIL';
    console.log(`  ${r.name.padEnd(nameWidth)}   ${status.padEnd(6)}   ${r.detail}`);
  }
  console.log(line);
  const passed = results.filter((r) => r.pass).length;
  console.log(`  ${passed}/${results.length} passed`);
  console.log(line);
  console.log('');
}

// --------------------------------------------------------------------------------------
// Main.
// --------------------------------------------------------------------------------------
async function main() {
  console.log('[smoke] Basset Hound Browser — MVP smoke runner');
  const port = await getFreePort();
  const formUrl = await startFormServer();
  console.log(`[smoke] isolated WS port: ${port}`);
  console.log(`[smoke] local form server: ${formUrl}`);
  console.log(`[smoke] temp dir: ${TMP_DIR}`);

  launchBrowser(port);
  console.log(`[smoke] launched headless browser (pid ${child.pid}), waiting for WS...`);

  try {
    await waitForWs(port);
  } catch (e) {
    console.error(`[smoke] BOOT FAILED: ${e.message}`);
    console.error('[smoke] --- boot log tail ---');
    console.error(bootTail || '(no output captured)');
    await reap();
    process.exit(1);
  }
  console.log('[smoke] WS is up. Running checks...\n');

  const cli = new WsClient(port);
  let results = [];
  try {
    await cli.connect();
    results = await runChecks(cli, formUrl);
  } catch (e) {
    console.error(`[smoke] fatal while running checks: ${e.message}`);
    results.push({ name: 'runner', pass: false, detail: e.message });
  } finally {
    cli.close();
  }

  printTable(results);

  const allPass = results.length > 0 && results.every((r) => r.pass);
  await reap();

  if (!allPass) { console.log('[smoke] RESULT: FAIL'); process.exit(1); }
  console.log('[smoke] RESULT: PASS');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('[smoke] unexpected error:', (e && e.stack) || e);
  await reap();
  process.exit(1);
});
