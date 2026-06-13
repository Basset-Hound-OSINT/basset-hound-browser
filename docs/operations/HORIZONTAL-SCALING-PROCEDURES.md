# Horizontal Scaling Procedures

**Basset Hound Browser v12.1.0**  
**Last Updated:** June 13, 2026  
**Status:** Production Ready  
**Version:** 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Step-by-Step Scaling Procedure](#step-by-step-scaling-procedure)
5. [Load Balancer Configuration](#load-balancer-configuration)
6. [Session Affinity & Consistency](#session-affinity--consistency)
7. [Health Checks & Monitoring](#health-checks--monitoring)
8. [Rollback Procedures](#rollback-procedures)
9. [Troubleshooting](#troubleshooting)

---

## Overview

Horizontal scaling adds additional WebSocket server instances behind a load balancer to distribute traffic and increase capacity. This is the primary scaling approach for handling growth.

**When to Use Horizontal Scaling:**
- Active connections exceeded: >1,000 (capacity is 8,000+ per instance)
- Throughput limited: Peak load >500 msgs/sec
- Need to maintain low latency: Each instance handles ~100-300 msgs/sec
- High availability required: N+1 redundancy
- Geographic distribution needed: Multiple regions

**When NOT to Use:**
- Memory or CPU utilization is the bottleneck (use vertical scaling)
- Database is the bottleneck (add replicas, optimize queries)
- Single-threaded workload (vertical scaling better)

### Horizontal Scaling Benefits

```
Single Instance Baseline:
├─ Capacity: ~500 msgs/sec at low latency
├─ Availability: Single point of failure
├─ Cost: $120/month
└─ Scaling limit: ~1GB memory, 100% CPU

With 3 Instances + Load Balancer:
├─ Capacity: ~1,500 msgs/sec at low latency
├─ Availability: 2-node failure tolerance
├─ Cost: $360 + $25 LB = $385/month (+220%)
├─ Scaling to N instances: ~500N msgs/sec
├─ Linear cost growth: Scalable economics
└─ Availability: Approaches 99.99% uptime (with proper setup)
```

---

## Architecture

### Distributed System Topology

```
┌──────────────────────────────────────────────────────────┐
│                    Load Balancer                          │
│              (Round-Robin / Sticky Sessions)              │
│                    (Port 8765)                            │
└──────────────────────────────────────────────────────────┘
         │                    │                    │
         │                    │                    │
   ┌─────▼──────┐    ┌──────▼──────┐   ┌─────────▼─────┐
   │ Instance 1  │    │ Instance 2  │   │  Instance 3   │
   │ Port 9001   │    │ Port 9002   │   │  Port 9003    │
   │             │    │             │   │               │
   │ Redis:6379  │───┬│ Redis:6379  │───┼─ Redis:6379   │
   │ DB Pool     │   │             │   │ DB Pool        │
   └─────────────┘   └─────────────┘   └────────────────┘
         │                    │                    │
         └────────────────────┴────────────────────┘
                     │
         ┌───────────┴───────────┐
         │   Shared Resources    │
         ├───────────────────────┤
         │ Redis Sentinel Stack  │
         │ PostgreSQL Database   │
         │ Monitoring/Logging    │
         └───────────────────────┘
```

### Data Flow

```
Client Request (WebSocket)
       │
       ▼
Load Balancer
├─ Route to instance based on algorithm
├─ Sticky session: Same connection → Same instance
└─ Health check: Remove unhealthy instances
       │
       ▼
WebSocket Instance
├─ Process command
├─ Access shared Redis cache
├─ Query PostgreSQL database
└─ Return response
       │
       ▼
Client Response
```

### Load Balancing Algorithms

**Round-Robin (Default):**
```
Request 1 → Instance 1
Request 2 → Instance 2
Request 3 → Instance 3
Request 4 → Instance 1
...
```
✓ Simple, fair distribution  
✗ Ignores instance load  

**Least Connections:**
```
Route to instance with fewest active connections
```
✓ Adapts to actual load  
✗ Slightly more overhead  

**Sticky Sessions (Affinity):**
```
WebSocket connection → Same instance (24-hour TTL)
Ensures: Session state consistency, faster response
```
✓ Better performance  
✗ Less load balancing effectiveness  

**Recommended:** Sticky sessions enabled (for WebSocket connections)

---

## Prerequisites

### Infrastructure Requirements

1. **Load Balancer Ready**
   - [ ] Load balancer deployed and configured
   - [ ] Listening on port 8765
   - [ ] Health check endpoint available
   - [ ] TLS certificates configured (if needed)

2. **Shared Services Ready**
   - [ ] Redis Sentinel running (for session sharing)
   - [ ] PostgreSQL accessible from all instances
   - [ ] Database replication configured (read replicas)
   - [ ] Monitoring/logging aggregation ready

3. **Network Ready**
   - [ ] All instances on same network/VPC
   - [ ] Security groups allow inter-instance communication
   - [ ] Firewall rules allow LB → instances
   - [ ] DNS/hostnames configured

4. **Basset Hound Installation**
   - [ ] Application code ready to deploy
   - [ ] Configuration files prepared
   - [ ] Docker image available (or installable)
   - [ ] Environment variables defined

### Team Readiness

- [ ] Scaling runbook reviewed
- [ ] Team trained on horizontal scaling
- [ ] On-call engineer available
- [ ] Rollback procedure tested
- [ ] Monitoring dashboard active
- [ ] Communication channels open (Slack, email)

### Pre-Scaling Checklist

- [ ] Current metrics snapshot taken
- [ ] Baseline performance documented
- [ ] Disk space available for new instances
- [ ] Network bandwidth adequate
- [ ] Database connection pool increased (if needed)
- [ ] Redis cluster has capacity
- [ ] Cost impacts calculated
- [ ] Change ticket created
- [ ] Maintenance window scheduled (if downtime needed)
- [ ] Rollback plan documented

---

## Step-by-Step Scaling Procedure

### Phase 1: Planning & Preparation (30 minutes)

**Step 1.1: Determine Target Instance Count**

```
Current Load: X msgs/sec
Capacity per Instance: ~300 msgs/sec (at low latency)
Target Load: Y msgs/sec (peak load × 1.5 for headroom)

Required Instances = CEILING(Y / 300)
Recommended Instances = Required + 1 (for N+1 redundancy)

Example:
├─ Current load: 400 msgs/sec
├─ Capacity per instance: 300 msgs/sec
├─ Current instances: 2 (can handle 600)
├─ Peak load: 900 msgs/sec
├─ Target: 900 × 1.5 = 1,350 msgs/sec
├─ Required instances: CEILING(1,350/300) = 5
└─ Recommended: 5 instances
```

**Step 1.2: Calculate Resource Needs**

```
Per Instance Requirements:
├─ Compute: 4 vCPU, 16GB RAM (t3.xlarge or m5.large)
├─ Storage: 50GB (OS + logs + temp)
├─ Network: 100Mbps average, 1Gbps peak
└─ Database Connections: 20-50 per instance (100 total for 5 instances)

Example for 5 instances:
├─ Compute: 20 vCPU, 80GB RAM
├─ Storage: 250GB total
├─ Database connections: 100 (ensure pool allows)
└─ Estimated cost: 5 × $120/month = $600/month
```

**Step 1.3: Verify Prerequisites**

```bash
# Check load balancer status
curl -s http://lb-health:8765/health | jq .

# Check database connectivity
psql -h db-host -U basset -d basset -c "SELECT version();"

# Check Redis connectivity
redis-cli -h redis-host ping

# Check disk space on new instances
df -h / /var /opt

# Check network throughput
speedtest --simple

# Verify ports available (9001, 9002, 9003, etc.)
netstat -tlnp | grep -E "(900[1-9]|8765)"
```

**Step 1.4: Increase Database Connection Pool**

```javascript
// db-pool.js configuration
const dbPool = new DbPool({
  host: 'db-host',
  minConnections: 20,  // Increase if needed
  maxConnections: 100 + (new_instances * 20),  // e.g., 100 + 100 = 200
  // ... other config
});
```

**Step 1.5: Prepare Monitoring Dashboard**

```
Create/update Grafana dashboard showing:
├─ Load balancer request distribution (per instance)
├─ Per-instance CPU, memory, network
├─ Request latency per instance
├─ Error rate per instance
├─ Health check status per instance
├─ Redis/DB metrics per instance
└─ Total system capacity utilization
```

### Phase 2: Infrastructure Setup (1-2 hours)

**Step 2.1: Provision New Instances**

```bash
#!/bin/bash
# Script: provision-new-instances.sh

# Configuration
NEW_INSTANCES=3
INSTANCE_TYPE="t3.xlarge"
IMAGE="basset-hound-browser:v12.1.0"
VPC_ID="vpc-12345"
SUBNET_ID="subnet-12345"
SECURITY_GROUP_ID="sg-12345"

# Create instances
for i in $(seq 1 $NEW_INSTANCES); do
  INSTANCE_PORT=$((9000 + $i))
  INSTANCE_NAME="basset-hound-$i"
  
  echo "Creating instance: $INSTANCE_NAME"
  
  # AWS example
  aws ec2 run-instances \
    --image-id ami-12345678 \
    --instance-type $INSTANCE_TYPE \
    --subnet-id $SUBNET_ID \
    --security-group-ids $SECURITY_GROUP_ID \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]"
done

echo "Instances provisioned, waiting for startup..."
sleep 120
```

**Step 2.2: Install Application on New Instances**

```bash
#!/bin/bash
# Script: install-basset-hound.sh

INSTANCES=("instance-1-ip" "instance-2-ip" "instance-3-ip")
DOCKER_IMAGE="basset-hound-browser:v12.1.0"
PORT_BASE=9000

for i in ${!INSTANCES[@]}; do
  INSTANCE_IP=${INSTANCES[$i]}
  INSTANCE_NUM=$((i + 1))
  INSTANCE_PORT=$((PORT_BASE + INSTANCE_NUM))
  
  echo "Installing on $INSTANCE_IP (port $INSTANCE_PORT)"
  
  ssh -i ~/.ssh/id_rsa ubuntu@$INSTANCE_IP << 'INSTALL_SCRIPT'
    # Update system
    sudo apt-get update
    sudo apt-get upgrade -y
    
    # Install Docker (if not present)
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    
    # Pull Docker image
    docker pull basset-hound-browser:v12.1.0
    
    # Create data directories
    sudo mkdir -p /data/basset-hound/{logs,cache,sessions}
    sudo chmod 755 /data/basset-hound
  INSTALL_SCRIPT
done
```

**Step 2.3: Start Application Instances**

```bash
#!/bin/bash
# Script: start-instances.sh

INSTANCES=("instance-1-ip" "instance-2-ip" "instance-3-ip")
DOCKER_IMAGE="basset-hound-browser:v12.1.0"
PORT_BASE=9000

for i in ${!INSTANCES[@]}; do
  INSTANCE_IP=${INSTANCES[$i]}
  INSTANCE_NUM=$((i + 1))
  INSTANCE_PORT=$((PORT_BASE + INSTANCE_NUM))
  
  echo "Starting instance $INSTANCE_NUM on $INSTANCE_IP:$INSTANCE_PORT"
  
  ssh -i ~/.ssh/id_rsa ubuntu@$INSTANCE_IP << DEPLOY_SCRIPT
    docker run -d \
      --name basset-hound-server \
      -p $INSTANCE_PORT:8765 \
      -e PORT=$INSTANCE_PORT \
      -e REDIS_HOST=$REDIS_HOST \
      -e DB_HOST=$DB_HOST \
      -e DB_PORT=$DB_PORT \
      -e DB_USER=$DB_USER \
      -e DB_PASSWORD=$DB_PASSWORD \
      -e DB_NAME=basset_hound \
      -e ENVIRONMENT=production \
      -v /data/basset-hound/logs:/app/logs \
      -v /data/basset-hound/cache:/app/cache \
      --restart unless-stopped \
      $DOCKER_IMAGE
    
    # Wait for startup
    sleep 10
    
    # Verify running
    docker ps | grep basset-hound-server
DEPLOY_SCRIPT
done

echo "All instances started"
```

**Step 2.4: Verify Instance Health**

```bash
#!/bin/bash
# Script: verify-instances.sh

INSTANCES=("instance-1-ip" "instance-2-ip" "instance-3-ip")
PORT_BASE=9000

echo "Verifying instance health..."

for i in ${!INSTANCES[@]}; do
  INSTANCE_IP=${INSTANCES[$i]}
  INSTANCE_NUM=$((i + 1))
  INSTANCE_PORT=$((PORT_BASE + INSTANCE_NUM))
  
  echo -n "Instance $INSTANCE_NUM: "
  
  # Health check
  RESPONSE=$(curl -s -w "\n%{http_code}" http://$INSTANCE_IP:$INSTANCE_PORT/health)
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ HEALTHY"
  else
    echo "✗ UNHEALTHY (HTTP $HTTP_CODE)"
  fi
done
```

### Phase 3: Load Balancer Configuration (30 minutes)

**Step 3.1: Add Instances to Load Balancer**

```javascript
// load-balancer-config.json
{
  "port": 8765,
  "backends": [
    { "host": "10.0.1.100", "port": 9001 },
    { "host": "10.0.1.101", "port": 9002 },
    { "host": "10.0.1.102", "port": 9003 }
  ],
  "algorithm": "round-robin",
  "sessionAffinity": {
    "enabled": true,
    "ttl": 86400,
    "field": "session_id"
  },
  "healthCheck": {
    "interval": 5000,
    "timeout": 2000,
    "path": "/health",
    "expectedStatus": 200
  },
  "rateLimit": {
    "connectionsPerSecond": 100,
    "requestsPerSecond": 1000,
    "perIp": true
  }
}
```

**Step 3.2: Update Load Balancer Configuration**

```bash
#!/bin/bash
# Update LB config

scp -i ~/.ssh/id_rsa \
  load-balancer-config.json \
  ubuntu@lb-host:/etc/basset-hound/

# Signal reload (graceful restart)
ssh -i ~/.ssh/id_rsa ubuntu@lb-host << 'EOF'
  # Gracefully reload without dropping connections
  curl -X POST http://localhost:9090/admin/reload-config
  
  # Verify backends registered
  curl http://localhost:9090/admin/backends | jq .
EOF
```

**Step 3.3: Enable Sticky Sessions**

```javascript
// Sticky session configuration ensures WebSocket connections
// stay on the same backend instance for the 24-hour session TTL

const LoadBalancer = require('./src/infrastructure/load-balancer');

const lb = new LoadBalancer({
  port: 8765,
  sessionAffinity: {
    enabled: true,
    ttl: 86400,  // 24 hours
    hashFunction: (session_id) => {
      // Deterministic hash to select backend
      const hash = session_id
        .split('')
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return hash % backends.length;
    }
  }
});
```

**Step 3.4: Configure Health Checks**

```javascript
// Health check every 5 seconds
// Remove instance if unhealthy for 15 seconds (3 consecutive failures)

healthCheck: {
  interval: 5000,      // Check every 5 seconds
  timeout: 2000,       // Fail if no response in 2 seconds
  unhealthyThreshold: 3, // Mark unhealthy after 3 failures
  healthyThreshold: 2,   // Mark healthy after 2 successes
  path: '/health',     // Endpoint to check
  expectedStatus: 200,
  
  // If health check fails
  onUnhealthy: (backend) => {
    logger.warn(`Backend unhealthy: ${backend.host}:${backend.port}`);
    backend.active = false;
    notifier.alert('Backend unhealthy', { backend });
  }
}
```

### Phase 4: Validation & Testing (45 minutes)

**Step 4.1: Basic Connectivity Test**

```bash
#!/bin/bash
# Test basic connectivity from load balancer to each backend

echo "Testing connectivity..."

for instance in instance-1 instance-2 instance-3; do
  echo "Testing $instance:"
  
  # TCP connection test
  timeout 2 bash -c "echo >/dev/tcp/$instance-ip/9001" 2>/dev/null
  if [ $? -eq 0 ]; then
    echo "  ✓ TCP connection successful"
  else
    echo "  ✗ TCP connection failed"
    continue
  fi
  
  # HTTP health check
  http_code=$(curl -s -o /dev/null -w "%{http_code}" http://$instance-ip:9001/health)
  if [ "$http_code" = "200" ]; then
    echo "  ✓ Health check passed"
  else
    echo "  ✗ Health check failed (HTTP $http_code)"
  fi
  
  # Metrics endpoint
  curl -s http://$instance-ip:9001/metrics | head -5
  echo "  ✓ Metrics available"
done
```

**Step 4.2: Load Balancer Routing Test**

```bash
#!/bin/bash
# Test that LB distributes traffic across backends

echo "Testing load balancer routing..."

# Send 30 requests and verify distribution
for i in {1..30}; do
  curl -s http://localhost:8765/health -w "Instance: %{header_x-instance}\n"
done | sort | uniq -c

# Expected output:
# Should see roughly equal distribution
# ✓ 10 Instance 1
# ✓ 10 Instance 2  
# ✓ 10 Instance 3
```

**Step 4.3: Session Affinity Test**

```bash
#!/bin/bash
# Test that same session stays on same instance

echo "Testing session affinity..."

SESSION_ID="test-session-$(date +%s)"

# Create session on instance 1
curl -X POST http://localhost:8765/api/sessions \
  -H "X-Session-ID: $SESSION_ID" \
  -d '{"user_id":"test"}' > session.json

# Send 10 requests with same session ID
# All should route to same instance
for i in {1..10}; do
  INSTANCE=$(curl -s http://localhost:8765/health \
    -H "X-Session-ID: $SESSION_ID" \
    -w "%{header_x-instance}\n" -o /dev/null)
  echo "Request $i: Instance $INSTANCE"
done | sort | uniq -c

# Expected output:
# ✓ 10 Instance 1
# (All requests to same instance)
```

**Step 4.4: Load Test with Multiple Instances**

```bash
#!/bin/bash
# Load test with 3 instances running

echo "Running load test with 3 instances..."

# Create test client that sends requests
ab -n 10000 -c 100 http://localhost:8765/test

# Monitor metrics during load test
# Expected results:
# - Throughput: 3x single instance (900+ msgs/sec)
# - Latency: Similar to single instance (<100ms P99)
# - CPU: Distributed across instances (~30% each)
# - Memory: Stable (~50% per instance)
```

**Step 4.5: Failure Scenario Test**

```bash
#!/bin/bash
# Test what happens when one instance fails

echo "Testing failure scenario..."

FAILING_INSTANCE="instance-2-ip"

# Kill instance 2
ssh -i ~/.ssh/id_rsa ubuntu@$FAILING_INSTANCE << 'EOF'
  docker stop basset-hound-server
EOF

echo "Instance 2 stopped, waiting for detection..."
sleep 15  # Wait for health check to detect

# Verify LB removed it from rotation
curl http://localhost:8765/admin/backends | jq '.'

# Send requests, should all go to instances 1 and 3
echo "Sending traffic with instance 2 down..."
for i in {1..10}; do
  curl -s http://localhost:8765/test
done

# Restart instance 2
echo "Restarting instance 2..."
ssh -i ~/.ssh/id_rsa ubuntu@$FAILING_INSTANCE << 'EOF'
  docker start basset-hound-server
  sleep 10
EOF

echo "Instance 2 restarted, verifying recovery..."
curl http://localhost:8765/admin/backends | jq '.'

# Expected: Instance 2 marked healthy and traffic flowing
```

---

## Load Balancer Configuration

### Load Balancing Algorithms

**1. Round-Robin (Simple, Good Default)**

```javascript
lb.algorithm = 'round-robin';

// Pseudocode
nextInstance = (lastInstance + 1) % instances.length;
```

**Pros:**
- Simple, predictable
- Fair distribution
- Low overhead

**Cons:**
- Doesn't account for load
- Poor if instance capacity varies

**Best for:** Homogeneous instances with similar load

**2. Least Connections**

```javascript
lb.algorithm = 'least-connections';

// Pseudocode
nextInstance = instances.reduce((least, current) => 
  current.activeConnections < least.activeConnections ? current : least
);
```

**Pros:**
- Adapts to actual load
- Better utilization
- Handles varying workloads

**Cons:**
- Slight overhead
- May be inefficient for short requests

**Best for:** Variable load, mixed workload types

**3. Weighted Round-Robin**

```javascript
backends: [
  { host: '10.0.1.100', port: 9001, weight: 3 },  // Most powerful
  { host: '10.0.1.101', port: 9002, weight: 2 },  // Medium
  { host: '10.0.1.102', port: 9003, weight: 1 },  // Entry-level
]

// Distributes: 3:2:1 ratio of requests
```

**Pros:**
- Handles heterogeneous instances
- Good for mixed workloads

**Cons:**
- More complex to configure

**Best for:** Mixed instance types

### Configuration Example

```javascript
// src/infrastructure/load-balancer.js
const LoadBalancer = require('./load-balancer');

const lb = new LoadBalancer({
  port: 8765,
  
  backends: [
    { host: '10.0.1.100', port: 9001, weight: 1 },
    { host: '10.0.1.101', port: 9002, weight: 1 },
    { host: '10.0.1.102', port: 9003, weight: 1 }
  ],
  
  algorithm: 'least-connections',  // Adapt to load
  
  sessionAffinity: {
    enabled: true,
    ttl: 86400,  // 24 hours (matches session TTL)
    cookieName: 'BASSET_INSTANCE'
  },
  
  healthCheck: {
    interval: 5000,        // Every 5 seconds
    timeout: 2000,         // 2 second timeout
    unhealthyThreshold: 3, // 3 failures = unhealthy
    healthyThreshold: 2,   // 2 successes = healthy
    path: '/health',
    expectedStatus: 200,
    
    // Custom health check
    customCheck: async (backend) => {
      try {
        const response = await fetch(
          `http://${backend.host}:${backend.port}/metrics`
        );
        const metrics = await response.json();
        // Check if metrics indicate health
        return metrics.error_rate < 0.01; // <1% error rate
      } catch (e) {
        return false;
      }
    }
  },
  
  rateLimit: {
    enabled: true,
    globalLimit: 10000,    // 10k req/sec total
    perIpLimit: 1000,      // 1k req/sec per IP
    burstWindow: 1000,     // 1 second window
    
    onRateLimitExceeded: (ip, limit) => {
      logger.warn(`Rate limit exceeded for ${ip}: ${limit}`);
      // Could queue, throttle, or reject
    }
  },
  
  connectionPool: {
    enabled: true,
    minConnections: 10,
    maxConnections: 1000,
    maxConnectionAge: 3600000 // 1 hour
  },
  
  logging: {
    level: 'info',
    logRequests: false,  // Don't log every request
    logErrorsOnly: true, // Log only errors
    logMetrics: true     // Log metrics periodically
  }
});

