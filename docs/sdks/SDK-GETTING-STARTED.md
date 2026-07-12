# Basset Hound Browser SDK - Getting Started Guide

## Overview

The Basset Hound Browser SDK provides a complete JavaScript interface for controlling a Basset Hound Browser instance. It includes support for:

- **Browser automation** (navigation, interaction, content extraction)
- **Session management** (checkpoints, branching, rollback)
- **Evasion & fingerprinting** (user agent rotation, proxy management, fingerprint profiles)
- **Monitoring** (page change detection, competitor tracking)
- **High-performance operations** (connection pooling, batch operations, streaming)

## Installation

### Node.js

```bash
npm install basset-hound-sdk
```

### Basic Setup

```javascript
const { BrowserClient } = require('basset-hound-sdk');

// Create client
const client = new BrowserClient('ws://localhost:8765');

// Connect and use
await client.connect();
```

### Browser / ESM

```javascript
import { BrowserClient } from 'basset-hound-sdk/esm';

const client = new BrowserClient('wss://example.com:8765');
await client.connect();
```

## Quick Start (5 Minutes)

### 1. Basic Navigation

```javascript
const { BrowserClient } = require('basset-hound-sdk');

async function main() {
  const client = new BrowserClient('ws://localhost:8765');

  try {
    // Connect to server
    await client.connect();
    console.log('Connected to browser');

    // Navigate to a website
    const nav = await client.navigate('https://example.com');
    console.log('Navigation success:', nav.success);

    // Get page title
    const title = await client.getTitle();
    console.log('Page title:', title.data.title);

    // Take screenshot
    const screenshot = await client.screenshot();
    console.log('Screenshot size:', screenshot.data.size, 'bytes');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.disconnect();
  }
}

main();
```

### 2. Content Extraction

```javascript
async function extractContent() {
  const client = new BrowserClient('ws://localhost:8765');
  await client.connect();

  try {
    // Navigate
    await client.navigate('https://example.com');

    // Extract all data at once
    const content = await client.extractAll();
    console.log('Links:', content.data.links);
    console.log('Forms:', content.data.forms);
    console.log('Images:', content.data.images);

  } finally {
    await client.disconnect();
  }
}
```

### 3. Session Checkpoints

```javascript
async function withCheckpoints() {
  const client = new BrowserClient('ws://localhost:8765');
  await client.connect();

  try {
    // Navigate to page 1
    await client.navigate('https://example.com');
    const content1 = await client.getContent();

    // Create checkpoint
    const cp = await client.createCheckpoint('after-first-page');
    console.log('Checkpoint created:', cp.checkpointId);

    // Navigate elsewhere
    await client.navigate('https://different.com');

    // Rollback to checkpoint
    await client.rollbackToCheckpoint(cp.checkpointId);
    const content2 = await client.getContent();
    
    console.log('Rolled back successfully');

  } finally {
    await client.disconnect();
  }
}
```

### 4. Batch Operations

```javascript
async function batchOps() {
  const client = new BrowserClient('ws://localhost:8765');
  await client.connect();

  try {
    // Execute multiple commands at once
    const responses = await client.batchCommands([
      { command: 'navigate', url: 'https://example.com' },
      { command: 'get_title' },
      { command: 'extract_metadata' },
      { command: 'screenshot' }
    ]);

    responses.forEach((resp, i) => {
      console.log(`Command ${i} success:`, resp.success);
    });

  } finally {
    await client.disconnect();
  }
}
```

### 5. Evasion & Bot Detection Bypass

```javascript
async function withEvasion() {
  const client = new BrowserClient('ws://localhost:8765');
  await client.connect();

  try {
    // Apply fingerprint profile
    await client.applyFingerprint('chrome-100-windows');
    console.log('Fingerprint applied');

    // Rotate user agent
    const ua = await client.rotateUserAgent();
    console.log('New user agent:', ua.data.userAgent);

    // Enable Tor
    await client.enableTor();
    console.log('Tor enabled');

    // Set proxy
    await client.setProxy('socks5://proxy.example.com:1080', {
      username: 'user',
      password: 'pass'
    });
    console.log('Proxy set');

    // Navigate with evasion active
    await client.navigate('https://example.com');

  } finally {
    await client.disconnect();
  }
}
```

