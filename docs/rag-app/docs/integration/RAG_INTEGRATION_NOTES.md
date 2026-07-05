# RAG Integration Notes: Phase 4 Model Integration

**Date**: 2026-05-31
**Status**: Production Planning
**Purpose**: Integration guide for Phase 4A-E deliverables

---

## Overview

This document captures integration points and procedures for incorporating Phase 4A-E deliverables (curriculum-trained and distilled models) into the RAG Bootstrap system.

### Timeline

```
Phase 4A: May 20-22   → 4 curriculum variants trained on 7B base
Phase 4B: May 8-19    → Dataset scaled to 12,000 pairs
Phase 4C: May 23-27   → Best 7B variant distilled to 3B
Phase 4D: May 28-30   → Integration testing and validation
Phase 4E: May 31      → Production deployment
```

### Integration Milestones

- **Checkpoint 1 (May 20)**: Phase 4A started, baseline metrics recorded
- **Checkpoint 2 (May 23)**: Best curriculum variant identified
- **Checkpoint 3 (May 27)**: Distilled 3B model ready for integration
- **Checkpoint 4 (May 30)**: Integration tests passing, ready for production
- **Checkpoint 5 (May 31)**: Production deployment with new model

---

## Current State (May 31, 2026)

### RAG Bootstrap Status

**Deployed Version**: Phase A (v1.0.0)
- ✓ SSE streaming endpoint (`/api/ask/stream`)
- ✓ Auto-ingest watcher with inotify
- ✓ Search functionality (semantic, keyword, hybrid)
- ✓ LLM integration with Ollama
- ✓ Docker infrastructure complete

**Current LLM Model**: `llama3.1:70b`
- Baseline accuracy: ~78% on extraction tasks
- Response time: 2-10 seconds per query
- Memory footprint: 70B parameters

**Knowledge Base**: Prepared and populated
- Documents: 40+ ingested during testing
- Chunks: 500+ indexed and searchable
- Search modes: All operational

**Testing Infrastructure**: Complete
- 30+ integration tests available
- Performance benchmarks established
- Accuracy measurement framework in place

---

## Phase 4C Integration (Distilled Model)

### Model Replacement Procedure

#### Step 1: Prepare Distilled Model

**Timeline**: Phase 4C completion (May 23-27)

**Deliverable**: `qwen:3b-distilled-v4a` checkpoint
- Source: Phase 4A best curriculum variant
- Distillation target: Qwen 3B base model
- Validation: Maintains 4-6% accuracy improvement

**Model Availability**:
- Location: HPC cluster model directory
- Format: Ollama-compatible weights
- Size: ~3GB

#### Step 2: Load Model into Ollama

```bash
# On HPC cluster or deployment machine

# 1. Pull base model if not present
ollama pull qwen:3b

# 2. Create modelfile for distilled version
cat > Modelfile.distilled << 'EOF'
FROM qwen:3b

# Distilled weights from Phase 4C
ADAPTER /path/to/distilled_weights

# System prompt for RAG
SYSTEM You are a helpful AI assistant...
EOF

# 3. Create custom model
ollama create qwen:3b-distilled-v4a -f Modelfile.distilled

# 4. Verify model is available
ollama list | grep qwen:3b-distilled
```

#### Step 3: Update RAG Configuration

**File**: `/home/devel/exudeai/rag-bootstrap/app/config.py`

**Change**:
```python
# Before (Phase A baseline)
LLM_MODEL: str = "llama3.1:70b"

# After (Phase 4E production)
LLM_MODEL: str = "qwen:3b-distilled-v4a"
```

**Environment Variable Override** (preferred):
```bash
# In .env file
LLM_MODEL=qwen:3b-distilled-v4a
```

#### Step 4: Update Configuration Documentation

**File**: `/home/devel/exudeai/rag-bootstrap/config.yaml`

```yaml
llm:
  model: qwen:3b-distilled-v4a        # Changed from llama3.1:70b
  temperature: 0.3                     # Keep same
  context_window: 4096                 # Distilled model context
  performance_notes: "Phase 4C distilled 3B, 2-3x faster"
```

#### Step 5: Restart Services

```bash
cd /home/devel/exudeai/rag-bootstrap

# 1. Restart API service with new model
docker compose restart api

# 2. Verify new model is loaded
curl http://localhost:8100/api/health

# 3. Check model identification in response
curl -X POST http://localhost:8100/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What model are you using?"}' \
  | jq .model
```

