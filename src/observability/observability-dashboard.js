/**
 * Observability Dashboard for Basset Hound Browser
 *
 * Provides:
 * - Service dependency visualization
 * - Health overview
 * - Anomaly detection
 * - Real-time metrics
 *
 * Features:
 * - Multi-service monitoring
 * - Health aggregation
 * - Anomaly alerts
 * - Performance trends
 * - Incident tracking
 */

const EventEmitter = require('events');

class ObservabilityDashboard extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      enableHealthAggregation: options.enableHealthAggregation !== false,
      enableAnomalyDetection: options.enableAnomalyDetection !== false,
      enableIncidentTracking: options.enableIncidentTracking !== false,
      refreshIntervalMs: options.refreshIntervalMs || 5000,
      healthCheckIntervalMs: options.healthCheckIntervalMs || 30000,
      anomalyThreshold: options.anomalyThreshold || 2.5, // Standard deviations
      ...options
    };

    this.dashboard = {
      services: new Map(),
      metrics: new Map(),
      alerts: [],
      incidents: [],
      anomalies: [],
      healthStatus: 'unknown',
      lastUpdated: Date.now()
    };

    this.serviceDependencies = new Map();
    this.healthHistory = [];
    this.metricsHistory = [];
    this.anomalyDetector = null;
    this.incidentTracker = null;
  }

  /**
   * Register service in dashboard
   */
  registerService(serviceName, serviceData) {
    const service = {
      name: serviceName,
      status: serviceData.status || 'initializing', // initializing, healthy, degraded, unhealthy, offline
      lastUpdate: Date.now(),
      errorRate: 0,
      latency: 0,
      throughput: 0,
      uptime: 100,
      dependencies: new Set(serviceData.dependencies || []),
      dependents: new Set(),
      metrics: {
        requests: 0,
        errors: 0,
        totalLatency: 0,
        maxLatency: 0,
        minLatency: Infinity
      },
      alerts: [],
      incidents: [],
      healthChecks: []
    };

    this.dashboard.services.set(serviceName, service);

    // Update reverse dependencies
    for (const dependency of service.dependencies) {
      const depService = this.dashboard.services.get(dependency);
      if (depService) {
        depService.dependents.add(serviceName);
      }
    }

    this.emit('service:registered', {
      serviceName,
      dependencies: Array.from(service.dependencies)
    });

    return service;
  }

  /**
   * Update service metrics
   */
  updateServiceMetrics(serviceName, metricsData) {
    const service = this.dashboard.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not registered`);
    }

    // Update metrics
    service.metrics.requests += metricsData.requests || 0;
    service.metrics.errors += metricsData.errors || 0;

    if (metricsData.latency) {
      service.metrics.totalLatency += metricsData.latency;
      service.metrics.maxLatency = Math.max(service.metrics.maxLatency, metricsData.latency);
      service.metrics.minLatency = Math.min(service.metrics.minLatency, metricsData.latency);
    }

    // Calculate rates
    service.errorRate = service.metrics.requests > 0
      ? (service.metrics.errors / service.metrics.requests) * 100
      : 0;

    service.latency = service.metrics.requests > 0
      ? service.metrics.totalLatency / service.metrics.requests
      : 0;

    service.throughput = metricsData.throughput || 0;

    service.lastUpdate = Date.now();

    // Update health status
    this._updateServiceHealth(serviceName);

    this.emit('metrics:updated', {
      serviceName,
      errorRate: service.errorRate,
      latency: service.latency
    });

    return service;
  }

  /**
   * Record health check result
   */
  recordHealthCheck(serviceName, checkResult) {
    const service = this.dashboard.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not registered`);
    }

    const check = {
      timestamp: Date.now(),
      checkType: checkResult.checkType || 'liveness',
      passed: checkResult.passed === true,
      latency: checkResult.latency || 0,
      details: checkResult.details || {},
      errorMessage: checkResult.errorMessage || null
    };

    service.healthChecks.push(check);

    // Keep only recent checks
    if (service.healthChecks.length > 100) {
      service.healthChecks.shift();
    }

    // Calculate uptime
    const passedChecks = service.healthChecks.filter(c => c.passed).length;
    service.uptime = (passedChecks / service.healthChecks.length) * 100;

    this._updateServiceHealth(serviceName);

    this.emit('healthCheck:recorded', {
      serviceName,
      passed: check.passed,
      uptime: service.uptime
    });

    return check;
  }

  /**
   * Detect and report anomalies
   */
  detectAnomalies() {
    const anomalies = [];

    for (const [serviceName, service] of this.dashboard.services) {
      // Check error rate anomaly
      if (service.errorRate > 5) { // 5% error threshold
        anomalies.push({
          serviceNameervice: serviceName,
          anomalyType: 'high_error_rate',
          severity: service.errorRate > 20 ? 'critical' : 'warning',
          value: service.errorRate,
          threshold: 5,
          timestamp: Date.now()
        });
      }

      // Check latency anomaly
      if (service.latency > 1000) { // 1 second threshold
        anomalies.push({
          serviceName,
          anomalyType: 'high_latency',
          severity: service.latency > 5000 ? 'critical' : 'warning',
          value: service.latency,
          threshold: 1000,
          timestamp: Date.now()
        });
      }

      // Check uptime anomaly
      if (service.uptime < 99) {
        anomalies.push({
          serviceName,
          anomalyType: 'low_uptime',
          severity: service.uptime < 95 ? 'critical' : 'warning',
          value: service.uptime,
          threshold: 99,
          timestamp: Date.now()
        });
      }
    }

    this.dashboard.anomalies = anomalies;

    if (anomalies.length > 0) {
      this.emit('anomalies:detected', {
        count: anomalies.length,
        critical: anomalies.filter(a => a.severity === 'critical').length
      });
    }

    return anomalies;
  }

  /**
   * Create incident from anomaly
   */
  createIncident(anomalyData) {
    const incident = {
      incidentId: this._generateIncidentId(),
      timestamp: Date.now(),
      anomalyType: anomalyData.anomalyType,
      serviceName: anomalyData.serviceName,
      severity: anomalyData.severity || 'warning',
      status: 'open', // open, investigating, resolved, false_positive
      description: anomalyData.description || '',
      affectedServices: new Set([anomalyData.serviceName]),
      timeline: [{
        timestamp: Date.now(),
        event: 'incident_created',
        details: anomalyData
      }],
      rootCause: null,
      resolution: null
    };

    this.dashboard.incidents.push(incident);

    const service = this.dashboard.services.get(anomalyData.serviceName);
    if (service) {
      service.incidents.push(incident.incidentId);
    }

    this.emit('incident:created', {
      incidentId: incident.incidentId,
      serviceName: incident.serviceName,
      severity: incident.severity
    });

    return incident;
  }

  /**
   * Get dashboard summary
   */
  getDashboardSummary() {
    const services = Array.from(this.dashboard.services.values());
    const healthyServices = services.filter(s => s.status === 'healthy').length;
    const degradedServices = services.filter(s => s.status === 'degraded').length;
    const unhealthyServices = services.filter(s => s.status === 'unhealthy').length;

    // Determine overall health
    let overallHealth = 'healthy';
    if (unhealthyServices > 0) overallHealth = 'unhealthy';
    else if (degradedServices > 0) overallHealth = 'degraded';

    return {
      timestamp: Date.now(),
      overallHealth,
      serviceStats: {
        total: services.length,
        healthy: healthyServices,
        degraded: degradedServices,
        unhealthy: unhealthyServices
      },
      metrics: {
        avgErrorRate: services.length > 0
          ? services.reduce((sum, s) => sum + s.errorRate, 0) / services.length
          : 0,
        avgLatency: services.length > 0
          ? services.reduce((sum, s) => sum + s.latency, 0) / services.length
          : 0,
        avgUptime: services.length > 0
          ? services.reduce((sum, s) => sum + s.uptime, 0) / services.length
          : 100
      },
      alerts: this.dashboard.alerts.length,
      incidents: this.dashboard.incidents.filter(i => i.status === 'open').length,
      anomalies: this.dashboard.anomalies.length
    };
  }

  /**
   * Get service status report
   */
  getServiceStatus(serviceName) {
    const service = this.dashboard.services.get(serviceName);
    if (!service) {
      return null;
    }

    return {
      serviceName,
      status: service.status,
      lastUpdate: service.lastUpdate,
      errorRate: service.errorRate.toFixed(2),
      latency: service.latency.toFixed(2),
      throughput: service.throughput.toFixed(2),
      uptime: service.uptime.toFixed(2),
      metrics: {
        requests: service.metrics.requests,
        errors: service.metrics.errors,
        maxLatency: service.metrics.maxLatency,
        minLatency: service.metrics.minLatency
      },
      dependencies: Array.from(service.dependencies),
      dependents: Array.from(service.dependents),
      recentHealthChecks: service.healthChecks.slice(-5).map(c => ({
        timestamp: c.timestamp,
        passed: c.passed,
        latency: c.latency
      })),
      activeIncidents: service.incidents.length,
      alerts: service.alerts.length
    };
  }

  /**
   * Get service dependency graph
   */
  getServiceDependencyGraph() {
    const graph = {
      nodes: [],
      edges: [],
      clusters: []
    };

    // Add all services as nodes
    for (const [serviceName, service] of this.dashboard.services) {
      graph.nodes.push({
        id: serviceName,
        label: serviceName,
        status: service.status,
        errorRate: service.errorRate,
        latency: service.latency,
        size: service.dependents.size + service.dependencies.size + 1
      });
    }

    // Add dependencies as edges
    for (const [serviceName, service] of this.dashboard.services) {
      for (const dependency of service.dependencies) {
        graph.edges.push({
          source: serviceName,
          target: dependency,
          type: 'depends_on',
          weight: 1
        });
      }
    }

    // Identify clusters (groups of interdependent services)
    graph.clusters = this._identifyServiceClusters();

    return graph;
  }

  /**
   * Generate observability report
   */
  generateReport(timeWindowMs = 3600000) {
    const now = Date.now();
    const startTime = now - timeWindowMs;

    const services = Array.from(this.dashboard.services.values());
    const recentIncidents = this.dashboard.incidents.filter(
      i => i.timestamp >= startTime
    );

    return {
      reportPeriod: {
        start: startTime,
        end: now,
        duration: timeWindowMs
      },
      summary: this.getDashboardSummary(),
      services: services.map(s => ({
        name: s.name,
        status: s.status,
        errorRate: s.errorRate.toFixed(2),
        latency: s.latency.toFixed(2),
        uptime: s.uptime.toFixed(2)
      })),
      incidents: recentIncidents.map(i => ({
        incidentId: i.incidentId,
        serviceName: i.serviceName,
        severity: i.severity,
        status: i.status,
        timestamp: i.timestamp,
        rootCause: i.rootCause
      })),
      anomalies: this.dashboard.anomalies,
      recommendations: this._generateRecommendations()
    };
  }

  /**
   * Update service health
   */
  _updateServiceHealth(serviceName) {
    const service = this.dashboard.services.get(serviceName);
    if (!service) return;

    if (service.uptime < 95 || service.errorRate > 20) {
      service.status = 'unhealthy';
    } else if (service.uptime < 99 || service.errorRate > 5) {
      service.status = 'degraded';
    } else {
      service.status = 'healthy';
    }

    // Update overall dashboard health
    const allServices = Array.from(this.dashboard.services.values());
    const unhealthyCount = allServices.filter(s => s.status === 'unhealthy').length;
    const degradedCount = allServices.filter(s => s.status === 'degraded').length;

    if (unhealthyCount > 0) {
      this.dashboard.healthStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      this.dashboard.healthStatus = 'degraded';
    } else {
      this.dashboard.healthStatus = 'healthy';
    }
  }

  /**
   * Identify service clusters
   */
  _identifyServiceClusters() {
    const clusters = [];
    const visited = new Set();

    for (const [serviceName, service] of this.dashboard.services) {
      if (visited.has(serviceName)) continue;

      const cluster = new Set();
      const queue = [serviceName];

      while (queue.length > 0) {
        const current = queue.shift();
        if (visited.has(current)) continue;

        visited.add(current);
        cluster.add(current);

        const currentService = this.dashboard.services.get(current);
        if (currentService) {
          for (const dep of currentService.dependencies) {
            if (!visited.has(dep)) queue.push(dep);
          }
          for (const dep of currentService.dependents) {
            if (!visited.has(dep)) queue.push(dep);
          }
        }
      }

      if (cluster.size > 1) {
        clusters.push(Array.from(cluster));
      }
    }

    return clusters;
  }

  /**
   * Generate recommendations
   */
  _generateRecommendations() {
    const recommendations = [];

    const unhealthyServices = Array.from(this.dashboard.services.values())
      .filter(s => s.status === 'unhealthy');

    if (unhealthyServices.length > 0) {
      recommendations.push({
        priority: 'critical',
        message: `${unhealthyServices.length} service(s) are unhealthy. Immediate investigation required.`,
        services: unhealthyServices.map(s => s.name)
      });
    }

    const highLatency = Array.from(this.dashboard.services.values())
      .filter(s => s.latency > 5000);

    if (highLatency.length > 0) {
      recommendations.push({
        priority: 'high',
        message: 'High latency detected in services. Consider optimization or scaling.',
        services: highLatency.map(s => s.name)
      });
    }

    return recommendations;
  }

  /**
   * Generate incident ID
   */
  _generateIncidentId() {
    return `incident-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close system
   */
  close() {
    this.dashboard.services.clear();
    this.dashboard.metrics.clear();
    this.dashboard.alerts = [];
    this.dashboard.incidents = [];
    this.serviceDependencies.clear();
    this.healthHistory = [];
    this.metricsHistory = [];
    this.emit('system:closed');
  }
}

module.exports = ObservabilityDashboard;
