/**
 * Dashboard Export Module - PDF, PNG, and Email Export
 *
 * Provides:
 * - PDF export of dashboard snapshots
 * - PNG screenshot export
 * - Email dashboard reports
 * - Scheduled report generation
 * - Custom report templates
 *
 * @module src/dashboards/dashboard-export
 */

const EventEmitter = require('events');

/**
 * Dashboard Export Manager
 */
class DashboardExportManager extends EventEmitter {
  constructor(dashboardService, options = {}) {
    super();

    this.dashboardService = dashboardService;
    this.options = {
      pdfEnabled: options.pdfEnabled !== false,
      pngEnabled: options.pngEnabled !== false,
      emailEnabled: options.emailEnabled !== false,
      ...options
    };

    this.exportQueue = [];
    this.schedules = new Map();
  }

  /**
   * Export dashboard as PDF
   */
  async exportDashboardPDF(dashboardId, options = {}) {
    const {
      filename = `dashboard-${dashboardId}-${Date.now()}.pdf`,
      format = 'A4',
      orientation = 'landscape',
      includeMetadata = true
    } = options;

    try {
      const dashboard = this.dashboardService.getDashboard(dashboardId);
      if (!dashboard) {
        throw new Error(`Dashboard ${dashboardId} not found`);
      }

      const metrics = this.dashboardService.getDashboardMetrics(dashboardId);
      if (!metrics) {
        throw new Error(`No computed metrics for dashboard ${dashboardId}`);
      }

      const pdfContent = this.generatePDFContent(dashboard, metrics, includeMetadata);

      this.emit('export:pdf', {
        dashboardId,
        filename,
        format,
        timestamp: Date.now()
      });

      return {
        filename,
        content: pdfContent,
        size: pdfContent.length,
        format: 'pdf'
      };
    } catch (error) {
      this.emit('export:error', { dashboardId, error, format: 'pdf' });
      throw error;
    }
  }

  /**
   * Export dashboard as PNG
   */
  async exportDashboardPNG(dashboardId, options = {}) {
    const {
      filename = `dashboard-${dashboardId}-${Date.now()}.png`,
      width = 1280,
      height = 1024,
      quality = 0.95
    } = options;

    try {
      const dashboard = this.dashboardService.getDashboard(dashboardId);
      if (!dashboard) {
        throw new Error(`Dashboard ${dashboardId} not found`);
      }

      const metrics = this.dashboardService.getDashboardMetrics(dashboardId);
      if (!metrics) {
        throw new Error(`No computed metrics for dashboard ${dashboardId}`);
      }

      const pngContent = this.generatePNGContent(dashboard, metrics, width, height, quality);

      this.emit('export:png', {
        dashboardId,
        filename,
        width,
        height,
        timestamp: Date.now()
      });

      return {
        filename,
        content: pngContent,
        size: pngContent.length,
        format: 'png',
        dimensions: { width, height }
      };
    } catch (error) {
      this.emit('export:error', { dashboardId, error, format: 'png' });
      throw error;
    }
  }

  /**
   * Email dashboard snapshot
   */
  async emailDashboardSnapshot(dashboardId, recipients, options = {}) {
    const {
      subject = `Dashboard Report: ${dashboardId}`,
      includeChart = true,
      format = 'html',
      attachPDF = false
    } = options;

    try {
      const dashboard = this.dashboardService.getDashboard(dashboardId);
      if (!dashboard) {
        throw new Error(`Dashboard ${dashboardId} not found`);
      }

      const metrics = this.dashboardService.getDashboardMetrics(dashboardId);
      if (!metrics) {
        throw new Error(`No computed metrics for dashboard ${dashboardId}`);
      }

      const emailContent = this.generateEmailContent(
        dashboard,
        metrics,
        format,
        includeChart
      );

      const attachments = [];
      if (attachPDF) {
        const pdfContent = this.generatePDFContent(dashboard, metrics, true);
        attachments.push({
          filename: `dashboard-${dashboardId}.pdf`,
          content: pdfContent,
          contentType: 'application/pdf'
        });
      }

      this.emit('export:email', {
        dashboardId,
        recipients: recipients.length,
        format,
        timestamp: Date.now()
      });

      return {
        subject,
        recipients,
        content: emailContent,
        format,
        attachments
      };
    } catch (error) {
      this.emit('export:error', { dashboardId, error, format: 'email' });
      throw error;
    }
  }

  /**
   * Schedule dashboard report
   */
  scheduleReport(dashboardId, schedule, options = {}) {
    const {
      frequency = 'daily', // daily, weekly, monthly
      time = '09:00',
      recipients = [],
      format = 'html',
      enabled = true
    } = options;

    const report = {
      dashboardId,
      frequency,
      time,
      recipients,
      format,
      enabled,
      createdAt: Date.now(),
      nextRun: this.calculateNextRun(frequency, time),
      runCount: 0,
      lastRun: null
    };

    const scheduleId = `report-${dashboardId}-${Date.now()}`;
    this.schedules.set(scheduleId, report);

    this.emit('report:scheduled', { scheduleId, report });

    return { scheduleId, report };
  }

  /**
   * Calculate next run time
   */
  calculateNextRun(frequency, time) {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const next = new Date();

    next.setHours(hours, minutes, 0, 0);

    if (frequency === 'daily') {
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    } else if (frequency === 'weekly') {
      // Schedule for next Monday
      const day = next.getDay();
      const daysUntilMonday = (1 - day + 7) % 7 || 7;
      next.setDate(next.getDate() + daysUntilMonday);
    } else if (frequency === 'monthly') {
      // Schedule for first of next month
      next.setMonth(next.getMonth() + 1, 1);
    }

    return next.getTime();
  }

