/**
 * Basset Hound Browser - Page Monitoring Constants
 *
 * Shared enums for the page-monitor subsystem:
 * - Change detection methods
 * - Change types
 * - Monitoring status
 */

/**
 * Change detection methods
 */
const DETECTION_METHODS = {
  DOM_DIFF: 'dom_diff', // Compare DOM structure and content
  SCREENSHOT_DIFF: 'screenshot_diff', // Visual comparison
  CONTENT_HASH: 'content_hash', // Hash-based change detection
  TEXT_DIFF: 'text_diff', // Text content comparison
  ATTRIBUTE_DIFF: 'attribute_diff', // Track attribute changes
  STRUCTURE_DIFF: 'structure_diff', // Track structural changes
  HYBRID: 'hybrid' // Combine multiple methods
};

/**
 * Change types
 */
const CHANGE_TYPES = {
  CONTENT: 'content',
  STRUCTURE: 'structure',
  STYLE: 'style',
  ATTRIBUTE: 'attribute',
  ADDED: 'added',
  REMOVED: 'removed',
  MODIFIED: 'modified',
  VISUAL: 'visual'
};

/**
 * Monitoring status
 */
const MONITOR_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  STOPPED: 'stopped',
  ERROR: 'error'
};

module.exports = {
  DETECTION_METHODS,
  CHANGE_TYPES,
  MONITOR_STATUS
};
