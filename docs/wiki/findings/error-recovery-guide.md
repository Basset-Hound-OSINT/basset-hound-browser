# Error Recovery Strategies Guide

**Version:** 1.0  
**Last Updated:** June 22, 2026  
**Audience:** Backend engineers, integration teams, automation engineers  
**Scope:** Basset Hound Browser WebSocket API, connection management, and distributed operations

---

## Table of Contents

1. [Transient vs Permanent Errors](#transient-vs-permanent-errors)
2. [Retry Strategies Per Error Type](#retry-strategies-per-error-type)
3. [Graceful Degradation Patterns](#graceful-degradation-patterns)
4. [Connection Recovery](#connection-recovery)
5. [Implementation Checklist](#implementation-checklist)
6. [Real-World Examples](#real-world-examples)
7. [Monitoring & Alerts](#monitoring--alerts)

---

## Transient vs Permanent Errors

### Understanding Error Categories

All errors returned by the Basset Hound Browser WebSocket API fall into one of two categories. Understanding this distinction is critical for designing correct retry logic.

#### **Transient Errors (Retryable)**

Errors that are caused by temporary system conditions and may succeed if retried. The failure is not due to client input or permanent system state.

**Characteristics:**
- Time-dependent (temporary unavailability)
- Resource-dependent (temporary exhaustion)
- Environmental (network, service state)
- Self-healing (resolve without intervention)
- Safe to retry without modification

**Common Examples:**
- `COMMAND_TIMED_OUT` - Page loading slow, retry with patience
- `SYSTEM_BROWSER_CRASH` - Browser restarting, will be available soon
- `RATE_LIMIT_EXCEEDED` - Wait and retry within specified window
- `RESOURCE_UNAVAILABLE` - Service temporarily down
- `SYSTEM_OUT_OF_MEMORY` - Garbage collection, retry later
- `COMMAND_EXECUTION_ERROR` - Element not ready yet, retry shortly
- `BROWSER_NETWORK_ERROR` - Transient network issue
- `CONCURRENT_LIMIT_EXCEEDED` - Other operations finishing soon

**Recovery Pattern:**
```javascript
if (errorCode === 'RATE_LIMIT_EXCEEDED') {
  await delay(response.details.retryAfter * 1000);
  return retry(originalRequest);
}

if (errorCode === 'SYSTEM_BROWSER_CRASH') {
  await delay(2000); // Brief pause for auto-restart
  return retry(originalRequest);
}
```

#### **Permanent Errors (Non-Retryable)**

Errors that result from incorrect client input, configuration, or permanent system state. Retrying without modification will produce the same error.

**Characteristics:**
- Input-dependent (request is malformed)
- State-dependent (permanent condition)
- Client-caused (missing permission, invalid parameter)
- Requires intervention (fix config or input)
- Retrying identical request is wasteful

**Common Examples:**
- `VALIDATION_MISSING_REQUIRED_PARAM` - Client didn't provide parameter
- `VALIDATION_INVALID_PARAM_VALUE` - Client provided wrong value
- `COMMAND_NOT_FOUND` - Typo in command name
- `AUTH_INSUFFICIENT_PERMISSIONS` - Token lacks scope
- `SCRIPT_SYNTAX_ERROR` - JavaScript is malformed
- `RESOURCE_NOT_FOUND` - Resource ID is wrong
- `VALIDATION_MALFORMED_JSON` - JSON syntax error
- `COMMAND_DISABLED` - Not available in this config

**Recovery Pattern:**
```javascript
if (errorCode === 'VALIDATION_MISSING_REQUIRED_PARAM') {
  // Log error for developer
  logger.error(`Missing required parameter: ${response.details.parameter}`);
  // Don't retry - fix the client code
  return null;
}

if (errorCode === 'AUTH_INSUFFICIENT_PERMISSIONS') {
  // Alert admin - token scope issue
  notifyAdministrator('Insufficient permissions for command', response);
  return null;
}
```

### Quick Reference: Retryability Matrix

| Error Code | Category | Retryable | Why | Delay Strategy |
|-----------|----------|-----------|-----|-----------------|
| `VALIDATION_MISSING_REQUIRED_PARAM` | Validation | ✗ No | Client error, fix input | N/A |
| `VALIDATION_INVALID_PARAM_VALUE` | Validation | ✗ No | Client error, fix value | N/A |
| `VALIDATION_INVALID_PARAM_TYPE` | Validation | ✗ No | Client error, wrong type | N/A |
| `VALIDATION_MALFORMED_JSON` | Validation | ✗ No | Syntax error in request | N/A |
| `COMMAND_NOT_FOUND` | Validation | ✗ No | Typo in command name | N/A |
| `COMMAND_DISABLED` | Validation | ✗ No | Feature disabled | N/A |
| `AUTH_REQUIRED` | Auth | ✓ Yes | Provide token | Immediate + retry |
| `AUTH_INVALID_TOKEN` | Auth | ✓ Yes | Token expired/bad | Refresh token + retry |
| `AUTH_INSUFFICIENT_PERMISSIONS` | Auth | ✗ No | Token scope too narrow | N/A |
| `RATE_LIMIT_EXCEEDED` | Rate Limit | ✓ Yes | Too many requests | Exponential backoff |
| `CONCURRENT_LIMIT_EXCEEDED` | Rate Limit | ✓ Yes | Too many concurrent ops | Exponential backoff |
| `PAYLOAD_TOO_LARGE` | Payload | ✓ Yes | Request too big | Split + retry parts |
| `COMMAND_PAYLOAD_TOO_LARGE` | Payload | ✓ Yes | Command-specific limit | Reduce + retry |
| `COMMAND_TIMED_OUT` | Timeout | ✓ Yes | Slow operation | Exponential backoff |
| `COMMAND_EXECUTION_ERROR` | Execution | ✓ Yes | Temporary element issue | Exponential backoff |
| `BROWSER_NAVIGATION_FAILED` | Browser | ✓ Yes | Network/DNS issue | Exponential backoff |
| `BROWSER_TIMEOUT` | Browser | ✓ Yes | Page slow to load | Increase timeout + retry |
| `BROWSER_NOT_READY` | Browser | ✓ Yes | Still initializing | Short delay + retry |
| `BROWSER_NETWORK_ERROR` | Browser | ✓ Yes | Transient network | Exponential backoff |
| `SYSTEM_INTERNAL_ERROR` | System | ✓ Yes | Unexpected error | Exponential backoff |
| `SYSTEM_OUT_OF_MEMORY` | System | ✓ Yes | Memory pressure | Exponential backoff |
| `SYSTEM_BROWSER_CRASH` | System | ✓ Yes | Browser restarting | Short delay + retry |
| `RESOURCE_NOT_FOUND` | Resource | ✗ No | Wrong resource ID | N/A |
| `RESOURCE_LOCKED` | Resource | ✓ Yes | Temporary lock | Exponential backoff |
| `RESOURCE_ALREADY_EXISTS` | Resource | ✗ No | Duplicate ID | N/A |
| `RESOURCE_UNAVAILABLE` | Resource | ✓ Yes | Temporarily down | Exponential backoff |
| `SCRIPT_SYNTAX_ERROR` | Script | ✗ No | Invalid JavaScript | N/A |
| `SCRIPT_EXECUTION_ERROR` | Script | ✗ No | Script logic error | N/A |
| `SCRIPT_TIMEOUT` | Script | ✓ Yes | Script slow | Increase timeout + retry |
| `STORAGE_OPERATION_FAILED` | Storage | ✓ Yes | Transient failure | Exponential backoff |
| `STORAGE_QUOTA_EXCEEDED` | Storage | ✓ Yes | Clear storage + retry | Clear + retry |

---

## Retry Strategies Per Error Type

### 1. Exponential Backoff (Most Common)

Used for transient errors where the system is temporarily unavailable or overloaded.

**When to use:**
- Rate limiting (not burst-specific)
- Network errors
- System overload
- Browser crashes
- Generic timeouts

**Implementation:**

```javascript
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2.0,
  jitter: true // Add randomness to prevent thundering herd
};

async function retryWithExponentialBackoff(
  operation,
  config = DEFAULT_RETRY_CONFIG
) {
  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === config.maxRetries - 1) {
        throw error; // Last attempt failed
      }

      if (!isRetryableError(error)) {
        throw error; // Don't retry permanent errors
      }

      const delay = calculateBackoffDelay(attempt, config);
      console.log(`Retry ${attempt + 1}/${config.maxRetries} after ${delay}ms`);
      await sleep(delay);
    }
  }
}

function calculateBackoffDelay(attempt, config) {
  const baseDelay = config.baseDelayMs * Math.pow(
    config.backoffMultiplier,
    attempt
  );
  const cappedDelay = Math.min(baseDelay, config.maxDelayMs);

  if (config.jitter) {
    // Add ±10% jitter
    const jitterAmount = cappedDelay * 0.1;
    return cappedDelay + (Math.random() - 0.5) * 2 * jitterAmount;
  }

  return cappedDelay;
}
```

**Recommended Settings:**
```javascript
// For rate-limited endpoints
const RATE_LIMIT_RETRY = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2.0,
  jitter: true
};

// For general operations
const GENERAL_RETRY = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 10000,
  backoffMultiplier: 2.0,
  jitter: true
};

// For quick-recovery scenarios (browser crash, OOM)
const QUICK_RECOVERY_RETRY = {
  maxRetries: 4,
  baseDelayMs: 200,
  maxDelayMs: 5000,
  backoffMultiplier: 2.0,
  jitter: false
};
```

### 2. Immediate Retry with Exponential Backoff (Auth Refresh)

Used when the error provides explicit retry timing (e.g., rate limits with `retryAfter`).

**When to use:**
- `RATE_LIMIT_EXCEEDED` with `retryAfter` field
- `AUTH_INVALID_TOKEN` (refresh and retry)
- `CONCURRENT_LIMIT_EXCEEDED` with known wait time

**Implementation:**

```javascript
async function retryWithExplicitTiming(operation, response) {
  // Check if response provides explicit timing
  if (response.details?.retryAfter) {
    const waitMs = response.details.retryAfter * 1000;
    console.log(`Rate limited - waiting ${response.details.retryAfter}s`);
    await sleep(waitMs);
    return operation();
  }

  // Fallback to exponential backoff
  return retryWithExponentialBackoff(operation);
}

async function retryWithTokenRefresh(
  operation,
  refreshTokenFn,
  maxAttempts = 2
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (
        error.errorCode === 'AUTH_INVALID_TOKEN' &&
        attempt < maxAttempts - 1
      ) {
        console.log('Token invalid - refreshing...');
        await refreshTokenFn(); // Refresh the token
        // Retry immediately with new token
        continue;
      }
      throw error;
    }
  }
}
```

### 3. Adaptive Timeout Retry

Used for operations that timeout due to system load or page complexity.

**When to use:**
- `COMMAND_TIMED_OUT` with elapsed time close to timeout
- `BROWSER_TIMEOUT` for slow pages
- `SCRIPT_TIMEOUT` for heavy operations

**Implementation:**

```javascript
async function retryWithAdaptiveTimeout(
  operation,
  initialTimeoutMs,
  maxAttempts = 3
) {
  let currentTimeout = initialTimeoutMs;
  const timeoutIncrement = initialTimeoutMs * 0.5; // Increase by 50% each time

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await withTimeout(operation(), currentTimeout);
    } catch (error) {
      if (error.code === 'TIMEOUT' && attempt < maxAttempts - 1) {
        const nextTimeout = currentTimeout + timeoutIncrement;
        console.log(
          `Timeout (${currentTimeout}ms) - retrying with ${nextTimeout}ms timeout`
        );
        currentTimeout = nextTimeout;
        await sleep(500); // Brief pause before retry
        continue;
      }
      throw error;
    }
  }
}

// Usage
const screenshotResult = await retryWithAdaptiveTimeout(
  () => browser.screenshot(),
  5000, // Start with 5s timeout
  3 // Max 3 attempts (5s -> 7.5s -> 10s)
);
```

### 4. Chunked Retry (Payload Too Large)

Used when payload exceeds size limits. Split and retry in chunks.

**When to use:**
- `PAYLOAD_TOO_LARGE` (global limit ~100MB)
- `COMMAND_PAYLOAD_TOO_LARGE` (command-specific limits)
- Large screenshot operations
- Batch operations on large datasets

**Implementation:**

```javascript
async function retryWithChunking(operation, payload, chunkSize) {
  const chunks = splitPayload(payload, chunkSize);
  const results = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Processing chunk ${i + 1}/${chunks.length}`);

    try {
      const result = await retryWithExponentialBackoff(
        () => operation(chunk),
        { maxRetries: 3, baseDelayMs: 500 }
      );
      results.push(result);
    } catch (error) {
      if (error.errorCode === 'COMMAND_PAYLOAD_TOO_LARGE') {
        // Reduce chunk size and retry
        const smallerChunkSize = Math.floor(chunkSize / 2);
        console.log(
          `Chunk too large - retrying with ${smallerChunkSize} size`
        );
        return retryWithChunking(operation, payload, smallerChunkSize);
      }
      throw error;
    }
  }

  return results;
}

function splitPayload(payload, chunkSize) {
  const chunks = [];
  for (let i = 0; i < payload.length; i += chunkSize) {
    chunks.push(payload.slice(i, i + chunkSize));
  }
  return chunks;
}
```

### 5. Resource-Aware Retry

Used when resource constraints (memory, concurrency) are the issue.

**When to use:**
- `SYSTEM_OUT_OF_MEMORY`
- `CONCURRENT_LIMIT_EXCEEDED`
- `RESOURCE_LOCKED` (transient lock)
- Browser not ready

**Implementation:**

```javascript
async function retryWithResourceAwareness(
  operation,
  checkResourcesFn,
  maxAttempts = 5
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Check if resources are available
      const resourceStatus = await checkResourcesFn();
      if (!resourceStatus.available) {
        const waitTime = calculateWaitTime(resourceStatus);
        console.log(`Resources unavailable - waiting ${waitTime}ms`);
        await sleep(waitTime);
        continue;
      }

      return await operation();
    } catch (error) {
      if (error.errorCode === 'SYSTEM_OUT_OF_MEMORY') {
        console.log('Memory exhausted - triggering garbage collection');
        // Trigger cleanup and retry with longer delay
        await sleep(2000);
        continue;
      }

      if (error.errorCode === 'CONCURRENT_LIMIT_EXCEEDED') {
        const waitTime =
          error.details?.resetIn || 2000 * Math.pow(1.5, attempt);
        console.log(`Concurrency limit - waiting ${waitTime}ms`);
        await sleep(waitTime);
        continue;
      }

      throw error;
    }
  }
}

function calculateWaitTime(resourceStatus) {
  if (resourceStatus.type === 'memory') {
    return 3000; // Longer wait for memory cleanup
  }
  if (resourceStatus.type === 'concurrency') {
    return 1000 + Math.random() * 1000;
  }
  return 1000;
}
```

### 6. State-Based Retry (Resource Not Found → Ready)

Used when operation depends on state changes (resource creation, page load, etc.).

**When to use:**
- `RESOURCE_NOT_FOUND` after creation (eventual consistency)
- `BROWSER_NOT_READY` during initialization
- Resource locks being released
- Pages still loading

**Implementation:**

```javascript
async function retryWithStateChange(
  operation,
  checkStateFn,
  targetState,
  maxWaitMs = 30000
) {
  const startTime = Date.now();
  const pollIntervalMs = 200;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      // Check if state matches expectation
      const currentState = await checkStateFn();
      if (currentState === targetState) {
        return await operation();
      }
    } catch (error) {
      if (error.errorCode === 'RESOURCE_NOT_FOUND') {
        // Expected - resource not yet available, continue polling
        console.log('Resource not found yet, polling...');
      } else {
        throw error;
      }
    }

    // Poll interval
    await sleep(pollIntervalMs);
  }

  throw new Error(`Timeout waiting for state ${targetState}`);
}

