# Database Migration Playbook - v12.0.0+

**Document Version:** 1.0  
**Last Updated:** June 13, 2026  
**Classification:** Internal Operations  
**Duration:** 1-2 hours depending on database size  
**Owner:** Database Administrator / Release Engineering  

---

## Executive Summary

This playbook provides detailed procedures for executing zero-downtime database schema migrations as part of deployment. Database migrations are necessary when a new version introduces schema changes (new tables, modified columns, removed columns, index changes, etc.).

**Key Principles:**
1. **Zero Downtime** - Migrations execute while application is serving traffic
2. **Backward Compatibility** - New code works with both old and new schemas
3. **Rollback Capability** - Migrations can be reversed if issues occur
4. **Validation** - Data integrity verified at every step

**Trigger:** Only run when v12.0.0 introduces database schema changes that require migration.

**Prerequisites:**
- Database backup verified and accessible
- Migration scripts tested in staging
- Rollback procedures validated
- All team members briefed on schedule

---

## Pre-Migration Phase (30 minutes)

### 1.1 Migration Readiness Assessment (15 minutes)

**Responsible Party:** Database Administrator  
**Time Box:** 15 minutes

#### 1.1.1 Schema Analysis

- [ ] v12.0.0 schema changes identified
  - New tables: __________
  - Modified tables: __________
  - Deleted tables: __________
  - Index changes: __________
  - Constraint changes: __________

- [ ] Backward compatibility verified
  - v11.3.0 can read new schema: [ ] Yes [ ] No
  - v12.0.0 can use old schema (initially): [ ] Yes [ ] No
  - No breaking changes: [ ] Confirmed [ ] Issues found

- [ ] Migration complexity assessed
  - [ ] Low: Additive only (new columns, new tables)
  - [ ] Medium: Some modifications, no data reorganization
  - [ ] High: Column renames, data type changes, complex transformations

#### 1.1.2 Database Impact Analysis

- [ ] Database size analyzed
  - Current size: __________GB
  - Largest table: __________
  - Table size: __________GB
  - Estimated migration time: __________minutes

- [ ] Performance impact estimated
  - Estimated CPU overhead: __________%
  - Estimated I/O overhead: __________%
  - Expected lock duration: __________seconds per operation
  - Risk to live queries: [ ] Low [ ] Medium [ ] High

- [ ] Replication impact analyzed
  - Replica lag tolerance: __________ms
  - Estimated replica lag during migration: __________ms
  - Acceptable: [ ] Yes [ ] No

#### 1.1.3 Backup & Recovery Readiness

- [ ] Full backup created
  - Backup time: __________
  - Backup location: __________
  - Backup size: __________GB
  - Backup verified: [ ] Yes [ ] No
  - Restore test completed: [ ] Yes [ ] No
  - Estimated restore time: __________minutes

- [ ] Point-in-time recovery tested
  - Can restore to pre-migration state: [ ] Yes [ ] No
  - PITR method: __________
  - Estimated recovery time: __________minutes

- [ ] Replica servers ready as fallback
  - Read-only replicas available: __________
  - Can promote to primary: [ ] Yes [ ] No
  - Estimated promotion time: __________minutes

### 1.2 Migration Script Validation (10 minutes)

**Responsible Party:** DBA + Release Engineer  
**Time Box:** 10 minutes

#### 1.2.1 Migration Scripts Review

- [ ] Forward migration script reviewed
  - File: `./scripts/db/migrate-v11.3.0-to-v12.0.0.sql`
  - Changes: __________
  - Reviewed by: __________

- [ ] Rollback migration script reviewed
  - File: `./scripts/db/rollback-v11.3.0-to-v12.0.0.sql`
  - Changes: __________
  - Reviewed by: __________

- [ ] Scripts tested in staging database
  - Staging database size: __________GB (similar to production)
  - Forward migration test: [ ] Passed [ ] Failed
  - Rollback migration test: [ ] Passed [ ] Failed
  - Data integrity verified: [ ] Yes [ ] No

#### 1.2.2 Validation Queries Prepared

