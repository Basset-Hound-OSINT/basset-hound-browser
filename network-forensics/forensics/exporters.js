/**
 * Network Forensics — report exporters
 *
 * Pure functions of (report, options) extracted from
 * network-forensics/forensics.js (Phase 19). Behaviour is byte-identical
 * to the original private methods; only method syntax and the intra-module
 * summarize call were adapted for standalone functions.
 */

const { FORENSICS_TYPES } = require('./constants');

  /**
   * Export as JSON
   * @private
   */
function exportJson(report, options) {
    return {
      format: 'json',
      data: JSON.stringify(report, null, options.pretty !== false ? 2 : 0),
      mimeType: 'application/json',
      filename: `network-forensics-${report.metadata.sessionId}.json`
    };
  }

  /**
   * Export as CSV
   * @private
   */
function exportCsv(report, options) {
    const sections = [];

    // DNS queries
    if (report.data.dnsQueries.length > 0) {
      sections.push('DNS Queries');
      sections.push('Timestamp,Hostname,Type,Response Time,Status,Cached');
      report.data.dnsQueries.forEach(q => {
        sections.push(`${new Date(q.timestamp).toISOString()},${q.hostname},${q.type},${q.responseTime},${q.status},${q.cached}`);
      });
      sections.push('');
    }

    // TLS certificates
    if (report.data.tlsCertificates.length > 0) {
      sections.push('TLS Certificates');
      sections.push('Timestamp,Hostname,Protocol,Valid,Issuer,Valid From,Valid To');
      report.data.tlsCertificates.forEach(c => {
        sections.push(`${new Date(c.timestamp).toISOString()},${c.hostname},${c.protocol},${c.valid},${c.issuer},${c.validFrom},${c.validTo}`);
      });
      sections.push('');
    }

    // WebSocket connections
    if (report.data.websocketConnections.length > 0) {
      sections.push('WebSocket Connections');
      sections.push('ID,URL,State,Messages,Bytes Sent,Bytes Received,Duration');
      report.data.websocketConnections.forEach(ws => {
        sections.push(`${ws.id},${ws.url},${ws.state},${ws.messageCount},${ws.bytesSent},${ws.bytesReceived},${ws.duration}`);
      });
      sections.push('');
    }

    const csv = sections.join('\n');

    return {
      format: 'csv',
      data: csv,
      mimeType: 'text/csv',
      filename: `network-forensics-${report.metadata.sessionId}.csv`
    };
  }

  /**
   * Export as HTML
   * @private
   */
