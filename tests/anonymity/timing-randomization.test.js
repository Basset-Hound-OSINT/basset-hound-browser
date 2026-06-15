const TimingRandomization = require('../../src/anonymity/timing-randomization');

describe('Timing Randomization', () => {
  let timing;

  beforeEach(() => {
    timing = new TimingRandomization();
  });

  describe('Initialization', () => {
    test('Should create instance', () => {
      expect(timing).toBeDefined();
      expect(timing.enabled).toBe(false);
    });

    test('Should enable module', () => {
      timing.enable();
      expect(timing.enabled).toBe(true);
    });

    test('Should disable module', () => {
      timing.enable();
      timing.disable();
      expect(timing.enabled).toBe(false);
    });
  });

  describe('Gaussian Distribution', () => {
    test('Should generate Gaussian random numbers', () => {
      // Generate many samples and check distribution
      const samples = [];
      for (let i = 0; i < 1000; i++) {
        samples.push(timing._gaussianRandom());
      }

      const mean = samples.reduce((a, b) => a + b) / samples.length;
      const variance =
        samples.reduce((sum, x) => sum + Math.pow(x - mean, 2)) / samples.length;

      // Mean should be near 0, variance near 1
      expect(mean).toBeCloseTo(0, 0);
      expect(variance).toBeCloseTo(1, 0);
    });

    test('Should generate delays with Gaussian distribution', () => {
      const delays = [];
      for (let i = 0; i < 1000; i++) {
        delays.push(timing.gaussianDelay(300, 100));
      }

      const mean = delays.reduce((a, b) => a + b) / delays.length;

      // Mean should be near 300ms
      expect(mean).toBeCloseTo(300, -1);
      // All delays should be positive
      expect(delays.every((d) => d >= 0)).toBe(true);
    });

    test('Gaussian delays should be non-negative', () => {
      for (let i = 0; i < 100; i++) {
        const delay = timing.gaussianDelay(100, 50);
        expect(delay).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Click Delay', () => {
    test('Should generate realistic click delay', () => {
      const delay = timing.generateClickDelay();

      // Realistic reaction time: 100-500ms, avg ~300ms
      expect(delay).toBeGreaterThan(100);
      expect(delay).toBeLessThan(500);
    });

    test('Click delays should vary', () => {
      const delays = [];
      for (let i = 0; i < 50; i++) {
        delays.push(timing.generateClickDelay());
      }

      const unique = new Set(delays);
      expect(unique.size).toBeGreaterThan(20);
    });

    test('Click delays should cluster around 300ms', () => {
      const delays = [];
      for (let i = 0; i < 1000; i++) {
        delays.push(timing.generateClickDelay());
      }

      const mean = delays.reduce((a, b) => a + b) / delays.length;
      expect(mean).toBeCloseTo(300, -1);
    });
  });

  describe('Scroll Pause', () => {
    test('Should generate scroll pause without content length', () => {
      const pause = timing.generateScrollPause();

      // Generic scroll pause: 1-3 seconds
      expect(pause).toBeGreaterThan(500);
      expect(pause).toBeLessThan(3500);
    });

    test('Should generate scroll pause with content length', () => {
      const contentLength = 1000; // ~200 words
      const pause = timing.generateScrollPause(contentLength);

      // Should be scaled to content
      expect(pause).toBeGreaterThan(500);
      expect(pause).toBeLessThan(100000); // Very large range due to Gaussian randomization
    });

    test('Longer content should have longer pause', () => {
      const pause1 = timing.generateScrollPause(100);
      const pause2 = timing.generateScrollPause(5000);

      // On average, longer content = longer reading time
      // Test probabilistically true
      let longer = 0;
      for (let i = 0; i < 20; i++) {
        if (
          timing.generateScrollPause(5000) >
          timing.generateScrollPause(100)
        ) {
          longer++;
        }
      }

      expect(longer).toBeGreaterThan(10);
    });
  });

  describe('Navigation Delay', () => {
    test('Should generate normal navigation delay', () => {
      const delay = timing.generateNavigationDelay('normal');

      expect(delay).toBeGreaterThan(200);
      expect(delay).toBeLessThan(1000);
    });

    test('Should generate quick navigation delay', () => {
      const delay = timing.generateNavigationDelay('quick');

      expect(delay).toBeGreaterThan(150);
      expect(delay).toBeLessThan(500);
    });

    test('Should generate careful navigation delay', () => {
      const delay = timing.generateNavigationDelay('careful');

      expect(delay).toBeGreaterThan(500);
      expect(delay).toBeLessThan(2000);
    });

    test('Careful should be longer than quick', () => {
      let carefulLonger = 0;
      for (let i = 0; i < 20; i++) {
        if (
          timing.generateNavigationDelay('careful') >
          timing.generateNavigationDelay('quick')
        ) {
          carefulLonger++;
        }
      }

      expect(carefulLonger).toBeGreaterThan(15);
    });
  });

  describe('Form Field Delay', () => {
    test('Should generate form field delay', () => {
      const delay = timing.generateFormFieldDelay();

      expect(delay).toBeGreaterThan(100);
      expect(delay).toBeLessThan(500);
    });

    test('Should generate form submission delay', () => {
      const delay = timing.generateFormSubmissionDelay();

      expect(delay).toBeGreaterThan(500);
      expect(delay).toBeLessThan(2000);
    });

    test('Submission delay should be longer than field delay', () => {
      let submissionLonger = 0;
      for (let i = 0; i < 20; i++) {
        if (
          timing.generateFormSubmissionDelay() >
          timing.generateFormFieldDelay()
        ) {
          submissionLonger++;
        }
      }

      expect(submissionLonger).toBeGreaterThan(15);
    });
  });

  describe('Page Load Wait', () => {
    test('Should generate page load wait time', () => {
      const estimatedLoad = 2000;
      const wait = timing.generatePageLoadWait(estimatedLoad);

      // Should be slightly after estimated load time
      expect(wait).toBeGreaterThan(estimatedLoad);
      expect(wait).toBeLessThan(estimatedLoad + 2000);
    });

    test('Should add extra wait time', () => {
      const wait1 = timing.generatePageLoadWait(1000);
      const wait2 = timing.generatePageLoadWait(2000);

      // wait2 should generally be longer (higher base time)
      expect(wait2).toBeGreaterThan(wait1 - 500); // Allow some variance
    });
  });

  describe('Focus Delay', () => {
    test('Should generate focus delay', () => {
      const delay = timing.generateFocusDelay();

      expect(delay).toBeGreaterThan(50);
      expect(delay).toBeLessThan(300);
    });
  });

  describe('Double-click Delay', () => {
    test('Should generate double-click delay', () => {
      const delay = timing.generateDoubleClickDelay();

      // Human double-click: 300-500ms typically
      expect(delay).toBeGreaterThan(200);
      expect(delay).toBeLessThan(600);
    });
  });

  describe('Context Menu Delay', () => {
    test('Should generate context menu delay', () => {
      const delay = timing.generateContextMenuDelay();

      expect(delay).toBeGreaterThan(200);
      expect(delay).toBeLessThan(700);
    });
  });

  describe('Modal Wait Time', () => {
    test('Should generate modal wait time', () => {
      const wait = timing.generateModalWaitTime();

      // 300-800ms for animation + readiness
      expect(wait).toBeGreaterThan(300);
      expect(wait).toBeLessThan(800);
    });
  });

  describe('CAPTCHA Think Time', () => {
    test('Should generate CAPTCHA think time', () => {
      const time = timing.generateCaptchaThinkTime();

      // 2-8 seconds to solve
      expect(time).toBeGreaterThan(1000);
      expect(time).toBeLessThan(10000);
    });
  });

  describe('Keyboard Pause', () => {
    test('Should generate keyboard pause for normal input', () => {
      const pause = timing.generateKeyboardPause(false);

      expect(pause).toBeGreaterThan(100);
      expect(pause).toBeLessThan(400);
    });

    test('Should generate keyboard pause for special input', () => {
      const pause = timing.generateKeyboardPause(true);

      // Password fields: more careful
      expect(pause).toBeGreaterThan(200);
      expect(pause).toBeLessThan(800);
    });

    test('Special input should have longer pause', () => {
      let specialLonger = 0;
      for (let i = 0; i < 20; i++) {
        if (
          timing.generateKeyboardPause(true) >
          timing.generateKeyboardPause(false)
        ) {
          specialLonger++;
        }
      }

      expect(specialLonger).toBeGreaterThan(12);
    });
  });

  describe('Action Sequence Delay', () => {
    test('Should generate click action delay', () => {
      const delay = timing.generateActionSequenceDelay('click');

      expect(delay).toBeGreaterThan(150);
      expect(delay).toBeLessThan(500);
    });

    test('Should generate type action delay', () => {
      const delay = timing.generateActionSequenceDelay('type');

      expect(delay).toBeGreaterThan(100);
      expect(delay).toBeLessThan(300);
    });

    test('Should generate scroll action delay', () => {
      const delay = timing.generateActionSequenceDelay('scroll');

      expect(delay).toBeGreaterThan(500);
      expect(delay).toBeLessThan(2000);
    });

    test('Should generate navigate action delay', () => {
      const delay = timing.generateActionSequenceDelay('navigate');

      expect(delay).toBeGreaterThan(500);
      expect(delay).toBeLessThan(2000);
    });

    test('Scroll should be longer than type', () => {
      let scrollLonger = 0;
      for (let i = 0; i < 20; i++) {
        if (
          timing.generateActionSequenceDelay('scroll') >
          timing.generateActionSequenceDelay('type')
        ) {
          scrollLonger++;
        }
      }

      expect(scrollLonger).toBeGreaterThan(15);
    });
  });

  describe('Delay Validation', () => {
    test('Should validate realistic delay', () => {
      expect(timing.isRealisticDelay(100)).toBe(true);
      expect(timing.isRealisticDelay(1000)).toBe(true);
      expect(timing.isRealisticDelay(10000)).toBe(true);
    });

    test('Should reject too-small delay', () => {
      expect(timing.isRealisticDelay(5)).toBe(false);
    });

    test('Should reject too-large delay', () => {
      expect(timing.isRealisticDelay(60000)).toBe(false);
    });

    test('Should accept boundary delays', () => {
      expect(timing.isRealisticDelay(10)).toBe(true);
      expect(timing.isRealisticDelay(30000)).toBe(true);
    });
  });

  describe('Status', () => {
    test('Should return status object', () => {
      const status = timing.getStatus();

      expect(status).toBeDefined();
      expect(status.enabled).toBe(false);
      expect(status.module).toBe('timing-randomization');
      expect(status.distribution).toBe('gaussian');
      expect(status.features).toBeDefined();
    });

    test('Status should reflect enabled state', () => {
      timing.enable();
      const status = timing.getStatus();

      expect(status.enabled).toBe(true);
    });
  });

  describe('Statistical Properties', () => {
    test('Gaussian delays should not be uniformly distributed', () => {
      const delays = [];
      for (let i = 0; i < 1000; i++) {
        delays.push(timing.gaussianDelay(500, 100));
      }

      // Count delays in buckets
      const buckets = {};
      delays.forEach((d) => {
        const bucket = Math.floor(d / 50);
        buckets[bucket] = (buckets[bucket] || 0) + 1;
      });

      // Middle buckets should have more samples (Gaussian peak)
      const bucketValues = Object.values(buckets);
      const maxBucket = Math.max(...bucketValues);
      const minBucket = Math.min(...bucketValues);

      // Peak should be significantly higher than edges
      expect(maxBucket).toBeGreaterThan(minBucket * 2);
    });
  });

  describe('Edge Cases', () => {
    test('Should handle zero mean', () => {
      const delay = timing.gaussianDelay(0, 50);
      expect(delay).toBeGreaterThanOrEqual(0);
    });

    test('Should handle very small standard deviation', () => {
      const delays = [];
      for (let i = 0; i < 10; i++) {
        delays.push(timing.gaussianDelay(500, 1));
      }

      // All should be close to mean
      delays.forEach((d) => {
        expect(Math.abs(d - 500)).toBeLessThan(50);
      });
    });

    test('Should handle large standard deviation', () => {
      const delay = timing.gaussianDelay(500, 300);
      expect(delay).toBeGreaterThanOrEqual(0);
    });
  });
});
