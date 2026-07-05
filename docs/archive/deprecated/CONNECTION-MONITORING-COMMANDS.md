# Connection Monitoring Commands

Commands for monitoring WebSocket connection health and managing zombie connections.

## Overview

Three new commands provide insight into connection lifecycle management and zombie connection cleanup:
- `get_connection_metrics` - Aggregate statistics
- `get_connection_status` - Detailed per-connection information
- `force_terminate_connection` - Admin control

## get_connection_metrics

**Purpose**: Get aggregate connection metrics and zombie statistics

**Request Format**:
```json
{
  "command": "get_connection_metrics",
  "id": "request-123"
}
```

**Response**:
```json
{
  "success": true,
  "id": "request-123",
  "command": "get_connection_metrics",
  "metrics": {
    "totalConnections": 42,
    "currentZombieCount": 2,
    "zombiesDetected": 8,
    "zombiesForceTerminated": 6,
    "cleanupErrors": 0,
    "avgConnectionDuration": 45000,
    "peakZombieCount": 5,
    "activeConnectionCount": 40,
    "avgZombieCount": 1.2,
    "zombieCountSamples": [0, 1, 2, 1, 0]
  },
  "gracePeriodMs": 300000,
  "checkIntervalMs": 30000
}
```

**Metrics Description**:

| Metric | Type | Description |
|--------|------|-------------|
| `totalConnections` | number | Total connections registered since startup |
| `currentZombieCount` | number | Number of currently detected zombie connections |
| `zombiesDetected` | number | Total number of connections detected as zombies |
| `zombiesForceTerminated` | number | Total force-terminated cleanup operations |
| `cleanupErrors` | number | Failed cleanup attempts |
| `avgConnectionDuration` | number | Average connection lifetime in milliseconds |
| `peakZombieCount` | number | Highest number of simultaneous zombies |
| `activeConnectionCount` | number | Currently active (non-zombie) connections |
| `avgZombieCount` | number | Average zombie count per detection cycle |
| `zombieCountSamples` | array | Last N zombie count measurements |

**Examples**:

JavaScript:
```javascript
const ws = new WebSocket('ws://localhost:8765');
ws.addEventListener('open', () => {
  ws.send(JSON.stringify({
    command: 'get_connection_metrics',
    id: 'metrics-1'
  }));
});

ws.addEventListener('message', (event) => {
  const response = JSON.parse(event.data);
  if (response.command === 'get_connection_metrics') {
    console.log(`Active: ${response.metrics.activeConnectionCount}`);
    console.log(`Zombies: ${response.metrics.currentZombieCount}`);
  }
});
```

Python:
```python
import websocket
import json

ws = websocket.WebSocket()
ws.connect('ws://localhost:8765')

request = {
    'command': 'get_connection_metrics',
    'id': 'metrics-1'
}
ws.send(json.dumps(request))

response = json.loads(ws.recv())
metrics = response['metrics']
print(f"Active connections: {metrics['activeConnectionCount']}")
print(f"Zombie connections: {metrics['currentZombieCount']}")
```

## get_connection_status

**Purpose**: Get detailed status of all active connections

**Request Format**:
```json
{
  "command": "get_connection_status",
  "id": "request-124"
}
```

**Response**:
```json
{
  "success": true,
  "id": "request-124",
  "command": "get_connection_status",
  "connections": [
    {
      "clientId": "client-1687269600000-abc123",
      "isAlive": true,
      "isZombie": false,
      "duration": 45000,
      "inactiveFor": 2000,
      "browserOwned": false,
      "messageCount": 12,
      "pings": 3,
      "pongs": 3,
      "createdAt": "2026-06-21T10:30:00.000Z",
      "lastActivity": "2026-06-21T10:30:45.000Z"
    },
    {
      "clientId": "client-1687269602000-def456",
      "isAlive": false,
      "isZombie": true,
      "duration": 305000,
      "inactiveFor": 305000,
      "browserOwned": true,
      "messageCount": 5,
      "pings": 2,
      "pongs": 0,
      "createdAt": "2026-06-21T10:25:00.000Z",
      "lastActivity": "2026-06-21T10:25:00.000Z"
    }
  ],
  "totalConnections": 2,
  "zombieCount": 1
}
```

