/**
 * Infrastructure Bootstrap Module
 *
 * Initializes and wires together all infrastructure components in the correct order.
 * Ensures proper error handling, health checks, and graceful shutdown.
 */

const LoadBalancer = require('./load-balancer');
const RedisManager = require('./redis-manager');
const SessionStore = require('./session-store');
const DbPool = require('./db-pool');
const Migrations = require('./migrations');
const ConfigManager = require('./config-manager');
const HealthChecker = require('./health-checks');
const MetricsCollector = require('./metrics');

class InfrastructureBootstrap {
  constructor(configPath = './config', options = {}) {
    this.configPath = configPath;
    this.options = {
      initializeDb: true,
      initializeRedis: true,
      initializeLoadBalancer: true,
      initializeHealthChecks: true,
      initializeMetrics: true,
      autoMigrate: true,
      ...options
    };

    // Component instances
    this.components = {
      configManager: null,
      dbPool: null,
      redisManager: null,
      sessionStore: null,
      loadBalancer: null,
      healthChecker: null,
      metricsCollector: null
    };

    this.isInitialized = false;
    this.shutdownHandlers = [];
    this.logger = options.logger || console;
  }

  /**
   * Initialize all infrastructure components in order
   */
  async initialize() {
    this.logger.log('[Infrastructure] Starting bootstrap...');
    const startTime = Date.now();

    try {
      // 1. Load configuration
      await this._initializeConfig();

      // 2. Initialize database
      if (this.options.initializeDb) {
        await this._initializeDatabase();
      }

      // 3. Initialize Redis
      if (this.options.initializeRedis) {
        await this._initializeRedis();
      }

      // 4. Initialize session store (depends on Redis + DB)
      await this._initializeSessionStore();

      // 5. Initialize metrics
      if (this.options.initializeMetrics) {
        this._initializeMetrics();
      }

      // 6. Initialize health checks (depends on all components)
      if (this.options.initializeHealthChecks) {
        await this._initializeHealthChecks();
      }

      // 7. Initialize load balancer (last, depends on health checks)
      if (this.options.initializeLoadBalancer) {
        await this._initializeLoadBalancer();
      }

      // Register shutdown handlers
      this._registerShutdownHandlers();

      this.isInitialized = true;
      const duration = Date.now() - startTime;
      this.logger.log(`[Infrastructure] Bootstrap complete in ${duration}ms`);

      return {
        success: true,
        components: this.components,
        duration,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('[Infrastructure] Bootstrap failed:', error.message);
      await this.shutdown();
      throw error;
    }
  }

  /**
   * Initialize configuration manager
   */
  async _initializeConfig() {
    this.logger.log('[Infrastructure] Initializing configuration...');

    const configManager = new ConfigManager(this.configPath);

    // Register schemas
    configManager.registerSchema('database', {
      host: { type: 'string', required: true },
      port: { type: 'number', required: true, min: 1000, max: 65535 },
      database: { type: 'string', required: true },
      user: { type: 'string', required: true },
      password: { type: 'string', required: true },
      minConnections: { type: 'number', min: 1, max: 100 },
      maxConnections: { type: 'number', min: 1, max: 500 }
    });

    configManager.registerSchema('redis', {
      sentinels: { type: 'array', required: true },
      name: { type: 'string', required: true },
      sessionTTL: { type: 'number', min: 60, max: 2592000 }
    });

    configManager.registerSchema('load-balancer', {
      port: { type: 'number', required: true, min: 1000, max: 65535 },
      host: { type: 'string', required: false },
      backends: { type: 'array', required: false },
      algorithm: { type: 'string', enum: ['roundrobin', 'leastconn', 'random'] }
    });

    configManager.registerSchema('health-check', {
      checkInterval: { type: 'number', min: 1000, max: 60000 },
      memoryThreshold: { type: 'number', min: 0, max: 1 },
      diskThreshold: { type: 'number', min: 0, max: 1 }
    });

    await configManager.loadConfig();
    this.components.configManager = configManager;

    this.logger.log('[Infrastructure] Configuration loaded successfully');
  }

  /**
   * Initialize database pool and run migrations
   */
  async _initializeDatabase() {
    this.logger.log('[Infrastructure] Initializing database...');

    const dbConfig = this.components.configManager.getSection('database') || {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'basset_hound',
      user: process.env.DB_USER || 'basset',
      password: process.env.DB_PASSWORD || 'password',
      minConnections: 5,
      maxConnections: 20
    };

    const dbPool = new DbPool(dbConfig);
    await dbPool.connect();
    this.components.dbPool = dbPool;

    this.logger.log('[Infrastructure] Database connected');

    // Run migrations
    if (this.options.autoMigrate) {
      this.logger.log('[Infrastructure] Running migrations...');
      const migrations = new Migrations(dbPool);
      migrations.initializeDefaultMigrations();
      await migrations.runMigrations();
      this.logger.log('[Infrastructure] Migrations complete');
    }
  }

  /**
   * Initialize Redis manager
   */
  async _initializeRedis() {
    this.logger.log('[Infrastructure] Initializing Redis...');

    const redisConfig = this.components.configManager.getSection('redis') || {
      sentinels: [{ host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '26379') }],
      name: process.env.REDIS_SENTINEL_NAME || 'mymaster',
      sessionTTL: 86400
    };

    const redisManager = new RedisManager(redisConfig);
    await redisManager.connect();
    this.components.redisManager = redisManager;

    this.logger.log('[Infrastructure] Redis connected');
  }

