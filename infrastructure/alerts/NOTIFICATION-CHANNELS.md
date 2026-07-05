# Alert Notification Channels & Configuration
**Version:** 1.0  
**Date:** 2026-06-21  
**Status:** Production

## Overview

This document describes all alert notification channels, configuration requirements, and integration procedures for Basset Hound Browser production monitoring.

---

## Channel Matrix

| Channel | Severity Levels | Latency | Reliability | Cost | Auth |
|---------|-----------------|---------|-------------|------|------|
| **SMS/Phone** | CRITICAL | <30s | 99% | $0.05-0.10/alert | Twilio API |
| **PagerDuty** | CRITICAL, HIGH | <1m | 99.9% | Per incident | Service key |
| **Slack** | All | <10s | 99% | Free | Webhook URL |
| **Email** | HIGH, MEDIUM | 30-60s | 95% | Free | SMTP |
| **Webhook** | All | <5s | Variable | Free | HTTPS |
| **Dashboard** | All | Real-time | 99.9% | $0 | Web UI |

---

## 1. SMS & Phone Calls (CRITICAL ONLY)

### Purpose
Immediate escalation for critical, page-worthy alerts. Used for:
- Service down
- Cascading failures (error rate > 5%)
- Memory exhaustion
- File descriptor exhaustion

### Configuration

#### Option A: Twilio (Recommended)
```yaml
# Infrastructure config
SMS_PROVIDER: twilio
TWILIO_ACCOUNT_SID: ${TWILIO_ACCOUNT_SID}
TWILIO_AUTH_TOKEN: ${TWILIO_AUTH_TOKEN}
TWILIO_PHONE_FROM: '+1XXXXXXXXXX'
TWILIO_PHONE_TO_ONCALL: '+1YYYYYYYYYY'
TWILIO_PHONE_TO_BACKUP: '+1ZZZZZZZZZZ'
TWILIO_PHONE_TO_MANAGER: '+1MMMMMMMMMM'
```

#### Option B: AWS SNS
```yaml
SMS_PROVIDER: aws-sns
AWS_SNS_TOPIC_ARN: arn:aws:sns:region:account:basset-hound-critical
AWS_REGION: us-east-1
AWS_ACCESS_KEY_ID: ${AWS_KEY}
AWS_SECRET_ACCESS_KEY: ${AWS_SECRET}
```

### Message Template
```
🚨 CRITICAL: [Alert Name]
Service: Basset Hound Browser
Time: [Timestamp]
Action: Check Slack/email for details
Dashboard: [URL]
Respond: /ack [incident-id]
```

### Example SMS
```
🚨 CRITICAL: Service Down
Basset Hound Browser unavailable
Dashboard: monitoring.basset-hound.io
Time: 14:35 UTC
```

### Escalation Logic
```
1. SMS to on-call (immediate)
   ↓
2. If no response in 5 min → phone call to on-call
   ↓
3. If no acknowledgment in 5 min → SMS to backup
   ↓
4. If no acknowledgment in 3 min → phone call to backup
   ↓
5. If no acknowledgment in 5 min → alert manager
```

### Cost Estimate
- $0.05-0.08 per SMS
- $0.10 per minute for phone calls
- Expected: <5 critical alerts per month = $1-3/month

### Testing
```bash
# Test SMS
curl -X POST http://localhost:8765/admin/test-sms \
  -d '{"phone":"+1TESTPHONE","message":"TEST ALERT"}'

# Test phone call
curl -X POST http://localhost:8765/admin/test-call \
  -d '{"phone":"+1TESTPHONE"}'
```

---

## 2. PagerDuty Integration

### Purpose
Incident management and escalation tracking. Handles:
- CRITICAL alerts: Urgent incidents (immediate)
- HIGH alerts: Normal incidents (scheduled)
- Escalation policies
- On-call rotation
- Incident history

### Configuration

#### API Setup
```yaml
PAGERDUTY_INTEGRATION_KEY: ${PAGERDUTY_KEY}
PAGERDUTY_URGENT_ROUTING_KEY: ${URGENT_KEY}
PAGERDUTY_STANDARD_ROUTING_KEY: ${STANDARD_KEY}
PAGERDUTY_SERVICE_ID: ${SERVICE_ID}
PAGERDUTY_API_TOKEN: ${API_TOKEN}
```

