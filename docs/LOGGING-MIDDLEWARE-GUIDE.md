# WebSocket Request/Response Logging Middleware

## Overview

The **WebSocketLoggingMiddleware** provides comprehensive request/response logging for WebSocket commands, enabling developers to debug, troubleshoot, and monitor browser automation workflows.

**Location:** `/websocket/logging-middleware.js`

**Version:** 1.0.0

## Key Features

### 1. **Comprehensive Logging**
- Timestamp (ISO 8601 format)
- Command name
- Client ID
- Request parameters
- Response status codes (HTTP-like: 200, 400, 404, 429, 500, 504)
- Response times (in milliseconds)
- Response size (in bytes)
- Error codes and messages

### 2. **Configurable Log Levels**
Four log levels control what gets logged:
- **ERROR** (0) - Only critical errors
- **WARN** (1) - Warnings and errors
- **INFO** (2) - General information (default)
- **DEBUG** (3) - Detailed debugging information

### 3. **Sensitive Data Masking**
Automatically detects and masks:
- Passwords
- API keys and tokens
- Authorization headers
- Secrets
- Custom credential patterns

### 4. **Payload Management**
- Automatic truncation of large payloads (default: 1000 bytes)
- Prevents log files from growing too large
- Shows truncated size in logs

### 5. **Log Rotation**
- Automatic rotation when log files exceed max size (default: 10MB)
- Keeps configurable number of recent log files (default: 10)
- Old logs automatically cleaned up

### 6. **Statistics & Monitoring**
- Tracks total requests and responses
- Calculates success rates
- Maintains average response times
- Provides uptime metrics
- Requests per minute calculation

## Installation & Setup

### Basic Setup

```javascript
const { WebSocketLoggingMiddleware } = require('./logging-middleware');

// Create middleware instance
const loggingMiddleware = new WebSocketLoggingMiddleware({
  level: 'INFO',                              // Log level
  logDir: './logs/websocket',                 // Log directory
  maskSensitive: true,                        // Mask passwords, tokens, etc.
  truncatePayloads: true,                     // Truncate large payloads
  maxPayloadLength: 1000,                     // Max payload size
  writeToFile: true,                          // Write to log files
  writeToConsole: false,                      // Write to console
  excludeCommands: ['ping', 'heartbeat']      // Commands to exclude
});

// Handle events
loggingMiddleware.on('error', (error) => {
  console.error('Logging error:', error);
});

loggingMiddleware.on('logFileOpened', (filePath) => {
  console.log('Opened log file:', filePath);
});
```

### Environment Variables

Configure via environment variables:

```bash
# Log level (DEBUG, INFO, WARN, ERROR)
export WS_LOG_LEVEL=DEBUG

# Log directory
export WS_LOG_DIR=/var/log/basset/websocket

# Enable/disable logging
export WS_LOG_ENABLE=true

# Enable console output (in addition to file)
export WS_LOG_CONSOLE=false
```

### Integration with WebSocket Server

See `/websocket/logging-middleware-integration.example.js` for complete integration example.

**Key integration points:**

1. Initialize middleware in server constructor
2. Log requests in message handler (before command execution)
3. Log responses after command execution
4. Handle timing and response size calculations
5. Clean up in server shutdown

## Usage Examples

### Logging a Request

```javascript
loggingMiddleware.logRequest(
  'navigateTo',
  'client-123',
  { url: 'https://example.com', timeout: 30000 },
  'DEBUG'
);
```

**Output:**
```
[2026-06-21T16:30:45.123Z] DEBUG navigateTo (client-123)
  Parameters: {"url":"https://example.com","timeout":30000}
```

### Logging a Successful Response

```javascript
loggingMiddleware.logResponse(
  'navigateTo',
  'client-123',
  200,                    // Status code
  1234,                   // Response time (ms)
  2048,                   // Response size (bytes)
  null,                   // No error
  null,                   // No error code
  null,                   // No recovery needed
  'DEBUG'                 // Log level
);
```

**Output:**
```
[2026-06-21T16:30:46.357Z] DEBUG navigateTo (client-123)
  Response: 200 (1234ms, 2.0KB)
```

### Logging a Failed Response