// Usage
const profile = await retryWithStateChange(
  () => browser.getProfile(profileId),
  () => browser.checkProfileReadiness(profileId),
  'ready',
  10000 // Max wait 10s
);
```

---

## Graceful Degradation Patterns

Graceful degradation allows operations to continue providing value even when errors occur, by reducing scope or switching to fallback behavior.

### 1. Feature Degradation

Continue operation with reduced functionality instead of failing completely.

```javascript
async function takeScreenshotWithDegradation(options) {
  try {
    // Try high-quality screenshot with all options
    return await browser.screenshot({
      format: 'png',
      quality: 95,
      fullPage: true,
      compressImages: true,
      excludeHeaders: false
    });
  } catch (error) {
    if (error.errorCode === 'COMMAND_PAYLOAD_TOO_LARGE') {
      console.log('Full-page screenshot too large - degrading to viewport');

      try {
        // Try reduced-scope screenshot
        return await browser.screenshot({
          format: 'png',
          quality: 80,
          fullPage: false,
          compressImages: true
        });
      } catch (error2) {
        console.log('Viewport screenshot also failed - returning basic');

        // Last-resort minimal screenshot
        return await browser.screenshot({
          format: 'jpeg',
          quality: 60,
          fullPage: false,
          compressImages: true
        });
      }
    }

    throw error;
  }
}

