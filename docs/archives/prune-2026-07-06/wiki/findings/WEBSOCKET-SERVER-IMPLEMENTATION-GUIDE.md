# WebSocket Server Modularization - Implementation Guide

**Status:** Ready for Execution  
**Complexity:** High (many interdependencies)  
**Risk Level:** Medium (requires careful testing)  
**Estimated Duration:** 5 development sessions  

---

## Pre-Implementation Checklist

Before starting, ensure:

- [ ] Git branch created: `feature/websocket-modularization`
- [ ] Current tests passing: `npm test`
- [ ] Backup of original: `cp websocket/server.js websocket/server.js.backup`
- [ ] All 35+ command registration modules reviewed
- [ ] Dependency graph validated
- [ ] Team notified of refactoring (if collaborative)

---

## Phase 1: Setup & Scaffolding (1.5 hours)

### Step 1a: Create Module Files
```bash
touch websocket/server-core.js
touch websocket/command-handlers.js
touch websocket/state-mgmt.js
touch websocket/command-registry.js
```

### Step 1b: Create Backup & Reference Files
```bash
cp websocket/server.js websocket/server.js.original
mkdir -p websocket/analysis
cp websocket/server.js websocket/analysis/server-lines.txt
```

### Step 1c: Add Module Headers
Add to each file:
```javascript
/**
 * @fileoverview [Module Name]
 * @module websocket/[module-name]
 * @version 1.0.0
 * @author Claude Code
 * 
 * [Brief description of responsibility]
 * 
 * Dependencies:
 * - [List dependencies]
 * 
 * Exported Classes:
 * - [List exported classes]
 */

'use strict';
```

### Step 1d: Create Transition Document
File: `websocket/MODULARIZATION.md`
```markdown
# Modularization Status

## Module Layout
- server-core.js: WebSocket lifecycle
- command-handlers.js: Command execution
- state-mgmt.js: State management
- command-registry.js: Command metadata

## Status
- [ ] Phase 1: Scaffolding
- [ ] Phase 2: State Management
- [ ] Phase 3: Command Registry
- [ ] Phase 4: Command Handlers
- [ ] Phase 5: Server Core
- [ ] Phase 6: Integration
- [ ] Phase 7: Testing

## Temporary server.js
Currently using [approach]: [facade|dispatch|both]
```

---

## Phase 2: Extract State Management (1 hour)

### Step 2a: Copy State Classes to state-mgmt.js

**File: websocket/state-mgmt.js**

