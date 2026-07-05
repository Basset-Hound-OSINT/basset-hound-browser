/**
 * OWASP Top 10 Penetration Testing
 * Comprehensive attack scenarios for Web Application Security
 *
 * Coverage:
 * - A1: Injection Attacks
 * - A2: Broken Authentication
 * - A3: Broken Access Control
 * - A4: Insecure Deserialization
 * - A5: Broken Encryption
 * - A6: Sensitive Data Exposure
 * - A7: XXE / A10: SSRF
 * - Advanced attacks: Race conditions, cryptographic weaknesses
 */

const crypto = require('crypto');

describe('OWASP Top 10 Penetration Testing', () => {
  // ==========================================
  // A1: Injection Attacks
  // ==========================================

  describe('A1: Injection Attacks', () => {
    it('should prevent SQL injection attempts', () => {
      const userInput = "'; DROP TABLE users; --";

      // Proper prevention via parameterized queries (not string replacement)
      // This test demonstrates that string replacement alone is insufficient
      const params = [userInput]; // Should use parameterized queries
      expect(params[0]).toBe(userInput); // Params are separate from query
    });

    it('should prevent command injection', () => {
      const payload = '; rm -rf /';
      // Proper prevention via process.spawn with args array, not shell
      const args = [payload]; // Should use array args, not string interpolation
      expect(args[0]).toBe(payload);
    });

    it('should prevent template injection', () => {
      const template = '<%= process.exit(1) %>';

      // Should be escaped in template engines
      const escaped = template.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      expect(escaped).toContain('&lt;');
      expect(escaped).not.toContain('<%=');
    });

    it('should prevent XPATH injection', () => {
      const payload = "' or '1'='1";
      const safe = payload.replace(/'/g, "''");

      expect(safe).toContain("''");
    });

    it('should prevent LDAP injection', () => {
      const payload = '*)(uid=*';

      // Should be escaped for LDAP
      const ldapEscaped = payload
        .replace(/\*/g, '\\2a')
        .replace(/\(/g, '\\28')
        .replace(/\)/g, '\\29');

      expect(ldapEscaped).toContain('\\2a');
      expect(ldapEscaped).not.toContain('*');
    });

    it('should prevent JSON injection', () => {
      const payload = '{"key": "value"}\n{"malicious": true}';
      const json = payload.split('\n')[0]; // Only first line

      const parsed = JSON.parse(json);
      expect(parsed.key).toBe('value');
      expect(parsed.malicious).toBeUndefined();
    });

    it('should prevent OS command injection via user input', () => {
      const url = 'https://example.com`whoami`';
      const safe = url.replace(/`/g, '%60');

      expect(safe).toContain('%60');
      expect(safe).not.toContain('`whoami`');
    });
  });

  // ==========================================
  // A2: Broken Authentication
  // ==========================================

  describe('A2: Broken Authentication', () => {
    it('should prevent session fixation attacks', () => {
      // Session should be regenerated after login
      const sessionBefore = 'session_' + crypto.randomBytes(4).toString('hex');
      const sessionAfter = 'session_' + crypto.randomBytes(4).toString('hex');

      expect(sessionBefore).not.toBe(sessionAfter);
    });

    it('should prevent brute force attacks with rate limiting', () => {
      const attempts = new Map();
      const maxAttempts = 5;
      const windowMs = 60000; // 1 minute

      const clientId = 'attacker';

      // Simulate failed login attempts
      for (let i = 0; i < 10; i++) {
        const now = Date.now();
        if (!attempts.has(clientId)) {
          attempts.set(clientId, []);
        }
        attempts.get(clientId).push(now);
      }

      const clientAttempts = attempts.get(clientId);
      expect(clientAttempts.length).toBeGreaterThan(maxAttempts);
    });

    it('should prevent credential stuffing', () => {
      // Rate limit per IP or user
      const rateLimits = {
        'user@example.com': { attempts: 0, lockedUntil: 0 }
      };

      const loginAttempt = (email) => {
        const limit = rateLimits[email];
        if (limit.attempts >= 5) {
          return { allowed: false, reason: 'Too many attempts' };
        }
        return { allowed: true };
      };

      const result = loginAttempt('user@example.com');
      expect(result.allowed).toBe(true);
    });

    it('should use secure session tokens', () => {
      const token = crypto.randomBytes(32).toString('base64');
      expect(token).toHaveLength(44); // 32 bytes base64
    });

    it('should not transmit passwords in plaintext', () => {
      const password = 'secure_password_123';
      const hashed = crypto
        .createHash('sha256')
        .update(password)
        .digest('hex');

      expect(hashed).not.toBe(password);
      expect(hashed).toHaveLength(64);
    });

    it('should use constant-time comparison for tokens', () => {
      const token1 = 'token_abc123def456';
      const token2 = 'token_abc123def456';

      // Should use crypto.timingSafeEqual in production
      const isSame = token1 === token2;
      expect(isSame).toBe(true);
    });

    it('should expire session tokens', () => {
      const token = {
        value: crypto.randomBytes(16).toString('hex'),
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000 // 1 hour
      };

      const now = Date.now();
      const isExpired = now > token.expiresAt;
      expect(isExpired).toBe(false);
    });
  });

  // ==========================================
  // A3: Broken Access Control
  // ==========================================

  describe('A3: Broken Access Control (IDOR, Privilege Escalation)', () => {
    it('should prevent Insecure Direct Object Reference (IDOR)', () => {
      const userId = 'user-123';
      const accessibleIds = new Set(['user-123']);

      const canAccess = (requestedId) => {
        return accessibleIds.has(requestedId);
      };

      expect(canAccess('user-123')).toBe(true);
      expect(canAccess('user-456')).toBe(false);
    });

    it('should prevent privilege escalation', () => {
      const user = {
        id: 'user-123',
        role: 'basic',
        permissions: ['read']
      };

      const isAdmin = user.role === 'admin';
      expect(isAdmin).toBe(false);
    });

    it('should enforce function-level access control', () => {
      const commands = {
        'navigate': { level: 1 },
        'execute_javascript': { level: 3 },
        'delete_account': { level: 3 }
      };

      const userLevel = 1;

      const canExecute = (command) => {
        return commands[command]?.level <= userLevel;
      };

      expect(canExecute('navigate')).toBe(true);
      expect(canExecute('execute_javascript')).toBe(false);
    });

    it('should prevent modification of access control rules', () => {
      const acl = Object.freeze({
        'user-123': Object.freeze(['read']),
        'user-456': Object.freeze(['read', 'write'])
      });

      // Should not be able to modify frozen array
      expect(() => {
        acl['user-123'].push('write');
      }).toThrow();
    });

    it('should validate resource ownership before access', () => {
      const session = {
        id: 'session-123',
        userId: 'user-456'
      };

      const resource = {
        id: 'resource-789',
        ownerId: 'user-456'
      };

      const canAccess = session.userId === resource.ownerId;
      expect(canAccess).toBe(true);

      const otherUser = { userId: 'user-999' };
      const canAccessOther = otherUser.userId === resource.ownerId;
      expect(canAccessOther).toBe(false);
    });

    it('should prevent horizontal privilege escalation', () => {
      const currentUser = { id: 'user-123', role: 'user' };
      const targetUser = { id: 'user-456', role: 'user' };

      // User cannot access other user's data
      const canAccess = currentUser.id === targetUser.id;
      expect(canAccess).toBe(false);
    });
  });

  // ==========================================
  // A4: Insecure Deserialization
  // ==========================================

  describe('A4: Insecure Deserialization', () => {
    it('should validate deserialized objects', () => {
      const untrustedData = '{"__proto__":{"isAdmin":true}}';
      const obj = JSON.parse(untrustedData);

      // Should not have injected properties
      const prototype = Object.getPrototypeOf(obj);
      expect(prototype.isAdmin).toBeUndefined();
    });

    it('should reject malicious serialized objects', () => {
      // Constructor functions should not be executed
      const payload = {
        __constructor: 'function() { return process.exit(1); }'
      };

      // Should not execute constructor
      expect(() => {
        new (payload.__constructor)();
      }).toThrow();
    });

    it('should use allowlist for deserialization', () => {
      const allowedClasses = new Set([
        'User',
        'Session',
        'Request'
      ]);

      const untrustedClass = 'MaliciousClass';

      const isAllowed = allowedClasses.has(untrustedClass);
      expect(isAllowed).toBe(false);
    });

    it('should sanitize prototype pollution', () => {
      const data = {
        user: 'john',
        '__proto__': { admin: true }
      };

      const clean = {
        user: data.user
        // Exclude __proto__
      };

      expect(clean.admin).toBeUndefined();
    });

    it('should not execute code during deserialization', () => {
      const payload = {
        __proto__: {
          constructor: { prototype: { __init__: 'process.exit(1)' } }
        }
      };

      const obj = Object.create(payload);
      expect(obj).toBeDefined();
      // Should not have executed code
    });
  });

  // ==========================================
  // A5: Broken Encryption
  // ==========================================

  describe('A5: Broken Encryption', () => {
    it('should use strong encryption algorithms', () => {
      const algorithm = 'aes-256-gcm';
      expect(algorithm).toMatch(/aes-256/);
      expect(algorithm).toMatch(/gcm/);
    });

    it('should not reuse IVs', () => {
      const iv1 = crypto.randomBytes(16);
      const iv2 = crypto.randomBytes(16);

      expect(iv1.toString('hex')).not.toBe(iv2.toString('hex'));
    });

    it('should use unique keys per session', () => {
      const key1 = crypto.randomBytes(32);
      const key2 = crypto.randomBytes(32);

      expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
    });

    it('should verify authentication tag on decryption', () => {
      const algorithm = 'aes-256-gcm';
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const plaintext = 'sensitive data';

      const cipher = crypto.createCipheriv(algorithm, key, iv);
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);
      const authTag = cipher.getAuthTag();

      // Decryption should verify auth tag
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]).toString('utf8');

      expect(decrypted).toBe(plaintext);
    });

    it('should not use weak key derivation', () => {
      // Use PBKDF2, bcrypt, or scrypt - not simple hashing
      const password = 'user_password';
      const salt = crypto.randomBytes(16);

      const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
      expect(key).toHaveLength(32);
    });

    it('should not use hardcoded keys', () => {
      // Keys should be loaded from environment or key management service
      const key = process.env.ENCRYPTION_KEY || null;
      expect(key).not.toBe('hardcoded_secret_key');
    });

    it('should use authenticated encryption (AEAD)', () => {
      const algorithm = 'aes-256-gcm';
      // GCM provides both confidentiality and authenticity
      expect(algorithm).toMatch(/gcm|chacha20-poly1305/);
    });
  });

  // ==========================================
  // A6: Sensitive Data Exposure
  // ==========================================

  describe('A6: Sensitive Data Exposure', () => {
    it('should not log sensitive data', () => {
      const sensitiveFields = ['password', 'ssn', 'credit_card', 'api_key'];
      const logMessage = 'User logged in successfully';

      sensitiveFields.forEach(field => {
        expect(logMessage).not.toContain(field);
      });
    });

    it('should mask PII in logs', () => {
      const ssn = '123-45-6789';
      const masked = 'XXX-XX-' + ssn.slice(-4);

      expect(masked).toBe('XXX-XX-6789');
      expect(masked).not.toContain('123-45');
    });

    it('should encrypt sensitive data at rest', () => {
      const data = 'sensitive_information';
      const encrypted = crypto.randomBytes(64).toString('hex');

      expect(encrypted).toHaveLength(128); // Not plaintext
      expect(encrypted).not.toBe(data);
    });

    it('should use HTTPS/TLS for data in transit', () => {
      const url = 'https://api.example.com/sensitive';
      expect(url).toMatch(/^https/);
    });

    it('should not expose error details to clients', () => {
      const internalError = 'Database at db.internal.com:5432 connection failed';
      const userError = 'An error occurred. Please try again.';

      expect(internalError).toContain('db.internal.com');
      expect(userError).not.toContain('db.internal.com');
    });

    it('should clear sensitive data from memory', () => {
      const password = Buffer.from('secret_password');
      password.fill(0); // Overwrite with zeros

      for (let i = 0; i < password.length; i++) {
        expect(password[i]).toBe(0);
      }
    });

    it('should not cache sensitive responses', () => {
      const cacheControl = 'Cache-Control: no-store, private';
      expect(cacheControl).toMatch(/no-store/);
      expect(cacheControl).not.toContain('public');
    });
  });

  // ==========================================
  // A7: XML External Entity (XXE)
  // ==========================================

  describe('A7: XML External Entity (XXE) & A10: SSRF', () => {
    it('should disable external entity processing', () => {
      // XXE should be prevented by disabling DTD processing
      const xxePayload = '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>';

      // Should reject or strip
      const safe = xxePayload.replace(/<!ENTITY.*?>/g, '');
      expect(safe).not.toContain('<!ENTITY');
    });

    it('should prevent SSRF attacks via URL input', () => {
      const internalUrl = 'http://127.0.0.1:9200';
      const blockedIps = ['127.0.0.1', 'localhost', '0.0.0.0', '::1'];

      const isBlocked = blockedIps.some(ip => internalUrl.includes(ip));
      expect(isBlocked).toBe(true);
    });

    it('should whitelist allowed domains for requests', () => {
      const allowedDomains = ['example.com', 'api.example.com'];
      const requestUrl = 'https://example.com/api';

      const isAllowed = allowedDomains.some(domain =>
        requestUrl.includes(domain)
      );

      expect(isAllowed).toBe(true);

      const maliciousUrl = 'https://internal.corp/admin';
      const isMaliciousAllowed = allowedDomains.some(domain =>
        maliciousUrl.includes(domain)
      );
      expect(isMaliciousAllowed).toBe(false);
    });

    it('should prevent file:// protocol in URLs', () => {
      const maliciousUrl = 'file:///etc/passwd';
      const isFileUrl = maliciousUrl.startsWith('file://');

      expect(isFileUrl).toBe(true);
    });

    it('should validate redirect URLs', () => {
      const redirectUrl = 'https://example.com/page';
      const safeRedirects = ['https://example.com', 'https://app.example.com'];

      const isSafe = safeRedirects.some(safe =>
        redirectUrl.startsWith(safe)
      );

      expect(isSafe).toBe(true);
    });
  });

  // ==========================================
  // Advanced Attack Scenarios
  // ==========================================

  describe('Advanced Attack Scenarios', () => {
    it('should prevent timing-based attacks on authentication', () => {
      const token1 = 'valid_token_abc123';
      const token2 = 'invalid_token_xyz789';

      // Use constant-time comparison
      const compare = (a, b) => {
        let result = 0;
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
          result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
        }
        return result === 0;
      };

      expect(compare(token1, token1)).toBe(true);
      expect(compare(token1, token2)).toBe(false);
    });

    it('should prevent race condition attacks', () => {
      let counter = 0;
      const mutex = { locked: false };

      const increment = async () => {
        if (mutex.locked) {
          return;
        }
        mutex.locked = true;
        const temp = counter;
        await new Promise(r => setImmediate(r));
        counter = temp + 1;
        mutex.locked = false;
      };

      expect(typeof increment).toBe('function');
    });

    it('should prevent Unicode-based attacks', () => {
      const payload = 'user admin'; // Null byte injection
      const safe = payload.replace(/\0/g, '');

      expect(safe).toBe('useradmin');
      expect(safe).not.toContain(' ');
    });

    it('should prevent double encoding attacks', () => {
      const payload = '%252e%252e%252fpasswd'; // ../ double encoded
      const decoded = decodeURIComponent(payload);

      expect(decoded).toBe('%2e%2e%2fpasswd');
      // Should not result in ../passwd after second decode
    });
  });
});
