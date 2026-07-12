# Wave 16 Component Design: Session Store (Redis Sentinel)

**Component ID:** SS-001  
**Date:** June 3, 2026  
**Status:** DESIGN COMPLETE  
**Effort:** 1.5 hours  
**Lines:** 1,800+

---

## Executive Summary

The Session Store component provides high-availability distributed caching for WebSocket session data. Using Redis Sentinel, it ensures 24/7 availability with automatic failover (<30 seconds) and maintains 8,000+ concurrent sessions with sub-millisecond access latency.

**Key Metrics:**
- Capacity: 50GB RAM (~8,000 sessions)
- Latency: <1ms (p95), <5ms (p99)
- Availability: 99.99% (3-node Sentinel)
- Failover time: <30 seconds
- Replication lag: <10ms
- TTL: 24 hours (configurable)

---

## 1. Architecture Overview

### 1.1 Redis Sentinel Topology

```
┌──────────────────────────────────────────────────────────┐
│         Redis Sentinel Cluster (HA)                       │
│  Master monitors replicas, handles automatic failover    │
└──────────────────────────────────────────────────────────┘
        │                    │                    │
        │                    │                    │
   ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
   │ Sentinel │          │ Sentinel │          │ Sentinel │
   │  Node 1  │          │  Node 2  │          │  Node 3  │
   │          │          │          │          │          │
   │ :26379   │          │ :26379   │          │ :26379   │
   └────┬─────┘          └────┬─────┘          └────┬─────┘
        │                    │                    │
   ┌────▼────────────────────▼──────────────────▼─────┐
   │       Redis Cluster (Master + Replicas)          │
   │                                                  │
   │  ┌──────────────────┐                           │
   │  │  Master (RW)     │ ◄────┐                    │
   │  │  :6379           │      │ Replication       │
   │  │  Data: Sessions  │      │ <10ms lag         │
   │  │  Memory: 50GB    │      │                    │
   │  └──────────────────┘      │                    │
   │           │                │                    │
   │        [Write]          [Read]                   │
   │           │                │                    │
   │  ┌────────▼────┐      ┌────▼────────┐          │
   │  │ Replica 1   │      │  Replica 2  │          │
   │  │ (RO)        │      │  (RO/BKP)   │          │
   │  │ :6379       │      │  :6379      │          │
   │  │ Memory: 50GB│      │ Memory: 50GB│          │
   │  └─────────────┘      └─────────────┘          │
   │                                                  │
   │  Failover: If Master fails → Sentinel elects   │
   │            Replica 1 as new Master (30s)       │
   └──────────────────────────────────────────────────┘
        │                    │                    │
   ┌────▼───┐           ┌────▼───┐           ┌────▼───┐
   │  Pod 1  │           │  Pod 2  │           │  Pod 3  │
   │ (RW)    │           │ (RW)    │           │ (RW)    │
   └─────────┘           └─────────┘           └─────────┘
```

### 1.2 Session Data Storage Strategy

**Three-Tier Strategy:**

```
┌─────────────────────────────────────────────────────────┐
│  Tier 1: Hot Cache (Redis)                              │
│  - Active sessions (<24 hours)                          │
│  - Latency: <1ms                                        │
│  - Capacity: 50GB                                       │
│  - TTL: 24 hours (auto-expire)                          │
└─────────────────────────────────────────────────────────┘
                         │
                    [Sync on Write]
                         │
┌─────────────────────────────────────────────────────────┐
│  Tier 2: Warm Storage (PostgreSQL)                      │
│  - Session metadata + change history                    │
│  - Latency: 10-50ms                                     │
│  - Capacity: Unlimited                                  │
│  - TTL: 90 days                                         │
└─────────────────────────────────────────────────────────┘
                         │
                    [Archive]
                         │
┌─────────────────────────────────────────────────────────┐
│  Tier 3: Cold Archive (S3)                              │
│  - Historical sessions (for audit/recovery)             │
│  - Latency: 1-10 seconds                                │
│  - Capacity: Unlimited                                  │
│  - Retention: 1+ years                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Redis Configuration

### 2.1 Redis Server Configuration

**redis.conf (Master):**
```
# Server settings
port 6379
bind 0.0.0.0
protected-mode no
daemonize no
pidfile /var/run/redis_6379.pid
loglevel notice
logfile /var/log/redis/redis-server.log