```javascript
'use strict';

const { createLogger } = require('../logging');

/**
 * Immutable snapshot of application state
 * Used for rollback operations and transactional semantics
 */
class StateSnapshot {
  constructor(id, timestamp, stateData = {}) {
    this.id = id;
    this.timestamp = timestamp;
    this.stateData = Object.freeze({ ...stateData });
    this.metadata = {
      commandName: null,
      source: 'unknown',
      dataSize: JSON.stringify(stateData).length
    };
  }

  // Copy all static methods and instance methods from original
  // Lines 495-589 from server.js
  
  static captureProxy(proxyManager) { ... }
  static captureStorage(storageManager, origin, storageType) { ... }
  static captureNavigation(mainWindow, currentUrl) { ... }
  static captureTorMode(proxyManager) { ... }
  toString() { ... }
}

/**
 * Manages state snapshots and rollback operations
 */
class StateRollbackManager {
  constructor(maxSnapshots = 50, snapshotTtlMs = 3600000) { ... }
  
  saveSnapshot(id, snapshot) { ... }
  async restoreSnapshot(id, restoreFn = null) { ... }
  discardSnapshot(id) { ... }
  // ... copy all methods from lines 611-801
}

/**
 * Wrapper for command handlers that require state rollback
 */
class StatefulCommandHandler {
  constructor(commandName, stateManager, logger = null) { ... }
  async executeWithRollback(handlerFn, snapshot, validationFn, rollbackFn) { ... }
  async executeInTransaction(handlerFn, snapshots) { ... }
}

// New: State validation and querying
class StateValidator {
  constructor(logger = null) {
    this.logger = logger || createLogger('state-validator');
    this.validators = new Map();
  }

  registerValidator(stateType, validatorFn) {
    if (typeof validatorFn !== 'function') {
      throw new Error('Validator must be a function');
    }
    this.validators.set(stateType, validatorFn);
  }

  async validate(stateType, snapshot) {
    const validator = this.validators.get(stateType);
    if (!validator) {
      this.logger.warn(`No validator registered for state type: ${stateType}`);
      return { valid: true, reason: 'No validator registered' };
    }

    try {
      const result = await validator(snapshot);
      return {
        valid: result.valid !== false,
        reason: result.reason || 'Validation passed'
      };
    } catch (error) {
      this.logger.error(`Validation error for ${stateType}: ${error.message}`);
      return {
        valid: false,
        reason: `Validation error: ${error.message}`
      };
    }
  }
}

class SnapshotRepository {
  constructor(maxSize = 1000) {
    this.snapshots = new Map();
    this.maxSize = maxSize;
    this.index = [];
  }

  findById(id) {
    return this.snapshots.get(id);
  }

  findByType(stateType) {
    return Array.from(this.snapshots.values())
      .filter(s => s.stateData.type === stateType);
  }

  findByDateRange(start, end) {
    return Array.from(this.snapshots.values())
      .filter(s => s.timestamp >= start && s.timestamp <= end);
  }

  getChain(startId, endId) {
    // Return sequence of snapshots from start to end
    const indices = this.index
      .slice(
        this.index.findIndex(id => id === startId),
        this.index.findIndex(id => id === endId) + 1
      );
    return indices.map(id => this.snapshots.get(id));
  }

  export(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(Array.from(this.snapshots.values()));
    }
    throw new Error(`Unsupported export format: ${format}`);
  }
}

module.exports = {
  StateSnapshot,
  StateRollbackManager,
  StatefulCommandHandler,
  StateValidator,
  SnapshotRepository
};
```

### Step 2b: Update server.js Imports
In websocket/server.js, replace state class definitions with:
```javascript
const {
  StateSnapshot,
  StateRollbackManager,
  StatefulCommandHandler
} = require('./state-mgmt');
```

### Step 2c: Verify State Tests Pass
```bash
npm test -- websocket/tests/state-management.test.js
```

✅ All state management tests pass

---

## Phase 3: Create Command Registry (2 hours)

### Step 3a: Define Registry Classes

**File: websocket/command-registry.js**

