# Basset Hound Browser v12.0.0 - Alert Configuration & Escalation

**Version:** 1.0  
**Date:** May 11, 2026  
**Status:** Production Ready

## Overview

This document defines alert thresholds, severities, escalation procedures, and notification routing for production monitoring. Alerts are classified into three severity levels with corresponding response times and escalation paths.

---

## 1. ALERT SEVERITY LEVELS

### CRITICAL (P0)
**Response Time:** Immediate (0-5 minutes)  
**Escalation:** Page immediately (SMS + Call)  
**Impact:** Service degradation or potential outage  
**Notification:** All channels

**Actions:**
- Immediate on-call engineer notification
- Automatic incident creation
- Automated remediation attempts (if applicable)
- Status page update

---

### HIGH (P1)
**Response Time:** Urgent (5-15 minutes)  
**Escalation:** Escalate within 15 minutes  
**Impact:** Significant performance degradation or potential issues  
**Notification:** Slack + Email + PagerDuty

**Actions:**
- Prompt investigation required
- Manual incident review within 30 minutes
- Potential manual intervention needed
- Monitor trend closely

---

### MEDIUM (P2)
**Response Time:** Standard (15-60 minutes)  
**Escalation:** Log and review within 4 hours  
**Impact:** Minor degradation or anomaly detected  
**Notification:** Email + Slack

**Actions:**
- Review metrics trends
- Investigate pattern changes
- Plan remediation if needed
- Document for post-incident review

---

### INFO
**Response Time:** None (monitoring only)  
**Escalation:** None (informational only)  
**Impact:** No service impact, informational only  
**Notification:** Dashboard/logs only

**Actions:**
- Track trends
- Use for capacity planning
- Document for analysis

---

## 2. CRITICAL ALERTS (IMMEDIATE PAGE)

### C1: Service Down
```
Condition:   WebSocket server not responding
Threshold:   Cannot establish connection
Duration:    2 consecutive failed health checks (60 seconds)
Severity:    CRITICAL
Action:      Restart service, check logs, page on-call immediately
```

**Detection Script:**
```javascript
healthCheck.fail() 
  → count > 1 in 60s 
  → CRITICAL alert
```

---

### C2: Error Rate Exceeds 5%
```
Condition:   Error rate too high
Threshold:   > 5% of requests failing
Duration:    Sustained for 1 minute
Severity:    CRITICAL
Action:      Investigate error logs, potential cascading failure
Notify:      All channels (SMS, call, email)
```

**Detection:**
```
error_rate = (failed_commands / total_commands) * 100
if error_rate > 5% for 60 seconds:
  → CRITICAL alert
```

**Sample Alert Message:**
```
🚨 CRITICAL: Error Rate Spike
Error Rate: 8.3%
Duration: 1m 15s
Failed Commands: 427 / 5,134
Service: Basset Hound Browser v12.0.0
Action: Immediate investigation required
Links: Dashboard | Logs | Runbook
```

---

### C3: Success Rate Below 95%
```
Condition:   Success rate critical
Threshold:   < 95% success
Duration:    Sustained for 2 minutes
Severity:    CRITICAL
Action:      Broad failure, likely systemic issue
Notify:      All channels
```

**Detection:**
```
success_rate = 100 - error_rate
if success_rate < 95% for 120 seconds:
  → CRITICAL alert
```

---

### C4: Memory Usage Exceeds 80%
```
Condition:   Heap exhaustion risk
Threshold:   > 80% of heap limit (400MB+ on 512MB)
Duration:    Sustained for 2 minutes
Severity:    CRITICAL
Action:      Potential crash imminent, restart or force GC
Notify:      All channels
```

**Detection:**
```
heap_percent = (heapUsed / heapLimit) * 100
if heap_percent > 80% for 120 seconds:
  → CRITICAL alert
```

**Auto-Remediation:**
- Attempt aggressive GC
- Clear screenshot cache
- Disconnect non-essential clients
- If still > 85% after 30s: Restart service

---

### C5: Latency Spike (P99 > 2000ms)
```
Condition:   Extreme latency burst
Threshold:   P99 > 2000ms for any operation
Duration:    Sustained for 1 minute
Severity:    CRITICAL (operation dependent)
Action:      Identify bottleneck, may affect critical operations
Notify:      All channels
```

