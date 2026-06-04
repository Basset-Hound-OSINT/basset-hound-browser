# Infrastructure Components Index

## Overview
Wave 16 Phase 1 Infrastructure provides enterprise-grade components for distributed session management, load balancing, health monitoring, and metrics collection.

## Modules

### 1. Load Balancer (`load-balancer.js`)
**Purpose:** Distribute incoming requests across multiple backend instances

**Key Features:**
- Multiple load balancing algorithms (round-robin, least-connections, random)
- Session affinity (sticky sessions with 24-hour TTL)
- Health checking (TCP connect every 5 seconds)
- Rate limiting (100 conn/sec, 1000 req/sec per IP)
- Connection pooling and graceful shutdown
- Comprehensive metrics collection

**Usage:**
```javascript
const LoadBalancer = require('./load-balancer');

const lb = new LoadBalancer({
  port: 8765,
  backends: [
    { host: '127.0.0.1', port: 9001 },
    { host: '127.0.0.1', port: 9002 },
  ],
});

await lb.start();
```

**Performance:**
- Capacity: 100,000 concurrent connections
- Latency: <1ms overhead per connection
- Failover detection: <15 seconds

---

### 2. Redis Manager (`redis-manager.js`)
**Purpose:** Manage Redis Sentinel connections with automatic failover

**Key Features:**
- Redis Sentinel support with automatic failover (<30s)
- Connection pooling (min 5, max 50)
- Circuit breaker pattern (CLOSED/OPEN/HALF_OPEN)
- Health checks every 10 seconds
- Session CRUD operations (create, read, update, delete)
- TTL enforcement (24-hour default)

**Usage:**
```javascript
const RedisManager = require('./redis-manager');

const redis = new RedisManager({
  sentinels: [{ host: 'localhost', port: 26379 }],
  name: 'mymaster',
  sessionTTL: 86400,
});

await redis.connect();
const session = await redis.getSession('sess_123');
```

**Performance:**
- Latency: <1ms (p95), <5ms (p99)
- Capacity: 8,000+ concurrent sessions
- Failover time: <30 seconds

---

### 3. Session Store (`session-store.js`)
**Purpose:** High-level session management with multi-tier storage

**Key Features:**
- Session creation, retrieval, update, deletion
- Schema validation
- Write-through consistency (Redis + PostgreSQL)
- Session integrity checking
- Automatic stale session cleanup
- Event-based notifications

**Usage:**
```javascript
const SessionStore = require('./session-store');

const store = new SessionStore(redisManager, dbPool);

const session = await store.createSession({
  user_id: 'user_1',
  client_ip: '192.168.1.1',
  browser_fingerprint: 'fp_123',
});

const retrieved = await store.getSession(session.session_id);
await store.updateSession(session.session_id, { activity_count: 10 });
await store.deleteSession(session.session_id);
```

**Performance:**
- Create: 2-3ms (Redis + DB)
- Read: <1ms (Redis) or 10-50ms (DB fallback)
- Update: 2-3ms
- TTL: 24 hours with auto-expiration

---

### 4. Database Pool (`db-pool.js`)
**Purpose:** PostgreSQL connection pooling with health checks

**Key Features:**
- Connection pooling (min 10, max 100)
- Health checks every 30 seconds
- Query timeout management (30s default)
- Transaction support (begin, commit, rollback)
- Connection draining on shutdown
- Statistics and monitoring

**Usage:**
```javascript
const DbPool = require('./db-pool');

const pool = new DbPool({
  host: 'localhost',
  port: 5432,
  database: 'basset_hound',
  minConnections: 10,
  maxConnections: 100,
});

await pool.connect();
const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [1]);

// Transactions
const txn = await pool.beginTransaction();
await txn.query('INSERT INTO users VALUES (...)');
await txn.commit();
```

**Performance:**
- Connection limits: 10-100 per pool
- Query timeout: 30 seconds
- Health check: Every 30 seconds

---

### 5. Database Migrations (`migrations.js`)
**Purpose:** Automatic database schema management

**Key Features:**
- Migration versioning and tracking
- 6 default migrations included:
  - `sessions` table (50GB capacity)
  - `monitoring_tasks` table
  - `changes_detected` table
  - `alerts` table
  - `forensic_evidence` table
  - `audit_log` table
- Automatic execution on startup

**Usage:**
```javascript
const Migrations = require('./migrations.js');

const migrations = new Migrations(dbPool);
migrations.initializeDefaultMigrations();
await migrations.runMigrations();
```

**Migrations Included:**
1. `001_create_sessions_table` - Session storage with TTL
2. `002_create_monitoring_tasks_table` - Monitoring task tracking
3. `003_create_changes_detected_table` - Change detection history
4. `004_create_alerts_table` - Alert management
5. `005_create_forensic_evidence_table` - Forensic data storage
6. `006_create_audit_log_table` - Audit trail

---

### 6. Configuration Manager (`config-manager.js`)
**Purpose:** Centralized configuration management with hot reloading

**Key Features:**
- Load configuration from JSON files
- Environment variable overrides (BASSET_* prefix)
- Schema validation (required, type, enum, min/max)
- Hot reloading (watch config files for changes)
- Configuration access via dot notation
- Health status reporting

**Usage:**
```javascript
const ConfigManager = require('./config-manager');

const config = new ConfigManager('./config');

// Register schema
config.registerSchema('database', {
  host: { type: 'string', required: true },
  port: { type: 'number', required: true, min: 1000, max: 65535 },
});

// Load configuration
await config.loadConfig();

// Access values
const host = config.get('database.host');
const section = config.getSection('database');

// Watch for changes
config.watchFile('database');

// Update (in-memory only)
config.set('database.host', 'new-host');
```

