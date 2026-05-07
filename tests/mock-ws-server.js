/**
 * Mock WebSocket Server for Cost Optimization Testing
 *
 * Provides a WebSocket server that simulates Basset Hound Browser
 * behavior for cost optimization benchmarking without running the
 * full Electron application.
 *
 * Run with: node tests/mock-ws-server.js
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = 8765;
const RESPONSE_DELAYS = {
  'navigate': { min: 50, max: 150 },      // Browser navigation time
  'get_title': { min: 10, max: 30 },      // Quick DOM query
  'get_url': { min: 5, max: 15 },         // Very fast
  'get_content': { min: 30, max: 100 },   // Full page extraction
  'screenshot': { min: 200, max: 400 },   // Heavyweight operation
  'get_cookies': { min: 10, max: 25 }
};

class MockBrowserServer {
  constructor(port = PORT) {
    this.port = port;
    this.server = null;
    this.wss = null;
    this.connections = new Set();
    this.requestCount = 0;
    this.errorCount = 0;
  }

  /**
   * Simulate realistic response delay based on operation type
   */
  getDelay(command) {
    const config = RESPONSE_DELAYS[command] || { min: 50, max: 150 };
    return config.min + Math.random() * (config.max - config.min);
  }

  /**
   * Handle incoming WebSocket commands
   */
  async handleCommand(command, params) {
    const delay = this.getDelay(command);

    // Simulate network delay with some jitter
    const jitter = (Math.random() - 0.5) * 10;
    const actualDelay = Math.max(5, delay + jitter);

    await new Promise(r => setTimeout(r, actualDelay));

    // Simulate occasional failures (0.5% failure rate - very low)
    if (Math.random() < 0.005) {
      this.errorCount++;
      return {
        success: false,
        error: 'Simulated network error',
        command
      };
    }

    this.requestCount++;

    // Generate realistic responses based on command
    switch (command) {
      case 'navigate':
        return {
          success: true,
          command,
          url: params.url || 'https://example.com',
          navigationTime: delay
        };

      case 'get_title':
        return {
          success: true,
          command,
          title: `Mock Page - ${params.url || 'example.com'}`,
          extractionTime: delay
        };

      case 'get_url':
        return {
          success: true,
          command,
          url: params.url || 'https://example.com',
          queryTime: delay
        };

      case 'get_content':
        return {
          success: true,
          command,
          content: `<html><body>Mock content for ${params.url}</body></html>`,
          contentLength: Math.floor(Math.random() * 50000) + 10000,
          extractionTime: delay
        };

      case 'screenshot':
        return {
          success: true,
          command,
          screenshot: 'data:image/png;base64,iVBORw0KGgo=',
          width: 1920,
          height: 1080,
          captureTime: delay
        };

      case 'get_cookies':
        return {
          success: true,
          command,
          cookies: [
            { name: 'mock_cookie', value: 'test_value' }
          ],
          queryTime: delay
        };

      case 'ping':
        return {
          success: true,
          command: 'ping',
          timestamp: Date.now()
        };

      default:
        return {
          success: true,
          command,
          data: 'Mock response'
        };
    }
  }

  /**
   * Start the mock server
   */
  start() {
    return new Promise((resolve) => {
      this.server = http.createServer();
      this.wss = new WebSocket.Server({ server: this.server });

      this.wss.on('connection', (ws) => {
        this.connections.add(ws);
        console.log(`[MockServer] Client connected (total: ${this.connections.size})`);

        ws.on('message', async (data) => {
          try {
            const msg = JSON.parse(data.toString());
            const { id, command, ...params } = msg;

            // Handle the command
            const response = await this.handleCommand(command, params);

            // Send response with ID
            ws.send(JSON.stringify({
              id,
              ...response
            }));
          } catch (error) {
            console.error('[MockServer] Error:', error.message);
          }
        });

        ws.on('close', () => {
          this.connections.delete(ws);
          console.log(`[MockServer] Client disconnected (total: ${this.connections.size})`);
        });

        ws.on('error', (error) => {
          console.error('[MockServer] WebSocket error:', error.message);
        });
      });

      this.server.listen(this.port, () => {
        console.log(`[MockServer] Started on ws://localhost:${this.port}`);
        console.log(`[MockServer] Ready for testing\n`);
        resolve();
      });
    });
  }

  /**
   * Stop the mock server
   */
  stop() {
    return new Promise((resolve) => {
      // Close all connections
      for (const ws of this.connections) {
        ws.close();
      }

      if (this.server) {
        this.server.close(() => {
          console.log('\n[MockServer] Stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      activeConnections: this.connections.size,
      totalRequests: this.requestCount,
      totalErrors: this.errorCount,
      errorRate: (this.errorCount / (this.requestCount + this.errorCount) * 100).toFixed(2),
      successRate: (this.requestCount / (this.requestCount + this.errorCount) * 100).toFixed(2)
    };
  }
}

// Main execution
if (require.main === module) {
  const server = new MockBrowserServer();

  server.start().then(() => {
    console.log('Mock Browser Server is ready!');
    console.log('Run cost optimization tests with:');
    console.log('  node tests/cost-optimization-tests.js [test-name]');
    console.log('');
    console.log('Available tests: all, speed, batch, workflow, resources, model');

    // Print stats periodically
    const statsInterval = setInterval(() => {
      const stats = server.getStats();
      if (stats.totalRequests > 0) {
        console.log(`[Stats] Requests: ${stats.totalRequests}, Errors: ${stats.totalErrors}, Success: ${stats.successRate}%`);
      }
    }, 10000);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      clearInterval(statsInterval);
      const finalStats = server.getStats();
      console.log('\nFinal Statistics:');
      console.log(`  Total requests: ${finalStats.totalRequests}`);
      console.log(`  Total errors: ${finalStats.totalErrors}`);
      console.log(`  Success rate: ${finalStats.successRate}%`);
      await server.stop();
      process.exit(0);
    });
  });
}

module.exports = MockBrowserServer;
