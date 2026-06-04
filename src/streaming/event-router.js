/**
 * Event Router
 * Wave 16 Phase 2: Distributed Architecture
 *
 * Features:
 * - Routes events to correct handlers
 * - Event filtering and transformation
 * - Multi-destination routing
 * - Event tracking and auditing
 */

const EventEmitter = require('events');

class EventRouter extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxRouteDepth: options.maxRouteDepth || 10,
      enableAudit: options.enableAudit !== false,
      auditRetention: options.auditRetention || 86400000, // 1 day
      enableTransform: options.enableTransform !== false,
      ...options
    };

    // Route registry
    this.routes = new Map();
    this.filters = new Map();
    this.transformers = new Map();
    this.handlers = new Map();

    // Event tracking
    this.eventAudit = [];
    this.eventTracking = new Map();

    // Metrics
    this.metrics = {
      eventsRouted: 0,
      eventsFiltered: 0,
      eventsTransformed: 0,
      routingErrors: 0,
      averageLatency: 0,
      latencySamples: [],
      handlerMetrics: new Map(),
      routeMetrics: new Map()
    };

    // Start audit cleanup
    this._startAuditCleanup();
  }

  /**
   * Register route
   */
  registerRoute(routeId, route) {
    try {
      const routeConfig = {
        id: routeId,
        name: route.name,
        pattern: route.pattern, // e.g., "change_detected" or /change_.*/
        destination: route.destination,
        filter: route.filter || null,
        transform: route.transform || null,
        priority: route.priority || 0,
        enabled: route.enabled !== false,
        createdAt: Date.now()
      };

      this.routes.set(routeId, routeConfig);

      // Initialize metrics for this route
      this.metrics.routeMetrics.set(routeId, {
        routeId,
        eventsRouted: 0,
        eventsFiltered: 0,
        averageLatency: 0,
        latencySamples: []
      });

      this.emit('route:registered', { routeId, route: routeConfig });
      console.log(`[EventRouter] Route registered: ${routeId}`);

      return routeConfig;
    } catch (error) {
      console.error(`[EventRouter] Failed to register route ${routeId}:`, error.message);
      throw error;
    }
  }

  /**
   * Register filter
   */
  registerFilter(filterId, filterFunc, options = {}) {
    try {
      const filter = {
        id: filterId,
        func: filterFunc,
        enabled: options.enabled !== false,
        description: options.description || '',
        createdAt: Date.now()
      };

      this.filters.set(filterId, filter);

      this.emit('filter:registered', { filterId });
      console.log(`[EventRouter] Filter registered: ${filterId}`);

      return filter;
    } catch (error) {
      console.error(`[EventRouter] Failed to register filter ${filterId}:`, error.message);
      throw error;
    }
  }

  /**
   * Register transformer
   */
  registerTransformer(transformerId, transformFunc, options = {}) {
    try {
      const transformer = {
        id: transformerId,
        func: transformFunc,
        enabled: options.enabled !== false,
        outputFormat: options.outputFormat || 'json',
        description: options.description || '',
        createdAt: Date.now()
      };

      this.transformers.set(transformerId, transformer);

      this.emit('transformer:registered', { transformerId });
      console.log(`[EventRouter] Transformer registered: ${transformerId}`);

      return transformer;
    } catch (error) {
      console.error(`[EventRouter] Failed to register transformer ${transformerId}:`, error.message);
      throw error;
    }
  }

  /**
   * Register handler for destination
   */
  registerHandler(destinationId, handlerFunc, options = {}) {
    try {
      const handler = {
        id: destinationId,
        func: handlerFunc,
        enabled: options.enabled !== false,
        timeout: options.timeout || 10000,
        retryable: options.retryable !== false,
        maxRetries: options.maxRetries || 3,
        batchSize: options.batchSize || 1,
        createdAt: Date.now()
      };

      this.handlers.set(destinationId, handler);

      // Initialize metrics for this handler
      this.metrics.handlerMetrics.set(destinationId, {
        destinationId,
        eventsHandled: 0,
        eventsFailed: 0,
        eventsRetried: 0,
        averageLatency: 0,
        latencySamples: []
      });

      this.emit('handler:registered', { destinationId });
      console.log(`[EventRouter] Handler registered: ${destinationId}`);

      return handler;
    } catch (error) {
      console.error(`[EventRouter] Failed to register handler ${destinationId}:`, error.message);
      throw error;
    }
  }

  /**
   * Route event
   */
  async routeEvent(event, options = {}) {
    const eventId = event.event_id || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      // Track event
      this.eventTracking.set(eventId, {
        eventId,
        event,
        status: 'routing',
        startTime,
        routes: [],
        transformations: [],
        destinations: []
      });

      // Find matching routes
      const matchingRoutes = this._findMatchingRoutes(event);

      if (matchingRoutes.length === 0) {
        this.metrics.eventsFiltered++;
        this.eventTracking.get(eventId).status = 'no_routes';
        this.emit('event:no_routes', { eventId, event });
        return { eventId, routed: false, routeCount: 0 };
      }

      // Sort by priority
      matchingRoutes.sort((a, b) => b.priority - a.priority);

      // Route to each destination
      const routing = [];
      for (const route of matchingRoutes) {
        try {
          // Apply filter if configured
          if (route.filter) {
            const filterObj = this.filters.get(route.filter);
            if (filterObj && filterObj.enabled) {
              const filterResult = await this._executeFilter(filterObj, event);
              if (!filterResult) {
                this.metrics.eventsFiltered++;
                this.eventTracking.get(eventId).routes.push({
                  routeId: route.id,
                  status: 'filtered'
                });
                continue;
              }
            }
          }

          // Apply transformation if configured
          let transformedEvent = event;
          if (route.transform && this.options.enableTransform) {
            const transformer = this.transformers.get(route.transform);
            if (transformer && transformer.enabled) {
              transformedEvent = await this._executeTransformer(transformer, event);
              this.metrics.eventsTransformed++;
              this.eventTracking.get(eventId).transformations.push({
                transformerId: route.transform,
                status: 'completed'
              });
            }
          }

          // Send to destination handler
          const handler = this.handlers.get(route.destination);
          if (handler && handler.enabled) {
            const handlerResult = await this._executeHandler(handler, transformedEvent, options);
            routing.push({
              routeId: route.id,
              destination: route.destination,
              status: 'completed',
              latency: handlerResult.latency
            });

            this.eventTracking.get(eventId).destinations.push({
              destination: route.destination,
              status: 'delivered'
            });

            this.metrics.eventsRouted++;

            // Update route metrics
            const routeMetrics = this.metrics.routeMetrics.get(route.id);
            if (routeMetrics) {
              routeMetrics.eventsRouted++;
              routeMetrics.latencySamples.push(handlerResult.latency);
              if (routeMetrics.latencySamples.length > 100) {
                routeMetrics.latencySamples.shift();
              }
              routeMetrics.averageLatency = routeMetrics.latencySamples.length > 0
                ? routeMetrics.latencySamples.reduce((a, b) => a + b, 0) / routeMetrics.latencySamples.length
                : 0;
            }
          }

        } catch (error) {
          console.error(`[EventRouter] Route error for ${route.id}:`, error.message);
          this.metrics.routingErrors++;
          routing.push({
            routeId: route.id,
            destination: route.destination,
            status: 'failed',
            error: error.message
          });
        }
      }

      // Record latency
      const latency = Date.now() - startTime;
      this._recordLatency(latency);

      this.eventTracking.get(eventId).status = 'completed';
      this.eventTracking.get(eventId).latency = latency;

      // Add to audit
      if (this.options.enableAudit) {
        this._addAuditEntry({
          eventId,
          event,
          routing,
          latency,
          timestamp: Date.now()
        });
      }

      this.emit('event:routed', {
        eventId,
        routeCount: routing.length,
        latency
      });

      console.log(`[EventRouter] Event routed: ${eventId} (${routing.length} routes, ${latency}ms)`);

      return {
        eventId,
        routed: true,
        routeCount: routing.length,
        routing,
        latency
      };

    } catch (error) {
      console.error('[EventRouter] Event routing error:', error.message);
      this.metrics.routingErrors++;

      this.eventTracking.get(eventId).status = 'error';

      this.emit('event:routing_error', {
        eventId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Find matching routes for event
   * @private
   */
  _findMatchingRoutes(event) {
    const matching = [];

    for (const [routeId, route] of this.routes.entries()) {
      if (!route.enabled) continue;

      // Check if event matches pattern
      const eventType = event.type || event.change_type || 'unknown';

      let isMatch = false;
      if (typeof route.pattern === 'string') {
        isMatch = eventType === route.pattern;
      } else if (route.pattern instanceof RegExp) {
        isMatch = route.pattern.test(eventType);
      }

      if (isMatch) {
        matching.push(route);
      }
    }

    return matching;
  }

  /**
   * Execute filter
   * @private
   */
  async _executeFilter(filter, event) {
    try {
      return await filter.func(event);
    } catch (error) {
      console.error('[EventRouter] Filter execution error:', error.message);
      return false;
    }
  }

  /**
   * Execute transformer
   * @private
   */
  async _executeTransformer(transformer, event) {
    try {
      return await transformer.func(event);
    } catch (error) {
      console.error('[EventRouter] Transformer execution error:', error.message);
      return event; // Return original if transformation fails
    }
  }

  /**
   * Execute handler with timeout and retry
   * @private
   */
  async _executeHandler(handler, event, options = {}) {
    const startTime = Date.now();
    let lastError = null;

    for (let attempt = 0; attempt <= handler.maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          handler.func(event),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Handler timeout')), handler.timeout);
          })
        ]);

        const latency = Date.now() - startTime;

        // Update handler metrics
        const handlerMetrics = this.metrics.handlerMetrics.get(handler.id);
        if (handlerMetrics) {
          handlerMetrics.eventsHandled++;
          handlerMetrics.latencySamples.push(latency);
          if (handlerMetrics.latencySamples.length > 100) {
            handlerMetrics.latencySamples.shift();
          }
          handlerMetrics.averageLatency = handlerMetrics.latencySamples.length > 0
            ? handlerMetrics.latencySamples.reduce((a, b) => a + b, 0) / handlerMetrics.latencySamples.length
            : 0;
        }

        return { result, latency, success: true };

      } catch (error) {
        lastError = error;
        console.error(`[EventRouter] Handler attempt ${attempt + 1} failed:`, error.message);

        if (attempt < handler.maxRetries && handler.retryable) {
          const delay = 1000 * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    const latency = Date.now() - startTime;
    const handlerMetrics = this.metrics.handlerMetrics.get(handler.id);
    if (handlerMetrics) {
      handlerMetrics.eventsFailed++;
      handlerMetrics.eventsRetried += handler.maxRetries;
    }

    throw lastError || new Error('Handler failed after all retries');
  }

  /**
   * Record latency metric
   * @private
   */
  _recordLatency(latency) {
    this.metrics.latencySamples.push(latency);
    if (this.metrics.latencySamples.length > 1000) {
      this.metrics.latencySamples.shift();
    }

    const sum = this.metrics.latencySamples.reduce((a, b) => a + b, 0);
    this.metrics.averageLatency = sum / this.metrics.latencySamples.length;
  }

  /**
   * Add audit entry
   * @private
   */
  _addAuditEntry(entry) {
    this.eventAudit.push({
      ...entry,
      addedAt: Date.now()
    });

    // Keep only entries within retention period
    const cutoff = Date.now() - this.options.auditRetention;
    this.eventAudit = this.eventAudit.filter(e => e.addedAt > cutoff);
  }

  /**
   * Start audit cleanup
   * @private
   */
  _startAuditCleanup() {
    setInterval(() => {
      const cutoff = Date.now() - this.options.auditRetention;
      const beforeCount = this.eventAudit.length;
      this.eventAudit = this.eventAudit.filter(e => e.addedAt > cutoff);
      const afterCount = this.eventAudit.length;

      if (beforeCount !== afterCount) {
        console.log(`[EventRouter] Audit cleanup: removed ${beforeCount - afterCount} entries`);
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * Get event status
   */
  getEventStatus(eventId) {
    return this.eventTracking.get(eventId) || null;
  }

  /**
   * Get route status
   */
  getRouteStatus(routeId) {
    const route = this.routes.get(routeId);
    const metrics = this.metrics.routeMetrics.get(routeId);

    return {
      ...route,
      metrics
    };
  }

  /**
   * Get all routes
   */
  getRoutes() {
    return Array.from(this.routes.values());
  }

  /**
   * Get all handlers
   */
  getHandlers() {
    return Array.from(this.handlers.values());
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      eventsRouted: this.metrics.eventsRouted,
      eventsFiltered: this.metrics.eventsFiltered,
      eventsTransformed: this.metrics.eventsTransformed,
      routingErrors: this.metrics.routingErrors,
      averageLatency: this.metrics.averageLatency.toFixed(2),
      routes: this.routes.size,
      handlers: this.handlers.size,
      filters: this.filters.size,
      transformers: this.transformers.size,
      auditEntries: this.eventAudit.length,
      trackedEvents: this.eventTracking.size
    };
  }

  /**
   * Get handler metrics
   */
  getHandlerMetrics() {
    return Object.fromEntries(this.metrics.handlerMetrics);
  }

  /**
   * Get route metrics
   */
  getRouteMetrics() {
    return Object.fromEntries(this.metrics.routeMetrics);
  }

  /**
   * Get audit entries
   */
  getAuditEntries(options = {}) {
    let entries = [...this.eventAudit];

    if (options.limit) {
      entries = entries.slice(-options.limit);
    }

    if (options.eventId) {
      entries = entries.filter(e => e.eventId === options.eventId);
    }

    return entries;
  }

  /**
   * Enable/disable route
   */
  setRouteEnabled(routeId, enabled) {
    const route = this.routes.get(routeId);
    if (route) {
      route.enabled = enabled;
      this.emit('route:toggled', { routeId, enabled });
      return true;
    }
    return false;
  }

  /**
   * Enable/disable handler
   */
  setHandlerEnabled(handlerId, enabled) {
    const handler = this.handlers.get(handlerId);
    if (handler) {
      handler.enabled = enabled;
      this.emit('handler:toggled', { handlerId, enabled });
      return true;
    }
    return false;
  }
}

module.exports = EventRouter;
