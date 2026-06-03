# Basset Hound Browser - Incident Response Plan

**Document Version:** 1.0  
**Last Updated:** June 2, 2026  
**Classification:** Internal Operations

---

## Table of Contents

1. [Overview](#overview)
2. [Incident Severity Levels](#incident-severity-levels)
3. [Incident Response Process](#incident-response-process)
4. [Roles and Responsibilities](#roles-and-responsibilities)
5. [Incident Detection & Alerting](#incident-detection--alerting)
6. [Response Procedures](#response-procedures)
7. [Communication Protocol](#communication-protocol)
8. [Common Incident Playbooks](#common-incident-playbooks)
9. [Postmortem & Learning](#postmortem--learning)

---

## Overview

The Incident Response Plan defines how the team identifies, responds to, and learns from production incidents. The goal is to:

1. **Minimize Impact:** Reduce time to detection and resolution
2. **Maintain Transparency:** Clear communication throughout incident
3. **Preserve Evidence:** Document for postmortem analysis
4. **Learn and Improve:** Prevent similar incidents in future

**Response Principles:**
- **Speed:** First action within 5 minutes
- **Clarity:** Clear roles and communication
- **Escalation:** Rapid path to decision-makers
- **Coordination:** All responders on same page
- **Recovery:** Service restored to normal state
- **Learning:** Document for improvement

---

## Incident Severity Levels

### Severity Level P1: Critical

**Definition:** Service is down or severely degraded, impacting production workload.

**Criteria:**
- Service completely unavailable (0% uptime)
- OR >50% of requests failing
- OR latency >5 seconds for >20% of requests
- OR data loss risk identified

**Response Time Targets:**
- Alert to L1 response: <5 minutes
- L1 to L2 escalation: <10 minutes
- Expected resolution: <30 minutes

**Team Notified:**
- L1 On-call (automatic via PagerDuty)
- L2 Engineering Lead (automatic after L1 accepts)
- L3 Infrastructure Lead (called by L2)
- Director (if >15 min and customer-facing)

**Example Incidents:**
- WebSocket API completely down
- Database unavailable
- Disk full, service crashing
- Memory leak causing OOM crashes
- Deployment caused complete failure

**Actions:**
- Acknowledge in <1 minute
- Begin investigation immediately
- Update stakeholders every 10 minutes
- Escalate to L2 at 10 minutes if unresolved
- Escalate to L3 at 30 minutes if unresolved

---

### Severity Level P2: High

**Definition:** Service is partially degraded, affecting some users or functionality.

**Criteria:**
- Partial service unavailability (10-50% uptime)
- OR 5-50% of requests failing
- OR latency 500ms-5 seconds for >10% of requests
- OR non-critical feature unavailable

**Response Time Targets:**
- Alert to L1 response: <5 minutes
- L1 investigation period: 10-15 minutes
- L1 to L2 escalation: <15 minutes (if unresolved)
- Expected resolution: <1 hour

**Team Notified:**
- L1 On-call (automatic via PagerDuty)
- L2 Engineering Lead (on demand or at 15 min)
- L3 Infrastructure Lead (if escalated)

**Example Incidents:**
- One region/datacenter down
- High error rate on specific command
- Increased latency due to load
- Memory usage at 90%
- CPU consistently >80%

**Actions:**
- Acknowledge in <1 minute
- Investigate root cause
- Update stakeholders every 15 minutes
- Escalate to L2 at 15 minutes if not improving
- Implement workarounds if possible

---

### Severity Level P3: Medium

**Definition:** Minor issue affecting small percentage of users, non-critical functionality.

**Criteria:**
- <10% of requests affected
- Latency slightly elevated (200-500ms)
- Non-critical feature degraded
- Cosmetic or minor functional issue

**Response Time Targets:**
- Alert to L1 response: <15 minutes
- L1 investigation: next business day acceptable
- Escalation: only if worsening
- Expected resolution: <24 hours

**Team Notified:**
- L1 On-call (if received alert)
- No automatic escalation
- Document in issue tracker

**Example Incidents:**
- Metrics collection delayed
- Minor UI glitch
- Non-critical endpoint slow
- Warning level in logs
- Deprecated function used

**Actions:**
- Document issue
- Prioritize in backlog
- Don't disrupt L2 unless escalating
- Continue normal development work

---

### Severity Level P4: Low

**Definition:** Informational, no user impact, process improvement opportunity.

**Criteria:**
- No impact on service
- No user-facing changes
- Informational event
- Scheduled maintenance notice

**Response Time Targets:**
- No urgency
- Document for learning
- Address in normal sprints

**Team Notified:**
- None (unless feature owner)
- Document in issue tracker

**Example Incidents:**
- Scheduled backup completion
- Unused feature removed
- Debug logging message
- Development environment issue
- Process improvement notice

**Actions:**
- Log and document
- No escalation needed
- Address in backlog planning

---

## Incident Response Process

### Phase 1: Detection (0-5 minutes)

**Automated Detection:**
- Monitoring system detects anomaly
- Alert triggered and sent to on-call
- PagerDuty notifies L1

**Manual Detection:**
- Engineer notices issue
- Reports in #incident channel
- On-call is paged

**Detection Criteria:**
- Availability <99.5% (P1 if <95%)
- Error rate >1% (P1 if >5%)
- Latency p99 >500ms (P1 if >2s)
- CPU >80% sustained (P1 if >95%)
- Memory >90% (P1 if OOM occurring)
- Disk <10% (P1 if <5%)

**Detection Checklist:**
- [ ] Alert fired and logged
- [ ] On-call notified
- [ ] Incident assigned ID
- [ ] Start time recorded

---

### Phase 2: Triage (5-15 minutes)

**Acknowledgment:**
- L1 acknowledges alert in PagerDuty within 1 minute
- L1 responds in Slack #incident within 5 minutes
- Initial message: "I'm investigating [Service] incident"

**Assessment:**
- Confirm it's a real issue (not false alarm)
- Determine severity level
- Identify affected component(s)
- Assess customer impact
- Check for known causes

**Triage Checklist:**
- [ ] Is this a real incident? (Yes/No)
- [ ] What severity? (P1/P2/P3/P4)
- [ ] What's affected? (service/component)
- [ ] How many users? (X% of traffic)
- [ ] Known cause? (Recent deployment/config change)
- [ ] Time to resolve estimate? (X minutes)

**Triage Message (in Slack #incident):**

```
Incident ID: INC-2026-06-02-001
Service: WebSocket API
Severity: P2 (Partial Degradation)
Start Time: 14:32 UTC
Affected: ~15% of connections
Error Type: Timeout on navigate command

Status: Investigating
Next Update: 14:42 UTC (10 min)
Owner: @oncall-engineer
```

---

### Phase 3: Investigation (5-30 minutes)

**For P1 Incidents:** Parallel investigation and escalation

**Diagnostics:**
1. Check service logs
   ```bash
   tail -100 /var/log/basset-hound/websocket.log | grep ERROR
   ```

2. Check metrics
   - CPU, memory, disk usage
   - Request latency distribution
   - Error rate by type

3. Check recent changes
   ```bash
   git log --oneline -10
   date -d '1 hour ago'
   ```

4. Check external dependencies
   - Database connectivity
   - Cache availability
   - Proxy/network status

5. Identify pattern
   - When did it start?
   - Is it increasing/decreasing?
   - Is it affecting all users or subset?

**Investigation Checklist:**
- [ ] Reviewed error logs
- [ ] Checked current metrics
- [ ] Verified recent changes
- [ ] Checked external dependencies
- [ ] Identified pattern/trend
- [ ] Formed hypothesis
- [ ] Ready to test hypothesis

---

### Phase 4: Mitigation (15-45 minutes)

**Goal:** Get service to acceptable state (may be temporary fix)

**Mitigation Options (in order):**

1. **Feature Disable** (fastest, least risky)
   - Disable problematic feature
   - Route around issue
   - Enable fallback behavior

2. **Service Restart** (fast, moderate risk)
   - Restart affected process
   - Clear caches
   - Reload configuration

3. **Temporary Workaround** (moderate speed/risk)
   - Apply patch
   - Modify configuration
   - Redirect traffic

4. **Rollback** (slow, high risk, escalation required)
   - Roll back recent code change
   - Requires L2/L3 approval
   - Test before deploying

**Mitigation Checklist:**
- [ ] Option chosen and authorized
- [ ] Change deployed/applied
- [ ] Service recovering (verify metrics)
- [ ] Error rate decreasing
- [ ] Latency normalizing
- [ ] No new issues introduced

---

### Phase 5: Stabilization (30+ minutes)

**Goal:** Ensure service returns to normal state

**Verification:**
- [ ] Error rate <1%
- [ ] Latency <500ms p95
- [ ] CPU <60%
- [ ] Memory stable (not growing)
- [ ] No new warnings in logs
- [ ] Customer reports resolved

**Stability Window:**
- Monitor for 10 minutes of normal operation
- Watch for any regression
- If regression appears, go back to investigation

**Stabilization Message:**

```
Status: STABILIZING

Service: WebSocket API
Metrics:
- Error rate: 0.2% (target <1%) ✓
- Latency: 45ms p95 (target <500ms) ✓
- CPU: 35% (target <60%) ✓
- Memory: 2.1GB stable (target stable) ✓

Monitoring for 10 minutes...
```

---

### Phase 6: Resolution (45-120 minutes)

**Declare Resolved When:**
- Service metrics normal for 10 minutes
- No errors in logs
- Customer impact assessment: none
- Mitigation is permanent or proper fix deployed

**Resolution Actions:**
1. Update status page (if customer-facing)
2. Send final notification
3. Schedule postmortem
4. Create action items
5. Close incident ticket

**Resolution Message:**

```
RESOLVED: WebSocket API - Timeout Issue

Timeline:
- Start: 14:32 UTC
- Mitigation Applied: 14:42 UTC
- Stabilization: 14:50 UTC
- Duration: 18 minutes

Root Cause: Connection pool exhaustion on database
Fix Applied: Increase connection pool limit from 50 to 100
Status: Permanent (requires full fix later)

Postmortem: Tomorrow 10:00 AM UTC
Owner: @engineering-lead
```

---

## Roles and Responsibilities

### Incident Commander (L2)

**Appointed:** When incident escalates to L2

**Responsibilities:**
- Make key decisions (what to try next)
- Authorize mitigation steps
- Keep investigation focused
- Update external stakeholders
- Schedule postmortem

**Authority:**
- Can authorize service restarts
- Can approve configuration changes
- Can approve workarounds
- Cannot: Approve rollbacks (needs L3), access data without L3

---

### Technical Lead (L1)

**Primary Investigator**

**Responsibilities:**
- Acknowledge alert
- Perform initial triage
- Follow runbooks
- Document findings
- Execute mitigation steps (approved by L2)
- Monitor recovery

**Authority:**
- Can restart services
- Can review logs/metrics
- Can test theories (non-destructive)
- Cannot: Modify code, rollback, escalate authorization (others do that)

---

### Infrastructure Lead (L3)

**Called when:**
- Need database access
- Need code rollback
- Need infrastructure change
- Need emergency authorization

**Responsibilities:**
- Make escalation decisions
- Authorize high-impact changes
- Coordinate external vendors
- Approve rollbacks
- Brief Director if needed

---

### Director of Engineering

**Called for:**
- Customer notification needs
- SLA credit decisions
- Extended downtime scenarios
- Major incident postmortems

**Responsibilities:**
- Authorize customer communication
- Make business decisions
- Approve SLA impacts
- Brief customers/partners
- Escalate externally if needed

---

### Communications Lead

**Appointed for major incidents (P1 >30min)**

**Responsibilities:**
- Update status page
- Send external notifications
- Communicate with customers
- Brief leadership
- Coordinate with PR if needed

---

## Incident Detection & Alerting

### Automated Monitoring

**Metrics Monitored:**

| Metric | Warning Threshold | Critical Threshold | Alert Name |
|--------|---|---|---|
| Availability | 99.5% | 95% | API Down |
| Error Rate | 1% | 5% | High Errors |
| Latency p99 | 500ms | 2000ms | High Latency |
| CPU Usage | 80% | 95% | High CPU |
| Memory Usage | 85% | 95% | High Memory |
| Disk Space | 10% | 5% | Disk Full |
| Connections | 100/max | 95%/max | Conn Pool Full |

**Alert Routing:**

P1 → PagerDuty → L1 on-call phone (immediate)
P2 → PagerDuty → L1 on-call Slack (within 5 min)
P3 → Slack #alerts (engineer reviews)

### Manual Escalation

If you notice an issue not alerting:

1. Open #incident in Slack
2. Message: "@oncall Possible incident: [description]"
3. Provide: Metric evidence, time frame, affected users
4. On-call will page if confirmed

---

## Response Procedures

### Immediate Actions (0-5 minutes)

```
TASK                    OWNER       TIME
Acknowledge             L1          <1 min
Get context             L1          <2 min
Assess severity         L1          <3 min
Post initial message    L1          <5 min
```

### Investigation (5-30 minutes)

```
TASK                    OWNER       TIME
Review logs             L1          5-10 min
Check metrics           L1          5-10 min
Form hypothesis         L1          10-15 min
Escalate if needed      L1          15 min
Begin mitigation        L2          20+ min
```

### Resolution (30+ minutes)

```
TASK                    OWNER       TIME
Apply mitigation        L1/L2       As needed
Verify recovery         L1          Continuous
Declare resolved        L2          Once stable
Create postmortem       L2          Within 24h
Follow up actions       Team        Within 1 week
```

---

## Communication Protocol

### Internal Communication

**During Incident:**

Update #incident channel:
- Every 10 minutes (P1)
- Every 15-20 minutes (P2)
- Every hour or less (P3)

Include:
- Current status (investigating/fixing/recovering)
- What we found
- What we're trying next
- ETA to resolution

**After Resolution:**

Post to #incident:
```
[SERVICE] RESOLVED
Start: [Time]
Duration: [X minutes]
Impact: [Users affected]
Mitigation: [What fixed it]

Postmortem scheduled: [Date/Time]
Owner: [Name]
```

### External Communication

**Customer-Facing Incidents (P1 >5 minutes):**

1. Update status page within 5 minutes
2. Message: "Investigating issue with [Service]"
3. Continue updates every 15 minutes
4. Post resolution summary
5. Follow-up email within 1 hour

---

## Common Incident Playbooks

### Playbook 1: WebSocket API Unavailable

**Alert:** API Health Check Failing
**Severity:** P1
**Duration:** Usually <5 minutes to resolve

**Step 1: Verify Service Status**
```bash
curl -s http://localhost:8765/health | jq .
ps aux | grep 'websocket|node'
```

**Step 2: Check Logs**
```bash
tail -50 /var/log/basset-hound/websocket.log | grep ERROR
```

**Step 3: Diagnose Issue**
- If no process running → Restart
- If process stuck → Restart
- If startup failing → Check logs for why
- If port unavailable → Check netstat

**Step 4: Recovery**
```bash
# Graceful restart
systemctl restart basset-hound-websocket
sleep 10
curl -s http://localhost:8765/health | jq .

# Verify connections being accepted
ss -tnap | grep 8765
```

**Step 5: Validate**
- Health check returns 200
- Error rate returns to <1%
- New connections accepted
- Existing connections working

---

### Playbook 2: High Error Rate (>1%)

**Alert:** Error Rate Exceeds Threshold
**Severity:** P2 usually, P1 if >5%
**Duration:** 10-30 minutes typical

**Step 1: Identify Error Type**
```bash
grep ERROR /var/log/basset-hound/websocket.log | \
  sed 's/.*ERROR: //' | cut -d' ' -f1 | \
  sort | uniq -c | sort -rn | head -10
```

**Step 2: Check Recent Changes**
```bash
# Last 10 commits
git log --oneline -10

# Changed files in last hour
git log -p --since="1 hour ago" | head -100
```

**Step 3: Correlate with Events**
- Recent deployment? → Rollback or apply fix
- Load spike? → Implement rate limiting
- Dependency issue? → Check external services
- Configuration change? → Revert

**Step 4: Apply Mitigation**
- Most common: Rollback recent change
- Alternative: Increase resource limits
- Alternative: Disable problematic feature

**Step 5: Monitor Recovery**
- Error rate decreasing? → Good
- Still high? → Escalate to L2
- Return to <1% → Success

---

### Playbook 3: High CPU Usage (>80%)

**Alert:** CPU Exceeds Threshold
**Severity:** P2 usually, P1 if >95% and high latency
**Duration:** 15-45 minutes typical

**Step 1: Identify Process**
```bash
top -b -n 1 | head -15  # Overall view
top -p $(pgrep -f 'websocket|node') -n 1  # Specific process
```

**Step 2: Check if Normal Workload**
```bash
# Compare to baseline
ss -tnap | grep 8765 | wc -l  # Current connections
# Check metrics dashboard for typical load
```

**Step 3: If Load Spike:**
- Implement rate limiting
- Enable compression
- Enable caching
- Let workload finish

**Step 4: If Abnormal High CPU:**
- Restart service
- Check for infinite loops in logs
- Escalate to L2 for code review

**Step 5: Monitor**
- CPU should decrease within 1-5 minutes
- If not, escalate to L2
- If restarted, monitor for 10 minutes

---

### Playbook 4: High Memory Usage (>85%)

**Alert:** Memory Exceeds Threshold
**Severity:** P2 usually, P1 if OOM killer active
**Duration:** 10-30 minutes typical

**Step 1: Check Memory Usage**
```bash
free -h
ps aux --sort=-%mem | head -10
```

**Step 2: Identify Memory Leak?**
```bash
# Monitor RSS over time (every 30 seconds)
for i in {1..10}; do echo "$(date): $(ps aux | grep websocket | grep -v grep | awk '{print $6}')"; sleep 30; done
```

**Step 3: If Memory Growing (leak):**
- Restart service
- Check logs for context
- Escalate to L2 for debugging

**Step 4: If Memory Stable (just high load):**
- No action needed
- Let load decrease naturally
- Monitor that it decreases

**Step 5: Verify**
- Memory stabilizes
- Not continuing to grow
- Service responsive
- Error rate normal

---

### Playbook 5: Disk Space Critical (<5%)

**Alert:** Disk Space Low
**Severity:** P1 (critical)
**Duration:** 5-20 minutes typical

**Step 1: Check Space**
```bash
df -h
du -sh /* | sort -rh | head -10
du -sh /var/log/* | sort -rh | head -10
```

**Step 2: Identify Culprit**
- Old log files? → Delete
- Temp files? → Clean up
- Old Docker images? → Remove

**Step 3: Clean Up (Safest First)**
```bash
# Remove old logs (>30 days)
find /var/log/basset-hound -name "*.log" -mtime +30 -delete

# Remove old application data
find /data/old -type f -mtime +60 -delete

# Clean Docker
docker system prune -a
```

**Step 4: Monitor**
```bash
df -h
# Should have >20% free space now
```

**Step 5: If Still Critical**
- Stop some services temporarily
- Move logs to external storage
- Escalate to L3 for infrastructure changes

---

### Playbook 6: Database/Storage Issues

**Alert:** Database Unavailable or Slow
**Severity:** P1 usually
**Duration:** 15-60 minutes typical

**Step 1: Check Connectivity**
```bash
# Try connecting
psql -U user -d database -h localhost -c "SELECT 1"
# Or for your specific database
curl -s http://db-host:5432
```

**Step 2: Check Database Status**
- Is it running?
- Disk space available?
- Connection count normal?
- Lock tables?

**Step 3: Common Fixes**
- Kill long-running queries
- Increase connection pool
- Restart database (if safe)
- Check replication lag

**Step 4: Escalate if:**
- Data corruption suspected
- Need to modify data
- Need backup restore
- Need infrastructure change

**Step 5: Recovery**
- Verify connections working
- Check replication healthy (if applicable)
- Monitor query performance

---

## Postmortem & Learning

### Postmortem Schedule

- **P1 Incidents:** Postmortem within 24 hours
- **P2 Incidents:** Postmortem within 1 week
- **P3 Incidents:** Optional, document in ticket

### Postmortem Meeting Agenda

**Duration:** 60 minutes

**Attendees:**
- Incident Commander (L2)
- L1 responder(s)
- Engineering Lead
- Product Manager (if customer-facing)
- System Owner

**Timeline:**

1. **Timeline of Events** (10 min)
   - 14:32 UTC: Alert fired
   - 14:33 UTC: L1 acknowledged
   - 14:37 UTC: Root cause identified
   - 14:42 UTC: Fix applied
   - 14:50 UTC: Resolved

2. **Diagnosis** (15 min)
   - What we found
   - What we checked
   - What was working/broken
   - Root cause explanation

3. **Root Cause Analysis** (15 min)
   - Why did the cause occur?
   - Were there warning signs?
   - Should monitoring have caught it?
   - Is this the underlying cause or symptom?

4. **Action Items** (15 min)
   - What can we do to prevent this?
   - What can we improve?
   - Assign owners and deadlines

5. **Lessons Learned** (5 min)
   - What went well?
   - What can we improve next time?
   - Update runbooks?

### Postmortem Document

Template in `/docs/templates/postmortem-template.md`

Required sections:
- Timeline
- Impact assessment
- Root cause
- Contributing factors
- Action items (with owners and deadlines)
- Lessons learned

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-02 | Engineering | Initial document |

---

**Last Review:** June 2, 2026  
**Next Review:** Q3 2026
