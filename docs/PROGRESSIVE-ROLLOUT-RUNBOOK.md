# Progressive Rollout Runbook - v12.0.0

**Document Version:** 1.0  
**Date:** May 11, 2026  
**Target Release:** Basset Hound Browser v12.0.0  
**From Version:** v11.3.0  
**Prerequisite:** Successful canary deployment (CANARY-DEPLOYMENT-RUNBOOK.md)

---

## Overview

This runbook provides step-by-step procedures for the progressive rollout of v12.0.0 from the canary instance to 25%, 50%, and finally 100% of production instances. This staged approach allows continuous monitoring and instant rollback if issues are detected.

**Total Duration:** 6 hours (2h per stage + time for validation)  
**Risk Level:** MEDIUM (staged rollout with active traffic)  
**Rollback Window:** 30 minutes or less at any stage

---

## Roles & Responsibilities

| Role | Responsibility |
|------|-----------------|
| **Deployment Lead** | Orchestrates each stage, approves progression |
| **Technical Lead** | Monitors metrics, alerts on anomalies |
| **Infrastructure Lead** | Manages load balancer, traffic routing |
| **Backup Operator** | Assists with commands, maintains runbook |
| **Communication Lead** | Updates stakeholders on stage completion |

---

## Pre-Rollout Verification (Complete before 25% stage)

### 1. Canary Approval

**Deployment Lead Actions:**

- [ ] **Confirm Canary GO Decision**
  ```bash
  # Verify canary deployment was approved
  cat /tmp/canary-decision.txt | grep "DECISION:"
  # Should show: GO TO PROGRESSIVE ROLLOUT
  ```

- [ ] **Verify Canary Still Healthy**
  ```bash
  # Quick health check
  curl -s -o /dev/null -w "%{http_code}" http://basset-canary-prod:8765
  # Should be 426 (Upgrade Required)
  ```

- [ ] **Review Canary Logs for Issues**
  ```bash
  # Check for errors during canary window
  ssh basset-canary-prod "docker logs --since 4h basset-hound-browser-prod 2>&1 | grep -i error | wc -l"
  # Should be minimal (< 10 errors)
  ```

### 2. Production Environment Ready

**Infrastructure Lead Actions:**

- [ ] **Verify all production instances**
  ```bash
  # List all production instances
  for host in basset-prod-{01..10}; do
    echo "=== $host ==="
    ssh $host "docker ps | grep basset-hound-browser"
  done
  ```

- [ ] **Confirm current load distribution**
  ```bash
  # Check load balancer configuration
  curl -s http://load-balancer:8080/stats | jq '.backends | map(.name, .activeConnections)'
  ```

- [ ] **Backup v11.3.0 images across fleet**
  ```bash
  # Tag running version for quick rollback
  for host in basset-prod-{01..10}; do
    ssh $host "docker tag basset-hound-browser:v11.3.0 basset-hound-browser:v11.3.0-pre-rollout" || true
  done
  echo "✓ v11.3.0 images backed up"
  ```

### 3. Monitoring Enhanced for Rollout

**Technical Lead Actions:**

- [ ] **Dashboards configured for each stage**
  ```bash
  # Create stage-specific monitoring views
  curl -X POST http://monitoring:8080/dashboards \
    -d '{"name": "v12-rollout-25pct", "metrics": ["response_time", "error_rate", "cpu", "memory"]}'
  ```

- [ ] **Alert thresholds configured**
  ```bash
  # Set alerts for each stage (thresholds increase as rollout progresses)
  curl -X POST http://alertmanager:9093/config \
    -d '{
      "stage": "25pct",
      "error_rate_threshold": "2%",
      "latency_threshold_p95": "1000ms",
      "memory_increase": "10%"
    }'
  ```

- [ ] **Baseline metrics captured for progression decision**
  ```bash
  # Record current v11.3.0 metrics across fleet
  echo "=== v11.3.0 Baseline (All Instances) ===" > /tmp/fleet-baseline.txt
  curl -s http://metrics:9090/api/v1/query?query=basset_avg_latency | jq '.data' >> /tmp/fleet-baseline.txt
  curl -s http://metrics:9090/api/v1/query?query=basset_error_rate | jq '.data' >> /tmp/fleet-baseline.txt
  ```