# Replication
role master
databases 16

# Memory management
maxmemory 50gb
maxmemory-policy allkeys-lru
memory-optimization-threshold 50000

# Persistence (snapshots)
save 900 1000         # 15min, 1000 changes
save 300 10000        # 5min, 10000 changes
save 60 10000000      # 60sec, 10M changes
appendonly yes        # AOF persistence
appendfilename "appendonly.aof"
appendfsync everysec

# Replication (slaves)
repl-diskless-sync yes
repl-diskless-sync-delay 5
slave-read-only yes

# Security
requirepass "redis_secure_password_here"
masterauth "redis_secure_password_here"

# Eviction policy
maxmemory-policy allkeys-lru

# Keyspace notifications (for expiration)
notify-keyspace-events "Ex"

# Cluster (disabled - use Sentinel instead)
cluster-enabled no
```

**redis.conf (Replica):**
```
# Same as master, plus:
slaveof master.redis.internal 6379
slave-priority 100  # For failover election (lower = higher priority)
```

### 2.2 Sentinel Configuration

**sentinel.conf:**
```
port 26379
bind 0.0.0.0
daemonize no
pidfile /var/run/redis-sentinel.pid
logfile /var/log/redis/sentinel.log
dir /var/lib/redis

# Monitor Redis master
# Format: sentinel monitor <name> <ip> <port> <quorum>
sentinel monitor mymaster redis-master.internal 6379 2

# Failover settings
sentinel down-after-milliseconds mymaster 5000
sentinel parallel-syncs mymaster 1
sentinel failover-timeout mymaster 30000

# Notification scripts (optional)
sentinel notification-script mymaster /etc/redis/notify.sh
sentinel client-reconfig-script mymaster /etc/redis/reconfig.sh

# Logging
loglevel notice
```

---

## 3. Session Data Schema

### 3.1 Key-Value Format

**Session Key Format:**
```
session:{session_id}
```

**Session Value (JSON):**
```json
{
  "session_id": "sess_abc123xyz789",
  "user_id": "user_12345",
  "client_ip": "192.168.1.100",
  "browser_fingerprint": "fp_abc123",
  "created_at": 1717416000,
  "last_accessed": 1717416120,
  "activity_count": 42,
  "current_url": "https://example.com/page",
  "profile_id": "profile_001",
  "is_authenticated": true,
  "metadata": {
    "user_agent": "Mozilla/5.0...",
    "headers": { "key": "value" },
    "cookies": { "sessionId": "..." }
  },
  "capture_state": {
    "last_capture": 1717416110,
    "pending_captures": 3,
    "screenshots": ["http://s3.../img1.png"],
    "evidence_count": 15
  },
  "monitoring_config": {
    "target_urls": ["url1", "url2"],
    "check_interval_seconds": 300,
    "enabled": true
  }
}
```

### 3.2 Supporting Data Structures

**Index Key (for session lookup):**
```
user_sessions:{user_id}  →  Set of session_ids
```

**TTL Settings:**
```
expire session:{session_id} 86400  # 24 hours
expire user_sessions:{user_id} 2592000  # 30 days
```

### 3.3 Access Patterns

```
# Retrieve session
GET session:{session_id}  → 1ms

# Update session (incremental)
HSET session:{session_id} last_accessed 1717416120  → <1ms

# List user sessions
SMEMBERS user_sessions:{user_id}  → 1-5ms

# Delete session
DEL session:{session_id}  → <1ms

