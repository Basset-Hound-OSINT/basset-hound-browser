# Post-Incident Review Procedure

**Document Version:** 1.0  
**Last Updated:** June 13, 2026  
**Classification:** Internal Operations  

---

## Executive Summary

Post-incident reviews (postmortems) are blameless analysis sessions conducted after incidents to understand what happened, why it happened, and how to prevent recurrence.

**Key Principle:** Focus on systems, not people. The goal is learning, not blame.

---

## Timing

### Schedule by Severity

| Severity | Timing | Duration | Participants |
|----------|--------|----------|---------------|
| P1 | Within 24 hours | 1 hour | Full team |
| P2 | Within 48 hours | 45 min | Core team |
| P3 | Within 1 week | 30 min | Involved team |
| P4 | Optional | 15 min | If requested |

### Calendar Blocking

- [ ] Postmortem scheduled immediately after incident
- [ ] Calendar invites sent to all participants
- [ ] Location/video conference link confirmed
- [ ] Scribe assigned and notified

---

## Pre-Postmortem (Preparation)

### Incident Coordinator Prep (15 minutes)

- [ ] Gather war room artifacts
  - Slack channel transcript
  - Conference recording
  - Scribe notes
  - Incident timeline

- [ ] Prepare incident summary
  ```
  Incident ID: ___________
  Severity: P1/P2/P3/P4
  Duration: __________ minutes
  Detected: __________
  Resolved: __________
  Services affected: __________
  Customers impacted: ___________
  ```

- [ ] Create postmortem document
  - Template: [See Appendix A]
  - Shared location: Accessible to all
  - Scribe will fill during meeting

### Participant Prep (5 minutes)

**Participants should:**
- [ ] Review incident timeline
- [ ] Gather any personal notes
- [ ] Review your role/actions during incident
- [ ] Prepare observations or suggestions

**What to prepare:**
- Unexpected events
- Things that worked well
- Things that didn't work
- Ideas for improvement

---

## Postmortem Meeting Agenda

### 1. Opening (5 minutes)

**Facilitator:**
- Welcome everyone
- Set ground rules
- Summarize incident briefly

**Ground Rules:**
1. **Blameless:** No blame on individuals
2. **Focus on systems:** Why did systems allow failure?
3. **Assume good intent:** Everyone was doing their best
4. **Document learning:** Write things down
5. **Psychological safety:** Speak honestly without fear

**Opening Statement:**
```
"We're here to understand what happened in this incident,
not to blame anyone. Our goal is learning and prevention.
Everyone's perspective is valuable."
```

### 2. Timeline Reconstruction (10 minutes)

**Goal:** Build consensus timeline of events

**Process:**
1. **Scribe reads initial timeline** (from war room notes)
2. **Participants add details/corrections**
3. **Fill in any missing times or events**
4. **Verify critical timestamps**

**Example timeline:**
```
14:32 UTC - Alert fires: P99 latency > 500ms
14:34 UTC - L1 on-call acknowledges
14:36 UTC - War room opened
14:40 UTC - DBA identified slow query
14:45 UTC - Query killed
14:47 UTC - Latency returned to normal
14:50 UTC - Incident declared RESOLVED
```

**Timeline validation:**
- [ ] Alert time confirmed
- [ ] Detection time confirmed
- [ ] Resolution time confirmed
- [ ] All key actions recorded

### 3. Incident Summary (5 minutes)

**Lead:** On-call engineer or incident commander

**Content:**
- What service was affected
- What the symptoms were
- How many users impacted
- What the resolution was

**Template:**
```
At 14:32 UTC, the database query performance degraded,
causing API latency to spike to >500ms. This affected
approximately 10% of users trying to access the browser.
The root cause was a missing index on the users table,
causing a full table scan on login queries.
We resolved by adding the index and killing the slow query.
Service was fully restored at 14:50 UTC, 18 minutes duration.
```

### 4. Root Cause Analysis (20 minutes)

**Goal:** Find the true root cause, not just symptoms

**Facilitator asks:** "Why did this happen?"

#### 4.1 The "5 Whys" Technique

Starting with the symptom, ask "why?" 5 times:

```
1. Why was latency high?
   → Because database queries were slow

2. Why were database queries slow?
   → Because the login query was doing a full table scan

3. Why was there a full table scan?
   → Because there was no index on the users.email column

4. Why wasn't there an index?
   → Because the code change added an email-based lookup
     without adding the corresponding index

5. Why wasn't this caught before production?
   → Because we don't require index review in PRs
     and staging doesn't have realistic data volume
```