#### Alertmanager Config
```yaml
pagerduty_configs:
  - service_key: '${PAGERDUTY_CRITICAL_KEY}'
    client: 'Basset Hound Alertmanager'
    client_url: '{{ .ExternalURL }}'
    details:
      firing: '{{ template "pagerduty.default.instances" .Alerts.Firing }}'
      severity: 'critical'
```

### PagerDuty Events

#### CRITICAL Alert Event
```json
{
  "routing_key": "${URGENT_KEY}",
  "event_action": "trigger",
  "dedup_key": "basset-hound-service-down",
  "payload": {
    "summary": "Basset Hound Browser - Service Down",
    "severity": "critical",
    "source": "Alertmanager",
    "timestamp": "2026-06-21T14:35:22Z",
    "component": "websocket-server",
    "custom_details": {
      "error_rate": "8.3%",
      "failed_commands": 427,
      "duration_seconds": 75,
      "dashboard_url": "https://grafana.basset-hound.io/d/xxx"
    }
  }
}
```

#### HIGH Alert Event
```json
{
  "routing_key": "${STANDARD_KEY}",
  "event_action": "trigger",
  "dedup_key": "basset-hound-high-latency",
  "payload": {
    "summary": "Basset Hound Browser - High Latency P99 > 1000ms",
    "severity": "error",
    "source": "Alertmanager",
    "timestamp": "2026-06-21T14:35:22Z",
    "component": "performance",
    "custom_details": {
      "p99_latency_ms": 1245,
      "threshold_ms": 1000,
      "duration_seconds": 150
    }
  }
}
```

### Escalation Policies

#### Primary On-Call Escalation
```
Trigger: CRITICAL alert
├─ 0 min: Page primary on-call (phone + SMS)
├─ 5 min: If not acknowledged → escalate to backup
├─ 10 min: If not acknowledged → escalate to manager
└─ 15 min: If not acknowledged → escalate to director
```

#### Secondary On-Call Escalation
```
Trigger: HIGH alert
├─ 0 min: Create incident, notify on-call
├─ 15 min: If not acknowledged → escalate
└─ 30 min: If not resolved → escalate to manager
```

### On-Call Rotation Setup
```
Team: Basset Hound Browser SRE
├─ Primary: Mon-Fri 9am-5pm (US/Eastern)
│  Name: [SRE Name]
│  Phone: [phone]
│  Email: [email]
│
├─ Backup: Always available
│  Name: [Backup Name]
│  Phone: [phone]
│  Email: [email]
│
└─ Weekend: Rotating SREs
   Contact: [manager email]
```

### Acknowledgment & Resolution

**Acknowledge an incident (from PagerDuty UI or API):**
```bash
curl -X PUT https://api.pagerduty.com/incidents/[incident_id] \
  -H 'Authorization: Token token=${PAGERDUTY_API_TOKEN}' \
  -d '{
    "incidents": [{
      "id": "[incident_id]",
      "status": "acknowledged"
    }]
  }'
```

**Resolve an incident:**
```bash
curl -X PUT https://api.pagerduty.com/incidents/[incident_id] \
  -H 'Authorization: Token token=${PAGERDUTY_API_TOKEN}' \
  -d '{
    "incidents": [{
      "id": "[incident_id]",
      "status": "resolved"
    }]
  }'
```

### Cost Estimate
- $29/month per on-call user (up to 3 users)
- Total: ~$87/month for 3 people

---

## 3. Slack Integration

### Purpose
Real-time alerting for all severities. Enables:
- Visible incident status
- Team coordination
- Quick links to dashboards/logs
- Alert acknowledgment buttons
- Historical records

### Configuration

#### Slack App Setup
1. Create Slack app at api.slack.com
2. Enable Incoming Webhooks
3. Create webhooks for each channel:
   - `#incidents` (CRITICAL + HIGH)
   - `#monitoring` (MEDIUM + INFO)
   - `#security-incidents` (Security)
   - `#infrastructure` (Ops)

