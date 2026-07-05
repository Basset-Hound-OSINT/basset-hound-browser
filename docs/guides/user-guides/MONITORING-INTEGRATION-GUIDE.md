# Monitoring & Metrics System - Integration Guide

## Quick Start

### 1. Initialize the Monitoring System

Add to your WebSocket server startup code:

```javascript
const { initializeMonitoring } = require('./src/monitoring');

// Initialize with default configuration
const monitoring = initializeMonitoring();

// Or with custom configuration
const monitoring = initializeMonitoring({
  collector: {
    windowSize: 60000,      // 1-minute windows
    maxSamples: 10000
  },
  alertManager: {
    cooldownDuration: 30000  // 30s between same alert
  },
  store: {
    maxRetentionMs: 72 * 3600000  // 72 hours
  }
});
```

### 2. Register WebSocket Commands

```javascript
// Register all monitoring commands with your command dispatcher
monitoring.registerHandlers(commandDispatcher, wsServer);
```

### 3. Hook Into Command Execution

```javascript
// In your WebSocket command handler or dispatcher
const startTime = monitoring.metricsCollector.recordCommandStart(commandName, commandId);

try {
  // Execute command
  const result = await executeCommand(commandName, params);
  
  // Record successful completion
  const duration = Date.now() - startTime;
  monitoring.metricsCollector.recordCommandEnd(
    commandId,
    commandName,
    duration,
    true,  // success
    JSON.stringify(result).length  // bytes transferred
  );
} catch (error) {
  // Record error
  monitoring.metricsCollector.recordError(
    error.name || 'UNKNOWN',
    error.message,
    commandName,
    error.stack
  );
  
  // Record failed completion
  const duration = Date.now() - startTime;
  monitoring.metricsCollector.recordCommandEnd(
    commandId,
    commandName,
    duration,
    false,  // failure
    0
  );
}
```

### 4. Hook Into Session Lifecycle

```javascript
// When session is created
monitoring.metricsCollector.recordSessionCreated(sessionId);

// When session is closed
monitoring.metricsCollector.recordSessionClosed(
  sessionId,
  sessionDurationMs,
  commandCount,
  errorCount
);
```

### 5. Hook Into Connection Lifecycle

```javascript
// When WebSocket connects
monitoring.metricsCollector.recordConnectionOpened();

// When WebSocket closes
monitoring.metricsCollector.recordConnectionClosed(connectionDurationMs);
```

### 6. Setup Periodic Metric Storage

```javascript
// Optionally store metrics to disk/database periodically
setInterval(() => {
  const metrics = monitoring.getCurrentMetrics();
  // Store to database/file if needed
  
  // Or use the aggregator for time-series
  const aggregated = monitoring.metricsAggregator.aggregate(metrics, '1m');
  
  // Or store with the store
  monitoring.metricsStore.addSnapshot(metrics);
}, 60000); // Every 60 seconds
```

### 7. Evaluate Alerts

```javascript
// Periodically pass metrics to alert manager for evaluation
setInterval(() => {
  const metrics = monitoring.getCurrentMetrics();
  monitoring.alertManager.evaluateMetrics(metrics);
}, 5000); // Every 5 seconds
```

### 8. Handle Alert Events (Optional)

```javascript
// Listen for alerts if you need to take action
monitoring.alertManager.on('alert', (alert) => {
  console.log(`Alert triggered: ${alert.type}`);
  // Send notifications, log, etc.
});
```

### 9. Graceful Shutdown

```javascript
// Clean up on shutdown
process.on('SIGTERM', () => {
  monitoring.shutdown();
  process.exit(0);
});
```

---

## Available WebSocket Commands

### Get Current Metrics
```json
{
  "id": "req-1",
  "command": "get_metrics"
}
```

### Get Performance Stats
```json
{
  "id": "req-2",
  "command": "get_performance_stats",
  "timeRange": "1m"
}
```

### Get Session Stats
```json
{
  "id": "req-3",
  "command": "get_session_stats"
}
```

### Get Resource Usage
```json
{
  "id": "req-4",
  "command": "get_resource_usage"
}
```

### Get Performance Dashboard
```json
{
  "id": "req-5",
  "command": "get_performance_dashboard",
  "timeRange": "5m"
}
```

### Get Metric History
```json
{
  "id": "req-6",
  "command": "get_metric_history",
  "startTime": 1719705600000,
  "endTime": 1719705660000,
  "granularity": "1m"
}
```

### Stream Real-Time Metrics
```json
{
  "id": "req-7",
  "command": "stream_metrics",
  "interval": 1000
}
```

### Get Alerts
```json
{
  "id": "req-8",
  "command": "get_alerts",
  "severity": "critical",
  "limit": 50
}
```

