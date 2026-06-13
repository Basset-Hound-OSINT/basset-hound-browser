# Rollback Playbook - v12.0.0+

**Document Version:** 1.0  
**Last Updated:** June 13, 2026  
**Classification:** Internal Operations  
**Duration:** 5-30 minutes depending on scope  
**Owner:** Operations Lead / Release Engineering  

---

## Executive Summary

This playbook provides detailed procedures for rolling back Basset Hound Browser from any version to a previous stable version. Rollback may be initiated due to:

1. **Critical Issues Detected** - High error rates, data corruption, security issues
2. **Performance Degradation** - Unacceptable latency or throughput issues
3. **Cascading Failures** - Issues affecting downstream services
4. **Customer Impact** - Widespread customer-facing failures
5. **Infrastructure Issues** - Resource exhaustion, database problems

The playbook supports three rollback scopes:
- **Full Rollback** - Return to completely stable version (v11.3.0)
- **Phase Rollback** - Return to previous phase (e.g., 25% → 5%)
- **Partial Rollback** - Route portion of traffic to stable while investigating

**Critical Principle:** Speed over perfection. Every minute of service degradation costs customer trust and revenue.

---

## Pre-Rollback Decision Framework

### 1.1 Rollback Severity Assessment

**Responsible Party:** Deployment Lead / On-Call Engineer  
**Time Box:** 2 minutes max

#### 1.1.1 Severity Classification

**SEVERITY P1 - IMMEDIATE ROLLBACK REQUIRED**
- Complete service outage (0% availability)
- Error rate >5%
- Data loss/corruption detected
- Security breach occurring
- Cascading failures to dependent systems
- **Action:** Initiate rollback immediately, NO deliberation

**SEVERITY P2 - URGENT ROLLBACK REQUIRED**
- Severe degradation (error rate 2-5%)
- P99 latency >2 seconds
- Database replication issues
- Memory exhaustion (>95% usage)
- **Action:** Initiate rollback within 2 minutes

**SEVERITY P3 - ROLLBACK RECOMMENDED**
- Moderate issues (error rate 1-2%)
- Customer complaints (>10 in 5 minutes)
- P99 latency 500ms-2 seconds
- Resource pressure (80-95% usage)
- **Action:** Confirm issues, attempt mitigation, rollback if not resolved in 5 minutes

**SEVERITY P4 - MONITOR & ASSESS**
- Minor issues (error rate <1%)
- Single component degradation
- Isolated customer impact
- **Action:** Monitor closely, escalate if worsens

#### 1.1.2 Rollback Decision

| Severity | Decision | Timeline | Escalation |
|----------|----------|----------|-----------|
| P1 | Rollback NOW | < 1 minute | CEO/VP Engineering |
| P2 | Rollback NOW | < 2 minutes | VP Engineering |
| P3 | Assess & decide | < 5 minutes | Engineering Lead |
| P4 | Monitor | Ongoing | Team aware |

**Current Severity Assessment:** __________ 

**Rollback Authorized By:** _________________ **Time:** __________

---

## Section 1: Full Rollback to Previous Version

### 1.1 Pre-Rollback Checklist (3 minutes)

**Responsible Party:** Operations Lead  
**Time Box:** 3 minutes (or skip for P1 severity)

#### 1.1.1 Current State Documentation

- [ ] Take snapshot of current state (for postmortem)
  - Command: `./scripts/capture-system-state.sh`
  - Output file: `/var/log/rollback/pre-rollback-state-[timestamp].txt`
  - Captures: Logs, metrics, config, system status

- [ ] Current version verified
  - Command: `curl -s http://api.basset-hound.prod/health | jq .version`
  - Current version: __________
  - Deployer: __________
  - Deploy time: __________

- [ ] Issues documented
  - Error message: __________
  - Affected endpoints: __________
  - Affected users: __________

#### 1.1.2 Target Version Validation

- [ ] Previous stable version available
  - Target version: v11.3.0
  - Docker image exists: [ ] Yes [ ] No
  - Verify: `docker inspect basset-hound-browser:v11.3.0`

- [ ] Previous version known-good status
  - Last successful deployment: __________
  - Rollback risk: [ ] Low [ ] Medium [ ] High

- [ ] Rollback path clear (no blocking issues)
  - Database compatible: [ ] Yes [ ] No
  - Config compatible: [ ] Yes [ ] No
  - Dependencies available: [ ] Yes [ ] No

### 1.2 Full Rollback Execution (3-5 minutes)

**Responsible Party:** Operations Engineer + Release Engineer  
**Time Box:** 3-5 minutes

