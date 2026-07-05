# ON-CALL HANDBOOK
**Basset Hound Browser v12.7.0**  
**Last Updated**: June 21, 2026  
**Status**: Production Ready

---

## Table of Contents
1. [Overview](#overview)
2. [On-Call Basics](#on-call-basics)
3. [First Response](#first-response)
4. [Incident Management](#incident-management)
5. [Common Scenarios](#common-scenarios)
6. [After-Hours Support](#after-hours-support)
7. [Knowledge Base](#knowledge-base)
8. [Escalation Matrix](#escalation-matrix)

---

## Overview

On-call rotation provides 24/7 support for production Basset Hound Browser. This handbook guides on-call engineers through common situations.

**On-Call Contact Information**:
- **Slack**: @ops-oncall
- **PagerDuty**: Available in ops workspace
- **Phone**: See on-call schedule
- **Email**: ops-oncall@basset-hound.example.com

**On-Call Hours**:
- Weekday: 6 PM - 9 AM + 1 hour on-call window
- Weekend: Full 24 hours
- Holidays: Full 24 hours (with bonus compensation)

**On-Call Expectations**:
- Respond within 15 minutes to P1 alerts
- Respond within 1 hour to P2 alerts
- Respond within 4 hours to P3 alerts
- Document all incidents
- Participate in post-mortems

---

## On-Call Basics

### Setup Before Going On-Call

**1 week before your shift**:

- [ ] Update contact information in on-call schedule
- [ ] Verify access to:
  - [ ] AWS console
  - [ ] Kubernetes clusters
  - [ ] Grafana dashboards
  - [ ] Slack workspace
  - [ ] VPN (if required)
  - [ ] Database access
- [ ] Review recent incidents and fixes
- [ ] Review changes deployed this sprint
- [ ] Test your alerting setup (phone, SMS, Slack)
- [ ] Verify you have appropriate AWS/k8s IAM permissions

### Day Before Your Shift

- [ ] Read [Recent Incidents](https://basset-hound.example.com/incidents/recent)
- [ ] Review active issues in GitHub
- [ ] Check for ongoing maintenance windows
- [ ] Familiarize yourself with current deployment version
- [ ] Verify test email/SMS alert reception

### First Hour of Your Shift

```bash
# 1. Log in and verify access
# - Slack workspace online
# - Kubernetes access: kubectl cluster-info
# - AWS access: aws sts get-caller-identity
# - Grafana login: http://localhost:3000

# 2. Get situational awareness
basset-quick-check  # Run quick diagnostic

# 3. Check open issues
# - GitHub: open issues with "in-progress" label
# - Slack: #basset-hound-ops recent messages
# - PagerDuty: active incidents

# 4. Brief review of critical dashboards
# - Service overview: Up/down status
# - Error rate: Baseline and trends
# - Resource usage: Memory, CPU, disk
```

### Last Hour of Your Shift

- [ ] Handoff to next on-call engineer
  - Summarize any active issues
  - Share any workarounds
  - Flag items needing follow-up
- [ ] Ensure all incidents documented
- [ ] Update on-call notes for handoff
- [ ] Verify next engineer has all necessary access

---

## First Response

### Alert Received: What to Do Immediately

```
Time: T+0 minutes
Alert arrives in Slack/PagerDuty
```

**Actions** (within 2 minutes):

1. **Acknowledge alert** in PagerDuty
   - Prevents duplicate escalation
   - Stops alert fatigue

2. **Verify alert is real** (not false positive)
   ```bash
   basset-quick-check
   curl http://localhost:8765/health
   ```

3. **Check context**
   - Look at alert details
   - Check dashboard for trends
   - Review recent deployments

4. **Determine severity**
   - Is service completely down? → P1
   - Is service degraded? → P2
   - Is service operational with issues? → P3

### Response Timeline by Severity

#### P1 (Critical - Service Down)

```
T+0:  Alert received → Acknowledge
T+5:  Diagnosis → Identify issue
T+15: Mitigation → Implement fix
T+30: Resolution → Service restored
```

**Actions**:
1. Acknowledge in PagerDuty
2. Join incident bridge (meeting link in PagerDuty)
3. Follow [Incident Management](#incident-management) section
4. Call another engineer if stuck at T+10

#### P2 (High - Degraded Service)

```
T+0:  Alert received → Acknowledge
T+10: Diagnosis → Identify issue
T+30: Mitigation → Implement fix
T+60: Resolution → Service improved
```

**Actions**:
1. Acknowledge alert
2. Investigate root cause
3. If critical path affected, escalate to P1
4. Otherwise, work through troubleshooting

#### P3 (Medium - Operational Issue)

```
T+0:  Alert received → Acknowledge
T+30: Diagnosis → Identify issue
T+60: Triage → Low impact? File ticket
T+120: Resolution → Fix or defer
```

**Actions**:
1. Acknowledge alert
2. Investigate at your pace
3. If impacts users, escalate to P2
4. Otherwise, can defer to business hours if safe

---

## Incident Management

### Declaring an Incident

When to declare:

- Service unavailable (P1)
- Service significantly degraded (P2)
- Data loss or corruption
- Security incident
- Scheduled incident (maintenance, deployment)

**How to declare**:

```bash
# Slack command
/incident declare "Basset Hound service down" p1 #basset-hound-ops

# Or manually
incident-declare "issue summary" p1
```

### Incident Command

First responder becomes Incident Commander (IC) until handed off.

**IC Responsibilities**:
1. Manage response timeline
2. Delegate tasks to team members
3. Communicate status updates
4. Make severity decisions
5. Call for escalation if needed

**If not comfortable being IC**:
```bash
# Call another engineer to take IC role
/page @senior-engineer "Need IC for Basset down, IC transfer"
```

### Status Updates

Update every 15 minutes (P1) or 30 minutes (P2):

```
On-Call: "Service down, investigating connection pool leak"
Status: Investigating
ETA: 15 minutes to fix
```

### Resolution Communication

When issue resolved:

1. **Verify fix worked**
   ```bash
   curl -s http://localhost:8765/health | jq '.status'
   # Should see "healthy"
   
   Load test to verify
   ```

2. **Close incident**
   ```bash
   /incident close "Fixed with service restart and increased memory limit"
   ```

3. **Update status page**
   - If publicly visible
   - Note incident duration and impact

4. **Create post-mortem** (if P1)
   - Within 24 hours
   - 30-minute meeting
   - Document lessons learned

---

## Common Scenarios

### Scenario 1: Service Down, No Obvious Errors

**Timeline**:
- T+0: Alert service unreachable
- T+2: Run quick check

```bash
curl -v http://localhost:8765/health
# Connection refused

docker ps | grep basset
# Shows running but...

docker logs basset-hound-browser | tail -5
# No recent logs, might be hung

# Restart
docker restart basset-hound-browser
sleep 10

curl -v http://localhost:8765/health
# Now responds!
```

**Root cause**: Service hung but process still running

**Prevention**: Implement aggressive health check timeouts

---

### Scenario 2: High Error Rate After Deployment

**Timeline**:
- T+0: Alert error rate > 2%
- T+2: Check recent deployments

```bash
# Check version
curl http://localhost:8765/version

# Check deployments
git log --oneline -5

# Review error types
docker logs basset-hound-browser 2>&1 | \
  grep "error" | head -20
```

**If deployment caused issue**:

```bash
# Rollback to previous version
git checkout HEAD~1
docker build -t basset-hound-browser:rollback .
docker-compose down
docker run ... basset-hound-browser:rollback
```

**If rollback resolves**, create post-mortem.

---

### Scenario 3: High Memory Usage, Pod Killed

**Timeline**:
- T+0: Alert memory > 85%
- T+2: Check memory status

```bash
kubectl get pods -n basset-hound
# Shows: basset-pod-xxx  0/1  OOMKilled

kubectl describe pod basset-pod-xxx -n basset-hound
# Shows: OOMKilled (exit code 137)

# Increase memory limit
kubectl set resources deployment basset-hound-browser \
  --limits=memory=4G \
  -n basset-hound

# Redeploy
kubectl rollout restart deployment/basset-hound-browser -n basset-hound
```

**Follow-up**: Investigate memory leak in business hours.

---

### Scenario 4: WebSocket Connection Refused

**Timeline**:
- T+0: Alert WebSocket down
- T+2: Check port

```bash
# Check port
nc -zv localhost 8765
# Connection refused

# Check if port in use by something else
sudo lsof -i :8765
# Shows nginx or other service

# Kill conflicting process
sudo kill -9 <PID>

# Or change port temporarily
docker-compose down
docker run -p 8766:8765 basset-hound-browser:12.7.0
```

**Check firewall**:
```bash
sudo firewall-cmd --list-ports
# If 8765 not listed:
sudo firewall-cmd --add-port=8765/tcp --permanent
sudo firewall-cmd --reload
```

---

### Scenario 5: Disk Space Critical

**Timeline**:
- T+0: Alert disk > 90%
- T+2: Check disk usage

```bash
df -h /
# /dev/sda1  100G  95G  5G  95%

# Find what's using space
du -sh /var/lib/docker/*
# Likely culprit: logs or volumes

# Clean old logs
docker exec basset-hound-browser \
  find /app/logs -mtime +30 -delete

# Clean Docker system
docker system prune -a --volumes
docker image prune -a

# Verify
df -h /
# Should be < 80%
```

**If still > 80%**, backup large volume and delete old data.

---

### Scenario 6: Cascading Failures (Multiple Pods Down)

**Timeline**:
- T+0: Multiple alerts firing
- T+2: Check cluster health

```bash
# Check cluster
kubectl get nodes
# Some nodes showing NotReady? Resource issue.

# Check pods
kubectl get pods -n basset-hound
# Multiple CrashLoopBackOff? Deployment issue.

# Check events
kubectl get events -n basset-hound --sort-by='.lastTimestamp' | tail -20

# Check resource availability
kubectl describe nodes
# Look for "MemoryPressure" or "DiskPressure"
```

**Immediate response**:
1. Scale down to reduce resource contention
   ```bash
   kubectl scale deployment basset-hound-browser --replicas=1 -n basset-hound
   ```

2. Delete stuck pods
   ```bash
   kubectl delete pod <pod-name> --grace-period=0 --force -n basset-hound
   ```

3. Verify stability
   ```bash
   kubectl get pods -n basset-hound -w
   ```

**Call for help if**:
- Cascading failures continue
- Multiple cluster nodes affected
- Data loss possible

---

## After-Hours Support

### Getting Help During Your Shift

**Level 1: Try escalation path yourself** (30 min)
- Run troubleshooting steps from runbooks
- Check knowledge base
- Review similar past incidents

**Level 2: Ask for guidance** (if stuck > 30 min)

```bash
# Slack a senior engineer
@senior-engineer having trouble with [issue], can you pair?

# Or page
/page @senior-engineer "Need pair on basset issue"
```

**Level 3: Page incident commander** (if critical P1)

```bash
# If not resolving and critical
/page @ic "Service down 45 min, need escalation"
```

### Who to Call

**Database Experts**: @db-on-call
**Kubernetes Experts**: @k8s-on-call
**Networking**: @network-on-call
**Security**: @security-on-call
**DevOps Lead**: @devops-lead

### Burn Rate

If incident is burning through error budget:

- **1x burn rate**: Normal (some downtime acceptable)
- **2x burn rate**: Urgent, escalate if > 30 min
- **5x burn rate**: Critical, immediate escalation
- **10x burn rate**: War room, all hands

Example:
```
SLO: 99.5% availability = 216 minutes downtime/month
Incident: 30-minute outage = 139x burn rate
Must resolve immediately and post-mortem
```

---

## Knowledge Base

### Most Common Issues

1. **Service Restart Needed**: ~30% of incidents
   - Symptom: Service hung but process running
   - Fix: docker restart basset-hound-browser
   - Prevention: Aggressive timeout configs

2. **High Memory**: ~20% of incidents
   - Symptom: Memory > 1.5GB
   - Fix: Restart or increase allocation
   - Prevention: Monitor memory trends

3. **Network Issues**: ~15% of incidents
   - Symptom: Connection refused
   - Fix: Check firewall, restart container
   - Prevention: Network monitoring

4. **Deployment Issues**: ~15% of incidents
   - Symptom: Errors spike after deployment
   - Fix: Rollback or fix bug
   - Prevention: Canary deployments

5. **Disk Space**: ~10% of incidents
   - Symptom: Write failures
   - Fix: Clean old files
   - Prevention: Automated log rotation

6. **Database Issues**: ~5% of incidents
   - Symptom: Slow queries or locked tables
   - Fix: Kill long-running queries, rollback transaction
   - Prevention: Query optimization

7. **Configuration Issues**: ~5% of incidents
   - Symptom: Unexpected behavior
   - Fix: Verify config matches deployment
   - Prevention: Config validation

### Quick Fixes (< 5 min)

```bash
# 1. Service unreachable → Restart
docker restart basset-hound-browser
sleep 10
curl http://localhost:8765/health

# 2. High memory → Restart
docker restart basset-hound-browser

# 3. Port in use → Find and kill
sudo lsof -i :8765 | tail -1 | awk '{print $2}' | xargs kill -9

# 4. Firewall issue → Add port
sudo firewall-cmd --add-port=8765/tcp --permanent
sudo firewall-cmd --reload

# 5. Disk full → Clean logs
docker exec basset-hound-browser find /app/logs -mtime +7 -delete

# 6. Config wrong → Redeploy
docker-compose down
docker-compose pull
docker-compose up -d
```

---

## Escalation Matrix

### When to Escalate

```
Issue: Service Down (P1)
  ├─ Can diagnose in 5 min? → Continue
  └─ Stumped after 5 min? → Escalate immediately

Issue: Service Degraded (P2)
  ├─ Can fix in 30 min? → Continue
  └─ Stuck after 30 min? → Escalate

Issue: Operational Problem (P3)
  ├─ Low impact? → Continue
  └─ Could become P2? → Escalate
```

### Escalation Path

```
Tier 1: On-call Engineer (you)
  ↓
Tier 2: Senior On-Call Engineer / Tech Lead
  - Page if stuck > 15 min (P1) or > 30 min (P2)
  ↓
Tier 3: Engineering Manager
  - Page if need business decision
  - Page if customer impact > 1 hour
  ↓
Tier 4: VP Engineering
  - For customer escalations
  - For press/public incidents
```

### Escalation Script

```bash
# Page senior engineer
/page @senior-oncall "Service down 20 min, need help - [issue summary]"

# Alert manager if P1
/page @manager "P1 incident, Basset service down [minutes]"

# Mark as critical if becoming major
/incident update-severity p1-critical

# Open war room if needed
/bridge open "Basset down - All-hands incident response"
```

---

## Post-Incident Procedures

### After Incident Resolved

**Within 1 hour**:
- [ ] Close incident in PagerDuty
- [ ] Update status page (if public)
- [ ] Post incident summary in #basset-hound-ops

**Within 24 hours**:
- [ ] Schedule post-mortem (30-60 min)
- [ ] Create timeline of events
- [ ] Document root cause
- [ ] List action items

**Post-Mortem Template**:

```markdown
# Incident Post-Mortem

## Summary
- **Date**: June 21, 2026 14:30 UTC
- **Duration**: 45 minutes
- **Impact**: Service unavailable, 0 requests processed
- **Root Cause**: Memory leak in WebSocket handler

## Timeline
- 14:30: Alert fires (memory > 85%)
- 14:35: On-call investigates
- 14:40: Identified memory leak in recent changes
- 14:45: Rolled back to previous version
- 14:50: Service restored
- 14:52: Verified health, closed incident

## Root Cause
Unreleased WebSocket connections accumulating in memory
(see GitHub issue #xyz)

## Action Items
- [ ] Fix WebSocket cleanup (assign to @engineer) - Due: June 23
- [ ] Add memory monitoring alert (assign to @ops) - Due: June 22
- [ ] Review similar patterns in codebase - Due: June 28

## Lessons Learned
1. Should have caught memory leak in QA
2. Alert threshold should have been 70%, not 85%
3. Faster rollback procedure needed
```

---

## On-Call Self-Care

### During Your Shift

- **Sleep**: Get good sleep before going on-call
- **Caffeine**: Reasonable use (avoid overdose)
- **Stress**: Normal to feel pressure, it's expected
- **Breaks**: Take breaks if incident resolved, don't stay vigilant 24/7
- **Ask for help**: Better to ask than struggle alone

### After Your Shift

- **Debrief**: 15-min handoff with next engineer
- **Documentation**: Update runbooks with lessons learned
- **Reflection**: What went well? What was hard?
- **Rest**: Take next day a bit easier if major incident

### Managing Burnout

- **One week on / one week off**: Typical rotation
- **Share the load**: Multiple engineers in rotation
- **Compensation**: Extra pay for on-call hours
- **Feedback**: Tell manager if rotations too frequent

---

## Useful Links

**Documentation**:
- [Deployment Runbook](./RUNBOOK-DEPLOYMENT.md)
- [Troubleshooting Guide](./RUNBOOK-TROUBLESHOOTING.md)
- [Monitoring Guide](./RUNBOOK-MONITORING.md)
- [Infrastructure Guide](../infrastructure/README.md)

**External**:
- [Incident Tracker](https://github.com/basset-hound/browser/issues)
- [Status Page](https://status.basset-hound.example.com)
- [Runbook Repo](https://github.com/basset-hound/operations-runbooks)
- [Team Calendar](https://calendar.google.com/basset-hound-oncall)

**Support Contacts**:
- **Slack**: @ops-oncall
- **PagerDuty**: [Link to instance]
- **Email**: ops-oncall@basset-hound.example.com
- **Phone**: See on-call schedule

---

## Quick Reference Card

Print and keep at desk:

```
BASSET HOUND BROWSER - ON-CALL QUICK REFERENCE

EMERGENCY NUMBERS:
  Slack: @ops-oncall
  Manager: See on-call schedule
  IC: Page @incident-commander

CRITICAL THRESHOLDS:
  Memory: > 85% = RESTART
  CPU: > 70% = INVESTIGATE
  Disk: > 90% = CLEANUP
  Error Rate: > 2% = ALERT

QUICK FIXES:
  Service Down → docker restart basset-hound-browser
  High Memory → Restart + Increase allocation
  Port Error → sudo firewall-cmd --add-port=8765/tcp
  Disk Full → find /app/logs -mtime +7 -delete

ESCALATION:
  Stuck 15 min (P1) → Page @senior-oncall
  Stuck 30 min (P2) → Page @senior-oncall
  Customer Impact > 1h → Page @manager

USEFUL COMMANDS:
  basset-quick-check
  docker logs basset-hound-browser | tail -50
  kubectl get pods -n basset-hound
  curl http://localhost:8765/health
```

---

## Feedback

Help us improve this handbook:

- What scenarios did we miss?
- What was unclear?
- What worked well during your shift?
- What would have helped?

Feedback form: [Link to form]
