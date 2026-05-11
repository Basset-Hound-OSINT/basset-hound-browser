# Canary Deployment Runbook - v12.0.0

**Document Version:** 1.0  
**Date:** May 11, 2026  
**Target Release:** Basset Hound Browser v12.0.0  
**From Version:** v11.3.0  

---

## Overview

This runbook provides a step-by-step procedure for deploying v12.0.0 to a single canary instance to identify issues before broader rollout. The canary deployment is meant to validate the deployment process, basic functionality, and core metrics in a production-like environment with minimal user impact.

**Duration:** 45 minutes (with 4-hour monitoring window)  
**Risk Level:** LOW (isolated instance, can be rolled back quickly)  
**Go/No-Go Decision Point:** After 4-hour monitoring window

---

## Roles & Responsibilities

| Role | Responsibility |
|------|-----------------|
| **Deployment Lead** | Orchestrates the deployment, makes go/no-go decisions |
| **Technical Lead** | Monitors metrics, investigates anomalies |
| **Backup Operator** | Assists with commands, monitors logs in parallel |
| **Communication Lead** | Updates stakeholders on progress |

---

## PRE-DEPLOYMENT CHECKLIST (30 minutes before)

### 1. Environment Verification

**Checklist:** (Completed by Deployment Lead)

- [ ] **Source Code Ready**
  ```bash
  git branch -v | grep main
  git log -1 --oneline
  # Should show v12.0.0 tag or commit message mentioning v12.0.0
  ```

- [ ] **Backup v11.3.0 Instance**
  ```bash
  # Tag the running v11.3.0 instance
  docker ps | grep basset-hound-browser
  docker tag basset-hound-browser:v11.3.0 basset-hound-browser:v11.3.0-backup-$(date +%s)
  ```

- [ ] **Verify Canary Infrastructure**
  ```bash
  # Canary server connectivity
  ssh basset-canary-prod "hostname && uptime"
  
  # Disk space (need 5GB minimum)
  ssh basset-canary-prod "df -h /app"
  
  # Docker daemon running
  ssh basset-canary-prod "docker ps -q | wc -l"
  
  # Network connectivity
  ssh basset-canary-prod "curl -s https://api.github.com | head -1"
  ```

- [ ] **Database/State Service Availability**
  ```bash
  # Check session store connectivity
  curl -s http://localhost:6379/ping 2>/dev/null || echo "Redis check required"
  
  # Check config service
  curl -s http://localhost:8080/health 2>/dev/null || echo "Config service check required"
  ```

### 2. v12.0.0 Build Validation

**Checklist:** (Completed by Technical Lead)

- [ ] **Docker Image Built Successfully**
  ```bash
  # Verify image exists locally
  docker images | grep "basset-hound-browser" | grep "v12.0.0"
  
  # Size should be reasonable (typically 800MB-1.2GB)
  docker images --format "table {{.Repository}}\t{{.Size}}" | grep basset
  ```

- [ ] **Build Artifacts Exist**
  ```bash
  # Check for required assets
  ls -lh dist/Basset*v12.0.0* 2>/dev/null || echo "Checking for v12.0.0 builds"
  ```

- [ ] **Critical Dependencies Installed**
  ```bash
  # Run pre-deployment validation
  npm run test:ci 2>&1 | tail -20
  # Should show 0 failures
  ```

- [ ] **Documentation Current**
  ```bash
  # Verify changelog updated for v12.0.0
  grep -l "12.0.0" docs/*.md | head -3
  ```

### 3. Monitoring & Alerting Setup

**Checklist:** (Completed by Technical Lead + Backup Operator)

- [ ] **Monitoring Dashboard Prepared**
  ```bash
  # Verify monitoring targets are ready
  curl -s http://prometheus:9090/api/v1/targets | grep basset-canary
  ```

- [ ] **Alert Rules Configured**
  ```bash
  # Check alert rules for v12.0.0 release
  curl -s http://alertmanager:9093/api/v1/alerts | grep canary
  ```

- [ ] **Log Aggregation Ready**
  ```bash
  # Verify ELK/Splunk is ready to ingest logs
  curl -s http://elasticsearch:9200/_cluster/health | grep green
  ```

- [ ] **Baseline Metrics Captured (v11.3.0)**
  ```bash
  # Record current metrics for comparison
  echo "=== v11.3.0 Baseline ===" > /tmp/baseline-v11.3.0.txt
  curl -s http://localhost:8765/metrics 2>/dev/null >> /tmp/baseline-v11.3.0.txt || echo "Metrics endpoint not available"
  ```

### 4. Rollback Readiness

**Checklist:** (Completed by Deployment Lead)

- [ ] **v11.3.0 Docker Image Tagged for Rollback**
  ```bash
  docker tag basset-hound-browser:v11.3.0 basset-hound-browser:pre-canary
  ```

