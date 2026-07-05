/**
 * Basset Hound Browser - Reliability Manager Usage Examples
 *
 * This file demonstrates how to:
 * - Use automatic retry logic
 * - Monitor command reliability via health endpoints
 * - Handle errors appropriately
 * - Configure monitoring systems
 * - Implement fallback strategies
 *
 * Version: 12.9.0
 */

const WebSocket = require('ws');
const http = require('http');

// ==========================================
// Example 1: Basic WebSocket Command with Automatic Retries
// ==========================================
async function example1_basicCommand() {
  console.log('\n=== Example 1: Basic Command (Automatic Retries) ===');

  const ws = new WebSocket('ws://localhost:8765');

  ws.on('open', async () => {
    // Send a command - server will automatically retry if it fails
    ws.send(JSON.stringify({
      id: 'req-1',
      command: 'navigateTo',
      url: 'https://example.com'
    }));
  });

  ws.on('message', (data) => {
    const response = JSON.parse(data);
    console.log('Response:', response);

    // Check if command was retried
    if (response.retried) {
      console.log(`Command was retried ${response.attempts} times`);
    }

    // Check if timeout occurred
    if (response.timedOut) {
      console.log('Command execution timeout after', response.latency, 'ms');
    }

    ws.close();
  });
}

// ==========================================
// Example 2: Check SLA Compliance via HTTP Health Endpoint
// ==========================================
async function example2_checkSLA() {
  console.log('\n=== Example 2: Check SLA Compliance ===');

  try {
    const response = await fetch('http://localhost:8765/health/reliability');
    const health = await response.json();

    console.log('Current SLA Status:');
    console.log('  Target:', health.sla.target);
    console.log('  Current:', health.sla.current);
    console.log('  Compliant:', health.sla.compliant);

    if (health.sla.warning) {
      console.warn('  Warning:', health.sla.warning);
    }

    // Check per-command reliability
    console.log('\nPer-Command Reliability:');
    for (const [cmd, metrics] of Object.entries(health.commands)) {
      console.log(`  ${cmd}:`, metrics.reliability);
    }
  } catch (error) {
    console.error('Failed to fetch health:', error.message);
  }
}

// ==========================================
// Example 3: Monitor Metrics via WebSocket
// ==========================================
async function example3_websocketHealth() {
  console.log('\n=== Example 3: WebSocket Health Command ===');

  const ws = new WebSocket('ws://localhost:8765');

  ws.on('open', () => {
    // Request full health status via WebSocket
    ws.send(JSON.stringify({
      id: 'health-1',
      command: 'getHealth'
    }));
  });

  ws.on('message', (data) => {
    const response = JSON.parse(data);

    if (response.command === 'getHealth' && response.success) {
      console.log('Health Status:', response.status);
      console.log('Version:', response.version);
      console.log('Uptime (ms):', response.liveness.uptime);
      console.log('SLA Compliant:', response.sla.compliant);

      // Show top commands by reliability
      console.log('\nTop Commands:');
      response.reliability.topCommands.forEach(cmd => {
        console.log(`  ${cmd.command}: ${cmd.reliability} (${cmd.attempts} calls)`);
      });
    }

    ws.close();
  });
}

// ==========================================
// Example 4: Kubernetes Probe Health Checks
// ==========================================
async function example4_kubernetesProbes() {
  console.log('\n=== Example 4: Kubernetes Probes ===');

  // Liveness probe - simple alive check
  try {
    const liveness = await fetch('http://localhost:8765/health/live');
    console.log('Liveness Probe:', liveness.status === 200 ? '✓ Alive' : '✗ Dead');
  } catch (error) {
    console.log('Liveness Probe: ✗ Connection failed');
  }

  // Readiness probe - ready to handle requests
  try {
    const readiness = await fetch('http://localhost:8765/health/ready');
    const status = readiness.status === 200 ? 'ready' : 'not ready';
    console.log('Readiness Probe:', status === 'ready' ? `✓ ${status}` : `✗ ${status}`);
  } catch (error) {
    console.log('Readiness Probe: ✗ Connection failed');
  }

  // Full health check
  try {
    const full = await fetch('http://localhost:8765/health');
    const health = await full.json();
    console.log('Full Health Check:');
    console.log('  Status:', health.status);
    console.log('  Response Code:', full.status, '(200=healthy, 503=degraded)');
  } catch (error) {
    console.log('Full Health Check: ✗ Connection failed');
  }
}

