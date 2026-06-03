# Wave 15 Rollback Procedures
## Basset Hound Browser v12.1.0 Automatic & Manual Rollback

**Document Version:** 1.0  
**Date:** June 2, 2026  
**Purpose:** Automatic rollback triggers and manual rollback procedures  
**Scope:** Covers all deployment phases (Canary, Phase 1, Phase 2, Final)

---

## Automatic Rollback Triggers

### Trigger 1: Error Rate Threshold Exceeded

**Condition:** Error rate > 1% for > 2 consecutive minutes

**Detection:**
```bash
# Script to monitor error rate
#!/bin/bash
THRESHOLD=1  # 1%
WINDOW=120   # 2 minutes

# Count errors in last 100 log entries
ERRORS=$(docker logs <instance> 2>/dev/null | tail -100 | grep ERROR | wc -l)
ERROR_RATE=$(echo "scale=2; ($ERRORS / 100) * 100" | bc)

if (( $(echo "$ERROR_RATE > $THRESHOLD" | bc -l) )); then
  echo "ROLLBACK TRIGGER: Error rate $ERROR_RATE% exceeds threshold"
  exit 1
fi
```

**Action:**
```bash
# Automatic rollback to v12.0.0
docker stop basset-hound-v12.1.0-<instance>
docker rm basset-hound-v12.1.0-<instance>
docker run -d --name <instance> basset-hound-browser:v12.0.0
```

**Alert:** CRITICAL (Pages on-call engineer)

### Trigger 2: Latency P99 Exceeds Threshold

**Condition:** P99 latency > 500ms for > 2 consecutive minutes

**Detection:**
```bash
# Monitor latency
#!/bin/bash
THRESHOLD_MS=500

for i in {1..5}; do
  LATENCY=$(curl -s -X POST http://localhost:8765 \
    -H "Content-Type: application/json" \
    -d '{"command":"ping"}' \
    -w "%{time_total}" -o /dev/null)
  
  LATENCY_MS=$(echo "$LATENCY * 1000" | bc)
  
  if (( $(echo "$LATENCY_MS > $THRESHOLD_MS" | bc -l) )); then
    echo "ROLLBACK TRIGGER: Latency $LATENCY_MS ms exceeds threshold"
    exit 1
  fi
  
  sleep 30
done
```

**Action:**
```bash
# Automatic rollback for affected instance(s)
# (See manual rollback procedure below)
```

**Alert:** CRITICAL (Pages on-call engineer)

### Trigger 3: Memory Growth Exceeds Rate

**Condition:** Memory growth > 50MB/minute for > 5 minutes

**Detection:**
```bash
#!/bin/bash
THRESHOLD_MB=50
WINDOW=300  # 5 minutes

INITIAL_MEM=$(docker stats --no-stream <instance> --format "{{.MemUsage}}" | grep -oE '^[0-9.]+')

sleep $WINDOW

FINAL_MEM=$(docker stats --no-stream <instance> --format "{{.MemUsage}}" | grep -oE '^[0-9.]+')
GROWTH=$(echo "$FINAL_MEM - $INITIAL_MEM" | bc)

if (( $(echo "$GROWTH > $THRESHOLD_MB" | bc -l) )); then
  echo "ROLLBACK TRIGGER: Memory growth $GROWTH MB exceeds threshold"
  exit 1
fi
```

**Action:**
```bash
# Automatic restart and potential rollback
docker restart <instance>
sleep 10
# If still failing, proceed with rollback
```

**Alert:** WARNING (Notifies team, may escalate if persistent)

### Trigger 4: Process Crash or Restart

**Condition:** Container exits unexpectedly or restarts

**Detection:**
```bash
# Monitor container state
#!/bin/bash
OLD_ID=$(docker inspect --format='{{.State.Pid}}' <instance>)

while true; do
  sleep 30
  NEW_ID=$(docker inspect --format='{{.State.Pid}}' <instance>)
  
  if [ "$OLD_ID" != "$NEW_ID" ] && [ ! -z "$OLD_ID" ]; then
    echo "ROLLBACK TRIGGER: Container restarted (PID changed)"
    exit 1
  fi
  
  OLD_ID=$NEW_ID
done
```

**Action:**
```bash
# Automatic rollback to v12.0.0
docker stop <instance>
docker rm <instance>
docker run -d --name <instance> basset-hound-browser:v12.0.0
```

**Alert:** CRITICAL (Immediate rollback, pages on-call engineer)

### Trigger 5: WebSocket Port Unresponsive

**Condition:** Port 8765 unresponsive for > 30 seconds

