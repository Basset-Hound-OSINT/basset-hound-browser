/**
 * Correlation ID System for Basset Hound Browser
 *
 * Provides:
 * - Auto-generation of correlation IDs
 * - Cross-service trace propagation
 * - Related trace linking
 * - Request/response correlation
 *
 * Features:
 * - Unique correlation IDs per request flow
 * - Hierarchical trace linking
 * - Parent-child trace relationships
 * - Service boundary crossing support
 * - Automatic context propagation
 */

const crypto = require('crypto');
const EventEmitter = require('events');

class CorrelationIDSystem extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      prefix: options.prefix || 'bhb',
      enableHierarchy: options.enableHierarchy !== false,
      contextStorage: options.contextStorage || 'memory',
      maxContextSize: options.maxContextSize || 10000,
      ttlMs: options.ttlMs || 3600000, // 1 hour
      enableAutoCleanup: options.enableAutoCleanup !== false,
      cleanupIntervalMs: options.cleanupIntervalMs || 300000, // 5 minutes
      ...options
    };

    this.correlationContexts = new Map();
    this.correlationMap = new Map(); // Maps correlation IDs to trace contexts
    this.parentChildRelations = new Map(); // Tracks parent-child relationships
    this.activeContexts = new Set();
    this.cleanupInterval = null;

    if (this.options.enableAutoCleanup) {
      this._startCleanupInterval();
    }
  }

  /**
   * Generate a new correlation ID
   */
  generateCorrelationID() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    const correlationId = `${this.options.prefix}-${timestamp}-${random}`;

    return correlationId;
  }

  /**
   * Start a new correlation context
   */
  startContext(options = {}) {
    const correlationId = options.correlationId || this.generateCorrelationID();
    const parentCorrelationId = options.parentCorrelationId || null;

    const context = {
      correlationId,
      parentCorrelationId,
      createdAt: Date.now(),
      startTime: performance.now(),
      services: new Set(),
      traces: new Set(),
      spans: new Set(),
      events: [],
      metadata: options.metadata || {},
      status: 'active',
      relatedContexts: new Set(),
      depth: (parentCorrelationId ? this._getDepth(parentCorrelationId) + 1 : 0)
    };

    // Store context
    this.correlationContexts.set(correlationId, context);
    this.correlationMap.set(correlationId, context);
    this.activeContexts.add(correlationId);

    // Track parent-child relationship if parent exists
    if (parentCorrelationId) {
      const parentContext = this.correlationContexts.get(parentCorrelationId);
      if (parentContext) {
        if (!this.parentChildRelations.has(parentCorrelationId)) {
          this.parentChildRelations.set(parentCorrelationId, new Set());
        }
        this.parentChildRelations.get(parentCorrelationId).add(correlationId);
        parentContext.relatedContexts.add(correlationId);
        context.relatedContexts.add(parentCorrelationId);
      }
    }

    this.emit('context:started', {
      correlationId,
      parentCorrelationId,
      depth: context.depth
    });

    return {
      correlationId,
      parentCorrelationId,
      context
    };
  }

  /**
   * Get current context
   */
  getContext(correlationId) {
    return this.correlationContexts.get(correlationId);
  }

  /**
   * Add service to correlation context
   */
  addServiceToContext(correlationId, serviceName) {
    const context = this.correlationContexts.get(correlationId);
    if (!context) {
      throw new Error(`Correlation context ${correlationId} not found`);
    }

    context.services.add(serviceName);
    context.events.push({
      type: 'service_added',
      service: serviceName,
      timestamp: Date.now()
    });

    this.emit('service:added', {
      correlationId,
      serviceName,
      serviceCount: context.services.size
    });

    return context;
  }

  /**
   * Add trace to correlation context
   */
  addTraceToContext(correlationId, traceId) {
    const context = this.correlationContexts.get(correlationId);
    if (!context) {
      throw new Error(`Correlation context ${correlationId} not found`);
    }

    context.traces.add(traceId);
    context.events.push({
      type: 'trace_added',
      traceId,
      timestamp: Date.now()
    });

    this.emit('trace:added', {
      correlationId,
      traceId,
      traceCount: context.traces.size
    });

    return context;
  }

  /**
   * Add span to correlation context
   */
  addSpanToContext(correlationId, spanId, metadata = {}) {
    const context = this.correlationContexts.get(correlationId);
    if (!context) {
      throw new Error(`Correlation context ${correlationId} not found`);
    }

    context.spans.add(spanId);
    context.events.push({
      type: 'span_added',
      spanId,
      metadata,
      timestamp: Date.now()
    });

    this.emit('span:added', {
      correlationId,
      spanId,
      spanCount: context.spans.size
    });

    return context;
  }

  /**
   * Propagate correlation context across service boundaries
   */
  propagateContext(sourceCorrelationId, targetServiceName) {
    const sourceContext = this.correlationContexts.get(sourceCorrelationId);
    if (!sourceContext) {
      throw new Error(`Correlation context ${sourceCorrelationId} not found`);
    }

    // Create propagation headers
    const headers = {
      'x-correlation-id': sourceCorrelationId,
      'x-parent-correlation-id': sourceContext.parentCorrelationId || '',
      'x-correlation-depth': sourceContext.depth.toString(),
      'x-correlation-source': Array.from(sourceContext.services).join(','),
      'x-correlation-time': Date.now().toString()
    };

    sourceContext.events.push({
      type: 'context_propagated',
      targetService: targetServiceName,
      timestamp: Date.now()
    });

    this.emit('context:propagated', {
      sourceCorrelationId,
      targetServiceName,
      headers
    });

    return headers;
  }

  /**
   * Extract correlation context from headers
   */
  extractContext(headers) {
    const correlationId = headers['x-correlation-id'];
    const parentCorrelationId = headers['x-parent-correlation-id'] || null;
    const depth = parseInt(headers['x-correlation-depth'] || '0', 10);
    const sourceServices = headers['x-correlation-source']
      ? headers['x-correlation-source'].split(',')
      : [];

    if (!correlationId) {
      return null;
    }

    return {
      correlationId,
      parentCorrelationId: parentCorrelationId || null,
      depth,
      sourceServices,
      extractedAt: Date.now()
    };
  }

  /**
   * Link related traces
   */
  linkTraces(correlationId, relatedCorrelationId) {
    const context1 = this.correlationContexts.get(correlationId);
    const context2 = this.correlationContexts.get(relatedCorrelationId);

    if (!context1 || !context2) {
      throw new Error('One or both correlation contexts not found');
    }

    context1.relatedContexts.add(relatedCorrelationId);
    context2.relatedContexts.add(correlationId);

    context1.events.push({
      type: 'context_linked',
      linkedContext: relatedCorrelationId,
      timestamp: Date.now()
    });

    this.emit('contexts:linked', {
      correlationId,
      relatedCorrelationId
    });

    return {
      context1,
      context2
    };
  }

  /**
   * Get full correlation tree
   */
  getCorrelationTree(correlationId) {
    const context = this.correlationContexts.get(correlationId);
    if (!context) {
      return null;
    }

    const tree = {
      correlationId,
      createdAt: context.createdAt,
      serviceCount: context.services.size,
      services: Array.from(context.services),
      traceCount: context.traces.size,
      traces: Array.from(context.traces),
      spanCount: context.spans.size,
      spans: Array.from(context.spans),
      depth: context.depth,
      parentCorrelationId: context.parentCorrelationId,
      relatedContextCount: context.relatedContexts.size,
      relatedContexts: Array.from(context.relatedContexts),
      eventCount: context.events.length,
      metadata: context.metadata,
      durationMs: performance.now() - context.startTime
    };

    return tree;
  }

  /**
   * Close/complete a correlation context
   */
  closeContext(correlationId) {
    const context = this.correlationContexts.get(correlationId);
    if (!context) {
      throw new Error(`Correlation context ${correlationId} not found`);
    }

    context.status = 'completed';
    context.completedAt = Date.now();
    context.durationMs = performance.now() - context.startTime;

    this.activeContexts.delete(correlationId);

    const summary = {
      correlationId,
      durationMs: context.durationMs,
      serviceCount: context.services.size,
      traceCount: context.traces.size,
      spanCount: context.spans.size,
      eventCount: context.events.length
    };

    this.emit('context:closed', summary);

    return summary;
  }

  /**
   * Get context summary
   */
  getSummary() {
    const allContexts = Array.from(this.correlationContexts.values());
    const activeCount = this.activeContexts.size;
    const completedCount = allContexts.length - activeCount;

    const stats = {
      totalContexts: allContexts.length,
      activeContexts: activeCount,
      completedContexts: completedCount,
      totalServices: new Set(
        allContexts.flatMap(c => Array.from(c.services))
      ).size,
      totalTraces: allContexts.reduce((sum, c) => sum + c.traces.size, 0),
      totalSpans: allContexts.reduce((sum, c) => sum + c.spans.size, 0),
      averageDepth: allContexts.reduce((sum, c) => sum + c.depth, 0) / allContexts.length || 0,
      oldestContextAge: allContexts.length > 0
        ? Date.now() - Math.min(...allContexts.map(c => c.createdAt))
        : 0
    };

    return stats;
  }

  /**
   * Export context data for analysis
   */
  exportContext(correlationId) {
    const context = this.correlationContexts.get(correlationId);
    if (!context) {
      return null;
    }

    return {
      correlationId: context.correlationId,
      parentCorrelationId: context.parentCorrelationId,
      createdAt: context.createdAt,
      completedAt: context.completedAt,
      durationMs: context.durationMs || (performance.now() - context.startTime),
      services: Array.from(context.services),
      traces: Array.from(context.traces),
      spans: Array.from(context.spans),
      depth: context.depth,
      relatedContexts: Array.from(context.relatedContexts),
      events: context.events,
      metadata: context.metadata,
      status: context.status
    };
  }

  /**
   * Get depth in hierarchy
   */
  _getDepth(correlationId) {
    const context = this.correlationContexts.get(correlationId);
    if (!context) {
      return 0;
    }
    return context.depth;
  }

  /**
   * Start cleanup interval for expired contexts
   */
  _startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this._cleanupExpiredContexts();
    }, this.options.cleanupIntervalMs);
  }

  /**
   * Clean up expired contexts
   */
  _cleanupExpiredContexts() {
    const now = Date.now();
    const expiredIds = [];

    for (const [correlationId, context] of this.correlationContexts) {
      const age = now - context.createdAt;
      if (age > this.options.ttlMs && context.status === 'completed') {
        expiredIds.push(correlationId);
      }
    }

    expiredIds.forEach(id => {
      this.correlationContexts.delete(id);
      this.correlationMap.delete(id);
      this.parentChildRelations.delete(id);
    });

    if (expiredIds.length > 0) {
      this.emit('contexts:cleaned', {
        cleanedCount: expiredIds.length,
        remainingCount: this.correlationContexts.size
      });
    }
  }

  /**
   * Close system
   */
  close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.emit('system:closed');
  }
}

module.exports = CorrelationIDSystem;
