# RAG Bootstrap

**Status**: Production-Ready | **Version**: 1.0.0 | **Last Updated**: 2026-07-03

Universal solution for spinning up custom RAG applications with document ingestion and a web-based chat interface. Features real-time streaming responses, automatic document ingestion, and multi-search modes.

> **Hard prerequisite**: an external Ollama server with the embedding model pulled
> (`ollama pull nomic-embed-text`). The stack does NOT run its own Ollama and does
> NOT bundle sentence-transformers — embeddings default to
> `nomic-embed-text` / 768 dims / `ollama`. Run `./deploy.sh doctor` to verify.

## 3-Step Setup for Developers

Copy this RAG system into your project and customize in 3 steps:

1. **Change the network name** in [config/config.yaml](config/config.yaml):
   ```yaml
   network:
     name: myproject-rag  # Change "rag-bootstrap" to your project name
   ```

2. **Change the port** (if needed) in [config/config.yaml](config/config.yaml):
   ```yaml
   network:
     port: 10020  # Default is 10000; this stack reserves 10000-10019, downstream apps take 10020+
   ```

3. **Configure your document folders** in [config/config.yaml](config/config.yaml):
   ```yaml
   ingestion:
     directories:
       - ./data/docs               # Scanned recursively (default — matches DOCS_PATH)
       - /path/to/your/knowledge   # Add multiple paths — each must live under DOCS_PATH
   ```
   Host paths only (no container paths like `/data/docs`), and every entry
   must be equal to or under `DOCS_PATH` (default `<repo>/data/docs`) — the
   default-on ingest-root guard rejects anything else with `400`.

That's it! Run `./deploy.sh start --build` and access at `http://localhost:{port}`

### Copying Into Your Project

To integrate RAG into your existing project:

```bash
# Copy the entire rag-bootstrap directory into your project
cp -r rag-bootstrap /path/to/your/project/

# Navigate to the copied directory
cd /path/to/your/project/rag-bootstrap

# Customize config/config.yaml (network name, port, ingestion paths)
nano config/config.yaml

# Preflight: Ollama reachable, model pulled, port free, disk space, dims
./deploy.sh doctor

# Start the RAG stack
./deploy.sh start --build

# Ingest your documents
./deploy.sh ingest
```

The RAG system runs completely isolated in Docker containers and only exposes one port to your localhost.

### Security Benefits

✅ **Single Port Architecture** - Only ONE port exposed to localhost (default: 10000)
✅ **Localhost-Only Binding** - Not accessible from external networks (127.0.0.1)
✅ **No Port Whack-a-Mole** - PostgreSQL, Redis, and API communicate internally via Docker network
✅ **Automatic Validation** - `deploy.sh` warns if you accidentally expose internal services
✅ **Isolated Networks** - Each project instance uses its own Docker network

## Quick Start

```bash
# Pull the embedding model (HARD prerequisite — deploy refuses without it)
ollama pull nomic-embed-text

# Optional but recommended: preflight everything before building
./deploy.sh doctor

# Start all services (builds containers first time)
./deploy.sh start --build

# Access the web UI at http://localhost:10000

# Ingest documents (uses paths from config.yaml)
./deploy.sh ingest

# Or ingest from a specific directory
./deploy.sh ingest /path/to/your/docs

# Stop services
./deploy.sh stop
```

## Features

### User Experience
- **Web UI**: ChatGPT-inspired chat interface with VS Code-styled document sidebar
- **Copy functionality**: Copy individual messages or entire conversation
- **Search modes**: Toggle between hybrid, semantic, and keyword search
- **YAML config**: Easy configuration via [config/config.yaml](config/config.yaml)

### Security & Deployment
- **Single port exposure**: Only ONE port to localhost (default: 10000, configurable)
- **Localhost-only binding**: Bound to 127.0.0.1, not accessible from network
- **Isolated Docker network**: All internal services (postgres:5432, redis:6379, api:8000) communicate via private network
- **Auto-validation**: Deployment script warns if you expose additional ports
- **Multi-instance support**: Auto-naming to avoid conflicts (rag-bootstrap, rag-bootstrap-1, etc.)
- **Recursive ingestion**: All document folders scanned recursively, including subdirectories

