# Basset Hound Browser - Escalation Paths

**Document Version:** 1.0  
**Last Updated:** June 2, 2026  
**Classification:** Internal Operations

---

## Overview

This document defines the incident escalation hierarchy for Basset Hound Browser. Clear escalation paths ensure that critical issues receive appropriate expertise and decision-making authority quickly.

**Key Principles:**
- **Clear Criteria:** Each level has explicit decision criteria
- **Rapid Escalation:** L1 → L2 in <5 minutes for critical issues
- **Authority:** Each level has clear decision authority
- **Accountability:** Owner is assigned at each level
- **Documentation:** All escalations logged for process improvement

---

## Escalation Levels

### Level 1 (L1): On-Call Engineer

**Role:** First responder, triage, initial mitigation

**Qualifications:**
- Familiar with service architecture
- Can follow runbooks
- Has basic troubleshooting skills
- Can access monitoring/logs
- Can escalate when needed

**Response Time:** <5 minutes from alert

**Decision Authority:**
- Can restart services
- Can kill errant processes
- Can temporarily disable features (rate limiting, compression)
- Can implement basic rate limiting
- Cannot: Roll back production code, modify database, access customer data

**Escalation Criteria:**
- Time-based: No progress in 10 minutes
- Severity: Any P1 incident
- Expertise: Issue requires deep knowledge
- Authorization: Need higher-level access

**Typical Issues:**
- Service restart needed
- Disk space cleanup
- Log rotation issues
- Basic connectivity problems
- High load scenarios

---

### Level 2 (L2): Engineering Lead

**Role:** Investigation, diagnosis, complex problem-solving

**Qualifications:**
- 2+ years experience with service
- Can diagnose root causes
- Can make code/config changes
- Can authorize workarounds
- Knows escalation triggers

**Response Time:** <15 minutes from L1 escalation

**Decision Authority:**
- Can modify production configuration
- Can restart services with impact planning
- Can apply hotfixes
- Can implement workarounds
- Can authorize temporary feature disabling
- Cannot: Approve rollbacks (needs L3), make breaking changes, access customer data without L3

**Escalation Criteria:**
- Issue not resolved by L1 in 10 minutes
- Root cause unknown after 20 minutes investigation
- Need production code changes
- Need database access
- Need multi-service coordination

**Typical Issues:**
- Complex service interactions
- Configuration issues
- Performance degradation with unknown cause
- Deployment problems
- Integration failures

**Handoff from L1 to L2:**

```
L1 calls L2:

"Hi, I'm escalating [service] incident. 
- Service: [name]
- Severity: [P1/P2/P3]
- Duration: [X minutes]
- What I've tried: [list actions]
- Current status: [running command / waiting for X]
- This seems like [your hypothesis]

Can you take over?"
```

---

### Level 3 (L3): Infrastructure Lead

**Role:** Authorization, infrastructure changes, executive decisions

**Qualifications:**
- 4+ years infrastructure experience
- Understands business implications
- Can make infrastructure changes
- Can approve workarounds
- Can contact external providers

**Response Time:** <30 minutes from L2 escalation

**Decision Authority:**
- Can approve code rollbacks
- Can approve database changes
- Can authorize emergency access
- Can contact external vendors/providers
- Can make business-impacting decisions
- Can approve extended maintenance windows

**Escalation Criteria:**
- Issue threatens customer data
- Need database modifications
- Need infrastructure changes
- Need external vendor involvement
- Need emergency access authorization
- Service needs to be taken offline

**Typical Issues:**
- Data corruption/loss risks
- Security incidents
- Multi-region failures
- Provider outages
- Major infrastructure changes needed

**Handoff from L2 to L3:**

```
L2 calls L3:

"Hi, escalating to L3 for authorization.
- Service: [name]
- Severity: [P1]
- Duration: [X minutes]
- Root cause: [identified issue]
- Solution needed: [specific action]
- Approvals needed: [data change / rollback / external contact]
- Recommended action: [your recommendation]

Do you authorize [action]?"
```

---

### Executive Level: Director of Engineering

**Role:** Customer communication, business decisions, crisis management

**Qualifications:**
- Director-level authority
- Can make business-critical decisions
- Can authorize customer notifications
- Can make policy exceptions

**Response Time:** <1 hour (varies by severity)

**Decision Authority:**
- Can authorize customer notifications
- Can make policy exceptions
- Can approve SLA credits
- Can authorize emergency resources
- Can make service shutdown decisions

**Escalation Criteria:**
- Customer-facing outage >1 hour
- Data loss incident
- Security breach
- Major business impact
- Media/regulatory involvement

---

## Escalation Decision Tree