```javascript
loggingMiddleware.logResponse(
  'click',
  'client-123',
  504,                                    // Status code (timeout)
  28999,                                  // Response time
  512,                                    // Response size
  'Command execution timeout',            // Error message
  'COMMAND_TIMED_OUT',                    // Error code
  'Increase timeout or check selector',   // Recovery suggestion
  'WARN'                                  // Log level
);
```

**Output:**
```
[2026-06-21T16:30:46.456Z] WARN click (client-123)
  Response: 504 (28999ms, 512B)
  Error: Command execution timeout
  Error Code: COMMAND_TIMED_OUT
  Recovery: Increase timeout or check selector
```

### Logging with Sensitive Data (Auto-Masked)

```javascript
loggingMiddleware.logRequest(
  'authenticate',
  'client-456',
  {
    username: 'user@example.com',
    password: 'secretPassword123',
    token: 'eyJhbGciOiJIUzI1NiIs...'
  },
  'DEBUG'
);
```

**Output (sensitive data masked):**
```
[2026-06-21T16:30:47.789Z] DEBUG authenticate (client-456)
  Parameters: {"username":"user@example.com","password":"***MASKED***","token":"***MASKED***"}
```

## Response Status Codes

Middleware uses HTTP-like status codes for consistency:

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Command executed successfully |
| 400 | Bad Request | Malformed JSON, invalid parameters |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Error | Server error, command failed |
| 504 | Gateway Timeout | Command execution timeout |

## Error Codes

| Code | Meaning | Recovery |
|------|---------|----------|
| `COMMAND_TIMED_OUT` | Command exceeded timeout | Increase timeout, check selector |
| `COMMAND_FAILED` | Command execution failed | Check server logs, verify parameters |
| `MALFORMED_JSON` | Invalid JSON in request | Verify request format |
| `INVALID_FORMAT` | Missing required fields | Check required parameters |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait before retrying |
| `RESOURCE_NOT_FOUND` | Resource not found | Verify resource exists |
| `INTERNAL_ERROR` | Unexpected server error | Check server logs |

## Configuration Options

### Complete Options Object

```javascript
{
  // Log level threshold
  level: 'INFO',                    // ERROR, WARN, INFO, DEBUG
  
  // File management
  logDir: './logs/websocket',       // Directory for log files
  maxLogFileSize: 10485760,         // Max file size (10MB)
  maxLogFiles: 10,                  // Number of files to keep
  
  // Data handling
  maskSensitive: true,              // Mask passwords, tokens, etc.
  truncatePayloads: true,           // Truncate large payloads
  maxPayloadLength: 1000,           // Max payload chars
  
  // Output
  writeToFile: true,                // Write to log files
  writeToConsole: false,            // Also write to console
  
  // Filtering
  excludeCommands: [                // Commands to skip logging
    'ping',
    'heartbeat'
  ]
}
```

## API Reference

### `logRequest(command, clientId, params, logLevel)`

Log an incoming WebSocket request.

**Parameters:**
- `command` (string) - Command name
- `clientId` (string) - Client ID
- `params` (object) - Request parameters
- `logLevel` (string) - 'DEBUG', 'INFO', 'WARN', 'ERROR'

### `logResponse(command, clientId, statusCode, responseTime, responseSize, error, errorCode, recovery, logLevel)`

Log an outgoing response.

**Parameters:**
- `command` (string) - Command name
- `clientId` (string) - Client ID
- `statusCode` (number) - HTTP-like status code
- `responseTime` (number) - Response time in milliseconds
- `responseSize` (number) - Response size in bytes (optional)
- `error` (string) - Error message (optional)
- `errorCode` (string) - Error code (optional)
- `recovery` (string) - Recovery suggestion (optional)
- `logLevel` (string) - Log level (optional, default 'INFO')

### `setLevel(level)`

Change log level at runtime.

**Parameters:**
- `level` (string) - 'ERROR', 'WARN', 'INFO', 'DEBUG'

### `getLevel()`

Get current log level name.

**Returns:** Current level name (string)

### `getStats()`

Get logging statistics.

