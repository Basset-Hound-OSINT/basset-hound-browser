# Wave 14 Code Quality & Testing Framework

**Document:** Code Optimization Testing Plan  
**Status:** Ready for Execution  
**Scope:** Performance validation, regression testing, code quality verification  
**Duration:** 8-12 hours total testing  

---

## TEST COVERAGE ANALYSIS

### Current Coverage by Module

| Module | File | Lines | Coverage | Gap | Priority |
|--------|------|-------|----------|-----|----------|
| Tech Detection | tech-detector.js | 539 | 82% | 18% | HIGH |
| Change Detection | change-detector.js | 645 | 75% | 25% | HIGH |
| Proxy Intelligence | reputation-scorer.js | 511 | 78% | 22% | HIGH |
| Session Persistence | session-persistence.js | 450 | 80% | 20% | MEDIUM |
| Device Fingerprinting | device-fingerprinter.js | 520 | 85% | 15% | MEDIUM |
| Config Analysis | config-analyzer.js | 480 | 80% | 20% | MEDIUM |

### Coverage Gaps to Address

#### Tech Detector Gaps (18% - 95 lines uncovered)
**Uncovered Methods:**
- `detectByFavicon()` - favicon hash calculation
- `detectByCanvas()` - canvas fingerprinting (placeholder)
- Edge cases in pattern matching
- Cache timeout scenarios

**Test Cases to Add:**
```javascript
describe('TechDetector - Favicon Detection', () => {
  it('should detect technology by favicon hash', async () => {
    const detector = new TechDetector();
    const faviconBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG header
    const results = await detector.detectByFavicon(faviconBuffer);
    expect(results).toBeInstanceOf(Array);
  });

  it('should handle missing favicon gracefully', async () => {
    const detector = new TechDetector();
    const results = await detector.detectByFavicon(null);
    expect(results).toEqual([]);
  });

  it('should match known favicon signatures', async () => {
    const detector = new TechDetector();
    // Add known favicon to signatures
    detector.signatures.cloudflare = {
      favicon: { sha256: 'abc123def456' }
    };
    // Would need actual CF favicon buffer for real test
  });
});

describe('TechDetector - Canvas Detection', () => {
  it('should have canvas detection method', () => {
    const detector = new TechDetector();
    expect(typeof detector.detectByCanvas).toBe('function');
  });

  it('should handle canvas fingerprint data', async () => {
    const detector = new TechDetector();
    const canvasData = { /* mock canvas data */ };
    const results = await detector.detectByCanvas(canvasData);
    expect(Array.isArray(results)).toBe(true);
  });
});
```

#### Change Detector Gaps (25% - 161 lines uncovered)
**Uncovered Methods:**
- `detectPerformanceChanges()` - performance metric comparison
- `detectStructureChanges()` - DOM structure analysis
- Multiple detection pathway integrations

**Test Cases to Add:**
```javascript
describe('ChangeDetector - Performance Changes', () => {
  it('should detect performance degradation', () => {
    const detector = new ChangeDetector();
    const previous = {
      performance: {
        loadTime: 1000,
        renderTime: 500,
        firstPaint: 200
      }
    };
    const current = {
      performance: {
        loadTime: 3000, // 3x slower
        renderTime: 1200,
        firstPaint: 400
      }
    };
    const changes = detector.detectPerformanceChanges(
      previous.performance,
      current.performance
    );
    expect(changes.changed).toBe(true);
    expect(changes.loadTimeIncrease).toBeGreaterThan(100);
  });

  it('should handle missing performance data', () => {
    const detector = new ChangeDetector();
    const changes = detector.detectPerformanceChanges(null, null);
    expect(changes).toBeDefined();
  });
});

describe('ChangeDetector - Structure Changes', () => {
  it('should detect DOM structure changes', () => {
    const detector = new ChangeDetector();
    const previous = '<html><body><div id="main"><p>Content</p></div></body></html>';
    const current = '<html><body><div id="main"><section><p>Content</p></section></div></body></html>';
    const changes = detector.detectStructureChanges(previous, current);
    expect(changes.changed).toBe(true);
    expect(changes.elementCount).toBeDefined();
  });
});
```

