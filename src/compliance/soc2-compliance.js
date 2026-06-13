/**
 * SOC 2 Compliance Engine
 * Ensures SOC 2 Type II compliance across all trust service criteria
 *
 * Features:
 * - Control implementation tracking
 * - Trust service criteria monitoring (CC, A, C, CI, and P)
 * - Evidence collection
 * - Control testing and attestation
 * - Incident reporting
 * - Risk assessment and management
 * - Third-party assessment support
 */

const crypto = require('crypto');

class SOC2ComplianceEngine {
  constructor(config = {}) {
    this.config = {
      evidenceRetentionDays: config.evidenceRetentionDays || 1095, // 3 years
      auditLogRetention: config.auditLogRetention || 1825, // 5 years
      controlTestingFrequency: config.controlTestingFrequency || 'quarterly',
      complianceFramework: 'SOC 2 Type II',
      ...config
    };

    // Control registry
    this.controls = new Map();

    // Trust service criteria
    this.trustServiceCriteria = this._initializeTrustServiceCriteria();

    // Evidence collection
    this.evidenceRepository = new Map();

    // Control testing results
    this.testingResults = [];

    // Incidents
    this.incidents = [];

    // Risk register
    this.riskRegister = [];

    // Audit trail
    this.auditLog = [];

    this._initializeDefaultControls();
  }

  /**
   * Initialize trust service criteria (TSC)
   * @private
   */
  _initializeTrustServiceCriteria() {
    return {
      CC: {
        name: 'Common Criteria',
        description: 'Applies to all TSC reports',
        criteria: {
          'CC6.1': 'Logical access controls',
          'CC6.2': 'Prior to issuing system credentials',
          'CC7.2': 'System activity monitoring',
          'CC7.3': 'Detection and investigation of anomalies'
        }
      },
      A: {
        name: 'Availability',
        description: 'System is available for operation and use',
        criteria: {
          'A1.1': 'Availability objectives defined',
          'A1.2': 'Commitments to availability communicated',
          'A2.1': 'Monitoring and maintenance of availability'
        }
      },
      C: {
        name: 'Confidentiality',
        description: 'Information is protected from unauthorized disclosure',
        criteria: {
          'C1.1': 'Confidentiality objectives defined',
          'C1.2': 'Confidentiality obligations communicated',
          'C2.1': 'Access controls implemented'
        }
      },
      CI: {
        name: 'Integrity',
        description: 'Information is complete, accurate, and authorized',
        criteria: {
          'CI1.1': 'Integrity objectives defined',
          'CI1.2': 'Integrity commitments communicated',
          'CI2.1': 'Authorization and approval processes'
        }
      },
      P: {
        name: 'Privacy',
        description: 'Personal information is protected',
        criteria: {
          'P1.1': 'Privacy objectives defined',
          'P2.1': 'Privacy procedures documented',
          'P3.1': 'Authorized access to personal information'
        }
      }
    };
  }

