# Basset Hound Browser - Command Reliability SLA (v12.9.0)

## Service Level Agreement (SLA)

**Target:** Core commands maintain **99%+ reliability**

### Core Commands Covered by SLA
- `navigateTo` - Page navigation
- `click` - Element clicking
- `fill` - Form field input
- `screenshot` - Page/element screenshot capture
- `get_url` - Current URL retrieval
- `get_content` - Page content extraction

### SLA Metrics
- **Success Rate:** ≥ 99.0% (target), currently tracked and monitored
- **Command Timeout:** 30 seconds maximum per command
- **Retry Mechanism:** Up to 3 automatic retries on transient failures
- **Availability Window:** Calculated over rolling 24-hour periods

## Architecture

### Components

#### 1. ReliabilityManager (`websocket/reliability-manager.js`)
Core reliability engine providing:
- **Automatic Retry Logic:** Up to 3 attempts with exponential backoff (1s, 2s, 4s)
- **Error Classification:** Distinguishes transient vs permanent failures
- **Per-Command Metrics:** Tracks success, failures, latency per command
- **Timeout Guarantees:** All commands complete within 30 seconds or timeout
- **Statistical Analysis:** P50/P95/P99 latency percentiles

#### 2. HealthEndpointManager (Enhanced)
Provides health checking and SLA reporting:
- `/health` - Overall health status with SLA compliance
- `/health/reliability` - Detailed reliability metrics
- `/health/metrics` - Top commands and raw metrics
- `/health/recent` - Recent request history for debugging

#### 3. Integration Layer (`websocket/reliability-integration.js`)
Shows how to integrate reliability management with WebSocket server:
- Wraps all command executions with reliability guarantees
- Manages retry logic transparently
- Provides metrics to health endpoint
- Configurable timeouts and retry attempts

## Retry Logic

### Transient Errors (Automatically Retried)
```
ETIMEDOUT, ECONNRESET, ECONNREFUSED, EPIPE, ENOTFOUND,
ENETUNREACH, EAI_AGAIN, TIMEOUT, EADDRINUSE, EHOSTUNREACH
```

**Backoff Strategy:** Exponential backoff
- Attempt 1: Immediate execution
- Attempt 2: 1 second delay
- Attempt 3: 2 second delay
- Attempt 4: 4 second delay
- (Max 3 retries = 4 total attempts)

### Permanent Errors (NOT Retried)
```
INVALID_PARAMETERS, AUTH_FAILED, UNAUTHORIZED, FORBIDDEN,
NOT_FOUND, BAD_REQUEST, Unknown command
```

These fail immediately without retry to avoid resource waste.

## Timeout Guarantees

All commands have a **30-second hard timeout**:
- Request starts, sets 30-second timer
- If timer fires before completion, request fails with TIMEOUT
- Timeout counts as transient failure (can be retried)
- After 3 retries with timeouts, command fails permanently

## Metrics Tracking

### Per-Command Metrics
Each command tracks:
```javascript
{
  command: "navigateTo",
  reliability: "99.2%",        // Success rate
  successCount: 496,            // Successful executions
  failureCount: 4,              // Failed executions
  totalAttempts: 500,           // Total attempts (including retries)
  avgLatency: "120ms",          // Average execution time
  minLatency: "45ms",           // Fastest execution
  maxLatency: "29950ms",        // Slowest execution
  p50Latency: "100ms",          // Median latency
  p95Latency: "250ms",          // 95th percentile
  p99Latency: "1200ms",         // 99th percentile
  retries: 8,                   // Total retry attempts
  timeouts: 1,                  // Total timeout failures
  samples: 100                  // Recent samples for percentiles
}
```

### Global Statistics
```javascript
{
  totalRequests: 5000,          // Total command executions
  successfulRequests: 4960,     // Successful completions
  failedRequests: 40,           // Failed completions
  successRate: "99.20%",        // Overall success rate
  transientRetries: 48,         // Transient errors retried
  timeoutFailures: 3,           // Commands that timed out
  commandCount: 164,            // Unique commands executed
  recentRequestsCount: 5000     // Recent request history
}
```

## Health Endpoint Examples

