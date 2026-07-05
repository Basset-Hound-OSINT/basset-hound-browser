# Alert Escalation Procedures
**Version:** 1.0  
**Date:** 2026-06-21  
**Status:** Production

## Overview

This document defines escalation procedures, timelines, and actions for all alert severities. Escalation ensures critical issues receive appropriate response and attention.

---

## Escalation Model

### Principle
"Right person, right time, right tool"
- Correct severity matching → correct responder
- Escalate if no acknowledgment within SLA
- De-escalate if issue resolved
- Track all escalations for post-incident review

---

## Critical Alert Escalation (P0)

### Timeline & Actions

```
T+0s: CRITICAL Alert Fires
├─ Alertmanager triggers
├─ SMS sent to on-call primary
├─ PagerDuty incident created (URGENT)
├─ Slack message posted (#incidents)
├─ Email sent to on-call team
└─ Alert dashboard updates RED

T+30s: First Check Point
├─ Has on-call acknowledged?
│  ├─ YES → Go to Investigation Phase
│  └─ NO → Continue to next step
└─ Reason for no ack possible:
   ├─ Phone off/silent
   ├─ In meeting
   ├─ Away from desk
   └─ Multi-person paging scenario

T+1m: Phone Call Escalation
├─ Call on-call primary's phone
├─ Deliver brief verbal status
├─ Request acknowledgment
├─ If voicemail: Leave message and continue escalation
└─ Log call attempt

T+3m: Check Point 2
├─ Has on-call acknowledged or called back?
│  ├─ YES → Go to Investigation Phase
│  └─ NO → Escalate to backup on-call
└─ Reason documentation:
   ├─ "No answer to phone"
   ├─ "Voicemail message left"
   └─ "SMS acknowledged but no call back"

T+3m: Backup On-Call Notification (Escalation 1/3)
├─ SMS to backup on-call
├─ PagerDuty escalate to backup
├─ Slack mention @backup-oncall
├─ Phone call to backup on-call
└─ Alert status: "Escalated to backup"

T+6m: Check Point 3
├─ Has anyone acknowledged?
│  ├─ YES → Go to Investigation Phase
│  └─ NO → Escalate to manager
└─ Log all escalation attempts

T+6m: Manager Notification (Escalation 2/3)
├─ SMS to engineering manager
├─ Phone call to manager
├─ Email with full incident context
├─ PagerDuty escalation policy triggers
├─ Slack mention @manager
└─ Alert status: "Critical escalation - manager paged"

T+10m: Check Point 4
├─ Has anyone acknowledged?
│  ├─ YES → Go to Investigation Phase
│  └─ NO → Escalate to director
└─ All escalation attempts logged

T+10m: Director Notification (Escalation 3/3)
├─ Direct phone call (no SMS)
├─ "Service critical - full escalation"
├─ Hand over incident details
├─ PagerDuty marks as "acknowledged by director"
└─ Alert status: "At director level"

T+10m+: Director-Driven Response
├─ Director takes immediate action:
│  ├─ Review incident details
│  ├─ Assess business impact
│  ├─ Activate war room if needed
│  ├─ Notify leadership/customers
│  └─ May auto-remediate (restart, failover)
└─ Incident now escalated to organization level
```

### Critical Alert Investigation Phase

**Trigger:** On-call acknowledged within SLA

**Actions (0-5 minutes from acknowledgment):**
1. Access Grafana dashboard (link in alert)
2. Review recent metrics
3. Check recent deployments
4. Assess impact scope
5. Decide: Auto-remediate vs. investigate?

**Remediation Decision Tree:**
```
Is service completely down?
├─ YES → Restart service immediately
│        (auto-remediation should have already tried)
└─ NO → Proceed to root cause

Is memory exhausted (>85%)?
├─ YES → Trigger GC + cache clear → restart if needed
└─ NO → Check next cause

Is CPU maxed out?
├─ YES → Check for runaway process/infinite loop
│        Kill process or restart
└─ NO → Check next cause

Is disk full?
├─ YES → Emergency cleanup (delete old logs/screenshots)
│        or fail gracefully
└─ NO → Error rate/latency issue - investigate
```