  /**
   * Initialize default security controls
   * @private
   */
  _initializeDefaultControls() {
    const defaultControls = [
      {
        controlId: 'AC-1',
        name: 'Access Control Policy',
        description: 'Establish and maintain access control policies',
        category: 'CC',
        status: 'implemented',
        testingStatus: 'not_tested',
        riskRating: 'critical',
        owner: 'Security'
      },
      {
        controlId: 'AC-2',
        name: 'Authentication',
        description: 'Implement strong authentication mechanisms',
        category: 'CC',
        status: 'implemented',
        testingStatus: 'not_tested',
        riskRating: 'critical',
        owner: 'Security'
      },
      {
        controlId: 'AC-3',
        name: 'Authorization',
        description: 'Enforce role-based authorization',
        category: 'CC',
        status: 'implemented',
        testingStatus: 'not_tested',
        riskRating: 'high',
        owner: 'Security'
      },
      {
        controlId: 'AU-1',
        name: 'Audit Logging',
        description: 'Maintain comprehensive audit logs',
        category: 'CC',
        status: 'implemented',
        testingStatus: 'not_tested',
        riskRating: 'high',
        owner: 'Operations'
      },
      {
        controlId: 'SY-1',
        name: 'System Availability',
        description: 'Monitor and maintain system availability',
        category: 'A',
        status: 'implemented',
        testingStatus: 'not_tested',
        riskRating: 'high',
        owner: 'Operations'
      },
      {
        controlId: 'ENC-1',
        name: 'Data Encryption',
        description: 'Encrypt sensitive data at rest and in transit',
        category: 'C',
        status: 'implemented',
        testingStatus: 'not_tested',
        riskRating: 'critical',
        owner: 'Security'
      },
      {
        controlId: 'INT-1',
        name: 'Data Integrity',
        description: 'Ensure data integrity through checksums and validation',
        category: 'CI',
        status: 'implemented',
        testingStatus: 'not_tested',
        riskRating: 'high',
        owner: 'Development'
      },
      {
        controlId: 'PRI-1',
        name: 'Privacy Controls',
        description: 'Control access to personally identifiable information',
        category: 'P',
        status: 'implemented',
        testingStatus: 'not_tested',
        riskRating: 'high',
        owner: 'Legal'
      }
    ];

    defaultControls.forEach(control => {
      this.controls.set(control.controlId, control);
    });
  }

  /**
   * Register a security control
   * @param {string} controlId - Control identifier
   * @param {Object} controlDetails - Control information
   * @returns {Object} Registration result
   */
  registerControl(controlId, controlDetails) {
    if (!controlId || !controlDetails.name) {
      return { success: false, error: 'Missing required control details' };
    }

    if (!this.trustServiceCriteria[controlDetails.category]) {
      return { success: false, error: 'Invalid trust service category' };
    }

    const control = {
      controlId,
      name: controlDetails.name,
      description: controlDetails.description || '',
      category: controlDetails.category,
      status: controlDetails.status || 'planned',
      testingStatus: 'not_tested',
      riskRating: controlDetails.riskRating || 'medium',
      owner: controlDetails.owner || 'Unknown',
      implementedAt: controlDetails.implementedAt || null,
      evidence: [],
      testResults: [],
      lastReviewedAt: null
    };

    this.controls.set(controlId, control);

    this._logAudit('CONTROL_REGISTERED', {
      controlId,
      name: control.name,
      category: control.category,
      riskRating: control.riskRating
    });

    return {
      success: true,
      controlId,
      message: 'Control registered successfully'
    };
  }

  /**
   * Update control status
   * @param {string} controlId - Control identifier
   * @param {string} status - New status (planned, implemented, tested, certified)
   * @returns {Object} Update result
   */
  updateControlStatus(controlId, status) {
    if (!controlId) {
      return { success: false, error: 'Missing control ID' };
    }

    const validStatuses = ['planned', 'implemented', 'tested', 'certified', 'remediation'];
    if (!validStatuses.includes(status)) {
      return { success: false, error: 'Invalid status' };
    }

    const control = this.controls.get(controlId);
    if (!control) {
      return { success: false, error: 'Control not found' };
    }

    const previousStatus = control.status;
    control.status = status;
    control.lastReviewedAt = new Date();

    if (status === 'implemented' && !control.implementedAt) {
      control.implementedAt = new Date();
    }

    this._logAudit('CONTROL_STATUS_UPDATED', {
      controlId,
      previousStatus,
      newStatus: status,
      timestamp: control.lastReviewedAt.toISOString()
    });

    return {
      success: true,
      controlId,
      newStatus: status,
      message: 'Control status updated successfully'
    };
  }

