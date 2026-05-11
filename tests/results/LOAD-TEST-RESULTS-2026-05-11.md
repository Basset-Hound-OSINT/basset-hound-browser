# Load Test Results - v12.0.0

**Test Date:** 2026-05-11T05:55:09.133Z
**Status:** COMPLETED

## Summary

- **Concurrent Connections:** 200
- **Successful Connections:** 200
- **Total Messages:** 10000
- **Success Rate:** 100.00%
- **Throughput:** 666.67 msg/sec
- **Avg Latency:** 0.03ms

## Deployment Readiness

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Success Rate | 100.00% | >99% | PASS |
| Avg Latency | 0.03ms | <100ms | PASS |
| Max Latency | 0.84ms | <500ms | PASS |

## Detailed Configuration

```json
{
  "timestamp": "2026-05-11T05:55:09.133Z",
  "configuration": {
    "concurrent": 200,
    "duration": 15000,
    "targetOpsPerConnection": 50
  },
  "aggregated": {
    "totalConnections": 200,
    "successfulConnections": 200,
    "failedConnections": 0,
    "totalMessages": 10000,
    "successfulMessages": 10000,
    "failedMessages": 0,
    "avgLatency": 0.02731021820176393,
    "maxLatency": 0.8407069998793304,
    "minLatency": 0.019770000129938126,
    "memoryBefore": 9374136,
    "memoryAfter": 13819416,
    "totalBytesTransferred": 4102500
  },
  "status": "COMPLETED"
}
```
