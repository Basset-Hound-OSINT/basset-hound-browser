# Multi-KB Query Semantics — Investigation Verdict (2026-07-03)

Read-only investigation of whether the multi-KB deployment can answer questions against (a) a single KB, (b) a selected subset, (c) all KBs. Produced by Explore agent during the 2026-07-03 overhaul pass; preserved verbatim for the future multi-KB workstream.

**Bottom line:** None of (a)/(b)/(c) work as a KB-selection feature today. The multi-KB query surface exists only as **unmounted dead code** (`app/api_v2.py` + `registry`/`router`/`search_pipeline`). What runs is the single-corpus `main:app`; the shipped contract is "one stack = one corpus."

## 1. What docker-compose.multi-kb.yml actually is
- ONE FastAPI `api` service (ordinary single-corpus app via `app/Dockerfile.multi-kb:30` `uvicorn main:app`) over THREE Postgres DBs (`postgres-primary`/`postgres-atc`/`postgres-research`), one redis, one nginx on `127.0.0.1:${RAG_PORT:-10000}:80`.
- Compose injects `PRIMARY_DB_*`/`ATC_DB_*`/`RESEARCH_DB_*` + `ROUTER_TYPE: broadcast` — **the app ignores all of it**: `app/config.py:18-22` defines only single `POSTGRES_*`; `extra: "ignore"` (`config.py:70`) drops the per-KB vars; `app/database.py:22` builds one engine. Live `.env` points at `postgres-primary` — atc/research DBs start but nothing connects.
- Compose healthcheck targets `/api/v2/health`, which is not mounted → scaffolding, not a working router.

## 2. `corpus` filter ≠ KB selector
`SearchRequest.corpus` (`app/main.py:230-231`) → `path_prefix` → `WHERE filepath LIKE '<corpus>%'` on the single connected DB (`app/search.py:58-67,100,146`). No endpoint aggregates across DBs.

## 3. Client / frontend / MCP: single-endpoint
- `client/fallback_policy.py:93-106,176-192`: one resolved URL; no fan-out. `ragq.py --corpus` = filepath prefix.
- frontend: no KB selector UI. `mcp_server.py:92`: single session, no kb param.

## 4. The dead machinery (≈70% of the plumbing exists)
- `app/api_v2.py:117-183`: `POST /api/v2/search` with `kb="all"` (broadcast) / `kb="name"` / `kb=["a","b"]` / `kb=None` (routed); `SearchPipeline.search_all/search_specific/_merge_results` (`search_pipeline.py:153-183,273-295`); `BroadcastRouter`/`StaticRouter`/`LLMRouter` (`router.py`).
- Never mounted: no `include_router`/`mount` anywhere in app/; `initialize_api()` (`api_v2.py:320`) never called; live `config/config.yaml` has no `knowledge_bases`/`router` section.
- Even if mounted: `registry._create_postgres_kb` (`registry.py:147-160`) reuses the ONE shared engine for every KB — no per-KB connection path exists.

## 5. Documented intent
`docs/reference/MODULARITY_DESIGN.md:19-39,263-279` — multi-KB is "Proposed", Phases 2-4 unchecked. `docs/roadmap.md:102` — multi-corpus federation unchecked. `CONSUMING_AGENTS_CONTRACT.md` §8 — "One stack instance = one corpus."

## Per-scenario verdict
- (a) Single KB: **PARTIAL** — only via per-stack isolation (`RAG_ENDPOINT_URL` per stack). Selecting atc/research by name: NOT IMPLEMENTED.
- (b) Subset: **NOT IMPLEMENTED** (only dead `api_v2.py:149-160`).
- (c) All-KB federated: **NOT IMPLEMENTED** (`ROUTER_TYPE=broadcast` read but never consumed).

## Cross-KB is also a ranking problem
- All KBs share ONE embedding space (nomic-embed-text/768) → cosine scores comparable across KBs in principle.
- BUT `_merge_results` concat+sort is unsound for hybrid/keyword modes (per-KB RRF / ts_rank scores not cross-comparable), and chunk/document IDs autoincrement per-DB → cross-KB citation collisions. Federation needs score normalization + ID namespacing.

## Smallest viable designs
- **Option A — client-side fan-out** (lowest effort): one stack per KB (already supported), extend `fallback_policy.py`/`ragq.py` to accept endpoint list, query concurrently, merge (semantic comparable; hybrid needs normalization), namespace citations by endpoint. No server changes.
- **Option B — gateway (realizes the multi-kb compose intent)**: (1) mount `api_v2.router` + call `initialize_api()` in lifespan; (2) add per-KB DB settings to `config.py` and per-KB engines in `registry.py`; (3) fix `_merge_results` (normalization + ID namespacing); (4) compose healthcheck `/api/v2/health` becomes real. Lights up `kb=all|name|[list]|routed` in one deployment.

**User direction (2026-07-03):** get the core single-corpus bootstrap working as intended FIRST; multi-KB deferred. Motivation for later: cross-project collaboration (researchhub-style workspaces querying each other's papers/corpora). Groundwork design doc: see `2026-07-03_multikb_design_groundwork.md` (companion).
