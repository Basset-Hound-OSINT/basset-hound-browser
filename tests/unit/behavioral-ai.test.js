/**
 * Tests for Behavioral AI Module
 *
 * Phase 17: Enhanced Bot Detection Evasion
 */

const {
  BehavioralProfile,
  MouseMovementAI,
  TypingAI,
  HoneypotDetector,
  RateLimitAdapter,
  PHYSICS,
  TYPING,
} = require('../../evasion/behavioral-ai');

describe('BehavioralProfile', () => {
  describe('Constructor', () => {
    test('creates profile with default options', () => {
      const profile = new BehavioralProfile();

      expect(profile.seed).toBeDefined();
      expect(profile.speedMultiplier).toBeGreaterThan(0);
      expect(profile.accuracyLevel).toBeGreaterThan(0);
      expect(profile.typingWPM).toBeGreaterThan(0);
    });

    test('creates profile with specific seed', () => {
      const seed = 'test-seed';
      const profile = new BehavioralProfile({ seed });

      expect(profile.seed).toBe(seed);
    });

    test('creates reproducible profile with same seed', () => {
      const seed = 'reproducible-seed';
      const profile1 = new BehavioralProfile({ seed });
      const profile2 = new BehavioralProfile({ seed });

      expect(profile1.speedMultiplier).toBe(profile2.speedMultiplier);
      expect(profile1.typingWPM).toBe(profile2.typingWPM);
      expect(profile1.mouseSpeedBase).toBe(profile2.mouseSpeedBase);
    });

    test('accepts custom speed multiplier', () => {
      const profile = new BehavioralProfile({ speedMultiplier: 1.2 });

      expect(profile.speedMultiplier).toBe(1.2);
    });

    test('accepts custom accuracy level', () => {
      const profile = new BehavioralProfile({ accuracyLevel: 0.95 });

      expect(profile.accuracyLevel).toBe(0.95);
    });
  });

  describe('getFatigueFactor()', () => {
    test('starts at 1.0', () => {
      const profile = new BehavioralProfile();

      expect(profile.getFatigueFactor()).toBeCloseTo(1.0, 1);
    });

    test('increases over time', async () => {
      const profile = new BehavioralProfile({ fatigueRate: 0.001 });
      const initial = profile.getFatigueFactor();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      const later = profile.getFatigueFactor();
      expect(later).toBeGreaterThanOrEqual(initial);
    });

    test('caps at 1.5', () => {
      const profile = new BehavioralProfile({ fatigueRate: 1 });
      profile.sessionStartTime = Date.now() - 1000000;

      expect(profile.getFatigueFactor()).toBeLessThanOrEqual(1.5);
    });
  });

  describe('recordAction()', () => {
    test('increments action count', () => {
      const profile = new BehavioralProfile();

      expect(profile.actionCount).toBe(0);
      profile.recordAction();
      expect(profile.actionCount).toBe(1);
      profile.recordAction();
      expect(profile.actionCount).toBe(2);
    });
  });

  describe('getConfig()', () => {
    test('returns complete configuration', () => {
      const profile = new BehavioralProfile();
      const config = profile.getConfig();

      expect(config).toHaveProperty('seed');
      expect(config).toHaveProperty('speedMultiplier');
      expect(config).toHaveProperty('accuracyLevel');
      expect(config).toHaveProperty('fatigueRate');
      expect(config).toHaveProperty('typingWPM');
      expect(config).toHaveProperty('typingErrorRate');
      expect(config).toHaveProperty('mouseSpeedBase');
      expect(config).toHaveProperty('mousePrecision');
      expect(config).toHaveProperty('tremorIntensity');
      expect(config).toHaveProperty('reactionTimeBase');
    });
  });
});

