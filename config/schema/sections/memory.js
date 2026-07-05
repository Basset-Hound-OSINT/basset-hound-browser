/**
 * Basset Hound Browser - Configuration Schema Section
 * Extracted verbatim from config/schema.js (see docs/planning/MODULARIZATION-PLAN-2026-07-04.md §3.5).
 * NOTE: This module's field({...}) body is moved, not rewritten — byte-identical to the original.
 */

const { field, Types } = require('../field');
const { defaults } = require('../../defaults');

module.exports = field({
  type: Types.OBJECT,
  description: 'Memory management configuration',
  properties: {
    monitoring: field({
      type: Types.OBJECT,
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.memory.monitoring.enabled,
          description: 'Enable memory monitoring'
        }),
        interval: field({
          type: Types.NUMBER,
          default: defaults.memory.monitoring.interval,
          description: 'Monitoring interval in ms',
          min: 10000,
          max: 600000
        })
      }
    }),
    thresholds: field({
      type: Types.OBJECT,
      properties: {
        warning: field({
          type: Types.NUMBER,
          default: defaults.memory.thresholds.warning,
          description: 'Warning threshold percentage',
          min: 50,
          max: 90
        }),
        critical: field({
          type: Types.NUMBER,
          default: defaults.memory.thresholds.critical,
          description: 'Critical threshold percentage',
          min: 60,
          max: 95
        }),
        emergency: field({
          type: Types.NUMBER,
          default: defaults.memory.thresholds.emergency,
          description: 'Emergency threshold percentage',
          min: 70,
          max: 99
        })
      }
    }),
    cleanup: field({
      type: Types.OBJECT,
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.memory.cleanup.enabled,
          description: 'Enable automatic cleanup'
        }),
        onWarning: field({
          type: Types.BOOLEAN,
          default: defaults.memory.cleanup.onWarning,
          description: 'Cleanup on warning threshold'
        }),
        onCritical: field({
          type: Types.BOOLEAN,
          default: defaults.memory.cleanup.onCritical,
          description: 'Cleanup on critical threshold'
        }),
        onEmergency: field({
          type: Types.BOOLEAN,
          default: defaults.memory.cleanup.onEmergency,
          description: 'Cleanup on emergency threshold'
        })
      }
    }),
    cache: field({
      type: Types.OBJECT,
      properties: {
        maxSize: field({
          type: [Types.NUMBER, Types.NULL],
          default: defaults.memory.cache.maxSize,
          description: 'Maximum cache size in bytes'
        }),
        clearOnMemoryPressure: field({
          type: Types.BOOLEAN,
          default: defaults.memory.cache.clearOnMemoryPressure,
          description: 'Clear cache on memory pressure'
        })
      }
    })
  }
});