### Basic Health Check
```bash
curl http://localhost:8765/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "12.9.0",
  "sla": {
    "target": "99%+",
    "current": "99.20%",
    "compliant": true
  },
  "reliability": {
    "globalStats": {
      "totalRequests": 5000,
      "successfulRequests": 4960,
      "successRate": "99.20%",
      "transientRetries": 48,
      "timeoutFailures": 3
    },
    "commands": {
      "navigateTo": {
        "reliability": "99.2%",
        "avgLatency": "120ms",
        "p99Latency": "500ms",
        "successCount": 496,
        "failureCount": 4
      },
      "click": {
        "reliability": "98.8%",
        "avgLatency": "45ms",
        "p99Latency": "150ms",
        "successCount": 493,
        "failureCount": 7
      },
      "screenshot": {
        "reliability": "99.5%",
        "avgLatency": "850ms",
        "p99Latency": "1500ms",
        "successCount": 498,
        "failureCount": 2
      }
    }
  },
  "timestamp": "2026-06-21T16:45:30.123Z"
}
```

### Reliability-Focused Health Check
```bash
curl http://localhost:8765/health/reliability
```

**Response:**
```json
{
  "status": "healthy",
  "version": "12.9.0",
  "sla": {
    "target": "99%+",
    "current": "99.20%",
    "compliant": true,
    "warning": null
  },
  "commands": {
    "navigateTo": {
      "reliability": "99.2%",
      "avgLatency": "120ms",
      "p99Latency": "500ms",
      "successCount": 496,
      "failureCount": 4
    },
    "click": {
      "reliability": "98.8%",
      "avgLatency": "45ms",
      "p99Latency": "150ms",
      "successCount": 493,
      "failureCount": 7
    },
    "fill": {
      "reliability": "99.3%",
      "avgLatency": "35ms",
      "p99Latency": "100ms",
      "successCount": 497,
      "failureCount": 3
    },
    "screenshot": {
      "reliability": "99.5%",
      "avgLatency": "850ms",
      "p99Latency": "1500ms",
      "successCount": 498,
      "failureCount": 2
    },
    "get_url": {
      "reliability": "99.6%",
      "avgLatency": "10ms",
      "p99Latency": "25ms",
      "successCount": 498,
      "failureCount": 1
    },
    "get_content": {
      "reliability": "99.4%",
      "avgLatency": "200ms",
      "p99Latency": "800ms",
      "successCount": 497,
      "failureCount": 2
    }
  },
  "topCommands": [
    {
      "command": "screenshot",
      "attempts": 500,
      "success": 498,
      "reliability": "99.60%",
      "avgLatency": "850ms"
    },
    {
      "command": "navigateTo",
      "attempts": 500,
      "success": 496,
      "reliability": "99.20%",
      "avgLatency": "120ms"
    },
    {
      "command": "click",
      "attempts": 500,
      "success": 493,
      "reliability": "98.60%",
      "avgLatency": "45ms"
    }
  ],
  "globalStats": {
    "totalRequests": 5000,
    "successfulRequests": 4960,
    "failedRequests": 40,
    "successRate": "99.20%",
    "transientRetries": 48,
    "timeoutFailures": 3,
    "commandCount": 164,
    "recentRequestsCount": 5000
  },
  "timestamp": "2026-06-21T16:45:35.456Z"
}
```

### Detailed Metrics
```bash
curl http://localhost:8765/health/metrics
```

Returns top 20 commands and detailed metrics for all executed commands.

### Recent Requests (Debugging)
```bash
curl "http://localhost:8765/health/recent?limit=100"
```

Returns the last 100 request executions with timing and success info.

## Integration with WebSocket Server

### Basic Integration

```javascript
const { createReliabilityManager } = require('./websocket/reliability-integration');
const { defaultLogger } = require('./logging');

// Create reliability infrastructure
const { reliabilityManager, healthEndpoint, setupExpressRoutes } = 
  createReliabilityManager({
    logger: defaultLogger,
    version: '12.9.0',
    commandTimeout: 30000,
    maxRetries: 3
  });

// Setup Express routes for health endpoints
const app = require('express')();
setupExpressRoutes(app);

// Wrap all command executions
const commandHandlers = {
  navigateTo: async (params, context) => {
    const result = await reliabilityManager.execute('navigateTo', async () => {
      // Your actual command logic here
      return await browser.navigateTo(params.url);
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return {
      success: true,
      data: result.result,
      metadata: {
        attempts: result.attempts,
        latency: result.latency,
        retried: result.retried
      }
    };
  }
};
```