## Configuration Options

```javascript
const options = {
  // WebSocket connection timeout in milliseconds
  timeout: 30000,

  // Enable automatic reconnect on disconnect
  autoReconnect: true,

  // Delay between reconnect attempts in milliseconds
  reconnectDelay: 1000,

  // Maximum number of retry attempts for commands
  maxRetries: 3,

  // Enable debug logging to console
  debug: false
};

const client = new BrowserClient('ws://localhost:8765', options);
```

## Connection Management

### Connect & Disconnect

```javascript
// Explicit connection
const client = new BrowserClient('ws://localhost:8765');
await client.connect();

// Check connection status
if (client.isConnected()) {
  console.log('Connected');
}

// Disconnect when done
await client.disconnect();
```

### Auto-reconnect

```javascript
const client = new BrowserClient('ws://localhost:8765', {
  autoReconnect: true,
  reconnectDelay: 1000
});

await client.connect();
// If connection drops, will automatically reconnect
```

### Health Check

```javascript
const healthy = await client.healthCheck();
if (!healthy) {
  console.log('Server is not responding');
  await client.connect(); // Attempt reconnect
}
```

## Event Handling

```javascript
const client = new BrowserClient('ws://localhost:8765');

// Listen to connection events
client.on('connect', () => {
  console.log('Connected to server');
});

client.on('disconnect', () => {
  console.log('Disconnected from server');
});

client.on('error', (error) => {
  console.error('Error:', error);
});

client.on('message', (data) => {
  console.log('Message received:', data);
});

await client.connect();
```

## Error Handling

### Basic Error Handling

```javascript
async function safeNavigate(url) {
  const client = new BrowserClient('ws://localhost:8765');

  try {
    await client.connect();
    const response = await client.navigate(url);

    if (!response.success) {
      console.error('Navigation failed:', response.error);

      // Check for recovery suggestions
      if (response.hasRecovery()) {
        console.log('Recovery suggestion:', response.recovery.suggestion);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.disconnect();
  }
}
```

### Retry Logic

```javascript
async function navigateWithRetry(url, maxRetries = 3) {
  const client = new BrowserClient('ws://localhost:8765', {
    maxRetries: maxRetries
  });

  await client.connect();
  try {
    return await client.navigate(url);
  } finally {
    await client.disconnect();
  }
}
```

## Connection Pooling

For high-performance scenarios with many concurrent operations:

```javascript
const { ConnectionPool } = require('basset-hound-sdk/connection-pool');

async function usePool() {
  // Create pool with 5 connections
  const pool = new ConnectionPool('ws://localhost:8765', 5);
  await pool.connectAll();

  try {
    // Execute commands across pool
    const responses = await Promise.all([
      pool.executeCommand('navigate', { url: 'https://page1.com' }),
      pool.executeCommand('navigate', { url: 'https://page2.com' }),
      pool.executeCommand('navigate', { url: 'https://page3.com' }),
      pool.executeCommand('navigate', { url: 'https://page4.com' }),
      pool.executeCommand('navigate', { url: 'https://page5.com' })
    ]);

    console.log('All pages loaded');

    // Get pool statistics
    const stats = pool.getStats();
    console.log('Pool stats:', stats);

  } finally {
    await pool.closeAll();
  }
}
```

## Advanced Features

### Streaming Large Responses

```javascript
async function streamLargeScreenshot() {
  const client = new BrowserClient('ws://localhost:8765');
  await client.connect();

  try {
    // Stream response with chunk callback
    const response = await client.streamCommand('screenshot', {}, (chunk) => {
      console.log('Received chunk:', chunk.length, 'bytes');
    });

    console.log('Total size:', response.data.buffer.length, 'bytes');

  } finally {
    await client.disconnect();
  }
}
```

### Parallel Batch Operations

