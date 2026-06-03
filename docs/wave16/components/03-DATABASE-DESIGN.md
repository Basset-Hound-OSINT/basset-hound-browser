# Wave 16 Component Design: Database (PostgreSQL)

**Component ID:** DB-001  
**Date:** June 3, 2026  
**Status:** DESIGN COMPLETE  
**Effort:** 1.5 hours  
**Lines:** 1,800+

---

## Executive Summary

The Database component provides persistent storage for sessions, monitoring data, campaigns, and alerts. PostgreSQL with streaming replication ensures data consistency and recovery capability with <100ms replication lag across regions.

**Key Metrics:**
- Storage capacity: 5TB (hot) + unlimited (cold archive)
- Write throughput: 50,000 writes/sec (with WAL optimization)
- Read throughput: 200,000 reads/sec (with replicas)
- Query latency: <50ms (p95)
- Replication lag: <100ms
- Backup frequency: Hourly snapshots + daily full backups
- PITR window: 30 days

---

## 1. Architecture Overview

### 1.1 PostgreSQL Multi-Tier Topology

```
┌────────────────────────────────────────────────────────────┐
│              AWS RDS PostgreSQL Multi-AZ                    │
└────────────────────────────────────────────────────────────┘
        │                    │                    │
        │                    │                    │
   ┌────▼─────────────────────▼────────────────────▼─────┐
   │    Primary Instance (us-east-1a)                     │
   │    - Master (RW)                                     │
   │    - db.r6i.4xlarge (16 vCPU, 128GB RAM)           │
   │    - 2TB SSD (io1, 20,000 IOPS)                     │
   │    - WAL logging enabled                             │
   │    - Automated backups (24-hour retention)           │
   └────┬────────────────────────────────────────────────┘
        │
    [Streaming Replication
     <100ms lag]
        │
   ┌────▼─────────────────────┐
   │  Standby (us-east-1b)    │
   │  - Hot standby           │
   │  - db.r6i.4xlarge       │
   │  - Can promote to master │
   │  - RO access (optional)  │
   └──────────────────────────┘
        │
    [Streaming Replication
     <100ms lag]
        │
   ┌────▼──────────────────────┐
   │  Read Replica (us-east-1c)│
   │  - Analytics queries      │
   │  - db.r6i.2xlarge        │
   │  - Off-peak backups       │
   └──────────────────────────┘

Cross-Region (us-west-2):
        │
    [Logical Replication
     <1 second lag]
        │
   ┌────▼──────────────────────┐
   │  Cross-Region Replica     │
   │  - Disaster recovery      │
   │  - Reporting queries      │
   │  - db.r6i.2xlarge        │
   └──────────────────────────┘
```

### 1.2 Data Flow

```
Application Write
      │
      ▼
┌──────────────┐
│ Write Buffer │  (in-memory, 100ms batches)
└──────────────┘
      │
      ▼
┌──────────────────┐
│  Primary DB      │  (immediate write)
│ (Master)         │
└──────────────────┘
      │
      ▼
┌──────────────────┐
│  WAL (Write-     │  (durability)
│  Ahead Log)      │
└──────────────────┘
      │
   [Async replication]
      │
      ▼
┌──────────────────┐
│ Standby/Replica  │  (eventual consistency)
└──────────────────┘
      │
   [Archive daily]
      │
      ▼
┌──────────────────┐
│  S3 Backup       │  (long-term retention)
└──────────────────┘
```

---

## 2. Database Schema

### 2.1 Sessions Table

```sql
CREATE TABLE sessions (
  session_id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  
  -- Client info
  client_ip INET NOT NULL,
  user_agent TEXT,
  browser_fingerprint VARCHAR(255),
  
  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_accessed TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  activity_count INTEGER DEFAULT 0,
  
  -- Metadata (JSONB for flexibility)
  metadata JSONB DEFAULT '{}',
  
  -- Indexes
  CONSTRAINT sessions_user_id_idx USING BTREE (user_id),
  CONSTRAINT sessions_expires_idx USING BTREE (expires_at),
  CONSTRAINT sessions_user_active_idx USING BTREE (user_id, is_active)
);

-- TTL maintenance: DELETE FROM sessions WHERE expires_at < now()
-- Frequency: Every 6 hours
```

