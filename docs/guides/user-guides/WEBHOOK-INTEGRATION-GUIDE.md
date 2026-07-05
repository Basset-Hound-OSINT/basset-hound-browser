# Webhook Integration Guide

**Version**: 12.2.0
**Status**: Enterprise Ready
**Last Updated**: June 3, 2026
**Integration Type**: Event-Driven Webhooks

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Webhook Types](#webhook-types)
4. [Setup & Configuration](#setup--configuration)
5. [Event Payloads](#event-payloads)
6. [Delivery & Retries](#delivery--retries)
7. [Security](#security)
8. [Examples](#examples)
9. [Troubleshooting](#troubleshooting)

---

## Overview

Webhooks enable event-driven integration with external systems. When events occur in Basset Hound Browser, HTTP POST requests are sent to your configured endpoints.

### Webhook Events

- **Navigation Events**: Page navigation started, completed, failed
- **Screenshot Events**: Screenshot captured, uploaded
- **Interaction Events**: Click, fill, scroll actions
- **Error Events**: Errors and exceptions
- **Session Events**: Session created, destroyed
- **Proxy Events**: Proxy changed, rotated
- **Recording Events**: Recording started, stopped
- **Performance Events**: Performance metrics updated
- **Custom Events**: User-defined events

---

## Architecture

```
┌─────────────────────────────────────┐
│  Basset Hound Browser               │
│  (WebSocket/REST API)               │
└────────┬────────────────────────────┘
         │ (Events occur)
         │
┌────────▼────────────────────────────┐
│  Event Dispatcher                   │
│  (Central event routing)            │
└────────┬────────────────────────────┘
         │
    ┌────┴────┐
    │          │
┌───▼───┐  ┌──▼────┐
│HTTP   │  │Queue  │
│POST   │  │(Redis)│
└───┬───┘  └───────┘
    │
┌───▼─────────────────────────────────┐
│  Your Webhook Endpoint              │
│  (Receives HTTP POST events)        │
└───────────────────────────────────────┘
```

---

## Webhook Types

### Incoming Webhooks (You Receive Events)

Browser sends events to your HTTP endpoint.

```
Browser Event → HTTP POST → Your Webhook
```

### Outgoing Webhooks (You Send Commands)

You send commands via HTTP to browser API.

```
Your Command → HTTP POST/GET → Browser API
```

---

## Setup & Configuration

### Register Webhook Endpoint

**Request:**
```bash
curl -X POST http://localhost:8766/api/v1/webhooks \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhook/basset",
    "events": [
      "navigation.complete",
      "screenshot.taken",
      "error.occurred"
    ],
    "active": true,
    "headers": {
      "X-Custom-Header": "value"
    }
  }'
```

**Parameters:**
- `url` (string, required): Webhook URL (must be HTTPS)
- `events` (array): Event types to subscribe to
- `active` (boolean, optional, default: true): Enable/disable webhook
- `headers` (object, optional): Custom headers to send

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "webhookId": "wh_abc123xyz",
    "url": "https://your-server.com/webhook/basset",
    "events": ["navigation.complete", "screenshot.taken"],
    "created": "2026-06-03T10:30:00Z",
    "lastDelivery": null,
    "failureCount": 0
  }
}
```

### List Webhooks

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/webhooks \
  -H "Authorization: Bearer TOKEN"
```

### Update Webhook

**Request:**
```bash
curl -X PUT http://localhost:8766/api/v1/webhooks/wh_abc123xyz \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "active": true,
    "events": ["navigation.complete"]
  }'
```

### Delete Webhook

**Request:**
```bash
curl -X DELETE http://localhost:8766/api/v1/webhooks/wh_abc123xyz \
  -H "Authorization: Bearer TOKEN"
```

---

## Event Payloads

### Common Event Structure

```json
{
  "id": "evt_abc123xyz",
  "type": "navigation.complete",
  "timestamp": "2026-06-03T10:30:00Z",
  "webhookId": "wh_abc123xyz",
  "data": {
    "url": "https://example.com",
    "title": "Example Domain",
    "loadTime": 2500
  },
  "retry": 0,
  "signature": "sha256=..."
}
```

### Navigation Events

**navigation.started**
```json
{
  "type": "navigation.started",
  "data": {
    "url": "https://example.com",
    "timestamp": "2026-06-03T10:30:00Z"
  }
}
```

**navigation.complete**
```json
{
  "type": "navigation.complete",
  "data": {
    "url": "https://example.com",
    "title": "Example Domain",
    "loadTime": 2500,
    "resourcesLoaded": 45,
    "totalSize": 2048000
  }
}
```

**navigation.failed**
```json
{
  "type": "navigation.failed",
  "data": {
    "url": "https://example.com",
    "error": "Network unreachable",
    "code": "ERR_CONNECTION_REFUSED"
  }
}
```

### Screenshot Events

**screenshot.taken**
```json
{
  "type": "screenshot.taken",
  "data": {
    "format": "png",
    "width": 1920,
    "height": 1080,
    "size": 245320,
    "url": "https://example.com",
    "uploadUrl": "https://storage.example.com/screenshot.png"
  }
}
```

### Interaction Events

**interaction.click**
```json
{
  "type": "interaction.click",
  "data": {
    "selector": "button.submit",
    "element": {
      "tagName": "button",
      "id": "submit",
      "class": "btn"
    },
    "timestamp": "2026-06-03T10:30:05Z"
  }
}
```

**interaction.fill**
```json
{
  "type": "interaction.fill",
  "data": {
    "selector": "input[name='email']",
    "value": "user@example.com",
    "timestamp": "2026-06-03T10:30:10Z"
  }
}
```

### Error Events

**error.occurred**
```json
{
  "type": "error.occurred",
  "data": {
    "error": "Element not found",
    "code": "ELEMENT_NOT_FOUND",
    "selector": ".nonexistent",
    "severity": "warning",
    "timestamp": "2026-06-03T10:30:15Z"
  }
}
```

### Session Events

**session.created**
```json
{
  "type": "session.created",
  "data": {
    "sessionId": "sess_abc123",
    "name": "research_session",
    "timestamp": "2026-06-03T10:30:00Z"
  }
}
```

**session.destroyed**
```json
{
  "type": "session.destroyed",
  "data": {
    "sessionId": "sess_abc123",
    "duration": 3600000,
    "timestamp": "2026-06-03T10:30:00Z"
  }
}
```

### Proxy Events

**proxy.changed**
```json
{
  "type": "proxy.changed",
  "data": {
    "previousProxy": {
      "host": "proxy1.com",
      "port": 8080
    },
    "currentProxy": {
      "host": "proxy2.com",
      "port": 8080
    },
    "exitIp": "203.0.113.46",
    "exitCountry": "US",
    "timestamp": "2026-06-03T10:30:00Z"
  }
}
```

### Recording Events

**recording.started**
```json
{
  "type": "recording.started",
  "data": {
    "recordingId": "rec_abc123",
    "name": "recording_1",
    "timestamp": "2026-06-03T10:30:00Z"
  }
}
```

**recording.stopped**
```json
{
  "type": "recording.stopped",
  "data": {
    "recordingId": "rec_abc123",
    "duration": 300000,
    "eventCount": 42,
    "timestamp": "2026-06-03T10:30:05Z"
  }
}
```

### Performance Events

**performance.updated**
```json
{
  "type": "performance.updated",
  "data": {
    "pageLoadTime": 2500,
    "domReadyTime": 1200,
    "firstPaint": 850,
    "firstContentfulPaint": 1050,
    "resources": {
      "totalRequests": 45,
      "totalSize": 2048000,
      "averageLatency": 125
    }
  }
}
```

---

## Delivery & Retries

### Delivery Guarantee

- **At Least Once**: Webhooks are delivered at least once
- **Exponential Backoff**: Failed deliveries retry with exponential backoff
- **Timeout**: 30 second delivery timeout
- **Max Retries**: 5 retries over 24 hours

### Retry Schedule

| Attempt | Delay | Cumulative |
|---------|-------|-----------|
| 1 | Immediate | 0s |
| 2 | 1 minute | 1m |
| 3 | 5 minutes | 6m |
| 4 | 30 minutes | 36m |
| 5 | 2 hours | 2h 36m |
| 6 | 10 hours | 12h 36m |

### Webhook Response

**Successful (2xx):**
- `200 OK`
- `201 Created`
- `202 Accepted`
- `204 No Content`

**Failure (non-2xx):**
- Will be retried according to schedule
- Log entry created
- Webhook status updated

### Check Delivery Status

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/webhooks/wh_abc123xyz/deliveries \
  -H "Authorization: Bearer TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deliveries": [
      {
        "id": "del_123",
        "eventId": "evt_456",
        "timestamp": "2026-06-03T10:30:00Z",
        "statusCode": 200,
        "duration": 145,
        "retryCount": 0,
        "success": true
      }
    ]
  }
}
```

---

## Security

### HMAC Signature Verification

All webhook payloads are signed with HMAC-SHA256.

**Signature Header**: `X-Basset-Signature`

**Format**: `sha256=<hex-encoded-signature>`

**Verify Signature (Node.js):**

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// In express middleware
app.post('/webhook/basset', (req, res) => {
  const signature = req.headers['x-basset-signature'];
  const secret = process.env.WEBHOOK_SECRET;

  const rawBody = req.rawBody; // Must capture raw body
  
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process webhook
  res.json({ success: true });
});
```

### Webhook Secret

Get your webhook secret:

**Request:**
```bash
curl -X GET http://localhost:8766/api/v1/webhooks/wh_abc123xyz/secret \
  -H "Authorization: Bearer TOKEN"
```

**Rotate Secret:**
```bash
curl -X POST http://localhost:8766/api/v1/webhooks/wh_abc123xyz/rotate-secret \
  -H "Authorization: Bearer TOKEN"
```

### HTTPS Requirement

- All webhook URLs must be HTTPS
- SSL/TLS certificates must be valid
- Self-signed certificates not recommended for production

### IP Whitelisting

Configure allowed IPs in browser API:

```json
{
  "webhookAllowedIPs": [
    "203.0.113.45",
    "203.0.113.46"
  ]
}
```

---

## Examples

### Example 1: Simple Webhook Receiver

```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.raw({ type: 'application/json' }));

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

app.post('/webhook/basset', (req, res) => {
  // Verify signature
  const signature = req.headers['x-basset-signature'];
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(req.body)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Parse event
  const event = JSON.parse(req.body);
  console.log('Received event:', event.type);

  // Handle event
  handleEvent(event);

  // Acknowledge receipt
  res.json({ success: true });
});

function handleEvent(event) {
  switch (event.type) {
    case 'navigation.complete':
      console.log('Page loaded:', event.data.url);
      break;
    case 'screenshot.taken':
      console.log('Screenshot taken:', event.data.uploadUrl);
      break;
    case 'error.occurred':
      console.error('Error:', event.data.error);
      break;
  }
}

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000');
});
```

### Example 2: Event Processing Pipeline

```javascript
const Queue = require('bull');
const redis = require('redis');

const webhookQueue = new Queue('webhook-events', process.env.REDIS_URL);

app.post('/webhook/basset', async (req, res) => {
  const event = JSON.parse(req.body);

  // Add to queue for processing
  await webhookQueue.add(event, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });

  res.json({ success: true });
});

// Process events asynchronously
webhookQueue.process(async (job) => {
  const event = job.data;

  // Process based on event type
  switch (event.type) {
    case 'navigation.complete':
      await processNavigation(event);
      break;
    case 'screenshot.taken':
      await processScreenshot(event);
      break;
    case 'error.occurred':
      await processError(event);
      break;
  }
});

async function processNavigation(event) {
  // Store event in database
  await db.events.insert(event);

  // Update monitoring dashboard
  await updateDashboard(event);

  // Send notifications if needed
  if (shouldNotify(event)) {
    await sendNotification(event);
  }
}
```

### Example 3: Database Integration

```javascript
const mongoose = require('mongoose');

const WebhookEventSchema = new mongoose.Schema({
  webhookId: String,
  eventId: String,
  type: String,
  data: mongoose.Schema.Types.Mixed,
  timestamp: Date,
  processed: { type: Boolean, default: false }
});

const WebhookEvent = mongoose.model('WebhookEvent', WebhookEventSchema);

app.post('/webhook/basset', async (req, res) => {
  const event = JSON.parse(req.body);

  try {
    // Save to database
    await WebhookEvent.create({
      webhookId: event.webhookId,
      eventId: event.id,
      type: event.type,
      data: event.data,
      timestamp: new Date(event.timestamp)
    });

    // Process event
    await handleEvent(event);

    // Mark as processed
    await WebhookEvent.updateOne(
      { eventId: event.id },
      { processed: true }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});
```

### Example 4: Real-Time Monitoring

```javascript
const io = require('socket.io');

const server = require('http').createServer(app);
const socket = io(server);

app.post('/webhook/basset', async (req, res) => {
  const event = JSON.parse(req.body);

  // Broadcast to connected clients
  io.emit('browser-event', event);

  // Store for dashboard
  dashboardState.lastEvent = event;
  dashboardState.events.push(event);

  // Keep last 100 events
  if (dashboardState.events.length > 100) {
    dashboardState.events.shift();
  }

  res.json({ success: true });
});

// Client-side visualization
io.on('connection', (socket) => {
  // Send current state
  socket.emit('state', dashboardState);

  // Send new events in real-time
  socket.on('get-events', (callback) => {
    callback(dashboardState.events);
  });
});
```

---

## Troubleshooting

### Webhook Not Receiving Events

**Check:**
1. Webhook is active: `GET /webhooks/wh_xxx`
2. URL is HTTPS and accessible
3. Check firewall/network rules
4. Verify event types are subscribed

**Fix:**
```bash
# Test webhook with manual event
curl -X POST http://localhost:8766/api/v1/webhooks/wh_abc123xyz/test \
  -H "Authorization: Bearer TOKEN"
```

### Signature Verification Failing

**Check:**
1. Using correct webhook secret
2. Verifying against raw body (not parsed JSON)
3. Correct HMAC algorithm (sha256)

**Fix:**
```javascript
// ✅ CORRECT: Verify against raw body
const raw = req.rawBody; // Must be Buffer or string
const signature = crypto.createHmac('sha256', secret).update(raw).digest('hex');

// ❌ WRONG: Don't stringify parsed JSON
const body = JSON.stringify(req.body);
// This will have different whitespace and fail
```

### Webhook Delivery Timeout

**Check:**
1. Webhook endpoint is responding in <30 seconds
2. No database queries causing delays
3. No external API calls blocking response

**Fix:**
```javascript
// Process async, respond immediately
app.post('/webhook/basset', async (req, res) => {
  const event = JSON.parse(req.body);
  
  // Respond immediately
  res.json({ success: true });
  
  // Process async
  setImmediate(() => processEvent(event));
});
```

### High Failure Rate

**Check:**
1. Webhook endpoint logs
2. Network connectivity
3. Authentication headers
4. Event payload format

**Fix:**
```bash
# Check delivery history
curl http://localhost:8766/api/v1/webhooks/wh_abc123xyz/deliveries

# Check recent failures
curl http://localhost:8766/api/v1/webhooks/wh_abc123xyz/failures
```

---

## Best Practices

1. **Verify Signatures**: Always verify webhook signatures
2. **Respond Quickly**: Return 2xx status immediately
3. **Handle Duplicates**: Implement idempotent processing
4. **Log Events**: Log all incoming events
5. **Monitor Health**: Track webhook delivery success rate
6. **Use Queues**: Use message queues for async processing
7. **Set Timeouts**: Implement proper timeout handling
8. **Rate Limit**: Implement rate limiting on your endpoint
9. **HTTPS Only**: Never use HTTP for webhooks
10. **Test Thoroughly**: Use webhook test tools during development