```javascript
async function parallelBatch() {
  const client = new BrowserClient('ws://localhost:8765');
  await client.connect();

  try {
    const operations = [
      { command: 'navigate', url: 'https://page1.com' },
      { command: 'navigate', url: 'https://page2.com' },
      { command: 'navigate', url: 'https://page3.com' }
    ];

    // Execute with 2 parallel operations at a time
    const responses = await client.batchParallel(operations, 2);
    console.log('All operations complete');

  } finally {
    await client.disconnect();
  }
}
```

## Common Patterns

### Web Scraping

```javascript
async function scrapeWebsite(url) {
  const client = new BrowserClient('ws://localhost:8765');
  await client.connect();

  try {
    // Navigate
    await client.navigate(url);

    // Extract content
    const title = await client.getTitle();
    const content = await client.getContent();
    const links = await client.extractLinks();
    const metadata = await client.extractMetadata();

    return {
      url: url,
      title: title.data.title,
      html: content.data.html,
      links: links.data.links,
      metadata: metadata.data
    };

  } finally {
    await client.disconnect();
  }
}
```

### Form Filling & Submission

```javascript
async function submitForm() {
  const client = new BrowserClient('ws://localhost:8765');
  await client.connect();

  try {
    await client.navigate('https://example.com/form');

    // Fill form fields
    await client.fill('input[name="email"]', 'user@example.com');
    await client.fill('input[name="password"]', 'secretpassword');
    await client.fill('textarea[name="message"]', 'Hello world');

    // Submit form
    await client.click('button[type="submit"]');

    // Wait for response
    await client.waitForElement('.success-message', 5000);

    const result = await client.getContent();
    return result.data.html;

  } finally {
    await client.disconnect();
  }
}
```

### Multi-page OSINT Workflow

```javascript
async function osintWorkflow(initialUrl) {
  const client = new BrowserClient('ws://localhost:8765');
  await client.connect();

  const results = [];

  try {
    // Apply evasion
    await client.applyFingerprint('chrome-100-windows');
    await client.rotateUserAgent();

    // Start with initial page
    await client.navigate(initialUrl);
    const initial = await client.extractAll();
    results.push({
      url: initialUrl,
      data: initial.data
    });

    // Create checkpoint before exploring links
    const cp = await client.createCheckpoint('initial-state');

    // Visit each discovered link (limited for safety)
    for (const link of initial.data.links.slice(0, 5)) {
      try {
        await client.navigate(link);
        await client.waitForElement('body', 3000);
        const pageData = await client.extractMetadata();
        results.push({
          url: link,
          metadata: pageData.data
        });
      } catch (e) {
        console.log('Failed to visit:', link);
      }

      // Rollback to checkpoint between visits
      await client.rollbackToCheckpoint(cp.checkpointId);
    }

    return results;

  } finally {
    await client.disconnect();
  }
}
```

## Troubleshooting

### Connection Issues

```javascript
// Check server is running
const client = new BrowserClient('ws://localhost:8765');
try {
  await client.connect();
} catch (e) {
  console.error('Cannot connect to server at localhost:8765');
  console.error('Make sure server is running: npm start');
}
```

### Timeout Errors

```javascript
// Increase timeout for slow operations
const client = new BrowserClient('ws://localhost:8765', {
  timeout: 60000 // 60 seconds
});
```

### Debug Logging

```javascript
const client = new BrowserClient('ws://localhost:8765', {
  debug: true // Enable console logging
});
```

## API Reference

See [SDK-API-REFERENCE.md](../archive/deprecated/SDK-API-REFERENCE.md) for complete method documentation.

## Examples

See [SDK-EXAMPLES.md](../archive/deprecated/SDK-EXAMPLES.md) for advanced examples and use cases.

## Architecture

See [SDK-ARCHITECTURE.md](../architecture/core/PYTHON-SDK-ARCHITECTURE.md) for internal design details.

---

**Version:** 12.2.0  
**Last Updated:** June 2026  
**Repository:** [Basset Hound Browser](https://github.com/basset-hound-browser)
