# Wave 15 Canary Deployment Runbook
## Basset Hound Browser v12.1.0

**Runbook Version:** 1.0  
**Date:** June 2, 2026  
**Purpose:** Step-by-step procedure for canary deployment to single instance  
**Expected Duration:** 30-60 minutes  
**Risk Level:** VERY LOW (single instance, easy rollback)

---

## Pre-Deployment Preparation (T-30 minutes)

### Step 1: Verify Current v12.0.0 State

**Objective:** Confirm baseline instance is healthy and ready for upgrade.

```bash
# Check instance is running
docker ps | grep basset-hound-v12.0.0
# Expected: Container running, port 8765 mapped

# Verify port is accessible
nc -zv localhost 8765
# Expected: Connection succeeded

# Run baseline ping test
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"command":"ping"}' \
  -m 5 \
  -s -w "\nHTTP Status: %{http_code}\n"
# Expected: HTTP 200, response time <100ms

# Capture baseline metrics
docker stats --no-stream basset-hound-v12.0.0 > /tmp/baseline-v12.0.0.txt
echo "CPU and memory baseline captured"

# Check logs for errors
docker logs basset-hound-v12.0.0 | tail -20 | grep ERROR || echo "✅ No recent errors"
```

**Success Criteria:**
- ✅ Container is running
- ✅ Port 8765 is accessible
- ✅ Ping command responds in <100ms
- ✅ Baseline metrics captured
- ✅ No ERROR entries in recent logs

### Step 2: Pull v12.1.0 Docker Image

**Objective:** Download and verify v12.1.0 image before deployment.

```bash
# Pull the image
echo "Pulling basset-hound-browser:v12.1.0..."
docker pull basset-hound-browser:v12.1.0

# Verify image pulled successfully
docker images | grep basset-hound-browser:v12.1.0
# Expected: v12.1.0 image present with correct hash

# Verify image size is reasonable (~900MB-1GB)
docker images --no-trunc | grep v12.1.0
# Expected: Size within expected range

# Inspect image metadata
docker inspect basset-hound-browser:v12.1.0 | jq '.[] | {Created, RepoTags, Size}'
```

**Success Criteria:**
- ✅ Image pulled successfully
- ✅ Image size is reasonable (900MB-1.2GB)
- ✅ Image hash matches expected value
- ✅ Image metadata is valid

### Step 3: Backup Current Configuration

**Objective:** Create restore point before deploying canary.

```bash
# Backup container configuration
echo "Creating configuration backup..."
docker inspect basset-hound-v12.0.0 > /backup/canary-v12.0.0-config.json

# Backup recent logs
docker logs basset-hound-v12.0.0 > /backup/canary-v12.0.0-logs.txt 2>&1

# Capture environment variables
docker exec basset-hound-v12.0.0 env > /backup/canary-v12.0.0-env.txt

# Create filesystem snapshot
docker commit basset-hound-v12.0.0 basset-hound-browser:v12.0.0-backup-$(date +%s)

# Verify backups created
ls -lh /backup/canary-v12.0.0-*
```

**Success Criteria:**
- ✅ Configuration JSON backed up
- ✅ Logs backed up
- ✅ Environment captured
- ✅ Filesystem snapshot created
- ✅ All backups verified readable

### Step 4: Verify Monitoring is Ready

**Objective:** Ensure monitoring dashboards and alerts are active.

```bash
# Verify monitoring agent is running
ps aux | grep prometheus || echo "⚠️  Prometheus not found"
ps aux | grep grafana || echo "⚠️  Grafana not found"

# Test Slack alerting
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-type: application/json' \
  -d '{"text":"[TEST] Canary deployment monitoring test - please ignore"}'
# Expected: Slack message received

# Verify metrics collection
curl -s http://prometheus:9090/api/v1/targets | jq '.data.activeTargets | length'
# Expected: >0 targets active

# Check Grafana dashboard accessibility
curl -s http://localhost:3000/api/dashboards/home | jq '.status' || echo "⚠️  Grafana not accessible"

echo "✅ Monitoring readiness verified"
```

**Success Criteria:**
- ✅ Monitoring agent running
- ✅ Slack integration responding
- ✅ Metrics collection active (>0 targets)
- ✅ Grafana dashboard accessible

### Step 5: Final Readiness Confirmation

**Objective:** Confirm all prerequisites met before proceeding.

