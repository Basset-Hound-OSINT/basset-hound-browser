/**
 * Command Reliability Guarantees Test Suite
 *
 * Comprehensive tests for the reliability management system:
 * - Automatic retry logic with exponential backoff (max 3 attempts)
 * - Per-command success/failure metrics
 * - SLA compliance verification (99%+ for core commands)
 * - Health endpoint integration
 * - Transient vs permanent error classification
 *
 * Version: 12.9.0
 * Target: 99%+ reliability on core commands
 */

const { ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, RETRYABLE_COMMANDS } = require('../../websocket/reliability-manager');
const { HealthEndpointManager } = require('../../websocket/health-endpoint');
const { CommandDispatcher } = require('../../websocket/command-dispatcher');

describe('Command Reliability Guarantees', () => {
  let reliabilityManager;
  let healthEndpoint;
  let logger;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };

    reliabilityManager = new ReliabilityManager({
      maxRetries: 3,
      commandTimeout: 30000,
      logger
    });

    healthEndpoint = new HealthEndpointManager({
      reliabilityManager,
      logger,
      version: '12.9.0'
    });
  });

  describe('ReliabilityManager Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(reliabilityManager.maxRetries).toBe(3);
      expect(reliabilityManager.commandTimeout).toBe(30000);
    });

    test('should initialize with custom configuration', () => {
      const custom = new ReliabilityManager({
        maxRetries: 5,
        commandTimeout: 60000
      });

      expect(custom.maxRetries).toBe(5);
      expect(custom.commandTimeout).toBe(60000);
    });

    test('should have empty metrics on startup', () => {
      const stats = reliabilityManager.getGlobalStats();

      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
    });
  });

  describe('Automatic Retry Logic', () => {
    test('should execute command successfully on first attempt', async () => {
      let attempts = 0;
      const executor = async () => {
        attempts++;
        return { data: 'success' };
      };

      const result = await reliabilityManager.execute('navigateTo', executor);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.retried).toBe(false);
      expect(attempts).toBe(1);
    });

    test('should retry transient errors up to 3 times', async () => {
      let attempts = 0;
      const executor = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('ETIMEDOUT');
        }
        return { data: 'success' };
      };

      const result = await reliabilityManager.execute('click', executor);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(result.retried).toBe(true);
      expect(attempts).toBe(3);
    });

    test('should respect max retries of 3 attempts', async () => {
      let attempts = 0;
      const executor = async () => {
        attempts++;
        throw new Error('ECONNREFUSED');
      };

      const result = await reliabilityManager.execute('screenshot', executor);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(4); // Initial + 3 retries
      expect(attempts).toBe(4);
    });

    test('should not retry permanent errors', async () => {
      let attempts = 0;
      const executor = async () => {
        attempts++;
        throw new Error('INVALID_PARAMETERS');
      };

      const result = await reliabilityManager.execute('fill', executor);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1); // No retries for permanent errors
      expect(attempts).toBe(1);
    });

    test('should not retry non-retryable commands', async () => {
      let attempts = 0;
      const executor = async () => {
        attempts++;
        throw new Error('ETIMEDOUT');
      };

      // execute_script is not in RETRYABLE_COMMANDS
      const result = await reliabilityManager.execute('execute_script', executor);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1); // No retries for non-retryable commands
    });

    test('should apply exponential backoff between retries', async () => {
      const timestamps = [];
      const executor = async () => {
        timestamps.push(Date.now());
        if (timestamps.length < 3) {
          throw new Error('ETIMEDOUT');
        }
        return { success: true };
      };

      const result = await reliabilityManager.execute('navigateTo', executor, {
        timeout: 10000
      });

      expect(result.success).toBe(true);
      expect(timestamps.length).toBe(3);

      // Check exponential backoff delays
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];

      // Backoff should increase (delay2 >= delay1)
      expect(delay2).toBeGreaterThanOrEqual(delay1);
    });
  });

  describe('Transient vs Permanent Error Classification', () => {
    test('should classify ETIMEDOUT as transient', () => {
      const error = new Error('ETIMEDOUT');
      expect(reliabilityManager._isTransientError(error)).toBe(true);
    });

    test('should classify ECONNRESET as transient', () => {
      const error = new Error('ECONNRESET');
      expect(reliabilityManager._isTransientError(error)).toBe(true);
    });

    test('should classify ECONNREFUSED as transient', () => {
      const error = new Error('ECONNREFUSED');
      expect(reliabilityManager._isTransientError(error)).toBe(true);
    });

    test('should classify INVALID_PARAMETERS as permanent', () => {
      const error = new Error('INVALID_PARAMETERS');
      expect(reliabilityManager._isPermanentError(error)).toBe(true);
    });

    test('should classify AUTH_FAILED as permanent', () => {
      const error = new Error('AUTH_FAILED');
      expect(reliabilityManager._isPermanentError(error)).toBe(true);
    });

    test('should classify Unknown command as permanent', () => {
      const error = new Error('Unknown command');
      expect(reliabilityManager._isPermanentError(error)).toBe(true);
    });
  });

  describe('Command Timeout Enforcement', () => {
    test('should timeout commands exceeding timeout threshold', async () => {
      const executor = async () => {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
        return { success: true };
      };

      const result = await reliabilityManager.execute('click', executor, {
        timeout: 100 // 100ms timeout
      });

      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.error).toContain('TIMEOUT');
    });

    test('should use default timeout when not specified', async () => {
      let executed = false;
      const executor = async () => {
        executed = true;
        return { success: true };
      };

      const result = await reliabilityManager.execute('screenshot', executor);

      expect(result.success).toBe(true);
      expect(executed).toBe(true);
    });

    test('should retry timeout errors for retryable commands', async () => {
      let attempts = 0;
      const executor = async () => {
        attempts++;
        if (attempts === 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        return { success: true };
      };

      const result = await reliabilityManager.execute('navigateTo', executor, {
        timeout: 100
      });

      // Should retry after timeout
      expect(attempts).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Per-Command Metrics', () => {
    test('should track success metrics for commands', async () => {
      const executor = async () => ({ data: 'success' });

      await reliabilityManager.execute('navigateTo', executor);
      await reliabilityManager.execute('navigateTo', executor);
      await reliabilityManager.execute('navigateTo', executor);

      const metrics = reliabilityManager.getCommandMetrics('navigateTo');

      expect(metrics.successCount).toBe(3);
      expect(metrics.totalAttempts).toBe(3);
      expect(metrics.reliability).toBe('100.00%');
    });

    test('should track failure metrics for commands', async () => {
      const executor = async () => {
        throw new Error('TEST_ERROR');
      };

      // Attempt 1: failure
      await reliabilityManager.execute('nonRetryableCommand', executor);

      const metrics = reliabilityManager.getCommandMetrics('nonRetryableCommand');

      expect(metrics.failureCount).toBe(1);
      expect(metrics.totalAttempts).toBe(1);
    });

    test('should calculate latency metrics (avg, min, max)', async () => {
      const executor = async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // 10ms delay
        return { success: true };
      };

      for (let i = 0; i < 5; i++) {
        await reliabilityManager.execute('click', executor);
      }

      const metrics = reliabilityManager.getCommandMetrics('click');

      expect(metrics.avgLatency).toMatch(/^\d+ms$/);
      expect(metrics.minLatency).toMatch(/^\d+ms$/);
      expect(metrics.maxLatency).toMatch(/^\d+ms$/);
      expect(metrics.samples).toBe(5);
    });

    test('should calculate latency percentiles (p50, p95, p99)', async () => {
      const executor = async () => {
        const delay = Math.random() * 50; // 0-50ms random delay
        await new Promise(resolve => setTimeout(resolve, delay));
        return { success: true };
      };

      // Generate 100 samples
      for (let i = 0; i < 100; i++) {
        await reliabilityManager.execute('screenshot', executor);
      }

      const metrics = reliabilityManager.getCommandMetrics('screenshot');

      expect(metrics.p50Latency).toMatch(/^\d+ms$/);
      expect(metrics.p95Latency).toMatch(/^\d+ms$/);
      expect(metrics.p99Latency).toMatch(/^\d+ms$/);
    });

    test('should track retry count per command', async () => {
      let attempts = 0;
      const executor = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('ETIMEDOUT');
        }
        return { success: true };
      };

      await reliabilityManager.execute('fill', executor);

      const metrics = reliabilityManager.getCommandMetrics('fill');

      expect(metrics.retries).toBe(2);
    });

    test('should track timeout count per command', async () => {
      const executor = async () => {
        throw new Error('TIMEOUT');
      };

      await reliabilityManager.execute('click', executor);

      const metrics = reliabilityManager.getCommandMetrics('click');

      expect(metrics.timeouts).toBe(1);
    });
  });

  describe('Global Statistics', () => {
    test('should track global request statistics', async () => {
      const executor = async () => ({ success: true });

      await reliabilityManager.execute('navigateTo', executor);
      await reliabilityManager.execute('click', executor);
      await reliabilityManager.execute('fill', executor);

      const stats = reliabilityManager.getGlobalStats();

      expect(stats.totalRequests).toBe(3);
      expect(stats.successfulRequests).toBe(3);
      expect(stats.failedRequests).toBe(0);
    });

    test('should calculate global success rate', async () => {
      const successExecutor = async () => ({ success: true });
      const failExecutor = async () => {
        throw new Error('ERROR');
      };

      await reliabilityManager.execute('navigateTo', successExecutor);
      await reliabilityManager.execute('click', successExecutor);
      await reliabilityManager.execute('nonRetryableCommand', failExecutor);

      const stats = reliabilityManager.getGlobalStats();

      expect(stats.successRate).toBe('66.67%');
    });

    test('should track transient retry statistics', async () => {
      let attempts = 0;
      const executor = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('ETIMEDOUT');
        }
        return { success: true };
      };

      await reliabilityManager.execute('navigateTo', executor);
      await reliabilityManager.execute('click', executor);

      const stats = reliabilityManager.getGlobalStats();

      expect(stats.transientRetries).toBe(4); // 2 retries per command
    });

    test('should track timeout failures separately', async () => {
      const executor = async () => {
        throw new Error('TIMEOUT');
      };

      await reliabilityManager.execute('nonRetryableCommand', executor);
      await reliabilityManager.execute('nonRetryableCommand', executor);

      const stats = reliabilityManager.getGlobalStats();

      expect(stats.timeoutFailures).toBe(2);
    });
  });

  describe('Core Command Reliability SLA', () => {
    const coreCommands = ['navigateTo', 'click', 'fill', 'screenshot', 'get_url', 'get_content'];

    test('should achieve 99%+ reliability on core commands with 1000 requests', async () => {
      const executor = async () => {
        // Simulate occasional failures (0.5% failure rate)
        if (Math.random() < 0.005) {
          throw new Error('ETIMEDOUT');
        }
        return { success: true };
      };

      const iterations = 1000;
      for (const cmd of coreCommands) {
        for (let i = 0; i < iterations; i++) {
          await reliabilityManager.execute(cmd, executor);
        }
      }

      // Check each core command meets 99% SLA
      for (const cmd of coreCommands) {
        const metrics = reliabilityManager.getCommandMetrics(cmd);
        const reliability = parseFloat(metrics.reliability);

        // With 1000 iterations and 0.5% failure rate, should exceed 99%
        expect(reliability).toBeGreaterThanOrEqual(99);
      }
    });

    test('should track core vs non-core command metrics separately', async () => {
      const executor = async () => ({ success: true });

      // Execute core commands
      for (const cmd of coreCommands) {
        for (let i = 0; i < 10; i++) {
          await reliabilityManager.execute(cmd, executor);
        }
      }

      // Execute non-core commands
      for (let i = 0; i < 20; i++) {
        await reliabilityManager.execute('custom_command', executor);
      }

      const stats = reliabilityManager.getGlobalStats();
      expect(stats.commandCount).toBe(7); // 6 core + 1 non-core
    });
  });

  describe('Retryable Commands Detection', () => {
    test('should identify navigation commands as retryable', () => {
      expect(RETRYABLE_COMMANDS.has('navigateTo')).toBe(true);
      expect(RETRYABLE_COMMANDS.has('navigate')).toBe(true);
      expect(RETRYABLE_COMMANDS.has('click')).toBe(true);
      expect(RETRYABLE_COMMANDS.has('fill')).toBe(true);
    });

    test('should identify read commands as retryable', () => {
      expect(RETRYABLE_COMMANDS.has('get_url')).toBe(true);
      expect(RETRYABLE_COMMANDS.has('get_content')).toBe(true);
      expect(RETRYABLE_COMMANDS.has('screenshot')).toBe(true);
      expect(RETRYABLE_COMMANDS.has('screenshot_viewport')).toBe(true);
      expect(RETRYABLE_COMMANDS.has('screenshot_full_page')).toBe(true);
    });

    test('should identify status commands as retryable', () => {
      expect(RETRYABLE_COMMANDS.has('ping')).toBe(true);
      expect(RETRYABLE_COMMANDS.has('status')).toBe(true);
      expect(RETRYABLE_COMMANDS.has('getHealth')).toBe(true);
    });

    test('should have comprehensive list of retryable commands', () => {
      expect(RETRYABLE_COMMANDS.size).toBeGreaterThan(30);
    });
  });

  describe('Health Endpoint Integration', () => {
    test('should create HTTP handler for health endpoint', () => {
      const handler = healthEndpoint.createHttpHandler();

      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(2); // (req, res)
    });

    test('should create WebSocket handler for health endpoint', () => {
      const handler = healthEndpoint.createWebSocketHandler();

      expect(typeof handler).toBe('function');
    });

    test('should return health status with reliability metrics', async () => {
      const executor = async () => ({ success: true });

      for (let i = 0; i < 10; i++) {
        await reliabilityManager.execute('navigateTo', executor);
      }

      healthEndpoint.setReliabilityManager(reliabilityManager);
      const status = await healthEndpoint.getFullHealthStatus();

      expect(status.status).toBeDefined();
      expect(status.reliability).toBeDefined();
      expect(status.sla).toBeDefined();
      expect(status.sla.target).toBe('99%+');
      expect(status.sla.current).toBeDefined();
    });

    test('should provide reliability-focused status endpoint', async () => {
      const executor = async () => ({ success: true });

      for (let i = 0; i < 20; i++) {
        await reliabilityManager.execute('click', executor);
      }

      healthEndpoint.setReliabilityManager(reliabilityManager);
      const status = await healthEndpoint.getReliabilityStatus();

      expect(status.status).toBeDefined();
      expect(status.sla).toBeDefined();
      expect(status.globalStats).toBeDefined();
    });

    test('should track top commands by reliability', () => {
      const topCommands = reliabilityManager.getTopCommands(5);

      expect(Array.isArray(topCommands)).toBe(true);
    });

    test('should provide recent request history', () => {
      const recent = reliabilityManager.getRecentRequests(50);

      expect(Array.isArray(recent)).toBe(true);
    });
  });

  describe('Metrics Reset and Lifecycle', () => {
    test('should reset all metrics on demand', async () => {
      const executor = async () => ({ success: true });

      await reliabilityManager.execute('navigateTo', executor);
      await reliabilityManager.execute('click', executor);

      let stats = reliabilityManager.getGlobalStats();
      expect(stats.totalRequests).toBe(2);

      reliabilityManager.reset();

      stats = reliabilityManager.getGlobalStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
    });

    test('should handle concurrent executions', async () => {
      const executor = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { success: true };
      };

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(reliabilityManager.execute('click', executor));
      }

      const results = await Promise.all(promises);

      expect(results.every(r => r.success)).toBe(true);

      const metrics = reliabilityManager.getCommandMetrics('click');
      expect(metrics.totalAttempts).toBe(10);
    });

    test('should handle mixed success and failure concurrent executions', async () => {
      let callCount = 0;
      const executor = async () => {
        callCount++;
        if (callCount % 3 === 0) {
          throw new Error('ETIMEDOUT');
        }
        return { success: true };
      };

      const promises = [];
      for (let i = 0; i < 30; i++) {
        promises.push(reliabilityManager.execute('click', executor));
      }

      const results = await Promise.all(promises);

      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);

      const metrics = reliabilityManager.getCommandMetrics('click');
      expect(metrics.totalAttempts).toBeGreaterThan(30); // Some retries
    });
  });

  describe('Health Status Verification', () => {
    test('should report health status as healthy when reliable', async () => {
      const executor = async () => ({ success: true });

      for (let i = 0; i < 100; i++) {
        await reliabilityManager.execute('navigateTo', executor);
      }

      const health = reliabilityManager.getHealthStatus();

      expect(health.healthy).toBe(true);
      expect(parseFloat(health.overallReliability)).toBeGreaterThanOrEqual(99);
    });

    test('should report warning when reliability drops below 99%', async () => {
      let callCount = 0;
      const executor = async () => {
        callCount++;
        if (callCount % 2 === 0) { // 50% failure rate
          throw new Error('ERROR');
        }
        return { success: true };
      };

      for (let i = 0; i < 100; i++) {
        await reliabilityManager.execute('navigateTo', executor);
      }

      const health = reliabilityManager.getHealthStatus();

      expect(health.warning).toBeTruthy();
      expect(parseFloat(health.overallReliability)).toBeLessThan(99);
    });
  });

  describe('Integration with CommandDispatcher', () => {
    test('should support reliability metrics in dispatcher context', () => {
      const handlers = {
        'test_command': async (params, context) => {
          return { success: true, result: 'executed' };
        }
      };

      const dispatcher = new CommandDispatcher(handlers, { logger });

      expect(dispatcher.commandHandlers).toEqual(handlers);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null executor gracefully', async () => {
      try {
        await reliabilityManager.execute('click', null);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should handle executor throwing non-Error objects', async () => {
      const executor = async () => {
        throw 'String error'; // Not an Error object
      };

      const result = await reliabilityManager.execute('nonRetryableCommand', executor);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle extremely large sample sets', async () => {
      const executor = async () => ({ success: true });

      // Generate 1000 samples
      for (let i = 0; i < 1000; i++) {
        await reliabilityManager.execute('click', executor);
      }

      const metrics = reliabilityManager.getCommandMetrics('click');

      // Should keep only last 100 samples
      expect(metrics.samples).toBe(100);
      expect(metrics.totalAttempts).toBe(1000);
    });

    test('should maintain accuracy with many concurrent retries', async () => {
      let globalAttempts = 0;
      const executor = async () => {
        globalAttempts++;
        if (globalAttempts % 5 === 0) {
          throw new Error('ETIMEDOUT');
        }
        return { success: true };
      };

      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(reliabilityManager.execute('click', executor));
      }

      await Promise.all(promises);

      const metrics = reliabilityManager.getCommandMetrics('click');
      const stats = reliabilityManager.getGlobalStats();

      expect(metrics.totalAttempts).toBeGreaterThan(0);
      expect(stats.totalRequests).toBe(50);
    });
  });
});
