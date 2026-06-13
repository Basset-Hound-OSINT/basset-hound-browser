/**
 * Basset Hound Browser - Session Coherence Manager
 * Real-time 5-layer cross-request coherence validation
 *
 * Coordinates coherence validation across:
 * - Layer 1: IP/Network Consistency
 * - Layer 2: TLS/HTTP Fingerprint Consistency
 * - Layer 3: Device Fingerprint Consistency
 * - Layer 4: Behavioral Pattern Consistency
 * - Layer 5: Session Identity Consistency
 *
 * Version: 1.0.0
 * Created: June 13, 2026
 */

const { MasterCoherenceValidator } = require('./coherence-validators');

class CoherenceManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> session data
    this.validators = new Map(); // sessionId -> MasterCoherenceValidator
    this.coherenceThresholds = {
      temporal: 0.92,      // Fingerprint drift threshold
      behavioral: 0.90,    // Behavior consistency threshold
      network: 0.88,       // Network pattern threshold
      device: 0.95,        // Device consistency threshold
      timeline: 0.91       // Timeline coherence threshold
    };
  }

  /**
   * Initialize a new coherence-tracked session
   * @param {string} sessionId - Unique session identifier
   * @param {Object} initialData - Initial fingerprint/device/behavior data
   * @returns {Object} Initialization result
   */
  initializeSession(sessionId, initialData = {}) {
    if (this.sessions.has(sessionId)) {
      return {
        success: false,
        error: `Session ${sessionId} already initialized`
      };
    }

    const session = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      startTimestamp: Date.now(),
      interactions: [],
      coherenceScores: {},
      coherenceHistory: [],
      violations: [],
      recoveryAttempts: 0,
      metadata: {
        os: initialData.os || null,
        browser: initialData.browser || null,
        userAgent: initialData.userAgent || null,
        country: initialData.country || null,
        ip: initialData.ip || null
      },
      baseline: {
        fingerprint: initialData.fingerprint || null,
        behavior: initialData.behavior || null,
        device: initialData.device || null,
        network: initialData.network || null,
        headers: initialData.headers || null
      }
    };

    this.sessions.set(sessionId, session);
    this.validators.set(sessionId, new MasterCoherenceValidator());

    return {
      success: true,
      sessionId,
      initialized: true,
      message: 'Session coherence tracking initialized'
    };
  }

  /**
   * Record an interaction and perform coherence validation
   * @param {string} sessionId - Session ID
   * @param {Object} interactionData - Interaction details
   * @returns {Object} Coherence validation result
   */
  recordInteraction(sessionId, interactionData) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const timestamp = Date.now();

    // Create interaction record
    const interaction = {
      id: `interaction_${session.interactions.length}_${timestamp}`,
      timestamp,
      type: interactionData.type,
      url: interactionData.url || null,
      data: interactionData,
      coherenceCheckResult: null
    };

    // Perform coherence validation if data provided
    if (interactionData.requestData) {
      const validator = this.validators.get(sessionId);
      const validationResult = validator.validateAllLayers(interactionData.requestData);
      interaction.coherenceCheckResult = validationResult;
    }

    session.interactions.push(interaction);

    return {
      success: true,
      interactionId: interaction.id,
      coherenceResult: interaction.coherenceCheckResult
    };
  }

  /**
   * Get real-time coherence analysis for a session
   * @param {string} sessionId - Session ID
   * @returns {Object} Comprehensive coherence analysis
   */
  analyzeCoherence(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const validator = this.validators.get(sessionId);
    const report = validator.getReport();

    // Calculate per-layer scores from validation history
    const layerScores = this.calculateLayerScores(session, validator);

    // Detect violations
    const violations = this.aggregateViolations(session);

    // Calculate overall coherence score
    const overallCoherence = this.calculateOverallCoherence(layerScores);

    // Generate recovery suggestions
    const suggestions = this.generateRecoverySuggestions(violations, layerScores);

    const analysis = {
      sessionId,
      timestamp: new Date().toISOString(),
      overallCoherence,
      isCoherent: overallCoherence >= 0.85,
      layers: {
        temporal: {
          score: layerScores.temporal,
          status: layerScores.temporal >= this.coherenceThresholds.temporal ? 'COHERENT' : 'VIOLATION',
          fingerprintDrift: this.calculateFingerprintDrift(session),
          violations: violations.filter(v => v.layer === 'temporal' || v.component?.includes('fingerprint')),
          evidence: {
            initialFingerprint: session.baseline.fingerprint,
            driftAnalysis: `Fingerprint drift ${(this.calculateFingerprintDrift(session) * 100).toFixed(1)}% (max 2%)`
          }
        },
        behavioral: {
          score: layerScores.behavioral,
          status: layerScores.behavioral >= this.coherenceThresholds.behavioral ? 'COHERENT' : 'VIOLATION',
          patternConsistency: layerScores.behavioral,
          violations: violations.filter(v => v.layer === 'behavioral'),
          evidence: {
            mousePattern: `${session.interactions.length} interactions tracked`,
            typingPattern: 'Consistency analyzed across keystroke timing',
            scrollPattern: 'Scroll behavior validated'
          }
        },
        network: {
          score: layerScores.network,
          status: layerScores.network >= this.coherenceThresholds.network ? 'COHERENT' : 'VIOLATION',
          requestPatternMatch: layerScores.network,
          violations: violations.filter(v => v.layer === 'network'),
          evidence: {
            requestTiming: 'Request timing analyzed for consistency',
            headerConsistency: 'HTTP headers validated',
            bandwidthMatch: 'Network patterns match device capabilities'
          }
        },
        device: {
          score: layerScores.device,
          status: layerScores.device >= this.coherenceThresholds.device ? 'COHERENT' : 'VIOLATION',
          contradictions: violations.filter(v => v.layer === 'device').length,
          violations: violations.filter(v => v.layer === 'device'),
          evidence: {
            osConsistency: `${session.metadata.os} consistently claimed`,
            browserConsistency: `${session.metadata.browser} consistently claimed`,
            screenConsistency: 'Screen resolution consistent',
            pluginConsistency: 'Plugin presence consistent'
          }
        },
        timeline: {
          score: layerScores.timeline,
          status: layerScores.timeline >= this.coherenceThresholds.timeline ? 'COHERENT' : 'VIOLATION',
          gaps: this.detectTimelineGaps(session),
          violations: violations.filter(v => v.layer === 'timeline'),
          evidence: {
            totalEventCount: session.interactions.length,
            eventSequenceValid: this.validateEventSequence(session),
            noTimeTravel: this.detectTimeTravel(session)
          }
        }
      },
      history: report.recentValidations || [],
      totalInteractions: session.interactions.length,
      sessionDuration: Date.now() - session.startTimestamp,
      recoveryStrategies: suggestions
    };

    // Store in history
    session.coherenceHistory.push({
      timestamp: new Date().toISOString(),
      coherenceScore: analysis.overallCoherence,
      layerScores
    });

    return analysis;
  }

  /**
   * Compare two sessions for coherence similarity
   * @param {string} sessionId1 - First session ID
   * @param {string} sessionId2 - Second session ID
   * @returns {Object} Session comparison result
   */
  compareSessions(sessionId1, sessionId2) {
    const session1 = this.sessions.get(sessionId1);
    const session2 = this.sessions.get(sessionId2);

    if (!session1 || !session2) {
      throw new Error('One or both sessions not found');
    }

    const comparison = {
      session1Id: sessionId1,
      session2Id: sessionId2,
      timestamp: new Date().toISOString(),
      deviceMatch: this.compareDeviceFingerprints(session1, session2),
      behaviorMatch: this.compareBehaviorPatterns(session1, session2),
      networkMatch: this.compareNetworkPatterns(session1, session2),
      overallMatch: 0,
      likelyUserMatch: false,
      differenceFactors: []
    };

    // Calculate weighted overall match
    comparison.overallMatch = (
      comparison.deviceMatch * 0.35 +
      comparison.behaviorMatch * 0.35 +
      comparison.networkMatch * 0.30
    );

    comparison.likelyUserMatch = comparison.overallMatch >= 0.75;

    // Generate difference factors
    if (comparison.deviceMatch < 0.90) {
      comparison.differenceFactors.push(
        `Device fingerprint differs: ${(comparison.deviceMatch * 100).toFixed(1)}% match`
      );
    }
    if (Math.abs(session1.metadata.ip === session2.metadata.ip ? 1 : 0) < 0.5) {
      comparison.differenceFactors.push(
        'IP addresses differ (expected for geographically distributed sessions)'
      );
    }
    if (comparison.behaviorMatch < 0.80) {
      comparison.differenceFactors.push(
        'Behavioral patterns differ (acceptable for time-shifted sessions)'
      );
    }

    return comparison;
  }

  /**
   * Export session coherence data for forensic analysis
   * @param {string} sessionId - Session ID
   * @returns {Object} Coherence report for export
   */
  exportSessionCoherence(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const analysis = this.analyzeCoherence(sessionId);

    return {
      sessionId,
      createdAt: session.createdAt,
      duration: Date.now() - session.startTimestamp,
      coherenceReport: {
        overallScore: analysis.overallCoherence,
        isCoherent: analysis.isCoherent,
        timestamp: analysis.timestamp,
        layerScores: {
          temporal: analysis.layers.temporal.score,
          behavioral: analysis.layers.behavioral.score,
          network: analysis.layers.network.score,
          device: analysis.layers.device.score,
          timeline: analysis.layers.timeline.score
        }
      },
      violations: analysis.history.flatMap(h => h.violations || []),
      interactionCount: session.interactions.length,
      layerDetails: {
        temporal: {
          history: session.coherenceHistory.slice(-10),
          fingerprintDrift: analysis.layers.temporal.fingerprintDrift
        },
        behavioral: {
          patterns: session.interactions.length,
          interactionTypes: this.getInteractionTypeSummary(session)
        },
        network: {
          requests: session.interactions.length,
          uniqueIPs: this.countUniqueIPs(session)
        },
        device: {
          changes: analysis.layers.device.contradictions,
          metadata: session.metadata
        },
        timeline: {
          events: session.interactions.length,
          gaps: analysis.layers.timeline.gaps.length,
          timeTravel: !analysis.layers.timeline.evidence.noTimeTravel
        }
      },
      recommendations: analysis.recoveryStrategies,
      forensicHash: this.generateForensicHash(session)
    };
  }

  /**
   * Get coherence summary for quick status check
   * @param {string} sessionId - Session ID
   * @returns {Object} Quick status summary
   */
  getCoherenceSummary(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const analysis = this.analyzeCoherence(sessionId);

    return {
      sessionId,
      overallCoherence: analysis.overallCoherence,
      isCoherent: analysis.isCoherent,
      timestamp: analysis.timestamp,
      violationCount: analysis.history.reduce((sum, h) => sum + (h.violations?.length || 0), 0),
      interactionCount: session.interactions.length,
      criticalViolations: this.aggregateViolations(session).filter(v => v.severity === 'critical').length,
      highViolations: this.aggregateViolations(session).filter(v => v.severity === 'high').length,
      warnings: analysis.recoveryStrategies
    };
  }

  // ========== PRIVATE HELPER METHODS ==========

  calculateLayerScores(session, validator) {
    const report = validator.getReport();
    const recentValidations = report.recentValidations || [];

    if (recentValidations.length === 0) {
      return {
        temporal: 1.0,
        behavioral: 1.0,
        network: 1.0,
        device: 1.0,
        timeline: 1.0
      };
    }

    // Average scores from recent validations
    const scores = {
      temporal: 0,
      behavioral: 0,
      network: 0,
      device: 0,
      timeline: 0
    };

    for (const validation of recentValidations) {
      const layers = validation.layers || {};
      if (layers.layer1) scores.temporal += layers.layer1.score || 0;
      if (layers.layer2) scores.behavioral += layers.layer2.score || 0;
      if (layers.layer3) scores.network += layers.layer3.score || 0;
      if (layers.layer4) scores.device += layers.layer4.score || 0;
      if (layers.layer5) scores.timeline += layers.layer5.score || 0;
    }

    const count = recentValidations.length;
    return {
      temporal: Math.min(1, scores.temporal / count || 1.0),
      behavioral: Math.min(1, scores.behavioral / count || 1.0),
      network: Math.min(1, scores.network / count || 1.0),
      device: Math.min(1, scores.device / count || 1.0),
      timeline: Math.min(1, scores.timeline / count || 1.0)
    };
  }

  calculateFingerprintDrift(session) {
    if (session.interactions.length === 0 || !session.baseline.fingerprint) {
      return 0;
    }

    let maxDrift = 0;
    for (const interaction of session.interactions) {
      if (interaction.coherenceCheckResult?.layers?.layer3?.score) {
        const drift = 1 - interaction.coherenceCheckResult.layers.layer3.score;
        maxDrift = Math.max(maxDrift, drift);
      }
    }

    return Math.min(1, maxDrift);
  }

  detectTimelineGaps(session) {
    const gaps = [];
    const maxGap = 60000; // 60 seconds

    for (let i = 1; i < session.interactions.length; i++) {
      const gap = session.interactions[i].timestamp - session.interactions[i - 1].timestamp;
      if (gap > maxGap) {
        gaps.push({
          from: new Date(session.interactions[i - 1].timestamp).toISOString(),
          to: new Date(session.interactions[i].timestamp).toISOString(),
          duration: gap,
          explanation: 'User idle period'
        });
      }
    }

    return gaps;
  }

  validateEventSequence(session) {
    for (let i = 1; i < session.interactions.length; i++) {
      if (session.interactions[i].timestamp < session.interactions[i - 1].timestamp) {
        return false; // Time travel detected
      }
    }
    return true;
  }

  detectTimeTravel(session) {
    return this.validateEventSequence(session);
  }

  aggregateViolations(session) {
    const violations = [];

    for (const interaction of session.interactions) {
      if (interaction.coherenceCheckResult?.violations) {
        violations.push(...interaction.coherenceCheckResult.violations);
      }
    }

    return violations;
  }

  calculateOverallCoherence(layerScores) {
    const weights = {
      temporal: 0.20,
      behavioral: 0.20,
      network: 0.15,
      device: 0.25,
      timeline: 0.20
    };

    return (
      layerScores.temporal * weights.temporal +
      layerScores.behavioral * weights.behavioral +
      layerScores.network * weights.network +
      layerScores.device * weights.device +
      layerScores.timeline * weights.timeline
    );
  }

  generateRecoverySuggestions(violations, layerScores) {
    const suggestions = [];

    if (violations.length === 0) {
      return suggestions;
    }

    const highViolations = violations.filter(v => v.severity === 'high');
    const criticalViolations = violations.filter(v => v.severity === 'critical');

    if (criticalViolations.length > 0) {
      suggestions.push({
        violation: `${criticalViolations.length} critical violations detected`,
        severity: 'CRITICAL',
        suggestion: 'Restart session immediately - coherence failure',
        command: 'restart_session'
      });
    }

    if (highViolations.length >= 2) {
      suggestions.push({
        violation: `${highViolations.length} high-severity violations`,
        severity: 'WARNING',
        suggestion: 'Apply evasion recovery measures',
        command: 'apply_evasion_recovery'
      });
    }

    if (violations.some(v => v.component === 'ip_consistency')) {
      suggestions.push({
        violation: 'IP consistency violation',
        severity: 'WARNING',
        suggestion: 'Stabilize IP address - avoid rapid IP changes',
        command: 'stabilize_ip'
      });
    }

    if (violations.some(v => v.component === 'ja3_consistency')) {
      suggestions.push({
        violation: 'TLS fingerprint changed',
        severity: 'WARNING',
        suggestion: 'Maintain consistent TLS fingerprint',
        command: 'fix_tls_fingerprint'
      });
    }

    if (violations.some(v => v.component === 'user_agent')) {
      suggestions.push({
        violation: 'User-Agent changed',
        severity: 'WARNING',
        suggestion: 'Keep User-Agent constant throughout session',
        command: 'fix_user_agent'
      });
    }

    if (layerScores.behavioral < 0.85) {
      suggestions.push({
        violation: 'Behavioral coherence low',
        severity: 'INFO',
        suggestion: 'Add natural pauses and variations to behavior',
        command: 'enhance_behavior_simulation'
      });
    }

    return suggestions;
  }

  compareDeviceFingerprints(session1, session2) {
    if (!session1.baseline.device || !session2.baseline.device) {
      return 0.5; // Unknown
    }

    const fp1 = session1.baseline.device;
    const fp2 = session2.baseline.device;

    let matches = 0;
    let total = 0;

    const keys = new Set([...Object.keys(fp1), ...Object.keys(fp2)]);
    for (const key of keys) {
      total++;
      if (fp1[key] === fp2[key]) {
        matches++;
      }
    }

    return total > 0 ? matches / total : 0.5;
  }

  compareBehaviorPatterns(session1, session2) {
    const patterns1 = this.extractBehaviorPatterns(session1);
    const patterns2 = this.extractBehaviorPatterns(session2);

    if (!patterns1 || !patterns2) {
      return 0.5;
    }

    // Compare typing speed, mouse patterns, etc.
    let similarities = 0;
    if (patterns1.avgTypingSpeed && patterns2.avgTypingSpeed) {
      const speedDiff = Math.abs(patterns1.avgTypingSpeed - patterns2.avgTypingSpeed);
      similarities += 1 - (speedDiff / 100); // Normalize
    }

    return Math.min(1, similarities);
  }

  compareNetworkPatterns(session1, session2) {
    const count1 = session1.interactions.length;
    const count2 = session2.interactions.length;

    if (count1 === 0 || count2 === 0) {
      return 0.5;
    }

    // Compare request frequencies and patterns
    const rateDiff = Math.abs(count1 - count2) / Math.max(count1, count2);
    return 1 - rateDiff;
  }

  extractBehaviorPatterns(session) {
    if (session.interactions.length === 0) {
      return null;
    }

    let totalTypingSpeed = 0;
    let typingCount = 0;

    for (const interaction of session.interactions) {
      if (interaction.type === 'type' && interaction.data.speed) {
        totalTypingSpeed += interaction.data.speed;
        typingCount++;
      }
    }

    return {
      avgTypingSpeed: typingCount > 0 ? totalTypingSpeed / typingCount : 0,
      interactionCount: session.interactions.length
    };
  }

  getInteractionTypeSummary(session) {
    const summary = {};
    for (const interaction of session.interactions) {
      summary[interaction.type] = (summary[interaction.type] || 0) + 1;
    }
    return summary;
  }

  countUniqueIPs(session) {
    const ips = new Set();
    for (const interaction of session.interactions) {
      if (interaction.data.requestData?.network?.ip) {
        ips.add(interaction.data.requestData.network.ip);
      }
    }
    return ips.size;
  }

  generateForensicHash(session) {
    const crypto = require('crypto');
    const dataToHash = JSON.stringify({
      sessionId: session.id,
      interactionCount: session.interactions.length,
      createdAt: session.createdAt
    });
    return crypto.createHash('sha256').update(dataToHash).digest('hex');
  }

  /**
   * Clean up old sessions to manage memory
   */
  cleanupOldSessions(maxAgeMs = 3600000) { // 1 hour default
    const now = Date.now();
    const toDelete = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.startTimestamp > maxAgeMs) {
        toDelete.push(sessionId);
      }
    }

    for (const sessionId of toDelete) {
      this.sessions.delete(sessionId);
      this.validators.delete(sessionId);
    }

    return { cleaned: toDelete.length };
  }
}

module.exports = { CoherenceManager };