## Deploy Script Commands

```bash
./deploy.sh doctor            # Preflight: config, port, Ollama + model, disk, dims
./deploy.sh start [--build]   # Start services (--build to rebuild)
        [--defaults]          #   allow start without a config file
        [--skip-preflight]    #   skip the Ollama reachability/model preflight
./deploy.sh stop              # Stop all services
./deploy.sh restart           # Restart services
./deploy.sh ingest [path...]  # Ingest documents
./deploy.sh status            # Show service status
./deploy.sh logs [service]    # View logs
./deploy.sh health            # Check system health
./deploy.sh reset             # Wipe ALL data for fresh re-init (handles root-owned files)
./deploy.sh clean             # Stop and remove all data
./deploy.sh ollama-forwarder  # Print rootless Ollama TCP-forwarder + systemd --user unit
```

## Architecture

### Single-Port Security Model

```
┌─────────────────────────────────────────────────────────────┐
│ Host Machine (127.0.0.1)                                    │
│                                                              │
│  Browser → http://localhost:10000 (ONLY exposed port)       │
│                      ↓                                       │
│             ┌────────────────┐                               │
│             │  Nginx:80      │ ← Frontend + Reverse Proxy   │
│             │  (container)   │                               │
│             └────────┬───────┘                               │
│                      │                                       │
│    ┌─────────────────┴────────────────┐ Docker Network      │
│    │                                  │ (rag-bootstrap)      │
│    │  /api/* → FastAPI:8000          │ Internal Only        │
│    │           ↓                      │                      │
│    │  ┌─────────────────┐             │                      │
│    │  │ FastAPI:8000    │             │                      │
│    │  │ (container)     │             │                      │
│    │  └────┬────────┬───┘             │                      │
│    │       │        │                 │                      │
│    │  ┌────↓─────┐  │                 │                      │
│    │  │PostgreSQL│  │                 │                      │
│    │  │  :5432   │  │                 │                      │
│    │  └──────────┘  │                 │                      │
│    │                │                 │                      │
│    │           ┌────↓────┐            │                      │
│    │           │ Redis   │            │                      │
│    │           │  :6379  │            │                      │
│    │           └─────────┘            │                      │
│    └──────────────────────────────────┘                      │
└──────────────────────────────────────────────────────────────┘

Key: ✅ = Exposed to host | 🔒 = Internal only
```

**Services:**
- 🔒 **PostgreSQL 16 + pgvector** - Vector storage + metadata (internal only)
- 🔒 **Redis 7** - Embedding cache (internal only)
- 🔒 **FastAPI + Uvicorn** - REST API (internal only, proxied via nginx)
- ✅ **Nginx** - Reverse proxy + static frontend (ONLY port 10000 exposed to localhost)

**Network Isolation:**
- All services communicate via isolated Docker bridge network
- No direct access to postgres:5432, redis:6379, or api:8000 from host
- Nginx proxies `/api/*` requests to internal FastAPI service
- External services (like Ollama) accessed via `host.docker.internal`

## Configuration

Edit [config/config.yaml](config/config.yaml) to configure:

