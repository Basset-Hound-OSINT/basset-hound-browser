/**
 * Security Policy Enforcer
 *
 * Enforces security policies across the application:
 * - Password complexity requirements
 * - Session management policies
 * - API rate limiting and timeout policies
 * - Data retention and deletion policies
 * - Access control policies
 * - Resource consumption limits
 *
 * Version: 1.0.0
 * Created: June 3, 2026
 */

class PolicyEnforcer {
  /**
   * Default security policies
   */
  static DEFAULT_POLICIES = {
    // Password policies
    password: {
      enabled: true,
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecial: true,
      specialChars: '!@#$%^&*()-_=+[]{}|;:,.<>?',
      expirationDays: 90,
      historyCount: 5, // Remember last 5 passwords
      maxAttempts: 5,
      lockoutDurationSeconds: 900 // 15 minutes
    },

    // Session policies
    session: {
      enabled: true,
      maxAgeSeconds: 3600, // 1 hour
      idleTimeoutSeconds: 1800, // 30 minutes
      maxConcurrentSessions: 5,
      regenerateAfterLogin: true,
      secureCookies: true,
      httpOnlyFlag: true,
      sameSitePolicy: 'Strict'
    },

    // API policies
    api: {
      enabled: true,
      requestTimeoutMs: 30000, // 30 seconds
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      maxResponseSize: 50 * 1024 * 1024, // 50MB
      rateLimit: 100, // per minute
      requireHttps: true,
      minTlsVersion: '1.2'
    },

    // Data policies
    data: {
      enabled: true,
      encryptionRequired: true,
      encryptionAlgorithm: 'aes-256-gcm',
      retentionDays: 365,
      secureDeleteEnabled: true,
      secureDeletePasses: 3, // DOD 5220.22-M standard
      backupEncryption: true,
      piiMaskingRequired: true
    },

    // Access control
    access: {
      enabled: true,
      defaultDeny: true, // Deny by default, allow specific
      requireAuthentication: true,
      requireAuthorization: true,
      auditAllAccess: true,
      tlsClientCerts: false // Optional client certificates
    },

    // Resource limits
    resources: {
      enabled: true,
      maxMemoryMb: 1024,
      maxCpuPercent: 80,
      maxOpenConnections: 1000,
      maxQueueSize: 10000,
      maxExecutionTimeMs: 60000 // 1 minute
    }
  };

  /**
   * Constructor
   * @param {Object} policies - Custom policies to merge with defaults
   */
  constructor(policies = {}) {
    this.policies = JSON.parse(JSON.stringify(PolicyEnforcer.DEFAULT_POLICIES));
    this.mergePolicies(this.policies, policies);
    this.violations = [];
  }