**Investigation Actions (First 15 minutes):**
1. Tail error logs: `tail -f /var/log/basset-hound/error.log`
2. Check system resources: `top`, `free`, `df`
3. Review recent metrics in Grafana
4. Check recent deployments/changes
5. Contact other team members if needed
6. Start troubleshooting runbook (link in alert)

**Target Resolution Times:**
- Service down (C1): <5 minutes
- Error rate spike (C2): <10 minutes
- Memory exhaustion (C4): <5 minutes (restart)
- Extreme latency (C5): <15 minutes (investigate)

---

## High Alert Escalation (P1)

### Timeline & Actions

```
T+0s: HIGH Alert Fires
├─ Alertmanager triggers
├─ PagerDuty incident created (NORMAL severity)
├─ Slack message posted (#incidents)
├─ Email sent to on-call
└─ Alert dashboard updates ORANGE

T+5m: First Check Point
├─ Has on-call acknowledged?
│  ├─ YES → Go to Investigation Phase
│  └─ NO → Continue monitoring
└─ HIGH alerts allow brief delay before escalation

T+15m: Check Point 2 (Escalation Point)
├─ Has on-call acknowledged in last 15 minutes?
│  ├─ YES → Proceed with investigation
│  └─ NO → Escalate to backup
└─ Send reminder Slack message if no ack

T+15m: Backup On-Call Notification
├─ Slack mention @backup-oncall
├─ Email to backup
├─ PagerDuty escalation policy triggers
└─ Alert status: "Escalated - backup on-call"

T+30m: Check Point 3
├─ Has anyone acknowledged and started investigation?
│  ├─ YES → Monitor investigation progress
│  └─ NO → Escalate to manager
└─ Document reasons for escalation

T+30m: Manager Notification
├─ Slack @manager
├─ Email with incident context
├─ PagerDuty escalation to manager
└─ Alert status: "Manager escalation"

T+60m: Resolution Target
├─ Issue should be resolved or under investigation
├─ If still investigating: manager leads incident
├─ If resolved: document findings
└─ Update alert status
```

### High Alert Investigation Phase

**Trigger:** On-call acknowledges within 15 minute SLA

**Actions (0-30 minutes from acknowledgment):**
1. Review Grafana dashboard
2. Assess business impact (emergency vs. scheduled fix)
3. Decide on remediation vs. investigation
4. If immediate fix possible: apply and monitor
5. If investigation needed: start diagnostic process

**Investigation Actions:**
1. Identify affected operations (which commands?)
2. Check metrics trends (spike vs. creep?)
3. Review logs for error patterns
4. Test manually if possible
5. Determine root cause
6. Apply fix or workaround
7. Verify resolution

**Target Investigation Time:** 30 minutes (decision point)

---

## Medium Alert Escalation (P2)

### Timeline & Actions

```
T+0s: MEDIUM Alert Fires
├─ Alertmanager triggers
├─ Slack message posted (#monitoring)
├─ Email sent to team (may be batched)
└─ Alert dashboard updates YELLOW

T+1h: Review & Triage
├─ On-call (or team) reviews alert
├─ Assess if action needed
├─ Decide: Fix now vs. track for later
└─ Alert status: "Reviewed"

T+4h: Check Point (SLA)
├─ Has alert been investigated?
│  ├─ YES → Go to remediation or close
│  └─ NO → Escalate to manager for prioritization
└─ Create ticket if action needed

T+24h: Resolution Target
├─ Issue documented
├─ Ticket created if needed
├─ Fix scheduled or decision made
└─ Alert status: "Closed or ticket created"
```

### Medium Alert Response

**Actions (when alert fires):**
1. Log alert in incident tracking system
2. Review metrics context
3. Assess severity (is it really medium?)
4. Decide on remediation timeline
5. Create ticket if investigation/fix needed
6. Document findings

---

## Escalation Contacts

### CRITICAL Alert Contacts

```
Primary On-Call (Page immediately)
├─ Name: [Person Name]
├─ Phone: [+1 XXX-XXX-XXXX]
├─ SMS: [Number]
├─ Email: [Email]
└─ Available: 24/7

Backup On-Call (Escalate T+5m)
├─ Name: [Person Name]
├─ Phone: [+1 XXX-XXX-XXXX]
├─ SMS: [Number]
├─ Email: [Email]
└─ Available: 24/7

Engineering Manager (Escalate T+10m)
├─ Name: [Manager Name]
├─ Phone: [+1 XXX-XXX-XXXX]
├─ SMS: [Number]
├─ Email: [Email]
└─ Available: Weekdays 9am-6pm, on-call weekends

Director (Escalate T+10m)
├─ Name: [Director Name]
├─ Phone: [+1 XXX-XXX-XXXX]
├─ Email: [Email]
├─ Assistant: [Assistant contact]
└─ Available: Business hours (emergency: any time)
```

