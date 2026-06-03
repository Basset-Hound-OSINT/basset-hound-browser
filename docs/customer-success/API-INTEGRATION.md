# API Integration Guide: Programmatic Monitoring

For developers: Use the Basset Hound Browser API to create monitors, get alerts, and build custom integrations.

---

## Quick Start: Your First API Call

### 1. Start the Server

```bash
docker run -p 8765:8765 basset-hound-browser:latest
# OR
npm start
```

### 2. Get Your API Token

In Dashboard: Settings → API Token → Copy

### 3. Make Your First API Call

```bash
# Create a monitor
curl -X POST http://localhost:8765/api/v1/monitors \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Amazon Price",
    "url": "https://amazon.com/product",
    "frequency": "every_15_minutes",
    "type": "price_change"
  }'
```

**Response:**
```json
{
  "success": true,
  "monitor": {
    "id": "amazon-price-12345",
    "name": "Amazon Price",
    "url": "https://amazon.com/product",
    "status": "active"
  }
}
```

**Done!** You've created your first monitor via API.

---

## Authentication

### API Token

Get your token:
1. Dashboard → Settings (top-right)
2. Scroll to "API"
3. Copy your token

**Use it in every request:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8765/api/v1/monitors
```

### Token Management

```bash
# Get current token
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8765/api/v1/auth/token

