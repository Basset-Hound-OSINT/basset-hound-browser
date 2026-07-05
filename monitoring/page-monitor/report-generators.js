/**
 * Basset Hound Browser - Page Monitoring Report Generators
 *
 * Change-report export logic for the PageMonitor class (JSON/CSV/HTML/Markdown).
 *
 * These functions are mixed into `PageMonitor.prototype` (via Object.assign)
 * and are therefore invoked with `this` bound to the PageMonitor instance.
 * Their bodies are unchanged from the original monolithic implementation.
 */

const fs = require('fs');
const path = require('path');

/**
 * Export change report
 * @param {string} monitorId - Monitor ID
 * @param {Object} options - Export options
 * @returns {Object} Export result
 */
function exportChangeReport(monitorId, options = {}) {
  if (!this.monitors.has(monitorId)) {
    return {
      success: false,
      error: `Monitor not found: ${monitorId}`
    };
  }

  const {
    format = 'json',
    includeSnapshots = false,
    includeScreenshots = false,
    filePath = null
  } = options;

  const monitor = this.monitors.get(monitorId);
  const changes = this.changeHistory.get(monitorId) || [];
  const stats = this.statistics.get(monitorId);
  let snapshots = this.snapshots.get(monitorId) || [];

  // Remove screenshots if not requested
  if (!includeScreenshots) {
    snapshots = snapshots.map(s => {
      const { screenshot, ...rest } = s;
      return rest;
    });
  }

  const report = {
    monitor: {
      ...monitor,
      statistics: stats
    },
    changes: changes,
    snapshots: includeSnapshots ? snapshots : [],
    generatedAt: new Date().toISOString(),
    summary: {
      totalChanges: changes.length,
      totalChecks: monitor.checkCount,
      monitoringDuration: new Date() - new Date(monitor.createdAt),
      detectionRate: stats.detectionRate
    }
  };

  let exportData;
  let extension;

  switch (format) {
  case 'json':
    exportData = JSON.stringify(report, null, 2);
    extension = '.json';
    break;

  case 'csv':
    exportData = this.generateCSVReport(changes);
    extension = '.csv';
    break;

  case 'html':
    exportData = this.generateHTMLReport(report);
    extension = '.html';
    break;

  case 'markdown':
    exportData = this.generateMarkdownReport(report);
    extension = '.md';
    break;

  default:
    return {
      success: false,
      error: `Unsupported format: ${format}`
    };
  }

  // Save to file if path provided
  if (filePath) {
    try {
      const fullPath = filePath.endsWith(extension) ? filePath : filePath + extension;
      const dir = path.dirname(fullPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, exportData);

      return {
        success: true,
        monitorId,
        format,
        filePath: fullPath,
        size: exportData.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  return {
    success: true,
    monitorId,
    format,
    data: exportData
  };
}

/**
 * Generate CSV report
 */
function generateCSVReport(changes) {
  const headers = ['Timestamp', 'Type', 'Scope', 'Description', 'Significance'];
  const rows = changes.map(change => [
    change.timestamp,
    change.changes ? Object.keys(change.changes).join(', ') : '',
    'page',
    change.summary ? change.summary.description.join(', ') : '',
    change.significance || ''
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
}

/**
 * Generate HTML report
 */
function generateHTMLReport(report) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Page Monitor Report - ${report.monitor.url}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
    .change { border-left: 3px solid #007bff; padding: 10px; margin: 10px 0; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .stat { background: #e9ecef; padding: 10px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Page Monitor Report</h1>
  <div class="summary">
    <h2>Monitor: ${report.monitor.url}</h2>
    <p>Created: ${report.monitor.createdAt}</p>
    <p>Status: ${report.monitor.status}</p>
  </div>
  <div class="stats">
    <div class="stat">Total Checks: ${report.summary.totalChecks}</div>
    <div class="stat">Total Changes: ${report.summary.totalChanges}</div>
    <div class="stat">Detection Rate: ${(report.summary.detectionRate * 100).toFixed(2)}%</div>
  </div>
  <h2>Changes</h2>
  ${report.changes.map(change => `
    <div class="change">
      <strong>${change.timestamp}</strong><br>
      ${change.summary ? change.summary.description.join(', ') : 'No description'}
      <br>Significance: ${((change.significance || 0) * 100).toFixed(1)}%
    </div>
  `).join('')}
  <p><em>Generated at: ${report.generatedAt}</em></p>
</body>
</html>`;
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(report) {
  const lines = [
    `# Page Monitor Report`,
    ``,
    `**URL:** ${report.monitor.url}`,
    `**Status:** ${report.monitor.status}`,
    `**Created:** ${report.monitor.createdAt}`,
    ``,
    `## Statistics`,
    ``,
    `- Total Checks: ${report.summary.totalChecks}`,
    `- Total Changes: ${report.summary.totalChanges}`,
    `- Detection Rate: ${(report.summary.detectionRate * 100).toFixed(2)}%`,
    ``,
    `## Changes`,
    ``
  ];

  report.changes.forEach(change => {
    lines.push(`### ${change.timestamp}`);
    lines.push(``);
    if (change.summary) {
      lines.push(`${change.summary.description.join(', ')}`);
    }
    lines.push(`**Significance:** ${((change.significance || 0) * 100).toFixed(1)}%`);
    lines.push(``);
  });

  lines.push(`---`);
  lines.push(`*Generated at: ${report.generatedAt}*`);

  return lines.join('\n');
}

module.exports = {
  exportChangeReport,
  generateCSVReport,
  generateHTMLReport,
  generateMarkdownReport
};
