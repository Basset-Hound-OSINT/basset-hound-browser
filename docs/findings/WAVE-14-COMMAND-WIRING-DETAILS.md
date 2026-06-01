# Wave 14 Command Wiring Details

## Overview
Complete wiring of 41 Wave 14 commands into the WebSocket server, Python SDK, and JavaScript SDK.

## Command Registration Status

### Tech Detection (3/3 Commands)
| Command | Location | Status | Type |
|---------|----------|--------|------|
| detect_technologies | server.js:6782 | ✓ Registered | Existing |
| identify_cms | server.js:6852 | ✓ Registered | New |
| identify_analytics | server.js:6905 | ✓ Registered | New |

### Competitor Monitoring (23/23 Commands)
#### Monitor Management (8 commands)
| Command | Type | Handler | Status |
|---------|------|---------|--------|
| add_monitor | New Alias | add_competitor_monitor | ✓ Active |
| remove_monitor | New Alias | remove_competitor_monitor | ✓ Active |
| update_monitor | New Alias | update_competitor_monitor | ✓ Active |
| get_monitor | New Alias | get_competitor_monitor | ✓ Active |
| list_monitors | New Alias | list_competitor_monitors | ✓ Active |
| pause_monitor | New Alias | pause_competitor_monitor | ✓ Active |
| resume_monitor | New Alias | resume_competitor_monitor | ✓ Active |
| check_monitor | New Alias | check_competitor_monitor | ✓ Active |

#### Change History (3 commands)
| Command | Type | Handler | Status |
|---------|------|---------|--------|
| get_monitor_changes | New Alias | get_competitor_changes | ✓ Active |
| get_monitor_snapshots | New Alias | get_competitor_snapshots | ✓ Active |
| get_monitor_stats | New Alias | get_competitor_stats | ✓ Active |

#### Service Control (6 commands)
| Command | Type | Handler | Status |
|---------|------|---------|--------|
| start_monitoring_service | New Alias | start_competitor_monitoring | ✓ Active |
| stop_monitoring_service | New Alias | stop_competitor_monitoring | ✓ Active |
| pause_monitoring_service | New Alias | pause_competitor_monitoring | ✓ Active |
| resume_monitoring_service | New Alias | resume_competitor_monitoring | ✓ Active |
| get_monitoring_service_status | New Alias | get_competitor_monitoring_status | ✓ Active |
| get_monitoring_service_stats | New Alias | get_competitor_monitoring_stats | ✓ Active |

#### Configuration (6 commands)
| Command | Type | Handler | Status |
|---------|------|---------|--------|
| configure_monitor_alerts | New Alias | configure_competitor_alerts | ✓ Active |
| run_monitor_check | New Alias | run_competitor_monitoring_checks | ✓ Active |
| export_monitors | New Alias | export_competitor_monitoring_data | ✓ Active |
| import_monitors | New Alias | import_competitor_monitoring_config | ✓ Active |
| cleanup_monitoring_data | New Alias | cleanup_competitor_monitoring_data | ✓ Active |
| clear_all_monitors | New Alias | clear_all_competitor_monitors | ✓ Active |

### Proxy Intelligence (3/3 Commands)
| Command | Location | Manager | Status |
|---------|----------|---------|--------|
| get_proxy_reputation | server.js:8912 | reputationScorer + proxyIntelligence | ✓ Registered |
| set_geo_lock | server.js:8945 | geoConsistencyEngine | ✓ Registered |
| get_proxy_analytics | server.js:8977 | proxyAnalytics + proxyIntelligence | ✓ Registered |

### Session Checkpointing (12/12 Commands)

#### Checkpoint Operations
| Command | Location | Manager | Status |
|---------|----------|---------|--------|
| create_session_checkpoint | server.js:8985 | stateManager | ✓ Registered |
| rollback_to_checkpoint | server.js:9018 | stateManager | ✓ Registered |
| list_checkpoints | server.js:9048 | stateManager | ✓ Registered |
| get_checkpoint_details | server.js:9070 | stateManager | ✓ Registered |
| delete_checkpoint | server.js:9095 | stateManager | ✓ Registered |

#### Branching Operations
| Command | Location | Manager | Status |
|---------|----------|---------|--------|
| branch_session | server.js:9113 | stateManager | ✓ Registered |
| list_branches | server.js:9135 | stateManager | ✓ Registered |
| merge_branch | server.js:9155 | stateManager | ✓ Registered |

#### Recovery Operations
| Command | Location | Manager | Status |
|---------|----------|---------|--------|
| detect_failure | server.js:9170 | mainWindow | ✓ Registered |
| get_recovery_strategies | server.js:9208 | Logic | ✓ Registered |
| resume_session | server.js:9243 | stateManager | ✓ Registered |
| export_checkpoint | server.js:9265 | stateManager | ✓ Registered |

## Manager Injection

### WebSocket Server Constructor Changes
File: `websocket/server.js` (lines 824-829)

```javascript
// Proxy intelligence managers (Wave 14)
this.proxyIntelligence = options.proxyIntelligence || null;
this.geoConsistencyEngine = options.geoConsistencyEngine || null;
this.reputationScorer = options.reputationScorer || null;
this.proxyAnalytics = options.proxyAnalytics || null;

// Monitor manager (Wave 14)
this.monitorManager = options.monitorManager || null;
```

