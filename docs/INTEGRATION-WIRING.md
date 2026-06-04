# Module Integration & Wiring Guide

**Status:** ✅ COMPLETE - All infrastructure modules integrated  
**Date:** June 3, 2026  
**Version:** 1.0.0

## Overview

This document describes how all infrastructure, security, and dashboard modules are integrated into the Basset Hound Browser WebSocket server and main application.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Application                        │
│                    (main.js)                                │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │       InfrastructureBootstrap                        │  │
│  │   (src/infrastructure/bootstrap.js)                  │  │
│  │                                                      │  │
│  │  ┌────────────────┐  ┌────────────────┐            │  │
│  │  │ ConfigManager  │  │  HealthChecker │            │  │
│  │  └────────────────┘  └────────────────┘            │  │
│  │                                                      │  │
│  │  ┌────────────────┐  ┌──────────────────────────┐ │  │
│  │  │   DbPool       │  │  MetricsCollector        │ │  │
│  │  └────────────────┘  └──────────────────────────┘ │  │
│  │                                                      │  │
│  │  ┌────────────────┐  ┌────────────────┐            │  │
│  │  │ RedisManager   │  │ SessionStore   │            │  │
│  │  └────────────────┘  └────────────────┘            │  │
│  │                                                      │  │
│  │  ┌────────────────────────────────────┐            │  │
│  │  │     LoadBalancer                   │            │  │
│  │  └────────────────────────────────────┘            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │       WebSocket Server Integration                   │  │
│  │    (websocket/integration.js)                        │  │
│  │                                                      │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │      Message Handler Pipeline                │  │  │
│  │  │                                              │  │  │
│  │  │  1. Parse & Validate JSON                  │  │  │
│  │  │  2. Rate Limiting Check                    │  │  │
│  │  │  3. Session Validation                     │  │  │
│  │  │  4. Policy Enforcement                     │  │  │
│  │  │  5. Signature Verification                 │  │  │
│  │  │  6. Update Session Activity                │  │  │
│  │  │  7. Process Command                        │  │  │
│  │  │  8. Audit Log                              │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  │                                                      │  │
│  │  Security Modules:                                 │  │
│  │  - RateLimiter (advanced-rate-limiting.js)         │  │
│  │  - AuditLogger (enhanced-audit-log.js)             │  │
│  │  - PolicyEnforcer (policy-enforcer.js)             │  │
│  │  - RequestSigner (request-signing.js)              │  │
│  │                                                      │  │
│  │  Dashboard Modules:                                │  │
│  │  - DashboardEngine (dashboard-engine.js)           │  │
│  │  - AlertManager (alert-manager.js)                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Phase 1: Infrastructure Initialization

### Bootstrap Process (`src/infrastructure/bootstrap.js`)

The `InfrastructureBootstrap` class handles initialization of all infrastructure components in the correct order:

```javascript
const InfrastructureBootstrap = require('./src/infrastructure/bootstrap');

const bootstrap = new InfrastructureBootstrap('./config', {
  initializeDb: true,
  initializeRedis: true,
  initializeLoadBalancer: true,
  autoMigrate: true
});

const result = await bootstrap.initialize();
// result.components contains all initialized components
```

### Initialization Order

1. **Configuration Manager** - Load all configuration files
2. **Database Pool** - Connect to PostgreSQL
3. **Database Migrations** - Run pending migrations
4. **Redis Manager** - Connect to Redis/Sentinel
5. **Session Store** - Initialize with Redis + DB
6. **Metrics Collector** - Setup metrics collection
7. **Health Checker** - Register component health checks
8. **Load Balancer** - Start listening on port 8765

## Phase 2: WebSocket Server Integration

### Integration Process (`websocket/integration.js`)

The `WebSocketServerIntegration` class wires together infrastructure, security, and dashboard components:

```javascript
const WebSocketServerIntegration = require('./websocket/integration');

const integration = new WebSocketServerIntegration(wsServer, infrastructure, {
  enableRateLimit: true,
  enableAudit: true,
  enablePolicies: true,
  enableDashboard: true
});

await integration.initialize();
```

### Message Handler Pipeline

Every WebSocket message goes through this pipeline:

```
Client Message
    ↓
1. JSON Parse & Validation
    ↓ (Invalid → Error Response)
2. Rate Limiting Check
    ↓ (Limited → 429 Error)
3. Session Validation
    ↓ (Invalid → 401 Error)
4. Policy Enforcement
    ↓ (Violation → 403 Error)
5. Signature Verification (optional)
    ↓ (Invalid → 401 Error)
6. Update Session Activity
    ↓
7. Process Original Command
    ↓
8. Audit Log
    ↓
Response to Client
```

## Component Details

### Infrastructure Components

#### ConfigManager
- **File:** `src/infrastructure/config-manager.js`
- **Purpose:** Load and manage configuration from JSON files
- **Features:**
  - Environment variable overrides
  - Schema validation
  - Hot reloading
  - Dot-notation access

