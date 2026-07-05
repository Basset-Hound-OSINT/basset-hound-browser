---
title: Basset Hound Browser — Prune Manifest (SAFE deletion plan)
status: EXECUTABLE — verified against the live runtime load graph on 2026-07-04
author: analyst@prune-manifest (analysis only; deleted nothing, edited no code)
companions: FEATURE-COMPLETION-ROADMAP.md (Part B PRUNE), PROJECT-STATUS-MATRIX.md
method: |
  Traced the ACTUAL runtime require() graph from src/main/main.js -> websocket/server.js
  -> every explicitly-required command/handler module. Confirmed server.js has NO dynamic
  glob/readdir loader (every command module is required by an explicit literal path), so any
  file not on that explicit require chain is genuinely unreachable at runtime.
  A path is SAFE-TO-DELETE only if NOTHING loaded at runtime require()s it.
invariant: |
  This manifest is meant to be executed BLINDLY by a later prune agent. Every item in
  "SAFE-TO-DELETE (blind)" was verified to have zero runtime loaders. Items that ARE loaded
  at runtime are in DO-NOT-DELETE / NEEDS-UNREGISTER-FIRST and must NOT be touched by a blind pass.
---

# Prune Manifest

## 0. How this was verified (evidence trail)

- **No dynamic loader.** `websocket/server.js` requires each command/handler by literal path
  (34 explicit `require('./commands/...')` / `require('./handlers/...')` calls). There is **no**
  `readdirSync`/`glob`/`requireDir` over `commands/` or `handlers/`. Therefore an unregistered file
  in those dirs is unreachable — confirmed for every "unregistered handler" below.
- **Runtime graph root:** `src/main/main.js` -> `new WebSocketServer(...)` (main.js:1062) ->
  `websocket/server.js` registration block (ends ~server.js:11834).
- Each candidate was grepped repo-wide (excluding `node_modules`, `coverage/`, and `tests/`) for
  `require(...)` of it. "non-test refs = none" below means: no production/loaded file imports it.

**Important correction to the roadmap:** Since FEATURE-COMPLETION-ROADMAP.md was written, two of its
items were already wired and are now **loaded at runtime**:
- **A5/A8 landed:** `registerV12_9_0Commands()` **is now called** at `websocket/server.js:11831`,
  which `require`s `src/v12-9-0/compression-engine.js` and `src/v12-9-0/forensic-analyzer.js`
  (via `websocket/commands/v12-9-0-integration-commands.js:11-12`). These are **DO-NOT-DELETE**.
- **A4 landed:** a **real** thin MCP server exists at `mcp/server.py` (17 `@mcp.tool()` pass-through
  tools, no models/agents) plus `mcp/verify_e2e.py`. P6 now applies **only** to the mock JS "MCP" test,
  not to a fictional server.

**Second correction — the recording subsystem is NOT dead.** Roadmap P3 calls `recording/` a deletable
stub set. In reality `recording/{manager,session-recorder,replay,interaction-recorder}.js` and
`src/recording/{video-encoder,video-storage,video-player}.js` are **required and registered at runtime**.
They are stubs whose methods throw *when called*, but deleting the files **breaks boot**. They are
handled under NEEDS-UNREGISTER-FIRST, not the blind-safe set.

---

## 1. SAFE-TO-DELETE (blind) — zero runtime loaders

> Deleting all of these requires **NO** unregister edits first: nothing loaded at runtime references
> them. Grouped; dependency order within a group does not matter (no group member is required by a
> live file). Recommended overall order is top-to-bottom.

### 1A. Unregistered evasion handler/command files (delete FIRST — they are the only non-test importers of the `src/evasion/*` cluster)
These 4 define `register*` functions that are **never called** anywhere (verified: not in server.js's
explicit require list; grep for their names outside their own files + tests = none):
- `websocket/handlers/behavioral-simulator-handler.js`
- `websocket/handlers/device-fingerprinter-handler.js`
- `websocket/commands/coherence-check.js`
- `websocket/commands/coherence-validation-commands.js`

