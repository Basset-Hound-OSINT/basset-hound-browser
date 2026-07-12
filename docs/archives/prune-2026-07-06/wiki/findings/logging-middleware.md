# WebSocket Logging Middleware Implementation

## Overview

A comprehensive request/response logging middleware for the Basset Hound Browser WebSocket API. Logs all WebSocket traffic with structured JSON output, configurable levels, and sensitive data masking.

**Status:** ✅ Complete and Tested  
**Location:** `/websocket/logging-middleware.js`  
**Test File:** `/websocket/test-logging-middleware.js`  
**Test Status:** 9/9 tests passing

## Features

### 1. Request Logging
- **Timestamp:** ISO 8601 format (UTC)
- **Command:** Command name being executed
- **Parameters:** Full request parameters (with sensitive data masking)
- **Client ID:** Identifier for the requesting client
- **Request ID:** Optional correlation ID for request/response tracking

### 2. Response Logging
- **Timestamp:** ISO 8601 format (UTC)
- **Status Code:** HTTP-like status codes (200, 400, 500, 504, etc.)
- **Response Time:** Execution time in milliseconds
- **Response Size:** Size of response in bytes
- **Success/Failure:** Boolean flag indicating success
- **Error Code:** Detailed error classification
- **Recovery Suggestion:** Recommended action for error cases
- **Request Correlation:** Optional request ID for matching with request

### 3. Structured JSON Output
- **Format:** One JSON object per line (JSONL format)
- **File Location:** `/tmp/websocket-requests.log` (configurable)
- **Queryable:** Can filter by command, type, status code, and date
- **Machine-readable:** Suitable for log aggregation and analysis

### 4. Additional Features
- **Sensitive Data Masking:** Automatically masks passwords, tokens, API keys
- **Command Exclusion:** Skip logging for specified commands (e.g., ping, pong)
- **Log Rotation:** Automatic rotation based on file size
- **Statistics Tracking:** Real-time metrics on requests and responses
- **Log Levels:** DEBUG, INFO, WARN, ERROR with filtering
- **Console Output:** Optional console logging for debugging

## Implementation Details

### Constructor Options

```javascript
const middleware = new WebSocketLoggingMiddleware({
  level: 'INFO',                           // Log level (ERROR, WARN, INFO, DEBUG)
  logDir: './logs/websocket',              // Directory for formatted logs
  jsonLogFile: '/tmp/websocket-requests.log', // JSON log file path
  maxLogFileSize: 10 * 1024 * 1024,       // Max file size before rotation (10MB)
  maxLogFiles: 10,                         // Max number of rotated files to keep
  maskSensitive: true,                    // Mask sensitive data
  truncatePayloads: true,                 // Truncate large payloads
  maxPayloadLength: 1000,                 // Max payload size before truncation
  writeToFile: true,                      // Write formatted logs to file
  writeToConsole: false,                  // Write formatted logs to console
  writeStructuredJSON: true,              // Write structured JSON logs
  excludeCommands: ['ping', 'pong']       // Commands to exclude from logging
});
```

### Request Logging

```javascript
// Log a request
middleware.logRequest(
  command,      // string: command name
  clientId,     // string: client identifier
  params,       // object: request parameters
  logLevel,     // string: 'DEBUG', 'INFO', 'WARN', 'ERROR' (default: 'INFO')
  requestId     // string: optional correlation ID
);
```

**Example:**
```javascript
middleware.logRequest('navigate', 'client-1', { url: 'https://example.com' }, 'DEBUG', 'req-123');
```

### Response Logging

```javascript
// Log a response
middleware.logResponse(
  command,      // string: command name
  clientId,     // string: client identifier
  statusCode,   // number: HTTP-like status code
  responseTime, // number: execution time in ms
  responseSize, // number: response size in bytes (default: 0)
  error,        // string: error message if failed (default: null)
  errorCode,    // string: error code for classification (default: null)
  recovery,     // string: recovery suggestion (default: null)
  logLevel,     // string: 'DEBUG', 'INFO', 'WARN', 'ERROR' (default: 'INFO')
  requestId     // string: optional correlation ID (default: null)
);
```

**Example:**
```javascript
middleware.logResponse(
  'click',
  'client-1',
  200,           // success
  45,            // 45ms response time
  128,           // 128 bytes response
  null,          // no error
  null,
  null,
  'DEBUG',
  'req-123'
);
```

