---
title: GUI and Simple Forensic-Capture — Executable Plan
version: 1.0
date: 2026-07-04
status: ready-for-dev
owner: sprint-planner
scope_ref: docs/architecture/SCOPE.md (§0 blacklist, §3 forensic capture)
status_ref: docs/planning/PROJECT-STATUS-MATRIX.md
supersedes_streams:
  - capture-design
  - gui-design
  - scope-diagnostics-coordination
features:
  - A: one-shot forensic_capture WS command + <20-line Python client
  - B: opt-in lightweight GUI (runtime visibility toggle)
teams:
  - capture-team
  - gui-team
execution: PARALLEL (disjoint file sets, zero serialization)
---

# GUI and Simple Forensic-Capture — Executable Plan

This is the single authoritative plan consolidating three design streams (capture,
GUI, scope/diagnostics/coordination) into work the two dev teams can execute in
parallel. Every code anchor below was re-verified against the live tree on
2026-07-04. Both features are deterministic, model-free, and in scope per SCOPE.md
§3 (forensic capture with integrity) and §0 (no in-process agents, no LLM/model
SDKs, detect-not-bypass).

---

## 0. The one conflict, resolved

The capture stream and the scope stream disagreed on Feature A's architecture:

- **Capture stream:** build a server-side `forensic_capture` WS command (new module
  + 2 registration lines in `websocket/server.js`). This is the only way to keep the
  Python client under 20 lines, because all orchestration/hashing/file-I/O moves
  server-side.
- **Scope stream:** freeze `websocket/server.js`; make capture a client-side CLI that
  composes existing commands, to avoid two teams colliding in the monolith and in
  `src/main/main.js`.

**Decision: build the server-side command.** Justification:

1. The operator explicitly requires a **<20-line Python client**. A client-side
   orchestrator would need ~10 ordered round-trips plus base64 decode, file I/O,
   SHA-256, and manifest assembly — far more than 20 lines and error-prone. Only a
   server-side macro satisfies the requirement.
2. The scope stream's freeze existed to prevent **two teams editing the same file in
   parallel**. Under the server-side design that risk **does not exist**: the GUI team
   never touches `websocket/server.js`, and the capture team never touches
   `src/main/main.js`. Each monolith has exactly one editor. See §3.
3. The server.js edit is minimal and additive — one `require` and one registration
   call, following the exact existing pattern of `registerExportFormatCommands`
   (server.js:98 require, server.js:11773 registration). No existing handler is
   modified.

All other scope-stream mitigations (blacklist guardrail, challenge-detection flag,
GUI jest gate, hash-determinism rule, no throwaway scripts) are **retained in full**
below.

---

## 1. FEATURE A — one-shot forensic capture

### 1.1 Reuse-vs-build decision

- **Reuse (unchanged):** every capture primitive already exists and is proven-working
  (PROJECT-STATUS-MATRIX §1/§2/§4/§8). The command orchestrates, it does not
  re-implement: `start_network_capture` (server.js:8767), `navigate` (SSRF-guarded),
  `get_url`, `export_raw_html` (server.js:8916), `screenshot` (server.js:3194),
  `get_all_cookies` (server.js:3373), `get_local_storage` (server.js:7423),
  `get_session_storage` (server.js:7480), `get_indexeddb` (server.js:7537),
  `get_page_state` (server.js:3266), `detect_technologies`,
  `extract_links/images/forms`, `networkAnalysisManager.getLogs()`
  (network-analysis/manager.js:395), the in-memory HAR/WARC builders in
  `websocket/commands/export-formats.js`, SHA-256 + ChainOfCustody from
  `src/v12-9-0/forensic-analyzer.js` (`_calculateHash`:34, `ChainOfCustody`:119,
  `addArtifact`:230, `recordCollection`:125), and the write gate
  `utils/path-validator.js` (`getInstance().validatePath(path,'write')`).
