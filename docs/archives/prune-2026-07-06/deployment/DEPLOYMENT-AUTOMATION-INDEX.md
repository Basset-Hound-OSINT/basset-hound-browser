# Deployment Automation - Complete Index

**Date:** June 21, 2026  
**Version:** 1.0  
**Status:** Production Ready

---

## Executive Summary

Complete deployment automation system for Basset Hound Browser with:
- ✓ Progressive canary deployment (5% → 25% → 50% → 100%)
- ✓ Automated health checks and metrics collection
- ✓ Alert thresholds and monitoring
- ✓ Instant rollback capability
- ✓ Comprehensive documentation and communication templates
- ✓ Step-by-step runbooks

**Total Setup Time:** ~5 minutes (one-time)  
**Deployment Time:** ~35 minutes (progressive)  
**Rollback Time:** ~5 minutes (instant)

---

## Quick Navigation

### For DevOps Engineers

**Getting Started:**
1. [DEPLOYMENT-AUTOMATION-GUIDE.md](./DEPLOYMENT-AUTOMATION-GUIDE.md) - Start here
2. [DEPLOYMENT-AUTOMATION-RUNBOOK.md](./DEPLOYMENT-AUTOMATION-RUNBOOK.md) - Detailed procedures
3. [COMMUNICATION-TEMPLATES.md](./COMMUNICATION-TEMPLATES.md) - Notification templates

**Scripts:**
- `scripts/deploy-canary.sh` - Canary deployment (5%)
- `scripts/deploy-scale.sh` - Scale deployment (25%, 50%, 100%)
- `scripts/rollback.sh` - Emergency rollback
- `scripts/setup-deployment-monitoring.sh` - Monitoring setup
- `scripts/start-deployment-monitoring.sh` - Start metrics collection

### For Release Managers

1. Read [DEPLOYMENT-AUTOMATION-GUIDE.md](./DEPLOYMENT-AUTOMATION-GUIDE.md) Quick Start
2. Review [COMMUNICATION-TEMPLATES.md](./COMMUNICATION-TEMPLATES.md)
3. Use templates for team notifications
4. Monitor dashboard during deployment

### For On-Call Engineers

1. Keep [DEPLOYMENT-AUTOMATION-RUNBOOK.md](./DEPLOYMENT-AUTOMATION-RUNBOOK.md) handy
2. Bookmark rollback command: `./scripts/rollback.sh 12.7.0`
3. Monitor: `tail -f logs/metrics/deployment-metrics-*.jsonl`
4. Be ready for instant decision-making

---

## File Structure

### Deployment Scripts (in `scripts/`)

```
scripts/
├── deploy-canary.sh                     (14KB) ✓
│   └── Deploys canary instance (5% traffic)
│       - Validates prerequisites
│       - Captures baseline metrics
│       - Health checks with retry
│       - Metrics collection for 5 min
│       - Approval checkpoint
│       - Expected time: 10 minutes
│
├── deploy-scale.sh                      (16KB) ✓
│   └── Scales deployment to target percentage
│       - Supports: 25%, 50%, 100%
│       - Verifies canary approval
│       - Deploys instances incrementally
│       - Health checks across cluster
│       - Metrics aggregation
│       - Phase checkpoints
│       - Expected time: 10 min per phase
│
├── rollback.sh                          (13KB) ✓
│   └── Emergency rollback to previous version
│       - Confirmation checkpoint
│       - Stops new version
│       - Restarts previous version
│       - Health verification
│       - Load balancer update
│       - Incident archival
│       - Expected time: 5 minutes
│
├── setup-deployment-monitoring.sh       (19KB) ✓
│   └── One-time monitoring configuration
│       - Creates health check configs
│       - Sets up metrics collection
│       - Configures alert thresholds
│       - Generates endpoint stubs
│       - Creates startup scripts
│       - Expected time: 2 minutes
│
└── start-deployment-monitoring.sh       (auto-created)
    └── Starts metrics collection in background
        - Continuous monitoring
        - Real-time alerts
        - Metrics storage
```

### Configuration Files (in `config/`)

```
config/
├── monitoring/
│   ├── health-checks.json               (auto-created)
│   │   └── Liveness, readiness, health probe config
│   ├── metrics.json                     (auto-created)
│   │   └── System, app, deployment metrics
│   └── dashboard.md                     (auto-created)
│       └── Monitoring dashboard template
│
└── alerts/
    ├── thresholds.json                  (auto-created)
    │   └── Warning/critical alert levels
    └── notifications.json               (auto-created)
        └── Email, Slack, PagerDuty config
```

### Log Files (in `logs/`)