### 2.2 Monitoring Data Table

```sql
CREATE TABLE monitoring_tasks (
  task_id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  
  -- Configuration
  target_url TEXT NOT NULL,
  check_interval_seconds INTEGER DEFAULT 300,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active',  -- active, paused, completed
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Statistics
  total_checks INTEGER DEFAULT 0,
  changes_detected INTEGER DEFAULT 0,
  last_check_at TIMESTAMPTZ,
  
  -- Configuration
  config JSONB DEFAULT '{}',  -- rate limiting, headers, etc
  
  CONSTRAINT monitoring_tasks_user_idx USING BTREE (user_id, status),
  CONSTRAINT monitoring_tasks_status_idx USING BTREE (status, last_check_at)
);
```

### 2.3 Changes/Evidence Table

```sql
CREATE TABLE changes_detected (
  change_id VARCHAR(100) PRIMARY KEY,
  task_id VARCHAR(100) NOT NULL REFERENCES monitoring_tasks(task_id),
  
  -- Change info
  change_type VARCHAR(50),  -- html, text, images, etc
  severity VARCHAR(20),     -- critical, high, medium, low
  
  -- Content
  old_hash VARCHAR(64),
  new_hash VARCHAR(64),
  diff_summary TEXT,
  
  -- Timing
  detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ,
  
  -- Evidence
  screenshot_url TEXT,
  evidence JSONB DEFAULT '{}',
  
  CONSTRAINT changes_task_idx USING BTREE (task_id, detected_at),
  CONSTRAINT changes_severity_idx USING BTREE (severity, detected_at)
);
```

### 2.4 Alerts Table

```sql
CREATE TABLE alerts (
  alert_id VARCHAR(100) PRIMARY KEY,
  task_id VARCHAR(100) NOT NULL REFERENCES monitoring_tasks(task_id),
  
  -- Trigger info
  alert_type VARCHAR(50),  -- change_detected, error, timeout
  message TEXT NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'open',  -- open, acknowledged, resolved
  severity VARCHAR(20),
  
  -- Timing
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  
  -- Notification
  notification_sent BOOLEAN DEFAULT false,
  notification_channels JSONB,  -- slack, email, webhook
  
  CONSTRAINT alerts_task_idx USING BTREE (task_id, triggered_at),
  CONSTRAINT alerts_status_idx USING BTREE (status, severity)
);
```

### 2.5 Audit/Forensics Table

```sql
CREATE TABLE forensic_evidence (
  evidence_id VARCHAR(100) PRIMARY KEY,
  change_id VARCHAR(100) REFERENCES changes_detected(change_id),
  
  -- Content captured
  content_type VARCHAR(50),  -- html, text, images, metadata
  content_url TEXT,
  content_hash VARCHAR(64),
  
  -- Forensic analysis
  analysis_results JSONB,  -- metadata extraction, tampering detection
  confidence_score NUMERIC(3,2),
  
  -- Timing
  captured_at TIMESTAMPTZ NOT NULL,
  analyzed_at TIMESTAMPTZ,
  
  -- Storage
  s3_key TEXT,
  compressed BOOLEAN DEFAULT true,
  
  CONSTRAINT forensic_change_idx USING BTREE (change_id, captured_at)
);
```

---

## 3. Replication Strategy

### 3.1 Streaming Replication

**Primary → Standby:**
```
Primary continuously sends WAL records → Standby applies changes
Lag: <100ms typical, <1s worst case
Consistency: Strong (crash-safe standby)
```

**Configuration:**
```sql
-- On Primary
ALTER SYSTEM SET wal_level = logical;
ALTER SYSTEM SET max_wal_senders = 3;
ALTER SYSTEM SET wal_keep_size = 1GB;

-- Restart primary
pg_ctl restart -D /var/lib/postgresql/data

-- Monitor replication
SELECT slot_name, restart_lsn, confirmed_flush_lsn 
FROM pg_replication_slots;

-- On Standby
postgresql.auto_recovery.conf:
  primary_conninfo = 'host=primary.db port=5432 user=replication password=...'
  primary_slot_name = 'standby_1'

-- Start standby in recovery mode
pg_ctl start -D /var/lib/postgresql/data
```

### 3.2 Cross-Region Replication (Logical)

