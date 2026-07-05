# Deployment Automation Guide - Basset Hound Browser

**Version:** 1.0  
**Date:** June 21, 2026  
**Status:** Ready for Production  
**Audience:** DevOps Engineers, Release Managers, On-Call Engineers

---

## Quick Start (5 minutes)

### 1. Setup Monitoring (One-time)

```bash
cd /home/devel/basset-hound-browser

# Configure health checks, metrics, and alerts
./scripts/setup-deployment-monitoring.sh

# Start metrics collection
./scripts/start-deployment-monitoring.sh

# Verify monitoring is working
tail -f logs/metrics/deployment-metrics-*.jsonl
```

### 2. Execute Progressive Deployment

```bash
# Phase 0: Deploy canary (5% traffic)
./scripts/deploy-canary.sh 12.8.0

# Wait for approval prompt, review metrics, type "APPROVE"
# Expected time: 10 minutes

# Phase 1: Scale to 25%
./scripts/deploy-scale.sh 12.8.0 25

# Phase 2: Scale to 50%
./scripts/deploy-scale.sh 12.8.0 50

# Phase 3: Full deployment (100%)
./scripts/deploy-scale.sh 12.8.0 100

# Total deployment time: ~35 minutes
```

### 3. If Issues Occur - Instant Rollback

```bash
# Emergency rollback to previous version
./scripts/rollback.sh 12.7.0

# Type "ROLLBACK" to confirm
# Expected time: 5 minutes to restore service
```

---

## Directory Structure

```
basset-hound-browser/
├── scripts/
│   ├── deploy-canary.sh                    # Canary deployment (5%)
│   ├── deploy-scale.sh                     # Scaled deployment (25%, 50%, 100%)
│   ├── rollback.sh                         # Emergency rollback
│   ├── setup-deployment-monitoring.sh      # Monitoring configuration
│   └── start-deployment-monitoring.sh      # Start metrics collection
│
├── config/
│   └── monitoring/
│       ├── health-checks.json              # Health probe configuration
│       ├── metrics.json                    # Metrics collection config
│       └── dashboard.md                    # Monitoring dashboard
│
├── config/
│   └── alerts/
│       ├── thresholds.json                 # Alert thresholds
│       └── notifications.json              # Notification channels
│
├── logs/
│   ├── deployment/                         # Deployment logs
│   ├── metrics/                            # Metrics collection
│   ├── monitoring/                         # Monitoring logs
│   └── alerts.log                          # Alert log
│
└── docs/deployment/
    ├── DEPLOYMENT-AUTOMATION-RUNBOOK.md    # Step-by-step procedures
    ├── COMMUNICATION-TEMPLATES.md          # Notification templates
    └── DEPLOYMENT-AUTOMATION-GUIDE.md      # This file
```

---

## Component Overview

### 1. Deployment Scripts

#### `deploy-canary.sh` - Canary Deployment (5% Traffic)

**Purpose:** Test new version with minimal risk

**Features:**
- Validates prerequisites (Docker, network, image)
- Captures baseline metrics
- Deploys single canary instance
- Health checks with automatic retry
- Metrics collection for 5 minutes
- Threshold validation
- Generates deployment report
- Interactive approval checkpoint

**Usage:**
```bash
./scripts/deploy-canary.sh [VERSION]
./scripts/deploy-canary.sh 12.8.0
```

**Output:**
- Log: `logs/deployment/canary-12.8.0-*.log`
- Metrics: `logs/deployment/canary-metrics-12.8.0.jsonl`
- Report: `logs/deployment/canary-report-12.8.0.md`
- State: `logs/deployment/canary-state.json`

**Success Criteria:**
- Container running
- Health checks passing
- Error rate < 1%
- Memory < 80%
- Team approval obtained

---

#### `deploy-scale.sh` - Scaled Deployment (25%, 50%, 100%)

**Purpose:** Progressive rollout to larger percentages of instances

**Features:**
- Verifies canary approval
- Calculates instance count for target percentage
- Deploys additional instances
- Health checks across all instances
- Aggregated metrics collection
- Cluster validation
- Phase completion checkpoint

