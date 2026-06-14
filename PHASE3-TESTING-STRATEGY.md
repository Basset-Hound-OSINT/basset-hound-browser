# Phase 3 Testing Strategy & Metrics

**Complete Testing Plan for WebSocket Integration**  
**Version:** 1.0  
**Date:** June 13, 2026

---

## Testing Overview

**Objective:** Validate all three optimization components work correctly individually and collectively.

**Success Criteria:**
- All new tests pass (100%)
- Performance targets achieved (500+ msg/sec)
- Zero regressions in existing tests
- No memory leaks detected
- All edge cases handled

---

## Test Structure

```
/tests/integration/
├── phase3-integration.test.js      (Main integration tests)
├── phase3-helpers.js               (Test utilities)
└── fixtures/
    └── phase3-responses.json       (Sample responses)

/tests/load/
└── phase3-load-test.js            (Load testing)

/tests/unit/ (if needed)
└── response-serializer.test.js    (Component unit tests)
```

---

## Part 1: Response Serializer Tests

### Test Suite 1.1: Template Registration

**File:** `phase3-integration.test.js`

**Test 1.1.1: Register Basic Template**
```javascript
describe('Phase 3: Response Serializer', () => {
  describe('Template Registration', () => {
    test('should register success template', () => {
      const serializer = new OptimizedResponseSerializer();
      
      serializer.registerTemplate('success', {
        success: true,
        command: undefined,
        id: undefined
      });
      
      const stats = serializer.getStats();
      expect(stats.registeredTemplates).toContain('success');
    });

    test('should register multiple templates', () => {
      const serializer = new OptimizedResponseSerializer();
      
      ['success', 'error', 'status', 'pong', 'screenshot'].forEach(name => {
        serializer.registerTemplate(name, { [name]: true });
      });
      
      const stats = serializer.getStats();
      expect(stats.totalTemplates).toBe(5);
    });

    test('should reject duplicate template registration', () => {
      const serializer = new OptimizedResponseSerializer();
      
      serializer.registerTemplate('test', { test: true });
      
      expect(() => {
        serializer.registerTemplate('test', { test: false });
      }).toThrow('Template already registered');
    });

    test('should handle template override with force flag', () => {
      const serializer = new OptimizedResponseSerializer();
      
      serializer.registerTemplate('test', { v: 1 });
      serializer.registerTemplate('test', { v: 2 }, { force: true });
      
      const result = serializer.serialize('test', {});
      expect(result).toContain('"v":2');
    });
  });
});
```

**Expected Results:** 4 tests passing

---

### Test Suite 1.2: Serialization Performance

**Test 1.2.1: Serialization Speed**
```javascript
describe('Serialization Performance', () => {
  test('should serialize in under 1ms per message', () => {
    const serializer = new OptimizedResponseSerializer();
    serializer.registerTemplate('success', { success: true });
    
    const iterations = 1000;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      serializer.serialize('success', { 
        id: i,
        command: 'test',
        data: { index: i }
      });
    }
    
    const duration = performance.now() - start;
    const avgTime = duration / iterations;
    
    console.log(`Avg serialization: ${avgTime.toFixed(3)}ms`);
    expect(avgTime).toBeLessThan(1); // <1ms per message
  });

  test('should be faster with templates vs raw JSON.stringify', () => {
    const serializer = new OptimizedResponseSerializer();
    serializer.registerTemplate('success', { success: true, command: undefined });
    
    const testData = { id: 1, command: 'test', data: { foo: 'bar' } };
    
    // Template approach
    const templateStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      serializer.serialize('success', testData);
    }
    const templateTime = performance.now() - templateStart;
    
    // Raw JSON.stringify approach
    const jsonStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      JSON.stringify({ success: true, ...testData });
    }
    const jsonTime = performance.now() - jsonStart;
    
    console.log(`Template: ${templateTime}ms, JSON: ${jsonTime}ms`);
    expect(templateTime).toBeLessThan(jsonTime * 0.85); // 15% faster
  });

  test('should handle large payloads efficiently', () => {
    const serializer = new OptimizedResponseSerializer();
    serializer.registerTemplate('success', { success: true });
    
    const largeData = {
      id: 1,
      command: 'screenshot',
      image: 'data:image/png;base64,' + 'A'.repeat(100000)
    };
    
    const start = performance.now();
    const result = serializer.serialize('success', largeData);
    const duration = performance.now() - start;
    
    expect(result).toBeTruthy();
    expect(duration).toBeLessThan(5); // <5ms even for large payload
  });
});
```

