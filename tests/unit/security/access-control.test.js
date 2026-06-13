/**
 * Access Control Manager Tests
 * Tests for RBAC, CBAC, and ABAC implementations
 */

const { AccessControlManager } = require('../../../src/security/access-control');

describe('AccessControlManager - Multi-Model Access Control', () => {
  let acm;

  beforeEach(() => {
    acm = new AccessControlManager();
  });

  describe('RBAC - Role Definition', () => {
    test('should initialize default roles', () => {
      expect(acm.roles.size).toBeGreaterThan(0);
      expect(acm.roles.has('admin')).toBe(true);
      expect(acm.roles.has('operator')).toBe(true);
      expect(acm.roles.has('viewer')).toBe(true);
      expect(acm.roles.has('restricted')).toBe(true);
    });

    test('should define custom role', () => {
      acm.defineRole('auditor', {
        description: 'Audit Reviewer',
        permissions: ['view_logs', 'view_reports'],
        priority: 30
      });

      expect(acm.roles.has('auditor')).toBe(true);
      const auditorRole = acm.roles.get('auditor');
      expect(auditorRole.permissions).toContain('view_logs');
    });

    test('should reject role without permissions', () => {
      expect(() => {
        acm.defineRole('invalid', {
          description: 'Invalid'
        });
      }).toThrow();
    });

    test('admin role should have full access', () => {
      const adminRole = acm.roles.get('admin');

      expect(adminRole.permissions).toContain('*');
    });

    test('viewer role should have limited permissions', () => {
      const viewerRole = acm.roles.get('viewer');

      expect(viewerRole.permissions).toContain('screenshot');
      expect(viewerRole.permissions).not.toContain('execute_javascript');
    });
  });

  describe('RBAC - Permission Management', () => {
    test('should grant permission to role', () => {
      acm.defineRole('custom', {
        permissions: ['read'],
        priority: 20
      });

      acm.grantPermission('custom', 'write');

      const role = acm.roles.get('custom');
      expect(role.permissions).toContain('write');
    });

    test('should revoke permission from role', () => {
      acm.defineRole('custom', {
        permissions: ['read', 'write'],
        priority: 20
      });

      acm.revokePermission('custom', 'write');

      const role = acm.roles.get('custom');
      expect(role.permissions).not.toContain('write');
    });

    test('should not duplicate permissions', () => {
      acm.defineRole('custom', {
        permissions: ['read'],
        priority: 20
      });

      acm.grantPermission('custom', 'read');
      acm.grantPermission('custom', 'read');

      const role = acm.roles.get('custom');
      const readCount = role.permissions.filter(p => p === 'read').length;
      expect(readCount).toBe(1);
    });

    test('should reject nonexistent role', () => {
      expect(() => {
        acm.grantPermission('nonexistent', 'permission');
      }).toThrow();
    });
  });

  describe('RBAC - Permission Check', () => {
    test('admin should access all resources', () => {
      const result = acm.checkRbacPermission('admin_user', 'admin', 'sensitive', 'execute');

      expect(result.allowed).toBe(true);
    });

    test('operator should access navigation commands', () => {
      const result = acm.checkRbacPermission('op_user', 'operator', 'browser', 'navigate');

      expect(result.allowed).toBe(true);
    });

    test('viewer should not access execute_javascript', () => {
      const result = acm.checkRbacPermission('viewer_user', 'viewer', 'browser', 'execute_javascript');

      expect(result.allowed).toBe(false);
    });

    test('restricted should only access basic commands', () => {
      const statusResult = acm.checkRbacPermission('restricted_user', 'restricted', 'system', 'status');
      const navResult = acm.checkRbacPermission('restricted_user', 'restricted', 'browser', 'navigate');

      expect(statusResult.allowed).toBe(true);
      expect(navResult.allowed).toBe(false);
    });

    test('should reject nonexistent role', () => {
      const result = acm.checkRbacPermission('user', 'nonexistent', 'resource', 'action');

      expect(result.allowed).toBe(false);
    });
  });

  describe('CBAC - Capability Creation', () => {
    test('should create capability token', () => {
      const result = acm.createCapability('user1', 'document', 'read');

      expect(result.capabilityId).toBeTruthy();
      expect(result.token).toBeTruthy();
      expect(result.token.length).toBe(64); // 32 bytes hex
    });

    test('should include constraints in capability', () => {
      const constraints = {
        expiresAt: Date.now() + 3600000,
        maxUsage: 10
      };

      const result = acm.createCapability('user1', 'document', 'read', constraints);
      const capability = acm.capabilities.get(result.capabilityId);

      expect(capability.constraints.maxUsage).toBe(10);
    });

    test('should store capability with hash of token', () => {
      const result = acm.createCapability('user1', 'document', 'read');
      const capability = acm.capabilities.get(result.capabilityId);

      expect(capability.token).not.toEqual(result.token);
      // Token should be hashed
      expect(capability.token.length).toBe(64);
    });

    test('should map token to capability', () => {
      const result = acm.createCapability('user1', 'document', 'read');
      const foundCapId = acm.capabilityTokens.get(result.token);

      expect(foundCapId).toBe(result.capabilityId);
    });
  });

  describe('CBAC - Capability Verification', () => {
    test('should verify valid capability', () => {
      const result = acm.createCapability('user1', 'document', 'read');
      const verified = acm.verifyCapability(result.token, 'document', 'read');

      expect(verified.valid).toBe(true);
    });

    test('should reject invalid token', () => {
      const verified = acm.verifyCapability('invalid_token', 'document', 'read');

      expect(verified.valid).toBe(false);
      expect(verified.reason).toContain('Invalid token');
    });

    test('should reject resource mismatch', () => {
      const result = acm.createCapability('user1', 'document', 'read');
      const verified = acm.verifyCapability(result.token, 'other_document', 'read');

      expect(verified.valid).toBe(false);
      expect(verified.reason).toContain('Resource or action mismatch');
    });

    test('should reject action mismatch', () => {
      const result = acm.createCapability('user1', 'document', 'read');
      const verified = acm.verifyCapability(result.token, 'document', 'write');

      expect(verified.valid).toBe(false);
    });

    test('should reject expired capability', (done) => {
      const constraints = { expiresAt: Date.now() - 1000 }; // Already expired
      const result = acm.createCapability('user1', 'document', 'read', constraints);

      const verified = acm.verifyCapability(result.token, 'document', 'read');

      expect(verified.valid).toBe(false);
      expect(verified.reason).toContain('expired');
      done();
    });

    test('should remove expired capability', (done) => {
      const constraints = { expiresAt: Date.now() - 1000 };
      const result = acm.createCapability('user1', 'document', 'read', constraints);

      acm.verifyCapability(result.token, 'document', 'read');

      expect(acm.capabilities.has(result.capabilityId)).toBe(false);
      expect(acm.capabilityTokens.has(result.token)).toBe(false);
      done();
    });
  });

  describe('ABAC - Attribute Definition', () => {
    test('should define attribute', () => {
      acm.defineAttribute('department', {
        values: ['engineering', 'sales', 'hr']
      });

      expect(acm.attributes.has('department')).toBe(true);
    });

    test('should store attribute rules', () => {
      const rules = { values: ['admin', 'user'] };
      acm.defineAttribute('role', rules);

      const attr = acm.attributes.get('role');
      expect(attr.rules).toEqual(rules);
    });
  });

  describe('ABAC - Policy Management', () => {
    test('should add policy', () => {
      acm.addPolicy({
        effect: 'Allow',
        actions: ['read', 'write'],
        conditions: (context) => context.department === 'engineering'
      });

      expect(acm.policies.length).toBe(1);
    });

    test('should reject policy without effect', () => {
      expect(() => {
        acm.addPolicy({
          actions: ['read'],
          conditions: () => true
        });
      }).toThrow();
    });

    test('should generate policy ID', () => {
      acm.addPolicy({
        effect: 'Allow',
        actions: ['read'],
        conditions: () => true
      });

      expect(acm.policies[0].id).toBeTruthy();
    });
  });

  describe('ABAC - Permission Check', () => {
    test('should allow matching policy', () => {
      acm.addPolicy({
        effect: 'Allow',
        actions: ['read'],
        conditions: (ctx) => ctx.department === 'engineering'
      });

      const result = acm.checkAbacPermission({
        action: 'read',
        department: 'engineering'
      });

      expect(result.allowed).toBe(true);
    });

    test('should deny non-matching policy', () => {
      acm.addPolicy({
        effect: 'Allow',
        actions: ['read'],
        conditions: (ctx) => ctx.department === 'engineering'
      });

      const result = acm.checkAbacPermission({
        action: 'read',
        department: 'sales'
      });

      expect(result.allowed).toBe(false);
    });

    test('should return first matching policy', () => {
      acm.addPolicy({
        effect: 'Allow',
        actions: ['read'],
        conditions: () => true
      });
      acm.addPolicy({
        effect: 'Deny',
        actions: ['read'],
        conditions: () => true
      });

      const result = acm.checkAbacPermission({
        action: 'read'
      });

      expect(result.allowed).toBe(true); // First policy matched
    });
  });

  describe('Unified Access Check', () => {
    test('should check access with RBAC', () => {
      const principal = { id: 'user1', role: 'admin' };
      const request = { resource: 'sensitive', action: 'execute' };

      const result = acm.checkAccess(principal, request);

      expect(result.allowed).toBe(true);
    });

    test('should deny unknown permission', () => {
      const principal = { id: 'user1', role: 'viewer' };
      const request = { resource: 'browser', action: 'execute_javascript' };

      const result = acm.checkAccess(principal, request);

      expect(result.allowed).toBe(false);
    });

    test('should cache access decisions', () => {
      const principal = { id: 'user1', role: 'admin' };
      const request = { resource: 'resource', action: 'action' };

      acm.checkAccess(principal, request);

      expect(acm.decisionCache.size).toBeGreaterThan(0);
    });

    test('should log access attempts', () => {
      const principal = { id: 'user1', role: 'admin' };
      const request = { resource: 'resource', action: 'action' };

      acm.checkAccess(principal, request);

      expect(acm.accessLog.length).toBeGreaterThan(0);
    });

    test('should return deny reason', () => {
      const principal = { id: 'user1', role: 'restricted' };
      const request = { resource: 'browser', action: 'navigate' };

      const result = acm.checkAccess(principal, request);

      expect(result.reason).toBeTruthy();
    });
  });

  describe('Cache Management', () => {
    test('should clear decision cache', () => {
      const principal = { id: 'user1', role: 'admin' };
      const request = { resource: 'resource', action: 'action' };

      acm.checkAccess(principal, request);
      expect(acm.decisionCache.size).toBeGreaterThan(0);

      acm.clearCache();
      expect(acm.decisionCache.size).toBe(0);
    });

    test('should clear cache when permissions change', () => {
      const principal = { id: 'user1', role: 'admin' };
      const request = { resource: 'resource', action: 'action' };

      acm.checkAccess(principal, request);
      const initialSize = acm.decisionCache.size;

      acm.grantPermission('admin', 'new_permission');
      expect(acm.decisionCache.size).toBe(0);
    });
  });

  describe('Access Logging', () => {
    test('should log access attempts', () => {
      const principal = { id: 'user1', role: 'admin' };
      acm.checkAccess(principal, { resource: 'res1', action: 'act1' });
      acm.checkAccess(principal, { resource: 'res2', action: 'act2' });

      expect(acm.accessLog.length).toBe(2);
    });

    test('should filter logs by principal', () => {
      acm.checkAccess({ id: 'user1', role: 'admin' }, { resource: 'res1', action: 'act1' });
      acm.checkAccess({ id: 'user2', role: 'viewer' }, { resource: 'res2', action: 'act2' });

      const user1Logs = acm.getAccessLogs({ principal: 'user1' });

      expect(user1Logs.length).toBe(1);
      expect(user1Logs[0].principal).toBe('user1');
    });

    test('should filter logs by allowed status', () => {
      acm.checkAccess({ id: 'user1', role: 'admin' }, { resource: 'res1', action: 'act1' });
      acm.checkAccess({ id: 'user1', role: 'restricted' }, { resource: 'res2', action: 'execute' });

      const deniedLogs = acm.getAccessLogs({ allowed: false });

      expect(deniedLogs.length).toBeGreaterThan(0);
      expect(deniedLogs.every(l => l.allowed === false)).toBe(true);
    });

    test('should maintain log size limit', () => {
      const acm2 = new AccessControlManager({ maxLogSize: 5 });

      for (let i = 0; i < 10; i++) {
        acm2.checkAccess({ id: 'user', role: 'admin' }, { resource: 'r', action: 'a' });
      }

      expect(acm2.accessLog.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Security Report', () => {
    test('should generate security report', () => {
      acm.createCapability('user', 'doc', 'read');
      acm.addPolicy({
        effect: 'Allow',
        actions: ['read'],
        conditions: () => true
      });
      // Trigger access log
      acm.checkAccess({ id: 'user1', role: 'admin' }, { resource: 'resource', action: 'action' });

      const report = acm.getSecurityReport();

      expect(report.rbac.rolesCount).toBeGreaterThan(0);
      expect(report.cbac.capabilitiesCount).toBe(1);
      expect(report.abac.policiesCount).toBe(1);
      expect(report.audit.logSize).toBeGreaterThan(0);
    });

    test('should report cache status', () => {
      const principal = { id: 'user1', role: 'admin' };
      acm.checkAccess(principal, { resource: 'res', action: 'act' });

      const report = acm.getSecurityReport();

      expect(report.cache.enabled).toBe(true);
      expect(report.cache.cacheSize).toBeGreaterThan(0);
    });
  });

  describe('Role Hierarchy', () => {
    test('should initialize default hierarchy', () => {
      expect(acm.roleHierarchy.has('admin')).toBe(true);
      expect(acm.roleHierarchy.has('operator')).toBe(true);
      expect(acm.roleHierarchy.has('viewer')).toBe(true);
    });

    test('operator should have higher permissions than viewer', () => {
      const opRole = acm.roles.get('operator');
      const viewerRole = acm.roles.get('viewer');

      expect(opRole.permissions.length).toBeGreaterThan(viewerRole.permissions.length);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty permission request', () => {
      const principal = { id: 'user1', role: 'admin' };
      const request = { resource: '', action: '' };

      const result = acm.checkAccess(principal, request);

      expect(result).toBeTruthy();
      expect(result.allowed).toBe(true); // Admin has all access
    });

    test('should handle special characters in resource names', () => {
      const principal = { id: 'user1', role: 'admin' };
      const request = { resource: 'resource:special-chars_123', action: 'action' };

      const result = acm.checkAccess(principal, request);

      expect(result.allowed).toBe(true);
    });
  });
});