# Rotate token (generates new one)
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  http://localhost:8765/api/v1/auth/rotate
```

---

## Core Endpoints

### Monitors

#### Create a Monitor
```
POST /api/v1/monitors
```

**Request:**
```json
{
  "name": "Monitor Name",
  "url": "https://example.com",
  "frequency": "every_15_minutes",
  "type": "price_change|content_change|any_change",
  "css_selector": ".price",  (optional)
  "min_change_threshold": 5.0,
  "notifications": {
    "slack": true,
    "slack_channel": "#monitoring",
    "email": false,
    "webhook": "https://your-url.com/webhook"
  }
}
```

**Response:**
```json
{
  "success": true,
  "monitor": {
    "id": "unique-monitor-id",
    "name": "Monitor Name",
    "url": "https://example.com",
    "status": "active",
    "created_at": "2026-06-02T14:00:00Z"
  }
}
```

---

#### List Monitors
```
GET /api/v1/monitors
```

**Response:**
```json
{
  "success": true,
  "monitors": [
    {
      "id": "monitor-1",
      "name": "Amazon Price",
      "url": "https://amazon.com/...",
      "status": "active",
      "last_check": "2026-06-02T14:15:00Z",
      "last_alert": "2026-06-02T13:45:00Z"
    },
    {
      "id": "monitor-2",
      "name": "News Feed",
      "url": "https://news.example.com",
      "status": "active",
      "last_check": "2026-06-02T14:10:00Z",
      "last_alert": null
    }
  ]
}
```

---

#### Get Single Monitor
```
GET /api/v1/monitors/{monitor_id}
```

**Response:**
```json
{
  "success": true,
  "monitor": {
    "id": "amazon-price",
    "name": "Amazon Price",
    "url": "https://amazon.com/...",
    "frequency": "every_15_minutes",
    "status": "active",
    "checks": 240,
    "alerts": 12,
    "success_rate": 99.7,
    "last_check": "2026-06-02T14:15:00Z",
    "last_error": null
  }
}
```

---

#### Update Monitor
```
PATCH /api/v1/monitors/{monitor_id}
```

**Request (partial update):**
```json
{
  "frequency": "every_30_minutes",
  "min_change_threshold": 10.0
}
```

**Response:**
```json
{
  "success": true,
  "monitor": {
    "id": "amazon-price",
    "frequency": "every_30_minutes",
    "min_change_threshold": 10.0
  }
}
```

---

#### Delete Monitor
```
DELETE /api/v1/monitors/{monitor_id}
```

**Response:**
```json
{
  "success": true,
  "message": "Monitor deleted"
}
```

---

#### Check Right Now
```
POST /api/v1/monitors/{monitor_id}/check
```

**Response:**
```json
{
  "success": true,
  "check": {
    "status": "completed",
    "duration_ms": 1250,
    "previous_value": "$39.99",
    "current_value": "$29.99",
    "changed": true,
    "alert_sent": true
  }
}
```

---

#### Pause/Resume Monitor
```
POST /api/v1/monitors/{monitor_id}/pause
POST /api/v1/monitors/{monitor_id}/resume
```

**Response:**
```json
{
  "success": true,
  "monitor_id": "amazon-price",
  "status": "paused"
}
```

---

### Alerts

#### Get Recent Alerts
```
GET /api/v1/alerts?limit=50&days=7
```

**Parameters:**
- `limit` - Max results (default: 50, max: 1000)
- `days` - Last N days (default: 1, max: 90)
- `monitor_id` - Filter by monitor (optional)
- `severity` - critical, high, normal (optional)

**Response:**
```json
{
  "success": true,
  "alerts": [
    {
      "id": "alert-12345",
      "monitor_id": "amazon-price",
      "timestamp": "2026-06-02T14:15:00Z",
      "type": "price_change",
      "severity": "high",
      "old_value": "$39.99",
      "new_value": "$29.99",
      "change_percent": -25.0,
      "acknowledged": false
    }
  ],
  "total": 142,
  "page": 1
}
```

---

#### Get Alert Details
```
GET /api/v1/alerts/{alert_id}
```

**Response:**
```json
{
  "success": true,
  "alert": {
    "id": "alert-12345",
    "monitor_id": "amazon-price",
    "monitor_name": "Amazon Widget Price",
    "timestamp": "2026-06-02T14:15:00Z",
    "type": "price_change",
    "severity": "high",
    "old_value": "$39.99",
    "new_value": "$29.99",
    "change": -10.0,
    "change_percent": -25.0,
    "url": "https://amazon.com/...",
    "screenshot_before": "https://basset-hound/screenshots/...",
    "screenshot_after": "https://basset-hound/screenshots/...",
    "html_before": "<div>$39.99</div>",
    "html_after": "<div>$29.99</div>",
    "acknowledged": false
  }
}
```

---

#### Acknowledge Alert
```
PATCH /api/v1/alerts/{alert_id}
```

**Request:**
```json
{
  "acknowledged": true
}
```

**Response:**
```json
{
  "success": true,
  "alert_id": "alert-12345",
  "acknowledged": true
}
```

---

### History & Analytics

#### Get Monitor History
```
GET /api/v1/monitors/{monitor_id}/history?days=30
```

**Response:**
```json
{
  "success": true,
  "monitor_id": "amazon-price",
  "checks": 2880,
  "alerts": 42,
  "success_rate": 99.7,
  "history": [
    {
      "date": "2026-06-02",
      "checks": 96,
      "alerts": 2,
      "success_rate": 100.0,
      "avg_duration_ms": 1200
    }
  ]
}
```

---

#### Export Monitor Data
```
GET /api/v1/monitors/{monitor_id}/export
```

**Parameters:**
- `format` - csv, json, xml (default: json)
- `days` - Last N days to export

**Response: (CSV)**
```
timestamp,old_value,new_value,change,change_percent,alert
2026-06-02T14:15:00Z,$39.99,$29.99,-$10.00,-25.0,true
2026-06-02T13:45:00Z,$29.99,$34.99,+$5.00,+16.7,true
```

---

### Webhooks

#### Register Webhook
```
POST /api/v1/webhooks
```

**Request:**
```json
{
  "url": "https://your-app.com/webhook",
  "events": ["alert", "monitor_error"],
  "active": true
}
```

**Response:**
```json
{
  "success": true,
  "webhook_id": "webhook-12345",
  "url": "https://your-app.com/webhook",
  "events": ["alert", "monitor_error"],
  "created_at": "2026-06-02T14:00:00Z"
}
```

---

#### Webhook Payload

When an alert occurs, we POST to your webhook:

**Request (to your URL):**
```json
{
  "event": "alert",
  "webhook_id": "webhook-12345",
  "timestamp": "2026-06-02T14:15:00Z",
  "alert": {
    "id": "alert-12345",
    "monitor_id": "amazon-price",
    "monitor_name": "Amazon Widget Price",
    "type": "price_change",
    "old_value": "$39.99",
    "new_value": "$29.99",
    "change_percent": -25.0,
    "url": "https://amazon.com/..."
  }
}
```

**Your webhook should respond:**
```json
{
  "success": true
}
```

---

## Examples: Common Integrations

### Example 1: Slack (via Webhook)

```javascript
// In your app that receives webhook
app.post('/webhook/alert', (req, res) => {
  const alert = req.body.alert;
  
  // Send to Slack
  fetch('https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK', {
    method: 'POST',
    body: JSON.stringify({
      text: `Alert: ${alert.monitor_name}`,
      attachments: [{
        color: 'danger',
        fields: [
          { title: 'Old Value', value: alert.old_value },
          { title: 'New Value', value: alert.new_value },
          { title: 'Change', value: `${alert.change_percent}%` }
        ]
      }]
    })
  });
  
  res.json({ success: true });
});
```

---

### Example 2: Create 100 Monitors from CSV

```python
import csv
import requests

