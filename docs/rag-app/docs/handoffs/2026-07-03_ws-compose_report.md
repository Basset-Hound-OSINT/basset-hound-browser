# WS-COMPOSE Handoff Report — 2026-07-03

**Instance**: py-dev@exudeai:rag-bootstrap:WS-COMPOSE
**Workstream**: Compose: port indirection + embedding fallbacks + same-path mount
**Status**: complete

## Partial-state recovery

A prior attempt was killed mid-edit. Its surviving draft in `docker-compose.yml` (header
PORT SCHEME block, 8100→10000 header text, container_name removals with rationale
comments) was reviewed, found correct and consistent with `.env.example` (WS-ENV), and
kept. Everything else in the spec was still missing and was completed idempotently.
`docker-compose.monitoring.yml` and `docker-compose.multi-kb.yml` had no prior changes.

## Files changed (with line refs, post-edit)

### /home/devel/exudeai/rag-bootstrap/docker-compose.yml
- **138-144**: embedding env fallbacks `all-MiniLM-L6-v2`/`384`/`sentence-transformers`
  → canonical triple `${EMBEDDING_MODEL:-nomic-embed-text}` / `${EMBEDDING_DIMENSION:-768}`
  / `${EMBEDDING_BACKEND:-ollama}`, with sync-contract comment (bare `docker compose up`
  no longer selects the not-installed sentence-transformers backend).
- **147-161**: `OLLAMA_BASE_URL` hardcoded → `${OLLAMA_BASE_URL:-http://host.docker.internal:11434}`
  plus documentation of the three Ollama endpoint modes (local / remote / bridge), the
  external-host-Ollama design (no ollama container), and the hard prerequisite
  (`ollama pull nomic-embed-text`, preflighted by `deploy.sh doctor`).
- **175-176**: `extra_hosts: host.docker.internal:host-gateway` KEPT unchanged.
- **180-190**: added DOCS_PATH-driven same-path READ-ONLY mount
  `- ${DOCS_PATH:-${PWD}/data/docs}:${DOCS_PATH:-${PWD}/data/docs}:ro` — default-on
  (defaults to the same dir as the default `RAG_DOCS_VOLUME`), reversible via env;
  documented opt-out and the keep-equal-to-RAG_DOCS_VOLUME guidance. Nested
  interpolation verified supported on Docker Compose v2.35.0.
- **210-212**: web published port `${RAG_PORT:-8100}` → `${RAG_PORT:-10000}` (= base+0)
  with pointer to the port-scheme table.
- Kept from prior draft: **24-30** PORT SCHEME header block; **45-49, 74, 101, 125, 179**
  container_name removal rationale/comments.

### /home/devel/exudeai/rag-bootstrap/docker-compose.monitoring.yml
- **14-30**: header rewritten — full base-10000 offset table (+10..+16), note that
  container-side ports are unchanged so `monitoring/prometheus.yml` scrape targets stay
  valid, and the container_name-omission rationale.
- Published ports, container side unchanged (old line → new line):
  - prometheus 39 → **52**: `${RAG_PROMETHEUS_PORT:-10010}:9090`
  - grafana 66 → **78**: `${RAG_GRAFANA_PORT:-10011}:3000`
  - alertmanager 92 → **105**: `${RAG_ALERTMANAGER_PORT:-10013}:9093`
  - postgres-exporter 111 → **123**: `${RAG_PG_EXPORTER_PORT:-10014}:9187`
  - redis-exporter 132 → **143**: `${RAG_REDIS_EXPORTER_PORT:-10015}:9121`
  - cadvisor 157 → **167**: `${RAG_CADVISOR_PORT:-10016}:8080`
  - loki 175 → **184**: `${RAG_LOKI_PORT:-10012}:3100`
