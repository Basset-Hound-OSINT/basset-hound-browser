# Monitoring v12.2.0 - Advanced Features Implementation Guide

**Date:** June 13, 2026  
**Status:** READY FOR DEVELOPMENT  
**Audience:** Developers implementing monitoring enhancements

---

## Quick Start Reference

### File Structure
```
src/monitoring/
├── pattern-detector.js              (NEW) 400-500 lines
├── predictive-scheduler.js          (NEW) 300-350 lines
├── distributed-coordinator.js       (NEW) 600-700 lines
├── failover-manager.js              (NEW) 400-450 lines
├── load-balancer.js                 (NEW) 350-400 lines
├── alert-engine.js                  (NEW) 450-500 lines
├── escalation-coordinator.js        (NEW) 500-550 lines
├── alert-thresholds.js              (NEW) 250-300 lines
├── trend-analyzer.js                (NEW) 400-450 lines
├── anomaly-detector.js              (NEW) 400-450 lines
├── correlation-analyzer.js          (NEW) 400-450 lines
├── report-generator.js              (NEW) 500-550 lines
│
├── monitoring-coordinator.js        (MODIFY) Add component references
├── monitor-scheduler.js             (REVIEW) No changes needed
├── target-monitor.js                (REVIEW) No changes needed
│
├── alert-router.js                  (EXISTING)
├── alert-dispatcher.js              (EXISTING)
└── health-checker.js                (EXISTING)

websocket/commands/
├── monitoring-continuous.js         (MODIFY) Add new commands
└── monitoring-commands.js           (REVIEW) Compatibility

tests/monitoring/
├── pattern-detector.test.js         (NEW)
├── predictive-scheduler.test.js     (NEW)
├── distributed-coordinator.test.js  (NEW)
├── failover-manager.test.js         (NEW)
├── alert-engine.test.js             (NEW)
├── escalation-coordinator.test.js   (NEW)
├── trend-analyzer.test.js           (NEW)
├── anomaly-detector.test.js         (NEW)
├── correlation-analyzer.test.js     (NEW)
└── report-generator.test.js         (NEW)
```

---

## Module Development Order

**Recommended sequence** (dependencies flow downward):

1. **pattern-detector.js** - No dependencies, foundational
2. **predictive-scheduler.js** - Depends on pattern-detector
3. **trend-analyzer.js** - Standalone analytics
4. **anomaly-detector.js** - Depends on trend analysis concepts
5. **correlation-analyzer.js** - Standalone analytics
6. **alert-thresholds.js** - Configuration module
7. **alert-engine.js** - Depends on alert-thresholds
8. **escalation-coordinator.js** - Depends on alert-engine
9. **load-balancer.js** - Standalone algorithm module
10. **distributed-coordinator.js** - Depends on load-balancer
11. **failover-manager.js** - Depends on distributed-coordinator
12. **report-generator.js** - Depends on all analytics modules

---

## Core Code Patterns

### Pattern 1: EventEmitter Base Class

All new modules should extend EventEmitter:

```javascript
const EventEmitter = require('events');

class MyModule extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Default options
      ...options
    };
    
    // Initialize state
    this.state = {};
    
    this._initialize();
  }

  _initialize() {
    // Setup code
  }

  // Public methods...
}

module.exports = { MyModule };
```

### Pattern 2: Configuration Validation

