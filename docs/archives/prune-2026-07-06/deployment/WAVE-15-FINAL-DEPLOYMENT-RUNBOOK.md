# Wave 15 Final Deployment Runbook
## Basset Hound Browser v12.1.0 - Phase 3 to 100% Completion

**Runbook Version:** 1.0  
**Date:** June 2, 2026  
**Purpose:** Complete deployment to 100% production traffic  
**Expected Duration:** 30-45 minutes  
**Scope:** Deploy v12.1.0 to remaining 2-3 instances

---

## Pre-Final Deployment Verification (T+3:30)

### Step 1: Verify Phase 2 Approval

**Objective:** Confirm Phase 2 was approved before final deployment.

```bash
# Check Phase 2 decision document
if [ -f /tmp/phase2-approval.txt ]; then
  echo "✅ Phase 2 approval document found"
  grep "APPROVAL DECISION:" /tmp/phase2-approval.txt
else
  echo "❌ Phase 2 approval not found"
  echo "STOP - Cannot proceed without Phase 2 approval"
  exit 1
fi

# Verify all Phase 1 & 2 instances are running v12.1.0
EXPECTED_v12_1_0=7  # 3 Phase 1 + 4 Phase 2
RUNNING_v12_1_0=$(docker ps | grep basset-hound | grep -v v12.0.0 | grep -v canary | wc -l)

if [ $RUNNING_v12_1_0 -ge $EXPECTED_v12_1_0 ]; then
  echo "✅ Found $RUNNING_v12_1_0 instances running v12.1.0 (expected $EXPECTED_v12_1_0)"
else
  echo "❌ Not enough v12.1.0 instances running"
  echo "Found: $RUNNING_v12_1_0, Expected: $EXPECTED_v12_1_0"
  exit 1
fi

# Verify Phase 1 & 2 health
echo ""
echo "Verifying Phase 1 & 2 instance health..."
PHASE1_INSTANCES=("basset-hound-prod-instance-01" "basset-hound-prod-instance-02" "basset-hound-prod-instance-03")
PHASE2_INSTANCES=("basset-hound-prod-instance-04" "basset-hound-prod-instance-05" "basset-hound-prod-instance-06" "basset-hound-prod-instance-07")

for instance in "${PHASE1_INSTANCES[@]}" "${PHASE2_INSTANCES[@]}"; do
  if curl -s -X POST http://localhost:8765 \
    -H "Content-Type: application/json" \
    -d '{"command":"ping"}' \
    -m 5 > /dev/null 2>&1; then
    echo "  ✅ $instance: healthy"
  else
    echo "  ❌ $instance: NOT responding"
  fi
done

echo ""
echo "✅ Pre-final deployment verification complete"
```

**Success Criteria:**
- ✅ Phase 2 approval document exists
- ✅ All Phase 1 & 2 instances running v12.1.0
- ✅ All Phase 1 & 2 instances healthy
- ✅ Ready for final deployment

### Step 2: Identify Phase 3 Instances

**Objective:** Identify the remaining 2-3 instances for Phase 3.

```bash
# Identify remaining instances (those still on v12.0.0)
echo "Identifying Phase 3 instances..."

# Get all running instances
ALL_INSTANCES=$(docker ps | grep basset-hound | awk '{print $NF}' | grep -v canary)

# Get Phase 1 & 2 instances
DEPLOYED_INSTANCES=()
for instance in basset-hound-prod-instance-01 basset-hound-prod-instance-02 basset-hound-prod-instance-03 \
                  basset-hound-prod-instance-04 basset-hound-prod-instance-05 basset-hound-prod-instance-06 \
                  basset-hound-prod-instance-07; do
  DEPLOYED_INSTANCES+=("$instance")
done

# Find remaining instances (Phase 3)
PHASE3_INSTANCES=()
for i in {1..10}; do
  INSTANCE="basset-hound-prod-instance-$(printf '%02d' $i)"
  
  # Check if already deployed
  ALREADY_DEPLOYED=false
  for deployed in "${DEPLOYED_INSTANCES[@]}"; do
    if [ "$INSTANCE" = "$deployed" ]; then
      ALREADY_DEPLOYED=true
      break
    fi
  done
  
  if [ "$ALREADY_DEPLOYED" = false ]; then
    PHASE3_INSTANCES+=("$INSTANCE")
  fi
done

echo "Phase 3 Instances (remaining 30%):"
for instance in "${PHASE3_INSTANCES[@]}"; do
  echo "  - $instance"
done

# Verify all Phase 3 instances are running v12.0.0
echo ""
echo "Verifying Phase 3 instances are running v12.0.0..."
for instance in "${PHASE3_INSTANCES[@]}"; do
  if docker ps | grep -q $instance; then
    VERSION=$(docker inspect $instance | jq -r '.[0].Config.Image' | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+')
    echo "  $instance: Running $VERSION"
  else
    echo "  ⚠️  $instance: Not currently running"
  fi
done

# Save Phase 3 instances
printf '%s\n' "${PHASE3_INSTANCES[@]}" > /tmp/phase3-instances.txt

echo "✅ Phase 3 instances identified"
```

