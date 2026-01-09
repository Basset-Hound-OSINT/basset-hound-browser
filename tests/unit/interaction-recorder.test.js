/**
 * Interaction Recorder Unit Tests
 *
 * Phase 20: Comprehensive tests for interaction recording functionality
 */

const {
  InteractionRecorder,
  InteractionRecording,
  InteractionEvent,
  RecordingCheckpoint,
  INTERACTION_TYPES,
  RECORDING_STATE,
  SENSITIVE_PATTERNS
} = require('../../recording/interaction-recorder');

describe('InteractionRecorder', () => {
  let recorder;

  beforeEach(() => {
    recorder = new InteractionRecorder({
      recordMouseMovements: true,
      recordScrolls: true,
      recordKeyboard: true,
      maskSensitiveData: true,
      mouseMoveThrottle: 50,
      scrollThrottle: 50
    });
  });

  afterEach(() => {
    if (recorder) {
      recorder.cleanup();
    }
  });

  // ==========================================
  // RECORDING LIFECYCLE TESTS
  // ==========================================

  describe('Recording Lifecycle', () => {
    test('should start recording successfully', () => {
      const result = recorder.startRecording({
        name: 'Test Recording',
        description: 'Test description',
        startUrl: 'https://example.com'
      });

      expect(result.success).toBe(true);
      expect(result.recording.id).toBeDefined();
      expect(result.recording.name).toBe('Test Recording');
      expect(recorder.state).toBe(RECORDING_STATE.RECORDING);
      expect(recorder.currentRecording).toBeDefined();
    });

    test('should not start recording if already recording', () => {
      recorder.startRecording({ name: 'First' });

      expect(() => {
        recorder.startRecording({ name: 'Second' });
      }).toThrow('Cannot start recording');
    });

    test('should stop recording successfully', () => {
      recorder.startRecording({ name: 'Test' });

      // Add some events
      recorder.recordClick({ x: 100, y: 100, button: 'left' });

      const result = recorder.stopRecording();

      expect(result.success).toBe(true);
      expect(result.recording.id).toBeDefined();
      expect(result.recording.duration).toBeGreaterThanOrEqual(0);
      expect(result.recording.events.length).toBeGreaterThan(0);
      expect(recorder.state).toBe(RECORDING_STATE.STOPPED);
    });

    test('should not stop recording if not recording', () => {
      expect(() => {
        recorder.stopRecording();
      }).toThrow('Cannot stop recording');
    });

    test('should pause recording successfully', () => {
      recorder.startRecording({ name: 'Test' });

      const result = recorder.pauseRecording();

      expect(result.success).toBe(true);
      expect(result.state).toBe(RECORDING_STATE.PAUSED);
      expect(recorder.state).toBe(RECORDING_STATE.PAUSED);
    });

    test('should resume recording successfully', () => {
      recorder.startRecording({ name: 'Test' });
      recorder.pauseRecording();

      const result = recorder.resumeRecording();

      expect(result.success).toBe(true);
      expect(result.state).toBe(RECORDING_STATE.RECORDING);
      expect(recorder.state).toBe(RECORDING_STATE.RECORDING);
    });

    test('should not record events when paused', () => {
      recorder.startRecording({ name: 'Test' });
      const initialEventCount = recorder.currentRecording.events.length;

      recorder.pauseRecording();
      recorder.recordClick({ x: 100, y: 100, button: 'left' });

      expect(recorder.currentRecording.events.length).toBe(initialEventCount);
    });

    test('should track recording duration correctly', (done) => {
      recorder.startRecording({ name: 'Test' });

      setTimeout(() => {
        const result = recorder.stopRecording();
        expect(result.recording.duration).toBeGreaterThan(90);
        expect(result.recording.duration).toBeLessThan(150);
        done();
      }, 100);
    });

    test('should exclude pause duration from total duration', (done) => {
      recorder.startRecording({ name: 'Test' });

      setTimeout(() => {
        recorder.pauseRecording();

        setTimeout(() => {
          recorder.resumeRecording();

          setTimeout(() => {
            const result = recorder.stopRecording();
            // Should be around 100ms (50ms + 50ms), not 150ms
            expect(result.recording.duration).toBeLessThan(120);
            done();
          }, 50);
        }, 50);
      }, 50);
    });
  });

  // ==========================================
  // MOUSE EVENT TESTS
  // ==========================================

  describe('Mouse Event Recording', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Mouse Test' });
    });

    test('should record mouse click', () => {
      recorder.recordClick({
        x: 100,
        y: 200,
        clientX: 100,
        clientY: 200,
        button: 'left',
        element: { tagName: 'button', id: 'test-btn' }
      });

      const events = recorder.currentRecording.events;
      const clickEvent = events.find(e => e.type === INTERACTION_TYPES.MOUSE_CLICK);

      expect(clickEvent).toBeDefined();
      expect(clickEvent.data.x).toBe(100);
      expect(clickEvent.data.y).toBe(200);
      expect(clickEvent.data.button).toBe('left');
    });

    test('should record mouse down and up', () => {
      recorder.recordMouseDown({
        x: 100,
        y: 200,
        button: 'left'
      });

      recorder.recordMouseUp({
        x: 100,
        y: 200,
        button: 'left'
      });

      const events = recorder.currentRecording.events;
      expect(events.filter(e => e.type === INTERACTION_TYPES.MOUSE_DOWN).length).toBe(1);
      expect(events.filter(e => e.type === INTERACTION_TYPES.MOUSE_UP).length).toBe(1);
    });

    test('should throttle mouse movements', (done) => {
      // Record multiple mouse moves quickly
      for (let i = 0; i < 10; i++) {
        recorder.recordMouseMove({
          x: i * 10,
          y: i * 10,
          clientX: i * 10,
          clientY: i * 10
        });
      }

      // Wait for throttle to flush
      setTimeout(() => {
        const events = recorder.currentRecording.events;
        const mouseMoves = events.filter(e => e.type === INTERACTION_TYPES.MOUSE_MOVE);

        // Should only have 1 mouse move event (throttled)
        expect(mouseMoves.length).toBe(1);
        // Should have last position
        expect(mouseMoves[0].data.x).toBe(90);
        done();
      }, 100);
    });

    test('should record mouse wheel', () => {
      recorder.recordWheel({
        deltaX: 0,
        deltaY: 100,
        deltaZ: 0,
        deltaMode: 0
      });

      const events = recorder.currentRecording.events;
      const wheelEvent = events.find(e => e.type === INTERACTION_TYPES.MOUSE_WHEEL);

      expect(wheelEvent).toBeDefined();
      expect(wheelEvent.data.deltaY).toBe(100);
    });

    test('should record mouse click with modifiers', () => {
      recorder.recordClick({
        x: 100,
        y: 100,
        button: 'left',
        ctrlKey: true,
        shiftKey: true
      });

      const events = recorder.currentRecording.events;
      const clickEvent = events.find(e => e.type === INTERACTION_TYPES.MOUSE_CLICK);

      expect(clickEvent.data.ctrlKey).toBe(true);
      expect(clickEvent.data.shiftKey).toBe(true);
    });

    test('should not record mouse movements if disabled', () => {
      recorder.options.recordMouseMovements = false;

      recorder.recordMouseMove({
        x: 100,
        y: 100
      });

      const events = recorder.currentRecording.events;
      const mouseMoves = events.filter(e => e.type === INTERACTION_TYPES.MOUSE_MOVE);

      expect(mouseMoves.length).toBe(0);
    });
  });

  // ==========================================
  // KEYBOARD EVENT TESTS
  // ==========================================

  describe('Keyboard Event Recording', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Keyboard Test' });
    });

    test('should record key down', () => {
      recorder.recordKeyDown({
        key: 'a',
        code: 'KeyA',
        keyCode: 65
      });

      const events = recorder.currentRecording.events;
      const keyEvent = events.find(e => e.type === INTERACTION_TYPES.KEY_DOWN);

      expect(keyEvent).toBeDefined();
      expect(keyEvent.data.key).toBe('a');
      expect(keyEvent.data.code).toBe('KeyA');
    });

    test('should record key up', () => {
      recorder.recordKeyUp({
        key: 'a',
        code: 'KeyA',
        keyCode: 65
      });

      const events = recorder.currentRecording.events;
      const keyEvent = events.find(e => e.type === INTERACTION_TYPES.KEY_UP);

      expect(keyEvent).toBeDefined();
      expect(keyEvent.data.key).toBe('a');
    });

    test('should record input event', () => {
      recorder.recordInput({
        value: 'test input',
        inputType: 'insertText',
        data: 'test input',
        element: { id: 'test-input', name: 'username' }
      });

      const events = recorder.currentRecording.events;
      const inputEvent = events.find(e => e.type === INTERACTION_TYPES.INPUT);

      expect(inputEvent).toBeDefined();
      expect(inputEvent.data.value).toBe('test input');
    });

    test('should record key press with modifiers', () => {
      recorder.recordKeyDown({
        key: 'Enter',
        code: 'Enter',
        ctrlKey: true
      });

      const events = recorder.currentRecording.events;
      const keyEvent = events.find(e => e.type === INTERACTION_TYPES.KEY_DOWN);

      expect(keyEvent.data.ctrlKey).toBe(true);
    });

    test('should not record keyboard if disabled', () => {
      recorder.options.recordKeyboard = false;

      recorder.recordKeyDown({ key: 'a' });

      const events = recorder.currentRecording.events;
      const keyEvents = events.filter(e => e.type === INTERACTION_TYPES.KEY_DOWN);

      expect(keyEvents.length).toBe(0);
    });
  });

  // ==========================================
  // SENSITIVE DATA MASKING TESTS
  // ==========================================

  describe('Sensitive Data Masking', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Masking Test' });
    });

    test('should mask password input', () => {
      recorder.recordInput({
        value: 'mypassword123',
        element: {
          type: 'password',
          name: 'password'
        }
      });

      const events = recorder.currentRecording.events;
      const inputEvent = events.find(e => e.type === INTERACTION_TYPES.INPUT);

      expect(inputEvent.data.value).toBe('***');
      expect(inputEvent.masked).toBe(true);
    });

    test('should mask password field by name', () => {
      recorder.recordInput({
        value: 'secret',
        element: {
          type: 'text',
          name: 'password'
        }
      });

      const events = recorder.currentRecording.events;
      const inputEvent = events.find(e => e.type === INTERACTION_TYPES.INPUT);

      expect(inputEvent.data.value).toBe('***');
      expect(inputEvent.masked).toBe(true);
    });

    test('should mask email field', () => {
      recorder.recordInput({
        value: 'user@example.com',
        element: {
          type: 'email',
          name: 'email'
        }
      });

      const events = recorder.currentRecording.events;
      const inputEvent = events.find(e => e.type === INTERACTION_TYPES.INPUT);

      expect(inputEvent.data.value).toBe('***');
      expect(inputEvent.masked).toBe(true);
    });

    test('should mask credit card field', () => {
      recorder.recordInput({
        value: '4111111111111111',
        element: {
          name: 'creditcard',
          id: 'cc-number'
        }
      });

      const events = recorder.currentRecording.events;
      const inputEvent = events.find(e => e.type === INTERACTION_TYPES.INPUT);

      expect(inputEvent.data.value).toBe('***');
      expect(inputEvent.masked).toBe(true);
    });

    test('should mask SSN field', () => {
      recorder.recordInput({
        value: '123-45-6789',
        element: {
          name: 'ssn'
        }
      });

      const events = recorder.currentRecording.events;
      const inputEvent = events.find(e => e.type === INTERACTION_TYPES.INPUT);

      expect(inputEvent.data.value).toBe('***');
      expect(inputEvent.masked).toBe(true);
    });

    test('should not mask non-sensitive input', () => {
      recorder.recordInput({
        value: 'John Doe',
        element: {
          name: 'name'
        }
      });

      const events = recorder.currentRecording.events;
      const inputEvent = events.find(e => e.type === INTERACTION_TYPES.INPUT);

      expect(inputEvent.data.value).toBe('John Doe');
      expect(inputEvent.masked).toBe(false);
    });

    test('should not mask if masking is disabled', () => {
      recorder.options.maskSensitiveData = false;

      recorder.recordInput({
        value: 'password123',
        element: {
          type: 'password'
        }
      });

      const events = recorder.currentRecording.events;
      const inputEvent = events.find(e => e.type === INTERACTION_TYPES.INPUT);

      expect(inputEvent.data.value).toBe('password123');
      expect(inputEvent.masked).toBe(false);
    });

    test('should mask keyboard input for password fields', () => {
      recorder.recordKeyDown({
        key: 'a',
        element: {
          type: 'password'
        }
      });

      const events = recorder.currentRecording.events;
      const keyEvent = events.find(e => e.type === INTERACTION_TYPES.KEY_DOWN);

      expect(keyEvent.data.key).toBe('***');
      expect(keyEvent.masked).toBe(true);
    });
  });

  // ==========================================
  // SCROLL EVENT TESTS
  // ==========================================

  describe('Scroll Event Recording', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Scroll Test' });
    });

    test('should record scroll event', (done) => {
      recorder.recordScroll({
        scrollX: 0,
        scrollY: 500,
        scrollLeft: 0,
        scrollTop: 500
      });

      // Wait for throttle
      setTimeout(() => {
        const events = recorder.currentRecording.events;
        const scrollEvent = events.find(e => e.type === INTERACTION_TYPES.SCROLL);

        expect(scrollEvent).toBeDefined();
        expect(scrollEvent.data.scrollY).toBe(500);
        done();
      }, 100);
    });

    test('should throttle scroll events', (done) => {
      // Record multiple scrolls quickly
      for (let i = 0; i < 10; i++) {
        recorder.recordScroll({
          scrollX: 0,
          scrollY: i * 100
        });
      }

      setTimeout(() => {
        const events = recorder.currentRecording.events;
        const scrollEvents = events.filter(e => e.type === INTERACTION_TYPES.SCROLL);

        // Should only have 1 scroll event (throttled)
        expect(scrollEvents.length).toBe(1);
        // Should have last position
        expect(scrollEvents[0].data.scrollY).toBe(900);
        done();
      }, 100);
    });

    test('should not record scrolls if disabled', () => {
      recorder.options.recordScrolls = false;

      recorder.recordScroll({
        scrollX: 0,
        scrollY: 500
      });

      const events = recorder.currentRecording.events;
      const scrollEvents = events.filter(e => e.type === INTERACTION_TYPES.SCROLL);

      expect(scrollEvents.length).toBe(0);
    });
  });

  // ==========================================
  // NAVIGATION AND PAGE EVENT TESTS
  // ==========================================

  describe('Navigation and Page Events', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Navigation Test' });
    });

    test('should record navigation', () => {
      recorder.recordNavigation({
        url: 'https://example.com/page2',
        type: 'navigate'
      });

      const events = recorder.currentRecording.events;
      const navEvent = events.find(e => e.type === INTERACTION_TYPES.NAVIGATION);

      expect(navEvent).toBeDefined();
      expect(navEvent.data.url).toBe('https://example.com/page2');
      expect(navEvent.data.type).toBe('navigate');
    });

    test('should update start URL on first navigation', () => {
      recorder.recordNavigation({
        url: 'https://example.com/start'
      });

      expect(recorder.currentRecording.startUrl).toBe('https://example.com/start');
    });

    test('should record page load', () => {
      recorder.recordLoad({
        url: 'https://example.com',
        loadTime: 1234,
        readyState: 'complete'
      });

      const events = recorder.currentRecording.events;
      const loadEvent = events.find(e => e.type === INTERACTION_TYPES.LOAD);

      expect(loadEvent).toBeDefined();
      expect(loadEvent.data.loadTime).toBe(1234);
    });

    test('should record resize', () => {
      recorder.recordResize({
        width: 1920,
        height: 1080,
        innerWidth: 1920,
        innerHeight: 1080
      });

      const events = recorder.currentRecording.events;
      const resizeEvent = events.find(e => e.type === INTERACTION_TYPES.RESIZE);

      expect(resizeEvent).toBeDefined();
      expect(resizeEvent.data.width).toBe(1920);
      expect(resizeEvent.data.height).toBe(1080);
    });

    test('should record visibility change', () => {
      recorder.recordVisibilityChange({
        hidden: true,
        visibilityState: 'hidden'
      });

      const events = recorder.currentRecording.events;
      const visEvent = events.find(e => e.type === INTERACTION_TYPES.VISIBILITY_CHANGE);

      expect(visEvent).toBeDefined();
      expect(visEvent.data.hidden).toBe(true);
    });
  });

  // ==========================================
  // ELEMENT INTERACTION TESTS
  // ==========================================

  describe('Element Interactions', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Element Test' });
    });

    test('should record focus event', () => {
      recorder.recordFocus({
        element: {
          tagName: 'input',
          id: 'test-input'
        }
      });

      const events = recorder.currentRecording.events;
      const focusEvent = events.find(e => e.type === INTERACTION_TYPES.FOCUS);

      expect(focusEvent).toBeDefined();
    });

    test('should record blur event', () => {
      recorder.recordBlur({
        element: {
          tagName: 'input',
          id: 'test-input'
        }
      });

      const events = recorder.currentRecording.events;
      const blurEvent = events.find(e => e.type === INTERACTION_TYPES.BLUR);

      expect(blurEvent).toBeDefined();
    });

    test('should record hover event', () => {
      recorder.recordHover({
        x: 100,
        y: 200,
        element: {
          tagName: 'a',
          href: 'https://example.com'
        }
      });

      const events = recorder.currentRecording.events;
      const hoverEvent = events.find(e => e.type === INTERACTION_TYPES.HOVER);

      expect(hoverEvent).toBeDefined();
      expect(hoverEvent.data.x).toBe(100);
    });

    test('should record select event', () => {
      recorder.recordSelect({
        value: 'option2',
        selectedIndex: 1,
        element: {
          tagName: 'select',
          id: 'country'
        }
      });

      const events = recorder.currentRecording.events;
      const selectEvent = events.find(e => e.type === INTERACTION_TYPES.SELECT);

      expect(selectEvent).toBeDefined();
      expect(selectEvent.data.value).toBe('option2');
    });

    test('should record change event', () => {
      recorder.recordChange({
        value: 'new value',
        element: {
          tagName: 'input',
          type: 'text'
        }
      });

      const events = recorder.currentRecording.events;
      const changeEvent = events.find(e => e.type === INTERACTION_TYPES.CHANGE);

      expect(changeEvent).toBeDefined();
      expect(changeEvent.data.value).toBe('new value');
    });

    test('should record element context', () => {
      recorder.recordClick({
        x: 100,
        y: 100,
        element: {
          tagName: 'button',
          id: 'submit-btn',
          className: 'btn btn-primary',
          textContent: 'Submit Form'
        }
      });

      const events = recorder.currentRecording.events;
      const clickEvent = events.find(e => e.type === INTERACTION_TYPES.MOUSE_CLICK);

      expect(clickEvent.element).toBeDefined();
      expect(clickEvent.element.tagName).toBe('button');
      expect(clickEvent.element.id).toBe('submit-btn');
    });
  });

  // ==========================================
  // CHECKPOINT TESTS
  // ==========================================

  describe('Checkpoints', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Checkpoint Test' });
    });

    test('should create checkpoint', () => {
      recorder.recordClick({ x: 100, y: 100 });

      const result = recorder.createCheckpoint({
        name: 'Test Checkpoint',
        description: 'After first click'
      });

      expect(result.success).toBe(true);
      expect(result.checkpoint.name).toBe('Test Checkpoint');
      expect(recorder.currentRecording.checkpoints.length).toBe(1);
    });

    test('should track event index in checkpoint', () => {
      recorder.recordClick({ x: 100, y: 100 });
      recorder.recordClick({ x: 200, y: 200 });

      recorder.createCheckpoint({ name: 'CP1' });

      const checkpoint = recorder.currentRecording.checkpoints[0];
      expect(checkpoint.eventIndex).toBe(2);
    });

    test('should track relative time in checkpoint', (done) => {
      setTimeout(() => {
        recorder.createCheckpoint({ name: 'CP1' });

        const checkpoint = recorder.currentRecording.checkpoints[0];
        expect(checkpoint.relativeTime).toBeGreaterThan(90);
        done();
      }, 100);
    });

    test('should not create checkpoint if not recording', () => {
      expect(() => {
        recorder.createCheckpoint({ name: 'Invalid' });
      }).toThrow('Cannot create checkpoint');
    });

    test('should support auto checkpoints', (done) => {
      recorder.options.autoCheckpointInterval = 100;
      recorder.startRecording({ name: 'Auto Checkpoint Test' });

      setTimeout(() => {
        expect(recorder.currentRecording.checkpoints.length).toBeGreaterThan(0);
        recorder.stopRecording();
        done();
      }, 250);
    });
  });

  // ==========================================
  // ANNOTATION TESTS
  // ==========================================

  describe('Annotations', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Annotation Test' });
    });

    test('should add annotation', () => {
      const result = recorder.addAnnotation({
        text: 'Test annotation',
        category: 'note'
      });

      expect(result.success).toBe(true);
      expect(recorder.currentRecording.annotations.length).toBe(1);
      expect(recorder.currentRecording.annotations[0].text).toBe('Test annotation');
    });

    test('should add annotation with category', () => {
      recorder.addAnnotation({
        text: 'Important issue found',
        category: 'issue'
      });

      const annotation = recorder.currentRecording.annotations[0];
      expect(annotation.category).toBe('issue');
    });

    test('should add annotation with metadata', () => {
      recorder.addAnnotation({
        text: 'Performance concern',
        metadata: { severity: 'high', impact: 'user-experience' }
      });

      const annotation = recorder.currentRecording.annotations[0];
      expect(annotation.metadata.severity).toBe('high');
    });

    test('should support retrospective annotations', () => {
      const result = recorder.stopRecording();
      const recording = recorder.currentRecording;

      recorder.addAnnotation({
        text: 'Retrospective note',
        relativeTime: 5000
      });

      expect(recording.annotations.length).toBe(1);
      expect(recording.annotations[0].relativeTime).toBe(5000);
    });
  });

  // ==========================================
  // STATISTICS TESTS
  // ==========================================

  describe('Statistics', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Stats Test' });
    });

    test('should track total events', () => {
      recorder.recordClick({ x: 100, y: 100 });
      recorder.recordClick({ x: 200, y: 200 });
      recorder.recordInput({ value: 'test' });

      expect(recorder.currentRecording.stats.totalEvents).toBe(3);
    });

    test('should track events by type', () => {
      recorder.recordClick({ x: 100, y: 100 });
      recorder.recordClick({ x: 200, y: 200 });
      recorder.recordInput({ value: 'test' });

      const stats = recorder.currentRecording.stats;
      expect(stats.eventsByType[INTERACTION_TYPES.MOUSE_CLICK]).toBe(2);
      expect(stats.eventsByType[INTERACTION_TYPES.INPUT]).toBe(1);
    });

    test('should track click count', () => {
      recorder.recordClick({ x: 100, y: 100 });
      recorder.recordMouseDown({ x: 200, y: 200 });
      recorder.recordMouseUp({ x: 200, y: 200 });

      expect(recorder.currentRecording.stats.clicks).toBe(3);
    });

    test('should track key press count', () => {
      recorder.recordKeyDown({ key: 'a' });
      recorder.recordKeyUp({ key: 'a' });
      recorder.recordInput({ value: 'test' });

      expect(recorder.currentRecording.stats.keyPresses).toBe(3);
    });

    test('should track masked events', () => {
      recorder.recordInput({
        value: 'password',
        element: { type: 'password' }
      });
      recorder.recordInput({
        value: 'username',
        element: { name: 'username' }
      });

      expect(recorder.currentRecording.stats.maskedEvents).toBe(1);
    });

    test('should calculate events per second', () => {
      const result = recorder.stopRecording();
      const stats = recorder.getStats();

      expect(stats.success).toBe(true);
      expect(stats.stats.eventsPerSecond).toBeDefined();
    });
  });

  // ==========================================
  // TIMELINE TESTS
  // ==========================================

  describe('Timeline', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Timeline Test' });
    });

    test('should get full timeline', () => {
      recorder.recordClick({ x: 100, y: 100 });
      recorder.recordInput({ value: 'test' });

      const timeline = recorder.getTimeline();

      expect(timeline.success).toBe(true);
      expect(timeline.events.length).toBe(2);
      expect(timeline.total).toBe(2);
    });

    test('should filter timeline by type', () => {
      recorder.recordClick({ x: 100, y: 100 });
      recorder.recordClick({ x: 200, y: 200 });
      recorder.recordInput({ value: 'test' });

      const timeline = recorder.getTimeline({
        type: INTERACTION_TYPES.MOUSE_CLICK
      });

      expect(timeline.events.length).toBe(2);
      expect(timeline.events[0].type).toBe(INTERACTION_TYPES.MOUSE_CLICK);
    });

    test('should paginate timeline', () => {
      for (let i = 0; i < 10; i++) {
        recorder.recordClick({ x: i, y: i });
      }

      const timeline = recorder.getTimeline({
        offset: 0,
        limit: 5
      });

      expect(timeline.events.length).toBe(5);
      expect(timeline.total).toBe(10);
      expect(timeline.offset).toBe(0);
      expect(timeline.limit).toBe(5);
    });

    test('should include checkpoints in timeline', () => {
      recorder.recordClick({ x: 100, y: 100 });
      recorder.createCheckpoint({ name: 'CP1' });

      const timeline = recorder.getTimeline();

      expect(timeline.checkpoints.length).toBe(1);
    });
  });

  // ==========================================
  // EXPORT TESTS
  // ==========================================

  describe('Export Formats', () => {
    beforeEach(() => {
      recorder.startRecording({ name: 'Export Test', startUrl: 'https://example.com' });
      recorder.recordNavigation({ url: 'https://example.com' });
      recorder.recordClick({
        x: 100,
        y: 100,
        element: { tagName: 'button', selector: '#submit' }
      });
      recorder.recordInput({
        value: 'test input',
        element: { selector: '#username' }
      });
      recorder.stopRecording();
    });

    test('should export as JSON', () => {
      const result = recorder.exportAsJSON();

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(result.data).toBeDefined();
      expect(result.filename).toContain('.json');

      const parsed = JSON.parse(result.data);
      expect(parsed.id).toBeDefined();
      expect(parsed.events).toBeDefined();
    });

    test('should export as Selenium script', () => {
      const result = recorder.exportAsSelenium();

      expect(result.success).toBe(true);
      expect(result.format).toBe('selenium');
      expect(result.data).toContain('from selenium import webdriver');
      expect(result.data).toContain('driver.get(');
      expect(result.data).toContain('.click()');
      expect(result.filename).toContain('.py');
    });

    test('should export as Puppeteer script', () => {
      const result = recorder.exportAsPuppeteer();

      expect(result.success).toBe(true);
      expect(result.format).toBe('puppeteer');
      expect(result.data).toContain('const puppeteer = require');
      expect(result.data).toContain('page.goto(');
      expect(result.data).toContain('page.click(');
      expect(result.filename).toContain('.js');
    });

    test('should export as Playwright script', () => {
      const result = recorder.exportAsPlaywright();

      expect(result.success).toBe(true);
      expect(result.format).toBe('playwright');
      expect(result.data).toContain('const { chromium } = require');
      expect(result.data).toContain('page.goto(');
      expect(result.data).toContain('page.click(');
      expect(result.data).toContain('page.fill(');
      expect(result.filename).toContain('.js');
    });

    test('should include setup in exported scripts', () => {
      const result = recorder.exportAsSelenium({ includeSetup: true });

      expect(result.data).toContain('driver = webdriver.Chrome()');
      expect(result.data).toContain('driver.quit()');
    });

    test('should exclude setup if requested', () => {
      const result = recorder.exportAsSelenium({ includeSetup: false });

      expect(result.data).not.toContain('driver = webdriver.Chrome()');
    });

    test('should include waits in exported scripts', () => {
      const result = recorder.exportAsSelenium({ includeWaits: true });

      expect(result.data).toContain('time.sleep');
    });
  });

  // ==========================================
  // HASH AND INTEGRITY TESTS
  // ==========================================

  describe('Hash and Integrity', () => {
    test('should calculate hash on stop', () => {
      recorder.startRecording({ name: 'Hash Test' });
      recorder.recordClick({ x: 100, y: 100 });

      const result = recorder.stopRecording();

      expect(result.recording.hash).toBeDefined();
      expect(result.recording.hash.length).toBe(64); // SHA-256
    });

    test('should verify hash integrity', () => {
      recorder.startRecording({ name: 'Integrity Test' });
      recorder.recordClick({ x: 100, y: 100 });
      recorder.stopRecording();

      const recording = recorder.currentRecording;
      const isValid = recording.verifyHash();

      expect(isValid).toBe(true);
    });

    test('should detect tampering', () => {
      recorder.startRecording({ name: 'Tamper Test' });
      recorder.recordClick({ x: 100, y: 100 });
      recorder.stopRecording();

      const recording = recorder.currentRecording;

      // Tamper with events
      recording.events.push(new InteractionEvent({
        type: INTERACTION_TYPES.MOUSE_CLICK,
        data: { x: 999, y: 999 }
      }));

      const isValid = recording.verifyHash();

      expect(isValid).toBe(false);
    });
  });

  // ==========================================
  // STATUS TESTS
  // ==========================================

  describe('Status and State', () => {
    test('should return idle status initially', () => {
      const status = recorder.getStatus();

      expect(status.state).toBe(RECORDING_STATE.IDLE);
      expect(status.recording).toBeNull();
    });

    test('should return recording status', () => {
      recorder.startRecording({ name: 'Status Test' });

      const status = recorder.getStatus();

      expect(status.state).toBe(RECORDING_STATE.RECORDING);
      expect(status.recording).toBeDefined();
      expect(status.recording.id).toBeDefined();
      expect(status.recording.eventCount).toBe(0);
    });

    test('should update event count in status', () => {
      recorder.startRecording({ name: 'Status Test' });
      recorder.recordClick({ x: 100, y: 100 });
      recorder.recordClick({ x: 200, y: 200 });

      const status = recorder.getStatus();

      expect(status.recording.eventCount).toBe(2);
    });
  });

  // ==========================================
  // MAX EVENTS TESTS
  // ==========================================

  describe('Max Events Limit', () => {
    test('should respect max events limit', () => {
      recorder.options.maxEvents = 5;
      recorder.startRecording({ name: 'Limit Test' });

      let eventsFired = 0;
      recorder.on('maxEventsReached', () => {
        eventsFired++;
      });

      for (let i = 0; i < 10; i++) {
        recorder.recordClick({ x: i, y: i });
      }

      expect(recorder.currentRecording.events.length).toBeLessThanOrEqual(5);
      expect(eventsFired).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // CLEANUP TESTS
  // ==========================================

  describe('Cleanup', () => {
    test('should cleanup resources', () => {
      recorder.startRecording({ name: 'Cleanup Test' });
      recorder.recordMouseMove({ x: 100, y: 100 });

      recorder.cleanup();

      expect(recorder.mouseMoveTimer).toBeNull();
      expect(recorder.scrollTimer).toBeNull();
      expect(recorder.mouseMoveBuffer.length).toBe(0);
    });

    test('should clear element cache on cleanup', () => {
      recorder.elementCache.set('test', { id: 'test' });

      recorder.cleanup();

      expect(recorder.elementCache.size).toBe(0);
    });
  });
});
