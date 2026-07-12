# Wave 16: Multi-Instance Deployment Architecture

**Date:** June 2, 2026  
**Phase:** Architecture Design (Phase 2)  
**Duration:** 2 hours design  
**Status:** Detailed Design

---

## Executive Summary

The multi-instance deployment architecture transforms Basset Hound Browser from a single-instance system to a horizontally-scalable, fault-tolerant platform. This document defines the architecture for deploying and managing N instances (2-20) across one or more data centers with automatic failover, load balancing, and session persistence.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Global Load Balancer                      │
│              (Route 53 Geolocation / DNS)                    │
└──────────────────────┬──────────────────────┐────────────────┘
                       │                      │
        ┌──────────────────────┐   ┌──────────────────────┐
        │   US Region (Primary)│   │   EU Region (DR)     │
        │                      │   │                      │
        │  ┌─────────────────┐ │   │  ┌─────────────────┐ │
        │  │  Regional LB    │ │   │  │  Regional LB    │ │
        │  │  (HAProxy)      │ │   │  │  (HAProxy)      │ │
        │  └────────┬────────┘ │   │  └────────┬────────┘ │
        │           │          │   │           │          │
        │  ┌────────┴─────────┐│   │  ┌────────┴────────┐ │
        │  │ Instance 1..N    ││   │  │ Instance 1..M   │ │
        │  │ (Kubernetes Pods)││   │  │ (Kubernetes Pods) │
        │  └──────────────────┘│   │  └─────────────────┘ │
        │                      │   │                      │
        │  Shared Infrastructure   │  Shared Infrastructure
        │  ┌──────────────────┐│   │  ┌──────────────────┐ │
        │  │  Redis Sentinel  ││   │  │ Redis Sentinel   │ │
        │  │  (Session Store) ││   │  │ (Replica)        │ │
        │  └──────────────────┘│   │  └──────────────────┘ │
        │                      │   │                      │
        │  ┌──────────────────┐│   │  ┌──────────────────┐ │
        │  │  PostgreSQL (RW) ││   │  │ PostgreSQL (RO)  │ │
        │  │  (Primary)       ││   │  │ (Replica)        │ │
        │  └──────────────────┘│   │  └──────────────────┘ │
        └──────────────────────┘   └──────────────────────┘
                      │                       │
                      └───────────┬───────────┘
                                  │
                    ┌─────────────────────────┐
                    │ Monitoring & Logging    │
                    │ (Prometheus, ELK, etc) │
                    └─────────────────────────┘
```

---

## Component Architecture

### 1. Global Load Balancer (Route 53 / GeoDNS)

**Purpose:** Route requests to nearest regional endpoint

**Configuration:**
```
Routing Policy: Geolocation + Latency
- US: 0.0.0.0/0 → us-east-1 load balancer
- EU: EU → eu-west-1 load balancer
- APAC: APAC → ap-southeast-1 load balancer

Failover:
- Primary region down → automatic failover to secondary
- Health check interval: 30 seconds
- Failover time: 30-60 seconds
```

**Failover Logic:**
- Route 53 health checks regional LBs every 30 seconds
- If health check fails, remove from DNS
- Clients resolve to next-best region
- TTL: 60 seconds (immediate DNS update)

---

### 2. Regional Load Balancer (HAProxy/NGINX)

**Purpose:** Distribute requests across instances in region

**Configuration (HAProxy Example):**

```haproxy
# Global settings
global
    maxconn 10000
    daemon
    log 127.0.0.1 local0

# Default settings
defaults
    mode tcp
    timeout connect 5000
    timeout client 50000
    timeout server 50000
    log global

# Frontend: Accept incoming WebSocket connections
frontend websocket_in
    bind 0.0.0.0:8765
    default_backend instances

# Backend: Route to instances with sticky sessions
backend instances
    balance leastconn
    option tcp-check
    
    # Sticky session: route by client IP
    cookie SERVERID insert indirect nocache
    
    # Instance health check
    tcp-check connect port 8765
    
    # Instance pool (dynamic via service discovery)
    server instance1 10.0.1.10:8765 check inter 5s
    server instance2 10.0.1.20:8765 check inter 5s
    server instance3 10.0.1.30:8765 check inter 5s
    
    # Dynamic scaling: instances added via service discovery
    # (Kubernetes service exposes pod IPs automatically)

