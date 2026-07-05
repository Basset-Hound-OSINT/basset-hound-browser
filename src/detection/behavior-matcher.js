/**
 * Basset Hound Browser - Behavior Matcher Module
 *
 * Pattern matching for behavioral analysis.
 * Detects common bot patterns like too-fast clicks, perfect typing, etc.
 *
 * Features:
 * - Bot behavior pattern detection
 * - Timing anomaly detection
 * - Human-like behavior scoring
 * - Pattern library with common bot signatures
 * - Customizable threshold configuration
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

/**
 * Common bot behavior patterns
 */
const BOT_PATTERNS = {
  TOO_FAST_CLICKS: {
    name: 'Too Fast Clicks',
    description: 'Multiple clicks with unrealistic timing',
    minIntervalMs: 50,
    score: 0.3
  },
  PERFECT_TYPING: {
    name: 'Perfect Typing',
    description: 'Typing with zero typos and perfect consistency',
    typoRate: 0,
    scorePerChar: 0.01,
    maxScore: 0.25
  },
  INSTANT_FORM_FILL: {
    name: 'Instant Form Fill',
    description: 'Form filled faster than humanly possible',
    minDurationPerField: 200,
    score: 0.3
  },
  ZERO_MOUSE_MOVEMENT: {
    name: 'Zero Mouse Movement',
    description: 'Direct jumps to click targets without movement',
    score: 0.2
  },
  UNIFORM_SCROLL_SPEED: {
    name: 'Uniform Scroll Speed',
    description: 'Perfectly consistent scroll speed',
    varianceThreshold: 0.05,
    score: 0.15
  },
  NO_IDLE_TIME: {
    name: 'No Idle Time',
    description: 'Continuous activity without pauses',
    maxIdleConsecutive: 0,
    score: 0.25
  },
  PATTERN_REPETITION: {
    name: 'Pattern Repetition',
    description: 'Identical interaction sequences',
    score: 0.3
  },
  MISS_ELEMENTS: {
    name: 'Consistently Miss Elements',
    description: 'Click attempts on non-interactive elements',
    score: 0.2
  }
};

/**
 * Behavior Matcher
 * Analyzes interaction patterns to detect bot behavior
 */
class BehaviorMatcher {
  constructor(options = {}) {
    this.options = {
      enablePatternMatching: options.enablePatternMatching !== false,
      customPatterns: options.customPatterns || {},
      thresholds: options.thresholds || this._getDefaultThresholds(),
      minEventsForAnalysis: options.minEventsForAnalysis || 5,
      ...options
    };

    // Merge custom patterns with default patterns
    this.patterns = { ...BOT_PATTERNS, ...this.options.customPatterns };
  }

  /**
   * Get default thresholds
   * @private
   * @returns {Object}
   */
  _getDefaultThresholds() {
    return {
      clickIntervalMs: 100,
      typeIntervalMs: 50,
      scrollDurationMs: 500,
      fieldFillDurationMs: 300,
      mouseMovementPixels: 10
    };
  }

