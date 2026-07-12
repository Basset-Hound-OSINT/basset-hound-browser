# Wave 16: Database & State Architecture

**Date:** June 2, 2026  
**Phase:** Architecture Design (Phase 2)  
**Duration:** 1.5 hours design  
**Status:** Detailed Design

---

## Executive Summary

The database and state architecture implements a multi-layer storage strategy optimized for session persistence, monitoring history, and evidence storage. This document defines the data models, storage tiers, replication strategy, and operational procedures for distributed state management at scale.

---

## Storage Tiers & Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Instances                    │
│  (Handle requests, generate data, cache results)             │
└────────────────────┬────────────────────────────────────────┘
                     │ Real-time (milliseconds)
                     ▼
        ┌────────────────────────────────┐
        │  TIER 1: HOT CACHE (Redis)     │ ← Sub-millisecond
        │                                │   access
        │  • Sessions (1-hour TTL)       │
        │  • Query cache (5-min TTL)     │
        │  • User state (24-hour TTL)    │
        │  • Memory: 50GB                │
        │  • Replication: Master+Replica │
        └────────────────────────────────┘
                     │ Async (seconds)
                     ▼
        ┌────────────────────────────────┐
        │  TIER 2: WARM (PostgreSQL)     │ ← Millisecond
        │                                │   access
        │  • Session history (7 days)    │
        │  • Monitoring (30 days raw)    │
        │  • Configuration               │
        │  • User data                   │
        │  • Storage: 100GB              │
        │  • Replication: Master+2xRO    │
        └────────────────────────────────┘
                     │ Batch (hourly)
                     ▼
        ┌────────────────────────────────┐
        │  TIER 3: COLD (S3 Archive)     │ ← Seconds access
        │                                │
        │  • Evidence files (1 year)     │
        │  • Compressed logs (90 days)   │
        │  • Archived monitoring (1 year)│
        │  • Cost: ~$0.01/GB/month       │
        │  • Infrequent Access Tier      │
        └────────────────────────────────┘
                     │ Query (seconds)
                     ▼
        ┌────────────────────────────────┐
        │  TIER 4: BI (InfluxDB/Redshift)│ ← Analytics
        │                                │
        │  • Aggregated metrics (90 days)│
        │  • Trends and analytics        │
        │  • Cost optimization data      │
        │  • Storage: 500GB              │
        └────────────────────────────────┘
```

---

## Layer 1: Hot Cache (Redis Sentinel)

### Session Storage Model

```
Key: session:{sessionId}
TTL: 24 hours
Size: 5-50KB per session

Value (JSON):
{
  "id": "session-uuid",
  "userId": "user-uuid",
  "createdAt": 1717334400,
  "updatedAt": 1717334500,
  "expiresAt": 1717420800,
  "profile": {
    "name": "Default Profile",
    "userAgent": "Mozilla/5.0...",
    "headers": {...},
    "cookies": {...}
  },
  "state": {
    "currentUrl": "https://example.com",
    "navigationHistory": [...],
    "mousePosition": {x: 100, y: 200},
    "scrollPosition": {x: 0, y: 500}
  },
  "evidence": {
    "lastScreenshot": "s3://evidence/shot-123.png",
    "recordingPath": "s3://evidence/video-123.mp4",
    "captureCount": 45
  },
  "performance": {
    "pageLoadTime": 1250,
    "lastCommandDuration": 45,
    "totalCommands": 234
  }
}
```

### Cache Keys (Namespace Pattern)

```
# Session data
session:{sessionId}
session:{sessionId}:metadata  (lighter queries)
session:{sessionId}:state

# Query results (5-minute cache)
query:{hash}:{instanceId}
query:navigation:cache:{sessionId}

# Aggregate metrics (10-second cache)
metrics:total_connections
metrics:msg_rate_1min
metrics:instance_health

# User data (24-hour cache)
user:{userId}:profile
user:{userId}:settings
user:{userId}:permissions

# Configuration (1-hour cache, invalidate on change)
config:evasion:fingerprint
config:monitoring:thresholds
config:rate_limits
```

### Cache Eviction Policy

```
maxmemory: 50GB
maxmemory-policy: allkeys-lru

# Priority (what to keep when memory full):
1. Session data (user impact)
2. Configuration (operational impact)
3. Query cache (performance impact)
4. Metrics (monitoring impact)
```

### Consistency Strategy

**Session Write Path:**
```
1. Client sends command
2. Instance processes command
3. Instance updates Redis (immediate)
4. Instance queues to PostgreSQL (async, batched)
5. Return response to client

