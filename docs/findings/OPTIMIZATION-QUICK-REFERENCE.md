# Performance Optimization - Quick Reference Guide

**Last Updated:** June 4, 2026  
**Status:** Ready for Implementation  
**Effort:** 10-12 hours total

---

## TL;DR - What You Need to Know

### The Goal
Increase Basset Hound Browser throughput from **285 msg/sec → 500+ msg/sec** (+75%)  
Reduce latency from **2.1ms P99 → 0.9ms P99** (-57%)

### The Approach
5 bottleneck fixes, 10-12 hours implementation, LOW risk

### The Result
Production-ready system supporting 300+ concurrent clients

---

## 5 Optimizations at a Glance

### ✅ OPT-01: Hash-Based Command Routing
```
Current:  if/else chain searching through 164 commands
Problem:  30-80µs per message (40% of processing time)
Solution: Hash map lookup O(1)
Gain:     +20% throughput (+57 msg/sec)
Effort:   2 hours
File:     /websocket/server.js
```

### ✅ OPT-02: DOM Extraction Caching
```
Current:  Re-parse DOM for each extraction
Problem:  20-30ms per operation
Solution: Cache parsed DOM with TTL, invalidate on navigation
Gain:     +15% throughput (+42 msg/sec)
Effort:   2 hours
File:     /inspector/manager.js
```

### ✅ OPT-03: Async Screenshot Writing
```
Current:  Synchronous disk write blocks response
Problem:  10-50ms blocking per screenshot
Solution: Queue screenshots, batch write in background
Gain:     +15% throughput (+42 msg/sec)
Effort:   2 hours
Files:    Create /screenshots/async-writer.js, update manager.js
```

### ✅ OPT-04: External API Caching
```
Current:  Real-time lookups for Tor nodes, proxy reputation
Problem:  50-100ms per lookup, 80%+ repeated queries
Solution: Local cache with 1-24 hour TTL
Gain:     +5% throughput (+14 msg/sec)
Effort:   2 hours
Files:    /proxy/manager.js, /evasion/*
```

### ✅ OPT-05: JavaScript Context Pooling
```
Current:  New sandbox context per script execution
Problem:  5-10ms creation overhead
Solution: Pool of reusable contexts
Gain:     +15% throughput (+42 msg/sec)
Effort:   2 hours
Files:    Create /sandbox/context-pool.js
```

---

## Implementation Order

### Phase 1 (6-8 hours, +40-50% gain)
1. **OPT-01: Hash Routing** (2 hrs) - Start here, lowest risk
2. **OPT-02: DOM Caching** (2 hrs) - Moderate complexity
3. **OPT-03: Async I/O** (2 hrs) - Moderate complexity

### Phase 2 (4-6 hours, additional +20-25% gain)
4. **OPT-04: API Caching** (2 hrs) - Low complexity
5. **OPT-05: Context Pooling** (2 hrs) - Moderate complexity

---

## Quick Start Checklist

### Pre-Implementation
- [ ] Read PERFORMANCE-PROFILING-REPORT.md
- [ ] Read PERFORMANCE-OPTIMIZATION-IMPLEMENTATION.md
- [ ] Create feature branches for each optimization
- [ ] Establish baseline metrics
- [ ] Review test suite

### Phase 1A: Hash Routing (2 hours)
- [ ] Create command router Map in server.js
- [ ] Register all 164 commands
- [ ] Replace if/else with hash lookup
- [ ] Run tests: `npm test`
- [ ] Benchmark: `npm run benchmark:commands`
- [ ] Expected: <10µs per lookup (vs 30-80µs)

### Phase 1B: DOM Caching (2 hours)
- [ ] Add cache to DOMInspector class
- [ ] Implement TTL-based invalidation
- [ ] Monitor cache hit rate
- [ ] Run tests: `npm test`
- [ ] Benchmark: `npm run benchmark:extraction`
- [ ] Expected: >80% cache hit rate