```
logs/
├── deployment/
│   ├── canary-12.8.0-*.log              (created during canary)
│   ├── canary-metrics-12.8.0.jsonl      (5 min metrics)
│   ├── canary-report-12.8.0.md          (markdown report)
│   ├── canary-state.json                (state tracking)
│   ├── scale-12.8.0-25pct-*.log         (Phase 1)
│   ├── scale-12.8.0-50pct-*.log         (Phase 2)
│   ├── scale-12.8.0-100pct-*.log        (Phase 3)
│   ├── scale-metrics-12.8.0-XYpct.jsonl (phase metrics)
│   ├── scale-report-12.8.0-XYpct.md     (phase reports)
│   ├── rollback-*.log                   (if rollback)
│   ├── rollback-report-*.md             (if rollback)
│   └── failed-rollouts/                 (archives if issues)
│
├── metrics/
│   ├── deployment-metrics-*.jsonl       (continuous metrics)
│   └── [7-day rotation]
│
├── monitoring/
│   ├── setup-*.log                      (setup logs)
│   ├── metrics-collection.log           (collection logs)
│   └── startup.log                      (startup logs)
│
└── alerts.log                           (alert log)
```

### Documentation (in `docs/deployment/`)

```
docs/deployment/
├── DEPLOYMENT-AUTOMATION-GUIDE.md       (20KB) ✓ Main guide
├── DEPLOYMENT-AUTOMATION-RUNBOOK.md     (25KB) ✓ Step-by-step
├── COMMUNICATION-TEMPLATES.md           (15KB) ✓ Templates
├── DEPLOYMENT-AUTOMATION-INDEX.md       (this file) ✓ Navigation
└── [other existing deployment docs]
```

---

## Feature Comparison

### Deployment Phases

| Feature | Canary | Phase 1 | Phase 2 | Phase 3 |
|---------|--------|---------|---------|---------|
| **Percentage** | 5% | 25% | 50% | 100% |
| **Instances** | 1 | 2 | 4 | 10 |
| **Duration** | 10 min | 10 min | 10 min | 5 min |
| **Health Checks** | ✓ | ✓ | ✓ | ✓ |
| **Metrics** | ✓ | ✓ | ✓ | ✓ |
| **Approval Gate** | ✓ | ✓ | ✓ | Auto |
| **Rollback Ready** | ✓ | ✓ | ✓ | ✓ |

### Monitoring Capabilities

| Metric | Collection | Thresholds | Alerts | Dashboard |
|--------|-----------|-----------|--------|-----------|
| Memory | ✓ (15s) | ✓ | ✓ | ✓ |
| CPU | ✓ (15s) | ✓ | ✓ | ✓ |
| Disk | ✓ (15s) | ✓ | ✓ | ✓ |
| Error Rate | ✓ (30s) | ✓ | ✓ | ✓ |
| Latency | ✓ (30s) | ✓ | ✓ | ✓ |
| WebSocket | ✓ (30s) | ✓ | ✓ | ✓ |
| Containers | ✓ (60s) | ✓ | ✓ | ✓ |

### Alert Thresholds

| Metric | Warning | Critical | Auto-Rollback |
|--------|---------|----------|----------------|
| Memory | 70% | 85% | Yes (>85%) |
| CPU | 60% | 80% | No (warning only) |
| Error Rate | 1% | 5% | Yes (>5%) |
| Latency | 500ms | 2000ms | No |
| Healthy % | 80% | 75% | Yes (<75%) |

---

## Step-by-Step Deployment Workflow

### Step 1: One-Time Setup (5 minutes)

```bash
cd /home/devel/basset-hound-browser

# Configure monitoring
./scripts/setup-deployment-monitoring.sh

# Verify setup
ls -la config/monitoring/
ls -la config/alerts/

# Start background metrics collection
./scripts/start-deployment-monitoring.sh

# Verify metrics flowing
tail -f logs/metrics/deployment-metrics-*.jsonl
```

### Step 2: Pre-Deployment Verification

```bash
# Verify prerequisites
docker ps
docker image ls | grep basset-hound-browser:12.8.0
df -h / # Need > 10GB free

# Backup current state
docker inspect basset-hound-browser > /backup/pre-deployment.json
```

### Step 3: Execute Deployment

```bash
# Phase 0: Canary (5%)
./scripts/deploy-canary.sh 12.8.0
# Expected: 10 minutes
# At prompt: Review metrics, type APPROVE

# Phase 1: Scale to 25%
./scripts/deploy-scale.sh 12.8.0 25
# Expected: 10 minutes
# At prompt: Type PROCEED

# Phase 2: Scale to 50%
./scripts/deploy-scale.sh 12.8.0 50
# Expected: 10 minutes
# At prompt: Type PROCEED

# Phase 3: Full Deployment (100%)
./scripts/deploy-scale.sh 12.8.0 100
# Expected: 5 minutes
# Automatic completion
```

