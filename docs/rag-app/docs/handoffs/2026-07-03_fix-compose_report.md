# FIX-COMPOSE Report — 2026-07-03

Agent: py-dev@exudeai:rag-bootstrap:FIX-COMPOSE
Status: COMPLETE

## Scope

Verifier finding F1 (HIGH) + trivia + future-pass compose items across
docker-compose.yml, docker-compose.monitoring.yml, docker-compose.multi-kb.yml,
.env.example, .env.

## Changes

### 1. F1 (HIGH) — api env passthrough (docker-compose.yml)

Env var names verified against source BEFORE wiring:

- `app/main.py` `_check_ingest_root()` reads `os.environ.get("RAG_INGEST_ROOT_GUARD", "on")`
  and `os.environ.get("DOCS_PATH", "")` — guard active only when DOCS_PATH is set;
  off-values: off/0/false/no/disabled.
- `app/watcher.py` `DocumentWatcher.__init__` reads `os.getenv("WATCHER_ARCHIVE_MODE")`,
  default "off", modes off|copy|move.

Added to the `api` service environment block (with comments explaining container-env
semantics):

```yaml
WATCHER_ARCHIVE_MODE: ${WATCHER_ARCHIVE_MODE:-off}
DOCS_PATH: ${DOCS_PATH:-}
RAG_INGEST_ROOT_GUARD: ${RAG_INGEST_ROOT_GUARD:-on}
```

Before this fix the ingest-root guard was dead in Docker (DOCS_PATH never reached
the container env) and archive mode could not be enabled.

### 2. Knob documentation — .env.example + .env merge

- `.env.example`: added commented defaults + one-line explanations for
  `RAG_INGEST_ROOT_GUARD` and `WATCHER_ARCHIVE_MODE` in the "Document mounts"
  section, directly next to the existing `DOCS_PATH` documentation (note: the file
  had no pre-existing WATCHER_* entries, so the DOCS_PATH block was the natural
  neighborhood).
- `.env`: verified all three keys ABSENT, then appended (merge, no existing value
  touched): commented `DOCS_PATH` example + explicit defaults
  `RAG_INGEST_ROOT_GUARD=on`, `WATCHER_ARCHIVE_MODE=off` (matching the file's
  explicit-value style; DOCS_PATH left commented so the bundled ./data/docs
  default mount is unchanged).

### 3. Obsolete `version:` removal

- `docker-compose.monitoring.yml`: removed `version: '3.8'` (was line 32).
- `docker-compose.multi-kb.yml`: removed `version: '3.9'` (was line 27).

### 4. Future-pass — docker-compose.multi-kb.yml

- Removed all 7 hardcoded `container_name` entries (rag-init, rag-postgres-primary,
  rag-postgres-atc, rag-postgres-research, rag-redis, rag-api, rag-nginx); added a
  header comment matching the monitoring overlay's WS-COMPOSE treatment
  (COMPOSE_PROJECT_NAME-based auto-naming).
- Network name parameterized: `name: ${RAG_NETWORK_NAME:-rag-multi-kb-network}`
  (same pattern as docker-compose.yml; fallback preserves the previous literal,
  and the checked-in .env already pins `RAG_NETWORK_NAME=rag-multi-kb-network`,
  so resolved output is byte-identical for existing deploys).
- `OLLAMA_BASE_URL` parameterized: `${OLLAMA_BASE_URL:-http://host.docker.internal:11434}`
  (same passthrough pattern as docker-compose.yml; fallback preserves prior literal).

## Self-verification

All run from repo root (compose reads ./\.env):

| Check | Result |
|---|---|
| `docker compose -f docker-compose.yml config` | exit 0, stderr empty |
| `docker compose -f docker-compose.yml -f docker-compose.monitoring.yml config` | exit 0, stderr empty |
| `docker compose -f docker-compose.multi-kb.yml config` | exit 0, stderr empty |
| version warnings | none (stderr empty on all three) |
| duplicate host ports | none — main: 10000; +monitoring: 10000, 10010-10016 each exactly once; multi-kb: 10000 |
| api resolved env | `DOCS_PATH: ""`, `RAG_INGEST_ROOT_GUARD: "on"`, `WATCHER_ARCHIVE_MODE: "off"` |
| container_name in resolved multi-kb config | 0 occurrences |
| same-path :ro mount with DOCS_PATH unset | resolves to `/home/devel/exudeai/rag-bootstrap/data/docs` both sides, read_only true |
| multi-kb resolved network / OLLAMA_BASE_URL | `rag-multi-kb-network` / `http://host.docker.internal:11434` (unchanged behavior) |

Note: with DOCS_PATH unset the container env gets `DOCS_PATH=""`, which
`_check_ingest_root()` treats as guard-inactive — identical to pre-fix behavior
until an operator sets DOCS_PATH, exactly as specified.

## Deviations

None. No files outside the work zone edited (this report is the task-mandated
handoff deliverable). No commits made.