  /**
   * Analyze behavior events for bot patterns
   * @param {Array} events - Array of interaction events
   * @returns {Object} Behavior analysis results
   */
  analyzeBehavior(events) {
    if (!Array.isArray(events) || events.length < this.options.minEventsForAnalysis) {
      return {
        totalEvents: events ? events.length : 0,
        detectedPatterns: [],
        botScore: 0,
        botRisk: 'low',
        summary: 'Insufficient data for analysis'
      };
    }

    const detectedPatterns = [];
    let botScore = 0;

    // Run pattern checks
    const clickPatterns = this._analyzeClickPatterns(events);
    if (clickPatterns.length > 0) {
      detectedPatterns.push(...clickPatterns);
      botScore += clickPatterns.reduce((sum, p) => sum + p.score, 0);
    }

    const typePatterns = this._analyzeTypingPatterns(events);
    if (typePatterns.length > 0) {
      detectedPatterns.push(...typePatterns);
      botScore += typePatterns.reduce((sum, p) => sum + p.score, 0);
    }

    const formPatterns = this._analyzeFormFillPatterns(events);
    if (formPatterns.length > 0) {
      detectedPatterns.push(...formPatterns);
      botScore += formPatterns.reduce((sum, p) => sum + p.score, 0);
    }

    const movementPatterns = this._analyzeMovementPatterns(events);
    if (movementPatterns.length > 0) {
      detectedPatterns.push(...movementPatterns);
      botScore += movementPatterns.reduce((sum, p) => sum + p.score, 0);
    }

    const scrollPatterns = this._analyzeScrollPatterns(events);
    if (scrollPatterns.length > 0) {
      detectedPatterns.push(...scrollPatterns);
      botScore += scrollPatterns.reduce((sum, p) => sum + p.score, 0);
    }

    const idlePatterns = this._analyzeIdlePatterns(events);
    if (idlePatterns.length > 0) {
      detectedPatterns.push(...idlePatterns);
      botScore += idlePatterns.reduce((sum, p) => sum + p.score, 0);
    }

    // Normalize bot score to 0-1 range
    const normalizedBotScore = Math.min(1.0, botScore);
    const botRisk = this._scoreToBotRisk(normalizedBotScore);

    return {
      timestamp: Date.now(),
      totalEvents: events.length,
      detectedPatterns,
      botScore: normalizedBotScore,
      botRisk,
      patternCount: detectedPatterns.length,
      confidence: this._calculateConfidence(detectedPatterns, events),
      recommendations: this._generateRecommendations(normalizedBotScore, detectedPatterns),
      eventTimings: this._analyzeEventTimings(events)
    };
  }

  /**
   * Analyze click patterns
   * @private
   * @param {Array} events - Events
   * @returns {Array}
   */
  _analyzeClickPatterns(events) {
    const patterns = [];
    const clicks = events.filter(e => e.type === 'click' || e.type === 'mouseDown');

    if (clicks.length < 2) {
      return patterns;
    }

    // Check for too-fast clicks
    let tooFastCount = 0;
    for (let i = 1; i < clicks.length; i++) {
      const interval = clicks[i].timestamp - clicks[i - 1].timestamp;
      if (interval < this.options.thresholds.clickIntervalMs) {
        tooFastCount++;
      }
    }

    const fastClickRate = tooFastCount / (clicks.length - 1);
    if (fastClickRate > 0.3) {
      patterns.push({
        pattern: 'TOO_FAST_CLICKS',
        name: BOT_PATTERNS.TOO_FAST_CLICKS.name,
        score: Math.min(0.3, fastClickRate * 0.5),
        details: {
          tooFastClicks: tooFastCount,
          totalClicks: clicks.length,
          rate: fastClickRate
        }
      });
    }

    return patterns;
  }

  /**
   * Analyze typing patterns
   * @private
   * @param {Array} events - Events
   * @returns {Array}
   */
  _analyzeTypingPatterns(events) {
    const patterns = [];
    const typeEvents = events.filter(e => e.type === 'typing' || e.type === 'keyDown');

    if (typeEvents.length === 0) {
      return patterns;
    }

    // Check for perfect typing (no corrections)
    let deletions = 0;
    const insertions = 0;

    for (const event of typeEvents) {
      if (event.key === 'Backspace' || event.key === 'Delete') {
        deletions++;
      }
    }

    const correctionRate = deletions / typeEvents.length;

    // Perfect typing pattern (very few corrections)
    if (correctionRate < 0.02 && typeEvents.length > 20) {
      patterns.push({
        pattern: 'PERFECT_TYPING',
        name: BOT_PATTERNS.PERFECT_TYPING.name,
        score: 0.2,
        details: {
          correctionRate,
          totalKeystrokes: typeEvents.length,
          deletions
        }
      });
    }

    // Check for uniform keystroke intervals
    const intervals = [];
    for (let i = 1; i < typeEvents.length; i++) {
      intervals.push(typeEvents[i].timestamp - typeEvents[i - 1].timestamp);
    }

    if (intervals.length > 0) {
      const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
      const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      const coeffVariation = stdDev / avgInterval;

      if (coeffVariation < 0.1) {
        patterns.push({
          pattern: 'UNIFORM_TYPING',
          name: 'Uniform Typing Speed',
          score: 0.15,
          details: {
            avgInterval,
            stdDev,
            coeffVariation
          }
        });
      }
    }

    return patterns;
  }

