# Rollback Runbook - v12.0.0 to v11.3.0

**Document Version:** 1.0  
**Date:** May 11, 2026  
**Target Rollback:** v12.0.0 → v11.3.0  
**Maximum Rollback Time:** 5 minutes to stable state

---

## Overview

This runbook provides emergency procedures to quickly rollback from v12.0.0 to v11.3.0 in case of critical issues. Rollback can be executed at any point during canary, progressive, or full deployment phases.

**Scope:**
- Immediate (< 5 min) return to v11.3.0
- Data integrity verification
- Service health restoration
- Communication procedures

---

## Rollback Triggers

### Automatic Rollback (No Approval Needed)

Execute rollback immediately if:

1. **Service Down:** WebSocket API unreachable (HTTP response not 426) for > 2 minutes
2. **Critical Errors:** 5+ CRITICAL level errors in logs within 10 minutes
3. **Memory Leak:** Memory usage > 150% of baseline and growing
4. **Cascading Failures:** > 10% error rate for > 5 minutes
5. **Data Corruption:** Inability to read/write session data

### Approved Rollback (Requires Decision)

Execute with approval of Technical Lead if:

1. **Elevated Error Rate:** Error rate > 3% for > 15 minutes
2. **Performance Degradation:** Latency p95 > 2x baseline
3. **Resource Exhaustion:** CPU > 90% sustained, Memory > 85% sustained
4. **Incompatibility Issues:** Detected incompatibility with dependent services

---

## Pre-Rollback Checklist (1 minute)

**Primary On-Call Actions:**

- [ ] **Verify rollback is necessary**
  ```bash
  # Confirm alert or issue triggering rollback
  docker logs basset-hound-browser 2>&1 | tail -50 | head -20
  # Look for error patterns or CRITICAL messages
  ```

- [ ] **Record current state**
  ```bash
  ROLLBACK_TIMESTAMP=$(date +%s)
  echo "Rollback initiated: $(date)" > /tmp/rollback-state-$ROLLBACK_TIMESTAMP.txt
  docker ps -a | grep basset >> /tmp/rollback-state-$ROLLBACK_TIMESTAMP.txt
  docker logs --tail=100 basset-hound-browser >> /tmp/rollback-state-$ROLLBACK_TIMESTAMP.txt
  ```

- [ ] **Notify team**
  ```bash
  echo "[INCIDENT] v12.0.0 rollback initiated
  Reason: [TBD]
  ETA to v11.3.0: < 5 minutes
  Slack: #deployments #incidents"
  ```

- [ ] **Backup v12.0.0 logs**
  ```bash
  docker logs basset-hound-browser > /backups/v12.0.0-logs-$(date +%Y%m%d-%H%M%S).log 2>&1
  ```

---

## IMMEDIATE ROLLBACK PROCEDURE (< 5 minutes)

### Single Instance Rollback (For Canary or Limited Deployment)

**On Target Host:**

**Step 1: Stop v12.0.0 Container (30 seconds)**

```bash
# Graceful shutdown with timeout
echo "Stopping v12.0.0 container..."
docker stop basset-hound-browser --time=30

# Verify stopped
sleep 5
docker ps | grep basset-hound-browser && echo "WARN: Container still running" || echo "✓ Container stopped"
```

**Step 2: Restore v11.3.0 Container (1 minute)**

```bash
# Option A: If backup container exists
if docker ps -a | grep -q "basset-hound-browser-v11.3.0-backup"; then
  echo "Restoring from backup container..."
  docker rename basset-hound-browser-v11.3.0-backup basset-hound-browser
  docker start basset-hound-browser
  
# Option B: If using image backup
elif docker images | grep -q "basset-hound-browser:pre-canary"; then
  echo "Starting from v11.3.0 image..."
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
    basset-hound-browser:pre-canary

# Option C: Last resort - pull from registry
else
  echo "Pulling v11.3.0 from registry..."
  docker pull registry.basset-prod.local/basset-hound-browser:v11.3.0
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
    registry.basset-prod.local/basset-hound-browser:v11.3.0
fi

# Wait for startup
sleep 30
echo "✓ v11.3.0 container started"
```

**Step 3: Verify Rollback Success (30 seconds)**

