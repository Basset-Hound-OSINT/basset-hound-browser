/**
 * Security Policy Enforcer Tests
 *
 * Tests: 15+ policy enforcement scenarios
 * Coverage: Password, session, API, data, resource policies
 */

const PolicyEnforcer = require('../../src/security/policy-enforcer');

describe('Security Policy Enforcer', () => {
  let enforcer;

  beforeEach(() => {
    enforcer = new PolicyEnforcer();
  });

  describe('Password Policy', () => {
    test('Valid strong password passes', () => {
      const result = enforcer.validatePassword('Str0ng!Password');
      expect(result.valid).toBe(true);
      expect(result.strength).toBeGreaterThan(80);
    });

    test('Too short password fails', () => {
      const result = enforcer.validatePassword('Short1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('at least'));
    });

    test('Password without uppercase fails', () => {
      const result = enforcer.validatePassword('lowercase123!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('uppercase'));
    });

    test('Password without numbers fails', () => {
      const result = enforcer.validatePassword('NoNumbers!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('number'));
    });

    test('Password without special chars fails', () => {
      const result = enforcer.validatePassword('NoSpecial123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('special'));
    });

    test('Password strength scoring works', () => {
      const weak = enforcer.validatePassword('OnlyUpper123!');
      const strong = enforcer.validatePassword('VeryStr0ng!Password');

      expect(strong.strength).toBeGreaterThan(weak.strength);
    });
  });

  describe('Session Policy', () => {
    test('Valid session passes', () => {
      const session = {
        createdAt: Date.now(),
        lastActivityAt: Date.now()
      };

      const result = enforcer.validateSession(session);
      expect(result.valid).toBe(true);
    });

    test('Expired session fails', () => {
      const session = {
        createdAt: Date.now() - 4000000,  // 4000 seconds old
        lastActivityAt: Date.now()
      };

      const result = enforcer.validateSession(session);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('session_expired');
    });

    test('Idle session fails', () => {
      const session = {
        createdAt: Date.now(),
        lastActivityAt: Date.now() - 2000000  // 2000 seconds idle
      };

      const result = enforcer.validateSession(session);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('session_idle');
    });

    test('Missing session fails', () => {
      const result = enforcer.validateSession(null);
      expect(result.valid).toBe(false);
    });
  });

  describe('API Request Policy', () => {
    test('Valid HTTPS request passes', () => {
      const request = {
        protocol: 'https',
        contentLength: 1000,
        tlsVersion: '1.2'
      };

      const result = enforcer.validateAPIRequest(request);
      expect(result.valid).toBe(true);
    });

    test('HTTP request fails (HTTPS required)', () => {
      const request = {
        protocol: 'http'
      };

      const result = enforcer.validateAPIRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('HTTPS'));
    });

    test('Oversized request fails', () => {
      const request = {
        protocol: 'https',
        contentLength: 100 * 1024 * 1024  // 100MB
      };

      const result = enforcer.validateAPIRequest(request);
      expect(result.valid).toBe(false);
    });

    test('Old TLS version fails', () => {
      const request = {
        protocol: 'https',
        tlsVersion: '1.0'
      };

      const result = enforcer.validateAPIRequest(request);
      expect(result.valid).toBe(false);
    });
  });

  describe('Data Protection Policy', () => {
    test('Encrypted data passes', () => {
      const data = {
        content: 'secret',
        encrypted: true,
        masked: true
      };

      const result = enforcer.validateDataAccess(data);
      expect(result.valid).toBe(true);
    });

    test('Unencrypted data fails', () => {
      const data = {
        content: 'secret',
        encrypted: false
      };

      const result = enforcer.validateDataAccess(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('encrypted'));
    });

    test('PII detection works', () => {
      const hasEmail = {
        content: 'Email: test@example.com',
        encrypted: true
      };

      expect(enforcer.hasPII(hasEmail)).toBe(true);
    });

    test('SSN detection works', () => {
      const hasSSN = {
        content: 'SSN: 123-45-6789',
        encrypted: true
      };

      expect(enforcer.hasPII(hasSSN)).toBe(true);
    });

    test('Unmasked PII fails', () => {
      const data = {
        content: 'email@test.com',
        encrypted: true,
        masked: false
      };

      const result = enforcer.validateDataAccess(data);
      expect(result.valid).toBe(false);
    });
  });

  describe('Resource Limit Policy', () => {
    test('Normal resource usage passes', () => {
      const resources = {
        memoryMb: 512,
        cpuPercent: 50,
        openConnections: 100
      };

      const result = enforcer.validateResourceUsage(resources);
      expect(result.valid).toBe(true);
    });

    test('Excessive memory fails', () => {
      const resources = {
        memoryMb: 2000  // Exceeds 1024MB limit
      };

      const result = enforcer.validateResourceUsage(resources);
      expect(result.valid).toBe(false);
      expect(result.violations).toContain(expect.stringContaining('Memory'));
    });

    test('Excessive CPU fails', () => {
      const resources = {
        cpuPercent: 90  // Exceeds 80% limit
      };

      const result = enforcer.validateResourceUsage(resources);
      expect(result.valid).toBe(false);
    });

    test('Too many connections fails', () => {
      const resources = {
        openConnections: 2000  // Exceeds 1000 limit
      };

      const result = enforcer.validateResourceUsage(resources);
      expect(result.valid).toBe(false);
    });

    test('Execution timeout fails', () => {
      const resources = {
        executionTimeMs: 90000  // Exceeds 60000ms limit
      };

      const result = enforcer.validateResourceUsage(resources);
      expect(result.valid).toBe(false);
    });
  });

  describe('Comprehensive Policy Enforcement', () => {
    test('All valid policies pass', () => {
      const context = {
        request: { protocol: 'https' },
        session: {
          createdAt: Date.now(),
          lastActivityAt: Date.now()
        },
        data: { encrypted: true, masked: true },
        resources: { memoryMb: 512 }
      };

      const result = enforcer.enforceAll(context);
      expect(result.allowed).toBe(true);
    });

    test('Any policy violation blocks', () => {
      const context = {
        request: { protocol: 'http' },  // Violates API policy
        session: {
          createdAt: Date.now(),
          lastActivityAt: Date.now()
        }
      };

      const result = enforcer.enforceAll(context);
      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Policy Management', () => {
    test('Get current policies', () => {
      const policies = enforcer.getPolicies();
      expect(policies.password).toBeDefined();
      expect(policies.session).toBeDefined();
      expect(policies.api).toBeDefined();
    });

    test('Update policy', () => {
      enforcer.updatePolicy('password.minLength', 20);
      const result = enforcer.validatePassword('Str0ng!Pass');  // 11 chars
      expect(result.valid).toBe(false);
    });

    test('Update nested policy', () => {
      enforcer.updatePolicy('api.requireHttps', false);
      const request = { protocol: 'http' };
      const result = enforcer.validateAPIRequest(request);
      expect(result.valid).toBe(true);
    });
  });

  describe('Violation Tracking', () => {
    test('Log policy violation', () => {
      enforcer.logViolation('password', 'Too short');
      const violations = enforcer.getViolations();
      expect(violations.length).toBeGreaterThan(0);
    });

    test('Multiple violations tracked', () => {
      enforcer.logViolation('password', 'Too short');
      enforcer.logViolation('session', 'Expired');
      enforcer.logViolation('api', 'Invalid TLS');

      const violations = enforcer.getViolations();
      expect(violations.length).toBe(3);
    });

    test('Violations can be cleared', () => {
      enforcer.logViolation('test', 'Test violation');
      enforcer.clearViolations();
      const violations = enforcer.getViolations();
      expect(violations.length).toBe(0);
    });

    test('Violation limit enforced', () => {
      for (let i = 0; i < 150; i++) {
        enforcer.logViolation('test', `Violation ${i}`);
      }
      const violations = enforcer.getViolations(100);
      expect(violations.length).toBe(100);
    });
  });

  describe('Policy Disabling', () => {
    test('Disabled policies skip validation', () => {
      const customEnforcer = new PolicyEnforcer({
        password: { enabled: false }
      });

      const result = customEnforcer.validatePassword('weak');
      expect(result.valid).toBe(true);
    });

    test('Multiple policies can be disabled', () => {
      const customEnforcer = new PolicyEnforcer({
        password: { enabled: false },
        api: { enabled: false }
      });

      const passResult = customEnforcer.validatePassword('weak');
      const apiResult = customEnforcer.validateAPIRequest({ protocol: 'http' });

      expect(passResult.valid).toBe(true);
      expect(apiResult.valid).toBe(true);
    });
  });
});
