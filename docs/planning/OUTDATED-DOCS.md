---
title: Basset Hound Browser — Outdated / False Doc Claims Registry
status: AUTHORITATIVE CORRECTION LIST
date: 2026-07-04
companion: PROJECT-STATUS-MATRIX.md
purpose: Enumerate specific doc files whose claims are false or stale, with the claim, the source, and the corrected reality — so they can be fixed or archived.
action: For each entry — either correct in place to match the status matrix, or move to docs/archive/ with a stale-claim banner. Do NOT leave these cited as current truth.
---

# Outdated / False Doc Claims Registry

Ordered by how misleading they are. **Tier 1** claims fabricate capabilities that do not exist (highest risk — an agent or operator will act on them and fail). **Tier 2** overstate unproven/partial work as complete. **Tier 3** are stale counts/minor inaccuracies.

---

## TIER 1 — Fabricated capabilities (fix/quarantine first)

### 1. MCP server exists with 40+/166 tools
- **Files:** `docs/findings/PHASE-15-17-MCP-EVASION-2026-01-08.md` (lines 44, 435); `docs/archive/experimentation/MCP-TESTING-COMPLETE-MASTER-REPORT-2026-05-06.md`; `docs/guides/integration_readiness.md` (+ `docs/integration_readiness.md`); `docs/findings/FINAL-SESSION-SUMMARY-2026-01-09.md`; `examples/integration/claude-mcp-examples.md`; `MEMORY.md`.
- **Claim:** "mcp/server.py — FastMCP server with 40+/700+ lines"; "MCP Tools: 166, Test Pass Rate 100%"; "browser_mcp/server.py 150+ lines, framework integrated"; setup via `python browser_mcp/server.py`; "MCP Server (FastMCP compatible) ✅ delivered."
- **Reality:** **No `mcp/server.py` or `browser_mcp/` exists anywhere** (find + git ls-files). The only FastMCP code is the unrelated RAG app (`docs/rag-app/app/mcp_server.py`, zero browser tools). Zero `browser_*` `@mcp.tool()` implementations; no fastmcp/@modelcontextprotocol dependency in package.json. The sibling report `mcp-testing-opus-4-7/findings.md` records "0/10 scenarios, No MCP tools available" — contradicting the 166-tool claim in its own folder.
- **Action:** Archive all MCP "complete" reports; correct MEMORY. The MCP server is a **planned Step 4**, not a deliverable.

### 2. Proxy Pool Manager + Proxy Intelligence + Dark Web investigation complete
- **Files:** `docs/findings/PHASE-24-SUMMARY-2026-01-09.md`; `docs/FEATURES-IMPLEMENTATION-2026-05-31.md`; `docs/features/PROXY-INTELLIGENCE.md`.
- **Claim:** "proxy/proxy-pool.js 890 LOC + 26 WS commands + mcp/server.py 13 tools, Production-Ready"; "register_proxy/get_best_proxy/find_hsdirs/monitor_marketplace COMPLETE, 215+ tests"; "set_proxy_rotation with 523 residential pool."
- **Reality:** `proxy/proxy-pool.js` and `websocket/commands/proxy-pool-commands.js` are **MISSING** (migrated to external `basset-hound-networking`). **0** of these handlers are registered in `websocket/server.js`. Dark-web investigation is **out-of-scope** per `docs/architecture/SCOPE.md`. Only single-proxy + simple list rotation + Tor ON/OFF/AUTO are real.
- **Action:** Archive PHASE-24; correct FEATURES-IMPLEMENTATION and PROXY-INTELLIGENCE to reflect single-proxy reality.

### 3. Evidence Packaging & Chain-of-Custody — 14 WS commands, Production Ready
- **Files:** `docs/archive/deprecated/EVIDENCE-PACKAGING-API-REFERENCE.md`; `docs/features/NEW-FEATURES-INDEX.md`; `docs/technical/EVIDENCE-PACKAGING-ARCHITECTURE.md`.
- **Claim:** "14 WS commands for forensic-grade evidence capture (evidence_capture_screenshot, evidence_capture_network_har...), 85 tests 100%, RFC 3161 timestamping/sealing/export, captures session traffic."
- **Reality:** Those command names **do not exist** in the server; `evidence-commands.js` is **never registered** (`registerEvidenceCommands` never called) and is **passive** (hashes client-supplied data, captures nothing live). Phase 29 chain-of-custody is explicitly **"REMOVED (out of scope)"** at `server.js:10727`.
- **Action:** Already partly under archive/deprecated; add a stale banner to NEW-FEATURES-INDEX and EVIDENCE-PACKAGING-ARCHITECTURE.

