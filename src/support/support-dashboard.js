/**
 * Support Dashboard & Metrics
 *
 * Real-time support metrics, SLA compliance tracking, team performance metrics,
 * customer satisfaction scores, and trend analysis.
 *
 * Features:
 * - Real-time ticket metrics
 * - SLA compliance tracking
 * - Team performance analytics
 * - Customer satisfaction scoring
 * - Trend analysis
 * - Custom dashboards
 * - Export capabilities
 * - Alert thresholds
 */

const EventEmitter = require('events');

class SupportDashboard extends EventEmitter {
  constructor(options = {}) {
    super();
    this.ticketManager = options.ticketManager;
    this.slaEngine = options.slaEngine;
    this.escalationManager = options.escalationManager;
    this.knowledgeBase = options.knowledgeBase;
    this.metrics = new Map();
    this.alerts = [];
    this.alertThresholds = this.initializeThresholds();
    this.refreshInterval = options.refreshInterval || 30000; // 30 seconds

    this.startMetricsCollection();
  }

  /**
   * Initialize alert thresholds
   */
  initializeThresholds() {
    return {
      slaBreachRate: 15, // percentage
      averageResolutionTime: 1440, // minutes
      openTicketCount: 100,
      criticalTicketCount: 5,
      escalationRate: 20, // percentage
      customerSatisfaction: 80 // percentage
    };
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    setInterval(() => {
      this.collectMetrics();
    }, this.refreshInterval);
  }

  /**
   * Collect current metrics
   */
  collectMetrics() {
    if (!this.ticketManager) {
      return;
    }

    const metrics = {
      timestamp: new Date().toISOString(),
      tickets: this.collectTicketMetrics(),
      team: this.collectTeamMetrics(),
      sla: this.collectSLAMetrics(),
      escalations: this.collectEscalationMetrics(),
      satisfaction: this.collectSatisfactionMetrics(),
      knowledge: this.collectKnowledgeMetrics()
    };

    this.metrics.set(metrics.timestamp, metrics);

    // Keep only last 30 days of metrics
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    for (const [timestamp] of this.metrics) {
      if (timestamp < thirtyDaysAgo) {
        this.metrics.delete(timestamp);
      }
    }

    // Check alert thresholds
    this.checkAlertThresholds(metrics);

    this.emit('metrics-updated', metrics);

    return metrics;
  }

  /**
   * Collect ticket metrics
   */
  collectTicketMetrics() {
    const tickets = Array.from(this.ticketManager.tickets.values());

    const metrics = {
      total: tickets.length,
      byStatus: {},
      byPriority: {},
      byCategory: {},
      newToday: 0,
      resolvedToday: 0,
      averageAge: 0
    };

    const today = new Date().toDateString();

    for (const ticket of tickets) {
      // By status
      metrics.byStatus[ticket.status] = (metrics.byStatus[ticket.status] || 0) + 1;

      // By priority
      metrics.byPriority[ticket.priority] = (metrics.byPriority[ticket.priority] || 0) + 1;

      // By category
      metrics.byCategory[ticket.category] = (metrics.byCategory[ticket.category] || 0) + 1;

      // New today
      if (new Date(ticket.createdAt).toDateString() === today) {
        metrics.newToday += 1;
      }

      // Resolved today
      if (ticket.resolvedAt && new Date(ticket.resolvedAt).toDateString() === today) {
        metrics.resolvedToday += 1;
      }
    }

    // Average ticket age
    if (tickets.length > 0) {
      const totalAge = tickets.reduce((sum, t) => {
        return sum + (Date.now() - new Date(t.createdAt));
      }, 0);
      metrics.averageAge = Math.round(totalAge / tickets.length / (1000 * 60)); // minutes
    }

    return metrics;
  }

  /**
   * Collect team metrics
   */
  collectTeamMetrics() {
    const teams = Array.from(this.ticketManager.teams.values());

    const metrics = {
      teams: []
    };

    for (const team of teams) {
      const teamMetrics = {
        id: team.id,
        name: team.name,
        agentCount: team.agents.length,
        currentLoad: team.currentLoad,
        maxCapacity: team.maxTickets,
        utilizationPercent: Math.round((team.currentLoad / team.maxTickets) * 100),
        agents: team.agents.map(agentId => {
          const agent = this.ticketManager.agents.get(agentId);
          return {
            id: agentId,
            name: agent?.name,
            status: agent?.status,
            currentTickets: agent?.currentTickets.length || 0,
            performance: agent?.performance
          };
        })
      };

      metrics.teams.push(teamMetrics);
    }

    return metrics;
  }