Once these 4 are gone, the entire `src/evasion/*` cluster (below) has **only test importers left**.

### 1B. `src/evasion/*` simulator/coherence/fingerprint cluster — 33 files
All references are test-only except the 4 files in 1A. `multi-layer-coordinator.js` wires modules by
string name only; `preloader.js` is required by nothing loaded; `device-fingerprinter.js` /
`preloader.js` cross-reference other cluster members but are themselves test-only. Delete:

```
src/evasion/audio-context-evasion.js
src/evasion/battery-api-evasion.js
src/evasion/behavioral-micro-timing.js
src/evasion/behavioral-simulator.js
src/evasion/bluetooth-api-evasion.js
src/evasion/coherence-manager.js
src/evasion/coherence-validators.js
src/evasion/detection-service-testing.js
src/evasion/device-fingerprint-database.js
src/evasion/device-fingerprinter.js
src/evasion/fingerprint-profiles.js
src/evasion/fingerprint-template-cache.js
src/evasion/fingerprint-validator.js
src/evasion/font-enumeration-evasion.js
src/evasion/geolocation-spoofer.js
src/evasion/http2-header-ordering.js
src/evasion/http2-priority-manipulation.js
src/evasion/multi-layer-coordinator.js
src/evasion/network-obfuscation.js
src/evasion/notification-api-evasion.js
src/evasion/plugin-enumeration-evasion.js
src/evasion/preloader.js
src/evasion/sensor-api-evasion.js
src/evasion/session-coherence.js
src/evasion/timing-randomization.js
src/evasion/tls-cipher-rotation.js
src/evasion/tls-extension-ordering.js
src/evasion/tls-fingerprinting.js
src/evasion/tls-version-evasion.js
src/evasion/vendor-detection-evasion.js
src/evasion/vibration-api-evasion.js
src/evasion/webgl-detection-v2.js
src/evasion/webrtc-evasion.js
```
> NOTE: `src/evasion/canvas-evasion.js`, `src/evasion/canvas-fingerprinting-v2.js`,
> `src/evasion/webgl-evasion.js` are **excluded here** — they are in the PRESERVE list (Section 3).
> The TLS `src/evasion/tls-*` files "touch no socket" (roadmap R14) and are safe to delete here; do
> **NOT** confuse them with `websocket/middleware/tls-enforcement.js`, which is legitimate live WS TLS
> and is NOT a candidate.

### 1C. v12.9.0 orphans — unregistered, zero non-self references
- `src/v12-9-0/evasion-handler.js`  (unregistered; evasion is DEFERRED research)
- `src/v12-9-0/evasion-websocket-commands.js`
- `src/v12-9-0/features/export-handler.js`  (duplicate export path; the LIVE one is `websocket/commands/export-formats.js`)
- `src/v12-9-0/features/export-websocket-commands.js`

> Verified: `websocket/commands/v12-9-0-integration-commands.js` (the file that IS registered) requires
> **only** `compression-engine` and `forensic-analyzer` — NOT any of the four above.

### 1D. Out-of-scope proxy orphans
- `websocket/handlers/proxy-handler.js`  (not registered; the only importer of residential-proxy-manager)
- `src/proxy/residential-proxy-manager.js`  (only importer was proxy-handler.js)
- `proxy/exit-node-cache.js`  (only importer is `optimizations/implementation-examples.js`, which is
  itself loaded by nothing — see note)

> NOTE: after deleting `proxy/exit-node-cache.js`, `optimizations/implementation-examples.js:87` has a
> dangling `require('./exit-node-cache')`. Harmless — that examples file is never loaded at runtime
> (grep: nothing requires `implementation-examples`). Recommend deleting `optimizations/implementation-examples.js`
> too (dead), but it is out of this manifest's named scope — flagged, not scheduled.

