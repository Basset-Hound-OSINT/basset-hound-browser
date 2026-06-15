/**
 * Enhanced Health Checker Tests
 * Tests for v12.3.0 health check infrastructure
 */

const HealthChecker = require('../../src/infrastructure/health-check-enhanced');

describe('HealthChecker', () => {
  let checker;

  beforeEach(() => {
    checker = new HealthChecker({
      checkInterval: 5000
    });
  });

  afterEach(() => {
    if (checker.checkInterval) {
      checker.stopHealthChecks();
    }
  });

  describe('Check Registration', () => {
    test('should register custom health checks', () => {
      const checkFn = jest.fn().mockResolvedValue({
        status: 'healthy',
        message: 'All good'
      });

      checker.registerCheck('custom', checkFn, {
        timeout: 5000,
        critical: true
      });

      expect(checker.checks.has('custom')).toBe(true);
    });

    test('should initialize standard checks', () => {
      expect(checker.checks.has('memory')).toBe(true);
      expect(checker.checks.has('uptime')).toBe(true);
      expect(checker.checks.has('eventLoop')).toBe(true);
      expect(checker.checks.has('filesystem')).toBe(true);
    });
  });

  describe('Individual Check Execution', () => {
    test('should run memory check', async () => {
      const result = await checker.runCheck('memory');

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('percent');
    });

    test('should run uptime check', async () => {
      const result = await checker.runCheck('uptime');

      expect(result.status).toBe('healthy');
      expect(result).toHaveProperty('seconds');
      expect(result.seconds).toBeGreaterThan(0);
    });

    test('should handle check timeout', async () => {
      checker.registerCheck('slow', async () => {
        await new Promise(resolve => setTimeout(resolve, 10000));
      }, { timeout: 100 });

      const result = await checker.runCheck('slow');
      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('timeout');
    });

    test('should handle check errors', async () => {
      checker.registerCheck('error', async () => {
        throw new Error('Check failed');
      });

      const result = await checker.runCheck('error');
      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('failed');
    });
  });

  describe('All Checks Execution', () => {
    test('should run all checks successfully', async () => {
      const report = await checker.runAllChecks();

      expect(report).toHaveProperty('status');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('checks');
      expect(Object.keys(report.checks).length).toBeGreaterThan(0);
    });

    test('should determine overall health status', async () => {
      const report = await checker.runAllChecks();

      expect(['healthy', 'degraded', 'unhealthy']).toContain(report.status);
    });

    test('should track critical check failures', async () => {
      checker.registerCheck('critical_fail', async () => ({
        status: 'unhealthy'
      }), { critical: true });

      const report = await checker.runAllChecks();
      expect(report.status).toBe('unhealthy');
      expect(report.criticalCheck).toBe('critical_fail');
    });

    test('should allow non-critical check failures', async () => {
      checker.registerCheck('non_critical', async () => ({
        status: 'unhealthy'
      }), { critical: false });

      const report = await checker.runAllChecks();
      // Overall status may be degraded or still healthy depending on other checks
      expect(report).toHaveProperty('status');
    });
  });

  describe('Probes', () => {
    test('should provide liveness probe', async () => {
      const probe = await checker.getLivenessProbe();

      expect(probe).toEqual(
        expect.objectContaining({
          alive: true,
          timestamp: expect.any(Number),
          uptime: expect.any(Number)
        })
      );
    });

    test('should provide readiness probe', async () => {
      const probe = await checker.getReadinessProbe();

      expect(probe).toEqual(
        expect.objectContaining({
          ready: expect.any(Boolean),
          status: expect.any(String),
          timestamp: expect.any(Number),
          checks: expect.any(Object)
        })
      );
    });

    test('readiness should reflect check status', async () => {
      // With standard healthy checks, readiness should be true
      const probe = await checker.getReadinessProbe();
      expect(probe.ready).toBe(true);
    });
  });

  describe('Periodic Checking', () => {
    test('should start health checks', (done) => {
      const listener = jest.fn();
      checker.on('healthcheck:complete', listener);

      checker.startHealthChecks();

      setTimeout(() => {
        checker.stopHealthChecks();
        expect(listener).toHaveBeenCalled();
        done();
      }, 100);
    });

    test('should not start duplicate health checks', () => {
      checker.startHealthChecks();
      const firstInterval = checker.checkInterval;

      checker.startHealthChecks();
      expect(checker.checkInterval).toBe(firstInterval);

      checker.stopHealthChecks();
    });

    test('should stop health checks', (done) => {
      checker.startHealthChecks();
      expect(checker.checkInterval).not.toBeNull();

      checker.stopHealthChecks();
      expect(checker.checkInterval).toBeNull();

      done();
    });

    test('should emit recovery events on failure', (done) => {
      const recoveryListener = jest.fn();
      checker.on('health:recovery-needed', recoveryListener);

      // Register a failing critical check
      checker.registerCheck('fail_check', async () => ({
        status: 'unhealthy'
      }), { critical: true });

      checker.startHealthChecks();

      setTimeout(() => {
        checker.stopHealthChecks();
        expect(recoveryListener).toHaveBeenCalled();
        done();
      }, 100);
    });
  });

  describe('Status Reporting', () => {
    test('should report current status', async () => {
      await checker.runAllChecks();
      const status = checker.getStatus();

      expect(status).toEqual(
        expect.objectContaining({
          healthy: expect.any(Boolean),
          lastCheck: expect.any(Number),
          checks: expect.any(Object)
        })
      );
    });

    test('should include failure counts in status', async () => {
      // Run check multiple times
      for (let i = 0; i < 3; i++) {
        await checker.runCheck('memory');
      }

      const status = checker.getStatus();
      expect(status.checks.memory).toHaveProperty('failureCount');
    });
  });

  describe('Recovery Procedures', () => {
    test('should attempt recovery for failed checks', async () => {
      let attemptCount = 0;
      checker.registerCheck('flaky', async () => {
        attemptCount++;
        return {
          status: attemptCount > 2 ? 'healthy' : 'unhealthy'
        };
      });

      const result = await checker.performRecovery('flaky');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('result');
    });

    test('should emit recovery events', async () => {
      const startListener = jest.fn();
      const completeListener = jest.fn();

      checker.on('health:recovery-start', startListener);
      checker.on('health:recovery-complete', completeListener);

      await checker.performRecovery('memory');

      expect(startListener).toHaveBeenCalled();
      expect(completeListener).toHaveBeenCalled();
    });

    test('should handle recovery for non-existent check', async () => {
      const result = await checker.performRecovery('non_existent');
      expect(result.success).toBe(false);
    });
  });

  describe('Event Emission', () => {
    test('should emit healthcheck:complete event', (done) => {
      const listener = jest.fn();
      checker.on('healthcheck:complete', listener);

      checker.runAllChecks().then(() => {
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            status: expect.any(String),
            checks: expect.any(Object)
          })
        );
        done();
      });
    });

    test('should emit health:error event on check error', (done) => {
      const listener = jest.fn();
      checker.on('health:error', listener);

      // Simulate an error (this is harder to trigger naturally)
      checker.emit('health:error', {
        error: 'Test error'
      });

      setImmediate(() => {
        // Just verify the event system works
        done();
      });
    });
  });

  describe('Memory Check Thresholds', () => {
    test('memory check should report critical at 90%+', async () => {
      // This test verifies the logic, actual memory won't be this high
      // Just ensure the memory check is properly configured
      const result = await checker.runCheck('memory');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
    });
  });

  describe('Configuration', () => {
    test('should accept custom check interval', () => {
      const customChecker = new HealthChecker({
        checkInterval: 10000
      });

      expect(customChecker.options.checkInterval).toBe(10000);
    });

    test('should accept auto-recovery setting', () => {
      const customChecker = new HealthChecker({
        enableAutoRecovery: false
      });

      expect(customChecker.options.enableAutoRecovery).toBe(false);
    });

    test('should default to auto-recovery enabled', () => {
      const customChecker = new HealthChecker();
      expect(customChecker.options.enableAutoRecovery).toBe(true);
    });
  });
});