```javascript
_validateOptions() {
  const required = ['param1', 'param2'];
  const missing = required.filter(p => !this.options[p]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required options: ${missing.join(', ')}`);
  }
  
  if (this.options.threshold < 0 || this.options.threshold > 1) {
    throw new Error('Threshold must be between 0 and 1');
  }
}
```

### Pattern 3: Data Structure Limits

Prevent memory bloat with sliding windows:

```javascript
recordDataPoint(id, data) {
  if (!this.dataWindow.has(id)) {
    this.dataWindow.set(id, []);
  }
  
  const window = this.dataWindow.get(id);
  window.push({
    timestamp: Date.now(),
    ...data
  });
  
  // Keep window size bounded
  if (window.length > this.options.maxWindowSize) {
    window.shift(); // Remove oldest
  }
}
```

### Pattern 4: Event Emission with Context

```javascript
emitChange(targetId, data) {
  this.emit('change-detected', {
    targetId,
    data,
    timestamp: Date.now(),
    source: this.constructor.name,
    version: '1.0'
  });
}
```

### Pattern 5: Error Handling in Async Methods

```javascript
async performOperation(targetId) {
  try {
    const result = await this.browserApi.getPage(targetId);
    return {
      success: true,
      data: result,
      timestamp: Date.now()
    };
  } catch (error) {
    this.emit('operation-error', {
      targetId,
      error: error.message,
      stack: error.stack,
      timestamp: Date.now()
    });
    
    return {
      success: false,
      error: error.message,
      targetId
    };
  }
}
```

---

## Detailed Implementation Examples

### Example 1: Pattern Detector

```javascript
/**
 * Pattern Detector - ML-free pattern learning
 * @module src/monitoring/pattern-detector.js
 */

const EventEmitter = require('events');

class PatternDetector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      windowSize: options.windowSize || 30,
      hourlyBins: 24,
      minHistoryRequired: options.minHistoryRequired || 20,
      confidenceThreshold: options.confidenceThreshold || 0.7,
      entropyThreshold: options.entropyThreshold || 0.3,
      updateInterval: options.updateInterval || 3600000 // 1 hour
    };

    // Data: targetId -> {window: [{timestamp, changed, score}], ...]}
    this.targetPatterns = new Map();
    this.confidenceScores = new Map();
    
    // Update patterns periodically
    this.updateTimer = setInterval(() => {
      this._updateAllPatterns();
    }, this.options.updateInterval);
  }

  recordCheckResult(targetId, result) {
    if (!this.targetPatterns.has(targetId)) {
      this.targetPatterns.set(targetId, {
        window: [],
        hourlyBins: new Array(24).fill(null).map(() => ({
          changes: 0,
          total: 0
        })),
        weeklyBins: new Array(7).fill(null).map(() => ({
          changes: 0,
          total: 0
        }))
      });
    }

    const pattern = this.targetPatterns.get(targetId);
    const timestamp = result.timestamp || Date.now();
    const date = new Date(timestamp);
    const hour = date.getHours();
    const day = date.getDay();

    // Add to window
    pattern.window.push({
      timestamp,
      changed: result.changed || false,
      score: result.changeScore || 0
    });

    // Update hourly bin
    pattern.hourlyBins[hour].total++;
    if (result.changed) {
      pattern.hourlyBins[hour].changes++;
    }

    // Update weekly bin
    pattern.weeklyBins[day].total++;
    if (result.changed) {
      pattern.weeklyBins[day].changes++;
    }

    // Prune old entries
    const cutoff = Date.now() - (this.options.windowSize * 86400000);
    pattern.window = pattern.window.filter(e => e.timestamp > cutoff);
  }

  getPrediction(targetId, context = {}) {
    const pattern = this.targetPatterns.get(targetId);
    
    if (!pattern || pattern.window.length < this.options.minHistoryRequired) {
      return {
        shouldSkip: false,
        confidence: 0,
        reasoning: 'Insufficient history',
        entropyScore: null,
        historicalChangeRate: null
      };
    }

    const hour = context.currentHour || new Date().getHours();
    const day = context.dayOfWeek || new Date().getDay();

    // Calculate change rate for this hour
    const hourlyBin = pattern.hourlyBins[hour];
    const hourChangeRate = hourlyBin.total > 0 
      ? hourlyBin.changes / hourlyBin.total 
      : 0;

    // Calculate entropy
    const entropy = this._calculateEntropy(pattern);

    // Confidence is based on entropy (low entropy = predictable = high confidence)
    const confidence = Math.max(0, 1 - entropy);

    // Recommendation logic
    const shouldSkip = confidence > this.options.confidenceThreshold 
      && hourChangeRate < 0.1;  // Skip if very stable hour

    return {
      shouldSkip,
      confidence,
      reasoning: shouldSkip 
        ? `Low activity expected at ${hour}:00 on ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]}`
        : `Activity expected at ${hour}:00`,
      entropyScore: entropy,
      historicalChangeRate: hourChangeRate,
      hourDistribution: pattern.hourlyBins.map(b => 
        b.total > 0 ? b.changes / b.total : 0
      )
    };
  }

  getPatternAnalysis(targetId) {
    const pattern = this.targetPatterns.get(targetId);
    if (!pattern) {
      return null;
    }

    const entropy = this._calculateEntropy(pattern);
    const hourDistribution = pattern.hourlyBins.map(b => 
      b.total > 0 ? b.changes / b.total : 0
    );
    const weekDistribution = pattern.weeklyBins.map(b => 
      b.total > 0 ? b.changes / b.total : 0
    );

    return {
      hourlyDistribution: hourDistribution,
      weeklyDistribution: weekDistribution,
      entropyScore: entropy,
      predictability: entropy < 0.3 ? 'HIGH' : entropy < 0.6 ? 'MEDIUM' : 'LOW',
      confidenceByHour: hourDistribution.map((rate, hour) => ({
        hour,
        changeRate: rate,
        confidence: 1 - entropy
      })),
      recommendedSkips: this._getSkipCandidates(pattern),
      datapointCount: pattern.window.length
    };
  }

  _calculateEntropy(pattern) {
    const distribution = pattern.hourlyBins.map(b => 
      b.total > 0 ? b.changes / b.total : 0
    );
    
    // Shannon entropy: -sum(p * log(p))
    let entropy = 0;
    distribution.forEach(p => {
      if (p > 0 && p < 1) {
        entropy -= p * Math.log2(p) + (1 - p) * Math.log2(1 - p);
      }
    });
    
    // Normalize to 0-1
    return Math.min(1, entropy / 8); // Max entropy for binary is 1.0
  }

  _getSkipCandidates(pattern) {
    const candidates = [];
    pattern.hourlyBins.forEach((bin, hour) => {
      if (bin.total > 0) {
        const changeRate = bin.changes / bin.total;
        if (changeRate < 0.05) {
          candidates.push({
            hour,
            changeRate,
            reason: 'Very stable hour'
          });
        }
      }
    });
    return candidates;
  }

  _updateAllPatterns() {
    this.emit('patterns-updated', {
      timestamp: Date.now(),
      targetCount: this.targetPatterns.size
    });
  }

  stop() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
  }
}

