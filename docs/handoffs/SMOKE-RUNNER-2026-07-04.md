# MVP Smoke Runner + Session-Restore Fix — Handoff

**Date:** 2026-07-04
**Agent:** tester (smoke-runner)
**Work zone:** NEW `scripts/smoke-mvp.js`, `package.json` (one script line), `websocket/commands/session-persistence-commands.js` (one ReferenceError fix)
**Status:** DONE. `npm run smoke:mvp` runs GREEN — **14/14 checks PASS**, exit 0. Verified 2x, clean process reaping, no strays.

---

## TL;DR

- One canonical, LEAN smoke entry point: **`npm run smoke:mvp`**. Self-boots a headless browser on an isolated WS port, drives the live WS API against real pages, prints a PASS/FAIL table, exits 0/1, and always reaps its own process group.
- Fixed the pre-existing `restore_session_state` ReferenceError (`stateCapture` undefined in the `validateFirst` branch). `save_session_state -> restore_session_state` now round-trips; proven live in the runner.

---

## (a) The smoke runner — `scripts/smoke-mvp.js`

### How it runs (hygiene)
- **Isolated WS port:** asks the OS for a free ephemeral port and passes it via `BASSET_WS_PORT`; a random high port makes collision with another agent's browser effectively impossible. (During verification another agent's `bhb-verify` browser was running concurrently — no interference.)
- **Headless launch:** spawns the Electron binary (`require('electron')` path) with `--headless --no-sandbox --disable-gpu --disable-dev-shm-usage` and a **throwaway `--user-data-dir`** under `/home/devel/bhb-smoke-<pid>-<ts>/`.
- **`ELECTRON_RUN_AS_NODE` deleted** from the child env (plus `ELECTRON_NO_ATTACH_CONSOLE`); sets `NODE_ENV=production`, `ELECTRON_DISABLE_SANDBOX=1`, `BASSET_HOME_PAGE=about:blank`.
- **Detached, own process group.** On exit (success, failure, or signal) it reaps the **whole group** with `process.kill(-pid, SIGTERM)` then `SIGKILL`, and removes its temp dir. Verified: zero `bhb-smoke` strays and no leftover temp dirs after every run.
- **Protocol:** one persistent WS client, flat JSON `{command,id,...params}`, replies correlated strictly by `id` (stray/unsolicited frames ignored; `id:null` validation errors matched by command name).

### What it covers (14 checks)
| Check | Page | Observable asserted |
|---|---|---|
| navigate | example.com | `get_url` (authoritative) confirms the browser reached example.com |
| get_url | example.com | `success`, url === `https://example.com/` |
| get_content | example.com | length > 500 **and** contains `Example Domain` |
| screenshot | example.com | base64 PNG data URL, decoded > 1 KB (~13 KB actual) |
| set_local_storage -> get_local_storage | example.com | value round-trips (real webview localStorage) |
| **save_session_state -> restore_session_state** | example.com | both succeed via the `validateFirst` path (fix (b) proof) |
| navigate | local form page | reached the loopback form URL |
| fill | local form page | `#n` input value === written value (read back via execute_script) |
| click | local form page | button click succeeds |
| detect_technologies | local form page | real detection — **jQuery + Bootstrap** matched from live HTML |
| navigate | Wikipedia | reached the article |
| **extract_links** | Wikipedia | `count === all.length` **and** count within the live `document.links.length` window (exact when quiescent) |
| set_cookie -> get_cookies{url} | Wikipedia | URL-scoped read returns the just-set `bhb_smoke_url` cookie |
| export_raw_html | Wikipedia | 393 KB of real page HTML with page markers (not the shell) |

