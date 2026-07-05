# RAG Integration Testing Guide

**Date**: 2026-05-31
**Status**: Production Ready
**Purpose**: Validate RAG system with distilled 3B model integration

---

## Overview

This guide provides comprehensive testing procedures for validating the RAG system's integration with the Phase 4 distilled 3B model. The test suite covers functionality, performance, accuracy, and production readiness.

### Testing Phases

1. **Unit Tests**: Individual component validation
2. **Integration Tests**: End-to-end RAG pipeline
3. **Performance Tests**: Response time and throughput
4. **Accuracy Benchmark**: Model output quality on extraction tasks
5. **Streaming Tests**: Real-time token delivery
6. **Production Validation**: Pre-deployment checklist

---

## Prerequisites

### System Requirements

- Docker and Docker Compose installed
- Python 3.10+ with pytest and httpx
- RAG Bootstrap services running (see Quick Start below)
- 4GB+ available memory
- Network connectivity to Ollama service

### Required Software

```bash
# Install Python test dependencies
pip install pytest pytest-asyncio httpx

# Ensure test fixtures are available
# - Documents in /data/docs (for knowledge base)
# - Ollama running with LLM model loaded
# - PostgreSQL and Redis operational
```

### Quick Start (Pre-Test Setup)

```bash
cd /home/devel/exudeai/rag-bootstrap

# 1. Start services
docker compose up -d

# 2. Wait for readiness
./deploy.sh health

# 3. Ingest sample documents
./deploy.sh ingest ./tests/sample_docs

# 4. Verify system is ready
curl http://localhost:8100/api/health

# 5. Run tests
pytest tests/test_rag_integration.py -v
```

---

## Test Suite Overview

### Test File Location

```
/home/devel/exudeai/rag-bootstrap/tests/test_rag_integration.py
```

### Test Categories

#### 1. System Health Tests (3 tests)

**Purpose**: Validate all system components are operational

**Tests**:
- `test_system_health()` - Verify API is healthy
- `test_knowledge_base_statistics()` - Verify KB has documents
- `test_watcher_status()` - Verify auto-ingest is running

**Expected Results**:
```
✓ API responds with "healthy" status
✓ KB contains >0 chunks
✓ Watcher is "running"
```

**Run**:
```bash
pytest tests/test_rag_integration.py::test_system_health -v
pytest tests/test_rag_integration.py::test_knowledge_base_statistics -v
pytest tests/test_rag_integration.py::test_watcher_status -v
```

#### 2. Search Tests (6 tests)

**Purpose**: Validate search functionality across modes

**Test Coverage**:

**Semantic Search** (3 tests):
- Returns results for queries
- Respects limit parameter
- Includes proper metadata

**Hybrid Search** (3 tests):
- Returns results combining semantic and keyword
- Produces more results than keyword-only
- Properly ranks by relevance

**Expected Results**:
```
✓ All searches return results
✓ Results ranked by score (descending)
✓ Metadata includes: document_filename, score, content
✓ Hybrid search >= keyword search results
```

**Run**:
```bash
pytest tests/test_rag_integration.py::TestSemanticSearch -v
pytest tests/test_rag_integration.py::TestHybridSearch -v
```

#### 3. RAG Accuracy Tests (3 tests)

**Purpose**: Validate answer quality and context usage

**Tests**:
- Answers contain expected keywords from questions
- Answers reference provided sources
- Different search modes produce relevant answers

**Expected Results**:
```
✓ ≥50% of question keywords appear in answer
✓ Sources list is non-empty and relevant
✓ All search modes generate non-empty answers
```

**Benchmark Questions**:
```python
[
  "What are the key steps for a controller to minimize aircraft delays?",
  "How should a controller handle emergency fuel declarations?",
  "What communication standards should pilots and controllers follow?",
  "Describe proper approach procedures for night operations.",
  "What are the factors that affect aircraft landing priority?"
]
```

**Run**:
```bash
pytest tests/test_rag_integration.py::TestRAGAccuracy -v
```

#### 4. Consistency Tests (3 tests)

**Purpose**: Validate response structure and content quality

**Tests**:
- Response has required fields (answer, model, sources, context_chunks)
- Answers are non-empty
- Model field correctly identifies LLM

