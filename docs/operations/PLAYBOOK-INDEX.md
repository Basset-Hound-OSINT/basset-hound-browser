# Playbook Index & Quick Reference

**Document Version:** 1.0  
**Last Updated:** June 13, 2026  
**Classification:** Internal Operations  

---

## Quick Decision Tree

```
INCIDENT ALERT RECEIVED
           ↓
      Is it severe? P1?
         ↙     ↘
       YES      NO
        ↓        ↓
   GO TO      Go to
   QUICK      SEVERITY
   CONTACTS   DECISION
   (Sec 2)    TREE
             (Below)
```

### Severity Decision Tree

```
                    INCIDENT ALERT
                         ↓
                  What's affected?
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
      SPEED        ERROR          DATA
       (Fast)       RATE          (Slow)
        ↓             ↓             ↓
  High Latency   High Error    Data Loss
   Playbook      Playbook      Playbook
  (Section 3.1)  (Section 3.2) (Section 3.4)
        │             │             │
        └─────────────┼─────────────┘
                      ↓
             SELECT PLAYBOOK
              & FOLLOW STEPS
```

---

## Playbook Directory

### Deployment Playbooks

**When to use:** During new version deployments

1. **Canary Deployment Playbook**
   - File: `/docs/deployment/CANARY-DEPLOYMENT-PLAYBOOK.md`
   - When: Deploying to 5% traffic
   - Duration: 2-3 hours
   - Key steps: Pre-checks → Deploy → Monitor (90 min) → Decision

2. **Progressive Rollout Playbook**
   - File: `/docs/deployment/PROGRESSIVE-ROLLOUT-PLAYBOOK.md`
   - When: After canary success, rolling to 25% → 50% → 100%
   - Duration: 4-6 hours total (3 phases × 1.5 hrs each)
   - Key steps: Phase 1 (25%) → Decision → Phase 2 (50%) → Decision → Phase 3 (100%)

3. **Rollback Playbook**
   - File: `/docs/deployment/ROLLBACK-PLAYBOOK.md`
   - When: Deployment issues detected
   - Duration: 5-30 minutes depending on scope
   - Key steps: Severity assessment → Traffic redirect → Verification

4. **Database Migration Playbook**
   - File: `/docs/deployment/DATABASE-MIGRATION-PLAYBOOK.md`
   - When: Schema changes required for new version
   - Duration: 1-2 hours
   - Key steps: Validation → Migration → Verification → Application deployment

### Incident Response Playbooks

**When to use:** When production incidents occur

5. **High Latency Incident Playbook**
   - File: `/docs/operations/HIGH-LATENCY-INCIDENT.md`
   - Alert: P99 latency > 500ms
   - Impact: Slow responses, degraded UX
   - Key steps: Triage → Diagnostic path → Fix → Verify

   **Diagnostic Paths:**
   - Path A: Application-level (CPU, memory, queueing)
   - Path B: Database-level (slow queries, locks, pool)
   - Path C: Infrastructure-level (I/O, network, GC)
   - Path D: External dependency (external API, upstream service)

6. **High Error Rate Incident Playbook**
   - File: `/docs/operations/HIGH-ERROR-RATE-INCIDENT.md`
   - Alert: >1% of requests failing
   - Impact: Service unavailable, customer impact
   - Key steps: Categorize errors → Diagnostic path → Fix → Verify

   **Error Categories:**
   - 4xx: Client errors (bad request, auth failure)
   - 5xx: Server errors (crash, dependency failure)
   - Timeout: Request too long
   - Dependency: External service failure

7. **Data Loss / Corruption Incident Playbook**
   - File: `/docs/operations/DATA-LOSS-INCIDENT.md`
   - Alert: Data integrity check fails
   - Impact: Critical - data loss
   - Key steps: Contain writes → Assess damage → Select recovery path → Restore → Verify

   **Recovery Paths:**
   - Path A: Restore from backup (30-60 min recovery)
   - Path B: Recover from binlog (15-45 min recovery)
   - Path C: Manual reconstruction (2-4 hours recovery)

8. **Security Incident Playbook**
   - File: `/docs/operations/SECURITY-INCIDENT.md`
   - Alert: Unauthorized access, malware, DDoS
   - Impact: Critical - potential data breach
   - Key steps: Contain → Preserve evidence → Investigate → Remediate → Communicate

   **Incident Types:**
   - Unauthorized access
   - Malware/compromise
   - DDoS attack
   - Data breach

