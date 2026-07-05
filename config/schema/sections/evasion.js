/**
 * Basset Hound Browser - Configuration Schema Section
 * Extracted verbatim from config/schema.js (see docs/planning/MODULARIZATION-PLAN-2026-07-04.md §3.5).
 * NOTE: This module's field({...}) body is moved, not rewritten — byte-identical to the original.
 */

const { field, Types } = require('../field');
const { defaults } = require('../../defaults');

module.exports = field({
  type: Types.OBJECT,
  description: 'Bot detection evasion configuration',
  properties: {
    fingerprint: field({
      type: Types.OBJECT,
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.evasion.fingerprint.enabled,
          description: 'Enable fingerprint spoofing'
        }),
        randomize: field({
          type: Types.BOOLEAN,
          default: defaults.evasion.fingerprint.randomize,
          description: 'Randomize fingerprint on each session'
        }),
        persistPerSession: field({
          type: Types.BOOLEAN,
          default: defaults.evasion.fingerprint.persistPerSession,
          description: 'Persist fingerprint within a session'
        })
      }
    }),
    userAgent: field({
      type: Types.OBJECT,
      properties: {
        randomize: field({
          type: Types.BOOLEAN,
          default: defaults.evasion.userAgent.randomize,
          description: 'Randomize user agent'
        }),
        rotateOnNavigation: field({
          type: Types.BOOLEAN,
          default: defaults.evasion.userAgent.rotateOnNavigation,
          description: 'Rotate user agent on each navigation'
        }),
        category: field({
          type: Types.STRING,
          default: defaults.evasion.userAgent.category,
          description: 'User agent category',
          enum: ['desktop', 'mobile', 'bot', 'random']
        })
      }
    }),
    webgl: field({
      type: Types.OBJECT,
      properties: {
        spoof: field({
          type: Types.BOOLEAN,
          default: defaults.evasion.webgl.spoof,
          description: 'Spoof WebGL vendor and renderer'
        }),
        noise: field({
          type: Types.BOOLEAN,
          default: defaults.evasion.webgl.noise,
          description: 'Add noise to WebGL output'
        })
      }
    }),
    canvas: field({
      type: Types.OBJECT,
      properties: {
        noise: field({
          type: Types.BOOLEAN,
          default: defaults.evasion.canvas.noise,
          description: 'Add noise to canvas output'
        }),
        noiseFactor: field({
          type: Types.NUMBER,
          default: defaults.evasion.canvas.noiseFactor,
          description: 'Canvas noise factor',
          min: 0,
          max: 10
        })
      }
    }),
    audio: field({
      type: Types.OBJECT,
      properties: {
        noise: field({
          type: Types.BOOLEAN,
          default: defaults.evasion.audio.noise,
          description: 'Add noise to audio context'
        }),
        noiseFactor: field({
          type: Types.NUMBER,
          default: defaults.evasion.audio.noiseFactor,
          description: 'Audio noise factor',
          min: 0,
          max: 0.001
        })
      }
    }),
    hardware: field({
      type: Types.OBJECT,
      properties: {
        spoof: field({
          type: Types.BOOLEAN,
          default: defaults.evasion.hardware.spoof,
          description: 'Spoof hardware info'
        }),
        concurrency: field({
          type: [Types.NUMBER, Types.NULL],
          default: defaults.evasion.hardware.concurrency,
          description: 'CPU concurrency value',
          min: 1,
          max: 64
        }),
        memory: field({
          type: [Types.NUMBER, Types.NULL],
          default: defaults.evasion.hardware.memory,
          description: 'Device memory in GB',
          min: 1,
          max: 128
        })
      }
    }),
    timezone: field({
      type: Types.OBJECT,
      properties: {
        spoof: field({
          type: Types.BOOLEAN,
          default: defaults.evasion.timezone.spoof,
          description: 'Spoof timezone'
        }),
        value: field({
          type: [Types.STRING, Types.NULL],
          default: defaults.evasion.timezone.value,
          description: 'Timezone value (e.g., "America/New_York")'
        })
      }
    }),
    geolocation: field({
      type: Types.OBJECT,
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.evasion.geolocation.enabled,
          description: 'Enable geolocation spoofing'
        }),
        latitude: field({
          type: [Types.NUMBER, Types.NULL],
          default: defaults.evasion.geolocation.latitude,
          description: 'Latitude coordinate',
          min: -90,
          max: 90
        }),
        longitude: field({
          type: [Types.NUMBER, Types.NULL],
          default: defaults.evasion.geolocation.longitude,
          description: 'Longitude coordinate',
          min: -180,
          max: 180
        }),
        accuracy: field({
          type: Types.NUMBER,
          default: defaults.evasion.geolocation.accuracy,
          description: 'Location accuracy in meters',
          min: 1,
          max: 10000
        })
      }
    }),
    humanize: field({
      type: Types.OBJECT,
      description: 'Human behavior simulation',
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.evasion.humanize.enabled,
          description: 'Enable human behavior simulation'
        }),
        typing: field({
          type: Types.OBJECT,
          properties: {
            enabled: field({
              type: Types.BOOLEAN,
              default: defaults.evasion.humanize.typing.enabled,
              description: 'Enable human-like typing'
            }),
            minDelay: field({
              type: Types.NUMBER,
              default: defaults.evasion.humanize.typing.minDelay,
              description: 'Minimum typing delay in ms',
              min: 10,
              max: 500
            }),
            maxDelay: field({
              type: Types.NUMBER,
              default: defaults.evasion.humanize.typing.maxDelay,
              description: 'Maximum typing delay in ms',
              min: 50,
              max: 1000
            }),
            mistakeRate: field({
              type: Types.NUMBER,
              default: defaults.evasion.humanize.typing.mistakeRate,
              description: 'Typing mistake rate',
              min: 0,
              max: 0.5
            })
          }
        }),
        mouse: field({
          type: Types.OBJECT,
          properties: {
            enabled: field({
              type: Types.BOOLEAN,
              default: defaults.evasion.humanize.mouse.enabled,
              description: 'Enable human-like mouse movement'
            }),
            curvature: field({
              type: Types.NUMBER,
              default: defaults.evasion.humanize.mouse.curvature,
              description: 'Mouse movement curvature',
              min: 0,
              max: 1
            }),
            speed: field({
              type: Types.NUMBER,
              default: defaults.evasion.humanize.mouse.speed,
              description: 'Mouse movement speed multiplier',
              min: 0.1,
              max: 5
            })
          }
        }),
        scroll: field({
          type: Types.OBJECT,
          properties: {
            enabled: field({
              type: Types.BOOLEAN,
              default: defaults.evasion.humanize.scroll.enabled,
              description: 'Enable human-like scrolling'
            }),
            smoothness: field({
              type: Types.NUMBER,
              default: defaults.evasion.humanize.scroll.smoothness,
              description: 'Scroll smoothness',
              min: 0,
              max: 1
            })
          }
        })
      }
    })
  }
});
