# RAG Bootstrap Integration Guide

## Overview

Universal RAG system for rapid document ingestion and semantic search. Based on proven patterns from PalletAI (three-tier RAG) and ResearchHub (document ingestion with async embeddings).

The goal is zero-to-searchable-docs in under five minutes: point it at a folder, run one command, and get a full semantic search API plus MCP tool server.

## Architecture

```
┌─────────────────────────────────────────┐
│           Docker Compose                │
│  ┌──────────┐ ┌───────┐ ┌──────────┐  │
│  │PostgreSQL│ │ Redis │ │ FastAPI  │  │
│  │+pgvector │ │  7    │ │ + MCP    │  │
│  └──────────┘ └───────┘ └──────────┘  │
└─────────────────────────────────────────┘
```

**Data flow:**

1. Documents are submitted via API or directory scan.
2. The ingestion pipeline splits documents into chunks (sentence-boundary aware).
3. Chunks are embedded via sentence-transformers or Ollama.
4. Embeddings are cached in Redis (30-day TTL) and stored in PostgreSQL with pgvector.
5. Search queries are embedded at query time, then matched against stored vectors.

## Quick Start

1. Clone or copy `rag-bootstrap/` into your project.
2. Run the bootstrap script:
   ```bash
   ./bootstrap.sh my-project ./path/to/docs
   ```