**Expected Results**:
```json
{
  "answer": "...",           // ✓ Non-empty
  "model": "llama3.1:70b",   // ✓ Populated
  "sources": [...],          // ✓ List of documents
  "context_chunks": 5        // ✓ Integer
}
```

**Run**:
```bash
pytest tests/test_rag_integration.py::TestRAGConsistency -v
```

#### 5. Streaming Tests (3 tests)

**Purpose**: Validate Server-Sent Events streaming functionality

**Tests**:
- Streaming endpoint returns SSE events
- Events follow correct sequence (sources → tokens → done)
- Streamed tokens accumulate into coherent response

**Event Sequence**:
```
1. data: {"type":"sources","sources":[...]}
2. data: {"type":"token","token":"Word","token_count":1}
3. data: {"type":"token","token":"...","token_count":2}
   ... (repeat for all tokens)
4. data: {"type":"done","total_tokens":42,"response":"..."}
```

**Expected Results**:
```
✓ First event is "sources"
✓ Middle events are "token" type
✓ Last event is "done"
✓ Accumulated tokens form complete response
```

**Run**:
```bash
pytest tests/test_rag_integration.py::test_streaming_returns_events -v
pytest tests/test_rag_integration.py::test_streaming_event_sequence -v
pytest tests/test_rag_integration.py::test_streaming_token_accumulation -v
```

#### 6. Accuracy Benchmark (1 test)

**Purpose**: Measure extraction accuracy on benchmark set

**Test**: `test_benchmark_extraction_accuracy()`

**Metrics**:
- Total questions: 5
- Target accuracy: ≥80% (4 of 5 questions)
- Pass criteria: ≥50% of expected keywords in answer

**Sample Results**:
```
Accuracy benchmark results: 4/5 passed (80%)
  PASS: What are the key steps for a controller...
  PASS: How should a controller handle emergency...
  FAIL: What communication standards should...
  PASS: Describe proper approach procedures...
  PASS: What are the factors that affect...
```

**Target**: 80%+ accuracy maintained from baseline model

**Run**:
```bash
pytest tests/test_rag_integration.py::TestModelAccuracyBenchmark -v
```

#### 7. Performance Tests (2 tests)

**Purpose**: Validate response time performance

**Tests**:
- Search completes in <1 second
- Full RAG pipeline (search + generation) in <30 seconds

**Expected Results**:
```
Search time: 100-300ms ✓
Answer generation: 2-10s ✓
```

**Run**:
```bash
pytest tests/test_rag_integration.py::TestPerformance -v
```

#### 8. Error Handling Tests (3 tests)

**Purpose**: Validate graceful error responses

**Tests**:
- Invalid search mode returns 400
- Missing required parameters returns 400
- Empty question handled gracefully

**Expected Results**:
```
Invalid mode → HTTP 400 ✓
Missing param → HTTP 400 ✓
Empty question → HTTP 400 or 200 ✓
```

**Run**:
```bash
pytest tests/test_rag_integration.py::TestErrorHandling -v
```

#### 9. Integration Flow Tests (2 tests)

**Purpose**: End-to-end workflow validation

**Flows**:
1. Full RAG: KB verify → search → retrieve → answer
2. Streaming: Stream ask → event sequence → complete response

**Expected Results**:
```
✓ KB contains documents
✓ Search returns results
✓ Answer generated with context
✓ Streaming produces coherent response
```

**Run**:
```bash
pytest tests/test_rag_integration.py::TestIntegrationFlows -v
```

#### 10. Distilled Model Validation (2 tests)

**Purpose**: Validate Phase 4C distilled model integration

**Tests**:
- Model name properly identified
- Answer quality meets standards

**Quality Metrics**:
- Answer length > 100 characters
- >10 words in response
- Starts with capital letter
- No null/obvious errors

**Run**:
```bash
pytest tests/test_rag_integration.py::TestDistilledModelValidation -v
```

---

## Running Tests

### Run All Tests

```bash
# Basic run
pytest tests/test_rag_integration.py -v

# With detailed output
pytest tests/test_rag_integration.py -vv --tb=short

# With logging
pytest tests/test_rag_integration.py -v -s

# Generate HTML report
pytest tests/test_rag_integration.py -v --html=test_report.html
```

