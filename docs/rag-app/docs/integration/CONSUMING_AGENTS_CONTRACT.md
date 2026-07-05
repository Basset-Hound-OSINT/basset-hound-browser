# Consuming-Agents Contract

**One page. What every agent-based consuming project can rely on when querying a
rag-bootstrap stack.** Reference from a consuming project's `CLAUDE.md` as:
`Follow ~/exudeai/rag-bootstrap/CONSUMING_AGENTS_CONTRACT.md.`
Prompt-sized summary: [`agent_hints/HOW_TO_QUERY.md`](agent_hints/HOW_TO_QUERY.md).
Reference client: [`client/ragq.py`](client/ragq.py) + [`client/fallback_policy.py`](client/fallback_policy.py) (stdlib-only; import or vendor).

## 1. Endpoint discovery

Resolve the base URL in this order (implemented by `fallback_policy.resolve_endpoint()`):

1. `RAG_ENDPOINT_URL` environment variable (e.g. `http://127.0.0.1:10000`)
2. `~/.config/rag/endpoint.json` → `{"url": "http://..."}`
3. Default `http://127.0.0.1:10000`

Port scheme: `RAG_PORT_BASE=10000`; the web entrypoint (nginx) is base+0. Each
stack instance owns a 20-port band (`10000-10019` for the default instance);
additional stacks take +20 and up. Never hardcode a port in a consuming
project — always go through `RAG_ENDPOINT_URL`.

## 2. Query API shape

`POST {base}/api/v1/search` (alias of `POST /api/search`, same handler — see §7).

Request (`Content-Type: application/json`):

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `query` | string | required | natural-language or keyword query |
| `mode` | `"semantic" \| "keyword" \| "hybrid"` | `"hybrid"` | |
| `limit` | int 1-100 | 10 | no pagination; raise `limit` instead |
| `rerank` | bool or null | null | null = server env default (off) |
| `corpus` | string or null | null | filepath-prefix filter within the stack's corpus (§8); null/omitted = whole corpus |

Response: JSON **list** of hits, each:

```json
{"chunk_id": 1, "document_id": 1, "document_filename": "watcher.md",
 "document_filepath": "/abs/path/watcher.md", "chunk_index": 0,
 "content": "…chunk text…", "score": 0.87,
 "cosine": 0.91, "normalized": 0.83, "rerank_score": null}
```

`cosine`/`normalized`/`rerank_score` may be `null`. **Tolerate additive
fields** — new optional response fields and request fields may appear (the
`corpus` filter arrived this way, §8); unknown request fields are ignored by
the server. Newer servers also set an `X-Chunk-Bytes` response header
(payload-size telemetry); its absence means an older server.

## 3. Health checks

- `GET /api/health` → `{"status": "healthy"|"degraded", "database": bool,
  "redis": bool, "embedding_service": bool, "llm": bool}`. Returns HTTP 200
  even when degraded — **check `status`**, not the HTTP code. Search only needs
  `database` + `embedding_service`; a degraded `llm` does not block retrieval.
  With `?deep=1`, additive `deep`/`deep_ok` fields report an end-to-end
  embed→1-NN probe (otherwise `null`/absent).
- `GET /health/index` (newer servers) → index freshness:
  `{indexed_at, indexed_commit_sha, corpus_bytes, chunks, documents,
  source_root, staleness_class}` with `staleness_class` one of
  `unindexed|fresh|aging|stale`. A 404 means an older server: treat freshness
  as unverified, keep querying.
- `GET /api/status` (newer servers) → stack identity: `{project_name,
  docs_root, documents, chunks, embedding_model, dimension, indexed_at}`.
  Canonical embedding triple: `nomic-embed-text` / `768` / `ollama`.

## 4. Fallback policy

Implemented by `fallback_policy.FallbackPolicy` — vendor it rather than
re-implementing:

- Timeout **10 s** per request.
- On 5xx / 429 / timeout / connection failure: retry **once** after **2 s**,
  then give up and **fall back to `grep` + `Read`** against the source tree for
  the remainder of the turn. Never block a workflow on RAG.
- On other 4xx: the request itself is wrong — fix it, do **not** retry and do
  not fall back silently.
- `ragq.py` exit codes: `0` ok, `1` request error/degraded, `3` unavailable
  (fall back now).

## 5. Citation format

Cite retrieved context as `[[RAG:<document_filepath>#<chunk_index>@<score>]]`
(e.g. `[[RAG:/repo/docs/watcher.md#3@0.874]]`), produced by
`fallback_policy.format_citation(hit)`. `document_filepath` is host-openable
when the stack runs the same-path `DOCS_PATH` read-only mount (default-on).

## 6. Rate-limit posture

The server does **not** enforce rate limits today (no nginx `limit_req`); a
429 is possible in the future and clients MUST already treat it as retryable
(§4). Client posture: issue queries **serially** per agent, keep `limit` ≤ 10,
and prefer one good query over query fan-out. Do not poll health more than
once per task.

## 7. Version pinning

- `/api/v1/*` is an **additive alias**; `/api/search` is stable and will not
  break (non-breaking guarantee for downstream consumers).
- Pin `/api/v1/search`; on 404/405 fall through to `/api/search` (an older
  server) without consuming a retry — `fallback_policy.search()` does this.
- Schema pinning = tolerate additive fields (§2). Breaking changes, if ever,
  arrive only under a new `/api/v2/` prefix.

## 8. Corpus / project scoping

One stack instance = one corpus. Isolation is per-stack
(`COMPOSE_PROJECT_NAME`, own network, own port band); point
`RAG_ENDPOINT_URL` at the stack that indexes the project you are asking about.
Confirm with `GET /api/status` (`project_name`, `docs_root`) before bulk
querying an unfamiliar endpoint.

Within a single stack, the additive `corpus` request field on search (§2)
narrows hits to documents whose stored `document_filepath` starts with that
prefix (SQL `LIKE '<corpus>%'`); `null`/omitted keeps today's whole-corpus
behavior. It shipped alongside `/api/status`: older servers silently ignore
unknown request fields (§2) and return **unscoped** hits, so when scoping is
load-bearing, confirm `GET /api/status` exists first. CLI:
`ragq.py --corpus PREFIX "query"`.

**Hard rule for consuming projects:** retrieval over HTTP only. Do **not**
integrate rag-bootstrap in-process into a consuming project's runtime
(blacklisted, e.g. researchhub-api).