**Configuration Files:**
- `load-balancer-config.json` - Load balancer settings
- `redis-config.json` - Redis/Sentinel settings
- `database-config.json` - PostgreSQL settings
- `health-check-config.json` - Health check thresholds

---

### 7. Health Checks (`health-checks.js`)
**Purpose:** System health monitoring with liveness and readiness checks

**Key Features:**
- Liveness checks (is server running)
- Readiness checks (is server ready for traffic)
- System resource monitoring (memory, CPU, disk)
- Component registration and health tracking
- Periodic health check scheduling (every 5 seconds)
- Comprehensive status reporting

**Usage:**
```javascript
const HealthChecker = require('./health-checks');

const health = new HealthChecker({
  checkInterval: 5000,
  memoryThreshold: 0.8, // 80%
  diskThreshold: 0.8,
});

// Register components
health.registerComponent('database', async () => {
  return await checkDatabaseHealth();
});

health.registerComponent('redis', async () => {
  return await checkRedisHealth();
});

// Start checking
health.startHealthChecks();

// Get status
const status = await health.getFullHealthStatus();
const ready = health.isReady();
const healthy = health.isHealthy();
```

**Endpoints:**
- `/health` - Liveness check (is server alive)
- `/ready` - Readiness check (is server ready for traffic)
- `/metrics` - Detailed metrics and component status

---

### 8. Metrics Collector (`metrics.js`)
**Purpose:** Comprehensive metrics collection in Prometheus format

**Key Features:**
- HTTP metrics (requests, responses, latency, errors)
- Database metrics (queries, latency, errors)
- Redis metrics (operations, latency, errors)
- System metrics (memory, CPU, uptime)
- Prometheus-compatible output format
- Percentile calculations (p50, p90, p95, p99)

**Usage:**
```javascript
const MetricsCollector = require('./metrics');

const metrics = new MetricsCollector();

// Record metrics
metrics.recordHttpRequest('GET', '/api/health');
metrics.recordHttpResponse(200, 5); // 5ms latency
metrics.recordDatabaseQuery('SELECT', 10);
metrics.recordRedisOperation('GET', 2);
metrics.recordSystemMetrics(memoryUsage, cpuUsage);

// Get Prometheus format
const prometheusMetrics = metrics.getAllMetrics();

// Get summary
const summary = metrics.getSummary();
```

**Metrics Exposed:**
- HTTP: requests/sec, errors, latency percentiles
- Database: queries/sec, errors, latency percentiles
- Redis: operations/sec, errors, latency percentiles
- System: memory usage, CPU usage, uptime

---

## Integration Example

```javascript
// Initialize all infrastructure components
const LoadBalancer = require('./load-balancer');
const RedisManager = require('./redis-manager');
const SessionStore = require('./session-store');
const DbPool = require('./db-pool');
const Migrations = require('./migrations');
const ConfigManager = require('./config-manager');
const HealthChecker = require('./health-checks');
const MetricsCollector = require('./metrics');

async function initializeInfrastructure() {
  // Load configuration
  const configManager = new ConfigManager('./config');
  await configManager.loadConfig();

  // Initialize database
  const dbPool = new DbPool(configManager.getSection('database'));
  await dbPool.connect();

  // Run migrations
  const migrations = new Migrations(dbPool);
  migrations.initializeDefaultMigrations();
  await migrations.runMigrations();

  // Initialize Redis
  const redisManager = new RedisManager(configManager.getSection('redis'));
  await redisManager.connect();

  // Initialize session store
  const sessionStore = new SessionStore(redisManager, dbPool);

  // Initialize health checks
  const healthChecker = new HealthChecker(configManager.getSection('health-check'));
  healthChecker.registerComponent('database', () => dbPool.query('SELECT 1'));
  healthChecker.registerComponent('redis', () => redisManager.execute('ping'));
  healthChecker.startHealthChecks();

  // Initialize metrics
  const metricsCollector = new MetricsCollector();

  // Initialize load balancer
  const loadBalancer = new LoadBalancer(configManager.getSection('load-balancer'));
  await loadBalancer.start();

  return {
    loadBalancer,
    redisManager,
    sessionStore,
    dbPool,
    configManager,
    healthChecker,
    metricsCollector,
  };
}
```

## Testing

Run infrastructure tests:
```bash
npm test -- tests/infrastructure
```

Test files:
- `tests/infrastructure/load-balancer.test.js` - 22 tests
- `tests/infrastructure/redis-manager.test.js` - 18 tests
- `tests/infrastructure/db-pool.test.js` - 20 tests
- `tests/infrastructure/health-checks.test.js` - 21 tests
- `tests/infrastructure/config-manager.test.js` - 16 tests

## Performance Targets

| Component | Latency | Throughput | Capacity |
|-----------|---------|-----------|----------|
| Load Balancer | <1ms | 10k req/s | 100k conn |
| Redis Manager | <1ms (p95) | 10k ops/s | 8k sessions |
| Database Pool | 10-50ms | 1k queries/s | 100 conn |
| Session Store | 2-3ms | 1k ops/s | 50GB |
| Health Checks | <5ms | 1k checks/s | N/A |
| Metrics | <1ms | 10k events/s | N/A |

## Next Steps

See Phase 2 components:
- API Gateway (request routing, authentication)
- Message Queue (async job processing)
- Stream Processing (real-time pipeline)
- Cache Layer (distributed caching)
- Search/Analytics (ElasticSearch integration)
- Webhook System (event delivery)
- Integration Hub (third-party integration)

---

**Last Updated:** June 3, 2026  
**Status:** Production Ready  
**Version:** 1.0.0