- **Build (new):** there is **no** one-shot command today. A grep of
  `websocket/server.js` + `websocket/commands/` for capture/forensic_capture/snapshot/
  bundle/manifest/capture_all found no orchestrator that navigates and auto-writes a
  multi-file bundle. The existing `export_html_*` and `export_format_*` commands are
  passive (caller supplies data) or write exactly one file. So build one new command
  module + a thin Python client.

### 1.2 Command spec — `forensic_capture`

New WS command: a deterministic server-side macro. No intelligence, no scoring — raw
artifacts + hashes only.

**Params (flat JSON):**

| field | req | default | notes |
|---|---|---|---|
| `command` | yes | `"forensic_capture"` | |
| `id` | yes | — | correlation id (client id-matches the reply) |
| `url` | yes | — | routed through the SSRF-guarded navigate path |
| `output_dir` | no | `${BASSET_CAPTURE_DIR||cwd}/captures` | validated via PathValidator `'write'`, same gate `export_format_json` uses (export-formats.js:108-123) |
| `options` | no | see below | |

**options:** `settle_ms` (=1500), `wait_for_selector` (optional → wait_for_element),
`screenshot` (=true), `network` (=true), `storage` (=true), `extras` (=true),
`warc` (=false). `hash_algo` fixed `sha256`.

**Orchestration order (this ordering is the core value — it fixes the empty-HAR trap):**

1. If `options.network`: call `start_network_capture` **FIRST** (installs webRequest
   hooks before any request fires — `networkAnalysisManager` is constructed at boot,
   main.js:956, but capture is **not** auto-started; boot only runs
   `consoleManager.startCapture()`, main.js:909).
2. `navigate(url)` — reuse SSRF-guarded handler.
3. Settle: wait `settle_ms` and/or `wait_for_element(wait_for_selector)`.
4. `get_url` → authoritative post-redirect final URL.
5. `export_raw_html` → raw rendered HTML + statusCode + responseHeaders + contentType.
6. `screenshot` → base64 PNG (record the headless/mainWindowDirect caveat as a
   warning; do **not** fail on it).
7. `get_all_cookies`.
8. `get_local_storage` + `get_session_storage` + `get_indexeddb`.
9. `get_page_state` + `detect_technologies` + `extract_links/images/forms`.
10. `networkAnalysisManager.getLogs()` → HAR 1.0 (reuse the in-memory HAR builder) +
    `network.json` + optional WARC.
11. For every artifact: SHA-256 via `crypto.createHash('sha256')` (or
    `ForensicAnalyzer._calculateHash`) and register in ChainOfCustody
    (`addArtifact`/`recordCollection`).
12. Write ALL files through **PathValidator**; emit `manifest.json` +
    `chain_of_custody.json`.

**Hard implementation rules (from the design review):**

- **Route every write through PathValidator.** `export_format_har/warc/csv` currently
  `fs.writeFileSync` **without** validation (export-formats.js:282-286, 345-351). Do
  **not** reuse those file-write branches — reuse only their in-memory HAR/WARC
  *builders* and write via the validated `realPath`.
- **Never throw on a single missing sub-capture.** Record it in `warnings[]` so a
  partial page still yields a bundle.
- **Challenge detection, not bypass (SCOPE §0 / known P0).** A CAPTCHA/challenge page
  can currently be returned as captured content (server.js ~2952-2959). Record
  `statusCode` and a `challenge_suspected` boolean in `metadata.json`. Flag it —
  never silently seal a challenge page as clean evidence, never attempt bypass.
- **Blacklist guardrail (SCOPE §0/§2).** Record raw artifacts + hashes ONLY. No email/
  phone/entity extraction, no "importance" scoring, no classification. Do not import
  from `src/agents/orchestrator.js` or `src/features/ai-analysis.js` (deferred
  blacklist violators still on disk).
- **Keep the WS response small; heavy bytes on disk.** `page.html` + base64
  screenshot easily exceed the 1 MB websockets default frame cap. The reply returns
  only the manifest + `bundle_dir`; the client reads the files from disk (same-host,
  loopback-bind local-agent model, status matrix §4).

### 1.3 Output bundle

