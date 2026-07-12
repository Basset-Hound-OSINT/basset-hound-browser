# Basset Hound Browser v12.0.0 - Incident Response Procedures

**Version:** 1.0  
**Date:** May 11, 2026  
**Status:** Production Ready

## Overview

This document defines incident response procedures for Basset Hound Browser v12.0.0 production deployment. It covers severity classification, response procedures, escalation, communication, and post-incident review.

---

## 1. INCIDENT SEVERITY CLASSIFICATION

### Severity Levels

| Level | Name | Response Time | Business Impact | Example |
|-------|------|----------------|-----------------|---------|
| P0 | CRITICAL | 0-5 min | Service down / Total failure | WebSocket server not responding |
| P1 | SEVERE | 5-15 min | Major degradation / >5% failures | Error rate spike to 10% |
| P2 | MAJOR | 15-60 min | Noticeable impact / performance drop | Latency increased 2x, still responsive |
| P3 | MINOR | 1-8 hours | Limited impact / specific feature affected | Cache not working, falls back to normal mode |
| P4 | TRIVIAL | Non-urgent | Very limited impact / edge case | Rare error in logs, system recovers |

### Severity Determination Flowchart

```
Is service completely down?
  YES → P0 (CRITICAL)
  NO ↓

Can clients connect and run commands?
  NO → P0 (CRITICAL)
  YES ↓

Are errors >5%?
  YES → P1 (SEVERE)
  NO ↓

Is latency >3x baseline?
  YES → P1 (SEVERE)
  NO ↓

Is memory >95% or disk full?
  YES → P1 (SEVERE)
  NO ↓

Is >30% of features affected?
  YES → P2 (MAJOR)
  NO ↓

Is performance noticeably degraded?
  YES → P2 (MAJOR)
  NO ↓

Is one feature broken?
  YES → P3 (MINOR)
  NO ↓

P4 (TRIVIAL)
```

---

## 2. INITIAL RESPONSE CHECKLIST

### For All Incidents (P0-P4)

```
□ Acknowledge alert / incident notification
  Time acknowledged: [HH:MM]
  Responder: [Name]
  
□ Verify the issue is real (not false alarm)
  - Check dashboard for anomalies
  - Test basic functionality manually
  - Check if alert threshold may be misconfigured
  
□ Determine incident severity
  - Use classification flowchart above
  - Documented severity: P[0-4]
  - Is escalation needed?
  
□ Start incident in tracking system
  - Incident ID: [Auto-generated]
  - Title: [Clear, actionable]
  - Severity: P[0-4]
  - Start time: [Auto]
  
□ Notify stakeholders (per severity)
  - P0: Page team immediately + post in #incidents
  - P1: Post in #incidents + notify on-call
  - P2: Email team lead + #monitoring update
  - P3+: Log only, review later
  
□ Preserve evidence
  - Screenshot of dashboard state
  - Export current logs
  - Save metrics graph timeframe
  - Document any client reports
```

---

## 3. INCIDENT RESPONSE PROCEDURES BY SEVERITY

### P0: CRITICAL - Immediate Response (0-5 minutes)

**Goal:** Restore service or mitigate impact immediately

#### Initial Actions (First 2 minutes)

```
1. ASSESS THE SITUATION (30 seconds)
   □ Is service completely down?
   □ Can clients connect at all?
   □ Are new connections being rejected?
   □ Is the process running? → ps aux | grep basset
   □ Are ports open? → netstat -tulpn | grep 8765
   
2. ATTEMPT QUICK FIXES (1-2 minutes)
   Tried in order (usually successful within 1 min):
   
   □ Check basic connectivity
     curl -I http://localhost:8765/health
   
   □ Restart service (if unresponsive)
     systemctl restart basset-hound
     - Wait 30s for startup
     - Verify health: curl http://localhost:8765/health
   
   □ If restarted and working → INCIDENT MITIGATED (go to step 4)
   □ If still down → Continue to step 3
   
3. ESCALATE IMMEDIATELY
   □ If restart didn't work:
     - Page backup on-call (if not already responding)
     - Check system logs: journalctl -u basset-hound -n 50
     - Check if disk full: df -h /
     - Check memory: free -h
     - Check file descriptors: lsof | wc -l
     
4. DOCUMENT & COMMUNICATE
   - Update incident with status
   - Post in #incidents: "🚨 CRITICAL: [Issue]. Action: [Restart in progress]"
   - Continue investigation in parallel
```