#### 1.2.1 Load Balancer Traffic Redirect

**CRITICAL: This must be done first to stop bleeding traffic to broken version**

- [ ] Load balancer configuration updated
  - Source: `docker inspect basset-hound-browser:v12.0.0`
  - Target: `docker inspect basset-hound-browser:v11.3.0`
  - Command: `./scripts/revert-lb-config.sh v11.3.0`
  - File: `/etc/loadbalancer/config.yaml`
  - Change: Route 100% traffic to v11.3.0 backends

- [ ] Load balancer config validated
  - Command: `./scripts/validate-lb-config.sh`
  - Expected: Configuration valid
  - Syntax errors: __________

- [ ] Config reloaded (zero-drop reload)
  - Command: `sudo systemctl reload nginx`
  - Expected: No connection drops
  - Actual: __________

- [ ] Traffic verified routing to v11.3.0
  - Command: `./scripts/verify-traffic-split.sh`
  - Expected: 100% to v11.3.0 ± 1%
  - Actual: __________% 
  - **Timestamp traffic redirected:** __________

**⚠ AT THIS POINT: Traffic is redirected to stable version. User impact is mitigated.**

#### 1.2.2 Backend Cleanup

- [ ] Broken version containers identified
  - Running v12.0.0 containers: __________
  - IDs: __________

- [ ] v12.0.0 containers stopped
  - Command: `docker stop basset-hound-v12.0.0-*`
  - Containers stopped: __________
  - Stop time: __________

- [ ] v12.0.0 containers removed (optional, keep logs first)
  - Command: `docker rm basset-hound-v12.0.0-*`
  - Containers removed: __________
  - Verify: `docker ps | grep v12.0.0`

#### 1.2.3 Stable Version Verification

- [ ] v11.3.0 containers running
  - Expected running: __________
  - Actual running: __________
  - Status: [ ] All healthy [ ] Some unhealthy [ ] All down

- [ ] Health checks passing
  - Command: `curl -s http://api.basset-hound.prod/health | jq .`
  - Expected response: 200 OK
  - Status: __________
  - Response time: __________ms

- [ ] WebSocket API responding
  - Command: `./scripts/test-api-health.sh`
  - Expected: 100% health checks pass
  - Actual: __________%

### 1.3 Post-Rollback Stability (5-10 minutes)

**Responsible Party:** Monitoring Team + Operations Lead  
**Time Box:** 5-10 minutes

#### 1.3.1 Error Rate Recovery

- [ ] Error rate trending down
  - Pre-rollback peak: __________%
  - Immediate post (T+1min): __________%
  - T+3min: __________%
  - T+5min: __________%
  - Target: <0.2%

- [ ] Errors stopping
  - Expected: Errors plateau and decrease
  - Actual trend: [ ] Decreasing [ ] Stable [ ] Still increasing (ALERT)

#### 1.3.2 Latency Recovery

- [ ] Latency returning to baseline
  - Pre-rollback P99: __________ms
  - Immediate post (T+1min): __________ms
  - T+3min: __________ms
  - T+5min: __________ms
  - Target: Return to <200ms

- [ ] Connection processing normal
  - No backed-up requests: [ ] Confirmed [ ] Needs verification
  - Request queue clearing: [ ] Yes [ ] No

#### 1.3.3 Resource Recovery

- [ ] Memory releasing
  - Pre-rollback: __________MB
  - Immediate post: __________MB
  - Expected: Stable or decreasing

- [ ] CPU usage normalizing
  - Pre-rollback: __________%
  - Immediate post: __________%
  - Expected: <30%

#### 1.3.4 No Cascading Failures

- [ ] Database still responsive
  - Command: `./scripts/check-db-connection.sh`
  - Status: [ ] Healthy [ ] Degraded [ ] Down

- [ ] Cache systems responsive
  - Command: `./scripts/check-cache-health.sh`
  - Status: [ ] Healthy [ ] Degraded [ ] Down

- [ ] Message queues operational
  - Command: `./scripts/check-queue-health.sh`
  - Status: [ ] Healthy [ ] Degraded [ ] Down

### 1.4 Rollback Success Confirmation

**Time Check:** T+10 minutes post-rollback

#### 1.4.1 Success Criteria Met?

| Criterion | Target | Actual | Status |
|-----------|--------|--------|--------|
| Error rate | <0.2% | ___% | ✓/✗ |
| P99 latency | <200ms | ___ms | ✓/✗ |
| Availability | >99% | ___% | ✓/✗ |
| No restarts | 0 | ___ | ✓/✗ |
| DB healthy | Connected | Yes/No | ✓/✗ |
| No cascades | None | ___ | ✓/✗ |