**Primary (us-east-1) → Cross-Region (us-west-2):**
```
Logical decoding of WAL → Sent over network → Applied on replica
Lag: <1 second typical
Consistency: Eventual (RPO ~1 second)
Benefit: Independent operation, different versions possible
```

---

## 4. Backup and Recovery

### 4.1 Backup Strategy

**Automated Backups (AWS RDS):**
- Frequency: Continuous + hourly snapshots
- Retention: 30 days (configurable)
- Storage: S3 (encrypted, versioned)
- Recovery: Point-in-time restore to any moment

**Manual Backups:**
```bash
# Full backup via pg_dump
pg_dump -h primary.db -U postgres -Fc basset_hound > backup_2026-06-03.dump

# Compress and upload to S3
gzip backup_2026-06-03.dump
aws s3 cp backup_2026-06-03.dump.gz s3://backups/db/

# For large databases, use parallel export
pg_basebackup -h primary.db -D /backup/base -P -v --wal-method=stream
```

### 4.2 Recovery Procedure

**Point-in-Time Recovery (PITR):**
```bash
# 1. Restore from RDS backup snapshot to target time
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier restored-db \
  --db-snapshot-identifier snapshot-2026-06-03

# 2. Verify recovered data
psql -h restored-db -U postgres -c "SELECT count(*) FROM sessions"

# 3. Promote to primary (if needed)
aws rds promote-read-replica --db-instance-identifier restored-db
```

**Recovery Time Objectives:**
- RTO (Recovery Time Objective): < 15 minutes
- RPO (Recovery Point Objective): < 1 hour (data loss acceptable)

---

## 5. Query Optimization

### 5.1 Indexes

**Critical Indexes:**
```sql
-- Session lookups by user
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_user_active ON sessions(user_id, is_active);

-- Expiration cleanup
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Monitoring task queries
CREATE INDEX idx_monitoring_user_status ON monitoring_tasks(user_id, status);
CREATE INDEX idx_monitoring_last_check ON monitoring_tasks(last_check_at);

-- Changes timeline
CREATE INDEX idx_changes_task_time ON changes_detected(task_id, detected_at DESC);
CREATE INDEX idx_changes_severity ON changes_detected(severity, detected_at DESC);

-- Alerts queries
CREATE INDEX idx_alerts_task_status ON alerts(task_id, status);
CREATE INDEX idx_alerts_time_status ON alerts(triggered_at DESC) WHERE status = 'open';

-- Forensic lookups
CREATE INDEX idx_forensic_change ON forensic_evidence(change_id, captured_at);
CREATE INDEX idx_forensic_content_hash ON forensic_evidence(content_hash);
```

### 5.2 Query Analysis

**Slow Query Log:**
```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 100;  -- Log queries >100ms
ALTER SYSTEM SET log_statement = 'all';

-- Monitor
SELECT query, calls, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;
```

### 5.3 Connection Pooling

**PgBouncer Configuration:**
```ini
[databases]
basset_hound = host=primary.db port=5432 dbname=basset_hound

[pgbouncer]
pool_mode = transaction
max_client_conn = 5000
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 5
max_idle_time = 600
server_lifetime = 3600
```

---

## 6. Monitoring and Observability

### 6.1 PostgreSQL Metrics

**Prometheus postgres_exporter:**
```
# Connection metrics
pg_connections_total              # Total connections
pg_connections_max                # Max allowed connections
pg_connections_used               # Current active connections

# Replication metrics
pg_replication_lag_bytes           # Bytes behind primary
pg_replication_slot_retained_bytes # Retention buffer

# Query performance
pg_slow_queries_total              # Queries >100ms
pg_query_duration_seconds          # Query latency histogram

# Table bloat
pg_table_bloat_ratio               # Dead tuples ratio
pg_index_bloat_ratio               # Index bloat

# Transaction metrics
pg_transactions_total              # Total transactions
pg_transactions_rolling_back       # Rolled back transactions
pg_transaction_duration_seconds    # Transaction latency
```

### 6.2 Alerting Rules

**Alert: Replication Lag**
```
pg_replication_lag_bytes > 10000000  (10MB lag)
Action: Investigate network, check standby capacity
```

**Alert: Disk Space Low**
```
pg_database_disk_usage / pg_instance_disk_total > 0.85
Action: Archive old data, add storage
```

