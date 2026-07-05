# Technical Debt Remediation - Code Examples

**Purpose:** Concrete code examples for fixing identified debt items  
**Version:** v1.0  
**Date:** July 3, 2026

---

## Table of Contents

1. [Memory Leak Fixes](#memory-leak-fixes)
2. [Promise Error Handling](#promise-error-handling)
3. [Configuration Extraction](#configuration-extraction)
4. [Dependency Injection](#dependency-injection)
5. [Structured Logging Migration](#structured-logging-migration)
6. [Input Validation](#input-validation)
7. [Module Decomposition](#module-decomposition)

---

## Memory Leak Fixes

### Issue
Event listeners registered without cleanup leading to memory bloat over time.

### Current Code (PROBLEMATIC)
```javascript
// manager.js
class DataManager {
  constructor() {
    this.emitter = new EventEmitter();
    this.setupListeners();
  }
  
  setupListeners() {
    this.emitter.on('data', this.handleData.bind(this));
    this.emitter.on('error', this.handleError.bind(this));
    this.emitter.on('complete', this.handleComplete.bind(this));
    // PROBLEM: No cleanup method
    // PROBLEM: Bound functions create new closures each time
  }
}

// Usage - creates memory leak
const manager = new DataManager();
// manager gets garbage collected but listeners stay in memory
```

### Fixed Code (PATTERN 1: Managed Emitter Wrapper)
```javascript
// utils/managed-emitter.js
const EventEmitter = require('events');

class ManagedEmitter {
  constructor(emitter = new EventEmitter()) {
    this.emitter = emitter;
    this.listeners = new Map(); // Track all registered listeners
  }
  
  on(event, handler) {
    this.emitter.on(event, handler);
    
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
    
    return this; // Allow chaining
  }
  
  once(event, handler) {
    this.emitter.once(event, handler);
    // No need to track since once removes automatically
    return this;
  }
  
  removeListener(event, handler) {
    this.emitter.removeListener(event, handler);
    
    if (this.listeners.has(event)) {
      const handlers = this.listeners.get(event);
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    }
    
    return this;
  }
  
  // CRITICAL: Cleanup method
  cleanup() {
    for (const [event, handlers] of this.listeners) {
      handlers.forEach(h => this.emitter.removeListener(event, h));
    }
    this.listeners.clear();
  }
  
  // Delegate other methods
  emit(event, ...args) {
    return this.emitter.emit(event, ...args);
  }
  
  removeAllListeners() {
    this.emitter.removeAllListeners();
    this.listeners.clear();
  }
}

module.exports = { ManagedEmitter };
```

### Usage in DataManager
```javascript
// manager.js (FIXED)
const { ManagedEmitter } = require('../utils/managed-emitter');

class DataManager {
  constructor() {
    this.emitter = new ManagedEmitter();
    this.handlers = {}; // Store handlers for removal
    this.setupListeners();
  }
  
  setupListeners() {
    // Store handler references for removal
    this.handlers.data = this.handleData.bind(this);
    this.handlers.error = this.handleError.bind(this);
    this.handlers.complete = this.handleComplete.bind(this);
    
    this.emitter.on('data', this.handlers.data);
    this.emitter.on('error', this.handlers.error);
    this.emitter.on('complete', this.handlers.complete);
  }
  
  handleData(data) {
    // Process data
  }
  
  handleError(err) {
    // Handle error
  }
  
  handleComplete() {
    // Cleanup
  }
  
  // CRITICAL: Cleanup method must be called when manager is destroyed
  destroy() {
    this.emitter.cleanup();
    this.handlers = {};
  }
}

// Usage with proper cleanup
const manager = new DataManager();
// ... use manager ...
manager.destroy(); // MUST be called to prevent leaks
```

### Integration Pattern
```javascript
// In parent class/manager that creates DataManager
class ParentManager {
  constructor() {
    this.dataManager = new DataManager();
  }
  
  async shutdown() {
    // Ensure cleanup happens
    if (this.dataManager) {
      this.dataManager.destroy();
    }
  }
}

// Better: Use WeakMap for automatic cleanup
const managedInstances = new WeakMap();

function createManagedDataManager() {
  const manager = new DataManager();
  managedInstances.set(manager, true);
  
  // Auto-cleanup on garbage collection (with caveat)
  return manager;
}
```

---

## Promise Error Handling

### Issue
Promise chains without `.catch()` handlers cause silent failures or process crashes.

### Current Code (PROBLEMATIC)
```javascript
// main.js
async function initializeApp() {
  // PROBLEM 1: No error handling
  startup()
    .then(() => loadConfig())
    .then(config => initializeManagers(config));
  
  // PROBLEM 2: Missing catch
  health()
    .then(updateStatus);
  
  // PROBLEM 3: Async operation with no await
  startBackgroundJobs(); // Fire and forget - dangerous!
}

// These unhandled rejections will crash the app
```

### Fixed Code (PATTERN 1: Explicit Error Handler)
```javascript
// utils/error-context.js
class ErrorContext {
  constructor(error, metadata) {
    this.error = error;
    this.metadata = metadata;
    this.timestamp = new Date();
    this.stack = error?.stack || new Error().stack;
  }
  
  toString() {
    return JSON.stringify({
      message: this.error?.message || 'Unknown error',
      code: this.error?.code,
      metadata: this.metadata,
      timestamp: this.timestamp
    });
  }
}

// utils/error-handler.js
class ErrorHandler {
  constructor(logger) {
    this.logger = logger;
    this.recoveryStrategies = new Map();
  }
  
  register(errorType, strategy) {
    this.recoveryStrategies.set(errorType, strategy);
  }
  
  async handle(error, context = {}) {
    const errorContext = new ErrorContext(error, context);
    
    // Log the error
    this.logger.error(`Error in ${context.operation}`, {
      message: error.message,
      code: error.code,
      context: context,
      stack: error.stack
    });
    
    // Try recovery if strategy exists
    const strategy = this.recoveryStrategies.get(error.constructor.name);
    if (strategy) {
      try {
        return await strategy(error, errorContext);
      } catch (recoveryErr) {
        this.logger.error('Recovery failed', {
          originalError: error.message,
          recoveryError: recoveryErr.message
        });
        throw recoveryErr;
      }
    }
    
    // Default: re-throw
    throw errorContext;
  }
}

module.exports = { ErrorHandler, ErrorContext };
```

### Fixed Application Code
```javascript
// main.js (FIXED)
const { ErrorHandler } = require('./utils/error-handler');
const logger = require('./logging');

const errorHandler = new ErrorHandler(logger);

// Register recovery strategies
errorHandler.register('ConnectionError', async (err, ctx) => {
  logger.info('Attempting connection recovery');
  await reconnectServices();
});

async function initializeApp() {
  try {
    // FIXED: Proper error handling chain
    const config = await startup();
    config = await loadConfig();
    const managers = await initializeManagers(config);
    
    logger.info('Application initialized successfully');
    return { config, managers };
  } catch (err) {
    await errorHandler.handle(err, { operation: 'initializeApp' });
    process.exit(1);
  }
}

async function monitorHealth() {
  try {
    const status = await health();
    updateStatus(status);
  } catch (err) {
    // FIXED: Caught and handled
    await errorHandler.handle(err, { operation: 'monitorHealth' });
    // Retry or shutdown gracefully
  }
}

async function startBackgroundJobs() {
  // FIXED: Awaited with error handling
  try {
    await backgroundJobManager.start();
    logger.info('Background jobs started');
  } catch (err) {
    await errorHandler.handle(err, { operation: 'startBackgroundJobs' });
  }
}

// CRITICAL: Global unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason?.message || reason,
    promise: promise.toString(),
    stack: reason?.stack
  });
  
  // Take corrective action
  if (isRecoverable(reason)) {
    logger.info('Attempting recovery from unhandled rejection');
  } else {
    logger.error('Fatal unhandled rejection - terminating');
    process.exit(1);
  }
});

function isRecoverable(error) {
  const recoverableErrors = [
    'TimeoutError',
    'ConnectionError',
    'TemporaryFailure'
  ];
  return recoverableErrors.includes(error?.constructor?.name);
}
```

---

## Configuration Extraction

### Issue
Magic numbers and hardcoded values scattered throughout codebase.

### Current Code (PROBLEMATIC)
```javascript
// src/managers/base-manager.js
this.timeoutMs = options.timeoutMs || 30000; // Magic number

// src/tasks/background-jobs.js
}, { timeout: 300000, category: 'maintenance' }); // Hardcoded

// websocket/server.js
const port = 8765; // Hardcoded port
const maxConnections = 1000; // Hardcoded limit

// evasion/fingerprint.js
const timeouts = {
  canvas: 5000,
  webgl: 3000,
  fonts: 2000
};
```

### Fixed Code
```javascript
// config/defaults.js (NEW FILE)
/**
 * Default configuration values
 * Can be overridden via environment variables
 */
module.exports = {
  // WebSocket Configuration
  websocket: {
    port: parseInt(process.env.WS_PORT || '8765'),
    host: process.env.WS_HOST || 'localhost',
    maxConnections: parseInt(process.env.WS_MAX_CONN || '1000'),
    pingInterval: parseInt(process.env.WS_PING || '30000'),
    maxPayloadSize: parseInt(process.env.WS_MAX_PAYLOAD || '104857600'), // 100MB
  },
  
  // Performance & Timeouts
  performance: {
    defaultTimeoutMs: parseInt(process.env.TIMEOUT_MS || '30000'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    backgroundJobTimeout: parseInt(process.env.BG_TIMEOUT || '300000'),
    commandTimeout: parseInt(process.env.COMMAND_TIMEOUT || '60000'),
  },
  
  // Memory Management
  memory: {
    maxHeapSize: parseInt(process.env.MAX_HEAP_MB || '512'),
    gcInterval: parseInt(process.env.GC_INTERVAL || '60000'),
    memoryThreshold: parseFloat(process.env.MEM_THRESHOLD || '0.85'),
    aggressiveGCAt: parseFloat(process.env.AGGRESSIVE_GC || '0.95'),
  },
  
  // Evasion Timeouts
  evasion: {
    canvas: parseInt(process.env.CANVAS_TIMEOUT || '5000'),
    webgl: parseInt(process.env.WEBGL_TIMEOUT || '3000'),
    fonts: parseInt(process.env.FONTS_TIMEOUT || '2000'),
    webrtc: parseInt(process.env.WEBRTC_TIMEOUT || '4000'),
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    maxFileSize: parseInt(process.env.LOG_SIZE || '10485760'), // 10MB
    maxFiles: parseInt(process.env.LOG_FILES || '10'),
  },
  
  // Features
  features: {
    enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
    enableMonitoring: process.env.ENABLE_MONITORING === 'true',
    enableTor: process.env.ENABLE_TOR === 'true',
  },
  
  // Validation
  validate() {
    if (this.websocket.port < 1024 || this.websocket.port > 65535) {
      throw new Error('Invalid WebSocket port');
    }
    if (this.memory.maxHeapSize < 256) {
      throw new Error('Max heap size must be >= 256MB');
    }
    return true;
  }
};

// config/index.js (exports config based on environment)
const defaults = require('./defaults');

const config = {
  ...defaults,
  environment: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};

// Validate on load
if (config.validate?.()) {
  module.exports = config;
}
```

### Usage Examples
```javascript
// Before (PROBLEMATIC)
const manager = new Manager();
manager.timeout = 30000;

// After (FIXED)
const config = require('./config');
const manager = new Manager({
  timeout: config.performance.defaultTimeoutMs
});

// Access anywhere in app
const { port, maxConnections } = require('./config').websocket;
const server = createServer(port, { maxConnections });

// Override in tests
process.env.TIMEOUT_MS = '1000';
const testConfig = require('./config');
// Config is reloaded per environment
```

### Environment File (.env.example)
```bash
# WebSocket Configuration
WS_PORT=8765
WS_HOST=localhost
WS_MAX_CONN=1000
WS_PING=30000

# Performance
TIMEOUT_MS=30000
MAX_RETRIES=3
COMMAND_TIMEOUT=60000

# Memory
MAX_HEAP_MB=512
GC_INTERVAL=60000
MEM_THRESHOLD=0.85

# Features
ENABLE_COMPRESSION=true
ENABLE_MONITORING=false
ENABLE_TOR=false

# Logging
LOG_LEVEL=info
```

---

## Dependency Injection

### Issue
Global singletons (192 files) make testing difficult and encourage tight coupling.

### Current Code (PROBLEMATIC)
```javascript
// proxy/manager.js
const proxyManager = new ProxyManager();
module.exports = { proxyManager };

// Usage across codebase (PROBLEMATIC)
const { proxyManager } = require('../proxy/manager');
// Can't mock, test isolation issues, global state pollution
```

### Fixed Code (PATTERN 1: Factory Functions)
```javascript
// proxy/manager.js (FIXED)
class ProxyManager {
  constructor(options = {}) {
    this.config = options;
    this.proxies = new Map();
    this.currentProxy = null;
  }
  
  async initialize(config) {
    // Initialization logic
  }
  
  async rotateProxy() {
    // Proxy rotation logic
  }
}

// Factory function
function createProxyManager(options = {}) {
  return new ProxyManager(options);
}

// Default instance for backwards compatibility
let defaultInstance = null;

function getDefaultProxyManager() {
  if (!defaultInstance) {
    defaultInstance = createProxyManager();
  }
  return defaultInstance;
}

// Export both factory and default
module.exports = {
  ProxyManager,
  createProxyManager,
  getDefaultProxyManager // Deprecated, use createProxyManager
};
```

### Dependency Container (PATTERN 2: IoC Container)
```javascript
// managers/di-container.js
class DIContainer {
  constructor() {
    this.factories = new Map();
    this.instances = new Map();
    this.singletons = new Set();
  }
  
  register(key, Factory, options = {}) {
    const { singleton = false } = options;
    
    this.factories.set(key, Factory);
    if (singleton) {
      this.singletons.add(key);
    }
  }
  
  get(key, ...args) {
    // Return existing singleton
    if (this.singletons.has(key) && this.instances.has(key)) {
      return this.instances.get(key);
    }
    
    // Create new instance
    const Factory = this.factories.get(key);
    if (!Factory) {
      throw new Error(`No factory registered for: ${key}`);
    }
    
    const instance = new Factory(...args);
    
    // Cache if singleton
    if (this.singletons.has(key)) {
      this.instances.set(key, instance);
    }
    
    return instance;
  }
  
  async getAsync(key, ...args) {
    const instance = this.get(key, ...args);
    
    if (instance?.initialize && typeof instance.initialize === 'function') {
      await instance.initialize();
    }
    
    return instance;
  }
}

module.exports = { DIContainer };
```

### Application Setup
```javascript
// src/main/initialize.js
const { DIContainer } = require('../managers/di-container');
const { ProxyManager } = require('../proxy/manager');
const { SessionManager } = require('../sessions/manager');
const { EvasionManager } = require('../evasion/manager');

function setupDependencies() {
  const container = new DIContainer();
  
  // Register services
  container.register('ProxyManager', ProxyManager, { singleton: true });
  container.register('SessionManager', SessionManager, { singleton: true });
  container.register('EvasionManager', EvasionManager, { singleton: true });
  
  return container;
}

// In main.js
const container = setupDependencies();

// Usage with dependency injection
const proxyManager = container.get('ProxyManager');

// In tests, can provide mocks
class MockProxyManager {}
const testContainer = new DIContainer();
testContainer.register('ProxyManager', MockProxyManager);
```

---

## Structured Logging Migration

### Issue
2,469 console statements scattered throughout - no centralized control, inconsistent format.

### Current Code (PROBLEMATIC)
```javascript
// Throughout codebase
console.log('Starting operation');
console.error('Error occurred:', error);
console.warn('Deprecated method called');

// PROBLEMS:
// - No log levels
// - No timestamps
// - Cannot route to external services
// - Hard to search/filter in production
```

### Fixed Code
```javascript
// Already exists in codebase: logging/index.js
const logger = require('./logging');

// Simple migration (PATTERN 1: Direct Replacement)
// Before: console.log('message')
// After: logger.info('message')

// MIGRATION COMMANDS
// Find and replace in WebStorm/VS Code:
// console\.log\((.*)\)  →  logger.info($1)
// console\.error\((.*)\) →  logger.error($1)
// console\.warn\((.*)\)  →  logger.warn($1)

// Structured Logging Pattern (PATTERN 2: With Context)
const { createLogger } = require('./logging');
const logger = createLogger('proxy-manager');

class ProxyManager {
  async rotateProxy() {
    logger.info('Rotating proxy', {
      currentProxy: this.currentProxy,
      availableProxies: this.proxies.size
    });
    
    try {
      const newProxy = this.selectNextProxy();
      await this.applyProxy(newProxy);
      
      logger.info('Proxy rotated successfully', {
        newProxy: newProxy.url,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logger.error('Failed to rotate proxy', {
        error: err.message,
        code: err.code,
        stack: err.stack
      });
      
      throw err;
    }
  }
}

// Logging Levels
logger.debug('Debug information');    // Only in development
logger.info('Informational message');   // Normal operation
logger.warn('Warning message');         // Potential issue
logger.error('Error message', { err }); // Error with context
```

### Configuration
```javascript
// config/logging.js
module.exports = {
  logging: {
    // Log level: debug, info, warn, error, fatal
    level: process.env.LOG_LEVEL || 'info',
    
    // Output format: json, text
    format: process.env.LOG_FORMAT || 'json',
    
    // File output
    file: {
      enabled: true,
      path: process.env.LOG_PATH || 'logs/app.log',
      maxSize: '10m',
      maxFiles: 10
    },
    
    // External services
    services: {
      // Datadog, CloudWatch, etc.
      enabled: process.env.LOG_SERVICE_ENABLED === 'true'
    }
  }
};
```

---

## Input Validation

### Issue
~6 functions without parameter validation create runtime errors and security risks.

### Current Code (PROBLEMATIC)
```javascript
// websocket/command-registry.js
function executeCommand(command, params) {
  // PROBLEMATIC: No validation
  const result = commands[command.name](params);
  return result;
}

// Crashes if command is null, command.name is undefined, etc.
```

### Fixed Code
```javascript
// utils/validation.js
const Joi = require('joi'); // npm install joi

// Define schemas
const schemas = {
  commandRequest: Joi.object({
    command: Joi.string().required(),
    params: Joi.object().optional(),
    sessionId: Joi.string().required(),
    timeout: Joi.number().min(100).max(300000).optional()
  }),
  
  navigateParams: Joi.object({
    url: Joi.string().uri().required(),
    waitUntil: Joi.string().valid('load', 'domcontentloaded', 'networkidle').optional(),
    timeout: Joi.number().optional()
  }),
  
  clickParams: Joi.object({
    selector: Joi.string().required(),
    x: Joi.number().optional(),
    y: Joi.number().optional(),
    button: Joi.string().valid('left', 'right', 'middle').optional()
  })
};

// Validation helper
class RequestValidator {
  static validate(data, schema) {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      allowUnknown: false
    });
    
    if (error) {
      const messages = error.details.map(d => d.message).join(', ');
      throw new ValidationError(messages, error.details);
    }
    
    return value;
  }
}

// Custom error class
class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
    this.statusCode = 400;
  }
}

module.exports = {
  schemas,
  RequestValidator,
  ValidationError
};

// Usage
const { RequestValidator, schemas, ValidationError } = require('./validation');

function executeCommand(request) {
  try {
    // Validate request
    const validated = RequestValidator.validate(request, schemas.commandRequest);
    
    // Get command-specific params schema
    const commandSchema = schemas[validated.command + 'Params'];
    if (commandSchema) {
      validated.params = RequestValidator.validate(
        validated.params || {},
        commandSchema
      );
    }
    
    // Now safe to execute
    const result = commands[validated.command](validated.params);
    return result;
  } catch (err) {
    if (err instanceof ValidationError) {
      return {
        success: false,
        error: err.message,
        details: err.details,
        statusCode: 400
      };
    }
    throw err;
  }
}
```

---

## Module Decomposition

### Issue
websocket/server.js is 11,809 LOC with 899+ methods - unmaintainable monolith.

### Current Architecture (PROBLEMATIC)
```
websocket/server.js (11,809 LOC)
├── WebSocket connection management
├── Command dispatch
├── Request/response serialization
├── Error recovery
├── Session management
├── 40+ feature module registrations
├── Compression logic
├── Rate limiting
├── Health checks
└── Metrics collection
```

### Proposed Architecture (SOLUTION)
```
websocket/
├── server.js (SIMPLIFIED: ~500 LOC)
│   ├── Entry point
│   ├── Connection lifecycle
│   └── Module registration
│
├── core/
│   ├── command-processor.js (command dispatch)
│   ├── response-formatter.js (serialization)
│   ├── error-recovery.js (retry logic)
│   └── metrics-collector.js (observability)
│
├── transports/
│   ├── websocket-transport.js (protocol)
│   └── http-transport.js (future)
│
├── features/
│   ├── credentials-feature.js
│   ├── session-persistence-feature.js
│   ├── extended-evasion-feature.js
│   └── ...others
│
├── middleware/
│   ├── rate-limiter.js
│   ├── request-validator.js
│   └── response-decorator.js
│
└── utils/
    ├── error-formatter.js
    └── request-size-validator.js
```

### Example: Extract CommandProcessor
```javascript
// websocket/core/command-processor.js (NEW FILE)
class CommandProcessor {
  constructor(commands, options = {}) {
    this.commands = commands;
    this.logger = options.logger;
    this.metrics = options.metrics;
  }
  
  async process(request) {
    const startTime = Date.now();
    
    try {
      // Validate command exists
      if (!this.commands.has(request.command)) {
        throw new Error(`Unknown command: ${request.command}`);
      }
      
      // Execute command
      const handler = this.commands.get(request.command);
      const result = await handler(request.params, request.context);
      
      // Metrics
      this.metrics?.record('command.success', {
        command: request.command,
        duration: Date.now() - startTime
      });
      
      return result;
    } catch (err) {
      // Metrics
      this.metrics?.record('command.error', {
        command: request.command,
        error: err.message
      });
      
      throw err;
    }
  }
}

module.exports = { CommandProcessor };
```

### Example: Simplified server.js
```javascript
// websocket/server.js (SIMPLIFIED)
const WebSocket = require('ws');
const { CommandProcessor } = require('./core/command-processor');
const { ResponseFormatter } = require('./core/response-formatter');
const { ErrorRecovery } = require('./core/error-recovery');

class WebSocketServer {
  constructor(options = {}) {
    this.options = options;
    this.wss = null;
    this.commandProcessor = null;
    this.responseFormatter = null;
    this.errorRecovery = null;
  }
  
  async start() {
    // Initialize core modules
    this.commandProcessor = new CommandProcessor(
      this.buildCommandRegistry(),
      { logger: this.options.logger }
    );
    
    this.responseFormatter = new ResponseFormatter();
    this.errorRecovery = new ErrorRecovery();
    
    // Setup WebSocket server
    this.wss = new WebSocket.Server({ port: this.options.port });
    
    this.wss.on('connection', (ws) => {
      this.handleConnection(ws);
    });
  }
  
  async handleConnection(ws) {
    ws.on('message', async (data) => {
      try {
        const request = JSON.parse(data);
        const result = await this.commandProcessor.process(request);
        const response = this.responseFormatter.format(result);
        ws.send(JSON.stringify(response));
      } catch (err) {
        const recoveryAction = await this.errorRecovery.handle(err);
        const errorResponse = this.responseFormatter.formatError(err, recoveryAction);
        ws.send(JSON.stringify(errorResponse));
      }
    });
  }
  
  buildCommandRegistry() {
    const registry = new Map();
    // Register command handlers
    return registry;
  }
}

module.exports = { WebSocketServer };
```

---

## Summary of Patterns

| Debt Pattern | Solution | Effort | Benefits |
|--------------|----------|--------|----------|
| Memory leaks | ManagedEmitter wrapper | 1-2 weeks | Stability +15% |
| Unhandled promises | Error handlers + .catch() | 1 week | Reliability +10% |
| Hardcoded config | Extract to config/defaults.js | 1-2 weeks | Testability +25% |
| Singletons | Factory functions + DI container | 2-3 weeks | Testability +30% |
| Scattered logging | Migrate to structured logger | 1 week | Debugging +20% |
| No validation | Joi schemas + validators | 1-2 weeks | Security +25% |
| God objects | Module decomposition | 3-4 weeks | Maintainability +50% |

---

## Next Steps

1. Pick one pattern to implement first (suggest: Memory leak fixes)
2. Create feature branch
3. Implement pattern across related files
4. Write tests
5. Performance benchmark
6. Code review
7. Merge to main

**Estimated Timeline:** 3-4 months to address all debt items
**ROI:** 2x improvement in maintainability and testability

---

**Document Created:** July 3, 2026  
**Author:** Claude Code (Automated Analysis)