Auto-written to `capture_<UTCts>_<shorthash>/`:

```
page.html             export_raw_html.html — ALL raw rendered HTML
screenshot.png        decoded base64 (or screenshot_note.txt if headless-empty)
network.har           HAR 1.0 from getLogs — all requests/responses/headers/timing
network.json          export_network_log
network.warc          optional (options.warc)
cookies.json          get_all_cookies
storage.json          { localStorage, sessionStorage, indexedDB }
page_state.json       forms/links/buttons
technologies.json, links.json, images.json, forms.json
metadata.json         requested_url, final_url, statusCode, responseHeaders,
                      contentType, title, htmlLength, userAgent, capturedAt,
                      options, challenge_suspected
chain_of_custody.json ForensicAnalyzer chain-of-custody + timeline
manifest.json         files[]: {name, sha256, bytes, mime, source_command, iso_ts};
                      bundle_sha256 = hash over the manifest entries = tamper seal
```

**WS reply (small):**
`{ success, id, bundle_dir (abs realPath), final_url, status_code, captured_at,
manifest:{ files:[{name,sha256,bytes,mime,source_command}], bundle_sha256 },
warnings:[...] }`. The client only needs `bundle_dir`.

### 1.4 The <20-line Python client

Location (operator directive): **`tmp/real_world_test/capture_client.py`** (new dir,
created by the capture team). ~17 lines because all orchestration/hashing/file-I/O is
server-side:

```python
import asyncio, json, websockets

async def capture(url, output_dir=None):
    async with websockets.connect("ws://127.0.0.1:8765", max_size=None) as ws:
        await ws.send(json.dumps({
            "command": "forensic_capture", "id": "1",
            "url": url, "output_dir": output_dir}))
        while True:                               # id-correlate; skip event frames
            msg = json.loads(await ws.recv())
            if msg.get("id") == "1":
                return msg

if __name__ == "__main__":
    res = asyncio.run(capture("https://www.google.com/search?q=basset+hound"))
    print("bundle:", res["bundle_dir"])
    print("files:", [f["name"] for f in res["manifest"]["files"]])
```

Two contract points that MUST hold on the server side for this to stay <20 lines:
(1) `max_size=None` on the client + a small WS reply (bytes on disk, not in the
frame); (2) the `while/recv` id loop mirrors the proven MCP bridge id-correlation
(`mcp/server.py`) because the flat-JSON socket may interleave unrelated event frames.

**Operational prerequisite:** `BASSET_ALLOWED_WRITE_DIRS` must include the capture
`output_dir` (and `tmp/real_world_test/` if used as output) or PathValidator rejects
the write. Document this in the client's header comment and in the smoke test setup.

---

## 2. FEATURE B — opt-in lightweight GUI

### 2.1 Design — this is a toggle, not a build

The full Chromium-style chrome ALREADY exists and is fully wired. Reuse verbatim,
zero renderer rewrites:

- `renderer/index.html:488-561` — tab bar, toolbar (back/forward/refresh/home),
  address bar `#url-input` (521-523), Go button, `.webview-container` for per-tab
  `<webview>`s, loading overlay, status bar.
- `renderer/renderer.js:342-357` — `setupNavigationListeners()` wires every button +
  the url-input keypress to `navigateTo()`; `createTab()` (88) builds a real
  `<webview>` per tab; IPC listeners at 513+. Uses `window.electronAPI` throughout.
- `src/preload/preload.js:4-190` — `electronAPI` exposes navigate/newTab/switchTab/
  navigateTab/reloadTab, etc. All nav plumbing present.
- `src/main/main.js:764-781` builds `windowConfig` with **no explicit `show:`** (so
  Electron defaults `show:true`); the only thing hiding it is the headless override at
  784-787 (`getBrowserWindowConfig` → `show:false`, headless/manager.js when enabled).
  `loadFile('renderer/index.html')` runs unconditionally at 827.