module.exports = { PatternDetector };
```

### Example 2: Distributed Coordinator

```javascript
/**
 * Distributed Coordinator - Multi-instance monitoring
 * @module src/monitoring/distributed-coordinator.js
 */

const EventEmitter = require('events');

const BALANCING_STRATEGY = {
  ROUND_ROBIN: 'round-robin',
  LOAD_AWARE: 'load-aware',
  AFFINITY: 'affinity'
};

class DistributedCoordinator extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      healthCheckInterval: options.healthCheckInterval || 10000,
      failureThreshold: options.failureThreshold || 3,
      rebalanceThreshold: options.rebalanceThreshold || 0.15,
      balancingStrategy: options.balancingStrategy || BALANCING_STRATEGY.LOAD_AWARE,
      ...options
    };

    this.instances = new Map(); // instanceId -> {state, config, metrics}
    this.targets = new Map();   // targetId -> {instanceId, config}
    this.assignment = new Map(); // instanceId -> [targetIds]
    this.healthCheckTimer = null;
  }

  registerInstance(instanceId, config) {
    if (this.instances.has(instanceId)) {
      return {
        success: false,
        error: 'Instance already registered',
        instanceId
      };
    }

    this.instances.set(instanceId, {
      id: instanceId,
      state: 'registering',
      hostname: config.hostname,
      port: config.port,
      maxTargets: config.maxTargets || 25,
      capabilities: config.capabilities || [],
      metrics: {
        targetCount: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        lastHealthCheck: null,
        failureCount: 0
      },
      created: Date.now()
    });

    this.assignment.set(instanceId, []);

    this.emit('instance-registered', { instanceId, config });

    return { success: true, instanceId };
  }

  registerTarget(targetId, config) {
    this.targets.set(targetId, {
      id: targetId,
      url: config.url,
      priority: config.priority,
      affinity: config.affinity, // Preferred instance
      config
    });

    this.emit('target-registered', { targetId });
    return { success: true, targetId };
  }

  getAssignment() {
    const assignment = {};
    for (const [instanceId, targetIds] of this.assignment) {
      assignment[instanceId] = targetIds;
    }
    return assignment;
  }

  assignTargets() {
    const unassigned = Array.from(this.targets.keys()).filter(
      targetId => !this._isAssigned(targetId)
    );

    for (const targetId of unassigned) {
      const instanceId = this._selectInstance(targetId);
      if (instanceId) {
        const targets = this.assignment.get(instanceId);
        targets.push(targetId);
        this.targets.get(targetId).assignedTo = instanceId;
      }
    }

    this.emit('targets-assigned', {
      assigned: unassigned.length,
      timestamp: Date.now()
    });
  }

  _selectInstance(targetId) {
    const target = this.targets.get(targetId);
    const healthyInstances = Array.from(this.instances.values())
      .filter(i => i.state === 'healthy');

    if (healthyInstances.length === 0) {
      return null;
    }

    // Affinity check
    if (target.affinity) {
      const preferred = this.instances.get(target.affinity);
      if (preferred && preferred.state === 'healthy') {
        const targets = this.assignment.get(target.affinity);
        if (targets.length < preferred.maxTargets) {
          return target.affinity;
        }
      }
    }

    // Load-aware selection
    if (this.options.balancingStrategy === BALANCING_STRATEGY.LOAD_AWARE) {
      let minLoad = Infinity;
      let selected = null;
      
      for (const instance of healthyInstances) {
        const targets = this.assignment.get(instance.id);
        const load = targets.length / instance.maxTargets;
        if (load < minLoad) {
          minLoad = load;
          selected = instance.id;
        }
      }
      
      return selected;
    }

    // Round-robin
    return healthyInstances[0]?.id || null;
  }

  _isAssigned(targetId) {
    const target = this.targets.get(targetId);
    return target && target.assignedTo;
  }

  start() {
    if (this.healthCheckTimer) return;

    this.healthCheckTimer = setInterval(async () => {
      await this._performHealthChecks();
    }, this.options.healthCheckInterval);

    this.emit('coordinator-started', { timestamp: Date.now() });
  }

  async _performHealthChecks() {
    for (const [instanceId, instance] of this.instances) {
      try {
        // TODO: Implement actual health check (HTTP request)
        instance.metrics.lastHealthCheck = Date.now();
        instance.state = 'healthy';
        instance.metrics.failureCount = 0;
      } catch (error) {
        instance.metrics.failureCount++;
        
        if (instance.metrics.failureCount >= this.options.failureThreshold) {
          instance.state = 'unhealthy';
          this.emit('instance-unhealthy', {
            instanceId,
            reason: error.message,
            failureCount: instance.metrics.failureCount
          });
          
          // Reassign targets
          this._reassignTargets(instanceId);
        }
      }
    }
  }

  _reassignTargets(unhealthyInstanceId) {
    const targets = this.assignment.get(unhealthyInstanceId) || [];
    this.assignment.set(unhealthyInstanceId, []);

    for (const targetId of targets) {
      const newInstanceId = this._selectInstance(targetId);
      if (newInstanceId) {
        this.assignment.get(newInstanceId).push(targetId);
        this.targets.get(targetId).assignedTo = newInstanceId;
      }
    }

    this.emit('targets-reassigned', {
      from: unhealthyInstanceId,
      count: targets.length,
      timestamp: Date.now()
    });
  }

  getStatus() {
    const instances = {};
    for (const [id, instance] of this.instances) {
      instances[id] = {
        state: instance.state,
        targetCount: (this.assignment.get(id) || []).length,
        maxTargets: instance.maxTargets,
        metrics: instance.metrics
      };
    }

    return {
      instances,
      totalTargets: this.targets.size,
      totalAssigned: Array.from(this.assignment.values())
        .reduce((sum, targets) => sum + targets.length, 0),
      strategy: this.options.balancingStrategy,
      timestamp: Date.now()
    };
  }

  stop() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
}

