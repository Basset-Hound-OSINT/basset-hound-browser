/**
 * Interaction Recorder Test Suite
 * Tests for recording, replaying, and exporting user interactions
 */

const {
  InteractionRecorder,
  InteractionRecording,
  InteractionEvent,
  RecordingCheckpoint,
  INTERACTION_TYPES,
  RECORDING_STATE,
  record,
  stop,
  getRecording,
  clear
} = require('../recording/interaction-recorder');

describe('InteractionRecorder', () => {
  let recorder;

  beforeEach(() => {
    recorder = new InteractionRecorder();
  });

  afterEach(() => {
    if (recorder) {
      recorder.cleanup();
    }
    clear();
  });

  describe('Recording Lifecycle', () => {
    test('should start recording', () => {
      const result = recorder.startRecording({
        name: 'Test Recording',
        description: 'Test description',
        startUrl: 'https://example.com'
      });

      expect(result.success).toBe(true);
      expect(result.recording.name).toBe('Test Recording');
      expect(recorder.state).toBe(RECORDING_STATE.RECORDING);
      expect(recorder.currentRecording).not.toBeNull();
    });

    test('should stop recording', () => {
      recorder.startRecording({ name: 'Test' });

      // Add some events
      recorder.recordMouseMove({ x: 100, y: 200 });

      const result = recorder.stopRecording();

      expect(result.success).toBe(true);
      expect(result.recording.endTime).not.toBeNull();
      expect(result.recording.duration).toBeGreaterThanOrEqual(0);
      expect(recorder.state).toBe(RECORDING_STATE.STOPPED);
    });

    test('should pause and resume recording', () => {
      recorder.startRecording({ name: 'Test' });

      const pauseResult = recorder.pauseRecording();
      expect(pauseResult.success).toBe(true);
      expect(recorder.state).toBe(RECORDING_STATE.PAUSED);

      const resumeResult = recorder.resumeRecording();
      expect(resumeResult.success).toBe(true);
      expect(recorder.state).toBe(RECORDING_STATE.RECORDING);
    });

    test('should prevent starting recording when already recording', () => {
      recorder.startRecording({ name: 'Test' });

      expect(() => {
        recorder.startRecording({ name: 'Test 2' });
      }).toThrow('Cannot start recording');
    });

    test('should prevent stopping when not recording', () => {
      expect(() => {
        recorder.stopRecording();
      }).toThrow('Cannot stop recording');
    });
  });

  describe('Mouse Events', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Test' });
    });

    test('should record mouse move', (done) => {
      recorder.recordMouseMove({
        x: 100,
        y: 200,
        clientX: 100,
        clientY: 200,
        pageX: 100,
        pageY: 200,
        screenX: 100,
        screenY: 200
      });

      // Mouse moves are throttled, so we need to wait
      setTimeout(() => {
        expect(recorder.currentRecording.events.length).toBeGreaterThan(0);
        const event = recorder.currentRecording.events[0];
        expect(event.type).toBe(INTERACTION_TYPES.MOUSE_MOVE);
        expect(event.data.x).toBe(100);
        expect(event.data.y).toBe(200);
        done();
      }, 150);
    });

    test('should record mouse click', () => {
      recorder.recordClick({
        x: 150,
        y: 250,
        clientX: 150,
        clientY: 250,
        button: 'left',
        detail: 1
      });

      expect(recorder.currentRecording.events.length).toBeGreaterThan(0);
      const event = recorder.currentRecording.events[0];
      expect(event.type).toBe(INTERACTION_TYPES.MOUSE_CLICK);
      expect(event.data.button).toBe('left');
    });

    test('should record mouse down and up', () => {
      recorder.recordMouseDown({ x: 100, y: 100, button: 'left' });
      recorder.recordMouseUp({ x: 100, y: 100, button: 'left' });

      expect(recorder.currentRecording.events.length).toBe(2);
      expect(recorder.currentRecording.events[0].type).toBe(INTERACTION_TYPES.MOUSE_DOWN);
      expect(recorder.currentRecording.events[1].type).toBe(INTERACTION_TYPES.MOUSE_UP);
    });

    test('should record mouse wheel', () => {
      recorder.recordWheel({
        deltaX: 0,
        deltaY: 100,
        deltaZ: 0,
        deltaMode: 0
      });

      expect(recorder.currentRecording.events.length).toBeGreaterThan(0);
      const event = recorder.currentRecording.events[0];
      expect(event.type).toBe(INTERACTION_TYPES.MOUSE_WHEEL);
    });

    test('should record hover', () => {
      recorder.recordHover({ x: 200, y: 300 });

      expect(recorder.currentRecording.events.length).toBeGreaterThan(0);
      const event = recorder.currentRecording.events[0];
      expect(event.type).toBe(INTERACTION_TYPES.HOVER);
    });
  });

  describe('Keyboard Events', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Test' });
    });

    test('should record key down and up', () => {
      recorder.recordKeyDown({
        key: 'a',
        code: 'KeyA',
        keyCode: 65
      });

      recorder.recordKeyUp({
        key: 'a',
        code: 'KeyA',
        keyCode: 65
      });

      expect(recorder.currentRecording.events.length).toBe(2);
      expect(recorder.currentRecording.events[0].type).toBe(INTERACTION_TYPES.KEY_DOWN);
      expect(recorder.currentRecording.events[1].type).toBe(INTERACTION_TYPES.KEY_UP);
    });

    test('should record input', () => {
      recorder.recordInput({
        value: 'test input',
        inputType: 'insertText',
        data: 'test'
      });

      expect(recorder.currentRecording.events.length).toBeGreaterThan(0);
      const event = recorder.currentRecording.events[0];
      expect(event.type).toBe(INTERACTION_TYPES.INPUT);
      expect(event.data.value).toBe('test input');
    });

    test('should record change', () => {
      recorder.recordChange({
        value: 'selected',
        checked: true
      });

      expect(recorder.currentRecording.events.length).toBeGreaterThan(0);
      const event = recorder.currentRecording.events[0];
      expect(event.type).toBe(INTERACTION_TYPES.CHANGE);
    });

    test('should record focus and blur', () => {
      recorder.recordFocus({});
      recorder.recordBlur({});

      expect(recorder.currentRecording.events.length).toBe(2);
      expect(recorder.currentRecording.events[0].type).toBe(INTERACTION_TYPES.FOCUS);
      expect(recorder.currentRecording.events[1].type).toBe(INTERACTION_TYPES.BLUR);
    });
  });

  describe('Scroll Events', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Test' });
    });

    test('should record scroll events', (done) => {
      recorder.recordScroll({
        scrollX: 0,
        scrollY: 500,
        scrollLeft: 0,
        scrollTop: 500,
        scrollWidth: 1024,
        scrollHeight: 5000
      });

      // Scrolls are throttled
      setTimeout(() => {
        expect(recorder.currentRecording.events.length).toBeGreaterThan(0);
        const event = recorder.currentRecording.events[0];
        expect(event.type).toBe(INTERACTION_TYPES.SCROLL);
        expect(event.data.scrollY).toBe(500);
        done();
      }, 150);
    });

    test('should throttle scroll events', (done) => {
      const startTime = Date.now();

      // Record multiple scrolls rapidly
      for (let i = 0; i < 10; i++) {
        recorder.recordScroll({
          scrollY: i * 100,
          scrollX: 0,
          scrollLeft: 0,
          scrollTop: i * 100,
          scrollWidth: 1024,
          scrollHeight: 5000
        });
      }

      // Should only have 1 event after flushing (most recent position)
      setTimeout(() => {
        // Count scroll events
        const scrollEvents = recorder.currentRecording.events.filter(
          e => e.type === INTERACTION_TYPES.SCROLL
        );
        expect(scrollEvents.length).toBeLessThanOrEqual(1);
        done();
      }, 150);
    });
  });

  describe('Navigation and Page Events', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Test', startUrl: 'https://example.com' });
    });

    test('should record navigation', () => {
      recorder.recordNavigation({
        url: 'https://example.com/page1',
        type: 'navigate'
      });

      expect(recorder.currentRecording.events.length).toBeGreaterThan(0);
      const event = recorder.currentRecording.events[0];
      expect(event.type).toBe(INTERACTION_TYPES.NAVIGATION);
      expect(event.data.url).toBe('https://example.com/page1');
    });

    test('should record page load', () => {
      recorder.recordLoad({
        url: 'https://example.com',
        loadTime: 1234,
        readyState: 'complete'
      });

      expect(recorder.currentRecording.events.length).toBeGreaterThan(0);
      const event = recorder.currentRecording.events[0];
      expect(event.type).toBe(INTERACTION_TYPES.LOAD);
    });

    test('should record resize', () => {
      recorder.recordResize({
        width: 1920,
        height: 1080,
        innerWidth: 1920,
        innerHeight: 1080,
        outerWidth: 1920,
        outerHeight: 1080
      });

      expect(recorder.currentRecording.events.length).toBeGreaterThan(0);
      const event = recorder.currentRecording.events[0];
      expect(event.type).toBe(INTERACTION_TYPES.RESIZE);
    });

    test('should record visibility change', () => {
      recorder.recordVisibilityChange({
        hidden: false,
        visibilityState: 'visible'
      });

      expect(recorder.currentRecording.events.length).toBeGreaterThan(0);
      const event = recorder.currentRecording.events[0];
      expect(event.type).toBe(INTERACTION_TYPES.VISIBILITY_CHANGE);
    });

    test('should record select', () => {
      recorder.recordSelect({
        value: 'option1',
        selectedIndex: 0,
        options: ['option1', 'option2']
      });

      expect(recorder.currentRecording.events.length).toBeGreaterThan(0);
      const event = recorder.currentRecording.events[0];
      expect(event.type).toBe(INTERACTION_TYPES.SELECT);
    });
  });

  describe('Sensitive Data Masking', () => {
    test('should mask password fields', () => {
      const recorder = new InteractionRecorder({ maskSensitiveData: true });
      recorder.startRecording({ name: 'Test' });

      recorder.recordInput({
        value: 'secret123',
        inputType: 'insertText',
        element: { name: 'password', type: 'password' }
      });

      const event = recorder.currentRecording.events[0];
      expect(event.masked).toBe(true);
      expect(event.data.value).toBe('***');
    });

    test('should mask email fields', () => {
      const recorder = new InteractionRecorder({ maskSensitiveData: true });
      recorder.startRecording({ name: 'Test' });

      recorder.recordInput({
        value: 'test@example.com',
        inputType: 'insertText',
        element: { name: 'email' }
      });

      const event = recorder.currentRecording.events[0];
      expect(event.masked).toBe(true);
    });

    test('should not mask when option disabled', () => {
      const recorder = new InteractionRecorder({ maskSensitiveData: false });
      recorder.startRecording({ name: 'Test' });

      recorder.recordInput({
        value: 'secret123',
        inputType: 'insertText',
        element: { name: 'password', type: 'password' }
      });

      const event = recorder.currentRecording.events[0];
      expect(event.masked).toBe(false);
      expect(event.data.value).toBe('secret123');
    });
  });

  describe('Checkpoints and Annotations', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Test' });
    });

    test('should create checkpoint', () => {
      const result = recorder.createCheckpoint({
        name: 'Test Checkpoint',
        description: 'This is a test checkpoint'
      });

      expect(result.success).toBe(true);
      expect(result.checkpoint.name).toBe('Test Checkpoint');
      expect(recorder.currentRecording.checkpoints.length).toBe(1);
    });

    test('should add annotation', () => {
      const result = recorder.addAnnotation({
        text: 'Test annotation',
        category: 'note'
      });

      expect(result.success).toBe(true);
      expect(result.annotation.text).toBe('Test annotation');
      expect(recorder.currentRecording.annotations.length).toBe(1);
    });

    test('should throw when creating checkpoint without recording', () => {
      const idleRecorder = new InteractionRecorder();

      expect(() => {
        idleRecorder.createCheckpoint({ name: 'Test' });
      }).toThrow();
    });
  });

  describe('Statistics', () => {
    test('should track statistics', () => {
      recorder.startRecording({ name: 'Test' });

      recorder.recordClick({ x: 100, y: 100 });
      recorder.recordClick({ x: 150, y: 150 });
      recorder.recordInput({ value: 'test' });
      recorder.recordKeyDown({ key: 'a' });

      const stats = recorder.currentRecording.stats;
      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.clicks).toBeGreaterThan(0);
      expect(stats.keyPresses).toBeGreaterThan(0);
    });

    test('should get statistics via method', () => {
      recorder.startRecording({ name: 'Test' });

      recorder.recordClick({ x: 100, y: 100 });
      recorder.recordInput({ value: 'test' });

      const result = recorder.getStats();
      expect(result.success).toBe(true);
      expect(result.stats.totalEvents).toBeGreaterThan(0);
      expect(result.stats.eventsPerSecond).toBeDefined();
    });
  });

  describe('Recording Serialization', () => {
    test('should serialize recording to JSON', () => {
      recorder.startRecording({ name: 'Test Recording' });
      recorder.recordClick({ x: 100, y: 100 });
      recorder.stopRecording();

      const result = recorder.exportAsJSON();
      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(result.data).toContain('Test Recording');
      expect(result.filename).toBeDefined();

      const data = JSON.parse(result.data);
      expect(data.name).toBe('Test Recording');
      expect(data.events.length).toBeGreaterThan(0);
    });

    test('should create recording from JSON', () => {
      const json = {
        id: 'test-id',
        name: 'Test',
        description: 'Test description',
        startUrl: 'https://example.com',
        startTime: Date.now(),
        endTime: Date.now() + 1000,
        duration: 1000,
        events: [],
        checkpoints: [],
        annotations: [],
        options: {},
        stats: {},
        metadata: {},
        tags: []
      };

      const recording = InteractionRecording.fromJSON(json);
      expect(recording.name).toBe('Test');
      expect(recording.description).toBe('Test description');
    });
  });

  describe('Playback Script Generation', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Test Recording', startUrl: 'https://example.com' });
    });

    test('should export as Selenium script', () => {
      recorder.recordNavigation({ url: 'https://example.com' });
      recorder.recordClick({ x: 100, y: 100, element: { selector: '#button' } });
      recorder.stopRecording();

      const result = recorder.exportAsSelenium();
      expect(result.success).toBe(true);
      expect(result.format).toBe('selenium');
      expect(result.data).toContain('selenium');
      expect(result.data).toContain('driver');
      expect(result.filename.endsWith('.py')).toBe(true);
    });

    test('should export as Puppeteer script', () => {
      recorder.recordNavigation({ url: 'https://example.com' });
      recorder.recordClick({ x: 100, y: 100, element: { selector: '#button' } });
      recorder.stopRecording();

      const result = recorder.exportAsPuppeteer();
      expect(result.success).toBe(true);
      expect(result.format).toBe('puppeteer');
      expect(result.data).toContain('puppeteer');
      expect(result.data).toContain('page');
      expect(result.filename.endsWith('.js')).toBe(true);
    });

    test('should export as Playwright script', () => {
      recorder.recordNavigation({ url: 'https://example.com' });
      recorder.recordClick({ x: 100, y: 100, element: { selector: '#button' } });
      recorder.stopRecording();

      const result = recorder.exportAsPlaywright();
      expect(result.success).toBe(true);
      expect(result.format).toBe('playwright');
      expect(result.data).toContain('playwright');
      expect(result.filename.endsWith('.js')).toBe(true);
    });
  });

  describe('Timeline and Querying', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Test' });
    });

    test('should get timeline', () => {
      recorder.recordClick({ x: 100, y: 100 });
      recorder.recordInput({ value: 'test' });

      const result = recorder.getTimeline();
      expect(result.success).toBe(true);
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.stats).toBeDefined();
    });

    test('should get events by type', () => {
      recorder.recordClick({ x: 100, y: 100 });
      recorder.recordClick({ x: 150, y: 150 });
      recorder.recordInput({ value: 'test' });

      const clicks = recorder.currentRecording.getEventsByType(INTERACTION_TYPES.MOUSE_CLICK);
      expect(clicks.length).toBeGreaterThan(0);
      expect(clicks.every(e => e.type === INTERACTION_TYPES.MOUSE_CLICK)).toBe(true);
    });

    test('should get events in time range', () => {
      recorder.recordClick({ x: 100, y: 100 });

      const allEvents = recorder.currentRecording.getEventsInRange(0, Infinity);
      expect(allEvents.length).toBeGreaterThan(0);
    });

    test('should paginate timeline', () => {
      // Record multiple events
      for (let i = 0; i < 5; i++) {
        recorder.recordClick({ x: 100, y: 100 });
      }

      const result = recorder.getTimeline({ limit: 2, offset: 0 });
      expect(result.events.length).toBeLessThanOrEqual(2);
      expect(result.limit).toBe(2);
      expect(result.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Convenience Functions', () => {
    test('should use record() convenience function', () => {
      const result = record({ name: 'Test' });
      expect(result.success).toBe(true);

      const recording = getRecording();
      expect(recording.success).toBe(true);
      expect(recording.recording.name).toBe('Test');

      const stopResult = stop();
      expect(stopResult.success).toBe(true);
    });

    test('should use clear() convenience function', () => {
      record({ name: 'Test' });
      const clearResult = clear();
      expect(clearResult.success).toBe(true);

      expect(() => {
        getRecording();
      }).toThrow('No active recording');
    });

    test('should throw when no active recording', () => {
      clear();

      expect(() => {
        stop();
      }).toThrow('No active recording');
    });
  });

  describe('Event Integrity', () => {
    test('should calculate hash for integrity verification', () => {
      recorder.startRecording({ name: 'Test' });
      recorder.recordClick({ x: 100, y: 100 });
      recorder.stopRecording();

      const hash = recorder.currentRecording.hash;
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA256 hex string
    });

    test('should verify recording hash', () => {
      recorder.startRecording({ name: 'Test' });
      recorder.recordClick({ x: 100, y: 100 });
      recorder.stopRecording();

      const isValid = recorder.currentRecording.verifyHash();
      expect(isValid).toBe(true);
    });

    test('should have relative times for all events', () => {
      recorder.startRecording({ name: 'Test' });
      recorder.recordClick({ x: 100, y: 100 });
      recorder.recordInput({ value: 'test' });

      const events = recorder.currentRecording.events;
      expect(events.every(e => e.relativeTime >= 0)).toBe(true);
    });

    test('should have time delta between events', () => {
      recorder.startRecording({ name: 'Test' });
      recorder.recordClick({ x: 100, y: 100 });
      recorder.recordClick({ x: 150, y: 150 });

      const events = recorder.currentRecording.events;
      if (events.length >= 2) {
        expect(events[1].timeDelta).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Configuration Options', () => {
    test('should respect recordMouseMovements option', () => {
      const recorder = new InteractionRecorder({ recordMouseMovements: false });
      recorder.startRecording({ name: 'Test' });

      recorder.recordMouseMove({ x: 100, y: 200 });

      expect(recorder.currentRecording.events.length).toBe(0);
    });

    test('should respect recordKeyboard option', () => {
      const recorder = new InteractionRecorder({ recordKeyboard: false });
      recorder.startRecording({ name: 'Test' });

      recorder.recordKeyDown({ key: 'a' });

      expect(recorder.currentRecording.events.length).toBe(0);
    });

    test('should respect recordScrolls option', (done) => {
      const recorder = new InteractionRecorder({ recordScrolls: false });
      recorder.startRecording({ name: 'Test' });

      recorder.recordScroll({ scrollY: 100 });

      setTimeout(() => {
        expect(recorder.currentRecording.events.length).toBe(0);
        done();
      }, 150);
    });

    test('should respect maxEvents limit', () => {
      const recorder = new InteractionRecorder({ maxEvents: 3 });
      recorder.startRecording({ name: 'Test' });

      let maxReachedEmitted = false;
      recorder.on('maxEventsReached', () => {
        maxReachedEmitted = true;
      });

      recorder.recordClick({ x: 100, y: 100 });
      recorder.recordClick({ x: 100, y: 100 });
      recorder.recordClick({ x: 100, y: 100 });
      recorder.recordClick({ x: 100, y: 100 }); // Should not be added

      expect(recorder.currentRecording.events.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Status and Monitoring', () => {
    test('should get recording status', () => {
      recorder.startRecording({ name: 'Test' });

      const status = recorder.getStatus();
      expect(status.state).toBe(RECORDING_STATE.RECORDING);
      expect(status.recording).not.toBeNull();
      expect(status.recording.name).toBe('Test');
    });

    test('should emit events', (done) => {
      let eventEmitted = false;

      recorder.on('recordingStarted', (data) => {
        expect(data.name).toBe('Test');
        eventEmitted = true;
      });

      recorder.startRecording({ name: 'Test' });

      setTimeout(() => {
        expect(eventEmitted).toBe(true);
        done();
      }, 50);
    });

    test('should emit eventRecorded', (done) => {
      let eventRecorded = false;

      recorder.on('eventRecorded', (data) => {
        expect(data.type).toBeDefined();
        eventRecorded = true;
      });

      recorder.startRecording({ name: 'Test' });
      recorder.recordClick({ x: 100, y: 100 });

      setTimeout(() => {
        expect(eventRecorded).toBe(true);
        done();
      }, 50);
    });
  });

  describe('InteractionEvent', () => {
    test('should create interaction event with defaults', () => {
      const event = new InteractionEvent({
        type: INTERACTION_TYPES.MOUSE_CLICK,
        data: { x: 100, y: 200 }
      });

      expect(event.id).toBeDefined();
      expect(event.type).toBe(INTERACTION_TYPES.MOUSE_CLICK);
      expect(event.timestamp).toBeDefined();
      expect(event.data.x).toBe(100);
    });

    test('should serialize event to JSON', () => {
      const event = new InteractionEvent({
        type: INTERACTION_TYPES.MOUSE_CLICK,
        data: { x: 100, y: 200 }
      });

      const json = event.toJSON();
      expect(json.id).toBeDefined();
      expect(json.type).toBe(INTERACTION_TYPES.MOUSE_CLICK);
    });

    test('should create event from JSON', () => {
      const json = {
        id: 'test-id',
        type: INTERACTION_TYPES.MOUSE_CLICK,
        timestamp: Date.now(),
        relativeTime: 100,
        timeDelta: 50,
        data: { x: 100, y: 200 },
        element: null,
        pageUrl: 'https://example.com',
        pageTitle: 'Example',
        viewport: null,
        metadata: {},
        masked: false
      };

      const event = InteractionEvent.fromJSON(json);
      expect(event.id).toBe('test-id');
      expect(event.type).toBe(INTERACTION_TYPES.MOUSE_CLICK);
    });
  });

  describe('RecordingCheckpoint', () => {
    test('should create checkpoint with defaults', () => {
      const checkpoint = new RecordingCheckpoint({
        name: 'Test Checkpoint',
        description: 'Test description'
      });

      expect(checkpoint.id).toBeDefined();
      expect(checkpoint.name).toBe('Test Checkpoint');
      expect(checkpoint.description).toBe('Test description');
      expect(checkpoint.timestamp).toBeDefined();
    });

    test('should serialize checkpoint to JSON', () => {
      const checkpoint = new RecordingCheckpoint({
        name: 'Test',
        relativeTime: 1000
      });

      const json = checkpoint.toJSON();
      expect(json.name).toBe('Test');
      expect(json.relativeTime).toBe(1000);
    });
  });

  describe('Throttling', () => {
    test('should throttle mouse moves', (done) => {
      const recorder = new InteractionRecorder({ mouseMoveThrottle: 100 });
      recorder.startRecording({ name: 'Test' });

      let eventCount = 0;
      recorder.on('eventRecorded', () => {
        eventCount++;
      });

      // Record many mouse moves rapidly
      for (let i = 0; i < 10; i++) {
        recorder.recordMouseMove({ x: i * 10, y: i * 10 });
      }

      setTimeout(() => {
        // Should only have 1 event (throttled)
        expect(eventCount).toBeLessThanOrEqual(1);
        done();
      }, 150);
    });

    test('should use custom throttle duration', (done) => {
      const recorder = new InteractionRecorder({ mouseMoveThrottle: 50 });
      recorder.startRecording({ name: 'Test' });

      recorder.recordMouseMove({ x: 100, y: 100 });
      recorder.recordMouseMove({ x: 150, y: 150 });

      setTimeout(() => {
        expect(recorder.currentRecording.events.length).toBeGreaterThan(0);
        done();
      }, 100);
    });
  });

  describe('Element Context', () => {
    test('should capture element context', () => {
      const recorder = new InteractionRecorder({ recordElementContext: true });
      recorder.startRecording({ name: 'Test' });

      recorder.recordClick({
        x: 100,
        y: 100,
        element: {
          tagName: 'BUTTON',
          id: 'submit-btn',
          className: 'btn btn-primary',
          selector: '#submit-btn',
          textContent: 'Click me'
        }
      });

      const event = recorder.currentRecording.events[0];
      expect(event.element).not.toBeNull();
      expect(event.element.tagName).toBe('BUTTON');
      expect(event.element.id).toBe('submit-btn');
    });

    test('should skip element context when disabled', () => {
      const recorder = new InteractionRecorder({ recordElementContext: false });
      recorder.startRecording({ name: 'Test' });

      recorder.recordClick({
        x: 100,
        y: 100,
        element: { tagName: 'BUTTON' }
      });

      const event = recorder.currentRecording.events[0];
      expect(event.element).toBeNull();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources on stop', () => {
      recorder.startRecording({ name: 'Test' });
      recorder.recordMouseMove({ x: 100, y: 100 });
      recorder.stopRecording();

      expect(recorder.mouseMoveTimer).toBeNull();
      expect(recorder.autoCheckpointTimer).toBeNull();
    });

    test('should cleanup all resources', () => {
      recorder.startRecording({ name: 'Test' });
      recorder.recordMouseMove({ x: 100, y: 100 });

      recorder.cleanup();

      expect(recorder.mouseMoveBuffer.length).toBe(0);
      expect(recorder.scrollBuffer.length).toBe(0);
      expect(recorder.elementCache.size).toBe(0);
    });
  });
});
