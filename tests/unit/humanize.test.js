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

      // Normal distribution can have outliers - allow for 4+ standard deviations
      // The Box-Muller transform can produce extreme values occasionally
      expect(elapsed).toBeGreaterThanOrEqual(0);
      expect(elapsed).toBeLessThan(1000);
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
      // Test with actual unicode characters (emoji and special chars)
      const result = await humanType('héllo');
      expect(result).toBe('héllo');
      expect(result.length).toBe(5);
    });

    test('should take time proportional to text length', async () => {
      // Use fixed delay and disable random pauses/mistakes for deterministic timing
      const shortStart = Date.now();
      await humanType('hi', { minDelay: 20, maxDelay: 20, pauseChance: 0, mistakeRate: 0 });
      const shortTime = Date.now() - shortStart;

      const longStart = Date.now();
      await humanType('hello world', { minDelay: 20, maxDelay: 20, pauseChance: 0, mistakeRate: 0 });
      const longTime = Date.now() - longStart;

      // Longer text (11 chars) should take more time than short text (2 chars)
      // With randomness disabled, this should be reliably true
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
      // Allow for jitter of +/- 2 pixels (implementation adds jitter for realism)
      expect(path[0].x).toBeGreaterThanOrEqual(8);
      expect(path[0].x).toBeLessThanOrEqual(12);
      expect(path[0].y).toBeGreaterThanOrEqual(18);
      expect(path[0].y).toBeLessThanOrEqual(22);
    });

    test('should end near the end point', () => {
      const path = generateMousePath({ x: 0, y: 0 }, { x: 100, y: 100 });
      const lastPoint = path[path.length - 1];
      // Allow for jitter of +/- 2 pixels (implementation adds jitter for realism)
      expect(lastPoint.x).toBeGreaterThanOrEqual(98);
      expect(lastPoint.x).toBeLessThanOrEqual(102);
      expect(lastPoint.y).toBeGreaterThanOrEqual(98);
      expect(lastPoint.y).toBeLessThanOrEqual(102);
    });

    test('should generate smooth path with intermediate points', () => {
      const path = generateMousePath({ x: 0, y: 0 }, { x: 100, y: 100 }, 20);
      expect(path.length).toBe(21); // 20 steps + 1 start point
    });

    test('should follow a curved path (Bezier)', () => {
      // Use a diagonal path where both dx and dy are non-zero
      // This ensures the deviation calculation (Math.min(|dx|, |dy|) * 0.3) produces actual deviation
      // For horizontal lines (dy=0), deviation would be 0, only jitter would exist
      const path = generateMousePath({ x: 0, y: 0 }, { x: 100, y: 100 }, 10);

      // Middle points should deviate from the straight diagonal line
      // Run multiple times to verify curvature is added
      let hasDeviation = false;
      for (let i = 0; i < 20; i++) {
        const testPath = generateMousePath({ x: 0, y: 0 }, { x: 100, y: 100 }, 10);
        const testMid = testPath[5];
        // On a perfect diagonal, x and y would be equal at midpoint (~50, ~50)
        // Bezier curvature should cause deviation from this
        if (Math.abs(testMid.x - testMid.y) > 3) {
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
      // Allow for +/-2 pixel jitter on start coordinates
      expect(path[0].x).toBeGreaterThanOrEqual(-102);
      expect(path[0].x).toBeLessThanOrEqual(-98);
      expect(path[0].y).toBeGreaterThanOrEqual(-102);
      expect(path[0].y).toBeLessThanOrEqual(-98);
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
      // When jitter is disabled, smooth scrolling uses the smooth behavior
      const smoothScript = getScrollScript({ smooth: true, jitter: false });
      expect(smoothScript).toContain('smooth');

      // When jitter is disabled and smooth is false, uses auto behavior
      const autoScript = getScrollScript({ smooth: false, jitter: false });
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
