/**
 * Reliability Manager - Retry Mechanism Demo
 *
 * Demonstrates automatic retry logic with transient failures
 * and how the system recovers from temporary errors.
 *
 * Run with: node websocket/reliability-retry-demo.js
 */

const { ReliabilityManager } = require('./reliability-manager');

/**
 * Demo showing retry mechanism in action
 */
async function runRetryDemo() {
  console.log('='.repeat(80));
  console.log('Basset Hound Browser - Retry Mechanism Demo');
  console.log('='.repeat(80));
  console.log('');

  const reliabilityManager = new ReliabilityManager({
    maxRetries: 3,
    commandTimeout: 30000,
    logger: {
      debug: (msg) => { },
      info: (msg) => console.log(`[INFO] ${msg}`),
      error: (msg) => console.error(`[ERROR] ${msg}`)
    }
  });

  // Test Case 1: Transient failure that succeeds on retry
  console.log('TEST 1: Transient failure (recovers on retry)');
  console.log('-'.repeat(80));

  let attempt1 = 0;
  const result1 = await reliabilityManager.execute('navigateTo', async () => {
    attempt1++;
    console.log(`  Attempt ${attempt1}: Executing navigateTo command...`);

    if (attempt1 <= 1) {
      console.log(`    → Failed with transient error: ECONNRESET`);
      throw new Error('ECONNRESET');
    }

    await new Promise(r => setTimeout(r, 10)); // Simulate work
    console.log(`    → Success!`);
    return { url: 'https://example.com', title: 'Example' };
  });

  console.log(`Result: ${result1.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Attempts: ${result1.attempts}`);
  console.log(`Retried: ${result1.retried}`);
  console.log(`Latency: ${result1.latency}ms`);
  console.log('');

  // Test Case 2: Multiple retries needed
  console.log('TEST 2: Multiple transient failures (succeeds after 2 retries)');
  console.log('-'.repeat(80));

  let attempt2 = 0;
  const result2 = await reliabilityManager.execute('screenshot', async () => {
    attempt2++;
    console.log(`  Attempt ${attempt2}: Taking screenshot...`);

    if (attempt2 === 1) {
      console.log(`    → Failed with: ETIMEDOUT`);
      throw new Error('ETIMEDOUT');
    }

    if (attempt2 === 2) {
      console.log(`    → Failed with: ECONNREFUSED`);
      throw new Error('ECONNREFUSED');
    }

    console.log(`    → Success!`);
    return { data: Buffer.alloc(1024), size: 1024 };
  });

  console.log(`Result: ${result2.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Attempts: ${result2.attempts}`);
  console.log(`Retried: ${result2.retried}`);
  console.log(`Latency: ${result2.latency}ms`);
  console.log('');

  // Test Case 3: Timeout that recovers
  console.log('TEST 3: Timeout that recovers on retry');
  console.log('-'.repeat(80));

  let attempt3 = 0;
  const result3 = await reliabilityManager.execute('click', async () => {
    attempt3++;
    console.log(`  Attempt ${attempt3}: Clicking element...`);

    if (attempt3 === 1) {
      console.log(`    → Operation timing out...`);
      throw new Error('TIMEOUT');
    }

    console.log(`    → Success!`);
    return { selector: '.button', clicked: true };
  }, { timeout: 10000 }); // 10 second timeout

  console.log(`Result: ${result3.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Attempts: ${result3.attempts}`);
  console.log(`Timedout: ${result3.timedOut}`);
  console.log(`Latency: ${result3.latency}ms`);
  console.log('');

  // Test Case 4: Permanent failure (no retry)
  console.log('TEST 4: Permanent failure (no retry, fails immediately)');
  console.log('-'.repeat(80));

  let attempt4 = 0;
  const result4 = await reliabilityManager.execute('fill', async () => {
    attempt4++;
    console.log(`  Attempt ${attempt4}: Filling form field...`);
    console.log(`    → Failed with permanent error: INVALID_PARAMETERS`);
    throw new Error('INVALID_PARAMETERS');
  });

  console.log(`Result: ${result4.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Attempts: ${result4.attempts} (no retry for permanent errors)`);
  console.log(`Error: ${result4.error}`);
  console.log('');

  // Test Case 5: Exhausted retries
  console.log('TEST 5: Exhausted retries (transient failures all the way)');
  console.log('-'.repeat(80));

  let attempt5 = 0;
  const result5 = await reliabilityManager.execute('get_content', async () => {
    attempt5++;
    console.log(`  Attempt ${attempt5}: Getting page content...`);
    console.log(`    → Failed with: ECONNREFUSED`);
    throw new Error('ECONNREFUSED');
  });

  console.log(`Result: ${result5.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Attempts: ${result5.attempts} (max retries exhausted)`);
  console.log(`Retried: ${result5.retried}`);
  console.log(`Error: ${result5.error}`);
  console.log('');

  // Display metrics
  console.log('='.repeat(80));
  console.log('METRICS AFTER TESTS');
  console.log('='.repeat(80));
  console.log('');

  const globalStats = reliabilityManager.getGlobalStats();
  console.log('Global Statistics:');
  console.log(`  Total Requests: ${globalStats.totalRequests}`);
  console.log(`  Successful: ${globalStats.successfulRequests}`);
  console.log(`  Failed: ${globalStats.failedRequests}`);
  console.log(`  Success Rate: ${globalStats.successRate}`);
  console.log(`  Transient Retries: ${globalStats.transientRetries}`);
  console.log('');

  // Per-command breakdown
  console.log('Per-Command Breakdown:');
  for (const cmd of ['navigateTo', 'screenshot', 'click', 'fill', 'get_content']) {
    const metrics = reliabilityManager.getCommandMetrics(cmd);
    if (metrics.totalAttempts > 0) {
      console.log(`\n${cmd}:`);
      console.log(`  Reliability: ${metrics.reliability}`);
      console.log(`  Total Attempts: ${metrics.totalAttempts}`);
      console.log(`  Success: ${metrics.successCount}`);
      console.log(`  Failures: ${metrics.failureCount}`);
      console.log(`  Retries: ${metrics.retries}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('KEY OBSERVATIONS');
  console.log('='.repeat(80) + '\n');

  console.log('1. Transient failures are automatically retried:');
  console.log('   - ECONNRESET, ETIMEDOUT, ECONNREFUSED, TIMEOUT → Retried');
  console.log('   - System recovers transparently');
  console.log('');

  console.log('2. Permanent failures fail immediately:');
  console.log('   - INVALID_PARAMETERS → Fails immediately (1 attempt)');
  console.log('   - No resource waste on unrecoverable errors');
  console.log('');

  console.log('3. Exponential backoff prevents thundering herd:');
  console.log('   - Attempt 1: Immediate');
  console.log('   - Attempt 2: 1 second delay');
  console.log('   - Attempt 3: 2 second delay');
  console.log('   - Attempt 4: 4 second delay');
  console.log('');

  console.log('4. Overall reliability improves:');
  console.log(`   - Without retries: ${globalStats.failedRequests} failures`);
  console.log(`   - With retries: ${globalStats.failedRequests - globalStats.transientRetries} permanent failures`);
  console.log(`   - Retry success rate: ${(
    (globalStats.transientRetries - globalStats.failedRequests) /
    globalStats.transientRetries * 100
  ).toFixed(1)}%`);
  console.log('');

  console.log('='.repeat(80));
  console.log('Demo completed!');
  console.log('='.repeat(80) + '\n');
}

// Run demo
if (require.main === module) {
  runRetryDemo().catch(err => {
    console.error('Demo failed:', err);
    process.exit(1);
  });
}

module.exports = { runRetryDemo };