**Returns:** Statistics object with:
- `totalRequests` - Total requests logged
- `totalResponses` - Total responses logged
- `successfulResponses` - Count of successful responses (status < 400)
- `failedResponses` - Count of failed responses (status >= 400)
- `averageResponseTime` - Average response time (ms)
- `successRate` - Success percentage
- `requestsPerMinute` - Requests per minute
- `currentLogFile` - Path to active log file
- `currentLogFileSize` - Active log file size (formatted)
- `uptime` - Uptime in milliseconds

### `getLogFiles()`

Get list of all log files.

**Returns:** Array of log file objects with:
- `name` - Filename
- `path` - Full path
- `size` - Human-readable size
- `sizeBytes` - Size in bytes
- `created` - Creation timestamp
- `modified` - Last modified timestamp

### `clearLogs()`

Delete all log files and start fresh.

### `resetStats()`

Reset statistics counters.

### `shutdown()`

Cleanup middleware resources and close file handles.

## Log File Format

Log files are stored in `./logs/websocket/` with timestamped names:

```
websocket-2026-06-21T16-30-45.log
websocket-2026-06-21T17-15-23.log
websocket-2026-06-21T18-45-10.log
```

Each log entry contains:

```
[2026-06-21T16:30:45.123Z] DEBUG navigateTo (client-abc)
  Parameters: { url: "https://example.com", timeout: 30000 }
  Response: 200 (145ms, 2.3KB)

[2026-06-21T16:30:46.456Z] WARN click (client-abc)
  Parameters: { selector: "#btn" }
  Response: 504 (28999ms)
  Error: Command execution timeout
  Error Code: COMMAND_TIMED_OUT
  Recovery: Increase timeout or check selector
```

## WebSocket Commands for Logging Management

When integrated with server, these commands are available:

### `get_logging_stats`

Retrieve logging statistics.

**Request:**
```json
{
  "command": "get_logging_stats",
  "id": "123"
}
```

**Response:**
```json
{
  "id": "123",
  "command": "get_logging_stats",
  "success": true,
  "stats": {
    "totalRequests": 1234,
    "totalResponses": 1230,
    "successfulResponses": 1200,
    "failedResponses": 30,
    "averageResponseTime": 145,
    "uptime": 3600000,
    "requestsPerMinute": 20,
    "successRate": "97.56%",
    "currentLogFile": "/path/to/logs/websocket/websocket-2026-06-21T16-30-45.log",
    "currentLogFileSize": "2.3MB"
  }
}
```

### `get_log_files`

Get list of all log files.

**Request:**
```json
{
  "command": "get_log_files",
  "id": "124"
}
```

**Response:**
```json
{
  "id": "124",
  "command": "get_log_files",
  "success": true,
  "files": [
    {
      "name": "websocket-2026-06-21T16-30-45.log",
      "path": "/path/to/logs/websocket/...",
      "size": "2.3MB",
      "sizeBytes": 2408448,
      "created": "2026-06-21T16:30:45.123Z",
      "modified": "2026-06-21T16:35:20.456Z"
    }
  ]
}
```

### `set_logging_level`

Change log level at runtime.

**Request:**
```json
{
  "command": "set_logging_level",
  "id": "125",
  "level": "DEBUG"
}
```

**Response:**
```json
{
  "id": "125",
  "command": "set_logging_level",
  "success": true,
  "message": "Logging level set to DEBUG",
  "stats": { /* current stats */ }
}
```

### `clear_logs`

Delete all log files.

**Request:**
```json
{
  "command": "clear_logs",
  "id": "126"
}
```

**Response:**
```json
{
  "id": "126",
  "command": "clear_logs",
  "success": true,
  "message": "All log files cleared"
}
```

## Troubleshooting

### Logs not appearing in files

1. Check that `writeToFile: true` (default)
2. Verify log directory exists and is writable
3. Check `WS_LOG_ENABLE` environment variable is not 'false'
4. Verify command is not in `excludeCommands` list

### Logs showing truncated payloads

If responses are truncated:
1. Increase `maxPayloadLength` (default: 1000)
2. Or set `truncatePayloads: false` to disable truncation
3. Note: Very large payloads still recommended to be truncated to prevent huge log files

### Sensitive data not being masked