### 4. Communication Plan

**Communication Lead Actions:**

- [ ] **Stakeholder notification prepared**
  ```bash
  cat > /tmp/stage-notification-template.txt << 'EOF'
  [DEPLOYMENT UPDATE] v12.0.0 Progressive Rollout - Stage [N]
  
  Canary Results: [Approved/Issues]
  Stage: [25% / 50% / 100%]
  Affected Instances: [N] servers
  Expected Impact: [Minimal/None for this stage]
  
  Timeline:
  - Start: [HH:MM UTC]
  - Completion: [HH:MM UTC]
  - Monitoring: [Duration]
  
  Status: [In Progress/Complete]
  EOF
  ```

- [ ] **Escalation contacts verified**
  - [ ] Engineering Manager contact
  - [ ] On-call SRE contact
  - [ ] Product Manager contact

---

## STAGE 1: 25% ROLLOUT (2 hours + validation)

### Overview
- **Target:** 2-3 of 10 production instances
- **Expected Traffic:** 25% of production load
- **Rollback:** Instant, < 2 minutes

### 1a. Pre-Stage Health Check (5 minutes)

**Technical Lead Actions:**

```bash
# Record baseline before progression
STAGE_START=$(date +%s)
echo "Stage 1 (25%) started: $(date)" >> /tmp/rollout-timeline.txt

# Verify all instances are healthy on v11.3.0
for i in {01..10}; do
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://basset-prod-$i:8765)
  echo "basset-prod-$i: HTTP $HEALTH"
done
```

### 1b. Select Instances for 25% Stage (2 minutes)

**Deployment Lead + Infrastructure Lead Actions:**

```bash
# Select 2-3 instances for 25% rollout
# Strategy: Choose instances from different availability zones if possible
STAGE1_INSTANCES=(basset-prod-01 basset-prod-04 basset-prod-07)
echo "Stage 1 instances: ${STAGE1_INSTANCES[@]}" | tee -a /tmp/rollout-timeline.txt

# Verify these instances are healthy
for host in "${STAGE1_INSTANCES[@]}"; do
  echo "=== $host ==="
  ssh $host "docker ps | grep basset-hound-browser"
done
```

### 1c. Update Load Balancer (3 minutes)

**Infrastructure Lead Actions:**

```bash
# Step 1: Drain existing connections (graceful drain)
for host in "${STAGE1_INSTANCES[@]}"; do
  curl -X POST http://load-balancer:8080/backend/$host/drain \
    -d '{"timeout_seconds": 30}' \
    || echo "Drain initiated for $host"
done

# Wait for connections to drain
sleep 35

# Step 2: Mark instances for v12.0.0
# (Don't remove from LB yet, just mark as "in-update")
curl -X PATCH http://load-balancer:8080/backend/config \
  -d '{
    "instances": {
      "basset-prod-01": {"version": "v12.0.0", "weight": 0},
      "basset-prod-04": {"version": "v12.0.0", "weight": 0},
      "basset-prod-07": {"version": "v12.0.0", "weight": 0}
    }
  }' \
  || echo "Load balancer updated"

echo "✓ Load balancer: Stage 1 instances marked (weight=0)" | tee -a /tmp/rollout-timeline.txt
```

### 1d. Deploy v12.0.0 to Selected Instances (5 minutes)

**Deployment Lead + Backup Operator Actions:**

