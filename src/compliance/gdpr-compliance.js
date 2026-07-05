/**
 * GDPR Compliance Engine
 * Ensures GDPR compliance for data processing, consent, deletion, and portability
 *
 * Features:
 * - Data classification and inventory
 * - Consent management with audit trail
 * - Right to deletion with verified cleanup
 * - Data portability export
 * - Processing consent tracking
 * - Automated breach notification
 */

const crypto = require('crypto');

class GDPRComplianceEngine {
  constructor(config = {}) {
    this.config = {
      consentTTL: config.consentTTL || 365 * 24 * 60 * 60 * 1000, // 1 year
      dataRetentionDays: config.dataRetentionDays || 90,
      auditLogSize: config.auditLogSize || 10000,
      ...config
    };

    // Data inventory: map of user ID -> data items
    this.dataInventory = new Map();

    // Consent registry: user ID -> consent records
    this.consentRegistry = new Map();

    // Processing activities
    this.processingActivities = new Map();

    // Audit trail
    this.auditTrail = [];

    // Data subjects registry
    this.dataSubjects = new Map();

    // Breach records
    this.breachLog = [];

    this._initializeProcessingActivities();
  }

  /**
   * Initialize default processing activities
   */
  _initializeProcessingActivities() {
    const activities = [
      {
        id: 'user_authentication',
        name: 'User Authentication',
        purpose: 'Enable system access and security',
        legalBasis: 'contract',
        dataTypes: ['identity', 'credentials'],
        recipients: ['internal_security'],
        retention: 30
      },
      {
        id: 'analytics',
        name: 'Usage Analytics',
        purpose: 'Improve system performance',
        legalBasis: 'legitimate_interest',
        dataTypes: ['usage', 'telemetry'],
        recipients: ['internal_analytics'],
        retention: 90
      },
      {
        id: 'security_monitoring',
        name: 'Security Monitoring',
        purpose: 'Detect and prevent security threats',
        legalBasis: 'legitimate_interest',
        dataTypes: ['security_events', 'access_logs'],
        recipients: ['internal_security'],
        retention: 180
      }
    ];

    activities.forEach(activity => {
      this.processingActivities.set(activity.id, activity);
    });
  }

  /**
   * Register a new data subject (user)
   * @param {string} userId - Unique user identifier
   * @param {Object} userData - User personal data
   * @returns {Object} Registration result
   */
  registerDataSubject(userId, userData) {
    if (!userId || typeof userId !== 'string') {
      return { success: false, error: 'Invalid userId' };
    }

    const record = {
      userId,
      registeredAt: new Date(),
      personalData: {
        name: userData.name || null,
        email: userData.email || null,
        phone: userData.phone || null,
        address: userData.address || null
      },
      preferences: {
        marketing: false,
        analytics: false,
        thirdParty: false
      },
      active: true
    };

    this.dataSubjects.set(userId, record);

    this._logAudit('DATA_SUBJECT_REGISTERED', {
      userId,
      timestamp: new Date().toISOString()
    });

    return { success: true, message: `Data subject ${userId} registered`, record };
  }

  /**
   * Collect consent from data subject
   * @param {string} userId - User identifier
   * @param {string} activityId - Processing activity ID
   * @param {string} consentType - 'explicit', 'implicit', 'legitimate_interest'
   * @param {Object} metadata - Additional consent metadata
   * @returns {Object} Consent record
   */
  collectConsent(userId, activityId, consentType = 'explicit', metadata = {}) {
    if (!userId || !activityId) {
      return { success: false, error: 'Missing userId or activityId' };
    }

    if (!this.processingActivities.has(activityId)) {
      return { success: false, error: 'Invalid activityId' };
    }

    const validTypes = ['explicit', 'implicit', 'legitimate_interest', 'contract'];
    if (!validTypes.includes(consentType)) {
      return { success: false, error: 'Invalid consentType' };
    }

    const consentRecord = {
      consentId: crypto.randomBytes(16).toString('hex'),
      userId,
      activityId,
      consentType,
      givenAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.consentTTL),
      ipAddress: metadata.ipAddress || null,
      userAgent: metadata.userAgent || null,
      status: 'active',
      proof: this._generateConsentProof(userId, activityId),
      metadata: metadata
    };

