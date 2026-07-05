# rag-bootstrap Unified Execution Plan

**Scope root:** `/home/devel/exudeai/rag-bootstrap`
**Goal:** working, stable, minimum-viable-but-maximal-feature deployment for downstream consumers.
**Design invariant:** every source file has exactly ONE owning workstream — edit zones are strictly disjoint so a fleet can run waves in parallel with zero merge conflicts.

Covers all five concerns: (a) Ollama embeddings default, (b) port base-10000 scheme, (c) file-path portability, (d) all non-blacklisted suggestions-triage items, (e) docs/ cleanup + INDEX regen.

**OUT OF SCOPE (infra-blacklisted):** k8s / Terraform / CI-CD / infra-scaling. None exist in the repo (only a contextual k8s mention in a suggestions file). The systemd `--user` Ollama forwarder template (sugg-F7) and the post-commit reindex hook (sugg-F23) are LOCAL host/tooling artifacts and are IN scope.

---

## Shared contracts (fixed here so parallel workstreams need no cross-file coordination)

### Embedding defaults (single canonical triple)
| Key | Value |
|-----|-------|
| `EMBEDDING_MODEL` | `nomic-embed-text` |
| `EMBEDDING_DIMENSION` | `768` |
| `EMBEDDING_BACKEND` | `ollama` |

Every fallback layer must resolve to this triple: `app/config.py` Python defaults, `docker-compose.yml` env fallbacks, `config/config.yaml`, `.env`/`.env.example`, and `deploy.sh` parse + generate_env heredoc. sentence-transformers stays an OPTIONAL non-default backend (guarded, dep commented out).

### Port base-10000 scheme (single source of truth: `RAG_PORT_BASE=10000`)
Compose cannot do arithmetic, so `deploy.sh` computes concrete `RAG_<svc>_PORT` values from `RAG_PORT_BASE + offset` and writes them into `.env`; compose files consume `${RAG_<svc>_PORT:-<literal>}` with the literal default matching the table. Container-side (right) port of every mapping is UNCHANGED so `prometheus.yml` scrape targets stay valid.

| Service | Env var | Offset | Default host port | Container port |
|---------|---------|--------|-------------------|----------------|
| web (nginx) | `RAG_PORT` | +0 | **10000** | 80 |
| prometheus | `RAG_PROMETHEUS_PORT` | +10 | 10010 | 9090 |
| grafana | `RAG_GRAFANA_PORT` | +11 | 10011 | 3000 |
| loki | `RAG_LOKI_PORT` | +12 | 10012 | 3100 |
| alertmanager | `RAG_ALERTMANAGER_PORT` | +13 | 10013 | 9093 |
| postgres-exporter | `RAG_PG_EXPORTER_PORT` | +14 | 10014 | 9187 |
| redis-exporter | `RAG_REDIS_EXPORTER_PORT` | +15 | 10015 | 9121 |
| cadvisor | `RAG_CADVISOR_PORT` | +16 | 10016 | 8080 |

Reserved band **10000–10019** for this stack; downstream apps take **+20 and up**. Ollama `11434` stays an external well-known port (not remapped). Internal-only container ports (postgres 5432, redis 6379, api/uvicorn 8000) are never published. `alertmanager --web.external.url` must be updated to the new host port (docker-compose.monitoring.yml:87).

### DB meta contract (owned by WS-DB, consumed by WS-API + WS-INGEST)
A single meta table/row written at first ingest carrying: `embedding_model`, `dimension`, `project_name`, `docs_root`, `indexed_at`, `indexed_commit_sha`. WS-DB exposes read/write helpers + an `INSERT ... ON CONFLICT DO NOTHING` dedup helper. WS-API and WS-INGEST import these; they do NOT edit `database.py`.

---

## Workstream table

