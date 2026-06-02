# Stability Validation Test Suite

## Overview
Comprehensive long-running stability validation framework for Basset Hound Browser v12.0.0+. Tests production-ready operation across 24+ hours with realistic load patterns and failure scenarios.

## Framework Statistics
- **Total Code:** 2,678 lines
- **Test Files:** 6 production-grade suites
- **Execution Time:** 30 minutes to 24+ hours
- **Metrics Tracked:** Memory, latency, errors, connections
- **Status:** ✅ Ready for execution

## Test Suites

### 1. Quick Validation (30 minutes)
**File:** `quick-validation.js` (478 lines)

Expedited validation with 3 phases:
- **Phase 1 (5 min):** Baseline stability - ping and status
- **Phase 2 (10 min):** Peak load - 5 parallel clients
- **Phase 3 (10 min):** Recovery - error injection and recovery

**Run:**
```bash
node quick-validation.js
```

**Output:** `/tests/results/quick-validation-[timestamp].json`

**Use Case:** Quick feedback, CI pre-flight, development validation

---

### 2. 24-Hour Continuous Session (24 hours)
**File:** `24-hour-session.test.js` (432 lines)

Single WebSocket connection maintained for 24+ hours:
- Mixed workload: 70% monitoring, 20% detection, 10% management
- Heartbeat every 30 seconds
- Memory snapshots every 4 hours
- Real-time metric reporting every 60 seconds

**Metrics:**
- Heap memory growth (target: <2 MB/hour)
- Connection uptime (target: >99.5%)
- Operation success (target: >99%)
- Latency consistency (target: <2ms P99)

**Run:**
```bash
timeout 86400 node 24-hour-session.test.js
```

**Output:** `/tests/results/24-hour-session-[timestamp].json`

**Use Case:** Production deployment requirement, long-term validation

---

### 3. Load Profile Test (24 hours with realistic patterns)
**File:** `load-profile.test.js` (427 lines)

Simulates realistic daily load with dynamic concurrency:
- **12am-6am:** 10 concurrent (night maintenance)
- **7am-11am:** 300 concurrent (morning peak)
- **12pm-6pm:** 150 concurrent (afternoon normal)
- **7pm-11pm:** 50 concurrent (evening low)
- **11pm-3am:** 10 concurrent (night maintenance)

**Features:**
- Automatic client pool scaling
- Per-phase metric tracking
- Concurrent client simulation
- Real-world workload patterns

**Run:**
```bash
node load-profile.test.js
```

**Output:** `/tests/results/load-profile-[timestamp].json`

**Use Case:** Peak load validation, scaling verification, capacity planning

---

### 4. Failure Injection & Recovery (2 hours)
**File:** `failure-injection.test.js` (672 lines)

Tests resilience through 3 failure scenarios:

**Scenario 1: Network Failures**
- Connection reset during operation
- Timeout and reconnection
- Multiple reconnection attempts
- Data consistency verification

**Scenario 2: Resource Constraints**
- Memory pressure (heap spike)
- Slow network simulation
- Graceful degradation
- Continued operation under constraints

**Scenario 3: Cascading Failures**
- Multiple staggered client failures
- System-wide recovery
- Cascade containment
- System resilience validation

**Run:**
```bash
node failure-injection.test.js
```

**Output:** `/tests/results/failure-injection-[timestamp].json`

**Use Case:** Resilience validation, recovery verification, production readiness

---

## Supporting Modules

### Metrics Tracker (361 lines)
**File:** `metrics-tracker.js`

Aggregates and analyzes test metrics:
- Real-time measurement recording
- Statistical analysis (percentiles, growth rates)
- Stability criteria assessment
- Multi-test aggregation
- Report generation

**Classes:**
- `MetricsTracker` - Single test metrics
- `StabilityReportAggregator` - Multi-test analysis

---

### Test Orchestration (308 lines)
**File:** `run-validation.js`

Orchestrates all tests with aggregation:
- Server health check
- Test execution with timeouts
- Comprehensive reporting
- Results aggregation
- Pass/fail criteria assessment

**Features:**
- Runs all tests in sequence
- Aggregates metrics
- Generates comprehensive report
- Supports full 24-hour validation

**Run:**
```bash
node run-validation.js                    # Quick suite
RUN_FULL_TESTS=true node run-validation.js  # Full 24-hour
```

---

## Quick Start

### 1. Quick Test (Recommended First)
```bash
cd tests/stability
node quick-validation.js
```
Expected duration: 30 minutes
Expected output: Memory stable, success rate >95%

### 2. Load Profile Test
```bash
cd tests/stability
node load-profile.test.js
```
Expected duration: 2 hours
Expected output: Handles 300 concurrent connections

### 3. Failure Injection Test
```bash
cd tests/stability
node failure-injection.test.js
```
Expected duration: 2 hours
Expected output: 100% recovery from all failures

### 4. Full 24-Hour Test (Production Only)
```bash
cd tests/stability
timeout 86400 node 24-hour-session.test.js
```
Expected duration: 24 hours
Expected output: Memory <2 MB/hour growth, success >99.9%

---

## Success Criteria

