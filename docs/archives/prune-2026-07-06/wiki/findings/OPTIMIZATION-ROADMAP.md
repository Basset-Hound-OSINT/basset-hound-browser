# Performance Optimization Roadmap

**Status:** Ready for Implementation  
**Priority Level:** Medium (Performance enhancements, not critical blockers)  
**Target Timeline:** 8-10 weeks for full implementation  
**Expected ROI:** 75% overall improvement (285 → 500+ cmd/sec)

---

## Quick Reference: Priority Matrix

```
                    HIGH EFFORT (15-24h)          LOW EFFORT (8-10h)
HIGH IMPACT         [P7] Worker Thread Pool        [P1] Response Streaming
(40-50% gain)       [P8] IPC Dispatcher Pool       [P5] Command Batching

MEDIUM IMPACT       [P6] DOM Element Sampling
(20-30% gain)       [P5] Command Batching

LOW IMPACT          [P3] JS Context Pooling        [P2] DOM Query Cache
(<20% gain)         [P4] Buffer Pool Optimization
```

---

## Phase 1: Quick Wins (Week 1-2, 30% Improvement)

### Sprint 1.1: Response Streaming Implementation (P1)

**Duration:** 1 week (10 hours)  
**Expected Improvement:** 40% latency reduction for exports  
**Affected Commands:** export_sqlite, export_warc, export_har (12 total)  
**Priority:** CRITICAL - Highest ROI (4.0x benefit/effort)

#### Tasks

```
Task 1: Create StreamingJSONWriter (2h)
├─ Implement base streaming class
├─ Add backpressure handling
├─ Support chunked output
└─ Add unit tests

Task 2: Integrate with Export Handlers (4h)
├─ Refactor export_sqlite handler
├─ Refactor export_warc handler
├─ Refactor export_har handler
├─ Add streaming configuration
└─ Integration tests (2h each)

Task 3: Backpressure & Cleanup (2h)
├─ Implement writable stream backpressure
├─ Add resource cleanup logic
├─ Handle error conditions
└─ End-to-end validation

Task 4: Performance Validation (2h)
├─ Benchmark before/after
├─ Validate memory usage
├─ Check for regressions
└─ Document results
```

#### Success Criteria
- Export latency < 600ms for 10MB payloads
- Peak memory usage < 50% of current
- 100% success rate in load testing
- Zero regressions in other commands

#### Files to Modify
```
New Files:
  websocket/streaming-writer.js
  tests/unit/streaming-writer.test.js

Modified Files:
  websocket/commands/export-formats.js
  websocket/response-serializer.js
```

### Sprint 1.2: DOM Query Caching (P2)

**Duration:** 1 week (8 hours)  
**Expected Improvement:** 20% latency reduction for DOM operations  
**Affected Commands:** get-html, dom-snapshot, extract-links (20 total)  
**Priority:** HIGH - Good ROI (2.5x benefit/effort)

#### Tasks

```
Task 1: DOMQueryCache Implementation (2h)
├─ Create request-scoped cache class
├─ Implement LRU eviction
├─ Add cache invalidation logic
└─ Support common selectors

Task 2: Integration with Extraction Handlers (3h)
├─ Modify dom-snapshot.js
├─ Modify html-capture.js
├─ Modify link extraction
├─ Add cache management

Task 3: Style Computation Memoization (2h)
├─ Cache computed style results
├─ Implement per-element caching
├─ Handle dynamic styles
└─ Add cache lifecycle

Task 4: Testing & Validation (1h)
├─ Unit tests for cache behavior
├─ Integration tests
├─ Performance benchmarks
└─ Regression testing
```

#### Success Criteria
- DOM operation latency < 300ms for typical pages
- Cache hit rate > 60% for repeated queries
- No cache invalidation bugs
- Backward compatible with existing API

#### Files to Modify
```
New Files:
  extraction/dom-query-cache.js
  tests/unit/dom-query-cache.test.js

Modified Files:
  extraction/dom-snapshot.js
  extraction/html-capture.js
  extraction/link-extraction.js
```

