# Ingestion & Monitoring Scripts

Scripts for ingesting documents and monitoring RAG system status.
All settings (port, directories, extensions) are read from `config.yaml`.

## Configuration

Scripts read from `config.yaml` via the shared loader `scripts/_config.sh`:

| Setting | config.yaml Key | Default |
|---|---|---|
| API port | `network.port` | 8300 |
| Project name | `project_name` | rag-project |
| Ingestion directories | `ingestion.directories` | ./manuals/* |
| File extensions | `ingestion.extensions` | pdf, md, txt, ... |

Command-line flags (e.g., `--port`) override config.yaml values.

## Ingestion (`scripts/ingest.sh`)

Ingest files or directories into the RAG system via the API.

### Usage

```bash
# Ingest all directories listed in config.yaml
./scripts/ingest.sh --all

# Ingest a specific folder
./scripts/ingest.sh manuals/orders/

# Ingest with max recursion depth
./scripts/ingest.sh --max-depth 1 manuals/

# Force re-ingestion (bypass content dedup)
./scripts/ingest.sh --force manuals/orders/

# Preview what would be ingested
./scripts/ingest.sh --dry-run manuals/

# Ingest and then watch progress
./scripts/ingest.sh --watch --all

# Override API port
./scripts/ingest.sh --port 8100 --all
```

### Options

| Flag | Description |
|------|-------------|
| `--all` | Ingest all directories from `config.yaml` |
| `--force` | Bypass content deduplication (re-embed everything) |
| `--dry-run` | Show files that would be ingested, without doing it |
| `--max-depth N` | Limit directory recursion depth |
| `--watch` | After ingesting, switch to live progress monitoring |
| `--port PORT` | Override API port from config.yaml |

### Path Translation

Host paths under the docs directory are automatically translated to container paths:
- `manuals/orders/` → `/data/docs/orders/`
- `manuals/regulations/aeronautical_publications/` → `/data/docs/regulations/aeronautical_publications/`

The docs directory root and container mount path are derived from config.yaml.

### Supported File Types

Read from `config.yaml` → `ingestion.extensions`. Default: pdf, md, txt, json, yaml, yml, log

## Monitoring (`scripts/monitor.sh`)

Monitor system health, document status, and ingestion progress.

### Commands

```bash
# Full status overview
./scripts/monitor.sh

# List all ingested documents
./scripts/monitor.sh docs

# System health check
./scripts/monitor.sh health

# Check embedding/ingestion progress
./scripts/monitor.sh progress

# Document statistics
./scripts/monitor.sh stats

# Live monitoring (refreshes every 5s)
./scripts/monitor.sh --watch

# Raw JSON output
./scripts/monitor.sh --json docs
./scripts/monitor.sh --json health
```

### Output Examples

**`docs`** — Shows document table with ID, filename, chunks, size

**`progress`** — Parses Docker logs for embedding progress:
- `[START]` — New embedding batch started
- `[PROG]` — Chunk progress (e.g., 500/1689 chunks)
- `[DONE]` — Document fully ingested
- `[SKIP]` — Document skipped (dedup)
- `[RETRY]` — Ollama retry count in last 60s
- `[ACTIVE]` — Embedding requests in last 10s

**`stats`** — Document counts by file type and directory

**`--watch`** — Continuous live view of health, documents, and progress

## Workflow

Typical ingestion workflow:

```bash
# 1. Place PDFs in manuals/ subdirectories
cp new_document.pdf manuals/orders/

# 2. Preview what will be ingested
./scripts/ingest.sh --dry-run manuals/orders/

# 3. Run ingestion
./scripts/ingest.sh manuals/orders/

# 4. Monitor progress (in another terminal)
./scripts/monitor.sh --watch

# 5. Verify completion
./scripts/monitor.sh docs
```

## Notes

- Ingestion requires the Docker stack to be running (`./deploy.sh start`)
- Requires Ollama reachable at `localhost:11434` for embedding
- Remote Ollama may intermittently return 500; retry logic (12 retries, 60s backoff cap) handles this
- Redis caches all embeddings for 30 days — re-running ingestion on partially-failed docs is fast
- Content deduplication skips already-ingested documents by default (use `--force` to override)
