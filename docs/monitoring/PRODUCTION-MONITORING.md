# Production Monitoring Setup - v12.0.0 Release

**Document Version:** 1.0  
**Date:** May 11, 2026  
**Purpose:** Monitoring infrastructure for v12.0.0 deployment  
**Monitoring Duration:** Deployment phase (ongoing post-release)

---

## Overview

This document specifies the monitoring setup required for v12.0.0 deployment. Monitoring begins 1 hour before canary deployment and continues through progressive rollout and post-release validation.

**Key Objectives:**
1. Detect anomalies in real-time
2. Compare v12.0.0 vs v11.3.0 performance
3. Enable quick decision-making at each rollout stage
4. Support root cause analysis if rollback is needed

---

## Monitoring Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Monitoring Stack                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Application Metrics                                        │
│  ├─ WebSocket API (latency, throughput, errors)           │
│  ├─ Command execution (success rate, response time)       │
│  ├─ Resource usage (CPU, memory, disk I/O)                │
│  └─ Business metrics (transactions, data volume)          │
│                                                              │
│  ↓ Collection via Prometheus Exporters                     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Prometheus   │  │ Elasticsearch│  │ Grafana      │    │
│  │ (timeseries) │  │ (logs)       │  │ (dashboards) │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│         ↓                  ↓                ↓              │
│  ┌──────────────────────────────────────────────────────┐ │
│  │          AlertManager                                │ │
│  │  ├─ Threshold alerts (error rate, latency)          │ │
│  │  ├─ Anomaly detection (trending issues)             │ │
│  │  └─ Escalation routing (on-call, incident)          │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                              │
│  Notification Channels:                                    │
│  ├─ Slack (#deployments, #incidents)                     │
│  ├─ PagerDuty (critical alerts)                          │
│  ├─ Email (status updates)                               │
│  └─ Dashboard (real-time visibility)                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Metrics to Monitor

### 1. WebSocket API Metrics

**Metric:** WebSocket Connection Health

```yaml
Metric Name: basset_websocket_connections
Type: Gauge
Description: Current active WebSocket connections
Thresholds:
  - Warning: < 1 active connection
  - Critical: 0 connections (service down)
  
Collection:
  docker exec basset-hound-browser curl -s http://localhost:8765/stats | jq '.activeConnections'
```

**Metric:** WebSocket Latency (p50, p95, p99)

```yaml
Metric Name: basset_websocket_latency_ms
Type: Histogram
Labels: [instance, command_type, percentile]
Description: Response time for WebSocket commands
Thresholds:
  - p95 baseline (v11.3.0): [TBD] ms
  - p95 target (v12.0.0): ± 10% of baseline
  - p95 warning: > 1000ms
  - p95 critical: > 2000ms
  
Collection:
  For each command sent:
  - Record send time
  - Record receive time
  - Calculate latency (receive - send)
```

**Metric:** WebSocket Message Throughput

```yaml
Metric Name: basset_websocket_messages_per_second
Type: Counter
Description: Messages sent/received per second
Thresholds:
  - Warning: Drop of > 20% from baseline
  - Critical: Drop of > 50% from baseline
  
Collection:
  docker exec basset-hound-browser curl -s http://localhost:8765/stats | jq '.messagesPerSecond'
```

### 2. Command Execution Metrics

**Metric:** Command Success Rate

```yaml
Metric Name: basset_command_success_rate
Type: Counter
Labels: [instance, command_type, version]
Description: % of commands executed successfully
Thresholds:
  - Target: > 99%
  - Warning: < 99%
  - Critical: < 95%
  
Sample Commands to Monitor:
  - navigate: Baseline must be included
  - click: Baseline must be included
  - fillForm: Baseline must be included
  - screenshot: Baseline must be included
  - executeScript: Baseline must be included
```

**Metric:** Command Response Time

```yaml
Metric Name: basset_command_duration_ms
Type: Histogram
Labels: [instance, command, version]
Description: Time to execute command from request to completion
Baseline (v11.3.0): [TBD] ms per command
Target (v12.0.0): Within 10% of baseline

Commands with high variance to monitor:
  - navigate: Large variation expected
  - screenshot: Large file transfer, high variance
  - executeScript: Variable execution time
```

### 3. Error Metrics

**Metric:** Error Rate

```yaml
Metric Name: basset_errors_total
Type: Counter
Labels: [instance, error_type, severity]
Severity Levels:
  - DEBUG: < 0.1% of traffic
  - INFO: Normal operational info
  - WARNING: Issues that don't affect functionality
  - ERROR: Issues affecting specific operations
  - CRITICAL: Service-level failures

Baseline (v11.3.0):
  - Total error rate: [TBD] %
  - CRITICAL: [TBD] errors/hour
  - ERROR: [TBD] errors/hour

Target (v12.0.0):
  - Total error rate: ≤ baseline
  - CRITICAL: 0 (if possible)
  - ERROR: Within 20% of baseline
```

**Metric:** Error by Type

```yaml
Metric Name: basset_errors_by_type
Type: Counter
Labels: [error_type, instance]
Track:
  - TimeoutError: Requests exceeding deadline
  - ConnectionError: Network issues
  - ParseError: Malformed input
  - ValidationError: Invalid parameters
  - SystemError: Internal application errors
  - OutOfMemoryError: Memory allocation failures
  - DatabaseError: Session store failures
```

### 4. Resource Metrics

**Metric:** CPU Usage

```yaml
Metric Name: basset_cpu_usage_percent
Type: Gauge
Labels: [instance, container]
Thresholds:
  - Normal: < 70%
  - Warning: 70-85%
  - Critical: > 85%

Collection:
  docker stats --no-stream basset-hound-browser | awk '{print $3}'
```

**Metric:** Memory Usage

```yaml
Metric Name: basset_memory_usage_bytes
Type: Gauge
Labels: [instance, container]
Description: Container memory usage in bytes
Thresholds:
  - Normal: < 1.5 GB (60% of 2.5 GB limit)
  - Warning: 1.5-1.9 GB (70-85% of limit)
  - Critical: > 1.9 GB (> 85% of limit)

Collection:
  docker stats --no-stream basset-hound-browser | awk '{print $4}'

Memory Leak Detection:
  - Calculate memory growth rate
  - Warning if > 10% growth per hour
  - Critical if > 20% growth per hour
```

**Metric:** Disk I/O

```yaml
Metric Name: basset_disk_io_bytes_per_second
Type: Gauge
Labels: [instance, direction] # read/write
Thresholds:
  - Normal: < 100 MB/s
  - Warning: 100-200 MB/s
  - Critical: > 200 MB/s

Note: High disk I/O during screenshot capture is expected
```

### 5. Business/Functional Metrics

**Metric:** Transaction Count

```yaml
Metric Name: basset_transactions_total
Type: Counter
Labels: [instance, transaction_type]
Description: Total transactions processed
Baseline (v11.3.0): [TBD] transactions/hour
Target (v12.0.0): ≥ baseline (no degradation)
```

**Metric:** Data Volume

```yaml
Metric Name: basset_data_bytes_transferred
Type: Counter
Labels: [instance, direction] # upload/download
Description: Bytes transferred (screenshots, data extracts)
Baseline (v11.3.0): [TBD] GB/hour
Target (v12.0.0): ≥ baseline
```

**Metric:** Session Duration

```yaml
Metric Name: basset_session_duration_seconds
Type: Histogram
Description: Time from session start to completion
Baseline (v11.3.0): [TBD] seconds (p95)
Target (v12.0.0): Within 10% of baseline
```

---

## Alert Thresholds

### Stage 1: Canary Deployment (4-hour window)

**Critical Alerts (Immediate Rollback)**

```yaml
Alerts:
  - name: CriticalWebSocketDown
    condition: basset_websocket_connections == 0
    duration: 2m
    action: Trigger automatic rollback
    notification: PagerDuty (P1)

  - name: CriticalErrorRate
    condition: rate(basset_errors_total{severity="CRITICAL"}[5m]) > 5 errors/min
    duration: 5m
    action: Trigger automatic rollback
    notification: PagerDuty (P1)

  - name: MemoryLeakDetected
    condition: (basset_memory_usage_bytes - baseline) > baseline * 1.5
    duration: 15m
    action: Trigger automatic rollback
    notification: PagerDuty (P1)
```

**Warning Alerts (Investigation Required)**

```yaml
Alerts:
  - name: HighErrorRate
    condition: basset_errors_total > baseline_error_rate * 1.3
    duration: 10m
    action: Notify team, may require manual rollback
    notification: Slack (#incidents)

  - name: HighLatency
    condition: basset_websocket_latency_ms{percentile="p95"} > baseline_latency * 1.2
    duration: 10m
    action: Notify team, investigate
    notification: Slack (#deployments)

  - name: HighCPU
    condition: basset_cpu_usage_percent > 80
    duration: 5m
    action: Investigate, may indicate resource leak
    notification: Slack (#deployments)
```

### Stage 2 & 3: Progressive Rollout

**Thresholds relax as rollout progresses:**

| Metric | Stage 1 Canary | Stage 2 (25-50%) | Stage 3 (100%) |
|--------|----------------|-----------------|-----------------|
| Error Rate | < 0.5% | < 1.0% | < 1.5% |
| Latency (p95) | ±10% baseline | ±15% baseline | ±20% baseline |
| CPU | < 75% | < 80% | < 85% |
| Memory | < 70% limit | < 75% limit | < 80% limit |

---

## Dashboard Setup

### Grafana Dashboard Configuration

**Dashboard 1: Deployment Overview**

```
┌────────────────────────────────────────────────────────┐
│ v12.0.0 Deployment - Canary                           │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │Instances │  │ Health   │  │ Status   │            │
│  │v12.0.0:1 │  │ 100%     │  │ Running  │            │
│  │v11.3.0:9 │  │ Canary   │  │ Monitoring            │
│  └──────────┘  └──────────┘  └──────────┘            │
│                                                         │
│  Error Rate                    Latency (p95)          │
│  ┌─────────────────────────┐  ┌────────────────────┐ │
│  │ v11.3.0: 0.2%           │  │ v11.3.0: 120ms     │ │
│  │ v12.0.0: 0.3% ↑↓        │  │ v12.0.0: 125ms     │ │
│  │ Threshold: 0.5%         │  │ Threshold: 132ms   │ │
│  └─────────────────────────┘  └────────────────────┘ │
│                                                         │
│  Memory Usage                  CPU Usage              │
│  ┌─────────────────────────┐  ┌────────────────────┐ │
│  │ v12.0.0: 680 MB         │  │ v12.0.0: 42%       │ │
│  │ Threshold: 1900 MB      │  │ Threshold: 75%     │ │
│  └─────────────────────────┘  └────────────────────┘ │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**Queries:**

```promql
# Top left: Error Rate
rate(basset_errors_total[5m]) * 100

# Top right: Latency p95
histogram_quantile(0.95, basset_websocket_latency_ms)

# Memory Usage
basset_memory_usage_bytes / 1e6  # Convert to MB

# CPU Usage
basset_cpu_usage_percent
```

**Dashboard 2: Command Performance**

```
┌────────────────────────────────────────────────────────┐
│ Command Execution Performance                         │
├────────────────────────────────────────────────────────┤
│                                                         │
│  Success Rate by Command                              │
│  ┌──────────────────────────────────────────────────┐ │
│  │ navigate:     99.8% (v12) vs 99.9% (v11)        │ │
│  │ click:        99.5% (v12) vs 99.6% (v11)        │ │
│  │ fillForm:     99.2% (v12) vs 99.3% (v11)        │ │
│  │ screenshot:   98.1% (v12) vs 98.5% (v11)        │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  Response Time by Command (p95)                       │
│  ┌──────────────────────────────────────────────────┐ │
│  │ navigate:     850ms (v12) vs 820ms (v11)        │ │
│  │ click:        150ms (v12) vs 140ms (v11)        │ │
│  │ fillForm:     200ms (v12) vs 190ms (v11)        │ │
│  │ screenshot:   2100ms (v12) vs 2050ms (v11)      │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**Dashboard 3: Instance Health**

```
┌────────────────────────────────────────────────────────┐
│ Instance Health Matrix                               │
├────────────────────────────────────────────────────────┤
│                                                         │
│  basset-prod-01 (v12.0.0 - Canary)                  │
│  Status: ✓ Healthy                                   │
│  Uptime: 4h 12m | Health: 100% | Errors: 8          │
│                                                         │
│  basset-prod-02 through -10 (v11.3.0)               │
│  Status: ✓ Healthy                                   │
│  Uptime: >7d | Health: 100% | Errors: 12            │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

## Incident Response Procedures

### Alert Routing

**PagerDuty Routing:**

```
CRITICAL Severity
├─ WebSocket Down (0 connections)
│  └─ Primary: On-call SRE
│     Escalation (15m): Engineering Manager
├─ CRITICAL Error Rate (> 5 errors/min)
│  └─ Primary: On-call SRE
│     Escalation (10m): Tech Lead
└─ Memory Critical (> 85% limit)
   └─ Primary: On-call SRE
      Escalation (15m): DevOps Lead

WARNING Severity
├─ High Error Rate (> baseline * 1.3)
│  └─ Slack notification only
├─ High Latency (p95 > baseline * 1.2)
│  └─ Slack notification only
└─ Resource Warning (CPU > 80%)
   └─ Slack notification only
```

**Slack Notification Format:**

```
:warning: Alert: High Error Rate Detected
Instance: basset-prod-01 (v12.0.0)
Current: 0.8% | Baseline: 0.3% | Threshold: 0.5%
Duration: 5 minutes

Actions Recommended:
1. Check logs: docker logs basset-hound-browser
2. Verify connectivity: curl http://localhost:8765
3. If critical: Review ROLLBACK-RUNBOOK.md

Related: #incidents #deployments
```

### Investigation Checklist

**For any WARNING alert:**

1. [ ] Check application logs
   ```bash
   docker logs --since 10m basset-hound-browser | grep -i error
   ```

2. [ ] Verify metrics trend
   ```bash
   # Look at last 30 minutes of metric
   curl 'http://prometheus:9090/api/v1/query_range?query=[metric]&start=[30m-ago]&end=now&step=1m'
   ```

3. [ ] Check for external issues
   - [ ] Network connectivity (ping external service)
   - [ ] Dependency service status (database, cache)
   - [ ] Load balancer health checks passing

4. [ ] Review recent changes
   ```bash
   git log --since="24 hours" --oneline | head -10
   ```

5. [ ] Decide on escalation
   - [ ] No action needed (false positive)
   - [ ] Investigate further (create ticket)
   - [ ] Escalate to CRITICAL (trigger procedures)

---

## Log Aggregation & Analysis

### Elasticsearch Configuration

**Index Pattern:** `basset-hound-*.log`

**Parsing Rules:**

```json
{
  "index_pattern": "basset-hound-*",
  "fields": [
    {"name": "timestamp", "type": "date"},
    {"name": "level", "type": "keyword"},
    {"name": "instance", "type": "keyword"},
    {"name": "version", "type": "keyword"},
    {"name": "command", "type": "keyword"},
    {"name": "duration_ms", "type": "long"},
    {"name": "error_message", "type": "text"},
    {"name": "stack_trace", "type": "text"}
  ]
}
```

**Kibana Searches:**

1. **v12.0.0 Errors Only:**
   ```
   version:"v12.0.0" AND level:"ERROR"
   ```

2. **Compare Error Rates:**
   ```
   # v12.0.0 errors
   version:"v12.0.0" AND level:"ERROR" | stats count as v12_errors
   
   # v11.3.0 errors
   version:"v11.3.0" AND level:"ERROR" | stats count as v11_errors
   ```

3. **Command Timing Analysis:**
   ```
   version:"v12.0.0" | stats avg(duration_ms), max(duration_ms), p95(duration_ms) by command
   ```

4. **Error Pattern Detection:**
   ```
   version:"v12.0.0" AND level:"ERROR" | stats count by error_message | sort - count
   ```

---

## Metrics Collection Implementation

### Prometheus Exporter Metrics

**Create custom Prometheus metrics in application:**

```javascript
// websocket/metrics.js
class MetricsCollector {
  constructor() {
    this.metrics = {
      connectionsActive: 0,
      messagesTotal: 0,
      commandsSuccess: 0,
      commandsFailure: 0,
      latencyHistogram: [],
      errorsTotal: {}
    };
  }

  recordCommand(cmd, duration, success) {
    this.messagesTotal++;
    this.latencyHistogram.push(duration);
    
    if (success) {
      this.commandsSuccess++;
    } else {
      this.commandsFailure++;
    }
  }

  recordError(type, severity) {
    if (!this.errorsTotal[type]) {
      this.errorsTotal[type] = 0;
    }
    this.errorsTotal[type]++;
  }

  getPrometheusFormat() {
    return `
# HELP basset_websocket_connections Active WebSocket connections
# TYPE basset_websocket_connections gauge
basset_websocket_connections ${this.connectionsActive}

# HELP basset_messages_total Total messages processed
# TYPE basset_messages_total counter
basset_messages_total ${this.messagesTotal}

# HELP basset_command_success_total Successful commands
# TYPE basset_command_success_total counter
basset_command_success_total ${this.commandsSuccess}

# HELP basset_command_failure_total Failed commands
# TYPE basset_command_failure_total counter
basset_command_failure_total ${this.commandsFailure}

# HELP basset_latency_p95_ms 95th percentile latency
# TYPE basset_latency_p95_ms gauge
basset_latency_p95_ms ${this.percentile95()}
    `;
  }

  percentile95() {
    const sorted = [...this.latencyHistogram].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index] || 0;
  }
}
```

**Expose metrics endpoint:**

```javascript
// websocket/server.js
const metrics = new MetricsCollector();

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(metrics.getPrometheusFormat());
});
```

**Prometheus scrape config:**

```yaml
# /etc/prometheus/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'basset-hound-browser'
    static_configs:
      - targets:
        - 'basset-canary-prod:8765'
        - 'basset-prod-01:8765'
        - 'basset-prod-02:8765'
        # ... add all instances
    metrics_path: '/metrics'
    scrape_interval: 15s
