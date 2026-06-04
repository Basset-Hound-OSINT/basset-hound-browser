/**
 * Report Generator
 * Generates reports from analytics data in multiple formats with visualizations
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class ReportGenerator extends EventEmitter {
  constructor(analyticsStore, options = {}) {
    super();
    this.analyticsStore = analyticsStore;
    this.templates = new Map();
    this.outputPath = options.outputPath || './reports';
    this.emailService = options.emailService || null;
    this.charts = new Map();

    // Ensure output directory exists
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }
  }

  /**
   * Generate a report
   */
  async generateReport(reportConfig) {
    const {
      name,
      title,
      seriesNames,
      startTime,
      endTime,
      formats = ['html', 'json'],
      includeCharts = true,
      aggregationLevel = 'daily',
    } = reportConfig;

    const reportData = {
      title,
      generatedAt: new Date(),
      period: { startTime, endTime },
      aggregationLevel,
      series: {},
    };

    // Collect data for each series
    for (const seriesName of seriesNames) {
      const seriesMetadata = this.analyticsStore.getSeriesMetadata(seriesName);
      if (!seriesMetadata) continue;

      const data = this.analyticsStore.query(seriesName, startTime, endTime);
      const stats = await this.analyticsStore.getStats(seriesName, startTime, endTime);

      reportData.series[seriesName] = {
        metadata: seriesMetadata,
        data,
        stats,
        aggregates: this._getAggregatesByLevel(seriesName, startTime, endTime, aggregationLevel),
      };
    }

    // Generate in requested formats
    const results = {};
    for (const format of formats) {
      try {
        const output = await this._generateFormat(reportData, format, includeCharts);
        const filename = `${name}_${new Date().getTime()}.${format}`;
        const filepath = path.join(this.outputPath, filename);

        if (format === 'html' || format === 'pdf') {
          fs.writeFileSync(filepath, output);
        } else {
          fs.writeFileSync(filepath, output, format === 'json' ? 'utf-8' : 'utf-8');
        }

        results[format] = filepath;
        this.emit('report_generated', { name, format, filepath });
      } catch (err) {
        this.emit('error', { type: 'generation_error', name, format, error: err.message });
      }
    }

    return results;
  }

  /**
   * Generate a dashboard report
   */
  async generateDashboard(dashboardConfig) {
    const {
      name,
      widgets = [],
      refreshInterval = 300000,
      outputFormat = 'html',
    } = dashboardConfig;

    const dashboard = {
      name,
      generatedAt: new Date(),
      refreshInterval,
      widgets: {},
    };

    for (const widget of widgets) {
      const { title, type, seriesName, startTime, endTime } = widget;
      const data = this.analyticsStore.query(seriesName, startTime, endTime);
      const stats = await this.analyticsStore.getStats(seriesName, startTime, endTime);

      dashboard.widgets[title] = {
        type,
        seriesName,
        data,
        stats,
        chart: includeCharts ? this._generateChartConfig(type, data) : null,
      };
    }

    const output = await this._generateFormat(dashboard, outputFormat, true);
    const filename = `dashboard_${name}_${new Date().getTime()}.${outputFormat}`;
    const filepath = path.join(this.outputPath, filename);

    fs.writeFileSync(filepath, output);
    this.emit('dashboard_generated', { name, filepath });

    return filepath;
  }

  /**
   * Register a report template
   */
  registerTemplate(templateName, templateConfig) {
    this.templates.set(templateName, templateConfig);
    this.emit('template_registered', { template: templateName });
  }

  /**
   * Generate from template
   */
  async generateFromTemplate(templateName, parameters = {}) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    const config = { ...template, ...parameters };
    return this.generateReport(config);
  }

  /**
   * Schedule report generation
   */
  scheduleReport(reportConfig, cronExpression) {
    // Note: In production, use a proper cron library
    const schedule = {
      reportConfig,
      cronExpression,
      createdAt: new Date(),
    };

    this.emit('report_scheduled', { cron: cronExpression });
    return schedule;
  }

  /**
   * Send report via email
   */
  async emailReport(filepath, recipients, options = {}) {
    if (!this.emailService) {
      throw new Error('Email service not configured');
    }

    const { subject = 'Report Generated', message = 'Please see attached report' } = options;

    try {
      await this.emailService.send({
        to: recipients,
        subject,
        message,
        attachments: [filepath],
      });

      this.emit('report_emailed', { filepath, recipients });
      return true;
    } catch (err) {
      this.emit('error', { type: 'email_error', filepath, error: err.message });
      throw err;
    }
  }

  /**
   * Register a chart type
   */
  registerChart(chartType, chartConfig) {
    this.charts.set(chartType, chartConfig);
    this.emit('chart_registered', { type: chartType });
  }

  /**
   * Get available reports in output directory
   */
  listReports() {
    const files = fs.readdirSync(this.outputPath);
    return files.map((file) => ({
      name: file,
      path: path.join(this.outputPath, file),
      size: fs.statSync(path.join(this.outputPath, file)).size,
      createdAt: fs.statSync(path.join(this.outputPath, file)).birthtime,
    }));
  }

  // ==================== Private Methods ====================

  async _generateFormat(reportData, format, includeCharts) {
    if (format === 'json') {
      return JSON.stringify(reportData, null, 2);
    } else if (format === 'csv') {
      return this._generateCSV(reportData);
    } else if (format === 'html') {
      return this._generateHTML(reportData, includeCharts);
    } else if (format === 'pdf') {
      // In production, use a PDF library like pdfkit or puppeteer
      return this._generateHTML(reportData, includeCharts);
    }

    throw new Error(`Unknown format: ${format}`);
  }

  _generateCSV(reportData) {
    const lines = [];
    lines.push(`Report: ${reportData.title}`);
    lines.push(`Generated: ${reportData.generatedAt}`);
    lines.push(`Period: ${reportData.period.startTime} to ${reportData.period.endTime}`);
    lines.push('');

    for (const [seriesName, seriesData] of Object.entries(reportData.series)) {
      lines.push(`Series: ${seriesName}`);
      lines.push('timestamp,value');

      for (const point of seriesData.data) {
        lines.push(`${point.timestamp},${point.value}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  _generateHTML(reportData, includeCharts) {
    const html = [];
    html.push('<!DOCTYPE html>');
    html.push('<html>');
    html.push('<head>');
    html.push('<meta charset="UTF-8">');
    html.push(`<title>${reportData.title}</title>`);
    html.push('<style>');
    html.push(`
      body { font-family: Arial, sans-serif; margin: 20px; }
      h1 { color: #333; }
      .series { margin: 20px 0; border: 1px solid #ddd; padding: 15px; }
      .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
      .stat-box { background: #f5f5f5; padding: 10px; border-radius: 4px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background: #f5f5f5; }
    `);
    html.push('</style>');
    html.push('</head>');
    html.push('<body>');

    html.push(`<h1>${reportData.title}</h1>`);
    html.push(`<p>Generated: ${reportData.generatedAt}</p>`);
    html.push(
      `<p>Period: ${new Date(reportData.period.startTime)} to ${new Date(reportData.period.endTime)}</p>`
    );

    for (const [seriesName, seriesData] of Object.entries(reportData.series)) {
      html.push('<div class="series">');
      html.push(`<h2>${seriesName}</h2>`);

      if (seriesData.stats) {
        html.push('<div class="stats">');
        html.push(`<div class="stat-box"><strong>Count:</strong> ${seriesData.stats.count}</div>`);
        html.push(`<div class="stat-box"><strong>Avg:</strong> ${seriesData.stats.avg.toFixed(2)}</div>`);
        html.push(`<div class="stat-box"><strong>Min:</strong> ${seriesData.stats.min}</div>`);
        html.push(`<div class="stat-box"><strong>Max:</strong> ${seriesData.stats.max}</div>`);
        html.push('</div>');
      }

      if (includeCharts && seriesData.chart) {
        html.push('<p><em>Chart would be rendered here</em></p>');
      }

      html.push('</div>');
    }

    html.push('</body>');
    html.push('</html>');

    return html.join('\n');
  }

  _generateChartConfig(type, data) {
    return {
      type,
      data,
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
          },
        },
      },
    };
  }

  _getAggregatesByLevel(seriesName, startTime, endTime, level) {
    if (level === 'hourly') {
      return this.analyticsStore.getHourlyAggregates(seriesName, startTime, endTime);
    } else if (level === 'daily') {
      return this.analyticsStore.getDailyAggregates(seriesName, startTime, endTime);
    } else if (level === 'weekly') {
      return this.analyticsStore.getWeeklyAggregates(seriesName, startTime, endTime);
    }
    return [];
  }
}

module.exports = ReportGenerator;
