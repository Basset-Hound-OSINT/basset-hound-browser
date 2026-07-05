# Integration Testing Guide — Phase 5

> **ARCHIVED (2026-07-03)**: Superseded as the primary testing guide by
> [`../integration/RAG_INTEGRATION_TESTING_GUIDE.md`](../integration/RAG_INTEGRATION_TESTING_GUIDE.md)
> (2026-05-31, Production Ready). Retained because it contains unique **multi-KB**
> setup and testing content (`docker-compose.multi-kb.yml`) not covered by the newer guide.

**Purpose**: Guide for testing the multi-KB RAG system with real services
**Status**: Ready for implementation
**Date**: 2026-05-06

---

## Prerequisites

### Required Services

1. **Ollama** (LLM and Embeddings)
   - Download: https://ollama.ai
   - Models: `llama3.1:70b` (or compatible), `nomic-embed-text`
   - Port: 11434 (default)

2. **PostgreSQL** with pgvector
   - Option 1: Docker image `pgvector/pgvector:pg16`
   - Option 2: Local PostgreSQL 14+ with `CREATE EXTENSION vector;`

3. **Redis** (Optional, for caching)
   - Docker: `redis:7-alpine`
   - Port: 6379 (default)

---

## Setup Steps

### 1. Start Ollama

```bash
# Download and run Ollama
ollama pull llama3.1:70b
ollama pull nomic-embed-text
ollama serve

# In another terminal, verify:
curl http://localhost:11434/api/tags
```

### 2. Start PostgreSQL Databases

#### Option A: Docker (Recommended)

```bash
# Primary KB
docker run --name pg-primary \
  -e POSTGRES_DB=ragdb_primary \
  -e POSTGRES_USER=raguser \
  -e POSTGRES_PASSWORD=ragpass \
  -p 5432:5432 \
  -v pg-primary:/var/lib/postgresql/data \
  pgvector/pgvector:pg16

# ATC KB
docker run --name pg-atc \
  -e POSTGRES_DB=ragdb_atc \
  -e POSTGRES_USER=raguser \
  -e POSTGRES_PASSWORD=ragpass \
  -p 5433:5432 \
  -v pg-atc:/var/lib/postgresql/data \
  pgvector/pgvector:pg16

# Research KB
docker run --name pg-research \
  -e POSTGRES_DB=ragdb_research \
  -e POSTGRES_USER=raguser \
  -e POSTGRES_PASSWORD=ragpass \
  -p 5434:5432 \
  -v pg-research:/var/lib/postgresql/data \
  pgvector/pgvector:pg16

# Verify
psql -h localhost -U raguser -d ragdb_primary -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

#### Option B: Docker Compose (Full Stack)

```bash
docker compose -f docker-compose.multi-kb.yml up -d

# Verify all services are healthy
docker compose -f docker-compose.multi-kb.yml ps

# Check logs
docker compose -f docker-compose.multi-kb.yml logs -f api
```

### 3. Start Redis (Optional)

```bash
docker run --name rag-redis \
  -p 6379:6379 \
  -d \
  redis:7-alpine

# Verify
redis-cli ping
```

### 4. Configure Environment

Create `.env` file in `rag-bootstrap/`:

```bash
# PostgreSQL
PRIMARY_DB_HOST=localhost
PRIMARY_DB_PORT=5432
PRIMARY_DB_NAME=ragdb_primary
PRIMARY_DB_USER=raguser
PRIMARY_DB_PASSWORD=ragpass

ATC_DB_HOST=localhost
ATC_DB_PORT=5433
ATC_DB_NAME=ragdb_atc
ATC_DB_USER=raguser
ATC_DB_PASSWORD=ragpass

RESEARCH_DB_HOST=localhost
RESEARCH_DB_PORT=5434
RESEARCH_DB_NAME=ragdb_research
RESEARCH_DB_USER=raguser
RESEARCH_DB_PASSWORD=ragpass

# Redis
REDIS_URL=redis://localhost:6379/0

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
LLM_MODEL=llama3.1:70b
LLM_TEMPERATURE=0.3

# Router
ROUTER_TYPE=broadcast
```

### 5. Start RAG Bootstrap API

```bash
cd rag-bootstrap

# Install dependencies (if not done)
pip install -r requirements.txt

# Run API
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# In another terminal, verify health
curl http://localhost:8000/api/health
```

---

## Integration Tests

### 1. Ingest Documents

```bash
# Create test directory
mkdir -p test_documents

# Create sample documents
cat > test_documents/atc_basics.txt << 'EOF'
Air Traffic Control (ATC) Basics

ATC is a system that separates aircraft to provide safe, orderly, and expeditious flow of air traffic.
Controllers use radar, radio, and visual observation to monitor and guide aircraft.

Key responsibilities:
1. Separation of aircraft
2. Sequencing of arrivals/departures
3. Regulation of traffic flow
4. Issuing instructions and clearances
EOF

cat > test_documents/approach_procedures.txt << 'EOF'
Approach Procedures

Standard Instrument Approach Procedures (SIAP) provide pilots with prescribed routes and altitude restrictions.

