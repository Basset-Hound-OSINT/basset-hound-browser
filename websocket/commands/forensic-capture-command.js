/**
 * Forensic Capture Command — one-shot deterministic evidence bundle
 *
 * WS command: `forensic_capture`
 *
 * A server-side MACRO that orchestrates already-proven command handlers in a
 * fixed order and auto-writes a manifested, SHA-256-hashed evidence bundle to
 * disk. It ORCHESTRATES; it does not re-implement any capture primitive.
 *
 * Critical ordering (fixes the empty-HAR trap): `start_network_capture` is
 * invoked BEFORE `navigate`, because the network analysis manager is
 * constructed at boot but capture is NOT auto-started (main.js only runs
 * consoleManager.startCapture()). Without this, the HAR comes back empty.
 *
 * SCOPE (docs/architecture/SCOPE.md §0 / §3): raw artifacts + integrity hashes
 * ONLY. No scoring, no entity extraction, no classification, no model calls.
 * Does NOT import from src/agents/* or src/features/ai-analysis.js. Challenge
 * pages are DETECTED and flagged (challenge_suspected) — never bypassed, never
 * silently sealed as clean.
 *
 * All writes go through PathValidator (BASSET_ALLOWED_WRITE_DIRS gate). A write
 * targeting a directory outside the allowed set is rejected before any file is
 * created.
 *
 * @module websocket/commands/forensic-capture-command
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { PathValidator } = require('../../utils/path-validator');
const { ForensicAnalyzer } = require('../../src/v12-9-0/forensic-analyzer');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * Allowed write directories for capture bundles. Confines the (caller-supplied)
 * output_dir to the app's own output areas. Extend via BASSET_ALLOWED_WRITE_DIRS
 * (path-delimiter separated absolute dirs) — same gate the screenshot/cookie
 * managers use.
 */
function buildCaptureAllowedDirs() {
  const dirs = [
    path.join(process.cwd(), 'captures'),
    path.join(process.cwd(), 'exports'),
    path.join(process.cwd(), 'data'),
    path.join(process.cwd(), 'tmp'),
    path.join(process.cwd(), 'downloads'),
    os.tmpdir()
  ];
  if (process.env.BASSET_ALLOWED_WRITE_DIRS) {
    for (const d of process.env.BASSET_ALLOWED_WRITE_DIRS.split(path.delimiter)) {
      if (d && d.trim()) dirs.push(path.resolve(d.trim()));
    }
  }
  return dirs;
}

/**
 * Detect (do NOT bypass) a challenge / CAPTCHA / bot-wall page. Returns a flag
 * plus the reasons, so a challenge page is never sealed as clean evidence.
 *
 * Signals are deliberately PRECISE — a page that merely embeds bot-detection
 * code (e.g. every Google SERP references "/sorry/index" and "captcha" inside
 * its own JS) must NOT be flagged. We look for (a) challenge HTTP statuses,
 * (b) a redirect INTO a known challenge URL path, and (c) interstitial phrases /
 * challenge-widget markers that indicate the page IS the challenge, not one that
 * merely links to it. Over-flagging is the safe error direction, but a signal
 * that fires on every page is useless — so these are tuned to actual interstitials.
 */
function detectChallenge({ statusCode, html, finalUrl, title }) {
  const reasons = [];
  const sc = Number(statusCode) || 0;
  if ([401, 403, 429, 503].includes(sc)) reasons.push(`status_${sc}`);

  // (b) redirected into a known challenge path (Google /sorry/, generic /challenge)
  try {
    const p = new URL(finalUrl).pathname.toLowerCase();
    for (const seg of ['/sorry/', '/challenge', '/cdn-cgi/challenge', '/_sec/cp_challenge']) {
      if (p.includes(seg)) reasons.push(`url:${seg}`);
    }
  } catch (_) { /* non-URL final_url — ignore */ }

  // (c) interstitial phrases / challenge widgets present in the served body/title
  const hay = `${html || ''} ${title || ''}`.toLowerCase();
  const markers = [
    'our systems have detected unusual traffic',
    'detected unusual traffic from your computer',
    'unusual traffic from your computer network',
    'to continue, please type the characters',
    'checking your browser before accessing',
    'verify you are human', 'are you a robot',
    'please enable javascript and cookies to continue',
    'complete the security check to access',
    'attention required! | cloudflare',
    'cf-challenge', 'challenge-platform', 'cf_chl_opt',
    'g-recaptcha', 'h-captcha', 'px-captcha', 'perimeterx', 'datadome'
  ];
  for (const m of markers) {
    if (hay.includes(m)) reasons.push(`marker:${m}`);
  }
  return { suspected: reasons.length > 0, reasons };
}

