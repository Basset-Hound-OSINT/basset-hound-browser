# Deployment Automation Runbook - Basset Hound Browser

**Document Version:** 1.0  
**Date:** June 21, 2026  
**Purpose:** Complete automation strategy for canary deployments (5% → 25% → 50% → 100%)  
**Audience:** DevOps Engineers, Release Managers, On-Call Engineers

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Deployment Phases](#deployment-phases)
4. [Step-by-Step Procedures](#step-by-step-procedures)
5. [Monitoring & Validation](#monitoring--validation)
6. [Rollback Procedures](#rollback-procedures)
7. [Communication Plan](#communication-plan)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### Deployment Strategy

The Basset Hound Browser uses a **progressive rollout** strategy to minimize risk:

```
Phase 0: Canary (5%)
  ↓ (Review & Approve)
Phase 1: Scale to 25%
  ↓ (Review & Approve)
Phase 2: Scale to 50%
  ↓ (Review & Approve)
Phase 3: Full Deployment (100%)
```

### Key Features

- **Automated health checks** at each phase
- **Continuous metrics collection** with alert thresholds
- **Approval gates** before proceeding
- **Instant rollback capability** at any stage
- **Comprehensive logging** for post-incident analysis

### Expected Timeline

| Phase | Duration | Total Time |
|-------|----------|-----------|
| Canary (5%) | 10 minutes | 10 min |
| Phase 1 (25%) | 10 minutes | 20 min |
| Phase 2 (50%) | 10 minutes | 30 min |
| Phase 3 (100%) | 5 minutes | 35 min |

**Total Deployment Time: ~35 minutes**

---

## Pre-Deployment Checklist

### 1. Environment Validation

```bash
# Check Docker is running
docker ps
# Expected: List of running containers or empty list

# Verify network exists
docker network ls | grep basset-hound-browser
# Expected: Network listed

# Check available disk space (minimum 10GB)
df -h /
# Expected: At least 10GB free
```

### 2. Image Preparation

```bash
# Verify new image exists
docker image ls | grep basset-hound-browser
# Expected: Image with version tag present

# Check image size
docker image inspect basset-hound-browser:12.8.0 | grep Size
# Expected: Reasonable size (< 3GB)
```

### 3. Backup Previous Version

```bash
# Save current version info
docker inspect basset-hound-browser | jq '.[] | {Image, Version}' > /backup/pre-deployment-state.json

# Expected: JSON file with current state saved
```

### 4. Monitoring Setup

```bash
# Start monitoring services
./scripts/setup-deployment-monitoring.sh
./scripts/start-deployment-monitoring.sh

# Verify collection is working
tail -f logs/metrics/deployment-metrics-*.jsonl
# Expected: Metrics flowing every 30 seconds
```

### 5. Team Notification

Ensure:
- [ ] Team lead aware of deployment window
- [ ] On-call engineer ready
- [ ] Escalation path configured
- [ ] Communication channel open (#deployment-notifications)

---

## Deployment Phases

### Phase 0: Canary Deployment (5% Traffic)

**Objective**: Test new version with minimal blast radius

**Duration**: 10 minutes

**Steps**:
1. Deploy single canary instance
2. Health checks & readiness verification
3. Collect metrics for 5 minutes
4. Validate metrics against thresholds
5. Manual approval checkpoint

**Success Criteria**:
- ✓ Canary container running
- ✓ Health checks passing
- ✓ No errors in logs
- ✓ Metrics within acceptable range
- ✓ Team approval obtained

**Rollback Trigger**:
- ✗ Container fails to start
- ✗ Health checks fail > 2 times
- ✗ Error rate > 5%
- ✗ Memory usage > 85%
- ✗ Team requests rollback

---

### Phase 1: Scale to 25% (4 Total Instances)

**Objective**: Expand to 25% of production instances

**Duration**: 10 minutes

**Steps**:
1. Deploy additional instances (total: 4)
2. Health checks across all instances
3. Collect metrics for 5 minutes
4. Validate cluster health
5. Approval checkpoint for Phase 2

**Success Criteria**:
- ✓ All 4 instances running
- ✓ ≥3/4 instances healthy (75% threshold)
- ✓ Aggregate error rate < 2%
- ✓ Memory usage < 75% per instance
- ✓ Team approval obtained

**Rollback Trigger**:
- ✗ > 1 instance fails health checks
- ✗ Error rate > 5%
- ✗ Memory > 80% on any instance
- ✗ Team requests rollback

---

### Phase 2: Scale to 50% (6 Total Instances)

**Objective**: Expand to 50% of production instances

**Duration**: 10 minutes

**Steps**:
1. Deploy additional instances (total: 6)
2. Health checks across all instances
3. Collect metrics for 5 minutes
4. Validate cluster health
5. Approval checkpoint for Phase 3

**Success Criteria**:
- ✓ All 6 instances running
- ✓ ≥5/6 instances healthy (83% threshold)
- ✓ Aggregate error rate < 2%
- ✓ Load balancing functional
- ✓ Team approval obtained

**Rollback Trigger**:
- ✗ > 1 instance fails health checks
- ✗ Error rate > 5%
- ✗ Load balancer misconfiguration
- ✗ Team requests rollback

---

### Phase 3: Full Deployment (100% - 10 Instances)

**Objective**: Complete rollout to all instances

**Duration**: 5 minutes

**Steps**:
1. Deploy remaining instances (total: 10)
2. Final health checks
3. Verify full redundancy
4. Release notification

**Success Criteria**:
- ✓ All 10 instances running
- ✓ ≥9/10 instances healthy (90% threshold)
- ✓ Error rate < 1%
- ✓ No legacy version containers running
- ✓ Health dashboard green

**Post-Deployment**:
- [ ] Monitor for 1 hour
- [ ] Collect final metrics
- [ ] Decommission canary
- [ ] Archive deployment logs
- [ ] Send completion notification

---

## Step-by-Step Procedures

### Executing Phase 0: Canary Deployment

#### Command
```bash
./scripts/deploy-canary.sh 12.8.0
```

#### What It Does
1. Validates prerequisites (Docker, network, image)
2. Captures baseline metrics
3. Deploys canary container
4. Performs health checks (max 30 retries, 2-second intervals)
5. Collects metrics for 5 minutes
6. Validates metrics against thresholds
7. Generates canary report
8. Prompts for manual approval

#### Expected Output
```
=== Basset Hound Browser Canary Deployment v12.8.0 ===

[INFO] 2026-06-21 10:00:00 - Deployment started by: devops
[INFO] 2026-06-21 10:00:00 - Log file: logs/deployment/canary-12.8.0-20260621-100000.log

=== Validating prerequisites ===
[INFO] ✓ Docker is installed
[INFO] ✓ Docker daemon is running
[INFO] ✓ Docker network 'basset-hound-browser' exists

=== Capturing baseline metrics ===
[INFO] Baseline metrics captured:
[INFO]   Memory: 45.2%
[INFO]   CPU: 12.1%
[INFO]   WS Connections: 127
[INFO]   WS Throughput: 481.48 msgs/sec

=== Preparing Docker image ===
[INFO] Using existing image: basset-hound-browser:12.8.0

=== Deploying canary instance (5% traffic) ===
[INFO] ✓ Canary container started: basset-hound-canary-12.8.0

=== Performing health checks on canary ===
[INFO] ✓ Health check passed

=== Collecting canary metrics for 300 seconds ===
[INFO] Monitoring canary for 5 minutes (300 seconds)...

[After 5 minutes]

=== Validating canary metrics ===
[INFO] Metrics analysis:
[INFO]   Total samples: 30
[INFO]   Samples with errors: 0
[INFO]   Samples with high memory: 0
[INFO] ✓ Metrics validation passed

=== Canary Deployment Approval Checkpoint ===

Canary deployment for version 12.8.0 completed.
Review the metrics and logs to determine if canary is healthy.

Would you like to approve this canary deployment?

Enter [APPROVE/REJECT]: APPROVE

[INFO] Canary deployment APPROVED

==========================================
CANARY DEPLOYMENT SUCCESSFUL
==========================================

Next step: Run 'scripts/deploy-scale.sh 12.8.0 25' to proceed to Phase 1
```

#### Monitoring During Canary
```bash
# In separate terminal, monitor logs
tail -f logs/deployment/canary-12.8.0-*.log

# Monitor metrics
tail -f logs/deployment/canary-metrics-12.8.0.jsonl | jq '.'

# Check container status
docker ps -f "label=basset.role=canary"

# Check application health
curl -s http://localhost:8765/health | jq '.'
```

---

### Executing Phase 1: Scale to 25%

#### Command
```bash
./scripts/deploy-scale.sh 12.8.0 25
```

#### What It Does
1. Verifies canary approval
2. Calculates instance count for 25% (2 total)
3. Deploys additional instance (1 more)
4. Performs health checks on all instances
5. Collects cluster metrics for 5 minutes
6. Validates deployment metrics
7. Generates scaling report
8. Prompts for Phase 2 approval

#### Expected Output
```
=== Basset Hound Browser Scaled Deployment ===
Version: 12.8.0 | Target: 25%
Log file: logs/deployment/scale-12.8.0-25pct-20260621-100500.log

=== Verifying canary approval ===
[INFO] ✓ Canary approval verified

=== Deploying scaled instances - 25% ===
[INFO] Total instances to run: 2
[INFO] Current instances: 1 (including canary)
[1/1] Deploying instance: basset-hound-instance-1001
[INFO] ✓ Instance deployed: basset-hound-instance-1001

=== Performing health checks on all instances ===
[INFO] ✓ Health check passed: basset-hound-canary-12.8.0
[INFO] ✓ Health check passed: basset-hound-instance-1001
Health check results: 2/2 instances healthy

=== Collecting metrics from 25% deployment ===
[METRIC] Metrics collected and saved: logs/deployment/scale-metrics-12.8.0-25pct.jsonl

=== Validating deployment metrics ===
[INFO] Metrics summary:
[METRIC]   Samples: 20
[METRIC]   Avg memory: 48.3%
[METRIC]   Peak CPU: 15.2%
[METRIC]   Samples with errors: 0
[INFO] ✓ Metrics validation passed

=== Phase Completion Checkpoint - 25% ===

Deployment to 25% completed successfully.
Review metrics and decide on next action:

  [PROCEED] - Proceed to Phase 50%
  [MONITOR] - Continue monitoring current deployment
  [ROLLBACK] - Rollback to previous version

Enter your choice: PROCEED

[INFO] Proceeding to Phase 50%

==========================================
SCALED DEPLOYMENT SUCCESSFUL - 25%
==========================================
```

---

### Executing Phase 2: Scale to 50%

#### Command
```bash
./scripts/deploy-scale.sh 12.8.0 50
```

#### Expected Timeline
- Deploy 2 more instances (total: 4)
- Health checks: ~2 minutes
- Metrics collection: 5 minutes
- Total: ~10 minutes

#### Approval Criteria
- All 4 instances healthy
- Error rate < 2%
- Team consensus

---

### Executing Phase 3: Full Deployment (100%)

#### Command
```bash
./scripts/deploy-scale.sh 12.8.0 100
```

#### Expected Timeline
- Deploy 6 more instances (total: 10)
- Health checks: ~3 minutes
- Final validation: 5 minutes
- Total: ~5 minutes

#### Post-Deployment
```bash
# Verify all instances running
docker ps --filter "label=basset.version=12.8.0" --format "table {{.Names}}\t{{.Status}}"

# Stop canary instance
docker stop basset-hound-canary-12.8.0
docker rm basset-hound-canary-12.8.0

# Archive deployment artifacts
mkdir -p archives/deployment-12.8.0
cp -r logs/deployment/scale-* archives/deployment-12.8.0/
cp -r logs/metrics/* archives/deployment-12.8.0/

# Send notification
echo "Deployment v12.8.0 completed successfully" | mail -s "Deployment Notification" devops@example.com
```

---

## Monitoring & Validation

### During Deployment

#### Health Check Endpoints

```bash
# Check if service is alive
curl http://localhost:8765/alive

# Check if service is ready
curl http://localhost:8765/ready

# Get full health status
curl http://localhost:8765/health | jq '.'
```

#### Metrics Monitoring

```bash
# Watch metrics in real-time
watch -n 5 'tail -5 logs/metrics/deployment-metrics-*.jsonl | jq "."'

# Filter for errors
grep '"error_rate": [^0]' logs/metrics/deployment-metrics-*.jsonl

# Get statistics
jq '.error_rate' logs/metrics/deployment-metrics-*.jsonl | \
  awk '{sum+=$1; count++} END {print "Average error rate: " sum/count "%"}'
```

#### Alert Monitoring

```bash
# Watch for alerts
tail -f logs/alerts.log

# Search for critical alerts
grep "ALERT: " logs/alerts.log | grep -i critical
```

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Memory | 70% | 85% |
| CPU | 60% | 80% |
| Error Rate | 1% | 5% |
| Latency P99 | 500ms | 2000ms |
| Healthy Instances | 80% | 75% |

### Container Logs

```bash
# View canary logs
docker logs basset-hound-canary-12.8.0

# Follow specific instance
docker logs -f basset-hound-instance-1001

# Get last N lines
docker logs --tail 100 basset-hound-instance-1001

# Get logs since specific time
docker logs --since 2026-06-21T10:00:00 basset-hound-instance-1001
```

---

## Rollback Procedures

### Immediate Rollback (Any Phase)

```bash
./scripts/rollback.sh 12.7.0
```

**This command will:**
1. Prompt for confirmation (type: ROLLBACK)
2. Stop all new version containers
3. Restart previous version containers
4. Verify health checks
5. Update load balancer configuration
6. Archive failed deployment for analysis

### Manual Rollback Steps

#### Step 1: Identify Current Version
```bash
docker ps --filter "label=basset.version" \
  --format "{{.Label \"basset.version\"}}"
```

#### Step 2: Stop New Version
```bash
docker stop $(docker ps -q --filter "label=basset.role=canary")
docker stop $(docker ps -q --filter "label=basset.role=production")
```

#### Step 3: Start Previous Version
```bash
docker run -d \
  --name basset-hound-browser \
  --network basset-hound-browser \
  -p 8765:8765 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  basset-hound-browser:12.7.0
```

#### Step 4: Verify Health
```bash
sleep 10
curl http://localhost:8765/health | jq '.'
```

#### Step 5: Notify Team
Document the rollback incident and notify stakeholders.

---

## Communication Plan

### Pre-Deployment (T-24 hours)

**Message Template:**
```
Subject: Deployment Notice - Basset Hound Browser v12.8.0

Dear Team,

Basset Hound Browser v12.8.0 deployment is scheduled for:
  Date: [Date]
  Time: [Time]
  Duration: ~35 minutes (progressive rollout)
  Window: [Start] to [End]

Deployment Strategy:
  - Phase 0: Canary (5%) - 10 min
  - Phase 1: Scale to 25% - 10 min
  - Phase 2: Scale to 50% - 10 min
  - Phase 3: Full deployment - 5 min

Expected Impact: Minimal (progressive rollout with instant rollback)

Questions? Contact: devops@example.com
```

### During Deployment (Real-time Updates)

#### Phase Start
```
[10:00] PHASE 0 START: Canary deployment initiated
        Version: 12.8.0 | Expected duration: 10 min
```

#### Phase Checkpoint
```
[10:10] PHASE 0 COMPLETE: Canary approved
        Metrics: OK | Error rate: 0.1% | Memory: 48%
        Decision: PROCEED to Phase 1
```

#### Phase Failure (if occurs)
```
[10:15] ALERT: Phase 1 health check failure
        Failing instances: 1/2
        Action: Initiating rollback to v12.7.0
        ETA: 5 minutes
```

### Post-Deployment (T+1 hour)

**Message Template:**
```
Subject: Deployment Complete - Basset Hound Browser v12.8.0

Dear Team,

Basset Hound Browser v12.8.0 deployment completed successfully.

Timeline:
  10:00 - Canary deployed
  10:10 - Phase 1 (25%) deployed
  10:20 - Phase 2 (50%) deployed
  10:25 - Phase 3 (100%) deployed
  10:30 - Deployment complete

Metrics:
  ✓ All instances healthy (10/10)
  ✓ Error rate: 0.05%
  ✓ Memory average: 51%
  ✓ No alerts triggered

Next Review: [Date] at [Time]
Contact for issues: devops@example.com
```

---

## Troubleshooting

### Issue: Canary Fails to Start

**Symptoms:**
```
[ERROR] Container failed to start
[ERROR] ✗ Canary failed health checks after 30 attempts
```

**Troubleshooting:**
```bash
# Check container status
docker ps -a | grep canary

# View error logs
docker logs basset-hound-canary-12.8.0

# Check image exists
docker image ls | grep basset-hound-browser:12.8.0

# Check disk space
df -h /

# Check Docker daemon
docker ps

# If no Docker:
sudo systemctl restart docker
sleep 5
./scripts/deploy-canary.sh 12.8.0
```

**Solution:**
- Verify image exists or rebuild it
- Ensure sufficient disk space (minimum 10GB)
- Check Docker daemon is running
- Review error logs for specific failures

---

### Issue: Health Checks Failing

**Symptoms:**
```
[WARN] Liveness check failed, retrying
[ERROR] ✗ Canary failed health checks after 30 attempts
```

**Troubleshooting:**
```bash
# Check container is running
docker ps | grep basset-hound

# Test health endpoint manually
curl -v http://localhost:8765/health

# Check if port is bound
netstat -tuln | grep 8765

# Check logs for errors
docker logs basset-hound-instance-1001 | tail -50

# Verify network connectivity
docker exec basset-hound-canary-12.8.0 curl localhost:8765/health
```

**Solution:**
- Wait longer for service startup (increase initial_delay)
- Check logs for application-level errors
- Verify network connectivity
- Ensure port 8765 is not in use

---

### Issue: Metrics Collection Not Starting

**Symptoms:**
```
tail: cannot open logs/metrics/deployment-metrics-*.jsonl: No such file or directory
```

**Troubleshooting:**
```bash
# Verify setup was run
ls -la logs/monitoring/

# Start monitoring setup
./scripts/setup-deployment-monitoring.sh

# Start metrics collection
./scripts/start-deployment-monitoring.sh

# Verify background process
ps aux | grep collect-deployment-metrics
```

**Solution:**
- Run setup script first
- Verify scripts are executable: `chmod +x scripts/collect-*.sh`
- Check for permission errors in logs/monitoring/

---

### Issue: Rollback Fails

**Symptoms:**
```
[ERROR] Rollback script failed
[ERROR] Failed to restart previous version containers
```

**Troubleshooting:**
```bash
# Manually check previous version image
docker image ls | grep basset-hound-browser

# Pull previous version if needed
docker pull basset-hound-browser:12.7.0

# Manually stop new version
docker stop $(docker ps -q --filter "label=basset.role=canary")
docker stop $(docker ps -q --filter "label=basset.role=production")

# Manually start previous version
docker run -d \
  --name basset-hound-browser \
  --network basset-hound-browser \
  -p 8765:8765 \
  basset-hound-browser:12.7.0

# Verify health
curl http://localhost:8765/health
```

**Solution:**
- Ensure previous version image exists
- Manually execute rollback steps if automated script fails
- Contact on-call engineer for assistance

---

## Quick Reference

### Essential Commands

```bash
# Start deployment
./scripts/deploy-canary.sh 12.8.0              # Canary (5%)
./scripts/deploy-scale.sh 12.8.0 25            # Phase 1 (25%)
./scripts/deploy-scale.sh 12.8.0 50            # Phase 2 (50%)
./scripts/deploy-scale.sh 12.8.0 100           # Phase 3 (100%)

# Setup monitoring
./scripts/setup-deployment-monitoring.sh
./scripts/start-deployment-monitoring.sh

# Emergency rollback
./scripts/rollback.sh 12.7.0

# Check status
docker ps --filter "label=basset.version"
curl http://localhost:8765/health | jq '.'

# View logs
tail -f logs/deployment/canary-*.log
tail -f logs/metrics/deployment-metrics-*.jsonl
tail -f logs/alerts.log
```

### Critical Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| DevOps Lead | devops@example.com | 24/7 |
| On-Call | oncall@example.com | During deployment |
| Platform Team | platform@example.com | Business hours |

---

## Sign-Off

**Deployment Runbook Approval:**

- [ ] DevOps Lead Review
- [ ] Platform Team Review
- [ ] Security Review
- [ ] Approved for Production Use

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-21 | DevOps Team | Initial creation |

---

**Next Steps:**
1. Set up monitoring: `./scripts/setup-deployment-monitoring.sh`
2. Begin canary deployment when ready: `./scripts/deploy-canary.sh [VERSION]`
3. Monitor metrics and logs continuously
4. Progress through phases based on approval criteria
5. Complete post-deployment validation

For questions or issues, contact: devops@example.com