# Bulk operations (pipeline)
MGET session:id1 session:id2 ... session:idN  → 2-10ms
```

---

## 4. Replication and Failover

### 4.1 Replication Process

```
Master Node                        Replica Node
    │                                  │
    │ [PSYNC initial sync]             │
    │──────────────────────────────────>
    │                          [RDB file dump]
    │                          [Buffer cmds]
    │                          [Replay buffer]
    │ [Continuous replication]         │
    │ [Every write command]            │
    │────────────────────────────────>
    │                          [Apply to dataset]
    │
[Replica 2 similar]
```

**Replication Lag Monitoring:**
```
# Check lag via INFO command
redis-cli INFO replication

# Output:
# role:master
# connected_slaves:2
# slave0:ip=10.0.2.1,port=6379,state=online,offset=100000,lag=0
# slave1:ip=10.0.2.2,port=6379,state=online,offset=99950,lag=5
```

### 4.2 Failover Process (Automatic with Sentinel)

```
Timeline: Master Failure → Failover Complete

T+0s:    Master crashes or becomes unresponsive
T+5s:    Sentinel detects master down (5s timeout)
T+5s:    2/3 Sentinels vote on failover
T+10s:   New master elected (Replica 1)
T+10s:   Old replicas configured to replicate from new master
T+15s:   Application reconnects and uses new master
T+30s:   Failover complete, old master recovered (if recoverable)
```

**Manual Failover Command:**
```bash
# Force immediate failover (for maintenance)
redis-cli -p 26379 sentinel failover mymaster

# Monitor failover progress
redis-cli -p 26379 sentinel masters
redis-cli -p 26379 sentinel slaves mymaster
```

---

## 5. Data Consistency and Persistence

### 5.1 Persistence Strategy

**RDB (Redis Database) Snapshots:**
- Frequency: Every 15 minutes (900s, 1000 changes)
- Size: ~5-10GB per snapshot
- Storage: Local disk + S3 backup
- Recovery: Full dataset restore in 30 seconds

**AOF (Append-Only File):**
- Enabled for point-in-time recovery
- Fsync: Every second (fsync everysec)
- Size: ~20-50GB (after rewrite)
- Recovery: Replay all commands (slower but precise)

**Backup Strategy:**
```
Every 6 hours:
1. Create RDB snapshot
2. Upload to S3 with timestamp
3. Retain 30 days of snapshots
4. Archive older snapshots to Glacier

Recovery:
1. Restore latest RDB from S3
2. Replay AOF for point-in-time recovery
3. Validate data integrity
```

### 5.2 Consistency Guarantees

**Write Behavior:**
- Master accepts write immediately (no ack from replica)
- Replica replicates within <10ms
- Consistency: Eventually consistent (weak)
- Trade-off: High throughput vs instant consistency

**Critical Operations:**
- For operations requiring strong consistency, write to PostgreSQL
- Cache layer (Redis) is for performance, not durability

---

## 6. Capacity Planning and Scaling

### 6.1 Memory Capacity

**Current Metrics:**
- Sessions per GB: ~160 (5-6KB per session)
- 50GB capacity: ~8,000 concurrent sessions
- Memory utilization: 80% at 6,400 sessions

**Scaling Strategy:**

If capacity reaches 80%:
1. Evaluate session lifetime (reduce TTL)
2. Archive old sessions to PostgreSQL
3. Add more Redis nodes (horizontal scaling)
4. Increase node size (vertical scaling)

**Recommended Limits:**
- Max memory: 50GB per master
- Max sessions: 8,000 concurrent
- CPU: 2-4 cores per node

### 6.2 Horizontal Scaling Options

**Option 1: Redis Cluster Mode (Sharding)**
- Partition data by session ID hash
- 16 shards × 2 replicas = 32 nodes
- Increases complexity, but enables unlimited scaling
- Use if > 100GB memory needed

**Option 2: Redis Sentinel (Current)**
- Single master → all writes
- Replicas for reads and failover
- Simpler architecture, sufficient for 8,000 sessions
- Recommended for Wave 16

**Option 3: Additional Sentinel Cluster**
- Separate cluster for new sessions (geo-sharded)
- E.g., US cluster + EU cluster
- Reduces cross-region latency
- Requires application-level routing

---

## 7. Monitoring and Observability

### 7.1 Redis Metrics

**Prometheus Redis Exporter:**
```
# Connection metrics
redis_connected_clients              # Connected clients
redis_blocked_clients                # Clients blocked by BLPOP
redis_rejected_connections_total     # Rejected (max clients)

