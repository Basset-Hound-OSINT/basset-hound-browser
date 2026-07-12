# Performance Optimization Benchmarking Strategy

**Date:** July 3, 2026  
**Purpose:** Pre/Post optimization performance validation  
**Target:** Achieve expected 15-25% throughput improvement

---

## BENCHMARKING OVERVIEW

### Baseline Collection (Before Optimization)

**Step 1: Establish v12.0.0 Baseline**
```bash
# Run baseline performance suite against current code
npm run benchmark:baseline

# Expected results from production deployment (June 2026):
# - Throughput: 285-481 msg/sec
# - P99 Latency: <2ms
# - Export latency: 1000-1500ms
# - DOM extraction: 400-600ms
# - Peak memory: 300MB+ for large exports
```

**Step 2: Capture Current Metrics**
```javascript
// tests/benchmarks/baseline-capture.js
const baselineMetrics = {
  timestamp: new Date().toISOString(),
  version: 'v12.0.0',
  
  commandLatencies: {
    export_format_sqlite: { p50: 1500, p95: 2500, p99: 3000 },
    dom_snapshot_full: { p50: 800, p95: 1100, p99: 1200 },
    captureScreenshot: { p50: 600, p95: 850, p99: 900 },
    export_format_warc: { p50: 800, p95: 1300, p99: 1500 },
    getDOM_with_Styles: { p50: 400, p95: 650, p99: 700 }
  },
  
  systemMetrics: {
    throughput_50_concurrent: 481.48,
    throughput_100_concurrent: 380.25,
    throughput_200_concurrent: 285.45,
    p99_latency: 2.0,
    memory_utilization: 1.15
  }
};
```

### Post-Optimization Validation

**Step 3: Apply Optimizations Incrementally**
```
Week 1:
  - Implement streaming (+40% export improvement)
  - Implement DOM caching (+20% DOM improvement)
  
Week 2:
  - Implement context pooling (+15% IPC improvement)
  - Optimize buffer pool (+5% throughput improvement)
  
Week 3:
  - Connection affinity enhancement
  - Full system validation
```

**Step 4: Measure Per-Optimization Impact**
```javascript
// tests/benchmarks/per-optimization-impact.js

const optimizationMetrics = {
  'streaming-response': {
    export_format_sqlite: { target: -40, actual: null },
    export_format_json: { target: -40, actual: null },
    peak_memory: { target: -50, actual: null }
  },
  
  'dom-caching': {
    getDOM_with_Styles: { target: -20, actual: null },
    dom_snapshot_full: { target: -15, actual: null },
    cache_hit_rate: { target: 40, actual: null }
  },
  
  'context-pooling': {
    executeJavaScript_Complex: { target: -15, actual: null },
    ipc_overhead: { target: -80, actual: null },
    context_reuse: { target: 80, actual: null }
  },
  
  'buffer-optimization': {
    serialization_throughput: { target: 5, actual: null },
    buffer_acquisition_time: { target: 0.1, actual: null }
  }
};
```

---

## BENCHMARK TEST SUITE

### 1. Command Latency Benchmarks

```javascript
// tests/benchmarks/command-latency.test.js

describe('Command Latency Benchmarks', () => {
  const baseline = {
    export_format_sqlite: 1500,    // ms
    dom_snapshot_full: 800,
    captureScreenshot: 600,
    export_format_warc: 800,
    getDOM_with_Styles: 400
  };

  // Test each slow command
  for (const [command, baselineLatency] of Object.entries(baseline)) {
    test(`${command} latency reduction`, async () => {
      const results = [];
      
      // Run 20 iterations
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now();
        await executeCommand(command);
        const latency = performance.now() - startTime;
        results.push(latency);
      }

      const sorted = results.sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[sorted.length - 1];

      console.log(`${command}:`, {
        p50, p95, p99,
        improvement_p50: ((baselineLatency - p50) / baselineLatency * 100).toFixed(1) + '%'
      });

      // Expected improvement: -20 to -50%
      expect(p50).toBeLessThan(baselineLatency * 0.8); // At least 20% improvement
    });
  }
});
```

### 2. Throughput Benchmarks

