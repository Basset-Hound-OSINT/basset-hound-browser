---
title: Basset Hound Browser — Clarified Next Steps
status: AUTHORITATIVE PLAN
date: 2026-07-04
companion: PROJECT-STATUS-MATRIX.md
scope: docs/architecture/SCOPE.md — deterministic capture/control tool; NO internal agents, NO AI/ML models
goal: A genuinely usable headless capture/control browser + a thin agent (MCP) integration over ONLY proven commands
principle: Finish and PROVE a small in-scope core before building anything new. No new feature surface until the core is end-to-end verified.
---

# Clarified Next Steps

An honest, ordered, **finishable** path from "working core buried in inflated claims" to "a small, proven, agent-usable browser." Effort tags: **S** = <1 day, **M** = 1-3 days, **L** = ~1 week. Do them roughly in order; each builds on the prior.

---

## Step 0 — Freeze the narrative (S)
**What:** Adopt `PROJECT-STATUS-MATRIX.md` as the single source of truth and stop citing "v12.8.0 PRODUCTION COMPLETE / 100% / 164 commands / 85-90% evasion." Update `MEMORY.md` and README to the real numbers (~888 handler keys, proven core set, evasion unwired, MCP absent).
**Why:** Every downstream decision has been distorted by the inflated docs. Cheap, high-leverage.
**Area:** `MEMORY.md`, `README.md`, `docs/planning/OUTDATED-DOCS.md` (archive list).

## Step 1 — Land and PROVE the extract_* / cookie webview fixes (M)
**What:** Commit the in-flight webview-routing fix for all 8 `extract_*` handlers (working tree, uncommitted) and the `get_cookies` RFC-6265 fallback, then verify each returns non-empty against a live page over WS (a real Google/example.com run, not a unit test).
**Why:** These are the two known in-progress fixes. Until an end-to-end WS run proves non-empty extraction and correct URL-filtered cookies, they stay "developed-unproven." This is the difference between "core capture works" and "core capture demoable."
**Area:** `websocket/server.js:8380-8565` (getWebviewPageContent path), `cookies/manager.js:44-122`, renderer `get-page-content` handler (renderer.js:654). Add a captured green e2e log to the repo.

## Step 2 — Fix the shell-vs-webview bug class once (M→L)
**What:** The same defect recurs in **storage** (`execute-storage-operation` IPC has no renderer consumer — all storage ops hang 30s), **session-state capture** (reads shell webContents), and **network throttling** (CDP attached to shell). Wire the missing renderer consumer (preload.js:668 `onExecuteStorageOperation`) and retarget capture/throttle at the guest `<webview>`.
**Why:** One structural fix unblocks storage read/write, session persistence fidelity, and throttling at the same time. Highest structural ROI after Step 1.
**Area:** `renderer/renderer.js` (register storage-op consumer + partition swap), `preload.js:668`, `src/sessions/state-capture.js`, `network/throttling.js` init in `src/main/main.js:900`.

## Step 3 — Verify the remaining "developed-unproven" core & session commands (M)
**What:** Drive each Electron-only-but-wired command end-to-end over WS and record pass/fail: tab management, history-from-live-navigation, `get_downloads` with a real download, session create/switch (confirm actual isolation, not the current no-op), profile switch. Promote the ones that pass into the proven set; file bugs for the rest (e.g. session switch never swaps the webview partition — renderer has no `session-changed` listener).
**Why:** Converts guesswork into a trustworthy capability list an agent can rely on. Reveals which "wired" commands are actually no-ops.
**Area:** `tabs/`, `history/`, `downloads/`, `sessions/manager.js`, `profiles/manager.js`; add e2e WS test logs to `tests/`.