```javascript
'use strict';

const { createLogger } = require('../logging');

/**
 * Metadata for a single command
 */
class CommandMetadata {
  constructor(name, options = {}) {
    this.name = name;
    this.description = options.description || '';
    this.category = options.category || 'general';
    this.tags = options.tags || [];
    this.params = options.params || {};
    this.returns = options.returns || {};
    this.requiresAuth = options.requiresAuth !== false;
    this.rateLimitTier = options.rateLimitTier || 'medium';
    this.timeout = options.timeout || 30000;
    this.isIdempotent = options.isIdempotent === true;
    this.priority = options.priority || 5;
    this.version = options.version || '1.0.0';
    this.deprecated = options.deprecated || null;
    this.examples = options.examples || [];
  }

  validate() {
    const errors = [];
    if (!this.name) errors.push('name is required');
    if (typeof this.timeout !== 'number' || this.timeout < 0) {
      errors.push('timeout must be non-negative number');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * Central registry of all available commands
 */
class CommandRegistry {
  constructor(logger = null) {
    this.logger = logger || createLogger('command-registry');
    this.commands = new Map(); // name -> CommandMetadata
    this.handlers = new Map(); // name -> handler function
    this.groups = new Map(); // groupName -> [commandNames]
    this.index = {
      byCategory: new Map(),
      byTag: new Map(),
      byTier: new Map()
    };
  }

  /**
   * Register a command with metadata
   */
  register(name, metadata, handler = null) {
    const validation = metadata.validate();
    if (!validation.valid) {
      throw new Error(`Invalid metadata for command "${name}": ${validation.errors.join(', ')}`);
    }

    this.commands.set(name, metadata);
    if (handler) {
      this.handlers.set(name, handler);
    }

    // Index by category
    if (!this.index.byCategory.has(metadata.category)) {
      this.index.byCategory.set(metadata.category, []);
    }
    this.index.byCategory.get(metadata.category).push(name);

    // Index by tags
    for (const tag of metadata.tags) {
      if (!this.index.byTag.has(tag)) {
        this.index.byTag.set(tag, []);
      }
      this.index.byTag.get(tag).push(name);
    }

    // Index by rate limit tier
    if (!this.index.byTier.has(metadata.rateLimitTier)) {
      this.index.byTier.set(metadata.rateLimitTier, []);
    }
    this.index.byTier.get(metadata.rateLimitTier).push(name);

    this.logger.debug(`Registered command: ${name}`);
  }

  get(name) {
    return this.commands.get(name);
  }

  getHandler(name) {
    return this.handlers.get(name);
  }

  has(name) {
    return this.commands.has(name);
  }

  getAll() {
    return Array.from(this.commands.entries()).map(([name, metadata]) => ({
      name,
      ...metadata
    }));
  }

  getByCategory(category) {
    const names = this.index.byCategory.get(category) || [];
    return names.map(name => this.commands.get(name));
  }

  getByTag(tag) {
    const names = this.index.byTag.get(tag) || [];
    return names.map(name => this.commands.get(name));
  }

  getByTier(tier) {
    const names = this.index.byTier.get(tier) || [];
    return names.map(name => this.commands.get(name));
  }

  search(query) {
    const lower = query.toLowerCase();
    return this.getAll().filter(cmd =>
      cmd.name.includes(lower) ||
      cmd.description.includes(lower) ||
      cmd.tags.some(tag => tag.includes(lower))
    );
  }

  validate(commandName, params) {
    const metadata = this.commands.get(commandName);
    if (!metadata) {
      return { valid: false, error: `Unknown command: ${commandName}` };
    }

    // TODO: Implement JSON Schema validation for params
    // against metadata.params schema
    
    return { valid: true };
  }

  unregister(name) {
    this.commands.delete(name);
    this.handlers.delete(name);
    // TODO: Clean up indices
  }
}

/**
 * Groups related commands
 */
class CommandGroupRegistry {
  constructor() {
    this.groups = new Map(); // groupName -> { description, commands: Set }
  }

  createGroup(name, description = '') {
    this.groups.set(name, {
      name,
      description,
      commands: new Set()
    });
  }

  addCommandToGroup(groupName, commandName) {
    const group = this.groups.get(groupName);
    if (!group) {
      throw new Error(`Group not found: ${groupName}`);
    }
    group.commands.add(commandName);
  }

  removeCommandFromGroup(groupName, commandName) {
    const group = this.groups.get(groupName);
    if (group) {
      group.commands.delete(commandName);
    }
  }

  getGroupCommands(groupName) {
    const group = this.groups.get(groupName);
    return group ? Array.from(group.commands) : [];
  }

  listGroups() {
    return Array.from(this.groups.values());
  }
}

/**
 * Auto-generates documentation from command registry
 */
class CommandDocGenerator {
  constructor(registry) {
    this.registry = registry;
  }

  generateMarkdown(commandName = null) {
    if (commandName) {
      return this._generateCommandMarkdown(commandName);
    }
    return this._generateFullMarkdown();
  }

  _generateCommandMarkdown(commandName) {
    const cmd = this.registry.get(commandName);
    if (!cmd) return '';

    let md = `# ${cmd.name}\n\n`;
    md += `${cmd.description}\n\n`;
    md += `**Category:** ${cmd.category}\n`;
    md += `**Tags:** ${cmd.tags.join(', ')}\n`;
    md += `**Requires Auth:** ${cmd.requiresAuth}\n`;
    md += `**Rate Limit Tier:** ${cmd.rateLimitTier}\n`;
    md += `**Timeout:** ${cmd.timeout}ms\n\n`;

    if (cmd.examples.length > 0) {
      md += '## Examples\n\n';
      for (const ex of cmd.examples) {
        md += '```json\n' + JSON.stringify(ex, null, 2) + '\n```\n\n';
      }
    }

    if (cmd.deprecated) {
      md += `**DEPRECATED:** ${cmd.deprecated}\n\n`;
    }

    return md;
  }

  _generateFullMarkdown() {
    let md = '# WebSocket API Reference\n\n';
    const categories = new Map();

    for (const cmd of this.registry.getAll()) {
      if (!categories.has(cmd.category)) {
        categories.set(cmd.category, []);
      }
      categories.get(cmd.category).push(cmd);
    }

    for (const [category, commands] of categories) {
      md += `## ${category}\n\n`;
      for (const cmd of commands) {
        md += `- **${cmd.name}** - ${cmd.description}\n`;
      }
      md += '\n';
    }

    return md;
  }

  generateJson(commandName = null) {
    if (commandName) {
      const cmd = this.registry.get(commandName);
      return cmd ? JSON.stringify(cmd, null, 2) : null;
    }
    return JSON.stringify(this.registry.getAll(), null, 2);
  }

  generateOpenAPI() {
    // TODO: Implement OpenAPI 3.0 spec generation
    return {};
  }
}

