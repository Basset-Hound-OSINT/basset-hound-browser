# Error Recovery Strategies Guide

**Version:** 12.9.0  
**Status:** Production Ready  
**Last Updated:** June 21, 2026  
**Audience:** External Developers, Integration Engineers, Automation Scripts

---

## Table of Contents

1. [Error Categories](#error-categories)
2. [Retry Strategies by Error Type](#retry-strategies-by-error-type)
3. [Graceful Degradation Patterns](#graceful-degradation-patterns)
4. [Code Examples](#code-examples)
5. [Connection Recovery](#connection-recovery)
6. [Rate Limiting Handling](#rate-limiting-handling)
7. [Debugging & Troubleshooting](#debugging--troubleshooting)
8. [Best Practices](#best-practices)

---

## Error Categories

The Basset Hound Browser WebSocket API classifies errors into three categories based on recoverability:

### Transient Errors (Retry-Safe)

Transient errors are **temporary, network-related failures** that are safe to retry. These errors indicate a temporary condition that may resolve on retry.

**Transient Error Types:**
- `ETIMEDOUT` - Connection timeout (system level)
- `ECONNRESET` - Connection reset by peer
- `ECONNREFUSED` - Connection refused by server
- `EPIPE` - Broken pipe
- `ENOTFOUND` - DNS resolution failure
- `ENETUNREACH` - Network unreachable
- `EAI_AGAIN` - Temporary DNS failure
- `EHOSTUNREACH` - Host unreachable
- `TIMEOUT` - Command execution timeout
- `socket hang up` - Unexpected socket closure

**Characteristics:**
- Usually recoverable by retry
- Safe to resend command (idempotent operations)
- Time-limited (won't repeat indefinitely)
- Not caused by invalid parameters or permissions

**Example Response:**
```json
{
  "success": false,
  "error": "TIMEOUT",
  "message": "Command execution timeout after 30s",
  "errorCode": "TIMEOUT",
  "recoveryHint": "Transient error - safe to retry with exponential backoff",
  "retryable": true,
  "suggestedDelay": 1000
}
```

### Permanent Errors (Don't Retry)

Permanent errors indicate **client-side mistakes or authorization failures**. Retrying will not resolve these errors.

**Permanent Error Types:**
- `INVALID_PARAMETERS` - Command has invalid parameters
- `AUTH_FAILED` - Authentication token invalid/expired
- `UNAUTHORIZED` - Not authorized for this command
- `FORBIDDEN` - Access denied
- `NOT_FOUND` - Resource doesn't exist
- `BAD_REQUEST` - Malformed request
- `Unknown command` - Command not supported

**Characteristics:**
- Never recoverable by retry
- Caused by client-side issues
- Require code changes to fix
- Same error will occur on retry

**Example Response:**
```json
{
  "success": false,
  "error": "INVALID_PARAMETERS",
  "message": "Missing required parameter: url",
  "errorCode": "INVALID_PARAMETERS",
  "recoveryHint": "Invalid parameters - fix the request and resubmit",
  "retryable": false
}
```

### Resource Errors (Check State First)

Resource errors indicate a **state mismatch or resource conflict**. These require checking current state before retrying.

**Resource Error Types:**
- `RESOURCE_NOT_FOUND` - Resource (session, tab, profile) doesn't exist
- `STATE_MISMATCH` - Resource state changed since last operation
- `CONFLICT` - Resource in conflicting state
- `RATE_LIMIT_EXCEEDED` - Too many requests (HTTP 429)

**Characteristics:**
- May be transient (resource might be created shortly)
- Require state verification before retry
- May need wait-and-retry pattern
- Provide context about missing resource

**Example Response:**
```json
{
  "success": false,
  "error": "RESOURCE_NOT_FOUND",
  "message": "Session 'abc-123' not found",
  "errorCode": "RESOURCE_NOT_FOUND",
  "recoveryHint": "Check that the resource exists, then retry",
  "retryable": false,
  "context": {
    "resourceType": "session",
    "resourceId": "abc-123"
  }
}
```

---

## Retry Strategies by Error Type

### Transient Errors: Exponential Backoff

For transient errors, use **exponential backoff with jitter** to avoid overwhelming the system:

**Backoff Schedule:**
```
Attempt 1: Immediate (0ms delay)
Attempt 2: 1000ms delay (1 second)
Attempt 3: 2000ms delay (2 seconds)
Attempt 4: 4000ms delay (4 seconds)
Maximum Retries: 3 (total 4 attempts)
```

**Formula:**
```
delay = baseDelay * (2 ^ attempt)
```

Where:
- `baseDelay` = 1000ms (1 second)
- `attempt` = 0 (first retry), 1 (second retry), etc.

**With Jitter (Optional but Recommended):**
```
delay = (baseDelay * (2 ^ attempt)) + random(0, 1000)
```

Jitter prevents "thundering herd" problem when multiple clients retry simultaneously.

**Maximum Total Wait:**
- No jitter: 7 seconds (0 + 1 + 2 + 4)
- With jitter: 7-10 seconds

### Permanent Errors: Fail Fast

For permanent errors, **fail immediately without retry**:

1. Log the error with full context
2. Return error to caller
3. Fix the underlying issue (parameters, auth, etc.)
4. Don't attempt automatic retry

**Decision Logic:**
```
if (isPermanentError(error)) {
  // Log and fail immediately
  logger.error('Permanent error:', error.code, error.message);
  throw error; // Don't retry
}
```

### Resource Errors: Check State, Then Retry

For resource errors, **verify state before retrying**:

1. Check if resource exists (list, describe, or get operation)
2. If resource doesn't exist, fail or create it
3. If resource exists, wait and retry (up to 3 times)
4. Use exponential backoff like transient errors

**Decision Logic:**
```javascript
if (isResourceNotFoundError(error)) {
  // Check state
  const exists = await checkResourceExists(resourceId);
  
  if (!exists) {
    // Resource gone - may need to create it
    throw new Error(`Resource ${resourceId} not found`);
  }
  
  // Resource exists, wait and retry
  await delay(exponentialBackoff(attempt));
  return retry();
}
```

---

## Graceful Degradation Patterns

When errors occur, degrade gracefully rather than failing completely. Provide fallback options to maintain functionality.

### Pattern 1: Fallback Data Source

If a command fails, use cached or fallback data:

```javascript
async function getContentWithFallback(url, cache) {
  try {
    // Try primary source
    const content = await browser.getContent();
    cache.set(url, content);
    return content;
  } catch (error) {
    if (error.errorCode === 'TIMEOUT') {
      // Use cached version if available
      const cached = cache.get(url);
      if (cached) {
        logger.warn('Using cached content due to timeout');
        return cached;
      }
    }
    throw error; // If no cache, fail
  }
}
```

### Pattern 2: Optional Features

Some features are optional - gracefully skip if unavailable:

```javascript
async function captureWithOptionalFeatures(options) {
  const result = {
    screenshot: null,
    metadata: null,
    forensics: null
  };

  // Core feature - must succeed
  result.screenshot = await browser.screenshot();

  // Optional features - fail gracefully
  try {
    result.metadata = await browser.getMetadata();
  } catch (error) {
    logger.warn('Could not get metadata:', error.message);
    // Continue anyway, metadata is optional
  }

  try {
    result.forensics = await browser.getForensicData();
  } catch (error) {
    logger.warn('Could not get forensic data:', error.message);
    // Continue anyway, forensics is optional
  }

  return result;
}
```

### Pattern 3: Progressive Degradation

Degrade functionality progressively based on what's available:

```javascript
async function navigateWithFallbacks(url, timeout = 30000) {
  // Try full navigation with all features
  try {
    await browser.navigateTo(url, {
      waitForNavigation: true,
      waitForLoad: true,
      timeout: timeout
    });
    return { success: true, method: 'full' };
  } catch (error) {
    if (!isTransientError(error)) throw error;
  }

  // Fallback 1: Navigate without waiting for load
  try {
    logger.warn('Full navigation failed, trying without load wait');
    await browser.navigateTo(url, {
      waitForNavigation: true,
      waitForLoad: false,
      timeout: timeout / 2
    });
    return { success: true, method: 'basic' };
  } catch (error) {
    if (!isTransientError(error)) throw error;
  }

  // Fallback 2: Just navigate, don't wait
  try {
    logger.warn('Basic navigation failed, trying without wait');
    await browser.navigateTo(url, {
      waitForNavigation: false,
      timeout: timeout / 4
    });
    return { success: true, method: 'bare' };
  } catch (error) {
    throw new Error(`Navigation failed after all fallbacks: ${error.message}`);
  }
}
```

### Pattern 4: Retry with State Verification

For operations affecting state, verify state after each retry:

```javascript
async function fillWithVerification(selector, value, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Execute operation
      await browser.fill(selector, value);
      
      // Verify it worked
      const actualValue = await browser.getAttribute(selector, 'value');
      if (actualValue === value) {
        return { success: true, attempt };
      }
      
      // State mismatch - retry
      logger.warn(`Fill didn't stick, retrying (attempt ${attempt + 1})`);
      await delay(exponentialBackoff(attempt));
      
    } catch (error) {
      if (!isTransientError(error) || attempt === maxRetries - 1) {
        throw error;
      }
      await delay(exponentialBackoff(attempt));
    }
  }
  
  throw new Error(`Failed to fill ${selector} after ${maxRetries} attempts`);
}
```

---

## Code Examples

### JavaScript/Node.js

#### Basic Retry with Exponential Backoff

```javascript
const WebSocket = require('ws');

async function executeWithRetry(command, params, maxAttempts = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await executeCommand(command, params);
    } catch (error) {
      lastError = error;
      
      // Check if retryable
      if (!isTransientError(error.errorCode)) {
        throw error; // Permanent error - fail fast
      }
      
      // Calculate delay
      if (attempt < maxAttempts - 1) {
        const delay = calculateRetryDelay(attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxAttempts} after ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  
  throw new Error(`Command failed after ${maxAttempts} attempts: ${lastError.message}`);
}

function executeCommand(command, params) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:8765');
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: Math.random().toString(),
        command,
        params
      }));
    });
    
    ws.on('message', (data) => {
      const response = JSON.parse(data);
      ws.close();
      
      if (response.success) {
        resolve(response.result);
      } else {
        reject(new CommandError(response.error, response.message));
      }
    });
    
    ws.on('error', reject);
  });
}

