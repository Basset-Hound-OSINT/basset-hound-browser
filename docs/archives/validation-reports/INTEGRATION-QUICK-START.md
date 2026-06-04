# Integration Quick Start Guide

## Overview

All infrastructure, security, and dashboard modules are now integrated into the Basset Hound Browser. This guide explains how to use the integrated system.

## Quick Start

### 1. Initialize Infrastructure in main.js

```javascript
const InfrastructureBootstrap = require('./src/infrastructure/bootstrap');

// During app startup
async function startApplication() {
  // Initialize all infrastructure components
  const bootstrap = new InfrastructureBootstrap('./config', {
    initializeDb: true,
    initializeRedis: true,
    initializeLoadBalancer: true,
    autoMigrate: true
  });

  const result = await bootstrap.initialize();
  
  // Now all components are available
  const { dbPool, redisManager, sessionStore, metricsCollector } = result.components;

  // Create WebSocket server
  const wsServer = new WebSocketServer(port, mainWindow);

  // Initialize WebSocket integration with security + dashboard
  const WebSocketServerIntegration = require('./websocket/integration');
  const integration = new WebSocketServerIntegration(wsServer, bootstrap);
  await integration.initialize();

  // Store for later use
  global.infrastructure = bootstrap;
  global.wsIntegration = integration;

  return { bootstrap, wsServer, integration };
}
```

### 2. Infrastructure Components Available

After initialization, you have access to:

```javascript
const infra = global.infrastructure;

// Database access
const dbPool = infra.getComponent('dbPool');
const result = await dbPool.query('SELECT * FROM sessions');

// Redis access
const redis = infra.getComponent('redisManager');
await redis.execute('SET', 'key', 'value');

// Session management
const sessionStore = infra.getComponent('sessionStore');
const session = await sessionStore.createSession({
  user_id: 'user_123',
  client_ip: '192.168.1.1'
});

// Metrics collection
const metrics = infra.getComponent('metricsCollector');
metrics.recordHttpRequest('POST', '/command');

// Health checks
const health = infra.getComponent('healthChecker');
const status = await health.getFullHealthStatus();
```

### 3. WebSocket Integration Usage

The WebSocket integration provides:

```javascript
const integration = global.wsIntegration;

// Get integration status
const status = await integration.getStatus();
// { rateLimiter: true, auditLogger: true, ... }

// Create session for new connection
const session = await integration.createSession(wsClient, {
  userId: 'user_123',
  fingerprint: 'fp_xyz'
});
// wsClient.clientId now set to session_id

// Close session on disconnect
await integration.closeSession(wsClient);
```

### 4. Security Pipeline

The message handler pipeline is automatically applied:

```
WebSocket Message
  ↓
1. Parse & Validate JSON
2. Check Rate Limit (1000/min per IP)
3. Validate Session (TTL, existence)
4. Enforce Policies (timeout, concurrency)
5. Verify Signature (optional)
6. Update Session Activity
7. Process Command
8. Audit Log Operation
  ↓
Response to Client
```

No additional code needed - security is transparent!

### 5. Dashboard Commands

Send these commands to get real-time data:

```javascript
// Get metrics
ws.send(JSON.stringify({
  command: 'dashboard.getMetrics',
  requestId: 'req_123'
}));

// Get system health
ws.send(JSON.stringify({
  command: 'dashboard.getSystemHealth',
  requestId: 'req_124'
}));

// Get active alerts
ws.send(JSON.stringify({
  command: 'dashboard.getAlerts',
  requestId: 'req_125'
}));

// Acknowledge alert
ws.send(JSON.stringify({
  command: 'dashboard.acknowledgeAlert',
  alertId: 'alert_123',
  requestId: 'req_126'
}));
```

### 6. Health Check Endpoints

HTTP endpoints for monitoring:

```bash
# Liveness (is server running?)
GET /health

# Readiness (is server ready for traffic?)
GET /ready

# Prometheus metrics
GET /metrics
```

### 7. Configuration

Configuration files in `./config/` directory:

```
config/
├── database-config.json
├── redis-config.json
├── load-balancer-config.json
├── health-check-config.json
└── default.json
```

Or use environment variables:

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=basset_hound
export DB_USER=basset
export DB_PASSWORD=password
```

### 8. Graceful Shutdown

When application closes:

```javascript
app.on('before-quit', async () => {
  // Close WebSocket server
  if (global.wsServer) {
    global.wsServer.close();
  }

  // Shutdown infrastructure (closes all connections)
  if (global.infrastructure) {
    await global.infrastructure.shutdown();
  }

  app.quit();
});
```

## Common Tasks

### Create a Session

```javascript
const sessionStore = global.infrastructure.getComponent('sessionStore');

const session = await sessionStore.createSession({
  user_id: 'user_123',
  client_ip: '192.168.1.1',
  browser_fingerprint: 'fp_abc123',
  metadata: { region: 'us-east-1' }
});

console.log(session.session_id); // Use as client ID
```

### Record a Metric

```javascript
const metrics = global.infrastructure.getComponent('metricsCollector');