#### If Quick Restart Works

```
Incident Status: MITIGATED
Next step: Monitor for 15 minutes for recurrence

□ Monitor closely
  - Watch error rate (target <0.1%)
  - Watch memory (target <400MB)
  - Check for repeating error patterns
  
□ Investigate root cause (while monitoring)
  - Review logs before crash
  - Check for OOM conditions
  - Check for resource exhaustion
  
□ Post-incident review
  - Schedule within 24 hours
  - Determine why it crashed
  - Implement fix or mitigation
  
□ Update status: RESOLVED (or escalate if issues continue)
```

#### If Restart Doesn't Work

```
Critical troubleshooting:

□ Check if process is actually running
  ps aux | grep node
  → If gone, check logs: journalctl -u basset-hound -n 100
  
□ Try to start manually (outside systemd)
  cd /app && node ./src/main/main.js
  → Look for error message
  
□ Check system resources
  df -h /                          (disk space)
  free -h                          (memory)
  ulimit -a                        (file descriptors)
  lsof -p [pid] | wc -l           (open files)
  
□ If resource exhausted:
  - Clear temporary files if disk full
  - Kill old processes if memory low
  - Close old connections if FD exhausted
  - Then attempt restart
  
□ If error logs show issue:
  - Take note of error
  - Check if code fix available
  - Roll back to previous version if needed
  
□ Escalate to senior engineer
  - This is above initial responder ability
  - Provide logs and error details
  - Continue monitoring while investigating
```

#### Documentation for P0

```
Post-Incident Summary (within 2 hours):
- Incident ID: [Auto-generated]
- Start time: [When alert fired]
- Detection time: [How long before detected]
- Resolution time: [When service restored]
- Duration: [Total downtime]
- Root cause: [Short summary]
- Impact: [Clients affected, operations lost]
- Next steps: [Fix, prevention, monitoring]

Example:
┌─────────────────────────────────────────────┐
│ INCIDENT: WebSocket Server Crash            │
│ ID: INC-2026-05-11-001                      │
│ Duration: 8 minutes                         │
│ Root Cause: OOM (memory exhaustion)         │
│ Fix: Increase heap size to 512MB            │
│ Follow-up: Monitor memory growth, schedule  │
│            Session recording optimization   │
└─────────────────────────────────────────────┘
```

---

### P1: SEVERE - Urgent Response (5-15 minutes)

**Goal:** Identify cause and implement mitigation within 15 minutes

#### Response Procedure

