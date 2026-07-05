# Basset Hound Docs-RAG — Usage Reference

A running RAG instance indexing this repo's `docs/` tree. Query it to find and
answer questions about the Basset Hound Browser documentation without reading
files by hand.

- **Base URL:** `http://localhost:10021`
- **Compose project:** `basset-hound-docs-rag` (isolated; do not touch the other
  RAG stacks on this host)
- **Corpus:** `/home/devel/basset-hound-browser/docs` — **2014 documents /
  17738 chunks** (as of last ingest)
- **Embeddings:** `nomic-embed-text` @ 768 dims (Ollama) · **Generation LLM:**
  `llama3.2:3b`

> Agents: query this RAG **before** doing manual doc research (grep + Read over
> `docs/`). One `/api/search` or `/api/ask` call returns the relevant chunks
> with citations and saves the tokens you'd spend crawling files. Only fall back
> to grep + Read if RAG is unreachable (see `client/fallback_policy.py`).

---

## 1. Search — `POST /api/search`

Returns a JSON **list** of chunk hits. Body fields: `query` (required),
`limit` (default 10), `mode` (`semantic` | `keyword` | `hybrid`, default
`hybrid`), optional `rerank` (bool) and `corpus` (filepath prefix).

```bash
curl -s -X POST http://localhost:10021/api/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"bot detection evasion gaps","limit":5,"mode":"semantic"}'
```

Each hit includes: `document_filename`, `document_filepath`, `chunk_index`,
`content`, and score fields. **Read the score correctly:**

- `mode: "semantic"` → `score` == `cosine` (cosine similarity, ~0.5–0.9 when
  on-topic). Use this mode when you want an interpretable relevance number.
- `mode: "hybrid"` (default) → `score` is a fused RRF rank (~0.01, **not** a
  similarity); the true cosine is still in the separate **`cosine`** field.

Pull just the top hit's file + cosine:

```bash
curl -s -X POST http://localhost:10021/api/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"forensic chain of custody","limit":5,"mode":"semantic"}' \
  | python3 -c "import sys,json;h=json.load(sys.stdin)[0];print(h['document_filepath'], round(h['cosine'],3))"
```

## 2. Ask (grounded QA) — `POST /api/ask`

RAG-generates an answer from retrieved chunks and cites the source files.
Body: `question` (required), `limit` (default 5), `mode` (default `hybrid`),
optional `system_prompt`, `rerank`. Returns `{answer, model, sources[]}`.
Streaming variant: `POST /api/ask/stream`.

```bash
curl -s -X POST http://localhost:10021/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"What is out of scope for the Basset Hound Browser?","limit":5}'
```

Answer is grounded in `SCOPE-DEFINITION.md` / `CLEANUP-PLAN.md` etc., with each
source's `document_filename` and `cosine` in the `sources` array.

## 3. Health & status endpoints

```bash
curl -s http://localhost:10021/api/status        # docs/chunks count, model, indexed_at
curl -s http://localhost:10021/api/health         # {status, database, redis, embedding_service, llm}
curl -s http://localhost:10021/health/index       # freshness: indexed_at, staleness_class, counts
curl -s http://localhost:10021/api/models         # available Ollama models + current LLM
curl -s http://localhost:10021/api/watcher/status # ingest watcher queue state
```

---

## 4. Shipped CLI client — `client/ragq.py`

Stdlib-only (no installs). Point it at this instance with `RAG_ENDPOINT_URL`.
Run from `docs/rag-app/client/` (it imports `fallback_policy.py` alongside it).

```bash
cd docs/rag-app/client

# formatted hits (human-readable citations + snippets)
RAG_ENDPOINT_URL=http://localhost:10021 python3 ragq.py "forensic chain of custody"

# top-3, semantic mode, raw JSON
RAG_ENDPOINT_URL=http://localhost:10021 python3 ragq.py -n 3 -m semantic --json "WebSocket API commands"

# scope hits to a subtree
RAG_ENDPOINT_URL=http://localhost:10021 python3 ragq.py --corpus /home/devel/basset-hound-browser/docs/findings "evasion gaps"

# probes (exit 0 healthy / 1 degraded / 3 unreachable)
RAG_ENDPOINT_URL=http://localhost:10021 python3 ragq.py --health
RAG_ENDPOINT_URL=http://localhost:10021 python3 ragq.py --index-health
```

Flags: `-n/--limit N`, `-m/--mode semantic|keyword|hybrid` (default hybrid),
`--rerank/--no-rerank`, `--corpus PREFIX`, `--json`, `--content-chars N`,
`--endpoint URL`, `--health`, `--index-health`.

To vendor the client into another project, copy `ragq.py` + `fallback_policy.py`
together and set `RAG_ENDPOINT_URL=http://localhost:10021`.

---

## 5. Operate the instance — `deploy.sh` (run from `docs/rag-app/`)

`deploy.sh` reads `.env` (`COMPOSE_PROJECT_NAME=basset-hound-docs-rag`,
`RAG_PORT=10021`), so every command targets **this** instance only.

```bash
cd docs/rag-app

./deploy.sh doctor    # preflight diagnostics: config, ports, Ollama, disk, embedding dims
./deploy.sh status    # service + health summary
./deploy.sh start     # start all services (add --build to rebuild images)
./deploy.sh ingest    # (re)ingest docs from config/config.yaml directories
./deploy.sh ingest /home/devel/basset-hound-browser/docs   # ingest a specific path
./deploy.sh health    # detailed health check
./deploy.sh logs api  # tail a service's logs
./deploy.sh restart   # restart all services
```

Ingestion directories and search/LLM settings live in `config/config.yaml`.
Re-run `./deploy.sh ingest` after docs change to refresh the index; check
`GET /health/index` `staleness_class` to confirm freshness.