**Usage:**
```bash
./scripts/deploy-scale.sh [VERSION] [PERCENTAGE]
./scripts/deploy-scale.sh 12.8.0 25    # Phase 1
./scripts/deploy-scale.sh 12.8.0 50    # Phase 2
./scripts/deploy-scale.sh 12.8.0 100   # Phase 3
```

**Instance Distribution:**
- Canary: 1 instance (5%)
- Phase 1: 2 instances (25%)
- Phase 2: 4 instances (50%)
- Phase 3: 10 instances (100%)

**Output:**
- Log: `logs/deployment/scale-12.8.0-XYpct-*.log`
- Metrics: `logs/deployment/scale-metrics-12.8.0-XYpct.jsonl`
- Report: `logs/deployment/scale-report-12.8.0-XYpct.md`

---

#### `rollback.sh` - Emergency Rollback

**Purpose:** Instantly revert to previous version

**Features:**
- Confirmation checkpoint (type: ROLLBACK)
- Identifies running versions
- Stops new version containers
- Restarts previous version
- Health check verification
- Load balancer configuration update
- Failed deployment archival
- Incident report generation

**Usage:**
```bash
./scripts/rollback.sh [PREVIOUS_VERSION]
./scripts/rollback.sh 12.7.0
```

**Rollback Triggers (Automatic Detection):**
- Container fails to start
- Health checks fail > 2 times
- Error rate > 5%
- Memory usage > 85%
- Team/on-call requests rollback

**Output:**
- Log: `logs/deployment/rollback-*.log`
- State: `logs/deployment/rollback-state.json`
- Report: `logs/deployment/rollback-report-*.md`
- Archive: `logs/deployment/failed-rollouts/`

---

### 2. Monitoring Setup

#### `setup-deployment-monitoring.sh` - Configuration

**Purpose:** Initialize monitoring infrastructure

**Creates:**
- Health check configurations
- Metrics collection setup
- Alert threshold definitions
- Notification channel config
- Health check endpoints
- Metrics collector script
- Monitoring dashboard template

**Usage:**
```bash
./scripts/setup-deployment-monitoring.sh
```

**Configuration Files Generated:**
```
config/monitoring/
├── health-checks.json      # Liveness, readiness, health probes
├── metrics.json            # System, application, deployment metrics
└── dashboard.md            # Monitoring dashboard template

config/alerts/
├── thresholds.json         # Warning and critical thresholds
└── notifications.json      # Email, Slack, PagerDuty config
```

---

### 3. Health Check Probes

**Liveness Probe** (`/alive`)
- Checks if process is alive
- Used by orchestrators for restart decisions
- Interval: 10 seconds
- Timeout: 5 seconds

```bash
curl http://localhost:8765/alive
# Response: {"status": "alive", "timestamp": "2026-06-21T10:00:00Z"}
```

**Readiness Probe** (`/ready`)
- Checks if service accepts traffic
- Used by load balancers for routing decisions
- Interval: 15 seconds
- Timeout: 5 seconds

```bash
curl http://localhost:8765/ready
# Response: {"ready": true, "timestamp": "2026-06-21T10:00:00Z"}
```

**Health Status** (`/health`)
- Overall service health
- Includes dependency checks
- Interval: 30 seconds
- Timeout: 10 seconds

```bash
curl http://localhost:8765/health
# Response: {
#   "status": "healthy",
#   "checks": {
#     "websocket_server": "ok",
#     "browser": "ok",
#     "memory_usage": "ok",
#     "cpu_usage": "ok",
#     "error_rate": "ok"
#   },
#   "timestamp": "2026-06-21T10:00:00Z"
# }
```

---

### 4. Metrics Collection

**System Metrics (15-second interval):**
- CPU percent
- Memory percent (MB and %)
- Disk usage
- Open connections

**Application Metrics (30-second interval):**
- WebSocket connections
- WebSocket throughput (msg/sec)
- Request count
- Request latency (P50, P95, P99)
- Error count & rate

**Deployment Metrics (60-second interval):**
- Container count
- Healthy container count
- Instance availability %
- Deployment progress %

**Storage:**
- Format: JSONL (JSON Lines)
- Path: `logs/metrics/deployment-metrics-*.jsonl`
- Retention: 7 days (configurable)
- Compression: Enabled

