# Production Monitoring & Alerting Infrastructure

## Overview

Basset Hound Browser v12.0.0 includes a comprehensive enterprise-grade monitoring and alerting infrastructure designed for production deployment. This system provides real-time visibility into system health, performance metrics, and incident management.

**Latest Update:** June 13, 2026  
**Version:** 1.0.0  
**Status:** Production Ready

## Architecture

### Components

The monitoring system consists of 7 integrated components:

```
┌─────────────────────────────────────────────────────────────────┐
│         Monitoring Orchestrator (Central Coordinator)             │
├─────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │  App Metrics     │  │ System Metrics   │  │ Prometheus     │ │
│  │  Collector       │  │ Collector        │  │ Exporter       │ │
│  │                  │  │                  │  │                │ │
│  │ - Commands       │  │ - CPU/Memory     │  │ - /metrics     │ │
│  │ - Messages       │  │ - Disk/Network   │  │ - Scraping     │ │
│  │ - Errors         │  │ - Process        │  │ - Export       │ │
│  │ - Sessions       │  │ - OS Stats       │  │                │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ Alert Rules      │  │ Alert Router     │  │ Health Checks  │ │
│  │ Engine           │  │ & Escalation     │  │                │ │
│  │                  │  │                  │  │ - Component    │ │
│  │ - 30+ rules      │  │ - Slack          │  │   health       │ │
│  │ - Thresholds     │  │ - PagerDuty      │  │ - SLA tracking │ │
│  │ - Anomalies      │  │ - Email          │  │ - History      │ │
│  │ - Severity       │  │ - SMS            │  │                │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Incident Tracker & Management                                 │ │
│  │ - Auto-create from alerts                                     │ │
│  │ - Timeline & context                                          │ │
│  │ - Post-mortem documentation                                   │ │
│  │ - SLA metrics                                                 │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Component Descriptions

### 1. Application Metrics Collector (`app-metrics.js`)

Tracks application-level performance metrics:

**WebSocket Metrics:**
- Commands executed (total, failed, success rate)
- Command latency (histograms with buckets)
- Active commands
- Message throughput (msgs/sec, bytes/sec)
- Message latency and queue depth

**Connection Metrics:**
- Active connections
- Total connections established
- Connection errors
- Reconnection attempts and success rate

**Operations:**
- Session metrics (active, created, closed)
- Data extractions (success/failure)
- Screenshots and navigation
- Cache performance
- HTTP request tracking

**Default Metrics:** 50+ counters, gauges, and histograms

### 2. System Metrics Collector (`system-metrics.js`)

Monitors system-level resources:

**CPU Metrics:**
- CPU usage percentage
- Load average (1m, 5m, 15m)
- Core count
- CPU model information

**Memory Metrics:**
- System memory (total, used, free)
- Process heap (used, total)
- RSS (resident set size)
- External memory
- Array buffers

**Disk Metrics:**
- Total disk space
- Used/available space
- Usage percentage
- Directory size tracking

**Network Metrics:**
- Network interfaces
- Bytes in/out
- Packet counts
- IPv4/IPv6 addresses

**Collection Interval:** 30 seconds (configurable)

### 3. Prometheus Exporter (`prometheus-exporter.js`)

Exposes metrics in Prometheus exposition format:

**Features:**
- HTTP server on port 9090 (configurable)
- `/metrics` endpoint for Prometheus scraping
- `/health` endpoint for health checks
- Support for all metric types (counter, gauge, histogram)
- Proper HELP and TYPE declarations

**Usage:**
```bash
curl http://localhost:9090/metrics
```

### 4. Alert Rules Engine (`alert-rules.js`)

Evaluates metrics against 30+ configured rules:

**Rule Types:**
- **Threshold Rules:** Alert when metric exceeds value
- **Anomaly Rules:** Detect deviations from baseline
- **Rate of Change:** Monitor rapid metric changes
- **Composite Rules:** Multi-metric conditions

**Default Rules Include:**
- High command failure rate (>50 failures)
- High message latency (>1000ms)
- Low throughput (<10 msgs/sec)
- High error rate
- No active connections
- Excessive reconnections
- High memory usage (>500MB heap)
- Memory pressure (>85% system)
- High CPU usage (>80%)
- Disk space critical (>90%)
- Broker errors and queue buildup

**Evaluation:** Every 30 seconds (configurable)  
**Cooldown:** 5 minutes between re-alerts (configurable)

### 5. Alert Router & Escalation (`alert-router.js`)

Routes alerts to appropriate notification channels:

**Channels:**
- **Slack:** Team notifications with rich formatting
- **PagerDuty:** On-call escalation
- **Email:** Critical issue notifications
- **SMS:** Page-worthy events

**Severity-Based Routing:**
| Severity | Channels | Action |
|----------|----------|--------|
| Critical | Slack + PagerDuty + Email + SMS | Page on-call |
| High | Slack + PagerDuty + Email | Notify team |
| Medium | Slack + Email | Team visibility |
| Low | Slack | Log for review |

**Features:**
- Alert suppression (configurable duration)
- Deduplication (prevents duplicate alerts)
- Custom routing rules
- Webhook integration

### 6. Health Checker (`health-checker.js`)

Monitors system component health:

**Components:**
- WebSocket Server (critical)
- Message Broker (critical)
- Database Connection
- Redis Cache
- File Storage
- Slack Integration
- PagerDuty Integration

**Metrics:**
- Component status (up/degraded/down)
- Response time
- Failure count
- Uptime percentage
- Consecutive failures

**SLA Tracking:**
- Historical data (30-day retention)
- Uptime calculation
- SLA compliance (99.9% target)
- Incident frequency

**Check Interval:** 30 seconds

### 7. Incident Tracker (`incident-tracker.js`)

Manages incident lifecycle:

**Features:**
- Auto-create incidents from critical alerts
- Manual incident creation
- Status tracking (created, acknowledged, in-progress, resolved, closed)
- Event timeline
- Post-mortem documentation
- Statistics and trend analysis

**Incident Data:**
- Unique ID (INC-000001)
- Title and description
- Severity and impact level
- Duration and resolution time
- Related alerts
- Event log with timestamps

## Setup & Configuration

### Installation

The monitoring system is built-in to Basset Hound Browser. No additional dependencies required.

```javascript
const { MonitoringOrchestrator } = require('./src/monitoring/monitoring-orchestrator');