// Usage pattern: try to get full data, fall back to partial data
async function scrapeDataWithDegradation(url) {
  const results = {};

  try {
    results.fullContent = await browser.getPageContent();
  } catch (error) {
    if (error.errorCode === 'COMMAND_PAYLOAD_TOO_LARGE') {
      console.log('Full content too large - degrading to text only');
      results.textContent = await browser.getPageText();
    }
  }

  try {
    results.images = await browser.extractImages();
  } catch (error) {
    console.log('Image extraction failed - continuing without images');
    results.images = [];
  }

  try {
    results.metadata = await browser.getMetadata();
  } catch (error) {
    console.log('Metadata extraction failed - continuing without metadata');
    results.metadata = null;
  }

  return results; // Return whatever we could get
}
```

### 2. Timeout Degradation

Reduce timeout expectations rather than failing the operation.

```javascript
async function executeWithTimeoutDegradation(
  operation,
  initialTimeoutMs,
  degradedTimeoutMs
) {
  try {
    return await withTimeout(operation(), initialTimeoutMs);
  } catch (error) {
    if (error.code === 'TIMEOUT') {
      console.log(
        `Operation timed out at ${initialTimeoutMs}ms - attempting with longer timeout`
      );
      return await withTimeout(operation(), degradedTimeoutMs);
    }
    throw error;
  }
}

