/**
 * Correlation ID System Tests
 */

const CorrelationIDSystem = require('../../src/observability/correlation-id');

describe('CorrelationIDSystem', () => {
  let correlationSystem;

  beforeEach(() => {
    correlationSystem = new CorrelationIDSystem({
      prefix: 'test',
      ttlMs: 10000
    });
  });

  afterEach(() => {
    correlationSystem.close();
  });

  describe('ID Generation', () => {
    test('should generate unique correlation IDs', () => {
      const id1 = correlationSystem.generateCorrelationID();
      const id2 = correlationSystem.generateCorrelationID();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1.startsWith('test-')).toBe(true);
      expect(id2.startsWith('test-')).toBe(true);
    });

    test('should generate IDs with correct prefix', () => {
      const customSystem = new CorrelationIDSystem({ prefix: 'custom' });
      const id = customSystem.generateCorrelationID();

      expect(id.startsWith('custom-')).toBe(true);
      customSystem.close();
    });
  });

  describe('Context Management', () => {
    test('should start a new context', () => {
      const result = correlationSystem.startContext();

      expect(result.correlationId).toBeDefined();
      expect(result.context).toBeDefined();
      expect(result.context.status).toBe('active');
    });

    test('should track parent-child relationships', () => {
      const parent = correlationSystem.startContext();
      const child = correlationSystem.startContext({
        parentCorrelationId: parent.correlationId
      });

      expect(child.context.parentCorrelationId).toBe(parent.correlationId);
      expect(child.context.depth).toBe(1);
      expect(parent.context.relatedContexts.has(child.correlationId)).toBe(true);
    });

    test('should get context', () => {
      const { correlationId } = correlationSystem.startContext();
      const context = correlationSystem.getContext(correlationId);

      expect(context).toBeDefined();
      expect(context.correlationId).toBe(correlationId);
    });

    test('should close context and emit event', (done) => {
      const { correlationId } = correlationSystem.startContext();

      correlationSystem.on('context:closed', (summary) => {
        expect(summary.correlationId).toBe(correlationId);
        expect(summary.durationMs).toBeGreaterThan(0);
        done();
      });

      correlationSystem.closeContext(correlationId);
    });
  });

  describe('Service Tracking', () => {
    test('should add service to context', () => {
      const { correlationId } = correlationSystem.startContext();
      const context = correlationSystem.addServiceToContext(correlationId, 'auth-service');

      expect(context.services.has('auth-service')).toBe(true);
      expect(context.services.size).toBe(1);
    });

    test('should track multiple services', () => {
      const { correlationId } = correlationSystem.startContext();
      correlationSystem.addServiceToContext(correlationId, 'auth-service');
      correlationSystem.addServiceToContext(correlationId, 'db-service');
      const context = correlationSystem.addServiceToContext(correlationId, 'cache-service');

      expect(context.services.size).toBe(3);
    });

    test('should emit service added event', (done) => {
      const { correlationId } = correlationSystem.startContext();

      correlationSystem.on('service:added', (data) => {
        expect(data.correlationId).toBe(correlationId);
        expect(data.serviceName).toBe('test-service');
        done();
      });

      correlationSystem.addServiceToContext(correlationId, 'test-service');
    });
  });

  describe('Trace Tracking', () => {
    test('should add trace to context', () => {
      const { correlationId } = correlationSystem.startContext();
      const context = correlationSystem.addTraceToContext(correlationId, 'trace-123');

      expect(context.traces.has('trace-123')).toBe(true);
      expect(context.traces.size).toBe(1);
    });

    test('should track multiple traces', () => {
      const { correlationId } = correlationSystem.startContext();
      correlationSystem.addTraceToContext(correlationId, 'trace-1');
      correlationSystem.addTraceToContext(correlationId, 'trace-2');
      const context = correlationSystem.addTraceToContext(correlationId, 'trace-3');

      expect(context.traces.size).toBe(3);
    });
  });

  describe('Span Tracking', () => {
    test('should add span to context', () => {
      const { correlationId } = correlationSystem.startContext();
      const context = correlationSystem.addSpanToContext(correlationId, 'span-123');

      expect(context.spans.has('span-123')).toBe(true);
      expect(context.spans.size).toBe(1);
    });

    test('should track multiple spans', () => {
      const { correlationId } = correlationSystem.startContext();
      correlationSystem.addSpanToContext(correlationId, 'span-1');
      correlationSystem.addSpanToContext(correlationId, 'span-2');
      const context = correlationSystem.addSpanToContext(correlationId, 'span-3');

      expect(context.spans.size).toBe(3);
    });
  });

  describe('Context Propagation', () => {
    test('should propagate context across services', () => {
      const { correlationId } = correlationSystem.startContext();
      correlationSystem.addServiceToContext(correlationId, 'service-a');

      const headers = correlationSystem.propagateContext(correlationId, 'service-b');

      expect(headers['x-correlation-id']).toBe(correlationId);
      expect(headers['x-correlation-source']).toContain('service-a');
    });

    test('should extract context from headers', () => {
      const { correlationId } = correlationSystem.startContext();

      const headers = {
        'x-correlation-id': correlationId,
        'x-parent-correlation-id': 'parent-123',
        'x-correlation-depth': '1',
        'x-correlation-source': 'service-a,service-b'
      };

      const extracted = correlationSystem.extractContext(headers);

      expect(extracted.correlationId).toBe(correlationId);
      expect(extracted.parentCorrelationId).toBe('parent-123');
      expect(extracted.depth).toBe(1);
      expect(extracted.sourceServices).toContain('service-a');
    });
  });

  describe('Context Linking', () => {
    test('should link related contexts', () => {
      const ctx1 = correlationSystem.startContext();
      const ctx2 = correlationSystem.startContext();

      correlationSystem.linkTraces(ctx1.correlationId, ctx2.correlationId);

      const context1 = correlationSystem.getContext(ctx1.correlationId);
      const context2 = correlationSystem.getContext(ctx2.correlationId);

      expect(context1.relatedContexts.has(ctx2.correlationId)).toBe(true);
      expect(context2.relatedContexts.has(ctx1.correlationId)).toBe(true);
    });
  });

  describe('Correlation Tree', () => {
    test('should get correlation tree', () => {
      const { correlationId } = correlationSystem.startContext();
      correlationSystem.addServiceToContext(correlationId, 'service-a');
      correlationSystem.addTraceToContext(correlationId, 'trace-1');
      correlationSystem.addSpanToContext(correlationId, 'span-1');

      const tree = correlationSystem.getCorrelationTree(correlationId);

      expect(tree.correlationId).toBe(correlationId);
      expect(tree.serviceCount).toBe(1);
      expect(tree.traceCount).toBe(1);
      expect(tree.spanCount).toBe(1);
      expect(tree.durationMs).toBeGreaterThan(0);
    });
  });

  describe('Summary and Metrics', () => {
    test('should get system summary', () => {
      correlationSystem.startContext();
      correlationSystem.startContext();
      const summary = correlationSystem.getSummary();

      expect(summary.totalContexts).toBe(2);
      expect(summary.activeContexts).toBe(2);
      expect(summary.completedContexts).toBe(0);
    });

    test('should track completed contexts', () => {
      const ctx = correlationSystem.startContext();
      correlationSystem.closeContext(ctx.correlationId);

      const summary = correlationSystem.getSummary();

      expect(summary.completedContexts).toBe(1);
      expect(summary.activeContexts).toBe(0);
    });
  });

  describe('Export and Integration', () => {
    test('should export context data', () => {
      const { correlationId } = correlationSystem.startContext();
      correlationSystem.addServiceToContext(correlationId, 'service-a');
      correlationSystem.addTraceToContext(correlationId, 'trace-1');

      const exported = correlationSystem.exportContext(correlationId);

      expect(exported.correlationId).toBe(correlationId);
      expect(exported.services).toContain('service-a');
      expect(exported.traces).toContain('trace-1');
    });
  });

  describe('Cleanup', () => {
    test('should handle cleanup interval', () => {
      const customSystem = new CorrelationIDSystem({
        ttlMs: 100,
        cleanupIntervalMs: 50,
        enableAutoCleanup: true
      });

      const ctx = customSystem.startContext();
      customSystem.closeContext(ctx.correlationId);

      // Wait for cleanup
      setTimeout(() => {
        const summary = customSystem.getSummary();
        expect(summary.totalContexts).toBe(0);
        customSystem.close();
      }, 200);
    });
  });
});
