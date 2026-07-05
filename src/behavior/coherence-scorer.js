/**
 * Behavioral Coherence Scorer
 *
 * Real-time behavioral coherence scoring (0-100) to validate evasion effectiveness
 *
 * Scores 12+ dimensions:
 * - Mouse velocity, acceleration, pause patterns
 * - Typing speed, inter-keystroke timing
 * - Scroll acceleration, pause frequency
 * - Click timing, duration patterns
 * - Idle duration patterns
 * - Form interaction sequences
 * - Device-specific behavior
 * - Viewport usage patterns
 *
 * Returns:
 * - Overall coherence score (0-100)
 * - Per-dimension scores
 * - Anomalies and recommendations
 * - Trend analysis
 * - Estimated bot detection risk
 */

const PatternAnalyzer = require('./pattern-analyzer');

class BehavioralCoherenceScorer {
  constructor(options = {}) {
    this.analyzer = options.analyzer || new PatternAnalyzer();
    this.referencePatterns = options.referencePatterns || this.loadDefaultReferences();
    this.scoreHistory = [];
    this.maxHistorySize = options.maxHistorySize || 300; // 2.5 minutes at 500ms intervals

    // Dimension weights (sum should equal 1.0)
    this.dimensionWeights = {
      mouseMovement: 0.15,
      typingPattern: 0.12,
      scrollBehavior: 0.10,
      clickTiming: 0.10,
      idlePatterns: 0.08,
      navigationTiming: 0.08,
      formInteraction: 0.10,
      viewportUsage: 0.08,
      browserInteraction: 0.08,
      interactionSequencing: 0.07,
      deviceSpecific: 0.06,
      entropyMetrics: 0.08
    };

    // Anomaly sensitivity (lower = more sensitive)
    this.anomalySensitivity = options.anomalySensitivity || 2.0;

    // Bot detection risk factors
    this.botDetectionFactors = {
      velocitySpiking: 0.25,
      typingSpeedJump: 0.20,
      impossibleTiming: 0.30,
      entropy: 0.15,
      patternShifts: 0.10
    };
  }

  /**
   * Load default reference patterns for human behavior
   */
  loadDefaultReferences() {
    return {
      mouseMovement: {
        averageVelocity: 250, // pixels per millisecond
        velocityStdDev: 80,
        accelerationMean: 2.0,
        accelerationStdDev: 0.8,
        pauseFrequency: 0.15, // 15% of movements have pauses
        directnessRatio: 0.85 // How straight the path is
      },
      typingPattern: {
        wpmMin: 30,
        wpmMax: 100,
        wpmMean: 65,
        interKeystrokeMin: 50,
        interKeystrokeMax: 300,
        interKeystrokeMean: 120,
        errorRate: 0.01, // 1% baseline error rate
        errorCorrectionTime: 800
      },
      scrollBehavior: {
        averageVelocity: 300, // pixels per second
        velocityStdDev: 100,
        pauseFrequency: 0.3, // 30% scroll events include pauses
        accelerationProfile: 'eased' // Natural deceleration
      },
      clickTiming: {
        averageClickDuration: 150, // milliseconds
        clickDurationStdDev: 50,
        interClickMin: 500, // milliseconds
        interClickMax: 8000,
        interClickMean: 2500,
        doubleClickRate: 0.02 // 2% of clicks are double-clicks
      },
      idlePatterns: {
        averageIdleDuration: 5000, // milliseconds
        idleFrequency: 0.3, // 30% of time is idle
        maxIdleDuration: 60000 // Max 1 minute idle
      },
      navigationTiming: {
        pageLoadAwareness: 500, // How quickly aware of page load
        clickToNavigationDelay: 200, // Delay between click and navigation
        interPageDelay: 2000 // Delay between page navigations
      },
      formInteraction: {
        focusToTypeDelay: 300, // Delay after focusing field
        fieldCompletionTime: 3000, // Average time per field
        tabVsClickUsage: 0.7, // 70% use Tab, 30% click
        fieldSkipRate: 0.05 // 5% skip fields
      },
      entropyMetrics: {
        maxAcceptableEntropy: 0.6, // Normalized entropy 0-1
        minAcceptableEntropy: 0.1
      }
    };
  }