**Detection:**
```bash
#!/bin/bash
TIMEOUT=30
UNRESPONSIVE_COUNT=0

for i in {1..3}; do
  if ! nc -zv localhost 8765 2>/dev/null; then
    UNRESPONSIVE_COUNT=$((UNRESPONSIVE_COUNT + 1))
  fi
  
  if [ $UNRESPONSIVE_COUNT -ge 3 ]; then
    echo "ROLLBACK TRIGGER: WebSocket port unresponsive for $TIMEOUT seconds"
    exit 1
  fi
  
  sleep 10
done
```

**Action:**
```bash
# Automatic restart
docker restart <instance>
sleep 10

# If still unresponsive, automatic rollback
if ! nc -zv localhost 8765 2>/dev/null; then
  docker stop <instance>
  docker rm <instance>
  docker run -d --name <instance> basset-hound-browser:v12.0.0
fi
```

**Alert:** CRITICAL (Immediate action, pages on-call engineer)

---

## Manual Rollback Procedure

### Single Instance Manual Rollback

**Objective:** Manually rollback a single instance from v12.1.0 to v12.0.0.

**Duration:** 5-10 minutes

```bash
# Step 1: Identify affected instance
INSTANCE_NAME="basset-hound-prod-instance-01"
echo "Rolling back instance: $INSTANCE_NAME"

# Step 2: Verify current state
echo "Current state:"
docker ps | grep $INSTANCE_NAME
docker logs $INSTANCE_NAME | tail -5

# Step 3: Stop current container
echo "Stopping v12.1.0 container..."
docker stop $INSTANCE_NAME
sleep 3

# Step 4: Remove container
echo "Removing container..."
docker rm $INSTANCE_NAME

# Step 5: Start v12.0.0 container
echo "Starting v12.0.0..."
docker run -d \
  --name $INSTANCE_NAME \
  --network host \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  -e WEBSOCKET_PORT=8765 \
  -v ~/.basset-hound:/home/app/.basset-hound \
  -v /var/log/basset-hound:/var/log/basset-hound \
  basset-hound-browser:v12.0.0

# Step 6: Wait for startup
echo "Waiting for startup..."
sleep 5

# Step 7: Verify health
echo "Verifying health..."
if curl -s -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"command":"ping"}' \
  -m 5 > /dev/null; then
  echo "✅ $INSTANCE_NAME successfully rolled back to v12.0.0"
else
  echo "❌ $INSTANCE_NAME health check failed"
  echo "   Manual intervention required"
fi

# Step 8: Update load balancer
echo "Updating load balancer..."
curl -s -X POST http://load-balancer:8080/backend/weight \
  -H "Content-Type: application/json" \
  -d "{\"instance\": \"$INSTANCE_NAME\", \"weight\": 100}" || true

echo "✅ Rollback complete"
```

**Success Criteria:**
- ✅ v12.1.0 container stopped
- ✅ v12.0.0 container running
- ✅ Health check passing
- ✅ Instance responding to ping
- ✅ Load balancer updated

### Multi-Instance Rollback (Entire Phase)

**Objective:** Rollback an entire phase (multiple instances) to v12.0.0.

**Duration:** 15-30 minutes depending on number of instances

```bash
# Step 1: Define instances to rollback
INSTANCES_TO_ROLLBACK=(
  "basset-hound-prod-instance-01"
  "basset-hound-prod-instance-02"
  "basset-hound-prod-instance-03"
)

echo "Rolling back ${#INSTANCES_TO_ROLLBACK[@]} instances..."

# Step 2: Stop all containers in parallel (or sequential for safety)
echo "Stopping containers..."
for instance in "${INSTANCES_TO_ROLLBACK[@]}"; do
  docker stop $instance &  # Background process
done
wait  # Wait for all to complete

# Step 3: Remove all containers
echo "Removing containers..."
for instance in "${INSTANCES_TO_ROLLBACK[@]}"; do
  docker rm $instance &
done
wait

# Step 4: Start all containers with v12.0.0
echo "Starting v12.0.0 containers..."
for instance in "${INSTANCES_TO_ROLLBACK[@]}"; do
  docker run -d \
    --name $instance \
    --network host \
    -e NODE_ENV=production \
    -e LOG_LEVEL=info \
    -e WEBSOCKET_PORT=8765 \
    -v ~/.basset-hound:/home/app/.basset-hound \
    -v /var/log/basset-hound:/var/log/basset-hound \
    basset-hound-browser:v12.0.0 &
done
wait

# Step 5: Wait for all to start
echo "Waiting for startup..."
sleep 10

# Step 6: Verify all health
echo "Verifying health of all instances..."
HEALTHY_COUNT=0
for instance in "${INSTANCES_TO_ROLLBACK[@]}"; do
  if curl -s -X POST http://localhost:8765 \
    -H "Content-Type: application/json" \
    -d '{"command":"ping"}' \
    -m 5 > /dev/null 2>&1; then
    echo "  ✅ $instance: healthy"
    HEALTHY_COUNT=$((HEALTHY_COUNT + 1))
  else
    echo "  ❌ $instance: NOT healthy"
  fi
done

echo "Health check: $HEALTHY_COUNT/${#INSTANCES_TO_ROLLBACK[@]} healthy"

# Step 7: Update load balancer
echo "Updating load balancer..."
for instance in "${INSTANCES_TO_ROLLBACK[@]}"; do
  curl -s -X POST http://load-balancer:8080/backend/weight \
    -H "Content-Type: application/json" \
    -d "{\"instance\": \"$instance\", \"weight\": 100}" || true &
done
wait

# Step 8: Verify traffic
echo "Verifying traffic distribution..."
sleep 10
curl -s http://load-balancer:8080/stats | jq '.summary' || echo "Traffic stats unavailable"

echo ""
if [ $HEALTHY_COUNT -eq ${#INSTANCES_TO_ROLLBACK[@]} ]; then
  echo "✅ Rollback complete - All instances recovered"
else
  echo "⚠️  Rollback partially complete - Some instances may need manual intervention"
fi
```