| ID | Title | Owns (edit zone) | Wave | Depends on |
|----|-------|------------------|------|-----------|
| WS-ENV | Env templates: port base + embedding defaults + isolation keys | `.env`, `.env.example` | 1 | — |
| WS-COMPOSE | Compose: port indirection + embedding fallbacks + same-path mount | `docker-compose.yml`, `docker-compose.monitoring.yml`, `docker-compose.multi-kb.yml` | 1 | — |
| WS-CONFIGYAML | config.yaml: port 10000 + embedding block + ingestion/concurrency knobs | `config/config.yaml` | 1 | — |
| WS-DEPLOY | deploy.sh orchestration: config resolution, generate_env preserve, port/ollama preflight, doctor/reset | `deploy.sh` | 1 | — |
| WS-APPCONFIG | App config defaults + path anchoring | `app/config.py`, `app/config_manager.py` | 1 | — |
| WS-DB | DB meta table + dedup helper | `app/database.py` | 1 | — |
| WS-EMBED | Embedding concurrency/retry + dependency pins | `app/embeddings.py`, `app/requirements.txt` | 1 | — |
| WS-SCRIPTS | Helper scripts: port sourcing + post-commit hook | `scripts/health-check.sh`, `scripts/bootstrap.sh`, `scripts/post_commit_rag_ingest.py` | 1 | — |
| WS-TESTS | Relocated test scripts: repo-root anchoring | `tests/test-streaming-and-watcher.sh`, `tests/run_integration_tests.sh` | 1 | — |
| WS-CONSUMER | Consuming-agent contract + client CLI/fallback | `CONSUMING_AGENTS_CONTRACT.md`, `agent_hints/HOW_TO_QUERY.md`, `client/ragq.py`, `client/fallback_policy.py` | 1 | — |
| WS-INGEST | Ingestion + watcher hardening | `app/ingestion.py`, `app/watcher.py` | 2 | WS-DB |
| WS-API | API endpoints + async ingest + nginx + MCP | `app/main.py`, `app/search.py`, `app/mcp_server.py`, `frontend/nginx.conf` | 2 | WS-DB, WS-EMBED, WS-INGEST |
| WS-DOCS | Docs taxonomy move + INDEX regen + README + new guides | all of `docs/**`, `README.md`, `agent_hints`? no →(docs only), 4 root `SUGGESTIONS*.md`/`RAG_BOOTSTRAP_ISSUES_AND_SUGGESTIONS.md` | 3 | WS-ENV, WS-API |

---

## Docs move map (WS-DOCS)

Operate on current `docs/` state. `git mv` groups (siblings moved together keep plain-text cross-mentions accurate):

**→ `docs/archive/session_records/`** (dated point-in-time + superseded):
`PHASE1_IMPLEMENTATION_SUMMARY.md`, `PHASE2_IMPLEMENTATION_SUMMARY.md`, `PHASE3_IMPLEMENTATION_SUMMARY.md`, `PHASE4_IMPLEMENTATION_SUMMARY.md`, `PHASE_5_1_EXECUTION_REPORT.md`, `PHASE_A_DELIVERABLES_2026_05_06.md`, `SESSION_SUMMARY_2026_05_06.md`, `Integration_Testing_Results_2026_05_06.md`, `MASTER_EXECUTION_PLAN_2026_05_06.md`, `ENHANCEMENT_RELEASE_2026_05_11.md`, `COMPLETE_PROJECT_STATUS.md`, `INTEGRATION_TESTING_GUIDE.md` (superseded by RAG_INTEGRATION_TESTING_GUIDE.md).

**→ `docs/integration/`** (durable integration/API reference):
`RAG_PRODUCTION_API.md`, `API_V3_CHAT_STREAMING.md`, `integration-guide.md`, `RAG_INTEGRATION_NOTES.md`, `RAG_INTEGRATION_TESTING_GUIDE.md`, `RESEARCHHUB_INTEGRATION_GUIDE.md`, `EMBEDDINGS_RESEARCH_INTEGRATION.md`.

**→ `docs/reference/`** (architecture/design):
`ARCHITECTURE.md`, `MODULARITY_DESIGN.md`.