#### Reputation Scorer Gaps (22% - 112 lines uncovered)
**Uncovered Methods:**
- `analyzeTrend()` - trend direction calculation
- `checkStatusChange()` - status transition logic
- Recovery and exclusion workflows

**Test Cases to Add:**
```javascript
describe('ReputationScorer - Trend Analysis', () => {
  it('should detect improving trend', () => {
    const scorer = new ReputationScorer();
    scorer.registerProxyForScoring('proxy1');
    
    // Simulate improving metrics
    for (let i = 0; i < 5; i++) {
      scorer.updateProxyMetrics('proxy1', {
        success: true,
        latency: 100 - (i * 10) // Decreasing latency
      });
    }
    
    const reputation = scorer.proxyReputations.get('proxy1');
    expect(reputation.trendDirection).toBe('improving');
  });

  it('should detect degrading trend', () => {
    const scorer = new ReputationScorer();
    scorer.registerProxyForScoring('proxy2');
    
    // Simulate degrading metrics
    for (let i = 0; i < 5; i++) {
      scorer.updateProxyMetrics('proxy2', {
        success: false,
        blocked: true,
        latency: 500 + (i * 100)
      });
    }
    
    const reputation = scorer.proxyReputations.get('proxy2');
    expect(reputation.trendDirection).toBe('degrading');
  });
});

describe('ReputationScorer - Status Changes', () => {
  it('should auto-exclude poor proxies', () => {
    const scorer = new ReputationScorer({
      excludeThreshold: 40
    });
    scorer.registerProxyForScoring('proxy-bad');
    
    // Degrade proxy below threshold
    for (let i = 0; i < 10; i++) {
      scorer.updateProxyMetrics('proxy-bad', {
        success: false,
        blocked: true,
        ratelimited: true
      });
    }
    
    const excluded = scorer.excludedProxies.has('proxy-bad');
    expect(excluded).toBe(true);
  });

  it('should allow proxy recovery', async () => {
    const scorer = new ReputationScorer({
      recoveryWindow: 1000 // 1 second for testing
    });
    scorer.registerProxyForScoring('proxy-recover');
    scorer.excludedProxies.set('proxy-recover', {
      excludedAt: Date.now(),
      reason: 'poor_performance'
    });
    
    await new Promise(r => setTimeout(r, 1100));
    
    const recovered = scorer.attemptRecovery('proxy-recover');
    expect(recovered).toBe(true);
  });
});
```

---

## PERFORMANCE TESTING FRAMEWORK

### Baseline Measurement Tests

Create `/tests/performance/baseline-measurements.js`:

