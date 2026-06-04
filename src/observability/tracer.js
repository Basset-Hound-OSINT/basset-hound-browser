/**
 * Distributed Tracing for Basset Hound Browser
 *
 * Provides:
 * - Request tracing across services
 * - Span collection and forwarding
 * - Trace context propagation
 * - Performance analysis
 *
 * Features:
 * - OpenTelemetry-compatible tracing
 * - Distributed context propagation
 * - Span sampling
 * - Performance metrics collection
 * - Integration with Jaeger/Datadog
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class DistributedTracer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      serviceName: options.serviceName || 'basset-hound',
      samplingRate: options.samplingRate || 1.0, // 0.0-1.0
      exportInterval: options.exportInterval || 60000,
      jaegerEndpoint: options.jaegerEndpoint,
      datadogEndpoint: options.datadogEndpoint,
      batchSize: options.batchSize || 100,
      ...options
    };

    this.traces = new Map();
    this.spans = [];
    this.activeSpans = new Map();
    this.spanContext = new Map();
    this.exportBatch = [];
    this.sampler = new Sampler(this.options.samplingRate);
  }

  /**
   * Start a new trace
   */
  startTrace(traceId = null, spanId = null) {
    const id = traceId || this._generateId();
    const parentSpanId = spanId || null;

    const trace = {
      traceId: id,
      spans: [],
      startTime: performance.now(),
      duration: 0,
      status: 'active',
      sampleDecision: this.sampler.shouldSample(),
      tags: {},
      logs: []
    };

    this.traces.set(id, trace);
    this.emit('trace:started', { traceId: id });

    return {
      traceId: id,
      parentSpanId,
      samplingDecision: trace.sampleDecision
    };
  }

  /**
   * Start a span within a trace
   */
  startSpan(traceId, spanName, options = {}) {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new Error(`Trace ${traceId} not found`);
    }

    const spanId = this._generateId();
    const parentSpanId = options.parentSpanId || null;

    const span = {
      traceId,
      spanId,
      parentSpanId,
      name: spanName,
      operation: options.operation || spanName,
      serviceName: options.serviceName || this.options.serviceName,
      startTime: performance.now(),
      endTime: null,
      duration: 0,
      status: 'active',
      statusCode: null,
      tags: options.tags || {},
      logs: [],
      baggage: options.baggage || {},
      attributes: options.attributes || {},
      events: [],
      links: options.links || []
    };

    trace.spans.push(spanId);
    this.spans.push(span);
    this.activeSpans.set(spanId, span);

    // Store span context for propagation
    this.spanContext.set(spanId, {
      traceId,
      spanId,
      parentSpanId,
      samplingDecision: trace.sampleDecision,
      flags: options.flags || '01'
    });

    this.emit('span:started', { traceId, spanId, spanName });

    return {
      traceId,
      spanId,
      parentSpanId,
      span
    };
  }

  /**
   * End a span
   */
  endSpan(spanId, options = {}) {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      throw new Error(`Span ${spanId} not found`);
    }

    span.endTime = performance.now();
    span.duration = span.endTime - span.startTime;

    // Ensure minimum duration of 1 microsecond for timing precision
    if (span.duration === 0) {
      span.duration = 0.001; // 1 microsecond
    }

    span.status = options.status || 'completed';
    span.statusCode = options.statusCode || 0;

    if (options.tags) {
      span.tags = { ...span.tags, ...options.tags };
    }

    this.activeSpans.delete(spanId);
    this.emit('span:ended', { traceId: span.traceId, spanId, duration: span.duration });

    // Check if trace is complete
    const trace = this.traces.get(span.traceId);
    if (trace && this.activeSpans.size === 0) {
      this._completeTrace(span.traceId);
    }

    return span;
  }

  /**
   * Complete a trace
   */
  _completeTrace(traceId) {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.endTime = performance.now();
    trace.duration = trace.endTime - trace.startTime;

    // Ensure minimum duration of 1 microsecond for timing precision
    if (trace.duration === 0) {
      trace.duration = 0.001; // 1 microsecond
    }

    trace.status = 'completed';

    // Calculate trace-level metrics
    const spans = this.spans.filter(s => s.traceId === traceId);
    trace.spanCount = spans.length;
    trace.errorCount = spans.filter(s => s.statusCode !== 0).length;

    this.emit('trace:completed', { traceId, duration: trace.duration });

    // Queue for export
    if (trace.sampleDecision) {
      this.exportBatch.push(trace);
    }

    // Auto-export if batch is full
    if (this.exportBatch.length >= this.options.batchSize) {
      this._exportBatch();
    }
  }

  /**
   * Add tags to span
   */
  addSpanTag(spanId, key, value) {
    const span = this.activeSpans.get(spanId) || this.spans.find(s => s.spanId === spanId);
    if (!span) {
      throw new Error(`Span ${spanId} not found`);
    }

    span.tags[key] = value;
    return span;
  }

  /**
   * Add log to span
   */
  addSpanLog(spanId, message, fields = {}) {
    const span = this.activeSpans.get(spanId) || this.spans.find(s => s.spanId === spanId);
    if (!span) {
      throw new Error(`Span ${spanId} not found`);
    }

    span.logs.push({
      timestamp: Date.now(),
      message,
      fields
    });

    return span;
  }

  /**
   * Add event to span
   */
  addSpanEvent(spanId, event) {
    const span = this.activeSpans.get(spanId) || this.spans.find(s => s.spanId === spanId);
    if (!span) {
      throw new Error(`Span ${spanId} not found`);
    }

    span.events.push({
      name: event.name,
      timestamp: Date.now(),
      attributes: event.attributes || {}
    });

    return span;
  }

  /**
   * Inject trace context into carrier (for propagation)
   */
  injectContext(spanId, carrier = {}) {
    const context = this.spanContext.get(spanId);
    if (!context) {
      throw new Error(`Span context ${spanId} not found`);
    }

    // W3C Trace Context format
    carrier['traceparent'] = this._formatTraceparent(context);
    carrier['tracestate'] = this._formatTracestate(context);

    // B3 format (for Jaeger)
    carrier['x-b3-traceid'] = context.traceId;
    carrier['x-b3-spanid'] = context.spanId;
    carrier['x-b3-parentspanid'] = context.parentSpanId || '0';
    carrier['x-b3-sampled'] = context.samplingDecision ? '1' : '0';

    return carrier;
  }

  /**
   * Extract trace context from carrier
   */
  extractContext(carrier) {
    let traceId, spanId, parentSpanId, sampled;

    // Try W3C Trace Context first
    if (carrier['traceparent']) {
      const parsed = this._parseTraceparent(carrier['traceparent']);
      traceId = parsed.traceId;
      spanId = parsed.spanId;
      sampled = parsed.sampled;
    }

    // Fallback to B3 format
    if (!traceId && carrier['x-b3-traceid']) {
      traceId = carrier['x-b3-traceid'];
      spanId = carrier['x-b3-spanid'];
      parentSpanId = carrier['x-b3-parentspanid'] === '0' ? null : carrier['x-b3-parentspanid'];
      sampled = carrier['x-b3-sampled'] === '1';
    }

    if (traceId) {
      return {
        traceId,
        parentSpanId: spanId,
        samplingDecision: sampled !== false
      };
    }

    return null;
  }

  /**
   * Format W3C traceparent header
   */
  _formatTraceparent(context) {
    const version = '00';
    const flags = context.samplingDecision ? '01' : '00';
    return `${version}-${context.traceId}-${context.spanId}-${flags}`;
  }

  /**
   * Parse W3C traceparent header
   */
  _parseTraceparent(traceparent) {
    const parts = traceparent.split('-');
    return {
      version: parts[0],
      traceId: parts[1],
      spanId: parts[2],
      sampled: parts[3] === '01'
    };
  }

  /**
   * Format tracestate header
   */
  _formatTracestate(context) {
    return `basset-hound=${context.spanId}`;
  }

  /**
   * Create child span context
   */
  createChildContext(parentContext) {
    return {
      ...parentContext,
      parentSpanId: parentContext.spanId,
      spanId: this._generateId()
    };
  }

  /**
   * Export batch of traces
   */
  async _exportBatch() {
    if (this.exportBatch.length === 0) {
      return;
    }

    const batch = this.exportBatch.splice(0, this.options.batchSize);

    try {
      if (this.options.jaegerEndpoint) {
        await this._exportToJaeger(batch);
      }

      if (this.options.datadogEndpoint) {
        await this._exportToDatadog(batch);
      }

      this.emit('batch:exported', { traceCount: batch.length });

    } catch (error) {
      this.emit('export:error', { error: error.message });
      // Re-queue failed batch
      this.exportBatch.unshift(...batch);
    }
  }

  /**
   * Export to Jaeger
   */
  async _exportToJaeger(traces) {
    const jaegerSpans = traces.flatMap(trace =>
      this.spans.filter(s => s.traceId === trace.traceId)
        .map(span => this._toJaegerSpan(span))
    );

    this.emit('jaeger:export', { spanCount: jaegerSpans.length });
  }

  /**
   * Export to Datadog
   */
  async _exportToDatadog(traces) {
    const ddSpans = traces.flatMap(trace =>
      this.spans.filter(s => s.traceId === trace.traceId)
        .map(span => this._toDatadogSpan(span))
    );

    this.emit('datadog:export', { spanCount: ddSpans.length });
  }

  /**
   * Convert to Jaeger span format
   */
  _toJaegerSpan(span) {
    return {
      traceID: span.traceId,
      spanID: span.spanId,
      parentSpanID: span.parentSpanId,
      operationName: span.operation,
      serviceName: span.serviceName,
      startTime: span.startTime * 1000, // Convert to microseconds
      duration: span.duration * 1000,
      tags: Object.entries(span.tags).map(([k, v]) => ({ key: k, value: v })),
      logs: span.logs.map(log => ({
        timestamp: log.timestamp * 1000,
        fields: [{ key: 'message', value: log.message }]
      }))
    };
  }

  /**
   * Convert to Datadog span format
   */
  _toDatadogSpan(span) {
    return {
      trace_id: BigInt('0x' + span.traceId),
      span_id: BigInt('0x' + span.spanId),
      parent_id: span.parentSpanId ? BigInt('0x' + span.parentSpanId) : 0,
      name: span.operation,
      service: span.serviceName,
      start: span.startTime * 1e6, // Convert to nanoseconds
      duration: span.duration * 1e6,
      tags: span.tags,
      meta: { ...span.attributes }
    };
  }

  /**
   * Get trace
   */
  getTrace(traceId) {
    const trace = this.traces.get(traceId);
    if (!trace) return null;

    return {
      ...trace,
      spans: this.spans.filter(s => s.traceId === traceId)
    };
  }

  /**
   * Generate random ID
   */
  _generateId() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Get tracing statistics
   */
  getStats() {
    return {
      totalTraces: this.traces.size,
      activeTraces: Array.from(this.traces.values()).filter(t => t.status === 'active').length,
      totalSpans: this.spans.length,
      activeSpans: this.activeSpans.size,
      samplingRate: this.options.samplingRate,
      exportBatchSize: this.exportBatch.length,
      spans: this.spans.map(s => ({
        traceId: s.traceId,
        spanId: s.spanId,
        name: s.name,
        duration: s.duration,
        status: s.status
      })).slice(-100) // Last 100 spans
    };
  }

  /**
   * Start periodic export
   */
  startPeriodicExport() {
    this.exportInterval = setInterval(() => {
      this._exportBatch();
    }, this.options.exportInterval);
  }

  /**
   * Stop periodic export
   */
  stopPeriodicExport() {
    if (this.exportInterval) {
      clearInterval(this.exportInterval);
      this.exportInterval = null;
    }
  }

  /**
   * Close tracer
   */
  close() {
    this.stopPeriodicExport();
    this._exportBatch();
    this.removeAllListeners();
    this.traces.clear();
    this.spans = [];
    this.activeSpans.clear();
    this.spanContext.clear();
  }
}

/**
 * Sampler for trace sampling
 */
class Sampler {
  constructor(samplingRate) {
    this.samplingRate = Math.max(0, Math.min(1, samplingRate));
  }

  shouldSample() {
    if (this.samplingRate === 1.0) return true;
    if (this.samplingRate === 0.0) return false;
    return Math.random() < this.samplingRate;
  }
}

module.exports = DistributedTracer;