## Structured JSON Format

### Request Log Entry
```json
{
  "timestamp": "2026-06-22T10:30:45.123Z",
  "type": "request",
  "level": "DEBUG",
  "command": "navigate",
  "clientId": "client-1",
  "requestId": "req-123",
  "parameters": {
    "url": "https://example.com"
  }
}
```

### Response Log Entry
```json
{
  "timestamp": "2026-06-22T10:30:45.168Z",
  "type": "response",
  "level": "DEBUG",
  "command": "navigate",
  "clientId": "client-1",
  "requestId": "req-123",
  "statusCode": 200,
  "responseTime": 45,
  "responseSize": 2048,
  "success": true,
  "error": null,
  "errorCode": null,
  "recovery": null
}
```

### Error Response Log Entry
```json
{
  "timestamp": "2026-06-22T10:30:46.200Z",
  "type": "response",
  "level": "ERROR",
  "command": "execute_script",
  "clientId": "client-1",
  "requestId": "req-124",
  "statusCode": 504,
  "responseTime": 5000,
  "responseSize": 256,
  "success": false,
  "error": "Script execution timeout",
  "errorCode": "EXECUTION_TIMEOUT",
  "recovery": "Increase timeout or optimize script"
}
```

## Sensitive Data Masking

Automatically masks the following patterns:
- Password fields: `password=***MASKED***`
- API keys: `apiKey=***MASKED***`
- Bearer tokens: `Bearer ***MASKED***`
- Authorization headers: `authorization=***MASKED***`
- Secret fields: `secret=***MASKED***`

**Example:**
```javascript
middleware.logRequest('authenticate', 'client-1', {
  username: 'user@example.com',
  password: 'secret123',
  apiKey: 'sk-1234567890'
}, 'INFO');
```

Results in logged parameters:
```json
{
  "username": "user@example.com",
  "password": "***MASKED***",
  "apiKey": "***MASKED***"
}
```

## Statistics and Monitoring

### Get Current Statistics
```javascript
const stats = middleware.getStats();
// Returns: {
//   totalRequests: 1234,
//   totalResponses: 1230,
//   successfulResponses: 1200,
//   failedResponses: 30,
//   averageResponseTime: 145,
//   uptime: 3600000,
//   requestsPerMinute: 20,
//   successRate: "97.56%",
//   currentLogFile: "/path/to/logs/websocket/websocket-*.log",
//   currentLogFileSize: "2.3MB"
// }
```

### Get Structured Logs
```javascript
const logs = await middleware.readStructuredLogs({
  limit: 100,                    // Get last 100 entries
  command: 'navigate',           // Filter by command
  type: 'response',              // Filter by type (request/response)
  minStatusCode: 400,            // Filter by status code range
  maxStatusCode: 599
});
```

### Get Logs Summary
```javascript
const summary = await middleware.getStructuredLogsSummary();
// Returns: {
//   totalLogs: 2460,
//   totalRequests: 1230,
//   totalResponses: 1230,
//   totalErrors: 30,
//   errorRate: "2.44%",
//   averageResponseTime: 145,
//   commandStats: {
//     navigate: { count: 300, successful: 290, failed: 10, avgResponseTime: 150 },
//     click: { count: 400, successful: 395, failed: 5, avgResponseTime: 45 },
//     ...
//   }
// }
```

## Configuration via Environment Variables

```bash
# Set log level
export WS_LOG_LEVEL=DEBUG

# Set log directory
export WS_LOG_DIR=/var/log/basset-hound

# Enable/disable logging
export WS_LOG_ENABLE=true

# Write to console
export WS_LOG_CONSOLE=true

# JSON log file location
export WS_JSON_LOG_FILE=/var/log/basset-hound/websocket-requests.log
```

## Server Integration

### Basic Integration in WebSocket Server

