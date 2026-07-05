# Live Smoke Report — rag-bootstrap single-corpus deployment

- **Date**: 2026-07-03 (20:12–20:20 EDT)
- **Agent**: deployer@exudeai:rag-bootstrap:live-smoke-2
- **Scope**: core single-corpus stack only (monitoring overlay NOT in scope)
- **Isolation**: `docker compose -p ragsmoke --env-file <scratchpad>/ragsmoke.env` — repo `.env` (user-owned, `COMPOSE_PROJECT_NAME=rag-bootstrap`) never touched; no commits; no repo writes except this report
- **Verdict**: **PASS** — doctor 8/8, stack up in 12s, all endpoints green, ingest + idempotent re-ingest clean, search returns correct hits with `x-chunk-bytes` header, exactly one host port published, full teardown verified

## 0. Preconditions

- Resources at start: 11Gi mem available / 31Gi, load 5.68 on 16 cores, 44G disk free — under the 80% ceiling throughout.
- Ollama reachable at `http://localhost:11434` (`curl /api/tags` exit 0) with **nomic-embed-text:latest** (F16, 768-dim) and llama3.2:3b pulled. Ollama also listens on **172.17.0.1:11434** (docker-bridge forwarder), so `host.docker.internal` works from containers.
- Port band 10000–10019: zero listeners (`ss -ltnH` scan empty).
- Leftover artifacts from a prior smoke instance found and reused: `data/docs/smoke_doc_{one,two}.md` (created 19:45 today, content references "ragsmoke live deployment check"). No `data/docker/` existed — no DB state at risk. Prior instance also left the repo `.env` (19:25) — left in place.

## 1. `./deploy.sh doctor` — PASS (exit 0)

```
[OK]    Config file: /home/devel/exudeai/rag-bootstrap/config/config.yaml
[OK]    .env present: /home/devel/exudeai/rag-bootstrap/.env

Effective configuration
=======================
  Config file:      /home/devel/exudeai/rag-bootstrap/config/config.yaml
  Compose project:  rag-bootstrap
  Network:          rag-multi-kb-network
  Web port:         10000  (base: 10000)
  Embedding:        nomic-embed-text / 768 / ollama
  LLM:              llama3.1:70b
  Ollama URL:       http://host.docker.internal:11434

[OK]    Docker daemon reachable
[OK]    RAG_PORT 10000 is free
[OK]    Ollama reachable at http://localhost:11434
[OK]    Embedding model 'nomic-embed-text' is pulled
[WARN]  LLM model 'llama3.1:70b' is not pulled (search works; Q&A/chat will fail)
[OK]    Disk space OK (35 GB available)
[INFO]  Dimension guard: no stored embeddings yet (nothing to check)
[OK]    Doctor: all checks passed
```

Config resolution, echo, Ollama reachability, embedding model, port-band, disk, and dim-guard all exercised. The single WARN (llama3.1:70b not pulled) is non-blocking by design; the smoke env-file set `LLM_MODEL=llama3.2:3b` (pulled) so the health LLM component reflects a reachable model.

## 2. Stack up — PASS (API ready in 12s)

`docker compose -p ragsmoke --env-file <scratchpad>/ragsmoke.env build` → exit 0 (layers largely cached). `up -d` inside a trap-guarded script (`down -v --remove-orphans` on ERR):

```
Container ragsmoke-redis-1     Healthy
Container ragsmoke-postgres-1  Healthy
Container ragsmoke-api-1       Started
Container ragsmoke-frontend-1  Started
API_READY after 12s
SERVICE    STATUS                    PORTS
api        Up 14 seconds             8000/tcp
frontend   Up 13 seconds             127.0.0.1:10000->80/tcp
postgres   Up 20 seconds (healthy)   5432/tcp
redis      Up 20 seconds (healthy)   6379/tcp
```

## 3. Endpoints through the ONE published port — PASS (all HTTP 200)

```
GET /api/health   -> {"status":"healthy","database":true,"redis":true,"embedding_service":true,"llm":true,"deep":null,"deep_ok":null}
GET /api/status   -> {"project_name":"ragsmoke","docs_root":"/home/devel/exudeai/rag-bootstrap/data/docs","documents":2,"chunks":2,"embedding_model":"nomic-embed-text","dimension":768,...}
GET /health/index -> {"indexed_at":null,"indexed_commit_sha":null,"corpus_bytes":275,"chunks":2,"documents":2,"source_root":"/home/devel/exudeai/rag-bootstrap/data/docs","staleness_class":"unindexed"}
```

Bonus observation: the **auto-ingest watcher worked** — documents=2/chunks=2 appeared before any explicit POST (watcher created docs at 00:17:24Z, first explicit job ran 00:17:46Z).

## 4. Ingest + idempotent re-ingest — PASS