// Usage
const result = await executeWithTimeoutDegradation(
  () => browser.navigate('https://heavy-site.com'),
  5000, // Initial: 5s
  15000 // Degraded: 15s
);
```

### 3. Operation Queuing (Concurrency Degradation)

Queue operations when concurrency limit is exceeded instead of failing.

```javascript
class OperationQueue {
  constructor(maxConcurrent = 5, maxQueueSize = 100) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueueSize = maxQueueSize;
    this.queue = [];
    this.active = 0;
  }

  async enqueue(operation) {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Queue full - too many pending operations');
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject });
      this.process();
    });
  }

  async process() {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const { operation, resolve, reject } = this.queue.shift();
      this.active++;

      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        // Check if error is concurrency-related
        if (
          error.errorCode === 'CONCURRENT_LIMIT_EXCEEDED' &&
          this.queue.length < this.maxQueueSize
        ) {
          // Re-queue and try later
          this.queue.push({ operation, resolve, reject });
        } else {
          reject(error);
        }
      } finally {
        this.active--;
        this.process(); // Process next in queue
      }
    }
  }
}

// Usage
const queue = new OperationQueue(5);
const results = await Promise.all([
  queue.enqueue(() => browser.navigate('url1')),
  queue.enqueue(() => browser.navigate('url2')),
  queue.enqueue(() => browser.navigate('url3')),
  // ... more operations
]);
```

### 4. Fallback Strategy (Provider/Mode Switching)

Switch strategies when primary approach fails.

```javascript
async function navigationWithFallback(url) {
  const strategies = [
    {
      name: 'Direct navigation',
      execute: () => browser.navigate(url)
    },
    {
      name: 'Proxy navigation',
      execute: () => browser.navigateViaProxy(url)
    },
    {
      name: 'Headless mode',
      execute: async () => {
        await browser.setHeadlessMode(true);
        return browser.navigate(url);
      }
    },
    {
      name: 'Slow navigation',
      execute: () =>
        browser.navigate(url, { timeout: 30000, waitForElement: null })
    }
  ];

  for (const strategy of strategies) {
    try {
      console.log(`Trying strategy: ${strategy.name}`);
      return await strategy.execute();
    } catch (error) {
      console.log(`Strategy ${strategy.name} failed: ${error.message}`);
      if (strategy === strategies[strategies.length - 1]) {
        throw error; // All strategies failed
      }
    }
  }
}