```javascript
// tests/benchmarks/throughput.test.js

describe('System Throughput Benchmarks', () => {
  const baselineThroughput = {
    50_concurrent: 481.48,
    100_concurrent: 380.25,
    200_concurrent: 285.45
  };

  test('Throughput at 50 concurrent connections', async () => {
    const concurrency = 50;
    const operationsPerClient = 100;
    const startTime = Date.now();

    const clients = [];
    for (let i = 0; i < concurrency; i++) {
      clients.push(
        (async () => {
          for (let j = 0; j < operationsPerClient; j++) {
            await executeRandomCommand();
          }
        })()
      );
    }

    await Promise.all(clients);
    const duration = (Date.now() - startTime) / 1000;
    const totalOperations = concurrency * operationsPerClient;
    const throughput = totalOperations / duration;

    console.log(`Throughput at 50 concurrent: ${throughput.toFixed(2)} msg/sec`);
    
    // Expected: 481 msg/sec baseline, 510+ msg/sec with optimizations
    expect(throughput).toBeGreaterThan(baselineThroughput[50_concurrent] * 0.95);
    expect(throughput).toBeLessThan(baselineThroughput[50_concurrent] * 1.3); // 30% improvement cap
  });

  test('Throughput at 200 concurrent connections', async () => {
    const concurrency = 200;
    const operationsPerClient = 50;
    const startTime = Date.now();

    const clients = [];
    for (let i = 0; i < concurrency; i++) {
      clients.push(
        (async () => {
          for (let j = 0; j < operationsPerClient; j++) {
            await executeRandomCommand();
          }
        })()
      );
    }

    await Promise.all(clients);
    const duration = (Date.now() - startTime) / 1000;
    const totalOperations = concurrency * operationsPerClient;
    const throughput = totalOperations / duration;

    console.log(`Throughput at 200 concurrent: ${throughput.toFixed(2)} msg/sec`);
    
    // Expected: 285 msg/sec baseline, 330+ msg/sec with optimizations
    expect(throughput).toBeGreaterThan(baselineThroughput[200_concurrent] * 1.1); // 10%+ improvement
    expect(throughput).toBeLessThan(baselineThroughput[200_concurrent] * 1.35); // 35% improvement cap
  });
});
```

### 3. Memory Benchmarks

```javascript
// tests/benchmarks/memory.test.js

describe('Memory Usage Benchmarks', () => {
  test('Peak memory for 100MB export', async () => {
    const initialMem = process.memoryUsage().heapUsed / 1024 / 1024;
    const peaks = [];

    // Monitor memory during large export
    const interval = setInterval(() => {
      const current = process.memoryUsage().heapUsed / 1024 / 1024;
      peaks.push(current);
    }, 10);

    try {
      // Simulate 100MB export
      await exportLargeDataset(100 * 1024 * 1024);
    } finally {
      clearInterval(interval);
    }

    const peakMemory = Math.max(...peaks);
    const memoryIncrease = peakMemory - initialMem;

    console.log(`Peak memory for 100MB export: ${memoryIncrease.toFixed(0)}MB`);
    
    // Expected: 300MB baseline, <50MB with streaming optimization
    expect(memoryIncrease).toBeLessThan(100); // At most 100MB increase
    expect(memoryIncrease).toBeLessThan(initialMem + 50); // Streaming: <50MB peak
  });

  test('Memory stability over sustained load', async () => {
    const duration = 5 * 60 * 1000; // 5 minutes
    const samples = [];
    const endTime = Date.now() + duration;

    const interval = setInterval(() => {
      const mem = process.memoryUsage().heapUsed / 1024 / 1024;
      samples.push({ time: Date.now(), memory: mem });
    }, 1000);

    try {
      while (Date.now() < endTime) {
        await executeRandomCommand();
      }
    } finally {
      clearInterval(interval);
    }

    // Calculate memory growth rate
    const startMem = samples[0].memory;
    const endMem = samples[samples.length - 1].memory;
    const growthRate = (endMem - startMem) / (duration / 1000 / 60); // MB/minute

    console.log(`Memory growth rate: ${growthRate.toFixed(2)} MB/minute`);
    
    // Expected: <5MB/minute indicates no memory leak
    expect(growthRate).toBeLessThan(5);
  });
});
```

### 4. Cache Effectiveness Benchmarks

```javascript
// tests/benchmarks/cache-effectiveness.test.js

describe('Cache Effectiveness Benchmarks', () => {
  test('DOM cache hit rate > 40%', async () => {
    const cache = new RequestScopeCache();
    let hits = 0;
    let misses = 0;

    // Simulate typical DOM access pattern
    for (let i = 0; i < 100; i++) {
      const result = await cache.getOrExecute(
        `dom-snapshot-${i % 5}`, // Only 5 unique queries
        async () => {
          misses++;
          return await fetchDOM();
        }
      );
    }

    hits = 100 - misses; // 100 total - misses = hits
    const hitRate = (hits / 100) * 100;

    console.log(`DOM cache hit rate: ${hitRate.toFixed(1)}%`);
    
    // Expected: 60% hit rate (5 unique queries, 100 requests)
    expect(hitRate).toBeGreaterThan(40);
  });

  test('Context pool reuse > 80%', async () => {
    const pool = new JavaScriptContextPool({ poolSize: 3 });
    await pool.initialize();

    let reuses = 0;
    const totalExecutions = 100;

    for (let i = 0; i < totalExecutions; i++) {
      await pool.execute('console.log("test")');
    }

    reuses = pool.stats.contextReuses;
    const reuseRate = (reuses / totalExecutions) * 100;

    console.log(`Context pool reuse rate: ${reuseRate.toFixed(1)}%`);
    
    // Expected: 80%+ reuse rate
    expect(reuseRate).toBeGreaterThan(80);
  });
});
```