**→ `docs/deployment/`** (existing folder; ops):
`INFRASTRUCTURE_DIAGNOSTICS.md`, `PRODUCTION_DEPLOYMENT_RUNBOOK.md`, `PRODUCTION_READINESS_CHECKLIST.md`.

**Also relocate (post-triage) the 4 root suggestions source files** into `docs/archive/session_records/`:
`RAG_BOOTSTRAP_ISSUES_AND_SUGGESTIONS.md`, `SUGGESTIONS.md`, `SUGGESTIONS_FROM_DOCS_RAG_DEPLOYMENT_2026-07-03.md`, `SUGGESTIONS_FROM_RESEARCHHUB_2026-06-23.md`.

### Real link fixes (only 2 markdown hyperlinks break on move)
- `README.md:296` `[Integration Guide](docs/integration-guide.md)` → `docs/integration/integration-guide.md`
- `docs/reference/ARCHITECTURE.md:628` `[Streaming Endpoints](./API_V3_CHAT_STREAMING.md)` → `../integration/API_V3_CHAT_STREAMING.md`
- `ARCHITECTURE.md:622` `./MODULARITY_DESIGN.md` stays valid (co-located in reference/).

### Stale text-reference fixes inside moved docs (from paths-concern F4/F5)
- `docs/integration/RAG_INTEGRATION_TESTING_GUIDE.md:691` dead absolute `/home/.../RAG_PRODUCTION_API.md` → `docs/integration/RAG_PRODUCTION_API.md`; lines 58/504/394 `./tests/sample_docs` — create `tests/sample_docs/` (belongs to WS-TESTS) OR correct guide to an existing path (WS-DOCS corrects text; WS-TESTS owns creating the dir if chosen — see disjointness note).
- `docs/integration/RAG_PRODUCTION_API.md:675` `./test-streaming-and-watcher.sh` → `tests/test-streaming-and-watcher.sh`
- `docs/archive/session_records/PHASE_A_DELIVERABLES_2026_05_06.md:296-299,353,381` → `tests/test-streaming-and-watcher.sh`
- `docs/archive/session_records/PHASE_5_1_EXECUTION_REPORT.md:121,128,482,487` bare root names → `docs/...` paths.

### INDEX regeneration
`docs/INDEX.md` (stale 2026-05-11 template referencing non-existent DIRECTORY_STRUCTURE.md/README.md) → regenerate mapping new subfolders (archive/session_records, integration, reference, deployment, benchmarking, features, findings) + link scope/roadmap/todo. `scope.md`/`roadmap.md`/`todo.md` stay lean top-level, unchanged (no outbound path links break).

---

## Per-workstream detail

### WS-ENV — `.env`, `.env.example`
- Add `RAG_PORT_BASE=10000`; set `RAG_PORT` default 10000 and document derived `RAG_<svc>_PORT` vars (concrete values are written by deploy.sh generate_env at runtime; templates carry documented defaults).
- Set embedding triple to canonical (`nomic-embed-text`/`768`/`ollama`); keep `.env.example:37` `ollama pull nomic-embed-text` note and elevate to a documented hard prerequisite.
- Confirm instance-isolation keys present/consistent (`COMPOSE_PROJECT_NAME`, `RAG_NETWORK_NAME`) — already at .env.example:10-25; ensure `.env` mirrors.
- Covers: emb-F1(env), ports-F1/F3, sugg-F2(keys), emb-F4(pull note).