**Rollback Status:** [ ] **SUCCESSFUL** / [ ] **PARTIAL** / [ ] **FAILED**

**Rollback Completed At:** __________

#### 1.4.2 Incident Declaration

- [ ] Incident created (if not already)
  - Incident ID: __________
  - Severity: P1 / P2 / P3
  - Start time: __________
  - Resolution time: __________minutes
  - Impact: __________users affected

- [ ] Incident status updated to "INVESTIGATING"
  - Timeline: Deployment failed at __________ (v12.0.0 had issues)
  - Action taken: Rolled back to v11.3.0 at __________
  - Current status: Stable

- [ ] War room escalation
  - War room opened: [ ] Yes [ ] No
  - Time: __________
  - Participants: __________

---

## Section 2: Phase Rollback (Canary → Stable)

### 2.1 Phase Rollback Decision (< 2 minutes)

**Scenario:** Issues detected during Phase 1, 2, or 3 of progressive rollout

**Responsible Party:** Deployment Lead  

#### 2.1.1 Phase-Specific Decision

**If issues in Phase 1 (5% → 25% traffic increase):**
- [ ] Revert to Phase 0 (5% canary only)
  - Target: v12.0.0 at 5%, v11.3.0 at 95%
  - Duration to execute: <2 minutes

**If issues in Phase 2 (25% → 50% traffic increase):**
- [ ] Option A: Revert to Phase 1 (v12.0.0 at 25%)
  - Allows continued investigation with reduced risk
- [ ] Option B: Full rollback to v11.3.0 (100%)
  - Safest option if Phase 2 issues are severe

**If issues in Phase 3 (50% → 100% traffic increase):**
- [ ] Full rollback to v11.3.0 (100%)
  - Phase 3 failure means new version isn't ready for production
  - Must return to stable

### 2.2 Phase Rollback Execution (2-3 minutes)

#### 2.2.1 Load Balancer Configuration Update

- [ ] New traffic weights configured
  - Scenario Phase 2 → Phase 1:
    - v11.3.0: 75%
    - v12.0.0: 25% (was 50%)
  - OR Full rollback:
    - v11.3.0: 100%
    - v12.0.0: 0%

- [ ] Config validated and deployed
  - Command: `sudo systemctl reload nginx`
  - Verification: `./scripts/verify-traffic-split.sh`

#### 2.2.2 Additional Instances (if downgrading phase)

- [ ] Additional v11.3.0 backends activated (if available)
- [ ] v12.0.0 capacity reduced to previous phase
- [ ] Load balanced evenly

#### 2.2.3 Stability Verification (3 minutes)

- [ ] Error rates improving
  - Expected: Decrease to previous phase baseline
- [ ] Latency improving
  - Expected: Return to previous phase latency
- [ ] No new issues appearing
  - All systems healthy: [ ] Yes [ ] No

---

## Section 3: Partial Rollback (Traffic Shaping)

### 3.1 Partial Rollback Scenario

**Use Case:** Suspected issues but want to investigate further without full rollback

**Example:** Error rate is 2% (elevated) but not critical, want to investigate root cause while returning some traffic to stable.

### 3.2 Partial Rollback Execution

#### 3.2.1 Traffic Shaping Configuration

- [ ] Load balancer updated with reduced v12.0.0 weight
  - v11.3.0: 70%
  - v12.0.0: 30% (reduced from 50%)
  - Command: `./scripts/set-traffic-split.sh 70 30`

- [ ] Metrics monitored
  - Error rate should decrease
  - Investigation can continue
  - Quick rollback still possible

#### 3.2.2 Investigation Window

- [ ] Root cause investigation underway
  - What went wrong: __________
  - When did it start: __________
  - Which requests affected: __________
  - Which systems impacted: __________

- [ ] Time limit for investigation
  - Investigation duration: 30 minutes max
  - At 30 min: Must make GO/NO-GO decision
  - Options:
    - [ ] Revert more traffic if issue found
    - [ ] Proceed with caution if issue identified and fixed
    - [ ] Full rollback if issue critical

---

## Section 4: Rollback from Emergency (Real-Time Response)

### 4.1 Emergency Rollback (P1 Incidents)

**Responsible Party:** Any engineer present  
**Time Box:** <1 minute to initiate

#### 4.1.1 Immediate Action (Execute in order)

1. [ ] **Declare emergency rollback**
   - Slack: `@here EMERGENCY ROLLBACK INITIATED - Production degraded`
   - War room: "Starting emergency rollback"

