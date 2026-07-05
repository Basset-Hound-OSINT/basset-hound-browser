# FIX-CONSUMER report — consumer contract synced with shipped API

**Date**: 2026-07-03
**Agent**: py-dev@exudeai:rag-bootstrap:FIX-CONSUMER
**Status**: complete

## What changed

1. **CONSUMING_AGENTS_CONTRACT.md**
   - §2 request table: added the shipped `corpus` field (string|null, default null,
     filepath-prefix filter, cross-ref §8).
   - §2 additive-fields paragraph: removed the "future `project`/corpus filter"
     framing — `corpus` is now cited as an example of an additive field that shipped.
   - §3: documented `?deep=1` additive `deep`/`deep_ok` health fields and enumerated
     `staleness_class` values (`unindexed|fresh|aging|stale`) to match main.py.
   - §8: replaced the "planned … do not send one" caveat with full `corpus` semantics
     (prefix match on stored `document_filepath`, `LIKE '<corpus>%'`; null = whole
     corpus; older servers ignore unknown request fields and return unscoped hits —
     confirm `GET /api/status` exists when scoping is load-bearing; CLI pointer).

2. **agent_hints/HOW_TO_QUERY.md** — added optional `"corpus":"<filepath prefix>"`
   to the curl line and `--corpus PREFIX` to the CLI line (kept prompt-sized).

3. **client/fallback_policy.py** — `search()` gains keyword-only `corpus: str | None
   = None`; included in the payload only when non-None (same style as `rerank`);
   docstring notes older-server ignore behavior.

4. **client/ragq.py** — new optional `--corpus PREFIX` flag (matches existing
   argparse style), threaded to `search(corpus=...)`; usage example added to the
   module docstring.

## Consistency table (contract claim → app/main.py as shipped)

| Claim (file:section) | Shipped source (app/main.py) | Verdict |
|---|---|---|
| `POST /api/v1/search` alias of `/api/search`, same handler (contract §2/§7; HOW_TO_QUERY) | decorators at :715-716 on one handler | MATCH |
| Request `query` string required (§2) | `SearchRequest.query: str` :222 | MATCH |
| Request `mode` semantic\|keyword\|hybrid, default hybrid (§2) | `SearchMode` :215-218, default :223 | MATCH |
| Request `limit` int 1-100 default 10 (§2) | `Field(default=10, ge=1, le=100)` :224 | MATCH |
| Request `rerank` bool\|null, null→env default off (§2) | :227 + `_rerank_env_default()` via :724-728 | MATCH |
| Request `corpus` string\|null, filepath-prefix scope (§2/§8) — **was "planned, do not send"** | `SearchRequest.corpus` :231; threaded as `path_prefix` :732/:734/:736; `LIKE '<prefix>%'` app/search.py:58-67 | FIXED (drift removed) |
| Response hit fields incl. nullable `cosine`/`normalized`/`rerank_score` (§2) | `SearchResultSchema` :234-248 | MATCH |
| `X-Chunk-Bytes` response header on newer servers (§2) | `response.headers["X-Chunk-Bytes"]` :744 | MATCH |
| `/api/health` → status/database/redis/embedding_service/llm; 200 even when degraded (§3) | `HealthStatus` :328-338; handler :562-617 returns 200 always | MATCH (added `?deep=1` additive fields note) |
| `/health/index` → indexed_at, indexed_commit_sha, corpus_bytes, chunks, documents, source_root, staleness_class (§3) | `IndexHealthResponse` :297-306; handler :1044-1066 | MATCH (added staleness enum `unindexed\|fresh\|aging\|stale` from `_staleness_class` :1030-1041) |
| `/api/status` → project_name, docs_root, documents, chunks, embedding_model, dimension, indexed_at (§3/§8) | `StatusResponse` :285-294; handler :1006-1027 (also `/api/v1/status` alias :1007, covered by §7 blanket) | MATCH |
| Async ingest job flow: 202 + `{job_id,...}`, poll `GET /api/ingest/status/{job_id}` | `/api/ingest/directory` 202 `IngestJobSchema` :650-677; poll endpoint :680-689 | N/A for consumer files — none of the 4 files claim anything about ingest (contract is retrieval-only by its own hard rule); no drift |
| Endpoint discovery order + default `http://127.0.0.1:10000` (§1; HOW_TO_QUERY; fallback_policy) | out of main.py scope; matches `resolve_endpoint()` + `DEFAULT_ENDPOINT` in client/fallback_policy.py | MATCH |
| Citation `[[RAG:path#chunk@score]]` (§5; HOW_TO_QUERY) | `format_citation()` client/fallback_policy.py | MATCH |
| ragq exit codes 0/1/2/3 (§4; ragq docstring) | ragq.py `EXIT_*` + argparse(2) | MATCH |

## Self-verification

- `python3 -m py_compile ragq.py fallback_policy.py` → OK.
- Argparse smoke: `--corpus /repo/docs` parses, defaults to `None` when omitted;
  `fallback_policy.search` signature has `corpus=None` keyword-only param → OK.
- Payload construction only adds `corpus` when non-None, so requests to older
  servers are byte-identical to before when the flag is unused.

## Deviations

- None. All edits confined to the 4 work-zone files.
