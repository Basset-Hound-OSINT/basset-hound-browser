# MONITORING RUNBOOK
**Basset Hound Browser v12.7.0**  
**Last Updated**: June 21, 2026  
**Status**: Production Ready

---

## Table of Contents
1. [Overview](#overview)
2. [Monitoring Infrastructure](#monitoring-infrastructure)
3. [Accessing Dashboards](#accessing-dashboards)
4. [Key Metrics](#key-metrics)
5. [Understanding Alerts](#understanding-alerts)
6. [Alert Response Guide](#alert-response-guide)
7. [SLO and SLA Definitions](#slo-and-sla-definitions)
8. [Custom Dashboards](#custom-dashboards)

---

## Overview

Monitoring provides visibility into system health, performance, and operational status.

**Monitoring Stack Components**:
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing and notification
- **Docker Stats**: Container-level metrics
- **Kubernetes Metrics Server**: Pod-level metrics

**Monitoring Goals**:
- Detect issues before user impact
- Enable data-driven scaling decisions
- Validate SLO/SLA compliance
- Support root cause analysis

---

## Monitoring Infrastructure

### Prometheus Setup

**Location**: Runs on port 9090 (if enabled)

```bash
# Check if Prometheus running
docker ps | grep prometheus

# Or in Kubernetes
kubectl get deployment -n monitoring | grep prometheus

# Access Prometheus UI
http://localhost:9090
```

**Configuration**:
```yaml
# Scrape interval
scrape_interval: 15s
evaluation_interval: 15s

# Targets
scrape_configs:
  - job_name: 'basset-hound-browser'
    static_configs:
      - targets: ['localhost:8765']
```

**Metrics Available**:
- websocket_connections_total
- websocket_connections_active
- command_duration_seconds
- command_errors_total
- memory_usage_bytes
- cpu_usage_percent

### Grafana Setup

**Location**: Typically port 3000

```bash
# Access Grafana
http://localhost:3000
# Default credentials: admin/admin (change in production)

# Add Prometheus data source
# Settings → Data Sources → Add Prometheus
# URL: http://localhost:9090
```

**Pre-built Dashboards**:
- Basset Hound Browser Overview
- Performance Metrics
- Container Health
- WebSocket Connections

### Docker Stats

Available without additional setup:

```bash
# Real-time stats
docker stats basset-hound-browser

# One-time snapshot
docker stats basset-hound-browser --no-stream

# Output includes:
# - CPU %: CPU usage percentage
# - MEM USAGE / LIMIT: Memory used / allocated
# - NET I/O: Network in/out
# - BLOCK I/O: Disk read/write
# - PIDS: Process count
```

### Kubernetes Metrics

Requires metrics-server:

```bash
# Check metrics-server installed
kubectl get deployment metrics-server -n kube-system

# View pod metrics
kubectl top pods -n basset-hound

# View node metrics
kubectl top nodes

# Example output:
# NAME                              CPU(m)   MEMORY(Mi)
# basset-hound-browser-12345-abc12  150m     512Mi
# basset-hound-browser-12345-def45  120m     480Mi
```

---

## Accessing Dashboards

### Grafana Dashboard Access

#### Method 1: Local Browser

```bash
# If running locally
http://localhost:3000

# Login
# Username: admin
# Password: <configured-password>
```

#### Method 2: Port Forward (Remote K8s)

```bash
# Port forward to local
kubectl port-forward -n monitoring svc/grafana 3000:80 &

# Access locally
http://localhost:3000
```

#### Method 3: Ingress/LoadBalancer (Production)

```bash
# Get external IP
kubectl get svc -n monitoring | grep grafana

# Access via DNS
http://grafana.basset-hound.example.com
```

### Default Dashboards

| Dashboard | Purpose | Key Panels |
|-----------|---------|-----------|
| Overview | System health | Container status, memory, CPU |
| Performance | Response time | Latency, throughput, errors |
| WebSocket | Connection metrics | Active connections, message rate |
| Container | Docker metrics | Memory trend, CPU trend, disk I/O |
| Kubernetes | Pod metrics | Resource usage, pod events |

### Creating Custom Dashboard

1. **Click "+" → Dashboard**
2. **Click "Add Panel"**
3. **Configure panel**:
   - Data source: Prometheus
   - Metrics: Select from dropdown
   - Visualization: Choose type (graph, gauge, etc)
4. **Set thresholds**:
   - Green: < 50%
   - Yellow: 50-70%
   - Red: > 70%
5. **Save**

---

## Key Metrics

### Application Metrics

#### WebSocket Connections

| Metric | Threshold | Action |
|--------|-----------|--------|
| Active connections | > 200 | Monitor scaling |
| Connection errors | > 1% of total | Investigate |
| Connection duration | > 5 minutes | Normal for long-lived |
| Failed handshakes | > 10/minute | Check firewall/security |

**Monitor**:
```bash
# Prometheus query
websocket_connections_active

# Docker stats
docker stats basset-hound-browser | grep -i "connections"
```

#### Command Performance

| Metric | Target | Alert if |
|--------|--------|----------|
| Command duration P50 | < 50ms | > 100ms |
| Command duration P95 | < 100ms | > 200ms |
| Command duration P99 | < 500ms | > 1000ms |
| Command error rate | < 1% | > 2% |

**Monitor**:
```bash
# Prometheus query
histogram_quantile(0.95, command_duration_seconds_bucket)

# Check in logs
docker logs basset-hound-browser | grep "duration"
```

### Infrastructure Metrics

#### CPU Usage

| Level | Status | Action |
|-------|--------|--------|
| < 20% | Healthy | None |
| 20-50% | Good | Monitor |
| 50-70% | Caution | Prepare to scale |
| > 70% | Alert | Scale immediately |

**Monitor**:
```bash
# Docker
docker stats basset-hound-browser --no-stream | awk '{print $3}'

# Kubernetes
kubectl top pods -n basset-hound

# Prometheus
100 * (1 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))))
```

#### Memory Usage

| Level | Status | Action |
|-------|--------|--------|
| < 50% | Healthy | None |
| 50-75% | Good | Monitor |
| 75-85% | Caution | Check for leaks |
| > 85% | Alert | Restart immediately |

**Monitor**:
```bash
# Docker
docker stats basset-hound-browser --no-stream | grep -o "[0-9.]*%" | head -1

# Kubernetes
kubectl top pods -n basset-hound

# Prometheus
100 * (container_memory_usage_bytes / container_spec_memory_limit_bytes)
```

#### Disk Usage

| Level | Status | Action |
|-------|--------|--------|
| < 70% | Healthy | None |
| 70-85% | Good | Plan cleanup |
| 85-90% | Caution | Cleanup soon |
| > 90% | Alert | Cleanup immediately |

**Monitor**:
```bash
# Host disk
df -h / | tail -1 | awk '{print $5}'

# Container volumes
docker exec basset-hound-browser df -h /app

# Prometheus
100 * (node_filesystem_avail_bytes / node_filesystem_size_bytes)
```

#### Network I/O

| Metric | Healthy | Caution | Alert |
|--------|---------|---------|-------|
| Inbound | < 1MB/s | 1-5MB/s | > 5MB/s |
| Outbound | < 1MB/s | 1-5MB/s | > 5MB/s |
| Dropped packets | 0 | < 1/min | > 1/min |

**Monitor**:
```bash
# Docker stats includes NET I/O
docker stats basset-hound-browser --no-stream

# Kubernetes network
kubectl exec -it <pod-name> -n basset-hound -- \
  netstat -i | tail -1
```

---

## Understanding Alerts

### Alert Types

#### Severity Levels

- **Critical (P1)**: Service unavailable, data loss risk
- **High (P2)**: Degraded service, performance impact
- **Medium (P3)**: Operational issue, no user impact yet
- **Low (P4)**: Informational, should monitor

### Common Alerts

| Alert | Cause | Action |
|-------|-------|--------|
| HighMemoryUsage | Memory leak or burst | See Troubleshooting Issue 2 |
| HighCPUUsage | Slow operation | See Troubleshooting Issue 4 |
| HighDiskUsage | Log/cache buildup | Clean old files |
| WebSocketDown | Connection issues | Check port/firewall |
| HighErrorRate | Application bug | Review logs |
| PodCrashing | Insufficient resources | Increase limits or scale |
| HighLatency | System overload | Scale horizontally |

### Alert Configuration

**Prometheus Alert Rules** (prometheus-alerts.yaml):

```yaml
groups:
  - name: basset-hound
    interval: 30s
    rules:
      - alert: HighMemoryUsage
        expr: |
          (container_memory_usage_bytes{name="basset-hound-browser"} 
           / container_spec_memory_limit_bytes) > 0.85
        for: 5m
        annotations:
          summary: "High memory usage on {{ $labels.instance }}"
          
      - alert: HighCPUUsage
        expr: |
          (rate(container_cpu_usage_seconds_total{name="basset-hound-browser"}[5m])) > 0.7
        for: 5m
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
```

---

## Alert Response Guide

### Alert: Service Down (Critical)

**Triggers**: Health check failing, no WebSocket connections

**Response Steps** (15 min SLA):

1. **Verify problem** (1 min):
   ```bash
   curl http://localhost:8765/health
   docker ps | grep basset-hound
   ```

2. **Check logs** (2 min):
   ```bash
   docker logs basset-hound-browser | tail -50
   ```

3. **Try restart** (3 min):
   ```bash
   docker-compose restart basset-hound-browser
   sleep 10
   curl http://localhost:8765/health
   ```

4. **If restart fails** (5 min):
   - See [Troubleshooting Issue 1](./RUNBOOK-TROUBLESHOOTING.md#issue-1-container-wont-start)
   - Escalate to senior engineer if unresolved

5. **Document & notify** (1 min):
   - Update status page
   - Notify stakeholders
   - Create incident

---

### Alert: High Memory Usage (High)

**Triggers**: Memory > 80% for 5 minutes

**Response Steps** (30 min SLA):

1. **Assess** (2 min):
   ```bash
   docker stats basset-hound-browser --no-stream
   curl http://localhost:8765/health
   ```

2. **Quick fix** (5 min):
   ```bash
   # Restart to free memory
   docker restart basset-hound-browser
   sleep 10
   docker stats basset-hound-browser --no-stream
   ```

3. **If still high** (10 min):
   - Check for memory leaks: See [Troubleshooting Issue 2](./RUNBOOK-TROUBLESHOOTING.md#issue-2-high-memory-usage)
   - Scale horizontally if application healthy
   - Increase memory allocation if OK

4. **Monitor** (next 30 min):
   ```bash
   watch -n 5 'docker stats basset-hound-browser --no-stream'
   ```

---

### Alert: High CPU Usage (High)

**Triggers**: CPU > 70% for 5 minutes

**Response Steps** (30 min SLA):

1. **Identify problem** (5 min):
   ```bash
   docker top basset-hound-browser
   docker logs basset-hound-browser | grep -i "slow\|timeout"
   ```

2. **Check current load** (2 min):
   ```bash
   curl -s http://localhost:8765/metrics | grep websocket_connections
   ```

3. **Options**:

   **A. Scale horizontally** (if connections high):
   ```bash
   kubectl scale deployment basset-hound-browser --replicas=5 -n basset-hound
   ```

   **B. Optimize configuration** (if single slow operation):
   ```bash
   # Reduce concurrent operations
   docker exec basset-hound-browser export MAX_CONCURRENT=10
   docker restart basset-hound-browser
   ```

   **C. Investigate slow query** (if database):
   - See [Troubleshooting Issue 7](./RUNBOOK-TROUBLESHOOTING.md#issue-7-slow-response-times)

---

### Alert: Disk Usage High (Medium)

**Triggers**: Disk > 85% for 10 minutes

**Response Steps** (1 hour SLA):

1. **Identify cause** (5 min):
   ```bash
   docker exec basset-hound-browser du -sh /app/*
   ```

2. **Clean old data** (10 min):
   ```bash
   # Remove old logs
   docker exec basset-hound-browser find /app/logs -mtime +30 -delete
   
   # Remove old screenshots
   docker exec basset-hound-browser find /app/screenshots -mtime +30 -delete
   
   # Clean cache
   docker exec basset-hound-browser rm -rf /app/cache/*
   ```

3. **Verify cleanup** (2 min):
   ```bash
   df -h /
   docker exec basset-hound-browser du -sh /app
   ```

4. **If still high** (20 min):
   - Add more storage
   - Implement more aggressive retention policy
   - Archive to external storage

---

### Alert: Error Rate High (Medium)

**Triggers**: Error rate > 2% for 5 minutes

**Response Steps** (30 min SLA):

1. **Analyze errors** (5 min):
   ```bash
   docker logs basset-hound-browser | grep -i "error" | tail -20
   
   # Get error distribution
   docker logs basset-hound-browser | grep "error" | \
     cut -d: -f3 | sort | uniq -c | sort -rn
   ```

2. **Check recent changes** (5 min):
   ```bash
   git log --oneline -10
   git diff HEAD~1 Dockerfile
   ```

3. **Response options**:

   **A. Known issue with workaround**:
   - Apply workaround
   - Monitor resolution

   **B. Unknown issue**:
   - Check dependencies for updates
   - Investigate root cause
   - Consider rollback if recent deployment

---

## SLO and SLA Definitions

### Service Level Objectives (SLOs)

**Availability SLO**: 99.5% (allows 3.6 hours downtime/month)

```
Target: Service responds to 99.5% of requests
Measurement: Successful HTTP responses / total requests
```

**Latency SLO**: P95 latency < 100ms

```
Target: 95th percentile response time < 100ms
Measurement: Histogram of response times
```

**Error Rate SLO**: < 1% of requests fail

```
Target: Less than 1% of requests result in error
Measurement: Failed requests / total requests
```

### Service Level Agreements (SLAs)

| SLA | Target | Penalty |
|-----|--------|---------|
| Availability | 99.5% | 10% credit for 99-99.5% |
| | | 25% credit for < 99% |
| Latency | P95 < 100ms | 5% credit if violated |
| Support Response | P1: 1 hour | 10% credit if missed |

### SLO Tracking

**Dashboard**: `/grafana/dashboards/slo`

```
Availability this month: 99.87%
  Incidents: 1 (45 min outage)
  Error budget remaining: 2.7 hours

Latency this month: P95 = 78ms ✓
  All weeks within target
  
Error rate this month: 0.3% ✓
  Peak: 0.8% on June 15
```

---

## Custom Dashboards

### Creating SLA Dashboard

1. **Create new dashboard**
2. **Add panels**:

   **Panel 1: Availability %**
   ```
   Query: 100 - (sum(increase(http_requests_total{status=~"5.."}[30d])) / 
                sum(increase(http_requests_total[30d])) * 100)
   ```

   **Panel 2: Error Budget Remaining**
   ```
   Query: (1 - target_slo) * total_seconds_in_month - actual_downtime
   ```

   **Panel 3: Latency Trend**
   ```
   Query: histogram_quantile(0.95, request_duration_seconds_bucket)
   ```

3. **Set alert thresholds**:
   - Green: > 99.5% availability
   - Yellow: 99.0-99.5%
   - Red: < 99.0%

### Creating Operational Dashboard

1. **Resource Usage Panel**:
   ```
   Graphs:
   - CPU usage (top subplot)
   - Memory usage (bottom subplot)
   Range: Last 24 hours
   ```

2. **Error Tracking**:
   ```
   Graph: Error count by type
   Table: Top 10 error messages
   ```

3. **Connection Health**:
   ```
   Gauge: Active connections
   Graph: Connection count over time
   Table: Connection duration statistics
   ```

---

## Monitoring Best Practices

### Data Retention

- **Prometheus**: 15 days (configure in prometheus.yml)
- **Grafana**: Depends on data source
- **Docker logs**: 10 files x 10MB each (automatic rotation)
- **Kubernetes logs**: Depends on node storage (typical 2 weeks)

**Extend retention if needed**:

```yaml
# prometheus.yml
storage:
  retention:
    time: 30d    # Keep 30 days
    size: 50GB   # Or until 50GB
```

### Alert Fatigue Prevention

- Avoid over-alerting on minor issues
- Use meaningful thresholds based on data
- Implement alert escalation (not all alerts to Slack)
- Review and tune alerts monthly

### Monitoring Costs

Monitor resource usage of monitoring itself:

```bash
# Prometheus memory
docker stats prometheus --no-stream | awk '{print $6}'

# Grafana memory
docker stats grafana --no-stream | awk '{print $6}'

# Total monitoring overhead should be < 10% of app resources
```

---

## Related Documentation

- [Deployment Runbook](./RUNBOOK-DEPLOYMENT.md)
- [Scaling Runbook](./RUNBOOK-SCALING.md)
- [Troubleshooting Runbook](./RUNBOOK-TROUBLESHOOTING.md)
- [Infrastructure README](../infrastructure/README.md)
