# Fix-Batch Adversarial Re-Verification — 2026-07-03

**Auditor**: independent re-verify agent (read-only pass; this report is the only write).
**Scope**: F1–F5, FIX-CONSUMER, WS-DOCS-3, plus compose/py_compile/bash -n sweeps.
**Verdict**: **ALL PASS** — every claim survived adversarial re-check. No new defects found. Three informational observations at the end.

---

## F1 — compose env passthrough — PASS

- `docker-compose.yml:177` `WATCHER_ARCHIVE_MODE: ${WATCHER_ARCHIVE_MODE:-off}`, `:183` `DOCS_PATH: ${DOCS_PATH:-}`, `:184` `RAG_INGEST_ROOT_GUARD: ${RAG_INGEST_ROOT_GUARD:-on}`.
- Resolved config (parsed with yaml): all three land on the **api** service only (`DOCS_PATH: ""`, `RAG_INGEST_ROOT_GUARD: "on"`, `WATCHER_ARCHIVE_MODE: "off"`); no other service carries them.
- Reader names match exactly: `app/main.py:476` (`RAG_INGEST_ROOT_GUARD`, default "on"), `app/main.py:479` + `:1018` + `:1064` (`DOCS_PATH`), `app/watcher.py:151` (`WATCHER_ARCHIVE_MODE`, default "off"). Empty `DOCS_PATH` → guard inactive (`main.py:479-480`), matching the resolved default.
- Documented in `.env.example:108-119` (DOCS_PATH, RAG_INGEST_ROOT_GUARD, WATCHER_ARCHIVE_MODE, all three).
- Same-path `:ro` mount resolves to `/home/devel/exudeai/rag-bootstrap/data/docs` on both source and target with DOCS_PATH unset (resolved api volumes, `read_only: true`).

## F2 — nginx /health/index routing — PASS

- `frontend/nginx.conf:44-45` `location /health/ { proxy_pass http://api:8000; }` — proxy_pass has **no URI part**, so `/health/index` is forwarded unmodified. Longest-prefix beats `location /` (`:13`); no regex-location conflict (no file extension).
- Backend route exists: `app/main.py:1044` `@app.get("/health/index", response_model=IndexHealthResponse)`.
- Client matches: `client/fallback_policy.py:45` `INDEX_HEALTH_PATH = "/health/index"`; `HEALTH_PATH = "/api/health"` (`:44`) is proxied by `location /api/` (`nginx.conf:18-19`).

## F3 — deploy.sh do_ingest polls to terminal state — PASS

- `deploy.sh:583-666`: POST (`:613`) → `job_id` parse with error-and-continue on missing id (`:621-624`) → poll loop `GET /api/ingest/status/{job_id}` every 3s up to 1800s (`:627-643`) → `case` on `completed|failed|*` (`:646-661`) with real `documents_ingested` count summed into `total_docs` (`:649-651`).
- Adversarial checks: `error()` (`deploy.sh:38`) prints only — does NOT exit — so `continue` after a failed path works under `set -euo pipefail` (`:20`); all command substitutions in the loop carry `|| echo ...` fallbacks; timeout branch reports last status (`:659-660`).
- Field names/states match `app/main.py`: `IngestJobSchema` (`:270-282`), `IngestJobState` queued/running/completed/failed (`:415-420`), endpoints (`:650-653`, `:680`).

## F4 — health-check.sh — PASS

- Hits `/api/health` at `scripts/health-check.sh:89` via `check_service` which asserts HTTP status == 200 from the **proxied** path (`nginx.conf:18` routes `/api/` to api), so no SPA index.html false-positive; the root check at `:88` is deliberately labeled "Frontend".
- v2 only: `grep 'docker-compose '` over health-check.sh, bootstrap.sh, deploy.sh → **0 hits**.
- `set -e` (`:5`) + `?` counts: `CONN_COUNT="${CONN_COUNT:-?}"` (`:104`) then regex-guarded `-gt` inside an `if` (`:107`) — simulated both `?` and empty under `set -e`: no abort, correct branch. `ERROR_COUNT` pipeline ends in `wc -l` (no pipefail) — safe.
- Disclosed extras verified present: redis `ping | grep -q PONG` fixed (`:119`), `-T` on all `docker compose exec` (`:98,:103,:119,:123`), status grep widened to `running|Up` (`:77`).

## F5 — async 202+job_id contract in all three consumers — PASS

