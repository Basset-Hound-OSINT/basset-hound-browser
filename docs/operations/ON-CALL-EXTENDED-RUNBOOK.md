# Extended On-Call Runbook

**Document Version:** 1.0  
**Last Updated:** June 13, 2026  
**Classification:** Internal Operations  

---

## Executive Summary

This document provides comprehensive on-call procedures, responsibilities, escalation paths, and common troubleshooting steps.

---

## On-Call Schedule & Responsibilities

### Responsibilities

**Primary On-Call (L1):**
- Monitor alerts for first 5 minutes
- Acknowledge incident
- Perform initial triage
- Determine severity
- Escalate if needed within 10 minutes

**Secondary On-Call (L2):**
- Provide technical support to L1
- Take over if L1 unavailable
- Escalate to L3 if complex

**Infrastructure Lead (L3):**
- Handle complex infrastructure issues
- Authorize emergency changes
- Communicate with executives

**On-Call Manager:**
- Track incident status
- Manage communication
- Coordinate response team

### Coverage

**On-Call Schedule:**
- Timezone: UTC
- Mon-Fri: L1 + L2 coverage
- Sat-Sun: L1 + Manager coverage
- Holidays: Full team on-call

---

## Alerting & Triage

### Alert Channels

1. **PagerDuty** (critical)
   - P1 alerts → phone call + SMS
   - P2 alerts → SMS
   - P3 alerts → email

