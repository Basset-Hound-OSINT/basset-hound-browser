# Load Testing Quick Start Guide

## Overview

This directory contains comprehensive load and stress testing suites for Basset Hound Browser.

**Total Code**: 2,281 lines across 4 modules  
**Test Coverage**: Load, Stress, Soak, and Chaos scenarios  
**Time to Run**: 1.5+ hours (with orchestrator)

---

## Quick Start (5 minutes)

### 1. Verify WebSocket Server is Running

```bash
# Terminal 1: Start the browser server
npm start

# In another terminal, verify it's listening
curl http://localhost:8765/
```

### 2. Run Tests

```bash
# Run comprehensive load tests (Load + Stress scenarios)
node tests/load/comprehensive-load-test.js

# Run quick soak test (5 minutes)
node tests/load/soak-testing.js --quick

# Run chaos engineering tests (15 minutes)
node tests/load/chaos-engineering.js

# Run EVERYTHING with orchestrator (1.5+ hours)
node tests/load/test-orchestrator.js
```

### 3. View Results

```bash
# Find results directory
ls -la tests/results/load-testing-*/

# View human-readable report
cat tests/results/load-testing-*/report.txt

# View structured JSON results
cat tests/results/load-testing-*/summary-report.json | jq .
```

---

## Test Modules

### 1. Comprehensive Load Test (`comprehensive-load-test.js`)

Tests system performance at increasing load levels.

**Scenarios**:
- 50 concurrent connections (sustained 1 hour)
- 100 concurrent connections (sustained 1 hour)
- 200 concurrent connections (sustained 1 hour)
- 200 concurrent connections (stress, 5 min, high rate)
- 500 concurrent connections (stress, 5 min, high rate)
- 1000 concurrent connections (stress, 5 min, high rate)

**Runtime**: ~2 hours (if running full load tests)  
**Quick Run**: ~30 minutes (run stress tests only)

**Metrics Collected**:
- Message throughput (msg/sec)
- Success rate (%)
- Latency percentiles (P50, P95, P99)
- Memory usage and growth
- Connection stability

```bash
# Run all tests
node tests/load/comprehensive-load-test.js

# Results saved to: tests/results/comprehensive-load-test-{timestamp}.json
```

---

### 2. Soak Testing (`soak-testing.js`)

Long-running tests to detect memory leaks and stability issues.

**Duration Options**:
- Quick: 5 minutes (demonstration)
- Full: 24 hours (production validation)

**What It Tests**:
- Memory leak detection (linear trend analysis)
- Connection stability over time
- Garbage collection behavior
- Throughput consistency

```bash
# Quick 5-minute test
node tests/load/soak-testing.js --quick

# Full 24-hour test (run in background/tmux/screen)
node tests/load/soak-testing.js &

# Results saved to: tests/results/soak-test-{timestamp}.json
```

**Expected Output Patterns**:
```
[SOAK] 0.05h | 50 connections | Heap: 120MB | Throughput: 248 msg/s
[SOAK] 0.10h | 50 connections | Heap: 125MB | Throughput: 247 msg/s
[SOAK] 0.15h | 50 connections | Heap: 128MB | Throughput: 246 msg/s
...
✓ No memory leak detected
```

---

### 3. Chaos Engineering (`chaos-engineering.js`)

Tests resilience under adverse conditions.

**Test Scenarios**:
1. Network Latency (100ms)
2. Network Latency (500ms)
3. Connection Drop (10% drop rate)
4. Connection Drop (25% drop rate)
5. Memory Pressure (100MB allocation)
6. Memory Pressure (500MB allocation)

**Runtime**: ~15 minutes  
**Validates**: Recovery behavior, graceful degradation, error handling

```bash
# Run all chaos tests
node tests/load/chaos-engineering.js

# Results saved to: tests/results/chaos-engineering-{timestamp}.json
```

**Expected Outcomes**:
```
✓ Network-Latency-100ms Complete
  Success Rate: 99.2%
  Messages Sent: 24500
  Messages Received: 24381

✓ Connection-Drop-10% Complete
  Success Rate: 94.8%
  Recovery successful: true
  Time to recovery: 3.42s
```

---

### 4. Test Orchestrator (`test-orchestrator.js`)

Master controller that runs all tests and generates comprehensive report.

**Phases**:
1. Load Testing Phase (load tests first)
2. Soak Testing Phase (5-minute quick soak)
3. Chaos Engineering Phase (all chaos tests)
4. Report Generation

**Runtime**: 1.5+ hours  
**Output**: 
- Detailed JSON results
- Structured summary report
- Human-readable analysis

```bash
# Run complete test suite
node tests/load/test-orchestrator.js

# Output directory: tests/results/load-testing-{timestamp}/
# Files:
#   - detailed-results.json (all metrics)
#   - summary-report.json (structured summary)
#   - report.txt (human-readable)
```

