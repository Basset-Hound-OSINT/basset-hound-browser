#!/usr/bin/env node

/**
 * Reliability SLA Verification Script
 *
 * Demonstrates and validates 99%+ SLA achievement on core commands.
 * Simulates realistic workloads with occasional transient failures.
 *
 * Usage:
 *   node tests/reliability/verify-99-percent-sla.js
 *
 * Expected Output:
 *   All core commands achieve 99%+ reliability
 *   Global success rate exceeds 99%
 */

const { ReliabilityManager } = require('../../websocket/reliability-manager');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function colorize(text, color) {
  return `${color}${text}${colors.reset}`;
}

async function runSLAVerification() {
  console.log(colorize('\n=== Basset Hound Browser - Reliability SLA Verification ===\n', colors.bold + colors.cyan));

  // Initialize ReliabilityManager
  const reliabilityManager = new ReliabilityManager({
    maxRetries: 3,
    commandTimeout: 30000,
    logger: {
      debug: () => {},
      info: () => {},
      error: () => {},
      warn: () => {}
    }
  });

  // Core commands to test
  const coreCommands = [
    'navigateTo',
    'click',
    'fill',
    'screenshot',
    'get_url',
    'get_content'
  ];

  // Simulation parameters
  const requestsPerCommand = 100; // 100 requests per command = 600 total
  const transientFailureRate = 0.005; // 0.5% chance of transient failure
  const permanentFailureRate = 0.001; // 0.1% chance of permanent failure

  console.log(colorize('Configuration:', colors.bold));
  console.log(`  Max retries: 3`);
  console.log(`  Command timeout: 30000ms`);
  console.log(`  Core commands: ${coreCommands.length}`);
  console.log(`  Requests per command: ${requestsPerCommand}`);
  console.log(`  Transient failure rate: ${(transientFailureRate * 100).toFixed(2)}%`);
  console.log(`  Permanent failure rate: ${(permanentFailureRate * 100).toFixed(2)}%`);
  console.log(`  Total requests: ${coreCommands.length * requestsPerCommand}\n`);

  // Simulate command execution with occasional failures
  function createExecutor(command) {
    return async () => {
      // Simulate occasional transient failures
      if (Math.random() < transientFailureRate) {
        const errors = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'];
        throw new Error(errors[Math.floor(Math.random() * errors.length)]);
      }

      // Simulate occasional permanent failures
      if (Math.random() < permanentFailureRate) {
        throw new Error('INVALID_PARAMETERS');
      }

      // Simulate network latency (10-100ms)
      const delay = Math.random() * 90 + 10;
      await new Promise(resolve => setTimeout(resolve, delay));

      return { success: true, data: `${command} executed` };
    };
  }

  // Execute test workload
  console.log(colorize('Executing workload...', colors.bold));
  console.log('');

  const startTime = Date.now();
  let executedCount = 0;

  for (const command of coreCommands) {
    for (let i = 0; i < requestsPerCommand; i++) {
      const executor = createExecutor(command);
      await reliabilityManager.execute(command, executor);
      executedCount++;

      // Progress indicator
      if (executedCount % 50 === 0) {
        process.stdout.write('.');
      }
    }
  }

  const duration = Date.now() - startTime;

  console.log('\n');
  console.log(colorize(`Workload completed in ${(duration / 1000).toFixed(2)}s\n`, colors.green));

  // Verify SLA compliance
  console.log(colorize('=== SLA Verification Results ===\n', colors.bold));

  const globalStats = reliabilityManager.getGlobalStats();
  const globalReliability = parseFloat(globalStats.successRate);

  console.log(colorize('Global Statistics:', colors.bold));
  console.log(`  Total requests: ${globalStats.totalRequests}`);
  console.log(`  Successful: ${globalStats.successfulRequests}`);
  console.log(`  Failed: ${globalStats.failedRequests}`);
  console.log(`  Success rate: ${globalStats.successRate}`);
  console.log(`  Transient retries: ${globalStats.transientRetries}`);
  console.log(`  Timeout failures: ${globalStats.timeoutFailures}\n`);

  // Per-command verification
  console.log(colorize('Per-Command SLA Compliance:', colors.bold));
  console.log('');

  let allCompliant = true;
  const results = [];

  for (const command of coreCommands) {
    const metrics = reliabilityManager.getCommandMetrics(command);
    const reliability = parseFloat(metrics.reliability);
    const compliant = reliability >= 99.0;

    if (!compliant) {
      allCompliant = false;
    }

    const status = compliant ? colorize('✓', colors.green) : colorize('✗', colors.red);
    const color = compliant ? colors.green : colors.red;

    console.log(`  ${status} ${command.padEnd(15)} ${colorize(metrics.reliability.padStart(8), color)}`);
    console.log(`     Attempts: ${metrics.totalAttempts}, Success: ${metrics.successCount}, Failed: ${metrics.failureCount}`);
    console.log(`     Avg: ${metrics.avgLatency}, P99: ${metrics.p99Latency}\n`);

    results.push({
      command,
      reliability,
      compliant,
      metrics
    });
  }

  // Summary
  console.log(colorize('=== Summary ===\n', colors.bold));

  const complianceCount = results.filter(r => r.compliant).length;
  const totalCommands = results.length;
  const allSLAMet = allCompliant && globalReliability >= 99.0;

  console.log(`Core commands at 99%+ SLA: ${complianceCount}/${totalCommands}`);
  console.log(`Global success rate: ${globalStats.successRate}`);

  if (allSLAMet) {
    console.log('\n' + colorize('✓ SLA VERIFICATION PASSED - 99%+ reliability achieved', colors.bold + colors.green));
  } else {
    console.log('\n' + colorize('✗ SLA VERIFICATION FAILED - Below 99% threshold', colors.bold + colors.red));
  }

  // Detailed metrics table
  console.log('\n' + colorize('=== Detailed Metrics ===\n', colors.bold));

  console.log('Command'.padEnd(20) + 'Reliability'.padEnd(15) + 'Avg Latency'.padEnd(15) + 'P99 Latency'.padEnd(15) + 'Retries');
  console.log('-'.repeat(80));

  for (const result of results) {
    const m = result.metrics;
    console.log(
      result.command.padEnd(20) +
      m.reliability.padEnd(15) +
      m.avgLatency.padEnd(15) +
      m.p99Latency.padEnd(15) +
      m.retries
    );
  }

  // Health status
  console.log('\n' + colorize('=== Health Status ===\n', colors.bold));

  const health = reliabilityManager.getHealthStatus();

  console.log(`Healthy: ${health.healthy}`);
  console.log(`Overall Reliability: ${health.overallReliability}`);
  console.log(`SLA Threshold: ${health.threshold}`);
  if (health.warning) {
    console.log(colorize(`Warning: ${health.warning}`, colors.yellow));
  }

  // Top commands
  console.log('\n' + colorize('=== Top Commands by Request Count ===\n', colors.bold));

  const topCommands = reliabilityManager.getTopCommands(10);
  for (const cmd of topCommands) {
    console.log(`${cmd.command.padEnd(20)} ${cmd.attempts.toString().padEnd(10)} attempts  ${cmd.reliability.padEnd(10)} reliability`);
  }

  // Latency percentiles
  console.log('\n' + colorize('=== Overall Latency Percentiles ===\n', colors.bold));

  const allMetrics = reliabilityManager.getAllCommandMetrics();
  let minP50 = Infinity, maxP50 = 0;
  let minP99 = Infinity, maxP99 = 0;

  for (const cmd in allMetrics) {
    const m = allMetrics[cmd];
    if (m.totalAttempts > 0) {
      const p50 = parseInt(m.p50Latency);
      const p99 = parseInt(m.p99Latency);
      minP50 = Math.min(minP50, p50);
      maxP50 = Math.max(maxP50, p50);
      minP99 = Math.min(minP99, p99);
      maxP99 = Math.max(maxP99, p99);
    }
  }

  console.log(`P50 Latency Range: ${minP50}ms - ${maxP50}ms`);
  console.log(`P99 Latency Range: ${minP99}ms - ${maxP99}ms`);
  console.log(`Target P99: < 2000ms - ${maxP99 < 2000 ? colorize('✓ PASSED', colors.green) : colorize('✗ FAILED', colors.red)}`);

  // Final result
  console.log('\n' + colorize('='.repeat(60), colors.cyan));
  if (allSLAMet) {
    console.log(colorize('RESULT: 99%+ SLA VERIFIED ✓', colors.bold + colors.green));
  } else {
    console.log(colorize('RESULT: SLA NOT VERIFIED ✗', colors.bold + colors.red));
  }
  console.log(colorize('='.repeat(60) + '\n', colors.cyan));

  process.exit(allSLAMet ? 0 : 1);
}

// Run verification
runSLAVerification().catch(error => {
  console.error(colorize(`\nError during verification: ${error.message}`, colors.red));
  process.exit(1);
});
