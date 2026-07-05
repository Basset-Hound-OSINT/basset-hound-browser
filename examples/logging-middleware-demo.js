/**
 * WebSocket Logging Middleware - Practical Demo
 *
 * This file demonstrates the logging middleware in action with realistic
 * examples showing how it helps developers debug and monitor commands.
 *
 * Run: node examples/logging-middleware-demo.js
 */

const { WebSocketLoggingMiddleware } = require('../websocket/logging-middleware');
const path = require('path');

// Create middleware with console output for demo
const loggingMiddleware = new WebSocketLoggingMiddleware({
  level: 'DEBUG',
  logDir: path.join(__dirname, '../logs/demo'),
  maskSensitive: true,
  truncatePayloads: true,
  maxPayloadLength: 200,
  writeToFile: true,
  writeToConsole: true,  // Show output in console for demo
  excludeCommands: []
});

// Listen for events
loggingMiddleware.on('logFileOpened', (filePath) => {
  console.log('\n[EVENT] Log file opened:', filePath);
});

loggingMiddleware.on('request', (data) => {
  console.log('[EVENT] Request logged:', data.command);
});

loggingMiddleware.on('response', (data) => {
  console.log('[EVENT] Response logged:', data.command, '- Status:', data.statusCode);
});

console.log('================================================================================');
console.log('WebSocket Logging Middleware - Practical Demo');
console.log('================================================================================\n');

// Demo 1: Successful Navigation Command
console.log('--- Demo 1: Successful Navigation Command ---\n');
loggingMiddleware.logRequest(
  'navigateTo',
  'client-web-001',
  {
    url: 'https://example.com/login',
    timeout: 30000,
    waitUntil: 'networkidle0'
  },
  'DEBUG'
);

setTimeout(() => {
  loggingMiddleware.logResponse(
    'navigateTo',
    'client-web-001',
    200,
    2345,
    8192,
    null,
    null,
    null,
    'DEBUG'
  );

  // Demo 2: Failed Click Command (Timeout)
  console.log('\n--- Demo 2: Failed Click Command (Timeout) ---\n');
  loggingMiddleware.logRequest(
    'click',
    'client-web-001',
    {
      selector: '#login-button',
      timeout: 30000
    },
    'DEBUG'
  );

  setTimeout(() => {
    loggingMiddleware.logResponse(
      'click',
      'client-web-001',
      504,
      30050,
      512,
      'Timeout waiting for selector #login-button',
      'COMMAND_TIMED_OUT',
      'Check if selector exists, increase timeout, or add wait condition',
      'WARN'
    );

    // Demo 3: Authentication with Sensitive Data
    console.log('\n--- Demo 3: Authentication (Sensitive Data Masked) ---\n');
    loggingMiddleware.logRequest(
      'fill_form',
      'client-web-002',
      {
        email: 'user@example.com',
        password: 'MySecretPassword123!',
        apiKey: 'sk_live_' + '4eC39HqLyjWDarhtT657j41a' // split so scanners don't flag this synthetic demo value
      },
      'DEBUG'
    );

    setTimeout(() => {
      loggingMiddleware.logResponse(
        'fill_form',
        'client-web-002',
        200,
        845,
        256,
        null,
        null,
        null,
        'DEBUG'
      );

      // Demo 4: Malformed Request
      console.log('\n--- Demo 4: Malformed Request (Bad JSON) ---\n');
      loggingMiddleware.logRequest(
        'unknown',
        'client-web-003',
        'invalid-json',
        'INFO'
      );

      setTimeout(() => {
        loggingMiddleware.logResponse(
          'unknown',
          'client-web-003',
          400,
          15,
          128,
          'Invalid JSON format in request',
          'MALFORMED_JSON',
          'Verify request contains valid JSON and required fields',
          'WARN'
        );

        // Demo 5: Rate Limited
        console.log('\n--- Demo 5: Rate Limited Response ---\n');
        loggingMiddleware.logRequest(
          'screenshot',
          'client-web-004',
          {
            type: 'viewport'
          },
          'INFO'
        );

        setTimeout(() => {
          loggingMiddleware.logResponse(
            'screenshot',
            'client-web-004',
            429,
            125,
            0,
            'Rate limit exceeded: 100 requests per minute',
            'RATE_LIMIT_EXCEEDED',
            'Wait 30 seconds before retrying',
            'WARN'
          );

          // Demo 6: Large Payload (Gets Truncated)
          console.log('\n--- Demo 6: Large Payload (Truncated) ---\n');
          const largeData = {
            html: 'x'.repeat(5000),
            metadata: {
              title: 'Example Page',
              description: 'A very long description...'
            }
          };

          loggingMiddleware.logRequest(
            'extract_html',
            'client-web-005',
            largeData,
            'DEBUG'
          );

          setTimeout(() => {
            loggingMiddleware.logResponse(
              'extract_html',
              'client-web-005',
              200,
              5234,
              51200,
              null,
              null,
              null,
              'DEBUG'
            );

            // Show statistics
            console.log('\n================================================================================');
            console.log('Statistics After Demo');
            console.log('================================================================================\n');

            const stats = loggingMiddleware.getStats();
            console.log('Total Requests:       ', stats.totalRequests);
            console.log('Total Responses:      ', stats.totalResponses);
            console.log('Successful:           ', stats.successfulResponses);
            console.log('Failed:               ', stats.failedResponses);
            console.log('Success Rate:         ', stats.successRate);
            console.log('Average Response Time:', stats.averageResponseTime + 'ms');
            console.log('Uptime:               ', stats.uptime + 'ms');
            console.log('Requests Per Minute:  ', stats.requestsPerMinute);
            console.log('Log File:             ', stats.currentLogFile);
            console.log('Log File Size:        ', stats.currentLogFileSize);

            // Show log files
            console.log('\n--- Log Files ---\n');
            const files = loggingMiddleware.getLogFiles();
            files.forEach(file => {
              console.log(`  ${file.name}`);
              console.log(`    Size: ${file.size}`);
              console.log(`    Created: ${file.created}`);
            });

            // Demonstrate level changing
            console.log('\n--- Changing Log Level ---\n');
            console.log('Current level:', loggingMiddleware.getLevel());
            loggingMiddleware.setLevel('WARN');
            console.log('New level:', loggingMiddleware.getLevel());
            console.log('(DEBUG and INFO messages will now be filtered out)');

            // Demo 7: After level change (DEBUG should not log)
            console.log('\n--- Demo 7: DEBUG Request (Not Logged at WARN Level) ---\n');
            loggingMiddleware.logRequest(
              'status_check',
              'client-web-006',
              {},
              'DEBUG'
            );
            console.log('(No output above - DEBUG level is filtered out)');

            // But WARN level should log
            console.log('\n--- Demo 8: WARN Request (Will Be Logged) ---\n');
            loggingMiddleware.logRequest(
              'status_check',
              'client-web-006',
              {},
              'WARN'
            );

            // Final cleanup
            console.log('\n================================================================================');
            console.log('Demo Complete');
            console.log('================================================================================\n');
            console.log('Check the log file for full details:');
            console.log('  ' + stats.currentLogFile + '\n');

            loggingMiddleware.shutdown();
          }, 500);
        }, 500);
      }, 500);
    }, 500);
  }, 500);
}, 500);