TOKEN = "YOUR_TOKEN"
BASE_URL = "http://localhost:8765/api/v1"

# Read monitors from CSV
with open('monitors.csv') as f:
    reader = csv.DictReader(f)
    
    for row in reader:
        monitor = {
            "name": row['name'],
            "url": row['url'],
            "frequency": row['frequency'],
            "type": row['type']
        }
        
        response = requests.post(
            f"{BASE_URL}/monitors",
            headers={"Authorization": f"Bearer {TOKEN}"},
            json=monitor
        )
        
        if response.json()['success']:
            print(f"Created: {row['name']}")
        else:
            print(f"Failed: {row['name']}")
```

**CSV format:**
```
name,url,frequency,type
Amazon Price,https://amazon.com/...,every_15_minutes,price_change
News Feed,https://news.com,every_1_hour,content_change
```

---

### Example 3: Store Alerts in Database

```javascript
const express = require('express');
const app = express();

// Receive webhook and store
app.post('/webhook/alerts', async (req, res) => {
  const alert = req.body.alert;
  
  // Store in database
  await Alert.create({
    monitor_id: alert.monitor_id,
    monitor_name: alert.monitor_name,
    timestamp: alert.timestamp,
    old_value: alert.old_value,
    new_value: alert.new_value,
    change_percent: alert.change_percent,
    url: alert.url
  });
  
  res.json({ success: true });
});

app.listen(3000);
```

---

### Example 4: Price Monitoring Dashboard

```javascript
const fetch = require('node-fetch');

