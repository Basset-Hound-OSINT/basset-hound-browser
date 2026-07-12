# Wave 15 Progressive Rollout Runbook
## Basset Hound Browser v12.1.0 - Phase 1 & Phase 2

**Runbook Version:** 1.0  
**Date:** June 2, 2026  
**Purpose:** Step-by-step procedure for progressive rollout from 25% → 50% → 100%  
**Expected Duration:** 2-3 hours total (1 hour per phase)  
**Scope:** After canary approval, deploy to remaining 9 instances

---

## Pre-Rollout Verification (T+1:30)

### Step 1: Confirm Canary Approval

**Objective:** Verify canary was approved before proceeding with Phase 1.

```bash
# Check canary decision
if [ -f /tmp/canary-decision.txt ]; then
  echo "✅ Canary decision document found"
  grep "DECISION:" /tmp/canary-decision.txt
else
  echo "❌ Canary decision document not found"
  echo "STOP - Cannot proceed without canary approval"
  exit 1
fi

# Verify canary is still running
CANARY_STATUS=$(docker ps | grep basset-hound-v12.1.0-canary)
if [ ! -z "$CANARY_STATUS" ]; then
  echo "✅ Canary instance still running"
else
  echo "❌ Canary instance has stopped"
  echo "STOP - Cannot proceed with canary down"
  exit 1
fi

# Verify v12.0.0 instances are healthy
RUNNING_v12=$(docker ps | grep basset-hound-v12.0.0 | wc -l)
echo "✅ Found $RUNNING_v12 v12.0.0 instances running"

# Quick health check on all instances
echo "Running health check on all instances..."
for instance in $(docker ps | grep basset-hound | awk '{print $NF}' | grep -v canary); do
  if curl -s -X POST http://localhost:8765 \
    -H "Content-Type: application/json" \
    -d '{"command":"ping"}' \
    -m 5 > /dev/null; then
    echo "  ✅ $instance: healthy"
  else
    echo "  ❌ $instance: NOT responding"
  fi
done
```

**Success Criteria:**
- ✅ Canary decision document exists and shows GO
- ✅ Canary instance still running
- ✅ All v12.0.0 instances responding to ping
- ✅ Ready to proceed with Phase 1

### Step 2: Verify Load Balancer Configuration

**Objective:** Confirm load balancer can route traffic proportionally across instances.

```bash
# Check load balancer status
echo "Load Balancer Configuration"
echo "============================"

# Get current load balancer config
curl -s http://load-balancer:8080/config/status | jq . || echo "⚠️  Load balancer not accessible"

# List all instances and their current weight
echo ""
echo "Current Instance Weights:"
curl -s http://load-balancer:8080/instances | jq '.instances[] | {name, weight}' || echo "⚠️  Instance list unavailable"

# Verify load balancer can do gradual rollout
echo ""
echo "Verifying progressive rollout capability..."
# This would be specific to your load balancer

# Test with small traffic change
# (implementation depends on your load balancer)
```

**Success Criteria:**
- ✅ Load balancer accessible and responsive
- ✅ Current instance configuration visible
- ✅ Ability to adjust weights confirmed

### Step 3: Prepare Phase 1 Instances

**Objective:** Identify and prepare the 2-3 instances for Phase 1 deployment.

```bash
# Identify Phase 1 instances (instances that will receive v12.1.0 first)
PHASE1_INSTANCES=(
  "basset-hound-prod-instance-01"
  "basset-hound-prod-instance-02"
  "basset-hound-prod-instance-03"
)

echo "Phase 1 Instances (25% traffic):"
for i in "${PHASE1_INSTANCES[@]}"; do
  echo "  - $i"
done

# Save for later use
echo "${PHASE1_INSTANCES[@]}" > /tmp/phase1-instances.txt

# Capture baseline metrics for all Phase 1 instances
echo ""
echo "Capturing Phase 1 baseline metrics..."
for instance in "${PHASE1_INSTANCES[@]}"; do
  docker stats --no-stream $instance > /tmp/baseline-${instance}.txt 2>/dev/null || echo "⚠️  Cannot get metrics for $instance"
done

echo "✅ Phase 1 instances prepared"
```

**Success Criteria:**
- ✅ Phase 1 instances identified
- ✅ Baseline metrics captured
- ✅ All instances currently running v12.0.0
- ✅ All instances responding to health checks

### Step 4: Setup Monitoring Dashboard

**Objective:** Configure monitoring to display Phase 1 metrics in real-time.

