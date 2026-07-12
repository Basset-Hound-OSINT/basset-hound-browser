# Basset Hound Browser - Integration Guide for External Developers

**Version:** 12.8.0  
**Last Updated:** June 21, 2026  
**Status:** Production Ready

---

## Table of Contents

1. [Quick Integration](#quick-integration)
2. [SDK Setup](#sdk-setup)
3. [Authentication & Authorization](#authentication--authorization)
4. [API Patterns](#api-patterns)
5. [Deployment](#deployment)
6. [Monitoring & Support](#monitoring--support)
7. [Troubleshooting](#troubleshooting)

---

## Quick Integration

### 1. Add to Your Project

**Node.js:**
```bash
npm install basset-hound-client
```

**Python:**
```bash
pip install basset-hound-client
```

**Go:**
```bash
go get github.com/basset-hound/go-client
```

### 2. Initialize Client

**JavaScript:**
```javascript
const { BassetClient } = require('basset-hound-client');

const client = new BassetClient({
  url: process.env.BASSET_URL || 'ws://localhost:8765',
  token: process.env.BASSET_TOKEN,
  timeout: 30000
});

await client.connect();
```

**Python:**
```python
from basset_hound import BassetClient

client = BassetClient(
    url=os.environ.get('BASSET_URL', 'ws://localhost:8765'),
    token=os.environ.get('BASSET_TOKEN'),
    timeout=30000
)

await client.connect()
```

### 3. Make Your First Request

```javascript
// Navigate and capture
await client.navigate('https://example.com');
const screenshot = await client.screenshot();
console.log('Success!');
```

---

## SDK Setup

### Installation Options

#### 1. From NPM / PyPI (Recommended)

Simplest approach for most use cases:

```bash
# Node.js
npm install basset-hound-client

# Python
pip install basset-hound-client
```

#### 2. From Source

For development or custom builds:

```bash
# Clone SDK repository
git clone https://github.com/basset-hound/client-sdk.git
cd client-sdk

# Node.js
npm install
npm link  # Link to global

# Python
pip install -e .
```

#### 3. Container Integration

Use Docker for consistent environment:

```dockerfile
FROM node:18-alpine

WORKDIR /app
RUN npm install basset-hound-client

COPY . .
CMD ["node", "index.js"]
```

Or with Docker Compose:

```yaml
version: '3'
services:
  basset:
    image: basset-hound-browser:12.8.0
    ports:
      - "8765:8765"
    environment:
      - LOG_LEVEL=info

  app:
    build: .
    depends_on:
      - basset
    environment:
      - BASSET_URL=ws://basset:8765
```

### Environment Configuration

Create `.env` file:

```bash
# Connection
BASSET_URL=ws://localhost:8765
BASSET_PORT=8765
BASSET_SECURE=false

# Authentication
BASSET_TOKEN=your_api_token_here

# Logging
BASSET_LOG_LEVEL=info
LOG_DIR=./logs

# Timeouts
BASSET_TIMEOUT=30000
BASSET_CONNECT_TIMEOUT=5000

# Retry
BASSET_MAX_RETRIES=3
BASSET_RETRY_DELAY=1000

# Feature flags
BASSET_FORENSICS=true
BASSET_EVASION=true
BASSET_MONITORING=true
```

Load in your application:

```javascript
require('dotenv').config();

const client = new BassetClient({
  url: process.env.BASSET_URL,
  token: process.env.BASSET_TOKEN,
  timeout: parseInt(process.env.BASSET_TIMEOUT)
});
```

---

## Authentication & Authorization

### Token-Based Authentication

#### Generate API Token

```bash
# Contact administrator for token
# Token format: basset_<hash>_<timestamp>
BASSET_TOKEN=basset_abc123def456_1624123456000
```

#### Using Token in Client

**Query Parameter:**
```javascript
const client = new BassetClient({
  url: `ws://localhost:8765?token=${process.env.BASSET_TOKEN}`
});
```

**Header:**
```javascript
const client = new BassetClient({
  url: 'ws://localhost:8765',
  headers: {
    'Authorization': `Bearer ${process.env.BASSET_TOKEN}`
  }
});
```

**Command:**
```javascript
await client.authenticate(process.env.BASSET_TOKEN);
```

### Rate Limit Differences

| Type | Limit | Window |
|------|-------|--------|
| Unauthenticated | 100 req/min | 60s |
| Authenticated | 1000 req/min | 60s |

Authenticate for 10x higher limits:

```javascript
const client = new BassetClient({
  url: 'ws://localhost:8765',
  token: process.env.BASSET_TOKEN  // Increases limit
});
```

### Token Expiration

Check token status:

```javascript
const status = await client.execute('get_auth_status');
console.log(status.expiresAt);

if (new Date(status.expiresAt) < new Date()) {
  console.log('Token expired, refreshing...');
  // Request new token
}
```

---

## API Patterns

### Pattern 1: Sequential Operations

For operations that depend on previous results:

```javascript
// Pattern: Step by step
await client.navigate(url);
await client.waitForSelector('.data');
const data = await client.getContent();
```

### Pattern 2: Parallel Operations

For independent operations to save time:

```javascript
// Pattern: Parallel execution
const results = await Promise.all([
  client.screenshot(),
  client.getContent({ type: 'text' }),
  client.executeScript('return document.title')
]);
```

### Pattern 3: Pipeline / Stream

For processing large datasets:

```javascript
// Pattern: Stream large results
const stream = await client.streamContent();

stream.on('data', chunk => {
  console.log(`Received ${chunk.length} bytes`);
});

stream.on('end', () => {
  console.log('Complete');
});
```

### Pattern 4: Request/Response with Retries

For resilient operations:

```javascript
async function executeWithRetry(command, params, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await client.execute(command, params);
    } catch (error) {
      if (error.name === 'RateLimitError') {
        const wait = error.rateLimit.retryAfter;
        console.log(`Rate limited, waiting ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
      } else if (attempt < maxRetries - 1) {
        const delay = 1000 * Math.pow(2, attempt);
        console.log(`Retry in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
}
```

### Pattern 5: Batch Processing

For processing multiple items:

```javascript
async function processBatch(items, batchSize = 10) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // Process batch
    const batchResults = await Promise.all(
      batch.map(item => processItem(item))
    );
    
    results.push(...batchResults);
    
    // Respect rate limits between batches
    if (i + batchSize < items.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  return results;
}
```

---

## Deployment

### Local Development

```bash
# 1. Start Basset Hound Browser
docker run -d -p 8765:8765 basset-hound-browser:12.8.0

# 2. Install client SDK
npm install basset-hound-client

# 3. Create test script
cat > test.js << 'EOF'
const { BassetClient } = require('basset-hound-client');
const client = new BassetClient({ url: 'ws://localhost:8765' });
(async () => {
  await client.connect();
  await client.navigate('https://example.com');
  console.log('✓ Success');
  await client.disconnect();
})();
EOF

# 4. Run test
node test.js
```

### Staging Environment

**Docker Compose:**

```yaml
version: '3.9'

services:
  basset-hound:
    image: basset-hound-browser:12.8.0
    container_name: basset-staging
    ports:
      - "8765:8765"
    environment:
      - LOG_LEVEL=debug
      - RATE_LIMIT_UNAUTHENTICATED=100
      - RATE_LIMIT_AUTHENTICATED=1000
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8765/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  app:
    build: .
    depends_on:
      basset-hound:
        condition: service_healthy
    environment:
      - BASSET_URL=ws://basset-hound:8765
      - BASSET_LOG_LEVEL=info
    ports:
      - "3000:3000"
    volumes:
      - ./src:/app/src
```

Start: `docker-compose -f docker-compose.staging.yml up -d`

### Production Environment

**Kubernetes Deployment:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: basset-hound-browser
  namespace: production

spec:
  replicas: 3
  
  template:
    metadata:
      labels:
        app: basset-hound-browser
    
    spec:
      containers:
      - name: basset
        image: basset-hound-browser:12.8.0
        
        ports:
        - containerPort: 8765
          name: websocket
        
        env:
        - name: LOG_LEVEL
          value: "warn"
        - name: RATE_LIMIT_UNAUTHENTICATED
          value: "50"
        - name: RATE_LIMIT_AUTHENTICATED
          value: "500"
        
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        
        livenessProbe:
          httpGet:
            path: /health
            port: 8765
          initialDelaySeconds: 30
          periodSeconds: 10
        
        readinessProbe:
          httpGet:
            path: /ready
            port: 8765
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: basset-hound-browser
  namespace: production

spec:
  selector:
    app: basset-hound-browser
  
  ports:
  - port: 8765
    targetPort: 8765
    name: websocket
  
  type: LoadBalancer
```

Deploy:
```bash
kubectl apply -f basset-hound-deployment.yaml
```

---

## Monitoring & Support

### Health Checks

```javascript
// Check server status
async function healthCheck() {
  try {
    await client.connect();
    const status = await client.execute('ping', {});
    console.log('✓ Server healthy');
    await client.disconnect();
  } catch (error) {
    console.error('✗ Server unhealthy:', error.message);
  }
}

// Run periodically
setInterval(healthCheck, 60000);
```

### Metrics Collection

```javascript
// Collect performance metrics
class MetricsCollector {
  constructor(client) {
    this.client = client;
    this.metrics = {
      requests: 0,
      errors: 0,
      rateLimited: 0,
      avgLatency: 0
    };
  }
  
  async recordRequest(command, duration, success = true) {
    this.metrics.requests++;
    
    if (!success) {
      this.metrics.errors++;
    }
    
    // Update average latency
    const avg = this.metrics.avgLatency;
    this.metrics.avgLatency = (avg + duration) / 2;
  }
  
  async recordRateLimit() {
    this.metrics.rateLimited++;
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date(),
      errorRate: (this.metrics.errors / this.metrics.requests * 100).toFixed(2) + '%'
    };
  }
}
```

### Logging

```javascript
// Structured logging
const logger = require('winston');

logger.add(
  new logger.transports.File({
    filename: 'basset-hound.log',
    format: logger.format.json()
  })
);

// Log API calls
client.on('request', (command, params) => {
  logger.info('API request', { command, params });
});

client.on('response', (command, result) => {
  logger.info('API response', { command, result });
});

client.on('error', (error) => {
  logger.error('API error', { error: error.message, stack: error.stack });
});
```

### Support Channels

| Issue Type | Resolution | Time |
|-----------|-----------|------|
| Connection error | Check server running, firewall | 5 min |
| Rate limit | Add auth token, batch requests | 10 min |
| Timeout | Increase timeout, simplify page | 15 min |
| Data extraction | Check selectors, wait conditions | 20 min |
| Performance | Use pooling, compression | 30 min |
| Custom feature | Contact team | 1-2 days |

---

## Troubleshooting

### Issue: Cannot Connect

```javascript
// Test connection
const client = new BassetClient({ url: 'ws://localhost:8765', logLevel: 'debug' });

try {
  await client.connect();
  console.log('✓ Connected');
} catch (error) {
  console.error('Connection failed:');
  console.error('1. Is server running?', await checkServerRunning());
  console.error('2. Is port accessible?', await checkPortOpen('localhost', 8765));
  console.error('3. Is URL correct?', process.env.BASSET_URL);
}
```

### Issue: Rate Limit

```javascript
// Monitor and respect rate limits
const limits = await client.getRateLimitStatus();

if (limits.remaining < 10) {
  const wait = limits.resetAt - Date.now();
  console.log(`Waiting ${wait}ms for rate limit reset...`);
  await new Promise(r => setTimeout(r, wait));
}

// Or authenticate for higher limits
const client = new BassetClient({
  token: process.env.BASSET_TOKEN
});
```

### Issue: Timeouts

```javascript
// Increase timeout for slow operations
await client.navigate(url, { timeout: 60000 });  // 60 seconds

// Or break into smaller operations
await client.screenshot({ timeout: 5000 });   // Viewport only
await client.executeScript(`
  window.scrollTo(0, document.body.scrollHeight);
`);
await new Promise(r => setTimeout(r, 2000));  // Wait for load
```

### Issue: Memory

```javascript
// Monitor memory usage
console.log('Memory usage:', process.memoryUsage());

// Process in chunks
for (let i = 0; i < urls.length; i += 10) {
  const chunk = urls.slice(i, i + 10);
  await processBatch(chunk);
  
  // Force GC if available
  if (global.gc) global.gc();
}

// Use compression
const client = new BassetClient({
  compression: 'gzip'
});
```

---

## API Reference Quick Links

- **Full API Reference:** `/docs/api/API-REFERENCE-AUTHORITATIVE.md`
- **Quick Start:** `/QUICK-START-GUIDE.md`
- **Examples:** `/EXAMPLES.md`
- **OpenAPI Spec:** `/docs/openapi.yaml`
- **Interactive Reference:** `/docs/api-interactive-reference.html`

## SDK Documentation

- **Python SDK:** `/sdk-stubs/python_client_template.py`
- **JavaScript SDK:** `/sdk-stubs/nodejs_client_template.js`
- **Go SDK:** `/sdk-stubs/go_client_template.go`

## Support Resources

- **Issues:** https://github.com/basset-hound/browser/issues
- **Documentation:** `/docs/`
- **Status:** `/docs/STATUS.md`
- **Roadmap:** `/docs/ROADMAP.md`

---

## Getting Help

1. **Check Documentation**
   - API Reference
   - Quick Start Guide
   - Examples

2. **Review Error Message**
   - Check error code in response
   - Follow recovery suggestions

3. **Enable Debug Logging**
   ```javascript
   const client = new BassetClient({ logLevel: 'debug' });
   ```

4. **Inspect Network Traffic**
   - Use WebSocket debugger
   - Review request/response payloads

5. **Contact Support**
   - GitHub issues
   - Email support
   - Slack channel

---

**Ready to integrate?** Start with the [Quick Start Guide](QUICK-START-GUIDE.md)
