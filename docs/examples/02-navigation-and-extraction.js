/**
 * Navigation & Data Extraction Example
 * Demonstrates: Navigate to site, extract content, handle responses
 * Status: Production-ready
 * Version: v12.2.0
 */

const WebSocket = require('ws');

class BrowserAutomation {
  constructor() {
    this.client = null;
    this.requestId = 0;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.client = new WebSocket('ws://localhost:8765');

      this.client.on('open', () => {
        console.log('✓ Browser connected');
        resolve();
      });

      this.client.on('message', this.handleMessage.bind(this));
      this.client.on('error', reject);
    });
  }

  // Send a command and wait for response
  sendCommand(command, params = {}) {
    const id = `req-${++this.requestId}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${command}`));
      }, 30000);

      const handler = (message) => {
        if (message.id === id) {
          clearTimeout(timeout);
          this.client.removeEventListener('message', handler);
          resolve(message);
        }
      };

      // Simple event handling (in real code, use event emitter)
      this.client.once('message', (data) => {
        const message = JSON.parse(data);
        if (message.id === id) {
          clearTimeout(timeout);
          resolve(message);
        }
      });

      const payload = {
        id,
        command,
        ...params
      };

      this.client.send(JSON.stringify(payload));
    });
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      console.log(`Response [${message.id}]:`, message.status);
    } catch (error) {
      console.error('Parse error:', error);
    }
  }

  async runExample() {
    try {
      // 1. Navigate to website
      console.log('\n1. Navigating to example.com...');
      const navResponse = await this.sendCommand('navigate', {
        url: 'https://example.com',
        waitFor: 3000
      });
      console.log(`   Status: ${navResponse.status}`);

      // 2. Extract text content
      console.log('\n2. Extracting text content...');
      const textResponse = await this.sendCommand('extractText', {});
      console.log(`   Extracted ${textResponse.data?.length || 0} characters`);

      // 3. Extract links
      console.log('\n3. Extracting links...');
      const linksResponse = await this.sendCommand('extractLinks', {});
      console.log(`   Found ${linksResponse.data?.length || 0} links`);

      // 4. Take screenshot
      console.log('\n4. Taking screenshot...');
      const screenshotResponse = await this.sendCommand('screenshot', {
        filename: 'example-page.png'
      });
      console.log(`   Screenshot saved: ${screenshotResponse.data?.path}`);

      // 5. Extract metadata
      console.log('\n5. Extracting metadata...');
      const metaResponse = await this.sendCommand('extractMetadata', {});
      console.log(`   Title: ${metaResponse.data?.title}`);
      console.log(`   URL: ${metaResponse.data?.url}`);

      console.log('\n✓ All operations completed successfully');

    } catch (error) {
      console.error('Error:', error.message);
    } finally {
      this.client.close();
    }
  }
}

// === Run Example ===
async function main() {
  const browser = new BrowserAutomation();

  try {
    await browser.connect();
    await browser.runExample();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
