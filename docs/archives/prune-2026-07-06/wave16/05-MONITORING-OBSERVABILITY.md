# Wave 16: Monitoring & Observability Architecture

**Date:** June 2, 2026  
**Phase:** Architecture Design (Phase 2)  
**Duration:** 1 hour design  
**Status:** Detailed Design

---

## Executive Summary

Complete observability enables detection and remediation of issues within minutes. This document defines the monitoring, logging, tracing, and alerting infrastructure for production operations at scale.

---

## Three Pillars of Observability

```
┌─────────────────────────────────────────────────────┐
│           Complete Observability                    │
├──────────────────┬─────────────────┬────────────────┤
│     METRICS      │      LOGS       │     TRACES     │
│                  │                 │                │
│  • Count         │  • Events       │  • Latency     │
│  • Rate          │  • Errors       │  • Causality   │
│  • Latency       │  • Stack traces │  • Flow        │
│  • Distribution  │  • Context      │  • Dependencies│
│                  │                 │                │
│  Tool: Prometheus   Tool: ELK      Tool: Jaeger    │
└──────────────────┴─────────────────┴────────────────┘
```

---

## Metrics (Prometheus)

### Metric Architecture

```
Applications (Push metrics)
    ↓ (Prometheus client library)
Prometheus Scraper (Pull metrics)
    ↓ (Scrape every 15 seconds)
Prometheus TSDB (Time-Series Database)
    ↓ (Store 15-day history)
Grafana (Visualization)
    ↓
AlertManager (Alert rules)
    ↓
PagerDuty (On-call paging)
```

### Key Metrics

**Application-Level Metrics:**

```
# Connection metrics
basset_connections_active{instance="pod1", region="us-east"}
basset_connections_total{instance="pod1", region="us-east"}
basset_connections_created{instance="pod1", region="us-east"}

# Throughput metrics
basset_messages_processed_total{instance="pod1", region="us-east"}
basset_messages_rate_per_second{instance="pod1", region="us-east"}

# Latency metrics (histograms for percentiles)
basset_command_duration_seconds_bucket{
  instance="pod1", 
  region="us-east",
  command="click",
  le="0.01"  # 10ms bucket
}

# Error metrics
basset_errors_total{instance="pod1", error_type="timeout"}
basset_errors_rate{instance="pod1", error_type="connection_reset"}

# Resource metrics
basset_memory_bytes{instance="pod1"}
basset_cpu_seconds_total{instance="pod1"}
```

**System-Level Metrics:**

```
# Node metrics (from node_exporter)
node_cpu_seconds_total
node_memory_MemFree_bytes
node_disk_io_reads_completed_total
node_network_transmit_bytes_total

# Kubernetes metrics (from kube-state-metrics)
kube_pod_status_phase{pod="basset-hound-browser-xyz", phase="Running"}
kube_deployment_status_replicas{deployment="basset-hound-browser"}
kube_persistentvolume_status_phase{persistentvolume="pvc-123"}

# Database metrics (from Postgres exporter)
pg_stat_statements_mean_exec_time
pg_stat_replication_slot_retained_bytes
pg_stat_activity_max_tx_duration
```

### SLOs (Service Level Objectives)

```
SLO 1: Availability
  Target: 99.95% uptime
  Measure: (successful responses / total requests) × 100
  Alert: <99.9% (1-week rolling window)

SLO 2: Latency
  Target: P99 < 50ms
  Measure: 99th percentile latency
  Alert: >75ms or SLO burn rate >10%

SLO 3: Error Rate
  Target: < 0.1% error rate
  Measure: (failed responses / total requests) × 100
  Alert: >0.5% or SLO burn rate >10%
```

### Alerting Rules

```yaml
# CPU utilization alert
- alert: HighCPUUtilization
  expr: cpu_usage_percent > 80
  for: 5m
  severity: warning
  annotations:
    summary: "High CPU usage on {{ $labels.instance }}"

# Memory utilization alert
- alert: HighMemoryUtilization
  expr: memory_usage_percent > 85
  for: 5m
  severity: warning

# Connection saturation alert
- alert: ConnectionSaturation
  expr: connections_active / connections_max > 0.8
  for: 2m
  severity: critical

# Latency SLO burn alert
- alert: LatencySLOBurning
  expr: rate(latency_p99[5m]) > threshold
  for: 15m
  severity: warning

# Error rate alert
- alert: HighErrorRate
  expr: rate(errors_total[5m]) > 0.001
  for: 5m
  severity: critical
```