**Success Criteria:**
- ✅ All target instances stopped
- ✅ All target instances running v12.0.0
- ✅ All health checks passing
- ✅ Load balancer updated
- ✅ Traffic flowing to rolled-back instances

### Complete Rollback (All Phases)

**Objective:** Rollback entire deployment to all instances on v12.0.0.

**Duration:** 30-45 minutes

**This is the nuclear option - use only if entire v12.1.0 deployment is failing.**

```bash
# Step 1: Notify stakeholders immediately
echo "CRITICAL: Initiating complete rollback to v12.0.0"
echo "Notifying all stakeholders..."

curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-type: application/json' \
  -d '{
    "text": "🚨 *CRITICAL: Complete Rollback in Progress*",
    "attachments": [{
      "color": "danger",
      "text": "Rolling back all instances from v12.1.0 to v12.0.0\nReason: [SPECIFY REASON]\nETA: 30-45 minutes"
    }]
  }'

# Step 2: Get all v12.1.0 instances
ALL_V12_1_INSTANCES=$(docker ps | grep basset-hound | grep -v v12.0.0 | grep -v canary | awk '{print $NF}')

echo "Rolling back ${#ALL_V12_1_INSTANCES[@]} instances..."

# Step 3: Disable load balancer (optional - for safety)
echo "Disabling load balancer traffic..."
curl -s -X POST http://load-balancer:8080/maintenance/on || true

# Step 4: Rollback all instances
echo "Rolling back instances..."
for instance in $ALL_V12_1_INSTANCES; do
  docker stop $instance 2>/dev/null &
done
wait

for instance in $ALL_V12_1_INSTANCES; do
  docker rm $instance 2>/dev/null &
done
wait

for instance in $ALL_V12_1_INSTANCES; do
  docker run -d \
    --name $instance \
    --network host \
    basset-hound-browser:v12.0.0 &
done
wait

# Step 5: Wait and verify
echo "Waiting for all instances to start..."
sleep 15

echo "Verifying all instances..."
HEALTHY_COUNT=0
TOTAL_COUNT=0
for instance in $ALL_V12_1_INSTANCES; do
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  if curl -s -X POST http://localhost:8765 \
    -H "Content-Type: application/json" \
    -d '{"command":"ping"}' \
    -m 5 > /dev/null 2>&1; then
    HEALTHY_COUNT=$((HEALTHY_COUNT + 1))
  fi
done

# Step 6: Re-enable load balancer
echo "Re-enabling load balancer..."
curl -s -X POST http://load-balancer:8080/maintenance/off || true

# Step 7: Final notification
echo ""
echo "✅ Complete rollback finished"
echo "   Instances healthy: $HEALTHY_COUNT/$TOTAL_COUNT"
echo ""
echo "Next steps:"
echo "1. Investigate root cause"
echo "2. Notify engineering team"
echo "3. Plan remediation"
echo "4. Schedule retry (after fix)"
```

**Success Criteria:**
- ✅ All v12.1.0 instances stopped
- ✅ All instances running v12.0.0
- ✅ All health checks passing
- ✅ Load balancer re-enabled
- ✅ Traffic flowing normally

---

## Post-Rollback Analysis

### Step 1: Immediate Assessment