### Set Alert Threshold
```json
{
  "id": "req-9",
  "command": "set_alert_threshold",
  "alertType": "high_latency",
  "threshold": 150
}
```

### Suppress Alert
```json
{
  "id": "req-10",
  "command": "suppress_alert",
  "alertType": "high_latency",
  "durationMs": 3600000
}
```

---

## Configurable Alert Thresholds

Use `set_alert_threshold` command or configure at initialization:

```javascript
const monitoring = initializeMonitoring({
  alertManager: {
    thresholds: {
      latencyP99: 150,           // milliseconds
      errorRatePercent: 3,       // percent
      successRatePercent: 98,    // percent
      memoryGrowthMbPerHour: 5,
      cpuUsagePercent: 75,
      connectionSpikeDelta: 25,
      sessionMaxDurationMs: 1800000,  // 30 minutes
      memoryThresholdMb: 512
    }
  }
});
```

---

## Example: Complete Integration

```javascript
// websocket/server.js
const { initializeMonitoring } = require('../src/monitoring');

class WebSocketServer {
  async initialize() {
    // Initialize monitoring
    this.monitoring = initializeMonitoring();
    this.monitoring.registerHandlers(this.commandDispatcher, this);

    // Setup metrics storage
    this.metricsInterval = setInterval(() => {
      const metrics = this.monitoring.getCurrentMetrics();
      this.monitoring.metricsStore.addSnapshot(metrics);
      
      // Log high-level stats
      this.logger.info(`Metrics: ${metrics.commands.total} commands, ` +
        `${metrics.sessions.active} active sessions, ` +
        `${metrics.errors.total} errors`);
    }, 60000);

    // Setup alert monitoring
    this.alertInterval = setInterval(() => {
      const metrics = this.monitoring.getCurrentMetrics();
      this.monitoring.alertManager.evaluateMetrics(metrics);
    }, 5000);

    // Alert handler
    this.monitoring.alertManager.on('alert', (alert) => {
      this.logger.warn(`ALERT: ${alert.type} - ${alert.actualValue} > ${alert.threshold}`);
      // Could send to monitoring system, email, etc.
    });
  }

  async handleCommand(ws, data) {
    const commandId = data.id || `${Date.now()}-${Math.random()}`;
    const startTime = this.monitoring.metricsCollector.recordCommandStart(
      data.command,
      commandId
    );

    try {
      const result = await this.commandDispatcher.execute(data.command, data.params);
      
      const duration = Date.now() - startTime;
      this.monitoring.metricsCollector.recordCommandEnd(
        commandId,
        data.command,
        duration,
        result.success,
        JSON.stringify(result).length
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.monitoring.metricsCollector.recordError(
        error.name || 'UNKNOWN',
        error.message,
        data.command,
        error.stack
      );

      this.monitoring.metricsCollector.recordCommandEnd(
        commandId,
        data.command,
        duration,
        false,
        0
      );

      throw error;
    }
  }

  shutdown() {
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    if (this.alertInterval) clearInterval(this.alertInterval);
    if (this.monitoring) this.monitoring.shutdown();
  }
}
```

---

## Troubleshooting

### Metrics Not Appearing
1. Ensure `recordCommandStart()` and `recordCommandEnd()` are called for each command
2. Check that `registerHandlers()` was called with the correct dispatcher
3. Verify WebSocket connection is authenticated if required

### High Memory Usage
1. Reduce retention window: `maxRetentionMs: 24 * 3600000` (24 hours)
2. Reduce sample buffer: `maxSamples: 5000`
3. Check for streaming subscribers not being cleaned up

### Alerts Not Triggering
1. Ensure `alertManager.evaluateMetrics()` is being called periodically
2. Check threshold configuration: `set_alert_threshold` command
3. Check if alert is suppressed: `suppress_alert` command

### Performance Issues
1. Increase aggregation interval (default 60s)
2. Reduce streaming update frequency
3. Check system resource availability

---

## Testing

Run tests to verify installation:

```bash
npm test -- tests/monitoring-metrics.test.js
```

Expected output: 47 tests passing

---

## Performance Targets

- **Metrics Collection:** <0.1% CPU
- **API Response:** <5ms
- **Streaming Latency:** <10ms
- **Memory Usage:** <20MB for 72-hour retention
- **Concurrent Streams:** 100+

---

## Support & Documentation

- Full API Reference: See `docs/API-REFERENCE.md`
- Design Document: See `docs/findings/V12.7.0-FEATURE-MONITORING-PLANNING-2026-06-14.md`
- Handoff: See `docs/handoffs/FEATURE-4-MONITORING-COMPLETE-PHASE-1-2026-06-29.md`

---

## Next Steps

After integration:
1. Test with real workloads
2. Validate alert thresholds match environment
3. Setup dashboard for visualization
4. Plan Phase 2 features (persistence, advanced analytics)
