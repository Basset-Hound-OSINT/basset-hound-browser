# Retry-After Quick Start Guide

**For developers implementing rate limit handling in client applications**

## What Changed

Rate limit (429) responses now include the `Retry-After` header and detailed retry information.

```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1624270834

{
  "success": false,
  "errorCode": "RATE_LIMIT_EXCEEDED",
  "details": {
    "retryAfter": 30,
    "limit": 10,
    "remaining": 0,
    "resetIn": 30000
  }
}
```

## Quick Start

### 1. Basic Retry Logic (HTTP)

```javascript
async function callApi(command) {
  const response = await fetch('http://api.example.com/command', {
    method: 'POST',
    body: JSON.stringify(command)
  });

  if (response.status === 429) {
    // Read Retry-After header (in seconds)
    const retryAfter = parseInt(response.headers.get('Retry-After'));
    console.log(`Rate limited. Retry after ${retryAfter}s`);
    
    // Wait and retry
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return callApi(command); // Retry
  }

  return response.json();
}
```

### 2. Exponential Backoff (HTTP)

```javascript
async function callApiWithBackoff(command, maxAttempts = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch('http://api.example.com/command', {
      method: 'POST',
      body: JSON.stringify(command)
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After'));
      const delay = Math.max(
        retryAfter * 1000,                           // Use server's recommendation
        baseDelay * Math.pow(2, attempt - 1)         // Exponential backoff
      );
      
      console.log(`Attempt ${attempt} failed. Waiting ${delay}ms before retry...`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }

    return response.json();
  }
  
  throw new Error('Max attempts exceeded');
}
```

### 3. WebSocket Rate Limit Handling

```javascript
websocket.onmessage = (event) => {
  const response = JSON.parse(event.data);
  
  if (response.errorCode === 'RATE_LIMIT_EXCEEDED') {
    const retryAfter = response.details.retryAfter; // in seconds
    console.log(`Rate limited. Retry after ${retryAfter}s`);
    
    // Store the command and retry later
    setTimeout(() => {
      websocket.send(JSON.stringify(lastCommand));
    }, retryAfter * 1000);
  }
};
```

### 4. Generic Retry Handler

```javascript
class RateLimitAware {
  constructor(maxRetries = 3) {
    this.maxRetries = maxRetries;
  }

  async executeWithRetry(fn, context = null) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn.call(context);
      } catch (error) {
        lastError = error;
        
        if (error.statusCode === 429 && attempt < this.maxRetries) {
          const retryAfter = error.retryAfter || 30;
          const delay = retryAfter * 1000 * Math.pow(2, attempt - 1);
          
          console.log(
            `Attempt ${attempt}/${this.maxRetries} failed (rate limited). ` +
            `Retrying in ${delay}ms...`
          );
          
          await new Promise(r => setTimeout(r, delay));
        } else {
          throw error;
        }
      }
    }
    
    throw lastError;
  }
}

// Usage
const client = new RateLimitAware(3);
await client.executeWithRetry(async () => {
  return await apiCall(command);
});
```

## Understanding the Headers

### Retry-After (Required)
```
Retry-After: 30
```
**Meaning:** Wait 30 seconds before retrying  
**Type:** Integer (seconds)  
**Always present:** Yes, for 429 responses  

### X-RateLimit-Limit
```
X-RateLimit-Limit: 10
```
**Meaning:** Maximum 10 requests per minute  
**Type:** Integer  
**Use for:** Tracking your quota  

### X-RateLimit-Remaining
```
X-RateLimit-Remaining: 5
```
**Meaning:** 5 requests remaining in current window  
**Type:** Integer  
**Use for:** Knowing when to slow down  

### X-RateLimit-Reset
```
X-RateLimit-Reset: 1624270834
```
**Meaning:** Limit resets at Unix timestamp 1624270834  
**Type:** Unix timestamp (seconds)  
**Use for:** Calculating exact reset time  

## Decision Flow

```
┌─ Make Request
│
├─ Status 429?
│  │
│  ├─ Yes → Read Retry-After header
│  │  │
│  │  ├─ Calculate delay (with exponential backoff if retry)
│  │  │
│  │  └─ Wait & retry
│  │
│  └─ No → Process response normally
│
└─ Done
```

## Common Mistakes to Avoid

### ❌ Ignoring Retry-After
```javascript
// BAD: Ignores server's recommendation
if (response.status === 429) {
  setTimeout(retry, 1000); // Wrong delay!
}
```

### ✅ Use Server's Recommendation
```javascript
// GOOD: Respects server's Retry-After
if (response.status === 429) {
  const retryAfter = parseInt(response.headers.get('Retry-After'));
  setTimeout(retry, retryAfter * 1000);
}
```

