# Incident Response Procedures - Basset Hound Browser v12.7.0

**Document Version:** 1.0  
**Date:** June 21, 2026  
**Purpose:** Complete incident response framework for production incidents  
**Audience:** On-call engineers, SRE team, engineering managers

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Incident Classification](#incident-classification)
3. [Incident Response Framework](#incident-response-framework)
4. [High Memory Incident](#high-memory-incident)
5. [High Error Rate Incident](#high-error-rate-incident)
6. [Unavailability Incident](#unavailability-incident)
7. [Security Incident](#security-incident)
8. [Performance Degradation Incident](#performance-degradation-incident)
9. [Decision Trees](#decision-trees)
10. [Contact Procedures](#contact-procedures)
11. [Communication Templates](#communication-templates)
12. [Post-Incident Procedures](#post-incident-procedures)

---

## Executive Summary

This document provides structured incident response procedures for the Basset Hound Browser production environment. The framework emphasizes:

- **Rapid Detection:** Automated monitoring triggers
- **Clear Decision Making:** Decision trees for each scenario
- **Coordinated Response:** Defined roles and responsibilities
- **Fast Recovery:** Time-bounded procedures (5-30 min per scenario)
- **Learning:** Post-incident reviews and continuous improvement

### Severity Levels

| Level | Definition | Response Time | Escalation |
|-------|-----------|---------------|-----------|
| **P1 - Critical** | Service unavailable, data loss risk, customer impact | ≤ 5 minutes | Immediate VP escalation |
| **P2 - High** | Severe degradation, customer experience impact | ≤ 15 minutes | Manager notification |
| **P3 - Medium** | Feature broken, errors present, no customer impact yet | ≤ 1 hour | Team notification |
| **P4 - Low** | Minor issues, no customer impact, can schedule fix | ≤ 24 hours | Issue tracker |

---

## Incident Classification

### Memory-Related Incidents

| Incident Type | Trigger | Severity | Impact |
|---------------|---------|----------|--------|
| **High Memory (80-85%)** | Memory > 80% for 5+ min | P3 | Potential OOM |
| **Critical Memory (>85%)** | Memory > 85% for 2+ min | P1 | Imminent crash |
| **Memory Leak** | Memory growth > 10% per hour | P2 | Will OOM in 2-4h |

### Error-Related Incidents

| Incident Type | Trigger | Severity | Impact |
|---------------|---------|----------|--------|
| **Elevated Errors (2-5%)** | Error rate 2-5% for 10+ min | P3 | User-facing errors |
| **High Error Rate (5-10%)** | Error rate 5-10% for 5+ min | P2 | Service degradation |
| **Critical Error Rate (>10%)** | Error rate > 10% for 2+ min | P1 | Service unavailable |

### Availability Incidents

| Incident Type | Trigger | Severity | Impact |
|---------------|---------|----------|--------|
| **Partial Unavailability** | 25-75% instances down | P2 | Reduced capacity |
| **Major Unavailability** | 75%+ instances down | P1 | Service down |
| **Complete Unavailability** | 100% instances down | P1 | Total outage |

### Performance Incidents

| Incident Type | Trigger | Severity | Impact |
|---------------|---------|----------|--------|
| **Latency Degradation** | p95 latency > 150% baseline | P3 | Slow response |
| **Severe Latency** | p95 latency > 200% baseline | P2 | Unusable performance |
| **Timeout Spike** | Request timeouts > 5% of traffic | P2 | Request failures |

---

## Incident Response Framework

### Overview

```
DETECTION
    ↓
ALERT TRIGGERED
    ↓
INCIDENT CREATED (Unique ID: INC-YYYYMMDD-XXXX)
    ↓
PRIMARY ON-CALL NOTIFIED (via PagerDuty + Slack)
    ↓
TRIAGE (Severity assessment)
    ↓
ESCALATION (if needed)
    ↓
RESPONSE (Execute appropriate runbook)
    ↓
MITIGATION (Stop the bleeding)
    ↓
INVESTIGATION (Root cause analysis)
    ↓
RESOLUTION (Fix or workaround deployed)
    ↓
COMMUNICATION (Status updates, all-clear)
    ↓
CLOSE (Post-incident review scheduled)
```

### Roles & Responsibilities

**Primary On-Call Engineer**
- First responder
- Executes immediate mitigation
- Updates status every 15 minutes
- Escalates as needed

**SRE Lead** (escalated for P1/P2)
- Coordinates response
- Manages escalations
- Makes critical decisions
- Interfaces with management

**Technical Lead** (escalated for P1)
- Deep investigation
- Root cause analysis
- Guides technical decisions
- Engineering escalation

**Engineering Manager** (escalated for P1)
- Business impact assessment
- Customer communication approval
- Resource coordination
- Executive reporting

**Communication Lead** (for customer-facing P1)
- Manages external communications
- Updates status page
- Customer notifications
- Media/PR coordination

---

## High Memory Incident

### Incident Detection

**Automated Triggers:**

```
Alert: MemoryWarning
Condition: Memory > 80% for 5+ minutes
Severity: P3
Action: Notify on-call (Slack only)

Alert: MemoryCritical
Condition: Memory > 85% for 2+ minutes
Severity: P1
Action: PagerDuty page + Auto-escalation
```

**Manual Detection:**

Monitor dashboard shows memory usage climbing or abnormal. Check:

```bash
docker stats basset-hound-browser --no-stream
# Look for MEMORY % > 80%

docker exec basset-hound-browser ps aux | head -20
# Check process memory usage

docker exec basset-hound-browser free -h
# Check system memory
```

### Decision Tree

```
HIGH MEMORY DETECTED (Memory > 80%)
    │
    ├─ Memory > 85% for 2+ min?
    │   ├─ YES → CRITICAL (P1) → Go to IMMEDIATE ACTION
    │   └─ NO → Go to TRIAGE
    │
    TRIAGE:
    ├─ Is memory still climbing?
    │   ├─ YES (>10%/hour) → Memory leak suspected → Go to LEAK RESPONSE
    │   └─ NO (stable) → Likely temporary spike → Go to MONITORING
    │
    LEAK RESPONSE:
    ├─ Estimated time to OOM?
    │   ├─ <1 hour → Go to IMMEDIATE ACTION
    │   ├─ 1-4 hours → Go to INVESTIGATION
    │   └─ >4 hours → Go to DEEP INVESTIGATION
    │
    IMMEDIATE ACTION:
    ├─ Restart container to clear memory → Verify recovery → Go to POST-INCIDENT
    │
    INVESTIGATION:
    ├─ Collect heap dump
    ├─ Analyze for leak pattern
    ├─ Apply targeted fix or
    ├─ Schedule controlled restart
    │
    MONITORING:
    ├─ Watch for 30 minutes
    ├─ If memory decreases naturally → No action needed
    ├─ If memory stabilizes high → Investigate
    ├─ If memory climbs again → Go to INVESTIGATION
```

### Immediate Action (P1 - Memory > 85%)

**Step 1: Verify incident (1 min)**

```bash
# Confirm memory state
docker stats basset-hound-browser --no-stream

# Check memory trend
docker exec basset-hound-browser free -h
```

**Step 2: Notify team (1 min)**

```
Post to Slack #incidents:
:alarm: P1 MEMORY CRITICAL - basset-hound-browser > 85%
Current: [value]% | Threshold: 85%
Status: INVESTIGATING | Incident: INC-[YYYMMDD]-[XXXX]
ETA 5min restart | @on-call-sre @tech-lead
```

**Step 3: Prepare restart (2 min)**

```bash
# Backup current state (if possible)
docker exec basset-hound-browser tar czf /tmp/state-backup.tar.gz \
  /app/data /app/cache 2>/dev/null || echo "State backup failed"

# Create pre-restart logs
docker logs basset-hound-browser > /tmp/memory-incident-logs.txt

# Document current state
docker exec basset-hound-browser ps aux > /tmp/memory-incident-processes.txt
```

**Step 4: Perform controlled restart (1 min)**

```bash
# Option A: Graceful restart
docker restart basset-hound-browser --time=30

# Wait for health check
sleep 10
docker exec basset-hound-browser curl -s http://localhost:8765/health | jq '.status'

# Verify memory after restart
sleep 30
docker stats basset-hound-browser --no-stream
```

**Step 5: Verify service recovery (1 min)**

```bash
# Check WebSocket connectivity
docker exec basset-hound-browser curl -s http://localhost:8765

# Check core command
echo '{"command":"getStatus","id":1}' | \
  docker exec -i basset-hound-browser nc localhost 8765

# Verify memory stable
docker stats basset-hound-browser --no-stream
```

**Step 6: Update status (1 min)**

```
Post to Slack #incidents:
✓ P1 RESOLVED - Memory incident
Action Taken: Container restarted
Memory Now: [value]% (normal range)
Incident: INC-[YYYYMMDD]-[XXXX]
Next: Root cause analysis scheduled
Status: RESOLVED - Moving to investigation phase
```

### Investigation Phase

**If memory spike was temporary:**

1. Analyze logs for the period of high memory:
   ```bash
   grep "memory\|leak\|gc" /tmp/memory-incident-logs.txt | tail -30
   ```

2. Check for known issues:
   - Large screenshot capture during incident?
   - Unusual concurrent load?
   - JavaScript execution gorging memory?

3. If no obvious cause: Schedule deep investigation

**If memory leak suspected (memory climbs 10%+/hour):**

1. Collect heap dump:
   ```bash
   docker exec basset-hound-browser node -e "require('v8').writeHeapSnapshot('/tmp/heap-' + Date.now())"
   docker cp basset-hound-browser:/tmp/heap-*.heapsnapshot /tmp/
   ```

2. Analyze with Chrome DevTools or `clinicjs`

3. Identify leak source and create fix

4. Test fix in staging before deploying

### Monitoring Phase

```
Timeline: 30 minutes post-spike
Check every 5 minutes:
  - [ ] Memory stable (±5% from baseline)
  - [ ] No error rate change
  - [ ] Health checks passing
  - [ ] WebSocket connections stable

If anomalies detected:
  - Return to INVESTIGATION phase
  - Consider additional monitoring/restart
```

---

## High Error Rate Incident

### Incident Detection

**Automated Triggers:**

```
Alert: ElevatedErrorRate
Condition: Error rate 2-5% for 10+ minutes
Severity: P3
Action: Slack notification

Alert: HighErrorRate
Condition: Error rate 5-10% for 5+ minutes
Severity: P2
Action: PagerDuty page

Alert: CriticalErrorRate
Condition: Error rate > 10% for 2+ minutes
Severity: P1
Action: PagerDuty URGENT + Escalation

Alert: CriticalErrorType
Condition: CRITICAL severity errors > 5 in 10 minutes
Severity: P1
Action: PagerDuty URGENT + Escalation
```

### Decision Tree

```
HIGH ERROR RATE DETECTED (Error rate > 2%)
    │
    ├─ Error rate > 10% for 2+ min?
    │   ├─ YES → CRITICAL (P1) → Go to IMMEDIATE ACTION
    │   └─ NO → Go to TRIAGE
    │
    TRIAGE:
    ├─ What type of error?
    │   ├─ ConnectionError → Check network/dependencies → NETWORK RESPONSE
    │   ├─ TimeoutError → Check load/performance → PERFORMANCE RESPONSE
    │   ├─ ValidationError → Check input validation → CONFIG RESPONSE
    │   ├─ SystemError → Check application logs → DEBUG RESPONSE
    │   └─ Unknown → Go to LOG ANALYSIS
    │
    NETWORK RESPONSE:
    ├─ Check dependencies reachable
    ├─ Check network connectivity
    ├─ Check firewall rules
    ├─ If resolved → Monitor, if not → Escalate to infrastructure
    │
    PERFORMANCE RESPONSE:
    ├─ Check current load (concurrent connections)
    ├─ Check CPU/memory usage
    ├─ If resources strained → Consider restart or scale
    ├─ If not → Go to INVESTIGATION
    │
    DEBUG RESPONSE:
    ├─ Examine error stack traces
    ├─ Check for deployment-related changes
    ├─ Determine if rollback needed
    ├─ Execute fix or rollback
    │
    IMMEDIATE ACTION (P1):
    ├─ If systematic bug → Rollback to v11.3.0
    ├─ If resource issue → Restart or scale
    ├─ If unclear → Gather diagnostic data and escalate
```

### Immediate Action (P1 - Error Rate > 10%)

**Step 1: Verify and classify (2 min)**

```bash
# Get error rate
curl -s 'http://prometheus:9090/api/v1/query?query=rate(basset_errors_total[5m])' | jq

# Get error types
docker logs --tail=100 basset-hound-browser | grep "ERROR\|CRITICAL"

# Check error frequency
docker logs --tail=500 basset-hound-browser | grep -c "ERROR"
```

**Step 2: Assess impact (1 min)**

```
Ask yourself:
- Are all commands failing? (CRITICAL bug)
- Are specific commands failing? (Feature bug)
- Are certain conditions triggering errors? (Edge case)
- Is this related to external service? (Dependency issue)
```

**Step 3: Notify team (1 min)**

```
Post to Slack #incidents:
:alert: P1 HIGH ERROR RATE DETECTED - basset-hound-browser
Current: [value]% | Baseline: 0.5% | Threshold: 10%
Error Type(s): [list main error types]
Status: INVESTIGATING | Incident: INC-[YYYYMMDD]-[XXXX]
Duration: [time since start]
@on-call-sre @tech-lead @eng-manager
```

**Step 4: Quick diagnostic (3 min)**

```bash
# Get detailed error analysis
docker logs --since=10m --timestamps basset-hound-browser | \
  grep "ERROR\|CRITICAL" | head -50

# Check if related to specific commands
docker logs --since=10m basset-hound-browser | \
  grep "ERROR" | awk '{print $NF}' | sort | uniq -c | sort -rn

# Check application health
curl -s http://localhost:8765/health | jq

# Check resource state
docker stats basset-hound-browser --no-stream
```

**Step 5: Decide on action (2 min)**

```
Decision Matrix:

If errors are MemoryError or OutOfMemoryError:
  → Execute MEMORY INCIDENT response
  
If errors are ConnectionError and external service down:
  → Wait for external service recovery
  → Increase alerting/monitoring
  
If errors are TimeoutError and CPU/Memory high:
  → Restart container or scale
  
If errors are validation/parsing errors:
  → Check recent deployments for bugs
  → May need rollback (see RESOLUTION OPTIONS below)
  
If errors are systematic and blocking:
  → IMMEDIATE ROLLBACK (see Rollback Runbook)
```

**Step 6: Resolution options**

**Option A: Restart container (if resource constrained)**

```bash
docker restart basset-hound-browser

# Verify recovery
sleep 30
docker logs --tail=50 basset-hound-browser | grep ERROR | wc -l
# Should drop significantly

# Verify metrics
curl -s 'http://prometheus:9090/api/v1/query?query=rate(basset_errors_total[5m])' | jq
```

**Option B: Rollback (if deployment-related bug)**

Follow ROLLBACK-RUNBOOK.md if:
- Error rate doesn't improve after restart
- Errors indicate code bugs
- Recent deployment correlates with error spike

**Option C: Escalate to infrastructure (if external dependency)**

If external service (database, cache, proxy) is down:
```bash
# Check dependency connectivity
curl -s http://[dependency]:port/health

# Document state
docker logs --since=20m basset-hound-browser > /tmp/incident-logs.txt
```

**Step 7: Monitor recovery (ongoing)**

```
Every 5 minutes:
  ✓ Check error rate trend (should decrease)
  ✓ Verify no new errors introduced
  ✓ Check dependent services
  
When error rate returns to baseline:
  ✓ Post all-clear message
  ✓ Schedule root cause analysis
  ✓ Move to post-incident
```

### Investigation Phase

**Root Cause Analysis Checklist:**

1. **Correlate with timeline:**
   ```bash
   # When did errors start?
   docker logs --timestamps basset-hound-browser | \
     grep "ERROR" | head -5
   
   # Any deployments at that time?
   git log --since="[start-time]" --until="[end-time]" --oneline
   ```

2. **Analyze error patterns:**
   ```bash
   # Which commands fail most?
   docker logs --since=30m basset-hound-browser | \
     grep "ERROR" | grep -oP '(?<=command":")[^"]*' | sort | uniq -c | sort -rn
   
   # Which error types?
   docker logs --since=30m basset-hound-browser | \
     grep "ERROR" | grep -oP '(?<=error":")[^"]*' | sort | uniq -c | sort -rn
   ```

3. **Check for external factors:**
   - Load spike?
   - Deployment timing?
   - Infrastructure change?
   - Third-party service issue?

4. **Create fix:**
   - If code bug → Create fix, test, deploy
   - If config issue → Correct config, restart
   - If external → Monitor external service, increase error tolerance

---

## Unavailability Incident

### Incident Detection

**Automated Triggers:**

```
Alert: PartialUnavailability
Condition: < 75% instances responding to health check
Severity: P2
Action: PagerDuty page

Alert: MajorUnavailability
Condition: 75%+ instances down OR < 25% responding
Severity: P1
Action: PagerDuty URGENT + Auto-escalation

Alert: WebSocketDown
Condition: WebSocket connections == 0 for 2+ minutes
Severity: P1
Action: PagerDuty URGENT + Escalation + Auto-rollback trigger
```

### Decision Tree

```
SERVICE UNAVAILABILITY DETECTED
    │
    ├─ Are ANY instances responding?
    │   ├─ YES (partial) → Go to PARTIAL UNAVAILABILITY
    │   └─ NO (complete) → Go to COMPLETE UNAVAILABILITY
    │
    PARTIAL UNAVAILABILITY:
    ├─ What's the pattern?
    │   ├─ Specific instances down → Instance-level issue → INSTANCE RESPONSE
    │   ├─ Random instances → Cascading failure → CASCADING RESPONSE
    │   └─ Increasing failures → Spreading issue → ESCALATION RESPONSE
    │
    INSTANCE RESPONSE:
    ├─ Restart affected instances
    ├─ Check logs for failure reason
    ├─ If persistent → Drain from LB and investigate
    │
    CASCADING RESPONSE:
    ├─ Check for resource exhaustion
    ├─ Check for dependency cascade failure
    ├─ May require fleet restart
    │
    COMPLETE UNAVAILABILITY:
    ├─ Is this a network/LB issue?
    │   ├─ YES → Fix network/LB
    │   └─ NO → Go to APPLICATION DOWN
    │
    APPLICATION DOWN:
    ├─ Check container status
    ├─ Check application logs
    ├─ Restart all containers
    ├─ If recovery fails → Escalate
```

### Immediate Action (P1 - Complete Unavailability)

**Step 1: Verify unavailability (1 min)**

```bash
# Check load balancer
curl -s http://load-balancer:80/health

# Check all instances
for i in {1..10}; do
  echo "Instance $i:"
  curl -s http://basset-prod-0$i:8765/health || echo "DOWN"
done

# Check WebSocket connectivity
timeout 5 curl -s http://localhost:8765 || echo "WebSocket DOWN"
```

**Step 2: Immediate notification (1 min)**

```
Post to Slack #incidents #all-hands:
:fire: P1 SERVICE UNAVAILABLE - Basset Hound Browser
Status: All instances down or unreachable
Impact: CRITICAL - All users affected
Time: [start-time]
Incident: INC-[YYYYMMDD]-[XXXX]
Response: EMERGENCY TRIAGE IN PROGRESS
@on-call-sre @tech-lead @eng-manager @cto
```

**Step 3: Quick diagnostic (2 min)**

```bash
# Check container status
docker ps -a | grep basset

# Check container logs for crash
docker logs --tail=50 basset-hound-browser 2>&1

# Check system resources
docker stats --no-stream

# Check if containers exist
docker images | grep basset-hound-browser

# Check Docker daemon
docker info | head -10
```

**Step 4: Initial recovery attempt (3 min)**

Based on diagnosis:

**If containers are not running:**

```bash
# Restart single container
docker start basset-hound-browser

# Wait for startup
sleep 10

# Verify it's responding
curl -s http://localhost:8765/health || echo "Still not responding"

# Check logs for startup errors
docker logs basset-hound-browser | tail -30
```

**If containers are running but unresponsive:**

```bash
# Check process is actually running
docker top basset-hound-browser

# Check for zombie processes
docker exec basset-hound-browser ps aux | grep -i zombie

# Force restart
docker kill basset-hound-browser
docker start basset-hound-browser

# Wait and verify
sleep 10
curl -s http://localhost:8765/health
```

**If network/LB issue:**

```bash
# Check if container is listening
docker exec basset-hound-browser netstat -tlnp | grep 8765

# Check firewall
iptables -L -n | grep 8765

# Try direct connection to container
docker exec basset-hound-browser curl http://localhost:8765/health
```

**Step 5: Verification (2 min)**

```bash
# Health check
curl -s http://localhost:8765/health | jq

# Test command execution
echo '{"command":"getStatus","id":1}' | \
  curl -s -X POST http://localhost:8765 -d @- | jq

# Check for errors in logs
docker logs basset-hound-browser | grep -i error | wc -l
```

**Step 6: Status update (1 min)**

```
If recovery successful:
  Post to Slack #incidents:
  ✓ P1 RECOVERED - Service is back online
  Recovery Time: [duration] minutes
  Action: Container restarted
  Next: Full validation and root cause analysis
  Incident: INC-[YYYYMMDD]-[XXXX]

If recovery unsuccessful:
  Post to Slack #incidents:
  ✗ P1 IN PROGRESS - Initial recovery failed
  Status: Escalating to full infrastructure team
  Next: Docker/infrastructure diagnostic
  Incident: INC-[YYYYMMDD]-[XXXX]
  @infrastructure-lead @sre-lead
```

### Investigation & Resolution

**If containers won't start:**

```bash
# Check for port conflicts
netstat -tlnp | grep 8765

# Check Docker daemon logs
journalctl -u docker -n 50

# Try rebuilding
docker build -t basset-hound-browser:v12.7.0 .

# Try alternative restart
docker-compose restart basset-hound-browser
```

**If load balancer issue:**

```bash
# Check LB configuration
curl -s http://load-balancer:admin/config

# Check backend pool
curl -s http://load-balancer:admin/backends

# Verify DNS resolution
nslookup basset-prod-01.internal
dig basset-prod-01.internal
```

**If cascading failure:**

```bash
# Check dependency services
curl -s http://redis:6379/ping
curl -s http://postgres:5432
curl -s http://elasticsearch:9200/_cluster/health

# May need full infrastructure recovery
# See infrastructure incident runbook
```

---

## Security Incident

### Incident Detection

**Automated Triggers:**

```
Alert: SuspiciousPattern
Condition: Unusual request patterns, exploitation attempts detected
Severity: P1
Action: PagerDuty + Lock-down protocols

Alert: DataExfiltration
Condition: Unusual data transfer volume detected
Severity: P1
Action: PagerDuty URGENT + Immediate containment

Alert: Unauthorized Access
Condition: Authentication bypass attempts detected
Severity: P1
Action: PagerDuty URGENT + Containment
```

### Decision Tree

```
SECURITY INCIDENT DETECTED
    │
    ├─ What type of incident?
    │   ├─ Unauthorized Access Attempt → ACCESS RESPONSE
    │   ├─ Data Exfiltration → CONTAINMENT RESPONSE
    │   ├─ Malware/Code Injection → ISOLATION RESPONSE
    │   ├─ Credential Compromise → CREDENTIAL RESPONSE
    │   └─ Unknown Pattern → INVESTIGATION RESPONSE
    │
    ACCESS RESPONSE:
    ├─ Block malicious source IPs
    ├─ Increase logging/monitoring
    ├─ Investigate access patterns
    ├─ Check for successful breaches
    │
    CONTAINMENT RESPONSE:
    ├─ Identify data accessed
    ├─ Block suspicious connections
    ├─ Preserve forensic evidence
    ├─ Initiate full audit
    │
    ISOLATION RESPONSE:
    ├─ Isolate affected instance(s)
    ├─ Preserve logs/state for forensics
    ├─ Restart from clean image
    ├─ Full code audit
    │
    CREDENTIAL RESPONSE:
    ├─ Rotate all credentials
    ├─ Audit access logs
    ├─ Check for privilege escalation
    ├─ Force password reset for admins
```

### Immediate Action (P1 - Security Incident)

**Step 1: Verify security incident (2 min)**

```bash
# Collect forensic data before anything else
# DO NOT MODIFY ANYTHING THAT MIGHT CORRUPT EVIDENCE

# Check for unexpected processes
docker top basset-hound-browser

# Check for unexpected network connections
docker exec basset-hound-browser netstat -tlnp | grep LISTEN

# Check for recent file modifications
docker exec basset-hound-browser find /app -type f -mmin -30 | head -20

# Capture current state
docker logs basset-hound-browser > /tmp/security-incident-logs.txt
docker exec basset-hound-browser ps aux > /tmp/security-incident-processes.txt
docker exec basset-hound-browser netstat -tlnp > /tmp/security-incident-network.txt
```

**Step 2: Immediate notification (1 min)**

```
Post to Slack #security #incidents:
:lock: P1 SECURITY INCIDENT - Basset Hound Browser
Type: [Unauthorized Access / Data Exfiltration / etc.]
Source: [IP/User/etc. if known]
Time: [start-time]
Status: CONTAINMENT IN PROGRESS
Response: Incident Commander taking control
Incident: SEC-[YYYYMMDD]-[XXXX]
DO NOT: Modify any systems without approval
@security-team @incident-commander @cto
```

**Step 3: Escalate to incident commander (1 min)**

- Notify security team lead immediately
- Brief CTO/VP of Engineering
- Establish war room (if not already)
- Get incident commander designated

**Step 4: Take containment actions (based on type)**

**For Unauthorized Access:**

```bash
# 1. Identify malicious source
docker logs --since=30m basset-hound-browser | \
  grep "unauthorized\|forbidden\|denied" | \
  awk '{print $NF}' | sort | uniq -c | sort -rn

# 2. Block source IPs
# Example: Block IP at firewall
# iptables -A INPUT -s [malicious-ip] -j DROP

# 3. Check what was accessed
docker logs --since=30m basset-hound-browser | \
  grep "[malicious-ip]" > /tmp/access-audit.txt

# 4. Preserve logs for forensics
tar czf /tmp/security-forensics-$(date +%s).tar.gz \
  /tmp/security-incident-*.txt /var/log/basset*
```

**For Data Exfiltration:**

```bash
# 1. Identify what data was exfiltrated
docker logs --since=30m basset-hound-browser | \
  grep "large request\|bulk download\|export" | \
  head -20 > /tmp/exfiltration-audit.txt

# 2. Identify destination
docker exec basset-hound-browser netstat -tlnp | \
  grep "ESTABLISHED" > /tmp/network-connections.txt

# 3. Block destination IPs (if not legitimate)
# iptables -A OUTPUT -d [destination-ip] -j DROP

# 4. Prepare for incident communication
# Who was affected? What data? When?
```

**For Code Injection/Malware:**

```bash
# 1. Isolate immediately
docker kill basset-hound-browser --force

# 2. Preserve container state for forensics
docker commit basset-hound-browser basset-hound-browser:infected-$(date +%s)

# 3. Preserve logs
docker logs basset-hound-browser > /tmp/infection-logs.txt

# 4. Do NOT restart until forensics team approves

# 5. Audit source code
git log --since="[suspect-date]" --oneline | head -20
```

**Step 5: Communication (2 min)**

```
Craft incident response message:

To: #security #incidents #all-hands

Subject: Security Incident Response - [Type]

Status: INCIDENT COMMANDER [Name] is now coordinating response
Impact: [Describe scope of impact - do not speculate]
Timeline: 
  - Detected: [time]
  - Contained: [time if applicable]
  
Immediate Actions:
  1. [Action taken]
  2. [Action taken]
  3. [Action taken]

Next Steps:
  - Full forensic analysis in progress
  - Customer communications being prepared
  - Updates every 30 minutes

Contact: [Incident Commander] for updates
Incident ID: SEC-[YYYYMMDD]-[XXXX]
```

**Step 6: Forensic evidence preservation**

```bash
# Create forensic bundle (DO NOT ALTER)
mkdir -p /evidence/sec-[incident-id]

# Copy all evidence
cp /tmp/security-incident-*.txt /evidence/sec-[incident-id]/
docker logs basset-hound-browser >> /evidence/sec-[incident-id]/application.log
docker exec basset-hound-browser tar czf - /app > /evidence/sec-[incident-id]/app-state.tar.gz

# Hash for integrity
cd /evidence/sec-[incident-id]
sha256sum * > MANIFEST.txt

# Secure and backup
tar czf /secure/forensic-backup-sec-[incident-id]-$(date +%s).tar.gz /evidence/sec-[incident-id]
```

### Investigation & Resolution

**Security Incident Investigation Checklist:**

- [ ] Forensic evidence collected and secured
- [ ] Incident timeline established
- [ ] Affected systems identified
- [ ] Compromised credentials identified and rotated
- [ ] Attack vector identified
- [ ] Impact assessment completed
- [ ] Customer impact determined
- [ ] Remediation plan created
- [ ] Code/infrastructure fixes deployed
- [ ] Systems hardened
- [ ] Customer communications sent
- [ ] Post-incident review scheduled
- [ ] Security audit conducted

---

## Performance Degradation Incident

### Incident Detection

**Automated Triggers:**

```
Alert: LatencyWarning
Condition: p95 latency > 150% of baseline for 10+ minutes
Severity: P3
Action: Slack notification

Alert: LatencyHigh
Condition: p95 latency > 200% of baseline for 5+ minutes
Severity: P2
Action: PagerDuty page

Alert: TimeoutSpike
Condition: Request timeouts > 5% of traffic for 2+ minutes
Severity: P2
Action: PagerDuty page
```

### Decision Tree

```
PERFORMANCE DEGRADATION DETECTED
    │
    ├─ What's degrading?
    │   ├─ Latency spike → LATENCY RESPONSE
    │   ├─ Request timeouts → TIMEOUT RESPONSE
    │   ├─ Throughput drop → THROUGHPUT RESPONSE
    │   └─ All metrics bad → SYSTEM RESPONSE
    │
    LATENCY RESPONSE:
    ├─ Which command(s)?
    │   ├─ Specific command → Command-level issue
    │   ├─ All commands → System-level issue
    │
    TIMEOUT RESPONSE:
    ├─ Are requests actually succeeding?
    │   ├─ YES (just slow) → Performance issue
    │   ├─ NO (failures) → High error rate issue
    │
    SYSTEM RESPONSE:
    ├─ Check resources
    │   ├─ CPU high → CPU contention
    │   ├─ Memory high → Memory pressure
    │   ├─ Disk high → I/O contention
    │   └─ Network high → Network saturation
    │
    RESOLUTION OPTIONS:
    ├─ Restart to clear caches/buffers
    ├─ Scale horizontally (add capacity)
    ├─ Optimize code/queries
    ├─ Add caching layer
```

### Immediate Action (P2 - Severe Performance)

**Step 1: Verify degradation (2 min)**

```bash
# Get current latency metrics
curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95, basset_command_duration_ms)' | jq

# Get baseline
curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95, basset_command_duration_ms{version="v11.3.0"})' | jq

# Calculate ratio
# If current / baseline > 2.0, definitely degraded

# Check which command is slow
docker logs --since=10m basset-hound-browser | \
  grep "duration:" | \
  awk '{print $NF}' | sort -n | tail -20
```

**Step 2: Check system resources (2 min)**

```bash
# CPU usage
docker stats basset-hound-browser --no-stream | awk '{print $3}'

# Memory usage
docker stats basset-hound-browser --no-stream | awk '{print $4}'

# Disk I/O
docker exec basset-hound-browser iostat -x 1 2 | tail -5

# Load average
docker exec basset-hound-browser uptime
```

**Step 3: Identify bottleneck (2 min)**

```bash
Decision tree:
- CPU > 80%? → CPU-bound issue → Check processes
- Memory > 85%? → Memory-bound issue → Consider restart
- Disk > 200 MB/s? → I/O-bound issue → Check disk
- Network spike? → Network-bound issue → Check connectivity
- All normal? → Application-level issue → Check logs
```

**Step 4: Take action based on bottleneck**

**If CPU-bound:**

```bash
# Check what's using CPU
docker exec basset-hound-browser ps aux | sort -k3 -nr | head -10

# If JavaScript execution is slow:
#   - Check for inefficient algorithm
#   - Consider restarting to clear caches
#   - May need code optimization

# Restart if needed
docker restart basset-hound-browser

# Verify recovery
sleep 30
curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95, basset_command_duration_ms)' | jq
```

**If Memory-bound:**

```bash
# Check memory state
docker stats basset-hound-browser --no-stream

# If memory high, restart to clear
docker restart basset-hound-browser

# Verify recovery
sleep 30
docker stats basset-hound-browser --no-stream

# Monitor for memory leak
# (see HIGH MEMORY INCIDENT section)
```

**If Disk I/O-bound:**

```bash
# Check what's reading/writing
docker exec basset-hound-browser lsof -p [pid] | grep REG

# Check disk usage
docker exec basset-hound-browser df -h

# If cache/temp files bloated:
docker exec basset-hound-browser rm -rf /app/cache/*
docker exec basset-hound-browser rm -rf /tmp/*

# Consider restart if I/O doesn't recover
docker restart basset-hound-browser
```

**If Network-bound:**

```bash
# Check connections
docker exec basset-hound-browser netstat -s | grep segments

# Check for connection leaks
docker exec basset-hound-browser netstat -tlnp | grep ESTABLISHED | wc -l

# If many connections stuck:
docker restart basset-hound-browser
```

**Step 5: Monitor recovery (ongoing)**

```
Every minute for 5 minutes:
  - Latency (should approach baseline)
  - Error rate (should stay normal)
  - Throughput (should recover)
  
When metrics return to normal:
  - Post recovery message
  - Schedule investigation
```

### Investigation Phase

**Root Cause Analysis:**

1. **Was this a one-time spike?**
   - Check if resource contention was temporary
   - Check if load spike caused it
   - If resolved after restart, likely cache/buffer issue

2. **Was this a deployment-related issue?**
   - Check git log for recent changes
   - Check if v12.7.0 regression
   - If so, may need optimization or rollback

3. **Was this a systematic bottleneck?**
   - Monitor same metric over next 24 hours
   - If it happens again → systematic issue
   - May need capacity planning or code optimization

---

## Decision Trees

### Master Incident Classification Tree

```
INCIDENT DETECTED
    │
    ├─ What is the primary symptom?
    │
    ├─ UNAVAILABLE / NOT RESPONDING
    │   └─ Go to UNAVAILABILITY INCIDENT
    │
    ├─ ERRORS SPIKING
    │   └─ Go to HIGH ERROR RATE INCIDENT
    │
    ├─ MEMORY USAGE HIGH
    │   └─ Go to HIGH MEMORY INCIDENT
    │
    ├─ LATENCY DEGRADED / SLOW
    │   └─ Go to PERFORMANCE DEGRADATION INCIDENT
    │
    ├─ SUSPICIOUS ACTIVITY / UNAUTHORIZED ACCESS
    │   └─ Go to SECURITY INCIDENT
    │
    └─ UNKNOWN / MULTIPLE ISSUES
        └─ Go to TRIAGE (See incident ID)
           - Collect diagnostics
           - Determine primary issue
           - Escalate to SRE Lead
           - Classify as one of above
```

### Response Time SLA by Severity

```
P1 (Critical)
  Detection: < 1 minute (automated)
  Initial Response: < 5 minutes
  Mitigation: < 15 minutes
  Resolution: < 1 hour
  
P2 (High)
  Detection: < 5 minutes
  Initial Response: < 15 minutes
  Mitigation: < 30 minutes
  Resolution: < 4 hours
  
P3 (Medium)
  Detection: < 15 minutes
  Initial Response: < 30 minutes
  Mitigation: < 2 hours
  Resolution: < 24 hours
```

---

## Contact Procedures

### On-Call Structure

**Primary On-Call Engineer**
- Role: First responder
- Page: PagerDuty
- Availability: 24/7 during on-call rotation
- Responsibilities:
  - Answer pages within 5 minutes
  - Assess incident severity
  - Execute initial mitigation
  - Update status every 15 minutes (P1/P2)
  - Escalate as needed

**SRE Lead** (Escalation for P1/P2)
- Role: Incident commander for severe incidents
- Page: PagerDuty (if auto-escalate triggered)
- Available: On-demand
- Responsibilities:
  - Coordinate multi-team response
  - Make critical decisions
  - Manage escalations
  - Interface with management

**Technical Lead** (Escalation for P1)
- Role: Engineering escalation
- Page: PagerDuty (manual escalation)
- Responsibilities:
  - Root cause analysis
  - Code/architecture decisions
  - Rollback authorization

**Engineering Manager** (Escalation for P1)
- Role: Management escalation
- Page: Phone call
- Responsibilities:
  - Business impact assessment
  - Customer communication decisions
  - Resource coordination

### Escalation Procedures

**P3 Incident (Medium):**

1. Page primary on-call engineer
2. If no response in 15 min → Page backup engineer
3. If issue persists → Notify engineering manager

**P2 Incident (High):**

1. Page primary on-call engineer
2. Page SRE Lead (parallel)
3. If no response in 10 min → Page backup + Tech Lead
4. Notify engineering manager

**P1 Incident (Critical):**

1. Page primary on-call engineer
2. Page SRE Lead (parallel)
3. Immediately page Tech Lead + Engineering Manager
4. Create war room
5. Notify VP of Engineering (via manager)

### Notification Channels

**Automated (PagerDuty):**
- Primary on-call engineer
- SRE Lead (escalation)
- Tech Lead (escalation)
- Engineering Manager (escalation)

**Manual:**
- VP of Engineering (for P1 incidents with customer impact)
- Security team (for security incidents)
- Communications team (for customer-facing incidents)

**Slack Channels:**
- `#incidents` - All incident discussion
- `#incidents-critical` - P1 incidents only (pinned)
- `#on-call` - On-call status and availability
- `#all-hands` - Company-wide critical incident notifications

---

## Communication Templates

### Initial Incident Notification

**Template: P3 Incident**

```
[Slack #incidents]

:warning: P3 INCIDENT DETECTED - [Service/Component]
Severity: Medium
Status: INVESTIGATING
Duration: [time]
Incident ID: INC-[YYYYMMDD]-[XXXX]

Affected: [List affected functionality]
Impact: [Describe user/system impact]
ETA: [Estimated time to resolution]

On-call: [Engineer name]
Status updates: Every 30 minutes

[Link to incident runbook]
```

**Template: P2 Incident**

```
[Slack #incidents]

:alert: P2 INCIDENT DETECTED - [Service/Component]
Severity: High
Status: MITIGATION IN PROGRESS
Duration: [time]
Incident ID: INC-[YYYYMMDD]-[XXXX]

Affected: [List affected functionality]
Impact: [Describe user/system impact]
Mitigation: [Current action being taken]
ETA: [Estimated time to resolution]

Command Center: [SRE Lead]
Tech Lead: [Lead name]
Status updates: Every 15 minutes

[Link to incident runbook]
```

**Template: P1 Incident**

```
[Slack #incidents #incidents-critical #all-hands]

:fire: P1 CRITICAL INCIDENT - [Service/Component]
Severity: Critical
Status: ALL HANDS ON DECK
Duration: [time]
Impact: CUSTOMERS AFFECTED
Incident ID: INC-[YYYYMMDD]-[XXXX]

CURRENT STATUS:
What: [Concise description of issue]
Why: [Brief explanation if known]
Who: [List of affected services/customers]

CURRENT ACTIONS:
Primary: [Engineer] - [Action description]
SRE Lead: [Person] - [Action description]
Tech Lead: [Person] - [Action description]

TIMELINE:
2026-06-21 14:32 UTC - Issue detected
2026-06-21 14:35 UTC - Incident commander assigned
2026-06-21 14:38 UTC - [Next milestone]

ETA to resolution: [Time/estimate]
Status updates: Every 5-10 minutes in Slack, every 15 minutes via email

Incident Commander: [Name] - [Phone] - [Slack handle]
War Room: [Video conference link]

DO NOT: Make changes without approval from incident commander
```

### Status Update Templates

**During Incident (every 15 min for P1, 30 min for P2):**

```
[Slack #incidents]

:hourglass: STATUS UPDATE - Incident INC-[YYYYMMDD]-[XXXX]
Time: [current time]
Duration: [total duration so far]

Last Update: [Previous status summary]
Current Actions:
  - [Action 1]: [Status/progress]
  - [Action 2]: [Status/progress]
  - [Action 3]: [Status/progress]

Latest Findings:
  - [Finding 1]
  - [Finding 2]
  - [Finding 3]

Next Steps:
  - [Next action]
  - [Parallel action]

ETA to Resolution: [Updated estimate]
Next Update: [Time] UTC

Slack: @incident-commander for updates
```

### Resolution & All-Clear Template

```
[Slack #incidents #all-hands]

:white_check_mark: INCIDENT RESOLVED - INC-[YYYYMMDD]-[XXXX]
Service: [Service name]
Duration: [Total duration of incident]
Resolved: [Time]

SUMMARY:
The [service] experienced [brief description] from [start time] to [resolution time].

ROOT CAUSE:
[Description of what caused the incident]

ACTIONS TAKEN:
1. [Immediate action taken]
2. [Investigation findings]
3. [Resolution implemented]

IMPACT:
- Duration: [minutes/hours]
- Customers Affected: [number or percentage]
- Data Loss: [Yes/No - describe if yes]
- SLA Breach: [Yes/No]

NEXT STEPS:
1. Post-incident review scheduled for [date/time]
2. [Action item 1] - Owner: [Name]
3. [Action item 2] - Owner: [Name]

Please thank [team members] for their rapid response and coordination.

Incident ID: INC-[YYYYMMDD]-[XXXX]
Post-Incident Review: [Link to scheduled meeting]
```

### Customer Communication Template (External)

**Template: For Affected Customers**

```
Subject: Service Incident - Basset Hound Browser

Dear [Customer Name],

We are writing to inform you of a service incident that affected 
Basset Hound Browser between [start time] and [end time] UTC on [date].

WHAT HAPPENED:
[Clear, non-technical explanation of the incident]

IMPACT ON YOUR SERVICE:
[Specific impact to their use case]
[Data loss: yes/no]
[Data integrity: confirmed/being verified]

OUR RESPONSE:
We detected the incident at [time] and immediately began mitigation.
The issue was resolved at [time] with [brief description of fix].

NEXT STEPS:
[Describe any actions they need to take]
[Describe any follow-up communication/reports]
[Offer compensation if applicable]

We sincerely apologize for this incident and the disruption to your service.
We are conducting a thorough investigation to prevent similar incidents.

For questions, please contact [support email] or [support phone]

Best regards,
[Company] Support Team
```

---

## Post-Incident Procedures

### Immediate Post-Incident (Within 1 hour)

**Step 1: Verify complete resolution**

```bash
# Final status check
curl -s http://localhost:8765/health | jq

# Verify metrics returned to normal
curl -s 'http://prometheus:9090/api/v1/query?query=rate(basset_errors_total[5m])' | jq

# Check for any remaining issues
docker logs --tail=50 basset-hound-browser | grep -i error

# Confirm customer impact ended
# (Check user feedback, support tickets, etc.)
```

**Step 2: Secure incident artifacts**

```bash
# Collect all incident-related logs and data
mkdir -p /incidents/INC-[YYYYMMDD]-[XXXX]

# Save container logs
docker logs basset-hound-browser > /incidents/INC-[YYYYMMDD]-[XXXX]/container.log

# Save system logs
docker exec basset-hound-browser journalctl --since="[incident start]" > /incidents/INC-[YYYYMMDD]-[XXXX]/system.log

# Save metrics data
# (Export from Prometheus, Grafana, etc.)

# Save Slack conversation
# (Manually export from Slack archive)

# Create manifest
cat > /incidents/INC-[YYYYMMDD]-[XXXX]/MANIFEST.txt <<EOF
Incident ID: INC-[YYYYMMDD]-[XXXX]
Severity: [P1/P2/P3]
Duration: [start] to [end] (XX minutes)
Root Cause: [Brief summary - full details in post-incident review]
Artifacts:
  - container.log
  - system.log
  - metrics-export.json
  - slack-conversation.txt
EOF

# Compress
tar czf /incidents/INC-[YYYYMMDD]-[XXXX].tar.gz /incidents/INC-[YYYYMMDD]-[XXXX]
```

**Step 3: Schedule post-incident review**

```
Create calendar invite:

Title: Post-Incident Review - INC-[YYYYMMDD]-[XXXX]
Time: [Within 48 hours]
Duration: 60-90 minutes
Attendees:
  - Incident Commander (required)
  - Primary on-call (required)
  - SRE Lead (required)
  - Tech Lead (required)
  - Engineering Manager (optional)
  - Security team (if P1 security incident)

Agenda:
  1. Timeline review (10 min)
  2. Root cause analysis (20 min)
  3. What went well (10 min)
  4. What could improve (15 min)
  5. Action items (15 min)

Resources:
  - [Link to incident artifacts]
  - [Link to runbook used]
  - [Link to metrics dashboard]
```

**Step 4: Create incident report**

**Template: Incident Report**

```markdown
# Incident Report - INC-[YYYYMMDD]-[XXXX]

**Date:** [Date]
**Duration:** [Start time] to [End time] ([XX minutes total])
**Severity:** [P1/P2/P3]
**Status:** [RESOLVED]

## Summary
[1-2 sentence summary of incident]

## Timeline
- **[Start time]**: [What happened]
- **[Time +5m]**: [Detection/Alert]
- **[Time +10m]**: [Initial response]
- **[Time +15m]**: [Escalation if applicable]
- **[Time +XX]**: [Resolution]
- **[End time]**: [All clear confirmed]

## Root Cause
[Detailed explanation of what caused the incident]

## Impact
- **Duration**: XX minutes
- **Customers Affected**: [Number or percentage]
- **Services Affected**: [List services]
- **Data Loss**: [Yes/No]
- **SLA Breach**: [Yes/No]

## Response Summary
**What Worked Well:**
1. [Positive aspect of response]
2. [Positive aspect of response]
3. [Positive aspect of response]

**What Could Improve:**
1. [Area for improvement]
2. [Area for improvement]
3. [Area for improvement]

## Corrective Actions
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Fix/improvement] | [Person] | [Date] | Pending |
| [Fix/improvement] | [Person] | [Date] | Pending |

## Lessons Learned
[Key learnings from this incident]

## References
- [Link to incident artifacts]
- [Link to runbook used]
- [Link to PR with fix]
```

### 24-Hour Post-Incident Review

**Checklist:**

- [ ] Incident artifacts collected and stored
- [ ] Initial incident report completed
- [ ] Post-incident review meeting scheduled
- [ ] Affected customers notified (if applicable)
- [ ] Status page updated
- [ ] Root cause identified
- [ ] Immediate fixes deployed (if applicable)
- [ ] Monitoring adjustments made (if needed)

### Long-term Follow-up (1-2 weeks)

**Checklist:**

- [ ] Post-incident review meeting completed
- [ ] Action items assigned and tracked
- [ ] Code fixes deployed and verified
- [ ] Infrastructure hardening complete
- [ ] Runbook updates published
- [ ] Alert threshold adjustments verified
- [ ] Team training/debriefs complete
- [ ] Final incident report published

---

## Appendix: Quick Reference Cards

### Memory Incident Quick Card

```
P1 MEMORY CRITICAL > 85% for 2 min

IMMEDIATE ACTIONS (< 5 minutes):
1. Verify: docker stats --no-stream
2. Notify: Post to #incidents
3. Prepare: Backup state if possible
4. Restart: docker restart basset-hound-browser
5. Verify: Check memory after 30 sec
6. Update: Post all-clear to #incidents

SUCCESS: Memory returns to normal
CONTINUE: Root cause investigation
```

### Error Rate Incident Quick Card

```
P1 ERROR RATE > 10% for 2 min

IMMEDIATE ACTIONS (< 5 minutes):
1. Verify: Get error rate and types
2. Notify: Post to #incidents
3. Assess: Is this a code bug?
   - YES → May need rollback
   - NO → May need restart
4. Action: Based on assessment
5. Monitor: Check error rate trend
6. Update: Post status to #incidents

SUCCESS: Error rate drops to baseline
CONTINUE: Root cause investigation
```

### Unavailability Incident Quick Card

```
P1 SERVICE UNAVAILABLE - 0 responses

IMMEDIATE ACTIONS (< 5 minutes):
1. Verify: curl http://localhost:8765/health
2. Notify: Post to #incidents #all-hands
3. Check: docker ps | grep basset
4. Restart: docker start basset-hound-browser
5. Wait: 30 seconds for startup
6. Verify: curl health check
7. Update: Post recovery message

SUCCESS: Service responding again
CONTINUE: Investigate why it went down
```

### Performance Incident Quick Card

```
P2 LATENCY SPIKE > 200% baseline for 5 min

IMMEDIATE ACTIONS (< 10 minutes):
1. Verify: Get latency metrics
2. Check: Resource usage (CPU/Memory/Disk)
3. Identify: Bottleneck (which resource?)
4. Action: Based on bottleneck
   - CPU high → Restart or scale
   - Memory high → Restart
   - Disk high → Clear cache, restart
   - Network high → Check connectivity
5. Monitor: Verify recovery
6. Update: Post status to #incidents

SUCCESS: Latency returns to baseline
CONTINUE: Identify root cause
```

### Security Incident Quick Card

```
P1 SECURITY INCIDENT DETECTED

IMMEDIATE ACTIONS (< 10 minutes):
1. DO NOT PANIC, DO NOT MODIFY SYSTEMS
2. Verify: Assess what happened
3. Notify: Post to #security #incidents
4. Escalate: Get incident commander
5. Collect: Preserve forensic evidence
6. Isolate: If needed to prevent spread
7. Brief: Incident commander takes over

DO NOT:
  - Restart containers without approval
  - Modify logs or files
  - Delete evidence
  - Make code changes
  - Discuss publicly

INCIDENT COMMANDER: Will direct all further actions
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-21 | Initial incident response procedures |

---

## Document Control

**Author:** Incident Response Team  
**Last Updated:** June 21, 2026  
**Next Review:** September 21, 2026  
**Location:** `/docs/incident-response/INCIDENT-RESPONSE-PROCEDURES.md`

---

**End of Incident Response Procedures**

For questions about these procedures or to report an incident, contact the SRE team or page on-call engineer via PagerDuty.
