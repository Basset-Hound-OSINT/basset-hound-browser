# Session Record — 2026-07-04 (cont.): forensic_capture command, GUI toggle, local RAG update, file-size directive

**Continuation of** [2026-07-04_MVP-COMPLETION-ORCHESTRATED.md](2026-07-04_MVP-COMPLETION-ORCHESTRATED.md). Same orchestrated-agent-teams mode. **All uncommitted** (operator: no commits yet).

## ✅ Done this phase
- **One-shot `forensic_capture` WS command (DONE, live-verified).** New `websocket/commands/forensic-capture-command.js` (+ 2 additive registration lines in `websocket/server.js`). One call: `start_network_capture` → navigate → captures raw HTML + HAR + screenshot + cookies + storage + page_state + technologies + links + images + forms + metadata, SHA-256-hashes each artifact, and auto-writes a **13-file evidence bundle + manifest + chain_of_custody** through a PathValidator (BASSET_ALLOWED_WRITE_DIRS gate). Detect-not-bypass: `challenge_suspected` flag (heuristic tightened so Google SERP's own `/sorry/` JS no longer false-flags). Verified on the operator's real `https://www.google.com/search?q=department+of+state+news`: 200 results page, 523 KB HTML, **71 HAR entries**, hash matched independent recompute. `npm run smoke:mvp` now **15/15**. Report: `docs/findings/FORENSIC-CAPTURE-COMMAND-2026-07-04.md`.
- **Super-simple Python client (DONE).** `tmp/real_world_test/capture_client.py` — **19 lines** — connects, sends one `forensic_capture`, prints bundle dir + file list. (Proves the operator's "under 20 lines" user-friendliness bar via a server-side command.)
- **Local docs-RAG updated to latest rag-bootstrap template (DONE).** `docs/rag-app/` pulled multi-KB support, MCP `kb` param, memory caps, watcher-default-off, postgres fix; redeployed our instance (`basset-hound-docs-rag`, `http://localhost:10021`, 768-dim). Re-ingest running in background (2035 docs & climbing → today's new docs get indexed). **Local instance ONLY** — exudeai canonical + all other RAG stacks untouched. Report: `docs/findings/RAG-LOCAL-UPDATE-2026-07-04.md`.
- **RAG multi-KB findings doc (DONE):** `docs/findings/RAG-BOOTSTRAP-MULTI-KB-FINDINGS-2026-07-04.md`. Devs: pull-by-PATH gets everything now; pull-by-GIT waits on maintainer's commit batch; updates are NOT automatic (one-command updater `./scripts/update_from_upstream.sh --apply && docker compose up -d`). Point devs at `~/exudeai/rag-bootstrap/docs/deployment/DEV_NOTE_2026-07-04.md`.
- **Planning:** `docs/planning/GUI-AND-SIMPLE-CAPTURE-PLAN.md` (design + work-zone partition that let the two feature teams run in parallel with zero conflict).
- **Scratch discipline:** agents now keep throwaway temp in `tmp/_scratch/` (inside the project), deliverables in `tmp/real_world_test/`.

## ✅ GUI COMPLETE (verified live after the save)
> UPDATE: the GUI agent finished. `--gui`/`BASSET_GUI=1` (or `npm run start:gui`) reveals the chrome; headless stays default (**smoke:mvp 15/15**, unit test **16/16**); no-display → warn + fallback (no crash). **Both operator layout pet-peeves fixed + verified (CDP geometry + screenshot):** webview now fills toolbar→status-bar with no dead space; tabs render horizontally (`#tabs-container` had no CSS → block/vertical; added `display:flex; flex-direction:row; overflow-x:auto`). Files: `main.js`, `config/cli.js`, `package.json`, `renderer/index.html`, `renderer/renderer.js`, new `renderer/gui-logic.js` + `tests/unit/gui-logic.test.js`. Report: `docs/findings/GUI-TOGGLE-2026-07-04.md`.
> ⚠️ DISCOVERY: `scripts/clean-test-artifacts.js` wipes `tmp/*` (it clobbered `tmp/_scratch` mid-run). Future agents should use a gitignored NON-`tmp/` scratch dir, OR exclude `tmp/_scratch` from that cleaner.

### (original mid-session note below — now RESOLVED)
- **Opt-in lightweight GUI (`--gui` / `BASSET_GUI=1`)** — the full browser chrome ALREADY exists in `renderer/`; it was only hidden by the headless override in `main.js`. The GUI team wired the visibility toggle (headless stays default; buildable with/without). **Two operator-reported layout bugs were routed to it and may or may not have landed before the session ended:**
  1. Webview doesn't fill the vertical space between toolbar and status bar (needs `flex:1` + `min-height:0` on the middle container).
  2. Tabs stack vertically instead of horizontally (tab strip needs `flex-direction:row`).
  → NEXT SESSION: verify `renderer/index.html`/`renderer.js`, confirm both fixes, and that `--gui` renders correctly on DISPLAY=:1 while `start:headless` stays 15/15. Report target: `docs/findings/GUI-TOGGLE-2026-07-04.md`.

## 🔴 New directive + biggest pending item: FILE-SIZE POLICE (>1200 lines)
Operator: **no code file may exceed 1200 lines** — police + modularize. 13 offenders found (deferred — blocked on machine load + file ownership):
`websocket/server.js` (12,096), `src/main/main.js` (3,104), `proxy/tor-advanced.js` (2,874), `technology/fingerprints.js` (1,929), `recording/interaction-recorder.js` (1,727), `extraction/manager.js` (1,555), `renderer/renderer.js` (1,499), `monitoring/page-monitor.js` (1,497), `config/schema.js` (1,482), `extraction/image-metadata-extractor.js` (1,475), `proxy/manager.js` (1,364), `evasion/fingerprint-profile.js` (1,278), `network-forensics/forensics.js` (1,270). (Plus one in `archives/` — ignore, it's archived.)
→ NEXT SESSION: PLAN module boundaries first (esp. server.js/main.js), then modularize in parallel waves with a **boot-safety gate** (`smoke:mvp` must stay 15/15 after each split), same discipline that made the 78-file prune safe. The 11 smaller files are independent (parallel-safe); `server.js` (free now) and `main.js` (was GUI-owned) need careful planned splits.

## Blockers / notes
- **Machine load was ~99% (15.85/16 cores)** — driven by other projects' `llama-server`/`uvicorn`/`java` + our own RAG re-ingest. Per the resource directive (pause spawning at 85-90%), the modularization wave was **held**. Load easing (13.85) as the ingest finishes.
- GUI agent may have been cut off mid-fix when the session ended — its partial work is on disk; resume/verify next session.
- Onboarding-diagnostics recommendation still open (in-server `run_self_test` via `registerCheck()` — see QA plan).

## Decisions
- File-size hard cap **1200 lines** (police + modularize; deferred to next session).
- **Every docs/ subfolder needs an INDEX.md** (coverage sweep pending).
- RAG updates are **local-instance-only** here; never touch exudeai canonical or sibling stacks.
- GUI is a **runtime visibility toggle**, not a separate build (chrome already exists).

## What's next (priority order)
1. Verify/finish the GUI (2 layout fixes + `--gui` render on :1; keep headless 15/15).
2. **Modularize the 13 >1200-line files** (plan → parallel boot-safety-gated waves).
3. Doc-INDEX coverage sweep across all `docs/` subfolders.
4. Confirm RAG re-ingest completed (docs count settles) + it stays healthy on 10021.
5. Sweep stale `/home/devel/bhb-*` scratch from 07-03 sessions.
6. Then the roadmap's deferred tier: evasion/CAPTCHA research, Collaboration API fix+wire, live proxy routing.