```bash
# Function to deploy to single instance
deploy_instance() {
  local host=$1
  echo "Deploying to $host..."
  
  ssh $host << 'DEPLOY'
    set -e
    # 1. Stop and backup v11.3.0
    docker stop basset-hound-browser --time=30
    docker rename basset-hound-browser basset-hound-browser-v11.3.0-backup
    
    # 2. Pull v12.0.0 image
    docker pull registry.basset-prod.local/basset-hound-browser:v12.0.0
    
    # 3. Start v12.0.0
    docker run -d \
      --name basset-hound-browser \
      --network basset-hound-browser \
      -p 8765:8765 \
      -e DISPLAY=:99 \
      -e ELECTRON_DISABLE_SANDBOX=1 \
      --cap-drop ALL \
      --cap-add SYS_ADMIN \
      --restart unless-stopped \
      -v basset-data:/app/data \
      registry.basset-prod.local/basset-hound-browser:v12.0.0
    
    # 4. Wait for startup
    sleep 30
    
    # 5. Quick health check
    curl -s -o /dev/null -w "%{http_code}" http://localhost:8765
DEPLOY
  
  echo "✓ Deployed to $host"
}

# Deploy to all selected instances
for host in "${STAGE1_INSTANCES[@]}"; do
  deploy_instance $host &
done
wait

echo "✓ v12.0.0 deployed to Stage 1 instances" | tee -a /tmp/rollout-timeline.txt
```

### 1e. Verify Deployment Success (5 minutes)

**Technical Lead Actions:**

```bash
# Verify all Stage 1 instances are running v12.0.0
for host in "${STAGE1_INSTANCES[@]}"; do
  VERSION=$(ssh $host "docker inspect basset-hound-browser | jq -r '.[0].Config.Image'")
  echo "$host: $VERSION"
  
  if [[ $VERSION == *"v12.0.0"* ]]; then
    echo "✓ $host is running v12.0.0"
  else
    echo "✗ $host is NOT running v12.0.0"
    exit 1
  fi
done

echo "✓ All Stage 1 instances confirmed running v12.0.0" | tee -a /tmp/rollout-timeline.txt
```

### 1f. Restore to Load Balancer (2 minutes)

**Infrastructure Lead Actions:**

```bash
# Gradually restore weight to load balancer
# Use weighted round-robin to blend v11.3.0 and v12.0.0 traffic

curl -X PATCH http://load-balancer:8080/backend/config \
  -d '{
    "instances": {
      "basset-prod-01": {"version": "v12.0.0", "weight": 1},
      "basset-prod-02": {"version": "v11.3.0", "weight": 3},
      "basset-prod-03": {"version": "v11.3.0", "weight": 3},
      "basset-prod-04": {"version": "v12.0.0", "weight": 1},
      "basset-prod-05": {"version": "v11.3.0", "weight": 3},
      "basset-prod-06": {"version": "v11.3.0", "weight": 3},
      "basset-prod-07": {"version": "v12.0.0", "weight": 1},
      "basset-prod-08": {"version": "v11.3.0", "weight": 3},
      "basset-prod-09": {"version": "v11.3.0", "weight": 3},
      "basset-prod-10": {"version": "v11.3.0", "weight": 3}
    }
  }'

echo "✓ Load balancer restored (25% v12.0.0 traffic)" | tee -a /tmp/rollout-timeline.txt
```

### 1g. Stage 1 Monitoring (2 hours)

**Technical Lead + Backup Operator (parallel monitoring):**

**Every 15 minutes (First 30 minutes):**

```bash
# Tight monitoring during initial traffic
for host in "${STAGE1_INSTANCES[@]}"; do
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://$host:8765)
  echo "$host: HTTP $HEALTH" 
done

# Check error rate
curl -s http://metrics:9090/api/v1/query?query=rate\(basset_errors_total\[5m\]\) | jq '.data.result[] | {instance: .metric.instance, error_rate: .value[1]}'
```

**Every 30 minutes (Remaining time):**

```bash
# Relaxed monitoring, check baseline drift
curl -s http://metrics:9090/api/v1/query?query=basset_latency_p95 | jq '.data.result[] | select(.metric.version=="v12.0.0")'
curl -s http://metrics:9090/api/v1/query?query=basset_memory_usage | jq '.data.result[] | select(.metric.version=="v12.0.0")'
curl -s http://metrics:9090/api/v1/query?query=basset_cpu_usage | jq '.data.result[] | select(.metric.version=="v12.0.0")'
```

**Monitoring Checklist:**

- [ ] **Stability:** No restarts on Stage 1 instances
- [ ] **Health:** 100% of health checks pass
- [ ] **Latency:** p95 latency within 10% of baseline
- [ ] **Error Rate:** < 0.5% (compared to v11.3.0 < 0.3%)
- [ ] **Memory:** Stable, no growth pattern
- [ ] **CPU:** Consistent with baseline

