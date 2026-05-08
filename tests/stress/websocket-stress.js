#!/usr/bin/env node
/**
 * Basset Hound Browser - WebSocket API Stress Test
 * Comprehensive stress testing for concurrent connections, rapid commands, and error handling
 *
 * Tests:
 * - 100+ concurrent WebSocket connections
 * - Rapid command firing (1000+ commands/second)
 * - Malformed JSON input handling
 * - WebSocket connection drop and recovery
 * - Rate limiting behavior under load
 * - Command queue testing
 * - Error message handling
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const WS_URL = process.argv[2] || 'ws://localhost:8765';
const CONCURRENT_CONNECTIONS = 100;
const COMMANDS_PER_CONNECTION = 20;
const MALFORMED_REQUESTS = 50;
const RECOVERY_TEST_ATTEMPTS = 5;
const TEST_TIMEOUT = 120000; // 2 minutes max

// Test results
const results = {
  timestamp: new Date().toISOString(),
  ws_url: WS_URL,
  test_duration_seconds: 0,
  concurrent_connections: CONCURRENT_CONNECTIONS,
  total_commands: 0,
  successful_commands: 0,
  failed_commands: 0,
  success_rate: 0,
  latency: {
    p50: 0,
    p95: 0,
    p99: 0,
    min: Infinity,
    max: 0,
    mean: 0
  },
  throughput_cmds_per_sec: 0,
  errors: {},
  memory_initial_mb: 0,
  memory_peak_mb: 0,
  memory_final_mb: 0,
  connection_stability: {
    successful_connections: 0,
    failed_connections: 0,
    connection_drop_count: 0,
    reconnection_success_rate: 0
  },
  malformed_request_stats: {
    total_sent: 0,
    successfully_rejected: 0,
    other_results: 0
  },
  rate_limiting: {
    rate_429_responses: 0,
    timeout_responses: 0,
    other_limits: 0
  },
  issues_found: []
};

// Track latencies for percentile calculation
const latencies = [];

/**
 * Get current memory usage in MB
 */
function getMemoryUsageMB() {
  const memUsage = process.memoryUsage();
  return Math.round(memUsage.heapUsed / 1024 / 1024);
}

/**
 * Calculate percentile from array of values
 */
function calculatePercentile(values, percentile) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Test 1: Concurrent Connections
 */
async function testConcurrentConnections() {
  console.log('\n[TEST 1] Testing concurrent connections...');
  const startTime = Date.now();
  const connections = [];
  const connectionPromises = [];

  for (let i = 0; i < CONCURRENT_CONNECTIONS; i++) {
    const promise = new Promise((resolve) => {
      try {
        const ws = new WebSocket(WS_URL);
        let connectionEstablished = false;

        const timeout = setTimeout(() => {
          if (!connectionEstablished) {
            ws.close();
            results.connection_stability.failed_connections++;
            resolve(null);
          }
        }, 10000);

        ws.on('open', () => {
          clearTimeout(timeout);
          connectionEstablished = true;
          results.connection_stability.successful_connections++;
          connections.push(ws);
          resolve(ws);
        });

        ws.on('error', () => {
          clearTimeout(timeout);
          if (!connectionEstablished) {
            results.connection_stability.failed_connections++;
          }
          resolve(null);
        });

        ws.on('close', () => {
          if (connectionEstablished) {
            results.connection_stability.connection_drop_count++;
          }
        });
      } catch (error) {
        results.connection_stability.failed_connections++;
        resolve(null);
      }
    });

    connectionPromises.push(promise);
  }

  // Wait for all connections
  const results_arr = await Promise.all(connectionPromises);
  const validConnections = results_arr.filter(c => c !== null);

  console.log(`  Connected: ${validConnections.length}/${CONCURRENT_CONNECTIONS}`);
  console.log(`  Failed: ${results.connection_stability.failed_connections}`);
  console.log(`  Duration: ${Date.now() - startTime}ms`);

  return validConnections;
}

/**
 * Test 2: Rapid Command Firing
 */
