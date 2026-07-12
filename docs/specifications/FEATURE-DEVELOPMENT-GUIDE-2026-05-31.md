# Basset Hound Browser - Feature Development Guide
## Complete Handbook for Developing, Testing, and Documenting Features

**Date:** May 31, 2026  
**Version:** 1.0  
**Status:** Active Development  
**Audience:** Developers, QA Engineers, Technical Leads

---

## Table of Contents

1. [Part 1: Development Template](#part-1-development-template)
2. [Part 2: Feature Checklist](#part-2-feature-checklist)
3. [Part 3: Testing Strategy](#part-3-testing-strategy)
4. [Part 4: Documentation Template](#part-4-documentation-template)
5. [Part 5: Quality Gates](#part-5-quality-gates)
6. [Part 6: Common Patterns](#part-6-common-patterns)
7. [Quick Reference](#quick-reference)

---

# PART 1: DEVELOPMENT TEMPLATE

## Step-by-Step Feature Development Process

### Phase 1: Planning & Design (Before Coding)

#### Step 1.1: Define Feature Requirements
Before writing any code, document:

**Acceptance Criteria Checklist:**
- [ ] Feature goal clearly stated (1-2 sentences)
- [ ] User personas identified (who uses this)
- [ ] Use cases documented (3-5 common scenarios)
- [ ] Success metrics defined (measurable)
- [ ] Performance targets set (latency, memory, throughput)
- [ ] Dependencies identified (other features, libraries)
- [ ] Scope boundaries defined (what's included/excluded)
- [ ] Breaking changes assessed (API impact)

**Example Acceptance Criteria Template:**
```markdown
## Feature: Advanced JavaScript Sandbox

**Goal:** Enable safe execution of arbitrary JavaScript with timeout protection

**Success Criteria:**
- [ ] Scripts execute in isolated context (no Node.js access)
- [ ] 30-second timeout protection for runaway scripts
- [ ] Console output captured (log, warn, error, info, debug)
- [ ] Error handling with stack traces
- [ ] <100ms overhead per execution
- [ ] Security: No access to process/require/fs

**Performance Targets:**
- Execution overhead: <100ms
- Memory per execution: <5MB
- Concurrent executions: 10+ supported

**Out of Scope:**
- Real DOM access (use payloads instead)
- Async/Promise support (v12.2.0+)
- Direct browser API access
```

#### Step 1.2: Design Code Organization
**Reference:** `/home/devel/basset-hound-browser/src/INDEX.md`

**Directory Structure Decision:**

```
Where does your feature go?

src/
├── agents/              ← Multi-agent orchestration
├── analysis/            ← Website analysis (tech detection)
├── authentication/      ← Auth handling
├── evasion/             ← Bot detection bypass
├── execution/           ← Code execution (sandbox)
├── export/              ← Data export formats
├── forensics/           ← Evidence collection
├── proxy/               ← Proxy management
├── recording/           ← Session recording
├── session/             ← Profile management
├── screenshots/         ← Screenshot capture
└── utils/               ← Shared utilities
```

**Decision Matrix:**
```
Does your feature:
┌─ Interact with bot detection?        → /evasion/
├─ Extract/analyze website content?    → /analysis/
├─ Export data to external systems?    → /export/
├─ Manage browser sessions?            → /session/
├─ Execute code?                       → /execution/
├─ Collect evidence/metadata?          → /forensics/
├─ Handle authentication?              → /authentication/
├─ Control network?                    → /proxy/
├─ Capture visuals?                    → /screenshots/
└─ Shared utility functions?           → /utils/
```

#### Step 1.3: Identify Integration Points
**Reference:** `/websocket/server.js` (line 6782 for WebSocket integration)

**WebSocket Command Integration Checklist:**
```javascript
// Where will your commands be handled?

// Option 1: New handler file in websocket/handlers/
websocket/handlers/
  └── [feature]-handler.js

// Option 2: Add to existing handler
websocket/handlers/
  └── [category]-handler.js  (modify existing)

// Option 3: Main server integration
websocket/server.js  (add command directly)

// Decision: Use Option 1 for new features >3 commands
```

---

### Phase 2: Core Implementation

#### Step 2.1: Create Feature Module Structure

**Standard Module Layout:**
```
src/[feature]/
├── index.js              # Main module export
├── core.js               # Core functionality
├── utils.js              # Feature-specific utilities (optional)
├── config.js             # Configuration defaults (optional)
├── [features]/           # Sub-features if needed
│   ├── feature-1.js
│   └── feature-2.js
└── README.md             # Internal documentation
```

**`index.js` Template:**
```javascript
/**
 * [Feature Name] Module
 * 
 * Provides [brief description]
 * 
 * @module [feature-name]
 * @example
 * const MyFeature = require('./src/[feature]/index.js');
 * const instance = new MyFeature(options);
 */

const Core = require('./core');
const Utils = require('./utils');
const Config = require('./config');

class FeatureName {
  constructor(options = {}) {
    this.config = { ...Config.defaults, ...options };
    this.core = new Core(this.config);
    // Initialize state
  }

  /**
   * Public method description
   * @param {type} param - Description
   * @returns {type} Description
   * @throws {Error} When X happens
   */
  async publicMethod(param) {
    // Implementation
  }

  // Cleanup method (REQUIRED)
  async cleanup() {
    if (this.core) {
      await this.core.cleanup();
    }
  }
}

module.exports = FeatureName;
```

#### Step 2.2: Implement Core Functionality

**Best Practices:**
- Keep core.js focused on primary logic
- Use async/await for I/O operations
- Handle errors explicitly (don't swallow exceptions)
- Add detailed logging (structured JSON format)
- Include JSDoc comments on all public methods
- Provide timeout protection for long-running operations

**Core Implementation Template:**
```javascript
/**
 * Core [Feature] Implementation
 * 
 * Handles the primary logic for [feature]
 */

const Logger = require('../utils/logger');

class FeatureCore {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(`[Feature]`);
    this.state = {};
  }

  /**
   * Main feature operation
   * @param {object} input - Input data
   * @param {number} timeout - Operation timeout (ms)
   * @returns {Promise<object>} Result data
   */
  async execute(input, timeout = 30000) {
    const startTime = Date.now();
    
    try {
      // Validate input
      this.validateInput(input);
      
      // Execute with timeout protection
      const result = await this.withTimeout(
        this.executeImpl(input),
        timeout
      );
      
      // Log success
      this.logger.info('execute_success', {
        duration: Date.now() - startTime,
        inputSize: JSON.stringify(input).length
      });
      
      return result;
    } catch (error) {
      this.logger.error('execute_failed', {
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Implementation of feature logic
   * @private
   */
  async executeImpl(input) {
    // Main logic here
  }

  /**
   * Input validation
   * @private
   */
  validateInput(input) {
    if (!input) throw new Error('Input required');
    // More validation
  }

  /**
   * Promise wrapper with timeout
   * @private
   */
  async withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), ms)
      )
    ]);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Resource cleanup
  }
}

module.exports = FeatureCore;
```

#### Step 2.3: Configuration Management

**Config Template (`config.js`):**
```javascript
/**
 * Default configuration for [Feature]
 */

module.exports = {
  defaults: {
    // Timeout settings
    executionTimeout: 30000,      // 30 seconds
    operationTimeout: 5000,        // 5 seconds
    
    // Performance settings
    maxConcurrentOperations: 10,
    cacheExpiry: 3600000,          // 1 hour
    
    // Feature flags
    enableCaching: true,
    enableMetrics: true,
    enableLogging: true,
    
    // Limits
    maxInputSize: 10485760,        // 10MB
    maxOutputSize: 10485760,
    maxMemoryPerOperation: 5242880, // 5MB
  },

  // Environment-specific overrides
  development: {
    enableLogging: true,
    enableMetrics: true,
  },

  production: {
    enableLogging: true,
    maxConcurrentOperations: 50,
  },

  test: {
    executionTimeout: 5000,
    enableMetrics: false,
  },
};
```

---

### Phase 3: WebSocket Integration

#### Step 3.1: Create WebSocket Handler

**Handler Template (`websocket/handlers/[feature]-handler.js`):**
```javascript
/**
 * WebSocket handler for [Feature] commands
 * 
 * Commands handled:
 * - [command1]
 * - [command2]
 * - [command3]
 */

const FeatureName = require('../../src/[feature]');
const ResponseFormatter = require('../../src/utils/response-formatter');

class FeatureHandler {
  constructor(options = {}) {
    this.feature = new FeatureName(options);
    this.logger = require('../../src/utils/logger')('[FeatureHandler]');
  }

  /**
   * Handle [command1] WebSocket command
   * 
   * Input format:
   * {
   *   "action": "[command1]",
   *   "param1": "value1",
   *   "param2": "value2"
   * }
   * 
   * Response format:
   * {
   *   "success": true/false,
   *   "result": {...},
   *   "error": "error message if failed"
   * }
   */
  async handleCommand1(params) {
    try {
      // Validate parameters
      if (!params.param1) {
        return ResponseFormatter.error('param1 required');
      }

      // Execute feature
      const result = await this.feature.methodName(params);

      // Return success response
      return ResponseFormatter.success(result);
    } catch (error) {
      this.logger.error('command1_failed', { error: error.message });
      return ResponseFormatter.error(error.message);
    }
  }

  /**
   * Handle [command2] WebSocket command
   */
  async handleCommand2(params) {
    // Implementation
  }

  /**
   * Register all handlers
   * Call this during WebSocket server initialization
   */
  registerHandlers(server) {
    server.on('[command1]', (params, callback) => {
      this.handleCommand1(params).then(callback);
    });

    server.on('[command2]', (params, callback) => {
      this.handleCommand2(params).then(callback);
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.feature.cleanup();
  }
}

module.exports = FeatureHandler;
```

#### Step 3.2: Integrate Handler into WebSocket Server

**In `/websocket/server.js`:**
```javascript
// At the top with other imports
const FeatureHandler = require('./handlers/[feature]-handler');

// In WebSocket server initialization
class WebSocketServer {
  constructor() {
    // ... existing code ...
    
    // Initialize feature handler
    this.featureHandler = new FeatureHandler();
    this.featureHandler.registerHandlers(this);
  }

  // Ensure cleanup on server shutdown
  async shutdown() {
    await this.featureHandler.cleanup();
    // ... other cleanup ...
  }
}
```

#### Step 3.3: Document WebSocket API

**API Documentation Template:**
```javascript
/**
 * WebSocket Commands for [Feature]
 * 
 * Base URL: ws://localhost:8765
 * 
 * All responses include:
 * {
 *   "success": boolean,
 *   "result": object,      // Only if success: true
 *   "error": string        // Only if success: false
 * }
 */

// Command 1: [command1]
{
  "action": "[command1]",
  "param1": "value1",
  "param2": "value2"
}

// Response (Success)
{
  "success": true,
  "result": {
    "field1": "value",
    "field2": 123
  }
}

// Response (Error)
{
  "success": false,
  "error": "Error description"
}

// Command 2: [command2]
{
  "action": "[command2]",
  "param1": "value"
}
```

---

# PART 2: FEATURE CHECKLIST

## Comprehensive Pre-Release Checklist

### Development Checklist

**Code Implementation**
- [ ] Feature module created in `/src/[feature]/`
- [ ] Core logic implemented in `core.js`
- [ ] Configuration file created (`config.js`)
- [ ] Utils created if needed (`utils.js`)
- [ ] Module properly exports public API (`index.js`)
- [ ] All public methods have JSDoc comments
- [ ] Error handling implemented (no silent failures)
- [ ] Timeout protection added for long operations
- [ ] Resource cleanup implemented (cleanup method)
- [ ] No hardcoded values (all in config)

**WebSocket Integration**
- [ ] Handler created in `websocket/handlers/[feature]-handler.js`
- [ ] All commands implemented
- [ ] Handler registered in WebSocket server
- [ ] Parameter validation in handler
- [ ] Response formatting consistent
- [ ] Error messages clear and actionable
- [ ] Timeout handling for long-running commands

**Code Quality**
- [ ] No `console.log()` (use Logger instead)
- [ ] No `var` (use `const`/`let`)
- [ ] No global state (unless necessary)
- [ ] Consistent indentation (2 spaces)
- [ ] No trailing whitespace
- [ ] ESLint passes (if configured)
- [ ] No dead code
- [ ] Security: No code injection vulnerabilities
- [ ] Security: Proper input validation

### Testing Checklist

**Unit Tests**
- [ ] Test file created: `/tests/[feature].test.js`
- [ ] 20+ test cases total
- [ ] Basic functionality tests (happy path)
- [ ] Error handling tests
- [ ] Edge case tests
- [ ] Performance tests (<100ms expectations)
- [ ] Security tests (invalid input)
- [ ] Mocking/stubbing used appropriately
- [ ] All tests passing (npm test)
- [ ] >90% code coverage for new code

**Integration Tests**
- [ ] 5-10 integration tests created
- [ ] Tests use real (or mocked) WebSocket
- [ ] Tests verify end-to-end flow
- [ ] Tests verify integration with existing features
- [ ] No breaking changes to existing tests

**Performance Tests**
- [ ] Performance benchmarks established (baseline)
- [ ] Execution time <100ms (typical)
- [ ] Memory usage <5MB (typical)
- [ ] No memory leaks (stress test 1000+ operations)
- [ ] Concurrent operations tested (10+ parallel)

**Manual Testing**
- [ ] Feature works via WebSocket API
- [ ] Feature works via CLI tool (if applicable)
- [ ] Feature works in Docker container
- [ ] Error messages are clear
- [ ] Performance acceptable in real use

### Documentation Checklist

**API Documentation**
- [ ] WebSocket command format documented
- [ ] All parameters documented
- [ ] Return value format documented
- [ ] Error codes/messages documented
- [ ] Example requests/responses provided

**Feature Documentation**
- [ ] Feature guide created (`docs/[FEATURE].md`)
- [ ] Feature overview (1 paragraph)
- [ ] Use cases documented (3-5 scenarios)
- [ ] Examples provided (code samples)
- [ ] Performance characteristics noted
- [ ] Limitations documented
- [ ] Related features/commands listed

**Developer Documentation**
- [ ] Internal code documented (JSDoc)
- [ ] Configuration options documented
- [ ] Integration points clear
- [ ] Testing guide provided
- [ ] Troubleshooting guide provided

**Release Documentation**
- [ ] CHANGELOG entry added
- [ ] Breaking changes noted
- [ ] Migration guide if needed
- [ ] Version number updated

### Deployment Checklist

**Build & Packaging**
- [ ] npm install works without errors
- [ ] npm test passes (all tests)
- [ ] npm run build succeeds
- [ ] Docker image builds successfully
- [ ] No console errors on startup

**Staging Validation**
- [ ] Deploy to staging environment
- [ ] Run smoke tests in staging
- [ ] Run load test (50 concurrent)
- [ ] Monitor memory/CPU usage
- [ ] Monitor error logs
- [ ] Test with real data (if applicable)

**Documentation Review**
- [ ] Documentation is accurate
- [ ] Examples actually work
- [ ] No outdated references
- [ ] Cross-references correct
- [ ] Formatting consistent

---

# PART 3: TESTING STRATEGY

## Unit Test Structure and Patterns

### Test File Organization

**File Location:** `/tests/[feature-name].test.js`

**Template Structure:**
```javascript
/**
 * Tests for [Feature Name]
 * Tests: [what is tested]
 */

const ModuleName = require('../src/[feature]/index');
const assert = require('assert');

describe('[Feature Name]', () => {
  let instance;

  // Setup/teardown
  before(() => {
    instance = new ModuleName({ /* test options */ });
  });

  after(async () => {
    await instance.cleanup();
  });

  describe('Functionality Category 1', () => {
    it('should do expected behavior', async () => {
      const result = await instance.method();
      assert.strictEqual(result.success, true);
      assert(result.data);
    });

    it('should handle edge case', async () => {
      // Test edge cases
    });
  });

  describe('Error Handling', () => {
    it('should throw on invalid input', async () => {
      try {
        await instance.method(null);
        assert.fail('Should have thrown');
      } catch (error) {
        assert(error.message.includes('required'));
      }
    });
  });

  describe('Performance', () => {
    it('should complete within timeout', async () => {
      const start = Date.now();
      await instance.method();
      const duration = Date.now() - start;
      assert(duration < 100, `Expected <100ms, got ${duration}ms`);
    });
  });
});
```

### Test Patterns by Category

#### 1. Happy Path Tests
```javascript
describe('Basic Functionality', () => {
  it('should process valid input correctly', async () => {
    const input = { /* valid data */ };
    const result = await instance.process(input);
    
    assert.strictEqual(result.success, true);
    assert(result.result);
    assert.strictEqual(result.result.status, 'completed');
  });

  it('should return expected data structure', async () => {
    const result = await instance.method();
    
    assert('field1' in result.result);
    assert('field2' in result.result);
    assert.strictEqual(typeof result.result.field1, 'string');
    assert.strictEqual(typeof result.result.field2, 'number');
  });
});
```

#### 2. Error Handling Tests
```javascript
describe('Error Handling', () => {
  it('should reject invalid input', async () => {
    try {
      await instance.method(null);
      assert.fail('Should have thrown');
    } catch (error) {
      assert(error);
      assert(error.message.includes('invalid'));
    }
  });

  it('should provide clear error messages', async () => {
    try {
      await instance.method({ missing: 'required_field' });
    } catch (error) {
      assert.strictEqual(error.message, 'Field X is required');
    }
  });

  it('should handle missing optional parameters', async () => {
    const result = await instance.method({ required: 'value' });
    assert.strictEqual(result.success, true);
  });
});
```

#### 3. Edge Case Tests
```javascript
describe('Edge Cases', () => {
  it('should handle empty input', async () => {
    const result = await instance.method({ data: [] });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result.count, 0);
  });

  it('should handle very large input', async () => {
    const largeInput = new Array(10000).fill('data');
    const result = await instance.method(largeInput);
    assert.strictEqual(result.success, true);
  });

  it('should handle special characters', async () => {
    const input = { text: '<script>alert("xss")</script>' };
    const result = await instance.method(input);
    assert(!result.result.includes('<script>'));
  });
});
```

#### 4. Performance Tests
```javascript
describe('Performance', () => {
  it('should complete within expected time', async () => {
    const start = Date.now();
    await instance.method(testData);
    const duration = Date.now() - start;
    
    assert(
      duration < 100,
      `Expected <100ms, got ${duration}ms`
    );
  });

  it('should have acceptable memory usage', async () => {
    const memBefore = process.memoryUsage().heapUsed;
    await instance.method(testData);
    const memAfter = process.memoryUsage().heapUsed;
    const increase = memAfter - memBefore;
    
    assert(
      increase < 5242880,  // 5MB
      `Memory increase ${increase} exceeds 5MB limit`
    );
  });

  it('should handle concurrent operations', async () => {
    const promises = Array(10).fill(null).map(() => 
      instance.method(testData)
    );
    
    const results = await Promise.all(promises);
    assert.strictEqual(results.length, 10);
    assert(results.every(r => r.success));
  });
});
```

#### 5. Security Tests
```javascript
describe('Security', () => {
  it('should sanitize user input', async () => {
    const maliciousInput = { 
      command: 'rm -rf /',
      code: 'process.exit()'
    };
    
    const result = await instance.method(maliciousInput);
    // Verify no command execution
    assert(result.success);
  });

  it('should not expose internal state', async () => {
    const result = await instance.method({});
    assert(!result.result.__proto__);
    assert(!result.result.constructor);
  });

  it('should validate input types strictly', async () => {
    try {
      await instance.method({ 
        requiredNumber: "not a number" 
      });
      assert.fail('Should have rejected invalid type');
    } catch (error) {
      assert(error);
    }
  });
});
```

### Mock/Stub Patterns

**Using Sinon for Mocking:**
```javascript
const sinon = require('sinon');
const Module = require('../src/module');

describe('Module with Dependencies', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should call dependency with correct arguments', async () => {
    // Stub external dependency
    const stub = sandbox.stub(Module.prototype, 'externalCall')
      .resolves({ data: 'mocked' });

    const instance = new Module();
    const result = await instance.method();

    // Verify stub was called
    assert(stub.called);
    assert.strictEqual(stub.callCount, 1);
    assert.deepStrictEqual(stub.firstCall.args, ['expected', 'args']);
  });

  it('should handle dependency errors', async () => {
    // Stub to throw error
    const stub = sandbox.stub(Module.prototype, 'externalCall')
      .rejects(new Error('External service down'));

    const instance = new Module();
    
    try {
      await instance.method();
      assert.fail('Should have thrown');
    } catch (error) {
      assert(error.message.includes('External service'));
    }
  });
});
```

### Running Tests

**Single Feature:**
```bash
npm test -- tests/[feature-name].test.js
```

**All Tests:**
```bash
npm test
```

**With Coverage:**
```bash
npm test -- --coverage
```

**Specific Test Suite:**
```bash
npm test -- --grep "Suite Name"
```

---

## Integration Testing

### Integration Test Structure

**File Location:** `/tests/integration/[feature-name]-integration.test.js`

**Template:**
```javascript
/**
 * Integration tests for [Feature]
 * Tests: Feature integration with WebSocket API and other modules
 */

const WebSocketServer = require('../../websocket/server');
const assert = require('assert');

describe('[Feature] Integration', () => {
  let server;
  let client;

  before(async () => {
    // Start WebSocket server
    server = new WebSocketServer();
    await server.start();

    // Create test client
    client = createTestClient('ws://localhost:8765');
  });

  after(async () => {
    await client.close();
    await server.stop();
  });

  describe('WebSocket Integration', () => {
    it('should process command via WebSocket', async () => {
      const response = await client.send({
        action: '[command]',
        param: 'value'
      });

      assert.strictEqual(response.success, true);
      assert(response.result);
    });

    it('should maintain state across commands', async () => {
      // Send command 1
      const resp1 = await client.send({
        action: '[command1]',
        data: 'initial'
      });

      // Send command 2
      const resp2 = await client.send({
        action: '[command2]'
      });

      // Verify state maintained
      assert.strictEqual(resp2.result.previousData, 'initial');
    });
  });

  describe('Interaction with Other Features', () => {
    it('should work with session management', async () => {
      // Create session
      const sessionResp = await client.send({
        action: 'create_session'
      });
      const sessionId = sessionResp.result.id;

      // Use feature in session
      const featureResp = await client.send({
        action: '[feature-command]',
        session_id: sessionId
      });

      assert.strictEqual(featureResp.success, true);
    });

    it('should integrate with authentication', async () => {
      // Setup auth
      await client.send({
        action: 'authenticate',
        credentials: testCredentials
      });

      // Use feature
      const resp = await client.send({
        action: '[feature-command]'
      });

      assert.strictEqual(resp.success, true);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from transient failure', async () => {
      // Simulate failure
      const failResp = await client.send({
        action: '[command]',
        shouldFail: true
      });

      assert.strictEqual(failResp.success, false);

      // Retry should succeed
      const retryResp = await client.send({
        action: '[command]'
      });

      assert.strictEqual(retryResp.success, true);
    });
  });
});
```

### Integration Test Checklist

- [ ] Tests use real WebSocket API (or comprehensive mock)
- [ ] Tests verify end-to-end workflow
- [ ] Tests check interaction with existing features
- [ ] Tests verify error handling
- [ ] Tests verify state management
- [ ] Tests include 5-10 scenarios
- [ ] Tests complete in <10 seconds each
- [ ] All integration tests passing

---

## Performance Testing

### Baseline Methodology

**Step 1: Establish Baseline**
```javascript
// Measure before changes
const baseline = {
  executionTime: {
    p50: 25,   // milliseconds
    p95: 75,
    p99: 95
  },
  memory: {
    initial: 8000000,     // bytes
    peak: 12000000,
    perOperation: 5000000
  },
  throughput: 100         // operations/second
};
```

**Step 2: Load Testing Script**
```javascript
/**
 * Load testing for [Feature]
 * Run: node tests/performance/[feature]-load-test.js
 */

const ModuleName = require('../../src/[feature]');
const assert = require('assert');

async function loadTest() {
  const instance = new ModuleName();
  
  const config = {
    iterations: 1000,
    concurrency: 10,
    timeout: 30000
  };

  console.log('Starting load test...');
  console.log(config);

  const startTime = Date.now();
  const times = [];
  const errors = [];

  try {
    // Run concurrent operations
    for (let batch = 0; batch < config.iterations / config.concurrency; batch++) {
      const promises = Array(config.concurrency).fill(null).map(async () => {
        const opStart = Date.now();
        try {
          const result = await instance.method(testData);
          times.push(Date.now() - opStart);
          return { success: true };
        } catch (error) {
          errors.push(error.message);
          return { success: false };
        }
      });

      await Promise.all(promises);
    }

    // Calculate metrics
    const totalTime = Date.now() - startTime;
    const sorted = times.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    console.log('\nResults:');
    console.log(`Total operations: ${config.iterations}`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Throughput: ${config.iterations / (totalTime / 1000)} ops/sec`);
    console.log(`P50: ${p50}ms`);
    console.log(`P95: ${p95}ms`);
    console.log(`P99: ${p99}ms`);
    console.log(`Errors: ${errors.length}`);

    // Verify against baseline
    assert(p50 < 50, `P50 ${p50}ms exceeds 50ms baseline`);
    assert(p99 < 150, `P99 ${p99}ms exceeds 150ms baseline`);
    assert(errors.length < 10, `${errors.length} errors exceed 10 threshold`);

    console.log('\nLoad test PASSED');
  } catch (error) {
    console.error('Load test FAILED:', error.message);
    process.exit(1);
  } finally {
    await instance.cleanup();
  }
}

loadTest().catch(console.error);
```

### Load Testing Procedures

**50 Concurrent Connections:**
```bash
# Test with 50 concurrent operations
node tests/performance/[feature]-load-test.js --concurrency 50 --iterations 1000
```

**100 Concurrent Connections:**
```bash
# Test with 100 concurrent operations
node tests/performance/[feature]-load-test.js --concurrency 100 --iterations 2000
```

**200 Concurrent Connections:**
```bash
# Test with 200 concurrent operations
# Pre-release validation
node tests/performance/[feature]-load-test.js --concurrency 200 --iterations 5000
```

**Performance Acceptance Criteria:**
| Metric | 50 Concurrent | 100 Concurrent | 200 Concurrent |
|--------|---------------|---|---|
| P50 Latency | <50ms | <75ms | <100ms |
| P95 Latency | <100ms | <150ms | <200ms |
| P99 Latency | <150ms | <200ms | <300ms |
| Error Rate | <1% | <2% | <3% |
| Throughput | >200 ops/sec | >100 ops/sec | >50 ops/sec |

---

## Memory Leak Detection

**Monthly Stress Test:**
```javascript
/**
 * Memory leak detection test
 * Run: node tests/performance/memory-leak-test.js
 * Duration: 24 hours (or configurable)
 */

const ModuleName = require('../../src/[feature]');

async function memoryLeakTest() {
  const instance = new ModuleName();
  const results = [];
  const durationHours = 24;
  const intervalMinutes = 5;
  const iterations = (durationHours * 60) / intervalMinutes;

  console.log(`Starting ${durationHours}-hour memory leak test...`);
  console.log(`Sampling every ${intervalMinutes} minutes`);

  for (let i = 0; i < iterations; i++) {
    // Run operations
    const promises = Array(100).fill(null).map(() => 
      instance.method(testData)
    );
    await Promise.all(promises);

    // Take memory snapshot
    const mem = process.memoryUsage();
    results.push({
      iteration: i,
      time: new Date(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss
    });

    // Log progress every 10 iterations
    if ((i + 1) % 10 === 0) {
      console.log(`Iteration ${i + 1}/${iterations}`);
      console.log(`  Heap: ${Math.round(mem.heapUsed / 1048576)}MB`);
    }

    // Pause between iterations
    await new Promise(resolve => setTimeout(resolve, intervalMinutes * 60 * 1000));
  }

  // Analyze results
  const firstHeap = results[0].heapUsed;
  const lastHeap = results[results.length - 1].heapUsed;
  const growth = lastHeap - firstHeap;
  const growthRate = growth / firstHeap * 100;

  console.log('\nMemory Leak Analysis:');
  console.log(`Initial heap: ${Math.round(firstHeap / 1048576)}MB`);
  console.log(`Final heap: ${Math.round(lastHeap / 1048576)}MB`);
  console.log(`Growth: ${Math.round(growth / 1048576)}MB`);
  console.log(`Growth rate: ${growthRate.toFixed(2)}%`);

  // Failure criteria
  if (growthRate > 10) {
    console.error('FAIL: Memory growth exceeds 10%');
    process.exit(1);
  }

  console.log('PASS: No memory leaks detected');
  await instance.cleanup();
}

memoryLeakTest().catch(console.error);
```

---

# PART 4: DOCUMENTATION TEMPLATE

## Feature Documentation Structure

### Complete Feature Guide Template

**File Location:** `/docs/[FEATURE-NAME].md`

**Template:**
```markdown
# [Feature Name] Guide
## Complete Feature Documentation for [Basset Hound Browser]

**Version:** 1.0  
**Status:** [Implemented/Beta/Planned]  
**Release:** v12.1.0 (June 15, 2026)  
**Last Updated:** [Date]

---

## Table of Contents

1. [Overview](#overview)
2. [Use Cases](#use-cases)
3. [Quick Start](#quick-start)
4. [API Reference](#api-reference)
5. [Examples](#examples)
6. [Performance](#performance)
7. [Limitations](#limitations)
8. [Troubleshooting](#troubleshooting)
9. [Related Features](#related-features)

---

## Overview

### What is [Feature Name]?

**Brief Description (1 paragraph):**
[Clear, concise description of what the feature does, who it's for, and why it matters]

### Key Capabilities

- Capability 1: Description
- Capability 2: Description
- Capability 3: Description
- Capability 4: Description

### When to Use This Feature

Use [Feature Name] when you need to:
- [Use case 1]
- [Use case 2]
- [Use case 3]

### What You Should Know

- Supported in: Basset Hound Browser v12.1.0+
- WebSocket API: Yes (command: `[command_name]`)
- CLI: Yes (command: `node scripts/[feature]-cli.js`)
- Docker: Yes (included in base image)
- Security: [Security considerations]

---

## Use Cases

### Use Case 1: [Scenario 1]

**Goal:** [What the user wants to accomplish]

**Step-by-Step:**
1. [Step 1 with code example]
2. [Step 2 with code example]
3. [Step 3 with code example]

**Expected Result:** [What success looks like]

**Code Example:**
\`\`\`javascript
// Example code
\`\`\`

### Use Case 2: [Scenario 2]

[Similar structure]

### Use Case 3: [Scenario 3]

[Similar structure]

---

## Quick Start

### Installation

**Option 1: Via WebSocket API**
\`\`\`bash
# Feature is built-in, no installation needed
# WebSocket server listens on port 8765
\`\`\`

**Option 2: Via CLI**
\`\`\`bash
node scripts/[feature]-cli.js --help
\`\`\`

**Option 3: In Docker**
\`\`\`bash
docker run -p 8765:8765 basset-hound-browser
# Feature is automatically available
\`\`\`

### Basic Usage

**Via WebSocket:**
\`\`\`javascript
const ws = new WebSocket('ws://localhost:8765');

ws.send(JSON.stringify({
  action: '[command_name]',
  param1: 'value1'
}));

ws.on('message', (msg) => {
  const response = JSON.parse(msg);
  console.log(response.result);
});
\`\`\`

**Via CLI:**
\`\`\`bash
node scripts/[feature]-cli.js --input data.json
\`\`\`

---

## API Reference

### Command: [command_name]

**Description:** [What this command does]

**WebSocket Format:**
\`\`\`javascript
{
  "action": "[command_name]",
  "param1": "string",           // Required: Description
  "param2": 123,                // Optional: Description
  "timeout": 30000              // Optional: Timeout in ms (default: 30000)
}
\`\`\`

**Response (Success):**
\`\`\`javascript
{
  "success": true,
  "result": {
    "field1": "value",
    "field2": 123,
    "field3": {
      "nested": "data"
    }
  }
}
\`\`\`

**Response (Error):**
\`\`\`javascript
{
  "success": false,
  "error": "Error description"
}
\`\`\`

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| param1 | string | Yes | Description of param1 |
| param2 | number | No | Description of param2 |
| timeout | number | No | Operation timeout (ms) |

**Returns:**
| Field | Type | Description |
|-------|------|-------------|
| field1 | string | Description |
| field2 | number | Description |

**Errors:**
| Error | Cause | Solution |
|-------|-------|----------|
| "param1 required" | Missing param1 | Provide param1 value |
| "Timeout" | Operation exceeded timeout | Increase timeout value |
| "Invalid input" | param1 format incorrect | Check param1 format |

**Example:**
\`\`\`javascript
// Send command
ws.send(JSON.stringify({
  action: "[command_name]",
  param1: "example"
}));

// Receive response
// {
//   "success": true,
//   "result": { ... }
// }
\`\`\`

---

## Examples

### Example 1: [Scenario]

**Goal:** [What this example demonstrates]

**Code:**
\`\`\`javascript
// Full working example
const Feature = require('basset-hound-browser');

async function example() {
  const feature = new Feature();
  
  try {
    const result = await feature.method({
      param: 'value'
    });
    
    console.log('Success:', result);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await feature.cleanup();
  }
}

example();
\`\`\`

**Output:**
\`\`\`
Success: { ... }
\`\`\`

### Example 2: [Scenario]

[Similar structure]

### Example 3: [Scenario]

[Similar structure]

---

## Performance

### Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Execution Time (P50) | <25ms | Typical operation |
| Execution Time (P95) | <75ms | 95th percentile |
| Execution Time (P99) | <100ms | 99th percentile |
| Memory Usage | <5MB | Per operation |
| Concurrent Operations | 10+ | Supported |
| Throughput | >100 ops/sec | At 50 concurrent |

### Performance Tuning

**For Better Performance:**
1. Enable caching (if available)
2. Use connection pooling
3. Batch operations when possible
4. Monitor for memory leaks

**For Lower Memory Usage:**
1. Process data in chunks
2. Clear caches periodically
3. Use compression if available

---

## Limitations

### Current Limitations

1. **Limitation 1:** [Description]
   - Workaround: [How to work around]

2. **Limitation 2:** [Description]
   - Workaround: [How to work around]

3. **Limitation 3:** [Description]
   - Workaround: [How to work around]

### Planned Enhancements (v12.2.0+)

- [ ] Enhancement 1: [Description]
- [ ] Enhancement 2: [Description]
- [ ] Enhancement 3: [Description]

---

## Troubleshooting

### Problem: [Issue 1]

**Symptoms:** [How you'll know you have this problem]

**Root Cause:** [Why this happens]

**Solution:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Prevention:** [How to avoid this in future]

### Problem: [Issue 2]

[Similar structure]

### Problem: [Issue 3]

[Similar structure]

---

## Related Features

**Features that work well with [Feature Name]:**

- Related Feature 1 - How they work together
- Related Feature 2 - How they work together
- Related Feature 3 - How they work together

**Features that depend on [Feature Name]:**

- [Dependent Feature 1] - Why it depends
- [Dependent Feature 2] - Why it depends

---

## FAQ

**Q: Can I use [Feature Name] with [Other Feature]?**
A: Yes/No. [Explanation]

**Q: What's the maximum [resource]?**
A: [Limit]. You can [workaround if applicable].

**Q: Is [Feature Name] secure?**
A: Yes. [Security details].

---

## Support & Feedback

**Found a bug?** Report it at: [GitHub issues link]

**Have a feature request?** Share it at: [Discussion link]

**Need help?** Check out: [Documentation link]

---

**Document Status:** Complete  
**Last Updated:** [Date]  
**Maintained By:** [Team/Person]

\`\`\`

---

## Release Notes Template

**File:** `/docs/RELEASE-NOTES-v12.1.0.md`

\`\`\`markdown
## New Features in v12.1.0

### [Feature Name] (NEW)

**What's New:**
- Feature overview
- Key capabilities
- Use cases

**Commands Added:**
- `[command1]` - Description
- `[command2]` - Description

**WebSocket API:**
See Feature Documentation for details

**Performance:**
- P50: <25ms
- P99: <100ms
- Throughput: 100+ ops/sec

**Breaking Changes:** None

**Migration Guide:**
No migration needed for existing code.

\`\`\`

---

# PART 5: QUALITY GATES

## Pre-Merge Checklist

### Code Quality Gate

**Must Pass Before Merge:**
- [ ] All code follows project style guide
- [ ] ESLint passes (0 errors, 0 critical warnings)
- [ ] No `console.log()` (use Logger instead)
- [ ] No hardcoded values (use config)
- [ ] No dead code
- [ ] All public methods have JSDoc
- [ ] Parameter validation on all inputs
- [ ] Error handling (no swallowing exceptions)
- [ ] Resource cleanup implemented
- [ ] No security vulnerabilities (code review)

**Automated Checks:**
```bash
npm run lint
npm run test
npm run security-check
```

### Test Quality Gate

**All Tests Passing:**
- [ ] Unit tests: ✅ All passing
- [ ] Integration tests: ✅ All passing
- [ ] Performance tests: ✅ Within baseline
- [ ] Coverage: >90% for new code
- [ ] No flaky tests
- [ ] Load test: 50 concurrent ✅

**Run Tests:**
```bash
npm test
npm run test:coverage
npm run test:load
```

### Documentation Quality Gate

**Documentation Complete:**
- [ ] Feature guide written and reviewed
- [ ] API documentation complete and accurate
- [ ] Examples tested and working
- [ ] JSDoc comments on all public methods
- [ ] README updated
- [ ] Release notes prepared
- [ ] Cross-references correct

---

## Code Review Checklist

### Functionality Review

**Does the code work?**
- [ ] Feature achieves stated goals
- [ ] All acceptance criteria met
- [ ] No breaking changes to existing API
- [ ] Backward compatibility maintained
- [ ] Error handling complete
- [ ] Edge cases handled
- [ ] Performance acceptable

### Security Review

**Is the code secure?**
- [ ] Input validation on all parameters
- [ ] No code injection vulnerabilities
- [ ] No sensitive data exposed
- [ ] No hardcoded credentials
- [ ] Dependencies are safe
- [ ] No privilege escalation
- [ ] Proper error messages (no leaks)

### Maintainability Review

**Will this be easy to maintain?**
- [ ] Code is readable and clear
- [ ] Variable/function names are descriptive
- [ ] Complex logic has comments
- [ ] No unnecessary complexity
- [ ] DRY principle followed
- [ ] Design patterns used appropriately
- [ ] Consistent with codebase style

### Performance Review

**Is performance acceptable?**
- [ ] No N+1 queries
- [ ] Caching used appropriately
- [ ] No memory leaks
- [ ] Concurrent operations safe
- [ ] Resource cleanup verified
- [ ] Timeout protection present
- [ ] Performance baseline met

---

## Documentation Review Checklist

### Content Review

**Is documentation accurate?**
- [ ] Feature description is correct
- [ ] Use cases are realistic
- [ ] API documentation complete
- [ ] Examples are accurate
- [ ] Code samples actually work
- [ ] Performance data is correct
- [ ] Limitations are documented

### Clarity Review

**Is documentation clear?**
- [ ] Written for target audience
- [ ] Consistent terminology
- [ ] Clear structure with headings
- [ ] Sufficient detail (not too terse)
- [ ] Not overly complex
- [ ] Actionable steps
- [ ] Good examples

### Completeness Review

**Is documentation complete?**
- [ ] All commands documented
- [ ] All parameters explained
- [ ] Error cases covered
- [ ] Troubleshooting included
- [ ] Related features linked
- [ ] FAQ addresses common questions
- [ ] Support contact information

---

## Release Checklist

### Pre-Release

**Code & Testing:**
- [ ] All tests passing (npm test)
- [ ] Code review completed
- [ ] Load testing passed (200 concurrent)
- [ ] No critical/high severity issues
- [ ] Performance acceptable
- [ ] No regressions detected

**Documentation:**
- [ ] Feature guides complete
- [ ] API reference complete
- [ ] Examples verified
- [ ] Release notes prepared
- [ ] Changelog updated
- [ ] Migration guide (if needed)

**Deployment:**
- [ ] Docker image builds
- [ ] Staging deployment successful
- [ ] Smoke tests passing
- [ ] No deployment errors
- [ ] Monitoring configured
- [ ] Rollback plan ready

### Version Management

**Version Bump:**
- [ ] Increment version number (semantic)
- [ ] Update package.json
- [ ] Update version in all docs
- [ ] Tag git commit
- [ ] Document breaking changes

**Breaking Changes:**
If breaking changes present:
- [ ] Major version bump required
- [ ] Migration guide written
- [ ] Deprecation warnings added
- [ ] Timeline for removal documented
- [ ] Backward compatibility option considered

---

# PART 6: COMMON PATTERNS

## How to Add a WebSocket Command

### Step 1: Define the Command

```javascript
/**
 * New WebSocket command: [command_name]
 * 
 * Request:
 * {
 *   "action": "[command_name]",
 *   "param1": "value1",
 *   "param2": "value2"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "result": { ... }
 * }
 */
```

### Step 2: Implement Handler

```javascript
// In src/[feature]/index.js

async handleNewCommand(params) {
  // Validate input
  if (!params.param1) {
    return { success: false, error: 'param1 required' };
  }

  try {
    // Call core functionality
    const result = await this.core.executeCommand(params);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### Step 3: Register Handler

```javascript
// In websocket/handlers/[feature]-handler.js

registerHandlers(server) {
  server.on('[command_name]', async (params, callback) => {
    const result = await this.handleNewCommand(params);
    callback(result);
  });
}
```

### Step 4: Test the Command

```javascript
// In tests/[feature].test.js

describe('[command_name]', () => {
  it('should execute with valid parameters', async () => {
    const result = await instance.handleNewCommand({
      param1: 'value1',
      param2: 'value2'
    });

    assert.strictEqual(result.success, true);
    assert(result.result);
  });

  it('should reject missing parameters', async () => {
    const result = await instance.handleNewCommand({});
    assert.strictEqual(result.success, false);
  });
});
```

---

## How to Add Input Validation

```javascript
/**
 * Validate command input
 * @private
 */
validateInput(params) {
  // Check required fields
  if (!params.required_field) {
    throw new Error('required_field is required');
  }

  // Check types
  if (typeof params.number_field !== 'number') {
    throw new Error('number_field must be a number');
  }

  // Check ranges
  if (params.timeout < 1000 || params.timeout > 300000) {
    throw new Error('timeout must be between 1000 and 300000');
  }

  // Check string format
  if (!/^[a-zA-Z0-9_]+$/.test(params.identifier)) {
    throw new Error('identifier format invalid');
  }

  // Array validation
  if (!Array.isArray(params.items) || params.items.length === 0) {
    throw new Error('items must be a non-empty array');
  }

  // Object validation
  if (typeof params.config !== 'object' || !params.config) {
    throw new Error('config must be an object');
  }

  // Custom validation
  if (params.mode && !['mode1', 'mode2', 'mode3'].includes(params.mode)) {
    throw new Error('mode must be one of: mode1, mode2, mode3');
  }
}
```

---

## How to Add Error Handling

```javascript
/**
 * Execute with comprehensive error handling
 */
async execute(params) {
  const startTime = Date.now();

  try {
    // Validate input
    this.validateInput(params);

    // Execute with timeout
    const result = await this.withTimeout(
      this.executeImpl(params),
      params.timeout || 30000
    );

    // Log success
    this.logger.info('execute_success', {
      duration: Date.now() - startTime,
      paramCount: Object.keys(params).length
    });

    return {
      success: true,
      result,
      duration: Date.now() - startTime
    };

  } catch (error) {
    // Log error with context
    this.logger.error('execute_failed', {
      error: error.message,
      errorCode: error.code || 'UNKNOWN',
      duration: Date.now() - startTime,
      stack: error.stack
    });

    // Return error response
    return {
      success: false,
      error: error.message,
      errorCode: this.mapErrorCode(error),
      duration: Date.now() - startTime
    };
  }
}

/**
 * Map error to standard error code
 * @private
 */
mapErrorCode(error) {
  if (error.message.includes('required')) {
    return 'MISSING_PARAMETER';
  }
  if (error.message.includes('Timeout')) {
    return 'OPERATION_TIMEOUT';
  }
  if (error.message.includes('Invalid')) {
    return 'INVALID_INPUT';
  }
  return 'INTERNAL_ERROR';
}
```

---

## How to Add Timeout/Retry Logic

```javascript
/**
 * Execute with timeout protection
 * @private
 */
async withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), ms)
    )
  ]);
}

/**
 * Retry logic with exponential backoff
 * @private
 */
async retryWithBackoff(operation, options = {}) {
  const {
    maxAttempts = 3,
    initialDelay = 100,
    maxDelay = 5000
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        // Calculate exponential backoff
        const delay = Math.min(
          initialDelay * Math.pow(2, attempt - 1),
          maxDelay
        );

        this.logger.warn('retry_attempt', {
          attempt,
          nextAttemptIn: delay,
          error: error.message
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Usage:
 */
const result = await this.retryWithBackoff(
  () => this.executeImpl(params),
  { maxAttempts: 3, initialDelay: 100 }
);
```

---

## How to Add Logging

```javascript
/**
 * Structured logging
 */
const Logger = require('../utils/logger');

class Feature {
  constructor(config) {
    this.logger = new Logger('FeatureName');
    this.logger.info('feature_initialized', {
      config: this.sanitizeConfig(config),
      version: '1.0.0'
    });
  }

  async method(input) {
    const requestId = this.generateRequestId();

    try {
      this.logger.debug('method_started', {
        requestId,
        inputSize: JSON.stringify(input).length
      });

      const result = await this.process(input);

      this.logger.info('method_success', {
        requestId,
        resultSize: JSON.stringify(result).length
      });

      return result;

    } catch (error) {
      this.logger.error('method_failed', {
        requestId,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Sanitize config for logging (remove sensitive data)
   * @private
   */
  sanitizeConfig(config) {
    const sanitized = { ...config };
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey'];
    
    sensitiveKeys.forEach(key => {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Generate unique request ID
   * @private
   */
  generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

---

## How to Add Performance Metrics

```javascript
/**
 * Track operation performance metrics
 */
class PerformanceTracker {
  constructor(name) {
    this.name = name;
    this.metrics = {
      totalOperations: 0,
      totalDuration: 0,
      errors: 0,
      timings: []
    };
  }

  /**
   * Record operation execution
   */
  record(duration, success = true) {
    this.metrics.totalOperations++;
    this.metrics.totalDuration += duration;
    this.metrics.timings.push(duration);

    if (!success) {
      this.metrics.errors++;
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const sorted = this.metrics.timings.sort((a, b) => a - b);
    const len = sorted.length;

    return {
      count: this.metrics.totalOperations,
      errors: this.metrics.errors,
      successRate: ((len - this.metrics.errors) / len * 100).toFixed(2) + '%',
      average: len > 0 ? Math.round(this.metrics.totalDuration / len) : 0,
      min: len > 0 ? sorted[0] : 0,
      max: len > 0 ? sorted[len - 1] : 0,
      p50: len > 0 ? sorted[Math.floor(len * 0.5)] : 0,
      p95: len > 0 ? sorted[Math.floor(len * 0.95)] : 0,
      p99: len > 0 ? sorted[Math.floor(len * 0.99)] : 0
    };
  }
}

/**
 * Usage:
 */
const tracker = new PerformanceTracker('FeatureName');

const startTime = Date.now();
try {
  // ... execute operation ...
  tracker.record(Date.now() - startTime, true);
} catch (error) {
  tracker.record(Date.now() - startTime, false);
}

console.log(tracker.getStats());
// {
//   count: 1000,
//   errors: 2,
//   successRate: '99.80%',
//   average: 45,
//   min: 12,
//   max: 234,
//   p50: 42,
//   p95: 89,
//   p99: 156
// }
```

---

# QUICK REFERENCE

## Directory Quick Links

```
/home/devel/basset-hound-browser/
├── src/                    # Source code
│   ├── [feature]/          # Your feature module
│   │   ├── index.js        # Main export
│   │   ├── core.js         # Core logic
│   │   └── config.js       # Configuration
│   └── utils/              # Shared utilities
├── websocket/
│   ├── server.js           # WebSocket server
│   └── handlers/           # Command handlers
├── tests/                  # Test files
│   ├── [feature].test.js   # Your feature tests
│   └── integration/        # Integration tests
└── docs/                   # Documentation
    ├── API-REFERENCE.md
    └── [FEATURE].md        # Your feature docs
```

## Development Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run specific test file
npm test -- tests/[feature].test.js

# Run with coverage
npm test -- --coverage

# Run linter
npm run lint

# Build Docker image
docker build -t basset-hound-browser .

# Start WebSocket server
npm start

# Run load test
node tests/performance/[feature]-load-test.js
```

## File Templates Summary

| Template | Purpose | Location |
|----------|---------|----------|
| index.js | Module export | `/src/[feature]/` |
| core.js | Core logic | `/src/[feature]/` |
| config.js | Configuration | `/src/[feature]/` |
| [feature].test.js | Unit tests | `/tests/` |
| [feature]-handler.js | WebSocket handler | `/websocket/handlers/` |
| [FEATURE].md | Documentation | `/docs/` |

## Testing Checklist

- [ ] 20+ unit tests
- [ ] 5-10 integration tests
- [ ] Performance tests (baseline)
- [ ] >90% code coverage
- [ ] Load test (50, 100, 200 concurrent)
- [ ] All tests passing

## Quality Gates

- [ ] Code review passed
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Performance acceptable
- [ ] No security issues
- [ ] Backward compatible

## Release Checklist

- [ ] Version bumped
- [ ] Changelog updated
- [ ] Documentation complete
- [ ] Tests passing
- [ ] Staging deployed
- [ ] Smoke tests passed

---

## Document Status

**Status:** Complete and Active  
**Version:** 1.0  
**Date:** May 31, 2026  
**Audience:** Development Team  
**Last Updated:** May 31, 2026

**How to Use This Guide:**

1. **Before Development:** Read Part 1 (Development Template)
2. **During Development:** Reference Part 6 (Common Patterns)
3. **During Testing:** Follow Part 3 (Testing Strategy)
4. **During Documentation:** Use Part 4 (Documentation Template)
5. **Before Merge:** Check Part 5 (Quality Gates)
6. **Quick Lookup:** Use Quick Reference section

---

**For questions or suggestions, contact the development team.**

**End of Feature Development Guide**
