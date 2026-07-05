/**
 * Behavioral Pattern Detection Engine - Identify recurring patterns in monitoring data
 * Detects daily cycles, weekly trends, monthly updates, and release schedules
 * @module src/advanced/pattern-detector
 */

const EventEmitter = require('events');

/**
 * Pattern Types
 */
const PATTERN_TYPES = {
  DAILY_CYCLE: 'daily-cycle',
  WEEKLY_TREND: 'weekly-trend',
  MONTHLY_UPDATE: 'monthly-update',
  RELEASE_SCHEDULE: 'release-schedule',
  HOURLY_PATTERN: 'hourly-pattern'
};

/**
 * Pattern Detection Confidence Levels
 */
const CONFIDENCE_LEVELS = {
  LOW: 0.3,
  MEDIUM: 0.6,
  HIGH: 0.85
};

/**
 * Pattern Detector Class
 */
class PatternDetector extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      minOccurrences: options.minOccurrences || 3,
      confidenceThreshold: options.confidenceThreshold || CONFIDENCE_LEVELS.MEDIUM,
      lookbackPeriod: options.lookbackPeriod || 90 * 24 * 60 * 60 * 1000, // 90 days
      windowSize: options.windowSize || 24 * 60 * 60 * 1000, // 1 day
      hourlyResolution: options.hourlyResolution || true,
      enableAlerts: options.enableAlerts !== false,
      ...options
    };

    // Pattern tracking
    this.detectedPatterns = new Map(); // monitorId -> [patterns]
    this.eventHistory = new Map(); // monitorId -> [events with timestamps]
    this.patternPredictions = new Map(); // monitorId -> { nextExpected, confidence }
  }

  /**
   * Record an event for pattern analysis
   * @param {string} monitorId - Monitor ID
   * @param {Object} event - Event data
   */
  recordEvent(monitorId, event) {
    if (!this.eventHistory.has(monitorId)) {
      this.eventHistory.set(monitorId, []);
    }

    const eventWithTimestamp = {
      ...event,
      timestamp: event.timestamp || Date.now(),
      datetime: new Date(event.timestamp || Date.now()).toISOString()
    };

    const history = this.eventHistory.get(monitorId);
    history.push(eventWithTimestamp);

    // Keep only lookback period
    const cutoff = Date.now() - this.options.lookbackPeriod;
    const filtered = history.filter(e => e.timestamp >= cutoff);
    this.eventHistory.set(monitorId, filtered);

    // Analyze patterns when sufficient data
    if (filtered.length >= this.options.minOccurrences) {
      this.analyzePatterns(monitorId);
    }
  }

  /**
   * Analyze patterns in event history
   * @private
   */
  analyzePatterns(monitorId) {
    const history = this.eventHistory.get(monitorId) || [];
    if (history.length < this.options.minOccurrences) {
      return;
    }

    const patterns = [];

    // Detect different pattern types
    patterns.push(...this.detectDailyPatterns(history));
    patterns.push(...this.detectWeeklyPatterns(history));
    patterns.push(...this.detectMonthlyPatterns(history));
    patterns.push(...this.detectReleaseSchedule(history));
    patterns.push(...this.detectHourlyPatterns(history));

    // Filter by confidence threshold
    const significantPatterns = patterns.filter(p => p.confidence >= this.options.confidenceThreshold);

    this.detectedPatterns.set(monitorId, significantPatterns);

    // Generate predictions
    if (significantPatterns.length > 0) {
      this.generatePatternPredictions(monitorId, significantPatterns);
    }

    // Emit events
    if (this.options.enableAlerts && significantPatterns.length > 0) {
      this.emit('patterns-detected', {
        monitorId,
        patterns: significantPatterns
      });
    }
  }

  /**
   * Detect daily patterns (same time each day)
   * @private
   */
  detectDailyPatterns(history) {
    const patterns = [];
    const hourBuckets = {};

    history.forEach(event => {
      const date = new Date(event.timestamp);
      const hour = date.getHours();
      const key = `hour_${hour}`;

      if (!hourBuckets[key]) {
        hourBuckets[key] = [];
      }
      hourBuckets[key].push(event);
    });

    // Find hours with frequent events
    const sortedHours = Object.entries(hourBuckets)
      .map(([hour, events]) => ({
        hour: parseInt(hour.split('_')[1]),
        count: events.length,
        events
      }))
      .sort((a, b) => b.count - a.count);

    const totalEvents = history.length;
    const daysInHistory = this.calculateDaySpan(history) || 1;

    sortedHours.forEach(({ hour, count, events }) => {
      const frequency = count / daysInHistory;
      if (frequency >= 0.8) { // 80% of days
        patterns.push({
          type: PATTERN_TYPES.DAILY_CYCLE,
          hour,
          frequency,
          confidence: Math.min(1, count / (daysInHistory * 2)),
          count,
          description: `Pattern: Changes occur around ${hour}:00 every day`,
          nextPredicted: this.predictNextDailyTime(hour),
          occurrences: events.length
        });
      }
    });

    return patterns;
  }

  /**
   * Detect weekly patterns (same day of week)
   * @private
   */
  detectWeeklyPatterns(history) {
    const patterns = [];
    const dayOfWeekBuckets = {};

    history.forEach(event => {
      const date = new Date(event.timestamp);
      const dayOfWeek = date.getDay();
      const key = `day_${dayOfWeek}`;

      if (!dayOfWeekBuckets[key]) {
        dayOfWeekBuckets[key] = [];
      }
      dayOfWeekBuckets[key].push(event);
    });

    const weeksInHistory = Math.max(1, Math.ceil(this.calculateDaySpan(history) / 7));

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    Object.entries(dayOfWeekBuckets).forEach(([dayKey, events]) => {
      const dayOfWeek = parseInt(dayKey.split('_')[1]);
      const frequency = events.length / weeksInHistory;

      if (frequency >= 1.0 && events.length >= this.options.minOccurrences) {
        patterns.push({
          type: PATTERN_TYPES.WEEKLY_TREND,
          dayOfWeek,
          dayName: dayNames[dayOfWeek],
          frequency,
          confidence: Math.min(1, events.length / (weeksInHistory * 2)),
          count: events.length,
          description: `Pattern: Changes typically occur on ${dayNames[dayOfWeek]}s`,
          nextPredicted: this.predictNextWeeklyDay(dayOfWeek),
          occurrences: events.length
        });
      }
    });

    return patterns;
  }

  /**
   * Detect monthly patterns (same day of month)
   * @private
   */
  detectMonthlyPatterns(history) {
    const patterns = [];
    const dayOfMonthBuckets = {};

    history.forEach(event => {
      const date = new Date(event.timestamp);
      const dayOfMonth = date.getDate();
      const key = `date_${dayOfMonth}`;

      if (!dayOfMonthBuckets[key]) {
        dayOfMonthBuckets[key] = [];
      }
      dayOfMonthBuckets[key].push(event);
    });

    const monthsInHistory = Math.max(1, Math.ceil(this.calculateDaySpan(history) / 30));

    Object.entries(dayOfMonthBuckets).forEach(([dateKey, events]) => {
      const dayOfMonth = parseInt(dateKey.split('_')[1]);
      const frequency = events.length / monthsInHistory;

      if (frequency >= 0.7 && events.length >= this.options.minOccurrences) {
        patterns.push({
          type: PATTERN_TYPES.MONTHLY_UPDATE,
          dayOfMonth,
          frequency,
          confidence: Math.min(1, events.length / (monthsInHistory * 2)),
          count: events.length,
          description: `Pattern: Updates occur around the ${dayOfMonth}th of each month`,
          nextPredicted: this.predictNextMonthlyDay(dayOfMonth),
          occurrences: events.length
        });
      }
    });

    return patterns;
  }

  /**
   * Detect release schedules (consistent intervals)
   * @private
   */
  detectReleaseSchedule(history) {
    const patterns = [];

    if (history.length < 3) {
      return patterns;
    }

    // Calculate intervals between events
    const intervals = [];
    for (let i = 1; i < history.length; i++) {
      const interval = history[i].timestamp - history[i - 1].timestamp;
      intervals.push(interval);
    }

    // Find common intervals (within 10% tolerance)
    const sortedIntervals = intervals.sort((a, b) => a - b);
    const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
    const tolerance = medianInterval * 0.1;

    const consistentIntervals = intervals.filter(interval =>
      Math.abs(interval - medianInterval) <= tolerance
    );

    if (consistentIntervals.length >= this.options.minOccurrences) {
      const consistency = consistentIntervals.length / intervals.length;

      patterns.push({
        type: PATTERN_TYPES.RELEASE_SCHEDULE,
        medianInterval,
        intervalDays: Math.round(medianInterval / (24 * 60 * 60 * 1000)),
        frequency: consistency,
        confidence: Math.min(1, consistency),
        count: history.length,
        description: `Pattern: Releases occur approximately every ${Math.round(medianInterval / (24 * 60 * 60 * 1000))} days`,
        nextPredicted: history[history.length - 1].timestamp + medianInterval,
        occurrences: consistentIntervals.length
      });
    }

    return patterns;
  }

  /**
   * Detect hourly patterns (intra-day cycles)
   * @private
   */
  detectHourlyPatterns(history) {
    const patterns = [];

    if (!this.options.hourlyResolution || history.length < this.options.minOccurrences) {
      return patterns;
    }

    const hourBuckets = {};
    history.forEach(event => {
      const date = new Date(event.timestamp);
      const hour = date.getHours();
      const key = `hour_${hour}`;

      if (!hourBuckets[key]) {
        hourBuckets[key] = { events: [], hours: new Set() };
      }
      hourBuckets[key].events.push(event);
      hourBuckets[key].hours.add(date.getHours());
    });

    Object.entries(hourBuckets).forEach(([hourKey, data]) => {
      const hour = parseInt(hourKey.split('_')[1]);
      if (data.events.length >= this.options.minOccurrences) {
        patterns.push({
          type: PATTERN_TYPES.HOURLY_PATTERN,
          hour,
          frequency: data.events.length,
          confidence: Math.min(1, data.events.length / (history.length / 24)),
          count: data.events.length,
          description: `Pattern: Activity concentrated around hour ${hour}`,
          nextPredicted: this.predictNextHourlyTime(hour),
          occurrences: data.events.length
        });
      }
    });

    return patterns;
  }

  /**
   * Generate next-occurrence predictions from patterns
   * @private
   */
  generatePatternPredictions(monitorId, patterns) {
    if (patterns.length === 0) {
      return;
    }

    // Use highest confidence pattern for prediction
    const topPattern = patterns.reduce((best, current) =>
      (current.confidence >= best.confidence) ? current : best
    );

    this.patternPredictions.set(monitorId, {
      pattern: topPattern,
      nextExpected: topPattern.nextPredicted,
      confidence: topPattern.confidence,
      patternType: topPattern.type,
      description: topPattern.description
    });
  }

  /**
   * Predict next occurrence for daily pattern
   * @private
   */
  predictNextDailyTime(hour) {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);

    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next.getTime();
  }

  /**
   * Predict next occurrence for weekly pattern
   * @private
   */
  predictNextWeeklyDay(targetDayOfWeek) {
    const now = new Date();
    const next = new Date(now);
    const dayOffset = (targetDayOfWeek - now.getDay() + 7) % 7 || 7;
    next.setDate(next.getDate() + dayOffset);
    next.setHours(0, 0, 0, 0);
    return next.getTime();
  }

  /**
   * Predict next occurrence for monthly pattern
   * @private
   */
  predictNextMonthlyDay(targetDayOfMonth) {
    const now = new Date();
    let next = new Date(now.getFullYear(), now.getMonth(), targetDayOfMonth);

    if (next <= now) {
      next = new Date(now.getFullYear(), now.getMonth() + 1, targetDayOfMonth);
    }

    return next.getTime();
  }

  /**
   * Predict next occurrence for hourly pattern
   * @private
   */
  predictNextHourlyTime(targetHour) {
    const now = new Date();
    const next = new Date(now);
    next.setHours(targetHour, 0, 0, 0);

    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next.getTime();
  }

  /**
   * Calculate day span in history
   * @private
   */
  calculateDaySpan(history) {
    if (history.length < 2) {
      return 0;
    }
    const timespan = history[history.length - 1].timestamp - history[0].timestamp;
    return timespan / (24 * 60 * 60 * 1000);
  }

  /**
   * Get detected patterns for a monitor
   * @param {string} monitorId - Monitor ID
   * @param {Object} options - Query options
   * @returns {Array} Detected patterns
   */
  getPatterns(monitorId, options = {}) {
    let patterns = this.detectedPatterns.get(monitorId) || [];

    if (options.type) {
      patterns = patterns.filter(p => p.type === options.type);
    }

    if (options.minConfidence) {
      patterns = patterns.filter(p => p.confidence >= options.minConfidence);
    }

    return patterns;
  }

  /**
   * Get next predicted occurrence
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Prediction data
   */
  getNextPrediction(monitorId) {
    return this.patternPredictions.get(monitorId) || null;
  }

  /**
   * Get time until next predicted change
   * @param {string} monitorId - Monitor ID
   * @returns {number} Milliseconds until next change
   */
  getTimeUntilNextChange(monitorId) {
    const prediction = this.patternPredictions.get(monitorId);
    if (!prediction) {
      return null;
    }

    const timeLeft = prediction.nextExpected - Date.now();
    return timeLeft > 0 ? timeLeft : null;
  }

  /**
   * Get pattern summary for a monitor
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Summary data
   */
  getPatternSummary(monitorId) {
    const patterns = this.detectedPatterns.get(monitorId) || [];
    const prediction = this.patternPredictions.get(monitorId);
    const history = this.eventHistory.get(monitorId) || [];

    return {
      monitorId,
      patternCount: patterns.length,
      eventCount: history.length,
      patterns,
      nextPredicted: prediction || null,
      summary: patterns.length > 0
        ? `${patterns.length} pattern(s) detected; next change predicted at ${new Date(prediction?.nextExpected).toISOString()}`
        : 'No significant patterns detected'
    };
  }

  /**
   * Get patterns across all monitors
   * @returns {Map} All patterns keyed by monitor ID
   */
  getAllPatterns() {
    return new Map(this.detectedPatterns);
  }

  /**
   * Clear pattern data for a monitor
   * @param {string} monitorId - Monitor ID
   */
  clearMonitor(monitorId) {
    this.detectedPatterns.delete(monitorId);
    this.eventHistory.delete(monitorId);
    this.patternPredictions.delete(monitorId);
  }
}

module.exports = {
  PatternDetector,
  PATTERN_TYPES,
  CONFIDENCE_LEVELS
};