**Success Criteria:**
- ✅ Phase 3 instances identified (2-3 instances)
- ✅ All running v12.0.0
- ✅ All instances online
- ✅ Ready for deployment

### Step 3: Prepare for Final Deployment

**Objective:** Verify all systems ready for 100% deployment.

```bash
# Check load balancer status
echo "Load Balancer Status:"
curl -s http://load-balancer:8080/status | jq . || echo "⚠️  Load balancer status unavailable"

# Verify traffic distribution
echo ""
echo "Current Traffic Distribution:"
curl -s http://load-balancer:8080/stats | jq '.summary' || echo "⚠️  Traffic stats unavailable"

# Create final deployment checklist
cat > /tmp/final-deployment-checklist.txt << 'CHECKLIST'
FINAL DEPLOYMENT (100% Completion) CHECKLIST
=============================================

Pre-Deployment Checks:
☐ Phase 2 approval obtained
☐ All Phase 1 instances healthy (3/3)
☐ All Phase 2 instances healthy (4/4)
☐ Phase 3 instances identified and ready (2-3 instances)
☐ All Phase 3 instances running v12.0.0
☐ Load balancer responsive
☐ Monitoring system active
☐ Slack alerts enabled

Deployment Readiness:
☐ v12.1.0 image available and verified
☐ Sufficient disk space (>50GB per instance)
☐ Network connectivity verified
☐ Backup procedures tested
☐ Rollback procedure validated

Team Readiness:
☐ On-call engineer ready
☐ Team lead available
☐ Escalation contacts confirmed
☐ Communication channels open

Final Approval:
☐ Go decision confirmed
☐ All stakeholders notified
☐ Ready to proceed

CHECKLIST

echo "Final deployment checklist prepared"
cat /tmp/final-deployment-checklist.txt
```

**Success Criteria:**
- ✅ Load balancer responsive
- ✅ All pre-deployment checks completed
- ✅ Team ready for final deployment

---

## Final Deployment Execution (T+3:45 to T+4:00)

### Step 4: Deploy v12.1.0 to Phase 3 Instances

**Objective:** Deploy v12.1.0 to final 2-3 instances to reach 100% deployment.

```bash
# Load Phase 3 instances from file
PHASE3_INSTANCES=()
while IFS= read -r instance; do
  PHASE3_INSTANCES+=("$instance")
done < /tmp/phase3-instances.txt

echo "Final Deployment: Deploying v12.1.0 to Phase 3 instances"
echo "Target instances: ${#PHASE3_INSTANCES[@]}"
echo "Expected result: 100% production traffic to v12.1.0"
echo ""

DEPLOYMENT_START=$(date +%s)
DEPLOYMENT_FAILED=false

for instance in "${PHASE3_INSTANCES[@]}"; do
  echo "Deploying to $instance..."
  
  # Create instance backup
  echo "  Creating backup..."
  docker commit $instance basset-hound-browser:$instance-backup-$(date +%s) > /dev/null 2>&1
  
  # Stop current container
  echo "  Stopping v12.0.0..."
  docker stop $instance 2>/dev/null || true
  sleep 2
  
  # Remove old container
  docker rm $instance 2>/dev/null || true
  
  # Start new v12.1.0 container
  echo "  Starting v12.1.0..."
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
  
  # Verify health with retries
  RETRY=0
  HEALTH_OK=false
  while [ $RETRY -lt 4 ]; do
    if curl -s -X POST http://localhost:8765 \
      -H "Content-Type: application/json" \
      -d '{"command":"ping"}' \
      -m 5 > /dev/null 2>&1; then
      echo "  ✅ $instance: Successfully deployed and healthy"
      HEALTH_OK=true
      break
    else
      RETRY=$((RETRY + 1))
      if [ $RETRY -lt 4 ]; then
        echo "  ⏳ Retrying... (attempt $RETRY/3)"
        sleep 3
      fi
    fi
  done
  
  if [ "$HEALTH_OK" = false ]; then
    echo "  ❌ $instance: Failed to become healthy"
    echo "    Rolling back to v12.0.0..."
    docker stop $instance 2>/dev/null || true
    docker run -d --name $instance basset-hound-browser:v12.0.0
    sleep 5
    DEPLOYMENT_FAILED=true
  fi
done

DEPLOYMENT_END=$(date +%s)
DEPLOYMENT_TIME=$((DEPLOYMENT_END - DEPLOYMENT_START))

echo ""
if [ "$DEPLOYMENT_FAILED" = true ]; then
  echo "❌ DEPLOYMENT PARTIALLY FAILED"
  echo "   Some instances may not be on v12.1.0"
  exit 1
else
  echo "✅ All Phase 3 instances deployed successfully"
  echo "   Deployment time: ${DEPLOYMENT_TIME} seconds"
fi
```

