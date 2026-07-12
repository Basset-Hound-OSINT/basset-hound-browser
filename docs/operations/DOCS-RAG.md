# Basset Hound Docs-RAG — Usage & Operations

A running RAG instance that indexes this repo's `docs/` tree. Query it to find
and answer questions about the Basset Hound Browser documentation without
reading files by hand.

> **Migrated 2026-07-06 to the rag-bootstrap image-mode + `rag`-CLI model.** The
> instance consumes prebuilt Docker images + a tiny deployment dir it owns; the
> old forked template (`docs/rag-app/`, ~96 MB) was deleted from this repo. All
> data (DB + cache + docs) lives on the **quickiespace** drive via **direct-path
> volumes — no symlink, no root-disk footprint.** Managed by a single `rag` CLI
> (the old `deploy.sh` / `build_images.sh` / `new_consumer.sh` scripts are gone).

- **Base URL:** `http://localhost:10080`
- **Deployment dir (its own dedicated folder on quickiespace, OUTSIDE this repo):**
  `/mnt/quickiespace/rag-instances/basset-hound-docs-rag/` — holds only
  `docker-compose.yml` (image refs), `.env`, `config.yaml`, `client/ragq.py`,
  a local `rag` CLI, `ops/`, `RUN.md`. Zero template source, zero template docs.
- **Data location:** all under `/mnt/quickiespace/rag-instances/basset-hound-docs-rag/data/`
  (postgres/embeddings + docs/cache/logs) — a real directory on the mounted
  drive, **no symlink layer**. Nothing else on quickiespace is touched.
- **Compose project:** `basset-hound-docs-rag` (isolated; do NOT touch the other
  RAG stacks on this host)
- **Corpus:** `/home/devel/basset-hound-browser/docs`
- **Embeddings:** `nomic-embed-text` @ 768 dims (Ollama) · **LLM:** `llama3.2:3b`
- **Images:** `rag-bootstrap-{api,frontend}:0.4.2` — built once, centrally, from
  the canonical template at `~/exudeai/rag-bootstrap` (`rag build`). This
  deployment builds nothing; it only references the pinned image tag.
- **Excluded from the corpus:** `archive/`, `archives/`, `**/deprecated/` (via
  `ingestion.exclude` in `config.yaml`, mounted `:ro` at `/src/config/config.yaml`)
  — keeps superseded docs out of results. Changing the exclude list needs a purge
  + re-ingest (`exclude` blocks ingest but does not delete already-indexed chunks).

> Agents: query this RAG **before** manual doc research (grep + Read over
> `docs/`). One `/api/search` or `/api/ask` call returns the relevant chunks
> with citations. Fall back to grep + Read only if RAG is unreachable.

## Content self-heals — no redeploy, no re-ingest
The stack auto-reconciles every ~300 s: **add / edit / delete / move** a doc
under `docs/` and it is picked up automatically within one interval — no
redeploy, no re-ingest command, no cache clear. Force it now:

```bash
cd /mnt/quickiespace/rag-instances/basset-hound-docs-rag && ./rag sync
# or: curl -X POST http://localhost:10080/api/reconcile -H 'Content-Type: application/json' -d '{}'
```

**Structural changes are different.** Changing the embedding model/dimension or
chunking needs a rebuild: from the deployment dir, `./rag reset` (wipe) then
`./rag up`, then re-ingest (`./rag sync`). Dimension changes hard-fail at
startup, so you cannot silently mismatch.

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
cd /mnt/quickiespace/rag-instances/basset-hound-docs-rag/client
RAG_ENDPOINT_URL=http://localhost:10080 python3 ragq.py "websocket api commands"
RAG_ENDPOINT_URL=http://localhost:10080 python3 ragq.py -n 3 -m semantic --json "forensic capture"
RAG_ENDPOINT_URL=http://localhost:10080 python3 ragq.py --health
```

## Operate the instance — the `rag` CLI

```bash
cd /mnt/quickiespace/rag-instances/basset-hound-docs-rag
./rag status        # service status + health
./rag up            # start (preflight + compose up + dim guard + health gate)
./rag down          # stop (keeps data)
./rag sync          # force an immediate reconcile (freshness)
./rag diagnose      # currency checkup: image mode, self-healing, data-on-drive
./rag logs api      # tail a service's logs
./rag --help        # full command list
```

`docker compose <cmd>` from the same dir still works; `rag` wraps it with the
preflight/health-gate/dim-guard the new model expects.

## Corpus hygiene (0.4.x)

Additive maintenance commands (run from the deployment dir):

```bash
./rag prune                  # DRY-RUN: report soft-expired ghost rows (old versions of edited docs)
./rag prune --apply          # hard-delete those index rows (postgres only; files untouched)
./rag duplication-map        # READ-ONLY near-duplicate document-pair map (cite-not-copy leads)
./rag kb-sources             # READ-ONLY provenance: declared source vs actually-indexed + drift
```

> **Note (corpus quality):** `duplication-map` currently reports **~3,000 near-dup
> pairs** in this corpus (e.g. a `docs/X.md` and its `docs/wiki/findings/x.md` copy,
> or multiple cleanup reports) — a real dedup opportunity for a future pass, since
> duplicates compete in retrieval.

**Line-spans in citations** (`line_start`/`line_end`) populate automatically for
docs added/modified after 0.4.x. Backfilling the *existing* corpus needs
`./rag rechunk --all --apply` — a **destructive full re-embed** (GPU-heavy).
**Deferred** here: single-KB rechunk skips a relative-source KB, and it should only
run with real GPU headroom. Not required for correctness — file paths in citations
are unaffected; only line numbers are absent until backfilled.

## Rebuild / recreate from scratch

The instance holds **only regenerable embeddings** — deleting it loses nothing;
your source docs live in this repo and are never in the instance. To recreate a
clean instance on the drive (from the canonical template):

```bash
# images (once, if not already built on this host):
~/exudeai/rag-bootstrap/rag build
# scaffold a clean image-mode instance with direct-path data on quickiespace:
~/exudeai/rag-bootstrap/rag new-consumer basset-hound-docs-rag 10080 \
  /home/devel/basset-hound-browser/docs --mode single \
  --data-root /mnt/quickiespace/rag-instances/basset-hound-docs-rag/data \
  --tag 0.4.2 --out /mnt/quickiespace/rag-instances/basset-hound-docs-rag
# add config.yaml (archive exclusion) + its :ro mount, then:
cd /mnt/quickiespace/rag-instances/basset-hound-docs-rag && ./rag up   # auto-ingests
```

`~/exudeai/rag-bootstrap/rag migrate` automates moving an OLD deployment to this
clean shape in one command (dry-run by default; `--apply` to execute).

**Ollama note:** the api reaches host Ollama via `host.docker.internal:11434`.
Ollama binds `127.0.0.1`, so a rootless forwarder (`ollama-rag-bridge.service`,
bind `172.17.0.1:11434`) bridges the docker gateway to it. If `./rag diagnose`
shows embeddings unreachable, check that forwarder (`~/exudeai/rag-bootstrap/rag
ollama-forwarder` prints the setup).

Template + full deployment docs: `~/exudeai/rag-bootstrap/docs/deployment/`
(`DEV_MIGRATION_NOTE.md`, `DISTRIBUTION.md`, `CUSTOMIZING_YOUR_INSTANCE.md`,
`IMAGE_CONTRACT.md`, `SELF_HEALING.md`, `MIGRATION.md`).