async function getPriceData() {
  const token = 'YOUR_TOKEN';
  
  // Get all price monitors
  const monitors = await fetch(
    'http://localhost:8765/api/v1/monitors',
    { headers: { Authorization: `Bearer ${token}` } }
  ).then(r => r.json());
  
  // Get recent alerts for each
  for (const monitor of monitors.monitors) {
    const alerts = await fetch(
      `http://localhost:8765/api/v1/alerts?monitor_id=${monitor.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(r => r.json());
    
    // Calculate metrics
    const prices = alerts.alerts.map(a => a.new_value);
    console.log(`${monitor.name}:`);
    console.log(`  Current: ${prices[0]}`);
    console.log(`  High: ${Math.max(...prices)}`);
    console.log(`  Low: ${Math.min(...prices)}`);
    console.log(`  Changes: ${alerts.total}`);
  }
}

getPriceData();
```

---

## SDKs & Libraries

### JavaScript/Node.js SDK

```bash
npm install basset-hound-browser
```

```javascript
const Basset = require('basset-hound-browser');

const client = new Basset({
  token: 'YOUR_TOKEN',
  baseUrl: 'http://localhost:8765'
});

// Create monitor
const monitor = await client.monitors.create({
  name: 'Amazon Price',
  url: 'https://amazon.com/product',
  frequency: 'every_15_minutes'
});

// Get alerts
const alerts = await client.alerts.list({ days: 7 });

// Check now
const check = await client.monitors.check(monitor.id);
```

---

### Python SDK

```bash
pip install basset-hound-browser
```

```python
from basset_hound import Basset

client = Basset(token='YOUR_TOKEN')

# Create monitor
monitor = client.monitors.create(
    name='Amazon Price',
    url='https://amazon.com/product',
    frequency='every_15_minutes'
)

# Get alerts
alerts = client.alerts.list(days=7)

# Check now
check = client.monitors.check(monitor.id)
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Monitor not found",
  "error_code": "MONITOR_NOT_FOUND",
  "error_details": {
    "monitor_id": "nonexistent-id"
  }
}
```

### Common Errors

| Error Code | HTTP | Meaning | Fix |
|-----------|------|---------|-----|
| INVALID_TOKEN | 401 | Token missing or invalid | Check your token |
| MONITOR_NOT_FOUND | 404 | Monitor ID doesn't exist | Verify monitor ID |
| INVALID_URL | 400 | URL is malformed | Check URL format |
| RATE_LIMIT | 429 | Too many requests | Wait and retry |
| INTERNAL_ERROR | 500 | Server error | Try again later |

### Example Error Handling

```javascript
try {
  const response = await fetch(`/api/v1/monitors/xyz`, {
    headers: { 'Authorization': 'Bearer TOKEN' }
  });
  
  const data = await response.json();
  
  if (!data.success) {
    console.error(`Error: ${data.error_code} - ${data.error}`);
    // Handle specific errors
    if (data.error_code === 'MONITOR_NOT_FOUND') {
      console.log('Monitor does not exist');
    }
  }
} catch (err) {
  console.error('Network error:', err);
}
```

---

## Rate Limiting

**Limits:**
- 1,000 requests per hour (per token)
- 100 concurrent requests
- 10 MB max request body

**Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1623170400
```

**If rate limited (429):**
```
Retry-After: 3600  (seconds to wait)
```

---

## Best Practices

### 1. Use API Tokens (not passwords)
```javascript
// Good
headers: { Authorization: 'Bearer API_TOKEN' }

// Bad (don't do this!)
headers: { Authorization: 'Bearer USER:PASSWORD' }
```

### 2. Cache Results
```javascript
// Bad: Hit API every second
setInterval(() => {
  getMonitors();  // Every second
}, 1000);

// Good: Hit API every 5 minutes, cache locally
let monitors = [];
setInterval(() => {
  getMonitors().then(data => {
    monitors = data;  // Update cache
  });
}, 5 * 60 * 1000);

// Use cached data
app.get('/monitors', (req, res) => {
  res.json(monitors);  // Serve from cache
});
```

### 3. Handle Errors Gracefully
```javascript
// Good
try {
  const result = await create Monitor();
} catch (err) {
  logger.error('Monitor creation failed', err);
  notifyAdmin();
}

// Bad
const monitor = await createMonitor();  // No error handling
```

### 4. Use Webhooks for Real-Time Updates
```javascript
// Good: Real-time updates via webhook
app.post('/webhook/alert', (req, res) => {
  handleAlert(req.body.alert);
  res.json({ success: true });
});

// Less ideal: Polling API every minute
setInterval(() => {
  getAlerts().then(handleAlerts);
}, 60 * 1000);
```

---

## Troubleshooting API Issues

### "401 Unauthorized"

**Check:**
1. Token is correct: Settings → API Token
2. Token is included in header: `Authorization: Bearer TOKEN`
3. Token hasn't been rotated: Generate new one if needed

---

### "404 Not Found"

**Check:**
1. Monitor ID is correct: `GET /api/v1/monitors` to list
2. Endpoint is spelled correctly
3. Base URL is correct: `http://localhost:8765`

---

### "Rate limit exceeded"

**Solution:**
1. Reduce request frequency
2. Implement caching
3. Use webhooks instead of polling
4. Contact support for higher limits

---

## Next Steps

- See WEBHOOKS-GUIDE.md for webhook details
- See API-REFERENCE.md for complete endpoint docs
- See examples/ folder for code samples
- Join Slack community for help

---

**Ready to build?** Start with a simple monitor, then scale up! 🚀
