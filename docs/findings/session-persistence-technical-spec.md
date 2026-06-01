# Session Persistence Backend - Technical Specification

**Document:** Detailed Technical Specification  
**Version:** 1.0  
**Date:** June 1, 2026  
**Target Implementation:** June 29 - July 13, 2026  

---

## 1. Failure Recovery System

### 1.1 Architecture

```
Session State
    ↓
Operation Attempt
    ↓
[Success] → Log history → Continue
    ↓
[Failure] → Detect type → Get strategies → Auto-recover
    ↓
Recovery Loop:
  - Select next strategy
  - Apply action (wait, rotate, branch, etc.)
  - Retry operation
  - Track attempt
  - On success: Resume normal flow
  - On max attempts: Mark session failed, return error
```

### 1.2 Class Definition

```javascript
class FailureRecovery {
  constructor(options = {}) {
    this.backoffConfig = {
      initialDelay: options.initialDelay || 100,      // ms
      maxDelay: options.maxDelay || 30000,             // 30s
      multiplier: options.multiplier || 2.0,
      jitterFraction: options.jitterFraction || 0.1    // ±10%
    };
    
    this.maxRetries = options.maxRetries || 5;
    this.recoveryStates = new Map();                   // sessionId -> state
  }

  // Core Methods
  async detectFailure(error, sessionId)
  async getRecoveryStrategy(failureType, attemptNumber)
  async executeRecovery(sessionId, strategy, context)
  async calculateBackoff(attemptNumber)
  async retry(sessionId, operation, context)
  
  // Tracking & Telemetry
  trackAttempt(sessionId, strategy, success, duration)
  getRecoveryStats(sessionId)
  
  // Configuration
  setRecoveryStrategies(failureType, strategies)
  getRecoveryStrategies(failureType)
}
```

### 1.3 Failure Types & Strategies

#### Rate Limit (429)
```javascript
strategies: [
  {
    priority: 1,
    action: 'wait',
    duration: exponentialBackoff(attempt),
    timeout: 30000,
    successRate: 0.92
  },
  {
    priority: 2,
    action: 'rotate_proxy',
    successRate: 0.78
  },
  {
    priority: 3,
    action: 'rotate_user_agent',
    successRate: 0.65
  },
  {
    priority: 4,
    action: 'branch_session',
    successRate: 0.88
  }
]
```

#### Bot Detected
```javascript
strategies: [
  {
    priority: 1,
    action: 'rotate_fingerprint',
    successRate: 0.88
  },
  {
    priority: 2,
    action: 'enable_behavioral_patterns',
    successRate: 0.82
  },
  {
    priority: 3,
    action: 'wait',
    duration: 300000,  // 5 min
    successRate: 0.79
  },
  {
    priority: 4,
    action: 'branch_session',
    successRate: 0.91
  }
]
```

#### Forbidden (403/401)
```javascript
strategies: [
  {
    priority: 1,
    action: 'rotate_fingerprint',
    successRate: 0.82
  },
  {
    priority: 2,
    action: 'rotate_proxy',
    successRate: 0.75
  },
  {
    priority: 3,
    action: 'clear_cookies',
    successRate: 0.68
  },
  {
    priority: 4,
    action: 'branch_session',
    successRate: 0.85
  }
]
```

#### Connection Lost
```javascript
strategies: [
  {
    priority: 1,
    action: 'restore_from_checkpoint',
    successRate: 0.96
  },
  {
    priority: 2,
    action: 'retry',
    duration: 5000,
    successRate: 0.85
  },
  {
    priority: 3,
    action: 'reconnect_proxy',
    successRate: 0.78
  }
]
```

### 1.4 Backoff Calculation

```javascript
// Exponential backoff with jitter
function calculateBackoff(attempt, config) {
  const exponential = config.initialDelay * 
                      Math.pow(config.multiplier, attempt);
  
  const capped = Math.min(exponential, config.maxDelay);
  
  const jitter = capped * 
                 config.jitterFraction * 
                 (Math.random() * 2 - 1);
  
  return Math.max(0, capped + jitter);
}

// Examples:
// Attempt 0: ~100ms + jitter
// Attempt 1: ~200ms + jitter
// Attempt 2: ~400ms + jitter
// Attempt 3: ~800ms + jitter
// Attempt 4: ~1600ms + jitter
// Attempt 5: ~30000ms (capped)
```