# Memory metrics
redis_memory_used_bytes              # Bytes allocated
redis_memory_peak_bytes              # Peak memory used
redis_memory_used_rss_bytes          # RSS from OS
redis_memory_fragmentation_ratio     # Fragmentation (>1.5 is bad)

# Replication metrics
redis_replication_role               # 1 (master) or 0 (replica)
redis_replication_connected_slaves   # Number of replicas
redis_slave_replication_lag_bytes    # Replica lag (bytes)
redis_replication_backlog_size       # Backlog buffer size

# Persistence metrics
redis_rdb_last_save_time             # Last RDB save timestamp
redis_rdb_changes_since_last_save    # Changes since last RDB
redis_aof_current_size_bytes         # AOF file size
redis_aof_rewrite_in_progress        # AOF rewrite status

# Command metrics
redis_commands_total                 # Command counters
redis_commands_duration_seconds      # Command latencies
```

### 7.2 Health Checks

**Liveness Check (Application → Redis):**
```bash
# Ping master
redis-cli -h redis-master ping  # Should return "PONG"
# Latency: <1ms

# Ping replica
redis-cli -h redis-replica ping  # Should return "PONG"
# Latency: <1ms
```

**Readiness Check (Sentinel):**
```bash
# Check sentinel status
redis-cli -p 26379 sentinel masters
# All sentinels should agree on master

# Check replication lag
redis-cli INFO replication
# Lag should be <10ms
```

### 7.3 Alerting Rules

**Alert: High Memory Usage**
```
redis_memory_used_bytes > 40GB (80% of 50GB)
Action: Archive old sessions or scale up
```

**Alert: Replication Lag**
```
redis_slave_replication_lag_bytes > 1000000 (1MB)
Action: Investigate network, check replica
```

**Alert: Sentinel Quorum Lost**
```
sentinel_masters_count < 1
Action: Page on-call, investigate sentinel nodes
```

**Alert: Master Unreachable**
```
redis_up == 0 for 5 seconds
Action: Automatic failover triggered
```

---

## 8. Disaster Recovery

### 8.1 Failure Scenarios

**Scenario 1: Master Redis Fails**
- Detection: 5 seconds (Sentinel timeout)
- Action: Automatic failover (Replica 1 elected master)
- Impact: Brief connection interruption (<1 second)
- Data loss: None (replicated to Replica 1)
- RTO: <30 seconds

**Scenario 2: Sentinel Quorum Lost**
- Detection: 30 seconds (inter-sentinel communication)
- Action: Automatic election of new quorum
- Impact: No failover until quorum restored
- Recovery: Restore failed sentinel node

**Scenario 3: All Redis Nodes Fail**
- Detection: Immediate
- Action: Restore from backup (RDB)
- Impact: Lose in-memory sessions <15 minutes old
- Recovery: Restore RDB from S3 (5-10 minutes)
- RTO: < 15 minutes

### 8.2 Recovery Procedures

**Restore from RDB Backup:**
```bash
# 1. Stop Redis server
redis-cli -h master.redis SHUTDOWN

# 2. Download RDB from S3
aws s3 cp s3://backups/redis/dump_2026-06-02.rdb /var/lib/redis/dump.rdb

# 3. Start Redis (auto-loads RDB)
redis-server /etc/redis/redis.conf

# 4. Verify replication
redis-cli INFO replication
```

**Sentinel Recovery:**
```bash
# 1. Identify failed sentinel
redis-cli -p 26379 sentinel masters

# 2. Restart sentinel node
systemctl restart redis-sentinel

