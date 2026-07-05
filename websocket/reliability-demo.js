/**
 * Reliability Manager - Demo & Test
 *
 * This file demonstrates the reliability management system in action.
 * Shows how to use ReliabilityManager with simulated commands and
 * how to interpret health endpoint responses.
 *
 * Run with: node websocket/reliability-demo.js
 */

const { ReliabilityManager } = require('./reliability-manager');
const { HealthEndpointManager } = require('./health-endpoint');

/**
 * Simulated command handlers with controllable failure rates
 */
function createSimulatedCommands() {
  let navigationCount = 0;
  let clickCount = 0;
  let fillCount = 0;
  let screenshotCount = 0;

  return {
    // Navigation: 99.2% reliability (1 failure per 500)
    navigateTo: async (url) => {
      navigationCount++;

      // Simulate latency (80-500ms)
      const delay = 80 + Math.random() * 420;
      await new Promise(r => setTimeout(r, delay));

      // Fail 4 times per 500 (99.2% success)
      if (navigationCount % 500 === 50 || navigationCount % 500 === 150) {
        throw new Error('ECONNRESET'); // Transient error - will retry
      }
      if (navigationCount % 500 === 250 || navigationCount % 500 === 350) {
        throw new Error('ETIMEDOUT'); // Transient error - will retry
      }

      return { url, title: `Page: ${url}` };
    },

    // Click: 98.8% reliability (7 failures per 500)
    click: async (selector) => {
      clickCount++;

      // Simulate latency (10-80ms)
      const delay = 10 + Math.random() * 70;
      await new Promise(r => setTimeout(r, delay));

      // Fail 7 times per 500 (98.6% success)
      if ([50, 100, 200, 250, 300, 400, 450].includes(clickCount % 500)) {
        throw new Error('ECONNREFUSED'); // Transient error - will retry
      }

      return { selector, clicked: true };
    },

    // Fill: 99.3% reliability (3-4 failures per 500)
    fill: async (selector, text) => {
      fillCount++;

      // Simulate latency (10-50ms)
      const delay = 10 + Math.random() * 40;
      await new Promise(r => setTimeout(r, delay));

      // Fail 3 times per 500 (99.4% success)
      if ([100, 300, 450].includes(fillCount % 500)) {
        throw new Error('ETIMEDOUT'); // Transient error - will retry
      }

      return { selector, filled: true, text };
    },

    // Screenshot: 99.5% reliability (2 failures per 500)
    screenshot: async () => {
      screenshotCount++;

      // Simulate latency (500-2500ms)
      const delay = 500 + Math.random() * 2000;
      await new Promise(r => setTimeout(r, delay));

      // Fail 2 times per 500 (99.6% success)
      if ([150, 400].includes(screenshotCount % 500)) {
        throw new Error('TIMEOUT'); // Transient error - will retry
      }

      return { data: Buffer.alloc(1024 * 100), size: 102400 }; // 100KB screenshot
    }
  };
}

/**
 * Main demo
 */
