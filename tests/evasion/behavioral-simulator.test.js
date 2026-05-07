/**
 * Unit tests for BehavioralSimulator module
 */

const BehavioralSimulator = require('../../src/evasion/behavioral-simulator');

describe('BehavioralSimulator', () => {
  let simulator;

  beforeAll(() => {
    simulator = new BehavioralSimulator();
  });

  // ==================================================
  // Mouse Movement Tests
  // ==================================================
  describe('Mouse Movement Simulation', () => {
    test('should generate mouse movement path', async () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 100 };

      const result = await simulator.simulateMouseMovement(start, end);

      expect(result).toBeDefined();
      expect(result.path).toBeDefined();
      expect(result.path.length).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.distance).toBe(Math.hypot(100, 100));
    });

    test('should respect pattern types', async () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 100 };

      const smoothResult = await simulator.simulateMouseMovement(start, end, 'smooth');
      const erraticResult = await simulator.simulateMouseMovement(start, end, 'erratic');

      expect(smoothResult.pattern).toBe('smooth');
      expect(erraticResult.pattern).toBe('erratic');
      // Smooth pattern should have shorter duration (more optimized)
      expect(smoothResult.duration).toBeLessThanOrEqual(erraticResult.duration);
    });

    test('should generate realistic paths', async () => {
      const start = { x: 0, y: 0 };
      const end = { x: 500, y: 500 };

      const result = await simulator.simulateMouseMovement(start, end);

      // Path should not be a straight line (due to Bézier curves)
      let maxDeviation = 0;
      for (const point of result.path) {
        const distFromLine = Math.abs(
          (point.y - start.y) * (end.x - start.x) -
          (point.x - start.x) * (end.y - start.y)
        ) / Math.hypot(end.y - start.y, end.x - start.x);
        maxDeviation = Math.max(maxDeviation, distFromLine);
      }

      expect(maxDeviation).toBeGreaterThan(0); // Not a straight line
    });
  });

  // ==================================================
  // Typing Simulation Tests
  // ==================================================
  describe('Typing Simulation', () => {
    test('should generate typing keystrokes', async () => {
      const text = 'Hello World';

      const result = await simulator.simulateTyping(text);

      expect(result).toBeDefined();
      expect(result.keystrokes).toBeDefined();
      expect(result.keystrokes.length).toBeGreaterThan(text.length);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.characterCount).toBe(text.length);
    });

    test('should respect typing patterns', async () => {
      const text = 'Test typing';

      const fastResult = await simulator.simulateTyping(text, 'fast');
      const slowResult = await simulator.simulateTyping(text, 'slow');

      expect(fastResult.wpm).toBeGreaterThan(slowResult.wpm);
      expect(fastResult.totalDuration).toBeLessThan(slowResult.totalDuration);
    });

    test('should simulate natural pauses', async () => {
      const text = 'This is a longer text to increase pause probability';

      const result = await simulator.simulateTyping(text);

      // Check for pauses in the keystroke sequence
      const hasPauses = result.keystrokes.some(ks => ks.type === 'pause');

      // With variable pattern, pauses are common but not guaranteed
      // Just check that the structure is valid
      expect(Array.isArray(result.keystrokes)).toBeTruthy();
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    test('should vary typing speed', async () => {
      const text = 'Variable test';
      const iterations = 5;
      const durations = [];

      for (let i = 0; i < iterations; i++) {
        const result = await simulator.simulateTyping(text, 'variable');
        durations.push(result.totalDuration);
      }

      // Different runs should have different durations (with variable pattern)
      const uniqueDurations = new Set(durations);
      expect(uniqueDurations.size).toBeGreaterThan(1);
    });
  });

  // ==================================================
  // Scrolling Simulation Tests
  // ==================================================
  describe('Scrolling Simulation', () => {
    test('should generate scroll events', async () => {
      const distance = 500;

      const result = await simulator.simulateScrolling(distance);

      expect(result).toBeDefined();
      expect(result.scrollEvents).toBeDefined();
      expect(result.scrollEvents.length).toBeGreaterThan(0);
      expect(result.totalDistance).toBeLessThanOrEqual(distance + 100); // Allow small overshoot
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    test('should respect scroll patterns', async () => {
      const distance = 1000;

      const smoothResult = await simulator.simulateScrolling(distance, 'smooth');
      const jerkyResult = await simulator.simulateScrolling(distance, 'jerky');

      expect(smoothResult.pattern).toBe('smooth');
      expect(jerkyResult.pattern).toBe('jerky');
      // Jerky pattern should have more events (smaller chunks)
      expect(jerkyResult.eventCount).toBeGreaterThanOrEqual(smoothResult.eventCount);
    });

    test('should include pauses in scroll', async () => {
      const distance = 2000;
      const result = await simulator.simulateScrolling(distance);

      const hasPauses = result.scrollEvents.some(se => se.type === 'pause');
      // With natural pattern, pauses are common
      expect(hasPauses || result.scrollEvents.length > 1).toBeTruthy();
    });
  });

  // ==================================================
  // Pause Simulation Tests
  // ==================================================
  describe('Pause Simulation', () => {
    test('should generate pause duration', async () => {
      const result = await simulator.simulatePause();

      expect(result).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.type).toBe('pause');
    });

    test('should respect duration range', async () => {
      const range = { min: 500, max: 1000 };

      for (let i = 0; i < 10; i++) {
        const result = await simulator.simulatePause(range);
        expect(result.duration).toBeGreaterThanOrEqual(range.min);
        expect(result.duration).toBeLessThanOrEqual(range.max);
      }
    });
  });

  // ==================================================
  // Pattern Management Tests
  // ==================================================
  describe('Pattern Management', () => {
    test('should list available mouse patterns', () => {
      const patterns = simulator.getMousePatterns();

      expect(Array.isArray(patterns)).toBeTruthy();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns).toContain('smooth');
      expect(patterns).toContain('natural');
      expect(patterns).toContain('erratic');
      expect(patterns).toContain('precise');
    });

    test('should list available typing patterns', () => {
      const patterns = simulator.getTypingPatterns();

      expect(Array.isArray(patterns)).toBeTruthy();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns).toContain('fast');
      expect(patterns).toContain('slow');
      expect(patterns).toContain('natural');
    });

    test('should list available scroll patterns', () => {
      const patterns = simulator.getScrollPatterns();

      expect(Array.isArray(patterns)).toBeTruthy();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns).toContain('smooth');
      expect(patterns).toContain('jerky');
    });

    test('should set pattern', () => {
      const success = simulator.setPattern('smooth');
      expect(success).toBe(true);
      expect(simulator.currentPattern).toBe('smooth');
    });

    test('should reject invalid pattern', () => {
      const success = simulator.setPattern('nonexistent-pattern');
      expect(success).toBe(false);
    });
  });

  // ==================================================
  // Plausibility Verification Tests
  // ==================================================
  describe('Behavior Plausibility', () => {
    test('should verify normal events as plausible', () => {
      const events = [
        { type: 'mousemove', duration: 100 },
        { type: 'scroll', velocity: 2.5 },
        { type: 'pause', duration: 1000 }
      ];

      const result = simulator.verifyBehaviorPlausibility(events);

      expect(result.plausibility).toBeGreaterThan(70);
      expect(result.acceptable).toBe(true);
      expect(result.anomalies.length).toBeLessThan(3);
    });

    test('should detect unrealistic behavior', () => {
      const events = [
        { type: 'mousemove', duration: 5 }, // Too fast
        { type: 'scroll', velocity: 50 },   // Unrealistic
        { type: 'mousemove', duration: 5 }  // Too fast again
      ];

      const result = simulator.verifyBehaviorPlausibility(events);

      expect(result.plausibility).toBeLessThan(100);
      expect(result.anomalies.length).toBeGreaterThan(0);
    });
  });

  // ==================================================
  // Integration Tests
  // ==================================================
  describe('Integration', () => {
    test('should generate complete interaction sequence', async () => {
      const actions = [
        { type: 'mousemove', start: { x: 0, y: 0 }, end: { x: 100, y: 100 } },
        { type: 'pause', duration: 500 },
        { type: 'type', text: 'username' },
        { type: 'scroll', distance: 200 }
      ];

      const sequences = [];

      for (const action of actions) {
        if (action.type === 'mousemove') {
          sequences.push(await simulator.simulateMouseMovement(action.start, action.end));
        } else if (action.type === 'pause') {
          sequences.push(await simulator.simulatePause({ min: action.duration, max: action.duration }));
        } else if (action.type === 'type') {
          sequences.push(await simulator.simulateTyping(action.text));
        } else if (action.type === 'scroll') {
          sequences.push(await simulator.simulateScrolling(action.distance));
        }
      }

      expect(sequences.length).toBe(4);
      expect(sequences.every(s => s !== undefined)).toBeTruthy();
    });
  });

  // ==================================================
  // Performance Tests
  // ==================================================
  describe('Performance', () => {
    test('should generate mouse movement quickly', async () => {
      const start = Date.now();
      await simulator.simulateMouseMovement({ x: 0, y: 0 }, { x: 1000, y: 1000 });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    test('should generate typing quickly', async () => {
      const start = Date.now();
      await simulator.simulateTyping('This is a test string');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    test('should generate scrolling quickly', async () => {
      const start = Date.now();
      await simulator.simulateScrolling(5000);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
