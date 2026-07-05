# Path-Reference Integrity Findings — rag-bootstrap (post doc-move)

Concern: file-path references must keep working for downstream consumers after the
user relocated docs (root -> docs/) and test scripts (root -> tests/).

## What moved (from `git status`)
- Root -> `docs/`: INFRASTRUCTURE_DIAGNOSTICS, Integration_Testing_Results_2026_05_06,
  PHASE1-4_IMPLEMENTATION_SUMMARY, PHASE_5_1_EXECUTION_REPORT, PHASE_A_DELIVERABLES_2026_05_06,
  RAG_INTEGRATION_NOTES, RAG_PRODUCTION_API, SESSION_SUMMARY_2026_05_06.
- Root -> `tests/`: run_integration_tests.sh, test-streaming-and-watcher.sh.

## Current state (evidence)
- `deploy.sh` (canonical downstream entrypoint) is ROBUST: `SCRIPT_DIR="$(cd "$(dirname
  "${BASH_SOURCE[0]}")" && pwd)"; cd "$SCRIPT_DIR"` (deploy.sh:38-39), all paths anchored to
  `${SCRIPT_DIR}/...` (config.yaml:41, .env:42, docker-compose.yml:321, data/*:304-312).
- `docker-compose.yml` volumes are env-driven + relative-default: `${RAG_DOCS_VOLUME:-./data/docs}`
  (docker-compose.yml:152), `${RAG_CACHE_VOLUME:-./data/cache}` (:154), `${RAG_LOGS_VOLUME:-./data/logs}` (:156). GOOD.
- `docs/RESEARCHHUB_INTEGRATION_GUIDE.md` consumes over HTTP with env base URL
  (`RAG_BASE_URL=http://localhost:8000` :86). GOOD (network contract, not FS path).
- No markdown-link (`](...)`) references to any moved file exist repo-wide — the move broke no
  hyperlinks. Remaining references are bare-filename narrative or absolute-path mentions (below).

## Findings

### F1 (HIGH) tests/test-streaming-and-watcher.sh broken by relocation
- tests/test-streaming-and-watcher.sh:17 `SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"`
  now resolves to `.../rag-bootstrap/tests`, not repo root.
- :40-41 and :63-64 `cd "$SCRIPT_DIR"; docker compose up/down` -> runs in `tests/`, which has NO
  docker-compose.yml -> compose fails immediately.
- :231-232 `test_file="$SCRIPT_DIR/data/docs/..."; mkdir -p "$SCRIPT_DIR/data/docs"` and :266 archive
  check -> now `tests/data/docs`, but docker-compose mounts repo-root `./data/docs` (compose:152).
  Auto-ingest test drops files where the container never sees them -> test silently wrong.
- Fix: anchor to repo root, e.g. `REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"` (or
  `git rev-parse --show-toplevel`) and use it for compose + data paths.

### F2 (HIGH) tests/run_integration_tests.sh is CWD-relative, no anchoring
- No SCRIPT_DIR / cd at all. Relies on CWD == repo root:
  :111/:118 `docker-compose.multi-kb.yml`, :137 `.env`, :205 `app/main.py app/kb.py ...`,
  :12 `LOGDIR="./logs"`, :15 `RESULTS_FILE="Integration_Testing_Results_$(date +%Y%m%d).md"`.
- After the move into tests/, the natural invocation `cd tests && ./run_integration_tests.sh`
  breaks every one of those checks (all report "NOT FOUND"), and RESULTS_FILE/logs get written into
  tests/ — re-scattering the very artifact just consolidated into docs/.
- Fix: add `SCRIPT_DIR=...; cd "$SCRIPT_DIR/.."` (repo root) like deploy.sh, and write RESULTS_FILE
  under docs/ or ./logs explicitly.

### F3 (MEDIUM) Stale hardcoded container name conflicts with compose de-hardcoding
- tests/test-streaming-and-watcher.sh:70 `docker logs rag-bootstrap-api --tail 50`.
- docker-compose.yml:37-41 now intentionally OMITS container_name; containers are
  `<COMPOSE_PROJECT_NAME>-api-N` (.env.example documents this). The literal `rag-bootstrap-api`
  no longer exists for any instance that sets COMPOSE_PROJECT_NAME -> `docker logs` fails.
- Fix: resolve dynamically, e.g. `docker compose ps -q api` / `--filter label=...`.

### F4 (MEDIUM) Absolute/relative doc references still point at pre-move root locations
- docs/RAG_INTEGRATION_TESTING_GUIDE.md:691 `/home/devel/exudeai/rag-bootstrap/RAG_PRODUCTION_API.md`
  — file is now at docs/RAG_PRODUCTION_API.md; path is dead.
- docs/RAG_PRODUCTION_API.md:675 `./test-streaming-and-watcher.sh test` — script now in tests/;
  and doc itself now in docs/, so `./` is wrong from both angles.
- docs/PHASE_A_DELIVERABLES_2026_05_06.md:296-299, :353, :381 invoke `./test-streaming-and-watcher.sh`
  at repo root — now tests/test-streaming-and-watcher.sh.
- docs/PHASE_5_1_EXECUTION_REPORT.md:121,128,482,487 reference Integration_Testing_Results / 
  INFRASTRUCTURE_DIAGNOSTICS by bare root name (now co-located in docs/, so tolerable, but the
  intent/CWD is ambiguous).
- Fix: make cross-file references repo-root-relative (e.g. `tests/test-streaming-and-watcher.sh`,
  `docs/RAG_PRODUCTION_API.md`) rather than `./` or absolute `/home/devel/...`.

### F5 (MEDIUM) Testing guide points at a sample_docs dir that does not exist
- docs/RAG_INTEGRATION_TESTING_GUIDE.md:58 & :504 `./deploy.sh ingest ./tests/sample_docs`,
  :394 `/home/devel/exudeai/rag-bootstrap/tests/sample_docs/`.
- `tests/sample_docs/` does not exist (verified: no such dir). Downstream testers following the
  guide hit a missing path on step one.
- Fix: create the dir or correct the guide to an existing sample path.

### F6 (LOW) App config path resolution is CWD-relative, not repo/package-anchored
- app/config.py:60 `model_config = {"env_file": ".env", ...}` — loaded relative to CWD.
- app/config_manager.py:186 `self.config_path = Path(config_path or "config.yaml")` — CWD-relative.
- Works inside Docker (WORKDIR set) but brittle for any downstream that imports/runs the app from a
  different CWD. Recommend anchoring to package root (e.g. `Path(__file__).resolve().parent.parent`)
  and/or an env override (`RAG_CONFIG_FILE`, `RAG_ENV_FILE`). This is the concern's "make paths
  env-driven + repo-root-relative" recommendation applied to app code.

### F7 (LOW) config.yaml location vs. lookup mismatch (pre-existing, adjacent)
- Template lives at `config/config.yaml`; deploy.sh:41 expects `${SCRIPT_DIR}/config.yaml` (repo root)
  and config_manager defaults to `./config.yaml`. No root config.yaml exists. Not caused by the doc
  move, but reinforces F6: standardize on one env-driven, root-relative config location.

## Recommendation summary
Downstream-facing contracts that are network/env-driven (docker-compose volumes, deploy.sh,
RESEARCHHUB HTTP client) are healthy. The breakage is concentrated in the two relocated shell
scripts (F1-F3) and doc text that still cites pre-move paths (F4-F5). Standardize every script on the
deploy.sh SCRIPT_DIR-anchored pattern, make doc references repo-root-relative, and anchor app config
loading to package root with env overrides (F6-F7).