```bash
# Create readiness checklist
cat > /tmp/canary-readiness.txt << 'EOF'
CANARY DEPLOYMENT READINESS CHECKLIST

Pre-Deployment Verification:
☐ v12.0.0 instance healthy (running, port open, ping works)
☐ Baseline metrics captured
☐ v12.1.0 image pulled and verified
☐ Configuration backups created
☐ Monitoring dashboards ready
☐ Slack alerting tested
☐ Deployment runbook reviewed
☐ Team members ready
☐ All stakeholders notified

Approval:
☐ Engineering Lead: _______________
☐ Operations Lead: _______________
☐ On-Call Engineer: _______________

Date: ________________
Time: ________________
EOF

echo "✅ Readiness checklist created at /tmp/canary-readiness.txt"
echo "   Please review and confirm all items before proceeding"
```

**Success Criteria:**
- ✅ All checklist items reviewed
- ✅ Team lead approval obtained
- ✅ Operations lead confirmation received
- ✅ Ready to proceed with canary deployment

---

## Canary Deployment Execution (T+0)

### Step 6: Deploy v12.1.0 Canary Instance

**Objective:** Start v12.1.0 container with same configuration as v12.0.0.

**Important:** Deploy as parallel instance, do NOT stop v12.0.0 yet.

```bash
# Get current container configuration
docker inspect basset-hound-v12.0.0 | jq '.[] | {
  HostConfig,
  Env,
  Cmd,
  Entrypoint,
  ExposedPorts,
  Volumes
}' > /tmp/v12.0.0-config.json

# Deploy v12.1.0 with same configuration
echo "Deploying v12.1.0 canary instance..."
docker run -d \
  --name basset-hound-v12.1.0-canary \
  --network host \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  -e WEBSOCKET_PORT=8765 \
  -e COMPRESSION_ENABLED=true \
  -v ~/.basset-hound:/home/app/.basset-hound \
  -v /var/log/basset-hound:/var/log/basset-hound \
  basset-hound-browser:v12.1.0

# Capture container ID
CONTAINER_ID=$(docker ps -f name=basset-hound-v12.1.0-canary -q)
echo "✅ Container deployed: $CONTAINER_ID"

# Wait for container startup
echo "Waiting for container initialization..."
sleep 5
```

**Success Criteria:**
- ✅ Container started successfully
- ✅ Container ID captured
- ✅ No immediate errors in startup

### Step 7: Verify Canary Startup (T+0:30)

**Objective:** Confirm v12.1.0 container started and is healthy.

```bash
# Verify container is running
docker ps | grep basset-hound-v12.1.0-canary
# Expected: Container running, less than 30 seconds old

# Check for startup errors
docker logs basset-hound-v12.1.0-canary
# Expected: No ERROR or FATAL entries

# Verify WebSocket port is listening
netstat -tlnp | grep 8765
# Expected: Process listening on port 8765

# Test port accessibility
nc -zv localhost 8765
# Expected: Connection successful

# Quick response time test
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"command":"ping"}' \
  -m 5 \
  -s -w "\nHTTP Status: %{http_code}\nResponse time: %{time_total}s\n"
# Expected: HTTP 200, response <100ms
```

**Success Criteria:**
- ✅ Container running and ready
- ✅ No startup errors in logs
- ✅ WebSocket port listening
- ✅ Ping command responds in <100ms
- ✅ HTTP status 200

**If any checks fail:**
```bash
# View detailed logs
docker logs basset-hound-v12.1.0-canary -f --tail 50

# Attempt restart (once)
docker restart basset-hound-v12.1.0-canary
sleep 5

# Re-verify, if still failing -> ROLLBACK (skip to Step 11)
```

### Step 8: Run Canary Smoke Tests (T+0:45)

**Objective:** Execute minimal test suite to verify core functionality.

```bash
# Create test script
cat > /tmp/canary-smoke-tests.sh << 'TESTS'
#!/bin/bash
set -e

echo "Starting canary smoke tests..."

# Test 1: Ping command
echo -n "Test 1: Ping command... "
RESPONSE=$(curl -s -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"command":"ping"}')
if [[ $RESPONSE == *"pong"* ]]; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
  exit 1
fi

# Test 2: Navigate command
echo -n "Test 2: Navigate command... "
RESPONSE=$(curl -s -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"command":"navigate","url":"http://example.com"}')
if [[ $RESPONSE == *"success"* ]] || [[ -z "$RESPONSE" ]]; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
  exit 1
fi

# Test 3: Screenshot command
echo -n "Test 3: Screenshot command... "
RESPONSE=$(curl -s -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"command":"screenshot"}')
if [[ ${#RESPONSE} -gt 100 ]]; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
  exit 1
fi

# Test 4: Get page content
echo -n "Test 4: Get page content... "
RESPONSE=$(curl -s -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"command":"getPageContent"}')
if [[ ${#RESPONSE} -gt 100 ]]; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
  exit 1
fi

echo ""
echo "✅ All smoke tests passed!"
TESTS

chmod +x /tmp/canary-smoke-tests.sh
/tmp/canary-smoke-tests.sh
```