- **API source of truth**: `POST /api/ingest/directory` → 202 + `IngestJobSchema` (`main.py:650-677`); `status_url` = `/api/ingest/status/{job_id}` (`main.py:464`).
- **bootstrap.sh** (`scripts/bootstrap.sh:146-210`): POST → `job_id` → poll `status` → `documents_ingested` on completed / `error` on failed / warn on timeout; all substitutions `|| echo`-guarded under `set -euo pipefail` (`:7`).
- **frontend/js/api.js** (`:163-192`): `ingestDirectory` posts, loops while `queued|running`, follows `job.status_url` (origin-relative — `request()` at `:11` prepends `window.location.origin`, matching the server's path-only `status_url`), rejects on `failed` with `job.error`. (`ingestDirectories` at `:198` intentionally still uses the synchronous 201 plural endpoint, which exists at `main.py:944-947` and is documented as backward-compat.)
- **tests/test_main_2026_06_14.py** (`:479-524`): asserts 202, `job_id`, `status == "queued"` snapshot (deterministic — no await between `create_task` and `_job_to_schema` in the handler), `status_url` shape, poll retrievability, legal-state set (flake-safe under bare TestClient), and job-store cleanup. 400-path test at `:463`. No stale 201/8100 for the single-directory contract (the remaining 201s belong to `/api/ingest/file` and `/api/ingest/directories`, which really are 201).

## FIX-CONSUMER — corpus filter consistency — PASS

- Shipped: `SearchRequest.corpus` (`main.py:231`) threaded as `path_prefix` into **all three** modes — semantic (`:732`), keyword (`:734`), hybrid (`:736`).
- Documented: `CONSUMING_AGENTS_CONTRACT.md:34` (request-field table) + §8 (`:114-120`, LIKE-prefix semantics, null = whole corpus, `ragq.py --corpus`).
- Clients: `client/ragq.py:81` (`--corpus PREFIX`) → `:156` (`corpus=args.corpus`); `client/fallback_policy.py:162,180-181` (keyword-only `corpus=None`, payload includes the key **only when non-None** — old-server requests byte-identical). `agent_hints/HOW_TO_QUERY.md:6-7` matches (`/api/v1/search` + optional `"corpus"`, `--corpus`).
- Citation format claim: `CONSUMING_AGENTS_CONTRACT.md:82-87` matches `SearchResultSchema.document_filepath` (`main.py:238`).

## WS-DOCS-3 — PASS

- `grep -c 8100 README.md` = **0** (the only repo hit in swept code is `frontend/js/chat.js:272` `&#128100;` — an HTML emoji entity, not a port).
- Port table present: `README.md:221-244` — full RAG_PORT_BASE=10000 offset table (+0, +10..+16) plus reserved band 10000-10019 / downstream 10020+.
- Both new guides exist and are linked from INDEX: `docs/TROUBLESHOOTING.md` + `docs/PERFORMANCE.md` on disk; linked in `docs/INDEX.md:12-13` ("Operator guides" table).
- 4 suggestions files out of root and archived: repo root `*.md` = CHANGELOG, CONSUMING_AGENTS_CONTRACT, CONTRIBUTING, README only; all 4 (`SUGGESTIONS.md`, `RAG_BOOTSTRAP_ISSUES_AND_SUGGESTIONS.md`, `SUGGESTIONS_FROM_RESEARCHHUB_2026-06-23.md`, `SUGGESTIONS_FROM_DOCS_RAG_DEPLOYMENT_2026-07-03.md`) present in `docs/archive/session_records/`; disposition audit exists at `docs/findings/audits/2026-07-03_root_suggestions_triage_audit.md`.
- Disposition spot-checks re-verified against shipped code: `?deep=1` (`main.py:564,592`), `expire_stale_chunks` (`app/ingestion.py:327`), `scripts/post_commit_rag_ingest.py` exists, fastmcp pin (`app/requirements.txt:32` — note: fix-agent said "requirements.txt:32"; actual path is `app/requirements.txt`, pin itself confirmed).

## Mechanical sweeps — PASS

- **Compose**: all three combos exit 0 with **empty stderr** (`-f docker-compose.yml`; `+monitoring`; `multi-kb`). Published-port audit from resolved YAML: main = {10000}; +monitoring = {10000,10010..10016} each exactly once; multi-kb = {10000}; **zero duplicates, zero `container_name`** in any resolved config. Multi-kb resolved network `rag-multi-kb-network` unchanged (git diff shows no network-name edits); resolved `OLLAMA_BASE_URL` = `http://host.docker.internal:11434` (default-identical; now `.env`-overridable by design).
- **py_compile**: `app/*.py client/*.py tests/test_main_2026_06_14.py` → OK.
- **bash -n**: `deploy.sh`, `scripts/*.sh` (4), `tests/*.sh` (2) → all OK.
- **node --check**: `frontend/js/api.js` → OK.

## Informational observations (no action required from fix agents)

1. `docs/findings/audits/2026-07-03_root_suggestions_triage_audit.md` still ends with stray tool-call artifact text (`</content>`, `</invoke>`) — confirmed at file tail. Fix-agent disclosed this; file was READ_ONLY for both of us. Owner should trim ~2 lines.
2. Fix-agent claim cited "requirements.txt:32" for the fastmcp pin; the file is `app/requirements.txt:32`. Pin content verified correct — path imprecision only.
3. `docker-compose.multi-kb.yml` OLLAMA_BASE_URL changed from a literal to `${OLLAMA_BASE_URL:-<same literal>}`: resolved default is byte-identical (verified), but deployments that export `OLLAMA_BASE_URL` in the environment/.env will now (intentionally, per the in-file comment) redirect the multi-kb api. This is the documented feature, not drift.
