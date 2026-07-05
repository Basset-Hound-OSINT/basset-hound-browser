---
title: Basset Hound Browser — Feature-Completion & Pruning Roadmap
status: AUTHORITATIVE PLAN
date: 2026-07-04
companions: PROJECT-STATUS-MATRIX.md (ground truth), CLARIFIED-NEXT-STEPS.md (the MVP-core wave)
scope: docs/architecture/SCOPE.md — deterministic capture/control tool; NO internal agents, NO AI/ML models (HARD BLACKLIST)
operator_goal: "Working stable deployment with maximum features at minimum viability."
principle: Decide honestly what to COMPLETE vs CUT. Completing everything is not the goal — a small proven surface plus aggressive removal of dead/fictional code is.
method: Verdicts classified against source code + registration checks + live-boot facts from PROJECT-STATUS-MATRIX, not against status docs.
---

# Feature-Completion & Pruning Roadmap

## How to read this document

Three verdicts, applied to every significant **developed-unproven (?)**, **started-incomplete (◐)**, and **planned-not-built (○)** subsystem in `PROJECT-STATUS-MATRIX.md`:

- **WIRE-UP** — in-scope capture/control/forensic value, code mostly present, reachable to "working" with bounded effort. Ranked by **value ÷ effort**. Each has concrete work, files, and an effort tag (**S** = <1 day, **M** = 1–3 days, **L** = ~1 week).
- **PRUNE** — dead code to **remove, not complete**: dead evasion modules with fabricated numbers, unregistered handlers, duplicate/abandoned subsystems, out-of-scope orphans, and fictional doc claims.
- **DEFER** — legitimate later work / research. Per the operator: **evasion/bot-detection and CAPTCHA are DEFERRED research** (not WIRE-UP), as are the **human-in-loop GUI window** and **tiered-engine/WASM**.

**Relationship to `CLARIFIED-NEXT-STEPS.md`:** that document is the MVP-core proving wave (prove extract/cookies/storage, thin MCP, screenshots). This roadmap **incorporates and ranks those core items** alongside the **feature-completion decisions** (which orphaned subsystems earn a place, which get deleted). Items already specified there are tagged `[core, CLARIFIED Step N]`; genuinely new completion/pruning calls are tagged `[completion]` / `[prune]`.

**SCOPE guardrail (non-negotiable):** the HARD BLACKLIST — internal agents/orchestrators, task queues, AI/ML models, LLM/embedding calls — is **never** a WIRE-UP target. Multi-agent orchestration was already removed; `agent-orchestrator.js` is confirmed **gone from `src/v12-9-0/`** (good). Do not re-introduce.

---

## Executive summary — the honest complete-vs-cut call

The project is **one proven deterministic core wrapped in a large body of unwired, unproven, or fictional feature code.** "Maximum features at minimum viability" is therefore achieved mostly by **subtraction**: prove ~8 core capabilities, wire ~3 cheap in-scope extras, and **delete or park the rest** so the product's claimed surface equals its real surface.

- **Complete (WIRE-UP):** the extract/cookie/storage webview fixes, a thin MCP adapter over proven commands, the broken HAR/WARC export fix, the deterministic forensic-analyzer as a passive report tool, and screenshot fidelity. Everything else waits or dies.
- **Cut (PRUNE):** the ~36 `src/evasion/*` simulator-validated modules and their unregistered handlers (fabricated effectiveness), the unregistered v12.9.0 evasion handler, duplicate/stub recording subsystems, out-of-scope residential-proxy orphans, the duplicate `export-handler.js`, and the fictional 46-tool MCP catalog + mock "MCP" tests.
- **Defer (RESEARCH/LATER):** real evasion (document-start injection, UA-CH, WebRTC, TLS/JA4), CAPTCHA, the Collaboration API (in-scope but logic-buggy), the GUI/human-in-loop window, tiered-engine/WASM, and Docker-only offscreen/Xvfb.

---

## Part A — WIRE-UP (ranked by value ÷ effort)

