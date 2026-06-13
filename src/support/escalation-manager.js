/**
 * Escalation Management System
 *
 * Comprehensive escalation workflows, manager notifications, priority override rules,
 * communication templates, and escalation tracking.
 *
 * Features:
 * - Multi-level escalation workflows
 * - Manager and executive notifications
 * - Priority override rules
 * - Escalation templates and automation
 * - Communication history tracking
 * - Escalation metrics and reporting
 * - Escalation delay tracking
 * - Root cause analysis
 */

const EventEmitter = require('events');

class EscalationManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.escalationChains = new Map();
    this.escalationQueues = new Map();
    this.overrideRules = new Map();
    this.templates = new Map();
    this.escalationHistory = [];
    this.managers = new Map();
    this.maxHistorySize = options.maxHistorySize || 5000;

    this.initializeEscalationChains();
    this.initializeTemplates();
    this.initializeManagers();
  }

  /**
   * Initialize escalation chains
   */
  initializeEscalationChains() {
    this.escalationChains.set('critical', [
      {
        level: 1,
        team: 'L2-technical',
        waitTimeMinutes: 0,
        notifyManagers: ['manager-L2'],
        action: 'immediate-assignment'
      },
      {
        level: 2,
        team: 'L3-engineering',
        waitTimeMinutes: 30,
        notifyManagers: ['director-engineering'],
        action: 'escalate-to-engineering'
      },
      {
        level: 3,
        team: 'executive',
        waitTimeMinutes: 60,
        notifyManagers: ['cto', 'ceo'],
        action: 'executive-escalation'
      }
    ]);

    this.escalationChains.set('high', [
      {
        level: 1,
        team: 'L2-technical',
        waitTimeMinutes: 15,
        notifyManagers: ['manager-L2'],
        action: 'escalate-to-L2'
      },
      {
        level: 2,
        team: 'L3-engineering',
        waitTimeMinutes: 60,
        notifyManagers: ['director-engineering'],
        action: 'escalate-to-engineering'
      }
    ]);

    this.escalationChains.set('medium', [
      {
        level: 1,
        team: 'L2-technical',
        waitTimeMinutes: 120,
        notifyManagers: ['manager-L2'],
        action: 'escalate-to-L2'
      }
    ]);

    this.escalationChains.set('low', [
      {
        level: 1,
        team: 'L1-support',
        waitTimeMinutes: 480,
        notifyManagers: ['manager-L1'],
        action: 'reassign'
      }
    ]);
  }

  /**
   * Initialize escalation templates
   */
  initializeTemplates() {
    this.templates.set('escalation-notification', {
      subject: 'ESCALATION: Ticket {ticketId} requires immediate attention',
      body: `
Dear {managerName},

Ticket {ticketId} has been escalated to level {level}.

Issue: {subject}
Customer: {customerName}
Priority: {priority}
Current Status: {status}
Time Since Created: {elapsedTime}

SLA Status:
- Response: {responseStatus}
- Resolution: {resolutionStatus}

Please assign this to an available engineer immediately.

Best regards,
Support System
      `
    });

    this.templates.set('executive-escalation', {
      subject: 'URGENT: Executive Escalation - Ticket {ticketId}',
      body: `
URGENT ESCALATION

Ticket {ticketId} requires executive attention.

Details:
- Issue: {subject}
- Customer: {customerName}
- Priority: {priority}
- Escalation Reason: {escalationReason}
- Time Open: {elapsedTime}

SLA Breaches: {slaBreaches}

Immediate action required.
      `
    });

    this.templates.set('override-notification', {
      subject: 'Priority Override Applied - Ticket {ticketId}',
      body: `
Priority override has been applied to ticket {ticketId}.

Original Priority: {originalPriority}
New Priority: {newPriority}
Reason: {reason}
Applied By: {appliedBy}

This ticket will now follow {newPriority} priority SLA targets.
      `
    });

    this.templates.set('escalation-resolved', {
      subject: 'Escalated Ticket Resolved - {ticketId}',
      body: `
The escalated ticket {ticketId} has been resolved.

Resolution Summary: {resolution}
Total Time to Resolution: {totalTime}
SLA Status: {slaStatus}

Thank you for your support.
      `
    });
  }

  /**
   * Initialize managers
   */
  initializeManagers() {
    this.managers.set('manager-L1', {
      id: 'manager-L1',
      name: 'L1 Support Manager',
      email: 'manager-l1@company.com',
      team: 'L1-support',
      level: 1,
      maxEscalations: 10,
      currentEscalations: 0,
      availability: 'available'
    });

    this.managers.set('manager-L2', {
      id: 'manager-L2',
      name: 'L2 Technical Manager',
      email: 'manager-l2@company.com',
      team: 'L2-technical',
      level: 2,
      maxEscalations: 8,
      currentEscalations: 0,
      availability: 'available'
    });

    this.managers.set('director-engineering', {
      id: 'director-engineering',
      name: 'Engineering Director',
      email: 'director@company.com',
      team: 'L3-engineering',
      level: 3,
      maxEscalations: 5,
      currentEscalations: 0,
      availability: 'available'
    });

    this.managers.set('cto', {
      id: 'cto',
      name: 'Chief Technology Officer',
      email: 'cto@company.com',
      team: 'executive',
      level: 4,
      maxEscalations: 3,
      currentEscalations: 0,
      availability: 'available'
    });

    this.managers.set('ceo', {
      id: 'ceo',
      name: 'Chief Executive Officer',
      email: 'ceo@company.com',
      team: 'executive',
      level: 5,
      maxEscalations: 1,
      currentEscalations: 0,
      availability: 'available'
    });
  }

  /**
   * Escalate ticket
   */
  async escalateTicket(ticketId, ticket, reason = '') {
    try {
      if (!ticket) {
        return { success: false, error: 'Ticket not found' };
      }

      const priority = ticket.priority || 'high';
      const chain = this.escalationChains.get(priority);

      if (!chain) {
        return { success: false, error: `No escalation chain for priority ${priority}` };
      }

      // Determine escalation level
      const currentLevel = ticket.escalations?.length || 0;
      const nextLevel = Math.min(currentLevel, chain.length - 1);
      const escalationStep = chain[nextLevel];

      if (!escalationStep) {
        return { success: false, error: 'Escalation chain exhausted' };
      }

      // Create escalation record
      const escalation = {
        id: `ESC-${Date.now()}`,
        ticketId,
        timestamp: new Date().toISOString(),
        level: escalationStep.level,
        fromTeam: ticket.assignedTeam,
        toTeam: escalationStep.team,
        reason,
        status: 'escalated',
        notifiedManagers: [],
        resolution: null
      };

      // Add to queue
      if (!this.escalationQueues.has(escalationStep.team)) {
        this.escalationQueues.set(escalationStep.team, []);
      }

      this.escalationQueues.get(escalationStep.team).push({
        ticketId,
        escalation,
        addedAt: new Date().toISOString()
      });

      // Notify managers
      for (const managerId of escalationStep.notifyManagers) {
        const manager = this.managers.get(managerId);
        if (manager && manager.availability === 'available') {
          await this.notifyManager(manager, ticket, escalation);
          escalation.notifiedManagers.push(managerId);
          manager.currentEscalations += 1;
        }
      }

      // Log escalation
      this.escalationHistory.push(escalation);
      if (this.escalationHistory.length > this.maxHistorySize) {
        this.escalationHistory.shift();
      }

      this.emit('ticket-escalated', {
        ticketId,
        escalation,
        notifiedManagers: escalation.notifiedManagers
      });

      return {
        success: true,
        escalation,
        queue: this.escalationQueues.get(escalationStep.team)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Notify manager of escalation
   */
  async notifyManager(manager, ticket, escalation) {
    const notification = {
      id: `NOTIF-${Date.now()}`,
      manager: manager.id,
      managerEmail: manager.email,
      ticket: ticket.id,
      escalation: escalation.id,
      subject: this.renderTemplate('escalation-notification', {
        ticketId: ticket.id,
        managerName: manager.name,
        level: escalation.level,
        subject: ticket.subject,
        customerName: ticket.userId,
        priority: ticket.priority,
        status: ticket.status,
        elapsedTime: this.formatDuration(Date.now() - new Date(ticket.createdAt))
      }).subject,
      timestamp: new Date().toISOString(),
      sent: true,
      acknowledged: false
    };

    this.emit('manager-notified', notification);

    return notification;
  }

  /**
   * Apply priority override
   */
  async applyPriorityOverride(ticketId, ticket, newPriority, reason, appliedBy) {
    try {
      if (!ticket) {
        return { success: false, error: 'Ticket not found' };
      }

      const override = {
        id: `OVERRIDE-${Date.now()}`,
        ticketId,
        timestamp: new Date().toISOString(),
        originalPriority: ticket.priority,
        newPriority,
        reason,
        appliedBy,
        status: 'active'
      };

      // Track override
      if (!this.overrideRules.has(ticketId)) {
        this.overrideRules.set(ticketId, []);
      }

      this.overrideRules.get(ticketId).push(override);

      // Update ticket priority
      ticket.priority = newPriority;
      ticket.updatedAt = new Date().toISOString();

      // Notify affected parties
      const notificationData = {
        ticketId,
        originalPriority: override.originalPriority,
        newPriority,
        reason,
        appliedBy
      };

      this.emit('priority-override-applied', override);

      return {
        success: true,
        override,
        ticket
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get escalation queue for team
   */
  getEscalationQueue(team) {
    return this.escalationQueues.get(team) || [];
  }

  /**
   * Process escalation queue
   */
  async processEscalationQueue(team) {
    const queue = this.getEscalationQueue(team);

    if (queue.length === 0) {
      return { success: true, processed: 0 };
    }

    let processed = 0;

    while (queue.length > 0) {
      const item = queue.shift();

      // Attempt to assign to available agent
      const assigned = await this.assignEscalationToAgent(team, item);

      if (assigned) {
        item.escalation.status = 'assigned';
        processed += 1;
      } else {
        // Return to queue if no available agent
        queue.push(item);
        break;
      }
    }

    return {
      success: true,
      processed,
      remaining: queue.length
    };
  }

  /**
   * Assign escalation to agent
   */
  async assignEscalationToAgent(team, escalationItem) {
    // This would integrate with ticket manager to find available agent
    // For now, return success
    return true;
  }

  /**
   * Resolve escalation
   */
  async resolveEscalation(escalationId, resolution) {
    const escalation = this.escalationHistory.find(e => e.id === escalationId);

    if (!escalation) {
      return { success: false, error: 'Escalation not found' };
    }

    escalation.status = 'resolved';
    escalation.resolution = resolution;
    escalation.resolvedAt = new Date().toISOString();

    // Reduce manager load
    const chain = this.escalationChains.get('high'); // Default
    for (const managerId of escalation.notifiedManagers) {
      const manager = this.managers.get(managerId);
      if (manager) {
        manager.currentEscalations = Math.max(0, manager.currentEscalations - 1);
      }
    }

    this.emit('escalation-resolved', escalation);

    return { success: true, escalation };
  }

  /**
   * Get escalation history for ticket
   */
  getEscalationHistory(ticketId) {
    return this.escalationHistory.filter(e => e.ticketId === ticketId);
  }

  /**
   * Get manager statistics
   */
  getManagerStats(managerId) {
    const manager = this.managers.get(managerId);
    if (!manager) {
      return null;
    }

    const managerEscalations = this.escalationHistory.filter(e =>
      e.notifiedManagers.includes(managerId)
    );

    const resolved = managerEscalations.filter(e => e.status === 'resolved');
    const pending = managerEscalations.filter(e => e.status !== 'resolved');

    return {
      manager,
      totalEscalations: managerEscalations.length,
      resolvedEscalations: resolved.length,
      pendingEscalations: pending.length,
      averageResolutionTime: resolved.length > 0
        ? Math.round(
          resolved.reduce((sum, e) => {
            const created = new Date(e.timestamp);
            const resolved = new Date(e.resolvedAt);
            return sum + (resolved - created);
          }, 0) / resolved.length / (1000 * 60)
        )
        : 0
    };
  }

  /**
   * Get escalation metrics
   */
  getMetrics() {
    const escalations = this.escalationHistory;

    const metrics = {
      total: escalations.length,
      byLevel: {},
      byReason: {},
      averageTimeToEscalation: 0,
      averageTimeToResolution: 0,
      resolutionRate: 0,
      unresolved: 0
    };

    // By level
    for (let level = 1; level <= 5; level++) {
      metrics.byLevel[level] = escalations.filter(e => e.level === level).length;
    }

    // By reason
    for (const escalation of escalations) {
      const reason = escalation.reason || 'unspecified';
      metrics.byReason[reason] = (metrics.byReason[reason] || 0) + 1;
    }

    // Timing metrics
    const resolved = escalations.filter(e => e.status === 'resolved');
    const unresolved = escalations.filter(e => e.status !== 'resolved');

    metrics.unresolved = unresolved.length;
    metrics.resolutionRate = escalations.length > 0
      ? Math.round((resolved.length / escalations.length) * 100)
      : 0;

    if (resolved.length > 0) {
      const totalResolutionTime = resolved.reduce((sum, e) => {
        const created = new Date(e.timestamp);
        const resolved = new Date(e.resolvedAt);
        return sum + (resolved - created);
      }, 0);

      metrics.averageTimeToResolution = Math.round(
        totalResolutionTime / resolved.length / (1000 * 60)
      );
    }

    return metrics;
  }

  /**
   * Render template with data
   */
  renderTemplate(templateName, data) {
    const template = this.templates.get(templateName);
    if (!template) {
      return { subject: '', body: '' };
    }

    let subject = template.subject;
    let body = template.body;

    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{${key}}`;
      subject = subject.replace(placeholder, value);
      body = body.replace(placeholder, value);
    }

    return { subject, body };
  }

  /**
   * Format duration
   */
  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ${hours % 24} hour${(hours % 24) !== 1 ? 's' : ''}`;
    }
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes % 60} minute${(minutes % 60) !== 1 ? 's' : ''}`;
    }
    if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  }

  /**
   * Get overview
   */
  getOverview() {
    return {
      totalEscalations: this.escalationHistory.length,
      unresolved: this.escalationHistory.filter(e => e.status !== 'resolved').length,
      managers: Array.from(this.managers.values()).map(m => ({
        name: m.name,
        currentLoad: m.currentEscalations,
        maxCapacity: m.maxEscalations,
        availability: m.availability
      })),
      queues: Array.from(this.escalationQueues.entries()).map(([team, queue]) => ({
        team,
        pending: queue.length
      })),
      metrics: this.getMetrics()
    };
  }
}

module.exports = EscalationManager;