### HIGH Alert Contacts

```
Primary On-Call (Same as CRITICAL)

Backup On-Call (Escalate T+15m)

Engineering Manager (Escalate T+30m)

Team Lead (Available for consultation)
├─ Name: [Name]
├─ Email: [Email]
└─ Available: Business hours
```

### MEDIUM Alert Contacts

```
Team Lead (Review & prioritize)
├─ Name: [Name]
├─ Email: [Email]
└─ Available: Business hours

On-Call (Available for consultation)
```

### Contact Update Process

**Update escalation contacts:**
1. Quarterly on-call rotation review
2. When team members change
3. When contact information updates
4. Update in PagerDuty
5. Update in Alertmanager config
6. Update in this document
7. Distribute updated contact list
8. Document approval by manager

---

## Acknowledgment & State Transitions

### Alert States

```
Firing → Acknowledged → Investigating → Resolved → Closed
  ↑          ↑              ↑              ↑        ↑
  └──────────┴──────────────┴──────────────┴────────┘
              (escalation points)
```

### Acknowledgment Methods

**1. PagerDuty UI**
```
Go to: https://pagerduty.com
Click: Incidents → [Incident ID]
Click: Acknowledge
```

**2. PagerDuty Mobile App**
```
Open app
Find incident
Swipe to acknowledge
```

**3. Slack Command**
```
/pagerduty-ack [incident-id]
```

**4. Phone Call**
```
Press digit when responding to call:
"Press 1 to acknowledge"
```

**5. API Call**
```bash
curl -X PUT https://api.pagerduty.com/incidents/[ID] \
  -H "Authorization: Token token=${TOKEN}" \
  -d '{"incidents": [{"id": "[ID]", "status": "acknowledged"}]}'
```

### State Transitions

**Firing → Acknowledged**
- On-call confirms receipt
- Stops further escalation
- Timer resets for investigation start
- Expected within 5 min for CRITICAL, 15 min for HIGH

**Acknowledged → Investigating**
- On-call begins root cause analysis
- May update PagerDuty with status
- May involve other team members
- Expected within 30 min of acknowledgment

**Investigating → Resolved**
- Root cause identified and fixed
- Fix deployed and verified
- Metric returns to normal
- Alert auto-clears in Alertmanager (or manual resolution)

**Resolved → Closed**
- Incident fully resolved
- Post-incident review scheduled (if CRITICAL)
- Findings documented
- Alert dashboard cleared

---

## Escalation Notifications

### Notification Content

**Primary On-Call Notification**
```
🚨 CRITICAL ALERT: ServiceDown

Basset Hound Browser service is down
WebSocket server not responding

Action: Check dashboard immediately
Dashboard: https://grafana.basset-hound.io/...

Respond: /ack [incident-id]
or acknowledge in PagerDuty
```

**Backup On-Call Notification (T+5m)**
```
⚠️ ESCALATION: Primary on-call not responding

CRITICAL Alert: ServiceDown
Still unresolved after 5 minutes

Primary: [Name] [Phone]
You are now primary for this incident

Dashboard: https://grafana.basset-hound.io/...
Respond: /ack [incident-id]
```

**Manager Notification (T+10m)**
```
🔴 CRITICAL ESCALATION: Both on-calls not responding

CRITICAL Alert: ServiceDown
Still unresolved after 10 minutes
Full escalation activated

Primary: [Name] [No response]
Backup: [Name] [No response]
You are now responsible

Incident: [ID]
Dashboard: [URL]
Action required now
```

---

## Escalation Patterns & Prevention

### Warning Signs of Bad Escalation

1. **Frequent escalations to manager**
   - May indicate on-call team is under-resourced
   - Action: Review staffing, training, or tooling

2. **Escalations reach director regularly**
   - Critical issue: Escalation chain is broken
   - Action: Conduct immediate team review