---

## Understanding Results

### Success Rate

```
Success Rate = (Messages Received / Messages Sent) * 100
```

**Interpretation**:
- **>99%**: Excellent
- **95-99%**: Good
- **85-95%**: Acceptable (optimization recommended)
- **<85%**: Poor (needs work)

### Latency Metrics

**P99 (99th percentile)**: The latency that 99% of messages are faster than

```
P50: 10ms  (50% of messages faster)
P95: 25ms  (95% of messages faster)
P99: 50ms  (99% of messages faster)
```

**Acceptable Ranges**:
- P99 < 50ms: Excellent
- P99 < 100ms: Good
- P99 < 200ms: Acceptable
- P99 > 200ms: Needs optimization

### Memory Growth

**What to Look For**:
- **Stable**: No growth over time = Good
- **Sawtooth pattern**: Growth then drop = Normal GC
- **Linear growth**: Continuous increase = Potential leak

**Example**:
```json
{
  "memory": {
    "initial_mb": 120,
    "final_mb": 145,
    "growth_mb": 25,
    "trend_analysis": {
      "slope": -0.001,
      "leak_detected": false,
      "trend": "stable"
    }
  }
}
```

---

## Common Commands

```bash
# Quick test run (30 minutes)
time node tests/load/comprehensive-load-test.js

# Quick soak test
node tests/load/soak-testing.js --quick

# All chaos tests
node tests/load/chaos-engineering.js

# Full suite with orchestrator
time node tests/load/test-orchestrator.js

# Run in background with output log
nohup node tests/load/test-orchestrator.js > load-test.log 2>&1 &

# Monitor real-time output
tail -f load-test.log

# View latest results
cat tests/results/*/report.txt

# Extract key metrics
cat tests/results/*/summary-report.json | jq '.summary'

# Compare multiple test runs
jq '.summary.overall_success_rate' tests/results/*/summary-report.json
```

---

## Performance Targets

### Load Testing (Sustained)
| Metric | Target | Min Acceptable |
|--------|--------|----------------|
| Success Rate | 99% | 95% |
| Throughput @ 200 conc | 400 msg/s | 300 msg/s |
| P99 Latency | <50ms | <100ms |
| Memory Growth (1h) | <500MB | <1000MB |

### Stress Testing (Peak)
| Metric | Target | Min Acceptable |
|--------|--------|----------------|
| Success Rate @ 500 conc | 90% | 85% |
| Success Rate @ 1000 conc | 80% | 75% |
| Time to Recovery | <10s | <30s |

### Soak Testing (Stability)
| Metric | Target | Status |
|--------|--------|--------|
| Memory Leak | None | Monitor |
| Uptime | 100% | Monitor |
| Drops per hour | 0 | Monitor |

---

## Troubleshooting

### "Connection refused" errors

```bash
# Check if server is running
curl http://localhost:8765/

# If not, start the server
npm start
```

### "Connection timeout" errors

```bash
# Server may be overloaded - reduce concurrent connections
# Edit CONFIG.LOAD_LEVELS in comprehensive-load-test.js
# Or wait and retry
```

### Memory keeps growing

1. Review soak test output for leak detection
2. Check if trend shows linear growth (slope > 1)
3. If leak detected, profile with: `node --inspect tests/load/soak-testing.js`

### Low throughput (<300 msg/s)

1. Check CPU usage (may be saturated)
2. Check if message rate is too high
3. Review P99 latency (may indicate bottleneck)
4. Try reducing concurrent connections

---

## Next Steps

1. **Baseline**: Run full suite once to establish baseline metrics
2. **Monitor**: Run weekly to track performance trends
3. **Optimize**: Address any recommendations from reports
4. **Production**: Run extended soak tests (24-48h) before deploying
5. **Continuous**: Integrate into CI/CD for automated testing

---

## Files Reference

**Test Modules** (2,281 lines total):
- `comprehensive-load-test.js` (593 lines) - Load & stress tests
- `soak-testing.js` (489 lines) - Long-running stability tests
- `chaos-engineering.js` (626 lines) - Resilience tests
- `test-orchestrator.js` (573 lines) - Master controller

**Documentation**:
- `QUICK-START.md` (this file)
- `../handoffs/LOAD-TESTING-REPORT.md` - Comprehensive documentation

**Output Artifacts** (auto-generated):
- `tests/results/load-testing-{timestamp}/detailed-results.json`
- `tests/results/load-testing-{timestamp}/summary-report.json`
- `tests/results/load-testing-{timestamp}/report.txt`

---

## Support

For detailed information:
- See `docs/handoffs/LOAD-TESTING-REPORT.md` for comprehensive documentation
- Check test output logs in `tests/results/`
- Review specific test module code for implementation details

---

**Last Updated**: June 13, 2026  
**Status**: Ready for Testing