### WS-COMPOSE — 3 compose files
- `docker-compose.yml`: change env fallbacks 130-132 to canonical embedding triple; web port 176 default `${RAG_PORT:-10000}`; add first-class same-path docs mount driven by single `DOCS_PATH` (`- ${DOCS_PATH}:${DOCS_PATH}:ro`) so stored `document_filepath` is host-openable (sugg-F12); keep host.docker.internal:host-gateway extra_host (149, already present); document Ollama endpoint modes (local/remote/bridge) (sugg-F7 compose side).
- `docker-compose.monitoring.yml`: replace 7 hardcoded host ports with base-derived `${RAG_*_PORT:-<literal>}` per port table (lines 39/66/175/92/111/132/157); update `alertmanager --web.external.url` (87) to new host port.
- `docker-compose.multi-kb.yml`: web port 243 default 10000; embedding block 197-199 already canonical — confirm.
- Covers: emb-F2/F4, ports-F2/F3, sugg-F7/F12(compose side).

### WS-CONFIGYAML — `config/config.yaml`
- `port: 10000` (line 36).
- Embedding block already `nomic-embed-text`/768/ollama (106/112/117) — confirm/lock.
- Add `ingestion.extensions` + `ingestion.exclude` (globs: `.git/`, `node_modules/`, `data/`, `*.pdf`) that WS-INGEST/WS-API thread through (sugg-F8).
- Add `ingestion.concurrent_files` + `ingestion.retry_backoff` knobs (sugg-F13/F26) and a documented (future) multi-embedding-model stanza.
- Covers: ports-F3/F4, sugg-F8(config)/F13/F26.

### WS-DEPLOY — `deploy.sh`
- Config resolution: fall back to `config/config.yaml` (not bare `./config.yaml`); abort or require `--defaults` on missing config; echo effective resolved config (port, network, embedding model+dim+backend, llm) right before `docker compose up` (sugg-F1, paths-F7).
- generate_env (148-182): PRESERVE customized `.env` — never clobber `COMPOSE_PROJECT_NAME`/network/port isolation keys; merge/append; emit canonical embedding triple (fix 163-165 which currently default 384/sentence-transformers) (sugg-F2, emb-F3).
- Port base computation: compute `RAG_<svc>_PORT = RAG_PORT_BASE + offset` and write into `.env`; parse-defaults (96-98) → canonical embedding triple; web default 10000 (45/69).
- Port preflight: `ss -ltn`/`lsof` on resolved `RAG_PORT` before up; auto-increment (like network 114-142) or fail fast (sugg-F4).
- Ollama doctor preflight: `curl $OLLAMA_BASE_URL/api/tags`, verify embedding model pulled, disk-space check (sugg-F6); document Ollama modes + ship rootless TCP-forwarder + systemd `--user` unit template (sugg-F7 deploy side — LOCAL tooling, allowed).
- Ops: trap start-path failures + `docker compose down` orphans; `doctor` subcommand; `reset` that wipes root-owned `./data/docker/postgres` via throwaway root container (clean at 471-497 fails as normal user) (sugg-F17); backup/restore + setup-wizard stubs deferred (sugg-F25).
- Dim-guard hook: call the app/DB migrate/reset path when stored dim ≠ config (deploy side of sugg-F3).
- Covers: emb-F3, ports-F1/F3/F4, sugg-F1/F2/F4/F6/F7/F17/F25(deploy).

### WS-APPCONFIG — `app/config.py`, `app/config_manager.py`
- `config.py:18/19/26` → canonical embedding triple (ultimate fallback for direct Python/tests; also drives `Vector(settings.EMBEDDING_DIMENSION)`) (emb-F1).
- `config.py:49` `RAG_PORT` default 10000 (ports-F3).
- `config.py:60` env_file + `config_manager.py:186` `./config.yaml`: anchor to package root (`Path(__file__).resolve().parent.parent`) and honor `RAG_ENV_FILE`/`RAG_CONFIG_FILE` overrides (paths-F6/F7).
- Covers: emb-F1, ports-F3, paths-F6/F7, sugg-F3(config).