```
1. TRIAGE & DIAGNOSIS (5 minutes)
   
   □ If Error Rate High (>5%):
     - Check recent logs for error patterns
     - Which operation is failing?
     - Is it all clients or specific ones?
     - Recommended: Check dashboard, drill to operation breakdown
     
   □ If Latency Spiked:
     - Check active connections and load
     - Check memory/CPU usage
     - Check GC pause frequency
     - Recommended: Enable profiling if possible
     
   □ If Memory High:
     - Check memory trend (leak vs usage spike)
     - Check screenshot cache size
     - Check active sessions
     - Recommended: Force GC if safe, clear cache
     
   □ If Component Unresponsive:
     - Which component (proxy, cache, recording)?
     - Can it recover automatically?
     - Need to restart just that component?
     - Recommended: Isolate and restart if possible

2. MITIGATION OPTIONS (5-10 minutes)
   
   Choose based on root cause (in order of preference):
   
   a) CONFIGURATION CHANGE (fastest)
      Examples:
      - Lower timeout threshold temporarily
      - Disable screenshot cache if causing issues
      - Reduce concurrent client limit
      - Disable recording if disk saturated
      
   b) COMPONENT RESTART (quick)
      - Restart just the affected component
      - Monitor for recovery
      - Examples: Screenshot service, Cache service
      
   c) FULL SERVICE RESTART (if needed)
      - Last resort for P1 (prefer component restart)
      - Follow restart procedure above
      
   d) SCALE UP (if load-related)
      - Spin up additional instance
      - Load balance to new instance
      - Monitor load distribution

3. VERIFICATION (5 minutes)
   
   □ Is issue improving?
     - Error rate decreasing?
     - Latency normalizing?
     - Memory usage stable?
     
   □ If yes: Monitor for 15 minutes, then transition to investigation
   □ If no: Escalate immediately, may need expert help

4. COMMUNICATION
   Post in #incidents every 5 minutes:
   
   First update (within 5 min):
   "P1: [Issue]. Investigating. Update in 5 min."
   
   Second update (within 10 min):
   "P1: [Issue]. Root cause: [hypothesis]. 
    Action: [mitigation attempted]. Status: [improving/stable]"
```

#### Quick Diagnosis Guide

```
SYMPTOM → LIKELY CAUSE → QUICK FIX
──────────────────────────────────────────────────────

High Error Rate
└─ Recent deployment? → Rollback (within 2 min)
└─ Query pattern wrong? → Check client version
└─ Service overloaded? → Check connection count, consider restart
└─ Bad backend state? → Restart service

High Latency
└─ Many concurrent clients (>15)? → Consider scaling
└─ Memory pressure? → Check heap, force GC
└─ Screenshot heavy? → Check for recorder running (memory hog)
└─ CPU maxed? → Check if spike ongoing, scale up

Memory Growing Fast
└─ Long-running session? → Check recording size
└─ Cache not evicting? → Manually clear cache
└─ Memory leak? → Identify pattern, consider restart
└─ Resource exhaustion pattern? → Monitor for crash, prepare to restart

Component Unresponsive
└─ Just that component? → Restart isolated component
└─ Cascading failure? → Restart main service
└─ External dependency down? → Check proxy/network connectivity
```

#### P1 Post-Incident

```
Within 24 hours:
□ Root cause analysis (what really caused it?)
□ Timeline reconstruction (when did it start/end?)
□ Permanent fix (code/config change needed?)
□ Prevention (how to prevent recurrence?)
□ Monitoring improvement (better alerting?)

Document findings in incident tracking system.
Schedule team review if lessons learned.
```

---

### P2: MAJOR - Standard Response (15-60 minutes)

**Goal:** Mitigate user impact and schedule fix

#### Response Procedure

```
1. CLASSIFY (immediately)
   □ Is the system still operational? YES
   □ Can users still complete tasks? YES (slower/harder)
   □ How many users affected? [estimate]
   □ Can workaround be suggested? [possibly]

2. DECIDE: FIX NOW vs. SCHEDULE FIX
   
   FIX NOW if:
   - Simple configuration change
   - Component isolated and restartable
   - Fix has low risk of making worse
   - User impact is growing
   
   SCHEDULE FIX if:
   - Requires code change
   - Affects core functionality (risky)
   - Fix can wait until maintenance window
   - User impact is static
   
3. IF FIXING NOW (30 minutes max):
   □ Attempt fix (configuration, component restart, etc)
   □ Verify fix effective
   □ Monitor for issues
   □ If successful: RESOLVED
   □ If unsuccessful: Revert and schedule fix, document

4. IF SCHEDULING FIX:
   □ Acknowledge impact with stakeholders
   □ Provide workaround if available
   □ Schedule fix for next maintenance window
   □ Set reminder to follow up

5. CUSTOMER COMMUNICATION
   Example message:
   "We're aware that [feature] is [slower/not working]. 
    We're investigating and expect it fixed by [time]. 
    As a workaround, you can [alternative]."
```

