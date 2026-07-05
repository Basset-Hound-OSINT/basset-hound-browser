# Post-Incident Procedures

**Document Version:** 1.0  
**Date:** June 21, 2026  
**Purpose:** Procedures for incident closure, RCA, and continuous improvement  
**Audience:** Incident commanders, team leads, engineers

---

## Table of Contents

1. [Immediate Post-Incident (1 hour)](#immediate-post-incident-1-hour)
2. [Short-Term Actions (24 hours)](#short-term-actions-24-hours)
3. [Root Cause Analysis](#root-cause-analysis)
4. [Post-Incident Review Meeting](#post-incident-review-meeting)
5. [Action Items & Follow-up](#action-items--follow-up)
6. [Continuous Improvement](#continuous-improvement)
7. [Documentation & Archival](#documentation--archival)

---

## Immediate Post-Incident (1 hour)

### Step 1: Verify Complete Resolution (5 min)

**Immediately after incident is resolved:**

```bash
# Confirm service is fully operational
curl -s http://localhost:8765/health | jq '.status'
# Should show: "healthy"

# Check metrics returned to normal
curl -s 'http://prometheus:9090/api/v1/query?query=rate(basset_errors_total[5m])' | jq
# Should be near baseline

# Verify WebSocket connectivity
docker exec basset-hound-browser curl -s http://localhost:8765 | head -c 100
# Should get a response

# Check for any lingering errors
docker logs --tail=50 basset-hound-browser | grep -i error | wc -l
# Should be 0 or very low

# Confirm customer-facing services
# (Test from customer perspective if possible)
```

**Sign-off:**

If all checks pass:

```
Post to Slack #incidents:
✓ INCIDENT RESOLVED - INC-[YYYYMMDD]-[XXXX]
Status: All systems confirmed operational
Verification: ✓ Health checks passing
            ✓ Metrics normal
            ✓ No errors in logs
            ✓ Customer services verified

Moving to post-incident phase.
Final report will follow within 24 hours.
```

### Step 2: Secure Incident Artifacts (10 min)

**Create incident evidence package:**

```bash
#!/bin/bash
INCIDENT_ID="INC-$(date +%Y%m%d)-XXXX"
mkdir -p /incidents/${INCIDENT_ID}

# 1. Capture container logs
docker logs basset-hound-browser > /incidents/${INCIDENT_ID}/container.log 2>&1

# 2. Capture system logs (last 2 hours)
docker exec basset-hound-browser journalctl --since="2 hours ago" \
  > /incidents/${INCIDENT_ID}/system.log 2>&1

# 3. Capture recent processes
docker exec basset-hound-browser ps aux \
  > /incidents/${INCIDENT_ID}/processes.txt 2>&1

# 4. Capture network state
docker exec basset-hound-browser netstat -tlnp \
  > /incidents/${INCIDENT_ID}/netstat.txt 2>&1

# 5. Capture disk state
docker exec basset-hound-browser df -h \
  > /incidents/${INCIDENT_ID}/disk.txt 2>&1

# 6. Export metrics from Prometheus (optional, if available)
# curl -s 'http://prometheus:9090/api/v1/query?query=...' \
#   > /incidents/${INCIDENT_ID}/metrics.json

# 7. Copy Slack conversation
# (Manual export from Slack - automated export if available)
# cp [exported-slack-thread] /incidents/${INCIDENT_ID}/slack-thread.txt

# 8. Create manifest
cat > /incidents/${INCIDENT_ID}/MANIFEST.txt <<EOF
Incident ID: ${INCIDENT_ID}
Type: [Incident type - Memory/Error/Unavailability/etc.]
Severity: [P1/P2/P3]
Start Time: [ISO 8601 timestamp]
Resolution Time: [ISO 8601 timestamp]
Duration: [minutes]
Services Affected: [List services]
Customers Affected: [number or scope]
Root Cause: [Brief summary - detailed analysis pending]

Artifacts:
- container.log: Container logs during incident
- system.log: System journal during incident
- processes.txt: Process state at resolution
- netstat.txt: Network state at resolution
- disk.txt: Disk usage at resolution
- metrics.json: Time-series metrics (if exported)
- slack-thread.txt: Team communication during incident

Created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Archived By: [Your name]
EOF

# 9. Compress and store
tar czf /incidents/${INCIDENT_ID}.tar.gz /incidents/${INCIDENT_ID}

# 10. Create checksum for integrity
cd /incidents
sha256sum ${INCIDENT_ID}.tar.gz > ${INCIDENT_ID}.sha256

echo "Incident artifacts secured in /incidents/${INCIDENT_ID}/"
echo "Compressed: /incidents/${INCIDENT_ID}.tar.gz"
```

**Store securely:**

```bash
# Copy to secure/backup location
cp /incidents/${INCIDENT_ID}.tar.gz /backup/incidents/
cp /incidents/${INCIDENT_ID}.sha256 /backup/incidents/

# Verify integrity
cd /backup/incidents
sha256sum -c ${INCIDENT_ID}.sha256
# Should output: "[file] OK"
```

### Step 3: Update Status Page (5 min)

**Post incident resolution:**

```
Status Page Update:

Title: RESOLVED - [Service] [Issue Type]
Body:

Issue: [What happened]
Root Cause: [If known; otherwise "root cause analysis in progress"]
Duration: [Total time]
Impact: [Who/what was affected]
Resolution: [What we did to fix it]

We sincerely apologize for the disruption.
Detailed analysis will be available [when].

Incident ID: INC-[YYYYMMDD]-[XXXX]

Timestamp: [Current UTC time]
```

### Step 4: Prepare Initial Report (10 min)

**For incident commander:**

```markdown
# Incident Report - INC-[YYYYMMDD]-[XXXX]

**INCIDENT OVERVIEW**
- Type: [Memory/Error/Unavailability/Performance/Security]
- Severity: [P1/P2/P3]
- Start: [ISO 8601 timestamp] UTC
- End: [ISO 8601 timestamp] UTC
- Duration: [XX minutes]

**INITIAL ROOT CAUSE (Preliminary)**
[Brief summary of suspected root cause]
[Note: Full RCA pending review meeting]

**IMPACT SUMMARY**
- Services Affected: [List]
- Customers Affected: [Number/scope]
- SLA Breach: [Yes/No]
- Data Loss: [Yes/No]

**IMMEDIATE ACTIONS TAKEN**
1. [Action 1]
2. [Action 2]
3. [Action 3]

**CURRENT STATUS**
- Service: [Operational / Monitoring / Stable]
- Verification: [All checks passing]
- Next Step: [Post-incident review scheduled for [date/time]]

**NEXT PHASE**
- Post-incident review meeting: [Date/Time/Link]
- Full RCA: [Estimated completion date]
- Action items: [To be determined in review meeting]

---
Report prepared: [Name] at [time]
Artifacts: /incidents/INC-[YYYYMMDD]-[XXXX]/
```

### Step 5: Notify Stakeholders (5 min)

**Send communications:**

**Internal Email:**

```
To: [Engineering team, managers, relevant stakeholders]
CC: [VP Engineering, CTO if P1]
Subject: Incident Resolution Summary - INC-[YYYYMMDD]-[XXXX]

Team,

The incident in Basset Hound Browser has been resolved.

INCIDENT SUMMARY
- Type: [Incident type]
- Duration: [Total time] minutes
- Root Cause: [If known; otherwise "analysis in progress"]
- Resolution: [What we did to fix it]

IMPACT
- Services: [Affected services]
- Customers: [Impact scope]
- Duration: [Customer-facing duration]

NEXT STEPS
- Post-incident review meeting: [Date/Time]
- Full root cause analysis: [Estimated completion]
- Prevention measures: [To be determined]

We thank everyone who responded to this incident.

[Your name]
Incident Commander
```

**External Communication (if customer-facing):**

See CONTACT-PROCEDURES.md for customer communication template.

---

## Short-Term Actions (24 hours)

### Step 1: Schedule Post-Incident Review (Next business day)

**Create calendar invite:**

```
Event: Post-Incident Review - INC-[YYYYMMDD]-[XXXX]
Time: [Within 48 hours of incident]
Duration: 60-90 minutes
Location: [War room link or meeting room]

Required Attendees:
- Incident Commander
- Primary On-Call Engineer
- SRE Lead
- Tech Lead
- [Any other key responders]

Optional Attendees:
- Engineering Manager
- Product Manager (if customer impact)
- Customer Success (if customer impact)
- Security Team (if security incident)

Agenda:
1. Timeline review (10 min)
2. Root cause analysis (20 min)
3. What went well (10 min)
4. What could improve (15 min)
5. Action items (15 min)

Preparation:
- Review incident artifacts (/incidents/INC-[ID]/)
- Gather metrics/logs
- Prepare timeline
- Document questions

Resources:
- Incident artifacts: /incidents/INC-[YYYYMMDD]-[XXXX]/
- Metrics dashboard: [Link to Grafana]
- Decision tree used: DECISION-TREES.md
- Relevant runbook: [Link to runbook]
```

### Step 2: Preliminary Root Cause Analysis (Ongoing)

**During the 24-hour window:**

**Conduct initial investigation:**

```bash
# 1. Review incident timeline
docker logs basset-hound-browser | grep -i "error\|warning" | \
  grep -E "2026-06-21 14:[0-9]{2}" | head -20
# (Adjust timestamps to incident window)

# 2. Check for recent deployments
git log --since="[incident start - 2 hours]" --until="[incident end + 30 min]" --oneline | head -10

# 3. Analyze error patterns
docker logs --timestamps basset-hound-browser | \
  grep "ERROR\|CRITICAL" | \
  awk '{print $(NF-2), $NF}' | sort | uniq -c | sort -rn
# Shows error types and their frequency

# 4. Check system metrics at incident time
# (Export from Prometheus/Grafana for the time window)

# 5. Identify any correlated events
# - Deployment changes
# - Traffic spikes
# - Dependency issues
# - Infrastructure changes
```

**Create preliminary findings document:**

```markdown
# PRELIMINARY ROOT CAUSE ANALYSIS
## INC-[YYYYMMDD]-[XXXX]

### TIMELINE
[Detailed timeline of incident with timestamps]

### SUSPECTED ROOT CAUSE(S)
[List potential causes in order of likelihood]

### EVIDENCE
[Data supporting each suspected cause]

### RULING OUT
[Causes that have been ruled out and why]

### CONFIDENCE LEVEL
[High/Medium/Low - based on evidence gathered]

### NEXT INVESTIGATION STEPS
[What needs deeper analysis]

---
Prepared by: [Name]
Date: [Date/Time]
Status: PRELIMINARY - Full analysis pending review meeting
```

### Step 3: Implement Immediate Fixes (If needed)

**For critical bugs discovered:**

If investigation reveals a critical bug:

```bash
# 1. Create fix branch
git checkout -b fix/INC-[YYYYMMDD]-[issue]

# 2. Implement fix
# [Code changes]

# 3. Test fix locally
npm test
# [Run relevant test suites]

# 4. Create pull request
# Title: Fix: [Description] - INC-[YYYYMMDD]-[XXXX]
# Description: Link to incident, describe fix, testing done

# 5. Get review (expedited for critical fixes)

# 6. Merge to main
git merge --squash [branch]

# 7. Build and deploy
# (Use standard deployment procedures, not emergency push)

# 8. Verify fix
# Test in staging first
# Deploy to production with monitoring
```

**Document fix:**

```markdown
# Fix for INC-[YYYYMMDD]-[XXXX]

## Issue
[What the bug was]

## Root Cause
[Why it happened]

## Solution
[How we fixed it]

## Testing
[How we verified the fix]

## Deployment
- PR: [GitHub link]
- Merged: [Date/Time]
- Deployed to production: [Date/Time]
- Verified: [Date/Time]

## Prevention
[What we'll do to prevent similar bugs]

---
Implemented by: [Name]
Reviewed by: [Name]
```

---

## Root Cause Analysis

### RCA Meeting Agenda

**Duration: 60-90 minutes**

```
1. INTRODUCTION (5 min)
   - Incident ID and type
   - Severity and impact
   - Desired outcome: Honest discussion, no blame
   - Ground rules:
     * Focus on systems, not individuals
     * Ask "why" 5 times to find root cause
     * No punishment for failures - learn from them

2. INCIDENT TIMELINE (15 min)
   - Present detailed timeline
   - When did it start?
   - How was it detected?
   - What actions were taken?
   - When was it resolved?
   - [Display timeline on screen]

3. ROOT CAUSE ANALYSIS (30 min)
   - Initial hypothesis: [Suspected cause]
   - Evidence supporting it: [Data]
   - Let's dig deeper: Why did that happen?
   - Keep asking: Why? Why? Why?
   - Until we reach the actual root cause
   
   Common root causes to explore:
   - Code bug in recent deployment?
   - Configuration issue?
   - Capacity/resource issue?
   - Dependency failure?
   - Human error?
   - Infrastructure change?
   - Unknown/external factor?

4. IMPACT ASSESSMENT (10 min)
   - What was affected?
   - How many customers/users?
   - Was there data loss?
   - SLA breach?
   - Customer notifications required?

5. RESPONSE QUALITY REVIEW (10 min)
   - What went well? (Be specific)
     * Fast detection?
     * Good communication?
     * Quick decision-making?
   - What could we improve? (Be specific)
     * Took too long to respond?
     * Unclear decision process?
     * Poor documentation?
     * Need better tools/visibility?

6. ACTION ITEMS (10 min)
   - What should we fix? (Code/process/tools)
   - What should we prevent? (Training/monitoring/automation)
   - What should we improve? (Runbooks/docs/procedures)
   
   For each action item:
   - Description: [What and why]
   - Owner: [Who's responsible]
   - Due date: [When it must be done]
   - Priority: [Critical/High/Medium]

7. CLOSING (5 min)
   - Thank everyone
   - Confirm action items
   - Announce when full report will be available
   - Dismiss
```

### RCA Facilitation Tips

**As facilitator:**

- Keep it blameless: "We're analyzing the system, not the person"
- Encourage participation: "What else could have contributed?"
- Use the five whys:
  ```
  Why did the service go down?
  → Because memory exceeded 85%
  
  Why did memory exceed 85%?
  → Because of a memory leak in the screenshot cache
  
  Why was there a memory leak?
  → The cache wasn't flushing old entries
  
  Why wasn't the cache flushing?
  → The TTL logic was broken in the recent deployment
  
  Why did the broken code get deployed?
  → It wasn't caught in code review
  ```

- Document as you go: Someone should record action items
- Keep energy positive: "Good catch investigating this"
- Stay on track: Don't get lost in implementation details
- Ask "how can we prevent this" not "who's at fault"

### RCA Output: Root Cause

**Final statement should be:**

```
ROOT CAUSE: [Specific, actionable description]

Example (Good):
"The screenshot cache flush interval decreased from 1 hour to 1 minute
in PR #12345, causing excessive memory accumulation on high-load days
when screenshots were being captured frequently."

Example (Bad - too vague):
"Memory leak in cache"

Example (Bad - blaming):
"Engineer X forgot to test the cache flush logic"
```

---

## Post-Incident Review Meeting

### Meeting Facilitation

**Before the meeting:**

- Email all artifacts and preliminary analysis 24 hours before
- Ask attendees to come prepared with observations
- Set ground rules (blameless, solution-focused)

**During the meeting:**

- Follow the agenda strictly (stay on time)
- Record action items in a shared document
- Take notes for the report
- Encourage open discussion
- Capture both "went well" and "could improve" items

**After the meeting:**

- Send out completed action item list within 2 hours
- Email meeting notes to all attendees
- Start working on high-priority action items immediately

### Meeting Output: Action Items

**Template for action items:**

```
ACTION ITEM #1: [Descriptive title]
Type: Code Fix / Process Change / Documentation / Training / Tools
Severity: Critical / High / Medium / Low
Owner: [Person responsible]
Due Date: [Specific date]
Description:
  Problem: [What issue this addresses]
  Solution: [How we'll fix it]
  Verification: [How we'll know it's done]
  
Status: Not Started / In Progress / Complete

Priority:
- CRITICAL: Implement immediately (within 3 days)
- HIGH: Implement this week
- MEDIUM: Implement this month
- LOW: Implement when capacity allows
```

**Example action items:**

```
ACTION ITEM #1: Fix cache flush logic in screenshot module
Type: Code Fix
Severity: Critical
Owner: Alice
Due: 2026-06-23
Description:
  Problem: Cache flush interval was reduced in PR #12345, causing memory 
  leak under high load
  Solution: Revert the interval change and implement proper cache eviction 
  with tests
  Verification: Memory stays < 80% under 1-hour sustained load test

---

ACTION ITEM #2: Add automatic memory leak detection
Type: Tools
Severity: High
Owner: Bob
Due: 2026-06-28
Description:
  Problem: We didn't detect the memory leak until it was critical
  Solution: Implement automatic memory trend analysis in monitoring 
  (alert if growing > 10%/hour)
  Verification: Alert fires before memory reaches 80%

---

ACTION ITEM #3: Improve cache flush testing
Type: Code/Testing
Severity: High
Owner: Carol
Due: 2026-06-27
Description:
  Problem: Cache flush logic wasn't thoroughly tested
  Solution: Add integration tests for cache behavior under various loads
  Verification: Tests pass, code review catches any similar issues
```

---

## Action Items & Follow-up

### Tracking Action Items

**Create tracking spreadsheet:**

| ID | Title | Type | Owner | Due Date | Priority | Status | Notes |
|----|----|------|-------|----------|----------|--------|-------|
| 1 | Fix cache flush logic | Code | Alice | 2026-06-23 | Critical | In Progress | PR #456 open for review |
| 2 | Add memory leak detection | Tools | Bob | 2026-06-28 | High | Not Started | Design doc pending |
| 3 | Improve cache testing | Testing | Carol | 2026-06-27 | High | Not Started | Waiting on Alice's PR |

**Update weekly:**

```
Weekly sync email to team:

Subject: Post-Incident Action Items - Week of June 23

Action Item Status Update:

✓ COMPLETE:
  [None this week]

IN PROGRESS:
  - #1 (Alice): Fix cache flush - PR under review
    ETA: June 23 ✓ on track
  
  - #3 (Carol): Improve cache testing - started design
    ETA: June 27 ⚠ waiting on #1
    Action: Unblock by approving Alice's PR

BLOCKED:
  - #2 (Bob): Memory leak detection - needs design review
    Blocker: Design doc needs architecture review
    Action: Schedule design review for June 24

Next sync: June 30 (2 weeks post-incident)
```

### Follow-up Review (2 weeks)

**Two weeks after incident:**

```
Follow-up check-in meeting (30 min)

Agenda:
1. Status of all action items
2. Were the actions effective?
3. Any new learnings?
4. Do we need additional actions?

For each action item:
- Completed: Is it fully deployed and working?
- In progress: Still on track?
- Not started: Is there a blocker?
- Blocked: What's needed to unblock?

Output:
- Update action item status
- Add any new action items discovered
- Schedule next review if needed
```

### Long-term Monitoring

**Check back 1 month later:**

```
One month post-incident review:

Question: Did the action items prevent this from happening again?

If YES:
- Document success
- Share lessons learned
- Add to knowledge base

If NO:
- Was the fix incomplete?
- Did a new issue emerge?
- Do we need deeper changes?
- Create new action items
```

---

## Continuous Improvement

### Learnings Database

**Add to team knowledge base:**

```markdown
# Incident Learning - INC-[YYYYMMDD]-[XXXX]

## What Happened
[Concise description of incident]

## Root Cause
[What we learned was the actual root cause]

## Prevention
[How we prevent this going forward]

## How to Respond
[If this happens again, here's what to do]

## References
- Incident ID: INC-[YYYYMMDD]-[XXXX]
- Runbook: [Link]
- Related PRs: [Links to fixes]
- Metrics dashboard: [Link]

## Tags
[memory, cache, performance, deployment, etc.]
```

### Trend Analysis

**Monthly review of incidents:**

```
Quarterly Incident Summary - Q2 2026

Total Incidents: 12
P1 (Critical): 1
P2 (High): 3
P3 (Medium): 8

Common Root Causes:
1. Cache-related issues: 4 incidents
2. Resource exhaustion: 3 incidents
3. Deployment bugs: 2 incidents
4. External dependencies: 2 incidents
5. Other: 1 incident

Trending Issues:
- Cache issues increasing (4 → ? next quarter)
  Action: Increased cache testing focus
  
- Memory incidents: Up from 1 to 2
  Action: Implement automatic memory leak detection

Most Effective Responses:
- Quick restart procedure (worked in 3/5 cases)
- Comprehensive logging (helped root cause analysis)

Response Time:
- P1: Average 8 minutes (target: < 5 min) ⚠
- P2: Average 12 minutes (target: < 15 min) ✓
- P3: Average 45 minutes (target: < 1 hour) ✓

Action Items for Q3:
1. Improve P1 response time (reduce from 8 to <5 min)
   - Add more automation?
   - Improve runbook clarity?
   - Additional training?
   
2. Address cache issues systematically
   - Code audit of all cache implementations
   - Comprehensive cache testing strategy
   - Monitoring/alerting for cache health
```

### Runbook Updates

**After each incident, update relevant runbooks:**

```
Runbook: INCIDENT-RESPONSE-PROCEDURES.md

Before:
"When error rate exceeds 10%, consider restart"

After:
"When error rate exceeds 10%, first check if it's a cache-related issue:
1. Check if specific commands are failing
2. If cache-related, clear cache before restart
3. Commands: docker exec [container] rm -rf /app/cache/*
4. This resolves 80% of high error rate incidents faster"
```

### Training & Drills

**Implement lessons in on-call training:**

```
Quarterly On-Call Training

Topics:
1. High-Memory Incident Response (from INC-20260621-0001)
   - Symptoms and detection
   - Quick troubleshooting steps
   - Cache debugging techniques
   - How to preserve heap dumps

2. Error Rate Spike Handling (from INC-20260608-0003)
   - Classification of error types
   - When to restart vs rollback
   - Log analysis techniques

3. Communication During Incidents
   - Status update frequency
   - When to escalate
   - How to interact with customers

Hands-on:
- Simulated incident scenarios
- Decision tree practice
- Communication exercises

Evaluation:
- Time to respond (target < 5 min for P1)
- Correct decision-making (runbook compliance)
- Effectiveness of actions taken
```

---

## Documentation & Archival

### Incident Report Template

**Final report published within 1 week:**

```markdown
# Incident Post-Mortem Report

**Incident ID:** INC-[YYYYMMDD]-[XXXX]
**Report Date:** [Date]
**Incident Date:** [Date range]

---

## Executive Summary

[1-paragraph summary suitable for non-technical readers]

## Incident Details

**Service:** Basset Hound Browser  
**Severity:** P1 / P2 / P3  
**Start Time:** [ISO 8601 timestamp] UTC  
**End Time:** [ISO 8601 timestamp] UTC  
**Duration:** [XX minutes]  
**Customer Impact:** [Description]  

## Timeline

| Time (UTC) | Event |
|-----------|-------|
| 14:32 | Issue detected by alert |
| 14:35 | On-call engineer paged |
| 14:38 | SRE Lead joined investigation |
| 14:45 | Root cause identified |
| 14:55 | Fix deployed |
| 15:00 | Service confirmed healthy |

## Root Cause

[Detailed explanation of root cause, avoiding blame]

## Contributing Factors

[Other factors that made the incident worse or detection harder]

## Impact Analysis

- **Services Affected:** [List]
- **Users Affected:** [Number/percentage]
- **Duration of Impact:** [XX minutes]
- **Data Loss:** Yes / No
- **SLA Breach:** Yes / No
- **Financial Impact:** [If quantifiable]

## Response Summary

### What Went Well

1. [Positive aspect #1]
   - Evidence: [Data supporting this]
   - Impact: [Why this was good]

2. [Positive aspect #2]
   - Evidence: [Data supporting this]
   - Impact: [Why this was good]

### What Could Be Improved

1. [Area for improvement #1]
   - Current state: [How we did it]
   - Desired state: [How we should do it]
   - Effort: [Low/Medium/High]

2. [Area for improvement #2]
   - Current state: [How we did it]
   - Desired state: [How we should do it]
   - Effort: [Low/Medium/High]

## Corrective Actions

| Action | Type | Owner | Due | Status |
|--------|------|-------|-----|--------|
| Fix cache flush logic | Code | Alice | 2026-06-23 | In Progress |
| Add memory monitoring | Tools | Bob | 2026-06-28 | Not Started |
| Improve cache tests | Testing | Carol | 2026-06-27 | Not Started |

## Prevention Measures

[How we prevent this in the future]

## Lessons Learned

[Key insights and knowledge gained]

## Appendices

- A. Incident Artifacts: `/incidents/INC-[ID]/`
- B. Metrics Dashboard: [Link to screenshot or dashboard]
- C. Decision Tree Used: [Runbook reference]
- D. Team Discussion Notes: [Attached or linked]

---

**Report prepared by:** [Name]  
**Reviewed by:** [Names]  
**Published:** [Date]  
**Status:** Final / Preliminary

---

## Distribution

- Engineering team ✓
- Product team ✓
- Customer Success (if customer impact) ✓
- VP Engineering ✓
- Public documentation ⚠ [Only for P1 security incidents - sanitized]
```

### Archival

**Store incident artifacts:**

```bash
# 1. Create archive
tar czf /archive/incidents/INC-[YYYYMMDD]-[XXXX].tar.gz /incidents/INC-[YYYYMMDD]-[XXXX]/

# 2. Copy final report
cp /incidents/INC-[YYYYMMDD]-[XXXX]-POST-MORTEM.md /archive/incidents/

# 3. Create integrity check
sha256sum /archive/incidents/INC-[YYYYMMDD]-[XXXX]* > /archive/incidents/INC-[YYYYMMDD]-[XXXX].sha256

# 4. Index in incident log
echo "INC-[YYYYMMDD]-[XXXX] | P1 | Memory | 2026-06-21 | Alice, Bob" >> /archive/incident-index.csv

# 5. Make searchable
# Add to internal knowledge base
# Link from wiki/runbooks if relevant
```

**Retention policy:**

```
Keep all incidents for: 2 years (or per compliance)

Archive location: `/archive/incidents/`
Backup location: [Secure backup system]
Access control: Engineering team only (or wider if required for audits)

For public disclosure (security incidents):
- Sanitize sensitive data
- Remove internal names/systems details
- Focus on technical lessons learned
- Publish on blog/documentation after approval
```

---

## Checklist: Post-Incident Closure

Use this checklist to ensure nothing is missed:

```
POST-INCIDENT CLOSURE CHECKLIST

Within 1 hour of resolution:
□ Verify complete resolution (all systems healthy)
□ Secure incident artifacts (/incidents/INC-ID/)
□ Update status page (if customer-facing)
□ Prepare initial report
□ Notify stakeholders (email)
□ Post to Slack #incidents

Within 24 hours:
□ Schedule post-incident review meeting
□ Conduct preliminary root cause analysis
□ Create RCA summary document
□ Identify any immediate critical fixes needed
□ Deploy critical fixes (if any)

Within 48 hours:
□ Conduct post-incident review meeting
□ Finalize root cause
□ Create action items
□ Assign owners and due dates
□ Send action item list to team

Within 1 week:
□ Publish final incident report
□ Start work on high-priority action items
□ Update runbooks with learnings
□ Add to knowledge base
□ Create follow-up review meeting

Within 2 weeks:
□ Complete critical action items
□ Conduct 2-week follow-up check-in
□ Verify fixes are effective
□ Identify any follow-up actions

Within 1 month:
□ Complete all action items (or reschedule)
□ Conduct 1-month review
□ Verify prevention measures working
□ Update training materials
□ Archive final incident record
□ Mark incident as CLOSED
```

---

## Quick Reference: Post-Incident Timeline

```
MINUTES    PHASE              ACTIONS
──────────────────────────────────────────────────────────
0-5        RESOLUTION         Verify service is healthy
                              Secure artifacts
                              Notify stakeholders

5-60       IMMEDIATE          Update status page
(0-1h)                        Prepare initial report
                              Create incident ticket

60-1440    SHORT-TERM         Schedule review meeting
(1-24h)                       Preliminary RCA
                              Deploy critical fixes

1440-2880  RCA & ACTION       Post-incident review
(24-48h)                      Finalize root cause
                              Create action items

2880-7200  IMPLEMENTATION     Work on action items
(48h-5d)                      Publish final report
                              Update runbooks

7200+      FOLLOW-UP &        2-week check-in
(5d+)      CLOSURE            1-month verification
                              Archive incident record
```

---

**End of Post-Incident Procedures**

Last Updated: June 21, 2026  
Next Review: September 21, 2026  
Maintained By: SRE Team
