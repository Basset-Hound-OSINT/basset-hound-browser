/**
 * Test suite for Command Authorization Framework
 */

const { CommandAuthorizer } = require('../../src/auth/command-authorizer');

describe('CommandAuthorizer', () => {
  let authorizer;

  beforeEach(() => {
    authorizer = new CommandAuthorizer();
  });

  // ========== Permission Level Management Tests ==========

  describe('Permission Level Management', () => {
    it('should set and get client permission level', () => {
      authorizer.setClientLevel('client-1', 1);
      expect(authorizer.getClientLevel('client-1')).toBe(1);
    });

    it('should default to level 0 for unknown clients', () => {
      expect(authorizer.getClientLevel('unknown')).toBe(0);
    });

    it('should validate permission levels', () => {
      expect(() => authorizer.setClientLevel('client-1', -1)).toThrow();
      expect(() => authorizer.setClientLevel('client-1', 4)).toThrow();
      expect(() => authorizer.setClientLevel('client-1', 'invalid')).toThrow();
    });

    it('should allow valid permission levels (0-3)', () => {
      for (let level = 0; level <= 3; level++) {
        expect(() => authorizer.setClientLevel('client', level)).not.toThrow();
      }
    });
  });

  // ========== Command Authorization Tests ==========

  describe('Command Authorization', () => {
    it('should allow level 0 commands for unauthenticated clients', () => {
      const result = authorizer.canExecute('unknown', 'ping');
      expect(result.allowed).toBe(true);
    });

    it('should deny level 1+ commands for unauthenticated clients', () => {
      const result = authorizer.canExecute('unknown', 'navigate');
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('PERMISSION_DENIED');
    });

    it('should allow level 1 commands for level 1 clients', () => {
      authorizer.setClientLevel('client-1', 1);
      const result = authorizer.canExecute('client-1', 'navigate');
      expect(result.allowed).toBe(true);
    });

    it('should deny level 3 commands for level 1 clients', () => {
      authorizer.setClientLevel('client-1', 1);
      const result = authorizer.canExecute('client-1', 'execute_javascript');
      expect(result.allowed).toBe(false);
    });

    it('should allow all commands for level 3 clients', () => {
      authorizer.setClientLevel('admin', 3);
      const commands = ['navigate', 'get_cookies', 'execute_javascript'];
      for (const cmd of commands) {
        const result = authorizer.canExecute('admin', cmd);
        expect(result.allowed).toBe(true);
      }
    });

    it('should reject unknown commands', () => {
      authorizer.setClientLevel('client', 3);
      const result = authorizer.canExecute('client', 'unknown_command_xyz');
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('UNKNOWN_COMMAND');
    });
  });

  // ========== Command Classification Tests ==========

  describe('Command Classification', () => {
    it('should identify level 0 public commands', () => {
      const info = authorizer.getCommandInfo('ping');
      expect(info.level).toBe(0);
      expect(info.description).toBeDefined();
    });

    it('should identify level 1 basic commands', () => {
      const info = authorizer.getCommandInfo('navigate');
      expect(info.level).toBe(1);
    });

    it('should identify level 2 admin commands', () => {
      const info = authorizer.getCommandInfo('get_cookies');
      expect(info.level).toBe(2);
    });

    it('should identify level 3 superadmin commands', () => {
      const info = authorizer.getCommandInfo('execute_javascript');
      expect(info.level).toBe(3);
    });

    it('should return null for unknown commands', () => {
      const info = authorizer.getCommandInfo('unknown_command');
      expect(info).toBeNull();
    });
  });

  // ========== Level Filtering Tests ==========

  describe('Level Filtering', () => {
    it('should get all commands for level 0', () => {
      const cmds = authorizer.getCommandsForLevel(0);
      expect(Object.keys(cmds).length).toBeGreaterThan(0);
      for (const info of Object.values(cmds)) {
        expect(info.level).toBe(0);
      }
    });

    it('should get level 0 and 1 commands for level 1', () => {
      const cmds = authorizer.getCommandsForLevel(1);
      expect(Object.keys(cmds).length).toBeGreaterThan(3);
      for (const info of Object.values(cmds)) {
        expect(info.level).toBeLessThanOrEqual(1);
      }
    });

    it('should include both low and high level commands for level 3', () => {
      const cmds = authorizer.getCommandsForLevel(3);
      const levels = new Set(Object.values(cmds).map(c => c.level));
      expect(levels.has(0)).toBe(true);
      expect(levels.has(1)).toBe(true);
      expect(levels.has(2)).toBe(true);
      expect(levels.has(3)).toBe(true);
    });
  });

  // ========== Audit Logging Tests ==========

  describe('Audit Logging', () => {
    it('should log successful authorization attempts', () => {
      authorizer.setClientLevel('client-1', 1);
      authorizer.canExecute('client-1', 'navigate');

      const log = authorizer.getAuditLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log[0].allowed).toBe(true);
      expect(log[0].command).toBe('navigate');
    });

    it('should log failed authorization attempts', () => {
      authorizer.canExecute('client-1', 'execute_javascript');

      const log = authorizer.getAuditLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log[0].allowed).toBe(false);
    });

    it('should filter audit log by client ID', () => {
      authorizer.setClientLevel('client-1', 1);
      authorizer.setClientLevel('client-2', 2);

      authorizer.canExecute('client-1', 'navigate');
      authorizer.canExecute('client-2', 'get_cookies');

      const log = authorizer.getAuditLog({ clientId: 'client-1' });
      expect(log.every(e => e.clientId === 'client-1')).toBe(true);
    });

    it('should filter audit log by command', () => {
      authorizer.setClientLevel('client', 2);
      authorizer.canExecute('client', 'navigate');
      authorizer.canExecute('client', 'get_cookies');

      const log = authorizer.getAuditLog({ command: 'navigate' });
      expect(log.every(e => e.command === 'navigate')).toBe(true);
    });

    it('should filter audit log by allowed status', () => {
      authorizer.setClientLevel('client', 1);
      authorizer.canExecute('client', 'navigate');  // allowed
      authorizer.canExecute('client', 'execute_javascript');  // not allowed

      const failedLog = authorizer.getAuditLog({ allowed: false });
      expect(failedLog.every(e => !e.allowed)).toBe(true);
    });

    it('should limit audit log size', () => {
      authorizer.setClientLevel('client', 1);
      for (let i = 0; i < 1500; i++) {
        authorizer.canExecute('client', 'navigate');
      }

      const log = authorizer.getAuditLog();
      expect(log.length).toBeLessThanOrEqual(1000);
    });

    it('should clear audit log', () => {
      authorizer.setClientLevel('client', 1);
      authorizer.canExecute('client', 'navigate');
      expect(authorizer.getAuditLog().length).toBeGreaterThan(0);

      authorizer.clearAuditLog();
      expect(authorizer.getAuditLog().length).toBe(0);
    });
  });

  // ========== Statistics Tests ==========

  describe('Statistics', () => {
    it('should return command statistics', () => {
      const stats = authorizer.getStats();
      expect(stats.totalCommands).toBeGreaterThan(100);
      expect(stats.commandsByLevel).toBeDefined();
      expect(stats.commandsByLevel.level0).toBeGreaterThan(0);
      expect(stats.commandsByLevel.level1).toBeGreaterThan(0);
      expect(stats.commandsByLevel.level2).toBeGreaterThan(0);
      expect(stats.commandsByLevel.level3).toBeGreaterThan(0);
    });

    it('should track client count', () => {
      authorizer.setClientLevel('client-1', 1);
      authorizer.setClientLevel('client-2', 2);

      const stats = authorizer.getStats();
      expect(stats.totalClients).toBe(2);
    });

    it('should track audit log size', () => {
      authorizer.setClientLevel('client', 1);
      authorizer.canExecute('client', 'navigate');

      const stats = authorizer.getStats();
      expect(stats.auditLogSize).toBeGreaterThan(0);
    });
  });

  // ========== Integration Tests ==========

  describe('Integration', () => {
    it('should handle multiple clients with different permission levels', () => {
      authorizer.setClientLevel('public-user', 1);
      authorizer.setClientLevel('admin', 3);
      authorizer.setClientLevel('audit', 2);

      expect(authorizer.canExecute('public-user', 'navigate').allowed).toBe(true);
      expect(authorizer.canExecute('public-user', 'execute_javascript').allowed).toBe(false);

      expect(authorizer.canExecute('admin', 'navigate').allowed).toBe(true);
      expect(authorizer.canExecute('admin', 'execute_javascript').allowed).toBe(true);

      expect(authorizer.canExecute('audit', 'get_cookies').allowed).toBe(true);
      expect(authorizer.canExecute('audit', 'execute_javascript').allowed).toBe(false);
    });

    it('should handle permission level changes', () => {
      authorizer.setClientLevel('user', 1);
      expect(authorizer.canExecute('user', 'execute_javascript').allowed).toBe(false);

      authorizer.setClientLevel('user', 3);
      expect(authorizer.canExecute('user', 'execute_javascript').allowed).toBe(true);
    });
  });
});