- [ ] Pre-migration validation query
  - Query file: `./scripts/db/validate-pre-migration.sql`
  - Expected results: __________
  - Baseline metrics captured: [ ] Yes [ ] No

- [ ] Post-migration validation query
  - Query file: `./scripts/db/validate-post-migration.sql`
  - Expected results: __________
  - Comparison method: [ ] Row count [ ] Checksum [ ] Custom ]

- [ ] Data integrity validation
  - Query file: `./scripts/db/check-integrity.sql`
  - Expected: 0 data issues
  - Integrity checks comprehensive: [ ] Yes [ ] No

### 1.3 Communication & Scheduling (5 minutes)

**Responsible Party:** Deployment Lead  
**Time Box:** 5 minutes

#### 1.3.1 Migration Window Scheduled

- [ ] Migration window selected
  - Date: __________
  - Start time: __________
  - Planned duration: __________minutes
  - End time: __________
  - Padding: +30 minutes contingency

- [ ] Off-peak confirmation
  - Peak traffic typically: __________
  - Selected window is off-peak: [ ] Yes [ ] No
  - Expected user impact: Minimal / None

#### 1.3.2 Team Assembled

- [ ] Database Administrator assigned: __________
- [ ] Release Engineer assigned: __________
- [ ] Monitoring/Observability person: __________
- [ ] On-call backup: __________
- [ ] Management aware: [ ] Yes [ ] No

#### 1.3.3 Communications Sent

- [ ] Engineering team notified
  - Message: "Database migration scheduled for [time]"
  - Expected downtime: None (zero-downtime procedure)
  - Duration: __________minutes

- [ ] Customer notifications (if required)
  - Message: "Planned maintenance [time] - minimal impact expected"
  - Channel: Email, status page
  - Sent: [ ] Yes [ ] No

---

## Migration Execution Phase (30-60 minutes)

### 2.1 Pre-Migration Snapshot (5 minutes)

**Responsible Party:** Database Administrator  
**Time Box:** 5 minutes

#### 2.1.1 System State Capture

- [ ] Pre-migration metrics captured
  - Command: `./scripts/db/get-db-metrics.sh`
  - Metrics file: `/var/log/migration/pre-migration-metrics-[timestamp].json`
  - Includes:
    - Table sizes
    - Index sizes
    - Query counts
    - Connection count
    - Replication lag

- [ ] Pre-migration data snapshot
  - Command: `./scripts/db/validate-pre-migration.sql`
  - Output file: `/var/log/migration/pre-migration-validation-[timestamp].log`
  - Results: __________

- [ ] Application state verified
  - No long-running queries: [ ] Verified [ ] Needs investigation
  - All connections healthy: [ ] Yes [ ] No
  - Application ready: [ ] Yes [ ] No

#### 2.1.2 Final Confirmation

**GATE: All pre-migration checks passed before proceeding**

- [ ] Database: Ready
- [ ] Scripts: Tested
- [ ] Backups: Verified
- [ ] Team: Assembled
- [ ] Application: Healthy

**Migration authorized to proceed:** [ ] YES / [ ] NO

**Authorized by:** _________________ **Time:** __________

### 2.2 Migration Execution (15-45 minutes depending on size)

**Responsible Party:** Database Administrator  
**Time Box:** Varies by database size

#### 2.2.1 Phase 1: Non-Breaking Changes (Additive)

**These changes do NOT require locks and can run anytime:**

- [ ] New tables created
  - Command: `mysql < ./scripts/db/01-create-new-tables.sql`
  - New tables: __________
  - Execution time: __________seconds
  - Status: [ ] Complete [ ] Failed

- [ ] New columns added (NOT in existing queries yet)
  - Command: `mysql < ./scripts/db/02-add-new-columns.sql`
  - New columns: __________
  - Execution time: __________seconds
  - Status: [ ] Complete [ ] Failed

- [ ] New indexes created (in background)
  - Command: `mysql < ./scripts/db/03-create-new-indexes.sql`
  - New indexes: __________
  - Execution time: __________seconds
  - Status: [ ] Complete [ ] Failed

**Time elapsed so far:** __________minutes

#### 2.2.2 Phase 2: Verify Migration Progress