Types of approaches:
1. ILS (Instrument Landing System)
2. VOR (VHF Omnidirectional Range)
3. NDB (Non-Directional Beacon)
4. GPS (Global Positioning System)

Each approach has minimum visibility and ceiling requirements.
EOF

# Ingest documents
curl -X POST http://localhost:8000/api/ingest/directory \
  -H "Content-Type: application/json" \
  -d '{"path": "test_documents"}'

# Verify ingestion
curl http://localhost:8000/api/documents
```

### 2. Test Search (API v1)

```bash
# Semantic search
curl -X POST http://localhost:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is air traffic control?",
    "mode": "semantic",
    "limit": 5
  }'

# Keyword search
curl -X POST http://localhost:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "radar procedures",
    "mode": "keyword",
    "limit": 5
  }'

# Hybrid search
curl -X POST http://localhost:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "instrument approach",
    "mode": "hybrid",
    "limit": 5
  }'
```

### 3. Test Ask (RAG)

```bash
curl -X POST http://localhost:8000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the main responsibilities of air traffic control?",
    "mode": "semantic",
    "limit": 5
  }'
```

### 4. Test Chat Session (API v3)

```bash
# Create session
SESSION=$(curl -s -X POST http://localhost:8000/api/v3/chat/session | jq -r '.session_id')

echo "Session ID: $SESSION"

# Send message with RAG
curl -X POST http://localhost:8000/api/v3/chat/$SESSION/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is air traffic control?",
    "use_rag": true,
    "mode": "semantic"
  }' | jq .

# Send message without RAG
curl -X POST http://localhost:8000/api/v3/chat/$SESSION/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the capital of France?",
    "use_rag": false
  }' | jq .

# Get history
curl http://localhost:8000/api/v3/chat/$SESSION/history | jq .

# Clear history
curl -X POST http://localhost:8000/api/v3/chat/$SESSION/clear

# Delete session
curl -X DELETE http://localhost:8000/api/v3/chat/$SESSION
```

### 5. Test WebSocket Streaming

#### Using websocat (CLI)

```bash
# Install websocat
cargo install websocat

# Connect and send messages
websocat ws://localhost:8000/api/v3/ws/chat/test-session-id

# In websocat, type and hit Enter:
{"type": "message", "content": "What is ATC?", "use_rag": true}

# Watch for streaming response
```

#### Using Python

```python
import asyncio
import json
import websockets
import sys

async def chat(session_id):
    uri = f"ws://localhost:8000/api/v3/ws/chat/{session_id}"

    async with websockets.connect(uri) as websocket:
        # Send message
        message = {
            "type": "message",
            "content": "What is air traffic control?",
            "use_rag": True,
            "mode": "semantic"
        }

        print(f"Sending: {json.dumps(message)}")
        await websocket.send(json.dumps(message))

        # Receive responses
        print("\nResponse:")
        async for response in websocket:
            data = json.loads(response)

            if data["type"] == "thinking":
                print(f"[Thinking] {data['data']}")
            elif data["type"] == "token":
                print(data["data"], end="", flush=True)
            elif data["type"] == "complete":
                print(f"\n\n[Complete]")
                sources = data["data"].get("sources", [])
                if sources:
                    print(f"Sources: {len(sources)} document(s)")
                    for src in sources:
                        print(f"  - {src['document_filename']} (score: {src['score']:.2f})")
                break
            elif data["type"] == "error":
                print(f"\n[Error] {data['data']}")
                break

if __name__ == "__main__":
    session_id = sys.argv[1] if len(sys.argv) > 1 else "test-session"
    asyncio.run(chat(session_id))
```

Run:
```bash
python websocket_test.py test-session-123
```

---

## Test Scenarios

### Scenario 1: Broadcast Router

**Setup**: Multiple KBs, broadcast router

**Steps**:
1. Create 3 PostgreSQL databases with different documents
2. Ingest different domain knowledge into each KB
3. Search with broadcast router
4. Verify all KBs are queried

**Expected**: Results from all 3 KBs merged and returned

### Scenario 2: Static Router

**Setup**: Static router with pattern rules

**Steps**:
1. Configure router with pattern: `"atc|airport" → "atc_kb"`
2. Search for "LAHSO procedures"
3. Verify only atc_kb is queried

**Expected**: Results only from atc_kb

### Scenario 3: LLM Router

**Setup**: LLM router for semantic routing

**Steps**:
1. Train router with sample queries per KB
2. Query: "Research on neural networks"
3. Query: "ATC separation standards"
4. Verify correct KB selection

**Expected**: Queries routed to correct KB based on content

### Scenario 4: RAG-Augmented Chat

**Setup**: Chat mode with RAG enabled

**Steps**:
1. Ingest domain documents
2. Create chat session
3. Send query: "Summarize the main points about ATC"
4. Verify response includes citations

**Expected**: Response includes document excerpts and sources

### Scenario 5: Pure Chat Mode

**Setup**: Chat mode with RAG disabled

**Steps**:
1. Create chat session with `use_rag=false`
2. Send query: "What is the capital of France?"
3. Verify response from LLM, no document context

**Expected**: Pure conversational response, no sources

### Scenario 6: Multi-Turn Conversation

**Setup**: WebSocket connection

**Steps**:
1. Send message 1: "What is ATC?"
2. Send message 2: "Explain the separation standards"
3. Send message 3: "How is this different from civilian traffic?"
4. Verify conversation maintains context

**Expected**: Responses show context from previous turns

### Scenario 7: History Compaction

**Setup**: Chat session with many messages

**Steps**:
1. Send 50+ messages
2. Verify history is automatically compacted
3. Retrieve history and check message count

**Expected**: History compacted, memory usage stable

---

## Performance Benchmarks

### 1. Search Performance

```bash
#!/bin/bash

