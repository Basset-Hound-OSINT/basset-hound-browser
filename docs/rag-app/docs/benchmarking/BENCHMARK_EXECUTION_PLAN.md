# 10K Document Chunk Benchmark - Execution Plan

**Status:** Ready for execution
**Scheduled:** May 26-27, 2026
**Expected Duration:** 4-6 hours
**Target:** Validate system performance at scale

## Overview

Complete benchmark of integrated RAG pipeline with 10,000 synthetic document chunks to validate performance targets and identify optimization opportunities.

## Quick Start

```bash
# Navigate to project root
cd /home/devel/exudeai/rag-bootstrap

# Quick test (30 minutes)
bash scripts/run_benchmark.sh --quick

# Full benchmark (4-6 hours)
bash scripts/run_benchmark.sh

# Custom configuration
bash scripts/run_benchmark.sh \
  --retrieval 2000 \
  --generations 200 \
  --e2e 200
```

## Execution Steps

### Phase 1: Pre-Benchmark Validation (15 minutes)

1. **Verify Infrastructure**
   ```bash
   # Check PostgreSQL
   docker-compose ps postgres
   docker exec rag-postgres psql -U raguser -d ragdb -c "SELECT 1"

   # Check Redis
   docker exec rag-redis redis-cli ping

   # Check Ollama
   curl http://localhost:11434/api/tags
   ```

2. **Verify Models**
   ```bash
   # Ensure embedding model is available
   curl http://localhost:11434/api/tags | grep -i "all-minilm\|e5-small"

   # Ensure LLM model is available
   curl http://localhost:11434/api/tags | grep -i "llama3.1\|mistral"
   ```

3. **Database Setup**
   ```bash
   # Initialize database schema
   python -c "
   import asyncio
   from app.database import init_db
   asyncio.run(init_db())
   "

   # Verify schema
   docker exec rag-postgres psql -U raguser -d ragdb -c "\dt"
   ```

4. **Memory Baseline**
   ```bash
   # Record system memory before benchmark
   free -h
   ```

### Phase 2: Retrieval Benchmark (45 minutes)

**Target:** 1,000 random queries with latency < 50ms mean, < 100ms P95

**Operations:**
1. Generate 1,000 diverse test queries
2. For each query:
   - Compute embedding
   - Perform vector search
   - Record latency
3. Collect metrics

**Output:**
- Latency distribution (P50, P95, P99, stdev)
- Throughput (queries/second)
- Memory usage
- Cache hit rates

**Expected Results:**
```
Mean latency: 30-50ms
P95 latency: 80-100ms
P99 latency: 150-200ms
Throughput: 20-30 queries/sec
Memory peak: 600-800MB
```

### Phase 3: Generation Benchmark (30 minutes)

**Target:** 100 generation tasks with 10-20 tokens/second (3B model)

**Operations:**
1. Generate 100 diverse prompts with context
2. For each:
   - Call Ollama LLM
   - Measure response latency
   - Count generated tokens
   - Calculate tokens/second
3. Collect metrics

**Output:**
- Latency distribution
- Token generation rate
- Memory usage

**Expected Results:**
```
Mean latency: 2-5 seconds per response
Tokens/second: 10-20 (varies by model)
Memory peak: 2-4GB (LLM model loading)
```

### Phase 4: E2E Pipeline Benchmark (30 minutes)

**Target:** 100 complete queries with P95 < 1 second

**Operations:**
1. Generate 100 diverse test queries
2. For each query:
   - Compute embedding (retrieval phase)
   - Search and retrieve context (retrieval phase)
   - Generate response with context (generation phase)
   - Record total latency
3. Collect metrics

**Output:**
- E2E latency distribution
- Phase breakdown (retrieval vs generation)
- Memory usage
- Bottleneck identification

**Expected Results:**
```
Mean latency: 300-500ms
P95 latency: 800-1000ms
P99 latency: 1500-2000ms
Memory peak: 2-3GB
Bottleneck: Likely generation (LLM)
```

### Phase 5: Memory Analysis (15 minutes)

**Operations:**
1. Summarize peak memory per operation
2. Calculate total system memory needed
3. Identify potential leaks
4. Recommend optimizations

