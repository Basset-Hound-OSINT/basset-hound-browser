/**
 * Support Ticketing System
 *
 * Manages self-service ticket creation, tracking, SLA monitoring,
 * auto-responses, and escalation management.
 */

const EventEmitter = require('events');

class SupportTicketingSystem extends EventEmitter {
  constructor(options = {}) {
    super();
    this.tickets = new Map();
    this.ticketCounter = 1000;
    this.slaConfig = this.initializeSLAConfig();
    this.templates = this.initializeTemplates();
    this.categories = this.initializeCategories();
  }

  /**
   * Initialize SLA configuration
   */
  initializeSLAConfig() {
    return {
      critical: {
        responseTime: 1 * 60 * 60 * 1000, // 1 hour
        resolutionTime: 4 * 60 * 60 * 1000, // 4 hours
        priority: 'critical'
      },
      high: {
        responseTime: 4 * 60 * 60 * 1000, // 4 hours
        resolutionTime: 24 * 60 * 60 * 1000, // 1 day
        priority: 'high'
      },
      medium: {
        responseTime: 24 * 60 * 60 * 1000, // 1 day
        resolutionTime: 72 * 60 * 60 * 1000, // 3 days
        priority: 'medium'
      },
      low: {
        responseTime: 48 * 60 * 60 * 1000, // 2 days
        resolutionTime: 7 * 24 * 60 * 60 * 1000, // 7 days
        priority: 'low'
      }
    };
  }

  /**
   * Initialize auto-response templates
   */
  initializeTemplates() {
    return {
      created: {
        subject: 'Support Ticket Created: {ticketId}',
        body: `
Your support ticket has been successfully created.

Ticket ID: {ticketId}
Priority: {priority}
Category: {category}
Created: {createdAt}

We will review your ticket shortly. You can check the status at any time using your ticket ID.

Expected Response Time: {responseTime}
        `
      },
      assigned: {
        subject: 'Support Ticket Assigned: {ticketId}',
        body: `
Your support ticket has been assigned to our support team.

Ticket ID: {ticketId}
Assigned To: {assignedTo}
Assigned At: {assignedAt}

Your support agent will contact you shortly with updates.
        `
      },
      inProgress: {
        subject: 'Support Ticket In Progress: {ticketId}',
        body: `
We are actively working on your support ticket.

Ticket ID: {ticketId}
Status: In Progress
Last Updated: {updatedAt}

We will have a resolution soon. Thank you for your patience.
        `
      },
      resolved: {
        subject: 'Support Ticket Resolved: {ticketId}',
        body: `
Your support ticket has been resolved.

Ticket ID: {ticketId}
Resolution: {resolution}
Resolved At: {resolvedAt}

Please reply to this email if you have any further questions.
        `
      },
      escalated: {
        subject: 'Support Ticket Escalated: {ticketId}',
        body: `
Your support ticket has been escalated for priority handling.

Ticket ID: {ticketId}
Escalation Reason: {escalationReason}
New Priority: {newPriority}
Escalated At: {escalatedAt}

Your ticket will receive immediate attention from our senior support team.
        `
      }
    };
  }

  /**
   * Initialize ticket categories
   */
  initializeCategories() {
    return [
      {
        id: 'billing',
        name: 'Billing & Payments',
        description: 'Questions about billing, invoices, or payments'
      },
      {
        id: 'technical',
        name: 'Technical Support',
        description: 'Technical issues and bugs'
      },
      {
        id: 'feature',
        name: 'Feature Request',
        description: 'Request for new features or improvements'
      },
      {
        id: 'account',
        name: 'Account Management',
        description: 'Account settings and access issues'
      },
      {
        id: 'integration',
        name: 'Integration Help',
        description: 'Help with third-party integrations'
      },
      {
        id: 'general',
        name: 'General Inquiry',
        description: 'General questions and inquiries'
      }
    ];
  }

