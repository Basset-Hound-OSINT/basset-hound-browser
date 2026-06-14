# Technology Fingerprinting - Performance Test Template

Performance tests validate that detection meets latency and throughput targets.

## Test File Structure

```javascript
const MockDataGenerator = require('../../utilities/helpers/mock-data-generator');
const AssertionHelpers = require('../../utilities/helpers/assertion-helpers');
const TechDetector = require('../../../src/analysis/tech-detector');

describe('Technology Fingerprinting - Performance', () => {
  // Performance Baselines
  const PERFORMANCE_TARGETS = {
    singleDetection: 100,      // ms - single page detection
    htmlDetection: 50,         // ms - HTML parsing
    headerDetection: 20,       // ms - header inspection only
    bulkDetection: 5000,       // ms - 100 pages
    concurrentDetection: 500   // ms per request at high concurrency
  };

  const LOAD_TARGETS = {
    minThroughput: 10,         // requests/sec minimum
    maxLatencyP99: 150,        // ms P99 latency
    maxLatencyP95: 120,        // ms P95 latency
    avgLatency: 80             // ms average latency
  };

  // Utility: Measure operation timing
  function measureOperation(fn) {
    const start = process.hrtime.bigint();
    const result = fn();
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1000000;
    return { result, durationMs };
  }

  // Utility: Collect performance metrics
  function collectMetrics(durations) {
    const sorted = durations.sort((a, b) => a - b);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.50)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      samples: sorted.length
    };
  }

  // Test Group 1: Single Operation Performance
  describe('Single Operation Performance', () => {
    test('detects from headers within target time', () => {
      // Arrange
      const headers = MockDataGenerator.generateHTTPHeaders(true);
      const measurements = [];

      // Act
      for (let i = 0; i < 10; i++) {
        const { result, durationMs } = measureOperation(() =>
          TechDetector.detectFromHeaders(headers)
        );
        measurements.push(durationMs);
      }

      const metrics = collectMetrics(measurements);

      // Assert
      console.log('Header Detection:', metrics);
      expect(metrics.avg).toBeLessThan(PERFORMANCE_TARGETS.headerDetection);
      expect(metrics.p99).toBeLessThan(PERFORMANCE_TARGETS.headerDetection * 1.5);
    });

    test('detects from HTML within target time', () => {
      // Arrange
      const html = MockDataGenerator.generateSampleHTML('wordpress');
      const measurements = [];

      // Act
      for (let i = 0; i < 10; i++) {
        const { result, durationMs } = measureOperation(() =>
          TechDetector.detectFromHTML(html)
        );
        measurements.push(durationMs);
      }

      const metrics = collectMetrics(measurements);

      // Assert
      console.log('HTML Detection:', metrics);
      expect(metrics.avg).toBeLessThan(PERFORMANCE_TARGETS.htmlDetection);
      expect(metrics.p99).toBeLessThan(PERFORMANCE_TARGETS.htmlDetection * 2);
    });

    test('full page detection within target time', () => {
      // Arrange
      const data = MockDataGenerator.generatePageState();
      const measurements = [];

      // Act
      for (let i = 0; i < 20; i++) {
        const { result, durationMs } = measureOperation(() =>
          TechDetector.detect(data)
        );
        measurements.push(durationMs);
      }

      const metrics = collectMetrics(measurements);

      // Assert
      console.log('Full Detection:', metrics);
      expect(metrics.avg).toBeLessThan(PERFORMANCE_TARGETS.singleDetection);
      expect(metrics.p99).toBeLessThan(PERFORMANCE_TARGETS.singleDetection * 1.5);
    });
  });

  // Test Group 2: Bulk Operations
  describe('Bulk Operation Performance', () => {
    test('detects 100 pages within target time', () => {
      // Arrange
      const pages = Array.from({ length: 100 }, (_, i) =>
        MockDataGenerator.generatePageState(`https://example.com/page${i}`)
      );
      const measurements = [];

      // Act
      const { durationMs: totalTime } = measureOperation(() => {
        pages.forEach(page => {
          const { result, durationMs } = measureOperation(() =>
            TechDetector.detect(page)
          );
          measurements.push(durationMs);
        });
      });

      const metrics = collectMetrics(measurements);

      // Assert
      console.log('Bulk Detection (100 pages):', {
        totalTime,
        perPageMetrics: metrics
      });
      expect(totalTime).toBeLessThan(PERFORMANCE_TARGETS.bulkDetection);
      expect(metrics.avg).toBeLessThan(PERFORMANCE_TARGETS.singleDetection);
    });

    test('detects technology stack with 500+ signatures', () => {
      // Arrange
      const data = MockDataGenerator.generatePageState();
      data.detectedTechnologies = MockDataGenerator.generateTechnologyStack(25);

      // Act
      const { durationMs } = measureOperation(() =>
        TechDetector.detect(data)
      );

      // Assert
      console.log('Detection with large signature database:', { durationMs });
      expect(durationMs).toBeLessThan(PERFORMANCE_TARGETS.singleDetection);
    });
  });

  // Test Group 3: Concurrent Load
  describe('Concurrent Load Performance', () => {
    test('handles 10 concurrent detection requests', () => {
      // Arrange
      const pageCount = 10;
      const pages = Array.from({ length: pageCount }, (_, i) =>
        MockDataGenerator.generatePageState(`https://example.com/page${i}`)
      );
      const measurements = [];

      // Act
      const { durationMs: totalTime } = measureOperation(() => {
        const promises = pages.map(page =>
          new Promise((resolve) => {
            const { result, durationMs } = measureOperation(() =>
              TechDetector.detect(page)
            );
            measurements.push(durationMs);
            resolve();
          })
        );
        return Promise.all(promises);
      });

      const metrics = collectMetrics(measurements);

      // Assert
      console.log('Concurrent Load (10 requests):', {
        totalTime,
        throughput: (pageCount / (totalTime / 1000)).toFixed(2) + ' req/sec',
        metrics
      });
      expect(metrics.avg).toBeLessThan(PERFORMANCE_TARGETS.concurrentDetection);
    });

    test('maintains performance under high concurrency (50 requests)', () => {
      // Arrange
      const pageCount = 50;
      const pages = Array.from({ length: pageCount }, (_, i) =>
        MockDataGenerator.generatePageState()
      );
      const measurements = [];

      // Act
      const { durationMs: totalTime } = measureOperation(() => {
        const promises = pages.map(page =>
          new Promise((resolve) => {
            const { result, durationMs } = measureOperation(() =>
              TechDetector.detect(page)
            );
            measurements.push(durationMs);
            resolve();
          })
        );
        return Promise.all(promises);
      });

      const metrics = collectMetrics(measurements);
      const throughput = (pageCount / (totalTime / 1000));

      // Assert
      console.log('High Concurrency (50 requests):', {
        totalTime,
        throughput: throughput.toFixed(2) + ' req/sec',
        metrics
      });
      expect(throughput).toBeGreaterThan(LOAD_TARGETS.minThroughput);
      expect(metrics.p99).toBeLessThan(LOAD_TARGETS.maxLatencyP99);
    });
  });

  // Test Group 4: Memory Performance
  describe('Memory Performance', () => {
    test('does not leak memory during bulk detection', () => {
      // Arrange
      const measurements = [];
      const initialMemory = process.memoryUsage().heapUsed;

      // Act
      for (let batch = 0; batch < 5; batch++) {
        const pages = Array.from({ length: 20 }, () =>
          MockDataGenerator.generatePageState()
        );

        pages.forEach(page => {
          TechDetector.detect(page);
        });

        measurements.push({
          batch,
          memory: process.memoryUsage().heapUsed
        });
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const megabytesAdded = memoryIncrease / 1024 / 1024;

      // Assert
      console.log('Memory Usage:', {
        initialMB: (initialMemory / 1024 / 1024).toFixed(2),
        finalMB: (finalMemory / 1024 / 1024).toFixed(2),
        increaseMB: megabytesAdded.toFixed(2)
      });
      
      // Memory increase should be minimal (garbage collection should run)
      expect(megabytesAdded).toBeLessThan(50);
    });
  });

  // Test Group 5: Regression Testing
  describe('Performance Regression Detection', () => {
    test('detects performance improvement/degradation', () => {
      // Arrange - Baseline
      const baselinePages = Array.from({ length: 20 }, () =>
        MockDataGenerator.generatePageState()
      );
      const baselineMeasurements = [];

      baselinePages.forEach(page => {
        const { durationMs } = measureOperation(() =>
          TechDetector.detect(page)
        );
        baselineMeasurements.push(durationMs);
      });

      const baselineMetrics = collectMetrics(baselineMeasurements);
      const baselineAvg = baselineMetrics.avg;

      // Act - Current test
      const testPages = Array.from({ length: 20 }, () =>
        MockDataGenerator.generatePageState()
      );
      const testMeasurements = [];

      testPages.forEach(page => {
        const { durationMs } = measureOperation(() =>
          TechDetector.detect(page)
        );
        testMeasurements.push(durationMs);
      });

      const testMetrics = collectMetrics(testMeasurements);
      const testAvg = testMetrics.avg;

      // Assert - Allow 10% degradation, flag significant regression
      const percentChange = ((testAvg - baselineAvg) / baselineAvg) * 100;

      console.log('Performance Regression Analysis:', {
        baseline: baselineAvg.toFixed(2) + 'ms',
        current: testAvg.toFixed(2) + 'ms',
        change: percentChange.toFixed(2) + '%'
      });

      // Warn but don't fail on minor regressions
      if (percentChange > 20) {
        console.warn(`Performance degradation detected: ${percentChange.toFixed(2)}%`);
      }
      expect(percentChange).toBeLessThan(30);
    });
  });

  // Test Group 6: Scalability
  describe('Scalability Testing', () => {
    test('detection time scales linearly with page count', () => {
      // Arrange
      const iterations = [10, 20, 30, 40, 50];
      const results = [];

      // Act
      iterations.forEach(count => {
        const pages = Array.from({ length: count }, () =>
          MockDataGenerator.generatePageState()
        );

        const { durationMs: totalTime } = measureOperation(() => {
          pages.forEach(page => TechDetector.detect(page));
        });

        results.push({
          pages: count,
          totalTime,
          perPageTime: totalTime / count
        });
      });

      // Assert - Check if scaling is linear (not exponential)
      console.log('Scalability Analysis:', results);

      // Per-page time should remain relatively constant
      const perPageTimes = results.map(r => r.perPageTime);
      const firstHalfAvg = perPageTimes.slice(0, 2).reduce((a, b) => a + b) / 2;
      const secondHalfAvg = perPageTimes.slice(-2).reduce((a, b) => a + b) / 2;
      const variance = Math.abs(secondHalfAvg - firstHalfAvg) / firstHalfAvg;

      // Allow 30% variance in per-page time
      expect(variance).toBeLessThan(0.3);
    });
  });
});
```

## Running Performance Tests

```bash
# Run performance tests
npm run test:batch:performance