### WS-DB — `app/database.py`
- Add meta table/row (embedding_model, dimension, project_name, docs_root, indexed_at, indexed_commit_sha) + read/write helpers (per DB meta contract).
- Add `INSERT ... ON CONFLICT DO NOTHING` dedup helper for content_hash (unique=True at :35) so re-ingest is idempotent (sugg-F9 db side).
- `Vector(settings.EMBEDDING_DIMENSION)` (:63) stays; correctness now guaranteed by canonical 768 default. `expire_on_commit=False` (:21) already present — no change.
- Covers: sugg-F3/F9/F14 (db side). Consumed by WS-API + WS-INGEST via imports.

### WS-EMBED — `app/embeddings.py`, `app/requirements.txt`
- `embeddings.py:154`: replace serial list-comp with `asyncio.Semaphore` concurrency cap (from config knob); add retry-with-backoff on timeouts/5xx to `_embed_ollama` (175-181); use Ollama batch embeddings where available (sugg-F13/F26).
- Hard-guard the sentence-transformers backend (14/69-75) with an actionable ImportError ("use EMBEDDING_BACKEND=ollama or pip install sentence-transformers") (emb-F5, sugg-F5).
- `requirements.txt`: keep sentence-transformers commented (20) unless bundle chosen (open question); pin `fastmcp` to one version (32) (sugg-F16).
- Covers: emb-F5, sugg-F5/F13/F16(pin)/F26.

### WS-SCRIPTS — `scripts/health-check.sh`, `scripts/bootstrap.sh`, `scripts/post_commit_rag_ingest.py`
- `health-check.sh:70-75,145-170`: source ports from `.env` (`RAG_PORT` + `RAG_<svc>_PORT`) instead of hardcoded 8100/9090/3000/9093 (ports-F6).
- `bootstrap.sh:49-51`: rename `RAG_API_PORT` → `RAG_PORT`, default 10000 (ports-F5).
- New `scripts/post_commit_rag_ingest.py`: template post-commit hook consumers copy into `.git/hooks/post-commit` to reindex docs/+code after commit (sugg-F23, LOCAL git hook — allowed).
- Covers: ports-F5/F6, sugg-F23.

### WS-TESTS — `tests/test-streaming-and-watcher.sh`, `tests/run_integration_tests.sh`
- `test-streaming-and-watcher.sh`: add `REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"`; use it for `docker compose` cd (40-41,63-64) and `data/docs` paths (231-232,266); resolve container dynamically (`docker compose ps -q api`) instead of literal `rag-bootstrap-api` (70) (paths-F1/F3).
- `run_integration_tests.sh`: add SCRIPT_DIR + `cd "$SCRIPT_DIR/.."`; fix relative refs (compose 111/118, .env 137, app checks 205, logs 12, RESULTS_FILE 15); point results at `docs/` or explicit `./logs` (paths-F2).
- Optionally create `tests/sample_docs/` with example files (paths-F5) — see disjointness note (WS-TESTS owns the dir; WS-DOCS only edits guide TEXT).
- Covers: paths-F1/F2/F3, paths-F5(dir).

### WS-CONSUMER — `CONSUMING_AGENTS_CONTRACT.md`, `agent_hints/HOW_TO_QUERY.md`, `client/ragq.py`, `client/fallback_policy.py`
- One-page `CONSUMING_AGENTS_CONTRACT.md`: endpoint discovery via `RAG_ENDPOINT_URL`, query/response schema, health, fallback policy, citation format, rate-limit posture, version pinning, corpus scoping.
- `agent_hints/HOW_TO_QUERY.md`: single-include hint header (collapses the repeated ~200-word RAG_NOTE).
- `client/ragq.py` CLI + shared `client/fallback_policy.py`.
- Document the endpoint/schema to MATCH what WS-API ships (contract described in plan; if WS-API changes route to /api/v1, reflect here — depends on open-question resolution).
- Covers: sugg-F18.

