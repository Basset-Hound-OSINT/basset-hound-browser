# Load Test Results - v12.0.0

**Test Date:** 2026-05-11T06:12:14.581Z
**Status:** COMPLETED

## Summary

- **Concurrent Connections:** 200
- **Successful Connections:** 200
- **Total Messages:** 10000
- **Success Rate:** 100.00%
- **Throughput:** 666.67 msg/sec
- **Avg Latency:** 0.04ms

## Deployment Readiness

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Success Rate | 100.00% | >99% | PASS |
| Avg Latency | 0.04ms | <100ms | PASS |
| Max Latency | 1.56ms | <500ms | PASS |

## Detailed Configuration

```json
{
  "timestamp": "2026-05-11T06:12:14.581Z",
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
    "avgLatency": 0.03914413360310719,
    "maxLatency": 1.564414999447763,
    "minLatency": 0.019550000317394733,
    "memoryBefore": 9407968,
    "memoryAfter": 13437440,
    "totalBytesTransferred": 4102500
  },
  "status": "COMPLETED"
}
```
