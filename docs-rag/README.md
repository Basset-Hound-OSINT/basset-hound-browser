# docs-rag/ — version-controlled config snapshot of the Docs-RAG deployment

This folder is a **reference copy of the configuration** for this repo's docs-RAG
instance, so the exact setup is version-controlled and reconstructable even if the
out-of-repo deployment dir is lost. It is **not** the running instance and is not
what serves queries.

- **Live deployment (runs from here, outside the repo):**
  `/mnt/quickiespace/rag-instances/basset-hound-docs-rag/`
- **Usage & operations doc:** [../docs/operations/DOCS-RAG.md](../docs/operations/DOCS-RAG.md)
- **Canonical template that builds the images + CLI:** `~/exudeai/rag-bootstrap`

## What's in here (and what's deliberately not)

| Included | Why |
|---|---|
| `docker-compose.yml` | the exact service topology / ports / volume paths / image pins |
| `config.yaml` | **the custom archive-exclusion rules** (mounted `:ro` in the api) |
| `.env.example` | the full env, **DB password redacted** — the one secret |
| `RUN.md`, `VERSION` | ops notes + pinned version (0.4.2) |
| `client/` | the shipped query client (`ragq.py`) |

| **Not** included | Why |
|---|---|
| `data/` (88 MB) | postgres/redis/embeddings/cache/logs — regenerable from `docs/` |
| real `.env` | holds `POSTGRES_PASSWORD`; lives only in the deployment dir (mode 600) |
| `scripts/`, `rag` CLI | template-owned — regenerated from `~/exudeai/rag-bootstrap`, not re-forked here (we deleted the old 96 MB `docs/rag-app/` fork on purpose) |

## Rebuild the deployment from this snapshot

```bash
# 1. Build the pinned images once on the host (from the canonical template):
~/exudeai/rag-bootstrap/rag build            # produces rag-bootstrap-{api,frontend}:0.4.2

# 2. Scaffold a clean image-mode instance with direct-path data on quickiespace:
~/exudeai/rag-bootstrap/rag new-consumer basset-hound-docs-rag 10080 \
  /home/devel/basset-hound-browser/docs --mode single \
  --data-root /mnt/quickiespace/rag-instances/basset-hound-docs-rag/data \
  --tag 0.4.2 --out /mnt/quickiespace/rag-instances/basset-hound-docs-rag

# 3. Drop this snapshot's config over the scaffold, set a real secret:
cp docker-compose.yml config.yaml /mnt/quickiespace/rag-instances/basset-hound-docs-rag/
cp .env.example /mnt/quickiespace/rag-instances/basset-hound-docs-rag/.env
#   -> edit that .env: set POSTGRES_PASSWORD to a fresh `openssl rand -hex 24`
#   -> ensure config.yaml is mounted :ro at /src/config/config.yaml in the compose

# 4. Bring it up (auto-ingests the corpus):
cd /mnt/quickiespace/rag-instances/basset-hound-docs-rag && ./rag up
```

## Keep this snapshot in sync

It's a snapshot, so it drifts if the live config changes. After editing the live
`docker-compose.yml` / `config.yaml` / `.env`, refresh the copies here:

```bash
D=/mnt/quickiespace/rag-instances/basset-hound-docs-rag
cp "$D/docker-compose.yml" "$D/config.yaml" "$D/RUN.md" "$D/VERSION" docs-rag/
# then re-redact the DB password into .env.example if the env changed
```

## Gotchas worth remembering

- **`./rag reset` does NOT wipe this deployment.** It runs `docker compose down -v`,
  but `-v` only drops *named* volumes; our postgres/redis are **direct-path bind
  mounts**, so the data survives. To force a full re-chunk/re-embed:
  `docker compose exec -T postgres psql -U raguser -d ragdb -c "TRUNCATE chunks, documents RESTART IDENTITY CASCADE;"`
  then `curl -X POST http://localhost:10080/api/reconcile -d '{}'`.
- **Ollama forwarder:** host Ollama binds `127.0.0.1`; containers reach it only via
  `ollama-rag-bridge.service` (bind `172.17.0.1`). If embeddings are unreachable,
  check that forwarder.
