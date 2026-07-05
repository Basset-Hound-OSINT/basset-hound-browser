# 10K Document Chunk Pipeline Benchmark

Comprehensive performance benchmark for RAG integrated pipeline with 10,000 synthetic document chunks.

## Overview

This benchmark validates system performance across:
- **Retrieval:** 1,000 random queries measuring embedding latency and vector search
- **Generation:** 100 generation tasks measuring LLM token throughput
- **E2E Pipeline:** 100 complete queries from retrieval to generation
- **Memory:** Peak and average usage tracking across operations
- **Scalability:** Analysis and recommendations for 100K+ chunk deployment

## Quick Start

### Prerequisites

```bash
# Ensure services are running
docker-compose up -d postgres redis ollama

# Wait for services to be healthy (30-60 seconds)
sleep 30

# Install dependencies
pip install -r requirements.txt
```

### Run Benchmark

```bash
# Run full benchmark suite (4-6 hours)
python scripts/benchmark_10k_pipeline.py

# Results saved to: results/benchmark_10k_YYYYMMDD_HHMMSS.json
```

### Generate Report

```bash
# Generate markdown report with analysis
python scripts/generate_benchmark_report.py results/benchmark_10k_*.json

# Report saved to: results/benchmark_10k_*_report.md
```

## Benchmark Details

### 1. Retrieval Benchmark (1,000 queries)

**Tests:** Embedding generation + vector similarity search

**Targets:**
- Mean latency: < 50ms
- P95 latency: < 100ms
- Throughput: > 20 queries/second

**Operations:**
1. Generate query embedding (e5-small)
2. Perform semantic/hybrid search
3. Measure total latency
4. Track memory per query

**Key Metrics:**
- Latency percentiles (P50, P95, P99)
- Throughput (queries/sec)
- Cache hit rate
- Memory growth

### 2. Generation Benchmark (100 generations)

**Tests:** LLM token generation from context

**Targets:**
- Throughput: 10-20 tokens/second (3B model on H100)
- Latency: < 5 seconds per response

**Operations:**
1. Create prompt with retrieved context
2. Generate response via Ollama
3. Measure token generation rate
4. Track memory per generation

**Key Metrics:**
- Tokens per second
- Latency distribution
- Generation latency per token
- Memory footprint

### 3. E2E Pipeline Benchmark (100 queries)

**Tests:** Complete query flow: retrieve → generate

**Targets:**
- Mean latency: < 500ms
- P95 latency: < 1000ms (1 second)
- Throughput: > 2 queries/second

**Operations:**
1. Parse query
2. Generate query embedding
3. Retrieve top-K context chunks
4. Generate response with context
5. Measure total latency

**Key Metrics:**
- E2E latency percentiles
- Bottleneck identification
- Per-phase latency breakdown
- Resource utilization

### 4. Memory Analysis

**Tracked:**
- Peak memory per operation
- Average memory during operation
- Memory growth over time
- Cache memory footprint

**Key Metrics:**
- Peak resident memory (RSS)
- Memory per operation
- Memory efficiency
- Potential memory leaks

## Performance Targets

| Phase | Metric | Target | Importance |
|-------|--------|--------|------------|
| Retrieval | Mean latency | <50ms | Critical |
| Retrieval | P95 latency | <100ms | Critical |
| Generation | Tokens/sec | 10-20 | Important |
| E2E Pipeline | Mean latency | <500ms | Important |
| E2E Pipeline | P95 latency | <1000ms | Critical |
| Memory | Peak usage | <4GB | Important |

## Configuration

### Default Settings

```python
# In app/config.py
EMBEDDING_MODEL = "all-MiniLM-L6-v2"  # Can change to e5-small
EMBEDDING_DIMENSION = 384
LLM_MODEL = "llama3.1:70b"
RAG_TOP_K = 5  # Retrieve top 5 chunks
CHUNK_SIZE = 512
```

### Adjusting Benchmarks

```python
# In benchmark_10k_pipeline.py

# Retrieval: Change num_queries (default 1000)
retrieval_bench = RetrievalBenchmark(embedding_service)
result = await retrieval_bench.run(num_queries=5000)  # More queries

# Generation: Change num_generations (default 100)
generation_bench = GenerationBenchmark(llm_client)
result = await generation_bench.run(num_generations=500)

# E2E: Change num_queries (default 100)
e2e_bench = E2EPipelineBenchmark(embedding_service, llm_client)
result = await e2e_bench.run(num_queries=500)
```

## Output Files

### Benchmark Results

**Location:** `results/benchmark_10k_YYYYMMDD_HHMMSS.json`

**Content:**
```json
{
  "timestamp": "2026-05-27T14:30:00",
  "config": {
    "num_chunks": 10000,
    "embedding_model": "all-MiniLM-L6-v2",
    "llm_model": "llama3.1:70b"
  },
  "benchmarks": {
    "retrieval": {
      "latency": { "mean_ms": 35.5, "p95_ms": 89.2, ... },
      "memory": { "peak_mb": 512.3, "avg_mb": 450.1 },
      "throughput": { "queries_per_sec": 28.2 }
    },
    "generation": { ... },
    "e2e_pipeline": { ... }
  }
}
```

