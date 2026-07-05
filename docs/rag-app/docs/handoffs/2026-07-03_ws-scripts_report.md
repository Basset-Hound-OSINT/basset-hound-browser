# WS-SCRIPTS Handoff Report — Helper scripts: port sourcing + post-commit hook

- **Instance**: py-dev@exudeai:rag-bootstrap:WS-SCRIPTS
- **Date**: 2026-07-03
- **Status**: complete
- **Partial-state note**: a prior rate-limit-killed attempt had already added the
  `env_port()` sourcing block to `scripts/health-check.sh` (lines 11-27) but had NOT
  replaced any of the port literals below it, had NOT touched `bootstrap.sh`, and had
  NOT created the hook. The block was reviewed (matches the plan port table exactly:
  10000/+10/+11/+13), kept as-is, and the remaining work completed idempotently.

## Files changed

### 1. `scripts/health-check.sh` (completed prior partial edit)
| Lines | Change |
|---|---|
| 11-27 | (pre-existing partial work, verified correct) `env_port()` helper + `RAG_PORT`/`RAG_PROMETHEUS_PORT`/`RAG_GRAFANA_PORT`/`RAG_ALERTMANAGER_PORT` sourced from `.env` -> exported env -> port-table defaults (10000/10010/10011/10013) |
| 88-93 | service-availability checks: `localhost:8100` -> `${RAG_PORT}`, `:9090` -> `${RAG_PROMETHEUS_PORT}`, `:3000` -> `${RAG_GRAFANA_PORT}`, `:9093` -> `${RAG_ALERTMANAGER_PORT}` |
| 163-165 | Prometheus targets queries: `:9090` -> `${RAG_PROMETHEUS_PORT}` (3 curls) |
| 182-188 | Alertmanager alerts queries: `:9093` -> `${RAG_ALERTMANAGER_PORT}` (3 curls) |

### 2. `scripts/bootstrap.sh`
| Lines | Change |
|---|---|
| 48-52 | dead `RAG_API_PORT` (default 8100) renamed to `RAG_PORT` (default 10000); `.env` grep hardened with `tail -n 1 | tr -d '[:space:]'` (safe under the script's `set -euo pipefail` — verified); `API_URL` now tracks `RAG_PORT` |

### 3. `scripts/post_commit_rag_ingest.py` (NEW, executable, stdlib-only)
Template LOCAL post-commit hook per sugg-F23 / rh §3.5:
- Module docstring documents copy-into-`.git/hooks/post-commit` + `chmod +x` usage.
- Config via env: `RAG_ENDPOINT_URL` (default `http://localhost:${RAG_PORT:-10000}`),
  `RAG_PORT`, `RAG_INGEST_PATHS` (colon-separated, default `docs`),
  `RAG_INGEST_TIMEOUT` (default 300s), `RAG_HOOK_QUIET`.
- Fires only when the commit touched files under a watched path
  (`git diff-tree --no-commit-id --name-only -r HEAD`).
- POSTs host-absolute dir to `POST /api/ingest/directory` (`{"path": ...}` — matches
  current `DirectoryIngestRequest` in `app/main.py:216`); documents the DOCS_PATH
  same-path ro mount requirement (design decision #4).
- Forward-compatible with WS-API async ingest: handles both list-of-docs and
  `{"job_id": ...}` response shapes.
- Never breaks the commit workflow: always exits 0; unreachable API = one warning.

## Acceptance-criteria evidence

| Criterion | Evidence |
|---|---|
| health-check.sh checks 10000-band ports sourced from .env, not literals | `grep -n "8100\|:9090\|:3000\|:9093" scripts/health-check.sh` -> NONE. All 12 endpoint URLs use `${RAG_*_PORT}` vars sourced by `env_port` (`.env` -> env -> table default). Sandbox test: synthetic `.env` with `RAG_PORT=10020`/`RAG_GRAFANA_PORT=10031` resolved 10020/10010/10031/10013 (overrides + defaults both correct). |
| bootstrap.sh health URL tracks RAG_PORT (10000), not dead RAG_API_PORT | `grep -n RAG_API_PORT scripts/bootstrap.sh` -> NONE. `API_URL="http://localhost:${RAG_PORT}"` (line 52); sandbox test under `set -o pipefail`: with `.env` -> 10020, without `.env` -> 10000. |
| post_commit_rag_ingest.py exists and documents copy-into-.git/hooks usage | File created, `chmod +x`, `python3 -m py_compile` OK. Docstring has explicit `cp ... .git/hooks/post-commit` + `chmod +x` block. Live test in scratch git repo: src-only commit -> "no watched paths changed", exit 0; docs commit with API down -> soft warning, exit 0; `RAG_INGEST_PATHS=src:docs` -> only touched dir attempted, exit 0. |
| (syntax) | `bash -n` OK for both shell scripts; `py_compile` OK for hook. |

## Deviations
None. All edits confined to the three zone files. No docker containers started, no
git commits, no out-of-zone edits needed.

## Deferred (per binding decision #5)
None of the large deferred items (symbol-aware chunking, setup wizard,
backup/restore, /stats dashboard) touch this workstream; the hook deliberately stays
a minimal stdlib template rather than growing symbol-aware/selective-reindex logic
(that belongs to the deferred symbol-chunking backlog item).