module.exports = {
  DistributedCoordinator,
  BALANCING_STRATEGY
};
```

### Example 3: Alert Engine

```javascript
/**
 * Alert Engine - Real-time threshold evaluation
 * @module src/monitoring/alert-engine.js
 */

const EventEmitter = require('events');
const crypto = require('crypto');

const ALERT_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

class AlertEngine extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      deduplicationWindow: options.deduplicationWindow || 300000,
      aggregationWindow: options.aggregationWindow || 60000,
      enableAlerts: options.enableAlerts !== false,
      ...options
    };

    this.thresholds = new Map();
    this.sentAlerts = new Map(); // For deduplication
    this.alertQueue = [];
    this.stats = {
      totalAlerts: 0,
      byType: {},
      bySeverity: {},
      deduplicatedCount: 0,
      aggregatedCount: 0
    };
  }

  setAlertThreshold(type, config) {
    this.thresholds.set(type, {
      type,
      enabled: config.enabled !== false,
      severity: config.severity || ALERT_SEVERITY.MEDIUM,
      ...config
    });
  }

  evaluateChange(targetId, changeData) {
    if (!this.options.enableAlerts) {
      return { shouldAlert: false, alerts: [] };
    }

    const alerts = [];

    // Check each threshold
    for (const [type, threshold] of this.thresholds) {
      if (!threshold.enabled) continue;

      const alert = this._evaluateThreshold(targetId, type, threshold, changeData);
      if (alert) {
        alerts.push(alert);
      }
    }

    // Deduplication
    const uniqueAlerts = [];
    for (const alert of alerts) {
      if (!this._isDuplicate(alert)) {
        uniqueAlerts.push(alert);
        this._recordSentAlert(alert);
      } else {
        this.stats.deduplicatedCount++;
      }
    }

    // Update stats
    for (const alert of uniqueAlerts) {
      this.stats.totalAlerts++;
      if (!this.stats.byType[alert.type]) {
        this.stats.byType[alert.type] = 0;
      }
      this.stats.byType[alert.type]++;
      
      if (!this.stats.bySeverity[alert.severity]) {
        this.stats.bySeverity[alert.severity] = 0;
      }
      this.stats.bySeverity[alert.severity]++;
    }

    return {
      shouldAlert: uniqueAlerts.length > 0,
      alerts: uniqueAlerts,
      deduplicated: alerts.length > uniqueAlerts.length
    };
  }

  _evaluateThreshold(targetId, type, threshold, data) {
    switch (type) {
      case 'content-change':
        if (data.changeScore > (threshold.minChangeScore || 0.5)) {
          return this._createAlert(targetId, type, threshold, {
            changeScore: data.changeScore,
            reason: 'Content changed significantly'
          });
        }
        break;

      case 'status-code':
        if (threshold.statusCodes && 
            threshold.statusCodes.includes(data.statusCode)) {
          return this._createAlert(targetId, type, threshold, {
            statusCode: data.statusCode,
            reason: `HTTP ${data.statusCode} returned`
          });
        }
        break;

      case 'technology-change':
        if (data.changeTypes && data.changeTypes.includes('TECHNOLOGY')) {
          return this._createAlert(targetId, type, threshold, {
            changeTypes: data.changeTypes,
            reason: 'Technology stack changed'
          });
        }
        break;
    }

    return null;
  }

  _createAlert(targetId, type, threshold, context) {
    return {
      id: 'alert-' + crypto.randomBytes(6).toString('hex'),
      targetId,
      type,
      severity: threshold.severity,
      message: threshold.message || `Alert: ${type}`,
      context,
      timestamp: Date.now(),
      hash: null // Set by _recordSentAlert
    };
  }

  _isDuplicate(alert) {
    const hash = this._hashAlert(alert);
    alert.hash = hash;

    if (this.sentAlerts.has(hash)) {
      const lastAlert = this.sentAlerts.get(hash);
      const age = Date.now() - lastAlert.timestamp;
      return age < this.options.deduplicationWindow;
    }

    return false;
  }

  _recordSentAlert(alert) {
    this.sentAlerts.set(alert.hash, alert);

    // Cleanup old entries
    for (const [hash, sent] of this.sentAlerts) {
      if (Date.now() - sent.timestamp > this.options.deduplicationWindow) {
        this.sentAlerts.delete(hash);
      }
    }
  }

  _hashAlert(alert) {
    return crypto
      .createHash('sha256')
      .update(`${alert.targetId}:${alert.type}:${alert.severity}`)
      .digest('hex');
  }

  getAlertStats() {
    return {
      totalAlerts: this.stats.totalAlerts,
      byType: { ...this.stats.byType },
      bySeverity: { ...this.stats.bySeverity },
      deduplicatedCount: this.stats.deduplicatedCount,
      aggregatedCount: this.stats.aggregatedCount
    };
  }
}