### 1h. Stage 1 Completion Decision (5 minutes)

**Deployment Lead + Technical Lead Actions:**

```bash
# Validate Stage 1 completion criteria
cat > /tmp/stage1-decision.txt << 'EOF'
=== STAGE 1 (25%) ROLLOUT DECISION ===
Decision Time: $(date)
Duration: 2 hours
Instances: 3 (basset-prod-01, basset-prod-04, basset-prod-07)

Validation Checklist:
- [ ] Stability: No restarts on v12.0.0 instances
- [ ] Health checks: 100% pass rate
- [ ] Latency: Within 10% of baseline
- [ ] Error rate: < 1% (acceptable for rollout)
- [ ] Memory: Stable
- [ ] CPU: Normal
- [ ] No customer complaints reported
- [ ] Technical Lead approval

DECISION: [PROCEED TO STAGE 2 / ROLLBACK]

Signed:
- Deployment Lead: _______________
- Technical Lead: _______________
EOF

# Review decision
cat /tmp/stage1-decision.txt
```

---

## STAGE 2: 50% ROLLOUT (2 hours + validation)

### Overview
- **Target:** 5 total instances (keep Stage 1 + add 2 more)
- **Expected Traffic:** 50% of production load
- **v12.0.0 Instances:** 5
- **v11.3.0 Instances:** 5

### 2a. Pre-Stage 2 Check (2 minutes)

**Deployment Lead Actions:**

```bash
# Verify Stage 1 still healthy
echo "=== Stage 1 Health Check Before Stage 2 ===" >> /tmp/rollout-timeline.txt
for host in basset-prod-01 basset-prod-04 basset-prod-07; do
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://$host:8765)
  echo "$host (v12.0.0): HTTP $HEALTH"
done

# Confirm Stage 1 decision was GO
grep "DECISION.*PROCEED" /tmp/stage1-decision.txt || exit 1
```

### 2b. Select Additional Instances (2 minutes)

**Infrastructure Lead Actions:**

```bash
# Select 2 more instances for v12.0.0 (different zones)
STAGE2_NEW=(basset-prod-02 basset-prod-05)
echo "Stage 2 new instances: ${STAGE2_NEW[@]}" >> /tmp/rollout-timeline.txt

# Note: Stage 1 instances continue running v12.0.0
STAGE2_ALL_V12=(basset-prod-01 basset-prod-04 basset-prod-07 basset-prod-02 basset-prod-05)
echo "Total v12.0.0 instances: ${#STAGE2_ALL_V12[@]}"
```

### 2c. Update Load Balancer (3 minutes)

**Infrastructure Lead Actions:**

```bash
# Drain connections from new Stage 2 instances
for host in "${STAGE2_NEW[@]}"; do
  curl -X POST http://load-balancer:8080/backend/$host/drain \
    -d '{"timeout_seconds": 30}' || true
done

sleep 35

# Update load balancer to 50/50
curl -X PATCH http://load-balancer:8080/backend/config \
  -d '{
    "instances": {
      "basset-prod-01": {"version": "v12.0.0", "weight": 1},
      "basset-prod-02": {"version": "v12.0.0", "weight": 1},
      "basset-prod-03": {"version": "v11.3.0", "weight": 1},
      "basset-prod-04": {"version": "v12.0.0", "weight": 1},
      "basset-prod-05": {"version": "v12.0.0", "weight": 1},
      "basset-prod-06": {"version": "v11.3.0", "weight": 1},
      "basset-prod-07": {"version": "v12.0.0", "weight": 1},
      "basset-prod-08": {"version": "v11.3.0", "weight": 1},
      "basset-prod-09": {"version": "v11.3.0", "weight": 1},
      "basset-prod-10": {"version": "v11.3.0", "weight": 1}
    }
  }'

echo "✓ Load balancer: 50/50 split configured" >> /tmp/rollout-timeline.txt
```

### 2d. Deploy v12.0.0 to New Instances (5 minutes)

**Same procedure as Stage 1d for new instances**