async function runDemo() {
  console.log('='.repeat(80));
  console.log('Basset Hound Browser - Reliability Manager Demo');
  console.log('='.repeat(80));
  console.log('');

  // Create reliability manager
  const reliabilityManager = new ReliabilityManager({
    maxRetries: 3,
    commandTimeout: 30000,
    logger: {
      debug: (msg) => { }, // Suppress debug logs
      info: (msg) => console.log(`[INFO] ${msg}`),
      error: (msg) => console.error(`[ERROR] ${msg}`)
    }
  });

  // Create health endpoint and link reliability manager
  const healthEndpoint = new HealthEndpointManager({
    reliabilityManager,
    version: '12.9.0'
  });

  // Create simulated commands
  const commands = createSimulatedCommands();

  console.log('Running 500 command executions with simulated failures...\n');

  // Execute commands in a mix
  const requests = [];
  for (let i = 0; i < 500; i++) {
    const commandType = i % 4;

    const promise = (async () => {
      switch (commandType) {
        case 0:
          return reliabilityManager.execute('navigateTo',
            () => commands.navigateTo('https://example.com'));
        case 1:
          return reliabilityManager.execute('click',
            () => commands.click('.button'));
        case 2:
          return reliabilityManager.execute('fill',
            () => commands.fill('input.search', 'test'));
        case 3:
          return reliabilityManager.execute('screenshot',
            () => commands.screenshot());
      }
    })();

    requests.push(promise);
  }

  // Wait for all requests
  await Promise.all(requests);

  console.log('\n' + '='.repeat(80));
  console.log('RESULTS');
  console.log('='.repeat(80) + '\n');

  // Display global stats
  const globalStats = reliabilityManager.getGlobalStats();
  console.log('GLOBAL STATISTICS:');
  console.log(`  Total Requests: ${globalStats.totalRequests}`);
  console.log(`  Successful: ${globalStats.successfulRequests}`);
  console.log(`  Failed: ${globalStats.failedRequests}`);
  console.log(`  Success Rate: ${globalStats.successRate}`);
  console.log(`  Transient Retries: ${globalStats.transientRetries}`);
  console.log(`  Timeout Failures: ${globalStats.timeoutFailures}`);
  console.log(`  Unique Commands: ${globalStats.commandCount}`);
  console.log('');

  // Display per-command metrics
  console.log('PER-COMMAND RELIABILITY:');
  console.log('');
  const coreCommands = ['navigateTo', 'click', 'fill', 'screenshot'];
  for (const cmd of coreCommands) {
    const metrics = reliabilityManager.getCommandMetrics(cmd);

    console.log(`${cmd.toUpperCase()}`);
    console.log(`  Reliability: ${metrics.reliability}`);
    console.log(`  Success: ${metrics.successCount} / ${metrics.totalAttempts}`);
    console.log(`  Failures: ${metrics.failureCount}`);
    console.log(`  Retries: ${metrics.retries}`);
    console.log(`  Avg Latency: ${metrics.avgLatency}`);
    console.log(`  P50 Latency: ${metrics.p50Latency}`);
    console.log(`  P95 Latency: ${metrics.p95Latency}`);
    console.log(`  P99 Latency: ${metrics.p99Latency}`);
    console.log(`  Timeout Failures: ${metrics.timeouts}`);
    console.log('');
  }

  // Display health endpoint response
  console.log('='.repeat(80));
  console.log('HEALTH ENDPOINT RESPONSE');
  console.log('='.repeat(80) + '\n');

  const health = await healthEndpoint.getReliabilityStatus();
  console.log(JSON.stringify(health, null, 2));

  // Top commands
  console.log('\n' + '='.repeat(80));
  console.log('TOP COMMANDS BY REQUEST COUNT');
  console.log('='.repeat(80) + '\n');

  const topCommands = reliabilityManager.getTopCommands(5);
  for (const cmd of topCommands) {
    console.log(`${cmd.command.padEnd(20)} | ${cmd.reliability.padEnd(8)} | ${cmd.avgLatency.padEnd(8)} | ${cmd.attempts} attempts`);
  }

  // Show recent requests sample
  console.log('\n' + '='.repeat(80));
  console.log('RECENT REQUESTS (Last 10)');
  console.log('='.repeat(80) + '\n');

  const recent = reliabilityManager.getRecentRequests(10);
  console.log('Command'.padEnd(20) + ' | Latency | Success | Attempts | Timestamp');
  console.log('-'.repeat(80));
  for (const req of recent) {
    const success = req.success ? 'YES' : 'NO';
    console.log(
      req.command.padEnd(20) + ' | ' +
      String(req.latency).padEnd(7) + ' | ' +
      success.padEnd(7) + ' | ' +
      String(req.attempts).padEnd(8) + ' | ' +
      req.timestamp
    );
  }

  // SLA Compliance check
  console.log('\n' + '='.repeat(80));
  console.log('SLA COMPLIANCE CHECK');
  console.log('='.repeat(80) + '\n');

  const healthStatus = reliabilityManager.getHealthStatus();
  console.log(`Status: ${healthStatus.healthy ? 'HEALTHY' : 'DEGRADED'}`);
  console.log(`SLA Target: ${healthStatus.threshold}`);
  console.log(`Current Reliability: ${healthStatus.metrics.successRate}`);
  console.log(`Compliant: ${healthStatus.metrics.successRate >= '99.00%' ? 'YES' : 'NO'}`);
  if (healthStatus.warning) {
    console.log(`Warning: ${healthStatus.warning}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('Demo completed successfully!');
  console.log('='.repeat(80) + '\n');
}

// Run demo if executed directly
if (require.main === module) {
  runDemo().catch(err => {
    console.error('Demo failed:', err);
    process.exit(1);
  });
}

module.exports = {
  createSimulatedCommands
};
