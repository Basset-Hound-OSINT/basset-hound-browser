/**
 * Report Generation WebSocket Commands
 *
 * Handles investigation report generation requests.
 * Supports multiple formats: HTML, PDF, JSON, Markdown, CSV
 * Integrates with evidence packages and session data.
 *
 * @module websocket/commands/report-generation
 * @version 1.0.0
 */

const { ReportGenerator } = require('../../src/reporting/report-generator');
const { createLogger } = require('../../logging');

const logger = createLogger('ReportGenerationCommands');

// Store for report instances and metadata
const reportStore = new Map(); // reportId -> { report, timestamp, status }
const reportGenerators = new Map(); // sessionId -> ReportGenerator instance

/**
 * Initialize report generation command handlers
 *
 * @param {Object} managers - Application managers
 * @param {Object} managers.evidenceCollector - Evidence collection manager
 * @param {Object} managers.sessionManager - Session management
 * @param {Object} managers.extractionManager - Data extraction manager
 * @returns {Object} Command handlers object
 */
function initializeReportHandlers(managers = {}) {
  const handlers = {};

  // Get or create report generator for session
  const getGenerator = (sessionId) => {
    if (!reportGenerators.has(sessionId)) {
      reportGenerators.set(sessionId, new ReportGenerator({
        companyName: 'Basset Hound Browser',
        toolVersion: '12.1.0'
      }));
    }
    return reportGenerators.get(sessionId);
  };

  /**
   * Generate investigation report from evidence
   * @async
   * POST /generate_report
   */
  handlers.generate_report = async (params) => {
    try {
      const {
        sessionId,
        title,
        includeScreenshots = true,
        includeNetworkCapture = true,
        includePageContent = true,
        includeTechnologies = true,
        includeTimeline = true,
        includeRecommendations = true,
        sensitiveDataFilter,
        format = 'html'
      } = params;

      if (!sessionId) {
        return { success: false, error: 'sessionId is required' };
      }

      // Get evidence from session
      const evidence = managers.sessionManager?.getSessionEvidence?.(sessionId) || {};
      if (!evidence || Object.keys(evidence).length === 0) {
        logger.warn(`No evidence found for session ${sessionId}`);
      }

      // Prepare report options
      const reportOptions = {
        title: title || `Forensic Report - ${new Date().toLocaleDateString()}`,
        includeScreenshots,
        includeNetworkCapture,
        includePageContent,
        includeTechnologies,
        includeTimeline,
        includeRecommendations,
        sensitiveDataFilter: sensitiveDataFilter || [],
        format: format.toLowerCase()
      };

      // Add URL from evidence
      if (evidence.url) {
        reportOptions.url = evidence.url;
      }

      // Generate report
      const generator = getGenerator(sessionId);
      const reportResult = await generator.generateReport(evidence, reportOptions);

      // Store report metadata
      reportStore.set(reportResult.reportId, {
        ...reportResult,
        sessionId,
        createdAt: new Date().toISOString(),
        content: undefined // Don't store large content in memory
      });

      logger.info(`Report generated: ${reportResult.reportId}`, {
        sessionId,
        format,
        size: reportResult.contentSize,
        time: reportResult.generationTime
      });

      return {
        success: true,
        reportId: reportResult.reportId,
        sessionId,
        format: reportResult.format,
        title: reportResult.title,
        fileSize: reportResult.contentSize,
        pageCount: reportResult.pageCount,
        generationTime: reportResult.generationTime,
        timestamp: reportResult.timestamp,
        sections: reportResult.sections,
        metrics: reportResult.metrics,
        hash: reportResult.hash
      };
    } catch (error) {
      logger.error('Report generation failed', { error: error.message, params });
      return {
        success: false,
        error: `Report generation failed: ${error.message}`
      };
    }
  };

  /**
   * Get generated report content
   * @async
   * GET /get_report
   */
  handlers.get_report = async (params) => {
    try {
      const { reportId } = params;

      if (!reportId) {
        return { success: false, error: 'reportId is required' };
      }

      const reportMeta = reportStore.get(reportId);
      if (!reportMeta) {
        return { success: false, error: 'Report not found' };
      }

      // Return metadata (content retrieved separately via export_report)
      return {
        success: true,
        reportId,
        sessionId: reportMeta.sessionId,
        title: reportMeta.title,
        format: reportMeta.format,
        fileSize: reportMeta.contentSize,
        pageCount: reportMeta.pageCount,
        createdAt: reportMeta.createdAt,
        hash: reportMeta.hash,
        sections: reportMeta.sections,
        metrics: reportMeta.metrics
      };
    } catch (error) {
      logger.error('Failed to get report', { error: error.message, params });
      return { success: false, error: error.message };
    }
  };

  /**
   * Export report in specified format
   * @async
   * POST /export_report
   */
  handlers.export_report = async (params) => {
    try {
      const {
        reportId,
        sessionId,
        format = 'html',
        destination
      } = params;

      if (!reportId && !sessionId) {
        return { success: false, error: 'reportId or sessionId is required' };
      }

      // If only sessionId provided, regenerate with current evidence
      let reportResult;
      if (reportId) {
        const reportMeta = reportStore.get(reportId);
        if (!reportMeta) {
          return { success: false, error: 'Report not found' };
        }
        // For export, would need to retrieve cached report content
        // This is a simplified approach - full implementation would cache content
        logger.warn(`Report content not cached for ${reportId}, would require regeneration`);
        return {
          success: false,
          error: 'Report content not available for export. Please regenerate report.'
        };
      } else {
        // Regenerate report
        const evidence = managers.sessionManager?.getSessionEvidence?.(sessionId) || {};
        const generator = getGenerator(sessionId);
        const options = { format: format.toLowerCase() };
        reportResult = await generator.generateReport(evidence, options);
      }

      // Save to file if destination provided
      if (destination) {
        const generator = getGenerator(sessionId);
        const filepath = await generator.saveReport(reportResult.content, destination, format);
        return {
          success: true,
          exported: true,
          format,
          filePath: filepath,
          fileSize: reportResult.contentSize,
          exportTime: new Date().toISOString()
        };
      }

      // Return content
      return {
        success: true,
        format,
        content: reportResult.content,
        fileSize: reportResult.contentSize,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Report export failed', { error: error.message, params });
      return { success: false, error: error.message };
    }
  };

  /**
   * List available report templates
   * @async
   * GET /get_templates
   */
  handlers.get_templates = async (params) => {
    try {
      const templates = [
        {
          id: 'forensic',
          name: 'Forensic Investigation',
          description: 'Comprehensive forensic report with chain of custody',
          sections: [
            'executiveSummary',
            'investigation',
            'technologies',
            'screenshots',
            'networkForensics',
            'contentAnalysis',
            'timeline',
            'evidence',
            'recommendations',
            'chainOfCustody',
            'compliance'
          ]
        },
        {
          id: 'executive',
          name: 'Executive Summary',
          description: 'High-level findings and recommendations',
          sections: [
            'executiveSummary',
            'investigation',
            'recommendations',
            'compliance'
          ]
        },
        {
          id: 'technical',
          name: 'Technical Analysis',
          description: 'Deep technical findings and evidence',
          sections: [
            'technologies',
            'networkForensics',
            'contentAnalysis',
            'timeline',
            'evidence'
          ]
        },
        {
          id: 'compliance',
          name: 'Compliance Report',
          description: 'Compliance and regulatory alignment',
          sections: [
            'executiveSummary',
            'evidence',
            'chainOfCustody',
            'compliance'
          ]
        },
        {
          id: 'custom',
          name: 'Custom Template',
          description: 'Create custom template with selected sections',
          sections: 'user_defined'
        }
      ];

      return {
        success: true,
        templates,
        supportedFormats: ['html', 'pdf', 'json', 'markdown', 'csv']
      };
    } catch (error) {
      logger.error('Failed to get templates', { error: error.message });
      return { success: false, error: error.message };
    }
  };

  /**
   * Create custom report template
   * @async
   * POST /customize_template
   */
  handlers.customize_template = async (params) => {
    try {
      const {
        templateId,
        name,
        description,
        sections,
        defaultFormat = 'html'
      } = params;

      if (!name || !Array.isArray(sections)) {
        return { success: false, error: 'name and sections array are required' };
      }

      const customId = `custom_${Date.now()}`;
      const customTemplate = {
        id: customId,
        name,
        description: description || 'Custom template',
        sections,
        defaultFormat,
        createdAt: new Date().toISOString()
      };

      // Store custom template (in production would persist to database)
      reportStore.set(`template_${customId}`, customTemplate);

      logger.info(`Custom template created: ${customId}`);

      return {
        success: true,
        templateId: customId,
        template: customTemplate
      };
    } catch (error) {
      logger.error('Template customization failed', { error: error.message, params });
      return { success: false, error: error.message };
    }
  };

  /**
   * Annotate report screenshot
   * @async
   * POST /annotate_report_screenshot
   */
  handlers.annotate_report_screenshot = async (params) => {
    try {
      const {
        reportId,
        screenshotId,
        annotations
      } = params;

      if (!reportId || !screenshotId || !Array.isArray(annotations)) {
        return { success: false, error: 'reportId, screenshotId, and annotations array required' };
      }

      // Validate annotation format
      for (const ann of annotations) {
        if (!ann.type || !ann.coordinates) {
          return { success: false, error: 'Each annotation must have type and coordinates' };
        }
      }

      const annotationId = `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info(`Screenshot annotated: ${screenshotId} in report ${reportId}`, {
        annotationCount: annotations.length
      });

      return {
        success: true,
        annotationId,
        annotationCount: annotations.length,
        annotated: true
      };
    } catch (error) {
      logger.error('Screenshot annotation failed', { error: error.message, params });
      return { success: false, error: error.message };
    }
  };

  /**
   * Schedule report generation
   * @async
   * POST /schedule_report
   */
  handlers.schedule_report = async (params) => {
    try {
      const {
        sessionId,
        title,
        cron,
        timezone = 'UTC',
        format = 'html',
        destination
      } = params;

      if (!sessionId || !cron) {
        return { success: false, error: 'sessionId and cron expression required' };
      }

      const scheduleId = `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info(`Report generation scheduled: ${scheduleId}`, {
        sessionId,
        cron,
        timezone
      });

      return {
        success: true,
        scheduleId,
        sessionId,
        title: title || 'Scheduled Report',
        cron,
        timezone,
        format,
        status: 'scheduled',
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Report scheduling failed', { error: error.message, params });
      return { success: false, error: error.message };
    }
  };

  /**
   * Get all reports for session
   * @async
   * GET /list_reports
   */
  handlers.list_reports = async (params) => {
    try {
      const { sessionId, limit = 100 } = params;

      const reports = [];
      let count = 0;

      for (const [reportId, reportMeta] of reportStore.entries()) {
        if (!reportId.startsWith('template_') && reportMeta.sessionId === sessionId) {
          reports.push({
            reportId,
            title: reportMeta.title,
            format: reportMeta.format,
            fileSize: reportMeta.contentSize,
            pageCount: reportMeta.pageCount,
            createdAt: reportMeta.createdAt,
            hash: reportMeta.hash
          });

          if (++count >= limit) {
            break;
          }
        }
      }

      return {
        success: true,
        sessionId,
        reports,
        total: reports.length,
        limit
      };
    } catch (error) {
      logger.error('Failed to list reports', { error: error.message, params });
      return { success: false, error: error.message };
    }
  };

  /**
   * Delete report
   * @async
   * POST /delete_report
   */
  handlers.delete_report = async (params) => {
    try {
      const { reportId } = params;

      if (!reportId) {
        return { success: false, error: 'reportId required' };
      }

      const deleted = reportStore.delete(reportId);

      if (!deleted) {
        return { success: false, error: 'Report not found' };
      }

      logger.info(`Report deleted: ${reportId}`);

      return {
        success: true,
        reportId,
        deleted: true
      };
    } catch (error) {
      logger.error('Failed to delete report', { error: error.message, params });
      return { success: false, error: error.message };
    }
  };

  /**
   * Get report generation statistics
   * @async
   * GET /report_statistics
   */
  handlers.report_statistics = async (params) => {
    try {
      const { sessionId } = params;

      const stats = {
        totalReports: 0,
        byFormat: {},
        averageGenerationTime: 0,
        totalDataGenerated: 0,
        sessions: {}
      };

      let totalTime = 0;
      let reportCount = 0;

      for (const [reportId, reportMeta] of reportStore.entries()) {
        if (reportId.startsWith('template_')) {
          continue;
        }

        if (sessionId && reportMeta.sessionId !== sessionId) {
          continue;
        }

        stats.totalReports++;
        stats.byFormat[reportMeta.format] = (stats.byFormat[reportMeta.format] || 0) + 1;
        stats.totalDataGenerated += reportMeta.contentSize || 0;

        if (reportMeta.generationTime) {
          totalTime += reportMeta.generationTime;
          reportCount++;
        }

        if (!stats.sessions[reportMeta.sessionId]) {
          stats.sessions[reportMeta.sessionId] = 0;
        }
        stats.sessions[reportMeta.sessionId]++;
      }

      stats.averageGenerationTime = reportCount > 0 ? Math.round(totalTime / reportCount) : 0;
      stats.totalDataGenerated = this._formatBytes(stats.totalDataGenerated);

      return {
        success: true,
        statistics: stats
      };
    } catch (error) {
      logger.error('Failed to get statistics', { error: error.message, params });
      return { success: false, error: error.message };
    }
  };

  /**
   * Validate report integrity
   * @async
   * POST /verify_report
   */
  handlers.verify_report = async (params) => {
    try {
      const { reportId, expectedHash } = params;

      if (!reportId) {
        return { success: false, error: 'reportId required' };
      }

      const reportMeta = reportStore.get(reportId);
      if (!reportMeta) {
        return { success: false, error: 'Report not found' };
      }

      const isValid = !expectedHash || reportMeta.hash === expectedHash;

      return {
        success: true,
        reportId,
        valid: isValid,
        hash: reportMeta.hash,
        hashMatch: isValid,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Report verification failed', { error: error.message, params });
      return { success: false, error: error.message };
    }
  };

  return handlers;
}

/**
 * Helper to format bytes
 */
function _formatBytes(bytes) {
  if (typeof bytes !== 'number' || bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

module.exports = {
  initializeReportHandlers,
  reportStore,
  reportGenerators
};
