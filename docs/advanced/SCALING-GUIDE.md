# Scaling Guide - v12.2.0
**Version:** Complete
**Updated:** June 13, 2026
**For:** Enterprise deployments, high-volume operations

## Scaling Paths

### Path 1: Single Server Optimization (0-100 concurrent)

**Appropriate For:**
- Small teams (<5 users)
- Development/testing
- Proof of concept
- Low-volume operations

**Configuration:**
```javascript
{
  "deployment": "single-server",
  "resources": {
    "cpuCores": 2,
    "memory": "4GB",
    "disk": "100GB SSD"
  },
  "performance": {
    "compression": "medium",
    "batching": { "enabled": true, "maxBatchSize": 30 },
    "maxConcurrent": 50
  }
}
```

**Expected Performance:**
- Concurrent: 50-100
- Throughput: 150-200 msgs/sec
- Latency: 5-10ms
- Resource util: 30-40%

### Path 2: Small Cluster (100-500 concurrent)

**Appropriate For:**
- Teams: 5-20 users
- Production operations
- Moderate volume
- High availability required

**Architecture:**
```
      [Load Balancer]
             |
    [Nginx/HAProxy]
             |
    ----+----+----
    |         |
  [S1]     [S2]     [S3]
  
Shared Layer:
- Redis (session/cache)
- PostgreSQL (state)
- S3 (artifacts)
```

**Configuration per Server:**
```javascript
{
  "deployment": "cluster",
  "clusterSize": 3,
  "instanceId": "server-1",
  "resources": {
    "cpuCores": 4,
    "memory": "8GB",
    "disk": "200GB SSD"
  }
}
```

**Expected Performance:**
- Total concurrent: 300-500
- Per-server throughput: 280+ msgs/sec
- Latency: 2-5ms
- Resource util: 50-60%

### Path 3: Medium Cluster (500-2000 concurrent)

**Appropriate For:**
- Teams: 20-100 users
- Large-scale operations
- Enterprise deployments
- Multiple regions

**Architecture:**
```
     [Global Load Balancer]
             |
     [Regional Balancers]
      /      |      \
    US     EU      APAC
    |       |       |
  [C1-3] [C1-3]  [C1-3]
    
Shared Layer:
- Redis Cluster (distributed cache)
- PostgreSQL + Replication
- S3 + CloudFront
```

**Configuration:**
```javascript
{
  "deployment": "cluster-regional",
  "regions": 3,
  "serversPerRegion": 3,
  "resources": {
    "cpuCores": 8,
    "memory": "16GB",
    "disk": "500GB SSD"
  }
}
```

**Expected Performance:**
- Total concurrent: 1500-2000
- Per-server throughput: 280+ msgs/sec
- Latency: 1-3ms
- Resource util: 60-70%

### Path 4: Large Cluster (2000+ concurrent)

**Appropriate For:**
- Enterprise: 100+ users
- Global operations
- High-volume processing
- Mission-critical systems

**Architecture:**
```
[Global Traffic Manager]
       /   |   \
   [CDN] [DNS] [DDoS]
       |       |
   [LB-US] [LB-EU] [LB-APAC]
    /  |  \   |     |
  [C1][C2][C3]...
  
Database Tier:
- PostgreSQL Multi-Master
- Redis Sentinel + Replication
- S3 Multi-Region
- EBS Snapshots
```

**Configuration:**
```javascript
{
  "deployment": "cluster-global",
  "regions": 5,
  "serversPerRegion": 5,
  "resources": {
    "cpuCores": 16,
    "memory": "32GB",
    "disk": "1TB SSD"
  }
}
```

**Expected Performance:**
- Total concurrent: 5000+
- Per-server throughput: 280+ msgs/sec
- Latency: <1ms
- Resource util: 70-80%

---

## Scaling Decision Tree