**Output:**
- Peak memory per operation
- Total memory requirement
- Memory efficiency metrics

**Expected Results:**
```
Retrieval: 600-800MB peak
Generation: 2-4GB peak (LLM model)
E2E Pipeline: 2.5-4.5GB peak
Total system requirement: 6-8GB
```

### Phase 6: Report Generation (5 minutes)

**Operations:**
1. Collect all metrics into JSON
2. Validate against targets
3. Generate markdown report
4. Include recommendations

**Output:**
- `results/benchmark_10k_YYYYMMDD_HHMMSS.json` (raw metrics)
- `results/benchmark_10k_*_report.md` (detailed analysis)
- Console summary with pass/fail status

## Success Criteria

### Critical (Must Pass)
- [ ] Retrieval mean latency < 50ms
- [ ] Retrieval P95 latency < 100ms
- [ ] E2E P95 latency < 1000ms

### Important (Should Pass)
- [ ] Generation: 10-20 tokens/second
- [ ] E2E mean latency < 500ms
- [ ] Memory peak < 6GB

### Nice to Have
- [ ] Retrieval throughput > 20 queries/sec
- [ ] Memory efficiency ratio > 0.8
- [ ] Cache hit rate > 50%

## Performance Targets Table

| Component | Metric | Target | Priority | Status |
|-----------|--------|--------|----------|--------|
| Retrieval | Mean latency | <50ms | Critical | ? |
| Retrieval | P95 latency | <100ms | Critical | ? |
| Retrieval | Throughput | >20 q/s | Important | ? |
| Generation | Tokens/sec | 10-20 | Important | ? |
| Generation | Mean latency | <5s | Important | ? |
| E2E Pipeline | Mean latency | <500ms | Important | ? |
| E2E Pipeline | P95 latency | <1000ms | Critical | ? |
| E2E Pipeline | Throughput | >2 q/s | Important | ? |
| Memory | Peak usage | <6GB | Important | ? |

## Troubleshooting Guide

### If Benchmark Fails to Start

```bash
# Check logs
tail -f logs/benchmark.log

# Verify services
docker-compose logs postgres
docker-compose logs redis
docker-compose logs ollama

# Restart services
docker-compose down
docker-compose up -d
sleep 30
```

### If Latencies Are High

1. **Check database performance**
   ```bash
   # Sample query latency
   time psql -U raguser -d ragdb -c "SELECT * FROM chunks LIMIT 10"
   ```

2. **Check service load**
   ```bash
   # CPU and memory
   docker stats
   ```

3. **Check network**
   ```bash
   # Ping each service
   curl http://localhost:11434/api/tags
   redis-cli ping
   ```

### If Memory Usage is High

1. **Check for leaks**
   - Look for continuously growing memory over time
   - Monitor with `watch -n 1 'free -h; docker stats'`

2. **Reduce load**
   - Decrease query count for iteration
   - Use smaller batch sizes

3. **Optimize models**
   - Use smaller embedding model (128D instead of 384D)
   - Use quantized LLM (8-bit instead of 32-bit)

### If Services Crash

```bash
# Check disk space
df -h

# Check memory
free -h

# Check logs
docker-compose logs --tail 100

# Restart
docker-compose restart
```

## Optimization Opportunities

### If Retrieval < 50ms Target

✓ Already optimized, consider:
- GPU acceleration for embedding (would reduce further)
- HNSW index for sub-10ms queries

### If Retrieval > 50ms Target

Try these optimizations (in order):
1. Enable GPU acceleration
   ```python
   EMBEDDING_BACKEND = "ollama"  # Uses GPU
   ```

2. Increase connection pool
   ```python
   pool_size = 50  # Default: 20
   ```

3. Add embedding cache
   ```python
   redis_client = await aioredis.create_redis_pool("redis://localhost")
   embedding_service = EmbeddingService(redis_client=redis_client)
   ```

4. Use faster embedding model
   ```python
   EMBEDDING_MODEL = "all-MiniLM-L6-v2"  # 120M params
   # Instead of: "all-mpnet-base-v2"  # 420M params
   ```

### If Generation < 10 tokens/sec

