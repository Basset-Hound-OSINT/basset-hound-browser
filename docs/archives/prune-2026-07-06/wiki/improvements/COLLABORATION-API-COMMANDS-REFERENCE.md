# Collaboration API - WebSocket Commands Reference

**Quick Reference Guide for v12.9.0 Feature 2**  
**21 WebSocket Commands for Real-Time Collaboration**

---

## Session Locking Commands (6)

### 1. lock_session
Acquire exclusive lock on session

```json
{
  "command": "lock_session",
  "params": {
    "sessionId": "string",
    "clientId": "string",
    "timeout": 30000,
    "priority": 0,
    "metadata": {}
  }
}
```
**Response:** `{ success: true, lockId, sessionId, acquiredAt, expiresAt }`

---

### 2. unlock_session
Release lock on session

```json
{
  "command": "unlock_session",
  "params": {
    "lockId": "string",
    "sessionId": "string"
  }
}
```
**Response:** `{ success: true, releasedAt, nextWaiter? }`

---

### 3. renew_lock
Extend lock expiration time

```json
{
  "command": "renew_lock",
  "params": {
    "lockId": "string",
    "sessionId": "string"
  }
}
```
**Response:** `{ success: true, expiresAt, lockId }`

---

### 4. get_lock_status
Check current lock status

```json
{
  "command": "get_lock_status",
  "params": {
    "sessionId": "string"
  }
}
```
**Response:** `{ success: true, locked: boolean, lockId?, clientId?, remainingMs? }`

---

### 5. get_all_locks
Get all active locks across sessions

```json
{
  "command": "get_all_locks",
  "params": {}
}
```
**Response:** `{ success: true, locks: [], count: number }`

---

### 6. cleanup_expired_locks
Remove expired locks from system

```json
{
  "command": "cleanup_expired_locks",
  "params": {}
}
```
**Response:** `{ success: true, cleaned: number, remaining: number }`

---

## Event Streaming Commands (7)

### 7. subscribe_events
Subscribe to real-time events from session

```json
{
  "command": "subscribe_events",
  "params": {
    "sessionId": "string",
    "subscriberId": "string",
    "eventTypes": ["*"],
    "filters": {}
  }
}
```
**Response:** `{ success: true, subscriptionId, sessionId, subscriberId, subscribedAt }`

---

### 8. unsubscribe_events
Stop receiving events from subscription

```json
{
  "command": "unsubscribe_events",
  "params": {
    "subscriptionId": "string"
  }
}
```
**Response:** `{ success: true, sessionId, subscriberId }`

---

### 9. get_event_history
Retrieve historical events from buffer

```json
{
  "command": "get_event_history",
  "params": {
    "sessionId": "string",
    "eventType": "string?",
    "since": 1625097600000,
    "limit": 100
  }
}
```
**Response:** `{ success: true, events: [], count: number }`

---

### 10. get_subscription_info
Get details about specific subscription

```json
{
  "command": "get_subscription_info",
  "params": {
    "subscriptionId": "string"
  }
}
```
**Response:** `{ success: true, subscription: {} }`

---

### 11. get_session_subscriptions
List all subscriptions for a session

```json
{
  "command": "get_session_subscriptions",
  "params": {
    "sessionId": "string"
  }
}
```
**Response:** `{ success: true, subscriptions: [], count: number }`

---

### 12. broadcast_event
Send event to all session subscribers

```json
{
  "command": "broadcast_event",
  "params": {
    "sessionId": "string",
    "eventType": "string",
    "data": {}
  }
}
```
**Response:** `{ success: true, eventId, broadcasted: number, buffered: true }`

---

## Message Queue Commands (7)

### 13. queue_command
Add command to execution queue

```json
{
  "command": "queue_command",
  "params": {
    "sessionId": "string",
    "clientId": "string",
    "command": {
      "name": "string",
      "params": {}
    },
    "priority": 0,
    "timeout": 60000,
    "maxRetries": 3,
    "detectConflicts": true,
    "resolveConflicts": "queue"
  }
}
```
**Response:** `{ success: true, queuedId, position, estimatedWaitMs, queueSize }`

---

### 14. peek_queue
View next command without removing

```json
{
  "command": "peek_queue",
  "params": {
    "sessionId": "string"
  }
}
```
**Response:** `{ success: true, command?, queueSize: number }`

---

### 15. dequeue_command
Remove and return next command

```json
{
  "command": "dequeue_command",
  "params": {
    "sessionId": "string"
  }
}
```
**Response:** `{ success: true, command?, queueSize: number }`

---

### 16. remove_queued_command
Delete specific command from queue

```json
{
  "command": "remove_queued_command",
  "params": {
    "sessionId": "string",
    "queuedId": "string"
  }
}
```
**Response:** `{ success: true, position: number }`

---

### 17. get_queue_status
Get queue information and pending commands

```json
{
  "command": "get_queue_status",
  "params": {
    "sessionId": "string"
  }
}
```
**Response:** `{ success: true, sessionId, size, maxSize, commands: [] }`

---

### 18. clear_queue
Remove all commands from queue

```json
{
  "command": "clear_queue",
  "params": {
    "sessionId": "string"
  }
}
```
**Response:** `{ success: true, cleared: number }`

---

### 19. get_queue_statistics
Get global queue statistics

```json
{
  "command": "get_queue_statistics",
  "params": {}
}
```
**Response:** `{ success: true, activeSessions, totalCommands, maxQueueSize, avgQueueSize }`

---

## Utility Commands (2)

