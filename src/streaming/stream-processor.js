/**
 * Kafka Stream Processor
 * Wave 16 Phase 2: Distributed Architecture
 *
 * Features:
 * - Event streaming pipeline
 * - Change aggregation and windowing
 * - Real-time alerting triggers
 * - Stream transformations
 * - Multi-partition support for scaling
 */

const EventEmitter = require('events');

class StreamProcessor extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      windowSize: options.windowSize || 300000, // 5 minutes
      windowSlide: options.windowSlide || 60000, // 1 minute
      partitions: options.partitions || 10,
      maxBufferSize: options.maxBufferSize || 10000,
      enableExactlyOnce: options.enableExactlyOnce !== false,
      checkpointInterval: options.checkpointInterval || 30000,
      ...options
    };

    // Stream state
    this.isRunning = false;
    this.streams = new Map();
    this.topologies = new Map();

    // Event processing
    this.eventBuffer = [];
    this.partitionBuffers = new Map();
    this.stateStores = new Map();
    this.checkpoints = new Map();

    // Windowing
    this.windows = new Map();
    this.activeWindows = [];

    // Metrics
    this.metrics = {
      eventsProcessed: 0,
      eventsAggregated: 0,
      alertsTriggered: 0,
      windowsCreated: 0,
      checkpointsSaved: 0,
      processingLatency: [],
      aggregationLatency: [],
      errorRate: 0,
      errorCount: 0
    };

    // Alert rules
    this.alertRules = new Map();

    // Initialize partition buffers
    this._initializePartitions();

    // Start checkpoint timer
    this._startCheckpointTimer();
  }

  /**
   * Initialize partition buffers
   * @private
   */
  _initializePartitions() {
    for (let i = 0; i < this.options.partitions; i++) {
      this.partitionBuffers.set(i, {
        partitionId: i,
        events: [],
        offset: 0,
        lastProcessed: Date.now()
      });
    }
  }

  /**
   * Start checkpoint timer
   * @private
   */
  _startCheckpointTimer() {
    setInterval(() => {
      if (this.isRunning) {
        this._saveCheckpoint();
      }
    }, this.options.checkpointInterval);
  }

  /**
   * Create stream topology
   */
  createTopology(topologyName, options = {}) {
    try {
      const topology = {
        name: topologyName,
        sources: [],
        processors: [],
        sinks: [],
        states: new Map(),
        options: {
          parallelism: options.parallelism || 4,
          stateful: options.stateful !== false,
          ...options
        },
        createdAt: Date.now()
      };

      this.topologies.set(topologyName, topology);

      this.emit('topology:created', { topologyName, topology });
      console.log(`[StreamProcessor] Topology created: ${topologyName}`);

      return topology;
    } catch (error) {
      console.error(`[StreamProcessor] Failed to create topology ${topologyName}:`, error.message);
      throw error;
    }
  }

  /**
   * Add source to topology
   */
  addSource(topologyName, sourceId, topic, options = {}) {
    try {
      const topology = this.topologies.get(topologyName);
      if (!topology) {
        throw new Error(`Topology not found: ${topologyName}`);
      }

      const source = {
        id: sourceId,
        topic,
        partitions: options.partitions || this.options.partitions,
        deserializer: options.deserializer || JSON.parse,
        enabled: true,
        ...options
      };

      topology.sources.push(source);

      // Initialize state store for this source
      if (options.stateful) {
        const stateStoreKey = `${topologyName}_${sourceId}`;
        this.stateStores.set(stateStoreKey, {
          data: new Map(),
          lastUpdate: Date.now(),
          changeLog: []
        });
      }

      this.emit('source:added', { topologyName, sourceId, source });
      console.log(`[StreamProcessor] Source added to ${topologyName}: ${sourceId}`);

      return source;
    } catch (error) {
      console.error(`[StreamProcessor] Failed to add source:`, error.message);
      throw error;
    }
  }

  /**
   * Add processor to topology
   */
  addProcessor(topologyName, processorId, processorFunc, options = {}) {
    try {
      const topology = this.topologies.get(topologyName);
      if (!topology) {
        throw new Error(`Topology not found: ${topologyName}`);
      }

      const processor = {
        id: processorId,
        func: processorFunc,
        type: options.type || 'map',
        windowed: options.windowed || false,
        windowSize: options.windowSize || this.options.windowSize,
        enabled: true,
        metrics: {
          processed: 0,
          failed: 0,
          latency: []
        },
        ...options
      };

      topology.processors.push(processor);

      this.emit('processor:added', { topologyName, processorId, processor });
      console.log(`[StreamProcessor] Processor added to ${topologyName}: ${processorId}`);

      return processor;
    } catch (error) {
      console.error(`[StreamProcessor] Failed to add processor:`, error.message);
      throw error;
    }
  }

  /**
   * Add sink to topology
   */
  addSink(topologyName, sinkId, outputTopic, options = {}) {
    try {
      const topology = this.topologies.get(topologyName);
      if (!topology) {
        throw new Error(`Topology not found: ${topologyName}`);
      }

      const sink = {
        id: sinkId,
        outputTopic,
        serializer: options.serializer || JSON.stringify,
        format: options.format || 'json',
        enabled: true,
        metrics: {
          written: 0,
          failed: 0
        },
        ...options
      };

      topology.sinks.push(sink);

      this.emit('sink:added', { topologyName, sinkId, sink });
      console.log(`[StreamProcessor] Sink added to ${topologyName}: ${sinkId}`);

      return sink;
    } catch (error) {
      console.error(`[StreamProcessor] Failed to add sink:`, error.message);
      throw error;
    }
  }

  /**
   * Register alert rule
   */
  registerAlertRule(ruleId, rule) {
    try {
      const alertRule = {
        id: ruleId,
        name: rule.name,
        condition: rule.condition,
        threshold: rule.threshold,
        severity: rule.severity || 'medium',
        actions: rule.actions || [],
        enabled: rule.enabled !== false,
        createdAt: Date.now()
      };

      this.alertRules.set(ruleId, alertRule);

      this.emit('alert:rule_registered', { ruleId, alertRule });
      console.log(`[StreamProcessor] Alert rule registered: ${ruleId}`);

      return alertRule;
    } catch (error) {
      console.error(`[StreamProcessor] Failed to register alert rule:`, error.message);
      throw error;
    }
  }

  /**
   * Process event
   */
  async processEvent(event) {
    try {
      if (!this.isRunning) {
        throw new Error('Stream processor not running');
      }

      const startTime = Date.now();
      const partitionId = event.task_id ? this._hashToPartition(event.task_id) : 0;

      // Get partition buffer
      const partitionBuffer = this.partitionBuffers.get(partitionId);
      if (!partitionBuffer.events.length > this.options.maxBufferSize) {
        partitionBuffer.events.push(event);
      }

      this.eventBuffer.push({
        event,
        partitionId,
        timestamp: startTime,
        processed: false
      });

      // Check if we should flush
      if (this.eventBuffer.length >= Math.floor(this.options.maxBufferSize / 10)) {
        await this._flushEvents();
      }

      this.metrics.eventsProcessed++;

      return { eventId: event.event_id, partitionId };
    } catch (error) {
      console.error('[StreamProcessor] Event processing error:', error.message);
      this.metrics.errorCount++;
      throw error;
    }
  }

  /**
   * Hash task ID to partition
   * @private
   */
  _hashToPartition(taskId) {
    let hash = 0;
    for (let i = 0; i < taskId.length; i++) {
      hash = ((hash << 5) - hash) + taskId.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash) % this.options.partitions;
  }

  /**
   * Aggregate events in windows
   */
  async aggregateWindow(topologyName, windowId) {
    try {
      const topology = this.topologies.get(topologyName);
      if (!topology) {
        throw new Error(`Topology not found: ${topologyName}`);
      }

      const window = this.windows.get(windowId);
      if (!window || window.events.length === 0) {
        return null;
      }

      const startTime = Date.now();

      // Group events by task_id
      const grouped = new Map();
      for (const event of window.events) {
        if (!grouped.has(event.task_id)) {
          grouped.set(event.task_id, []);
        }
        grouped.get(event.task_id).push(event);
      }

      // Create aggregated events
      const aggregations = [];
      for (const [taskId, events] of grouped.entries()) {
        const aggregated = {
          window_id: windowId,
          task_id: taskId,
          change_count: events.length,
          severity: this._calculateSeverity(events),
          changes: events.map(e => ({
            type: e.change_type,
            timestamp: e.timestamp,
            confidence: e.payload?.confidence || 0
          })),
          aggregated_at: Date.now(),
          window_start: window.start,
          window_end: window.end
        };

        aggregations.push(aggregated);

        // Check alert rules
        for (const [ruleId, rule] of this.alertRules.entries()) {
          if (rule.enabled && this._checkAlertCondition(rule, aggregated)) {
            await this._triggerAlert(ruleId, rule, aggregated);
          }
        }
      }

      const latency = Date.now() - startTime;
      this.metrics.aggregationLatency.push(latency);
      if (this.metrics.aggregationLatency.length > 100) {
        this.metrics.aggregationLatency.shift();
      }

      this.metrics.eventsAggregated += window.events.length;

      // Remove window
      this.windows.delete(windowId);

      this.emit('window:aggregated', {
        windowId,
        topologyName,
        aggregationCount: aggregations.length,
        latency
      });

      console.log(`[StreamProcessor] Window aggregated: ${windowId} (${aggregations.length} aggregations)`);

      return aggregations;
    } catch (error) {
      console.error('[StreamProcessor] Window aggregation error:', error.message);
      this.metrics.errorCount++;
      throw error;
    }
  }

  /**
   * Calculate severity from events
   * @private
   */
  _calculateSeverity(events) {
    const severityLevels = {
      'CRITICAL_CONTENT': 'critical',
      'HIGH_SEVERITY_CHANGE': 'high',
      'RAPID_CHANGES': 'high',
      'CHANGE_DETECTED': 'medium'
    };

    let maxSeverity = 'low';
    for (const event of events) {
      const severity = severityLevels[event.change_type] || 'low';
      if (severity === 'critical' || maxSeverity === 'low' || (maxSeverity === 'medium' && severity === 'high')) {
        maxSeverity = severity;
      }
    }

    return maxSeverity;
  }

  /**
   * Check alert condition
   * @private
   */
  _checkAlertCondition(rule, aggregated) {
    try {
      switch (rule.condition) {
      case 'HIGH_SEVERITY':
        return aggregated.severity === 'high' || aggregated.severity === 'critical';

      case 'RAPID_CHANGES':
        return aggregated.change_count > (rule.threshold || 10);

      case 'CRITICAL_CONTENT':
        return aggregated.changes.some(c => ['js', 'css'].includes(c.type));

      case 'CUSTOM':
        return rule.evaluator(aggregated);

      default:
        return false;
      }
    } catch (error) {
      console.error('[StreamProcessor] Error checking alert condition:', error.message);
      return false;
    }
  }

  /**
   * Trigger alert
   * @private
   */
  async _triggerAlert(ruleId, rule, aggregated) {
    try {
      const alert = {
        alert_id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        rule_id: ruleId,
        rule_name: rule.name,
        task_id: aggregated.task_id,
        severity: aggregated.severity,
        change_count: aggregated.change_count,
        triggered_at: Date.now(),
        actions: rule.actions
      };

      this.metrics.alertsTriggered++;

      // Execute alert actions
      for (const action of rule.actions) {
        this.emit('alert:action', { alert, action });
      }

      this.emit('alert:triggered', { alert, rule });
      console.log(`[StreamProcessor] Alert triggered: ${alert.alert_id} (rule: ${rule.name})`);

      return alert;
    } catch (error) {
      console.error('[StreamProcessor] Error triggering alert:', error.message);
    }
  }

  /**
   * Flush events for processing
   * @private
   */
  async _flushEvents() {
    try {
      // Create windowed batches
      const now = Date.now();
      const windowId = `window_${now}`;

      const window = {
        id: windowId,
        start: now,
        end: now + this.options.windowSize,
        events: this.eventBuffer.map(e => e.event),
        createdAt: now
      };

      this.windows.set(windowId, window);
      this.activeWindows.push(windowId);

      // Process windows that are complete
      const completedWindows = this.activeWindows.filter(wId => {
        const w = this.windows.get(wId);
        return w && Date.now() >= w.end;
      });

      for (const wId of completedWindows) {
        await this.aggregateWindow('default', wId);
        const idx = this.activeWindows.indexOf(wId);
        if (idx > -1) {
          this.activeWindows.splice(idx, 1);
        }
      }

      this.eventBuffer = [];
      this.metrics.windowsCreated++;

    } catch (error) {
      console.error('[StreamProcessor] Flush error:', error.message);
    }
  }

  /**
   * Save checkpoint
   * @private
   */
  _saveCheckpoint() {
    try {
      const checkpoint = {
        timestamp: Date.now(),
        partitions: []
      };

      for (const [partitionId, buffer] of this.partitionBuffers.entries()) {
        checkpoint.partitions.push({
          partitionId,
          offset: buffer.offset,
          lastProcessed: buffer.lastProcessed
        });
      }

      this.checkpoints.set(`checkpoint_${Date.now()}`, checkpoint);

      // Keep only last 10 checkpoints
      const checkpointKeys = Array.from(this.checkpoints.keys());
      if (checkpointKeys.length > 10) {
        const toDelete = checkpointKeys.slice(0, checkpointKeys.length - 10);
        for (const key of toDelete) {
          this.checkpoints.delete(key);
        }
      }

      this.metrics.checkpointsSaved++;

      this.emit('checkpoint:saved', { timestamp: checkpoint.timestamp });
    } catch (error) {
      console.error('[StreamProcessor] Checkpoint error:', error.message);
    }
  }

  /**
   * Start stream processing
   */
  async start() {
    try {
      this.isRunning = true;
      this.emit('started');
      console.log('[StreamProcessor] Stream processing started');

      // Start window management
      this._startWindowManagement();

      return true;
    } catch (error) {
      console.error('[StreamProcessor] Start error:', error.message);
      throw error;
    }
  }

  /**
   * Start window management
   * @private
   */
  _startWindowManagement() {
    setInterval(() => {
      if (this.isRunning) {
        const now = Date.now();
        const expiredWindows = [];

        for (const [windowId, window] of this.windows.entries()) {
          if (now >= window.end) {
            expiredWindows.push(windowId);
          }
        }

        for (const windowId of expiredWindows) {
          this.aggregateWindow('default', windowId).catch(error => {
            console.error('[StreamProcessor] Window management error:', error.message);
          });
        }
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Stop stream processing
   */
  async stop() {
    try {
      this.isRunning = false;

      // Flush any remaining events
      await this._flushEvents();

      // Save final checkpoint
      this._saveCheckpoint();

      this.emit('stopped');
      console.log('[StreamProcessor] Stream processing stopped');

      return true;
    } catch (error) {
      console.error('[StreamProcessor] Stop error:', error.message);
      throw error;
    }
  }

  /**
   * Get topology status
   */
  getTopologyStatus(topologyName) {
    const topology = this.topologies.get(topologyName);
    if (!topology) {
      return null;
    }

    return {
      name: topologyName,
      sources: topology.sources.length,
      processors: topology.processors.length,
      sinks: topology.sinks.length,
      running: this.isRunning,
      createdAt: topology.createdAt
    };
  }

  /**
   * Get stream metrics
   */
  getMetrics() {
    const avgProcessingLatency = this.metrics.processingLatency.length > 0
      ? (this.metrics.processingLatency.reduce((a, b) => a + b, 0) / this.metrics.processingLatency.length).toFixed(2)
      : 0;

    const avgAggregationLatency = this.metrics.aggregationLatency.length > 0
      ? (this.metrics.aggregationLatency.reduce((a, b) => a + b, 0) / this.metrics.aggregationLatency.length).toFixed(2)
      : 0;

    return {
      eventsProcessed: this.metrics.eventsProcessed,
      eventsAggregated: this.metrics.eventsAggregated,
      alertsTriggered: this.metrics.alertsTriggered,
      windowsCreated: this.metrics.windowsCreated,
      checkpointsSaved: this.metrics.checkpointsSaved,
      averageProcessingLatency: avgProcessingLatency,
      averageAggregationLatency: avgAggregationLatency,
      errorCount: this.metrics.errorCount,
      running: this.isRunning,
      topologies: Array.from(this.topologies.keys()).length,
      alertRules: Array.from(this.alertRules.keys()).length
    };
  }

  /**
   * Get window status
   */
  getWindowStatus() {
    return {
      activeWindows: this.activeWindows.length,
      windows: Array.from(this.windows.entries()).map(([id, w]) => ({
        id,
        eventCount: w.events.length,
        duration: w.end - w.start,
        age: Date.now() - w.createdAt
      }))
    };
  }

  /**
   * Get partition status
   */
  getPartitionStatus() {
    const status = [];
    for (const [partitionId, buffer] of this.partitionBuffers.entries()) {
      status.push({
        partitionId,
        eventCount: buffer.events.length,
        offset: buffer.offset,
        lastProcessed: buffer.lastProcessed
      });
    }
    return status;
  }

  /**
   * Get alert rules
   */
  getAlertRules() {
    return Array.from(this.alertRules.values());
  }
}

module.exports = StreamProcessor;
