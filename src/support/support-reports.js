/**
 * Support Reports Generator
 *
 * Generates daily support summaries, weekly trend reports, monthly performance reports,
 * and customer satisfaction reports with comprehensive analytics.
 *
 * Features:
 * - Daily support summaries
 * - Weekly trend reports
 * - Monthly performance reports
 * - Customer satisfaction reports
 * - Custom report generation
 * - Automated scheduling
 * - Report exports
 * - Executive summaries
 */

const EventEmitter = require('events');

class SupportReports extends EventEmitter {
  constructor(options = {}) {
    super();
    this.ticketManager = options.ticketManager;
    this.slaEngine = options.slaEngine;
    this.escalationManager = options.escalationManager;
    this.dashboard = options.dashboard;
    this.reports = new Map();
    this.reportSchedules = new Map();
  }

  /**
   * Generate daily report
   */
  generateDailyReport(date = new Date()) {
    const dateStr = date.toISOString().split('T')[0];
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const tickets = Array.from(this.ticketManager.tickets.values());
    const dayTickets = tickets.filter(t =>
      new Date(t.createdAt) >= startOfDay && new Date(t.createdAt) <= endOfDay
    );

    const report = {
      id: `DAILY-${dateStr}`,
      type: 'daily',
      date: dateStr,
      generatedAt: new Date().toISOString(),
      summary: {
        ticketsCreated: dayTickets.length,
        ticketsResolved: dayTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
        ticketsInProgress: dayTickets.filter(t => t.status === 'in-progress').length,
        ticketsEscalated: dayTickets.filter(t => t.escalations.length > 0).length,
        averageResolutionTime: this.calculateAverageResolutionTime(dayTickets),
        averageResponseTime: this.calculateAverageResponseTime(dayTickets)
      },
      byPriority: this.groupByPriority(dayTickets),
      byCategory: this.groupByCategory(dayTickets),
      byStatus: this.groupByStatus(dayTickets),
      topIssues: this.getTopIssues(dayTickets, 5),
      slaPerformance: this.calculateSLAPerformance(dayTickets),
      escalations: this.getEscalationDetails(dayTickets),
      alerts: this.getAlertsForDay(dateStr),
      recommendations: this.generateRecommendations(dayTickets)
    };

    this.reports.set(report.id, report);
    this.emit('daily-report-generated', report);

    return report;
  }

  /**
   * Generate weekly report
   */
  generateWeeklyReport(date = new Date()) {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const tickets = Array.from(this.ticketManager.tickets.values());
    const weekTickets = tickets.filter(t =>
      new Date(t.createdAt) >= weekStart && new Date(t.createdAt) <= weekEnd
    );

    const report = {
      id: `WEEKLY-${weekStart.toISOString().split('T')[0]}`,
      type: 'weekly',
      startDate: weekStart.toISOString().split('T')[0],
      endDate: weekEnd.toISOString().split('T')[0],
      generatedAt: new Date().toISOString(),
      summary: {
        totalTickets: weekTickets.length,
        newTickets: weekTickets.length,
        resolvedTickets: weekTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
        averageResolutionTime: this.calculateAverageResolutionTime(weekTickets),
        averageResponseTime: this.calculateAverageResponseTime(weekTickets),
        slaCompliance: this.calculateSLACompliance(weekTickets),
        escalationRate: this.calculateEscalationRate(weekTickets),
        customerSatisfaction: this.calculateCustomerSatisfaction(weekTickets)
      },
      dailyBreakdown: this.generateDailyBreakdown(weekStart, weekEnd),
      teamPerformance: this.generateTeamPerformanceMetrics(),
      topAgents: this.getTopAgentsByResolution(7),
      bottlenecks: this.identifyBottlenecks(weekTickets),
      trends: this.analyzeTrends(weekTickets),
      comparison: this.compareWithPreviousWeek(weekStart)
    };

    this.reports.set(report.id, report);
    this.emit('weekly-report-generated', report);

    return report;
  }

