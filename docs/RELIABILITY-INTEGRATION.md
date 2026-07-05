# Basset Hound Browser - Reliability Manager Integration Guide

## Overview

The Basset Hound Browser v12.9.0 includes integrated reliability management with automatic retries, SLA tracking, and comprehensive health monitoring. This guide explains how the system works and how to use it.

## Architecture

### Components

1. **ReliabilityManager** (`/websocket/reliability-manager.js`)
   - Automatic retry logic with exponential backoff
   - Per-command metrics tracking
   - Transient vs permanent error classification
   - SLA compliance verification

2. **HealthEndpointManager** (`/websocket/health-endpoint.js`)
   - HTTP health endpoints (`/health`, `/health/live`, `/health/ready`, etc.)
   - WebSocket health commands
   - Component health checks
   - Integration with ReliabilityManager metrics

3. **WebSocketServer Integration** (`/websocket/server.js`)
   - Initialization of both managers
   - Wrapping of command execution with reliability logic
   - Recording of metrics for each command
   - WebSocket health command handlers

## How It Works

### Command Execution Flow

```
Client Request
  ↓
[Rate Limiting Check]
  ↓
[Authentication Check]
  ↓
[ReliabilityManager.execute()]
  ├→ Execute Command via CommandDispatcher
  ├→ Monitor for Transient Errors
  ├→ Automatic Retry (max 3 times)
  ├→ Timeout Protection (30-120 seconds)
  └→ Record Metrics
  ↓
[HealthEndpoint.recordCommand()]
  ├→ Update per-command stats
  ├→ Calculate latency percentiles
  └→ Update global SLA metrics
  ↓
Client Response (includes reliability context)
```

### Retry Logic

Commands are automatically retried **only when**:

1. **Error is Transient** (temporary, recoverable)
   - Network timeouts
   - Connection resets
   - DNS failures
   - Command execution timeouts

2. **Command is Retryable** (idempotent/read-only)
   - All `get_*` operations
   - All `list_*` operations
   - Status/health queries
   - Screenshot commands

**Permanent errors are never retried**:
- Invalid parameters
- Authentication failures
- Authorization failures
- Unknown commands

### Backoff Strategy

```
Attempt 1: Immediate
Attempt 2: 1000ms delay
Attempt 3: 2000ms delay
Attempt 4: 4000ms delay (max retries reached)

Formula: delay = 1000 * (2 ^ attempt_number)
```

### Timeout Guarantees

```
Base Timeout:        30 seconds (30,000ms)
Large Response:      45 seconds (45,000ms)
Very Large (20MB+):  120 seconds (120,000ms)
```

Adaptive timeout calculation:
- Large HTML documents (>5MB) get 45 seconds
- Very large documents (>20MB) get maximum 120 seconds
- Most commands use standard 30 seconds

## Integration Points

### Server Initialization

In `WebSocketServer.constructor()`:

```javascript
// v12.9.0: Initialize Reliability Manager
this.reliabilityManager = new ReliabilityManager({
  maxRetries: 3,
  commandTimeout: 30000,
  metricsWindow: 10000,
  maxRecentRequests: 5000,
  logger: this.logger
});

// v12.9.0: Initialize Health Endpoint Manager
this.healthEndpoint = new HealthEndpointManager({
  reliabilityManager: this.reliabilityManager,
  maxSamples: 1000,
  version: '12.9.0',
  logger: this.logger
});

// Register health checks
this.healthEndpoint.registerCheck('websocket', async () => ({
  ok: this.wss && this.wss.clients.size >= 0,
  message: `${this.wss ? this.wss.clients.size : 0} connected clients`
}));
```

### HTTP Server Setup

Health endpoints are automatically attached to both HTTP and HTTPS servers:

```javascript
// Non-SSL server
const server = http.createServer();
server.on('request', this.healthEndpoint.createHttpHandler());

// SSL server
this.httpsServer = https.createServer(sslOptions);
this.httpsServer.on('request', this.healthEndpoint.createHttpHandler());
```

### Command Execution Wrapping

In message handler (`ws.on('message')`):

```javascript
const reliabilityResult = await this.reliabilityManager.execute(
  command,
  async () => {
    return await this.commandDispatcher.execute(command, params, {
      // ... dispatcher options
    });
  },
  {
    timeout: calculateAdaptiveTimeout(command)
  }
);

// Handle result
if (reliabilityResult.success) {
  response = reliabilityResult.result;
  this.healthEndpoint.recordCommand(command, reliabilityResult.latency, false);
} else {
  this.healthEndpoint.recordCommand(command, reliabilityResult.latency, true);
  response = {
    success: false,
    error: reliabilityResult.error,
    attempts: reliabilityResult.attempts,
    latency: reliabilityResult.latency,
    retried: reliabilityResult.retried,
    timedOut: reliabilityResult.timedOut
  };
}
```