// Usage
await navigationWithFallback('https://difficult-site.com');
```

### 5. Partial Success (Batch Degradation)

Process items in batches, continuing with successful items even if some fail.

```javascript
async function processBatchWithDegradation(items, processFn) {
  const successful = [];
  const failed = [];

  for (const item of items) {
    try {
      const result = await retryWithExponentialBackoff(() =>
        processFn(item)
      );
      successful.push({ item, result });
    } catch (error) {
      console.log(`Failed to process ${item.id}: ${error.message}`);
      failed.push({ item, error });

      // If failures exceed threshold, stop and return partial results
      if (failed.length > items.length * 0.3) {
        console.warn('Failure rate exceeds 30% - returning partial results');
        break;
      }
    }
  }

  return {
    successful,
    failed,
    partialSuccess: successful.length > 0 && failed.length > 0
  };
}

// Usage
const result = await processBatchWithDegradation(
  screenshots,
  (screenshot) => browser.processScreenshot(screenshot)
);

if (result.partialSuccess) {
  console.log(
    `Processed ${result.successful.length}/${result.successful.length + result.failed.length} items`
  );
  // Log failures for analysis
  logFailures(result.failed);
}
```

---

## Connection Recovery

### 1. Connection Pool with Auto-Healing

```javascript
class HealingConnectionPool {
  constructor(maxSize = 50, healthCheckInterval = 10000) {
    this.maxSize = maxSize;
    this.healthCheckInterval = healthCheckInterval;
    this.connections = new Map();
    this.healthChecks = new Map();
    this.metrics = {
      totalCreated: 0,
      totalRecovered: 0,
      totalFailed: 0
    };
  }

  async getConnection(clientId) {
    if (this.connections.has(clientId)) {
      const conn = this.connections.get(clientId);
      if (this._isConnectionHealthy(conn)) {
        return conn;
      }
      // Connection unhealthy - remove and recreate
      this.connections.delete(clientId);
      this.metrics.totalRecovered++;
    }

    // Create new connection
    if (this.connections.size >= this.maxSize) {
      throw new Error('Connection pool at capacity');
    }

    const conn = await this._createConnection(clientId);
    this.connections.set(clientId, conn);
    this.metrics.totalCreated++;

    // Start health check
    this._startHealthCheck(clientId);

    return conn;
  }

  async _createConnection(clientId) {
    try {
      const ws = new WebSocket(this.wsUrl);
      return {
        clientId,
        ws,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        healthy: true,
        failureCount: 0
      };
    } catch (error) {
      this.metrics.totalFailed++;
      throw error;
    }
  }

