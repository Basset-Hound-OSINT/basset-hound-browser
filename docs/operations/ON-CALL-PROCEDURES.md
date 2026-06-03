# Basset Hound Browser - On-Call Procedures

**Document Version:** 1.0  
**Last Updated:** June 2, 2026  
**Classification:** Internal Operations

---

## Table of Contents

1. [Overview](#overview)
2. [On-Call Responsibilities](#on-call-responsibilities)
3. [Contact Information](#contact-information)
4. [On-Call Rotation](#on-call-rotation)
5. [Alert Response Procedures](#alert-response-procedures)
6. [Incident Escalation](#incident-escalation)
7. [Service Recovery](#service-recovery)
8. [Post-Incident Actions](#post-incident-actions)
9. [Runbooks by Alert Type](#runbooks-by-alert-type)

---

## Overview

This document defines the on-call procedures for the Basset Hound Browser service. The on-call engineer is responsible for responding to and resolving production incidents that impact service availability or performance.

**Key Principles:**
- **Response Speed:** Target <5 minutes to initial response
- **Escalation:** Clear criteria for when to escalate
- **Documentation:** All incidents logged for post-mortem analysis
- **Communication:** Timely updates to stakeholders
- **Learning:** Every incident becomes a lesson learned

---

## On-Call Responsibilities

### Primary Responsibilities

1. **Monitor Service Health**
   - Watch monitoring dashboards during on-call hours
   - Respond to automated alerts within 5 minutes
   - Assess incident severity
   - Initiate incident response procedures

2. **Initial Triage**
   - Determine if issue is service-related
   - Identify affected systems/users
   - Check for known issues/scheduled maintenance
   - Gather initial diagnostic information

3. **Incident Management**
   - Document incident start time
   - Communicate status to stakeholders
   - Follow incident response procedures
   - Escalate when necessary

4. **Knowledge Sharing**
   - Review runbooks during on-call period
   - Familiarize with recent changes
   - Update runbooks with new information
   - Share learnings with team

### During On-Call

**Must Be Available:**
- Respond to alerts within 5 minutes
- Have laptop/workstation accessible
- Have stable internet connection
- Be able to SSH into production systems

**Should Know:**
- How to check service status
- How to read monitoring dashboards
- Basic troubleshooting commands
- When and how to escalate

**Must Have:**
- Contact list for escalation
- List of runbooks
- Access credentials
- Communication channels open

---

## Contact Information

### Primary Contacts

| Role | Name | Phone | Slack | Email |
|------|------|-------|-------|-------|
| On-Call (L1) | *Assigned Rotation* | See Schedule | #oncall | oncall@basset-hound.io |
| Engineering Lead | *TBD* | See Schedule | @engineering | engineering@basset-hound.io |
| Infrastructure Lead | *TBD* | See Schedule | @infrastructure | infra@basset-hound.io |
| Product Manager | *TBD* | See Schedule | @product | product@basset-hound.io |

### Escalation Contacts

| Level | Title | Availability | Response Time |
|-------|-------|--------------|---|
| L1 | On-Call Engineer | 24/7 | <5 min |
| L2 | Engineering Lead | Business + on-call | <15 min |
| L3 | Infrastructure Lead | On-call | <30 min |
| Executive | Director of Engineering | On-call only | <1 hour |

### External Contacts

- **Hosting Provider Support:** [Support Portal](https://support.example.com)
- **Network Provider:** [Contact Info]
- **Security Team:** security@basset-hound.io

---

## On-Call Rotation

### Rotation Schedule

**Current Rotation (Weekly):**

| Week | Engineer | Start Date | End Date | Backup |
|------|----------|-----------|----------|--------|
| Week 1 | Engineer A | Mon 00:00 | Sun 23:59 | Engineer B |
| Week 2 | Engineer B | Mon 00:00 | Sun 23:59 | Engineer C |
| Week 3 | Engineer C | Mon 00:00 | Sun 23:59 | Engineer A |

**Schedule Link:** [PagerDuty Schedule](https://basset-hound.pagerduty.com)

### Handoff Procedure

**When Starting On-Call:**
1. Review incidents from previous week
2. Check for known issues in progress
3. Review recent deployments
4. Verify monitoring dashboards
5. Test alert notification system
6. Update status in #oncall channel

**When Ending On-Call:**
1. Brief incoming on-call engineer
2. Share list of outstanding issues
3. Provide contact info for follow-ups
4. Document any configuration changes
5. Close any documentation PRs

### Backup On-Call

- Backup takes over if primary is unavailable
- Backup should monitor even if not primary
- Backup becomes primary for >30 min absence
- Backup has full escalation authority

---

## Alert Response Procedures

### Initial Response

**Upon Alert Receipt (do this immediately):**

1. **Acknowledge Alert** (within 1 minute)
   ```bash
   # Acknowledge in PagerDuty/monitoring system
   # This prevents double-escalation
   ```

2. **Check Context** (within 2 minutes)
   - What is the alert about? (Check alert name, metric value)
   - When did it start? (Check alert timestamp)
   - What is normal? (Check historical baseline)
   - Is this a known issue? (Check incident tracker)

3. **Assess Severity** (within 3 minutes)
   - **P1:** Service down, data loss risk, security breach → Escalate immediately
   - **P2:** Degraded performance, partial service outage → Escalate if unresolved in 10min
   - **P3:** Minor issue, not customer-facing → Continue investigating
   - **P4:** Non-urgent maintenance, informational → Document and resolve

4. **Take Action** (depends on severity)
   - P1: Escalate immediately, then investigate
   - P2: Investigate for 10 minutes, then escalate
   - P3/P4: Investigate and resolve

### Investigation Checklist

- [ ] Access monitoring dashboard
- [ ] Check service health endpoint
- [ ] Review recent logs (last 15 minutes)
- [ ] Check for recent deployments
- [ ] Verify network connectivity
- [ ] Check resource usage (CPU, memory, disk)
- [ ] Review recent configuration changes
- [ ] Check external dependencies

### Communication During Incident

**Initial Alert (at T+5 minutes):**
```
Alert: [Service Name] - [Alert Type]
Severity: [P1/P2/P3/P4]
Status: Investigating
```

**Every 10 Minutes (for P1/P2):**
```
Update: [Progress description]
Time since incident: [X minutes]
Next action: [What we're trying next]
ETA for resolution: [Best estimate]
```

**Resolution (upon fix):**
```
Resolved: [Service Name] - [Issue Description]
Root cause: [Brief explanation]
Time to resolution: [X minutes]
Temporary vs permanent fix: [Description]
```

### Escalation Procedure

**Criteria for Escalating to L2:**

1. **Time-based:** No progress after 10 minutes
2. **Severity-based:** Any P1 incident
3. **Expertise-based:** Issue requires specialized knowledge
4. **Authorization-based:** Need production access you don't have

**How to Escalate:**

1. Call L2 engineering lead immediately
2. Provide: Service name, alert type, investigation summary
3. Stay on call with L2 (don't hang up)
4. Brief L2 on everything you've tried
5. Follow L2's instructions

**Escalation Message Template:**
```
I'm escalating [Service] incident to L2.

Symptoms: [What's failing]
Severity: [P1/P2]
Investigation so far: [What we've checked]
Current status: [Running command / Waiting for result]

Can you take over?
```

---

## Service Recovery

### Recovery Procedures

#### For WebSocket API Incidents

1. **Check API Server Status**
   ```bash
   curl -s http://localhost:8765/health | jq .
   ```

2. **Verify Process is Running**
   ```bash
   ps aux | grep websocket
   ```

3. **Check Resource Usage**
   ```bash
   # CPU and memory
   top -p $(pgrep -f websocket)
   ```

4. **Review Recent Logs**
   ```bash
   tail -f /var/log/basset-hound/websocket.log
   ```

5. **Restart if Necessary**
   ```bash
   systemctl restart basset-hound-websocket
   ```

6. **Verify Recovery**
   ```bash
   # Wait 30 seconds for startup
   sleep 30
   curl -s http://localhost:8765/health
   ```

#### For Docker Container Incidents

1. **Check Container Status**
   ```bash
   docker ps -a | grep basset-hound
   docker logs basset-hound-browser
   ```

2. **Restart Container**
   ```bash
   docker restart basset-hound-browser
   ```

3. **Verify Health**
   ```bash
   docker exec basset-hound-browser /healthcheck.sh
   ```

4. **If Restart Fails**
   ```bash
   # Check available space
   df -h
   # Clean up old images/containers
   docker system prune -a --volumes
   # Redeploy
   ./scripts/redeploy.sh
   ```

#### For Database/Storage Incidents

1. **Check Disk Space**
   ```bash
   df -h /data
   df -h /var/log
   ```

2. **Clean Up Old Data**
   ```bash
   # Remove old logs (>30 days)
   find /var/log/basset-hound -name "*.log" -mtime +30 -delete
   ```

3. **Verify Permissions**
   ```bash
   ls -la /data/
   chown -R basset:basset /data
   ```

4. **Restart Affected Services**
   ```bash
   systemctl restart basset-hound-*
   ```

#### For High Load Incidents

1. **Identify Heavy Consumers**
   ```bash
   # Check WebSocket connections
   ss -tnap | grep 8765
   # Check process memory
   ps aux --sort=-%mem | head -10
   ```

2. **Rate Limit Aggressive Clients**
   ```bash
   # Identify by IP
   # Add to rate limit configuration
   ```

3. **Scale Resources (if available)**
   ```bash
   # Increase container limits
   docker update --memory=4g basset-hound-browser
   # Or scale horizontally
   kubectl scale deployment basset-hound --replicas=3
   ```

4. **Implement Graceful Degradation**
   ```bash
   # Enable response compression
   # Increase cache TTLs
   # Reduce logging verbosity
   ```

### Rollback Procedures

**If Recent Deployment Caused Issue:**

1. **Identify Last Known Good Version**
   ```bash
   git log --oneline -10
   git tag | grep -E '^v[0-9]' | sort -V | tail -5
   ```

2. **Rollback Application**
   ```bash
   # For Docker
   docker pull basset-hound:v12.0.0  # Last stable
   docker run -d --name basset-hound-browser-rollback ...
   
   # Or using deployment script
   ./scripts/deploy.sh --version v12.0.0
   ```

3. **Verify Rollback**
   ```bash
   curl -s http://localhost:8765/health | jq .version
   ```

4. **Notify Team**
   - Slack: #incident channel
   - Email: engineering@basset-hound.io
   - Message: Rolled back to v12.0.0 due to [issue]

---

## Post-Incident Actions

### Immediate Actions (T+0 to T+1 hour)

After resolving incident:

1. **Document Initial Details**
   - Service affected
   - Incident duration
   - Root cause (preliminary)
   - Actions taken
   - Temporary vs permanent fix

2. **Update Incident Tracker**
   - Create incident in Jira/GitHub
   - Tag with incident-postmortem label
   - Assign to on-call engineer

3. **Notify Stakeholders**
   - Slack #incident channel: Status update
   - Email to engineering: Summary
   - Message to product: Impact statement (if customer-facing)

### Follow-Up Actions (T+1 to T+24 hours)

1. **Conduct Postmortem**
   - Schedule within 24 hours
   - Invite: on-call engineer, engineering lead, relevant experts
   - Focus: What happened and why, not who's to blame

2. **Document Postmortem**
   - Timeline of events
   - Root cause analysis
   - Contributing factors
   - Action items to prevent recurrence
   - Lessons learned

3. **Create Action Items**
   - Add prevention measures to backlog
   - Assign owners and deadlines
   - Follow up in weekly standups

4. **Update Runbooks**
   - Add new troubleshooting steps
   - Update thresholds if needed
   - Add alert improvements

### Metrics to Track

- **MTTR:** Mean time to resolution
- **MTBF:** Mean time between failures
- **Alert Accuracy:** False alert rate
- **Escalation Rate:** % incidents needing L2+

---

## Runbooks by Alert Type

### Alert: WebSocket API Unavailable

**Severity:** P1 (Service Down)

**Symptoms:**
- API health endpoint returns error
- Connections fail to establish
- Timeout errors in logs

**Steps:**

1. Verify service is running
   ```bash
   systemctl status basset-hound-websocket
   ```

2. Check logs for errors
   ```bash
   tail -100 /var/log/basset-hound/websocket.log | grep ERROR
   ```

3. Check network connectivity
   ```bash
   netstat -tnap | grep 8765
   ```

4. Restart service
   ```bash
   systemctl restart basset-hound-websocket
   sleep 10
   curl http://localhost:8765/health
   ```

5. If still down, escalate to L2

**Escalation Criteria:** Still down after restart

---

### Alert: High CPU Usage (>80%)

**Severity:** P2 (Degraded Performance)

**Symptoms:**
- CPU utilization exceeds 80%
- Latency increases
- Response times slow down

**Steps:**

1. Check which process is using CPU
   ```bash
   top -b -n 1 | head -20
   ```

2. Check recent logs for expensive operations
   ```bash
   tail -50 /var/log/basset-hound/websocket.log
   ```

3. Identify if it's normal workload or anomaly
   ```bash
   # Compare to baseline
   date && vmstat 1 5
   ```

4. If anomaly, investigate:
   ```bash
   # Check active connections
   ss -tnap | grep 8765 | wc -l
   # Check slow queries if applicable
   ```

5. If can't identify cause in 10 minutes, escalate to L2

**Quick Fixes:**
- Increase process priority (if over-constrained)
- Restart services if memory is also high
- Enable request compression for high-load scenarios

---

### Alert: High Memory Usage (>85%)

**Severity:** P2 (Degraded Performance)

**Symptoms:**
- Memory utilization exceeds 85%
- OOM killer may be active
- Processes killed unexpectedly

**Steps:**

1. Check memory usage
   ```bash
   free -h
   ps aux --sort=-%mem | head -10
   ```

2. Check if any processes are leaking memory
   ```bash
   # Compare RSS over time
   ps aux | grep basset
   sleep 60
   ps aux | grep basset
   ```

3. If memory keeps growing, restart process
   ```bash
   systemctl restart basset-hound-websocket
   ```

4. Monitor after restart
   ```bash
   # Watch for 10 minutes
   watch -n 5 'free -h && echo && ps aux | grep basset'
   ```

5. If memory still growing, escalate to L2

**Quick Actions:**
- Clear application cache if available
- Close unnecessary connections
- Enable log rotation if logs are large

---

### Alert: Disk Space Low (<10%)

**Severity:** P1 (Critical)

**Symptoms:**
- Disk space warning
- Application can't write logs
- Services may crash

**Steps:**

1. Check disk usage
   ```bash
   df -h
   du -sh /var/log/*
   du -sh /data/*
   ```

2. Identify largest files
   ```bash
   find / -type f -size +1G 2>/dev/null
   ```

3. Clean up logs (safe operation)
   ```bash
   # Keep only last 7 days
   find /var/log/basset-hound -name "*.log" -mtime +7 -delete
   ```

4. Clean up container images/layers
   ```bash
   docker system prune -a
   ```

5. Monitor recovery
   ```bash
   df -h
   ```

6. If space still critical, escalate to L2

---

### Alert: High Error Rate (>1%)

**Severity:** P2 (Degraded Service)

**Symptoms:**
- Error rate exceeds 1% of requests
- Specific error types appearing
- User-facing timeouts or failures

**Steps:**

1. Check error logs
   ```bash
   tail -100 /var/log/basset-hound/websocket.log | grep ERROR
   ```

2. Identify error pattern
   ```bash
   # Count error types
   grep ERROR /var/log/basset-hound/websocket.log | sed 's/.*ERROR: //' | cut -d' ' -f1 | sort | uniq -c | sort -rn
   ```

3. Check if related to specific commands
   ```bash
   grep ERROR /var/log/basset-hound/websocket.log | jq .command | sort | uniq -c
   ```

4. If due to dependency failure, escalate to L2
5. If due to load, implement rate limiting
6. If due to bug, escalate to engineering

---

### Alert: API Response Latency High (>500ms)

**Severity:** P2 (Degraded Performance)

**Symptoms:**
- p50 latency exceeds 500ms
- p99 latency very high (>2 seconds)
- User complaints of slow responses

**Steps:**

1. Check current latency
   ```bash
   # From monitoring dashboard
   # Review p50, p99, p95 latencies
   ```

2. Check if correlated with load
   ```bash
   # Compare active connections
   ss -tnap | grep 8765 | wc -l
   ```

3. Check system resources
   ```bash
   vmstat 1 5
   iostat -x 1 5
   ```

4. If CPU/disk I/O high, that's likely cause
5. If resources normal, check for slow queries
6. If latency persists after 10 minutes, escalate

---

## Escalation Matrix

| Issue Type | P1 Threshold | P2 Threshold | P3 Threshold |
|-----------|--------------|--------------|--------------|
| Availability | Service down >1min | Service down <1min | Minor degradation |
| Latency | p99 >5s | p99 >2s, p50 >500ms | p99 >5s, rate <1% |
| Error Rate | >5% | >1% | >0.1% |
| CPU | >95% | >80% | >60% |
| Memory | OOM | >85% | >75% |
| Disk | <5% | <10% | <20% |

---

## Tools & Access

### Required Tools

- **Monitoring:** Datadog/Prometheus dashboard
- **Logs:** ELK Stack or equivalent
- **Alerting:** PagerDuty
- **Chat:** Slack for team communication
- **Repository:** GitHub for code/runbooks

### Required Access

- SSH to production servers
- Docker registry access
- Monitoring dashboard access
- Log aggregation system access
- Incident ticket system access

### Access Verification Checklist

Before on-call period starts:

- [ ] Can access monitoring dashboard
- [ ] Can view live logs
- [ ] Can SSH to servers
- [ ] Can access incident tracker
- [ ] Can view PagerDuty schedule
- [ ] Have all contact numbers

---

## Best Practices

1. **Stay Calm:** Panic leads to bad decisions
2. **Document:** Every step you take
3. **Communicate:** Update stakeholders every 10 minutes
4. **Don't Guess:** Check metrics before acting
5. **Escalate Early:** Better to escalate than to struggle
6. **Learn:** Every incident is a learning opportunity

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-02 | Engineering | Initial document |

---

**Last Review:** June 2, 2026  
**Next Review:** Q3 2026