function isTransientError(errorCode) {
  const transientErrors = [
    'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE',
    'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN', 'TIMEOUT'
  ];
  return transientErrors.includes(errorCode);
}

function calculateRetryDelay(attempt) {
  return 1000 * Math.pow(2, attempt); // 1s, 2s, 4s, ...
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class CommandError extends Error {
  constructor(code, message) {
    super(message);
    this.errorCode = code;
  }
}

// Usage
(async () => {
  try {
    const content = await executeWithRetry('get_content', {});
    console.log('Success:', content);
  } catch (error) {
    console.error('Failed:', error.message);
  }
})();
```

#### Using Official SDK

```javascript
const { BassetHoundClient } = require('basset-hound-sdk');

const client = new BassetHoundClient({
  url: 'ws://localhost:8765',
  token: process.env.BASSET_TOKEN,
  
  // Configure retry behavior
  maxRetries: 3,
  retryDelay: 1000,
  
  // Configure timeouts
  commandTimeout: 30000,
  
  // Logging
  logger: console
});

// Client handles retries automatically
(async () => {
  try {
    const response = await client.execute('navigateTo', {
      url: 'https://example.com'
    });
    console.log('Navigation successful');
  } catch (error) {
    console.error('Navigation failed:', {
      code: error.errorCode,
      message: error.message,
      retryable: error.retryable
    });
  }
})();
```

#### Batch Operations with Error Handling

```javascript
const { BassetHoundClient } = require('basset-hound-sdk');

const client = new BassetHoundClient({
  url: 'ws://localhost:8765',
  token: process.env.BASSET_TOKEN
});

async function capturePageWithFallbacks(url) {
  const operations = [
    { command: 'navigateTo', params: { url }, required: true },
    { command: 'screenshot', params: {}, required: true },
    { command: 'getMetadata', params: {}, required: false },
    { command: 'getForensicData', params: {}, required: false }
  ];

  const results = {};
  const errors = [];

  for (const op of operations) {
    try {
      results[op.command] = await client.execute(op.command, op.params);
    } catch (error) {
      const errorInfo = {
        command: op.command,
        error: error.errorCode,
        message: error.message,
        required: op.required
      };

      if (op.required) {
        errors.push(errorInfo);
      } else {
        console.warn(`Optional operation failed:`, errorInfo.command);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Required operations failed: ${JSON.stringify(errors)}`);
  }

  return results;
}

// Usage
(async () => {
  try {
    const result = await capturePageWithFallbacks('https://example.com');
    console.log('Captured:', Object.keys(result));
  } catch (error) {
    console.error('Capture failed:', error.message);
  }
})();
```

### Python

#### Basic Retry with Exponential Backoff

```python
import asyncio
import json
import websockets
from typing import Any, Dict, Optional

class BassetHoundError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(f"[{code}] {message}")

class TransientError(Exception):
    pass

TRANSIENT_ERRORS = [
    'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE',
    'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN', 'TIMEOUT'
]

def is_transient_error(error_code: str) -> bool:
    return error_code in TRANSIENT_ERRORS

def calculate_retry_delay(attempt: int) -> float:
    """Calculate exponential backoff delay in seconds"""
    return 1.0 * (2 ** attempt)  # 1s, 2s, 4s, ...

async def execute_with_retry(
    uri: str,
    command: str,
    params: Dict[str, Any],
    max_attempts: int = 3
) -> Dict[str, Any]:
    """Execute command with retry logic"""
    
    for attempt in range(max_attempts):
        try:
            async with websockets.connect(uri) as ws:
                # Send command
                message = json.dumps({
                    'id': f'req-{attempt}-{time.time()}',
                    'command': command,
                    'params': params
                })
                await ws.send(message)
                
                # Wait for response
                response_data = await ws.recv()
                response = json.loads(response_data)
                
                if response.get('success'):
                    return response.get('result')
                else:
                    error_code = response.get('error')
                    error_msg = response.get('message')
                    raise BassetHoundError(error_code, error_msg)
                    
        except BassetHoundError as e:
            # Permanent error - don't retry
            if not is_transient_error(e.code):
                raise
            
            # Transient error - retry if attempts remain
            if attempt < max_attempts - 1:
                delay = calculate_retry_delay(attempt)
                print(f"Retry attempt {attempt + 1}/{max_attempts} after {delay}s")
                await asyncio.sleep(delay)
            else:
                raise
                
        except Exception as e:
            # Network or parsing error - treat as transient
            if attempt < max_attempts - 1:
                delay = calculate_retry_delay(attempt)
                print(f"Retry after error: {e}")
                await asyncio.sleep(delay)
            else:
                raise

# Usage
async def main():
    try:
        result = await execute_with_retry(
            'ws://localhost:8765',
            'get_content',
            {}
        )
        print('Success:', result)
    except BassetHoundError as e:
        print(f'Failed: {e}')

asyncio.run(main())
```

#### Using Official SDK

```python
from basset_hound import BassetHoundClient
import asyncio

async def main():
    client = BassetHoundClient(
        url='ws://localhost:8765',
        token='your-token',
        max_retries=3,
        retry_delay=1000,  # ms
        command_timeout=30000  # ms
    )
    
    try:
        # Client handles retries automatically
        response = await client.navigateTo(url='https://example.com')
        print('Navigation successful')
        
        # With fallback
        try:
            metadata = await client.getMetadata()
        except Exception as e:
            print(f'Could not get metadata: {e}')
            metadata = None
        
        return {
            'navigation': response,
            'metadata': metadata
        }
        
    except client.PermanentError as e:
        print(f'Permanent error (no retry): {e.code} - {e.message}')
    except client.TransientError as e:
        print(f'Transient error (retried): {e.code} - {e.message}')
    finally:
        await client.disconnect()

asyncio.run(main())
```

---

## Connection Recovery

### Detecting Disconnection

Monitor connection state and detect unexpected disconnections:

**WebSocket Event Monitoring:**
```javascript
const ws = new WebSocket('ws://localhost:8765');

ws.addEventListener('open', () => {
  console.log('Connected');
  connectionState.isConnected = true;
  connectionState.lastHeartbeat = Date.now();
});

ws.addEventListener('close', (event) => {
  console.log('Disconnected:', event.code, event.reason);
  connectionState.isConnected = false;
  
  // Attempt reconnection
  if (!event.wasClean) {
    reconnectWithBackoff();
  }
});

ws.addEventListener('error', (error) => {
  console.error('WebSocket error:', error);
  connectionState.isConnected = false;
});
```

### Reconnect Logic

Implement automatic reconnection with backoff:

```javascript
class WebSocketConnection {
  constructor(uri, options = {}) {
    this.uri = uri;
    this.maxRetries = options.maxRetries || 5;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.ws = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.uri);
        
        this.ws.addEventListener('open', () => {
          console.log('Connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        });
        
        this.ws.addEventListener('close', () => {
          this.isConnected = false;
          this.attemptReconnect();
        });
        
        this.ws.addEventListener('error', (error) => {
          console.error('Connection error:', error);
          reject(error);
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }

  async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxRetries) {
      throw new Error(`Failed to reconnect after ${this.maxRetries} attempts`);
    }

    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts),
      this.maxDelay
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    this.reconnectAttempts++;

    await sleep(delay);
    return this.connect();
  }

  async send(message) {
    if (!this.isConnected) {
      throw new Error('Not connected');
    }
    this.ws.send(JSON.stringify(message));
  }
}
```

### Resume In-Flight Operations

For long-running operations, implement checkpoints:

```javascript
async function executeWithCheckpoint(browser, operation, checkpointManager) {
  // Try to resume from checkpoint
  const checkpoint = await checkpointManager.load(operation.id);
  if (checkpoint) {
    console.log('Resuming from checkpoint:', checkpoint);
    return continueFromCheckpoint(browser, checkpoint);
  }

  // Start fresh operation
  const operationState = { id: operation.id, steps: [] };

  for (const step of operation.steps) {
    try {
      const result = await executeStep(browser, step);
      operationState.steps.push({
        step: step.name,
        result,
        timestamp: Date.now()
      });

      // Save checkpoint after each step
      await checkpointManager.save(operationState);

    } catch (error) {
      if (isTransientError(error)) {
        // Save incomplete state
        await checkpointManager.save(operationState);
        throw error; // Let caller handle retry
      }
      throw error;
    }
  }

  // Clear checkpoint on success
  await checkpointManager.delete(operation.id);
  return operationState;
}
```

---

## Rate Limiting Handling

### Detecting Rate Limits

Rate limit errors return HTTP 429 (Too Many Requests):

```javascript
async function executeWithRateLimit(command, params) {
  try {
    return await execute(command, params);
  } catch (error) {
    if (error.statusCode === 429) {
      const retryAfter = error.headers['retry-after'];
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
      
      console.log(`Rate limited. Waiting ${delay}ms before retry`);
      await sleep(delay);
      return executeWithRateLimit(command, params); // Retry once
    }
    throw error;
  }
}
```

### Rate Limit Headers

The API returns rate limit information in response headers:

```
X-RateLimit-Limit: 1000        (max requests per minute)
X-RateLimit-Remaining: 950     (requests remaining)
X-RateLimit-Reset: 1234567890  (unix timestamp)
Retry-After: 60                (seconds to wait if limited)
```

### Implementing Rate Limit Awareness

Proactively avoid rate limits:

```javascript
class RateLimitAwareClient {
  constructor(client, options = {}) {
    this.client = client;
    this.limit = options.limit || 1000;
    this.window = options.window || 60000; // 1 minute
    this.requests = [];
    this.remaining = this.limit;
    this.resetTime = Date.now() + this.window;
  }

  async execute(command, params) {
    // Check if we'd exceed limit
    const requestsInWindow = this.requests.filter(
      r => Date.now() - r < this.window
    ).length;

    if (requestsInWindow >= this.limit) {
      const waitTime = Math.max(0, this.resetTime - Date.now());
      console.log(`Rate limit approaching. Waiting ${waitTime}ms`);
      await sleep(waitTime);
      this.requests = []; // Reset
    }

    // Execute and track
    const result = await this.client.execute(command, params);
    this.requests.push(Date.now());

    // Update remaining from headers
    if (result.headers) {
      this.remaining = parseInt(result.headers['x-ratelimit-remaining']);
      this.resetTime = parseInt(result.headers['x-ratelimit-reset']) * 1000;
    }

    return result;
  }

  getStatus() {
    const requestsInWindow = this.requests.filter(
      r => Date.now() - r < this.window
    ).length;
    return {
      used: requestsInWindow,
      remaining: this.limit - requestsInWindow,
      resetIn: Math.max(0, this.resetTime - Date.now())
    };
  }
}
```

### Health Endpoint Monitoring

Use the health endpoint to monitor server status:

```javascript
async function checkServerHealth(client) {
  try {
    const health = await client.getHealth();
    
    return {
      status: health.status,
      reliability: {
        core: health.metrics.reliability.core,
        all: health.metrics.reliability.all
      },
      latency: {
        p50: health.metrics.latency.p50,
        p99: health.metrics.latency.p99
      },
      resources: health.metrics.resources
    };
  } catch (error) {
    console.error('Health check failed:', error);
    return null;
  }
}

// Proactively back off if server health is degraded
async function executeWithHealthCheck(client, command, params) {
  const health = await checkServerHealth(client);
  
  if (health && health.status !== 'healthy') {
    console.warn('Server health degraded:', health.status);
    // Wait longer before retrying
    await sleep(5000);
  }
  
  return client.execute(command, params);
}
```

---

## Debugging & Troubleshooting

### Error Response Structure

Every error response includes helpful debugging information:

```json
{
  "success": false,
  "error": "TIMEOUT",
  "message": "Command execution timeout after 30s",
  "errorCode": "TIMEOUT",
  "recoveryHint": "Transient error - safe to retry with exponential backoff",
  "retryable": true,
  "maxRetries": 3,
  "suggestedDelay": 1000,
  "context": {
    "command": "screenshot",
    "duration": 30000,
    "attempt": 1
  },
  "timestamp": "2026-06-21T10:30:45.123Z",
  "requestId": "req-abc-123"
}
```

### Logging Strategy

Implement structured logging for error investigation:

```javascript
function logError(error, context = {}) {
  const log = {
    timestamp: new Date().toISOString(),
    errorCode: error.errorCode,
    message: error.message,
    retryable: error.retryable,
    context: {
      command: context.command,
      parameters: context.params,
      attempt: context.attempt,
      ...context
    }
  };

  // Log to file for analysis
  if (error.errorCode.startsWith('TIMEOUT')) {
    logger.warn('Timeout error:', log);
  } else if (!error.retryable) {
    logger.error('Permanent error:', log);
  } else {
    logger.info('Transient error (will retry):', log);
  }

  return log;
}
```

### Common Error Scenarios

#### Scenario 1: Navigation Timeout

```javascript
// Symptom: "TIMEOUT" error during navigateTo

try {
  await browser.navigateTo('https://slow-site.com', {
    timeout: 30000
  });
} catch (error) {
  if (error.errorCode === 'TIMEOUT') {
    console.log('Options for handling timeout:');
    console.log('1. Increase timeout: timeout: 60000');
    console.log('2. Don\'t wait for load: waitForLoad: false');
    console.log('3. Navigate without waiting: waitForNavigation: false');
    console.log('4. Use simpler/faster site');
    
    // Fallback: navigate without waiting for load
    await browser.navigateTo('https://slow-site.com', {
      waitForNavigation: true,
      waitForLoad: false
    });
  }
}
```

#### Scenario 2: Authentication Failed

```javascript
// Symptom: "AUTH_FAILED" error on every command

// Check token
if (process.env.BASSET_TOKEN === undefined) {
  throw new Error('BASSET_TOKEN environment variable not set');
}

// Try to connect with new token
const newToken = await generateNewToken();
const client = new BassetHoundClient({
  url: 'ws://localhost:8765',
  token: newToken
});

try {
  await client.ping();
  console.log('New token works');
} catch (error) {
  console.error('Even new token fails - server issue?');
}
```

#### Scenario 3: Resource Not Found

```javascript
// Symptom: "RESOURCE_NOT_FOUND" for session

// Check if session exists
const sessions = await browser.listSessions();
const sessionExists = sessions.some(s => s.id === 'session-123');

if (!sessionExists) {
  console.log('Session was deleted or expired');
  console.log('Available sessions:', sessions.map(s => s.id));
  
  // Create new session
  const newSession = await browser.createSession();
  console.log('Created new session:', newSession.id);
} else {
  // Session exists but operation failed - might be transient
  await sleep(2000);
  return retry(); // Retry with backoff
}
```

---

## Best Practices

### 1. Always Use Error Codes, Not Error Messages

Error messages are human-readable but may change. Use error codes for logic:

```javascript
// ✅ Good
if (error.errorCode === 'TIMEOUT') {
  retry();
}

// ❌ Bad
if (error.message.includes('timeout')) {
  retry();
}
```

### 2. Respect Recovery Hints

The API provides recovery hints - use them:

```javascript
if (!response.success) {
  logger.info('Recovery hint:', response.recoveryHint);
  
  if (response.retryable) {
    const delay = response.suggestedDelay || 1000;
    await sleep(delay);
    return retry();
  }
}
```

### 3. Implement Monitoring

Track error rates and patterns:

```javascript
class ErrorMonitor {
  constructor() {
    this.errors = new Map(); // errorCode -> count
    this.startTime = Date.now();
  }

  record(error) {
    const count = this.errors.get(error.errorCode) || 0;
    this.errors.set(error.errorCode, count + 1);
  }

  getStats() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const stats = {};
    for (const [code, count] of this.errors.entries()) {
      stats[code] = {
        count,
        rate: (count / elapsed).toFixed(2) + ' per second'
      };
    }
    return stats;
  }

  alert(threshold = 5) {
    const stats = this.getStats();
    for (const [code, { count }] of Object.entries(stats)) {
      if (count > threshold) {
        console.error(`High error rate for ${code}: ${count} errors`);
      }
    }
  }
}
```

### 4. Use Structured Requests

Include request IDs for tracing:

```javascript
async function executeTracked(client, command, params) {
  const requestId = `${Date.now()}-${Math.random()}`;
  
  try {
    return await client.execute(command, params, {
      requestId,
      metadata: {
        timestamp: new Date().toISOString(),
        userId: getCurrentUserId()
      }
    });
  } catch (error) {
    logger.error('Command failed', {
      requestId,
      command,
      error: error.errorCode,
      message: error.message
    });
    throw error;
  }
}
```

### 5. Timeout Configuration

Configure timeouts based on operation type:

```javascript
const TIMEOUTS = {
  ping: 5000,
  getContent: 30000,
  screenshot: 30000,
  screenshot_full_page: 45000,
  navigateTo: 30000,
  navigateTo_slowSite: 60000,
  execute_script: 30000
};

async function executeWithTimeout(command, params) {
  const timeout = TIMEOUTS[command] || 30000;
  
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Command timeout: ${timeout}ms`));
    }, timeout);

    client.execute(command, params)
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
```

### 6. Circuit Breaker Pattern

Prevent cascading failures with circuit breaker:

```javascript
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
  }

  async execute(fn) {
    // Check if circuit is open
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.failureCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      const result = await fn();
      
      // Reset on success
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
      
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
      }
      
      throw error;
    }
  }
}

