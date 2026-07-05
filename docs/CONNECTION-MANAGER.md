# Connection Lifecycle Manager

## Overview

The Connection Lifecycle Manager is a critical component that prevents memory leaks caused by zombie/dead WebSocket connections. It implements automatic detection and forced cleanup of unresponsive connections after a configurable grace period.

**Status**: Production Ready  
**Version**: 1.0.0  
**Implemented**: June 2026

## Problem Statement

In high-load scenarios, WebSocket connections can become unresponsive due to:
- Network failures without proper teardown
- Client crashes without disconnect
- Long-running operations that timeout
- Browser tab closures without cleanup

Without explicit cleanup, these zombie connections accumulate in memory, causing:
- Memory leaks (unbounded growth)
- Resource exhaustion (file descriptors, memory)
- Degraded server performance
- Eventually: server crashes

## Solution Architecture

### Components

#### 1. ConnectionLifecycleManager
Located in `websocket/connection-manager.js`

Manages the complete lifecycle of WebSocket connections:
- **Registration**: Tracks new connections with metadata
- **Activity Recording**: Updates last activity timestamps
- **Dead Detection**: Identifies unresponsive connections
- **Zombie Detection**: Identifies dead connections past grace period
- **Force Termination**: Cleanly removes zombie connections
- **Monitoring**: Tracks metrics for alerting

#### 2. WebSocket Server Integration
Located in `websocket/server.js`

Enhanced with:
- Connection registration on new clients
- Activity tracking on all messages
- Heartbeat ping/pong tracking
- Zombie detection in heartbeat loop
- Periodic cleanup hooks

#### 3. Monitoring Commands
New WebSocket commands for observability:
- `get_connection_metrics` - Get aggregate statistics
- `get_connection_status` - Get detailed per-connection status
- `force_terminate_connection` - Admin command to terminate specific connection

## Configuration

### Default Values

```javascript
{
  gracePeriodMs: 300000,           // 5 minutes
  checkIntervalMs: 30000,          // Check every 30 seconds
  highZombieCount: 10,             // Alert threshold
  memoryLeakDetectionMs: 600000    // 10 minutes for leak detection
}
```

### Customization

Pass options during WebSocket server initialization:

```javascript
const server = new WebSocketServer(port, mainWindow, {
  connectionGracePeriodMs: 300000,      // Custom grace period
  connectionCheckIntervalMs: 30000,     // Custom check interval
  highZombieConnectionCount: 10         // Custom alert threshold
});
```

## How It Works

### Connection Lifecycle

```
1. NEW CONNECTION
   ↓
   [registerConnection]
   - Store metadata: createdAt, lastActivity, isAlive
   - Initialize activity counters
   ↓

2. ACTIVE CONNECTION
   ↓
   [recordActivity/recordPing/recordPong]
   - Update lastActivity timestamp
   - Increment activity counters
   - Mark as alive on pong
   ↓

3. HEARTBEAT (every 30 seconds)
   ↓
   - Send PING to connection
   - Record ping sent
   - Check for no pong response
   ↓

4A. CONNECTION RESPONDS (normal)
    [recordPong]
    - Update lastActivity
    - Mark isAlive = true
    - Continue to step 2

4B. CONNECTION SILENT (dead)
    [markDead]
    - Mark isAlive = false
    - Add to zombie watch list
    ↓

5. GRACE PERIOD (5 minutes default)
   ↓
   [isZombie check]
   - If inactive > gracePeriodMs → zombie
   ↓

6. FORCE TERMINATION
   [forceTerminate]
   - Remove all event listeners
   - Close WebSocket
   - Call cleanup hooks
   - Delete metadata
   ↓

7. NORMAL CLEANUP
   [unregisterConnection]
   - Delete metadata on normal close/error
```

### Zombie Detection Algorithm

A connection becomes a zombie when:

```javascript
!isAlive && (Date.now() - lastActivity) > gracePeriodMs
```

Detection phases:
1. **Immediate Detection**: Heartbeat failure marks as dead (isAlive = false)
2. **Grace Period**: Wait 5 minutes before force action
3. **Zombie Confirmation**: Check every 30 seconds
4. **Force Termination**: Remove all resources

### Cleanup Process

When forcing termination:

```javascript
forceTerminate(clientId, cleanupContext)
  1. Remove all WebSocket event listeners
  2. Close WebSocket connection with code 4000
  3. Execute registered cleanup hooks
  4. Delete connection metadata
  5. Log cleanup event for monitoring
```

Cleanup hooks allow additional resource cleanup:

```javascript
connectionManager.registerCleanupHook((clientId, context) => {
  // Close browser instance if owned by connection
  if (context.browserOwned) {
    browser.close();
  }
  // Clean up custom resources
  customResourceMap.delete(clientId);
});
```

## Monitoring & Metrics

### Metrics Available

```javascript
{
  totalConnections: number,           // Total registered
  currentZombieCount: number,         // Currently detected as zombies
  zombiesDetected: number,            // Total detected over time
  zombiesForceTerminated: number,     // Total cleaned up
  cleanupErrors: number,              // Failed cleanup attempts
  avgConnectionDuration: number,      // Average lifetime in ms
  peakZombieCount: number,            // Highest simultaneous zombies
  activeConnectionCount: number,      // Currently active
  avgZombieCount: number              // Average detected per check
}
```

### WebSocket Commands

#### get_connection_metrics
Returns aggregate statistics:

```bash
→ { "command": "get_connection_metrics" }

← {
    "success": true,
    "metrics": {
      "activeConnectionCount": 42,
      "currentZombieCount": 2,
      "totalConnections": 1234,
      "zombiesDetected": 8,
      "zombiesForceTerminated": 6,
      ...
    },
    "gracePeriodMs": 300000,
    "checkIntervalMs": 30000
  }
```

