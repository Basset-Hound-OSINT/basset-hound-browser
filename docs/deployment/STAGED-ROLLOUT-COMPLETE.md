# Staged Rollout Guide - Basset Hound Browser

**Document Version:** 2.0  
**Last Updated:** June 4, 2026  
**Classification:** Internal Operations  
**Audience:** DevOps, SRE, Engineering Teams

---

## Table of Contents

1. [Overview](#overview)
2. [Staged Rollout Strategy](#staged-rollout-strategy)
3. [Phase Architecture](#phase-architecture)
4. [Canary Deployment (5% Traffic)](#canary-deployment-5-traffic)
5. [Phase 1 Rollout (25% Traffic)](#phase-1-rollout-25-traffic)
6. [Phase 2 Rollout (50% Traffic)](#phase-2-rollout-50-traffic)
7. [Phase 3 Rollout (100% Traffic)](#phase-3-rollout-100-traffic)
8. [Rollback Procedures](#rollback-procedures)
9. [Success Criteria](#success-criteria)
10. [Monitoring Checklist](#monitoring-checklist)
11. [Communication Plan](#communication-plan)
12. [Appendices](#appendices)

---

## Overview

The Staged Rollout Guide provides a proven methodology for deploying new versions of Basset Hound Browser to production with minimal risk. By gradually increasing traffic to new instances while monitoring for issues, we maintain service stability while validating the new release.

### Key Principles

- **Incremental Risk:** Start with 5% of traffic, increase gradually
- **Rapid Feedback:** Detect issues early, before they impact all users
- **Quick Recovery:** Rollback any stage in <5 minutes
- **Continuous Monitoring:** Real-time metrics during entire rollout
- **Team Validation:** Human decision-makers at each stage gate

### Expected Timeline

| Stage | Traffic | Duration | Total Elapsed |
|-------|---------|----------|----------------|
| Canary | 5% | 45 min deploy + 4 hours monitor | 4h 45m |
| Phase 1 | 25% | 60 minutes | 5h 45m |
| Phase 2 | 50% | 45 minutes | 6h 30m |
| Phase 3 | 100% | 30 minutes | 7h 00m |
| **Validation** | - | 15 minutes | **7h 15m** |

**Total Time:** Approximately 7-8 hours from start to 100% deployment + validation

---

## Staged Rollout Strategy

### Traffic Distribution Model

Each stage introduces new instances carrying a percentage of live traffic:

```
CURRENT STATE (v11.3.0):
  Instance 1 (25% traffic)
  Instance 2 (25% traffic)
  Instance 3 (25% traffic)
  Instance 4 (25% traffic)
  Total: 4 instances, 100% healthy

CANARY (5% → v12.0.0):
  Instance 5 (5% traffic) ← NEW - v12.0.0
  Instance 1 (23.75% traffic) ← v11.3.0
  Instance 2 (23.75% traffic) ← v11.3.0
  Instance 3 (23.75% traffic) ← v11.3.0
  Instance 4 (23.75% traffic) ← v11.3.0
  Total: 5 instances, 95% v11.3.0, 5% v12.0.0

PHASE 1 (25% → v12.0.0):
  Instance 5 (5% traffic) ← v12.0.0
  Instance 6 (10% traffic) ← NEW - v12.0.0
  Instance 7 (10% traffic) ← NEW - v12.0.0
  Instance 1 (25% traffic) ← v11.3.0
  Instance 2 (25% traffic) ← v11.3.0
  Instance 3 (25% traffic) ← v11.3.0
  Total: 7 instances, 75% v11.3.0, 25% v12.0.0

PHASE 2 (50% → v12.0.0):
  Instance 5 (5% traffic) ← v12.0.0
  Instance 6 (10% traffic) ← v12.0.0
  Instance 7 (10% traffic) ← v12.0.0
  Instance 8 (10% traffic) ← NEW - v12.0.0
  Instance 9 (15% traffic) ← NEW - v12.0.0
  Instance 1 (25% traffic) ← v11.3.0
  Instance 2 (25% traffic) ← v11.3.0
  Total: 9 instances, 50% v11.3.0, 50% v12.0.0

PHASE 3 (100% → v12.0.0):
  Instance 5 (10% traffic) ← v12.0.0
  Instance 6 (10% traffic) ← v12.0.0
  Instance 7 (10% traffic) ← v12.0.0
  Instance 8 (10% traffic) ← v12.0.0
  Instance 9 (15% traffic) ← v12.0.0
  Instance 10 (25% traffic) ← NEW - v12.0.0
  Instance 11 (20% traffic) ← NEW - v12.0.0
  Total: 11 instances, 0% v11.3.0, 100% v12.0.0
```

### Load Balancer Configuration

The load balancer uses weighted routing to control traffic distribution:

```nginx
# Canary (5% traffic)
upstream v11_3_0 {
    server 10.0.1.10 weight=95;  # 95% of traffic
    server 10.0.1.11 weight=95;
    server 10.0.1.12 weight=95;
    server 10.0.1.13 weight=95;
}
upstream v12_0_0 {
    server 10.0.2.10 weight=5;   # 5% of traffic
}

# Phase 1 (25% traffic)
upstream v11_3_0 {
    server 10.0.1.10 weight=75;  # 75% of traffic
    server 10.0.1.11 weight=75;
    server 10.0.1.12 weight=75;
}
upstream v12_0_0 {
    server 10.0.2.10 weight=25;  # 25% of traffic
    server 10.0.2.11 weight=25;
    server 10.0.2.12 weight=25;
}
```

---

## Phase Architecture

### Canary Deployment

**Objective:** Validate v12.0.0 with 5% of production traffic

**Duration:** 45 minutes deployment + 4 hours monitoring

**Resources Required:**
- 1 new instance (v12.0.0)
- 4 existing instances (v11.3.0)
- Load balancer with weighted routing
- Monitoring dashboards active
- On-call team standing by

**Success Criteria:**
- [ ] Instance healthy for 4 hours
- [ ] 0 container restarts
- [ ] Error rate ≤ 3× baseline
- [ ] Latency p95 within ±15% baseline
- [ ] Core commands functional
- [ ] Team sign-off obtained

**Failure Triggers (Automatic Rollback):**
- Instance crashes or becomes unhealthy
- Error rate > 10% sustained
- Latency p95 > 2× baseline
- WebSocket unreachable > 2 minutes
- Data corruption detected

---

### Phase 1 Rollout (25% Traffic)

**Objective:** Gradually increase to 25% of production traffic

**Duration:** 60 minutes

**Resources Required:**
- 1 canary instance (v12.0.0) - already running
- 2-3 new instances (v12.0.0) - to add
- 3-4 existing instances (v11.3.0) - continue running
- Load balancer adjustments
- Continued monitoring

**Success Criteria:**
- [ ] All Phase 1 instances healthy
- [ ] 0 container restarts in Phase 1
- [ ] Error rate ≤ 2× baseline (improved from canary)
- [ ] Latency p95 within ±15% baseline
- [ ] Load distribution even across instances
- [ ] Team sign-off for Phase 2

**Decision Point After Phase 1:**
- ✓ **GO to Phase 2:** All criteria met → Proceed immediately
- ✗ **ROLLBACK:** Any critical issue → Execute rollback, investigate

---

### Phase 2 Rollout (50% Traffic)

**Objective:** Reach 50-50 split between v11.3.0 and v12.0.0

**Duration:** 45 minutes

**Resources Required:**
- 5 instances at v12.0.0 (carry forward from Phase 1)
- 2-3 new instances (v12.0.0) - to add
- 2-3 existing instances (v11.3.0) - continue running
- Load balancer adjustments
- Continued monitoring

**Success Criteria:**
- [ ] All Phase 2 instances healthy
- [ ] 0 container restarts in Phase 2
- [ ] Error rate ≤ 1.5× baseline (further improvement)
- [ ] Latency p95 within ±12% baseline
- [ ] Load distribution even across 50% split
- [ ] Team sign-off for Phase 3

**Decision Point After Phase 2:**
- ✓ **GO to Phase 3:** All criteria met → Proceed immediately
- ✗ **ROLLBACK:** Any critical issue → Execute rollback, investigate

---

### Phase 3 Rollout (100% Traffic)

**Objective:** Complete migration to v12.0.0, remove all v11.3.0 instances

**Duration:** 30 minutes

**Resources Required:**
- 5 instances at v12.0.0 (carry forward from Phase 2)
- 3-4 new instances (v12.0.0) - to complete fleet
- Load balancer final adjustments
- Continued monitoring

**Success Criteria:**
- [ ] All instances at v12.0.0
- [ ] 0 container restarts in Phase 3
- [ ] Error rate at or below baseline
- [ ] Latency p95 within ±10% baseline
- [ ] 100% of traffic on v12.0.0
- [ ] Team confirmation

**Completion:**
- ✓ **SUCCESS:** All v12.0.0 instances healthy and receiving 100% traffic
- Move to post-deployment validation

---

## Canary Deployment (5% Traffic)

### Pre-Deployment Checklist (30 minutes)

Complete **48 hours before** canary deployment:

**Release Validation:**
- [ ] v12.0.0 Docker image built and pushed to registry
- [ ] Docker image SHA verified: `sha256:_________________`
- [ ] Release notes finalized and reviewed
- [ ] Changelog verified for accuracy
- [ ] No breaking changes identified in API
- [ ] Migration guide (if applicable) prepared

**Code Quality:**
- [ ] Code review completed and approved
- [ ] All critical tests passing (100%)
- [ ] Security scan passed (no critical vulns)
- [ ] Performance tests show acceptable metrics
- [ ] Load test completed successfully
- [ ] Functional tests all passing

**Infrastructure Setup:**
- [ ] New canary host provisioned (v12.0.0)
- [ ] Canary host healthy and ready
- [ ] All 4 production instances healthy (v11.3.0)
- [ ] Load balancer tested with weighted routing
- [ ] Network connectivity verified
- [ ] Firewall rules verified

**Monitoring & Alerting:**
- [ ] Prometheus scrape configs updated for canary
- [ ] Grafana canary dashboard created
- [ ] Alert rules configured for canary
- [ ] Slack/PagerDuty integration verified
- [ ] Log aggregation pipeline tested
- [ ] Elasticsearch indexes created

**Data & Backups:**
- [ ] Database backup created and verified
- [ ] Session store backup created
- [ ] Configuration backup created
- [ ] All backups tested for restore
- [ ] Backup retention policy verified

**Team Readiness:**
- [ ] All on-call contacts confirmed and available
- [ ] War room created (if needed)
- [ ] Communication channels verified (Slack, email, phone)
- [ ] Escalation procedures reviewed with team
- [ ] Runbooks printed/accessible to all team members
- [ ] Team training/walkthrough completed

### Canary Deployment Procedure (45 minutes)

**Step 1: Pre-Deployment Verification (5 minutes)**

```bash
# Verify infrastructure
docker ps  # Check running instances
docker stats  # Check resource usage
curl http://load-balancer:8765/health  # Verify LB health

# Verify baseline metrics
curl http://prometheus:9090/api/v1/query?query=http_requests_per_second
curl http://prometheus:9090/api/v1/query?query=http_request_latency_p95
curl http://prometheus:9090/api/v1/query?query=process_resident_memory_bytes

# Document baseline
Requests/sec: ___________
Latency P95:  ___________
Memory:       ___________
Error Rate:   ___________
```

**Step 2: Deploy Canary Instance (10 minutes)**

```bash
# Pull image
docker pull registry.company.com/basset-hound:v12.0.0

# Verify image
docker image inspect registry.company.com/basset-hound:v12.0.0 | grep -A 5 RepoDigests

# Create container
docker run -d \
  --name basset-canary-v12 \
  --net basset-hound-browser \
  -p 10001:8765 \
  -e INSTANCE_ID=canary-v12-001 \
  -e LOG_LEVEL=info \
  -v basset-data:/data \
  registry.company.com/basset-hound:v12.0.0

# Wait for startup
sleep 10

# Verify health
docker logs basset-canary-v12 | grep -i "listening\|ready\|health"

# Check container stats
docker stats basset-canary-v12 --no-stream
```

**Step 3: Verify Canary Health (10 minutes)**

```bash
# Check service readiness
curl -i http://10.0.2.10:8765/health

# Expected response:
# HTTP/1.1 200 OK
# {"status":"healthy","version":"12.0.0","uptime":"10s"}

# Test WebSocket connection
wscat -c ws://10.0.2.10:8765

# Issue test command
{"id":"test-1","method":"getStatus","params":{}}

# Expected response includes version 12.0.0

# Exit wscat: Ctrl+C
```

**Step 4: Enable Canary Traffic (5 minutes)**

```bash
# Update load balancer configuration
# Change weight from 0 to 5 for canary instance

# Verify traffic distribution
# Watch metrics for 2 minutes

# Confirm metrics show canary receiving ~5% of traffic
curl http://prometheus:9090/api/v1/query?query=requests_by_instance

# Document time canary went live
Canary Live At: ___________ (UTC)
```

**Step 5: Initial Health Check (5 minutes)**

```bash
# Check canary instance metrics
docker stats basset-canary-v12 --no-stream

# Check canary error rate
curl http://prometheus:9090/api/v1/query?query=error_rate{instance="canary-v12-001"}

# Check canary latency
curl http://prometheus:9090/api/v1/query?query=request_latency_p95{instance="canary-v12-001"}

# Document initial metrics
Error Rate:   ___________
Latency P95:  ___________
Memory:       ___________
CPU:          ___________
Status:       ✓ Healthy / ✗ Issues
```

### Canary Monitoring Procedures (4 hours)

**Hour 1: Intensive Monitoring (Every 15 minutes)**

| Time | Check | Status | Notes |
|------|-------|--------|-------|
| 0:00 | Canary deployed and live | ✓ | |
| 0:15 | Health check + metrics | ✓ | |
| 0:30 | Error rate + latency | ✓ | |
| 0:45 | Container logs review | ✓ | |
| 1:00 | Full health assessment | ✓ | |

**Metrics to Monitor:**

```bash
# Run every 15 minutes in hour 1
echo "=== CANARY HEALTH CHECK ==="
echo "Instance: basset-canary-v12"
echo "Time: $(date -u +%H:%M:%S UTC)"
echo ""
echo "Container Status:"
docker inspect basset-canary-v12 | grep -E "State|Status"
echo ""
echo "Resource Usage:"
docker stats basset-canary-v12 --no-stream
echo ""
echo "Error Rate (last 5 min):"
curl -s http://prometheus:9090/api/v1/query \
  --data-urlencode 'query=rate(errors_total{instance="canary-v12-001"}[5m])' | jq .
echo ""
echo "Request Latency P95 (last 5 min):"
curl -s http://prometheus:9090/api/v1/query \
  --data-urlencode 'query=histogram_quantile(0.95, request_duration_seconds{instance="canary-v12-001"})' | jq .
```

**Hours 2-4: Standard Monitoring (Every 30 minutes)**

| Time | Check | Status | Notes |
|------|-------|--------|-------|
| 1:30 | Health check + metrics | ✓ | |
| 2:00 | Error rate + latency | ✓ | |
| 2:30 | Container health | ✓ | |
| 3:00 | Full metrics review | ✓ | |
| 3:30 | Canary stability | ✓ | |
| 4:00 | Final health check | ✓ | |

**Log Review Procedure:**

```bash
# Review canary logs every hour
echo "=== CANARY LOG REVIEW ==="
echo "Errors in last 60 minutes:"
docker logs --since 60m basset-canary-v12 | grep -i error | head -20

echo ""
echo "Critical errors:"
docker logs --since 60m basset-canary-v12 | grep -i critical | head -10

echo ""
echo "Warnings:"
docker logs --since 60m basset-canary-v12 | grep -i warning | head -10

echo ""
echo "Recent activity (last 20 lines):"
docker logs --tail 20 basset-canary-v12
```

### Canary Go/No-Go Decision

**Decision Time:** After 4 hours of monitoring

**GO Criteria (All must pass):**

- [x] Container running continuously for 4 hours
  - Check: `docker inspect basset-canary-v12 | grep -i startedAt`
  - Expected: Started time is 4 hours ago or earlier

- [x] 0 container restarts
  - Check: `docker inspect basset-canary-v12 | grep -i restartcount`
  - Expected: RestartCount is 0

- [x] Error rate ≤ 3× baseline
  - Baseline Error Rate: ___________
  - Current Error Rate: ___________
  - Max Allowed: ___________
  - Status: ✓ PASS / ✗ FAIL

- [x] Latency P95 within ±15% of baseline
  - Baseline Latency: ___________
  - Current Latency: ___________
  - Acceptable Range: __________ - __________
  - Status: ✓ PASS / ✗ FAIL

- [x] Core commands functional
  - Test: navigate (✓/✗)
  - Test: click (✓/✗)
  - Test: fillForm (✓/✗)
  - Test: screenshot (✓/✗)
  - Test: getStatus (✓/✗)
  - Overall: ✓ PASS / ✗ FAIL

- [x] Data integrity maintained
  - Test: Create session (✓/✗)
  - Test: Store data (✓/✗)
  - Test: Retrieve data (✓/✗)
  - Overall: ✓ PASS / ✗ FAIL

- [x] Team sign-off obtained
  - Technical Lead: _________________ Date: _____
  - SRE Lead: _________________ Date: _____

**GO Decision:**

```
✓ GO TO PHASE 1 ROLLOUT
→ Proceed with progressive rollout to 25% traffic
→ Execute PHASE-1-ROLLOUT procedure

✗ NO-GO / ROLLBACK
→ Execute ROLLBACK procedure
→ Investigate root cause
→ Schedule post-deployment analysis
```

---

## Phase 1 Rollout (25% Traffic)

### Pre-Phase 1 Verification (10 minutes)

```bash
# Verify canary still healthy
docker inspect basset-canary-v12 | grep -E "State|Status"
docker stats basset-canary-v12 --no-stream

# Verify all v11.3.0 instances healthy
for instance in prod-001 prod-002 prod-003 prod-004; do
  echo "Instance: $instance"
  docker inspect $instance | grep -E "State|Status"
done

# Verify load balancer health
curl http://load-balancer:8765/health

# Verify monitoring active
curl http://prometheus:9090/-/healthy

# Document verification
Time Started: ___________
Canary Status: ✓ Healthy / ✗ Issues
Production Status: ✓ Healthy / ✗ Issues
LB Status: ✓ Healthy / ✗ Issues
Ready to Proceed: ✓ YES / ✗ NO
```

### Deploy Phase 1 Instances (20 minutes)

**Deploy 2-3 new instances to carry 20% of canary's traffic:**

```bash
# Instance 1
docker run -d \
  --name basset-phase1-v12-001 \
  --net basset-hound-browser \
  -p 10002:8765 \
  -e INSTANCE_ID=phase1-v12-001 \
  -v basset-data:/data \
  registry.company.com/basset-hound:v12.0.0

# Instance 2
docker run -d \
  --name basset-phase1-v12-002 \
  --net basset-hound-browser \
  -p 10003:8765 \
  -e INSTANCE_ID=phase1-v12-002 \
  -v basset-data:/data \
  registry.company.com/basset-hound:v12.0.0

# Instance 3 (optional)
docker run -d \
  --name basset-phase1-v12-003 \
  --net basset-hound-browser \
  -p 10004:8765 \
  -e INSTANCE_ID=phase1-v12-003 \
  -v basset-data:/data \
  registry.company.com/basset-hound:v12.0.0

# Wait for startup
sleep 15

# Verify all instances healthy
for i in 1 2 3; do
  curl -i http://10.0.2.1$i:8765/health
done
```

### Enable Phase 1 Traffic (10 minutes)

```bash
# Update load balancer weights
# - Canary: 5% → 5%
# - Phase1-001: 0% → 10%
# - Phase1-002: 0% → 10%
# - Production: 95% → 75%

# Verify traffic distribution
sleep 30
curl http://prometheus:9090/api/v1/query?query=requests_by_instance

# Document
Phase 1 Live At: ___________ (UTC)
Target Distribution: 25% v12.0.0, 75% v11.3.0
Current Distribution: ___________
Status: ✓ Correct / ✗ Mismatch
```

### Phase 1 Monitoring (60 minutes)

**Monitoring Schedule:**

| Time | Check | Status |
|------|-------|--------|
| 0:00 | Phase 1 deployed + traffic enabled | ✓ |
| 0:15 | Health check + metrics | ✓ |
| 0:30 | Error rate + latency | ✓ |
| 0:45 | Load distribution | ✓ |
| 1:00 | Final assessment | ✓ |

**Metrics Comparison (Phase 1 vs Baseline):**

```
Metric              | Baseline   | Phase 1 Current | Status
--------------------|-----------|-----------------|--------
Error Rate (5 min)  | _________ | _____________ | ✓/✗
Latency P95         | _________ | _____________ | ✓/✗
Memory (avg)        | _________ | _____________ | ✓/✗
CPU (avg)           | _________ | _____________ | ✓/✗
Success Rate        | _________ | _____________ | ✓/✗
Throughput          | _________ | _____________ | ✓/✗
```

### Phase 1 Success Criteria

**All items must be ✓ PASS for GO decision:**

- [x] All Phase 1 instances healthy (docker inspect, 0 restarts)
- [x] 0 container restarts in Phase 1
- [x] Error rate ≤ 2× baseline
- [x] Latency p95 within ±15% baseline
- [x] Load distribution: ~25% on v12.0.0, ~75% on v11.3.0
- [x] Core commands functional on Phase 1 instances
- [x] No data corruption detected
- [x] Team sign-off obtained

**Decision:**

```
✓ GO TO PHASE 2 ROLLOUT
→ Proceed with 50% traffic rollout
→ Expected timeline: 45 minutes

✗ ROLLBACK TO v11.3.0 ONLY
→ Execute ROLLBACK procedure immediately
→ Investigate root cause
→ Schedule post-deployment analysis
```

---

## Phase 2 Rollout (50% Traffic)

### Pre-Phase 2 Verification (10 minutes)

```bash
# Verify all Phase 1 instances still healthy
for i in 001 002; do
  docker inspect basset-phase1-v12-$i | grep -E "State|Status"
done

# Verify all v11.3.0 instances healthy
for instance in prod-001 prod-002 prod-003 prod-004; do
  docker inspect $instance | grep -E "State|Status"
done

# Document verification time
Phase 2 Pre-Check: ___________ (UTC)
Status: ✓ Ready / ✗ Wait
```

### Deploy Phase 2 Instances (15 minutes)

**Deploy 2-3 new instances to reach 50%:**

```bash
# Instance 1
docker run -d \
  --name basset-phase2-v12-001 \
  --net basset-hound-browser \
  -p 10005:8765 \
  -e INSTANCE_ID=phase2-v12-001 \
  -v basset-data:/data \
  registry.company.com/basset-hound:v12.0.0

# Instance 2
docker run -d \
  --name basset-phase2-v12-002 \
  --net basset-hound-browser \
  -p 10006:8765 \
  -e INSTANCE_ID=phase2-v12-002 \
  -v basset-data:/data \
  registry.company.com/basset-hound:v12.0.0

# Instance 3 (optional)
docker run -d \
  --name basset-phase2-v12-003 \
  --net basset-hound-browser \
  -p 10007:8765 \
  -e INSTANCE_ID=phase2-v12-003 \
  -v basset-data:/data \
  registry.company.com/basset-hound:v12.0.0

sleep 15

# Health check
for i in 001 002 003; do
  curl -i http://10.0.3.1$i:8765/health
done
```

### Enable Phase 2 Traffic (10 minutes)

```bash
# Update load balancer weights to 50-50
# - Canary: 5% → 10%
# - Phase1-001: 10% → 15%
# - Phase1-002: 10% → 15%
# - Phase2-001: 0% → 10%
# - Phase2-002: 0% → 10%
# - Production: 75% → 40%

sleep 30
curl http://prometheus:9090/api/v1/query?query=requests_by_version

# Document
Phase 2 Live At: ___________ (UTC)
Target: 50% v12.0.0, 50% v11.3.0
Current: ___________
```

### Phase 2 Monitoring (45 minutes)

**Monitoring Schedule:**

| Time | Check | Status |
|------|-------|--------|
| 0:00 | Phase 2 deployed + traffic enabled | ✓ |
| 0:15 | Health check + metrics | ✓ |
| 0:30 | Error rate + latency | ✓ |
| 0:45 | Final assessment | ✓ |

### Phase 2 Success Criteria

- [x] All Phase 2 instances healthy
- [x] 0 container restarts in Phase 2
- [x] Error rate ≤ 1.5× baseline (improving trend)
- [x] Latency p95 within ±15% baseline
- [x] Load distribution: ~50% v12.0.0, ~50% v11.3.0
- [x] No performance regression
- [x] Team sign-off obtained

**Decision:**

```
✓ GO TO PHASE 3 (100% TRAFFIC)
→ Proceed with complete migration
→ Expected timeline: 30 minutes

✗ ROLLBACK TO v11.3.0 ONLY
→ Execute rollback immediately
```

---

## Phase 3 Rollout (100% Traffic)

### Pre-Phase 3 Verification (10 minutes)

```bash
# Verify all instances health
for phase in canary phase1-v12-001 phase1-v12-002 phase2-v12-001 phase2-v12-002; do
  docker inspect basset-$phase | grep -E "State|Status"
done

# Verify v11.3.0 instances still healthy
for instance in prod-001 prod-002 prod-003 prod-004; do
  docker inspect $instance | grep -E "State|Status"
done

# Document verification
Phase 3 Pre-Check: ___________ (UTC)
Status: ✓ Ready / ✗ Wait
```

### Deploy Phase 3 Final Instances (15 minutes)

**Deploy final instances to replace remaining v11.3.0:**

```bash
# Instances 1-3 (replace prod-002, prod-003, prod-004)
for i in 1 2 3; do
  docker run -d \
    --name basset-phase3-v12-00$i \
    --net basset-hound-browser \
    -p $((10007 + i)):8765 \
    -e INSTANCE_ID=phase3-v12-00$i \
    -v basset-data:/data \
    registry.company.com/basset-hound:v12.0.0
done

sleep 15

# Health check all Phase 3 instances
for i in 1 2 3; do
  curl -i http://10.0.4.$i:8765/health
done
```

### Enable Phase 3 Traffic - Complete Migration (10 minutes)

```bash
# Update load balancer to 100% v12.0.0
# Remove all v11.3.0 instances from LB
# Add all v12.0.0 instances to LB

sleep 30

# Verify 100% traffic on v12.0.0
curl http://prometheus:9090/api/v1/query?query=requests_by_version

# Document
Phase 3 Live At: ___________ (UTC)
Distribution: ✓ 100% v12.0.0 / ✗ Incomplete
```

### Phase 3 Final Steps (10 minutes)

**Keep v11.3.0 instances running for 1 hour, then decommission:**

```bash
# Document the time for keeping old instances
Decommission Time (1 hour later): ___________ (UTC)

# At decommission time:
for instance in prod-001 prod-002 prod-003 prod-004; do
  docker stop $instance
  docker rm $instance
done

# Verify no v11.3.0 in fleet
docker ps | grep -i "v11.3.0"  # Should return nothing
```

### Phase 3 Monitoring & Validation (30 minutes)

**Immediate Monitoring (0-30 minutes):**

| Time | Check | Status |
|------|-------|--------|
| 0:00 | Phase 3 deployed + 100% traffic | ✓ |
| 0:15 | Health check + metrics | ✓ |
| 0:30 | Final assessment | ✓ |

### Phase 3 Success Criteria

- [x] All instances running v12.0.0
- [x] 100% of traffic on v12.0.0
- [x] Error rate at or below baseline
- [x] Latency p95 within ±10% baseline
- [x] 0 container restarts in Phase 3
- [x] No data issues detected
- [x] Team confirmation

**Status: ✓ COMPLETE - Ready for Post-Deployment Validation**

---

## Rollback Procedures

### When to Rollback

**Automatic Rollback Triggers (No approval needed):**

1. Container unreachable or unresponsive (WebSocket port)
2. Error rate > 10% sustained for 5+ minutes
3. Memory usage > 150% of baseline and growing
4. Data corruption detected
5. Service unable to respond to health checks

**Approval Required Rollbacks:**

1. Error rate > 5% for 15+ minutes
2. Latency > 2× baseline for 10+ minutes
3. Specific feature completely broken
4. Integration failures with dependencies
5. Team decision (concerns raised by technical lead)

### Rollback Decision Tree

```
INCIDENT DETECTED
├─ Is it a container crash?
│  ├─ YES → AUTOMATIC ROLLBACK (execute immediately)
│  └─ NO → Check error rate
│
├─ Is error rate > 10%?
│  ├─ YES → AUTOMATIC ROLLBACK (execute immediately)
│  └─ NO → Check latency
│
├─ Is latency > 2× baseline?
│  ├─ YES (sustained >10 min) → APPROVAL ROLLBACK (get sign-off)
│  └─ NO → Check for specific failures
│
├─ Is a critical feature broken?
│  ├─ YES → APPROVAL ROLLBACK (get sign-off)
│  └─ NO → Continue monitoring
│
└─ Monitor and escalate if needed
   Escalation: Level 2 (Engineering Lead) at 15 minutes
   Level 3 escalation if at 30 minutes without resolution
```

### Rollback Execution - Single Instance

**Use for:** Initial rollback when issue detected in early phases

**Duration:** 5 minutes per instance

**Procedure:**

```bash
# Step 1: Drain instance from load balancer (1 min)
# Update LB config to remove instance from pool
# Wait for in-flight requests to complete

# Step 2: Stop new instance (1 min)
docker stop basset-canary-v12 --time=30

# Step 3: Restart old instance (30 sec)
# (assuming it was stopped during deployment)
docker start basset-prod-001
# OR deploy v11.3.0:
docker run -d \
  --name basset-prod-001-restore \
  --net basset-hound-browser \
  -p 8765:8765 \
  -v basset-data:/data \
  registry.company.com/basset-hound:v11.3.0

# Step 4: Add back to load balancer (30 sec)
# Update LB config to include restored instance
sleep 10

# Step 5: Verify health (30 sec)
curl http://10.0.1.1:8765/health

# Step 6: Notify team (1 min)
echo "Instance rollback complete. Monitoring restored instance."
```

### Rollback Execution - Fleet-Wide

**Use for:** Rollback when multiple instances affected or during phase deployment

**Duration:** 3-4 minutes total

**Procedure:**

```bash
# Step 1: Drain all new instances from load balancer (1 min)
# Update LB config to remove all v12.0.0 instances

# Step 2: Stop all new instances (1 min)
docker stop basset-canary-v12 basset-phase1-v12-001 basset-phase1-v12-002 --time=30

# Step 3: Verify old instances available (1 min)
for instance in prod-001 prod-002 prod-003 prod-004; do
  docker inspect $instance
done

# Step 4: Restore to load balancer (1 min)
# Update LB config to restore all v11.3.0 instances
# Set weights back to 25% each

# Step 5: Verify health (1 min)
for instance in prod-001 prod-002 prod-003 prod-004; do
  curl -i http://10.0.1.1$i:8765/health
done

# Step 6: Cleanup (1 min)
# Remove v12.0.0 containers
docker rm basset-canary-v12 basset-phase1-v12-001 basset-phase1-v12-002

# Step 7: Notify team and stakeholders
echo "Fleet rollback complete. All traffic on v11.3.0."
```

### Post-Rollback Actions

1. **Immediate (0-5 minutes):**
   - [ ] Verify all instances healthy on v11.3.0
   - [ ] Confirm 100% traffic on v11.3.0
   - [ ] Send incident notification

2. **Short-term (5-30 minutes):**
   - [ ] Collect error logs from v12.0.0 instances
   - [ ] Document issue and rollback decision
   - [ ] Schedule war room / post-mortem
   - [ ] Notify stakeholders of delay

3. **Investigation (1-24 hours):**
   - [ ] Root cause analysis
   - [ ] Log analysis and debugging
   - [ ] Code review of problematic changes
   - [ ] Plan remediation / fix

4. **Re-deployment (after fix):**
   - [ ] Deploy fix to staging
   - [ ] Run full test suite
   - [ ] Execute new canary deployment
   - [ ] Document lessons learned

---

## Success Criteria

### Canary Phase Success

**Must achieve all of:**

1. ✓ Uptime: Container running 4h without restart
2. ✓ Stability: 0 restarts, 0 crashes
3. ✓ Functionality: Core commands working (navigate, click, screenshot, etc.)
4. ✓ Performance: Error rate ≤ 3× baseline, latency ±15%
5. ✓ Data: No corruption, no loss
6. ✓ Logs: < 10 error entries across 4 hours
7. ✓ Team: Technical lead sign-off obtained

**If all met:** ✓ GO to Phase 1  
**If any fail:** ✗ ROLLBACK to v11.3.0

### Phase 1 (25%) Success

**Must achieve all of:**

1. ✓ Instances: All 3 instances healthy, 0 restarts
2. ✓ Traffic: Correct distribution (~25% on new instances)
3. ✓ Performance: Error rate ≤ 2× baseline (improving)
4. ✓ Latency: p95 within ±15% baseline
5. ✓ Load: Even distribution, no hot spots
6. ✓ Functionality: All commands working on new instances
7. ✓ Team: Sign-off for Phase 2

**If all met:** ✓ GO to Phase 2  
**If any fail:** ✗ ROLLBACK to v11.3.0

### Phase 2 (50%) Success

**Must achieve all of:**

1. ✓ Instances: All new instances healthy, 0 restarts
2. ✓ Traffic: 50-50 split maintained
3. ✓ Performance: Error rate ≤ 1.5× baseline (further improved)
4. ✓ Latency: p95 within ±12% baseline
5. ✓ Stability: No performance degradation trend
6. ✓ Data: No corruption or loss
7. ✓ Team: Sign-off for Phase 3

**If all met:** ✓ GO to Phase 3  
**If any fail:** ✗ ROLLBACK to v11.3.0

### Phase 3 (100%) Success

**Must achieve all of:**

1. ✓ Fleet: All instances running v12.0.0
2. ✓ Traffic: 100% on v12.0.0
3. ✓ Performance: Error rate at or below baseline
4. ✓ Latency: p95 within ±10% baseline
5. ✓ Stability: 0 restarts during migration
6. ✓ Data: Perfect integrity throughout
7. ✓ Functionality: All features working
8. ✓ Team: Confirmation obtained

**If all met:** ✓ DEPLOYMENT SUCCESSFUL  
**Next:** Execute post-deployment validation

---

## Monitoring Checklist

### Pre-Deployment (Before Canary)

**Infrastructure Readiness:**
- [ ] All 4 production instances healthy
- [ ] Canary host ready and tested
- [ ] Load balancer tested with weights
- [ ] Network connectivity verified
- [ ] Storage/volumes verified
- [ ] Database healthy

**Monitoring Setup:**
- [ ] Prometheus scraping all instances
- [ ] Grafana dashboards loaded
- [ ] Alert rules active
- [ ] Log aggregation pipeline working
- [ ] Slack/PagerDuty integration active
- [ ] Baseline metrics captured

### During Canary (4 hours)

**Every 15 minutes (Hour 1):**
- [ ] Container running (docker ps)
- [ ] Health endpoint responding (HTTP 200)
- [ ] Error rate (acceptable level)
- [ ] Latency (within range)
- [ ] Memory usage (stable, no growth)
- [ ] CPU usage (reasonable)

**Every 30 minutes (Hours 2-4):**
- [ ] Health checks passing
- [ ] Error rate trend (stable, not increasing)
- [ ] Latency trend (stable, not degrading)
- [ ] Memory trend (no leak)
- [ ] No restarted containers
- [ ] Logs reviewed (no critical errors)

### During Phase 1-3 Rollouts (5-45 min each)

**Every 15 minutes:**
- [ ] All instances healthy
- [ ] Traffic distribution correct
- [ ] Error rate acceptable
- [ ] Latency within range
- [ ] Load balanced across instances
- [ ] No container restarts
- [ ] Logs clean (no errors)

### Metrics to Track

**Critical Metrics (monitor every 15 min):**

1. **Container Health**
   - Metric: `docker_container_state_running`
   - Alert: If any instance = 0 for > 1 minute
   - Action: Immediate investigation/rollback

2. **Error Rate**
   - Metric: `http_requests_failed_total / http_requests_total`
   - Baseline: _______
   - Max Allowed: _______ (3× canary, 2× phase1, 1.5× phase2, 1× phase3)
   - Alert: If exceeds max for > 5 minutes

3. **Request Latency P95**
   - Metric: `histogram_quantile(0.95, request_duration_seconds)`
   - Baseline: _______
   - Max Allowed: _______ ±15% all phases
   - Alert: If exceeds max for > 10 minutes

4. **Memory Usage**
   - Metric: `container_memory_usage_bytes`
   - Baseline: _______
   - Max Allowed: _______ (150% baseline)
   - Alert: If growing > 10% per hour

5. **CPU Usage**
   - Metric: `rate(container_cpu_usage_seconds_total[5m])`
   - Expected: _______
   - Alert: If > 80% for > 10 minutes

**Secondary Metrics (check every 30 min):**

6. **Success Rate**
   - Metric: `http_requests_succeeded / http_requests_total`
   - Expected: > 99.5%
   - Alert: If drops below threshold

7. **WebSocket Connections**
   - Metric: `websocket_connections_active`
   - Expected: Stable at ~baseline level
   - Alert: If drops significantly

8. **Throughput**
   - Metric: `http_requests_per_second`
   - Expected: Within ±20% of baseline
   - Alert: If unusual deviation

9. **Disk Usage**
   - Metric: `node_filesystem_avail_bytes`
   - Expected: > 10% free space
   - Alert: If drops below threshold

10. **Network I/O**
    - Metric: `node_network_transmit_bytes_total`
    - Expected: Reasonable for traffic volume
    - Alert: If unusual spike

---

## Communication Plan

### Pre-Deployment Notification (48 hours before)

**Audience:** All stakeholders (sales, support, customers)

**Message Template:**

```
Subject: Planned Maintenance - Basset Hound Browser v12.0.0 Upgrade

Date/Time: [Date] [Time] UTC
Duration: Approximately 7-8 hours
Impact: No downtime expected, service continuous

We're deploying v12.0.0 with performance improvements and new features.
The deployment uses a staged rollout approach:
- Canary: 5% traffic (4h 45m)
- Phase 1: 25% traffic (1h)
- Phase 2: 50% traffic (45m)
- Phase 3: 100% traffic (30m)

Service remains available throughout. Questions? Contact support.
```

### Canary Deployment Start

**Channel:** #basset-hound-deployments Slack

**Message:**

```
🚀 CANARY DEPLOYMENT STARTED

Version: v12.0.0
Time: [timestamp] UTC
Status: In Progress
Expected Completion: [time] UTC

Traffic: 5% (1 canary instance)
Monitoring: Active
Team: Standing by

Metrics dashboard: [link]
```

### Canary Completion

**Successful Canary:**

```
✅ CANARY SUCCESSFUL

Duration: 4h 45m
Status: HEALTHY
Metrics: All green
Decision: GO TO PHASE 1

Next Step: Phase 1 rollout to 25% traffic
Estimated completion: [time] UTC
```

**Failed Canary / Rollback:**

```
⚠️ ROLLBACK EXECUTED

Issue: [Brief description]
Time: [timestamp] UTC
Duration: < 5 minutes
Status: ROLLED BACK TO v11.3.0

Service Status: ✅ Normal
Investigation: Starting
Postmortem: Scheduled
```

### Phase Transitions

**Phase 1 Start:**

```
📈 PHASE 1 ROLLOUT STARTED

Traffic: Now 25% on v12.0.0
Instances: 3 new + 4 old
Duration: ~60 minutes
Status: In Progress

Continue monitoring...
```

**Phase 2 Start:**

```
📈 PHASE 2 ROLLOUT STARTED

Traffic: Now 50% on v12.0.0 (50% on v11.3.0)
Instances: 5 new + 4 old
Duration: ~45 minutes
Status: In Progress

Metrics looking good, continuing...
```

**Phase 3 Start:**

```
📈 PHASE 3 ROLLOUT STARTED - FINAL PHASE

Traffic: Now 100% on v12.0.0
Instances: All on v12.0.0
Duration: ~30 minutes
Status: Final migration in progress

Almost done!
```

### Deployment Complete

**Success Message:**

```
✅ v12.0.0 DEPLOYMENT COMPLETE

Timeline:
├─ Canary: 4h 45m (✓ PASS)
├─ Phase 1: 60m (✓ PASS)
├─ Phase 2: 45m (✓ PASS)
├─ Phase 3: 30m (✓ PASS)
└─ Validation: 15m (✓ PASS)

Total: 7h 15m

Status: ✅ PRODUCTION READY
All instances: v12.0.0
All metrics: GREEN
All tests: PASSING

v12.0.0 is now production version 🎉
```

### Incident/Escalation Communication

**Escalation to Level 2 (15+ minutes into phase):**

```
⚠️ ESCALATION TO LEVEL 2

Phase: [Phase name]
Time: [timestamp]
Issue: [Issue description]
Action: Engineering Lead engaged
ETA: Decision in 15 minutes

Monitoring continues...
```

**Critical Issue / Rollback Decision:**

```
🚨 CRITICAL ISSUE DETECTED

Phase: [Phase name]
Issue: [Issue description]
Decision: ROLLBACK APPROVED
Action: Rolling back to v11.3.0

Expected recovery: < 5 minutes
Keeping old instances running: YES
Investigation: Starting immediately

Standby for postmortem scheduling...
```

---

## Appendices

### A. Metrics Reference

**Prometheus Query Reference:**

```bash
# Error rate (last 5 minutes)
rate(http_requests_failed_total[5m]) / rate(http_requests_total[5m])

# Request latency P95
histogram_quantile(0.95, rate(request_duration_seconds_bucket[5m]))

# Active WebSocket connections
websocket_connections_active

# Memory usage
container_memory_usage_bytes / 1024 / 1024  # MB

# CPU usage percentage
rate(container_cpu_usage_seconds_total[5m]) * 100

# Requests per second
rate(http_requests_total[5m]) / 5

# Requests by version
sum(rate(http_requests_total{version=~"v11.3.0|v12.0.0"}[5m])) by (version)

# Requests by instance
sum(rate(http_requests_total[5m])) by (instance)
```

### B. Runbook Commands

**Health Check Procedure:**

```bash
#!/bin/bash
# health-check.sh - Run canary health checks

echo "=== HEALTH CHECK REPORT ==="
echo "Time: $(date -u)"
echo ""

echo "Container Status:"
docker inspect basset-canary-v12 | grep -E '"State":|"Status":'
echo ""

echo "HTTP Health Endpoint:"
curl -s http://10.0.2.10:8765/health | jq .
echo ""

echo "WebSocket Response:"
echo '{"id":"test","method":"getStatus","params":{}}' | wscat -c ws://10.0.2.10:8765 2>/dev/null
echo ""

echo "Resource Usage:"
docker stats basset-canary-v12 --no-stream --format "{{.CPUPerc}}\t{{.MemUsage}}"
echo ""

echo "Recent Logs:"
docker logs --tail 10 basset-canary-v12
```

### C. Checklist Templates

**Canary Go/No-Go Checklist:**

```
CANARY GO/NO-GO DECISION - _____ (Date/Time)

Infrastructure Health:
  ☐ Container running continuously (4h)
  ☐ 0 container restarts
  ☐ Health endpoint responding (HTTP 200)
  ☐ All 4 production instances still healthy

Performance Metrics:
  ☐ Error rate ≤ 3× baseline
  ☐ Latency P95 within ±15% baseline
  ☐ Memory stable (no leak)
  ☐ CPU usage reasonable
  ☐ Disk usage normal

Functionality:
  ☐ Navigate command working
  ☐ Click command working
  ☐ Screenshot command working
  ☐ Form filling working
  ☐ Data storage working

Data Integrity:
  ☐ No data corruption
  ☐ No data loss
  ☐ Session management working
  ☐ Local storage intact

Team Sign-off:
  ☐ Technical Lead: _____________ Date: _____
  ☐ SRE Lead: _____________ Date: _____

DECISION:
  ☐ GO → Phase 1 Rollout
  ☐ NO-GO → Rollback to v11.3.0

Signed: _________________ Title: _____________ Date: _____
```

### D. Escalation Contacts

**Fill in before deployment:**

| Role | Name | Phone | Email | Slack |
|------|------|-------|-------|-------|
| Deployment Lead | | | | |
| Technical Lead | | | | |
| SRE Lead | | | | |
| Engineering Manager | | | | |
| On-Call Primary | | | | |
| On-Call Secondary | | | | |

---

## Document Status

**Version:** 2.0  
**Created:** May 11, 2026  
**Last Updated:** June 4, 2026  
**Status:** Production Ready  
**Next Review:** After v12.0.0 deployment  

**Approval:** _________________  
**Maintained By:** DevOps Team  

---

**End of Staged Rollout Guide**