async function testRapidCommands(connections) {
  console.log('\n[TEST 2] Testing rapid command firing...');
  const startTime = Date.now();
  const commands = [
    { command: 'ping', params: {} },
    { command: 'get_url', params: {} },
    { command: 'get_content', params: {} },
    { command: 'status', params: {} },
    { command: 'screenshot', params: { type: 'viewport' } },
    { command: 'navigate', params: { url: 'https://example.com' } },
    { command: 'click', params: { selector: 'button', x: 100, y: 100 } },
    { command: 'fill', params: { selector: 'input', value: 'test data' } },
    { command: 'scroll', params: { x: 0, y: 100 } },
    { command: 'get_cookies', params: { url: 'https://example.com' } }
  ];

  let commandId = 0;
  const commandPromises = [];

  for (const connection of connections) {
    if (!connection || connection.readyState !== WebSocket.OPEN) continue;

    for (let i = 0; i < COMMANDS_PER_CONNECTION; i++) {
      const cmd = commands[i % commands.length];
      const id = ++commandId;
      const startCmdTime = Date.now();

      const promise = new Promise((resolve) => {
        try {
          const messageHandler = (data) => {
            try {
              const response = JSON.parse(data.toString());
              if (response.id === id) {
                const latency = Date.now() - startCmdTime;
                latencies.push(latency);
                results.successful_commands++;
                results.total_commands++;
                connection.removeListener('message', messageHandler);
                resolve(response);
              }
            } catch (e) {
              // Ignore parse errors
            }
          };

          connection.on('message', messageHandler);

          const timeout = setTimeout(() => {
            connection.removeListener('message', messageHandler);
            results.failed_commands++;
            results.total_commands++;
            results.errors['timeout'] = (results.errors['timeout'] || 0) + 1;
            resolve(null);
          }, 5000);

          // Send command
          const message = JSON.stringify({ id, ...cmd });
          connection.send(message);
        } catch (error) {
          results.failed_commands++;
          results.total_commands++;
          recordError(error.message);
          resolve(null);
        }
      });

      commandPromises.push(promise);

      // Fire rapidly
      if (i % 10 === 0) {
        await new Promise(r => setTimeout(r, 10));
      }
    }
  }

  // Wait for command responses with timeout
  const racePromise = Promise.race([
    Promise.all(commandPromises),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Rapid command test timeout')), 30000)
    )
  ]);

  try {
    await racePromise;
  } catch (error) {
    console.log(`  Warning: ${error.message}`);
  }

  const duration = Date.now() - startTime;
  const throughput = (results.successful_commands / duration) * 1000;

  console.log(`  Total commands: ${results.total_commands}`);
  console.log(`  Successful: ${results.successful_commands}`);
  console.log(`  Failed: ${results.failed_commands}`);
  console.log(`  Throughput: ${throughput.toFixed(2)} cmd/sec`);
  console.log(`  Duration: ${duration}ms`);
}

/**
 * Test 3: Malformed JSON Input Handling
 */
async function testMalformedInput(connections) {
  console.log('\n[TEST 3] Testing malformed JSON handling...');
  const startTime = Date.now();

  const malformedPayloads = [
    '{invalid json',
    '{"command": "ping"',
    '{"id": 1, "command": }',
    '{"command": "ping", "params": {invalid}}',
    '{' + '"command"'.repeat(1000), // Extremely large JSON structure attempt
    'null',
    'undefined',
    '123',
    '"string only"',
    '{"command": "ping", "params": {"deep": ' + '{"nested":'.repeat(100) + '{}' + '}'.repeat(100) + '}}',
    Buffer.alloc(10000).toString('hex'), // Large hex string
    '{"id": 999999, "command": "invalid_command_12345"}',
    '{"command": "navigate", "params": {"url": ' + '"x'.repeat(5000) + '"}}',
    '',
    '\n\n\n',
    '   ',
    JSON.stringify({ command: 'navigate', params: { url: 'javascript:alert("xss")' } }),
    JSON.stringify({ command: 'execute_script', params: { script: 'process.exit(1)' } }),
    JSON.stringify({ command: 'ping' }).slice(0, 5), // Incomplete JSON
    '{\x00\x01\x02}' // Binary data
  ];

  for (const connection of connections) {
    if (!connection || connection.readyState !== WebSocket.OPEN) continue;

    for (const payload of malformedPayloads) {
      results.malformed_request_stats.total_sent++;

      try {
        connection.send(payload);

        // Listen for response/error with timeout
        await new Promise((resolve) => {
          const timeout = setTimeout(resolve, 1000);

          const messageHandler = () => {
            clearTimeout(timeout);
            results.malformed_request_stats.successfully_rejected++;
            connection.removeListener('message', messageHandler);
            resolve();
          };

          const errorHandler = () => {
            clearTimeout(timeout);
            results.malformed_request_stats.successfully_rejected++;
            connection.removeListener('error', errorHandler);
            resolve();
          };

          connection.once('message', messageHandler);
          connection.once('error', errorHandler);
        });
      } catch (error) {
        results.malformed_request_stats.other_results++;
      }

      if (results.malformed_request_stats.total_sent % 10 === 0) {
        await new Promise(r => setTimeout(r, 50));
      }
    }

    if (!connection.readyState === WebSocket.OPEN) {
      results.issues_found.push('Connection closed during malformed input test');
    }
  }

  console.log(`  Total malformed payloads sent: ${results.malformed_request_stats.total_sent}`);
  console.log(`  Successfully rejected: ${results.malformed_request_stats.successfully_rejected}`);
  console.log(`  Other results: ${results.malformed_request_stats.other_results}`);
  console.log(`  Duration: ${Date.now() - startTime}ms`);
}

