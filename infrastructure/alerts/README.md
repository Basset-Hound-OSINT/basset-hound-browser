# Alert Configuration - Basset Hound Browser
**Version:** 1.0  
**Date:** 2026-06-21  
**Status:** Production Ready

## Quick Start

### What's in this directory?

```
infrastructure/alerts/
├── prometheus-rules.yml              # Prometheus alert rule definitions (57 rules)
├── alertmanager.yml                  # Alert routing and notification config
├── README.md                         # This file
├── ALERT-JUSTIFICATIONS.md           # Threshold rationales and baseline metrics
├── NOTIFICATION-CHANNELS.md          # Channel setup (SMS, PagerDuty, Slack, Email)
├── ESCALATION-PROCEDURES.md          # Escalation timelines and contact info
└── ALERT-TESTING-PROCEDURES.md       # Testing and validation procedures
```

### Deploy Alerts

```bash
# 1. Load Prometheus rules into Prometheus
cp infrastructure/alerts/prometheus-rules.yml /etc/prometheus/rules/

# 2. Configure Alertmanager
cp infrastructure/alerts/alertmanager.yml /etc/alertmanager/

# 3. Set required environment variables
export SLACK_WEBHOOK_INCIDENTS="https://hooks.slack.com/..."
export PAGERDUTY_CRITICAL_KEY="..."
export SENDGRID_API_KEY="..."
export TWILIO_ACCOUNT_SID="..."

# 4. Reload Prometheus & Alertmanager
systemctl restart prometheus alertmanager
```

### Test Alerts

```bash
# Verify Prometheus rules syntax
promtool check rules infrastructure/alerts/prometheus-rules.yml

# Test CRITICAL alert flow
curl -X POST http://localhost:8765/admin/test-alert \
  -d '{"severity":"critical"}'

# Monitor for notifications (check Slack, email, PagerDuty)
```

---

## Alert Summary

### By Severity

| Severity | Count | Examples | Response Time |
|----------|-------|----------|---|
| **CRITICAL** | 6 | Service down, Error rate >5%, Memory >80% | 0-5 min |
| **HIGH** | 7 | Latency spike, CPU high, Throughput drop | 5-15 min |
| **MEDIUM** | 7 | Memory growth, GC pauses, Cache issues | 15-60 min |
| **OPERATIONAL** | 5 | Container restart, Disk space, Updates | Variable |
| **RECORDING** | 2 | Recording disk space, Encoding queue | Variable |
| **WEBSOCKET** | 3 | Connection churn, Message drops, Backpressure | 1-5 min |
| **EVASION** | 2 | Canvas/WebGL evasion drops | 1-24h |

**Total:** 32 active alert rules in production

### By Component

| Component | Alert Count | Importance |
|-----------|---|---|
| Core Service | 6 (critical) | P0 - Immediate |
| Performance | 8 (high/medium) | P1 - Urgent |
| System Resources | 6 (critical/high) | P0/P1 |
| Security | 3 (high/medium) | P1/P2 |
| Operations | 5 (medium) | P2 |
| Recording | 2 (medium/high) | P2/P1 |
| Evasion | 2 (medium) | P2 |

---

## Critical Alerts (P0) - Immediate Page

These require immediate on-call response. Page threshold is T+0 (immediate).

### C1: Service Down
- **Threshold:** 3 failed health checks (90 seconds)
- **SLA:** Acknowledge in <5 min
- **Impact:** Complete service unavailability
- **Auto-remediation:** None (requires manual restart)
- **Action:** Check logs, restart service, verify recovery

### C2: Error Rate > 5%
- **Threshold:** >5% of commands failing for 60 seconds
- **SLA:** Acknowledge in <5 min
- **Impact:** 95% SLA violated
- **Auto-remediation:** None
- **Action:** Investigate error logs, identify pattern, fix root cause

### C3: Success Rate < 95%
- **Threshold:** <95% success for 120 seconds
- **SLA:** Acknowledge in <5 min
- **Impact:** Systemic failure
- **Auto-remediation:** None
- **Action:** Same as C2 (complementary detection)

### C4: Memory > 80%
- **Threshold:** 80% of heap (410MB on 512MB) for 120 seconds
- **SLA:** Acknowledge in <5 min
- **Impact:** Risk of OOMKill
- **Auto-remediation:** Aggressive GC → cache clear → restart
- **Action:** Monitor auto-remediation, manual restart if fails

### C5: P99 Latency > 2000ms
- **Threshold:** P99 >2000ms for 60 seconds
- **SLA:** Acknowledge in <5 min
- **Impact:** Operations timeout, client appears hung
- **Auto-remediation:** None (investigate)
- **Action:** Check CPU/memory, identify bottleneck, optimize