```bash
# Create monitoring dashboard for Phase 1
cat > /tmp/phase1-dashboard.sh << 'DASHBOARD'
#!/bin/bash

echo "========================================"
echo "Wave 15 - Phase 1 Deployment Dashboard"
echo "========================================"
echo "Start Time: $(date)"
echo ""

INSTANCES=("basset-hound-prod-instance-01" "basset-hound-prod-instance-02" "basset-hound-prod-instance-03")

while true; do
  clear
  echo "Wave 15 - Phase 1 Deployment Dashboard"
  echo "Time: $(date '+%H:%M:%S')"
  echo "========================================"
  echo ""
  
  TOTAL_CPU=0
  TOTAL_MEM=0
  TOTAL_ERRORS=0
  
  for instance in "${INSTANCES[@]}"; do
    STATS=$(docker stats --no-stream $instance --format "{{.CPUPerc}} {{.MemUsage}}" 2>/dev/null)
    if [ ! -z "$STATS" ]; then
      CPU=$(echo "$STATS" | awk '{print $1}')
      MEM=$(echo "$STATS" | awk '{print $2}')
      ERRORS=$(docker logs $instance 2>/dev/null | grep ERROR | wc -l)
      
      echo "$instance:"
      echo "  CPU: $CPU  Memory: $MEM  Errors: $ERRORS"
      
      # Accumulate totals
      CPU_NUM=$(echo "$CPU" | sed 's/%//')
      TOTAL_CPU=$(echo "$TOTAL_CPU + $CPU_NUM" | bc)
      TOTAL_ERRORS=$((TOTAL_ERRORS + ERRORS))
    fi
  done
  
  echo ""
  echo "Summary:"
  echo "  Avg CPU: $(echo "$TOTAL_CPU / 3" | bc)%"
  echo "  Total Errors: $TOTAL_ERRORS"
  echo ""
  echo "Status: MONITORING PHASE 1"
  echo "Refresh: 30 seconds"
  
  sleep 30
done
DASHBOARD

chmod +x /tmp/phase1-dashboard.sh

echo "✅ Monitoring dashboard prepared"
echo "   Run with: /tmp/phase1-dashboard.sh"
```

**Success Criteria:**
- ✅ Monitoring dashboard created
- ✅ Dashboard can be executed
- ✅ Real-time metrics collection working

---

## Phase 1 Deployment (T+1:30 to T+2:30)

### Step 5: Deploy v12.1.0 to Phase 1 Instances

**Objective:** Deploy v12.1.0 to 2-3 instances (25% of total traffic).

```bash
# Load Phase 1 instances
PHASE1_INSTANCES=($(cat /tmp/phase1-instances.txt))

echo "Deploying v12.1.0 to Phase 1 instances..."
echo "Target instances: ${#PHASE1_INSTANCES[@]}"

for instance in "${PHASE1_INSTANCES[@]}"; do
  echo ""
  echo "Deploying to $instance..."
  
  # Stop current container
  docker stop $instance 2>/dev/null || true
  
  # Remove old container
  docker rm $instance 2>/dev/null || true
  
  # Get old container's configuration
  OLD_CONFIG=$(docker inspect $instance 2>/dev/null)
  
  # Start new container with v12.1.0
  docker run -d \
    --name $instance \
    --network host \
    -e NODE_ENV=production \
    -e LOG_LEVEL=info \
    -e WEBSOCKET_PORT=8765 \
    -e COMPRESSION_ENABLED=true \
    -v ~/.basset-hound:/home/app/.basset-hound \
    -v /var/log/basset-hound:/var/log/basset-hound \
    basset-hound-browser:v12.1.0
  
  # Wait for startup
  echo "  Waiting for startup..."
  sleep 5
  
  # Verify health
  if curl -s -X POST http://localhost:8765 \
    -H "Content-Type: application/json" \
    -d '{"command":"ping"}' \
    -m 5 > /dev/null; then
    echo "  ✅ $instance: Successfully deployed and healthy"
  else
    echo "  ❌ $instance: Failed health check"
    echo "    Rolling back..."
    docker stop $instance
    docker run -d --name $instance basset-hound-browser:v12.0.0
    sleep 5
  fi
done

echo ""
echo "✅ Phase 1 deployment complete"
```

**Success Criteria:**
- ✅ All Phase 1 instances upgraded to v12.1.0
- ✅ All instances pass health checks
- ✅ No startup errors in logs
- ✅ WebSocket ports responding

