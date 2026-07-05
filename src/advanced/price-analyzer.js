/**
 * Price Movement Analysis Engine - Track and analyze price changes
 * Provides price tracking, movement detection, trend analysis, and volatility measurement
 * @module src/advanced/price-analyzer
 */

const EventEmitter = require('events');

/**
 * Price Alert Types
 */
const ALERT_TYPES = {
  PRICE_DROP: 'price-drop',
  PRICE_INCREASE: 'price-increase',
  VOLATILITY_SPIKE: 'volatility-spike',
  TREND_REVERSAL: 'trend-reversal',
  PRICE_MILESTONE: 'price-milestone'
};

/**
 * Price Trend Direction
 */
const TREND_DIRECTION = {
  UP: 'up',
  DOWN: 'down',
  STABLE: 'stable'
};

/**
 * Price Analyzer Class
 */
class PriceAnalyzer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      minTrendLength: options.minTrendLength || 3,
      volatilityWindow: options.volatilityWindow || 10,
      trendSensitivity: options.trendSensitivity || 0.05, // 5% threshold
      priceChangeThreshold: options.priceChangeThreshold || 0.05, // 5% for alerts
      volatilityThreshold: options.volatilityThreshold || 0.15, // 15% volatility
      movingAveragePeriods: options.movingAveragePeriods || [5, 10, 20],
      enableAlerts: options.enableAlerts !== false,
      maxHistoryPerProduct: options.maxHistoryPerProduct || 500,
      correlationWindow: options.correlationWindow || 30,
      ...options
    };

    // Price tracking
    this.priceHistory = new Map(); // productId -> [{ timestamp, price, competitor }]
    this.currentPrices = new Map(); // productId -> { price, timestamp, competitor }
    this.priceAlerts = new Map(); // productId -> [alerts]
    this.correlations = new Map(); // competitorPair -> correlation coefficient
    this.volatilityMetrics = new Map(); // productId -> { volatility, stdDev, range }
  }

  /**
   * Record a price observation
   * @param {string} productId - Product identifier
   * @param {number} price - Current price
   * @param {string} competitor - Competitor name
   * @returns {Object} Price analysis
   */
  recordPrice(productId, price, competitor) {
    if (!price || price < 0 || typeof price !== 'number') {
      throw new Error('Invalid price: must be a positive number');
    }

    const timestamp = Date.now();
    const observation = {
      timestamp,
      price,
      competitor,
      datetime: new Date(timestamp).toISOString()
    };

    // Initialize history if needed
    if (!this.priceHistory.has(productId)) {
      this.priceHistory.set(productId, []);
    }

    const history = this.priceHistory.get(productId);
    history.push(observation);

    // Maintain size limit
    if (history.length > this.options.maxHistoryPerProduct) {
      history.shift();
    }

    // Get previous price for comparison
    const previousPrice = this.currentPrices.get(productId)?.price;

    // Update current price
    this.currentPrices.set(productId, observation);

    // Analyze the price change
    const analysis = this.analyzePriceChange(productId, price, previousPrice);

    // Update volatility metrics
    this.updateVolatilityMetrics(productId);

    // Check for alerts
    if (this.options.enableAlerts) {
      this.checkPriceAlerts(productId, analysis);
    }

    return {
      productId,
      price,
      competitor,
      timestamp,
      previousPrice,
      analysis
    };
  }

  /**
   * Analyze price movement
   * @private
   */
  analyzePriceChange(productId, currentPrice, previousPrice) {
    const analysis = {
      productId,
      currentPrice,
      previousPrice,
      change: previousPrice ? currentPrice - previousPrice : 0,
      changePercent: previousPrice ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0,
      direction: TREND_DIRECTION.STABLE,
      trend: null,
      movingAverages: {},
      volatility: null
    };

    // Determine direction
    if (analysis.changePercent > 0) {
      analysis.direction = TREND_DIRECTION.UP;
    } else if (analysis.changePercent < 0) {
      analysis.direction = TREND_DIRECTION.DOWN;
    }

    // Calculate moving averages
    const history = this.priceHistory.get(productId) || [];
    const prices = history.map(h => h.price);

    this.options.movingAveragePeriods.forEach(period => {
      if (prices.length >= period) {
        const ma = prices.slice(-period).reduce((a, b) => a + b, 0) / period;
        analysis.movingAverages[`ma${period}`] = ma;
      }
    });

    // Detect trend
    if (prices.length >= this.options.minTrendLength) {
      analysis.trend = this.detectTrend(prices.slice(-this.options.minTrendLength * 2));
    }

    // Get volatility
    if (this.volatilityMetrics.has(productId)) {
      analysis.volatility = this.volatilityMetrics.get(productId).volatility;
    }

    return analysis;
  }

  /**
   * Detect price trend
   * @private
   */
  detectTrend(prices) {
    if (prices.length < 2) {
      return TREND_DIRECTION.STABLE;
    }

    // Simple linear regression
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = prices.length;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += prices[i];
      sumXY += i * prices[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgPrice = sumY / n;

    // Calculate percentage slope
    const percentSlope = (slope * n / avgPrice) * 100;

    if (percentSlope > this.options.trendSensitivity) {
      return TREND_DIRECTION.UP;
    } else if (percentSlope < -this.options.trendSensitivity) {
      return TREND_DIRECTION.DOWN;
    }

    return TREND_DIRECTION.STABLE;
  }

  /**
   * Update volatility metrics
   * @private
   */
  updateVolatilityMetrics(productId) {
    const history = this.priceHistory.get(productId) || [];
    if (history.length < 2) {
      return;
    }

    const window = Math.min(this.options.volatilityWindow, history.length);
    const windowPrices = history.slice(-window).map(h => h.price);

    // Calculate statistics
    const mean = windowPrices.reduce((a, b) => a + b, 0) / windowPrices.length;
    const variance = windowPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / windowPrices.length;
    const stdDev = Math.sqrt(variance);
    const volatility = (stdDev / mean) * 100; // Coefficient of variation
    const range = Math.max(...windowPrices) - Math.min(...windowPrices);

    this.volatilityMetrics.set(productId, {
      volatility,
      stdDev,
      variance,
      range,
      mean,
      priceCount: history.length
    });
  }

  /**
   * Check for price-related alerts
   * @private
   */
  checkPriceAlerts(productId, analysis) {
    if (!this.priceAlerts.has(productId)) {
      this.priceAlerts.set(productId, []);
    }

    const alerts = [];
    const timestamp = Date.now();

    // Price drop alert
    if (analysis.changePercent < -this.options.priceChangeThreshold * 100) {
      alerts.push({
        type: ALERT_TYPES.PRICE_DROP,
        productId,
        timestamp,
        severity: 'medium',
        message: `Price dropped ${Math.abs(analysis.changePercent).toFixed(2)}%`,
        data: analysis
      });
    }

    // Price increase alert
    if (analysis.changePercent > this.options.priceChangeThreshold * 100) {
      alerts.push({
        type: ALERT_TYPES.PRICE_INCREASE,
        productId,
        timestamp,
        severity: 'low',
        message: `Price increased ${analysis.changePercent.toFixed(2)}%`,
        data: analysis
      });
    }

    // Volatility spike alert
    if (analysis.volatility && analysis.volatility > this.options.volatilityThreshold * 100) {
      alerts.push({
        type: ALERT_TYPES.VOLATILITY_SPIKE,
        productId,
        timestamp,
        severity: 'medium',
        message: `Volatility spike detected: ${analysis.volatility.toFixed(2)}%`,
        data: analysis
      });
    }

    // Emit alerts
    alerts.forEach(alert => {
      this.priceAlerts.get(productId).push(alert);
      this.emit('price-alert', alert);
    });
  }

  /**
   * Get price history for a product
   * @param {string} productId - Product identifier
   * @param {Object} options - Query options
   * @returns {Array} Price history
   */
  getPriceHistory(productId, options = {}) {
    let history = this.priceHistory.get(productId) || [];

    if (options.since) {
      history = history.filter(h => h.timestamp >= options.since);
    }

    if (options.limit) {
      history = history.slice(-options.limit);
    }

    return history;
  }

  /**
   * Get current price for a product
   * @param {string} productId - Product identifier
   * @returns {Object} Current price data
   */
  getCurrentPrice(productId) {
    return this.currentPrices.get(productId) || null;
  }

  /**
   * Get price statistics for a product
   * @param {string} productId - Product identifier
   * @returns {Object} Price statistics
   */
  getPriceStats(productId) {
    const history = this.priceHistory.get(productId) || [];
    if (history.length === 0) {
      return null;
    }

    const prices = history.map(h => h.price).sort((a, b) => a - b);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const median = prices[Math.floor(prices.length / 2)];
    const min = prices[0];
    const max = prices[prices.length - 1];
    const range = max - min;

    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);

    return {
      productId,
      count: history.length,
      mean,
      median,
      min,
      max,
      range,
      stdDev,
      volatility: (stdDev / mean) * 100,
      currentPrice: this.currentPrices.get(productId)?.price,
      firstRecorded: history[0].timestamp,
      lastRecorded: history[history.length - 1].timestamp,
      timespan: history[history.length - 1].timestamp - history[0].timestamp
    };
  }

  /**
   * Get volatility metrics
   * @param {string} productId - Product identifier
   * @returns {Object} Volatility data
   */
  getVolatility(productId) {
    return this.volatilityMetrics.get(productId) || null;
  }

  /**
   * Analyze price correlation between competitors
   * @param {string} competitor1 - First competitor name
   * @param {string} competitor2 - Second competitor name
   * @returns {number} Correlation coefficient (-1 to 1)
   */
  analyzeCompetitorCorrelation(competitor1, competitor2) {
    const key = [competitor1, competitor2].sort().join(':');

    // Get price histories for both competitors
    const prices1 = [];
    const prices2 = [];

    this.priceHistory.forEach((history) => {
      const comp1Data = history.filter(h => h.competitor === competitor1);
      const comp2Data = history.filter(h => h.competitor === competitor2);

      if (comp1Data.length > 0 && comp2Data.length > 0) {
        prices1.push(...comp1Data.map(h => h.price));
        prices2.push(...comp2Data.map(h => h.price));
      }
    });

    if (prices1.length < 2 || prices2.length < 2) {
      return 0;
    }

    // Calculate correlation coefficient
    const n = Math.min(prices1.length, prices2.length);
    const p1 = prices1.slice(-n);
    const p2 = prices2.slice(-n);

    const mean1 = p1.reduce((a, b) => a + b, 0) / n;
    const mean2 = p2.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;

    for (let i = 0; i < n; i++) {
      const d1 = p1[i] - mean1;
      const d2 = p2[i] - mean2;
      numerator += d1 * d2;
      denom1 += d1 * d1;
      denom2 += d2 * d2;
    }

    if (denom1 === 0 || denom2 === 0) {
      return 0;
    }

    const correlation = numerator / Math.sqrt(denom1 * denom2);
    this.correlations.set(key, correlation);

    return correlation;
  }

  /**
   * Get price forecast based on trend
   * @param {string} productId - Product identifier
   * @param {number} periods - Number of periods to forecast
   * @returns {Object} Forecast data
   */
  forecastPrice(productId, periods = 5) {
    const history = this.priceHistory.get(productId) || [];
    if (history.length < 3) {
      return null;
    }

    const prices = history.map(h => h.price);
    const n = prices.length;

    // Simple linear regression
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += prices[i];
      sumXY += i * prices[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate forecast
    const forecast = [];
    for (let i = 1; i <= periods; i++) {
      const forecastPrice = intercept + slope * (n + i - 1);
      forecast.push({
        period: i,
        forecastedPrice: Math.max(0, forecastPrice),
        confidence: 0.7 - (i * 0.1) // Confidence decreases with distance
      });
    }

    return {
      productId,
      currentPrice: prices[prices.length - 1],
      trend: slope > 0 ? 'upward' : 'downward',
      slope,
      forecast
    };
  }

  /**
   * Get price alerts for a product
   * @param {string} productId - Product identifier
   * @param {Object} options - Query options
   * @returns {Array} Alerts
   */
  getAlerts(productId, options = {}) {
    let alerts = this.priceAlerts.get(productId) || [];

    if (options.type) {
      alerts = alerts.filter(a => a.type === options.type);
    }

    if (options.since) {
      alerts = alerts.filter(a => a.timestamp >= options.since);
    }

    if (options.limit) {
      alerts = alerts.slice(-options.limit);
    }

    return alerts;
  }

  /**
   * Get summary of price analysis across all products
   * @returns {Object} Summary data
   */
  getSummary() {
    const summary = {
      productCount: this.priceHistory.size,
      priceObservations: 0,
      totalAlerts: 0,
      products: []
    };

    this.priceHistory.forEach((history, productId) => {
      summary.priceObservations += history.length;

      const stats = this.getPriceStats(productId);
      summary.products.push({
        productId,
        observations: history.length,
        currentPrice: this.currentPrices.get(productId)?.price,
        stats,
        alerts: this.priceAlerts.get(productId)?.length || 0
      });
    });

    summary.totalAlerts = Array.from(this.priceAlerts.values()).reduce((sum, arr) => sum + arr.length, 0);

    return summary;
  }

  /**
   * Clear price history for a product
   * @param {string} productId - Product identifier
   */
  clearHistory(productId) {
    this.priceHistory.delete(productId);
    this.currentPrices.delete(productId);
    this.priceAlerts.delete(productId);
    this.volatilityMetrics.delete(productId);
  }
}

module.exports = {
  PriceAnalyzer,
  ALERT_TYPES,
  TREND_DIRECTION
};
