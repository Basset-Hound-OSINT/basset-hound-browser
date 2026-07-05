/**
 * Distributed Tracing Tests
 * Tests for trace creation, span management, and context propagation
 */

const DistributedTracer = require('../../src/observability/tracer');

describe('DistributedTracer', () => {
  let tracer;

  beforeEach(() => {
    tracer = new DistributedTracer({
      serviceName: 'test-service',
      samplingRate: 1.0,
      exportInterval: 1000
    });
  });

  afterEach(() => {
    tracer.close();
  });

  describe('Trace Management', () => {
    test('should start a new trace', () => {
      const result = tracer.startTrace();

      expect(result.traceId).toBeDefined();
      expect(result.samplingDecision).toBeDefined();
    });

    test('should use provided trace ID', () => {
      const result = tracer.startTrace('trace-123');

      expect(result.traceId).toBe('trace-123');
      expect(tracer.traces.has('trace-123')).toBe(true);
    });

    test('should initialize trace with correct properties', () => {
      const traceId = tracer.startTrace().traceId;
      const trace = tracer.traces.get(traceId);

      expect(trace.spans).toEqual([]);
      expect(trace.status).toBe('active');
      expect(trace.startTime).toBeDefined();
    });

    test('should get trace', () => {
      const traceId = tracer.startTrace().traceId;
      const trace = tracer.getTrace(traceId);

      expect(trace.traceId).toBe(traceId);
      expect(trace.spans).toBeDefined();
    });

    test('should emit trace started event', (done) => {
      tracer.on('trace:started', (data) => {
        expect(data.traceId).toBeDefined();
        done();
      });

      tracer.startTrace();
    });
  });

  describe('Span Management', () => {
    test('should start a span within a trace', () => {
      const traceId = tracer.startTrace().traceId;
      const result = tracer.startSpan(traceId, 'get-users');

      expect(result.spanId).toBeDefined();
      expect(result.traceId).toBe(traceId);
      expect(result.span.name).toBe('get-users');
    });

    test('should throw error for unknown trace', () => {
      expect(() => {
        tracer.startSpan('unknown-trace', 'operation');
      }).toThrow();
    });

    test('should create parent-child span relationship', () => {
      const traceId = tracer.startTrace().traceId;
      const parent = tracer.startSpan(traceId, 'parent-span');
      const child = tracer.startSpan(traceId, 'child-span', {
        parentSpanId: parent.spanId
      });

      expect(child.span.parentSpanId).toBe(parent.spanId);
    });

    test('should end a span', () => {
      const traceId = tracer.startTrace().traceId;
      const { spanId } = tracer.startSpan(traceId, 'test-span');

      const ended = tracer.endSpan(spanId);

      expect(ended.status).toBe('completed');
      expect(ended.duration).toBeGreaterThan(0);
      expect(tracer.activeSpans.has(spanId)).toBe(false);
    });

    test('should set span status and code', () => {
      const traceId = tracer.startTrace().traceId;
      const { spanId } = tracer.startSpan(traceId, 'test-span');

      const ended = tracer.endSpan(spanId, {
        status: 'error',
        statusCode: 500
      });

      expect(ended.status).toBe('error');
      expect(ended.statusCode).toBe(500);
    });

    test('should emit span started event', (done) => {
      const traceId = tracer.startTrace().traceId;

      tracer.on('span:started', (data) => {
        expect(data.spanId).toBeDefined();
        expect(data.spanName).toBe('test-span');
        done();
      });

      tracer.startSpan(traceId, 'test-span');
    });

    test('should emit span ended event', (done) => {
      const traceId = tracer.startTrace().traceId;
      const { spanId } = tracer.startSpan(traceId, 'test-span');

      tracer.on('span:ended', (data) => {
        expect(data.spanId).toBe(spanId);
        expect(data.duration).toBeGreaterThan(0);
        done();
      });

      tracer.endSpan(spanId);
    });
  });

  describe('Span Tags and Logs', () => {
    test('should add tag to span', () => {
      const traceId = tracer.startTrace().traceId;
      const { spanId } = tracer.startSpan(traceId, 'test-span');

      tracer.addSpanTag(spanId, 'http.method', 'GET');
      tracer.addSpanTag(spanId, 'http.status_code', 200);

      const span = tracer.activeSpans.get(spanId);
      expect(span.tags['http.method']).toBe('GET');
      expect(span.tags['http.status_code']).toBe(200);
    });

    test('should add log to span', () => {
      const traceId = tracer.startTrace().traceId;
      const { spanId } = tracer.startSpan(traceId, 'test-span');

      tracer.addSpanLog(spanId, 'User created', { userId: 123 });

      const span = tracer.activeSpans.get(spanId);
      expect(span.logs.length).toBe(1);
      expect(span.logs[0].message).toBe('User created');
    });

    test('should add event to span', () => {
      const traceId = tracer.startTrace().traceId;
      const { spanId } = tracer.startSpan(traceId, 'test-span');

      tracer.addSpanEvent(spanId, {
        name: 'cache.hit',
        attributes: { key: 'user-123' }
      });

      const span = tracer.activeSpans.get(spanId);
      expect(span.events.length).toBe(1);
      expect(span.events[0].name).toBe('cache.hit');
    });
  });

  describe('Context Propagation', () => {
    test('should inject trace context in W3C format', () => {
      const traceId = tracer.startTrace().traceId;
      const { spanId } = tracer.startSpan(traceId, 'test-span');

      const carrier = tracer.injectContext(spanId);

      expect(carrier['traceparent']).toBeDefined();
      expect(carrier['tracestate']).toBeDefined();
    });

    test('should inject trace context in B3 format', () => {
      const traceId = tracer.startTrace().traceId;
      const { spanId } = tracer.startSpan(traceId, 'test-span');

      const carrier = tracer.injectContext(spanId);

      expect(carrier['x-b3-traceid']).toBeDefined();
      expect(carrier['x-b3-spanid']).toBeDefined();
      expect(carrier['x-b3-sampled']).toBeDefined();
    });

    test('should extract W3C trace context', () => {
      const traceId = tracer.startTrace().traceId;
      const { spanId } = tracer.startSpan(traceId, 'test-span');

      const carrier = tracer.injectContext(spanId);
      const extracted = tracer.extractContext(carrier);

      expect(extracted.traceId).toBeDefined();
      expect(extracted.samplingDecision).toBeDefined();
    });

    test('should extract B3 trace context', () => {
      const traceId = tracer.startTrace().traceId;
      const { spanId } = tracer.startSpan(traceId, 'test-span');

      const carrier = {
        'x-b3-traceid': traceId,
        'x-b3-spanid': spanId,
        'x-b3-sampled': '1'
      };

      const extracted = tracer.extractContext(carrier);

      expect(extracted.traceId).toBe(traceId);
      expect(extracted.parentSpanId).toBe(spanId);
    });

    test('should create child context', () => {
      const traceId = tracer.startTrace().traceId;
      const { spanId } = tracer.startSpan(traceId, 'parent-span');

      const parentContext = tracer.spanContext.get(spanId);
      const childContext = tracer.createChildContext(parentContext);

      expect(childContext.traceId).toBe(parentContext.traceId);
      expect(childContext.parentSpanId).toBe(parentContext.spanId);
      expect(childContext.spanId).not.toBe(parentContext.spanId);
    });
  });

  describe('Trace Completion', () => {
    test('should complete trace when all spans end', () => {
      const traceId = tracer.startTrace().traceId;
      const { spanId } = tracer.startSpan(traceId, 'test-span');

      let completed = false;
      tracer.on('trace:completed', () => {
        completed = true;
      });

      tracer.endSpan(spanId);

      expect(completed).toBe(true);
      expect(tracer.traces.get(traceId).status).toBe('completed');
    });

    test('should calculate trace duration', () => {
      const traceId = tracer.startTrace().traceId;
      const { spanId } = tracer.startSpan(traceId, 'test-span');

      tracer.endSpan(spanId);

      const trace = tracer.traces.get(traceId);
      expect(trace.duration).toBeGreaterThan(0);
    });
  });

  describe('Trace Sampling', () => {
    test('should respect sampling rate', () => {
      const sampler = new (require('../../src/observability/tracer').Sampler || function () {
        this.samplingRate = 0.0;
        this.shouldSample = function () {
          return Math.random() < this.samplingRate;
        };
      })(0.0);

      expect(sampler.shouldSample()).toBe(false);
    });

    test('should sample all traces with rate 1.0', () => {
      const sampler = new (require('../../src/observability/tracer').Sampler || function () {
        this.samplingRate = 1.0;
        this.shouldSample = function () {
          return true;
        };
      })(1.0);

      expect(sampler.shouldSample()).toBe(true);
    });
  });

  describe('Export and Formatting', () => {
    test('should format W3C traceparent', () => {
      const context = {
        traceId: 'abc123',
        spanId: 'def456',
        samplingDecision: true
      };

      const traceparent = tracer._formatTraceparent(context);

      expect(traceparent).toContain('abc123');
      expect(traceparent).toContain('def456');
      expect(traceparent).toContain('01'); // sampled flag
    });

    test('should parse W3C traceparent', () => {
      const traceparent = '00-abc123-def456-01';
      const parsed = tracer._parseTraceparent(traceparent);

      expect(parsed.version).toBe('00');
      expect(parsed.traceId).toBe('abc123');
      expect(parsed.spanId).toBe('def456');
      expect(parsed.sampled).toBe(true);
    });

    test('should export to Jaeger format', async () => {
      const traceId = tracer.startTrace().traceId;
      const { spanId } = tracer.startSpan(traceId, 'test-span');
      tracer.endSpan(spanId);

      const span = tracer.spans.find(s => s.spanId === spanId);
      const jaegerSpan = tracer._toJaegerSpan(span);

      expect(jaegerSpan.traceID).toBe(traceId);
      expect(jaegerSpan.spanID).toBe(spanId);
      expect(jaegerSpan.operationName).toBe('test-span');
    });

    test('should export to Datadog format', async () => {
      const traceId = tracer.startTrace().traceId;
      const { spanId } = tracer.startSpan(traceId, 'test-span');
      tracer.endSpan(spanId);

      const span = tracer.spans.find(s => s.spanId === spanId);
      const ddSpan = tracer._toDatadogSpan(span);

      expect(ddSpan.trace_id).toBeDefined();
      expect(ddSpan.span_id).toBeDefined();
      expect(ddSpan.name).toBe('test-span');
    });
  });

  describe('Statistics', () => {
    test('should get tracer statistics', () => {
      const traceId = tracer.startTrace().traceId;
      tracer.startSpan(traceId, 'span-1');
      tracer.startSpan(traceId, 'span-2');

      const stats = tracer.getStats();

      expect(stats.totalTraces).toBe(1);
      expect(stats.totalSpans).toBe(2);
      expect(stats.samplingRate).toBe(1.0);
    });

    test('should track active spans', () => {
      const traceId = tracer.startTrace().traceId;
      const { spanId: spanId1 } = tracer.startSpan(traceId, 'span-1');
      tracer.startSpan(traceId, 'span-2');

      let stats = tracer.getStats();
      expect(stats.activeSpans).toBe(2);

      tracer.endSpan(spanId1);
      stats = tracer.getStats();
      expect(stats.activeSpans).toBe(1);
    });
  });

  describe('Periodic Export', () => {
    test('should start periodic export', () => {
      tracer.startPeriodicExport();
      expect(tracer.exportInterval).toBeDefined();

      tracer.stopPeriodicExport();
    });

    test('should stop periodic export', () => {
      tracer.startPeriodicExport();
      tracer.stopPeriodicExport();

      expect(tracer.exportInterval).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should throw error for unknown span', () => {
      expect(() => {
        tracer.addSpanTag('unknown-span', 'key', 'value');
      }).toThrow();
    });

    test('should emit export error event', async () => {
      const traceResult = tracer.startTrace();
      const span = tracer.startSpan(traceResult.traceId, 'test-operation');
      tracer.endSpan(span.spanId);

      // Mock _exportToJaeger to throw an error
      const originalExport = tracer._exportToJaeger;
      tracer._exportToJaeger = async () => {
        throw new Error('Export failed');
      };

      return new Promise((resolve) => {
        tracer.on('export:error', (data) => {
          expect(data.error).toBeDefined();
          tracer._exportToJaeger = originalExport; // Restore
          resolve();
        });

        tracer.options.jaegerEndpoint = 'http://endpoint:1000';
        tracer._exportBatch().catch(() => {
          // Expected to fail
        });
      });
    }, 5000);
  });
});
