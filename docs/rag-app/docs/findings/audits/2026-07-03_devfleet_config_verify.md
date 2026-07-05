# Dev-Fleet Config/Deploy Layer Verification — 2026-07-03

Read-only adversarial audit of the config/compose/deploy/scripts layer after the
wave-1 dev-fleet edits. Scope: acceptance criteria for WS-ENV, WS-COMPOSE,
WS-CONFIGYAML, WS-DEPLOY, WS-SCRIPTS (plan: `plan_workstreams.json` +
`RAG_BOOTSTRAP_UNIFIED_PLAN.md` port table), plus disposition of 25 cross-zone
deviations flagged by the dev agents. No stack brought up; no product files edited.

Verdict: **all five workstreams' acceptance criteria PASS mechanically**, but the
adversarial pass found **5 real defects** (3 new, 2 confirming flagged items) that
need a fix-batch — all in the "consumer of the new async-ingest / env-knob
contracts" class, not in the port/embedding contracts themselves.

---

## 1. Mechanical checks (all PASS)

| Check | Result | Evidence |
|---|---|---|
| `docker compose -f docker-compose.yml config` | PASS (rc=0) | resolves cleanly |
| Combined `-f docker-compose.yml -f docker-compose.monitoring.yml config` | PASS (rc=0) | resolves; only warning is obsolete `version:` in monitoring file |
| Duplicate host ports (combined) | NONE | 8 published ports, all unique |
| Ports in 10000 band per table | PASS | frontend 10000:80, prometheus 10010:9090, grafana 10011:3000, loki 10012:3100, alertmanager 10013:9093, pg-exporter 10014:9187, redis-exporter 10015:9121, cadvisor 10016:8080 — exact match to plan table, container sides unchanged, all bound 127.0.0.1 |
| Fallbacks with NO .env (`--env-file /dev/null`) | PASS | same 8 ports + `nomic-embed-text/768/ollama` resolve from compose literals alone |
| `bash -n` deploy.sh, scripts/health-check.sh, scripts/bootstrap.sh, tests/*.sh | PASS | all 5 scripts syntax-clean |
| `config/config.yaml` YAML parse | PASS | `yaml.safe_load` OK |
| Stale-default grep (`all-MiniLM`, `sentence-transformers`, `8100`, `384`) over compose/deploy.sh/config.yaml/.env* | PASS | only hits are comments/docs (alternatives list in config.yaml:141, prerequisite text in .env.example:73/82, historical note docker-compose.yml:141, migration note .env:20). Zero functional defaults remain. |
| `RAG_PORT_BASE=10000` grep | PASS | .env.example:43, .env:18 |
| Embedding triple in .env + .env.example | PASS | .env.example:84-86, .env:35-37 |
| `alertmanager --web.external.url` tracks host port | PASS | docker-compose.monitoring.yml:100 uses `${RAG_ALERTMANAGER_PORT:-10013}` |
| Port var NAME consistency (.env.example / compose / deploy.sh / health-check.sh) | PASS | identical names: `RAG_PORT`, `RAG_PROMETHEUS_PORT`, `RAG_GRAFANA_PORT`, `RAG_LOKI_PORT`, `RAG_ALERTMANAGER_PORT`, `RAG_PG_EXPORTER_PORT`, `RAG_REDIS_EXPORTER_PORT`, `RAG_CADVISOR_PORT` (deploy.sh:76-93 offsets match table exactly) |

## 2. Workstream acceptance criteria

### WS-ENV — PASS (3/3)
- `RAG_PORT_BASE=10000` + `RAG_PORT=10000` in both files (.env.example:43,46; .env:18,21).
- Canonical triple in both files; hard-prerequisite text elevated (.env.example:69-86).
- `COMPOSE_PROJECT_NAME` + `RAG_NETWORK_NAME` present in both (.env.example:21,47; .env:13,22).

### WS-COMPOSE — PASS (3/3)
- Combined config resolves, no duplicate host ports, container ports unchanged (§1).
- All 8 published ports map to the 10000 band per table (§1).
- Embedding fallbacks resolve to `ollama/nomic-embed-text/768` with no .env (proven via `--env-file /dev/null`).
- Extras verified: same-path `${DOCS_PATH:-${PWD}/data/docs}` :ro mount at docker-compose.yml:189 (unset-safe, resolves correctly); `extra_hosts: host-gateway` kept (:174-175); zero real `container_name` in docker-compose.yml and docker-compose.monitoring.yml (remaining grep hits are explanatory comments); Ollama modes documented (:148-160); multi-kb web port `${RAG_PORT:-10000}` (:246).

### WS-CONFIGYAML — PASS (2/2)
- `port: 10000` (config.yaml:36); embedding block is the canonical triple (:142,148,155) with lock comment (:129-134).
- `ingestion.extensions` (:61-68), `ingestion.exclude` with `.git/`, `node_modules/`, `data/`, `*.pdf` (:77-81), `concurrent_files: 5` (:107), `retry_backoff: exponential` (:113), documented future multi-model stanza (:157-171). Parses as valid YAML.

### WS-DEPLOY — PASS (4/4) with one new defect (F3 below)
- Config resolves `RAG_CONFIG_FILE` → `config/config.yaml` → legacy `./config.yaml` (deploy.sh:51-59); `require_config` aborts without `--defaults` (:195-207). No 384/sentence-transformers/8100 anywhere: defaults block :64-72 and parse-defaults :177-179 are all canonical; web default 10000.
- `generate_env` preserve (static read, :250-339): merge mode uses `env_ensure` (append-only, :123-126) for every key incl. `COMPOSE_PROJECT_NAME` (:309) — re-runs never clobber; drift reported with ".env wins" (:334-348).
- `doctor` (:910-973) reports config resolution, effective config echo (incl. embedding triple + LLM + Ollama URL), docker daemon, RAG_PORT free/occupied/held-by-this-stack, Ollama reachability + model-pulled (:452-496), disk space, dim-guard.
- Busy-port detection before `docker compose up`: `port_preflight` via ss/lsof/dev-tcp with auto-increment through the +19 band, writes chosen port back to .env (:420-447); called in `cmd_start` before `up` (:827).
- Derived-port computation `RAG_<svc>_PORT = base + offset` into .env in both fresh and merge modes (:274-277, :317-320).
- Dim-guard psql query (:523-525) matches current reality: compose `raguser/ragdb`, `app/database.py` `__tablename__="chunks"` + `embedding` column (database.py:57,65).

### WS-SCRIPTS — PASS (3/3) with one new defect (F4 below)
- health-check.sh sources `RAG_PORT`/`RAG_PROMETHEUS_PORT`/`RAG_GRAFANA_PORT`/`RAG_ALERTMANAGER_PORT` from .env with table-default fallbacks via `env_port()` (:15-27); no literal ports below that block.
- bootstrap.sh: `RAG_API_PORT` fully gone (repo-wide grep clean); health URL tracks `RAG_PORT` default 10000 (:50-52).
- `scripts/post_commit_rag_ingest.py` exists, documents copy-into-`.git/hooks` usage, uses `RAG_PORT`/10000 scheme, and — notably well done — tolerates BOTH the old list response and the new `{"job_id": ...}` async response (:41,120-121).

---

## 3. Defects found (fix-batch needed)

**F1 (HIGH, WS-COMPOSE + WS-ENV): app env knobs not passed into the api container — ingest-root guard is dead in Docker deploys.**
`app/main.py:476-481` reads `RAG_INGEST_ROOT_GUARD` and `DOCS_PATH` from the
container's process env; `app/watcher.py:151` reads `WATCHER_ARCHIVE_MODE`.
The api service `environment:` block (docker-compose.yml:131-173) passes NONE of
the three, and compose does not forward arbitrary .env keys into containers.
Consequence: `DOCS_PATH` is used host-side for the mount but is never set inside
the container, so `_check_ingest_root` always returns early — the guard WS-API
shipped can never activate in the standard deployment, and `/api/status`
`docs_root` (main.py:1018) loses its env fallback. `WATCHER_ARCHIVE_MODE` cannot
be enabled by operators at all (the WS-INGEST deviation note "works without it
since watcher reads process env" is incorrect for containers). Fix: add to api
environment: `DOCS_PATH: ${DOCS_PATH:-}`, `RAG_INGEST_ROOT_GUARD: ${RAG_INGEST_ROOT_GUARD:-on}`,
`WATCHER_ARCHIVE_MODE: ${WATCHER_ARCHIVE_MODE:-off}`; document both new knobs in .env.example.

**F2 (HIGH, WS-API zone / nginx.conf): `/health/index` unreachable through the published port.**
`frontend/nginx.conf` proxies only `location /api/` (:18); `location /`
falls back to `try_files ... /index.html` (:14). `GET /health/index` on
localhost:10000 therefore returns the SPA's index.html with HTTP 200 — never the
API route at app/main.py:1044. `client/fallback_policy.py:45`
(`INDEX_HEALTH_PATH = "/health/index"`) and `CONSUMING_AGENTS_CONTRACT.md:56`
both point consumers at it; the JSON parse fails silently and freshness checks
permanently degrade to None. Fix: add an nginx `location /health/` proxy block
(or alias the route under `/api/`).

**F3 (MEDIUM, WS-DEPLOY): `deploy.sh ingest` still speaks the old synchronous contract → bogus counts, returns before ingest completes.**
`do_ingest` (deploy.sh:612-626) POSTs `/api/ingest/directory` and computes
`count = len(json.load(stdin))`. The endpoint now returns 202 + an
`IngestJobSchema` dict (app/main.py:650-677), so `len()` counts the dict's keys —
deploy.sh will report e.g. "Ingested 9 documents from X" for a still-running job
and "Total: N documents ingested" is fiction. Fix: read `job_id`/`status_url`,
poll `GET /api/ingest/status/{job_id}`, report `documents_ingested`
(scripts/post_commit_rag_ingest.py:113-121 already shows the dual-contract pattern).

**F4 (MEDIUM, WS-SCRIPTS): health-check.sh "API Health" check is a false-positive.**
health-check.sh:89 checks `http://localhost:${RAG_PORT}/health`. Through nginx
that path hits the SPA `try_files` fallback and returns 200 (index.html) even
when the api container is down or unhealthy — the check can never fail, and no
bare `/health` route exists in app/main.py anyway (only `/api/health` and
`/health/index`). Fix: use `/api/health` (and optionally `/health/index` once F2
lands). Line 90's `/api/status` check is correctly routed and the endpoint exists.

**F5 (LOW, WS-SCRIPTS): bootstrap.sh ingest parse is stale.**
bootstrap.sh:146-160 parses `document_count`/`count` from the ingest response;
with the new 202 job schema it prints "Ingested ? document(s)" and exits before
ingestion finishes. Same fix pattern as F3. (Also stale, already flagged by
WS-API: `frontend/js/api.js:165-170` `ingestDirectory` and
`tests/test_main_2026_06_14.py:478-493` which asserts 201 + doc list and WILL fail.)

Minor/cosmetic (batchable, non-blocking):
- Obsolete `version:` attribute — docker-compose.monitoring.yml:32 (`'3.8'`) and also docker-compose.multi-kb.yml:27 (`'3.9'`); compose-v2 warning only.
- health-check.sh uses legacy `docker-compose` (v1 CLI) at :77,98,102,117,121,151 while deploy.sh/bootstrap.sh use `docker compose` — breaks on hosts without the v1 shim; also `[ "$CONN_COUNT" -gt 80 ]` (:105) aborts under `set -e` when psql fails and CONN_COUNT="?".

---

## 4. Disposition of the 25 flagged cross-zone deviations

| # | Flag | Disposition |
|---|------|-------------|
| 1 | [WS-ENV] compose :138-140 stale MiniLM fallbacks, :184 `:-8100` | **RESOLVED** — WS-COMPOSE landed after the flag: canonical triple at :143-145, `${RAG_PORT:-10000}` at :214. No action. |
| 2 | [WS-ENV] DOCS_PATH mount wiring owned by WS-COMPOSE | Mount **landed** (:189, unset-safe). But container-env passthrough missing → **FIX-BATCH (F1)**. |
| 3 | [WS-ENV] `./deploy.sh doctor` is WS-DEPLOY's deliverable | **RESOLVED** — `cmd_doctor` shipped (deploy.sh:910-973). |
| 4 | [WS-ENV] deferred items (wizard/backup/stats/symbol-chunking) | Noted; consistent with binding decision 5. No action. |
| 5 | [WS-COMPOSE] removed 8 `container_name` in monitoring.yml | **VERIFIED GOOD** — zero real entries remain; in-zone and required for COMPOSE_PROJECT_NAME isolation. |
| 6 | [WS-COMPOSE] `version: '3.8'` left in monitoring.yml | Confirmed (also `'3.9'` in multi-kb). **FIX-BATCH (trivial)**. |
| 7 | [WS-COMPOSE] multi-kb OLLAMA_BASE_URL hardcoded (:202) | Confirmed; out of spec. **Future pass** — note multi-kb ALSO still hardcodes 7 `container_name` entries (:35,59,84,109,136,161,239) and network name `rag-multi-kb-network` (:264), so the isolation contract does not extend to that stack yet. |
| 8 | [WS-COMPOSE] deferred + no ollama container | Consistent with plan default. No action. |
| 9-10 | [WS-CONFIGYAML] no out-of-zone edits; deferred keys | Verified: knobs present, parse; consumers exist (embeddings/ingestion read them). No action. |
| 11 | [WS-CONSUMER] fallback_policy assumes `/api/v1/search`, `X-Chunk-Bytes`, `/health/index` | `/api/v1/search` **shipped** (main.py:716) and `X-Chunk-Bytes` **shipped** (main.py:744) — consistent. `/health/index` exists but is **unroutable via nginx → FIX-BATCH (F2)**. |
| 12 | [WS-DEPLOY] compose :184 `:-8100` fallback | **RESOLVED** (same as #1) — now 10000. |
| 13 | [WS-DEPLOY] live .env RAG_NETWORK_NAME=rag-multi-kb-network drift | Confirmed by design (merge, .env wins); deploy.sh reports drift for port/embedding keys. Informational, no action. |
| 14 | [WS-DEPLOY] dim-guard assumes raguser/ragdb + chunks.embedding | Verified matching today (compose :79-81, database.py:57,65). Watch-item only; re-check if WS-DB ever renames. |
| 15 | [WS-DEPLOY] deferred stubs | No action. |
| 16 | [WS-DB] wave-2 notes | Out of this audit's layer; forwarded as-is. |
| 17 | [WS-INGEST] WATCHER_ARCHIVE_MODE not documented in .env.example | Confirmed missing. **FIX-BATCH (F1, WS-ENV side)**. |
| 18 | [WS-INGEST] compose WATCHER_ARCHIVE_MODE passthrough "optional" | Their "works without it" claim is **wrong for containers** — passthrough is REQUIRED. **FIX-BATCH (F1, WS-COMPOSE side)**. |
| 19 | [WS-INGEST] live double-ingest smoke deferred | Correct per instance discipline; wave-2 live check. |
| 20 | [WS-API] frontend/js/api.js:166 old sync contract | Confirmed at :165-170 (plain `request()`, no job polling). **FIX-BATCH (F5 family)**. |
| 21 | [WS-API] tests/test_main_2026_06_14.py:479-495 asserts 201+list | Confirmed at :478-493; will fail against 202+job. **FIX-BATCH (F5 family)**. |
| 22 | [WS-API] document RAG_INGEST_ROOT_GUARD in .env.example | Confirmed missing — and worse, not passed into the container at all. **FIX-BATCH (F1)**. |
| 23 | [WS-API] contract §8 corpus-filter caveat can relax | Corpus request field + v1 alias shipped; cheap doc tweak, fold into fix-batch. |
| 24-25 | [WS-API] live e2e deferred | Correct; orchestrator wave-2. |

## 5. Fix-batch summary (ranked)

1. **F1** — api-service env passthrough for `DOCS_PATH` / `RAG_INGEST_ROOT_GUARD` / `WATCHER_ARCHIVE_MODE` (docker-compose.yml) + document both knobs in .env.example.
2. **F2** — nginx route for `/health/index` (frontend/nginx.conf).
3. **F3** — deploy.sh `do_ingest` async-job polling + honest counts (deploy.sh:612-626).
4. **F4** — health-check.sh `/health` → `/api/health` (scripts/health-check.sh:89); optionally migrate `docker-compose` → `docker compose`.
5. **F5** — stale async-ingest consumers: frontend/js/api.js:166, tests/test_main_2026_06_14.py:478-493, scripts/bootstrap.sh:146-160.
6. Trivial: drop `version:` from monitoring + multi-kb compose files; relax CONSUMING_AGENTS_CONTRACT.md §8 corpus caveat.

Future pass (not fix-batch): multi-kb stack modernization (container_name x7, hardcoded network + OLLAMA_BASE_URL); README/docs 8100 → 10000 refs (README.md:20,58,73,94,122,157,175,273; docs/todo.md:88,132) — owned by WS-DOCS wave 3, pending.

— verifier agent, 2026-07-03 (read-only; no stack started, no product edits, no commits)