### C6: File Descriptor Exhaustion
- **Threshold:** >95% of available FDs
- **SLA:** Acknowledge in <5 min
- **Impact:** Cannot accept new connections
- **Auto-remediation:** None
- **Action:** Check for FD leak, restart if needed

---

## High Alerts (P1) - Escalate in 15 min

These require investigation within 15 minutes. Escalate to backup on-call if not acknowledged.

| Alert | Threshold | Duration | Action |
|-------|-----------|----------|--------|
| P99 Latency > 1000ms | >1000ms | 2 min | Investigate CPU/memory |
| Throughput Drop | >20% drop | 2 min | Check for queuing/bottleneck |
| CPU > 85% | >85% utilization | 3 min | Monitor, prepare scaling |
| Memory Growth | >6 MB/hour | 1 hour | Monitor for leak |
| Component Unresponsive | 2 timeouts | 1 min | Restart component |
| Connection Pool > 90% | 90% full | 1 min | Consider scale-out |
| Rate Limit Spike | >50/min from IP | 1 min | Investigate source |

---

## Medium Alerts (P2) - Review in 4 hours

These are monitored but not urgent. Review within 4 hours.

| Alert | Threshold | Window | Action |
|-------|-----------|--------|--------|
| GC Pause Time | >100ms avg | 10 min | Tune heap/GC |
| Cache Hit Rate | <10% | 1 hour | Review cache config |
| Evasion Effectiveness Drop | >5% | 7-day baseline | Update profiles |
| Memory Growth Sustained | >2 MB/hour | 2 hour | Monitor for leak |
| Path Validation Failures | Any | 5 min | Check for attacks |
| Size Limit Violations | >10 in 5m | 5 min | Block bad IPs |
| Unusual Usage Patterns | >30% deviation | 1 hour | Investigate anomaly |

---

## Escalation Timeline

```
T+0     Alert fires → SMS + PagerDuty + Slack + Email
  ↓
T+5m    Check: Primary on-call acknowledged?
  ├─ YES → Investigation begins
  └─ NO → Phone call to primary

T+5m    If still no ack → SMS to backup on-call
  ↓
T+10m   Check: Anyone acknowledged?
  ├─ YES → Investigation begins
  └─ NO → Phone call to manager + PagerDuty escalation

T+15m   Director paged if still unresolved (CRITICAL only)

T+30m   Expected resolution target for HIGH alerts
T+60m   Expected resolution target for MEDIUM alerts
```

---

## Notification Channels

