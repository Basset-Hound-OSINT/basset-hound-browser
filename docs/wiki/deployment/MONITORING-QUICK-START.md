# V12.9.0 Monitoring - Quick Start Guide

**Setup time:** 15 minutes (docker-compose) or 45 minutes (full stack)

---

## 30-Second Overview

**Basset Hound Browser v12.9.0** includes:

- ✅ **3 Grafana Dashboards** - Real-time operations, command performance, system health
- ✅ **60+ Prometheus Metrics** - WebSocket, commands, system, health
- ✅ **40+ Alert Rules** - CRITICAL & WARNING levels for all SLOs
- ✅ **Complete Logging** - JSON structured logs with rotation
- ✅ **Health Checks** - HTTP endpoint + heartbeat monitoring
- ✅ **Runbooks** - Step-by-step incident response procedures

---

## Quick Start (Docker Compose)

### 1. Copy Docker Compose (5 minutes)

```bash
cd /home/devel/basset-hound-browser

# Add monitoring services to docker-compose.yml
cat >> docker-compose.yml << 'EOF'

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./config/prometheus:/etc/prometheus
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
    networks:
      - basset-net

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-storage:/var/lib/grafana
    networks:
      - basset-net

  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./config/alertmanager:/etc/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
    networks:
      - basset-net

volumes:
  prometheus-data:
  grafana-storage:
EOF
```

### 2. Create Prometheus Config (2 minutes)

```bash
mkdir -p /config/prometheus

cat > /config/prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'basset-hound-browser'
    static_configs:
      - targets: ['localhost:8765']
    metrics_path: '/metrics'

rule_files:
  - '/config/prometheus/alert-rules-v12.9.0.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']
EOF
```

### 3. Copy Alert Rules (1 minute)

```bash
cp config/prometheus/alert-rules-v12.9.0.yml /config/prometheus/
```

### 4. Start Services (2 minutes)

```bash
docker-compose up -d prometheus grafana alertmanager basset-hound-browser

# Wait for startup
sleep 30

# Verify services running
docker-compose ps
```

### 5. Access Dashboards (5 minutes)

| Service | URL | Credentials |
|---------|-----|-------------|
| **Grafana** | http://localhost:3000 | admin / admin |
| **Prometheus** | http://localhost:9090 | (no auth) |
| **Alert Manager** | http://localhost:9093 | (no auth) |
| **Metrics** | http://localhost:8765/metrics | (Prometheus format) |

---

## What's Being Monitored?

### Availability SLO (99.9%)
```
✓ Health check status
✓ Container restarts
✓ Process uptime
✓ Connection success rate
```

### Latency SLO (P95 < 100ms)
```
✓ P50/P95/P99 latencies
✓ Command-specific latencies
✓ Latency spikes
```

### Throughput SLO (≥100 msg/sec)
```
✓ Messages/second rate
✓ Request queue depth
✓ Message drop detection
```

### Error Rate SLO (<0.1%)
```
✓ Command error rate
✓ Connection errors
✓ Message validation errors
```

### Resource Utilization
```
✓ Heap memory usage (warn: 75%, crit: 90%)
✓ CPU load average
✓ System memory
✓ Active connections
```

---

## Key Dashboards

### 1. Operations Dashboard
**URL:** http://grafana:3000/d/basset-operations

**Shows:**
- Service health status
- Throughput (msg/sec)
- Latency percentiles (P50, P95, P99)
- Error rate
- Memory usage
- Active connections
- Heartbeat status

**Use case:** On-call engineer at a glance

### 2. Command Performance Dashboard
**URL:** http://grafana:3000/d/basset-command-perf

**Shows:**
- Top commands by execution count
- Command-specific latencies (P50, P95, P99)
- Command error rates
- Performance trends

**Use case:** Performance engineers debugging slow commands

### 3. System Health Dashboard
**URL:** http://grafana:3000/d/basset-system-health

**Shows:**
- System load average
- CPU cores
- Memory distribution
- Heap usage timeline
- Process uptime
- Health check timeline
- Heartbeat misses

**Use case:** SRE team capacity planning

---

## Alert Examples

### CRITICAL Alerts (Immediate Action)

