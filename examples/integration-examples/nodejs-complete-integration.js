#!/usr/bin/env node

/**
 * Basset Hound Browser - Complete Node.js Integration Example
 * Version: 1.0.0
 * Date: 2026-05-11
 *
 * Comprehensive example showing how to integrate Basset Hound with external
 * Node.js systems. Demonstrates:
 * - Connection management
 * - Error handling and recovery
 * - Real-world workflows
 * - Data persistence
 * - Logging and monitoring
 * - Performance optimization
 *
 * Usage:
 *   node nodejs-complete-integration.js
 *   node nodejs-complete-integration.js --concurrent=5
 *   node nodejs-complete-integration.js --sites=urls.json --output=results.json
 */

const fs = require('fs');
const path = require('path');
const { BassetHoundClient } = require('../../integrations/nodejs_client.js');
const { ConnectionPool } = require('../../websocket/connection-pool');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Browser connection
  browserHost: process.env.BROWSER_HOST || 'localhost',
  browserPort: parseInt(process.env.BROWSER_PORT || '8765'),
  commandTimeout: 30000,

  // Workflow settings
  pageLoadDelay: 2000,
  maxConcurrentConnections: 3,
  retryAttempts: 3,
  retryDelay: 1000,

  // Output
  outputDir: path.join(__dirname, 'output'),
  logFile: path.join(__dirname, 'output', 'integration.log'),

  // Sample URLs to analyze
  sampleUrls: [
    'https://httpbin.org/html',
    'https://httpbin.org/delay/1',
    'https://httpbin.org/status/200'
  ]
};

// ============================================================================
// LOGGER
// ============================================================================

class Logger {
  constructor(logFile) {
    this.logFile = logFile;
    this.logs = [];
    this.ensureDirectory();
  }

  ensureDirectory() {
    const dir = path.dirname(this.logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      pid: process.pid
    };

    this.logs.push(logEntry);

    // Also log to console
    const prefix = `[${timestamp}] [${level}]`;
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }

    // Periodically flush to file
    if (this.logs.length >= 10) {
      this.flush();
    }
  }

  flush() {
    if (this.logs.length === 0) return;

    try {
      const existing = fs.existsSync(this.logFile)
        ? fs.readFileSync(this.logFile, 'utf8')
        : '';

      const content = existing + this.logs.map(l => JSON.stringify(l)).join('\n') + '\n';
      fs.writeFileSync(this.logFile, content);
      this.logs = [];
    } catch (err) {
      console.error('Failed to flush logs:', err.message);
    }
  }

  info(message, data) {
    this.log('INFO', message, data);
  }

  warn(message, data) {
    this.log('WARN', message, data);
  }

  error(message, data) {
    this.log('ERROR', message, data);
  }

  debug(message, data) {
    this.log('DEBUG', message, data);
  }
}

// ============================================================================
// INTEGRATION MANAGER
// ============================================================================