describe('MouseMovementAI', () => {
  let mouseAI;
  let profile;

  beforeEach(() => {
    profile = new BehavioralProfile({ seed: 'test' });
    mouseAI = new MouseMovementAI(profile);
  });

  describe('calculateFittsTime()', () => {
    test('returns positive time', () => {
      const time = mouseAI.calculateFittsTime(100, 20);

      expect(time).toBeGreaterThan(0);
    });

    test('longer distance takes more time', () => {
      const shortTime = mouseAI.calculateFittsTime(50, 20);
      const longTime = mouseAI.calculateFittsTime(500, 20);

      expect(longTime).toBeGreaterThan(shortTime);
    });

    test('smaller target takes more time', () => {
      const bigTargetTime = mouseAI.calculateFittsTime(100, 50);
      const smallTargetTime = mouseAI.calculateFittsTime(100, 10);

      expect(smallTargetTime).toBeGreaterThan(bigTargetTime);
    });
  });

  describe('generateMinimumJerkTrajectory()', () => {
    test('generates trajectory from start to end', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 100 };
      const duration = 500;

      const points = mouseAI.generateMinimumJerkTrajectory(start, end, duration);

      expect(points.length).toBeGreaterThan(0);
      expect(points[0].x).toBeCloseTo(start.x, 1);
      expect(points[0].y).toBeCloseTo(start.y, 1);
      expect(points[points.length - 1].x).toBeCloseTo(end.x, 1);
      expect(points[points.length - 1].y).toBeCloseTo(end.y, 1);
    });

    test('includes timing information', () => {
      const points = mouseAI.generateMinimumJerkTrajectory(
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        500
      );

      expect(points[0].t).toBe(0);
      expect(points[points.length - 1].t).toBeCloseTo(500, 1);
    });

    test('follows smooth S-curve', () => {
      const points = mouseAI.generateMinimumJerkTrajectory(
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        1000
      );

      // Minimum-jerk should have slow start and end, fast middle
      const midPoint = Math.floor(points.length / 2);
      const velocity1 = points[1].x - points[0].x;
      const velocityMid = points[midPoint].x - points[midPoint - 1].x;

      // Middle velocity should be higher
      expect(velocityMid).toBeGreaterThan(velocity1 * 1.5);
    });
  });

  describe('addPhysiologicalTremor()', () => {
    test('adds tremor to points', () => {
      const originalPoints = [
        { x: 0, y: 0, t: 0 },
        { x: 50, y: 50, t: 250 },
        { x: 100, y: 100, t: 500 },
      ];

      const tremorPoints = mouseAI.addPhysiologicalTremor(originalPoints);

      // Points should be slightly different (tremor added)
      expect(tremorPoints.length).toBe(originalPoints.length);
      // At least one point should be different
      const hasDeviation = tremorPoints.some((p, i) =>
        p.x !== originalPoints[i].x || p.y !== originalPoints[i].y
      );
      expect(hasDeviation).toBe(true);
    });

    test('tremor is within reasonable bounds', () => {
      const points = [{ x: 100, y: 100, t: 0 }];
      const results = [];

      for (let i = 0; i < 100; i++) {
        const tremorPoints = mouseAI.addPhysiologicalTremor(points);
        results.push(tremorPoints[0]);
      }

      // Check that tremor is small (within a few pixels)
      for (const result of results) {
        expect(Math.abs(result.x - 100)).toBeLessThan(5);
        expect(Math.abs(result.y - 100)).toBeLessThan(5);
      }
    });
  });

  describe('generatePath()', () => {
    test('generates complete path with metadata', () => {
      const result = mouseAI.generatePath(
        { x: 0, y: 0 },
        { x: 200, y: 150 },
        30
      );

      expect(result).toHaveProperty('points');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('distance');
      expect(result).toHaveProperty('targetWidth');
      expect(result).toHaveProperty('fittsTime');
    });

    test('points array starts at start and ends near end', () => {
      const start = { x: 100, y: 100 };
      const end = { x: 500, y: 300 };

      const result = mouseAI.generatePath(start, end);
      const points = result.points;

      expect(points[0].x).toBeCloseTo(start.x, 0);
      expect(points[0].y).toBeCloseTo(start.y, 0);

      // End should be close (allowing for overshoot correction)
      const lastPoint = points[points.length - 1];
      expect(Math.abs(lastPoint.x - end.x)).toBeLessThan(50);
      expect(Math.abs(lastPoint.y - end.y)).toBeLessThan(50);
    });

    test('records action on profile', () => {
      const initialCount = profile.actionCount;
      mouseAI.generatePath({ x: 0, y: 0 }, { x: 100, y: 100 });

      expect(profile.actionCount).toBe(initialCount + 1);
    });
  });

  describe('generateScrollBehavior()', () => {
    test('generates scroll events', () => {
      const events = mouseAI.generateScrollBehavior(500, 'down');

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty('deltaY');
      expect(events[0]).toHaveProperty('t');
    });

    test('total scroll equals requested distance', () => {
      const distance = 1000;
      const events = mouseAI.generateScrollBehavior(distance, 'down');

      const totalScroll = events.reduce((sum, e) => sum + e.deltaY, 0);
      expect(totalScroll).toBeCloseTo(distance, -1); // Within 10 pixels
    });

    test('scroll direction is correct', () => {
      const downEvents = mouseAI.generateScrollBehavior(500, 'down');
      const upEvents = mouseAI.generateScrollBehavior(500, 'up');

      expect(downEvents.every(e => e.deltaY > 0)).toBe(true);
      expect(upEvents.every(e => e.deltaY < 0)).toBe(true);
    });

    test('events have increasing timestamps', () => {
      const events = mouseAI.generateScrollBehavior(500, 'down');

      for (let i = 1; i < events.length; i++) {
        expect(events[i].t).toBeGreaterThan(events[i - 1].t);
      }
    });
  });
});

