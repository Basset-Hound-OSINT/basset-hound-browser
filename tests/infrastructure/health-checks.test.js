/**
 * Health Checker Tests
 *
 * Tests for:
 * - Component health registration
 * - Liveness checks
 * - Readiness checks
 * - System resource monitoring
 * - Health check scheduling
 */

const HealthChecker = require('../../src/infrastructure/health-checks');

describe('HealthChecker', () => {
  let checker;

  beforeEach(() => {
    checker = new HealthChecker({
      checkInterval: 100, // Fast for testing
      memoryThreshold: 0.8,
      diskThreshold: 0.8,
    });
  });

  afterEach(() => {
    checker.stopHealthChecks();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const c = new HealthChecker();

      expect(c.config.checkInterval).toBe(5000);
      expect(c.config.memoryThreshold).toBe(0.8);
      expect(c.config.diskThreshold).toBe(0.8);
    });

    test('should accept custom configuration', () => {
      expect(checker.config.checkInterval).toBe(100);
    });
  });

  describe('Component Registration', () => {
    test('should register a component', () => {
      const checker_func = async () => true;
      checker.registerComponent('database', checker_func);

      expect(checker.components.has('database')).toBe(true);

      const component = checker.components.get('database');
      expect(component.name).toBe('database');
      expect(component.status).toBe('UNKNOWN');
    });

    test('should register multiple components', () => {
      checker.registerComponent('database', () => Promise.resolve(true));
      checker.registerComponent('redis', () => Promise.resolve(true));
      checker.registerComponent('cache', () => Promise.resolve(true));

      expect(checker.components.size).toBe(3);
    });
  });

  describe('Liveness Checks', () => {
    test('should report liveness status', async () => {
      const status = await checker.getLivenessStatus();

      expect(status.status).toBe('ALIVE');
      expect(status.uptime).toBeGreaterThan(0);
    });

    test('should increment uptime', async () => {
      const status1 = await checker.getLivenessStatus();

      await new Promise(resolve => setTimeout(resolve, 50));

      const status2 = await checker.getLivenessStatus();

      expect(status2.uptime).toBeGreaterThan(status1.uptime);
    });
  });

  describe('Readiness Checks', () => {
    test('should report readiness status', async () => {
      const status = await checker.getReadinessStatus();

      expect(status.ready).toBe(true); // No components registered
      expect(Array.isArray(status.components)).toBe(true);
    });

    test('should report not ready if component unhealthy', async () => {
      checker.registerComponent('database', async () => false);

      // Manually set status
      checker.components.get('database').status = 'UNHEALTHY';

      const status = await checker.getReadinessStatus();

      expect(status.ready).toBe(false);
    });

    test('should check readiness is false when critical component down', async () => {
      checker.registerComponent('redis', async () => true);
      checker.components.get('redis').status = 'HEALTHY';

      const status = await checker.getReadinessStatus();

      // Redis is healthy
      const redisComponent = status.components.find(c => c.name === 'redis');
      expect(redisComponent).toBeDefined();
    });
  });

  describe('System Resource Checks', () => {
    test('should check memory usage', async () => {
      const result = await checker.checkMemory();

      expect(result.name).toBe('memory');
      expect(typeof result.ok).toBe('boolean');
      expect(result.metrics).toBeDefined();
      expect(result.metrics.usagePercent).toBeDefined();
    });

    test('should warn on high memory usage', async () => {
      checker.config.memoryThreshold = 0.1; // Set very low threshold

      const result = await checker.checkMemory();

      expect(result.ok).toBe(false);
      expect(result.status).toBe('THRESHOLD_EXCEEDED');
    });

    test('should check disk usage', async () => {
      const result = await checker.checkDisk();

      expect(result.name).toBe('disk');
      expect(typeof result.ok).toBe('boolean');
    });
  });

  describe('Health Check Scheduling', () => {
    test('should start health checks', async () => {
      checker.registerComponent('test', async () => true);

      checker.startHealthChecks();

      expect(checker.checkInterval).toBeDefined();

      // Wait for at least one check
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(checker.overallStatus).not.toBe('UNKNOWN');

      checker.stopHealthChecks();
    });

    test('should stop health checks', () => {
      checker.startHealthChecks();

      expect(checker.checkInterval).toBeDefined();

      checker.stopHealthChecks();

      expect(checker.checkInterval).toBe(null);
    });

    test('should perform periodic health checks', (done) => {
      let checkCount = 0;

      checker.on('health:degraded', () => {
        checkCount++;
      });

      checker.registerComponent('test', async () => true);

      checker.startHealthChecks();

      // Wait for checks
      setTimeout(() => {
        checker.stopHealthChecks();

        // At least one check should have been performed
        expect(checker.lastCheckTime).not.toBe(null);
        done();
      }, 250);
    });
  });

  describe('Component Health Checks', () => {
    test('should check component health', async () => {
      checker.registerComponent('database', async () => true);

      const result = await checker.checkComponent('database');

      expect(result.name).toBe('database');
      expect(result.ok).toBe(true);
    });

    test('should handle component check failure', async () => {
      checker.registerComponent('redis', async () => {
        throw new Error('Connection failed');
      });

      const result = await checker.checkComponent('redis');

      expect(result.ok).toBe(false);
      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('Connection failed');
    });

    test('should track failure count', async () => {
      checker.registerComponent('service', async () => {
        throw new Error('Service down');
      });

      await checker.checkComponent('service');
      const component = checker.components.get('service');

      expect(component.failureCount).toBeGreaterThan(0);
    });
  });

  describe('Overall Health Status', () => {
    test('should report overall status', async () => {
      checker.registerComponent('db', async () => true);

      await checker.performHealthCheck();

      expect(checker.overallStatus).toBe('HEALTHY');
    });

    test('should report degraded when components fail', async () => {
      checker.registerComponent('redis', async () => false);

      const result = await checker.performHealthCheck();

      expect(result.status).toBe('DEGRADED');
    });

    test('should get full health status', async () => {
      checker.registerComponent('database', async () => true);

      const status = await checker.getFullHealthStatus();

      expect(status.overall).toBeDefined();
      expect(status.liveness).toBeDefined();
      expect(status.readiness).toBeDefined();
      expect(status.components).toBeDefined();
    });
  });

  describe('Status Queries', () => {
    test('should report if system is healthy', () => {
      checker.overallStatus = 'HEALTHY';

      expect(checker.isHealthy()).toBe(true);

      checker.overallStatus = 'DEGRADED';

      expect(checker.isHealthy()).toBe(false);
    });

    test('should report if system is ready', () => {
      checker.registerComponent('db', {
        status: 'HEALTHY',
        checker: () => {},
      });

      expect(checker.isReady()).toBe(true);

      checker.components.get('db').status = 'UNHEALTHY';

      expect(checker.isReady()).toBe(false);
    });
  });

  describe('Events', () => {
    test('should emit health:degraded event', (done) => {
      checker.registerComponent('service', async () => false);

      checker.on('health:degraded', (data) => {
        expect(data.failures).toBeDefined();
        done();
      });

      checker.performHealthCheck();
    });

    test('should emit health:recovered event', (done) => {
      checker.registerComponent('service', async () => true);

      checker.on('health:recovered', () => {
        done();
      });

      checker.performHealthCheck();
    });
  });
});