function exportHtml(report, options) {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Network Forensics Report - ${report.metadata.sessionId}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    h2 { color: #666; margin-top: 30px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    .metadata { background-color: #e7f3ff; padding: 10px; margin: 20px 0; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .stat-box { background-color: #f0f0f0; padding: 15px; border-radius: 5px; }
    .hash { font-family: monospace; word-break: break-all; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Network Forensics Report</h1>

  <div class="metadata">
    <strong>Session ID:</strong> ${report.metadata.sessionId}<br>
    <strong>Collection Started:</strong> ${report.metadata.collectionStarted}<br>
    <strong>Collection Ended:</strong> ${report.metadata.collectionEnded || 'N/A'}<br>
    <strong>Collected By:</strong> ${report.metadata.collectedBy}<br>
    <strong>Generated At:</strong> ${report.metadata.generatedAt}<br>
    <strong>Report Hash:</strong> <span class="hash">${report.metadata.hash}</span>
  </div>

  <h2>Statistics</h2>
  <div class="stats">
    <div class="stat-box">
      <h3>DNS Queries</h3>
      <p>${report.statistics.dnsQueriesCount}</p>
    </div>
    <div class="stat-box">
      <h3>TLS Certificates</h3>
      <p>${report.statistics.certificatesCount}</p>
    </div>
    <div class="stat-box">
      <h3>WebSocket Connections</h3>
      <p>${report.statistics.websocketConnectionsCount}</p>
    </div>
    <div class="stat-box">
      <h3>HTTP Headers</h3>
      <p>${report.statistics.httpHeadersCount}</p>
    </div>
    <div class="stat-box">
      <h3>Cookies</h3>
      <p>${report.statistics.cookiesCount}</p>
    </div>
    <div class="stat-box">
      <h3>Performance Metrics</h3>
      <p>${report.statistics.performanceMetricsCount}</p>
    </div>
  </div>

  <h2>Chain of Custody</h2>
  <table>
    <tr>
      <th>Timestamp</th>
      <th>Action</th>
      <th>Details</th>
    </tr>
    ${report.chainOfCustody.modifications.map(m => `
    <tr>
      <td>${new Date(m.timestamp).toISOString()}</td>
      <td>${m.action}</td>
      <td>${JSON.stringify(m.details)}</td>
    </tr>
    `).join('')}
  </table>

  ${report.analysis.dns ? `
  <h2>DNS Analysis</h2>
  <p><strong>Total Queries:</strong> ${report.analysis.dns.totalQueries}</p>
  <p><strong>Unique Hostnames:</strong> ${report.analysis.dns.uniqueHostnames}</p>
  <p><strong>Cache Hit Rate:</strong> ${(report.analysis.dns.cacheHitRate * 100).toFixed(2)}%</p>
  <p><strong>Average Response Time:</strong> ${report.analysis.dns.averageResponseTime.toFixed(2)}ms</p>
  ` : ''}

  ${report.analysis.certificates ? `
  <h2>Certificate Analysis</h2>
  <p><strong>Total Certificates:</strong> ${report.analysis.certificates.totalCertificates}</p>
  <p><strong>Valid Certificates:</strong> ${report.analysis.certificates.validCertificates}</p>
  <p><strong>Invalid Certificates:</strong> ${report.analysis.certificates.invalidCertificates}</p>
  <p><strong>OCSP Stapling Rate:</strong> ${(report.analysis.certificates.ocspStaplingRate * 100).toFixed(2)}%</p>
  ` : ''}

  ${report.analysis.websockets ? `
  <h2>WebSocket Analysis</h2>
  <p><strong>Total Connections:</strong> ${report.analysis.websockets.totalConnections}</p>
  <p><strong>Active Connections:</strong> ${report.analysis.websockets.activeConnections}</p>
  <p><strong>Total Messages:</strong> ${report.analysis.websockets.totalMessages}</p>
  <p><strong>Total Bytes Sent:</strong> ${report.analysis.websockets.totalBytesSent}</p>
  <p><strong>Total Bytes Received:</strong> ${report.analysis.websockets.totalBytesReceived}</p>
  ` : ''}

</body>
</html>`;

    return {
      format: 'html',
      data: html,
      mimeType: 'text/html',
      filename: `network-forensics-${report.metadata.sessionId}.html`
    };
  }

  /**
   * Export as timeline
   * @private
   */
function exportTimeline(report, options) {
    const timelineData = report.timeline.map(event => ({
      timestamp: event.timestamp,
      datetime: new Date(event.timestamp).toISOString(),
      type: event.type,
      summary: summarizeTimelineEvent(event),
      hash: event.hash
    }));

    return {
      format: 'json',
      data: JSON.stringify(timelineData, null, 2),
      mimeType: 'application/json',
      filename: `network-forensics-timeline-${report.metadata.sessionId}.json`
    };
  }

  /**
   * Summarize timeline event
   * @private
   */
function summarizeTimelineEvent(event) {
    switch (event.type) {
    case FORENSICS_TYPES.DNS_QUERY:
      return `DNS query for ${event.data.hostname} (${event.data.type})`;

    case FORENSICS_TYPES.TLS_CERTIFICATE:
      return `TLS certificate for ${event.data.hostname}`;

    case FORENSICS_TYPES.WEBSOCKET_CONNECTION:
      return `WebSocket connection to ${event.data.url}`;

    case FORENSICS_TYPES.HTTP_HEADERS:
      return `HTTP ${event.data.method} ${event.data.url}`;

    case FORENSICS_TYPES.COOKIE:
      return `Cookie ${event.data.name} from ${event.data.domain}`;

    case FORENSICS_TYPES.PERFORMANCE_METRIC:
      return `Performance metric: ${event.data.name} = ${event.data.value}${event.data.unit}`;

    default:
      return 'Unknown event';
    }
  }

module.exports = {
  exportJson,
  exportCsv,
  exportHtml,
  exportTimeline,
  summarizeTimelineEvent
};
