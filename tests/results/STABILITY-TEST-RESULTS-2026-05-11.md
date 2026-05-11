# Stability Stress Test Results - v12.0.0

**Test Date:** 2026-05-11T06:13:21.779Z
**Status:** COMPLETED

## Summary

- **Total Duration:** 0.02 hours
- **Total Operations:** 504
- **Avg Ops/Second:** 8.40
- **Error Rate:** 12.10%
- **Status:** WARNING

## Memory Analysis

- **Baseline Heap:** 12MB
- **Final Heap:** 10MB
- **Growth:** -2 MB
- **Growth Rate:** -119.99 MB/hour (Target: < 0.5 MB/hour)
- **Status:** WARNING

## Detailed Metrics

```json
{
  "summary": {
    "totalDuration": "0.02 hours",
    "totalOperations": 504,
    "averageOpsPerSecond": "8.40",
    "errorRate": "12.10%",
    "status": "WARNING"
  },
  "memory": {
    "baseline": {
      "heapUsed": 12,
      "heapTotal": 22,
      "rss": 68
    },
    "final": {
      "heapUsed": 10,
      "heapTotal": 22,
      "rss": 71
    },
    "growth": {
      "absolute": "-2 MB",
      "perHour": "-119.99 MB/hour",
      "target": "< 0.5 MB/hour",
      "status": "WARNING"
    },
    "ranges": {
      "minHeap": "7 MB",
      "maxHeap": "12 MB",
      "avgHeap": "9.17 MB",
      "variance": "5 MB"
    }
  },
  "operations": {
    "totalCount": 504,
    "targetCount": 500,
    "coverage": "100.8%",
    "timing": {
      "average": "58.71 ms",
      "min": "10.46 ms",
      "max": "109.78 ms"
    },
    "types": {
      "screenshot": 156,
      "navigation": 173,
      "extraction": 175
    }
  },
  "errors": {
    "total": 61,
    "rate": "12.10%",
    "details": [
      {
        "operationId": 20,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T06:12:22.538Z"
      },
      {
        "operationId": 29,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T06:12:22.893Z"
      },
      {
        "operationId": 48,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T06:12:23.625Z"
      },
      {
        "operationId": 62,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T06:12:24.077Z"
      },
      {
        "operationId": 81,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T06:12:24.805Z"
      },
      {
        "operationId": 81,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T06:12:24.805Z"
      },
      {
        "operationId": 94,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T06:12:25.286Z"
      },
      {
        "operationId": 98,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T06:12:25.427Z"
      },
      {
        "operationId": 102,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T06:12:25.617Z"
      },
      {
        "operationId": 111,
        "error": "Invalid array length",
        "timestamp": "2026-05-11T06:12:25.969Z"
      }
    ]
  }
}
```