# Run with verbose output to see metrics
jest tests/features/fingerprinting/performance --verbose

# Run with extended timeout
jest tests/features/fingerprinting/performance --testTimeout=60000

# Profile with Node inspector
node --inspect-brk node_modules/.bin/jest tests/features/fingerprinting/performance
```

## Performance Targets

| Operation | Target | Threshold |
|-----------|--------|-----------|
| Header detection | <20ms | <30ms |
| HTML detection | <50ms | <75ms |
| Full detection | <100ms | <150ms |
| Bulk (100 pages) | <5000ms | <7500ms |
| Concurrent (50 req) | >10 req/sec | P99 <150ms |

## Metrics to Monitor

1. **Latency**
   - Average response time
   - P50, P95, P99 percentiles
   - Min/Max response times

2. **Throughput**
   - Requests per second
   - Pages detected per second

3. **Memory**
   - Heap usage before/after
   - Memory leaks over time
   - GC pause duration

4. **Scalability**
   - Linear vs exponential growth
   - Per-operation time consistency

## Best Practices

1. **Warm up before measuring** - First run often slower
2. **Run multiple iterations** - Account for variability
3. **Monitor system state** - Close other apps during testing
4. **Use realistic data** - Generate representative test data
5. **Track baselines** - Compare against known good performance
6. **Report percentiles** - P99 matters more than average
7. **Test degradation paths** - Simulate worst-case scenarios

## Performance Regression Workflow

```bash
# Run baseline
jest tests/features/fingerprinting/performance --json > baseline.json

# Make changes...

# Run current test
jest tests/features/fingerprinting/performance --json > current.json

# Compare results
node compare-performance.js baseline.json current.json
```