await lb.start();
```

---

## Session Affinity & Consistency

### Why Session Affinity Matters

**Without Sticky Sessions:**
```
Request 1: Route to Instance 1
├─ Create session: sess_123
└─ Store in Redis

Request 2 (same session): Route to Instance 3
├─ Load session from Redis
├─ Session exists: ✓ (from Redis cache)
└─ Success

Request 3 (after cache eviction): Route to Instance 2
├─ Load session from Redis
├─ Redis down: ✗ (database fallback slow)
└─ 50ms latency hit
```

**With Sticky Sessions:**
```
Request 1: Route to Instance 1
├─ Create session: sess_123
└─ Store in Redis + local cache

Request 2 (same session): Route to Instance 1
├─ Load from local cache
├─ Cache hit: ✓
└─ <1ms latency

Request 3 (same session): Route to Instance 1
├─ Load from local cache
├─ Cache hit: ✓
└─ <1ms latency
```

### Implementing Session Affinity

**In Load Balancer:**

```javascript
// Hash-based session affinity
sessionAffinity: {
  enabled: true,
  ttl: 86400,  // 24 hours
  
  // Deterministic hash function
  selectBackend: (sessionId) => {
    const hash = sessionId
      .split('')
      .reduce((h, c) => h + c.charCodeAt(0), 0);
    return backends[hash % backends.length];
  }
}
```

**In Application (Session Store):**

```javascript
// src/infrastructure/session-store.js
class SessionStore {
  async getSession(sessionId) {
    try {
      // Tier 1: Local cache (milliseconds)
      let session = this.localCache.get(sessionId);
      if (session) {
        metrics.record('cache_hit', 'local');
        return session;
      }
      
      // Tier 2: Redis (milliseconds)
      session = await this.redis.getSession(sessionId);
      if (session) {
        this.localCache.set(sessionId, session);
        metrics.record('cache_hit', 'redis');
        return session;
      }
      
      // Tier 3: Database (tens of milliseconds)
      session = await this.db.getSession(sessionId);
      if (session) {
        await this.redis.setSession(sessionId, session);
        this.localCache.set(sessionId, session);
        metrics.record('cache_hit', 'database');
        return session;
      }
      
      // Tier 4: Not found
      metrics.record('cache_miss');
      throw new Error('Session not found');
      
    } catch (error) {
      metrics.record('session_error');
      throw error;
    }
  }
}
```

### Session Consistency Across Instances

**Write-Through Pattern:**

```javascript
// When session is updated, write to both Redis and Database
async updateSession(sessionId, updates) {
  // Write to both (parallel)
  await Promise.all([
    this.redis.updateSession(sessionId, updates),
    this.db.updateSession(sessionId, updates)
  ]);
  
  // Clear local cache to force reload
  this.localCache.delete(sessionId);
  
  // If on different instance: will reload from Redis/DB
  // If same instance: local cache miss, will reload from Redis
}
```

**Event-Based Invalidation:**

```javascript
// Publish cache invalidation events
eventBus.publish('session-updated', {
  sessionId: 'sess_123',
  changes: { activity_count: 50 }
});