  /**
   * Collect SLA metrics
   */
  collectSLAMetrics() {
    if (!this.slaEngine) {
      return null;
    }

    const slaBased = this.slaEngine.getMetrics();

    return {
      ...slaBased,
      breaches: this.slaEngine.getBreaches({ acknowledged: false }).length,
      alerts: this.slaEngine.getAlerts({ addressed: false }).length
    };
  }

  /**
   * Collect escalation metrics
   */
  collectEscalationMetrics() {
    if (!this.escalationManager) {
      return null;
    }

    return this.escalationManager.getMetrics();
  }

  /**
   * Collect satisfaction metrics
   */
  collectSatisfactionMetrics() {
    const tickets = Array.from(this.ticketManager.tickets.values());
    const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');

    const metrics = {
      count: resolvedTickets.length,
      averageRating: 0,
      ratings: {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0
      }
    };

    if (resolvedTickets.length > 0) {
      let totalRating = 0;

      for (const ticket of resolvedTickets) {
        // Estimate satisfaction from sentiment and resolution time
        const sentiment = ticket.responses[ticket.responses.length - 1]?.sentiment || 'neutral';
        const resolutionTime = new Date(ticket.resolvedAt) - new Date(ticket.createdAt);
        const expectedTime = 24 * 60 * 60 * 1000; // 24 hours

        let rating = 3; // neutral default

        if (sentiment === 'positive') {
          rating += 1;
        } else if (sentiment === 'negative') {
          rating -= 1;
        }

        if (resolutionTime < expectedTime) {
          rating = Math.min(5, rating + 1);
        } else if (resolutionTime > expectedTime * 2) {
          rating = Math.max(1, rating - 1);
        }

        totalRating += rating;
        metrics.ratings[rating] = (metrics.ratings[rating] || 0) + 1;
      }

      metrics.averageRating = Math.round((totalRating / resolvedTickets.length) * 10) / 10;
    }

    return metrics;
  }

  /**
   * Collect knowledge base metrics
   */
  collectKnowledgeMetrics() {
    if (!this.knowledgeBase) {
      return null;
    }

    const kbStats = this.knowledgeBase.getStatistics();

    return {
      totalArticles: kbStats.totalArticles,
      publishedArticles: kbStats.publishedArticles,
      draftArticles: kbStats.draftArticles,
      totalViews: kbStats.totalViews,
      averageRating: Math.round(kbStats.averageRating * 100) / 100,
      categories: kbStats.categories.length,
      faqCount: kbStats.faqCount,
      mostViewedArticle: kbStats.mostViewedArticle?.title,
      topSolutions: kbStats.solutionStats?.slice(0, 5) || []
    };
  }