**Example Metric Entry:**
```json
{
  "timestamp": "2026-06-21T10:00:30Z",
  "containers_running": 2,
  "containers_healthy": 2,
  "memory_percent": 48,
  "cpu_percent": 12,
  "ws_connections": 145,
  "error_rate": 0.05
}
```

---

### 5. Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Memory | 70% | 85% | Warn / Scale up |
| CPU | 60% | 80% | Warn / Scale up |
| Error Rate | 1% | 5% | Investigate / Rollback |
| Latency P99 | 500ms | 2000ms | Monitor / Investigate |
| Healthy Instances | 80% | 75% | Replace / Rollback |

**Alert Actions:**
- **Warning:** Log + Notify (email, Slack)
- **Critical:** Log + Notify + Escalate (PagerDuty)
- **Auto-escalation:** 5 minutes for critical alerts

---

## Deployment Procedures

### Pre-Deployment Checklist

- [ ] New Docker image built and available
- [ ] Previous version known (for rollback)
- [ ] Team notified of deployment window
- [ ] On-call engineer ready
- [ ] Monitoring setup complete
- [ ] Communication channels open
- [ ] Disk space verified (> 10GB)

### Phase 0: Canary (5%)

```bash
# Execute canary deployment
./scripts/deploy-canary.sh 12.8.0

# Monitor for 5 minutes
# Review metrics in logs/deployment/canary-metrics-12.8.0.jsonl
# View report in logs/deployment/canary-report-12.8.0.md

# At approval prompt:
# - Review all metrics
# - Check error logs
# - Decide: APPROVE or REJECT

# Expected: 10 minutes total
```

**Monitoring:**
```bash
# Terminal 1: Watch logs
tail -f logs/deployment/canary-12.8.0-*.log

# Terminal 2: Watch metrics
watch -n 5 'tail -5 logs/deployment/canary-metrics-12.8.0.jsonl | jq'

# Terminal 3: Container status
watch -n 5 'docker ps --filter "label=basset.role=canary"'

# Terminal 4: Health checks
watch -n 10 'curl -s http://localhost:8765/health | jq'
```

---

### Phase 1: Scale to 25%

```bash
# Execute after canary approval
./scripts/deploy-scale.sh 12.8.0 25

# Monitor for 5 minutes
# 1 canary + 1 new instance = 2 total (25% of 8 production instances)

# At checkpoint prompt:
# - Review scaling metrics
# - Check all instances healthy
# - Decide: PROCEED to Phase 2 or ROLLBACK

# Expected: 10 minutes total
```

---

### Phase 2: Scale to 50%

```bash
# Execute after Phase 1 approval
./scripts/deploy-scale.sh 12.8.0 50

# Monitor for 5 minutes
# 1 canary + 3 new instances = 4 total (50% of 8 production instances)

# At checkpoint prompt:
# - Verify cluster health
# - Check load balancing
# - Decide: PROCEED to Phase 3 or ROLLBACK

# Expected: 10 minutes total
```

---

### Phase 3: Full Deployment (100%)

```bash
# Execute after Phase 2 approval
./scripts/deploy-scale.sh 12.8.0 100

# Monitor for 5 minutes
# All instances running new version (10 total)

# Post-deployment:
# 1. Decommission canary
# 2. Archive deployment logs
# 3. Send success notification
# 4. Monitor for 1 hour
# 5. Begin 24-hour observation

# Expected: 5 minutes to deploy + 60 minutes monitoring
```

---

## Rollback Procedures

### Automatic Rollback (Triggered by Scripts)

The deployment scripts automatically detect issues:
- Container startup failures
- Health check failures (> 2 times)
- Error rate exceeds 5%
- Memory usage exceeds 85%

**Response:** Automatically initiates `rollback.sh`

### Manual Rollback (On-Demand)

```bash
# At any point during deployment, execute:
./scripts/rollback.sh 12.7.0

# Confirm by typing: ROLLBACK
# Expected: 5 minutes to restore service
```

### Post-Rollback Actions

1. **Verify Service**
   ```bash
   curl http://localhost:8765/health | jq '.'
   docker ps --filter "label=basset.version"
   ```

