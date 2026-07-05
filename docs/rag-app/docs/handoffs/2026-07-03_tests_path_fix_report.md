# Tests Path Fix Report — 2026-07-03

**Agent**: py-dev@exudeai:rag-bootstrap:tests-paths
**Work zone**: `tests/run_integration_tests.sh`, `tests/test-streaming-and-watcher.sh` (only files edited)
**Trigger**: scripts moved from repo root into `tests/`; path anchoring broke (auditor findings F1, F2, F3 + port hardcoding).

## Changes

### tests/test-streaming-and-watcher.sh (F1, F3, port)
| Line(s) | Before | After | Finding |
|---|---|---|---|
| 12 | usage `./test-streaming-and-watcher.sh` | `./tests/test-streaming-and-watcher.sh` | doc accuracy |
| 18 | (none) | `REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"` | F1 |
| 20 | `API_URL="http://localhost:8100"` | `API_URL="http://localhost:${RAG_PORT:-8100}"` | port (var name from `.env.example`, default preserved) |
| 41 (`cmd_up`) | `cd "$SCRIPT_DIR"` | `cd "$REPO_ROOT"` | F1 — compose now runs where docker-compose.yml lives |
| 64 (`cmd_down`) | `cd "$SCRIPT_DIR"` | `cd "$REPO_ROOT"` | F1 |
| 70-72 (`cmd_logs`) | `docker logs rag-bootstrap-api --tail 50` | `cd "$REPO_ROOT"; docker compose logs --tail 50 api` | F3 — compose no longer sets `container_name`; service-name resolution matches the established idiom (`deploy.sh:438` `docker compose logs -f "$service"`, `scripts/health-check.sh:133` `docker-compose logs --tail=200 api`) and is COMPOSE_PROJECT_NAME-aware |
| 233-234 | `$SCRIPT_DIR/data/docs/...` (test file + mkdir) | `$REPO_ROOT/data/docs/...` | F1 — file now lands in the dir compose actually mounts (`${RAG_DOCS_VOLUME:-./data/docs}`) |
| 268 | `$SCRIPT_DIR/data/docs/archive/` | `$REPO_ROOT/data/docs/archive/` | F1 |

### tests/run_integration_tests.sh (F2)
| Line(s) | Before | After |
|---|---|---|
| 5-8 | (no anchoring; assumed CWD == repo root) | `SCRIPT_DIR=...; REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"; cd "$REPO_ROOT"` — deploy.sh pattern; all existing relative checks (`docker-compose.multi-kb.yml`, `.env`, `app/*.py`, logs) now resolve from repo root regardless of invocation CWD |
| 17 | `LOGDIR="./logs"` | `LOGDIR="$REPO_ROOT/logs"` |
| 20 | `RESULTS_FILE="Integration_Testing_Results_....md"` (repo root — would re-scatter the artifact just consolidated into docs/) | `RESULTS_FILE="$LOGDIR/Integration_Testing_Results_....md"` (script only echoes this path; anchored under logs/ so no root scatter) |

Not touched (out of scope / minimal-change policy): F4-F7 (doc references, app config CWD-relativity), unused `PROJECT_NAME` var, pre-existing glob-in-`[ -f ]` quirk at the archive check. No test expansion — scripts remain temporary-tier integration diagnostics.

## Verification (no docker started, no suites run)

1. **Syntax**: `bash -n` — both scripts PASS.
2. **Stale-pattern grep**: zero remaining `rag-bootstrap-api`, zero hardcoded `localhost:8000/8100`, `SCRIPT_DIR` used only in the two anchoring definition lines.
3. **Dry-run resolution** (anchoring expression evaluated in subshells with the invocation path standing in for `BASH_SOURCE[0]`):
   - from `tests/` as `./test-streaming-and-watcher.sh` → `REPO_ROOT=/home/devel/exudeai/rag-bootstrap`
   - from repo root as `tests/test-streaming-and-watcher.sh` → identical
   - from `/` via absolute path (`run_integration_tests.sh`) → identical
   - All resolved targets exist under REPO_ROOT: `docker-compose.yml`, `docker-compose.multi-kb.yml`, `deploy.sh`, `app/main.py`.
4. **Port default/override**: unset `RAG_PORT` → `http://localhost:8100`; `RAG_PORT=8250` → `http://localhost:8250`.
5. `data/` does not exist yet in the tree; the script's `mkdir -p "$REPO_ROOT/data/docs"` creates it at the same root compose mounts from, so the auto-ingest test and the container now see the same directory.

## Status
COMPLETE — both scripts location-correct, env-driven port, compose-native container resolution. No commits made (per policy).