---

### P3/P4: MINOR/TRIVIAL - Deferred Response

**Goal:** Log issue and schedule investigation

#### Response Procedure

```
□ Create incident ticket
  - Assign to backlog
  - No immediate response needed
  - Review in next team meeting

□ IF affects multiple users:
  - Update to P2 and follow P2 procedure
  
□ IF is potential security issue:
  - Escalate immediately to security team

□ Standard scheduling:
  - Will be reviewed within 1 week
  - Fixed within 2 weeks (or deprioritized)
```

---

## 4. ESCALATION DECISION TREE

```
Initial responder unable to resolve?
│
├─ Need senior engineer expertise?
│  │
│  ├─ YES → Escalate immediately
│  │        - Page senior engineer
│  │        - Provide detailed context
│  │        - Stay involved for coordination
│  │
│  └─ NO → Continue investigation
│
├─ Tried 3+ mitigations without success?
│  │
│  ├─ YES → Escalate
│  │        - May need code change
│  │        - May need architectural insight
│  │
│  └─ NO → Continue with next option
│
├─ Severity likely to escalate (P2→P1)?
│  │
│  ├─ YES → Escalate proactively
│  │        - Issue trending worse
│  │        - More clients/errors over time
│  │
│  └─ NO → Monitor closely
│
└─ Exceeds response time SLA?
   │
   ├─ YES → Escalate (should already be escalated)
   │        - P0: >5 min without progress
   │        - P1: >15 min without progress
   │
   └─ NO → Continue responding
```

---

## 5. COMMUNICATION TEMPLATES

### Initial Incident Notification

```
Platform: Slack #incidents

🚨 [SEVERITY] INCIDENT: [Title]

Service:  Basset Hound Browser v12.0.0
Issue:    [Clear description of problem]
Severity: P[0-4]
Time:     [Start time]
Status:   [INVESTIGATING / MITIGATED / RESOLVED]
Responder:[Name]

Metrics:
  • [Key metric 1]: [Value]
  • [Key metric 2]: [Value]

Next update: [In X minutes]
Incident link: [Link to tracking system]
```

### Progress Update (every 5-10 minutes for P0/P1)

```
UPDATE: [Service] [Severity]
Time: [Current time]
Duration: [Since start]

Status: [INVESTIGATING / MITIGATING / IMPROVING / STABLE]

What we know:
  • [Finding 1]
  • [Finding 2]

What we're doing:
  • [Action 1]
  • [Action 2]

Current impact:
  • [Error rate: X%]
  • [Affected clients: Y]

Next action: [What's next]
Next update: [In X minutes]
```

### Incident Resolution Notification

```
✅ RESOLVED: [Service] [Severity]

Duration:  [Total downtime/impact]
Root cause: [Brief explanation]

What we did:
  • [Action 1]
  • [Action 2]

Impact:    [Total errors lost / clients affected]

Follow-up:
  • [Investigation item 1]
  • [Prevention item 2]

Post-incident review: [Scheduled for YYYY-MM-DD]
```

### Post-Incident Status Update (next day)

```
📋 POST-INCIDENT UPDATE: [Service] 

Incident ID: [ID]
Duration:    [Total time]
Root Cause:  [Full explanation]

Timeline:
  14:32:15 - Issue detected (alert fired)
  14:32:45 - Initial responder acknowledged
  14:35:20 - Restart initiated
  14:36:00 - Service back online
  14:50:00 - Issue confirmed resolved

Root Cause Analysis:
  [Detailed explanation of why it happened]

Impact:
  • 8 minutes downtime
  • 5 connected clients disconnected
  • 127 commands lost
  • ~$XXX impact

Prevention:
  • [Code fix 1]
  • [Monitoring improvement 1]
  • [Process change 1]

Next Steps:
  • [Item 1] - Due [date]
  • [Item 2] - Due [date]
  
Team Review: Scheduled [date] [time]
```