2. **Notify Team**
   - Send incident notification
   - Document root cause
   - Schedule post-mortem

3. **Analyze Failure**
   - Review logs: `logs/deployment/failed-rollouts/`
   - Review metrics: `logs/deployment/scale-metrics-*.jsonl`
   - Review container logs

4. **Plan Correction**
   - Fix identified issues
   - Update deployment procedures if needed
   - Plan retry deployment

---

## Monitoring & Observability

### Real-Time Monitoring

**Metrics Dashboard:**
```bash
# View all metrics in real-time
tail -f logs/metrics/deployment-metrics-*.jsonl | jq '.'

# Filter by metric
grep '"error_rate"' logs/metrics/deployment-metrics-*.jsonl

# Aggregate statistics
jq '.memory_percent' logs/metrics/deployment-metrics-*.jsonl | \
  awk '{sum+=$1; count++} END {print "Avg memory:", sum/count "%"}'
```

**Container Status:**
```bash
# View all deployment containers
docker ps --filter "label=basset.version" \
  --format "table {{.Names}}\t{{.Status}}\t{{.Label \"basset.role\"}}"

# Watch specific container
docker stats basset-hound-canary-12.8.0

# Get container logs
docker logs -f basset-hound-instance-1001

# Get logs since deployment start
docker logs --since 2026-06-21T10:00:00Z basset-hound-instance-1001
```

**Application Health:**
```bash
# Check all health endpoints
curl http://localhost:8765/alive
curl http://localhost:8765/ready
curl http://localhost:8765/health | jq '.'

# Monitor health over time
for i in {1..60}; do
  echo -n "$(date '+%H:%M:%S') - "
  curl -s http://localhost:8765/health | jq -r '.status'
  sleep 1
done
```

### Post-Deployment Validation (24 hours)

```bash
# 1. Container stability
docker inspect basset-hound-instance-1001 | jq '.State'

# 2. Memory stability (check for leaks)
tail -f logs/metrics/deployment-metrics-*.jsonl | \
  jq '.memory_percent' | head -100 | \
  awk '{sum+=$1; count++} END {print "Average: " sum/count "%"}'

# 3. Error rate trending
tail -100 logs/metrics/deployment-metrics-*.jsonl | \
  jq '.error_rate' | sort -n | uniq -c

# 4. WebSocket connection stability
tail -100 logs/metrics/deployment-metrics-*.jsonl | \
  jq '.ws_connections' | \
  awk '{sum+=$1; count++; if ($1>max) max=$1; if ($1<min || NR==1) min=$1} END {print "Avg:", sum/count ", Min:", min ", Max:", max}'

# 5. Review deployment report
cat logs/deployment/scale-report-12.8.0-100pct.md
```

---

## Troubleshooting

### Issue: Deploy Script Fails

**Check Docker:**
```bash
docker ps
docker info
docker network ls
```

**Check Image:**
```bash
docker image ls | grep basset-hound-browser
docker image inspect basset-hound-browser:12.8.0
```

**Check Disk:**
```bash
df -h /
# Need > 10GB free
```

**Check Logs:**
```bash
tail -100 logs/deployment/canary-12.8.0-*.log
docker logs $(docker ps -q --filter "label=basset.role=canary")
```

---

### Issue: Health Checks Failing

**Manual Test:**
```bash
curl -v http://localhost:8765/health
curl -v http://localhost:8765/ready
curl -v http://localhost:8765/alive
```

**Check Port:**
```bash
netstat -tuln | grep 8765
lsof -i :8765
```

**Check Container:**
```bash
docker ps | grep basset-hound-canary
docker inspect basset-hound-canary-12.8.0 | jq '.State'
docker logs basset-hound-canary-12.8.0 | tail -50
```

---

### Issue: High Error Rate

**Check Application Logs:**
```bash
docker logs basset-hound-instance-1001 | grep ERROR
docker logs basset-hound-instance-1001 | tail -100
```

**Check Metrics:**
```bash
grep '"error_rate": [^0]' logs/deployment/scale-metrics-*.jsonl
jq '.error_rate' logs/deployment/scale-metrics-*.jsonl | sort -rn | head -5
```