### ❌ Linear Backoff
```javascript
// BAD: Doesn't scale well
const delay = 1000 + (attempt * 1000); // 1s, 2s, 3s, 4s...
```

### ✅ Exponential Backoff
```javascript
// GOOD: Scales efficiently
const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s, 8s...
```

### ❌ Retry Forever
```javascript
// BAD: Could retry forever
while (true) {
  const response = await fetch(...);
  if (response.status !== 429) break;
}
```

### ✅ Bounded Retries
```javascript
// GOOD: Max attempts + timeout
const maxAttempts = 5;
const maxWaitTime = 5 * 60 * 1000; // 5 minutes
```

## Integration Examples

### Axios Interceptor
```javascript
import axios from 'axios';

axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 429) {
      const retryAfter = parseInt(
        error.response.headers['retry-after'] || '30'
      );
      
      console.log(`Rate limited. Waiting ${retryAfter}s...`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      
      return axios(error.config);
    }
    
    throw error;
  }
);
```

### Fetch Wrapper
```javascript
class ApiClient {
  async fetch(url, options = {}, retries = 0) {
    const response = await fetch(url, options);
    
    if (response.status === 429 && retries < 3) {
      const retryAfter = parseInt(response.headers.get('Retry-After'));
      const delay = Math.min(
        retryAfter * 1000,
        1000 * Math.pow(2, retries)
      );
      
      console.log(`Retry-After: ${retryAfter}s (attempt ${retries + 1})`);
      await new Promise(r => setTimeout(r, delay));
      
      return this.fetch(url, options, retries + 1);
    }
    
    return response;
  }
}
```

### Promise Queue (Rate Limit Safe)
```javascript
class RateLimitQueue {
  constructor(concurrency = 1, rateLimit = 10) {
    this.concurrency = concurrency;
    this.rateLimit = rateLimit; // requests per minute
    this.queue = [];
    this.inFlight = 0;
    this.lastReset = Date.now();
    this.requestsInWindow = 0;
  }

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.inFlight >= this.concurrency || this.queue.length === 0) {
      return;
    }

    // Check rate limit window
    const now = Date.now();
    if (now - this.lastReset > 60000) {
      this.lastReset = now;
      this.requestsInWindow = 0;
    }

    // Wait if approaching limit
    if (this.requestsInWindow >= this.rateLimit) {
      const waitTime = 60000 - (now - this.lastReset);
      setTimeout(() => this.process(), waitTime);
      return;
    }

    this.inFlight++;
    this.requestsInWindow++;

    const { fn, resolve, reject } = this.queue.shift();

    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      if (error.statusCode === 429) {
        const retryAfter = error.retryAfter || 30;
        console.log(`Rate limited. Requeuing after ${retryAfter}s...`);
        
        // Requeue the request
        setTimeout(() => {
          this.queue.unshift({ fn, resolve, reject });
          this.process();
        }, retryAfter * 1000);
      } else {
        reject(error);
      }
    } finally {
      this.inFlight--;
      this.process();
    }
  }
}

// Usage
const queue = new RateLimitQueue(5, 50); // 5 concurrent, 50 req/min max

for (const url of urls) {
  queue.add(() => fetch(url));
}
```

## Testing Your Implementation

```javascript
// Simulate rate limit
function simulateRateLimit() {
  const response = {
    status: 429,
    headers: new Map([
      ['retry-after', '2'],
      ['x-ratelimit-limit', '10'],
      ['x-ratelimit-remaining', '0']
    ]),
    json: () => Promise.resolve({
      success: false,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      details: {
        retryAfter: 2
      }
    })
  };
  
  return response;
}

// Test your handler
async function testRetryHandler() {
  const response = simulateRateLimit();
  
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('retry-after'));
    console.log(`Test: Should wait ${retryAfter} seconds`);
    expect(retryAfter).toBe(2);
  }
}
```

## Performance Tips

1. **Respect the header** - Use exactly what server says, not less
2. **Implement backoff** - Don't hammer the server
3. **Queue requests** - Use a queue to smooth load
4. **Monitor headers** - Log X-RateLimit-* values
5. **Circuit breaker** - Stop retrying after too many failures

## More Information

- Full documentation: `/docs/RETRY_AFTER_IMPLEMENTATION.md`
- Implementation details: `/websocket/http-response-decorator.js`
- Test examples: `/tests/websocket/rate-limit-retry-after.test.js`
- HTTP Standard: RFC 7231 Section 7.1.3

---

**Remember:** The `Retry-After` header is a server promise. Respecting it ensures smooth operation for everyone!
