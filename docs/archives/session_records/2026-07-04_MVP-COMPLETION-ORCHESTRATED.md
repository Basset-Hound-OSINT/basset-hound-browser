# Session Record — 2026-07-04: MVP Completion via Orchestrated Agent Teams

**Status:** ✅ MVP COMPLETE, PROVEN, PRUNED — all uncommitted (operator: no commits yet)
**Mode:** Multi-agent orchestration (planning-first, work-zone-isolated teams; `/home/devel/palletai/claude_code_orchestra/`)
**One-line:** A browser that **did not boot** wrapped in **inflated docs** → a **stable, minimally-viable, honest forensic/automation browser**, verified end-to-end.

---

## Executive summary
Went from "does not boot at all" this morning to a working, verified browser: boots headless (`npm run start:headless`), drives over the WebSocket API and a **17-tool MCP server**, passes an end-to-end smoke suite (`npm run smoke:mvp` = **14/14**), is security-hardened, and has had **78 dead files pruned** so the claimed surface finally equals the real one. The docs RAG was also rebuilt and deployed (working).

## How to run / verify
```
npm run start:headless        # boots headless on 127.0.0.1:8765 (loopback default; BASSET_WS_BIND=0.0.0.0 to expose)
npm run smoke:mvp             # 14/14 GREEN across the working feature set
python3 mcp/verify_e2e.py     # proves agents can drive via the 17-tool MCP (exit 0)
```
WS protocol: flat JSON `{"command","id",...params}` (params top-level), auth off by design. Docs RAG: `http://localhost:10021` (see `docs/rag-app/USAGE-BASSET-HOUND.md`).

## What was done (by theme)
- **Boot + core drive:** fixed the env gotcha (`ELECTRON_RUN_AS_NODE`), ~7 broken require paths from incomplete modularization, a window-cleanup crash, and navigate reliability. Root-cause bug: a lossy response serializer (`_sendResponse`) dropped `id`+payload from EVERY reply → "everything hangs."
- **Shell-vs-webview bug class (highest ROI):** many commands read the empty shell (`mainWindow.webContents`) instead of the `<webview>` guest. Fixed once via `getWebviewPageContent()` — unblocked `extract_*`, storage, session capture, CDP throttling, `export_raw_html`, tech-detection.
- **Fixed commands (verified live):** extract_links/forms/images, get_cookies{url} (a forensic handler was overriding it), export_format_har/warc (`getLogs()` shaping), session save+restore (ReferenceError), identify_cms/analytics (category key typo).
- **MCP server (new, `mcp/server.py`):** thin FastMCP pass-through, **17 tools** 1:1 with proven WS commands, SCOPE-clean (no models/agents), verified end-to-end.
- **Forensic capture wired:** `registerV12_9_0Commands()` was never called → wired in; **14 commands** now reachable (8 forensic + 5 compression). SHA-256/chain-of-custody verified genuine (byte-for-byte).
- **Security hardened (CRITICAL + 4 HIGH closed):** default loopback bind, SSRF guard on navigate (blocks file/loopback/RFC1918/metadata + mapped-IPv6 bypass), PathValidator on file writes, error-formatter `id:null` envelope override. Open-on-loopback preserved (no forced auth).
- **Pruned 78 dead files:** all 33 `src/evasion/*` simulator modules (dir now empty; "82-90% evasion" numbers were fabricated), unregistered handlers, mock MCP tests, proxy/recording orphans. 3 real evasion scripts salvaged to `docs/research/bot-detection/salvage/`. Boot-safety gate (smoke 14/14 + mcp verify) held; 0 files restored.
- **Docs honesty:** 13 inflated top-level docs bannered → point at the status matrix.
- **RAG:** updated our `docs/rag-app/` copy from the overhauled template, deployed isolated instance on port 10021 (2014 docs / 17738 chunks, 768-dim), retrieval + QA + `ragq.py` client verified.
- **Research:** `docs/research/obscura/` (20 docs, source-verified reverse-engineering) and `docs/research/bot-detection/` (per-surface evasion gap analysis).

## Decisions made
- **Browser = deterministic capture/control tool. HARD BLACKLIST: no internal agents, no AI/ML models.** (`docs/architecture/SCOPE.md`) — removed v12.9.0 "Multi-Agent Orchestration" (Feature 2).
- **CAPTCHA = detect + report, not bypass.** Evasion effectiveness = **deferred research** (its dead modules were pruned).
- **Lightweighting lever = tiered engine, not WASM** (WASM can't shrink Electron).
- **Security: keep open-on-loopback** (SECURITY.md "open by design") — hardened exposure, did NOT flip auth-on-by-default.
- **Operating model:** planning-first orchestration; exclusive work-zones per agent (no two edit the same file); file-based handoffs to `docs/findings/` + `docs/handoffs/`; **no git commits**; no k8s/terraform.

## Discoveries / gotchas
- The response-serializer template bug was the single root cause behind both "get_content empty" and "navigate hangs."
- Docs were massively inflated: "production ready / 100% / 85-90% evasion" all false; server registers **~888 handler keys** (not "164"); `mcp/server.py` never existed until this session; recording subsystem is **live** (the roadmap wrongly flagged it dead — the prune manifest caught this).
- `pkill -f <pattern>` self-kills the shell if the pattern is in the command line — agents must reap by process group (`process.kill(-child.pid)`), never pkill-by-matching-pattern.
- Concurrent browser instances must use distinct WS ports to avoid 8765 collisions.

## Blockers / known-not-done (honest)
- **Evasion effectiveness ~0%** — deferred research (modules pruned).
- **Collaboration API broken** (~12/85 real logic-bug failures) — fix before wiring.
- **Live proxy routing** unverified.
- **`server.js` still monolithic** (~12k lines) — modularization never happened despite doc claims.
- Older docs/MEMORY partially inflated (13 bannered; more remain in archives/).

## What's next (per `docs/planning/FEATURE-COMPLETION-ROADMAP.md`)
1. Evasion / CAPTCHA as **deferred research** (document-start injection, UA-CH, WebRTC, TLS/JA4; `challenge_detected` status, no solver).
2. Fix + wire the **Collaboration API** (session locking / event streaming for external clients — in scope).
3. Verify **live proxy routing** end-to-end.
4. Optionally extend the MCP with the forensic/HAR/storage tools now working.
5. Longer term: refactor the `server.js` monolith; **palletai integration** of the browser via MCP.

## Key artifacts (authoritative, current)
- `docs/planning/PROJECT-STATUS-MATRIX.md` — the source of truth (what works vs not).
- `docs/planning/CLARIFIED-NEXT-STEPS.md`, `FEATURE-COMPLETION-ROADMAP.md`, `QA-VERIFICATION-PLAN.md`, `PRUNE-MANIFEST.md`.
- `docs/findings/` — per-team reports: SECURITY-AUDIT/HARDENING, BROKEN-COMMANDS-FIX, SHELL-VS-WEBVIEW-FIX, EXPORT-HAR-FIX, FORENSIC-REGISTRATION, PRUNE-EXECUTION, FINAL-CONSOLIDATION.
- `docs/handoffs/` — MCP-SERVER, MCP-EXTENSION, DOC-RECONCILIATION, SMOKE-RUNNER.
- `mcp/` (server + verify + README), `scripts/smoke-mvp.js`, `docs/rag-app/` (RAG), `docs/research/obscura|bot-detection/`.