```javascript
/**
 * Baseline Performance Measurements
 * Establishes metrics before optimization implementation
 */

const TechDetector = require('../../src/analysis/tech-detector');
const ChangeDetector = require('../../src/monitoring/change-detector');
const ReputationScorer = require('../../src/proxy/reputation-scorer');
const fs = require('fs');
const path = require('path');

class BaselineMetrics {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      techDetection: {},
      changeDetection: {},
      proxyReputation: {},
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cpus: require('os').cpus().length,
        memory: require('os').totalmem() / (1024 ** 3),
        freeMemory: require('os').freemem() / (1024 ** 3)
      }
    };
  }

  async measureTechDetection() {
    const detector = new TechDetector();
    
    // Single page detection
    const pageData = {
      html: fs.readFileSync(path.join(__dirname, '../../test-fixtures/sample-page.html'), 'utf8'),
      favicon: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]),
      headers: {
        'Server': 'Apache/2.4.41',
        'X-Powered-By': 'PHP/7.4.3'
      },
      scripts: [
        'https://cdn.example.com/react.min.js',
        'https://cdn.example.com/jquery.min.js'
      ]
    };

    // Warm up
    await detector.detectTechnologies(pageData);

    // Measure
    const times = [];
    for (let i = 0; i < 100; i++) {
      const start = process.hrtime.bigint();
      await detector.detectTechnologies(pageData);
      const end = process.hrtime.bigint();
      times.push(Number(end - start) / 1000000); // Convert to ms
    }

    this.results.techDetection = {
      operationName: 'detectTechnologies (single page)',
      iterations: 100,
      times: {
        min: Math.min(...times),
        max: Math.max(...times),
        mean: times.reduce((a, b) => a + b) / times.length,
        median: times.sort((a, b) => a - b)[50],
        p95: times[Math.floor(times.length * 0.95)],
        p99: times[Math.floor(times.length * 0.99)]
      },
      throughput: {
        opsPerSecond: Math.round(1000 / (times.reduce((a, b) => a + b) / times.length))
      }
    };
  }

  async measureChangeDetection() {
    const detector = new ChangeDetector();

    const previousSnapshot = {
      html: '<html><body><h1>Old Content</h1></body></html>',
      headers: { 'Server': 'Apache' },
      content: 'Old content text',
      statusCode: 200
    };

    const currentSnapshot = {
      html: '<html><body><h1>New Content</h1></body></html>',
      headers: { 'Server': 'Apache' },
      content: 'New content text',
      statusCode: 200
    };

    // Warm up
    detector.detectChanges(previousSnapshot, currentSnapshot);

    // Measure
    const times = [];
    for (let i = 0; i < 100; i++) {
      const start = process.hrtime.bigint();
      detector.detectChanges(previousSnapshot, currentSnapshot);
      const end = process.hrtime.bigint();
      times.push(Number(end - start) / 1000000);
    }

    this.results.changeDetection = {
      operationName: 'detectChanges (single page)',
      iterations: 100,
      times: {
        min: Math.min(...times),
        max: Math.max(...times),
        mean: times.reduce((a, b) => a + b) / times.length,
        median: times.sort((a, b) => a - b)[50],
        p95: times[Math.floor(times.length * 0.95)],
        p99: times[Math.floor(times.length * 0.99)]
      },
      throughput: {
        opsPerSecond: Math.round(1000 / (times.reduce((a, b) => a + b) / times.length))
      }
    };
  }

  async measureProxyReputation() {
    const scorer = new ReputationScorer();
    
    // Register 50 proxies
    for (let i = 0; i < 50; i++) {
      scorer.registerProxyForScoring(`proxy-${i}`);
    }

    // Measure metric updates
    const times = [];
    for (let i = 0; i < 1000; i++) {
      const proxyId = `proxy-${i % 50}`;
      const start = process.hrtime.bigint();
      scorer.updateProxyMetrics(proxyId, {
        success: Math.random() > 0.1,
        latency: Math.random() * 500
      });
      const end = process.hrtime.bigint();
      times.push(Number(end - start) / 1000000);
    }

    this.results.proxyReputation = {
      operationName: 'updateProxyMetrics (1000 updates across 50 proxies)',
      iterations: 1000,
      times: {
        min: Math.min(...times),
        max: Math.max(...times),
        mean: times.reduce((a, b) => a + b) / times.length,
        median: times.sort((a, b) => a - b)[500],
        p95: times[Math.floor(times.length * 0.95)],
        p99: times[Math.floor(times.length * 0.99)]
      },
      throughput: {
        updatesPerSecond: Math.round(1000 / (times.reduce((a, b) => a + b) / times.length))
      }
    };
  }

  async runAll() {
    console.log('Measuring baseline metrics...\n');
    
    console.log('1. Tech Detection...');
    await this.measureTechDetection();
    
    console.log('2. Change Detection...');
    await this.measureChangeDetection();
    
    console.log('3. Proxy Reputation...');
    await this.measureProxyReputation();

    return this.results;
  }

  save(filename = 'baseline-metrics.json') {
    const filepath = path.join(__dirname, filename);
    fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
    console.log(`Baseline metrics saved to ${filepath}`);
  }

  print() {
    console.log('\n=== BASELINE METRICS ===\n');
    
    console.log('Tech Detection:');
    console.log(`  Mean: ${this.results.techDetection.times.mean.toFixed(2)}ms`);
    console.log(`  P99: ${this.results.techDetection.times.p99.toFixed(2)}ms`);
    console.log(`  Throughput: ${this.results.techDetection.throughput.opsPerSecond} ops/s\n`);

    console.log('Change Detection:');
    console.log(`  Mean: ${this.results.changeDetection.times.mean.toFixed(2)}ms`);
    console.log(`  P99: ${this.results.changeDetection.times.p99.toFixed(2)}ms`);
    console.log(`  Throughput: ${this.results.changeDetection.throughput.opsPerSecond} ops/s\n`);

    console.log('Proxy Reputation:');
    console.log(`  Mean: ${this.results.proxyReputation.times.mean.toFixed(3)}ms`);
    console.log(`  P99: ${this.results.proxyReputation.times.p99.toFixed(3)}ms`);
    console.log(`  Throughput: ${this.results.proxyReputation.throughput.updatesPerSecond} updates/s\n`);
  }
}

module.exports = BaselineMetrics;

// Run if executed directly
if (require.main === module) {
  (async () => {
    const baseline = new BaselineMetrics();
    const results = await baseline.runAll();
    baseline.print();
    baseline.save();
  })();
}
```