#### Webhook URLs (environment vars)
```yaml
SLACK_WEBHOOK_INCIDENTS: https://hooks.slack.com/services/[TOKEN1]
SLACK_WEBHOOK_MONITORING: https://hooks.slack.com/services/[TOKEN2]
SLACK_WEBHOOK_SECURITY: https://hooks.slack.com/services/[TOKEN3]
SLACK_WEBHOOK_INFRASTRUCTURE: https://hooks.slack.com/services/[TOKEN4]
```

#### Alertmanager Slack Config
```yaml
slack_configs:
  - api_url: '${SLACK_WEBHOOK_INCIDENTS}'
    channel: '#incidents'
    title: '{{ if eq .Status "firing" }}🚨{{ else }}✅{{ end }} {{ .GroupLabels.severity | upper }}: {{ .GroupLabels.alertname }}'
    text: '{{ range .Alerts.Firing }}{{ .Annotations.description }}\n{{ end }}'
    send_resolved: true
    color: '{{ if eq .GroupLabels.severity "critical" }}danger{{ else }}warning{{ end }}'
    actions:
      - type: button
        text: 'Dashboard'
        url: '{{ (index .Alerts 0).Annotations.dashboard_url }}'
      - type: button
        text: 'Runbook'
        url: '{{ (index .Alerts 0).Annotations.runbook_url }}'
      - type: button
        text: 'Acknowledge'
        url: '{{ .ExternalURL }}/alerting/groups'
```

### Slack Message Template

#### CRITICAL Alert
```
🚨 CRITICAL: Service Down
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Service: Basset Hound Browser
Alert: WebSocket server not responding
Severity: CRITICAL

Metrics:
• Failed health checks: 3 consecutive
• Duration: 90 seconds
• Status: Ongoing

Affected: All clients
Impact: Service completely unavailable

Actions:
[Dashboard] [Runbook] [Acknowledge]

On-Call: [Name] | Page: [number]
Time: 14:35 UTC | Incident: [ID]
```

#### HIGH Alert
```
⚠️ HIGH: High Latency Detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Service: Basset Hound Browser
Alert: P99 Latency > 1000ms
Severity: HIGH

Metrics:
• P99 Latency: 1,245ms
• Threshold: 1,000ms
• Duration: 2m 30s sustained

Potential Causes:
• High concurrent load
• Memory pressure/GC pauses
• Disk I/O for recording

Response: Check resources, investigate bottleneck

Actions:
[Dashboard] [Logs] [Acknowledge]
```

#### MEDIUM Alert
```
ℹ️ MEDIUM: Memory Growth Rate High
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Service: Basset Hound Browser
Alert: Memory growth > 2 MB/hour
Severity: MEDIUM

Metrics:
• Growth rate: 2.3 MB/hour
• Current heap: 285MB / 512MB (55%)
• Duration: 2 hours sustained

Assessment:
Slightly elevated growth. Monitor for continuation.
Could indicate session buildup or minor leak.

Actions:
[Dashboard] [Memory Trends] [Review]
```

### Slack Channels

| Channel | Purpose | Alerts | Frequency |
|---------|---------|--------|-----------|
| `#incidents` | Emergency response | CRITICAL, HIGH | Immediate |
| `#monitoring` | General monitoring | MEDIUM, INFO | Batched |
| `#security-incidents` | Security issues | Security HIGH | Immediate |
| `#infrastructure` | Ops issues | Infra HIGH | Immediate |

### Interactive Features

#### Acknowledge from Slack
Add button that acknowledges alert in Alertmanager:
```json
{
  "type": "button",
  "text": "Acknowledge",
  "url": "https://alertmanager.basset-hound.io/api/v1/alerts/groups"
}
```

#### Silence from Slack
Add button to silence alert for 1 hour:
```json
{
  "type": "button",
  "text": "Silence 1h",
  "url": "https://alertmanager.basset-hound.io/api/v1/alerts/groups?silenceId=xxx"
}
```

### Cost Estimate
- Free (included in Slack workspace subscription)

---

## 4. Email Notifications

### Purpose
Documented record of alerts. Used for:
- HIGH and MEDIUM alerts
- Daily digest
- Escalation trail
- Compliance/audit

### Configuration