### Custom Timeout per Command

```javascript
const result = await reliabilityManager.execute(
  'slowCommand',
  async () => {
    // Long-running operation
  },
  { timeout: 60000 } // 60 second timeout for this command
);
```

## Monitoring

### Key Metrics to Monitor

1. **Overall Success Rate** - Should be ≥99.0%
   - Target: 99%+ (SLA requirement)
   - Alert if: <98.5% (entering yellow zone)

2. **Per-Command Reliability** - Individual command health
   - Target: 99%+ per core command
   - Alert if: Any core command <98%

3. **Timeout Failures** - Commands exceeding time limit
   - Target: <1% of total requests
   - Alert if: >2% timeout rate

4. **Transient Retries** - Network/transient issues
   - Target: <2% retry rate
   - Alert if: >5% retry rate

5. **Latency Percentiles**
   - P95: Should be <500ms for quick commands
   - P99: Should be <2000ms for most commands
   - Alert if: P99 >5000ms

### Prometheus Metrics (Future)

These metrics should be exposed as Prometheus metrics:
```
basset_hound_reliability_success_rate{command="navigateTo"}
basset_hound_reliability_command_latency_ms{command="navigateTo", percentile="p99"}
basset_hound_reliability_retry_count{type="transient"}
basset_hound_reliability_timeout_count
```

## SLA Compliance Algorithm

```javascript
function isSLACompliant(metrics) {
  // Requires minimum sample size for validity
  if (metrics.totalRequests < 100) {
    return null; // Not enough data
  }

  const successRate = parseFloat(metrics.successRate);
  return successRate >= 99.0; // 99% or better
}
```

## Failure Scenarios & Recovery

### Scenario 1: Temporary Network Blip
```
Request 1: ECONNRESET → Retry after 1s
Request 2: ECONNRESET → Retry after 2s  
Request 3: Success → Return result (3 total attempts)
```

### Scenario 2: Slow Operation
```
Request 1: In progress, approaching 30s timeout
Request 2: Timeout at 30s mark → Retry after 1s
Request 3: In progress, approaching 30s timeout
Request 4: Timeout at 30s mark → Retry after 2s
Request 5: Success → Return result (5 total attempts)
```

### Scenario 3: Permanent Failure
```
Request 1: INVALID_PARAMETERS error
→ Fail immediately (no retry)
→ Return error to client
```

## Performance Expectations

### Typical Command Latencies
| Command | P50 | P95 | P99 |
|---------|-----|-----|-----|
| navigateTo | 80ms | 300ms | 500ms |
| click | 20ms | 80ms | 150ms |
| fill | 15ms | 50ms | 100ms |
| screenshot | 500ms | 1500ms | 2500ms |
| get_url | 5ms | 15ms | 25ms |
| get_content | 100ms | 500ms | 800ms |

## Configuration

### Default Configuration
```javascript
{
  maxRetries: 3,              // Max retry attempts
  commandTimeout: 30000,      // 30 second timeout
  metricsWindow: 10000,       // 10 second metrics window
  maxRecentRequests: 5000     // Keep last 5000 requests
}
```

### Tuning Recommendations

**For High-Reliability Needs:**
```javascript
{
  maxRetries: 5,              // More retry attempts
  commandTimeout: 60000       // Longer timeout for slow operations
}
```

**For Low-Latency Needs:**
```javascript
{
  maxRetries: 2,              // Fewer retries
  commandTimeout: 15000       // Shorter timeout
}
```

## Files

- `websocket/reliability-manager.js` - Core reliability engine
- `websocket/health-endpoint.js` - Enhanced health checking
- `websocket/reliability-integration.js` - Integration layer and examples
- `websocket/RELIABILITY-SLA.md` - This document

## Version History

### v12.9.0 (Current)
- Initial reliability SLA implementation
- 99%+ success rate guarantee for core commands
- Automatic retry with exponential backoff
- Per-command metrics tracking
- Health endpoints for monitoring
- Integration layer for WebSocket server

## References

- [Command Dispatcher](command-dispatcher.js) - Base command execution
- [Error Recovery](error-recovery.js) - Error classification
- [Health Endpoint](health-endpoint.js) - Health check handlers