### 1E. Dead recording/session files (NOT loaded — distinct from the loaded recording set in Section 2)
- `src/recording/event-logger.js`
- `src/recording/recorder.js`
- `src/recording/session-playback.js`
- `src/recording/streaming-recorder.js`
- `src/session/session-recorder.js`
- `src/session/session-manager.js`

> Verified non-test refs = none for all six. The LIVE video files
> (`src/recording/video-{encoder,storage,player}.js`) do NOT import any of these (checked their requires = empty).

### 1F. Mock "MCP" test (P6) — real MCP now lives in `mcp/server.py`
- `tests/unit/mcp-server.test.js`  (pure `jest.fn()` mocks; asserts naming conventions, not a server)
- `tests/archives/exploration-tests/haiku-mcp-integration.test.js`  (archived WS-client "MCP" test — never speaks JSON-RPC)
- `tests/archives/exploration-tests/mcp_integration_test.py`  (archived; not the real `mcp/verify_e2e.py`)
- `tests/archives/exploration-tests/production_validation_mcp.py`  (archived)

> Do **NOT** delete `mcp/server.py`, `mcp/verify_e2e.py`, `mcp/README.md`, `mcp/requirements.txt` — that
> is the real thin MCP (A4). Keep it.

### 1G. Companion tests for pruned code (test-hygiene — no boot/smoke/e2e impact)
These import modules deleted in 1A–1C and will error once those are gone. They do **not** affect
`start:headless`, `smoke:mvp`, or `verify_e2e.py`. Delete alongside their targets:
```
tests/evasion/                              (whole dir — all import src/evasion/* modules)
tests/p3-002-session-coherence-edge-cases.test.js
tests/phase3/session-coherence.test.js
tests/phase3/coherence-validators.test.js
tests/phase3/fingerprint-profiles.test.js
tests/features/session-coherence-validation.test.js
tests/performance/evasion-preload.test.js
tests/unit/evasion/fingerprint-validator.test.js
tests/real-world/validation-framework.js
tests/v12-9-0/evasion-handler.test.js       (tests the deleted src/v12-9-0/evasion-handler.js)
```
> CAUTION — two tests import a PRESERVE file (`canvas-fingerprinting-v2` / `webgl-detection-v2`):
> `tests/evasion/canvas-fingerprinting-v2.test.js` and `tests/integration/advanced-evasion-v2-integration.test.js`.
> If you MOVE the preserve trio (Section 3) instead of deleting, either move/repoint these two tests or
> delete them. `webgl-detection-v2.js` itself is being deleted (1B), so `advanced-evasion-v2-integration.test.js`
> must be deleted regardless.

---

## 2. NEEDS-UNREGISTER-FIRST — recording subsystem (loaded at runtime; do NOT blind-delete)

The roadmap (P3) wants recording pruned, but these files are **required and command-registered**.
Deleting any of them WITHOUT the edits below **breaks `npm run start:headless`**. If the prune agent is
NOT also editing `server.js`/`main.js`, treat this whole section as **DO-NOT-DELETE**.

**Files that are live-loaded (keep until edits land):**
```
recording/manager.js
recording/session-recorder.js
recording/replay.js
recording/interaction-recorder.js
src/recording/video-encoder.js
src/recording/video-storage.js
src/recording/video-player.js
```

**Exact unregister edits required BEFORE deleting the above (in this order):**

1. `src/main/main.js`
   - Remove requires: **line 65** (`recording/session-recorder`), **line 66** (`recording/replay`).
   - Remove instantiation: **lines 959–967** (`new SessionRecordingManager({...})`, `new ReplayEngine({...})`).
   - Remove from the `new WebSocketServer(...)` options object: `sessionRecordingManager` (**line 1096**),
     `replayEngine` (**line 1097**).
   - Remove cleanup blocks in `mainWindow.on('closed')`: `sessionRecordingManager` (**~1187–1190**),
     `replayEngine` (**~1191–1194**).
   - Remove the `let sessionRecordingManager = null;` / `let replayEngine = null;` declarations (**lines 579–580**).

