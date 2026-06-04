# Slack Integration Guide - Complete

**Version**: 12.2.0
**Status**: Enterprise Ready
**Last Updated**: June 3, 2026
**Integration Type**: Bi-directional (Commands & Notifications)

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup & Installation](#setup--installation)
4. [Authentication & Credentials](#authentication--credentials)
5. [Slack Commands](#slack-commands)
6. [Slack Notifications](#slack-notifications)
7. [Workflow Integration](#workflow-integration)
8. [Examples](#examples)
9. [Troubleshooting](#troubleshooting)
10. [Advanced Features](#advanced-features)

---

## Overview

The Slack integration enables:
- **Remote Browser Control**: Control browser from Slack
- **Status Notifications**: Real-time updates on browser operations
- **Screenshot Sharing**: Send screenshots directly to Slack
- **Session Management**: Create and manage browser sessions from Slack
- **Alerts & Monitoring**: Get notified of important events
- **Workflow Automation**: Automate OSINT workflows via Slack

### Use Cases

1. **Remote Research**: Conduct OSINT research from Slack
2. **Team Collaboration**: Share findings with team in Slack
3. **Monitoring**: Get alerts when specific events occur
4. **Content Verification**: Verify web content changes
5. **Data Extraction**: Extract and share web data via Slack

---

## Architecture

```
┌─────────────────┐
│  Slack Client   │
│  (Your Team)    │
└────────┬────────┘
         │ (Slack API)
         │
┌────────▼────────────────────┐
│   Slack Middleware           │
│   (SlackEventHandler)        │
└────────┬─────────────────────┘
         │
┌────────▼──────────────────────────┐
│  Basset Hound Browser API         │
│  (WebSocket/REST)                │
└────────┬──────────────────────────┘
         │
┌────────▼──────────────────────────┐
│  Browser Engine                    │
│  (Electron/Chromium)              │
└────────────────────────────────────┘
```

### Integration Flow

1. **Slack User** sends command in Slack
2. **Slack API** sends event to your webhook URL
3. **Middleware** parses command and validates
4. **Browser API** executes command
5. **Result** returned to Slack as message/attachment

---

## Setup & Installation

### Prerequisites

- Basset Hound Browser v12.2.0+
- Slack Workspace with admin access
- Node.js 14+ (for middleware)
- Public URL for webhook (HTTPS)

### Step 1: Create Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click "Create New App"
3. Choose "From scratch"
4. **App Name**: `Basset Hound Browser`
5. **Workspace**: Select your workspace
6. Click "Create App"

### Step 2: Configure App Permissions

In **OAuth & Permissions**:

**Bot Token Scopes** (add these):
```
chat:write
files:write
commands
app_mentions:read
incoming-webhook
```

**User Token Scopes** (add these):
```
users:read
users:read.email
```

### Step 3: Install to Workspace

1. Go to **Install App** section
2. Click "Install to Workspace"
3. Authorize the app
4. Copy **Bot User OAuth Token** (starts with `xoxb-`)
5. Save this securely (you'll need it)

### Step 4: Configure Slash Commands

In **Slash Commands**:

1. Click "Create New Command"
2. **Command**: `/bhb-navigate`
3. **Request URL**: `https://your-server.com/slack/commands`
4. **Short Description**: `Navigate to URL`
5. Click "Save"

**Repeat for additional commands:**

| Command | Description |
|---------|-------------|
| `/bhb-navigate` | Navigate to URL |
| `/bhb-click` | Click element |
| `/bhb-screenshot` | Take screenshot |
| `/bhb-extract` | Extract content |
| `/bhb-session` | Manage sessions |
| `/bhb-status` | Check browser status |

### Step 5: Set Up Event Subscriptions

In **Event Subscriptions**:

1. Toggle "Enable Events" to ON
2. **Request URL**: `https://your-server.com/slack/events`
3. **Subscribe to bot events**:
   - `app_mention`
   - `message.im`
   - `slash_commands`

4. Click "Save Changes"

### Step 6: Deploy Middleware

Save this as `slack-middleware.js`:

```javascript
const express = require('express');
const { WebClient } = require('@slack/web-api');
const axios = require('axios');

class SlackMiddleware {
  constructor(slackToken, browserApiUrl) {
    this.slack = new WebClient(slackToken);
    this.browserApi = browserApiUrl;
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    this.router.post('/commands', this.handleCommand.bind(this));
    this.router.post('/events', this.handleEvent.bind(this));
  }

  async handleCommand(req, res) {
    const { command, text, user_id, channel_id, response_url } = req.body;

    res.status(200).json({ response_type: 'in_channel' });

    try {
      const result = await this.executeCommand(command, text);
      
      await axios.post(response_url, {
        blocks: this.formatResult(result),
        response_type: 'in_channel'
      });
    } catch (error) {
      await axios.post(response_url, {
        text: `Error: ${error.message}`,
        response_type: 'ephemeral'
      });
    }
  }

  async executeCommand(command, args) {
    // Parse and execute commands
    const [action, ...params] = args.split(' ');

    switch (command) {
      case '/bhb-navigate':
        return await this.navigate(params[0]);
      case '/bhb-screenshot':
        return await this.takeScreenshot();
      case '/bhb-click':
        return await this.click(params[0]);
      // ... more commands
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  async navigate(url) {
    const response = await axios.post(
      `${this.browserApi}/api/v1/navigate`,
      { url }
    );
    return response.data;
  }

  async takeScreenshot() {
    const response = await axios.post(
      `${this.browserApi}/api/v1/screenshot`,
      { format: 'png' }
    );
    return response.data;
  }

  formatResult(result) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ Success\n\`\`\`${JSON.stringify(result.data, null, 2)}\`\`\``
        }
      }
    ];
  }

  getRouter() {
    return this.router;
  }
}

module.exports = SlackMiddleware;
```

### Step 7: Deploy & Configure

```bash
# Install dependencies
npm install @slack/web-api axios express

# Set environment variables
export SLACK_BOT_TOKEN=xoxb-your-token
export BROWSER_API_URL=http://localhost:8766

# Start middleware server
node middleware-server.js
```

---

## Authentication & Credentials

### Slack Tokens

**Bot Token** (`xoxb-...`):
- Required for all Slack API calls
- Scoped to specific permissions
- Keep secure (rotate regularly)

**Signing Secret**:
- Verify webhook authenticity
- All webhooks signed with this secret
- Check signature before processing

### Verify Webhook Signature

```javascript
const crypto = require('crypto');

function verifySlackSignature(req) {
  const signature = req.headers['x-slack-signature'];
  const timestamp = req.headers['x-slack-request-timestamp'];
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  // Verify timestamp (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    return false;
  }

  // Verify signature
  const baseString = `v0:${timestamp}:${req.rawBody}`;
  const hmac = crypto.createHmac('sha256', signingSecret);
  hmac.update(baseString);
  const computedSignature = `v0=${hmac.digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}
```

### Browser API Authentication

Configure browser API token:

```javascript
const headers = {
  'Authorization': `Bearer ${process.env.BROWSER_API_TOKEN}`,
  'Content-Type': 'application/json'
};
```

---

## Slack Commands

### /bhb-navigate

Navigate to URL.

**Usage:**
```
/bhb-navigate https://example.com
```

**Response:**
```
✅ Navigated to https://example.com
URL: https://example.com
Title: Example Domain
Load Time: 2.5s
```

### /bhb-screenshot

Take and share screenshot.

**Usage:**
```
/bhb-screenshot
/bhb-screenshot --full-page
/bhb-screenshot --element "selector"
```

**Response:**
Uploads screenshot image to Slack thread

### /bhb-click

Click element on page.

**Usage:**
```
/bhb-click "button.submit"
/bhb-click "a.link"
```

**Response:**
```
✅ Clicked element
Element: button.submit
Tag: BUTTON
ID: submit
```

### /bhb-fill

Fill form field.

**Usage:**
```
/bhb-fill "input[name='email']" "user@example.com"
```

**Response:**
```
✅ Filled field
Selector: input[name='email']
Value: user@example.com
```

### /bhb-extract

Extract page content.

**Usage:**
```
/bhb-extract links
/bhb-extract images
/bhb-extract forms
/bhb-extract metadata
```

**Response:**
Returns extracted data in formatted blocks

### /bhb-session

Manage sessions.

**Usage:**
```
/bhb-session create "session-name"
/bhb-session list
/bhb-session switch "session-id"
/bhb-session delete "session-id"
```

### /bhb-status

Check browser status.

**Usage:**
```
/bhb-status
```

**Response:**
```
🟢 Browser Running
Version: v12.2.0
Uptime: 2h 15m
Memory: 2.4%
Sessions: 3
Tabs: 5
Proxy: active (203.0.113.45)
```

---

## Slack Notifications

### Configure Incoming Webhooks

For outbound notifications, configure webhooks:

```javascript
const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

async function sendNotification(message) {
  await axios.post(slackWebhookUrl, {
    text: message.text,
    blocks: message.blocks,
    attachments: message.attachments
  });
}
```

### Event Notifications

**Browser Started:**
```json
{
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "🟢 Browser Started\n*Version:* v12.2.0\n*Uptime:* 0s"
      }
    }
  ]
}
```

**Navigation Complete:**
```json
{
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "✅ Navigation Complete\n*URL:* https://example.com\n*Load Time:* 2.5s"
      }
    }
  ]
}
```

**Screenshot Taken:**
```json
{
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "📸 Screenshot Captured"
      }
    },
    {
      "type": "image",
      "image_url": "https://example.com/screenshot.png",
      "alt_text": "Page screenshot"
    }
  ]
}
```

**Error Occurred:**
```json
{
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "❌ Error Occurred\n*Error:* Navigation failed\n*URL:* https://example.com\n*Reason:* Network unreachable"
      }
    }
  ]
}
```

---

## Workflow Integration

### Slack Workflow Builder Integration

1. Go to **Workflow Builder**
2. Click "Create"
3. **Name**: "OSINT Research Workflow"
4. **Trigger**: On-demand or scheduled
5. **Steps**:

   **Step 1: Get User Input**
   ```
   Input 1: URL to research
   Input 2: Content type to extract
   ```

   **Step 2: Send to Browser**
   ```
   POST http://localhost:8766/api/v1/navigate
   Body: { "url": "[URL]" }
   ```

   **Step 3: Wait**
   ```
   Delay: 5 seconds
   ```

   **Step 4: Take Screenshot**
   ```
   POST http://localhost:8766/api/v1/screenshot
   ```

   **Step 5: Extract Content**
   ```
   POST http://localhost:8766/api/v1/content/[type]
   ```

   **Step 6: Send Results to Slack**
   ```
   Send message to user with results
   ```

### Multi-Step Workflow Example

```javascript
class SlackWorkflow {
  constructor(slackClient, browserApi) {
    this.slack = slackClient;
    this.browserApi = browserApi;
  }

  async executeOsintWorkflow(url, extractionTypes) {
    // Step 1: Notify start
    await this.notifyWorkflowStart(url);

    // Step 2: Navigate
    const navResult = await this.browserApi.navigate(url);
    await this.slack.sendMessage(`Navigated to: ${url}`);

    // Step 3: Wait for page load
    await new Promise(r => setTimeout(r, 5000));

    // Step 4: Extract data
    const extractions = {};
    for (const type of extractionTypes) {
      extractions[type] = await this.browserApi.extract(type);
    }

    // Step 5: Take screenshot
    const screenshot = await this.browserApi.screenshot();
    await this.slack.uploadFile(screenshot);

    // Step 6: Send summary
    await this.notifyWorkflowComplete(extractions);
  }

  async notifyWorkflowStart(url) {
    // ...
  }

  async notifyWorkflowComplete(results) {
    // ...
  }
}
```

---

## Examples

### Example 1: Simple Navigation & Screenshot

**Slack Command:**
```
/bhb-navigate https://example.com
```

**Behind the Scenes:**

```javascript
// 1. Parse command
const url = 'https://example.com';

// 2. Navigate
const navResult = await fetch('http://localhost:8766/api/v1/navigate', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
  body: JSON.stringify({ url })
});

// 3. Wait for page load
await new Promise(r => setTimeout(r, 3000));

// 4. Take screenshot
const screenshotResult = await fetch('http://localhost:8766/api/v1/screenshot', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
  body: JSON.stringify({ format: 'png' })
});

// 5. Upload to Slack
const screenshot = screenshotResult.data.screenshot;
await slack.files.upload({
  channels: channelId,
  file: Buffer.from(screenshot, 'base64'),
  title: 'Page Screenshot',
  filename: 'screenshot.png'
});

// 6. Send message
await slack.chat.postMessage({
  channel: channelId,
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `✅ Navigation Complete\n*URL:* ${url}\n*Title:* Example Domain`
      }
    }
  ]
});
```

### Example 2: Content Extraction Workflow

**Slack Command:**
```
/bhb-extract links
```

**Implementation:**

```javascript
async function extractAndShare(extractionType, channelId) {
  // Extract content
  const result = await fetch(`http://localhost:8766/api/v1/content/${extractionType}`, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer token' }
  });

  const data = result.json();

  // Format for Slack
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📄 Extracted ${extractionType.toUpperCase()}\nFound: ${data.data[extractionType].length}`
      }
    }
  ];

  // Add first 10 items
  for (let i = 0; i < Math.min(10, data.data[extractionType].length); i++) {
    const item = data.data[extractionType][i];
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `• ${item.href || item.src || item.text || JSON.stringify(item)}`
      }
    });
  }

  // Send to Slack
  await slack.chat.postMessage({
    channel: channelId,
    blocks
  });
}
```

### Example 3: Scheduled OSINT Report

**Workflow Setup:**

```javascript
const schedule = require('node-schedule');

// Schedule daily at 9 AM
schedule.scheduleJob('0 9 * * *', async () => {
  const urls = [
    'https://company-competitor.com',
    'https://market-analysis.com',
    'https://news-outlet.com'
  ];

  const report = [];

  for (const url of urls) {
    // Navigate
    await browserApi.navigate(url);
    await new Promise(r => setTimeout(r, 3000));

    // Extract metadata
    const metadata = await browserApi.extractMetadata();

    // Take screenshot
    const screenshot = await browserApi.screenshot();

    report.push({
      url,
      metadata,
      screenshot
    });
  }

  // Send daily report to Slack
  await sendDailyReport(report);
});

async function sendDailyReport(report) {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📊 Daily OSINT Report\n_${new Date().toLocaleDateString()}_`
      }
    }
  ];

  for (const item of report) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${item.url}*\nTitle: ${item.metadata.title}\nDescription: ${item.metadata.description}`
      }
    });
  }

  await slack.chat.postMessage({
    channel: '#osint-reports',
    blocks
  });
}
```

