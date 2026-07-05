# Custom Integration Guide

**Version**: 12.2.0
**Status**: Enterprise Ready
**Last Updated**: June 3, 2026
**Purpose**: Build custom integrations with Basset Hound Browser API

## Table of Contents

1. [Overview](#overview)
2. [Integration Patterns](#integration-patterns)
3. [Protocol Selection](#protocol-selection)
4. [Building Custom Clients](#building-custom-clients)
5. [Authentication Strategies](#authentication-strategies)
6. [Error Handling & Resilience](#error-handling--resilience)
7. [Performance Optimization](#performance-optimization)
8. [Example Integrations](#example-integrations)
9. [Testing & Validation](#testing--validation)

---

## Overview

The Basset Hound Browser API is highly flexible, supporting multiple protocols and patterns for custom integration:

### Available Protocols

1. **WebSocket** - Real-time bidirectional communication
2. **HTTP/REST** - Traditional request-response pattern
3. **Webhook** - Event-driven push notifications
4. **gRPC** - High-performance RPC (future)
5. **MQTT** - IoT/lightweight messaging (future)

### Integration Scenarios

- **OSINT Automation**: Automated intelligence gathering
- **Monitoring Systems**: Real-time web monitoring
- **Data Extraction**: Large-scale web scraping
- **Testing Frameworks**: Browser testing automation
- **Reporting Tools**: Automated report generation
- **Custom Dashboards**: Real-time browser control UI
- **Mobile Apps**: Remote browser control from mobile

---

## Integration Patterns

### Pattern 1: Direct API Client

**Best For**: Single application, direct control

```
Your App → Browser API → Browser
```

**Pros:**
- Simple, direct control
- Low latency
- Easy debugging

**Cons:**
- Tight coupling
- Single point of failure
- Difficult to scale

### Pattern 2: Message Queue

**Best For**: Asynchronous processing, scaling

```
Your App → Queue → Worker → Browser API → Browser
```

**Pros:**
- Decoupled
- Scalable
- Resilient
- Async processing

**Cons:**
- More complex
- Eventual consistency
- Infrastructure overhead

### Pattern 3: Multi-Layer Orchestration

**Best For**: Complex workflows, multiple services

```
Your App → Orchestrator → Service 1 ─┐
                      ├─ Service 2 ─→ Browser API
                      └─ Service 3 ─┘
```

**Pros:**
- Flexible
- Reusable services
- Easy to extend

**Cons:**
- Complex
- Debugging difficult
- Latency overhead

### Pattern 4: Proxy/Gateway

**Best For**: Legacy systems, protocol translation

```
Your App → Gateway → Browser API
(Any Protocol)       (HTTP/WS)
```

**Pros:**
- Protocol agnostic
- Easy legacy integration
- Centralized control

**Cons:**
- Single bottleneck
- Extra latency
- Complex routing

---

## Protocol Selection

### WebSocket

**Use When:**
- Real-time control needed
- Bi-directional communication
- Long-lived connection required
- Low-latency critical

**Code Example:**
```javascript
const ws = new WebSocket('ws://localhost:8765');

ws.onopen = () => {
  ws.send(JSON.stringify({
    id: 1,
    command: 'navigate',
    url: 'https://example.com'
  }));
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log('Response:', response);
};
```

### REST/HTTP

**Use When:**
- Traditional HTTP integration
- Request-response pattern
- Stateless operations
- Simple polling acceptable

**Code Example:**
```javascript
const fetch = require('node-fetch');

async function navigate(url) {
  const response = await fetch('http://localhost:8766/api/v1/navigate', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer TOKEN',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url })
  });

  return response.json();
}
```

### Webhook

**Use When:**
- Event-driven processing
- Push notifications needed
- Async communication
- Decoupled systems

**Code Example:**
```javascript
// Register webhook
const webhook = await fetch('http://localhost:8766/api/v1/webhooks', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer TOKEN' },
  body: JSON.stringify({
    url: 'https://your-server.com/webhook',
    events: ['navigation.complete', 'screenshot.taken']
  })
});

// Receive events
app.post('/webhook', (req, res) => {
  const event = req.body;
  console.log('Event:', event);
  res.json({ success: true });
});
```

---

## Building Custom Clients

### JavaScript/Node.js Client

```javascript
const EventEmitter = require('events');
const WebSocket = require('ws');

class BassetHoundClient extends EventEmitter {
  constructor(url, options = {}) {
    super();
    this.url = url;
    this.options = options;
    this.ws = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnect || 5;
    this.reconnectDelay = options.reconnectDelay || 1000;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('Connected to Basset Hound');
        this.reconnectAttempts = 0;
        this.emit('connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('Disconnected from Basset Hound');
        this.emit('disconnected');
        this.attemptReconnect();
      };
    });
  }

  async execute(command, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const requestId = ++this.requestId;
    const request = { id: requestId, command, ...params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Command timeout: ${command}`));
      }, params.timeout || 30000);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      this.ws.send(JSON.stringify(request));
    });
  }

  handleMessage(message) {
    const pending = this.pendingRequests.get(message.id);

    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.id);

      if (message.success) {
        pending.resolve(message.data);
      } else {
        pending.reject(new Error(message.error));
      }
    } else {
      this.emit('event', message);
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Reconnecting in ${delay}ms...`);

      setTimeout(() => this.connect().catch(() => {}), delay);
    }
  }

  // High-level API
  async navigate(url, options = {}) {
    return this.execute('navigate', { url, ...options });
  }

  async screenshot(options = {}) {
    return this.execute('screenshot', options);
  }

  async click(selector) {
    return this.execute('click', { selector });
  }

  async fill(selector, value) {
    return this.execute('fill', { selector, value });
  }

  async extractContent(types = []) {
    return this.execute('extract_all', { types });
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Usage
const client = new BassetHoundClient('ws://localhost:8765');

await client.connect();
await client.navigate('https://example.com');
await new Promise(r => setTimeout(r, 3000));
const screenshot = await client.screenshot();
client.close();
```

### Python Client

```python
import asyncio
import json
import websockets
from typing import Dict, Any

class BassetHoundClient:
    def __init__(self, url: str = "ws://localhost:8765"):
        self.url = url
        self.ws = None
        self.request_id = 0
        self.pending = {}

    async def connect(self):
        self.ws = await websockets.connect(self.url)
        asyncio.create_task(self.receive_messages())

    async def receive_messages(self):
        async for message in self.ws:
            data = json.loads(message)
            self.handle_message(data)

    def handle_message(self, message: Dict[str, Any]):
        request_id = message.get('id')
        if request_id in self.pending:
            future = self.pending.pop(request_id)
            if message.get('success'):
                future.set_result(message.get('data'))
            else:
                future.set_exception(
                    Exception(message.get('error'))
                )

    async def execute(self, command: str, **params) -> Dict[str, Any]:
        self.request_id += 1
        request = {
            'id': self.request_id,
            'command': command,
            **params
        }

        future = asyncio.Future()
        self.pending[self.request_id] = future

        await self.ws.send(json.dumps(request))
        return await future

    async def navigate(self, url: str):
        return await self.execute('navigate', url=url)

    async def screenshot(self, format: str = 'png'):
        return await self.execute('screenshot', format=format)

    async def click(self, selector: str):
        return await self.execute('click', selector=selector)

    async def close(self):
        await self.ws.close()

# Usage
async def main():
    client = BassetHoundClient()
    await client.connect()
    
    await client.navigate('https://example.com')
    await asyncio.sleep(3)
    screenshot = await client.screenshot()
    
    await client.close()

asyncio.run(main())
```

### Go Client

```go
package main

import (
	"encoding/json"
	"fmt"
	"github.com/gorilla/websocket"
	"sync"
)

type BassetHoundClient struct {
	ws              *websocket.Conn
	requestID       int
	pendingRequests map[int]chan interface{}
	mu              sync.Mutex
}

func NewBassetHoundClient(url string) (*BassetHoundClient, error) {
	ws, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		return nil, err
	}

	client := &BassetHoundClient{
		ws:              ws,
		pendingRequests: make(map[int]chan interface{}),
	}

	go client.receiveMessages()
	return client, nil
}

func (c *BassetHoundClient) receiveMessages() {
	for {
		var message map[string]interface{}
		err := c.ws.ReadJSON(&message)
		if err != nil {
			return
		}
		c.handleMessage(message)
	}
}

func (c *BassetHoundClient) handleMessage(message map[string]interface{}) {
	id := int(message["id"].(float64))
	c.mu.Lock()
	ch, exists := c.pendingRequests[id]
	delete(c.pendingRequests, id)
	c.mu.Unlock()

	if exists {
		ch <- message
	}
}

func (c *BassetHoundClient) Execute(command string, params map[string]interface{}) (map[string]interface{}, error) {
	c.mu.Lock()
	c.requestID++
	id := c.requestID
	c.mu.Unlock()

	request := make(map[string]interface{})
	request["id"] = id
	request["command"] = command
	for k, v := range params {
		request[k] = v
	}

	ch := make(chan interface{})
	c.mu.Lock()
	c.pendingRequests[id] = ch
	c.mu.Unlock()

	c.ws.WriteJSON(request)

	response := <-ch
	return response.(map[string]interface{}), nil
}

func (c *BassetHoundClient) Navigate(url string) (map[string]interface{}, error) {
	return c.Execute("navigate", map[string]interface{}{"url": url})
}

func (c *BassetHoundClient) Screenshot() (map[string]interface{}, error) {
	return c.Execute("screenshot", map[string]interface{}{})
}

func (c *BassetHoundClient) Close() error {
	return c.ws.Close()
}
```

---

## Authentication Strategies

### Bearer Token

```javascript
const headers = {
  'Authorization': 'Bearer YOUR_TOKEN'
};

const ws = new WebSocket('ws://localhost:8765?token=YOUR_TOKEN');
```

### API Key

```javascript
const headers = {
  'X-API-Key': 'your-api-key'
};
```

### OAuth 2.0

```javascript
// Get access token
const tokenResponse = await fetch('http://localhost:8766/oauth/token', {
  method: 'POST',
  body: {
    client_id: 'your-client-id',
    client_secret: 'your-client-secret',
    grant_type: 'client_credentials'
  }
});

const { access_token } = await tokenResponse.json();

// Use token
const headers = {
  'Authorization': `Bearer ${access_token}`
};
```

### Mutual TLS

```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('client-key.pem'),
  cert: fs.readFileSync('client-cert.pem'),
  ca: fs.readFileSync('ca-cert.pem')
};

const agent = new https.Agent(options);
```

---

## Error Handling & Resilience

### Retry with Exponential Backoff

```javascript
async function executeWithRetry(client, command, params, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await client.execute(command, params);
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}
```

### Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}
```

### Timeout Management

```javascript
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    )
  ]);
}

