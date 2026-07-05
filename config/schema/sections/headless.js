/**
 * Basset Hound Browser - Configuration Schema Section
 * Extracted verbatim from config/schema.js (see docs/planning/MODULARIZATION-PLAN-2026-07-04.md §3.5).
 * NOTE: This module's field({...}) body is moved, not rewritten — byte-identical to the original.
 */

const { field, Types } = require('../field');
const { defaults } = require('../../defaults');

module.exports = field({
  type: Types.OBJECT,
  description: 'Headless mode configuration',
  properties: {
    enabled: field({
      type: Types.BOOLEAN,
      default: defaults.headless.enabled,
      description: 'Enable headless mode'
    }),
    disableGpu: field({
      type: Types.BOOLEAN,
      default: defaults.headless.disableGpu,
      description: 'Disable GPU acceleration'
    }),
    noSandbox: field({
      type: Types.BOOLEAN,
      default: defaults.headless.noSandbox,
      description: 'Disable sandbox (required for Docker/root)'
    }),
    virtualDisplay: field({
      type: Types.BOOLEAN,
      default: defaults.headless.virtualDisplay,
      description: 'Use virtual display (Xvfb)'
    }),
    displaySize: field({
      type: Types.STRING,
      default: defaults.headless.displaySize,
      description: 'Virtual display size',
      pattern: /^\d+x\d+$/
    }),
    displayDepth: field({
      type: Types.NUMBER,
      default: defaults.headless.displayDepth,
      description: 'Virtual display color depth',
      enum: [8, 16, 24, 32]
    }),
    offscreenRendering: field({
      type: Types.BOOLEAN,
      default: defaults.headless.offscreenRendering,
      description: 'Enable offscreen rendering'
    }),
    preset: field({
      type: [Types.STRING, Types.NULL],
      default: defaults.headless.preset,
      description: 'Headless preset',
      enum: [null, 'server', 'docker', 'ci', 'minimal']
    })
  }
});
