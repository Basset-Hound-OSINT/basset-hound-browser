# Test Suite Quick Reference

## New Test Suites Overview

### 1. Resource Edge Cases
**File:** `tests/edge-cases/resource-edge-cases.test.js`  
**Purpose:** Memory, disk, CPU, and file descriptor limits  
**Duration:** ~30-45 minutes  
**Key Tests:**
- Memory leak detection
- Disk space constraints
- CPU intensive operations
- File descriptor exhaustion
- Resource cleanup validation

**Run:**
```bash
node tests/edge-cases/resource-edge-cases.test.js
```

### 2. Network Edge Cases
**File:** `tests/edge-cases/network-edge-cases.test.js`  
**Purpose:** Connection failures, packet loss, latency, partitions  
**Duration:** ~40-60 minutes  
**Key Tests:**
- Connection timeouts
- Packet loss handling
- High latency scenarios
- Network partition recovery
- Message fragmentation

**Run:**
```bash
node tests/edge-cases/network-edge-cases.test.js
```

### 3. Memory Edge Cases
**File:** `tests/edge-cases/memory-edge-cases.test.js`  
**Purpose:** Memory leaks, GC behavior, heap exhaustion  
**Duration:** ~45-60 minutes  
**Key Tests:**
- Multi-cycle leak detection
- Event handler leaks
- GC timing and recovery
- Buffer allocation limits
- Long-running stability

**Run:**
```bash
node tests/edge-cases/memory-edge-cases.test.js
```

### 4. Throughput Testing
**File:** `tests/performance/throughput-testing.test.js`  
**Purpose:** Message rates, batch processing, concurrency  
**Duration:** ~30-45 minutes  
**Key Tests:**
- Basic message rate (10 sec)
- Sustained message rate (30/60/120 sec)
- Batch processing (10-500 messages)
- Concurrent connections (1-20)
- Pipeline efficiency (1-20 sizes)
- Throughput degradation curves

**Run:**
```bash
node tests/performance/throughput-testing.test.js
```

### 5. Latency Testing
**File:** `tests/performance/latency-testing.test.js`  
**Purpose:** Response times, percentiles, distributions  
**Duration:** ~45-60 minutes  
**Key Tests:**
- Average response time
- Response consistency
- P50/P95/P99/P999 percentiles
- Tail latency analysis
- Queue depth effects
- Timeout accuracy

**Run:**
```bash
node tests/performance/latency-testing.test.js
```

### 6. Resource Usage
**File:** `tests/performance/resource-usage.test.js`  
**Purpose:** CPU, memory, handles, connection efficiency  
**Duration:** ~45-60 minutes  
**Key Tests:**
- CPU baseline and under load
- Memory baseline and under load
- File handle usage
- Connection efficiency
- Resource cleanup
- Peak resource identification

**Run:**
```bash
node tests/performance/resource-usage.test.js
```

## Running All New Tests

### Sequential Execution
```bash
# Edge cases (2 hours total)
node tests/edge-cases/resource-edge-cases.test.js
node tests/edge-cases/network-edge-cases.test.js
node tests/edge-cases/memory-edge-cases.test.js

# Performance (2.5 hours total)
node tests/performance/throughput-testing.test.js
node tests/performance/latency-testing.test.js
node tests/performance/resource-usage.test.js
```

### Parallel Execution (with tmux/screen)
```bash
# Terminal 1
node tests/edge-cases/resource-edge-cases.test.js

# Terminal 2
node tests/edge-cases/network-edge-cases.test.js

# Terminal 3
node tests/edge-cases/memory-edge-cases.test.js

# Terminal 4
node tests/performance/throughput-testing.test.js

# Terminal 5
node tests/performance/latency-testing.test.js

# Terminal 6
node tests/performance/resource-usage.test.js
```

## Expected Outputs

All tests produce:
1. **Console Output:** Real-time test progress and results
2. **JSON Report:** Saved to `tests/results/{category}/{test-name}-{timestamp}.json`

### Console Output Example
```
Starting Resource Edge Cases Tests...
✓ Connected to WebSocket at ws://localhost:8765
Testing memory leak detection...
Testing memory stressed operations...
Testing memory recovery...
...

=== Resource Edge Cases Test Results ===
Total Tests: 15
Passed: 14
Failed: 1
Success Rate: 93.33%

Results saved to: tests/results/edge-cases/resource-edge-cases-1686872073000.json
```