// ==========================================
// Example 5: Client-Side Error Handling with Retry Logic
// ==========================================
async function example5_clientSideErrorHandling() {
  console.log('\n=== Example 5: Client-Side Error Handling ===');

  class ReliableWebSocketClient {
    constructor(url) {
      this.url = url;
      this.ws = null;
      this.requestPending = new Map();
    }

    async connect() {
      return new Promise((resolve, reject) => {
        this.ws = new WebSocket(this.url);
        this.ws.on('open', resolve);
        this.ws.on('error', reject);
        this.ws.on('message', (data) => this._handleMessage(data));
      });
    }

    _handleMessage(data) {
      const response = JSON.parse(data);
      const pending = this.requestPending.get(response.id);

      if (pending) {
        this.requestPending.delete(response.id);
        pending.resolve(response);
      }
    }

    async send(command, params) {
      return new Promise((resolve, reject) => {
        const id = `req-${Date.now()}-${Math.random()}`;
        const timeout = setTimeout(() => {
          this.requestPending.delete(id);
          reject(new Error('Command timeout'));
        }, 40000); // Longer than server timeout

        this.requestPending.set(id, {
          resolve: (response) => {
            clearTimeout(timeout);
            resolve(response);
          }
        });

        this.ws.send(JSON.stringify({ id, command, ...params }));
      });
    }

    async executeWithFallback(command, params, fallback) {
      try {
        const response = await this.send(command, params);

        if (response.success) {
          console.log(`✓ ${command} succeeded`);
          return response;
        }

        // Command failed
        console.log(`✗ ${command} failed:`, response.error);
        console.log(`  Attempts: ${response.attempts}, Retried: ${response.retried}`);

        // Don't client-retry if server already retried
        if (response.retried) {
          if (fallback) {
            console.log(`  Using fallback strategy...`);
            return await fallback();
          }
          throw new Error(`${command} failed after server retries`);
        }

        throw new Error(`${command} failed: ${response.error}`);
      } catch (error) {
        console.error(`Error executing ${command}:`, error.message);
        throw error;
      }
    }
  }

  try {
    const client = new ReliableWebSocketClient('ws://localhost:8765');
    await client.connect();

    // Execute with fallback
    const result = await client.executeWithFallback(
      'navigateTo',
      { url: 'https://example.com' },
      async () => {
        // Fallback: try alternative URL
        return await client.send('navigateTo', { url: 'https://fallback.com' });
      }
    );

    client.ws.close();
  } catch (error) {
    console.error('Failed:', error.message);
  }
}

// ==========================================
// Example 6: Monitor Command Reliability Over Time
// ==========================================
async function example6_monitorReliability() {
  console.log('\n=== Example 6: Monitor Reliability Over Time ===');

  // Poll health endpoint every 10 seconds for 1 minute
  const intervals = [];
  let pollCount = 0;

  const poll = setInterval(async () => {
    pollCount++;

    try {
      const response = await fetch('http://localhost:8765/health/metrics');
      const metrics = await response.json();

      console.log(`\nPoll #${pollCount}:`);
      console.log(`  Total Requests: ${metrics.requestCount}`);
      console.log(`  Error Rate: ${((metrics.errorCount / metrics.requestCount) * 100).toFixed(2)}%`);
      console.log(`  Avg Latency: ${metrics.averageLatencyMs}ms`);

      if (metrics.topCommands) {
        const topCmd = Object.entries(metrics.topCommands)[0];
        if (topCmd) {
          console.log(`  Top Command: ${topCmd[0]} (${topCmd[1].count} calls)`);
        }
      }

      if (pollCount >= 6) {
        clearInterval(poll);
      }
    } catch (error) {
      console.error('Poll failed:', error.message);
    }
  }, 10000);
}

// ==========================================
// Example 7: Implementing Circuit Breaker with Health Checks
// ==========================================
class CircuitBreaker {
  constructor(client, threshold = 50, resetTimeout = 60000) {
    this.client = client;
    this.failureThreshold = threshold; // % failures to trip
    this.resetTimeout = resetTimeout;
    this.state = 'closed'; // closed, open, half-open
    this.failureCount = 0;
    this.successCount = 0;
    this.openTime = null;
  }

