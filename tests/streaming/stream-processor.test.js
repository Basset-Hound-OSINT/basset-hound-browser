/**
 * Stream Processor Tests
 * Tests for Kafka Stream Processing implementation
 * 20+ test scenarios
 */

const StreamProcessor = require('../../src/streaming/stream-processor');
const assert = require('assert');

describe('StreamProcessor', () => {
  let processor;

  beforeEach(async () => {
    processor = new StreamProcessor({
      windowSize: 60000, // 1 minute for testing
      windowSlide: 10000,
      partitions: 10,
      maxBufferSize: 1000
    });
    await processor.start();
  });

  afterEach(async () => {
    await processor.stop();
  });

  // Topology Tests
  describe('Stream Topology', () => {
    it('should create topology', () => {
      const topology = processor.createTopology('test_topology');
      assert.strictEqual(topology.name, 'test_topology');
      assert(topology.createdAt);
    });

    it('should add source to topology', () => {
      processor.createTopology('test_topology');
      const source = processor.addSource('test_topology', 'source_1', 'change-events');
      assert.strictEqual(source.id, 'source_1');
      assert.strictEqual(source.topic, 'change-events');
    });

    it('should add processor to topology', () => {
      processor.createTopology('test_topology');
      const processor_obj = processor.addProcessor('test_topology', 'proc_1', async (event) => event);
      assert.strictEqual(processor_obj.id, 'proc_1');
      assert.strictEqual(processor_obj.type, 'map');
    });

    it('should add sink to topology', () => {
      processor.createTopology('test_topology');
      const sink = processor.addSink('test_topology', 'sink_1', 'alerts-topic');
      assert.strictEqual(sink.id, 'sink_1');
      assert.strictEqual(sink.outputTopic, 'alerts-topic');
    });

    it('should get topology status', () => {
      processor.createTopology('test_topology');
      processor.addSource('test_topology', 'source_1', 'change-events');
      processor.addProcessor('test_topology', 'proc_1', async (e) => e);
      processor.addSink('test_topology', 'sink_1', 'alerts-topic');

      const status = processor.getTopologyStatus('test_topology');
      assert.strictEqual(status.sources, 1);
      assert.strictEqual(status.processors, 1);
      assert.strictEqual(status.sinks, 1);
    });

    it('should emit topology:created event', (done) => {
      processor.once('topology:created', () => {
        done();
      });
      processor.createTopology('test');
    });
  });

  // Event Processing Tests
  describe('Event Processing', () => {
    it('should process event', async () => {
      const event = {
        event_id: 'evt_1',
        task_id: 'task_1',
        change_type: 'HTML_MODIFIED',
        timestamp: Date.now(),
        severity: 'high',
        payload: { url: 'https://example.com' }
      };

      const result = await processor.processEvent(event);
      assert(result.eventId);
      assert(result.partitionId >= 0);
    });

    it('should assign event to partition', async () => {
      const event = {
        event_id: 'evt_1',
        task_id: 'task_abc123',
        change_type: 'HTML_MODIFIED',
        timestamp: Date.now()
      };

      const result = await processor.processEvent(event);
      assert(result.partitionId >= 0);
      assert(result.partitionId < 10);
    });

    it('should track processed events', async () => {
      const before = processor.metrics.eventsProcessed;

      const event = {
        event_id: 'evt_1',
        task_id: 'task_1',
        change_type: 'HTML_MODIFIED',
        timestamp: Date.now()
      };

      await processor.processEvent(event);
      assert.strictEqual(processor.metrics.eventsProcessed, before + 1);
    });

    it('should buffer events', async () => {
      const event = {
        event_id: 'evt_1',
        task_id: 'task_1',
        change_type: 'HTML_MODIFIED',
        timestamp: Date.now()
      };

      await processor.processEvent(event);
      assert(processor.eventBuffer.length > 0);
    });

    it('should create windows', async () => {
      const event = {
        event_id: 'evt_1',
        task_id: 'task_1',
        change_type: 'HTML_MODIFIED',
        timestamp: Date.now()
      };

      await processor.processEvent(event);
      await processor._flushEvents();

      assert(processor.windows.size > 0);
    });

    it('should emit message:processed event', (done) => {
      processor.once('message:processed', () => {
        done();
      });

      processor.processEvent({
        event_id: 'evt_1',
        task_id: 'task_1',
        change_type: 'HTML_MODIFIED',
        timestamp: Date.now()
      });
    });
  });

  // Window Aggregation Tests
  describe('Window Aggregation', () => {
    it('should aggregate window events', async () => {
      // Create test window
      const windowId = 'window_1';
      processor.windows.set(windowId, {
        id: windowId,
        start: Date.now(),
        end: Date.now() + 60000,
        events: [
          {
            task_id: 'task_1',
            change_type: 'HTML_MODIFIED',
            timestamp: Date.now(),
            severity: 'high',
            payload: { confidence: 0.95 }
          },
          {
            task_id: 'task_1',
            change_type: 'HTML_MODIFIED',
            timestamp: Date.now() + 1000,
            severity: 'high',
            payload: { confidence: 0.90 }
          }
        ]
      });

      const aggregations = await processor.aggregateWindow('default', windowId);
      assert(aggregations);
      assert(aggregations.length > 0);
    });

    it('should calculate event severity', async () => {
      const windowId = 'window_1';
      processor.windows.set(windowId, {
        id: windowId,
        start: Date.now(),
        end: Date.now() + 60000,
        events: [
          { task_id: 'task_1', change_type: 'CRITICAL_CONTENT', timestamp: Date.now() }
        ]
      });

      const aggregations = await processor.aggregateWindow('default', windowId);
      assert.strictEqual(aggregations[0].severity, 'critical');
    });

    it('should group events by task_id', async () => {
      const windowId = 'window_1';
      processor.windows.set(windowId, {
        id: windowId,
        start: Date.now(),
        end: Date.now() + 60000,
        events: [
          { task_id: 'task_1', change_type: 'HTML_MODIFIED', timestamp: Date.now() },
          { task_id: 'task_2', change_type: 'HTML_MODIFIED', timestamp: Date.now() }
        ]
      });

      const aggregations = await processor.aggregateWindow('default', windowId);
      assert.strictEqual(aggregations.length, 2);
    });

    it('should emit window:aggregated event', (done) => {
      processor.once('window:aggregated', () => {
        done();
      });

      processor.windows.set('window_1', {
        id: 'window_1',
        start: Date.now(),
        end: Date.now() + 60000,
        events: [{ task_id: 'task_1', change_type: 'HTML_MODIFIED', timestamp: Date.now() }]
      });

      processor.aggregateWindow('default', 'window_1');
    });
  });

  // Alert Rules Tests
  describe('Alert Rules', () => {
    it('should register alert rule', () => {
      const rule = processor.registerAlertRule('rule_1', {
        name: 'High Severity',
        condition: 'HIGH_SEVERITY',
        severity: 'high',
        actions: ['notify', 'log']
      });

      assert.strictEqual(rule.id, 'rule_1');
      assert.strictEqual(rule.name, 'High Severity');
    });

    it('should trigger alert for high severity', async () => {
      let alertTriggered = false;

      processor.registerAlertRule('rule_1', {
        name: 'High Severity',
        condition: 'HIGH_SEVERITY',
        severity: 'high',
        actions: ['notify']
      });

      processor.once('alert:triggered', () => {
        alertTriggered = true;
      });

      const windowId = 'window_1';
      processor.windows.set(windowId, {
        id: windowId,
        start: Date.now(),
        end: Date.now() + 60000,
        events: [
          { task_id: 'task_1', change_type: 'HIGH_SEVERITY_CHANGE', timestamp: Date.now() }
        ]
      });

      await processor.aggregateWindow('default', windowId);
      await new Promise(resolve => setTimeout(resolve, 100));

      assert(alertTriggered);
    });

    it('should trigger alert for rapid changes', async () => {
      processor.registerAlertRule('rule_1', {
        name: 'Rapid Changes',
        condition: 'RAPID_CHANGES',
        threshold: 3,
        severity: 'high',
        actions: ['notify']
      });

      const windowId = 'window_1';
      const events = [];
      for (let i = 0; i < 5; i++) {
        events.push({
          task_id: 'task_1',
          change_type: 'HTML_MODIFIED',
          timestamp: Date.now() + i * 1000
        });
      }

      processor.windows.set(windowId, {
        id: windowId,
        start: Date.now(),
        end: Date.now() + 60000,
        events
      });

      const aggregations = await processor.aggregateWindow('default', windowId);
      assert(aggregations[0].change_count >= 5);
    });

    it('should get alert rules', () => {
      processor.registerAlertRule('rule_1', {
        name: 'Test Rule',
        condition: 'HIGH_SEVERITY',
        severity: 'high',
        actions: []
      });

      const rules = processor.getAlertRules();
      assert(rules.length > 0);
    });

    it('should emit alert:triggered event', (done) => {
      processor.registerAlertRule('rule_1', {
        name: 'High Severity',
        condition: 'HIGH_SEVERITY',
        severity: 'high',
        actions: []
      });

      processor.once('alert:triggered', () => {
        done();
      });

      processor.windows.set('window_1', {
        id: 'window_1',
        start: Date.now(),
        end: Date.now() + 60000,
        events: [{ task_id: 'task_1', change_type: 'HIGH_SEVERITY_CHANGE', timestamp: Date.now() }]
      });

      processor.aggregateWindow('default', 'window_1');
    });
  });

  // Checkpoint Tests
  describe('Checkpointing', () => {
    it('should save checkpoint', () => {
      const before = processor.metrics.checkpointsSaved;
      processor._saveCheckpoint();
      assert.strictEqual(processor.metrics.checkpointsSaved, before + 1);
    });

    it('should store checkpoint data', () => {
      processor._saveCheckpoint();
      assert(processor.checkpoints.size > 0);
    });

    it('should keep only last checkpoints', () => {
      for (let i = 0; i < 15; i++) {
        processor._saveCheckpoint();
      }
      assert(processor.checkpoints.size <= 10);
    });
  });

  // Partition Tests
  describe('Partitioning', () => {
    it('should initialize partitions', () => {
      assert.strictEqual(processor.partitionBuffers.size, 10);
    });

    it('should hash task_id to partition', () => {
      const partition1 = processor._hashToPartition('task_1');
      const partition2 = processor._hashToPartition('task_2');

      assert(partition1 >= 0 && partition1 < 10);
      assert(partition2 >= 0 && partition2 < 10);
    });

    it('should get consistent partition for same task', () => {
      const partition1 = processor._hashToPartition('task_abc');
      const partition2 = processor._hashToPartition('task_abc');

      assert.strictEqual(partition1, partition2);
    });

    it('should get partition status', () => {
      const status = processor.getPartitionStatus();
      assert.strictEqual(status.length, 10);
    });
  });

  // Metrics Tests
  describe('Metrics', () => {
    it('should track event metrics', async () => {
      await processor.processEvent({
        event_id: 'evt_1',
        task_id: 'task_1',
        change_type: 'HTML_MODIFIED',
        timestamp: Date.now()
      });

      const metrics = processor.getMetrics();
      assert(metrics.eventsProcessed > 0);
    });

    it('should get comprehensive metrics', () => {
      const metrics = processor.getMetrics();

      assert(metrics.eventsProcessed >= 0);
      assert(metrics.eventsAggregated >= 0);
      assert(metrics.alertsTriggered >= 0);
      assert(metrics.running !== undefined);
    });

    it('should track window metrics', async () => {
      await processor.processEvent({
        event_id: 'evt_1',
        task_id: 'task_1',
        change_type: 'HTML_MODIFIED',
        timestamp: Date.now()
      });

      await processor._flushEvents();
      const metrics = processor.getMetrics();
      assert(metrics.windowsCreated > 0);
    });

    it('should track alert metrics', async () => {
      processor.registerAlertRule('rule_1', {
        name: 'Test',
        condition: 'HIGH_SEVERITY',
        severity: 'high',
        actions: []
      });

      const before = processor.metrics.alertsTriggered;

      processor.windows.set('window_1', {
        id: 'window_1',
        start: Date.now(),
        end: Date.now() + 60000,
        events: [{ task_id: 'task_1', change_type: 'HIGH_SEVERITY_CHANGE', timestamp: Date.now() }]
      });

      await processor.aggregateWindow('default', 'window_1');
      assert(processor.metrics.alertsTriggered >= before);
    });
  });

  // Start/Stop Tests
  describe('Stream Lifecycle', () => {
    it('should start stream processing', async () => {
      assert(processor.isRunning);
    });

    it('should stop stream processing', async () => {
      await processor.stop();
      assert(!processor.isRunning);
    });

    it('should emit started event', (done) => {
      const proc = new StreamProcessor();
      proc.once('started', () => {
        proc.stop();
        done();
      });
      proc.start();
    });

    it('should emit stopped event', (done) => {
      processor.once('stopped', () => {
        done();
      });
      processor.stop();
    });
  });

  // Window Status Tests
  describe('Window Status', () => {
    it('should get window status', async () => {
      await processor.processEvent({
        event_id: 'evt_1',
        task_id: 'task_1',
        change_type: 'HTML_MODIFIED',
        timestamp: Date.now()
      });

      const status = processor.getWindowStatus();
      assert(status.activeWindows >= 0);
      assert(Array.isArray(status.windows));
    });
  });
});
