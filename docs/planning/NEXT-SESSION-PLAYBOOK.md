---
title: Basset Hound Browser — Next-Session Playbook (START HERE)
status: AUTHORITATIVE ENTRY POINT
date: 2026-07-04
purpose: Single launchpad so any new session (or an external app driving Claude agents) can resume this project without re-deriving context.
authoritative_status: docs/planning/PROJECT-STATUS-MATRIX.md
scope: docs/architecture/SCOPE.md — deterministic capture/control tool; NO internal agents, NO AI/ML models, evasion = detect-not-bypass (deferred research)
---

# Next-Session Playbook — START HERE

> Read this first, then verify (3 commands), then pick up the phased roadmap.
> Everything below is **UNCOMMITTED** in the working tree (operator policy: no commits).

## 1. Current state in 5 lines

1. The browser **boots and drives** both headless (`npm run start:headless`) and GUI (`DISPLAY=:1`); WS API on `ws://127.0.0.1:8765`, flat JSON `{command,id,...params}`.
2. **Proven core (~70 commands):** navigate / get_url / get_content / page_state / execute_script / screenshot / scroll / wait / click / fill / type / extract_links|images|forms / detect_technologies / cookies (URL-scoped) / local+session storage round-trip / save+restore session-state / export_raw_html — all driving a live `<webview>`.
3. **Differentiators proven live** (not mocks): **Tor + proxy anonymity** (real IP → Tor exit → back; a dead proxy *breaks* connectivity instead of leaking = real routing), **coherent-identity / UA-leak fix** (clean `Chrome/120` on JS + wire, no `Electron`/`basset` tokens, platform coherent), and one-call **`forensic_capture`** (13-file bundle, per-file + `bundle_sha256` SHA-256 seal, chain-of-custody, challenge **detection** not bypass).
4. **18-tool MCP adapter** (`mcp/server.py`, FastMCP 2.1.2) over proven commands incl. `forensic_capture`; live-verified end-to-end. Control surface **security-hardened** (loopback bind, SSRF guard, PathValidator).
5. **Codebase modularized** — every live source file <1200 lines (`server.js` 12,096→1,110; `main.js` 3,112→1,178; `renderer.js` 1,527→587); 78 dead files pruned; docs made honest. Reproducible gates: `smoke:mvp` **15/15**, `mcp/verify_e2e.py` **exit 0**.

## 2. Resume / verify in 3 commands

```bash
npm run start:headless          # boots headless; WS up in ~3s (boot.log confirms init)
npm run smoke:mvp               # self-boots isolated headless browser → expect 15/15 PASS, exit 0
python3 mcp/verify_e2e.py       # full FastMCP dispatch path vs live browser → expect exit 0
```

- `smoke:mvp` and `verify_e2e.py` self-boot on isolated ephemeral/distinct ports, use throwaway `--user-data-dir`, and reap their own process group — safe to run repeatedly, no strays.
- **Before any manual doc research, query the docs RAG** at `http://localhost:10021` (one `/api/search` or `/api/ask` beats grepping `docs/`). Usage + CLI client: `docs/rag-app/USAGE-BASSET-HOUND.md`. Fall back to grep+Read only if RAG is unreachable.
- Prefer the two live harnesses over any doc-quoted "100% tests" number — most Jest suites self-skip in CI or fail to load under Node 18 (`File is not defined`).

## 3. The phased roadmap (one line each)

Full detail: `docs/archives/session_records/2026-07-04_MODULARIZATION-AND-DIFFERENTIATORS.md` §5 (KEY DISCOVERY) + §6 (THE PLAN). Priority ranking of what to complete vs cut: `docs/planning/FEATURE-COMPLETION-ROADMAP.md`.

