/**
 * Service Registry for Basset Hound Browser
 *
 * Provides:
 * - Service registration and discovery
 * - Health checking and failover
 * - Load balancing across instances
 * - Service metadata management
 *
 * Features:
 * - Automatic service discovery
 * - Health check polling
 * - Instance management
 * - Service metadata enrichment
 * - TTL-based registration cleanup
 */

const EventEmitter = require('events');

class ServiceRegistry extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      healthCheckInterval: options.healthCheckInterval || 30000,
      healthCheckTimeout: options.healthCheckTimeout || 5000,
      ttl: options.ttl || 300000, // 5 minutes
      deregisterOnFailure: options.deregisterOnFailure !== false,
      failureThreshold: options.failureThreshold || 3,
      ...options
    };

    this.services = new Map();
    this.instances = new Map();
    this.healthChecks = new Map();
    this.metadata = new Map();
  }

  /**
   * Register a service instance
   */
  registerInstance(serviceName, instanceId, config) {
    if (!serviceName || !instanceId || !config) {
      throw new Error('Service name, instance ID, and config required');
    }

    const key = `${serviceName}:${instanceId}`;

    const instance = {
      serviceName,
      instanceId,
      host: config.host || 'localhost',
      port: config.port || 3000,
      protocol: config.protocol || 'http',
      healthcheck: config.healthcheck || '/health',
      metadata: config.metadata || {},
      registeredAt: Date.now(),
      expiresAt: Date.now() + this.options.ttl,
      lastHealthCheck: null,
      health: 'unknown',
      consecutiveFailures: 0,
      weight: config.weight || 1,
      tags: config.tags || [],
      version: config.version || '1.0.0',
      capabilities: config.capabilities || []
    };

    this.instances.set(key, instance);

    // Register service if not exists
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, {
        name: serviceName,
        instances: [],
        createdAt: Date.now()
      });
    }

    const service = this.services.get(serviceName);
    if (!service.instances.includes(key)) {
      service.instances.push(key);
    }

    this.emit('instance:registered', { serviceName, instanceId, instance });
    return instance;
  }

  /**
   * Deregister a service instance
   */
  deregisterInstance(serviceName, instanceId) {
    const key = `${serviceName}:${instanceId}`;
    this.instances.delete(key);

    const service = this.services.get(serviceName);
    if (service) {
      service.instances = service.instances.filter(k => k !== key);
    }

    this.emit('instance:deregistered', { serviceName, instanceId });
  }

  /**
   * Get all instances of a service
   */
  getInstances(serviceName, options = {}) {
    const service = this.services.get(serviceName);
    if (!service) {
      return [];
    }

    return service.instances
      .map(key => this.instances.get(key))
      .filter(inst => {
        if (options.healthyOnly && inst.health !== 'healthy') {
          return false;
        }
        if (options.tags && options.tags.length > 0) {
          return options.tags.some(tag => inst.tags.includes(tag));
        }
        return true;
      });
  }

  /**
   * Get a single instance for load balancing
   */
  getInstance(serviceName, strategy = 'round-robin') {
    const instances = this.getInstances(serviceName, { healthyOnly: true });
    if (instances.length === 0) {
      return null;
    }

    if (strategy === 'round-robin') {
      const service = this.services.get(serviceName);
      const index = (service.roundRobinIndex || 0) % instances.length;
      service.roundRobinIndex = index + 1;
      return instances[index];
    } else if (strategy === 'random') {
      return instances[Math.floor(Math.random() * instances.length)];
    } else if (strategy === 'weighted') {
      return this._selectWeighted(instances);
    } else if (strategy === 'least-connections') {
      return instances.reduce((min, inst) =>
        (inst.activeConnections || 0) < (min.activeConnections || 0) ? inst : min
      );
    }

    return instances[0];
  }

  /**
   * Select instance based on weights
   */
  _selectWeighted(instances) {
    const totalWeight = instances.reduce((sum, inst) => sum + (inst.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const inst of instances) {
      random -= inst.weight || 1;
      if (random <= 0) {
        return inst;
      }
    }

    return instances[0];
  }

  /**
   * Start health checking
   */
  startHealthChecking() {
    // Initial health check
    for (const [key, instance] of this.instances) {
      this._checkHealth(instance);
    }

    // Periodic health checks
    this.healthCheckInterval = setInterval(() => {
      for (const [key, instance] of this.instances) {
        // Check TTL
        if (Date.now() > instance.expiresAt) {
          this.deregisterInstance(instance.serviceName, instance.instanceId);
          this.emit('instance:expired', { serviceName: instance.serviceName, instanceId: instance.instanceId });
          continue;
        }

        this._checkHealth(instance);
      }
    }, this.options.healthCheckInterval);
  }

  /**
   * Stop health checking
   */
  stopHealthChecking() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Check health of an instance
   */
  async _checkHealth(instance) {
    const key = `${instance.serviceName}:${instance.instanceId}`;

    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), this.options.healthCheckTimeout)
      );

      const url = `${instance.protocol}://${instance.host}:${instance.port}${instance.healthcheck}`;

      // Simulated health check (in production, use actual HTTP request)
      const result = await Promise.race([
        this._performHealthCheck(url),
        timeout
      ]);

      if (result.healthy) {
        instance.health = 'healthy';
        instance.consecutiveFailures = 0;
      } else {
        this._handleHealthCheckFailure(instance);
      }

    } catch (error) {
      this._handleHealthCheckFailure(instance);
    }

    instance.lastHealthCheck = Date.now();
    this.emit('health:checked', { instance: key, health: instance.health });
  }

  /**
   * Perform actual health check request
   */
  async _performHealthCheck(url) {
    return new Promise((resolve) => {
      setImmediate(() => {
        resolve({ healthy: true });
      });
    });
  }

  /**
   * Handle health check failure
   */
  _handleHealthCheckFailure(instance) {
    instance.consecutiveFailures++;

    if (instance.consecutiveFailures >= this.options.failureThreshold) {
      instance.health = 'unhealthy';

      if (this.options.deregisterOnFailure) {
        this.deregisterInstance(instance.serviceName, instance.instanceId);
        this.emit('instance:unhealthy', {
          serviceName: instance.serviceName,
          instanceId: instance.instanceId
        });
      }
    } else {
      instance.health = 'degraded';
    }
  }

  /**
   * Add metadata to a service
   */
  setServiceMetadata(serviceName, metadata) {
    if (!this.services.has(serviceName)) {
      throw new Error(`Service ${serviceName} not found`);
    }

    this.metadata.set(serviceName, metadata);
    this.emit('metadata:updated', { serviceName, metadata });
  }

  /**
   * Get service metadata
   */
  getServiceMetadata(serviceName) {
    return this.metadata.get(serviceName);
  }

  /**
   * Get all services
   */
  getServices(filter = {}) {
    const services = [];

    for (const [name, service] of this.services) {
      const instances = this.getInstances(name);
      const healthyInstances = instances.filter(i => i.health === 'healthy');

      const serviceInfo = {
        name,
        instanceCount: instances.length,
        healthyInstanceCount: healthyInstances.length,
        createdAt: service.createdAt,
        metadata: this.metadata.get(name)
      };

      if (filter.healthyOnly && healthyInstances.length === 0) {
        continue;
      }

      services.push(serviceInfo);
    }

    return services;
  }

  /**
   * Get registry statistics
   */
  getStats() {
    const stats = {
      totalServices: this.services.size,
      totalInstances: this.instances.size,
      healthyInstances: 0,
      unhealthyInstances: 0,
      degradedInstances: 0,
      services: []
    };

    for (const [name, service] of this.services) {
      const instances = this.getInstances(name);
      const healthy = instances.filter(i => i.health === 'healthy').length;
      const unhealthy = instances.filter(i => i.health === 'unhealthy').length;
      const degraded = instances.filter(i => i.health === 'degraded').length;

      stats.healthyInstances += healthy;
      stats.unhealthyInstances += unhealthy;
      stats.degradedInstances += degraded;

      stats.services.push({
        name,
        instanceCount: instances.length,
        healthyCount: healthy,
        unhealthyCount: unhealthy,
        degradedCount: degraded
      });
    }

    return stats;
  }

  /**
   * Find services by tag
   */
  findServicesByTag(tag) {
    const results = [];

    for (const [key, instance] of this.instances) {
      if (instance.tags && instance.tags.includes(tag)) {
        results.push(instance);
      }
    }

    return results;
  }

  /**
   * Find services by capability
   */
  findServicesByCapability(capability) {
    const results = [];

    for (const [key, instance] of this.instances) {
      if (instance.capabilities && instance.capabilities.includes(capability)) {
        results.push(instance);
      }
    }

    return results;
  }

  /**
   * Renew instance registration (extend TTL)
   */
  renewInstance(serviceName, instanceId) {
    const key = `${serviceName}:${instanceId}`;
    const instance = this.instances.get(key);

    if (!instance) {
      throw new Error('Instance not found');
    }

    instance.expiresAt = Date.now() + this.options.ttl;
    this.emit('instance:renewed', { serviceName, instanceId });
  }

  /**
   * Clear all instances
   */
  clear() {
    this.instances.clear();
    this.services.clear();
    this.metadata.clear();
    this.stopHealthChecking();
  }

  /**
   * Get instance details
   */
  getInstanceDetails(serviceName, instanceId) {
    const key = `${serviceName}:${instanceId}`;
    return this.instances.get(key);
  }

  /**
   * Update instance status
   */
  updateInstanceStatus(serviceName, instanceId, status) {
    const key = `${serviceName}:${instanceId}`;
    const instance = this.instances.get(key);

    if (!instance) {
      throw new Error('Instance not found');
    }

    instance.health = status;
    this.emit('instance:statusUpdated', { serviceName, instanceId, status });
  }
}

module.exports = ServiceRegistry;