### Benchmark Report

**Location:** `results/benchmark_10k_*_report.md`

**Content:**
- Executive summary
- Configuration details
- Detailed results with tables
- Performance analysis
- Recommendations for scale
- Raw metrics appendix

## Interpreting Results

### Good Performance

```
✓ Retrieval Mean: 35ms < 50ms target
✓ Retrieval P95: 85ms < 100ms target
✓ E2E P95: 800ms < 1000ms target
✓ Generation: 15 tokens/sec (in target range 10-20)
```

**Action:** System is production-ready. Proceed to load testing.

### Performance Issues

```
✗ Retrieval Mean: 75ms > 50ms target
✗ E2E P95: 1200ms > 1000ms target
```

**Actions:**
1. Identify bottleneck (retrieval vs generation)
2. Optimize slow component:
   - Retrieval: Add GPU acceleration, increase connection pool
   - Generation: Reduce context size, use smaller model
3. Re-run benchmark to validate fix

## Optimization Strategies

### Retrieval Optimization

1. **GPU Acceleration:** Move embedding model to GPU (5-10x faster)
   ```bash
   EMBEDDING_BACKEND=ollama  # Uses GPU if available
   ```

2. **Batch Embedding:** Process multiple queries together
   ```python
   await embedding_service.embed_batch(queries, task="search_query")
   ```

3. **Caching:** Enable Redis caching for embeddings
   ```python
   embedding_service = EmbeddingService(redis_client=redis_client)
   ```

4. **Index Optimization:** Use HNSW index for 10-15x speedup
   ```sql
   CREATE INDEX idx_chunk_embedding_hnsw
     ON chunks USING hnsw (embedding vector_cosine_ops);
   ```

### Generation Optimization

1. **Model Selection:** Use smaller, faster model
   ```python
   LLM_MODEL = "mistral:7b"  # Faster than 70B
   ```

2. **Reduced Context:** Use fewer context chunks
   ```python
   RAG_TOP_K = 3  # Instead of 5
   ```

3. **Token Limit:** Cap maximum generation length
   ```python
   await llm.generate(prompt, max_tokens=200)
   ```

### E2E Pipeline Optimization

1. **Parallel Retrieval & Generation:** Process in pipeline
2. **Result Caching:** Cache popular queries
3. **Connection Pooling:** Increase database connection pool

## Scheduled Benchmarking

To run benchmarks on a schedule (e.g., daily):

```bash
# Add to crontab
0 2 * * * cd /home/devel/exudeai/rag-bootstrap && python scripts/benchmark_10k_pipeline.py

# Or use Claude Code scheduled agent
claude schedule add --cron "0 2 * * *" \
  --command "cd /home/devel/exudeai/rag-bootstrap && python scripts/benchmark_10k_pipeline.py" \
  --name "daily-10k-benchmark"
```

## Troubleshooting

### Database Connection Issues

```
ERROR: PostgreSQL connection failed
```

**Solution:**
```bash
# Check if postgres is running
docker ps | grep postgres

# Check logs
docker logs rag-postgres

# Restart if needed
docker-compose up -d postgres
```

### Ollama Connection Issues

```
ERROR: Ollama connection failed
```

**Solution:**
```bash
# Check if ollama is running
curl http://localhost:11434/api/tags

# Ensure model is pulled
ollama pull llama3.1:70b
ollama pull all-MiniLM-L6-v2

# Restart if needed
docker-compose restart ollama
```

### Out of Memory

```
ERROR: Process killed - out of memory
```

**Solutions:**
1. Reduce query count: `num_queries=500` (instead of 1000)
2. Use smaller models
3. Increase swap space
4. Run on machine with more memory

### Slow Benchmarks

**If taking >6 hours:**
1. Check if services are slow: run individual queries manually
2. Reduce query count for faster iteration
3. Increase batch sizes for parallel processing

## Next Steps After Benchmarking

1. **Load Testing (Phase 5B):** Test with 10-100 concurrent users
2. **Stress Testing:** Identify system breaking points
3. **Chaos Engineering:** Test failure scenarios
4. **Long-running Tests:** 24-48 hour endurance tests
5. **Production Deployment:** Deploy to staging with real data

## References

- [RAG Bootstrap Documentation Index](../INDEX.md)
- [Performance Analysis Report](../findings/performance_analysis_report.md)
- [Embedding & Ingestion Performance](../findings/embedding-performance.md)
- [Known Issues / Troubleshooting](../findings/known-issues.md)

## Support

For issues or questions:
1. Check logs: `tail -f logs/benchmark.log`
2. Review benchmark output JSON
3. Run smaller subset: `num_queries=10` for debugging
4. Check service status: `docker-compose ps`