Try these optimizations:
1. Use smaller model
   ```python
   LLM_MODEL = "mistral:7b"  # 7B params
   # Instead of: "llama3.1:70b"  # 70B params
   ```

2. Reduce context size
   ```python
   RAG_TOP_K = 3  # Get fewer chunks
   ```

3. Use quantized model (8-bit or 4-bit)
   ```bash
   ollama pull mistral:7b-q4_1
   ```

### If E2E > 1 second P95

Identify bottleneck:
1. Check phase breakdown (retrieval vs generation)
2. If retrieval slow: apply retrieval optimizations
3. If generation slow: apply generation optimizations
4. Consider parallel processing for retrieval + generation

## Monitoring During Execution

### Real-time Metrics

```bash
# In separate terminal 1: Monitor system resources
watch -n 1 'echo "=== Memory ==="; free -h; echo "=== Disk ==="; df -h /; echo "=== Processes ==="; ps aux | grep -E "python|postgres|redis|ollama" | grep -v grep'

# In separate terminal 2: Monitor Docker
watch -n 1 docker stats

# In separate terminal 3: Monitor database
docker exec rag-postgres watch -n 1 'psql -U raguser -d ragdb -c "SELECT count(*) FROM chunks"'
```

### Log Analysis

```bash
# Follow benchmark logs
tail -f logs/benchmark.log

# Follow service logs
docker-compose logs -f postgres
docker-compose logs -f ollama
docker-compose logs -f redis
```

## Post-Benchmark Analysis

### 1. Review Results

```bash
# View raw metrics
cat results/benchmark_10k_*.json | python -m json.tool | less

# View report
less results/benchmark_10k_*_report.md
```

### 2. Compare Against Targets

The report will show:
- ✓ PASS: Metric meets target
- ✗ FAIL: Metric below target
- Overall success rate

### 3. Identify Bottlenecks

From latency breakdown:
- If retrieval + generation < 100ms each but E2E > 1000ms: parallel processing issue
- If retrieval > 100ms: embedding or search optimization needed
- If generation > 5000ms: LLM model optimization needed

### 4. Create Action Items

Based on failures:
- [ ] Optimize low-performing component
- [ ] Re-run benchmark to validate
- [ ] Document findings
- [ ] Plan Phase 5B (load testing)

## Proceed to Load Testing

Once benchmark is complete and **critical targets are met**:

1. **Phase 5B: Load Testing**
   - Test with 10-100 concurrent users
   - Measure system stability
   - Identify breaking points

2. **Phase 5C: Stress Testing**
   - Push beyond capacity
   - Find resource limits
   - Plan scaling architecture

3. **Phase 5D: Production Readiness**
   - Deploy to staging
   - Test with production data volume
   - Monitor 24-48 hours
   - Deploy to production

## Files Generated

```
rag-bootstrap/
├── scripts/
│   ├── benchmark_10k_pipeline.py       # Main benchmark script
│   ├── generate_benchmark_report.py    # Report generator
│   └── run_benchmark.sh                # Runner script
├── results/
│   ├── benchmark_10k_20260527_143000.json
│   ├── benchmark_10k_20260527_143000_report.md
│   └── benchmark_run.log
├── BENCHMARK_10K_README.md             # Usage guide
└── BENCHMARK_EXECUTION_PLAN.md         # This file
```

## Key Learnings from Benchmark

After completing benchmark, document:
1. Actual vs target performance
2. System bottlenecks identified
3. Memory usage patterns
4. Scalability implications
5. Optimization recommendations
6. Next phase readiness

## Questions to Answer

- [ ] Which component is the bottleneck? (retrieval vs generation)
- [ ] Are critical targets met?
- [ ] What is the system's actual throughput ceiling?
- [ ] How much memory is realistically needed?
- [ ] Can we scale horizontally?
- [ ] Do we need to optimize further before load testing?

## Sign-off

System is ready for load testing (Phase 5B) when:
1. ✓ All critical targets met
2. ✓ Memory usage < 6GB peak
3. ✓ Benchmark report generated and reviewed
4. ✓ No errors in 100+ concurrent operations simulation

---

**Status:** Ready to execute May 26-27, 2026
**Next Phase:** Phase 5B - Load Testing & Concurrency Validation