module.exports = {
  CommandMetadata,
  CommandRegistry,
  CommandGroupRegistry,
  CommandDocGenerator
};
```

### Step 3b: Create Command Definitions

Create stub: **websocket/command-definitions.js**

```javascript
'use strict';

const { CommandMetadata } = require('./command-registry');

/**
 * Define all available commands with metadata
 * This is the single source of truth for command specifications
 */
const COMMAND_DEFINITIONS = {
  // Navigation
  navigate: new CommandMetadata('navigate', {
    description: 'Navigate to a URL',
    category: 'navigation',
    tags: ['browser', 'navigation'],
    params: {
      url: { type: 'string', required: true },
      waitUntil: { type: 'string', enum: ['load', 'domcontentloaded', 'networkidle'] }
    },
    returns: { type: 'object' },
    timeout: 60000,
    isIdempotent: false
  }),

  get_url: new CommandMetadata('get_url', {
    description: 'Get current page URL',
    category: 'navigation',
    tags: ['browser', 'state'],
    isIdempotent: true,
    timeout: 10000,
    rateLimitTier: 'low'
  }),

  // Extraction
  get_content: new CommandMetadata('get_content', {
    description: 'Extract page content (HTML or text)',
    category: 'extraction',
    tags: ['extraction', 'content'],
    isIdempotent: true,
    timeout: 30000,
    rateLimitTier: 'medium'
  }),

  // ... continue for all 164 commands
};

module.exports = { COMMAND_DEFINITIONS };
```

### Step 3c: Test Registry
```bash
cat > websocket/tests/command-registry.test.js << 'EOF'
const { CommandRegistry, CommandMetadata } = require('../command-registry');

describe('CommandRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  it('should register a command', () => {
    const meta = new CommandMetadata('test', { description: 'Test' });
    registry.register('test', meta);
    expect(registry.has('test')).toBe(true);
  });

  it('should search commands', () => {
    const meta1 = new CommandMetadata('navigate', { description: 'Navigate' });
    const meta2 = new CommandMetadata('get_url', { description: 'Get URL' });
    registry.register('navigate', meta1);
    registry.register('get_url', meta2);
    
    const results = registry.search('navigate');
    expect(results.length).toBeGreaterThan(0);
  });
});
EOF

npm test -- websocket/tests/command-registry.test.js
```

---

## Phase 4: Extract Command Handlers (3 hours)

### Step 4a: Create Command Executor

**File: websocket/command-handlers.js** (Part 1)

```javascript
'use strict';

const {
  calculateRetryDelay,
  sleep,
  isRetryableError,
  isRetryableCommand,
  generateRecoverySuggestion
} = require('./server-core');

/**
 * Executes commands with error recovery and metrics
 */
class CommandExecutor {
  constructor(handlers = {}, logger = null, profiler = null) {
    this.handlers = new Map(Object.entries(handlers));
    this.logger = logger;
    this.profiler = profiler;
    this.metrics = {
      totalExecuted: 0,
      totalSucceeded: 0,
      totalFailed: 0,
      totalRetried: 0
    };
  }

