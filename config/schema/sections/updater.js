/**
 * Basset Hound Browser - Configuration Schema Section
 * Extracted verbatim from config/schema.js (see docs/planning/MODULARIZATION-PLAN-2026-07-04.md §3.5).
 * NOTE: This module's field({...}) body is moved, not rewritten — byte-identical to the original.
 */

const { field, Types } = require('../field');
const { defaults } = require('../../defaults');

module.exports = field({
  type: Types.OBJECT,
  description: 'Auto-update configuration',
  properties: {
    enabled: field({
      type: Types.BOOLEAN,
      default: defaults.updater.enabled,
      description: 'Enable auto-update functionality'
    }),
    checkOnStartup: field({
      type: Types.BOOLEAN,
      default: defaults.updater.checkOnStartup,
      description: 'Check for updates on application startup'
    }),
    checkInterval: field({
      type: Types.NUMBER,
      default: defaults.updater.checkInterval,
      description: 'Interval between update checks in milliseconds',
      min: 60000, // Minimum 1 minute
      max: 86400000 // Maximum 24 hours
    }),
    autoDownload: field({
      type: Types.BOOLEAN,
      default: defaults.updater.autoDownload,
      description: 'Automatically download updates when available'
    }),
    autoInstallOnAppQuit: field({
      type: Types.BOOLEAN,
      default: defaults.updater.autoInstallOnAppQuit,
      description: 'Automatically install update when app quits'
    }),
    allowPrerelease: field({
      type: Types.BOOLEAN,
      default: defaults.updater.allowPrerelease,
      description: 'Include pre-release versions in updates'
    }),
    allowDowngrade: field({
      type: Types.BOOLEAN,
      default: defaults.updater.allowDowngrade,
      description: 'Allow downgrading to older versions'
    }),
    provider: field({
      type: Types.STRING,
      default: defaults.updater.provider,
      description: 'Update provider (github, s3, generic, etc.)',
      enum: ['github', 's3', 'spaces', 'generic', 'custom']
    }),
    owner: field({
      type: [Types.STRING, Types.NULL],
      default: defaults.updater.owner,
      description: 'GitHub owner/organization for GitHub provider'
    }),
    repo: field({
      type: [Types.STRING, Types.NULL],
      default: defaults.updater.repo,
      description: 'GitHub repository name for GitHub provider'
    }),
    updateServerUrl: field({
      type: [Types.STRING, Types.NULL],
      default: defaults.updater.updateServerUrl,
      description: 'Custom update server URL'
    }),
    notifyOnAvailable: field({
      type: Types.BOOLEAN,
      default: defaults.updater.notifyOnAvailable,
      description: 'Show notification when update is available'
    }),
    notifyOnDownloaded: field({
      type: Types.BOOLEAN,
      default: defaults.updater.notifyOnDownloaded,
      description: 'Show notification when update is downloaded'
    }),
    notifyOnError: field({
      type: Types.BOOLEAN,
      default: defaults.updater.notifyOnError,
      description: 'Show notification on update errors'
    }),
    differentialDownload: field({
      type: Types.BOOLEAN,
      default: defaults.updater.differentialDownload,
      description: 'Enable differential/delta downloads for faster updates'
    }),
    keepPreviousVersion: field({
      type: Types.BOOLEAN,
      default: defaults.updater.keepPreviousVersion,
      description: 'Keep previous version info for rollback'
    }),
    maxPreviousVersions: field({
      type: Types.NUMBER,
      default: defaults.updater.maxPreviousVersions,
      description: 'Maximum previous versions to keep for rollback',
      min: 1,
      max: 10
    })
  }
});