- **Phase 1 — Command-surface verification & repair (NEXT BIG EFFORT).** ~904 commands are registered but only ~70 proven; the middle is un-audited and several were silently broken until fixed this session. Inventory all registered commands → auto-test each vs a live browser → classify works/broken/stub/dead → fix broken, delete/flag dead. *Plan doc to author: `docs/planning/PHASE-1-COMMAND-VERIFICATION-PLAN.md` (not yet written — source it from the session record §5–§6).*
- **Phase 2 — Onboarding self-test.** A `run_self_test` command/harness a consumer calls once to confirm the browser + its working tool set are healthy. (Absorbs the ephemeral smoke/verify scripts — no test-sprawl.)
- **Phase 3 — Wire-capture / evasion timing.** HAR response bodies; move evasion injection to run *before* page scripts (webview preload, not `did-stop-loading` — currently "fires too late"); normalize passive fingerprint surfaces. Ref `docs/research/bot-detection/BOT-DETECTION-GAP-ANALYSIS.md`.
- **Phase 4 — palletai MCP integration.** Wire the 18-tool MCP adapter into palletai agents as the real consumer. Ref `mcp/README.md`; point Claude Desktop/palletai at `python3 mcp/server.py` (env `BASSET_WS_HOST`/`BASSET_WS_PORT`).
- **Deferred (explicit):** Collaboration API (in-scope but ~11/85 tests fail on real logic bugs → fix then wire, `D3` in roadmap); dynamic `.onion` routing (needs `TOR_MODE=1` at launch); real evasion/CAPTCHA (research track, `D1`/`D2`); offscreen 0-frame pipeline; Xvfb/Docker packaging.

## 4. Operating principles (from the operator)

- **Plan first, don't improvise** — write/point-to a plan doc before large work; classify honestly what to COMPLETE vs CUT (max features at *minimum viability*, achieved mostly by subtraction).
- **Work-zone-isolated agents** — each agent edits only its declared work zone, read-only elsewhere; use handoff files. No two agents write the same file.
- **No git commits without an explicit ask.** Never run k8s/terraform or destructive infra/Docker/data actions without explicit OK (the docs-RAG containers on this host are running — do NOT delete them).
- **Resource-check before spawning agents, and stagger/stagger-start** them to keep the main thread lean; spawn background workflows for heavy lifts.
- **Leverage the orchestra** — multi-agent system config at `/home/devel/palletai/claude_code_orchestra/CONTEXT_FOR_NEW_CONVERSATIONS.md` (read its listed docs in order; agents defined in `/home/devel/.claude/settings.json`).
- **Tests are ephemeral** — the Phase-2 self-test absorbs proving harnesses; do not accumulate test-sprawl. Trust the two live gates over stale green counts.
- **Keep every `docs/` folder INDEX'd** — update the folder `INDEX.md` when you add docs (`docs/planning/INDEX.md`, `docs/findings/INDEX.md`).
- **Query the docs RAG before manual research** (see §2). Respect SCOPE: no in-process agents/LLMs/models in the browser; challenge = detect-not-bypass.

## 5. Authoritative pointers

| What | Where |
|------|-------|
| **Ground truth of what works** | `docs/planning/PROJECT-STATUS-MATRIX.md` |
| **Complete-vs-cut roadmap (ranked)** | `docs/planning/FEATURE-COMPLETION-ROADMAP.md` |
| **This session's full record + THE PLAN** | `docs/archives/session_records/2026-07-04_MODULARIZATION-AND-DIFFERENTIATORS.md` (+ `2026-07-04_MVP-COMPLETION-ORCHESTRATED.md`, `2026-07-04_CAPTURE-CMD-GUI-RAG-AND-FILE-SIZE.md`) |
| **Why we're not a Selenium clone** | `docs/planning/DIFFERENTIATION-VS-SELENIUM-2026-07-04.md` |
| **Findings (per-fix detail, 2026-07-04)** | `docs/findings/INDEX.md` → `docs/findings/*-2026-07-04.md` |
| **Planning index** | `docs/planning/INDEX.md` |
| **Scope / hard blacklist** | `docs/architecture/SCOPE.md` |
| **Command registry** (Phase-1 target) | dispatcher + `register*` calls in `websocket/server.js` (1,110 ln); handler modules in `websocket/commands/*.js` (incl. `core-cmds-01..11.js`, `core-tor-commands.js`); shared-scope barrel `websocket/core/handler-deps.js` |
| **MCP adapter** | `mcp/server.py` (18 tools), `mcp/verify_e2e.py`, `mcp/README.md`, `mcp/requirements.txt` |
| **Docs RAG** | `http://localhost:10021` · usage `docs/rag-app/USAGE-BASSET-HOUND.md` · client `docs/rag-app/client/ragq.py` |
| **Orchestra system** | `/home/devel/palletai/claude_code_orchestra/CONTEXT_FOR_NEW_CONVERSATIONS.md` |
| **Deferred evasion research** | `docs/research/bot-detection/BOT-DETECTION-GAP-ANALYSIS.md` (+ salvage refs in `docs/research/bot-detection/salvage/`) |

> **Trust order:** this playbook → status matrix → 2026-07-04 session records → findings. Distrust any older "v12.8.0 production ready / 100% / 85-90% evasion / 164 commands / MCP 164 tools" narrative — those are retired/inflated.