#### get_connection_status
Returns detailed per-connection status:

```bash
→ { "command": "get_connection_status" }

← {
    "success": true,
    "connections": [
      {
        "clientId": "client-1234567890-abc123",
        "isAlive": true,
        "isZombie": false,
        "duration": 45000,
        "inactiveFor": 2000,
        "browserOwned": false,
        "messageCount": 12,
        "pings": 3,
        "pongs": 3,
        "createdAt": "2026-06-21T10:30:00Z",
        "lastActivity": "2026-06-21T10:30:45Z"
      },
      ...
    ],
    "totalConnections": 42,
    "zombieCount": 2
  }
```

#### force_terminate_connection
Manually terminate a connection (admin):

```bash
→ { "command": "force_terminate_connection", "clientId": "client-123" }

← {
    "success": true,
    "message": "Connection terminated"
  }
```

## Logging

### Log Levels

**INFO** messages:
- Connection registered/unregistered
- Zombie cleaned up
- Periodic metrics
- Dead connection marked

**WARN** messages:
- High zombie count detected
- Potential memory leak detected

**ERROR** messages:
- Cleanup hook failures
- Force terminate errors
- Zombie detection loop errors

### Example Logs

```
[ConnectionManager] Registered connection: client-123 {
  "browserOwned": false,
  "gracePeriodMs": 300000
}

[ConnectionManager] Connection marked as dead: client-123 {
  "lastActivity": "2026-06-21T10:30:00Z",
  "idleFor": 65000,
  "pongCount": 2
}

[ConnectionManager] HIGH ZOMBIE COUNT: 12 detected {
  "threshold": 10,
  "gracePeriod": 300000
}

[ConnectionManager] Force terminating zombie: client-123 {
  "inactiveFor": 305000,
  "browserOwned": true,
  "gracePeriod": 300000
}

[ConnectionManager] Zombie connection cleaned up: client-123
```

## Performance Impact

### Memory Usage
- Per-connection overhead: ~500 bytes metadata
- No unbounded growth (periodic cleanup)
- Cleanup hook optimization: minimal

### CPU Usage
- Zombie detection: O(n) every 30 seconds
- Force termination: O(hooks) cleanup time
- Overall: <1ms per connection on typical hardware

### Network Overhead
- Additional PING for heartbeat: 2 bytes per 30 seconds
- Negligible impact on bandwidth

## Testing

### Unit Tests
Located in `tests/unit/connection-lifecycle-manager.test.js`

Covers:
- Registration/unregistration
- Activity tracking
- Zombie detection
- Force termination
- Metrics calculation
- Cleanup hooks
- Edge cases

**Status**: 8 comprehensive test suites, 25+ test cases

### Integration Tests
Located in `tests/integration/zombie-connection-cleanup.test.js`

Tests:
- Full lifecycle with WebSocket server
- Multiple simultaneous connections
- Metrics during operation
- Cleanup verification

**Status**: 7 integration test scenarios

## Troubleshooting

### High Zombie Count

**Symptom**: Many connections marked as zombies

**Causes**:
1. Heartbeat timeout too aggressive
2. Network congestion
3. Client crashes without cleanup

**Solutions**:
```javascript
// Increase grace period
connectionGracePeriodMs: 600000  // 10 minutes
```

### Memory Still Growing

**Symptom**: Memory usage increases over time despite cleanup

**Causes**:
1. Cleanup hooks not freeing resources
2. Stale references in global maps
3. Event listeners not removed

**Solutions**:
1. Verify cleanup hooks properly clean resources
2. Check for stale references in command handlers
3. Ensure removeAllListeners() called

### Frequent Force Terminations

**Symptom**: Legitimate connections being force terminated

**Causes**:
1. Grace period too short
2. Heartbeat interval too aggressive
3. Client timeout configuration

**Solutions**:
```javascript
// Increase grace period
connectionGracePeriodMs: 600000  // 10 minutes

// Adjust server heartbeat
heartbeatInterval: 60000         // 60 seconds
heartbeatTimeout: 120000         // 120 seconds
```

## Future Enhancements

1. **Adaptive Grace Period**: Adjust based on network conditions
2. **Per-Client Policies**: Different cleanup rules for different connection types
3. **Memory Prediction**: Predict zombie count and alert before spike
4. **Partial Cleanup**: Release some resources before full termination
5. **Connection Recovery**: Attempt to revive zombies before termination

## Security Considerations

1. **DoS Protection**: Limit zombie detection overhead
   - Uses fixed 30-second check interval
   - O(n) algorithm won't slow under load

2. **Resource Cleanup**: Ensure all resources properly freed
   - Event listeners removed
   - Browser instances closed
   - Memory references cleared

3. **Admin Commands**: Force termination restricted
   - Should be rate-limited
   - Should log for audit trail
   - Consider adding authentication requirement

## Related Components

- **WebSocket Server**: `websocket/server.js`
- **Heartbeat Monitor**: Built into server heartbeat loop
- **Resource Cleanup**: Via cleanup hooks
- **Metrics Collection**: Via monitoring commands

## References

- [WebSocket RFC 6455 - Connection Lifecycle](https://tools.ietf.org/html/rfc6455#section-4)
- [Node.js WebSocket Best Practices](https://nodejs.org/en/knowledge/advanced/index.html)
- Memory Leak Detection Patterns in Node.js

## Changelog

### v1.0.0 (June 2026)
- Initial implementation
- 5-minute grace period
- Zombie detection every 30 seconds
- Monitoring commands
- 25+ unit tests
- 7 integration tests
- Comprehensive logging
