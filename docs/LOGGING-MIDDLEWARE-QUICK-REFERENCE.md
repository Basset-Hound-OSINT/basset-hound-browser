# WebSocket Logging Middleware - Quick Reference

## Quick Setup (5 minutes)

### 1. Create Middleware

```javascript
const { WebSocketLoggingMiddleware } = require('./websocket/logging-middleware');

const loggingMiddleware = new WebSocketLoggingMiddleware({
  level: 'INFO'
});
```

### 2. Log Requests

```javascript
loggingMiddleware.logRequest(
  'navigateTo',      // Command name
  'client-123',      // Client ID
  { url: '...' }     // Parameters
);
```

### 3. Log Responses

```javascript
loggingMiddleware.logResponse(
  'navigateTo',      // Command name
  'client-123',      // Client ID
  200,               // Status code
  1234,              // Response time (ms)
  2048               // Response size (bytes)
);
```

### 4. Handle Errors

```javascript
loggingMiddleware.logResponse(
  'click',
  'client-123',
  504,                        // Status code
  28999,                      // Response time
  512,                        // Response size
  'Timeout occurred',         // Error message
  'COMMAND_TIMED_OUT',        // Error code
  'Increase timeout',         // Recovery suggestion
  'WARN'                      // Log level
);
```

## Common Patterns

### Pattern 1: Log Request + Response in Command Handler

```javascript
const startTime = Date.now();
const command = data.command;
const clientId = ws.clientId;

// LOG REQUEST
loggingMiddleware.logRequest(command, clientId, data);

try {
  // Execute command
  const result = await dispatcher.execute(command, data);
  const responseTime = Date.now() - startTime;
  
  // LOG SUCCESS
  loggingMiddleware.logResponse(
    command,
    clientId,
    200,
    responseTime,
    JSON.stringify(result).length
  );
  
  return result;
} catch (error) {
  const responseTime = Date.now() - startTime;
  
  // LOG ERROR
  loggingMiddleware.logResponse(
    command,
    clientId,
    500,
    responseTime,
    0,
    error.message,
    'COMMAND_FAILED'
  );
  
  throw error;
}
```

### Pattern 2: Monitor Success Rate

```javascript
setInterval(() => {
  const stats = loggingMiddleware.getStats();
  
  console.log(`
    Total requests: ${stats.totalRequests}
    Success rate: ${stats.successRate}
    Avg response: ${stats.averageResponseTime}ms
    Requests/min: ${stats.requestsPerMinute}
  `);
  
  if (stats.successRate < '95%') {
    alert('Success rate dropping!');
  }
}, 60000);
```

### Pattern 3: Dynamic Log Level Control

```javascript
// Client command to change log level
dispatcher.register('set_logging_level', (params) => {
  const { level } = params;
  loggingMiddleware.setLevel(level);
  return { success: true, message: `Level set to ${level}` };
});

// Client command to get logs
dispatcher.register('get_logs', (params) => {
  return {
    success: true,
    stats: loggingMiddleware.getStats(),
    files: loggingMiddleware.getLogFiles()
  };
});
```

## Configuration Presets

### Development (Verbose)

```javascript
{
  level: 'DEBUG',
  maskSensitive: true,
  truncatePayloads: true,
  maxPayloadLength: 500,
  writeToFile: true,
  writeToConsole: true
}
```

### Production (Balanced)

```javascript
{
  level: 'INFO',
  maskSensitive: true,
  truncatePayloads: true,
  maxPayloadLength: 1000,
  writeToFile: true,
  writeToConsole: false,
  excludeCommands: ['ping', 'heartbeat']
}
```

### Production (Minimal)

```javascript
{
  level: 'WARN',
  maskSensitive: true,
  truncatePayloads: true,
  writeToFile: true,
  writeToConsole: false,
  excludeCommands: ['ping', 'heartbeat', 'status', 'get_rate_limit_status']
}
```

## Response Status Codes

```javascript
200  // Success
400  // Bad request
404  // Not found
429  // Rate limited
500  // Server error
504  // Timeout
```

## Error Codes

```javascript
'COMMAND_TIMED_OUT'      // Command exceeded timeout
'COMMAND_FAILED'         // Command execution failed
'MALFORMED_JSON'         // Invalid JSON
'INVALID_FORMAT'         // Missing required fields
'RATE_LIMIT_EXCEEDED'    // Too many requests
'RESOURCE_NOT_FOUND'     // Resource not found
'INTERNAL_ERROR'         // Unexpected error
```

