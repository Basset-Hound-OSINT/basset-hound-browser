/**
 * Basset Hound Browser - Session Coherence WebSocket Commands
 *
 * Provides WebSocket API for real-time session coherence validation
 * across 5 detection layers:
 *
 * - Layer 1: IP/Network Consistency
 * - Layer 2: TLS/HTTP Fingerprint
 * - Layer 3: Device Fingerprint
 * - Layer 4: Behavioral Patterns
 * - Layer 5: Session Identity
 */

const { SessionCoherence } = require('../../src/evasion/session-coherence');
const {
  MasterCoherenceValidator
} = require('../../src/evasion/coherence-validators');

/**
 * Module instances
 */
let sessionCoherence = null;
let masterValidator = null;
const sessionValidators = new Map();

/**
 * Initialize coherence modules
 */
function initializeCoherence() {
  if (!sessionCoherence) {
    sessionCoherence = new SessionCoherence();
  }
  if (!masterValidator) {
    masterValidator = new MasterCoherenceValidator();
  }
}

/**
 * Get or create validator for a session
 */
function getSessionValidator(sessionId) {
  if (!sessionValidators.has(sessionId)) {
    sessionValidators.set(sessionId, new MasterCoherenceValidator());
  }
  return sessionValidators.get(sessionId);
}

/**
 * Register coherence check commands with WebSocket server
 *
 * @param {Object} commandHandlers - Map of command handlers to register with
 */