- [ ] **Database Snapshot Created** (if applicable)
  ```bash
  # Backup session state
  docker exec basset-hound-browser redis-cli BGSAVE
  docker cp basset-hound-browser:/var/lib/redis/dump.rdb /backups/redis-pre-v12.0.0.rdb
  ```

- [ ] **Rollback Procedure Tested** (on staging, not production)
  ```bash
  # Quick validation of rollback script
  cat scripts/rollback.sh | grep -A 5 "docker rm"
  ```

- [ ] **Rollback Communication Template Ready**
  ```bash
  cat > /tmp/rollback-alert-template.txt << 'EOF'
  [INCIDENT] Canary deployment rollback initiated for v12.0.0
  Reason: [TBD]
  Rollback Target: v11.3.0
  ETA to stable: 5 minutes
  Status: [In Progress]
  EOF
  ```

### 5. Team Readiness

**Checklist:** (Completed by Deployment Lead)

- [ ] **All Team Members Online**
  - [ ] Deployment Lead - Present
  - [ ] Technical Lead - Present
  - [ ] Backup Operator - Present
  - [ ] Communication Lead - Standby

- [ ] **Communication Channels Open**
  - [ ] Slack #deployments channel active
  - [ ] War room created (if applicable)
  - [ ] Escalation contacts confirmed

- [ ] **On-Call Schedule Verified**
  - [ ] Primary on-call assigned
  - [ ] Backup on-call assigned
  - [ ] On-call contacts posted in deployment channel

---

## CANARY DEPLOYMENT PROCEDURE (10 minutes)

### Phase 1: Pre-Deployment (2 minutes)

**Deployment Lead Actions:**

1. **Announce deployment start**
   ```bash
   # Send message to deployment channel
   echo "Starting v12.0.0 canary deployment to basset-canary-prod"
   echo "Deployment window: $(date) to $(date -d '+4 hours')"
   ```

2. **Record baseline metrics**
   ```bash
   BASELINE_TIME=$(date +%s)
   echo "Baseline timestamp: $BASELINE_TIME" > /tmp/deployment-log.txt
   ```

3. **Verify no ongoing requests**
   ```bash
   # Check active connections
   docker exec basset-hound-browser curl -s http://localhost:8765/stats | jq '.activeConnections'
   # Should be low or 0
   ```

### Phase 2: Image Push to Canary (3 minutes)

**Deployment Lead Actions:**

1. **Push Docker image to canary registry**
   ```bash
   # Tag image for canary registry
   docker tag basset-hound-browser:v12.0.0 registry.basset-prod.local/basset-hound-browser:v12.0.0-canary
   
   # Push to canary registry (not production registry yet)
   docker push registry.basset-prod.local/basset-hound-browser:v12.0.0-canary
   
   # Verify push successful
   curl -s registry.basset-prod.local/v2/basset-hound-browser/tags/list | grep v12.0.0-canary
   ```

2. **SSH to canary host**
   ```bash
   ssh basset-canary-prod
   cd /app/basset-hound-browser
   ```

### Phase 3: Stop v11.3.0 Instance (2 minutes)

**On Canary Host:**

1. **Graceful shutdown**
   ```bash
   # Send SIGTERM to container for graceful shutdown (timeout: 30 seconds)
   docker stop basset-hound-browser-prod --time=30
   
   # Verify stopped
   sleep 5
   docker ps | grep basset-hound-browser && echo "ERROR: Container still running" || echo "Container stopped successfully"
   ```

2. **Backup container data**
   ```bash
   # Copy session data before removal
   docker cp basset-hound-browser-prod:/app/data /backups/data-v11.3.0-$(date +%s)
   
   # Remove old container
   docker rm basset-hound-browser-prod
   ```

### Phase 4: Start v12.0.0 Canary (3 minutes)

**On Canary Host:**

1. **Pull and verify image**
   ```bash
   docker pull registry.basset-prod.local/basset-hound-browser:v12.0.0-canary
   
   # Verify image integrity
   docker inspect registry.basset-prod.local/basset-hound-browser:v12.0.0-canary | jq '.[] | {Size, Created}'
   ```

2. **Start v12.0.0 container**
   ```bash
   docker run -d \
     --name basset-hound-browser-prod \
     --network basset-hound-browser \
     -p 8765:8765 \
     -e DISPLAY=:99 \
     -e ELECTRON_DISABLE_SANDBOX=1 \
     --cap-drop ALL \
     --cap-add SYS_ADMIN \
     --restart unless-stopped \
     -v basset-data:/app/data \
     registry.basset-prod.local/basset-hound-browser:v12.0.0-canary
   
   # Record container ID
   CONTAINER_ID=$(docker ps -q -f name=basset-hound-browser-prod)
   echo "Container ID: $CONTAINER_ID" >> /tmp/deployment-log.txt
   ```

