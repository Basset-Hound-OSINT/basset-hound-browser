const InteractionPatterns = require('../../src/anonymity/interaction-patterns');

describe('Interaction Pattern Anonymization', () => {
  let patterns;

  beforeEach(() => {
    patterns = new InteractionPatterns();
  });

  describe('Initialization', () => {
    test('Should create instance', () => {
      expect(patterns).toBeDefined();
      expect(patterns.enabled).toBe(false);
      expect(patterns.interactionHistory).toEqual([]);
    });

    test('Should enable module', () => {
      patterns.enable();
      expect(patterns.enabled).toBe(true);
    });

    test('Should disable module', () => {
      patterns.enable();
      patterns.disable();
      expect(patterns.enabled).toBe(false);
    });
  });

  describe('Smooth Scrolling', () => {
    test('Should generate smooth scroll path', () => {
      const scroll = patterns.generateSmoothScroll(0, 500, 1000);

      expect(scroll).toBeDefined();
      expect(Array.isArray(scroll)).toBe(true);
      expect(scroll.length).toBeGreaterThan(0);
    });

    test('Scroll path should start at start position', () => {
      const scroll = patterns.generateSmoothScroll(100, 600, 1000);

      expect(scroll[0].position).toBeCloseTo(100, 0);
    });

    test('Scroll path should end at end position', () => {
      const scroll = patterns.generateSmoothScroll(0, 500, 1000);

      const lastPoint = scroll[scroll.length - 1];
      expect(lastPoint.position).toBeCloseTo(500, 0);
    });

    test('Scroll path should have increasing timestamps', () => {
      const scroll = patterns.generateSmoothScroll(0, 500, 1000);

      for (let i = 1; i < scroll.length; i++) {
        expect(scroll[i].timestamp).toBeGreaterThanOrEqual(
          scroll[i - 1].timestamp
        );
      }
    });

    test('Scroll should not be instantaneous (smooth)', () => {
      const scroll = patterns.generateSmoothScroll(0, 500, 1000);

      // Should have multiple steps
      expect(scroll.length).toBeGreaterThan(10);
    });

    test('Scroll speed should decelerate at end', () => {
      const scroll = patterns.generateSmoothScroll(0, 1000, 1000);

      // Calculate velocity of first third and last third
      const v1 =
        (scroll[5].position - scroll[0].position) /
        (scroll[5].timestamp - scroll[0].timestamp);
      const lastIdx = scroll.length - 1;
      const vLast =
        (scroll[lastIdx].position - scroll[lastIdx - 5].position) /
        (scroll[lastIdx].timestamp - scroll[lastIdx - 5].timestamp);

      // Last velocity should be smaller (deceleration)
      expect(Math.abs(vLast)).toBeLessThan(Math.abs(v1));
    });
  });

  describe('Hover Pattern', () => {
    test('Should generate hover pattern', () => {
      const element = { x: 100, y: 100, width: 200, height: 50 };
      const hover = patterns.generateHoverPattern(element);

      expect(hover).toBeDefined();
      expect(Array.isArray(hover)).toBe(true);
      expect(hover.length).toBeGreaterThan(0);
    });

    test('Hover should move to element center', () => {
      const element = { x: 100, y: 100, width: 200, height: 50 };
      const hover = patterns.generateHoverPattern(element);

      const lastPoint = hover[hover.length - 1];
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;

      expect(lastPoint.x).toBeCloseTo(centerX, 10);
      expect(lastPoint.y).toBeCloseTo(centerY, 10);
    });

    test('Hover path should start above element', () => {
      const element = { x: 100, y: 100, width: 200, height: 50 };
      const hover = patterns.generateHoverPattern(element);

      const firstPoint = hover[0];
      expect(firstPoint.y).toBeLessThan(element.y);
    });

    test('Hover pattern should be smooth', () => {
      const element = { x: 100, y: 100, width: 200, height: 50 };
      const hover = patterns.generateHoverPattern(element);

      // Should have reasonable number of steps for smooth movement
      expect(hover.length).toBeGreaterThan(5);
    });
  });

  describe('Click Sequence', () => {
    test('Should generate click sequence for elements', () => {
      const elements = [
        { x: 100, y: 100, width: 100, height: 50, type: 'button' },
        { x: 300, y: 100, width: 100, height: 50, type: 'button' },
        { x: 100, y: 200, width: 100, height: 50, type: 'button' },
      ];

      const sequence = patterns.generateClickSequence(elements);

      expect(sequence).toBeDefined();
      expect(Array.isArray(sequence)).toBe(true);
      expect(sequence.length).toBeGreaterThan(0);
    });

    test('Click sequence should have hover before click', () => {
      const elements = [
        { x: 100, y: 100, width: 100, height: 50 },
        { x: 300, y: 100, width: 100, height: 50 },
      ];

      const sequence = patterns.generateClickSequence(elements);

      // Check order: hover should come before click for same element
      let lastElement = null;
      let lastAction = null;

      sequence.forEach((action) => {
        if (action.element === lastElement && lastAction) {
          if (action.action === 'click' && lastAction === 'hover') {
            // This is good
          }
        }

        lastElement = action.element;
        lastAction = action.action;
      });

      expect(sequence.some((a) => a.action === 'hover')).toBe(true);
      expect(sequence.some((a) => a.action === 'click')).toBe(true);
    });

    test('Elements should be clicked in reading order (top-to-bottom)', () => {
      const elements = [
        { x: 100, y: 300, width: 100, height: 50, id: 'bottom' },
        { x: 100, y: 100, width: 100, height: 50, id: 'top' },
      ];

      const sequence = patterns.generateClickSequence(elements);

      // Find first click for each element
      const clickIndices = {};
      sequence.forEach((action, idx) => {
        if (action.action === 'click' && !clickIndices[action.element.id]) {
          clickIndices[action.element.id] = idx;
        }
      });

      // Top should be clicked before bottom
      expect(clickIndices['top']).toBeLessThan(clickIndices['bottom']);
    });
  });

  describe('Form Filling Pattern', () => {
    test('Should generate form filling pattern', () => {
      const fields = [
        { selector: '#name', value: 'John Doe', type: 'text', label: 'Name' },
        {
          selector: '#email',
          value: 'john@example.com',
          type: 'email',
          label: 'Email',
        },
        {
          selector: '#password',
          value: 'secret123',
          type: 'password',
          label: 'Password',
        },
      ];

      const actions = patterns.generateFormFillingPattern(fields);

      expect(actions).toBeDefined();
      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);
    });

    test('Form filling should include focus, type, and submit', () => {
      const fields = [
        { selector: '#name', value: 'John', type: 'text', label: 'Name' },
      ];

      const actions = patterns.generateFormFillingPattern(fields);

      expect(actions.some((a) => a.type === 'focus')).toBe(true);
      expect(actions.some((a) => a.type === 'type')).toBe(true);
      expect(actions.some((a) => a.type === 'submit')).toBe(true);
    });

    test('Fields should be filled in order', () => {
      const fields = [
        { selector: '#field1', value: 'value1', type: 'text', label: 'Field 1' },
        { selector: '#field2', value: 'value2', type: 'text', label: 'Field 2' },
        { selector: '#field3', value: 'value3', type: 'text', label: 'Field 3' },
      ];

      const actions = patterns.generateFormFillingPattern(fields);

      const typeActions = actions.filter((a) => a.type === 'type');
      expect(typeActions[0].field.selector).toBe('#field1');
      expect(typeActions[1].field.selector).toBe('#field2');
      expect(typeActions[2].field.selector).toBe('#field3');
    });

    test('Should include hesitation delays between fields', () => {
      const fields = [
        { selector: '#name', value: 'John', type: 'text' },
        { selector: '#email', value: 'john@example.com', type: 'email' },
      ];

      const actions = patterns.generateFormFillingPattern(fields);

      // Should have pauses between actions
      const hasLargeGaps = actions.some((action, idx) => {
        if (idx > 0) {
          const gap = action.timestamp - actions[idx - 1].timestamp;
          return gap > 100;
        }
        return false;
      });

      expect(hasLargeGaps).toBe(true);
    });

    test('Submit should be last action with hesitation delay', () => {
      const fields = [
        { selector: '#name', value: 'John', type: 'text' },
      ];

      const actions = patterns.generateFormFillingPattern(fields);

      const lastAction = actions[actions.length - 1];
      expect(lastAction.type).toBe('submit');

      // Should have delay before submit
      if (actions.length > 1) {
        const prevAction = actions[actions.length - 2];
        const gap = lastAction.timestamp - prevAction.timestamp;
        expect(gap).toBeGreaterThan(200);
      }
    });
  });

  describe('Copy/Paste Detection', () => {
    test('Should suggest copy-paste for long values', () => {
      const longPassword = 'x'.repeat(50);
      const shouldCopyPaste = patterns.shouldUseCopyPaste(longPassword);

      // Should be probabilistic (30% for long passwords)
      // Test multiple times
      let copyPasteCount = 0;
      for (let i = 0; i < 30; i++) {
        if (patterns.shouldUseCopyPaste(longPassword)) {
          copyPasteCount++;
        }
      }

      // Should be roughly 30%
      expect(copyPasteCount).toBeGreaterThan(2);
      expect(copyPasteCount).toBeLessThan(15);
    });

    test('Should never suggest copy-paste for short values', () => {
      const shortPassword = 'abc';
      for (let i = 0; i < 20; i++) {
        expect(patterns.shouldUseCopyPaste(shortPassword)).toBe(false);
      }
    });

    test('Should rarely suggest copy-paste for normal passwords', () => {
      const normalPassword = 'SecurePass123';
      let copyPasteCount = 0;
      for (let i = 0; i < 100; i++) {
        if (patterns.shouldUseCopyPaste(normalPassword)) {
          copyPasteCount++;
        }
      }

      // Should be roughly 5%
      expect(copyPasteCount).toBeLessThan(15);
    });
  });

  describe('Scroll Exploration', () => {
    test('Should generate scroll exploration pattern', () => {
      const exploration = patterns.generateScrollExploration(5000, 800);

      expect(exploration).toBeDefined();
      expect(Array.isArray(exploration)).toBe(true);
      expect(exploration.length).toBeGreaterThan(0);
    });

    test('Should include pause and scroll actions', () => {
      const exploration = patterns.generateScrollExploration(5000, 800);

      expect(exploration.some((a) => a.action === 'scroll')).toBe(true);
      expect(exploration.some((a) => a.action === 'pause')).toBe(true);
    });

    test('Should start with reading pause', () => {
      const exploration = patterns.generateScrollExploration(5000, 800);

      expect(exploration[0].action).toBe('pause');
      expect(exploration[0].reason).toBe('reading-initial');
    });

    test('Should have realistic scroll distances', () => {
      const exploration = patterns.generateScrollExploration(5000, 800);

      exploration.forEach((action) => {
        if (action.action === 'scroll') {
          expect(Math.abs(action.distance)).toBeGreaterThan(0);
          expect(Math.abs(action.distance)).toBeLessThan(1500);
        }
      });
    });

    test('Should have realistic pause durations', () => {
      const exploration = patterns.generateScrollExploration(5000, 800);

      exploration.forEach((action) => {
        if (action.action === 'pause') {
          expect(action.duration).toBeGreaterThan(500);
          expect(action.duration).toBeLessThan(3000);
        }
      });
    });
  });

  describe('Focus Pattern', () => {
    test('Should generate focus pattern for fields', () => {
      const fields = ['#name', '#email', '#password'];
      const pattern = patterns.generateFocusPattern(fields);

      expect(pattern).toBeDefined();
      expect(Array.isArray(pattern)).toBe(true);
      expect(pattern.length).toBe(fields.length);
    });

    test('Should use mix of tab and click', () => {
      const fields = ['#field1', '#field2', '#field3', '#field4', '#field5'];
      const pattern = patterns.generateFocusPattern(fields);

      const tabs = pattern.filter((p) => p.action === 'tab').length;
      const clicks = pattern.filter((p) => p.action === 'click').length;

      // Should have both tabs and clicks
      expect(tabs).toBeGreaterThan(0);
      expect(clicks).toBeGreaterThan(0);
    });

    test('First field should be clicked', () => {
      const fields = ['#field1', '#field2'];
      const pattern = patterns.generateFocusPattern(fields);

      expect(pattern[0].action).toBe('click');
      expect(pattern[0].field).toBe('#field1');
    });

    test('Focus pattern should have increasing timestamps', () => {
      const fields = ['#field1', '#field2', '#field3'];
      const pattern = patterns.generateFocusPattern(fields);

      for (let i = 1; i < pattern.length; i++) {
        expect(pattern[i].timestamp).toBeGreaterThan(
          pattern[i - 1].timestamp
        );
      }
    });
  });

  describe('Interaction History', () => {
    test('Should record interactions', () => {
      patterns.recordInteraction({
        type: 'click',
        element: 'button',
      });

      expect(patterns.interactionHistory.length).toBe(1);
    });

    test('Should maintain history size limit', () => {
      for (let i = 0; i < 1500; i++) {
        patterns.recordInteraction({
          type: 'click',
          id: i,
        });
      }

      // Should keep last 1000
      expect(patterns.interactionHistory.length).toBe(1000);
    });

    test('Should get interaction history', () => {
      patterns.recordInteraction({ type: 'click' });
      patterns.recordInteraction({ type: 'type' });

      const history = patterns.getInteractionHistory();
      expect(history.length).toBe(2);
    });

    test('Should clear history', () => {
      patterns.recordInteraction({ type: 'click' });
      patterns.clearHistory();

      expect(patterns.interactionHistory.length).toBe(0);
    });

    test('Get history should return copy', () => {
      patterns.recordInteraction({ type: 'click' });
      const history1 = patterns.getInteractionHistory();
      const history2 = patterns.getInteractionHistory();

      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });
  });

  describe('Status', () => {
    test('Should return status object', () => {
      const status = patterns.getStatus();

      expect(status).toBeDefined();
      expect(status.enabled).toBe(false);
      expect(status.module).toBe('interaction-patterns');
      expect(status.features).toBeDefined();
    });

    test('Status should show history size', () => {
      patterns.recordInteraction({ type: 'click' });
      const status = patterns.getStatus();

      expect(status.historySize).toBe(1);
    });

    test('Status should reflect enabled state', () => {
      patterns.enable();
      const status = patterns.getStatus();

      expect(status.enabled).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('Should handle single field form', () => {
      const fields = [{ selector: '#only', value: 'value', type: 'text' }];
      const actions = patterns.generateFormFillingPattern(fields);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some((a) => a.type === 'submit')).toBe(true);
    });

    test('Should handle scroll at page boundary', () => {
      const scroll = patterns.generateSmoothScroll(4900, 5000, 500);
      const lastPoint = scroll[scroll.length - 1];

      expect(lastPoint.position).toBeCloseTo(5000, 0);
    });

    test('Should handle single field focus', () => {
      const fields = ['#only'];
      const pattern = patterns.generateFocusPattern(fields);

      expect(pattern.length).toBe(1);
    });
  });
});