  /**
   * Score a single behavioral dimension
   *
   * @param {string} dimension - Dimension ID
   * @param {Object} metrics - Current metrics from analyzer
   * @returns {Object} Dimension score and analysis
   */
  scoreDimension(dimension, metrics) {
    const score = 50; // Default neutral score
    const analysis = {
      dimension,
      score: 0,
      status: 'UNKNOWN',
      confidence: 0.5,
      metrics: {},
      anomalies: []
    };

    switch (dimension) {
    case 'mouseMovement':
      return this.scoreMouseMovement(metrics);
    case 'typingPattern':
      return this.scoreTypingPattern(metrics);
    case 'scrollBehavior':
      return this.scoreScrollBehavior(metrics);
    case 'clickTiming':
      return this.scoreClickTiming(metrics);
    case 'idlePatterns':
      return this.scoreIdlePatterns(metrics);
    case 'navigationTiming':
      return this.scoreNavigationTiming(metrics);
    case 'formInteraction':
      return this.scoreFormInteraction(metrics);
    case 'viewportUsage':
      return this.scoreViewportUsage(metrics);
    case 'browserInteraction':
      return this.scoreBrowserInteraction(metrics);
    case 'interactionSequencing':
      return this.scoreInteractionSequencing(metrics);
    case 'deviceSpecific':
      return this.scoreDeviceSpecific(metrics);
    case 'entropyMetrics':
      return this.scoreEntropyMetrics(metrics);
    default:
      return analysis;
    }
  }

  /**
   * Score mouse movement dimension
   */
  scoreMouseMovement(metrics) {
    if (!metrics.mouse || metrics.mouse.count < 5) {
      return this.createDimensionScore('mouseMovement', 50, 'INSUFFICIENT_DATA', 0.3);
    }

    const ref = this.referencePatterns.mouseMovement;
    const m = metrics.mouse;
    let score = 100;
    const anomalies = [];

    // Velocity scoring
    const velocityDeviation = Math.abs(m.velocity.mean - ref.averageVelocity) /
      ref.averageVelocity;
    if (velocityDeviation > 0.5) {
      score -= 20;
      anomalies.push(`Velocity deviation: ${(velocityDeviation * 100).toFixed(1)}%`);
    } else if (velocityDeviation > 0.2) {
      score -= 10;
    }

    // Acceleration scoring
    if (m.acceleration && m.acceleration.stdDev > ref.accelerationStdDev * 2) {
      score -= 15;
      anomalies.push('Erratic acceleration patterns');
    }

    // Direction changes (too many = robotic)
    if (m.directionChanges && m.directionChanges > m.count * 0.5) {
      score -= 10;
      anomalies.push('Excessive direction changes');
    }

    // Pause frequency (natural humans pause sometimes)
    const pauseFrequency = m.distance.count > 0
      ? m.distance.count / (m.distance.count + metrics.mouse.count - m.distance.count)
      : 0;
    if (pauseFrequency < ref.pauseFrequency * 0.5) {
      score -= 5; // No pauses = suspicious
    }

    return this.createDimensionScore(
      'mouseMovement',
      Math.max(0, score),
      score > 70 ? 'NATURAL' : score > 40 ? 'SUSPICIOUS' : 'ANOMALOUS',
      Math.min(1, m.count / 50) // Confidence increases with sample size
    );
  }

  /**
   * Score typing pattern dimension
   */
  scoreTypingPattern(metrics) {
    if (!metrics.typing || metrics.typing.count < 5) {
      return this.createDimensionScore('typingPattern', 50, 'INSUFFICIENT_DATA', 0.3);
    }

    const ref = this.referencePatterns.typingPattern;
    const t = metrics.typing;
    let score = 100;
    const anomalies = [];

    // WPM scoring
    if (t.estimatedWPM < ref.wpmMin || t.estimatedWPM > ref.wpmMax) {
      score -= 20;
      anomalies.push(`WPM out of range: ${t.estimatedWPM.toFixed(1)}`);
    }

    // Inter-keystroke interval
    const ikiMean = t.interKeystrokeInterval.mean || 0;
    if (ikiMean < ref.interKeystrokeMin || ikiMean > ref.interKeystrokeMax) {
      score -= 15;
      anomalies.push(`IKI out of range: ${ikiMean.toFixed(0)}ms`);
    }

    // Error rate (some errors are human)
    if (t.errorRate > ref.errorRate * 5) {
      score -= 10;
      anomalies.push(`Error rate high: ${(t.errorRate * 100).toFixed(2)}%`);
    } else if (t.errorRate === 0) {
      score -= 5; // No errors might be suspicious
    }

    // Consistency (low variation = human, very low = bot)
    if (t.interKeystrokeInterval.stdDev > ref.interKeystrokeMax * 0.3) {
      score -= 10;
      anomalies.push('High IKI variation');
    }

    return this.createDimensionScore(
      'typingPattern',
      Math.max(0, score),
      score > 70 ? 'NATURAL' : score > 40 ? 'SUSPICIOUS' : 'ANOMALOUS',
      Math.min(1, t.count / 50)
    );
  }