> Ordered for execution. Top items are highest value ÷ effort **and** unblock the most downstream work. Effort in parentheses. Files are absolute-within-repo paths.

### A1. Land + PROVE the `extract_*` / `get_cookies` webview fix (M) — `[core, CLARIFIED Step 1]`
- **Value:** Highest. This is the line between "core capture works" and "core capture demoable." Extraction is the PRIMARY purpose per SCOPE.
- **Work:** Commit the in-flight webview-routing fix for all 8 `extract_*` handlers and the `get_cookies` RFC-6265 fallback; capture a green end-to-end WS run against a live page (real `example.com`/Google), non-empty results, into the repo as evidence.
- **Files:** `websocket/server.js:8380-8565` (getWebviewPageContent path), `cookies/manager.js:44-122`, `renderer/renderer.js:654` (`get-page-content` handler).
- **Why first:** Code is present and in-flight; only proof is missing. Unblocks the MCP surface (A4) and the honest capability list.

### A2. Fix the shell-vs-webview bug class once — storage + session-capture + throttle (M→L) — `[core, CLARIFIED Step 2]`
- **Value:** Very high, structural. One fix unblocks storage read/write, session-persistence fidelity, and network throttling simultaneously (all currently target the shell `mainWindow.webContents` or a dead IPC bridge).
- **Work:** Wire the missing renderer consumer for `execute-storage-operation` (partially started — a consumer now exists at `renderer/renderer.js:684-688`; verify it actually resolves the 30s-hang storage ops end-to-end), retarget session-state capture and CDP throttling at the guest `<webview>`, and register the renderer's partition-swap on `session-changed`.
- **Files:** `renderer/renderer.js` (storage-op consumer + partition swap), `preload.js:668`, `src/sessions/state-capture.js`, `network/throttling.js` init in `src/main/main.js:900`.
- **Note:** Session `switch` is currently a **no-op** (renderer never swaps partition) — fixing the same bridge fixes it.

### A3. Fix the broken `export_format_har` / `export_format_warc` (S) — `[completion]`
- **Value:** High per unit effort. These are **registered** (`websocket/server.js:11564`) but **guaranteed-broken** — worse than absent — because they call `networkAnalysisManager.getLogs()` at 8 sites; the real method is `getRequests()` (`network-analysis/manager.js:356`). HAR/WARC is core forensic capture per SCOPE §3.
- **Work:** Rename the 8 call sites `getLogs` → `getRequests` (verify the filter shape matches), then prove a real HAR/WARC emerges from a live capture. If live network capture can't be proven yet (shell-vs-webview risk), gate the commands behind a clear "unverified" flag rather than shipping a throwing command.
- **Files:** `websocket/commands/export-formats.js` (lines 76, 169, 243, 327, 465, 570, 579, 648), `network-analysis/manager.js:356`.

### A4. Thin MCP server over proven commands only (M→L) — `[core, CLARIFIED Step 4]`
- **Value:** Highest strategic value — this is the actual agent-integration deliverable (palletai/Claude), and it **does not exist today** (no `mcp/server.py` or `browser_mcp/`; find + git ls-files confirm). Depends on A1 for the extract tools.
- **Work:** A pure pass-through adapter (FastMCP or `@modelcontextprotocol`) exposing ONLY proven-working tools: `navigate, get_url, get_content, get_page_state, execute_script, screenshot, scroll, wait_for_element, click, fill, type_text, set_cookie, get_all_cookies` — plus `extract_*` / `get_cookies` once A1 proves them. One `@mcp.tool()` per WS command, 1:1. **Do NOT port the fictional 46-tool catalog** (see P6).
- **Files:** new `mcp/server.py` (or `browser_mcp/`), dependency added to `package.json`/requirements.
- **Guardrail:** every MCP tool must map to a command in the proven-working column of the matrix. No tool for an unproven/unwired command. No models/agents in the adapter (SCOPE blacklist).