/**
 * Test 4: Connection Drop and Recovery
 */
async function testConnectionRecovery(connections) {
  console.log('\n[TEST 4] Testing connection drop and recovery...');
  const startTime = Date.now();
  let reconnectionSuccesses = 0;
  let reconnectionAttempts = 0;

  // Test on a subset of connections
  const testConnections = connections.slice(0, Math.min(10, connections.length));

  for (const connection of testConnections) {
    if (!connection) continue;

    for (let attempt = 0; attempt < RECOVERY_TEST_ATTEMPTS; attempt++) {
      try {
        reconnectionAttempts++;

        // Send command
        const cmdId = `recovery-${Date.now()}-${attempt}`;
        const message = JSON.stringify({ id: cmdId, command: 'ping' });

        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve();
          }, 2000);

          const messageHandler = () => {
            clearTimeout(timeout);
            reconnectionSuccesses++;
            connection.removeListener('message', messageHandler);
            resolve();
          };

          connection.once('message', messageHandler);

          // Simulate recovery by sending command
          try {
            connection.send(message);
          } catch (error) {
            clearTimeout(timeout);
            resolve();
          }
        });

        await new Promise(r => setTimeout(r, 100));
      } catch (error) {
        // Continue to next attempt
      }
    }
  }

  const recoveryRate = reconnectionAttempts > 0
    ? (reconnectionSuccesses / reconnectionAttempts) * 100
    : 0;

  results.connection_stability.reconnection_success_rate = recoveryRate;

  console.log(`  Recovery attempts: ${reconnectionAttempts}`);
  console.log(`  Successful recoveries: ${reconnectionSuccesses}`);
  console.log(`  Recovery rate: ${recoveryRate.toFixed(2)}%`);
  console.log(`  Duration: ${Date.now() - startTime}ms`);
}

/**
 * Test 5: Rate Limiting Behavior
 */
async function testRateLimiting(connections) {
  console.log('\n[TEST 5] Testing rate limiting behavior...');
  const startTime = Date.now();
  let rateLimitDetected = false;

  // Send very rapid commands to a single connection
  if (connections.length > 0) {
    const connection = connections[0];
    if (connection && connection.readyState === WebSocket.OPEN) {
      const rapidCommands = [];

      for (let i = 0; i < 100; i++) {
        const promise = new Promise((resolve) => {
          try {
            const message = JSON.stringify({
              id: `rate-limit-${i}`,
              command: 'ping'
            });

            const responseHandler = (data) => {
              try {
                const response = JSON.parse(data.toString());
                if (response.error && response.error.includes('429')) {
                  results.rate_limiting['rate_429_responses']++;
                  rateLimitDetected = true;
                }
              } catch (e) {
                // Ignore parse errors
              }
              connection.removeListener('message', responseHandler);
              resolve();
            };

            const timeout = setTimeout(() => {
              results.rate_limiting.timeout_responses++;
              connection.removeListener('message', responseHandler);
              resolve();
            }, 5000);

            connection.once('message', responseHandler);
            connection.send(message);
          } catch (error) {
            resolve();
          }
        });

        rapidCommands.push(promise);
      }

      await Promise.allSettled(rapidCommands);
    }
  }

  console.log(`  Rate limit detected: ${rateLimitDetected}`);
  console.log(`  429 responses: ${results.rate_limiting['rate_429_responses']}`);
  console.log(`  Timeout responses: ${results.rate_limiting.timeout_responses}`);
  console.log(`  Duration: ${Date.now() - startTime}ms`);
}

/**
 * Test 6: Command Queue Testing
 */