describe('TypingAI', () => {
  let typingAI;
  let profile;

  beforeEach(() => {
    profile = new BehavioralProfile({ seed: 'test' });
    typingAI = new TypingAI(profile);
  });

  describe('getKeyHand()', () => {
    test('identifies left hand keys', () => {
      expect(typingAI.getKeyHand('q')).toBe('left');
      expect(typingAI.getKeyHand('s')).toBe('left');
      expect(typingAI.getKeyHand('b')).toBe('left');
    });

    test('identifies right hand keys', () => {
      expect(typingAI.getKeyHand('p')).toBe('right');
      expect(typingAI.getKeyHand('l')).toBe('right');
      expect(typingAI.getKeyHand('m')).toBe('right');
    });

    test('handles uppercase', () => {
      expect(typingAI.getKeyHand('Q')).toBe('left');
      expect(typingAI.getKeyHand('P')).toBe('right');
    });

    test('returns either for non-letter keys', () => {
      expect(typingAI.getKeyHand(' ')).toBe('either');
      expect(typingAI.getKeyHand('1')).toBe('either');
    });
  });

  describe('isCommonDigraph()', () => {
    test('identifies common digraphs', () => {
      expect(typingAI.isCommonDigraph('t', 'h')).toBe(true);
      expect(typingAI.isCommonDigraph('e', 'r')).toBe(true);
      expect(typingAI.isCommonDigraph('i', 'n')).toBe(true);
    });

    test('rejects uncommon digraphs', () => {
      expect(typingAI.isCommonDigraph('q', 'z')).toBe(false);
      expect(typingAI.isCommonDigraph('x', 'x')).toBe(false);
    });

    test('is case insensitive', () => {
      expect(typingAI.isCommonDigraph('T', 'H')).toBe(true);
      expect(typingAI.isCommonDigraph('T', 'h')).toBe(true);
    });
  });

  describe('calculateIKI()', () => {
    test('returns positive interval', () => {
      const iki = typingAI.calculateIKI('a', 'b');

      expect(iki).toBeGreaterThan(0);
    });

    test('common digraphs are faster', () => {
      const normalIKI = typingAI.calculateIKI('q', 'z');
      const digraphIKI = typingAI.calculateIKI('t', 'h');

      // Digraph should be faster (lower IKI) on average
      // Test multiple times due to randomness
      let fasterCount = 0;
      for (let i = 0; i < 20; i++) {
        if (typingAI.calculateIKI('t', 'h') < typingAI.calculateIKI('q', 'z')) {
          fasterCount++;
        }
      }
      expect(fasterCount).toBeGreaterThan(10); // More than half should be faster
    });

    test('has minimum value', () => {
      for (let i = 0; i < 50; i++) {
        const iki = typingAI.calculateIKI('a', 'b');
        expect(iki).toBeGreaterThanOrEqual(20);
      }
    });
  });

  describe('generateTypingEvents()', () => {
    test('generates events for each character', () => {
      const text = 'hello';
      const events = typingAI.generateTypingEvents(text);

      // Each character has keydown and keyup (unless there's an error)
      const keydowns = events.filter(e => e.type === 'keydown' && e.key !== 'Backspace');
      expect(keydowns.length).toBeGreaterThanOrEqual(text.length);
    });

    test('events have correct structure', () => {
      const events = typingAI.generateTypingEvents('a');

      expect(events[0]).toHaveProperty('type');
      expect(events[0]).toHaveProperty('key');
      expect(events[0]).toHaveProperty('t');
    });

    test('keydown precedes keyup', () => {
      const events = typingAI.generateTypingEvents('hello');

      const keyMap = new Map();
      for (const event of events) {
        if (event.type === 'keydown') {
          keyMap.set(`${event.key}-${event.t}`, event.t);
        } else if (event.type === 'keyup') {
          // There should be a keydown before this
          const hasKeydown = Array.from(keyMap.keys()).some(k =>
            k.startsWith(event.key + '-') && parseFloat(k.split('-')[1]) < event.t
          );
          expect(hasKeydown).toBe(true);
        }
      }
    });

    test('timestamps are increasing', () => {
      const events = typingAI.generateTypingEvents('hello world');

      let lastTime = 0;
      for (const event of events) {
        expect(event.t).toBeGreaterThanOrEqual(lastTime);
        lastTime = event.t;
      }
    });

    test('records action on profile', () => {
      const initialCount = profile.actionCount;
      typingAI.generateTypingEvents('test');

      expect(profile.actionCount).toBe(initialCount + 1);
    });
  });

  describe('calculateTypingSpeed()', () => {
    test('calculates WPM from events', () => {
      const events = typingAI.generateTypingEvents('hello world');
      const wpm = typingAI.calculateTypingSpeed(events, 11);

      expect(wpm).toBeGreaterThan(0);
      expect(wpm).toBeLessThan(200); // Reasonable upper bound
    });

    test('returns 0 for insufficient events', () => {
      const wpm = typingAI.calculateTypingSpeed([{ t: 0 }], 5);

      expect(wpm).toBe(0);
    });
  });
});

