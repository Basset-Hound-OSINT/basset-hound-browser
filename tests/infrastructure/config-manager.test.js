/**
 * Configuration Manager Tests
 *
 * Tests for:
 * - Configuration file loading
 * - Environment variable overrides
 * - Schema validation
 * - Hot reloading
 * - Configuration access and updates
 */

const ConfigManager = require('../../src/infrastructure/config-manager');
const fs = require('fs');
const path = require('path');

describe('ConfigManager', () => {
  let manager;
  const testConfigDir = path.join(__dirname, 'test-configs');

  beforeEach(() => {
    manager = new ConfigManager(testConfigDir);

    // Create test config directory if it doesn't exist
    if (!fs.existsSync(testConfigDir)) {
      fs.mkdirSync(testConfigDir, { recursive: true });
    }
  });

  afterEach(() => {
    manager.shutdown();

    // Clean up test config directory
    try {
      const files = fs.readdirSync(testConfigDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testConfigDir, file));
      });
      fs.rmdirSync(testConfigDir);
    } catch (err) {
      // Ignore
    }
  });

  describe('Initialization', () => {
    test('should initialize with default config directory', () => {
      const m = new ConfigManager();

      expect(m.configDir).toBe('./config');
    });

    test('should accept custom config directory', () => {
      expect(manager.configDir).toBe(testConfigDir);
    });
  });

  describe('Configuration Loading', () => {
    test('should load configuration from JSON files', async () => {
      const testConfig = {
        host: 'localhost',
        port: 5432,
      };

      fs.writeFileSync(
        path.join(testConfigDir, 'database.json'),
        JSON.stringify(testConfig)
      );

      await manager.loadConfig();

      expect(manager.config.database).toBeDefined();
      expect(manager.config.database.host).toBe('localhost');
      expect(manager.config.database.port).toBe(5432);
    });

    test('should load multiple config files', async () => {
      fs.writeFileSync(
        path.join(testConfigDir, 'database.json'),
        JSON.stringify({ host: 'localhost' })
      );

      fs.writeFileSync(
        path.join(testConfigDir, 'redis.json'),
        JSON.stringify({ port: 6379 })
      );

      await manager.loadConfig();

      expect(manager.config.database).toBeDefined();
      expect(manager.config.redis).toBeDefined();
    });

    test('should set isInitialized flag', async () => {
      expect(manager.isInitialized).toBe(false);

      await manager.loadConfig();

      expect(manager.isInitialized).toBe(true);
    });

    test('should emit config:ready event', (done) => {
      manager.on('config:ready', () => {
        done();
      });

      manager.loadConfig();
    });
  });

  describe('Schema Validation', () => {
    test('should register a schema', () => {
      manager.registerSchema('database', {
        host: { type: 'string', required: true },
        port: { type: 'number', required: true },
      });

      expect(manager.schemas.database).toBeDefined();
    });

    test('should validate configuration against schema', async () => {
      manager.registerSchema('database', {
        host: { type: 'string', required: true },
        port: { type: 'number', required: true },
      });

      const validConfig = {
        host: 'localhost',
        port: 5432,
      };

      const result = manager.validateConfig('database', validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('should detect required field missing', () => {
      manager.registerSchema('database', {
        host: { type: 'string', required: true },
      });

      const invalidConfig = {};

      const result = manager.validateConfig('database', invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should detect type mismatch', () => {
      manager.registerSchema('database', {
        port: { type: 'number' },
      });

      const invalidConfig = {
        port: 'not a number',
      };

      const result = manager.validateConfig('database', invalidConfig);

      expect(result.valid).toBe(false);
    });

    test('should validate enum values', () => {
      manager.registerSchema('app', {
        environment: { type: 'string', enum: ['dev', 'prod'] },
      });

      const validConfig = { environment: 'dev' };
      const invalidConfig = { environment: 'invalid' };

      expect(manager.validateConfig('app', validConfig).valid).toBe(true);
      expect(manager.validateConfig('app', invalidConfig).valid).toBe(false);
    });

    test('should validate min/max values', () => {
      manager.registerSchema('server', {
        port: { type: 'number', min: 1000, max: 65535 },
      });

      expect(manager.validateConfig('server', { port: 8000 }).valid).toBe(true);
      expect(manager.validateConfig('server', { port: 500 }).valid).toBe(false);
      expect(manager.validateConfig('server', { port: 70000 }).valid).toBe(false);
    });
  });

  describe('Environment Variable Overrides', () => {
    test('should apply environment variable overrides', async () => {
      process.env.BASSET_DATABASE_HOST = '"override-host"';

      fs.writeFileSync(
        path.join(testConfigDir, 'database.json'),
        JSON.stringify({ host: 'localhost' })
      );

      await manager.loadConfig();

      expect(manager.config.database.host).toBe('override-host');

      delete process.env.BASSET_DATABASE_HOST;
    });

    test('should parse JSON environment variables', async () => {
      process.env.BASSET_REDIS_PORT = '6380';

      fs.writeFileSync(
        path.join(testConfigDir, 'redis.json'),
        JSON.stringify({ port: 6379 })
      );

      await manager.loadConfig();

      expect(manager.config.redis.port).toBe(6380);

      delete process.env.BASSET_REDIS_PORT;
    });
  });

  describe('Configuration Access', () => {
    test('should get configuration value', async () => {
      fs.writeFileSync(
        path.join(testConfigDir, 'database.json'),
        JSON.stringify({ host: 'localhost', port: 5432 })
      );

      await manager.loadConfig();

      expect(manager.get('database.host')).toBe('localhost');
      expect(manager.get('database.port')).toBe(5432);
    });

    test('should return default value if key not found', async () => {
      await manager.loadConfig();

      expect(manager.get('nonexistent', 'default')).toBe('default');
    });

    test('should get entire configuration section', async () => {
      fs.writeFileSync(
        path.join(testConfigDir, 'database.json'),
        JSON.stringify({ host: 'localhost', port: 5432 })
      );

      await manager.loadConfig();

      const dbConfig = manager.getSection('database');

      expect(dbConfig.host).toBe('localhost');
      expect(dbConfig.port).toBe(5432);
    });

    test('should get all configuration', async () => {
      fs.writeFileSync(
        path.join(testConfigDir, 'database.json'),
        JSON.stringify({ host: 'localhost' })
      );

      await manager.loadConfig();

      const allConfig = manager.getAll();

      expect(allConfig.database).toBeDefined();
    });
  });

  describe('Configuration Updates', () => {
    test('should set a configuration value', async () => {
      await manager.loadConfig();

      manager.set('app.debug', true);

      expect(manager.get('app.debug')).toBe(true);
    });

    test('should create nested paths when setting', async () => {
      await manager.loadConfig();

      manager.set('new.nested.path.value', 'test');

      expect(manager.get('new.nested.path.value')).toBe('test');
    });

    test('should emit config:changed event', (done) => {
      manager.on('config:changed', (data) => {
        expect(data.path).toBe('test.key');
        expect(data.newValue).toBe('new_value');
        done();
      });

      manager.config = {};
      manager.isInitialized = true;
      manager.set('test.key', 'new_value');
    });
  });

  describe('Health Status', () => {
    test('should report health status', async () => {
      fs.writeFileSync(
        path.join(testConfigDir, 'database.json'),
        JSON.stringify({ host: 'localhost' })
      );

      await manager.loadConfig();

      const health = manager.getHealthStatus();

      expect(health.isInitialized).toBe(true);
      expect(health.configCount).toBe(1);
    });

    test('should list watching files', (done) => {
      fs.writeFileSync(
        path.join(testConfigDir, 'test.json'),
        JSON.stringify({ value: 1 })
      );

      manager.loadConfig().then(() => {
        manager.watchFile('test');

        const health = manager.getHealthStatus();

        expect(health.watchingFiles.includes('test')).toBe(true);

        manager.unwatchFile('test');
        done();
      });
    });
  });

  describe('Shutdown', () => {
    test('should clean up watchers on shutdown', () => {
      fs.writeFileSync(
        path.join(testConfigDir, 'test.json'),
        JSON.stringify({ value: 1 })
      );

      manager.loadConfig().then(() => {
        manager.watchFile('test');

        expect(manager.watchers.size).toBeGreaterThan(0);

        manager.shutdown();

        expect(manager.watchers.size).toBe(0);
      });
    });
  });
});