#### SMTP Setup (SendGrid)
```yaml
SMTP_HOST: smtp.sendgrid.net
SMTP_PORT: 587
SMTP_USER: apikey
SMTP_PASSWORD: ${SENDGRID_API_KEY}
SMTP_FROM: alerts@basset-hound.io
SMTP_TLS_REQUIRED: true
```

#### Alertmanager Email Config
```yaml
email_configs:
  - to: '${ONCALL_EMAIL}'
    from: 'alerts@basset-hound.io'
    smarthost: 'smtp.sendgrid.net:587'
    auth_username: 'apikey'
    auth_password: '${SENDGRID_API_KEY}'
    auth_identity: 'alerts@basset-hound.io'
    headers:
      Subject: '{{ .GroupLabels.severity | upper }}: {{ .GroupLabels.alertname }}'
    html: '{{ template "email.html" . }}'
```

### Email Templates

#### CRITICAL Alert Email
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .critical { color: #d32f2f; border-left: 4px solid #d32f2f; padding: 10px; }
    .metrics { background: #f5f5f5; padding: 10px; margin: 10px 0; }
    a { color: #1976d2; }
  </style>
</head>
<body>
  <div class="critical">
    <h2>🚨 CRITICAL ALERT: {{ .GroupLabels.alertname }}</h2>
    <p><strong>Service:</strong> Basset Hound Browser</p>
    <p><strong>Severity:</strong> CRITICAL - Immediate Action Required</p>
    <p><strong>Time:</strong> {{ .GroupLabels.timestamp }}</p>
  </div>

  <div class="metrics">
    <h3>Alert Details</h3>
    {{ range .Alerts.Firing }}
    <p>{{ .Annotations.description }}</p>
    <p><strong>Metric:</strong> {{ .Labels.metric }}</p>
    <p><strong>Instance:</strong> {{ .Labels.instance }}</p>
    {{ end }}
  </div>

  <h3>Recommended Actions</h3>
  <ol>
    <li>Check <a href="{{ .ExternalURL }}/graph">Grafana Dashboard</a></li>
    <li>Review <a href="{{ .ExternalURL }}/logs">Error Logs</a></li>
    <li>Consult <a href="{{ .ExternalURL }}/runbooks">Runbook</a></li>
  </ol>

  <p>
    <strong>On-Call:</strong> [Name] | <strong>Backup:</strong> [Name]<br>
    <strong>Incident ID:</strong> [ID]<br>
    <strong>Dashboard:</strong> https://monitoring.basset-hound.io
  </p>
</body>
</html>
```

### Email Recipients

| Group | Email | Alerts | Include |
|-------|-------|--------|---------|
| On-call | oncall@basset-hound.internal | CRITICAL, HIGH | Immediate |
| Team | team@basset-hound.internal | MEDIUM | 1x/day digest |
| Monitoring | monitoring@basset-hound.internal | All | Daily digest |
| Leadership | leadership@basset-hound.internal | CRITICAL | Immediate |

### Cost Estimate
- SendGrid: $0.10-0.50 per 1000 emails
- Expected: 50-100 emails/month = $0.50-2/month

---

## 5. Webhook Integration

### Purpose
Custom integrations with external systems. Supports:
- Custom incident management
- Ticketing systems (Jira)
- ChatOps platforms
- Custom dashboards

### Configuration

#### Generic Webhook
```yaml
webhook_configs:
  - url: 'https://custom-system.example.com/api/alerts'
    send_resolved: true
    headers:
      Authorization: 'Bearer ${WEBHOOK_TOKEN}'
    # Security: HTTPS only, validate certificates
    tls_config:
      insecure_skip_verify: false
```

#### Jira Integration Example
```yaml
webhook_configs:
  - url: 'https://jira.example.com/rest/api/2/issue'
    send_resolved: true
    headers:
      Authorization: 'Basic ${BASE64_CREDS}'
      Content-Type: 'application/json'
```

### Webhook Payload
```json
{
  "status": "firing",
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "ServiceDown",
        "severity": "critical",
        "component": "websocket"
      },
      "annotations": {
        "summary": "Service down",
        "description": "WebSocket server not responding",
        "dashboard_url": "https://grafana/..."
      },
      "startsAt": "2026-06-21T14:35:22Z",
      "endsAt": "0001-01-01T00:00:00Z"
    }
  ],
  "groupLabels": {
    "severity": "critical"
  },
  "commonLabels": {
    "component": "websocket"
  },
  "externalURL": "https://alertmanager.basset-hound.io"
}
```

### Webhook Security
- **HTTPS only** (no HTTP)
- **Token-based auth** (Bearer token or Basic auth)
- **IP whitelist** (alertmanager IPs)
- **Timeout:** 10 seconds
- **Retry:** 3 attempts with exponential backoff

### Testing Webhooks
```bash
# Test webhook delivery
curl -X POST https://webhook.example.com/alerts \
  -H 'Authorization: Bearer ${TOKEN}' \
  -H 'Content-Type: application/json' \
  -d @alert-payload.json