  /**
   * Collect evidence for a control
   * @param {string} controlId - Control identifier
   * @param {Object} evidence - Evidence details
   * @returns {Object} Evidence record
   */
  collectEvidence(controlId, evidence) {
    if (!controlId || !evidence.description) {
      return { success: false, error: 'Missing control ID or evidence description' };
    }

    const control = this.controls.get(controlId);
    if (!control) {
      return { success: false, error: 'Control not found' };
    }

    const evidenceRecord = {
      evidenceId: crypto.randomBytes(16).toString('hex'),
      controlId,
      description: evidence.description,
      type: evidence.type || 'documentation', // documentation, log, screenshot, etc.
      collectedAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.evidenceRetentionDays * 24 * 60 * 60 * 1000),
      evidenceHash: crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex'),
      custodian: evidence.custodian || 'Unknown',
      confidential: evidence.confidential || false
    };

    if (!this.evidenceRepository.has(controlId)) {
      this.evidenceRepository.set(controlId, []);
    }

    this.evidenceRepository.get(controlId).push(evidenceRecord);
    control.evidence.push(evidenceRecord.evidenceId);

    this._logAudit('EVIDENCE_COLLECTED', {
      controlId,
      evidenceId: evidenceRecord.evidenceId,
      type: evidenceRecord.type
    });