3. **Wait for startup**
   ```bash
   # Allow 30 seconds for startup
   sleep 30
   
   # Check container is running
   docker ps | grep basset-hound-browser-prod
   ```

### Phase 5: Health Check (2 minutes)

**Technical Lead Actions (from deployment host):**

1. **WebSocket connectivity**
   ```bash
   # Basic connectivity test (should return 426 Upgrade Required)
   HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://basset-canary-prod:8765)
   echo "Health check: $HEALTH"
   
   if [ "$HEALTH" == "426" ]; then
     echo "✓ WebSocket server responding"
   else
     echo "✗ WebSocket server not responding (HTTP $HEALTH)"
     exit 1
   fi
   ```

2. **Core functionality test**
   ```bash
   # Quick WebSocket command test
   timeout 10 node -e "
     const WebSocket = require('ws');
     const ws = new WebSocket('ws://basset-canary-prod:8765');
     ws.on('open', () => {
       ws.send(JSON.stringify({ cmd: 'getStatus' }));
       ws.on('message', (msg) => {
         console.log('Status response:', msg);
         ws.close();
         process.exit(0);
       });
       setTimeout(() => { ws.close(); process.exit(1); }, 5000);
     });
   " 2>&1 | head -20
   ```

3. **Container logs check**
   ```bash
   # Check for errors in startup logs
   docker logs --tail=50 basset-hound-browser-prod | grep -i error || echo "No errors in logs"
   ```

---

## MONITORING CHECKLIST (4-hour window)

### Frequency & Metrics

**Every 15 minutes (First hour):**

- [ ] Container is running: `docker ps | grep basset-hound-browser-prod`
- [ ] No error restarts: `docker ps -a | grep -c basset-hound-browser-prod` (should be 1)
- [ ] CPU usage reasonable: `docker stats basset-hound-browser-prod --no-stream | grep CPU`
- [ ] Memory usage stable: `docker stats basset-hound-browser-prod --no-stream | grep MEM`

**Every 30 minutes (Remaining 3 hours):**

- [ ] WebSocket connectivity: `curl -s -o /dev/null -w "%{http_code}" http://basset-canary-prod:8765`
- [ ] Response time: `time curl -s http://basset-canary-prod:8765 | head -1`
- [ ] Error rates: `docker logs basset-hound-browser-prod 2>&1 | grep -ic error`
- [ ] Transaction count: `docker exec basset-hound-browser-prod curl -s http://localhost:8765/stats | jq '.totalTransactions'`

### Critical Metrics Baseline

Record these baseline values from v11.3.0 for comparison:

| Metric | v11.3.0 Baseline | v12.0.0 Target | Status |
|--------|------------------|-----------------|--------|
| Startup Time | _____ sec | < _____ sec | [ ] |
| Memory (steady-state) | _____ MB | < _____ MB | [ ] |
| CPU (idle) | _____ % | < _____ % | [ ] |
| WebSocket latency (p95) | _____ ms | < _____ ms | [ ] |
| Error rate | < _____ % | < _____ % | [ ] |
| Command success rate | > _____ % | > _____ % | [ ] |

### Monitoring Log Template

```bash
# Create monitoring log file
cat > /tmp/canary-monitoring.log << 'EOF'
=== Canary Deployment Monitoring Log - v12.0.0 ===
Deployment Started: [TIME]
Expected Monitoring Until: [TIME + 4 hours]
Canary Host: basset-canary-prod
Container: basset-hound-browser-prod

--- Monitoring Entries ---
[HH:MM] Status Check: [PASS/FAIL] - Details
EOF
```

### Alert Triggers (Automatic Rollback Criteria)

If ANY of these occur, proceed immediately to rollback:

- **Container Crash:** Container restarts more than 2 times in an hour
  ```bash
  docker ps -a -f name=basset-hound-browser-prod --format "{{.Status}}"
  ```

- **Memory Leak:** Memory usage increases >30% over baseline
  ```bash
  docker stats basset-hound-browser-prod --no-stream | awk '{print $7}'
  ```

- **High Error Rate:** Error logs exceed 10 errors per minute
  ```bash
  docker logs basset-hound-browser-prod 2>&1 | tail -60 | grep -c ERROR
  ```

- **WebSocket Down:** HTTP health check fails 3 times consecutively
  ```bash
  curl -s -o /dev/null -w "%{http_code}" http://basset-canary-prod:8765
  # Should be 426, not 000 or 500
  ```

- **High Latency:** Response times exceed 5 seconds (p95)
  ```bash
  # Test WebSocket response time
  time docker exec basset-hound-browser-prod curl -s http://localhost:8765/stats | head -1
  ```

---

## GO/NO-GO DECISION CRITERIA

