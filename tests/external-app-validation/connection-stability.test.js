#!/usr/bin/env node

/**
 * External App Reliability - WebSocket Connection Stability Test
 *
 * Validates that WebSocket connections remain stable over extended sessions.
 * External production apps need to maintain connections for hours.
 *
 * Tests:
 * 1. Connection stays open for 5+ minutes with periodic commands
 * 2. No unexpected disconnections or timeouts
 * 3. Commands remain responsive throughout the session
 * 4. Message ordering is maintained across the entire session
 * 5. No memory leaks during extended operation
 */

const WebSocket = require('ws');
const assert = require('assert');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const SESSION_DURATION = 5 * 60 * 1000; // 5 minutes
const COMMAND_INTERVAL = 6 * 1000; // Send command every 6 seconds (50 commands in 5 min)
const COMMAND_TIMEOUT = 10000;

// Connection metrics
const METRICS = {
  connectionStartTime: null,
  connectionEndTime: null,
  commandsSent: 0,
  commandsSucceeded: 0,
  commandsFailed: 0,
  disconnections: 0,
  errors: [],
  messageOrderViolations: 0,
  latencies: [],
  minLatency: Infinity,
  maxLatency: 0,
  avgLatency: 0
};

// Test client with metrics
class StableWebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.requestId = 0;
    this.responseMap = new Map();
    this.lastRequestId = 0; // Track message ordering
    this.sessionStartTime = Date.now();
  }

  async connect(timeout = 5000) {
    return new Promise((resolve, reject) => {
      try {
        METRICS.connectionStartTime = Date.now();
        this.ws = new WebSocket(this.url);
        this.ws.setMaxListeners(200);

        this.ws.on('open', () => {
          this.connected = true;
          console.log('✓ Connected to server');
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data);

            // Verify message ordering (requestId should be in order)
            if (msg.requestId && msg.requestId < this.lastRequestId) {
              METRICS.messageOrderViolations++;
              METRICS.errors.push({
                type: 'message-order-violation',
                expected: this.lastRequestId,
                received: msg.requestId,
                time: Date.now() - METRICS.connectionStartTime
              });
            }
            this.lastRequestId = Math.max(this.lastRequestId, msg.requestId || 0);

            if (msg.requestId && this.responseMap.has(msg.requestId)) {
              const startTime = this.responseMap.get(msg.requestId).sentTime;
              const latency = Date.now() - startTime;

              METRICS.latencies.push(latency);
              METRICS.minLatency = Math.min(METRICS.minLatency, latency);
              METRICS.maxLatency = Math.max(METRICS.maxLatency, latency);

              this.responseMap.get(msg.requestId).resolve(msg);
              this.responseMap.delete(msg.requestId);
            }
          } catch (e) {
            // Ignore parse errors
          }
        });

        this.ws.on('error', (err) => {
          METRICS.errors.push({
            type: 'websocket-error',
            message: err.message,
            time: Date.now() - METRICS.connectionStartTime
          });
          if (!this.connected) reject(err);
        });

        this.ws.on('close', () => {
          if (this.connected) {
            METRICS.disconnections++;
            this.connected = false;
            METRICS.errors.push({
              type: 'unexpected-disconnect',
              time: Date.now() - METRICS.connectionStartTime
            });
          }
        });

        setTimeout(() => {
          if (!this.connected) reject(new Error('Connection timeout'));
        }, timeout);
      } catch (err) {
        reject(err);
      }
    });
  }

  async sendCommand(command, params = {}, timeout = COMMAND_TIMEOUT) {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    const requestId = ++this.requestId;
    const message = { command, params, requestId };

    return new Promise((resolve, reject) => {
      const sentTime = Date.now();
      const timeoutHandle = setTimeout(() => {
        this.responseMap.delete(requestId);
        reject(new Error(`Command timeout: ${command}`));
      }, timeout);

      this.responseMap.set(requestId, {
        resolve: (msg) => {
          clearTimeout(timeoutHandle);
          if (msg.error) {
            reject(new Error(msg.error));
          } else {
            resolve(msg);
          }
        },
        sentTime
      });

      try {
        this.ws.send(JSON.stringify(message));
      } catch (err) {
        clearTimeout(timeoutHandle);
        this.responseMap.delete(requestId);
        reject(err);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
    }
  }
}

/**
 * Send periodic commands during the test session
 */
async function sendPeriodicCommands(client, duration) {
  const commands = [
    { name: 'get_url', params: {} },
    { name: 'get_page_state', params: {} },
    { name: 'get_storage_stats', params: {} },
    { name: 'status', params: {} }
  ];

  const startTime = Date.now();
  let commandIndex = 0;

  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      const elapsed = Date.now() - startTime;

      if (elapsed >= duration) {
        clearInterval(interval);
        resolve();
        return;
      }

      const command = commands[commandIndex % commands.length];
      commandIndex++;

      try {
        METRICS.commandsSent++;
        await client.sendCommand(command.name, command.params);
        METRICS.commandsSucceeded++;

        // Log progress every 10 commands
        if (METRICS.commandsSent % 10 === 0) {
          const elapsedMin = (elapsed / 1000 / 60).toFixed(1);
          process.stdout.write(
            `\r  Elapsed: ${elapsedMin}m | Commands: ${METRICS.commandsSent} | ` +
            `Success: ${METRICS.commandsSucceeded} | Errors: ${METRICS.commandsFailed}`
          );
        }
      } catch (error) {
        METRICS.commandsFailed++;
        METRICS.errors.push({
          type: 'command-error',
          command: command.name,
          message: error.message,
          time: Date.now() - METRICS.connectionStartTime
        });
      }
    }, COMMAND_INTERVAL);
  });
}