### Sprint 1.3: Parallel Track - Performance Monitoring

**Duration:** 1 week (5 hours)  
**Effort:** Setup performance regression detection  
**Priority:** SUPPORTING - Enables data-driven optimization

#### Tasks

```
Task 1: Metrics Collection (2h)
├─ Per-command latency tracking
├─ Throughput trending
├─ Memory usage trends
└─ CPU utilization tracking

Task 2: Regression Detection (2h)
├─ Baseline establishment
├─ Threshold alerting
├─ Historical comparison
└─ Report generation

Task 3: Dashboard Setup (1h)
├─ Real-time metrics display
├─ Trend visualization
└─ Alert configuration
```

---

## Phase 2: Performance Impact (Week 3-5, 20% Additional Improvement)

### Sprint 2.1: Buffer Pool Optimization (P4)

**Duration:** 1 week (8 hours)  
**Expected Improvement:** 5% throughput improvement  
**Affected Commands:** All (164) - affects every message  
**Priority:** MEDIUM - Good for overall throughput

#### Tasks

```
Task 1: Heap-Based Free List Implementation (4h)
├─ Create binary heap structure
├─ Implement O(log n) allocation
├─ Implement O(log n) deallocation
└─ Add statistical tracking

Task 2: Integration & Testing (3h)
├─ Replace existing pool interface
├─ Stress testing (1000+ allocations)
├─ Memory efficiency validation
└─ Backward compatibility

Task 3: Metrics & Reporting (1h)
├─ Allocation statistics
├─ Fragmentation metrics
└─ Performance improvement reporting
```

#### Success Criteria
- Allocation time < 1ms for all sizes
- Zero memory fragmentation increase
- 5%+ throughput improvement in load tests
- No memory leaks

#### Files to Modify
```
New Files:
  websocket/buffer-pool-heap.js
  tests/unit/buffer-pool-heap.test.js

Modified Files:
  websocket/response-serializer.js
  websocket/server.js
```

### Sprint 2.2: Command Batching API (P5)

**Duration:** 2 weeks (20 hours)  
**Expected Improvement:** 30% for batch operations  
**Affected Commands:** Batch operations (8 commands)  
**Priority:** HIGH - Significant improvement for batch workflows

#### Tasks

```
Task 1: Batching Framework Design (4h)
├─ Design batching API
├─ Define command grouping rules
├─ Plan execution strategy
└─ Document interface

Task 2: Batch Command Handler (8h)
├─ Implement batch executor
├─ Single IPC call for grouped operations
├─ Error handling per-command
├─ Transaction-like semantics

Task 3: Integration with Existing Handlers (5h)
├─ Modify batch operation handlers
├─ Update command dispatcher
├─ Client API updates
└─ Documentation

Task 4: Testing & Validation (3h)
├─ Unit tests for batching
├─ Integration tests
├─ Performance benchmarks
└─ Compatibility testing
```

#### Success Criteria
- Batch operations 30% faster than sequential
- Per-command error handling preserved
- Backward compatible with non-batch clients
- Clear API documentation

#### Files to Modify
```
New Files:
  websocket/commands/batch-executor.js
  tests/unit/batch-executor.test.js
  docs/API-BATCHING.md

Modified Files:
  websocket/command-dispatcher.js
  websocket/commands/batch-operations-commands.js
```

### Sprint 2.3: DOM Element Sampling (P6)

**Duration:** 1-2 weeks (10 hours)  
**Expected Improvement:** 25% for large DOM trees (1000+ elements)  
**Affected Commands:** DOM extraction (20 total)  
**Priority:** MEDIUM - Important for large websites

#### Tasks

