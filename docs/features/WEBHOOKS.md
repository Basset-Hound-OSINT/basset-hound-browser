# Webhook Management System

## Overview

The Webhook Management System provides enterprise-grade webhook functionality for real-time event integration with external systems. It enables reliable, authenticated delivery of events with built-in retry mechanisms, rate limiting, and comprehensive delivery tracking.

## Features

- **Event Subscription**: Register webhooks for specific event types
- **HMAC Signature Verification**: Secure webhook delivery with SHA-256 signatures
- **Intelligent Retry Logic**: Exponential backoff with configurable retry policies
- **Rate Limiting**: Token bucket algorithm with burst support
- **Dead-Letter Queue**: Automatic storage of failed deliveries for manual retry
- **Event Filtering**: Filter webhooks by monitor ID, event data properties, and custom rules
- **Event Transformation**: Optional custom transformation functions for webhook payloads
- **Real-time Monitoring**: Track delivery statistics and health per webhook
- **Custom Headers**: Support for authentication tokens and custom HTTP headers

## API Reference

### WebhookManager

Main class for webhook management and event dispatching.

#### Constructor

```javascript
const manager = new WebhookManager({
  maxDeadLetterSize: 10000,        // Max failed deliveries to keep
  processingInterval: 1000,        // Queue processing frequency (ms)
  maxConcurrentDeliveries: 5,      // Concurrent delivery threads
  historyRetentionDays: 30         // Keep delivery history (days)
});
```

#### Register Webhook

```javascript
const webhookId = manager.registerWebhook({
  url: 'https://example.com/webhook',
  eventTypes: ['change_detected', 'alert_created'],
  name: 'My Integration',
  secret: 'auto-generated-if-not-provided',
  active: true,
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 300000,
  backoffMultiplier: 2,
  requestsPerSecond: 10,
  burstSize: 20,
  timeout: 30000,
  headers: {
    'Authorization': 'Bearer token',
    'X-Custom': 'value'
  },
  filters: {
    monitorId: 'specific-monitor'  // Optional: filter by property
  },
  metadata: {
    name: 'Production Alert',
    description: 'Sends alerts to ops',
    tags: ['production', 'critical']
  }
});
```

#### Trigger Event

```javascript
const result = await manager.triggerEvent('change_detected', {
  monitorId: 'monitor-1',
  changeType: 'added',
  newValue: 'content'
});

// Returns: { eventType: 'change_detected', scheduled: 1 }
```

#### Get Webhook Details

```javascript
const webhook = manager.getWebhook(webhookId);
// {
//   id: '...',
//   url: 'https://example.com/webhook',
//   eventTypes: ['change_detected'],
//   active: true,
//   stats: {
//     totalAttempts: 10,
//     successfulDeliveries: 9,
//     failedDeliveries: 1,
//     lastAttempt: 1685836800000,
//     lastSuccess: 1685836795000,
//     lastError: 'Connection timeout'
//   }
// }
```

#### List Webhooks

```javascript
const webhooks = manager.listWebhooks({
  active: true,                 // Optional filter
  eventType: 'change_detected', // Optional filter
  tag: 'production'             // Optional filter
});
```

#### Update Webhook

```javascript
manager.updateWebhook(webhookId, {
  active: false,
  eventTypes: ['alert_created'],
  timeout: 60000,
  metadata: {
    description: 'Updated description'
  }
});
```

#### Get Delivery History

```javascript
const history = manager.getDeliveryHistory(webhookId, limit = 100);
// Array of DeliveryRecord objects with timestamps and status
```

#### Dead Letter Queue

```javascript
// Get failed deliveries
const dlq = manager.getDeadLetterQueue(limit = 100);

// Retry specific items
const result = manager.retryDeadLetter(['recordId1', 'recordId2']);

// Retry all DLQ items
const result = manager.retryDeadLetter();
```

#### Statistics