### 20. detect_conflicts
Check for command conflicts before queuing

```json
{
  "command": "detect_conflicts",
  "params": {
    "command": {
      "name": "string",
      "params": {}
    },
    "queuedCommands": [
      { "name": "string", "params": {} }
    ]
  }
}
```
**Response:** `{ success: true, conflicts: [], hasConflicts: boolean }`

---

### 21. get_collaboration_status
Comprehensive status of all collaboration features

```json
{
  "command": "get_collaboration_status",
  "params": {
    "sessionId": "string?"
  }
}
```
**Response:**
```json
{
  "success": true,
  "timestamp": 1625097600000,
  "locks": { "locked": false, "lockId"?: "...", "clientId"?: "..." },
  "subscriptions": { "count": 0, "subscriptions": [] },
  "queue": { "size": 0, "maxSize": 5000, "commands": [] },
  "stats": {
    "locksAcquired": 0,
    "eventsEmitted": 0,
    "commandsQueued": 0,
    "conflictsResolved": 0
  }
}
```

---

## Common Event Types

| Event Type | Trigger | Data |
|------------|---------|------|
| `command_started` | Command execution begins | `{ clientId, command, lockId }` |
| `command_completed` | Command execution succeeds | `{ clientId, lockId, result }` |
| `command_failed` | Command execution fails | `{ clientId, error }` |
| `lock_acquired` | Lock successfully obtained | `{ clientId, lockId }` |
| `lock_released` | Lock released | `{ clientId, lockId }` |
| `lock_timeout` | Lock expiration | `{ sessionId }` |
| `conflict_detected` | Conflict found in queue | `{ command, conflicts }` |
| `queue_full` | Queue size exceeded | `{ sessionId, size }` |
| Custom Events | User defined | User defined |

---

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": "Description of the error"
}
```

---

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| Lock not found | Invalid lockId or expired | Reacquire lock |
| Lock acquisition timeout | Session locked, timeout exceeded | Retry with longer timeout or higher priority |
| Queue full | Too many commands queued | Clear queue or dequeue before adding more |
| Conflicts detected | Command conflicts with queued commands | Resolve conflicts or use different parameters |
| Subscription not found | Invalid subscriptionId | Resubscribe |
| sessionId required | Missing required parameter | Provide sessionId in params |
| clientId required | Missing required parameter | Provide clientId in params |

---

## Parameter Descriptions

### Lock Parameters
- **sessionId** (string): Unique session identifier
- **clientId** (string): Client requesting the lock
- **lockId** (string): Lock identifier (returned from lock_session)
- **timeout** (number): Lock timeout in milliseconds (default: 30000)
- **priority** (number): Priority in waiter queue (higher = earlier)
- **metadata** (object): Custom metadata to store with lock

### Event Parameters
- **subscriberId** (string): Unique subscriber identifier
- **eventType** (string): Type of event (e.g., 'command_completed')
- **subscriptionId** (string): Subscription identifier (returned from subscribe_events)
- **eventTypes** (array): Array of event types to filter on
- **filters** (object): Additional event filters

### Queue Parameters
- **queuedId** (string): Queued command identifier
- **command** (object): Command to queue (name + params)
- **priority** (number): Execution priority (higher executes first)
- **maxRetries** (number): Max retry attempts
- **detectConflicts** (boolean): Enable conflict detection
- **resolveConflicts** (string): 'abort' or 'queue'

---

## Integration Code Example

```javascript
// Register all commands with WebSocket server
const { registerCollaborationCommands } = require(
  './websocket/commands/collaboration-commands'
);

const managers = registerCollaborationCommands(server, {
  lockTimeout: 30000,
  maxBufferSize: 1000,
  maxQueueSize: 5000
});

// Use with WebSocket client
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  // Acquire lock
  ws.send(JSON.stringify({
    id: 1,
    command: 'lock_session',
    params: {
      sessionId: 'session-1',
      clientId: 'client-1'
    }
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log('Response:', response);
});
```

---

## Performance Tips

1. **Use priorities** to expedite critical commands
2. **Check for conflicts** before queuing to avoid abort scenarios
3. **Renew locks** for long-running operations instead of holding single lock
4. **Subscribe selectively** to relevant event types only
5. **Cleanup regularly** using cleanup_expired_locks
6. **Monitor queue statistics** to detect bottlenecks
7. **Batch operations** where possible to reduce command count

---

## Best Practices

- Always release locks in finally blocks or use async/await with error handling
- Use appropriate timeout values based on expected operation duration
- Filter event subscriptions to reduce noise and processing
- Pre-check conflicts for critical operations using detect_conflicts
- Monitor queue status to prevent overflow
- Clean up expired resources regularly
- Use metadata to track operation context
- Log lock acquisitions/releases for debugging

---

## Quick Start

```javascript
const coordinator = new CollaborationCoordinator();

// 1. Lock session
const lock = await coordinator.lockManager.acquireLock('sess-1', 'client-1');

// 2. Subscribe to events
const sub = coordinator.eventManager.subscribe('sess-1', 'sub-1');

// 3. Queue commands
coordinator.queueManager.queueCommand('sess-1', 'client-1', { name: 'click' });

// 4. Get status
const status = coordinator.getCollaborationStatus('sess-1');

// 5. Cleanup
coordinator.lockManager.releaseLock(lock.lockId, 'sess-1');
coordinator.eventManager.unsubscribe(sub.subscriptionId);
```

---

**Last Updated:** July 3, 2026  
**Version:** v12.9.0 Feature 2  
**Status:** Production Ready

