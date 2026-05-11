# Stability Stress Test Results - v12.0.0

**Test Date:** 2026-05-11T05:51:40.729Z
**Status:** COMPLETED

## Summary

- **Total Duration:** 0.02 hours
- **Total Operations:** 504
- **Avg Ops/Second:** 8.40
- **Error Rate:** 8.13%
- **Status:** WARNING

## Memory Analysis

- **Baseline Heap:** 6MB
- **Final Heap:** 9MB
- **Growth:** 3 MB
- **Growth Rate:** 179.98 MB/hour (Target: < 0.5 MB/hour)
- **Status:** WARNING

## Detailed Metrics

```json
{
  "summary": {
    "totalDuration": "0.02 hours",
    "totalOperations": 504,
    "averageOpsPerSecond": "8.40",
    "errorRate": "8.13%",
    "status": "WARNING"
  },
  "memory": {
    "baseline": {
      "heapUsed": 6,
      "heapTotal": 23,
      "rss": 68
    },
    "final": {
      "heapUsed": 9,
      "heapTotal": 23,
      "rss": 68
    },
    "growth": {
      "absolute": "3 MB",
      "perHour": "179.98 MB/hour",
      "target": "< 0.5 MB/hour",
      "status": "WARNING"
    },
    "ranges": {
      "minHeap": "5 MB",
      "maxHeap": "9 MB",
      "avgHeap": "7.67 MB",
      "variance": "4 MB"
    }
  },
  "operations": {
    "totalCount": 504,
    "targetCount": 500,
    "coverage": "100.8%",
    "timing": {
      "average": "58.24 ms",
      "min": "10.26 ms",
      "max": "109.66 ms"
    },
    "types": {
      "screenshot": 167,
      "extraction": 156,
      "navigation": 181
    }
  },
  "errors": {
    "total": 41,
    "rate": "8.13%",
    "details": [
      {
        "operationId": 5,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T05:50:40.833Z"
      },
      {
        "operationId": 14,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T05:50:41.216Z"
      },
      {
        "operationId": 68,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T05:50:43.271Z"
      },
      {
        "operationId": 72,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T05:50:43.473Z"
      },
      {
        "operationId": 72,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T05:50:43.473Z"
      },
      {
        "operationId": 90,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T05:50:44.247Z"
      },
      {
        "operationId": 94,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T05:50:44.394Z"
      },
      {
        "operationId": 108,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T05:50:44.892Z"
      },
      {
        "operationId": 127,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T05:50:45.603Z"
      },
      {
        "operationId": 127,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T05:50:45.603Z"
      }
    ]
  }
}
```
