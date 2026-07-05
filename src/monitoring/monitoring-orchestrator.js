/**
 * Monitoring Orchestrator
 *
 * Centralized monitoring system that integrates:
 * - Application metrics collection
 * - System metrics collection
 * - Alert rules evaluation
 * - Alert routing and escalation
 * - Health checks
 * - Incident management
 * - Metrics export (Prometheus)
 *
 * @module src/monitoring/monitoring-orchestrator
 * @requires events
 */

const EventEmitter = require('events');
const path = require('path');

const { AppMetricsCollector } = require('./app-metrics');
const { SystemMetricsCollector } = require('./system-metrics');
const { PrometheusExporter } = require('./prometheus-exporter');
const { AlertRulesEngine } = require('./alert-rules');
const { AlertRouter } = require('./alert-router');
const { HealthChecker } = require('./health-checker');
const { IncidentTracker } = require('./incident-tracker');

/**
 * Monitoring Orchestrator
 * Coordinates all monitoring components
 */
class MonitoringOrchestrator extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      dataDir: options.dataDir || path.join(process.cwd(), 'tmp', '.basset-hound', 'monitoring'),
      enableAppMetrics: options.enableAppMetrics !== false,
      enableSystemMetrics: options.enableSystemMetrics !== false,
      enableAlertRules: options.enableAlertRules !== false,
      enableAlertRouting: options.enableAlertRouting !== false,
      enableHealthChecks: options.enableHealthChecks !== false,
      enableIncidentTracking: options.enableIncidentTracking !== false,
      enablePrometheusExport: options.enablePrometheusExport !== false,
      prometheusPort: options.prometheusPort || 9090,
      ...options
    };

    this.status = 'initializing';
    this.startTime = Date.now();

    // Initialize components
    this.appMetrics = null;
    this.systemMetrics = null;
    this.prometheusExporter = null;
    this.alertRules = null;
    this.alertRouter = null;
    this.healthChecker = null;
    this.incidentTracker = null;

    this._initialize();
  }

  /**
   * Initialize all monitoring components
   * @private
   */
  _initialize() {
    try {
      // Initialize app metrics
      if (this.options.enableAppMetrics) {
        this.appMetrics = new AppMetricsCollector(this.options.appMetrics);
        this.appMetrics.on('metric:updated', (data) => {
          this.emit('metric:updated', data);
        });
      }

      // Initialize system metrics
      if (this.options.enableSystemMetrics) {
        this.systemMetrics = new SystemMetricsCollector(this.options.systemMetrics);
        this.systemMetrics.on('metrics:collected', (data) => {
          this.emit('system_metrics:collected', data);
        });
      }

      // Initialize Prometheus exporter
      if (this.options.enablePrometheusExport && this.appMetrics && this.systemMetrics) {
        this.prometheusExporter = new PrometheusExporter(
          this.appMetrics,
          this.systemMetrics,
          {
            port: this.options.prometheusPort,
            ...this.options.prometheusExporter
          }
        );

        this.prometheusExporter.on('exporter:started', (data) => {
          this.emit('exporter:started', data);
        });
      }

      // Initialize alert rules
      if (this.options.enableAlertRules && this.appMetrics) {
        this.alertRules = new AlertRulesEngine(this.appMetrics, this.options.alertRules);
        this.alertRules.on('alert:triggered', (alert) => {
          this.emit('alert:triggered', alert);
          // Auto-create incident for critical alerts
          if (this.incidentTracker && alert.severity === 'critical') {
            this.incidentTracker.createIncidentFromAlert(alert);
          }
          // Route the alert
          if (this.alertRouter) {
            this.alertRouter.routeAlert(alert);
          }
        });

        this.alertRules.on('alert:resolved', (alert) => {
          this.emit('alert:resolved', alert);
        });
      }

      // Initialize alert router
      if (this.options.enableAlertRouting) {
        this.alertRouter = new AlertRouter(this.options.alertRouter);
        this.alertRouter.on('alert:routed', (data) => {
          this.emit('alert:routed', data);
        });

        this.alertRouter.on('routing:error', (data) => {
          this.emit('routing:error', data);
        });
      }

      // Initialize health checks
      if (this.options.enableHealthChecks) {
        this.healthChecker = new HealthChecker(this.options.healthChecker);
        this.healthChecker.on('health:checked', (data) => {
          this.emit('health:checked', data);
        });
      }

      // Initialize incident tracking
      if (this.options.enableIncidentTracking) {
        this.incidentTracker = new IncidentTracker(this.options.incidentTracker);
        this.incidentTracker.on('incident:created', (incident) => {
          this.emit('incident:created', incident);
        });

        this.incidentTracker.on('incident:resolved', (data) => {
          this.emit('incident:resolved', data);
        });

        // Load existing incidents
        this.incidentTracker.loadIncidents();
      }

      this.status = 'running';
      this.emit('orchestrator:started', {
        timestamp: Date.now(),
        components: this._getComponentStatus()
      });
    } catch (e) {
      this.status = 'error';
      this.emit('orchestrator:error', {
        error: e.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Record a command execution
   */
  recordCommand(commandName, duration, success = true, labels = {}) {
    if (this.appMetrics) {
      this.appMetrics.recordCommand(commandName, duration, success, labels);
    }
  }

  /**
   * Record a message exchange
   */
  recordMessage(direction, size, latency) {
    if (this.appMetrics) {
      this.appMetrics.recordMessage(direction, size, latency);
    }
  }

  /**
   * Record a connection event
   */
  recordConnection(event, duration) {
    if (this.appMetrics) {
      this.appMetrics.recordConnection(event, duration);
    }
  }

  /**
   * Record an error event
   */
  recordError(errorType, labels = {}) {
    if (this.appMetrics) {
      this.appMetrics.recordError(errorType, labels);
    }
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    return {
      timestamp: Date.now(),
      app: this.appMetrics ? this.appMetrics.getSummary() : null,
      system: this.systemMetrics ? this.systemMetrics.getSummary() : null,
      alerts: this.alertRules ? this.alertRules.getSummary() : null,
      health: this.healthChecker ? this.healthChecker.getHealth() : null
    };
  }

  /**
   * Get Prometheus format metrics
   */
  getPrometheusMetrics() {
    if (!this.prometheusExporter) {
      return '';
    }
    return this.prometheusExporter.export();
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    if (!this.alertRules) {
      return [];
    }
    return this.alertRules.getActiveAlerts();
  }

  /**
   * Get alert summary
   */
  getAlertSummary() {
    if (!this.alertRules) {
      return null;
    }
    return this.alertRules.getSummary();
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    if (!this.healthChecker) {
      return null;
    }
    return this.healthChecker.getHealth();
  }

  /**
   * Get open incidents
   */
  getOpenIncidents() {
    if (!this.incidentTracker) {
      return [];
    }
    return this.incidentTracker.getOpenIncidents();
  }

  /**
   * Get incident statistics
   */
  getIncidentStatistics(days = 30) {
    if (!this.incidentTracker) {
      return null;
    }
    return this.incidentTracker.getStatistics(days);
  }

  /**
   * Create a manual incident
   */
  createIncident(config) {
    if (!this.incidentTracker) {
      throw new Error('Incident tracking not enabled');
    }
    return this.incidentTracker.createManualIncident(config);
  }

  /**
   * Acknowledge an incident
   */
  acknowledgeIncident(incidentId, acknowledgedBy) {
    if (!this.incidentTracker) {
      throw new Error('Incident tracking not enabled');
    }
    return this.incidentTracker.acknowledgeIncident(incidentId, acknowledgedBy);
  }

  /**
   * Resolve an incident
   */
  resolveIncident(incidentId, resolution, resolvedBy) {
    if (!this.incidentTracker) {
      throw new Error('Incident tracking not enabled');
    }
    return this.incidentTracker.resolveIncident(incidentId, resolution, resolvedBy);
  }

  /**
   * Register a custom alert rule
   */
  registerAlertRule(ruleConfig) {
    if (!this.alertRules) {
      throw new Error('Alert rules not enabled');
    }
    return this.alertRules.registerRule(ruleConfig);
  }

  /**
   * Get all alert rules
   */
  getAlertRules() {
    if (!this.alertRules) {
      return [];
    }
    return this.alertRules.getRules();
  }

  /**
   * Set custom health check for component
   */
  setHealthCheckComponent(componentName, checkFn) {
    if (!this.healthChecker) {
      throw new Error('Health checking not enabled');
    }
    this.healthChecker.setComponentCheckFn(componentName, checkFn);
  }

  /**
   * Force immediate health check
   */
  async checkHealth() {
    if (!this.healthChecker) {
      return null;
    }
    return this.healthChecker.checkNow();
  }

  /**
   * Get comprehensive monitoring report
   */
  getMonitoringReport() {
    return {
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      status: this.status,
      components: this._getComponentStatus(),
      metrics: this.getMetrics(),
      alerts: {
        summary: this.getAlertSummary(),
        active: this.getActiveAlerts()
      },
      health: this.getHealthStatus(),
      incidents: {
        open: this.getOpenIncidents(),
        statistics: this.getIncidentStatistics()
      }
    };
  }

  /**
   * Get component status
   * @private
   */
  _getComponentStatus() {
    return {
      appMetrics: {
        enabled: Boolean(this.appMetrics),
        status: this.appMetrics ? 'running' : 'disabled'
      },
      systemMetrics: {
        enabled: Boolean(this.systemMetrics),
        status: this.systemMetrics ? 'running' : 'disabled'
      },
      prometheusExporter: {
        enabled: Boolean(this.prometheusExporter),
        status: this.prometheusExporter?.isRunning ? 'running' : 'disabled',
        url: this.prometheusExporter?.isRunning ?
          `http://localhost:${this.options.prometheusPort}/metrics` : null
      },
      alertRules: {
        enabled: Boolean(this.alertRules),
        status: this.alertRules ? 'running' : 'disabled',
        rulesCount: this.alertRules?.rules.size || 0
      },
      alertRouter: {
        enabled: Boolean(this.alertRouter),
        status: this.alertRouter ? 'running' : 'disabled'
      },
      healthChecker: {
        enabled: Boolean(this.healthChecker),
        status: this.healthChecker ? 'running' : 'disabled'
      },
      incidentTracker: {
        enabled: Boolean(this.incidentTracker),
        status: this.incidentTracker ? 'running' : 'disabled',
        incidentsCount: this.incidentTracker?.incidents.size || 0
      }
    };
  }

  /**
   * Get summary for dashboard
   */
  getDashboardSummary() {
    return {
      timestamp: Date.now(),
      status: this.status,
      uptime: Date.now() - this.startTime,
      metrics: {
        app: this.appMetrics?.getSummary() || null,
        system: this.systemMetrics?.getSummary() || null
      },
      alerts: {
        total: this.getActiveAlerts().length,
        bySeverity: this._getAlertsBySeverity()
      },
      health: {
        status: this.healthChecker?.lastCheck?.status || 'unknown',
        uptime: this.healthChecker?.getSLASummary() || null
      },
      incidents: {
        open: this.getOpenIncidents().length,
        critical: this.getOpenIncidents().filter(i => i.severity === 'critical').length
      }
    };
  }

  /**
   * Get alerts by severity
   * @private
   */
  _getAlertsBySeverity() {
    const alerts = this.getActiveAlerts();
    const bySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const alert of alerts) {
      if (bySeverity.hasOwnProperty(alert.severity)) {
        bySeverity[alert.severity]++;
      }
    }

    return bySeverity;
  }

  /**
   * Cleanup and shutdown
   */
  destroy() {
    if (this.appMetrics) {
      this.appMetrics.destroy();
    }
    if (this.systemMetrics) {
      this.systemMetrics.destroy();
    }
    if (this.prometheusExporter) {
      this.prometheusExporter.destroy();
    }
    if (this.alertRules) {
      this.alertRules.destroy();
    }
    if (this.alertRouter) {
      this.alertRouter.destroy();
    }
    if (this.healthChecker) {
      this.healthChecker.destroy();
    }
    if (this.incidentTracker) {
      this.incidentTracker.destroy();
    }

    this.status = 'stopped';
    this.emit('orchestrator:stopped', { timestamp: Date.now() });
    this.removeAllListeners();
  }
}

module.exports = {
  MonitoringOrchestrator
};