  /**
   * Initialize session store
   */
  async _initializeSessionStore() {
    this.logger.log('[Infrastructure] Initializing session store...');

    const sessionStore = new SessionStore(
      this.components.redisManager,
      this.components.dbPool
    );

    this.components.sessionStore = sessionStore;
    this.logger.log('[Infrastructure] Session store initialized');
  }

  /**
   * Initialize metrics collector
   */
  _initializeMetrics() {
    this.logger.log('[Infrastructure] Initializing metrics...');

    const metricsCollector = new MetricsCollector();
    this.components.metricsCollector = metricsCollector;

    this.logger.log('[Infrastructure] Metrics collector initialized');
  }

  /**
   * Initialize health checks
   */
  async _initializeHealthChecks() {
    this.logger.log('[Infrastructure] Initializing health checks...');

    const healthConfig = this.components.configManager.getSection('health-check') || {
      checkInterval: 5000,
      memoryThreshold: 0.85,
      diskThreshold: 0.85
    };

    const healthChecker = new HealthChecker(healthConfig);

    // Register database health check
    if (this.components.dbPool) {
      healthChecker.registerComponent('database', async () => {
        try {
          await this.components.dbPool.query('SELECT 1');
          return { healthy: true };
        } catch (error) {
          return { healthy: false, error: error.message };
        }
      });
    }

    // Register Redis health check
    if (this.components.redisManager) {
      healthChecker.registerComponent('redis', async () => {
        try {
          await this.components.redisManager.execute('ping');
          return { healthy: true };
        } catch (error) {
          return { healthy: false, error: error.message };
        }
      });
    }

    // Start health checks
    healthChecker.startHealthChecks();
    this.components.healthChecker = healthChecker;

    this.logger.log('[Infrastructure] Health checks initialized');
  }

  /**
   * Initialize load balancer
   */
  async _initializeLoadBalancer() {
    this.logger.log('[Infrastructure] Initializing load balancer...');

    const lbConfig = this.components.configManager.getSection('load-balancer') || {
      port: 8765,
      host: '0.0.0.0',
      backends: [
        { host: '127.0.0.1', port: 9001 },
        { host: '127.0.0.1', port: 9002 }
      ],
      algorithm: 'roundrobin'
    };

    const loadBalancer = new LoadBalancer(lbConfig);
    await loadBalancer.start();
    this.components.loadBalancer = loadBalancer;

    this.logger.log('[Infrastructure] Load balancer started on port', lbConfig.port);
  }

  /**
   * Register process signal handlers for graceful shutdown
   */
  _registerShutdownHandlers() {
    const shutdown = async (signal) => {
      this.logger.log(`[Infrastructure] Received ${signal}, starting graceful shutdown...`);
      await this.shutdown();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Gracefully shutdown all components
   */
  async shutdown() {
    this.logger.log('[Infrastructure] Shutting down...');
    const startTime = Date.now();

    try {
      // Shutdown in reverse order of initialization

      // Load balancer
      if (this.components.loadBalancer) {
        this.logger.log('[Infrastructure] Shutting down load balancer...');
        await this.components.loadBalancer.shutdown();
      }

      // Health checks
      if (this.components.healthChecker) {
        this.logger.log('[Infrastructure] Stopping health checks...');
        this.components.healthChecker.stopHealthChecks();
      }

      // Session store (just dispose if needed)
      if (this.components.sessionStore) {
        this.logger.log('[Infrastructure] Closing session store...');
        // No explicit close needed for SessionStore
      }

      // Redis
      if (this.components.redisManager) {
        this.logger.log('[Infrastructure] Closing Redis connection...');
        await this.components.redisManager.disconnect();
      }

      // Database
      if (this.components.dbPool) {
        this.logger.log('[Infrastructure] Closing database connections...');
        await this.components.dbPool.shutdown();
      }

      const duration = Date.now() - startTime;
      this.logger.log(`[Infrastructure] Shutdown complete in ${duration}ms`);

      this.isInitialized = false;
    } catch (error) {
      this.logger.error('[Infrastructure] Error during shutdown:', error.message);
    }
  }

  /**
   * Get a component by name
   */
  getComponent(name) {
    return this.components[name] || null;
  }

  /**
   * Get all components
   */
  getComponents() {
    return { ...this.components };
  }

  /**
   * Get infrastructure status
   */
  async getStatus() {
    return {
      initialized: this.isInitialized,
      components: Object.keys(this.components).reduce((acc, key) => {
        acc[key] = this.components[key] !== null;
        return acc;
      }, {}),
      health: this.components.healthChecker ? await this.components.healthChecker.getFullHealthStatus() : null,
      metrics: this.components.metricsCollector ? this.components.metricsCollector.getSummary() : null
    };
  }
}

module.exports = InfrastructureBootstrap;