**Success Criteria:**
- ✅ All Phase 3 instances deployed to v12.1.0
- ✅ All instances pass health checks
- ✅ No errors in deployment
- ✅ Deployment completed in <15 minutes

### Step 5: Update Load Balancer to 100% Traffic

**Objective:** Route all traffic to v12.1.0 instances.

```bash
# Load Phase 3 instances
PHASE3_INSTANCES=()
while IFS= read -r instance; do
  PHASE3_INSTANCES+=("$instance")
done < /tmp/phase3-instances.txt

echo "Updating load balancer for 100% v12.1.0 traffic..."

# Set weights for Phase 3 instances
for instance in "${PHASE3_INSTANCES[@]}"; do
  curl -s -X POST http://load-balancer:8080/backend/weight \
    -H "Content-Type: application/json" \
    -d "{\"instance\": \"$instance\", \"weight\": 100}" || true
done

# Wait for traffic to stabilize
echo "Waiting for load balancer to stabilize traffic..."
sleep 10

# Verify 100% traffic to v12.1.0
echo ""
echo "Verifying traffic distribution..."
curl -s http://load-balancer:8080/stats | jq '.backends[] | {instance: .name, traffic_percent}' || echo "⚠️  Stats unavailable"

# Verify all instances show v12.1.0
echo ""
echo "Verifying all instances are running v12.1.0..."
RUNNING_v12_1_0=$(docker ps | grep basset-hound | grep -v v12.0.0 | grep -v canary | wc -l)
TOTAL_INSTANCES=$(docker ps | grep basset-hound | grep -v canary | wc -l)

echo "v12.1.0 instances: $RUNNING_v12_1_0"
echo "Total instances: $TOTAL_INSTANCES"

if [ $RUNNING_v12_1_0 -eq $TOTAL_INSTANCES ]; then
  echo "✅ All instances running v12.1.0"
else
  echo "⚠️  Some instances still on v12.0.0"
  echo "    v12.1.0: $RUNNING_v12_1_0 / v12.0.0: $((TOTAL_INSTANCES - RUNNING_v12_1_0))"
fi

echo ""
echo "✅ Load balancer updated to 100% traffic to v12.1.0"
```

**Success Criteria:**
- ✅ Load balancer configured for 100% v12.1.0
- ✅ All instances running v12.1.0
- ✅ Traffic flowing to all instances
- ✅ No traffic loss

### Step 6: Final Validation (T+4:00)

**Objective:** Confirm deployment complete and system stable.

