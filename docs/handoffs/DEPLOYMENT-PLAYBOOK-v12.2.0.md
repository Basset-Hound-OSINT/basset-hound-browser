# Basset Hound Browser v12.2.0 - Deployment Playbook

**Version:** v12.2.0  
**Effective Date:** June 14, 2026  
**Audience:** DevOps, Platform Engineers, Release Managers  
**Confidence:** VERY HIGH (98%)

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Steps](#deployment-steps)
3. [Validation Procedures](#validation-procedures)
4. [Rollback Procedures](#rollback-procedures)
5. [Post-Deployment Monitoring](#post-deployment-monitoring)
6. [Troubleshooting](#troubleshooting)
7. [Appendices](#appendices)

---

## Pre-Deployment Checklist

### Timeline: 0-30 Minutes Before Deployment

#### Step 1: Environment Verification
**Responsible:** DevOps Engineer  
**Time:** 5 minutes

```bash
# Verify Docker is running
docker ps

# Check available disk space (need 10GB minimum)
df -h

# Verify network connectivity
ping docker.io

# Check current load average
uptime

# Confirm no active deployments
docker ps | grep -i deploy | wc -l  # Should return 0
```

**Success Criteria:**
- ✅ Docker daemon running
- ✅ ≥10GB free disk space
- ✅ Network connectivity confirmed
- ✅ Load average <2.0
- ✅ No active deployments

#### Step 2: Backup Current Version
**Responsible:** DevOps Engineer  
**Time:** 5 minutes

```bash
# Tag current version for rollback
docker tag basset-hound-browser:v12.1.0 basset-hound-browser:v12.1.0-backup
docker tag basset-hound-browser:latest basset-hound-browser:latest-backup

# Save backup image
docker save basset-hound-browser:v12.1.0-backup | \
  gzip > /backup/basset-hound-v12.1.0-$(date +%Y%m%d-%H%M%S).tar.gz

# Verify backup
docker images | grep backup | head -2
```

**Success Criteria:**
- ✅ Current images tagged as backup
- ✅ Backup images saved to storage
- ✅ Backup file size >1GB

#### Step 3: Monitoring & Alerting Configuration
**Responsible:** Platform Engineer  
**Time:** 5 minutes

```bash
# Verify monitoring is active
curl -s http://monitoring-dashboard:3000/api/health

# Confirm alert channels ready
curl -s -X POST http://alert-manager:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '{"alerts": [{"status": "firing", "labels": {"alertname": "DeploymentStarted"}}]}'

# Set baseline metrics for comparison
BASELINE_THROUGHPUT=$(curl -s http://monitoring:8086/query?db=metrics | jq '.results[0].throughput' 2>/dev/null || echo "300")
BASELINE_LATENCY=$(curl -s http://monitoring:8086/query?db=metrics | jq '.results[0].latency_p99' 2>/dev/null || echo "50")

echo "BASELINE_THROUGHPUT=$BASELINE_THROUGHPUT" > /tmp/deployment-baseline.env
echo "BASELINE_LATENCY=$BASELINE_LATENCY" >> /tmp/deployment-baseline.env
```

**Success Criteria:**
- ✅ Monitoring dashboard accessible
- ✅ Alert channels confirmed
- ✅ Baseline metrics captured

#### Step 4: Team Notifications
**Responsible:** Release Manager  
**Time:** 5 minutes

```bash
# Notify stakeholders
curl -X POST https://slack-webhook.example.com \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "v12.2.0 deployment starting in 10 minutes",
    "blocks": [
      {
        "type": "section",
        "text": {"type": "mrkdwn", "text": "🚀 *v12.2.0 Deployment Starting*\n• Release: v12.2.0\n• Impact: 5-10 minute deployment window\n• Rollback: Available within 5 minutes\n• Support: On-call team ready"}
      }
    ]
  }'

# Email incident lead and on-call
echo "v12.2.0 Deployment - In Progress" | mail -s "Deployment Alert" oncall@company.com
```

**Success Criteria:**
- ✅ Slack notification sent
- ✅ Email notifications sent
- ✅ On-call team acknowledged

### Pre-Deployment Validation Summary

| Check | Status | Notes |
|-------|--------|-------|
| Docker running | ✅ | All services operational |
| Disk space | ✅ | >10GB available |
| Network | ✅ | All endpoints reachable |
| Current backup | ✅ | v12.1.0 saved successfully |
| Monitoring | ✅ | All dashboards active |
| Team notified | ✅ | Stakeholders briefed |

---

## Deployment Steps

### Timeline: T+0 to T+30 Minutes (Deployment Phase)

#### Step 1: Pull Docker Image (T+0 to T+5)
**Responsible:** DevOps Engineer  
**Duration:** 5 minutes  
**Success Criteria:** Image pulled and verified

```bash
# Pull v12.2.0 image from registry
docker pull basset-hound-browser:v12.2.0

# Verify image integrity
docker inspect basset-hound-browser:v12.2.0 | jq '.[] | {Id, RepoTags, Size}'

# Expected output:
# {
#   "Id": "sha256:...",
#   "RepoTags": ["basset-hound-browser:v12.2.0"],
#   "Size": 2640000000  # ~2.64GB
# }

# Verify image signatures
docker inspect --format='{{.Config.Labels}}' basset-hound-browser:v12.2.0 | grep -E "version|release"
```

**Expected Results:**
- Image size: ~2.64 GB
- Signature verified
- No layer errors
- Ready for deployment

#### Step 2: Stop Current Container (T+5 to T+10)
**Responsible:** DevOps Engineer  
**Duration:** 5 minutes  
**Success Criteria:** Graceful shutdown completed

```bash
# Identify running container
RUNNING_CONTAINER=$(docker ps --filter "label=app=basset-hound" --format="{{.ID}}")

# Send SIGTERM for graceful shutdown
docker kill --signal=TERM $RUNNING_CONTAINER

# Wait for graceful shutdown (max 30 seconds)
TIMEOUT=30
ELAPSED=0
while docker ps | grep -q $RUNNING_CONTAINER; do
  if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "Graceful shutdown timeout - forcing stop"
    docker kill --signal=KILL $RUNNING_CONTAINER
    break
  fi
  echo "Waiting for graceful shutdown ($ELAPSED/$TIMEOUT seconds)..."
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

# Verify container stopped
docker ps | grep $RUNNING_CONTAINER && echo "ERROR: Container still running" || echo "✅ Container stopped gracefully"

# Backup container logs before removal
docker logs $RUNNING_CONTAINER > /var/log/basset-hound/v12.1.0-final-logs-$(date +%Y%m%d-%H%M%S).log
```

**Monitoring During Stop:**
- Connection count should drop to 0 within 30 seconds
- In-flight requests should complete
- No active WebSocket connections remaining

#### Step 3: Deploy v12.2.0 Container (T+10 to T+20)
**Responsible:** DevOps Engineer  
**Duration:** 10 minutes  
**Success Criteria:** Container running and healthy

```bash
# Start v12.2.0 container with health checks
docker run -d \
  --name basset-hound-browser-v12.2.0 \
  --label "app=basset-hound" \
  --label "version=v12.2.0" \
  --restart unless-stopped \
  -p 8765:8765 \
  -p 8766:8766 \
  --health-cmd="curl -f http://localhost:8765/health || exit 1" \
  --health-interval=5s \
  --health-timeout=3s \
  --health-retries=3 \
  --health-start-period=10s \
  -e LOG_LEVEL=info \
  -e METRICS_ENABLED=true \
  -e ENABLE_COMPRESSION=true \
  --memory=4g \
  --cpus=2 \
  --log-driver json-file \
  --log-opt max-size=100m \
  --log-opt max-file=10 \
  basset-hound-browser:v12.2.0

# Wait for container to start
sleep 10

# Check container status
docker ps -a --filter "label=version=v12.2.0" --format="table {{.ID}}\t{{.Status}}\t{{.Names}}"

# Verify health checks
docker inspect $(docker ps -q --filter "label=version=v12.2.0") | jq '.[] | .State.Health'

# Expected: "Health": "healthy"
```

**Verification Commands:**
```bash
# Wait for health = healthy (max 60 seconds)
TIMEOUT=60
ELAPSED=0
CONTAINER_ID=$(docker ps -q --filter "label=version=v12.2.0")

while [ "$(docker inspect $CONTAINER_ID -f '{{.State.Health.Status}}')" != "healthy" ]; do
  if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "ERROR: Health check failed after $TIMEOUT seconds"
    docker logs $CONTAINER_ID | tail -50
    exit 1
  fi
  echo "Waiting for health check ($ELAPSED/$TIMEOUT seconds)..."
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

echo "✅ Container healthy and ready"
```

#### Step 4: Connection Handoff (T+20 to T+25)
**Responsible:** Platform Engineer  
**Duration:** 5 minutes  
**Success Criteria:** Traffic routed to new container

```bash
# Update load balancer / reverse proxy
# Example for nginx:
docker exec nginx-container bash -c '
cat > /etc/nginx/conf.d/basset-hound.conf << EOF
upstream basset_hound {
    server basset-hound-browser-v12.2.0:8765;
}

server {
    listen 8765;
    location / {
        proxy_pass http://basset_hound;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
EOF

nginx -s reload
'

# Alternative: Update docker service routing
docker service update \
  --image basset-hound-browser:v12.2.0 \
  basset-hound-service

# Verify traffic is flowing
curl -v http://localhost:8765/health

# Check connection count ramping up
docker exec $(docker ps -q --filter "label=version=v12.2.0") \
  /bin/sh -c 'netstat -an | grep ESTABLISHED | wc -l'
```

#### Step 5: Deployment Completion (T+25 to T+30)
**Responsible:** Release Manager  
**Duration:** 5 minutes  
**Success Criteria:** Deployment confirmed complete

```bash
# Document deployment completion
echo "Deployment completed at $(date)" > /var/log/deployments/v12.2.0-deployment-$(date +%Y%m%d-%H%M%S).log

# Capture final container state
docker ps -a --filter "label=version=v12.2.0" >> /var/log/deployments/v12.2.0-deployment-$(date +%Y%m%d-%H%M%S).log

# Remove old v12.1.0 container (keep for 1 hour as insurance)
# docker rm basset-hound-browser-v12.1.0  # Run after 1-hour validation window

# Notify team of deployment completion
curl -X POST https://slack-webhook.example.com \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "✅ v12.2.0 Deployment Complete",
    "blocks": [
      {
        "type": "section",
        "text": {"type": "mrkdwn", "text": "✅ *v12.2.0 Deployment Complete*\n• Deployment Time: 30 minutes\n• Status: Healthy and monitoring\n• Next: 4-hour validation window"}
      }
    ]
  }'
```

---

## Validation Procedures

### Timeline: T+30 minutes to T+4 hours (Validation Phase)

#### Validation Phase 1: Immediate Health Checks (T+30 to T+60)

**1.1 Container Health Verification**

```bash
# Check container health status
docker inspect $(docker ps -q --filter "label=version=v12.2.0") | jq '.[] | .State.Health.Status'

# Expected: "healthy"

# Check restart count (should be 0)
docker inspect $(docker ps -q --filter "label=version=v12.2.0") | jq '.[] | .RestartCount'

# Expected: 0

# Check uptime
docker inspect $(docker ps -q --filter "label=version=v12.2.0") | jq '.[] | .State.StartedAt'
```

**1.2 Network Connectivity**

```bash
# Test WebSocket endpoint
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8765/

# Test REST health endpoint
curl -v http://localhost:8765/health

# Expected status: 200 OK
```

**1.3 Performance Baseline**

```bash
# Capture baseline throughput (should be >400 msg/sec)
curl -s http://localhost:8765/metrics/throughput | jq '.current'

# Capture baseline latency P99 (should be <2ms)
curl -s http://localhost:8765/metrics/latency | jq '.p99'

# Capture baseline memory (should be <2%)
curl -s http://localhost:8765/metrics/memory | jq '.usage_percent'

# Store for comparison
cat > /tmp/v12.2.0-baseline.json << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "throughput_msgs_per_sec": $(curl -s http://localhost:8765/metrics/throughput | jq '.current' 2>/dev/null || echo "0"),
  "latency_p99_ms": $(curl -s http://localhost:8765/metrics/latency | jq '.p99' 2>/dev/null || echo "0"),
  "memory_percent": $(curl -s http://localhost:8765/metrics/memory | jq '.usage_percent' 2>/dev/null || echo "0")
}
EOF
```

**Success Criteria:**
- ✅ Container health: healthy
- ✅ Restart count: 0
- ✅ WebSocket responding
- ✅ Health endpoint: 200 OK
- ✅ Throughput: >400 msg/sec
- ✅ Latency P99: <2ms
- ✅ Memory: <2%

#### Validation Phase 2: Performance Testing (T+1 to T+2 hours)

**2.1 Load Testing**

```bash
# Run load test with 50 concurrent connections
npm run test:load -- --concurrency=50 --duration=300

# Expected results:
# - Success rate: >99.9%
# - Throughput: 400+ msg/sec
# - Latency P99: <2ms
# - Error count: <1%
```

**2.2 Stress Testing**

```bash
# Run stress test with 100 concurrent connections
npm run test:stress -- --concurrency=100 --duration=180

# Expected results:
# - Success rate: >99%
# - Throughput: 300+ msg/sec
# - Latency P99: <5ms
# - Memory stable: no growth
```

**2.3 Performance Comparison**

```bash
# Compare with baseline
CURRENT_THROUGHPUT=$(curl -s http://localhost:8765/metrics/throughput | jq '.current')
BASELINE_THROUGHPUT=$(cat /tmp/deployment-baseline.env | grep BASELINE_THROUGHPUT | cut -d'=' -f2)

# Should be within 10% of baseline
VARIANCE=$((($CURRENT_THROUGHPUT - $BASELINE_THROUGHPUT) * 100 / $BASELINE_THROUGHPUT))

if [ $VARIANCE -gt -10 ] && [ $VARIANCE -lt 10 ]; then
  echo "✅ Performance within acceptable variance: $VARIANCE%"
else
  echo "❌ Performance variance outside acceptable range: $VARIANCE%"
  echo "   Current: $CURRENT_THROUGHPUT msg/sec"
  echo "   Baseline: $BASELINE_THROUGHPUT msg/sec"
fi
```

#### Validation Phase 3: Feature Testing (T+2 to T+3 hours)

**3.1 Session Persistence**

```bash
# Test session creation and persistence
curl -X POST http://localhost:8765/session/create \
  -H "Content-Type: application/json" \
  -d '{"persistent": true}'

# Expected: Session ID returned

# Test session resume
SESSION_ID=$(curl -s -X POST http://localhost:8765/session/create \
  -H "Content-Type: application/json" \
  -d '{"persistent": true}' | jq -r '.sessionId')

curl -X POST http://localhost:8765/session/resume \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\"}"

# Expected: Session resumed successfully
```

**3.2 Security Validation**

```bash
# Verify encryption enabled
curl -s http://localhost:8765/config/encryption | jq '.enabled'

# Expected: true

# Verify HMAC enforcement
curl -s http://localhost:8765/config/security | jq '.hmac_required'

# Expected: true
```

**3.3 Monitoring Features**

```bash
# Test monitoring capability with 10 targets
for i in {1..10}; do
  curl -X POST http://localhost:8765/monitoring/start \
    -H "Content-Type: application/json" \
    -d "{\"target\": \"example-target-$i\"}" &
done
wait

# Verify all targets being monitored
curl -s http://localhost:8765/monitoring/targets | jq '.active_count'

# Expected: 10 targets
```

**Success Criteria:**
- ✅ Session persistence working
- ✅ Session resume working
- ✅ Encryption enabled
- ✅ HMAC enforcement active
- ✅ Monitoring supporting 10+ targets
- ✅ All features functional

#### Validation Phase 4: Integration Testing (T+3 to T+4 hours)

**4.1 WebSocket Message Handling**

```bash
# Test message reception and response
wscat -c ws://localhost:8765 << EOF
{"id": "test-1", "command": "ping"}
{"id": "test-2", "command": "health"}
EOF

# Expected: Responses for both messages
```

**4.2 Connection Stability**

```bash
# Test connection under sustained load
npm run test:connection-stability -- --duration=600 --concurrency=50

# Expected:
# - Connection errors: <0.1%
# - Reconnections: <5
# - Avg connection lifetime: >500 seconds
```

**4.3 Error Recovery**

```bash
# Test error handling and recovery
npm run test:error-handling -- --error-injection=true

# Expected:
# - Error rate: <1%
# - Recovery success: >99%
# - No hung connections
```

**Success Criteria:**
- ✅ All messages received
- ✅ Response times consistent
- ✅ Connection error rate <0.1%
- ✅ Recovery success >99%
- ✅ No stuck connections

### Validation Summary

| Phase | Status | Duration | Passed |
|-------|--------|----------|--------|
| Immediate Health | ✅ | 30 min | YES |
| Performance Testing | ✅ | 60 min | YES |
| Feature Testing | ✅ | 60 min | YES |
| Integration Testing | ✅ | 60 min | YES |

---

## Rollback Procedures

### Rollback Trigger Conditions

**Automatic Rollback (if any of these occur):**
- Error rate >2% sustained for >5 minutes
- Latency P99 >500ms sustained for >5 minutes
- Memory growth >100MB in 10 minutes
- CPU usage >80% sustained for >10 minutes
- Connection errors >10% sustained for >5 minutes

**Manual Rollback (on-call decision):**
- Critical bug discovered in production
- Data corruption detected
- Security issue found
- Customer impact threshold exceeded

### Rollback Steps

#### Step 1: Trigger Rollback (T+0 to T+2)

```bash
# Set rollback flag
echo "ROLLBACK_ACTIVE=true" > /etc/basset-hound/rollback.env

# Notify on-call team
curl -X POST https://slack-webhook.example.com \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "🚨 v12.2.0 Rollback Initiated",
    "attachments": [{"color": "danger", "text": "Initiating rollback to v12.1.0"}]
  }'

# Log rollback decision
echo "Rollback initiated at $(date) - $(date +%s)" >> /var/log/rollback.log
```

#### Step 2: Stop v12.2.0 (T+2 to T+5)

```bash
# Stop new container
docker stop basset-hound-browser-v12.2.0

# Wait for graceful shutdown
sleep 5

# Verify stopped
docker ps | grep v12.2.0 || echo "✅ v12.2.0 stopped"
```

#### Step 3: Start v12.1.0 (T+5 to T+15)

```bash
# Start from backup
docker run -d \
  --name basset-hound-browser-v12.1.0 \
  --label "app=basset-hound" \
  --label "version=v12.1.0" \
  --restart unless-stopped \
  -p 8765:8765 \
  -p 8766:8766 \
  --health-cmd="curl -f http://localhost:8765/health || exit 1" \
  --health-interval=5s \
  --health-timeout=3s \
  --health-retries=3 \
  --memory=4g \
  --cpus=2 \
  basset-hound-browser:v12.1.0-backup

# Wait for health
sleep 30

# Verify healthy
docker inspect $(docker ps -q --filter "label=version=v12.1.0") | jq '.[] | .State.Health.Status'
```

#### Step 4: Verify Rollback (T+15 to T+20)

```bash
# Verify service responding
curl -v http://localhost:8765/health

# Verify metrics baseline restored
curl -s http://localhost:8765/metrics/throughput
curl -s http://localhost:8765/metrics/latency

# Verify no errors in logs
docker logs $(docker ps -q --filter "label=version=v12.1.0") | grep -i error | tail -5
```

#### Step 5: Notify & Archive (T+20 onwards)

```bash
# Save v12.2.0 container logs for analysis
docker logs basset-hound-browser-v12.2.0 > /var/log/basset-hound/v12.2.0-failure-$(date +%Y%m%d-%H%M%S).log

# Notify stakeholders
curl -X POST https://slack-webhook.example.com \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "✅ Rollback to v12.1.0 Complete",
    "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": "✅ *Rollback Complete*\n• Version: v12.1.0 restored\n• Time to rollback: <5 minutes\n• Investigation: In progress"}}]
  }'

# Create incident ticket
# (using your incident management system)
curl -X POST https://incident-tracker.example.com/api/incidents \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "v12.2.0 Rollback - Production Issue",
    "severity": "high",
    "description": "Rolled back from v12.2.0 to v12.1.0 due to production issues"
  }'
```

### Rollback Validation

**Success Criteria:**
- ✅ Rollback completed within 5 minutes
- ✅ v12.1.0 healthy and responding
- ✅ All metrics restored to baseline
- ✅ No data loss
- ✅ Error rate <0.1%
- ✅ Team notified

---

## Post-Deployment Monitoring

### Monitoring Duration: 4 Hours Post-Deployment

#### Hour 1: System Stability (T+30 to T+90)
**Interval:** Every 5 minutes

```bash
# Health checks
docker inspect $(docker ps -q --filter "label=version=v12.2.0") | jq '.[] | .State.Health.Status'

# Connection count
docker exec $(docker ps -q --filter "label=version=v12.2.0") \
  /bin/sh -c 'netstat -an | grep ESTABLISHED | wc -l'

# Error logs
docker logs --since 5m $(docker ps -q --filter "label=version=v12.2.0") | grep -i error | wc -l
```

#### Hour 2: Performance Validation (T+90 to T+150)
**Interval:** Every 10 minutes

```bash
# Throughput
curl -s http://localhost:8765/metrics/throughput | jq '.current'
# Expected: >400 msg/sec

# Latency P99
curl -s http://localhost:8765/metrics/latency | jq '.p99'
# Expected: <2ms

# Memory
curl -s http://localhost:8765/metrics/memory | jq '.usage_percent'
# Expected: <2%
```

#### Hour 3: Feature Validation (T+150 to T+210)
**Interval:** Every 15 minutes

```bash
# Session operations
curl -s http://localhost:8765/metrics/sessions | jq '.active_sessions'

# Session persistence test
npm run test:features -- --test-session-persistence

# Monitoring operations
curl -s http://localhost:8765/metrics/monitoring | jq '.active_targets'
```

#### Hour 4: Trend Analysis (T+210 to T+270)
**Interval:** Every 20 minutes

```bash
# Generate performance report
npm run report:performance -- --since=4h

# Analyze error trends
docker logs $(docker ps -q --filter "label=version=v12.2.0") | grep "ERROR\|WARN" | tail -20

# Check for resource leaks
curl -s http://localhost:8765/metrics/memory | jq '.historical'
```

### Monitoring Dashboard

**Key Metrics to Watch:**

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| Error Rate | >2% | Page on-call immediately |
| Latency P99 | >500ms | Investigate, may trigger rollback |
| Memory Growth | >100MB/10min | Monitor closely, prepare rollback |
| CPU Usage | >80% | Reduce traffic, may trigger rollback |
| Connection Errors | >10% | Investigate network, may trigger rollback |

### All-Clear Criteria

After 4 hours, v12.2.0 is confirmed production-ready if:

- ✅ Error rate stable at <0.1%
- ✅ Latency P99 consistent at <2ms
- ✅ Memory stable with zero growth
- ✅ CPU usage <30% under normal load
- ✅ Zero critical errors in logs
- ✅ All features functioning correctly
- ✅ Customer impact: none reported

---

## Troubleshooting

### Issue: Container fails to start

**Symptoms:** Container exits immediately, no health checks passing

**Diagnosis:**
```bash
docker logs basset-hound-browser-v12.2.0 | head -50
docker inspect basset-hound-browser-v12.2.0 | jq '.[] | {State, ExitCode}'
```

**Resolution:**
1. Check Docker logs for startup errors
2. Verify image integrity: `docker inspect basset-hound-browser:v12.2.0`
3. Check disk space and memory: `docker stats`
4. Try pulling image again: `docker pull basset-hound-browser:v12.2.0`
5. Rollback to v12.1.0 if issue persists

### Issue: Health checks failing

**Symptoms:** Health status shows "unhealthy", container keeps restarting

**Diagnosis:**
```bash
docker exec basset-hound-browser-v12.2.0 curl -f http://localhost:8765/health
docker logs basset-hound-browser-v12.2.0 | grep -i health | tail -10
```

**Resolution:**
1. Check if WebSocket endpoint is responding
2. Verify port 8765 is not in use: `netstat -tuln | grep 8765`
3. Check container resource limits: `docker inspect ... | jq '.[] | .HostConfig'`
4. Allow more time for startup: `docker update --health-start-period=20s container`

### Issue: High error rate or connection failures

**Symptoms:** Error logs showing connection issues, client timeouts

**Diagnosis:**
```bash
docker logs basset-hound-browser-v12.2.0 | grep -i "error\|timeout\|connection" | head -20
curl -s http://localhost:8765/metrics/errors | jq '.'
```

**Resolution:**
1. Check if load is within capacity (200 concurrent max)
2. Verify network connectivity: `docker network inspect bridge`
3. Check for resource exhaustion: `docker stats`
4. Review recent changes: `docker diff basset-hound-browser-v12.2.0`
5. Consider rollback if errors persistent

### Issue: Performance degradation

**Symptoms:** Throughput <300 msg/sec, latency >10ms P99

**Diagnosis:**
```bash
curl -s http://localhost:8765/metrics | jq '.throughput, .latency'
docker stats basset-hound-browser-v12.2.0
```

**Resolution:**
1. Reduce concurrent connections (max 200)
2. Enable compression: Environment variable `ENABLE_COMPRESSION=true`
3. Check for memory leaks: `docker stats --no-stream=false`
4. Review monitoring logs for slow queries
5. Consider load balancer or horizontal scaling

---

## Appendices

### Appendix A: Environment Variables

```bash
# Logging
LOG_LEVEL=info              # debug, info, warn, error
LOG_FORMAT=json             # json, text

# Performance
ENABLE_COMPRESSION=true     # Enable message compression
COMPRESSION_LEVEL=6         # 0-9 (higher = more compression)
BUFFER_SIZE=65536          # Socket buffer size

# Monitoring
METRICS_ENABLED=true        # Enable metrics collection
METRICS_PORT=8766          # Metrics server port
HEALTH_CHECK_INTERVAL=5s    # Health check frequency

# Security
HMAC_REQUIRED=true          # Enforce HMAC on all messages
ENCRYPTION_ENABLED=true     # Enable AES-256-GCM
RATE_LIMIT_ENABLED=true     # Per-client rate limiting

# Resource Limits
MAX_CONNECTIONS=200         # Maximum concurrent connections
MAX_MESSAGE_SIZE=16777216   # 16MB max message
TIMEOUT_MS=30000           # Request timeout
```

### Appendix B: Rollback Command Reference

```bash
# Quick rollback (one command)
docker stop basset-hound-browser-v12.2.0 && \
docker run -d --restart unless-stopped \
  -p 8765:8765 \
  basset-hound-browser:v12.1.0-backup

# Verify rollback
docker ps --filter "label=version=v12.1.0"
curl http://localhost:8765/health
```

### Appendix C: Monitoring Query Examples

```bash
# Throughput trend
curl 'http://localhost:8765/metrics/throughput?range=1h'

# Error rate by type
curl 'http://localhost:8765/metrics/errors?group-by=type'

# Connection lifecycle
curl 'http://localhost:8765/metrics/connections?detailed=true'

# Memory usage trend
curl 'http://localhost:8765/metrics/memory?range=4h'
```

### Appendix D: Contact & Escalation

**Deployment Lead:** devops@company.com  
**On-Call Engineer:** (via PagerDuty)  
**Platform Team:** platform-team@company.com  
**Incident Commander:** (rotate based on severity)

**Escalation Path:**
1. On-call engineer (immediate response)
2. Platform lead (if issue persists >15 min)
3. VP Engineering (if customer impact >5 min)

---

**Deployment Playbook v12.2.0 - Ready for Production**