  registerHandler(command, handler) {
    this.handlers.set(command, handler);
  }

  unregisterHandler(command) {
    this.handlers.delete(command);
  }

  hasHandler(command) {
    return this.handlers.has(command);
  }

  /**
   * Execute a command with automatic retry for idempotent ops
   */
  async execute(command, params = {}, options = {}) {
    const {
      enableRetry = true,
      maxRetries = 3,
      clientId = null,
      commandId = null
    } = options;

    this.metrics.totalExecuted++;

    const handler = this.handlers.get(command);
    if (!handler) {
      this.metrics.totalFailed++;
      return {
        success: false,
        error: `Unknown command: ${command}`,
        recovery: generateRecoverySuggestion(command, new Error(`Unknown command`))
      };
    }

    const canRetry = enableRetry && isRetryableCommand(command);
    let lastError = null;
    let attemptCount = 0;

    // Execute with retry logic
    while (attemptCount <= (canRetry ? maxRetries : 0)) {
      try {
        const timerName = `cmd:${command}:${commandId || Date.now()}`;
        if (this.profiler) {
          this.profiler.startTimer(timerName, { command, clientId });
        }

        const result = await handler(params);

        if (this.profiler) {
          this.profiler.endTimer(timerName);
        }

        if (result.success) {
          this.metrics.totalSucceeded++;
          if (attemptCount > 0) {
            this.metrics.totalRetried++;
          }
          return result;
        }

        // Check if result indicates manager unavailable
        if (result.error && result.error.includes('not available')) {
          this.metrics.totalFailed++;
          return result;
        }

        throw new Error(result.error || 'Handler returned success: false');
      } catch (error) {
        lastError = error;
        attemptCount++;

        if (canRetry && isRetryableError(error) && attemptCount <= maxRetries) {
          const delay = calculateRetryDelay(attemptCount - 1);
          if (this.logger) {
            this.logger.info(
              `Command ${command} failed (attempt ${attemptCount}/${maxRetries + 1}), ` +
              `retrying in ${delay}ms: ${error.message}`
            );
          }
          await sleep(delay);
          continue;
        }

        break;
      }
    }

    this.metrics.totalFailed++;
    const recovery = generateRecoverySuggestion(command, lastError);

    if (this.logger) {
      this.logger.error(
        `Command ${command} failed after ${attemptCount} attempt(s): ${lastError.message}`
      );
    }

    return {
      success: false,
      error: lastError.message,
      attemptCount,
      recovery
    };
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalExecuted > 0
        ? (this.metrics.totalSucceeded / this.metrics.totalExecuted * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }
}

/**
 * Manages retry logic and strategy
 */
class RetryManager {
  constructor(config = {}) {
    this.maxRetries = config.maxRetries || 3;
    this.baseDelay = config.baseDelay || 1000;
    this.maxDelay = config.maxDelay || 30000;
    this.retryableErrors = config.retryableErrors || [
      'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE'
    ];
  }

  isRetryable(error) {
    const msg = (error?.message || error?.toString() || '').toLowerCase();
    return this.retryableErrors.some(e => msg.includes(e.toLowerCase()));
  }

  getRetryDelay(attemptNumber) {
    const exponentialDelay = this.baseDelay * Math.pow(2, attemptNumber);
    return Math.min(exponentialDelay, this.maxDelay);
  }

  recordAttempt(command, error) {
    // TODO: Implement metrics recording
  }
}

/**
 * Transforms command responses for delivery
 */
class ResponseTransformer {
  static formatSuccess(data, commandName, id) {
    return {
      id,
      command: commandName,
      success: true,
      ...data
    };
  }

  static formatError(error, commandName, id, recovery = null) {
    return {
      id,
      command: commandName,
      success: false,
      error: error.message || error,
      ...(recovery && { recovery })
    };
  }

  static enrichWithMetadata(response, metadata = {}) {
    return {
      ...response,
      ...metadata
    };
  }