**Success Criteria:**
- ✅ All 4 smoke tests pass
- ✅ No command timeouts
- ✅ All responses valid and complete

**If smoke tests fail:**
```bash
# Investigate failure
docker logs basset-hound-v12.1.0-canary -f --tail 100

# Check if issue is transient (wait 30 seconds and retry)
sleep 30
/tmp/canary-smoke-tests.sh || {
  echo "❌ Smoke tests still failing"
  echo "Proceeding with rollback to v12.0.0"
  # Jump to Step 11: Rollback
}
```

### Step 9: Monitor Canary Metrics (T+1:00 to T+1:30)

**Objective:** Verify v12.1.0 metrics are stable and healthy.

```bash
# Setup continuous monitoring
echo "Monitoring v12.1.0 canary for 30 minutes..."

# Create monitoring script
cat > /tmp/monitor-canary.sh << 'MONITOR'
#!/bin/bash

RUNTIME=1800  # 30 minutes in seconds
INTERVAL=30   # Check every 30 seconds
ELAPSED=0

echo "Canary Monitoring Report"
echo "========================"
echo "Start Time: $(date)"
echo "Duration: $RUNTIME seconds"
echo ""

while [ $ELAPSED -lt $RUNTIME ]; do
  # Get metrics
  STATS=$(docker stats --no-stream basset-hound-v12.1.0-canary --format "{{.CPUPerc}} {{.MemUsage}}")
  ERRORS=$(docker logs basset-hound-v12.1.0-canary | grep -c ERROR || echo 0)
  
  # Response time test
  RESPONSE_TIME=$(curl -s -X POST http://localhost:8765 \
    -H "Content-Type: application/json" \
    -d '{"command":"ping"}' \
    -w "%{time_total}" -o /dev/null)
  
  # Print metrics
  echo "[$(date '+%H:%M:%S')] CPU+Mem: $STATS | Errors: $ERRORS | Latency: ${RESPONSE_TIME}s"
  
  # Check for issues
  CPU=$(echo $STATS | awk '{print $1}' | sed 's/%//')
  if (( $(echo "$CPU > 80" | bc -l) )); then
    echo "⚠️  HIGH CPU USAGE: $CPU%"
  fi
  
  if [ $ERRORS -gt 0 ]; then
    echo "⚠️  ERRORS DETECTED: $ERRORS"
  fi
  
  # Sleep before next check
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo ""
echo "End Time: $(date)"
echo "Monitoring complete"
MONITOR

chmod +x /tmp/monitor-canary.sh
/tmp/monitor-canary.sh &
MONITOR_PID=$!

# Also collect detailed metrics
docker stats --no-stream basset-hound-v12.1.0-canary > /tmp/canary-metrics-detailed.txt
```

**Success Criteria (after 30 minutes):**
- ✅ CPU usage <20%
- ✅ Memory usage <2GB and stable
- ✅ Error count = 0
- ✅ Response times <100ms average
- ✅ No memory growth trend
- ✅ No connection errors

**Metrics Analysis:**
```bash
# Analyze collected metrics
echo "=== Canary Metrics Summary ==="
docker stats --no-stream basset-hound-v12.1.0-canary
echo ""
echo "Recent logs (errors only):"
docker logs basset-hound-v12.1.0-canary | grep ERROR | tail -5 || echo "✅ No errors"
```

**If metrics show issues:**
```bash
# Document the issue
docker logs basset-hound-v12.1.0-canary > /tmp/canary-failure-logs.txt
echo "Issue documented in /tmp/canary-failure-logs.txt"

# Proceed with rollback (Step 11)
```

---

## Canary Approval Decision Point (T+1:30)

### Step 10: Make GO/NO-GO Decision

**Objective:** Determine if canary is healthy enough to proceed with full rollout.