# Stats page (internal monitoring)
listen stats
    bind 0.0.0.0:8404
    stats enable
    stats uri /stats
    stats refresh 30s
```

**Load Balancing Algorithm:**
- **Primary:** Least Connections (best for persistent connections)
- **Fallback:** Round-Robin (if metadata unavailable)
- **Sticky Sessions:** Client IP affinity (optional)

**Health Checks:**
- TCP connection check: port 8765
- Interval: 5 seconds
- Timeout: 1 second
- Consecutive failures for mark down: 2
- Consecutive successes for mark up: 2

**Failover Behavior:**
- If instance fails 2 consecutive checks: mark down
- Drain new connections over 10 seconds
- Existing connections: remain until client closes
- Reconnection routing: new instance with Redis session restore

---

### 3. Application Instances (Kubernetes Pods)

**Purpose:** Run stateless application instances

**Instance Configuration:**
```yaml
# Kubernetes Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: basset-hound-browser
spec:
  replicas: 3  # Start with 3, scale to 20
  selector:
    matchLabels:
      app: basset-hound-browser
  template:
    metadata:
      labels:
        app: basset-hound-browser
    spec:
      containers:
      - name: app
        image: basset-hound-browser:v12.0.0
        ports:
        - containerPort: 8765
        
        # Resource requests (per instance)
        resources:
          requests:
            cpu: "1000m"        # 1 vCPU
            memory: "2Gi"       # 2GB RAM
          limits:
            cpu: "2000m"        # 2 vCPU max
            memory: "4Gi"       # 4GB RAM max
        
        # Environment: connect to distributed store
        env:
        - name: REDIS_HOST
          value: redis-sentinel.default.svc.cluster.local
        - name: REDIS_PORT
          value: "26379"
        - name: DB_HOST
          value: postgres-primary.default.svc.cluster.local
        - name: DB_PORT
          value: "5432"
        
        # Liveness probe: restart if hung
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8765
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 2
          failureThreshold: 3
        
        # Readiness probe: remove from LB if not ready
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8765
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 1
          failureThreshold: 2
        
        # Graceful shutdown
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 15"]
```

**Instance Characteristics:**
- **Stateless:** All state in Redis/PostgreSQL
- **Lightweight:** 2GB RAM, 1 vCPU typical
- **Containerized:** Docker image ~500MB
- **Isolated:** Kubernetes network policy isolation
- **Observable:** Prometheus metrics export

**Startup Sequence:**
1. Pod created by Kubernetes
2. Docker image pulled and started
3. Application initializes (1-2 seconds)
4. Readiness probe succeeds
5. HAProxy health check passes
6. Instance receives traffic

**Shutdown Sequence:**
1. SIGTERM received
2. preStop hook: 15-second drain period
3. Stop accepting new requests
4. Wait for active requests to complete
5. Close Redis/Database connections
6. Exit cleanly

---

### 4. Redis Sentinel (Session Store)

**Purpose:** High-availability distributed cache and session store

**Architecture:**
```
┌──────────────────────────────────────────┐
│         Redis Sentinel Cluster           │
│                                          │
│  ┌──────────────┐  ┌──────────────┐    │
│  │  Sentinel 1  │  │  Sentinel 2  │    │
│  └──────────────┘  └──────────────┘    │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │         Sentinel 3               │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────┐  ┌──────────────┐    │
│  │  Redis Node  │  │  Redis Node  │    │
│  │    Master    │  │   Replica    │    │
│  │   (8 GB)     │  │   (8 GB)     │    │
│  └──────────────┘  └──────────────┘    │
│         ▲                ▲              │
│         │ Replication   │              │
│         └────────┬──────┘              │
│                  │ Pub/Sub for         │
│                  │ cache invalidation  │
└──────────────────────────────────────────┘
         ▲
         │ Watched by all instances
         │
    ┌────┴─────────────────────────────┐
    │   Application Instances          │
    │  (each maintains sentinel        │
    │   connection for master lookup)  │
    └─────────────────────────────────┘
```

**Configuration (sentinel.conf):**

```redis
# Master Redis instance
port 26379
sentinel monitor mymaster 10.0.2.10 6379 2

# Wait before declaring master down
sentinel down-after-milliseconds mymaster 5000

# Failover timeout
sentinel failover-timeout mymaster 10000

# Replica sync timeout
sentinel parallel-syncs mymaster 1