**Detection:**
```
p99_latency = percentile(latencies, 99)
if p99_latency > 2000ms for 60 seconds:
  → CRITICAL alert (context-dependent)
```

**Note:** Navigation operations baseline ~3s (network-bound), so higher threshold acceptable.

---

### C6: File Descriptor Exhaustion
```
Condition:   OS resource limit approaching
Threshold:   > 95% of open file descriptors
Duration:    Any sustained period
Severity:    CRITICAL
Action:      Close connections, investigate leaks, restart if needed
Notify:      All channels
```

**Detection:**
```
fd_percent = (open_files / file_limit) * 100
if fd_percent > 95%:
  → CRITICAL alert
```

---

## 3. HIGH ALERTS (ESCALATE IN 15 MIN)

### H1: Latency P99 > 1000ms
```
Condition:   High latency detected
Threshold:   P99 > 1000ms
Duration:    Sustained for 2 minutes
Severity:    HIGH
Action:      Investigate cause, may degrade user experience
Notify:      Slack + Email + PagerDuty
```

**Detection:**
```
p99_latency = percentile(latencies, 99)
if p99_latency > 1000ms for 120 seconds:
  → HIGH alert
```

**Context-Aware Thresholds:**
```
Operation Type    | Threshold | Note
─────────────────────────────────────────
Navigation       | 3000ms    | Network-bound
Screenshot       | 1000ms    | Compute-intensive
Fill/Type        | 500ms     | Sensitive
Evasion ops      | 800ms     | Variable
Status/Ping      | 100ms     | Quick operations
```

---

### H2: Throughput Drop > 20%
```
Condition:   Significant throughput reduction
Threshold:   Current throughput < 80% of 5-minute baseline
Duration:    Sustained for 2 minutes
Severity:    HIGH
Action:      Investigate bottleneck, may indicate resource contention
Notify:      Slack + Email
```

**Detection:**
```
baseline_throughput = throughput_5m_ago
current_throughput = throughput_now
drop_percent = ((baseline - current) / baseline) * 100
if drop_percent > 20% for 120 seconds:
  → HIGH alert
```

---

### H3: CPU Usage > 85%
```
Condition:   High CPU utilization
Threshold:   > 85% for extended period
Duration:    Sustained for 3 minutes
Severity:    HIGH
Action:      May impact responsiveness, consider scaling
Notify:      Slack + Email
```

**Detection:**
```
cpu_percent = process_cpu_usage()
if cpu_percent > 85% for 180 seconds:
  → HIGH alert
```

**Auto-Remediation:**
- Notify scaling system to prepare for horizontal scaling
- Log detailed CPU profiles
- Trigger performance investigation

---

### H4: Memory Growth Rate > 6 MB/hour
```
Condition:   Unusual memory growth
Threshold:   > 6 MB/hour (3x normal rate)
Duration:    Detected over 1-hour window
Severity:    HIGH
Action:      Possible memory leak, investigate
Notify:      Slack + Email
```

**Detection:**
```
current_memory = process.memoryUsage().heapUsed
memory_1h_ago = history.get(time - 3600s)
growth_rate = (current - memory_1h_ago) / 60 (MB/min)
if growth_rate > 0.1 MB/min for extended period:
  → HIGH alert
```

---

### H5: Service Component Unresponsive
```
Condition:   Critical component not responding
Threshold:   Health check timeout (>5 seconds)
Duration:    2 consecutive failures
Severity:    HIGH
Action:      Component failure, restart component
Notify:      Slack + Email + Page
```

**Components:**
- WebSocket server
- Screenshot engine
- Recording manager
- Proxy manager
- Fingerprint engine
- Cache system

**Detection:**
```
component_health_check()
if timeout > 5s or 2 failures:
  → HIGH alert
  → Attempt auto-recovery
```

---

### H6: Connection Pool Exhaustion
```
Condition:   Approaching maximum connections
Threshold:   > 18 / 20 connections per instance
Duration:    Sustained for 1 minute
Severity:    HIGH
Action:      At capacity limits, traffic may be rejected
Notify:      Slack + Email
```

**Detection:**
```
active_connections = ws_server.clients.size
max_per_instance = 20
if active_connections > 18 for 60 seconds:
  → HIGH alert (scaling consideration)
```

---

## 4. MEDIUM ALERTS (LOG & REVIEW)