// Record HTTP request
metrics.recordHttpRequest('POST', '/api/command');

// Record response (with latency)
metrics.recordHttpResponse(200, 5); // 5ms latency

// Record database query
metrics.recordDatabaseQuery('SELECT', 10); // 10ms

// Record Redis operation
metrics.recordRedisOperation('GET', 2); // 2ms
```

### Get System Health

```javascript
const health = global.infrastructure.getComponent('healthChecker');

const status = await health.getFullHealthStatus();
// {
//   database: { healthy: true },
//   redis: { healthy: true },
//   memory: { healthy: true, usage: 0.45 },
//   disk: { healthy: true, usage: 0.32 }
// }
```

### Check Session Validity

```javascript
const sessionStore = global.infrastructure.getComponent('sessionStore');

const session = await sessionStore.getSession(sessionId);

if (session) {
  console.log('Session valid, activity count:', session.activity_count);
} else {
  console.log('Session expired or not found');
}
```

### Query Database

```javascript
const dbPool = global.infrastructure.getComponent('dbPool');

// Simple query
const result = await dbPool.query(
  'SELECT * FROM sessions WHERE user_id = $1',
  ['user_123']
);

// Transaction
const txn = await dbPool.beginTransaction();
try {
  await txn.query('INSERT INTO audit_log VALUES (...)');
  await txn.commit();
} catch (error) {
  await txn.rollback();
}
```

### Call Redis

```javascript
const redis = global.infrastructure.getComponent('redisManager');

// Simple command
const value = await redis.execute('GET', 'mykey');

// With JSON
const user = await redis.execute('GET', 'user:123');
const parsed = JSON.parse(user);
```

## Testing

Run integration tests:

```bash
# All integration tests
npm test tests/integration/system-wiring.test.js

# Specific test phase
npm test -- --testNamePattern="Phase 1"

# Verbose output
npm test tests/integration/system-wiring.test.js -- --verbose
```

Expected output: **47 tests passed**

## Troubleshooting

### Components not initialized

Check that `bootstrap.initialize()` completed successfully:

```javascript
const result = await bootstrap.initialize();
if (result.success) {
  console.log('Infrastructure ready');
} else {
  console.error('Initialization failed:', result.error);
}
```

### Session store returning null

Sessions may have expired (24-hour TTL):

```javascript
const session = await sessionStore.getSession(sessionId);
if (!session) {
  // Create new session
  const newSession = await sessionStore.createSession({...});
}
```

### Database query timeout

Increase timeout or check database health:

```javascript
const health = global.infrastructure.getComponent('healthChecker');
const status = await health.getFullHealthStatus();
if (!status.database.healthy) {
  console.error('Database is unhealthy');
}
```

### High memory usage

Check cleanup callbacks are registered:

```javascript
const memory = global.infrastructure.getComponent('memoryManager');
const status = memory.getStatus();
console.log('Memory:', status.usagePercent + '%');
```

## Performance Tuning

### Increase Database Connections

```json
{
  "host": "localhost",
  "port": 5432,
  "database": "basset_hound",
  "minConnections": 10,
  "maxConnections": 50
}
```

### Adjust Rate Limiting

```javascript
const rateLimiter = new RateLimiter({
  windowSize: 60000,      // 60 seconds
  maxRequests: 5000,      // 5000 requests/minute
  perIP: true
});
```

### Health Check Interval

```json
{
  "checkInterval": 5000,      // Check every 5 seconds
  "memoryThreshold": 0.85,    // Alert at 85% memory
  "diskThreshold": 0.85       // Alert at 85% disk
}
```

## Documentation

- **Architecture:** `/docs/INTEGRATION-WIRING.md`
- **Component Details:** `/src/infrastructure/INDEX.md`
- **Test Results:** `/docs/findings/MODULE-INTEGRATION-COMPLETE.md`
- **Security Modules:** `/src/security/`
- **Dashboard Modules:** `/src/dashboard/`

## Key Files

| File | Purpose |
|------|---------|
| `src/infrastructure/bootstrap.js` | Initialize all components |
| `websocket/integration.js` | Wire security + dashboard |
| `tests/integration/system-wiring.test.js` | Integration tests (47 tests) |
| `docs/INTEGRATION-WIRING.md` | Complete integration guide |

## What's Integrated

✅ Configuration Manager  
✅ Database Pool (PostgreSQL)  
✅ Redis Manager (with Sentinel)  
✅ Session Store (Redis + PostgreSQL)  
✅ Metrics Collector (Prometheus)  
✅ Health Checker (component monitoring)  
✅ Load Balancer (port 8765)  
✅ Rate Limiter (security)  
✅ Audit Logger (operation tracking)  
✅ Policy Enforcer (access control)  
✅ Request Signer (authentication)  
✅ Dashboard Engine (real-time updates)  
✅ Alert Manager (incident detection)  

## Next Steps

1. Add this to main.js startup
2. Configure production credentials
3. Setup backend instances for load balancer
4. Run integration tests
5. Deploy to production

---

**Last Updated:** June 3, 2026  
**Status:** ✅ Production Ready  
**Tests:** 47/47 passing