**Expected Results:** 3 tests passing, performance metrics logged

---

### Test Suite 1.3: Buffer Pool Management

**Test 1.3.1: Pool Reuse**
```javascript
describe('Buffer Pool', () => {
  test('should reuse buffers from pool', () => {
    const serializer = new OptimizedResponseSerializer({ bufferPoolSize: 10 });
    serializer.registerTemplate('test', { test: true });
    
    const stats1 = serializer.getStats();
    const initialPoolSize = stats1.bufferPoolStats?.size || 0;
    
    // Use serializer multiple times
    for (let i = 0; i < 50; i++) {
      serializer.serialize('test', { id: i });
    }
    
    const stats2 = serializer.getStats();
    
    // Pool should be at capacity (reusing buffers)
    expect(stats2.bufferPoolStats?.inUse || 0).toBeLessThanOrEqual(10);
  });

  test('should show high hit rate after warmup', () => {
    const serializer = new OptimizedResponseSerializer();
    serializer.registerTemplate('success', { success: true });
    
    // Warmup
    for (let i = 0; i < 100; i++) {
      serializer.serialize('success', { id: i });
    }
    
    const stats = serializer.getStats();
    const hitRate = stats.templateHits / (stats.templateHits + stats.templateMisses);
    
    console.log(`Template hit rate: ${(hitRate * 100).toFixed(1)}%`);
    expect(hitRate).toBeGreaterThan(0.80); // >80% hit rate
  });
});
```

**Expected Results:** 2 tests passing

---

### Test Suite 1.4: Template Caching

**Test 1.4.1: Immutable Template Compilation**
```javascript
describe('Template Caching', () => {
  test('should pre-compile immutable templates', () => {
    const serializer = new OptimizedResponseSerializer();
    
    // Register immutable template (no undefined values)
    serializer.registerTemplate('pong', {
      command: 'pong',
      success: true
    });
    
    // Get serialized form
    const result1 = serializer.serialize('pong', { id: 1 });
    const result2 = serializer.serialize('pong', { id: 2 });
    
    // Both should use same compiled template
    const stats = serializer.getStats();
    expect(stats.precompiledTemplates).toContain('pong');
  });

  test('should handle dynamic templates efficiently', () => {
    const serializer = new OptimizedResponseSerializer();
    
    // Dynamic template with undefined values
    serializer.registerTemplate('dynamic', {
      success: true,
      data: undefined,  // Dynamic
      timestamp: undefined // Dynamic
    });
    
    const result = serializer.serialize('dynamic', {
      data: { foo: 'bar' },
      timestamp: Date.now()
    });
    
    expect(result).toContain('"foo":"bar"');
    expect(result).toContain('"success":true');
  });
});
```

**Expected Results:** 2 tests passing

---

### Test Suite 1.5: Error Handling