### WS-INGEST — `app/ingestion.py`, `app/watcher.py` (wave 2, depends WS-DB)
- Thread `extensions` + exclude globs from config through ingest_directory (ingestion.py:201 currently `supported_extensions()` unconditionally) (sugg-F8 ingest side).
- Dedup self-healing: pre-check/`ON CONFLICT` via WS-DB helper + `await session.rollback()` in except at :209 before continue (sugg-F9 ingest side).
- Store host-openable abs filepath: `ingestion.py:167` `str(filepath.resolve())` aligned to `DOCS_PATH` same-path mount (sugg-F12 ingest side).
- Stale-chunk expiry: mark chunks whose paths vanished as expired each pass (sugg-F21 ingest side).
- Watcher archiving opt-in (default off) or copy-not-move; refuse archive on read-only mount (watcher.py:362-373 `shutil.move`) (sugg-F11).
- Symbol-aware chunking opt-in for .py/.js/.go (sugg-F22 — deferrable/large).
- Covers: sugg-F8/F9/F11/F12/F21/F22 (ingest side).

### WS-API — `app/main.py`, `app/search.py`, `app/mcp_server.py`, `frontend/nginx.conf` (wave 2, depends WS-DB/EMBED/INGEST)
- `DirectoryIngestRequest` (main.py:216): add optional `extensions`/`exclude` fields consumed by WS-INGEST route (sugg-F8 api side).
- Async directory ingest: `/api/ingest/directory` returns `job_id`; add `GET /api/ingest/status/{job_id}` (job store in-process); removes nginx 300s cliff (frontend/nginx.conf:29 `proxy_read_timeout`) (sugg-F10).
- `GET /api/status` / whoami: `{project_name, docs_root, documents, chunks, embedding_model, dimension, indexed_at}` from WS-DB meta + ingest-root guard (sugg-F14).
- `GET /health/index`: `{indexed_at, indexed_commit_sha, corpus_bytes, chunks, documents, source_root, staleness_class}`; optional `/api/health?deep=1` embed+1-NN (only liveness at main.py:321) (sugg-F15).
- Dim-mismatch startup check: refuse start / clear message when WS-DB meta dim ≠ config (sugg-F3 api side).
- Corpus/project filter on search + expose `/api/v1/search` (search.py + main.py) (sugg-F19 — see open question re: breaking rename).
- `X-Chunk-Bytes` response header + structured access log for token-savings telemetry (sugg-F20).
- MCP: harden `mcp_server.py` `description=` (broke across releases) and designate HTTP `/api/search` primary seam, MCP best-effort (sugg-F16 api side).
- `/stats` operator dashboard endpoint (sugg-F25 api side — deferrable).
- Covers: sugg-F3(api)/F8(api)/F10/F14/F15/F16(api)/F19/F20/F21(api)/F25(api).