  /**
   * Analyze form fill patterns
   * @private
   * @param {Array} events - Events
   * @returns {Array}
   */
  _analyzeFormFillPatterns(events) {
    const patterns = [];

    // Group events by target element
    const targetGroups = new Map();
    for (const event of events) {
      if (event.targetId) {
        if (!targetGroups.has(event.targetId)) {
          targetGroups.set(event.targetId, []);
        }
        targetGroups.get(event.targetId).push(event);
      }
    }

    // Check each field for instant fill
    let instantFills = 0;
    for (const fieldEvents of targetGroups.values()) {
      if (fieldEvents.length < 2) {
        continue;
      }

      const firstEvent = fieldEvents[0];
      const lastEvent = fieldEvents[fieldEvents.length - 1];
      const duration = lastEvent.timestamp - firstEvent.timestamp;

      if (duration < this.options.thresholds.fieldFillDurationMs) {
        instantFills++;
      }
    }

    if (instantFills > targetGroups.size * 0.3) {
      patterns.push({
        pattern: 'INSTANT_FORM_FILL',
        name: BOT_PATTERNS.INSTANT_FORM_FILL.name,
        score: 0.25,
        details: {
          instantFillCount: instantFills,
          totalFields: targetGroups.size,
          rate: instantFills / targetGroups.size
        }
      });
    }

    return patterns;
  }

  /**
   * Analyze movement patterns
   * @private
   * @param {Array} events - Events
   * @returns {Array}
   */
  _analyzeMovementPatterns(events) {
    const patterns = [];
    const clickEvents = events.filter(e => e.type === 'click' && e.x && e.y);

    if (clickEvents.length < 2) {
      return patterns;
    }

    // Check for direct jumps (no intermediate mouse movements)
    const directClicks = 0;
    const moveEvents = events.filter(e => e.type === 'mouseMove');

    if (moveEvents.length === 0 && clickEvents.length > 2) {
      patterns.push({
        pattern: 'ZERO_MOUSE_MOVEMENT',
        name: BOT_PATTERNS.ZERO_MOUSE_MOVEMENT.name,
        score: 0.2,
        details: {
          clicks: clickEvents.length,
          movements: moveEvents.length
        }
      });
    }

    return patterns;
  }

  /**
   * Analyze scroll patterns
   * @private
   * @param {Array} events - Events
   * @returns {Array}
   */
  _analyzeScrollPatterns(events) {
    const patterns = [];
    const scrollEvents = events.filter(e => e.type === 'scroll');

    if (scrollEvents.length < 3) {
      return patterns;
    }

    // Check for uniform scroll speed
    const scrollAmounts = scrollEvents.map(e => e.scrollAmount || 0);
    const scrollTimes = [];

    for (let i = 1; i < scrollEvents.length; i++) {
      scrollTimes.push(scrollEvents[i].timestamp - scrollEvents[i - 1].timestamp);
    }

    if (scrollTimes.length > 0) {
      const avgTime = scrollTimes.reduce((a, b) => a + b) / scrollTimes.length;
      const variance = scrollTimes.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / scrollTimes.length;
      const stdDev = Math.sqrt(variance);
      const coeffVariation = stdDev / avgTime;

      if (coeffVariation < 0.05) {
        patterns.push({
          pattern: 'UNIFORM_SCROLL_SPEED',
          name: BOT_PATTERNS.UNIFORM_SCROLL_SPEED.name,
          score: 0.15,
          details: {
            scrollCount: scrollEvents.length,
            avgTime,
            coeffVariation
          }
        });
      }
    }

    return patterns;
  }