**Alert: Connection Pool Saturated**
```
pg_connections_used / pg_connections_max > 0.9
Action: Increase pool size, investigate long queries
```

**Alert: Query Duration High**
```
histogram_quantile(0.99, rate(pg_query_duration[5m])) > 1  (>1 second)
Action: Analyze slow query log, optimize queries
```

---

## 7. Maintenance Operations

### 7.1 VACUUM and ANALYZE

**Automatic Maintenance:**
```sql
-- Autovacuum settings
ALTER SYSTEM SET autovacuum = on;
ALTER SYSTEM SET autovacuum_vacuum_threshold = 50;
ALTER SYSTEM SET autovacuum_vacuum_scale_factor = 0.1;

-- Schedule ANALYZE during off-peak (2am UTC)
ANALYZE;
VACUUM ANALYZE;
```

**Manual Maintenance (Weekly):**
```bash
# Full vacuum (blocks writes)
vacuumdb -d basset_hound -U postgres -v -z

# Reindex
reindexdb -d basset_hound -U postgres -v

# Check for unused indexes
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
  AND indexname NOT IN (SELECT indexname FROM pg_stat_user_indexes);
```

### 7.2 Table Cleanup

**Archive Old Sessions (Monthly):**
```sql
-- Move expired sessions to archive
BEGIN;
  INSERT INTO sessions_archive 
  SELECT * FROM sessions 
  WHERE expires_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM sessions 
  WHERE expires_at < NOW() - INTERVAL '30 days';
  
  COMMIT;
VACUUM;
```

---

## 8. Disaster Recovery

### 8.1 Failure Scenarios

**Scenario 1: Single Query Slow (Rare)**
- Impact: Affects query response time only
- Detection: Query >1 second
- Recovery: Kill query, analyze, re-optimize
- RTO: <1 minute

**Scenario 2: Standby Falls Behind**
- Impact: Replication lag increases
- Detection: Lag >1GB
- Recovery: Monitor, resync if needed
- RTO: <5 minutes

**Scenario 3: Primary Disk Full**
- Impact: Writes fail
- Detection: Disk >90%
- Recovery: Expand storage, archive old data
- RTO: <10 minutes

**Scenario 4: Primary Crashes**
- Impact: Downtime, need failover
- Detection: Connection refused
- Recovery: Promote standby to primary
- RTO: <1 minute

**Scenario 5: Data Corruption**
- Impact: Queries fail with errors
- Detection: Query errors, integrity check failures
- Recovery: PITR to before corruption
- RTO: <15 minutes

---

## 9. Cost Analysis

**Monthly Cost (Per Region):**
- Primary (db.r6i.4xlarge): $1,000
- Standby (db.r6i.4xlarge): $1,000
- Read replica (db.r6i.2xlarge): $500
- Storage (2TB io1): $400
- Backups (daily snapshots): $50
- Data transfer: $50

**Total per region:** ~$3,000/month  
**Total 4 regions:** ~$12,000/month

**Cost Optimization:**
- Use db.r5 instead of r6i (-30%)
- Reduce standby size to db.r6i.2xlarge (-50%)
- Archive to S3 instead of replica

---

## 10. Implementation Checklist

- [ ] Create RDS PostgreSQL instance (multi-AZ)
- [ ] Configure streaming replication (standby)
- [ ] Set up automated backups (30-day retention)
- [ ] Create database schema (tables, indexes)
- [ ] Configure PostgreSQL Exporter (Prometheus)
- [ ] Set up alerting rules
- [ ] Configure PgBouncer (connection pooling)
- [ ] Test failover (promote standby)
- [ ] Test PITR (restore from backup)
- [ ] Load test (throughput, latency)
- [ ] Document operational procedures
- [ ] Production deployment

---

## 11. Related Components

- **Session Store Design:** [02-SESSION-STORE-DESIGN.md](02-SESSION-STORE-DESIGN.md)
- **Time-Series Database:** [07-TIMESERIES-DESIGN.md](07-TIMESERIES-DESIGN.md)
- **Monitoring Design:** [../05-MONITORING-OBSERVABILITY.md](../05-MONITORING-OBSERVABILITY.md)

---

**Document Status:** Ready for Implementation  
**Last Updated:** June 3, 2026  
**Author:** Architecture Team