Today visibility is **auto-detected, not opt-in**: `initializeHeadlessModeEarly()`
(main.js:2797+) forces headless on `--headless || !hasDisplay || dockerEnvironment ||
ELECTRON_DISABLE_SANDBOX===1`. There is no `--gui` / `BASSET_GUI` anywhere.

**The design:** decouple window visibility from headless runtime tuning. Introduce
`isGuiMode = (--gui OR BASSET_GUI=1) AND hasDisplay`
(`headlessManager.detectHeadlessEnvironment().hasDisplay`). In `createWindow()` set
`windowConfig.show = isGuiMode` explicitly (~main.js:781). Precedence: if `isGuiMode`,
**skip** the headless hidden/offscreen override (do not call `getBrowserWindowConfig`
at 784-787, do not enable offscreen at 1112); if headless is auto-detected and NOT
gui, keep `show:false` as today. If `--gui` is passed but no display exists, log a
warning and fall back to headless (a real window cannot paint without X/Xvfb).

Result: the already-styled window (address bar → navigateTo, back/forward/reload/home,
existing tabs + `<webview>`) appears only when explicitly opted in. No new UI, no new
webview manager — just flip `show`.

### 2.2 Opt-in mechanism (default OFF — headless stays default)

- **CLI flag:** add a `gui` entry to `CLI_ARGS` in `config/cli.js` next to the
  `headless` block (verified at cli.js:100-105):
  `{ flags:['--gui'], type:'boolean', configPath:'gui.enabled', description:'Show the browser window (opt-in; default headless)' }`.
  `parseArgs` surfaces it as `appConfig.gui.enabled`.
- **Env var:** `BASSET_GUI=1|true`, read in a small `getGuiOptions()` helper placed
  next to `getHeadlessOptions()` (verified at main.js:594):
  `enabled: appConfig.gui?.enabled || process.argv.includes('--gui') || ['1','true'].includes(process.env.BASSET_GUI)`.

The single show/hide decision lives once in `createWindow()` at the `windowConfig.show`
assignment (~main.js:781), computed from `getGuiOptions()` and `hasDisplay`. Absence of
the flag/env keeps the window hidden → `npm run start:headless` is unchanged.

### 2.3 Build with / without

One artifact, toggled at runtime — **no packaging split.** `renderer/**` and
`headless/**` are already in electron-builder `build.files`, and main.js loads
`renderer/index.html` unconditionally, so GUI assets ship in every build regardless.

- **Without GUI (default):** ship as-is; headless auto-detects on a display-less host
  or via `--headless`. Nothing to strip.
- **With GUI:** SAME binary, launch `--gui` or `BASSET_GUI=1` on a host with a display
  or Xvfb.
- **Convenience only:** add `"start:gui": "electron . --gui"` (verified insertion point
  package.json scripts, after :12) and optionally `"start:gui:dev"`. Do NOT add a build
  flavor or change `build.files` — the renderer is ~70KB, loaded by shared startup code
  either way; a GUI-less build would save nothing and risks breaking the always-load
  path.

### 2.4 Testability refactor (enables the merge-gate unit test)

Extract the GUI's NON-DOM logic into an importable module `renderer/gui-logic.js`
(GUI-owned, new file): the function that turns a toolbar action into a WS command
frame, and the connection-state reducer. `renderer.js` imports it. This is what the
jest unit test in §4 covers (smoke:mvp is headless and cannot drive a real window).

---

## 3. WORK-ZONE PARTITION — definitive, non-overlapping

Under the §0 decision (Feature A = server-side command; capture team never enters
main.js), the two teams' file sets are **disjoint**. There is **no shared file** and
**no serialization**.

### CAPTURE TEAM — write-owns exclusively
- `websocket/commands/forensic-capture-command.js` — **NEW** (~150-200 lines).
  Exports `registerForensicCaptureCommand(server, { networkAnalysisManager })`;
  registers `server.commandHandlers.forensic_capture`; orchestrates existing
  `this.commandHandlers.*` by direct in-process call; writes the bundle via `fs` +
  `utils/path-validator.js`; hashes via `crypto` / `src/v12-9-0/forensic-analyzer.js`.