- [ ] Schema changes applied successfully
  - Command: `./scripts/db/verify-schema-changes.sql`
  - Expected: All new objects created
  - Actual: __________

- [ ] Data still accessible
  - Command: `SELECT COUNT(*) FROM [key_table]`
  - Expected: Correct count
  - Actual: __________

- [ ] Application queries still work
  - Test: `./scripts/db/test-app-queries.sql`
  - Expected: All queries successful
  - Failures: __________

#### 2.2.3 Phase 3: Breaking Changes (if required)

**Only if necessary - these require brief locks:**

- [ ] Constraint changes applied
  - Command: `mysql < ./scripts/db/04-modify-constraints.sql`
  - Expected lock time: __________seconds
  - Actual lock time: __________seconds
  - Status: [ ] Complete [ ] Failed

- [ ] Column type modifications (if any)
  - Command: `mysql < ./scripts/db/05-modify-columns.sql`
  - Expected lock time: __________seconds
  - Actual lock time: __________seconds
  - Status: [ ] Complete [ ] Failed

**Total migration execution time:** __________minutes

### 2.3 Migration Verification (10 minutes)

**Responsible Party:** Database Administrator + Release Engineer  
**Time Box:** 10 minutes

#### 2.3.1 Schema Verification

- [ ] All schema changes applied
  - Command: `./scripts/db/verify-final-schema.sql`
  - Expected: All changes present
  - Actual: __________

- [ ] No unintended changes
  - Extra tables: __________
  - Extra columns: __________
  - Unexpected indexes: __________

- [ ] Schema version recorded
  - Command: `UPDATE schema_version SET version = 'v12.0.0' WHERE id = 1`
  - Verification: `SELECT version FROM schema_version`
  - Result: v12.0.0

#### 2.3.2 Data Integrity Verification

- [ ] Data count verified
  - Command: `./scripts/db/validate-post-migration.sql`
  - Pre-migration counts: __________
  - Post-migration counts: __________
  - Mismatches: __________

- [ ] Data checksums validated (if applicable)
  - Key tables checksummed: [ ] Yes [ ] No
  - Pre-migration checksums match: [ ] Yes [ ] No

- [ ] No orphaned data
  - Check for orphaned records: [ ] Complete
  - Issues found: __________

#### 2.3.3 Performance Verification

- [ ] Query performance acceptable
  - Test query 1: __________ms (was __________ms)
  - Test query 2: __________ms (was __________ms)
  - Performance degradation: [ ] None [ ] Minimal [ ] Significant

- [ ] Index effectiveness verified
  - Test query using new index: __________ms
  - Expected: Sub-100ms queries
  - Status: [ ] Optimal [ ] Acceptable [ ] Investigate

- [ ] No lock contention observed
  - Long-running queries: __________
  - Lock waits: __________
  - Status: [ ] Normal [ ] Concerning

#### 2.3.4 Replication Health Check

- [ ] Replica replication lag acceptable
  - Replication lag: __________seconds
  - Expected: <5 seconds
  - Status: [ ] Healthy [ ] Monitor [ ] Alert

- [ ] Replica has all changes
  - Replica schema version: __________
  - Expected: v12.0.0
  - Status: [ ] Synced [ ] Lagging [ ] Failed

- [ ] Replica data integrity verified
  - Data checksums match primary: [ ] Yes [ ] No
  - Row counts match: [ ] Yes [ ] No

#### 2.3.5 Application Compatibility Check

- [ ] v11.3.0 can read new schema
  - Test: Connect v11.3.0 and query new columns
  - Result: [ ] Success (backward compatible) [ ] Failure (issue)

- [ ] v12.0.0 can read both old and new columns
  - Test: Connect v12.0.0 and query all columns
  - Result: [ ] Success [ ] Failure

### 2.4 Migration Success Confirmation

**All verification items must pass before proceeding**

#### 2.4.1 Sign-Off

| Item | Status | DBA | Eng |
|------|--------|-----|-----|
| Schema correct | ✓/✗ | ___ | ___ |
| Data complete | ✓/✗ | ___ | ___ |
| Integrity OK | ✓/✗ | ___ | ___ |
| Performance OK | ✓/✗ | ___ | ___ |
| Replication OK | ✓/✗ | ___ | ___ |
| App compatible | ✓/✗ | ___ | ___ |

