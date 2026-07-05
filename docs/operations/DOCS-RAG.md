# Basset Hound Docs-RAG — Usage & Operations

A running RAG instance that indexes this repo's `docs/` tree. Query it to find
and answer questions about the Basset Hound Browser documentation without
reading files by hand.

> **Migrated 2026-07-05 to the rag-bootstrap image-mode model.** The instance
> now consumes prebuilt Docker images + a tiny consumer dir; the old forked
> template (`docs/rag-app/`, ~96 MB) was deleted from this repo. Deployment lives
> **outside** the repo so it no longer pollutes the corpus.

- **Base URL:** `http://localhost:10080`
- **Consumer dir (deployment, OUTSIDE this repo):** `~/rag-consumers/basset-hound-docs-rag`
  — holds only `docker-compose.yml` (image refs), `.env`, `client/ragq.py`,
  `agent_hints/`, `ops/`, `RUN.md`. Zero template source, zero template docs.
- **Compose project:** `basset-hound-docs-rag` (isolated; do NOT touch the other
  RAG stacks on this host)
- **Corpus:** `/home/devel/basset-hound-browser/docs`
- **Embeddings:** `nomic-embed-text` @ 768 dims (Ollama) · **LLM:** `llama3.2:3b`
- **Images:** `rag-bootstrap-{api,frontend}:0.3.0` — built from the canonical
  template at `~/exudeai/rag-bootstrap` (`scripts/build_images.sh`).

> Agents: query this RAG **before** manual doc research (grep + Read over
> `docs/`). One `/api/search` or `/api/ask` call returns the relevant chunks
> with citations. Fall back to grep + Read only if RAG is unreachable.

## Content self-heals — no redeploy, no re-ingest
The stack auto-reconciles every ~300 s: **add / edit / delete / move** a doc
under `docs/` and it is picked up automatically within one interval — no
redeploy, no re-ingest command, no cache clear (GPU-free on unchanged files;
fail-soft). Force it now:

```bash
curl -X POST http://localhost:10080/api/reconcile -H 'Content-Type: application/json' -d '{}'
```

**Structural changes are different.** Changing the embedding model/dimension or
chunking needs a deliberate rebuild — from the consumer dir:
`docker compose down -v && docker compose up -d`, then re-ingest
(POST `/api/reconcile`). Dimension changes hard-fail at startup, so you cannot
silently mismatch.

## Query — HTTP API (the source of truth)

```bash
# search — JSON list of chunk hits; mode = semantic | keyword | hybrid (default)
curl -s -X POST http://localhost:10080/api/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"forensic chain of custody","limit":5,"mode":"semantic"}'

# ask — grounded answer + cited sources
curl -s -X POST http://localhost:10080/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"What is out of scope for the browser?","limit":5}'

# health + index freshness
curl -s http://localhost:10080/api/health
curl -s http://localhost:10080/health/index
```

**Score note:** `mode:"semantic"` → `score` is cosine (~0.5–0.9 when on-topic).
Default `hybrid` → `score` is a fused RRF rank (~0.01, not a similarity); the
true cosine is the separate `cosine` field.

## Query — shipped CLI client

```bash
cd ~/rag-consumers/basset-hound-docs-rag/client
RAG_ENDPOINT_URL=http://localhost:10080 python3 ragq.py "websocket api commands"
RAG_ENDPOINT_URL=http://localhost:10080 python3 ragq.py -n 3 -m semantic --json "forensic capture"
RAG_ENDPOINT_URL=http://localhost:10080 python3 ragq.py --health
```

## Operate the instance

```bash
cd ~/rag-consumers/basset-hound-docs-rag
docker compose ps                 # status
docker compose up -d              # start
docker compose down               # stop (keep the index)
docker compose down -v            # stop + wipe index (safe: only regenerable
                                  #   embeddings; your docs are never touched)
docker compose logs -f api        # tail api logs
```

## Rebuild / recreate from scratch

The instance holds **only regenerable embeddings** — deleting it loses nothing;
your source docs live in this repo and are never in the instance. To recreate:

```bash
cd ~/rag-consumers/basset-hound-docs-rag && docker compose down -v
bash ~/exudeai/rag-bootstrap/scripts/new_consumer.sh basset-hound-docs-rag <free-port> \
  /home/devel/basset-hound-browser/docs --mode single --tag 0.3.0 \
  --out ~/rag-consumers/basset-hound-docs-rag
cd ~/rag-consumers/basset-hound-docs-rag && docker compose up -d   # auto-ingests
```

Template + full deployment docs: `~/exudeai/rag-bootstrap/docs/deployment/`
(`MIGRATION.md`, `DEV_NOTE_2026-07-05.md`, `DISTRIBUTION.md`, `SELF_HEALING.md`).