### WS-DOCS — all `docs/**`, `README.md`, 4 root suggestions files (wave 3)
- Execute move map + INDEX regen + link/text-ref fixes (above).
- `README.md`: update ~10 literal `8100` refs → `10000` and add "Port scheme: RAG_PORT_BASE=10000, offsets +0..+16" table (ports-F7); fix integration-guide link (:296) (docs-F2/F7); reference new endpoints/troubleshooting.
- New `docs/TROUBLESHOOTING.md` (port-in-use, dimension error, Ollama refused, docs-not-in-search) + `docs/PERFORMANCE.md` (chunk_size, model speed/accuracy, scaling, memory/streaming) + network-isolation section + multi-stack runbook (sugg-F24).
- Covers: docs-F1..F7, paths-F4/F5(text), ports-F7(README), sugg-F24, sugg-F18? no (that's WS-CONSUMER).

---

## Disjointness verification
No file appears in two edit zones. Hot files resolved to a single owner:
- `deploy.sh` → WS-DEPLOY only (absorbs embeddings-F3, ports-F1/F3/F4, sugg-F1/F2/F4/F6/F7/F17/F25 deploy sides).
- `docker-compose.yml` → WS-COMPOSE only (absorbs embeddings-F2/F4, ports-F3, sugg-F7/F12 compose sides).
- `app/config.py` → WS-APPCONFIG only (absorbs embeddings-F1, ports-F3, paths-F6, sugg-F3 config).
- `config/config.yaml` → WS-CONFIGYAML only. `README.md` → WS-DOCS only (absorbs ports-F7 + docs + sugg-F24).
- `app/database.py` → WS-DB only; WS-API/WS-INGEST consume via imports (no edit).
- `app/requirements.txt` → WS-EMBED only (both sentence-transformers guard line and fastmcp pin).

**Two coordinated-but-disjoint couplings (interface in plan, not shared file):**
1. Port scheme spans WS-ENV/WS-COMPOSE/WS-DEPLOY/WS-SCRIPTS/WS-DOCS — resolved by the fixed port table; each edits only its own files.
2. `tests/sample_docs/` (paths-F5): WS-TESTS OWNS creating the directory+files; WS-DOCS only edits guide TEXT to point at it. If the "correct the guide instead of creating the dir" option is chosen, WS-TESTS creates nothing and WS-DOCS rewrites the reference — still disjoint.

---

## Sequencing (parallel-safe waves)
- **Wave 1 (10 parallel):** WS-ENV, WS-COMPOSE, WS-CONFIGYAML, WS-DEPLOY, WS-APPCONFIG, WS-DB, WS-EMBED, WS-SCRIPTS, WS-TESTS, WS-CONSUMER.
- **Wave 2 (2 parallel):** WS-INGEST (needs WS-DB helpers), WS-API (needs WS-DB meta + WS-EMBED + WS-INGEST job infra).
- **Wave 3 (1):** WS-DOCS (authored last so README/troubleshooting reflect final ports + endpoints).

---

## Testing strategy (targeted; lean on onboard diagnostics)
- **Config/compose/ports (WS-ENV/COMPOSE/CONFIGYAML/DEPLOY/SCRIPTS):** `docker compose -f ... config` to prove interpolation resolves + no host-port collisions; `./deploy.sh doctor` (new) as the durable, KEPT self-check for ollama reachability, model pulled, resolved config, port free. No new test files.
- **App (WS-APPCONFIG/DB/EMBED/INGEST/API):** exercise live via the KEPT endpoints — `GET /api/status`, `GET /health/index`, `POST /api/ingest/directory` → `GET /api/ingest/status/{id}`, `GET /api/search`. A single TEMPORARY smoke (re-ingest same dir twice to prove idempotent dedup + rollback; ingest with a wrong dimension to prove startup guard) — delete after green.
- **Paths (WS-TESTS):** run the two relocated scripts from `tests/` cwd to prove REPO_ROOT anchoring; these ARE the diagnostics (kept).
- **Docs (WS-DOCS):** a markdown link-check (temporary) over `docs/` + README to confirm the 2 hyperlink fixes and no new dead links; INDEX lists every file post-move.
- Persistent tests only where user-flagged security-critical (none here) — everything else temporary per testing-discipline rule.

## Open questions (genuine design gates)
1. **sentence-transformers packaging:** bundle it (uncomment requirements.txt:20, heavier image) OR keep ollama-only with a hard guard message? Plan defaults to guard-only.
2. **Ollama delivery:** keep external host Ollama with a checked manual-pull prerequisite OR add an `ollama` service + init-pull to compose (bigger image, but self-contained)? Plan defaults to external + preflight.
3. **API versioning (breaking):** rename `/api/search` → `/api/v1/search` now — this breaks existing consumers (e.g. RESEARCHHUB `RAG_BASE_URL`) — OR ship `/api/v1/*` additively as an alias and keep `/api/search`? Plan assumes additive alias unless told otherwise.
4. **`DOCS_PATH` same-path mount default:** make same-path `ro` mount the DEFAULT (changes existing `./data/docs` semantics) or opt-in? Plan makes it a first-class defaulted mode but reversible.
5. **Large/low items (sugg-F22 symbol chunking, F25 wizard/backup/stats dashboard):** in this MVP pass or explicitly deferred to a backlog? Plan carries them as deferrable stubs.