### WebSocket Command Handlers

```javascript
// Full health status
this.commandHandlers.getHealth = async (params) => {
  const healthStatus = await this.healthEndpoint.getFullHealthStatus();
  return { success: true, ...healthStatus };
};

// SLA-focused health
this.commandHandlers.getHealthStatus = async (params) => {
  const reliabilityStatus = await this.healthEndpoint.getReliabilityStatus();
  return { success: true, ...reliabilityStatus };
};
```

## Usage Examples

### 1. HTTP Health Endpoint (Monitoring)

```bash
# Full health status
curl http://localhost:8765/health | jq '.sla'

# Output:
# {
#   "target": "99%+",
#   "current": "99.23%",
#   "compliant": true
# }

# Liveness probe (for Kubernetes)
curl http://localhost:8765/health/live

# Readiness probe
curl http://localhost:8765/health/ready

# Detailed metrics
curl http://localhost:8765/health/metrics | jq '.topCommands'

# SLA-focused status
curl http://localhost:8765/health/reliability | jq '.commands'
```

### 2. WebSocket Health Commands

```javascript
// Full health status via WebSocket
ws.send(JSON.stringify({
  command: 'getHealth',
  id: 'req-123'
}));

// Response:
// {
//   "id": "req-123",
//   "command": "getHealth",
//   "success": true,
//   "status": "healthy",
//   "version": "12.9.0",
//   "sla": {
//     "target": "99%+",
//     "current": "99.23%",
//     "compliant": true
//   },
//   "reliability": {
//     "globalStats": {...},
//     "commands": {...},
//     "topCommands": [...]
//   }
// }

// SLA-focused health
ws.send(JSON.stringify({
  command: 'getHealthStatus',
  id: 'req-124'
}));
```

### 3. Monitoring Command Reliability

```javascript
// Monitor specific command reliability
const response = await fetch('http://localhost:8765/health/metrics');
const metrics = await response.json();

// Check if core commands meet SLA
const navigateReliability = parseFloat(metrics.topCommands.navigateTo.reliability);
if (navigateReliability >= 99.0) {
  console.log('navigateTo meets SLA');
} else {
  console.warn(`navigateTo below SLA: ${navigateReliability}%`);
}
```

### 4. Kubernetes Deployment

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: basset-hound-browser
spec:
  containers:
  - name: browser
    image: basset-hound:12.9.0
    ports:
    - containerPort: 8765
      name: websocket
    
    # Liveness probe - restarts unhealthy pod
    livenessProbe:
      httpGet:
        path: /health/live
        port: 8765
      initialDelaySeconds: 5
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3
    
    # Readiness probe - removes from load balancer
    readinessProbe:
      httpGet:
        path: /health/ready
        port: 8765
      initialDelaySeconds: 10
      periodSeconds: 5
      timeoutSeconds: 3
      failureThreshold: 2
    
    # Resource requests/limits
    resources:
      requests:
        memory: "256Mi"
        cpu: "100m"
      limits:
        memory: "1Gi"
        cpu: "500m"
