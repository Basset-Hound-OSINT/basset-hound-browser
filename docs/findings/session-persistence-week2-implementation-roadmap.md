# Wave 14 Session Persistence - Week 2 Implementation Roadmap
**Status:** Detailed Analysis Complete  
**Date:** June 1, 2026  
**Timeline:** June 29 - July 13, 2026 (3-week sprint)  
**Effort:** 60-80 hours (Backend #1 lead) + 15-20 hours (Backend #2 support)  

---

## Executive Summary

Week 1 delivered Session Branching (checkpoints, rollback, failure recovery). Week 2 builds the **persistence backend and recovery system** to enable:

1. **Long-running campaigns** with multi-checkpoint support
2. **Automatic failure recovery** with exponential backoff
3. **Session history** with forensic-grade audit trail
4. **Campaign orchestration** for parallel multi-session operations
5. **WebSocket API expansion** (6 new commands)

Current implementation status:
- ✅ Session branching manager (checkpoints, branches, recovery strategies)
- ✅ Session persistence (save/load, snapshots, disk storage)
- ✅ Failure detection and classification
- ⏳ **MISSING:** Failure recovery system (auto-retry, backoff logic)
- ⏳ **MISSING:** Session history tracking (SQLite)
- ⏳ **MISSING:** Campaign manager (multi-session coordination)
- ⏳ **MISSING:** WebSocket command integration
- ⏳ **MISSING:** Comprehensive integration tests

---

## Implementation Breakdown (Week 2)

### 1. Failure Recovery System (6-7 hours)
**File:** `/src/sessions/failure-recovery.js` (NEW)

#### Core Features
- Auto-detect failure type (rate limit, bot block, forbidden, connection loss, server error, network error)
- Implement recovery strategies per failure type:
  - **Rate Limit:** Exponential backoff (100ms → 30s), rotate proxy/user agent
  - **Bot Detection:** Rotate fingerprint, enable behavioral patterns, longer backoff
  - **Forbidden:** Rotate fingerprint/proxy, clear cookies, branch session
  - **Connection Loss:** Retry with backoff, verify connectivity
  - **Server Error:** Exponential backoff (30s → 5min)
  - **Network Error:** Reconnect proxy, rotate if needed
- Track recovery attempts (count, timestamps, success/failure)
- Manual retry trigger via WebSocket
- Configurable backoff parameters (initial, max, multiplier)

#### Data Structures
```javascript
{
  sessionId: 'string',
  failureType: 'rate_limit|bot_detected|forbidden|...',
  firstAttemptTime: timestamp,
  lastAttemptTime: timestamp,
  attemptCount: number,
  nextRetryTime: timestamp,
  nextRetryDelay: milliseconds,
  recoveryStrategiesUsed: [{ action, timestamp, result }],
  successRate: float (0.0-1.0),
  lastError: string
}
```

#### Test Coverage (12-15 tests)
- Rate limit backoff calculation (exponential growth)
- Backoff max boundary enforcement
- Recovery attempt tracking
- Strategy success rate calculation
- Manual retry execution
- Configuration validation

---

### 2. Session History & Audit (3-4 hours)
**File:** `/src/sessions/session-history.js` (NEW)

#### Core Features
- SQLite database for operation history
- Schema: timestamp, sessionId, operation, parameters, result, error, duration
- Query API:
  - `getHistoryByDateRange(sessionId, startTime, endTime)`
  - `getHistoryByOperation(sessionId, operationType)`
  - `getHistoryByStatus(sessionId, status)` → success, error, partial
  - `getStatistics(sessionId)` → success rate, avg duration, error count
- Export capabilities: JSON, CSV, detailed forensic format
- Retention policy: 30 days default (configurable)
- Auto-cleanup of expired records

#### Database Schema
```sql
CREATE TABLE session_history (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  parameters TEXT,
  result TEXT,
  error TEXT,
  duration_ms INTEGER,
  status TEXT,
  timestamp INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_session_timestamp ON session_history(session_id, timestamp);
CREATE INDEX idx_operation ON session_history(operation);
```

#### Test Coverage (12-15 tests)
- Operation logging
- Query by date range
- Query by operation type
- Statistics calculation
- CSV export format
- JSON export format
- Retention policy enforcement
- Database cleanup
- Concurrent writes (thread safety)

---

### 3. Campaign Manager (2-3 hours)
**File:** `/src/features/campaign-manager.js` (NEW)

#### Core Features
- Coordinate multiple parallel sessions
- Campaign state management (active sessions, checkpoints, shared state)
- Operation sequencing (dependencies, parallel execution, wait points)
- Results aggregation (combine findings from multiple sessions)
- Campaign statistics (completion %, error %, avg duration)
- Pause/resume campaign operations

#### Data Structures
```javascript
Campaign {
  id: string,
  name: string,
  status: 'planning|running|paused|completed|failed',
  sessionIds: [sessionId],
  operations: [{
    id: string,
    type: 'navigate|click|extract|...',
    sessionId: string,
    params: {},
    dependencies: [operationId],
    status: 'pending|running|completed|failed',
    result: {},
    error: null
  }],
  statistics: {
    totalOperations: number,
    completedOperations: number,
    failedOperations: number,
    avgDuration: number
  }
}
```

#### Test Coverage (15-20 tests)
- Campaign creation and initialization
- Operation queueing and sequencing
- Dependency resolution
- Parallel execution
- Results aggregation
- Campaign pause/resume
- Error handling and rollback
- Statistics calculation

---

### 4. Enhanced Session Persistence (4-5 hours)
**File:** `/src/sessions/session-persistence.js` (ENHANCE EXISTING)

#### Additions to Existing Module
- **Compression:** gzip for snapshots >100KB
- **Point-in-time recovery:** Replay operations from X to Y
- **Batch operations:** Atomically save multiple snapshots
- **Encryption support:** Optional AES-256 encryption for snapshots
- **Disk space management:** Automatic cleanup of old snapshots
- **Integrity verification:** SHA-256 checksums for all snapshots

#### New Methods
```javascript
// Compression
compressSnapshot(snapshot) // Returns compressed buffer
decompressSnapshot(buffer) // Returns decompressed snapshot

// Recovery
replayOperations(sessionId, fromTime, toTime) // Chronological replay
recoverFromPointInTime(sessionId, timestamp) // Restore to specific time

// Batch operations
batchSaveSnapshots(sessionId, snapshots) // Atomic multi-save
batchLoadSnapshots(sessionId) // Load all with verification

// Management
getStorageStats(sessionId) // Size, count, age
cleanupOldSnapshots(sessionId, olderThan) // Delete old data
```

#### Test Coverage (15-20 tests)
- Compression/decompression (various sizes)
- Compressed snapshot load/save
- Point-in-time recovery
- Batch operations atomicity
- Storage statistics
- Cleanup policies
- Integrity verification

---

### 5. WebSocket Command Expansion (1-2 hours)
**File:** `/websocket/server.js` (UPDATE)

#### New Commands (6 total)

1. **save_session_snapshot**
   - Params: sessionId, metadata (optional)
   - Returns: snapshotId, size, compressed
   - Use: Manual persist at critical points

2. **load_session_checkpoint**
   - Params: sessionId, checkpointId
   - Returns: state, requestCount, timestamp
   - Use: Resume from specific checkpoint

3. **get_session_history**
   - Params: sessionId, filters (operation, dateRange, status)
   - Returns: [{ timestamp, operation, result, error }]
   - Use: Query operation history

4. **start_campaign**
   - Params: campaignName, operations (array)
   - Returns: campaignId, sessionIds
   - Use: Orchestrate multi-session campaign

5. **get_campaign_status**
   - Params: campaignId
   - Returns: status, progress %, statistics
   - Use: Monitor campaign progress

6. **export_session_evidence**
   - Params: sessionId, format (json|csv)
   - Returns: exported_data (base64), metadata
   - Use: Forensic-ready export

#### Update Python/JavaScript SDKs
- Add method stubs for 6 new commands
- Update type definitions (TypeScript)
- Add example usage in documentation

---

## Testing Strategy (50+ tests total)

### Unit Tests (25-30)
- Failure recovery backoff calculations
- Session history operations
- Campaign operation sequencing
- Compression/decompression

### Integration Tests (15-20)
- Session persist → failure recovery → resume flow
- History tracking through operations
- Campaign orchestration with real sessions
- WebSocket command handling

### Load & Stress Tests (10-15)
- 50+ concurrent sessions with recovery
- 8-hour long-running session stability
- Campaign with 100+ operations
- Compression under high throughput

### Real-World Scenarios (5+)
- 1-hour session with rate limit → recovery → success
- Network failure → automatic reconnect
- Multi-session campaign with interdependencies
- Forensic export of failed session

---

## Deliverables Checklist

**Core Implementation**
- [ ] Failure recovery system (6-7 hours)
- [ ] Session history module (3-4 hours)
- [ ] Campaign manager (2-3 hours)
- [ ] Enhanced persistence (4-5 hours)
- [ ] WebSocket commands (1-2 hours)

**Testing**
- [ ] 50+ comprehensive tests
- [ ] Real-world scenario validation
- [ ] Load testing (500+ concurrent)
- [ ] 8-hour stability test

**Documentation**
- [ ] API documentation for 6 new commands
- [ ] Recovery system flow diagrams
- [ ] Campaign orchestration guide
- [ ] Code comments and inline docs

**Integration**
- [ ] WebSocket server integration
- [ ] Python SDK updates
- [ ] JavaScript SDK updates
- [ ] TypeScript definitions

---

## Risk Assessment

**High Risk (Mitigations Required)**
1. **Backoff timing precision** → Use jitter to avoid thundering herd
2. **SQLite concurrency** → WAL mode + connection pooling
3. **Campaign dependency resolution** → Topological sort validation
4. **Large snapshot compression** → Memory usage during gzip (stream processing)

**Medium Risk**
1. Recovery strategy effectiveness (varies by failure type)
2. Storage quota management (cleanup policies)
3. Performance impact of history tracking

**Mitigation Strategy**
- Implement with feature flags (enable/disable recovery, history)
- Progressive rollout (internal testing, then customer pilots)
- Comprehensive monitoring of recovery success rates
- Configurable history retention (balance storage vs audit trail)

---

## Success Metrics (Week 2 Gate)

**Functional**
- ✅ Recovery success rate ≥85% across failure types
- ✅ History accuracy 100% (audit-ready)
- ✅ Campaign orchestration supports 100+ operations
- ✅ 500+ concurrent sessions sustained

**Quality**
- ✅ 98%+ test pass rate
- ✅ Zero data loss scenarios
- ✅ <100ms recovery time (average)
- ✅ <5% CPU overhead for history tracking

**Operational**
- ✅ 8-hour long-running session stable
- ✅ Graceful degradation under load
- ✅ Comprehensive error logging
- ✅ Recovery telemetry tracked

---

## Dependencies & Blockers

**Required from Week 1 (Session Branching)**
- ✅ Checkpoint/rollback system
- ✅ Failure detection classification
- ✅ Recovery strategy suggestions

**External Dependencies**
- WebSocket server integration (coordinated with server team)
- SQLite availability (standard Node.js via better-sqlite3)
- Python/JS SDK distribution (npm, pip)

**Critical Path Gate**
- Session Persistence 500-concurrent verification (July 7)
- All tests must pass before campaign manager release

---

## Timeline & Milestones

**Week 5 (Jun 29 - Jul 5): Sprint Week 1**
- Mon-Wed: Failure recovery system implementation
- Wed-Thu: Session history SQLite integration
- Thu-Fri: Unit testing and validation
- **Output:** 50% complete checkpoint

**Week 6 (Jul 6 - Jul 12): Sprint Week 2**
- Mon-Tue: Campaign manager implementation
- Tue-Wed: WebSocket command integration
- Wed-Fri: Integration testing and load validation
- **Output:** 100% complete (ready for gate)

**Week 6 (Jul 7): CRITICAL GATE**
- Session Persistence 500-concurrent verification
- All tests passing (98%+)
- Production-ready code

---

## Code Structure

```
src/sessions/
├── session-persistence.js       (EXISTING, enhance)
├── failure-recovery.js          (NEW, 200-250 lines)
├── session-history.js           (NEW, 250-350 lines)

src/features/
├── session-branching.js         (EXISTING)
├── campaign-manager.js          (NEW, 300-400 lines)

websocket/
└── server.js                    (UPDATE, add 6 commands)

tests/
└── wave14/
    └── session-persistence-week2.test.js (NEW, 800-1000 lines)

docs/
└── SESSION-PERSISTENCE-API.md   (NEW, command reference)
```

---

## Next Steps (Immediate Actions)

1. **Create failure-recovery.js**
   - Stub out class and methods
   - Implement backoff calculation
   - Add recovery strategy selection

2. **Create session-history.js**
   - Set up SQLite database
   - Implement operation logging
   - Add query API

3. **Create campaign-manager.js**
   - Implement campaign state machine
   - Add operation sequencing
   - Results aggregation

4. **Write integration tests**
   - Real-world scenarios
   - Load testing framework
   - Monitoring and metrics

5. **Update WebSocket server**
   - Add 6 new command handlers
   - Integration with session persistence
   - Response formatting

---

## Sign-Off

**Prepared By:** Engineering Agent  
**Date:** June 1, 2026  
**Status:** Ready for Implementation  
**Confidence Level:** HIGH (85%+)  
**Critical Path:** YES - Gates Session Persistence completion gate (Jul 13)  

**Approval Required:**
- Backend #1 Engineer (primary implementer)
- QA Engineer (testing strategy sign-off)
- Architecture Lead (design review)

---

*This roadmap will be updated weekly with progress status and any adjustments needed based on execution feedback.*