```
INCIDENT ALERT
       ↓
L1: TRIAGE (0-5 min)
├─ Is it real? (not false alarm)
├─ What severity? (P1/P2/P3)
└─ Can I fix it quickly? (<10 min)
       ↓
   YES: Continue       NO: Escalate to L2
       ↓
L1: INVESTIGATE (5-15 min)
├─ Check metrics
├─ Review logs
├─ Compare to baseline
└─ Try safe fixes
       ↓
   FIXED: DOCUMENT      UNRESOLVED: Escalate to L2
       ↓                        ↓
L1: POSTMORTEM       L2: INVESTIGATION (5-20 min)
                     ├─ Root cause analysis
                     ├─ Verify L1 actions
                     ├─ Try targeted fixes
                     └─ Plan changes
                            ↓
                     FIXED: IMPLEMENT        NEEDS AUTH: Escalate to L3
                            ↓                        ↓
                     L2: VALIDATION       L3: DECISION (5-30 min)
                                         ├─ Evaluate risk
                                         ├─ Approve action
                                         ├─ Authorize changes
                                         └─ Notify customers
                                                ↓
                                         EXEC: COMMUNICATION
                                         ├─ Customer notification
                                         ├─ Status page update
                                         └─ Follow-up

```

---

## Escalation Matrix

### By Severity Level

| Severity | L1 Action | L1→L2 Threshold | L2→L3 Threshold | On-Call Type |
|----------|-----------|------------------|---|---|
| P1 | Investigate | Immediate | 15 minutes | Executive |
| P2 | Investigate | 10 minutes | 30 minutes | Lead |
| P3 | Investigate | 30 minutes | 60 minutes | Engineer |
| P4 | Document | Never | Never | None |

### By Issue Category

| Category | Typical Escalation | L1 Time Budget | Decision Maker |
|----------|---|---|---|
| Restart needed | L1 resolves | 5 min | L1 |
| Log/disk issue | L1 resolves | 10 min | L1 |
| Performance | L1→L2 | 15 min | L2 |
| Configuration | L1→L2 | 15 min | L2 |
| Code issue | L1→L2→L3 | 30 min | L3 |
| Data issue | L1→L2→L3 | 30 min | L3 |
| Security | L1→L2→L3→Exec | 30 min | Executive |

---

## Contact Directory

### On-Call Rotation (L1)