---

## Accuracy Maintenance Validation

### Phase 4A Baseline → Phase 4C Improvement

**Expected Metrics**:

```
Baseline (Qwen 7B):
  - Extraction accuracy: 78%
  - Pass rate @ 0.65 threshold: 11.5%
  - Mean quality score: 0.617

Phase 4A Target (Curriculum-trained 7B):
  - Extraction accuracy: 82-84% (4-6% improvement)
  - Pass rate @ 0.65: 16-18% (projected)
  - Mean quality score: 0.640-0.650

Phase 4C Target (Distilled 3B):
  - Extraction accuracy: 82-84% (maintain Phase 4A gains)
  - Mean quality score: 0.640-0.650 (maintain)
  - Parameter reduction: 70B → 3B (95% reduction)
```

### Validation Testing

**Run accuracy benchmark after model switch**:

```bash
# Run integration tests
pytest /home/devel/exudeai/rag-bootstrap/tests/test_rag_integration.py \
  -k "accuracy" -v

# Expected: ≥80% accuracy on benchmark questions
# (Previously 78% with 70B baseline)
```

**Benchmark Questions** (from test suite):
1. Controller delay minimization procedures
2. Emergency fuel declaration handling
3. Communication standards and terminology
4. Night approach procedures
5. Aircraft landing priority factors

**Success Criteria**:
- ✓ ≥80% of benchmark questions answered correctly
- ✓ ≥50% of expected keywords in each answer
- ✓ Answer relevance maintained
- ✓ No hallucinations introduced

---

## Performance Optimization

### Phase 4E Expected Performance

**With Distilled 3B Model**:

| Metric | 70B Baseline | 3B Distilled | Improvement |
|--------|-------------|--------------|-------------|
| Answer latency | 5-10s | 1-3s | 3-5x faster |
| Streaming latency | 100-200ms/token | 30-50ms/token | 3x faster |
| Memory footprint | 70GB | ~3GB | 95% reduction |
| Concurrent requests | 4-8 | 20-30 | 3-4x throughput |
| Cost per query | ~2¢ | ~0.5¢ | 4x cheaper |

### Performance Testing

```bash
# Run performance benchmark after model switch
pytest /home/devel/exudeai/rag-bootstrap/tests/test_rag_integration.py \
  -k "performance" -v

# Expected latencies:
# - Search: <1s
# - Answer: <30s (much faster with 3B)
# - Streaming: responsive token delivery
```

---

## Streaming Integration

### Phase A Streaming Features (Already Implemented)

✓ Server-Sent Events endpoint: `/api/ask/stream`
✓ Real-time token delivery
✓ Source context in first event
✓ Token counting and metadata
✓ Frontend integration with UI updates

### Phase 4E Validation

**Streaming with 3B Model**:

```bash
# Test streaming responsiveness
curl -N -H "Content-Type: application/json" \
  -d '{"question":"What is air traffic control?","mode":"hybrid"}' \
  http://localhost:8100/api/ask/stream

# Expected:
# - First token appears within 500ms
# - All tokens delivered at 30-50ms intervals
# - Complete response within 10-30 seconds
```

**JavaScript Client Test**:

```javascript
const client = new RAGClient('http://localhost:8100');

let tokenCount = 0;
const startTime = Date.now();

client.askStream(
  'What is air traffic control?',
  (token) => {
    tokenCount++;
    const elapsed = Date.now() - startTime;
    console.log(`Token ${tokenCount} at ${elapsed}ms: "${token}"`);
  },
  (event) => {
    console.log(`Complete in ${Date.now() - startTime}ms`);
    console.log(`Total tokens: ${event.total_tokens}`);
  },
  (error) => console.error(error)
);
```

---

## Auto-Ingest Watcher Integration

### Phase A Features (Already Implemented)

✓ File monitoring with inotify (Linux) or polling (universal)
✓ Automatic ingestion on file drop
✓ Exponential backoff retry logic
✓ File archival to `/data/docs/archive/`
✓ Status endpoint: `/api/watcher/status`

### Verification After Model Switch