```
ServiceUnavailable
→ Service down for >1 minute
→ Response: Check logs, restart container

P99LatencyExceeded
→ P99 latency > 600ms for >2 minutes
→ Response: Check dashboards, scale resources

CriticalErrorRate
→ Error rate > 0.5% for >1 minute
→ Response: Investigate command errors

CriticalMemoryUsage
→ Heap > 90% for >2 minutes
→ Response: Increase memory, investigate leaks

MessageDropDetected
→ 5+ message drops in 5 minutes
→ Response: Check WebSocket stability
```

### WARNING Alerts (Monitor)

```
P95LatencyExceeded
→ P95 latency > 150ms for >3 minutes
→ Response: Monitor closely, plan optimization

HighMemoryUsage
→ Heap 75-90% for >3 minutes
→ Response: Track growth, prepare scaling

ThroughputBelowMinimum
→ Throughput < 100 msg/sec for >5 minutes
→ Response: Check queue depth, consider scaling

HighActiveConnections
→ >200 active connections for >3 minutes
→ Response: Review connection usage patterns
```

---

## Common Queries

### Check if service is healthy
```bash
curl http://localhost:8765/api/diagnostics
```

### Get all metrics
```bash
curl http://localhost:8765/metrics | head -20
```

### Check current throughput (Prometheus)
```promql
rate(basset_websocket_messages_sent_total[1m])
```

### Check P95 latency
```promql
histogram_quantile(0.95, rate(basset_command_duration_ms[5m]))
```

### Check error rate
```promql
rate(basset_command_errors_total[5m]) / rate(basset_command_executions_total[5m])
```

### Check memory usage %
```promql
basset_process_heap_used_bytes / basset_process_heap_total_bytes * 100
```

---

## Alerting Setup

### 1. Slack Notifications

Edit `docker-compose.yml` to add alert manager config:

```yaml
environment:
  - SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
  - PAGERDUTY_SERVICE_KEY=your-pagerduty-key
```

### 2. Custom Notification Destinations

Edit `/config/alertmanager/alertmanager.yml`:

```yaml
receivers:
  - name: 'critical'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_SERVICE_KEY}'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#basset-critical'
```

---

## Troubleshooting

### Prometheus not scraping metrics
```bash
# Check Prometheus health
curl http://localhost:9090/-/healthy

# Verify basset-hound is exposing metrics
curl http://localhost:8765/metrics | head -20

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets
```

### Grafana not showing data
```bash
# Verify Prometheus datasource
curl http://localhost:9090/api/v1/query?query=up

# Check Grafana logs
docker logs grafana
```

### Alerts not firing
```bash
# Check alert manager
curl http://localhost:9093/api/v1/status

# Verify alert rules loaded
curl http://localhost:9090/api/v1/rules

# Check alert manager config
curl http://localhost:9093/api/v1/alerts
```

---

## Performance Baseline (v12.9.0)

**Under normal load (50 concurrent connections):**

| Metric | Baseline | Warning | Critical |
|--------|----------|---------|----------|
| Throughput | 481+ msg/sec | <400 | <250 |
| P95 Latency | 100ms | >150ms | >300ms |
| P99 Latency | 200ms | >350ms | >600ms |
| Memory (Heap) | 350-400MB | >1.2GB | >1.5GB |
| CPU | 18% | >40% | >60% |
| Error Rate | <0.01% | >0.05% | >0.1% |

---

## Advanced Configuration

### Log Aggregation (ELK Stack)

```bash
# Start Elasticsearch
docker run -d \
  --name elasticsearch \
  --network basset-hound-browser \
  -e discovery.type=single-node \
  -p 9200:9200 \
  docker.elastic.co/elasticsearch/elasticsearch:8.0.0

# Start Kibana
docker run -d \
  --name kibana \
  --network basset-hound-browser \
  -p 5601:5601 \
  docker.elastic.co/kibana/kibana:8.0.0
```

**Access Kibana:** http://localhost:5601

### Custom Retention

```yaml
# prometheus.yml
global:
  # Keep 90 days of data instead of 30
  storage:
    tsdb:
      retention:
        time: 90d
```

---

## See Also

- **[V12.9.0-MONITORING.md](V12.9.0-MONITORING.md)** - Full monitoring guide with all details
- **[V12.9.0-DEPLOYMENT-PROCEDURES.md](V12.9.0-DEPLOYMENT-PROCEDURES.md)** - Deployment runbook
- **[PERFORMANCE-TUNING.md](PERFORMANCE-TUNING.md)** - Optimization guide

---

**Setup Complete!** 🎉

Your monitoring stack is now running. Check the dashboards at http://localhost:3000
