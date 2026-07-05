# Basset Hound Browser - Comprehensive Monitoring Setup Guide

**Version:** 1.0.0  
**Date:** June 21, 2026  
**Status:** Complete Setup Instructions

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [System Metrics Setup](#system-metrics-setup)
4. [Application Metrics Setup](#application-metrics-setup)
5. [Security Metrics Setup](#security-metrics-setup)
6. [Health Checks Setup](#health-checks-setup)
7. [Metrics Collection Intervals](#metrics-collection-intervals)
8. [Storage Strategy](#storage-strategy)
9. [Dashboard Configuration](#dashboard-configuration)
10. [Alerting Rules](#alerting-rules)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The Basset Hound Browser monitoring system provides comprehensive visibility into:

- **System Health:** CPU, memory, disk I/O, network I/O
- **Application Performance:** Throughput, latency, error rates, connections
- **Security Posture:** Rate limit violations, authentication failures, validation errors
- **Operational Health:** Service availability, component readiness

### Architecture

```
┌─────────────────────────────────────────────────────┐
│         WebSocket Server (Port 8765)                │
│  ┌──────────────────────────────────────────────┐  │
│  │     Monitoring Middleware                    │  │
│  │  - Request Tracking                          │  │
│  │  - Error Logging                             │  │
│  │  - Metric Collection                         │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   ┌────────────┐ ┌────────────┐ ┌────────────┐
   │  System    │ │Application │ │  Security  │
   │  Metrics   │ │  Metrics   │ │  Metrics   │
   │ Collector  │ │ Collector  │ │ Collector  │
   └────────────┘ └────────────┘ └────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   ┌─────────┐    ┌──────────┐    ┌─────────┐
   │ Health  │    │ HTTP API │    │ Storage │
   │Endpoint │    │(Prometheus)  │ (Time-  │
   └─────────┘    └──────────┘    │Series) │
                                  └─────────┘
```

---

## Quick Start

### 1. Enable Monitoring

```bash
# In your .env or environment
export MONITORING_ENABLED=true
export METRICS_COLLECTION_INTERVAL=10000  # 10 seconds
export HEALTH_CHECK_INTERVAL=30000        # 30 seconds
```

### 2. Start the WebSocket Server

```bash
cd /home/devel/basset-hound-browser
npm start
```

The server will:
- Initialize the monitoring system
- Start collecting metrics
- Enable health check endpoints
- Begin logging requests

### 3. Access Health Endpoints

```bash
# Full health status
curl http://localhost:8765/health

# Liveness check
curl http://localhost:8765/health/live

# Readiness check
curl http://localhost:8765/health/ready

# Detailed metrics
curl http://localhost:8765/health/metrics
```

### 4. Query via WebSocket

```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  // Get system metrics
  ws.send(JSON.stringify({
    command: 'get_system_metrics'
  }));

  // Get application metrics
  ws.send(JSON.stringify({
    command: 'get_application_metrics'
  }));

  // Get security metrics
  ws.send(JSON.stringify({
    command: 'get_security_metrics'
  }));
});

ws.on('message', (data) => {
  console.log('Metrics:', JSON.parse(data));
});
```

---

## System Metrics Setup

### CPU Usage

**Metric Name:** `system.cpu.usage`  
**Type:** Gauge  
**Unit:** Percentage (0-100)  
**Collection Interval:** 5 seconds  
**Retention:** 24 hours

**Definition:**

```javascript
{
  usage: 45.2,                    // Current CPU usage %
  cores: 8,                       // Number of CPU cores
  model: "Intel(R) Xeon...",      // CPU model
  loadAverage: {
    oneMinute: 1.45,              // 1-minute load average
    fiveMinutes: 1.32,            // 5-minute load average
    fifteenMinutes: 1.28          // 15-minute load average
  }
}
```

**Thresholds:**
- Warning: > 70%
- Critical: > 90%

**Collection Implementation:**

```javascript
// websocket/metrics/system-metrics-collector.js
const os = require('os');

class SystemMetricsCollector {
  collectCpuMetrics() {
    const cpus = os.cpus();
    const avgLoad = os.loadavg();
    
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const usage = 100 - ~~(100 * totalIdle / totalTick);

    return {
      usage,
      cores: cpus.length,
      model: cpus[0].model,
      loadAverage: {
        oneMinute: avgLoad[0].toFixed(2),
        fiveMinutes: avgLoad[1].toFixed(2),
        fifteenMinutes: avgLoad[2].toFixed(2)
      }
    };
  }
}
```

### Memory Usage

**Metric Name:** `system.memory.usage`  
**Type:** Gauge  
**Unit:** Bytes  
**Collection Interval:** 5 seconds  
**Retention:** 24 hours

**Definition:**

```javascript
{
  heapUsed: 157286400,            // Bytes currently in use
  heapTotal: 2147483648,          // Total allocated heap
  heapUsedPercent: 7.32,          // Percentage of heap used
  external: 52428800,             // External memory (buffers)
  rss: 314572800,                 // Resident set size
  system: {
    used: 8589934592,             // System memory used
    total: 17179869184,           // Total system memory
    free: 8589934592,             // System memory available
    usedPercent: 50
  }
}
```

**Thresholds:**
- Warning: Heap > 80%, System > 85%
- Critical: Heap > 95%, System > 95%

**Baseline Tracking:**

```javascript
// Track memory growth over time
const memoryBaseline = {
  heapUsed: 157286400,            // Initial heap
  timestamp: Date.now(),
  samples: []                      // Historical samples
};

function trackMemoryGrowth() {
  const current = process.memoryUsage();
  const growth = (current.heapUsed - memoryBaseline.heapUsed) / 1024 / 1024;
  
  return {
    baseline: memoryBaseline.heapUsed / 1024 / 1024 + ' MB',
    current: current.heapUsed / 1024 / 1024 + ' MB',
    growth: growth.toFixed(2) + ' MB'
  };
}
```

### Disk I/O

**Metric Name:** `system.disk.io`  
**Type:** Counter  
**Unit:** Bytes/sec  
**Collection Interval:** 10 seconds  
**Retention:** 24 hours

**Definition:**

```javascript
{
  read: {
    bytesPerSecond: 1048576,       // Read throughput
    operationsPerSecond: 256,      // Read ops/sec
    averageLatencyMs: 2.5
  },
  write: {
    bytesPerSecond: 524288,        // Write throughput
    operationsPerSecond: 128,      // Write ops/sec
    averageLatencyMs: 3.2
  },
  devices: {
    'sda': { readOps: 1024, writeOps: 512 },
    'sdb': { readOps: 512, writeOps: 256 }
  }
}
```

### Network I/O

**Metric Name:** `system.network.io`  
**Type:** Counter  
**Unit:** Bytes/sec, Packets/sec  
**Collection Interval:** 10 seconds  
**Retention:** 24 hours

**Definition:**

```javascript
{
  interfaces: {
    'eth0': {
      bytesIn: 104857600,           // Bytes received
      bytesOut: 52428800,           // Bytes sent
      packetsIn: 102400,            // Packets received
      packetsOut: 51200,            // Packets sent
      errors: 0,                    // Errors detected
      dropped: 0,                   // Packets dropped
      throughputMbps: 75.5          // Current throughput
    }
  },
  totals: {
    bytesIn: 104857600,
    bytesOut: 52428800,
    throughputMbps: 75.5,
    errors: 0
  }
}
```

---

## Application Metrics Setup

### Request Throughput

**Metric Name:** `app.requests.throughput`  
**Type:** Gauge  
**Unit:** Commands/sec  
**Collection Interval:** 10 seconds  
**Retention:** 7 days

**Definition:**

```javascript
{
  currentThroughput: 156.4,        // Commands/sec (current)
  averageThroughput: 142.8,        // Commands/sec (over interval)
  peakThroughput: 289.3,           // Commands/sec (peak)
  totalCommands: 1048576,          // Total since startup
  commandBreakdown: {
    navigate: 245,
    click: 512,
    screenshot: 34,
    scroll: 89,
    // ... other commands
  }
}
```

**Collection Implementation:**

```javascript
class ApplicationMetricsCollector {
  constructor() {
    this.commandCounts = new Map();
    this.lastCollection = Date.now();
    this.throughputHistory = [];
  }

  recordCommand(command) {
    const count = this.commandCounts.get(command) || 0;
    this.commandCounts.set(command, count + 1);
  }

  collectThroughput() {
    const now = Date.now();
    const intervalSeconds = (now - this.lastCollection) / 1000;
    
    const totalCommands = Array.from(this.commandCounts.values())
      .reduce((a, b) => a + b, 0);
    
    const throughput = totalCommands / intervalSeconds;
    this.throughputHistory.push({ throughput, timestamp: now });
    
    if (this.throughputHistory.length > 1440) { // 24 hours @ 60s intervals
      this.throughputHistory.shift();
    }
    
    this.lastCollection = now;
    this.commandCounts.clear();
    
    return {
      currentThroughput: throughput.toFixed(2),
      averageThroughput: this._calculateAverage().toFixed(2),
      peakThroughput: this._calculatePeak().toFixed(2),
      totalCommands: this._calculateTotal(),
      commandBreakdown: this._getCommandBreakdown()
    };
  }
}
```

### Latency Metrics

**Metric Name:** `app.requests.latency`  
**Type:** Histogram  
**Unit:** Milliseconds  
**Collection Interval:** Real-time (per request)  
**Retention:** 7 days

**Definition:**

```javascript
{
  p50: 12.4,                       // 50th percentile
  p95: 45.8,                       // 95th percentile
  p99: 89.2,                       // 99th percentile
  p999: 156.3,                     // 99.9th percentile
  min: 1.2,                        // Minimum
  max: 1024.5,                     // Maximum
  avg: 22.4,                       // Average
  stdDev: 15.3,                    // Standard deviation
  samples: 102400,                 // Number of samples
  byCommand: {
    navigate: { p50: 234, p95: 456, p99: 890 },
    click: { p50: 12, p95: 24, p99: 45 },
    // ... other commands
  }
}
```

**Thresholds:**
- Warning: p99 > 500ms
- Critical: p99 > 1000ms

**Collection Implementation:**

```javascript
class LatencyCollector {
  constructor(bucketCount = 100) {
    this.samples = [];
    this.maxSamples = 10000;
    this.commandSamples = new Map();
    this.bucketCount = bucketCount;
  }

  recordLatency(latencyMs, command) {
    this.samples.push(latencyMs);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    // Track per-command
    if (!this.commandSamples.has(command)) {
      this.commandSamples.set(command, []);
    }
    const cmdSamples = this.commandSamples.get(command);
    cmdSamples.push(latencyMs);
    if (cmdSamples.length > 1000) {
      cmdSamples.shift();
    }
  }

  getPercentile(percentile) {
    if (this.samples.length === 0) return 0;
    
    const sorted = [...this.samples].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  collectLatencyMetrics() {
    if (this.samples.length === 0) {
      return null;
    }

    const sorted = [...this.samples].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;
    const variance = sorted.reduce((sum, x) => sum + Math.pow(x - avg, 2), 0) / sorted.length;

    return {
      p50: this.getPercentile(50),
      p95: this.getPercentile(95),
      p99: this.getPercentile(99),
      p999: this.getPercentile(99.9),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: avg.toFixed(2),
      stdDev: Math.sqrt(variance).toFixed(2),
      samples: this.samples.length,
      byCommand: this._getCommandPercentiles()
    };
  }
}
```

### Error Rate

**Metric Name:** `app.requests.errors`  
**Type:** Counter  
**Unit:** Percentage, Count  
**Collection Interval:** 10 seconds  
**Retention:** 7 days

**Definition:**

```javascript
{
  errorCount: 142,                 // Total errors since start
  errorRate: 0.28,                 // Percentage (0-100)
  errorRatePercent: '0.28%',
  recentErrors: 3,                 // Errors in last interval
  byType: {
    'TimeoutError': 45,
    'ValidationError': 32,
    'NetworkError': 28,
    'CommandError': 15,
    'UnknownError': 22
  },
  byCommand: {
    'navigate': { count: 45, rate: '0.15%' },
    'screenshot': { count: 32, rate: '1.25%' },
    // ... other commands
  },
  trend: 'stable'                  // up, down, stable
}
```

**Thresholds:**
- Warning: > 1%
- Critical: > 5%

### Active Connections

**Metric Name:** `app.connections.active`  
**Type:** Gauge  
**Unit:** Count  
**Collection Interval:** 10 seconds  
**Retention:** 7 days

**Definition:**

```javascript
{
  total: 156,                      // Total active connections
  authenticated: 142,              // Authenticated connections
  unauthenticated: 14,             // Unauthenticated connections
  byState: {
    'connected': 156,
    'idle': 45,
    'processing': 111
  },
  recentConnections: 3,            // New in last interval
  recentDisconnections: 1,         // Closed in last interval
  averageDuration: 1245,           // Seconds
  longest: 7234                    // Longest active (seconds)
}
```

---

## Security Metrics Setup

### Rate Limit Violations

**Metric Name:** `security.ratelimit.violations`  
**Type:** Counter  
**Unit:** Count  
**Collection Interval:** Real-time  
**Retention:** 30 days

**Definition:**

```javascript
{
  totalViolations: 23,             // Total violations since start
  violationsInInterval: 2,         // Violations in last interval
  byClient: {
    'client_a': { violations: 5, commands: 'screenshot', status: 'blocking' },
    'client_b': { violations: 3, commands: 'navigate', status: 'warning' },
    // ... other clients
  },
  byCommand: {
    'screenshot': 8,               // Expensive operations
    'screenshot_full_page': 7,
    'execute_script': 5,
    // ... other commands
  },
  currentStatus: 'clean',          // clean, warning, blocking
  trend: 'decreasing'              // increasing, stable, decreasing
}
```

**Implementation:**

```javascript
class RateLimitMetricsCollector {
  constructor() {
    this.violations = [];
    this.clientViolations = new Map();
    this.commandViolations = new Map();
  }

  recordViolation(clientId, command, limit) {
    const violation = {
      timestamp: Date.now(),
      clientId,
      command,
      limit,
      action: 'rejected'
    };

    this.violations.push(violation);
    
    // Track per client
    if (!this.clientViolations.has(clientId)) {
      this.clientViolations.set(clientId, []);
    }
    this.clientViolations.get(clientId).push(violation);

    // Track per command
    const count = (this.commandViolations.get(command) || 0) + 1;
    this.commandViolations.set(command, count);
  }

  getViolationSummary() {
    const oneHourAgo = Date.now() - 3600000;
    const recentViolations = this.violations.filter(v => v.timestamp > oneHourAgo);

    return {
      totalViolations: this.violations.length,
      violationsInInterval: recentViolations.length,
      byClient: this._summarizeByClient(),
      byCommand: this._summarizeByCommand(),
      currentStatus: this._determineStatus(),
      trend: this._calculateTrend()
    };
  }
}
```

### Size Limit Rejections

**Metric Name:** `security.sizelimit.rejections`  
**Type:** Counter  
**Unit:** Count  
**Collection Interval:** Real-time  
**Retention:** 30 days

**Definition:**

```javascript
{
  totalRejections: 12,
  recentRejections: 0,
  byType: {
    'payload_too_large': 7,        // Request exceeds max size
    'response_too_large': 3,       // Response exceeds max size
    'buffer_overflow': 2
  },
  byClient: {
    'client_a': { rejections: 5, avgSize: 2048576 },
    // ...
  },
  threshold: {
    maxRequestSize: 10485760,      // 10MB
    maxResponseSize: 52428800      // 50MB
  },
  status: 'clean'
}
```

### Path Validation Failures

**Metric Name:** `security.pathvalidation.failures`  
**Type:** Counter  
**Unit:** Count  
**Collection Interval:** Real-time  
**Retention:** 30 days

**Definition:**

```javascript
{
  totalFailures: 8,
  recentFailures: 1,
  byType: {
    'invalid_path': 3,
    'directory_traversal': 2,
    'invalid_characters': 2,
    'access_denied': 1
  },
  byClient: {
    'client_a': { failures: 5, lastPath: '/etc/passwd' },
    // ...
  },
  status: 'monitoring'
}
```

### Invalid Inputs Detected

**Metric Name:** `security.input.validation`  
**Type:** Counter  
**Unit:** Count  
**Collection Interval:** Real-time  
**Retention:** 30 days

**Definition:**

```javascript
{
  totalInvalid: 45,
  recentInvalid: 2,
  byType: {
    'type_mismatch': 15,
    'value_out_of_range': 12,
    'required_field_missing': 10,
    'malformed_json': 5,
    'sql_injection_attempt': 2,
    'xss_attempt': 1
  },
  severity: {
    'low': 30,
    'medium': 10,
    'high': 5
  },
  status: 'monitored',
  pattern: 'normal'
}
```

---

## Health Checks Setup

### Health Endpoint Handlers

The system provides multiple health check endpoints:

```
HTTP GET /health              → Full health status (200 or 503)
HTTP GET /health/live         → Liveness check (200)
HTTP GET /health/ready        → Readiness check (200 or 503)
HTTP GET /health/metrics      → Detailed metrics (200)

WebSocket command: get_health → Full health via WebSocket
```

### Component Health Checks

Each major component registers a health check:

```javascript
// WebSocket server
healthEndpoint.registerCheck('websocket', async () => {
  const serverHealthy = wsServer && wsServer.clients.size >= 0;
  return { ok: serverHealthy, message: 'WebSocket server operational' };
});

// Database/storage
healthEndpoint.registerCheck('storage', async () => {
  try {
    const storagePath = './data/metrics';
    fs.accessSync(storagePath);
    return { ok: true, message: 'Storage accessible' };
  } catch (error) {
    return { ok: false, message: `Storage error: ${error.message}` };
  }
});

// Memory availability
healthEndpoint.registerCheck('memory', async () => {
  const memUsage = process.memoryUsage();
  const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  
  if (heapUsedPercent > 95) {
    return { ok: false, message: `Critical memory: ${heapUsedPercent.toFixed(1)}%` };
  } else if (heapUsedPercent > 80) {
    return { ok: true, message: `High memory: ${heapUsedPercent.toFixed(1)}%` };
  }
  
  return { ok: true, message: 'Memory healthy' };
});
```

### Readiness Example Response

```json
{
  "ready": true,
  "checks": [
    {
      "name": "websocket",
      "ready": true,
      "message": "WebSocket server operational"
    },
    {
      "name": "storage",
      "ready": true,
      "message": "Storage accessible"
    },
    {
      "name": "memory",
      "ready": true,
      "message": "Memory healthy"
    }
  ],
  "timestamp": "2026-06-21T12:34:56.789Z"
}
```

---

## Metrics Collection Intervals

### Recommended Intervals by Metric Type

| Metric Category | Metric Name | Interval | Retention | Storage |
|---|---|---|---|---|
| **System** | CPU Usage | 5s | 24h | In-Memory + File |
| | Memory Usage | 5s | 24h | In-Memory + File |
| | Disk I/O | 10s | 24h | File |
| | Network I/O | 10s | 24h | File |
| **Application** | Throughput | 10s | 7d | Time-Series DB |
| | Latency (p50/p95/p99) | Real-time | 7d | Time-Series DB |
| | Error Rate | 10s | 7d | Time-Series DB |
| | Active Connections | 10s | 7d | Time-Series DB |
| **Security** | Rate Limit Violations | Real-time | 30d | Database |
| | Size Limit Rejections | Real-time | 30d | Database |
| | Path Validation Failures | Real-time | 30d | Database |
| | Invalid Inputs | Real-time | 30d | Database |
| **Health** | Component Status | 30s | 7d | Database |
| | Service Availability | 60s | 30d | Database |

### Configuration Example

```javascript
// metrics/collection-intervals.js
const COLLECTION_INTERVALS = {
  // System metrics
  system: {
    cpu: 5000,      // 5 seconds
    memory: 5000,   // 5 seconds
    diskIO: 10000,  // 10 seconds
    networkIO: 10000 // 10 seconds
  },
  
  // Application metrics
  application: {
    throughput: 10000,  // 10 seconds
    latency: 0,         // Real-time (per-request)
    errorRate: 10000,   // 10 seconds
    connections: 10000  // 10 seconds
  },
  
  // Security metrics
  security: {
    rateLimiting: 0,      // Real-time
    sizeValidation: 0,    // Real-time
    pathValidation: 0,    // Real-time
    inputValidation: 0    // Real-time
  },
  
  // Health checks
  health: {
    components: 30000,    // 30 seconds
    service: 60000        // 60 seconds
  }
};
```

---

## Storage Strategy

### Multi-Tier Storage Architecture

```
┌─────────────────────────────────────────────────────┐
│     Real-Time Metrics (In-Memory)                   │
│     - Last 5 minutes of data                        │
│     - < 5MB memory footprint                        │
│     - Fastest retrieval (< 1ms)                     │
└──────────┬──────────────────────────────────────────┘
           │
           ▼ (Every 1 minute)
┌─────────────────────────────────────────────────────┐
│     Hot Storage (Compressed Files)                  │
│     - Last 24 hours of data                         │
│     - Hourly rotation                               │
│     - < 50MB disk per day                           │
└──────────┬──────────────────────────────────────────┘
           │
           ▼ (Nightly)
┌─────────────────────────────────────────────────────┐
│     Warm Storage (TimeSeries DB)                    │
│     - Last 30 days of data                          │
│     - Daily aggregation                             │
│     - Queryable archive                             │
└──────────┬──────────────────────────────────────────┘
           │
           ▼ (Monthly)
┌─────────────────────────────────────────────────────┐
│     Cold Storage (Compressed Archive)               │
│     - Historical data > 30 days                     │
│     - Optional cloud storage                        │
│     - For compliance/analysis                       │
└─────────────────────────────────────────────────────┘
```

### Data Retention Policy

```javascript
// storage/retention-policy.js
const RETENTION_POLICY = {
  // In-memory ring buffer
  inMemory: {
    maxAge: 300000,        // 5 minutes
    maxSize: 5242880,      // 5MB
    compressionLevel: 0    // No compression
  },

  // Hot storage (daily rotation)
  hotStorage: {
    path: './data/metrics/hot',
    maxAge: 86400000,      // 24 hours
    compressionLevel: 6,   // Gzip level 6
    rotationInterval: 3600000 // 1 hour
  },

  // Warm storage (aggregated)
  warmStorage: {
    path: './data/metrics/warm',
    maxAge: 2592000000,    // 30 days
    compressionLevel: 9,   // Maximum compression
    aggregationInterval: 86400000, // 1 day
    retentionPeriod: 30    // Days
  },

  // Cold storage (archive)
  coldStorage: {
    path: './data/metrics/archive',
    compressionLevel: 9,
    optional: true,
    cloudSync: false       // Optional cloud backup
  }
};
```

### File Organization

```
./data/metrics/
├── hot/
│   ├── system/
│   │   ├── 2026-06-21-00.json.gz
│   │   ├── 2026-06-21-01.json.gz
│   │   └── 2026-06-21-02.json.gz
│   ├── application/
│   │   ├── 2026-06-21-00.json.gz
│   │   └── ...
│   └── security/
│       ├── 2026-06-21-00.json.gz
│       └── ...
├── warm/
│   ├── 2026-06-21-aggregated.json
│   ├── 2026-06-20-aggregated.json
│   └── ...
└── archive/
    ├── 2026-05-aggregated.tar.gz
    └── 2026-04-aggregated.tar.gz
```

### Data Format

#### System Metrics File

```json
{
  "timestamp": "2026-06-21T12:00:00.000Z",
  "interval": 300000,
  "cpu": {
    "usage": 45.2,
    "cores": 8,
    "loadAverage": [1.45, 1.32, 1.28]
  },
  "memory": {
    "heapUsed": 157286400,
    "heapTotal": 2147483648,
    "rss": 314572800,
    "system": {
      "used": 8589934592,
      "total": 17179869184,
      "usedPercent": 50
    }
  },
  "disk": {
    "read": { "bytesPerSecond": 1048576 },
    "write": { "bytesPerSecond": 524288 }
  },
  "network": {
    "throughputMbps": 75.5,
    "errors": 0
  }
}
```

#### Application Metrics File

```json
{
  "timestamp": "2026-06-21T12:00:00.000Z",
  "throughput": {
    "commands": 1234,
    "bytes": 1048576,
    "commandsPerSecond": 123.4
  },
  "latency": {
    "p50": 12.4,
    "p95": 45.8,
    "p99": 89.2,
    "avg": 22.4,
    "samples": 1234
  },
  "errors": {
    "count": 3,
    "rate": 0.24,
    "types": {
      "TimeoutError": 2,
      "ValidationError": 1
    }
  },
  "connections": {
    "active": 156,
    "authenticated": 142,
    "recent": 3,
    "closed": 1
  }
}
```

---

## Dashboard Configuration

### Prometheus Metrics Export

Enable Prometheus scraping at `/metrics`:

```javascript
// websocket/middleware/prometheus-exporter.js
const express = require('express');
const metricsServer = express();

metricsServer.get('/metrics', (req, res) => {
  const prometheus = metricsCollector.exportPrometheus();
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(prometheus);
});

metricsServer.listen(9090, () => {
  console.log('Prometheus metrics available at http://localhost:9090/metrics');
});
```

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'basset-hound'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 10s
    scrape_timeout: 5s
```

### Grafana Dashboard JSON

See `/docs/monitoring/DASHBOARD-TEMPLATES.md` for complete Grafana dashboard definitions.

---

## Alerting Rules

### Alert Definitions

```yaml
# alerts/basset-hound-alerts.yml
groups:
  - name: basset-hound-browser
    interval: 1m
    rules:
      # System alerts
      - alert: HighCPUUsage
        expr: system_cpu_usage > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage ({{ $value }}%)"
          
      - alert: CriticalMemoryUsage
        expr: system_memory_heap_used_percent > 90
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Critical memory usage ({{ $value }}%)"

      # Application alerts
      - alert: HighErrorRate
        expr: app_error_rate > 0.05
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High error rate ({{ $value }}%)"
          
      - alert: LowThroughput
        expr: app_throughput < 10
        for: 15m
        labels:
          severity: info
        annotations:
          summary: "Low throughput ({{ $value }} cmd/sec)"

      # Security alerts
      - alert: HighRateLimitViolations
        expr: security_ratelimit_violations > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High rate limit violations"
```

---

## Troubleshooting

### Common Issues

#### Metrics Not Collecting

```bash
# Check if monitoring is enabled
curl http://localhost:8765/health/metrics

# Check metrics collector status
curl http://localhost:8765/health | jq .

# Verify WebSocket connection
wscat -c ws://localhost:8765
# Send: {"command": "get_metrics"}
```

#### High Memory Usage

```javascript
// Check memory leaks
const metrics = await getMetrics();
console.log('Heap used:', metrics.memory.heapUsed / 1024 / 1024, 'MB');
console.log('Growth rate:', calculateGrowthRate(), 'MB/hour');

// If growing, enable GC collection
if (global.gc) {
  global.gc();
}
```

#### Storage Fill-Up

```bash
# Check disk usage
du -sh ./data/metrics/

# Cleanup old files
find ./data/metrics/hot -mtime +1 -delete
find ./data/metrics/warm -mtime +30 -delete

# Enable compression
gzip -9 ./data/metrics/hot/*.json
```

#### Dashboard Not Updating

```bash
# Restart Prometheus scrape
curl -X POST http://localhost:9090/-/reload

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq .

# Verify metrics export format
curl http://localhost:9090/metrics | head -20
```

---

## Best Practices

1. **Regular Backups:** Backup metrics to cold storage weekly
2. **Alert Response:** Set up on-call rotation for critical alerts
3. **Trend Analysis:** Review weekly metrics reports for patterns
4. **Capacity Planning:** Monitor growth trends to plan scaling
5. **Documentation:** Keep runbooks for common alerts
6. **Testing:** Test alerting rules in staging before production
7. **Retention:** Follow data retention policy to manage storage
8. **Privacy:** Ensure PII is not captured in logs/metrics

---

**End of Monitoring Setup Guide**
