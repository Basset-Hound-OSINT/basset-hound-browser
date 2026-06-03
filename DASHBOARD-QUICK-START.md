# Dashboard Quick Start Guide

## 5-Minute Setup

### 1. Initialize Backend

```javascript
const { DashboardEngine } = require('./src/dashboard/dashboard-engine');
const { AlertManager } = require('./src/dashboard/alert-manager');
const { registerDashboardCommands } = require('./websocket/commands/dashboard-commands');

// Create instances
const dashboard = new DashboardEngine({
  autoRefreshInterval: 300000 // 5 minutes
});
const alertManager = new AlertManager();

// Register with WebSocket
const commandHandlers = {}; // Your WebSocket handlers object
registerDashboardCommands(commandHandlers, dashboard, alertManager);
```

### 2. Add Competitors

```javascript
// Register a competitor monitor
dashboard.registerMonitor({
  id: 'competitor-1',
  url: 'https://competitor.com',
  name: 'Competitor Name'
});

// Repeat for each competitor (up to 50)
```

### 3. Detect Changes

```javascript
// When change detected:
dashboard.addChange('competitor-1', {
  type: 'content_change',
  description: 'Homepage price updated',
  category: 'content', // or technology, structure, performance, security
  severity: 'high' // or critical, medium, low
});
```

### 4. Create Alerts

```javascript
// Create alert for important changes
alertManager.createAlert({
  monitorId: 'competitor-1',
  title: 'Price Change Detected',
  message: 'Competitor reduced prices by 20%',
  severity: 'critical',
  type: 'change_detected'
});
```

### 5. Load Frontend

```html
<!-- Add to your HTML -->
<link rel="stylesheet" href="/path/to/dashboard.css">
<script src="/path/to/dashboard.js"></script>

<!-- Dashboard will auto-initialize and connect to WebSocket -->
```

---

## Common Tasks

### Get Dashboard Data

```javascript
// WebSocket command (from browser)
ws.send(JSON.stringify({
  command: 'get_dashboard_data',
  params: {
    monitorIds: ['competitor-1', 'competitor-2']
  }
}));
```

### Compare Two Competitors

```javascript
ws.send(JSON.stringify({
  command: 'get_competitor_comparison',
  params: {
    monitor_ids: ['competitor-1', 'competitor-2'],
    options: { timeframe: 24 * 60 * 60 * 1000 } // 24 hours
  }
}));
```

### Get Recent Changes

```javascript
ws.send(JSON.stringify({
  command: 'get_monitor_changes',
  params: {
    monitor_id: 'competitor-1',
    options: {
      limit: 50,
      category: 'content' // optional
    }
  }
}));
```

### List All Alerts

```javascript
ws.send(JSON.stringify({
  command: 'get_dashboard_alerts',
  params: {
    status: 'new', // optional: new, acknowledged, dismissed
    severity: 'critical' // optional: critical, high, medium, low
  }
}));
```

### Mark Alert as Read

```javascript
ws.send(JSON.stringify({
  command: 'mark_alert_read',
  params: {
    alert_id: 'alert_xxx'
  }
}));
```

### Batch Dismiss Alerts

```javascript
ws.send(JSON.stringify({
  command: 'batch_dismiss_alerts',
  params: {
    alert_ids: ['alert_1', 'alert_2', 'alert_3']
  }
}));
```

---

## API Commands Reference

### Data Retrieval

| Command | Description |
|---------|-------------|
| `get_dashboard_data` | Full dashboard snapshot |
| `get_monitor_changes` | Changes for specific monitor |
| `get_competitor_comparison` | Compare 2+ competitors |
| `get_dashboard_timeline` | All changes with filtering |
| `get_dashboard_metrics` | Aggregated metrics |
| `get_dashboard_status` | System status |

### Alert Operations

| Command | Description |
|---------|-------------|
| `create_dashboard_alert` | Create new alert |
| `get_dashboard_alerts` | Get alerts with filters |
| `get_unread_alerts` | Get unread alerts only |
| `mark_alert_read` | Single alert |
| `batch_mark_alerts_read` | Bulk operation |
| `acknowledge_alert` | Single alert |
| `batch_acknowledge_alerts` | Bulk operation |
| `dismiss_alert` | Single alert |
| `batch_dismiss_alerts` | Bulk operation |
| `get_alert_summary` | Alert statistics |

### View Management

| Command | Description |
|---------|-------------|
| `create_dashboard_view` | Create custom view |
| `get_dashboard_view` | Render view with content |

---

## Configuration

### Dashboard Engine Options

```javascript
const dashboard = new DashboardEngine({
  maxTimelineEntries: 1000,           // Max entries in timeline
  timelineRetention: 30 * 24 * 60 * 60 * 1000, // 30 days
  aggregationInterval: 300000,        // 5 minutes
  enableAutoAggregation: true
});
```

### Alert Manager Options

```javascript
const alertManager = new AlertManager({
  maxAlerts: 10000,                   // Max alerts in memory
  retentionDays: 30,                  // Auto-delete old alerts
  enableAutoCleanup: true,
  cleanupInterval: 24 * 60 * 60 * 1000 // Daily cleanup
});
```

### Data Aggregator Options

```javascript
const aggregator = new DataAggregator({
  cacheTtl: 5 * 60 * 1000,           // 5 minute cache
  maxCacheSize: 100,                  // Max cache entries
  maxMonitors: 50
});
```