**MIGRATION SUCCESSFUL:** [ ] YES / [ ] NO

**Signed off by:** 
- DBA: _________________ **Time:** __________
- Engineer: _________________ **Time:** __________

---

## Post-Migration Phase (10 minutes)

### 3.1 Deployment Coordination

**Responsible Party:** Release Engineer  
**Time Box:** 10 minutes

#### 3.1.1 v12.0.0 Deployment Proceed

- [ ] Message to deployment team
  - Message: "Database migration complete and verified. Safe to proceed with v12.0.0 deployment."
  - Message time: __________

- [ ] v12.0.0 deployment initiated
  - Deployment method: Canary / Progressive rollout
  - First traffic direction: Proceed
  - Time deployment started: __________

#### 3.1.2 Monitoring During Application Deployment

- [ ] Monitoring team observing metrics
  - Error rates: __________
  - Latency: __________
  - Database queries: __________

- [ ] No additional issues emerging
  - New issues detected: [ ] None [ ] Some (document)
  - If issues: Root cause analysis needed before full rollout

### 3.2 Post-Migration Cleanup

**Responsible Party:** Database Administrator  
**Timing:** After application stable (1-2 hours post-migration)

#### 3.2.1 Cleanup Tasks

- [ ] Old (unused) tables cleaned up (if applicable)
  - Tables removed: __________
  - Data preserved elsewhere: [ ] Yes [ ] No

- [ ] Old indexes dropped (if applicable)
  - Indexes removed: __________
  - Verification: No performance impact: [ ] Confirmed [ ] Monitor

- [ ] Migration scripts archived
  - Location: `/var/log/migration/scripts/[timestamp]/`
  - Backed up: [ ] Yes [ ] No

#### 3.2.2 Documentation Updated

- [ ] Schema documentation updated
  - File: `/docs/database/SCHEMA-v12.0.0.md`
  - Updated by: __________
  - Changes documented: __________

- [ ] Data dictionary updated
  - New columns documented: [ ] Yes [ ] No
  - Data types documented: [ ] Yes [ ] No
  - Constraints documented: [ ] Yes [ ] No

---

## Migration Rollback (If Required)

### 4.1 Rollback Decision (Immediate if issues arise)

**Responsible Party:** Database Administrator + Engineering Lead  

**Triggers for rollback:**
- [ ] Data corruption detected
- [ ] Critical performance degradation (>50% slowdown)
- [ ] Schema incompatibilities causing application errors
- [ ] Replication issues preventing failover

#### 4.1.1 Rollback Impact Assessment

- [ ] Current application version: __________
  - If v12.0.0 not yet deployed: Rollback only DB, app unaffected
  - If v12.0.0 deployed: Will need version downgrade too

- [ ] Data loss risk assessment
  - Changes since migration: __________
  - Would need: Restore from post-migration backup
  - Time to restore: __________minutes

### 4.2 Rollback Execution (5-10 minutes)

#### 4.2.1 Immediate Mitigation

- [ ] Stop application writes
  - Set database to read-only: [ ] Yes [ ] No
  - Affected services: __________
  - Expected service impact: Degradation until resolved

- [ ] Stop replication (to prevent bad data propagating)
  - Command: `STOP SLAVE;` (on replica)
  - Replica state saved: [ ] Yes [ ] No

#### 4.2.2 Rollback Migration

- [ ] Rollback migration script executed
  - Command: `mysql < ./scripts/db/rollback-v12.0.0-to-v11.3.0.sql`
  - Execution time: __________seconds
  - Status: [ ] Complete [ ] Failed

- [ ] Schema verification after rollback
  - Command: `./scripts/db/verify-schema-v11.3.0.sql`
  - Expected: v11.3.0 schema restored
  - Actual: __________

#### 4.2.3 Replication Restart

- [ ] Replica restarted
  - Command: `START SLAVE;`
  - Replication status: [ ] Healthy [ ] Lagging [ ] Failed

- [ ] Data consistency verified post-rollback
  - Checksums match: [ ] Yes [ ] No
  - Row counts match: [ ] Yes [ ] No

