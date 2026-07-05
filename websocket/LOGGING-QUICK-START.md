# WebSocket Logging Middleware - Quick Start Guide

## 5-Minute Integration

### Step 1: Import the Middleware
```javascript
const { WebSocketLoggingMiddleware } = require('./logging-middleware');
```

### Step 2: Create Middleware Instance
```javascript
const loggingMiddleware = new WebSocketLoggingMiddleware({
  level: 'INFO',
  logDir: './logs/websocket',
  jsonLogFile: '/tmp/websocket-requests.log',
  excludeCommands: ['ping', 'pong', 'get_rate_limit_status']
});
```

### Step 3: Log Requests
```javascript
ws.on('message', async (message) => {
  const startTime = Date.now();
  const data = JSON.parse(message);
  
  // Log the request
  loggingMiddleware.logRequest(
    data.command,
    ws.clientId,
    data,
    'DEBUG',
    data.id  // Optional: for request/response correlation
  );
  
  try {
    // ... execute command ...
    const result = await executeCommand(data.command, data.params);
    
    // Log success response
    loggingMiddleware.logResponse(
      data.command,
      ws.clientId,
      200,                        // statusCode
      Date.now() - startTime,    // responseTime
      JSON.stringify(result).length,
      null,                       // no error
      null,
      null,
      'DEBUG',
      data.id                     // correlation
    );
    
  } catch (error) {
    // Log error response
    loggingMiddleware.logResponse(
      data.command,
      ws.clientId,
      500,                        // statusCode
      Date.now() - startTime,    // responseTime
      0,                          // responseSize
      error.message,              // error
      'EXECUTION_ERROR',          // errorCode
      'Check server logs',        // recovery
      'ERROR',
      data.id                     // correlation
    );
  }
});
```

### Step 4: Shutdown on Server Close
```javascript
server.on('close', () => {
  loggingMiddleware.shutdown();
});
```

## Viewing Logs

### Structured JSON Logs (Analysis)
```bash
# View last 10 requests
tail -10 /tmp/websocket-requests.log

# View all navigations
grep '"command": "navigate"' /tmp/websocket-requests.log | jq .

# Find errors
grep '"statusCode": 5' /tmp/websocket-requests.log | jq .
```

### Formatted Logs (Human-readable)
```bash
# View latest formatted logs
ls -lt logs/websocket/ | head -5
tail -100 logs/websocket/websocket-*.log | less
```

## Quick Reference

### Status Codes
- `200` - Success
- `400` - Bad request / validation error
- `404` - Resource not found
- `429` - Rate limit exceeded
- `500` - Server error / command failed
- `504` - Timeout

### Error Codes
- `COMMAND_FAILED` - General execution failure
- `EXECUTION_TIMEOUT` - Command took too long
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `RESOURCE_NOT_FOUND` - Selector/element not found
- `MALFORMED_JSON` - Invalid JSON in request
- `AUTH_REQUIRED` - Authentication needed
- `INTERNAL_ERROR` - Server-side error

### Log Levels
- `DEBUG` - Detailed diagnostic info (verbose)
- `INFO` - General informational messages
- `WARN` - Warning messages, potential issues
- `ERROR` - Error conditions

## Common Patterns

### Timing Analysis
```javascript
const startTime = Date.now();
// ... do work ...
const elapsed = Date.now() - startTime;
loggingMiddleware.logResponse(cmd, clientId, 200, elapsed, size);
```

### Error Handling
```javascript
loggingMiddleware.logResponse(
  cmd,
  clientId,
  statusCode,      // 500 for errors
  elapsed,
  0,               // no response on error
  error.message,   // actual error
  error.code || 'UNKNOWN_ERROR',  // classification
  recoverySuggestion,
  'ERROR'
);
```

### Request Correlation
```javascript
// Log request with unique ID
const requestId = `${Date.now()}-${Math.random()}`;
loggingMiddleware.logRequest(cmd, clientId, data, 'DEBUG', requestId);

// Later, log response with same ID
loggingMiddleware.logResponse(cmd, clientId, status, time, size, error, code, recovery, level, requestId);
```

## Configuration Options

```javascript
new WebSocketLoggingMiddleware({
  level: 'INFO',                              // Log level
  logDir: './logs/websocket',                 // Formatted log directory
  jsonLogFile: '/tmp/websocket-requests.log', // JSON log file
  maxLogFileSize: 10 * 1024 * 1024,          // Rotate at 10MB
  maxLogFiles: 10,                            // Keep 10 rotated files
  maskSensitive: true,                        // Mask passwords/tokens
  truncatePayloads: true,                     // Truncate large data
  maxPayloadLength: 1000,                     // Max bytes before truncate
  writeToFile: true,                          // Write formatted logs
  writeToConsole: false,                      // Debug to console
  writeStructuredJSON: true,                  // Write JSON logs
  excludeCommands: ['ping', 'pong']           // Don't log these commands
})
```

## Environment Variables

```bash
# Control via environment
export WS_LOG_LEVEL=DEBUG           # DEBUG, INFO, WARN, ERROR
export WS_LOG_DIR=/var/log/basset   # Log directory
export WS_JSON_LOG_FILE=/tmp/ws.log # JSON log path
export WS_LOG_ENABLE=true           # Enable/disable
export WS_LOG_CONSOLE=false         # Console output
```

## Troubleshooting

**Issue:** No JSON logs in `/tmp/websocket-requests.log`
- Check: `ls -la /tmp/websocket-requests.log` (must be writable)
- Verify: `writeStructuredJSON: true` in options
- Check: Logs aren't excluded via `excludeCommands`

**Issue:** Passwords still visible in logs
- Set: `maskSensitive: true` (should be default)
- Note: Masking happens at log write time, not retroactively

**Issue:** Log file growing too large
- Enable rotation: `maxLogFileSize: 10 * 1024 * 1024`
- Manual cleanup: `rm logs/websocket/websocket-*.log`
- Clear JSON: `loggingMiddleware.clearStructuredLogs()`

## Getting Stats

```javascript
// Get current statistics
const stats = loggingMiddleware.getStats();
console.log(`Total requests: ${stats.totalRequests}`);
console.log(`Success rate: ${stats.successRate}`);
console.log(`Avg response: ${stats.averageResponseTime}ms`);

// Get all log files
const files = loggingMiddleware.getLogFiles();
files.forEach(f => console.log(`${f.name}: ${f.size}`));

// Read structured logs programmatically
const logs = await loggingMiddleware.readStructuredLogs({
  limit: 100,
  command: 'navigate',
  type: 'response'
});
```

## Next Steps

1. See `/websocket/logging-middleware.js` for full API
2. Check `/docs/wiki/findings/logging-middleware.md` for detailed docs
3. Run `/websocket/test-logging-middleware.js` to verify setup
4. Integrate into `/websocket/server.js` using the patterns above
