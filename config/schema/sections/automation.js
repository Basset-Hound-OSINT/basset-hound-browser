/**
 * Basset Hound Browser - Configuration Schema Section
 * Extracted verbatim from config/schema.js (see docs/planning/MODULARIZATION-PLAN-2026-07-04.md §3.5).
 * NOTE: This module's field({...}) body is moved, not rewritten — byte-identical to the original.
 */

const { field, Types } = require('../field');
const { defaults } = require('../../defaults');

module.exports = field({
  type: Types.OBJECT,
  description: 'Automation and scripting configuration',
  properties: {
    scripts: field({
      type: Types.OBJECT,
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.automation.scripts.enabled,
          description: 'Enable automation scripts'
        }),
        storagePath: field({
          type: [Types.STRING, Types.NULL],
          default: defaults.automation.scripts.storagePath,
          description: 'Scripts storage path'
        }),
        timeout: field({
          type: Types.NUMBER,
          default: defaults.automation.scripts.timeout,
          description: 'Script execution timeout in ms',
          min: 1000,
          max: 600000
        }),
        sandboxed: field({
          type: Types.BOOLEAN,
          default: defaults.automation.scripts.sandboxed,
          description: 'Run scripts in sandbox'
        })
      }
    }),
    recording: field({
      type: Types.OBJECT,
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.automation.recording.enabled,
          description: 'Enable screen recording'
        }),
        format: field({
          type: Types.STRING,
          default: defaults.automation.recording.format,
          description: 'Recording format',
          enum: ['webm', 'mp4', 'gif']
        }),
        quality: field({
          type: Types.STRING,
          default: defaults.automation.recording.quality,
          description: 'Recording quality',
          enum: ['low', 'medium', 'high', 'maximum']
        }),
        fps: field({
          type: Types.NUMBER,
          default: defaults.automation.recording.fps,
          description: 'Frames per second',
          min: 1,
          max: 60
        }),
        maxDuration: field({
          type: Types.NUMBER,
          default: defaults.automation.recording.maxDuration,
          description: 'Maximum recording duration in seconds',
          min: 1,
          max: 86400
        })
      }
    }),
    screenshots: field({
      type: Types.OBJECT,
      properties: {
        format: field({
          type: Types.STRING,
          default: defaults.automation.screenshots.format,
          description: 'Screenshot format',
          enum: ['png', 'jpeg', 'webp']
        }),
        quality: field({
          type: Types.NUMBER,
          default: defaults.automation.screenshots.quality,
          description: 'Screenshot quality (1-100)',
          min: 1,
          max: 100
        }),
        path: field({
          type: [Types.STRING, Types.NULL],
          default: defaults.automation.screenshots.path,
          description: 'Screenshots storage path'
        })
      }
    })
  }
});