### 1.5 Recovery State Tracking

```javascript
recoveryState = {
  sessionId: 'xyz123',
  failureType: 'rate_limit',
  firstFailureTime: timestamp,
  lastFailureTime: timestamp,
  attemptCount: 3,
  nextRetryTime: timestamp,
  nextRetryDelay: 800,
  strategies: [
    {
      action: 'wait',
      appliedAt: timestamp,
      result: 'pending',  // pending, success, failed
      duration: 1000
    }
  ],
  successRate: 0.0,  // Will update with each attempt
  totalDuration: 2100,
  backoffHistory: [100, 200, 400, 800]
}
```

---

## 2. Session History Module

### 2.1 Database Schema

```sql
CREATE TABLE IF NOT EXISTS session_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  parameters TEXT,
  result TEXT,
  error TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL,
  priority INTEGER,
  timestamp INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_session_ops ON session_operations(session_id, timestamp);
CREATE INDEX idx_op_type ON session_operations(operation_type);
CREATE INDEX idx_status ON session_operations(status);
CREATE INDEX idx_timestamp ON session_operations(timestamp);
```

### 2.2 Operation Record

```javascript
{
  id: number,
  sessionId: string,
  operationType: 'navigate|click|fill|extract|screenshot|...',
  parameters: { /* operation-specific params */ },
  result: { /* operation output */ },
  error: string | null,
  durationMs: number,
  status: 'success|error|partial|timeout',
  priority: number,
  timestamp: number,
  createdAt: ISO8601
}
```

### 2.3 Class Definition

```javascript
class SessionHistory {
  constructor(options = {}) {
    this.dbPath = options.dbPath || '/tmp/basset-history.db';
    this.retentionDays = options.retentionDays || 30;
    this.autoCleanup = options.autoCleanup !== false;
    
    this.db = null;
    this.initializeDatabase();
  }

  // Core Operations
  async logOperation(sessionId, operation)
  async logError(sessionId, operationType, error, context)
  async logSuccess(sessionId, operationType, result, duration)

  // Query API
  async getHistory(sessionId, filters = {})
  async getHistoryByDateRange(sessionId, startTime, endTime)
  async getHistoryByOperation(sessionId, operationType)
  async getHistoryByStatus(sessionId, status)
  async getStatistics(sessionId)

  // Export
  async exportJSON(sessionId)
  async exportCSV(sessionId)
  async exportForensic(sessionId)  // Detailed audit trail

  // Maintenance
  async cleanup()
  async clearSession(sessionId)
  async getStorageStats()
}
```

### 2.4 Query Examples

```javascript
// Get last 10 operations
getHistory(sessionId, { limit: 10, sort: 'desc' })

// Get operations in time range
getHistoryByDateRange(sessionId, startTime, endTime)

// Get all failed operations
getHistoryByStatus(sessionId, 'error')

// Get statistics
getStatistics(sessionId)
// Returns: {
//   totalOperations: 247,
//   successCount: 230,
//   errorCount: 17,
//   successRate: 0.932,
//   avgDuration: 245,
//   minDuration: 12,
//   maxDuration: 3400,
//   operationTypes: { navigate: 45, click: 120, extract: 82 },
//   errorTypes: { rate_limit: 8, bot_detected: 5, connection_lost: 4 }
// }

// Export as CSV
exportCSV(sessionId)
// timestamp,operation,duration_ms,status,error
// 1719571200000,navigate,245,success,
// 1719571500000,click,120,success,
```

### 2.5 Retention Policy

```javascript
// Default: Keep 30 days
// On startup: Delete records older than 30 days
// On INSERT: Check if space needed, cleanup if >1GB

cleanupPolicy = {
  defaultRetentionDays: 30,
  maxDatabaseSize: 1073741824,  // 1GB
  checkFrequency: 3600000,      // 1 hour
  autoCleanup: true
}
```

---

## 3. Campaign Manager

### 3.1 Architecture