```bash
# Check container is running
if docker ps | grep -q "basset-hound-browser"; then
  echo "✓ Container running"
else
  echo "✗ Container failed to start"
  exit 1
fi

# Verify WebSocket is responding
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8765)
if [ "$HEALTH" == "426" ]; then
  echo "✓ WebSocket responding (HTTP 426)"
else
  echo "⚠ WebSocket status: HTTP $HEALTH"
fi

# Quick command test
timeout 5 node -e "
  const WebSocket = require('ws');
  const ws = new WebSocket('ws://localhost:8765');
  ws.on('open', () => {
    ws.send(JSON.stringify({cmd: 'getStatus'}));
    ws.on('message', (msg) => {
      console.log('✓ WebSocket responding');
      ws.close();
      process.exit(0);
    });
    setTimeout(() => { ws.close(); process.exit(1); }, 3000);
  });
" || echo "WebSocket test timed out"
```

**Step 4: Record Rollback State (1 minute)**

```bash
ROLLBACK_COMPLETE=$(date +%s)
cat >> /tmp/rollback-state-$ROLLBACK_TIMESTAMP.txt << EOF

=== ROLLBACK COMPLETED ===
Completion Time: $(date)
Duration: $((ROLLBACK_COMPLETE - ROLLBACK_TIMESTAMP)) seconds
Status: SUCCESS
Container: $(docker ps -f name=basset-hound-browser --format '{{.Status}}')
Version: $(docker inspect basset-hound-browser | jq -r '.[0].Config.Image')
EOF
```

---

### Fleet-Wide Rollback (For Multi-Instance Deployment)

**Deployment Lead Actions:**

**Step 1: Remove from Load Balancer (1 minute)**

```bash
# Immediately drain traffic
curl -X PATCH http://load-balancer:8080/backend/config \
  -d '{
    "instances": {
      "basset-prod-01": {"enabled": false},
      "basset-prod-02": {"enabled": false},
      "basset-prod-03": {"enabled": false},
      "basset-prod-04": {"enabled": false},
      "basset-prod-05": {"enabled": false},
      "basset-prod-06": {"enabled": false},
      "basset-prod-07": {"enabled": false},
      "basset-prod-08": {"enabled": false},
      "basset-prod-09": {"enabled": false},
      "basset-prod-10": {"enabled": false}
    }
  }' || true

echo "✓ Traffic drained from load balancer"
```

**Step 2: Parallel Rollback to All Instances (3 minutes)**

```bash
# Function to rollback single instance
rollback_instance() {
  local host=$1
  echo "Rolling back $host..."
  
  ssh $host << 'ROLLBACK'
    # Stop v12.0.0
    docker stop basset-hound-browser --time=30 || true
    docker rm basset-hound-browser || true
    
    # Start v11.3.0 (from backup if available)
    if docker ps -a | grep -q "basset-hound-browser-v11.3.0-backup"; then
      docker rename basset-hound-browser-v11.3.0-backup basset-hound-browser
      docker start basset-hound-browser
    else
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
        basset-hound-browser:v11.3.0 || \
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
        registry.basset-prod.local/basset-hound-browser:v11.3.0
    fi
    
    sleep 30
ROLLBACK
  
  echo "✓ Rolled back $host"
}

# Execute rollback in parallel
for host in basset-prod-{01..10}; do
  rollback_instance $host &
done
wait

echo "✓ All instances rolled back to v11.3.0"
```

**Step 3: Health Verification (1 minute)**

```bash
# Verify all instances are healthy
FAILED=0
for host in basset-prod-{01..10}; do
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://$host:8765)
  if [ "$HEALTH" == "426" ]; then
    echo "✓ $host: Healthy"
  else
    echo "⚠ $host: HTTP $HEALTH"
    FAILED=$((FAILED + 1))
  fi
done

echo "Instances healthy: $((10 - FAILED))/10"
if [ $FAILED -gt 0 ]; then
  echo "WARNING: $FAILED instances need investigation"
fi
```

**Step 4: Restore to Load Balancer (1 minute)**

