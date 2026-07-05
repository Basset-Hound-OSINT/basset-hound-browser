/**
 * HIPAA Compliance Engine
 * Ensures HIPAA compliance for Protected Health Information (PHI)
 *
 * Features:
 * - PHI identification and tracking
 * - Access control and authentication
 * - Audit logging for all PHI access
 * - Encryption for PHI at rest and in transit
 * - Breach notification procedures
 * - Business Associate Agreement (BAA) tracking
 * - Minimum necessary access enforcement
 */

const crypto = require('crypto');

class HIPAAComplianceEngine {
  constructor(config = {}) {
    this.config = {
      encryptionAlgorithm: 'aes-256-gcm',
      minSecurePasswordLength: config.minSecurePasswordLength || 12,
      sessionTimeout: config.sessionTimeout || 30 * 60 * 1000, // 30 minutes
      mfaRequired: config.mfaRequired !== false,
      auditLogRetention: config.auditLogRetention || 6 * 365 * 24 * 60 * 60 * 1000, // 6 years
      ...config
    };

    // PHI Registry
    this.phiRegistry = new Map();

    // Access Control Lists
    this.accessControlList = new Map();

    // Audit Log
    this.auditLog = [];

    // Active sessions
    this.activeSessions = new Map();

    // Business Associates
    this.businessAssociates = new Map();

    // Encryption keys
    this.encryptionKeys = new Map();

    // Breach notifications
    this.breachNotifications = [];

    this._initializeDefaults();
  }

  /**
   * Initialize default settings
   */
  _initializeDefaults() {
    // Initialize PHI categories
    this.phiCategories = {
      MEDICAL_RECORDS: 'Clinical patient records',
      BILLING_INFO: 'Billing and payment information',
      DEMOGRAPHIC: 'Patient demographics',
      GENETIC: 'Genetic information',
      BIOMETRIC: 'Biometric identifiers',
      HEALTH_PLAN: 'Health plan information',
      CLAIMS: 'Insurance claims',
      PROVIDER_INFO: 'Provider information'
    };

    // Initialize role-based access levels
    this.accessLevels = {
      NO_ACCESS: 0,
      MINIMAL: 1, // Minimum necessary only
      STANDARD: 2, // Standard care team access
      ADMINISTRATIVE: 3, // Administrative functions
      FULL_ACCESS: 4 // Full clinical access
    };
  }

  /**
   * Register a user with HIPAA access controls
   * @param {string} userId - User identifier
   * @param {Object} credentials - User credentials
   * @param {string} role - User role (provider, admin, staff, etc.)
   * @returns {Object} Registration result
   */
  registerUser(userId, credentials, role) {
    if (!userId || !credentials || !role) {
      return { success: false, error: 'Missing required fields' };
    }

    if (!this._validatePassword(credentials.password)) {
      return {
        success: false,
        error: 'Password does not meet security requirements (minimum 12 characters, mixed case, numbers, symbols)'
      };
    }

    const user = {
      userId,
      role,
      registeredAt: new Date(),
      passwordHash: this._hashPassword(credentials.password),
      mfaEnabled: this.config.mfaRequired,
      mfaSecret: this.config.mfaRequired ? crypto.randomBytes(32).toString('base64') : null,
      status: 'active',
      accessLevel: this._getRoleAccessLevel(role),
      lastActivity: new Date(),
      loginAttempts: 0,
      locked: false
    };

    this.accessControlList.set(userId, user);

    this._logAudit('USER_REGISTERED', {
      userId,
      role,
      mfaEnabled: user.mfaEnabled
    });

    return {
      success: true,
      userId,
      message: 'User registered successfully',
      mfaRequired: user.mfaEnabled,
      mfaSecret: user.mfaRequired ? user.mfaSecret : undefined
    };
  }

  /**
   * Authenticate user
   * @param {string} userId - User identifier
   * @param {string} password - Password
   * @param {string} mfaToken - MFA token (if MFA enabled)
   * @returns {Object} Authentication result with session token
   */
  authenticateUser(userId, password, mfaToken = null) {
    if (!userId || !password) {
      return { success: false, error: 'Missing credentials' };
    }

    const user = this.accessControlList.get(userId);
    if (!user) {
      this._logAudit('AUTHENTICATION_FAILURE', { userId, reason: 'User not found' });
      return { success: false, error: 'Invalid credentials' };
    }

    if (user.locked) {
      return { success: false, error: 'Account is locked due to security concerns' };
    }

    if (!this._verifyPassword(password, user.passwordHash)) {
      user.loginAttempts++;
      if (user.loginAttempts >= 5) {
        user.locked = true;
        this._logAudit('ACCOUNT_LOCKED', { userId });
      }
      this._logAudit('AUTHENTICATION_FAILURE', { userId, reason: 'Invalid password' });
      return { success: false, error: 'Invalid credentials' };
    }

    if (user.mfaEnabled && !mfaToken) {
      return {
        success: false,
        error: 'MFA token required',
        requiresMFA: true,
        mfaChallenge: crypto.randomBytes(16).toString('hex')
      };
    }

    // Verify MFA if enabled
    if (user.mfaEnabled && mfaToken) {
      if (!this._verifyMFA(user.mfaSecret, mfaToken)) {
        this._logAudit('MFA_VERIFICATION_FAILURE', { userId });
        return { success: false, error: 'Invalid MFA token' };
      }
    }

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const session = {
      sessionToken,
      userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.sessionTimeout),
      lastActivity: new Date(),
      ipAddress: null,
      userAgent: null
    };