### Phase 1C: Async Screenshot Writing (2 hours)
- [ ] Create AsyncScreenshotWriter class
- [ ] Implement queue and batching
- [ ] Integrate with ScreenshotManager
- [ ] Run tests: `npm test`
- [ ] Benchmark: `npm run benchmark:screenshots`
- [ ] Expected: Screenshots return <100ms

### Testing & Validation (2-4 hours)
- [ ] Run full test suite
- [ ] Run performance profiler
- [ ] Load test at 100, 150, 200 concurrent
- [ ] Compare metrics vs baseline
- [ ] Document improvements
- [ ] Get approval for production

### Phase 2 (Optional, 4-6 hours)
- [ ] Repeat for OPT-04, OPT-05
- [ ] Additional +20-25% gain
- [ ] Same validation process

---

## Performance Targets by Phase

### After Phase 1 (6-8 hours)
```
Throughput:   285 → 380-420 msg/sec (+33-47%)
Avg Latency:  1.2ms → 0.6-0.8ms (-40-50%)
P99 Latency:  2.1ms → 1.2ms (-40%)
Concurrency:  200 stable → 200+ stable
```

### After Phase 2 (10-12 hours)
```
Throughput:   285 → 500-550 msg/sec (+75%)
Avg Latency:  1.2ms → 0.4-0.6ms (-50%)
P99 Latency:  2.1ms → 0.9ms (-57%)
Concurrency:  200 stable → 300+ stable
```

---

## File Changes Summary

### New Files to Create
1. `/home/devel/basset-hound-browser/screenshots/async-writer.js` (~150 lines)
2. `/home/devel/basset-hound-browser/sandbox/context-pool.js` (~150 lines)

### Files to Modify
1. `/websocket/server.js` - Add router initialization, update handleCommand()
2. `/inspector/manager.js` - Add cache layer to DOMInspector
3. `/screenshots/manager.js` - Integrate AsyncScreenshotWriter
4. `/proxy/manager.js` - Add API caching layer
5. `/evasion/*` - Add caching to Tor/proxy lookups

### Files NOT Changed
- No test file modifications needed
- No config file changes
- No package.json changes (no new dependencies)

---

## Testing Checklist

### Unit Tests
- [ ] All 164 commands still route correctly
- [ ] DOM cache invalidates on navigation
- [ ] Screenshot queue handles overflow
- [ ] API cache hit rate >80%
- [ ] Context pool isolation verified

### Integration Tests
- [ ] Full test suite passes
- [ ] No memory leaks detected
- [ ] Multi-extract operations 50% faster
- [ ] Screenshot operations return <100ms
- [ ] Script execution latency reduced

### Performance Tests
- [ ] Command lookup <10µs
- [ ] DOM extraction >50% faster
- [ ] Screenshots non-blocking
- [ ] API cache misses <50ms

### Load Tests
- [ ] 100 concurrent: +35-40% improvement
- [ ] 150 concurrent: +40-45% improvement
- [ ] 200 concurrent: +40-50% improvement
- [ ] 250 concurrent: Stable (new capability)
- [ ] 300 concurrent: Stress test passes

---

## Rollback Plan

Each optimization can be independently rolled back:

### Rollback OPT-01 (Hash Routing)
```bash
git revert <hash-routing-commit>
# Remove command router initialization
# Restore if/else in handleCommand()
# Restart server
# Time: 5 minutes
```

### Rollback OPT-02 (DOM Cache)
```bash
# Set cacheTTL = 0 to disable
# Or: git revert <dom-cache-commit>
# Restart server
# Time: 1 minute
```

### Rollback OPT-03 (Async I/O)
```bash
# Make queue synchronous
# Or: git revert <async-io-commit>
# Restart server
# Time: 5 minutes
```

### Rollback All
```bash
git revert <all-optimization-commits>
# Return to v12.2.0 baseline
# Restart server
# Time: 5 minutes
```