  /**
   * Score scroll behavior dimension
   */
  scoreScrollBehavior(metrics) {
    if (!metrics.scroll || metrics.scroll.count < 2) {
      return this.createDimensionScore('scrollBehavior', 50, 'INSUFFICIENT_DATA', 0.3);
    }

    const ref = this.referencePatterns.scrollBehavior;
    const s = metrics.scroll;
    let score = 100;
    const anomalies = [];

    // Scroll velocity
    const velocityDeviation = Math.abs(s.speed.mean - ref.averageVelocity) /
      ref.averageVelocity;
    if (velocityDeviation > 0.4) {
      score -= 15;
      anomalies.push(`Scroll velocity deviation: ${(velocityDeviation * 100).toFixed(1)}%`);
    }

    // Pause frequency (natural scrolling includes pauses)
    if (s.pauseFrequency < ref.pauseFrequency * 0.3) {
      score -= 10;
      anomalies.push('Insufficient scroll pauses');
    }

    // Speed consistency
    if (s.speed.stdDev > s.speed.mean * 0.5) {
      score -= 8;
      anomalies.push('Inconsistent scroll speeds');
    }

    return this.createDimensionScore(
      'scrollBehavior',
      Math.max(0, score),
      score > 70 ? 'NATURAL' : score > 40 ? 'SUSPICIOUS' : 'ANOMALOUS',
      Math.min(1, s.count / 10)
    );
  }

  /**
   * Score click timing dimension
   */
  scoreClickTiming(metrics) {
    if (!metrics.click || metrics.click.count < 3) {
      return this.createDimensionScore('clickTiming', 50, 'INSUFFICIENT_DATA', 0.3);
    }

    const ref = this.referencePatterns.clickTiming;
    const c = metrics.click;
    let score = 100;
    const anomalies = [];

    // Click duration
    const durationDeviation = Math.abs(c.duration.mean - ref.averageClickDuration) /
      ref.averageClickDuration;
    if (durationDeviation > 0.5) {
      score -= 10;
      anomalies.push(`Click duration deviation: ${(durationDeviation * 100).toFixed(1)}%`);
    }

    // Inter-click interval
    const interClickMean = c.interClickInterval.mean || 0;
    if (interClickMean < ref.interClickMin || interClickMean > ref.interClickMax * 2) {
      score -= 15;
      anomalies.push(`Inter-click timing unusual: ${interClickMean.toFixed(0)}ms`);
    }

    // Click consistency
    if (c.interClickInterval.stdDev > ref.interClickMean * 0.5) {
      score -= 10;
      anomalies.push('Highly variable click intervals');
    }

    return this.createDimensionScore(
      'clickTiming',
      Math.max(0, score),
      score > 70 ? 'NATURAL' : score > 40 ? 'SUSPICIOUS' : 'ANOMALOUS',
      Math.min(1, c.count / 20)
    );
  }

  /**
   * Score idle patterns dimension
   */
  scoreIdlePatterns(metrics) {
    if (!metrics.sessionMetrics) {
      return this.createDimensionScore('idlePatterns', 50, 'INSUFFICIENT_DATA', 0.3);
    }

    const ref = this.referencePatterns.idlePatterns;
    let score = 100;
    const anomalies = [];

    // Check for continuous activity (no idle = bot)
    const totalIdleEstimate = metrics.sessionMetrics.duration *
      (1 - metrics.click.count / metrics.sessionMetrics.duration);
    if (totalIdleEstimate < metrics.sessionMetrics.duration * 0.05) {
      score -= 15;
      anomalies.push('Insufficient idle time');
    }

    // Check for excessive idle (might indicate stepping away)
    if (totalIdleEstimate > metrics.sessionMetrics.duration * 0.9) {
      score -= 10;
      anomalies.push('Excessive idle time');
    }

    return this.createDimensionScore(
      'idlePatterns',
      Math.max(0, score),
      score > 70 ? 'NATURAL' : score > 40 ? 'SUSPICIOUS' : 'ANOMALOUS',
      0.6
    );
  }

