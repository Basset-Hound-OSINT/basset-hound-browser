/**
 * Advanced Access Control Module
 *
 * Implements multiple access control models:
 * - Role-Based Access Control (RBAC)
 * - Capability-Based Access Control (CBAC)
 * - Attribute-Based Access Control (ABAC)
 * - Dynamic access decisions
 *
 * Version: 1.0.0
 * Created: June 13, 2026
 */

const crypto = require('crypto');

/**
 * AccessControlManager - Multi-model access control
 */
class AccessControlManager {
  constructor(options = {}) {
    // RBAC Configuration
    this.roles = new Map(options.roles || []);
    this.permissions = new Map(options.permissions || []);
    this.roleHierarchy = new Map(options.roleHierarchy || []);

    // CBAC Configuration
    this.capabilities = new Map();
    this.capabilityTokens = new Map();

    // ABAC Configuration
    this.attributes = new Map();
    this.policies = [];

    // Access decision cache
    this.decisionCache = new Map();
    this.cacheExpiration = options.cacheExpiration || 3600000; // 1 hour
    this.enableCaching = options.enableCaching !== false;

    // Audit logging
    this.accessLog = [];
    this.maxLogSize = options.maxLogSize || 10000;

    // Initialize default roles
    this.initializeDefaultRoles();
  }

  /**
   * Initialize default system roles
   */
  initializeDefaultRoles() {
    // Administrator role - full access
    this.defineRole('admin', {
      description: 'System Administrator',
      permissions: ['*'],
      priority: 100
    });

    // Operator role - operational commands
    this.defineRole('operator', {
      description: 'System Operator',
      permissions: [
        'navigate',
        'click',
        'fill',
        'type',
        'screenshot',
        'get_content',
        'get_cookies',
        'list_sessions',
        'list_tabs'
      ],
      priority: 50
    });

    // Read-only role - data access only
    this.defineRole('viewer', {
      description: 'Read-Only Viewer',
      permissions: [
        'get_content',
        'get_cookies',
        'screenshot',
        'list_sessions',
        'list_tabs',
        'status'
      ],
      priority: 10
    });

    // Restricted role - minimal access
    this.defineRole('restricted', {
      description: 'Restricted User',
      permissions: ['status', 'ping'],
      priority: 1
    });

    // Setup role hierarchy
    this.roleHierarchy.set('admin', []);
    this.roleHierarchy.set('operator', ['viewer']);
    this.roleHierarchy.set('viewer', ['restricted']);
    this.roleHierarchy.set('restricted', []);
  }

  /**
   * Define a new role with permissions
   */
  defineRole(roleName, config) {
    if (!config.permissions || !Array.isArray(config.permissions)) {
      throw new Error('Role must have permissions array');
    }

    this.roles.set(roleName, {
      name: roleName,
      description: config.description || '',
      permissions: config.permissions,
      priority: config.priority || 0,
      createdAt: Date.now()
    });

    return this.roles.get(roleName);
  }

  /**
   * Add permission to role
   */
  grantPermission(roleName, permission) {
    const role = this.roles.get(roleName);
    if (!role) {
      throw new Error(`Role ${roleName} does not exist`);
    }

    if (!role.permissions.includes(permission)) {
      role.permissions.push(permission);
      this.clearCache();
    }

    return role;
  }

  /**
   * Remove permission from role
   */
  revokePermission(roleName, permission) {
    const role = this.roles.get(roleName);
    if (!role) {
      throw new Error(`Role ${roleName} does not exist`);
    }

    const index = role.permissions.indexOf(permission);
    if (index !== -1) {
      role.permissions.splice(index, 1);
      this.clearCache();
    }

    return role;
  }

  /**
   * Create capability token (CBAC)
   */
  createCapability(principal, resource, action, constraints = {}) {
    const capabilityId = crypto.randomBytes(16).toString('hex');
    const token = crypto.randomBytes(32).toString('hex');

    const capability = {
      id: capabilityId,
      principal,
      resource,
      action,
      constraints,
      token: crypto.createHash('sha256').update(token).digest('hex'),
      createdAt: Date.now(),
      expiresAt: constraints.expiresAt || Date.now() + 3600000
    };

    this.capabilities.set(capabilityId, capability);
    this.capabilityTokens.set(token, capabilityId);

    return {
      capabilityId,
      token, // Return plain token once
      capability: this.sanitizeCapability(capability)
    };
  }

  /**
   * Verify capability token
   */
  verifyCapability(token, resource, action) {
    const capabilityId = this.capabilityTokens.get(token);
    if (!capabilityId) {
      return { valid: false, reason: 'Invalid token' };
    }

    const capability = this.capabilities.get(capabilityId);
    if (!capability) {
      return { valid: false, reason: 'Capability expired' };
    }

    // Check expiration
    if (capability.expiresAt && Date.now() > capability.expiresAt) {
      this.capabilities.delete(capabilityId);
      this.capabilityTokens.delete(token);
      return { valid: false, reason: 'Capability expired' };
    }

    // Check resource and action
    if (capability.resource !== resource || capability.action !== action) {
      return { valid: false, reason: 'Resource or action mismatch' };
    }

    // Check constraints
    const constraintCheck = this.checkConstraints(capability.constraints);
    if (!constraintCheck.valid) {
      return { valid: false, reason: constraintCheck.reason };
    }

    return {
      valid: true,
      capability: this.sanitizeCapability(capability)
    };
  }