```
Campaign
├── Sessions (parallel)
│   ├── Session 1: navigate, extract, wait
│   ├── Session 2: navigate, screenshot, wait
│   └── Session 3: navigate, click, extract
├── Operations
│   ├── Op 1: session1.navigate (wait: none)
│   ├── Op 2: session2.navigate (wait: none)
│   ├── Op 3: session3.navigate (wait: none)
│   ├── Op 4: session1.extract (wait: Op 1)
│   ├── Op 5: session2.screenshot (wait: Op 2)
│   └── Op 6: AGGREGATE (wait: Op 4, Op 5)
└── Results
    └── Combined findings from all sessions
```

### 3.2 Class Definition

```javascript
class CampaignManager {
  constructor(options = {}) {
    this.maxParallelSessions = options.maxParallelSessions || 10;
    this.operationTimeout = options.operationTimeout || 60000;
    
    this.campaigns = new Map();           // campaignId -> campaign
    this.sessionPool = new Map();         // campaignId -> sessions
    this.operationQueue = new Map();      // campaignId -> operations
  }

  // Campaign Lifecycle
  async createCampaign(name, config = {})
  async addSessionsToCampaign(campaignId, sessionCount)
  async addOperations(campaignId, operations)
  async startCampaign(campaignId)
  async pauseCampaign(campaignId)
  async resumeCampaign(campaignId)
  async cancelCampaign(campaignId)

  // Operation Management
  async executeOperation(campaignId, operationId)
  async awaitDependencies(operationId)
  async resolveOperationOrder()

  // Results & Aggregation
  async getResults(campaignId)
  async aggregateResults(campaignId, aggregationFn)
  async getCampaignStatus(campaignId)
  async getCampaignStatistics(campaignId)
}
```

### 3.3 Campaign State Machine

```
PLANNING
  ├─ addSessions()
  ├─ addOperations()
  ├─ setConfig()
  └─ startCampaign()
     ↓
RUNNING
  ├─ Operations execute (parallel, respecting dependencies)
  ├─ pauseCampaign() → PAUSED
  └─ [All operations complete] → COMPLETED
     ↓
PAUSED
  ├─ resumeCampaign() → RUNNING
  └─ cancelCampaign() → CANCELLED
     ↓
COMPLETED / CANCELLED / FAILED
  └─ getResults()
```

### 3.4 Operation Definition

```javascript
operation = {
  id: 'op-uuid',
  type: 'navigate|click|fill|extract|screenshot|wait|aggregate',
  sessionId: 'session-uuid',  // null for aggregate ops
  params: {
    // Operation-specific parameters
    // For 'navigate': { url: '...' }
    // For 'click': { selector: '...' }
    // For 'extract': { type: 'html|text|images' }
    // For 'aggregate': { fn: aggregationFunction }
  },
  dependencies: ['op-id-1', 'op-id-2'],  // Wait for these
  timeout: 60000,
  status: 'pending|running|completed|failed|timeout',
  result: {},
  error: null,
  createdAt: timestamp,
  startedAt: timestamp,
  completedAt: timestamp,
  duration: number
}
```

### 3.5 Example Campaign

```javascript
const campaign = await campaignManager.createCampaign(
  'Competitor Price Monitoring',
  { maxParallelSessions: 3 }
);

// Add 3 sessions
await campaignManager.addSessionsToCampaign(campaign.id, 3);

// Define operations
await campaignManager.addOperations(campaign.id, [
  {
    id: 'nav1',
    type: 'navigate',
    sessionId: 'session-1',
    params: { url: 'https://competitor1.com/pricing' },
    dependencies: []
  },
  {
    id: 'nav2',
    type: 'navigate',
    sessionId: 'session-2',
    params: { url: 'https://competitor2.com/pricing' },
    dependencies: []
  },
  {
    id: 'nav3',
    type: 'navigate',
    sessionId: 'session-3',
    params: { url: 'https://competitor3.com/pricing' },
    dependencies: []
  },
  {
    id: 'ext1',
    type: 'extract',
    sessionId: 'session-1',
    params: { type: 'html' },
    dependencies: ['nav1']
  },
  {
    id: 'ext2',
    type: 'extract',
    sessionId: 'session-2',
    params: { type: 'html' },
    dependencies: ['nav2']
  },
  {
    id: 'ext3',
    type: 'extract',
    sessionId: 'session-3',
    params: { type: 'html' },
    dependencies: ['nav3']
  },
  {
    id: 'agg',
    type: 'aggregate',
    params: {
      fn: (results) => ({
        competitor1: parsePrice(results.ext1),
        competitor2: parsePrice(results.ext2),
        competitor3: parsePrice(results.ext3),
        lowest: Math.min(...)
      })
    },
    dependencies: ['ext1', 'ext2', 'ext3']
  }
]);

// Execute campaign
await campaignManager.startCampaign(campaign.id);

// Monitor progress
const status = await campaignManager.getCampaignStatus(campaign.id);
// { status: 'RUNNING', completed: 4, total: 7, progressPercent: 57 }

// Get final results
const results = await campaignManager.getResults(campaign.id);
// { competitor1: 99.99, competitor2: 89.99, competitor3: 94.99, lowest: 89.99 }
```