```bash
# Deploy to Stage 2 new instances
for host in "${STAGE2_NEW[@]}"; do
  deploy_instance $host &
done
wait

echo "✓ v12.0.0 deployed to Stage 2 instances" >> /tmp/rollout-timeline.txt
```

### 2e. Verify Deployment (3 minutes)

```bash
# Verify all Stage 2 instances
for host in "${STAGE2_ALL_V12[@]}"; do
  VERSION=$(ssh $host "docker inspect basset-hound-browser | jq -r '.[0].Config.Image'")
  if [[ $VERSION == *"v12.0.0"* ]]; then
    echo "✓ $host running v12.0.0"
  else
    echo "✗ $host NOT running v12.0.0 - ROLLBACK REQUIRED"
    exit 1
  fi
done
```

### 2f. Stage 2 Monitoring (2 hours)

**Same monitoring cadence as Stage 1**

```bash
# Check v12.0.0 metrics
curl -s http://metrics:9090/api/v1/query?query='basset_instances{version="v12.0.0"}' | jq '.data.result | length'
# Should show 5 instances

# Compare latency between v12.0.0 and v11.3.0
curl -s 'http://metrics:9090/api/v1/query?query=basset_latency_p95' | jq '.data.result[] | {instance: .metric.instance, version: .metric.version, latency: .value[1]}'
```

### 2g. Stage 2 Decision (5 minutes)

```bash
cat > /tmp/stage2-decision.txt << 'EOF'
=== STAGE 2 (50%) ROLLOUT DECISION ===
Decision Time: $(date)
Duration: 2 hours
v12.0.0 Instances: 5
v11.3.0 Instances: 5

Validation Checklist:
- [ ] All Stage 1 instances still healthy
- [ ] All Stage 2 instances healthy
- [ ] Latency: p95 within 10% of baseline
- [ ] Error rate: < 1%
- [ ] No memory leaks observed
- [ ] No customer impact reported
- [ ] Technical Lead approval

DECISION: [PROCEED TO STAGE 3 (100%) / ROLLBACK]
EOF

# Review
cat /tmp/stage2-decision.txt
```

---

## STAGE 3: 100% ROLLOUT (1 hour + ongoing validation)

### Overview
- **Target:** Remaining 5 instances (basset-prod-03, 06, 08, 09, 10)
- **Expected Traffic:** 100% on v12.0.0
- **Duration:** 1 hour for deployment, ongoing monitoring

### 3a. Pre-Stage 3 Verification (2 minutes)

```bash
# Verify 50/50 split is stable
echo "Stage 2 healthy - proceeding to 100%" >> /tmp/rollout-timeline.txt

# Confirm Stage 2 decision was GO
grep "DECISION.*PROCEED" /tmp/stage2-decision.txt || exit 1
```

### 3b. Select Remaining Instances (1 minute)

```bash
STAGE3_INSTANCES=(basset-prod-03 basset-prod-06 basset-prod-08 basset-prod-09 basset-prod-10)
echo "Stage 3 instances: ${STAGE3_INSTANCES[@]}" >> /tmp/rollout-timeline.txt
```

### 3c. Update Load Balancer (3 minutes)

```bash
# Drain connections
for host in "${STAGE3_INSTANCES[@]}"; do
  curl -X POST http://load-balancer:8080/backend/$host/drain \
    -d '{"timeout_seconds": 30}' || true
done

sleep 35

# Set all instances to v12.0.0
curl -X PATCH http://load-balancer:8080/backend/config \
  -d '{
    "instances": {
      "basset-prod-01": {"version": "v12.0.0", "weight": 1},
      "basset-prod-02": {"version": "v12.0.0", "weight": 1},
      "basset-prod-03": {"version": "v12.0.0", "weight": 0},
      "basset-prod-04": {"version": "v12.0.0", "weight": 1},
      "basset-prod-05": {"version": "v12.0.0", "weight": 1},
      "basset-prod-06": {"version": "v12.0.0", "weight": 0},
      "basset-prod-07": {"version": "v12.0.0", "weight": 1},
      "basset-prod-08": {"version": "v12.0.0", "weight": 0},
      "basset-prod-09": {"version": "v12.0.0", "weight": 0},
      "basset-prod-10": {"version": "v12.0.0", "weight": 0}
    }
  }'

echo "✓ Load balancer: Stage 3 marked (preparing 100%)" >> /tmp/rollout-timeline.txt
```

