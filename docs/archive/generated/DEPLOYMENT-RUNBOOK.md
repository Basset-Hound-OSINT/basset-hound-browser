# Production Deployment Runbook
## Basset Hound Browser v12.8.0

**Document Version**: 1.0.0  
**Last Updated**: June 21, 2026  
**Status**: Production Ready  
**Author**: Deployment Architecture Team  

---

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Procedure](#deployment-procedure)
3. [Staging Validation](#staging-validation)
4. [Production Deployment](#production-deployment)
5. [Rollback Procedure](#rollback-procedure)
6. [Monitoring & Alerts](#monitoring--alerts)
7. [Post-Deployment Validation](#post-deployment-validation)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### Code Quality (Target: 92%+ pass rate)
```bash
# 1. Run comprehensive test suite
npm run test:cleanup
npm test

# Expected: 80+ unit tests passing
# Expected: 50+ integration tests passing
# Target: <5% test failure rate
```

**Verification Steps**:
- [ ] Unit tests: `npm run test:unit`
- [ ] Integration tests: `npm run test:integration`
- [ ] Coverage: minimum 50% across all modules
- [ ] No flaky tests detected
- [ ] All error handling paths covered

### Security Audit (Target: 0 critical findings)
```bash
# 2. Run security audit
npm audit
npm audit fix --force  # Only if necessary

# 3. ESLint verification
npm run lint

# 4. Code review
# Verify:
# - No hardcoded secrets
# - No console.log() in production code
# - Environment variables documented
```

**Verification Steps**:
- [ ] `npm audit` shows 0 critical findings
- [ ] `npm audit` shows 0 high findings
- [ ] ESLint passes with 0 errors
- [ ] No deprecated dependencies
- [ ] All major versions locked in package-lock.json

### Build Verification
```bash
# 5. Build Docker image
docker build -t basset-hound-browser:12.8.0 \
  --build-arg NODE_ENV=production \
  .

# Expected: <10 minutes build time
# Expected: <2.5GB image size
```

**Verification Steps**:
- [ ] Docker build succeeds
- [ ] Image layers cached appropriately
- [ ] Image size acceptable (<2.5GB)
- [ ] No build warnings
- [ ] HEALTHCHECK configured

### Configuration Review
```bash
# 6. Verify environment variables
cat .env.example  # Review all required variables

# Required for production:
# - RATE_LIMIT_ENABLED=true
# - WS_SECURE=true (if using WSS)
# - WS_CERT_PATH=/etc/certs/cert.pem
# - WS_KEY_PATH=/etc/certs/key.pem
# - NODE_ENV=production
# - LOG_LEVEL=info
```

**Verification Steps**:
- [ ] `.env.example` documents all variables
- [ ] No secrets in default configuration
- [ ] Security variables documented
- [ ] Performance variables optimized
- [ ] Logging configured appropriately

### Documentation Verification
```bash
# 7. Check documentation completeness
ls -la docs/
ls -la README.md
ls -la SECURITY.md
ls -la docs/DEPLOYMENT-GUIDE.md
ls -la docs/TROUBLESHOOTING.md
```

**Verification Steps**:
- [ ] README.md updated to v12.8.0
- [ ] API-REFERENCE-AUTHORITATIVE.md complete
- [ ] SECURITY.md comprehensive
- [ ] DEPLOYMENT-GUIDE.md current
- [ ] TROUBLESHOOTING.md covers common issues
- [ ] Architecture documented in /docs
- [ ] Changelog includes v12.8.0 changes

### Backup & Recovery
```bash
# 8. Prepare backups
# Current system state (git)
git tag -a "pre-deployment-v12.8.0" -m "Pre-deployment backup"
git push origin "pre-deployment-v12.8.0"

# Database/configuration (if applicable)
# Backup any persistent state
```

**Verification Steps**:
- [ ] Git tag created for rollback reference
- [ ] Configuration files backed up
- [ ] Previous version accessible if needed
- [ ] Recovery procedure tested

---

## Deployment Procedure

### Phase 1: Docker Image Build & Registry Push

**Duration**: 10-15 minutes  
**Risk Level**: Low (no production impact)  
**Reversibility**: Full (don't deploy to production)

```bash
# Step 1.1: Build image with proper tags
docker build -t basset-hound-browser:12.8.0 \
  --build-arg NODE_ENV=production \
  --build-arg VERSION=12.8.0 \
  -f Dockerfile .

# Step 1.2: Verify image builds and runs
docker run --rm basset-hound-browser:12.8.0 --version

# Step 1.3: Tag image for registry
REGISTRY="${DOCKER_REGISTRY:-docker.io}"
docker tag basset-hound-browser:12.8.0 \
  ${REGISTRY}/basset-hound-browser:12.8.0
docker tag basset-hound-browser:12.8.0 \
  ${REGISTRY}/basset-hound-browser:latest

# Step 1.4: Push to registry
docker push ${REGISTRY}/basset-hound-browser:12.8.0
docker push ${REGISTRY}/basset-hound-browser:latest

# Verify: Should see "Digest: sha256:..." in output
```

**Verification Checklist**:
- [ ] Image builds successfully
- [ ] Image runs without errors
- [ ] Image pushed to registry
- [ ] Registry digest recorded (for rollback reference)
- [ ] Both version and latest tags pushed

**Rollback at this phase**: 
- No impact to production
- Delete image tags if needed

---

### Phase 2: Staging Deployment

**Duration**: 10-30 minutes  
**Risk Level**: Low-Medium (staging only, no user impact)  
**Validation Time**: 1 hour

```bash
# Step 2.1: Deploy to staging environment
# Using Docker Compose example
cat > docker-compose.staging.yml << 'EOF'
version: '3.8'
services:
  basset-hound:
    image: ${REGISTRY}/basset-hound-browser:12.8.0
    container_name: basset-hound-staging
    environment:
      NODE_ENV: production
      LOG_LEVEL: info
      RATE_LIMIT_ENABLED: "true"
      RATE_LIMIT_UNAUTHENTICATED: "100"
      WS_PORT: 8765
      WS_HOST: 0.0.0.0
    ports:
      - "8765:8765"
    volumes:
      - /etc/certs:/etc/certs:ro
    networks:
      - basset-hound-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8765/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  basset-hound-network:
    driver: bridge
EOF

# Step 2.2: Start staging container
docker-compose -f docker-compose.staging.yml up -d

# Step 2.3: Verify container is healthy
sleep 10
docker ps | grep basset-hound-staging

# Step 2.4: Check health endpoint
curl -f http://localhost:8765/health || echo "Health check failed"

# Step 2.5: Test basic connectivity
# WebSocket connection test
node - <<'EOFJS'
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');
ws.on('open', () => {
  console.log('✓ WebSocket connected');
  ws.send(JSON.stringify({ command: 'get_rate_limit_status' }));
});
ws.on('message', (data) => {
  console.log('✓ Message received:', data);
  ws.close();
});
ws.on('error', (err) => {
  console.error('✗ WebSocket error:', err);
  process.exit(1);
});
EOFJS
```

**Staging Validation (1 hour duration)**:

```bash
# Step 2.6: Run smoke tests
echo "=== Smoke Tests ==="

# Test 1: Health check
curl -v http://localhost:8765/health
# Expected: HTTP 200, response time <100ms

# Test 2: Rate limit status
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"command":"get_rate_limit_status"}'

# Test 3: Navigation test
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"command":"navigate","url":"https://example.com"}'

# Test 4: Content extraction
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"command":"get_content"}'

# Test 5: Screenshot
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"command":"screenshot"}'

# Step 2.7: Monitor logs
docker logs -f basset-hound-staging --tail 100
# Watch for:
# - No ERROR entries
# - No rate limiting warnings (unless expected)
# - Clean startup sequence

# Step 2.8: Run extended validation (30 minutes)
# 1. Monitor memory usage
docker stats basset-hound-staging --no-stream
# Expected: <500MB memory

# 2. Check for memory leaks (let run 30 min)
while true; do
  docker stats basset-hound-staging --no-stream --format "{{.MemUsage}}" 
  sleep 60
done
# Expected: Memory usage stable within 50MB range

# 3. Monitor CPU usage
docker stats basset-hound-staging --no-stream
# Expected: <30% CPU at idle

# 4. Connection persistence test
# Simulate: 10 concurrent connections for 10 minutes
for i in {1..10}; do
  (
    while true; do
      curl -X POST http://localhost:8765 \
        -H "Content-Type: application/json" \
        -d '{"command":"get_rate_limit_status"}' \
        -m 5 2>/dev/null || true
      sleep 5
    done
  ) &
done
# Let run for 10 minutes, monitor logs for errors
```

**Staging Validation Checklist**:
- [ ] Container starts successfully
- [ ] Health check passes (HTTP 200, <100ms)
- [ ] All 5 smoke tests pass
- [ ] Logs show no errors
- [ ] Memory usage <500MB
- [ ] Memory stable after 30 minutes
- [ ] CPU <30% at idle
- [ ] No connection errors during 10-minute stress
- [ ] Rate limiting working correctly
- [ ] Graceful error handling verified

**If staging validation FAILS**:
- [ ] Review logs: `docker logs basset-hound-staging`
- [ ] Check resource limits: `docker stats basset-hound-staging`
- [ ] Verify configuration: `docker inspect basset-hound-staging`
- [ ] Stop container: `docker-compose -f docker-compose.staging.yml down`
- [ ] DO NOT PROCEED to production
- [ ] Follow [Troubleshooting](#troubleshooting) section

---

### Phase 3: Production Deployment

**Duration**: 5-10 minutes  
**Risk Level**: Medium (production impact possible)  
**Monitoring Period**: 1 hour post-deployment

```bash
# Step 3.1: Pre-deployment snapshot
echo "Creating pre-deployment snapshot..."
docker ps -a | tee deployment-$(date +%s).log
docker images | grep basset-hound | tee -a deployment-$(date +%s).log

# Step 3.2: Gracefully stop current production instance (if running)
# Option A: If using Docker
docker stop basset-hound-browser-prod || echo "No running instance"
docker wait basset-hound-browser-prod 2>/dev/null || true
sleep 2

# Option B: If using systemd
# systemctl stop basset-hound-browser || echo "Service not running"

# Step 3.3: Start new production container
docker run -d \
  --name basset-hound-browser-prod \
  --restart unless-stopped \
  --memory 2g \
  --cpus 2 \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=10 \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  -e RATE_LIMIT_ENABLED=true \
  -e RATE_LIMIT_UNAUTHENTICATED=25 \
  -e RATE_LIMIT_AUTHENTICATED=250 \
  -e REQUEST_SIZE_LIMIT_GLOBAL=52428800 \
  -e REQUEST_SIZE_LIMIT_SCREENSHOT=25165824 \
  -e REQUEST_SIZE_LIMIT_DEFAULT=5242880 \
  -e WS_PORT=8765 \
  -e WS_HOST=0.0.0.0 \
  -e WS_SECURE=false \
  -v /etc/certs:/etc/certs:ro \
  -v /var/log/basset-hound:/var/log/basset-hound \
  -p 8765:8765 \
  --health-cmd='curl -f http://localhost:8765/health || exit 1' \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  --health-start-period=40s \
  ${REGISTRY}/basset-hound-browser:12.8.0

# Record deployment time
DEPLOY_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "Deployment started: $DEPLOY_TIME" | tee deployment-$(date +%s).log

# Step 3.4: Wait for container to be healthy
echo "Waiting for container health checks..."
for i in {1..60}; do
  STATUS=$(docker inspect basset-hound-browser-prod --format='{{.State.Health.Status}}')
  if [ "$STATUS" = "healthy" ]; then
    echo "✓ Container is healthy after $((i*5)) seconds"
    break
  fi
  echo "Status: $STATUS (attempt $i/60)"
  sleep 5
  if [ $i -eq 60 ]; then
    echo "✗ Container failed to become healthy in 5 minutes"
    docker logs basset-hound-browser-prod
    exit 1
  fi
done
```

**Post-Deployment Monitoring (1 hour)**:

```bash
# Step 3.5: Initial validation (first 5 minutes)
echo "=== Initial Validation ==="

# Check container is running
docker ps | grep basset-hound-browser-prod
# Expected: container listed, status "Up"

# Check health endpoint
for i in {1..10}; do
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8765/health)
  echo "Health check $i: HTTP $HEALTH"
  if [ "$HEALTH" = "200" ]; then
    echo "✓ Health endpoint responding"
  else
    echo "✗ Health check failed"
  fi
  sleep 5
done

# Check logs for errors
docker logs basset-hound-browser-prod --tail 50
# Expected: No ERROR or CRITICAL entries

# Step 3.6: Performance baseline (5-30 minutes)
echo "=== Performance Monitoring ==="

# Monitor every 5 minutes for 30 minutes
for i in {1..6}; do
  echo "=== Monitoring cycle $i of 6 ==="
  
  # Memory usage
  MEMORY=$(docker stats basset-hound-browser-prod --no-stream --format "{{.MemUsage}}")
  echo "Memory: $MEMORY"
  
  # CPU usage
  CPU=$(docker stats basset-hound-browser-prod --no-stream --format "{{.CPUPerc}}")
  echo "CPU: $CPU"
  
  # Connected clients (from logs)
  CONNECTIONS=$(docker logs basset-hound-browser-prod --tail 100 | grep -c "client connected" || echo "0")
  echo "Active connections: $CONNECTIONS"
  
  # Error rate (from logs)
  ERRORS=$(docker logs basset-hound-browser-prod --tail 100 | grep -c "ERROR" || echo "0")
  echo "Recent errors: $ERRORS"
  
  if [ $i -lt 6 ]; then
    sleep 300  # 5 minutes
  fi
done

# Step 3.7: Extended monitoring (30-60 minutes)
# Keep container running, monitor for:
# - Memory growth (should be <50MB/5min)
# - CPU spikes (should be <20% at idle)
# - Error rate (should be 0 unless workload applied)
# - Connection stability
```

**Production Validation Checklist**:
- [ ] Container starts successfully
- [ ] Health check passes consistently
- [ ] Memory usage stable <500MB
- [ ] CPU usage <30% idle
- [ ] No errors in logs (first hour)
- [ ] Rate limiting functioning
- [ ] Response times <100ms baseline
- [ ] All endpoints responding

**If production deployment FAILS**:
- [ ] STOP: Do not apply further changes
- [ ] Capture logs: `docker logs basset-hound-browser-prod > prod-failure-$(date +%s).log`
- [ ] Follow [Rollback Procedure](#rollback-procedure)

---

## Rollback Procedure

### Instant Rollback (Recommended)

**Duration**: <2 minutes  
**Data Loss**: None  
**System Impact**: Minimal

```bash
# Step 1: Capture current state for forensics
docker logs basset-hound-browser-prod > /var/log/basset-hound/rollback-$(date +%s).log
docker inspect basset-hound-browser-prod > /var/log/basset-hound/container-state-$(date +%s).json

# Step 2: Stop current container
docker stop basset-hound-browser-prod
docker wait basset-hound-browser-prod

# Step 3: Start previous version
# Get previous tag from deployment log
PREVIOUS_TAG="12.7.0"  # From pre-deployment snapshot

docker run -d \
  --name basset-hound-browser-prod \
  --restart unless-stopped \
  --memory 2g \
  --cpus 2 \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=10 \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  -e RATE_LIMIT_ENABLED=true \
  -e RATE_LIMIT_UNAUTHENTICATED=25 \
  -e RATE_LIMIT_AUTHENTICATED=250 \
  -e REQUEST_SIZE_LIMIT_GLOBAL=52428800 \
  -e REQUEST_SIZE_LIMIT_SCREENSHOT=25165824 \
  -e REQUEST_SIZE_LIMIT_DEFAULT=5242880 \
  -e WS_PORT=8765 \
  -e WS_HOST=0.0.0.0 \
  -e WS_SECURE=false \
  -p 8765:8765 \
  ${REGISTRY}/basset-hound-browser:${PREVIOUS_TAG}

# Step 4: Verify rollback
sleep 10
curl -f http://localhost:8765/health && echo "✓ Rollback successful" || echo "✗ Rollback check failed"

# Step 5: Notify stakeholders
echo "ROLLBACK COMPLETED: Rolled back from v12.8.0 to v${PREVIOUS_TAG}"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
```

### When to Rollback

Rollback **IMMEDIATELY** if:
- [ ] Health checks failing continuously (>3 consecutive failures)
- [ ] Memory usage >1.5GB (memory leak)
- [ ] CPU usage >80% sustained
- [ ] Error rate >5%
- [ ] Latency P99 >500ms
- [ ] Unable to process requests
- [ ] Data corruption detected
- [ ] Security vulnerability confirmed

Do **NOT** rollback if:
- [ ] Minor errors in logs
- [ ] Brief latency spikes
- [ ] Expected high load
- [ ] Client application issue

### Full Rollback Procedure

If instant rollback fails:

```bash
# Step 1: Kill existing container (force)
docker kill basset-hound-browser-prod || true
docker rm -f basset-hound-browser-prod || true

# Step 2: Verify port is free
netstat -tuln | grep 8765
# Should show no output

# Step 3: Start previous version with verbose logging
docker run -it \
  --name basset-hound-browser-prod \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=10 \
  -e NODE_ENV=production \
  -e LOG_LEVEL=debug \
  -p 8765:8765 \
  ${REGISTRY}/basset-hound-browser:${PREVIOUS_TAG}

# Step 4: Verify in separate terminal
curl -v http://localhost:8765/health

# Step 5: If still failing, check:
# - Disk space: df -h
# - Docker resources: docker system df
# - Port conflicts: lsof -i :8765
# - Container logs: docker logs basset-hound-browser-prod
```

### Post-Rollback Actions

After successful rollback:

```bash
# 1. Notify team
echo "INCIDENT: v12.8.0 deployment rolled back to v${PREVIOUS_TAG}"
echo "Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# 2. Capture forensics
docker logs basset-hound-browser-prod > rollback-logs-$(date +%s).log

# 3. Schedule incident review
echo "Schedule post-mortem for: tomorrow 10:00 AM"

# 4. Create incident ticket with:
# - Deployment timestamp
# - Failure symptoms
# - Logs and metrics
# - Recovery time
# - Root cause (TBD)

# 5. Investigate root cause
# - Check code changes
# - Review dependency updates
# - Verify configuration
# - Test in staging
```

---

## Monitoring & Alerts

### Health Check Configuration

```bash
# Docker health check (built-in)
# Runs every 30 seconds
curl -f http://localhost:8765/health
# Expected response: HTTP 200 within 10 seconds

# Manual health check script
#!/bin/bash
check_health() {
  local RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    --connect-timeout 5 \
    --max-time 10 \
    http://localhost:8765/health)
  
  if [ "$RESPONSE" = "200" ]; then
    echo "healthy"
    return 0
  else
    echo "unhealthy (HTTP $RESPONSE)"
    return 1
  fi
}

# Use in cron job (check every minute)
* * * * * /usr/local/bin/check-basset-hound-health.sh >> /var/log/basset-hound/health.log 2>&1
```

### Key Metrics to Monitor

```
Metric                  | Threshold | Alert Level | Action
========================|===========|=============|========
Memory Usage            | >80%      | Warning     | Investigate memory leak
Memory Usage            | >95%      | Critical    | Immediate restart
CPU Usage               | >80%      | Warning     | Check for runaway process
CPU Usage               | >95%      | Critical    | Investigate/restart
Error Rate              | >1%       | Warning     | Check logs for pattern
Error Rate              | >5%       | Critical    | Potential rollback
P99 Latency             | >100ms    | Warning     | Check network/load
P99 Latency             | >500ms    | Critical    | Potential rollback
Health Check Failures   | 1-2       | Warning     | Monitor closely
Health Check Failures   | >=3       | Critical    | ROLLBACK
Connections (concurrent)| >500      | Warning     | Monitor/scale
Connections (concurrent)| >1000     | Critical    | Scale/limit
Rate Limit Violations   | >10/hour  | Warning     | Review policy
Rate Limit Violations   | >100/hour | Critical    | Block/investigate
Cert Expiration         | <7 days   | Warning     | Renew certificate
Cert Expiration         | <1 day    | Critical    | EMERGENCY renewal
Disk Usage              | >80%      | Warning     | Cleanup logs/data
Disk Usage              | >95%      | Critical    | Emergency cleanup
```

### Monitoring Implementation

```bash
# Option 1: Prometheus metrics (recommended)
# Export metrics on /metrics endpoint
# Configure Prometheus to scrape http://localhost:8765/metrics

# Option 2: CloudWatch (AWS)
# Configure CloudWatch agent to monitor:
# - Container CPU/Memory
# - Custom metrics from application logs

# Option 3: Datadog
# Install Datadog agent
# Monitor Docker container metrics
# Set alerts for thresholds above

# Option 4: ELK Stack (Self-hosted)
# Elasticsearch: store logs
# Logstash: parse logs
# Kibana: visualize metrics
```

### Alert Configuration

```yaml
# Example Prometheus alert rules
groups:
  - name: basset-hound-browser
    interval: 30s
    rules:
      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes{name="basset-hound-browser-prod"} > 1600000000
        for: 5m
        annotations:
          summary: "High memory usage (>1.5GB)"
          
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        annotations:
          summary: "Error rate >5%"
          
      - alert: HighLatency
        expr: histogram_quantile(0.99, rate(http_request_duration_seconds[5m])) > 0.5
        for: 5m
        annotations:
          summary: "P99 latency >500ms"
          
      - alert: HealthCheckFailure
        expr: count(up{job="basset-hound"} == 0) >= 1
        for: 2m
        annotations:
          summary: "Health checks failing"
          action: "ROLLBACK REQUIRED"
```

### Manual Monitoring Commands

```bash
# Real-time monitoring
docker stats basset-hound-browser-prod

# Monitor specific metric over time
watch -n 5 'docker stats basset-hound-browser-prod --no-stream | tail -5'

# Log tail (follow)
docker logs -f basset-hound-browser-prod --tail 100

# Parse error rate
docker logs basset-hound-browser-prod | grep ERROR | wc -l

# Check response times
docker logs basset-hound-browser-prod | grep "latency:" | tail -20

# Memory growth trend (every 10 seconds)
for i in {1..60}; do
  docker stats basset-hound-browser-prod --no-stream --format "{{.MemUsage}}" | cut -d' ' -f1
  sleep 10
done
```

---

## Post-Deployment Validation

### Smoke Tests (Immediate - 5 minutes)

```bash
# Run immediately after deployment
TEST_ENDPOINT="http://localhost:8765"

echo "=== Smoke Test Suite ==="
echo "Endpoint: $TEST_ENDPOINT"
echo "Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Test 1: Health endpoint
echo -n "Test 1 (Health): "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $TEST_ENDPOINT/health)
if [ "$RESPONSE" = "200" ]; then
  echo "✓ PASS"
else
  echo "✗ FAIL (HTTP $RESPONSE)"
fi

# Test 2: Rate limit status
echo -n "Test 2 (Rate Limit): "
RESPONSE=$(curl -s -X POST $TEST_ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{"command":"get_rate_limit_status"}')
if echo "$RESPONSE" | grep -q "remaining"; then
  echo "✓ PASS"
else
  echo "✗ FAIL"
fi

# Test 3: Navigate command
echo -n "Test 3 (Navigate): "
RESPONSE=$(curl -s -X POST $TEST_ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{"command":"navigate","url":"https://example.com"}')
if echo "$RESPONSE" | grep -q "success\|error"; then
  echo "✓ PASS"
else
  echo "✗ FAIL"
fi

# Test 4: Get content
echo -n "Test 4 (Get Content): "
RESPONSE=$(curl -s -X POST $TEST_ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{"command":"get_content"}')
if [ -n "$RESPONSE" ]; then
  echo "✓ PASS"
else
  echo "✗ FAIL"
fi

# Test 5: Screenshot
echo -n "Test 5 (Screenshot): "
RESPONSE=$(curl -s -X POST $TEST_ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{"command":"screenshot"}')
if [ -n "$RESPONSE" ]; then
  echo "✓ PASS"
else
  echo "✗ FAIL"
fi

echo "=== Smoke Test Complete ==="
```

### Extended Validation (30 minutes)

```bash
# Validation 1: Memory leak detection
echo "=== Memory Leak Detection (10 min) ==="
BASELINE=$(docker stats basset-hound-browser-prod --no-stream --format "{{.MemUsage}}" | head -c5)
echo "Baseline: $BASELINE"

for i in {1..10}; do
  sleep 60
  CURRENT=$(docker stats basset-hound-browser-prod --no-stream --format "{{.MemUsage}}" | head -c5)
  echo "Sample $i: $CURRENT"
done

# Validation 2: Latency measurement
echo "=== Latency Measurement ==="
for i in {1..20}; do
  curl -w "Request %d: %{time_total}s\n" \
    -o /dev/null -s \
    -X POST http://localhost:8765 \
    -H "Content-Type: application/json" \
    -d '{"command":"get_rate_limit_status"}'
  sleep 3
done

# Validation 3: Error rate
echo "=== Error Rate Analysis ==="
TOTAL_LOGS=$(docker logs basset-hound-browser-prod --tail 1000 | wc -l)
ERROR_LOGS=$(docker logs basset-hound-browser-prod --tail 1000 | grep ERROR | wc -l)
ERROR_RATE=$(echo "scale=2; $ERROR_LOGS * 100 / $TOTAL_LOGS" | bc)
echo "Total logs: $TOTAL_LOGS"
echo "Error logs: $ERROR_LOGS"
echo "Error rate: $ERROR_RATE%"
echo "Expected: <1%"

# Validation 4: Connection stability
echo "=== Connection Stability Test ==="
# Create 5 concurrent WebSocket connections
for i in {1..5}; do
  (
    node - <<'EOFJS'
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');
ws.on('open', () => console.log('Connection $i: Open');
ws.on('message', (msg) => console.log('Connection $i: Message');
ws.on('error', (err) => console.error('Connection $i: Error', err);
ws.on('close', () => console.log('Connection $i: Closed');
setTimeout(() => ws.close(), 60000); // Keep open 1 minute
EOFJS
  ) &
done

# Let connections run for 60 seconds
wait
```

### Success Criteria

Deployment is **SUCCESSFUL** if:

- [x] All smoke tests pass
- [x] Health checks passing (100% uptime)
- [x] Memory usage stable (<500MB, no growth trend)
- [x] CPU usage <30% idle
- [x] Error rate <1%
- [x] P99 latency <100ms
- [x] No connection failures
- [x] Rate limiting functional
- [x] Logs show clean startup
- [x] No critical warnings

Deployment is **FAILED** if:

- [ ] Any smoke test fails
- [ ] Health checks failing (>2 consecutive)
- [ ] Memory usage >1.5GB
- [ ] CPU usage >80% sustained
- [ ] Error rate >5%
- [ ] P99 latency >500ms
- [ ] Connection failures observed
- [ ] Critical errors in logs
- [ ] Unable to recover after rollback

---

## Troubleshooting

### Issue: Container fails to start

**Symptoms**: Docker container exits immediately or logs show startup error

**Investigation**:
```bash
# Check container status
docker ps -a | grep basset-hound-browser-prod

# View startup logs
docker logs basset-hound-browser-prod

# Inspect container configuration
docker inspect basset-hound-browser-prod

# Check Docker daemon logs (if using systemd)
journalctl -u docker.service -n 50
```

**Common Causes & Solutions**:

1. **Port already in use**
   ```bash
   # Find process using port 8765
   lsof -i :8765
   kill -9 <PID>
   
   # Retry container start
   docker run -p 8765:8765 ...
   ```

2. **Insufficient disk space**
   ```bash
   # Check disk usage
   df -h
   
   # Clean Docker resources
   docker system prune -a
   docker container prune -f
   docker image prune -a
   ```

3. **Insufficient memory**
   ```bash
   # Check available memory
   free -h
   
   # Reduce container memory limit
   docker run --memory 1g ...
   ```

4. **Certificate file not found**
   ```bash
   # Verify certificates exist
   ls -la /etc/certs/cert.pem
   ls -la /etc/certs/key.pem
   
   # Mount them correctly
   docker run -v /etc/certs:/etc/certs:ro ...
   ```

---

### Issue: High memory usage

**Symptoms**: Memory usage >1GB or growing over time

**Investigation**:
```bash
# Monitor memory in real-time
docker stats basset-hound-browser-prod --no-stream

# Memory trend over 10 minutes
for i in {1..10}; do
  docker stats basset-hound-browser-prod --no-stream --format "{{.MemUsage}}"
  sleep 60
done

# Check for memory leaks
docker logs basset-hound-browser-prod | grep -i memory
```

**Solutions**:

1. **Memory leak suspected** → Restart container
   ```bash
   docker restart basset-hound-browser-prod
   ```

2. **High legitimate usage** → Increase memory limit
   ```bash
   docker kill basset-hound-browser-prod
   docker run --memory 3g ...  # Increase from 2g to 3g
   ```

3. **Identify memory consumer** → Check heap dumps (if available)
   ```bash
   # Enable heap dumps in Node.js
   export NODE_OPTIONS="--max-old-space-size=2048"
   ```

---

### Issue: High latency or slow responses

**Symptoms**: Response times >100ms, timeouts occurring

**Investigation**:
```bash
# Measure response time
for i in {1..10}; do
  curl -w "Time: %{time_total}s\n" -o /dev/null -s \
    -X POST http://localhost:8765 \
    -H "Content-Type: application/json" \
    -d '{"command":"get_rate_limit_status"}'
done

# Check CPU usage
docker stats basset-hound-browser-prod --no-stream

# Check network stats
docker stats basset-hound-browser-prod --no-stream

# Check logs for slow operations
docker logs basset-hound-browser-prod | grep latency
```

**Solutions**:

1. **CPU bottleneck** → Scale horizontally (add more instances)
   ```bash
   # Load balance between multiple containers
   docker run -p 8766:8765 basset-hound-browser:12.8.0
   docker run -p 8767:8765 basset-hound-browser:12.8.0
   # Use HAProxy/nginx to balance load
   ```

2. **Network latency** → Check network path
   ```bash
   # Ping endpoint
   ping -c 5 localhost
   
   # Trace network path
   traceroute localhost
   ```

3. **High load** → Enable rate limiting or scale
   ```bash
   # Verify rate limiting is enabled
   curl -X POST http://localhost:8765 \
     -d '{"command":"get_rate_limit_status"}'
   ```

---

### Issue: Health checks failing

**Symptoms**: Health check endpoint returns non-200 or times out

**Investigation**:
```bash
# Direct health check
curl -v http://localhost:8765/health

# Check container health status
docker inspect basset-hound-browser-prod --format='{{.State.Health.Status}}'

# View last few health check attempts
docker inspect basset-hound-browser-prod | grep -A 10 '"Health"'
```

**Solutions**:

1. **Application not responding** → Check logs
   ```bash
   docker logs basset-hound-browser-prod | tail -50
   ```

2. **Health endpoint misconfigured** → Verify configuration
   ```bash
   docker inspect basset-hound-browser-prod --format='{{.Config.Healthcheck}}'
   ```

3. **Network connectivity issue** → Test connectivity
   ```bash
   docker exec basset-hound-browser-prod curl http://localhost:8765/health
   ```

---

### Issue: Too many errors in logs

**Symptoms**: Logs show many ERROR or CRITICAL messages

**Investigation**:
```bash
# Count errors
docker logs basset-hound-browser-prod | grep ERROR | wc -l

# Show last 50 errors
docker logs basset-hound-browser-prod | grep ERROR | tail -50

# Group errors by type
docker logs basset-hound-browser-prod | grep ERROR | cut -d: -f3 | sort | uniq -c
```

**Common Error Patterns & Solutions**:

1. **Rate limit exceeded**
   ```
   Error: Rate limit exceeded
   ```
   → Verify rate limit configuration or reduce client load

2. **Request validation failed**
   ```
   Error: Request validation failed
   ```
   → Check command format and parameters

3. **Memory allocation failed**
   ```
   Error: Cannot allocate memory
   ```
   → Restart container, increase memory limit

---

### Issue: Rollback fails

**Symptoms**: Cannot start previous version or container won't stay running

**Emergency Recovery**:
```bash
# Step 1: Kill all related containers
docker kill basset-hound-browser-prod
docker rm -f basset-hound-browser-prod
docker kill basset-hound-staging
docker rm -f basset-hound-staging

# Step 2: Verify port is free
netstat -tuln | grep 8765

# Step 3: Check Docker daemon is healthy
docker ps
docker version

# Step 4: Inspect images available
docker images | grep basset-hound

# Step 5: Start fresh with explicit configuration
docker run -it --rm \
  --name basset-hound-test \
  -p 8765:8765 \
  -e LOG_LEVEL=debug \
  basset-hound-browser:12.7.0 \
  # Check if starts successfully

# Step 6: If successful, run in background
docker run -d \
  --name basset-hound-browser-prod \
  -p 8765:8765 \
  basset-hound-browser:12.7.0
```

---

## Deployment Sign-Off

| Role | Name | Date | Time | Status |
|------|------|------|------|--------|
| DevOps Lead | | | | ☐ Approved |
| Security Review | | | | ☐ Approved |
| Development Lead | | | | ☐ Approved |
| On-Call Engineer | | | | ☐ Acknowledged |

---

## Quick Reference

**Deployment Command** (full):
```bash
docker pull ${REGISTRY}/basset-hound-browser:12.8.0
docker run -d \
  --name basset-hound-browser-prod \
  --restart unless-stopped \
  --memory 2g \
  --cpus 2 \
  -e NODE_ENV=production \
  -e RATE_LIMIT_ENABLED=true \
  -p 8765:8765 \
  ${REGISTRY}/basset-hound-browser:12.8.0
```

**Verification Command**:
```bash
curl -f http://localhost:8765/health && echo "✓ Running" || echo "✗ Failed"
```

**Rollback Command**:
```bash
docker stop basset-hound-browser-prod
docker run -d --name basset-hound-browser-prod -p 8765:8765 \
  ${REGISTRY}/basset-hound-browser:12.7.0
```

**Monitor Command**:
```bash
docker logs -f basset-hound-browser-prod --tail 100
```

---

**Document Status**: Ready for Use  
**Last Review**: June 21, 2026  
**Next Review**: September 21, 2026  