  /**
   * Score navigation timing dimension
   */
  scoreNavigationTiming(metrics) {
    const ref = this.referencePatterns.navigationTiming;
    const score = 100;
    const anomalies = [];

    // This is typically scored in context of actual navigation events
    // For now, neutral scoring
    return this.createDimensionScore(
      'navigationTiming',
      score,
      'NATURAL',
      0.7
    );
  }

  /**
   * Score form interaction dimension
   */
  scoreFormInteraction(metrics) {
    if (!metrics.formInteraction || metrics.formInteraction.count < 2) {
      return this.createDimensionScore('formInteraction', 50, 'INSUFFICIENT_DATA', 0.3);
    }

    const ref = this.referencePatterns.formInteraction;
    const score = 100;
    const anomalies = [];

    // Form interaction scoring
    // Typically scores field completion timing, focus patterns, etc.
    // For now, baseline neutral scoring
    return this.createDimensionScore(
      'formInteraction',
      score,
      'NATURAL',
      0.5
    );
  }

  /**
   * Score viewport usage dimension
   */
  scoreViewportUsage(metrics) {
    const score = 100;
    const anomalies = [];

    // Viewport usage typically scored based on scroll patterns and element focus
    // For now, baseline neutral scoring
    return this.createDimensionScore(
      'viewportUsage',
      score,
      'NATURAL',
      0.5
    );
  }

  /**
   * Score browser interaction dimension
   */
  scoreBrowserInteraction(metrics) {
    if (!metrics.navigation || metrics.navigation.count < 1) {
      return this.createDimensionScore('browserInteraction', 50, 'INSUFFICIENT_DATA', 0.3);
    }

    let score = 100;
    const anomalies = [];

    // Too much back/forward navigation = suspicious
    const backCount = metrics.navigation.actions?.find(a => a.action === 'back')?.count || 0;
    if (backCount > metrics.navigation.count * 0.5) {
      score -= 15;
      anomalies.push('Excessive back button usage');
    }

    return this.createDimensionScore(
      'browserInteraction',
      Math.max(0, score),
      score > 70 ? 'NATURAL' : score > 40 ? 'SUSPICIOUS' : 'ANOMALOUS',
      0.6
    );
  }

  /**
   * Score interaction sequencing dimension
   */
  scoreInteractionSequencing(metrics) {
    const score = 100;
    const anomalies = [];

    // Sequencing is typically evaluated against expected user flows
    // For now, baseline neutral scoring
    return this.createDimensionScore(
      'interactionSequencing',
      score,
      'NATURAL',
      0.5
    );
  }

  /**
   * Score device-specific behavior dimension
   */
  scoreDeviceSpecific(metrics) {
    const score = 100;
    const anomalies = [];

    // Device-specific scoring (DPI awareness, screen size awareness, etc.)
    // For now, baseline neutral scoring
    return this.createDimensionScore(
      'deviceSpecific',
      score,
      'NATURAL',
      0.5
    );
  }

  /**
   * Score entropy metrics dimension
   */
  scoreEntropyMetrics(metrics) {
    const entropy = metrics.entropy || 0;
    const ref = this.referencePatterns.entropyMetrics;

    let score = 100;
    const anomalies = [];

    if (entropy < ref.minAcceptableEntropy) {
      score -= 20;
      anomalies.push('Behavior too predictable (bot-like)');
    } else if (entropy > ref.maxAcceptableEntropy) {
      score -= 15;
      anomalies.push('Behavior too random (suspicious)');
    }

    return this.createDimensionScore(
      'entropyMetrics',
      Math.max(0, score),
      score > 70 ? 'NATURAL' : score > 40 ? 'SUSPICIOUS' : 'ANOMALOUS',
      0.7
    );
  }