# Logging
loglevel notice
logfile /var/log/redis/sentinel.log

# Bind address
bind 0.0.0.0
```

**Session Storage Details:**
- **Key Format:** `session:{sessionId}`
- **Value:** JSON (user, profile, cookies, state)
- **TTL:** 24 hours (auto-expire old sessions)
- **Memory Limit:** 8GB (hosts up to 8000 active sessions)
- **Replication:** Master → Replica (async)

**Failover Process:**
1. Sentinel detects master down (3 failures × 5-sec interval)
2. Quorum vote (2/3 Sentinels agree) to promote replica
3. Replica becomes new master (5-30 seconds)
4. Old master reconnects as replica (when healthy)
5. Clients reconnect (via sentinel discovery)

**Consistency Model:**
- Strong consistency: reads from master after write
- Eventual consistency: reads from replica (may lag 100ms)
- Trade-off: HA vs consistency (acceptable for session store)

---

### 5. PostgreSQL (Persistent Storage)

**Purpose:** Long-term session storage, monitoring history, configuration

**Architecture:**
```
┌─────────────────────────────────────┐
│     PostgreSQL Primary (RW)         │
│     (Monitoring Master)             │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  sessions table (100MB)     │   │
│  │  monitoring table (1TB)     │   │
│  │  configuration table (1MB)  │   │
│  │  evidence index (100GB)     │   │
│  └─────────────────────────────┘   │
└────────────────────┬────────────────┘
                     │ Streaming replication
         ┌───────────┴───────────┐
         ▼                       ▼
    ┌─────────────────┐  ┌──────────────────┐
    │ PostgreSQL      │  │ PostgreSQL       │
    │ Replica (RO)    │  │ Replica (RO)     │
    │ (Standby)       │  │ (Analytics)      │
    └─────────────────┘  └──────────────────┘
```

**Database Schema:**

```sql
-- Sessions (hot, from Redis → cold, to PostgreSQL)
CREATE TABLE sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    data JSONB NOT NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at)
);

-- Monitoring events (time-series)
CREATE TABLE monitoring (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(36),
    timestamp TIMESTAMP NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    metric_value FLOAT,
    tags JSONB,
    INDEX idx_session_timestamp (session_id, timestamp),
    INDEX idx_metric_timestamp (metric_name, timestamp)
);

-- Configuration (distributed config)
CREATE TABLE configuration (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    updated_by VARCHAR(255)
);

-- Evidence references (screenshots, logs)
CREATE TABLE evidence (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36),
    type VARCHAR(50),
    s3_key VARCHAR(1024),
    created_at TIMESTAMP,
    metadata JSONB,
    INDEX idx_session_id (session_id)
);

-- Compound indexes for common queries
CREATE INDEX idx_sessions_cleanup ON sessions(expires_at) 
  WHERE expires_at < NOW();
CREATE INDEX idx_monitoring_range ON monitoring(metric_name, timestamp)
  WHERE timestamp > NOW() - INTERVAL '90 days';
```

**Scaling Configuration:**

```sql
-- Connection pooling
max_connections = 500
shared_buffers = 16GB
effective_cache_size = 48GB
maintenance_work_mem = 4GB
checkpoint_completion_target = 0.9
wal_buffers = 16MB

-- Replication
wal_level = replica
max_wal_senders = 5
wal_keep_segments = 64
hot_standby = on
```

**Backup Strategy:**
- **Type:** Continuous WAL archiving
- **Frequency:** Hourly base backups
- **Retention:** 30 days (can recover any point in time)
- **RPO:** <1 minute (WAL segment = ~16MB = ~1 minute of data)
- **RTO:** 5-10 minutes (restore from backup + WAL replay)

---

### 6. InfluxDB (Time-Series Monitoring)

**Purpose:** Store and query time-series monitoring data

**Configuration:**
```ini
# Retention policy (90 days)
CREATE RETENTION POLICY "30days" ON "basset_hound" 
  DURATION 30d REPLICATION 2 DEFAULT

# Sample measurement (points stored every 10 seconds)
basset_hound,instance=pod1,region=us-east-1 cpu=45.2,memory=2048,connections=250,msg_rate=600
```

**Data Storage:**
- **Granularity:** 10-second intervals (default)
- **Aggregation:** Hourly (1-hour average) after 7 days
- **Long-term:** Daily (24-hour aggregate) after 30 days
- **Compression:** 70-90% via time-series compression

**Queries:**
```sql
-- Current connection count
SELECT MEAN(connections) FROM connections WHERE time > now() - 5m