### M1: GC Pause Time > 100ms
```
Condition:   Excessive garbage collection pauses
Threshold:   > 100ms average per cycle
Duration:    Average over 10-minute window
Severity:    MEDIUM
Action:      Review heap allocation patterns, may cause jitter
Notify:      Email + Dashboard
```

**Detection:**
```
gc_pauses = collect(pause_times_10m)
avg_pause = mean(gc_pauses)
if avg_pause > 100ms:
  → MEDIUM alert
```

---

### M2: Cache Hit Rate < 10%
```
Condition:   Cache ineffective
Threshold:   < 10% hit rate over 1-hour window
Severity:    MEDIUM
Action:      Review cache configuration, may indicate misconfiguration
Notify:      Email
```

**Detection:**
```
hit_rate = (cache_hits / (cache_hits + misses)) * 100
if hit_rate < 10%:
  → MEDIUM alert
```

---

### M3: Evasion Effectiveness Drop > 5%
```
Condition:   Bot detection bypass rate declining
Threshold:   > 5% drop from baseline
Duration:    Detected over latest test cycle
Severity:    MEDIUM
Action:      Investigate detection method changes, update profiles
Notify:      Email + Dashboard
```

**Detection:**
```
baseline_effectiveness = effectiveness_previous_week
current_effectiveness = effectiveness_current
drop = baseline - current
if drop > 5%:
  → MEDIUM alert
```

---

### M4: Memory Growth Continuing (2-4 MB/hour normal)
```
Condition:   Memory trending upward (not abnormal but monitor)
Threshold:   If growth continues >1 hour
Severity:    MEDIUM
Action:      Review trends, monitor for extended leak patterns
Notify:      Email
```

**Detection:**
```
if memory_growth_sustained_1hr AND growth_rate > 2 MB/hour:
  → MEDIUM alert (trending)
```

---

### M5: Unusual Feature Usage Pattern
```
Condition:   Command distribution anomaly detected
Threshold:   >30% deviation from baseline distribution
Duration:    Sustained for 1 hour
Severity:    MEDIUM
Action:      May indicate bot activity or client misuse
Notify:      Email + Dashboard
```

**Detection:**
```
baseline_distribution = historical_command_distribution
current_distribution = current_hour_distribution
deviation = max_divergence(baseline, current)
if deviation > 30%:
  → MEDIUM alert (investigate)
```

---

### M6: Client Version Mismatch
```
Condition:   Old client versions still connecting
Threshold:   >10% of connections on deprecated version
Duration:    Sustained for 1 day
Severity:    MEDIUM
Action:      Plan deprecation strategy, notify users
Notify:      Email
```

**Detection:**
```
old_version_percent = (old_clients / total_clients) * 100
if old_version_percent > 10% for 24h:
  → MEDIUM alert
```

---

## 5. ESCALATION PROCEDURES

### Escalation Chain

```
Alert Severity → Notification Method → On-Call Assignment → Escalation
─────────────────────────────────────────────────────────────────────────

CRITICAL:
  1. Immediate SMS + Phone Call (0-5 min)
  2. PagerDuty incident creation
  3. Slack #incidents channel
  4. On-call primary contacted
  5. If no acknowledgment in 5 min → escalate to backup
  6. If no ack in 10 min → escalate to manager

HIGH:
  1. Slack notification to #incidents (0-2 min)
  2. Email to on-call team (5-10 min)
  3. PagerDuty incident (non-urgent)
  4. Expected response: 15 minutes
  5. If no acknowledgment → escalate

MEDIUM:
  1. Email notification (5 min)
  2. Slack #monitoring channel
  3. Expected review: 4 hours
  4. No escalation required

INFO:
  1. Dashboard/logs only
  2. Daily digest email
```

### Escalation Actions

**If On-Call Does Not Acknowledge (CRITICAL):**
1. Attempt phone call again (1 minute)
2. SMS reminder (2 minutes)
3. Page backup on-call (3 minutes)
4. Notify manager (4 minutes)
5. Auto-escalate to senior engineer if still unacknowledged

---

## 6. ALERT ROUTING

### Alert Destination Matrix