```bash
# Restore traffic to v11.3.0 instances
curl -X PATCH http://load-balancer:8080/backend/config \
  -d '{
    "instances": {
      "basset-prod-01": {"enabled": true, "version": "v11.3.0", "weight": 1},
      "basset-prod-02": {"enabled": true, "version": "v11.3.0", "weight": 1},
      "basset-prod-03": {"enabled": true, "version": "v11.3.0", "weight": 1},
      "basset-prod-04": {"enabled": true, "version": "v11.3.0", "weight": 1},
      "basset-prod-05": {"enabled": true, "version": "v11.3.0", "weight": 1},
      "basset-prod-06": {"enabled": true, "version": "v11.3.0", "weight": 1},
      "basset-prod-07": {"enabled": true, "version": "v11.3.0", "weight": 1},
      "basset-prod-08": {"enabled": true, "version": "v11.3.0", "weight": 1},
      "basset-prod-09": {"enabled": true, "version": "v11.3.0", "weight": 1},
      "basset-prod-10": {"enabled": true, "version": "v11.3.0", "weight": 1}
    }
  }'

echo "✓ Traffic restored to load balancer"
```

---

## POST-ROLLBACK PROCEDURES

### Data Consistency Verification (5 minutes)

**Technical Lead Actions:**

1. **Session Data Integrity**

```bash
# Verify session data is readable
docker exec basset-hound-browser curl -s http://localhost:8765/stats | jq '.' > /dev/null
if [ $? -eq 0 ]; then
  echo "✓ Session data accessible"
else
  echo "✗ Session data corrupted - CRITICAL"
fi
```

2. **Database State Check**

```bash
# Check database consistency
docker exec basset-hound-browser redis-cli PING
# Should return PONG

# Check for corrupted entries
docker exec basset-hound-browser redis-cli --scan | wc -l
echo "Sessions stored: $(docker exec basset-hound-browser redis-cli --scan | wc -l)"
```

3. **User Data Validation**

```bash
# Sample check of user profiles
docker exec basset-hound-browser redis-cli KEYS "profile:*" | head -5
echo "Profile entries: $(docker exec basset-hound-browser redis-cli KEYS "profile:*" | wc -l)"
```

### Health Check After Rollback (5 minutes)

**Checklist:**

- [ ] **Basic Connectivity**
  ```bash
  curl -s http://basset-prod-01:8765 | head -5
  ```

- [ ] **Core Commands Working**
  ```bash
  # Test navigate command
  node -e "
    const WebSocket = require('ws');
    const ws = new WebSocket('ws://basset-prod-01:8765');
    ws.on('open', () => {
      ws.send(JSON.stringify({cmd: 'navigate', url: 'https://example.com'}));
      ws.on('message', (msg) => {
        console.log('Navigate response received');
        ws.close();
      });
    });
  "
  ```

- [ ] **Error Logs Clean**
  ```bash
  docker logs basset-hound-browser 2>&1 | grep -i error | wc -l
  # Should be < 5 errors
  ```

- [ ] **Metrics Baseline**
  ```bash
  curl -s http://metrics:9090/api/v1/query?query=basset_latency_p95 | jq '.data.result[] | {instance: .metric.instance, latency: .value[1]}'
  ```

### Incident Communication (1 minute)

**Communication Lead Actions:**

```bash
cat > /tmp/rollback-incident.txt << 'EOF'
[INCIDENT RESOLVED] v12.0.0 Rollback Complete

Incident:
- Version: v12.0.0 deployment
- Issue: [Root cause - TBD]
- Action: Rollback to v11.3.0
- Status: SUCCESS - Production stable

Timeline:
- Issue Detected: [HH:MM UTC]
- Rollback Started: [HH:MM UTC]
- Rollback Complete: [HH:MM UTC]
- All systems healthy: [HH:MM UTC]
- Duration: [X] minutes

Next Steps:
1. Post-incident review
2. Root cause analysis
3. Fix development and testing
4. Retry with enhanced monitoring

Customers: No extended outage - recovered within SLA
Support: Please see status page for details
EOF

# Send notification
cat /tmp/rollback-incident.txt
# Send to Slack: #incidents #deployments
```

---

## Health Check Procedure

**Run this after any rollback to confirm stability:**

