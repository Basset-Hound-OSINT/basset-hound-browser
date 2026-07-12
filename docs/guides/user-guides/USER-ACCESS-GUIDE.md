# Getting Started with Basset Hound Browser - User Access Guide

**Version**: 12.3.0  
**Last Updated**: June 14, 2026  
**Status**: Production Ready  

Welcome to the Basset Hound Browser API! This guide will help you connect to and integrate with the production deployment.

## Table of Contents

1. [Connection Details](#connection-details)
2. [Quick Start](#quick-start)
3. [API Structure](#api-structure)
4. [Common Use Cases](#common-use-cases)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Troubleshooting](#troubleshooting)
8. [Next Steps](#next-steps)

---

## Connection Details

### Production Endpoints

**WebSocket (Standard)**
```
ws://your-hostname:8765
```

**WebSocket Secure (SSL/TLS)**
```
wss://your-hostname:8765
```

### Authentication

By default, authentication is **optional** for internal network deployments. When enabled:

```javascript
// Option 1: Query Parameter
ws://your-hostname:8765?token=YOUR_TOKEN

// Option 2: WebSocket Header (during connection)
Authorization: Bearer YOUR_TOKEN

// Option 3: Command-based (after connection)
{
  "id": 1,
  "command": "authenticate",
  "token": "YOUR_TOKEN"
}
```

### Rate Limiting

- **Default**: 1,000 commands per minute per session
- **Burst**: Up to 100 concurrent commands
- **Timeout**: 5 minute idle timeout

If rate-limited, the API returns:
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "recovery": {
    "suggestion": "Wait 60 seconds before retrying",
    "retryAfter": 60
  }
}
```

---

## Quick Start

### Step 1: Install WebSocket Client

**Python**
```bash
pip install websocket-client
```

**Node.js**
```bash
npm install ws
```

**Bash/cURL** - no installation needed (use `websocat` or `wscat`)

### Step 2: Connect to the Server

**Python Example**
```python
import websocket
import json
import time

# Connect
ws = websocket.WebSocket()
ws.connect('ws://localhost:8765')
print("Connected!")

# Send a simple ping
request = {
    'id': 1,
    'command': 'ping'
}
ws.send(json.dumps(request))

# Receive response
response = json.loads(ws.recv())
print("Response:", response)

# Close
ws.close()
```

**Node.js Example**
```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  console.log('Connected!');
  
  // Send ping
  const request = {
    id: 1,
    command: 'ping'
  };
  ws.send(JSON.stringify(request));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log('Response:', response);
  ws.close();
});

ws.on('error', (error) => {
  console.error('Error:', error);
});
```

**Bash Example (using wscat)**
```bash
# Install wscat
npm install -g wscat

# Connect
wscat -c ws://localhost:8765

# Send command (in interactive mode)
{"id":1,"command":"ping"}

# Receive response
{"id":1,"command":"ping","success":true,"data":{}}
```

---

## API Structure

### Request Format

Every request must contain a unique ID and command name:

```json
{
  "id": "unique-request-id",
  "command": "command_name",
  "param1": "value1",
  "param2": "value2"
}
```

**ID Format**: String or number (should be unique per request)
- Good: `"msg-001"`, `1`, `"req-2026-06-14-001"`
- Avoid: Duplicates, as responses are matched by ID

### Success Response

```json
{
  "id": "unique-request-id",
  "command": "command_name",
  "success": true,
  "data": {
    "result": "value",
    "metadata": {...}
  }
}
```

### Error Response

```json
{
  "id": "unique-request-id",
  "command": "command_name",
  "success": false,
  "error": "Human-readable error message",
  "recovery": {
    "suggestion": "What to do next",
    "alternativeCommands": ["command1", "command2"]
  }
}
```

### Response Data

The `data` field contains:
- **Command results** (HTML, screenshots, links, etc.)
- **Metadata** (timing, size, quality metrics)
- **Pagination info** (for large result sets)

### Common Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string/number | Request ID (matched to response) |
| `command` | string | API command name |
| `success` | boolean | Whether command succeeded |
| `error` | string | Error message (if failed) |
| `data` | object | Response payload |
| `recovery` | object | Error recovery suggestions |
| `timestamp` | ISO 8601 | Server response time |

---

## Common Use Cases

### 1. Navigate and Take Screenshot

**Scenario**: Load a webpage and capture it

```javascript
const WebSocket = require('ws');
const fs = require('fs');
const Base64 = require('js-base64').Base64;

const ws = new WebSocket('ws://localhost:8765');
let step = 1;

ws.on('open', () => {
  // Step 1: Navigate
  console.log('Navigating to example.com...');
  ws.send(JSON.stringify({
    id: 1,
    command: 'navigate',
    url: 'https://example.com'
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  
  if (response.id === 1 && response.success) {
    // Step 2: Wait for page to load
    console.log('Page loaded, waiting 2 seconds...');
    setTimeout(() => {
      console.log('Taking screenshot...');
      ws.send(JSON.stringify({
        id: 2,
        command: 'screenshot'
      }));
    }, 2000);
  }
  
  if (response.id === 2 && response.success) {
    // Step 3: Save screenshot
    const imageBinary = Buffer.from(response.data.image, 'base64');
    fs.writeFileSync('screenshot.png', imageBinary);
    console.log('Screenshot saved to screenshot.png');
    ws.close();
  }
});
```

### 2. Extract Page Content

**Scenario**: Get all text, links, and forms from a page

```javascript
ws.send(JSON.stringify({
  id: 1,
  command: 'navigate',
  url: 'https://example.com'
}));

// After page loads (wait 2-3 seconds), extract everything
ws.send(JSON.stringify({
  id: 2,
  command: 'extract_all'
}));

// Response contains:
// {
//   "links": [...],
//   "text": "...",
//   "forms": [...],
//   "metadata": {...}
// }
```

### 3. Fill and Submit a Form

**Scenario**: Automate form submission

```javascript
// Navigate to form
ws.send(JSON.stringify({
  id: 1,
  command: 'navigate',
  url: 'https://example.com/form'
}));

// Wait for form to load
setTimeout(() => {
  // Fill text field
  ws.send(JSON.stringify({
    id: 2,
    command: 'fill',
    selector: '#email',
    value: 'user@example.com',
    humanize: true  // Simulate human typing
  }));
  
  // Fill password field
  ws.send(JSON.stringify({
    id: 3,
    command: 'fill',
    selector: '#password',
    value: 'SecurePassword123',
    humanize: true
  }));
  
  // Click submit button
  ws.send(JSON.stringify({
    id: 4,
    command: 'click',
    selector: '#submit-button',
    humanize: true  // Simulate human click
  }));
}, 2000);
```

### 4. Handle Bot Detection Evasion

**Scenario**: Evade common bot detection services

```javascript
// Create a fingerprint profile
ws.send(JSON.stringify({
  id: 1,
  command: 'create_regional_fingerprint',
  region: 'US'
}));

// Create behavioral profile
ws.send(JSON.stringify({
  id: 2,
  command: 'create_behavioral_profile',
  sessionId: 'my-session-1',
  speedMultiplier: 1.0,
  accuracyLevel: 0.95
}));

// Apply fingerprint
ws.send(JSON.stringify({
  id: 3,
  command: 'apply_fingerprint',
  profileId: 'fp_123'  // from response to id:1
}));

// Now navigate with evasion active
ws.send(JSON.stringify({
  id: 4,
  command: 'navigate',
  url: 'https://protected-site.com'
}));
```

### 5. Manage Sessions

**Scenario**: Create isolated browser sessions

```javascript
// Create session
ws.send(JSON.stringify({
  id: 1,
  command: 'create_session',
  name: 'Session A',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  fingerprint: 'US'
}));

// List sessions
ws.send(JSON.stringify({
  id: 2,
  command: 'list_sessions'
}));

// Switch to session
ws.send(JSON.stringify({
  id: 3,
  command: 'switch_session',
  sessionId: 'sess_123'  // from response to id:1
}));
```

---

## Error Handling

### Handling Retryable Errors

Some errors are temporary and safe to retry:

```javascript
const retryableCommands = [
  'get_url', 'get_content', 'get_page_state',
  'screenshot', 'screenshot_viewport', 'screenshot_full_page',
  'get_cookies', 'get_all_cookies',
  'list_sessions', 'list_tabs',
  'status', 'ping'
];

async function sendWithRetry(ws, request, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await sendCommand(ws, request);
      
      if (response.success) {
        return response;
      }
      
      if (retryableCommands.includes(request.command) && attempt < maxRetries) {
        console.log(`Retry ${attempt}/${maxRetries} for ${request.command}`);
        await sleep(1000 * attempt);  // Exponential backoff
        continue;
      }
      
      return response;  // Non-retryable error or max retries reached
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(1000 * attempt);
    }
  }
}
```

### Common Error Codes

| Error | Cause | Solution |
|-------|-------|----------|
| `Element not found` | Selector is wrong or page not loaded | Use `wait_for_element` before interacting |
| `Navigation timeout` | Page took too long to load | Increase timeout or check URL |
| `Rate limit exceeded` | Too many commands sent | Wait and retry with backoff |
| `Invalid authentication` | Token is wrong or expired | Verify token and reconnect |
| `Browser crashed` | Unexpected browser termination | Reconnect and retry |

### Recovery Suggestions

The API provides recovery suggestions in error responses:

```javascript
ws.on('message', (data) => {
  const response = JSON.parse(data);
  
  if (!response.success && response.recovery) {
    console.log('Error:', response.error);
    console.log('Suggestion:', response.recovery.suggestion);
    console.log('Try these commands:', response.recovery.alternativeCommands);
  }
});
```

---

## Rate Limiting

### Request Limits

- **Per-session**: 1,000 commands/minute
- **Per-connection**: 100 concurrent requests
- **Timeout**: 5 minutes of inactivity closes connection

### Handling Rate Limits

```javascript
const queue = [];
let requestsThisMinute = 0;
const resetInterval = setInterval(() => {
  requestsThisMinute = 0;
}, 60000);

function sendCommand(ws, request) {
  if (requestsThisMinute >= 1000) {
    console.log('Rate limit reached, queuing request');
    queue.push(request);
    return;
  }
  
  ws.send(JSON.stringify(request));
  requestsThisMinute++;
}

// Process queue when rate limit resets
setInterval(() => {
  while (queue.length > 0 && requestsThisMinute < 1000) {
    sendCommand(ws, queue.shift());
  }
}, 100);
```

---

## Troubleshooting

### Connection Won't Establish

**Problem**: `Error: connect ECONNREFUSED`

**Solutions**:
1. Verify server is running: `curl http://your-hostname:8765/health`
2. Check firewall allows port 8765
3. Verify correct hostname/IP address
4. For Docker: ensure container is running `docker ps | grep basset-hound`

### Commands Timing Out

**Problem**: Requests hang or timeout

**Solutions**:
1. Wait after `navigate` before using page-dependent commands (2-3 seconds)
2. Use `wait_for_element` for better timing:
   ```javascript
   ws.send(JSON.stringify({
     id: 1,
     command: 'wait_for_element',
     selector: '#main-content',
     timeout: 10000
   }));
   ```
3. Check server logs: `docker logs basset-hound-browser`

### Disconnections/Connection Drops

**Problem**: WebSocket closes unexpectedly

**Solutions**:
1. Implement reconnection logic with exponential backoff
2. Keep connections alive with periodic `ping` commands
3. Check idle timeout (default 5 minutes)

**Reconnection Example**:
```javascript
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const baseReconnectDelay = 1000;

function connectWithRetry() {
  try {
    ws = new WebSocket('ws://localhost:8765');
    reconnectAttempts = 0;
  } catch (error) {
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts - 1);
      console.log(`Reconnecting in ${delay}ms...`);
      setTimeout(connectWithRetry, delay);
    }
  }
}

ws.on('close', connectWithRetry);
```

### Evasion Detection Still Failing

**Problem**: Websites still detect automated traffic

**Solutions**:
1. Create regional fingerprint matching target location:
   ```javascript
   ws.send(JSON.stringify({
     id: 1,
     command: 'create_regional_fingerprint',
     region: 'US'  // or UK, EU, JP, CN, etc.
   }));
   ```
2. Enable behavioral simulation:
   ```javascript
   ws.send(JSON.stringify({
     id: 2,
     command: 'create_behavioral_profile',
     sessionId: 'my-session',
     speedMultiplier: 0.8,  // Slower than default
     accuracyLevel: 0.90    // More realistic
   }));
   ```
3. Add delays between actions to simulate human behavior

---

## Next Steps

1. **Read the API Reference**: See [API-QUICK-REFERENCE.md](../../API-QUICK-REFERENCE.md) for all 164 available commands
2. **Run Examples**: Check [examples/](examples/) directory for working code samples
3. **Integration**: Follow [INTEGRATION-CHECKLIST.md](../../INTEGRATION-CHECKLIST.md) for production setup
4. **Advanced Features**: 
   - [Evidence Chain Management](FORENSIC-CHAIN-OF-CUSTODY-GUIDE.md)
   - [Bot Evasion Framework](ADVANCED-EVASION-IMPLEMENTATION-GUIDE.md)
   - [Session Management](../../archives/prune-2026-07-06/SESSION-COHERENCE-IMPLEMENTATION.md)
5. **Monitoring**: Set up monitoring with [MONITORING-SETUP.md](../../MONITORING-SETUP.md)

---

## Support

For issues or questions:

1. Check [TROUBLESHOOTING.md](../../support/TROUBLESHOOTING.md) for detailed troubleshooting
2. Review [FAQ-COMPLETE.md](FAQ-COMPLETE.md) for common questions
3. Check server logs: `docker logs basset-hound-browser`
4. Review API reference for command parameters

---

## API Reference Quick Links

- **[Full API Reference](API-REFERENCE.md)** - All 164 commands with examples
- **[Command Categories](../../API-QUICK-REFERENCE.md)** - Commands grouped by function
- **[Error Recovery Guide](TROUBLESHOOTING-ADVANCED.md)** - Advanced error handling
- **[Performance Optimization](PERFORMANCE-OPTIMIZATION-QUICK-REFERENCE.md)** - Speed up your integration

---

**Version**: 12.3.0 | **Updated**: June 14, 2026 | **Status**: Production Ready