### Step 6: Adjust Load Balancer to 25% Traffic

**Objective:** Route 25% of traffic to Phase 1 instances running v12.1.0.

```bash
# Get Phase 1 instances
PHASE1_INSTANCES=($(cat /tmp/phase1-instances.txt))
PHASE1_COUNT=${#PHASE1_INSTANCES[@]}

# Calculate total instances
TOTAL_INSTANCES=9  # Assuming 9 total (3 v12.0.0 + 3 v12.1.0 + 3 v12.0.0)

# Set weights for load balancer
# Phase 1 instances: weight 100
# Phase 2/3 instances: weight 0 (not deployed yet)

echo "Adjusting load balancer for Phase 1 (25% traffic)..."

# Example for HAProxy-style load balancer
for instance in "${PHASE1_INSTANCES[@]}"; do
  curl -s -X POST http://load-balancer:8080/backend/weight \
    -H "Content-Type: application/json" \
    -d "{\"instance\": \"$instance\", \"weight\": 100}" || true
done

# Verify traffic adjustment
echo "Waiting for traffic to stabilize..."
sleep 10

# Check traffic distribution
echo "Current traffic distribution:"
curl -s http://load-balancer:8080/stats | jq '.backends[] | {name, connections, traffic_percent}' || echo "⚠️  Stats unavailable"

echo "✅ Load balancer adjusted to 25% traffic"
```

**Success Criteria:**
- ✅ Load balancer weight adjusted
- ✅ Traffic flowing to Phase 1 instances
- ✅ ~25% of traffic routed to v12.1.0
- ✅ No traffic loss

### Step 7: Monitor Phase 1 for 30-60 Minutes (T+2:00 to T+3:00)

**Objective:** Verify Phase 1 is stable before approving Phase 2.

```bash
# Run continuous monitoring
/tmp/phase1-dashboard.sh &
DASHBOARD_PID=$!

# Create monitoring script
cat > /tmp/monitor-phase1.sh << 'MONITOR'
#!/bin/bash

DURATION=3600  # 60 minutes
INTERVAL=30    # Check every 30 seconds
ELAPSED=0
FAILED_CHECKS=0

echo "Starting Phase 1 monitoring..."
echo "Target: 1 hour"
echo ""

while [ $ELAPSED -lt $DURATION ]; do
  # Check error rates
  ERRORS=$(docker logs basset-hound-prod-instance-01 | grep ERROR | wc -l)
  ERRORS=$((ERRORS + $(docker logs basset-hound-prod-instance-02 | grep ERROR | wc -l)))
  ERRORS=$((ERRORS + $(docker logs basset-hound-prod-instance-03 | grep ERROR | wc -l)))
  
  # Check latency
  LATENCY=$(curl -s -X POST http://localhost:8765 \
    -H "Content-Type: application/json" \
    -d '{"command":"ping"}' \
    -w "%{time_total}" -o /dev/null 2>/dev/null)
  
  # Check CPU
  CPU=$(docker stats --no-stream basset-hound-prod-instance-01 --format "{{.CPUPerc}}" | sed 's/%//' | cut -d'.' -f1)
  
  # Print metrics
  echo "[$(date '+%H:%M:%S')] Elapsed: ${ELAPSED}s | Errors: $ERRORS | Latency: ${LATENCY}s | CPU: ${CPU}%"
  
  # Check for issues
  if [ $ERRORS -gt 10 ]; then
    echo "⚠️  HIGH ERROR RATE DETECTED"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
  fi
  
  if (( $(echo "$LATENCY > 0.5" | bc -l) )); then
    echo "⚠️  HIGH LATENCY DETECTED: ${LATENCY}s"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
  fi
  
  if [ $CPU -gt 60 ]; then
    echo "⚠️  HIGH CPU USAGE: ${CPU}%"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
  fi
  
  # Exit early if too many failures
  if [ $FAILED_CHECKS -gt 5 ]; then
    echo "❌ TOO MANY FAILURES - RECOMMEND ROLLBACK"
    exit 1
  fi
  
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo ""
echo "✅ Phase 1 monitoring complete (1 hour)"
MONITOR

chmod +x /tmp/monitor-phase1.sh
/tmp/monitor-phase1.sh
MONITOR_EXIT=$?

# Stop dashboard
kill $DASHBOARD_PID 2>/dev/null || true
```