### Operational Runbooks

**When to use:** For routine operations and on-call duties

9. **On-Call Extended Runbook**
   - File: `/docs/operations/ON-CALL-EXTENDED-RUNBOOK.md`
   - When: During on-call shift
   - Duration: Reference as needed
   - Contains: Alert triage, quick fixes for common issues, escalation paths

10. **War Room Procedures**
    - File: `/docs/operations/WAR-ROOM-PROCEDURES.md`
    - When: P1 incidents or complex issues
    - Duration: Throughout incident
    - Contains: Role definitions, communication cadence, escalation procedures

### Training & Reference

11. **Playbook Training Guide**
    - File: `/docs/operations/PLAYBOOK-TRAINING-GUIDE.md`
    - Purpose: Learn how to use playbooks
    - Contains: Training paths by role, certification requirements, resources

12. **Post-Incident Review Procedure**
    - File: `/docs/operations/POST-INCIDENT-REVIEW.md`
    - When: After incident resolution
    - Duration: 1 hour meeting, 30 min prep
    - Contains: Postmortem agenda, root cause analysis, action items

---

## Quick Reference by Incident Type

### "API is down" → 503 Errors

1. **Check health:** `curl http://api/health`
2. **Check logs:** `docker logs basset-hound-browser | tail -50`
3. **Restart:** `docker restart basset-hound-browser`
4. **Verify:** Error rate drops, availability restored
5. **If persists:** Follow **High Error Rate Incident Playbook** (Sec 6)

**Time:** 5 minutes

### "Service is slow" → High Latency

1. **Check metrics:** Identify if application, database, or infrastructure
2. **Follow diagnostic path** in **High Latency Incident Playbook** (Sec 5)
3. **Implement fix** based on path
4. **Verify latency** returned to baseline
5. **If complex:** Open war room

**Time:** 15-30 minutes

### "High error rate" → >1% Failing

1. **Categorize error type** (4xx/5xx/timeout/dependency)
2. **Follow diagnostic path** in **High Error Rate Incident Playbook** (Sec 6)
3. **Implement fix**
4. **Verify error rate** drops to baseline
5. **If recent deployment:** Consider rollback (Sec 3)

**Time:** 15-30 minutes

### "Data looks wrong" → Corruption Detected

1. **IMMEDIATELY set database read-only:** `SET GLOBAL read_only = ON;`
2. **IMMEDIATELY stop replication:** `STOP SLAVE;`
3. **Assess damage:** Scope of corruption
4. **Select recovery path** (Backup / Binlog / Manual)
5. **Execute recovery** from **Data Loss Incident Playbook** (Sec 7)
6. **Verify data integrity**
7. **Restore writes and service**

**Time:** 30-120 minutes

### "Security breach" → Unauthorized Access

1. **Isolate affected system** from network
2. **Preserve evidence:** Capture logs and state
3. **Notify security/legal** immediately
4. **Follow procedures** in **Security Incident Playbook** (Sec 8)
5. **Contain spread** of breach
6. **Investigate scope** and impact
7. **Communicate appropriately**

**Time:** Ongoing (hours to days)

### "New version broken" → Deployment Failure

1. **Assess severity** of failure
2. **Follow rollback procedures** if needed (Sec 3 of **Rollback Playbook**)
3. **If database schema changed:** Follow **Database Migration Playbook** rollback (Sec 4)
4. **Verify stable version** restored
5. **Schedule postmortem** to review deployment

**Time:** 5-30 minutes

---

## Severity-Based Index

### P1 Critical - Respond Immediately

| Issue | Playbook | Section | ETA |
|-------|----------|---------|-----|
| Service completely down | High Error Rate | 6 | 15 min |
| >5% requests failing | High Error Rate | 6 | 20 min |
| Data loss detected | Data Loss | 7 | 60 min |
| Security breach | Security | 8 | Ongoing |
| Cascading failures | High Error Rate | 6 | 20 min |

**Actions:**
1. Activate war room immediately
2. Escalate to L3 engineering
3. Notify VP Engineering
4. Update status page every 10 minutes
5. Notify customers if >30 min

### P2 High - Respond Within 5 Minutes

| Issue | Playbook | Section | ETA |
|-------|----------|---------|-----|
| 2-5% error rate | High Error Rate | 6 | 15 min |
| P99 latency >1s | High Latency | 5 | 20 min |
| Specific endpoint down | High Error Rate | 6 | 15 min |
| Database connection issues | High Latency | 5 | 15 min |
| Memory leak detected | High Latency | 5 | 20 min |