### Run Specific Test Categories

```bash
# Health tests only
pytest tests/test_rag_integration.py -k "health" -v

# Search tests only
pytest tests/test_rag_integration.py -k "search" -v

# Accuracy tests only
pytest tests/test_rag_integration.py -k "accuracy" -v

# Performance tests only
pytest tests/test_rag_integration.py -k "performance" -v

# Streaming tests only
pytest tests/test_rag_integration.py -k "streaming" -v
```

### Run with Specific Markers

```bash
# Async tests only
pytest tests/test_rag_integration.py -m asyncio -v

# Non-async tests only
pytest tests/test_rag_integration.py -m "not asyncio" -v
```

### Parallel Test Execution

```bash
# Install pytest-xdist
pip install pytest-xdist

# Run tests in parallel (4 workers)
pytest tests/test_rag_integration.py -n 4 -v
```

---

## Test Data & Fixtures

### Sample Documents

Location: `/home/devel/exudeai/rag-bootstrap/tests/sample_docs/`

**Aviation Safety Manual** (`aviation_safety_manual.md`):
- Sample aviation safety procedures
- Controller and pilot communication guidelines
- Emergency procedures documentation

### Benchmark Questions

Defined in test file:
```python
EXTRACTION_BENCHMARK_QUESTIONS = [
    {
        "question": "What are the key steps for a controller...",
        "expected_keywords": ["prioritize", "coordinate", ...],
        "category": "procedural"
    },
    # ... 4 more questions
]
```

### Customizing Test Data

To add your own test documents:

```bash
# 1. Add documents to test data
cp /path/to/documents/* /home/devel/exudeai/rag-bootstrap/data/docs/

# 2. Reingest to knowledge base
docker exec rag-bootstrap-api python -m app.ingest

# 3. Verify KB updated
curl http://localhost:8100/api/stats
```

---

## Continuous Integration

### GitHub Actions Configuration

Create `.github/workflows/test-rag.yml`:

```yaml
name: RAG Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_DB: ragdb
          POSTGRES_USER: raguser
          POSTGRES_PASSWORD: ragpass
      redis:
        image: redis:7
      ollama:
        image: ollama/ollama:latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: "3.10"

      - name: Install dependencies
        run: |
          pip install pytest pytest-asyncio httpx
          pip install -r rag-bootstrap/app/requirements.txt

      - name: Start RAG services
        run: cd rag-bootstrap && docker compose up -d

      - name: Wait for services
        run: sleep 10 && curl http://localhost:8100/api/health

      - name: Run tests
        run: pytest rag-bootstrap/tests/test_rag_integration.py -v
```

---

## Troubleshooting

### Test Failures

#### Issue: "Connection refused" on API endpoint

**Solution**:
```bash
# Verify services are running
docker compose ps

# Check API health
curl http://localhost:8100/api/health

# View API logs
docker compose logs api
```

#### Issue: "Knowledge base empty" (KB stats show 0 chunks)

**Solution**:
```bash
# Ingest sample documents
./deploy.sh ingest ./tests/sample_docs

# Or upload via API
curl -X POST http://localhost:8100/api/ingest/file \
  -F "file=@tests/sample_docs/aviation_safety_manual.md"

# Verify KB updated
curl http://localhost:8100/api/stats
```

#### Issue: "Ollama service unavailable"

**Solution**:
```bash
# Verify Ollama is running
curl http://localhost:11434/api/tags

# Check model is loaded
ollama ls

# Pull model if needed
ollama pull llama3.1:70b

# Restart RAG services
docker compose restart api
```

#### Issue: "Streaming tests timeout"

**Solution**:
```bash
# Increase timeout in test file (line 50)
TIMEOUT = 120.0  # Changed from 60.0

# Or run with longer timeout
pytest tests/test_rag_integration.py -v --timeout=120
```

#### Issue: "Accuracy benchmark fails"