  /**
   * Check capability constraints
   */
  checkConstraints(constraints) {
    if (!constraints) {
      return { valid: true };
    }

    // Check IP constraint
    if (constraints.ipRange) {
      // Simplified IP range check
      if (!this.isIpInRange(constraints.currentIp, constraints.ipRange)) {
        return { valid: false, reason: 'IP constraint violation' };
      }
    }

    // Check time constraint
    if (constraints.timeWindow) {
      const now = Date.now();
      if (now < constraints.timeWindow.start || now > constraints.timeWindow.end) {
        return { valid: false, reason: 'Time constraint violation' };
      }
    }

    // Check usage limit
    if (constraints.maxUsage && constraints.usageCount >= constraints.maxUsage) {
      return { valid: false, reason: 'Usage limit exceeded' };
    }

    return { valid: true };
  }

  /**
   * Define ABAC attribute
   */
  defineAttribute(attributeName, rules) {
    this.attributes.set(attributeName, {
      name: attributeName,
      rules,
      createdAt: Date.now()
    });
  }

  /**
   * Add ABAC policy
   */
  addPolicy(policy) {
    if (!policy.effect || !policy.actions || !policy.conditions) {
      throw new Error('Policy must have effect, actions, and conditions');
    }

    this.policies.push({
      ...policy,
      id: crypto.randomBytes(8).toString('hex'),
      createdAt: Date.now()
    });

    this.clearCache();
  }

  /**
   * Check RBAC permissions
   */
  checkRbacPermission(principal, roleName, resource, action) {
    const role = this.roles.get(roleName);
    if (!role) {
      return { allowed: false, reason: 'Role not found' };
    }

    // Admin has full access
    if (role.permissions.includes('*')) {
      return { allowed: true, reason: 'Admin access' };
    }

    // Check if permission exists
    const permissionRequired = `${resource}:${action}`;
    const hasPermission =
      role.permissions.includes(action) ||
      role.permissions.includes(permissionRequired) ||
      role.permissions.includes('*');

    if (!hasPermission) {
      return { allowed: false, reason: 'Permission denied' };
    }

    return { allowed: true, reason: 'Permission granted' };
  }

  /**
   * Check ABAC permissions
   */
  checkAbacPermission(context) {
    for (const policy of this.policies) {
      if (this.matchesPolicy(context, policy)) {
        return {
          allowed: policy.effect === 'Allow',
          reason: `Policy matched: ${policy.id}`,
          policyId: policy.id
        };
      }
    }

    // Default deny
    return { allowed: false, reason: 'No matching policy' };
  }

  /**
   * Check if context matches policy
   */
  matchesPolicy(context, policy) {
    // Check action
    if (!policy.actions.includes(context.action) && !policy.actions.includes('*')) {
      return false;
    }

    // Check conditions
    if (policy.conditions && typeof policy.conditions === 'function') {
      return policy.conditions(context);
    }

    return true;
  }

  /**
   * Check access - unified interface
   */
  checkAccess(principal, request) {
    const cacheKey = `${principal.id}-${request.resource}-${request.action}-${principal.role}`;

    // Check cache
    if (this.enableCaching) {
      const cached = this.decisionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiration) {
        return cached.decision;
      }
    }

    // Check RBAC first
    let decision = this.checkRbacPermission(principal.id, principal.role, request.resource, request.action);
    if (!decision.allowed) {
      // Try ABAC as fallback
      decision = this.checkAbacPermission({
        principal: principal.id,
        action: request.action,
        resource: request.resource,
        context: request.context
      });
    }

    // Cache decision
    if (this.enableCaching) {
      this.decisionCache.set(cacheKey, {
        decision,
        timestamp: Date.now()
      });
    }

    // Log access attempt
    this.logAccess(principal, request, decision);

    return decision;
  }

  /**
   * Log access attempt
   */
  logAccess(principal, request, decision) {
    const logEntry = {
      timestamp: Date.now(),
      principal: principal.id,
      role: principal.role,
      resource: request.resource,
      action: request.action,
      allowed: decision.allowed,
      reason: decision.reason
    };

    this.accessLog.push(logEntry);

    // Maintain size limit
    if (this.accessLog.length > this.maxLogSize) {
      this.accessLog.shift();
    }
  }

  /**
   * Get access logs
   */
  getAccessLogs(filters = {}) {
    return this.accessLog.filter(entry => {
      if (filters.principal && entry.principal !== filters.principal) return false;
      if (filters.role && entry.role !== filters.role) return false;
      if (filters.resource && entry.resource !== filters.resource) return false;
      if (filters.allowed !== undefined && entry.allowed !== filters.allowed) return false;
      return true;
    });
  }

  /**
   * Clear decision cache
   */
  clearCache() {
    this.decisionCache.clear();
  }

  /**
   * Sanitize capability (remove sensitive info)
   */
  sanitizeCapability(capability) {
    const { token, ...sanitized } = capability;
    return sanitized;
  }

  /**
   * Check if IP is in range (simplified)
   */
  isIpInRange(ip, range) {
    // Simplified check - in production use ipaddr.js library
    return true;
  }

  /**
   * Get security report
   */
  getSecurityReport() {
    return {
      rbac: {
        rolesCount: this.roles.size,
        roles: Array.from(this.roles.keys()),
        permissionsCount: this.permissions.size
      },
      cbac: {
        capabilitiesCount: this.capabilities.size,
        tokenCount: this.capabilityTokens.size
      },
      abac: {
        policiesCount: this.policies.length,
        attributesCount: this.attributes.size
      },
      cache: {
        enabled: this.enableCaching,
        cacheSize: this.decisionCache.size,
        expirationMs: this.cacheExpiration
      },
      audit: {
        logSize: this.accessLog.length,
        maxSize: this.maxLogSize
      }
    };
  }
}

module.exports = { AccessControlManager };
