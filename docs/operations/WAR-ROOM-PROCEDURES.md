# War Room Procedures

**Document Version:** 1.0  
**Last Updated:** June 13, 2026  
**Classification:** Internal Operations  

---

## Executive Summary

War room procedures define how teams coordinate during critical incidents. Effective war rooms minimize confusion, accelerate resolution, and ensure clear communication.

---

## War Room Activation

### Trigger Criteria

**Activate war room for:**
- P1 incidents (Critical severity)
- Complex incidents requiring coordination
- Customer-facing outages >30 minutes
- Security incidents
- Data loss/corruption

### Activation Steps

1. **Declare Incident**
   ```
   @here INCIDENT DECLARED: [Brief Description]
   Severity: P[1-4]
   Start Time: [Time]
   Status Page: [Update with link]
   ```

2. **Create War Room Channel**
   - Channel: `#incident-[incident-id]`
   - Description: `[Severity] [Service] - [Description] | Started: [Time]`
   - Pin: Incident link, status page, key dashboards

3. **Open Conference Bridge**
   - Platform: Zoom / Teams / Phone bridge
   - Recording: Enabled
   - Dial-in: [Published in channel]

4. **Invite Responders**
   - L1 On-call (automatic via PagerDuty)
   - L2/L3 (as needed based on incident type)
   - Manager
   - Specialists (DBA, Infra, Security, etc.)
   - Product/Customer Success (if customer-facing)

5. **Assign War Room Roles**
   - [ ] Incident Commander
   - [ ] Technical Lead
   - [ ] Scribe
   - [ ] Communicator

---

## War Room Roles

### Incident Commander

**Responsibility:** Overall incident direction, escalation, decisions

**Duties:**
1. Assess incident severity
2. Assign roles and tasks
3. Ensure clear communication
4. Make go/no-go decisions (escalate to L3)
5. Declare incident resolved or escalate
6. Approve postmortem scheduling

**Authority:**
- Can authorize emergency changes
- Can kill connections/processes
- Can declare rollback
- Can wake up off-duty staff

### Technical Lead

**Responsibility:** Direct troubleshooting and resolution

**Duties:**
1. Lead root cause investigation
2. Coordinate diagnostics
3. Implement fixes
4. Verify resolution
5. Report findings to commander

**Requires:**
- Deep technical knowledge
- Calm under pressure
- Good judgment on escalation

### Scribe

**Responsibility:** Document incident timeline and decisions

**Duties:**
1. Record timeline of events
2. Document all decisions made
3. Track action items
4. Note what works/what doesn't
5. Prepare postmortem outline

**Outputs:**
```
Timeline:
- 14:32 UTC: Alert fired (P99 latency > 500ms)
- 14:34 UTC: Commander assigned (John Smith)
- 14:35 UTC: Root cause hypothesis (database lock)
- 14:40 UTC: Kill long-running query
- 14:42 UTC: Latency returning to normal
- 14:45 UTC: Incident declared RESOLVED

Decision Log:
- Query killed due to >2 min lock wait
- No rollback needed
- Postmortem scheduled for 15:30 UTC

Action Items:
- DBA to optimize query (John - due Wed)
- Add monitoring for lock waits (Sarah - due Friday)
```

### Communicator

**Responsibility:** Keep stakeholders and customers informed

**Duties:**
1. Update status page every 15 minutes
2. Send customer notifications (for outages >30 min)
3. Brief executives on status
4. Document all communications
5. Manage expectations (under-promise, over-deliver)

**Communication Template:**

```
Status: INVESTIGATING
Severity: P2

Current Status:
We are experiencing [brief description]. Our team is actively investigating.

Impact:
~10% of requests are failing. Specific endpoints: [list]

Timeline:
- 14:32 UTC: Issue detected
- 14:35 UTC: Incident commander assigned
- 14:40 UTC: Root cause likely identified

Next Update:
In 15 minutes or when status changes

Apologies for the disruption. We'll have updates soon.
```

---

## War Room Communication Cadence

### Initial Phase (First 15 minutes)

**Frequency:** Every 5 minutes

```
Round 1 (5 min):
- What happened
- Severity assessment
- Who's involved
- Initial hypothesis

Round 2 (10 min):
- Investigation findings
- Actions taken
- Early fixes attempted
- Status

Round 3 (15 min):
- Updated hypothesis
- New actions
- Progress toward resolution
- Escalation if needed
```

### Investigation Phase (15-60 minutes)

**Frequency:** Every 10 minutes

```
Standard Update:
1. Status summary (1 sentence)
2. What we know (bullet points)
3. What we're testing (bullet points)
4. Next steps (bullet points)
5. ETA to resolution (if known)
```

### Resolution Phase (Last 30 minutes)

**Frequency:** Every 5 minutes

```
Countdown Updates:
- Current metrics
- Confidence level
- Final verification steps
- Estimated time to close
```

### Post-Incident Phase

**Final Communication:**

```
INCIDENT RESOLVED
Root Cause: [Description]
Duration: [Total time]
Impact: [Affected users, data]
Resolution: [What was done]
Prevention: [What we're doing to prevent]

Postmortem: [Scheduled time]
```

---

## War Room Best Practices

### Do's

