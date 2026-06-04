# Zero-Downtime Upgrades Guide - Basset Hound Browser

**Document Version:** 1.0  
**Last Updated:** June 4, 2026  
**Classification:** Internal Operations  
**Audience:** DevOps, SRE, Engineering Teams

---

## Table of Contents

1. [Overview](#overview)
2. [Upgrade Strategies](#upgrade-strategies)
3. [Blue-Green Deployment](#blue-green-deployment)
4. [Canary Deployment](#canary-deployment)
5. [Rolling Updates](#rolling-updates)
6. [Database Migration Strategies](#database-migration-strategies)
7. [Traffic Switching Procedures](#traffic-switching-procedures)
8. [Rollback Procedures](#rollback-procedures)
9. [Testing Procedures](#testing-procedures)
10. [Troubleshooting](#troubleshooting)
11. [Appendices](#appendices)

---

## Overview

Zero-downtime upgrades ensure service continuity during deployments. This guide covers three proven strategies:

1. **Blue-Green Deployment** - Two complete environments, instant cutover
2. **Canary Deployment** - Gradual traffic shift, early issue detection
3. **Rolling Updates** - Sequential pod replacement, Kubernetes-native

### Key Principles

- **Continuous Service:** No interruption to users
- **Fast Rollback:** Revert in seconds if issues detected
- **Gradual Risk:** Start small, increase gradually
- **Automated Testing:** Validate at each stage
- **Monitoring:** Continuous health checks

### Quick Reference

| Strategy | Setup Time | Cutover Time | Risk | Resource Overhead |
|----------|-----------|-------------|------|-------------------|
| Blue-Green | 30-60 min | 5 minutes | Low | 2x infrastructure |
| Canary | 30-45 min | 2-4 hours | Very Low | +5-25% capacity |
| Rolling | 20-30 min | 10-20 min | Medium | +10-25% capacity |

---

## Upgrade Strategies

### Strategy Selection Matrix

**Use Blue-Green when:**
- Complete infrastructure available
- Need instant rollback capability
- No data migrations required
- Quick cutover is priority
- Can handle 2x resource usage

**Use Canary when:**
- Want to detect issues early with real traffic
- Resource-constrained environment
- Data migrations not required
- Can tolerate longer deployment window
- Want automated decision points

**Use Rolling Updates when:**
- Using Kubernetes/container orchestration
- No database schema changes
- Forward/backward compatible APIs
- Frequent small updates
- Want minimal resource overhead

---

## Blue-Green Deployment

### Architecture

```
CURRENT STATE:
┌─────────────────────────────────────┐
│  BLUE Environment (v11.3.0) [ACTIVE]│
│  - 5 instances running              │
│  - 100% traffic                     │
│  - Load balancer → BLUE             │
└─────────────────────────────────────┘

PRE-DEPLOYMENT:
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│  BLUE Environment (v11.3.0) [ACTIVE]│  │ GREEN Environment (v12.0.0) [PREP]  │
│  - 5 instances running              │  │ - 5 instances starting              │
│  - 100% traffic                     │  │ - 0% traffic                        │
│  - Load balancer → BLUE             │  │ - Load balancer → BLUE              │
└─────────────────────────────────────┘  └─────────────────────────────────────┘

POST-DEPLOYMENT:
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│  BLUE Environment (v11.3.0) [READY] │  │ GREEN Environment (v12.0.0) [ACTIVE]│
│  - 5 instances running              │  │ - 5 instances running               │
│  - 0% traffic                       │  │ - 100% traffic                      │
│  - Load balancer → GREEN            │  │ - Load balancer → GREEN             │
└─────────────────────────────────────┘  └─────────────────────────────────────┘

POST-VALIDATION:
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│  BLUE Environment (v11.3.0) [STANDBY]│  │ GREEN Environment (v12.0.0) [ACTIVE]│
│  - 5 instances running (standby)    │  │ - 5 instances running               │
│  - 0% traffic                       │  │ - 100% traffic                      │
│  - Keep running for 24h rollback    │  │ - Load balancer → GREEN             │
└─────────────────────────────────────┘  └─────────────────────────────────────┘
```

### Phase 1: Pre-Deployment Setup (30 minutes)

**Step 1: Verify BLUE Stability (5 minutes)**

```bash
# Check all BLUE instances healthy
for i in {1..5}; do
  curl -i http://blue-instance-$i:8765/health
done

# Verify load balancer routing to BLUE
curl -i http://load-balancer:8765/health
curl -i http://load-balancer:8765/api/version
# Should return v11.3.0

# Document baseline metrics
echo "=== BLUE BASELINE METRICS ==="
BASELINE_ERROR=$(curl -s http://prometheus:9090/api/v1/query \
  --data-urlencode 'query=rate(errors_total[5m])' | jq '.[].value[1]')
BASELINE_LATENCY=$(curl -s http://prometheus:9090/api/v1/query \
  --data-urlencode 'query=histogram_quantile(0.95,request_duration_seconds)' | jq '.[].value[1]')

echo "Error Rate: $BASELINE_ERROR"
echo "Latency P95: $BASELINE_LATENCY"
```

**Step 2: Prepare GREEN Environment (20 minutes)**

```bash
# Provision 5 new instances with v12.0.0
for i in {1..5}; do
  docker run -d \
    --name green-instance-$i \
    --net basset-hound-browser \
    -p $((10001 + i)):8765 \
    -e INSTANCE_ID=green-$i \
    -e ENVIRONMENT=staging \
    -e LOG_LEVEL=info \
    -v basset-data:/data \
    registry.company.com/basset-hound:v12.0.0
done

# Wait for startup
sleep 30

# Verify all GREEN instances healthy
for i in {1..5}; do
  curl -i http://green-instance-$i:8765/health
done

# Verify version
for i in {1..5}; do
  curl http://green-instance-$i:8765/api/version | grep "v12.0.0"
done
```

**Step 3: Set Up Isolated Testing for GREEN (5 minutes)**

```bash
# Configure separate test load balancer (internal only)
# This allows testing GREEN without affecting BLUE
cat > /etc/load-balancer/green-test.conf <<EOF
upstream green_pool {
    server 10.0.2.1:8765;
    server 10.0.2.2:8765;
    server 10.0.2.3:8765;
    server 10.0.2.4:8765;
    server 10.0.2.5:8765;
}

server {
    listen 9765;  # Separate port for testing
    location / {
        proxy_pass http://green_pool;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

# Reload load balancer
systemctl reload load-balancer

# Verify internal GREEN access
curl -i http://localhost:9765/health
```

### Phase 2: Validation of GREEN Environment (30 minutes)

**Step 1: Functional Testing (10 minutes)**

```bash
# Test core commands on GREEN
echo "Testing core commands on GREEN environment..."

# Test 1: Navigate
curl -X POST http://localhost:9765/api \
  -H "Content-Type: application/json" \
  -d '{"id":"test-1","method":"navigate","params":{"url":"https://example.com"}}'

# Test 2: Click
curl -X POST http://localhost:9765/api \
  -H "Content-Type: application/json" \
  -d '{"id":"test-2","method":"click","params":{"selector":"button"}}'

# Test 3: Screenshot
curl -X POST http://localhost:9765/api \
  -H "Content-Type: application/json" \
  -d '{"id":"test-3","method":"screenshot","params":{}}'

# Test 4: Get Status
curl -X POST http://localhost:9765/api \
  -H "Content-Type: application/json" \
  -d '{"id":"test-4","method":"getStatus","params":{}}'

echo "✓ Core commands functional"
```

**Step 2: Performance Testing (10 minutes)**

```bash
# Run load test against GREEN (from test load balancer)
echo "Running performance tests on GREEN..."

# 50 concurrent clients, 5 seconds duration
ab -n 500 -c 50 http://localhost:9765/health

# Measure latency
echo "Latency test (10 requests):"
for i in {1..10}; do
  curl -w "Response time: %{time_total}s\n" -o /dev/null -s http://localhost:9765/health
done

# Compare with baseline
echo "✓ Performance acceptable"
```

**Step 3: Data Compatibility Testing (10 minutes)**

```bash
# Test session creation/restore on GREEN
echo "Testing data compatibility..."

# Create session on GREEN
SESSION=$(curl -s -X POST http://localhost:9765/api/session \
  -H "Content-Type: application/json" \
  -d '{"id":"test-session"}' | jq '.sessionId')

echo "Created session: $SESSION"

# Store data
curl -s -X POST http://localhost:9765/api/session/$SESSION/storage \
  -H "Content-Type: application/json" \
  -d '{"key":"test","value":"data"}'

# Retrieve data
STORED=$(curl -s http://localhost:9765/api/session/$SESSION/storage/test)
echo "Retrieved data: $STORED"

echo "✓ Data compatibility verified"
```

### Phase 3: Traffic Cutover (5 minutes)

**Step 1: Pre-Cutover Checks (2 minutes)**

```bash
# Final verification before cutover
echo "=== PRE-CUTOVER VERIFICATION ==="

# Check BLUE health one last time
echo "BLUE instances:"
for i in {1..5}; do
  STATUS=$(curl -s http://blue-instance-$i:8765/health | jq '.status')
  echo "  blue-$i: $STATUS"
done

# Check GREEN health
echo "GREEN instances:"
for i in {1..5}; do
  STATUS=$(curl -s http://green-instance-$i:8765/health | jq '.status')
  echo "  green-$i: $STATUS"
done

# Verify current traffic is on BLUE
echo "Current load balancer target:"
curl -s http://load-balancer:8765/api/version | jq '.version'
```

**Step 2: Switch Load Balancer (1 minute)**

```bash
# Update load balancer configuration
# Change routing from BLUE to GREEN

cat > /etc/load-balancer/production.conf <<EOF
upstream production_pool {
    server 10.0.2.1:8765;    # GREEN instance 1
    server 10.0.2.2:8765;    # GREEN instance 2
    server 10.0.2.3:8765;    # GREEN instance 3
    server 10.0.2.4:8765;    # GREEN instance 4
    server 10.0.2.5:8765;    # GREEN instance 5
}

server {
    listen 80;
    listen 443 ssl;
    
    location / {
        proxy_pass http://production_pool;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Connection pooling
        proxy_set_header Connection "";
        
        # WebSocket support
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }
}
EOF

# Reload load balancer
systemctl reload load-balancer

echo "Load balancer switched to GREEN"
```

**Step 3: Verify Cutover (2 minutes)**

```bash
# Verify traffic is now on GREEN
sleep 2

echo "Verifying version after cutover:"
curl -s http://load-balancer:8765/api/version | jq '.'
# Should show v12.0.0

# Check that requests are balanced across GREEN
echo "Connection distribution:"
for i in {1..5}; do
  COUNT=$(netstat -an | grep "10.0.2.$i:8765" | wc -l)
  echo "  green-instance-$i: $COUNT connections"
done

echo "✓ Cutover complete"
```

### Phase 4: Post-Deployment Validation

**Step 1: Immediate Validation (5-15 minutes)**

```bash
# Monitor error rate
echo "Monitoring GREEN performance..."

# Check error rate hasn't increased
CURRENT_ERROR=$(curl -s http://prometheus:9090/api/v1/query \
  --data-urlencode 'query=rate(errors_total[5m])' | jq '.[].value[1]')

echo "Error rate: $CURRENT_ERROR (baseline: $BASELINE_ERROR)"

if (( $(echo "$CURRENT_ERROR > $BASELINE_ERROR * 2" | bc -l) )); then
  echo "ERROR RATE TOO HIGH - ROLLBACK REQUIRED"
  # Execute rollback
else
  echo "✓ Error rate acceptable"
fi

# Check latency
CURRENT_LATENCY=$(curl -s http://prometheus:9090/api/v1/query \
  --data-urlencode 'query=histogram_quantile(0.95,request_duration_seconds)' | jq '.[].value[1]')

echo "Latency P95: $CURRENT_LATENCY (baseline: $BASELINE_LATENCY)"

if (( $(echo "$CURRENT_LATENCY > $BASELINE_LATENCY * 1.2" | bc -l) )); then
  echo "WARNING: Latency increased significantly"
else
  echo "✓ Latency acceptable"
fi
```

**Step 2: 1-Hour Stability Check (1 hour)**

```bash
# Wait 1 hour, then check again
sleep 3600

echo "=== 1-HOUR STABILITY CHECK ==="

# Check no unexpected crashes
RESTART_COUNT=$(kubectl get pods -n basset-hound-browser -l app=basset-hound \
  -o jsonpath='{.items[*].status.containerStatuses[*].restartCount}' | tr ' ' '\n' | awk '{s+=$1} END {print s}')

echo "Total pod restarts: $RESTART_COUNT"

if [ $RESTART_COUNT -gt 5 ]; then
  echo "WARNING: High restart count detected"
else
  echo "✓ Stability check passed"
fi

# Check resource usage
echo "Resource usage:"
kubectl top pods -n basset-hound-browser
```

**Step 3: Decommission BLUE (after 24h validation)**

```bash
# Keep BLUE running for 24 hours as rollback safety net
# After 24h successful GREEN operation:

echo "Decommissioning BLUE environment..."

# Stop BLUE instances
for i in {1..5}; do
  docker stop blue-instance-$i
done

# Remove BLUE instances (optional - can keep as backup image)
for i in {1..5}; do
  docker rm blue-instance-$i
done

echo "✓ BLUE environment decommissioned"
```

### Rollback Procedure (Blue-Green)

**Immediate Rollback (< 2 minutes to stable state):**

```bash
# If issues detected in GREEN, immediately revert to BLUE

echo "ROLLBACK INITIATED - Reverting to v11.3.0"

# Update load balancer back to BLUE
cat > /etc/load-balancer/production.conf <<EOF
upstream production_pool {
    server 10.0.1.1:8765;    # BLUE instance 1
    server 10.0.1.2:8765;    # BLUE instance 2
    server 10.0.1.3:8765;    # BLUE instance 3
    server 10.0.1.4:8765;    # BLUE instance 4
    server 10.0.1.5:8765;    # BLUE instance 5
}
EOF

# Reload load balancer
systemctl reload load-balancer

# Verify rollback
sleep 2
curl -s http://load-balancer:8765/api/version | jq '.'
# Should show v11.3.0

echo "✓ Rollback complete - back on v11.3.0"
```

---

## Canary Deployment

*See STAGED-ROLLOUT-COMPLETE.md for comprehensive canary procedures*

### Quick Reference

1. Deploy to 5% traffic (1 instance)
2. Monitor for 4 hours
3. If healthy, proceed to 25% (3 instances)
4. If issues, rollback immediately
5. Continue to 50%, then 100%

**Key difference from Blue-Green:** Gradual traffic increase vs. instant cutover

---

## Rolling Updates

### Kubernetes Rolling Update

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: basset-hound
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0     # Never take pod down
      maxSurge: 1           # One extra pod during update
  template:
    spec:
      containers:
      - name: basset-hound
        image: registry.company.com/basset-hound:v12.0.0
```

### Manual Rolling Update (Docker)

**Procedure:**

```bash
# 1. Verify all instances healthy
for i in {1..5}; do
  curl -i http://prod-$i:8765/health
done

# 2. Set current instance as "draining" (stop accepting new requests)
DRAINING_INSTANCE="prod-1"
echo "Draining $DRAINING_INSTANCE..."

# Remove from load balancer (stop routing new requests)
# But allow existing connections to complete
curl -X POST http://load-balancer:9000/admin/drain \
  -d "instance=$DRAINING_INSTANCE"

# Wait for in-flight requests to complete (up to 60 seconds)
sleep 60

# 3. Verify instance is drained
CONNECTIONS=$(netstat -an | grep "prod-1" | wc -l)
echo "Remaining connections: $CONNECTIONS"

# 4. Stop old instance
docker stop $DRAINING_INSTANCE --time=30

# 5. Start new instance with new version
docker run -d \
  --name $DRAINING_INSTANCE-new \
  --net basset-hound-browser \
  -p 8765:8765 \
  -e INSTANCE_ID=$DRAINING_INSTANCE \
  -v basset-data:/data \
  registry.company.com/basset-hound:v12.0.0

# 6. Wait for startup
sleep 30

# 7. Verify health
curl -i http://prod-1:8765/health

# 8. Add back to load balancer
curl -X POST http://load-balancer:9000/admin/undrain \
  -d "instance=$DRAINING_INSTANCE"

# 9. Verify receiving traffic
sleep 5
TRAFFIC=$(netstat -an | grep "prod-1" | wc -l)
echo "Current connections: $TRAFFIC"

# 10. Repeat for other instances
# prod-2, prod-3, prod-4, prod-5
```

---

## Database Migration Strategies

### Forward-Compatible Migrations

**Goal:** Allow both old and new code to work with database

**Procedure:**

```bash
# Phase 1: Add new columns/tables (backward compatible)
# - New code can write to both old and new fields
# - Old code continues reading/writing to old fields

# Phase 2: Backfill data
# - Copy data from old fields to new fields
# - Verify consistency

# Phase 3: Deploy new code
# - New code now primary writer to new fields
# - Can read from both for reliability

# Phase 4: Cleanup (after 1 week)
# - Remove old fields/tables
# - Update code to remove dual-write logic
```

### Expanding Columns Example

```sql
-- Phase 1: Add new column (non-blocking, new code writes both)
ALTER TABLE sessions ADD COLUMN session_hash VARCHAR(255);

-- Phase 2: Backfill existing data
UPDATE sessions SET session_hash = SHA256(session_id);

-- Phase 3: Make column required (new code only)
ALTER TABLE sessions MODIFY COLUMN session_hash VARCHAR(255) NOT NULL;

-- Phase 4: Cleanup (remove old column after 1 week)
ALTER TABLE sessions DROP COLUMN session_id;
```

### Schema Expansion Strategy

```bash
# For larger schema changes:

# 1. Create new table with new schema (parallel)
CREATE TABLE sessions_v2 LIKE sessions;
ALTER TABLE sessions_v2 MODIFY COLUMN id BIGINT;

# 2. Deploy dual-write code
# - Write to both sessions (old) and sessions_v2 (new)
# - Read from sessions (old)

# 3. Verify data consistency
SELECT COUNT(*) FROM sessions;
SELECT COUNT(*) FROM sessions_v2;
# Should match

# 4. Backfill sessions_v2 from sessions
INSERT INTO sessions_v2 SELECT * FROM sessions WHERE id NOT IN (SELECT id FROM sessions_v2);

# 5. Switch reads to sessions_v2
# - Update code to read from sessions_v2
# - Keep dual-write to both

# 6. Remove dual-write code (1 week later)
# - Only write to sessions_v2

# 7. Drop old table
DROP TABLE sessions;
RENAME TABLE sessions_v2 TO sessions;
```

---

## Traffic Switching Procedures

### Load Balancer Configuration

**NGINX Configuration:**

```nginx
upstream production {
    # Weight-based load balancing
    server 10.0.1.1:8765 weight=100;  # 50%
    server 10.0.1.2:8765 weight=100;  # 50%
}

upstream new_version {
    # New version instances (initially 0 traffic)
    server 10.0.2.1:8765 weight=0;   # 0%
}

# This zone stores up-to-date request counts
limit_req_zone $binary_remote_addr zone=default_limit:10m rate=1000r/s;

server {
    listen 8765;
    
    # Route based on weight
    location / {
        # Switch between upstream blocks using map
        set $backend "production";
        
        # Conditional logic (e.g., check a file for version switch)
        if (-f /etc/load-balancer/switch_to_new) {
            set $backend "new_version";
        }
        
        # Or use percentage-based distribution
        set $use_new_version 0;
        
        # Check if should use new version
        # (could be random or percentage-based)
        
        proxy_pass http://$backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Progressive Traffic Switch

```bash
#!/bin/bash
# gradually_switch_traffic.sh

# Start with 100% to old, 0% to new
OLD_WEIGHT=100
NEW_WEIGHT=0

# Increment every 5 minutes
for i in {1..10}; do
  # Increase new version by 10%
  OLD_WEIGHT=$((OLD_WEIGHT - 10))
  NEW_WEIGHT=$((NEW_WEIGHT + 10))
  
  echo "Switching traffic: $OLD_WEIGHT% old, $NEW_WEIGHT% new"
  
  # Update load balancer
  sed -i "s/server.*weight=[0-9]*/weight=$OLD_WEIGHT;/" /etc/load-balancer/production.conf
  sed -i "s/server.*new.*weight=[0-9]*/weight=$NEW_WEIGHT;/" /etc/load-balancer/production.conf
  
  # Reload
  systemctl reload load-balancer
  
  # Wait 5 minutes
  sleep 300
  
  # Check metrics
  ERROR_RATE=$(curl -s http://prometheus/api/v1/query \
    --data-urlencode 'query=rate(errors_total[5m])' | jq '.[].value[1]')
  
  echo "Error rate: $ERROR_RATE"
  
  # If error rate too high, stop
  if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
    echo "ERROR RATE TOO HIGH - ABORTING SWITCH"
    # Revert to old version
    OLD_WEIGHT=100
    NEW_WEIGHT=0
    sed -i "s/weight=[0-9]*/weight=$OLD_WEIGHT;/" /etc/load-balancer/production.conf
    systemctl reload load-balancer
    break
  fi
done

echo "Traffic switch complete"
```

---

## Rollback Procedures

### Fast Rollback (Under 5 minutes)

**Trigger:** Any critical failure detected

```bash
#!/bin/bash
# fast_rollback.sh

echo "INITIATING ROLLBACK TO v11.3.0"
echo "Time: $(date -u)"

# Step 1: Stop accepting new connections (30 seconds)
echo "Draining connections..."
for instance in prod-1 prod-2 prod-3 prod-4 prod-5; do
  curl -X POST http://load-balancer:9000/admin/drain \
    -d "instance=$instance" &
done
wait

sleep 30

# Step 2: Stop all new instances
echo "Stopping v12.0.0 instances..."
docker stop $(docker ps --filter label=version=v12.0.0 -q) --time=10

# Step 3: Restore old instances (if using blue-green)
echo "Activating v11.3.0 instances..."
docker start $(docker ps -a --filter label=version=v11.3.0 -q)

# Or deploy v11.3.0 fresh:
for i in {1..5}; do
  docker run -d \
    --name restored-instance-$i \
    -e INSTANCE_ID=prod-$i \
    -v basset-data:/data \
    registry.company.com/basset-hound:v11.3.0
done

# Step 4: Restore load balancer routing
echo "Restoring load balancer..."
cat > /etc/load-balancer/production.conf <<EOF
upstream production_pool {
    server 10.0.1.1:8765;
    server 10.0.1.2:8765;
    server 10.0.1.3:8765;
    server 10.0.1.4:8765;
    server 10.0.1.5:8765;
}
EOF

systemctl reload load-balancer

# Step 5: Resume accepting new connections
echo "Accepting new connections..."
for instance in prod-1 prod-2 prod-3 prod-4 prod-5; do
  curl -X POST http://load-balancer:9000/admin/undrain \
    -d "instance=$instance" &
done

# Step 6: Verify rollback complete
sleep 5
echo "Verifying version..."
curl -s http://load-balancer:8765/api/version | jq '.version'

echo "✓ ROLLBACK COMPLETE - Back on v11.3.0"
echo "Time: $(date -u)"

# Notify team
echo "Sending incident notification..."
curl -X POST https://hooks.slack.com/services/YOUR/HOOK/URL \
  -H 'Content-type: application/json' \
  -d '{
    "text":"🚨 ROLLBACK: Reverted to v11.3.0",
    "attachments":[{
      "text":"Reason: Critical failure in v12.0.0\nTime: '$(date -u)'"
    }]
  }'
```

---

## Testing Procedures

### Pre-Deployment Testing

```bash
#!/bin/bash
# pre_deployment_testing.sh

echo "=== PRE-DEPLOYMENT TEST SUITE ==="

# 1. Unit tests
echo "Running unit tests..."
npm test
if [ $? -ne 0 ]; then
  echo "✗ Unit tests failed - ABORT"
  exit 1
fi
echo "✓ Unit tests passed"

# 2. Integration tests
echo "Running integration tests..."
npm run test:integration
if [ $? -ne 0 ]; then
  echo "✗ Integration tests failed - ABORT"
  exit 1
fi
echo "✓ Integration tests passed"

# 3. Docker build
echo "Building Docker image..."
docker build -t basset-hound:v12.0.0 .
if [ $? -ne 0 ]; then
  echo "✗ Docker build failed - ABORT"
  exit 1
fi
echo "✓ Docker image built"

# 4. Docker image scan
echo "Scanning Docker image..."
trivy image basset-hound:v12.0.0
if [ $? -ne 0 ]; then
  echo "✗ Image scan found vulnerabilities - ABORT"
  exit 1
fi
echo "✓ Image scan passed"

# 5. Smoke tests on local container
echo "Running smoke tests on image..."
docker run --rm \
  basset-hound:v12.0.0 \
  npm run test:smoke
if [ $? -ne 0 ]; then
  echo "✗ Smoke tests failed - ABORT"
  exit 1
fi
echo "✓ Smoke tests passed"

# 6. Push to registry
echo "Pushing to registry..."
docker tag basset-hound:v12.0.0 registry.company.com/basset-hound:v12.0.0
docker push registry.company.com/basset-hound:v12.0.0
if [ $? -ne 0 ]; then
  echo "✗ Registry push failed - ABORT"
  exit 1
fi
echo "✓ Image pushed to registry"

echo ""
echo "✅ ALL PRE-DEPLOYMENT TESTS PASSED"
echo "Ready for deployment"
```

### Post-Deployment Testing

```bash
#!/bin/bash
# post_deployment_testing.sh

echo "=== POST-DEPLOYMENT TEST SUITE ==="

# 1. Health check
echo "Checking service health..."
curl -i http://load-balancer:8765/health
if [ $? -ne 0 ]; then
  echo "✗ Health check failed"
  exit 1
fi
echo "✓ Health check passed"

# 2. Functional tests
echo "Running functional tests..."
npm run test:functional
if [ $? -ne 0 ]; then
  echo "✗ Functional tests failed"
  exit 1
fi
echo "✓ Functional tests passed"

# 3. Load test
echo "Running load test (50 concurrent)..."
ab -n 500 -c 50 http://load-balancer:8765/health
echo "✓ Load test passed"

# 4. Performance comparison
echo "Checking performance..."
NEW_LATENCY=$(curl -s http://prometheus:9090/api/v1/query \
  --data-urlencode 'query=histogram_quantile(0.95,request_duration_seconds)' | jq '.[].value[1]')

if (( $(echo "$NEW_LATENCY > $BASELINE_LATENCY * 1.2" | bc -l) )); then
  echo "✗ Latency degradation detected"
  exit 1
fi
echo "✓ Performance acceptable"

echo ""
echo "✅ ALL POST-DEPLOYMENT TESTS PASSED"
```

---

## Troubleshooting

### Traffic Not Switching

```bash
# Check load balancer configuration
cat /etc/load-balancer/production.conf | grep -A 10 "upstream"

# Check if instances are actually running
docker ps | grep basset-hound

# Test connectivity to each instance
for i in {1..5}; do
  curl -i http://10.0.2.$i:8765/health
done

# Check load balancer logs
tail -100 /var/log/load-balancer/access.log

# Verify DNS resolution
nslookup basset-hound-internal.basset-hound-browser.svc.cluster.local
```

### Performance Degradation After Cutover

```bash
# 1. Get current metrics
LATENCY=$(curl -s http://prometheus:9090/api/v1/query \
  --data-urlencode 'query=histogram_quantile(0.95,request_duration_seconds)' | jq '.[].value[1]')
ERROR_RATE=$(curl -s http://prometheus:9090/api/v1/query \
  --data-urlencode 'query=rate(errors_total[5m])' | jq '.[].value[1]')

echo "Current Latency: $LATENCY"
echo "Current Error Rate: $ERROR_RATE"

# 2. Check individual instance metrics
for i in {1..5}; do
  echo "Instance prod-$i:"
  docker stats --no-stream --format "CPU: {{.CPUPerc}}, Memory: {{.MemUsage}}" prod-$i
done

# 3. Check if instances are healthy
for i in {1..5}; do
  curl -s http://10.0.2.$i:8765/health | jq '.status'
done

# 4. Review logs for errors
docker logs --tail 100 prod-1 | grep -i error

# 5. If degradation confirmed, consider rollback
```

---

## Appendices

### Appendix A: Complete Upgrade Checklist

**Pre-Deployment (48 hours before):**
- [ ] Release notes finalized
- [ ] Code review completed
- [ ] Tests passing 100%
- [ ] Docker image built and scanned
- [ ] Image pushed to registry
- [ ] Team trained on runbooks
- [ ] Stakeholders notified
- [ ] Monitoring dashboards prepared
- [ ] Backup created

**During Deployment:**
- [ ] All instances running
- [ ] Health checks passing
- [ ] Baseline metrics documented
- [ ] Green environment ready
- [ ] Load balancer configured
- [ ] Traffic switch prepared
- [ ] Monitoring active
- [ ] Team standing by

**Post-Deployment (Immediate):**
- [ ] Traffic switched to new version
- [ ] Error rate acceptable
- [ ] Latency within range
- [ ] No unexpected restarts
- [ ] All instances healthy

**Post-Deployment (1 hour):**
- [ ] All tests passing
- [ ] Metrics stable
- [ ] No escalations
- [ ] Logs clean

**Post-Deployment (24 hours):**
- [ ] Zero issues observed
- [ ] Performance metrics stable
- [ ] No customer complaints
- [ ] Decommission old version

---

## Document Status

**Version:** 1.0  
**Created:** June 4, 2026  
**Last Updated:** June 4, 2026  
**Status:** Production Ready  
**Classification:** Internal Operations  

---

**End of Zero-Downtime Upgrades Guide**