**Decision Points:**
- If error rate > 5%: Trigger rollback
- If error rate 1-5%: Investigate before proceeding
- If error rate < 1%: Continue deployment

---

### Issue: Out of Memory

**Check Memory Usage:**
```bash
docker stats --no-stream basset-hound-instance-1001
jq '.memory_percent' logs/metrics/deployment-metrics-*.jsonl | sort -rn | head -1
```

**Potential Causes:**
- Memory leak in new version
- Insufficient container memory limit
- Unexpected load spike

**Actions:**
- If memory > 85%: Trigger rollback
- If memory 70-85%: Monitor closely
- If memory < 70%: Continue

---

## Command Reference

```bash
# === DEPLOYMENT ===
./scripts/deploy-canary.sh 12.8.0              # Canary (5%)
./scripts/deploy-scale.sh 12.8.0 25            # Phase 1 (25%)
./scripts/deploy-scale.sh 12.8.0 50            # Phase 2 (50%)
./scripts/deploy-scale.sh 12.8.0 100           # Phase 3 (100%)

# === MONITORING ===
./scripts/setup-deployment-monitoring.sh       # One-time setup
./scripts/start-deployment-monitoring.sh       # Start collection

# === ROLLBACK ===
./scripts/rollback.sh 12.7.0                   # Emergency rollback

# === STATUS CHECKS ===
docker ps --filter "label=basset.version"     # List containers
curl http://localhost:8765/health              # Health status
curl http://localhost:8765/ready               # Readiness status
curl http://localhost:8765/alive               # Liveness status

# === MONITORING ===
tail -f logs/metrics/deployment-metrics-*.jsonl # Watch metrics
tail -f logs/deployment/canary-*.log            # Watch logs
tail -f logs/alerts.log                         # Watch alerts

# === ANALYSIS ===
docker logs -f basset-hound-instance-1001      # Container logs
docker stats basset-hound-instance-1001        # Resource usage
docker inspect basset-hound-instance-1001 | jq # Container details
```

---

## Best Practices

### Before Deployment
1. ✓ Backup previous version reference
2. ✓ Verify new image exists
3. ✓ Check available disk space
4. ✓ Notify team
5. ✓ Have rollback plan ready

### During Deployment
1. ✓ Monitor metrics continuously
2. ✓ Watch for alerts
3. ✓ Review logs periodically
4. ✓ Be ready to rollback instantly
5. ✓ Document any issues

### After Deployment
1. ✓ Monitor for 24 hours
2. ✓ Verify metrics stability
3. ✓ Check for memory leaks
4. ✓ Decommission canary instance
5. ✓ Archive deployment artifacts
6. ✓ Send completion notification

---

## Next Steps

1. **Initial Setup** (One-time)
   ```bash
   ./scripts/setup-deployment-monitoring.sh
   ```

2. **First Deployment**
   ```bash
   ./scripts/deploy-canary.sh 12.8.0
   ./scripts/deploy-scale.sh 12.8.0 25
   ./scripts/deploy-scale.sh 12.8.0 50
   ./scripts/deploy-scale.sh 12.8.0 100
   ```

3. **Monitor for 24 hours**
   ```bash
   tail -f logs/metrics/deployment-metrics-*.jsonl
   ```

4. **Archive & Document**
   - Review deployment report
   - Archive logs
   - Send completion notification

---

## Support & Escalation

**For questions or issues:**

| Role | Contact | Availability |
|------|---------|--------------|
| DevOps Lead | devops@example.com | 24/7 |
| On-Call | oncall@example.com | During deployment |
| Platform Team | platform@example.com | Business hours |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-21 | Initial creation |

---

## Related Documentation

- [DEPLOYMENT-AUTOMATION-RUNBOOK.md](./DEPLOYMENT-AUTOMATION-RUNBOOK.md) - Detailed procedures
- [COMMUNICATION-TEMPLATES.md](./COMMUNICATION-TEMPLATES.md) - Notification templates
- [DOCKER-DEPLOYMENT.md](../DOCKER-DEPLOYMENT.md) - Docker configuration
- [docs/API-REFERENCE.md](../API-REFERENCE.md) - WebSocket API reference

---

**Status: Ready for Production Use**

Questions? Contact devops@example.com
