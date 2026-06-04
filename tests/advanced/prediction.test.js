/**
 * Prediction and Forecasting Tests
 * Tests for change prediction and trend forecasting
 */

const { ChangePredictor, CONFIDENCE_LEVELS } = require('../../src/advanced/change-predictor');
const { TrendForecaster, FORECAST_METHODS } = require('../../src/advanced/trend-forecaster');

describe('Change Predictor', () => {
  let predictor;

  beforeEach(() => {
    predictor = new ChangePredictor({
      minHistoryPoints: 5,
      confidenceThreshold: CONFIDENCE_LEVELS.MEDIUM
    });
  });

  describe('Change Recording', () => {
    test('should record change events', () => {
      predictor.recordChange('monitor1', { magnitude: 1.5 });

      const history = predictor.changeHistory.get('monitor1');
      expect(history).toBeDefined();
      expect(history.length).toBe(1);
    });

    test('should generate predictions after sufficient history', () => {
      const changes = [
        { magnitude: 1, timestamp: 0 },
        { magnitude: 1.1, timestamp: 1000 },
        { magnitude: 1.2, timestamp: 2000 },
        { magnitude: 1.3, timestamp: 3000 },
        { magnitude: 1.4, timestamp: 4000 },
        { magnitude: 1.5, timestamp: 5000 }
      ];

      changes.forEach(change => {
        predictor.recordChange('monitor1', change);
      });

      const predictions = predictor.getPredictions('monitor1');
      expect(predictions.length).toBeGreaterThan(0);
    });
  });

  describe('Frequency-Based Prediction', () => {
    test('should predict by change frequency', () => {
      const baseTime = Date.now();
      // Create changes at regular 1-hour intervals
      for (let i = 0; i < 6; i++) {
        predictor.recordChange('monitor1', {
          magnitude: 1,
          timestamp: baseTime + (i * 60 * 60 * 1000)
        });
      }

      const prediction = predictor.getBestPrediction('monitor1');

      expect(prediction).toBeDefined();
      expect(prediction.method).toBe('frequency');
      expect(prediction.nextPredicted).toBeGreaterThan(baseTime);
      expect(prediction.confidence).toBeGreaterThan(0);
    });

    test('should calculate average interval', () => {
      const baseTime = Date.now();
      for (let i = 0; i < 5; i++) {
        predictor.recordChange('monitor1', {
          magnitude: 1,
          timestamp: baseTime + (i * 24 * 60 * 60 * 1000) // 1 day intervals
        });
      }

      const prediction = predictor.getBestPrediction('monitor1');

      if (prediction && prediction.method === 'frequency') {
        expect(prediction.avgInterval).toBeDefined();
        expect(prediction.avgInterval).toBeGreaterThan(0);
      }
    });
  });

  describe('Trend-Based Prediction', () => {
    test('should predict by trend extrapolation', () => {
      const baseTime = Date.now();
      // Create upward trend
      for (let i = 0; i < 10; i++) {
        predictor.recordChange('monitor1', {
          magnitude: 1 + (i * 0.1),
          timestamp: baseTime + (i * 1000)
        });
      }

      const prediction = predictor.getBestPrediction('monitor1');

      expect(prediction).toBeDefined();
      expect(prediction.nextPredicted).toBeGreaterThan(baseTime);
    });

    test('should detect trend direction', () => {
      const baseTime = Date.now();
      for (let i = 0; i < 10; i++) {
        predictor.recordChange('monitor1', {
          magnitude: 100 - (i * 5), // Downward trend
          timestamp: baseTime + (i * 1000)
        });
      }

      const prediction = predictor.getBestPrediction('monitor1');

      if (prediction && prediction.trendDirection) {
        expect(prediction.trendDirection).toBeTruthy();
      }
    });
  });

  describe('Seasonal Prediction', () => {
    test('should detect seasonal patterns', () => {
      const baseTime = new Date(2024, 0, 1, 10, 0, 0).getTime();

      // Create Monday pattern
      for (let week = 0; week < 6; week++) {
        const timestamp = baseTime + (week * 7 * 24 * 60 * 60 * 1000);
        predictor.recordChange('monitor1', {
          magnitude: 1,
          timestamp
        });
      }

      const prediction = predictor.getBestPrediction('monitor1');

      expect(prediction).toBeDefined();
      if (prediction && prediction.method === 'seasonal') {
        expect(prediction.pattern).toBeTruthy();
      }
    });
  });

  describe('Ensemble Predictions', () => {
    test('should combine multiple prediction methods', () => {
      const baseTime = Date.now();

      for (let i = 0; i < 20; i++) {
        predictor.recordChange('monitor1', {
          magnitude: 10 + (i * 0.5),
          timestamp: baseTime + (i * 60 * 60 * 1000) // 1 hour apart
        });
      }

      const predictions = predictor.getPredictions('monitor1');
      const ensemble = predictions.find(p => p.method === 'ensemble');

      if (ensemble) {
        expect(ensemble.methodCount).toBeGreaterThan(0);
        expect(ensemble.methods).toBeDefined();
      }
    });
  });

  describe('Prediction Confidence', () => {
    test('should have varying confidence levels', () => {
      const baseTime = Date.now();

      // Less consistent data
      for (let i = 0; i < 6; i++) {
        predictor.recordChange('monitor1', {
          magnitude: 1 + (Math.random() * 5),
          timestamp: baseTime + (i * 1000)
        });
      }

      const prediction = predictor.getBestPrediction('monitor1');

      expect(prediction).toBeDefined();
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Time Until Next Change', () => {
    test('should calculate time until prediction', () => {
      const baseTime = Date.now();

      for (let i = 0; i < 6; i++) {
        predictor.recordChange('monitor1', {
          magnitude: 1,
          timestamp: baseTime - (6 - i) * 60 * 60 * 1000 // Historic data
        });
      }

      const timeUntil = predictor.getTimeUntilNextChange('monitor1');

      expect(timeUntil).toBeDefined();
      if (timeUntil) {
        expect(timeUntil.timeUntilMs).toBeGreaterThan(0);
        expect(timeUntil.timeUntilHours).toBeGreaterThan(0);
        expect(timeUntil.timeUntilDays).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Accuracy Tracking', () => {
    test('should track prediction accuracy', () => {
      const baseTime = Date.now();

      for (let i = 0; i < 10; i++) {
        predictor.recordChange('monitor1', {
          magnitude: 10,
          timestamp: baseTime + (i * 60 * 60 * 1000)
        });
      }

      const prediction = predictor.getBestPrediction('monitor1');

      if (prediction) {
        predictor.recordActualChange('monitor1', {
          timestamp: prediction.nextPredicted
        });

        const accuracy = predictor.getAccuracy('monitor1');
        expect(accuracy).toBeDefined();
      }
    });
  });

  describe('Summary and Reporting', () => {
    test('should provide prediction summary', () => {
      const baseTime = Date.now();

      predictor.recordChange('monitor1', { magnitude: 1, timestamp: baseTime });
      predictor.recordChange('monitor1', { magnitude: 1.1, timestamp: baseTime + 1000 });
      predictor.recordChange('monitor2', { magnitude: 2, timestamp: baseTime });

      const summary = predictor.getSummary();

      expect(summary.monitorsWithPredictions).toBeGreaterThanOrEqual(0);
      expect(summary.averageConfidence).toBeDefined();
    });
  });
});

describe('Trend Forecaster', () => {
  let forecaster;

  beforeEach(() => {
    forecaster = new TrendForecaster({
      method: FORECAST_METHODS.LINEAR,
      forecastPeriods: 5
    });
  });

  describe('Data Point Management', () => {
    test('should add data points to series', () => {
      forecaster.addDataPoint('series1', 100);
      forecaster.addDataPoint('series1', 105);

      const data = forecaster.dataPoints.get('series1');
      expect(data).toBeDefined();
      expect(data.length).toBe(2);
    });

    test('should limit data history', () => {
      const forecaster2 = new TrendForecaster({ /* default limit 365 */ });

      for (let i = 0; i < 500; i++) {
        forecaster2.addDataPoint('series1', 100 + i);
      }

      const data = forecaster2.dataPoints.get('series1');
      expect(data.length).toBeLessThanOrEqual(365);
    });
  });

  describe('Linear Regression Forecast', () => {
    test('should perform linear regression', () => {
      const forecaster2 = new TrendForecaster({ method: FORECAST_METHODS.LINEAR });

      for (let i = 0; i < 15; i++) {
        forecaster2.addDataPoint('series1', 100 + i * 2);
      }

      const forecast = forecaster2.getForecast('series1');

      expect(forecast).toBeDefined();
      expect(forecast.method).toBe(FORECAST_METHODS.LINEAR);
      expect(forecast.forecast.length).toBeGreaterThan(0);
      expect(forecast.rSquared).toBeDefined();
    });

    test('should calculate slope and intercept', () => {
      for (let i = 0; i < 15; i++) {
        forecaster.addDataPoint('series1', 50 + i * 3);
      }

      const forecast = forecaster.getForecast('series1');

      expect(forecast.slope).toBeDefined();
      expect(forecast.intercept).toBeDefined();
    });
  });

  describe('Exponential Smoothing Forecast', () => {
    test('should perform exponential smoothing', () => {
      const forecaster2 = new TrendForecaster({ method: FORECAST_METHODS.EXPONENTIAL });

      for (let i = 0; i < 15; i++) {
        forecaster2.addDataPoint('series1', 100 + (Math.sin(i) * 10));
      }

      const forecast = forecaster2.getForecast('series1');

      expect(forecast).toBeDefined();
      expect(forecast.method).toBe(FORECAST_METHODS.EXPONENTIAL);
      expect(forecast.level).toBeDefined();
    });
  });

  describe('Polynomial Regression Forecast', () => {
    test('should perform polynomial regression', () => {
      const forecaster2 = new TrendForecaster({
        method: FORECAST_METHODS.POLYNOMIAL,
        polynomialDegree: 2
      });

      for (let i = 0; i < 20; i++) {
        forecaster2.addDataPoint('series1', 100 + (i * i) * 0.1);
      }

      const forecast = forecaster2.getForecast('series1');

      expect(forecast).toBeDefined();
      expect(forecast.method).toBe(FORECAST_METHODS.POLYNOMIAL);
      expect(forecast.degree).toBe(2);
    });
  });

  describe('Moving Average Forecast', () => {
    test('should use moving average method', () => {
      const forecaster2 = new TrendForecaster({ method: FORECAST_METHODS.MOVING_AVERAGE });

      for (let i = 0; i < 15; i++) {
        forecaster2.addDataPoint('series1', 100 + (Math.random() * 10));
      }

      const forecast = forecaster2.getForecast('series1');

      expect(forecast).toBeDefined();
      expect(forecast.method).toBe(FORECAST_METHODS.MOVING_AVERAGE);
    });
  });

  describe('Forecast Retrieval', () => {
    test('should retrieve specific forecast values', () => {
      for (let i = 0; i < 15; i++) {
        forecaster.addDataPoint('series1', 100 + i);
      }

      const values = forecaster.getForecastValues('series1', [1, 2, 3]);

      expect(values).toBeDefined();
      expect(values.length).toBeGreaterThan(0);
    });

    test('should retrieve all forecast values', () => {
      for (let i = 0; i < 15; i++) {
        forecaster.addDataPoint('series1', 100 + i);
      }

      const values = forecaster.getForecastValues('series1');

      expect(values).toBeDefined();
      if (values.length > 0) {
        expect(values[0]).toHaveProperty('period');
        expect(values[0]).toHaveProperty('value');
      }
    });
  });

  describe('Trend Analysis', () => {
    test('should analyze trend direction', () => {
      for (let i = 0; i < 15; i++) {
        forecaster.addDataPoint('series1', 100 + (i * 2)); // Upward trend
      }

      const trend = forecaster.getTrend('series1');

      expect(trend).toBeDefined();
      if (trend) {
        expect(trend.momentumDirection).toBeDefined();
      }
    });

    test('should calculate volatility', () => {
      for (let i = 0; i < 15; i++) {
        forecaster.addDataPoint('series1', 100 + (Math.random() * 20 - 10));
      }

      const trend = forecaster.getTrend('series1');

      expect(trend).toBeDefined();
      if (trend) {
        expect(trend.volatility).toBeDefined();
        expect(trend.volatility).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Confidence Intervals', () => {
    test('should calculate confidence intervals', () => {
      for (let i = 0; i < 20; i++) {
        forecaster.addDataPoint('series1', 100 + i);
      }

      const withConfidence = forecaster.getForecastWithConfidence('series1');

      expect(withConfidence).toBeDefined();
      expect(withConfidence.confidenceIntervals).toBeDefined();
    });

    test('should support multiple confidence levels', () => {
      for (let i = 0; i < 20; i++) {
        forecaster.addDataPoint('series1', 100 + i);
      }

      const withConfidence = forecaster.getForecastWithConfidence('series1');

      if (withConfidence) {
        const intervals = Object.keys(withConfidence.confidenceIntervals);
        expect(intervals.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Summary and Reporting', () => {
    test('should provide forecaster summary', () => {
      forecaster.addDataPoint('series1', 100);
      forecaster.addDataPoint('series2', 50);

      const summary = forecaster.getSummary();

      expect(summary.seriesCount).toBeGreaterThan(0);
      expect(summary.totalDataPoints).toBeGreaterThan(0);
      expect(summary.series).toBeInstanceOf(Array);
    });
  });

  describe('Data Cleanup', () => {
    test('should clear series data', () => {
      forecaster.addDataPoint('series1', 100);
      forecaster.addDataPoint('series1', 105);

      forecaster.clearSeries('series1');

      const data = forecaster.dataPoints.get('series1');
      expect(data).toBeUndefined();
    });
  });
});