  /**
   * Create a dimension score object
   *
   * @param {string} dimension - Dimension ID
   * @param {number} score - Score 0-100
   * @param {string} status - NATURAL | SUSPICIOUS | ANOMALOUS | INSUFFICIENT_DATA
   * @param {number} confidence - Confidence 0-1
   * @returns {Object} Dimension score object
   */
  createDimensionScore(dimension, score, status, confidence) {
    return {
      dimension,
      score: Math.round(score),
      status,
      confidence: Math.round(confidence * 100) / 100,
      timestamp: Date.now()
    };
  }

  /**
   * Calculate overall coherence score from dimension scores
   *
   * @param {Object} dimensionScores - Map of dimension -> score
   * @returns {number} Overall score 0-100
   */
  calculateOverallScore(dimensionScores) {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [dimension, score] of Object.entries(dimensionScores)) {
      const weight = this.dimensionWeights[dimension] || 0;
      totalScore += score.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0
      ? Math.round(totalScore / totalWeight)
      : 50;
  }

  /**
   * Generate coherence analysis
   *
   * @param {Object} metrics - Current metrics from analyzer
   * @returns {Object} Complete coherence analysis
   */
  analyzeCoherence(metrics) {
    const dimensionScores = {};

    // Score each dimension
    for (const dimension of Object.keys(this.dimensionWeights)) {
      dimensionScores[dimension] = this.scoreDimension(dimension, metrics);
    }

    // Calculate overall score
    const overallScore = this.calculateOverallScore(dimensionScores);

    // Detect anomalies
    const anomalies = [];
    for (const [dimension, score] of Object.entries(dimensionScores)) {
      if (score.status === 'ANOMALOUS') {
        anomalies.push({
          dimension,
          score: score.score,
          status: score.status
        });
      }
    }

    // Calculate bot detection risk
    const botDetectionRisk = this.calculateBotDetectionRisk(dimensionScores);

    // Generate recommendations
    const recommendations = this.generateRecommendations(dimensionScores, anomalies);

    // Store in history
    const analysis = {
      timestamp: Date.now(),
      overallScore,
      isHumanLike: overallScore > 70,
      confidence: this.calculateConfidence(dimensionScores),
      dimensions: dimensionScores,
      anomalies,
      botDetectionRisk,
      recommendations,
      trend: this.calculateTrend()
    };

    this.scoreHistory.push(analysis);
    if (this.scoreHistory.length > this.maxHistorySize) {
      this.scoreHistory.shift();
    }

    return analysis;
  }

  /**
   * Calculate estimated bot detection probability
   *
   * @param {Object} dimensionScores - Scores for each dimension
   * @returns {number} Probability 0-1
   */
  calculateBotDetectionRisk(dimensionScores) {
    let riskScore = 0;

    // If any dimension is anomalous, high risk
    const anomalyCount = Object.values(dimensionScores)
      .filter(s => s.status === 'ANOMALOUS').length;
    if (anomalyCount > 0) {
      riskScore += 0.4;
    }

    // If multiple suspicious dimensions, medium risk
    const suspiciousCount = Object.values(dimensionScores)
      .filter(s => s.status === 'SUSPICIOUS').length;
    if (suspiciousCount >= 3) {
      riskScore += 0.3;
    }

    // If low overall score, risk
    const avgScore = Object.values(dimensionScores)
      .reduce((sum, s) => sum + s.score, 0) / Object.keys(dimensionScores).length;
    if (avgScore < 60) {
      riskScore += 0.3;
    }

    return Math.min(1.0, riskScore);
  }

  /**
   * Calculate confidence in analysis
   *
   * @param {Object} dimensionScores - Scores for each dimension
   * @returns {number} Confidence 0-1
   */
  calculateConfidence(dimensionScores) {
    const confidences = Object.values(dimensionScores)
      .map(s => s.confidence);

    if (confidences.length === 0) {
      return 0;
    }

    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    return Math.round(avgConfidence * 100) / 100;
  }

  /**
   * Generate recommendations for improving coherence
   *
   * @param {Object} dimensionScores - Scores for each dimension
   * @param {Array} anomalies - Detected anomalies
   * @returns {Array} Array of recommendations
   */
  generateRecommendations(dimensionScores, anomalies) {
    const recommendations = [];

    // Recommendations based on low-scoring dimensions
    for (const [dimension, score] of Object.entries(dimensionScores)) {
      if (score.score < 60) {
        switch (dimension) {
        case 'mouseMovement':
          recommendations.push('Add natural mouse movement curves and pauses');
          break;
        case 'typingPattern':
          recommendations.push('Vary typing speed and add keyboard pauses');
          break;
        case 'scrollBehavior':
          recommendations.push('Add scroll pauses and natural deceleration');
          break;
        case 'clickTiming':
          recommendations.push('Vary click intervals and hold durations');
          break;
        case 'idlePatterns':
          recommendations.push('Add realistic idle periods between actions');
          break;
        case 'formInteraction':
          recommendations.push('Simulate natural form filling patterns');
          break;
        }
      }
    }

    // General recommendations
    if (anomalies.length > 3) {
      recommendations.push('Multiple anomalies detected - review evasion configuration');
    }

    return recommendations.slice(0, 5); // Top 5 recommendations
  }