Result: High availability, eventual consistency
Risk: Data loss if Redis fails before PostgreSQL persists
Mitigation: Redis Sentinel HA (99.9% uptime)
```

**Session Read Path:**
```
1. Client connects, provides sessionId
2. Instance looks up in Redis
3. Redis hit: return immediately (fast path)
4. Redis miss: load from PostgreSQL
5. Restore in Redis (TTL: 24 hours)

Result: Fast read, automatic cache population
Cost: PostgreSQL load on miss (first connection)
```

### Replication & Failover

```
Replication: Asynchronous
Master → Replica: ~100ms lag
Quorum: 2/3 (minimum 2 Sentinels to agree on failover)

Failover Sequence:
1. Master connection fails (detection: 15 seconds)
2. Sentinels vote to promote replica (quorum check)
3. Old master → Replica role (when healthy)
4. New master → accept writes
5. Clients reconnect (transparent via sentinel)

Data Loss Risk: Yes (100ms window of unflushed data)
Acceptable: YES (session data, not critical)
```

---

## Layer 2: Warm Storage (PostgreSQL)

### Database Schema

**Sessions Table:**
```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    profile_data JSONB NOT NULL,
    state_data JSONB NOT NULL,
    evidence_data JSONB,
    performance_data JSONB,
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at),
    INDEX idx_updated_at (updated_at DESC)
);

-- Retention policy: delete sessions older than 7 days
CREATE TRIGGER cleanup_old_sessions
AFTER DELETE ON sessions
FOR EACH ROW EXECUTE FUNCTION cleanup_evidence(OLD.id);
```

**Monitoring Table (Time-Series):**
```sql
CREATE TABLE monitoring_events (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    instance_id VARCHAR(255),
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    metric_name VARCHAR(255) NOT NULL,
    metric_value FLOAT NOT NULL,
    tags JSONB,
    
    INDEX idx_session_timestamp (session_id, timestamp DESC),
    INDEX idx_metric_timestamp (metric_name, timestamp DESC),
    INDEX idx_instance_timestamp (instance_id, timestamp DESC)
);

-- Partitioning: monthly partitions for faster queries
CREATE TABLE monitoring_events_2026_06 PARTITION OF monitoring_events
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
```

**Configuration Table:**
```sql
CREATE TABLE configuration (
    key VARCHAR(512) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255),
    version INT DEFAULT 1,
    INDEX idx_updated_at (updated_at DESC)
);

-- Enable config versioning for rollback
CREATE TABLE configuration_history (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(512),
    value JSONB,
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),
    version INT,
    INDEX idx_key_version (key, version DESC)
);
```

**Evidence References:**
```sql
CREATE TABLE evidence_references (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id),
    type VARCHAR(50),  -- 'screenshot', 'video', 'log', 'html'
    s3_key VARCHAR(1024) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    size_bytes BIGINT,
    metadata JSONB,
    checksum VARCHAR(64),
    INDEX idx_session_id (session_id),
    INDEX idx_created_at (created_at DESC)
);
```

**Users & Accounts:**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login TIMESTAMP,
    settings JSONB,
    INDEX idx_email (email)
);

CREATE TABLE accounts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    organization VARCHAR(255),
    subscription_tier VARCHAR(50),
    subscription_expires TIMESTAMP,
    max_sessions INT DEFAULT 100,
    INDEX idx_user_id (user_id)
);
```

### Data Write Path (Async)

```
Instance receives command
  ↓
Process in-memory + Redis
  ↓
Queue PostgreSQL write (batched)
  ↓
Background worker (every 5 seconds)
  ↓
Batch insert to PostgreSQL
  ├─ INSERT new sessions
  ├─ UPDATE modified sessions
  └─ Record monitoring events
  ↓
Commit transaction
  ↓
Monitoring: confirm write
```

**Batching Benefits:**
- Reduce write overhead: 100 individual writes → 1 batch
- Improve throughput: 1000 writes/sec → 10,000 writes/sec
- Reduce connections: 1 batch connection vs 100 connections

**Consistency Window:**
- Redis → PostgreSQL delay: 0-5 seconds (configurable)
- Risk: Loss of last 5 seconds if both fail simultaneously
- Acceptable: YES (low probability, batch recovery from Redis)

### Replication Strategy

```
Primary (RW)
    ├─ Replica 1 (RO, Standby, high priority)
    ├─ Replica 2 (RO, Analytics, can lag)
    └─ Replica 3 (RO, Backup, daily snapshots)

Replication Type: Streaming (continuous)
Lag: <100ms (typically <10ms)
RPO: 0 (synchronous commits on standby)
RTO: 1-5 minutes (promote replica)
```