3. The API is available at [http://localhost:8000](http://localhost:8000).
4. The MCP server is available for Claude and other MCP-compatible tool clients.

### Manual Start (without bootstrap script)

```bash
cp .env.example .env
# Edit .env as needed
docker compose up -d
# Ingest a directory
curl -X POST http://localhost:8000/api/ingest/directory \
  -H "Content-Type: application/json" \
  -d '{"path": "/docs"}'
```

## Stack

| Component | Version | Role |
|-----------|---------|------|
| PostgreSQL | 16 | Relational storage + pgvector for vector similarity |
| pgvector | 0.7+ | Vector indexing (IVFFlat / HNSW) |
| Redis | 7 | Embedding cache with 30-day TTL |
| FastAPI | 0.110+ | Async HTTP API |
| Uvicorn | latest | ASGI server |
| FastMCP | latest | MCP tool server for Claude integration |
| sentence-transformers | latest | Local embedding generation (default) |
| Ollama | optional | Alternative embedding backend |

**Why no separate vector database?** pgvector inside PostgreSQL keeps the stack simple. One database handles both relational metadata and vector search. For most documentation corpora (under 1M chunks), pgvector with HNSW indexing provides sub-100ms query times.

## API Reference

All endpoints are served at `http://localhost:8000` by default.

### POST /api/ingest/file

Upload a single file for ingestion.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | file | yes | The document to ingest |
| metadata | string (JSON) | no | Optional metadata object |

```bash
curl -X POST http://localhost:8000/api/ingest/file \
  -F "file=@README.md" \
  -F 'metadata={"project": "my-app"}'
```

**Response (201):**
```json
{
  "document_id": "d4f5a6b7-...",
  "filename": "README.md",
  "chunks": 12,
  "status": "ingested"
}
```

### POST /api/ingest/directory

Ingest all supported documents from a directory path accessible to the container.

**Content-Type:** `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| path | string | yes | Absolute path inside the container |
| recursive | bool | no | Recurse into subdirectories (default: true) |
| metadata | object | no | Metadata applied to all documents |

```bash
curl -X POST http://localhost:8000/api/ingest/directory \
  -H "Content-Type: application/json" \
  -d '{"path": "/docs", "recursive": true}'
```

**Response (202):**
```json
{
  "job_id": "a1b2c3d4-...",
  "files_found": 47,
  "status": "processing"
}
```

### GET /api/documents

List all ingested documents with pagination.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| offset | int | 0 | Pagination offset |
| limit | int | 50 | Page size (max 200) |

```bash
curl http://localhost:8000/api/documents?limit=10
```

### GET /api/documents/{id}

Retrieve a single document's metadata and chunk count.

```bash
curl http://localhost:8000/api/documents/d4f5a6b7-...
```

### DELETE /api/documents/{id}

Delete a document and all its chunks and embeddings.

```bash
curl -X DELETE http://localhost:8000/api/documents/d4f5a6b7-...
```

**Response (200):**
```json
{
  "deleted": true,
  "chunks_removed": 12
}
```

### POST /api/search

Search across all ingested documents.

**Content-Type:** `application/json`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| query | string | yes | — | Natural language search query |
| mode | string | no | "hybrid" | One of: `semantic`, `keyword`, `hybrid` |
| limit | int | no | 10 | Max results to return |
| threshold | float | no | 0.0 | Minimum similarity score (0.0–1.0) |
| document_ids | list | no | null | Restrict search to specific documents |

```bash
curl -X POST http://localhost:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "how to configure Redis caching", "mode": "hybrid", "limit": 5}'
```

**Response (200):**
```json
{
  "results": [
    {
      "chunk_id": "...",
      "document_id": "...",
      "content": "Redis is configured via the REDIS_URL environment variable...",
      "score": 0.87,
      "metadata": {"filename": "config.md", "chunk_index": 3}
    }
  ],
  "query": "how to configure Redis caching",
  "mode": "hybrid",
  "total": 1
}
```

### GET /api/health

Health check for all services.

```bash
curl http://localhost:8000/api/health
```

**Response (200):**
```json
{
  "status": "healthy",
  "postgres": "connected",
  "redis": "connected",
  "embedding_backend": "sentence-transformers",
  "documents": 47,
  "chunks": 1523
}
```

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and edit as needed.

| Variable | Default | Description |
|----------|---------|-------------|
| `PROJECT_NAME` | `rag-bootstrap` | Project name used in container naming |
| `API_HOST` | `0.0.0.0` | API bind address |
| `API_PORT` | `8000` | API port |
| `POSTGRES_HOST` | `postgres` | PostgreSQL hostname |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_DB` | `rag` | Database name |
| `POSTGRES_USER` | `rag` | Database user |
| `POSTGRES_PASSWORD` | `changeme` | Database password (change in production) |
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection string |
| `REDIS_CACHE_TTL` | `2592000` | Embedding cache TTL in seconds (default: 30 days) |
| `EMBEDDING_BACKEND` | `sentence-transformers` | Backend: `sentence-transformers` or `ollama` |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Model name for embedding generation |
| `EMBEDDING_DIM` | `384` | Embedding vector dimensions (must match model) |
| `OLLAMA_URL` | `http://host.docker.internal:11434` | Ollama API URL (if using ollama backend) |
| `CHUNK_SIZE` | `512` | Target chunk size in tokens |
| `CHUNK_OVERLAP` | `50` | Overlap between consecutive chunks in tokens |
| `DOCS_PATH` | `/docs` | Default document path inside the container |
| `LOG_LEVEL` | `info` | Logging level: debug, info, warning, error |
| `MCP_ENABLED` | `true` | Enable/disable the MCP tool server |
| `MCP_PORT` | `8001` | MCP server port |

## Document Types Supported

| Type | Extensions | Notes |
|------|-----------|-------|
| PDF | `.pdf` | Text extraction via pdfplumber; scanned PDFs not supported |
| Markdown | `.md`, `.mdx` | Preserves heading structure for chunk boundaries |
| Text | `.txt` | Plain text splitting |
| Log | `.log` | Line-based splitting with timestamp awareness |
| JSON | `.json` | Flattened to text, key paths preserved |
| YAML | `.yaml`, `.yml` | Converted to structured text |

## Embedding Backends

### sentence-transformers (default)

Runs locally inside the API container. No external service required.

- **Model:** `all-MiniLM-L6-v2` (384 dimensions, ~80MB)
- **GPU:** Not required. Runs on CPU with acceptable performance for ingestion workloads.
- **Performance:** ~500 chunks/second on a modern CPU.

```env
EMBEDDING_BACKEND=sentence-transformers
EMBEDDING_MODEL=all-MiniLM-L6-v2
EMBEDDING_DIM=384
```

To use a larger model (better quality, slower):
```env
EMBEDDING_MODEL=all-mpnet-base-v2
EMBEDDING_DIM=768
```

### Ollama

Delegates embedding to a running Ollama instance. Useful if you already run Ollama for LLM inference.

```env
EMBEDDING_BACKEND=ollama
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIM=768
OLLAMA_URL=http://host.docker.internal:11434
```

Make sure the model is pulled first:
```bash
ollama pull nomic-embed-text
```

## Chunking Strategy

- **Default size:** 512 tokens with 50-token overlap between consecutive chunks.
- **Sentence-boundary aware:** Chunks never split mid-sentence. The chunker finds the nearest sentence boundary before the token limit.
- **Heading awareness:** For Markdown files, heading boundaries are preferred split points.
- **Configurable:** Set `CHUNK_SIZE` and `CHUNK_OVERLAP` in your `.env` file.

Guidelines for tuning:
- **Smaller chunks (256):** Better precision for specific fact retrieval. More chunks, higher storage.
- **Larger chunks (1024):** Better context for summarization-style queries. Fewer chunks, lower storage.
- **Overlap (50–100):** Prevents losing context at chunk boundaries. Higher overlap = more redundancy.

## Search Modes

### Semantic Search (`mode: "semantic"`)

Pure vector similarity search using pgvector cosine distance.

- Query is embedded using the same model as documents.
- Matched against stored vectors using HNSW index.
- Best for natural language questions and conceptual queries.

### Keyword Search (`mode: "keyword"`)

PostgreSQL full-text search using `tsvector` and `tsquery`.

- Uses PostgreSQL's built-in text search with English stemming.
- Best for exact term matching, error codes, specific identifiers.

### Hybrid Search (`mode: "hybrid"`)

Combines semantic and keyword results using Reciprocal Rank Fusion (RRF).

- Default semantic weight: **0.7** (keyword weight: 0.3).
- Both searches run in parallel, results are merged and re-ranked.
- Best general-purpose mode; recommended as the default.

The RRF formula:

```
score = semantic_weight * (1 / (k + semantic_rank)) + keyword_weight * (1 / (k + keyword_rank))
```

Where `k = 60` (standard RRF constant).

## Integrating Into an Existing Project

### Step 1: Copy the folder

```bash
cp -r rag-bootstrap/ /path/to/your-project/rag-bootstrap/
```

### Step 2: Add to existing Docker Compose

If your project already has a `docker-compose.yml`, use the `include` directive (Compose v2.20+):

```yaml
# your-project/docker-compose.yml
include:
  - path: ./rag-bootstrap/docker-compose.yml

services:
  your-app:
    # ...
    depends_on:
      - rag-api
    environment:
      RAG_API_URL: http://rag-api:8000
```

Or merge the services manually if you prefer a single compose file.

### Step 3: Configure environment

```bash
cp rag-bootstrap/.env.example rag-bootstrap/.env
# Edit to match your setup
```

### Step 4: Mount your documentation

In your compose override or `.env`, point the docs volume at your documentation:

```yaml
volumes:
  - ./docs:/docs:ro
```

### Step 5: Use from your application

**Python:**
```python
import httpx

async def search_docs(query: str) -> list:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "http://rag-api:8000/api/search",
            json={"query": query, "mode": "hybrid", "limit": 5}
        )
        return resp.json()["results"]
```

**JavaScript/Node:**
```javascript
const searchDocs = async (query) => {
  const resp = await fetch("http://rag-api:8000/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, mode: "hybrid", limit: 5 }),
  });
  return (await resp.json()).results;
};
```

## MCP Integration

The RAG bootstrap includes a FastMCP server that exposes search and ingestion as MCP tools, making them available to Claude and other MCP-compatible clients.

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `search_documents` | Search ingested documents by query, mode, and limit |
| `ingest_file` | Ingest a file by path |
| `list_documents` | List all ingested documents |
| `get_document` | Get metadata for a specific document |
| `health_check` | Check RAG system health |

### Connecting Claude Desktop

Add to your Claude Desktop MCP configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "rag-bootstrap": {
      "command": "docker",
      "args": ["exec", "-i", "rag-mcp", "python", "-m", "mcp_server"],
      "env": {}
    }
  }
}
```

### Connecting via stdio (local development)

```json
{
  "mcpServers": {
    "rag-bootstrap": {
      "url": "http://localhost:8001/mcp"
    }
  }
}
```

### Using MCP tools from Claude

Once connected, Claude can directly call tools like:

> "Search the documentation for how to configure Redis caching"

Claude will invoke `search_documents(query="how to configure Redis caching", mode="hybrid", limit=5)` and receive the relevant chunks as context.