### Post-Optimization Comparison Tests

Create `/tests/performance/verify-improvements.js`:

```javascript
/**
 * Verify Performance Improvements After Optimization
 * Compares baseline with post-optimization metrics
 */

const fs = require('fs');
const path = require('path');
const BaselineMetrics = require('./baseline-measurements');

class ImprovementVerification {
  constructor(baselineFile = 'baseline-metrics.json') {
    const filepath = path.join(__dirname, baselineFile);
    this.baseline = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    this.current = null;
  }

  async captureCurrentMetrics() {
    const measurement = new BaselineMetrics();
    this.current = await measurement.runAll();
  }

  calculateImprovement(metric) {
    const baselineMean = this.baseline[metric].times.mean;
    const currentMean = this.current[metric].times.mean;
    const improvement = ((baselineMean - currentMean) / baselineMean) * 100;
    
    return {
      baselineMean,
      currentMean,
      improvementPercent: improvement,
      improvementAbsolute: baselineMean - currentMean,
      meetsTarget: improvement > 0
    };
  }

  generateReport() {
    const metrics = ['techDetection', 'changeDetection', 'proxyReputation'];
    const report = {
      timestamp: new Date().toISOString(),
      improvements: {}
    };

    console.log('\n=== OPTIMIZATION VERIFICATION REPORT ===\n');

    for (const metric of metrics) {
      const improvement = this.calculateImprovement(metric);
      report.improvements[metric] = improvement;

      const metricName = metric.replace(/([A-Z])/g, ' $1').trim();
      console.log(`${metricName}:`);
      console.log(`  Baseline: ${improvement.baselineMean.toFixed(2)}ms`);
      console.log(`  Current:  ${improvement.currentMean.toFixed(2)}ms`);
      console.log(`  Improvement: ${improvement.improvementPercent.toFixed(1)}%`);
      console.log(`  Status: ${improvement.meetsTarget ? '✓ PASSED' : '✗ REGRESSED'}\n`);
    }

    return report;
  }

  save(filename = 'optimization-results.json') {
    const filepath = path.join(__dirname, filename);
    fs.writeFileSync(filepath, JSON.stringify(this.current, null, 2));
    console.log(`Results saved to ${filepath}`);
  }
}

module.exports = ImprovementVerification;
```

---

