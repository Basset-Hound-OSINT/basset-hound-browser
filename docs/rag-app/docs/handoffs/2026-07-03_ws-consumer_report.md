# WS-CONSUMER Handoff Report — 2026-07-03

**Instance:** py-dev@exudeai:rag-bootstrap:WS-CONSUMER
**Workstream:** Consuming-agent contract + client CLI/fallback (plan wave 1, P1)
**Status:** COMPLETE

## Partial-state recovery

Prior attempt (killed mid-edit by rate limit) had fully written
`client/fallback_policy.py` (216 lines) and nothing else. Reviewed it line by
line against the plan spec + resolved design decisions: coherent and complete
(v1-first path probe, port-10000 default, 1-retry/2s-backoff policy, citation
formatter). Kept as-is, zero edits needed. The other three zone files did not
exist and were written fresh.

## Files changed

| File | State | Lines | Content |
|------|-------|-------|---------|
| `client/fallback_policy.py` | pre-existing draft, verified, unchanged | 216 | endpoint discovery (`RAG_ENDPOINT_URL` → `~/.config/rag/endpoint.json` → `http://127.0.0.1:10000`), `FallbackPolicy` (1 retry, 2s backoff, 10s timeout, retry only on 5xx/429/connection), `search()` with `/api/v1/search`→`/api/search` 404-fallthrough, `check_health()`, `check_index_health()` (404 → None on pre-v1 servers), `format_citation()` `[[RAG:path#chunk@score]]`, `RagUnavailable`/`RagRequestError` |
| `client/ragq.py` | NEW | 170 | stdlib-only CLI over fallback_policy; positional query, `-n/--limit`, `-m/--mode`, `--rerank/--no-rerank`, `--endpoint`, `--json`, `--content-chars`, `--health`, `--index-health`; stable exit codes 0/1/2/3 (3 = unavailable, fall back); dual import (`__package__` branch) so it works as script or as `client.ragq` |
| `CONSUMING_AGENTS_CONTRACT.md` | NEW | ~110 (696 words) | one page, the 8 sections from the RESEARCHHUB §5 suggestion: (1) endpoint discovery + port-band rule, (2) query/response schema matching `app/main.py` `SearchRequest`/`SearchResultSchema` exactly (incl. cosine/normalized/rerank_score, X-Chunk-Bytes), (3) health (`/api/health` 200-even-when-degraded caveat, `/health/index`, `/api/status`, canonical triple nomic-embed-text/768/ollama), (4) fallback policy, (5) citation format + DOCS_PATH same-path note, (6) rate-limit posture (none enforced today; 429 must be treated retryable), (7) version pinning (`/api/v1/*` additive alias, `/api/search` stable, non-breaking guarantee), (8) corpus scoping (one stack = one corpus, per-band endpoints, planned additive project filter) + HTTP-retrieval-only hard rule |
| `agent_hints/HOW_TO_QUERY.md` | NEW | 14 (129 words) | single-include hint header collapsing the ~200-word repeated RAG_NOTE; endpoint, curl one-liner, ragq CLI, response shape, citation format, fallback rule, do-not-integrate rule, contract pointer |

## Acceptance-criteria evidence

| Criterion | Evidence |
|-----------|----------|
| Contract documents endpoint discovery, schema, health, and fallback in one page | Sections 1-4 of `CONSUMING_AGENTS_CONTRACT.md`; 696 words total; also covers citation/rate-limit/versioning/scoping (suggestion items 5-8) |
| `client/ragq.py` runs a query end-to-end against `RAG_ENDPOINT_URL` and falls back per fallback_policy on error | Live smoke against a temporary stdlib stub server (scratchpad, deleted from repo scope — never in-tree, no docker): (1) `RAG_ENDPOINT_URL=...:10099 ragq.py "…"` → formatted citation + snippet, exit 0; (2) legacy-only stub (v1 returns 404) → transparent fallthrough to `/api/search`, exit 0; (3) `--health` → healthy JSON, exit 0; (4) dead endpoint → 2 attempts (1 retry), advice printed, exit 3; (5) `--endpoint` flag override works |
| Schema/route consistent with WS-API decision | Additive `/api/v1/*` alias reflected (binding decision 3): client pins v1, falls through on 404/405; contract §7 documents the non-breaking guarantee; request/response fields transcribed from `app/main.py:179-201,420-456` (read-only) |
| Static checks | `python3 -m py_compile` OK on both modules; package-import branch verified (`import client.ragq`); `__pycache__` removed |

## Task-by-task

1. One-page contract — DONE (all 8 mandated topics).
2. `agent_hints/HOW_TO_QUERY.md` single-include header — DONE (129 words vs ~200-word RAG_NOTE).
3. `client/ragq.py` CLI + shared `client/fallback_policy.py` — DONE (policy pre-existing/verified, CLI new, smoke-tested end-to-end).
4. Route/schema consistency with WS-API — DONE per resolved decision 3 (additive v1 alias).

## Deferred (per binding decision 5)

None of the large items (symbol-aware chunking, setup wizard, backup/restore,
`/stats` dashboard) belong to this workstream; nothing implemented, nothing
stubbed. Contract §2/§8 deliberately phrase `X-Chunk-Bytes`, `/health/index`,
`/api/status`, and the corpus filter as "newer servers" features so the doc is
already true today and stays true once WS-API lands them.

## Deviations

- None. No files outside the 4-file zone edited. Temporary stub server lived
  only in the scratchpad. No docker started, no commits made.
- Note for WS-API (no edit needed from me): contract documents `/api/v1/search`
  as an alias of `/api/search`, `X-Chunk-Bytes` on search responses, and
  `/api/status` + `/health/index` field lists exactly per the plan — if WS-API
  ships different field names, this contract + `client/fallback_policy.py`
  constants (`SEARCH_PATHS`, `INDEX_HEALTH_PATH`) are the two places to sync.