**Total Time: ~35 minutes**

### Step 4: Post-Deployment

```bash
# Decommission canary
docker stop basset-hound-canary-12.8.0
docker rm basset-hound-canary-12.8.0

# Archive deployment
mkdir -p archives/deployment-12.8.0
cp -r logs/deployment/* archives/deployment-12.8.0/
cp -r logs/metrics/* archives/deployment-12.8.0/

# Send completion notification
# Use template from COMMUNICATION-TEMPLATES.md

# Monitor for 24 hours
tail -f logs/metrics/deployment-metrics-*.jsonl
```

### Step 5: If Issues - Emergency Rollback

```bash
# At ANY point during deployment
./scripts/rollback.sh 12.7.0

# Confirm by typing: ROLLBACK
# Expected: 5 minutes to restore
```

---

## Monitoring During Deployment

### Real-Time Dashboards

**Terminal 1: Deployment Logs**
```bash
tail -f logs/deployment/canary-12.8.0-*.log
# OR
tail -f logs/deployment/scale-12.8.0-*pct-*.log
```

**Terminal 2: Metrics Stream**
```bash
tail -f logs/metrics/deployment-metrics-*.jsonl | jq '.'
```

**Terminal 3: Alert Monitoring**
```bash
tail -f logs/alerts.log
```

**Terminal 4: Container Status**
```bash
watch -n 5 'docker ps --filter "label=basset.version" --format "table {{.Names}}\t{{.Status}}\t{{.Label \"basset.role\"}}"'
```

**Terminal 5: Health Checks**
```bash
while true; do
  echo "$(date): $(curl -s http://localhost:8765/health | jq -r '.status')"
  sleep 10
done
```

### Alert Thresholds to Watch

| Alert | Threshold | Action |
|-------|-----------|--------|
| Memory Critical | > 85% | Consider rollback |
| Error Rate High | > 5% | Initiate rollback |
| Health Failure | > 2 consecutive | Investigate |
| CPU Critical | > 80% | Monitor closely |
| Container Restart | > 3 times | Investigate |

---

## Communication During Deployment

### Pre-Deployment (T-24 hours)

Use [COMMUNICATION-TEMPLATES.md](./COMMUNICATION-TEMPLATES.md) section:
"Pre-Deployment Announcement"

