# Basset Hound Browser - Metrics Definitions Reference

**Version:** 1.0.0  
**Date:** June 21, 2026  
**Purpose:** Complete specification of all metrics collected by the monitoring system

---

## Table of Contents

1. [System Metrics](#system-metrics)
2. [Application Metrics](#application-metrics)
3. [Security Metrics](#security-metrics)
4. [Health Metrics](#health-metrics)
5. [Metric Types](#metric-types)
6. [Naming Conventions](#naming-conventions)
7. [Query Examples](#query-examples)

---

## System Metrics

### CPU Metrics

#### `system.cpu.usage`
**Type:** Gauge  
**Unit:** Percentage (0-100)  
**Update Interval:** 5 seconds  
**Labels:** `core` (optional, per-core breakdown)

**Schema:**
```javascript
{
  usage: number,              // CPU usage percentage
  cores: number,              // Number of CPU cores
  model: string,              // CPU model string
  loadAverage: {
    oneMinute: number,        // 1-minute load average
    fiveMinutes: number,      // 5-minute load average
    fifteenMinutes: number    // 15-minute load average
  },
  perCore?: [                 // Optional per-core breakdown
    {
      core: number,
      usage: number
    }
  ]
}
```

**Thresholds:**
- Normal: < 70%
- Warning: 70-85%
- Critical: > 85%

**Example Query (Prometheus):**
```
system_cpu_usage{job="basset-hound"}
```

---

### Memory Metrics

#### `system.memory.heap`
**Type:** Gauge  
**Unit:** Bytes  
**Update Interval:** 5 seconds

**Schema:**
```javascript
{
  used: number,               // Bytes used in heap
  total: number,              // Total heap allocated
  usedPercent: number,        // Percentage of heap used
  available: number,          // Available heap space
  max: number                 // Maximum heap size
}
```

**Thresholds:**
- Normal: < 60%
- Warning: 60-80%
- Critical: > 80%

#### `system.memory.rss`
**Type:** Gauge  
**Unit:** Bytes  
**Update Interval:** 5 seconds

**Schema:**
```javascript
{
  resident: number,           // Resident set size
  external: number,           // External memory (buffers)
  arrayBuffers: number        // Memory in ArrayBuffers
}
```

#### `system.memory.system`
**Type:** Gauge  
**Unit:** Bytes  
**Update Interval:** 5 seconds

**Schema:**
```javascript
{
  total: number,              // Total system memory
  used: number,               // Used system memory
  free: number,               // Available system memory
  usedPercent: number         // Percentage used
}
```

#### `system.memory.growth`
**Type:** Gauge  
**Unit:** MB/hour  
**Update Interval:** 5 minutes

**Schema:**
```javascript
{
  baseline: number,           // Baseline memory at startup
  current: number,            // Current heap usage
  growthMBPerHour: number,    // Growth rate
  status: string              // 'stable', 'growing', 'shrinking'
}
```

---

### Disk I/O Metrics

#### `system.disk.io.read`
**Type:** Counter  
**Unit:** Bytes/sec, Operations/sec  
**Update Interval:** 10 seconds  
**Labels:** `device`

**Schema:**
```javascript
{
  bytesPerSecond: number,     // Read throughput
  operationsPerSecond: number,// Read ops/sec
  averageLatencyMs: number,   // Average latency
  totalBytes: number,         // Total bytes read (since start)
  totalOps: number            // Total operations (since start)
}
```

#### `system.disk.io.write`
**Type:** Counter  
**Unit:** Bytes/sec, Operations/sec  
**Update Interval:** 10 seconds  
**Labels:** `device`

**Schema:**
```javascript
{
  bytesPerSecond: number,
  operationsPerSecond: number,
  averageLatencyMs: number,
  totalBytes: number,
  totalOps: number
}
```

#### `system.disk.usage`
**Type:** Gauge  
**Unit:** Bytes  
**Update Interval:** 30 seconds  
**Labels:** `mountpoint`

**Schema:**
```javascript
{
  total: number,              // Total disk size
  used: number,               // Used space
  free: number,               // Free space
  usedPercent: number,        // Percentage used
  inodesUsed: number,         // Used inodes
  inodesTotal: number         // Total inodes
}
```

---

### Network I/O Metrics

#### `system.network.io.in`
**Type:** Counter  
**Unit:** Bytes/sec, Packets/sec  
**Update Interval:** 10 seconds  
**Labels:** `interface`

**Schema:**
```javascript
{
  bytesPerSecond: number,
  packetsPerSecond: number,
  totalBytes: number,
  totalPackets: number,
  errors: number,
  dropped: number
}
```

#### `system.network.io.out`
**Type:** Counter  
**Unit:** Bytes/sec, Packets/sec  
**Update Interval:** 10 seconds  
**Labels:** `interface`

**Schema:**
```javascript
{
  bytesPerSecond: number,
  packetsPerSecond: number,
  totalBytes: number,
  totalPackets: number,
  errors: number,
  dropped: number
}
```

#### `system.network.throughput`
**Type:** Gauge  
**Unit:** Mbps  
**Update Interval:** 10 seconds  
**Labels:** `interface`

**Schema:**
```javascript
{
  current: number,            // Current throughput
  average: number,            // Average over period
  peak: number,               // Peak in period
  status: string              // 'normal', 'high', 'saturated'
}
```

---

## Application Metrics

### Request Metrics

#### `app.requests.total`
**Type:** Counter  
**Unit:** Count  
**Update Interval:** Real-time  
**Labels:** `command`, `status`

**Schema:**
```javascript
{
  total: number,              // Total requests since start
  successful: number,
  failed: number,
  timeout: number,
  byCommand: {
    [command]: number
  }
}
```

#### `app.requests.throughput`
**Type:** Gauge  
**Unit:** Commands/sec, Bytes/sec  
**Update Interval:** 10 seconds

**Schema:**
```javascript
{
  commandsPerSecond: number,
  bytesPerSecond: number,
  messagesPerSecond: number,
  peakCommandsPerSec: number,
  peakBytesPerSec: number,
  byCommand: {
    [command]: {
      count: number,
      rate: number
    }
  }
}
```

#### `app.requests.latency`
**Type:** Histogram  
**Unit:** Milliseconds  
**Update Interval:** Real-time  
**Labels:** `command`

**Schema:**
```javascript
{
  p50: number,                // 50th percentile
  p75: number,                // 75th percentile
  p90: number,                // 90th percentile
  p95: number,                // 95th percentile
  p99: number,                // 99th percentile
  p999: number,               // 99.9th percentile
  min: number,
  max: number,
  avg: number,
  stdDev: number,
  samples: number,
  byCommand: {
    [command]: {
      p50: number,
      p95: number,
      p99: number,
      avg: number
    }
  }
}
```

**Thresholds:**
- Normal: p99 < 100ms
- Warning: p99 100-500ms
- Critical: p99 > 500ms

---

### Error Metrics

#### `app.errors.total`
**Type:** Counter  
**Unit:** Count  
**Update Interval:** Real-time  
**Labels:** `type`, `command`, `severity`

**Schema:**
```javascript
{
  total: number,
  rate: number,               // Errors per second
  ratePercent: number,        // Percentage of total requests
  byType: {
    [errorType]: number
  },
  bySeverity: {
    [severity]: number
  },
  byCommand: {
    [command]: {
      count: number,
      rate: number
    }
  },
  trend: string               // 'increasing', 'stable', 'decreasing'
}
```

**Error Types:**
- `TimeoutError`: Request exceeded timeout
- `ValidationError`: Input validation failed
- `NetworkError`: Network communication error
- `CommandError`: Command execution error
- `AuthenticationError`: Auth failed
- `AuthorizationError`: Permission denied
- `ResourceError`: Out of resources
- `InternalError`: Internal server error

#### `app.errors.by_cause`
**Type:** Counter  
**Unit:** Count  
**Update Interval:** Real-time

**Schema:**
```javascript
{
  byHttpStatus: {
    400: number,              // Bad request
    401: number,              // Unauthorized
    403: number,              // Forbidden
    500: number,              // Internal server error
    503: number               // Service unavailable
  },
  byCause: {
    'memory_limit_exceeded': number,
    'timeout': number,
    'invalid_input': number,
    'authentication': number
  }
}
```

---

### Connection Metrics

#### `app.connections.active`
**Type:** Gauge  
**Unit:** Count  
**Update Interval:** 10 seconds

**Schema:**
```javascript
{
  total: number,              // Total active connections
  authenticated: number,
  unauthenticated: number,
  byState: {
    connected: number,
    idle: number,
    processing: number
  },
  recentConnections: number,  // New in last interval
  recentDisconnections: number,
  averageDuration: number,    // Seconds
  longestActive: number       // Seconds
}
```

#### `app.connections.pool`
**Type:** Gauge  
**Unit:** Count  
**Update Interval:** 10 seconds

**Schema:**
```javascript
{
  total: number,              // Total in pool
  available: number,
  inUse: number,
  waiting: number,            // Waiting for connection
  poolHealth: string          // 'healthy', 'degraded', 'exhausted'
}
```

---

### Performance Metrics

#### `app.performance.memory`
**Type:** Gauge  
**Unit:** Bytes  
**Update Interval:** 5 seconds

**Schema:**
```javascript
{
  current: number,
  baseline: number,
  peak: number,
  average: number,
  growthRate: number          // MB/hour
}
```

#### `app.performance.gc`
**Type:** Counter  
**Unit:** Count, Milliseconds  
**Update Interval:** Real-time

**Schema:**
```javascript
{
  collections: number,        // Total GC runs
  lastCollectionMs: number,
  averageCollectionMs: number,
  pauses: number              // GC pauses
}
```

---

## Security Metrics

### Rate Limiting

#### `security.ratelimit.violations`
**Type:** Counter  
**Unit:** Count  
**Update Interval:** Real-time  
**Labels:** `client`, `command`, `action`

**Schema:**
```javascript
{
  total: number,
  recentViolations: number,   // In last interval
  byClient: {
    [clientId]: {
      violations: number,
      blockedUntil: timestamp,
      status: string          // 'clean', 'warning', 'blocking'
    }
  },
  byCommand: {
    [command]: number
  },
  trend: string               // 'increasing', 'stable', 'decreasing'
}
```

**Actions:**
- `rate_limited`: Request rejected (rate limit exceeded)
- `warned`: Client warned of approaching limit

---

### Size Validation

#### `security.validation.size`
**Type:** Counter  
**Unit:** Count  
**Update Interval:** Real-time  
**Labels:** `type`, `result`

**Schema:**
```javascript
{
  totalChecks: number,
  rejections: number,
  recentRejections: number,
  byType: {
    'request_too_large': number,
    'response_too_large': number,
    'buffer_overflow': number
  },
  byClient: {
    [clientId]: {
      rejections: number,
      avgSize: number
    }
  },
  thresholds: {
    maxRequestSize: number,
    maxResponseSize: number
  }
}
```

---

### Path Validation

#### `security.validation.path`
**Type:** Counter  
**Unit:** Count  
**Update Interval:** Real-time  
**Labels:** `type`, `result`

**Schema:**
```javascript
{
  totalChecks: number,
  failures: number,
  recentFailures: number,
  byType: {
    'invalid_path': number,
    'directory_traversal': number,
    'invalid_characters': number,
    'access_denied': number
  },
  byClient: {
    [clientId]: {
      failures: number,
      lastAttempt: timestamp,
      severity: string
    }
  }
}
```

---

### Input Validation

#### `security.validation.input`
**Type:** Counter  
**Unit:** Count  
**Update Interval:** Real-time  
**Labels:** `type`, `severity`

**Schema:**
```javascript
{
  totalChecks: number,
  failures: number,
  recentFailures: number,
  byType: {
    'type_mismatch': number,
    'value_out_of_range': number,
    'required_field_missing': number,
    'malformed_json': number,
    'sql_injection_attempt': number,
    'xss_attempt': number
  },
  bySeverity: {
    'low': number,
    'medium': number,
    'high': number,
    'critical': number
  }
}
```

---

### Authentication & Authorization

#### `security.auth.attempts`
**Type:** Counter  
**Unit:** Count  
**Update Interval:** Real-time  
**Labels:** `result`, `method`

**Schema:**
```javascript
{
  totalAttempts: number,
  successful: number,
  failed: number,
  recentFailures: number,
  byResult: {
    'success': number,
    'invalid_credentials': number,
    'token_expired': number,
    'insufficient_permissions': number
  },
  byClient: {
    [clientId]: {
      attempts: number,
      failures: number,
      lastAttempt: timestamp
    }
  }
}
```

---

## Health Metrics

### Component Health

#### `health.components.status`
**Type:** Gauge (0=down, 1=up)  
**Unit:** Status  
**Update Interval:** 30 seconds  
**Labels:** `component`

**Schema:**
```javascript
{
  websocket: {
    status: boolean,
    message: string,
    uptime: number,
    clients: number
  },
  storage: {
    status: boolean,
    message: string,
    diskUsagePercent: number,
    lastCheck: timestamp
  },
  memory: {
    status: boolean,
    message: string,
    heapUsedPercent: number,
    trend: string
  },
  database: {
    status: boolean,
    message: string,
    responseTime: number,
    connections: number
  }
}
```

### Service Health

#### `health.service.status`
**Type:** Gauge  
**Unit:** Status  
**Update Interval:** 60 seconds

**Schema:**
```javascript
{
  status: string,             // 'healthy', 'degraded', 'down'
  uptime: number,             // Seconds
  startTime: timestamp,
  lastCheck: timestamp,
  readiness: boolean,         // Ready to accept requests
  liveness: boolean,          // Process running
  components: {
    [component]: {
      status: boolean,
      message: string
    }
  }
}
```

---

## Metric Types

### Gauge
- Represents a single numerical value that can go up and down
- Example: CPU usage, active connections, memory usage
- Prometheus type: `gauge`

### Counter
- Always increasing value (monotonic)
- Example: total requests, total errors, total bytes sent
- Prometheus type: `counter`

### Histogram
- Distribution of values in buckets
- Example: latency distribution, request size distribution
- Prometheus type: `histogram`

### Summary
- Similar to histogram but with percentiles
- Example: latency percentiles (p50, p95, p99)
- Prometheus type: `summary`

---

## Naming Conventions

### Format
```
system|app|security|health . category . subcategory . metric
```

### Examples
- `system.cpu.usage` - System CPU usage percentage
- `app.requests.latency` - Application request latency
- `security.ratelimit.violations` - Security rate limit violations
- `health.components.status` - Health component status

### Labels
Labels provide dimensions for filtering and aggregation:

```
metric_name{label1="value1", label2="value2", ...}
```

Common labels:
- `command`: WebSocket command name
- `client`: Client identifier
- `device`: Device name (for I/O metrics)
- `interface`: Network interface name
- `severity`: Error or alert severity
- `status`: Operation status (success, failure, timeout)

---

## Query Examples

### Prometheus PromQL Queries

**Current CPU usage:**
```
system_cpu_usage{job="basset-hound"}
```

**Memory growth over 1 hour:**
```
system_memory_heap_used_percent - system_memory_heap_used_percent offset 1h
```

**Error rate in last 5 minutes:**
```
rate(app_errors_total[5m])
```

**Latency percentiles:**
```
histogram_quantile(0.95, rate(app_latency_bucket[5m]))
```

**Active connections:**
```
app_connections_active{job="basset-hound"}
```

**Rate limit violations:**
```
rate(security_ratelimit_violations_total[1m]) > 0
```

### HTTP API Queries

**Get system metrics:**
```bash
curl http://localhost:8765/health/metrics | jq '.cpu'
```

**Get application performance:**
```bash
curl http://localhost:8765/health/metrics | jq '.application'
```

**Get security metrics:**
```bash
curl http://localhost:8765/health/metrics | jq '.security'
```

### WebSocket Queries

```javascript
// Get all metrics
ws.send(JSON.stringify({ command: 'get_metrics' }));

// Get specific metric
ws.send(JSON.stringify({
  command: 'get_metrics',
  params: { type: 'system' }
}));

// Get metric history
ws.send(JSON.stringify({
  command: 'get_metric_history',
  params: {
    metric: 'app.requests.latency',
    startTime: Date.now() - 3600000,
    endTime: Date.now(),
    interval: 60000
  }
}));
```

---

**End of Metrics Definitions**
