/**
 * Ticket Manager Test Suite
 */

const TicketManager = require('../../src/support/ticket-manager');

describe('TicketManager', () => {
  let manager;

  beforeEach(() => {
    manager = new TicketManager();
  });

  describe('Agent Registration', () => {
    test('should register support agent', () => {
      const agent = manager.registerAgent('agent-001', {
        name: 'John Doe',
        email: 'john@company.com',
        team: 'L1-support',
        skills: ['billing', 'account']
      });

      expect(agent.id).toBe('agent-001');
      expect(agent.name).toBe('John Doe');
      expect(agent.status).toBe('available');
    });

    test('should add agent to team', () => {
      manager.registerAgent('agent-001', {
        name: 'John Doe',
        team: 'L1-support',
        email: 'john@company.com',
        skills: ['billing']
      });

      const team = manager.teams.get('L1-support');
      expect(team.agents).toContain('agent-001');
    });
  });

  describe('Ticket Creation', () => {
    beforeEach(() => {
      manager.registerAgent('agent-001', {
        name: 'Agent One',
        team: 'L1-support',
        email: 'agent1@company.com',
        skills: ['billing', 'account', 'general']
      });
    });

    test('should create ticket with validation', async () => {
      const result = await manager.createTicket({
        userId: 'user-123',
        subject: 'Cannot login',
        category: 'account',
        priority: 'high'
      });

      expect(result.success).toBe(true);
      expect(result.ticket.id).toMatch(/^TKT-\d+$/);
      expect(result.ticket.status).toBe('assigned');
    });

    test('should reject ticket without category', async () => {
      const result = await manager.createTicket({
        userId: 'user-123',
        subject: 'Issue',
        priority: 'high'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('category');
    });

    test('should calculate SLA deadlines', async () => {
      const result = await manager.createTicket({
        userId: 'user-123',
        subject: 'Critical issue',
        category: 'technical',
        priority: 'critical'
      });

      const ticket = result.ticket;
      expect(ticket.sla.responseDeadline).toBeDefined();
      expect(ticket.sla.resolutionDeadline).toBeDefined();

      const responseDl = new Date(ticket.sla.responseDeadline);
      const now = new Date();
      const diffMinutes = (responseDl - now) / (1000 * 60);

      expect(diffMinutes).toBeGreaterThan(55);
      expect(diffMinutes).toBeLessThan(65);
    });
  });

  describe('Ticket Routing', () => {
    beforeEach(() => {
      manager.registerAgent('agent-001', {
        name: 'Agent One',
        team: 'L1-support',
        email: 'agent1@company.com',
        skills: ['billing', 'account', 'general']
      });
      manager.registerAgent('agent-002', {
        name: 'Agent Two',
        team: 'L2-technical',
        email: 'agent2@company.com',
        skills: ['technical', 'integration']
      });
    });

    test('should route to appropriate team', async () => {
      const result = await manager.createTicket({
        userId: 'user-123',
        subject: 'Payment failed',
        category: 'billing',
        priority: 'medium'
      });

      expect(result.routing.success).toBe(true);
      expect(result.ticket.assignedTeam).toBe('L1-support');
    });

    test('should assign to best available agent', async () => {
      const result = await manager.createTicket({
        userId: 'user-123',
        subject: 'Billing issue',
        category: 'billing',
        priority: 'medium'
      });

      expect(result.ticket.assignedTo).toBeDefined();
      expect(result.ticket.status).toBe('assigned');
    });

    test('should balance load across agents', async () => {
      manager.registerAgent('agent-003', {
        name: 'Agent Three',
        team: 'L1-support',
        email: 'agent3@company.com',
        skills: ['billing', 'general']
      });

      // Create multiple tickets
      for (let i = 0; i < 3; i++) {
        await manager.createTicket({
          userId: `user-${i}`,
          subject: `Issue ${i}`,
          category: 'billing',
          priority: 'medium'
        });
      }

      const agent1 = manager.agents.get('agent-001');
      const agent3 = manager.agents.get('agent-003');

      expect(Math.abs(agent1.currentTickets.length - agent3.currentTickets.length)).toBeLessThanOrEqual(1);
    });
  });

  describe('Ticket Status Updates', () => {
    beforeEach(async () => {
      manager.registerAgent('agent-001', {
        name: 'Agent One',
        team: 'L1-support',
        email: 'agent1@company.com',
        skills: ['billing']
      });

      const result = await manager.createTicket({
        userId: 'user-123',
        subject: 'Issue',
        category: 'billing',
        priority: 'medium'
      });
      this.ticketId = result.ticket.id;
    });

    test('should update ticket status', async () => {
      const result = await manager.updateTicketStatus(
        this.ticketId,
        'in-progress',
        { notes: 'Working on it' }
      );

      expect(result.success).toBe(true);
      expect(result.ticket.status).toBe('in-progress');
    });

    test('should reject invalid status', async () => {
      const result = await manager.updateTicketStatus(
        this.ticketId,
        'invalid-status'
      );

      expect(result.success).toBe(false);
    });

    test('should track first response time', async () => {
      const before = Date.now();
      await manager.updateTicketStatus(this.ticketId, 'in-progress');
      const after = Date.now();

      const ticket = manager.getTicket(this.ticketId);
      const responseTime = new Date(ticket.firstResponseAt).getTime();

      expect(responseTime).toBeGreaterThanOrEqual(before);
      expect(responseTime).toBeLessThanOrEqual(after + 1000);
    });
  });

  describe('Ticket Escalation', () => {
    beforeEach(async () => {
      manager.registerAgent('agent-001', {
        name: 'Agent One',
        team: 'L1-support',
        email: 'agent1@company.com',
        skills: ['billing']
      });

      const result = await manager.createTicket({
        userId: 'user-123',
        subject: 'Complex issue',
        category: 'technical',
        priority: 'high'
      });
      this.ticketId = result.ticket.id;
    });

    test('should escalate ticket', async () => {
      const result = await manager.escalateTicket(
        this.ticketId,
        'Needs technical expertise'
      );

      expect(result.success).toBe(true);
      const ticket = manager.getTicket(this.ticketId);
      expect(ticket.escalations.length).toBe(1);
    });

    test('should update priority on escalation', async () => {
      await manager.escalateTicket(
        this.ticketId,
        'Needs immediate attention',
        'critical'
      );

      const ticket = manager.getTicket(this.ticketId);
      expect(ticket.priority).toBe('critical');
    });
  });

  describe('Responses', () => {
    beforeEach(async () => {
      manager.registerAgent('agent-001', {
        name: 'Agent One',
        team: 'L1-support',
        email: 'agent1@company.com',
        skills: ['billing']
      });

      const result = await manager.createTicket({
        userId: 'user-123',
        subject: 'Issue',
        category: 'billing',
        priority: 'medium'
      });
      this.ticketId = result.ticket.id;
    });

    test('should add response to ticket', async () => {
      const result = await manager.addResponse(this.ticketId, {
        author: 'agent-001',
        content: 'We are looking into this'
      });

      expect(result.success).toBe(true);
      expect(result.response.id).toMatch(/^RESP-/);

      const ticket = manager.getTicket(this.ticketId);
      expect(ticket.responses.length).toBe(1);
    });

    test('should analyze sentiment', async () => {
      await manager.addResponse(this.ticketId, {
        author: 'agent-001',
        content: 'Great! We have resolved your issue. You should be satisfied now.'
      });

      const ticket = manager.getTicket(this.ticketId);
      expect(ticket.responses[0].sentiment).toBe('positive');
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      manager.registerAgent('agent-001', {
        name: 'Agent One',
        team: 'L1-support',
        email: 'agent1@company.com',
        skills: ['billing', 'general']
      });

      // Create multiple tickets
      await manager.createTicket({
        userId: 'user-1',
        subject: 'Issue 1',
        category: 'billing',
        priority: 'high'
      });

      await manager.createTicket({
        userId: 'user-2',
        subject: 'Issue 2',
        category: 'account',
        priority: 'low'
      });
    });

    test('should calculate statistics', () => {
      const stats = manager.getStatistics();

      expect(stats.total).toBe(2);
      expect(stats.byStatus.assigned).toBe(2);
      expect(stats.byPriority.high).toBe(1);
      expect(stats.byPriority.low).toBe(1);
    });

    test('should calculate average times', async () => {
      const ticketId = Array.from(manager.tickets.keys())[0];

      // Simulate resolution
      await manager.updateTicketStatus(ticketId, 'resolved', {
        resolution: 'Fixed'
      });

      const stats = manager.getStatistics();
      expect(stats.averageResolutionTime).toBeGreaterThan(0);
    });
  });

  describe('SLA Tracking', () => {
    beforeEach(async () => {
      manager.registerAgent('agent-001', {
        name: 'Agent One',
        team: 'L1-support',
        email: 'agent1@company.com',
        skills: ['billing']
      });

      const result = await manager.createTicket({
        userId: 'user-123',
        subject: 'Issue',
        category: 'billing',
        priority: 'critical'
      });
      this.ticketId = result.ticket.id;
    });

    test('should get SLA status', () => {
      const sla = manager.getSLAStatus(this.ticketId);

      expect(sla.ticketId).toBe(this.ticketId);
      expect(sla.responseStatus).toBe('on-track');
      expect(sla.resolutionStatus).toBe('on-track');
      expect(sla.met).toBe(false);
    });

    test('should track SLA breaches', async () => {
      // Manually set response deadline to past
      const ticket = manager.getTicket(this.ticketId);
      ticket.sla.responseDeadline = new Date(Date.now() - 60000).toISOString();

      // Add response after deadline
      await manager.addResponse(this.ticketId, {
        author: 'agent-001',
        content: 'Response'
      });

      const sla = manager.getSLAStatus(this.ticketId);
      expect(sla.responseMet).toBe(false);
    });
  });

  describe('Audit Logging', () => {
    test('should log ticket creation', async () => {
      await manager.createTicket({
        userId: 'user-123',
        subject: 'Issue',
        category: 'billing',
        priority: 'medium'
      });

      const logs = manager.getAuditLog({ action: 'ticket-created', limit: 1 });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('ticket-created');
    });

    test('should maintain audit trail', async () => {
      manager.registerAgent('agent-001', {
        name: 'Agent',
        team: 'L1-support',
        email: 'agent@company.com',
        skills: ['billing']
      });

      const result = await manager.createTicket({
        userId: 'user-123',
        subject: 'Issue',
        category: 'billing',
        priority: 'medium'
      });

      await manager.updateTicketStatus(result.ticket.id, 'in-progress');

      const logs = manager.getAuditLog({ limit: 10 });
      expect(logs.length).toBeGreaterThan(1);
    });
  });
});