```
Task 1: Sampling Strategy Development (2h)
├─ Design intelligent sampling algorithm
├─ Define sampling rates
├─ Plan progressive loading
└─ Fallback logic

Task 2: Implementation (5h)
├─ Implement adaptive sampling
├─ Progressive loading mechanism
├─ Full traversal fallback
└─ Configuration system

Task 3: Integration & Testing (3h)
├─ Modify dom-snapshot.js
├─ Update extraction handlers
├─ Comprehensive testing
└─ Performance validation
```

#### Success Criteria
- Large DOM extraction < 300ms
- Sample quality > 95% of full traversal
- Progressive loading visible improvement
- No loss of accuracy for small DOMs

#### Files to Modify
```
New Files:
  extraction/dom-sampler.js
  tests/unit/dom-sampler.test.js

Modified Files:
  extraction/dom-snapshot.js
  extraction/manager.js
```

---

## Phase 3: Architectural Improvements (Week 6-10, 25% Additional Improvement)

### Sprint 3.1: Worker Thread Pool for Compression (P7)

**Duration:** 3-4 weeks (24 hours)  
**Expected Improvement:** 50% latency reduction for compression-heavy operations  
**Affected Commands:** Screenshots, exports (12 commands)  
**Priority:** CRITICAL - Largest single improvement opportunity

#### Tasks

```
Task 1: Worker Thread Pool Infrastructure (6h)
├─ Design thread pool architecture
├─ Implement work queue
├─ Add task scheduling
├─ Error handling & recovery
└─ Resource management

Task 2: Compression Worker Implementation (8h)
├─ Create worker process
├─ Implement PNG compression
├─ Implement WebP conversion
├─ Add quality adaptation
└─ Performance tracking

Task 3: Integration with Command Handlers (6h)
├─ Modify screenshot handlers
├─ Modify export handlers
├─ Backpressure handling
├─ Error handling & fallback
└─ Queue management

Task 4: Testing & Performance Validation (4h)
├─ Unit tests for worker pool
├─ Integration tests
├─ Load testing (high concurrency)
├─ Memory efficiency validation
└─ Performance benchmarking
```

#### Success Criteria
- Screenshot compression < 200ms (vs. 600ms current)
- Export compression complete without main thread blocking
- Thread pool utilization > 80% under load
- 50% latency improvement achieved
- Zero data corruption

#### Files to Modify
```
New Files:
  utils/worker-pool.js
  workers/compression-worker.js
  tests/unit/worker-pool.test.js
  tests/integration/compression-worker.test.js

Modified Files:
  screenshots/manager.js
  websocket/commands/export-formats.js
  websocket/server.js
```

#### Architecture Diagram

```
WebSocket Message
      │
      ├─────────────────────────────┐
      │                             │
      v                             v
  Fast Path              Compression Needed
  (routing, etc)               │
      │                        v
      │            WorkerThreadPool
      │            ├─ Worker 1
      │            ├─ Worker 2
      │            └─ Worker 3
      │                 │
      │                 v
      │            Compressed Result
      │                 │
      └─────────┬───────┘
                 v
            ResponseSerializer
                 │
                 v
            WebSocket Send
```

### Sprint 3.2: IPC Dispatcher Pool (P8)

**Duration:** 3-4 weeks (22 hours)  
**Expected Improvement:** 30% latency reduction for IPC-heavy operations  
**Affected Commands:** DOM, JS operations (45 commands)  
**Priority:** HIGH - Fundamental optimization

#### Tasks

```
Task 1: IPC Dispatcher Pool Design (5h)
├─ Analyze current IPC patterns
├─ Design pooling strategy
├─ Plan context lifecycle
├─ Documentation

Task 2: Dispatcher Pool Implementation (8h)
├─ Create dispatcher pool class
├─ Implement context reuse
├─ Add lifecycle management
├─ Error recovery

Task 3: JavaScript Context Pooling (6h)
├─ Pre-create renderer contexts
├─ Implement context assignment
├─ Script pre-compilation
├─ Context cleanup

Task 4: Integration & Testing (3h)
├─ Update all JS execution handlers
├─ Comprehensive testing
├─ Load testing
├─ Performance validation
```