/** Build a minimal, valid HAR 1.0 object from flattened getLogs() entries. */
function buildHar(logs, pageUrl) {
  const entries = (logs || []).map((log) => ({
    startedDateTime: log.startTime || new Date().toISOString(),
    time: log.duration || 0,
    request: {
      method: log.method || 'GET',
      url: log.url || '',
      httpVersion: 'HTTP/1.1',
      headers: log.headers || [],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: -1
    },
    response: {
      status: log.statusCode || 0,
      statusText: log.statusLine || '',
      httpVersion: 'HTTP/1.1',
      headers: log.responseHeaders || [],
      cookies: [],
      content: { size: log.contentLength || 0, mimeType: log.mimeType || 'application/octet-stream' },
      redirectURL: '',
      headersSize: -1,
      bodySize: log.contentLength || 0
    },
    cache: {},
    timings: { blocked: -1, dns: -1, connect: -1, send: 0, wait: log.duration || 0, receive: 0, ssl: -1 }
  }));
  return {
    log: {
      version: '1.0',
      creator: { name: 'Basset Hound Browser — forensic_capture', version: '1.0.0' },
      pages: [{ startedDateTime: new Date().toISOString(), id: 'page_1', title: pageUrl || '', pageTimings: {} }],
      entries
    }
  };
}

/** Minimal WARC 1.0 request/response record set from getLogs() entries. */
function buildWarc(logs) {
  let out = '';
  for (const log of (logs || [])) {
    const body = `${log.method || 'GET'} ${log.url || ''} -> ${log.statusCode || 0}\r\n`;
    out += 'WARC/1.0\r\n';
    out += 'WARC-Type: metadata\r\n';
    out += `WARC-Date: ${log.startTime || new Date().toISOString()}\r\n`;
    out += `WARC-Record-ID: <urn:uuid:${crypto.randomUUID()}>\r\n`;
    out += `WARC-Target-URI: ${log.url || ''}\r\n`;
    out += 'Content-Type: text/plain\r\n';
    out += `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n`;
    out += body + '\r\n\r\n';
  }
  return out;
}

function toBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  return Buffer.from(JSON.stringify(value, null, 2), 'utf8');
}

/**
 * Register the `forensic_capture` command on the WS server.
 *
 * @param {Object} server - WebSocket server instance (has commandHandlers.*)
 * @param {Object} deps - { networkAnalysisManager }
 */
