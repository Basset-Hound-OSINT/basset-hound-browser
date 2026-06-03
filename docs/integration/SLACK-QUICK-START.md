# Slack Integration Quick Start

Get Slack alerts from Basset Hound Browser in 5 minutes.

## Step 1: Create Slack Webhook (2 minutes)

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name: `Basset Hound Browser`, select workspace, click "Create App"
4. Left sidebar → "Incoming Webhooks" → toggle ON
5. Click "Add New Webhook to Workspace"
6. Select channel (or create #basset-hound-alerts)
7. Click "Authorize"
8. **Copy the Webhook URL** - looks like:
   ```
   https://hooks.slack.com/services/T123456/B789012/XXXXXXXXXXXX
   ```

## Step 2: Connect to Browser (1 minute)

Open WebSocket to `ws://localhost:8765` and send:

```json
{
  "command": "setup_slack_webhook",
  "params": {
    "webhookId": "main",
    "webhookUrl": "https://hooks.slack.com/services/T123456/B789012/XXXXXXXXXXXX"
  }
}
```

## Step 3: Test Connection (1 minute)

```json
{
  "command": "test_slack_webhook",
  "params": {
    "webhookId": "main"
  }
}
```

Should see test message appear in your Slack channel.

## Step 4: Send Your First Alert (1 minute)

```json
{
  "command": "send_slack_alert",
  "params": {
    "alert": {
      "type": "competitor_change",
      "title": "Competitor Price Update",
      "message": "Acme Corp reduced pricing by 20%",
      "competitorName": "Acme Corp",
      "changeType": "pricing",
      "url": "https://acme.com/pricing",
      "severity": "high"
    }
  }
}
```

Alert appears in Slack with formatted message and buttons!

## Alert Types

### Competitor Change
```json
{
  "type": "competitor_change",
  "competitorName": "Company Name",
  "changeType": "pricing|feature|design|content",
  "url": "https://competitor.com",
  "severity": "high|medium|low"
}
```

### Technology Update
```json
{
  "type": "technology_update",
  "competitorName": "Company Name",
  "technology": "React|Node.js|etc",
  "previousVersion": "17.0",
  "newVersion": "18.0",
  "changes": ["Change 1", "Change 2"],
  "severity": "info"
}
```

### Error Alert
```json
{
  "type": "error",
  "errorType": "NetworkError",
  "errorMessage": "Connection failed",
  "severity": "critical"
}
```

## Multi-Channel Setup (Optional)

Route different alert types to different channels:

```json
{
  "command": "setup_slack_routing",
  "params": {
    "config": {
      "webhooks": {
        "competitor-alerts": "https://hooks.slack.com/services/T.../B.../competitor...",
        "critical-alerts": "https://hooks.slack.com/services/T.../B.../critical..."
      },
      "routingRules": [
        {
          "alertType": "error",
          "webhookId": "critical-alerts",
          "priority": 100
        },
        {
          "alertType": "competitor_change",
          "webhookId": "competitor-alerts",
          "priority": 50
        }
      ]
    }
  }
}
```

## Useful Commands

**List webhooks:**
```json
{ "command": "list_slack_webhooks" }
```

**Get status:**
```json
{ "command": "get_slack_status" }
```

**View alert history:**
```json
{
  "command": "get_slack_alert_history",
  "params": { "options": { "limit": 10 } }
}
```

**Send batch alerts:**
```json
{
  "command": "send_slack_alerts_batch",
  "params": {
    "alerts": [
      { "type": "competitor_change", "competitorName": "Company A", ... },
      { "type": "technology_update", "competitorName": "Company B", ... }
    ]
  }
}
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Invalid webhook URL | Copy exact URL from Slack, ensure no spaces |
| Test fails | Webhook revoked in Slack app settings, create new one |
| No alerts in Slack | Check routing rules match alert type, test routing |
| Rate limit errors | Space out alerts or batch send them |
| Formatting broken | Ensure alert type is recognized |

## Next Steps

- Read full guide: `/docs/integration/SLACK-INTEGRATION-GUIDE.md`
- Configure routing rules for different channels
- Set up batch alert campaigns
- Monitor alert history
- Integrate with competitor monitoring workflows

---

**Need help?** Check `/docs/integration/SLACK-INTEGRATION-GUIDE.md` for detailed documentation on all features.