`POST /api/ingest/directory {"path": "/home/devel/exudeai/rag-bootstrap/data/docs"}` (2-file corpus), twice:

| | HTTP | job_id | terminal status | documents_ingested | errors |
|---|---|---|---|---|---|
| Ingest #1 | 202 | 13752b14… | completed (in 0.05s) | 2 | none |
| Ingest #2 (re-run) | 202 | 4dc43aae… | completed (in 0.02s) | 2 | none |

Idempotency evidence: both jobs returned the **same document ids (1, 2)** with **identical created_at/updated_at** (2026-07-04T00:17:24Z — the watcher's original ingest), and `/api/status` afterward still shows `documents: 2, chunks: 2`. No duplicates, no dup-key errors. The ingest-root guard (`RAG_INGEST_ROOT_GUARD=on`, `DOCS_PATH=<repo>/data/docs`) accepted the in-root path as expected.

## 5. Search — PASS (with one task-spec mismatch, see Finding 1)

`GET /api/v1/search?q=...` → **405 Method Not Allowed, `allow: POST`**. The route is POST-only: `app/main.py:733-735` (`@app.post("/api/search")` / `@app.post("/api/v1/search")`, body schema `SearchRequest` at `app/main.py:221`). Re-run as POST:

```
POST /api/v1/search {"query":"Zephyrium reactor coolant manifold pressure","limit":3}
HTTP/1.1 200 OK
x-chunk-bytes: 273        <- header present (set at app/main.py:762)
top hit: smoke_doc_one.md  cosine 0.8216  "The Zephyrium reactor coolant manifold operates at 42 kilopascals..."

POST /api/v1/search {"query":"quokka migration schedule","limit":3}
top hit: smoke_doc_two.md  cosine 0.8265  "Document two: the quokka migration schedule lists Tuesday departures..."
```

Both queries return the correct document as top hit with strong cosine separation (0.82 vs 0.34/0.42 for the off-topic doc).

## 6. Single-port exposure — PASS

```
docker ps (ragsmoke):   frontend  127.0.0.1:10000->80/tcp   <- ONLY published mapping
                        api 8000/tcp, postgres 5432/tcp, redis 6379/tcp (internal only)
ss -ltn 10000-band:     LISTEN 127.0.0.1:10000              <- exactly one listener, loopback-bound
```

## 7. Teardown + cleanup — PASS

- `docker compose -p ragsmoke ... down -v --remove-orphans` → exit 0; 0 ragsmoke containers remain; port 10000 released (ss shows 0 listeners); `ragsmoke-net` + `ragsmoke_default` networks removed.
- Root-owned runtime data (`data/docker`, `data/cache`, `data/logs`, `data/exports`, `data/registry`, `data/docs/archive`) wiped via throwaway `alpine:3.20` container; smoke corpus files removed. `data/` now contains only an empty `docs/`.
- `ragsmoke-api` / `ragsmoke-frontend` images removed.
- `git status` matches the pre-existing W67-era drift snapshot — this smoke added no tree changes beyond this report.

## Findings (no fixes applied)

1. **Task-spec vs API mismatch (informational, not a code defect)**: the smoke contract said `GET /api/v1/search?q=...`, but the API only accepts **POST** with a JSON body (`app/main.py:733-735`; GET → 405 with `allow: POST`). If a GET convenience alias is intended anywhere (docs/clients), either add `@app.get("/api/v1/search")` mapping `q`→`SearchRequest.query`, or fix the calling contract. Hypothesis location if an alias is desired: alongside `app/main.py:733`.
2. **Prior smoke instance left artifacts**: repo `.env` (19:25) and `data/docs/smoke_doc_*.md` (19:45) predated this run — a live-smoke-1 apparently exited without cleanup. This run reused then removed the corpus; the `.env` was left as-is (user-owned config surface; also plausibly intentional multi-kb config given `PROJECT_NAME=rag-bootstrap-multi-kb`).
3. **Citation filepaths are container paths when the watcher ingests first**: search hits report `document_filepath: /data/docs/...` (watcher mount) rather than the host-openable same-path form, because the watcher raced ahead of the explicit same-path ingest. The same-path `:ro` mount design (docker-compose.yml:204) only yields host-openable citations for documents first ingested via the host-path POST. Minor UX nuance, worth a note in docs.

## Captured environment deltas

- Env-file used (scratchpad, not in repo): COMPOSE_PROJECT_NAME=ragsmoke, RAG_NETWORK_NAME=ragsmoke-net, RAG_PORT=10000, canonical embedding triple, LLM_MODEL=llama3.2:3b, DOCS_PATH=/home/devel/exudeai/rag-bootstrap/data/docs, RAG_INGEST_ROOT_GUARD=on, WATCHER_ARCHIVE_MODE=off.
- Resources at end: 12Gi available, load ~9.3/16 cores (transient build/teardown spike), all ragsmoke resources released.