  /**
   * Check alert thresholds
   */
  checkAlertThresholds(metrics) {
    const alerts = [];

    // SLA breach rate
    if (metrics.sla && metrics.sla.breachRate > this.alertThresholds.slaBreachRate) {
      alerts.push({
        type: 'high-sla-breach-rate',
        severity: 'high',
        message: `SLA breach rate is ${metrics.sla.breachRate}%, exceeds threshold of ${this.alertThresholds.slaBreachRate}%`,
        timestamp: new Date().toISOString()
      });
    }

    // Critical ticket count
    if (metrics.tickets.byPriority.critical > this.alertThresholds.criticalTicketCount) {
      alerts.push({
        type: 'high-critical-count',
        severity: 'critical',
        message: `${metrics.tickets.byPriority.critical} critical tickets pending`,
        timestamp: new Date().toISOString()
      });
    }

    // Open ticket count
    if (metrics.tickets.byStatus.open > this.alertThresholds.openTicketCount) {
      alerts.push({
        type: 'high-open-count',
        severity: 'medium',
        message: `${metrics.tickets.byStatus.open} open tickets, exceeds threshold of ${this.alertThresholds.openTicketCount}`,
        timestamp: new Date().toISOString()
      });
    }

    // Average resolution time
    if (metrics.sla && metrics.sla.averageResolutionTime > this.alertThresholds.averageResolutionTime) {
      alerts.push({
        type: 'slow-resolution',
        severity: 'medium',
        message: `Average resolution time is ${metrics.sla.averageResolutionTime} minutes`,
        timestamp: new Date().toISOString()
      });
    }

    // Escalation rate
    if (metrics.escalations && metrics.escalations.total > 0) {
      const escalationRate = (metrics.escalations.total / metrics.tickets.total) * 100;
      if (escalationRate > this.alertThresholds.escalationRate) {
        alerts.push({
          type: 'high-escalation-rate',
          severity: 'medium',
          message: `${escalationRate.toFixed(1)}% escalation rate, exceeds threshold of ${this.alertThresholds.escalationRate}%`,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Customer satisfaction
    if (metrics.satisfaction && metrics.satisfaction.averageRating < this.alertThresholds.customerSatisfaction / 20) {
      alerts.push({
        type: 'low-satisfaction',
        severity: 'high',
        message: `Customer satisfaction rating is ${metrics.satisfaction.averageRating}/5`,
        timestamp: new Date().toISOString()
      });
    }

    // Emit new alerts
    for (const alert of alerts) {
      if (!this.alerts.some(a =>
        a.type === alert.type &&
        new Date(a.timestamp).getTime() > Date.now() - 3600000 // Within 1 hour
      )) {
        this.alerts.push(alert);
        this.emit('alert', alert);
      }
    }
  }

  /**
   * Get real-time dashboard
   */
  getRealTimeDashboard() {
    const latestMetrics = Array.from(this.metrics.values()).pop();

    if (!latestMetrics) {
      return { message: 'No metrics available yet' };
    }

    return {
      timestamp: latestMetrics.timestamp,
      summary: {
        openTickets: latestMetrics.tickets.byStatus.open || 0,
        criticalTickets: latestMetrics.tickets.byPriority.critical || 0,
        averageResolutionTime: latestMetrics.sla?.averageResolutionTime || 0,
        slaComplianceRate: latestMetrics.sla
          ? 100 - latestMetrics.sla.breachRate
          : 100,
        customerSatisfaction: latestMetrics.satisfaction?.averageRating || 0,
        teamUtilization: this.calculateTeamUtilization(latestMetrics)
      },
      alerts: this.alerts.slice(-10),
      details: latestMetrics
    };
  }

  /**
   * Calculate team utilization
   */
  calculateTeamUtilization(metrics) {
    if (!metrics.team || !metrics.team.teams) {
      return 0;
    }

    const totalUtilization = metrics.team.teams.reduce((sum, t) => sum + t.utilizationPercent, 0);
    return Math.round(totalUtilization / metrics.team.teams.length);
  }

  /**
   * Get trend data
   */
  getTrendData(days = 7) {
    const metricsArray = Array.from(this.metrics.values());
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const relevantMetrics = metricsArray.filter(m => m.timestamp > cutoffDate);

    if (relevantMetrics.length === 0) {
      return { message: 'No trend data available' };
    }

    const trend = {
      period: `Last ${days} days`,
      dataPoints: [],
      summary: {
        totalTickets: 0,
        totalResolved: 0,
        averageSLACompliance: 0,
        averageSatisfaction: 0
      }
    };

    let slaTotal = 0;
    let satisfactionTotal = 0;
    let slaCount = 0;
    let satisfactionCount = 0;

    for (const metrics of relevantMetrics) {
      const point = {
        timestamp: metrics.timestamp,
        openTickets: metrics.tickets.byStatus.open || 0,
        resolvedToday: metrics.tickets.resolvedToday || 0,
        slaComplianceRate: metrics.sla ? 100 - metrics.sla.breachRate : 100,
        satisfaction: metrics.satisfaction?.averageRating || 0,
        escalations: metrics.escalations?.total || 0
      };

      trend.dataPoints.push(point);
      trend.summary.totalResolved += point.resolvedToday;

      if (metrics.sla) {
        slaTotal += point.slaComplianceRate;
        slaCount += 1;
      }

      if (metrics.satisfaction) {
        satisfactionTotal += point.satisfaction;
        satisfactionCount += 1;
      }
    }

    trend.summary.totalTickets = this.ticketManager.tickets.size;
    trend.summary.averageSLACompliance = slaCount > 0 ? Math.round(slaTotal / slaCount) : 100;
    trend.summary.averageSatisfaction = satisfactionCount > 0
      ? Math.round((satisfactionTotal / satisfactionCount) * 10) / 10
      : 0;

    return trend;
  }

  /**
   * Get team performance report
   */
  getTeamPerformanceReport() {
    if (!this.ticketManager) {
      return null;
    }

    const agents = Array.from(this.ticketManager.agents.values());

    const report = {
      generatedAt: new Date().toISOString(),
      agents: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        team: agent.team,
        status: agent.status,
        currentTickets: agent.currentTickets.length,
        totalTickets: agent.performance.totalTickets,
        resolvedTickets: agent.performance.resolvedTickets,
        averageResolutionTime: Math.round(agent.performance.averageResolutionTime),
        resolutionRate: agent.performance.totalTickets > 0
          ? Math.round((agent.performance.resolvedTickets / agent.performance.totalTickets) * 100)
          : 0,
        slaMets: agent.performance.slaMets,
        slaBreaches: agent.performance.slaBreach,
        slaComplianceRate: (agent.performance.slaMets + agent.performance.slaBreach) > 0
          ? Math.round((agent.performance.slaMets / (agent.performance.slaMets + agent.performance.slaBreach)) * 100)
          : 0
      }))
    };

    return report;
  }

  /**
   * Export dashboard data
   */
  exportDashboardData(format = 'json') {
    const dashboard = this.getRealTimeDashboard();
    const trend = this.getTrendData(7);
    const performance = this.getTeamPerformanceReport();

    const data = {
      exportedAt: new Date().toISOString(),
      dashboard,
      trend,
      performance
    };

    if (format === 'csv') {
      return this.convertToCSV(data);
    }

    return data;
  }

  /**
   * Convert data to CSV
   */
  convertToCSV(data) {
    let csv = 'Support Dashboard Export\n';
    csv += `Exported: ${data.exportedAt}\n\n`;

    // Dashboard summary
    csv += 'Dashboard Summary\n';
    for (const [key, value] of Object.entries(data.dashboard.summary)) {
      csv += `${key},${value}\n`;
    }

    csv += '\nTeam Performance\n';
    csv += 'Agent,Team,Current Tickets,Total Tickets,Resolved,Resolution Rate,SLA Compliance\n';

    for (const agent of data.performance.agents) {
      csv += `${agent.name},${agent.team},${agent.currentTickets},${agent.totalTickets},`;
      csv += `${agent.resolvedTickets},${agent.resolutionRate}%,${agent.slaComplianceRate}%\n`;
    }

    return csv;
  }

  /**
   * Get historical comparison
   */
  getHistoricalComparison(periodStart, periodEnd) {
    const metricsArray = Array.from(this.metrics.values());
    const period1 = metricsArray.filter(m =>
      m.timestamp >= periodStart && m.timestamp <= periodEnd
    );

    if (period1.length === 0) {
      return { message: 'No data available for period' };
    }

    const firstMetric = period1[0];
    const lastMetric = period1[period1.length - 1];

    return {
      period: `${periodStart} to ${periodEnd}`,
      ticketTrend: {
        start: firstMetric.tickets.total,
        end: lastMetric.tickets.total,
        change: lastMetric.tickets.total - firstMetric.tickets.total
      },
      slaComplianceTrend: {
        start: firstMetric.sla ? 100 - firstMetric.sla.breachRate : 100,
        end: lastMetric.sla ? 100 - lastMetric.sla.breachRate : 100
      },
      satisfactionTrend: {
        start: firstMetric.satisfaction?.averageRating || 0,
        end: lastMetric.satisfaction?.averageRating || 0
      }
    };
  }

  /**
   * Set alert threshold
   */
  setAlertThreshold(metric, value) {
    if (this.alertThresholds.hasOwnProperty(metric)) {
      this.alertThresholds[metric] = value;
      return { success: true, metric, value };
    }
    return { success: false, error: `Unknown metric: ${metric}` };
  }

  /**
   * Get alert history
   */
  getAlertHistory(type = null, limit = 50) {
    let alerts = [...this.alerts];

    if (type) {
      alerts = alerts.filter(a => a.type === type);
    }

    return alerts.slice(-limit);
  }
}

module.exports = SupportDashboard;