- `websocket/server.js` — **two additive lines only**: one `require` in the command-
  require block (~line 95-98, beside `registerExportFormatCommands`) and one
  `registerForensicCaptureCommand(this, { networkAnalysisManager: this.networkAnalysisManager });`
  call in the registration cluster (~line 11775, immediately after the
  `registerExportFormatCommands` call). **No existing handler modified.**
- `scripts/smoke-mvp.js` — capture team is the ONLY editor (adds one verification row,
  §4).
- `tmp/real_world_test/capture_client.py` — **NEW** (the <20-line client).
- **MUST NOT touch:** `src/main/main.js`, `renderer/*`, `src/preload/*`,
  `config/cli.js`, `package.json`.
- **Reused read-only (never modified):** `src/v12-9-0/forensic-analyzer.js`,
  `utils/path-validator.js`, `network-analysis/manager.js`, the in-memory HAR/WARC
  builders in `websocket/commands/export-formats.js`.

### GUI TEAM — write-owns exclusively
- `src/main/main.js` — GUI is the ONLY editor: add `getGuiOptions()` next to
  `getHeadlessOptions()` (~594); set `windowConfig.show = isGuiMode` in `createWindow()`
  (~781); gate the headless-vs-gui precedence so the hidden/offscreen override (784-787)
  and `enableOffscreenRendering` (1112) are skipped when gui is on.
- `config/cli.js` — add the `gui` key to `CLI_ARGS` near the headless block (~105).
- `package.json` — add `start:gui` (and optional `start:gui:dev`) to scripts. No
  `build.files` change.
- `renderer/gui-logic.js` — **NEW** (extracted non-DOM logic) + the minimal
  `renderer/renderer.js` import line to consume it.
- `tests/unit/gui-logic.test.js` — **NEW** jest test (§4).
- **MUST NOT touch:** `websocket/server.js`, `scripts/smoke-mvp.js`,
  `websocket/commands/*`, `tmp/real_world_test/*`.

### Shared-file check
| file | capture | gui |
|---|---|---|
| `websocket/server.js` | edits (2 additive lines + new module) | never |
| `src/main/main.js` | never | edits |
| `config/cli.js` | never | edits |
| `package.json` | never | edits |
| `scripts/smoke-mvp.js` | edits | never |
| `renderer/*` | never | edits |

Every file has exactly one editor. **No shared file, no sequencing forced.** The
scope stream's serialization contingency (coordinator-gated single-owner server.js
edit) is therefore not triggered — it remains the fallback only if capture later needs
a *second* server.js touch beyond the require+registration lines, which the current
design does not.

---

## 4. VERIFICATION — minimal, no lingering throwaway scripts

Reuse the canonical harness; add coverage in-place. No standalone throwaway scripts.

### Feature A — fold into `scripts/smoke-mvp.js`
`smoke:mvp` self-boots a headless browser on an isolated WS port, drives the live API,
asserts observables PASS/FAIL, and reaps its temp dir (14/14 green today). Add **one
row** after boot:

1. Point `output_dir` at the smoke run's temp dir (already in
   `BASSET_ALLOWED_WRITE_DIRS` for the run; ensure the smoke harness sets it).
2. Run `forensic_capture` against the page smoke already serves (or example.com).
3. Assert `bundle_dir` exists and `page.html`, `metadata.json`, `manifest.json` are
   present.
4. **Self-proving determinism:** re-read `page.html` from disk, recompute its SHA-256,
   and assert it equals the `manifest.json` entry for `page.html`.
5. Existing reaper cleans up.

**Hash-determinism rule (critical to avoid flake):** the smoke assertion hashes the
**stable artifact bytes** (`page.html`), NOT the wrapping metadata. Timestamps and
volatile response headers in `metadata.json`/`manifest.json` change every run and must
never be part of the asserted hash.

### Feature B — split coverage (smoke:mvp is headless, cannot render a window)
1. **Merge gate — one jest unit test** `tests/unit/gui-logic.test.js` over the extracted
   `renderer/gui-logic.js`: assert a toolbar action produces the correct WS command
   frame and the connection-state reducer transitions correctly. This is the GUI
   merge gate.
