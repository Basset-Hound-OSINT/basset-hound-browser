/**
 * SLA Management Engine
 *
 * Comprehensive SLA policy management, real-time compliance tracking,
 * escalation triggers, and detailed metrics and reporting.
 *
 * Features:
 * - Define and manage SLA policies per priority
 * - Real-time SLA compliance tracking
 * - Escalation trigger management
 * - SLA compliance metrics and KPIs
 * - Historical SLA data tracking
 * - Alerts and notifications
 * - Custom SLA rules
 * - SLA breach prediction
 */

const EventEmitter = require('events');

class SLAEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.policies = new Map();
    this.breaches = new Map();
    this.escalationTriggers = new Map();
    this.metrics = new Map();
    this.alerts = [];
    this.checkInterval = options.checkInterval || 60000; // 1 minute
    this.maxAlertsHistory = options.maxAlertsHistory || 1000;
    this.ticketManager = options.ticketManager;

    this.initializeDefaultPolicies();
    this.initializeEscalationTriggers();
    this.startMonitoring();
  }

  /**
   * Initialize default SLA policies
   */
  initializeDefaultPolicies() {
    this.policies.set('critical', {
      priority: 'critical',
      responseTimeMinutes: 60,
      resolutionTimeMinutes: 240, // 4 hours
      escalationSteps: [
        { step: 1, afterMinutes: 30, action: 'notify-manager' },
        { step: 2, afterMinutes: 50, action: 'escalate-to-ceo' }
      ],
      businessHoursOnly: false
    });

    this.policies.set('high', {
      priority: 'high',
      responseTimeMinutes: 240, // 4 hours
      resolutionTimeMinutes: 1440, // 24 hours
      escalationSteps: [
        { step: 1, afterMinutes: 120, action: 'notify-manager' },
        { step: 2, afterMinutes: 240, action: 'escalate-to-senior' }
      ],
      businessHoursOnly: true
    });

    this.policies.set('medium', {
      priority: 'medium',
      responseTimeMinutes: 1440, // 24 hours
      resolutionTimeMinutes: 4320, // 3 days
      escalationSteps: [
        { step: 1, afterMinutes: 720, action: 'notify-manager' }
      ],
      businessHoursOnly: true
    });

    this.policies.set('low', {
      priority: 'low',
      responseTimeMinutes: 2880, // 2 days
      resolutionTimeMinutes: 10080, // 7 days
      escalationSteps: [
        { step: 1, afterMinutes: 5040, action: 'notify-manager' }
      ],
      businessHoursOnly: true
    });
  }

  /**
   * Initialize escalation triggers
   */
  initializeEscalationTriggers() {
    this.escalationTriggers.set('response-approaching', {
      condition: 'responseDeadline - now < 15min',
      action: 'alert',
      priority: 'high'
    });

    this.escalationTriggers.set('response-breached', {
      condition: 'responseDeadline - now < 0',
      action: 'escalate',
      priority: 'critical'
    });

    this.escalationTriggers.set('resolution-approaching', {
      condition: 'resolutionDeadline - now < 1hour',
      action: 'alert',
      priority: 'medium'
    });

    this.escalationTriggers.set('resolution-breached', {
      condition: 'resolutionDeadline - now < 0',
      action: 'escalate',
      priority: 'critical'
    });

    this.escalationTriggers.set('no-progress', {
      condition: 'no status change for 24 hours',
      action: 'alert',
      priority: 'medium'
    });

    this.escalationTriggers.set('customer-waiting', {
      condition: 'status === waiting-customer for > 48 hours',
      action: 'alert',
      priority: 'low'
    });
  }

  /**
   * Get SLA policy
   */
  getPolicy(priority) {
    return this.policies.get(priority);
  }

  /**
   * Create custom SLA policy
   */
  createPolicy(priority, policyData) {
    if (this.policies.has(priority)) {
      return { success: false, error: `Policy for ${priority} already exists` };
    }

    const policy = {
      priority,
      responseTimeMinutes: policyData.responseTimeMinutes,
      resolutionTimeMinutes: policyData.resolutionTimeMinutes,
      escalationSteps: policyData.escalationSteps || [],
      businessHoursOnly: policyData.businessHoursOnly || false,
      createdAt: new Date().toISOString()
    };

    this.policies.set(priority, policy);

    this.emit('policy-created', policy);

    return { success: true, policy };
  }

  /**
   * Update SLA policy
   */
  updatePolicy(priority, updates) {
    const policy = this.policies.get(priority);
    if (!policy) {
      return { success: false, error: `Policy for ${priority} not found` };
    }

    if (updates.responseTimeMinutes) policy.responseTimeMinutes = updates.responseTimeMinutes;
    if (updates.resolutionTimeMinutes) policy.resolutionTimeMinutes = updates.resolutionTimeMinutes;
    if (updates.escalationSteps) policy.escalationSteps = updates.escalationSteps;
    if (updates.businessHoursOnly !== undefined) policy.businessHoursOnly = updates.businessHoursOnly;

    policy.updatedAt = new Date().toISOString();

    this.emit('policy-updated', policy);

    return { success: true, policy };
  }

  /**
   * Calculate SLA deadline
   */
  calculateDeadline(ticket, type = 'resolution') {
    const policy = this.policies.get(ticket.priority);
    if (!policy) {
      return null;
    }

    const minutes = type === 'response'
      ? policy.responseTimeMinutes
      : policy.resolutionTimeMinutes;

    const now = new Date();
    let deadline = new Date(now.getTime() + minutes * 60 * 1000);

    // Adjust for business hours if needed
    if (policy.businessHoursOnly) {
      deadline = this.adjustForBusinessHours(deadline, minutes);
    }

    return deadline;
  }

  /**
   * Adjust deadline for business hours
   */
  adjustForBusinessHours(deadline, minutes) {
    // Business hours: Monday-Friday, 9 AM - 5 PM
    const businessStart = 9;
    const businessEnd = 17;

    let current = new Date(deadline);
    let remainingMinutes = minutes;

    while (remainingMinutes > 0) {
      const dayOfWeek = current.getDay();
      const hour = current.getHours();

      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        current.setDate(current.getDate() + 1);
        current.setHours(businessStart, 0, 0, 0);
        continue;
      }

      // Skip outside business hours
      if (hour < businessStart) {
        current.setHours(businessStart, 0, 0, 0);
        continue;
      }

      if (hour >= businessEnd) {
        current.setDate(current.getDate() + 1);
        current.setHours(businessStart, 0, 0, 0);
        continue;
      }

      // Calculate minutes available until end of business day
      const minutesUntilEnd = (businessEnd - hour) * 60 - current.getMinutes();

      if (minutesUntilEnd >= remainingMinutes) {
        current.setMinutes(current.getMinutes() + remainingMinutes);
        remainingMinutes = 0;
      } else {
        remainingMinutes -= minutesUntilEnd;
        current.setDate(current.getDate() + 1);
        current.setHours(businessStart, 0, 0, 0);
      }
    }

    return current;
  }

  /**
   * Check SLA compliance for ticket
   */
  checkCompliance(ticket) {
    const policy = this.policies.get(ticket.priority);
    if (!policy) {
      return null;
    }

    const now = new Date();
    const responseDeadline = new Date(ticket.sla.responseDeadline);
    const resolutionDeadline = new Date(ticket.sla.resolutionDeadline);

    const compliance = {
      ticketId: ticket.id,
      priority: ticket.priority,
      responseCompliance: this.checkMetric(
        ticket.firstResponseAt,
        responseDeadline,
        now,
        policy.responseTimeMinutes
      ),
      resolutionCompliance: this.checkMetric(
        ticket.resolvedAt,
        resolutionDeadline,
        now,
        policy.resolutionTimeMinutes
      ),
      overallCompliance: 'on-track',
      violations: [],
      escalationRequired: false
    };

    // Check for violations
    if (compliance.responseCompliance.status === 'breached') {
      compliance.violations.push('response-time');
      compliance.overallCompliance = 'breached';
    }

    if (compliance.resolutionCompliance.status === 'breached') {
      compliance.violations.push('resolution-time');
      compliance.overallCompliance = 'breached';
    }

    // Check for escalation need
    if (compliance.responseCompliance.status === 'approaching' ||
        compliance.resolutionCompliance.status === 'approaching' ||
        compliance.overallCompliance === 'breached') {
      compliance.escalationRequired = true;
    }

    // Track breach
    if (compliance.overallCompliance === 'breached') {
      this.recordBreach(ticket.id, compliance);
    }

    return compliance;
  }

  /**
   * Check single metric (response or resolution)
   */
  checkMetric(completedAt, deadline, now, totalMinutes) {
    if (completedAt) {
      const actualTime = new Date(completedAt);
      if (actualTime <= deadline) {
        return {
          status: 'met',
          actualMinutes: Math.round((actualTime - new Date(deadline.getTime() - totalMinutes * 60 * 1000)) / (1000 * 60)),
          deadlineMinutes: totalMinutes
        };
      } else {
        return {
          status: 'breached',
          actualMinutes: Math.round((actualTime - new Date(deadline.getTime() - totalMinutes * 60 * 1000)) / (1000 * 60)),
          deadlineMinutes: totalMinutes,
          breachMinutes: Math.round((actualTime - deadline) / (1000 * 60))
        };
      }
    }

    const timeRemaining = deadline - now;
    const percentComplete = ((totalMinutes * 60 * 1000 - timeRemaining) / (totalMinutes * 60 * 1000)) * 100;

    if (timeRemaining < 0) {
      return {
        status: 'breached',
        timeRemaining: 0,
        breachMinutes: Math.round(-timeRemaining / (1000 * 60))
      };
    }

    if (timeRemaining < 15 * 60 * 1000) { // 15 minutes
      return {
        status: 'approaching',
        timeRemaining: Math.round(timeRemaining / (1000 * 60)),
        percentComplete
      };
    }

    return {
      status: 'on-track',
      timeRemaining: Math.round(timeRemaining / (1000 * 60)),
      percentComplete
    };
  }

  /**
   * Record SLA breach
   */
  recordBreach(ticketId, compliance) {
    const breach = {
      ticketId,
      timestamp: new Date().toISOString(),
      compliance,
      acknowledged: false,
      notes: ''
    };

    this.breaches.set(ticketId, breach);

    this.emit('sla-breach-recorded', breach);
  }

  /**
   * Get SLA breaches
   */
  getBreaches(options = {}) {
    let breaches = Array.from(this.breaches.values());

    if (options.acknowledged === false) {
      breaches = breaches.filter(b => !b.acknowledged);
    }

    if (options.limit) {
      breaches = breaches.slice(-options.limit);
    }

    return breaches;
  }

  /**
   * Acknowledge breach
   */
  acknowledgeBreach(ticketId, notes = '') {
    const breach = this.breaches.get(ticketId);
    if (!breach) {
      return { success: false, error: 'Breach not found' };
    }

    breach.acknowledged = true;
    breach.acknowledgedAt = new Date().toISOString();
    breach.notes = notes;

    this.emit('breach-acknowledged', breach);

    return { success: true, breach };
  }

  /**
   * Start SLA monitoring
   */
  startMonitoring() {
    setInterval(() => {
      if (this.ticketManager) {
        const tickets = Array.from(this.ticketManager.tickets.values());

        for (const ticket of tickets) {
          if (['open', 'assigned', 'in-progress', 'waiting-customer'].includes(ticket.status)) {
            const compliance = this.checkCompliance(ticket);

            if (compliance && compliance.escalationRequired) {
              this.handleEscalation(ticket, compliance);
            }
          }
        }
      }
    }, this.checkInterval);
  }

  /**
   * Handle escalation
   */
  handleEscalation(ticket, compliance) {
    const policy = this.policies.get(ticket.priority);
    if (!policy) return;

    const now = new Date();
    const responseDeadline = new Date(ticket.sla.responseDeadline);

    // Determine escalation step
    const timeOverdue = Math.round((now - responseDeadline) / (1000 * 60));

    for (const step of policy.escalationSteps) {
      if (timeOverdue >= step.afterMinutes && !ticket.escalations.some(e => e.step === step.step)) {
        this.triggerEscalation(ticket, step, compliance);
      }
    }
  }

  /**
   * Trigger escalation action
   */
  triggerEscalation(ticket, step, compliance) {
    const alert = {
      id: `ALERT-${Date.now()}`,
      type: 'escalation',
      ticketId: ticket.id,
      step: step.step,
      action: step.action,
      timestamp: new Date().toISOString(),
      compliance,
      addressed: false
    };

    this.alerts.push(alert);

    if (this.alerts.length > this.maxAlertsHistory) {
      this.alerts.shift();
    }

    this.emit('escalation-triggered', alert);

    return alert;
  }

  /**
   * Get metrics
   */
  getMetrics(options = {}) {
    if (!this.ticketManager) {
      return {};
    }

    const tickets = Array.from(this.ticketManager.tickets.values());
    const metrics = {
      total: tickets.length,
      byPriority: {},
      compliance: {
        responseMet: 0,
        responseBreached: 0,
        resolutionMet: 0,
        resolutionBreached: 0
      },
      averageResponseTime: 0,
      averageResolutionTime: 0,
      breachRate: 0,
      trends: []
    };

    // Calculate by priority
    for (const priority of ['critical', 'high', 'medium', 'low']) {
      const priorityTickets = tickets.filter(t => t.priority === priority);
      metrics.byPriority[priority] = {
        total: priorityTickets.length,
        compliant: 0,
        breached: 0
      };

      for (const ticket of priorityTickets) {
        const compliance = this.checkCompliance(ticket);
        if (compliance.overallCompliance === 'breached') {
          metrics.byPriority[priority].breached += 1;
        } else {
          metrics.byPriority[priority].compliant += 1;
        }
      }
    }

    // Calculate compliance stats
    const respondedTickets = tickets.filter(t => t.firstResponseAt);
    const resolvedTickets = tickets.filter(t => t.resolvedAt);

    for (const ticket of respondedTickets) {
      const responseDeadline = new Date(ticket.sla.responseDeadline);
      const firstResponse = new Date(ticket.firstResponseAt);

      if (firstResponse <= responseDeadline) {
        metrics.compliance.responseMet += 1;
      } else {
        metrics.compliance.responseBreached += 1;
      }
    }

    for (const ticket of resolvedTickets) {
      const resolutionDeadline = new Date(ticket.sla.resolutionDeadline);
      const resolved = new Date(ticket.resolvedAt);

      if (resolved <= resolutionDeadline) {
        metrics.compliance.resolutionMet += 1;
      } else {
        metrics.compliance.resolutionBreached += 1;
      }
    }

    // Calculate averages
    if (respondedTickets.length > 0) {
      const totalResponseTime = respondedTickets.reduce((sum, t) => {
        const created = new Date(t.createdAt);
        const response = new Date(t.firstResponseAt);
        return sum + (response - created);
      }, 0);
      metrics.averageResponseTime = Math.round(totalResponseTime / respondedTickets.length / (1000 * 60));
    }

    if (resolvedTickets.length > 0) {
      const totalResolutionTime = resolvedTickets.reduce((sum, t) => {
        const created = new Date(t.createdAt);
        const resolved = new Date(t.resolvedAt);
        return sum + (resolved - created);
      }, 0);
      metrics.averageResolutionTime = Math.round(totalResolutionTime / resolvedTickets.length / (1000 * 60));
    }

    // Breach rate
    const breachedTickets = tickets.filter(t => {
      const compliance = this.checkCompliance(t);
      return compliance && compliance.overallCompliance === 'breached';
    });

    metrics.breachRate = tickets.length > 0
      ? Math.round((breachedTickets.length / tickets.length) * 100)
      : 0;

    return metrics;
  }

  /**
   * Get alerts
   */
  getAlerts(options = {}) {
    let alerts = [...this.alerts];

    if (options.addressed === false) {
      alerts = alerts.filter(a => !a.addressed);
    }

    if (options.type) {
      alerts = alerts.filter(a => a.type === options.type);
    }

    if (options.limit) {
      alerts = alerts.slice(-options.limit);
    }

    return alerts;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) {
      return { success: false, error: 'Alert not found' };
    }

    alert.addressed = true;
    alert.addressedAt = new Date().toISOString();

    this.emit('alert-acknowledged', alert);

    return { success: true, alert };
  }

  /**
   * Get SLA summary
   */
  getSummary() {
    const metrics = this.getMetrics();
    const breaches = this.getBreaches({ acknowledged: false });
    const alerts = this.getAlerts({ addressed: false });

    return {
      metrics,
      unresolvedBreaches: breaches.length,
      unaddressedAlerts: alerts.length,
      overallComplianceRate: 100 - metrics.breachRate,
      summary: `${metrics.byPriority.critical?.compliant || 0} critical, ${metrics.byPriority.high?.compliant || 0} high priority tickets on track`
    };
  }
}

module.exports = SLAEngine;