  /**
   * Create support ticket
   */
  async createTicket(ticketData) {
    // Validate category
    if (!this.categories.find(c => c.id === ticketData.category)) {
      return { success: false, reason: 'Invalid category' };
    }

    // Validate priority
    if (!this.slaConfig[ticketData.priority]) {
      return { success: false, reason: 'Invalid priority' };
    }

    const ticketId = `TKT-${this.ticketCounter++}`;
    const now = new Date();

    const ticket = {
      id: ticketId,
      userId: ticketData.userId,
      subject: ticketData.subject,
      description: ticketData.description,
      category: ticketData.category,
      priority: ticketData.priority || 'medium',
      status: 'open',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      assignedTo: null,
      responses: [],
      attachments: ticketData.attachments || [],
      sla: {
        responseDeadline: new Date(now.getTime() + this.slaConfig[ticketData.priority || 'medium'].responseTime)
          .toISOString(),
        resolutionDeadline: new Date(
          now.getTime() + this.slaConfig[ticketData.priority || 'medium'].resolutionTime
        ).toISOString(),
        responseMet: null,
        resolutionMet: null
      },
      escalations: [],
      tags: ticketData.tags || [],
      customFields: ticketData.customFields || {}
    };

    this.tickets.set(ticketId, ticket);

    // Send auto-response
    await this.sendAutoResponse(ticket, 'created');

    // Check for auto-escalation conditions
    if (ticketData.priority === 'critical') {
      await this.autoAssignCritical(ticket);
    }

    this.emit('ticket-created', ticket);
    return { success: true, ticket };
  }

  /**
   * Send auto-response email
   */
  async sendAutoResponse(ticket, type) {
    const template = this.templates[type];
    if (!template) {
      return;
    }

    const responseData = {
      ticketId: ticket.id,
      priority: ticket.priority,
      category: ticket.category,
      createdAt: ticket.createdAt,
      responseTime: this.getReadableTime(this.slaConfig[ticket.priority].responseTime),
      assignedTo: ticket.assignedTo || 'N/A',
      assignedAt: ticket.updatedAt,
      updatedAt: ticket.updatedAt,
      resolution: ticket.resolution || 'N/A',
      resolvedAt: ticket.resolvedAt || 'N/A',
      escalationReason: ticket.escalationReason || 'N/A',
      newPriority: ticket.priority || 'N/A',
      escalatedAt: ticket.escalations[0]?.timestamp || 'N/A'
    };

    const subject = this.interpolateTemplate(template.subject, responseData);
    const body = this.interpolateTemplate(template.body, responseData);

    this.emit('auto-response-sent', {
      ticketId: ticket.id,
      to: ticket.userId,
      subject,
      type
    });

    return { subject, body };
  }

  /**
   * Auto-assign critical tickets
   */
  async autoAssignCritical(ticket) {
    // In real implementation, would assign to available support engineer
    ticket.assignedTo = 'critical-support-team';
    ticket.updatedAt = new Date().toISOString();

    await this.sendAutoResponse(ticket, 'assigned');
    this.emit('ticket-auto-assigned', ticket);
  }

  /**
   * Get ticket by ID
   */
  getTicket(ticketId) {
    return this.tickets.get(ticketId);
  }

  /**
   * Get tickets by user
   */
  getTicketsByUser(userId, options = {}) {
    let userTickets = Array.from(this.tickets.values()).filter(t => t.userId === userId);

    // Apply filters
    if (options.status) {
      userTickets = userTickets.filter(t => t.status === options.status);
    }

    if (options.priority) {
      userTickets = userTickets.filter(t => t.priority === options.priority);
    }

    if (options.category) {
      userTickets = userTickets.filter(t => t.category === options.category);
    }

    // Sort by created date (most recent first)
    userTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (options.limit) {
      userTickets = userTickets.slice(0, options.limit);
    }

    return userTickets;
  }