**Actions:**
1. Acknowledge alert immediately
2. Perform initial diagnosis
3. Escalate to L2 if needed within 10 min
4. Update status page if >30 min
5. Monitor closely

### P3 Medium - Respond Within 15 Minutes

| Issue | Playbook | Section | ETA |
|-------|----------|---------|-----|
| 1-2% error rate | High Error Rate | 6 | 15 min |
| Elevated latency (500ms-1s) | High Latency | 5 | 20 min |
| Intermittent errors | High Error Rate | 6 | 30 min |
| Resource warning (>80%) | High Latency | 5 | 20 min |

**Actions:**
1. Acknowledge alert
2. Investigate root cause
3. Implement fix or monitor
4. Document findings

### P4 Low - Respond Within 30 Minutes

| Issue | Playbook | Section | ETA |
|-------|----------|---------|-----|
| <1% error rate | High Error Rate | 6 | 30 min |
| Slight latency increase | High Latency | 5 | 30 min |
| Configuration issue | Varies | Varies | 60 min |
| Best practice violation | Varies | Varies | Next day |

**Actions:**
1. Log in ticket system
2. Investigate when available
3. Document learnings

---

## Key Contacts (Emergency)

| Role | Name | Phone | Slack | Notes |
|------|------|-------|-------|-------|
| Ops Manager | _________ | _________ | _________ | Coordinates response |
| VP Engineering | _________ | _________ | _________ | Approves rollback |
| Infrastructure Lead | _________ | _________ | _________ | Emergency auth |
| DBA | _________ | _________ | _________ | Data issues |
| Security Lead | _________ | _________ | _________ | Security incidents |
| CEO | _________ | _________ | _________ | P1 customer impact |

**See:** `/docs/operations/INCIDENT-RESPONSE-PLAN.md` for detailed escalation matrix

---

## Tools & Dashboards

### Monitoring & Alerting

- **Status Page:** https://status.basset-hound.io
- **Grafana Dashboards:** https://grafana.prod.example.com
- **Prometheus Queries:** http://prometheus:9090
- **Log Aggregation:** https://kibana.prod.example.com
- **Alert Management:** https://alertmanager:9093

### Incident Management

- **Incident Tracker:** [Link to system]
- **On-Call Schedule:** [Link to calendar]
- **War Room Channel:** #incidents
- **Postmortem Template:** [Link to template]

### Diagnostic Tools

```bash
# Application health
curl http://api/health

# Container status
docker ps
docker stats --no-stream

# Application logs
docker logs basset-hound-browser --tail 100

# Database connection
mysql -h db-host -e "SHOW PROCESSLIST"

# System resources
top
free -h
df -h

# Network diagnosis
ping db-host
traceroute db-host
netstat -an | grep ESTABLISHED
```

---

## Escalation Matrix Summary

| Time | Action | Escalate To | Notify |
|------|--------|-------------|--------|
| T+0 | Acknowledge | - | On-call team |
| T+5 min | Investigate | L1 | War room (if P1) |
| T+10 min | Escalate if stuck | L2 | PM/Ops |
| T+15 min | Escalate if complex | L3 | VP Eng |
| T+30 min | If P1 unresolved | L3 + CEO | Executive team |

---

## Postmortem Scheduling

**After incident resolved:**

1. **Severity determines timing:**
   - P1: Within 24 hours
   - P2: Within 48 hours
   - P3: Within 1 week
   - P4: Optional

2. **Follow:** `/docs/operations/POST-INCIDENT-REVIEW.md`

3. **Assign action items:** Track in project management

---

## Regular Training

**Quarterly (every 3 months):**
- [ ] Classroom session (1 hour)
- [ ] Mock incident drill (30 min)
- [ ] Playbook review/update

**Ongoing:**
- [ ] After every real incident
- [ ] New hire onboarding
- [ ] Annual recertification

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jun 13, 2026 | Initial playbook set |
| 1.1 | [Next review] | [TBD] |

---

## Feedback

Found an issue or have suggestions for improvement?

1. **Immediately:** Post in #operations-feedback Slack
2. **Quarterly:** Bring up in playbook review meeting
3. **Template:** 
   ```
   Playbook: [Name]
   Issue: [Description]
   Suggestion: [How to improve]
   ```

