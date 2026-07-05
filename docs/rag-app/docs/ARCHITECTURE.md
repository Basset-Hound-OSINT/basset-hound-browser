# RAG Bootstrap Architecture Guide

## Overview

RAG Bootstrap is now a **modular knowledge system** that supports multiple knowledge bases with flexible backends, plus automatic document ingestion via the File System Watcher. This guide explains the architecture and how to extend it.

**New in v2.1**: Auto-ingest watcher for hands-free document management (Enhancement #2)

## Core Concepts

### Knowledge Base (KB)

A knowledge base is an abstraction for document storage and retrieval. Different backends support different capabilities:

| Backend | Vector Search | Keyword Search | Lightweight | Use Case |
|---------|--------------|-----------------|-------------|----------|
| **PostgreSQL** | ✅ Yes | ✅ Yes | ❌ No | Full-featured RAG, hybrid search, semantic similarity |
| **Keyword-Only** | ❌ No | ✅ Yes | ✅ Yes | Lightweight, no embedding dependencies, pure text search |
| **Custom** | ⚡ Pluggable | ⚡ Pluggable | ⚡ Pluggable | Domain-specific backends (vector DB, file store, etc.) |

### Search Modes

```python
SearchMode.SEMANTIC  # Vector similarity only (requires embeddings)
SearchMode.KEYWORD   # Full-text search only (no embeddings needed)
SearchMode.HYBRID    # Semantic + keyword with Reciprocal Rank Fusion
```

### Knowledge Registry

Manages lifecycle of multiple named knowledge bases:

```python
registry = KnowledgeRegistry()

# Create KBs
kb1 = await registry.create("atc", "postgres", config={...})
kb2 = await registry.create("research", "keyword-only")

# Retrieve
kb = await registry.get("atc")

# List
names = await registry.list()

# Delete
await registry.delete("atc")
```

## Architecture Diagram

```
┌────────────────────────────────────────────────────┐
│ FastAPI Application                                 │
├────────────────────────────────────────────────────┤
│ • /api/search — Multi-KB search                     │
│ • /api/ask — Multi-KB RAG Q&A                       │
│ • /api/knowledge-bases — KB management              │
└─────────┬──────────────────────────────────────────┘
          │
    ┌─────▼──────────────────────┐
    │ Knowledge Registry          │
    ├────────────────────────────┤
    │ • create(name, type, cfg)  │
    │ • get(name)                │
    │ • delete(name)             │
    │ • list()                   │
    └─────┬──────┬───────────────┘
          │      │
      ┌───▼──┐   └────┬────────────┐
      │ KB 1 │        │  KB 2      │  ... KB N
      ├──────┤        ├────────────┤
      │ Type:│        │ Type:      │
      │Postgr.       │Keyword     │
      └──────┘        └────────────┘
```

## Implementation Details

### 1. Knowledge Base Interface (kb.py)

Abstract base class defining the KB contract:

```python
class KnowledgeBase(ABC):
    async def initialize(self) -> None: ...
    async def health_check(self) -> bool: ...
    async def ingest(self, document, chunks, embeddings) -> IngestResult: ...
    async def search(self, query, mode, limit, embedding) -> List[SearchResult]: ...
    async def delete_document(self, document_id) -> None: ...
    async def list_documents(self, limit) -> List[dict]: ...
    async def get_document(self, document_id) -> dict | None: ...
    async def shutdown(self) -> None: ...
    def supports_embedding(self) -> bool: ...
    def supports_keyword_search(self) -> bool: ...
```

### 2. PostgreSQL KB (postgres_kb.py)

Full-featured backend with vector and keyword search:

```python
kb = PostgresKB(
    name="primary",
    engine=engine,
    async_session_maker=async_session,
    embedding_service=embedding_svc,
)

# Ingest with embeddings
result = await kb.ingest(
    document=doc,
    chunks=["chunk 1", "chunk 2"],
    embeddings=[[0.1, 0.2, ...], [0.3, 0.4, ...]]
)

# Search (all modes supported)
results = await kb.search(
    query="What is LAHSO?",
    mode=SearchMode.HYBRID,
    embedding=query_embedding,
)
```

### 3. Keyword-Only KB (keyword_only_kb.py)

Lightweight backend, no embeddings required:

```python
kb = KeywordOnlyKB(
    name="research",
    database_url="sqlite:///:memory:"  # or postgres
)

# Ingest (embeddings are ignored)
result = await kb.ingest(
    document=doc,
    chunks=["chunk 1", "chunk 2"],
    embeddings=None,  # Not used
)

# Search (keyword mode only)
results = await kb.search(
    query="neural networks",
    mode=SearchMode.KEYWORD,
)
```

### 4. Knowledge Registry (registry.py)

Manages KB lifecycle with factory pattern:

```python
registry = KnowledgeRegistry()

# Built-in types: "postgres", "keyword-only"
kb = await registry.create(
    name="research",
    kb_type="keyword-only",
    config={"database_url": "sqlite:///:memory:"},
)

# Retrieve
kb = await registry.get("research")

# Cleanup
await registry.shutdown_all()
```

## Usage Examples

### Example 1: Single KB (Backwards Compatible)

```python
# Old code still works!
registry = KnowledgeRegistry()
kb = await registry.create("primary", "postgres")

# Search
results = await kb.search(
    query="maintain altitude",
    mode=SearchMode.HYBRID,
    embedding=query_embedding,
)
```

### Example 2: Multi-KB System

```python
registry = KnowledgeRegistry()

# Domain-specific KBs
atc_kb = await registry.create("atc", "postgres", config={
    "database_url": "postgresql://...",
})

research_kb = await registry.create("research", "keyword-only", config={
    "database_url": "postgresql://...",
})

# Search both
atc_results = await atc_kb.search("LAHSO", SearchMode.SEMANTIC, embedding)
research_results = await research_kb.search("Transformers", SearchMode.KEYWORD)

# Combine results
all_results = atc_results + research_results
```

### Example 3: Lightweight Deployment (No Embeddings)

```python
# No embedding service needed!
kb = KeywordOnlyKB("local", "sqlite:///./kb.db")
await kb.initialize()

# Pure keyword search
results = await kb.search(
    query="emergency procedures",
    mode=SearchMode.KEYWORD,
)

# No embeddings = no Ollama dependency
```

## Creating Custom KB Backends

Extend the system by implementing the `KnowledgeBase` interface:

```python
from app.kb import KnowledgeBase, Document, IngestResult, SearchResult

class MyCustomKB(KnowledgeBase):
    async def initialize(self) -> None:
        # Setup your backend
        pass

    async def health_check(self) -> bool:
        # Check if accessible
        pass

    async def ingest(self, document, chunks, embeddings):
        # Store document and chunks
        return IngestResult(...)

    async def search(self, query, mode, limit, embedding):
        # Search and return results
        return [SearchResult(...), ...]

    # Implement other abstract methods...

# Register with custom registry
class CustomRegistry(KnowledgeRegistry):
    async def _create_custom_kb(self, name: str, config: dict):
        return MyCustomKB(name)

registry = CustomRegistry()
registry._backends["my-custom"] = registry._create_custom_kb
```

## Configuration

### YAML Config (Future)

```yaml
mode: multi-rag

knowledge_bases:
  primary:
    type: postgres
    database_url: postgresql://user:pass@localhost/ragdb

  atc:
    type: postgres
    database_url: postgresql://user:pass@localhost/atcdb

  lightweight:
    type: keyword-only
    database_url: sqlite:///./kb.db

embedding:
  enabled: true
  model: nomic-embed-text
  backend: ollama
```

### Programmatic Config

```python
registry = KnowledgeRegistry()

# Postgres with embeddings
await registry.create("primary", "postgres", config={
    "embedding_service": embedding_svc,
})

# Keyword-only with SQLite
await registry.create("research", "keyword-only", config={
    "database_url": "sqlite:///:memory:",
})
```

## Testing

Test your KB implementation:

```python
@pytest.mark.asyncio
async def test_my_kb():
    kb = MyCustomKB("test")
    await kb.initialize()

    # Test ingest
    doc = Document(...)
    result = await kb.ingest(doc, chunks, embeddings)
    assert result.document_id > 0

    # Test search
    results = await kb.search("test query", SearchMode.KEYWORD)
    assert len(results) > 0

    # Cleanup
    await kb.shutdown()
```

## Migration Guide

### From Single KB to Multi-KB

```python
# Old code (still works)
from app.database import async_session
from app.embeddings import EmbeddingService

# New code (recommended)
registry = KnowledgeRegistry()
kb = await registry.create("primary", "postgres", config={
    "embedding_service": embedding_svc,
})
```

### Fallback When Embeddings Unavailable

```python
try:
    results = await kb.search(query, SearchMode.SEMANTIC, embedding)
except ValueError:
    # Fallback to keyword search
    results = await kb.search(query, SearchMode.KEYWORD)
```

## Performance Considerations

| Backend | Ingestion Speed | Search Speed | Memory | Storage |
|---------|------------------|--------------|--------|---------|
| PostgreSQL | Medium | Fast (vector) | Medium | Medium |
| Keyword-Only | Fast | Fast (text) | Low | Low |

**Optimization Tips:**
1. Use Keyword-Only for lightweight deployments or keyword-heavy workloads
2. Use PostgreSQL for semantic search and hybrid queries
3. Embed in batches for faster ingestion
4. Cache query embeddings in Redis

## Limitations & Future Work

**Current Limitations:**
- Single-node only
- No distributed vector DB support
- No cross-KB routing (yet)

**Phase 2 Roadmap:**
- [ ] LLM-based KB router (intelligent routing across multiple KBs)
- [ ] Graph RAG mode (entity extraction and relation graphs)
- [ ] Custom embedding backends (FAISS, Milvus, etc.)
- [ ] Distributed indexing

## Debugging

Enable logging:

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("app.registry")
logger.setLevel(logging.DEBUG)
```

Check KB health:

```python
registry = KnowledgeRegistry()
kb = await registry.get("primary")
is_healthy = await kb.health_check()
print(f"KB health: {is_healthy}")
```

## Document Watcher (Auto-Ingest) - Enhancement #2

The auto-ingest watcher monitors a filesystem directory for new documents and automatically ingests them without manual intervention.

### Architecture

```
File System
    ↓
inotify-simple (or polling fallback)
    ↓
DocumentWatcher
    ↓
IngestQueue
    ↓
Ingestion Pipeline (async ingest_file)
    ↓
Knowledge Base (PostgreSQL + pgvector)
    ↓
Archive Directory (/data/docs/archive)
```

### Features

- **Inotify-based Monitoring**: Linux-native file system events (efficient, low-latency)
- **Polling Fallback**: For non-Linux systems or when inotify unavailable
- **Automatic Retry**: Exponential backoff (2s, 4s, 8s) for failed ingestions
- **Queue Management**: Sequential or concurrent processing (configurable)
- **Archive System**: Successfully ingested files automatically moved to archive
- **REST API**: Query watcher status via `/api/watcher/status`
- **WebSocket Events**: Optional real-time progress updates
- **Duplicate Prevention**: Skips files already being processed

### Configuration (docker-compose.yml)

```yaml
api:
  environment:
    WATCHER_ENABLED: "true"
    WATCHER_WATCH_DIR: "/data/docs"
    WATCHER_POLL_INTERVAL: "5"  # seconds (polling mode only)
    WATCHER_MAX_RETRIES: "3"
    WATCHER_RETRY_DELAY: "2"    # seconds (exponential backoff)
  volumes:
    - ./data/docs:/data/docs    # Watched directory
    - ./data/docs/archive:/data/docs/archive  # Archive destination
```

### Supported File Types

- PDF (.pdf)
- Word Documents (.docx)
- Plain Text (.txt)
- Markdown (.md)

*Extensible: Add more formats in `DocumentWatcher.SUPPORTED_FORMATS`*

### Usage

#### 1. Enable Watcher

```bash
docker-compose up
# Watcher starts automatically with WATCHER_ENABLED=true
```

#### 2. Add Documents

```bash
# Copy documents to watched directory
cp my_document.pdf ./data/docs/

# Watch the magic happen:
# - Document detected
# - File locked (processing indicator)
# - Chunks created
# - Embeddings generated
# - PostgreSQL stored
# - File archived to ./data/docs/archive/
```

#### 3. Monitor Progress

```bash
# Check watcher status via API
curl http://localhost:8100/api/watcher/status
```

Response:
```json
{
  "status": "running",
  "watch_dir": "/data/docs",
  "queue_size": 2,
  "processing_count": 1,
  "total_queued": 15,
  "total_processed": 12,
  "total_failed": 1,
  "total_archived": 12
}
```

#### 4. Test with Example Script

```bash
# Run the watcher example client
python docs/benchmarking/watcher_example.py --num-docs 5

# Or check status only
python docs/benchmarking/watcher_example.py --status-only

# Monitor for 60 seconds
python docs/benchmarking/watcher_example.py --monitor-duration 60
```

### Implementation Details

**File**: `app/watcher.py`

**Key Classes**:
- `DocumentWatcher`: Main watcher class
  - `start()`: Starts inotify or polling
  - `stop()`: Graceful shutdown
  - `get_stats()`: Query statistics

- `IngestQueue`: Queue management
  - `add()`: Queue file for processing
  - `mark_processing()`: Track in-progress files
  - `mark_completed()`: Track successful ingestions

**Key Methods**:
- `_start_inotify_watcher()`: Native Linux file monitoring
- `_start_polling_watcher()`: Fallback polling mechanism
- `_handle_file_event()`: Process detected files
- `_process_queue()`: Execute ingestion pipeline
- `_ingest_with_retry()`: Retry logic with backoff
- `_archive_file()`: Move to archive after success

### Retry Logic

Failed ingestions retry with exponential backoff:

```
Attempt 1: Immediate
Attempt 2: 2 seconds
Attempt 3: 4 seconds
Max Retries: 3 (configurable)
```

Example log:
```
INFO: Ingesting file (attempt 1/3): document.pdf
ERROR: Ingestion error - chunk size too large
INFO: Retrying in 2 seconds...
INFO: Ingesting file (attempt 2/3): document.pdf
INFO: Successfully ingested: document.pdf
```

### Archive System

After successful ingestion, files are moved to:
```
/data/docs/archive/{ISO_TIMESTAMP}_{original_filename}
```

Example:
```
/data/docs/archive/2026-05-11T12:34:56.123456_document.pdf
```

This provides:
- Clean input directory
- Audit trail (timestamp shows when processed)
- Easy recovery if needed
- Prevents reprocessing

### Disable Watcher (if needed)

```bash
# Via environment variable
docker-compose -e WATCHER_ENABLED=false up

# Or in .env file
echo "WATCHER_ENABLED=false" >> .env
```

### Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| File detection (inotify) | <100ms | Event-driven, instant |
| File detection (polling) | 5-10s | Interval-based, configurable |
| Ingestion (single PDF) | 2-5s | Depends on file size and chunks |
| Archive move | 100-500ms | Filesystem operation |
| Retry (exponential backoff) | 2-8s | Between attempts |

### Troubleshooting

**Files not being detected**:
1. Check watcher is running: `/api/watcher/status`
2. Verify `/data/docs` is mounted
3. Check file permissions (should be readable by container)
4. Look at logs: `docker logs rag-bootstrap-api`

**Ingestion failures**:
1. Check LLM availability (Ollama running)
2. Check database connection
3. Review error in watcher status
4. Re-copy file to trigger retry

**Archive directory growing**:
- Normal! Archives processed files
- Safe to clean up periodically
- Consider backup strategy for audit trail

### References

- [Watcher Implementation](../app/watcher.py)
- [Ingestion Pipeline](../app/ingestion.py)
- [Example Client](../docs/benchmarking/watcher_example.py)
- [Docker Compose Config](../docker-compose.yml)

## References

- [Design Document](./MODULARITY_DESIGN.md)
- [Test Suite](../tests/test_kb.py)
- [KB Interface](../app/kb.py)
- [PostgreSQL Implementation](../app/postgres_kb.py)
- [Keyword-Only Implementation](../app/keyword_only_kb.py)
- [Document Watcher](../app/watcher.py)
- [Streaming Endpoints](./API_V3_CHAT_STREAMING.md)