### CRITICAL Alerts Route to:
- **SMS** (0-30s) - Immediate phone notification
- **Phone Call** (0-60s) - If SMS not acknowledged
- **PagerDuty** (0-30s) - Incident creation + escalation
- **Slack** (#incidents) (0-10s) - Team visibility
- **Email** (30-60s) - Documentation

### HIGH Alerts Route to:
- **Slack** (#incidents) (0-10s)
- **PagerDuty** (standard routing)
- **Email** (30-60s)

### MEDIUM Alerts Route to:
- **Slack** (#monitoring) (0-10s)
- **Email** (batched, hourly)

### INFO/LOW Alerts Route to:
- **Dashboard** (real-time)
- **Email** (daily digest)

---

## Configuration Requirements

### 1. Slack Integration

```yaml
# Set these environment variables:
SLACK_WEBHOOK_INCIDENTS=https://hooks.slack.com/services/[TOKEN]
SLACK_WEBHOOK_MONITORING=https://hooks.slack.com/services/[TOKEN]
```

**Setup:**
- Create Slack app at api.slack.com
- Create incoming webhooks for #incidents and #monitoring channels
- Note the webhook URLs
- Add to Alertmanager config

### 2. PagerDuty Integration

```yaml
PAGERDUTY_CRITICAL_KEY=YOUR_SERVICE_KEY
PAGERDUTY_API_TOKEN=YOUR_API_TOKEN
```

**Setup:**
- Create PagerDuty service for Basset Hound Browser
- Create escalation policies (primary → backup → manager)
- Get integration keys
- Configure on-call rotation

### 3. Email (SMTP)

```yaml
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=${SENDGRID_API_KEY}
SMTP_FROM=alerts@basset-hound.io
```

**Setup:**
- Create SendGrid account (free tier available)
- Generate API key
- Add to alertmanager.yml

### 4. SMS/Phone (Twilio)

```yaml
TWILIO_ACCOUNT_SID=${ACCOUNT_SID}
TWILIO_AUTH_TOKEN=${AUTH_TOKEN}
TWILIO_PHONE_FROM=+1XXXXXXXXXX
TWILIO_PHONE_TO_ONCALL=+1YYYYYYYYYY
TWILIO_PHONE_TO_BACKUP=+1ZZZZZZZZZZ
```

**Setup:**
- Create Twilio account
- Verify phone numbers
- Buy SMS-capable number
- Add to alertmanager config

---

## Threshold Tuning

### If Alert Fires Too Often (>5x/day)

1. **Review baseline metrics**
   ```bash
   # Check recent metric values
   curl http://prometheus:9090/api/v1/query?query=[metric_name]
   ```

2. **Increase threshold by 10-20%**
   - Edit prometheus-rules.yml
   - Update `condition:` expression
   - Document change in ALERT-JUSTIFICATIONS.md

3. **Add hysteresis**
   - Different trigger vs. clear thresholds
   - Prevents rapid state flapping

4. **Test before deploying**
   ```bash
   promtool check rules infrastructure/alerts/prometheus-rules.yml
   ```

### If Alert Doesn't Fire (but should)

1. **Verify metric is being recorded**
   ```bash
   # Check if metric exists in Prometheus
   curl http://prometheus:9090/api/v1/query?query=up{job="basset-hound"}
   ```

2. **Lower threshold slightly**
3. **Check alert evaluation frequency** (default: 30s)
4. **Review PromQL expression** for errors

---

## Testing Checklist

Before deploying to production:

### Unit Tests
- [ ] All Prometheus rules syntax valid
- [ ] All alert expressions parse correctly
- [ ] All required annotations present
- [ ] Severity labels valid

### Integration Tests
- [ ] Each alert fires at correct threshold
- [ ] Each alert routes to correct channels
- [ ] Escalation chain works (5m, 10m, 15m)
- [ ] Alerts resolve when condition clears

### Manual Tests
- [ ] Test CRITICAL alert flow (SMS received)
- [ ] Test PagerDuty incident creation
- [ ] Test Slack message formatting
- [ ] Test email notification delivery
- [ ] Verify on-call can acknowledge from all channels

---

## Operational Procedures

### Daily Checks
```bash
# Check active alerts
curl http://prometheus:9090/api/v1/alerts

# Check Alertmanager status
curl http://alertmanager:9093/api/v1/status

# Verify no stuck/flapping alerts
curl http://alertmanager:9093/api/v1/alerts?active=true | jq '.data | length'
```

### Monthly Review
- [ ] Review alert firing frequency
- [ ] Check false positive rate
- [ ] Validate escalation contact info
- [ ] Run full escalation drill

### Quarterly Audit
- [ ] Update baselines with current performance data
- [ ] Review threshold appropriateness
- [ ] Audit coverage (any gaps?)
- [ ] Collect team feedback on alert quality

---

## Key Documents

| Document | Purpose | Audience |
|----------|---------|----------|
| **ALERT-JUSTIFICATIONS.md** | Why each threshold is set to that value | SREs, Managers |
| **NOTIFICATION-CHANNELS.md** | How to set up each notification channel | DevOps, SREs |
| **ESCALATION-PROCEDURES.md** | When and how to escalate | On-call, Managers |
| **ALERT-TESTING-PROCEDURES.md** | How to test alerts before deployment | QA, DevOps |

---

## Support & Questions

### Frequent Questions

**Q: Why did I get paged at 3 AM for a MEDIUM alert?**  
A: MEDIUM alerts should only go to email (batched). Check alertmanager routing rules. May have been misconfigured or a one-off test.

**Q: Can I silence an alert?**  
A: Yes, through Alertmanager UI or API. Silences are temporary and require reason documentation. Use for maintenance windows only.

**Q: The alert threshold is wrong for our environment. Can we change it?**  
A: Yes! Edit prometheus-rules.yml, test thoroughly, then deploy. Document the change with rationale in ALERT-JUSTIFICATIONS.md.

**Q: How do I test an alert without triggering false notifctions?**  
A: Use `/admin/test-alert` endpoint with staging environment. Or temporarily silence non-critical alerts.

---

## Monitoring the Monitors

To ensure alerts work, monitor them:

```bash
# Alert rule evaluation failures
alert_evaluation_failures_total

# Alert delivery latency
alert_dispatch_duration_seconds

# False positive rate (ratio of resolved immediately after firing)
rate(alerts_resolved_total[5m])

# Escalation success rate (escalated alerts that were resolved)
escalations_successful / escalations_total
```

Set meta-alerts if:
- Alert evaluation fails >5x/day
- Alert dispatch latency >30s
- False positive rate >10%
- Escalation success rate <95%

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-21 | Initial production deployment |

---

## Related Documentation

- `/docs/monitoring/` - Complete monitoring system docs
- `/docs/ALERT-CONFIGURATION.md` - Original alert configuration spec
- `/infrastructure/docker/docker-compose.prod.yml` - Production deployment config
- `/src/monitoring/alert-rules.js` - Node.js alert engine implementation

---

**Last Updated:** 2026-06-21  
**Maintained By:** SRE Team  
**Status:** Production - Active