All must be met for production deployment:

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Memory Stability | <2 MB/hour | Growth rate calculation |
| Latency | <2ms P99 | Per-operation tracking |
| Success Rate | >99.9% | Message counting |
| Uptime | >99.5% | Connection monitoring |
| Recovery | 100% | Failure injection results |
| Connection Leaks | None | Lifecycle tracking |
| Error Rate | <0.1% | Error categorization |

---

## Metrics Captured

### Per-Measurement
- Timestamp (ISO 8601)
- Heap memory (bytes)
- Latency (milliseconds)
- Success/failure status
- Error message (if applicable)

### Per-Phase
- Phase name and duration
- Total messages processed
- Success count and rate
- Average/min/max latency
- Concurrency level
- Memory growth

### Per-Test
- Start/end timestamps
- Total duration
- Message statistics
- Memory statistics with growth rate
- Latency statistics (percentiles)
- Connection state tracking
- Error categorization

### Aggregated
- Combined statistics across tests
- Overall stability assessment
- Pass/fail on all criteria
- Production readiness recommendation

---

## Output Files

### Test Results
Each test generates JSON output with:
- Report summary
- Detailed metrics
- Criteria assessment
- Pass/fail status

Location: `/tests/results/[test-name]-[timestamp].json`

### Real-Time Console Output
Tests print progress every 60 seconds:
```
[METRIC] 0.02h - Heap: 45.23MB, Growth: 0.12MB, Success: 100%, Errors: 0
[METRIC] 0.04h - Heap: 45.45MB, Growth: 0.34MB, Success: 99.8%, Errors: 0
[PHASE: Morning Peak] Concurrency: 300, Messages: 5430, Success: 5410
[HEAP SNAPSHOT] 1 - 2026-06-01T14:00:00Z - Heap: 45.67MB
```

---

## Troubleshooting

### WebSocket Server Not Running
```bash
# Error: ECONNREFUSED 127.0.0.1:8765
# Fix: Start server
cd /home/devel/basset-hound-browser
node websocket/server.js &
```

### Test Timeout
```bash
# Increase timeout (example: 2 hours for quick test)
timeout 7200 node quick-validation.js
```

### Memory Issues
```bash
# Enable GC logging
node --expose-gc --trace-gc quick-validation.js
```

### Connection Issues
```bash
# Check if port is in use
netstat -tuln | grep 8765
# Kill existing process
lsof -ti:8765 | xargs kill -9
```

---

## Integration

### Package.json Scripts
Add to `package.json`:
```json
{
  "scripts": {
    "test:stability": "node tests/stability/quick-validation.js",
    "test:stability:load": "node tests/stability/load-profile.test.js",
    "test:stability:24h": "timeout 86400 node tests/stability/24-hour-session.test.js",
    "test:stability:all": "node tests/stability/run-validation.js"
  }
}
```

### CI/CD Pipeline
```bash
# Pre-flight check
npm run test:stability

# Pre-deployment
npm run test:stability:load
npm run test:stability:injection

# Production gate
timeout 86400 npm run test:stability:24h
```

---

## Monitoring During Tests

### System Monitoring
```bash
# CPU and memory
top -u $(whoami)

# Network connections
netstat -an | grep 8765

# Disk I/O
vmstat 1

# Process stats
ps aux | grep node
```

### Log Monitoring
```bash
# Watch test results
tail -f /tests/results/*.json

# Monitor WebSocket server
grep -i error /path/to/server.log
```

---

## Documentation

### Quick Reference
- [`/STABILITY-TESTING-QUICKSTART.md`](../STABILITY-TESTING-QUICKSTART.md) - Quick start guide

### Comprehensive Documentation
- [`/docs/findings/STABILITY-VALIDATION-FRAMEWORK.md`](../../docs/findings/STABILITY-VALIDATION-FRAMEWORK.md) - Full framework details
- [`/docs/findings/LONG-RUNNING-STABILITY-COMPLETE.txt`](../../docs/findings/LONG-RUNNING-STABILITY-COMPLETE.txt) - Execution report

### Source Code
All test files include extensive inline comments and documentation.

---

## Production Deployment Gate

Before deploying to production:

✅ Quick validation test passes (30 min)  
✅ Load profile test passes (2 hours)  
✅ Failure injection test passes (2 hours)  
✅ 24-hour continuous session passes  
✅ All metrics meet targets  
✅ All criteria assessment PASS  
✅ Team review and approval  
✅ Documentation complete  

---

## Performance Expectations

### Memory
- Baseline: 40-50 MB heap
- Peak: 50-60 MB heap
- Growth: <2 MB/hour (production target)

### Latency
- Min: 0.01-0.1 ms
- Avg: 0.5-1.5 ms
- P99: <2 ms (production target)
- Max: <10 ms

### Throughput
- 1 connection: ~100 msg/sec
- 5 connections: ~450 msg/sec
- 300 connections: ~40,000 msg/sec

### Reliability
- Success rate: >99.9%
- Error rate: <0.1%
- Recovery rate: 100%
- Recovery time: <5 seconds

---

## Support & Questions

For issues or questions:
1. Review the troubleshooting section above
2. Check comprehensive framework documentation
3. Review test output JSON files
4. Check WebSocket server logs
5. Enable verbose logging and retry

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-01 | Initial framework creation |

---

**Status:** ✅ Framework Complete & Ready for Execution  
**Total Code:** 2,678 lines across 6 test modules  
**Last Updated:** June 1, 2026  
**Confidence Level:** VERY HIGH