## Step 4 — Stand up a THIN MCP server over the proven commands only (M→L)
**What:** Build the browser's agent-facing MCP surface that **does not exist today**. A thin adapter (FastMCP or `@modelcontextprotocol`) that is a pure pass-through to the WS API, exposing ONLY proven-working control/capture tools: `navigate, get_url, get_content, get_page_state, execute_script, screenshot, scroll, wait_for_element, click, fill, type_text, set_cookie, get_all_cookies` — plus `extract_*`/`get_cookies` once Step 1 proves them.
**Why:** This is the actual agent-integration deliverable (palletai/Claude). All existing "MCP" docs are fiction; the WS API is the proven substrate an adapter wraps. Keeping it thin and pass-through respects SCOPE (no models/agents/intelligence in the browser).
**Area:** New `mcp/server.py` (or `browser_mcp/`), add the dependency to `package.json`/requirements, `@mcp.tool()` per proven command mapping 1:1 to a WS command. Do NOT port the ~46-tool fictional catalog — expose only what is green.
**Guardrail:** Every MCP tool must map to a command in the proven-working set of `PROJECT-STATUS-MATRIX.md`. No tool for an unproven/unwired command.

## Step 5 — Screenshot fidelity in headless (S→M)
**What:** Current headless screenshots come from `mainWindowDirect` (includes chrome); the offscreen frame pipeline renders 0 frames (paint set on the window whose content is a `<webview>`). Either fix offscreen capture to target the guest webContents, or document `mainWindowDirect` as the supported path and crop chrome deterministically.
**Why:** "Clean page screenshot" is a core capture promise; today it is caveated. Small, self-contained.
**Area:** `headless/manager.js:444-604`, screenshot handler `server.js:2975`.

## Step 6 — Wire OR delete the orphaned feature code (M) — decide per module
**What:** For each written-but-unregistered subsystem, make a call: (a) wire it and prove it, or (b) mark clearly as deferred and stop advertising it. Candidates: v12.9.0 compression/forensics/export (module-green, `registerV12_9_0Commands` never called), evidence-commands, collaboration API (also has real logic bugs — 11/85 failing), residential proxy handler (wrong message shape). Prefer wiring the two lowest-risk, in-scope, already-green ones (compression, forensic-analyzer library as a passive report tool) behind explicit commands; defer collaboration until its logic bugs are fixed.
**Why:** Orphaned code is the biggest source of doc inflation. Either it earns its place by being reachable+proven, or it stops being claimed.
**Area:** `websocket/commands/v12-9-0-integration-commands.js`, `collaboration-commands.js`, `evidence-commands.js`; register in `websocket/server.js` only after e2e proof.

## Step 7 — Fix the broken export path (S)
**What:** `export_format_har`/`export_format_warc` are wired (server.js:11560) but call `networkAnalysisManager.getLogs()` which does not exist (real method: `getRequests`). Fix the method name and prove a real HAR/WARC comes out of a live capture, or disable the commands until network capture is verified.
**Why:** These are currently guaranteed-broken registered commands — worse than absent. Quick correctness fix.
**Area:** `websocket/commands/export-formats.js`, `network-analysis/manager.js`.

---

## Deferred (explicitly OUT of the near-term path)

- **Evasion framework** — the ~37 `src/evasion/*` modules are dead code that patch no live API; the only page-reaching evasion is a partial, post-load navigator stub. Real bypass requires document-start/isolated-world injection (R6), UA Client Hints (R8), guest-webview UA override (R1), WebRTC policy (R3), and wire-level TLS/JA4 (R14) — a **research track**, not a checkbox. Do NOT claim evasion effectiveness until validated against a live detector. Keep as tracked research (`docs/research/bot-detection/BOT-DETECTION-GAP-ANALYSIS.md`).
- **CAPTCHA handling** — no solve path exists; interstitial HTML is returned as page content. Deferred research; at most add a `challenge_detected` typed status so agents can react, without a solver.
- **Anything on the SCOPE blacklist** — internal agents, AI/ML models, multi-agent orchestration (already removed), dark-web investigation. Do not re-introduce.
- **Proxy-pool / proxy-intelligence** — migrated to the separate `basset-hound-networking` package; not this repo's job.

## Definition of "genuinely usable" (the target)
1. Proven core capture/control commands, each with a captured e2e WS run in-repo.
2. `extract_*`, `get_cookies`, and storage working against a live page (Steps 1-2).
3. A thin MCP server an agent can point at, exposing only those proven commands (Step 4).
4. Honest docs: the status matrix is true, the inflated reports are archived (`OUTDATED-DOCS.md`).
5. Evasion/CAPTCHA labeled as research, not shipped capability.