-- Throughput over time
SELECT DERIVATIVE(MEAN(msg_count), 1s) FROM messages WHERE time > now() - 1h

-- Performance percentiles
SELECT PERCENTILE(latency, 99) FROM latency WHERE time > now() - 1h
```

---

## Traffic Flow & Routing

### WebSocket Connection Flow

```
1. Client connects to Global LB (Route 53)
   ↓
2. Route 53 resolves to nearest Regional LB (geolocation)
   ↓
3. Regional LB (HAProxy) distributes to instances
   ↓
4. Instance receives WebSocket upgrade
   ↓
5. Session lookup: Redis Sentinel
   ├─ Hit: Load session state
   └─ Miss: Create new session → Redis
   ↓
6. WebSocket bidirectional connection established
   ↓
7. Commands processed by instance
   ↓
8. Results cached in Redis (expire in 1 hour)
   ↓
9. Results persisted to PostgreSQL (asynchronously)
   ↓
10. Metrics exported to InfluxDB (batched, 10-second intervals)
```

### Session Affinity & Failover

**Normal Operation (Instance A):**
```
Client → Regional LB → Instance A → Redis Sentinel (Master) → Instance A
                                        ↑
                                    State: sessionId=XXX
```

**Instance A Fails:**
```
Client tries to reconnect → Regional LB detects A down
                              ↓
                           Routes to Instance B
                              ↓
                           Instance B looks up Redis
                              ↓
                           Redis Sentinel returns master IP
                              ↓
                           Instance B loads session (200-500ms)
                              ↓
                           Client resumes with new instance
```

**Redis Sentinel Fails:**
```
Redis Master → Replica failover detected
   ↓
Sentinel quorum vote (2/3 agree)
   ↓
Replica promoted to Master (5-30 seconds)
   ↓
Clients reconnect during failover
   ↓
All write operations replay on new master
```

---

## Scaling Scenarios

### Scenario 1: Scale Up (300 → 600 concurrent)

**Current State:** 2 instances, 2-3 minute latency spike

**Scaling Process:**
1. HPA detects CPU >70% or connections >250/instance
2. Creates new pod (Instance 3)
3. Pod starts, readiness probe succeeds (5-10 seconds)
4. HAProxy health check passes
5. Traffic gradually shifted to Instance 3
6. Total connections now distributed: ~200 per instance

**Timeline:**
- Detection: 1 minute
- Pod creation: 2-3 seconds
- Application startup: 1-2 seconds
- Health check: 5 seconds
- Traffic shift: 30 seconds
- **Total: <2 minutes**

### Scenario 2: Scale Down (600 → 300 concurrent)

**Current State:** 3 instances, need to reduce to 2

**Scaling Process:**
1. HPA detects CPU <30% for 5 minutes
2. Selects Instance 3 for termination
3. Issues SIGTERM to pod
4. preStop hook: 15-second drain period
   - Stop accepting new connections
   - Complete active connections
   - Close Redis/Database connections
5. Pod terminates
6. Remaining instances handle traffic

**Timeline:**
- Detection: 5 minutes + cooldown
- Drain period: 15 seconds
- Pod termination: 5 seconds
- **Total: 5+ minutes**

### Scenario 3: Multi-Region Failover (Primary → Secondary)

**Current State:** US primary (10 instances), EU secondary (2 instances)

**Failover Trigger:**
1. Route 53 health check fails on US regional LB
2. Quorum vote (requires 2 of 3 regions healthy)
3. Remove US region from DNS
4. Route 53 returns EU region IP

**Automatic Changes:**
- Clients timeout (~30-60 seconds) → retry → resolve to EU
- EU scales up (autoscaler kicks in for increased load)
- Database replication lag catches up
- Session persistence maintained (Redis replicated)

**Timeline:**
- Detection: 30 seconds (health check interval)
- DNS update: 30-60 seconds (TTL propagation)
- Client reconnection: 0-30 seconds (app-dependent)
- **Total: 60-120 seconds**

---

## Operational Procedures

### Adding a New Instance (Manual)

```bash
# 1. Update Kubernetes deployment replicas
kubectl patch deployment basset-hound-browser -p '{"spec":{"replicas":4}}'