  static applyTemplate(response, templateName) {
    // Apply response template based on success/error
    if (templateName === 'success' && !response.success) {
      return { ...response, success: false };
    }
    if (templateName === 'error' && response.success) {
      return { ...response, success: false };
    }
    return response;
  }
}

module.exports = {
  CommandExecutor,
  RetryManager,
  ResponseTransformer
};
```

### Step 4b: Move Command Registration

Copy all `register*Commands()` calls from server.js (lines 2729-11546) into command-handlers.js

Add function:
```javascript
/**
 * Setup all command handlers
 * Called once at server initialization
 */
function setupCommandHandlers(commandHandlers, server) {
  // Load all command modules
  const { registerImageCommands } = require('./commands/image-commands');
  const { registerScreenshotCommands } = require('./commands/screenshot-commands');
  // ... etc for all 35+ modules

  // Register them
  registerImageCommands(server, server.mainWindow);
  registerScreenshotCommands(server, server.mainWindow);
  // ... etc

  return commandHandlers;
}

module.exports.setupCommandHandlers = setupCommandHandlers;
```

### Step 4c: Test Command Execution
```bash
npm test -- websocket/tests/command-execution.test.js
```

---

## Phase 5: Refactor Server Core (3 hours)

### Step 5a: Create Helper Classes

**File: websocket/server-core.js** (Part 1)

```javascript
'use strict';

const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { ipcMain } = require('electron');

const { createLogger } = require('../logging');
const { ErrorFormatter } = require('./error-formatter');

// Configuration
const IPC_DEFAULT_TIMEOUT = 30000;
const ADAPTIVE_TIMEOUT_CONFIG = { /* ... from server.js ... */ };

/**
 * Helper: Calculate adaptive timeout based on command type
 */
function calculateAdaptiveTimeout(commandName, estimatedSize = 0) {
  if (process.env.ADAPTIVE_TIMEOUT_DISABLED === '1' || !ADAPTIVE_TIMEOUT_CONFIG.enabled) {
    return IPC_DEFAULT_TIMEOUT;
  }

  let timeout = ADAPTIVE_TIMEOUT_CONFIG.baseTimeout;

  if (ADAPTIVE_TIMEOUT_CONFIG.largeResponseCommands.includes(commandName)) {
    timeout = Math.floor(ADAPTIVE_TIMEOUT_CONFIG.baseTimeout * 1.5);
  }

  if (estimatedSize > ADAPTIVE_TIMEOUT_CONFIG.hugeResponseThreshold) {
    timeout = ADAPTIVE_TIMEOUT_CONFIG.maxTimeout;
  } else if (estimatedSize > ADAPTIVE_TIMEOUT_CONFIG.largeResponseThreshold) {
    timeout = 60000;
  }

  return Math.max(
    ADAPTIVE_TIMEOUT_CONFIG.baseTimeout,
    Math.min(timeout, ADAPTIVE_TIMEOUT_CONFIG.maxTimeout)
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableCommand(command) {
  const RETRYABLE = [
    'get_url', 'get_content', 'get_page_state', 'screenshot',
    // ... all retryable commands from ERROR_RECOVERY_CONFIG
  ];
  return RETRYABLE.includes(command);
}

function isRetryableError(error) {
  const RETRYABLE_ERRORS = [
    'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE',
    // ... from ERROR_RECOVERY_CONFIG
  ];
  const msg = (error?.message || error?.toString() || '').toLowerCase();
  return RETRYABLE_ERRORS.some(e => msg.includes(e.toLowerCase()));
}

function calculateRetryDelay(attempt) {
  return 1000 * Math.pow(2, attempt);
}

/**
 * Generate recovery suggestions for errors
 */
function generateRecoverySuggestion(command, error, managerName = null) {
  // Copy from server.js lines 401-477
  // Returns { suggestion, hint, recovery }
}

/**
 * Helper: Tor detection
 */
function isOnionUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.onion');
  } catch {
    return url.includes('.onion');
  }
}

function isTorModeEnabled() {
  const args = process.argv;
  return (
    process.env.TOR_MODE === '1' ||
    process.env.TOR_MODE === 'true' ||
    args.includes('--tor-mode')
  );
}

function checkOnionWithoutTor(url) {
  if (isOnionUrl(url) && !isTorModeEnabled()) {
    return {
      success: false,
      error: '.onion domains require TOR_MODE=1 at startup.',
      suggestion: 'Restart with TOR_MODE=1 or --tor-mode flag.',
      url
    };
  }
  return null;
}

/**
 * Helper: IPC communication with timeout
 */
function ipcWithTimeout(
  webContents,
  sendChannel,
  responseChannel,
  data = null,
  timeout = IPC_DEFAULT_TIMEOUT
) {
  return new Promise((resolve, reject) => {
    if (!webContents) {
      return reject(new Error('webContents is not available'));
    }

    let timeoutHandle = null;
    const timedOut = () => {
      if (ipcMain.listeners(responseChannel).includes(listener)) {
        ipcMain.removeListener(responseChannel, listener);
      }
      reject(new Error(
        `IPC timeout after ${timeout}ms on channel: ${responseChannel}`
      ));
    };

    const listener = (event, response) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      ipcMain.removeListener(responseChannel, listener);
      resolve(response);
    };

    ipcMain.once(responseChannel, listener);

    timeoutHandle = setTimeout(timedOut, timeout);

    try {
      webContents.send(sendChannel, data);
    } catch (error) {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      ipcMain.removeListener(responseChannel, listener);
      reject(error);
    }
  });
}