#### 4.2.4 Application Recovery

- [ ] Application switched back to v11.3.0 (if necessary)
  - See Rollback Playbook for procedures
  - Time to switch: __________

- [ ] Full system stability verified
  - Error rates: __________%
  - Latency: __________ms
  - Status: [ ] Stable [ ] Degraded [ ] Critical

### 4.3 Post-Rollback Analysis

- [ ] Root cause analysis underway
  - Issue: __________
  - Cause: __________
  - Fix: __________

- [ ] Migration script updated for retry
  - Issue addressed in script: [ ] Yes [ ] No
  - Script tested in staging: [ ] Yes [ ] No

- [ ] Postmortem scheduled
  - Meeting time: __________
  - Expected: Identify why migration failed and prevent recurrence

---

## Appendix A: Migration Scripts Template

### A.1 Forward Migration Script

```sql
-- migrate-v11.3.0-to-v12.0.0.sql
-- Migration script from v11.3.0 schema to v12.0.0

START TRANSACTION;

-- Phase 1: Create new tables
CREATE TABLE IF NOT EXISTS session_metadata (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSON
);

-- Phase 2: Add new columns (backward compatible)
ALTER TABLE browser_sessions
  ADD COLUMN fingerprint_score INT DEFAULT 0,
  ADD COLUMN evasion_level VARCHAR(50) DEFAULT 'standard';

-- Phase 3: Create new indexes
CREATE INDEX idx_fingerprint_score ON browser_sessions(fingerprint_score);
CREATE INDEX idx_evasion_level ON browser_sessions(evasion_level);

-- Update schema version
UPDATE schema_version SET version = 'v12.0.0', migrated_at = NOW() WHERE id = 1;

COMMIT;
```

### A.2 Validation Script

```sql
-- validate-post-migration.sql
-- Validates migration completed successfully

-- Check schema version
SELECT version FROM schema_version;

-- Check new tables exist
SHOW TABLES LIKE 'session_metadata';

-- Check new columns exist
DESCRIBE browser_sessions;

-- Verify data integrity
SELECT 
  (SELECT COUNT(*) FROM browser_sessions) as session_count,
  (SELECT COUNT(*) FROM session_metadata) as metadata_count;

-- Check for orphaned records
SELECT COUNT(*) as orphaned_count
FROM session_metadata sm
WHERE NOT EXISTS (
  SELECT 1 FROM browser_sessions bs 
  WHERE bs.id = sm.session_id
);
```

---

## Appendix B: Migration Metrics Template

```
DATABASE MIGRATION REPORT - v11.3.0 → v12.0.0

Start Time: __________
Completion Time: __________
Total Duration: __________ minutes

PRE-MIGRATION METRICS:
- Database Size: __________GB
- Largest Table: __________ (__________GB)
- Total Rows: __________
- Total Connections: __________
- Replication Lag: __________ms

MIGRATION PHASES:
- Phase 1 (Additive): __________ seconds
- Phase 2 (Breaking): __________ seconds
- Phase 3 (Verification): __________ seconds

POST-MIGRATION METRICS:
- Database Size: __________GB
- Total Rows: __________ (same as pre: ✓/✗)
- Data Integrity: ✓ Verified
- Query Performance: ✓ Acceptable
- Replication Lag: __________ms (healthy: ✓/✗)

ISSUES ENCOUNTERED:
- Count: __________
- Issues: __________
- Resolved: ✓

SIGN-OFF:
- DBA: _________________ Time: __________
- Engineer: _________________ Time: __________
```

---

## Appendix C: Zero-Downtime Migration Checklist

- [ ] All schema changes are additive (new tables/columns first)
- [ ] Breaking changes applied after non-breaking ones
- [ ] Locks on large tables minimized (<30 seconds)
- [ ] Application code backwards compatible
- [ ] Replicas can apply changes without issues
- [ ] Data migration scripts idempotent (safe to retry)
- [ ] Rollback scripts tested thoroughly
- [ ] Monitoring active for long-running queries
- [ ] No DDL operations during peak traffic
- [ ] Team fully prepared and briefed