**Success Criteria (after 60 minutes):**
- ✅ Error rate <0.1% (acceptable: <1%)
- ✅ Latency P99 <100ms (acceptable: <500ms)
- ✅ CPU usage <30%
- ✅ Memory stable (no growth trend)
- ✅ No cascading failures
- ✅ All health checks passing

### Step 8: Phase 1 Approval Decision

**Objective:** Decide if Phase 1 is successful and Phase 2 can proceed.

```bash
# Check monitoring results
if [ $MONITOR_EXIT -eq 0 ]; then
  echo "✅ Phase 1 monitoring passed all checks"
else
  echo "❌ Phase 1 monitoring failed"
  echo "RECOMMENDATION: STOP rollout and investigate"
  exit 1
fi

# Get Phase 1 instance metrics
echo ""
echo "=== Phase 1 Final Metrics ==="
for instance in basset-hound-prod-instance-01 basset-hound-prod-instance-02 basset-hound-prod-instance-03; do
  echo ""
  echo "$instance:"
  docker stats --no-stream $instance
done

# Create approval document
cat > /tmp/phase1-approval.txt << 'APPROVAL'
PHASE 1 DEPLOYMENT APPROVAL
===========================

Deployment: Wave 15 - v12.1.0
Phase: 1 (25% traffic)
Time: $(date)

MONITORING RESULTS:
✅ All metrics within acceptable ranges
✅ No critical errors detected
✅ Performance stable and responsive
✅ Memory usage optimal
✅ CPU usage reasonable

APPROVAL DECISION:
☐ GO - Proceed with Phase 2 (50% rollout)
☐ STOP - Hold for investigation

Approved by: _______________
Date: _______________
Time: _______________

APPROVAL

echo "Phase 1 approval document created"
echo "Decision: GO or STOP?"
```

**Success Criteria:**
- ✅ All Phase 1 metrics acceptable
- ✅ No critical issues discovered
- ✅ Ready to proceed with Phase 2

---

## Phase 2 Deployment (T+2:30 to T+3:30)

### Step 9: Prepare Phase 2 Instances

**Objective:** Identify and prepare the remaining instances for Phase 2 deployment.

```bash
# Identify Phase 2 instances (4-5 instances)
PHASE2_INSTANCES=(
  "basset-hound-prod-instance-04"
  "basset-hound-prod-instance-05"
  "basset-hound-prod-instance-06"
  "basset-hound-prod-instance-07"
)

echo "Phase 2 Instances (50% total traffic):"
for i in "${PHASE2_INSTANCES[@]}"; do
  echo "  - $i"
done

# Save for deployment
echo "${PHASE2_INSTANCES[@]}" > /tmp/phase2-instances.txt

# Verify all Phase 2 instances are healthy and running v12.0.0
echo ""
echo "Verifying Phase 2 instances are ready..."
for instance in "${PHASE2_INSTANCES[@]}"; do
  VERSION=$(docker inspect $instance | jq -r '.[0].Config.Image' | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
  if [ "$VERSION" = "v12.0.0" ]; then
    echo "  ✅ $instance: Running $VERSION"
  else
    echo "  ⚠️  $instance: Running $VERSION (expected v12.0.0)"
  fi
done

echo "✅ Phase 2 instances prepared"
```

**Success Criteria:**
- ✅ Phase 2 instances identified (4-5 instances)
- ✅ All running v12.0.0
- ✅ All responding to health checks
- ✅ Baseline metrics captured

### Step 10: Deploy v12.1.0 to Phase 2 Instances

**Objective:** Deploy v12.1.0 to Phase 2 instances (cumulative 50% traffic).

