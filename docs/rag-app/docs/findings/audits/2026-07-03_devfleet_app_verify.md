# Dev-Fleet App-Layer Verification — 2026-07-03

**Scope**: Python app layer of `rag-bootstrap` after the dev fleet's edits — workstreams
WS-APPCONFIG, WS-DB, WS-EMBED, WS-INGEST, WS-API, WS-CONSUMER (per
`plan_workstreams.json`). Read-only verification; no uvicorn/docker started, no product
files edited.

**Verdict**: PASS — all statically checkable acceptance criteria met. 3 minor findings
(1 doc-lag inconsistency in WS-CONSUMER, 2 pre-existing latent issues outside the fleet's
diff), none blocking.

---

## 1. Compile + import checks (executed)

| Check | Result |
|---|---|
| `python3 -m py_compile` on all 25 `app/*.py` + 2 `client/*.py` | PASS (all compile) |
| Deep import of `app.main`, `app.search`, `app.ingestion`, `app.watcher`, `app.embeddings`, `app.database`, `app.mcp_server` from `/tmp` with `PYTHONPATH` set | PASS (`DEEP_IMPORT_OK`; only benign `inotify_simple` polling-fallback warning on host) |
| `from app.config import settings` from `/tmp` (arbitrary CWD) | PASS: `nomic-embed-text` / `768` / `ollama` / `RAG_PORT=10000` |
| Same import with `RAG_ENV_FILE=/nonexistent/.env` (proves values are code defaults, not `.env`-carried) | PASS: identical canonical values |
| `default_config_path()` from `/tmp` | PASS: resolves `<pkg>/config/config.yaml`; `RAG_CONFIG_FILE=/custom/x.yaml` override honored |
| `client/ragq.py --help` from `/tmp` + import of both client modules | PASS (`RAGQ_HELP_OK`, `CLIENT_IMPORT_OK`, default endpoint `http://127.0.0.1:10000`) |

## 2. Static proofs per criterion

### WS-APPCONFIG — PASS
- `app/config.py:28-29,36` canonical triple as code defaults; `:59` `RAG_PORT: int = 10000`.
- `app/config.py:7-11` `PACKAGE_ROOT = Path(__file__).resolve().parent.parent`; `RAG_ENV_FILE` override wins, else anchored `.env` — CWD-independent.
- `app/config_manager.py:22-48` `default_config_path()`: `RAG_CONFIG_FILE` → `<root>/config/config.yaml` → legacy `<root>/config.yaml`.

### WS-DB — PASS
- `app/database.py:81-105` `RagMeta` single-row table (embedding_model, dimension, project_name, docs_root, indexed_at, indexed_commit_sha); `:125-176` `get_meta` / `upsert_meta` (pg `ON CONFLICT DO UPDATE`, preserves docs_root/sha when not provided).
- `app/database.py:184-224` `insert_document_dedup`: `INSERT ... ON CONFLICT (content_hash) DO NOTHING ... RETURNING` — inserts-or-skips without raising; `get_document_by_hash` companion at `:227`.
- Meta row written at ingest: `app/main.py:535-539` (async dir job, incl. `_git_head_sha` provenance) and `:643` (file ingest, fail-soft). `Vector(settings.EMBEDDING_DIMENSION)` retained at `database.py:65`; `expire_on_commit=False` at `:23`.

### WS-EMBED — PASS
- `app/embeddings.py:94` `asyncio.Semaphore` cap (config `ingestion.concurrent_files`, default 5, read CWD-independently via `default_config_path()` at `:51`).
- `:241-279` `_post_ollama`: retries timeouts/transport errors and 5xx with exponential/linear backoff (3 attempts); 4xx raised immediately. `:287-329` prefers `/api/embed` batch (64/slice), remembered fallback to per-text under the same semaphore.
- Hard guard: `:32-40` `_ST_GUARD_MESSAGE` (actionable, names the pin decision and both remedies), raised at `:126-131` on missing `sentence-transformers`.
- `app/requirements.txt:20` `sentence-transformers` stays commented; `:32` `fastmcp==2.1.2` pinned with rationale.

### WS-INGEST — PASS
- Dedup: pre-check before the expensive embed (`ingestion.py:217-222`), ON CONFLICT insert (`:233`), concurrent-race handling (`:243-252`).
- Except-path rollback: `ingestion.py:305-310` — `session.rollback()` in `ingest_directory`'s `except` before continuing the walk (kills PendingRollbackError cascade).
- Config threading: `:143-145` `_load_ingestion_config`; `:287-291` request overrides else config `ingestion.extensions`/`exclude`; exclude wins (`:299`); dir-pattern + fnmatch semantics (`:170-187`).
- Host-openable path: `:236` stores `str(filepath.resolve())` (same-path `DOCS_PATH` :ro mount).
- Stale expiry: `:327-361` `expire_stale_chunks` (scoped to ingest root, metadata `expired`/`expired_at`, un-expired on re-ingest `:364-374`); search filters expired via `search.py:46-55` `_not_expired()`.
- Watcher archive OPT-IN default-off: `watcher.py:151` `archive_mode` = arg → `$WATCHER_ARCHIVE_MODE` → `"off"`; invalid → off (`:152-158`); `_archive_file` no-ops when off (`:424`), refuses read-only source (move mode, `:430`) and unwritable/uncreatable archive dir (`:437-453`); "copy" mode never touches source (`:457-458`). `main.py:126` constructs the watcher without `archive_mode`, so deploys default off. Archive-dir mkdir skipped entirely when off (`:202-211`).
- Symbol-aware chunking explicitly deferred by design note (`ingestion.py:377-378`).