  _isConnectionHealthy(conn) {
    const TIMEOUT_MS = 60000; // 1 minute
    const AGE_MS = Date.now() - conn.createdAt;

    return (
      conn.healthy &&
      conn.ws.readyState === WebSocket.OPEN &&
      AGE_MS < TIMEOUT_MS
    );
  }

  _startHealthCheck(clientId) {
    if (this.healthChecks.has(clientId)) {
      return; // Already checking
    }

    const checkInterval = setInterval(async () => {
      const conn = this.connections.get(clientId);
      if (!conn) {
        clearInterval(checkInterval);
        return;
      }

      try {
        // Send ping to verify connection
        const response = await this._ping(conn);
        conn.healthy = true;
        conn.failureCount = 0;
      } catch (error) {
        conn.failureCount++;
        if (conn.failureCount > 3) {
          conn.healthy = false;
          this.connections.delete(clientId);
        }
      }
    }, this.healthCheckInterval);

    this.healthChecks.set(clientId, checkInterval);
  }

  async _ping(conn) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Ping timeout')),
        5000
      );
      conn.ws.send(JSON.stringify({ command: 'ping' }), (err) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

// Usage
const pool = new HealingConnectionPool(50);
const conn = await pool.getConnection('client-123');
```

### 2. Automatic Reconnection with Exponential Backoff

```javascript
class ResilientWebSocketClient {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      maxReconnectAttempts: 10,
      initialReconnectDelayMs: 1000,
      maxReconnectDelayMs: 60000,
      backoffMultiplier: 1.5,
      ...options
    };

    this.ws = null;
    this.reconnectAttempts = 0;
    this.messageQueue = [];
    this.listeners = new Map();
  }

  async connect() {
    try {
      this.ws = new WebSocket(this.url);
      this.ws.on('open', () => this._onOpen());
      this.ws.on('close', () => this._onClose());
      this.ws.on('error', (err) => this._onError(err));
      this.ws.on('message', (msg) => this._onMessage(msg));
      return new Promise((resolve) => {
        const openListener = () => {
          this.ws.removeListener('open', openListener);
          resolve();
        };
        this.ws.on('open', openListener);
      });
    } catch (error) {
      console.error('Failed to connect:', error);
      throw error;
    }
  }

  _onOpen() {
    console.log('WebSocket connected');
    this.reconnectAttempts = 0;

    // Flush queued messages
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      this.ws.send(JSON.stringify(msg));
    }

    this.emit('connected');
  }

  _onClose() {
    console.log('WebSocket closed - attempting reconnection');
    this._scheduleReconnect();
  }

  _onError(error) {
    console.error('WebSocket error:', error);
    this.emit('error', error);
  }

  _onMessage(data) {
    try {
      const msg = JSON.parse(data);
      this.emit('message', msg);
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    const delayMs = Math.min(
      this.options.initialReconnectDelayMs *
        Math.pow(this.options.backoffMultiplier, this.reconnectAttempts),
      this.options.maxReconnectDelayMs
    );

    console.log(
      `Reconnecting in ${delayMs}ms (attempt ${this.reconnectAttempts + 1}/${this.options.maxReconnectAttempts})`
    );

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch((err) => {
        console.error('Reconnection failed:', err);
        this._scheduleReconnect();
      });
    }, delayMs);
  }

  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for when connection reestablishes
      this.messageQueue.push(message);
      console.log(`Message queued (${this.messageQueue.length} pending)`);

      // Attempt connection if not already connected
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connect().catch((err) => {
          console.error('Failed to connect:', err);
        });
      }
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, ...args) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      }
    }
  }
}

// Usage
const client = new ResilientWebSocketClient('ws://localhost:8765');
client.on('connected', () => console.log('Connected'));
client.on('error', (err) => console.error('Error:', err));
await client.connect();

// Send command (queues if disconnected)
client.send({ command: 'navigate', url: 'https://example.com' });
```

### 3. Circuit Breaker Pattern

Fail fast and prevent cascading failures when service is experiencing issues.

```javascript
class CircuitBreaker {
  constructor(
    operation,
    options = {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
      monitoringWindowMs: 10000
    }
  ) {
    this.operation = operation;
    this.options = options;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.metrics = {
      totalAttempts: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalCircuitTrips: 0
    };
  }

  async execute(...args) {
    this.metrics.totalAttempts++;

    if (this.state === 'OPEN') {
      if (
        Date.now() - this.lastFailureTime >
        this.options.resetTimeoutMs
      ) {
        console.log('Circuit breaker: transitioning to HALF_OPEN');
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error(
          `Circuit breaker OPEN - service unavailable (will retry in ${this.options.resetTimeoutMs}ms)`
        );
      }
    }

    try {
      const result = await this.operation(...args);
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure();
      throw error;
    }
  }