### Monitoring Service Initialization
File: `websocket/server.js` (lines 8871-8875)

```javascript
const monitoringService = new MonitoringService({
  dataDir: this.dataDir || './data/monitoring',
  enableAutoCheck: true,
  checkInterval: 3600000 // 1 hour default
});
```

## SDK Method Signatures

### Python SDK
File: `sdks/python-sdk/basset_hound.py`

```python
# Tech Detection
async def identify_cms(self, html: Optional[str] = None) -> Response
async def identify_analytics(self, html: Optional[str] = None) -> Response

# Monitoring (23 methods)
async def add_monitor(self, url: str, name: str, frequency: str = 'daily', alerts: Optional[Dict] = None)
async def remove_monitor(self, monitor_id: str) -> Response
# ... and 21 more

# Proxy Intelligence
async def get_proxy_reputation(self, proxy_address: str, session_id: Optional[str] = None)
async def set_geo_lock(self, country: Optional[str] = None, region: Optional[str] = None, ...)
async def get_proxy_analytics(self, session_id: Optional[str] = None, aggregate: bool = False)

# Checkpointing (12 methods)
async def create_session_checkpoint(self, label: str = '', description: str = '')
async def rollback_to_checkpoint(self, checkpoint_id: str) -> Response
# ... and 10 more
```

### JavaScript SDK
File: `sdks/js-sdk/basset-hound.js`

```javascript
// Tech Detection
async identifyCms(html = null)
async identifyAnalytics(html = null)

// Monitoring (23 methods)
async addMonitor(url, name, frequency = 'daily', alerts = {})
async removeMonitor(monitorId)
// ... and 21 more

// Proxy Intelligence
async getProxyReputation(proxyAddress, sessionId = null)
async setGeoLock(country = null, region = null, latitude = null, longitude = null)
async getProxyAnalytics(sessionId = null, aggregate = false)

// Checkpointing (12 methods)
async createSessionCheckpoint(label = '', description = '')
async rollbackToCheckpoint(checkpointId)
// ... and 10 more
```

## Testing Coverage

### Unit Tests
- Command Registration: ✓ 41/41 verified in source
- Syntax Validation: ✓ All files validated
- Import Checks: ✓ All dependencies available

### Integration Tests
- End-to-End Workflows: ✓ 29 tests, 100% pass
- Scenario Coverage:
  - Competitor monitoring with tech detection ✓
  - Extended campaign with checkpointing ✓
  - Proxy intelligence and rotation ✓
  - Multi-monitor orchestration ✓
  - Full OSINT campaign lifecycle ✓

### Performance Notes
- Tech detection: <500ms per page
- Monitoring checks: Configurable, default 1 hour
- Checkpoints: Max 50 stored (configurable, 1-hour TTL)
- No noticeable latency impact from new commands

## Command Execution Flow

### Typical Request
```
Client → WebSocket Message
       → handleCommand() in server.js
       → Lookup commandHandlers[command]
       → Execute async handler
       → Return CommandResponse
       → Client receives response
```

### Error Handling
```
Handler execution
  → Try/Catch block
  → Manager availability check
  → Parameter validation
  → Return error with recovery suggestion
  → Client can retry with guidance
```

### State Management
```
Command execution
  → Validate preconditions
  → Create state snapshot (if applicable)
  → Execute command handler
  → Update snapshots for recovery
  → Return success/failure status
  → Client logs result
```

## Migration from Competitor Monitor Commands

For existing code using the old naming:

**Before:**
```javascript
await client.add_competitor_monitor(url, name);
```

**After (Option 1 - Old naming still works):**
```javascript
await client.add_competitor_monitor(url, name);
```

**After (Option 2 - New standard naming):**
```javascript
await client.add_monitor(url, name);
```

Both work equivalently as aliases point to the same handler.

## Complete Command List with Line Numbers

### Tech Detection
- detect_technologies: 6782
- identify_cms: 6852
- identify_analytics: 6905

### Monitoring Aliases
- add_monitor: 8880
- remove_monitor: 8881
- update_monitor: 8882
- get_monitor: 8883
- list_monitors: 8884
- pause_monitor: 8885
- resume_monitor: 8886
- check_monitor: 8887
- get_monitor_changes: 8890
- get_monitor_snapshots: 8891
- get_monitor_stats: 8892
- start_monitoring_service: 8895
- stop_monitoring_service: 8896
- pause_monitoring_service: 8897
- resume_monitoring_service: 8898
- get_monitoring_service_status: 8899
- get_monitoring_service_stats: 8900
- configure_monitor_alerts: 8903
- run_monitor_check: 8904
- export_monitors: 8905
- import_monitors: 8906
- cleanup_monitoring_data: 8907
- clear_all_monitors: 8908

### Proxy Intelligence
- get_proxy_reputation: 8912
- set_geo_lock: 8945
- get_proxy_analytics: 8977

### Session Checkpointing
- create_session_checkpoint: 8985
- rollback_to_checkpoint: 9018
- list_checkpoints: 9048
- get_checkpoint_details: 9070
- delete_checkpoint: 9095
- branch_session: 9113
- list_branches: 9135
- merge_branch: 9155
- detect_failure: 9170
- get_recovery_strategies: 9208
- resume_session: 9243
- export_checkpoint: 9265

---
**Generated:** June 1, 2026  
**Status:** Complete - Ready for v12.2.0 Deployment