---

## Troubleshooting

### Command Not Responding

**Issue**: Slash command takes too long or doesn't respond

**Solution**:
1. Verify webhook URL is accessible
2. Check network connectivity
3. Verify browser API is running
4. Check logs: `tail -f /var/log/middleware.log`

### Slack Token Invalid

**Issue**: "Invalid Slack token" error

**Solution**:
1. Regenerate bot token in Slack API
2. Update `SLACK_BOT_TOKEN` environment variable
3. Restart middleware
4. Verify token format (should start with `xoxb-`)

### Screenshot Upload Fails

**Issue**: Screenshot command fails with file upload error

**Solution**:
1. Check file size (max 20MB)
2. Verify `files:write` scope is enabled
3. Check channel permissions
4. Verify workspace file upload limits

### Webhook Signature Verification Failed

**Issue**: "Request signature verification failed"

**Solution**:
1. Get signing secret from Slack API dashboard
2. Set `SLACK_SIGNING_SECRET` environment variable
3. Verify webhook endpoint is using correct verification code
4. Check system time (must be within 5 minutes of Slack server)

### Browser API Timeout

**Issue**: "Browser API timeout" error

**Solution**:
1. Verify browser is running: `/bhb-status`
2. Check browser logs
3. Increase timeout in request: `"timeout": 60000`
4. Check network connectivity between middleware and browser