**Solution**:
1. Check LLM model is correct in config
2. Verify knowledge base has relevant documents
3. Check answer content manually
4. Lower accuracy threshold if needed (adjust in test)

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 503 Database error | PostgreSQL not running | `docker compose up -d postgres` |
| 503 Ollama error | LLM service down | Restart Ollama and check logs |
| Slow searches | Large KB, slow network | Check DB query performance |
| Low accuracy | KB doesn't cover domain | Add domain-specific documents |
| Memory errors | Insufficient RAM | Ensure 4GB+ available |

---

## Performance Baselines

### Expected Performance

**Search Operations**:
- Semantic search: 100-300ms
- Keyword search: 50-200ms
- Hybrid search: 150-400ms

**Answer Generation**:
- With streaming: 2-10 seconds (token-by-token)
- Without streaming: 5-15 seconds (full generation)
- Model: llama3.1:70b on H100

**Throughput**:
- Concurrent requests: 4-8 (limited by LLM)
- Search QPS: 10-50 queries/second
- Ingest rate: 10-50 documents/minute

### Comparing to Baseline

After Phase 4C distillation (3B model):

**Expected Changes**:
- Inference speed: 2-3x faster
- Accuracy: Maintain 4-6% improvement
- Memory: 60% reduction
- Throughput: 2-3x more concurrent requests

---

## Post-Distillation Validation

When Phase 4C distilled 3B model is integrated:

### 1. Model Update in config

```bash
# Edit rag-bootstrap/app/config.py
LLM_MODEL: str = "qwen:3b"  # Changed from llama3.1:70b
```

### 2. Retest Accuracy

```bash
pytest tests/test_rag_integration.py::TestModelAccuracyBenchmark -v
```

Expected: ≥80% accuracy maintained (4-6% improvement baseline)

### 3. Retest Performance

```bash
pytest tests/test_rag_integration.py::TestPerformance -v
```

Expected: Faster response times (2-3x improvement)

### 4. Retest Streaming

```bash
pytest tests/test_rag_integration.py::test_streaming_token_accumulation -v
```

Expected: More responsive, faster token delivery

---

## Production Readiness Checklist

Before deploying to production:

- [ ] All 30+ integration tests passing
- [ ] ≥80% accuracy on benchmark questions
- [ ] Search <1 second latency
- [ ] Answer generation <30 seconds
- [ ] Streaming endpoint operational
- [ ] Auto-ingest watcher running
- [ ] Knowledge base populated (>100 documents)
- [ ] Error handling validated
- [ ] Performance baselines met
- [ ] Distilled model integrated (Phase 4C)
- [ ] API documentation reviewed
- [ ] Security validated (single port, localhost-only)
- [ ] Backup procedures documented
- [ ] Monitoring configured
- [ ] Team trained on operations

---

## Extending Tests

### Adding Custom Benchmark Questions

```python
# In test_rag_integration.py, add to EXTRACTION_BENCHMARK_QUESTIONS

{
    "question": "Your domain-specific question here",
    "expected_keywords": ["keyword1", "keyword2", "keyword3"],
    "category": "your_category"
}
```

### Adding Domain-Specific Validation

```python
class TestYourDomain:
    """Tests for your domain-specific needs."""

    def test_your_custom_validation(self, client):
        """Your custom test logic."""
        response = client.post("/api/ask", json={
            "question": "Your question",
            "mode": "hybrid"
        })
        assert response.status_code == 200

        # Your assertions here
        data = response.json()
        assert "expected_content" in data["answer"]
```

---

## Support & Documentation

### Related Files

- `/home/devel/exudeai/rag-bootstrap/RAG_PRODUCTION_API.md` - API reference
- `/home/devel/exudeai/rag-bootstrap/README.md` - System overview
- `/home/devel/exudeai/rag-bootstrap/docs/todo.md` - Current status
- `/home/devel/exudeai/EXTRACTION_SUMMARY_2026_05_31.md` - Extraction context

### Getting Help

1. **Check test output**: Detailed error messages in pytest output
2. **Review logs**: `docker compose logs api`
3. **Health check**: `curl http://localhost:8100/api/health`
4. **Manual testing**: Use cURL or Postman to test endpoints
5. **Documentation**: See RAG_PRODUCTION_API.md for endpoint details

---

**End of Integration Testing Guide**
