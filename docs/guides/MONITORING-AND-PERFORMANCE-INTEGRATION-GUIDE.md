# Monitoring & Performance Integration Guide

**Version:** 1.0  
**Date:** June 13, 2026  
**Target Audience:** Platform Engineers, DevOps, Operations Teams  

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Monitoring Setup](#monitoring-setup)
4. [Performance Optimization](#performance-optimization)
5. [Multi-Target Orchestration](#multi-target-orchestration)
6. [Real-Time Alerting Integration](#real-time-alerting-integration)
7. [External System Integration](#external-system-integration)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers integrating Basset Hound Browser with monitoring, performance, and operational systems. It shows how to:

- Deploy comprehensive monitoring across browser instances
- Optimize performance for your specific workload
- Manage multiple targets at scale
- Set up real-time alerting and response
- Integrate with external systems (Slack, Datadog, etc.)

### Key Capabilities

**Monitoring:**
- Real-time throughput and latency metrics
- Memory and CPU utilization tracking
- Command success/error rate monitoring
- WebSocket connection health
- Network analysis and bottleneck detection

**Performance:**
- Throughput optimization (22-27% improvements observed)
- Memory optimization (60-80% reduction possible)
- Compression tuning (70-93% bandwidth savings)
- Concurrent session management
- Load balancing strategies

**Multi-Target:**
- Parallel session execution
- Target prioritization
- Resource pooling
- Distributed orchestration
- Failure handling and recovery

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│             Client Applications/Agents                  │
│         (JavaScript, Python, External Services)         │
└────────────────┬────────────────────────────────────────┘
                 │
         ┌───────▼────────┐
         │  Load Balancer │
         └───────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼──┐    ┌───▼──┐    ┌───▼──┐
│ BHB  │    │ BHB  │    │ BHB  │
│ v12.1│    │ v12.1│    │ v12.1│   (Browser Instances)
└───┬──┘    └───┬──┘    └───┬──┘
    │           │           │
    └─────┬─────┴─────┬─────┘
          │           │
      ┌───▼──┐   ┌───▼──────┐
      │Metrics   │Monitoring │
      │Store    │Dashboard   │
      └────────────────────────┘
          │
      ┌───▼──────┐
      │Alerting  │
      │Engine    │
      └──────────┘
```

### Data Flow

1. **Browser Instances** emit performance metrics and logs
2. **Metrics Collector** aggregates data (Prometheus, StatsD, custom)
3. **Time-Series Database** stores metrics (InfluxDB, Prometheus)
4. **Dashboard** visualizes metrics (Grafana, Kibana, etc.)
5. **Alert Manager** detects anomalies and triggers actions
6. **External Systems** receive notifications (Slack, PagerDuty, etc.)

---

## Monitoring Setup

### 1. Basic Metrics Collection

#### Step 1: Enable Metrics Endpoint

Configure Basset Hound Browser to expose metrics:

```json
{
  "monitoring": {
    "enabled": true,
    "metricsEndpoint": "0.0.0.0:9090",
    "format": "prometheus",
    "interval": 1000
  }
}
```

#### Step 2: Query Metrics via WebSocket

Get real-time metrics:

```javascript
const client = new BassetHoundClient();

// Get comprehensive metrics
const metrics = await client.send({
  command: 'get_performance_metrics',
  includeHistorical: true,
  window: '5m'
});

console.log(metrics);
// {
//   throughput: 450,
//   latency: { p50: 20, p95: 80, p99: 150 },
//   memory: 1024,
//   cpu: 25,
//   activeConnections: 42,
//   errorRate: 0.001,
//   uptime: 3600000
// }
```

#### Step 3: Set Up Prometheus Scraping

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'basset-hound'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 10s
```

Start Prometheus:

```bash
docker run -d \
  --name prometheus \
  --network basset-hound-browser \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

### 2. Advanced Metrics Monitoring

#### Memory Monitoring

```javascript
// Monitor memory usage in real-time
const memoryMonitor = async () => {
  const metrics = await client.send({
    command: 'get_memory_metrics',
    detailed: true
  });
  
  return {
    heapUsed: metrics.heapUsed,
    heapTotal: metrics.heapTotal,
    external: metrics.external,
    rss: metrics.rss,
    growth: metrics.hourlyGrowth
  };
};

// Alert if memory growing too fast
setInterval(async () => {
  const mem = await memoryMonitor();
  if (mem.growth > 50) {
    console.warn('Memory growing rapidly:', mem.growth, 'MB/hour');
    // Trigger alert
  }
}, 60000);
```

#### Throughput Monitoring

```javascript
// Track messages per second
const throughputMonitor = async () => {
  const metrics = await client.send({
    command: 'get_throughput_metrics',
    window: '1m'
  });
  
  return {
    current: metrics.messagesPerSecond,
    average: metrics.averagePerSecond,
    peak: metrics.peakPerSecond,
    trend: metrics.trend  // 'up', 'down', 'stable'
  };
};

// Alert if throughput drops
let previousThroughput = 400;
setInterval(async () => {
  const throughput = await throughputMonitor();
  const drop = ((previousThroughput - throughput.current) / previousThroughput) * 100;
  
  if (drop > 10) {
    console.warn('Throughput dropped:', drop, '%');
    // Investigate cause
  }
  
  previousThroughput = throughput.current;
}, 60000);
```

#### Connection Health Monitoring

```javascript
// Monitor WebSocket connections
const connectionMonitor = async () => {
  const status = await client.send({
    command: 'get_connection_status'
  });
  
  return {
    active: status.activeConnections,
    established: status.establishedConnections,
    failed: status.failedConnections,
    closed: status.closedConnections,
    errorRate: status.errorRate,
    averageLatency: status.averageLatency
  };
};
```

### 3. Grafana Dashboard Setup

Create a Grafana dashboard for visualization:

```json
{
  "dashboard": {
    "title": "Basset Hound Browser Monitoring",
    "panels": [
      {
        "title": "Throughput (messages/sec)",
        "targets": [
          {
            "expr": "basset_throughput_messages_per_second"
          }
        ]
      },
      {
        "title": "Memory Usage (MB)",
        "targets": [
          {
            "expr": "basset_memory_heap_used_mb"
          }
        ]
      },
      {
        "title": "Latency P99 (ms)",
        "targets": [
          {
            "expr": "basset_latency_p99_ms"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "basset_error_rate"
          }
        ]
      },
      {
        "title": "Active Connections",
        "targets": [
          {
            "expr": "basset_connections_active"
          }
        ]
      }
    ]
  }
}
```

---

## Performance Optimization

### 1. Profile Selection

Choose the right performance profile for your workload:

```javascript
const client = new BassetHoundClient();

// BALANCED (default) - 70% throughput, 60% accuracy
await client.send({
  command: 'configure_performance',
  profile: 'balanced'
});

// MAXIMUM (high throughput) - 100% throughput, 40% accuracy
await client.send({
  command: 'configure_performance',
  profile: 'maximum'
});

// ACCURATE (high accuracy) - 50% throughput, 100% accuracy
await client.send({
  command: 'configure_performance',
  profile: 'accurate'
});
```

### 2. Compression Tuning

Optimize compression for your data patterns:

```javascript
// Enable adaptive compression
await client.send({
  command: 'configure_compression',
  adaptive: true,
  algorithm: 'brotli',  // Better compression
  level: 4,             // Balance speed vs. ratio
  minSize: 500         // Only compress > 500 bytes
});

// Expected: 70-93% bandwidth reduction
```

### 3. Parallelization Tuning

Optimize for concurrent operations:

```javascript
// v12.1.0+ - Enable parallel sessions
await client.send({
  command: 'configure_parallelization',
  enabled: true,
  maxSessions: 10,
  resourcePooling: true,
  independentState: true
});

// Expected: 5-10% throughput improvement
```

### 4. Memory Optimization

```javascript
// Configure memory thresholds and garbage collection
await client.send({
  command: 'configure_memory',
  thresholds: {
    warning: 1500,      // MB
    critical: 1800      // MB
  },
  garbageCollection: 'aggressive',
  caching: {
    enabled: true,
    maxSize: 500        // MB
  }
});
```

### 5. Performance Monitoring & Tuning Loop

```javascript
const performanceTuningLoop = async () => {
  // Measure baseline
  const baseline = await client.send({
    command: 'get_performance_metrics'
  });
  
  console.log('Baseline:', baseline.throughput, 'msgs/sec');
  
  // Test different profiles
  const profiles = ['maximum', 'balanced', 'accurate'];
  const results = {};
  
  for (const profile of profiles) {
    await client.send({
      command: 'configure_performance',
      profile
    });
    
    // Run test load
    const metrics = await runLoadTest(100);
    results[profile] = {
      throughput: metrics.throughput,
      accuracy: metrics.accuracy,
      memory: metrics.memory
    };
  }
  
  // Select best profile
  const best = Object.entries(results)
    .sort(([, a], [, b]) => b.throughput - a.throughput)[0];
  
  console.log('Best profile:', best[0], best[1]);
  
  // Apply best profile
  await client.send({
    command: 'configure_performance',
    profile: best[0]
  });
};
```

---

## Multi-Target Orchestration

### 1. Parallel Session Management

#### Create Session Group

```javascript
const orchestrator = new MultiTargetOrchestrator(client);

// Create 10 parallel sessions
const group = await orchestrator.createSessionGroup({
  count: 10,
  parallelization: true,
  resourcePooling: true
});

console.log('Created sessions:', group.sessionIds);
```

#### Execute Parallel Operations

```javascript
// Navigate all sessions to different URLs concurrently
const targets = [
  'https://example1.com',
  'https://example2.com',
  'https://example3.com',
  // ... 7 more
];

const results = await Promise.all(
  group.sessionIds.map((sessionId, i) =>
    client.send({
      command: 'navigate',
      sessionId,
      url: targets[i]
    })
  )
);

console.log('All navigations completed');
```

### 2. Resource Pooling

#### Pool Configuration

```javascript
const config = {
  poolSize: 20,
  maxQueueLength: 100,
  resourceAllocation: {
    memory: 100,        // MB per session
    bandwidth: 1000,    // KB/s
    cpu: 10             // %
  }
};

await client.send({
  command: 'configure_resource_pool',
  ...config
});
```

#### Pool Monitoring

```javascript
const poolStatus = await client.send({
  command: 'get_pool_status'
});

console.log(poolStatus);
// {
//   active: 15,
//   idle: 5,
//   queued: 3,
//   utilization: 75,
//   health: 'healthy'
// }
```

### 3. Failure Handling & Recovery

```javascript
const robustOrchestrator = async (targets) => {
  const results = [];
  const maxRetries = 3;
  
  for (const target of targets) {
    let success = false;
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const sessionId = await createSession();
        const result = await client.send({
          command: 'navigate',
          sessionId,
          url: target,
          timeout: 10000
        });
        
        results.push({ target, success: true, result });
        success = true;
        break;
      } catch (error) {
        lastError = error;
        console.log(`Attempt ${attempt + 1} failed for ${target}`);
        
        if (attempt < maxRetries - 1) {
          // Exponential backoff
          await sleep(1000 * Math.pow(2, attempt));
        }
      }
    }
    
    if (!success) {
      results.push({
        target,
        success: false,
        error: lastError.message
      });
    }
  }
  
  return results;
};
```

### 4. Target Prioritization

```javascript
const prioritizedOrchestrator = async (targets) => {
  // Sort targets by priority
  targets.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  
  // Process high-priority targets first
  const highPriority = targets.filter(t => t.priority >= 8);
  const normalPriority = targets.filter(t => t.priority < 8);
  
  // Execute high-priority in parallel
  await Promise.all(
    highPriority.map(t => processTarget(t))
  );
  
  // Then execute normal-priority
  for (const target of normalPriority) {
    await processTarget(target);
  }
};
```

---

## Real-Time Alerting Integration

### 1. Slack Integration

#### Setup Webhook

```javascript
const slackIntegration = {
  enabled: true,
  webhookUrl: process.env.SLACK_WEBHOOK_URL,
  alerts: {
    memory: {
      threshold: 1500,  // MB
      severity: 'warning'
    },
    errorRate: {
      threshold: 0.01,  // 1%
      severity: 'critical'
    },
    throughput: {
      threshold: 350,   // msgs/sec minimum
      severity: 'warning'
    }
  }
};

await client.send({
  command: 'configure_alerting',
  ...slackIntegration
});
```

#### Send Alert to Slack

```javascript
const sendSlackAlert = async (title, message, severity) => {
  const color = {
    critical: 'danger',
    warning: 'warning',
    info: 'good'
  }[severity];
  
  const payload = {
    attachments: [{
      color,
      title,
      text: message,
      ts: Math.floor(Date.now() / 1000)
    }]
  };
  
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

// Usage
await sendSlackAlert(
  'High Memory Usage',
  'Memory reached 1.6 GB on basset-hound-prod',
  'warning'
);
```

### 2. PagerDuty Integration

```javascript
const pagerdutyIntegration = {
  enabled: true,
  integrationKey: process.env.PAGERDUTY_KEY,
  alerts: {
    serviceDown: {
      severity: 'critical'
    },
    errorRateSpike: {
      threshold: 0.05,
      severity: 'high'
    }
  }
};

const triggerPagerDutyIncident = async (title, details) => {
  const payload = {
    routing_key: process.env.PAGERDUTY_KEY,
    event_action: 'trigger',
    dedup_key: `basset-${Date.now()}`,
    payload: {
      summary: title,
      timestamp: new Date().toISOString(),
      source: 'basset-hound-monitoring',
      custom_details: details
    }
  };
  
  await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};
```

### 3. Custom Alert Handlers

```javascript
const customAlertHandler = async (metric, value, threshold) => {
  if (value > threshold) {
    // Custom logic
    console.log(`Alert: ${metric} = ${value} (threshold: ${threshold})`);
    
    // Trigger response actions
    if (metric === 'memory' && value > 1800) {
      // Critical - scale up
      await scaleUp();
    } else if (metric === 'errorRate' && value > 0.05) {
      // High error rate - check logs
      await analyzeLogs();
    } else if (metric === 'throughput' && value < 300) {
      // Low throughput - investigate
      await investigateBottleneck();
    }
  }
};
```

---

## External System Integration

### 1. Webhook Integration

#### Configure Webhooks

```javascript
await client.send({
  command: 'register_webhook',
  events: [
    'navigation_complete',
    'screenshot_captured',
    'error_occurred',
    'performance_alert'
  ],
  url: 'https://your-system.com/webhook',
  headers: {
    'Authorization': `Bearer ${process.env.WEBHOOK_TOKEN}`
  }
});
```

#### Handle Incoming Events

```javascript
app.post('/webhook', (req, res) => {
  const { event, timestamp, data } = req.body;
  
  switch (event) {
    case 'navigation_complete':
      console.log('Navigation complete:', data.url);
      // Process navigation event
      break;
      
    case 'screenshot_captured':
      console.log('Screenshot captured:', data.filename);
      // Store/process screenshot
      break;
      
    case 'error_occurred':
      console.error('Error:', data.error);
      // Handle error
      break;
      
    case 'performance_alert':
      console.warn('Performance alert:', data.metric, data.value);
      // Take action
      break;
  }
  
  res.json({ status: 'received' });
});
```

### 2. Data Lake Integration

#### Export to S3

```javascript
const exportToS3 = async (sessionId, format = 'json') => {
  // Get all session data
  const data = await client.send({
    command: 'export_session_data',
    sessionId,
    format
  });
  
  // Upload to S3
  const s3 = new AWS.S3();
  await s3.putObject({
    Bucket: 'basset-hound-data',
    Key: `sessions/${sessionId}-${Date.now()}.${format}`,
    Body: JSON.stringify(data)
  }).promise();
  
  console.log('Data exported to S3');
};
```

#### Query Metrics from Data Warehouse

```javascript
const queryMetrics = async (query) => {
  // Use Athena/BigQuery to query S3/Cloud Storage
  const results = await dataWarehouse.query(`
    SELECT * FROM basset_metrics
    WHERE ${query}
  `);
  
  return results;
};

// Usage
const lastHourMetrics = await queryMetrics(
  "timestamp > now() - interval '1 hour'"
);
```

### 3. Agent Integration (palletai, etc.)

```javascript
// Register external agent handler
await client.send({
  command: 'register_external_handler',
  agentId: 'palletai-agent-1',
  eventTypes: [
    'screenshot_captured',
    'navigation_complete',
    'error_occurred'
  ],
  handler: 'http://palletai:3000/webhook'
});

// Example: palletai processes screenshots with AI
app.post('/webhook', async (req, res) => {
  const { event, sessionId, data } = req.body;
  
  if (event === 'screenshot_captured') {
    // Send to palletai for analysis
    const analysis = await palletai.analyzeScreenshot(data.imageUrl);
    
    // Store analysis result
    await storeAnalysis(sessionId, analysis);
  }
  
  res.json({ status: 'processed' });
});
```

---

## Best Practices

### 1. Monitoring Best Practices

**DO:**
- Monitor both performance metrics and error rates
- Set up graduated alerting (warning → critical)
- Keep historical data for trend analysis
- Test alert handlers regularly
- Document alert response procedures

**DON'T:**
- Alert on every single metric spike
- Set thresholds too tight (causes alert fatigue)
- Ignore trends in metrics
- Leave alerts unconfigured

### 2. Performance Tuning Best Practices

**DO:**
- Profile before optimizing
- Measure impact of changes
- Test in staging first
- Document what works for your workload
- Monitor long-term trends

**DON'T:**
- Over-optimize for peak load
- Change too many variables at once
- Ignore memory usage
- Forget about error rates

### 3. Multi-Target Orchestration Best Practices

**DO:**
- Use session pooling for efficiency
- Implement retry logic
- Monitor pool health
- Balance load across instances
- Handle failures gracefully

**DON'T:**
- Create too many sessions
- Ignore resource limits
- Skip error handling
- Forget to clean up sessions

---

## Troubleshooting

### Issue: High Memory Usage

**Symptoms:** Memory > 1.5 GB

**Solution:**
```javascript
// 1. Check for memory leaks
const memMetrics = await client.send({
  command: 'get_memory_metrics',
  detailed: true
});

console.log('Memory trend:', memMetrics.hourlyGrowth, 'MB/hour');

// 2. If growing: Clear caches
await client.send({
  command: 'clear_caches'
});

// 3. Check for stuck sessions
const sessions = await client.send({
  command: 'list_sessions',
  includeStuck: true
});

// 4. Kill stuck sessions
for (const session of sessions.filter(s => s.stuck)) {
  await client.send({
    command: 'close_session',
    sessionId: session.id
  });
}
```

### Issue: Low Throughput

**Symptoms:** Throughput < 300 msgs/sec

**Solution:**
```javascript
// 1. Check current profile
const config = await client.send({
  command: 'get_configuration'
});

// 2. Try higher performance profile
await client.send({
  command: 'configure_performance',
  profile: 'maximum'
});

// 3. Check for network issues
const networkMetrics = await client.send({
  command: 'get_network_metrics'
});

// 4. Scale up if needed
if (networkMetrics.connections > 900) {
  // Near capacity, scale to new instance
  await scaleUp();
}
```

### Issue: High Error Rate

**Symptoms:** Error rate > 1%

**Solution:**
```javascript
// 1. Get error details
const errors = await client.send({
  command: 'get_error_logs',
  window: '10m',
  limit: 50
});

// 2. Categorize errors
const errorsByType = {};
for (const error of errors) {
  errorsByType[error.code] = (errorsByType[error.code] || 0) + 1;
}

// 3. Investigate most common error
const mostCommon = Object.entries(errorsByType)
  .sort(([, a], [, b]) => b - a)[0];

console.log('Most common error:', mostCommon);

// 4. Take corrective action based on error type
```

---

## Next Steps

1. **Deploy Monitoring:** Implement basic metrics collection
2. **Configure Dashboards:** Set up Grafana or similar
3. **Set Up Alerting:** Configure Slack/PagerDuty alerts
4. **Performance Tune:** Find optimal profile for your workload
5. **External Integration:** Connect to your systems
6. **Iterate:** Monitor, measure, improve

---

**Document Status:** ✅ Complete  
**Last Updated:** June 13, 2026  
**Version:** 1.0