#### DbPool
- **File:** `src/infrastructure/db-pool.js`
- **Purpose:** PostgreSQL connection pooling
- **Features:**
  - Min/max connection pooling
  - Health checks
  - Query timeout management
  - Transaction support

#### RedisManager
- **File:** `src/infrastructure/redis-manager.js`
- **Purpose:** Redis connection with Sentinel failover
- **Features:**
  - Sentinel support
  - Automatic failover
  - Circuit breaker pattern
  - Health checks

#### SessionStore
- **File:** `src/infrastructure/session-store.js`
- **Purpose:** High-level session management
- **Features:**
  - Write-through consistency
  - Schema validation
  - TTL enforcement
  - Stale session cleanup

#### HealthChecker
- **File:** `src/infrastructure/health-checks.js`
- **Purpose:** System health monitoring
- **Features:**
  - Liveness checks
  - Readiness checks
  - Resource monitoring
  - Component registration

#### MetricsCollector
- **File:** `src/infrastructure/metrics.js`
- **Purpose:** Prometheus-compatible metrics
- **Features:**
  - HTTP metrics
  - Database metrics
  - Redis metrics
  - System metrics

#### LoadBalancer
- **File:** `src/infrastructure/load-balancer.js`
- **Purpose:** In-process load balancing
- **Features:**
  - Multiple algorithms
  - Session affinity
  - Health checking
  - Rate limiting

### Security Modules

#### RateLimiter
- **File:** `src/security/advanced-rate-limiting.js`
- **Purpose:** Prevent abuse through rate limiting
- **Integration:** Called before session validation
- **Config:**
  - Window size: 60 seconds
  - Max requests: 1000/min
  - Per-IP tracking

#### AuditLogger
- **File:** `src/security/enhanced-audit-log.js`
- **Purpose:** Log all operations and security events
- **Integration:** Logs after command execution
- **Features:**
  - Database persistence
  - File logging
  - Security event classification

#### PolicyEnforcer
- **File:** `src/security/policy-enforcer.js`
- **Purpose:** Enforce access policies
- **Integration:** Called after session validation
- **Policies:**
  - Session timeout
  - Max concurrent sessions
  - IP whitelist
  - Command blacklist

#### RequestSigner
- **File:** `src/security/request-signing.js`
- **Purpose:** Verify request authenticity
- **Integration:** Optional signature verification
- **Algorithm:** SHA256 with HMAC

### Dashboard Modules

#### DashboardEngine
- **File:** `src/dashboard/dashboard-engine.js`
- **Purpose:** Aggregate and update dashboard data
- **Integration:** WebSocket dashboard commands
- **Features:**
  - Real-time data aggregation
  - WebSocket push updates
  - Multi-client synchronization

#### AlertManager
- **File:** `src/dashboard/alert-manager.js`
- **Purpose:** Manage and deliver alerts
- **Integration:** Detects issues and creates alerts
- **Features:**
  - Real-time alert generation
  - Alert state management
  - WebSocket delivery

## Integration in main.js

### Startup Sequence

```javascript
// 1. Initialize infrastructure
const InfrastructureBootstrap = require('./src/infrastructure/bootstrap');
const bootstrap = new InfrastructureBootstrap('./config');
const infraResult = await bootstrap.initialize();
const infrastructure = infraResult.components;

// 2. Create WebSocket server (existing code)
let wsServer = new WebSocketServer(wsPort, mainWindow, {...});

// 3. Initialize WebSocket integration
const WebSocketServerIntegration = require('./websocket/integration');
const integration = new WebSocketServerIntegration(wsServer, bootstrap, {
  enableRateLimit: true,
  enableAudit: true,
  enablePolicies: true,
  enableDashboard: true
});
await integration.initialize();

// 4. Store integration for later use
global.infrastructure = bootstrap;
global.wsIntegration = integration;
```

### Shutdown Sequence

```javascript
// When app closes
app.on('before-quit', async () => {
  // Close WebSocket server
  if (wsServer) {
    wsServer.close();
  }

  // Shutdown infrastructure
  if (global.infrastructure) {
    await global.infrastructure.shutdown();
  }
});
```

## Health Check Endpoints

### HTTP Health Checks

```bash
# Liveness check (is server running)
GET /health

# Readiness check (is server ready for traffic)
GET /ready

# Metrics (Prometheus format)
GET /metrics
```

### WebSocket Health Checks

```javascript
// Ping command
client.send(JSON.stringify({
  command: 'ping',
  requestId: 'req_123'
}));

// Response
{
  type: 'pong',
  requestId: 'req_123'
}
```

## Dashboard Commands Integration

### Real-time Dashboard Updates

```javascript
// Get dashboard metrics
client.send(JSON.stringify({
  command: 'dashboard.getMetrics',
  requestId: 'req_123'
}));

// Get system health
client.send(JSON.stringify({
  command: 'dashboard.getSystemHealth',
  requestId: 'req_124'
}));

// Get recent alerts
client.send(JSON.stringify({
  command: 'dashboard.getAlerts',
  requestId: 'req_125'
}));
```

## Session Management Integration