---

## Logging (ELK Stack)

### Log Architecture

```
Applications (Stdout/Stderr)
    ↓
Filebeat (Log shipper)
    ↓ (Forward to Logstash)
Logstash (Processing/Enrichment)
    ↓ (Parse, filter, enrich)
Elasticsearch (Full-text search)
    ↓
Kibana (Visualization)
    ↓
AlertsManager (Query-based alerts)
```

### Log Levels & Severity

**Application Logging:**

```
DEBUG (verbosity level 5):
  - Every function entry/exit
  - Variable values
  - Decision branches
  - Use: Development, troubleshooting

INFO (verbosity level 4):
  - Session created/destroyed
  - Command started/completed
  - Configuration changes
  - Use: Normal operations

WARN (verbosity level 3):
  - Performance degradation
  - Unusual patterns
  - Retry attempts
  - Use: Investigation

ERROR (verbosity level 2):
  - Failed commands
  - Connection timeouts
  - Validation failures
  - Use: Immediate action

CRITICAL (verbosity level 1):
  - System unavailable
  - Data corruption
  - Security incidents
  - Use: Escalation
```

### Log Schema

```json
{
  "timestamp": "2026-06-02T10:30:45.123Z",
  "level": "INFO",
  "logger": "SessionManager",
  "message": "Session created",
  "session_id": "sess-123",
  "user_id": "user-456",
  "instance_id": "pod-1",
  "region": "us-east-1",
  "trace_id": "trace-789",
  "span_id": "span-012",
  "duration_ms": 45,
  "error": null,
  "metadata": {
    "profile": "default",
    "proxy": "enabled"
  }
}
```

### Indexing Strategy

```
Index naming: basset-hound-YYYY.MM.DD
Shard count: 3 (parallel indexing)
Replica count: 1 (high availability)
Refresh interval: 1 second (near real-time)

Retention policy:
- Hot (searchable): 7 days in cluster
- Warm (searchable): 30 days in cluster
- Cold (archived): S3 for 90 days
- Delete: After 90 days
```

### Kibana Dashboards

**Key Dashboards:**

1. **Operations Dashboard** (Real-time health)
   - Active connections (trend)
   - Message throughput (rate)
   - Error rate (count + %)
   - P99 latency (over time)
   - Instance health status

2. **Performance Dashboard** (Optimization metrics)
   - CPU/Memory per instance
   - Screenshot encoding latency
   - Database query performance
   - Cache hit rate

3. **Error Dashboard** (Debugging)
   - Error count by type
   - Error rate by instance
   - Stack trace analysis
   - Time-to-resolution

4. **Security Dashboard** (Threat detection)
   - Suspicious patterns
   - Rate-limited IPs
   - Unusual geolocation access
   - Failed authentication attempts

---

## Tracing (Jaeger)

### Request Flow Visualization

```
Client Request
    │
    ├─ [1] Route 53 DNS query (1ms)
    │
    ├─ [2] Connect to regional LB (5ms)
    │
    ├─ [3] HAProxy routing (2ms)
    │
    ├─ [4] Instance WebSocket upgrade (5ms)
    │   │
    │   ├─ [4.1] Redis session lookup (2ms)
    │   │
    │   ├─ [4.2] Evasion check (3ms)
    │   │
    │   └─ [4.3] Monitoring setup (1ms)
    │
    └─ [5] Command processing (varies)
        │
        ├─ [5.1] Validate (2ms)
        ├─ [5.2] Execute (50-200ms)
        ├─ [5.3] Screenshot (100-500ms)
        ├─ [5.4] Cache result (1ms)
        └─ [5.5] Return to client (1ms)

Total latency: 100-800ms (typical)
```

### Jaeger Configuration

```yaml
# Trace sampling strategy
samplingStrategy:
  type: probabilistic
  param: 0.1  # Sample 10% of requests (adjust as needed)

# Collector configuration
collector:
  httpPort: 14268  # HTTP thrift endpoint
  grpcPort: 14250  # gRPC endpoint

# Storage
storage:
  type: elasticsearch
  options:
    es:
      server-urls: ["http://elasticsearch:9200"]
      version: 7
      max-span-age: 72h

# Retention
retention: 72h  # Keep 3 days of traces
```

### Instrumentation

**Automatic instrumentation (OpenTelemetry):**

