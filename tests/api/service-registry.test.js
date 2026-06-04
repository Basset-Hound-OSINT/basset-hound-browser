/**
 * Service Registry Tests
 * Tests for service registration, discovery, and health checking
 */

const ServiceRegistry = require('../../src/api/service-registry');

describe('ServiceRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new ServiceRegistry({
      healthCheckInterval: 100,
      healthCheckTimeout: 5000
    });
  });

  afterEach(() => {
    registry.clear();
  });

  describe('Instance Registration', () => {
    test('should register an instance', () => {
      const instance = registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      expect(instance.serviceName).toBe('user-service');
      expect(instance.instanceId).toBe('instance-1');
      expect(instance.host).toBe('localhost');
      expect(instance.port).toBe(3001);
    });

    test('should require all parameters', () => {
      expect(() => registry.registerInstance()).toThrow();
      expect(() => registry.registerInstance('service')).toThrow();
      expect(() => registry.registerInstance('service', 'instance')).toThrow();
    });

    test('should create service automatically', () => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      expect(registry.services.has('user-service')).toBe(true);
    });

    test('should register multiple instances', () => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      registry.registerInstance('user-service', 'instance-2', {
        host: 'localhost',
        port: 3002
      });

      const instances = registry.getInstances('user-service');
      expect(instances.length).toBe(2);
    });

    test('should set instance metadata', () => {
      const instance = registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001,
        metadata: { region: 'us-east-1', version: '1.0.0' }
      });

      expect(instance.metadata.region).toBe('us-east-1');
      expect(instance.metadata.version).toBe('1.0.0');
    });

    test('should set instance tags', () => {
      const instance = registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001,
        tags: ['primary', 'production']
      });

      expect(instance.tags).toContain('primary');
      expect(instance.tags).toContain('production');
    });

    test('should set instance capabilities', () => {
      const instance = registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001,
        capabilities: ['authentication', 'authorization']
      });

      expect(instance.capabilities).toContain('authentication');
    });
  });

  describe('Instance Deregistration', () => {
    test('should deregister an instance', () => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      registry.deregisterInstance('user-service', 'instance-1');

      const instances = registry.getInstances('user-service');
      expect(instances.length).toBe(0);
    });

    test('should emit deregistration event', (done) => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      registry.on('instance:deregistered', (data) => {
        expect(data.serviceName).toBe('user-service');
        expect(data.instanceId).toBe('instance-1');
        done();
      });

      registry.deregisterInstance('user-service', 'instance-1');
    });
  });

  describe('Instance Discovery', () => {
    test('should get all instances of a service', () => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      registry.registerInstance('user-service', 'instance-2', {
        host: 'localhost',
        port: 3002
      });

      const instances = registry.getInstances('user-service');
      expect(instances.length).toBe(2);
    });

    test('should return empty array for unknown service', () => {
      const instances = registry.getInstances('unknown-service');
      expect(instances.length).toBe(0);
    });

    test('should filter by healthy instances', () => {
      const inst1 = registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      const inst2 = registry.registerInstance('user-service', 'instance-2', {
        host: 'localhost',
        port: 3002
      });

      inst1.health = 'unhealthy';
      inst2.health = 'healthy';

      const instances = registry.getInstances('user-service', { healthyOnly: true });
      expect(instances.length).toBe(1);
      expect(instances[0].instanceId).toBe('instance-2');
    });

    test('should filter by tags', () => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001,
        tags: ['primary']
      });

      registry.registerInstance('user-service', 'instance-2', {
        host: 'localhost',
        port: 3002,
        tags: ['backup']
      });

      const instances = registry.getInstances('user-service', { tags: ['primary'] });
      expect(instances.length).toBe(1);
      expect(instances[0].instanceId).toBe('instance-1');
    });

    test('should find services by tag', () => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001,
        tags: ['critical']
      });

      registry.registerInstance('post-service', 'instance-2', {
        host: 'localhost',
        port: 3002,
        tags: ['critical']
      });

      const services = registry.findServicesByTag('critical');
      expect(services.length).toBe(2);
    });

    test('should find services by capability', () => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001,
        capabilities: ['auth']
      });

      registry.registerInstance('post-service', 'instance-2', {
        host: 'localhost',
        port: 3002,
        capabilities: ['auth', 'post-management']
      });

      const services = registry.findServicesByCapability('auth');
      expect(services.length).toBe(2);
    });
  });

  describe('Load Balancing', () => {
    test('should get instance with round-robin strategy', () => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      registry.registerInstance('user-service', 'instance-2', {
        host: 'localhost',
        port: 3002
      });

      const inst1 = registry.getInstance('user-service', 'round-robin');
      const inst2 = registry.getInstance('user-service', 'round-robin');
      const inst3 = registry.getInstance('user-service', 'round-robin');

      expect(inst1.instanceId).not.toBe(inst2.instanceId);
      expect(inst3.instanceId).toBe(inst1.instanceId); // Should wrap around
    });

    test('should get instance with random strategy', () => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      registry.registerInstance('user-service', 'instance-2', {
        host: 'localhost',
        port: 3002
      });

      const instances = new Set();
      for (let i = 0; i < 10; i++) {
        const inst = registry.getInstance('user-service', 'random');
        instances.add(inst.instanceId);
      }

      expect(instances.size).toBeGreaterThan(1); // Should select different instances
    });

    test('should get instance with weighted strategy', () => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001,
        weight: 3
      });

      registry.registerInstance('user-service', 'instance-2', {
        host: 'localhost',
        port: 3002,
        weight: 1
      });

      const instances = new Map();
      for (let i = 0; i < 100; i++) {
        const inst = registry.getInstance('user-service', 'weighted');
        instances.set(inst.instanceId, (instances.get(inst.instanceId) || 0) + 1);
      }

      const inst1Count = instances.get('instance-1') || 0;
      const inst2Count = instances.get('instance-2') || 0;

      // instance-1 should be selected ~3x more than instance-2
      expect(inst1Count).toBeGreaterThan(inst2Count);
    });

    test('should return null if no healthy instances', () => {
      const inst = registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      inst.health = 'unhealthy';

      const selected = registry.getInstance('user-service');
      expect(selected).toBeNull();
    });
  });

  describe('Service Metadata', () => {
    test('should set service metadata', () => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      registry.setServiceMetadata('user-service', { version: '1.0.0', region: 'us-east' });

      const metadata = registry.getServiceMetadata('user-service');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.region).toBe('us-east');
    });

    test('should throw error for unknown service', () => {
      expect(() => {
        registry.setServiceMetadata('unknown', {});
      }).toThrow();
    });
  });

  describe('Instance Renewal', () => {
    test('should renew instance registration', () => {
      const instance = registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      const originalExpiry = instance.expiresAt;

      registry.renewInstance('user-service', 'instance-1');

      expect(instance.expiresAt).toBeGreaterThan(originalExpiry);
    });

    test('should throw error for unknown instance', () => {
      expect(() => {
        registry.renewInstance('unknown', 'instance-1');
      }).toThrow();
    });
  });

  describe('Statistics', () => {
    test('should get registry statistics', () => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      registry.registerInstance('post-service', 'instance-1', {
        host: 'localhost',
        port: 3002
      });

      const stats = registry.getStats();

      expect(stats.totalServices).toBe(2);
      expect(stats.totalInstances).toBe(2);
      expect(stats.services.length).toBe(2);
    });

    test('should track instance health in statistics', () => {
      const inst1 = registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      const inst2 = registry.registerInstance('user-service', 'instance-2', {
        host: 'localhost',
        port: 3002
      });

      inst1.health = 'healthy';
      inst2.health = 'unhealthy';

      const stats = registry.getStats();

      expect(stats.healthyInstances).toBe(1);
      expect(stats.unhealthyInstances).toBe(1);
    });

    test('should get services with filter', () => {
      const inst1 = registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      const inst2 = registry.registerInstance('post-service', 'instance-1', {
        host: 'localhost',
        port: 3002
      });

      inst1.health = 'healthy';
      inst2.health = 'unhealthy';

      const services = registry.getServices({ healthyOnly: true });

      expect(services.length).toBe(1);
      expect(services[0].name).toBe('user-service');
    });
  });

  describe('Health Checking', () => {
    test('should start health checking', () => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      registry.startHealthChecking();
      expect(registry.healthCheckInterval).toBeDefined();

      registry.stopHealthChecking();
    });

    test('should stop health checking', () => {
      registry.startHealthChecking();
      registry.stopHealthChecking();

      expect(registry.healthCheckInterval).toBeNull();
    });

    test('should deregister unhealthy instances', (done) => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      registry.on('instance:unhealthy', (data) => {
        expect(data.serviceName).toBe('user-service');
        done();
      });

      const instance = registry.instances.get('user-service:instance-1');
      instance.consecutiveFailures = 3;
      registry._handleHealthCheckFailure(instance);
    });
  });

  describe('Events', () => {
    test('should emit instance registered event', (done) => {
      registry.on('instance:registered', (data) => {
        expect(data.serviceName).toBe('user-service');
        expect(data.instanceId).toBe('instance-1');
        done();
      });

      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });
    });

    test('should emit metadata updated event', (done) => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      registry.on('metadata:updated', (data) => {
        expect(data.serviceName).toBe('user-service');
        done();
      });

      registry.setServiceMetadata('user-service', { version: '1.0.0' });
    });
  });

  describe('Instance Details', () => {
    test('should get instance details', () => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001,
        metadata: { region: 'us-east' }
      });

      const instance = registry.getInstanceDetails('user-service', 'instance-1');

      expect(instance.host).toBe('localhost');
      expect(instance.port).toBe(3001);
      expect(instance.metadata.region).toBe('us-east');
    });

    test('should update instance status', () => {
      registry.registerInstance('user-service', 'instance-1', {
        host: 'localhost',
        port: 3001
      });

      registry.updateInstanceStatus('user-service', 'instance-1', 'unhealthy');

      const instance = registry.getInstanceDetails('user-service', 'instance-1');
      expect(instance.health).toBe('unhealthy');
    });
  });
});
