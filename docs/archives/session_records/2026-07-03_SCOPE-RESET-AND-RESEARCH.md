# Session Record — 2026-07-03: Scope Reset, Research, Honest Baseline

**Theme:** Cut the project back to an honest, finishable scope and record grounded research. No hype.

---

## What was decided (operator direction)

1. **Endpoint = a WORKING core browser, ASAP**, to eventually drop into the **palletai** system. Stop polishing edges; finish the core.
2. **Scope blacklist (hard boundary)** — now in `docs/architecture/SCOPE.md`:
   - Browser MUST NOT create/spawn/orchestrate agents internally.
   - Browser MUST NOT integrate/call AI/ML models (no Claude/OpenAI/Ollama/LLM/embeddings/model SDKs in browser source).
   - The browser is a **deterministic capture/control tool**; intelligence lives in EXTERNAL agents driving it via MCP + WebSocket/HTTP.
3. **CAPTCHA/anti-detection = detect, don't bypass.** Detect challenges and report honestly ("can this be automated or not?"). Do NOT build a solve-everything engine (too heavy, losing race). Evasion effectiveness is **deferred research**, not part of the working-core endpoint.
4. **Future (post-core):** human-in-the-loop window (Electron already has the window — reveal on demand for CAPTCHA/MFA/manual review); tiered engine for lightweighting (light fetch/parse default + Chromium only when needed). **WASM does NOT lighten Electron** — it's only useful for specific deterministic compute; the real lever is not booting Chromium when unneeded.

## What was done

- **Feature 2 (Multi-Agent Orchestration) removed** — out of scope. Deleted `src/v12-9-0/agent-orchestrator.js` + 5 `agent-*.test.js`; stripped orchestration from `websocket/commands/v12-9-0-integration-commands.js` (compression + forensics kept); cleaned package.json / test-runner / CI / 2 mixed test files. Verified: zero `AgentOrchestrator` refs remain; v12.9.0 suite (compression + forensics) green.
- **Kept in scope:** `collaboration-api.js` (session locking / event streaming for external clients — a control surface, not an agent), `forensic-analyzer.js` (deterministic), compression.
- **Still-present known violations, DEFERRED** (operator chose "new v12.9.0 code only"): `src/agents/orchestrator.js`, `src/features/ai-analysis.js` (real Claude API integration).
- **Research corpora written** (source-verified, background workflows):
  - `docs/research/obscura/` — 20 docs reverse-engineering the Obscura Rust headless browser. Takeaway: it's the architectural *opposite* (layout-free, no paint, single V8 isolate) → complementary, not a replacement; confirms "continue custom build." Adopt its identity-coherence discipline + SSRF/DoS hardening; reject its single-isolate model.
  - `docs/research/bot-detection/` — 8 surface audits + `BOT-DETECTION-GAP-ANALYSIS.md`.
- **RAG app** (`docs/rag-app/`) set up but **PAUSED per operator** and currently **broken** (pgvector schema 384-dim vs Ollama nomic-embed-text 768-dim mismatch). Containers still running (operator's infra — untouched). Template-improvement notes at `~/exudeai/rag-bootstrap/RAG_BOOTSTRAP_ISSUES_AND_SUGGESTIONS.md`.

## Honest baseline (the un-hyped truth)

The "v12.8.0 PRODUCTION READY / 100% / 85–90% evasion" narrative is **inflated**. Verified this session:

- `src/main/main.js` (3056 lines) and `websocket/server.js` (11809 lines) are **still monolithic** — the claimed modularization did not happen.
- **No MCP server** exists at the documented `mcp/server.py` path (only copies in `tests/archives/` and `docs/rag-app/`). Agent-drivability via MCP is unverified/likely absent.
- The **evasion framework is largely a facade** — modules exist but aren't wired into the browsed page, do no wire-level work, or fire after the page already fingerprinted. Every "82–95% effective" figure is a hardcoded constant or a `Math.random()` simulator vs fake `.test` endpoints. See `BOT-DETECTION-GAP-ANALYSIS.md`.
- **Correctness bug (forensic integrity):** on a CAPTCHA/challenge, the browser silently returns the challenge HTML to the caller as the captured page (`websocket/server.js:2952-2959`). This is data corruption and should be a **P0 fix inside the working-core scope** (detect + report, don't pretend success).

## PENDING — pick up here next session

1. **Re-run the working-core-browser probe workflow** — it got 0 results (rate-limited at 2026-07-03 ~11:50pm reset). Resume:
   `Workflow({scriptPath: ".../workflows/scripts/path-to-working-core-browser-wf_5a570785-de8.js", resumeFromRunId: "wf_5a570785-de8"})`
   It probes actual runnable state (boot / WebSocket / MCP / headless / core commands / forensics) and writes `docs/planning/PATH-TO-WORKING-CORE-BROWSER.md` (definition of "working" + blocker-first P0/P1/P2 plan).
2. **Then:** lock the endpoint definition with the operator and execute P0 (boots headless → WebSocket connect → navigate/click/fill/extract → screenshot → forensic capture → MCP drivable → clean shutdown), plus the CAPTCHA-as-content P0 correctness fix.
3. **Deferred (post-core, modular add-ons):** CAPTCHA detection UX, human-in-loop window, tiered engine/WASM, evasion wiring (roadmap R1–R16 in the gap analysis), MCP server (locate/build/wire), pre-existing scope-violation cleanup (`src/agents/orchestrator.js`, `src/features/ai-analysis.js`), RAG dimension fix.

## Environment notes

- Claude's **tmp scratch filesystem is full** (blocks Bash output capture; project disk unaffected). Safe to clear Claude's own session logs; operator's Docker/RAG data must NOT be deleted without explicit OK.
- Session hit the model rate limit twice (resets 11:50pm America/New_York). Two workflows were cut off mid-run: bot-detection (16/17 done, all docs written) and working-core probe (0/7 — nothing written, needs re-run per above).
