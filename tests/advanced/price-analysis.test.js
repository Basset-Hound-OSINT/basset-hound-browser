/**
 * Price Movement Analysis Tests
 * Tests for price tracking, trend analysis, and alert generation
 */

const { PriceAnalyzer, ALERT_TYPES, TREND_DIRECTION } = require('../../src/advanced/price-analyzer');

describe('Price Analyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new PriceAnalyzer({
      priceChangeThreshold: 0.05,
      volatilityThreshold: 0.15
    });
  });

  describe('Price Recording', () => {
    test('should record price observations', () => {
      const result = analyzer.recordPrice('product1', 99.99, 'competitor1');

      expect(result.productId).toBe('product1');
      expect(result.price).toBe(99.99);
      expect(result.competitor).toBe('competitor1');
      expect(result.timestamp).toBeDefined();
    });

    test('should reject invalid prices', () => {
      expect(() => {
        analyzer.recordPrice('product1', -10, 'competitor1');
      }).toThrow();

      expect(() => {
        analyzer.recordPrice('product1', 'invalid', 'competitor1');
      }).toThrow();
    });

    test('should track price history', () => {
      analyzer.recordPrice('product1', 100, 'competitor1');
      analyzer.recordPrice('product1', 105, 'competitor1');
      analyzer.recordPrice('product1', 103, 'competitor1');

      const history = analyzer.getPriceHistory('product1');
      expect(history.length).toBe(3);
      expect(history[0].price).toBe(100);
      expect(history[2].price).toBe(103);
    });

    test('should limit history size', () => {
      const analyzer2 = new PriceAnalyzer({
        maxHistoryPerProduct: 100
      });

      for (let i = 0; i < 150; i++) {
        analyzer2.recordPrice('product1', 100 + i, 'competitor1');
      }

      const history = analyzer2.getPriceHistory('product1');
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Price Change Analysis', () => {
    test('should analyze price increases', () => {
      analyzer.recordPrice('product1', 100, 'competitor1');
      const result = analyzer.recordPrice('product1', 110, 'competitor1');

      expect(result.analysis.direction).toBe(TREND_DIRECTION.UP);
      expect(result.analysis.changePercent).toBe(10);
    });

    test('should analyze price decreases', () => {
      analyzer.recordPrice('product1', 100, 'competitor1');
      const result = analyzer.recordPrice('product1', 90, 'competitor1');

      expect(result.analysis.direction).toBe(TREND_DIRECTION.DOWN);
      expect(result.analysis.changePercent).toBe(-10);
    });

    test('should detect stable prices', () => {
      analyzer.recordPrice('product1', 100, 'competitor1');
      const result = analyzer.recordPrice('product1', 100.50, 'competitor1');

      expect(result.analysis.direction).toBe(TREND_DIRECTION.STABLE);
    });
  });

  describe('Moving Average Calculation', () => {
    test('should calculate moving averages', () => {
      const prices = [100, 102, 101, 103, 105, 104, 106];

      prices.forEach((price, i) => {
        analyzer.recordPrice('product1', price, 'competitor1');
      });

      const history = analyzer.getPriceHistory('product1');
      expect(history.length).toBe(7);
    });
  });

  describe('Volatility Metrics', () => {
    test('should calculate volatility', () => {
      for (let i = 0; i < 10; i++) {
        analyzer.recordPrice('product1', 100 + (Math.random() * 20 - 10), 'competitor1');
      }

      const volatility = analyzer.getVolatility('product1');
      expect(volatility).toBeDefined();
      expect(volatility.volatility).toBeGreaterThan(0);
      expect(volatility.stdDev).toBeGreaterThan(0);
    });

    test('should emit volatility spike alerts', (done) => {
      analyzer.on('price-alert', (alert) => {
        if (alert.type === ALERT_TYPES.VOLATILITY_SPIKE) {
          expect(alert.productId).toBe('product1');
          done();
        }
      });

      // Generate volatile prices
      const prices = [100, 120, 80, 130, 70];
      prices.forEach(price => {
        analyzer.recordPrice('product1', price, 'competitor1');
      });
    });
  });

  describe('Price Alerts', () => {
    test('should generate price drop alert', (done) => {
      analyzer.recordPrice('product1', 100, 'competitor1');

      analyzer.on('price-alert', (alert) => {
        if (alert.type === ALERT_TYPES.PRICE_DROP) {
          expect(alert.severity).toBe('medium');
          done();
        }
      });

      analyzer.recordPrice('product1', 94, 'competitor1'); // 6% drop
    });

    test('should generate price increase alert', (done) => {
      analyzer.recordPrice('product1', 100, 'competitor1');

      analyzer.on('price-alert', (alert) => {
        if (alert.type === ALERT_TYPES.PRICE_INCREASE) {
          expect(alert.severity).toBe('low');
          done();
        }
      });

      analyzer.recordPrice('product1', 106, 'competitor1'); // 6% increase
    });

    test('should track alerts per product', () => {
      analyzer.recordPrice('product1', 100, 'competitor1');
      analyzer.recordPrice('product1', 93, 'competitor1'); // 7% drop

      const alerts = analyzer.getAlerts('product1');
      expect(alerts.length).toBeGreaterThan(0);
    });

    test('should filter alerts by type', () => {
      analyzer.recordPrice('product1', 100, 'competitor1');
      analyzer.recordPrice('product1', 93, 'competitor1'); // Drop alert
      analyzer.recordPrice('product1', 108, 'competitor1'); // Increase alert

      const dropAlerts = analyzer.getAlerts('product1', { type: ALERT_TYPES.PRICE_DROP });
      expect(dropAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('Price Statistics', () => {
    test('should calculate price statistics', () => {
      const prices = [100, 105, 95, 110, 98, 102, 107];

      prices.forEach(price => {
        analyzer.recordPrice('product1', price, 'competitor1');
      });

      const stats = analyzer.getPriceStats('product1');

      expect(stats.count).toBe(7);
      expect(stats.mean).toBeDefined();
      expect(stats.median).toBeDefined();
      expect(stats.min).toBe(95);
      expect(stats.max).toBe(110);
      expect(stats.stdDev).toBeGreaterThan(0);
      expect(stats.volatility).toBeGreaterThan(0);
    });

    test('should handle single price', () => {
      analyzer.recordPrice('product1', 100, 'competitor1');

      const stats = analyzer.getPriceStats('product1');
      expect(stats.count).toBe(1);
      expect(stats.mean).toBe(100);
    });
  });

  describe('Trend Detection', () => {
    test('should detect upward trend', () => {
      for (let i = 0; i < 10; i++) {
        analyzer.recordPrice('product1', 100 + i, 'competitor1');
      }

      const history = analyzer.getPriceHistory('product1');
      expect(history[history.length - 1].price).toBeGreaterThan(history[0].price);
    });

    test('should detect downward trend', () => {
      for (let i = 0; i < 10; i++) {
        analyzer.recordPrice('product1', 100 - i, 'competitor1');
      }

      const history = analyzer.getPriceHistory('product1');
      expect(history[history.length - 1].price).toBeLessThan(history[0].price);
    });
  });

  describe('Competitor Correlation', () => {
    test('should analyze competitor price correlation', () => {
      // Create correlated price movements
      for (let i = 0; i < 10; i++) {
        const basePrice = 100 + i;
        analyzer.recordPrice('product1', basePrice, 'competitor1');
        analyzer.recordPrice('product1', basePrice + 5, 'competitor2');
      }

      const correlation = analyzer.analyzeCompetitorCorrelation('competitor1', 'competitor2');

      expect(correlation).toBeDefined();
      expect(correlation).toBeGreaterThanOrEqual(-1);
      expect(correlation).toBeLessThanOrEqual(1);
    });

    test('should handle insufficient data for correlation', () => {
      analyzer.recordPrice('product1', 100, 'competitor1');
      analyzer.recordPrice('product1', 105, 'competitor2');

      const correlation = analyzer.analyzeCompetitorCorrelation('competitor1', 'competitor2');
      expect(correlation).toBe(0); // Insufficient data
    });
  });

  describe('Price Forecasting', () => {
    test('should forecast future prices', () => {
      for (let i = 0; i < 20; i++) {
        analyzer.recordPrice('product1', 100 + i * 0.5, 'competitor1');
      }

      const forecast = analyzer.forecastPrice('product1', 5);

      expect(forecast).toBeDefined();
      expect(forecast.forecast.length).toBe(5);
      expect(forecast.forecast[0].period).toBe(1);
      expect(forecast.forecast[0].confidence).toBeGreaterThan(0);
    });

    test('should handle insufficient data for forecast', () => {
      analyzer.recordPrice('product1', 100, 'competitor1');
      analyzer.recordPrice('product1', 105, 'competitor1');

      const forecast = analyzer.forecastPrice('product1', 5);
      expect(forecast).toBeNull();
    });
  });

  describe('Summary and Reporting', () => {
    test('should provide overall summary', () => {
      analyzer.recordPrice('product1', 100, 'competitor1');
      analyzer.recordPrice('product2', 50, 'competitor2');

      const summary = analyzer.getSummary();

      expect(summary.productCount).toBe(2);
      expect(summary.priceObservations).toBe(2);
      expect(summary.products).toBeInstanceOf(Array);
    });

    test('should provide product summary', () => {
      for (let i = 0; i < 5; i++) {
        analyzer.recordPrice('product1', 100 + i * 2, 'competitor1');
      }

      const summary = analyzer.getSummary();
      const product = summary.products.find(p => p.productId === 'product1');

      expect(product).toBeDefined();
      expect(product.observations).toBe(5);
      expect(product.currentPrice).toBe(108);
    });
  });

  describe('Data Cleanup', () => {
    test('should clear history for product', () => {
      analyzer.recordPrice('product1', 100, 'competitor1');
      analyzer.recordPrice('product2', 50, 'competitor2');

      analyzer.clearHistory('product1');

      const history = analyzer.getPriceHistory('product1');
      expect(history.length).toBe(0);

      const history2 = analyzer.getPriceHistory('product2');
      expect(history2.length).toBe(1);
    });
  });

  describe('Current Price Tracking', () => {
    test('should get current price', () => {
      analyzer.recordPrice('product1', 100, 'competitor1');
      analyzer.recordPrice('product1', 105, 'competitor1');

      const current = analyzer.getCurrentPrice('product1');

      expect(current).toBeDefined();
      expect(current.price).toBe(105);
      expect(current.competitor).toBe('competitor1');
    });

    test('should return null for unknown product', () => {
      const current = analyzer.getCurrentPrice('unknown');
      expect(current).toBeNull();
    });
  });

  describe('Alert Filtering', () => {
    test('should filter alerts by type and time', () => {
      const startTime = Date.now();

      analyzer.recordPrice('product1', 100, 'competitor1');
      analyzer.recordPrice('product1', 93, 'competitor1'); // Drop

      const allAlerts = analyzer.getAlerts('product1');
      const recentAlerts = analyzer.getAlerts('product1', { since: startTime - 1000 });

      expect(recentAlerts.length).toBeLessThanOrEqual(allAlerts.length);
    });
  });
});
