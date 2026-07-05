# RAG Bootstrap — Modularity Design

## Vision

Transform rag-bootstrap from a single-mode RAG system into a **composable knowledge system** that supports:

1. **Chat Mode** — Pure conversation, no retrieval
2. **Single RAG Mode** — Current implementation (one KB, one embedding model)
3. **Multi-RAG Mode** — Multiple independent knowledge bases with intelligent routing
4. **Hybrid Mode** — Combination of chat, multiple RAGs, and tools
5. **No-Embedding Mode** — Keyword-only search, no vector storage

## Current Architecture

```
┌─────────────────────────────────────────┐
│ FastAPI App (main.py)                   │
├─────────────────────────────────────────┤
│ • /api/search — Single KB only           │
│ • /api/ask — Single KB only              │
│ • /api/ingest — Single KB only           │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴───────┬──────────────┐
       │               │              │
    ┌──┴──┐      ┌─────┴──┐    ┌──────┴────┐
    │Search│      │Embeddings│    │Database  │
    ├──────┤      ├──────────┤    ├──────────┤
    │ • sem│      │ • Ollama │    │ postgres │
    │ • kw │      │ • local  │    │ pgvector │
    │ • hy │      │ • cache  │    │ redis    │
    └──────┘      └──────────┘    └──────────┘
```

**Constraints:**
- Single hardcoded PostgreSQL instance
- Single embedding model
- No routing logic
- No KB isolation

## Proposed Modular Architecture

### 1. Knowledge Base Layer (Abstraction)

```python
# kb.py — Knowledge Base Interface

class KnowledgeBase(ABC):
    """Abstraction for document storage + retrieval."""

    @abstractmethod
    async def ingest(self, documents: List[Document]) -> None:
        """Store documents."""

    @abstractmethod
    async def search(
        self, query: str, mode: SearchMode, limit: int
    ) -> List[SearchResult]:
        """Retrieve relevant chunks."""

    @abstractmethod
    async def delete(self, document_id: int) -> None:
        """Remove document."""


# Implementations:
class PostgresKB(KnowledgeBase):
    """Current single-instance KB (postgres + pgvector)."""

class MultiPostgresKB(KnowledgeBase):
    """Multiple postgres instances (per-domain, per-tenant)."""

class KeywordOnlyKB(KnowledgeBase):
    """No embeddings, pure keyword search."""
```

### 2. Knowledge Registry

```python
# registry.py — KB Lifecycle Management

class KnowledgeRegistry:
    """Manages multiple named knowledge bases."""

    async def create(
        self, name: str, kb_type: str, config: Dict
    ) -> KnowledgeBase:
        """Create new KB (postgres, keyword-only, etc.)."""

    async def get(self, name: str) -> KnowledgeBase:
        """Retrieve KB by name."""

    async def list(self) -> List[str]:
        """List all KB names."""

    async def delete(self, name: str) -> None:
        """Remove KB (cascade)."""


# Usage:
registry = KnowledgeRegistry()
kb1 = await registry.create("atc", "postgres", {...})
kb2 = await registry.create("rag", "keyword-only", {...})
```

### 3. Router Layer (Multi-RAG Mode)

```python
# router.py — KB Selection for Queries

class KnowledgeRouter(ABC):
    """Route queries to appropriate KB(s)."""

    @abstractmethod
    async def route(self, query: str) -> List[str]:
        """Return list of KB names to search."""


class StaticRouter(KnowledgeRouter):
    """Static mapping: topics → KB names."""

class LLMRouter(KnowledgeRouter):
    """LLM-based routing: ask LLM which KBs to use."""

class BroadcastRouter(KnowledgeRouter):
    """Search all KBs, merge results."""
```

### 4. Search Pipeline (Mode Support)

```python
# search_pipeline.py — Unified Search Interface

class SearchPipeline:
    """Handles all search modes."""

    async def search(
        self,
        query: str,
        mode: SearchMode,
        kb_selector: str | List[str] = "all",
        embedding_required: bool = True,
    ) -> List[SearchResult]:
        """
        Search one or more KBs.

        kb_selector:
          - "all" → search all KBs (broadcast)
          - "primary" → search main KB
          - ["kb1", "kb2"] → search specific KBs
          - Use router if kb_selector is callable

        embedding_required:
          - True → fail if KB lacks embeddings
          - False → fallback to keyword-only
        """

        kbs = await self._resolve_kbs(kb_selector)

        # If embedding_required=False and KB lacks embeddings,
        # downgrade to keyword-only search
        all_results = []
        for kb in kbs:
            results = await kb.search(query, mode, limit=limit)
            all_results.extend(results)

        return self._merge_results(all_results)
```

### 5. Configuration Structure