2. `websocket/server.js`
   - Remove requires: **line 11** (`../recording/manager`), **line 24** (`../recording/session-recorder`),
     **line 25** (`../recording/replay`).
   - Remove `this.recordingManager = new RecordingManager(mainWindow);` (**line 1159**) and the
     `this.sessionRecordingManager = options.sessionRecordingManager || null;` (**line 1204**).
   - Remove the recording command handlers block (**~server.js:9356–9600**): the `start_recording`,
     `stop_recording`, `pause_recording`, `resume_recording`, recording status/list/load/delete/update/
     export/import/duplicate/addWait/addScreenshot/addComment handlers and `start_replay` (**line 9585**).
   - Remove `registerRecordingCommands` require+call (**lines 11739–11740**) and
     `registerVideoRecordingCommands` require+call (**lines 11745–11746**).

3. Only AFTER 1 and 2 boot clean, delete the 7 files above **plus** their now-orphaned command modules:
   `websocket/commands/recording-commands.js`, `websocket/commands/video-recording-commands.js`.

> Recommendation: because the browser advertises recording commands today (they register but throw when
> called), this surgery is worth doing — but as its **own** reviewed change, not folded into the blind
> pass. Until then: **DO-NOT-DELETE** these 7 files + 2 command modules.

---

## 3. PRESERVE (move to deferred research; do NOT delete)

Real page-patching logic a future evasion track (DEFER-D1) would reuse. Not loaded at runtime, so moving
them will not break boot — but do NOT delete. Recommend moving to `docs/research/bot-detection/salvage/`
(or a `research/evasion/` branch dir), preserving git history via `git mv`:
```
src/evasion/fingerprint-canvas-v2.js    -> keep  (file: src/evasion/canvas-fingerprinting-v2.js)
src/evasion/canvas-evasion.js           -> keep/move
src/evasion/webgl-evasion.js            -> keep/move
```
Also keep untouched (the ONLY live evasion that reaches pages — not a candidate, listed to prevent accidents):
- `evasion/fingerprint.js` (root) — **loaded** by `src/main/main.js:39`; served to the page via the
  `get-evasion-script` IPC. **DO-NOT-DELETE.**
- `evasion/fingerprint-profile.js`, `evasion/behavioral-ai.js` (root) — **loaded** by the registered
  `websocket/commands/evasion-commands.js`. **DO-NOT-DELETE.**
- The live navigator-property stub: `renderer/renderer.js` (`window.evasionHelpers.getWebviewEvasionScript()`,
  ~line 34) -> `src/preload/preload.js`. **DO-NOT-DELETE.**

---

## 4. DO-NOT-DELETE exceptions (candidates that turned out to be live / in-scope)

| Path | Why it must stay | Evidence |
| --- | --- | --- |
| `src/v12-9-0/forensic-analyzer.js` | Registered forensic commands (A5 landed) | required by `v12-9-0-integration-commands.js:12`, which is `require`d + `registerV12_9_0Commands()`-called at `server.js:11827/11831` |
| `src/v12-9-0/compression-engine.js` | Registered v12.9.0 compression (A8 wiring) | required by `v12-9-0-integration-commands.js:11` (same registered path) |
| `websocket/commands/v12-9-0-integration-commands.js` | The registered v12.9.0 dispatcher | `server.js:11827` |
| `websocket/commands/export-formats.js` | The LIVE export path (HAR/WARC) | in server.js explicit require list; keep (roadmap A3 fixes it) |
| `recording/{manager,session-recorder,replay,interaction-recorder}.js`, `src/recording/video-{encoder,storage,player}.js` | Loaded + command-registered | see Section 2 |
| `evasion/fingerprint.js`, `evasion/fingerprint-profile.js`, `evasion/behavioral-ai.js` | Live evasion injection + evasion commands | main.js:39; evasion-commands.js:22,30 |
| `mcp/server.py`, `mcp/verify_e2e.py` | The real thin MCP (A4) | 17 `@mcp.tool()`; boot-safety gate |
| `websocket/middleware/tls-enforcement.js` | Legitimate WS TLS (NOT evasion) | roadmap P1 explicit carve-out |