---

## Advanced Features

### Custom Slash Command Handler

```javascript
class CustomCommandHandler {
  async handle(command, args, context) {
    // Parse arguments
    const [action, ...params] = args.split(' ');

    // Execute custom logic
    if (action === 'advanced') {
      return await this.handleAdvanced(params, context);
    }

    throw new Error(`Unknown action: ${action}`);
  }

  async handleAdvanced(params, context) {
    // Custom multi-step workflow
    // 1. Validate inputs
    // 2. Execute complex browser operations
    // 3. Process results
    // 4. Return formatted response
  }
}
```

### Interactive Message Buttons

```javascript
async function sendInteractiveMessage(channelId) {
  await slack.chat.postMessage({
    channel: channelId,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'What would you like to do?'
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Take Screenshot'
            },
            action_id: 'screenshot_button'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Extract Links'
            },
            action_id: 'extract_links_button'
          }
        ]
      }
    ]
  });
}

// Handle button clicks
app.action('screenshot_button', async ({ body, ack }) => {
  ack();
  // Take screenshot
});
```

### Rate Limiting & Queuing

```javascript
const Queue = require('bull');
const commandQueue = new Queue('slack-commands', process.env.REDIS_URL);

commandQueue.process(async (job) => {
  const { command, args, context } = job.data;
  return await executeCommand(command, args, context);
});

// Add command to queue
commandQueue.add({ command, args, context }, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  }
});
```