---

## View Types

### Overview View
```javascript
dashboard.createView('overview', {
  type: 'overview',
  monitorIds: ['competitor-1', 'competitor-2'],
  title: 'Executive Summary'
});
```

### Timeline View
```javascript
dashboard.createView('timeline', {
  type: 'timeline',
  monitorIds: ['competitor-1'],
  options: { limit: 100 }
});
```

### Comparison View
```javascript
dashboard.createView('comparison', {
  type: 'comparison',
  monitorIds: ['competitor-1', 'competitor-2', 'competitor-3']
});
```

### Metrics View
```javascript
dashboard.createView('metrics', {
  type: 'metrics',
  options: { refresh: 60000 }
});
```

### Alerts View
```javascript
dashboard.createView('alerts', {
  type: 'alerts',
  options: { severity: 'critical' }
});
```

---

## Event Listening

### Backend Events

```javascript
// Monitor registered
dashboard.on('monitor-registered', (monitor) => {
  console.log('Monitor added:', monitor.name);
});

// Change added
dashboard.on('change-added', (change) => {
  console.log('Change:', change.description);
});

// Alert created
alertManager.on('alert-created', (alert) => {
  console.log('Alert:', alert.title);
});

// Metrics aggregated
dashboard.on('metrics-aggregated', (aggregation) => {
  console.log('Metrics updated:', aggregation.timestamp);
});
```

### Frontend Events

```javascript
// Connection established
dashboard.ws.addEventListener('open', () => {
  console.log('Connected to dashboard');
});

// Real-time update received
dashboard.ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'dashboard-update') {
    console.log('Update:', message.data);
  }
});

// Connection lost
dashboard.ws.addEventListener('close', () => {
  console.log('Disconnected from dashboard');
  // Auto-reconnect in 5 seconds
});
```

---

## Performance Tips

### 1. Use Pagination
```javascript
// Limit results for faster response
{
  limit: 50,
  offset: 0
}
```

### 2. Enable Caching
The aggregator caches results for 5 minutes. Let the cache warm up for better performance.

### 3. Filter Early
```javascript
// Filter on server, not client
get_monitor_changes({
  monitor_id: 'x',
  options: { category: 'content' }
})
```

### 4. Monitor WebSocket Subscribers
```javascript
const status = dashboard.getStatus();
console.log('Subscribers:', status.subscribers);
```

---

## Troubleshooting

### Dashboard Not Updating
1. Check WebSocket connection: `dashboard.ws.readyState === 1`
2. Verify subscribers: `dashboard.subscribers.size > 0`
3. Check browser console for errors

### Memory Usage Growing
1. Monitor timeline size: `dashboard.timeline.length`
2. Check alerts count: `alertManager.alerts.size`
3. Manually trigger cleanup: `alertManager.cleanupExpired()`

### Slow Performance
1. Check cache hit rate: `aggregator.getStats().hitRate`
2. Monitor concurrent connections: `dashboard.subscribers.size`
3. Verify database connection (if using persistence)

### Missing Changes
1. Verify monitor is registered: `dashboard.monitors.has(monitorId)`
2. Check change category: must be valid type
3. Verify subscribers are connected

---

## Testing

### Run All Dashboard Tests
```bash
npm test -- tests/unit/dashboard.test.js
npm test -- tests/unit/dashboard-commands.test.js
```

### Run Specific Test
```bash
npm test -- tests/unit/dashboard.test.js --testNamePattern="should get timeline"
```

### Expected Results
```
Test Suites: 2 passed, 2 total
Tests:       83 passed, 83 total
Time:        0.33s
```

---

## Integration Example

Complete integration example:

```javascript
// 1. Backend setup
const { DashboardEngine } = require('./src/dashboard/dashboard-engine');
const { AlertManager } = require('./src/dashboard/alert-manager');
const { registerDashboardCommands } = require('./websocket/commands/dashboard-commands');

const dashboard = new DashboardEngine();
const alertManager = new AlertManager();
const commandHandlers = {};

registerDashboardCommands(commandHandlers, dashboard, alertManager);

// 2. Register competitors
const competitors = [
  { id: 'amazon', url: 'https://amazon.com', name: 'Amazon' },
  { id: 'ebay', url: 'https://ebay.com', name: 'eBay' },
  { id: 'walmart', url: 'https://walmart.com', name: 'Walmart' }
];

competitors.forEach(comp => dashboard.registerMonitor(comp));

// 3. Simulate change detection
setInterval(() => {
  const randomId = competitors[Math.floor(Math.random() * competitors.length)].id;
  dashboard.addChange(randomId, {
    type: 'content',
    description: 'Homepage updated',
    category: 'content'
  });
}, 60000); // Every minute

// 4. In browser
const dashboardUI = new CompetitorDashboard({
  wsUrl: 'ws://localhost:8765'
});

// 5. Listen for updates
dashboardUI.ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'dashboard-update') {
    console.log('New update:', msg.data);
    // Update UI
  }
});
```

---

## Support & Resources

- **Main Documentation:** `/DASHBOARD-DEVELOPMENT-COMPLETE.md`
- **Test Suite:** `/tests/unit/dashboard*.test.js`
- **API Reference:** See command handlers in WebSocket server
- **Code Examples:** This file and integration example above

---

**Last Updated:** June 2, 2026  
**Dashboard Version:** 1.0 MVP  
**Status:** Production Ready