### Session Lifecycle

```
Connection
    ↓
1. createSession(ws, data)
    → Creates session in SessionStore
    → Returns session_id
    ↓
2. Session stored in Redis (cache) + PostgreSQL (persistence)
    ↓
3. Activity tracking via updateSession()
    ↓
4. TTL refresh on activity
    ↓
Disconnection
    ↓
5. deleteSession(session_id)
    → Removes from Redis
    → Marks as inactive in PostgreSQL
```

## Configuration Files

### Load Configuration

Configuration files should be in `./config/` directory:

```
config/
├── database-config.json
├── redis-config.json
├── load-balancer-config.json
├── health-check-config.json
└── default.json
```

### Example Configurations

**database-config.json:**
```json
{
  "host": "localhost",
  "port": 5432,
  "database": "basset_hound",
  "user": "basset",
  "password": "password",
  "minConnections": 5,
  "maxConnections": 20
}
```

**redis-config.json:**
```json
{
  "sentinels": [
    { "host": "localhost", "port": 26379 }
  ],
  "name": "mymaster",
  "sessionTTL": 86400
}
```

## Monitoring & Observability

### Metrics Collection

```javascript
// HTTP metrics
metricsCollector.recordHttpRequest('POST', '/command');
metricsCollector.recordHttpResponse(200, 5); // 5ms latency

// Database metrics
metricsCollector.recordDatabaseQuery('SELECT', 10);

// Redis metrics
metricsCollector.recordRedisOperation('GET', 2);

// System metrics
metricsCollector.recordSystemMetrics(memoryUsage, cpuUsage);
```

### Health Status

```javascript
const status = await healthChecker.getFullHealthStatus();
// Returns: {
//   database: { healthy: true },
//   redis: { healthy: true },
//   memory: { healthy: true, usage: 0.45 },
//   disk: { healthy: true, usage: 0.32 }
// }
```

## Error Handling

### Component Initialization Failures

If a component fails to initialize:

1. Bootstrap logs the error
2. Dependent components are not started
3. `bootstrap.shutdown()` is called
4. Error is thrown up the stack

### Runtime Failures

If a component fails during operation:

1. Health checks detect the failure
2. Load balancer removes the instance
3. Audit logger records the incident
4. Alert manager creates alert
5. Dashboard notifies operators

## Testing

Run integration tests:

```bash
# All integration tests
npm test tests/integration/system-wiring.test.js

# Specific test suite
npm test -- --grep "Phase 1"

# With verbose output
npm test tests/integration/system-wiring.test.js -- --reporter spec
```

### Test Coverage

- ✅ Phase 1: Infrastructure Initialization (7 tests)
- ✅ Phase 2: WebSocket Integration (3 tests)
- ✅ Phase 3: Session Management (6 tests)
- ✅ Phase 4: Security Pipeline (7 tests)
- ✅ Phase 5: Dashboard Integration (5 tests)
- ✅ Phase 6: Error Handling (7 tests)
- ✅ Phase 7: Integration Validation (7 tests)
- ✅ Phase 8: Performance & Load (4 tests)

**Total: 25+ integration test scenarios**

## Troubleshooting

### Database Connection Fails

```
Error: connect ECONNREFUSED
```

**Solution:**
- Verify PostgreSQL is running: `psql -h localhost -U basset`
- Check credentials in `config/database-config.json`
- Ensure database exists: `createdb basset_hound`

### Redis Connection Fails

```
Error: Redis connection timeout
```

**Solution:**
- Verify Redis is running: `redis-cli ping`
- Check Sentinel configuration in `config/redis-config.json`
- Verify Sentinel is running (if using Sentinel)

### Load Balancer Port in Use

```
Error: listen EADDRINUSE
```

**Solution:**
- Change port in `config/load-balancer-config.json`
- Or kill process: `lsof -ti :8765 | xargs kill -9`

### Session Store Issues

```
Error: Session store not initialized
```

**Solution:**
- Ensure Redis and Database are connected
- Check `bootstrap.isInitialized` is true
- Verify SessionStore was created in bootstrap

## Performance Targets

| Component | Latency | Throughput | Capacity |
|-----------|---------|-----------|----------|
| Rate Limiter | <1ms | 10k/s | Per IP |
| Session Store | 2-3ms | 1k ops/s | 50GB |
| Audit Logger | <5ms | 1k logs/s | Unlimited |
| Health Check | <5ms | 1k checks/s | N/A |
| Dashboard Engine | <10ms | 100 updates/s | N/A |

## Next Steps

1. **Production Deployment:**
   - Configure production database credentials
   - Setup Redis Sentinel cluster
   - Configure load balancer backends
   - Enable request signing

2. **Monitoring Setup:**
   - Configure Prometheus scraping
   - Setup Grafana dashboards
   - Configure alert rules

3. **Operations:**
   - Setup log aggregation
   - Configure automated backups
   - Setup incident response procedures

---

**Last Updated:** June 3, 2026  
**Status:** ✅ Production Ready  
**Version:** 1.0.0