```javascript
// Per-webhook stats
const stats = manager.getStatistics(webhookId);

// Aggregate stats
const allStats = manager.getStatistics();
// {
//   totalWebhooks: 5,
//   activeWebhooks: 4,
//   queuedDeliveries: 2,
//   activeDeliveries: 1,
//   deadLetterSize: 3,
//   webhooks: { id -> stats }
// }
```

## Event Types

Webhooks can subscribe to these standard event types:

- `change_detected` - Page content/structure has changed
- `alert_created` - New alert threshold violated
- `campaign_completed` - Campaign execution finished
- `monitor_updated` - Monitor configuration changed
- `device_online` - Device connection established
- `device_offline` - Device connection lost

### Event Data Structure

```javascript
{
  event: 'change_detected',
  timestamp: 1685836800000,
  data: {
    monitorId: 'monitor-1',
    changeType: 'added',
    oldValue: null,
    newValue: 'new content',
    tags: ['content'],
    // ... additional properties
  }
}
```

## Security

### Webhook Signatures

All webhook POST requests include HMAC-SHA256 signatures in the `X-Basset-Signature` header:

```
X-Basset-Signature: sha256=<hex-encoded-signature>
X-Basset-Timestamp: 1685836800000
```

**Verification (Node.js):**

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

### Rate Limiting

Each webhook has independent rate limiting using token bucket algorithm:

```javascript
// 10 requests/sec, burst up to 20
{
  requestsPerSecond: 10,
  burstSize: 20
}
```

When rate limit exceeded, webhook delivery is requeued with exponential backoff.

## Retry Logic

Failed deliveries use exponential backoff:

```
delay = min(
  initialDelay * (backoffMultiplier ^ attempt),
  maxDelay
)
```

Example with defaults (1s initial, 2x multiplier, 5 min max):
- Attempt 1: 1 second
- Attempt 2: 2 seconds
- Attempt 3: 4 seconds
- Attempt 4: 8 seconds
- Attempt 5: 16 seconds

After max retries exceeded, delivery moves to Dead Letter Queue.

## Examples

### Basic Setup

```javascript
const { WebhookManager } = require('./src/features/webhooks');

const manager = new WebhookManager();

// Register webhook
const id = manager.registerWebhook({
  url: 'https://myapp.com/webhooks/basset',
  eventTypes: ['change_detected', 'alert_created'],
  name: 'MyApp Integration'
});

// Subscribe to events
manager.on('event:triggered', (data) => {
  console.log(`Triggered ${data.eventType} to ${data.webhookCount} webhooks`);
});

manager.on('delivery:success', (data) => {
  console.log(`Delivery successful: ${data.statusCode}`);
});

manager.on('delivery:failed', (data) => {
  console.error(`Delivery failed: ${data.error}`);
});

// Trigger events
await manager.triggerEvent('change_detected', {
  monitorId: 'monitor-1',
  changeType: 'added',
  newValue: 'new content'
});

// Cleanup
manager.destroy();
```

### Production Webhook with Auth

```javascript
const webhookId = manager.registerWebhook({
  url: 'https://api.example.com/webhooks/basset',
  eventTypes: ['change_detected', 'alert_created', 'campaign_completed'],
  name: 'Production API',
  maxRetries: 10,
  timeout: 60000,
  headers: {
    'Authorization': `Bearer ${process.env.WEBHOOK_SECRET}`,
    'X-API-Version': '2.0',
    'X-Client-ID': 'basset-hound-001'
  },
  filters: {
    monitorId: 'prod-monitor-1'
  },
  metadata: {
    name: 'Production Integration',
    tags: ['production', 'critical'],
    owner: 'ops@example.com'
  }
});
```

### Handling Webhook Payload