## API Reference

### Create Middleware

```javascript
const mw = new WebSocketLoggingMiddleware(options);
```

### Log Functions

```javascript
// Log incoming request
mw.logRequest(command, clientId, params, logLevel);

// Log outgoing response
mw.logResponse(
  command,
  clientId,
  statusCode,
  responseTime,
  responseSize,
  error,
  errorCode,
  recovery,
  logLevel
);
```

### Configuration Functions

```javascript
// Change log level at runtime
mw.setLevel('DEBUG');

// Get current log level
const level = mw.getLevel();

// Get statistics
const stats = mw.getStats();

// Get log files
const files = mw.getLogFiles();

// Clear all logs
mw.clearLogs();

// Reset statistics
mw.resetStats();

// Cleanup
mw.shutdown();
```

### Events

```javascript
mw.on('request', (data) => {});
mw.on('response', (data) => {});
mw.on('levelChanged', (level) => {});
mw.on('logFileOpened', (path) => {});
mw.on('logRotated', () => {});
mw.on('logsCleared', () => {});
mw.on('error', (error) => {});
mw.on('shutdown', () => {});
```

## Environment Variables

```bash
WS_LOG_LEVEL=DEBUG               # Log level
WS_LOG_DIR=/var/log/ws           # Log directory
WS_LOG_ENABLE=true               # Enable logging
WS_LOG_CONSOLE=false             # Console output
```

## Log Output Examples

### Successful Request/Response

```
[2026-06-21T16:30:45.123Z] DEBUG navigateTo (client-abc)
  Parameters: {"url":"https://example.com","timeout":30000}
  Response: 200 (145ms, 2.3KB)
```

### Failed Request/Response

```
[2026-06-21T16:30:46.456Z] WARN click (client-abc)
  Parameters: {"selector":"#btn"}
  Response: 504 (28999ms)
  Error: Command execution timeout
  Error Code: COMMAND_TIMED_OUT
  Recovery: Increase timeout or check selector
```

### Sensitive Data Masked

```
[2026-06-21T16:30:47.789Z] DEBUG authenticate (client-def)
  Parameters: {"username":"user@example.com","password":"***MASKED***","token":"***MASKED***"}
  Response: 200 (89ms, 512B)
```

### Truncated Large Payload

```
[2026-06-21T16:30:48.901Z] DEBUG extract_data (client-ghi)
  Parameters: {"selector":"#data","timeout":30000}... [TRUNCATED: +2048 bytes]
  Response: 200 (5423ms, 8.5MB)
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Logs not appearing | Check `writeToFile: true`, verify log dir exists |
| Sensitive data visible | Ensure `maskSensitive: true` |
| Files too large | Increase `maxLogFileSize`, reduce `maxPayloadLength` |
| Too much output | Increase log level to `'WARN'` or `'ERROR'` |
| Performance impact | Exclude high-frequency commands |

## Example: Full Integration

```javascript
// Initialize
const loggingMiddleware = new WebSocketLoggingMiddleware({
  level: process.env.WS_LOG_LEVEL || 'INFO'
});

// In message handler
ws.on('message', async (message) => {
  const startTime = Date.now();
  const data = JSON.parse(message);
  
  // Log request
  loggingMiddleware.logRequest(data.command, ws.clientId, data);
  
  try {
    // Execute
    const result = await commandDispatcher.execute(data.command, data);
    
    // Log success
    loggingMiddleware.logResponse(
      data.command,
      ws.clientId,
      200,
      Date.now() - startTime,
      JSON.stringify(result).length
    );
    
    // Send response
    ws.send(JSON.stringify(result));
  } catch (error) {
    // Log error
    loggingMiddleware.logResponse(
      data.command,
      ws.clientId,
      500,
      Date.now() - startTime,
      0,
      error.message,
      'COMMAND_FAILED',
      'Check server logs',
      'ERROR'
    );
    
    ws.send(JSON.stringify({ success: false, error: error.message }));
  }
});
```

## Performance Tips

1. **Exclude high-frequency commands**: ping, heartbeat, status
2. **Use INFO level in production** instead of DEBUG
3. **Truncate payloads** to keep files small
4. **Monitor log files** - clear periodically
5. **Use compression** if storing logs long-term

## More Information

Full documentation: `/docs/LOGGING-MIDDLEWARE-GUIDE.md`
Integration example: `/websocket/logging-middleware-integration.example.js`
Tests: `/tests/websocket/logging-middleware.test.js`