```bash
# Create final validation script
cat > /tmp/final-validation.sh << 'VALIDATION'
#!/bin/bash

echo "=== FINAL DEPLOYMENT VALIDATION ==="
echo "Time: $(date)"
echo ""

# 1. Verify all instances running v12.1.0
echo "1. Instance Status:"
INSTANCE_COUNT=0
HEALTHY_COUNT=0
for instance in $(docker ps | grep basset-hound | grep -v canary | awk '{print $NF}'); do
  INSTANCE_COUNT=$((INSTANCE_COUNT + 1))
  if curl -s -X POST http://localhost:8765 \
    -H "Content-Type: application/json" \
    -d '{"command":"ping"}' \
    -m 5 > /dev/null 2>&1; then
    HEALTHY_COUNT=$((HEALTHY_COUNT + 1))
    echo "  ✅ $instance: Running v12.1.0 and healthy"
  else
    echo "  ❌ $instance: NOT responding"
  fi
done
echo "  Status: $HEALTHY_COUNT/$INSTANCE_COUNT instances healthy"
echo ""

# 2. Check metrics
echo "2. Metrics Summary:"
TOTAL_CPU=0
TOTAL_MEM=0
for instance in $(docker ps | grep basset-hound | grep -v canary | awk '{print $NF}'); do
  STATS=$(docker stats --no-stream $instance --format "{{.CPUPerc}} {{.MemUsage}}")
  CPU=$(echo "$STATS" | awk '{print $1}' | sed 's/%//')
  MEM=$(echo "$STATS" | awk '{print $2}' | sed 's/[GMB].*//g')
  TOTAL_CPU=$(echo "$TOTAL_CPU + $CPU" | bc 2>/dev/null || echo 0)
  TOTAL_MEM=$(echo "$TOTAL_MEM + $MEM" | bc 2>/dev/null || echo 0)
done
echo "  Avg CPU: $(echo "$TOTAL_CPU / $INSTANCE_COUNT" | bc 2>/dev/null)%"
echo "  Total Memory: ${TOTAL_MEM}GB"
echo ""

# 3. Check error rates
echo "3. Error Summary:"
TOTAL_ERRORS=0
for instance in $(docker ps | grep basset-hound | grep -v canary | awk '{print $NF}'); do
  ERRORS=$(docker logs $instance 2>/dev/null | tail -100 | grep ERROR | wc -l)
  TOTAL_ERRORS=$((TOTAL_ERRORS + ERRORS))
done
echo "  Total errors (last 100 lines per instance): $TOTAL_ERRORS"
if [ $TOTAL_ERRORS -lt 5 ]; then
  echo "  ✅ Error rate acceptable"
else
  echo "  ⚠️  Review error logs"
fi
echo ""

# 4. Check traffic distribution
echo "4. Traffic Distribution:"
curl -s http://load-balancer:8080/stats | jq '.summary | {total_connections, total_requests, avg_latency}' 2>/dev/null || echo "  ⚠️  Load balancer stats unavailable"
echo ""

# 5. Final approval
echo "5. Deployment Status:"
if [ $HEALTHY_COUNT -eq $INSTANCE_COUNT ] && [ $INSTANCE_COUNT -eq 10 ]; then
  echo "  ✅ DEPLOYMENT COMPLETE"
  echo "  ✅ ALL 10 INSTANCES RUNNING v12.1.0"
  echo "  ✅ 100% PRODUCTION TRAFFIC"
else
  echo "  ⚠️  DEPLOYMENT INCOMPLETE"
  echo "     Healthy instances: $HEALTHY_COUNT/$INSTANCE_COUNT"
fi

VALIDATION

chmod +x /tmp/final-validation.sh
/tmp/final-validation.sh
```

**Success Criteria:**
- ✅ All 10 instances running v12.1.0
- ✅ All instances healthy and responsive
- ✅ CPU usage <30%
- ✅ Memory usage stable
- ✅ Error rate <0.1%
- ✅ Traffic flowing to all instances
- ✅ 100% deployment achieved

---

## Post-Deployment Cleanup

### Step 7: Stop Canary Instance

**Objective:** Remove canary instance now that full deployment is complete.

```bash
echo "Cleaning up canary instance..."

# Stop canary
docker stop basset-hound-v12.1.0-canary 2>/dev/null || true
docker rm basset-hound-v12.1.0-canary 2>/dev/null || true

# Verify canary removed
if docker ps | grep -q canary; then
  echo "⚠️  Canary container still running"
else
  echo "✅ Canary instance removed"
fi

# Archive canary metrics
if [ -f /tmp/canary-metrics-detailed.txt ]; then
  tar czf /backup/canary-data-final-$(date +%s).tar.gz /tmp/canary-* /tmp/phase*-approval.txt
  echo "✅ Canary data archived"
fi
```

**Success Criteria:**
- ✅ Canary instance stopped and removed
- ✅ Canary data archived for reference
- ✅ No canary containers running