```javascript
const { NodeTracerProvider } = require('@opentelemetry/node');
const { jaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { registerInstrumentations } = require('@opentelemetry/auto-instrumentations-node');

const jaegerExporter = new JaegerExporter({
  serviceName: 'basset-hound-browser',
  host: 'jaeger-collector',
  port: 6831,
});

const tracerProvider = new NodeTracerProvider();
tracerProvider.addSpanProcessor(new BatchSpanProcessor(jaegerExporter));
registerInstrumentations({
  tracerProvider,
  // Auto-instrument: http, redis, postgres, etc.
});
```

**Manual instrumentation (custom spans):**

```javascript
const tracer = trace.getTracer('basset-hound');

const span = tracer.startSpan('processCommand', {
  attributes: {
    'session.id': sessionId,
    'command.type': commandType,
  }
});

try {
  // Process command
  result = await executeCommand(command);
  span.setStatus({ code: SpanStatusCode.OK });
} catch (error) {
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  span.recordException(error);
} finally {
  span.end();
}
```

---

## Health Checks

### Liveness Probe (Is it alive?)

**Endpoint:** `/health/live`

```json
{
  "status": "alive",
  "timestamp": "2026-06-02T10:30:45Z",
  "uptime_seconds": 86400
}
```

**Success:** Always returns 200 OK (fast check)
**Failure:** Returns 500 (Kubernetes restarts pod)
**Timeout:** 2 seconds (Kubernetes kills unresponsive pod)

### Readiness Probe (Ready to serve requests?)

**Endpoint:** `/health/ready`

**Checks:**
1. Redis Sentinel connection (must be up)
2. PostgreSQL connection (must be up)
3. Memory usage (<90% of limit)
4. Request queue length (<1000)
5. Recent error rate (<10%)

**Response:**
```json
{
  "status": "ready",
  "redis": { "status": "connected", "latency_ms": 2 },
  "postgres": { "status": "connected", "latency_ms": 5 },
  "memory_percent": 65,
  "queue_length": 50,
  "error_rate": 0.001
}
```

**Success:** Returns 200 OK
**Failure:** Returns 503 (HAProxy removes from LB, no new requests)
**Timeout:** 1 second (removed from LB)

---

## SLI & SLO Definition

### Key SLIs (Service Level Indicators)

```
SLI 1: Request Success Rate
  Calculation: (200-399 responses / all responses) × 100
  Target: >99.9%

SLI 2: Latency
  Calculation: P99 latency
  Target: <50ms

SLI 3: Availability
  Calculation: (uptime / total time) × 100
  Target: >99.95%

SLI 4: Error Budget
  Definition: 100% - SLO%
  For 99.95%: 0.05% × 730 hours = 21.6 minutes/month
  Allocation: Use proactively, not reactively
```

### Error Budget Burn Rate Alerts

```yaml
# Fast burn: Consume 10% of monthly budget in 1 hour
- alert: ErrorBudgetBurningFast
  expr: error_rate > 10 * target_error_rate
  for: 1m
  severity: critical

# Slow burn: Consume 2% of monthly budget per day
- alert: ErrorBudgetBurningSlow
  expr: error_rate > 2 * target_error_rate
  for: 6h
  severity: warning

# Action: If burning fast → emergency mitigation
# Action: If burning slow → plan improvements
```

---

## Production Runbook (Example Alert)

### Alert: HighLatencyP99 (P99 > 50ms)

**Detection:** Prometheus alert + Slack notification

**Initial Response (0-5 minutes):**
1. Check Grafana dashboard for context
2. Identify affected region/instance
3. Check recent deployments
4. Review application logs for errors

**Investigation (5-15 minutes):**
```bash
# Check instance CPU
kubectl top pod basset-hound-browser-xyz

# Check database latency
SELECT mean(query_duration_ms) FROM pg_stat_statements;

# Check Redis latency
redis-cli --latency-history

# Check network latency
curl -w "%{time_total}" https://instance.internal/health/ready
```

**Remediation:**
- If CPU high → Scale up (add instances)
- If database slow → Add index, optimize query
- If Redis slow → Check network, add capacity
- If recent deploy → Rollback

---

## Document Control

| Field | Value |
|-------|-------|
| Document ID | WAVE-16-PHASE-2-MONITORING |
| Version | 1.0 |
| Status | Draft |
| Created | June 2, 2026 |
| Owner | Architecture Team |

---

**Next Document:** `/docs/wave16/06-KUBERNETES-DEPLOYMENT.md`