const orchestrator = new MonitoringOrchestrator({
  dataDir: '/path/to/data',
  enableAppMetrics: true,
  enableSystemMetrics: true,
  enableAlertRules: true,
  enableAlertRouting: true,
  enableHealthChecks: true,
  enableIncidentTracking: true,
  enablePrometheusExport: true,
  prometheusPort: 9090
});
```

### Configuration Options

#### Main Orchestrator
```javascript
{
  dataDir: '/basset-hound/monitoring',      // Data directory
  enableAppMetrics: true,                   // Enable app metrics
  enableSystemMetrics: true,                // Enable system metrics
  enableAlertRules: true,                   // Enable alerts
  enableAlertRouting: true,                 // Enable routing
  enableHealthChecks: true,                 // Enable health checks
  enableIncidentTracking: true,             // Enable incident management
  enablePrometheusExport: true,             // Enable Prometheus export
  prometheusPort: 9090                      // Prometheus port
}
```

#### Prometheus Exporter
```javascript
{
  port: 9090,                               // HTTP server port
  path: '/metrics',                         // Metrics endpoint path
  hostname: 'localhost',                    // Bind hostname
  includeSystemMetrics: true,               // Include system metrics
  includeAppMetrics: true,                  // Include app metrics
  enableHttpServer: true                    // Enable HTTP server
}
```

#### Alert Router
```javascript
{
  enableSlack: true,
  slackWebhook: 'https://hooks.slack.com/...',
  enablePagerDuty: true,
  pagerDutyToken: 'your-token',
  pagerDutyServiceId: 'service-id',
  suppressionEnabled: true,
  suppressionDuration: 3600000,             // 1 hour
  deduplicationEnabled: true,
  deduplicationWindow: 300000               // 5 minutes
}
```

#### Health Checker
```javascript
{
  checkInterval: 30000,                     // 30 seconds
  retentionPeriod: 2592000000,              // 30 days
  checkTimeout: 5000                        // 5 seconds per check
}
```

#### Incident Tracker
```javascript
{
  dataDir: '/basset-hound/incidents',
  autoCreateFromAlerts: true,
  alertThreshold: 'high'                    // Min severity for auto-create
}
```

## Integration with WebSocket Server

### Recording Metrics

Integrate monitoring with WebSocket server:

```javascript
const { MonitoringOrchestrator } = require('./src/monitoring/monitoring-orchestrator');

const orchestrator = new MonitoringOrchestrator(options);

// In WebSocket command handler
const startTime = Date.now();
try {
  const result = await executeCommand(message);
  const duration = Date.now() - startTime;
  orchestrator.recordCommand(commandName, duration, true);
} catch (e) {
  const duration = Date.now() - startTime;
  orchestrator.recordCommand(commandName, duration, false);
  orchestrator.recordError('command_execution');
}

// Record message exchange
orchestrator.recordMessage('sent', messageSize, latency);