### 4. Evasion effectiveness 82%/90%/85-90% verified
- **Files:** `docs/research/evasion-canvas-webgl/README.md`; `docs/research/obscura/OBSCURA-EVASION-ANALYSIS.md`; `docs/findings/REALWORLD-TESTING-AUDIT-2026-06-15.md`; `docs/guides/IMPLEMENTATION-GUIDE.md`; `docs/releases/RELEASE-NOTES-v12.5.0.md`; `MEMORY.md` / DEPLOYMENT-COMPLETE summaries.
- **Claim:** "Canvas 82% / WebGL 90% verified in v12.0.0"; "webgl-fingerprinting-evasion.js 90% bypass"; "28 modules 12,521 lines all Complete"; "85-90% across all detection services"; "35 fingerprinting commands circumvent bot detection"; "Canvas v2 82→92% on FingerprintJS."
- **Reality:** ~37 `src/evasion/*` modules are **dead code** — reachable from **no** running-server path; they patch **no live API**. The cited `webgl-fingerprinting-evasion.js` **does not exist**. The only page-reaching evasion is a **partial, post-load navigator stub** (no canvas/WebGL/audio hooks). Percentages are hardcoded constants or Math.random simulators vs fake `.test` endpoints. Per `docs/research/bot-detection/BOT-DETECTION-GAP-ANALYSIS.md`, **treat as 0% until validated against a live detector.**
- **Action:** Prefix all evasion effectiveness docs with a "NOT LIVE-VALIDATED — see BOT-DETECTION-GAP-ANALYSIS.md" banner; move effectiveness numbers to a research-hypothesis section.

### 5. export_format_warc / capture_har_evidence produce real records
- **Files:** `docs/wiki/guides/V12.9.0-USER-GUIDES.md`; `docs/technical/EVIDENCE-PACKAGING-ARCHITECTURE.md`; `docs/findings/V12.8.0-FEATURE-4-FORENSICS-DETAILED-PLAN-2026-06-15.md`.
- **Claim:** "export_format_warc emits full WARC records (worked example)"; "capture_har_evidence captures all network requests during the session"; "Builds on NetworkForensicsCollector 1,267 LOC, 100+ tests."
- **Reality:** `export_format_har/warc` (registered server.js:11560) call `networkAnalysisManager.getLogs()` — **a method that does not exist** (real method: `getRequests`) → returns an error with a live manager, or a bare `WARC/1.0` header (0 records). `capture_har_evidence` takes caller-supplied `harData` (passive) and is unregistered. The wired path is `network-analysis/` (RequestTracker/SecurityAnalyzer), not "NetworkForensicsCollector."
- **Action:** Fix the getLogs bug (see CLARIFIED-NEXT-STEPS Step 7) or mark the export commands broken; correct the docs.

---

## TIER 2 — Overstated (unproven/partial claimed as done)

### 6. v12.8.0 PRODUCTION COMPLETE / 100% Test Validation / 116+ tests
- **Files:** `MEMORY.md`; `docs/findings/FINAL-VALIDATION-COMPREHENSIVE-REPORT.md`; `docs/archives/deployment-logs/CONTINUOUS-DEPLOYMENT-CYCLE-COMPLETE-2026-05-08.md`; `docs/archives/deployment-logs/DEPLOYMENT_VALIDATION_REPORT.md`.
- **Claim:** "100% Test Validation, 116+/116+ passing, production ready."
- **Reality:** Core-command integration tests **self-skip in CI** and need a live Electron+Playwright app; there is **no reproducible 100%/116-test green run** for core commands in-repo. Core commands ARE functionally working (ground truth), but the "100% validated" framing is unverifiable.
- **Action:** Replace with the honest proven-working core set from the status matrix.

### 7. v12.9.0 — 75/75 tests, 23 commands PRODUCTION READY, Orchestration complete
- **Files:** `docs/wiki/improvements/V12.9.0-VALIDATION.md`; `docs/wiki/improvements/COLLABORATION-API-IMPLEMENTATION.md`.
- **Claim:** "75/75 (100%), Feature 2 Multi-Agent Orchestration 25 tests PASSED, 23 commands PRODUCTION READY"; "Collaboration 85+ integration tests 100%."
- **Reality:** Orchestration was **REMOVED** for scope violation (code deleted). Real green suite = compression(25)+forensics(25) = 50 module tests only. **Collaboration fails 11/85 (v12-9-0) and 12/85 (integration)** — real logic bugs (conflict detection, priority queue order, lock expiry). **None** of the "23 commands" are registered (`registerV12_9_0Commands`/`registerCollaborationCommands` never called; server.js has 0 refs to `src/v12-9-0`).
- **Action:** Correct to "50 module tests green, collaboration buggy, 0 commands wired."

### 8. Extraction refactor complete / manager is orchestrator / 35+ tests passing
- **Files:** `docs/EXTRACTION-REFACTORING-P2-COMPLETION.md`; `docs/PHASE-14-ENHANCEMENTS`; `docs/HTML-CAPTURE-API.md`; `docs/API-REFERENCE-AUTHORITATIVE.md`.
- **Claim:** "manager.js is now an orchestrator, processors handle extraction; extract test suites 35+/74 passing"; "extract_links returns {data:{links,total}}."
- **Reality:** Only `extractAll()` delegates to cheerio processors; per-command `extractLinks/extractMetadata/...` still use **inline regex** in manager.js (line 436). Extraction unit tests **fail to load** under Node 18 (`ReferenceError: File is not defined`, cheerio/undici) — 0 tests run. `extract_links` actually returns `{internal,external,mailto,tel,anchor,javascript,other, all[], count}` — no `data.links`/`data.total`.
- **Action:** Correct the "authoritative" API schema and the refactor-complete claim; note Electron-only test runtime.