```

---

## Monitoring Checklist

**Before Canary Deployment:**

- [ ] Prometheus configured and scraping
- [ ] Grafana dashboards created
- [ ] AlertManager rules loaded
- [ ] Slack integration tested
- [ ] PagerDuty integration tested
- [ ] Log aggregation pipeline running
- [ ] Baseline metrics captured for v11.3.0
- [ ] On-call contacts verified
- [ ] Runbook links in dashboards
- [ ] Alert test executed (dry run)

**During Deployment:**

- [ ] Dashboard visible to team
- [ ] Alert routing verified
- [ ] All instances reporting metrics
- [ ] Baseline thresholds set correctly
- [ ] Log streaming active
- [ ] Team monitoring in shifts

**Post-Deployment:**

- [ ] Final metrics recorded
- [ ] Anomalies documented
- [ ] Alert accuracy reviewed
- [ ] Dashboards archived
- [ ] Lessons learned captured

---

## Monitoring Validation Test

**Run this before deployment to verify monitoring is working:**

```bash
#!/bin/bash
# monitoring-validation-test.sh

echo "=== Monitoring System Validation ==="

# 1. Prometheus connectivity
echo -n "1. Prometheus: "
curl -s http://prometheus:9090/-/healthy > /dev/null && echo "✓" || echo "✗"