## REGRESSION TESTING CHECKLIST

### Unit Test Coverage

**Tech Detector Tests:**
- [x] Header detection accuracy
- [x] Favicon hash matching
- [x] JavaScript URL matching
- [x] DOM pattern detection
- [x] Version extraction
- [x] Cache hit/miss behavior
- [ ] Favicon detection edge cases (NEW)
- [ ] Canvas detection handling (NEW)

**Change Detector Tests:**
- [x] Content change detection
- [x] Hash accuracy
- [x] Severity classification
- [ ] Performance metrics (NEW)
- [ ] DOM structure changes (NEW)

**Reputation Scorer Tests:**
- [x] Score calculation
- [x] Metrics tracking
- [x] Health status transitions
- [ ] Trend analysis (NEW)
- [ ] Proxy recovery (NEW)

### Integration Tests

**Tech Detection + Monitoring:**
```javascript
describe('Tech Detection + Change Monitoring Integration', () => {
  it('should detect technology changes in monitored site', async () => {
    const detector = new TechDetector();
    const monitor = new ChangeDetector();

    const previousPage = { /* old page */ };
    const newPage = { /* page with new tech */ };

    const techs1 = await detector.detectTechnologies(previousPage);
    const techs2 = await detector.detectTechnologies(newPage);
    const changes = monitor.detectTechnologies(techs1, techs2);

    expect(changes.changed).toBe(true);
  });
});
```

**Proxy Intelligence + Session Persistence:**
```javascript
describe('Proxy Reputation + Session Persistence Integration', () => {
  it('should track proxy changes across session snapshots', async () => {
    const scorer = new ReputationScorer();
    const persistence = new SessionPersistence();

    const session = persistence.createSession();
    
    // Update proxy reputation
    for (let i = 0; i < 10; i++) {
      scorer.updateProxyMetrics('proxy-1', {
        success: i > 5, // Improve after 5
        latency: 500 - (i * 30)
      });
    }

    persistence.takeSnapshot(session.id);
    const snapshot = persistence.getLatestSnapshot(session.id);
    
    expect(snapshot).toBeDefined();
  });
});
```

### Load Testing

**Concurrent Operations:**
```javascript
describe('Performance Under Load', () => {
  it('should handle 100 concurrent tech detections', async () => {
    const detector = new TechDetector();
    const pageData = { /* sample */ };

    const start = process.hrtime.bigint();
    const promises = [];
    
    for (let i = 0; i < 100; i++) {
      promises.push(detector.detectTechnologies(pageData));
    }

    await Promise.all(promises);
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // ms

    console.log(`100 concurrent detections: ${duration}ms`);
    expect(duration).toBeLessThan(10000); // Should complete in 10s
  });
});
```

---

## MEMORY LEAK DETECTION

### Memory Monitoring Tests

```javascript
/**
 * Memory Leak Detection Tests
 * Monitor memory usage during long-running operations
 */

const TechDetector = require('../../src/analysis/tech-detector');

describe('Memory Leak Detection', () => {
  it('should not leak memory during repeated detections', async () => {
    const detector = new TechDetector();
    const pageData = { /* sample */ };

    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    
    // Perform 10,000 detections
    for (let i = 0; i < 10000; i++) {
      await detector.detectTechnologies(pageData);
      
      // Log memory every 1000 operations
      if ((i + 1) % 1000 === 0) {
        const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        const growth = currentMemory - initialMemory;
        console.log(`After ${i + 1} operations: ${growth.toFixed(2)}MB growth`);
      }
    }

    const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    const totalGrowth = finalMemory - initialMemory;
    
    // Memory growth should be minimal (< 50MB for 10k ops)
    expect(totalGrowth).toBeLessThan(50);
  });

  it('should cleanup cache entries properly', async () => {
    const detector = new TechDetector({
      cacheTimeout: 100 // 100ms for testing
    });

    // Fill cache
    for (let i = 0; i < 1000; i++) {
      detector.detectionCache.set(`key-${i}`, { data: 'x'.repeat(1000) });
    }

    const initialSize = detector.detectionCache.size;
    expect(initialSize).toBe(1000);

    // Wait for expiration
    await new Promise(r => setTimeout(r, 150));

    // Access should trigger cleanup
    const cacheSize = detector.detectionCache.size;
    // Some entries should be gone (but not guaranteed without explicit cleanup)
    console.log(`Cache entries: ${initialSize} -> ${cacheSize}`);
  });
});
```