// Export helpers
module.exports.calculateAdaptiveTimeout = calculateAdaptiveTimeout;
module.exports.sleep = sleep;
module.exports.isRetryableCommand = isRetryableCommand;
module.exports.isRetryableError = isRetryableError;
module.exports.calculateRetryDelay = calculateRetryDelay;
module.exports.generateRecoverySuggestion = generateRecoverySuggestion;
module.exports.isOnionUrl = isOnionUrl;
module.exports.isTorModeEnabled = isTorModeEnabled;
module.exports.checkOnionWithoutTor = checkOnionWithoutTor;
module.exports.ipcWithTimeout = ipcWithTimeout;
```

### Step 5b: Refactor WebSocketServer Class

```javascript
/**
 * Main WebSocket server class
 * Manages connections, routes commands, handles lifecycle
 */
class WebSocketServer {
  constructor(port, mainWindow, options = {}) {
    // Constructor from server.js, lines 920-1185
    // All initialization stays the same
    this.port = port;
    this.mainWindow = mainWindow;
    this.wss = null;
    this.httpsServer = null;
    this.clients = new Set();
    
    // Injected dependencies
    this.commandHandlers = options.commandHandlers || {};
    this.commandRegistry = options.commandRegistry || null;
    this.stateManager = options.stateManager || null;
    
    // ... rest of constructor
  }

  start() {
    // From server.js lines 1289-1343
  }

  _createCompositeHttpHandler() {
    // From server.js lines 1344-1413
  }

  _startNonSSLServer(port, compressionConfig) {
    // From server.js lines 1414-1462
  }

  _startWebSocketServer(port, compressionConfig) {
    // From server.js lines 1463-1927
  }

  _loadSslCertificates() {
    // From server.js lines 2039-2121
  }

  isSslEnabled() { /* ... */ }
  getProtocol() { /* ... */ }
  getConnectionUrl(hostname) { /* ... */ }

  startHeartbeat() { /* ... */ }
  stopHeartbeat() { /* ... */ }
  _checkForZombieConnections() { /* ... */ }

  handleAuthenticate(ws, data) { /* ... */ }
  validateToken(token) { /* ... */ }
  setAuthToken(token) { /* ... */ }

  broadcast(message) { /* ... */ }
  getStatus() { /* ... */ }
  close() { /* ... */ }

  setSessionManager(manager) { /* ... */ }
  setTabManager(manager) { /* ... */ }

  _setupStateRollbackListeners() { /* ... */ }
}

module.exports = WebSocketServer;
```

---

## Phase 6: Integration & Updates (2 hours)

### Step 6a: Update main.js

```javascript
// BEFORE
const WebSocketServer = require('./websocket/server');

// AFTER
const WebSocketServer = require('./websocket/server-core');
const { CommandHandlers } = require('./websocket/command-handlers');
const { StateRollbackManager } = require('./websocket/state-mgmt');
const { CommandRegistry } = require('./websocket/command-registry');
const { COMMAND_DEFINITIONS } = require('./websocket/command-definitions');