```

### 5. External Monitoring (Prometheus-style)

```javascript
// Poll every 30 seconds for SLA compliance
setInterval(async () => {
  const response = await fetch('http://localhost:8765/health/reliability');
  const health = await response.json();
  
  const slaCompliant = health.sla.compliant;
  const currentRate = parseFloat(health.sla.current);
  
  // Send to monitoring system
  prometheus.gauge('basset_hound_sla_compliant', slaCompliant ? 1 : 0);
  prometheus.gauge('basset_hound_reliability_percent', currentRate);
  
  // Per-command metrics
  for (const [cmd, metrics] of Object.entries(health.commands)) {
    const reliability = parseFloat(metrics.reliability);
    prometheus.gauge('basset_hound_command_reliability', reliability, { command: cmd });
  }
}, 30000);
```

### 6. Client-Side Error Handling

```javascript
async function executeCommandWithFallback(command, params) {
  try {
    const response = await ws.send(command, params);
    
    if (response.success) {
      return response;
    }
    
    // Check if server retried already
    if (response.retried) {
      // Server already tried automatic retries, don't retry again
      throw new Error(`${command} failed after server retries: ${response.error}`);
    }
    
    // If not retried and retryable, implement client-side retry
    if (isClientRetryable(command)) {
      return executeCommandWithFallback(command, params); // Client retry
    }
    
    throw new Error(`${command} failed: ${response.error}`);
  } catch (error) {
    // Final failure - log and handle
    console.error('Command failed:', error);
    
    // Check server health
    const health = await fetch('http://localhost:8765/health/reliability');
    if (!health.ok) {
      console.error('Server health degraded:', await health.json());
    }
    
    throw error;
  }
}
```

## Metrics Collection

### Per-Command Metrics

Each command automatically tracks:

```json
{
  "navigateTo": {
    "reliability": "99.2%",
    "successCount": 496,
    "failureCount": 4,
    "totalAttempts": 500,
    "avgLatency": "120ms",
    "minLatency": "45ms",
    "maxLatency": "1250ms",
    "p50Latency": "95ms",
    "p95Latency": "450ms",
    "p99Latency": "1100ms",
    "retries": 8,
    "timeouts": 2
  }
}
```

### Global Metrics

```json
{
  "totalRequests": 5000,
  "successfulRequests": 4950,
  "failedRequests": 50,
  "successRate": "99.00%",
  "transientRetries": 127,
  "timeoutFailures": 8,
  "commandCount": 142
}
```

### Metrics Lifecycle

- **Collection**: Real-time during command execution
- **Storage**: In-memory, last 5000 requests kept
- **Retention**: For server lifetime (or 24 hours max)
- **Reset**: Manual via metrics reset or server restart
- **Percentiles**: Calculated from last 100 samples per command

## Configuration

### Reliability Manager Options

```javascript
new ReliabilityManager({
  maxRetries: 3,                  // Max retry attempts
  commandTimeout: 30000,          // Default timeout (30s)
  metricsWindow: 10000,           // Time window for windowed metrics
  maxRecentRequests: 5000,        // Keep last N requests in memory
  logger: this.logger             // Logger instance
})
```

### Health Endpoint Options

```javascript
new HealthEndpointManager({
  reliabilityManager: rm,         // Linked ReliabilityManager
  maxSamples: 1000,               // Latency samples to keep
  version: '12.9.0',              // Version string
  logger: this.logger             // Logger instance
})
```

## Troubleshooting

### Commands Below 99% SLA

```bash
# Check which commands are failing
curl http://localhost:8765/health/metrics | jq '.topCommands[] | select(.reliability < 99)'

# Get recent failed requests
curl http://localhost:8765/health/metrics | jq '.recentFailedRequests'
```

### Timeout Issues

If commands are timing out:

1. Check server load: `curl http://localhost:8765/health | jq '.metrics.cpu'`
2. Check memory usage: `curl http://localhost:8765/health | jq '.metrics.memory'`
3. Increase adaptive timeout for large responses
4. Check network latency

### Metrics Memory Usage

Metrics are kept in memory and should use ~1-2MB for typical operations:

```javascript
// Check memory impact
const metrics = reliabilityManager.getGlobalStats();
console.log(`Tracking ${metrics.totalRequests} requests`);
console.log(`Per-command metrics: ${metrics.commandCount} commands`);
```

## Best Practices

1. **Monitor Health Endpoints**
   - Poll `/health/reliability` every 30 seconds
   - Alert when SLA compliance drops below 99%
   - Track per-command reliability trends

2. **Configure Kubernetes Probes**
   - Use `/health/live` for liveness
   - Use `/health/ready` for readiness
   - Set appropriate timeouts and thresholds

3. **Handle Retried Errors**
   - Don't retry commands that already have `retried: true`
   - Check `timedOut` flag for timeout-specific handling
   - Use `attempts` count for logging and analytics

4. **Monitor Transient Retries**
   - Track `transientRetries` metric over time
   - High retry rates may indicate network issues
   - Alert if retry rate exceeds 10% of requests

5. **Use Appropriate Timeouts**
   - Adaptive timeout handles most cases automatically
   - Large document extraction uses 45+ seconds
   - Configure `commandTimeout` based on your use case

## Performance Impact

- **Latency Overhead**: <1ms per command
- **Memory Overhead**: ~1-2MB for metrics
- **CPU Overhead**: <1% for collection and percentile calculation

## Future Enhancements

- [ ] Prometheus metrics endpoint
- [ ] Custom SLA thresholds per command
- [ ] Automatic alerting on SLA breaches
- [ ] Metrics historical storage
- [ ] Circuit breaker pattern integration
- [ ] Distributed tracing support

---

**Version**: 12.9.0  
**Last Updated**: June 21, 2026  
**Status**: Production Ready