module.exports = {
  AlertEngine,
  ALERT_SEVERITY
};
```

---

## Testing Patterns

### Unit Test Template

```javascript
const { describe, it, expect, beforeEach, afterEach } = require('mocha');
const { MyModule } = require('../src/monitoring/my-module');

describe('MyModule', () => {
  let module;

  beforeEach(() => {
    module = new MyModule({
      option1: 'value1',
      option2: 'value2'
    });
  });

  afterEach(() => {
    module.stop?.();
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      expect(module.options).to.exist;
      expect(module.options.option1).to.equal('value1');
    });

    it('should validate required options', () => {
      expect(() => new MyModule({ /* missing required */ }))
        .to.throw('Missing required options');
    });
  });

  describe('Core Functionality', () => {
    it('should perform operation correctly', async () => {
      const result = await module.performOperation('target-1');
      expect(result.success).to.be.true;
      expect(result.data).to.exist;
    });

    it('should emit events on operation', (done) => {
      module.on('operation-complete', (data) => {
        expect(data.targetId).to.equal('target-1');
        done();
      });

      module.performOperation('target-1');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const result = await module.performOperation(null); // Invalid
      expect(result.success).to.be.false;
      expect(result.error).to.exist;
    });

    it('should emit error events', (done) => {
      module.on('operation-error', (data) => {
        expect(data.error).to.exist;
        done();
      });

      module.performOperation(null);
    });
  });
});
```

---

## Performance Optimization Tips

### 1. Map vs Object
```javascript
// Use Map for dynamic keys, Object for fixed keys
const dynamicConfig = new Map(); // Good for targetId -> config
const fixedMetrics = {           // Good for metric names
  cpu: 0,
  memory: 0,
  targets: 0
};
```

### 2. Batch Processing
```javascript
// Bad: Update stats per alert
alerts.forEach(alert => {
  this.stats.total++;
  this.stats[alert.severity]++;
});