// Usage
const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000
});

async function safeFetch(command, params) {
  return breaker.execute(() => client.execute(command, params));
}
```

### 7. Centralized Error Handling

Implement error handling middleware:

```javascript
class ErrorHandler {
  static async handle(operation, context = {}) {
    try {
      return await operation();
    } catch (error) {
      // Log error
      this.log(error, context);
      
      // Handle by type
      if (error.errorCode === 'AUTH_FAILED') {
        throw new AuthenticationError(error.message);
      } else if (error.errorCode === 'RATE_LIMIT_EXCEEDED') {
        throw new RateLimitError(error.message);
      } else if (error.retryable) {
        throw new TransientError(error);
      } else {
        throw new PermanentError(error);
      }
    }
  }

  static log(error, context) {
    const entry = {
      timestamp: new Date().toISOString(),
      errorCode: error.errorCode,
      message: error.message,
      retryable: error.retryable,
      context
    };
    logger.error('Operation failed', entry);
  }
}

// Usage
try {
  await ErrorHandler.handle(
    () => client.navigateTo('https://example.com'),
    { operation: 'navigate', url: 'https://example.com' }
  );
} catch (error) {
  if (error instanceof RateLimitError) {
    // Handle rate limit
  } else if (error instanceof TransientError) {
    // Retry
  } else {
    // Fail
  }
}
```

---

## Summary

| Error Type | Action | Max Retries | Backoff | Example |
|---|---|---|---|---|
| **Transient** | Retry with backoff | 3 | Exponential (1s, 2s, 4s) | TIMEOUT, ECONNRESET |
| **Permanent** | Fail fast | 0 | N/A | INVALID_PARAMETERS, AUTH_FAILED |
| **Resource** | Check state, then retry | 3 | Exponential | RESOURCE_NOT_FOUND |
| **Rate Limit** | Wait & retry once | 1 | Respect Retry-After header | HTTP 429 |

---

## Quick Reference

**Error Response Checklist:**
- [ ] Check `success` field first
- [ ] Read `errorCode` (not just message)
- [ ] Check `retryable` flag before implementing retry
- [ ] Use `suggestedDelay` if provided
- [ ] Read `recoveryHint` for guidance
- [ ] Log `requestId` for debugging

**Retry Implementation Checklist:**
- [ ] Only retry transient errors
- [ ] Use exponential backoff
- [ ] Max 3 retries (4 total attempts)
- [ ] Check rate limits
- [ ] Implement circuit breaker for cascading failures
- [ ] Monitor error rates

**Connection Management Checklist:**
- [ ] Monitor connection state
- [ ] Implement reconnection logic
- [ ] Use checkpoints for long operations
- [ ] Track in-flight requests
- [ ] Clean up resources on disconnect

---

**For support:** Contact support@basset-hound.io or see `/docs/FAQ-COMPLETE.md`