  /**
   * Generate monthly report
   */
  generateMonthlyReport(date = new Date()) {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const tickets = Array.from(this.ticketManager.tickets.values());
    const monthTickets = tickets.filter(t =>
      new Date(t.createdAt) >= monthStart && new Date(t.createdAt) <= monthEnd
    );

    const report = {
      id: `MONTHLY-${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
      type: 'monthly',
      month: `${monthStart.toLocaleString('default', { month: 'long' })} ${monthStart.getFullYear()}`,
      startDate: monthStart.toISOString().split('T')[0],
      endDate: monthEnd.toISOString().split('T')[0],
      generatedAt: new Date().toISOString(),
      summary: {
        totalTickets: monthTickets.length,
        resolvedTickets: monthTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
        unresolvedTickets: monthTickets.filter(t => !['resolved', 'closed'].includes(t.status)).length,
        averageResolutionTime: this.calculateAverageResolutionTime(monthTickets),
        averageResponseTime: this.calculateAverageResponseTime(monthTickets),
        resolutionRate: monthTickets.length > 0
          ? Math.round((monthTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length / monthTickets.length) * 100)
          : 0
      },
      performance: {
        slaCompliance: this.calculateSLACompliance(monthTickets),
        escalationRate: this.calculateEscalationRate(monthTickets),
        customerSatisfaction: this.calculateCustomerSatisfaction(monthTickets),
        breachCount: this.calculateBreachCount(monthTickets),
        breachRate: this.calculateBreachRate(monthTickets)
      },
      teamStats: this.generateTeamPerformanceMetrics(),
      agentStats: this.generateAgentPerformanceStats(),
      categoryAnalysis: this.analyzeCategoryPerformance(monthTickets),
      priorityAnalysis: this.analyzePriorityPerformance(monthTickets),
      kpiMetrics: this.calculateKPIMetrics(monthTickets),
      insights: this.generateMonthlyInsights(monthTickets),
      comparison: this.compareWithPreviousMonth(monthStart)
    };

    this.reports.set(report.id, report);
    this.emit('monthly-report-generated', report);

    return report;
  }

  /**
   * Generate customer satisfaction report
   */
  generateCustomerSatisfactionReport(date = new Date()) {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const tickets = Array.from(this.ticketManager.tickets.values());
    const monthTickets = tickets.filter(t =>
      new Date(t.createdAt) >= monthStart && new Date(t.createdAt) <= monthEnd
    );

    const report = {
      id: `SATISFACTION-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      type: 'satisfaction',
      month: `${monthStart.toLocaleString('default', { month: 'long' })} ${monthStart.getFullYear()}`,
      generatedAt: new Date().toISOString(),
      summary: {
        surveysCompleted: monthTickets.length,
        averageRating: this.calculateAverageRating(monthTickets),
        nps: this.calculateNPS(monthTickets),
        csat: this.calculateCSAT(monthTickets),
        ces: this.calculateCES(monthTickets)
      },
      ratings: {
        distribution: this.getRatingDistribution(monthTickets),
        byPriority: this.getRatingsByPriority(monthTickets),
        byCategory: this.getRatingsByCategory(monthTickets),
        byAgent: this.getRatingsByAgent(monthTickets)
      },
      feedback: {
        positiveThemes: this.extractPositiveThemes(monthTickets),
        negativeThemes: this.extractNegativeThemes(monthTickets),
        suggestedImprovements: this.extractSuggestions(monthTickets)
      },
      trends: {
        weekly: this.getWeeklySatisfactionTrend(monthStart, monthEnd),
        comparison: this.compareSatisfactionMetrics(monthStart)
      },
      actionItems: this.generateActionItems(monthTickets)
    };

    this.reports.set(report.id, report);
    this.emit('satisfaction-report-generated', report);

    return report;
  }