```javascript
// Your webhook endpoint
app.post('/webhooks/basset', (req, res) => {
  const signature = req.headers['x-basset-signature'];
  const timestamp = req.headers['x-basset-timestamp'];
  
  // Verify signature
  const secret = process.env.BASSET_WEBHOOK_SECRET;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (signature !== `sha256=${expected}`) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Verify timestamp (< 5 minutes old)
  const age = Date.now() - parseInt(timestamp);
  if (age > 5 * 60 * 1000) {
    return res.status(401).json({ error: 'Timestamp too old' });
  }
  
  // Process webhook
  const { event, data } = req.body;
  
  if (event === 'change_detected') {
    handleChange(data);
  } else if (event === 'alert_created') {
    handleAlert(data);
  }
  
  res.json({ success: true });
});
```

## Performance

- **Delivery Throughput**: ~1,000 webhooks/second per process
- **Latency**: <10ms average latency per delivery attempt
- **Reliability**: At-least-once delivery guarantee with retries
- **Memory**: ~1KB per webhook, ~100B per delivery record

## Monitoring

### Key Metrics

```javascript
const stats = manager.getStatistics();

console.log(`Total webhooks: ${stats.totalWebhooks}`);
console.log(`Active deliveries: ${stats.activeDeliveries}`);
console.log(`Queued: ${stats.queuedDeliveries}`);
console.log(`Dead letter: ${stats.deadLetterSize}`);

// Per-webhook stats
for (const [webhookId, webhookStats] of Object.entries(stats.webhooks)) {
  console.log(`${webhookId}:`);
  console.log(`  Total attempts: ${webhookStats.totalAttempts}`);
  console.log(`  Success rate: ${(webhookStats.successfulDeliveries / webhookStats.totalAttempts * 100).toFixed(1)}%`);
  console.log(`  Last error: ${webhookStats.lastError}`);
}
```

### Event Listeners

```javascript
manager.on('webhook:registered', (data) => {
  console.log(`Webhook registered: ${data.webhookId}`);
});

manager.on('webhook:updated', (data) => {
  console.log(`Webhook updated: ${data.webhookId}`);
});

manager.on('event:triggered', (data) => {
  console.log(`Event triggered: ${data.eventType} to ${data.webhookCount} webhooks`);
});

manager.on('delivery:success', (data) => {
  console.log(`Delivery success: ${data.statusCode}`);
});

manager.on('delivery:retry', (data) => {
  console.log(`Delivery retry: attempt ${data.attempt}, next in ${data.nextRetryMs}ms`);
});

manager.on('delivery:failed', (data) => {
  console.log(`Delivery failed: ${data.error}`);
});
```

## Testing

```bash
npm test -- tests/features/webhook.test.js
```

36 tests covering:
- Webhook registration and lifecycle
- Event triggering and filtering
- Rate limiting and backoff
- Signature generation and verification
- Dead letter queue management
- Statistics tracking
- Event emission

## Troubleshooting

### Webhooks Not Firing

1. Check webhook is active: `webhook.active === true`
2. Verify event type matches: `webhook.eventTypes.includes(eventType)`
3. Check filters match event data: `webhook.shouldHandleEvent(eventType, data)`
4. Monitor delivery history: `manager.getDeliveryHistory(webhookId)`

### Repeated Failures

1. Check Dead Letter Queue: `manager.getDeadLetterQueue()`
2. Verify webhook endpoint is accessible and returning 2xx status
3. Check rate limiting isn't causing delays
4. Review error messages in delivery history
5. Adjust timeout if endpoint is slow

### Performance Issues

1. Reduce `maxConcurrentDeliveries` if overwhelmed
2. Increase `processingInterval` to batch process deliveries
3. Monitor `deadLetterSize` - indicates systemic issues
4. Check system resources (CPU, memory, network)

## API Stability

This API is stable and production-ready as of v1.0.0. The following operations are guaranteed backward compatible:
- Event triggering
- Webhook registration
- Statistics retrieval
- Delivery history access

Minor changes may occur to:
- Internal retry algorithm tuning
- Dead letter queue implementation

## See Also

- [Streams Documentation](./STREAMS.md)
- Reports Documentation
- [Data Export Documentation](./EXPORT.md)