# 2. Grafana connectivity
echo -n "2. Grafana: "
curl -s http://grafana:3000/api/health > /dev/null && echo "✓" || echo "✗"

# 3. AlertManager connectivity
echo -n "3. AlertManager: "
curl -s http://alertmanager:9093/-/healthy > /dev/null && echo "✓" || echo "✗"

# 4. Elasticsearch connectivity
echo -n "4. Elasticsearch: "
curl -s http://elasticsearch:9200/_cluster/health > /dev/null && echo "✓" || echo "✗"

# 5. Test metric scraping
echo -n "5. Metric scraping: "
METRICS_COUNT=$(curl -s http://prometheus:9090/api/v1/query?query=basset_websocket_connections | jq '.data.result | length')
[ "$METRICS_COUNT" -gt 0 ] && echo "✓ ($METRICS_COUNT active)" || echo "✗"

# 6. Test alert firing
echo -n "6. Alert rules loaded: "
ALERTS=$(curl -s http://alertmanager:9093/api/v1/alerts | jq '.data | length')
[ "$ALERTS" -gt 0 ] && echo "✓ ($ALERTS alerts)" || echo "✗"

# 7. Test Slack integration
echo -n "7. Slack integration: "
curl -s -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -d '{"text":"Monitoring validation test"}' > /dev/null && echo "✓" || echo "✗"

echo ""
echo "=== Validation Complete ==="
```

---

## Appendix: Useful Queries

**PromQL for common investigations:**

```promql
# Error rate last 30 minutes
rate(basset_errors_total[30m]) * 100

# Compare versions
(rate(basset_errors_total{version="v12.0.0"}[5m]) / rate(basset_errors_total{version="v11.3.0"}[5m])) * 100

# Memory trend
increase(basset_memory_usage_bytes[1h])

# Command latency percentiles
histogram_quantile(0.50, basset_command_duration_ms)
histogram_quantile(0.95, basset_command_duration_ms)
histogram_quantile(0.99, basset_command_duration_ms)

# Success rate by command
rate(basset_command_success_total[5m]) / (rate(basset_command_success_total[5m]) + rate(basset_command_failure_total[5m]))
```

---

**End of Production Monitoring Setup**
