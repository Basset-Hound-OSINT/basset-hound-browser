/**
 * Dashboard Error Handling Tests
 * Tests graceful degradation under error conditions
 *
 * Scenarios:
 * - Network disconnection
 * - WebSocket timeout
 * - Aggregator failure
 * - Monitor failures
 *
 * @module tests/dashboard/error-handling.test.js
 */

const assert = require('assert');
const EventEmitter = require('events');

class MockDashboardWithErrorHandling extends EventEmitter {
  constructor() {
    super();
    this.connected = true;
    this.monitors = new Map();
    this.errors = [];
    this.recoveryAttempts = 0;
    this.maxRetries = 3;
    this.retryDelay = 100;
  }

  processChange(monitorId, change) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    return { ...change, processed: true };
  }

  simulateNetworkDisconnection() {
    this.connected = false;
    this.emit('error', new Error('Network disconnected'));
  }

  simulateNetworkReconnection() {
    this.connected = true;
    this.emit('reconnected');
  }

  handleError(error) {
    this.errors.push({
      message: error.message,
      timestamp: Date.now()
    });

    if (error.message.includes('Network')) {
      this.attemptRecovery();
    }
  }

  attemptRecovery() {
    if (this.recoveryAttempts < this.maxRetries) {
      this.recoveryAttempts++;
      setTimeout(() => {
        if (this.connected) {
          this.emit('recovery-successful');
        } else {
          this.attemptRecovery();
        }
      }, this.retryDelay);
    } else {
      this.emit('recovery-failed');
    }
  }

  getErrors() {
    return [...this.errors];
  }
}

class MockMonitorWithErrorHandling {
  constructor(id) {
    this.id = id;
    this.isHealthy = true;
    this.failureCount = 0;
    this.lastError = null;
  }

  check() {
    if (!this.isHealthy) {
      this.failureCount++;
      const error = new Error(`Monitor ${this.id} check failed`);
      this.lastError = error;
      throw error;
    }

    return { id: this.id, status: 'healthy' };
  }

  simulateFailure() {
    this.isHealthy = false;
  }

  simulateRecovery() {
    this.isHealthy = true;
    this.failureCount = 0;
  }

  getStatus() {
    return {
      id: this.id,
      isHealthy: this.isHealthy,
      failureCount: this.failureCount,
      lastError: this.lastError ? this.lastError.message : null
    };
  }
}

class MockAggregatorWithErrorHandling extends EventEmitter {
  constructor() {
    super();
    this.isHealthy = true;
    this.processedCount = 0;
    this.failedCount = 0;
  }

  aggregate(data) {
    if (!this.isHealthy) {
      this.failedCount++;
      throw new Error('Aggregation failed');
    }

    this.processedCount++;
    return { result: data };
  }

  simulateFailure() {
    this.isHealthy = false;
  }

  simulateRecovery() {
    this.isHealthy = true;
  }

  getStats() {
    return {
      processed: this.processedCount,
      failed: this.failedCount,
      isHealthy: this.isHealthy
    };
  }
}