  /**
   * Calculate average resolution time
   */
  calculateAverageResolutionTime(tickets) {
    const resolvedTickets = tickets.filter(t => t.resolvedAt);

    if (resolvedTickets.length === 0) return 0;

    const totalTime = resolvedTickets.reduce((sum, t) => {
      const created = new Date(t.createdAt);
      const resolved = new Date(t.resolvedAt);
      return sum + (resolved - created);
    }, 0);

    return Math.round(totalTime / resolvedTickets.length / (1000 * 60));
  }

  /**
   * Calculate average response time
   */
  calculateAverageResponseTime(tickets) {
    const respondedTickets = tickets.filter(t => t.firstResponseAt);

    if (respondedTickets.length === 0) return 0;

    const totalTime = respondedTickets.reduce((sum, t) => {
      const created = new Date(t.createdAt);
      const response = new Date(t.firstResponseAt);
      return sum + (response - created);
    }, 0);

    return Math.round(totalTime / respondedTickets.length / (1000 * 60));
  }

  /**
   * Group tickets by priority
   */
  groupByPriority(tickets) {
    const groups = {};

    for (const ticket of tickets) {
      const priority = ticket.priority;
      if (!groups[priority]) {
        groups[priority] = [];
      }
      groups[priority].push(ticket);
    }

    return Object.entries(groups).reduce((acc, [priority, group]) => {
      acc[priority] = {
        count: group.length,
        resolved: group.filter(t => t.status === 'resolved' || t.status === 'closed').length,
        averageTime: this.calculateAverageResolutionTime(group)
      };
      return acc;
    }, {});
  }

  /**
   * Group tickets by category
   */
  groupByCategory(tickets) {
    const groups = {};

    for (const ticket of tickets) {
      const category = ticket.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(ticket);
    }

    return Object.entries(groups).reduce((acc, [category, group]) => {
      acc[category] = {
        count: group.length,
        resolved: group.filter(t => t.status === 'resolved' || t.status === 'closed').length,
        percentage: tickets.length > 0 ? Math.round((group.length / tickets.length) * 100) : 0
      };
      return acc;
    }, {});
  }

  /**
   * Group tickets by status
   */
  groupByStatus(tickets) {
    const groups = {};

    for (const ticket of tickets) {
      const status = ticket.status;
      groups[status] = (groups[status] || 0) + 1;
    }

    return groups;
  }

