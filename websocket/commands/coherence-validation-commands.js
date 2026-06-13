/**
 * Basset Hound Browser - Session Coherence Validation WebSocket Commands
 * Implements real-time 5-layer coherence validation API
 *
 * Commands:
 * - coherence_init_session - Initialize coherence-tracked session
 * - coherence_record_interaction - Record and validate interaction
 * - coherence_analyze - Get comprehensive coherence analysis
 * - coherence_compare_sessions - Compare two sessions
 * - coherence_export - Export session coherence data
 * - coherence_summary - Get quick status summary
 * - coherence_list_sessions - List all tracked sessions
 *
 * Version: 1.0.0
 * Created: June 13, 2026
 */

const { CoherenceManager } = require('../../src/evasion/coherence-manager');

/**
 * Module state
 */
let coherenceManager = null;

/**
 * Initialize coherence manager
 */
function initializeCoherenceManager() {
  if (!coherenceManager) {
    coherenceManager = new CoherenceManager();
  }
  return coherenceManager;
}

/**
 * Register all coherence validation commands with WebSocket server
 *
 * @param {Object} commandHandlers - Map of command names to handlers
 */
function registerCoherenceValidationCommands(commandHandlers) {
  const manager = initializeCoherenceManager();

  /**
   * Command: coherence_init_session
   *
   * Initialize a new session for real-time coherence tracking
   *
   * Params:
   * {
   *   "sessionId": "sess_123",
   *   "initialData": {
   *     "os": "macOS",
   *     "browser": "Chrome 114",
   *     "userAgent": "Mozilla/5.0...",
   *     "country": "US",
   *     "ip": "1.2.3.4",
   *     "fingerprint": {...},
   *     "behavior": {...},
   *     "device": {...},
   *     "network": {...},
   *     "headers": {...}
   *   }
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "sessionId": "sess_123",
   *   "initialized": true,
   *   "message": "Session coherence tracking initialized"
   * }
   */
  commandHandlers.coherence_init_session = async (params) => {
    try {
      if (!params.sessionId) {
        return {
          success: false,
          error: 'sessionId is required'
        };
      }

      const result = manager.initializeSession(
        params.sessionId,
        params.initialData || {}
      );

      return {
        success: result.success,
        sessionId: result.sessionId,
        initialized: result.initialized,
        message: result.message || '',
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: coherence_record_interaction
   *
   * Record a browser interaction and validate coherence
   *
   * Params:
   * {
   *   "sessionId": "sess_123",
   *   "interactionData": {
   *     "type": "navigate",
   *     "url": "https://example.com",
   *     "timestamp": 1686786225000,
   *     "requestData": {
   *       "network": {...},
   *       "headers": {...},
   *       "tls": {...},
   *       "device": {...},
   *       "behavior": {...},
   *       "cookies": [...],
   *       "localStorage": [...],
   *       "cache": {...}
   *     }
   *   }
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "interactionId": "interaction_0_1686786225123",
   *   "coherenceResult": {
   *     "timestamp": "2026-06-13T14:23:45Z",
   *     "overallScore": 0.94,
   *     "layers": {...},
   *     "violations": [...]
   *   }
   * }
   */
  commandHandlers.coherence_record_interaction = async (params) => {
    try {
      if (!params.sessionId) {
        return {
          success: false,
          error: 'sessionId is required'
        };
      }

      const result = manager.recordInteraction(
        params.sessionId,
        params.interactionData || {}
      );

      return {
        success: result.success,
        interactionId: result.interactionId,
        coherenceResult: result.coherenceResult || null
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: coherence_analyze
   *
   * Get comprehensive 5-layer coherence analysis for a session
   *
   * Params:
   * {
   *   "sessionId": "sess_123"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "sessionId": "sess_123",
   *   "overallCoherence": 0.942,
   *   "isCoherent": true,
   *   "timestamp": "2026-06-13T14:23:45Z",
   *   "layers": {
   *     "temporal": {
   *       "score": 0.961,
   *       "status": "COHERENT",
   *       "fingerprintDrift": 0.01,
   *       "violations": [],
   *       "evidence": {...}
   *     },
   *     ... (4 more layers)
   *   },
   *   "history": [...],
   *   "totalInteractions": 45,
   *   "sessionDuration": 234567,
   *   "recoveryStrategies": [...]
   * }
   */
  commandHandlers.coherence_analyze = async (params) => {
    try {
      if (!params.sessionId) {
        return {
          success: false,
          error: 'sessionId is required'
        };
      }

      const analysis = manager.analyzeCoherence(params.sessionId);

      return {
        success: true,
        sessionId: params.sessionId,
        overallCoherence: analysis.overallCoherence,
        isCoherent: analysis.isCoherent,
        timestamp: analysis.timestamp,
        layers: analysis.layers,
        history: analysis.history,
        totalInteractions: analysis.totalInteractions,
        sessionDuration: analysis.sessionDuration,
        recoveryStrategies: analysis.recoveryStrategies
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: coherence_compare_sessions
   *
   * Compare two sessions for coherence similarity
   *
   * Params:
   * {
   *   "sessionId1": "sess_123",
   *   "sessionId2": "sess_456"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "session1Id": "sess_123",
   *   "session2Id": "sess_456",
   *   "deviceMatch": 0.98,
   *   "behaviorMatch": 0.85,
   *   "networkMatch": 0.92,
   *   "overallMatch": 0.92,
   *   "likelyUserMatch": true,
   *   "differenceFactors": [...]
   * }
   */
  commandHandlers.coherence_compare_sessions = async (params) => {
    try {
      if (!params.sessionId1 || !params.sessionId2) {
        return {
          success: false,
          error: 'sessionId1 and sessionId2 are required'
        };
      }

      const comparison = manager.compareSessions(
        params.sessionId1,
        params.sessionId2
      );

      return {
        success: true,
        session1Id: comparison.session1Id,
        session2Id: comparison.session2Id,
        deviceMatch: comparison.deviceMatch,
        behaviorMatch: comparison.behaviorMatch,
        networkMatch: comparison.networkMatch,
        overallMatch: comparison.overallMatch,
        likelyUserMatch: comparison.likelyUserMatch,
        differenceFactors: comparison.differenceFactors,
        timestamp: comparison.timestamp
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: coherence_export
   *
   * Export session coherence data for forensic analysis
   *
   * Params:
   * {
   *   "sessionId": "sess_123"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "sessionId": "sess_123",
   *   "createdAt": "2026-06-13T14:00:00Z",
   *   "duration": 234567,
   *   "coherenceReport": {...},
   *   "violations": [...],
   *   "interactionCount": 45,
   *   "layerDetails": {...},
   *   "recommendations": [...],
   *   "forensicHash": "sha256:abc123..."
   * }
   */
  commandHandlers.coherence_export = async (params) => {
    try {
      if (!params.sessionId) {
        return {
          success: false,
          error: 'sessionId is required'
        };
      }

      const export_data = manager.exportSessionCoherence(params.sessionId);

      return {
        success: true,
        data: export_data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: coherence_summary
   *
   * Get quick coherence status summary
   *
   * Params:
   * {
   *   "sessionId": "sess_123"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "sessionId": "sess_123",
   *   "overallCoherence": 0.942,
   *   "isCoherent": true,
   *   "timestamp": "2026-06-13T14:23:45Z",
   *   "violationCount": 0,
   *   "interactionCount": 45,
   *   "criticalViolations": 0,
   *   "highViolations": 0,
   *   "warnings": [...]
   * }
   */
  commandHandlers.coherence_summary = async (params) => {
    try {
      if (!params.sessionId) {
        return {
          success: false,
          error: 'sessionId is required'
        };
      }

      const summary = manager.getCoherenceSummary(params.sessionId);

      return {
        success: true,
        data: summary
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: coherence_list_sessions
   *
   * List all active coherence-tracked sessions
   *
   * Params: {} (none)
   *
   * Response:
   * {
   *   "success": true,
   *   "sessions": [
   *     {
   *       "sessionId": "sess_123",
   *       "createdAt": "2026-06-13T14:00:00Z",
   *       "interactionCount": 45,
   *       "overallCoherence": 0.942
   *     }
   *   ],
   *   "totalSessions": 1
   * }
   */
  commandHandlers.coherence_list_sessions = async (params) => {
    try {
      const sessions = [];

      for (const [sessionId, session] of manager.sessions.entries()) {
        try {
          const summary = manager.getCoherenceSummary(sessionId);
          sessions.push({
            sessionId,
            createdAt: session.createdAt,
            interactionCount: session.interactions.length,
            overallCoherence: summary.overallCoherence,
            isCoherent: summary.isCoherent,
            lastInteractionTime: session.interactions.length > 0
              ? new Date(session.interactions[session.interactions.length - 1].timestamp).toISOString()
              : null
          });
        } catch (err) {
          // Skip sessions that error during summary
          console.error(`Error getting summary for ${sessionId}:`, err.message);
        }
      }

      return {
        success: true,
        sessions,
        totalSessions: sessions.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: coherence_cleanup
   *
   * Clean up old sessions to manage memory
   *
   * Params:
   * {
   *   "maxAgeMs": 3600000  // Optional, default 1 hour
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "cleaned": 5,
   *   "remaining": 10
   * }
   */
  commandHandlers.coherence_cleanup = async (params) => {
    try {
      const maxAge = params.maxAgeMs || 3600000; // 1 hour default
      const result = manager.cleanupOldSessions(maxAge);

      return {
        success: true,
        cleaned: result.cleaned,
        remaining: manager.sessions.size
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  return commandHandlers;
}

module.exports = {
  registerCoherenceValidationCommands,
  initializeCoherenceManager
};