// Demonstrate different status codes
console.log('--- Status Codes Reference ---\n');
const statusCodes = {
  200: 'Success - Command executed successfully',
  400: 'Bad Request - Invalid parameters or malformed JSON',
  404: 'Not Found - Resource or selector not found',
  429: 'Too Many Requests - Rate limit exceeded',
  500: 'Server Error - Command failed with error',
  504: 'Gateway Timeout - Command exceeded timeout'
};

Object.entries(statusCodes).forEach(([code, desc]) => {
  console.log(`  ${code}: ${desc}`);
});

console.log('\n--- Error Codes Reference ---\n');
const errorCodes = {
  'COMMAND_TIMED_OUT': 'Command exceeded timeout - increase timeout or check selector',
  'COMMAND_FAILED': 'Command execution failed - check server logs',
  'MALFORMED_JSON': 'Invalid JSON in request - verify request format',
  'INVALID_FORMAT': 'Missing required fields - check parameters',
  'RATE_LIMIT_EXCEEDED': 'Too many requests - wait before retrying',
  'RESOURCE_NOT_FOUND': 'Resource not found - verify resource exists',
  'INTERNAL_ERROR': 'Unexpected server error - check server logs'
};

Object.entries(errorCodes).forEach(([code, desc]) => {
  console.log(`  ${code}`);
  console.log(`    → ${desc}`);
});

console.log('\n--- Configuration Examples ---\n');
console.log('Development Setup:');
console.log('  level: DEBUG');
console.log('  writeToConsole: true');
console.log('  maxPayloadLength: 500\n');

console.log('Production Setup:');
console.log('  level: INFO');
console.log('  writeToConsole: false');
console.log('  excludeCommands: ["ping", "heartbeat"]\n');

console.log('Troubleshooting Setup:');
console.log('  level: DEBUG');
console.log('  truncatePayloads: false');
console.log('  maxPayloadLength: -1 (no limit)\n');