### Design decisions worth knowing (honest deviations from the task's literal wording)
1. **`data:` URL form → local loopback HTTP form.** The task said "click+fill on a data: URL form", but the browser's H-1 SSRF guard **hard-blocks the `data:` scheme** (only http/https, with opt-in `file://`). Rather than disable a security control (and it's outside my work zone anyway), the runner starts a tiny **loopback HTTP server** serving a self-contained form page and navigates to it with `BASSET_WS_ALLOW_PRIVATE_NETWORK=1` (QA-only, loopback). Same intent — a form I fully control, no external-network dependency — through a sanctioned scheme. That same page carries real jQuery/Bootstrap fingerprints, so it doubles as the `detect_technologies` target.
2. **`detect_technologies` target is the local page, not Wikipedia.** The fingerprint DB (`technology/fingerprints.js`, 74 entries) has **no MediaWiki**, so Wikipedia legitimately detects 0 — a bad "real detection" target. The local page's Bootstrap markers score ~37% (css link + `container`/`btn btn-primary` classes + `bootstrap.bundle.min.js`) and jQuery ~28% (`jquery-3.6.0.min.js` src + inline `$.fn.jquery`), both above the 25% `minConfidence`. Detection reads the **live rendered `<webview>` HTML** — this genuinely exercises the detect pipeline end-to-end.
3. **`extract_links` assertion is a bounded window, not a bare `===`.** Wikipedia lazy-loads a variable number of anchors, so `document.links.length` can tick up by 1–2 between the two separate IPC round-trips (observed 459→461). The check reads the DOM count **before and after** extraction and requires `extract_links.count` to fall within `[min,max]` (exact when the DOM is quiescent) plus `count === all.length`. This still proves extraction reads the real DOM (not the empty shell, which would give 0) without being flaky.
4. **`navigate` is confirmed via `get_url`, not its own reply.** During the startup-homepage settle, `navigate`'s echoed `url` can be stale (navigation-complete events aren't strictly 1:1 with the request — a warm-up navigate + `get_url` polling is the authoritative fix, matching the `mcp/verify_e2e.py` pattern).

### `package.json`
Added one line to `scripts`: `"smoke:mvp": "node scripts/smoke-mvp.js"`.

---

## (b) Session-restore ReferenceError fix

**File:** `websocket/commands/session-persistence-commands.js`, `restore_session_state` handler.

**Bug:** the `validateFirst` branch (default-on) called `stateCapture.validateState(...)` but `stateCapture` was **never instantiated** in that handler's scope — it only existed in `save_session_state`. So every restore that used validation threw `ReferenceError: stateCapture is not defined`. (Capture was fine; only restore was broken.)

**Fix:** instantiate it in the branch, mirroring `verify_session_state`:
```js
if (validateFirst) {
  const stateCapture = new BrowserStateCapture();
  const validation = stateCapture.validateState(sessionData.state);
  ...
```

**Verified live** in the runner: `save_session_state` → `restore_session_state` round-trips with `success:true` (restoreTime 1–4 ms) through the previously-broken `validateFirst` path, on two independent runs.

---

## Live results (representative run, all 14 PASS, exit 0)

```
navigate (example.com)                                          PASS  loaded, get_url=https://example.com/
get_url                                                         PASS  url=https://example.com/
get_content (Example Domain marker)                            PASS  len=544, marker present
screenshot (non-empty base64)                                  PASS  13140 bytes
set_local_storage -> get_local_storage round-trip              PASS  bhb_smoke_ls=... round-tripped
save_session_state -> restore_session_state (fix verification) PASS  saved+restored ... (validateFirst path OK)
navigate (local form page)                                     PASS  loaded http://127.0.0.1:<port>/
fill (form input value round-trip)                             PASS  input value === "basset-smoke"
click (form button)                                            PASS  button clicked
detect_technologies (real detection)                           PASS  2 detected: jQuery, Bootstrap
navigate (Wikipedia Web_scraping)                              PASS  loaded https://en.wikipedia.org/wiki/Web_scraping
extract_links (count tracks live document.links.length)        PASS  count=459 in document.links window [459, 461]
set_cookie -> get_cookies { url } (URL-scoped)                 PASS  count=8, includes bhb_smoke_url
export_raw_html (real page HTML, not shell)                    PASS  htmlLength=393118, real page markers present
```

Ran 2x clean. Process hygiene each run: detached process group reaped with `kill(-pid)`; post-run `ps` showed no `bhb-smoke` strays; temp under `/home/devel/bhb-smoke-*` removed.

**Note (network):** the example.com and Wikipedia checks require outbound network; the form/interaction/tech-detect checks are fully local (no external dependency). If run offline, the network-bound rows will FAIL honestly (they don't hang — per-command timeout 45 s).

## Files changed
- `scripts/smoke-mvp.js` — NEW, the canonical MVP smoke runner.
- `package.json` — added `"smoke:mvp"` script (one line).
- `websocket/commands/session-persistence-commands.js` — instantiate `BrowserStateCapture` in the `restore_session_state` `validateFirst` branch (fixes the ReferenceError).

No commits made.