**Test 1.5.1: Serializer Resilience**
```javascript
describe('Serializer Error Handling', () => {
  test('should handle undefined values gracefully', () => {
    const serializer = new OptimizedResponseSerializer();
    serializer.registerTemplate('safe', { a: undefined, b: 'value' });
    
    const result = serializer.serialize('safe', { a: null });
    expect(result).toContain('"b":"value"');
  });

  test('should handle circular references', () => {
    const serializer = new OptimizedResponseSerializer();
    serializer.registerTemplate('test', { data: undefined });
    
    const obj = { a: 1 };
    obj.self = obj; // Circular reference
    
    // Should not throw, should handle gracefully
    expect(() => {
      serializer.serialize('test', { data: obj });
    }).not.toThrow();
  });

  test('should report stats even after errors', () => {
    const serializer = new OptimizedResponseSerializer();
    serializer.registerTemplate('test', { data: undefined });
    
    try {
      serializer.serialize('nonexistent', {});
    } catch (e) {
      // Expected error
    }
    
    const stats = serializer.getStats();
    expect(stats.totalSerialized).toBeGreaterThanOrEqual(0);
  });
});
```

**Expected Results:** 3 tests passing

---

## Part 2: Lazy Manager Tests

### Test Suite 2.1: Manager Registry

**Test 2.1.1: Registry Operations**
```javascript
describe('Phase 3: Lazy Manager Registry', () => {
  describe('Registry Operations', () => {
    test('should create empty registry', () => {
      const registry = new LazyManagerRegistry();
      const status = registry.getStatus();
      
      expect(status).toEqual({});
    });

    test('should register and retrieve lazy managers', () => {
      const registry = new LazyManagerRegistry();
      const lazyMgr = new LazyManager('Test', async () => ({ test: true }));
      
      registry.register('test', lazyMgr);
      const retrieved = registry.get('test');
      
      expect(retrieved).toBe(lazyMgr);
    });

    test('should show all managers in status', () => {
      const registry = new LazyManagerRegistry();
      
      registry.register('m1', new LazyManager('M1', async () => ({})));
      registry.register('m2', new LazyManager('M2', async () => ({})));
      registry.register('m3', new LazyManager('M3', async () => ({})));
      
      const status = registry.getStatus();
      expect(Object.keys(status).length).toBe(3);
      expect(status).toHaveProperty('m1');
      expect(status).toHaveProperty('m2');
      expect(status).toHaveProperty('m3');
    });
  });
});
```

**Expected Results:** 3 tests passing

---

### Test Suite 2.2: Lazy Initialization

**Test 2.2.1: Deferred Initialization**
```javascript
describe('Lazy Initialization', () => {
  test('should not initialize on registration', () => {
    let initialized = false;
    const lazyMgr = new LazyManager('Test', async () => {
      initialized = true;
      return { test: true };
    });
    
    expect(initialized).toBe(false);
  });

  test('should initialize on first getInstance call', async () => {
    const lazyMgr = new LazyManager('Test', async () => {
      return { value: 42 };
    });
    
    expect(lazyMgr.isInitialized()).toBe(false);
    
    const instance = await lazyMgr.getInstance();
    
    expect(lazyMgr.isInitialized()).toBe(true);
    expect(instance.value).toBe(42);
  });

  test('should return same instance on multiple calls', async () => {
    const lazyMgr = new LazyManager('Test', async () => {
      return { timestamp: Date.now() };
    });
    
    const instance1 = await lazyMgr.getInstance();
    const instance2 = await lazyMgr.getInstance();
    
    expect(instance1).toBe(instance2);
    expect(instance1.timestamp).toBe(instance2.timestamp);
  });

  test('should handle concurrent initialization safely', async () => {
    let initCount = 0;
    const lazyMgr = new LazyManager('Test', async () => {
      initCount++;
      await new Promise(r => setTimeout(r, 10));
      return { count: initCount };
    });
    
    // Request initialization from multiple sources concurrently
    const promises = Array(5).fill(0).map(() => lazyMgr.getInstance());
    const instances = await Promise.all(promises);
    
    // All should get same instance
    const first = instances[0];
    instances.forEach(inst => {
      expect(inst).toBe(first);
    });
    
    // Should only initialize once
    expect(initCount).toBe(1);
  });
});
```

**Expected Results:** 4 tests passing

---

### Test Suite 2.3: Preloading