### 5. Latency Percentile Benchmarks

```javascript
// tests/benchmarks/latency-percentiles.test.js

describe('Latency Percentile Benchmarks', () => {
  test('P99 latency remains <2ms', async () => {
    const latencies = [];

    // Collect 1000 operations
    for (let i = 0; i < 1000; i++) {
      const start = performance.now();
      await executeCommand('ping');
      const latency = performance.now() - start;
      latencies.push(latency);
    }

    const sorted = latencies.sort((a, b) => a - b);
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    console.log(`P99 Latency: ${p99.toFixed(2)}ms`);
    
    // Expected: Maintain <2ms P99
    expect(p99).toBeLessThan(2);
  });

  test('Export command latency percentiles improve', async () => {
    const baseline = { p50: 1500, p95: 2500, p99: 3000 };
    const results = [];

    for (let i = 0; i < 50; i++) {
      const start = performance.now();
      await executeCommand('export_format_sqlite');
      results.push(performance.now() - start);
    }

    const sorted = results.sort((a, b) => a - b);
    const optimized = {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[sorted.length - 1]
    };

    console.log('Export latency improvement:', {
      p50: `${baseline.p50}ms → ${optimized.p50.toFixed(0)}ms`,
      p95: `${baseline.p95}ms → ${optimized.p95.toFixed(0)}ms`,
      p99: `${baseline.p99}ms → ${optimized.p99.toFixed(0)}ms`
    });

    // Expected: -40% improvement
    expect(optimized.p50).toBeLessThan(baseline.p50 * 0.6);
  });
});
```

---

## BENCHMARK EXECUTION PLAN

### Pre-Optimization Baseline

```bash
# Run baseline capture
npm run benchmark:baseline

# Expected output:
# - baseline-metrics-v12.0.0.json (current metrics)
# - baseline-report.md (summary)

# Store for comparison
cp baseline-metrics-v12.0.0.json test-data/baseline-v12.0.0.json
```

### Post-Optimization Week-by-Week

```bash
# After Week 1 (Streaming + Caching)
npm run benchmark:post-week1
# Expected improvement: -30% export, -20% DOM

# After Week 2 (Context Pooling + Buffer)
npm run benchmark:post-week2
# Expected improvement: -40% export, -25% DOM, +10% throughput

# After Week 3 (Full Suite)
npm run benchmark:final
# Expected improvement: -50% export, -30% DOM, +15-25% throughput
```

### Benchmark Configuration

```javascript
// benchmarks/config.js

module.exports = {
  // Latency benchmarks
  latency: {
    iterations: 20,
    warmupIterations: 5,
    timeout: 60000
  },

  // Throughput benchmarks
  throughput: {
    concurrencyLevels: [50, 100, 200],
    operationsPerClient: 100,
    timeout: 300000
  },

  // Memory benchmarks
  memory: {
    samples: 600, // 10 minutes at 1 sample/second
    exportSize: '100MB',
    gcBetweenSamples: false
  },

  // Cache benchmarks
  cache: {
    operations: 1000,
    uniqueKeys: 10,
    ttl: 30000
  },

  // Report settings
  reporting: {
    format: 'json',
    outputDir: 'test-data/benchmarks',
    compareWith: 'test-data/baseline-v12.0.0.json'
  }
};
```

---

## BENCHMARK REPORTING

### Benchmark Report Template

```markdown
# Performance Optimization Benchmark Report
**Date:** July 17, 2026 (Post-Week 1)  
**Baseline:** v12.0.0 Production (June 2026)  
**Optimizations:** Response Streaming, DOM Caching

## Executive Summary
- Export latency: -35% (1500ms → 975ms)
- DOM extraction: -18% (400ms → 328ms)
- Throughput (200 concurrent): +8% (285 → 308 msg/sec)
- Memory (100MB export): -60% (300MB → 120MB)

## Detailed Results

### Command Latencies
| Command | Baseline P99 | Optimized P99 | Improvement |
|---------|-------------|---------------|------------|
| export_format_sqlite | 3000ms | 1800ms | -40% |
| dom_snapshot_full | 1200ms | 985ms | -18% |
| export_format_json | 1500ms | 900ms | -40% |
| export_format_har | 900ms | 540ms | -40% |

### System Throughput
- 50 concurrent: 481 → 505 msg/sec (+5%)
- 100 concurrent: 380 → 412 msg/sec (+8%)
- 200 concurrent: 285 → 308 msg/sec (+8%)

### Memory Usage
- Peak memory (100MB export): 300MB → 120MB (-60%)
- Sustained load memory growth: <2 MB/min (stable)

### Cache Metrics
- DOM cache hit rate: 52% (target: 40%)
- Cache evictions: 12 in 10 minutes (stable)

## Pass/Fail Criteria
- [x] Throughput improvement > 5%
- [x] Export latency improvement > 30%
- [x] Memory peak < 50% of baseline
- [x] P99 latency unchanged
- [x] No memory leaks detected

## Recommendations
- Proceed to Week 2 optimizations
- Monitor context pool overhead in next phase
```

