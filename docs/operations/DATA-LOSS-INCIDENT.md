# Data Loss / Corruption Incident Playbook

**Document Version:** 1.0  
**Last Updated:** June 13, 2026  
**Classification:** Internal Operations  
**Severity:** P1 (Critical)  

---

## Executive Summary

This playbook provides procedures for responding to data loss or corruption incidents. These are critical incidents requiring immediate action to prevent further data loss and restore integrity.

**Objective:** Contain the incident, assess damage, and restore data from backup within 1-2 hours.

---

## Immediate Actions (First 5 minutes)

### 1.1 Incident Confirmation

- [ ] Data loss/corruption confirmed
  - Type: [ ] Data deletion [ ] Data corruption [ ] Schema damage
  - Scope: __________
  - Estimated records affected: __________
  - Time detected: __________

- [ ] Severity assessment: **P1 - CRITICAL**
  - All executives notified immediately
  - War room opened
  - CEO/VP notified

### 1.2 Immediate Containment

**STOP ALL WRITES immediately:**

- [ ] Set database to read-only
  ```sql
  SET GLOBAL read_only = ON;
  ```
  - Time: __________
  - Confirmed: [ ] Yes [ ] No

- [ ] Stop application writes if possible
  - Set application env: `READONLY_MODE=true`
  - Restart application if needed
  - Verify: No writes occurring

- [ ] Stop replication (prevent bad data propagating)
  ```sql
  STOP SLAVE;
  ```
  - Time: __________
  - Confirmed: [ ] Yes [ ] No

- [ ] Disable automatic backups (preserve current state)
  - Command: Pause backup jobs
  - Time: __________

### 1.3 Evidence Preservation

- [ ] Capture current state (for investigation)
  - Command: `mysqldump > /backup/current-state-[timestamp].sql`
  - Size: __________MB
  - Location: __________

- [ ] Take filesystem snapshot (if applicable)
  - Command: `lvcreate -L10G -s -n recovery-snapshot /dev/vg/data`
  - Snapshot name: __________

- [ ] Collect relevant logs
  - Binlog position: __________
  - Last write time: __________
  - Query before loss: __________

---

## Assessment Phase (10-15 minutes)

### 2.1 Damage Assessment

#### 2.1.1 Scope of Data Loss

- [ ] Affected tables
  - Table 1: __________
  - Table 2: __________
  - Estimated rows lost: __________

- [ ] Time window of loss
  - First loss detected: __________
  - Last known good backup: __________
  - Data loss window: __________ hours

- [ ] Recovery options
  - [ ] Restore from backup (all changes since backup lost)
  - [ ] Recover from binlog/WAL (if loss is recent)
  - [ ] Manual data reconstruction (if critical data and recent loss)

#### 2.1.2 Customer Impact Assessment

- [ ] Number of customers affected
  - Estimated: __________
  - Confirmed: __________

- [ ] Data affected by customer
  - Customer A: __________ records lost
  - Customer B: __________ records lost
  - Average impact: __________ records per customer

- [ ] Service availability
  - Can we restore service: [ ] Yes [ ] Partially [ ] No
  - Estimated time to restore: __________minutes

### 2.2 Recovery Path Selection

#### Path A: Restore from Recent Backup (Preferred)

**Situation:** Recent backup available, acceptable data loss window

```
Estimated Time: 30-60 minutes
Data Loss: Since last backup (typically <24 hours)
Action: Full database restore from backup
```

- [ ] Last backup available
  - Backup time: __________
  - Backup size: __________GB
  - Backup location: __________
  - Backup verified: [ ] Yes [ ] No

- [ ] Estimated restore time: __________minutes
- [ ] Data loss window acceptable: [ ] Yes [ ] No (escalate if too large)

#### Path B: Recover from Binlog/Transaction Log

**Situation:** Loss detected immediately, recent backup exists

```
Estimated Time: 15-45 minutes
Data Loss: Only corrupted/deleted data (minimal)
Action: Restore backup + replay clean transactions
```

- [ ] Binlog available since backup
  - Binlog location: __________
  - Binlog size: __________MB
  - Can replay selectively: [ ] Yes [ ] No

- [ ] Can identify good vs bad transactions
  - DML statements identified: [ ] Yes [ ] No
  - Bad transactions: __________
  - Can filter out bad transactions: [ ] Yes [ ] No

#### Path C: Manual Data Reconstruction

**Situation:** Critical data, recent loss, backups available

```
Estimated Time: 2-4 hours
Data Loss: None
Action: Manually reconstruct lost data from multiple sources
```

- [ ] Source of data reconstruction
  - Customer has copy: [ ] Yes [ ] No
  - Audit log has record: [ ] Yes [ ] No
  - Third-party system has copy: [ ] Yes [ ] No

- [ ] Feasibility assessment
  - Effort required: __________hours
  - Accuracy: __________% confidence
  - Manual process documented: [ ] Yes [ ] No

### 2.3 Recovery Path Decision

**Select one:**

- [ ] **Path A: Full restore from backup**
  - Estimated recovery time: 30-60 min
  - Acceptable data loss: __________ hours
  - Authorization: _________________ Time: __________

- [ ] **Path B: Binlog recovery**
  - Estimated recovery time: 15-45 min
  - Acceptable data loss: __________ minutes
  - Authorization: _________________ Time: __________

- [ ] **Path C: Manual reconstruction**
  - Estimated recovery time: 2-4 hours
  - No data loss, but longer timeline
  - Authorization: _________________ Time: __________

---

## Recovery Execution (30-120 minutes)

### 3.1 Backup Restore (If Path A)

#### 3.1.1 Restore Preparation

