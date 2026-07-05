/**
 * Basset Hound Browser - Configuration Schema Section
 * Extracted verbatim from config/schema.js (see docs/planning/MODULARIZATION-PLAN-2026-07-04.md §3.5).
 * NOTE: This module's field({...}) body is moved, not rewritten — byte-identical to the original.
 */

const { field, Types } = require('../field');
const { defaults } = require('../../defaults');

module.exports = field({
  type: Types.OBJECT,
  description: 'WebSocket server configuration',
  properties: {
    host: field({
      type: Types.STRING,
      default: defaults.server.host,
      description: 'Server host address to bind to',
      pattern: /^[\w.-]+$/
    }),
    port: field({
      type: Types.NUMBER,
      default: defaults.server.port,
      description: 'Server port number',
      min: 1,
      max: 65535
    }),
    ssl: field({
      type: Types.OBJECT,
      description: 'SSL/TLS configuration',
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.server.ssl.enabled,
          description: 'Enable SSL/TLS encryption'
        }),
        certPath: field({
          type: [Types.STRING, Types.NULL],
          default: defaults.server.ssl.certPath,
          description: 'Path to SSL certificate file'
        }),
        keyPath: field({
          type: [Types.STRING, Types.NULL],
          default: defaults.server.ssl.keyPath,
          description: 'Path to SSL private key file'
        }),
        caPath: field({
          type: [Types.STRING, Types.NULL],
          default: defaults.server.ssl.caPath,
          description: 'Path to CA certificate file'
        })
      }
    }),
    auth: field({
      type: Types.OBJECT,
      description: 'Authentication configuration',
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.server.auth.enabled,
          description: 'Enable authentication'
        }),
        token: field({
          type: [Types.STRING, Types.NULL],
          default: defaults.server.auth.token,
          description: 'Authentication token'
        }),
        requireAuth: field({
          type: Types.BOOLEAN,
          default: defaults.server.auth.requireAuth,
          description: 'Require authentication for all connections'
        })
      }
    }),
    heartbeat: field({
      type: Types.OBJECT,
      description: 'Heartbeat/ping-pong configuration',
      properties: {
        interval: field({
          type: Types.NUMBER,
          default: defaults.server.heartbeat.interval,
          description: 'Heartbeat interval in milliseconds',
          min: 1000,
          max: 300000
        }),
        timeout: field({
          type: Types.NUMBER,
          default: defaults.server.heartbeat.timeout,
          description: 'Heartbeat timeout in milliseconds',
          min: 5000,
          max: 600000
        })
      }
    }),
    errorRecovery: field({
      type: Types.OBJECT,
      description: 'Error recovery configuration',
      properties: {
        maxRetries: field({
          type: Types.NUMBER,
          default: defaults.server.errorRecovery.maxRetries,
          description: 'Maximum retry attempts',
          min: 0,
          max: 10
        }),
        retryDelay: field({
          type: Types.NUMBER,
          default: defaults.server.errorRecovery.retryDelay,
          description: 'Base retry delay in milliseconds',
          min: 100,
          max: 30000
        })
      }
    })
  }
});
