# Tutorial 1: Getting Started with Basset Hound Browser
**Version:** v12.2.0
**Time to Complete:** 15 minutes
**Difficulty:** Beginner

## What You'll Learn
- Connect to the Basset Hound Browser
- Send your first command
- Extract data from a website
- Handle responses and errors

## Prerequisites
- Node.js 14+ installed
- WebSocket client library: `npm install ws`
- Basset Hound Browser running on localhost:8765

---

## Step 1: Install Dependencies

```bash
mkdir basset-example
cd basset-example
npm init -y
npm install ws
```

## Step 2: Create Basic Connection Script

Create `connect.js`:

```javascript
const WebSocket = require('ws');

// Connect to Basset Hound Browser
const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  console.log('✓ Connected!');
  
  // Send a simple command
  ws.send(JSON.stringify({
    id: '1',
    command: 'getVersion'
  }));
});

ws.on('message', (data) => {
  console.log('Response:', JSON.parse(data));
  ws.close();
});

ws.on('error', (error) => {
  console.error('Error:', error.message);
});
```

## Step 3: Run Your First Script

```bash
node connect.js
```

Expected output:
```
✓ Connected!
Response: {
  id: '1',
  command: 'getVersion',
  status: 'success',
  data: { version: '12.2.0' }
}
```

## Step 4: Navigate to a Website

Create `navigate.js`:

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

function sendCommand(command, params) {
  ws.send(JSON.stringify({
    id: Date.now().toString(),
    command,
    ...params
  }));
}

ws.on('open', () => {
  console.log('✓ Connected');
  
  // Navigate to a website
  sendCommand('navigate', {
    url: 'https://example.com',
    waitFor: 3000  // Wait 3 seconds for page load
  });
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  
  if (response.status === 'success') {
    console.log(`✓ Navigated to: ${response.data?.url}`);
    
    // Now extract the text content
    sendCommand('extractText', {});
  } else if (response.command === 'extractText') {
    console.log(`✓ Extracted ${response.data?.length} characters`);
    console.log('Content preview:', response.data?.substring(0, 200));
    ws.close();
  }
});
```

## Step 5: Extract Data

Create `extract.js`:

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');
let commandCount = 0;

function sendCommand(command, params = {}) {
  const id = `cmd-${++commandCount}`;
  console.log(`→ Sending: ${command}`);
  
  ws.send(JSON.stringify({
    id,
    command,
    ...params
  }));
  
  return id;
}

ws.on('open', () => {
  console.log('✓ Connected\n');
  sendCommand('navigate', { url: 'https://example.com' });
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log(`✓ Response: ${response.command}\n`);
  
  switch (response.command) {
    case 'navigate':
      if (response.status === 'success') {
        sendCommand('extractText', {});
        sendCommand('extractLinks', {});
        sendCommand('extractMetadata', {});
      }
      break;
      
    case 'extractText':
      console.log(`  Text: ${response.data?.length} chars\n`);
      break;
      
    case 'extractLinks':
      console.log(`  Links: ${response.data?.length} found`);
      if (response.data?.[0]) {
        console.log(`  First link: ${response.data[0].href}\n`);
      }
      break;
      
    case 'extractMetadata':
      console.log(`  Title: ${response.data?.title}`);
      console.log(`  URL: ${response.data?.url}`);
      console.log(`  Description: ${response.data?.description}\n`);
      ws.close();
      break;
  }
});

ws.on('error', (error) => {
  console.error('✗ Error:', error.message);
});
```

## Step 6: Add Error Handling

Create `robust.js` (better error handling):

```javascript
const WebSocket = require('ws');

class BassetClient {
  constructor(url = 'ws://localhost:8765') {
    this.url = url;
    this.ws = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          console.log('✓ Connected to Basset Hound Browser');
          this.setupMessageHandler();
          resolve();
        });

        this.ws.on('error', (error) => {
          console.error('✗ Connection error:', error.message);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  setupMessageHandler() {
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        
        // Check if this is a response to a pending request
        if (this.pendingRequests.has(message.id)) {
          const handler = this.pendingRequests.get(message.id);
          this.pendingRequests.delete(message.id);
          
          if (message.status === 'success') {
            handler.resolve(message);
          } else {
            handler.reject(new Error(message.error));
          }
        }
      } catch (error) {
        console.error('✗ Failed to parse message:', error.message);
      }
    });
  }

  async command(command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = `cmd-${++this.requestId}`;
      const timeout = 30000;

      // Set timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Timeout: ${command}`));
      }, timeout);

      // Register request handler
      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      // Send command
      try {
        this.ws.send(JSON.stringify({
          id,
          command,
          ...params
        }));
      } catch (error) {
        this.pendingRequests.delete(id);
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// === Usage Example ===
async function main() {
  const client = new BassetClient();

  try {
    // Connect
    await client.connect();

    // Navigate
    console.log('Navigating to example.com...');
    const navResult = await client.command('navigate', {
      url: 'https://example.com'
    });
    console.log(`✓ Navigated to: ${navResult.data?.url}`);

    // Extract data
    console.log('\nExtracting data...');
    const textResult = await client.command('extractText', {});
    console.log(`✓ Extracted ${textResult.data?.length} characters`);

    const linksResult = await client.command('extractLinks', {});
    console.log(`✓ Found ${linksResult.data?.length} links`);

    console.log('\n✓ All done!');

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    client.close();
  }
}

main();
```

---

## Common Issues & Solutions

### Issue: "Cannot connect to localhost:8765"
**Solution:**
1. Ensure Basset Hound Browser is running
2. Check port: `netstat -an | grep 8765`
3. Verify WebSocket service started

### Issue: "Timeout waiting for response"
**Solution:**
1. Increase timeout value
2. Check command syntax
3. Verify parameters are valid

### Issue: "extractText returns empty"
**Solution:**
1. Ensure page fully loaded (increase waitFor)
2. Check if website has protection
3. Try with simpler website first

---

## What's Next?

Now that you can:
- ✓ Connect to the browser
- ✓ Send commands
- ✓ Extract data
- ✓ Handle errors

Continue with:
- **Tutorial 2:** Configure Bot Evasion
- **Tutorial 3:** Proxy Rotation
- **Tutorial 4:** Advanced Extraction
- See: [Advanced Guides](/docs/advanced/)

---

**Tutorial Completed**