// Usage
const screenshot = await withTimeout(
  client.screenshot(),
  30000 // 30 second timeout
);
```

---

## Performance Optimization

### Connection Pooling

```javascript
class ConnectionPool {
  constructor(size = 5) {
    this.size = size;
    this.connections = [];
    this.available = [];
    this.waiting = [];
  }

  async initialize() {
    for (let i = 0; i < this.size; i++) {
      const client = new BassetHoundClient();
      await client.connect();
      this.connections.push(client);
      this.available.push(client);
    }
  }

  async acquire() {
    if (this.available.length > 0) {
      return this.available.pop();
    }

    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }

  release(client) {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      resolve(client);
    } else {
      this.available.push(client);
    }
  }

  async close() {
    for (const client of this.connections) {
      client.close();
    }
  }
}

// Usage
const pool = new ConnectionPool(10);
await pool.initialize();

const client = await pool.acquire();
await client.navigate('https://example.com');
pool.release(client);
```

### Batch Operations

```javascript
async function batchScreenshots(urls, batchSize = 5) {
  const results = [];

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);

    const promises = batch.map(url =>
      (async () => {
        await client.navigate(url);
        await new Promise(r => setTimeout(r, 2000));
        return client.screenshot();
      })()
    );

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
  }

  return results;
}
```

---

## Example Integrations

### Integration 1: Slack Bot

```javascript
const { App } = require('@slack/bolt');
const BassetHoundClient = require('./basset-client');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