**Additional orphans OBSERVED but OUT OF THIS MANIFEST'S NAMED SCOPE (verify separately before removing):**
- `src/proxy/*` partner cluster (`partner-integration-manager.js`, `partner-selector.js`, `partner-failover.js`,
  `partners/*`, `ml-proxy-selector.js`, `geo-consistency-engine.js`, `provider-detector.js`, `proxy-analytics.js`,
  `proxy-intelligence.js`, `reputation-scorer.js`, `tor-circuit-manager.js`, `fallback-strategy.js`,
  `credential-sanitizer.js`, `parallel-proxy-tester.js`, `proxy-url-validator.js`, `partner-auth.js`) are imported
  only by `websocket/commands/proxy-partner-commands.js`, which is **NOT** in server.js's explicit require list
  (unregistered) — so the whole cluster is likely dead too. Left for a follow-up manifest; not scheduled here.
- `optimizations/implementation-examples.js` — dead (nothing loads it); see 1D note.

---

## 5. Deletion dependency order (blind-safe pass)

1. **1A** — the 4 unregistered evasion handler/command files (removes the only non-test importers of `src/evasion/*`).
2. **1B** — the 33 `src/evasion/*` files.
3. **1C** — v12.9.0 evasion + duplicate export orphans (4 files).
4. **1D** — proxy orphans (3 files).
5. **1E** — dead recording/session files (6 files).
6. **1F** — mock/archived "MCP" tests (4 files).
7. **1G** — companion tests (test-hygiene).
8. (Optional, separate reviewed change) **Section 2** — recording unregister surgery, THEN delete its 9 files.

No unregister edits are required for steps 1–7 (that is the definition of the blind-safe set). Step 8 is the
only one that requires `server.js`/`main.js` edits first.

---

## 6. Boot-safety checklist (run after EACH group, and mandatorily at the end)

The prune is safe only if all three still pass after deletion:

- [ ] **Boots:** `npm run start:headless` reaches "Server initialized on port 8765" with no
      `Cannot find module` / `require` errors (watch for stale requires of any deleted path).
- [ ] **MVP intact:** `npm run smoke:mvp` stays **14/14** (`scripts/smoke-mvp.js`).
- [ ] **MCP e2e intact:** `python3 mcp/verify_e2e.py` passes.

Regression guard specific to this manifest:
- [ ] `grep -rn "src/evasion/" websocket/ src/main/ renderer/ src/preload/` returns **nothing** after 1A/1B.
- [ ] `grep -rn "v12-9-0/evasion-handler\|features/export-handler" websocket/ src/` returns **nothing** after 1C.
- [ ] `grep -rn "residential-proxy-manager\|handlers/proxy-handler\|exit-node-cache" websocket/ src/main/ proxy/ src/proxy/` returns **nothing** loaded after 1D.
- [ ] If Section 2 was NOT executed: confirm `recording/` and `src/recording/video-*` files still exist (they must, to boot).

---

## 7. Counts (summary)

- **SAFE-TO-DELETE (blind), source/handler/test-mock files:** **48**
  = 4 (1A) + 33 (1B) + 4 (1C) + 3 (1D) + 6 (1E) + 4 (1F, incl. 2 archived `.py`) — *(1G companion tests are additional test-hygiene deletions, ~10 files + `tests/evasion/` dir, not counted in the 48)*.
- **Unregister edits required before ANY blind deletion:** **0** (the blind-safe set is already unregistered).
- **NEEDS-UNREGISTER-FIRST (recording):** **9 files**, gated behind ~6 edit sites in `main.js` + `server.js` (Section 2) — treat as DO-NOT-DELETE for a blind pass.
- **DO-NOT-DELETE exceptions (candidates that are actually live/in-scope):** **8** (Section 4 table) + PRESERVE trio + live root-evasion/navigator-stub/MCP.