```yaml
# ────────────────────────────────────────────────────────────
# Network settings (CUSTOMIZE FOR YOUR PROJECT)
# ────────────────────────────────────────────────────────────
network:
  name: rag-bootstrap          # Change to avoid conflicts (e.g., "myproject-rag")
  port: 10000                  # Localhost port (base of the 10000-10019 band)

# ────────────────────────────────────────────────────────────
# Document ingestion (RECURSIVELY SCANS ALL SUBDIRECTORIES)
# ────────────────────────────────────────────────────────────
ingestion:
  directories:
    - ./data/docs              # Scans recursively; default matches DOCS_PATH
    - /path/to/more/docs       # Host paths (absolute or repo-root-relative), each under DOCS_PATH
  extensions: [pdf, md, txt, log, json, yaml, yml]
  exclude: [".git/", "node_modules/", "data/", "*.pdf"]  # exclude wins over extensions
  chunk_size: 256              # Tokens per chunk
  chunk_overlap: 50            # Overlap for context continuity
  concurrent_files: 5          # Parallel files / concurrent embedding requests
  retry_backoff: exponential   # Retry strategy for transient Ollama failures

# ────────────────────────────────────────────────────────────
# LLM settings
# ────────────────────────────────────────────────────────────
llm:
  model: llama3.2:3b           # Ollama model for Q&A generation
  temperature: 0.3             # Lower = more deterministic
```

**Important Notes:**
- All `ingestion.directories` are scanned **recursively** (all subdirectories included)
- Network name should be unique per project to avoid Docker conflicts
- Only ONE port needs to be configured (all services communicate internally)
- Changes to `config/config.yaml` require restart: `./deploy.sh restart`

### Port scheme (RAG_PORT_BASE=10000)

All published host ports derive from a single base: `RAG_PORT_BASE=10000`.
`deploy.sh` computes `RAG_<svc>_PORT = RAG_PORT_BASE + offset` and writes the
concrete values into `.env`; the compose files consume `${RAG_<svc>_PORT:-<default>}`
with defaults matching this table. Container-side ports are unchanged.

| Service | Env var | Offset | Default host port | Container port |
|---------|---------|--------|-------------------|----------------|
| web (nginx) | `RAG_PORT` | +0 | **10000** | 80 |
| prometheus | `RAG_PROMETHEUS_PORT` | +10 | 10010 | 9090 |
| grafana | `RAG_GRAFANA_PORT` | +11 | 10011 | 3000 |
| loki | `RAG_LOKI_PORT` | +12 | 10012 | 3100 |
| alertmanager | `RAG_ALERTMANAGER_PORT` | +13 | 10013 | 9093 |
| postgres-exporter | `RAG_PG_EXPORTER_PORT` | +14 | 10014 | 9187 |
| redis-exporter | `RAG_REDIS_EXPORTER_PORT` | +15 | 10015 | 9121 |
| cadvisor | `RAG_CADVISOR_PORT` | +16 | 10016 | 8080 |

Reserved band for this stack: **10000-10019** — downstream apps and second
instances should take **10020 and up**. Ollama stays on its well-known external
port `11434` (not remapped). Internal-only ports (postgres 5432, redis 6379,
api 8000) are never published. If `RAG_PORT` is busy at start, `deploy.sh`
auto-selects the next free port in the band and records it in `.env`.

### Monitoring (out of scope / unsupported for now)

The core deploy is intentionally minimal: **one** Docker network (`rag-net`)
and **one** external port, `127.0.0.1:RAG_PORT` (10000-range). Grafana,
Prometheus, Loki, Alertmanager, and the exporters (rows +10 to +16 in the
table above) are **out of scope / unsupported for now (files retained)** —
core diagnostics are `/api/health` (+`?deep=1`), `./deploy.sh doctor`, and
`./deploy.sh logs`. The overlay files are kept in-tree but NOT supported; they
do not run unless you explicitly add the overlay file at your own risk:

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