  _onSuccess() {
    this.metrics.totalSuccesses++;
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 2) {
        console.log('Circuit breaker: transitioning to CLOSED');
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  _onFailure() {
    this.metrics.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold) {
      console.log('Circuit breaker: transitioning to OPEN');
      this.state = 'OPEN';
      this.metrics.totalCircuitTrips++;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      currentState: this.state,
      failureCount: this.failureCount
    };
  }
}

// Usage
const breaker = new CircuitBreaker(
  (command) => browser.execute(command),
  { failureThreshold: 5, resetTimeoutMs: 30000 }
);

try {
  const result = await breaker.execute({ command: 'navigate', url });
} catch (error) {
  if (error.message.includes('Circuit breaker')) {
    console.log('Service temporarily unavailable - retrying later');
    setTimeout(() => retryOperation(), 30000);
  }
}
```

---

## Implementation Checklist

When building error recovery into your system:

### Design Phase
- [ ] Classify each error type as transient or permanent
- [ ] Define retry strategy for each transient error
- [ ] Determine max retry attempts per error type
- [ ] Choose base delay and backoff multiplier
- [ ] Define jitter strategy (prevent thundering herd)
- [ ] Identify which operations support chunking/degradation
- [ ] Plan circuit breaker thresholds
- [ ] Design connection pool sizing

### Implementation Phase
- [ ] Implement exponential backoff helper
- [ ] Implement timeout helpers with degradation
- [ ] Implement chunking strategy for large payloads
- [ ] Implement operation queue for concurrency limits
- [ ] Implement connection pool with health checks
- [ ] Implement automatic reconnection logic
- [ ] Implement circuit breaker for critical paths
- [ ] Add recovery hint lookup in error handling

### Testing Phase
- [ ] Test retry logic with simulated transient errors
- [ ] Test permanent errors don't get retried
- [ ] Test exponential backoff timing (including jitter)
- [ ] Test max retry limit enforcement
- [ ] Test circuit breaker state transitions
- [ ] Test connection pool health checks
- [ ] Test message queue during disconnects
- [ ] Stress test with concurrent operations
- [ ] Load test with rate limiting

### Monitoring Phase
- [ ] Log all retries with attempt count and delay
- [ ] Log circuit breaker state changes
- [ ] Track retry success/failure rates per error
- [ ] Monitor connection pool health
- [ ] Alert on high failure rates
- [ ] Alert on circuit breaker OPEN state
- [ ] Track recovery time metrics
- [ ] Analyze backoff delay effectiveness

---

## Real-World Examples

### Example 1: Reliable Screenshot Capture

```javascript
class ScreenshotCapture {
  async takeScreenshot(url, options = {}) {
    const defaultOptions = {
      format: 'png',
      quality: 95,
      fullPage: true,
      timeout: 10000
    };

    const finalOptions = { ...defaultOptions, ...options };

    // Navigate with retry
    await retryWithExponentialBackoff(
      () => browser.navigate(url),
      { maxRetries: 3, baseDelayMs: 1000 }
    );

    // Wait for content with adaptive timeout
    await retryWithAdaptiveTimeout(
      () => browser.waitForContent(),
      finalOptions.timeout,
      3
    );

    // Take screenshot with degradation
    try {
      return await browser.screenshot(finalOptions);
    } catch (error) {
      if (error.errorCode === 'COMMAND_PAYLOAD_TOO_LARGE') {
        console.log('Full screenshot too large - degrading');
        finalOptions.fullPage = false;
        finalOptions.quality = Math.floor(finalOptions.quality * 0.8);
        return browser.screenshot(finalOptions);
      }
      throw error;
    }
  }
}
```

### Example 2: Resilient Session Management

```javascript
class SessionManager {
  async createSession(config, maxRetries = 3) {
    return retryWithExponentialBackoff(
      () => browser.createSession(config),
      { maxRetries, baseDelayMs: 500 }
    );
  }

  async getSession(sessionId) {
    return retryWithStateChange(
      () => browser.getSession(sessionId),
      () => browser.checkSessionReadiness(sessionId),
      'ready',
      15000 // Max 15s wait for ready state
    );
  }