- [ ] Backup integrity verified
  - Command: `mysql < /backup/verify-backup.sql`
  - Status: [ ] Valid [ ] Corrupted [ ] Incomplete

- [ ] Recovery database prepared
  - Option 1: Use replica as recovery target
  - Option 2: Create new database instance
  - Option 3: Restore to different disk, then swap
  - Selected: __________

- [ ] Restore command prepared
  - Command: `mysql < /backup/db-[timestamp].sql`
  - Expected duration: __________minutes
  - Storage required: __________GB

#### 3.1.2 Restore Execution

- [ ] Restore started
  - Start time: __________
  - Expected completion: __________

- [ ] Restore progress monitored
  - Rows restored: __________
  - Progress: __________%
  - Time elapsed: __________

- [ ] Restore completed
  - Completion time: __________
  - Total duration: __________minutes
  - Errors: __________

#### 3.1.3 Post-Restore Validation

- [ ] Restored data validated
  - Record counts match: [ ] Yes [ ] No
  - Sample records spot-checked: [ ] Yes [ ] No
  - Checksums match: [ ] Yes [ ] No

- [ ] Indexes rebuilding
  - Command: `OPTIMIZE TABLE [table];`
  - Duration: __________minutes

- [ ] Recovery database brought online
  - Binlog enabled: [ ] Yes [ ] No
  - Health checks: [ ] Passing [ ] Failing

### 3.2 Binlog Recovery (If Path B)

#### 3.2.1 Binlog Analysis

- [ ] Binlog position identified
  - Backup position: __________
  - Current position: __________
  - Binlog file: __________

- [ ] Bad transactions identified
  - Corrupting statement: __________
  - Statement position: __________
  - Statement time: __________

- [ ] Recovery plan developed
  - Replay until: __________ (before bad transaction)
  - Or skip bad transactions using: __________

#### 3.2.2 Selective Binlog Replay

- [ ] Restore backup first
  - (Same as Path A steps 3.1.1-3.1.3)

- [ ] Replay clean transactions
  - Command: `mysqlbinlog --stop-position=123456 binlog-file | mysql`
  - Transactions replayed: __________
  - Duration: __________minutes

- [ ] Verify recovered data
  - Data integrity: [ ] Confirmed [ ] Issues
  - Performance: [ ] Normal [ ] Degraded

### 3.3 Replication Resync

After restore using either path:

- [ ] Replica replication caught up
  - Replication lag: __________seconds
  - Expected: <10 seconds
  - Status: [ ] Healthy [ ] Lagging [ ] Failed

- [ ] Replication enabled
  - Command: `START SLAVE;`
  - Status: [ ] Running [ ] Failed

- [ ] Replica data matches primary
  - Checksums: [ ] Match [ ] Different
  - Row counts: [ ] Match [ ] Different

---

## Service Recovery (10-20 minutes)

### 4.1 Database Online

- [ ] Database accepting writes
  - Set read-only OFF: `SET GLOBAL read_only = OFF;`
  - Time: __________
  - Verified: [ ] Yes [ ] No

- [ ] Replication healthy
  - Master-slave lag: __________ms
  - Both up to date: [ ] Yes [ ] No

### 4.2 Application Online

- [ ] Application in read-only mode disabled
  - Set `READONLY_MODE=false`
  - Restart application if needed
  - Verify: Application accepting writes

- [ ] Application data consistency verified
  - Sample queries run: [ ] Yes [ ] No
  - Expected results: [ ] Yes [ ] No

### 4.3 Service Availability Restored

- [ ] API responding normally
  - Health check: [ ] Passing [ ] Failing
  - Error rate: _________% (target: <0.1%)

- [ ] Customer-facing service operational
  - UI loading: [ ] Yes [ ] No
  - Core functions working: [ ] Yes [ ] No

---

## Post-Recovery

### 5.1 Customer Communication

- [ ] Incident timeline prepared
  - Loss detected: __________
  - Recovery started: __________
  - Recovery completed: __________
  - Total duration: __________minutes

- [ ] Impact statement prepared
  - Data lost: __________ records
  - Affected customers: __________
  - Recovery details: __________

- [ ] Customer notifications sent
  - Method: Email, phone calls, status page
  - Sent at: __________
  - Content: Apology, timeline, impact, recovery steps

### 5.2 Internal Investigation

- [ ] Root cause analysis scheduled
  - Meeting time: __________
  - Participants: Engineering, Database, Operations

- [ ] Questions to answer:
  - How did loss occur: __________
  - Why wasn't it caught earlier: __________
  - How to prevent recurrence: __________

### 5.3 Preventive Measures

- [ ] Backup frequency increased (if needed)
  - Current: __________ per day
  - New: __________ per day

- [ ] Backup monitoring improved
  - Alert on backup failure: [ ] Yes [ ] No
  - Backup verification added: [ ] Yes [ ] No

- [ ] Accidental delete detection
  - Audit logs enabled: [ ] Yes [ ] No
  - DELETE statement logging: [ ] Yes [ ] No
  - Soft deletes implemented: [ ] Yes [ ] No

- [ ] Access controls hardened
  - Drop/truncate permissions restricted: [ ] Yes [ ] No
  - Backup access limited: [ ] Yes [ ] No

---

## Appendix: Prevention Checklist

- [ ] Automated daily backups
- [ ] Backup integrity verification
- [ ] Backup restoration testing (monthly)
- [ ] Point-in-time recovery capability
- [ ] Replication enabled for failover
- [ ] Audit logs capturing all DDL/DML
- [ ] Delete operations require confirmation
- [ ] Backup encryption enabled
- [ ] Backup retention: 30+ days
- [ ] Disaster recovery runbook (current)