### WS-API — PASS
- Async dir ingest: `main.py:650-677` `POST /api/ingest/directory` → 202 + `IngestJobSchema` (`job_id`, `status_url`) immediately; background `_run_ingest_job` owns its session (`:516-554`); `GET /api/ingest/status/{job_id}` at `:680-689`; job store pruned at 100 (`:436-450`); strong task ref kept (`:433`).
- `GET /api/status` (`:1006-1027`) and `GET /health/index` (`:1044-1066`) return exactly the documented fields, sourced from `get_meta` + live counts; staleness bucketing `:1030-1041`; ingest-root guard `:468-492` (DOCS_PATH-scoped, `RAG_INGEST_ROOT_GUARD=off` escape).
- Dim-mismatch startup guard: `:52-83` `_check_embedding_dimension` raises `RuntimeError` with actionable message on dim conflict (model-change-same-dim only warns); called from lifespan before serving (`:92-93`).
- `/api/v1/search` additive alias stacked on the SAME handler as unchanged `/api/search` (`:715-716`); also v1 aliases for health/ask/status. `corpus` scoping is additive-optional (`:231`, threaded as `path_prefix` through all three search modes, `search.py:58-67`).
- `X-Chunk-Bytes` header set on search responses (`:743-744`) + structured `search_access` JSON log (`:745-760`).
- `frontend/nginx.conf:26-34`: 300s read cliff gone — `proxy_read_timeout 3600s` with comment tying it to the async-ingest design; `proxy_buffering off` for SSE.
- MCP hardened: `mcp_server.py:32-49` constructor-drift-tolerant `_build_mcp` (description → instructions → bare); seam policy comment designates HTTP `/api/search` primary (`:7-13`).

### WS-CONSUMER — PASS (one minor doc lag, below)
- All four artifacts exist: `CONSUMING_AGENTS_CONTRACT.md`, `agent_hints/HOW_TO_QUERY.md`, `client/ragq.py`, `client/fallback_policy.py`.
- Mutual consistency verified against `app/main.py` routes: endpoint discovery order (env → `~/.config/rag/endpoint.json` → `http://127.0.0.1:10000`) identical in contract §1 and `fallback_policy.resolve_endpoint()`; request/response schema in contract §2 matches `SearchRequest`/`SearchResultSchema` field-for-field; health semantics §3 match `HealthStatus` (+`/health/index` 404-means-older handling in `check_index_health`); retry policy §4 (10s timeout, one retry after 2s, 4xx = no retry) matches `FallbackPolicy`; citation §5 matches `format_citation`; v1-pin-with-fallthrough §7 matches `SEARCH_PATHS` 404/405 probe (no retry consumed); ragq exit codes (0/1/2/3) match contract §4 and HOW_TO_QUERY. `X-Chunk-Bytes` documented in §2.

## 3. Findings (minor; none blocking)

1. **[WS-CONSUMER, doc lag]** `CONSUMING_AGENTS_CONTRACT.md` §8 (and the §2 request table)
   describes the corpus/project search filter as "planned … do not send one", but the server
   already ships it (`SearchRequest.corpus`, `app/main.py:231`, threaded at `:732-736`) and
   `/api/status` exists. Conservative direction (clients under-use a live feature — nothing
   breaks), but the contract lags the shipped API and should add the `corpus` field on the
   next doc pass.
2. **[pre-existing, outside fleet diff]** `app/main.py:135-143`: lifespan creates the watcher
   task inside `async with async_session() as db_session:` and immediately exits the block,
   so the long-lived watcher holds a session whose context has closed. Pattern is unchanged
   from HEAD (predates today's edits; verified via `git show HEAD`). Latent only — watcher
   ingest failures would surface as retry/log noise, not corruption (dedup + rollback now
   contain it). Recommend a follow-up ticket, not a fleet fix reversal.
3. **[pre-existing, outside fleet diff]** `app/watcher.py:116` `SUPPORTED_FORMATS` includes
   `.docx` but `ingestion.HandlerRegistry` has no `.docx` handler — a dropped `.docx` gets
   queued, fails `ingest_file` 3 times, and lands in `total_failed`. Also unchanged from HEAD.

## 4. Not verifiable statically (needs a live stack — out of scope here)

- Observed retry-in-logs on a transient Ollama 5xx (WS-EMBED AC) — code path proven statically.
- Live `/api/status` returning meta fields after a real first ingest (WS-DB AC) — wiring proven statically.
- End-to-end `ragq.py` query against a running endpoint (WS-CONSUMER AC) — CLI + policy module proven importable/consistent; no server was started per instructions.

**Verifier**: app-layer verify agent, 2026-07-03. Commands run from `/tmp`; only write = this report.