describe('HoneypotDetector', () => {
  describe('isHoneypot()', () => {
    test('detects display:none', () => {
      const element = {
        style: { display: 'none' },
        name: 'email',
      };

      const result = HoneypotDetector.isHoneypot(element);

      expect(result.indicators).toContain('display:none');
    });

    test('detects visibility:hidden', () => {
      const element = {
        style: { visibility: 'hidden' },
        name: 'email',
      };

      const result = HoneypotDetector.isHoneypot(element);

      expect(result.indicators).toContain('visibility:hidden');
    });

    test('detects zero dimensions', () => {
      const element = {
        width: 0,
        height: 0,
        style: {},
      };

      const result = HoneypotDetector.isHoneypot(element);

      expect(result.indicators).toContain('zero dimensions');
    });

    test('detects 1x1 pixel', () => {
      const element = {
        width: 1,
        height: 1,
        style: {},
      };

      const result = HoneypotDetector.isHoneypot(element);

      expect(result.indicators).toContain('1x1 pixel');
    });

    test('detects suspicious names', () => {
      const honeypotElement = {
        name: 'honeypot_field',
        style: {},
      };

      const result = HoneypotDetector.isHoneypot(honeypotElement);

      expect(result.indicators.some(i => i.includes('honeypot'))).toBe(true);
    });

    test('detects off-screen positioning', () => {
      const element = {
        style: {
          position: 'absolute',
          left: '-9999px',
        },
      };

      const result = HoneypotDetector.isHoneypot(element);

      expect(result.indicators).toContain('off-screen positioning');
    });

    test('detects tabindex:-1', () => {
      const element = {
        tabindex: -1,
        style: {},
      };

      const result = HoneypotDetector.isHoneypot(element);

      expect(result.indicators).toContain('tabindex:-1');
    });

    test('normal field is not honeypot', () => {
      const element = {
        name: 'email',
        id: 'user-email',
        style: { display: 'block' },
        width: 200,
        height: 30,
      };

      const result = HoneypotDetector.isHoneypot(element);

      expect(result.isHoneypot).toBe(false);
    });

    test('requires multiple indicators for honeypot', () => {
      const singleIndicator = {
        style: { display: 'none' },
      };

      const result = HoneypotDetector.isHoneypot(singleIndicator);

      expect(result.indicators.length).toBe(1);
      expect(result.isHoneypot).toBe(false);
    });

    test('multiple indicators means honeypot', () => {
      const multipleIndicators = {
        name: 'honeypot',
        style: { display: 'none' },
      };

      const result = HoneypotDetector.isHoneypot(multipleIndicators);

      expect(result.indicators.length).toBeGreaterThanOrEqual(2);
      expect(result.isHoneypot).toBe(true);
    });

    test('confidence increases with indicators', () => {
      const fewIndicators = {
        style: { display: 'none' },
        name: 'trap',
      };

      const manyIndicators = {
        style: { display: 'none', visibility: 'hidden', opacity: '0' },
        name: 'honeypot',
        tabindex: -1,
      };

      const result1 = HoneypotDetector.isHoneypot(fewIndicators);
      const result2 = HoneypotDetector.isHoneypot(manyIndicators);

      expect(result2.confidence).toBeGreaterThan(result1.confidence);
    });
  });

  describe('filterHoneypots()', () => {
    test('separates honeypots from safe fields', () => {
      const fields = [
        { name: 'email', style: {} },
        { name: 'honeypot', style: { display: 'none' } },
        { name: 'password', style: {} },
      ];

      const result = HoneypotDetector.filterHoneypots(fields);

      expect(result.safeFields).toHaveLength(2);
      expect(result.honeypots).toHaveLength(1);
    });

    test('handles empty array', () => {
      const result = HoneypotDetector.filterHoneypots([]);

      expect(result.safeFields).toEqual([]);
      expect(result.honeypots).toEqual([]);
    });

    test('honeypot results include detection info', () => {
      const fields = [
        { name: 'trap', style: { display: 'none' } },
      ];

      const result = HoneypotDetector.filterHoneypots(fields);

      expect(result.honeypots[0]).toHaveProperty('field');
      expect(result.honeypots[0]).toHaveProperty('indicators');
      expect(result.honeypots[0]).toHaveProperty('confidence');
    });
  });
});