```

---

## 6. Dashboard Alerts

### Purpose
Real-time visual monitoring in Grafana. Provides:
- Live alert status
- Historical context
- Custom visualizations
- No notification required (passive monitoring)

### Grafana Configuration

#### Alert Panel Setup
```json
{
  "alert": {
    "name": "ServiceDown",
    "message": "WebSocket server not responding",
    "conditions": [
      {
        "evaluator": { "params": [3], "type": "gt" },
        "operator": { "type": "and" },
        "query": { "params": ["A", "5m", "now"] },
        "reducer": { "params": [], "type": "last" },
        "type": "query"
      }
    ],
    "executionErrorState": "alerting",
    "frequency": "1m",
    "handler": 1,
    "noDataState": "no_data"
  }
}
```

#### Dashboard Panels
- **Critical Alerts Panel** - Red background, large font
- **High Alerts Panel** - Orange background
- **Alert Timeline** - Chronological alert history
- **Alert Heatmap** - Frequency by alert type

---

## Alert Delivery SLA

| Severity | Method | Target Latency | Reliability | Tested |
|----------|--------|---|---|---|
| CRITICAL | SMS | <30s | 99% | Daily |
| CRITICAL | Phone | <60s | 95% | Weekly |
| CRITICAL | PagerDuty | <30s | 99.9% | Daily |
| HIGH | Slack | <10s | 99% | Continuous |
| HIGH | Email | <60s | 95% | Continuous |
| MEDIUM | Email | 1-5m | 90% | Weekly |
| INFO | Dashboard | Real-time | 99% | Continuous |

---

## Setup Checklist

### Pre-Deployment
- [ ] Twilio account created, verified
- [ ] Twilio numbers registered for SMS/calls
- [ ] PagerDuty service created
- [ ] PagerDuty escalation policies configured
- [ ] On-call rotation set up in PagerDuty
- [ ] Slack workspace has #incidents, #monitoring channels
- [ ] Slack webhooks created and tested
- [ ] SendGrid API key obtained
- [ ] Email templates created and tested
- [ ] Environment variables documented (.env.example)

### Post-Deployment
- [ ] Test CRITICAL alert flow (SMS, PagerDuty, Slack, Email)
- [ ] Test HIGH alert flow (PagerDuty, Slack, Email)
- [ ] Test MEDIUM alert flow (Slack, Email)
- [ ] Test escalation chain (5 min, 10 min, 15 min)
- [ ] Verify on-call receives notifications
- [ ] Measure alert latency (target: <30s)
- [ ] Document channel status pages
- [ ] Train on-call team on acknowledgment/resolution
- [ ] Set up daily alert digest
- [ ] Configure alert history retention

---

## Testing Procedures

### Test 1: SMS Delivery
```bash
# Trigger critical alert
curl -X POST http://localhost:8765/admin/test-alert \
  -d '{"severity":"critical","type":"service-down"}'

# Verify SMS received within 30 seconds
# Check Twilio logs
```

### Test 2: PagerDuty Incident
```bash
# Check PagerDuty UI for incident creation
# Verify incident severity matches alert
# Simulate acknowledgment from PagerDuty
```

### Test 3: Slack Notification
```bash
# Check #incidents channel for message
# Verify buttons work (Dashboard, Runbook, Acknowledge)
# Simulate button clicks
```

### Test 4: Escalation Chain
```bash
# Trigger critical alert
# Wait 5 minutes without acknowledging
# Verify backup on-call notified
# Wait 5 more minutes
# Verify manager notified
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-21  
**Next Review:** 2026-09-21