# Benchmark semantic search
time curl -X POST http://localhost:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is air traffic control?",
    "mode": "semantic"
  }'

# Expected: 100-500ms
```

### 2. Chat Response Time

```bash
#!/bin/bash

# Benchmark chat response
time curl -X POST http://localhost:8000/api/v3/chat/{session_id}/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is ATC?",
    "use_rag": true
  }'

# Expected: 2-10 seconds (LLM dependent)
```

### 3. Token Streaming Rate

```bash
# Use websocket_test.py and measure time for response
# Expected: 5-10 tokens per second on GPU, 1-3 on CPU
```

---

## Troubleshooting

### Ollama Connection Failed

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# If failed, start Ollama
ollama serve
```

### PostgreSQL Connection Failed

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Check credentials
psql -h localhost -U raguser -d ragdb_primary -c "SELECT 1"
```

### Redis Connection Failed

```bash
# Check Redis is running
redis-cli ping

# If failed, start Redis
redis-server
```

### Embedding Service Timeout

**Issue**: Embedding requests timeout
**Solution**:
1. Check Ollama is running and responsive
2. Check model is loaded: `curl http://localhost:11434/api/tags`
3. Increase timeout in config (if implemented)

### LLM Response Too Slow

**Issue**: Chat responses take 30+ seconds
**Solution**:
1. Use smaller model: `llama2:7b` instead of `llama3.1:70b`
2. Reduce `max_tokens` in config
3. Use GPU if available

### WebSocket Disconnects

**Issue**: WebSocket connection drops
**Solution**:
1. Check network connectivity
2. Increase timeout in client
3. Implement reconnection logic (Phase 5)

---

## Test Checklist

### API v1 (Legacy)
- [x] Document ingestion
- [x] Semantic search
- [x] Keyword search
- [x] Hybrid search
- [x] Ask (with RAG)
- [x] Health check

### API v2 (Multi-KB)
- [ ] Create knowledge base
- [ ] List knowledge bases
- [ ] Search specific KB
- [ ] Search all KBs
- [ ] Router decision estimation
- [ ] Health per KB

### API v3 (Chat + Streaming)
- [ ] Create session
- [ ] Send message (with RAG)
- [ ] Send message (without RAG)
- [ ] Get history
- [ ] Clear history
- [ ] Delete session
- [ ] List sessions
- [ ] WebSocket message
- [ ] WebSocket streaming
- [ ] WebSocket clear
- [ ] WebSocket list messages

### Docker
- [ ] docker-compose up succeeds
- [ ] All services healthy
- [ ] API accessible on port 8100
- [ ] Databases initialized
- [ ] Redis started

### Performance
- [ ] Search < 500ms
- [ ] Chat response < 20s
- [ ] Token streaming visible
- [ ] No memory leaks

### Error Handling
- [ ] 404 for nonexistent session
- [ ] 400 for invalid request
- [ ] Graceful WebSocket disconnect
- [ ] Error messages clear

---

## Continuous Integration

### Pre-Commit Checks

```bash
# Run linting
flake8 app/ tests/

# Run type checking
mypy app/ tests/

# Run tests
pytest tests/ -v

# Check coverage
pytest tests/ --cov=app --cov-report=html
```

### CI Pipeline

```yaml
# Example GitHub Actions
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
      redis:
        image: redis:7-alpine
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: pytest tests/ -v
```

---

## Next Steps

### Phase 5: Production Hardening
- [ ] Session persistence to database
- [ ] Authentication/authorization
- [ ] Rate limiting
- [ ] WebSocket reconnection
- [ ] Response caching

### Phase 6: Advanced Features
- [ ] Cross-KB re-ranking
- [ ] Query decomposition
- [ ] KB versioning
- [ ] Distributed indexing

### Phase 7: Integration
- [ ] ResearchHub integration
- [ ] Cognitive engine connection
- [ ] Production deployment guide
- [ ] Operational monitoring

---

## Resources

### Documentation
- [Ollama Docs](https://ollama.ai)
- [pgvector](https://github.com/pgvector/pgvector)
- [FastAPI WebSockets](https://fastapi.tiangolo.com/advanced/websockets/)
- [Docker Compose](https://docs.docker.com/compose/)

### Tools
- **websocat**: WebSocket CLI tool
- **curl**: HTTP client
- **redis-cli**: Redis CLI
- **psql**: PostgreSQL CLI

---

## Status

**Integration Testing Guide**: ✅ Complete
**Ready For**: Phase 5 implementation