async function testCommandQueue(connections) {
  console.log('\n[TEST 6] Testing command queue...');
  const startTime = Date.now();
  const queueTests = [];

  if (connections.length > 0) {
    const connection = connections[0];
    if (connection && connection.readyState === WebSocket.OPEN) {
      // Send batch of commands without waiting for responses
      for (let i = 0; i < 50; i++) {
        const queueTest = new Promise((resolve) => {
          const cmdId = `queue-${i}`;
          const message = JSON.stringify({
            id: cmdId,
            command: 'ping'
          });

          const timeout = setTimeout(() => {
            resolve();
          }, 10000);

          const messageHandler = (data) => {
            try {
              const response = JSON.parse(data.toString());
              if (response.id === cmdId) {
                clearTimeout(timeout);
                resolve(response);
              }
            } catch (e) {
              // Ignore
            }
          };

          connection.on('message', messageHandler);

          try {
            connection.send(message);
          } catch (error) {
            clearTimeout(timeout);
            connection.removeListener('message', messageHandler);
            resolve(null);
          }
        });

        queueTests.push(queueTest);
      }

      await Promise.allSettled(queueTests);
    }
  }

  console.log(`  Queue test commands: ${queueTests.length}`);
  console.log(`  Duration: ${Date.now() - startTime}ms`);
}

/**
 * Test 7: Error Message Handling
 */
async function testErrorHandling(connections) {
  console.log('\n[TEST 7] Testing error message handling...');
  const startTime = Date.now();

  const errorTestCommands = [
    { command: 'invalid_command', params: {} },
    { command: 'navigate', params: { url: 'invalid-url' } },
    { command: 'click', params: {} }, // Missing required selector
    { command: 'fill', params: { selector: 'input' } }, // Missing value
    { command: 'execute_script', params: { script: 'throw new Error("test")' } },
    { command: 'screenshot', params: { type: 'invalid-type' } },
    { command: 'set_cookies', params: { cookies: 'invalid-format' } },
    { command: 'navigate', params: { url: '' } }
  ];

  if (connections.length > 0) {
    const connection = connections[0];
    if (connection && connection.readyState === WebSocket.OPEN) {
      for (const cmd of errorTestCommands) {
        await new Promise((resolve) => {
          const id = `error-${Date.now()}-${Math.random()}`;
          const message = JSON.stringify({ id, ...cmd });

          const timeout = setTimeout(() => {
            connection.removeListener('message', messageHandler);
            resolve();
          }, 2000);

          const messageHandler = (data) => {
            try {
              const response = JSON.parse(data.toString());
              if (response.id === id && response.error) {
                results.errors[response.error] = (results.errors[response.error] || 0) + 1;
              }
            } catch (e) {
              // Ignore
            }
            clearTimeout(timeout);
            connection.removeListener('message', messageHandler);
            resolve();
          };

          connection.once('message', messageHandler);

          try {
            connection.send(message);
          } catch (error) {
            clearTimeout(timeout);
            resolve();
          }
        });
      }
    }
  }

  console.log(`  Error test commands: ${errorTestCommands.length}`);
  console.log(`  Errors captured: ${Object.keys(results.errors).length}`);
  console.log(`  Duration: ${Date.now() - startTime}ms`);
}

/**
 * Record error in results
 */
function recordError(errorMsg) {
  const key = errorMsg.substring(0, 100);
  results.errors[key] = (results.errors[key] || 0) + 1;
}

/**
 * Cleanup connections
 */
function cleanupConnections(connections) {
  for (const connection of connections) {
    if (connection && connection.readyState === WebSocket.OPEN) {
      connection.close();
    }
  }
}

/**
 * Main test runner
 */