**Connection Details**:

| Field | Type | Description |
|-------|------|-------------|
| `clientId` | string | Unique client identifier |
| `isAlive` | boolean | Connection responded to last heartbeat |
| `isZombie` | boolean | Dead connection past grace period |
| `duration` | number | Connection lifetime in milliseconds |
| `inactiveFor` | number | Time since last activity in milliseconds |
| `browserOwned` | boolean | Whether connection owns browser instance |
| `messageCount` | number | Number of messages received |
| `pings` | number | Number of heartbeat pings sent |
| `pongs` | number | Number of heartbeat pongs received |
| `createdAt` | string | Connection creation timestamp (ISO 8601) |
| `lastActivity` | string | Last activity timestamp (ISO 8601) |

**Examples**:

JavaScript - Monitor active connections:
```javascript
async function monitorConnections() {
  const ws = new WebSocket('ws://localhost:8765');
  
  ws.addEventListener('open', () => {
    // Get status every 10 seconds
    setInterval(() => {
      ws.send(JSON.stringify({
        command: 'get_connection_status',
        id: `status-${Date.now()}`
      }));
    }, 10000);
  });

  ws.addEventListener('message', (event) => {
    const response = JSON.parse(event.data);
    if (response.command === 'get_connection_status') {
      const zombies = response.connections.filter(c => c.isZombie);
      console.log(`Alive: ${response.totalConnections - zombies.length}`);
      console.log(`Zombies: ${zombies.length}`);
      
      // Log zombie details
      zombies.forEach(z => {
        console.log(`  ${z.clientId}: inactive ${z.inactiveFor}ms`);
      });
    }
  });
}
```

Python - Export connection details:
```python
import websocket
import json
import csv
from datetime import datetime

ws = websocket.WebSocket()
ws.connect('ws://localhost:8765')

ws.send(json.dumps({'command': 'get_connection_status'}))
response = json.loads(ws.recv())

# Export to CSV
with open('connections.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['clientId', 'isAlive', 'duration', 'messageCount'])
    writer.writeheader()
    writer.writerows(response['connections'])
```

## force_terminate_connection

**Purpose**: Administratively terminate a specific connection

**Request Format**:
```json
{
  "command": "force_terminate_connection",
  "clientId": "client-1687269602000-def456",
  "id": "request-125"
}
```

**Response**:
```json
{
  "success": true,
  "id": "request-125",
  "command": "force_terminate_connection",
  "message": "Connection terminated"
}
```

**Error Response**:
```json
{
  "success": false,
  "id": "request-125",
  "command": "force_terminate_connection",
  "error": "clientId parameter required"
}
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `clientId` | string | Yes | Client identifier to terminate |

**Examples**:

JavaScript - Manual cleanup:
```javascript
async function terminateZombies() {
  const ws = new WebSocket('ws://localhost:8765');
  
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({
      command: 'get_connection_status'
    }));
  });

  ws.addEventListener('message', (event) => {
    const response = JSON.parse(event.data);
    
    if (response.command === 'get_connection_status') {
      // Find and terminate zombies
      response.connections
        .filter(c => c.isZombie)
        .forEach(zombie => {
          console.log(`Terminating ${zombie.clientId}...`);
          ws.send(JSON.stringify({
            command: 'force_terminate_connection',
            clientId: zombie.clientId,
            id: `terminate-${Date.now()}`
          }));
        });
    }
  });
}
```

Python - Cleanup script:
```python
import websocket
import json
import time