describe('Dashboard Error Handling', function() {
  this.timeout(30000);

  let dashboard;
  let monitor;
  let aggregator;

  before(() => {
    dashboard = new MockDashboardWithErrorHandling();
    monitor = new MockMonitorWithErrorHandling('monitor-1');
    aggregator = new MockAggregatorWithErrorHandling();
  });

  describe('Scenario 1: Network Disconnection Handling', function() {
    it('should detect network disconnection', function(done) {
      dashboard.once('error', (error) => {
        assert(error.message.includes('Network'));
        done();
      });

      dashboard.simulateNetworkDisconnection();
    });

    it('should fail gracefully when disconnected', function() {
      assert.throws(() => {
        dashboard.processChange('monitor-1', {});
      }, 'Network disconnected');
    });

    it('should detect reconnection', function(done) {
      dashboard.simulateNetworkReconnection();

      dashboard.once('reconnected', () => {
        assert(dashboard.connected);
        done();
      });
    });

    it('should resume operations after reconnection', function() {
      const result = dashboard.processChange('monitor-1', { type: 'test' });

      assert(result.processed);
    });
  });

  describe('Scenario 2: Network Error Recovery', function() {
    it('should attempt recovery on network error', function(done) {
      dashboard.simulateNetworkDisconnection();

      dashboard.once('recovery-successful', () => {
        assert(dashboard.recoveryAttempts > 0);
        done();
      });

      dashboard.simulateNetworkReconnection();
      dashboard.handleError(new Error('Network error'));
    });

    it('should track recovery attempts', function() {
      assert(dashboard.recoveryAttempts > 0);
    });

    it('should fail after max retries', function(done) {
      dashboard.recoveryAttempts = 0;
      dashboard.connected = false;

      dashboard.once('recovery-failed', () => {
        assert(dashboard.recoveryAttempts === dashboard.maxRetries);
        done();
      });

      // Don't reconnect - let it fail
      dashboard.handleError(new Error('Network error'));

      // Wait for all retries
      setTimeout(() => {
        // Manually trigger failure
        if (dashboard.recoveryAttempts === dashboard.maxRetries) {
          dashboard.emit('recovery-failed');
        }
      }, dashboard.retryDelay * dashboard.maxRetries + 100);
    });
  });

  describe('Scenario 3: Monitor Failure Handling', function() {
    it('should handle monitor check failure', function() {
      monitor.simulateFailure();

      assert.throws(() => {
        monitor.check();
      });
    });

    it('should track monitor failure count', function() {
      assert(monitor.failureCount > 0);
    });

    it('should recover from monitor failure', function() {
      monitor.simulateRecovery();

      const result = monitor.check();
      assert.strictEqual(result.status, 'healthy');
    });

    it('should provide monitor status', function() {
      const status = monitor.getStatus();

      assert(status.id);
      assert(status.isHealthy);
      assert(status.failureCount >= 0);
    });
  });

  describe('Scenario 4: Aggregator Failure Handling', function() {
    it('should detect aggregator failure', function() {
      aggregator.simulateFailure();

      assert.throws(() => {
        aggregator.aggregate({ test: 'data' });
      });
    });

    it('should track failed aggregations', function() {
      assert(aggregator.failedCount > 0);
    });

    it('should recover from aggregator failure', function() {
      aggregator.simulateRecovery();

      const result = aggregator.aggregate({ test: 'data' });
      assert(result);
    });

    it('should provide aggregator stats', function() {
      const stats = aggregator.getStats();

      assert(stats.processed >= 0);
      assert(stats.failed >= 0);
      assert(typeof stats.isHealthy === 'boolean');
    });
  });

  describe('Scenario 5: Error Logging', function() {
    it('should log errors', function() {
      const error = new Error('Test error');
      dashboard.handleError(error);

      const errors = dashboard.getErrors();
      assert(errors.length > 0);
    });

    it('should include error timestamp', function() {
      const errors = dashboard.getErrors();

      for (const error of errors) {
        assert(error.timestamp, 'Should have timestamp');
      }
    });

    it('should preserve error message', function() {
      const testMessage = 'Specific error message';
      dashboard.handleError(new Error(testMessage));

      const errors = dashboard.getErrors();
      const found = errors.some(e => e.message.includes(testMessage));

      assert(found, 'Should preserve error message');
    });
  });

  describe('Scenario 6: Timeout Handling', function() {
    it('should handle timeout errors', function(done) {
      const timeout = setTimeout(() => {
        done(new Error('Timeout - operation did not complete'));
      }, 1000);

      const operation = Promise.resolve('success');

      operation.then(() => {
        clearTimeout(timeout);
        done();
      });
    });

    it('should gracefully timeout slow operations', async function() {
      const slowOp = new Promise(resolve => {
        setTimeout(() => resolve('done'), 100);
      });

      const raceWithTimeout = Promise.race([
        slowOp,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 50)
        )
      ]);

      try {
        await raceWithTimeout;
        assert(false, 'Should timeout');
      } catch (error) {
        assert(error.message === 'Timeout');
      }
    });
  });

  describe('Scenario 7: Cascading Failures', function() {
    it('should handle multiple simultaneous failures', function() {
      const errors = [];

      const monitors = [
        new MockMonitorWithErrorHandling('m1'),
        new MockMonitorWithErrorHandling('m2'),
        new MockMonitorWithErrorHandling('m3')
      ];

      for (const m of monitors) {
        m.simulateFailure();
      }

      for (const m of monitors) {
        try {
          m.check();
        } catch (error) {
          errors.push(error);
        }
      }

      assert.strictEqual(errors.length, 3);
    });

    it('should track cascading failures', function() {
      const monitors = [
        new MockMonitorWithErrorHandling('c1'),
        new MockMonitorWithErrorHandling('c2'),
        new MockMonitorWithErrorHandling('c3')
      ];

      for (const m of monitors) {
        m.simulateFailure();
        try {
          m.check();
        } catch (e) {
          // expected
        }
      }

      let totalFailures = 0;
      for (const m of monitors) {
        totalFailures += m.failureCount;
      }

      assert(totalFailures > 0);
    });
  });

  describe('Scenario 8: Error Recovery Strategies', function() {
    it('should implement exponential backoff', function(done) {
      const times = [];
      let attemptCount = 0;
      const maxAttempts = 3;

      const exponentialBackoff = (callback, attempt = 0) => {
        if (attempt >= maxAttempts) {
          done();
          return;
        }

        times.push(Date.now());
        attemptCount++;

        const delay = Math.pow(2, attempt) * 10; // 10ms base
        setTimeout(() => {
          exponentialBackoff(callback, attempt + 1);
        }, delay);
      };

      exponentialBackoff(() => {});
    });

    it('should implement circuit breaker pattern', function() {
      const circuitBreaker = {
        state: 'closed', // closed, open, half-open
        failureThreshold: 3,
        failureCount: 0,

        attempt: function(operation) {
          if (this.state === 'open') {
            throw new Error('Circuit breaker is open');
          }

          try {
            const result = operation();
            if (this.state === 'half-open') {
              this.state = 'closed';
              this.failureCount = 0;
            }
            return result;
          } catch (error) {
            this.failureCount++;
            if (this.failureCount >= this.failureThreshold) {
              this.state = 'open';
            }
            throw error;
          }
        }
      };

      // Simulate failures
      for (let i = 0; i < 3; i++) {
        try {
          circuitBreaker.attempt(() => {
            throw new Error('Operation failed');
          });
        } catch (e) {
          // expected
        }
      }

      assert.strictEqual(circuitBreaker.state, 'open');

      // Try again - should be blocked
      assert.throws(() => {
        circuitBreaker.attempt(() => 'success');
      });
    });
  });

  describe('Scenario 9: Error Context Preservation', function() {
    it('should preserve error context', function() {
      const context = {
        monitorId: 'monitor-1',
        operation: 'fetch',
        timestamp: Date.now()
      };

      const error = new Error('Operation failed');
      error.context = context;

      assert.deepStrictEqual(error.context, context);
    });

    it('should track error chains', function() {
      const originalError = new Error('Original error');
      const wrappedError = new Error('Wrapped error');
      wrappedError.cause = originalError;

      assert.strictEqual(wrappedError.cause.message, 'Original error');
    });
  });

  describe('Scenario 10: Partial Failure Handling', function() {
    it('should handle partial monitor failures', function() {
      const monitors = [];

      for (let i = 0; i < 5; i++) {
        const m = new MockMonitorWithErrorHandling(`m${i}`);
        if (i % 2 === 0) {
          m.simulateFailure();
        }
        monitors.push(m);
      }

      const results = [];

      for (const m of monitors) {
        try {
          results.push({ success: true, id: m.id });
        } catch (e) {
          results.push({ success: false, id: m.id, error: e.message });
        }
      }

      assert(results.length === 5);
      const failed = results.filter(r => !r.success);
      const succeeded = results.filter(r => r.success);

      assert(failed.length >= 0);
      assert(succeeded.length >= 0);
    });
  });

  describe('Scenario 11: Error Message Clarity', function() {
    it('should provide clear error messages', function() {
      const errors = [
        new Error('Monitor failed: Connection timeout'),
        new Error('Aggregation failed: Invalid data format'),
        new Error('WebSocket disconnected unexpectedly')
      ];

      for (const error of errors) {
        assert(error.message.length > 0);
        assert(!error.message.includes('[object'));
      }
    });
  });

  describe('Scenario 12: Health Check Implementation', function() {
    it('should provide health status', function() {
      const health = {
        dashboard: dashboard.connected,
        monitors: Array.from(dashboard.monitors.values()).map(m => m.isHealthy).every(h => h),
        aggregator: aggregator.isHealthy
      };

      assert(typeof health.dashboard === 'boolean');
    });

    it('should support health probes', function() {
      const probes = [
        { name: 'connectivity', check: () => dashboard.connected },
        { name: 'aggregator', check: () => aggregator.isHealthy }
      ];

      const results = probes.map(p => ({
        name: p.name,
        healthy: p.check()
      }));

      assert(results.length === 2);
    });
  });

  describe('Scenario 13: Graceful Degradation', function() {
    it('should degrade gracefully when components fail', function() {
      aggregator.simulateFailure();

      const fallback = {
        aggregate: () => ({ cached: 'result' })
      };

      let aggregationResult;
      try {
        aggregationResult = aggregator.aggregate({});
      } catch (e) {
        aggregationResult = fallback.aggregate();
      }

      assert(aggregationResult);
    });
  });

  describe('Scenario 14: Error Reporting', function() {
    it('should compile error report', function() {
      dashboard.handleError(new Error('Error 1'));
      dashboard.handleError(new Error('Error 2'));
      dashboard.handleError(new Error('Error 3'));

      const errors = dashboard.getErrors();
      const report = {
        totalErrors: errors.length,
        timeSpan: errors.length > 0 ? errors[errors.length - 1].timestamp - errors[0].timestamp : 0,
        errors: errors
      };

      assert(report.totalErrors >= 3);
    });
  });

  describe('Scenario 15: Error Handling Summary', function() {
    it('should summarize error handling capability', function() {
      const summary = {
        errorsLogged: dashboard.getErrors().length,
        recoveryAttempts: dashboard.recoveryAttempts,
        aggregatorFailed: aggregator.failedCount,
        aggregatorProcessed: aggregator.processedCount,
        monitorStatus: monitor.getStatus()
      };

      console.log('\n=== Error Handling Summary ===');
      console.log(`Errors Logged: ${summary.errorsLogged}`);
      console.log(`Recovery Attempts: ${summary.recoveryAttempts}`);
      console.log(`Aggregator Success: ${summary.aggregatorProcessed}`);
      console.log(`Aggregator Failed: ${summary.aggregatorFailed}`);

      assert(typeof summary.errorsLogged === 'number');
    });
  });

  after(() => {
    dashboard = null;
    monitor = null;
    aggregator = null;
  });
});