  async execute(command, params) {
    // Check health before executing
    if (this.state === 'open') {
      if (Date.now() - this.openTime > this.resetTimeout) {
        console.log('Circuit Breaker: Transitioning to half-open');
        this.state = 'half-open';
        this.failureCount = 0;
        this.successCount = 0;
      } else {
        throw new Error('Circuit Breaker is OPEN');
      }
    }

    try {
      const response = await this.client.send(command, params);

      if (response.success) {
        this.successCount++;

        if (this.state === 'half-open') {
          console.log('Circuit Breaker: Transitioning to closed');
          this.state = 'closed';
          this.failureCount = 0;
          this.successCount = 0;
        }

        return response;
      } else {
        this.failureCount++;
      }
    } catch (error) {
      this.failureCount++;
      throw error;
    }

    // Check failure rate
    const total = this.failureCount + this.successCount;
    const failureRate = (this.failureCount / total) * 100;

    if (failureRate > this.failureThreshold) {
      console.log(`Circuit Breaker: OPEN (failure rate: ${failureRate.toFixed(2)}%)`);
      this.state = 'open';
      this.openTime = Date.now();
      throw new Error('Circuit Breaker is OPEN due to high failure rate');
    }
  }
}

async function example7_circuitBreaker() {
  console.log('\n=== Example 7: Circuit Breaker Pattern ===');

  // This is a conceptual example showing how to use circuit breaker
  // with health checks from the browser

  const checkHealth = async () => {
    const response = await fetch('http://localhost:8765/health/reliability');
    const health = await response.json();
    return health.sla.compliant;
  };

  try {
    const isHealthy = await checkHealth();

    if (!isHealthy) {
      console.log('System health degraded - circuit breaker would open');
    } else {
      console.log('System health good - circuit breaker closed');
    }
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}

// ==========================================
// Example 8: Detailed Error Analysis
// ==========================================
async function example8_errorAnalysis() {
  console.log('\n=== Example 8: Error Analysis ===');

  try {
    const response = await fetch('http://localhost:8765/health/metrics');
    const metrics = await response.json();

    console.log('Error Analysis:');
    console.log(`  Total Requests: ${metrics.requestCount}`);
    console.log(`  Total Errors: ${metrics.errorCount}`);
    console.log(`  Error Rate: ${((metrics.errorCount / metrics.requestCount) * 100).toFixed(2)}%`);

    // Find most problematic commands
    const commands = metrics.topCommands || {};
    const problematic = Object.entries(commands)
      .filter(([_, stats]) => stats.errors > 0)
      .sort((a, b) => b[1].errors - a[1].errors);

    if (problematic.length > 0) {
      console.log('\nMost Problematic Commands:');
      problematic.slice(0, 5).forEach(([cmd, stats]) => {
        const errorRate = ((stats.errors / stats.count) * 100).toFixed(2);
        console.log(`  ${cmd}: ${stats.errors} errors / ${stats.count} calls (${errorRate}%)`);
      });
    }
  } catch (error) {
    console.error('Failed to fetch metrics:', error.message);
  }
}

// ==========================================
// Run Examples
// ==========================================
async function runExamples() {
  const examples = [
    { name: 'Example 1', fn: example1_basicCommand },
    { name: 'Example 2', fn: example2_checkSLA },
    { name: 'Example 3', fn: example3_websocketHealth },
    { name: 'Example 4', fn: example4_kubernetesProbes },
    { name: 'Example 5', fn: example5_clientSideErrorHandling },
    { name: 'Example 6', fn: example6_monitorReliability },
    { name: 'Example 7', fn: example7_circuitBreaker },
    { name: 'Example 8', fn: example8_errorAnalysis }
  ];

  console.log('Basset Hound Browser - Reliability Examples');
  console.log('===========================================');

  for (const example of examples) {
    try {
      await example.fn();
      // Wait between examples
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`${example.name} failed:`, error.message);
    }
  }

  console.log('\n=== All Examples Complete ===');
}

// Export for use
module.exports = {
  example1_basicCommand,
  example2_checkSLA,
  example3_websocketHealth,
  example4_kubernetesProbes,
  example5_clientSideErrorHandling,
  example6_monitorReliability,
  example7_circuitBreaker,
  example8_errorAnalysis,
  CircuitBreaker,
  runExamples
};

// Run if executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}
