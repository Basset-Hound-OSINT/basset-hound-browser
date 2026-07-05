# RAG Bootstrap — Troubleshooting

**Last Updated**: 2026-07-03

First move for almost any problem: `./deploy.sh doctor`. It checks config
resolution, `.env` presence, the effective resolved config, Docker daemon,
`RAG_PORT` free/occupied, Ollama reachability + model pulled, disk space, and
the stored-vs-configured embedding dimension — and exits non-zero on failure.

---

## 1. Ollama unreachable / embedding model missing

**Symptoms**: `deploy.sh start` preflight fails; ingest returns embedding
errors; `./deploy.sh health` shows `Embedding Service: ✗`.

Ollama is an **external hard prerequisite** — the stack does not run its own
Ollama container. Both must be true before first start:

```bash
# 1. Ollama running (host or reachable remote)
curl -s http://localhost:11434/api/tags | head -c 200

# 2. Embedding model pulled
ollama pull nomic-embed-text
```

`./deploy.sh doctor` verifies both. Containers reach the host's Ollama via
`OLLAMA_BASE_URL` (default `http://host.docker.internal:11434`, resolved
through the compose `host-gateway` extra_host).

**Connectivity modes** (see `./deploy.sh ollama-forwarder` for the full text):

1. **Local** (default): Ollama on this host. If it binds `127.0.0.1` only,
   containers CANNOT reach it — use the rootless forwarder below, or set
   `OLLAMA_HOST=0.0.0.0` on the Ollama service (wider exposure).
2. **Remote**: point `OLLAMA_BASE_URL` at the remote host directly.
3. **SSH bridge**: `ssh -N -L 11434:localhost:11434 user@gpu-box`, then mode 1.

**Loopback-only Ollama, no root** — run the rootless TCP forwarder that
relays the Docker bridge address to loopback (requires `socat`):

```bash
socat TCP-LISTEN:11434,bind=172.17.0.1,fork,reuseaddr TCP:127.0.0.1:11434
```

`./deploy.sh ollama-forwarder` prints this plus a persistent
systemd `--user` unit template (`rag-ollama-forward.service`) and the
`loginctl enable-linger` step to survive logout.

---

## 2. Port collisions (and what auto-increment does)

**Symptoms**: `Bind for 127.0.0.1:10000 failed: port is already allocated`,
or the stack comes up on an unexpected port.

- The web UI publishes exactly ONE port, `RAG_PORT` (default **10000**, from
  `RAG_PORT_BASE=10000`). Monitoring services use base+10..+16 (see the port
  table in README.md / `.env.example`).
- `deploy.sh start` preflights the resolved `RAG_PORT` (`ss -ltn`/`lsof`)
  **before** `docker compose up`. If the port is held by another process it
  **auto-selects the next free port in the band** (+1..+19) and writes the new
  `RAG_PORT` into `.env` — watch the `Auto-selected free port NNNNN` warning
  to learn where the UI actually is. If the whole band is busy it fails fast.
- A busy port held by **this stack's own frontend** is fine (restart case);
  doctor and preflight both recognize it.
- To pin a specific port: set `network.port` in `config/config.yaml` or
  `RAG_PORT` in `.env`. Second instances / downstream apps should use
  **10020 and up** (this stack reserves 10000-10019).

---

## 3. Embedding dimension mismatch (guard + reset)

**Symptoms**:
`Embedding dimension mismatch: database stores 384, config wants 768` (deploy),
or the API refuses startup with the same message; historically
`DataError: expected 384 dimensions, not 768` on ingest.

The pgvector column width is fixed at first ingest. Changing the embedding
model/dimension afterwards cannot work against the stored vectors, so two
guards refuse to run instead of corrupting data:

- **deploy-side**: `dim_guard` runs after `compose up` (fatal on `start`,
  reported by `doctor`), comparing the stored dimension against the config.
- **app-side**: the API's startup check reads the `rag_meta` row and refuses
  to start when `meta.dimension != EMBEDDING_DIMENSION`. A model change at the
  SAME dimension only warns (scores degrade until re-index).

**Fix** — either restore the old triple (`EMBEDDING_DIMENSION=<stored>` plus
its matching model), or wipe and re-index:

```bash
./deploy.sh reset          # wipes DB/cache/logs (handles root-owned files)
./deploy.sh start --build
./deploy.sh ingest
```

Keep the canonical triple (`nomic-embed-text` / 768 / `ollama`) consistent
across `.env`, `config/config.yaml`, and compose — change all three together.