```
Severity | PagerDuty | Slack       | Email           | SMS/Call
─────────────────────────────────────────────────────────────────
CRITICAL | Urgent    | #incidents  | oncall@...      | YES
HIGH     | Normal    | #incidents  | oncall@...      | NO
MEDIUM   | No        | #monitoring | team@...        | NO
INFO     | No        | No          | daily digest    | NO
```

### Slack Channels

- `#incidents` - All CRITICAL and HIGH alerts
- `#monitoring` - MEDIUM alerts and trends
- `#deployments` - Deployment status alerts
- `#evasion-effectiveness` - Evasion metric trends

### Email Recipients

- `oncall@basset-hound.internal` - All CRITICAL/HIGH
- `team@basset-hound.internal` - MEDIUM alerts
- `monitoring@basset-hound.internal` - Daily digest
- `leadership@basset-hound.internal` - Critical incidents

### PagerDuty Integration

- **Urgent:** CRITICAL alerts → immediate notification
- **Normal:** HIGH alerts → standard scheduling
- **Info:** MEDIUM alerts → no incident creation

---

## 7. ALERT NOTIFICATION TEMPLATES

### CRITICAL Alert Example

```
🚨 CRITICAL ALERT - IMMEDIATE ACTION REQUIRED

Service:     Basset Hound Browser v12.0.0
Alert:       Error Rate Exceeds 5%
Severity:    CRITICAL
Timestamp:   2026-05-11T14:35:22Z
Duration:    1m 15s

Metrics:
  • Error Rate: 8.3% (>5% threshold)
  • Failed Commands: 427 / 5,134
  • Last Success: 30s ago
  • Trend: INCREASING

Affected Operations:
  • Navigation: 12.5% error rate
  • Screenshot: 5.3% error rate
  • Content extraction: 8.1% error rate

Recent Errors:
  [Error samples from last 5 minutes]

Recommended Actions:
  1. Investigate /var/log/basset-hound/error.log
  2. Check service health dashboard
  3. Review metrics in Grafana
  4. Consider restart if unresponsive

Links:
  → Incident Dashboard: https://...
  → Grafana Metrics: https://...
  → Runbook: https://...
  → Logs: https://...

On-Call: [Name] | Backup: [Name]
Acknowledge: /ack [incident-id]
Silence: /silence [incident-id] 15m
```

---

### HIGH Alert Example

```
⚠️  HIGH ALERT - Urgent Investigation Needed

Service:     Basset Hound Browser v12.0.0
Alert:       P99 Latency Spike
Severity:    HIGH
Timestamp:   2026-05-11T14:35:22Z

Metrics:
  • P99 Latency: 1,245ms (>1000ms threshold)
  • P95 Latency: 892ms
  • Average Latency: 145ms
  • Affected Operations: Screenshots, Navigation

Duration:    2m 30s sustained

Potential Causes:
  • Screenshot encoding bottleneck (30-40% of latency)
  • Memory pressure (check GC frequency)
  • High concurrent load (20+ clients)
  • Disk I/O for recording

Suggested Investigation:
  1. Review CPU/memory graphs
  2. Check active session count
  3. Inspect GC pause frequency
  4. Monitor disk I/O for recording

Links:
  → Dashboard: https://...
  → Logs: https://...
```

---

### MEDIUM Alert Example

```
ℹ️  MEDIUM ALERT - Review & Monitor

Service:     Basset Hound Browser v12.0.0
Alert:       Memory Growth Rate High
Severity:    MEDIUM
Timestamp:   2026-05-11T14:35:22Z

Metrics:
  • Growth Rate: 6.2 MB/hour (>6 MB threshold)
  • Current Heap: 385MB / 512MB (75%)
  • Trend: Gradual increase over 2 hours
  • GC Pause: Normal (avg 52ms)

Assessment:
  Slightly elevated growth, but within manageable range.
  Monitor for continuation. Could indicate minor leak or
  heavy session activity.

Recommended Actions:
  1. Monitor for next 2 hours
  2. Check session creation rate
  3. If continues >6 hours, investigate for leak
  4. Plan for potential restart if >90% heap

Links:
  → Memory Trend: https://...
  → Session Details: https://...
```

---

## 8. ALERT SUPPRESSION & MAINTENANCE

### Planned Maintenance

```
When suppressing alerts for maintenance:

1. Use dashboard to set maintenance window
2. Suppress ALL alerts for affected service
3. Document reason and expected duration
4. Post in Slack #incidents before starting
5. Resume all monitoring when complete
6. Document actual duration in incident log
```

