/**
 * Basset Hound Browser - Page Monitoring & Change Detection (barrel)
 *
 * This module was split into `monitoring/page-monitor/` for maintainability.
 * It remains the stable entry point; the public export surface is unchanged:
 *   { PageMonitor, DETECTION_METHODS, CHANGE_TYPES, MONITOR_STATUS }
 *
 * Implementation:
 *   - monitoring/page-monitor/constants.js        detection/change/status enums
 *   - monitoring/page-monitor/change-detectors.js snapshot comparison logic
 *   - monitoring/page-monitor/report-generators.js report export (json/csv/html/md)
 *   - monitoring/page-monitor/monitor.js          PageMonitor lifecycle class
 */

module.exports = require('./page-monitor/monitor');