def cleanup_zombies():
    ws = websocket.WebSocket()
    ws.connect('ws://localhost:8765')
    
    # Get current status
    ws.send(json.dumps({'command': 'get_connection_status'}))
    response = json.loads(ws.recv())
    
    # Terminate all zombies
    for conn in response['connections']:
        if conn['isZombie']:
            print(f"Terminating {conn['clientId']}...")
            ws.send(json.dumps({
                'command': 'force_terminate_connection',
                'clientId': conn['clientId']
            }))
            result = json.loads(ws.recv())
            print(f"  Result: {result['message']}")
            time.sleep(0.5)
    
    ws.close()

if __name__ == '__main__':
    cleanup_zombies()
```

## Configuration

The connection manager behavior can be configured when starting the WebSocket server:

```javascript
const options = {
  // Grace period before force termination (default: 5 minutes)
  connectionGracePeriodMs: 300000,
  
  // How often to check for zombies (default: 30 seconds)
  connectionCheckIntervalMs: 30000,
  
  // Alert threshold for high zombie count (default: 10)
  highZombieConnectionCount: 10
};

const server = new WebSocketServer(port, mainWindow, options);
```

## Monitoring Strategy

### Real-time Monitoring
```javascript
// Check metrics every 30 seconds
setInterval(() => {
  ws.send(JSON.stringify({
    command: 'get_connection_metrics'
  }));
}, 30000);
```

### Zombie Cleanup Automation
```javascript
// Automatically clean zombies over 10 minutes old
async function autoCleanup() {
  const response = await getConnectionStatus();
  const gracePeriod = 600000; // 10 minutes
  
  response.connections.forEach(conn => {
    if (conn.inactiveFor > gracePeriod) {
      forceTerminate(conn.clientId);
    }
  });
}
```

### Alerting
```javascript
// Alert on high zombie count
let lastZombieCount = 0;
setInterval(() => {
  const metrics = await getConnectionMetrics();
  
  if (metrics.currentZombieCount > 10) {
    alert(`High zombie count: ${metrics.currentZombieCount}`);
  }
  
  if (metrics.currentZombieCount > lastZombieCount) {
    console.warn(`Zombie count increased from ${lastZombieCount} to ${metrics.currentZombieCount}`);
  }
  
  lastZombieCount = metrics.currentZombieCount;
}, 60000);
```

## Best Practices

1. **Monitor Regularly**: Check metrics every 30-60 seconds
2. **Set Alerts**: Alert when zombie count exceeds threshold
3. **Auto-Cleanup**: Periodically terminate old zombies
4. **Log Changes**: Track zombie count trends
5. **Investigate Spikes**: High zombie counts may indicate issues

## Common Use Cases

### Use Case 1: Connection Health Dashboard
```javascript
// Display real-time connection status
async function updateDashboard() {
  const metrics = await getConnectionMetrics();
  const status = await getConnectionStatus();
  
  document.getElementById('active').textContent = metrics.activeConnectionCount;
  document.getElementById('zombies').textContent = metrics.currentZombieCount;
  document.getElementById('total').textContent = metrics.totalConnections;
}
```

### Use Case 2: Automated Cleanup
```javascript
// Periodically clean old zombies
setInterval(async () => {
  const status = await getConnectionStatus();
  
  status.connections
    .filter(c => c.inactiveFor > 300000) // 5 minutes
    .forEach(c => forceTerminate(c.clientId));
}, 60000);
```

### Use Case 3: Performance Alerting
```javascript
// Alert on resource issues
async function checkHealth() {
  const metrics = await getConnectionMetrics();
  
  if (metrics.currentZombieCount > 20) {
    sendAlert('CRITICAL: High zombie count');
  }
  
  if (metrics.cleanupErrors > 5) {
    sendAlert('WARNING: Cleanup errors detected');
  }
}
```

## See Also

- `docs/CONNECTION-MANAGER.md` - Technical reference
- `docs/ZOMBIE-CLEANUP-IMPLEMENTATION.md` - Implementation details