---

## 6. INVESTIGATION PROCEDURES

### Memory Leak Suspected

```
Diagnosis:
□ Check memory trend graph (last 6 hours)
  - Is it continuously growing?
  - Does it level off or crash?
  
□ Correlate with activity:
  - Memory growth with client count?
  - Memory growth with specific operations?
  - Memory growth independent of load?

Investigation:
□ Take heap snapshot
  node --inspect
  → Open Chrome DevTools
  → Memory tab → Heap snapshot
  
□ Compare two snapshots (5+ min apart)
  - What objects increased?
  - Are they [expected?] or [leaky?]
  
□ Check for known issues
  - Screenshot cache (limit: 500MB)
  - Recording buffer (limit: 30MB/hr)
  - Session storage (limit: 50MB)
  
Resolution:
  If cache issue → Clear cache, monitor
  If recording issue → Stop recording, restart
  If code leak → Identify object, propose fix
```

### High Latency Suspected

```
Diagnosis:
□ Is latency uniform or specific operations?
  - All operations slow? → System-wide bottleneck
  - Some operations slow? → Specific bottleneck
  
□ Correlate with activity:
  - High latency when load is high?
  - High latency even with low load?
  - Intermittent or sustained?

Investigation:
□ Check CPU usage
  - Is CPU maxed? → Compute bottleneck
  - Is CPU idle? → IO bottleneck
  
□ Check disk I/O
  - Read-heavy? → Check I/O system
  - Write-heavy? → Check disk space, I/O load
  
□ Check network (if external operations)
  - Network latency? → Outside system's control
  - Network errors? → Check connectivity
  
□ Check profiler results
  - What function is slow?
  - Is it expected (screenshot encoding) or unexpected?

Resolution:
  See "BOTTLENECK ANALYSIS" section of this document
```

### High Error Rate Suspected

```
Diagnosis:
□ What type of errors?
  □ TIMEOUT → Navigation/network issues
  □ INVALID_RESPONSE → Service logic issue
  □ RESOURCE_EXHAUSTED → Out of memory or connections
  □ PERMISSION_DENIED → Auth/profile issue
  □ NOT_FOUND → Client using wrong API
  
□ Which operations failing?
  □ All operations? → System issue
  □ Some operations? → Feature-specific issue
  □ Specific clients? → Client misconfiguration

Investigation:
□ Check error logs
  tail -f /var/log/basset-hound/error.log
  → Look for patterns
  
□ Check client version
  - Are errors from old clients?
  - Is there a new client version issue?
  
□ Check recent changes
  - Recent deployment that introduced issue?
  - Recent client API change?
  
□ Check load
  - Is error rate load-dependent?
  - Does it happen at any load level?

Resolution:
  If client issue → Document API change, notify users
  If server issue → Rollback deployment or apply fix
  If load issue → Scale up or optimize
```

---

## 7. ESCALATION CONTACTS

### Primary On-Call (P0/P1)

```
Name:       [On-call engineer name]
Phone:      [Phone number]
Slack:      @[username]
Email:      [email]
Availability: [Days/hours]

Backup On-Call:
Name:       [Backup engineer name]
Phone:      [Phone number]
Escalate to backup if primary not responding within 5 min
```

### Service Owner (All Severities)

```
Name:       [Service owner name]
Slack:      @[username]
Email:      [email]
Purpose:    Overall service health, design decisions
```

### Leadership (P0 Only)

```
Manager:    [Manager name]
Director:   [Director name]
Escalate if incident expected to last >1 hour
```

### Security Team (If Security Concern)

```
Email:      security@basset-hound.internal
Escalate: Any potential unauthorized access, data exposure
Response time: <1 hour
```

---

## 8. INCIDENT CHECKLIST SUMMARY

### During Incident

