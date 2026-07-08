# CLAUDE.md — Basset Hound Browser

Electron-based **deterministic data-capture / control browser**, driven by external
agents over a WebSocket API (`127.0.0.1:8765`) + an 18-tool MCP server
(`mcp/server.py`). It is NOT an OSINT platform — intelligence lives in external
agents. Separate repos `~/basset-hound` (OSINT platform), `~/basset-mobile`,
`~/basset-verify` are DIFFERENT projects; don't touch them from here.

- **Run:** `npm run start:headless` (or `start:gui`). **Verify:** `npm run smoke:mvp` (15/15).
- **Authoritative status:** `docs/planning/PROJECT-STATUS-MATRIX.md`
- **Scope / boundaries:** `docs/architecture/SCOPE.md` · **Start here:** `docs/planning/NEXT-SESSION-PLAYBOOK.md` · **Roadmap:** `docs/roadmap/ROADMAP.md`
- **Docs RAG (query BEFORE manual doc research):** `http://localhost:10080` — see `docs/operations/DOCS-RAG.md`. It + all its data live OUTSIDE the repo on quickiespace; never in the repo.

## ⚠️ Workspace hygiene — keep scratch OUT of `~/` and the repo root
The `bhb-*` leak (see `docs/archives/session_records/2026-07-06_HOME-DIR-CLEANUP.md`)
happened because ad-hoc diagnostics ran with the shell CWD at `/home/devel` and
redirected output there. Prevent it:

- **NEVER write files to `~/`, `/home/devel/`, or the repo root.** All scratch,
  diagnostics, logs, and one-off output go to **`tmp/`** (gitignored) — or the
  session scratchpad.
- Running a one-off command? **`cd` into this repo first** and redirect into
  `tmp/` (e.g. `... > tmp/diag/boot.log`) — never `> ~/foo.txt` or a bare
  `> foo.txt` at the repo root. Prefix throwaway files clearly (e.g. `tmp/bhb-*`).
- Reusable scripts → `scripts/`. Real docs → the correct `docs/<area>/` folder
  (and add to that folder's `INDEX.md`). Full rule: `docs/DATA-ORGANIZATION-ENFORCEMENT.md`.

## Conventions
- No code file **>1200 lines** — modularize (barrel re-export / mixins).
- Every `docs/` subfolder needs an **`INDEX.md`**.
- **Tests are ephemeral** — the onboarding self-test absorbs them; no test-sprawl,
  no stray harness scripts left in the repo (put them in `tmp/` or `scripts/`).
- Don't spam commits or docs; keep scope/roadmap lean (brief entries + links to
  session records in `docs/archives/session_records/`).