**High Availability with pg_probackup:**
```bash
# Take PITR backup daily
pg_probackup backup -B /backup_dir -D /var/lib/postgresql

# Restore to any point in time
pg_probackup restore -B /backup_dir -D /recovery_dir -i BACKUP_ID --recovery-target-timeline latest
```

### Query Optimization

**Common Queries:**

```sql
-- Session lookup (O(1) with index)
SELECT * FROM sessions WHERE id = $1;
-- Expected: <1ms

-- Monitoring aggregation (O(n) with index)
SELECT metric_name, AVG(metric_value) as avg_value, PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY metric_value) as p99
FROM monitoring_events
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY metric_name;
-- Expected: 50-100ms (with time-series partitioning)

-- Session history (O(n) with index)
SELECT * FROM sessions
WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 100;
-- Expected: <100ms
```

**Query Planning:**
```sql
-- Use EXPLAIN to optimize
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM sessions WHERE id = $1;

-- Result should show:
-- - Index Scan (not Seq Scan)
-- - Actual Rows: 1
-- - Buffers: Hits > 90%
```

---

## Layer 3: Cold Storage (S3 Archive)

### Storage Structure

```
s3://basset-hound-evidence/
├── sessions/
│   ├── 2026-06-02/
│   │   ├── session-123.json.gz
│   │   └── session-124.json.gz
│   └── 2026-06-03/
│       └── session-125.json.gz
├── screenshots/
│   ├── 2026-06-02/
│   │   ├── shot-001.png.gz
│   │   └── shot-002.png.gz
│   └── 2026-06-03/
│       └── shot-003.png.gz
├── videos/
│   ├── 2026-06-02/
│   │   ├── video-001.mp4
│   │   └── video-002.mp4
│   └── 2026-06-03/
│       └── video-003.mp4
└── logs/
    ├── 2026-06-02/
    │   ├── app.log.gz
    │   └── error.log.gz
    └── 2026-06-03/
        └── app.log.gz
```

### Lifecycle Policy

```json
{
  "Rules": [
    {
      "Id": "Archive old evidence",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"  // Infrequent Access
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER"  // Long-term archive
        }
      ],
      "Expiration": {
        "Days": 365  // Delete after 1 year
      }
    }
  ]
}
```

**Cost Breakdown:**
- Standard (0-30 days): $0.023/GB/month
- Infrequent Access (30-90 days): $0.0125/GB/month
- Glacier (90+ days): $0.004/GB/month
- **Average: $0.013/GB/month (43% savings vs Standard)**

### Upload Strategy

**Batch Upload (Hourly):**
```python
# Collect evidence references from last hour
evidence = db.query(
    "SELECT * FROM evidence_references WHERE created_at > NOW() - INTERVAL '1 hour'"
)

# Compress and upload in parallel
for item in evidence:
    key = f"evidence/{item.type}/{item.created_at.date()}/{item.id}.gz"
    s3_client.put_object(
        Bucket='basset-hound-evidence',
        Key=key,
        Body=gzip.compress(item.data),
        ServerSideEncryption='AES256'
    )

# Update evidence reference with S3 key
db.update_evidence_s3_key(item.id, key)
```

**Encryption:**
- In-transit: TLS 1.3
- At-rest: AES-256 (S3-managed keys)
- Access: IAM roles (least privilege)

---

## Layer 4: Analytics (InfluxDB)

### Time-Series Data Model

**Measurement Structure:**
```
Measurement: basset_hound
Tags: instance, region, session_id
Fields: cpu, memory, connections, msg_rate, latency

Example points:
basset_hound,instance=pod1,region=us-east cpu=45.2,memory=2048,connections=250,msg_rate=600,latency_p99=45 1717334510000000000
basset_hound,instance=pod2,region=us-east cpu=52.1,memory=2048,connections=280,msg_rate=650,latency_p99=42 1717334510000000000
```

**Retention Policies:**

```
# Raw data: 30 days (10-second intervals = 259K points per metric)
CREATE RETENTION POLICY "raw_30d" ON "basset_hound" DURATION 30d REPLICATION 2

# Hourly aggregates: 1 year
CREATE RETENTION POLICY "hourly_1y" ON "basset_hound" DURATION 365d REPLICATION 1

# Daily aggregates: 2 years
CREATE RETENTION POLICY "daily_2y" ON "basset_hound" DURATION 730d REPLICATION 1
```