### Flapping Alert Prevention

```
Rules for alert state changes:

1. Require threshold breach for minimum duration before alerting
2. Require recovery duration before clearing alert
3. Hysteresis: Different thresholds for trigger vs. clear

Example:
  • Alert on: Error rate > 5% for 60 seconds
  • Clear on: Error rate < 3% for 120 seconds (hysteresis)
  • This prevents rapid alert cycling
```

### Alert Tuning Thresholds

If alert triggers more than 5 times per day (without actual issues):
- Review threshold appropriateness
- Check for environmental changes
- Adjust threshold after incident review
- Document tuning decisions

---

## 9. INCIDENT RESPONSE QUICK REFERENCE

### Response Times SLA

```
Severity | Ack Time | Investigation Start | Resolution Target
──────────────────────────────────────────────────────────────
CRITICAL | 5 min    | Immediate          | 15 min or escalate
HIGH     | 15 min   | 15 min             | 60 min
MEDIUM   | 4 hours  | 4 hours            | 24 hours
```

### Quick Troubleshooting Checklist

**Service Down (C1):**
- [ ] Check if process is running: `ps aux | grep basset`
- [ ] Check logs for errors: `tail -f /var/log/basset-hound/`
- [ ] Check port availability: `lsof -i :8765`
- [ ] Restart service: `systemctl restart basset-hound`
- [ ] Check health endpoint: `curl http://localhost:8765/health`

**Error Rate High (C2):**
- [ ] Check error logs: `tail -100 /var/log/basset-hound/error.log`
- [ ] Identify error pattern
- [ ] Check memory/CPU: `top -p [pid]`
- [ ] Check connection count
- [ ] If memory issue: GC or restart
- [ ] If connection issue: Close old connections

**Memory Issue (C4):**
- [ ] Current heap usage: `node --inspect` → DevTools
- [ ] Force GC: `/admin/gc` endpoint
- [ ] Clear screenshot cache: `/admin/clear-cache`
- [ ] Check for leaks: Heap snapshot comparison
- [ ] If >85%: Restart service

---

## 10. POST-INCIDENT REVIEW

### Required for All Alerts

```
After an alert incident resolves:

1. Root Cause Analysis (within 24 hours)
   - What caused the alert?
   - Why wasn't it prevented?
   - Could it happen again?

2. Timeline Reconstruction
   - When did problem start?
   - When was alert triggered?
   - When was it resolved?
   - Alert latency acceptable?

3. Action Items
   - Code fixes needed?
   - Configuration changes needed?
   - Process improvements needed?
   - Alert tuning needed?

4. Documentation
   - Update runbook if needed
   - Document lessons learned
   - Share findings with team
```

---

## 11. ALERT CONFIGURATION CHECKLIST

- [ ] All alert thresholds set per section 2-5
- [ ] Escalation contacts configured in PagerDuty
- [ ] Slack integrations configured
- [ ] Email recipients verified
- [ ] SMS provider configured
- [ ] Alert suppression rules configured
- [ ] Maintenance window procedures documented
- [ ] Runbooks linked in alert templates
- [ ] Team trained on alert response procedures
- [ ] Alert testing conducted (dry-run)
- [ ] Performance baseline metrics validated
- [ ] Alert evaluation rules configured in monitoring system

---

## Appendix: Alert Testing Procedures

### Test Critical Alert Flow

```bash
# 1. Trigger synthetic error condition
curl -X POST http://localhost:8765/admin/test-error-spike

# 2. Monitor alert firing (should appear within 60s)
# - Check PagerDuty
# - Check Slack #incidents
# - Check email
# - Check SMS (if SMS configured)

# 3. Acknowledge alert
/ack [incident-id]

# 4. Resolve condition
curl -X POST http://localhost:8765/admin/clear-test-error

# 5. Verify alert clears (should clear within 120s)
```

### Test Escalation Flow

```bash
# 1. Create high-severity alert (long-duration)
# 2. Verify on-call gets notification
# 3. Intentionally don't acknowledge for 5 min
# 4. Verify escalation to backup on-call
# 5. Acknowledge from backup
# 6. Verify escalation chain worked correctly
```

---

**Document Version:** 1.0  
**Last Updated:** May 11, 2026  
**Status:** Ready for Implementation