  /**
   * Analyze idle patterns
   * @private
   * @param {Array} events - Events
   * @returns {Array}
   */
  _analyzeIdlePatterns(events) {
    const patterns = [];

    if (events.length < 2) {
      return patterns;
    }

    // Check for idle time between events
    const idleIntervals = [];
    for (let i = 1; i < events.length; i++) {
      const interval = events[i].timestamp - events[i - 1].timestamp;
      if (interval > 100) { // More than 100ms
        idleIntervals.push(interval);
      }
    }

    // If less than 10% of events have idle time, flag as no idle
    const idleRate = idleIntervals.length / events.length;
    if (idleRate < 0.1 && events.length > 10) {
      patterns.push({
        pattern: 'NO_IDLE_TIME',
        name: BOT_PATTERNS.NO_IDLE_TIME.name,
        score: 0.2,
        details: {
          totalEvents: events.length,
          idleIntervals: idleIntervals.length,
          idleRate
        }
      });
    }

    return patterns;
  }

  /**
   * Analyze event timing statistics
   * @private
   * @param {Array} events - Events
   * @returns {Object}
   */
  _analyzeEventTimings(events) {
    if (events.length < 2) {
      return { totalDuration: 0, eventCount: 0 };
    }

    const intervals = [];
    for (let i = 1; i < events.length; i++) {
      intervals.push(events[i].timestamp - events[i - 1].timestamp);
    }

    const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
    const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;

    return {
      totalDuration: events[events.length - 1].timestamp - events[0].timestamp,
      eventCount: events.length,
      averageInterval: avgInterval,
      variance,
      stdDev: Math.sqrt(variance),
      minInterval: Math.min(...intervals),
      maxInterval: Math.max(...intervals)
    };
  }

  /**
   * Convert score to bot risk level
   * @private
   * @param {number} score - Score (0-1)
   * @returns {string}
   */
  _scoreToBotRisk(score) {
    if (score < 0.2) {
      return 'low';
    }
    if (score < 0.4) {
      return 'medium-low';
    }
    if (score < 0.6) {
      return 'medium';
    }
    if (score < 0.8) {
      return 'high';
    }
    return 'critical';
  }

  /**
   * Calculate confidence in analysis
   * @private
   * @param {Array} patterns - Detected patterns
   * @param {Array} events - Events analyzed
   * @returns {number}
   */
  _calculateConfidence(patterns, events) {
    // Confidence increases with:
    // 1. Number of detected patterns (more consensus)
    // 2. Number of events analyzed
    const patternFactor = Math.min(1.0, patterns.length / 5);
    const eventFactor = Math.min(1.0, events.length / 100);

    return (patternFactor * 0.5) + (eventFactor * 0.5);
  }

  /**
   * Generate recommendations
   * @private
   * @param {number} score - Bot score
   * @param {Array} patterns - Detected patterns
   * @returns {Array}
   */
  _generateRecommendations(score, patterns) {
    const recommendations = [];

    if (score > 0.7) {
      recommendations.push('Block request - Strong bot behavior detected');
    } else if (score > 0.5) {
      recommendations.push('Challenge user with CAPTCHA');
    } else if (score > 0.3) {
      recommendations.push('Monitor session - Some bot-like patterns detected');
    }

    for (const pattern of patterns) {
      recommendations.push(`Detected: ${pattern.name}`);
    }

    return recommendations;
  }

  /**
   * Get all available patterns
   * @returns {Object}
   */
  getAvailablePatterns() {
    return { ...this.patterns };
  }

  /**
   * Get pattern info
   * @param {string} patternName - Pattern name
   * @returns {Object|null}
   */
  getPatternInfo(patternName) {
    return this.patterns[patternName] || null;
  }
}

module.exports = {
  BehaviorMatcher,
  BOT_PATTERNS
};