#### Success Criteria
- IPC latency < 30ms (vs. 50-100ms current)
- Context pool utilization > 75%
- Zero context state contamination
- 30% improvement for IPC-heavy operations
- Backward compatible

#### Files to Modify
```
New Files:
  websocket/ipc-dispatcher-pool.js
  websocket/javascript-context-pool.js
  tests/unit/ipc-dispatcher-pool.test.js

Modified Files:
  websocket/server.js
  websocket/command-dispatcher.js
  extraction/dom-snapshot.js
  Multiple JS execution handlers
```

---

## Implementation Guidelines

### Code Quality Standards

```
For all optimizations:

1. Maintain Test Coverage
   - Unit tests for new classes (>80% coverage)
   - Integration tests for handler changes
   - Regression tests for modified code
   - Performance benchmarks

2. Documentation
   - Inline code comments for complex logic
   - Architecture diagrams where helpful
   - Usage examples for new APIs
   - Migration guide if breaking

3. Backward Compatibility
   - Maintain existing API surface
   - No removal of public methods
   - Deprecation warnings for changes
   - Clear upgrade path

4. Performance Verification
   - Benchmark before and after
   - Document improvement achieved
   - Identify new bottlenecks
   - Compare against targets
```

### Testing Strategy

**Unit Tests:**
- Create one test file per new module
- Test normal case, edge cases, error cases
- Mock external dependencies
- Target >80% code coverage

**Integration Tests:**
- Test interaction with command handlers
- Verify WebSocket integration
- Check error handling end-to-end
- Validate with real command flows

**Load Tests:**
- Run with 50, 100, 200 concurrent clients
- Sustained load for 5+ minutes
- Monitor memory, CPU, latency
- Validate improvement metrics

**Regression Tests:**
- Automated before/after comparison
- Fail if degradation > 5%
- Run on every commit (CI/CD)
- Historical trend tracking

### Deployment Strategy

```
Phase Deployment Plan:

Phase 1 (Week 2-3):
  ├─ Feature flags for new features
  ├─ 10% canary deployment
  ├─ Monitor metrics for 24h
  ├─ Gradual rollout to 100%
  └─ Keep rollback capability

Phase 2 (Week 5-6):
  ├─ Batch API released as opt-in
  ├─ Graduated rollout based on usage
  ├─ Monitor adoption metrics
  └─ Full release by week 6

Phase 3 (Week 10+):
  ├─ Worker pools deployed cautiously
  ├─ Blue-green deployment strategy
  ├─ Extensive monitoring
  ├─ Automated rollback on failure
  └─ Long-term stability verification
```

---

## Metrics & Success Criteria

### Phase 1 Validation (End of Week 2)

```
Metric                          Target      Accept Range    Current
─────────                       ──────      ────────────    ───────
Export latency (p50)            600ms       550-650ms       1500ms
Export latency (p99)            900ms       850-1000ms      3000ms
DOM op latency (p50)            200ms       180-220ms       400ms
DOM op latency (p99)            400ms       350-450ms       700ms
Query cache hit rate            60%         55-65%          N/A
Overall throughput              370 cmd/sec 360-385         285 cmd/sec
Memory growth                   0 MB/h      < 0.5 MB/h      0 MB/h
```

### Phase 2 Validation (End of Week 5)

```
Metric                          Target      Accept Range    Current
─────────                       ──────      ────────────    ───────
Buffer pool ops                 < 0.1ms     < 0.2ms         0.5ms
Batch op improvement            30%         28-32%          N/A
Large DOM latency               300ms       250-350ms       800ms
Overall throughput              444 cmd/sec 430-460         370 cmd/sec
```

### Phase 3 Validation (End of Week 10)

```
Metric                          Target      Accept Range    Final Target
─────────                       ──────      ────────────    ────────────
Screenshot latency              200ms       180-220ms       600ms
Worker pool utilization         80%         75-90%          N/A
IPC latency                      30ms        25-35ms         100ms
Overall throughput              500 cmd/sec 480-520         444 cmd/sec
P99 latency                      < 1ms       < 1.5ms         1.95ms
Total improvement               75%         70-80%          0% (baseline)
```