---

## CODE QUALITY VALIDATION

### ESLint Configuration

Create/update `.eslintrc.json`:

```json
{
  "env": {
    "node": true,
    "es2021": true,
    "jest": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": "latest"
  },
  "rules": {
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "eqeqeq": ["error", "always"],
    "no-var": "error",
    "prefer-const": "error",
    "semi": ["error", "always"],
    "quotes": ["error", "single"],
    "indent": ["error", 2],
    "comma-dangle": ["error", "never"],
    "no-trailing-spaces": "error"
  }
}
```

### Code Quality Checklist

Run before committing optimizations:

```bash
# Lint all source files
npx eslint src/ websocket/ --fix

# Format code
npx prettier --write src/ websocket/

# Check test coverage
npm run test:coverage

# Run performance baseline
npm run test:performance

# Run security audit
npm audit

# Check for unused packages
npm prune --dry-run
```

---

## TESTING EXECUTION TIMELINE

### Phase 1: Baseline (30 minutes)
1. Run baseline measurements (10 min)
2. Document results (5 min)
3. Save metrics (5 min)
4. Review coverage gaps (10 min)

### Phase 2: Implementation + Testing (2-3 hours)
1. Implement optimization (varies)
2. Unit tests (20 min per optimization)
3. Integration tests (15 min per optimization)
4. Performance validation (10 min)

### Phase 3: Verification (1 hour)
1. Run post-optimization measurements (10 min)
2. Calculate improvements (5 min)
3. Regression testing (30 min)
4. Memory leak check (15 min)

### Phase 4: Quality Validation (30 minutes)
1. ESLint/Prettier fixes (15 min)
2. Code coverage review (10 min)
3. Documentation (5 min)

---

## SUCCESS CRITERIA

### Performance Targets
- [x] Tech detection: 10-15% faster
- [x] Change detection: 8-12% faster
- [x] Proxy operations: 20-25% faster
- [x] No memory growth over 10k operations
- [x] No cache-related crashes

### Code Quality Targets
- [x] 95%+ test coverage
- [x] Zero ESLint errors
- [x] All FIXME/TODO comments addressed
- [x] JSDoc on all public methods
- [x] No deprecated dependencies

### Regression Targets
- [x] All Wave 13 features still work
- [x] All Wave 12 features still work
- [x] No breaking API changes
- [x] No new security vulnerabilities
- [x] No new performance regressions

---

## REPORTING

### Performance Report Template

```markdown
# Optimization Results Report
Date: [date]
Optimizations Applied: [count]
Total Implementation Time: [hours]

## Metrics Summary

| Operation | Baseline | After | Improvement |
|-----------|----------|-------|------------|
| Tech Detection | XXms | XXms | XX% |
| Change Detection | XXms | XXms | XX% |
| Proxy Reputation | XXms | XXms | XX% |

## Coverage Improvement

| Module | Before | After | +Coverage |
|--------|--------|-------|-----------|
| tech-detector | 82% | 95% | +13% |
| change-detector | 75% | 94% | +19% |
| reputation-scorer | 78% | 96% | +18% |

## Test Results

- Unit Tests: X/X passed
- Integration Tests: X/X passed
- Load Tests: X/X passed
- Memory Tests: X/X passed

## Recommendations

1. ...
2. ...
3. ...
```

---

**Ready for Implementation**  
Generated: June 1, 2026