// Other instances listen and invalidate local cache
eventBus.on('session-updated', (event) => {
  localCache.delete(event.sessionId);
});
```

---

## Health Checks & Monitoring

### Health Check Implementation

**Health Endpoint:**

```javascript
// GET /health - Liveness check
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date(),
    version: packageJson.version,
    
    components: {
      database: dbPool.isConnected ? 'ok' : 'error',
      redis: redisManager.isConnected ? 'ok' : 'error',
      memory: process.memoryUsage().heapUsed / 1024 / 1024,
      activeConnections: wsServer.clients.size
    }
  };
  
  res.status(200).json(health);
});
```

**Readiness Endpoint:**

```javascript
// GET /ready - Readiness check
app.get('/ready', async (req, res) => {
  try {
    // Verify all dependencies ready
    await Promise.all([
      dbPool.query('SELECT 1'),
      redisManager.execute('PING'),
      verifyMonitoringConnected()
    ]);
    
    res.status(200).json({ ready: true });
  } catch (error) {
    res.status(503).json({ 
      ready: false, 
      error: error.message 
    });
  }
});
```

**Metrics Endpoint:**

```javascript
// GET /metrics - Prometheus metrics
app.get('/metrics', (req, res) => {
  const metrics = metricsCollector.getAllMetrics();
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics);
});
```

### Health Check Monitoring

**In Load Balancer:**

```javascript
// Health check configuration
healthCheck: {
  interval: 5000,              // Every 5 seconds
  timeout: 2000,               // Fail if no response in 2s
  unhealthyThreshold: 3,       // Mark unhealthy after 3 failures
  healthyThreshold: 2,         // Mark healthy after 2 successes
  path: '/health',
  expectedStatus: 200,
  
  // Callbacks
  onUnhealthy: (backend) => {
    logger.warn(`Backend unhealthy: ${backend.host}:${backend.port}`);
    backend.active = false;
    
    // Notify monitoring
    notifier.alert('Backend unhealthy', {
      backend: `${backend.host}:${backend.port}`,
      severity: 'warning'
    });
  },
  
  onHealthy: (backend) => {
    logger.info(`Backend healthy: ${backend.host}:${backend.port}`);
    backend.active = true;
    
    // Notify monitoring
    notifier.alert('Backend recovered', {
      backend: `${backend.host}:${backend.port}`,
      severity: 'info'
    });
  }
}
```

**Monitoring Dashboard Metrics:**

```
For each instance (Instance 1, 2, 3):
├─ Health Status (Green/Red indicator)
├─ Uptime (hours, minutes)
├─ CPU Usage (%)
├─ Memory Usage (%)
├─ Active Connections (#)
├─ Request Latency P99 (ms)
├─ Error Rate (%)
├─ Database Connection Pool Utilization (%)
└─ Last Health Check (time ago)

Overall Metrics:
├─ Total Throughput (requests/sec)
├─ Total Errors (count, rate)
├─ Traffic Distribution (% per instance)
├─ Capacity Utilization (%)
└─ System Status (Healthy/Warning/Critical)
```

---

## Rollback Procedures

### Scenario: Scaling Goes Wrong

**Signs of Problems:**

```
Latency increased 2x: ✗ Bad
Error rate > 1%: ✗ Bad
Memory leak detected: ✗ Bad
Database connections exhausted: ✗ Bad
Load balancer misconfigured: ✗ Bad
```

**Immediate Rollback Response:**

```bash
#!/bin/bash
# Rollback: Remove problematic instances from load balancer

echo "ROLLBACK INITIATED"

# Step 1: Remove new instances from LB
curl -X POST http://localhost:9090/admin/backends/remove \
  -d '{"host": "10.0.1.102", "port": 9003}'

curl -X POST http://localhost:9090/admin/backends/remove \
  -d '{"host": "10.0.1.103", "port": 9004}'

# Step 2: Verify traffic routing to original instances only
sleep 5
curl http://localhost:9090/admin/backends | jq '.active_backends'

# Step 3: Monitor metrics return to normal
# (Watch CPU, latency, error rate)

echo "ROLLBACK COMPLETE - System operating on original instances"
```

**Full Rollback Procedure:**

```
Phase 1: Immediate Mitigation (0-5 minutes)
├─ Remove problematic instances from LB
├─ Verify traffic rerouted successfully
├─ Monitor metrics for improvement
└─ Alert team

Phase 2: Root Cause Analysis (5-30 minutes)
├─ Examine logs from problematic instances
├─ Check resource utilization
├─ Compare to expected baseline
├─ Identify specific failure cause
└─ Document findings

Phase 3: Resolve Issue (30 minutes - hours)
├─ Fix configuration issue (if config problem)
├─ Increase database connections (if pool exhausted)
├─ Optimize queries (if latency issue)
├─ Update monitoring thresholds (if false alarm)
└─ Test fix in staging

Phase 4: Controlled Re-entry (1+ hours)
├─ Fix verified in staging
├─ Deploy fix to problematic instance
├─ Health check passes
├─ Gradually add back to LB (with monitoring)
├─ Monitor metrics after re-entry
└─ Document lessons learned
```

### Rollback Decision Criteria

**Automatic Rollback Triggered When:**

```
Any of the following for >5 minutes:
├─ Error rate > 1%
├─ P99 latency > 500ms
├─ Memory usage > 90%
├─ CPU usage > 95%
├─ Health check failures > 50% of instances
└─ Customer complaints (+ severity)

Auto-rollback procedure:
├─ Remove newest instances first (last scaled)
├─ Restore to previous stable configuration
├─ Notify team (Slack, email, PagerDuty)
├─ Create incident ticket
└─ Trigger post-mortem process
```

---

## Troubleshooting

### Issue 1: Uneven Load Distribution

**Symptom:** Instance 1 gets 80% of traffic, Instance 2 gets 20%

**Root Causes:**
1. Load balancer algorithm wrong
2. Session affinity too aggressive
3. Instance 2 slower (capacity issue)
4. Network path to Instance 2 longer

**Diagnosis:**

```bash
# Check LB metrics
curl http://lb:9090/admin/backends | jq '.backends[] | {host, connections, requests}'

# Expected output for round-robin:
# Instance 1: 1000 connections
# Instance 2: 1000 connections
# Instance 3: 1000 connections

# If uneven, check:

# 1. Is it session affinity?
curl http://lb:9090/admin/config | jq '.sessionAffinity'

# 2. Is Instance 2 slower?
curl http://instance-2:9002/metrics | grep -E "(latency|cpu|memory)"

# 3. Is network path longer?
ping -c 3 instance-1
ping -c 3 instance-2
traceroute instance-2
```

**Fix Options:**

```
Option A: Switch to least-connections algorithm
├─ Better adapts to actual load
└─ Handles varying instance capacity

Option B: Reduce session affinity TTL
├─ Allows instances to be rebalanced more frequently
└─ Still maintains session stickiness

Option C: Upgrade slower instance
├─ Increase CPU/memory
├─ Better network connectivity
└─ Match other instances

Option D: Debug networking
├─ Check latency to each instance
├─ Verify security groups allow all IPs
└─ Check for bandwidth throttling
```

### Issue 2: High Error Rate After Scaling

**Symptom:** Error rate jumps from 0.1% to 2% after adding instances

**Root Causes:**
1. Database connection pool exhausted
2. Redis connection limit reached
3. Configuration not propagated
4. New instances misconfigured
5. Load balancer routing issue

**Diagnosis:**

```bash
# 1. Check database connection pool
psql -h db-host -U basset -d basset -c \
  "SELECT datname, count(*) as connections FROM pg_stat_activity GROUP BY datname;"

# 2. Check Redis connections
redis-cli INFO stats | grep connected_clients

# 3. Check error logs on new instances
ssh ubuntu@instance-2 "tail -100 /var/log/basset-hound/error.log"

# 4. Check for configuration differences
ssh ubuntu@instance-2 "cat /etc/basset-hound/config.json" | diff - config.json

# 5. Check application metrics
curl instance-2:9002/metrics | grep error_rate
```

**Fix Options:**

```
If DB connection pool exhausted:
├─ Increase max_connections in database
├─ Implement connection pooling (PgBouncer)
├─ Optimize long-running queries
└─ Scale database

If Redis connections exceeded:
├─ Increase Redis connection limit
├─ Implement connection pooling
├─ Review Redis memory usage
└─ Scale Redis cluster

If misconfiguration:
├─ Re-deploy configuration to all instances
├─ Verify environment variables set correctly
├─ Restart affected instances
└─ Monitor for recovery
```

### Issue 3: Session Data Lost After Scaling

**Symptom:** User logs out/loses data when routed to different instance

**Root Causes:**
1. Session affinity disabled
2. Redis not configured
3. Session TTL too short
4. Session data corrupted

**Diagnosis:**

```bash
# 1. Check session affinity enabled
curl http://lb:9090/admin/config | jq '.sessionAffinity.enabled'

# 2. Check Redis connectivity
redis-cli -h redis-host ping
redis-cli -h redis-host INFO server

# 3. Check session storage
redis-cli -h redis-host KEYS "sess_*" | wc -l
# Should have many sessions, not 0

# 4. Manually test session affinity
SESSION_ID="test-sess-$(date +%s)"
# Send request 1 to LB
curl -H "X-Session-ID: $SESSION_ID" http://lb:8765/test -w "\nInstance: %{header_x-instance}\n"
# Send request 2 to LB
curl -H "X-Session-ID: $SESSION_ID" http://lb:8765/test -w "\nInstance: %{header_x-instance}\n"
# Both should say same instance
```

**Fix Options:**

```
If session affinity disabled:
├─ Enable in load balancer config
├─ Reload LB configuration
└─ Test sticky sessions work

If Redis not configured:
├─ Configure Redis connection
├─ Initialize Redis Sentinel
├─ Verify connectivity
└─ Restart application

If session TTL too short:
├─ Increase TTL to 86400 (24 hours)
├─ Update in Redis and DB configs
└─ Document TTL setting

If session data corrupted:
├─ Clear Redis sessions: FLUSHDB (careful!)
├─ Invalidate DB sessions
├─ Force user re-authentication
└─ Monitor for data loss
```

---

## Monitoring Checklist

- [ ] Health check dashboard created and visible
- [ ] Per-instance metrics collected (CPU, memory, latency)
- [ ] Alerts configured for failed health checks
- [ ] Load distribution dashboard showing traffic per instance
- [ ] Error rate monitored per instance
- [ ] Latency percentiles (p50, p95, p99) tracked
- [ ] Database connection pool utilization tracked
- [ ] Redis connection/memory tracked
- [ ] Session distribution verified
- [ ] Capacity utilization trending
- [ ] Cost tracking enabled (per instance/total)
- [ ] Auto-scaling rules tested
- [ ] Rollback procedures documented and tested

---

## Performance Targets After Horizontal Scaling

| Metric | Single Instance | 3 Instances | 5 Instances |
|--------|-----------------|-------------|------------|
| Throughput | ~300 msgs/sec | ~900 msgs/sec | ~1,500 msgs/sec |
| P99 Latency | <100ms | <100ms | <100ms |
| Availability | 99.9% | 99.99% | 99.999% |
| CPU Usage | 40% | 30% per instance | 25% per instance |
| Memory Usage | 50% | 40% per instance | 35% per instance |
| DB Connections | 50 | 150 | 250 |

---

**Document Version:** 1.0.0  
**Last Updated:** June 13, 2026  
**Next Review:** June 27, 2026 (2 weeks)  
**Owner:** Infrastructure / DevOps Team