const client = new BassetHoundClient();

app.command('/screenshot', async ({ ack, command, respond }) => {
  ack();

  try {
    const url = command.text || 'https://example.com';
    await client.navigate(url);
    await new Promise(r => setTimeout(r, 3000));
    const result = await client.screenshot();

    await respond({
      text: `Screenshot of ${url}`,
      image_url: `data:image/png;base64,${result.screenshot}`
    });
  } catch (error) {
    await respond(`Error: ${error.message}`);
  }
});

(async () => {
  await app.start();
})();
```

### Integration 2: Monitoring System

```javascript
class MonitoringSystem {
  constructor(client, config) {
    this.client = client;
    this.config = config;
    this.metrics = {};
  }

  async monitorUrl(url) {
    const start = Date.now();

    try {
      await this.client.navigate(url);
      const duration = Date.now() - start;

      this.metrics[url] = {
        success: true,
        duration,
        timestamp: new Date()
      };
    } catch (error) {
      this.metrics[url] = {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  async runMonitoring() {
    setInterval(async () => {
      for (const url of this.config.urls) {
        await this.monitorUrl(url);
      }
    }, this.config.interval);
  }

  getReport() {
    const successful = Object.values(this.metrics)
      .filter(m => m.success).length;
    const total = Object.keys(this.metrics).length;

    return {
      uptime: (successful / total * 100).toFixed(2) + '%',
      metrics: this.metrics
    };
  }
}
```

### Integration 3: Data Extraction Pipeline

```javascript
class ExtractionPipeline {
  constructor(client) {
    this.client = client;
  }

  async extractFromUrl(url) {
    await this.client.navigate(url);
    await new Promise(r => setTimeout(r, 3000));

    const [content, links, images, metadata] = await Promise.all([
      this.client.execute('get_content'),
      this.client.execute('extract_links'),
      this.client.execute('extract_images'),
      this.client.execute('extract_metadata')
    ]);

    return {
      url,
      content,
      links,
      images,
      metadata,
      extracted: new Date()
    };
  }

  async processUrls(urls) {
    return Promise.all(
      urls.map(url => this.extractFromUrl(url))
    );
  }
}
```

---

## Testing & Validation

### Unit Testing

```javascript
const assert = require('assert');
const BassetHoundClient = require('./basset-client');

describe('BassetHoundClient', () => {
  let client;

  before(async () => {
    client = new BassetHoundClient();
    await client.connect();
  });

  after(async () => {
    await client.close();
  });

  it('should navigate to URL', async () => {
    const result = await client.navigate('https://example.com');
    assert(result.url === 'https://example.com');
  });

  it('should take screenshot', async () => {
    const result = await client.screenshot();
    assert(result.format === 'png');
    assert(result.screenshot);
  });

  it('should click element', async () => {
    await client.navigate('https://example.com');
    const result = await client.click('a');
    assert(result.clicked);
  });
});
```

### Integration Testing

```javascript
describe('Integration Tests', () => {
  it('should complete workflow', async () => {
    // 1. Navigate
    await client.navigate('https://example.com');

    // 2. Wait for page
    await new Promise(r => setTimeout(r, 3000));

    // 3. Click form
    await client.click('form');

    // 4. Fill field
    await client.fill('input[name="search"]', 'test');

    // 5. Submit
    await client.click('button[type="submit"]');

    // 6. Verify results
    const content = await client.execute('get_content');
    assert(content.includes('results'));
  });
});
```

---

## Deployment Considerations

### Docker Support

```dockerfile
FROM node:16-alpine

WORKDIR /app
COPY package.json .
RUN npm install

COPY . .

ENV BASSET_HOST=basset-hound-browser
ENV BASSET_PORT=8765

CMD ["node", "index.js"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: basset-integration
spec:
  replicas: 3
  selector:
    matchLabels:
      app: basset-integration
  template:
    metadata:
      labels:
        app: basset-integration
    spec:
      containers:
      - name: integration
        image: basset-integration:latest
        env:
        - name: BASSET_HOST
          value: basset-hound-browser
        - name: BASSET_PORT
          value: "8765"
```

### Environment Variables

```bash
BASSET_HOST=localhost           # Browser hostname
BASSET_PORT=8765               # WebSocket port
BASSET_REST_PORT=8766          # REST API port
BASSET_TOKEN=your-token        # API token
LOG_LEVEL=info                 # Logging level
CONNECTION_POOL_SIZE=10        # Pool size
```