```javascript
const { WebSocketLoggingMiddleware } = require('./logging-middleware');

class WebSocketServer {
  constructor(options = {}) {
    // Initialize logging middleware
    this.loggingMiddleware = new WebSocketLoggingMiddleware({
      level: process.env.WS_LOG_LEVEL || 'INFO',
      logDir: process.env.WS_LOG_DIR || path.join(process.cwd(), 'logs', 'websocket'),
      excludeCommands: ['ping', 'pong', 'get_rate_limit_status']
    });

    // Listen for errors
    this.loggingMiddleware.on('error', (error) => {
      this.logger.error(`Logging error: ${error.message}`);
    });
  }

  handleConnection(ws, req) {
    ws.on('message', async (message) => {
      const startTime = Date.now();
      let command = 'unknown';
      let clientId = ws.clientId;
      let requestId = null;

      try {
        const data = JSON.parse(message.toString());
        command = data.command || 'unknown';
        requestId = data.id;

        // Log incoming request
        this.loggingMiddleware.logRequest(
          command,
          clientId,
          data,
          'DEBUG',
          requestId
        );

        // Execute command
        const result = await this.executeCommand(command, data);

        // Log successful response
        const responseTime = Date.now() - startTime;
        this.loggingMiddleware.logResponse(
          command,
          clientId,
          200,
          responseTime,
          JSON.stringify(result).length,
          null,
          null,
          null,
          'DEBUG',
          requestId
        );

        this._sendResponse(ws, result, 'success');

      } catch (error) {
        const responseTime = Date.now() - startTime;

        // Log error response
        this.loggingMiddleware.logResponse(
          command,
          clientId,
          500,
          responseTime,
          0,
          error.message,
          'COMMAND_FAILED',
          'Check server logs for details',
          'ERROR',
          requestId
        );

        this._sendResponse(ws, { error: error.message }, 'error');
      }
    });
  }

  shutdown() {
    if (this.loggingMiddleware) {
      this.loggingMiddleware.shutdown();
    }
  }
}
```

## Log File Locations

### Formatted Logs
- **Directory:** `./logs/websocket/` (configurable)
- **Format:** Human-readable text
- **Naming:** `websocket-2026-06-22T10-30-45.log`
- **Rotation:** Automatic when file exceeds 10MB

### Structured JSON Logs
- **File:** `/tmp/websocket-requests.log` (configurable)
- **Format:** JSON Lines (one JSON object per line)
- **Append-only:** All entries appended to single file
- **No rotation:** Manual cleanup required

## API Methods

### Core Logging
- `logRequest(command, clientId, params, logLevel, requestId)` - Log incoming request
- `logResponse(command, clientId, statusCode, responseTime, responseSize, error, errorCode, recovery, logLevel, requestId)` - Log response

### Statistics
- `getStats()` - Get current statistics
- `getLogFiles()` - Get list of formatted log files
- `readStructuredLogs(options)` - Read and filter JSON logs
- `getStructuredLogsSummary()` - Get summary statistics from JSON logs

### Management
- `setLevel(level)` - Change log level at runtime
- `getLevel()` - Get current log level
- `clearLogs()` - Clear all formatted logs
- `clearStructuredLogs()` - Clear JSON log file
- `shutdown()` - Graceful shutdown

## Event Emitter

The middleware extends EventEmitter and emits the following events:

- `request` - Emitted when a request is logged
- `response` - Emitted when a response is logged
- `jsonLogged` - Emitted when structured JSON is written
- `logFileOpened` - Emitted when new log file is opened
- `logRotated` - Emitted when log file is rotated
- `logsCleared` - Emitted when logs are cleared
- `structuredLogsCleared` - Emitted when JSON logs are cleared
- `levelChanged` - Emitted when log level changes
- `error` - Emitted on any error
- `shutdown` - Emitted on shutdown

## Testing

### Run Test Suite

```bash
cd /home/devel/basset-hound-browser
node websocket/test-logging-middleware.js
```

### Test Coverage

The test suite covers:

1. **Basic Request Logging** - Verify requests are logged with all fields
2. **Response Logging with Timing** - Verify response timing and status codes
3. **Error Response Logging** - Verify error messages and recovery suggestions
4. **Multiple Requests** - Verify logging scales to multiple concurrent requests
5. **Sensitive Data Masking** - Verify passwords/tokens are masked
6. **Command Exclusion** - Verify excluded commands are not logged
7. **Statistics Tracking** - Verify accurate statistics
8. **Structured Logs Summary** - Verify JSON logs are readable
9. **Default JSON Log Location** - Verify default location at `/tmp/websocket-requests.log`

### Test Results