```bash
#!/bin/bash
# Comprehensive health check after rollback

echo "=== POST-ROLLBACK HEALTH CHECK ==="
echo "Timestamp: $(date)"
echo ""

# 1. Container status
echo "1. Container Status:"
docker ps | grep basset-hound-browser

# 2. Version check
echo ""
echo "2. Version Check:"
docker inspect basset-hound-browser | jq -r '.[0].Config.Image'

# 3. WebSocket connectivity
echo ""
echo "3. WebSocket Connectivity:"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8765)
echo "HTTP Status: $HEALTH"

# 4. Basic command test
echo ""
echo "4. Command Response Test:"
timeout 5 node -e "
  const WebSocket = require('ws');
  const ws = new WebSocket('ws://localhost:8765');
  ws.on('open', () => {
    ws.send(JSON.stringify({cmd: 'getStatus'}));
    ws.on('message', (msg) => {
      console.log('Command Response: OK');
      ws.close();
      process.exit(0);
    });
    setTimeout(() => { ws.close(); process.exit(1); }, 3000);
  });
" || echo "Command Response: TIMEOUT"

# 5. Error logs
echo ""
echo "5. Recent Error Count:"
ERROR_COUNT=$(docker logs --tail=100 basset-hound-browser 2>&1 | grep -ic error)
echo "Errors in last 100 log lines: $ERROR_COUNT"

# 6. Resource usage
echo ""
echo "6. Resource Usage:"
docker stats --no-stream basset-hound-browser | tail -1 | awk '{print "CPU: " $3 ", Memory: " $4}'

echo ""
echo "=== HEALTH CHECK COMPLETE ==="
```

---

## Rollback Verification Checklist

After executing rollback, verify:

| Check | Status | Evidence |
|-------|--------|----------|
| Container running | [ ] | `docker ps` output |
| v11.3.0 confirmed | [ ] | `docker inspect` image name |
| WebSocket responding | [ ] | HTTP 426 status |
| Core command working | [ ] | Command response received |
| Error rate acceptable | [ ] | < 10 errors in logs |
| Memory stable | [ ] | No growth pattern |
| Session data readable | [ ] | Database query successful |
| Load balancer restored | [ ] | Traffic flowing |
| Team notified | [ ] | Incident message sent |

---

## Rollback Documentation

Save these files for post-incident review:

```bash
# Archive rollback artifacts
mkdir -p /backups/rollback-artifacts-$(date +%Y%m%d-%H%M%S)

# v12.0.0 logs
docker logs basset-hound-browser > /backups/rollback-artifacts-$(date +%Y%m%d-%H%M%S)/v12.0.0-logs.txt 2>&1

# v11.3.0 logs (after rollback)
sleep 30
docker logs basset-hound-browser > /backups/rollback-artifacts-$(date +%Y%m%d-%H%M%S)/v11.3.0-logs.txt 2>&1

# Current metrics
curl -s http://metrics:9090/api/v1/query?query=basset_error_rate > /backups/rollback-artifacts-$(date +%Y%m%d-%H%M%S)/metrics.json

echo "✓ Rollback artifacts saved"
```

---

## Quick Reference Card

**For Operations Team:**

```
ROLLBACK QUICK REFERENCE - v12.0.0 to v11.3.0

Step 1: Remove from LB (30 sec)
  curl -X PATCH http://load-balancer:8080/backend/disable-all

Step 2: Stop v12.0.0 (1 min)
  docker stop basset-hound-browser --time=30

Step 3: Start v11.3.0 (1 min)
  docker run -d --name basset-hound-browser \
    --network basset-hound-browser -p 8765:8765 \
    basset-hound-browser:v11.3.0

Step 4: Verify (1 min)
  curl -s -o /dev/null -w "%{http_code}" http://localhost:8765
  # Should return 426

Step 5: Restore LB (1 min)
  curl -X PATCH http://load-balancer:8080/backend/restore-all

Total Time: < 5 minutes
```

---

## Approval & Sign-off

| Role | Authorized | Date | Signature |
|------|-----------|------|-----------|
| SRE Lead | Yes | | |
| Engineering Manager | Yes | | |
| CTO (if critical) | Yes | | |

---

**End of Rollback Runbook**