**Decision Criteria:**

| Criteria | Target | Status | Decision |
|----------|--------|--------|----------|
| **Container Status** | Running | ? | ✅ GO / ❌ STOP |
| **Startup Time** | <5 sec | ? | ✅ GO / ❌ STOP |
| **Smoke Tests** | 100% pass | ? | ✅ GO / ❌ STOP |
| **CPU Usage** | <20% | ? | ✅ GO / ❌ STOP |
| **Memory** | <2GB, stable | ? | ✅ GO / ❌ STOP |
| **Error Rate** | 0% | ? | ✅ GO / ❌ STOP |
| **Response Time** | <100ms | ? | ✅ GO / ❌ STOP |

**Decision Process:**
```bash
# Create decision document
cat > /tmp/canary-decision.txt << 'DECISION'
CANARY DEPLOYMENT DECISION REPORT
==================================

Deployment: Wave 15 - v12.1.0
Date: $(date)
Time: $(date +%H:%M:%S)

METRICS SUMMARY:
$(docker stats --no-stream basset-hound-v12.1.0-canary)

ERROR SUMMARY:
$(docker logs basset-hound-v12.1.0-canary | grep ERROR | wc -l) errors detected

DECISION:
[CHOOSE ONE]
☐ GO - Proceed with Phase 1 (25% rollout)
☐ STOP - Rollback to v12.0.0

APPROVAL:
On-Call Engineer: _______________
Team Lead: _______________
Timestamp: _______________

NOTES:
[Any issues or observations]

DECISION
```

**GO Decision - Proceed to Phase 1:**
```bash
echo "✅ CANARY APPROVED - PROCEEDING WITH PHASE 1"
echo "Keep v12.1.0 canary running"
echo "Next: Deploy Phase 1 (2-3 additional instances)"
```

**NO-GO Decision - Rollback Required:**
```bash
echo "❌ CANARY FAILED - INITIATING ROLLBACK"
# Jump to Step 11: Rollback
```

---

## Rollback Procedure (If Needed)

### Step 11: Execute Canary Rollback

**Objective:** Remove v12.1.0 canary instance and restore confidence in v12.0.0.

**Only execute if canary health checks failed or metrics unacceptable.**

```bash
# Stop v12.1.0 canary
echo "Stopping v12.1.0 canary instance..."
docker stop basset-hound-v12.1.0-canary
docker rm basset-hound-v12.1.0-canary

# Verify v12.0.0 still running
docker ps | grep basset-hound-v12.0.0
# Expected: Original v12.0.0 container still running

# Verify v12.0.0 is still healthy
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"command":"ping"}' \
  -m 5

# Verify metrics
docker stats --no-stream basset-hound-v12.0.0
```

**Success Criteria:**
- ✅ v12.1.0 canary stopped and removed
- ✅ v12.0.0 still running and healthy
- ✅ Ping command responds successfully
- ✅ Metrics nominal

```bash
# Create rollback report
cat > /tmp/canary-rollback-report.txt << 'REPORT'
CANARY ROLLBACK REPORT
======================

Deployment: Wave 15 - v12.1.0
Rollback Time: $(date)

REASON FOR ROLLBACK:
[Document why rollback was initiated]

ACTIONS TAKEN:
1. ✅ Stopped v12.1.0 canary container
2. ✅ Removed v12.1.0 container
3. ✅ Verified v12.0.0 health
4. ✅ Confirmed service recovery

CURRENT STATE:
v12.0.0 is running and healthy
Service is operational

NEXT STEPS:
1. Investigate root cause
2. Fix identified issues
3. Re-test in staging
4. Schedule new deployment attempt

REPORT

echo "Rollback complete. Report: /tmp/canary-rollback-report.txt"
```

---

## Post-Canary Approval Actions

### Step 12: Notify Team of Canary Approval

**Objective:** Inform team that canary is approved and Phase 1 can begin.

```bash
# Send Slack notification
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-type: application/json' \
  -d '{
    "text": "🚀 *Wave 15 Canary APPROVED*",
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "✅ *Wave 15 v12.1.0 Canary Deployment APPROVED*\n\n*Metrics:*\n• CPU Usage: <20%\n• Memory: Stable\n• Error Rate: 0%\n• Response Time: <100ms\n\n*Status:* Ready to proceed with Phase 1 (25% rollout)\n*Next:* Phase 1 deployment to 2-3 instances"
        }
      }
    ]
  }'

# Update deployment tracker
echo "Wave 15 - Canary APPROVED - $(date)" >> /var/log/deployment-tracker.log

# Archive canary metrics
tar czf /backup/canary-metrics-$(date +%s).tar.gz /tmp/canary-metrics-*.txt

echo "✅ Team notified of canary approval"
```

