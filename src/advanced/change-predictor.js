/**
 * Change Prediction Engine - Predict when next changes will occur
 * Uses historical patterns to forecast future change events
 * @module src/advanced/change-predictor
 */

const EventEmitter = require('events');

/**
 * Prediction Confidence Levels
 */
const CONFIDENCE_LEVELS = {
  VERY_HIGH: 0.9,
  HIGH: 0.75,
  MEDIUM: 0.6,
  LOW: 0.4,
  VERY_LOW: 0.2
};

/**
 * Change Predictor Class
 */
class ChangePredictor extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      minHistoryPoints: options.minHistoryPoints || 5,
      predictionHorizon: options.predictionHorizon || 7 * 24 * 60 * 60 * 1000, // 7 days
      confidenceThreshold: options.confidenceThreshold || CONFIDENCE_LEVELS.MEDIUM,
      methods: options.methods || ['trend', 'frequency', 'seasonal', 'ensemble'],
      enableAlerts: options.enableAlerts !== false,
      ...options
    };

    // Prediction data
    this.predictions = new Map(); // monitorId -> [predictions]
    this.changeHistory = new Map(); // monitorId -> [changes]
    this.accuracy = new Map(); // monitorId -> { correct, total, accuracy }
  }

  /**
   * Record a change event
   * @param {string} monitorId - Monitor ID
   * @param {Object} change - Change data
   */
  recordChange(monitorId, change) {
    if (!this.changeHistory.has(monitorId)) {
      this.changeHistory.set(monitorId, []);
    }

    const record = {
      ...change,
      timestamp: change.timestamp || Date.now(),
      magnitude: change.magnitude || 1
    };

    this.changeHistory.get(monitorId).push(record);

    // Generate predictions after recording
    this.generatePredictions(monitorId);
  }

  /**
   * Generate predictions for next change
   * @param {string} monitorId - Monitor ID
   */
  generatePredictions(monitorId) {
    const history = this.changeHistory.get(monitorId) || [];

    if (history.length < this.options.minHistoryPoints) {
      return;
    }

    const predictions = [];

    // Use multiple methods
    if (this.options.methods.includes('frequency')) {
      predictions.push(this.predictByFrequency(monitorId, history));
    }

    if (this.options.methods.includes('trend')) {
      predictions.push(this.predictByTrend(monitorId, history));
    }

    if (this.options.methods.includes('seasonal')) {
      predictions.push(this.predictBySeasonal(monitorId, history));
    }

    // Filter valid predictions
    const validPredictions = predictions.filter(p => p && p.confidence >= this.options.confidenceThreshold);

    if (this.options.methods.includes('ensemble') && validPredictions.length > 1) {
      const ensemblePrediction = this.ensemblePredictions(validPredictions);
      this.predictions.set(monitorId, [ensemblePrediction, ...validPredictions]);
    } else {
      this.predictions.set(monitorId, validPredictions);
    }

    if (this.options.enableAlerts && validPredictions.length > 0) {
      this.emit('predictions-generated', {
        monitorId,
        predictions: this.predictions.get(monitorId)
      });
    }
  }

  /**
   * Predict by change frequency
   * @private
   */
  predictByFrequency(monitorId, history) {
    if (history.length < 2) {
      return null;
    }

    // Calculate average interval between changes
    const intervals = [];
    for (let i = 1; i < history.length; i++) {
      intervals.push(history[i].timestamp - history[i - 1].timestamp);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdDev = Math.sqrt(
      intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length
    );

    // Next prediction is last change + average interval
    const lastChange = history[history.length - 1].timestamp;
    const nextPredicted = lastChange + avgInterval;

    // Confidence increases with consistency
    const confidence = 1 - (stdDev / avgInterval);

    return {
      method: 'frequency',
      monitorId,
      nextPredicted,
      nextPredictedDate: new Date(nextPredicted).toISOString(),
      confidence: Math.max(CONFIDENCE_LEVELS.VERY_LOW, Math.min(CONFIDENCE_LEVELS.VERY_HIGH, confidence)),
      avgInterval: Math.round(avgInterval / (60 * 60 * 1000)), // hours
      intervalStdDev: Math.round(stdDev / (60 * 60 * 1000)),
      basis: `Average interval of ${Math.round(avgInterval / (24 * 60 * 60 * 1000))} days`,
      estimatedRange: {
        earliest: nextPredicted - stdDev,
        latest: nextPredicted + stdDev
      }
    };
  }

  /**
   * Predict by trend extrapolation
   * @private
   */
  predictByTrend(monitorId, history) {
    if (history.length < 3) {
      return null;
    }

    // Use only recent history (last 50 points or less)
    const recent = history.slice(-Math.min(50, Math.max(10, Math.floor(history.length / 2))));
    const timestamps = recent.map(h => h.timestamp);
    const magnitudes = recent.map(h => h.magnitude || 1);

    // Simple linear regression on log scale
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = timestamps.length;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = Math.log(magnitudes[i] + 1);
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict based on trend
    const timeInterval = timestamps[timestamps.length - 1] - timestamps[0];
    const avgInterval = timeInterval / (timestamps.length - 1);
    const nextX = n + 1;
    const nextMagnitude = Math.exp(intercept + slope * nextX);
    const nextPredicted = timestamps[timestamps.length - 1] + avgInterval;

    // Confidence based on R-squared
    const yMean = sumY / n;
    const ssTotal = magnitudes.reduce((sum, val) => sum + Math.pow(Math.log(val + 1) - yMean, 2), 0);
    const ssResidual = magnitudes.reduce((sum, val, i) => {
      const predicted = intercept + slope * i;
      return sum + Math.pow(Math.log(val + 1) - predicted, 2);
    }, 0);
    const rSquared = Math.max(0, 1 - (ssResidual / ssTotal));
    const confidence = rSquared;

    return {
      method: 'trend',
      monitorId,
      nextPredicted,
      nextPredictedDate: new Date(nextPredicted).toISOString(),
      confidence: Math.max(CONFIDENCE_LEVELS.VERY_LOW, Math.min(CONFIDENCE_LEVELS.VERY_HIGH, confidence)),
      trendDirection: slope > 0 ? 'accelerating' : 'decelerating',
      rSquared: rSquared.toFixed(3),
      basis: `Trend extrapolation with R² = ${rSquared.toFixed(3)}`,
      estimatedRange: {
        earliest: nextPredicted - (avgInterval * 0.5),
        latest: nextPredicted + (avgInterval * 0.5)
      }
    };
  }

  /**
   * Predict by seasonal pattern
   * @private
   */
  predictBySeasonal(monitorId, history) {
    if (history.length < 7) {
      return null;
    }

    // Group by day of week
    const byDayOfWeek = {};
    history.forEach(change => {
      const dayOfWeek = new Date(change.timestamp).getDay();
      if (!byDayOfWeek[dayOfWeek]) {
        byDayOfWeek[dayOfWeek] = [];
      }
      byDayOfWeek[dayOfWeek].push(change);
    });

    // Find most common day
    let maxDay = 0;
    let maxCount = 0;
    Object.entries(byDayOfWeek).forEach(([day, changes]) => {
      if (changes.length > maxCount) {
        maxCount = changes.length;
        maxDay = parseInt(day);
      }
    });

    if (maxCount < 2) {
      return null;
    }

    // Calculate average time on that day
    const dayChanges = byDayOfWeek[maxDay];
    const hours = dayChanges.map(c => new Date(c.timestamp).getHours());
    const avgHour = hours.reduce((a, b) => a + b, 0) / hours.length;

    // Next occurrence of this day
    const now = new Date();
    const next = new Date(now);
    const dayOffset = (maxDay - now.getDay() + 7) % 7 || 7;
    next.setDate(next.getDate() + dayOffset);
    next.setHours(Math.round(avgHour), 0, 0, 0);

    const confidence = maxCount / history.length;

    return {
      method: 'seasonal',
      monitorId,
      nextPredicted: next.getTime(),
      nextPredictedDate: next.toISOString(),
      confidence: Math.max(CONFIDENCE_LEVELS.VERY_LOW, Math.min(CONFIDENCE_LEVELS.VERY_HIGH, confidence)),
      pattern: `Day ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][maxDay]}`,
      expectedHour: Math.round(avgHour),
      occurrences: maxCount,
      basis: `Seasonal pattern detected on ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][maxDay]}s at ~${Math.round(avgHour)}:00`,
      estimatedRange: {
        earliest: next.getTime() - (2 * 60 * 60 * 1000),
        latest: next.getTime() + (2 * 60 * 60 * 1000)
      }
    };
  }

  /**
   * Combine multiple predictions into ensemble
   * @private
   */
  ensemblePredictions(predictions) {
    if (predictions.length === 0) {
      return null;
    }

    // Weighted average of predictions
    let totalWeight = 0;
    let weightedTime = 0;

    predictions.forEach(pred => {
      totalWeight += pred.confidence;
      weightedTime += pred.nextPredicted * pred.confidence;
    });

    const nextPredicted = Math.round(weightedTime / totalWeight);
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;

    return {
      method: 'ensemble',
      monitorId: predictions[0].monitorId,
      nextPredicted,
      nextPredictedDate: new Date(nextPredicted).toISOString(),
      confidence: avgConfidence,
      methodCount: predictions.length,
      methods: predictions.map(p => p.method),
      basis: `Ensemble of ${predictions.length} prediction methods`,
      estimatedRange: {
        earliest: Math.min(...predictions.map(p => p.estimatedRange?.earliest || p.nextPredicted)),
        latest: Math.max(...predictions.map(p => p.estimatedRange?.latest || p.nextPredicted))
      }
    };
  }

  /**
   * Get predictions for a monitor
   * @param {string} monitorId - Monitor ID
   * @returns {Array} Predictions
   */
  getPredictions(monitorId) {
    return this.predictions.get(monitorId) || [];
  }

  /**
   * Get best prediction for a monitor
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Best prediction
   */
  getBestPrediction(monitorId) {
    const predictions = this.getPredictions(monitorId);
    if (predictions.length === 0) {
      return null;
    }

    // Prefer ensemble, then highest confidence
    const ensemble = predictions.find(p => p.method === 'ensemble');
    if (ensemble) {
      return ensemble;
    }

    return predictions.reduce((best, current) =>
      (current.confidence >= best.confidence) ? current : best
    );
  }

  /**
   * Get time until next predicted change
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Time estimate
   */
  getTimeUntilNextChange(monitorId) {
    const prediction = this.getBestPrediction(monitorId);
    if (!prediction) {
      return null;
    }

    const now = Date.now();
    const timeUntil = prediction.nextPredicted - now;

    return {
      monitorId,
      prediction,
      timeUntilMs: timeUntil,
      timeUntilHours: Math.round(timeUntil / (60 * 60 * 1000)),
      timeUntilDays: Math.round(timeUntil / (24 * 60 * 60 * 1000)),
      isPast: timeUntil < 0,
      hoursOverdue: timeUntil < 0 ? Math.round(-timeUntil / (60 * 60 * 1000)) : 0
    };
  }

  /**
   * Record actual change and update prediction accuracy
   * @param {string} monitorId - Monitor ID
   * @param {Object} actualChange - The actual change that occurred
   */
  recordActualChange(monitorId, actualChange) {
    const predictions = this.getPredictions(monitorId);
    if (predictions.length === 0) {
      return;
    }

    const bestPrediction = this.getBestPrediction(monitorId);
    if (!bestPrediction) {
      return;
    }

    const actualTime = actualChange.timestamp || Date.now();
    const predictionError = Math.abs(actualTime - bestPrediction.nextPredicted);
    const predictionWindow = bestPrediction.estimatedRange?.latest - bestPrediction.estimatedRange?.earliest || 0;

    const isCorrect = predictionError <= predictionWindow;

    // Update accuracy tracking
    if (!this.accuracy.has(monitorId)) {
      this.accuracy.set(monitorId, { correct: 0, total: 0, errors: [] });
    }

    const acc = this.accuracy.get(monitorId);
    acc.total++;
    if (isCorrect) {
      acc.correct++;
    }
    acc.errors.push(predictionError);
    acc.accuracy = acc.correct / acc.total;

    // Record the change
    this.recordChange(monitorId, actualChange);
  }

  /**
   * Get prediction accuracy for a monitor
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Accuracy statistics
   */
  getAccuracy(monitorId) {
    return this.accuracy.get(monitorId) || null;
  }

  /**
   * Get summary of predictions
   * @returns {Object} Summary data
   */
  getSummary() {
    const summary = {
      monitorsWithPredictions: 0,
      totalPredictions: 0,
      averageConfidence: 0,
      upcomingChanges: []
    };

    let confidenceSum = 0;
    let predictionCount = 0;

    this.predictions.forEach((predictions, monitorId) => {
      if (predictions.length > 0) {
        summary.monitorsWithPredictions++;
        const best = this.getBestPrediction(monitorId);

        if (best && best.nextPredicted > Date.now()) {
          summary.upcomingChanges.push({
            monitorId,
            prediction: best,
            hoursUntil: Math.round((best.nextPredicted - Date.now()) / (60 * 60 * 1000))
          });
        }

        predictions.forEach(pred => {
          confidenceSum += pred.confidence;
          predictionCount++;
        });
      }
    });

    summary.totalPredictions = predictionCount;
    summary.averageConfidence = predictionCount > 0 ? (confidenceSum / predictionCount).toFixed(3) : 0;
    summary.upcomingChanges.sort((a, b) => a.hoursUntil - b.hoursUntil);

    return summary;
  }
}

module.exports = {
  ChangePredictor,
  CONFIDENCE_LEVELS
};
