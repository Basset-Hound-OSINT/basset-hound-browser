# Change Streams & Alert Streams API

## Overview

Real-time data streaming for changes, alerts, and raw data export. Provides cursor-based pagination, flexible filtering, and multiple subscription models for consuming event streams.

## Change Stream Manager

### Basic Usage

```javascript
const { ChangeStreamManager } = require('./src/features/change-streams');

const manager = new ChangeStreamManager({
  maxBufferSize: 10000  // Keep last 10,000 changes
});

// Record a change
const change = manager.recordChange({
  monitorId: 'monitor-1',
  changeType: 'added',
  oldValue: null,
  newValue: 'new content',
  tags: ['content', 'important'],
  metadata: { source: 'automatic_scan' }
});

// Subscribe to changes
const subId = manager.subscribe({
  monitorId: 'monitor-1',
  changeType: 'modified',
  tags: ['price']
});

// Get changes with pagination
const result = manager.getChanges(subId, {
  limit: 50,
  cursor: null,           // Start from beginning
  direction: 'forward'    // or 'backward'
});

// result: {
//   changes: [...],
//   cursor: 'next-cursor',
//   hasMore: true,
//   count: 50
// }

// Subscribe to live updates
const unsubscribe = manager.onChanges(subId, (change) => {
  console.log('New change:', change);
});

// Search changes
const search = manager.searchChanges({
  monitorId: 'monitor-1',
  changeType: 'added',
  text: 'search-term',
  startTime: Date.now() - 7*24*60*60*1000,
  endTime: Date.now(),
  limit: 100
});
```

### API Reference

#### recordChange(change)

Record a new change in the stream.

```javascript
const change = manager.recordChange({
  monitorId: string,
  changeType: 'added' | 'modified' | 'removed',
  oldValue: any,
  newValue: any,
  tags: string[],
  metadata: object
});
```

Returns change object with id, timestamp, and recorded data.

#### subscribe(filters)

Create a subscription to filtered changes.

```javascript
const subId = manager.subscribe({
  monitorId: 'monitor-1',      // Optional: filter by monitor
  changeType: 'modified',      // Optional: filter by type
  tags: ['price', 'urgent'],   // Optional: filter by any tag
  dateRange: {                 // Optional: filter by date
    start: Date.now() - 7*24*60*60*1000,
    end: Date.now()
  }
});
```

#### getChanges(subscriptionId, options)

Get changes for a subscription with cursor-based pagination.

```javascript
const result = manager.getChanges(subId, {
  limit: 50,                    // Number of records
  cursor: 'change-id-123',      // Start after this change
  direction: 'forward'          // 'forward' or 'backward'
});
```

#### onChanges(subscriptionId, callback)

Subscribe to live change notifications.

```javascript
const unsubscribe = manager.onChanges(subId, (change) => {
  if (change.changeType === 'added') {
    console.log('New item:', change.newValue);
  }
});

// Cleanup
unsubscribe();
```

#### searchChanges(query)

Search recorded changes with full-text search.

```javascript
const results = manager.searchChanges({
  monitorId: 'monitor-1',
  changeType: 'modified',
  text: 'search term',
  startTime: Date.now() - 30*24*60*60*1000,
  endTime: Date.now(),
  limit: 100
});
// { results: [...], total: 245 }
```

#### getStatistics()

Get stream statistics.

```javascript
const stats = manager.getStatistics();
// {
//   totalChanges: 1500,
//   bufferSize: 1500,
//   maxBufferSize: 10000,
//   activeSubscriptions: 3,
//   changesByType: { added: 500, modified: 800, removed: 200 },
//   changesByMonitor: { 'monitor-1': 800, 'monitor-2': 700 }
// }
```

## Alert Stream Manager

### Basic Usage

```javascript
const { AlertStreamManager } = require('./src/features/change-streams');

const alerts = new AlertStreamManager({
  maxBufferSize: 5000
});

// Create alert
const alert = alerts.createAlert({
  monitorId: 'monitor-1',
  severity: 'critical',          // 'critical', 'high', 'medium', 'low'
  type: 'price_change',
  title: 'Price Alert',
  description: 'Price increased by $10',
  details: { oldPrice: 100, newPrice: 110 },
  tags: ['price', 'automated'],
  metadata: {}
});

// Update alert status
alerts.updateAlertStatus(alert.id, 'acknowledged');

// Subscribe to alerts
const subId = alerts.subscribe({
  severity: 'critical',
  status: 'active'
});

// Get alerts
const result = alerts.getAlerts(subId, {
  limit: 50,
  cursor: null
});

// Live notifications
alerts.onAlerts(subId, (alert) => {
  console.log(`${alert.severity}: ${alert.title}`);
});
```