```
START: How many concurrent users?

├─ 0-100
│  └─ Single Server Optimization
│     └─ See: Path 1 Configuration
│
├─ 100-500
│  └─ Small Cluster (3 servers)
│     └─ See: Path 2 Configuration
│
├─ 500-2000
│  └─ Medium Cluster (9 servers)
│     └─ See: Path 3 Configuration
│
└─ 2000+
   └─ Large Cluster (25+ servers)
      └─ See: Path 4 Configuration
```

---

## Step-by-Step Scaling

### Phase 1: Plan (1 day)
1. Estimate concurrent users
2. Calculate resource needs
3. Design infrastructure
4. Budget approval

### Phase 2: Prepare (2-3 days)
1. Provision infrastructure
2. Setup shared layer (Redis, DB)
3. Configure load balancing
4. Test failover scenarios

### Phase 3: Deploy (1-2 days)
1. Deploy first server
2. Validate health checks
3. Deploy additional servers
4. Configure load balancer

### Phase 4: Validate (1 day)
1. Load test
2. Failover test
3. Performance verification
4. Documentation update

---

## Load Balancer Configuration

### Option A: Nginx (Recommended)
```nginx
upstream basset_servers {
  # Round-robin with health checks
  server 10.0.1.10:8765 weight=1 max_fails=3 fail_timeout=10s;
  server 10.0.1.11:8765 weight=1 max_fails=3 fail_timeout=10s;
  server 10.0.1.12:8765 weight=1 max_fails=3 fail_timeout=10s;
  
  keepalive 32;
}

server {
  listen 8765;
  
  location / {
    proxy_pass http://basset_servers;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
  }
}
```

### Option B: HAProxy
```haproxy
global
  maxconn 50000

frontend basset_lb
  bind *:8765
  default_backend basset_servers
  option http-server-close

backend basset_servers
  balance roundrobin
  option httpchk GET /health
  server s1 10.0.1.10:8765 check
  server s2 10.0.1.11:8765 check
  server s3 10.0.1.12:8765 check
```

### Option C: AWS Application Load Balancer
```yaml
LoadBalancer:
  Type: AWS::ElasticLoadBalancingV2::LoadBalancer
  Properties:
    Type: application
    Scheme: internet-facing
    TargetGroupAttributes:
      - Key: deregistration_delay.timeout_seconds
        Value: 30
    
TargetGroup:
  Type: AWS::ElasticLoadBalancingV2::TargetGroup
  Properties:
    ProtocolVersion: HTTP
    HealthCheckProtocol: HTTP
    HealthCheckPath: /health
    HealthCheckIntervalSeconds: 10
```

---

## Shared Resource Configuration

### Redis (Session/Cache Coordination)

```javascript
// config/redis.json
{
  "cluster": {
    "enabled": true,
    "nodes": [
      "redis-1.internal:6379",
      "redis-2.internal:6379",
      "redis-3.internal:6379"
    ]
  },
  "replication": {
    "enabled": true,
    "syncInterval": 1000
  }
}
```

### PostgreSQL (State Persistence)

```javascript
// config/database.json
{
  "primary": "postgres://db-primary.internal:5432/basset",
  "replicas": [
    "postgres://db-replica-1.internal:5432/basset",
    "postgres://db-replica-2.internal:5432/basset"
  ],
  "poolSize": 20,
  "statement_cache_size": 1000
}
```

---

## Scaling Checklist

### Pre-Scaling
- [ ] Capacity analysis completed
- [ ] Infrastructure provisioned
- [ ] Load balancer configured
- [ ] Shared services deployed
- [ ] Monitoring setup
- [ ] Backup strategy defined
- [ ] DR plan created
- [ ] Team trained

### Scaling Execution
- [ ] First server deployed
- [ ] Health checks passing
- [ ] Additional servers deployed
- [ ] Load balancer verifying health
- [ ] Traffic distributed
- [ ] Metrics validated
- [ ] Performance goals met
- [ ] Rollback plan tested

### Post-Scaling
- [ ] Documentation updated
- [ ] Runbooks created
- [ ] Team trained
- [ ] Monitoring alerts set
- [ ] Regular testing schedule
- [ ] Capacity planning updated

---

**Scaling Guide v12.2.0 Complete**