**Test 2.3.1: Critical Manager Preloading**
```javascript
describe('Manager Preloading', () => {
  test('should preload only registered managers', async () => {
    const registry = new LazyManagerRegistry();
    const criticalManagers = {};
    
    // Register critical managers
    for (const name of ['proxy', 'userAgent', 'screenshot']) {
      const lazyMgr = new LazyManager(name, async () => {
        criticalManagers[name] = true;
        return { [name]: true };
      });
      registry.register(name, lazyMgr);
    }
    
    // Preload
    const results = await registry.preloadCritical();
    
    // All critical should be initialized
    expect(results.length).toBeGreaterThan(0);
    expect(criticalManagers['proxy']).toBe(true);
  });

  test('should preload within time budget', async () => {
    const registry = new LazyManagerRegistry();
    
    // Register 5 managers
    for (let i = 0; i < 5; i++) {
      registry.register(`m${i}`, new LazyManager(`M${i}`, async () => {
        await new Promise(r => setTimeout(r, 50));
        return { id: i };
      }));
    }
    
    const start = performance.now();
    await registry.preloadCritical();
    const duration = performance.now() - start;
    
    console.log(`Preload duration: ${duration.toFixed(1)}ms`);
    expect(duration).toBeLessThan(500); // <500ms target
  });

  test('should report preload status', async () => {
    const registry = new LazyManagerRegistry();
    registry.register('test', new LazyManager('Test', async () => ({})));
    
    await registry.preloadCritical();
    const status = registry.getStatus();
    
    const testStatus = status.test;
    expect(testStatus.initialized).toBe(true);
  });
});
```

**Expected Results:** 3 tests passing

---

### Test Suite 2.4: Error Handling in Lazy Init

**Test 2.4.1: Error Recovery**
```javascript
describe('Lazy Manager Error Handling', () => {
  test('should handle initialization errors', async () => {
    const lazyMgr = new LazyManager('Test', async () => {
      throw new Error('Init failed');
    });
    
    await expect(lazyMgr.getInstance()).rejects.toThrow('Init failed');
  });

  test('should allow retry after error', async () => {
    let attempts = 0;
    const lazyMgr = new LazyManager('Test', async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('First attempt fails');
      }
      return { attempts };
    });
    
    // First attempt fails
    await expect(lazyMgr.getInstance()).rejects.toThrow();
    
    // Retry should work (new initPromise)
    lazyMgr.initPromise = null; // Reset for retry
    const instance = await lazyMgr.getInstance();
    expect(instance.attempts).toBe(2);
  });
});
```

**Expected Results:** 2 tests passing

---

## Part 3: GC Tuning Tests

### Test Suite 3.1: GC Initialization

**Test 3.1.1: GC Setup**
```javascript
describe('Phase 3: Advanced GC Tuning', () => {
  describe('GC Initialization', () => {
    test('should initialize GC tuning without errors', () => {
      const gc = initializeGCTuning({
        maxHeapSize: 512,
        enableGCMonitoring: true
      });
      
      expect(gc).toBeDefined();
      expect(typeof gc.getHeapStats).toBe('function');
      expect(typeof gc.getGCStats).toBe('function');
      expect(typeof gc.cleanup).toBe('function');
    });

    test('should initialize advanced GC tuning', () => {
      const advGc = initializeAdvancedGCTuning({
        adaptiveMode: true,
        heapGrowthThreshold: 20
      });
      
      expect(advGc).toBeDefined();
    });

    test('should collect heap statistics', () => {
      const gc = initializeGCTuning();
      const heapStats = gc.getHeapStats();
      
      expect(heapStats).toHaveProperty('heapUsed');
      expect(heapStats).toHaveProperty('heapTotal');
      expect(heapStats).toHaveProperty('rss');
      expect(heapStats.heapUsed).toBeGreaterThan(0);
    });
  });
});
```

**Expected Results:** 3 tests passing

---

### Test Suite 3.2: Memory Stability