2. **Slack** (#incidents, #alerts)
   - Real-time alerts visible
   - Acknowledge in Slack
   - Start incident thread

3. **Status Page**
   - Update status.basset-hound.io
   - Communicate with customers

### Alert Response SLAs

| Severity | Acknowledge | Investigate | Escalate |
|----------|-------------|-------------|----------|
| P1 | 1 min | 5 min | 10 min |
| P2 | 5 min | 10 min | 15 min |
| P3 | 15 min | 30 min | 60 min |
| P4 | 30 min | 60 min | None |

---

## Escalation Paths

### Escalation Matrix

```
ALERT RECEIVED
    ↓
[Acknowledge within SLA]
    ↓
[Perform initial diagnosis]
    ↓
[Can resolve in 10 minutes?]
    ├─ YES → Resolve & document
    └─ NO → Escalate to L2
        ↓
    [Can resolve in 15 minutes?]
        ├─ YES → Resolve & document
        └─ NO → Escalate to L3
            ↓
        [P1 incident?]
            ├─ YES → Notify CEO/VP
            └─ NO → Continue resolution
```

### Escalation Contacts

| Level | Role | Phone | Slack | Email |
|-------|------|-------|-------|-------|
| L1 | On-Call Eng | _________ | _________ | _________ |
| L2 | Backend Lead | _________ | _________ | _________ |
| L3 | Infra Lead | _________ | _________ | _________ |
| Manager | Ops Manager | _________ | _________ | _________ |
| VP | VP Engineering | _________ | _________ | _________ |

---

## Common Issues Quick Reference

### Issue: API Returns 503 (Service Unavailable)

**Likely cause:** Application crashed or overloaded

```bash
# Check application health
curl http://api.basset-hound.prod/health

# Check if process is running
docker ps | grep basset-hound-browser

# Check container logs
docker logs basset-hound-browser --tail 50

# Restart if crashed
docker restart basset-hound-browser
```

**Mitigation:**
- [ ] Check error logs for crash reason
- [ ] Restart container
- [ ] If error repeats: Escalate to L2

---

### Issue: High Latency (P99 > 500ms)

**Likely cause:** Database slow, resource exhausted, or traffic spike

```bash
# Check database response time
./scripts/check-db-latency.sh

# Check CPU/Memory
docker stats --no-stream

# Check database connections
mysql -e "SHOW PROCESSLIST"

# Check slow query log
mysql -e "SHOW QUERIES"
```

**Mitigation:**
- [ ] Identify slow query (see HIGH-LATENCY-INCIDENT.md)
- [ ] If database issue: Escalate to DBA
- [ ] If app issue: Escalate to Backend Lead

**See:** `/docs/operations/HIGH-LATENCY-INCIDENT.md`

---

### Issue: High Error Rate (>1% errors)

**Likely cause:** Recent deployment, database error, or dependency failure

```bash
# Check error distribution
tail -1000 /var/log/application.log | grep ERROR

# Check application health
curl http://api.basset-hound.prod/health

# Check database
./scripts/check-db-connection.sh

# Check external dependencies
curl http://external-api/health
```

**Mitigation:**
- [ ] Identify error type (see HIGH-ERROR-RATE-INCIDENT.md)
- [ ] If recent deployment: Consider rollback
- [ ] If database: Check connection pool
- [ ] If dependency: Enable circuit breaker

**See:** `/docs/operations/HIGH-ERROR-RATE-INCIDENT.md`

---

### Issue: Memory Leak (Memory usage increasing)

**Likely cause:** Application memory leak or cache accumulation

```bash
# Monitor memory trend
watch -n 5 'docker stats --no-stream'

# Check for long-running queries
mysql -e "SHOW PROCESSLIST"

# Check application memory usage over time
./scripts/get-memory-trend.sh
```

**Mitigation:**
- [ ] Temporary: Increase memory limit
- [ ] Monitor if grows or stabilizes
- [ ] If rapid growth: Restart container
- [ ] Find and fix leak: Escalate to developer

---

### Issue: Database Replication Lag

**Likely cause:** Large transaction, slow replica, network latency

```bash
# Check replica status
mysql -e "SHOW SLAVE STATUS\G"

# Check replica lag
mysql -e "SHOW SLAVE STATUS\G" | grep Seconds_Behind_Master

# Check slow query log on replica
mysql -e "SHOW PROCESSLIST"
```

**Mitigation:**
- [ ] Check replica resources (CPU, I/O)
- [ ] Kill long-running query on primary
- [ ] Enable parallel replication (if available)
- [ ] Escalate to DBA if lag > 60 seconds

---

### Issue: Disk Space Low

**Likely cause:** Logs accumulating, large files not cleaned up

```bash
# Check disk usage
df -h

# Find large files
find / -type f -size +1G 2>/dev/null

# Check log directory
ls -lh /var/log
```

**Mitigation:**
- [ ] Archive old logs: `gzip /var/log/app.log*`
- [ ] Delete tmp files: `rm -rf /tmp/*`
- [ ] Increase disk if permanent solution needed
- [ ] Set up log rotation

---

### Issue: Unable to Connect to Database

**Likely cause:** Network issue, database down, or max connections reached

```bash
# Test network connectivity
ping database-host

# Check if database is running
nc -zv database-host 3306

# Check connection pool
mysql -e "SHOW STATUS LIKE 'Threads_connected'"

# Try to connect
mysql -h database-host -u user -p database
```

**Mitigation:**
- [ ] Verify network connectivity
- [ ] Check database process
- [ ] If connection pool full: Increase limit
- [ ] Escalate to DBA

---

## War Room Procedures

### Starting a War Room

1. [ ] Open Slack channel: `#incident-[incident-id]`
2. [ ] Invite: L1, L2, Manager, relevant specialists
3. [ ] Create conference bridge: [Add Zoom link]
4. [ ] Start recording: `zoom start record`
5. [ ] Set channel topic: `[Severity] [Service] - [Brief Description]`

### War Room Roles

| Role | Responsibility |
|------|-----------------|
| **Commander** | Overall incident status, decisions, escalation |
| **Scribe** | Document timeline, decisions, actions |
| **Technical Lead** | Direct resolution efforts |
| **Communicator** | Update status page, notify stakeholders |

### War Room Communication

**Updates every 10 minutes:**
- Current status
- Actions taken
- Next steps
- ETA to resolution

**Final communication:**
- Root cause identified
- Resolution completed
- Lessons learned

---

## After-Hours Procedures

**During off-hours:**
- [ ] Respond to page within 5 minutes
- [ ] Start conversation in #incidents channel
- [ ] Add relevant people to war room
- [ ] Assess if wake up needed for L2/L3
- [ ] Document decisions

**Morning handoff:**
- [ ] Sync with arriving team
- [ ] Handoff ongoing incidents
- [ ] Highlight key decisions
- [ ] Update status page

---

## Postmortem Process

**Schedule within 24 hours of incident:**

1. **Timeline Reconstruction** (5 min)
   - When issue started
   - When detected
   - When escalated
   - When resolved

2. **Root Cause Analysis** (15 min)
   - What went wrong
   - Why it happened
   - What failed (monitoring, etc.)

3. **Action Items** (10 min)
   - What to fix
   - Who's responsible
   - When due

**Document and track action items in tracker:**
- [ ] Action item 1: __________ (Owner: __________, Due: __)
- [ ] Action item 2: __________ (Owner: __________, Due: __)

---

## Resources

- Incident Response Plan: `/docs/operations/INCIDENT-RESPONSE-PLAN.md`
- Playbooks: `/docs/operations/[INCIDENT-TYPE]-INCIDENT.md`
- Status Page: https://status.basset-hound.io
- Monitoring Dashboard: https://grafana.prod.example.com
- On-Call Schedule: [Link to calendar]

---

## Key Phone Numbers

- [ ] Ops Manager: __________
- [ ] VP Engineering: __________
- [ ] Infrastructure Lead: __________
- [ ] Database Admin: __________
- [ ] Security Lead: __________