2. [ ] **Redirect traffic immediately**
   - Script: `./scripts/emergency-rollback.sh`
   - This:
     - Sets all traffic to v11.3.0
     - Stops all v12.0.0 containers
     - Reloads load balancer

3. [ ] **Verify traffic shifted**
   - Command: `./scripts/verify-traffic-split.sh`
   - Expected: 100% to v11.3.0 within 30 seconds

4. [ ] **Monitor error resolution**
   - Error rate should drop immediately
   - Check: `./scripts/get-metrics.sh error_rate`

**Total execution time: <90 seconds for complete traffic redirection**

#### 4.1.2 Post-Emergency Steps

- [ ] Once stable: Document what happened
- [ ] Create incident: P1 severity
- [ ] Schedule immediate postmortem
- [ ] Do NOT attempt re-deployment for 24 hours

---

## Section 5: Data Safety During Rollback

### 5.1 Database State Management

**Critical:** Rollback should NOT require database rollback if new version is backward compatible with v11.3.0 schema.

#### 5.1.1 Pre-Rollback Database Checks

- [ ] Database has recent backup
  - Last backup time: __________
  - Backup location: __________
  - Backup verified: [ ] Yes [ ] No

- [ ] Replication healthy before rollback
  - Replication lag: __________ms (should be <1 second)
  - Replica in sync: [ ] Yes [ ] No

#### 5.1.2 Schema Compatibility Verification

- [ ] v12.0.0 schema changes are backward compatible with v11.3.0
  - New tables: __________
  - Modified tables: __________
  - All changes safe: [ ] Yes [ ] No

- [ ] If schema incompatibility exists:
  - [ ] Cannot perform simple rollback
  - [ ] Must perform database migration/rollback
  - [ ] See Database Migration Playbook

### 5.2 Post-Rollback Database Validation

- [ ] Data integrity verified
  - Command: `./scripts/verify-db-integrity.sh`
  - Expected: No corruption detected
  - Result: __________

- [ ] Replication still healthy
  - Replication lag: __________ms
  - Replica caught up: [ ] Yes [ ] No

- [ ] No data loss occurred
  - Record counts same: [ ] Yes [ ] No
  - Key tables checksums: [ ] Match [ ] Different

---

## Section 6: Post-Rollback Communication

### 6.1 Internal Communication

**Responsible Party:** Deployment Lead  
**Time Box:** 2-5 minutes after rollback complete

#### 6.1.1 Incident Status Update

- [ ] Slack announcement
  - Channel: #incidents or #general
  - Message: "Rollback to v11.3.0 complete. Service is stable. Investigating issues with v12.0.0."
  - Message time: __________

- [ ] Engineering team notified
  - Method: Slack mention in #engineering
  - Content: What happened, what we're doing, when to expect postmortem

- [ ] Management notified
  - Who: VP Engineering, Product Lead
  - What: Rollback due to [reason], investigating
  - Impact: Users unaffected (if true)

#### 6.1.2 War Room Status

- [ ] War room remains active
  - Purpose: Continue investigation
  - Duration: At least 1 hour post-rollback
  - Participants: Eng team, Ops, Management (if P1)

### 6.2 Customer Communication

**Responsible Party:** Customer Success / Product  
**Decision:** Based on severity and customer impact

#### 6.2.1 Communication Decision Matrix

| Severity | Users Impacted | Communication | Channel | Timing |
|----------|----------------|---------------|---------|--------|
| P1 | Many (>1000) | Sent | Email + Status Page | Immediately |
| P2 | Some (100-1000) | Sent | Status Page | Within 5 min |
| P3 | Few (<100) | Optional | None or Status | When ready |
| P4 | Minimal | None | None | None |

#### 6.2.2 Communication Template

```
Subject: Production Incident - Service Recovered

We experienced a deployment issue with v12.0.0 and have rolled back to 
v11.3.0. Your service is now stable and fully operational.

Timeline:
- 14:32 UTC: Issue detected
- 14:35 UTC: Rollback initiated
- 14:37 UTC: Service restored
- Duration: 5 minutes of potential impact

We are investigating the root cause and will communicate updates in 
our #incidents Slack channel.

Sincere apologies for any disruption to your service.
```

### 6.3 Post-Rollback Postmortem

**Responsible Party:** Engineering Lead  
**Timing:** Scheduled within 24 hours

#### 6.3.1 Postmortem Agenda

1. Timeline reconstruction (5 min)
2. What happened (10 min)
3. Why it happened (15 min)
4. What we'll do to prevent it (15 min)
5. Action items assignment (5 min)