1. Check `maskSensitive: true` (default)
2. If custom fields need masking, add regex patterns to `SENSITIVE_PATTERNS`
3. Patterns match field names like "password", "token", "secret", "api_key"

### Log files growing too large

1. Log rotation triggers at `maxLogFileSize` (default: 10MB)
2. Reduce this value to rotate more frequently
3. Increase `maxLogFiles` to keep more history
4. Or call `clearLogs()` to delete old logs

## Performance Considerations

### Overhead

- Minimal performance impact
- Sensitive data masking uses regex (cached patterns)
- Truncation is fast string operation
- File I/O is async (non-blocking)

### Disk Space

Typical consumption:
- Each request log: 200-500 bytes
- Each response log: 300-800 bytes
- High-frequency commands excluded by default (ping, heartbeat)

With defaults (10MB file size, 10 files):
- Maximum disk usage: ~100MB
- Average with 1000+ requests/min: ~10-20MB

### Memory

- Request times stored in ring buffer (max 1000 samples)
- Stats calculated on demand
- File handles cached

## Best Practices

### 1. **Choose Appropriate Log Level**

```javascript
// Production: INFO or WARN only
loggingMiddleware.setLevel('INFO');

// Development: DEBUG for detailed info
loggingMiddleware.setLevel('DEBUG');

// Troubleshooting: DEBUG for everything
loggingMiddleware.setLevel('DEBUG');
```

### 2. **Exclude High-Frequency Commands**

```javascript
excludeCommands: [
  'ping',           // Heartbeat
  'heartbeat',      // Health check
  'status',         // Frequent status checks
  'get_rate_limit_status'
]
```

### 3. **Regular Log Cleanup**

```javascript
// Clear logs weekly or after testing
loggingMiddleware.clearLogs();

// Monitor log files
const files = loggingMiddleware.getLogFiles();
```

### 4. **Monitor Statistics**

```javascript
// Periodically check health
const stats = loggingMiddleware.getStats();
if (stats.successRate < '95%') {
  // Alert on low success rate
}
```

## Events

Middleware emits events for monitoring:

```javascript
// Request logged
loggingMiddleware.on('request', (data) => {
  console.log(`Logged request: ${data.command}`);
});

// Response logged
loggingMiddleware.on('response', (data) => {
  console.log(`Response time: ${data.responseTime}ms`);
});

// Log level changed
loggingMiddleware.on('levelChanged', (level) => {
  console.log(`Level changed to: ${level}`);
});

// Log file opened
loggingMiddleware.on('logFileOpened', (filePath) => {
  console.log(`Using log file: ${filePath}`);
});

// Log file rotated
loggingMiddleware.on('logRotated', () => {
  console.log('Log file rotated');
});

// Logs cleared
loggingMiddleware.on('logsCleared', () => {
  console.log('All logs cleared');
});

// Error in middleware
loggingMiddleware.on('error', (error) => {
  console.error(`Logging error: ${error.message}`);
});

// Middleware shutdown
loggingMiddleware.on('shutdown', () => {
  console.log('Logging middleware shut down');
});
```

## Examples

### Complete Integration Example

See `/websocket/logging-middleware-integration.example.js` for a full integration example showing:
- Initialization in server constructor
- Request logging before command execution
- Response logging with status codes
- Error handling and recovery suggestions
- WebSocket command registration
- Statistics and management commands

### Debugging Workflow

```javascript
// 1. Enable DEBUG logging
server.setLoggingLevel('DEBUG');

// 2. Reproduce issue
client.send({ command: 'navigateTo', url: '...' });

// 3. Check logs
const files = server.getLogFiles();
const logPath = files[0].path;
// cat logPath | grep "command that failed"

// 4. Analyze response time
const stats = server.getLoggingStats();
console.log(`Average response time: ${stats.averageResponseTime}ms`);

// 5. Reset and try again if needed
server.clearLogs();
```

## Version History

### v1.0.0 (2026-06-21)

Initial release with:
- Comprehensive request/response logging
- 4 configurable log levels
- Automatic sensitive data masking
- Payload truncation
- Log rotation and cleanup
- Statistics and monitoring
- WebSocket management commands