2. **Optional runtime self-report:** register a lightweight check via the existing
   `HealthChecker.registerCheck()` (src/infrastructure/health-check-enhanced.js:120) so
   `/api/v1/diagnostics` reports `gui:available`. Nice-to-have, not a gate.
3. **Optional pre-release:** a headed xvfb smoke (renderer loads, `--gui` actually gates
   GUI vs headless, reaches "connected"). Document as a MANUAL step in a QA doc — NOT a
   permanent CI script, NOT a throwaway in the repo root.

---

## 5. ORDERED EXECUTION

### Run order: FULLY PARALLEL
Disjoint file sets (§3) → both teams start immediately, no sequencing, no coordinator
gate. No integrator merge step is required beyond normal review because no file is
co-edited.

### Capture team — acceptance
- [ ] `forensic_capture` registered (server.js require + registration lines present).
- [ ] Calling it navigates, writes the bundle dir with `page.html`, `network.har`,
      `cookies.json`, `storage.json`, `metadata.json`, `manifest.json`,
      `chain_of_custody.json` (screenshot present or `screenshot_note.txt`).
- [ ] `start_network_capture` runs BEFORE navigate (HAR is non-empty for a page that
      makes requests).
- [ ] Every file written through PathValidator; write outside
      `BASSET_ALLOWED_WRITE_DIRS` is rejected.
- [ ] `metadata.json` carries `statusCode` + `challenge_suspected`; a challenge page is
      flagged, never sealed as clean, never bypassed.
- [ ] `manifest.json` sha256 of `page.html` matches an independent recompute.
- [ ] `tmp/real_world_test/capture_client.py` is <20 lines and prints `bundle_dir` +
      file list against a live browser.
- [ ] `npm run smoke:mvp` green with the new capture row; no new standalone scripts.
- [ ] No import from `src/agents/*` or `src/features/ai-analysis.js`; no entity/scoring
      logic added.

### GUI team — acceptance
- [ ] `--gui` and `BASSET_GUI=1` each make the window visible on a host with a display;
      absence keeps it hidden.
- [ ] `npm run start:headless` behavior unchanged (still hidden, still 14/14 smoke).
- [ ] `--gui` with no display logs a warning and falls back to headless (no crash).
- [ ] Renderer/preload unchanged except the single `gui-logic.js` import; address bar +
      back/forward/reload/home + tabs + `<webview>` work in the visible window.
- [ ] `start:gui` script present; no `build.files` change.
- [ ] `tests/unit/gui-logic.test.js` passes (merge gate).
- [ ] No touch to `websocket/server.js`, `scripts/smoke-mvp.js`, or capture files.

---

## Appendix — verified code anchors (2026-07-04)
- server.js: require block :95/:98; registration cluster :11766-11776; handlers
  screenshot :3194, get_page_state :3266, get_all_cookies :3373, get_local_storage
  :7423, get_session_storage :7480, get_indexeddb :7537, start_network_capture :8767,
  export_raw_html :8916, export_network_log :8989; whitelist :136-141.
- main.js: getHeadlessOptions :594; createWindow :756; windowConfig :764-781; headless
  override :784-787; loadFile :827; enableOffscreenRendering :1112; whenReady
  createWindow :2940.
- config/cli.js: CLI_ARGS :10; headless block :100-105.
- package.json: scripts :6; start:headless :10; smoke:mvp :12.
- network-analysis/manager.js: startCapture :79; getLogs :395.
- forensic-analyzer.js: _calculateHash :34; ChainOfCustody :119; recordCollection :125;
  addArtifact :230.
- Present: utils/path-validator.js, src/v12-9-0/forensic-analyzer.js,
  websocket/commands/export-formats.js, scripts/smoke-mvp.js.
- Absent (to be created): tmp/real_world_test/, forensic-capture-command.js,
  renderer/gui-logic.js.