// Record connection events
orchestrator.recordConnection('open');
orchestrator.recordConnection('close', connectionDuration);
```

## Monitoring Dashboards

### Metrics Endpoints

**Prometheus Metrics:**
```
GET /metrics
```
Returns all metrics in Prometheus exposition format.

**Health Status:**
```
GET /health
```
Returns JSON with component health status.

**Dashboard Summary:**
```javascript
const summary = orchestrator.getDashboardSummary();
// Returns comprehensive monitoring snapshot
```

### Key Metrics to Monitor

**Application Health:**
- `websocket_commands_total` - Total commands executed
- `websocket_commands_failed` - Failed commands
- `websocket_message_latency_ms` - Message round-trip latency
- `websocket_throughput_msgs_per_sec` - Messages per second
- `websocket_active_connections` - Active connections
- `websocket_errors_total` - Total errors

**System Health:**
- `system_cpu_usage_percent` - CPU usage (alert: >80%)
- `system_memory_usage_percent` - System memory (alert: >85%)
- `process_memory_heap_used_mb` - Heap memory (alert: >500MB)
- `system_disk_usage_percent` - Disk usage (alert: >90%)
- `process_uptime_seconds` - Process uptime

**Business Metrics:**
- `active_sessions` - Active browser sessions
- `extractions_total` - Total data extractions
- `screenshots_captured` - Screenshots captured
- `cache_hit_ratio` - Cache effectiveness

## Alert Rules

### Critical Alerts

**High Command Failure Rate**
- Threshold: >50 failed commands per minute
- Impact: Commands not executing properly
- Action: Investigate WebSocket server health

**No Active Connections**
- Threshold: 0 active connections
- Impact: Server not accepting connections
- Action: Check server status immediately

**Disk Space Critical**
- Threshold: >90% disk usage
- Impact: Risk of out-of-space errors
- Action: Clean up old data or add storage

### High Priority Alerts

**High Message Latency**
- Threshold: >1000ms round-trip time
- Impact: Slow command execution
- Action: Check network/server performance

**High Memory Usage**
- Threshold: >500MB heap usage
- Impact: Risk of OOM crash
- Action: Check for memory leaks

**Excessive Reconnections**
- Threshold: >10 reconnections per 5 minutes
- Impact: Connection instability
- Action: Investigate network issues

### Medium/Low Alerts

**Low Throughput:** <10 msgs/sec
**High CPU:** >80% sustained
**Memory Pressure:** >85% system memory
**High Error Rate:** Rapid increase in errors

## Incident Management

### Auto-Created Incidents

Critical alerts automatically create incidents:

```
INC-000001 - High Command Failure Rate
  Status: Created (monitoring)
  Severity: Critical
  Impact: Critical
  Events:
    - 14:30:45 - Alert triggered (50+ failures)
    - 14:31:00 - Incident auto-created
    - 14:35:12 - Acknowledged by ops-team
    - 14:42:30 - Incident resolved
  Duration: 12 minutes 45 seconds
```

### Manual Incident Creation

```javascript
const incident = orchestrator.createIncident({
  title: 'Database connectivity issue',
  description: 'PostgreSQL connection pool exhausted',
  severity: 'high',
  createdBy: 'ops-team'
});

// Acknowledge
orchestrator.acknowledgeIncident(incident.id, 'john.doe');

// Resolve
orchestrator.resolveIncident(incident.id, 'Restarted connection pool', 'john.doe');
```

### Incident Statistics

```javascript
const stats = orchestrator.getIncidentStatistics(30);
// Returns: {
//   total: 42,
//   bySeverity: { critical: 2, high: 8, medium: 20, low: 12 },
//   avgResolutionTime: 1245000,  // milliseconds
//   avgDuration: 654000,
//   criticalCount: 2
// }
```

## SLA Tracking

### Health Check SLA

```javascript
const health = orchestrator.getHealthStatus();
// Returns: {
//   status: 'up',
//   uptime: 99.95,
//   criticalIssues: [],
//   warnings: []
// }

const sla = orchestrator.healthChecker.getSLASummary();
// Returns: {
//   slaTarget: '99.9%',
//   actual: '99.87%',
//   compliant: false,
//   allowedDowntime: {
//     minutes: 43,
//     description: '43 minutes per month'
//   }
// }
```

### Incident SLA

Target: Acknowledge critical incidents within 5 minutes  
Target: Resolve critical incidents within 1 hour  

## Alerting Best Practices

### Configuration

1. **Set Appropriate Thresholds**
   - Don't alert on every metric spike
   - Use 2-3 minute evaluation windows
   - Implement cooldown periods

2. **Severity Levels**
   - Critical: System down, data loss risk
   - High: Significant degradation
   - Medium: Performance issues
   - Low: Minor issues, info only

3. **Routing**
   - Page on-call for critical
   - Slack for visibility
   - Suppress known false positives
   - Deduplicate identical alerts

### Silence & Suppression

```javascript
// Suppress alert for 1 hour
orchestrator.alertRouter.suppressAlert(
  'high_memory_usage',
  'memory_heap_used_mb',
  3600000
);