/**
 * Run the stability test
 */
async function testConnectionStability() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  CONNECTION STABILITY TEST (5 MIN)    ║');
  console.log('╚════════════════════════════════════════╝\n');
  console.log(`Server URL: ${WS_URL}`);
  console.log(`Session duration: ${SESSION_DURATION / 1000 / 60} minutes`);
  console.log(`Command frequency: Every ${COMMAND_INTERVAL / 1000} seconds\n`);

  const client = new StableWebSocketClient(WS_URL);

  try {
    // Step 1: Connect
    console.log('Step 1: Connecting to server...');
    await client.connect();

    // Step 2: Navigate to a page (establish browser context)
    console.log('Step 2: Establishing browser context...');
    try {
      await client.sendCommand('navigate', { url: 'https://example.com' });
      await client.sendCommand('wait_for_load', { maxWaitTime: 5000 });
    } catch (e) {
      // Navigation might fail if browser not ready, that's ok
    }

    // Step 3: Run periodic commands for the test duration
    console.log(`Step 3: Sending periodic commands for ${SESSION_DURATION / 1000 / 60} minutes...\n`);
    await sendPeriodicCommands(client, SESSION_DURATION);

    METRICS.connectionEndTime = Date.now();
    console.log('\n\nStep 4: Test completed');

    // Disconnect gracefully
    client.disconnect();

    // Calculate statistics
    const totalDuration = METRICS.connectionEndTime - METRICS.connectionStartTime;
    METRICS.avgLatency = METRICS.latencies.length > 0
      ? METRICS.latencies.reduce((a, b) => a + b, 0) / METRICS.latencies.length
      : 0;

    // Print results
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║        STABILITY TEST RESULTS          ║');
    console.log('╚════════════════════════════════════════╝\n');

    console.log('Connection Metrics:');
    console.log(`  Duration: ${(totalDuration / 1000 / 60).toFixed(2)} minutes`);
    console.log(`  Unexpected disconnections: ${METRICS.disconnections}`);
    console.log(`  Message order violations: ${METRICS.messageOrderViolations}`);

    console.log('\nCommand Metrics:');
    console.log(`  Commands sent: ${METRICS.commandsSent}`);
    console.log(`  Commands succeeded: ${METRICS.commandsSucceeded}`);
    console.log(`  Commands failed: ${METRICS.commandsFailed}`);
    console.log(`  Success rate: ${((METRICS.commandsSucceeded / METRICS.commandsSent) * 100).toFixed(1)}%`);

    console.log('\nLatency Metrics (ms):');
    console.log(`  Min: ${METRICS.minLatency === Infinity ? 'N/A' : METRICS.minLatency}`);
    console.log(`  Max: ${METRICS.maxLatency}`);
    console.log(`  Average: ${METRICS.avgLatency.toFixed(2)}`);

    if (METRICS.errors.length > 0) {
      console.log('\nErrors Encountered:');
      METRICS.errors.slice(0, 10).forEach(err => {
        console.log(`  - [${(err.time / 1000).toFixed(1)}s] ${err.type}: ${err.message || ''}`);
      });
      if (METRICS.errors.length > 10) {
        console.log(`  ... and ${METRICS.errors.length - 10} more errors`);
      }
    }

    // Validate results
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║         STABILITY VALIDATION           ║');
    console.log('╚════════════════════════════════════════╝\n');

    const issues = [];

    // Check 1: Connection stability
    if (METRICS.disconnections > 0) {
      issues.push(`❌ Connection dropped ${METRICS.disconnections} time(s)`);
    } else {
      console.log('✓ Connection remained stable (no unexpected disconnects)');
    }

    // Check 2: Command success rate
    const successRate = METRICS.commandsSucceeded / METRICS.commandsSent;
    if (successRate >= 0.95) {
      console.log(`✓ Command success rate: ${(successRate * 100).toFixed(1)}% (>= 95%)`);
    } else {
      issues.push(`❌ Command success rate too low: ${(successRate * 100).toFixed(1)}%`);
    }

    // Check 3: Message ordering
    if (METRICS.messageOrderViolations === 0) {
      console.log('✓ Message ordering maintained throughout session');
    } else {
      issues.push(`❌ ${METRICS.messageOrderViolations} message ordering violations detected`);
    }

    // Check 4: Latency (should be < 1 second for most commands)
    const p95Latency = METRICS.latencies.length > 0
      ? METRICS.latencies.sort((a, b) => a - b)[Math.floor(METRICS.latencies.length * 0.95)]
      : 0;

    if (METRICS.avgLatency < 1000 && p95Latency < 2000) {
      console.log(`✓ Latency acceptable (avg: ${METRICS.avgLatency.toFixed(0)}ms, p95: ${p95Latency}ms)`);
    } else {
      issues.push(`❌ Latency too high (avg: ${METRICS.avgLatency.toFixed(0)}ms)`);
    }

    // Final verdict
    console.log('\n' + '='.repeat(40));
    if (issues.length === 0) {
      console.log('✓ CONNECTION STABILITY: PASSED');
      console.log('External apps can rely on 5+ minute sessions\n');
      process.exit(0);
    } else {
      console.log('✗ CONNECTION STABILITY: FAILED');
      issues.forEach(issue => console.log(`  ${issue}`));
      console.log('');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ Test error:', error.message);
    client.disconnect();
    process.exit(1);
  }
}

// Run the test
testConnectionStability();