- [ ] **Stay focused** - Only discuss incident resolution
- [ ] **Communicate clearly** - Use precise technical language
- [ ] **Ask for help** - Don't struggle alone
- [ ] **Document decisions** - Scribe captures everything
- [ ] **Update regularly** - Keep momentum
- [ ] **Escalate when stuck** - Don't waste time
- [ ] **Verify fixes** - Check resolution before declaring done
- [ ] **Remain calm** - Panic spreads; competence spreads faster

### Don'ts

- [ ] **Don't blame** - Focus on fix, not fault
- [ ] **Don't try every idea** - Hypothesis first
- [ ] **Don't overlap roles** - Clear authority
- [ ] **Don't forget customers** - Keep status page updated
- [ ] **Don't go silent** - Communicate frequently
- [ ] **Don't implement unsafe fixes** - Verify first
- [ ] **Don't forget escalation paths** - Know who to call
- [ ] **Don't continue past resolution** - Close promptly

---

## Escalation in War Room

### Escalation Triggers

**Escalate to L3 if:**
- Issue not improving after 15 minutes
- Root cause still unclear after investigation
- Multiple systems affected
- Requires emergency change authorization
- Customer communication needed

**Escalation Process:**

1. **Commander** calls L3
   ```
   "We have a P[X] incident affecting [service]. 
   Root cause: [description]. 
   Needs: [authorization, expertise, etc.]"
   ```

2. **L3 joins war room** with full context
3. **L3 makes decision** on:
   - Emergency changes allowed
   - Rollback vs. forward fix
   - Customer communication level
4. **Resume resolution** with L3 guidance

### Escalation to Executives (P1 Only)

**When to escalate:**
- P1 incident >30 minutes unresolved
- Customer data loss
- Security breach
- Widespread outages

**Communicator briefs:**
- VP Engineering
- CEO (if customer-facing)
- Legal (if data breach)

---

## War Room Artifacts

### During Incident

1. **Incident Channel** (Slack)
   - Real-time updates
   - Decision log
   - Key links

2. **Conference Recording** (Zoom)
   - Full audio of investigation
   - Useful for postmortem

3. **Scribe Document**
   - Timeline
   - Decisions
   - Key findings
   - Action items

### Post-Incident

1. **Incident Report**
   - Time to resolution
   - Root cause
   - Customer impact
   - Prevention measures

2. **Postmortem Notes**
   - Team retrospective
   - Lessons learned
   - Assigned action items

---

## War Room Closeout

### Incident Commander Closeout Checklist

- [ ] **Verification:** Issue fully resolved, not band-aid
- [ ] **Confidence:** >95% issue won't recur immediately
- [ ] **Documentation:** Scribe has complete timeline
- [ ] **Communication:** Final status page update sent
- [ ] **Escalation:** No open risks needing L3
- [ ] **Team:** Check everyone is okay
- [ ] **Postmortem:** Scheduled for next business day

### Closeout Statement

```
INCIDENT CLOSED

Resolution: [What was done]
Root Cause: [Why it happened]
Duration: [Total incident time]
Impact: [How many users affected]

Prevention Measures:
- [Action 1]
- [Action 2]

Postmortem: [Time and date]

Great work everyone. Let's reconvene in postmortem.
```

---

## Common War Room Scenarios

### Scenario 1: Database Slow

```
00:00 - Alert fires (P99 latency > 500ms)
00:02 - War room opened
00:05 - DBA joins, investigates slow queries
00:10 - Long-running query identified
00:15 - Query killed
00:20 - Latency returning to normal
00:25 - Incident declared RESOLVED
Total: 25 minutes
```

### Scenario 2: Application Crash

```
00:00 - Alert fires (P1 - service down)
00:01 - War room opened, app team joins
00:05 - Recent deployment identified as likely cause
00:10 - Rollback decision made
00:15 - Rollback in progress
00:20 - Service restored
00:25 - Incident declared RESOLVED
Total: 25 minutes
```

### Scenario 3: Complex Multi-System Issue

```
00:00 - Alert fires (P2 - high error rate)
00:02 - War room opened with L1, L2
00:10 - Multiple hypotheses investigated
00:20 - Still investigating (escalate to L3)
00:25 - L3 joins, prioritizes investigation
00:35 - Root cause identified (missing configuration)
00:45 - Configuration corrected
00:55 - Metrics returned to normal
01:00 - Incident declared RESOLVED
Total: 60 minutes
```

---

## Post-War Room Checklist

- [ ] Incident channel archived
- [ ] Recording stored securely
- [ ] Scribe document shared
- [ ] Postmortem meeting scheduled
- [ ] Action items tracked in project management
- [ ] Team debriefing (quick 10-min check-in)
- [ ] Thank you message sent to responders

---

## Training & Drills

**War room drills recommended:**
- Quarterly simulation (2x per year)
- Practice with real incident that didn't need war room
- Test procedures and communication

**Drill script:**

```
SIMULATED INCIDENT
Service: Basset Hound Browser API
Issue: 50% request error rate
Start Time: [Time]

Objectives:
- Activate war room
- Assign roles
- Investigate (simulated)
- Resolve (simulated)
- Communicate clearly
- Close incident

Duration: 30 minutes
```

