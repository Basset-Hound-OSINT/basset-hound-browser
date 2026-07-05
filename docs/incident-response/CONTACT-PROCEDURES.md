# Incident Response Contact Procedures

**Document Version:** 1.0  
**Date:** June 21, 2026  
**Purpose:** Contact information, escalation paths, and communication templates  
**Audience:** All team members, especially on-call engineers

---

## Table of Contents

1. [On-Call Schedule](#on-call-schedule)
2. [Contact Directory](#contact-directory)
3. [Escalation Paths](#escalation-paths)
4. [Notification Procedures](#notification-procedures)
5. [Communication Channels](#communication-channels)
6. [Status Page Updates](#status-page-updates)
7. [Customer Communication](#customer-communication)

---

## On-Call Schedule

### Primary On-Call Engineer Rotation

**Current Week:** [Week of June 21, 2026]

```
DATE RANGE          NAME                EMAIL                   PHONE
──────────────────────────────────────────────────────────────────────
Jun 21-23 Sat-Sun   [Name]              [email@company.com]     [+1-XXX-XXX-XXXX]
Jun 24-26 Mon-Wed   [Name]              [email@company.com]     [+1-XXX-XXX-XXXX]
Jun 27-29 Thu-Sat   [Name]              [email@company.com]     [+1-XXX-XXX-XXXX]
Jun 30-   Sun-      [Name]              [email@company.com]     [+1-XXX-XXX-XXXX]
```

**To view full schedule:** See PagerDuty > Schedules > On-Call

**Key Rules:**
- Primary on-call is responsible for all incidents during their shift
- On-call can call in backup if needed (authorized in runbook)
- Shift starts: 12:00 AM UTC / 8:00 PM previous day EDT
- Shift ends: 11:59 PM UTC / 7:59 PM same day EDT

**Backup On-Call:**

```
Always available for escalation from primary:
- SRE Lead: [Name] - [Phone] - [Email]
- Backup Engineer: [Name] - [Phone] - [Email]
```

### SRE Lead Escalation Schedule

**Always on-call for P1/P2 incidents:**

```
NAME                EMAIL                   PHONE               TIMEZONE
──────────────────────────────────────────────────────────────────────────
[SRE Lead Name]     [email@company.com]     [+1-XXX-XXX-XXXX]  UTC / EDT
```

### Tech Lead On-Call

**For P1 technical escalations:**

```
NAME                EMAIL                   PHONE               RESPONSE TIME
──────────────────────────────────────────────────────────────────────────────
[Tech Lead Name]    [email@company.com]     [+1-XXX-XXX-XXXX]  ≤ 10 minutes
```

### Engineering Manager On-Call

**For P1 management escalations:**

```
NAME                EMAIL                   PHONE               RESPONSE TIME
──────────────────────────────────────────────────────────────────────────────
[Manager Name]      [email@company.com]     [+1-XXX-XXX-XXXX]  ≤ 15 minutes
```

---

## Contact Directory

### Tier 1 - Immediate Response (On-Call)

```
┌────────────────────────────────────────────────────────────────┐
│ PRIMARY ON-CALL ENGINEER (First Responder)                     │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Name:        [Current on-call engineer name]                   │
│ Phone:       [Phone number with country code: +1-XXX-XXX-XXXX] │
│ Email:       [email@company.com]                               │
│ Slack:       @[slack-handle]                                   │
│ PagerDuty:   [Schedule name] - Primary On-Call                 │
│                                                                 │
│ RESPONSE SLA: ≤ 5 minutes (all incidents)                      │
│                                                                 │
│ Call flow:                                                      │
│   1. PagerDuty phone notification (immediately)               │
│   2. Slack @mention in #incidents (immediately)               │
│   3. SMS alert (if phone not answered in 2 min)               │
│   4. Escalation to backup (if no response in 5 min)           │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Tier 2 - Secondary Response (Escalations)

```
SRE LEAD (P1/P2 Escalation / Incident Commander)
├─ Name:        [SRE Lead Name]
├─ Phone:       [+1-XXX-XXX-XXXX]
├─ Email:       [email@company.com]
├─ Slack:       @[slack-handle]
├─ PagerDuty:   [Schedule] - SRE Lead
└─ Response:    ≤ 10 minutes (auto-paged for P1/P2)

BACKUP ENGINEER (Primary Relief)
├─ Name:        [Backup Name]
├─ Phone:       [+1-XXX-XXX-XXXX]
├─ Email:       [email@company.com]
├─ Slack:       @[slack-handle]
├─ PagerDuty:   [Schedule] - Backup On-Call
└─ Response:    ≤ 10 minutes (on-demand)
```

### Tier 3 - Technical & Management

```
TECH LEAD (P1 Technical Escalation)
├─ Name:        [Tech Lead Name]
├─ Phone:       [+1-XXX-XXX-XXXX]
├─ Email:       [email@company.com]
├─ Slack:       @[slack-handle]
├─ PagerDuty:   [Schedule] - Tech Lead Escalation
└─ Response:    ≤ 10 minutes (manual page for P1)

ENGINEERING MANAGER (P1 Management)
├─ Name:        [Manager Name]
├─ Phone:       [+1-XXX-XXX-XXXX]
├─ Email:       [email@company.com]
├─ Slack:       @[slack-handle]
├─ Office:      [Office location/building]
└─ Response:    ≤ 15 minutes (manual page for P1)

SECURITY TEAM LEAD (Security Incidents)
├─ Name:        [Security Lead Name]
├─ Phone:       [+1-XXX-XXX-XXXX]
├─ Email:       [email@company.com]
├─ Slack:       @[slack-handle]
├─ On-call:     Always available for security incidents
└─ Response:    ≤ 5 minutes (URGENT)

INFRASTRUCTURE LEAD (Infrastructure Escalation)
├─ Name:        [Infra Lead Name]
├─ Phone:       [+1-XXX-XXX-XXXX]
├─ Email:       [email@company.com]
├─ Slack:       @[slack-handle]
├─ Office:      [Office location]
└─ Response:    ≤ 15 minutes (on-demand)
```

### Tier 4 - Executive (P1 Escalation)

```
VP ENGINEERING (P1 Executive Escalation)
├─ Name:        [VP Name]
├─ Phone:       [+1-XXX-XXX-XXXX]
├─ Email:       [email@company.com]
├─ Slack:       @[slack-handle]
├─ Office:      [Office location]
└─ Response:    ≤ 30 minutes (auto-page at 30 min for P1)

CTO (Critical P1 / Security Incidents)
├─ Name:        [CTO Name]
├─ Phone:       [+1-XXX-XXX-XXXX]
├─ Email:       [email@company.com]
├─ Slack:       @[slack-handle]
├─ Office:      [Office location]
└─ Response:    ≤ 30 minutes (auto-page for critical P1)
```

---

## Escalation Paths

### P1 - Critical Incident Escalation

```
INCIDENT DETECTED (Automated Alert)
    │
    ├─ T+0 min: Alert triggered
    │
    ├─ T+1 min: Page PRIMARY ON-CALL (PagerDuty + SMS)
    │
    ├─ T+2 min: Page SRE LEAD (parallel)
    │           Auto-page in PagerDuty
    │           Notify #incidents #all-hands on Slack
    │
    ├─ T+5 min: If primary not responding → Call backup
    │
    ├─ T+10 min: Page TECH LEAD
    │            Incident Commander designated
    │            War room established
    │
    ├─ T+15 min: Page ENGINEERING MANAGER
    │            Brief on incident status
    │            Prepare for escalation if needed
    │
    ├─ T+30 min: If not resolved
    │            Auto-page VP ENGINEERING
    │            Update executive dashboard
    │
    ├─ T+1 hour: If still ongoing
    │            Page CTO
    │            Executive decision point
    │
    └─ Continue escalation as needed
       Every 30 min: VP notification update
       Every hour: CTO notification update
```

**Key Points:**
- Multiple people paged in parallel (not sequentially)
- Faster response times for earlier escalations
- Each page includes incident context
- Clear chain of command for decisions

### P2 - High Incident Escalation

```
INCIDENT DETECTED
    │
    ├─ T+0 min: Alert triggered
    │
    ├─ T+5 min: Page PRIMARY ON-CALL
    │
    ├─ T+10 min: Page SRE LEAD (if no progress)
    │
    ├─ T+30 min: If not resolved → Page TECH LEAD
    │
    ├─ T+60 min: If still ongoing → Manager notification
    │
    └─ Continue with 1-hour status updates
       Escalate to P1 if severity increases
```

### P3 - Medium Incident Escalation

```
INCIDENT CREATED
    │
    ├─ Create ticket and assign
    │
    ├─ Notify team on Slack (#incidents)
    │
    ├─ On-call engineer picks up during shift
    │
    └─ No auto-escalation unless severity increases
       Promote to P2 if needed based on impact
```

---

## Notification Procedures

### How to Page On-Call (PagerDuty)

**Via Web:**

1. Go to https://pagerduty.com
2. Click "Create Incident"
3. Fill in:
   - Title: [Incident type] - [Service]
   - Description: [Detailed description]
   - Service: Basset Hound Browser
   - Urgency: High / Low (based on severity)
4. Click "Create"
5. PagerDuty automatically pages on-call engineer

**Via SMS:**

From any phone:
```
Text to: [PagerDuty SMS Number]
Content: incident [service_id] [description]
Example: incident basset-hound HIGH MEMORY > 85%
```

**Via Slack:**

```
Type in Slack:
/pagerduty create -s [service] -t [title] -d [description]

Or mention incident commander:
@incident-commander P1 incident: [description]
```

### Slack Notification Format

**For P1 incidents:**

```
:fire: P1 CRITICAL INCIDENT - [Service/Component]
Severity: CRITICAL
Duration: [time elapsed]
Incident ID: INC-[YYYYMMDD]-[XXXX]

AFFECTED:
- Service: [service name]
- Impact: [user/system impact]
- Customers: [number/names if applicable]

CURRENT STATUS:
- Issue: [what is happening]
- Actions: [what is being done]
- ETA: [estimated resolution time]

COMMAND CENTER:
- Incident Commander: @[name]
- Primary On-Call: @[name]
- SRE Lead: @[name]

War Room: [Video conference link]
Status updates: Every 5-10 minutes in this thread
Next update: [time]

Channel: #incidents (pinned)
DO NOT: Make changes without approval from incident commander
```

**For P2 incidents:**

```
:alert: P2 HIGH PRIORITY INCIDENT - [Component]
Severity: HIGH
Duration: [time]
Incident ID: INC-[YYYYMMDD]-[XXXX]

Status: [Investigation in progress / Mitigation underway / Resolved]
ETA: [time estimate]

On-Call: @[name]
Status updates: Every 15 minutes

[Incident runbook link]
```

### Phone Notification Script

**For on-call engineer being called:**

```
"Hi [name], this is [caller] from the Incident Response team.

We have a P[1/2/3] incident in Basset Hound Browser:

ISSUE:
[Concise 1-2 sentence description]

IMPACT:
[What's affected and how]

TIME:
Detected: [when]
Duration: [how long]

ACTION:
Please acknowledge receipt and respond in:
- PagerDuty: ACK the incident
- Slack: Reply to @[username] in #incidents
- Phone: Say 'acknowledged' and I'll add you to the call

Questions?
[Brief pause for response]

Incident details:
- ID: INC-[YYYYMMDD]-[XXXX]
- Runbook: [link]
- Slack: #incidents

Your first steps:
1. [Action 1]
2. [Action 2]
3. [Action 3]

OK? Any questions?"
```

---

## Communication Channels

### Primary Channels

**PagerDuty (For On-Call Notification)**
- Purpose: Emergency escalation, automatic paging
- URL: https://[company].pagerduty.com
- Access: All engineers (read), on-call only (modify)
- Usage: Auto-page on-call, manual escalation

**Slack - #incidents**
- Purpose: Real-time incident discussion
- Audience: All engineers
- Usage: Incident creation, status updates, decisions
- Pinning: Pin P1 incidents for visibility
- Notifications: @here for P1, @incidents for P2+

**Slack - #incidents-critical**
- Purpose: P1 only incidents
- Audience: On-call, SRE, Tech Leads
- Usage: Critical incidents only
- Notifications: Always notify

**Slack - #all-hands** (For P1 with customer impact)
- Purpose: Company-wide critical incidents
- Audience: All company
- Usage: Major incidents affecting customers
- Posting: By incident commander only

**War Room (For P1 Incidents)**
- Type: Google Meet / Zoom video conference
- URL: [Standard war room link - set up in calendar]
- Participants: Incident commander, on-call, tech lead, relevant specialists
- Schedule: Created immediately for P1 incidents
- Audio: Primary communication during incident

### Secondary Channels

**Email (Status Updates)**
- Purpose: Post-incident summary, status page updates
- To: Affected customers, internal stakeholders
- Frequency: At resolution + 24-hour follow-up
- Owner: Communications lead (or incident commander)

**Status Page (External Communications)**
- Name: [status.company.com] or similar
- Updated: For customer-facing P1 incidents
- Owner: Communications team
- Frequency: Major event updates + 30 min updates during incident

**SMS (Only for Emergency Escalation)**
- Usage: When primary on-call not responding to PagerDuty
- Recipient: Backup on-call, SRE lead
- Message: Short, actionable, includes incident ID

### Archived Channels (Historical Reference)

**Incident Reports**
- Location: `/incidents/INC-[YYYYMMDD]-[XXXX]/` directory
- Contents: Logs, metrics, timeline, RCA
- Retention: 2 years (or per compliance policy)

---

## Status Page Updates

### When to Update Status Page

**P1 with customer impact:**
- Update within 5 minutes of incident detection
- Update every 30 minutes during incident
- Update when incident resolves
- Post-incident summary within 24 hours

**P2 without customer impact:**
- No status page update required
- If customer impact realized: Follow P1 procedure

**P3:**
- No status page update required

### Status Page Update Template

**Incident Start:**

```
INVESTIGATING: [Service] Performance Degradation

We are investigating reports of [issue description] affecting 
[service name] since [time] UTC. 

Affected users are experiencing [impact description].

Status: INVESTIGATING
Next update: [time + 30 min]
Incident ID: INC-[YYYYMMDD]-[XXXX]
```

**During Incident (30-min updates):**

```
UPDATE: [Service] [Issue Type] - Ongoing

Issue: [Brief description of current status]
Cause: [If known: root cause description; if not known: still investigating]
Mitigation: [Actions being taken / estimated resolution]
Impact: [Current affected scope]
Duration: [Total time since start]

ETA to Resolution: [Estimate]
Next update: [Time + 30 min]
```

**Incident Resolution:**

```
RESOLVED: [Service] [Issue Type]

Issue: [What happened]
Duration: [Total time]
Affected: [Scope of impact]
Root Cause: [Brief summary]
Resolution: [What we did to fix it]

All services are now operating normally.
We apologize for the disruption.

More details: [Link to incident post-mortem when available]
```

---

## Customer Communication

### When to Communicate to Customers

**Communicate immediately (within 30 min):**
- P1 incidents with customer-facing impact
- Outages longer than 5 minutes
- Data loss or corruption risks
- Security incidents

**Communicate at resolution:**
- Brief summary
- Apology
- ETA for detailed RCA

**Communicate 24 hours post-incident:**
- Root cause analysis
- Impact summary
- Preventive measures taken
- No-blame tone

### Customer Communication Templates

**Immediate Notification (Within 30 minutes):**

```
Subject: Service Incident - Basset Hound Browser

Dear [Customer Name / Valued Customers],

We are experiencing a service incident affecting Basset Hound Browser.

WHAT'S HAPPENING:
[Non-technical description of the issue]

IMPACT:
[What features/services are affected]
[Estimated % of functionality impaired]

OUR RESPONSE:
Our engineering team is actively investigating and working to restore service.
Estimated time to resolution: [time]

WHAT YOU CAN DO:
[Any workarounds or steps they can take]
[When to expect service restoration]

We will send updates every 30 minutes.

Apologies for the inconvenience.

Support: [phone/email/chat]
Status Page: [link]
Incident ID: INC-[YYYYMMDD]-[XXXX]
```

**Resolution Notification:**

```
Subject: Service Restored - Basset Hound Browser Incident

Dear [Customer Name / Valued Customers],

The Basset Hound Browser service incident has been resolved.

INCIDENT SUMMARY:
- Issue: [Incident type]
- Duration: [Total time affected]
- Resolution Time: [When service was restored]
- Root Cause: [Brief explanation - blame no one]

WHAT WE'RE DOING:
1. [Preventive action 1]
2. [Preventive action 2]
3. [Preventive action 3]

We sincerely apologize for the disruption and any impact to your 
operations. We have scheduled a detailed post-incident review and 
will implement improvements to prevent similar incidents.

Detailed Analysis: [Link to post-mortem when available]
Questions: Reply to this email or contact [support]

Thank you for your patience.

Best regards,
[Company] Support Team
```

**Post-Incident Summary (24 hours):**

```
Subject: Incident Post-Mortem - Basset Hound Browser [INC-ID]

Dear [Customer Name],

As requested, here is the detailed post-mortem of the incident that 
affected Basset Hound Browser on [date].

INCIDENT OVERVIEW
- Incident ID: INC-[YYYYMMDD]-[XXXX]
- Service: Basset Hound Browser
- Start: [Date/Time] UTC
- Duration: [XX minutes]
- End: [Date/Time] UTC

ROOT CAUSE
[Detailed but non-blaming explanation of what caused the incident]

IMPACT ANALYSIS
- Affected Services: [List services]
- Customers Affected: [Number or scope]
- Data Loss: [No / Yes - describe]
- Data Integrity: [Confirmed secure / Under investigation]
- Compliance: [Any SLA breaches]

INCIDENT TIMELINE
[Detailed timeline of events with times]

PREVENTIVE MEASURES
We have implemented the following to prevent similar incidents:
1. [Action 1]
2. [Action 2]
3. [Action 3]

[Offer compensation if applicable per SLA]

For questions regarding this incident, please contact [support].

Best regards,
[Company] Support Team
```

---

## On-Call Handoff Procedure

### Before Your Shift Starts

**24 hours before:**
- [ ] Receive PagerDuty confirmation email
- [ ] Check calendar for any scheduled work
- [ ] Review runbooks and decision trees
- [ ] Ensure phone and email accessible

**1 hour before shift:**
- [ ] Send message to previous on-call: "Ready to take over"
- [ ] Log into PagerDuty and acknowledge readiness
- [ ] Update Slack status: "🔴 On-call"
- [ ] Confirm phone ringer is on
- [ ] Have runbook links accessible

**At shift start (12:00 AM UTC):**
- [ ] Previous on-call confirms handoff complete
- [ ] Post in #on-call: "On-call shift started: INC-YYYYMMDD-[NAME]"
- [ ] PagerDuty escalation policy updated
- [ ] You are now primary for next 24 hours

### During Your Shift

**Every 12 hours:**
- [ ] Quick system health check (no automation required)
- [ ] Review any P3 incidents from previous shift
- [ ] Check if any metrics are trending toward alerts

**Before your shift ends:**
- [ ] Review incidents during your shift
- [ ] Handoff any ongoing issues to next on-call
- [ ] Document any important notes for continuity

### At Shift End

**At 11:55 PM UTC (5 min before shift end):**
- [ ] Send message to next on-call: "Handing off in 5 minutes"
- [ ] Include summary of any ongoing issues
- [ ] Provide any context they need to know

**At 12:00 AM UTC (shift end):**
- [ ] Next on-call acknowledges they're ready
- [ ] Post in #on-call: "Shift handoff complete"
- [ ] Update Slack status: remove on-call indicator
- [ ] You're officially off-call

**After your shift:**
- [ ] Update PagerDuty schedule if needed
- [ ] Archive any incident artifacts
- [ ] Provide feedback on tools/procedures if issues encountered

---

## Quick Reference Card

Print this and keep at your desk during on-call duty:

```
╔════════════════════════════════════════════════════════════╗
║            INCIDENT RESPONSE QUICK REFERENCE               ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  INCIDENT DETECTED → Create incident ticket in PagerDuty  ║
║                                                            ║
║  P1 CRITICAL                                              ║
║  ├─ On-call paged (PagerDuty)                            ║
║  ├─ SRE Lead paged (parallel)                            ║
║  ├─ War room created                                      ║
║  ├─ Status update every 5 min                            ║
║  ├─ Escalate at 30 min if not resolved                   ║
║  └─ Use decision trees (DECISION-TREES.md)               ║
║                                                            ║
║  P2 HIGH                                                   ║
║  ├─ On-call paged                                         ║
║  ├─ Manager notified                                      ║
║  ├─ Status update every 15 min                           ║
║  └─ Use incident runbook                                 ║
║                                                            ║
║  CHANNELS:                                                 ║
║  • PagerDuty: https://[company].pagerduty.com            ║
║  • Slack: #incidents (or #incidents-critical for P1)     ║
║  • War Room: [link to standard video conference]         ║
║  • Runbooks: /docs/incident-response/                    ║
║  • Decision Trees: DECISION-TREES.md                     ║
║                                                            ║
║  CRITICAL CONTACTS:                                       ║
║  Primary On-Call: See PagerDuty schedule                 ║
║  SRE Lead: [Name] [Phone]                                ║
║  Tech Lead: [Name] [Phone]                               ║
║  Engineering Manager: [Name] [Phone]                     ║
║                                                            ║
║  FIRST ACTIONS FOR ANY INCIDENT:                          ║
║  1. Don't panic - take a breath                          ║
║  2. Assess severity (P1/P2/P3/P4)                        ║
║  3. Page appropriate people (use matrix below)            ║
║  4. Gather diagnostics (don't modify yet)                ║
║  5. Consult decision tree for your incident type          ║
║  6. Execute mitigation actions                           ║
║  7. Keep communication flowing                            ║
║  8. Document timeline for RCA                            ║
║                                                            ║
╠════════════════════════════════════════════════════════════╣
║  SEVERITY    RESPONSE TIME    PRIMARY    SLA              ║
║  P1          ≤ 5 min          On-call    Immediate action ║
║  P2          ≤ 15 min         On-call    Within 15 min   ║
║  P3          ≤ 1 hour         On-call    Within 1 hour   ║
║  P4          ≤ 24 hours       Scheduled  Batch in work   ║
╚════════════════════════════════════════════════════════════╝
```

---

## Appendix: Testing Contact Procedures

### Monthly Drill

Once per month, conduct a "fire drill":

```
1. Pick a random incident scenario (from decision trees)
2. Page on-call as if it were real
3. Have them acknowledge and brief back
4. Walk through first 5 steps of response
5. Give feedback

Purpose: Ensure communication works, people know runbooks
```

### Before Going On-Call

**Checklist:**
- [ ] Reviewed all runbooks in /docs/incident-response/
- [ ] Practiced using decision trees (printed or have links)
- [ ] Know how to access PagerDuty and Slack
- [ ] Have phone numbers for escalations
- [ ] Know locations of diagnostic scripts
- [ ] Know how to create/update incidents
- [ ] Understand this contact procedures document

---

**End of Contact Procedures**

Last Updated: June 21, 2026  
Next Review: September 21, 2026  
Maintained By: SRE Team