### A5. Register the forensic-analyzer as passive forensic-report commands (S→M) — `[completion]`
- **Value:** Real in-scope forensic value (SHA-256 hashing, tamper detection, timeline, chain-of-custody, JSON/CSV/HTML reports — explicitly IN SCOPE per SCOPE §3, deterministic and model-free). The library is **smoke-tested green, pure/deterministic** (25/25) but unreachable: `registerV12_9_0Commands()` is **never called** from `websocket/server.js` (confirmed — the only reference is its own `module.exports`).
- **Work:** Register **only the forensic subset** of `v12-9-0-integration-commands.js` (hash/verify/timeline/chain-of-custody/report over caller-supplied capture data). Keep it passive (caller supplies the bytes; browser hashes/reports) — that respects SCOPE (no "evidence package / investigation" semantics, which Phase 29 removed). Prove one end-to-end WS round-trip. Do **not** register the evasion or collaboration handlers in the same file (see P2, DEFER-D3).
- **Files:** `src/v12-9-0/forensic-analyzer.js` (lib), `websocket/commands/v12-9-0-integration-commands.js`, register call in `websocket/server.js`.

### A6. Screenshot fidelity in headless (S→M) — `[core, CLARIFIED Step 5]`
- **Value:** Medium-high. "Clean page screenshot" is a core capture promise, today caveated: headless captures come from `mainWindowDirect` and include browser chrome; the offscreen pipeline renders **0 frames** (paint listener bound to the window whose content is a `<webview>`).
- **Work:** Either fix offscreen capture to target the guest webContents, **or** commit to `mainWindowDirect` as the supported path and deterministically crop chrome. Prefer the crop (smaller, self-contained); defer true offscreen (DEFER-D6).
- **Files:** `headless/manager.js:444-604`, screenshot handler `websocket/server.js:2975`.

### A7. Verify + promote the developed-unproven core/session commands (M) — `[core, CLARIFIED Step 3]`
- **Value:** Converts guesswork into a trustworthy capability list the MCP surface (A4) can rely on. Reveals which "wired" commands are no-ops.
- **Work:** Drive each Electron-only-but-wired command end-to-end over WS and record pass/fail: tab management, history-from-live-navigation, `get_downloads` with a real download, session create/switch (confirm actual isolation after A2), profile switch. Promote passers into the proven set; file bugs for the rest.
- **Files:** `tabs/`, `history/`, `downloads/`, `sessions/manager.js`, `profiles/manager.js`; add captured e2e WS logs to `tests/`.

### A8. Wire the adaptive compression engine into the live WS send path (M) — `[completion]`
- **Value:** Moderate (transport efficiency, not a capture capability). In-scope-adjacent, low risk; **module-green** (gzip/brotli/deflate, entropy selection, 25/25 feature + 7/7 integration) but "module-level only, not wired into the live server."
- **Work:** Wire `AdaptiveCompressionEngine` into the WS response path behind a config flag; prove ratio/latency on a large payload. Lowest-priority WIRE-UP — do only after A1–A7, and only if bandwidth is a real constraint. Note: **zstd is claimed but not implemented** (see P7) — do not advertise it.
- **Files:** `src/v12-9-0/compression-engine.js`, WS send path in `websocket/server.js`.

**WIRE-UP execution order:** A1 → A2 → A3 → A4 → A5 → A6 → A7 → A8. (A3 and A5 are cheap and can slot in parallel with A2/A4 by a second dev; A4 depends on A1.)

---

## Part B — PRUNE (delete, don't finish)

> These are the truthful "remove it" calls. Removing them is what makes the product honest and small. Each has concrete evidence.