describe('RateLimitAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new RateLimitAdapter();
  });

  describe('Constructor', () => {
    test('initializes with base delay', () => {
      expect(adapter.currentDelay).toBe(1000);
      expect(adapter.successStreak).toBe(0);
      expect(adapter.failureCount).toBe(0);
    });
  });

  describe('recordSuccess()', () => {
    test('increments success streak', () => {
      adapter.recordSuccess();
      adapter.recordSuccess();

      expect(adapter.successStreak).toBe(2);
    });

    test('resets failure count', () => {
      adapter.failureCount = 3;
      adapter.recordSuccess();

      expect(adapter.failureCount).toBe(0);
    });

    test('reduces delay after 5 successes', () => {
      const initialDelay = adapter.currentDelay;

      for (let i = 0; i < 6; i++) {
        adapter.recordSuccess();
      }

      expect(adapter.currentDelay).toBeLessThan(initialDelay);
    });

    test('does not go below minimum delay', () => {
      for (let i = 0; i < 100; i++) {
        adapter.recordSuccess();
      }

      expect(adapter.currentDelay).toBeGreaterThanOrEqual(adapter.minDelay);
    });
  });

  describe('recordRateLimit()', () => {
    test('resets success streak', () => {
      adapter.successStreak = 10;
      adapter.recordRateLimit({});

      expect(adapter.successStreak).toBe(0);
    });

    test('increments failure count', () => {
      adapter.recordRateLimit({});
      adapter.recordRateLimit({});

      expect(adapter.failureCount).toBe(2);
    });

    test('applies exponential backoff', () => {
      const delays = [];

      for (let i = 0; i < 4; i++) {
        adapter.recordRateLimit({});
        delays.push(adapter.currentDelay);
      }

      // Each delay should be larger than previous
      for (let i = 1; i < delays.length; i++) {
        expect(delays[i]).toBeGreaterThan(delays[i - 1]);
      }
    });

    test('respects Retry-After header', () => {
      adapter.recordRateLimit({ retryAfter: 30 });

      expect(adapter.currentDelay).toBeGreaterThanOrEqual(30000);
    });

    test('does not exceed max delay', () => {
      for (let i = 0; i < 20; i++) {
        adapter.recordRateLimit({});
      }

      expect(adapter.currentDelay).toBeLessThanOrEqual(adapter.maxDelay);
    });
  });

  describe('getDelay()', () => {
    test('returns delay with jitter', () => {
      const delays = new Set();

      for (let i = 0; i < 10; i++) {
        delays.add(adapter.getDelay());
      }

      // Should have some variation
      expect(delays.size).toBeGreaterThan(1);
    });

    test('delay is within jitter range', () => {
      const baseDelay = adapter.currentDelay;
      const maxJitter = baseDelay * 0.2;

      for (let i = 0; i < 50; i++) {
        const delay = adapter.getDelay();
        expect(delay).toBeGreaterThanOrEqual(baseDelay - maxJitter);
        expect(delay).toBeLessThanOrEqual(baseDelay + maxJitter);
      }
    });
  });

  describe('isRateLimited()', () => {
    test('detects 429 status', () => {
      expect(RateLimitAdapter.isRateLimited(429)).toBe(true);
    });

    test('detects 503 status', () => {
      expect(RateLimitAdapter.isRateLimited(503)).toBe(true);
    });

    test('does not flag normal status codes', () => {
      expect(RateLimitAdapter.isRateLimited(200)).toBe(false);
      expect(RateLimitAdapter.isRateLimited(404)).toBe(false);
      expect(RateLimitAdapter.isRateLimited(500)).toBe(false);
    });
  });

  describe('getState()', () => {
    test('returns complete state', () => {
      adapter.recordSuccess();
      adapter.recordSuccess();

      const state = adapter.getState();

      expect(state).toHaveProperty('currentDelay');
      expect(state).toHaveProperty('successStreak');
      expect(state).toHaveProperty('failureCount');
      expect(state.successStreak).toBe(2);
    });
  });
});