3. **No one acknowledges within SLA**
   - May indicate on-call contact info is wrong
   - Action: Verify and test all contact info

4. **False positive escalations**
   - Alert tuning issue
   - Action: Review alert thresholds

### Escalation Metrics (Monitor These)

```
Metric                    Target      Red Flag
──────────────────────────────────────────────────
Ack time (CRITICAL)       <5 min      >10 min
Ack time (HIGH)           <15 min     >30 min
Escalation rate           <2%         >5%
Escalation to director    <1/month    >2/month
Mean resolution time      <30 min     >60 min
```

---

## Post-Incident Escalation Review

### Required for All Escalations

**Within 24 hours of escalation:**

1. **What triggered escalation?**
   - Alert fired and was not acknowledged within SLA
   - Or issue required manager/director intervention

2. **Why was acknowledgment delayed?**
   - On-call not available?
   - Contact info wrong?
   - Notification failed?
   - On-call didn't understand alert?

3. **Was escalation justified?**
   - Did escalation lead to faster resolution?
   - Were higher levels actually needed?
   - What could have prevented escalation?

4. **Action items**
   - Fix contact info?
   - Improve alert clarity?
   - Training needed?
   - Process changes?

### Root Cause Analysis (CRITICAL escalations only)

Within 48 hours, conduct full RCA:
1. Timeline of events
2. What went wrong
3. Why monitoring/alerts didn't catch it
4. Prevention measures
5. Action items with owners

---

## Testing Escalation Procedures

### Monthly Escalation Drill

**Procedure:**
```
1. Run test alert: curl -X POST /admin/test-alert-critical
2. Measure time to primary on-call acknowledgment (target: <5 min)
3. If not acknowledged in 5 min, verify backup is paged
4. If backup not responding in 5 min, verify manager is paged
5. Acknowledge from highest level
6. Clear test alert
7. Document timing and issues
8. Publish results to team
```

**Success Criteria:**
- [ ] Primary acknowledges within 5 minutes
- [ ] Backup paged within 5 min if primary fails
- [ ] Manager paged within 5 min if backup fails
- [ ] All notifications delivered correctly
- [ ] All contacts reachable
- [ ] Zero escalation chain failures

### Quarterly Contact Verification

- [ ] Call each on-call to verify phone number
- [ ] Verify email addresses are current
- [ ] Confirm availability windows
- [ ] Update PagerDuty with any changes
- [ ] Communicate changes to team
- [ ] Document in change log

---

## Decision Trees

### Should This Alert Escalate?

```
Is acknowledgment SLA already exceeded?
├─ YES → Escalate immediately
└─ NO → Continue monitoring

Has on-call been paged/notified?
├─ NO → Send notification (SMS/call) now
└─ YES → Wait for SLA expiry

Is on-call acknowledging alerts recently?
├─ YES → Likely got the alert, monitoring
└─ NO → May be sleeping/offline

Has any escalation contact acknowledged?
├─ YES → Investigation in progress, don't escalate further
└─ NO → Escalate to next level if SLA exceeded
```

### Should This Be Emergency Restart?

```
Is service completely down?
├─ YES → Restart immediately
└─ NO → Investigate first

Can service auto-remediate?
├─ YES → Wait for auto-remediation
└─ NO → Manual intervention needed

Is manual fix available?
├─ YES → Apply fix
└─ NO → Restart service

Did fix work?
├─ YES → Monitor and resolve incident
└─ NO → Escalate investigation to director
```

---

## Escalation Runbooks

### C1: Service Down - Escalation Runbook

**T+0:** Alert fires
- [ ] Verify service is actually down (check health endpoint)
- [ ] Check if auto-remediation attempted (look at logs)
- [ ] Assess impact scope (all clients or specific region?)

**T+1-5 min:** Investigation
- [ ] Check system logs for crash/error
- [ ] Check for recent deployments
- [ ] Check system resources (memory, disk, CPU)

**T+5 min:** Remediation
- [ ] Restart service: `systemctl restart basset-hound`
- [ ] Verify service is healthy
- [ ] Verify clients can connect

**T+10 min:** Post-remediation
- [ ] Document what happened
- [ ] Plan root cause analysis
- [ ] Close incident when stable

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-21  
**Next Review:** 2026-09-21