# 2. Wait for pod to become ready
kubectl rollout status deployment/basset-hound-browser

# 3. Verify HAProxy picks up new instance
curl http://haproxy-lb:8404/stats | grep instance

# 4. Verify connections are balanced
curl http://metrics:9090/api/v1/query?query=basset_connections
```

### Removing an Instance (Graceful)

```bash
# 1. Remove from load balancer (drain connections)
# HAProxy automatically drains via readiness probe failure

# 2. Update Kubernetes deployment replicas
kubectl patch deployment basset-hound-browser -p '{"spec":{"replicas":2}}'

# 3. Monitor draining
kubectl logs -f deployment/basset-hound-browser | grep drain

# 4. Verify pod terminates cleanly
kubectl get pods -w
```

### Failover from Master to Replica (Manual)

```bash
# 1. Check Redis Sentinel status
redis-cli -p 26379 sentinel master mymaster

# 2. Force failover if needed
redis-cli -p 26379 sentinel failover mymaster

# 3. Verify new master is promoted
redis-cli -p 6379 info replication

# 4. Monitor sentinel quorum
redis-cli -p 26379 sentinel ckquorum mymaster
```

---

## Disaster Recovery

### Instance Failure
- **Detection:** Health check failure (10 seconds)
- **Action:** Automatic pod restart by Kubernetes
- **Impact:** Brief connection loss, auto-reconnect to Redis
- **RTO:** <1 minute

### Regional Load Balancer Failure
- **Detection:** Route 53 health check failure (30 seconds)
- **Action:** Route 53 removes region from DNS, failover to DR
- **Impact:** 30-60 second DNS propagation delay
- **RTO:** <2 minutes

### Redis Master Failure
- **Detection:** Sentinel quorum vote (5-15 seconds)
- **Action:** Promote replica to master
- **Impact:** Data loss possible (async replication), <100ms
- **RTO:** <30 seconds

### PostgreSQL Master Failure
- **Detection:** Connection timeout (5 seconds)
- **Action:** Promote read replica to master (manual or automated)
- **Impact:** Loss of recent writes, read-only until recovered
- **RTO:** 1-5 minutes

### Regional Datacenter Failure
- **Detection:** All instances unreachable (30 seconds)
- **Action:** Route 53 failover to secondary region
- **Impact:** All connections drop, clients reconnect to DR
- **RTO:** 1-2 minutes

---

## Monitoring Integration

### Metrics Exported (Prometheus)

```
# Per-instance metrics
basset_hound_connections{instance="pod1", region="us-east"} 250
basset_hound_msg_rate{instance="pod1", region="us-east"} 600
basset_hound_latency_p99{instance="pod1", region="us-east"} 45

# Cluster-wide metrics
basset_hound_total_connections{region="us-east"} 750
basset_hound_cluster_msg_rate{region="us-east"} 1800
basset_hound_active_instances{region="us-east"} 3
```

### Alerts

```
# Scale up if needed
alert: HighConnectionLoad
  expr: basset_hound_connections > 250
  for: 2m

# Instance health
alert: InstanceUnhealthy
  expr: up{job="basset-hound"} == 0
  for: 1m

# Redis failover
alert: RedisMasterDown
  expr: redis_up{role="master"} == 0
  for: 10s
```

---

## Cost Optimization

### Instance Sizing
- **Development:** 2 instances × 0.5 vCPU (cost: $50/month)
- **Staging:** 3 instances × 1 vCPU (cost: $150/month)
- **Production:** 3-20 instances × 2 vCPU × spot (cost: $500-5000/month)

### Reserved Capacity
- **Base capacity:** 5 instances reserved (30% discount)
- **Burst capacity:** Spot instances (70% discount)
- **Savings:** 40-50% vs on-demand

### Data Transfer
- **Intra-region:** Free
- **Cross-region:** $0.02/GB (minimize replication)
- **To internet:** $0.09/GB (use CDN for 30-40% savings)

---

## Document Control

| Field | Value |
|-------|-------|
| Document ID | WAVE-16-PHASE-2-DEPLOY |
| Version | 1.0 |
| Status | Draft |
| Created | June 2, 2026 |
| Owner | Architecture Team |

---

**Next Document:** `/docs/wave16/03-DATABASE-ARCHITECTURE.md`