---

## 4. Ghost containers, orphaned networks, root-owned data

**Symptoms**: bring-up fails because leftover containers/networks from a
previous aborted run still hold names/ports; `rm -rf data` fails with
`Permission denied`.

- **Failed starts clean up after themselves**: the start path traps failures
  and tears down orphans; if anything survives, it prints the exact command
  (`docker compose down --remove-orphans`).
- **Root-owned data**: the postgres/redis bind mounts under `data/docker/` are
  written as the container UID, so a plain user `rm -rf` fails.
  `./deploy.sh reset` (and `clean`) wipe them via a **throwaway root
  container** (`docker run --rm -v ./data:/wipe alpine …`) — no sudo needed.
- **Manual sweep** when things are really stuck:

```bash
docker compose down -v --remove-orphans
docker network ls | grep <your-network-name>   # then: docker network rm <id>
./deploy.sh reset
```

- `./deploy.sh doctor` before the next start confirms port, Docker, Ollama,
  and dimension state are all clean.

---

## 5. "Why can't I reach postgres/redis/the API directly?" (network isolation)

By design. Only nginx publishes a port (`127.0.0.1:${RAG_PORT}` → 80).
PostgreSQL (5432), Redis (6379), and the FastAPI service (8000) live on the
isolated Docker bridge network (`RAG_NETWORK_NAME`) with **no `ports:`
sections** — they are unreachable from the host and from other networks.
Nginx proxies `/api/*` to the internal API. Monitoring ports (10010-10016) are
also bound to `127.0.0.1` only.

To poke inside anyway:

```bash
docker compose exec postgres psql -U raguser ragdb
docker compose exec redis redis-cli
docker compose exec api curl -s http://localhost:8000/api/health
```

---

## 6. Multiple stacks on one host (collisions, wrong corpus)

**Symptoms**: bring-up attaches to the wrong stack; two instances share a
network/volume namespace; a query endpoint answers from a **different
project's corpus**.

Isolation is by `.env` — each instance needs its own:

- `COMPOSE_PROJECT_NAME` — UNIQUE per instance. Compose prefixes every
  container/network/volume with it; the compose files intentionally have no
  `container_name:` lines, so names never collide globally.
- `RAG_NETWORK_NAME` — instance-unique network (deploy.sh auto-increments on
  conflict).
- `RAG_PORT` / band — give each instance its own +20 band (10000-10019,
  10020-10039, …).

`deploy.sh` **preserves** a customized `.env` (merge/append only — it never
clobbers isolation keys you set).

**Verify you're talking to the right corpus before trusting results**:

```bash
curl -s http://localhost:10000/api/status
# → {"project_name": …, "docs_root": …, "documents": N, "chunks": M,
#    "embedding_model": …, "dimension": …, "indexed_at": …}
```

Two guards keep corpora honest:

- **Ingest-root guard** (`RAG_INGEST_ROOT_GUARD=on`, active when `DOCS_PATH`
  is set): directory ingests outside the configured docs root are rejected
  with `400`, so a stray foreign-path ingest can't silently pollute the DB.
- **Index freshness**: `GET /health/index` returns `indexed_at`,
  `indexed_commit_sha`, and a `staleness_class`
  (`unindexed`/`fresh`/`aging`/`stale`) so consumers know whether to trust
  the index.

**Citations show container paths (`/data/docs/…`) instead of host paths**: the
auto-ingest watcher can race ahead of your explicit host-path POST — files
dropped into the watch directory are ingested under the watcher's container
mount (`/data/docs`), and the later same-path ingest dedupes against those
rows, so the stored `document_filepath` stays a container path rather than the
host-openable `DOCS_PATH` form. Workaround: POST `/api/ingest/directory` with
the host path FIRST (before the files land in the watch dir), or disable the
watcher (`WATCHER_ENABLED=false`) on deploys that only use explicit ingest.
(Observed in the 2026-07-03 live smoke, Finding 3.)

---

## Related docs

- [PERFORMANCE.md](PERFORMANCE.md) — throughput, chunking, and monitoring
- [deployment/INFRASTRUCTURE_DIAGNOSTICS.md](deployment/INFRASTRUCTURE_DIAGNOSTICS.md) — deeper infra root-cause procedures
- [integration/CONSUMING_AGENTS_CONTRACT.md](integration/CONSUMING_AGENTS_CONTRACT.md) — consumer-side health/fallback policy