### GO Criteria (All must pass)

- [ ] **Stability:** Container running without restarts for 4 hours
- [ ] **Health:** Health checks pass 100% (24/24 checks in 4 hours)
- [ ] **Performance:** Metrics within 10% of v11.3.0 baseline
- [ ] **Functionality:** Core commands responding successfully
- [ ] **Logs:** No CRITICAL or ERROR level logs indicating issues
- [ ] **Team Sign-off:** Technical Lead approves continuation

### NO-GO Criteria (Any one triggers rollback)

- [ ] **Stability:** Container has restarted more than 2 times
- [ ] **Health:** Health check failures > 5% of samples
- [ ] **Performance:** Metrics degraded >20% from baseline
- [ ] **Functionality:** Core commands failing or timing out
- [ ] **Logs:** Critical or unrecoverable errors detected
- [ ] **Team Concern:** Technical Lead recommends rollback

### Decision Log

```bash
# After 4-hour monitoring window
cat > /tmp/canary-decision.txt << 'EOF'
=== CANARY DEPLOYMENT DECISION LOG ===
Decision Time: [NOW]
Deployment Lead: [NAME]
Technical Lead: [NAME]

GO Criteria Results:
- [ ] Stability (4h runtime, < 2 restarts): [PASS/FAIL]
- [ ] Health (100% checks): [PASS/FAIL]
- [ ] Performance (+/- 10% baseline): [PASS/FAIL]
- [ ] Functionality (core commands): [PASS/FAIL]
- [ ] Logs (no criticals): [PASS/FAIL]
- [ ] Team sign-off: [PASS/FAIL]

DECISION: [GO TO PROGRESSIVE ROLLOUT / NO-GO ROLLBACK]

Reasoning:
[Detailed explanation of decision]

Approved By:
- Deployment Lead: ________________
- Technical Lead: ________________
EOF
```

---

## ROLLBACK PROCEDURE (If NO-GO)

### Quick Rollback to v11.3.0 (5 minutes)

**On Canary Host:**

1. **Stop v12.0.0 container**
   ```bash
   docker stop basset-hound-browser-prod --time=10
   docker rm basset-hound-browser-prod
   ```

2. **Start v11.3.0 container**
   ```bash
   docker run -d \
     --name basset-hound-browser-prod \
     --network basset-hound-browser \
     -p 8765:8765 \
     -e DISPLAY=:99 \
     -e ELECTRON_DISABLE_SANDBOX=1 \
     --cap-drop ALL \
     --cap-add SYS_ADMIN \
     --restart unless-stopped \
     -v basset-data:/app/data \
     basset-hound-browser:pre-canary
   
   sleep 30
   ```

3. **Verify rollback successful**
   ```bash
   # Health check
   HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://basset-canary-prod:8765)
   echo "Rolled back. Health: $HEALTH"
   
   if [ "$HEALTH" == "426" ]; then
     echo "✓ Rollback successful - v11.3.0 running"
   else
     echo "✗ Rollback verification failed"
     exit 1
   fi
   ```

4. **Data consistency check**
   ```bash
   # Verify session data integrity
   docker exec basset-hound-browser-prod curl -s http://localhost:8765/stats | jq '.dataSessions' || echo "Sessions check"
   ```

**Communication:**

```bash
# Send incident notification
echo "[INCIDENT RESOLVED] Canary deployment rolled back
Version: v12.0.0
Target: v11.3.0 (restored)
Reason: [TBD]
Status: Production stable
Next Steps: Root cause analysis"
```

---

## Approval & Sign-off

| Role | Name | Time | Signature |
|------|------|------|-----------|
| Deployment Lead | | | |
| Technical Lead | | | |
| Engineering Manager | | | |

---

## Appendix: Troubleshooting

### Issue: Container won't start

```bash
# Check logs
docker logs basset-hound-browser-prod

# Common causes:
# 1. Port already in use
netstat -tlnp | grep 8765

# 2. Image pull failed
docker pull registry.basset-prod.local/basset-hound-browser:v12.0.0-canary

# 3. Insufficient resources
docker stats basset-hound-browser-prod
```

### Issue: WebSocket not responding

```bash
# Verify port forwarding
ssh basset-canary-prod "netstat -tlnp | grep 8765"

# Check container networking
docker network inspect basset-hound-browser | grep basset-hound-browser-prod

# Test local connectivity
docker exec basset-hound-browser-prod curl -s http://localhost:8765
```

### Issue: High memory usage

```bash
# Check memory trend
docker stats basset-hound-browser-prod

# Inspect top processes inside container
docker top basset-hound-browser-prod

# Memory leak investigation
docker exec basset-hound-browser-prod npm ls 2>&1 | grep -i dependency
```

---

**End of Canary Deployment Runbook**