---

## Monitoring Metrics

### Command Routing
```
Metric: commandLookupTime
Target: <10µs per lookup
Alert:  >20µs = regression detected
```

### DOM Cache
```
Metric: domCacheHitRate
Target: >80%
Alert:  <70% = unexpected behavior
```

### Screenshot Queue
```
Metric: screenshotQueueSize
Target: <100 items on average
Alert:  >500 items = backpressure issue
```

### API Cache
```
Metric: apiCacheHitRate
Target: >80%
Alert:  <70% = TTL too short
```

### System Overall
```
Metric: throughput
Baseline: 285 msg/sec
Target P1: 380-420 msg/sec
Target P2: 500-550 msg/sec
Alert: >5% drop from target = investigate
```

---

## Common Issues & Solutions

### Issue: Command Not Found
**Cause:** Command not registered in router  
**Fix:** Add to command router in initialization  
**Test:** Check all 164 commands in load test

### Issue: Cache Returning Stale Data
**Cause:** Navigation didn't invalidate cache  
**Fix:** Verify framenavigated event handler  
**Test:** Rapid navigation sequences

### Issue: Screenshot Queue Growing Without Limit
**Cause:** Flush not triggering  
**Fix:** Check flush interval and max batch size  
**Test:** Monitor queue size under load

### Issue: Context Pool Leaking Memory
**Cause:** Contexts not returned to pool  
**Fix:** Verify cleanup on error  
**Test:** Long-running test with JS execution

### Issue: API Cache Returning Outdated Info
**Cause:** TTL too long  
**Fix:** Reduce TTL (check external service update rate)  
**Test:** Verify data currency

---

## Success Indicators

### ✅ Phase 1 Success
- Throughput increases 40-50%
- P99 latency improves 40-50%
- All tests still pass
- No memory leaks
- System stable at 200+ concurrent

### ✅ Phase 2 Success
- Throughput increases 75% total
- P99 latency improves 57% total
- System stable at 300+ concurrent
- Cache hit rates >80%
- Zero errors in load tests

### ✅ Production Ready
- All metrics within target
- No regressions detected
- Monitoring configured
- Rollback procedure tested
- Team trained on changes

---

## Time Estimates

| Phase | Task | Effort | Notes |
|-------|------|--------|-------|
| **1A** | Hash routing | 2h | Lowest risk |
| **1B** | DOM caching | 2h | Moderate |
| **1C** | Async I/O | 2h | Moderate |
| **Test** | Validation | 2-4h | Critical |
| **2A** | API caching | 2h | Optional |
| **2B** | Context pooling | 2h | Optional |
| **Deploy** | Staging/Prod | 2-4h | With monitoring |
| **TOTAL** | Full optimization | 14-22h | 3-4 days |

---

## Getting Help

### Documentation
- PERFORMANCE-PROFILING-REPORT.md - Detailed analysis
- PERFORMANCE-OPTIMIZATION-IMPLEMENTATION.md - Step-by-step guide
- PERFORMANCE-OPTIMIZATION-COMPLETE.txt - Full reference
- This file - Quick reference

### Questions?
1. Check the detailed implementation guide
2. Review the profiling report for specifics
3. Check the complete reference document
4. Ask the Wave 16 Performance Optimization Agent

---

## Key Takeaways

✅ **5 Clear Optimizations** - No ambiguity, clear implementation path  
✅ **75% Improvement** - From 285 to 500+ msg/sec throughput  
✅ **Low Risk** - Each optimization independent, rollback possible  
✅ **10-12 Hours** - Achievable in 2-3 days of focused effort  
✅ **High Confidence** - Based on comprehensive profiling analysis  
✅ **Production Ready** - Stable at 300+ concurrent clients  

**Status: Ready to Implement** ✅

---

*Generated: June 4, 2026*  
*Wave 16 Performance Optimization Initiative*