**Root Cause:** Missing index on frequently-queried column

#### 4.2 Contributing Factors

Beyond the root cause, identify factors that made it worse:

- [ ] Code review didn't catch missing index
- [ ] Staging data too small to show problem
- [ ] No pre-deployment query performance testing
- [ ] Monitoring alert took 2 minutes to fire

#### 4.3 Prevention: Why Did We Not Catch It?

**Failure points:**
1. **Code review process:** Didn't check database changes
2. **Staging environment:** Data too small to expose issue
3. **Monitoring:** Alert threshold appropriate but after impact
4. **Runbooks:** Didn't have quick diagnosis path for database

### 5. What Went Well (5 minutes)

**Goal:** Recognize effective actions and reinforce them

**Questions:**
- What did the team do well?
- What helped resolve the issue quickly?
- What tools/processes were helpful?

**Examples:**
- [ ] War room coordination was clear
- [ ] Database team responded quickly
- [ ] Communication to customers was timely
- [ ] On-call engineer knew where to look
- [ ] Monitoring alert fired accurately

**Action:** Document 2-3 things that went well to repeat

### 6. What Didn't Go Well (5 minutes)

**Goal:** Identify what made response difficult

**Questions:**
- What slowed us down?
- What was confusing?
- What failed or didn't help?

**Examples:**
- [ ] Took time to identify root cause
- [ ] Database runbook not comprehensive enough
- [ ] Slow to kill stuck query
- [ ] Customer notification delayed

**Action:** These become prevention action items

### 7. Action Items (10 minutes)

**Goal:** Create specific, assigned tasks to prevent recurrence

**For each issue identified:**

1. **Define action item:**
   ```
   "Add index on users.email column to prevent full table scans"
   ```

2. **Assign owner:**
   ```
   Owner: Sarah (backend lead)
   ```

3. **Set due date:**
   ```
   Due: Wednesday (3 days)
   ```

4. **Estimate effort:**
   ```
   Effort: 1-2 hours (20 lines of code)
   ```

5. **Define acceptance criteria:**
   ```
   ✓ Index created
   ✓ Query performance improved >10x
   ✓ Production verified
   ✓ Runbook updated
   ```

**Action item categories:**

| Category | Examples |
|----------|----------|
| Code/Design | Add index, optimize query, refactor code |
| Process | Add code review requirement, add test |
| Monitoring | Add alert, improve dashboard, add metric |
| Documentation | Update runbook, add troubleshooting guide |
| Training | Teach team about database optimization |
| Tools | Add monitoring tool, improve logging |

**Typical action items per incident:**
- 3-5 technical fixes
- 1-2 process improvements
- 1-2 documentation updates

### 8. Closing (5 minutes)

**Facilitator:**
- Thank everyone for participation
- Confirm action item owners understand
- Confirm tracking location for action items
- Schedule follow-up (if needed for large incidents)

**Closing statement:**
```
"Great discussion. We've identified the root cause and
5 action items to prevent similar incidents. Sarah will
lead the index implementation, and the team will follow up
in 1 week to confirm completion. Let's not let this happen again."
```

---

## Post-Postmortem

### Documentation

- [ ] **Postmortem document completed**
  - Timeline
  - Root cause
  - Contributing factors
  - What went well
  - What didn't go well
  - Action items with owners and due dates
  - Location: [Shared drive/wiki]

- [ ] **Postmortem published**
  - Shared with team
  - Available for future reference
  - Link posted in #incidents channel

### Action Item Tracking

- [ ] **Action items entered into tracker**
  - Jira/GitHub/Linear/etc
  - Owner assigned
  - Due date set
  - Label: postmortem-action
  - Link to postmortem

- [ ] **Owners confirm understanding**
  - Message to owner: "Please confirm you'll implement [action]"
  - Owner responds: "Understood, will complete by [date]"

### Team Communication

- [ ] **Team notified of action items**
  - Message: "Postmortem complete. Here are the 5 action items..."
  - Link to postmortem document
  - Timeline for fixes

- [ ] **Stakeholders informed (if P1)**
  - Executive summary of incident
  - Key actions being taken
  - Timeline for prevention

### Follow-Up

- [ ] **Check-in at 50% of due date**
  - Is owner on track?
  - Any blockers?
  - Adjust timeline if needed