---

## 4. WebSocket Commands

### 4.1 Command: save_session_snapshot

**Purpose:** Manually persist session state at critical points

**Request:**
```javascript
{
  command: 'save_session_snapshot',
  sessionId: 'xyz123',
  metadata: {
    checkpoint: 'after_login',
    purpose: 'pre-extraction'
  }
}
```

**Response:**
```javascript
{
  success: true,
  snapshotId: 'snap-abc123',
  size: 4096,
  compressed: false,
  timestamp: 1719571200000,
  checksum: 'sha256-hash'
}
```

### 4.2 Command: load_session_checkpoint

**Purpose:** Resume session from specific checkpoint

**Request:**
```javascript
{
  command: 'load_session_checkpoint',
  sessionId: 'xyz123',
  checkpointId: 'cp-def456'
}
```

**Response:**
```javascript
{
  success: true,
  checkpointId: 'cp-def456',
  checkpointName: 'after_login',
  state: {
    url: 'https://example.com/dashboard',
    cookies: { ... },
    requestCount: 47
  },
  timestamp: 1719571200000
}
```

### 4.3 Command: get_session_history

**Purpose:** Query session operation history

**Request:**
```javascript
{
  command: 'get_session_history',
  sessionId: 'xyz123',
  filters: {
    operationType: 'navigate',
    status: 'error',
    fromTime: 1719571000000,
    toTime: 1719572000000,
    limit: 50
  }
}
```

**Response:**
```javascript
{
  success: true,
  history: [
    {
      timestamp: 1719571245000,
      operation: 'navigate',
      url: 'https://example.com',
      status: 'success',
      duration: 2340
    },
    {
      timestamp: 1719571500000,
      operation: 'click',
      selector: '.price-button',
      status: 'error',
      error: 'Element not found',
      duration: 5000
    }
  ],
  total: 247,
  statistics: {
    successRate: 0.932,
    avgDuration: 245
  }
}
```

### 4.4 Command: start_campaign

**Purpose:** Orchestrate multi-session campaign

**Request:**
```javascript
{
  command: 'start_campaign',
  campaignName: 'Competitor Price Monitor',
  config: {
    maxParallelSessions: 3,
    operationTimeout: 60000
  },
  operations: [
    {
      id: 'nav1',
      type: 'navigate',
      sessionIndex: 0,
      params: { url: 'https://competitor1.com' },
      dependencies: []
    },
    {
      id: 'ext1',
      type: 'extract',
      sessionIndex: 0,
      params: { type: 'html' },
      dependencies: ['nav1']
    }
  ]
}
```

**Response:**
```javascript
{
  success: true,
  campaignId: 'campaign-xyz',
  sessionIds: ['session-1', 'session-2', 'session-3'],
  operationCount: 7,
  status: 'RUNNING'
}
```

### 4.5 Command: get_campaign_status

**Purpose:** Monitor campaign progress

**Request:**
```javascript
{
  command: 'get_campaign_status',
  campaignId: 'campaign-xyz'
}
```

**Response:**
```javascript
{
  success: true,
  campaignId: 'campaign-xyz',
  status: 'RUNNING',
  progress: {
    completed: 4,
    total: 7,
    percent: 57
  },
  statistics: {
    avgDuration: 2340,
    successRate: 1.0,
    errors: 0
  },
  operations: [
    { id: 'nav1', status: 'completed', duration: 1200 },
    { id: 'nav2', status: 'completed', duration: 1500 },
    { id: 'ext1', status: 'completed', duration: 800 },
    { id: 'ext2', status: 'running', duration: 340 },
    { id: 'ext3', status: 'pending' },
    { id: 'agg', status: 'pending' }
  ]
}
```