function registerCoherenceCheckCommands(commandHandlers) {
  initializeCoherence();

  /**
   * Initialize a new coherence-tracked session
   *
   * Command: coherence_init_session
   * Params:
   *   - sessionId: string (required)
   *   - initialData: object (optional)
   *     - os: string
   *     - browser: string
   *     - userAgent: string
   *     - fingerprint: object
   *     - behavior: object
   *     - network: object
   *     - device: object
   *
   * Response: {success, sessionId, initialized}
   */
  commandHandlers.coherence_init_session = async (params) => {
    try {
      const { sessionId, initialData = {} } = params;

      if (!sessionId) {
        return {
          success: false,
          error: 'sessionId is required'
        };
      }

      const result = sessionCoherence.initializeSession(sessionId, initialData);
      getSessionValidator(sessionId);  // Create validator for session

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Record and validate a new interaction
   *
   * Command: coherence_record_interaction
   * Params:
   *   - sessionId: string (required)
   *   - interactionData: object (required)
   *     - type: string (click, type, navigate, etc.)
   *     - fingerprint: object (optional)
   *     - behavior: object (optional)
   *     - network: object (optional)
   *     - device: object (optional)
   *
   * Response: {success, interactionId, coherence, violations, requiresRecovery}
   */
  commandHandlers.coherence_record_interaction = async (params) => {
    try {
      const { sessionId, interactionData } = params;

      if (!sessionId || !interactionData) {
        return {
          success: false,
          error: 'sessionId and interactionData are required'
        };
      }

      const result = sessionCoherence.recordInteraction(sessionId, interactionData);

      // Also run through master validator for detailed analysis
      const validator = getSessionValidator(sessionId);
      const validation = validator.validateAllLayers(interactionData);

      return {
        ...result,
        detailedValidation: {
          layers: Object.keys(validation.layers),
          overallScore: validation.overallScore,
          violationCount: validation.violations.length,
          recommendations: validation.recommendations
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Validate all 5 coherence layers explicitly
   *
   * Command: validate_session_coherence
   * Params:
   *   - sessionId: string (required)
   *   - requestData: object (optional, for manual validation)
   *     - network: object
   *     - tls: object
   *     - headers: object
   *     - device: object
   *     - behavior: object
   *     - cookies: array
   *     - localStorage: array
   *     - cache: object
   *
   * Response: {layers, scores, violations, recommendations, overallCoherence}
   */
  commandHandlers.validate_session_coherence = async (params) => {
    try {
      const { sessionId, requestData = {} } = params;

      if (!sessionId) {
        return {
          success: false,
          error: 'sessionId is required'
        };
      }

      // Get stored session
      const session = sessionCoherence.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          error: `Session not found: ${sessionId}`
        };
      }

      // Run detailed validation
      const validator = getSessionValidator(sessionId);
      const validation = validator.validateAllLayers(requestData);

      return {
        success: true,
        sessionId,
        timestamp: validation.timestamp,
        layers: validation.layers,
        overallCoherence: validation.overallScore,
        violations: validation.violations,
        recommendations: validation.recommendations,
        violationSummary: {
          critical: validation.violations.filter(v => v.severity === 'critical').length,
          high: validation.violations.filter(v => v.severity === 'high').length,
          medium: validation.violations.filter(v => v.severity === 'medium').length,
          low: validation.violations.filter(v => v.severity === 'low').length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get current coherence score
   *
   * Command: get_coherence_score
   * Params:
   *   - sessionId: string (required)
   *
   * Response: {sessionId, score, components, timestamp}
   */
  commandHandlers.get_coherence_score = async (params) => {
    try {
      const { sessionId } = params;

      if (!sessionId) {
        return {
          success: false,
          error: 'sessionId is required'
        };
      }

      const session = sessionCoherence.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          error: `Session not found: ${sessionId}`
        };
      }

      const overallCoherence = sessionCoherence.calculateOverallCoherence(session);
      const validator = getSessionValidator(sessionId);
      const validatorReport = validator.getReport();

      return {
        success: true,
        sessionId,
        score: {
          overall: overallCoherence,
          temporal: session.coherenceScores.temporal || 1.0,
          behavioral: session.coherenceScores.behavioral || 1.0,
          network: session.coherenceScores.network || 1.0,
          device: session.coherenceScores.device || 1.0,
          timeline: session.coherenceScores.timeline || 1.0
        },
        components: {
          interactionCount: session.interactions.length,
          violationCount: session.violations.length,
          recoveryAttempts: session.recoveryAttempts
        },
        validator: {
          currentScore: validatorReport.currentScore,
          validationCount: validatorReport.validationCount
        },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get coherence violations
   *
   * Command: get_coherence_violations
   * Params:
   *   - sessionId: string (required)
   *   - limit: number (optional, default 10)
   *   - layer: string (optional, filter by layer)
   *   - severity: string (optional, filter by severity)
   *
   * Response: {sessionId, violations, count, filtered}
   */
  commandHandlers.get_coherence_violations = async (params) => {
    try {
      const {
        sessionId,
        limit = 10,
        layer = null,
        severity = null
      } = params;

      if (!sessionId) {
        return {
          success: false,
          error: 'sessionId is required'
        };
      }

      const session = sessionCoherence.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          error: `Session not found: ${sessionId}`
        };
      }

      let violations = session.violations;

      if (layer) {
        violations = violations.filter(v => v.layer === layer);
      }

      if (severity) {
        violations = violations.filter(v => v.severity === severity);
      }

      violations = violations.slice(-limit);

      return {
        success: true,
        sessionId,
        violations,
        count: violations.length,
        totalViolations: session.violations.length,
        filtered: layer || severity ? true : false,
        filterCriteria: { layer, severity }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get detailed coherence report
   *
   * Command: get_coherence_report
   * Params:
   *   - sessionId: string (required)
   *
   * Response: {sessionId, duration, interactionCount, overallCoherence, layers, violations}
   */
  commandHandlers.get_coherence_report = async (params) => {
    try {
      const { sessionId } = params;

      if (!sessionId) {
        return {
          success: false,
          error: 'sessionId is required'
        };
      }

      const report = sessionCoherence.getCoherenceReport(sessionId);

      if (report.error) {
        return {
          success: false,
          error: report.error
        };
      }

      return {
        success: true,
        ...report
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Attempt coherence recovery
   *
   * Command: coherence_attempt_recovery
   * Params:
   *   - sessionId: string (required)
   *   - violationType: string (optional, 'temporal', 'behavioral', etc.)
   *
   * Response: {sessionId, attempt, violationCount, actions}
   */
  commandHandlers.coherence_attempt_recovery = async (params) => {
    try {
      const { sessionId, violationType = null } = params;

      if (!sessionId) {
        return {
          success: false,
          error: 'sessionId is required'
        };
      }

      const recovery = sessionCoherence.attemptRecovery(sessionId, violationType);

      return {
        success: true,
        ...recovery
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Configure coherence validation modes
   *
   * Command: set_coherence_mode
   * Params:
   *   - sessionId: string (required)
   *   - mode: string (required)
   *     - 'strict': High sensitivity, catch minor inconsistencies
   *     - 'moderate': Balanced, catch significant issues
   *     - 'relaxed': Low sensitivity, only critical issues
   *     - 'monitoring': Track but don't enforce
   *
   * Response: {sessionId, mode, thresholds}
   */
  commandHandlers.set_coherence_mode = async (params) => {
    try {
      const { sessionId, mode = 'moderate' } = params;

      if (!sessionId) {
        return {
          success: false,
          error: 'sessionId is required'
        };
      }

      const validModes = ['strict', 'moderate', 'relaxed', 'monitoring'];
      if (!validModes.includes(mode)) {
        return {
          success: false,
          error: `Invalid mode. Must be one of: ${validModes.join(', ')}`
        };
      }

      const session = sessionCoherence.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          error: `Session not found: ${sessionId}`
        };
      }

      // Update thresholds based on mode
      const thresholds = {
        strict: {
          temporal: 0.98,
          behavioral: 0.95,
          network: 0.93,
          device: 0.98,
          timeline: 0.96
        },
        moderate: {
          temporal: 0.95,
          behavioral: 0.92,
          network: 0.90,
          device: 0.95,
          timeline: 0.94
        },
        relaxed: {
          temporal: 0.90,
          behavioral: 0.85,
          network: 0.80,
          device: 0.90,
          timeline: 0.88
        },
        monitoring: {
          temporal: 0.50,
          behavioral: 0.50,
          network: 0.50,
          device: 0.50,
          timeline: 0.50
        }
      };

      session.coherenceMode = mode;
      session.coherenceThresholds = thresholds[mode];

      return {
        success: true,
        sessionId,
        mode,
        thresholds: thresholds[mode]
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * List all active coherence-tracked sessions
   *
   * Command: list_coherence_sessions
   * Params: (none)
   *
   * Response: {sessions: [{sessionId, duration, score, interactionCount}]}
   */
  commandHandlers.list_coherence_sessions = async (params) => {
    try {
      const sessions = [];

      for (const [sessionId, session] of sessionCoherence.sessions.entries()) {
        const score = sessionCoherence.calculateOverallCoherence(session);
        sessions.push({
          sessionId,
          duration: Date.now() - session.createdAt,
          score,
          interactionCount: session.interactions.length,
          violationCount: session.violations.length,
          mode: session.coherenceMode || 'moderate'
        });
      }

      return {
        success: true,
        sessions,
        count: sessions.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Delete/cleanup a coherence session
   *
   * Command: delete_coherence_session
   * Params:
   *   - sessionId: string (required)
   *
   * Response: {success, sessionId, deleted}
   */
  commandHandlers.delete_coherence_session = async (params) => {
    try {
      const { sessionId } = params;

      if (!sessionId) {
        return {
          success: false,
          error: 'sessionId is required'
        };
      }

      const deleted = sessionCoherence.deleteSession(sessionId);
      sessionValidators.delete(sessionId);

      return {
        success: true,
        sessionId,
        deleted
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get layer-specific validation details
   *
   * Command: get_layer_details
   * Params:
   *   - sessionId: string (required)
   *   - layer: number (required, 1-5)
   *   - detailed: boolean (optional, default false)
   *
   * Response: {sessionId, layer, violations, score, details}
   */
  commandHandlers.get_layer_details = async (params) => {
    try {
      const { sessionId, layer, detailed = false } = params;

      if (!sessionId || !layer) {
        return {
          success: false,
          error: 'sessionId and layer are required'
        };
      }

      if (layer < 1 || layer > 5) {
        return {
          success: false,
          error: 'layer must be between 1 and 5'
        };
      }

      const session = sessionCoherence.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          error: `Session not found: ${sessionId}`
        };
      }

      const layerNames = ['', 'temporal', 'behavioral', 'network', 'device', 'timeline'];
      const layerName = layerNames[layer];
      const layerData = session.layers[layerName];
      const violations = session.violations.filter(v => v.layer === layerName);

      const response = {
        success: true,
        sessionId,
        layer,
        layerName,
        violationCount: violations.length,
        violations: detailed ? violations : violations.slice(-5)
      };

      // Add layer-specific details
      if (layer === 1) {
        response.temporalScore = session.coherenceScores.temporal;
        response.fpHistoryLength = layerData.history.length;
      } else if (layer === 2) {
        response.behavioralScore = session.coherenceScores.behavioral;
        response.patternCount = layerData.patterns.length;
      } else if (layer === 3) {
        response.networkScore = session.coherenceScores.network;
        response.requestCount = layerData.requests.length;
      } else if (layer === 4) {
        response.deviceScore = session.coherenceScores.device;
        response.changeCount = layerData.changes.length;
      } else if (layer === 5) {
        response.timelineScore = session.coherenceScores.timeline;
        response.eventCount = layerData.events.length;
        response.gapCount = layerData.gaps.length;
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };
}

module.exports = {
  registerCoherenceCheckCommands,
  getSessionCoherence: () => sessionCoherence,
  getMasterValidator: () => masterValidator
};