### P1. The ~36 `src/evasion/*` simulator-validated modules + their unregistered handlers — **PRUNE (biggest)**
- **Evidence:** 36 modules on disk. **None are reachable from the running server.** The only 5 required by non-test code — `behavioral-simulator`, `session-coherence`, `coherence-validators`, `coherence-manager`, `device-fingerprinter` — are required **only** by files that are themselves **never registered** in `websocket/server.js`: `websocket/handlers/behavioral-simulator-handler.js`, `websocket/commands/coherence-check.js`, `websocket/commands/coherence-validation-commands.js`, `websocket/handlers/device-fingerprinter-handler.js` (grep for their register functions in `server.js` returns nothing). Advertised effectiveness ("Canvas 82% / WebGL 90% / 85-90% across services") is simulator/hardcoded, **not live-detector validated** (matrix §3). `multi-layer-coordinator.js` references module names as strings and wires nothing; `preloader.js` lists modules to preload but is itself never required.
- **Action:** **Delete** the simulator/coherence/validator/preloader scaffolding, the abstract `device-fingerprinter`/`behavioral-simulator` data producers, and the 4 unregistered handler/command files above. **Delete** the fabricated effectiveness numbers everywhere they appear.
- **Preserve (move, don't delete):** the 2–3 files that contain **real page-patching logic** a future evasion track would reuse — `fingerprint.js` (canvas/WebGL/audio script), `canvas-fingerprinting-v2.js`/`canvas-evasion.js`, `webgl-evasion.js` — into the deferred research branch (DEFER-D1). Keep the **only live evasion** untouched: the navigator-property stub (`renderer/renderer.js:34` → `preload.js:894`).
- **Also prune the TLS-evasion dead set:** `tls-version-evasion.js`, `tls-extension-ordering.js`, `tls-fingerprinting.js`, `tls-cipher-rotation.js` in `src/evasion/` "touch no socket" (matrix §3, R14) — delete or move to DEFER-D1. (Do **not** touch `websocket/middleware/tls-enforcement.js` — that is legitimate WS TLS.)

### P2. Unregistered v12.9.0 evasion handler — **PRUNE (or park in research)**
- **Evidence:** `src/v12-9-0/evasion-handler.js` (1245 lines) + `src/v12-9-0/evasion-websocket-commands.js` — grep confirms **neither is registered** in `server.js`. Evasion is DEFERRED research per the operator, so this is not a WIRE-UP.
- **Action:** Remove from the main tree (park in the DEFER-D1 research branch if any logic is salvageable). Delete its untracked test dir `tests/v12-9-0/evasion-handler.test.js` claims of "98/99 pass" from docs — passing tests on unwired code is not a shipped capability.

### P3. Duplicate / stub recording + replay subsystems — **PRUNE**
- **Evidence:** Three parallel, abandoned recording implementations exist: `recording/{interaction-recorder,replay,session-recorder}.js` (self-labeled stubs; server calls `getRecording`/`startReplay`/`listRecordings` that don't exist on them → **throw**), `src/recording/{recorder,streaming-recorder}.js`, and `src/session/session-recorder.js`, plus dead copies under `archives/test-artifacts-2026-06-20/recording/`. `recording/manager.js` "returns hardcoded success, records nothing" (matrix §4).
- **Action:** Recording is not MVP and every implementation is a stub. **Delete the stub set** and **unregister** the throwing commands (`start_replay`, recording start/stop) so the API doesn't advertise commands that error. If functional recording is wanted later, build **one** implementation deliberately (DEFER) — do not resurrect three.

### P4. Out-of-scope residential/proxy-pool orphans — **PRUNE**
- **Evidence:** `residential-proxy-manager.js` (13KB), `proxy-handler.js`, and `exit-node-cache.js` (3KB) are unregistered, use the wrong message shape `{command,payload}`, and are orphaned (matrix §6). SCOPE.md §"Networking Infrastructure" **explicitly** moves proxy pool / rotation / residential / geo selection to `basset-hound-networking` — "❌ NOT this browser's job."
- **Action:** **Delete.** Keep only what SCOPE allows and the matrix proves: single-proxy set/clear/status + the Tor master-switch (OFF/ON/AUTO). Purge doc claims of "Proxy Pool 890 LOC + 26 cmds / Proxy Intelligence 215+ tests" — the files are missing/migrated.

### P5. Duplicate `export-handler.js` (v12.9.0) — **PRUNE one path**
- **Evidence:** `src/v12-9-0/export-handler.js` passes 106/106 but is **not registered**; the server uses a **separate** `websocket/commands/export-formats.js` (the one fixed in A3). Two export implementations, one live.
- **Action:** Keep the registered `export-formats.js` path (fix it in A3), **delete** the orphaned `src/v12-9-0/export-handler.js`. One export path only.

### P6. Fictional MCP catalog + mock "MCP" tests — **PRUNE (replace with A4)**
- **Evidence:** The "~46 `browser_*` tool catalog / mcp/server.py 166 tools / 100% pass" is **documentation prose with no `@mcp.tool()` anywhere**; `tests/unit/mcp-server.test.js` is entirely `jest.fn()` mocks asserting naming conventions, not a real server; the "MCP integration" tests are plain WebSocket clients that never speak JSON-RPC (matrix §5).
- **Action:** **Delete** the fictional catalog docs and the mock "MCP" tests. Replace with the real thin MCP (A4) and real tests that speak MCP/JSON-RPC to it.

### P7. Fictional / planned-not-built claims to purge from docs (not code — claims) — **PRUNE the claims**
- **Evidence & action** (archive to `docs/planning/OUTDATED-DOCS.md`, per CLARIFIED Step 0):
  - `extraction/forensic-extractors/` "20+ extractors" — **directory does not exist** (matrix §2). Delete claim.
  - `zstd` compression — listed in headers/docs, **only gzip/brotli/deflate implemented** (matrix §7). Delete claim / don't advertise in A8.
  - Evidence packaging / sealing / RFC-3161 / court export (14-cmd API) — **Phase 29 "REMOVED (out of scope)"** (`server.js:10727`); confirmed out-of-scope (SCOPE §Investigation Management). Keep removed; delete claims.
  - "164 WebSocket commands / v12.8.0 100% / 85-90% evasion / MCP 164 tools" — stale/false (real ~888 handler keys, evasion ~0% live, no MCP). Update `MEMORY.md` + `README.md`.

---

## Part C — DEFER (research / later work)

> Legitimate, but not part of "maximum features at minimum viability." Do not advertise as shipped.

### D1. Evasion framework (real bypass) — **DEFERRED RESEARCH** (operator directive)
Real evasion is a research track, not a checkbox: document-start / isolated-world injection (R6), UA Client Hints spoofing `userAgentData`/`Sec-CH-UA` (R8, the highest-confidence 2026 leak), guest-`<webview>` UA override (R1 — shell UA is set, guest leaks `Electron/39` on first request), WebRTC IP-handling policy (R3 — real IP leaks past proxy), and wire-level TLS/JA4/JA4H control (R14). Park the salvaged real scripts from P1 here (`fingerprint.js`, canvas/webgl patch bodies). **Do not claim any effectiveness until validated against a live detector.** Ref `docs/research/bot-detection/BOT-DETECTION-GAP-ANALYSIS.md`. In-scope per SCOPE §4 (evasion "to access content") but unbuilt.

### D2. CAPTCHA handling — **DEFERRED RESEARCH**
No solve path exists; interstitial HTML is returned as page content. Deferred. At most, add a `challenge_detected` **typed status** so agents can react — **no solver** (a solver would drift toward intelligence/ML, near the SCOPE line).

### D3. Real-Time Collaboration API — **DEFER (in-scope, but fix bugs first)**
Explicitly IN SCOPE per SCOPE §0 ("session locking and event streaming that coordinate concurrent **EXTERNAL** clients"). But it is **BROKEN**: 11–12/85 tests fail on **real logic bugs** (conflict detection, priority-queue ordering, lock expiry) and it is unwired (`registerCollaborationCommands` never called — confirmed). **Strongest defer-to-wire candidate.** When picked up: fix the 3 logic-bug classes, then register + prove. Files: `src/v12-9-0/collaboration-api.js`, `websocket/commands/collaboration-commands.js`. Do not wire it while the logic bugs stand.

### D4. Human-in-loop GUI window — **DEFERRED** (operator directive)
Design-only today (`docs/wiki/findings/MINIMAL-GUI-STRATEGY*.md`). Related: GUI-vs-headless mode selection (`BASSET_MODE`/`windowFactory`, not implemented, v13 target). Defer.

### D5. Tiered-engine / WASM — **DEFERRED** (operator directive)
Research/design only (`docs/wiki/findings/OBSCURA-TECHNICAL-ANALYSIS.md`, `docs/masking/*`). Defer.

### D6. Offscreen-rendering frame pipeline (0 frames) — **DEFER**
If A6 commits to `mainWindowDirect` + crop, defer the true offscreen fix; it matters mainly for Docker/Xvfb where there is no real display. `framesRendered` stays 0 because paint is bound to the wrong window.

### D7. Xvfb virtual-display path — **DEFER (Docker packaging)**
Not exercised (host has real `DISPLAY=:1`); 4 unit tests FAIL; only matters in Docker. Fold into the eventual Docker-packaging task.

### D8. `tor-advanced.js` daemon spawn / NEWNYM (2874 lines) — **DEFER live-verification**
Keep the **proven** Tor master-switch + connect-to-existing-daemon path. The daemon spawn / control-port / NEWNYM code is "partly wired, no live evidence it launches+routes." Defer until a live Tor test rig exists; in-scope (SCOPE §7) but unproven — don't claim it works.

### D9. `src/sessions/` advanced modules (~14: recovery, compression, sandbox, offline-queue) — **DEFER**
Only state-capture/restore is MVP-relevant (fixed in A2). The rest is scaffolding. Don't build now; don't claim "70-90% session compression" (unrealized — the storage bridge was dead).

### D10. Web admin dashboard, GUI deprecation / legacy distribution (v14) — **DEFER**
Roadmap prose only; no code. Defer.

---

## Part D — Per-subsystem verdict index (from PROJECT-STATUS-MATRIX)

| Subsystem | Verdict(s) |
| --- | --- |
| browser-core-commands | **WIRE-UP** extract_* fix (A1); rest proven — keep |
| extraction-commands | **WIRE-UP** A1; **PRUNE** `forensic-extractors/` claim (P7); `extract_text`/`extract_tables` = build-if-cheap or drop claim |
| evasion-framework | **PRUNE** ~36 dead modules + unregistered handlers (P1); **DEFER** real bypass (D1); keep live navigator stub |
| forensic-capture | **WIRE-UP** forensic-analyzer (A5) + export fix (A3); **PRUNE** recording/replay stubs (P3), evidence-packaging claims (P7) |
| mcp-server | **WIRE-UP** thin MCP (A4); **PRUNE** fictional catalog + mock tests (P6) |
| proxy-tor-network | keep single-proxy + Tor master-switch; **PRUNE** residential/exit-node orphans (P4); **DEFER** tor-advanced daemon spawn (D8) |
| v12.9.0-features | **WIRE-UP** compression (A8) + forensic (A5); **PRUNE** duplicate export-handler (P5) + evasion-handler (P2); **DEFER** collaboration (D3) |
| session-profile-cookie-storage | **WIRE-UP** storage bridge (A2) + get_cookies (A1) + verify (A7); **DEFER** advanced src/sessions modules (D9) |
| headless-and-launch | **WIRE-UP** screenshot fidelity (A6); **DEFER** offscreen pipeline (D6), Xvfb (D7), GUI mode select / dashboard (D4/D10) |

---

## Definition of done for this roadmap's wave

1. WIRE-UP A1–A7 each have a **captured green e2e WS run** in-repo (A8 optional).
2. Every PRUNE item (P1–P6) is **deleted from the tree**; P7 claims are **archived** to `OUTDATED-DOCS.md`.
3. The MCP surface exposes **only** proven commands; no tool maps to an unproven/unwired command.
4. No SCOPE-blacklist code re-enters the tree (agents/orchestrators/AI-ML). Evasion, CAPTCHA, collaboration, GUI, WASM are labeled **research/deferred**, not shipped.
5. Claimed feature surface == real feature surface. That is "minimum viability with maximum (honest) features."