class BassetHoundIntegrationManager {
  constructor(options = {}) {
    this.options = { ...CONFIG, ...options };
    this.logger = new Logger(this.options.logFile);
    this.results = {
      timestamp: new Date().toISOString(),
      config: this.options,
      sites: [],
      summary: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0
      }
    };
    this.totalResponseTime = 0;
  }

  async initialize() {
    this.logger.info('Initializing Basset Hound Integration Manager');
    // Could create connection pool here if needed
  }

  /**
   * Analyze a single URL
   */
  async analyzeUrl(url) {
    const client = new BassetHoundClient(
      this.options.browserHost,
      this.options.browserPort,
      this.options.commandTimeout
    );

    const startTime = Date.now();
    const result = {
      url,
      status: 'pending',
      data: null,
      error: null,
      metrics: {
        startTime,
        endTime: null,
        duration: null
      }
    };

    try {
      // Connect with retry logic
      await this.connectWithRetry(client);

      // Navigate to URL
      this.logger.debug(`Navigating to ${url}`);
      await client.navigate(url);

      // Wait for page load
      await new Promise(r => setTimeout(r, this.options.pageLoadDelay));

      // Extract data
      const pageState = await client.getPageState();
      const content = await client.getContent();
      const links = await client.extractLinks();

      // Get screenshot
      let screenshot = null;
      try {
        screenshot = await client.screenshot();
      } catch (err) {
        this.logger.warn(`Screenshot failed for ${url}:`, err.message);
      }

      // Compile results
      result.status = 'success';
      result.data = {
        title: pageState.data?.title,
        url: pageState.data?.url,
        contentLength: content.data?.html?.length || 0,
        linksCount: links.data?.links?.length || 0,
        screenshotSize: screenshot ? screenshot.length : 0
      };

      this.logger.info(`Successfully analyzed ${url}`, result.data);

    } catch (err) {
      result.status = 'failed';
      result.error = err.message;
      this.logger.error(`Failed to analyze ${url}:`, err.message);

    } finally {
      await client.disconnect();
      result.metrics.endTime = Date.now();
      result.metrics.duration = result.metrics.endTime - startTime;
      this.totalResponseTime += result.metrics.duration;
    }

    return result;
  }

  /**
   * Connect with retry logic
   */
  async connectWithRetry(client) {
    let lastError;

    for (let attempt = 0; attempt < this.options.retryAttempts; attempt++) {
      try {
        await client.connect();
        return;
      } catch (err) {
        lastError = err;
        if (attempt < this.options.retryAttempts - 1) {
          const delay = this.options.retryDelay * Math.pow(2, attempt);
          this.logger.warn(`Connection failed, retrying in ${delay}ms`, err.message);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Analyze multiple URLs with concurrency control
   */
  async analyzeMultipleUrls(urls) {
    this.logger.info(`Starting analysis of ${urls.length} URLs with concurrency=${this.options.maxConcurrentConnections}`);

    const results = [];
    const queue = [...urls];
    const active = new Set();

    while (queue.length > 0 || active.size > 0) {
      // Start new tasks if below concurrency limit
      while (active.size < this.options.maxConcurrentConnections && queue.length > 0) {
        const url = queue.shift();
        const task = this.analyzeUrl(url)
          .then(result => {
            results.push(result);
            active.delete(task);
            this.results.summary.total += 1;
            if (result.status === 'success') {
              this.results.summary.successful += 1;
            } else {
              this.results.summary.failed += 1;
            }
          })
          .catch(err => {
            this.logger.error(`Task error for ${url}:`, err.message);
            active.delete(task);
          });

        active.add(task);
      }

      // Wait for one task to complete
      if (active.size > 0) {
        await Promise.race(active);
      }
    }

    return results;
  }

  /**
   * Generate and save results
   */
  async finalize(siteResults) {
    this.results.sites = siteResults;

    if (this.results.summary.total > 0) {
      this.results.summary.averageResponseTime =
        this.totalResponseTime / this.results.summary.total;
      this.results.summary.successRate =
        (this.results.summary.successful / this.results.summary.total * 100).toFixed(2) + '%';
    }

    // Save results
    const outputFile = path.join(this.options.outputDir, `results-${Date.now()}.json`);
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    fs.writeFileSync(outputFile, JSON.stringify(this.results, null, 2));
    this.logger.info(`Results saved to ${outputFile}`);

    // Print summary
    this.printSummary();

    return outputFile;
  }

  /**
   * Print summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('INTEGRATION TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total URLs: ${this.results.summary.total}`);
    console.log(`Successful: ${this.results.summary.successful}`);
    console.log(`Failed: ${this.results.summary.failed}`);
    console.log(`Success Rate: ${this.results.summary.successRate}`);
    console.log(`Avg Response Time: ${this.results.summary.averageResponseTime.toFixed(2)}ms`);
    console.log('='.repeat(80) + '\n');
  }
}

// ============================================================================
// EXAMPLE: DATABASE INTEGRATION
// ============================================================================

class DatabaseIntegration {
  /**
   * Example: Save results to a mock database
   */
  static async saveResults(results) {
    console.log('Simulating database save...');

    // In real scenario, this would be:
    // await db.collection('analysis_results').insertOne(results);

    return {
      success: true,
      id: `result_${Date.now()}`,
      savedAt: new Date().toISOString()
    };
  }
}

// ============================================================================
// EXAMPLE: WEBHOOK INTEGRATION
// ============================================================================

class WebhookIntegration {
  /**
   * Example: Send results via webhook
   */
  static async notifyWebhook(results, webhookUrl = 'https://example.com/webhooks') {
    console.log(`Simulating webhook POST to ${webhookUrl}`);

    // In real scenario, this would be:
    // await fetch(webhookUrl, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(results)
    // });

    return {
      success: true,
      statusCode: 200,
      sentAt: new Date().toISOString()
    };
  }
}

// ============================================================================
// EXAMPLE: STREAMING RESULTS
// ============================================================================

class StreamingIntegration {
  /**
   * Example: Stream results as they arrive
   */
  static async *streamResults(urls) {
    const client = new BassetHoundClient();

    for (const url of urls) {
      yield {
        url,
        status: 'processing'
      };

      try {
        await client.connect();
        await client.navigate(url);
        const state = await client.getPageState();

        yield {
          url,
          status: 'complete',
          title: state.data?.title
        };

        await client.disconnect();
      } catch (err) {
        yield {
          url,
          status: 'failed',
          error: err.message
        };
      }
    }
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const manager = new BassetHoundIntegrationManager();

  try {
    // Initialize
    await manager.initialize();

    // Get URLs to analyze
    let urls = manager.options.sampleUrls;

    // Check for command line arguments
    if (process.argv.includes('--urls')) {
      const idx = process.argv.indexOf('--urls');
      if (idx + 1 < process.argv.length) {
        const file = process.argv[idx + 1];
        if (fs.existsSync(file)) {
          urls = JSON.parse(fs.readFileSync(file, 'utf8'));
          manager.logger.info(`Loaded ${urls.length} URLs from ${file}`);
        }
      }
    }

    // Analyze URLs
    manager.logger.info(`Analyzing ${urls.length} URLs`);
    const results = await manager.analyzeMultipleUrls(urls);

    // Finalize and save
    const outputFile = await manager.finalize(results);

    // Demonstrate integrations
    console.log('\nDemonstrating external integrations...\n');

    // Save to database (simulated)
    const dbResult = await DatabaseIntegration.saveResults(manager.results);
    console.log('Database integration:', dbResult);

    // Notify via webhook (simulated)
    const webhookResult = await WebhookIntegration.notifyWebhook(manager.results);
    console.log('Webhook integration:', webhookResult);

    // Flush logs
    manager.logger.flush();

    console.log(`\nIntegration test completed successfully`);
    console.log(`Results: ${outputFile}`);
    console.log(`Logs: ${manager.options.logFile}`);

  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  BassetHoundIntegrationManager,
  DatabaseIntegration,
  WebhookIntegration,
  StreamingIntegration
};