```yaml
# config.yaml — Multi-KB Configuration

mode: multi-rag  # chat, single-rag, multi-rag, hybrid

knowledge_bases:
  primary:
    type: postgres
    name: rag-bootstrap-primary  # docker network name
    host: postgres-primary
    port: 5432
    db: ragdb

  atc:
    type: postgres
    name: rag-bootstrap-atc
    host: postgres-atc
    port: 5433
    db: atcdb

  keyword-only:
    type: keyword-only
    # No embedding config needed

router:
  type: static  # static, llm, broadcast
  static:
    default: primary
    rules:
      - pattern: "ATC|pilot|radio"
        kb: atc
      - pattern: ".*"
        kb: primary

embedding:
  enabled: true
  model: nomic-embed-text
  backend: ollama
  fallback_to_keyword: true  # Use keyword if embedding fails
```

### 6. API Endpoints (Extended)

```python
# New endpoints for multi-KB support:

GET  /api/knowledge-bases           # List all KBs
POST /api/knowledge-bases           # Create KB
GET  /api/knowledge-bases/{name}    # KB details
DELETE /api/knowledge-bases/{name}  # Delete KB

POST /api/search?kb=name|all        # Search specific KB(s)
POST /api/ask?kb=name|all           # Ask with KB routing

GET  /api/router/routes             # View routing rules
POST /api/router/routes             # Update rules
```

### 7. Docker Compose Evolution

**Current (single KB):**
```yaml
postgres:
  image: pgvector/pgvector:pg16
redis:
  image: redis:7-alpine
```

**Future (multi-KB):**
```yaml
postgres-primary:
  image: pgvector/pgvector:pg16

postgres-atc:
  image: pgvector/pgvector:pg16

postgres-research:
  image: pgvector/pgvector:pg16

redis:  # Shared across all KBs
  image: redis:7-alpine
```

## Implementation Phases

### Phase 1: Knowledge Base Abstraction
- [x] Design KB interface
- [ ] Implement PostgresKB (refactor current)
- [ ] Implement KeywordOnlyKB
- [ ] Add tests (50+ tests)

### Phase 2: Knowledge Registry
- [ ] Implement registry with in-memory + persistent storage
- [ ] Database schema for KB metadata
- [ ] Registration/discovery API
- [ ] Tests (40+ tests)

### Phase 3: Router Layer
- [ ] StaticRouter implementation
- [ ] Route configuration format (YAML)
- [ ] API endpoints for route management
- [ ] Tests (30+ tests)

### Phase 4: Multi-RAG Docker
- [ ] Multi-postgres docker-compose template
- [ ] Network isolation
- [ ] Health checks
- [ ] Automated setup script

### Phase 5: Chat Mode
- [ ] Chat endpoint without KB context
- [ ] Conversation history management
- [ ] Optional RAG augmentation

### Phase 6: Documentation & Examples
- [ ] Architecture guide
- [ ] Multi-KB setup guide
- [ ] Routing rules guide
- [ ] Example configs (ATC, research, podcast)

## Extension Points

Developers can easily extend rag-bootstrap:

```python
# Custom KB backend
class MyCustomKB(KnowledgeBase):
    async def ingest(self, docs): ...
    async def search(self, query, mode, limit): ...
    async def delete(self, doc_id): ...

# Register it
registry.register_backend("my-custom", MyCustomKB)

# Use in config.yaml
knowledge_bases:
  custom:
    type: my-custom
    host: my-server
```

## Benefits

| Benefit | Current | Modular |
|---------|---------|----------|
| Single KB only | ✅ | ❌ |
| Multiple KBs | ❌ | ✅ |
| Topic routing | ❌ | ✅ |
| No embeddings mode | ❌ | ✅ |
| Custom KB backends | ❌ | ✅ |
| Chat + RAG | ❌ | ✅ |
| Multi-domain RAG | ❌ | ✅ |

## Backwards Compatibility

Old single-KB configs still work:
```yaml
# Old style (still supported)
network:
  name: rag-bootstrap
  port: 8100

ingestion:
  directories: [./docs]
```

Internally migrated to:
```yaml
mode: single-rag
knowledge_bases:
  primary:
    type: postgres
    ...
router:
  type: static
  default: primary
```

## Testing Strategy

- **Unit tests** (150+): KB backends, registry, router, search pipeline
- **Integration tests** (30+): Multi-KB flows, Docker Compose
- **End-to-end tests** (15+): Full workflows (chat, single-RAG, multi-RAG)
- **Performance tests** (10+): Multi-KB search latency

---

**Total estimated LOC**: 2,500–3,000 (from 1,386 current)
**Phase 1-2 foundation**: 800 LOC, 80+ tests
**Phase 3-6 completion**: 1,700 LOC, 170+ tests