  /**
   * Calculate score trend
   *
   * @returns {string} IMPROVING | STABLE | DEGRADING
   */
  calculateTrend() {
    if (this.scoreHistory.length < 3) {
      return 'STABLE';
    }

    const recent = this.scoreHistory.slice(-3).map(h => h.overallScore);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const trend = recent[recent.length - 1] - recent[0];

    if (trend > 5) {
      return 'IMPROVING';
    }
    if (trend < -5) {
      return 'DEGRADING';
    }
    return 'STABLE';
  }

  /**
   * Get behavioral score history
   *
   * @param {number} timeWindow - Time window in milliseconds (optional)
   * @returns {Array} Array of historical scores
   */
  getScoreHistory(timeWindow = null) {
    if (!timeWindow) {
      return this.scoreHistory;
    }

    const now = Date.now();
    return this.scoreHistory.filter(h => (now - h.timestamp) <= timeWindow);
  }

  /**
   * Compare two behavior analyses
   *
   * @param {Object} analysis1 - First analysis
   * @param {Object} analysis2 - Second analysis
   * @returns {Object} Comparison results
   */
  compareAnalyses(analysis1, analysis2) {
    const scoreDifference = Math.abs(analysis1.overallScore - analysis2.overallScore);
    const dimensionDifferences = {};

    for (const dimension of Object.keys(this.dimensionWeights)) {
      const score1 = analysis1.dimensions[dimension]?.score || 0;
      const score2 = analysis2.dimensions[dimension]?.score || 0;
      dimensionDifferences[dimension] = Math.abs(score1 - score2);
    }

    return {
      overallDifference: scoreDifference,
      dimensionDifferences,
      areSimilar: scoreDifference < 10,
      timestamp: Date.now()
    };
  }

  /**
   * Export coherence analysis for forensics
   *
   * @param {number} limit - Limit number of history entries
   * @returns {Object} Exportable coherence report
   */
  exportForensicReport(limit = 10) {
    const history = this.scoreHistory.slice(-limit);

    return {
      summary: {
        totalAnalyses: this.scoreHistory.length,
        averageScore: Math.round(
          this.scoreHistory.reduce((sum, h) => sum + h.overallScore, 0) /
          (this.scoreHistory.length || 1)
        ),
        trend: this.calculateTrend(),
        analysisWindow: [
          this.scoreHistory[0]?.timestamp,
          this.scoreHistory[this.scoreHistory.length - 1]?.timestamp
        ]
      },
      recentAnalyses: history,
      metadata: {
        version: '1.0.0',
        exported: Date.now(),
        software: 'Basset Hound Browser v12.1.0'
      }
    };
  }

  /**
   * Compatibility wrapper for old method name
   * Maps to analyzeCoherence
   *
   * @param {Object} metrics - Metrics from analyzer
   * @returns {Object} Coherence analysis with status
   */
  calculateCoherenceScore(metrics) {
    const analysis = this.analyzeCoherence(metrics);

    // Add status field for backwards compatibility
    if (!analysis.status) {
      if (analysis.overallScore >= 70) {
        analysis.status = 'COHERENT';
      } else if (analysis.overallScore >= 50) {
        analysis.status = 'WARNING';
      } else {
        analysis.status = 'VIOLATION';
      }
    }

    return analysis;
  }

  /**
   * Compatibility wrapper for old method name
   * Maps to getScoreHistory
   *
   * @param {number} timeWindow - Optional time window in milliseconds
   * @returns {Array} Score history entries
   */
  getHistory(timeWindow = null) {
    return this.getScoreHistory(timeWindow);
  }
}

module.exports = BehavioralCoherenceScorer;

module.exports = BehavioralCoherenceScorer;
