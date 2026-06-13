/**
 * Support Ticket Manager
 *
 * Advanced ticket management with routing, assignment, priority classification,
 * SLA tracking, escalation management, and comprehensive audit trails.
 *
 * Features:
 * - Ticket creation, update, and lifecycle management
 * - Dynamic routing to appropriate support teams
 * - Intelligent assignment based on skills and availability
 * - Multi-level priority classification (critical, high, medium, low)
 * - Real-time SLA tracking and compliance monitoring
 * - Automatic escalation workflows
 * - Complete audit trail and compliance tracking
 * - Batch ticket operations
 * - Ticket correlation and grouping
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class TicketManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.tickets = new Map();
    this.ticketCounter = options.startCounter || 1000;
    this.teams = new Map();
    this.agents = new Map();
    this.routingRules = new Map();
    this.auditLog = [];
    this.ticketGroups = new Map();
    this.maxAuditLogSize = options.maxAuditLogSize || 10000;

    this.initializeDefaultTeams();
    this.initializeRoutingRules();
  }

  /**
   * Initialize default support teams
   */
  initializeDefaultTeams() {
    this.teams.set('L1-support', {
      id: 'L1-support',
      name: 'Level 1 Support',
      description: 'Front-line customer support',
      maxTickets: 25,
      skills: ['billing', 'account', 'general'],
      currentLoad: 0,
      agents: []
    });

    this.teams.set('L2-technical', {
      id: 'L2-technical',
      name: 'Level 2 Technical',
      description: 'Technical issue resolution',
      maxTickets: 15,
      skills: ['technical', 'integration', 'advanced'],
      currentLoad: 0,
      agents: []
    });

    this.teams.set('L3-engineering', {
      id: 'L3-engineering',
      name: 'Level 3 Engineering',
      description: 'Engineering and escalation team',
      maxTickets: 10,
      skills: ['critical', 'advanced', 'feature'],
      currentLoad: 0,
      agents: []
    });
  }

  /**
   * Initialize routing rules
   */
  initializeRoutingRules() {
    this.routingRules.set('billing', {
      category: 'billing',
      team: 'L1-support',
      priority: 'medium',
      minSkill: 'billing'
    });

    this.routingRules.set('technical', {
      category: 'technical',
      team: 'L2-technical',
      priority: 'high',
      minSkill: 'technical'
    });

    this.routingRules.set('critical', {
      category: 'critical',
      team: 'L3-engineering',
      priority: 'critical',
      minSkill: 'critical'
    });

    this.routingRules.set('feature', {
      category: 'feature',
      team: 'L1-support',
      priority: 'low',
      minSkill: 'general'
    });

    this.routingRules.set('account', {
      category: 'account',
      team: 'L1-support',
      priority: 'medium',
      minSkill: 'account'
    });

    this.routingRules.set('integration', {
      category: 'integration',
      team: 'L2-technical',
      priority: 'high',
      minSkill: 'integration'
    });

    this.routingRules.set('general', {
      category: 'general',
      team: 'L1-support',
      priority: 'low',
      minSkill: 'general'
    });
  }

  /**
   * Register support agent
   */
  registerAgent(agentId, agentData) {
    const agent = {
      id: agentId,
      name: agentData.name,
      email: agentData.email,
      team: agentData.team,
      skills: agentData.skills || [],
      status: 'available',
      currentTickets: [],
      assignedTickets: [],
      performance: {
        totalTickets: 0,
        resolvedTickets: 0,
        averageResolutionTime: 0,
        customerSatisfaction: 0,
        slaMets: 0,
        slaBreach: 0
      },
      registeredAt: new Date().toISOString()
    };

    this.agents.set(agentId, agent);

    // Update team
    const team = this.teams.get(agentData.team);
    if (team) {
      team.agents.push(agentId);
    }

    this.logAudit('agent-registered', { agentId, team: agentData.team });
    return agent;
  }

  /**
   * Create support ticket with validation and routing
   */
  async createTicket(ticketData) {
    try {
      // Validate required fields
      if (!ticketData.userId || !ticketData.subject || !ticketData.category) {
        return {
          success: false,
          error: 'Missing required fields: userId, subject, category'
        };
      }

      // Validate category exists
      const routingRule = this.routingRules.get(ticketData.category);
      if (!routingRule) {
        return {
          success: false,
          error: `Invalid category: ${ticketData.category}`
        };
      }

      const ticketId = `TKT-${this.ticketCounter++}`;
      const now = new Date();

      const ticket = {
        id: ticketId,
        hash: this.generateTicketHash(ticketId),
        userId: ticketData.userId,
        subject: ticketData.subject,
        description: ticketData.description || '',
        category: ticketData.category,
        priority: ticketData.priority || routingRule.priority,
        status: 'created',
        severity: this.calculateSeverity(ticketData),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        firstResponseAt: null,
        resolvedAt: null,
        closedAt: null,
        assignedTo: null,
        assignedTeam: routingRule.team,
        responses: [],
        attachments: ticketData.attachments || [],
        tags: ticketData.tags || [],
        customFields: ticketData.customFields || {},
        relatedTickets: [],
        escalations: [],
        sla: {
          responseDeadline: null,
          resolutionDeadline: null,
          responseMet: null,
          resolutionMet: null
        },
        metadata: {
          source: ticketData.source || 'web',
          ipAddress: ticketData.ipAddress,
          userAgent: ticketData.userAgent,
          browser: ticketData.browser,
          os: ticketData.os
        },
        conversationHistory: [],
        internalNotes: []
      };

      this.tickets.set(ticketId, ticket);

      // Set SLA deadlines
      this.updateSLADeadlines(ticketId);

      // Route ticket automatically
      const routingResult = await this.routeTicket(ticketId);

      // Log audit
      this.logAudit('ticket-created', {
        ticketId,
        userId: ticketData.userId,
        category: ticketData.category,
        priority: ticket.priority
      });

      this.emit('ticket-created', {
        ticket,
        routing: routingResult
      });

      return {
        success: true,
        ticket,
        routing: routingResult
      };
    } catch (error) {
      this.logAudit('ticket-creation-error', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Route ticket to appropriate team
   */
  async routeTicket(ticketId) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      return { success: false, error: 'Ticket not found' };
    }

    try {
      const routingRule = this.routingRules.get(ticket.category);
      const team = this.teams.get(routingRule.team);

      if (!team) {
        return { success: false, error: 'Team not found' };
      }

      // Find best agent based on skills and availability
      const bestAgent = this.findBestAgent(team, ticket.category, ticket.priority);

      if (bestAgent) {
        ticket.assignedTo = bestAgent.id;
        bestAgent.currentTickets.push(ticketId);
        team.currentLoad += 1;

        ticket.status = 'assigned';

        this.logAudit('ticket-routed', {
          ticketId,
          team: team.id,
          agent: bestAgent.id
        });

        this.emit('ticket-routed', {
          ticketId,
          team: team.id,
          agent: bestAgent.id
        });

        return {
          success: true,
          team: team.id,
          agent: bestAgent.id,
          estimatedWaitTime: this.estimateWaitTime(team)
        };
      } else {
        ticket.status = 'queued';

        this.logAudit('ticket-queued', {
          ticketId,
          team: team.id,
          reason: 'no-available-agents'
        });

        this.emit('ticket-queued', {
          ticketId,
          team: team.id
        });

        return {
          success: true,
          status: 'queued',
          team: team.id,
          estimatedWaitTime: this.estimateQueueWaitTime(team)
        };
      }
    } catch (error) {
      this.logAudit('routing-error', { ticketId, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Find best agent based on skills and load
   */
  findBestAgent(team, category, priority) {
    const availableAgents = team.agents
      .map(agentId => this.agents.get(agentId))
      .filter(agent => agent && agent.status === 'available')
      .filter(agent => agent.skills.includes(category) || agent.skills.includes('all'))
      .sort((a, b) => a.currentTickets.length - b.currentTickets.length);

    return availableAgents.length > 0 ? availableAgents[0] : null;
  }

  /**
   * Estimate wait time for assigned agent
   */
  estimateWaitTime(team) {
    const avgResolutionTime = 120; // minutes
    const agentCount = team.agents.length;
    const totalLoad = team.currentLoad;

    return Math.ceil((totalLoad / agentCount) * avgResolutionTime);
  }

  /**
   * Estimate queue wait time
   */
  estimateQueueWaitTime(team) {
    const avgResolutionTime = 120; // minutes
    const agentCount = team.agents.length || 1;
    const totalLoad = team.currentLoad;

    return Math.ceil(((totalLoad + 1) / agentCount) * avgResolutionTime);
  }

  /**
   * Update ticket status with validation
   */
  async updateTicketStatus(ticketId, newStatus, details = {}) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      return { success: false, error: 'Ticket not found' };
    }

    const validStatuses = [
      'created',
      'assigned',
      'queued',
      'in-progress',
      'waiting-customer',
      'waiting-vendor',
      'on-hold',
      'resolved',
      'closed',
      'reopened',
      'escalated'
    ];

    if (!validStatuses.includes(newStatus)) {
      return { success: false, error: `Invalid status: ${newStatus}` };
    }

    const oldStatus = ticket.status;
    ticket.status = newStatus;
    ticket.updatedAt = new Date().toISOString();

    // Handle status-specific logic
    if (newStatus === 'in-progress' && !ticket.firstResponseAt) {
      ticket.firstResponseAt = new Date().toISOString();
      this.checkSLAResponse(ticketId);
    }

    if (newStatus === 'resolved') {
      ticket.resolvedAt = new Date().toISOString();
      this.checkSLAResolution(ticketId);
    }

    if (newStatus === 'closed') {
      ticket.closedAt = new Date().toISOString();
    }

    this.logAudit('ticket-status-updated', {
      ticketId,
      oldStatus,
      newStatus,
      details
    });

    this.emit('ticket-status-updated', {
      ticketId,
      oldStatus,
      newStatus
    });

    return { success: true, ticket };
  }

  /**
   * Assign ticket to specific agent
   */
  async assignTicket(ticketId, agentId) {
    const ticket = this.tickets.get(ticketId);
    const agent = this.agents.get(agentId);

    if (!ticket) {
      return { success: false, error: 'Ticket not found' };
    }

    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    // Remove from old agent if assigned
    if (ticket.assignedTo) {
      const oldAgent = this.agents.get(ticket.assignedTo);
      if (oldAgent) {
        oldAgent.currentTickets = oldAgent.currentTickets.filter(id => id !== ticketId);
      }
    }

    // Assign to new agent
    ticket.assignedTo = agentId;
    ticket.status = 'assigned';
    agent.currentTickets.push(ticketId);
    agent.assignedTickets.push(ticketId);

    // Update team load
    const team = this.teams.get(agent.team);
    if (team) {
      team.currentLoad += 1;
    }

    this.logAudit('ticket-assigned', {
      ticketId,
      agentId,
      agentName: agent.name
    });

    this.emit('ticket-assigned', {
      ticketId,
      agentId,
      agentName: agent.name
    });

    return { success: true, ticket, agent };
  }

  /**
   * Escalate ticket with reason and new priority
   */
  async escalateTicket(ticketId, escalationReason, newPriority = null) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      return { success: false, error: 'Ticket not found' };
    }

    const escalation = {
      timestamp: new Date().toISOString(),
      reason: escalationReason,
      previousPriority: ticket.priority,
      previousAssignee: ticket.assignedTo,
      previousTeam: ticket.assignedTeam,
      escalatedBy: null
    };

    ticket.escalations.push(escalation);
    ticket.status = 'escalated';
    ticket.updatedAt = new Date().toISOString();

    // Update priority if specified
    if (newPriority) {
      ticket.priority = newPriority;
      this.updateSLADeadlines(ticketId);
    }

    // Route to higher level team
    const routingRule = this.routingRules.get(ticket.category);
    if (ticket.priority === 'critical') {
      ticket.assignedTeam = 'L3-engineering';
    } else if (ticket.priority === 'high' && routingRule.team === 'L1-support') {
      ticket.assignedTeam = 'L2-technical';
    }

    // Re-route ticket
    const routeResult = await this.routeTicket(ticketId);

    this.logAudit('ticket-escalated', {
      ticketId,
      reason: escalationReason,
      newPriority,
      newTeam: ticket.assignedTeam
    });

    this.emit('ticket-escalated', {
      ticketId,
      reason: escalationReason,
      newPriority,
      routing: routeResult
    });

    return {
      success: true,
      ticket,
      routing: routeResult
    };
  }

  /**
   * Add response to ticket
   */
  async addResponse(ticketId, responseData) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      return { success: false, error: 'Ticket not found' };
    }

    const response = {
      id: `RESP-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      author: responseData.author,
      authorRole: responseData.authorRole || 'agent',
      content: responseData.content,
      attachments: responseData.attachments || [],
      createdAt: new Date().toISOString(),
      isInternal: responseData.isInternal === true,
      sentiment: this.analyzeSentiment(responseData.content),
      followUpRequired: responseData.followUpRequired || false
    };

    ticket.responses.push(response);
    ticket.conversationHistory.push({
      type: 'response',
      responseId: response.id,
      timestamp: response.createdAt
    });

    ticket.updatedAt = new Date().toISOString();

    // Check first response SLA
    if (ticket.firstResponseAt === null) {
      ticket.firstResponseAt = new Date().toISOString();
      this.checkSLAResponse(ticketId);
    }

    this.logAudit('response-added', {
      ticketId,
      responseId: response.id,
      author: responseData.author,
      isInternal: response.isInternal
    });

    this.emit('response-added', {
      ticketId,
      response
    });

    return { success: true, response };
  }

  /**
   * Analyze sentiment of response
   */
  analyzeSentiment(text) {
    // Simple sentiment analysis
    const positiveKeywords = ['thanks', 'great', 'excellent', 'resolved', 'solved', 'happy', 'satisfied'];
    const negativeKeywords = ['issue', 'problem', 'error', 'failed', 'broken', 'angry', 'frustrated'];

    const lowerText = text.toLowerCase();
    const positiveCount = positiveKeywords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeKeywords.filter(word => lowerText.includes(word)).length;

    if (positiveCount > negativeCount) {
      return 'positive';
    } else if (negativeCount > positiveCount) {
      return 'negative';
    }
    return 'neutral';
  }

  /**
   * Calculate ticket severity
   */
  calculateSeverity(ticketData) {
    let severity = 'low';

    if (ticketData.priority === 'critical') {
      severity = 'critical';
    } else if (ticketData.category === 'technical' && ticketData.priority === 'high') {
      severity = 'high';
    } else if (ticketData.category === 'billing' && ticketData.priority === 'high') {
      severity = 'high';
    } else if (ticketData.priority === 'high') {
      severity = 'medium-high';
    } else if (ticketData.priority === 'medium') {
      severity = 'medium';
    }

    return severity;
  }

  /**
   * Update SLA deadlines based on priority
   */
  updateSLADeadlines(ticketId) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return;

    const slaConfig = {
      critical: { response: 1 * 60, resolution: 4 * 60 },
      high: { response: 4 * 60, resolution: 24 * 60 },
      medium: { response: 24 * 60, resolution: 72 * 60 },
      low: { response: 48 * 60, resolution: 7 * 24 * 60 }
    };

    const config = slaConfig[ticket.priority] || slaConfig['medium'];
    const now = new Date();

    ticket.sla.responseDeadline = new Date(now.getTime() + config.response * 60 * 1000).toISOString();
    ticket.sla.resolutionDeadline = new Date(now.getTime() + config.resolution * 60 * 1000).toISOString();
  }

  /**
   * Check SLA response compliance
   */
  checkSLAResponse(ticketId) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket || ticket.firstResponseAt === null) return;

    const deadline = new Date(ticket.sla.responseDeadline);
    const responseTime = new Date(ticket.firstResponseAt);

    if (responseTime <= deadline) {
      ticket.sla.responseMet = true;

      // Update agent performance
      if (ticket.assignedTo) {
        const agent = this.agents.get(ticket.assignedTo);
        if (agent) {
          agent.performance.slaMets += 1;
        }
      }
    } else {
      ticket.sla.responseMet = false;

      // Update agent performance
      if (ticket.assignedTo) {
        const agent = this.agents.get(ticket.assignedTo);
        if (agent) {
          agent.performance.slaBreach += 1;
        }
      }

      // Trigger escalation alert
      this.emit('sla-breach-alert', {
        ticketId,
        metric: 'response',
        deadline: ticket.sla.responseDeadline
      });
    }
  }

  /**
   * Check SLA resolution compliance
   */
  checkSLAResolution(ticketId) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket || ticket.resolvedAt === null) return;

    const deadline = new Date(ticket.sla.resolutionDeadline);
    const resolutionTime = new Date(ticket.resolvedAt);

    if (resolutionTime <= deadline) {
      ticket.sla.resolutionMet = true;

      // Update agent performance
      if (ticket.assignedTo) {
        const agent = this.agents.get(ticket.assignedTo);
        if (agent) {
          agent.performance.slaMets += 1;
        }
      }
    } else {
      ticket.sla.resolutionMet = false;

      // Update agent performance
      if (ticket.assignedTo) {
        const agent = this.agents.get(ticket.assignedTo);
        if (agent) {
          agent.performance.slaBreach += 1;
        }
      }

      // Trigger escalation alert
      this.emit('sla-breach-alert', {
        ticketId,
        metric: 'resolution',
        deadline: ticket.sla.resolutionDeadline
      });
    }
  }

  /**
   * Close ticket
   */
  async closeTicket(ticketId, closeReason = 'resolved') {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      return { success: false, error: 'Ticket not found' };
    }

    ticket.status = 'closed';
    ticket.closedAt = new Date().toISOString();

    // Update agent performance
    if (ticket.assignedTo) {
      const agent = this.agents.get(ticket.assignedTo);
      if (agent) {
        agent.performance.resolvedTickets += 1;
        agent.performance.totalTickets += 1;

        // Update average resolution time
        if (ticket.resolvedAt) {
          const created = new Date(ticket.createdAt);
          const resolved = new Date(ticket.resolvedAt);
          const resolutionTime = (resolved - created) / (1000 * 60); // minutes

          const current = agent.performance.averageResolutionTime;
          const total = agent.performance.totalTickets;
          agent.performance.averageResolutionTime =
            (current * (total - 1) + resolutionTime) / total;
        }

        // Remove from current tickets
        agent.currentTickets = agent.currentTickets.filter(id => id !== ticketId);
      }
    }

    // Update team load
    const team = this.teams.get(ticket.assignedTeam);
    if (team) {
      team.currentLoad = Math.max(0, team.currentLoad - 1);
    }

    this.logAudit('ticket-closed', {
      ticketId,
      reason: closeReason
    });

    this.emit('ticket-closed', {
      ticketId,
      reason: closeReason
    });

    return { success: true, ticket };
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

    // Sort by priority and created date
    userTickets.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    if (options.limit) {
      userTickets = userTickets.slice(0, options.limit);
    }

    return userTickets;
  }

  /**
   * Get tickets by agent
   */
  getTicketsByAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return [];

    return agent.currentTickets.map(ticketId => this.tickets.get(ticketId)).filter(Boolean);
  }

  /**
   * Get SLA status for ticket
   */
  getSLAStatus(ticketId) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return null;

    const now = new Date();
    const responseDeadline = new Date(ticket.sla.responseDeadline);
    const resolutionDeadline = new Date(ticket.sla.resolutionDeadline);

    const responseStatus = ticket.sla.responseMet === true
      ? 'met'
      : ticket.firstResponseAt
        ? 'met'
        : now < responseDeadline
          ? 'on-track'
          : 'breached';

    const resolutionStatus = ticket.sla.resolutionMet === true
      ? 'met'
      : ticket.status === 'resolved' || ticket.status === 'closed'
        ? (new Date(ticket.resolvedAt) <= resolutionDeadline ? 'met' : 'breached')
        : now < resolutionDeadline
          ? 'on-track'
          : 'breached';

    return {
      ticketId,
      priority: ticket.priority,
      responseDeadline: ticket.sla.responseDeadline,
      resolutionDeadline: ticket.sla.resolutionDeadline,
      responseStatus,
      resolutionStatus,
      timeRemaining: {
        response: Math.max(0, responseDeadline - now),
        resolution: Math.max(0, resolutionDeadline - now)
      },
      met: responseStatus === 'met' && resolutionStatus === 'met'
    };
  }

  /**
   * Generate ticket hash for duplicate detection
   */
  generateTicketHash(ticketId) {
    return crypto
      .createHash('sha256')
      .update(ticketId + Date.now())
      .digest('hex');
  }

  /**
   * Log audit event
   */
  logAudit(action, details) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action,
      details,
      id: crypto.randomBytes(8).toString('hex')
    };

    this.auditLog.push(auditEntry);

    // Maintain max size
    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog.shift();
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(options = {}) {
    let log = [...this.auditLog];

    if (options.action) {
      log = log.filter(entry => entry.action === options.action);
    }

    if (options.limit) {
      log = log.slice(-options.limit);
    }

    return log;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const tickets = Array.from(this.tickets.values());

    const stats = {
      total: tickets.length,
      byStatus: {},
      byPriority: {},
      byCategory: {},
      byTeam: {},
      averageResolutionTime: 0,
      averageResponseTime: 0,
      slaCompliance: {
        responseMetRate: 0,
        resolutionMetRate: 0
      },
      agents: {}
    };

    // Count by status
    for (const ticket of tickets) {
      stats.byStatus[ticket.status] = (stats.byStatus[ticket.status] || 0) + 1;
      stats.byPriority[ticket.priority] = (stats.byPriority[ticket.priority] || 0) + 1;
      stats.byCategory[ticket.category] = (stats.byCategory[ticket.category] || 0) + 1;
      stats.byTeam[ticket.assignedTeam] = (stats.byTeam[ticket.assignedTeam] || 0) + 1;
    }

    // Calculate averages
    const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');
    if (resolvedTickets.length > 0) {
      const totalResolutionTime = resolvedTickets.reduce((sum, ticket) => {
        const created = new Date(ticket.createdAt);
        const resolved = new Date(ticket.resolvedAt || ticket.updatedAt);
        return sum + (resolved - created);
      }, 0);

      stats.averageResolutionTime = Math.round(totalResolutionTime / resolvedTickets.length / (1000 * 60));
    }

    const respondedTickets = tickets.filter(t => t.firstResponseAt);
    if (respondedTickets.length > 0) {
      const totalResponseTime = respondedTickets.reduce((sum, ticket) => {
        const created = new Date(ticket.createdAt);
        const firstResponse = new Date(ticket.firstResponseAt);
        return sum + (firstResponse - created);
      }, 0);

      stats.averageResponseTime = Math.round(totalResponseTime / respondedTickets.length / (1000 * 60));
    }

    // SLA compliance
    const metResponse = tickets.filter(t => t.sla.responseMet === true).length;
    const metResolution = tickets.filter(t => t.sla.resolutionMet === true).length;

    stats.slaCompliance.responseMetRate = tickets.length > 0 ? Math.round((metResponse / tickets.length) * 100) : 0;
    stats.slaCompliance.resolutionMetRate = resolvedTickets.length > 0 ? Math.round((metResolution / resolvedTickets.length) * 100) : 0;

    // Agent stats
    for (const [agentId, agent] of this.agents) {
      stats.agents[agent.name] = {
        totalTickets: agent.performance.totalTickets,
        resolvedTickets: agent.performance.resolvedTickets,
        currentTickets: agent.currentTickets.length,
        averageResolutionTime: Math.round(agent.performance.averageResolutionTime),
        slaMets: agent.performance.slaMets,
        slaBreaches: agent.performance.slaBreach
      };
    }

    return stats;
  }
}

module.exports = TicketManager;