### 3d. Deploy v12.0.0 to Remaining Instances (5 minutes)

```bash
# Deploy in parallel to speed up
for host in "${STAGE3_INSTANCES[@]}"; do
  deploy_instance $host &
done
wait

echo "✓ v12.0.0 deployed to all remaining instances" >> /tmp/rollout-timeline.txt
```

### 3e. Restore to 100% Load Balancer (2 minutes)

```bash
# All instances now at weight 1 (100% v12.0.0)
curl -X PATCH http://load-balancer:8080/backend/config \
  -d '{
    "instances": {
      "basset-prod-01": {"version": "v12.0.0", "weight": 1},
      "basset-prod-02": {"version": "v12.0.0", "weight": 1},
      "basset-prod-03": {"version": "v12.0.0", "weight": 1},
      "basset-prod-04": {"version": "v12.0.0", "weight": 1},
      "basset-prod-05": {"version": "v12.0.0", "weight": 1},
      "basset-prod-06": {"version": "v12.0.0", "weight": 1},
      "basset-prod-07": {"version": "v12.0.0", "weight": 1},
      "basset-prod-08": {"version": "v12.0.0", "weight": 1},
      "basset-prod-09": {"version": "v12.0.0", "weight": 1},
      "basset-prod-10": {"version": "v12.0.0", "weight": 1}
    }
  }'

echo "✓ 100% traffic now on v12.0.0" >> /tmp/rollout-timeline.txt
```

### 3f. Stage 3 Ongoing Monitoring (1+ hours)

**Technical Lead continuous monitoring:**

- [ ] All 10 instances healthy
- [ ] No spike in error rates
- [ ] Latency stable
- [ ] Memory usage acceptable
- [ ] No emergency alerts

### 3g. 100% Rollout Completion

```bash
cat > /tmp/stage3-completion.txt << 'EOF'
=== STAGE 3 (100%) ROLLOUT COMPLETE ===
Completion Time: $(date)
All Instances: 10/10 running v12.0.0
Traffic: 100% on v12.0.0

Final Validation:
- [ ] All instances responding
- [ ] Error rate: < 0.5%
- [ ] Latency: Acceptable
- [ ] No alerts firing
- [ ] Customer reports: None

Status: v12.0.0 IS NOW PRODUCTION RELEASE
Next Step: Post-Deployment Validation (see POST-DEPLOYMENT-VALIDATION.md)
EOF

echo "✓ v12.0.0 fully deployed to production"
```

---

## Rollback Procedure (Any Stage)

### Quick Rollback to v11.3.0

**If NO-GO decision at any stage:**

```bash
# Immediately drain and rollback
ROLLBACK_INSTANCES=(basset-prod-01 basset-prod-02 basset-prod-03 basset-prod-04 basset-prod-05)

# Stop draining - remove from load balancer
curl -X PATCH http://load-balancer:8080/backend/config \
  -d '{"remove_instances": ["'$(IFS=,; echo "${ROLLBACK_INSTANCES[*]}")'"]}'

# Rollback each instance
for host in "${ROLLBACK_INSTANCES[@]}"; do
  ssh $host << 'ROLLBACK'
    docker stop basset-hound-browser --time=10
    docker rm basset-hound-browser
    docker rename basset-hound-browser-v11.3.0-backup basset-hound-browser
    docker start basset-hound-browser
    sleep 30
ROLLBACK
done

# Restore to load balancer
for host in "${ROLLBACK_INSTANCES[@]}"; do
  curl -X POST http://load-balancer:8080/backend/$host/restore \
    -d '{"version": "v11.3.0"}' || true
done

echo "✓ Rollback to v11.3.0 complete"
```

---

## Approval & Sign-off

| Stage | Status | Deployment Lead | Technical Lead | Time |
|-------|--------|-----------------|-----------------|------|
| Canary | [ ] | | | |
| 25% | [ ] | | | |
| 50% | [ ] | | | |
| 100% | [ ] | | | |

---

**End of Progressive Rollout Runbook**