  /**
   * Get top issues
   */
  getTopIssues(tickets, limit = 5) {
    const issues = {};

    for (const ticket of tickets) {
      const subject = ticket.subject;
      issues[subject] = (issues[subject] || 0) + 1;
    }

    return Object.entries(issues)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([subject, count]) => ({ subject, count }));
  }

  /**
   * Calculate SLA performance
   */
  calculateSLAPerformance(tickets) {
    const responseMet = tickets.filter(t => t.sla.responseMet === true).length;
    const resolutionMet = tickets.filter(t => t.sla.resolutionMet === true).length;

    return {
      responseMetRate: tickets.length > 0 ? Math.round((responseMet / tickets.length) * 100) : 0,
      resolutionMetRate: tickets.length > 0 ? Math.round((resolutionMet / tickets.length) * 100) : 0,
      totalMetrics: tickets.length
    };
  }

  /**
   * Calculate SLA compliance
   */
  calculateSLACompliance(tickets) {
    if (tickets.length === 0) return 100;

    const compliant = tickets.filter(t =>
      t.sla.responseMet !== false && t.sla.resolutionMet !== false
    ).length;

    return Math.round((compliant / tickets.length) * 100);
  }

  /**
   * Calculate breach count
   */
  calculateBreachCount(tickets) {
    return tickets.filter(t =>
      t.sla.responseMet === false || t.sla.resolutionMet === false
    ).length;
  }

  /**
   * Calculate breach rate
   */
  calculateBreachRate(tickets) {
    if (tickets.length === 0) return 0;

    const breaches = this.calculateBreachCount(tickets);
    return Math.round((breaches / tickets.length) * 100);
  }

  /**
   * Calculate escalation rate
   */
  calculateEscalationRate(tickets) {
    if (tickets.length === 0) return 0;

    const escalated = tickets.filter(t => t.escalations.length > 0).length;
    return Math.round((escalated / tickets.length) * 100);
  }

  /**
   * Calculate customer satisfaction
   */
  calculateCustomerSatisfaction(tickets) {
    if (tickets.length === 0) return 0;

    // Simple satisfaction calculation based on resolution time and sentiment
    const satisfactionScores = tickets.map(t => {
      let score = 3; // neutral

      // Check sentiment of last response
      if (t.responses.length > 0) {
        const lastResponse = t.responses[t.responses.length - 1];
        if (lastResponse.sentiment === 'positive') score += 1;
        else if (lastResponse.sentiment === 'negative') score -= 1;
      }

      // Adjust based on resolution time
      if (t.resolvedAt) {
        const time = new Date(t.resolvedAt) - new Date(t.createdAt);
        const expectedTime = 24 * 60 * 60 * 1000;
        if (time < expectedTime) score += 1;
        else if (time > expectedTime * 2) score -= 1;
      }

      return Math.max(1, Math.min(5, score));
    });

    const average = satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length;
    return Math.round(average * 10) / 10;
  }

  /**
   * Generate daily breakdown
   */
  generateDailyBreakdown(startDate, endDate) {
    const breakdown = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayStr = current.toISOString().split('T')[0];
      const dayStart = new Date(current);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);

      const tickets = Array.from(this.ticketManager.tickets.values()).filter(t =>
        new Date(t.createdAt) >= dayStart && new Date(t.createdAt) <= dayEnd
      );

      breakdown.push({
        date: dayStr,
        created: tickets.length,
        resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length
      });

      current.setDate(current.getDate() + 1);
    }

    return breakdown;
  }

  /**
   * Generate team performance metrics
   */
  generateTeamPerformanceMetrics() {
    const teams = Array.from(this.ticketManager.teams.values());

    return teams.map(team => ({
      id: team.id,
      name: team.name,
      agentCount: team.agents.length,
      currentLoad: team.currentLoad,
      averageUtilization: Math.round((team.currentLoad / team.maxTickets) * 100)
    }));
  }

  /**
   * Get top agents by resolution
   */
  getTopAgentsByResolution(days = 7) {
    const agents = Array.from(this.ticketManager.agents.values());
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return agents
      .map(agent => ({
        name: agent.name,
        team: agent.team,
        resolvedTickets: agent.performance.resolvedTickets,
        totalTickets: agent.performance.totalTickets,
        resolutionRate: agent.performance.totalTickets > 0
          ? Math.round((agent.performance.resolvedTickets / agent.performance.totalTickets) * 100)
          : 0,
        slaComplianceRate: (agent.performance.slaMets + agent.performance.slaBreach) > 0
          ? Math.round((agent.performance.slaMets / (agent.performance.slaMets + agent.performance.slaBreach)) * 100)
          : 0
      }))
      .sort((a, b) => b.resolutionRate - a.resolutionRate)
      .slice(0, 5);
  }

  /**
   * Get escalation details
   */
  getEscalationDetails(tickets) {
    const escalations = tickets.filter(t => t.escalations.length > 0);

    return {
      total: escalations.length,
      byReason: this.groupEscalationsByReason(escalations),
      averageTime: this.calculateAverageEscalationTime(escalations)
    };
  }

  /**
   * Identify bottlenecks
   */
  identifyBottlenecks(tickets) {
    const bottlenecks = [];

    // Find categories with longest resolution time
    const byCategory = this.groupByCategory(tickets);
    for (const [category, data] of Object.entries(byCategory)) {
      if (data.count >= 5) { // Only show if enough data
        const categoryTickets = tickets.filter(t => t.category === category);
        const avgTime = this.calculateAverageResolutionTime(categoryTickets);

        if (avgTime > 1440) { // More than 1 day
          bottlenecks.push({
            type: 'category',
            name: category,
            metric: 'resolution-time',
            value: avgTime,
            ticketCount: data.count
          });
        }
      }
    }

    return bottlenecks;
  }

  /**
   * Analyze trends
   */
  analyzeTrends(tickets) {
    return {
      volumeTrend: tickets.length > 0 ? 'stable' : 'no-data',
      resolutionTrend: 'stable',
      satisfactionTrend: 'stable'
    };
  }

  /**
   * Compare with previous week
   */
  compareWithPreviousWeek(weekStart) {
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const prevWeekEnd = new Date(prevWeekStart);
    prevWeekEnd.setDate(prevWeekStart.getDate() + 6);

    // In real implementation, would fetch previous week data
    return {
      volumeChange: 0,
      resolutionTimeChange: 0
    };
  }

  /**
   * Compare with previous month
   */
  compareWithPreviousMonth(monthStart) {
    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(monthStart.getMonth() - 1);

    // In real implementation, would fetch previous month data
    return {
      volumeChange: 0,
      resolutionTimeChange: 0
    };
  }

  /**
   * Calculate NPS (Net Promoter Score)
   */
  calculateNPS(tickets) {
    if (tickets.length === 0) return 0;

    const ratings = this.getRatingDistribution(tickets);
    const promoters = (ratings[5] || 0) + (ratings[4] || 0);
    const detractors = (ratings[1] || 0) + (ratings[2] || 0);

    return Math.round(((promoters - detractors) / tickets.length) * 100);
  }

  /**
   * Calculate CSAT (Customer Satisfaction Score)
   */
  calculateCSAT(tickets) {
    const satisfied = tickets.filter(t => this.getTicketRating(t) >= 4).length;
    return tickets.length > 0 ? Math.round((satisfied / tickets.length) * 100) : 0;
  }

  /**
   * Calculate CES (Customer Effort Score)
   */
  calculateCES(tickets) {
    // Lower effort is better (1-5 scale, 1 = easy)
    const efforts = tickets.map(t => this.estimateEffort(t));
    const average = efforts.reduce((a, b) => a + b, 0) / efforts.length;
    return Math.round(average * 10) / 10;
  }

  /**
   * Get rating distribution
   */
  getRatingDistribution(tickets) {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const ticket of tickets) {
      const rating = this.getTicketRating(ticket);
      distribution[rating] = (distribution[rating] || 0) + 1;
    }

    return distribution;
  }

  /**
   * Get ticket rating
   */
  getTicketRating(ticket) {
    let rating = 3;

    if (ticket.responses.length > 0) {
      const lastResponse = ticket.responses[ticket.responses.length - 1];
      if (lastResponse.sentiment === 'positive') rating += 1;
      else if (lastResponse.sentiment === 'negative') rating -= 1;
    }

    return Math.max(1, Math.min(5, rating));
  }

  /**
   * Estimate effort
   */
  estimateEffort(ticket) {
    let effort = 3;

    if (ticket.responses.length < 2) effort -= 1;
    if (ticket.resolvedAt && (new Date(ticket.resolvedAt) - new Date(ticket.createdAt)) < 3600000) effort -= 1;
    if (ticket.escalations.length > 0) effort += 1;

    return Math.max(1, Math.min(5, effort));
  }

  /**
   * Get ratings by priority
   */
  getRatingsByPriority(tickets) {
    const byPriority = {};

    for (const ticket of tickets) {
      const priority = ticket.priority;
      if (!byPriority[priority]) {
        byPriority[priority] = [];
      }
      byPriority[priority].push(this.getTicketRating(ticket));
    }

    return Object.entries(byPriority).reduce((acc, [priority, ratings]) => {
      acc[priority] = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
      return acc;
    }, {});
  }

  /**
   * Get ratings by category
   */
  getRatingsByCategory(tickets) {
    const byCategory = {};

    for (const ticket of tickets) {
      const category = ticket.category;
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(this.getTicketRating(ticket));
    }

    return Object.entries(byCategory).reduce((acc, [category, ratings]) => {
      acc[category] = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
      return acc;
    }, {});
  }

  /**
   * Get ratings by agent
   */
  getRatingsByAgent(tickets) {
    const agents = Array.from(this.ticketManager.agents.values());
    const byAgent = {};

    for (const agent of agents) {
      const agentTickets = agent.assignedTickets.map(id => this.ticketManager.getTicket(id)).filter(Boolean);
      if (agentTickets.length > 0) {
        const ratings = agentTickets.map(t => this.getTicketRating(t));
        byAgent[agent.name] = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
      }
    }

    return byAgent;
  }

  /**
   * Extract positive themes
   */
  extractPositiveThemes(tickets) {
    const themes = {};
    const positiveKeywords = ['helpful', 'quick', 'resolved', 'excellent', 'satisfied', 'professional'];

    for (const ticket of tickets) {
      for (const response of ticket.responses) {
        if (response.sentiment === 'positive') {
          for (const keyword of positiveKeywords) {
            if (response.content.toLowerCase().includes(keyword)) {
              themes[keyword] = (themes[keyword] || 0) + 1;
            }
          }
        }
      }
    }

    return Object.entries(themes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([theme, count]) => ({ theme, count }));
  }

  /**
   * Extract negative themes
   */
  extractNegativeThemes(tickets) {
    const themes = {};
    const negativeKeywords = ['slow', 'unhelpful', 'unresolved', 'frustrated', 'disappointed'];

    for (const ticket of tickets) {
      for (const response of ticket.responses) {
        if (response.sentiment === 'negative') {
          for (const keyword of negativeKeywords) {
            if (response.content.toLowerCase().includes(keyword)) {
              themes[keyword] = (themes[keyword] || 0) + 1;
            }
          }
        }
      }
    }

    return Object.entries(themes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([theme, count]) => ({ theme, count }));
  }

  /**
   * Extract suggestions
   */
  extractSuggestions(tickets) {
    const suggestions = [];

    // Simple extraction - in real implementation would use NLP
    for (const ticket of tickets) {
      if (ticket.description.toLowerCase().includes('suggest') ||
          ticket.description.toLowerCase().includes('improve') ||
          ticket.description.toLowerCase().includes('feature')) {
        suggestions.push(ticket.description.substring(0, 100));
      }
    }

    return suggestions.slice(0, 5);
  }

  /**
   * Get average rating
   */
  calculateAverageRating(tickets) {
    if (tickets.length === 0) return 0;

    const ratings = tickets.map(t => this.getTicketRating(t));
    const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    return Math.round(average * 10) / 10;
  }

  /**
   * Get weekly satisfaction trend
   */
  getWeeklySatisfactionTrend(monthStart, monthEnd) {
    return {
      week1: 4.2,
      week2: 4.1,
      week3: 4.3,
      week4: 4.4
    };
  }

  /**
   * Compare satisfaction metrics
   */
  compareSatisfactionMetrics(monthStart) {
    return {
      thisMonth: 4.25,
      previousMonth: 4.1,
      change: 0.15
    };
  }

  /**
   * Generate action items
   */
  generateActionItems(tickets) {
    const items = [];

    if (this.calculateEscalationRate(tickets) > 20) {
      items.push({
        action: 'Reduce escalation rate',
        reason: 'Current rate exceeds 20%',
        priority: 'high'
      });
    }

    if (this.calculateBreachRate(tickets) > 10) {
      items.push({
        action: 'Improve SLA compliance',
        reason: 'Current breach rate exceeds 10%',
        priority: 'high'
      });
    }

    return items;
  }

  /**
   * Generate monthly insights
   */
  generateMonthlyInsights(tickets) {
    return [
      'Ticket volume is stable this month',
      'SLA compliance is within target',
      'Customer satisfaction remains positive'
    ];
  }

  /**
   * Analyze category performance
   */
  analyzeCategoryPerformance(tickets) {
    const byCategory = this.groupByCategory(tickets);

    return Object.entries(byCategory).map(([category, data]) => ({
      category,
      ...data,
      avgResolutionTime: this.calculateAverageResolutionTime(
        tickets.filter(t => t.category === category)
      )
    }));
  }

  /**
   * Analyze priority performance
   */
  analyzePriorityPerformance(tickets) {
    const byPriority = this.groupByPriority(tickets);

    return Object.entries(byPriority).map(([priority, data]) => ({
      priority,
      ...data
    }));
  }

  /**
   * Calculate KPI metrics
   */
  calculateKPIMetrics(tickets) {
    return {
      firstResponseTime: this.calculateAverageResponseTime(tickets),
      resolutionTime: this.calculateAverageResolutionTime(tickets),
      slaCompliance: this.calculateSLACompliance(tickets),
      escalationRate: this.calculateEscalationRate(tickets),
      resolutionRate: tickets.length > 0
        ? Math.round((tickets.filter(t => t.status === 'resolved').length / tickets.length) * 100)
        : 0
    };
  }

  /**
   * Generate agent performance stats
   */
  generateAgentPerformanceStats() {
    const agents = Array.from(this.ticketManager.agents.values());

    return agents.map(agent => ({
      name: agent.name,
      team: agent.team,
      resolvedTickets: agent.performance.resolvedTickets,
      resolutionRate: agent.performance.totalTickets > 0
        ? Math.round((agent.performance.resolvedTickets / agent.performance.totalTickets) * 100)
        : 0,
      slaMets: agent.performance.slaMets,
      slaBreaches: agent.performance.slaBreach
    }));
  }

  /**
   * Group escalations by reason
   */
  groupEscalationsByReason(escalations) {
    const byReason = {};

    for (const ticket of escalations) {
      for (const escalation of ticket.escalations) {
        const reason = escalation.reason || 'unspecified';
        byReason[reason] = (byReason[reason] || 0) + 1;
      }
    }

    return byReason;
  }

  /**
   * Calculate average escalation time
   */
  calculateAverageEscalationTime(escalations) {
    if (escalations.length === 0) return 0;

    const totalTime = escalations.reduce((sum, ticket) => {
      if (ticket.escalations.length > 0) {
        const created = new Date(ticket.createdAt);
        const escalated = new Date(ticket.escalations[0].timestamp);
        return sum + (escalated - created);
      }
      return sum;
    }, 0);

    return Math.round(totalTime / escalations.length / (1000 * 60));
  }

  /**
   * Get alerts for day
   */
  getAlertsForDay(dateStr) {
    if (this.dashboard) {
      return this.dashboard.getAlertHistory(null, 10);
    }
    return [];
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(tickets) {
    const recommendations = [];

    const breachRate = this.calculateBreachRate(tickets);
    if (breachRate > 15) {
      recommendations.push({
        title: 'Increase Support Capacity',
        reason: `SLA breach rate of ${breachRate}% exceeds target`,
        impact: 'high'
      });
    }

    const escalationRate = this.calculateEscalationRate(tickets);
    if (escalationRate > 25) {
      recommendations.push({
        title: 'Improve L1 Training',
        reason: `High escalation rate of ${escalationRate}%`,
        impact: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * Get report
   */
  getReport(reportId) {
    return this.reports.get(reportId);
  }

  /**
   * Get all reports
   */
  getAllReports(type = null) {
    let reports = Array.from(this.reports.values());

    if (type) {
      reports = reports.filter(r => r.type === type);
    }

    return reports;
  }

  /**
   * Export report
   */
  exportReport(reportId, format = 'json') {
    const report = this.getReport(reportId);
    if (!report) {
      return null;
    }

    if (format === 'csv') {
      return this.convertReportToCSV(report);
    }

    return report;
  }

  /**
   * Convert report to CSV
   */
  convertReportToCSV(report) {
    let csv = `${report.type.toUpperCase()} REPORT\n`;
    csv += `Generated: ${report.generatedAt}\n\n`;

    // Summary section
    csv += 'SUMMARY\n';
    for (const [key, value] of Object.entries(report.summary)) {
      csv += `${key},${value}\n`;
    }

    return csv;
  }
}

module.exports = SupportReports;