```bash
# Check watcher is still operational
curl http://localhost:8100/api/watcher/status

# Expected response:
{
  "status": "running",
  "watch_dir": "/data/docs",
  "queue_size": 0,
  "total_processed": <X>,
  "total_archived": <X>
}
```

---

## Knowledge Base Optimization

### For 3B Model

The 3B model may benefit from:

1. **Reduced Chunk Size** (from 512 to 256 tokens)
   - Better context fit for smaller model
   - More granular retrieval results
   - Update in config.yaml: `chunk_size: 256`

2. **Increased RAG_TOP_K** (from 5 to 8-10)
   - More context compensates for model size
   - Better coverage of knowledge base
   - Update in config.py: `RAG_TOP_K: 8`

3. **Adjusted Temperature** (from 0.3 to 0.5)
   - Slightly less deterministic
   - Better diversity in responses
   - Update in config.py: `LLM_TEMPERATURE: 0.5`

### Implementation

```python
# In app/config.py, Phase 4E optimizations

class Settings(BaseSettings):
    # ... existing settings ...

    # Phase 4E tuning for 3B model
    CHUNK_SIZE: int = 256                # Reduced for smaller model
    RAG_TOP_K: int = 8                   # More context needed
    LLM_TEMPERATURE: float = 0.5         # Slightly more diverse
    LLM_TIMEOUT: int = 60                # Shorter timeout for faster model
```

---

## API Compatibility

### No Breaking Changes

✓ All existing endpoints remain unchanged
✓ `/api/ask` interface identical
✓ `/api/ask/stream` interface identical
✓ Search endpoints unchanged
✓ Ingest endpoints unchanged

### Version Declaration

Update in response headers:

```python
# In app/main.py FastAPI setup
app.add_middleware(
    MiddlewareClass,
    headers={
        "X-RAG-Version": "1.0.0",
        "X-LLM-Model": settings.LLM_MODEL,
        "X-Model-Generation": "Phase-4E-Distilled-3B"
    }
)
```

---

## Monitoring & Observability

### Metrics to Track

**After Model Switch**:

```bash
# 1. Response latency by endpoint
# - /api/ask: Should be 2-5x faster
# - /api/ask/stream: Should stream tokens faster
# - /api/search: Should be unchanged

# 2. Accuracy metrics
# - Extraction accuracy: Track with benchmark tests
# - Keyword matching: Monitor with test suite
# - Semantic relevance: Validate qualitatively

# 3. Resource utilization
# - Memory: Should be 95% lower than 70B
# - CPU: May increase slightly due to smaller model
# - GPU: Should use much less GPU memory

# 4. System health
# - API response time: track via health endpoint
# - DB query time: monitor via logs
# - LLM inference time: log in response metadata
```

### Logging Configuration

Add performance logging to LLM client:

```python
# In app/llm.py
import time

async def generate(self, prompt: str, ...):
    start = time.time()
    # ... generation code ...
    elapsed = time.time() - start

    logger.info(
        f"Generation metrics",
        extra={
            "model": self.model,
            "tokens": len(response) // 4,  # rough estimate
            "elapsed_ms": int(elapsed * 1000),
            "phase": "Phase-4E-Distilled-3B"
        }
    )
    return response
```

---

## Rollback Procedures

### If Issues Arise

**Step 1: Verify Rollback Candidate**

```bash
# Ensure 70B model is still available
ollama list | grep llama3.1:70b
```

**Step 2: Revert Configuration**

```python
# In app/config.py
LLM_MODEL: str = "llama3.1:70b"  # Rollback
```

**Step 3: Restart Services**

```bash
docker compose restart api

# Verify rollback
curl http://localhost:8100/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"Test"}' | jq .model
```

**Step 4: Diagnostic Analysis**

Collect information for investigation:
- API logs during failure
- Model loading errors
- Memory/resource constraints
- Test results from failing benchmark

**Step 5: Plan Re-integration**

- Address identified issues
- Validate distilled model separately
- Retry integration with fixes

---

## Documentation Updates

### Update These Files After Integration

1. **README.md**
   - Update "LLM Model" section
   - Note performance improvements
   - Update setup instructions

2. **config.yaml**
   - Update default LLM model
   - Document optimization tuning

3. **RAG_PRODUCTION_API.md**
   - Update response examples
   - Note new performance characteristics

4. **docs/todo.md**
   - Mark Phase 4E complete
   - Update status sections

