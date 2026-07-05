/**
 * Behavioral Scoring WebSocket Commands
 *
 * Real-time behavioral coherence scoring commands
 *
 * Commands:
 * - enable_behavioral_scoring
 * - disable_behavioral_scoring
 * - get_behavioral_score
 * - get_behavioral_metrics
 * - get_behavioral_history
 * - record_interaction (internal)
 * - get_coherence_recommendations
 */

const BehavioralCoherenceScorer = require('../../src/behavior/coherence-scorer');
const PatternAnalyzer = require('../../src/behavior/pattern-analyzer');

/**
 * Module instances
 */
const scorerInstances = new Map(); // sessionId -> scorer
const analyzerInstances = new Map(); // sessionId -> analyzer
const scoringIntervals = new Map(); // sessionId -> intervalId
const wsConnections = new Map(); // sessionId -> ws connection

/**
 * Register behavioral scoring commands
 *
 * @param {Object} commandHandlers - Map to register commands with
 * @param {Function} executeInRenderer - Function to execute code in renderer
 * @param {Object} wsServer - WebSocket server for pushing updates
 */
function registerBehavioralScoringCommands(commandHandlers, executeInRenderer, wsServer) {
  /**
   * Enable real-time behavioral scoring for a session
   *
   * Command: enable_behavioral_scoring
   * Params:
   *   - sessionId: string (required)
   *   - updateInterval: number (optional, default 500ms)
   *   - includeBreakdown: boolean (optional, default true)
   *   - anomalyThreshold: number (optional, default 0.7)
   */
  commandHandlers.enable_behavioral_scoring = async (params) => {
    try {
      const { sessionId, updateInterval = 500, includeBreakdown = true, anomalyThreshold = 0.7 } =
        params;

      if (!sessionId) {
        return { success: false, error: 'sessionId required' };
      }

      // Initialize analyzer and scorer if not exists
      if (!analyzerInstances.has(sessionId)) {
        analyzerInstances.set(sessionId, new PatternAnalyzer());
      }

      if (!scorerInstances.has(sessionId)) {
        scorerInstances.set(
          sessionId,
          new BehavioralCoherenceScorer({
            analyzer: analyzerInstances.get(sessionId)
          })
        );
      }

      // Stop existing interval if running
      if (scoringIntervals.has(sessionId)) {
        clearInterval(scoringIntervals.get(sessionId));
      }

      // Start scoring interval
      const intervalId = setInterval(() => {
        const analyzer = analyzerInstances.get(sessionId);
        const scorer = scorerInstances.get(sessionId);

        if (analyzer && scorer) {
          try {
            const metrics = analyzer.getMetricsSummary();
            metrics.entropy = analyzer.calculateBehaviorEntropy();
            const score = scorer.analyzeCoherence(metrics);

            // Push update to client if connected
            if (wsServer && wsServer.broadcast) {
              wsServer.broadcast({
                event: 'behavioral_score_update',
                data: {
                  sessionId,
                  overallScore: score.overallScore,
                  timestamp: score.timestamp,
                  dimensionScores: includeBreakdown ? score.dimensions : null,
                  status: score.status,
                  trend: score.trend
                }
              });
            }

            // Check for anomalies and send alerts
            if (score.anomalies && score.anomalies.length > 0) {
              for (const anom of score.anomalies) {
                wsServer?.broadcast({
                  event: 'behavioral_anomaly_detected',
                  data: {
                    sessionId,
                    dimension: anom.dimension,
                    severity: anom.anomaly.includes('high') ? 'WARNING' : 'INFO',
                    anomaly: anom.anomaly,
                    timestamp: Date.now()
                  }
                });
              }
            }
          } catch (err) {
            console.error('Error calculating behavioral score:', err);
          }
        }
      }, updateInterval);

      scoringIntervals.set(sessionId, intervalId);

      return {
        success: true,
        data: {
          scoringEnabled: true,
          updateInterval,
          sessionId,
          message: 'Behavioral scoring enabled'
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Disable behavioral scoring for a session
   *
   * Command: disable_behavioral_scoring
   * Params:
   *   - sessionId: string (required)
   */
  commandHandlers.disable_behavioral_scoring = async (params) => {
    try {
      const { sessionId } = params;

      if (!sessionId) {
        return { success: false, error: 'sessionId required' };
      }

      // Stop scoring interval
      if (scoringIntervals.has(sessionId)) {
        clearInterval(scoringIntervals.get(sessionId));
        scoringIntervals.delete(sessionId);
      }

      return {
        success: true,
        data: {
          scoringEnabled: false,
          sessionId,
          message: 'Behavioral scoring disabled'
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get current behavioral score
   *
   * Command: get_behavioral_score
   * Params:
   *   - sessionId: string (required)
   */
  commandHandlers.get_behavioral_score = async (params) => {
    try {
      const { sessionId } = params;

      if (!sessionId) {
        return { success: false, error: 'sessionId required' };
      }

      const analyzer = analyzerInstances.get(sessionId);
      const scorer = scorerInstances.get(sessionId);

      if (!analyzer || !scorer) {
        return {
          success: true,
          data: {
            sessionId,
            overallScore: 50,
            message: 'Scoring not enabled - return neutral'
          }
        };
      }

      const metrics = analyzer.getMetricsSummary();
      metrics.entropy = analyzer.calculateBehaviorEntropy();
      const score = scorer.analyzeCoherence(metrics);

      return {
        success: true,
        data: score
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get detailed behavioral metrics
   *
   * Command: get_behavioral_metrics
   * Params:
   *   - sessionId: string (required)
   *   - dimension: string (optional, null for all)
   */
  commandHandlers.get_behavioral_metrics = async (params) => {
    try {
      const { sessionId, dimension = null } = params;

      if (!sessionId) {
        return { success: false, error: 'sessionId required' };
      }

      const analyzer = analyzerInstances.get(sessionId);

      if (!analyzer) {
        return { success: false, error: 'Analyzer not initialized for session' };
      }

      const metrics = analyzer.getMetricsSummary();

      if (dimension) {
        return {
          success: true,
          data: {
            sessionId,
            dimension,
            metrics: metrics[dimension] || null
          }
        };
      }

      return {
        success: true,
        data: {
          sessionId,
          metrics
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get behavioral score history
   *
   * Command: get_behavioral_history
   * Params:
   *   - sessionId: string (required)
   *   - timeWindow: number (optional, milliseconds, null for all)
   *   - dimension: string (optional, null for all)
   */
  commandHandlers.get_behavioral_history = async (params) => {
    try {
      const { sessionId, timeWindow = null, dimension = null } = params;

      if (!sessionId) {
        return { success: false, error: 'sessionId required' };
      }

      const scorer = scorerInstances.get(sessionId);

      if (!scorer) {
        return { success: false, error: 'Scorer not initialized for session' };
      }

      let history = scorer.getScoreHistory(timeWindow);

      // Filter to specific dimension if requested
      if (dimension) {
        history = history.map((entry) => ({
          timestamp: entry.timestamp,
          overallScore: entry.overallScore,
          dimension: entry.dimensions[dimension] || null
        }));
      }

      // Calculate trend
      let trend = 'STABLE';
      if (history.length >= 2) {
        const recent = history.slice(-5);
        const older = history.slice(-10, -5);

        if (older.length > 0) {
          const recentAvg =
            recent.reduce((sum, h) => sum + h.overallScore, 0) / recent.length;
          const olderAvg = older.reduce((sum, h) => sum + h.overallScore, 0) / older.length;

          if (recentAvg > olderAvg + 5) {
            trend = 'IMPROVING';
          } else if (recentAvg < olderAvg - 5) {
            trend = 'DEGRADING';
          }
        }
      }

      // Calculate volatility
      let volatility = 0;
      if (history.length > 1) {
        const scores = history.map((h) => h.overallScore);
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) /
          scores.length;
        volatility = Math.sqrt(variance);
      }

      return {
        success: true,
        data: {
          sessionId,
          history,
          trend,
          volatility: Math.round(volatility * 10) / 10,
          recordCount: history.length
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Record an interaction (called internally during user actions)
   *
   * Command: record_interaction (internal)
   * Params:
   *   - sessionId: string (required)
   *   - type: string (required: 'mouse', 'typing', 'click', 'scroll', 'dwell', 'navigation', 'form')
   *   - data: object (required, structure varies by type)
   */
  commandHandlers.record_interaction = async (params) => {
    try {
      const { sessionId, type, data } = params;

      if (!sessionId || !type || !data) {
        return { success: false, error: 'sessionId, type, and data required' };
      }

      const analyzer = analyzerInstances.get(sessionId);

      if (!analyzer) {
        // Silently fail if analyzer not enabled
        return { success: true };
      }

      // Record interaction based on type
      switch (type) {
      case 'mouse':
        analyzer.recordMouseMovement(data);
        break;
      case 'typing':
        analyzer.recordTypingEvent(data);
        break;
      case 'click':
        analyzer.recordClick(data);
        break;
      case 'scroll':
        analyzer.recordScroll(data);
        break;
      case 'dwell':
        analyzer.recordDwell(data);
        break;
      case 'navigation':
        analyzer.recordNavigation(data);
        break;
      case 'form':
        analyzer.recordFormInteraction(data);
        break;
      default:
        return { success: false, error: 'Unknown interaction type' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error recording interaction:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Get recommendations for improving coherence score
   *
   * Command: get_coherence_recommendations
   * Params:
   *   - sessionId: string (required)
   */
  commandHandlers.get_coherence_recommendations = async (params) => {
    try {
      const { sessionId } = params;

      if (!sessionId) {
        return { success: false, error: 'sessionId required' };
      }

      const analyzer = analyzerInstances.get(sessionId);
      const scorer = scorerInstances.get(sessionId);

      if (!analyzer || !scorer) {
        return { success: false, error: 'Analyzer or scorer not initialized' };
      }

      const metrics = analyzer.getMetricsSummary();
      metrics.entropy = analyzer.calculateBehaviorEntropy();
      const score = scorer.analyzeCoherence(metrics);

      return {
        success: true,
        data: {
          sessionId,
          overallScore: score.overallScore,
          recommendations: score.recommendations,
          anomalies: score.anomalies,
          botDetectionRisk: score.botDetectionRisk,
          estimatedDetectionProbability: Math.round(score.botDetectionRisk * 100)
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Compare behavioral patterns to reference baseline
   *
   * Command: compare_to_reference
   * Params:
   *   - sessionId: string (required)
   */
  commandHandlers.compare_to_reference = async (params) => {
    try {
      const { sessionId } = params;

      if (!sessionId) {
        return { success: false, error: 'sessionId required' };
      }

      const analyzer = analyzerInstances.get(sessionId);

      if (!analyzer) {
        return { success: false, error: 'Analyzer not initialized' };
      }

      const metrics = analyzer.getMetricsSummary();
      const comparison = analyzer.compareToBaseline(metrics);

      return {
        success: true,
        data: {
          sessionId,
          isConsistent: comparison.isConsistent,
          deviations: comparison.deviations,
          consistencyScore: comparison.isConsistent ? 95 : 50
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Detect anomalies in current behavior
   *
   * Command: detect_behavior_anomalies
   * Params:
   *   - sessionId: string (required)
   */
  commandHandlers.detect_behavior_anomalies = async (params) => {
    try {
      const { sessionId } = params;

      if (!sessionId) {
        return { success: false, error: 'sessionId required' };
      }

      const analyzer = analyzerInstances.get(sessionId);

      if (!analyzer) {
        return { success: false, error: 'Analyzer not initialized' };
      }

      const anomalies = analyzer.detectAnomalies();

      return {
        success: true,
        data: {
          sessionId,
          anomalyCount: anomalies.length,
          anomalies
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Reset behavioral tracking for a session
   *
   * Command: reset_behavioral_tracking
   * Params:
   *   - sessionId: string (required)
   */
  commandHandlers.reset_behavioral_tracking = async (params) => {
    try {
      const { sessionId } = params;

      if (!sessionId) {
        return { success: false, error: 'sessionId required' };
      }

      // Remove instances
      analyzerInstances.delete(sessionId);
      scorerInstances.delete(sessionId);

      // Stop interval
      if (scoringIntervals.has(sessionId)) {
        clearInterval(scoringIntervals.get(sessionId));
        scoringIntervals.delete(sessionId);
      }

      return {
        success: true,
        data: {
          sessionId,
          message: 'Behavioral tracking reset'
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

module.exports = {
  registerBehavioralScoringCommands
};