### API Reference

#### createAlert(alert)

Create a new alert.

```javascript
const alert = alerts.createAlert({
  monitorId: string,
  severity: 'critical' | 'high' | 'medium' | 'low',
  type: string,
  title: string,
  description: string,
  details: object,
  tags: string[],
  metadata: object
});
```

#### updateAlertStatus(alertId, status)

Update alert status.

```javascript
alerts.updateAlertStatus(alertId, 'acknowledged');  // or 'resolved'
```

#### subscribe(filters), getAlerts(subId, options), onAlerts(subId, callback)

Same pattern as ChangeStreamManager.

## Data Stream Manager

### Export Functions

```javascript
const { DataStreamManager } = require('./src/features/change-streams');

const streams = new DataStreamManager({
  maxBufferSize: 10000,
  compressionEnabled: true
});

// Register data sources
streams.registerSource('changes', changeManager);
streams.registerSource('alerts', alertManager);

// Export as JSON
const json = streams.exportAsJSON('changes', {
  monitorId: 'monitor-1',
  dateRange: {
    start: Date.now() - 7*24*60*60*1000,
    end: Date.now()
  }
});

// Export as CSV
const csv = streams.exportAsCSV('alerts', {});

// Stream data with compression
for await (const chunk of streams.streamData('changes', {}, 'json')) {
  processChunk(chunk);
}
```

## Filtering

### Change Filters

```javascript
{
  monitorId: 'monitor-1',        // Exact match
  changeType: 'modified',        // Exact match
  tags: ['price', 'critical'],   // Match any tag
  dateRange: {
    start: timestamp,
    end: timestamp
  }
}
```

### Alert Filters

```javascript
{
  monitorId: 'monitor-1',
  severity: 'high',
  status: 'active',
  tags: ['urgent']
}
```

## Pagination

Cursor-based pagination for efficient large result sets:

```javascript
// Get first page
let result = manager.getChanges(subId, { limit: 100 });

// Get next page
while (result.hasMore) {
  result = manager.getChanges(subId, {
    limit: 100,
    cursor: result.cursor
  });
  processResults(result.changes);
}
```

## Performance

- **Change Buffer**: Circular buffer, O(1) recording, configurable size
- **Search**: O(n) linear scan, can be optimized with indexing
- **Pagination**: O(1) cursor lookup, O(k) results fetch
- **Subscriptions**: O(1) filtering per change

## Statistics

```javascript
const changeStats = changeManager.getStatistics();
// {
//   totalChanges: 5000,
//   bufferSize: 5000,
//   activeSubscriptions: 5,
//   changesByType: {...},
//   changesByMonitor: {...}
// }

const alertStats = alertManager.getStatistics();
// {
//   totalAlerts: 250,
//   bufferSize: 250,
//   activeSubscriptions: 3,
//   alertsBySeverity: { critical: 10, high: 50, ... },
//   alertsByType: { price_change: 100, text_change: 150 }
// }
```

## Monitoring

### Event Listeners

```javascript
changeManager.on('change:recorded', (change) => {
  console.log('Change recorded:', change.id);
});

changeManager.on('subscription:created', (data) => {
  console.log('Subscription created:', data.subscriptionId);
});

alertManager.on('alert:created', (alert) => {
  console.log(`Alert: ${alert.severity} - ${alert.title}`);
});

alertManager.on('alert:updated', (data) => {
  console.log(`Alert status updated: ${data.status}`);
});
```

## Testing

```bash
npm test -- tests/features/streams.test.js
```

35 tests covering:
- Change and alert recording
- Subscription and filtering
- Pagination with cursors
- Live notifications
- Search functionality
- Statistics and monitoring

## See Also

- [Webhooks Documentation](./WEBHOOKS.md)
- [Reports Documentation](./REPORTS.md)
- [Data Export Documentation](./EXPORT.md)