  async executeInSession(sessionId, operation) {
    try {
      return await operation();
    } catch (error) {
      if (error.errorCode === 'RESOURCE_LOCKED') {
        // Session locked - wait and retry
        await sleep(error.details?.lockWaitMs || 1000);
        return this.executeInSession(sessionId, operation);
      }

      if (error.errorCode === 'SYSTEM_BROWSER_CRASH') {
        // Browser crashed - recreate session
        const session = await this.createSession({
          sessionId,
          restoreState: true
        });
        return operation(); // Retry with new browser
      }

      throw error;
    }
  }
}
```

### Example 3: Batch Processing with Recovery

```javascript
class BatchProcessor {
  async processList(items, processFn, options = {}) {
    const {
      concurrency = 5,
      retryPerItem = 3,
      degradeOnFailure = true,
      failureThreshold = 0.3
    } = options;

    const queue = new OperationQueue(concurrency);
    const results = { success: [], failure: [], degraded: [] };

    for (const item of items) {
      queue.enqueue(async () => {
        try {
          const result = await retryWithExponentialBackoff(
            () => processFn(item),
            { maxRetries: retryPerItem, baseDelayMs: 500 }
          );
          results.success.push({ item, result });
        } catch (error) {
          if (
            degradeOnFailure &&
            error.errorCode === 'COMMAND_PAYLOAD_TOO_LARGE'
          ) {
            try {
              // Try degraded version
              const result = await processFn(item, { degraded: true });
              results.degraded.push({ item, result });
            } catch (degradedError) {
              results.failure.push({ item, error: degradedError });
            }
          } else {
            results.failure.push({ item, error });
          }

          // Check failure threshold
          const failureRate =
            results.failure.length / (results.failure.length + results.success.length);
          if (failureRate > failureThreshold) {
            console.warn(
              `Failure rate ${(failureRate * 100).toFixed(1)}% exceeds threshold - stopping`
            );
            throw new Error('Batch processing aborted due to high failure rate');
          }
        }
      });
    }

    await queue.waitForCompletion();
    return results;
  }
}
```

---

## Monitoring & Alerts

### Key Metrics to Track

```javascript
const ErrorMetrics = {
  // Per-error-type tracking
  retryAttempts: {
    'RATE_LIMIT_EXCEEDED': 0,
    'COMMAND_TIMED_OUT': 0,
    // ... per error type
  },

  // Timing metrics
  avgRetryDelay: {},
  totalRetryTime: {},
  retrySuccessRate: {}, // % successful after retry

  // System health
  circuitBreakerTrips: 0,
  connectionPoolUtilization: 0, // 0-100%
  queuedOperations: 0,
  activeConnections: 0,

  // Aggregate metrics
  totalRequests: 0,
  totalRetries: 0,
  totalFailures: 0,
  retryRatio: 0 // retries / totalRequests
};
```

### Alert Thresholds

```javascript
const AlertThresholds = {
  highRetryRate: 0.3, // > 30% of requests retried
  highFailureRate: 0.1, // > 10% of requests failing
  circuitBreakerOpen: true, // Any circuit breaker OPEN
  connectionPoolFull: 0.9, // > 90% capacity
  queueBacklog: 1000, // > 1000 operations queued
  maxCircuitTripRate: 5 // > 5 trips in 5 minutes
};
```

---

## Summary

### Key Principles

1. **Distinguish transient from permanent errors** - Only retry transient errors
2. **Use exponential backoff with jitter** - Prevents thundering herd and allows graceful recovery
3. **Implement adaptive strategies** - Increase timeouts, reduce payload size, switch strategies
4. **Queue when at limits** - Don't fail due to concurrency limits, queue for later
5. **Monitor recovery metrics** - Track what's working and what isn't
6. **Design for graceful degradation** - Provide value even if some operations fail
7. **Use circuit breakers** - Fail fast and prevent cascading failures
8. **Health-check connections** - Detect dead connections before they cause errors

### Decision Tree

```
Error received?
├─ Is errorCode in retryableErrorCodes?
│  ├─ Yes → Apply appropriate retry strategy
│  │  ├─ RATE_LIMIT_EXCEEDED → Use explicit timing from response
│  │  ├─ COMMAND_TIMED_OUT → Increase timeout, exponential backoff
│  │  ├─ COMMAND_PAYLOAD_TOO_LARGE → Chunk and retry
│  │  ├─ CONCURRENT_LIMIT_EXCEEDED → Queue or exponential backoff
│  │  ├─ SYSTEM_OUT_OF_MEMORY → Wait longer, degraded operation
│  │  ├─ SYSTEM_BROWSER_CRASH → Short delay for auto-restart
│  │  └─ Others → Standard exponential backoff
│  └─ No → Permanent error
│     ├─ Log for developer (VALIDATION_*, COMMAND_NOT_FOUND)
│     ├─ Notify admin (AUTH_*, RESOURCE_NOT_FOUND)
│     └─ Return to caller with recovery hint
└─ Recovery succeeded? → Continue operation
   └─ All retries exhausted? → Attempt graceful degradation
      └─ Degradation possible? → Execute degraded path
         └─ Fail with context
```

---

## Related Documentation

- `/websocket/ERROR-RECOVERY-HINTS.json` - Recovery hints per error code
- `/websocket/ERROR-SCHEMA.md` - Error response schema specification
- `/websocket/error-formatter.js` - Error formatting utilities
- `/websocket/connection-pool.js` - Connection pool implementation
- `/docs/wiki/guides/` - Additional integration guides

---

**Document Version:** 1.0  
**Last Reviewed:** June 22, 2026  
**Maintainer:** Basset Hound Browser Engineering Team
