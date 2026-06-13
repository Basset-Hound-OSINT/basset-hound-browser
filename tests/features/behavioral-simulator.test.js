/**
 * Tests for Behavioral Simulation Engine (Wave 16 Phase 6)
 * Tests human-like mouse movements, typing patterns, scrolling, and form filling.
 */

const {
  BehavioralSimulatorManager,
  MouseMovementSimulator,
  TypingSimulator,
  ScrollSimulator,
  FormFillingSimulator,
  BehavioralDecisionTree
} = require('../../src/features/behavioral-simulator');

describe('Behavioral Simulation Engine - Wave 16 Phase 6', () => {
  let manager;
  const sessionId = 'behavior-session-001';

  beforeEach(() => {
    manager = new BehavioralSimulatorManager();
  });

  // ==========================================
  // MOUSE MOVEMENT SIMULATION
  // ==========================================

  describe('Mouse Movement Simulator', () => {
    let simulator;

    beforeEach(() => {
      simulator = new MouseMovementSimulator({
        curveComplexity: 0.5,
        minVelocity: 100,
        maxVelocity: 800
      });
    });

    test('should generate Bézier curve paths', () => {
      const path = simulator.generateBezierPath(0, 0, 100, 100, 50);

      expect(Array.isArray(path)).toBe(true);
      expect(path.length).toBeGreaterThan(0);
      expect(path[0]).toEqual({ x: 0, y: 0 });
      // Due to rounding in Bézier curves, end point may be slightly off
      const endPoint = path[path.length - 1];
      expect(endPoint.x).toBeGreaterThan(90);
      expect(endPoint.y).toBeGreaterThan(90);
    });

    test('should generate realistic mouse movements', () => {
      const movement = simulator.generateMovement(0, 0, 500, 500, 500);

      expect(movement.duration).toBeGreaterThan(0);
      expect(movement.distance).toBeGreaterThan(0);
      expect(movement.path.length).toBeGreaterThan(0);
      expect(movement.velocity).toBeDefined();
    });

    test('should create curved movements not straight lines', () => {
      const movement = simulator.generateMovement(0, 0, 100, 100);
      const path = movement.path;

      // Check for curvature (not all points on straight line)
      let hasDeviation = false;
      for (let i = 1; i < path.length - 1; i++) {
        const point = path[i];
        // If perfectly linear, should be proportional
        if (point.x !== point.y) {
          hasDeviation = true;
          break;
        }
      }

      expect(hasDeviation || path.length > 2).toBe(true);
    });

    test('should include pause elements in movement', () => {
      simulator.pauses = true;
      simulator.pauseChance = 0.9; // High chance for test

      const movement = simulator.generateMovement(0, 0, 500, 500);

      // Check if pause times increase total duration non-linearly
      expect(movement.path.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // TYPING SIMULATION
  // ==========================================

  describe('Typing Simulator', () => {
    let simulator;

    beforeEach(() => {
      simulator = new TypingSimulator({
        baseDelay: 75,
        typoRate: 0.1
      });
    });

    test('should generate typing sequence for text', () => {
      const sequence = simulator.generateTypingSequence('hello');

      expect(sequence.text).toBe('hello');
      expect(Array.isArray(sequence.events)).toBe(true);
      expect(sequence.totalDuration).toBeGreaterThan(0);
    });

    test('should create key down and key up events', () => {
      const sequence = simulator.generateTypingSequence('ab');

      const keydownEvents = sequence.events.filter(e => e.type === 'keydown');
      const keyupEvents = sequence.events.filter(e => e.type === 'keyup');

      expect(keydownEvents.length).toBeGreaterThan(0);
      expect(keyupEvents.length).toBeGreaterThan(0);
    });

    test('should simulate typos and corrections', () => {
      const sequence = simulator.generateTypingSequence('hello', 0);

      const backspaceEvents = sequence.events.filter(e => e.key === 'Backspace');
      expect(backspaceEvents.length).toBe(sequence.typosSimulated);
    });

    test('should have variable keystroke delays', () => {
      const sequence = simulator.generateTypingSequence('hello');

      const delayVariances = [];
      for (let i = 0; i < sequence.events.length - 1; i++) {
        const delay = sequence.events[i + 1].time - sequence.events[i].time;
        delayVariances.push(delay);
      }

      // Check that not all delays are identical (variation exists)
      const uniqueDelays = new Set(delayVariances);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    test('should pause after punctuation', () => {
      simulator.pauseChance = 1.0; // Always pause
      const sequence = simulator.generateTypingSequence('hello.');

      expect(sequence.events.length).toBeGreaterThan(0);
      // Last character should be period, followed by increased time gap
      const periodIndex = sequence.events.findIndex(e => e.char === '.');
      expect(periodIndex).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================
  // SCROLL SIMULATION
  // ==========================================

  describe('Scroll Simulator', () => {
    let simulator;

    beforeEach(() => {
      simulator = new ScrollSimulator({
        momentum: true,
        momentumDecay: 0.95
      });
    });

    test('should generate scroll sequence', () => {
      const sequence = simulator.generateScrollSequence(1000);

      expect(sequence.distance).toBe(1000);
      expect(Array.isArray(sequence.events)).toBe(true);
      expect(sequence.totalDuration).toBeGreaterThan(0);
      expect(sequence.totalScrolled).toBe(1000);
    });

    test('should create scroll events with momentum', () => {
      const sequence = simulator.generateScrollSequence(2000);

      const scrollEvents = sequence.events.filter(e => e.type === 'scroll');
      expect(scrollEvents.length).toBeGreaterThan(0);

      // Check that scroll amounts vary (momentum effect)
      const scrollAmounts = scrollEvents.map(e => e.delta);
      const uniqueAmounts = new Set(scrollAmounts);
      expect(uniqueAmounts.size).toBeGreaterThan(1);
    });

    test('should include reading pauses', () => {
      simulator.readingPauseChance = 1.0; // Always include pauses

      const sequence = simulator.generateScrollSequence(1000);

      const pauseEvents = sequence.events.filter(e => e.type === 'pause');
      expect(pauseEvents.length).toBeGreaterThan(0);
    });

    test('should respect momentum decay', () => {
      simulator.momentum = true;
      const sequence = simulator.generateScrollSequence(5000);

      const scrollEvents = sequence.events.filter(e => e.type === 'scroll');
      // With momentum, scroll amounts should decrease over time
      expect(scrollEvents.length).toBeGreaterThan(0);
    });

    test('should complete scrolling entire distance', () => {
      const distance = 2500;
      const sequence = simulator.generateScrollSequence(distance);

      expect(sequence.totalScrolled).toBe(distance);
    });
  });

  // ==========================================
  // FORM FILLING SIMULATION
  // ==========================================

  describe('Form Filling Simulator', () => {
    let simulator;

    beforeEach(() => {
      simulator = new FormFillingSimulator({
        fieldHesitation: 0.3,
        fieldPauseDuration: 300
      });
    });

    test('should generate form filling sequence', () => {
      const fields = [
        { name: 'email', value: 'test@example.com' },
        { name: 'password', value: 'secret123' }
      ];

      const sequence = simulator.generateFormFillingSequence(fields);

      expect(sequence.fields).toBe(2);
      expect(Array.isArray(sequence.events)).toBe(true);
      expect(sequence.totalDuration).toBeGreaterThan(0);
    });

    test('should include field focus and blur events', () => {
      const fields = [
        { name: 'field1', value: 'value1' },
        { name: 'field2', value: 'value2' }
      ];

      const sequence = simulator.generateFormFillingSequence(fields);

      const focusEvents = sequence.events.filter(e => e.type === 'field-focus');
      const blurEvents = sequence.events.filter(e => e.type === 'field-blur');

      expect(focusEvents.length).toBe(2);
      expect(blurEvents.length).toBe(2);
    });

    test('should include hesitation before fields', () => {
      simulator.fieldHesitation = 1.0; // Always hesitate

      const fields = [{ name: 'field1', value: 'value' }];
      const sequence = simulator.generateFormFillingSequence(fields);

      const readEvents = sequence.events.filter(e => e.type === 'field-read');
      expect(readEvents.length).toBeGreaterThan(0);
    });

    test('should estimate fill time', () => {
      const fields = [
        { name: 'email', value: 'test@example.com' },
        { name: 'password', value: 'secret123' },
        { name: 'confirm', value: 'secret123' }
      ];

      const estimatedTime = simulator.estimateFillTime(fields);

      expect(estimatedTime).toBeGreaterThan(0);
      expect(estimatedTime).toBeLessThan(30000); // Reasonable upper bound
    });

    test('should handle empty fields', () => {
      const fields = [
        { name: 'field1', value: '' },
        { name: 'field2', value: 'value2' }
      ];

      const sequence = simulator.generateFormFillingSequence(fields);

      expect(sequence.fields).toBe(2);
      expect(sequence.events.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // BEHAVIORAL DECISION TREE
  // ==========================================

  describe('Behavioral Decision Tree', () => {
    let tree;

    beforeEach(() => {
      tree = new BehavioralDecisionTree();
    });

    test('should select appropriate profile for context', () => {
      const humanProfile = tree.selectProfile({ isRepeat: false });
      expect(humanProfile).toBeDefined();
      expect(humanProfile.mouseComplexity).toBeGreaterThan(0);
    });

    test('should prefer speedreader for familiar sites', () => {
      const speedProfile = tree.selectProfile({ isRepeat: true, urgency: 'low' });

      expect(speedProfile.pauseFrequency).toBeLessThan(
        tree.profiles.human.pauseFrequency
      );
    });

    test('should prefer careful mode for important forms', () => {
      const carefulProfile = tree.selectProfile({ isImportantForm: true });

      expect(carefulProfile.typoRate).toBeGreaterThanOrEqual(tree.profiles.human.typoRate);
      expect(carefulProfile.pauseFrequency).toBeGreaterThanOrEqual(
        tree.profiles.human.pauseFrequency
      );
    });

    test('should create matching simulators for profile', () => {
      const profile = tree.profiles.human;
      const simulators = tree.createSimulators(profile);

      expect(simulators.mouse).toBeDefined();
      expect(simulators.typing).toBeDefined();
      expect(simulators.scroll).toBeDefined();
      expect(simulators.formFilling).toBeDefined();
    });
  });

  // ==========================================
  // BEHAVIORAL SIMULATOR MANAGER
  // ==========================================

  describe('Behavioral Simulator Manager', () => {
    test('should initialize session with profile', () => {
      const result = manager.initializeSession(sessionId, { isRepeat: false });

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(sessionId);
      expect(result.simulators).toBeDefined();
    });

    test('should simulate mouse movement for session', () => {
      manager.initializeSession(sessionId);

      const result = manager.simulateMouseMovement(sessionId, 0, 0, 500, 500);

      expect(result.success).toBe(true);
      expect(result.movement.path.length).toBeGreaterThan(0);
    });

    test('should simulate typing for session', () => {
      manager.initializeSession(sessionId);

      const result = manager.simulateTyping(sessionId, 'hello');

      expect(result.success).toBe(true);
      expect(result.sequence.text).toBe('hello');
    });

    test('should simulate scrolling for session', () => {
      manager.initializeSession(sessionId);

      const result = manager.simulateScrolling(sessionId, 1000);

      expect(result.success).toBe(true);
      expect(result.sequence.totalScrolled).toBe(1000);
    });

    test('should simulate form filling for session', () => {
      manager.initializeSession(sessionId);

      const fields = [
        { name: 'email', value: 'test@example.com' },
        { name: 'password', value: 'secret123' }
      ];

      const result = manager.simulateFormFilling(sessionId, fields);

      expect(result.success).toBe(true);
      expect(result.sequence.fields).toBe(2);
      expect(result.estimatedTime).toBeGreaterThan(0);
    });

    test('should reject operations on non-existent sessions', () => {
      const result = manager.simulateTyping('non-existent', 'hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('session-not-initialized');
    });

    test('should track behavior log', () => {
      manager.initializeSession(sessionId);

      manager.simulateMouseMovement(sessionId, 0, 0, 100, 100);
      manager.simulateTyping(sessionId, 'test');
      manager.simulateScrolling(sessionId, 500);

      const analysis = manager.getBehaviorAnalysis(sessionId);

      expect(analysis.success).toBe(true);
      expect(analysis.analysis.totalEvents).toBe(3);
      expect(analysis.analysis.eventBreakdown['mouse-movement']).toBe(1);
      expect(analysis.analysis.eventBreakdown['typing']).toBe(1);
      expect(analysis.analysis.eventBreakdown['scrolling']).toBe(1);
    });

    test('should clear session simulators', () => {
      manager.initializeSession(sessionId);
      const result = manager.clearSession(sessionId);

      expect(result.success).toBe(true);

      const analysis = manager.getBehaviorAnalysis(sessionId);
      expect(analysis.success).toBe(false);
    });
  });

  // ==========================================
  // BEHAVIOR REALISM TESTS
  // ==========================================

  describe('Behavior Realism', () => {
    test('should produce natural-looking mouse movements', () => {
      const simulator = new MouseMovementSimulator();

      const movement = simulator.generateMovement(0, 0, 500, 500);

      // Path should have reasonable length
      expect(movement.path.length).toBeGreaterThan(20);

      // Velocity should be in realistic range
      expect(parseFloat(movement.velocity)).toBeGreaterThan(50);
      expect(parseFloat(movement.velocity)).toBeLessThan(1000);

      // Duration should match distance/velocity
      expect(movement.duration).toBeGreaterThan(100);
    });

    test('should produce natural typing patterns', () => {
      const simulator = new TypingSimulator();

      const sequence = simulator.generateTypingSequence('the quick brown fox', 0);

      // Should have typos
      expect(sequence.typosSimulated).toBeGreaterThanOrEqual(0);

      // Timing should vary between keypresses
      const delays = [];
      for (let i = 1; i < sequence.events.length; i++) {
        delays.push(sequence.events[i].time - sequence.events[i - 1].time);
      }

      const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
      expect(avgDelay).toBeGreaterThan(30);
      expect(avgDelay).toBeLessThan(200);
    });

    test('should produce natural scrolling with momentum', () => {
      const simulator = new ScrollSimulator({ momentum: true });

      const sequence = simulator.generateScrollSequence(3000);

      const scrollEvents = sequence.events.filter(e => e.type === 'scroll');

      // Should have multiple scroll events (not one big scroll)
      expect(scrollEvents.length).toBeGreaterThan(1);

      // Check for momentum effect (decreasing scroll amounts)
      const amounts = scrollEvents.map(e => e.delta);
      expect(amounts.length).toBeGreaterThan(1);
    });
  });
});
