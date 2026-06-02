# Long-Running Stability Testing - Quick Start Guide

## Overview
Comprehensive stability validation framework for Basset Hound Browser v12.0.0+. Tests 24+ hour continuous operation, load handling, and failure recovery.

## Quick Links
- **Framework Documentation:** [`docs/findings/STABILITY-VALIDATION-FRAMEWORK.md`](docs/findings/STABILITY-VALIDATION-FRAMEWORK.md)
- **Completion Report:** [`docs/findings/LONG-RUNNING-STABILITY-COMPLETE.txt`](docs/findings/LONG-RUNNING-STABILITY-COMPLETE.txt)
- **Test Directory:** [`tests/stability/`](tests/stability/)

## Test Files (2,678 Lines Total)
```
tests/stability/
├── quick-validation.js           (478 lines) - 30-minute expedited test
├── 24-hour-session.test.js      (432 lines) - 24-hour continuous
├── load-profile.test.js         (427 lines) - Realistic load patterns
├── failure-injection.test.js    (672 lines) - Network/resource failures
├── metrics-tracker.js           (361 lines) - Metrics aggregation
└── run-validation.js            (308 lines) - Test orchestration
```

## Quick Start

### 1. Quick Validation (30 minutes) - START HERE
```bash
cd tests/stability
node quick-validation.js
```
**Purpose:** Verify framework works before longer tests  
**Output:** `/tests/results/quick-validation-[timestamp].json`  
**Expected:** Memory stable, >95% success rate, P99 <10ms  

### 2. Load Profile Test (2 hours)
```bash
cd tests/stability
node load-profile.test.js
```
**Purpose:** Validate peak load (300 concurrent)  
**Output:** `/tests/results/load-profile-[timestamp].json`  
**Phases:** Night (10), Morning (300), Afternoon (150), Evening (50)  

### 3. Failure Injection (2 hours)
```bash
cd tests/stability
node failure-injection.test.js
```
**Purpose:** Verify 100% recovery from failures  
**Output:** `/tests/results/failure-injection-[timestamp].json`  
**Scenarios:** Network, resource, cascading failures  

### 4. Full 24-Hour Test (Production Requirement)
```bash
cd tests/stability
timeout 86400 node 24-hour-session.test.js
```
**Purpose:** Production-ready validation  
**Output:** `/tests/results/24-hour-session-[timestamp].json`  
**Target:** <2 MB/hour growth, >99.9% success  

## Success Criteria

| Metric | Target | Method |
|--------|--------|--------|
| Memory Growth | <2 MB/h | Continuous tracking |
| P99 Latency | <2ms | Per-operation measurement |
| Success Rate | >99.9% | Message counting |
| Uptime | >99.5% | Connection monitoring |
| Recovery | 100% | Failure injection |

## Key Metrics Tracked

### Memory
- Current heap usage
- Growth rate (MB/hour)
- Snapshot analysis (4-hour intervals)
- Leak detection (>5 MB/h = FAIL)

### Performance
- Operation latency (P50, P99, P999)
- Latency trends over time
- Per-phase performance impact
- Degradation detection

### Reliability
- Success/failure counts
- Error categorization
- Recovery time measurement
- Uptime percentage

### Connections
- Connection lifecycle
- Leak detection
- State transitions
- Cleanup validation

## Expected Output
```json
{
  "report": {
    "testName": "Quick Validation",
    "totalMessages": 1234,
    "successRate": "99.85",
    "memory": {
      "growthMBPerHour": "0.45"
    },
    "latency": {
      "p99Ms": "1.87"
    }
  },
  "criteria": {
    "memoryStable": true,
    "latencyStable": true,
    "overallPass": true
  }
}
```

## Troubleshooting

### Server Not Running
```bash
# Error: ECONNREFUSED 127.0.0.1:8765
# Fix: Start WebSocket server
node websocket/server.js &
```

### Test Timeout
```bash
# Increase timeout (example: 2 hours)
timeout 7200 node quick-validation.js
```

### Memory Issues
```bash
# Enable GC logging
node --expose-gc --trace-gc tests/stability/quick-validation.js
```

## Real-Time Output
Tests print progress every 60 seconds:
```
[METRIC] 0.02h - Heap: 45.23MB, Growth: 0.12MB, Success: 100%, Errors: 0
[METRIC] 0.04h - Heap: 45.45MB, Growth: 0.34MB, Success: 99.8%, Errors: 0
[PHASE: Morning Peak] Concurrency: 300, Messages: 5430, Success: 5410
```

## CI/CD Integration
```bash
# Quick validation in CI
npm run test:stability

# Pre-deployment check
npm run test:stability:load

# Full production validation
timeout 86400 npm run test:stability:24h
```

## Monitoring During Tests
- Memory consumption (top/htop)
- Network traffic (netstat/ss)
- CPU usage (vmstat/iostat)
- Log files in test results directory

## Production Deployment Gate
✅ All tests must PASS  
✅ All criteria must be MET  
✅ All results must be DOCUMENTED  
✅ Team approval required  

## Documentation
- **Full Framework Details:** `docs/findings/STABILITY-VALIDATION-FRAMEWORK.md`
- **Execution Report:** `docs/findings/LONG-RUNNING-STABILITY-COMPLETE.txt`
- **Test Source Code:** `tests/stability/*.js`

## Results Directory
```
/tests/results/
├── quick-validation-[timestamp].json
├── load-profile-[timestamp].json
├── failure-injection-[timestamp].json
├── 24-hour-session-[timestamp].json
└── stability-[timestamp]/
    └── STABILITY-VALIDATION-REPORT.json
```

## Next Steps
1. Run quick validation test (verify setup)
2. Review results and metrics
3. Schedule load profile test
4. Plan 24-hour test window
5. Deploy to production once ALL tests PASS

---

**Status:** ✅ Framework Ready for Execution  
**Last Updated:** June 1, 2026  
**Version:** 1.0.0