    this.activeSessions.set(sessionToken, session);
    user.loginAttempts = 0;
    user.lastActivity = new Date();

    this._logAudit('USER_AUTHENTICATED', { userId, sessionToken });

    return {
      success: true,
      sessionToken,
      expiresAt: session.expiresAt,
      user: {
        userId,
        role: user.role,
        accessLevel: user.accessLevel
      }
    };
  }

  /**
   * Register a Business Associate
   * @param {string} baId - Business Associate identifier
   * @param {Object} baDetails - BA details
   * @returns {Object} Registration result
   */
  registerBusinessAssociate(baId, baDetails) {
    if (!baId || !baDetails.name) {
      return { success: false, error: 'Missing required BA information' };
    }

    const ba = {
      baId,
      name: baDetails.name,
      contact: baDetails.contact,
      registeredAt: new Date(),
      baaSignedAt: baDetails.baaSignedAt || null,
      baaExpiresAt: baDetails.baaExpiresAt || null,
      status: 'pending',
      allowedDataTypes: baDetails.allowedDataTypes || [],
      encryptionRequired: true,
      dataProcessingAgreement: baDetails.dpa || null
    };

    this.businessAssociates.set(baId, ba);

    this._logAudit('BUSINESS_ASSOCIATE_REGISTERED', {
      baId,
      name: ba.name,
      baaStatus: ba.baaSignedAt ? 'signed' : 'pending'
    });

    return {
      success: true,
      baId,
      message: 'Business Associate registered',
      baaStatus: 'pending'
    };
  }

  /**
   * Store PHI with encryption
   * @param {string} phiId - PHI identifier
   * @param {Object} phiData - Protected Health Information
   * @param {string} category - PHI category
   * @param {string} encryptionKey - Encryption key
   * @returns {Object} Storage result
   */
  storePHI(phiId, phiData, category = 'MEDICAL_RECORDS', encryptionKey) {
    if (!phiId || !phiData || !encryptionKey) {
      return { success: false, error: 'Missing required parameters' };
    }

    if (!this.phiCategories[category]) {
      return { success: false, error: 'Invalid PHI category' };
    }

    try {
      // Encrypt PHI using AES-256-GCM
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(
        this.config.encryptionAlgorithm,
        Buffer.from(encryptionKey.substring(0, 32), 'utf8'),
        iv
      );

      let encrypted = cipher.update(JSON.stringify(phiData), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');

      const phi = {
        phiId,
        category,
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        authTag,
        algorithm: this.config.encryptionAlgorithm,
        storedAt: new Date(),
        expiresAt: this._calculatePHIExpiration(category),
        accessLog: [],
        status: 'encrypted'
      };

      this.phiRegistry.set(phiId, phi);

      this._logAudit('PHI_STORED', {
        phiId,
        category,
        encryptionStatus: 'encrypted'
      });

      return {
        success: true,
        phiId,
        message: 'PHI stored successfully with encryption',
        expiresAt: phi.expiresAt
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Retrieve PHI with access control and audit logging
   * @param {string} phiId - PHI identifier
   * @param {string} sessionToken - User session token
   * @param {string} encryptionKey - Decryption key
   * @returns {Object} PHI data with access logged
   */
  retrievePHI(phiId, sessionToken, encryptionKey) {
    if (!phiId || !sessionToken || !encryptionKey) {
      return { success: false, error: 'Missing required parameters' };
    }

    // Verify session
    const session = this.activeSessions.get(sessionToken);
    if (!session) {
      return { success: false, error: 'Invalid session token' };
    }

    // Check session expiration
    if (session.expiresAt < new Date()) {
      this.activeSessions.delete(sessionToken);
      return { success: false, error: 'Session expired' };
    }

    // Check access control
    const user = this.accessControlList.get(session.userId);
    if (!user || user.accessLevel < this.accessLevels.STANDARD) {
      this._logAudit('PHI_ACCESS_DENIED', {
        userId: session.userId,
        phiId,
        reason: 'Insufficient access level'
      });
      return { success: false, error: 'Access denied to PHI' };
    }

    // Retrieve and decrypt PHI
    const phi = this.phiRegistry.get(phiId);
    if (!phi) {
      return { success: false, error: 'PHI not found' };
    }

    try {
      const decipher = crypto.createDecipheriv(
        phi.algorithm,
        Buffer.from(encryptionKey.substring(0, 32), 'utf8'),
        Buffer.from(phi.iv, 'hex')
      );

      decipher.setAuthTag(Buffer.from(phi.authTag, 'hex'));

      let decrypted = decipher.update(phi.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      // Log access
      phi.accessLog.push({
        userId: session.userId,
        accessedAt: new Date(),
        sessionToken
      });

      session.lastActivity = new Date();

      this._logAudit('PHI_ACCESSED', {
        userId: session.userId,
        phiId,
        category: phi.category
      });

      return {
        success: true,
        phiId,
        data: JSON.parse(decrypted),
        category: phi.category,
        accessedAt: new Date()
      };
    } catch (error) {
      this._logAudit('PHI_DECRYPTION_FAILURE', {
        phiId,
        sessionToken,
        error: error.message
      });
      return { success: false, error: 'Failed to decrypt PHI' };
    }
  }

  /**
   * Report a breach
   * @param {Object} breachDetails - Breach information
   * @returns {Object} Breach notification record
   */
  reportBreach(breachDetails) {
    const {
      description,
      affectedIndividuals = [],
      phiCategories = [],
      discoveredAt = new Date(),
      containmentMeasures = []
    } = breachDetails;

    if (!description) {
      return { success: false, error: 'Missing breach description' };
    }

    const notification = {
      notificationId: crypto.randomBytes(16).toString('hex'),
      description,
      reportedAt: new Date(),
      discoveredAt: new Date(discoveredAt),
      affectedIndividuals: affectedIndividuals.length,
      phiCategories,
      containmentMeasures,
      notificationStatus: 'pending',
      regulatoryReportingRequired: affectedIndividuals.length > 500,
      mediaNotificationRequired: affectedIndividuals.length > 500
    };

    this.breachNotifications.push(notification);

    this._logAudit('BREACH_REPORTED', {
      notificationId: notification.notificationId,
      affectedIndividuals: affectedIndividuals.length,
      phiCategories
    });

    return {
      success: true,
      notificationId: notification.notificationId,
      message: 'Breach reported and tracked',
      regulatoryReportingRequired: notification.regulatoryReportingRequired
    };
  }

  /**
   * Enforce minimum necessary access
   * @param {string} userId - User identifier
   * @param {string} phiId - PHI identifier
   * @param {string} purpose - Purpose of access
   * @returns {boolean} Whether access is allowed
   */
  isMinimumNecessary(userId, phiId, purpose) {
    const user = this.accessControlList.get(userId);
    if (!user) {
      return false;
    }

    const phi = this.phiRegistry.get(phiId);
    if (!phi) {
      return false;
    }

    // Check if user has legitimate need to access this PHI
    // This is a simplified check - in production would be more sophisticated
    return user.accessLevel >= this.accessLevels.STANDARD;
  }

  /**
   * Get audit log for PHI access
   * @param {string} phiId - PHI identifier (optional)
   * @param {number} limit - Number of entries to return
   * @returns {Array} Audit entries
   */
  getAuditLog(phiId = null, limit = 100) {
    let entries = this.auditLog;

    if (phiId) {
      entries = entries.filter(entry =>
        entry.details.phiId === phiId || entry.details.userId
      );
    }

    return entries.slice(-limit);
  }

  /**
   * Get compliance report
   * @returns {Object} HIPAA compliance status
   */
  getComplianceReport() {
    const totalPHI = this.phiRegistry.size;
    const encryptedPHI = Array.from(this.phiRegistry.values())
      .filter(phi => phi.status === 'encrypted').length;

    const activeUsers = Array.from(this.accessControlList.values())
      .filter(user => user.status === 'active').length;

    const mfaEnabledUsers = Array.from(this.accessControlList.values())
      .filter(user => user.mfaEnabled).length;

    const businessAssociatesWithBAA = Array.from(this.businessAssociates.values())
      .filter(ba => ba.baaSignedAt !== null).length;

    return {
      reportedAt: new Date(),
      phiSecurity: {
        totalPHI,
        encryptedPHI,
        encryptionRate: totalPHI > 0 ? ((encryptedPHI / totalPHI) * 100).toFixed(2) + '%' : 'N/A'
      },
      accessControl: {
        activeUsers,
        mfaEnabledUsers,
        mfaRate: activeUsers > 0 ? ((mfaEnabledUsers / activeUsers) * 100).toFixed(2) + '%' : 'N/A'
      },
      businessAssociates: {
        total: this.businessAssociates.size,
        withBAA: businessAssociatesWithBAA,
        baaComplianceRate: this.businessAssociates.size > 0 ?
          ((businessAssociatesWithBAA / this.businessAssociates.size) * 100).toFixed(2) + '%' : 'N/A'
      },
      breaches: {
        total: this.breachNotifications.length,
        pending: this.breachNotifications.filter(b => b.notificationStatus === 'pending').length,
        reported: this.breachNotifications.filter(b => b.notificationStatus === 'reported').length
      },
      auditLog: {
        totalEntries: this.auditLog.length,
        retentionDays: this.config.auditLogRetention / (1000 * 60 * 60 * 24)
      },
      complianceScore: this._calculateComplianceScore()
    };
  }

  /**
   * Hash password securely
   * @private
   */
  _hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
    return salt.toString('hex') + ':' + hash.toString('hex');
  }

  /**
   * Verify password
   * @private
   */
  _verifyPassword(password, hash) {
    const [salt, key] = hash.split(':');
    const hashOfPassword = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 64, 'sha512');
    return key === hashOfPassword.toString('hex');
  }

  /**
   * Validate password strength
   * @private
   */
  _validatePassword(password) {
    if (password.length < this.config.minSecurePasswordLength) {
      return false;
    }
    if (!/[A-Z]/.test(password)) {
      return false;
    } // Uppercase
    if (!/[a-z]/.test(password)) {
      return false;
    } // Lowercase
    if (!/[0-9]/.test(password)) {
      return false;
    } // Number
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return false;
    } // Symbol
    return true;
  }

  /**
   * Verify MFA token
   * @private
   */
  _verifyMFA(secret, token) {
    // Simplified MFA verification - in production would use TOTP
    return token && token.length > 0;
  }

  /**
   * Get role-based access level
   * @private
   */
  _getRoleAccessLevel(role) {
    const roleMapping = {
      'admin': this.accessLevels.FULL_ACCESS,
      'physician': this.accessLevels.FULL_ACCESS,
      'nurse': this.accessLevels.STANDARD,
      'staff': this.accessLevels.MINIMAL,
      'auditor': this.accessLevels.MINIMAL,
      'billing': this.accessLevels.STANDARD
    };
    return roleMapping[role] || this.accessLevels.NO_ACCESS;
  }

  /**
   * Calculate PHI expiration based on category
   * @private
   */
  _calculatePHIExpiration(category) {
    const retentionDays = {
      'MEDICAL_RECORDS': 7 * 365,
      'BILLING_INFO': 6 * 365,
      'DEMOGRAPHIC': 7 * 365,
      'GENETIC': 10 * 365,
      'BIOMETRIC': 3 * 365,
      'HEALTH_PLAN': 6 * 365,
      'CLAIMS': 6 * 365,
      'PROVIDER_INFO': 7 * 365
    };

    const days = retentionDays[category] || 365;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  /**
   * Log audit entry
   * @private
   */
  _logAudit(action, details) {
    const entry = {
      timestamp: new Date(),
      action,
      details,
      id: crypto.randomBytes(16).toString('hex')
    };

    this.auditLog.push(entry);

    // Maintain audit log size
    if (this.auditLog.length > 100000) {
      this.auditLog.shift();
    }
  }

  /**
   * Calculate compliance score
   * @private
   */
  _calculateComplianceScore() {
    let score = 100;

    // Deduct for unencrypted PHI
    const unencryptedPHI = Array.from(this.phiRegistry.values())
      .filter(phi => phi.status !== 'encrypted').length;
    if (unencryptedPHI > 0) {
      score -= Math.min(20, unencryptedPHI * 5);
    }

    // Deduct for users without MFA
    const usersWithoutMFA = Array.from(this.accessControlList.values())
      .filter(user => !user.mfaEnabled).length;
    if (usersWithoutMFA > 0) {
      score -= Math.min(20, usersWithoutMFA * 2);
    }

    // Deduct for BAs without BAA
    const baWithoutBAA = Array.from(this.businessAssociates.values())
      .filter(ba => !ba.baaSignedAt).length;
    if (baWithoutBAA > 0) {
      score -= Math.min(30, baWithoutBAA * 10);
    }

    // Deduct for pending breach notifications
    const pendingBreaches = this.breachNotifications.filter(b => b.notificationStatus === 'pending').length;
    if (pendingBreaches > 0) {
      score -= Math.min(20, pendingBreaches * 5);
    }

    return Math.max(0, score) + '%';
  }
}

module.exports = { HIPAAComplianceEngine };
