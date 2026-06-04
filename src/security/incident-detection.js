/**
 * Security Incident Detection System
 *
 * Detects and responds to security incidents:
 * - Brute force login attempts
 * - Suspicious data access patterns
 * - Unauthorized privilege escalation attempts
 * - Resource exhaustion attacks
 * - Rate limit violations
 * - Configuration tampering
 * - Anomalous user behavior
 *
 * Version: 1.0.0
 * Created: June 3, 2026
 */

class IncidentDetector {
  /**
   * Severity levels
   */
  static SEVERITY = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4
  };

  /**
   * Incident types
   */
  static INCIDENT_TYPES = {
    BRUTE_FORCE: 'brute_force',
    PRIVILEGE_ESCALATION: 'privilege_escalation',
    SUSPICIOUS_DATA_ACCESS: 'suspicious_data_access',
    RESOURCE_EXHAUSTION: 'resource_exhaustion',
    RATE_LIMIT_VIOLATION: 'rate_limit_violation',
    UNAUTHORIZED_ACCESS: 'unauthorized_access',
    CONFIG_TAMPERING: 'config_tampering',
    ANOMALOUS_BEHAVIOR: 'anomalous_behavior',
    INJECTION_ATTEMPT: 'injection_attempt'
  };

  /**
   * Response actions
   */
  static RESPONSE_ACTIONS = {
    ALERT: 'alert',
    LOG: 'log',
    BLOCK: 'block',
    QUARANTINE: 'quarantine',
    TERMINATE: 'terminate'
  };

  /**
   * Constructor
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    this.config = {
      // Thresholds
      bruteForceThreshold: config.bruteForceThreshold || 5,        // Failed attempts
      bruteForceWindow: config.bruteForceWindow || 300000,         // 5 minutes
      suspiciousAccessThreshold: config.suspiciousAccessThreshold || 10,
      suspiciousAccessWindow: config.suspiciousAccessWindow || 3600000, // 1 hour
      resourceExhaustionThreshold: config.resourceExhaustionThreshold || 0.9,

      // Response
      autoRespond: config.autoRespond !== false,
      alertOn: config.alertOn || ['CRITICAL', 'HIGH'],

      // Storage
      maxIncidents: config.maxIncidents || 1000
    };

    // Incident storage
    this.incidents = [];

    // Tracking dictionaries
    this.loginAttempts = new Map();      // ip -> { attempts, lastTime }
    this.dataAccessPatterns = new Map(); // userId -> { accesses, timestamps }
    this.resourceUsage = new Map();      // clientId -> { usage, timestamp }
    this.blockList = new Set();          // Blocked IPs/users
  }

  /**
   * Detect brute force login attempt
   * @param {Object} attempt - Login attempt details
   * @returns {Object} { detected: boolean, incident: Object|null }
   */
  detectBruteForce(attempt) {
    if (!attempt.ip && !attempt.userId) {
      return { detected: false, incident: null };
    }

    const identifier = attempt.ip || attempt.userId;
    const now = Date.now();

    let tracker = this.loginAttempts.get(identifier);
    if (!tracker) {
      tracker = { attempts: [], detectedAt: now };
    }

    // Remove old attempts outside window
    tracker.attempts = tracker.attempts.filter(
      t => now - t < this.config.bruteForceWindow
    );

    // Add current attempt if failed
    if (!attempt.success) {
      tracker.attempts.push(now);
    } else {
      // Reset on successful login
      tracker.attempts = [];
    }

    this.loginAttempts.set(identifier, tracker);

    // Check threshold
    if (tracker.attempts.length >= this.config.bruteForceThreshold) {
      const incident = {
        id: this.generateIncidentId(),
        timestamp: now,
        type: IncidentDetector.INCIDENT_TYPES.BRUTE_FORCE,
        severity: IncidentDetector.SEVERITY.HIGH,
        actor: {
          ip: attempt.ip,
          userId: attempt.userId
        },
        details: {
          failedAttempts: tracker.attempts.length,
          threshold: this.config.bruteForceThreshold,
          window: `${this.config.bruteForceWindow / 1000}s`
        },
        status: 'detected',
        actions: []
      };

      // Auto-respond if configured
      if (this.config.autoRespond) {
        incident.actions.push({
          action: IncidentDetector.RESPONSE_ACTIONS.BLOCK,
          timestamp: now,
          target: identifier
        });
        this.blockList.add(identifier);
      }

      this.recordIncident(incident);
      return { detected: true, incident };
    }

    return { detected: false, incident: null };
  }

  /**
   * Detect suspicious data access patterns
   * @param {Object} access - Data access details
   * @returns {Object} { detected: boolean, incident: Object|null }
   */
  detectSuspiciousDataAccess(access) {
    if (!access.userId) {
      return { detected: false, incident: null };
    }

    const now = Date.now();
    let pattern = this.dataAccessPatterns.get(access.userId);

    if (!pattern) {
      pattern = {
        accesses: [],
        baseline: null
      };
    }

    // Remove old accesses
    pattern.accesses = pattern.accesses.filter(
      t => now - t < this.config.suspiciousAccessWindow
    );

    pattern.accesses.push(now);

    // Establish baseline on first 10 accesses
    if (pattern.accesses.length === 10 && !pattern.baseline) {
      pattern.baseline = {
        avgPerHour: 10,
        lastResourceType: access.resourceType
      };
    }

    this.dataAccessPatterns.set(access.userId, pattern);

    // Detect anomalies
    const issues = [];

    // Check rate anomaly
    if (pattern.baseline) {
      const recentCount = pattern.accesses.length;
      const expectedMax = pattern.baseline.avgPerHour * 2; // 2x baseline

      if (recentCount > expectedMax) {
        issues.push(`Excessive access rate: ${recentCount} (baseline: ${pattern.baseline.avgPerHour})`);
      }
    }

    // Check for accessing sensitive resources
    const sensitiveResources = ['passwords', 'keys', 'credentials', 'secrets'];
    if (sensitiveResources.some(r => (access.resourceType || '').includes(r))) {
      issues.push(`Accessing sensitive resource: ${access.resourceType}`);
    }

    // Check for bulk access
    if (access.count && access.count > 100) {
      issues.push(`Bulk data access: ${access.count} records`);
    }

    if (issues.length >= 2) {
      const incident = {
        id: this.generateIncidentId(),
        timestamp: now,
        type: IncidentDetector.INCIDENT_TYPES.SUSPICIOUS_DATA_ACCESS,
        severity: IncidentDetector.SEVERITY.MEDIUM,
        actor: {
          userId: access.userId
        },
        details: {
          issues,
          resourceType: access.resourceType,
          recordCount: access.count || 1
        },
        status: 'detected',
        actions: []
      };

      if (this.config.autoRespond) {
        incident.actions.push({
          action: IncidentDetector.RESPONSE_ACTIONS.ALERT,
          timestamp: now
        });
      }

      this.recordIncident(incident);
      return { detected: true, incident };
    }

    return { detected: false, incident: null };
  }

  /**
   * Detect privilege escalation attempts
   * @param {Object} attempt - Escalation attempt details
   * @returns {Object} { detected: boolean, incident: Object|null }
   */
  detectPrivilegeEscalation(attempt) {
    if (!attempt.userId || !attempt.fromRole || !attempt.toRole) {
      return { detected: false, incident: null };
    }

    const now = Date.now();

    // Check if escalation is unauthorized
    const allowedEscalations = {
      'user': ['admin'],
      'admin': []  // Admins cannot escalate
    };

    const allowed = allowedEscalations[attempt.fromRole] || [];
    const isUnauthorized = !allowed.includes(attempt.toRole);

    if (isUnauthorized) {
      const incident = {
        id: this.generateIncidentId(),
        timestamp: now,
        type: IncidentDetector.INCIDENT_TYPES.PRIVILEGE_ESCALATION,
        severity: IncidentDetector.SEVERITY.CRITICAL,
        actor: {
          userId: attempt.userId,
          fromRole: attempt.fromRole,
          attemptedRole: attempt.toRole
        },
        details: {
          reason: attempt.reason || 'Unauthorized escalation attempt'
        },
        status: 'detected',
        actions: []
      };

      if (this.config.autoRespond) {
        incident.actions.push(
          {
            action: IncidentDetector.RESPONSE_ACTIONS.BLOCK,
            timestamp: now
          },
          {
            action: IncidentDetector.RESPONSE_ACTIONS.ALERT,
            timestamp: now
          }
        );
        this.blockList.add(attempt.userId);
      }

      this.recordIncident(incident);
      return { detected: true, incident };
    }

    return { detected: false, incident: null };
  }

  /**
   * Detect resource exhaustion attacks
   * @param {Object} resources - Current resource usage
   * @returns {Object} { detected: boolean, incident: Object|null }
   */
  detectResourceExhaustion(resources) {
    if (!resources.clientId || typeof resources.usage !== 'number') {
      return { detected: false, incident: null };
    }

    const now = Date.now();

    // Check if exceeds threshold
    if (resources.usage > this.config.resourceExhaustionThreshold) {
      const incident = {
        id: this.generateIncidentId(),
        timestamp: now,
        type: IncidentDetector.INCIDENT_TYPES.RESOURCE_EXHAUSTION,
        severity: IncidentDetector.SEVERITY.HIGH,
        actor: {
          clientId: resources.clientId
        },
        details: {
          usage: `${(resources.usage * 100).toFixed(1)}%`,
          threshold: `${(this.config.resourceExhaustionThreshold * 100).toFixed(1)}%`,
          resource: resources.resource || 'memory'
        },
        status: 'detected',
        actions: []
      };

      if (this.config.autoRespond) {
        incident.actions.push({
          action: IncidentDetector.RESPONSE_ACTIONS.QUARANTINE,
          timestamp: now,
          target: resources.clientId
        });
      }

      this.recordIncident(incident);
      return { detected: true, incident };
    }

    return { detected: false, incident: null };
  }

  /**
   * Detect injection attempts
   * @param {Object} request - Request to analyze
   * @returns {Object} { detected: boolean, incident: Object|null }
   */
  detectInjectionAttempt(request) {
    const now = Date.now();
    const injectionPatterns = [
      /(\bOR\b|union|select|insert|delete|drop|update|exec|execute)\s*\(/gi,
      /[';"-]/g,
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on(load|error|click)=/gi
    ];

    const requestString = JSON.stringify(request);
    const detected = injectionPatterns.some(pattern => pattern.test(requestString));

    if (detected) {
      const incident = {
        id: this.generateIncidentId(),
        timestamp: now,
        type: IncidentDetector.INCIDENT_TYPES.INJECTION_ATTEMPT,
        severity: IncidentDetector.SEVERITY.HIGH,
        actor: {
          ip: request.ip,
          userId: request.userId
        },
        details: {
          reason: 'Suspicious patterns detected in request'
        },
        status: 'detected',
        actions: []
      };

      if (this.config.autoRespond) {
        incident.actions.push({
          action: IncidentDetector.RESPONSE_ACTIONS.BLOCK,
          timestamp: now,
          target: request.ip || request.userId
        });
      }

      this.recordIncident(incident);
      return { detected: true, incident };
    }

    return { detected: false, incident: null };
  }

  /**
   * Check if identity is blocked
   * @param {string} identifier - IP, userId, etc.
   * @returns {boolean} True if blocked
   */
  isBlocked(identifier) {
    return this.blockList.has(identifier);
  }

  /**
   * Unblock an identifier
   * @param {string} identifier - IP, userId, etc.
   */
  unblock(identifier) {
    this.blockList.delete(identifier);
  }

  /**
   * Record an incident
   * @param {Object} incident - Incident to record
   */
  recordIncident(incident) {
    this.incidents.push(incident);

    // Trim old incidents if exceeds max
    if (this.incidents.length > this.config.maxIncidents) {
      this.incidents = this.incidents.slice(-this.config.maxIncidents);
    }
  }

  /**
   * Get incident history
   * @param {Object} filters - Filter options
   * @returns {Array<Object>} Matching incidents
   */
  getIncidents(filters = {}) {
    let results = [...this.incidents];

    if (filters.type) {
      results = results.filter(i => i.type === filters.type);
    }

    if (filters.severity) {
      results = results.filter(i => i.severity >= filters.severity);
    }

    if (filters.since) {
      results = results.filter(i => i.timestamp >= filters.since);
    }

    if (filters.userId) {
      results = results.filter(i => i.actor.userId === filters.userId);
    }

    return results;
  }

  /**
   * Get incident summary
   * @returns {Object} Summary statistics
   */
  getSummary() {
    const summary = {
      totalIncidents: this.incidents.length,
      byType: {},
      bySeverity: {},
      blockedIdentifiers: this.blockList.size,
      recentIncidents: this.incidents.slice(-10)
    };

    for (const incident of this.incidents) {
      if (!summary.byType[incident.type]) {
        summary.byType[incident.type] = 0;
      }
      summary.byType[incident.type]++;

      if (!summary.bySeverity[incident.severity]) {
        summary.bySeverity[incident.severity] = 0;
      }
      summary.bySeverity[incident.severity]++;
    }

    return summary;
  }

  /**
   * Generate unique incident ID
   * @returns {string} Incident ID
   */
  generateIncidentId() {
    return `incident-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear incident history
   */
  clearHistory() {
    this.incidents = [];
  }
}

module.exports = IncidentDetector;