  /**
   * Add response to ticket
   */
  async addResponse(ticketId, responseData) {
    const ticket = this.getTicket(ticketId);
    if (!ticket) {
      return { success: false, reason: 'Ticket not found' };
    }

    const response = {
      id: `RESP-${Date.now()}`,
      author: responseData.author,
      content: responseData.content,
      attachments: responseData.attachments || [],
      createdAt: new Date().toISOString(),
      isInternal: responseData.isInternal || false
    };

    ticket.responses.push(response);
    ticket.updatedAt = new Date().toISOString();

    // Check if response deadline was met
    if (!ticket.sla.responseMet && new Date() < new Date(ticket.sla.responseDeadline)) {
      ticket.sla.responseMet = true;
    }

    this.emit('response-added', { ticketId, response });
    return { success: true, response };
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(ticketId, newStatus, details = {}) {
    const ticket = this.getTicket(ticketId);
    if (!ticket) {
      return { success: false, reason: 'Ticket not found' };
    }

    const validStatuses = ['open', 'in-progress', 'waiting-customer', 'resolved', 'closed'];
    if (!validStatuses.includes(newStatus)) {
      return { success: false, reason: 'Invalid status' };
    }

    const oldStatus = ticket.status;
    ticket.status = newStatus;
    ticket.updatedAt = new Date().toISOString();

    if (newStatus === 'in-progress') {
      await this.sendAutoResponse(ticket, 'inProgress');
    } else if (newStatus === 'resolved') {
      ticket.resolution = details.resolution || 'Issue resolved';
      ticket.resolvedAt = new Date().toISOString();

      // Check if resolution deadline was met
      if (new Date() < new Date(ticket.sla.resolutionDeadline)) {
        ticket.sla.resolutionMet = true;
      }

      await this.sendAutoResponse(ticket, 'resolved');
    }

    this.emit('ticket-status-changed', { ticketId, oldStatus, newStatus });
    return { success: true, ticket };
  }

  /**
   * Assign ticket to agent
   */
  async assignTicket(ticketId, assignedTo) {
    const ticket = this.getTicket(ticketId);
    if (!ticket) {
      return { success: false, reason: 'Ticket not found' };
    }

    const oldAssignee = ticket.assignedTo;
    ticket.assignedTo = assignedTo;
    ticket.updatedAt = new Date().toISOString();

    await this.sendAutoResponse(ticket, 'assigned');

    this.emit('ticket-assigned', { ticketId, oldAssignee, assignedTo });
    return { success: true, ticket };
  }

  /**
   * Escalate ticket
   */
  async escalateTicket(ticketId, escalationReason, newPriority = null) {
    const ticket = this.getTicket(ticketId);
    if (!ticket) {
      return { success: false, reason: 'Ticket not found' };
    }

    const escalation = {
      timestamp: new Date().toISOString(),
      reason: escalationReason,
      previousPriority: ticket.priority,
      previousAssignee: ticket.assignedTo
    };

    ticket.escalations.push(escalation);

    // Update priority if specified
    if (newPriority && this.slaConfig[newPriority]) {
      ticket.priority = newPriority;
      ticket.sla = {
        responseDeadline: new Date(
          Date.now() + this.slaConfig[newPriority].responseTime
        ).toISOString(),
        resolutionDeadline: new Date(
          Date.now() + this.slaConfig[newPriority].resolutionTime
        ).toISOString(),
        responseMet: null,
        resolutionMet: null
      };
    }

    ticket.escalationReason = escalationReason;
    ticket.updatedAt = new Date().toISOString();

    // Auto-assign to senior support
    ticket.assignedTo = 'senior-support-team';

    await this.sendAutoResponse(ticket, 'escalated');

    this.emit('ticket-escalated', {
      ticketId,
      reason: escalationReason,
      newPriority: newPriority || ticket.priority
    });

    return { success: true, ticket };
  }

  /**
   * Add tags to ticket
   */
  addTags(ticketId, tags) {
    const ticket = this.getTicket(ticketId);
    if (!ticket) {
      return { success: false, reason: 'Ticket not found' };
    }

    ticket.tags = [...new Set([...ticket.tags, ...tags])];
    this.emit('tags-added', { ticketId, tags });
    return { success: true, tags: ticket.tags };
  }

  /**
   * Get SLA status
   */
  getSLAStatus(ticketId) {
    const ticket = this.getTicket(ticketId);
    if (!ticket) {
      return null;
    }

    const now = new Date();
    const responseDeadline = new Date(ticket.sla.responseDeadline);
    const resolutionDeadline = new Date(ticket.sla.resolutionDeadline);

    return {
      ticketId,
      priority: ticket.priority,
      status: ticket.status,
      responseDeadline: ticket.sla.responseDeadline,
      resolutionDeadline: ticket.sla.resolutionDeadline,
      responseStatus:
        ticket.sla.responseMet === true
          ? 'met'
          : now < responseDeadline
            ? 'on-track'
            : 'breached',
      resolutionStatus:
        ticket.sla.resolutionMet === true
          ? 'met'
          : ticket.status === 'resolved'
            ? now < resolutionDeadline
              ? 'met'
              : 'breached'
            : now < resolutionDeadline
              ? 'on-track'
              : 'breached',
      timeRemaining: {
        response: Math.max(0, responseDeadline - now),
        resolution: Math.max(0, resolutionDeadline - now)
      }
    };
  }

  /**
   * Get all tickets with SLA status
   */
  getAllTicketsWithSLA() {
    const tickets = Array.from(this.tickets.values());
    return tickets.map(ticket => ({
      ticket,
      sla: this.getSLAStatus(ticket.id)
    }));
  }

  /**
   * Get SLA breach alerts
   */
  getSLABreachAlerts() {
    const breaches = [];

    for (const ticket of this.tickets.values()) {
      const sla = this.getSLAStatus(ticket.id);
      if (sla.responseStatus === 'breached' || sla.resolutionStatus === 'breached') {
        breaches.push({
          ticketId: ticket.id,
          priority: ticket.priority,
          breachedMetrics: [
            sla.responseStatus === 'breached' ? 'response' : null,
            sla.resolutionStatus === 'breached' ? 'resolution' : null
          ].filter(Boolean)
        });
      }
    }

    return breaches;
  }

  /**
   * Get ticket statistics
   */
  getStatistics() {
    const tickets = Array.from(this.tickets.values());

    const stats = {
      total: tickets.length,
      byStatus: {},
      byPriority: {},
      byCategory: {},
      averageResolutionTime: this.calculateAverageResolutionTime(),
      slaBreaches: this.getSLABreachAlerts().length,
      averageResponseTime: this.calculateAverageResponseTime()
    };

    // Count by status
    for (const status of ['open', 'in-progress', 'waiting-customer', 'resolved', 'closed']) {
      stats.byStatus[status] = tickets.filter(t => t.status === status).length;
    }

    // Count by priority
    for (const priority of ['critical', 'high', 'medium', 'low']) {
      stats.byPriority[priority] = tickets.filter(t => t.priority === priority).length;
    }

    // Count by category
    for (const category of this.categories) {
      stats.byCategory[category.id] = tickets.filter(t => t.category === category.id).length;
    }

    return stats;
  }

  /**
   * Calculate average resolution time
   */
  calculateAverageResolutionTime() {
    const resolvedTickets = Array.from(this.tickets.values()).filter(
      t => t.status === 'resolved' || t.status === 'closed'
    );

    if (resolvedTickets.length === 0) {
      return 0;
    }

    const totalTime = resolvedTickets.reduce((sum, ticket) => {
      const created = new Date(ticket.createdAt);
      const resolved = new Date(ticket.resolvedAt || ticket.updatedAt);
      return sum + (resolved - created);
    }, 0);

    return Math.round(totalTime / resolvedTickets.length / (1000 * 60)); // minutes
  }

  /**
   * Calculate average response time
   */
  calculateAverageResponseTime() {
    const respondedTickets = Array.from(this.tickets.values()).filter(t => t.responses.length > 0);

    if (respondedTickets.length === 0) {
      return 0;
    }

    const totalTime = respondedTickets.reduce((sum, ticket) => {
      const created = new Date(ticket.createdAt);
      const firstResponse = new Date(ticket.responses[0].createdAt);
      return sum + (firstResponse - created);
    }, 0);

    return Math.round(totalTime / respondedTickets.length / (1000 * 60)); // minutes
  }

  /**
   * Interpolate template variables
   */
  interpolateTemplate(template, data) {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(`{${key}}`, value);
    }
    return result;
  }

  /**
   * Get readable time string
   */
  getReadableTime(milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }

  /**
   * Export ticket data
   */
  exportTicket(ticketId) {
    const ticket = this.getTicket(ticketId);
    if (!ticket) {
      return null;
    }

    return {
      ticket,
      sla: this.getSLAStatus(ticketId),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Close ticket
   */
  async closeTicket(ticketId) {
    const ticket = this.getTicket(ticketId);
    if (!ticket) {
      return { success: false, reason: 'Ticket not found' };
    }

    ticket.status = 'closed';
    ticket.updatedAt = new Date().toISOString();

    this.emit('ticket-closed', { ticketId });
    return { success: true, ticket };
  }
}

module.exports = SupportTicketingSystem;