    return {
      success: true,
      evidenceId: evidenceRecord.evidenceId,
      controlId,
      message: 'Evidence collected and retained',
      expiresAt: evidenceRecord.expiresAt
    };
  }

  /**
   * Test a control for effectiveness
   * @param {string} controlId - Control identifier
   * @param {Object} testDetails - Test information
   * @returns {Object} Test result
   */
  testControl(controlId, testDetails) {
    if (!controlId || !testDetails.testProcedure) {
      return { success: false, error: 'Missing control ID or test procedure' };
    }

    const control = this.controls.get(controlId);
    if (!control) {
      return { success: false, error: 'Control not found' };
    }

    const testResult = {
      testId: crypto.randomBytes(16).toString('hex'),
      controlId,
      testDate: new Date(),
      testProcedure: testDetails.testProcedure,
      findings: testDetails.findings || [],
      result: testDetails.result || 'inconclusive', // pass, fail, inconclusive
      evidenceCollected: testDetails.evidenceCollected || [],
      testedBy: testDetails.testedBy || 'Unknown',
      remediation: testDetails.remediation || null,
      remediationDue: testDetails.remediationDue || null
    };

    this.testingResults.push(testResult);
    control.testResults.push(testResult.testId);

    // Update control testing status
    if (testResult.result === 'pass') {
      control.testingStatus = 'passed';
    } else if (testResult.result === 'fail') {
      control.testingStatus = 'failed';
      // Adjust risk rating if control failed
      const riskIncrease = {
        'low': 'medium',
        'medium': 'high',
        'high': 'critical',
        'critical': 'critical'
      };
      control.riskRating = riskIncrease[control.riskRating];
    }

    this._logAudit('CONTROL_TESTED', {
      controlId,
      testId: testResult.testId,
      result: testResult.result,
      testedBy: testResult.testedBy
    });

    return {
      success: true,
      testId: testResult.testId,
      controlId,
      result: testResult.result,
      message: `Control ${testResult.result === 'pass' ? 'passed' : 'needs remediation'} testing`,
      remediation: testResult.remediation
    };
  }

  /**
   * Report an incident
   * @param {Object} incidentDetails - Incident information
   * @returns {Object} Incident record
   */
  reportIncident(incidentDetails) {
    const {
      title,
      description,
      severity = 'medium', // low, medium, high, critical
      affectedControls = [],
      detectedAt = new Date(),
      rootCause = null
    } = incidentDetails;

    if (!title || !description) {
      return { success: false, error: 'Missing incident title or description' };
    }

    const incident = {
      incidentId: crypto.randomBytes(16).toString('hex'),
      title,
      description,
      severity,
      reportedAt: new Date(),
      detectedAt: new Date(detectedAt),
      affectedControls,
      rootCause,
      status: 'open', // open, investigating, remediated, closed
      timeline: [
        {
          event: 'Incident Reported',
          timestamp: new Date(),
          notes: 'Incident created and logged'
        }
      ]
    };

    this.incidents.push(incident);

    // Mark affected controls as requiring remediation
    affectedControls.forEach(controlId => {
      const control = this.controls.get(controlId);
      if (control) {
        control.status = 'remediation';
      }
    });

    this._logAudit('INCIDENT_REPORTED', {
      incidentId: incident.incidentId,
      title: incident.title,
      severity: incident.severity,
      affectedControls: affectedControls.length
    });

    return {
      success: true,
      incidentId: incident.incidentId,
      message: 'Incident reported and tracked',
      severity: incident.severity
    };
  }

  /**
   * Update incident status
   * @param {string} incidentId - Incident identifier
   * @param {string} status - New status
   * @param {Object} update - Update details
   * @returns {Object} Update result
   */
  updateIncident(incidentId, status, update = {}) {
    const validStatuses = ['open', 'investigating', 'remediated', 'closed'];
    if (!validStatuses.includes(status)) {
      return { success: false, error: 'Invalid incident status' };
    }

    const incident = this.incidents.find(i => i.incidentId === incidentId);
    if (!incident) {
      return { success: false, error: 'Incident not found' };
    }

    incident.status = status;
    incident.timeline.push({
      event: `Status changed to ${status}`,
      timestamp: new Date(),
      notes: update.notes || ''
    });

    if (update.rootCause) {
      incident.rootCause = update.rootCause;
    }

    this._logAudit('INCIDENT_UPDATED', {
      incidentId,
      newStatus: status,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      incidentId,
      status,
      message: 'Incident updated successfully'
    };
  }

  /**
   * Register a risk
   * @param {Object} riskDetails - Risk information
   * @returns {Object} Risk record
   */
  registerRisk(riskDetails) {
    const {
      title,
      description,
      likelihood = 'medium', // low, medium, high
      impact = 'medium', // low, medium, high
      affectedControls = [],
      mitigation = null
    } = riskDetails;

    if (!title || !description) {
      return { success: false, error: 'Missing risk title or description' };
    }

    const riskRating = this._calculateRiskRating(likelihood, impact);

    const risk = {
      riskId: crypto.randomBytes(16).toString('hex'),
      title,
      description,
      likelihood,
      impact,
      riskRating,
      affectedControls,
      mitigation,
      status: 'identified', // identified, mitigated, monitored, accepted
      registeredAt: new Date(),
      targetResolutionDate: null
    };

    this.riskRegister.push(risk);

    this._logAudit('RISK_REGISTERED', {
      riskId: risk.riskId,
      title: risk.title,
      riskRating: risk.riskRating,
      affectedControls: affectedControls.length
    });

    return {
      success: true,
      riskId: risk.riskId,
      riskRating,
      message: 'Risk registered in risk register'
    };
  }

  /**
   * Get compliance report
   * @returns {Object} SOC 2 compliance status
   */
  getComplianceReport() {
    const totalControls = this.controls.size;
    const implementedControls = Array.from(this.controls.values())
      .filter(c => c.status !== 'planned').length;
    const testedControls = Array.from(this.controls.values())
      .filter(c => c.testingStatus === 'passed').length;

    // Calculate TSC coverage
    const tscCoverage = {};
    Object.keys(this.trustServiceCriteria).forEach(category => {
      const categoryControls = Array.from(this.controls.values())
        .filter(c => c.category === category);
      const implementedCat = categoryControls.filter(c => c.status !== 'planned').length;
      tscCoverage[category] = {
        total: categoryControls.length,
        implemented: implementedCat,
        rate: categoryControls.length > 0 ?
          ((implementedCat / categoryControls.length) * 100).toFixed(2) + '%' : 'N/A'
      };
    });

    // Calculate risk metrics
    const highRiskControls = Array.from(this.controls.values())
      .filter(c => c.riskRating === 'critical' || c.riskRating === 'high').length;

    const openIncidents = this.incidents.filter(i => i.status === 'open').length;
    const openRisks = this.riskRegister.filter(r => r.status === 'identified').length;

    return {
      reportedAt: new Date(),
      framework: this.config.complianceFramework,
      controls: {
        total: totalControls,
        implemented: implementedControls,
        tested: testedControls,
        implementationRate: totalControls > 0 ?
          ((implementedControls / totalControls) * 100).toFixed(2) + '%' : 'N/A',
        testingRate: totalControls > 0 ?
          ((testedControls / totalControls) * 100).toFixed(2) + '%' : 'N/A'
      },
      trustServiceCriteria: tscCoverage,
      evidence: {
        totalRecords: Array.from(this.evidenceRepository.values())
          .reduce((sum, arr) => sum + arr.length, 0),
        retentionDays: this.config.evidenceRetentionDays
      },
      incidents: {
        total: this.incidents.length,
        open: openIncidents,
        resolved: this.incidents.filter(i => i.status === 'closed').length
      },
      risks: {
        total: this.riskRegister.length,
        identified: openRisks,
        highRisk: highRiskControls
      },
      auditLog: {
        entries: this.auditLog.length,
        retentionDays: this.config.auditLogRetention / (1000 * 60 * 60 * 24)
      },
      complianceScore: this._calculateComplianceScore()
    };
  }

  /**
   * Get control effectiveness summary
   * @returns {Object} Control effectiveness metrics
   */
  getControlEffectiveness() {
    const effectiveness = {};

    this.controls.forEach((control, controlId) => {
      const testResults = control.testResults.map(testId =>
        this.testingResults.find(tr => tr.testId === testId)
      ).filter(Boolean);

      const passedTests = testResults.filter(tr => tr.result === 'pass').length;
      const totalTests = testResults.length;

      effectiveness[controlId] = {
        name: control.name,
        status: control.status,
        testedCount: totalTests,
        passedCount: passedTests,
        successRate: totalTests > 0 ?
          ((passedTests / totalTests) * 100).toFixed(2) + '%' : 'Not Tested',
        riskRating: control.riskRating,
        evidenceCount: control.evidence.length
      };
    });

    return effectiveness;
  }

  /**
   * Calculate risk rating from likelihood and impact
   * @private
   */
  _calculateRiskRating(likelihood, impact) {
    const ratings = {
      'low-low': 'low',
      'low-medium': 'low',
      'low-high': 'medium',
      'medium-low': 'low',
      'medium-medium': 'medium',
      'medium-high': 'high',
      'high-low': 'medium',
      'high-medium': 'high',
      'high-high': 'critical'
    };

    return ratings[`${likelihood}-${impact}`] || 'medium';
  }

  /**
   * Calculate compliance score
   * @private
   */
  _calculateComplianceScore() {
    let score = 100;

    // Deduct for unimplemented controls
    const unimplementedControls = Array.from(this.controls.values())
      .filter(c => c.status === 'planned').length;
    if (unimplementedControls > 0) {
      score -= Math.min(30, unimplementedControls * 5);
    }

    // Deduct for untested controls
    const untestedControls = Array.from(this.controls.values())
      .filter(c => c.testingStatus === 'failed' || c.testingStatus === 'not_tested').length;
    if (untestedControls > 0) {
      score -= Math.min(20, untestedControls * 3);
    }

    // Deduct for open incidents
    const openIncidents = this.incidents.filter(i => i.status === 'open').length;
    if (openIncidents > 0) {
      score -= Math.min(30, openIncidents * 5);
    }

    // Deduct for critical risks
    const criticalRisks = this.riskRegister.filter(r => r.riskRating === 'critical').length;
    if (criticalRisks > 0) {
      score -= Math.min(30, criticalRisks * 10);
    }

    return Math.max(0, score) + '%';
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
}

module.exports = { SOC2ComplianceEngine };
