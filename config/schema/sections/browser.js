/**
 * Basset Hound Browser - Configuration Schema Section
 * Extracted verbatim from config/schema.js (see docs/planning/MODULARIZATION-PLAN-2026-07-04.md §3.5).
 * NOTE: This module's field({...}) body is moved, not rewritten — byte-identical to the original.
 */

const { field, Types } = require('../field');
const { defaults } = require('../../defaults');

module.exports = field({
  type: Types.OBJECT,
  description: 'Browser window and behavior configuration',
  properties: {
    window: field({
      type: Types.OBJECT,
      description: 'Window configuration',
      properties: {
        width: field({
          type: Types.NUMBER,
          default: defaults.browser.window.width,
          description: 'Window width in pixels',
          min: 400,
          max: 4096
        }),
        height: field({
          type: Types.NUMBER,
          default: defaults.browser.window.height,
          description: 'Window height in pixels',
          min: 300,
          max: 2160
        }),
        minWidth: field({
          type: Types.NUMBER,
          default: defaults.browser.window.minWidth,
          description: 'Minimum window width',
          min: 200
        }),
        minHeight: field({
          type: Types.NUMBER,
          default: defaults.browser.window.minHeight,
          description: 'Minimum window height',
          min: 200
        }),
        randomizeSize: field({
          type: Types.BOOLEAN,
          default: defaults.browser.window.randomizeSize,
          description: 'Randomize window size for fingerprint evasion'
        }),
        randomizePosition: field({
          type: Types.BOOLEAN,
          default: defaults.browser.window.randomizePosition,
          description: 'Randomize window position'
        })
      }
    }),
    tabs: field({
      type: Types.OBJECT,
      description: 'Tab configuration',
      properties: {
        maxTabs: field({
          type: Types.NUMBER,
          default: defaults.browser.tabs.maxTabs,
          description: 'Maximum number of open tabs',
          min: 1,
          max: 500
        }),
        homePage: field({
          type: Types.STRING,
          default: defaults.browser.tabs.homePage,
          description: 'Home page URL'
        }),
        defaultTab: field({
          type: Types.BOOLEAN,
          default: defaults.browser.tabs.defaultTab,
          description: 'Create a default tab on startup'
        })
      }
    }),
    recovery: field({
      type: Types.OBJECT,
      description: 'Session recovery configuration',
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.browser.recovery.enabled,
          description: 'Enable session recovery'
        }),
        autoSaveInterval: field({
          type: Types.NUMBER,
          default: defaults.browser.recovery.autoSaveInterval,
          description: 'Auto-save interval in milliseconds',
          min: 5000,
          max: 300000
        }),
        maxRecoveryAttempts: field({
          type: Types.NUMBER,
          default: defaults.browser.recovery.maxRecoveryAttempts,
          description: 'Maximum recovery attempts',
          min: 1,
          max: 10
        }),
        stateVersion: field({
          type: Types.NUMBER,
          default: defaults.browser.recovery.stateVersion,
          description: 'Recovery state version'
        })
      }
    }),
    devTools: field({
      type: Types.OBJECT,
      description: 'DevTools configuration',
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.browser.devTools.enabled,
          description: 'Enable DevTools'
        }),
        defaultMode: field({
          type: Types.STRING,
          default: defaults.browser.devTools.defaultMode,
          description: 'Default DevTools dock mode',
          enum: ['right', 'bottom', 'undocked', 'detach']
        })
      }
    }),
    downloads: field({
      type: Types.OBJECT,
      description: 'Download configuration',
      properties: {
        path: field({
          type: [Types.STRING, Types.NULL],
          default: defaults.browser.downloads.path,
          description: 'Download directory path'
        }),
        askBeforeDownload: field({
          type: Types.BOOLEAN,
          default: defaults.browser.downloads.askBeforeDownload,
          description: 'Ask before each download'
        }),
        maxConcurrent: field({
          type: Types.NUMBER,
          default: defaults.browser.downloads.maxConcurrent,
          description: 'Maximum concurrent downloads',
          min: 1,
          max: 20
        })
      }
    }),
    history: field({
      type: Types.OBJECT,
      description: 'History configuration',
      properties: {
        enabled: field({
          type: Types.BOOLEAN,
          default: defaults.browser.history.enabled,
          description: 'Enable history tracking'
        }),
        maxEntries: field({
          type: Types.NUMBER,
          default: defaults.browser.history.maxEntries,
          description: 'Maximum history entries',
          min: 100,
          max: 1000000
        }),
        retentionDays: field({
          type: Types.NUMBER,
          default: defaults.browser.history.retentionDays,
          description: 'History retention in days',
          min: 1,
          max: 365
        })
      }
    })
  }
});