### 4.6 Command: export_session_evidence

**Purpose:** Export session for forensic analysis

**Request:**
```javascript
{
  command: 'export_session_evidence',
  sessionId: 'xyz123',
  format: 'json',  // json or csv
  includeHistory: true,
  includeSnapshots: true
}
```

**Response:**
```javascript
{
  success: true,
  format: 'json',
  size: 1048576,  // bytes
  data: 'base64-encoded-compressed-export',
  metadata: {
    sessionId: 'xyz123',
    createdAt: 1719571200000,
    snapshotCount: 5,
    operationCount: 247,
    checksum: 'sha256-hash'
  }
}
```

---

## 5. Integration Points

### 5.1 Session Persistence + Failure Recovery

```javascript
// During operation execution:

try {
  result = await executeOperation(operation);
  sessionHistory.logSuccess(sessionId, operation, result);
} catch (error) {
  // Log the error
  sessionHistory.logError(sessionId, operation.type, error);
  
  // Detect failure type
  const failure = failureRecovery.detectFailure(error);
  
  // Get recovery strategies
  const strategies = failureRecovery.getRecoveryStrategies(failure.type);
  
  // Auto-recover
  for (const strategy of strategies) {
    const recovered = await failureRecovery.executeRecovery(
      sessionId,
      strategy,
      { operation, context }
    );
    
    if (recovered.success) {
      // Retry operation
      result = await executeOperation(operation);
      sessionHistory.logSuccess(sessionId, operation, result);
      break;
    }
  }
}
```

### 5.2 Campaign Manager + Session History

```javascript
// Track campaign operations in history:

const operation = {
  type: 'navigate',
  sessionId: sessionId,
  params: { url: url },
  campaignId: campaignId,  // Add campaign context
  operationId: operationId
};

sessionHistory.logOperation(sessionId, operation);

// Query campaign history:
const history = await sessionHistory.getHistory(sessionId, {
  campaignId: campaignId,
  sort: 'asc'  // Chronological order
});
```

### 5.3 WebSocket Server Integration

```javascript
// In websocket/server.js:

this.commandHandlers.save_session_snapshot = async (params) => {
  const { sessionId, metadata } = params;
  const snapshot = this.sessionPersistence.takeSnapshot(
    sessionId,
    metadata
  );
  return { success: true, snapshotId: snapshot.id, ... };
};

this.commandHandlers.get_session_history = async (params) => {
  const { sessionId, filters } = params;
  const history = await this.sessionHistory.getHistory(
    sessionId,
    filters
  );
  return { success: true, history, ... };
};

this.commandHandlers.start_campaign = async (params) => {
  const { campaignName, operations, config } = params;
  const campaign = await this.campaignManager.createCampaign(
    campaignName,
    config
  );
  await this.campaignManager.addOperations(campaign.id, operations);
  await this.campaignManager.startCampaign(campaign.id);
  return { success: true, campaignId: campaign.id, ... };
};
```

---

## 6. Error Handling

### 6.1 Recovery Failure

```javascript
// When all recovery strategies fail:

const recovery = {
  sessionId: 'xyz123',
  failureType: 'rate_limit',
  status: 'UNRECOVERABLE',
  attemptsExhausted: 5,
  lastError: 'All recovery strategies failed',
  suggestions: [
    'Increase backoff delay',
    'Rotate to different proxy provider',
    'Wait longer before retry',
    'Try different user agent'
  ]
};

// Notify user and suggest recovery actions
```

### 6.2 Campaign Failure

```javascript
// When campaign operation fails:

const operationFailure = {
  campaignId: 'campaign-xyz',
  operationId: 'op-abc',
  status: 'FAILED',
  error: 'Element not found',
  affectedDependents: ['op-def', 'op-ghi'],
  cascade: 'STOP_CAMPAIGN'  // Stop all operations
};

// User can choose:
// 1. Retry operation
// 2. Skip operation
// 3. Resume from checkpoint
// 4. Cancel campaign
```

---