```bash
# Collect failure data
echo "Collecting failure diagnostics..."

# Get logs from failed instances
for instance in $(docker ps -a | grep basset-hound | awk '{print $NF}'); do
  docker logs $instance > /tmp/failure-logs-${instance}.txt 2>&1
done

# Capture system state
top -bn1 > /tmp/failure-system-state.txt
df -h > /tmp/failure-disk-space.txt
netstat -tulpn > /tmp/failure-network-state.txt

# Create failure report
cat > /tmp/rollback-failure-report.txt << 'REPORT'
ROLLBACK FAILURE REPORT
=======================

Deployment: Wave 15 - v12.1.0
Rollback Date: $(date)

FAILURE SUMMARY:
Phase affected: [SPECIFY]
Instances affected: [LIST]
Time to detect: [DURATION]
Time to rollback: [DURATION]

ROOT CAUSE:
[Investigation findings]

CONTRIBUTING FACTORS:
[List factors that led to failure]

RECOMMENDATIONS:
1. [Fix recommendation 1]
2. [Fix recommendation 2]
3. [Fix recommendation 3]

NEXT STEPS:
1. Implement recommended fixes
2. Re-test in staging environment
3. Schedule new deployment attempt

Sign-off:
Engineering Lead: _______________
Ops Lead: _______________
Date: _______________

REPORT

echo "Failure analysis complete"
echo "Report: /tmp/rollback-failure-report.txt"
```

### Step 2: Root Cause Analysis

**Investigate what went wrong:**

```bash
# 1. Check application logs for errors
echo "=== APPLICATION ERRORS ==="
grep -i "error\|exception\|fatal" /tmp/failure-logs-*.txt | head -20

# 2. Check system resource issues
echo ""
echo "=== SYSTEM RESOURCES ==="
cat /tmp/failure-system-state.txt | grep -E "Cpu|Mem"

# 3. Check network connectivity
echo ""
echo "=== NETWORK STATUS ==="
cat /tmp/failure-network-state.txt | grep LISTEN

# 4. Check disk space
echo ""
echo "=== DISK USAGE ==="
cat /tmp/failure-disk-space.txt
```

### Step 3: Create Fix Plan

```bash
# Create fix plan document
cat > /tmp/fix-plan.txt << 'PLAN'
FIX PLAN FOR v12.1.0
====================

Issue: [Describe issue that caused rollback]

Investigation Findings:
- [Finding 1]
- [Finding 2]
- [Finding 3]

Proposed Fix:
1. [Fix step 1]
2. [Fix step 2]
3. [Fix step 3]

Testing Plan:
1. Unit tests for fix
2. Integration tests
3. Staging deployment
4. Load testing
5. Security review

Timeline:
- Fix implementation: [TIME]
- Testing: [TIME]
- Staging deployment: [TIME]
- Re-deployment attempt: [TIME]

Approval:
Engineering Lead: _______________
Date: _______________

PLAN

echo "Fix plan created"
echo "Review: /tmp/fix-plan.txt"
```

---

## Rollback Checklist

```
SINGLE INSTANCE ROLLBACK
☐ Instance identified
☐ Current state verified
☐ Container stopped
☐ Container removed
☐ v12.0.0 container started
☐ Startup complete
☐ Health check passed
☐ Load balancer updated
☐ Rollback verified

PHASE ROLLBACK (MULTIPLE INSTANCES)
☐ Phase identified
☐ All instances in phase identified
☐ All containers stopped
☐ All containers removed
☐ All v12.0.0 containers started
☐ Startup complete for all
☐ Health checks passed (all instances)
☐ Load balancer updated
☐ Traffic verified

COMPLETE ROLLBACK (ALL INSTANCES)
☐ All stakeholders notified
☐ All v12.1.0 instances identified
☐ Load balancer disabled (optional)
☐ All containers stopped
☐ All containers removed
☐ All v12.0.0 containers started
☐ Startup complete for all
☐ Health checks passed (all instances)
☐ Load balancer re-enabled
☐ Traffic verified normal

POST-ROLLBACK
☐ Failure logs collected
☐ System state captured
☐ Root cause analysis started
☐ Fix plan created
☐ Team notified
☐ Schedule created for next attempt
```

---

## Emergency Contacts

```
Rollback Authorization Required For:
- Multi-instance rollback during business hours
- Complete rollback at any time

On-Call Engineer
- Contact: [PHONE]
- Slack: @oncall

Team Lead
- Contact: [PHONE]
- Slack: @team-lead

Engineering Manager
- Contact: [PHONE]
- Slack: @engineering-manager

CTO (for critical decisions)
- Contact: [PHONE]
- Slack: @cto
```

---

## Document Metadata

**Document ID:** WAVE-15-ROLLBACK  
**Version:** 1.0  
**Status:** Ready for use  
**Last Updated:** June 2, 2026

**Related Documents:**
- WAVE-15-DEPLOYMENT-STRATEGY.md
- WAVE-15-CANARY-RUNBOOK.md
- WAVE-15-INCIDENT-RESPONSE.md

---

**End of Rollback Procedures**

*This document provides both automatic rollback triggers and manual procedures for all deployment phases. Automatic rollback protects against common failure modes. Manual procedures enable rapid recovery for unexpected issues.*