---

## Risk Assessment & Mitigation

### High-Risk Items

```
Risk: Worker Thread Pool Failures
  Impact: Screenshot/export operations fail
  Probability: Medium (thread pool complexity)
  Mitigation:
    ├─ Fallback to main-thread compression
    ├─ Comprehensive error handling
    ├─ Circuit breaker pattern
    └─ Extensive testing before release

Risk: IPC Context Contamination
  Impact: Data leaks between requests
  Probability: Medium (context reuse complexity)
  Mitigation:
    ├─ Context isolation verification
    ├─ Per-context memory clearing
    ├─ Security testing
    └─ State validation between reuses

Risk: Memory Regression
  Impact: Heap usage increases
  Probability: Low (well-monitored)
  Mitigation:
    ├─ Memory monitoring in every test
    ├─ Automated regression detection
    ├─ Memory profiling tools integration
    └─ Alerts on threshold violation

Risk: Backward Compatibility
  Impact: Client code breaks
  Probability: Low (careful API design)
  Mitigation:
    ├─ API versioning strategy
    ├─ Deprecation warnings
    ├─ Migration guides
    └─ Long transition period
```

### Rollback Strategy

```
For each phase:

1. Version Control
   ├─ Separate branch per optimization
   ├─ Feature flags for gradual rollout
   └─ Tag releases for quick rollback

2. Monitoring & Alerts
   ├─ Real-time performance dashboard
   ├─ Automated regression detection
   ├─ Error rate monitoring
   └─ Resource usage tracking

3. Rollback Procedure
   ├─ Instant flag disable for feature flags
   ├─ Git revert for code changes
   ├─ Database migration rollback (if needed)
   └─ Communication plan
```

---

## Success Story Template

Upon completion of each phase, document:

```
## Phase X Completion Report

### Metrics Achieved
- Throughput improvement: X%
- Latency reduction: Y%
- Memory optimization: Z%
- New bottleneck identified: ABC

### Lessons Learned
- What worked well
- Unexpected challenges
- Process improvements for next phase

### Production Impact
- Real-world metrics improvements
- User feedback
- System stability assessment

### Next Phase Preparation
- Data insights for next priorities
- Lessons to apply
```

---

## Timeline Summary

```
Week 1-2:    Phase 1 Quick Wins (30% improvement)
             ├─ Response Streaming (P1)
             ├─ DOM Query Caching (P2)
             └─ Performance Monitoring
             
Week 3-5:    Phase 2 Performance (20% improvement)
             ├─ Buffer Pool (P4)
             ├─ Command Batching (P5)
             └─ DOM Sampling (P6)

Week 6-10:   Phase 3 Architecture (25% improvement)
             ├─ Worker Thread Pool (P7)
             └─ IPC Dispatcher Pool (P8)

Week 11:     Validation & Stabilization
             ├─ Final performance verification
             ├─ Production deployment
             └─ Post-mortem analysis
```

---

## Conclusion

This optimization roadmap provides a structured approach to achieving 75% performance improvement through carefully sequenced optimizations. The phased approach allows for:

- **Quick wins first** - P1 & P2 provide immediate ROI
- **Risk mitigation** - Large architectural changes in later phases
- **Data-driven decisions** - Each phase informs the next
- **Minimal disruption** - Backward compatible throughout
- **Production validated** - Real metrics guide prioritization

**Expected Final State (End of Week 10):**
- Throughput: 285 → 500+ cmd/sec (75% improvement)
- P50 Latency: 0.10 → 0.08ms
- P99 Latency: 1.95 → <1ms
- Memory: Stable, zero growth
- No new bottlenecks introduced
- Production ready

---

*Optimization Roadmap v1.0*  
*Generated: 2026-07-03*  
*Status: Ready for Implementation*