**Continuous Aggregation:**

```sql
-- Hourly average (calculated every 5 minutes)
CREATE CONTINUOUS QUERY "average_hourly" ON "basset_hound"
BEGIN
  SELECT MEAN(*) INTO "hourly_1y"."basset_hound_hourly"
  FROM "raw_30d"."basset_hound"
  GROUP BY time(1h), *
END

-- Daily average
CREATE CONTINUOUS QUERY "average_daily" ON "basset_hound"
BEGIN
  SELECT MEAN(*) INTO "daily_2y"."basset_hound_daily"
  FROM "hourly_1y"."basset_hound_hourly"
  GROUP BY time(24h), *
END
```

### Common Queries

**Current Metrics (Real-time):**
```sql
SELECT MEAN(connections), MEAN(msg_rate), MEAN(latency_p99)
FROM basset_hound
WHERE time > now() - 5m
GROUP BY instance
```

**Trend Analysis (Last 7 days):**
```sql
SELECT mean_connections, stddev_connections
FROM basset_hound_hourly
WHERE time > now() - 7d
GROUP BY instance
```

**Percentile Analysis (Last 1 hour):**
```sql
SELECT PERCENTILE(latency, 50), PERCENTILE(latency, 95), PERCENTILE(latency, 99)
FROM basset_hound
WHERE time > now() - 1h
```

### Storage Efficiency

**Compression Ratio:** 70-90%
- Raw points: 10 billion/year (1000 metrics × 100 instances × 86400 seconds/day × 365 days)
- Compressed size: 1-3 TB/year
- Cost: $30-90/year (S3 IA pricing)

---

## Cross-Layer Consistency

### Write Consistency Levels

**Level 1: Eventually Consistent (Default)**
```
Redis write → Success
PostgreSQL write → Queued (5-10 second delay)
Use case: Non-critical session updates
Risk: Lose <5 seconds of data if both fail
Acceptable: YES (for most session data)
```

**Level 2: Semi-Synchronous**
```
Redis write → Success
PostgreSQL write → Synchronous (wait for confirmation)
Use case: Critical data (user profile, billing)
Performance: +20-50ms latency
Risk: Minimize (transaction confirmed)
Acceptable: YES (for important data)
```

**Level 3: Synchronous (Strongest)**
```
Redis write → Queued
PostgreSQL write → Synchronous (mandatory)
Result returned to client: Only if PostgreSQL confirmed
Use case: Financial transactions, legal evidence
Performance: +50-100ms latency
Risk: Minimal (both confirm)
Acceptable: YES (for critical operations)
```

### Data Recovery

**If Redis Master Fails:**
1. Sentinel promotes replica (30 seconds)
2. All session data recovers from replica
3. Loss: <100ms of data (acceptable)
4. Action: Monitor PostgreSQL for verification

**If PostgreSQL Master Fails:**
1. Promote standby replica (manual, 1-5 minutes)
2. All persistent data recovers
3. Loss: 0 (synchronous replication)
4. Action: Restore from replica, no data loss

**If Both Fail Simultaneously:**
1. Redis recovers from replica (immediate)
2. PostgreSQL recovers from backup (1 hour)
3. Loss: 5-10 minutes of PostgreSQL data
4. Rebuild: Restore from S3 evidence archive

---

## Performance Targets

| Operation | Target | Method |
|-----------|--------|--------|
| Session lookup | <1ms | Redis direct lookup |
| Session restore | 50-200ms | PostgreSQL warm cache |
| Monitoring write | <5ms | Async batched insert |
| Query aggregation | 50-100ms | InfluxDB indexed query |
| Archive retrieval | 1-5 seconds | S3 with local cache |
| Failover | <30 seconds | Sentinel/replica promotion |

---

## Monitoring & Alerting

**Critical Alerts:**
```
alert: RedisMemoryFull
  expr: redis_memory_used_bytes > 50000000000
  severity: critical

alert: PostgreSQLReplicationLag
  expr: pg_replication_lag_seconds > 10
  severity: warning

alert: InfluxDBRetentionError
  expr: influxdb_retention_policy_errors > 0
  severity: warning
```

---

## Document Control

| Field | Value |
|-------|-------|
| Document ID | WAVE-16-PHASE-2-DATABASE |
| Version | 1.0 |
| Status | Draft |
| Created | June 2, 2026 |
| Owner | Architecture Team |

---

**Next Document:** `/docs/wave16/04-NETWORKING-ARCHITECTURE.md`