**Current Schedule:** [PagerDuty Link](https://basset-hound.pagerduty.com)

**How to Reach L1:**
- Primary: PagerDuty (automatic)
- Backup: Slack @oncall
- Emergency: Escalate in PagerDuty

---

### Engineering Lead (L2)

| Name | Phone | Slack | Email | Availability |
|------|-------|-------|-------|---|
| *Lead 1* | +1-XXX-XXX-XXXX | @lead1 | lead1@basset-hound.io | 9-17 + on-call |
| *Lead 2* | +1-XXX-XXX-XXXX | @lead2 | lead2@basset-hound.io | 9-17 + on-call |

**How to Reach L2:**
1. Call primary engineer (phone in system)
2. If no answer: Slack (5 min max wait)
3. If still no answer: Escalate to L3

---

### Infrastructure Lead (L3)

| Name | Phone | Slack | Email | Availability |
|------|-------|-------|-------|---|
| *Infrastructure Lead* | +1-XXX-XXX-XXXX | @infra-lead | infra@basset-hound.io | On-call 24/7 |

**How to Reach L3:**
1. Call L3 directly
2. If no answer: Try email + Slack (parallel)
3. Maximum wait: 30 minutes

---

### Director of Engineering (Executive)

| Name | Phone | Slack | Email | Availability |
|------|-------|-------|-------|---|
| *Director* | +1-XXX-XXX-XXXX | @director | director@basset-hound.io | On-call for P1 |

**How to Reach Executive:**
1. Contact L3 who will contact Director
2. Emergency: Call directly if L3 unreachable
3. Always notify after contacting

---

## Communication Protocols

### Escalation Call Template

**When calling to escalate:**

```
"Hi [Name], this is [Your Name]. I'm calling to escalate 
a [Severity] incident with [Service].

SITUATION:
- Service affected: [Name]
- Started: [Time] ([X] minutes ago)
- Impact: [What's broken]
- Current status: [Running / Waiting / Blocked]

WHAT I'VE DONE:
- [Action 1]: [Result]
- [Action 2]: [Result]
- [Action 3]: [Result]

I NEED:
- [Specific ask: Expertise / Authorization / Action]

CONTEXT:
- [Relevant background info]

Can you take over / authorize [specific action]?"
```

### Status Communication (every 10 minutes during P1)

**Update message (to Slack #incident):**

```
P1 Incident: [Service]
Duration: [X minutes]
Status: [Investigating / Applying Fix / Validating]

LATEST:
- Finding: [What we discovered]
- Action: [What we're trying]
- ETA: [When we expect resolution]

Owner: [L1 / L2 / L3 name]
```

### Resolution Communication

**Incident resolved message:**

```
RESOLVED: [Service]

Timeline:
- Start: [Time]
- Duration: [X minutes]
- Resolution: [Action that fixed it]

Root cause: [Brief explanation]
Temporary or permanent fix: [Status]

Follow-up: Postmortem scheduled for [Day/Time]
Owner: [Name]
```

---

## Escalation Handoff Checklist

### When L1 Escalates to L2

- [ ] Notify L2 (call, not email)
- [ ] Stay on call together for 2 minutes
- [ ] Brief L2 on all actions taken
- [ ] Provide: service logs, metrics screenshots, command history
- [ ] Get confirmation L2 is taking over
- [ ] Stay available as backup
- [ ] Update Slack with new owner
- [ ] Log escalation in incident tracker

### When L2 Escalates to L3

- [ ] Notify L3 (call, not email)
- [ ] Stay on call together for 5 minutes
- [ ] Brief L3 on root cause analysis
- [ ] Explain: why this level of action needed
- [ ] Get clear authorization for: specific action
- [ ] Get commitment: L3 will handle decision
- [ ] Update Slack with L3 taking over
- [ ] Log escalation in incident tracker

### When L3 Involves Executive

- [ ] Notify Executive via L3 (don't bypass)
- [ ] Provide: incident summary, business impact, recommended action
- [ ] Get executive decision on: customer notification, SLA handling
- [ ] Prepare: status page update, customer communication
- [ ] Execute decision immediately
- [ ] Log decision in incident tracker

---

## Performance Targets

### Response Time SLOs

| Level | Target | Measurement |
|-------|--------|---|
| L1 | <5 minutes | From alert receipt to acknowledgment |
| L2 | <15 minutes | From L1 escalation call to response |
| L3 | <30 minutes | From L2 escalation call to response |
| Executive | <1 hour | From L3 request to decision |

### Escalation Rate Tracking

Monitor these metrics monthly:

- **Escalation Rate:** % incidents escalated to L2+
- **Average L1 Time:** Minutes from alert to escalation
- **Average L2 Time:** Minutes from escalation to resolution
- **Recurrence Rate:** % of same issue happening again
- **False Alert Rate:** % of alerts that weren't real incidents

**Target Escalation Rate:** <30% to L2+

---

## Incident Categories & Default Escalations

### Service Availability

- **P1 (Service Down):** L1 → Immediate L2 escalation
- **P2 (Partial Down):** L1 → L2 at 10 minutes
- **P3 (Degraded):** L1 → L2 at 30 minutes

### Performance Issues

- **P1 (Latency >5s):** L1 → Immediate L2 escalation
- **P2 (Latency 500ms-2s):** L1 → L2 at 10 minutes
- **P3 (Latency <500ms):** L1 continues, no escalation

### Resource Issues

- **CPU >95%:** L1 → Immediate investigation, L2 if >30 minutes
- **Memory OOM:** L1 → Immediate L2 escalation
- **Disk <5%:** L1 → Immediate L2 escalation

### Data/Security Issues

- **Data Loss:** L1 → Immediate L2 → L3 escalation
- **Security Incident:** L1 → Immediate L2 → L3 escalation
- **Unauthorized Access:** L1 → Immediate L3 escalation

### Deployment Issues

- **Failed Deployment:** L1 → L2 for rollback authorization
- **Broken Feature:** L1 → L2 for investigation → L3 for rollback
- **Data Migration Issue:** L1 → L2 → L3 escalation

---

## Escalation Criteria Details

### When to Escalate Based on Time

- **0-5 minutes:** Getting details, assessing severity
- **5-10 minutes:** First troubleshooting steps
- **10-15 minutes:** Initial fixes attempted
- **15+ minutes:** If not resolved, escalate to L2

### When to Escalate Based on Expertise Needed

- **System Restart:** L1 can handle
- **Log Analysis:** L1 can handle
- **Basic Troubleshooting:** L1 can handle
- **Root Cause Analysis:** Escalate to L2
- **Code Changes:** Escalate to L2/L3
- **Infrastructure Changes:** Escalate to L3
- **Data Access:** Escalate to L3

### When to Escalate Based on Authorization

- **Restart service:** L1 authorized
- **Modify configuration:** L2 authorized
- **Deploy code:** L2/L3 authorized
- **Roll back code:** L3 authorized
- **Access database:** L3 authorized
- **Contact customers:** Executive authorized

---

## Learning from Escalations

### Monthly Escalation Review

Every month, review:

1. **Escalations Stats**
   - Total incidents: X
   - Escalated to L2: X% (target <30%)
   - Escalated to L3: X% (target <5%)
   - Time to escalation: avg X minutes

2. **Patterns**
   - Most common escalation reason
   - Services requiring most escalations
   - Time of day patterns

3. **Improvements**
   - Runbook updates
   - Training needs
   - Alert threshold tuning

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-02 | Engineering | Initial document |

---

**Last Review:** June 2, 2026  
**Next Review:** Q3 2026
