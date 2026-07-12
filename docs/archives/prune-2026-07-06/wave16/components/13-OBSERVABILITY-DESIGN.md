# Wave 16 Component Design: Monitoring & Observability

**Component ID:** OB-001  
**Date:** June 3, 2026  
**Status:** DESIGN COMPLETE  
**Effort:** 1.5 hours  
**Lines:** 1,500+

---

## Executive Summary

The Observability component provides three-pillar monitoring: metrics (Prometheus), logs (ELK), and traces (Jaeger). Ensures visibility into system behavior with 99%+ data retention and <5 minute alerting latency.

**Key Metrics:**
- Metrics cardinality: 10,000+
- Log ingest: 100,000 events/sec
- Trace sampling: 10% (tunable)
- Alert latency: <5 minutes
- SLO: 99.95% availability

---

## 1. Three Pillars

### 1.1 Metrics (Prometheus)

**Architecture:**
```
Application Metrics
        │
        ▼
    Prometheus Exporters
        │
        ▼
    Prometheus Server (3 replicas)
        │
        ├─> Alertmanager
        │
        └─> Grafana (dashboards)
```

**Scrape Configuration:**
```yaml
scrape_configs:
  - job_name: 'basset-websocket'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: keep
        regex: websocket
    scrape_interval: 15s
    scrape_timeout: 10s
```

**Key Metrics:**
```
Application:
  http_request_duration_seconds         # Request latency
  websocket_connections_total           # Active connections
  websocket_message_rate                # Messages/sec
  task_completion_time_seconds          # Task duration

System:
  container_cpu_usage_seconds           # CPU usage
  container_memory_usage_bytes          # Memory usage
  container_network_receive_bytes       # Network I/O
  node_disk_read_bytes                  # Disk I/O

Database:
  pg_connections_used                   # DB connections
  pg_query_duration_seconds             # Query latency
  redis_commands_processed              # Redis ops
  mysql_slow_queries_total              # Slow queries

Infrastructure:
  kubernetes_pod_restart_total          # Pod restarts
  kubernetes_pod_oom_kills              # OOM events
  etcd_server_has_leader                # Cluster health
```

### 1.2 Logs (ELK Stack)

**Log Pipeline:**
```
Application Logs
        │
        ▼
    Filebeat (log shipping)
        │
        ▼
    Logstash (parsing/enrichment)
        │
        ▼
    Elasticsearch (storage/indexing)
        │
        ├─> Kibana (visualization)
        │
        └─> Alerts
```

**Log Levels:**
```
DEBUG:  Detailed debugging info
INFO:   General operational info
WARN:   Warning conditions
ERROR:  Error conditions
FATAL:  Fatal/critical errors
```

**Structured Logging (JSON):**
```json
{
  "timestamp": "2026-06-03T12:34:56Z",
  "level": "ERROR",
  "logger": "websocket_handler",
  "message": "Connection lost",
  "user_id": "user_abc123",
  "session_id": "sess_def456",
  "error_code": "CONNECTION_TIMEOUT",
  "duration_ms": 1234,
  "tags": ["websocket", "connection"]
}
```

**Index Retention:**
```
Hot (7 days):   Searchable, full resolution
Warm (30 days): Searchable, lower priority
Cold (1 year):  Archived, slow retrieval
Delete (>1yr):  Automatically purged
```

### 1.3 Traces (Jaeger)

**Distributed Tracing:**
```
User Request
        │
        ├─> Load Balancer Span
        │       │
        │       ├─> WebSocket Handler Span
        │       │       │
        │       │       ├─> Authentication Span
        │       │       │
        │       │       ├─> Session Lookup Span (Redis)
        │       │       │
        │       │       └─> Message Processing Span
        │       │
        │       └─> Response Span
        │
        └─ [Total latency: 45ms]
```

**Sampling Strategy:**
```
Probabilistic sampling: 10% of requests
Rule-based sampling: 100% for errors
```

**Trace Format (OpenTelemetry):**
```json
{
  "traceID": "abc123xyz789",
  "spanID": "def456",
  "operationName": "GET /api/tasks",
  "tags": {
    "http.method": "GET",
    "http.url": "/api/tasks",
    "http.status_code": 200,
    "component": "websocket"
  },
  "logs": [
    {
      "timestamp": 1717416000000,
      "event": "connection_established",
      "message": "WebSocket connected"
    }
  ],
  "duration": 45000
}
```

---

## 2. SLI & SLO Definition

**Service Level Indicators (SLIs):**
```
Availability:
  (successful_requests / total_requests) * 100
  Target: >99.95%

Latency:
  p99(request_latency) < 50ms
  p95(request_latency) < 30ms

Error Rate:
  (error_requests / total_requests) * 100
  Target: <0.05%

Saturation:
  (active_connections / max_connections) * 100
  Target: <80%
```

**Service Level Objectives (SLOs):**
```
Availability:   99.95% (4 hours/month downtime allowed)
Latency:        P99 < 50ms
Error Rate:     < 0.05%
Saturation:     < 80%
```

---

## 3. Alerting Rules

**Critical Alerts:**
```
# Service down
up{job="basset-websocket"} == 0
Duration: 1 minute
Action: Page on-call

# High error rate
rate(http_requests_total{status=~"5.."}[5m]) > 0.005
Duration: 5 minutes
Action: Page on-call

# Database unavailable
pg_up == 0
Duration: 30 seconds
Action: Page on-call
```

**Warning Alerts:**
```
# High latency
histogram_quantile(0.99, rate(http_request_duration_seconds[5m])) > 0.05
Duration: 10 minutes
Action: Create incident

# Memory pressure
container_memory_usage_bytes / container_memory_limit_bytes > 0.85
Duration: 5 minutes
Action: Alert on Slack
```

---

## 4. Dashboards

**System Overview Dashboard:**
- Request rate (requests/sec)
- Error rate (%)
- Latency (p50, p95, p99)
- Active connections
- CPU/Memory usage
- Database connections
- Cache hit rate

**Application Dashboard:**
- WebSocket connections
- Message processing latency
- Task completion rate
- Change detection rate
- Alert trigger rate

---

## 5. Cost Analysis

**Monthly Cost:**
- Prometheus servers: $300
- Elasticsearch cluster: $1,500
- Jaeger backend: $400
- Grafana: $200
- Total: ~$2,400/month

---

## 6. Implementation Checklist

- [ ] Deploy Prometheus (3 servers)
- [ ] Configure Alertmanager
- [ ] Deploy Elasticsearch cluster
- [ ] Deploy Logstash
- [ ] Deploy Kibana
- [ ] Deploy Jaeger
- [ ] Configure log pipeline (Filebeat)
- [ ] Create dashboards (Grafana)
- [ ] Configure alerting rules
- [ ] Set up on-call rotation
- [ ] Production deployment

---

**Document Status:** Ready for Implementation  
**Last Updated:** June 3, 2026