#### 6.3.2 Postmortem Documentation

- [ ] Postmortem document created
  - File: `/docs/postmortem/v12.0.0-rollback-[date].md`
  - Includes all sections from postmortem agenda

- [ ] Action items tracked
  - Issues filed in tracker
  - Owners assigned
  - Due dates set

---

## Appendix A: Rollback Scripts

### A.1 Emergency Rollback Script

```bash
#!/bin/bash
# Emergency rollback script
# Usage: ./scripts/emergency-rollback.sh [target-version]

set -e

TARGET_VERSION="${1:-v11.3.0}"
echo "EMERGENCY ROLLBACK INITIATED"
echo "Target version: $TARGET_VERSION"
echo "Time: $(date)"

# Step 1: Redirect all traffic to stable
echo "[1/3] Redirecting traffic to $TARGET_VERSION..."
./scripts/revert-lb-config.sh "$TARGET_VERSION"
sudo systemctl reload nginx

# Step 2: Stop broken version
echo "[2/3] Stopping broken version containers..."
docker stop basset-hound-v12.0.0-* 2>/dev/null || true

# Step 3: Verify stable version
echo "[3/3] Verifying $TARGET_VERSION is healthy..."
sleep 2
curl -s http://api.basset-hound.prod/health | jq .

echo "Emergency rollback complete!"
echo "Completion time: $(date)"
```

### A.2 Phase Rollback Script

```bash
#!/bin/bash
# Phase rollback script
# Usage: ./scripts/rollback-phase.sh [phase]

set -e

PHASE="${1:-1}"
case $PHASE in
  1)
    STABLE_WEIGHT=95
    CANARY_WEIGHT=5
    ;;
  2)
    STABLE_WEIGHT=75
    CANARY_WEIGHT=25
    ;;
  *)
    STABLE_WEIGHT=100
    CANARY_WEIGHT=0
    ;;
esac

echo "Rolling back to Phase $PHASE"
echo "Stable: $STABLE_WEIGHT%, Canary: $CANARY_WEIGHT%"

./scripts/set-traffic-split.sh $STABLE_WEIGHT $CANARY_WEIGHT
```

---

## Appendix B: Rollback Decision Tree

```
PRODUCTION ISSUE DETECTED
        ↓
[SEVERITY ASSESSMENT]
        ↓
    ┌───┴───┐
    ↓       ↓
   P1       P2-P4
   │        │
[<1 min]   [<5 min]
   │        │
EMERGENCY  ASSESS
ROLLBACK   & DECIDE
   │        │
   ├────────┴────────┐
   │                 │
TRAFFIC          INVESTIGATE
100%→            FURTHER
v11.3.0              │
   │         ┌───────┼───────┐
   │         ↓       ↓       ↓
   │      FIX    MONITOR  ROLLBACK
   │      ISSUE  CLOSELY
   │         │       │
   │         └───┬───┘
   │             │
   │        [STABLE?]
   │         YES / NO
   │          │    │
   │          │  ROLLBACK
   │          │    │
   └──────────┴────┘
        ↓
    POSTMORTEM
```

---

## Appendix C: Contacts & Escalation

| Role | Name | Phone | Slack | Email |
|------|------|-------|-------|-------|
| Deployment Lead | _________ | _________ | _________ | _________ |
| On-Call Engineer | _________ | _________ | _________ | _________ |
| Infrastructure Lead | _________ | _________ | _________ | _________ |
| VP Engineering | _________ | _________ | _________ | _________ |
| CTO | _________ | _________ | _________ | _________ |

---

## Appendix D: Rollback Checklist Template

```
ROLLBACK EXECUTION CHECKLIST

Incident ID: __________
Issue: __________
Start Time: __________
Rollback Decision: [APPROVED] at __________
Authorized By: __________

EXECUTION:
□ Traffic redirected (100% to v11.3.0)
□ v12.0.0 containers stopped
□ Health checks passing
□ Error rates returning to normal
□ Latency returning to baseline
□ All systems stable

VERIFICATION:
□ Error rate: ___% (target: <0.2%)
□ P99 latency: ___ms (target: <200ms)
□ Availability: __% (target: >99%)
□ No cascading failures
□ Database healthy
□ Cache systems healthy

COMMUNICATION:
□ Engineering team notified
□ Management notified
□ Customers notified (if applicable)
□ Incident created
□ War room established

COMPLETION:
Rollback completed at: __________
Time to rollback: __________ minutes
Rollback success: [YES] [PARTIAL] [NO]

Post-Action:
□ Postmortem scheduled for: __________
□ Investigation underway
□ Action items tracked
```