// Good: Batch update
const counts = { total: 0, high: 0, medium: 0, low: 0 };
alerts.forEach(alert => {
  counts.total++;
  counts[alert.severity]++;
});
Object.assign(this.stats, counts);
```

### 3. Lazy Evaluation
```javascript
// Only calculate expensive operations when needed
getComplexMetrics() {
  if (this._cachedMetrics && this._cacheAge < 60000) {
    return this._cachedMetrics;
  }
  
  this._cachedMetrics = this._calculateMetrics();
  this._cacheAge = Date.now();
  return this._cachedMetrics;
}
```

---

## Integration Checklist

Before integrating each module:

- [ ] Unit tests pass (>90% coverage)
- [ ] No ESLint warnings
- [ ] Proper JSDoc comments
- [ ] Error handling for all error paths
- [ ] Memory bounds enforced (no unbounded growth)
- [ ] Events properly typed and documented
- [ ] Dependencies clearly listed
- [ ] Performance meets target (<10ms per operation)
- [ ] Backward compatibility verified
- [ ] Configuration schema documented

---

## Common Gotchas & Solutions

### Gotcha 1: Unbounded Data Growth
```javascript
// Problem: Window grows forever
this.data.push(newPoint);

// Solution: Enforce window size limit
if (this.data.length > this.maxWindowSize) {
  this.data = this.data.slice(-this.maxWindowSize);
}
```

### Gotcha 2: Timer Leaks
```javascript
// Problem: Timer never cleared
this.timer = setInterval(() => { ... }, 5000);

