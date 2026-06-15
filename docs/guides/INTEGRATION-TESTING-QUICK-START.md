# Integration Testing - Quick Start Guide

**Project:** Basset Hound Browser v12.0.0
**Date:** June 14, 2026
**Status:** READY FOR EXECUTION

## 30-Second Quick Start

```bash
# Terminal 1: Start the server
npm start

# Terminal 2: Run all integration tests
node tests/validation/run-integration-validation.js

# Results will be in: tests/results/integration-validation/
```

## What Gets Tested

| Test Suite | Duration | Focus | Status |
|-----------|----------|-------|--------|
| Feature Integration | 5-10m | Screenshots & video recording | Created ✓ |
| Stability Tests | 10-15m | Memory, connections, resources | Created ✓ |
| Performance Tests | 15-20m | Latency, throughput, regressions | Created ✓ |
| Docker Integration | 5-10m | Container deployment, scaling | Created ✓ |

**Total Duration:** 40-55 minutes

## Test Coverage

### Feature Tests (15+ scenarios)
- ✓ Screenshot formats (PNG, JPEG, WebP)
- ✓ Screenshot types (viewport, full-page, element)
- ✓ Quality settings (50-90)
- ✓ Video codecs (VP8, VP9, H.264, H.265)
- ✓ Frame rates (10fps, 24fps, 30fps)
- ✓ Combined operations (screenshots during video)
- ✓ Error handling and recovery

### Stability Tests (10+ scenarios)
- ✓ Memory leak detection
- ✓ Connection stability (20+ sustained)
- ✓ Transient error recovery
- ✓ Resource cleanup
- ✓ Rapid-fire operations
- ✓ Sustained load (30+ seconds)

### Performance Tests (12+ scenarios)
- ✓ Latency baselines (P50/P95/P99)
- ✓ Throughput measurement
- ✓ Memory per operation
- ✓ Regression detection
- ✓ Format conversion efficiency
- ✓ Concurrent operation handling

### Docker Tests (10+ scenarios)
- ✓ Container health checks
- ✓ WebSocket API availability
- ✓ Command execution
- ✓ Concurrent connections
- ✓ Resource constraints
- ✓ Error recovery

## Expected Results

### Success Indicators
- [ ] All feature tests pass (95%+)
- [ ] Memory growth < 100MB per 5-operation sequence
- [ ] Performance within 20% of baseline
- [ ] Docker container stable
- [ ] Decision: "GO" or "GO - Minor issues acceptable"

### What to Watch For
- Memory spikes during sustained load
- Timeouts on first run (WebSocket startup)
- Performance degradation in later tests
- Docker tests may be skipped if container not running

## Performance Baselines

### Screenshots
- **Latency:** 100ms (P50), 150ms (P95), 200ms (P99)
- **Throughput:** 100 ops/sec
- **Memory:** 1-2MB per operation

### Video Recording
- **Codec Init:** 200-500ms
- **Frame Rate:** 24fps ± 5%
- **Memory:** 50-100MB per session

## Go/No-Go Criteria

**GO Decision:** All tests pass, < 5% failures
**NO-GO Decision:** > 20% test failures or memory leak detected

## Files Created

### Test Suites
- `tests/integration/feature-screenshots-video.test.js` (12.7 KB)
- `tests/integration/stability-long-running.test.js` (13.6 KB)
- `tests/integration/performance-regression-tests.test.js` (13.5 KB)
- `tests/validation/docker-integration.test.js` (11.7 KB)

### Test Runner
- `tests/validation/run-integration-validation.js` (15.7 KB)

### Documentation
- `docs/handoffs/INTEGRATION-VALIDATION-COMPLETE.md` (comprehensive)
- `tests/results/INTEGRATION-VALIDATION-SUMMARY.md` (detailed)
- `INTEGRATION-TESTING-QUICK-START.md` (this file)

## Prerequisites

### Minimum Requirements
- Node.js 16+
- 2GB RAM
- npm install (already done)

### Recommended
- 4GB RAM
- 4+ CPU cores
- Isolated environment
- Port 8765 available

## Common Issues & Fixes

### "ECONNREFUSED 127.0.0.1:8765"
**Problem:** WebSocket server not running
**Fix:** 
```bash
npm start
sleep 5  # Wait for startup
```

### Tests Timeout
**Problem:** Server slow to respond
**Fix:**
```bash
# Increase timeout
npm test -- --testTimeout=120000
```

### Memory Issues
**Problem:** Process runs out of memory
**Fix:**
```bash
# Increase Node heap
node --max-old-space-size=4096 tests/validation/run-integration-validation.js
```

### Docker Tests Skip
**Problem:** Docker container not running
**Fix:** (Optional - tests skip gracefully)
```bash
docker build -t basset-hound:12.0.0 .
docker run -p 8765:8765 basset-hound:12.0.0
```

## Quick Commands Reference

```bash
# Run everything (recommended)
node tests/validation/run-integration-validation.js

# Run individual suites
npm test -- tests/integration/feature-screenshots-video.test.js
npm test -- tests/integration/stability-long-running.test.js
npm test -- tests/integration/performance-regression-tests.test.js
npm test -- tests/validation/docker-integration.test.js

# Run with output
npm test -- --verbose tests/integration/feature-screenshots-video.test.js

# Generate coverage
npm test -- --coverage tests/integration/

# Watch mode (good for debugging)
npm test -- --watch tests/integration/feature-screenshots-video.test.js
```

## Test Results Location

All results saved to: `tests/results/integration-validation/`

Key files:
- `INTEGRATION-VALIDATION-REPORT.json` - Complete results
- `*.json` - Individual test suite results

## Success Checklist

Before running:
- [ ] Port 8765 not in use
- [ ] 2GB+ RAM available
- [ ] npm install completed
- [ ] npm start can be run

After running:
- [ ] All tests complete without crashes
- [ ] Results in `tests/results/integration-validation/`
- [ ] No "ERROR" in final decision
- [ ] Performance within thresholds

## Performance Expectations

### First Run
- Feature tests: 5-10 minutes
- Stability tests: 10-15 minutes (longer due to sustained load)
- Performance tests: 15-20 minutes
- Docker tests: 5-10 minutes

### Subsequent Runs
- Same timing (tests are independent)
- Results cleared between runs

## Next Steps After Testing

1. **Review Results**
   - Check JSON report
   - Review any failures
   - Verify performance metrics

2. **Analyze Issues**
   - If memory spike: profile with clinic.js
   - If latency increase: check CPU/disk
   - If failures: review error messages

3. **Make Decision**
   - GO: Proceed to staging/production
   - NO-GO: Fix and retest

4. **Document Findings**
   - Update baseline if needed
   - Note any environmental factors
   - Add to release notes

## Support Documents

For more details:
- **Complete Guide:** `docs/handoffs/INTEGRATION-VALIDATION-COMPLETE.md`
- **Detailed Summary:** `tests/results/INTEGRATION-VALIDATION-SUMMARY.md`
- **Test Code:** `tests/integration/*.test.js` and `tests/validation/*.test.js`

## Questions?

Check these resources:
1. Test file comments (each test has documentation)
2. Comprehensive guide (see above)
3. JSON results (detailed metrics)
4. Test code itself (reference implementation)

---

**Ready to test?** Run the quick start command above!

```bash
npm start &
sleep 5
node tests/validation/run-integration-validation.js
```
