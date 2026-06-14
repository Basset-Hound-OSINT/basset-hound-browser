/**
 * Unit Tests for BaseManager and ManagerRegistry
 * Tests core functionality and lifecycle management
 */

const { BaseManager, ManagerRegistry, ManagerState } = require('../../src/managers');

/**
 * Mock logger for testing
 */
function createMockLogger(name) {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

/**
 * Test Manager implementation
 */
class TestManager extends BaseManager {
  constructor(name, options = {}) {
    super(name, options);
    this.customData = null;
    this.initializeWasCalled = false;
    this.validateWasCalled = false;
    this.cleanupWasCalled = false;
  }

  async _baseInitialize() {
    this.initializeWasCalled = true;
    this.customData = { initialized: true };
  }

  async _baseValidate() {
    this.validateWasCalled = true;
    if (!this.customData) {
      return { valid: false, error: 'Custom data missing' };
    }
    return { valid: true };
  }

  async _baseCleanup() {
    this.cleanupWasCalled = true;
    this.customData = null;
  }
}

describe('BaseManager', () => {
  describe('Constructor', () => {
    it('should create a manager with name', () => {
      const manager = new TestManager('TestManager');
      expect(manager.name).toBe('TestManager');
    });

    it('should throw error if name is missing', () => {
      expect(() => {
        new BaseManager('');
      }).toThrow('Manager name is required');
    });

    it('should initialize with uninitialized state', () => {
      const manager = new TestManager('TestManager');
      expect(manager.initialized).toBe(false);
      expect(manager.validated).toBe(false);
      expect(manager.state).toBe(ManagerState.UNINITIALIZED);
    });

    it('should accept options', () => {
      const options = { enableMetrics: true, timeoutMs: 5000 };
      const manager = new TestManager('TestManager', options);
      expect(manager.enableMetrics).toBe(true);
      expect(manager.timeoutMs).toBe(5000);
    });
  });

  describe('Lifecycle - Initialize', () => {
    it('should initialize successfully', async () => {
      const manager = new TestManager('TestManager');
      const result = await manager.initialize();

      expect(result.success).toBe(true);
      expect(manager.initialized).toBe(true);
      expect(manager.state).toBe(ManagerState.INITIALIZED);
      expect(manager.initializeWasCalled).toBe(true);
    });

    it('should not initialize twice', async () => {
      const manager = new TestManager('TestManager');
      await manager.initialize();
      const result = await manager.initialize();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Already initialized');
    });

    it('should track initialization time', async () => {
      const manager = new TestManager('TestManager');
      await manager.initialize();

      expect(manager.metrics.initializationTime).toBeGreaterThanOrEqual(0);
    });

    it('should set state during initialization', async () => {
      const manager = new TestManager('TestManager');

      // Start initializing
      const promise = manager.initialize();
      expect(manager.state).toBe(ManagerState.INITIALIZING);

      await promise;
      expect(manager.state).toBe(ManagerState.INITIALIZED);
    });
  });

  describe('Lifecycle - Validate', () => {
    it('should validate after initialization', async () => {
      const manager = new TestManager('TestManager');
      await manager.initialize();
      const result = await manager.validate();

      expect(result.valid).toBe(true);
      expect(manager.validated).toBe(true);
      expect(manager.state).toBe(ManagerState.READY);
    });

    it('should fail validation if not initialized', async () => {
      const manager = new TestManager('TestManager');
      const result = await manager.validate();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not initialized');
    });

    it('should fail custom validation', async () => {
      const manager = new TestManager('TestManager');
      manager.customData = null;  // Force validation failure
      await manager.initialize();
      manager.customData = null;  // Clear after init
      const result = await manager.validate();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Custom data missing');
    });

    it('should track validation time', async () => {
      const manager = new TestManager('TestManager');
      await manager.initialize();
      await manager.validate();

      expect(manager.metrics.validationTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Lifecycle - Cleanup', () => {
    it('should cleanup successfully', async () => {
      const manager = new TestManager('TestManager');
      await manager.initialize();
      const result = await manager.cleanup();

      expect(result.success).toBe(true);
      expect(manager.initialized).toBe(false);
      expect(manager.validated).toBe(false);
      expect(manager.state).toBe(ManagerState.UNINITIALIZED);
      expect(manager.cleanupWasCalled).toBe(true);
    });

    it('should cleanup even if not initialized', async () => {
      const manager = new TestManager('TestManager');
      const result = await manager.cleanup();

      expect(result.success).toBe(true);
    });
  });

  describe('Operations - safeExecute', () => {
    it('should execute operation successfully', async () => {
      const manager = new TestManager('TestManager');
      await manager.initialize();

      const result = await manager.safeExecute(async () => {
        return { data: 'test' };
      });

      expect(result).toEqual({ data: 'test' });
    });

    it('should track operation metrics', async () => {
      const manager = new TestManager('TestManager');
      await manager.initialize();

      await manager.safeExecute(async () => {
        await new Promise(r => setTimeout(r, 10));
      });

      expect(manager.metrics.operationCount).toBe(1);
      expect(manager.metrics.lastOperationTime).toBeGreaterThanOrEqual(0);
    });

    it('should timeout long-running operations', async () => {
      const manager = new TestManager('TestManager', { timeoutMs: 100 });
      await manager.initialize();

      await expect(
        manager.safeExecute(async () => {
          await new Promise(r => setTimeout(r, 500));
        })
      ).rejects.toThrow('timeout');
    });

    it('should handle errors in operations', async () => {
      const manager = new TestManager('TestManager');
      await manager.initialize();

      await expect(
        manager.safeExecute(async () => {
          throw new Error('Operation failed');
        })
      ).rejects.toThrow('Operation failed');

      expect(manager.metrics.errorCount).toBe(1);
    });

    it('should fail if not initialized', async () => {
      const manager = new TestManager('TestManager');

      await expect(
        manager.safeExecute(async () => {
          return {};
        })
      ).rejects.toThrow('not initialized');
    });
  });

  describe('Status and Health', () => {
    it('should report status', async () => {
      const manager = new TestManager('TestManager');
      const status = manager.getStatus();

      expect(status.name).toBe('TestManager');
      expect(status.initialized).toBe(false);
      expect(status.state).toBe(ManagerState.UNINITIALIZED);
    });

    it('should report health status', async () => {
      const manager = new TestManager('TestManager');
      let health = manager._getHealth();
      expect(health).toBe('unknown');

      await manager.initialize();
      await manager.validate();
      health = manager._getHealth();
      expect(health).toBe('healthy');
    });

    it('should be healthy when initialized and validated', async () => {
      const manager = new TestManager('TestManager');
      await manager.initialize();
      await manager.validate();

      expect(manager.isHealthy()).toBe(true);
      expect(manager.isReady()).toBe(true);
    });

    it('should not be healthy after error', async () => {
      const manager = new TestManager('TestManager');
      await manager.initialize();

      manager.setState(ManagerState.ERROR);
      expect(manager.isHealthy()).toBe(false);
    });

    it('should track last error', async () => {
      const manager = new TestManager('TestManager');
      await manager.initialize();

      await manager.safeExecute(async () => {
        throw new Error('Test error');
      }).catch(() => {});

      expect(manager.lastError).toBeTruthy();
      expect(manager.lastError.message).toContain('Test error');
    });
  });

  describe('Metrics', () => {
    it('should track metrics', async () => {
      const manager = new TestManager('TestManager', { enableMetrics: true });
      const initialMetrics = { ...manager.metrics };

      await manager.initialize();
      expect(manager.metrics.initializationTime).toBeGreaterThanOrEqual(0);

      await manager.validate();
      expect(manager.metrics.validationTime).toBeGreaterThanOrEqual(0);
    });

    it('should reset metrics', async () => {
      const manager = new TestManager('TestManager');
      await manager.initialize();

      manager.metrics.operationCount = 100;
      manager.resetMetrics();

      expect(manager.metrics.operationCount).toBe(0);
      expect(manager.metrics.initializationTime).toBe(0);
    });
  });

  describe('Logging', () => {
    it('should log messages', async () => {
      const manager = new TestManager('TestManager');
      // Logger exists and can be called, just verify it doesn't throw
      manager.log('info', 'Test message', { data: 'test' });
      expect(manager.logger).toBeDefined();
    });
  });
});

describe('ManagerRegistry', () => {
  describe('Registration', () => {
    it('should register a manager', () => {
      const registry = new ManagerRegistry();
      const manager = new TestManager('TestManager');

      const result = registry.register('test', manager);

      expect(result.success).toBe(true);
      expect(registry.hasManager('test')).toBe(true);
    });

    it('should get a registered manager', () => {
      const registry = new ManagerRegistry();
      const manager = new TestManager('TestManager');

      registry.register('test', manager);
      const retrieved = registry.getManager('test');

      expect(retrieved).toBe(manager);
    });

    it('should list all managers', () => {
      const registry = new ManagerRegistry();
      registry.register('manager1', new TestManager('Manager1'));
      registry.register('manager2', new TestManager('Manager2'));

      const managers = registry.listManagers();

      expect(managers).toContain('manager1');
      expect(managers).toContain('manager2');
    });

    it('should unregister a manager', () => {
      const registry = new ManagerRegistry();
      registry.register('test', new TestManager('TestManager'));
      const result = registry.unregister('test');

      expect(result.success).toBe(true);
      expect(registry.hasManager('test')).toBe(false);
    });

    it('should replace existing manager', () => {
      const registry = new ManagerRegistry();
      const manager1 = new TestManager('Manager1');
      const manager2 = new TestManager('Manager2');

      registry.register('test', manager1);
      registry.register('test', manager2);

      const retrieved = registry.getManager('test');
      expect(retrieved).toBe(manager2);
    });
  });

  describe('Lifecycle - Initialize All', () => {
    it('should initialize all managers', async () => {
      const registry = new ManagerRegistry();
      registry.register('manager1', new TestManager('Manager1'));
      registry.register('manager2', new TestManager('Manager2'));

      const result = await registry.initializeAll({ skipValidation: true });

      expect(result.success).toBe(true);
      expect(result.initialized.length).toBe(2);
    });

    it('should initialize in specified order', async () => {
      const registry = new ManagerRegistry({
        initializationOrder: ['manager2', 'manager1']
      });

      const manager1 = new TestManager('Manager1');
      const manager2 = new TestManager('Manager2');

      registry.register('manager1', manager1);
      registry.register('manager2', manager2);

      const initOrder = [];
      manager1.initialize = async function() {
        initOrder.push('manager1');
        return await BaseManager.prototype.initialize.call(this);
      };
      manager2.initialize = async function() {
        initOrder.push('manager2');
        return await BaseManager.prototype.initialize.call(this);
      };

      await registry.initializeAll({ skipValidation: true });

      expect(initOrder[0]).toBe('manager2');
      expect(initOrder[1]).toBe('manager1');
    });

    it('should validate all managers after init', async () => {
      const registry = new ManagerRegistry();
      registry.register('manager1', new TestManager('Manager1'));

      const result = await registry.initializeAll({ skipValidation: false });

      expect(result.success).toBe(true);
      expect(result.validated).toBeDefined();
    });

    it('should continue on error if specified', async () => {
      const registry = new ManagerRegistry();

      // Create a failing manager
      class FailingManager extends BaseManager {
        async _baseInitialize() {
          throw new Error('Init failed');
        }
      }

      registry.register('failing', new FailingManager('Failing'));
      registry.register('working', new TestManager('Working'));

      const result = await registry.initializeAll({
        skipValidation: true,
        continueOnError: true
      });

      // With continueOnError: true, should still return success but with failed items listed
      expect(result.failed.length).toBeGreaterThan(0);
      // Should have tried to initialize both
      expect(result.initialized.length).toBeGreaterThan(0);
    });
  });

  describe('Lifecycle - Cleanup All', () => {
    it('should cleanup all managers', async () => {
      const registry = new ManagerRegistry();
      const manager1 = new TestManager('Manager1');
      const manager2 = new TestManager('Manager2');

      registry.register('manager1', manager1);
      registry.register('manager2', manager2);

      await registry.initializeAll({ skipValidation: true });
      const result = await registry.cleanupAll();

      expect(result.success).toBe(true);
      expect(result.cleaned.length).toBe(2);
      expect(manager1.initialized).toBe(false);
      expect(manager2.initialized).toBe(false);
    });

    it('should cleanup in reverse order (LIFO)', async () => {
      const registry = new ManagerRegistry({
        initializationOrder: ['manager1', 'manager2']
      });

      const cleanupOrder = [];

      class TrackingManager extends TestManager {
        async _baseCleanup() {
          cleanupOrder.push(this.name);
          await super._baseCleanup();
        }
      }

      registry.register('manager1', new TrackingManager('Manager1'));
      registry.register('manager2', new TrackingManager('Manager2'));

      await registry.initializeAll({ skipValidation: true });
      await registry.cleanupAll();

      expect(cleanupOrder).toEqual(['Manager2', 'Manager1']);
    });
  });

  describe('Health Monitoring', () => {
    it('should report health status', async () => {
      const registry = new ManagerRegistry();
      registry.register('manager1', new TestManager('Manager1'));
      registry.register('manager2', new TestManager('Manager2'));

      await registry.initializeAll({ skipValidation: true });

      const health = registry.getHealthStatus();

      expect(health.managers).toBeDefined();
      expect(health.summary).toBeDefined();
      expect(health.overallHealth).toBeDefined();
    });

    it('should report healthy when all ready', async () => {
      const registry = new ManagerRegistry();
      registry.register('manager1', new TestManager('Manager1'));

      await registry.initializeAll();

      const health = registry.getHealthStatus();
      expect(health.overallHealth).toBe('healthy');
    });

    it('should get detailed status', async () => {
      const registry = new ManagerRegistry();
      registry.register('manager1', new TestManager('Manager1'));

      await registry.initializeAll();

      const status = registry.getDetailedStatus();

      expect(status.registry).toBeDefined();
      expect(status.registry.initialized).toBe(true);
      expect(status.managers).toBeDefined();
    });
  });
});

describe('Integration Tests', () => {
  it('should handle complete lifecycle with registry', async () => {
    const registry = new ManagerRegistry();

    registry.register('manager1', new TestManager('Manager1'));
    registry.register('manager2', new TestManager('Manager2'));

    // Initialize all
    let result = await registry.initializeAll();
    expect(result.success).toBe(true);

    // Check health
    const health = registry.getHealthStatus();
    expect(health.overallHealth).toBe('healthy');

    // Cleanup all
    result = await registry.cleanupAll();
    expect(result.success).toBe(true);

    expect(registry.getManager('manager1').initialized).toBe(false);
    expect(registry.getManager('manager2').initialized).toBe(false);
  });

  it('should handle errors gracefully', async () => {
    const registry = new ManagerRegistry();

    class FailingManager extends BaseManager {
      async _baseInitialize() {
        throw new Error('Intentional failure');
      }
    }

    registry.register('failing', new FailingManager('Failing'));
    registry.register('working', new TestManager('Working'));

    const result = await registry.initializeAll({
      continueOnError: false
    });

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