---

## CONTINUOUS BENCHMARKING

### GitHub Actions CI/CD Integration

```yaml
# .github/workflows/performance-benchmark.yml
name: Performance Benchmark

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Run baseline benchmarks
        run: npm run benchmark:baseline
        
      - name: Run optimized benchmarks
        run: npm run benchmark:optimized
        
      - name: Compare results
        run: npm run benchmark:compare
        
      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: benchmark-results
          path: test-data/benchmarks/
          
      - name: Comment on PR
        uses: actions/github-script@v6
        with:
          script: |
            const results = require('./test-data/benchmarks/comparison.json');
            const comment = `## Performance Benchmark Results\n${results.summary}`;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

---

## SUCCESS METRICS

### Minimum Thresholds (Must Achieve)
- [ ] Export latency reduction: >= -30%
- [ ] DOM extraction latency reduction: >= -15%
- [ ] Throughput improvement: >= +10%
- [ ] Peak memory reduction: >= -30%
- [ ] P99 latency maintained: < 2ms
- [ ] No performance regression on read operations

### Target Metrics (Optimal)
- [ ] Export latency reduction: -40% to -50%
- [ ] DOM extraction latency reduction: -20% to -30%
- [ ] Throughput improvement: +15% to +25%
- [ ] Peak memory reduction: -50% to -83%
- [ ] Cache hit rate: > 40%
- [ ] Context pool reuse: > 80%
- [ ] Buffer pool hit rate: > 95%

### Stretch Goals
- [ ] Export latency reduction: > -50%
- [ ] Throughput improvement: > 25%
- [ ] Memory leak detection: zero
- [ ] Connection affinity utilization: > 70%

---

## MEASUREMENT TOOLS & UTILITIES

### Node.js Profiling

```javascript
// Integrated profiling
const { performance, PerformanceObserver } = require('perf_hooks');

const obs = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration.toFixed(2)}ms`);
  });
});

obs.observe({ entryTypes: ['measure'] });

// Measure command execution
performance.mark('command-start');
await executeCommand('export_format_json');
performance.mark('command-end');
performance.measure('command-execution', 'command-start', 'command-end');
```

### Memory Profiling

```javascript
// Memory snapshot comparison
const memBefore = process.memoryUsage();
await heavyOperation();
const memAfter = process.memoryUsage();

console.log('Memory delta:', {
  heapUsed: `${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)}MB`,
  heapTotal: `${((memAfter.heapTotal - memBefore.heapTotal) / 1024 / 1024).toFixed(2)}MB`,
  external: `${((memAfter.external - memBefore.external) / 1024 / 1024).toFixed(2)}MB`
});
```

### Load Generation

```javascript
// Apache Bench
ab -n 10000 -c 200 http://localhost:8765

// Artillery
artillery quick --count 200 --num 5000 http://localhost:8765

// Custom load generator
node tests/benchmarks/load-generator.js --concurrent 200 --duration 300
```

---

## EXPECTED TIMELINE

| Phase | Duration | Metric | Target | Status |
|-------|----------|--------|--------|--------|
| Baseline | 1 day | All metrics captured | Reference point | PENDING |
| Week 1 | 5 days | Streaming + Caching | -30% export, -20% DOM | PENDING |
| Week 2 | 5 days | Pooling + Buffer | -40% export, -25% DOM, +10% throughput | PENDING |
| Week 3 | 5 days | Full suite validation | -50% export, -30% DOM, +15-25% throughput | PENDING |
| Documentation | 2 days | Final reports | Performance optimization complete | PENDING |

**Total Duration:** 3 weeks + 1 week for refinement = 4 weeks to production

---

## CONCLUSION

This comprehensive benchmarking strategy ensures that performance optimizations deliver measurable improvements across all critical metrics. Continuous monitoring and reporting enable rapid iteration and validation of each optimization phase.

**Expected Overall Impact:** 15-25% throughput improvement with -30% to -50% latency reduction for slow operations.