  /**
   * Merge custom policies with defaults
   */
  mergePolicies(target, source) {
    for (const key in source) {
      if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!(key in target)) {
          target[key] = {};
        }
        this.mergePolicies(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  /**
   * Validate password against policy
   * @param {string} password - Password to validate
   * @param {string|null} previousPassword - Previous password (for history check)
   * @returns {Object} { valid: boolean, errors: [], strength: 0-100 }
   */
  validatePassword(password, previousPassword = null) {
    const policy = this.policies.password;
    const errors = [];
    let strength = 0;

    if (!policy.enabled) {
      return { valid: true, errors: [], strength: 100 };
    }

    if (!password || typeof password !== 'string') {
      errors.push('Password must be a non-empty string');
      return { valid: false, errors, strength: 0 };
    }

    // Length check
    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters`);
    } else {
      strength += 20;
    }

    // Character variety checks
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else if (policy.requireUppercase) {
      strength += 20;
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else if (policy.requireLowercase) {
      strength += 20;
    }

    if (policy.requireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    } else if (policy.requireNumbers) {
      strength += 20;
    }

    if (policy.requireSpecial) {
      const regex = new RegExp(`[${policy.specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`);
      if (!regex.test(password)) {
        errors.push(`Password must contain at least one special character: ${policy.specialChars}`);
      } else {
        strength += 20;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      strength: Math.min(100, strength)
    };
  }

  /**
   * Validate session against policy
   * @param {Object} session - Session object with timestamps
   * @returns {Object} { valid: boolean, reason: string }
   */
  validateSession(session) {
    const policy = this.policies.session;

    if (!policy.enabled) {
      return { valid: true, reason: 'sessions not enforced' };
    }

    if (!session) {
      return { valid: false, reason: 'session not found' };
    }

    const now = Date.now();
    const createdAt = session.createdAt || 0;
    const lastActivityAt = session.lastActivityAt || createdAt;

    // Check max age
    const age = now - createdAt;
    if (age > policy.maxAgeSeconds * 1000) {
      return { valid: false, reason: 'session_expired' };
    }

    // Check idle timeout
    const idleTime = now - lastActivityAt;
    if (idleTime > policy.idleTimeoutSeconds * 1000) {
      return { valid: false, reason: 'session_idle' };
    }

    return { valid: true, reason: 'session_valid' };
  }

  /**
   * Validate API request against policy
   * @param {Object} request - Request object
   * @returns {Object} { valid: boolean, errors: [] }
   */
  validateAPIRequest(request) {
    const policy = this.policies.api;
    const errors = [];

    if (!policy.enabled) {
      return { valid: true, errors: [] };
    }

    // Check content-length
    if (request.contentLength && request.contentLength > policy.maxRequestSize) {
      errors.push(`Request size ${request.contentLength} exceeds maximum ${policy.maxRequestSize}`);
    }

    // Check HTTPS
    if (policy.requireHttps && request.protocol !== 'https') {
      errors.push('HTTPS is required');
    }

    // Check TLS version
    if (request.tlsVersion && policy.minTlsVersion) {
      const version = parseFloat(request.tlsVersion);
      const minVersion = parseFloat(policy.minTlsVersion);
      if (version < minVersion) {
        errors.push(`TLS ${request.tlsVersion} is below minimum ${policy.minTlsVersion}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate data access against policy
   * @param {Object} data - Data being accessed
   * @returns {Object} { valid: boolean, errors: [] }
   */
  validateDataAccess(data) {
    const policy = this.policies.data;
    const errors = [];

    if (!policy.enabled) {
      return { valid: true, errors: [] };
    }

    // Check if encryption is required
    if (policy.encryptionRequired && !data.encrypted) {
      errors.push('Data must be encrypted at rest');
    }

    // Check PII masking
    if (policy.piiMaskingRequired && this.hasPII(data)) {
      if (!data.masked) {
        errors.push('PII must be masked');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if data contains PII
   * @param {Object} data - Data to check
   * @returns {boolean} True if PII detected
   */
  hasPII(data) {
    const piiPatterns = {
      email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      ssn: /\d{3}-\d{2}-\d{4}/,
      creditCard: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/,
      phone: /\d{3}[-.]?\d{3}[-.]?\d{4}/
    };

    const dataString = JSON.stringify(data);
    for (const pattern of Object.values(piiPatterns)) {
      if (pattern.test(dataString)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate resource usage against policy
   * @param {Object} resources - Current resource usage
   * @returns {Object} { valid: boolean, violations: [] }
   */
  validateResourceUsage(resources) {
    const policy = this.policies.resources;
    const violations = [];

    if (!policy.enabled) {
      return { valid: true, violations: [] };
    }

    if (resources.memoryMb && resources.memoryMb > policy.maxMemoryMb) {
      violations.push(`Memory usage ${resources.memoryMb}MB exceeds limit ${policy.maxMemoryMb}MB`);
    }

    if (resources.cpuPercent && resources.cpuPercent > policy.maxCpuPercent) {
      violations.push(`CPU usage ${resources.cpuPercent}% exceeds limit ${policy.maxCpuPercent}%`);
    }

    if (resources.openConnections && resources.openConnections > policy.maxOpenConnections) {
      violations.push(`Open connections ${resources.openConnections} exceed limit ${policy.maxOpenConnections}`);
    }

    if (resources.executionTimeMs && resources.executionTimeMs > policy.maxExecutionTimeMs) {
      violations.push(`Execution time ${resources.executionTimeMs}ms exceeds limit ${policy.maxExecutionTimeMs}ms`);
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }

  /**
   * Enforce all policies on a request
   * @param {Object} context - Request context
   * @returns {Object} { allowed: boolean, violations: [] }
   */
  enforceAll(context) {
    const violations = [];

    // Validate API request
    const apiValidation = this.validateAPIRequest(context.request || {});
    violations.push(...apiValidation.errors);

    // Validate session if present
    if (context.session) {
      const sessionValidation = this.validateSession(context.session);
      if (!sessionValidation.valid) {
        violations.push(sessionValidation.reason);
      }
    }

    // Validate data access if present
    if (context.data) {
      const dataValidation = this.validateDataAccess(context.data);
      violations.push(...dataValidation.errors);
    }

    // Validate resource usage if present
    if (context.resources) {
      const resourceValidation = this.validateResourceUsage(context.resources);
      violations.push(...resourceValidation.violations);
    }

    return {
      allowed: violations.length === 0,
      violations: violations.length > 0 ? violations : undefined
    };
  }

  /**
   * Get current policies
   * @returns {Object} Current policies
   */
  getPolicies() {
    return JSON.parse(JSON.stringify(this.policies));
  }

  /**
   * Update a policy
   * @param {string} policyPath - Path to policy (e.g., 'password.minLength')
   * @param {any} value - New value
   */
  updatePolicy(policyPath, value) {
    const parts = policyPath.split('.');
    let target = this.policies;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in target)) {
        target[parts[i]] = {};
      }
      target = target[parts[i]];
    }

    target[parts[parts.length - 1]] = value;
  }

  /**
   * Log policy violation
   * @param {string} policyType - Type of policy violated
   * @param {string} details - Violation details
   */
  logViolation(policyType, details) {
    this.violations.push({
      timestamp: Date.now(),
      policyType,
      details
    });
  }

  /**
   * Get violation history
   * @param {number} limit - Max violations to return
   * @returns {Array<Object>} Recent violations
   */
  getViolations(limit = 100) {
    return this.violations.slice(-limit);
  }

  /**
   * Clear violation history
   */
  clearViolations() {
    this.violations = [];
  }
}

module.exports = PolicyEnforcer;