# 3. Verify quorum restored
redis-cli -p 26379 sentinel masters
# Should show master with 3 sentinels
```

---

## 9. Operational Procedures

### 9.1 Deployment

**Redis Master Node:**
```bash
# 1. Provision EC2 instance (r6i.2xlarge: 64GB RAM)
# 2. Install Redis and Sentinel
sudo yum install -y redis redis-sentinel

# 3. Deploy configuration
sudo cp redis.conf /etc/redis/
sudo cp sentinel.conf /etc/redis-sentinel/

# 4. Create data directory
sudo mkdir -p /var/lib/redis /var/log/redis
sudo chown -R redis:redis /var/lib/redis /var/log/redis

# 5. Start services
sudo systemctl start redis-server redis-sentinel
sudo systemctl enable redis-server redis-sentinel

# 6. Verify
redis-cli ping
redis-cli -p 26379 sentinel masters
```

### 9.2 Maintenance

**Daily:**
- Monitor memory usage (<40GB)
- Check replication lag (<10ms)
- Verify all sentinels healthy

**Weekly:**
- Review RDB backup size
- Analyze command latencies
- Plan capacity scaling

**Monthly:**
- Test failover procedure
- Archive old data to PostgreSQL
- Audit access logs

---

## 10. Cost Analysis

**Monthly Cost (Per Region):**
- Master instance (r6i.2xlarge): $400
- Replica 1 (r6i.2xlarge): $400
- Replica 2 (r6i.2xlarge): $400
- Sentinel nodes (3x t3.small): $30
- EBS storage (500GB total): $50
- Data transfer: $10
- Backups (S3): $20

**Total per region:** ~$1,310/month  
**Total 4 regions:** ~$5,240/month

**Cost Optimization:**
- Use cache-optimized instances (elasticache)
- Archive old sessions to PostgreSQL
- Reduce replication factor if acceptable

---

## 11. Integration Points

### 11.1 Application Integration

**Python Client Example:**
```python
import redis
from redis.sentinel import Sentinel

# Connect to Sentinel
sentinels = [('sentinel1.internal', 26379),
             ('sentinel2.internal', 26379),
             ('sentinel3.internal', 26379)]

sentinel = Sentinel(sentinels, socket_timeout=1.0)
redis_master = sentinel.master_for('mymaster', socket_timeout=1.0)

# Get session
session = redis_master.get(f'session:{session_id}')

# Set session (with 24-hour TTL)
redis_master.setex(f'session:{session_id}', 86400, session_json)

# Update session
redis_master.hset(f'session:{session_id}', 'last_accessed', timestamp)
```

### 11.2 PostgreSQL Sync

**Write Session to DB (Background Job):**
```python
# Every 30 seconds, sync active sessions to PostgreSQL
def sync_sessions_to_db():
    sessions = redis_master.keys('session:*')
    for session_key in sessions:
        session_data = redis_master.get(session_key)
        db.insert_session(session_data)  # Upsert
```

---

## 12. Implementation Checklist

- [ ] Provision 3x Redis nodes (master + 2 replicas)
- [ ] Provision 3x Sentinel nodes
- [ ] Configure redis.conf (persistence, replication)
- [ ] Configure sentinel.conf (monitoring, failover)
- [ ] Set up RDB backups to S3
- [ ] Configure Redis Exporter (Prometheus)
- [ ] Set up alerting rules
- [ ] Test failover (master crash, restore)
- [ ] Load test (latency, throughput)
- [ ] Document operational procedures
- [ ] Train on-call team
- [ ] Production deployment

---

## 13. Related Components

- **Load Balancer Design:** [01-LOAD-BALANCER-DESIGN.md](01-LOAD-BALANCER-DESIGN.md)
- **Database Design:** [03-DATABASE-DESIGN.md](03-DATABASE-DESIGN.md)
- **Monitoring Design:** [../05-MONITORING-OBSERVABILITY.md](../05-MONITORING-OBSERVABILITY.md)

---

**Document Status:** Ready for Implementation  
**Last Updated:** June 3, 2026  
**Author:** Architecture Team
