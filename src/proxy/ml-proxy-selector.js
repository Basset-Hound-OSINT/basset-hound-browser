/**
 * ML-Based Proxy Selector
 * OPT-14: Use logistic regression to predict proxy success probability
 *
 * Features:
 * - Track success rate per proxy per destination
 * - Simple logistic regression model
 * - Predict probability of success
 * - Select highest probability proxy
 * - Continuous learning from proxy results
 *
 * Expected gain: 5-8% throughput (better proxy selection)
 */

class MLProxySelector {
  constructor(options = {}) {
    this.maxHistoryPerProxy = options.maxHistoryPerProxy || 100;
    this.trainingThreshold = options.trainingThreshold || 10;  // Min samples to train model
    this.modelUpdateInterval = options.modelUpdateInterval || 5000; // Retrain every 5s
    this.learningRate = options.learningRate || 0.01;

    // Tracking data
    this.proxyHistory = new Map();                    // proxyId -> [{result, destination, timestamp}]
    this.destinationStats = new Map();                // destination -> {totalRequests, successCount}
    this.proxyDestinationStats = new Map();           // "proxyId:destination" -> stats

    // Model parameters
    this.model = {
      weights: {
        bias: 0,
        proxyReputation: 0.1,
        successRate: 0.5,
        latency: -0.0005,
        destinationAffinity: 0.2
      },
      accuracy: 0,
      sampleCount: 0
    };

    this.metrics = {
      predictions: 0,
      predictionsAccurate: 0,
      modelTrainings: 0,
      avgAccuracy: 0,
      accuracies: []
    };

    // Start model update timer
    this._startModelUpdateTimer();
  }

  /**
   * Predict success probability for proxy on destination
   */
  predictSuccess(proxy, destination) {
    const features = this._extractFeatures(proxy, destination);
    const probability = this._logisticFunction(this._computeScore(features));

    this.metrics.predictions++;

    return {
      proxyId: proxy.id,
      destination,
      probability: Math.round(probability * 10000) / 10000,
      confidence: this._getConfidence(proxy, destination),
      factors: {
        proxyReputation: features.proxyReputation,
        successRate: features.successRate,
        latency: features.latency,
        destinationAffinity: features.destinationAffinity
      }
    };
  }

  /**
   * Select best proxy from candidates using ML prediction
   */
  selectBestProxy(candidates, destination) {
    if (!candidates || candidates.length === 0) {
      throw new Error('No candidate proxies');
    }

    // Get predictions for all candidates
    const predictions = candidates.map(proxy => ({
      proxy,
      prediction: this.predictSuccess(proxy, destination)
    }));

    // Sort by probability (highest first)
    predictions.sort((a, b) => b.prediction.probability - a.prediction.probability);

    return {
      selectedProxy: predictions[0].proxy,
      selectedProbability: predictions[0].prediction.probability,
      confidence: predictions[0].prediction.confidence,
      ranking: predictions.map((p, idx) => ({
        rank: idx + 1,
        proxyId: p.proxy.id,
        probability: p.prediction.probability,
        confidence: p.prediction.confidence
      })),
      allPredictions: predictions
    };
  }

  /**
   * Record proxy result for training
   */
  recordProxyResult(proxyId, destination, result) {
    const success = result.success !== false;
    const latency = result.latency || 0;

    // Update history
    if (!this.proxyHistory.has(proxyId)) {
      this.proxyHistory.set(proxyId, []);
    }

    const history = this.proxyHistory.get(proxyId);
    history.push({
      success,
      latency,
      destination,
      timestamp: Date.now()
    });

    // Keep only recent history
    if (history.length > this.maxHistoryPerProxy) {
      history.shift();
    }

    // Update destination stats
    const destKey = destination;
    if (!this.destinationStats.has(destKey)) {
      this.destinationStats.set(destKey, { totalRequests: 0, successCount: 0 });
    }

    const destStats = this.destinationStats.get(destKey);
    destStats.totalRequests++;
    if (success) destStats.successCount++;

    // Update proxy-destination stats
    const key = `${proxyId}:${destKey}`;
    if (!this.proxyDestinationStats.has(key)) {
      this.proxyDestinationStats.set(key, { totalRequests: 0, successCount: 0 });
    }

    const stats = this.proxyDestinationStats.get(key);
    stats.totalRequests++;
    if (success) stats.successCount++;

    // Verify prediction accuracy
    this._verifyPredictionAccuracy(proxyId, destination, success);

    return { recorded: true, success };
  }

  /**
   * Verify if prediction was accurate
   * @private
   */
  _verifyPredictionAccuracy(proxyId, destination, actualSuccess) {
    const prediction = this.predictSuccess({ id: proxyId }, destination);
    const predictedSuccess = prediction.probability > 0.5;

    if (predictedSuccess === actualSuccess) {
      this.metrics.predictionsAccurate++;
    }

    // Update accuracy tracking
    if (this.metrics.predictions > 0) {
      const accuracy = this.metrics.predictionsAccurate / this.metrics.predictions;
      this.metrics.accuracies.push(accuracy);
      if (this.metrics.accuracies.length > 100) {
        this.metrics.accuracies.shift();
      }

      this.metrics.avgAccuracy = Math.round(
        (this.metrics.accuracies.reduce((a, b) => a + b, 0) / this.metrics.accuracies.length) * 10000
      ) / 10000;
    }
  }