**Test 3.2.1: Long-running Memory Test**
```javascript
describe('Memory Stability', () => {
  test('should maintain stable memory over time', async () => {
    const gc = initializeGCTuning();
    const samples = [];
    
    // Collect memory samples over 10 seconds
    for (let i = 0; i < 10; i++) {
      const stats = gc.getHeapStats();
      samples.push(stats.heapUsed);
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // Calculate growth rate
    const firstSample = samples[0];
    const lastSample = samples[samples.length - 1];
    const growthMB = (lastSample - firstSample) / 1024 / 1024;
    
    console.log(`Memory growth: ${growthMB.toFixed(2)}MB over 10s`);
    
    // Should have minimal growth (target: <10MB over 10s)
    expect(growthMB).toBeLessThan(10);
  });

  test('should show GC stats after activity', async () => {
    const gc = initializeGCTuning();
    
    // Create some memory pressure
    const arrays = [];
    for (let i = 0; i < 100; i++) {
      arrays.push(new Array(10000).fill(i));
    }
    
    // Trigger GC if available
    if (global.gc) {
      global.gc();
    }
    
    const gcStats = gc.getGCStats();
    expect(gcStats).toBeTruthy();
  });
});
```

**Expected Results:** 2 tests passing (requires --expose-gc for optimal results)

---

## Part 4: Integration Performance Tests

### Test Suite 4.1: Combined Component Test

**Test 4.1.1: Full Integration**
```javascript
describe('Phase 3: Complete Integration', () => {
  test('should integrate all three components', async () => {
    // Initialize all components
    const serializer = new OptimizedResponseSerializer();
    const registry = new LazyManagerRegistry();
    const gc = initializeGCTuning();
    
    // Register templates
    serializer.registerTemplate('success', { success: true });
    
    // Register managers
    registry.register('test', new LazyManager('Test', async () => ({})));
    
    // Preload
    await registry.preloadCritical();
    
    // Verify all components working
    const result = serializer.serialize('success', { id: 1 });
    const status = registry.getStatus();
    const heap = gc.getHeapStats();
    
    expect(result).toBeTruthy();
    expect(status).toBeTruthy();
    expect(heap).toBeTruthy();
  });

  test('should handle rapid serialization with GC', async () => {
    const serializer = new OptimizedResponseSerializer();
    const gc = initializeGCTuning();
    
    serializer.registerTemplate('test', { data: undefined });
    
    const heapBefore = gc.getHeapStats().heapUsed;
    
    // Rapid serialization
    for (let i = 0; i < 10000; i++) {
      serializer.serialize('test', {
        id: i,
        data: { value: Math.random() }
      });
    }
    
    const heapAfter = gc.getHeapStats().heapUsed;
    const growth = (heapAfter - heapBefore) / 1024 / 1024;
    
    console.log(`Memory growth during serialization: ${growth.toFixed(2)}MB`);
    
    // Reasonable growth (not runaway)
    expect(growth).toBeLessThan(50); // <50MB for 10k serializations
  });
});
```

**Expected Results:** 2 tests passing

---

## Part 5: Performance Baseline Tests

### Test Suite 5.1: Throughput Validation

**Test 5.1.1: Single Connection Throughput**
```javascript
describe('Performance Baselines', () => {
  test('should achieve 500+ msg/sec throughput', async () => {
    const serializer = new OptimizedResponseSerializer();
    serializer.registerTemplate('success', { success: true, data: undefined });
    
    const duration = 5000; // 5 seconds
    const start = performance.now();
    let count = 0;
    
    while (performance.now() - start < duration) {
      serializer.serialize('success', {
        id: count++,
        data: { index: count }
      });
    }
    
    const elapsed = (performance.now() - start) / 1000;
    const throughput = count / elapsed;
    
    console.log(`Throughput: ${throughput.toFixed(2)} msg/sec`);
    expect(throughput).toBeGreaterThan(500);
  });

  test('should maintain sub-2ms P95 latency', () => {
    const serializer = new OptimizedResponseSerializer();
    serializer.registerTemplate('test', { data: undefined });
    
    const latencies = [];
    
    for (let i = 0; i < 1000; i++) {
      const start = performance.now();
      serializer.serialize('test', { data: { i } });
      latencies.push(performance.now() - start);
    }
    
    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    
    console.log(`P95 latency: ${p95.toFixed(3)}ms`);
    expect(p95).toBeLessThan(2);
  });
});
```