Send via:
- Email (devops@example.com, platform-team@example.com)
- Slack (#deployment-notifications)
- Dashboard status page

### During Deployment

Use [COMMUNICATION-TEMPLATES.md](./COMMUNICATION-TEMPLATES.md) section:
"Phase Completion Updates"

Send via:
- Slack (#deployment-notifications) - Real-time
- Dashboard - Live status
- Email - Major milestones

### Post-Deployment (T+1 hour)

Use [COMMUNICATION-TEMPLATES.md](./COMMUNICATION-TEMPLATES.md) section:
"Deployment Success Announcement"

Send via:
- Email (all@example.com)
- Slack (#deployment-notifications)
- Dashboard status page

---

## Troubleshooting Quick Reference

### Canary Won't Start

```bash
# Check Docker
docker ps
docker image ls | grep basset-hound-browser

# Check logs
tail -100 logs/deployment/canary-12.8.0-*.log
docker logs $(docker ps -qa --filter "label=basset.role=canary")

# Check disk
df -h /
```

### Health Checks Failing

```bash
# Manual test
curl -v http://localhost:8765/health
curl -v http://localhost:8765/ready

# Check port
netstat -tuln | grep 8765

# Check container
docker inspect $(docker ps -q --filter "label=basset.role=canary")
```

### High Error Rate

```bash
# Check metrics
grep '"error_rate"' logs/metrics/deployment-metrics-*.jsonl

# Check logs
docker logs -f $(docker ps -q --filter "label=basset.role=canary") | tail -50

# Decision: If > 5%, rollback
```

### Need to Rollback

```bash
# At any point:
./scripts/rollback.sh 12.7.0

# Type: ROLLBACK to confirm
# Takes ~5 minutes
```

---

## Essential Commands

```bash
# === DEPLOYMENT ===
./scripts/deploy-canary.sh 12.8.0              # Canary
./scripts/deploy-scale.sh 12.8.0 25            # Phase 1
./scripts/deploy-scale.sh 12.8.0 50            # Phase 2
./scripts/deploy-scale.sh 12.8.0 100           # Phase 3
./scripts/rollback.sh 12.7.0                   # Rollback

# === MONITORING ===
./scripts/setup-deployment-monitoring.sh       # Setup
./scripts/start-deployment-monitoring.sh       # Start

# === STATUS ===
docker ps --filter "label=basset.version"
curl http://localhost:8765/health | jq '.'
tail -f logs/metrics/deployment-metrics-*.jsonl

# === LOGS ===
tail -f logs/deployment/canary-*.log
tail -f logs/alerts.log
docker logs -f $(docker ps -q --filter "label=basset.role=canary")
```

---

## Performance Metrics

### Deployment Time

| Phase | Typical | Min | Max |
|-------|---------|-----|-----|
| Canary (5%) | 10 min | 8 min | 15 min |
| Phase 1 (25%) | 10 min | 8 min | 15 min |
| Phase 2 (50%) | 10 min | 8 min | 15 min |
| Phase 3 (100%) | 5 min | 3 min | 10 min |
| **Total** | **35 min** | **27 min** | **55 min** |

### Resource Usage

| Resource | Baseline | During Deployment | Peak |
|----------|----------|-------------------|------|
| Memory | 45% | 48-52% | 55% |
| CPU | 12% | 14-18% | 25% |
| Disk | ~2GB | +100MB | +200MB |
| Network | ~5Mbps | ~10Mbps | ~20Mbps |

### Health Check Performance

| Check | Latency | Timeout | Interval |
|-------|---------|---------|----------|
| Liveness | <10ms | 5s | 10s |
| Readiness | <50ms | 5s | 15s |
| Health | <100ms | 10s | 30s |

---

## Best Practices Checklist

### Before Deployment
- [ ] Read DEPLOYMENT-AUTOMATION-GUIDE.md
- [ ] Verify Docker image exists
- [ ] Check available disk space (>10GB)
- [ ] Notify team via email/Slack
- [ ] Have rollback command ready
- [ ] Open communication channel

### During Deployment
- [ ] Monitor metrics every 2-3 minutes
- [ ] Watch for alerts
- [ ] Review logs if anything unexpected
- [ ] Be ready for instant decisions
- [ ] Update stakeholders at checkpoints
- [ ] Keep team informed

### After Deployment
- [ ] Monitor for 24 hours
- [ ] Verify memory stability
- [ ] Check for error trends
- [ ] Decommission canary
- [ ] Archive deployment logs
- [ ] Send completion notification
- [ ] Document any issues

---

## Support & Escalation

**DevOps Team**
- Email: devops@example.com
- Slack: @devops-team
- On-Call: [PHONE_NUMBER]
- Hours: 24/7

**For Issues:**
1. Check troubleshooting section above
2. Review deployment logs
3. Contact on-call engineer
4. Have rollback script ready

---

## Key Contacts

| Role | Email | Slack | Phone |
|------|-------|-------|-------|
| DevOps Lead | devops@example.com | @devops-lead | - |
| On-Call | oncall@example.com | @oncall | [NUMBER] |
| Platform Team | platform@example.com | @platform | [NUMBER] |
| Release Manager | releases@example.com | @releases | - |

---

## Related Documentation

- [DEPLOYMENT-AUTOMATION-GUIDE.md](./DEPLOYMENT-AUTOMATION-GUIDE.md) - Main guide
- [DEPLOYMENT-AUTOMATION-RUNBOOK.md](./DEPLOYMENT-AUTOMATION-RUNBOOK.md) - Procedures
- [COMMUNICATION-TEMPLATES.md](./COMMUNICATION-TEMPLATES.md) - Templates
- [DOCKER-DEPLOYMENT.md](../DOCKER-DEPLOYMENT.md) - Docker config
- [DEPLOYMENT-MONITORING-SETUP.md](./DEPLOYMENT-MONITORING-SETUP.md) - Monitoring

---

## Document Metadata

- **Version:** 1.0
- **Date:** June 21, 2026
- **Status:** Production Ready
- **Last Updated:** June 21, 2026
- **Author:** DevOps Team
- **Audience:** DevOps Engineers, Release Managers, On-Call

---

## Quick Links

- 📋 [Main Guide](./DEPLOYMENT-AUTOMATION-GUIDE.md)
- 🚀 [Runbook](./DEPLOYMENT-AUTOMATION-RUNBOOK.md)
- 💬 [Templates](./COMMUNICATION-TEMPLATES.md)
- 📊 [Monitoring Setup](./DEPLOYMENT-MONITORING-SETUP.md)
- 🐳 [Docker Deployment](../DOCKER-DEPLOYMENT.md)

---

**Status: Ready for Production Deployment**

For the latest version, check: `docs/deployment/DEPLOYMENT-AUTOMATION-INDEX.md`