5. **COMPLETE_PROJECT_STATUS.md**
   - Record model transition date
   - Document accuracy improvements
   - Update performance baselines

---

## Production Deployment Checklist

Before May 31 Production Release:

### Pre-Integration (Phase 4C Completion)

- [ ] Phase 4A curriculum training complete
- [ ] Phase 4B dataset scaled to 12K pairs
- [ ] Best curriculum variant identified
- [ ] Distilled 3B model trained and validated
- [ ] Phase 4C validation passing
- [ ] Model files available and loadable

### Integration Validation

- [ ] Model loads in Ollama without errors
- [ ] API health check passes
- [ ] Knowledge base accessible
- [ ] Search functionality working
- [ ] Baseline answer generation working

### Testing Phase

- [ ] All 30+ integration tests passing
- [ ] ≥80% accuracy on benchmark questions
- [ ] Performance tests meet <3s per query
- [ ] Streaming endpoint operational
- [ ] Auto-ingest watcher verified
- [ ] Error handling validated

### Documentation Phase

- [ ] API documentation updated
- [ ] Integration guide completed
- [ ] README refreshed
- [ ] Configuration examples current
- [ ] Performance baselines documented

### Final Validation

- [ ] Team trained on new model
- [ ] Backup procedures verified
- [ ] Monitoring configured
- [ ] Rollback procedures documented
- [ ] Customer notification ready

### Deployment

- [ ] Code committed and merged to main
- [ ] Docker images rebuilt
- [ ] Production environment updated
- [ ] Health checks passing
- [ ] Monitoring alerts active
- [ ] Team on-call ready

---

## Post-Deployment Monitoring

### First 24 Hours

- Monitor error rates (target: <1%)
- Track response latency (target: 2-5s)
- Verify accuracy on production queries
- Check resource utilization
- Monitor system logs for anomalies

### First Week

- Collect performance metrics
- Validate accuracy on representative queries
- Compare to baseline 70B performance
- Gather user feedback
- Document any issues

### Ongoing

- Weekly accuracy validation
- Monthly performance review
- Quarterly optimization review
- Continuous error monitoring
- User satisfaction tracking

---

## Contingency Plans

### If Accuracy Drops Below Target

1. **Investigation Phase**
   - Run full test suite to identify failure patterns
   - Analyze knowledge base coverage
   - Review LLM output quality
   - Check for systematic bias

2. **Remediation Options**
   - Augment knowledge base with relevant documents
   - Adjust RAG_TOP_K or chunk size
   - Fine-tune temperature parameter
   - Rollback to 70B if needed

3. **Prevention**
   - Implement continuous monitoring
   - Set up accuracy alerting
   - Regular benchmark testing
   - Quarterly re-evaluation

### If Performance is Inadequate

1. **Profiling**
   - Measure end-to-end latency
   - Profile model inference time
   - Check database query performance
   - Monitor network latency

2. **Optimization Options**
   - Reduce RAG_TOP_K
   - Increase chunk_size
   - Enable response caching
   - Optimize search queries

3. **Hardware Scaling**
   - Allocate more GPU memory
   - Use faster GPU hardware
   - Optimize model quantization

---

## Success Metrics (May 31)

### Accuracy (Primary)

- ✓ Extraction accuracy: 82-84% (4-6% improvement)
- ✓ Benchmark score: ≥80%
- ✓ Zero hallucinations in test suite

### Performance (Secondary)

- ✓ Response latency: <5 seconds (3-5x faster)
- ✓ Search time: <1 second
- ✓ Streaming: responsive token delivery (<50ms intervals)

### Operational (Tertiary)

- ✓ All integration tests passing
- ✓ Knowledge base fully functional
- ✓ Auto-ingest operational
- ✓ Monitoring and logging configured
- ✓ Team trained and ready
- ✓ Documentation complete

---

## Conclusion

This integration plan provides a clear path from Phase 4A curriculum training through Phase 4E production deployment. The distilled 3B model represents significant progress toward efficient, scalable RAG systems while maintaining extraction accuracy improvements.

**Target Outcome**: Production-ready RAG system with 3B distilled model, 4-6% accuracy improvement, and 3-5x performance gain by May 31, 2026.

---

**Document Status**: Ready for Phase 4C Integration (May 23)
**Last Updated**: 2026-05-31
**Next Review**: After Phase 4C completion