// Solution: Always clear in stop()
stop() {
  if (this.timer) {
    clearInterval(this.timer);
    this.timer = null;
  }
}
```

### Gotcha 3: Event Listener Leaks
```javascript
// Problem: Listeners accumulate
this.monitor.on('change', this.handler);

// Solution: Remove listeners on cleanup
stop() {
  this.monitor.removeListener('change', this.handler);
}
```

### Gotcha 4: Async Race Conditions
```javascript
// Problem: Results overwrite each other
async processTarget(targetId) {
  const data1 = await fetch1(targetId);
  const data2 = await fetch2(targetId);
  this.results[targetId] = data1; // May be stale!
}

// Solution: Validate data is still relevant
async processTarget(targetId) {
  const startTime = Date.now();
  const data1 = await fetch1(targetId);
  const data2 = await fetch2(targetId);
  
  if (this.lastFetch[targetId] > startTime) {
    return; // Newer request already started
  }
  
  this.results[targetId] = data1;
}
```

---

## File Size Targets

Respect these line count targets to keep modules focused:

| Module | Target | Why |
|--------|--------|-----|
| pattern-detector.js | 400-500 | Standalone algorithm |
| predictive-scheduler.js | 300-350 | Thin wrapper |
| distributed-coordinator.js | 600-700 | Complex state management |
| failover-manager.js | 400-450 | State machine |
| load-balancer.js | 350-400 | Algorithm implementation |
| alert-engine.js | 450-500 | Multi-threshold evaluation |
| escalation-coordinator.js | 500-550 | Complex state machine |
| alert-thresholds.js | 250-300 | Configuration module |
| trend-analyzer.js | 400-450 | Time series analysis |
| anomaly-detector.js | 400-450 | Statistical analysis |
| correlation-analyzer.js | 400-450 | Relationship analysis |
| report-generator.js | 500-550 | Complex export logic |

If a module exceeds its target:
1. Extract helper functions to separate utility files
2. Split complex logic into smaller private methods
3. Consider refactoring into multiple smaller modules

---

## Documentation Requirements

Every module needs:

1. **Module-level JSDoc** (top of file)
   ```javascript
   /**
    * Module description
    * @module src/monitoring/module-name
    * @requires events
    */
   ```

2. **Class documentation**
   ```javascript
   /**
    * ClassName description
    * Constructor options: { ... }
    */
   class ClassName extends EventEmitter {
   ```

3. **Public method documentation**
   ```javascript
   /**
    * Method description
    * @param {type} paramName - Description
    * @returns {type} Description
    */
   methodName(paramName) {
   ```

4. **Event documentation** (at end of module)
   ```javascript
   /**
    * Events emitted by this module:
    * - 'event-name' - Description
    * - 'another-event' - Description
    */
   ```

---

## Deployment Validation

After implementation, verify:

1. **No Circular Dependencies**
   ```bash
   npm ls --depth=0  # Check for conflicts
   ```

2. **Code Quality**
   ```bash
   npm run lint      # ESLint check
   npm run test      # Run test suite
   npm run coverage  # Verify >90% coverage
   ```

3. **Performance Baseline**
   ```bash
   npm run benchmark # Measure module performance
   ```

4. **Memory Profiling**
   ```bash
   node --inspect app.js  # Use Chrome DevTools
   ```

---

## References

- **Existing Code:** Review `src/monitoring/` for patterns
- **WebSocket Integration:** See `websocket/commands/monitoring-continuous.js`
- **Test Examples:** Check `tests/monitoring/` for test patterns
- **Configuration:** See `src/config/` for configuration patterns

---

**End of Implementation Guide**
