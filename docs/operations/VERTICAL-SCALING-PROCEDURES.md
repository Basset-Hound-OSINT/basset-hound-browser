# Vertical Scaling Procedures

**Basset Hound Browser v12.1.0**  
**Last Updated:** June 13, 2026  
**Status:** Production Ready  
**Version:** 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [When to Use Vertical Scaling](#when-to-use-vertical-scaling)
3. [Instance Type Selection](#instance-type-selection)
4. [Pre-Scaling Preparation](#pre-scaling-preparation)
5. [Step-by-Step Scaling Procedure](#step-by-step-scaling-procedure)
6. [Zero-Downtime Migration](#zero-downtime-migration)
7. [Performance Validation](#performance-validation)
8. [Rollback Procedures](#rollback-procedures)
9. [Cost Analysis](#cost-analysis)

---

## Overview

Vertical scaling upgrades an existing instance to a larger size (more CPU cores, more memory, faster storage). This is used when a single instance reaches its resource limits and cannot serve peak load efficiently.

**Vertical Scaling Stack:**

```
Single Instance Upgrade Path:

Baseline               Moderate Growth        Heavy Growth           Enterprise
├─ t3.large          ├─ t3.xlarge          ├─ m5.2xlarge         ├─ m5.4xlarge
├─ 2 vCPU            ├─ 4 vCPU             ├─ 8 vCPU              ├─ 16 vCPU
├─ 8GB RAM           ├─ 16GB RAM           ├─ 32GB RAM            ├─ 64GB RAM
├─ $60/month         ├─ $120/month         ├─ $320/month          ├─ $640/month
└─ 300 msg/sec       └─ 600 msg/sec        └─ 1,200 msg/sec       └─ 2,400 msg/sec

Typical Path: t3.large → t3.xlarge → m5.large → m5.xlarge → m5.2xlarge
```

**Key Principle:** Vertical scaling increases resource limits per instance. Horizontal scaling (adding instances) increases total capacity through distribution.

---

## When to Use Vertical Scaling

### Decision Framework

**Use Vertical Scaling When:**

1. **Single Bottleneck Identified**
   ```
   CPU > 85% AND Memory < 70%
   → Upgrade CPU (CPU-bound workload)
   
   Memory > 85% AND CPU < 70%
   → Upgrade RAM (Memory-bound workload)
   
   Both CPU > 85% AND Memory > 85%
   → Upgrade both (balanced workload)
   ```

2. **Early Growth Phase**
   ```
   Growth pattern: Slow, predictable (20% month-over-month)
   Timeline: Scaling needed in 2-3 months
   Recommendation: Vertical first, then horizontal later
   ```

3. **Single-Purpose Instance**
   ```
   Instance serves specific function (API gateway, worker)
   Scaling is isolated to that function
   Horizontal scaling would be overkill
   ```

4. **Database Server Upgrade**
   ```
   Database becoming bottleneck
   Query performance degrading
   Connection pool exhaustion
   → Upgrade database instance type
   ```

**Do NOT Use Vertical Scaling When:**

1. **Approaching Instance Size Limit**
   ```
   Already on largest available instance type
   → Must use horizontal scaling
   ```

2. **Need High Availability**
   ```
   Cannot tolerate single instance failure
   → Use horizontal scaling (N+1 redundancy)
   ```

3. **Distributed Workload**
   ```
   Workload naturally parallelizable
   → Horizontal scaling more efficient
   ```

4. **Cost is Primary Concern**
   ```
   Horizontal: Better cost efficiency at scale
   Vertical: Diminishing returns on large instances
   ```

### Vertical vs. Horizontal Comparison

| Factor | Vertical | Horizontal |
|--------|----------|-----------|
| **Deployment Time** | 30 min - 1 hour | 1-2 hours |
| **Downtime Risk** | Medium (stop/restart) | Low (gradual rollout) |
| **Cost Growth** | Exponential | Linear |
| **Availability** | No N+1 | N+1 possible |
| **Capacity Growth** | Limited by largest instance | Unlimited (add more) |
| **Complexity** | Low | Medium-high |
| **Network Bandwidth** | Increases with size | Distributes across instances |
| **Database Load** | All on one instance | Distributed if replicated |
| **When to Use** | Early growth, single bottleneck | Mid-to-late growth, high availability |

---

## Instance Type Selection

### AWS Instance Type Hierarchy

**General Purpose (t3, m5, m6 family):**

```
t3.large    → 2 vCPU, 8GB   → $60/month   → Baseline
t3.xlarge   → 4 vCPU, 16GB  → $120/month  → 2x capacity
t3.2xlarge  → 8 vCPU, 32GB  → $240/month  → 4x capacity

m5.large    → 2 vCPU, 8GB   → $100/month  → Sustained workload
m5.xlarge   → 4 vCPU, 16GB  → $200/month  → 2x capacity
m5.2xlarge  → 8 vCPU, 32GB  → $320/month  → 4x capacity
m5.4xlarge  → 16 vCPU, 64GB → $640/month  → 8x capacity
m5.8xlarge  → 32 vCPU, 128GB → $1,280/mo  → 16x capacity
```

**Compute Optimized (c5, c6 family):**

```
c5.large    → 2 vCPU, 4GB   → $80/month   → CPU-intensive
c5.xlarge   → 4 vCPU, 8GB   → $170/month  → High throughput
c5.2xlarge  → 8 vCPU, 16GB  → $340/month  → Heavy compute
c5.4xlarge  → 16 vCPU, 32GB → $680/month  → Extreme compute
```

**Memory Optimized (r5, r6 family):**

```
r5.large    → 2 vCPU, 16GB  → $150/month  → Memory-intensive
r5.xlarge   → 4 vCPU, 32GB  → $300/month  → 2x memory
r5.2xlarge  → 8 vCPU, 64GB  → $600/month  → 4x memory
r5.4xlarge  → 16 vCPU, 128GB → $1,200/mo  → 8x memory
```

### Selection Criteria

**Step 1: Identify Current Bottleneck**

```javascript
// Collect metrics
const metrics = {
  cpu_usage: 85,        // High - bottleneck?
  memory_usage: 45,     // Medium - not bottleneck
  network_io: 200Mbps,  // Medium - not bottleneck
  disk_io: 50MB/s       // Low - not bottleneck
};

// Analysis
if (metrics.cpu_usage > 80 && metrics.memory_usage < 70) {
  recommendation = 'CPU-optimized instance';
  // Recommendation: c5.xlarge (more CPU cores)
} else if (metrics.memory_usage > 80 && metrics.cpu_usage < 60) {
  recommendation = 'Memory-optimized instance';
  // Recommendation: r5.xlarge (more RAM)
} else if (metrics.cpu_usage > 75 && metrics.memory_usage > 75) {
  recommendation = 'General-purpose instance';
  // Recommendation: m5.2xlarge (balanced upgrade)
}
```

**Step 2: Project Growth**

```
Current Usage:     CPU 85%, Memory 45%
Monthly Growth:    +5% CPU, +3% Memory
Months to Capacity: CPU exhausted in 3 months

Upgrade Option 1: t3.2xlarge (8 vCPU)
├─ Cost: $240/month (+$120)
├─ Headroom: ~3 months at current growth
└─ When to use: Short-term band-aid

Upgrade Option 2: m5.xlarge (4 vCPU + 16GB)
├─ Cost: $200/month (+$80)
├─ Headroom: ~6 months
└─ When to use: Moderate growth, balanced

Upgrade Option 3: m5.2xlarge (8 vCPU + 32GB)
├─ Cost: $320/month (+$200)
├─ Headroom: ~12+ months
└─ When to use: Rapid growth, plan horizontal next
```

**Step 3: Consider Database Impact**

```
Current Database Load:
├─ Connection pool: 50/100 utilized
├─ Query latency: 15ms p95
├─ Disk I/O: 30%

Upgrade Impact:
├─ More application instances? → No (vertical, single instance)
├─ More connections? → Possibly (slightly more concurrent users)
├─ Faster queries? → No (DB tier unchanged)
├─ Connection pool increase needed? → Maybe from 50 to 60-70

Action: Slight increase to connection pool (50 → 75 max)
```

### Recommended Upgrade Paths

**For WebSocket Server (Basset Hound):**

```
Path 1: Conservative (Low growth)
├─ t3.large (current)
├─ t3.xlarge (1-2 months)
├─ t3.2xlarge (3-4 months)
└─ m5.xlarge or m5.large + horizontal scaling

Path 2: Moderate (Medium growth, 20-35% monthly)
├─ t3.large (current)
├─ m5.xlarge (1-2 months)
└─ m5.2xlarge + start horizontal scaling

Path 3: Aggressive (Rapid growth, 50%+ monthly)
├─ t3.large (current)
├─ m5.2xlarge (immediately)
└─ Add load balancer + horizontal instances (month 1-2)
```

**For Database (PostgreSQL):**

```
Path: Database Specific
├─ db.t3.medium (current, dev)
├─ db.m5.large (production)
├─ db.m5.xlarge (heavy load)
├─ db.m5.2xlarge (very heavy)
└─ Consider read replicas after m5.xlarge

Note: Always add read replicas first before vertical scaling DB
```

---

## Pre-Scaling Preparation

### 1-Week Before Scaling

**Infrastructure Readiness:**

```bash
# Verify backup exists and is recent
aws s3 ls s3://basset-backups/
# Should show backup from <24 hours ago

# Verify database integrity
psql -h db-host -U basset -d basset -c \
  "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database WHERE datname = 'basset_hound';"

# Verify disk space on source instance
df -h /
# Ensure >50GB free for potential temp files

# Verify network connectivity
ping -c 3 db-host
ping -c 3 redis-host
```

**Monitoring Readiness:**

```bash
# Verify Prometheus collecting metrics
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length'

# Verify Grafana dashboards accessible
curl -s http://localhost:3000/api/search | jq '.[] | {title, id}'

# Test alert notification
curl -s http://localhost:9093/api/v1/status | jq '.status'
```

**Team Communication:**

- [ ] Scheduled maintenance window (30 min - 1 hour)
- [ ] Notified team members
- [ ] Customer notification drafted (if needed)
- [ ] On-call engineer assigned
- [ ] Escalation path documented
- [ ] Rollback procedure reviewed
- [ ] War room Zoom link ready

### Configuration Changes Needed

**1. Update Application Configuration**

```javascript
// config/production.json
{
  "basset": {
    "port": 8765,
    "instance_type": "m5.xlarge",  // NEW
    "max_connections": 500,         // Increase from 300
    "memory_limit": 12000,          // MB (increased)
    "gc_interval": 60000,           // More aggressive GC possible
    "cache_size": 500,              // MB (can increase)
    
    "database": {
      "pool": {
        "min": 10,
        "max": 100,  // Increase from 75
        "idleTimeoutMillis": 30000
      }
    },
    
    "redis": {
      "pool": {
        "min": 5,
        "max": 100,  // Can increase
        "idleTimeoutMillis": 30000
      }
    }
  }
}
```

**2. Increase Database Connection Pool**

```sql
-- PostgreSQL configuration
ALTER SYSTEM SET max_connections = 300;  -- From 200

-- Apply immediately (with reload)
SELECT pg_reload_conf();

-- Verify
SHOW max_connections;
```

**3. Update Monitoring Thresholds**

```yaml
# Prometheus rules (alerting-rules.yaml)
groups:
  - name: basset_alerts
    rules:
      - alert: HighCPUUsage
        expr: node_cpu_seconds_total > 75
        for: 5m
        annotations:
          summary: "CPU usage high on {{ $labels.instance }}"
          # Previous: >85%, now >75% gives earlier warning
```

**4. Document System Changes**

```bash
# Create pre-scaling snapshot
cat > /tmp/pre-scaling-snapshot.txt << EOF
Date: $(date)
Instance Type: $(ec2-metadata --instance-type)
Instance ID: $(ec2-metadata --instance-id)
Region: $(ec2-metadata --availability-zone)
CPU Cores: $(nproc)
Memory (MB): $(free -m | awk 'NR==2{print $2}')
Disk Usage: $(df -h / | tail -1)
Uptime: $(uptime)
Running Processes: $(ps aux | wc -l)
Network Connections: $(netstat -an | wc -l)
Load Average: $(uptime | awk -F'load average:' '{print $2}')
EOF

# Store for comparison after scaling
scp /tmp/pre-scaling-snapshot.txt ubuntu@backup-host:/backups/
```

---

## Step-by-Step Scaling Procedure

### Phase 1: Pre-Scaling Validation (15 minutes)

**Step 1.1: Verify Current Metrics**

```bash
#!/bin/bash
# Capture baseline metrics

echo "=== PRE-SCALING METRICS SNAPSHOT ==="
echo "Timestamp: $(date)"

echo -e "\n=== CPU Usage ==="
top -bn1 | grep "Cpu(s)" | awk '{print "Usage: " $2}'

echo -e "\n=== Memory Usage ==="
free -h | awk 'NR==2 {printf "Used: %s / %s (%.1f%%)\n", $3, $2, ($3/$2)*100}'

echo -e "\n=== Disk Usage ==="
df -h / | tail -1 | awk '{printf "Used: %s / %s (%.0f%%)\n", $3, $2, ($3/$2)*100}'

echo -e "\n=== Active Connections ==="
netstat -an | grep ESTABLISHED | wc -l

echo -e "\n=== Database Connections ==="
psql -h db-host -U basset -d basset -c "SELECT count(*) FROM pg_stat_activity;"

echo -e "\n=== Application Health ==="
curl -s http://localhost:8765/health | jq '.'

echo -e "\n=== Latency Metrics ==="
curl -s http://localhost:9090/api/v1/query?query='p99_latency_ms' | jq '.data.result[0].value'

# Save output
echo -e "\n=== Saved to /tmp/pre-scaling-baseline.json ==="
```

**Step 1.2: Verify Backup Exists**

```bash
# Ensure latest backup is recent
LATEST_BACKUP=$(aws s3 ls s3://basset-backups/db/ --recursive | sort | tail -1 | awk '{print $4}')
echo "Latest backup: $LATEST_BACKUP"

# Get backup age
BACKUP_AGE=$(aws s3api head-object --bucket basset-backups --key "$LATEST_BACKUP" \
  --query 'LastModified' --output text)
echo "Backup time: $BACKUP_AGE"

# Verify backup is <24 hours old
AGE_HOURS=$(( ($(date +%s) - $(date -d "$BACKUP_AGE" +%s)) / 3600 ))
if [ $AGE_HOURS -lt 24 ]; then
  echo "✓ Backup is current ($AGE_HOURS hours old)"
else
  echo "✗ BACKUP IS STALE - Create new backup before proceeding"
  exit 1
fi
```

**Step 1.3: Create Final Snapshot**

```bash
#!/bin/bash
# Create EBS snapshot for rollback

INSTANCE_ID=$(ec2-metadata --instance-id | cut -d' ' -f2)
VOLUME_ID=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].BlockDeviceMappings[0].Ebs.VolumeId' \
  --output text)

echo "Creating snapshot of volume $VOLUME_ID..."

SNAPSHOT_ID=$(aws ec2 create-snapshot \
  --volume-id $VOLUME_ID \
  --description "Pre-scaling snapshot $(date)" \
  --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Purpose,Value=Rollback}]' \
  --query 'SnapshotId' \
  --output text)

echo "Snapshot created: $SNAPSHOT_ID"
echo "Waiting for snapshot to complete..."

# Wait for snapshot (may take 10-30 minutes)
aws ec2 wait snapshot-completed --snapshot-ids $SNAPSHOT_ID
echo "✓ Snapshot complete"
```

**Step 1.4: Notify Customers (If Needed)**

```
Sample notification:

Subject: Scheduled Maintenance - June 15, 2026

We will perform a scheduled maintenance to upgrade infrastructure on:
- Date: June 15, 2026
- Time: 2:00 AM - 2:30 AM UTC
- Duration: ~30 minutes
- Impact: Service may be temporarily unavailable

Expected improvements:
- 50% increase in throughput capacity
- Reduced latency for peak load
- Improved stability during traffic spikes

We apologize for any inconvenience. If you have questions, please contact support@basset.ai
```

### Phase 2: Stop Application Gracefully (5 minutes)

**Step 2.1: Enable Maintenance Mode**

```bash
#!/bin/bash
# Signal graceful shutdown

curl -X POST http://localhost:8765/admin/shutdown-signal \
  -d '{"drain_connections": true, "timeout_seconds": 60}'

# This will:
# 1. Stop accepting new connections
# 2. Drain existing connections gracefully
# 3. Wait up to 60 seconds for existing requests to complete
# 4. Close server cleanly
```

**Step 2.2: Monitor Graceful Shutdown**

```bash
#!/bin/bash
# Wait for clean shutdown

TIMEOUT=120
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
  # Check if application still running
  if ! curl -s http://localhost:8765/health > /dev/null 2>&1; then
    echo "✓ Application shut down gracefully after $ELAPSED seconds"
    exit 0
  fi
  
  # Get active connection count
  CONNECTIONS=$(curl -s http://localhost:8765/metrics | grep -oP 'active_connections \K[0-9]+')
  echo "Active connections: $CONNECTIONS (waiting for drain...)"
  
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

# If still running after timeout, force shutdown
echo "Timeout reached, forcing shutdown"
sudo systemctl stop basset-hound-server
sleep 5
```

**Step 2.3: Verify Shutdown Complete**

```bash
# Verify no process running
pgrep -f "basset-hound" && echo "✗ Process still running" || echo "✓ Process stopped"

# Verify port released
netstat -tlnp | grep 8765 && echo "✗ Port still in use" || echo "✓ Port available"

# Verify no connections to database
psql -h db-host -U basset -d basset -c \
  "SELECT usename, COUNT(*) as connections FROM pg_stat_activity GROUP BY usename;"
```

### Phase 3: Instance Type Change (5-10 minutes)

**Option A: AWS EC2 Instance Type Change (Zero-Downtime)**

```bash
#!/bin/bash
# AWS-specific: Stop instance, change type, restart

INSTANCE_ID=$(ec2-metadata --instance-id | cut -d' ' -f2)
NEW_INSTANCE_TYPE="m5.xlarge"

echo "Stopping instance $INSTANCE_ID..."
aws ec2 stop-instances --instance-ids $INSTANCE_ID
aws ec2 wait instance-stopped --instance-ids $INSTANCE_ID
echo "✓ Instance stopped"

echo "Changing instance type to $NEW_INSTANCE_TYPE..."
aws ec2 modify-instance-attribute --instance-id $INSTANCE_ID \
  --instance-type "{\"Value\": \"$NEW_INSTANCE_TYPE\"}"
echo "✓ Instance type changed"

echo "Starting instance..."
aws ec2 start-instances --instance-ids $INSTANCE_ID
aws ec2 wait instance-running --instance-ids $INSTANCE_ID
echo "✓ Instance started"

# Wait for SSH accessibility
echo "Waiting for system ready..."
sleep 30
```

**Option B: VM Migration (Different Cloud)**

```bash
#!/bin/bash
# Create new VM with larger resources, migrate data

# 1. Create new instance with more resources
aws ec2 run-instances \
  --image-id ami-12345678 \
  --instance-type m5.xlarge \
  --subnet-id subnet-12345 \
  --security-group-ids sg-12345 \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=basset-hound-new}]'

# 2. Attach same volumes or copy data
# ... (volume attach or data copy procedure)

# 3. Start application
# ... (see "Phase 4: Start Application")

# 4. Verify
# ... (see "Phase 5: Validation")

# 5. Update DNS/routing to point to new instance
# ... (update load balancer or DNS)

# 6. Decommission old instance
aws ec2 terminate-instances --instance-ids i-12345678
```

### Phase 4: Verify System Resources (5 minutes)

**Step 4.1: Verify Instance Resize**

```bash
#!/bin/bash
# Confirm new instance type is in effect

echo "=== Verifying New Instance Type ==="

# Check reported CPU cores
CPUS=$(nproc)
echo "CPU Cores: $CPUS"

# Check available memory
MEM=$(free -h | awk 'NR==2 {print $2}')
echo "Memory: $MEM"

# Check instance metadata
INSTANCE_TYPE=$(curl -s http://169.254.169.254/latest/meta-data/instance-type)
echo "Instance Type: $INSTANCE_TYPE"

# Expected outputs for m5.xlarge:
# CPU Cores: 4
# Memory: 15-16G
# Instance Type: m5.xlarge

if [ "$CPUS" = "4" ] && [ "$INSTANCE_TYPE" = "m5.xlarge" ]; then
  echo "✓ Instance type change successful"
else
  echo "✗ Instance type verification failed"
  exit 1
fi
```

**Step 4.2: Verify Disk Space**

```bash
# Ensure sufficient disk space after resize
df -h /

# Expected: No change to disk space (same volume)
# Should still have >50GB free
```

**Step 4.3: Verify Network**

```bash
# Test connectivity to dependencies
echo "Testing database connectivity..."
timeout 3 bash -c "echo >/dev/tcp/db-host/5432" && echo "✓ DB reachable" || echo "✗ DB unreachable"

echo "Testing Redis connectivity..."
redis-cli -h redis-host ping > /dev/null && echo "✓ Redis reachable" || echo "✗ Redis unreachable"

echo "Testing monitoring..."
curl -s http://localhost:9090/health > /dev/null && echo "✓ Prometheus reachable" || echo "✗ Prometheus unreachable"
```

### Phase 5: Start Application (5 minutes)

**Step 5.1: Update Configuration (If Needed)**

```bash
# Apply configuration changes from pre-scaling prep
scp config/production.json ubuntu@instance:/app/config/
```

**Step 5.2: Start Application Service**

```bash
#!/bin/bash
# Start Basset Hound application

echo "Starting Basset Hound application..."

# Option 1: systemd (if installed)
sudo systemctl start basset-hound-server

# Option 2: Docker container
docker run -d \
  --name basset-hound-server \
  -p 8765:8765 \
  -e REDIS_HOST=redis-host \
  -e DB_HOST=db-host \
  -e ENVIRONMENT=production \
  basset-hound-browser:v12.1.0

# Wait for startup
sleep 10

# Verify running
docker ps | grep basset-hound-server
```

**Step 5.3: Monitor Startup**

```bash
#!/bin/bash
# Monitor application startup for issues

TIMEOUT=60
ELAPSED=0
STARTUP_LOG="/tmp/startup.log"

echo "Monitoring startup..."

while [ $ELAPSED -lt $TIMEOUT ]; do
  # Try to connect
  if curl -s http://localhost:8765/health > /dev/null 2>&1; then
    echo "✓ Application responsive"
    break
  fi
  
  echo "Waiting for startup ($ELAPSED/$TIMEOUT seconds)..."
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

# Check logs for errors
if [ -f "$STARTUP_LOG" ]; then
  echo -e "\n=== Application Startup Log ==="
  tail -20 "$STARTUP_LOG"
fi
```

### Phase 6: Validation (15 minutes)

**Step 6.1: Health Check**

```bash
#!/bin/bash
# Comprehensive health check

echo "=== HEALTH CHECK ==="

# 1. Application health endpoint
echo -n "Application health: "
curl -s http://localhost:8765/health | jq '.status'

# 2. Database connectivity
echo -n "Database connectivity: "
if curl -s http://localhost:8765/db-health | jq '.database' | grep -q "ok"; then
  echo "OK"
else
  echo "FAILED"
  exit 1
fi

# 3. Redis connectivity
echo -n "Redis connectivity: "
if curl -s http://localhost:8765/db-health | jq '.redis' | grep -q "ok"; then
  echo "OK"
else
  echo "FAILED - non-critical, continue"
fi

# 4. Memory usage
echo -n "Memory utilization: "
MEM_PERCENT=$(curl -s http://localhost:8765/metrics | \
  grep -oP 'memory_usage_percent \K[0-9.]+')
echo "${MEM_PERCENT}%"

# 5. Request latency
echo -n "P99 latency: "
curl -s http://localhost:8765/metrics | \
  grep -oP 'p99_latency_ms \K[0-9.]+' | head -1
echo " ms"
```

**Step 6.2: Compare Pre/Post Metrics**

```bash
#!/bin/bash
# Capture post-scaling metrics and compare

echo "=== POST-SCALING METRICS ==="
cat > /tmp/post-scaling-snapshot.txt << EOF
Date: $(date)
Instance Type: $(ec2-metadata --instance-type)
CPU Cores: $(nproc)
Memory (MB): $(free -m | awk 'NR==2{print $2}')
Uptime: $(uptime -p)
Load Average: $(uptime | awk -F'load average:' '{print $2}')
Active Connections: $(netstat -an | grep ESTABLISHED | wc -l)
EOF

echo "Comparing metrics..."
diff -u /tmp/pre-scaling-snapshot.txt /tmp/post-scaling-snapshot.txt || echo "Changes expected"

# Should see:
# - Same disk/memory size (no system changes)
# - More CPU cores
# - Higher active connection capacity
```

**Step 6.3: Load Test**

```bash
#!/bin/bash
# Verify upgraded instance can handle more load

echo "Starting load test on upgraded instance..."

# Tool: Apache Bench, Hey, or Siege
ab -n 10000 -c 200 http://localhost:8765/test

# Expected improvements over pre-scaling:
# - Higher throughput (requests/sec)
# - Similar or better latency
# - No errors
# - CPU usage not excessive (<75%)

# Sample output:
# Requests per second: 600+ (was 300)
# Time per request: 333ms
# Successful requests: 10000
# Failed requests: 0
```

---

## Zero-Downtime Migration

### Approach 1: Read Replica Switchover (Recommended for Database)

**For PostgreSQL Database Upgrade:**

```
Step 1: Create read replica of original database
Step 2: Let replica catch up with replication lag <1ms
Step 3: Promote replica to primary
Step 4: Update application connection string
Step 5: Decommission old primary
```

```bash
#!/bin/bash
# AWS RDS: Create read replica and promote

# 1. Create read replica
aws rds create-db-instance-read-replica \
  --db-instance-identifier basset-hound-replica \
  --source-db-instance-identifier basset-hound-primary \
  --db-instance-class db.m5.xlarge

# 2. Wait for replica to be available
aws rds wait db-instance-available --db-instance-identifier basset-hound-replica

# 3. Check replication lag
aws rds describe-db-instances \
  --db-instance-identifier basset-hound-replica \
  --query 'DBInstances[0].StatusInfos[0].Message'

# 4. Promote replica to primary
aws rds promote-read-replica \
  --db-instance-identifier basset-hound-replica \
  --backup-retention-period 30

# 5. Update application connection
# Update DB_HOST in environment variables to point to new primary
export DB_HOST=basset-hound-replica.c9akciq32.us-east-1.rds.amazonaws.com

# 6. Restart application
systemctl restart basset-hound-server

# 7. Delete old primary (keep snapshot first!)
aws ec2 create-snapshot --volume-id vol-12345678
aws rds delete-db-instance \
  --db-instance-identifier basset-hound-primary \
  --skip-final-snapshot
```

### Approach 2: Blue-Green Deployment

**For WebSocket Server Upgrade:**

```
Step 1: Set up new instance (green) with larger resources
Step 2: Deploy application to green instance
Step 3: Run health checks on green
Step 4: Gradually shift traffic from blue to green
Step 5: Monitor for issues
Step 6: Decommission blue instance if successful
```

```bash
#!/bin/bash
# Blue-Green deployment for zero downtime

# Colors:
# Blue = Original instance (running)
# Green = New instance (being prepared)

BLUE_IP="10.0.1.100"
GREEN_IP="10.0.1.101"

echo "=== BLUE-GREEN DEPLOYMENT ==="

# Step 1: Provision green instance (already done in Phase 2)
echo "Green instance: $GREEN_IP"

# Step 2: Deploy to green
echo "Deploying to green..."
ssh ubuntu@$GREEN_IP << 'EOF'
  docker pull basset-hound-browser:v12.1.0
  docker run -d \
    --name basset-hound \
    -p 8765:8765 \
    basset-hound-browser:v12.1.0
EOF

# Step 3: Health check on green
echo "Health checking green..."
for i in {1..10}; do
  if curl -s http://$GREEN_IP:8765/health > /dev/null; then
    echo "✓ Green instance healthy"
    break
  fi
  echo "Waiting for green... ($i/10)"
  sleep 5
done

# Step 4: Gradually shift traffic (load balancer)
echo "Shifting traffic from blue to green..."
# Update load balancer to send 10% traffic to green
curl -X POST http://localhost:9090/admin/weight-update \
  -d "{\"backend\": \"$GREEN_IP\", \"weight\": 1, \"total_weight\": 10}"

# Monitor for issues
sleep 60

# If all good, shift more
curl -X POST http://localhost:9090/admin/weight-update \
  -d "{\"backend\": \"$GREEN_IP\", \"weight\": 9, \"total_weight\": 10}"

sleep 60

# Final: 100% to green
curl -X POST http://localhost:9090/admin/weight-update \
  -d "{\"backend\": \"$GREEN_IP\", \"weight\": 10, \"total_weight\": 10}"

# Step 5: Monitor
echo "Monitoring for 5 minutes..."
for i in {1..5}; do
  curl -s http://localhost:9090/metrics | grep error_rate
  sleep 60
done

# Step 6: Decommission blue if all good
echo "Decommissioning blue instance..."
ssh ubuntu@$BLUE_IP "docker stop basset-hound-server && docker rm basset-hound-server"

echo "✓ Blue-Green deployment complete"
```

---

## Performance Validation

### Post-Scaling Benchmarks

**Expected Improvements (Baseline: t3.large → Target: m5.xlarge):**

```
Metric              t3.large    m5.xlarge   Improvement
────────────────────────────────────────────────────────
CPU Cores           2           4           2x
Memory              8GB         16GB        2x
Baseline Throughput 300 msg/s   600 msg/s   2x
Latency P99         100ms       90ms        -10%
Connections         500         1,000       2x
Database Conn Pool  50/100      100/200     2x
Cost                $120/mo     $200/mo     +67%
```

**Validation Procedure:**

```bash
#!/bin/bash
# Comprehensive performance validation

echo "=== POST-SCALING PERFORMANCE VALIDATION ==="

# 1. Baseline throughput test
echo "Testing throughput..."
ab -n 10000 -c 100 http://localhost:8765/test 2>&1 | grep -E "(Requests per second|Concurrency Level|Time per request)"

# 2. Load test at capacity
echo "Testing at higher load..."
ab -n 20000 -c 300 http://localhost:8765/test 2>&1 | grep -E "(Requests per second|Failed requests)"

# 3. Latency percentiles
echo "Checking latency percentiles..."
curl -s http://localhost:8765/metrics | grep -E "(p50_latency|p95_latency|p99_latency)"

# 4. Memory under load
echo "Checking memory stability..."
free -h | awk 'NR==2 {print "Memory usage: " $3 " / " $2}'

# 5. CPU under load
echo "Checking CPU utilization..."
top -bn1 | grep "Cpu(s)"

# 6. Error rate
echo "Checking error rate..."
curl -s http://localhost:8765/metrics | grep error_rate

# Expected results:
# ✓ Throughput 2x of pre-scaling
# ✓ Latency same or better
# ✓ No errors under load
# ✓ CPU <70% under load
# ✓ Memory stable
```

---

## Rollback Procedures

### When to Rollback

**Immediate Rollback Triggers:**

```
Condition 1: Application won't start
├─ Symptom: /health endpoint returns 503
├─ Duration: >5 minutes
└─ Action: Revert to previous instance type

Condition 2: High error rate
├─ Symptom: Error rate > 1%
├─ Duration: >3 minutes
└─ Action: Revert to previous instance type

Condition 3: Out of memory crashes
├─ Symptom: OOM killer, repeated crashes
├─ Duration: Immediate
└─ Action: Revert and increase swap/memory

Condition 4: Severe latency degradation
├─ Symptom: P99 latency > 500ms
├─ Duration: >5 minutes
└─ Action: Investigate before reverting
```

### Rollback Steps

**Quick Rollback (5-10 minutes):**

```bash
#!/bin/bash
# Revert to previous instance type

INSTANCE_ID=$(ec2-metadata --instance-id | cut -d' ' -f2)
ORIGINAL_TYPE="t3.large"  # Previous type

echo "ROLLBACK: Reverting instance type..."

# Step 1: Gracefully stop application
curl -X POST http://localhost:8765/admin/shutdown-signal \
  -d '{"drain_connections": true, "timeout_seconds": 30}' || true

# Step 2: Stop instance
aws ec2 stop-instances --instance-ids $INSTANCE_ID
aws ec2 wait instance-stopped --instance-ids $INSTANCE_ID

# Step 3: Change back to original type
aws ec2 modify-instance-attribute --instance-id $INSTANCE_ID \
  --instance-type "{\"Value\": \"$ORIGINAL_TYPE\"}"

# Step 4: Start instance
aws ec2 start-instances --instance-ids $INSTANCE_ID
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Step 5: Verify startup
sleep 30
curl -s http://localhost:8765/health | jq '.status'

echo "✓ Rollback complete - running on $ORIGINAL_TYPE"
```

**From Backup (If Disaster):**

```bash
#!/bin/bash
# Restore from EBS snapshot if instance is corrupted

INSTANCE_ID=$(ec2-metadata --instance-id | cut -d' ' -f2)
SNAPSHOT_ID="snap-12345678"  # Pre-scaling snapshot

echo "DISASTER RECOVERY: Restoring from snapshot..."

# Step 1: Terminate failed instance
aws ec2 terminate-instances --instance-ids $INSTANCE_ID

# Step 2: Create volume from snapshot
VOLUME_ID=$(aws ec2 create-volume \
  --snapshot-id $SNAPSHOT_ID \
  --availability-zone us-east-1a \
  --query 'VolumeId' \
  --output text)

# Step 3: Create new instance with original type
aws ec2 run-instances \
  --image-id ami-12345678 \
  --instance-type t3.large \
  --subnet-id subnet-12345 \
  --security-group-ids sg-12345

# Step 4: Attach volume
# (Instance must be stopped first)

# Step 5: Start and verify
# (Full startup procedure - see Phase 5)

echo "✓ Restored from snapshot"
```

---

## Cost Analysis

### Cost Comparison

**Monthly Costs by Instance Type:**

```
Instance Type    vCPU  Memory   Price/month   Throughput (msg/s)   Cost per msg
─────────────────────────────────────────────────────────────────────────────
t3.large         2     8GB      $60           300                  $0.20/million
t3.xlarge        4     16GB     $120          600                  $0.17/million
t3.2xlarge       8     32GB     $240          1,000                $0.24/million
m5.large         2     8GB      $100          400                  $0.25/million
m5.xlarge        4     16GB     $200          800                  $0.25/million
m5.2xlarge       8     32GB     $320          1,500                $0.21/million
```

**Upgrade Path Economics:**

```
Scenario 1: t3.large → m5.xlarge
├─ Cost increase: $120 → $200 = +$80/month
├─ Throughput increase: 300 → 800 = +167%
├─ Cost per request: $0.20 → $0.25 = +25% (reasonable given 2.67x throughput)
└─ Recommendation: Good value

Scenario 2: t3.large → t3.2xlarge → m5.xlarge
├─ Cost increase: $120 → $240 → $200 = $80/month total
├─ Timeline: Spread over 6 months
├─ Throughput increase: 300 → 1,000 → 800 = temporary peak then stability
└─ Recommendation: If growth is slow, wait for 3-month plateau

Scenario 3: t3.large → m5.2xlarge (skip m5.xlarge)
├─ Cost increase: $120 → $320 = +$200/month
├─ Throughput increase: 300 → 1,500 = +400%
├─ Timeline: Buy 12 months of growth
└─ Recommendation: Only if aggressive growth expected
```

---

## Checklist

### Pre-Scaling
- [ ] Current metrics captured
- [ ] Backup created and verified
- [ ] EBS snapshot created
- [ ] Configuration changes staged
- [ ] Database connection pool increased
- [ ] Monitoring alerts adjusted
- [ ] Team notified
- [ ] Rollback procedure tested
- [ ] War room ready

### During Scaling
- [ ] Graceful shutdown completed
- [ ] Application stopped successfully
- [ ] Instance type changed
- [ ] System resources verified
- [ ] Application started cleanly
- [ ] Health checks passing
- [ ] Load test successful
- [ ] Performance improved

### Post-Scaling
- [ ] Metrics compared (pre vs post)
- [ ] Customer notification sent
- [ ] Documentation updated
- [ ] Lessons learned documented
- [ ] Cost impact reviewed
- [ ] Schedule next scaling review
- [ ] Celebrate! 🎉

---

**Document Version:** 1.0.0  
**Last Updated:** June 13, 2026  
**Next Review:** June 27, 2026 (2 weeks)  
**Owner:** Infrastructure / DevOps Team