// Initialize with dependency injection
const registry = new CommandRegistry(logger);
for (const [name, metadata] of Object.entries(COMMAND_DEFINITIONS)) {
  registry.register(name, metadata);
}

const stateManager = new StateRollbackManager();
stateManager.logger = logger;

const wsServer = new WebSocketServer(PORT, mainWindow, {
  commandRegistry: registry,
  stateManager: stateManager,
  logger: logger,
  // ... other options
});

wsServer.start();
```

### Step 6b: Create Facade (Optional)

If backward compatibility needed, create `websocket/server.js` as facade:

```javascript
'use strict';

// Simple re-export for backward compatibility
const WebSocketServer = require('./server-core');

module.exports = WebSocketServer;
```

Or delete old server.js if all references updated.

### Step 6c: Update All Imports

```bash
grep -r "require.*server\.js" websocket/
grep -r "from.*server" websocket/tests/
```

Update each to use appropriate new module:
- `require('./server-core')` for WebSocketServer
- `require('./command-handlers')` for command execution
- `require('./state-mgmt')` for state management
- `require('./command-registry')` for command metadata

---

## Phase 7: Testing & Validation (3 hours)

### Step 7a: Unit Tests
```bash
npm test -- websocket/tests/server-core.test.js
npm test -- websocket/tests/command-handlers.test.js
npm test -- websocket/tests/state-mgmt.test.js
npm test -- websocket/tests/command-registry.test.js
```

### Step 7b: Integration Tests
```bash
npm test -- websocket/tests/integration/
```

### Step 7c: End-to-End Tests
```bash
npm test -- tests/e2e/
```

### Step 7d: Circular Dependency Check
```javascript
// Create test file
const Module = require('module');
const originalRequire = Module.prototype.require;

const requireStack = [];

Module.prototype.require = function(id) {
  if (requireStack.includes(id)) {
    throw new Error(`Circular dependency detected: ${requireStack.join(' -> ')} -> ${id}`);
  }
  requireStack.push(id);
  try {
    return originalRequire.apply(this, arguments);
  } finally {
    requireStack.pop();
  }
};

// Now require all modules
require('./server-core');
require('./command-handlers');
require('./state-mgmt');
require('./command-registry');

console.log('✓ No circular dependencies detected');
```

### Step 7e: Performance Benchmark
```bash
# Before refactoring
npm run benchmark:websocket > benchmark-before.json

# After refactoring
npm run benchmark:websocket > benchmark-after.json

# Compare
node scripts/compare-benchmarks.js benchmark-before.json benchmark-after.json
```

Expected: <5% overhead or equal performance

### Step 7f: Coverage Report
```bash
npm test -- --coverage websocket/
```

Expected: Maintain >85% coverage

---

## Rollback Plan

If critical issues arise:

```bash
# Option 1: Restore from backup
cp websocket/server.js.backup websocket/server.js
git reset --hard HEAD

# Option 2: Revert commit
git revert <commit-hash>

# Option 3: Quick fix on branch
# Fix issues and create new commit
```

---

## Completion Checklist

- [ ] All 4 files created with correct size (<3,000 lines)
- [ ] Zero circular dependencies verified
- [ ] All imports updated
- [ ] All tests passing (100% pass rate)
- [ ] Command registration working (all 164 commands)
- [ ] No functionality loss
- [ ] Performance acceptable (<5% overhead)
- [ ] Documentation updated
- [ ] Code review completed
- [ ] Merged to main branch

---

## Post-Modularization Tasks

1. **Documentation:** Update API-REFERENCE.md to reference command-registry
2. **Testing:** Add tests for new helper classes (StateValidator, SnapshotRepository)
3. **Monitoring:** Track metrics from CommandExecutor (success rate, retry rate)
4. **Future:** Consider extracting more specialized managers (ConnectionManager, RateLimiter)

---

**Document Version:** 1.0  
**Created:** 2026-06-22  
**Status:** Ready for Execution  
**Estimated Completion:** 5 development sessions
