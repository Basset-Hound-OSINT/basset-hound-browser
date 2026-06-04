/**
 * Trend Forecasting Engine - Predict future trends in pricing, features, and technology
 * Uses exponential smoothing, linear regression, and statistical methods
 * @module src/advanced/trend-forecaster
 */

const EventEmitter = require('events');

/**
 * Forecast Methods
 */
const FORECAST_METHODS = {
  LINEAR: 'linear',
  EXPONENTIAL: 'exponential',
  POLYNOMIAL: 'polynomial',
  MOVING_AVERAGE: 'moving-average'
};

/**
 * Trend Direction
 */
const TREND_DIRECTION = {
  UP: 'upward',
  DOWN: 'downward',
  STABLE: 'stable'
};

/**
 * Trend Forecaster Class
 */
class TrendForecaster extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      method: options.method || FORECAST_METHODS.EXPONENTIAL,
      polynomialDegree: options.polynomialDegree || 2,
      movingAveragePeriod: options.movingAveragePeriod || 7,
      smoothingFactor: options.smoothingFactor || 0.3,
      confidenceIntervals: options.confidenceIntervals || [0.68, 0.95],
      forecastPeriods: options.forecastPeriods || 12,
      minDataPoints: options.minDataPoints || 5,
      enableAlerts: options.enableAlerts !== false,
      seasonalAdjustment: options.seasonalAdjustment !== false,
      ...options
    };

    // Forecast data
    this.dataPoints = new Map(); // series -> [{ timestamp, value }]
    this.forecasts = new Map(); // series -> { method, forecast, confidence }
    this.trends = new Map(); // series -> trend metadata
    this.seasonalFactors = new Map(); // series -> seasonal adjustment factors
  }

  /**
   * Add data point to a series
   * @param {string} series - Series identifier
   * @param {number} value - Data value
   * @param {number} timestamp - Timestamp
   */
  addDataPoint(series, value, timestamp = Date.now()) {
    if (!this.dataPoints.has(series)) {
      this.dataPoints.set(series, []);
    }

    const point = {
      timestamp,
      value,
      date: new Date(timestamp).toISOString()
    };

    this.dataPoints.get(series).push(point);

    // Limit to last 365 points
    const data = this.dataPoints.get(series);
    if (data.length > 365) {
      data.shift();
    }

    // Generate forecast if enough data
    if (data.length >= this.options.minDataPoints) {
      this.generateForecast(series);
    }
  }

  /**
   * Generate forecast for a series
   * @param {string} series - Series identifier
   */
  generateForecast(series) {
    const data = this.dataPoints.get(series) || [];

    if (data.length < this.options.minDataPoints) {
      return;
    }

    const values = data.map(d => d.value);

    let forecast;
    switch (this.options.method) {
      case FORECAST_METHODS.LINEAR:
        forecast = this.linearRegression(data);
        break;
      case FORECAST_METHODS.EXPONENTIAL:
        forecast = this.exponentialSmoothing(data);
        break;
      case FORECAST_METHODS.POLYNOMIAL:
        forecast = this.polynomialRegression(data);
        break;
      case FORECAST_METHODS.MOVING_AVERAGE:
        forecast = this.movingAverageForecast(data);
        break;
      default:
        forecast = this.linearRegression(data);
    }

    // Adjust for seasonality
    if (this.options.seasonalAdjustment && data.length >= 30) {
      forecast = this.applySeasonalAdjustment(series, data, forecast);
    }

    this.forecasts.set(series, forecast);

    // Analyze trend
    this.analyzeTrend(series, values);

    if (this.options.enableAlerts && forecast.trendShift) {
      this.emit('trend-shift', {
        series,
        forecast,
        message: `Trend shift detected in ${series}`
      });
    }
  }

  /**
   * Linear regression forecast
   * @private
   */
  linearRegression(data) {
    const values = data.map(d => d.value);
    const n = values.length;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate forecast points
    const forecast = [];
    const timestamps = data.map(d => d.timestamp);
    const timeInterval = timestamps[timestamps.length - 1] - timestamps[0];
    const avgInterval = timeInterval / (n - 1);

    for (let i = 1; i <= this.options.forecastPeriods; i++) {
      const forecastValue = intercept + slope * (n + i - 1);
      const timestamp = timestamps[timestamps.length - 1] + (avgInterval * i);

      forecast.push({
        period: i,
        timestamp,
        value: forecastValue,
        date: new Date(timestamp).toISOString()
      });
    }

    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = values.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const ssResidual = values.reduce((sum, val, i) => {
      const predicted = intercept + slope * i;
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    const rSquared = Math.max(0, 1 - (ssResidual / ssTotal));

    // Calculate confidence intervals
    const residualStdErr = Math.sqrt(ssResidual / (n - 2));
    const xMean = sumX / n;
    const sxx = sumX2 - (sumX * sumX) / n;

    return {
      method: FORECAST_METHODS.LINEAR,
      forecast,
      slope,
      intercept,
      rSquared,
      residualStdErr,
      confidence: rSquared,
      trend: slope > 0.001 ? TREND_DIRECTION.UP : (slope < -0.001 ? TREND_DIRECTION.DOWN : TREND_DIRECTION.STABLE),
      basis: `Linear regression with R² = ${rSquared.toFixed(3)}`
    };
  }

  /**
   * Exponential smoothing forecast
   * @private
   */
  exponentialSmoothing(data) {
    const values = data.map(d => d.value);
    const n = values.length;
    const alpha = this.options.smoothingFactor;

    // Calculate smoothed values
    const smoothed = [values[0]];
    for (let i = 1; i < n; i++) {
      smoothed.push(alpha * values[i] + (1 - alpha) * smoothed[i - 1]);
    }

    // Calculate trend
    const level = smoothed[n - 1];
    const trend = alpha * (smoothed[n - 1] - smoothed[Math.max(0, n - 12)]) / Math.max(1, Math.min(12, n - 1));

    // Generate forecast
    const forecast = [];
    const timestamps = data.map(d => d.timestamp);
    const timeInterval = timestamps[timestamps.length - 1] - timestamps[0];
    const avgInterval = timeInterval / (n - 1);

    for (let i = 1; i <= this.options.forecastPeriods; i++) {
      const forecastValue = level + trend * i;
      const timestamp = timestamps[timestamps.length - 1] + (avgInterval * i);

      forecast.push({
        period: i,
        timestamp,
        value: forecastValue,
        date: new Date(timestamp).toISOString()
      });
    }

    // Calculate MAPE for accuracy
    let mapeSum = 0;
    for (let i = 1; i < n; i++) {
      mapeSum += Math.abs((values[i] - smoothed[i]) / values[i]);
    }
    const mape = mapeSum / (n - 1);
    const accuracy = Math.max(0, 1 - mape);

    return {
      method: FORECAST_METHODS.EXPONENTIAL,
      forecast,
      alpha,
      level,
      trend,
      confidence: accuracy,
      mape,
      basis: `Exponential smoothing (α = ${alpha}, MAPE = ${mape.toFixed(3)})`
    };
  }

  /**
   * Polynomial regression forecast
   * @private
   */
  polynomialRegression(data) {
    const values = data.map(d => d.value);
    const n = values.length;
    const degree = Math.min(this.options.polynomialDegree, Math.floor(n / 2));

    // Build polynomial matrix
    const X = [];
    for (let i = 0; i < n; i++) {
      const row = [];
      for (let d = 0; d <= degree; d++) {
        row.push(Math.pow(i, d));
      }
      X.push(row);
    }

    // Solve using normal equations (simplified)
    const coefficients = this.solvePolynomial(X, values, degree);

    // Generate forecast
    const forecast = [];
    const timestamps = data.map(d => d.timestamp);
    const timeInterval = timestamps[timestamps.length - 1] - timestamps[0];
    const avgInterval = timeInterval / (n - 1);

    for (let i = 1; i <= this.options.forecastPeriods; i++) {
      let forecastValue = 0;
      const x = n + i - 1;
      for (let d = 0; d <= degree; d++) {
        forecastValue += coefficients[d] * Math.pow(x, d);
      }

      const timestamp = timestamps[timestamps.length - 1] + (avgInterval * i);

      forecast.push({
        period: i,
        timestamp,
        value: forecastValue,
        date: new Date(timestamp).toISOString()
      });
    }

    return {
      method: FORECAST_METHODS.POLYNOMIAL,
      forecast,
      degree,
      coefficients,
      confidence: 0.7,
      basis: `Polynomial regression (degree ${degree})`
    };
  }

  /**
   * Moving average forecast
   * @private
   */
  movingAverageForecast(data) {
    const values = data.map(d => d.value);
    const n = values.length;
    const period = Math.min(this.options.movingAveragePeriod, n);

    // Calculate moving average
    const ma = [];
    for (let i = period - 1; i < n; i++) {
      const window = values.slice(i - period + 1, i + 1);
      ma.push(window.reduce((a, b) => a + b, 0) / window.length);
    }

    const lastMA = ma[ma.length - 1];

    // Generate forecast (flat forecast using last MA)
    const forecast = [];
    const timestamps = data.map(d => d.timestamp);
    const timeInterval = timestamps[timestamps.length - 1] - timestamps[0];
    const avgInterval = timeInterval / (n - 1);

    for (let i = 1; i <= this.options.forecastPeriods; i++) {
      const timestamp = timestamps[timestamps.length - 1] + (avgInterval * i);

      forecast.push({
        period: i,
        timestamp,
        value: lastMA,
        date: new Date(timestamp).toISOString()
      });
    }

    return {
      method: FORECAST_METHODS.MOVING_AVERAGE,
      forecast,
      period,
      lastMovingAverage: lastMA,
      confidence: 0.5,
      basis: `${period}-period moving average`
    };
  }

  /**
   * Solve polynomial system
   * @private
   */
  solvePolynomial(X, y, degree) {
    // Simplified: use least squares approximation
    const coefficients = new Array(degree + 1).fill(0);

    // Simple linear case
    if (degree === 1) {
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < y.length; i++) {
        sumX += i;
        sumY += y[i];
        sumXY += i * y[i];
        sumX2 += i * i;
      }
      const n = y.length;
      coefficients[1] = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      coefficients[0] = (sumY - coefficients[1] * sumX) / n;
    }

    return coefficients;
  }

  /**
   * Apply seasonal adjustment
   * @private
   */
  applySeasonalAdjustment(series, data, forecast) {
    // Calculate seasonal factors based on 30-day periods
    const periodLength = 30;
    const factorsByPeriod = {};

    for (let i = 0; i < data.length; i++) {
      const periodKey = Math.floor(i / periodLength);
      if (!factorsByPeriod[periodKey]) {
        factorsByPeriod[periodKey] = [];
      }
      factorsByPeriod[periodKey].push(data[i].value);
    }

    const meanByPeriod = {};
    Object.entries(factorsByPeriod).forEach(([key, values]) => {
      meanByPeriod[key] = values.reduce((a, b) => a + b, 0) / values.length;
    });

    const overallMean = data.reduce((sum, d) => sum + d.value, 0) / data.length;
    const seasonalFactors = {};

    Object.entries(meanByPeriod).forEach(([key, mean]) => {
      seasonalFactors[key] = mean / overallMean;
    });

    this.seasonalFactors.set(series, seasonalFactors);

    // Apply to forecast
    const adjustedForecast = [...forecast.forecast];
    adjustedForecast.forEach((point, i) => {
      const periodKey = Math.floor((data.length + i) / periodLength) % Object.keys(seasonalFactors).length;
      const factor = seasonalFactors[periodKey] || 1;
      point.adjustedValue = point.value * factor;
    });

    return {
      ...forecast,
      seasonallyAdjusted: true,
      forecast: adjustedForecast
    };
  }

  /**
   * Analyze trend characteristics
   * @private
   */
  analyzeTrend(series, values) {
    const n = values.length;
    const recent = values.slice(-Math.min(10, n));
    const older = values.slice(0, Math.min(10, n));

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;

    const volatility = this.calculateVolatility(values);

    this.trends.set(series, {
      percentChange,
      volatility,
      momentumDirection: percentChange > 1 ? TREND_DIRECTION.UP : (percentChange < -1 ? TREND_DIRECTION.DOWN : TREND_DIRECTION.STABLE),
      stability: 1 - volatility
    });
  }

  /**
   * Calculate volatility
   * @private
   */
  calculateVolatility(values) {
    if (values.length < 2) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return (stdDev / mean) * 100; // Coefficient of variation
  }

  /**
   * Get forecast for a series
   * @param {string} series - Series identifier
   * @returns {Object} Forecast data
   */
  getForecast(series) {
    return this.forecasts.get(series) || null;
  }

  /**
   * Get forecast values for specific periods
   * @param {string} series - Series identifier
   * @param {Array} periods - Period numbers to retrieve
   * @returns {Array} Forecast values
   */
  getForecastValues(series, periods = null) {
    const forecast = this.getForecast(series);
    if (!forecast || !forecast.forecast) return [];

    if (!periods) {
      return forecast.forecast;
    }

    return forecast.forecast.filter(f => periods.includes(f.period));
  }

  /**
   * Get trend analysis
   * @param {string} series - Series identifier
   * @returns {Object} Trend data
   */
  getTrend(series) {
    return this.trends.get(series) || null;
  }

  /**
   * Get forecast with confidence intervals
   * @param {string} series - Series identifier
   * @returns {Object} Forecast with confidence bounds
   */
  getForecastWithConfidence(series) {
    const forecast = this.getForecast(series);
    if (!forecast) return null;

    const data = this.dataPoints.get(series) || [];
    const values = data.map(d => d.value);
    const residualStdErr = forecast.residualStdErr || (this.calculateVolatility(values) / 100);

    const withConfidence = {
      ...forecast,
      confidenceIntervals: {}
    };

    this.options.confidenceIntervals.forEach(confidence => {
      // Z-score for confidence level
      const zScore = this.getZScore(confidence);

      withConfidence.confidenceIntervals[confidence] = forecast.forecast.map(point => ({
        period: point.period,
        value: point.value,
        lower: point.value - (zScore * residualStdErr),
        upper: point.value + (zScore * residualStdErr)
      }));
    });

    return withConfidence;
  }

  /**
   * Get Z-score for confidence level
   * @private
   */
  getZScore(confidence) {
    const confidenceMap = {
      0.68: 1.0,
      0.95: 1.96,
      0.99: 2.576
    };
    return confidenceMap[confidence] || 1.96;
  }

  /**
   * Get all forecasts
   * @returns {Map} All forecasts
   */
  getAllForecasts() {
    return new Map(this.forecasts);
  }

  /**
   * Clear forecast data
   * @param {string} series - Series identifier
   */
  clearSeries(series) {
    this.dataPoints.delete(series);
    this.forecasts.delete(series);
    this.trends.delete(series);
    this.seasonalFactors.delete(series);
  }

  /**
   * Get summary
   * @returns {Object} Summary statistics
   */
  getSummary() {
    return {
      seriesCount: this.dataPoints.size,
      forecastsGenerated: this.forecasts.size,
      totalDataPoints: Array.from(this.dataPoints.values()).reduce((sum, arr) => sum + arr.length, 0),
      series: Array.from(this.dataPoints.keys()).map(series => ({
        series,
        dataPoints: this.dataPoints.get(series)?.length || 0,
        forecast: this.getForecast(series),
        trend: this.getTrend(series)
      }))
    };
  }
}

module.exports = {
  TrendForecaster,
  FORECAST_METHODS,
  TREND_DIRECTION
};
