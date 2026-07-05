/**
 * Basset Hound Browser - Configuration Schema Section
 * Extracted verbatim from config/schema.js (see docs/planning/MODULARIZATION-PLAN-2026-07-04.md §3.5).
 * NOTE: This module's field({...}) body is moved, not rewritten — byte-identical to the original.
 */

const { field, Types } = require('../field');
const { defaults } = require('../../defaults');

module.exports = field({
  type: Types.OBJECT,
  description: 'Logging configuration',
  properties: {
    level: field({
      type: Types.STRING,
      default: defaults.logging.level,
      description: 'Log level',
      enum: ['error', 'warn', 'info', 'debug', 'trace']
    }),
    console: field({
      type: Types.OBJECT,
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.logging.console.enabled,
          description: 'Enable console logging'
        }),
        colorize: field({
          type: Types.BOOLEAN,
          default: defaults.logging.console.colorize,
          description: 'Colorize console output'
        }),
        timestamp: field({
          type: Types.BOOLEAN,
          default: defaults.logging.console.timestamp,
          description: 'Include timestamp in logs'
        })
      }
    }),
    file: field({
      type: Types.OBJECT,
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.logging.file.enabled,
          description: 'Enable file logging'
        }),
        path: field({
          type: [Types.STRING, Types.NULL],
          default: defaults.logging.file.path,
          description: 'Log file path'
        }),
        maxSize: field({
          type: Types.STRING,
          default: defaults.logging.file.maxSize,
          description: 'Maximum log file size'
        }),
        maxFiles: field({
          type: Types.NUMBER,
          default: defaults.logging.file.maxFiles,
          description: 'Maximum log files to keep',
          min: 1,
          max: 100
        }),
        rotate: field({
          type: Types.BOOLEAN,
          default: defaults.logging.file.rotate,
          description: 'Enable log rotation'
        })
      }
    }),
    network: field({
      type: Types.OBJECT,
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.logging.network.enabled,
          description: 'Enable network logging'
        }),
        logRequests: field({
          type: Types.BOOLEAN,
          default: defaults.logging.network.logRequests,
          description: 'Log network requests'
        }),
        logResponses: field({
          type: Types.BOOLEAN,
          default: defaults.logging.network.logResponses,
          description: 'Log network responses'
        }),
        logHeaders: field({
          type: Types.BOOLEAN,
          default: defaults.logging.network.logHeaders,
          description: 'Log request/response headers'
        }),
        logBody: field({
          type: Types.BOOLEAN,
          default: defaults.logging.network.logBody,
          description: 'Log request/response body'
        })
      }
    }),
    browserConsole: field({
      type: Types.OBJECT,
      properties: {
        capture: field({
          type: Types.BOOLEAN,
          default: defaults.logging.browserConsole.capture,
          description: 'Capture browser console messages'
        }),
        maxLogs: field({
          type: Types.NUMBER,
          default: defaults.logging.browserConsole.maxLogs,
          description: 'Maximum console logs to keep',
          min: 100,
          max: 100000
        }),
        levels: field({
          type: Types.ARRAY,
          default: defaults.logging.browserConsole.levels,
          description: 'Console log levels to capture',
          items: { type: Types.STRING }
        })
      }
    }),
    performance: field({
      type: Types.OBJECT,
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.logging.performance.enabled,
          description: 'Enable performance logging'
        }),
        metrics: field({
          type: Types.BOOLEAN,
          default: defaults.logging.performance.metrics,
          description: 'Log performance metrics'
        }),
        timing: field({
          type: Types.BOOLEAN,
          default: defaults.logging.performance.timing,
          description: 'Log timing information'
        })
      }
    })
  }
});