describe('Physics Constants', () => {
  test('Fitts Law constants are reasonable', () => {
    expect(PHYSICS.FITTS_A).toBeGreaterThan(0);
    expect(PHYSICS.FITTS_B).toBeGreaterThan(0);
  });

  test('Tremor frequency is in physiological range', () => {
    expect(PHYSICS.TREMOR_FREQ_MIN).toBeGreaterThanOrEqual(8);
    expect(PHYSICS.TREMOR_FREQ_MAX).toBeLessThanOrEqual(12);
  });

  test('Correction and overshoot probabilities are reasonable', () => {
    expect(PHYSICS.CORRECTION_PROBABILITY).toBeGreaterThan(0);
    expect(PHYSICS.CORRECTION_PROBABILITY).toBeLessThan(1);
    expect(PHYSICS.OVERSHOOT_PROBABILITY).toBeGreaterThan(0);
    expect(PHYSICS.OVERSHOOT_PROBABILITY).toBeLessThan(1);
  });
});

describe('Typing Constants', () => {
  test('IKI values are reasonable', () => {
    expect(TYPING.IKI_BASE).toBeGreaterThan(50);
    expect(TYPING.IKI_BASE).toBeLessThan(200);
    expect(TYPING.IKI_STD_DEV).toBeGreaterThan(0);
  });

  test('Common digraphs are defined', () => {
    expect(TYPING.COMMON_DIGRAPHS).toContain('th');
    expect(TYPING.COMMON_DIGRAPHS).toContain('he');
    expect(TYPING.COMMON_DIGRAPHS.length).toBeGreaterThan(20);
  });

  test('Hand keys cover alphabet', () => {
    const allKeys = TYPING.LEFT_HAND_KEYS + TYPING.RIGHT_HAND_KEYS;
    expect(allKeys.length).toBeGreaterThanOrEqual(26);
  });
});