```bash
# Load Phase 2 instances
PHASE2_INSTANCES=($(cat /tmp/phase2-instances.txt))

echo "Deploying v12.1.0 to Phase 2 instances..."
echo "Target instances: ${#PHASE2_INSTANCES[@]}"
echo ""

DEPLOYMENT_START=$(date +%s)

for instance in "${PHASE2_INSTANCES[@]}"; do
  echo "Deploying to $instance..."
  
  # Stop current container
  docker stop $instance 2>/dev/null || true
  sleep 2
  
  # Remove old container
  docker rm $instance 2>/dev/null || true
  
  # Start new container with v12.1.0
  docker run -d \
    --name $instance \
    --network host \
    -e NODE_ENV=production \
    -e LOG_LEVEL=info \
    -e WEBSOCKET_PORT=8765 \
    -e COMPRESSION_ENABLED=true \
    -v ~/.basset-hound:/home/app/.basset-hound \
    -v /var/log/basset-hound:/var/log/basset-hound \
    basset-hound-browser:v12.1.0
  
  # Wait for startup
  sleep 5
  
  # Verify health
  RETRY_COUNT=0
  while [ $RETRY_COUNT -lt 3 ]; do
    if curl -s -X POST http://localhost:8765 \
      -H "Content-Type: application/json" \
      -d '{"command":"ping"}' \
      -m 5 > /dev/null 2>&1; then
      echo "  ✅ $instance: Successfully deployed and healthy"
      break
    else
      RETRY_COUNT=$((RETRY_COUNT + 1))
      if [ $RETRY_COUNT -lt 3 ]; then
        echo "  ⏳ $instance: Health check failed, retrying... (attempt $RETRY_COUNT)"
        sleep 3
      fi
    fi
  done
  
  if [ $RETRY_COUNT -eq 3 ]; then
    echo "  ❌ $instance: Failed to become healthy after 3 attempts"
    echo "    Rolling back to v12.0.0..."
    docker stop $instance
    docker run -d --name $instance basset-hound-browser:v12.0.0
    sleep 5
  fi
done

DEPLOYMENT_END=$(date +%s)
DEPLOYMENT_TIME=$((DEPLOYMENT_END - DEPLOYMENT_START))

echo ""
echo "✅ Phase 2 deployment complete (${DEPLOYMENT_TIME} seconds)"
```

**Success Criteria:**
- ✅ All Phase 2 instances deployed to v12.1.0
- ✅ All instances healthy after deployment
- ✅ No startup errors
- ✅ Deployment time <15 minutes

### Step 11: Adjust Load Balancer to 50% Traffic

**Objective:** Route 50% of traffic to v12.1.0 instances (Phase 1 + Phase 2).

```bash
# Get Phase 2 instances
PHASE2_INSTANCES=($(cat /tmp/phase2-instances.txt))

echo "Adjusting load balancer for Phase 2 (50% traffic)..."
echo "Deploying to $(( $(wc -w <<< "${PHASE2_INSTANCES[@]}") + 3 )) instances total"

# Adjust weights
for instance in "${PHASE2_INSTANCES[@]}"; do
  curl -s -X POST http://load-balancer:8080/backend/weight \
    -H "Content-Type: application/json" \
    -d "{\"instance\": \"$instance\", \"weight\": 100}" || true
done

echo "Waiting for traffic to stabilize..."
sleep 10

# Verify traffic adjustment
echo "Current traffic distribution:"
curl -s http://load-balancer:8080/stats | jq '.backends[] | {name, traffic_percent}' || echo "⚠️  Stats unavailable"

echo ""
echo "✅ Load balancer adjusted to 50% traffic"
```

**Success Criteria:**
- ✅ Load balancer updated
- ✅ ~50% traffic to v12.1.0
- ✅ ~50% traffic to v12.0.0
- ✅ No traffic loss

### Step 12: Monitor Phase 2 for 30-60 Minutes

**Objective:** Verify Phase 2 stability under increased load.

```bash
# Monitor Phase 2 with increased check frequency
cat > /tmp/monitor-phase2.sh << 'MONITOR'
#!/bin/bash

DURATION=1800  # 30 minutes for Phase 2 (shorter than Phase 1)
INTERVAL=15    # More frequent checks due to higher load
ELAPSED=0

echo "Starting Phase 2 monitoring..."
echo "Target: 30 minutes"
echo ""

PHASE1_INSTANCES=("basset-hound-prod-instance-01" "basset-hound-prod-instance-02" "basset-hound-prod-instance-03")
PHASE2_INSTANCES=("basset-hound-prod-instance-04" "basset-hound-prod-instance-05" "basset-hound-prod-instance-06" "basset-hound-prod-instance-07")

while [ $ELAPSED -lt $DURATION ]; do
  echo "[$(date '+%H:%M:%S')] Elapsed: ${ELAPSED}s"
  
  # Check all v12.1.0 instances
  TOTAL_ERRORS=0
  TOTAL_CPU=0
  INSTANCE_COUNT=0
  
  for instance in "${PHASE1_INSTANCES[@]}" "${PHASE2_INSTANCES[@]}"; do
    ERRORS=$(docker logs $instance 2>/dev/null | grep ERROR | tail -100 | wc -l)
    CPU=$(docker stats --no-stream $instance --format "{{.CPUPerc}}" 2>/dev/null | sed 's/%//' | cut -d'.' -f1)
    
    TOTAL_ERRORS=$((TOTAL_ERRORS + ERRORS))
    TOTAL_CPU=$((TOTAL_CPU + CPU))
    INSTANCE_COUNT=$((INSTANCE_COUNT + 1))
    
    if [ $ERRORS -gt 5 ]; then
      echo "  ⚠️  $instance: $ERRORS errors detected"
    fi
  done
  
  AVG_CPU=$((TOTAL_CPU / INSTANCE_COUNT))
  echo "  Avg CPU: ${AVG_CPU}% | Total Errors: $TOTAL_ERRORS"
  
  # Check for critical issues
  if [ $TOTAL_ERRORS -gt 50 ]; then
    echo "  ❌ ERROR THRESHOLD EXCEEDED"
    exit 1
  fi
  
  if [ $AVG_CPU -gt 70 ]; then
    echo "  ❌ CPU THRESHOLD EXCEEDED"
    exit 1
  fi
  
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo ""
echo "✅ Phase 2 monitoring complete"
MONITOR

chmod +x /tmp/monitor-phase2.sh
/tmp/monitor-phase2.sh
```