### Analytics & Logging

```javascript
class SlackAnalytics {
  async logCommand(command, userId, channelId, result) {
    await db.commands.insert({
      command,
      userId,
      channelId,
      result,
      timestamp: new Date(),
      success: result.success
    });
  }

  async getUsageStats() {
    return await db.commands.aggregate([
      {
        $group: {
          _id: '$command',
          count: { $sum: 1 },
          successRate: {
            $avg: { $cond: ['$success', 1, 0] }
          }
        }
      }
    ]).toArray();
  }
}
```

---

## Security Considerations

1. **Token Rotation**: Rotate Slack tokens every 90 days
2. **Webhook Verification**: Always verify webhook signatures
3. **Rate Limiting**: Implement rate limits to prevent abuse
4. **Audit Logging**: Log all commands and results
5. **Access Control**: Restrict commands to authorized users
6. **Data Privacy**: Don't share sensitive data in Slack
7. **HTTPS Only**: Always use HTTPS for webhooks
8. **Secret Management**: Use environment variables for secrets

---

## Support & Resources

- Slack API Documentation: https://api.slack.com/
- Slack SDK for Node.js: https://slack.dev/node-sdk/
- Basset Hound Browser API: See `/docs/API-REFERENCE-COMPLETE.md`
- Integration Examples: See `/examples/slack/`

