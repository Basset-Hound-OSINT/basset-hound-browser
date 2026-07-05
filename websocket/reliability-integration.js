/**
 * Reliability Integration Module
 *
 * This module shows how to integrate ReliabilityManager with the WebSocket server
 * to achieve 99%+ command reliability SLA.
 *
 * Integration pattern:
 * 1. Create ReliabilityManager instance
 * 2. Wrap all command executions with reliabilityManager.execute()
 * 3. Link to HealthEndpointManager for metrics reporting
 * 4. Expose /health/reliability endpoint for monitoring
 *
 * @module websocket/reliability-integration
 */

const { ReliabilityManager } = require('./reliability-manager');
const { HealthEndpointManager } = require('./health-endpoint');

/**
 * Initialize reliability management for WebSocket server
 *
 * Usage in server.js:
 *
 *   const { createReliabilityManager } = require('./reliability-integration');
 *   const { reliabilityManager, healthEndpoint } = createReliabilityManager(options);
 *
 *   // When executing commands:
 *   const result = await reliabilityManager.execute(command, async () => {
 *     return await commandHandler(params);
 *   });
 *
 * @param {Object} options - Configuration options
 * @param {Object} options.logger - Logger instance
 * @param {number} options.maxRetries - Max retry attempts (default: 3)
 * @param {number} options.commandTimeout - Timeout per command in ms (default: 30000)
 * @param {string} options.version - Server version string
 * @returns {Object} { reliabilityManager, healthEndpoint, setupExpressRoutes }
 */
function createReliabilityManager(options = {}) {
  const reliabilityManager = new ReliabilityManager({
    maxRetries: options.maxRetries || 3,
    commandTimeout: options.commandTimeout || 30000,
    logger: options.logger || console
  });

  const healthEndpoint = new HealthEndpointManager({
    reliabilityManager,
    logger: options.logger || console,
    version: options.version || '12.9.0'
  });

  /**
   * Setup Express routes for reliability endpoints
   * Call this after creating your Express app
   */
  function setupExpressRoutes(app) {
    // Main health endpoint
    app.get('/health', healthEndpoint.createHttpHandler());

    // Reliability-focused endpoint
    app.get('/health/reliability', async (req, res) => {
      try {
        const status = await healthEndpoint.getReliabilityStatus();
        const statusCode = status.sla?.compliant !== false ? 200 : 503;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status, null, 2));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Internal server error',
          message: error.message
        }));
      }
    });

    // Raw metrics endpoint
    app.get('/health/metrics', async (req, res) => {
      try {
        const topCommands = reliabilityManager.getTopCommands(20);
        const globalStats = reliabilityManager.getGlobalStats();
        const allMetrics = reliabilityManager.getAllCommandMetrics();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          globalStats,
          topCommands,
          allCommands: allMetrics
        }, null, 2));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Internal server error',
          message: error.message
        }));
      }
    });

    // Recent requests endpoint (for debugging)
    app.get('/health/recent', async (req, res) => {
      try {
        const limit = req.url.includes('?limit=')
          ? parseInt(req.url.split('?limit=')[1], 10)
          : 100;

        const recent = reliabilityManager.getRecentRequests(limit);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          count: recent.length,
          requests: recent
        }, null, 2));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Internal server error',
          message: error.message
        }));
      }
    });
  }

  return {
    reliabilityManager,
    healthEndpoint,
    setupExpressRoutes
  };
}

/**
 * Example of how to wrap command execution
 *
 * Usage in command handler:
 *
 *   const commandHandlers = {
 *     navigateTo: async (params, context) => {
 *       const result = await reliabilityManager.execute('navigateTo', async () => {
 *         // Your actual command logic
 *         return await browser.navigateTo(params.url);
 *       });
 *
 *       if (!result.success) {
 *         throw new Error(result.error);
 *       }
 *
 *       return {
 *         success: true,
 *         data: result.result,
 *         metadata: {
 *           attempts: result.attempts,
 *           latency: result.latency,
 *           retried: result.retried
 *         }
 *       };
 *     }
 *   };
 */

/**
 * Example Express app setup
 *
 * Usage:
 *
 *   const express = require('express');
 *   const { createReliabilityManager } = require('./reliability-integration');
 *   const defaultLogger = require('../logging').defaultLogger;
 *
 *   const app = express();
 *
 *   // Create reliability infrastructure
 *   const { reliabilityManager, healthEndpoint, setupExpressRoutes } =
 *     createReliabilityManager({
 *       logger: defaultLogger,
 *       version: '12.9.0',
 *       commandTimeout: 30000,
 *       maxRetries: 3
 *     });
 *
 *   // Setup Express routes
 *   setupExpressRoutes(app);
 *
 *   // Now use reliabilityManager.execute() for all WebSocket commands
 */

module.exports = {
  createReliabilityManager,
  ReliabilityManager,
  HealthEndpointManager
};