```
□ Acknowledge alert
□ Assess severity (P0-P4)
□ Create incident tracking entry
□ Start immediate response (per severity)
□ Update status every 5-10 min (P0/P1)
□ Escalate if needed
□ Monitor metrics continuously
□ Document actions taken
□ Preserve evidence (logs, metrics)
```

### Post-Incident (within 24 hours)

```
□ Complete incident summary
□ Perform root cause analysis
□ Document timeline
□ List action items
□ Schedule team review
□ Assign follow-up tasks
□ Update monitoring/alerting if needed
□ Notify stakeholders of resolution
□ Communicate lessons learned
```

### Long-term (within 1 week)

```
□ Complete all action items
□ Implement permanent fix
□ Deploy fix to production
□ Monitor fix effectiveness
□ Update runbooks/documentation
□ Share findings with team
□ Update incident template if needed
□ Schedule similar incident prevention training if applicable
```

---

## 9. INCIDENT METRICS & REPORTING

### Key Metrics to Track

```
For each incident:
  • Detection time: How long before anyone noticed?
  • Time to acknowledge: How long to respond?
  • Time to first action: When did investigation start?
  • Time to mitigation: When did it stop impacting users?
  • Time to resolution: When was root cause fixed?
  • Mean time to recovery (MTTR): Total downtime
  • Root cause type: Software / Configuration / Infrastructure
  • Severity: P0-P4
  • Preventability: Yes/No (could we have prevented it?)
```

### Monthly Reporting

```
Generate report including:
  • Total incidents by severity
  • Average MTTR by severity
  • Most common root causes
  • Incidents with missed SLA
  • Incident trends (improving/degrading)
  • Preventable incidents
  • Action items from post-mortems (completion rate)
  • Recommendations for next month
```

---

## 10. COMMON RUNBOOKS

### Service Won't Start

```
1. Check logs:
   journalctl -u basset-hound -n 50

2. Common errors:
   "Address in use" → Something using port 8765
   "Out of memory" → Not enough heap
   "Module not found" → Missing dependency
   "Connection refused" → Database/dependency down

3. For each error, see detailed runbook below
```

### Port Already In Use

```
1. Find process using port:
   lsof -i :8765

2. Kill if not important:
   kill -9 [pid]

3. Or change port in config and restart

4. If killing process breaks something, investigate why
```

### Out of Memory (OOM)

```
1. Check memory:
   free -h
   ps aux | grep node | grep -v grep

2. Options:
   a) Increase heap size in systemd:
      EDIT: /etc/systemd/system/basset-hound.service
      NODE_OPTIONS="--max-old-space-size=1024"
      RESTART: systemctl daemon-reload && systemctl restart basset-hound
   
   b) Identify memory leak:
      - Check memory trend
      - Take heap snapshots
      - Identify growing object type
      - File bug with details
   
   c) Temporary workaround:
      - Disable screenshot cache
      - Stop long-running sessions
      - Restart before cache fills up
```

### Database Connection Failed

```
1. Check if database is running:
   ping [database-host]
   
2. Check connection string:
   grep DATABASE_URL /etc/basset-hound/config
   
3. Check database connectivity:
   mysql -h [host] -u [user] -p [password]
   
4. Check network/firewall:
   telnet [host] [port]
   
5. Check credentials:
   Verify user/password are correct
   
6. If all failed:
   Use cached/offline mode if available
   Or restart dependent services
```

---

## Appendix: Incident Response Drill

**Recommend:** Run monthly drill to keep team sharp

```
Monthly Drill Procedure (30 minutes):

1. Select random severity level (P0-P2)
2. Simulate incident (inject errors, kill process, etc)
3. Start timer
4. Team responds per procedures above
5. Measure:
   - Time to detect
   - Time to acknowledge
   - Time to diagnose
   - Time to mitigate
   - Time to resolve
6. Debrief: What went well? What to improve?
7. Document lessons learned
```

---

**Document Version:** 1.0  
**Last Updated:** May 11, 2026  
**Status:** Ready for Implementation