Monitoring config files live in `config/monitoring/` (prometheus.yml,
loki-config.yml, promtail-config.yml) and `config/` (alertmanager.yml,
alert_rules.yml).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ingest/file` | Upload and ingest a single file |
| POST | `/api/ingest/directory` | **Async** directory ingest — returns `202` with a `job_id` immediately |
| GET | `/api/ingest/status/{job_id}` | Poll an async ingest job (`queued`/`running`/`completed`/`failed`) |
| POST | `/api/ingest/directories` | Ingest from multiple directories |
| GET | `/api/documents` | List all documents |
| GET | `/api/documents/{id}` | Get document details |
| DELETE | `/api/documents/{id}` | Delete document and chunks |
| POST | `/api/search` | Search (semantic, keyword, or hybrid); `X-Chunk-Bytes` telemetry header |
| POST | `/api/ask` | RAG Q&A — search + LLM answer generation |
| GET | `/api/status` | Corpus identity/whoami — project, docs root, counts, model, dimension |
| GET | `/health/index` | Index freshness — indexed_at, commit sha, corpus bytes, staleness class |
| GET | `/api/models` | List available Ollama models |
| GET | `/api/health` | Health check (DB, Redis, embeddings, LLM) |

**Versioned aliases**: `/api/v1/search`, `/api/v1/ask`, `/api/v1/status`, and
`/api/v1/health` are ADDITIVE aliases of the unversioned routes (same handlers,
same schemas). `/api/search` and friends remain stable for existing consumers;
new consumers should pin `/api/v1/*`.

### Async directory ingest flow

Directory ingest no longer blocks the request (large corpora used to hit the
proxy's read timeout). `POST /api/ingest/directory` returns `202 Accepted`
with a pollable job:

```bash
# Start the ingest — returns immediately
curl -X POST http://localhost:10000/api/ingest/directory \
  -H 'Content-Type: application/json' \
  -d '{"path": "/absolute/path/to/docs"}'
# → 202 {"job_id": "…", "status": "queued", "status_url": "/api/ingest/status/…", …}

# Poll until status is "completed" (or "failed")
curl http://localhost:10000/api/ingest/status/<job_id>
```

The request body accepts optional `extensions` and `exclude` lists that
override `config/config.yaml`'s `ingestion.extensions` / `ingestion.exclude`
for that one ingest. When `DOCS_PATH` is set, the ingest-root guard (see below)
rejects paths outside the configured docs root with `400`.

### Corpus provenance & mount knobs

| Knob | Default | What it does |
|------|---------|--------------|
| `DOCS_PATH` | `./data/docs` | Same-path **read-only** mount: the container sees your docs at the SAME absolute path as the host, so stored `document_filepath` values are host-openable. Set it to your real docs root. |
| `RAG_INGEST_ROOT_GUARD` | `on` | Refuses `/api/ingest/directory` calls outside `DOCS_PATH` (active only when `DOCS_PATH` is set). Set `off` to disable. Keeps `/api/status`'s advertised `docs_root` honest. |
| `WATCHER_ARCHIVE_MODE` | `off` | What the auto-ingest watcher does with processed files: `off` (never touch sources), `copy` (copy into `archive/`), or `move` (legacy relocate — only for staging dirs, never live source trees). |

## Search Modes

- **semantic**: pgvector cosine similarity
- **keyword**: PostgreSQL full-text search (tsvector/tsquery)
- **hybrid** (default): Reciprocal Rank Fusion (0.7 semantic weight)

## Supported Document Types

- PDF (.pdf)
- Markdown (.md)
- Plain text (.txt)
- Log files (.log)
- JSON (.json)
- YAML (.yaml, .yml)

## Embedding Models

The RAG system uses **nomic-embed-text v1.5** (768 dimensions) via Ollama by default.

### Why nomic-embed-text?

✅ **Purpose-built for RAG** - Specifically designed for retrieval tasks
✅ **Long context** - 8,192 token context window (vs 512 for all-minilm)
✅ **Fast inference** - 548 MB model size, very fast embeddings
✅ **Good performance** - MTEB score 62.39, retrieval score 49.01
✅ **Matryoshka embeddings** - Adjustable dimensions (768/512/256)

### Setup

```bash
# Pull the embedding model (HARD prerequisite before first start)
ollama pull nomic-embed-text

# Verify: Ollama reachable + model present (also checks port/disk/dims)
./deploy.sh doctor

# Then start the RAG system
./deploy.sh start --build
```

Embeddings come from an **external Ollama server** at `OLLAMA_BASE_URL`
(default `http://host.docker.internal:11434`). The canonical default triple is
`nomic-embed-text` / `768` / `ollama` — the same fallback everywhere
(`.env.example`, `docker-compose.yml`, `config/config.yaml`, `app/config.py`).
`sentence-transformers` is an optional, NOT-installed backend; selecting it
without the dependency raises an actionable error.

### Alternative Models

Edit [config/config.yaml](config/config.yaml) to use different models:

| Model | MTEB Score | Dimensions | Size | Best For |
|-------|------------|------------|------|----------|
| `nomic-embed-text` | 62.39 | 768 | 548 MB | General RAG (default) |
| `mxbai-embed-large` | 64.68 | 1024 | 1.3 GB | Maximum accuracy |
| `qwen3-embedding:8b` | 70.58 | Variable | Large | State-of-the-art |
| `all-minilm:l6-v2` | ~53 | 384 | 120 MB | Fast/lightweight |

**Note**: A dimension change invalidates the stored index (pgvector column
width). Both `deploy.sh` and the API refuse to start against a mismatched
stored dimension — wipe and re-ingest with `./deploy.sh reset`, then
`./deploy.sh start` and `./deploy.sh ingest`.

## Environment Variables

See [.env.example](.env.example) for all options. Key settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `RAG_PORT_BASE` | `10000` | Base of the port band; all `RAG_<svc>_PORT` derive as base+offset |
| `RAG_PORT` | `10000` | Port to expose the web UI (base + 0) |
| `COMPOSE_PROJECT_NAME` | `rag-bootstrap` | UNIQUE per instance — prefixes containers/networks/volumes |
| `RAG_NETWORK_NAME` | `rag-bootstrap-net` | Instance-unique Docker network name |
| `EMBEDDING_MODEL` | `nomic-embed-text` | Ollama embedding model |
| `EMBEDDING_BACKEND` | `ollama` | `ollama` (default) or `sentence-transformers` (optional, not installed) |
| `EMBEDDING_DIMENSION` | `768` | Must match model (768 for nomic-embed-text) |
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | External Ollama endpoint (embeddings + LLM) |
| `DOCS_PATH` | `./data/docs` | Same-path `:ro` docs mount root (host-openable stored paths) |
| `RAG_INGEST_ROOT_GUARD` | `on` | Refuse directory ingests outside `DOCS_PATH` (when set) |
| `WATCHER_ARCHIVE_MODE` | `off` | Watcher file archiving: `off` \| `copy` \| `move` |
| `CHUNK_SIZE` | `512` | Tokens per chunk |
| `CHUNK_OVERLAP` | `50` | Overlap between chunks |
| `LLM_MODEL` | `llama3.2:3b` | Ollama model for Q&A generation |
| `LLM_TEMPERATURE` | `0.3` | Generation temperature |
| `RAG_TOP_K` | `5` | Number of chunks to retrieve |
| `RAG_MIN_SIMILARITY` | `0.7` | Minimum similarity threshold |

## MCP Integration

Run the MCP server for Claude/agent integration:

```bash
python -m app.mcp_server
```

Tools: `search_documents`, `ingest_file`, `list_documents`, `get_document`

## Documentation

- [Documentation Index](docs/INDEX.md) - Full map of the docs/ tree
- [Integration Guide](docs/integration/integration-guide.md) - How to integrate into other projects
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Ollama, ports, dimension mismatches, ghost containers, multi-stack collisions
- [Performance](docs/PERFORMANCE.md) - Embedding concurrency, chunking, ingest throughput, monitoring
- [Consuming Agents Contract](docs/integration/CONSUMING_AGENTS_CONTRACT.md) - One-page contract for agent/consumer workflows
- [Agent Query Hint](agent_hints/HOW_TO_QUERY.md) - Single-include RAG hint header for orchestrators
- [Scope](docs/scope.md) - Project scope and objectives
- [Roadmap](docs/roadmap.md) - Development roadmap
- [TODO](docs/todo.md) - Current tasks and backlog