// Unsuppress
orchestrator.alertRouter.unsuppressAlert(
  'high_memory_usage',
  'memory_heap_used_mb'
);
```

## Troubleshooting

### High Alert Volume

1. **Review Alert Rules**
   - Check threshold values
   - Verify condition logic
   - Look for flapping alerts

2. **Adjust Cooldowns**
   - Increase cooldown periods
   - Implement evaluation windows

3. **Suppress False Positives**
   - Suppress known issues
   - Add condition filters

### Missing Metrics

1. **Check Collection**
   ```javascript
   const metrics = orchestrator.getMetrics();
   console.log(metrics.app);
   ```

2. **Verify Integration**
   - Ensure `recordCommand()` calls
   - Check `recordMessage()` integration
   - Validate event recording

3. **Review Prometheus**
   ```bash
   curl http://localhost:9090/metrics
   ```

### Alert Not Triggering

1. **Check Rule Configuration**
   ```javascript
   const rules = orchestrator.getAlertRules();
   console.log(rules);
   ```

2. **Verify Metrics Value**
   - Check current metric value
   - Verify threshold logic

3. **Review Routing**
   - Check alert router status
   - Verify integration credentials

## Production Deployment

### Pre-Deployment Checklist

- [ ] Prometheus port (9090) available
- [ ] Slack webhook configured (optional)
- [ ] PagerDuty token configured (optional)
- [ ] Email service configured (optional)
- [ ] Incident directory writable
- [ ] Retention policies configured
- [ ] Alert rules tuned for your environment
- [ ] Health checks for all critical components
- [ ] Monitoring started before WebSocket server

### Startup Sequence

```javascript
// 1. Initialize monitoring
const orchestrator = new MonitoringOrchestrator(config);

// 2. Set custom health checks
orchestrator.setHealthCheckComponent('database', async () => {
  return await db.ping();
});

// 3. Register custom alert rules (optional)
orchestrator.registerAlertRule({
  name: 'custom_rule',
  severity: 'high',
  metric: 'custom_metric',
  condition: (value) => value > 100
});

// 4. Start WebSocket server
// (monitoring metrics will be recorded)

// 5. Monitor health
const health = await orchestrator.checkHealth();
console.log(health.status); // 'up'
```

### Monitoring the Monitors

Ensure monitoring system itself is healthy:

```javascript
// Get orchestrator status
const report = orchestrator.getMonitoringReport();
console.log(report.status); // 'running'

// Check component health
console.log(report.components);

// Review collected metrics
console.log(report.metrics);
```

## Performance Considerations

### Memory Usage
- App metrics: ~2-5 MB (depends on metric count)
- System metrics: ~1-2 MB
- Alert rules: <1 MB
- Health checker: ~500 KB
- Incident tracker: ~1 MB

**Total:** ~5-10 MB baseline

### CPU Usage
- Metric collection: <1% CPU
- Alert evaluation: <1% CPU
- Health checks: <1% CPU
- Prometheus export: <1% CPU

**Total:** <5% CPU under normal load

### Network Usage
- Prometheus scrape: ~50-100 KB per request
- Alert notifications: Variable (Slack/PagerDuty)
- Health checks: <1 KB per check

## API Reference

### MonitoringOrchestrator

```javascript
// Metrics Recording
orchestrator.recordCommand(name, duration, success, labels)
orchestrator.recordMessage(direction, size, latency)
orchestrator.recordConnection(event, duration)
orchestrator.recordError(type, labels)

// Metrics Retrieval
orchestrator.getMetrics()
orchestrator.getPrometheusMetrics()
orchestrator.getDashboardSummary()

// Alerts
orchestrator.getActiveAlerts()
orchestrator.getAlertSummary()
orchestrator.getAlertRules()
orchestrator.registerAlertRule(config)

// Health
orchestrator.getHealthStatus()
orchestrator.checkHealth()
orchestrator.setHealthCheckComponent(name, fn)

// Incidents
orchestrator.getOpenIncidents()
orchestrator.getIncidentStatistics(days)
orchestrator.createIncident(config)
orchestrator.acknowledgeIncident(id, by)
orchestrator.resolveIncident(id, resolution, by)

// Management
orchestrator.getMonitoringReport()
orchestrator.destroy()
```

## Support & Documentation

- **Prometheus Setup:** See PROMETHEUS-SETUP.md
- **Grafana Dashboards:** See GRAFANA-DASHBOARDS.md
- **Alert Examples:** See ALERT-EXAMPLES.md
- **Troubleshooting:** See TROUBLESHOOTING.md

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jun 13, 2026 | Initial production release |

---

**Last Updated:** June 13, 2026  
**Maintainer:** Basset Hound Development Team
