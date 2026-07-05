# WS-API Handoff Report — API endpoints + async ingest + nginx + MCP

- **Instance**: py-dev@exudeai:rag-bootstrap:WS-API
- **Date**: 2026-07-03
- **Status**: COMPLETE (deferrable items deferred per binding decision #5)
- **Zone files**: `app/main.py`, `app/search.py`, `app/mcp_server.py`, `frontend/nginx.conf`
- **Partial-state check**: `git diff` on all four zone files was EMPTY at start (the prior rate-limit-killed attempt never reached this zone) — implemented fresh.

## Files changed

### `app/main.py`

| Lines (approx) | Change |
|---|---|
| 3-40 | New imports: `os`, `uuid`, `dataclass`/`field`, `datetime`/`timezone`, fastapi `Response`; DB meta contract imports `Chunk`, `get_meta`, `upsert_meta` (consumed via imports — `app/database.py` NOT edited). |
| 50-81 | `_check_embedding_dimension()`: dim-mismatch startup guard. Reads the rag_meta row; stored dim != `settings.EMBEDDING_DIMENSION` → `RuntimeError` with an actionable message (restore old dim/model OR `./deploy.sh reset` + re-ingest). Model-only change at same dim → warning. No meta row (fresh DB) → no-op. |
| 91-92 | Guard invoked in `lifespan` right after `init_db()` — app refuses to start on mismatch. |
| 230-241 | `SearchRequest.corpus` (optional, additive): filepath-prefix corpus scoping per CONSUMING_AGENTS_CONTRACT §8. |
| 269-315 | `DirectoryIngestRequest` gains optional `extensions`/`exclude` (threaded into WS-INGEST's `ingest_directory` signature); new schemas `IngestJobSchema`, `StatusResponse`, `IndexHealthResponse`. |
| 320-331 | `HealthStatus` gains optional `deep`/`deep_ok` fields (additive). |
| 405-556 | Async ingest-job infrastructure: `IngestJobState`, `_IngestJob` dataclass (strong task ref, no GC mid-flight), in-process `_INGEST_JOBS` store with prune at 100 finished jobs, `_job_to_schema`, `_check_ingest_root` (refuses directory ingests outside `DOCS_PATH` unless `RAG_INGEST_ROOT_GUARD=off`; inert when `DOCS_PATH` unset), `_git_head_sha` (best-effort provenance), `_run_ingest_job` (own `async_session`, writes rag_meta `docs_root`+`indexed_commit_sha` via `upsert_meta` on success). |
| 563-618 | `GET /api/health` (+ `/api/v1/health` alias) gains `?deep=1`: embeds a probe text and runs a real 1-NN pgvector query; result in `deep_ok` and folded into overall status only when requested. |
| 640-646 | `/api/ingest/file` refreshes rag_meta `indexed_at` (fail-soft). |
| 649-696 | `POST /api/ingest/directory` → **202 + job_id immediately** (was: synchronous 201 + doc list); validates dir + ingest-root guard up front (400 stays 400); `GET /api/ingest/status/{job_id}` polls (404 for unknown/pruned). |
| 700-757 | `POST /api/search` + **additive alias `POST /api/v1/search`** (same handler): corpus filter threaded to all three modes; `X-Chunk-Bytes` response header; structured `search_access` JSON log line (mode, query_chars, limit, corpus, rerank, results, chunk_bytes, duration_ms). |
| 760-761 | `POST /api/v1/ask` additive alias. |
| 924-943 | `/api/ingest/directories` kept synchronous for back-compat (docstring points at the async route); refreshes rag_meta fail-soft. |
| 990-1063 | `GET /api/status` (+ `/api/v1/status`): `{project_name, docs_root, documents, chunks, embedding_model, dimension, indexed_at}` from rag_meta + live counts, DOCS_PATH fallback for docs_root. `_staleness_class` (unindexed / fresh <24h / aging <7d / stale). `GET /health/index`: `{indexed_at, indexed_commit_sha, corpus_bytes, chunks, documents, source_root, staleness_class}` — corpus_bytes = `sum(Document.file_size)`. |

### `app/search.py`

| Lines | Change |
|---|---|
| 46-73 | `_not_expired()` — excludes chunks the ingester marked `metadata.expired=true` (WS-INGEST stale-source expiry), `IS DISTINCT FROM TRUE` so NULL/missing metadata passes; `_path_prefix_filter()` — optional `Document.filepath LIKE '<prefix>%'` corpus scoping. |
| 96-125 | `semantic_search(..., path_prefix=None)`: both filters applied. |
| 133-153 | `keyword_search(..., path_prefix=None)`: both filters applied. |
| 216-233 | `hybrid_search(..., path_prefix=None)`: threads prefix to both legs. All new params optional+trailing — every existing call site unchanged. |

### `app/mcp_server.py`

| Lines | Change |
|---|---|
| 1-13 | Module docstring: HTTP `POST /api/search` (+`/api/v1/search`) designated the PRIMARY stable seam; MCP is best-effort (per plan sugg-F16). |
| 28-53 | `_build_mcp()`: hardened constructor — tries `description=` (works on pinned fastmcp==2.1.2), falls back to `instructions=` (2.x rename), then name-only, then bare `FastMCP()`; a fastmcp upgrade can no longer TypeError the module at import. |

### `frontend/nginx.conf`

| Lines | Change |
|---|---|
| 17-38 | `/api/` proxy: 300s read cliff removed — `proxy_read_timeout 3600s` (only covers idle gaps in LLM SSE streams and the legacy sync `/api/ingest/directories`; directory ingest itself is now async so nothing long-running holds the proxy); `proxy_buffering off` so SSE tokens stream instead of buffering; explanatory comment. |

## Acceptance-criteria evidence

| Criterion | Evidence |
|---|---|
| `GET /api/status` and `GET /health/index` return documented fields from the DB meta row | TestClient smoke (run, PASSED): with a faked meta row, `/api/status` returned all 7 fields (project_name/docs_root/documents/chunks/embedding_model/dimension/indexed_at) and `/health/index` returned all 7 (incl. `staleness_class="fresh"`, `indexed_commit_sha`, `corpus_bytes`). Meta row is now actually WRITTEN: `_run_ingest_job` calls `upsert_meta(docs_root=…, indexed_commit_sha=…)`; file/multi-dir routes refresh it fail-soft (nobody wired `upsert_meta` before this workstream). |
| `POST /api/ingest/directory` returns job_id immediately, status pollable, no 504 | TestClient smoke (run, PASSED): POST returned **202** with `job_id`+`status_url` while ingest ran as an `asyncio.create_task` with its own session; polling `/api/ingest/status/{id}` reached `completed` with `documents_ingested`. Missing dir → 400 (preserved), unknown job → 404. nginx cliff removed (3600s + async design). |
| Mismatched config dimension fails fast with clear message | Smoke (run, PASSED): faked meta dim=384 vs config 768 → `RuntimeError` naming both dims+models and both remedies, raised from `lifespan` before serving. Matching meta → clean pass; model-only mismatch → warning only. |
| `/api/v1/search` resolves and returns results; `X-Chunk-Bytes` present on search responses | TestClient smoke (run, PASSED): `/api/v1/search` → 200 with results and `X-Chunk-Bytes: 11` (== UTF-8 bytes of returned content); `/api/search` unchanged shape + same header. `corpus` filter verified threaded through to `hybrid_search(path_prefix=…)`. |
| (task) corpus/project filter | `SearchRequest.corpus` additive; SQL compile check (run, PASSED): `LIKE :prefix%` + `IS DISTINCT FROM true` render in the pg dialect. |
| (task) MCP hardening | Real import OK on pinned fastmcp==2.1.2 (`description=` accepted); simulated 2.x-style constructor (no `description`) falls back to `instructions=` (smoke PASSED). |
| Static self-verify | `python3 -m py_compile app/main.py app/search.py app/mcp_server.py` OK; nginx.conf braces balanced, single `proxy_read_timeout 3600s` (no `nginx` binary locally, no docker started per discipline). |

Smoke harnesses were TEMPORARY (heredocs, never written into the repo) per testing-discipline.

## Interface notes
- `/api/v1/*` aliases shipped (ADDITIVE, decision #3): `search`, `ask`, `status`, `health`. `/api/search` et al. unchanged.
- New env knob: `RAG_INGEST_ROOT_GUARD` (default `on`; only active when `DOCS_PATH` is set).
- Search now silently excludes expired chunks (`metadata.expired=true`) — the WS-INGEST report left this call to WS-API; filtering (not downranking) chosen: a vanished source is a dead citation.

## Deferred (binding decision #5)
- `/stats` operator dashboard endpoint — NOT implemented (deferrable per plan sugg-F25).
- Setup wizard / backup-restore / symbol-aware chunking — other zones, all deferred per decision #5.

## Deviations (edits needed OUTSIDE my zone — not made)
1. **`frontend/js/api.js:166`** (`ingestDirectory`) still expects the old synchronous doc-list response; it must be updated to read `job_id` and poll `/api/ingest/status/{job_id}` (frontend JS is not in my zone — only `frontend/nginx.conf` is).
2. **`tests/test_main_2026_06_14.py:479-495`** asserts the old 201+list contract for `/api/ingest/directory`; needs updating to expect 202+job schema (tests/ not in my zone). The 400-on-missing-dir test still passes by design.
3. **`.env.example`** (WS-ENV zone): document `RAG_INGEST_ROOT_GUARD` (on|off, default on, requires `DOCS_PATH`) next to the DOCS_PATH block.
4. **`CONSUMING_AGENTS_CONTRACT.md` §8** (WS-CONSUMER zone): the "do not send a corpus filter yet" caveat can be relaxed — `corpus` (filepath-prefix) is now shipped and ignored by older servers.
5. Live end-to-end verification (real Postgres/Ollama) requires the stack up — docker not started per instance discipline; left to the orchestrator's wave-2 live check.