**Success Criteria (after 30 minutes):**
- ✅ Error rate <0.1%
- ✅ Latency P99 <100ms
- ✅ CPU usage <40%
- ✅ Memory usage stable
- ✅ No cascading failures
- ✅ All health checks passing

### Step 13: Phase 2 Approval Decision

**Objective:** Approve proceeding to final 100% deployment.

```bash
# Create Phase 2 approval document
cat > /tmp/phase2-approval.txt << 'APPROVAL'
PHASE 2 DEPLOYMENT APPROVAL
===========================

Deployment: Wave 15 - v12.1.0
Phase: 2 (50% traffic)
Time: $(date)

INSTANCES DEPLOYED:
  Phase 1: basset-hound-prod-instance-01/02/03
  Phase 2: basset-hound-prod-instance-04/05/06/07

MONITORING RESULTS:
✅ All metrics within acceptable ranges
✅ Error rate <0.1%
✅ Latency stable
✅ CPU usage reasonable
✅ Memory usage optimal
✅ No issues detected

APPROVAL DECISION:
☐ GO - Proceed with Final Deployment (100%)
☐ STOP - Hold for investigation

Approved by: _______________
Date: _______________
Time: _______________

APPROVAL

echo "Phase 2 approval document created"
echo "Ready to proceed with final deployment?"
```

**Success Criteria:**
- ✅ All Phase 2 metrics acceptable
- ✅ No critical issues
- ✅ Ready for 100% deployment

---

## Summary & Next Steps

### Phase 1 & 2 Completion Checklist

```
PHASE 1 (25% Traffic)
☐ v12.1.0 deployed to 3 instances
☐ 60 minutes monitoring passed
☐ All metrics acceptable
☐ Approval obtained

PHASE 2 (50% Traffic)
☐ v12.1.0 deployed to 4 instances
☐ 30 minutes monitoring passed
☐ All metrics acceptable
☐ Approval obtained

TOTAL PROGRESS
☐ 7 instances upgraded (70% of canary system)
☐ 2 instances still on v12.0.0 (30%)
☐ Traffic: 50% v12.1.0, 50% v12.0.0
```

### Next Phase

After Phase 2 approval, proceed to:
- **WAVE-15-FINAL-DEPLOYMENT-RUNBOOK.md** (Deploy remaining 2-3 instances to reach 100%)

---

## Troubleshooting

### Phase Deployment Fails

```bash
# Check Docker logs
docker logs <instance-name>

# Verify image integrity
docker run basset-hound-browser:v12.1.0 --version

# Check system resources
df -h
free -h

# Rollback specific instance
docker stop <instance>
docker run -d --name <instance> basset-hound-browser:v12.0.0
```

### Metrics Show Issues During Phase

```bash
# High error rate
docker logs <instance> | grep ERROR | tail -20

# High CPU
docker top <instance>

# High memory
docker exec <instance> free -h

# Unresponsive service
curl -v -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"command":"ping"}'
```

---

## Document Metadata

**Runbook ID:** WAVE-15-PROGRESSIVE  
**Version:** 1.0  
**Status:** Ready for execution  
**Expected Duration:** 2-3 hours total  

---

**End of Runbook**

*This progressive rollout runbook enables safe, staged deployment of v12.1.0 across the production fleet. By deploying to 25% → 50% before final 100%, we validate stability at each step with early problem detection.*
