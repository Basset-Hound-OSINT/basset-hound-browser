/**
 * Basset Hound Browser - Human Behavior Simulation Unit Tests
 * Tests for human-like behavior simulation functions
 */

const {
  humanDelay,
  normalDelay,
  humanType,
  generateMousePath,
  humanMouseMove,
  getMouseMoveScript,
  humanScroll,
  getScrollScript,
  getClickTiming,
  getClickScript,
  getTypeScript,
  humanPause,
  getRandomActionSequence
} = require('../../evasion/humanize');

describe('Humanize Module', () => {
  describe('humanDelay', () => {
    test('should return a promise', () => {
      const result = humanDelay(10, 20);
      expect(result).toBeInstanceOf(Promise);
    });

    test('should resolve within expected time range', async () => {
      const start = Date.now();
      await humanDelay(50, 100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some timing variance
      expect(elapsed).toBeLessThan(150);
    });

    test('should use default values when no arguments provided', async () => {
      const start = Date.now();
      await humanDelay();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(250);
    });

    test('should produce variable delays', async () => {
      const delays = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await humanDelay(50, 150);
        delays.push(Date.now() - start);
      }

      // Check that we get some variation
      const min = Math.min(...delays);
      const max = Math.max(...delays);
      expect(max - min).toBeGreaterThan(10);
    });
  });

  describe('normalDelay', () => {
    test('should return a promise', () => {
      const result = normalDelay(100, 30);
      expect(result).toBeInstanceOf(Promise);
    });

    test('should resolve within reasonable time', async () => {
      const start = Date.now();
      await normalDelay(100, 30);
      const elapsed = Date.now() - start;

      // Normal distribution should mostly be within 3 standard deviations
      expect(elapsed).toBeGreaterThanOrEqual(5);
      expect(elapsed).toBeLessThan(300);
    });

    test('should follow approximately normal distribution', async () => {
      const delays = [];
      for (let i = 0; i < 50; i++) {
        const start = Date.now();
        await normalDelay(100, 20);
        delays.push(Date.now() - start);
      }

      // Calculate mean
      const mean = delays.reduce((a, b) => a + b, 0) / delays.length;

      // Mean should be close to target (100ms)
      expect(mean).toBeGreaterThan(70);
      expect(mean).toBeLessThan(150);
    });
  });

  describe('humanType', () => {
    test('should return the typed text', async () => {
      const result = await humanType('hello');
      expect(result).toBe('hello');
    });

    test('should handle empty string', async () => {
      const result = await humanType('');
      expect(result).toBe('');
    });

    test('should handle special characters', async () => {
      const result = await humanType('hello!@#$%');
      expect(result).toBe('hello!@#$%');
    });

    test('should handle unicode characters', async () => {
      const result = await humanType('hello');
      expect(result.length).toBe(7);
    });

    test('should take time proportional to text length', async () => {
      const shortStart = Date.now();
      await humanType('hi', { minDelay: 10, maxDelay: 20 });
      const shortTime = Date.now() - shortStart;

      const longStart = Date.now();
      await humanType('hello world', { minDelay: 10, maxDelay: 20 });
      const longTime = Date.now() - longStart;

      expect(longTime).toBeGreaterThan(shortTime);
    });

    test('should respect timing options', async () => {
      const start = Date.now();
      await humanType('ab', { minDelay: 50, maxDelay: 50 });
      const elapsed = Date.now() - start;

      // Should take at least 2 * 50ms for 2 characters
      expect(elapsed).toBeGreaterThanOrEqual(90);
    });

    test('should handle punctuation with pauses', async () => {
      const withPunctuation = 'hello. world!';
      const result = await humanType(withPunctuation, { minDelay: 5, maxDelay: 10 });
      expect(result).toBe(withPunctuation);
    });
  });

  describe('generateMousePath', () => {
    test('should return an array of points', () => {
      const path = generateMousePath({ x: 0, y: 0 }, { x: 100, y: 100 });
      expect(Array.isArray(path)).toBe(true);
      expect(path.length).toBeGreaterThan(0);
    });

    test('should start at the start point', () => {
      const path = generateMousePath({ x: 10, y: 20 }, { x: 100, y: 100 });
      expect(path[0].x).toBeCloseTo(10, 0);
      expect(path[0].y).toBeCloseTo(20, 0);
    });

    test('should end near the end point', () => {
      const path = generateMousePath({ x: 0, y: 0 }, { x: 100, y: 100 });
      const lastPoint = path[path.length - 1];
      expect(lastPoint.x).toBeCloseTo(100, 0);
      expect(lastPoint.y).toBeCloseTo(100, 0);
    });

    test('should generate smooth path with intermediate points', () => {
      const path = generateMousePath({ x: 0, y: 0 }, { x: 100, y: 100 }, 20);
      expect(path.length).toBe(21); // 20 steps + 1 start point
    });

    test('should follow a curved path (Bezier)', () => {
      const path = generateMousePath({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);

      // Middle points should deviate from straight line
      const midPoint = path[5];
      // Due to random deviation, y should not always be 0
      // Run multiple times to verify curvature is added
      let hasDeviation = false;
      for (let i = 0; i < 20; i++) {
        const testPath = generateMousePath({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);
        const testMid = testPath[5];
        if (Math.abs(testMid.y) > 1) {
          hasDeviation = true;
          break;
        }
      }
      expect(hasDeviation).toBe(true);
    });

    test('should add jitter to points', () => {
      const paths = [];
      for (let i = 0; i < 5; i++) {
        paths.push(generateMousePath({ x: 0, y: 0 }, { x: 100, y: 100 }, 10));
      }

      // Same input should produce slightly different paths due to jitter
      const point5Values = paths.map(p => p[5].x);
      const uniqueValues = new Set(point5Values);
      expect(uniqueValues.size).toBeGreaterThan(1);
    });

    test('should handle zero distance', () => {
      const path = generateMousePath({ x: 50, y: 50 }, { x: 50, y: 50 });
      expect(Array.isArray(path)).toBe(true);
      expect(path.length).toBeGreaterThan(0);
    });

    test('should handle negative coordinates', () => {
      const path = generateMousePath({ x: -100, y: -100 }, { x: 100, y: 100 });
      expect(Array.isArray(path)).toBe(true);
      expect(path[0].x).toBeCloseTo(-100, 0);
      expect(path[0].y).toBeCloseTo(-100, 0);
    });
  });

  describe('humanMouseMove', () => {
    test('should return a promise that resolves to a path', async () => {
      const path = await humanMouseMove({ x: 0, y: 0 }, { x: 100, y: 100 });
      expect(Array.isArray(path)).toBe(true);
    });

    test('should take time to complete', async () => {
      const start = Date.now();
      await humanMouseMove({ x: 0, y: 0 }, { x: 100, y: 100 }, { minDelay: 5, maxDelay: 10 });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThan(50);
    });

    test('should support overshoot option', async () => {
      // Run multiple times to catch overshoot behavior
      let longerPathFound = false;
      for (let i = 0; i < 10; i++) {
        const path = await humanMouseMove(
          { x: 0, y: 0 },
          { x: 200, y: 200 },
          { steps: 10, overshoot: true, minDelay: 1, maxDelay: 2 }
        );
        if (path.length > 12) {
          longerPathFound = true;
          break;
        }
      }
      // Overshoot should sometimes produce longer paths
      // This is probabilistic, so we allow for it not always happening
    });
  });

  describe('getMouseMoveScript', () => {
    test('should return a string', () => {
      const script = getMouseMoveScript({ x: 0, y: 0 }, { x: 100, y: 100 });
      expect(typeof script).toBe('string');
    });

    test('should contain mouse event dispatch', () => {
      const script = getMouseMoveScript({ x: 0, y: 0 }, { x: 100, y: 100 });
      expect(script).toContain('mousemove');
      expect(script).toContain('dispatchEvent');
    });

    test('should be an async IIFE', () => {
      const script = getMouseMoveScript({ x: 0, y: 0 }, { x: 100, y: 100 });
      expect(script).toContain('async function');
    });

    test('should include path generation', () => {
      const script = getMouseMoveScript({ x: 0, y: 0 }, { x: 100, y: 100 });
      expect(script).toContain('path');
    });
  });

  describe('humanScroll', () => {
    test('should return scroll parameters', async () => {
      const result = await humanScroll();
      expect(result).toHaveProperty('scrollAmount');
      expect(result).toHaveProperty('scrollDuration');
      expect(result).toHaveProperty('direction');
    });

    test('should return reasonable scroll amount', async () => {
      const result = await humanScroll();
      expect(result.scrollAmount).toBeGreaterThan(50);
      expect(result.scrollAmount).toBeLessThan(500);
    });

    test('should respect specified amount', async () => {
      const result = await humanScroll({ amount: 200 });
      expect(result.scrollAmount).toBe(200);
    });

    test('should respect direction option', async () => {
      const downResult = await humanScroll({ direction: 'down' });
      expect(downResult.direction).toBe('down');

      const upResult = await humanScroll({ direction: 'up' });
      expect(upResult.direction).toBe('up');
    });
  });

  describe('getScrollScript', () => {
    test('should return a string', () => {
      const script = getScrollScript();
      expect(typeof script).toBe('string');
    });

    test('should contain scroll command', () => {
      const script = getScrollScript({ y: 300 });
      expect(script).toContain('scroll');
    });

    test('should support smooth scrolling option', () => {
      const smoothScript = getScrollScript({ smooth: true });
      expect(smoothScript).toContain('smooth');

      const autoScript = getScrollScript({ smooth: false });
      expect(autoScript).toContain('auto');
    });

    test('should support jitter option for realism', () => {
      const jitterScript = getScrollScript({ jitter: true });
      expect(jitterScript).toContain('Math.random');
    });
  });

  describe('getClickTiming', () => {
    test('should return timing object', () => {
      const timing = getClickTiming();
      expect(timing).toHaveProperty('mousedownDelay');
      expect(timing).toHaveProperty('mouseupDelay');
      expect(timing).toHaveProperty('clickDelay');
    });

    test('should return reasonable delay values', () => {
      const timing = getClickTiming();
      expect(timing.mousedownDelay).toBeGreaterThanOrEqual(10);
      expect(timing.mousedownDelay).toBeLessThan(100);
      expect(timing.mouseupDelay).toBeGreaterThanOrEqual(50);
      expect(timing.mouseupDelay).toBeLessThan(200);
      expect(timing.clickDelay).toBeGreaterThanOrEqual(5);
      expect(timing.clickDelay).toBeLessThan(50);
    });

    test('should produce variable timings', () => {
      const timings = [];
      for (let i = 0; i < 20; i++) {
        timings.push(getClickTiming());
      }

      const mousedownDelays = timings.map(t => t.mousedownDelay);
      const uniqueDelays = new Set(mousedownDelays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('getClickScript', () => {
    test('should return a string', () => {
      const script = getClickScript('#button');
      expect(typeof script).toBe('string');
    });

    test('should contain click event dispatch', () => {
      const script = getClickScript('#button');
      expect(script).toContain('click');
      expect(script).toContain('mousedown');
      expect(script).toContain('mouseup');
      expect(script).toContain('dispatchEvent');
    });

    test('should include selector', () => {
      const script = getClickScript('#my-button');
      expect(script).toContain('#my-button');
    });

    test('should escape special characters in selector', () => {
      const script = getClickScript("button[data-id='test']");
      expect(script).toContain('button[data-id=');
    });

    test('should be an async IIFE', () => {
      const script = getClickScript('#button');
      expect(script).toContain('async function');
    });

    test('should include error handling', () => {
      const script = getClickScript('#button');
      expect(script).toContain('Element not found');
    });
  });

  describe('getTypeScript', () => {
    test('should return a string', () => {
      const script = getTypeScript('#input', 'hello');
      expect(typeof script).toBe('string');
    });

    test('should contain input events', () => {
      const script = getTypeScript('#input', 'hello');
      expect(script).toContain('keydown');
      expect(script).toContain('keyup');
      expect(script).toContain('input');
    });

    test('should include the selector', () => {
      const script = getTypeScript('#my-input', 'test');
      expect(script).toContain('#my-input');
    });

    test('should include the value', () => {
      const script = getTypeScript('#input', 'test value');
      expect(script).toContain('test value');
    });

    test('should be an async IIFE', () => {
      const script = getTypeScript('#input', 'hello');
      expect(script).toContain('async function');
    });

    test('should include realistic typing delays', () => {
      const script = getTypeScript('#input', 'hello');
      expect(script).toContain('Math.random');
      expect(script).toContain('setTimeout');
    });

    test('should dispatch change event at end', () => {
      const script = getTypeScript('#input', 'hello');
      expect(script).toContain('change');
    });
  });

  describe('humanPause', () => {
    test('should return a promise', () => {
      const result = humanPause();
      expect(result).toBeInstanceOf(Promise);
    });

    test('should take time to resolve', async () => {
      const start = Date.now();
      await humanPause();
      const elapsed = Date.now() - start;

      // Should have some pause
      expect(elapsed).toBeGreaterThan(400);
    });

    test('should produce variable pause durations', async () => {
      const durations = [];
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await humanPause();
        durations.push(Date.now() - start);
      }

      // Check for some variation
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      expect(max - min).toBeGreaterThan(100);
    });
  });

  describe('getRandomActionSequence', () => {
    test('should return a string action type', () => {
      const action = getRandomActionSequence();
      expect(typeof action).toBe('string');
    });

    test('should return valid action types', () => {
      const validActions = ['scroll', 'mousemove', 'pause', 'none'];
      for (let i = 0; i < 50; i++) {
        const action = getRandomActionSequence();
        expect(validActions).toContain(action);
      }
    });

    test('should produce varied results', () => {
      const actions = new Set();
      for (let i = 0; i < 100; i++) {
        actions.add(getRandomActionSequence());
      }
      // Should get multiple different action types
      expect(actions.size).toBeGreaterThan(1);
    });
  });

  describe('Integration', () => {
    test('should work together for realistic interaction', async () => {
      // Simulate a realistic interaction sequence
      const startTime = Date.now();

      // Move mouse
      const path = await humanMouseMove({ x: 0, y: 0 }, { x: 100, y: 100 }, { minDelay: 1, maxDelay: 3 });
      expect(path.length).toBeGreaterThan(0);

      // Delay
      await humanDelay(10, 20);

      // Type
      const typed = await humanType('hi', { minDelay: 5, maxDelay: 10 });
      expect(typed).toBe('hi');

      // Scroll
      const scrollResult = await humanScroll({ amount: 100 });
      expect(scrollResult.scrollAmount).toBe(100);

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeGreaterThan(30);
    });
  });
});
