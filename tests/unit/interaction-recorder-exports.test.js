/**
 * Interaction Recorder Exports Unit Tests
 *
 * Validates the record(), stop(), getRecording(), and clear() exports
 */

const {
  record,
  stop,
  getRecording,
  clear,
  InteractionRecorder,
  InteractionRecording,
  InteractionEvent,
  RecordingCheckpoint,
  INTERACTION_TYPES,
  RECORDING_STATE,
  SENSITIVE_PATTERNS
} = require('../../recording/interaction-recorder');

describe('InteractionRecorder Exports', () => {
  afterEach(() => {
    // Clean up after each test
    try {
      clear();
    } catch (e) {
      // Ignore if no active recording
    }
  });

  // ==========================================
  // RECORD() FUNCTION TESTS
  // ==========================================

  describe('record() function', () => {
    test('should be a function', () => {
      expect(typeof record).toBe('function');
    });

    test('should start recording successfully', () => {
      const result = record({
        name: 'Test Recording',
        description: 'Test description',
        startUrl: 'https://example.com'
      });

      expect(result.success).toBe(true);
      expect(result.recording.id).toBeDefined();
      expect(result.recording.name).toBe('Test Recording');
      expect(result.recording.state).toBe(RECORDING_STATE.RECORDING);
    });

    test('should throw error if already recording', () => {
      record({ name: 'First Recording' });

      expect(() => {
        record({ name: 'Second Recording' });
      }).toThrow('Recording already in progress');
    });

    test('should accept options parameter', () => {
      const result = record({
        name: 'Test Recording',
        description: 'Test',
        startUrl: 'https://example.com',
        recordMouseMovements: true,
        recordScrolls: true,
        recordKeyboard: true,
        maskSensitiveData: true,
        mouseMoveThrottle: 50
      });

      expect(result.success).toBe(true);
      expect(result.recording).toBeDefined();
    });
  });

  // ==========================================
  // STOP() FUNCTION TESTS
  // ==========================================

  describe('stop() function', () => {
    test('should be a function', () => {
      expect(typeof stop).toBe('function');
    });

    test('should throw error if no active recording', () => {
      expect(() => {
        stop();
      }).toThrow('No active recording');
    });

    test('should stop active recording successfully', () => {
      record({ name: 'Test Recording', startUrl: 'https://example.com' });

      const result = stop();

      expect(result.success).toBe(true);
      expect(result.recording.id).toBeDefined();
      expect(result.recording.state).toBe(RECORDING_STATE.STOPPED);
    });

    test('should return recording with events', () => {
      const recordResult = record({ name: 'Test Recording', startUrl: 'https://example.com' });

      const stopResult = stop();

      expect(stopResult.recording.events).toBeDefined();
      expect(Array.isArray(stopResult.recording.events)).toBe(true);
    });

    test('should include duration in stopped recording', () => {
      record({ name: 'Test Recording', startUrl: 'https://example.com' });

      const result = stop();

      expect(result.recording.duration).toBeDefined();
      expect(typeof result.recording.duration).toBe('number');
      expect(result.recording.duration).toBeGreaterThanOrEqual(0);
    });

    test('should clear default recorder after stop', () => {
      record({ name: 'Test Recording', startUrl: 'https://example.com' });
      stop();

      // Should throw because no recorder is active
      expect(() => {
        stop();
      }).toThrow('No active recording');
    });
  });

  // ==========================================
  // GETRECORDING() FUNCTION TESTS
  // ==========================================

  describe('getRecording() function', () => {
    test('should be a function', () => {
      expect(typeof getRecording).toBe('function');
    });

    test('should throw error if no active recording', () => {
      expect(() => {
        getRecording();
      }).toThrow('No active recording');
    });

    test('should return current recording when active', () => {
      const recordResult = record({ name: 'Test Recording', startUrl: 'https://example.com' });

      const result = getRecording();

      expect(result.success).toBe(true);
      expect(result.recording).toBeDefined();
      expect(result.recording.id).toBe(recordResult.recording.id);
    });

    test('should include recording metadata', () => {
      record({ name: 'Test Recording', description: 'Test Description', startUrl: 'https://example.com' });

      const result = getRecording();

      expect(result.recording.name).toBe('Test Recording');
      expect(result.recording.description).toBe('Test Description');
      expect(result.recording.startUrl).toBe('https://example.com');
    });

    test('should include events array', () => {
      record({ name: 'Test Recording', startUrl: 'https://example.com' });

      const result = getRecording();

      expect(Array.isArray(result.recording.events)).toBe(true);
    });

    test('should return JSON-serializable recording', () => {
      record({ name: 'Test Recording', startUrl: 'https://example.com' });

      const result = getRecording();

      // Should not throw
      const jsonString = JSON.stringify(result.recording);
      expect(jsonString).toBeDefined();

      // Should be able to parse back
      const parsed = JSON.parse(jsonString);
      expect(parsed.id).toBeDefined();
      expect(parsed.name).toBe('Test Recording');
    });
  });

  // ==========================================
  // CLEAR() FUNCTION TESTS
  // ==========================================

  describe('clear() function', () => {
    test('should be a function', () => {
      expect(typeof clear).toBe('function');
    });

    test('should return success object', () => {
      const result = clear();

      expect(result.success).toBe(true);
    });

    test('should clear recording when active', () => {
      record({ name: 'Test Recording', startUrl: 'https://example.com' });

      clear();

      // Should throw because recorder was cleared
      expect(() => {
        getRecording();
      }).toThrow('No active recording');
    });

    test('should be safe to call when no recording active', () => {
      // Should not throw
      expect(() => {
        clear();
      }).not.toThrow();
    });

    test('should allow new recording after clear', () => {
      record({ name: 'First Recording', startUrl: 'https://example.com' });
      const firstId = getRecording().recording.id;

      clear();

      const secondResult = record({ name: 'Second Recording', startUrl: 'https://example.com' });
      const secondId = secondResult.recording.id;

      expect(secondId).not.toBe(firstId);
    });
  });

  // ==========================================
  // CONVENIENCE FUNCTION INTEGRATION TESTS
  // ==========================================

  describe('Convenience Functions Integration', () => {
    test('should support full recording lifecycle', () => {
      // Start
      const recordResult = record({
        name: 'Lifecycle Test',
        startUrl: 'https://example.com'
      });
      expect(recordResult.success).toBe(true);

      // Get
      const getResult = getRecording();
      expect(getResult.success).toBe(true);
      expect(getResult.recording.id).toBe(recordResult.recording.id);

      // Stop
      const stopResult = stop();
      expect(stopResult.success).toBe(true);

      // Verify no more active recording
      expect(() => {
        getRecording();
      }).toThrow('No active recording');
    });

    test('should support multiple recording sessions', () => {
      // First session
      const first = record({ name: 'Session 1', startUrl: 'https://example.com' });
      const firstId = first.recording.id;
      stop();

      // Second session
      const second = record({ name: 'Session 2', startUrl: 'https://example.com' });
      const secondId = second.recording.id;
      stop();

      // Should have different IDs
      expect(firstId).not.toBe(secondId);
    });

    test('should support explicit clear between sessions', () => {
      const first = record({ name: 'Session 1', startUrl: 'https://example.com' });
      clear();

      const second = record({ name: 'Session 2', startUrl: 'https://example.com' });

      expect(second.recording.id).not.toBe(first.recording.id);
      expect(() => {
        clear();
        clear(); // Second clear should still succeed
      }).not.toThrow();
    });
  });

  // ==========================================
  // EXPORTED CLASSES & CONSTANTS
  // ==========================================

  describe('Exported Classes and Constants', () => {
    test('should export InteractionRecorder class', () => {
      expect(typeof InteractionRecorder).toBe('function');
      const recorder = new InteractionRecorder();
      expect(recorder).toBeInstanceOf(InteractionRecorder);
    });

    test('should export InteractionRecording class', () => {
      expect(typeof InteractionRecording).toBe('function');
    });

    test('should export InteractionEvent class', () => {
      expect(typeof InteractionEvent).toBe('function');
    });

    test('should export RecordingCheckpoint class', () => {
      expect(typeof RecordingCheckpoint).toBe('function');
    });

    test('should export INTERACTION_TYPES constant', () => {
      expect(typeof INTERACTION_TYPES).toBe('object');
      expect(INTERACTION_TYPES.MOUSE_CLICK).toBe('mouse_click');
      expect(INTERACTION_TYPES.KEY_PRESS).toBe('key_press');
      expect(INTERACTION_TYPES.SCROLL).toBe('scroll');
    });

    test('should export RECORDING_STATE constant', () => {
      expect(typeof RECORDING_STATE).toBe('object');
      expect(RECORDING_STATE.IDLE).toBe('idle');
      expect(RECORDING_STATE.RECORDING).toBe('recording');
      expect(RECORDING_STATE.PAUSED).toBe('paused');
      expect(RECORDING_STATE.STOPPED).toBe('stopped');
    });

    test('should export SENSITIVE_PATTERNS constant', () => {
      expect(typeof SENSITIVE_PATTERNS).toBe('object');
      expect(SENSITIVE_PATTERNS.PASSWORD).toBeInstanceOf(RegExp);
      expect(SENSITIVE_PATTERNS.EMAIL).toBeInstanceOf(RegExp);
      expect(SENSITIVE_PATTERNS.CREDIT_CARD).toBeInstanceOf(RegExp);
    });
  });
});