### JSON Report Structure
```json
{
  "timestamp": "2026-06-13T18:34:33.173Z",
  "totalTests": 15,
  "passed": 14,
  "failed": 1,
  "memoryExhaustionTests": [
    {
      "test": "memory_leak_detection",
      "memoryIncreaseInMB": 1024,
      "passed": true
    }
  ],
  "resourceMetrics": {
    "memory": {...},
    "uptime": 123.456
  },
  "errors": []
}
```

## Performance Expectations

### Throughput
- Single connection: 8-20 msgs/sec
- 5 connections: 40-100 msgs/sec
- 10 connections: 80-200 msgs/sec
- 20 connections: 160-300+ msgs/sec

### Latency
- Average: 10-100ms
- P50: 5-50ms
- P99: 100-1000ms
- P999: 200-2000ms

### Memory
- Per connection: 100-500KB
- Per operation: <100KB
- Growth rate: <10MB/minute

### CPU
- Idle: <1ms per command
- Under load: 1-10ms per command

## Troubleshooting

### Test fails to connect
```
Error: Failed to connect to ws://localhost:8765
```
**Solution:** Ensure WebSocket server is running on port 8765
```bash
# Check if server is running
lsof -i :8765
```

### Test times out
**Solutions:**
1. Increase system resources (memory, CPU)
2. Close background processes
3. Check network connectivity
4. Increase timeout values in test files

### Memory test failures
**Note:** Memory tests are sensitive to GC behavior and system load.  
**Expected:** 80%+ pass rate is acceptable.

### Latency test failures
**Note:** Latency tests depend on system load and network conditions.  
**Solution:** Run tests during low-load periods for consistent results.

## Test Result Analysis

### Check latest test results
```bash
# List recent test results
ls -lt tests/results/edge-cases/ | head -5
ls -lt tests/results/performance/ | head -5

# View specific test result
cat tests/results/edge-cases/resource-edge-cases-1686872073000.json | jq .
```

### Comparing results over time
```bash
# Extract throughput metrics
grep "throughputMsgsPerSec" tests/results/performance/throughput-*.json

# Extract latency percentiles
grep "p99Ms\|p999Ms" tests/results/performance/latency-*.json
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm start &  # Start WebSocket server
      - run: sleep 5     # Wait for server
      - run: node tests/edge-cases/resource-edge-cases.test.js
      - run: node tests/edge-cases/network-edge-cases.test.js
      - run: node tests/edge-cases/memory-edge-cases.test.js
      - run: node tests/performance/throughput-testing.test.js
      - run: node tests/performance/latency-testing.test.js
      - run: node tests/performance/resource-usage.test.js
```

## Test Execution Time Estimates

| Test Suite | Duration | Notes |
|-----------|----------|-------|
| Resource Edge Cases | 30-45 min | Memory tests slower |
| Network Edge Cases | 40-60 min | Network dependent |
| Memory Edge Cases | 45-60 min | GC dependent |
| Throughput Testing | 30-45 min | Depends on load |
| Latency Testing | 45-60 min | Percentile collection |
| Resource Usage | 45-60 min | System monitoring |
| **Total** | **3-4 hours** | Sequential |

## Key Files

### Test Files
- `tests/edge-cases/resource-edge-cases.test.js`
- `tests/edge-cases/network-edge-cases.test.js`
- `tests/edge-cases/memory-edge-cases.test.js`
- `tests/performance/throughput-testing.test.js`
- `tests/performance/latency-testing.test.js`
- `tests/performance/resource-usage.test.js`

### Result Directories
- `tests/results/edge-cases/`
- `tests/results/performance/`

### Documentation
- `docs/findings/TESTING-EXPANSION-COMPLETE.md` (full report)
- `docs/findings/TEST-SUITE-QUICK-REFERENCE.md` (this file)

## Support

For questions or issues:
1. Check the full report: `docs/findings/TESTING-EXPANSION-COMPLETE.md`
2. Review test source code for implementation details
3. Check JSON results for specific failure information

---

**Last Updated:** June 13, 2026  
**Status:** Production Ready