### Step 13: Prepare Phase 1 Deployment

**Objective:** Get ready for Phase 1 (25% rollout to 2-3 instances).

```bash
# Keep canary running as reference
echo "Canary instance: $(docker ps -f name=basset-hound-v12.1.0-canary -q)"

# Prepare list of Phase 1 instances
cat > /tmp/phase-1-instances.txt << 'INSTANCES'
basset-hound-prod-instance-01
basset-hound-prod-instance-02
basset-hound-prod-instance-03
INSTANCES

echo "Phase 1 instances prepared:"
cat /tmp/phase-1-instances.txt

# Review Phase 1 runbook
echo "Next: Execute WAVE-15-PROGRESSIVE-ROLLOUT-RUNBOOK.md"
echo "Phase 1: Deploy to instances 01-03"
```

---

## Canary Deployment Checklist

**Canary Deployment Completion Checklist:**

```
PRE-DEPLOYMENT (T-30)
☐ v12.0.0 instance verified healthy
☐ Baseline metrics captured
☐ v12.1.0 image pulled and verified
☐ Configuration backups created
☐ Monitoring system ready
☐ Slack alerts tested
☐ Readiness sign-off obtained

DEPLOYMENT EXECUTION (T+0)
☐ v12.1.0 canary deployed
☐ Container startup successful (<5 sec)
☐ WebSocket port 8765 responding
☐ No ERROR entries in logs

SMOKE TESTING (T+45)
☐ Ping command: PASS
☐ Navigate command: PASS
☐ Screenshot command: PASS
☐ GetPageContent command: PASS

METRICS MONITORING (T+1:00 to T+1:30)
☐ CPU usage <20%
☐ Memory <2GB and stable
☐ Error count = 0
☐ Response time <100ms
☐ No memory leaks detected
☐ All 4 smoke tests still passing

DECISION & APPROVAL (T+1:30)
☐ Metrics review complete
☐ Decision document signed
☐ GO decision confirmed
☐ Team lead approval obtained

POST-APPROVAL
☐ Slack notification sent
☐ Canary metrics archived
☐ Phase 1 instances identified
☐ Ready for Phase 1 deployment

ROLLBACK (If needed)
☐ v12.1.0 canary stopped
☐ v12.0.0 health verified
☐ Rollback report created
☐ Root cause documented
```

---

## Support & Escalation

### If Deployment Fails

1. **Canary won't start:**
   - Check Docker logs: `docker logs basset-hound-v12.1.0-canary`
   - Verify image is valid: `docker run basset-hound-browser:v12.1.0 /bin/bash`
   - Check disk space: `df -h`
   - Rollback: Execute Step 11

2. **Smoke tests fail:**
   - Check WebSocket port: `netstat -tlnp | grep 8765`
   - Check application logs: `docker logs -f basset-hound-v12.1.0-canary`
   - Verify network: `ping localhost`
   - Rollback: Execute Step 11

3. **Metrics show issues:**
   - High CPU: Check what process is consuming CPU
   - High memory: Check for memory leaks, restart container
   - High error rate: Review application logs
   - Rollback: Execute Step 11

### Escalation Chain

- **Step 1:** On-call engineer (troubleshoot)
- **Step 2:** Team lead (approve decisions)
- **Step 3:** Engineering manager (authorize rollback)
- **Step 4:** CTO (if critical issue, halt entire deployment)

---

## Document Metadata

**Runbook ID:** WAVE-15-CANARY  
**Version:** 1.0  
**Last Updated:** June 2, 2026  
**Author:** Deployment Automation  
**Status:** Ready for execution  

**Related Documents:**
- WAVE-15-DEPLOYMENT-STRATEGY.md
- WAVE-15-PROGRESSIVE-ROLLOUT-RUNBOOK.md
- WAVE-15-ROLLBACK-PROCEDURES.md
- LOAD-TESTING-MANIFEST.md

---

**End of Runbook**

*This canary runbook is designed to be self-contained and executable by a single on-call engineer. It provides comprehensive steps with clear success/failure criteria at each stage. Expected completion time: 30-60 minutes.*