- [ ] **Verify completion before due date**
  - Has action item been completed?
  - Does it fix the issue?
  - Are there side effects?

- [ ] **Close action item**
  - Confirm implementation
  - Verify with team
  - Archive postmortem

---

## Special Cases

### Case 1: Repeated Incident (Same Root Cause)

**If we have the same incident twice:**

1. **Root cause analysis:**
   - "Why did the previous action item not prevent this?"
   - "Was it not implemented?"
   - "Was the fix ineffective?"
   - "Did something change since?"

2. **Escalate:**
   - Previous owner + current team
   - VP Engineering notified
   - Treat as process failure

3. **Enhanced action items:**
   - More robust fix
   - Multiple prevention layers
   - Monitoring/alerting
   - Culture/training change

### Case 2: Incident with External Blame

**If the incident was "caused by" an external dependency:**

Still do postmortem:
1. What should we have done differently?
2. How can we degrade gracefully?
3. How can we detect this faster?
4. How can we isolate impact?

**Example:** External API failure
- [ ] Should we have had circuit breaker?
- [ ] Should we cache responses?
- [ ] Should we fail over to another service?
- [ ] Should we have alerted customers proactively?

### Case 3: Near-Miss (Potential Incident Prevented)

**Postmortem for close calls:**

1. **What almost happened?**
2. **What prevented it?**
3. **Was the prevention robust?**
4. **Should we formalize the prevention?**

---

## Postmortem Document Template

See Appendix A below.

---

## Common Mistakes to Avoid

- [ ] **Skipping postmortem** - "Too busy to do it"
  - **Fix:** Schedule immediately, do it even if brief

- [ ] **Blaming individuals** - "John's code caused this"
  - **Fix:** Ask "Why did the system allow this code?"

- [ ] **Vague action items** - "Improve database performance"
  - **Fix:** Make items specific and measurable

- [ ] **Too many action items** - 10+ items
  - **Fix:** Prioritize; focus on preventing recurrence

- [ ] **Action items not completed** - Assigned but never done
  - **Fix:** Assign owners, set due dates, track progress

- [ ] **No follow-up** - Postmortem filed and forgotten
  - **Fix:** Track action items; verify completion

---

## Appendix A: Postmortem Document Template

```markdown
# Postmortem: [Service Name] - [Brief Description]

**Date:** [Date]
**Incident ID:** [ID]
**Severity:** [P1/P2/P3]
**Duration:** [Length]
**Lead:** [Name]

## Timeline

- **14:32** - Alert fires: P99 latency > 500ms
- **14:34** - L1 on-call acknowledges alert
- **14:36** - War room opened
- ...
- **14:50** - Incident declared RESOLVED

## Incident Summary

[2-3 paragraphs describing what happened, impact, and resolution]

## Root Cause Analysis

### The "5 Whys"

1. Why was [symptom]? → [Answer]
2. Why was [answer]? → [Answer]
3. Why was [answer]? → [Answer]
4. Why was [answer]? → [Answer]
5. Why was [answer]? → **ROOT CAUSE**

### Root Cause Statement

[The core reason this incident occurred]

### Contributing Factors

- [Factor 1]: [Explanation]
- [Factor 2]: [Explanation]
- [Factor 3]: [Explanation]

## What Went Well

- [Thing 1]: [Why effective]
- [Thing 2]: [Why effective]
- [Thing 3]: [Why effective]

## What Didn't Go Well

- [Issue 1]: [Impact]
- [Issue 2]: [Impact]
- [Issue 3]: [Impact]

## Action Items

| Item | Owner | Due | Effort | Notes |
|------|-------|-----|--------|-------|
| [Action 1] | [Name] | [Date] | [1-2 hrs] | [Details] |
| [Action 2] | [Name] | [Date] | [1-2 hrs] | [Details] |
| [Action 3] | [Name] | [Date] | [1-2 hrs] | [Details] |

## Appendix: War Room Recording

[Link to recording if available]

## Appendix: Relevant Logs

[Links to log files, metrics, etc.]
```

---

## Metrics to Track

**After each postmortem:**

- [ ] Time to first response
- [ ] Time to identification
- [ ] Time to resolution
- [ ] Number of action items
- [ ] Severity level
- [ ] Customers impacted
- [ ] Repeat incident? (Y/N)

**Track over time to identify trends:**
- Are we getting faster at responding?
- Are action items getting completed?
- Are we preventing repeat incidents?
- Which areas need most focus?

