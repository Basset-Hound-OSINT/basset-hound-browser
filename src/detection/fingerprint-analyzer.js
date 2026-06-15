/**
 * Basset Hound Browser - Fingerprint Analyzer Module
 *
 * Analyzes multiple fingerprint vectors for bot detection.
 * Evaluates canvas, WebGL, audio, fonts, WebRTC, and other device fingerprints.
 *
 * Features:
 * - Multi-vector fingerprint analysis
 * - Individual vector scoring
 * - Composite risk assessment
 * - Detection confidence calculation
 * - Vector-specific threat analysis
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

/**
 * Fingerprint vector types
 */
const FINGERPRINT_VECTORS = {
  CANVAS: 'canvas',
  WEBGL: 'webgl',
  AUDIO: 'audio',
  FONTS: 'fonts',
  WEBRTC: 'webrtc',
  TIMEZONE: 'timezone',
  LANGUAGE: 'language',
  SCREEN: 'screen',
  NAVIGATOR: 'navigator',
  PLUGINS: 'plugins',
  STORAGE: 'storage',
  HEADERS: 'headers'
};

/**
 * Vector risk levels
 */
const RISK_LEVELS = {
  SAFE: 'safe',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Fingerprint Analyzer
 * Analyzes multiple fingerprint vectors for bot detection signatures
 */
class FingerprintAnalyzer {
  constructor(options = {}) {
    this.options = {
      enableVectorWeighting: options.enableVectorWeighting !== false,
      vectorWeights: options.vectorWeights || this._getDefaultWeights(),
      consistencyThreshold: options.consistencyThreshold || 0.85,
      anomalyThreshold: options.anomalyThreshold || 0.7,
      ...options
    };

    this.vectorConfigs = {
      [FINGERPRINT_VECTORS.CANVAS]: {
        weight: 0.15,
        consistency: 0.95,
        botSignatures: ['toDataURL modification', 'pixel pattern anomaly']
      },
      [FINGERPRINT_VECTORS.WEBGL]: {
        weight: 0.15,
        consistency: 0.95,
        botSignatures: ['renderer spoofing', 'extension anomaly']
      },
      [FINGERPRINT_VECTORS.AUDIO]: {
        weight: 0.10,
        consistency: 0.90,
        botSignatures: ['voice synthesizer detected', 'silence pattern']
      },
      [FINGERPRINT_VECTORS.FONTS]: {
        weight: 0.10,
        consistency: 0.85,
        botSignatures: ['font list incomplete', 'unusual font set']
      },
      [FINGERPRINT_VECTORS.WEBRTC]: {
        weight: 0.15,
        consistency: 0.90,
        botSignatures: ['proxy IP leakage', 'IP mismatch with session']
      },
      [FINGERPRINT_VECTORS.TIMEZONE]: {
        weight: 0.08,
        consistency: 0.98,
        botSignatures: ['timezone mismatch with IP geolocation']
      },
      [FINGERPRINT_VECTORS.LANGUAGE]: {
        weight: 0.08,
        consistency: 0.95,
        botSignatures: ['language mismatch with region']
      },
      [FINGERPRINT_VECTORS.SCREEN]: {
        weight: 0.08,
        consistency: 0.92,
        botSignatures: ['unusual resolution', 'no physical display']
      },
      [FINGERPRINT_VECTORS.NAVIGATOR]: {
        weight: 0.07,
        consistency: 0.90,
        botSignatures: ['headless browser indicators', 'automation flags']
      },
      [FINGERPRINT_VECTORS.PLUGINS]: {
        weight: 0.05,
        consistency: 0.95,
        botSignatures: ['plugin mismatch with OS', 'fake plugin list']
      },
      [FINGERPRINT_VECTORS.STORAGE]: {
        weight: 0.05,
        consistency: 0.85,
        botSignatures: ['storage disabled', 'quota anomaly']
      },
      [FINGERPRINT_VECTORS.HEADERS]: {
        weight: 0.05,
        consistency: 0.92,
        botSignatures: ['suspicious user-agent', 'header inconsistency']
      }
    };
  }

  /**
   * Get default vector weights
   * @private
   * @returns {Object}
   */
  _getDefaultWeights() {
    const weights = {};
    for (const vector of Object.values(FINGERPRINT_VECTORS)) {
      weights[vector] = 1.0 / Object.values(FINGERPRINT_VECTORS).length;
    }
    return weights;
  }

  /**
   * Analyze fingerprint data across multiple vectors
   * @param {Object} fingerprintData - Fingerprint data with vector results
   * @returns {Object} Analysis results with scores and risks
   */
  analyzeFingerprint(fingerprintData) {
    const vectorAnalyses = {};
    let totalWeightedScore = 0;
    let totalWeight = 0;

    // Analyze each vector
    for (const vector of Object.values(FINGERPRINT_VECTORS)) {
      const vectorData = fingerprintData[vector];
      if (!vectorData) {
        continue;
      }

      const analysis = this._analyzeVector(vector, vectorData);
      vectorAnalyses[vector] = analysis;

      const weight = this.options.vectorWeights[vector] || 0;
      totalWeightedScore += analysis.score * weight;
      totalWeight += weight;
    }

    // Calculate composite score
    const compositeScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

    // Determine risk level based on composite score
    const riskLevel = this._scoreToRiskLevel(compositeScore);

    return {
      timestamp: Date.now(),
      compositeScore,
      riskLevel,
      confidence: this._calculateConfidence(vectorAnalyses),
      vectorAnalyses,
      botProbability: this._estimateBotProbability(compositeScore, vectorAnalyses),
      detectedSignatures: this._extractSignatures(vectorAnalyses),
      recommendations: this._generateRecommendations(riskLevel, vectorAnalyses)
    };
  }

  /**
   * Analyze individual fingerprint vector
   * @private
   * @param {string} vector - Vector type
   * @param {Object} vectorData - Vector data
   * @returns {Object} Vector analysis
   */
  _analyzeVector(vector, vectorData) {
    const config = this.vectorConfigs[vector];
    if (!config) {
      return { score: 0.5, anomalies: [] };
    }

    let score = 0;
    const anomalies = [];

    // Score based on consistency
    if (vectorData.consistent !== undefined) {
      score = vectorData.consistent ? 0.1 : 0.7;
    }

    // Check for known bot signatures
    if (vectorData.signatures && Array.isArray(vectorData.signatures)) {
      for (const signature of vectorData.signatures) {
        if (config.botSignatures.some(sig => signature.toLowerCase().includes(sig.toLowerCase()))) {
          anomalies.push(signature);
          score = Math.min(1.0, score + 0.3);
        }
      }
    }

    // Analyze vector-specific fields
    score = this._analyzeVectorFields(vector, vectorData, score, anomalies);

    return {
      vector,
      score: Math.min(1.0, score),
      riskLevel: this._scoreToRiskLevel(score),
      anomalies,
      details: vectorData
    };
  }

  /**
   * Analyze vector-specific fields
   * @private
   * @param {string} vector - Vector type
   * @param {Object} vectorData - Vector data
   * @param {number} baseScore - Base risk score
   * @param {Array} anomalies - Anomaly list to update
   * @returns {number} Updated score
   */
  _analyzeVectorFields(vector, vectorData, baseScore, anomalies) {
    let score = baseScore;

    switch (vector) {
      case FINGERPRINT_VECTORS.CANVAS:
        if (vectorData.isModified) {
          anomalies.push('Canvas modification detected');
          score += 0.2;
        }
        break;

      case FINGERPRINT_VECTORS.WEBGL:
        if (vectorData.isSpoofe || vectorData.extensionsMissing) {
          anomalies.push('WebGL anomaly detected');
          score += 0.2;
        }
        break;

      case FINGERPRINT_VECTORS.WEBRTC:
        if (vectorData.ipMismatch) {
          anomalies.push('WebRTC IP mismatch with session IP');
          score += 0.25;
        }
        break;

      case FINGERPRINT_VECTORS.NAVIGATOR:
        if (vectorData.headless) {
          anomalies.push('Headless browser detected');
          score += 0.3;
        }
        if (vectorData.webdriver) {
          anomalies.push('WebDriver API detected');
          score += 0.3;
        }
        break;

      case FINGERPRINT_VECTORS.SCREEN:
        if (!vectorData.hasPhysicalDisplay) {
          anomalies.push('No physical display detected');
          score += 0.2;
        }
        break;

      case FINGERPRINT_VECTORS.TIMEZONE:
        if (vectorData.mismatchWithRegion) {
          anomalies.push('Timezone mismatch with geolocation');
          score += 0.15;
        }
        break;

      case FINGERPRINT_VECTORS.LANGUAGE:
        if (vectorData.mismatchWithRegion) {
          anomalies.push('Language mismatch with region');
          score += 0.1;
        }
        break;

      case FINGERPRINT_VECTORS.PLUGINS:
        if (vectorData.fake) {
          anomalies.push('Fake plugins detected');
          score += 0.2;
        }
        break;

      case FINGERPRINT_VECTORS.STORAGE:
        if (vectorData.disabled) {
          anomalies.push('Storage disabled');
          score += 0.15;
        }
        break;

      case FINGERPRINT_VECTORS.HEADERS:
        if (vectorData.suspiciousUserAgent) {
          anomalies.push('Suspicious user agent detected');
          score += 0.15;
        }
        break;

      default:
        break;
    }

    return Math.min(1.0, score);
  }

  /**
   * Convert score to risk level
   * @private
   * @param {number} score - Score value (0-1)
   * @returns {string} Risk level
   */
  _scoreToRiskLevel(score) {
    if (score < 0.2) return RISK_LEVELS.SAFE;
    if (score < 0.4) return RISK_LEVELS.LOW;
    if (score < 0.6) return RISK_LEVELS.MEDIUM;
    if (score < 0.8) return RISK_LEVELS.HIGH;
    return RISK_LEVELS.CRITICAL;
  }

  /**
   * Calculate overall confidence in the analysis
   * @private
   * @param {Object} vectorAnalyses - Vector analyses
   * @returns {number} Confidence value (0-1)
   */
  _calculateConfidence(vectorAnalyses) {
    const vectorCount = Object.keys(vectorAnalyses).length;
    if (vectorCount === 0) return 0;

    // Confidence is higher when more vectors are analyzed and consistent
    let consistencyScore = 0;
    for (const analysis of Object.values(vectorAnalyses)) {
      const vectorConsistency = Math.abs(analysis.score - 0.5) > 0.3 ? 0.9 : 0.5;
      consistencyScore += vectorConsistency;
    }

    return Math.min(1.0, (vectorCount / 12) * (consistencyScore / vectorCount));
  }

  /**
   * Estimate bot probability
   * @private
   * @param {number} compositeScore - Composite risk score
   * @param {Object} vectorAnalyses - Vector analyses
   * @returns {number} Bot probability (0-1)
   */
  _estimateBotProbability(compositeScore, vectorAnalyses) {
    // Count vectors with high risk
    const highRiskVectors = Object.values(vectorAnalyses).filter(
      v => v.riskLevel === RISK_LEVELS.HIGH || v.riskLevel === RISK_LEVELS.CRITICAL
    ).length;

    // Bot probability increases with composite score and number of high-risk vectors
    const vectorFactor = Math.min(1.0, highRiskVectors / 4);
    return (compositeScore * 0.7) + (vectorFactor * 0.3);
  }

  /**
   * Extract detected signatures
   * @private
   * @param {Object} vectorAnalyses - Vector analyses
   * @returns {Array}
   */
  _extractSignatures(vectorAnalyses) {
    const signatures = [];

    for (const [vector, analysis] of Object.entries(vectorAnalyses)) {
      if (analysis.anomalies && analysis.anomalies.length > 0) {
        signatures.push({
          vector,
          anomalies: analysis.anomalies,
          severity: analysis.riskLevel
        });
      }
    }

    return signatures;
  }

  /**
   * Generate recommendations based on analysis
   * @private
   * @param {string} riskLevel - Risk level
   * @param {Object} vectorAnalyses - Vector analyses
   * @returns {Array}
   */
  _generateRecommendations(riskLevel, vectorAnalyses) {
    const recommendations = [];

    if (riskLevel === RISK_LEVELS.CRITICAL) {
      recommendations.push('Block request - Critical bot signature detected');
      recommendations.push('Log incident for security review');
    } else if (riskLevel === RISK_LEVELS.HIGH) {
      recommendations.push('Challenge user - High bot risk detected');
      recommendations.push('Require CAPTCHA or 2FA');
    } else if (riskLevel === RISK_LEVELS.MEDIUM) {
      recommendations.push('Monitor session closely');
      recommendations.push('Apply rate limiting');
    }

    // Vector-specific recommendations
    for (const [vector, analysis] of Object.entries(vectorAnalyses)) {
      if (analysis.riskLevel === RISK_LEVELS.HIGH) {
        recommendations.push(`Investigate ${vector} anomalies: ${analysis.anomalies.join(', ')}`);
      }
    }

    return recommendations;
  }

  /**
   * Get vector information
   * @param {string} vector - Vector type
   * @returns {Object}
   */
  getVectorInfo(vector) {
    return { ...this.vectorConfigs[vector] };
  }

  /**
   * Get all vector types
   * @returns {Object}
   */
  static getVectorTypes() {
    return { ...FINGERPRINT_VECTORS };
  }

  /**
   * Get all risk levels
   * @returns {Object}
   */
  static getRiskLevels() {
    return { ...RISK_LEVELS };
  }

  /**
   * Compare two fingerprints for consistency
   * @param {Object} fingerprint1 - First fingerprint
   * @param {Object} fingerprint2 - Second fingerprint
   * @returns {Object} Comparison results
   */
  compareFingerprints(fingerprint1, fingerprint2) {
    const differences = [];
    const vectorCount = Object.values(FINGERPRINT_VECTORS).length;
    let matchingVectors = 0;

    for (const vector of Object.values(FINGERPRINT_VECTORS)) {
      if (!fingerprint1[vector] || !fingerprint2[vector]) {
        continue;
      }

      const data1 = fingerprint1[vector];
      const data2 = fingerprint2[vector];

      // Deep equality check
      const matches = JSON.stringify(data1) === JSON.stringify(data2);

      if (matches) {
        matchingVectors++;
      } else {
        differences.push({
          vector,
          difference: true,
          value1: data1,
          value2: data2
        });
      }
    }

    return {
      consistency: vectorCount > 0 ? matchingVectors / vectorCount : 0,
      matchingVectors,
      totalVectors: vectorCount,
      differences
    };
  }
}

module.exports = {
  FingerprintAnalyzer,
  FINGERPRINT_VECTORS,
  RISK_LEVELS
};