  /**
   * Extract features from proxy and destination
   * @private
   */
  _extractFeatures(proxy, destination) {
    // Proxy reputation (0-1)
    const proxyReputation = proxy.reputation || 0.5;

    // Success rate (0-1)
    const key = `${proxy.id}:${destination}`;
    const stats = this.proxyDestinationStats.get(key);
    const successRate = stats
      ? stats.successCount / stats.totalRequests
      : 0.5;

    // Latency (normalize 0-1, lower is better)
    const latency = proxy.metrics?.avgLatency || 100;
    const normalizedLatency = Math.min(1, latency / 500); // 500ms is worst

    // Destination affinity (how often this proxy succeeds on this destination)
    const destStats = this.destinationStats.get(destination);
    const destinationAffinity = destStats && stats
      ? (stats.successCount / destStats.successCount) * 0.5
      : 0.5;

    return {
      proxyReputation,
      successRate,
      latency: normalizedLatency,
      destinationAffinity,
      hasHistoryData: stats && stats.totalRequests > 0
    };
  }

  /**
   * Compute score from features using current model
   * @private
   */
  _computeScore(features) {
    const { weights } = this.model;

    let score = weights.bias;
    score += features.proxyReputation * weights.proxyReputation;
    score += features.successRate * weights.successRate;
    score += features.latency * weights.latency;
    score += features.destinationAffinity * weights.destinationAffinity;

    return score;
  }

  /**
   * Logistic function (sigmoid)
   * Converts score to probability (0-1)
   * @private
   */
  _logisticFunction(score) {
    // Clamp score to avoid numerical overflow
    const clampedScore = Math.max(-500, Math.min(500, score));
    return 1 / (1 + Math.exp(-clampedScore));
  }

  /**
   * Get confidence in prediction
   * @private
   */
  _getConfidence(proxy, destination) {
    const key = `${proxy.id}:${destination}`;
    const stats = this.proxyDestinationStats.get(key);

    if (!stats || stats.totalRequests === 0) {
      return 'low'; // No data
    }

    if (stats.totalRequests < 5) {
      return 'medium-low';
    }

    if (stats.totalRequests < 20) {
      return 'medium';
    }

    if (stats.totalRequests < 50) {
      return 'medium-high';
    }

    return 'high';
  }

  /**
   * Train/update model from historical data
   */
  trainModel() {
    if (this.proxyDestinationStats.size < this.trainingThreshold) {
      return { trained: false, reason: 'insufficient_data' };
    }

    // Collect training samples
    const samples = [];
    for (const [key, stats] of this.proxyDestinationStats) {
      if (stats.totalRequests < 3) continue; // Skip low-count entries

      const [proxyId, destination] = key.split(':');
      const proxy = { id: proxyId, reputation: 0.5 };

      const features = this._extractFeatures(proxy, destination);
      const label = stats.successCount > stats.totalRequests / 2 ? 1 : 0;

      samples.push({
        features,
        label,
        weight: stats.totalRequests // Weight by number of observations
      });
    }

    if (samples.length < this.trainingThreshold) {
      return { trained: false, reason: 'insufficient_samples' };
    }

    // Update model weights (simplified gradient descent)
    this._updateWeights(samples);

    this.metrics.modelTrainings++;
    this.model.sampleCount = samples.length;

    return {
      trained: true,
      samplesUsed: samples.length,
      newAccuracy: this.metrics.avgAccuracy,
      modelWeights: this.model.weights
    };
  }

  /**
   * Update model weights
   * @private
   */
  _updateWeights(samples) {
    const weights = this.model.weights;

    for (const sample of samples) {
      const prediction = this._logisticFunction(this._computeScore(sample.features));
      const error = sample.label - prediction;

      // Update weights using gradient descent
      weights.bias += this.learningRate * error;
      weights.proxyReputation += this.learningRate * error * sample.features.proxyReputation;
      weights.successRate += this.learningRate * error * sample.features.successRate;
      weights.latency += this.learningRate * error * sample.features.latency;
      weights.destinationAffinity += this.learningRate * error * sample.features.destinationAffinity;
    }
  }

  /**
   * Start periodic model update
   * @private
   */
  _startModelUpdateTimer() {
    setInterval(() => {
      this.trainModel();
    }, this.modelUpdateInterval);
  }

  /**
   * Get model statistics
   */
  getModelStats() {
    return {
      trainings: this.metrics.modelTrainings,
      predictions: this.metrics.predictions,
      avgAccuracy: this.metrics.avgAccuracy,
      weights: this.model.weights,
      sampleCount: this.model.sampleCount,
      dataPoints: {
        proxies: this.proxyHistory.size,
        destinations: this.destinationStats.size,
        proxyDestinationPairs: this.proxyDestinationStats.size
      }
    };
  }

  /**
   * Get proxy-destination history
   */
  getProxyHistory(proxyId, limit = 20) {
    const history = this.proxyHistory.get(proxyId) || [];
    return history.slice(-limit);
  }

  /**
   * Get destination statistics
   */
  getDestinationStats(destination) {
    const stats = this.destinationStats.get(destination);

    if (!stats) {
      return { destination, noData: true };
    }

    return {
      destination,
      totalRequests: stats.totalRequests,
      successCount: stats.successCount,
      successRate: Math.round((stats.successCount / stats.totalRequests) * 10000) / 10000
    };
  }

  /**
   * Reset model
   */
  resetModel() {
    this.model = {
      weights: {
        bias: 0,
        proxyReputation: 0.1,
        successRate: 0.5,
        latency: -0.0005,
        destinationAffinity: 0.2
      },
      accuracy: 0,
      sampleCount: 0
    };

    return { reset: true };
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      accuracyPercent: Math.round(this.metrics.avgAccuracy * 10000) / 100
    };
  }
}

module.exports = MLProxySelector;