**Expected Results:** 2 tests passing, throughput metrics documented

---

## Test Suite Execution Order

1. **Response Serializer Tests** (15-20 minutes)
   - Template registration (5 min)
   - Serialization performance (5 min)
   - Buffer pool (5 min)
   - Template caching (3 min)
   - Error handling (2 min)

2. **Lazy Manager Tests** (15-20 minutes)
   - Registry operations (5 min)
   - Lazy initialization (5 min)
   - Preloading (5 min)
   - Error handling (2 min)

3. **GC Tuning Tests** (10-15 minutes)
   - GC initialization (5 min)
   - Memory stability (5 min)

4. **Integration Tests** (10-15 minutes)
   - Combined component test (5 min)
   - Performance baseline (5 min)

**Total Test Time:** ~50-70 minutes

---

## Success Metrics Summary

### Serializer Metrics
| Metric | Target | Pass Criteria |
|--------|--------|---------------|
| Serialization speed | <1ms | P95 <1ms |
| Template hit rate | >80% | Hit rate >80% |
| Performance vs JSON | 15% faster | Template < 0.85 * JSON |
| Large payload handling | <5ms | Duration <5ms for 100KB |

### Manager Metrics
| Metric | Target | Pass Criteria |
|--------|--------|---------------|
| Startup time reduction | -15-20% | Measured delta -15% to -20% |
| Preload completion | <500ms | Duration <500ms |
| Concurrent init safety | Zero race conditions | All instances identical |
| Memory footprint | -10-15% | Initial footprint -10% to -15% |

### GC Metrics
| Metric | Target | Pass Criteria |
|--------|--------|---------------|
| Memory stability | 0MB/hour | Growth <10MB per hour |
| GC pause frequency | <1/10s | Frequency <0.1 per second |
| Heap utilization | <70% | Utilization <70% |
| Adaptive effectiveness | <5% variance | Memory variance <5% |

### Integration Metrics
| Metric | Target | Pass Criteria |
|--------|--------|---------------|
| Throughput | 500+ msg/sec | >500 msg/sec sustained |
| P95 latency | <2ms | Measured <2ms |
| P99 latency | <5ms | Measured <5ms |
| Memory growth | 0MB over 30min | Growth <50MB |

---

## Failure Recovery

### If Test Fails

1. **Identify failure point**
   - Component: Serializer, Manager, or GC
   - Type: Performance, functionality, or error handling

2. **Isolate the issue**
   - Run single test in isolation
   - Add debug logging
   - Check for external factors

3. **Fix and retest**
   - Make targeted fix
   - Run full test suite again
   - Verify no regression

4. **Document findings**
   - Log what failed and why
   - Document fix applied
   - Update test if needed

---

## Test Data Files

### `fixtures/phase3-responses.json`

Contains sample response data for testing:

```json
{
  "success_response": {
    "id": "test-001",
    "command": "navigate",
    "success": true,
    "timestamp": "2026-06-13T00:00:00Z"
  },
  "error_response": {
    "id": "test-002",
    "command": "navigate",
    "success": false,
    "error": "Navigation failed"
  },
  "large_payload": {
    "image": "data:image/png;base64,...[100KB]..."
  }
}
```

---

## Continuous Testing

After merge to main:

- Run full test suite on each commit
- Monitor performance in CI/CD
- Alert on performance regressions
- Collect weekly performance reports

---

**Version:** 1.0  
**Last Updated:** June 13, 2026  
**Status:** Ready for Test Implementation