- **98-101**: alertmanager `--web.external.url` → `http://localhost:${RAG_ALERTMANAGER_PORT:-10013}`.
- Removed 8 hardcoded `container_name: rag-bootstrap-*` (prometheus, grafana,
  alertmanager, postgres-exporter, redis-exporter, cadvisor, loki, promtail) — required
  for consistency: the main compose (merged with this overlay via `-f`) already dropped
  them for instance isolation, and `.env.example` (WS-ENV) documents "the compose file
  NO LONGER hardcodes container_name". Leaving them would still collide a second instance.

### /home/devel/exudeai/rag-bootstrap/docker-compose.multi-kb.yml
- **13**: architecture diagram `localhost:8100` → `localhost:10000`.
- **243-246**: nginx published port `${RAG_PORT:-8100}` → `${RAG_PORT:-10000}` with a
  side-by-side-stacks note (take +20 and up when running alongside the main stack).
- **293-296**: usage comments 8100 → 10000.
- **197-199**: embedding block confirmed already canonical
  (`nomic-embed-text`/`ollama`/`768`) — no change needed.

## Acceptance-criteria evidence

| # | Criterion | Evidence | Result |
|---|-----------|----------|--------|
| 1 | `docker compose -f docker-compose.yml -f docker-compose.monitoring.yml config` resolves; no duplicate host ports; container ports unchanged | exit 0 with live `.env` AND with `--env-file /dev/null`; published set = {10000,10010,10011,10012,10013,10014,10015,10016}, each exactly once (`uniq -c` all 1); targets remain 80/9090/3000/3100/9093/9187/9121/8080 | PASS |
| 2 | All 8 published ports map to the 10000-band per the plan table | web 10000(+0), prometheus 10010(+10), grafana 10011(+11), loki 10012(+12), alertmanager 10013(+13), pg-exporter 10014(+14), redis-exporter 10015(+15), cadvisor 10016(+16) — exact match to plan port table | PASS |
| 3 | Embedding env fallbacks resolve to ollama/nomic-embed-text/768 with no generated .env | `--env-file /dev/null` config output: `EMBEDDING_BACKEND: ollama`, `EMBEDDING_DIMENSION: "768"`, `EMBEDDING_MODEL: nomic-embed-text` (main stack and multi-kb both) | PASS |
| — | DOCS_PATH same-path ro mount works default + override | no-env: bind source=target=`/home/devel/exudeai/rag-bootstrap/data/docs`, `read_only: true`; with `DOCS_PATH=/home/devel/mydocs`: source=target=`/home/devel/mydocs`, ro | PASS |
| — | extra_hosts host-gateway kept | merged config line: `host.docker.internal=host-gateway` present on api service | PASS |
| — | alertmanager external URL tracks new host port | merged config: `--web.external.url=http://localhost:10013` | PASS |

Static checks: `docker compose config` (all three files, live-env and no-env) exit 0.
No containers were started. Only warning emitted is the pre-existing obsolete
`version: '3.8'` attribute in the monitoring file (left as-is: out of task scope,
ignored by compose v2).

## Deviations

- None outside the work zone; only the three zone files are modified (verified via
  `git diff --stat`).
- Judgment call within zone: removed the 8 hardcoded `container_name`s in
  `docker-compose.monitoring.yml` (not explicitly in tasks[], but required so the
  monitoring overlay honors the COMPOSE_PROJECT_NAME isolation contract the prior
  draft + WS-ENV already established for the merged stack).
- Left `version: '3.8'` in the monitoring file (harmless deprecation warning; not in spec).
- multi-kb `OLLAMA_BASE_URL` remains hardcoded (spec only asked for web port + embedding
  confirm there); flagging for a future pass if the multi-kb stack is revived.

## Deferred (per binding design decisions)

Symbol-aware chunking, setup wizard, backup/restore, /stats dashboard — DEFERRED as
directed; nothing in this workstream depended on them. No ollama container added
(external-host Ollama is the resolved design; `deploy.sh doctor` owns the preflight —
WS-DEPLOY's zone).