function registerForensicCaptureCommand(server, deps = {}) {
  if (!server || !server.commandHandlers) {
    throw new Error('Invalid server instance');
  }
  const networkAnalysisManager = deps.networkAnalysisManager || server.networkAnalysisManager;
  const H = server.commandHandlers;

  server.commandHandlers.forensic_capture = async (params = {}) => {
    const warnings = [];
    const startedAt = new Date();
    try {
      const url = params.url;
      if (!url || typeof url !== 'string') {
        return { success: false, error: 'url is required' };
      }
      const options = params.options || {};
      const opt = {
        settle_ms: Number.isFinite(options.settle_ms) ? options.settle_ms : 1500,
        wait_for_selector: options.wait_for_selector || null,
        screenshot: options.screenshot !== false,
        network: options.network !== false,
        storage: options.storage !== false,
        extras: options.extras !== false,
        warc: options.warc === true
      };

      // Best-effort helper: run a handler, record a warning on failure, never throw.
      const safe = async (label, fn) => {
        try {
          const r = await fn();
          if (r && r.success === false) {
            warnings.push(`${label}: ${r.error || 'failed'}`);
          }
          return r;
        } catch (e) {
          warnings.push(`${label}: threw ${e.message}`);
          return { success: false, error: e.message };
        }
      };

      // 1. Network capture FIRST (before any request fires) — the core ordering.
      if (opt.network && networkAnalysisManager) {
        await safe('start_network_capture', () => H.start_network_capture({}));
      } else if (opt.network) {
        warnings.push('start_network_capture: network analysis manager not available');
      }

      // 2. Navigate (SSRF-guarded reuse).
      const nav = await safe('navigate', () => H.navigate({ url, timeout: 45000 }));

      // 3. Settle.
      if (opt.wait_for_selector) {
        await safe('wait_for_element', () => H.wait_for_element({ selector: opt.wait_for_selector, timeout: 15000 }));
      }
      if (opt.settle_ms > 0) await sleep(opt.settle_ms);

      // 4. Authoritative post-redirect URL.
      const urlRes = await safe('get_url', () => H.get_url({}));
      const finalUrl = (urlRes && urlRes.url) || (nav && nav.url) || url;

      // 5. Raw rendered HTML + status + response headers.
      const rawHtml = await safe('export_raw_html', () => H.export_raw_html({}));
      const html = (rawHtml && rawHtml.html) || '';
      const statusCode = (rawHtml && rawHtml.statusCode) != null ? rawHtml.statusCode : null;
      const responseHeaders = (rawHtml && rawHtml.responseHeaders) || {};
      const contentType = (rawHtml && rawHtml.contentType) || responseHeaders['content-type'] || null;
      const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
      const title = titleMatch ? titleMatch[1].trim() : null;

      // 6. Screenshot (record caveat; never fail on it).
      let shotBuf = null;
      if (opt.screenshot) {
        const shot = await safe('screenshot', () => H.screenshot({ format: 'png' }));
        const dataUrl = (shot && (shot.data || shot.screenshot || shot.image || shot.dataUrl)) || '';
        const m = /^data:image\/\w+;base64,(.+)$/.exec(String(dataUrl));
        if (m) {
          const buf = Buffer.from(m[1], 'base64');
          if (buf.length > 0) shotBuf = buf;
        }
        if (!shotBuf) warnings.push('screenshot: no image bytes (headless/offscreen caveat)');
      }

      // 7. Cookies.
      const cookies = await safe('get_all_cookies', () => H.get_all_cookies({}));

      // 8. Storage (origin-scoped).
      let origin = null;
      try { origin = new URL(finalUrl).origin; } catch (_) { origin = null; }
      const storage = { origin, localStorage: null, sessionStorage: null, indexedDB: null };
      if (opt.storage && origin && /^https?:/.test(origin)) {
        storage.localStorage = await safe('get_local_storage', () => H.get_local_storage({ origin }));
        storage.sessionStorage = await safe('get_session_storage', () => H.get_session_storage({ origin }));
        storage.indexedDB = await safe('get_indexeddb', () => H.get_indexeddb({ origin }));
      } else if (opt.storage) {
        warnings.push(`storage: skipped (non-http origin ${origin})`);
      }

      // 9. Extras: page state + tech + link/image/form extraction.
      let pageState = null, technologies = null, links = null, images = null, forms = null;
      if (opt.extras) {
        pageState = await safe('get_page_state', () => H.get_page_state({}));
        technologies = await safe('detect_technologies', () => H.detect_technologies({}));
        links = await safe('extract_links', () => H.extract_links({}));
        images = await safe('extract_images', () => H.extract_images({}));
        forms = await safe('extract_forms', () => H.extract_forms({}));
      }

      // 10. Network HAR + JSON (+ optional WARC) from the in-memory getLogs().
      let logs = [];
      if (networkAnalysisManager && typeof networkAnalysisManager.getLogs === 'function') {
        try { logs = await networkAnalysisManager.getLogs({}); } catch (e) { warnings.push(`getLogs: ${e.message}`); }
      }
      const har = buildHar(logs, finalUrl);

      // User agent (best-effort, non-fatal).
      let userAgent = null;
      const uaRes = await safe('user_agent', () => H.execute_script({ script: 'navigator.userAgent' }));
      if (uaRes && typeof uaRes.result === 'string') userAgent = uaRes.result;

      // Challenge detection (detect, never bypass / never seal-as-clean).
      const challenge = detectChallenge({ statusCode, html, finalUrl, title });

      // ---- Assemble artifacts (name, buffer, mime, source_command) ----
      const analyzer = new ForensicAnalyzer();
      analyzer.recordNavigation(finalUrl, startedAt.getTime());

      const artifacts = [];
      const addArtifact = (name, value, mime, source) => {
        const buffer = toBuffer(value);
        artifacts.push({ name, buffer, mime, source });
        return buffer;
      };

      const htmlBuf = addArtifact('page.html', html, 'text/html', 'export_raw_html');
      analyzer.captureHTMLSnapshot(htmlBuf, { source: 'export_raw_html' });

      if (shotBuf) {
        addArtifact('screenshot.png', shotBuf, 'image/png', 'screenshot');
        analyzer.captureScreenshot(shotBuf, { source: 'screenshot' });
      } else if (opt.screenshot) {
        addArtifact('screenshot_note.txt',
          'Screenshot unavailable at capture time (headless/offscreen paint caveat). See metadata warnings.',
          'text/plain', 'screenshot');
      }

      const harBuf = addArtifact('network.har', har, 'application/json', 'networkAnalysisManager.getLogs');
      analyzer.captureNetworkTrace(harBuf, { source: 'network' });
      addArtifact('network.json', logs, 'application/json', 'networkAnalysisManager.getLogs');
      if (opt.warc) addArtifact('network.warc', buildWarc(logs), 'application/warc', 'networkAnalysisManager.getLogs');

      const cookiesBuf = addArtifact('cookies.json', cookies || {}, 'application/json', 'get_all_cookies');
      analyzer.captureCookies(cookiesBuf, { source: 'get_all_cookies' });
      addArtifact('storage.json', storage, 'application/json', 'get_local_storage/get_session_storage/get_indexeddb');

      if (opt.extras) {
        addArtifact('page_state.json', pageState || {}, 'application/json', 'get_page_state');
        addArtifact('technologies.json', technologies || {}, 'application/json', 'detect_technologies');
        addArtifact('links.json', links || {}, 'application/json', 'extract_links');
        addArtifact('images.json', images || {}, 'application/json', 'extract_images');
        addArtifact('forms.json', forms || {}, 'application/json', 'extract_forms');
      }

      const metadata = {
        requested_url: url,
        final_url: finalUrl,
        statusCode,
        responseHeaders,
        contentType,
        title,
        htmlLength: html.length,
        userAgent,
        capturedAt: startedAt.toISOString(),
        options: opt,
        challenge_suspected: challenge.suspected,
        challenge_reasons: challenge.reasons,
        warnings
      };
      addArtifact('metadata.json', metadata, 'application/json', 'forensic_capture');

      const chainOfCustody = {
        generatedAt: new Date().toISOString(),
        records: analyzer.chainOfCustody.getFullChainOfCustody(),
        timeline: analyzer.timeline.getTimelineSequence(),
        artifacts: analyzer.getArtifactsList()
      };
      addArtifact('chain_of_custody.json', chainOfCustody, 'application/json', 'ForensicAnalyzer');

      // ---- Resolve + validate the output directory (PathValidator gate) ----
      const baseDir = params.output_dir
        || path.join(process.env.BASSET_CAPTURE_DIR || process.cwd(), 'captures');
      const ts = startedAt.toISOString().replace(/[:.]/g, '-');
      const shortHash = sha256(Buffer.from(finalUrl)).slice(0, 8);
      const bundleDir = path.join(path.resolve(baseDir), `capture_${ts}_${shortHash}`);

      const validator = new PathValidator({ allowedDirs: buildCaptureAllowedDirs(), logViolations: false });
      const probe = validator.validatePath(path.join(bundleDir, 'manifest.json'), 'write');
      if (!probe.valid) {
        return {
          success: false,
          error: `output_dir rejected by PathValidator: ${probe.error}`,
          bundle_dir: null
        };
      }
      fs.mkdirSync(bundleDir, { recursive: true });

      // ---- Write every artifact through PathValidator; hash the exact bytes ----
      const files = [];
      for (const a of artifacts) {
        const target = path.join(bundleDir, a.name);
        const v = validator.validatePath(target, 'write');
        if (!v.valid) {
          warnings.push(`write ${a.name}: rejected by PathValidator (${v.error})`);
          continue;
        }
        fs.writeFileSync(v.realPath, a.buffer);
        files.push({
          name: a.name,
          sha256: sha256(a.buffer),
          bytes: a.buffer.length,
          mime: a.mime,
          source_command: a.source,
          iso_ts: new Date().toISOString()
        });
      }

      // Tamper seal: deterministic hash over stable {name, sha256, bytes} entries.
      const sealSource = files
        .map((f) => `${f.name}\0${f.sha256}\0${f.bytes}`)
        .sort()
        .join('\n');
      const bundleSha256 = sha256(Buffer.from(sealSource, 'utf8'));

      const manifest = {
        version: '1.0',
        tool: 'forensic_capture',
        requested_url: url,
        final_url: finalUrl,
        captured_at: startedAt.toISOString(),
        challenge_suspected: challenge.suspected,
        hash_algo: 'sha256',
        files,
        bundle_sha256: bundleSha256
      };
      const manifestBuf = toBuffer(manifest);
      const manifestPath = path.join(bundleDir, 'manifest.json');
      const mv = validator.validatePath(manifestPath, 'write');
      if (!mv.valid) {
        return { success: false, error: `manifest write rejected: ${mv.error}`, bundle_dir: bundleDir };
      }
      fs.writeFileSync(mv.realPath, manifestBuf);

      // ---- Small WS reply (heavy bytes stay on disk) ----
      return {
        success: true,
        bundle_dir: bundleDir,
        final_url: finalUrl,
        status_code: statusCode,
        captured_at: startedAt.toISOString(),
        challenge_suspected: challenge.suspected,
        manifest: {
          files: files.map((f) => ({
            name: f.name, sha256: f.sha256, bytes: f.bytes, mime: f.mime, source_command: f.source_command
          })),
          bundle_sha256: bundleSha256
        },
        warnings
      };
    } catch (error) {
      return { success: false, error: error.message, warnings };
    }
  };
}

module.exports = { registerForensicCaptureCommand, detectChallenge };