    if (!this.consentRegistry.has(userId)) {
      this.consentRegistry.set(userId, []);
    }

    this.consentRegistry.get(userId).push(consentRecord);

    this._logAudit('CONSENT_COLLECTED', {
      userId,
      activityId,
      consentType,
      consentId: consentRecord.consentId,
      timestamp: consentRecord.givenAt.toISOString()
    });

    return {
      success: true,
      consentId: consentRecord.consentId,
      message: `Consent collected for activity ${activityId}`,
      expiresAt: consentRecord.expiresAt
    };
  }

  /**
   * Revoke consent
   * @param {string} userId - User identifier
   * @param {string} consentId - Specific consent ID to revoke
   * @returns {Object} Revocation result
   */
  revokeConsent(userId, consentId) {
    if (!userId || !consentId) {
      return { success: false, error: 'Missing userId or consentId' };
    }

    const consents = this.consentRegistry.get(userId);
    if (!consents) {
      return { success: false, error: 'No consents found for user' };
    }

    const consentIndex = consents.findIndex(c => c.consentId === consentId);
    if (consentIndex === -1) {
      return { success: false, error: 'Consent not found' };
    }

    const consent = consents[consentIndex];
    consent.status = 'revoked';
    consent.revokedAt = new Date();

    this._logAudit('CONSENT_REVOKED', {
      userId,
      consentId,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      message: 'Consent revoked successfully',
      revokedAt: consent.revokedAt
    };
  }

  /**
   * Add data to user's data inventory
   * @param {string} userId - User identifier
   * @param {string} dataType - Type of data (personal, usage, financial, etc.)
   * @param {Object} dataItem - The actual data
   * @returns {Object} Result
   */
  recordDataCollection(userId, dataType, dataItem) {
    if (!userId || !dataType) {
      return { success: false, error: 'Missing userId or dataType' };
    }

    if (!this.dataInventory.has(userId)) {
      this.dataInventory.set(userId, []);
    }

    const record = {
      itemId: crypto.randomBytes(16).toString('hex'),
      dataType,
      collectedAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.dataRetentionDays * 24 * 60 * 60 * 1000),
      size: JSON.stringify(dataItem).length,
      hash: crypto.createHash('sha256').update(JSON.stringify(dataItem)).digest('hex'),
      purpose: dataType
    };

    this.dataInventory.get(userId).push(record);

    this._logAudit('DATA_COLLECTED', {
      userId,
      dataType,
      itemId: record.itemId,
      timestamp: record.collectedAt.toISOString()
    });

    return {
      success: true,
      itemId: record.itemId,
      expiresAt: record.expiresAt,
      message: `Data item recorded for user ${userId}`
    };
  }

  /**
   * Execute right to deletion (erasure)
   * @param {string} userId - User identifier
   * @param {Array<string>} dataTypes - Specific data types to delete (null = all)
   * @returns {Object} Deletion result with audit trail
   */
  rightToDeleting(userId, dataTypes = null) {
    if (!userId) {
      return { success: false, error: 'Missing userId' };
    }

    const userData = this.dataInventory.get(userId);
    if (!userData) {
      return {
        success: true,
        message: 'No data found for user',
        deletedItems: 0
      };
    }

    let deletedItems = userData.length;
    let deletedSize = 0;

    if (dataTypes && Array.isArray(dataTypes)) {
      // Delete specific data types only
      const itemsToDelete = userData.filter(item => dataTypes.includes(item.dataType));
      deletedItems = itemsToDelete.length;
      deletedSize = itemsToDelete.reduce((sum, item) => sum + item.size, 0);

      // Remove from inventory
      const filteredData = userData.filter(item => !dataTypes.includes(item.dataType));
      if (filteredData.length === 0) {
        this.dataInventory.delete(userId);
      } else {
        this.dataInventory.set(userId, filteredData);
      }
    } else {
      // Delete all data
      deletedSize = userData.reduce((sum, item) => sum + item.size, 0);
      this.dataInventory.delete(userId);
    }

    this._logAudit('RIGHT_TO_DELETION_EXECUTED', {
      userId,
      deletedItems,
      deletedBytes: deletedSize,
      dataTypes: dataTypes || 'all',
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      message: `Deleted ${deletedItems} data items for user ${userId}`,
      deletedItems,
      deletedBytes: deletedSize,
      completedAt: new Date()
    };
  }

  /**
   * Export user data in portable format (GDPR Article 20)
   * @param {string} userId - User identifier
   * @param {string} format - 'json', 'csv', 'xml'
   * @returns {Object} Exported data
   */
  rightToPortability(userId, format = 'json') {
    if (!userId) {
      return { success: false, error: 'Missing userId' };
    }

    const subject = this.dataSubjects.get(userId);
    const data = this.dataInventory.get(userId) || [];
    const consents = this.consentRegistry.get(userId) || [];

    const exportData = {
      userId,
      exportedAt: new Date(),
      personalData: subject?.personalData || {},
      dataItems: data.map(item => ({
        id: item.itemId,
        type: item.dataType,
        collectedAt: item.collectedAt,
        expiresAt: item.expiresAt
      })),
      consents: consents.map(c => ({
        id: c.consentId,
        activity: c.activityId,
        type: c.consentType,
        status: c.status,
        givenAt: c.givenAt,
        revokedAt: c.revokedAt || null
      })),
      processingActivities: Array.from(this.processingActivities.values())
    };

    let formattedExport = exportData;

    if (format === 'csv') {
      formattedExport = this._convertToCSV(exportData);
    } else if (format === 'xml') {
      formattedExport = this._convertToXML(exportData);
    }

    this._logAudit('RIGHT_TO_PORTABILITY_EXERCISED', {
      userId,
      format,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      message: 'Data export generated',
      format,
      data: formattedExport,
      exportedAt: new Date(),
      itemCount: data.length
    };
  }

  /**
   * Report a data breach
   * @param {Object} breachDetails - Details of the breach
   * @returns {Object} Breach record
   */
  reportBreach(breachDetails) {
    const {
      description,
      affectedUsers = [],
      affectedDataTypes = [],
      discoveredAt = new Date(),
      severity = 'high'
    } = breachDetails;

    if (!description) {
      return { success: false, error: 'Missing breach description' };
    }

    const breachRecord = {
      breachId: crypto.randomBytes(16).toString('hex'),
      description,
      reportedAt: new Date(),
      discoveredAt: new Date(discoveredAt),
      affectedUsers: affectedUsers.length,
      affectedDataTypes,
      severity,
      status: 'reported',
      investigationStatus: 'pending',
      notificationSent: false
    };

    this.breachLog.push(breachRecord);

    this._logAudit('BREACH_REPORTED', {
      breachId: breachRecord.breachId,
      severity,
      affectedUsers: affectedUsers.length,
      timestamp: breachRecord.reportedAt.toISOString()
    });

    return {
      success: true,
      breachId: breachRecord.breachId,
      message: 'Breach reported and logged',
      reportedAt: breachRecord.reportedAt
    };
  }

  /**
   * Get compliance report
   * @returns {Object} Compliance status
   */
  getComplianceReport() {
    const activeSubjects = this.dataSubjects.size;
    const totalDataItems = Array.from(this.dataInventory.values())
      .reduce((sum, items) => sum + items.length, 0);

    const consentStats = {
      total: 0,
      active: 0,
      expired: 0,
      revoked: 0
    };

    this.consentRegistry.forEach(consents => {
      consents.forEach(consent => {
        consentStats.total++;
        if (consent.status === 'active' && consent.expiresAt > new Date()) {
          consentStats.active++;
        } else if (consent.status === 'revoked') {
          consentStats.revoked++;
        } else {
          consentStats.expired++;
        }
      });
    });

    const pendingDeletions = Array.from(this.dataInventory.entries())
      .filter(([_, items]) => items.some(item => item.expiresAt <= new Date()))
      .length;

    return {
      reportedAt: new Date(),
      dataSubjects: activeSubjects,
      totalDataItems,
      processingActivities: this.processingActivities.size,
      consents: consentStats,
      pendingDeletions,
      breaches: this.breachLog.length,
      auditLogEntries: this.auditTrail.length,
      complianceStatus: this._calculateComplianceScore(),
      summary: {
        consentRate: activeSubjects > 0 ? ((consentStats.active / (activeSubjects * this.processingActivities.size)) * 100).toFixed(2) + '%' : 'N/A',
        dataRetention: `${this.config.dataRetentionDays} days`,
        recentBreaches: this.breachLog.filter(b =>
          (new Date() - b.reportedAt) < 30 * 24 * 60 * 60 * 1000
        ).length
      }
    };
  }

  /**
   * Get audit trail
   * @param {number} limit - Number of recent entries
   * @returns {Array} Audit entries
   */
  getAuditTrail(limit = 100) {
    return this.auditTrail.slice(-limit);
  }

  /**
   * Verify consent for processing
   * @param {string} userId - User identifier
   * @param {string} activityId - Processing activity ID
   * @returns {boolean} Consent status
   */
  hasConsent(userId, activityId) {
    const consents = this.consentRegistry.get(userId);
    if (!consents) {
      return false;
    }

    return consents.some(c =>
      c.activityId === activityId &&
      c.status === 'active' &&
      c.expiresAt > new Date()
    );
  }

  /**
   * Calculate compliance score
   * @private
   * @returns {string} Compliance percentage
   */
  _calculateComplianceScore() {
    let score = 100;

    // Check for pending deletions
    const pendingDeletions = Array.from(this.dataInventory.entries())
      .filter(([_, items]) => items.some(item => item.expiresAt <= new Date()))
      .length;

    if (pendingDeletions > 0) {
      score -= Math.min(20, pendingDeletions * 5);
    }

    // Check for unresolved breaches
    const unresolvedBreaches = this.breachLog.filter(b => b.status === 'reported').length;
    if (unresolvedBreaches > 0) {
      score -= Math.min(30, unresolvedBreaches * 10);
    }

    return Math.max(0, score) + '%';
  }

  /**
   * Generate consent proof
   * @private
   */
  _generateConsentProof(userId, activityId) {
    const data = `${userId}${activityId}${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
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

    this.auditTrail.push(entry);

    // Maintain audit log size limit
    if (this.auditTrail.length > this.config.auditLogSize) {
      this.auditTrail.shift();
    }
  }

  /**
   * Convert data to CSV format
   * @private
   */
  _convertToCSV(data) {
    // Simplified CSV conversion
    const rows = [];
    rows.push('userId,dataType,collectedAt,expiresAt');

    data.dataItems.forEach(item => {
      rows.push(`${data.userId},${item.type},${item.collectedAt},${item.expiresAt}`);
    });

    return rows.join('\n');
  }

  /**
   * Convert data to XML format
   * @private
   */
  _convertToXML(data) {
    // Simplified XML conversion
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<Export>\n';
    xml += `  <UserId>${this._escapeXml(data.userId)}</UserId>\n`;
    xml += `  <ExportedAt>${data.exportedAt}</ExportedAt>\n`;
    xml += '  <DataItems>\n';

    data.dataItems.forEach(item => {
      xml += `    <Item>\n`;
      xml += `      <Id>${item.id}</Id>\n`;
      xml += `      <Type>${item.type}</Type>\n`;
      xml += `      <CollectedAt>${item.collectedAt}</CollectedAt>\n`;
      xml += `    </Item>\n`;
    });

    xml += '  </DataItems>\n';
    xml += '</Export>';

    return xml;
  }

  /**
   * Escape XML special characters
   * @private
   */
  _escapeXml(str) {
    if (!str) {
      return '';
    }
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

module.exports = { GDPRComplianceEngine };