## 7. Performance Considerations

### 7.1 Compression

- **Snapshot size:** Track compressed vs uncompressed
- **Compression ratio:** Typical 70-90% for JSON with repeated data
- **Overhead:** <50ms for typical snapshot (gzip)
- **Memory:** Stream processing for large snapshots (>10MB)

### 7.2 Database Performance

```javascript
// SQLite optimizations:
// 1. Use WAL mode (Write-Ahead Logging)
// 2. Connection pooling (better-sqlite3)
// 3. Batch inserts for history
// 4. Index on (session_id, timestamp)
// 5. Partition history by date (optional)

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = MEMORY;
```

### 7.3 Campaign Parallelism

```javascript
// Control parallelism:
maxParallelSessions = 3;  // Default
maxConcurrentOperations = 10;  // Per session

// Monitor resource usage:
- CPU: Keep <80% during campaign
- Memory: Keep <500MB per session
- File handles: Limit to OS maximum
```

---

## 8. Monitoring & Telemetry

### 8.1 Recovery Metrics

```javascript
recoveryMetrics = {
  sessionId: 'xyz123',
  failureType: 'rate_limit',
  attemptCount: 3,
  successRate: 0.67,  // 2 succeeded out of 3
  avgDuration: 1200,  // ms
  totalDuration: 3600,
  strategiesUsed: ['wait', 'rotate_proxy'],
  lastRecoveryTime: timestamp
};
```

### 8.2 History Metrics

```javascript
historyMetrics = {
  totalOperations: 247,
  successRate: 0.932,
  errorCount: 17,
  avgDuration: 245,
  errorRateByType: {
    'rate_limit': 8,
    'bot_detected': 5,
    'connection_lost': 4
  },
  storageUsed: '2.3 MB',
  oldestRecord: timestamp,
  newestRecord: timestamp
};
```

### 8.3 Campaign Metrics

```javascript
campaignMetrics = {
  campaignId: 'campaign-xyz',
  status: 'RUNNING',
  progress: 0.57,  // 57%
  operationCount: 7,
  completedCount: 4,
  failedCount: 0,
  avgDuration: 1200,
  estimatedTimeRemaining: 3000
};
```

---

## 9. Testing Strategy

### 9.1 Unit Tests (by module)

**FailureRecovery** (8-10 tests)
- Backoff calculation correctness
- Backoff max boundary
- Jitter distribution
- Strategy selection
- State tracking

**SessionHistory** (10-12 tests)
- Operation logging
- Query accuracy
- Statistics calculation
- CSV/JSON export
- Cleanup policy

**CampaignManager** (8-10 tests)
- Dependency resolution (topological sort)
- Operation execution order
- Parallel execution
- Results aggregation
- State machine transitions

### 9.2 Integration Tests (10-15)
- Session persist → failure → recovery → success flow
- Campaign with real sessions
- History tracking accuracy
- WebSocket command handling

### 9.3 Load Tests (5-8)
- 50+ concurrent sessions with recovery
- 500+ operations in campaign
- 8-hour session stability
- Compression under throughput

### 9.4 Real-World Scenarios (3-5)
- Rate limit → backoff → success
- Network failure → checkpoint recovery
- Multi-competitor price monitoring campaign
- Forensic export accuracy

---

## 10. Deployment Checklist

**Code Changes**
- [ ] Implement failure-recovery.js
- [ ] Implement session-history.js
- [ ] Implement campaign-manager.js
- [ ] Update session-persistence.js (compression, etc.)
- [ ] Update websocket/server.js (6 commands)
- [ ] Update Python SDK
- [ ] Update JavaScript SDK
- [ ] Update TypeScript definitions

**Testing**
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Load tests 500+ concurrent
- [ ] Real-world scenarios validated
- [ ] Compression verification

**Documentation**
- [ ] API documentation
- [ ] Code comments
- [ ] Architecture diagrams
- [ ] Migration guide
- [ ] Troubleshooting guide

**Monitoring**
- [ ] Metrics collection implemented
- [ ] Alerts configured
- [ ] Dashboard created
- [ ] Telemetry validated

---

*End of Technical Specification*

Status: Ready for Engineering Implementation  
Prepared: June 1, 2026  
Confidence: HIGH (92%+)