```
╔════════════════════════════════════════════════════════════╗
║  WebSocket Logging Middleware - Comprehensive Test Suite  ║
╚════════════════════════════════════════════════════════════╝

=== Test 1: Basic Request Logging ===
✓ Basic request logging works

=== Test 2: Response Logging with Timing ===
✓ Response logging with timing works

=== Test 3: Error Response Logging ===
✓ Error response logging works

=== Test 4: Multiple Requests and Responses ===
✓ Logged 5 request/response pairs (avg response time: 95ms)

=== Test 5: Sensitive Data Masking ===
✓ Sensitive data masking works

=== Test 6: Command Exclusion ===
✓ Command exclusion works

=== Test 7: Statistics Tracking ===
✓ Statistics tracking works
  - Total Requests: 2
  - Total Responses: 2
  - Successful: 1
  - Failed: 1
  - Avg Response Time: 75ms

=== Test 8: Structured Logs Summary ===
✓ Structured logs are properly formatted and readable

=== Test 9: Default JSON Log Location ===
✓ Default JSON log location (/tmp/websocket-requests.log) works correctly

╔════════════════════════════════════════════════════════════╗
║  ✓ ALL TESTS PASSED                                        ║
╚════════════════════════════════════════════════════════════╝
```

## Performance Considerations

- **Async I/O:** Uses fs.appendFileSync for JSON logging (synchronous for reliability)
- **Memory:** Keeps last 1000 response times for average calculation
- **Disk Space:** Formatted logs rotate at 10MB, JSON logs append-only
- **CPU:** Minimal overhead, regex-based masking only on write
- **Concurrency:** Thread-safe for multiple concurrent clients

## Log Analysis Examples

### Find all failed commands
```bash
grep '"success": false' /tmp/websocket-requests.log
```

### Extract response times for a command
```bash
grep '"command": "navigate"' /tmp/websocket-requests.log | jq '.responseTime'
```

### Count errors by type
```bash
grep '"type": "response"' /tmp/websocket-requests.log | jq '.errorCode' | sort | uniq -c
```

### Find slow requests (>1000ms)
```bash
grep '"type": "response"' /tmp/websocket-requests.log | jq 'select(.responseTime > 1000)'
```

### Export as CSV
```bash
grep '"type": "response"' /tmp/websocket-requests.log | jq -r '[.timestamp, .command, .statusCode, .responseTime, .success] | @csv'
```

## Troubleshooting

### JSON logs not being written
- Check that `/tmp/websocket-requests.log` is writable
- Verify `writeStructuredJSON: true` in options
- Check file permissions: `ls -la /tmp/websocket-requests.log`

### Sensitive data not being masked
- Ensure `maskSensitive: true` in options (default)
- Check that patterns match field names
- Note: Masking is applied when logging, not retroactively

### High disk usage
- Check log rotation is enabled for formatted logs
- Manually clear JSON logs: `middleware.clearStructuredLogs()`
- Implement external log rotation for `/tmp/websocket-requests.log`

### Missing logs for certain commands
- Check if command is in `excludeCommands` list
- Verify log level is set to include the command's level
- Check that writeToFile and writeStructuredJSON are enabled

## Future Enhancements

- [ ] Remote log streaming to aggregation service
- [ ] Real-time log analysis and alerting
- [ ] Log export formats (CSV, Parquet)
- [ ] Interactive log viewer/analyzer
- [ ] Machine learning-based anomaly detection
- [ ] Performance profiling integration
- [ ] Command-specific logging policies
- [ ] Automatic error classification and grouping

## Files

- **Implementation:** `/websocket/logging-middleware.js`
- **Tests:** `/websocket/test-logging-middleware.js`
- **Integration Example:** `/websocket/logging-middleware-integration.example.js`
- **JSON Log Output:** `/tmp/websocket-requests.log`
- **Documentation:** `/docs/wiki/findings/logging-middleware.md`

## Author Notes

The logging middleware provides comprehensive visibility into WebSocket traffic for the Basset Hound Browser. The structured JSON format enables easy integration with log aggregation systems (ELK, Splunk, etc.) while the formatted text logs support human inspection during development and debugging.

The dual-format approach (human-readable + structured JSON) provides flexibility for different use cases:
- Development/debugging: Use formatted text logs with console output
- Production: Use structured JSON logs for aggregation and analysis
- Security: Automatic masking of sensitive data in all logs