  /**
   * Generate PDF content
   */
  generatePDFContent(dashboard, metrics, includeMetadata) {
    // Simplified PDF generation - in production, use a library like PDFKit
    const pdfHeader = '%PDF-1.4\n';
    const pdfMetadata = includeMetadata
      ? `%% Dashboard: ${dashboard.title}\n%% Generated: ${new Date().toISOString()}\n`
      : '';

    const pdfContent = `
      ${pdfHeader}
      ${pdfMetadata}
      1 0 obj
      <</Type /Catalog /Pages 2 0 R>>
      endobj

      2 0 obj
      <</Type /Pages /Kids [3 0 R] /Count 1>>
      endobj

      3 0 obj
      <</Type /Page /Parent 2 0 R /Resources <<
        /Font <</F1 4 0 R>>
      >> /MediaBox [0 0 612 792] /Contents 5 0 R>>
      endobj

      4 0 obj
      <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>
      endobj

      5 0 obj
      <</Length 200>>
      stream
      BT
      /F1 12 Tf
      50 750 Td
      (${dashboard.title}) Tj
      0 -20 Td
      (Generated: ${new Date().toISOString()}) Tj
      0 -40 Td
      (Health Score: ${metrics.metrics?.health_score || 'N/A'}) Tj
      ET
      endstream
      endobj

      xref
      0 6
      0000000000 65535 f
      0000000009 00000 n
      0000000058 00000 n
      0000000115 00000 n
      0000000229 00000 n
      0000000310 00000 n
      trailer
      <</Size 6 /Root 1 0 R>>
      startxref
      560
      %%EOF
    `;

    return Buffer.from(pdfContent);
  }

  /**
   * Generate PNG content (placeholder)
   */
  generatePNGContent(dashboard, metrics, width, height, quality) {
    // In production, use canvas library or Puppeteer to generate PNG
    // This is a simplified placeholder that returns a minimal PNG header
    const pngSignature = Buffer.from([
      137, 80, 78, 71, 13, 10, 26, 10 // PNG magic number
    ]);

    // Create a simple metadata chunk
    const metadata = JSON.stringify({
      dashboard: dashboard.title,
      timestamp: Date.now(),
      width,
      height,
      quality
    });

    return Buffer.concat([pngSignature]);
  }

  /**
   * Generate email HTML content
   */
  generateEmailContent(dashboard, metrics, format, includeChart) {
    if (format === 'text') {
      return this.generateTextEmailContent(dashboard, metrics);
    }

    return this.generateHTMLEmailContent(dashboard, metrics, includeChart);
  }

  /**
   * Generate HTML email content
   */
  generateHTMLEmailContent(dashboard, metrics, includeChart) {
    const style = `
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .header { background: #3b82f6; color: white; padding: 20px; border-radius: 4px; }
        .header h1 { margin: 0; }
        .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 4px; }
        .metric-label { font-size: 12px; color: #666; }
        .metric-value { font-size: 24px; font-weight: bold; color: #333; }
        .footer { margin-top: 20px; color: #999; font-size: 12px; }
      </style>
    `;

    const metricsHtml = Object.entries(metrics.metrics || {})
      .slice(0, 8)
      .map(([key, value]) => `
        <div class="metric">
          <div class="metric-label">${key}</div>
          <div class="metric-value">${value}</div>
        </div>
      `)
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        ${style}
      </head>
      <body>
        <div class="header">
          <h1>${dashboard.title}</h1>
          <p>${dashboard.description || ''}</p>
        </div>

        <div class="metrics">
          ${metricsHtml}
        </div>

        <div class="footer">
          <p>Generated on ${new Date().toLocaleString()}</p>
          <p>This is an automated dashboard report.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate plain text email content
   */
  generateTextEmailContent(dashboard, metrics) {
    let content = `${dashboard.title}\n`;
    content += `${'='.repeat(dashboard.title.length)}\n\n`;
    content += `${dashboard.description || ''}\n\n`;

    content += 'Metrics:\n';
    content += '-'.repeat(40) + '\n';

    for (const [key, value] of Object.entries(metrics.metrics || {})) {
      content += `${key}: ${value}\n`;
    }

    content += '\n' + '-'.repeat(40) + '\n';
    content += `Generated: ${new Date().toLocaleString()}\n`;

    return content;
  }

  /**
   * Get scheduled reports
   */
  getScheduledReports(dashboardId) {
    const reports = [];

    for (const [scheduleId, report] of this.schedules) {
      if (!dashboardId || report.dashboardId === dashboardId) {
        reports.push({
          scheduleId,
          ...report
        });
      }
    }

    return reports;
  }

  /**
   * Cancel scheduled report
   */
  cancelScheduledReport(scheduleId) {
    const report = this.schedules.get(scheduleId);
    if (!report) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    this.schedules.delete(scheduleId);
    this.emit('report:cancelled', { scheduleId });

    return { scheduleId };
  }

  /**
   * Get export history
   */
  getExportHistory(dashboardId, limit = 50) {
    // In production, query a database
    return this.exportQueue
      .filter(item => !dashboardId || item.dashboardId === dashboardId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get export statistics
   */
  getExportStats() {
    const stats = {
      totalExports: this.exportQueue.length,
      byFormat: {},
      byDashboard: {},
      scheduledReports: this.schedules.size
    };

    for (const item of this.exportQueue) {
      stats.byFormat[item.format] = (stats.byFormat[item.format] || 0) + 1;
      stats.byDashboard[item.dashboardId] = (stats.byDashboard[item.dashboardId] || 0) + 1;
    }

    return stats;
  }

  /**
   * Close manager
   */
  close() {
    this.schedules.clear();
    this.exportQueue = [];
    this.removeAllListeners();
  }
}

module.exports = DashboardExportManager;
