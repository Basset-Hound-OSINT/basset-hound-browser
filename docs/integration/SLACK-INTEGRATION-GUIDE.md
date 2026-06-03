# Slack Integration Guide

Complete guide for integrating Slack notifications with Basset Hound Browser for real-time monitoring alerts.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Setup](#setup)
3. [Configuration](#configuration)
4. [Alert Types](#alert-types)
5. [Routing Rules](#routing-rules)
6. [WebSocket Commands](#websocket-commands)
7. [Examples](#examples)
8. [Troubleshooting](#troubleshooting)

## Quick Start

### 5-Minute Setup

1. **Create Slack Incoming Webhook**
   - Go to your Slack workspace
   - Create app or navigate to app management
   - Create new "Incoming Webhook"
   - Choose channel (e.g., `#alerts`)
   - Copy webhook URL

2. **Setup Webhook via WebSocket**

```javascript
const client = new WebSocket('ws://localhost:8765');

client.send(JSON.stringify({
  command: 'setup_slack_webhook',
  params: {
    webhookId: 'main-alerts',
    webhookUrl: 'https://hooks.slack.com/services/T.../B.../XXX'
  }
}));
```

3. **Test Connection**

```javascript
client.send(JSON.stringify({
  command: 'test_slack_webhook',
  params: {
    webhookId: 'main-alerts'
  }
}));
```

4. **Send Alert**

```javascript
client.send(JSON.stringify({
  command: 'send_slack_alert',
  params: {
    alert: {
      type: 'competitor_change',
      title: 'Competitor Update',
      message: 'Price change detected',
      severity: 'high',
      competitorName: 'Acme Corp',
      changeType: 'pricing'
    }
  }
}));
```

## Setup

### Create Slack App and Webhook

1. **Navigate to Slack App Directory**
   - Visit https://api.slack.com/apps
   - Click "Create New App"
   - Choose "From scratch"

2. **Configure App**
   - App name: "Basset Hound Browser"
   - Select your workspace
   - Click "Create App"

3. **Enable Incoming Webhooks**
   - In left sidebar, click "Incoming Webhooks"
   - Toggle "Activate Incoming Webhooks" to ON
   - Click "Add New Webhook to Workspace"
   - Select channel (create new if needed)
   - Authorize

4. **Copy Webhook URL**
   - From "Incoming Webhooks" page
   - Copy the full Webhook URL
   - Keep this secure (it's like a password)

### Webhook URL Format

```
https://hooks.slack.com/services/YOUR_TEAM_ID/YOUR_BOT_ID/YOUR_SECRET_TOKEN
```

Replace the placeholders:
- `YOUR_TEAM_ID` - Your Slack workspace Team ID
- `YOUR_BOT_ID` - Your Slack app Bot ID
- `YOUR_SECRET_TOKEN` - Your app's secret token (keep this private!)

## Configuration

### Add Webhook to Browser

```javascript
{
  command: 'setup_slack_webhook',
  params: {
    webhookId: 'main-alerts',      // Unique ID for this webhook
    webhookUrl: 'https://hooks.slack.com/services/...'
  }
}
```

### List Configured Webhooks

```javascript
{
  command: 'list_slack_webhooks'
}

// Response:
{
  'main-alerts': 'https://hooks.slack.com/services/...',
  'critical-alerts': 'https://hooks.slack.com/services/...'
}
```

### Remove Webhook

```javascript
{
  command: 'remove_slack_webhook',
  params: {
    webhookId: 'main-alerts'
  }
}
```

### Test Webhook

```javascript
{
  command: 'test_slack_webhook',
  params: {
    webhookId: 'main-alerts'
  }
}

// Response:
{
  success: true,
  message: 'Webhook test successful'
}
```

## Alert Types

### 1. Competitor Change Alert

```javascript
{
  command: 'send_slack_alert',
  params: {
    alert: {
      type: 'competitor_change',
      competitorName: 'Acme Corp',
      changeType: 'pricing',
      changeDetails: {
        oldPrice: '$100/month',
        newPrice: '$79/month'
      },
      url: 'https://acme.com/pricing',
      severity: 'high',
      timestamp: Date.now()
    }
  }
}
```

**Display Format:**
- Header: "🔄 Competitor Change Detected"
- Fields: Competitor, Change Type, Severity, Timestamp
- Details: Change specifications
- Link: Direct to competitor page
- Buttons: View Details, Acknowledge

### 2. Technology Update Alert

```javascript
{
  command: 'send_slack_alert',
  params: {
    alert: {
      type: 'technology_update',
      competitorName: 'Tech Inc',
      technology: 'React',
      previousVersion: '17.0.0',
      newVersion: '18.0.0',
      changes: [
        'Concurrent rendering',
        'Automatic batching',
        'New Hooks API'
      ],
      url: 'https://techcompany.com',
      severity: 'info'
    }
  }
}
```

**Display Format:**
- Header: "⚡ Technology Update Detected"
- Fields: Competitor, Technology, Previous, New Version
- Changes: Bullet-list of modifications
- Severity badge

### 3. Error Alert

```javascript
{
  command: 'send_slack_alert',
  params: {
    alert: {
      type: 'error',
      errorType: 'NetworkError',
      errorMessage: 'Connection timeout after 30s',
      stackTrace: 'Error: timeout\n  at connect (browser.js:123)',
      context: {
        url: 'https://example.com',
        retryCount: 3
      },
      severity: 'critical'
    }
  }
}
```

**Display Format:**
- Header: "🚨 Error Alert"
- Fields: Error Type, Severity, Timestamp
- Message: Error details
- Stack Trace: Full trace for debugging
- Context: Additional information

### 4. Campaign Update Alert

```javascript
{
  command: 'send_slack_alert',
  params: {
    alert: {
      type: 'campaign_update',
      campaignId: 'campaign-q1-2024',
      campaignName: 'Q1 2024 Competitor Monitor',
      updateType: 'target_added',
      updateData: {
        newTarget: 'Competitor X',
        source: 'manual'
      },
      affectedCompetitors: ['Acme', 'Tech Inc', 'StartUp Co'],
      severity: 'info'
    }
  }
}
```

**Display Format:**
- Header: "📢 Campaign Update"
- Fields: Campaign, Update Type, Affected Count
- Changes: Update details
- Competitors: List of affected targets

### 5. Generic Alert

```javascript
{
  command: 'send_slack_alert',
  params: {
    alert: {
      title: 'Custom Alert Title',
      message: 'Detailed message about what happened',
      severity: 'medium',
      source: 'browser',
      metadata: {
        customField: 'value'
      }
    }
  }
}
```

## Routing Rules

### Add Routing Rule

Route different alert types to different channels.

```javascript
{
  command: 'add_slack_routing_rule',
  params: {
    source: 'browser',                    // Alert source
    alertType: 'competitor_change',       // Alert type
    webhookId: 'competitor-alerts',       // Target webhook
    priority: 10,                         // Higher = matched first
    enabled: true
  }
}

// Response:
{
  success: true,
  ruleId: 'rule_1622547890_abc123'
}
```

### Setup Complete Routing

```javascript
{
  command: 'setup_slack_routing',
  params: {
    config: {
      webhooks: {
        'competitor-alerts': 'https://hooks.slack.com/services/...',
        'tech-alerts': 'https://hooks.slack.com/services/...',
        'critical-alerts': 'https://hooks.slack.com/services/...',
        'general': 'https://hooks.slack.com/services/...'
      },
      routingRules: [
        {
          alertType: 'error',
          webhookId: 'critical-alerts',
          priority: 100
        },
        {
          alertType: 'competitor_change',
          webhookId: 'competitor-alerts',
          priority: 50
        },
        {
          alertType: 'technology_update',
          webhookId: 'tech-alerts',
          priority: 50
        },
        {
          alertType: '*',
          webhookId: 'general',
          priority: 0
        }
      ]
    }
  }
}
```

### List Routing Rules

```javascript
{
  command: 'list_slack_routing_rules'
}

// Response:
[
  {
    ruleId: 'rule_123',
    source: 'browser',
    alertType: 'competitor_change',
    webhookId: 'competitor-alerts',
    priority: 50,
    enabled: true
  },
  ...
]
```

### Update Routing Rule

```javascript
{
  command: 'update_slack_routing_rule',
  params: {
    ruleId: 'rule_123',
    updates: {
      priority: 100,
      enabled: false
    }
  }
}
```

### Remove Routing Rule

```javascript
{
  command: 'remove_slack_routing_rule',
  params: {
    ruleId: 'rule_123'
  }
}
```

### Test Routing

```javascript
{
  command: 'test_slack_routing',
  params: {
    alert: {
      source: 'browser',
      type: 'competitor_change',
      competitorName: 'Test Corp'
    }
  }
}

// Response:
{
  success: true,
  targetedWebhooks: ['competitor-alerts', 'general'],
  matchingRules: 2,
  message: 'Alert would be routed to 2 webhook(s)'
}
```

## WebSocket Commands

### Core Commands

#### setup_slack_webhook

Configure an incoming webhook.

```javascript
{
  command: 'setup_slack_webhook',
  params: {
    webhookId: string,      // Required: Unique ID
    webhookUrl: string      // Required: Slack webhook URL
  }
}

// Returns: { success: boolean, error?: string }
```

#### test_slack_webhook

Test webhook connectivity.

```javascript
{
  command: 'test_slack_webhook',
  params: {
    webhookId: string       // Required: Webhook ID to test
  }
}

// Returns: { success: boolean, error?: string, message?: string }
```

#### send_slack_alert

Send single alert to Slack.

```javascript
{
  command: 'send_slack_alert',
  params: {
    alert: {
      type: string,         // Alert type
      title: string,        // Alert title
      message: string,      // Alert message
      severity: string,     // critical, high, medium, low, info
      [other fields...]     // Type-specific fields
    }
  }
}

// Returns: { success: boolean, results: Array, error?: string }
```

#### send_slack_alerts_batch

Send multiple alerts in batch.

```javascript
{
  command: 'send_slack_alerts_batch',
  params: {
    alerts: [
      { type: 'competitor_change', ... },
      { type: 'technology_update', ... },
      { type: 'error', ... }
    ]
  }
}

// Returns: { totalAlerts: number, successCount: number, failureCount: number, results: Array }
```

#### get_slack_status

Get integration status.

```javascript
{
  command: 'get_slack_status'
}

// Returns:
{
  initialized: boolean,
  webhooks: { [webhookId]: { registered: boolean, messagesSentThisWindow: number, ... } },
  routingRules: number,
  stats: {
    alertsSent: number,
    alertsFailed: number,
    uptime: number,
    alertHistory: number
  }
}
```

### Routing Commands

#### add_slack_routing_rule

Add alert routing rule.

```javascript
{
  command: 'add_slack_routing_rule',
  params: {
    source?: string,        // Alert source ('browser', '*', etc)
    alertType?: string,     // Alert type ('competitor_change', '*', etc)
    webhookId: string,      // Target webhook ID
    priority?: number,      // Higher = matched first
    enabled?: boolean       // Default: true
  }
}
```

#### list_slack_routing_rules

List all routing rules.

```javascript
{
  command: 'list_slack_routing_rules'
}

// Returns: Array of routing rule objects
```

#### get_slack_alert_history

Get alert send history.

```javascript
{
  command: 'get_slack_alert_history',
  params: {
    options?: {
      type?: string,        // Filter by alert type
      since?: number,       // Filter by timestamp (ms)
      limit?: number        // Max results (default: 100)
    }
  }
}

// Returns: Array of alert history entries
```

#### clear_slack_alert_history

Clear alert history.

```javascript
{
  command: 'clear_slack_alert_history'
}

// Returns: { success: boolean, clearedCount: number }
```

## Examples

### Example 1: Multi-Channel Setup

```javascript
// Configure webhooks for different channels
const commands = [
  {
    command: 'setup_slack_webhook',
    params: {
      webhookId: 'competitor-alerts',
      webhookUrl: 'https://hooks.slack.com/services/T.../B.../competitor...'
    }
  },
  {
    command: 'setup_slack_webhook',
    params: {
      webhookId: 'critical-alerts',
      webhookUrl: 'https://hooks.slack.com/services/T.../B.../critical...'
    }
  },
  {
    command: 'add_slack_routing_rule',
    params: {
      alertType: 'error',
      webhookId: 'critical-alerts',
      priority: 100
    }
  },
  {
    command: 'add_slack_routing_rule',
    params: {
      alertType: 'competitor_change',
      webhookId: 'competitor-alerts',
      priority: 50
    }
  }
];

// Send all commands
for (const cmd of commands) {
  client.send(JSON.stringify(cmd));
}
```

### Example 2: Monitor Competitor Changes

```javascript
// When competitor change detected
{
  command: 'send_slack_alert',
  params: {
    alert: {
      type: 'competitor_change',
      competitorName: 'Acme Corp',
      changeType: 'feature',
      changeDetails: {
        feature: 'Dark Mode',
        status: 'released',
        description: 'New dark mode UI theme available'
      },
      url: 'https://acme.com',
      severity: 'high'
    }
  }
}
```

### Example 3: Technology Stack Updates

```javascript
// When competitor updates technology
{
  command: 'send_slack_alert',
  params: {
    alert: {
      type: 'technology_update',
      competitorName: 'TechCorp',
      technology: 'PostgreSQL',
      previousVersion: '12.0',
      newVersion: '15.0',
      changes: [
        'JSON/JSONB improvements',
        'Better query performance',
        'New pg_stat_statements features'
      ],
      url: 'https://techcorp.com/tech',
      severity: 'medium'
    }
  }
}
```

### Example 4: Batch Alert Campaign

```javascript
// Send multiple related alerts
{
  command: 'send_slack_alerts_batch',
  params: {
    alerts: [
      {
        type: 'competitor_change',
        competitorName: 'Company A',
        changeType: 'pricing',
        severity: 'high'
      },
      {
        type: 'competitor_change',
        competitorName: 'Company B',
        changeType: 'feature',
        severity: 'medium'
      },
      {
        type: 'technology_update',
        competitorName: 'Company C',
        technology: 'React',
        previousVersion: '17',
        newVersion: '18',
        severity: 'low'
      }
    ]
  }
}
```

## Troubleshooting

### Webhook URL Invalid Error

**Problem:** `Invalid Slack webhook URL`

**Solution:**
- Copy webhook URL exactly from Slack workspace
- Ensure URL starts with `https://hooks.slack.com/`
- Check for trailing spaces or incomplete URL
- Verify webhook hasn't been revoked in Slack app settings

### Test Webhook Fails

**Problem:** `Failed to send test message`

**Solution:**
- Verify internet connectivity
- Check webhook URL is still valid (hasn't been revoked)
- Ensure Slack app has correct permissions
- Check that channel still exists
- Verify webhook hasn't hit rate limits

### Alerts Not Received

**Problem:** `Alerts sent but not appearing in Slack`

**Solution:**
- Verify routing rules are correct: `list_slack_routing_rules`
- Check if alert type matches any rules
- Test routing: `test_slack_routing`
- Ensure webhook is enabled and has correct channel
- Check Slack notification settings for workspace/channel

### Rate Limit Errors

**Problem:** `Rate limited. Retry after Xs`

**Solution:**
- Default rate limit: 1 message/second per webhook
- Queue accumulates messages up to 10 in burst
- Spacing out alerts helps: wait 1+ second between sends
- Use batch sending for multiple alerts
- Stagger alerts across multiple webhooks

### Formatting Issues

**Problem:** `Alert text looks malformed in Slack`

**Solution:**
- Alert formatter validates Slack Block Kit format
- Check alert type is recognized: competitor_change, technology_update, error, campaign_update, or generic
- Ensure required fields present for alert type
- Test with simpler alert first
- Check Slack workspace supports Block Kit

### History Not Saving

**Problem:** `Alert history empty after restart`

**Solution:**
- History is in-memory only (not persisted)
- Restart of browser will clear history
- Default history limit: 1000 alerts
- Use `get_slack_alert_history` before clearing
- History cleared automatically after reaching max size

## Rate Limiting

### Default Limits

- **Per webhook:** 1 message/second
- **Burst size:** 10 messages
- **Retry attempts:** 3
- **Retry delay:** 1 second initial (exponential backoff)

### Slack API Rate Limits

Slack may rate limit beyond browser limits:
- Standard: ~1-5 requests/second per app
- Webhook-specific: ~100 requests/minute

### Optimization Tips

1. **Batch related alerts** - Use `send_slack_alerts_batch`
2. **Space out alerts** - Stagger timing if not urgent
3. **Use appropriate severity** - Don't mark everything critical
4. **Deduplicate** - Don't send same alert multiple times
5. **Cache responses** - Store alert results to avoid resending

## Advanced Configuration

### Export/Import Configuration

```javascript
// Export current configuration
{
  command: 'get_slack_routing_config'
}

// Import previously saved configuration
{
  command: 'import_slack_routing_config',
  params: {
    config: {
      webhooks: { ... },
      routingRules: [ ... ]
    }
  }
}
```

## Support

For issues or feature requests:
- Check troubleshooting section
- Review WebSocket command examples
- Verify Slack webhook configuration
- Check browser console for detailed error messages