### 9. Session & storage fully functional / 8 persistence commands / 16 cookie commands
- **Files:** `docs/releases/v12.7.0-RELEASE-NOTES.md`; `docs/findings/PRODUCTION-READINESS-AUDIT-2026-06-14.md`; `docs/findings/PHASE-27-COOKIE-MANAGEMENT-2026-01-09.md`; `docs/research/competitor-analysis/kameleo/ARCHITECTURE-AND-FEATURES.md`.
- **Claim:** "8 session-persistence cmds (snapshot_session...) + 111 tests"; "5-layer coherence + clone_session/validate_session/get_session_state"; "16 cookie WS commands, 95%+ coverage COMPLETED"; "localStorage/sessionStorage/IndexedDB fully functional."
- **Reality:** The 8 named persistence commands are **not registered** (a different 6-command set exists, and it captures from the **shell** webContents, not the page). `clone_session/validate_session/get_session_state` and 5-layer coherence: **0 registered**. Cookie-jar tests are **RED** (jest infra), no e2e. **All storage read/write commands hang and time out** — the `execute-storage-operation` IPC has no renderer consumer.
- **Action:** Correct to the real 6-command set; mark storage subsystem broken; drop "COMPLETED/95%/fully functional."

### 10. Screenshot suite (12+ variants) / 20+ interaction commands
- **Files:** `docs/findings/PRODUCTION-READINESS-AUDIT-2026-06-14.md`.
- **Claim:** "screenshot_full_page, screenshot_element, get_screenshot_buffer, screenshot_annotate... / 20+ interaction commands."
- **Reality:** Only the base `screenshot` command is proven, and it is **headless-caveated** (falls back to full-window `mainWindow.capturePage`, includes chrome; offscreen renders 0 frames). The enumerated variants are unverified.
- **Action:** Reduce to the proven base command; caveat headless capture method.

---

## TIER 3 — Stale counts / minor

### 11. "164 WebSocket Commands"
- **Files:** `README.md`; `MEMORY.md`; `docs/architecture/core/FORENSIC-FEATURE-ARCHITECTURE-COMPREHENSIVE.md`.
- **Reality:** `websocket/server.js` alone assigns **493** `commandHandlers.<name>`; total across command modules is **~888 handler keys**. "164" is stale everywhere it appears.
- **Action:** Replace "164" with "~888 registered handler keys (small proven-working subset — see status matrix)."

### 12. Headless not supported / old main.js paths / offscreen works
- **Files:** `docs/guides/integration_readiness.md`; `docs/archives/fix-summaries/BUG_FIXES_APPLIED.md`; `docs/wiki/findings/MINIMAL-GUI-STRATEGY.md`; `docs/archives/deployment-logs/DEPLOYMENT_VALIDATION_REPORT.md`.
- **Claim:** "Electron not headless-compatible / requires GUI"; "fixes applied to /main.js lines 585/2700"; "164/164 headless 100% compat"; "screenshot_viewport works via offscreen"; "headless 12/12 production-ready."
- **Reality:** Browser **boots and drives headless** (verified live) — the "not compatible" claim is FALSE. Root `main.js` **does not exist** (real: `src/main/main.js`, early-headless init ~2794-2865). Command count stale (~888). `screenshot_viewport` works via `mainWindowDirect`, **not** offscreen (framesRendered stays 0). HeadlessManager unit suite is **66/72**, not 12/12.
- **Action:** Correct integration_readiness (it wrongly says both "not headless" AND "run browser_mcp/server.py"); fix stale main.js paths.

### 13. fill() sets value directly (minor)
- **File:** `docs/core/api-reference.md`.
- **Reality:** `fill` delegates the actual value-set to the renderer via `fill-field`; the `humanize` path runs timing (`humanType/humanDelay`) that is cosmetic and does not change the final set value. Command shapes in this doc are otherwise accurate.
- **Action:** Minor wording fix; low priority.

---

## Handling guidance
- **Archive vs correct:** Session-record and dated "completion/deployment" reports (Tier 1/2) should be **moved to `docs/archive/`** with a banner pointing to `PROJECT-STATUS-MATRIX.md` — they are historical artifacts, not current truth. Living references (README, MEMORY, api-reference, integration_readiness) should be **corrected in place**.
- **Never re-cite** an archived completion report as evidence of a capability. The only current-truth documents are `PROJECT-STATUS-MATRIX.md`, `CLARIFIED-NEXT-STEPS.md`, this file, and `docs/research/bot-detection/BOT-DETECTION-GAP-ANALYSIS.md` (for evasion).