### Step 8: Archive Deployment Documentation

**Objective:** Save all deployment logs and reports for records.

```bash
echo "Archiving deployment documentation..."

# Create deployment summary
cat > /tmp/wave-15-deployment-summary.txt << 'SUMMARY'
WAVE 15 DEPLOYMENT SUMMARY
===========================

Deployment Date: $(date)
Version: v12.1.0
Target: 10 instances, 100% production traffic
Duration: 4 hours (estimated)

PHASES EXECUTED:
1. Canary: 1 instance, 30-60 minutes, ✅ APPROVED
2. Phase 1: 3 instances (25%), 1 hour, ✅ APPROVED
3. Phase 2: 4 instances (50%), 30 minutes, ✅ APPROVED
4. Final: 2-3 instances (100%), 15 minutes, ✅ COMPLETE

RESULTS:
✅ All 10 instances deployed to v12.1.0
✅ 100% production traffic to new version
✅ Zero deployment errors
✅ All health checks passing
✅ Metrics within acceptable ranges
✅ No rollbacks required

DEPLOYMENT TIME: [ACTUAL TIME]
TOTAL INSTANCES: 10
SUCCESS RATE: 100%

NEXT STEPS:
1. 24-hour continuous monitoring
2. Performance comparison vs v12.0.0
3. User feedback collection
4. Final deployment success report

APPROVAL SIGN-OFF:
Date: $(date)
Deployed by: [NAME]
Verified by: [NAME]

SUMMARY

# Archive all deployment files
tar czf /backup/wave-15-deployment-$(date +%Y%m%d-%H%M%S).tar.gz \
  /tmp/canary-* \
  /tmp/phase* \
  /tmp/final-deployment-checklist.txt \
  /tmp/wave-15-deployment-summary.txt \
  /tmp/final-validation.sh

echo "✅ Deployment documentation archived"
```

**Success Criteria:**
- ✅ Deployment summary created
- ✅ All files archived
- ✅ Archive verification successful

---

## Deployment Completion Checklist

```
FINAL DEPLOYMENT (100%) COMPLETION CHECKLIST
==============================================

Pre-Final Deployment
☐ Phase 2 approval confirmed
☐ All Phase 1 instances healthy
☐ All Phase 2 instances healthy
☐ Phase 3 instances ready

Final Deployment Execution
☐ Phase 3 instances deployed to v12.1.0
☐ All Phase 3 instances health checks passed
☐ Load balancer updated to 100% traffic
☐ Canary instance stopped

Final Validation
☐ All 10 instances running v12.1.0
☐ All 10 instances healthy and responding
☐ CPU usage <30%
☐ Memory usage stable
☐ Error rate <0.1%
☐ Traffic distributed evenly
☐ All features operational

Post-Deployment
☐ Canary instance removed
☐ Deployment data archived
☐ Documentation complete
☐ Team notified of completion

RESULT: ✅ WAVE 15 DEPLOYMENT COMPLETE
All instances running v12.1.0 in production
100% traffic routed to new version
Ready for 24-hour monitoring phase
```

---

## Communication

### Deployment Success Notification

```bash
# Send success notification to Slack
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-type: application/json' \
  -d '{
    "text": "🎉 *Wave 15 Deployment COMPLETE*",
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "✅ *Basset Hound v12.1.0 Deployment SUCCESSFUL*\n\n*Deployment Summary:*\n• Duration: ~4 hours\n• Instances: 10/10 deployed\n• Status: 100% production traffic\n• Errors: 0\n\n*Next:* 24-hour monitoring phase\n*Success Rate:* 100% (zero rollbacks)"
        }
      }
    ]
  }'
```

---

## Document Metadata

**Runbook ID:** WAVE-15-FINAL  
**Version:** 1.0  
**Status:** Ready for execution  
**Expected Duration:** 30-45 minutes  

**Related Documents:**
- WAVE-15-DEPLOYMENT-STRATEGY.md
- WAVE-15-CANARY-RUNBOOK.md
- WAVE-15-PROGRESSIVE-ROLLOUT-RUNBOOK.md
- WAVE-15-DEPLOYMENT-CHECKLIST.md

---

**End of Final Deployment Runbook**

*This runbook completes the Wave 15 deployment by bringing all remaining instances to v12.1.0. After completion, the system enters the 24-hour post-deployment monitoring phase.*