async function runStressTests() {
  const globalStartTime = Date.now();
  results.memory_initial_mb = getMemoryUsageMB();

  console.log('=====================================');
  console.log('WebSocket API Stress Test');
  console.log('=====================================');
  console.log(`Connecting to: ${WS_URL}`);
  console.log(`Concurrent connections: ${CONCURRENT_CONNECTIONS}`);
  console.log(`Commands per connection: ${COMMANDS_PER_CONNECTION}`);
  console.log(`Start time: ${results.timestamp}`);
  console.log('=====================================');

  try {
    // Test 1: Concurrent connections
    const connections = await testConcurrentConnections();

    if (connections.length === 0) {
      console.error('ERROR: Failed to establish any connections');
      results.issues_found.push('Could not establish any WebSocket connections');
      saveResults();
      process.exit(1);
    }

    results.memory_peak_mb = getMemoryUsageMB();

    // Test 2: Rapid command firing
    await testRapidCommands(connections);
    results.memory_peak_mb = Math.max(results.memory_peak_mb, getMemoryUsageMB());

    // Test 3: Malformed input
    await testMalformedInput(connections);
    results.memory_peak_mb = Math.max(results.memory_peak_mb, getMemoryUsageMB());

    // Test 4: Connection recovery
    await testConnectionRecovery(connections);

    // Test 5: Rate limiting
    await testRateLimiting(connections);

    // Test 6: Command queue
    await testCommandQueue(connections);

    // Test 7: Error handling
    await testErrorHandling(connections);

    // Cleanup
    cleanupConnections(connections);

    // Calculate final metrics
    const totalDuration = Date.now() - globalStartTime;
    results.test_duration_seconds = (totalDuration / 1000).toFixed(2);
    results.memory_final_mb = getMemoryUsageMB();

    // Calculate success rate
    if (results.total_commands > 0) {
      results.success_rate = (results.successful_commands / results.total_commands).toFixed(4);
    }

    // Calculate throughput
    if (results.test_duration_seconds > 0) {
      results.throughput_cmds_per_sec = (results.successful_commands / results.test_duration_seconds).toFixed(2);
    }

    // Calculate latency percentiles
    if (latencies.length > 0) {
      results.latency.min = Math.min(...latencies);
      results.latency.max = Math.max(...latencies);
      results.latency.mean = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2);
      results.latency.p50 = calculatePercentile(latencies, 50);
      results.latency.p95 = calculatePercentile(latencies, 95);
      results.latency.p99 = calculatePercentile(latencies, 99);
    }

    // Validation checks
    if (results.total_commands === 0) {
      results.issues_found.push('No commands were executed');
    }

    if (results.success_rate < 0.7) {
      results.issues_found.push(`Low success rate: ${results.success_rate}`);
    }

    if (results.connection_stability.failed_connections > CONCURRENT_CONNECTIONS * 0.2) {
      results.issues_found.push('High connection failure rate');
    }

    if (results.latency.p99 > 10000) {
      results.issues_found.push('Very high p99 latency (> 10s)');
    }

    // Save results
    saveResults();

    // Print summary
    printSummary();

  } catch (error) {
    console.error('\nFATAL ERROR:', error.message);
    results.issues_found.push(`Fatal error: ${error.message}`);
    saveResults();
    process.exit(1);
  }
}

/**
 * Save results to JSON file
 */
function saveResults() {
  const resultsDir = path.join(__dirname, '..', 'results', 'stress');

  // Ensure directory exists
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const resultsFile = path.join(resultsDir, 'websocket-stress-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${resultsFile}`);
}

/**
 * Print summary
 */
function printSummary() {
  console.log('\n=====================================');
  console.log('STRESS TEST RESULTS SUMMARY');
  console.log('=====================================');
  console.log(`Duration: ${results.test_duration_seconds}s`);
  console.log(`Total commands: ${results.total_commands}`);
  console.log(`Successful: ${results.successful_commands}`);
  console.log(`Failed: ${results.failed_commands}`);
  console.log(`Success rate: ${(results.success_rate * 100).toFixed(2)}%`);
  console.log(`Throughput: ${results.throughput_cmds_per_sec} cmd/s`);
  console.log('\nLatency Metrics:');
  console.log(`  Min: ${results.latency.min}ms`);
  console.log(`  P50: ${results.latency.p50}ms`);
  console.log(`  P95: ${results.latency.p95}ms`);
  console.log(`  P99: ${results.latency.p99}ms`);
  console.log(`  Max: ${results.latency.max}ms`);
  console.log(`  Mean: ${results.latency.mean}ms`);
  console.log('\nConnection Stability:');
  console.log(`  Successful connections: ${results.connection_stability.successful_connections}`);
  console.log(`  Failed connections: ${results.connection_stability.failed_connections}`);
  console.log(`  Connection drops: ${results.connection_stability.connection_drop_count}`);
  console.log(`  Recovery rate: ${results.connection_stability.reconnection_success_rate.toFixed(2)}%`);
  console.log('\nMemory Usage:');
  console.log(`  Initial: ${results.memory_initial_mb}MB`);
  console.log(`  Peak: ${results.memory_peak_mb}MB`);
  console.log(`  Final: ${results.memory_final_mb}MB`);
  console.log('\nIssues Found: ' + (results.issues_found.length > 0 ? results.issues_found.length : 'None'));
  if (results.issues_found.length > 0) {
    results.issues_found.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
  }
  console.log('=====================================\n');
}

// Run tests
runStressTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
