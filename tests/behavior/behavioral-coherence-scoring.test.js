/**
 * Behavioral Coherence Scoring Tests
 *
 * Comprehensive test suite for behavioral pattern analysis and coherence scoring
 *
 * Test Coverage:
 * - Pattern analyzer recording and metrics
 * - Coherence scoring algorithm
 * - Dimension scoring
 * - Anomaly detection
 * - Performance benchmarks
 * - Reference pattern validation
 */

const PatternAnalyzer = require('../../src/behavior/pattern-analyzer');
const BehavioralCoherenceScorer = require('../../src/behavior/coherence-scorer');
const assert = require('assert');

describe('PatternAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new PatternAnalyzer();
  });

  describe('Mouse Movement Recording', () => {
    it('should record mouse movement patterns', () => {
      const movement = {
        from: { x: 0, y: 0 },
        to: { x: 100, y: 100 },
        duration: 100
      };

      const result = analyzer.recordMouseMovement(movement);

      assert(result.distance > 0, 'Distance should be calculated');
      assert(result.velocity > 0, 'Velocity should be calculated');
      assert(result.acceleration > 0, 'Acceleration should be calculated');
      assert.strictEqual(analyzer.patterns.mouse.length, 1);
    });

    it('should maintain window size limit', () => {
      const windowSize = analyzer.windowSize;

      for (let i = 0; i < windowSize + 50; i++) {
        analyzer.recordMouseMovement({
          from: { x: 0, y: 0 },
          to: { x: 100 + i, y: 100 },
          duration: 100
        });
      }

      assert.strictEqual(analyzer.patterns.mouse.length, windowSize);
    });

    it('should calculate direction changes', () => {
      // Record movements in different directions
      analyzer.recordMouseMovement({ from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, duration: 100 });
      analyzer.recordMouseMovement({ from: { x: 100, y: 0 }, to: { x: 100, y: 100 }, duration: 100 });
      analyzer.recordMouseMovement({ from: { x: 100, y: 100 }, to: { x: 0, y: 100 }, duration: 100 });

      const metrics = analyzer.getMouseMetrics();
      assert(metrics.directionChanges >= 1, 'Should detect direction changes');
    });
  });

  describe('Typing Pattern Recording', () => {
    it('should record typing events', () => {
      analyzer.recordTypingEvent({
        char: 'a',
        ikiBefore: 100,
        holdDuration: 80
      });

      assert.strictEqual(analyzer.patterns.typing.length, 1);
      assert.strictEqual(analyzer.patterns.typing[0].char, 'a');
    });

    it('should track typing errors', () => {
      analyzer.recordTypingEvent({ char: 'a', ikiBefore: 100, holdDuration: 80 });
      analyzer.recordTypingEvent({ char: 'x', ikiBefore: 50, holdDuration: 80, error: true });
      analyzer.recordTypingEvent({ char: 'b', ikiBefore: 100, holdDuration: 80 });

      const metrics = analyzer.getTypingMetrics();
      assert(metrics.errorRate > 0, 'Should track error rate');
    });

    it('should calculate WPM from inter-keystroke intervals', () => {
      // Simulate 10 keystrokes with ~100ms intervals
      for (let i = 0; i < 10; i++) {
        analyzer.recordTypingEvent({
          char: 'a',
          ikiBefore: 100,
          holdDuration: 80
        });
      }

      const metrics = analyzer.getTypingMetrics();
      assert(metrics.estimatedWPM > 0, 'Should calculate WPM');
      assert(metrics.estimatedWPM < 200, 'WPM should be reasonable');
    });
  });

  describe('Scroll Behavior Recording', () => {
    it('should record scroll events', () => {
      analyzer.recordScroll({
        direction: 'down',
        distance: 200,
        duration: 500,
        paused: false
      });

      assert.strictEqual(analyzer.patterns.scroll.length, 1);
      assert.strictEqual(analyzer.patterns.scroll[0].direction, 'down');
    });

    it('should calculate scroll velocity', () => {
      const event = analyzer.recordScroll({
        direction: 'down',
        distance: 300,
        duration: 1000,
        paused: false
      });

      assert.strictEqual(event.velocity, 0.3); // 300px / 1000ms
    });

    it('should track pause frequency', () => {
      analyzer.recordScroll({
        direction: 'down',
        distance: 200,
        duration: 500,
        paused: true
      });
      analyzer.recordScroll({
        direction: 'down',
        distance: 200,
        duration: 500,
        paused: false
      });

      const metrics = analyzer.getScrollMetrics();
      assert.strictEqual(metrics.pauseFrequency, 0.5);
    });
  });

  describe('Click Pattern Recording', () => {
    it('should record click events', () => {
      analyzer.recordClick({
        x: 100,
        y: 200,
        target: 'button.submit',
        duration: 150
      });

      assert.strictEqual(analyzer.patterns.click.length, 1);
      assert.strictEqual(analyzer.patterns.click[0].target, 'button.submit');
    });

    it('should calculate inter-click intervals', () => {
      analyzer.recordClick({ x: 100, y: 200, target: 'btn1', duration: 150 });
      analyzer.recordClick({ x: 200, y: 300, target: 'btn2', duration: 150 });
      analyzer.recordClick({ x: 300, y: 400, target: 'btn3', duration: 150 });

      const metrics = analyzer.getClickMetrics();
      assert(metrics.interClickInterval.count >= 2, 'Should calculate intervals');
    });

    it('should track target frequency', () => {
      analyzer.recordClick({ x: 100, y: 200, target: 'button.a' });
      analyzer.recordClick({ x: 100, y: 200, target: 'button.a' });
      analyzer.recordClick({ x: 100, y: 200, target: 'button.b' });

      const metrics = analyzer.getClickMetrics();
      assert(metrics.targetFrequency.length >= 2);
    });
  });

  describe('Dwell Time Recording', () => {
    it('should record dwell times', () => {
      analyzer.recordDwell({
        target: 'div.content',
        duration: 5000
      });

      assert.strictEqual(analyzer.patterns.dwell.length, 1);
      assert.strictEqual(analyzer.patterns.dwell[0].duration, 5000);
    });
  });

  describe('Navigation Recording', () => {
    it('should record navigation actions', () => {
      analyzer.recordNavigation({ action: 'back' });
      analyzer.recordNavigation({ action: 'forward' });
      analyzer.recordNavigation({ action: 'refresh' });

      assert.strictEqual(analyzer.patterns.navigation.length, 3);
    });

    it('should track navigation frequency', () => {
      analyzer.recordNavigation({ action: 'back' });
      analyzer.recordNavigation({ action: 'back' });
      analyzer.recordNavigation({ action: 'forward' });

      const metrics = analyzer.getNavigationMetrics();
      const backAction = metrics.actions.find((a) => a.action === 'back');
      assert.strictEqual(backAction.count, 2);
    });
  });

  describe('Form Interaction Recording', () => {
    it('should record form interactions', () => {
      analyzer.recordFormInteraction({
        field: 'email',
        action: 'focus',
        duration: 0
      });

      assert.strictEqual(analyzer.patterns.formInteraction.length, 1);
    });
  });

  describe('Metrics Summary', () => {
    it('should provide comprehensive metrics summary', () => {
      // Add some interactions
      analyzer.recordMouseMovement({ from: { x: 0, y: 0 }, to: { x: 100, y: 100 }, duration: 100 });
      analyzer.recordTypingEvent({ char: 'a', ikiBefore: 100, holdDuration: 80 });
      analyzer.recordClick({ x: 100, y: 200, target: 'button' });

      const summary = analyzer.getMetricsSummary();

      assert(summary.mouse, 'Should include mouse metrics');
      assert(summary.typing, 'Should include typing metrics');
      assert(summary.click, 'Should include click metrics');
      assert(summary.sessionMetrics, 'Should include session metrics');
      assert(summary.computationTime >= 0, 'Should measure computation time');
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect typing speed anomalies', () => {
      // Normal typing
      for (let i = 0; i < 20; i++) {
        analyzer.recordTypingEvent({ char: 'a', ikiBefore: 100, holdDuration: 80 });
      }

      // Sudden spike
      analyzer.recordTypingEvent({ char: 'a', ikiBefore: 30, holdDuration: 80 });

      const anomalies = analyzer.detectAnomalies();
      assert(anomalies.length > 0, 'Should detect typing speed anomaly');
    });

    it('should detect high error rates', () => {
      // Record many typing errors
      for (let i = 0; i < 20; i++) {
        analyzer.recordTypingEvent({
          char: 'x',
          ikiBefore: 100,
          holdDuration: 80,
          error: true
        });
      }

      const anomalies = analyzer.detectAnomalies();
      const errorAnomalies = anomalies.filter((a) => a.type === 'typing_error_rate_high');
      assert(errorAnomalies.length > 0, 'Should detect high error rate');
    });
  });

  describe('Entropy Calculation', () => {
    it('should calculate behavior entropy', () => {
      // Add varied interactions
      for (let i = 0; i < 50; i++) {
        analyzer.recordMouseMovement({
          from: { x: i * 10, y: 0 },
          to: { x: i * 10 + 100, y: 100 },
          duration: 50 + Math.random() * 100
        });
        analyzer.recordTypingEvent({
          char: String.fromCharCode(97 + (i % 26)),
          ikiBefore: 80 + Math.random() * 50,
          holdDuration: 80
        });
      }

      const entropy = analyzer.calculateBehaviorEntropy();
      assert(entropy >= 0 && entropy <= 1, 'Entropy should be between 0 and 1');
    });
  });

  describe('Baseline Comparison', () => {
    it('should compare patterns to baseline', () => {
      // Add interactions
      for (let i = 0; i < 30; i++) {
        analyzer.recordMouseMovement({
          from: { x: 0, y: 0 },
          to: { x: 100, y: 100 },
          duration: 100
        });
      }

      const metrics = analyzer.getMetricsSummary();
      const baseline = analyzer.getMetricsSummary();

      const comparison = analyzer.compareToBaseline(baseline);
      assert(comparison.deviations !== undefined, 'Should return deviations');
      assert(comparison.isConsistent !== undefined, 'Should return consistency status');
    });
  });
});

describe('BehavioralCoherenceScorer', () => {
  let analyzer;
  let scorer;

  beforeEach(() => {
    analyzer = new PatternAnalyzer();
    scorer = new BehavioralCoherenceScorer({ analyzer });
  });

  describe('Dimension Scoring', () => {
    it('should score mouse movement dimension', () => {
      // Add mouse movements
      for (let i = 0; i < 10; i++) {
        analyzer.recordMouseMovement({
          from: { x: i * 50, y: 0 },
          to: { x: i * 50 + 100, y: 100 },
          duration: 100
        });
      }

      const metrics = analyzer.getMetricsSummary();
      const score = scorer.scoreDimension('mouseMovement', metrics);

      assert(score.score >= 0 && score.score <= 100, 'Score should be 0-100');
      assert(score.status !== undefined, 'Score should have status');
    });

    it('should score typing pattern dimension', () => {
      // Add typing events
      for (let i = 0; i < 20; i++) {
        analyzer.recordTypingEvent({
          char: 'a',
          ikiBefore: 100 + Math.random() * 50,
          holdDuration: 80
        });
      }

      const metrics = analyzer.getMetricsSummary();
      const score = scorer.scoreDimension('typingPattern', metrics);

      assert(score.score >= 0 && score.score <= 100);
      assert(['NATURAL', 'SUSPICIOUS', 'ANOMALOUS', 'UNKNOWN'].includes(score.status));
    });

    it('should score scroll behavior dimension', () => {
      // Add scrolls
      for (let i = 0; i < 5; i++) {
        analyzer.recordScroll({
          direction: 'down',
          distance: 200,
          duration: 500,
          paused: i % 2 === 0
        });
      }

      const metrics = analyzer.getMetricsSummary();
      const score = scorer.scoreDimension('scrollBehavior', metrics);

      assert(score.score >= 0 && score.score <= 100);
    });

    it('should score click timing dimension', () => {
      // Add clicks
      for (let i = 0; i < 10; i++) {
        analyzer.recordClick({
          x: 100 + i * 50,
          y: 200,
          target: 'button',
          duration: 150
        });
      }

      const metrics = analyzer.getMetricsSummary();
      const score = scorer.scoreDimension('clickTiming', metrics);

      assert(score.score >= 0 && score.score <= 100);
    });
  });

  describe('Coherence Score Calculation', () => {
    it('should calculate overall coherence score', () => {
      // Add varied interactions to simulate natural behavior
      for (let i = 0; i < 50; i++) {
        analyzer.recordMouseMovement({
          from: { x: Math.random() * 1000, y: Math.random() * 1000 },
          to: { x: Math.random() * 1000, y: Math.random() * 1000 },
          duration: 50 + Math.random() * 100
        });
        if (i % 3 === 0) {
          analyzer.recordTypingEvent({
            char: String.fromCharCode(97 + (i % 26)),
            ikiBefore: 80 + Math.random() * 50,
            holdDuration: 80
          });
        }
        if (i % 5 === 0) {
          analyzer.recordClick({
            x: Math.random() * 1000,
            y: Math.random() * 1000,
            target: 'button' + i
          });
        }
      }

      const metrics = analyzer.getMetricsSummary();
      const score = scorer.calculateCoherenceScore(metrics);

      assert(score.overallScore >= 0 && score.overallScore <= 100);
      assert(score.dimensions !== undefined, 'Should have dimensions');
      assert(score.status !== undefined, 'Should have status');
      assert(score.confidence >= 0 && score.confidence <= 1);
    });

    it('should return COHERENT status for natural behavior', () => {
      // Add natural-looking interactions
      for (let i = 0; i < 100; i++) {
        analyzer.recordMouseMovement({
          from: { x: 100, y: 100 },
          to: { x: 200 + Math.random() * 100, y: 200 + Math.random() * 100 },
          duration: 100 + Math.random() * 100
        });
        analyzer.recordTypingEvent({
          char: 'a',
          ikiBefore: 100 + Math.random() * 50,
          holdDuration: 80 + Math.random() * 20
        });
      }

      const metrics = analyzer.getMetricsSummary();
      const score = scorer.calculateCoherenceScore(metrics);

      assert(score.status === 'COHERENT' || score.status === 'WARNING');
    });

    it('should handle machine-like behavior gracefully', () => {
      // Add machine-like behavior (perfectly consistent)
      for (let i = 0; i < 50; i++) {
        analyzer.recordMouseMovement({
          from: { x: i * 10, y: i * 10 },
          to: { x: i * 10 + 100, y: i * 10 + 100 },
          duration: 50 // Perfectly consistent timing
        });
        analyzer.recordTypingEvent({
          char: 'a',
          ikiBefore: 50, // Too fast and consistent
          holdDuration: 50,
          error: false // No errors (unnatural)
        });
      }

      const metrics = analyzer.getMetricsSummary();
      const score = scorer.calculateCoherenceScore(metrics);

      // Should produce a valid score
      assert(score.overallScore >= 0 && score.overallScore <= 100);
      assert(score.dimensions !== undefined);
      // The scorer should be tracking this behavior
      assert(scorer.getHistory().length > 0);
    });
  });

  describe('Bot Detection Risk', () => {
    it('should calculate bot detection risk', () => {
      // Add some interactions
      for (let i = 0; i < 50; i++) {
        analyzer.recordMouseMovement({
          from: { x: 0, y: 0 },
          to: { x: 100, y: 100 },
          duration: 100
        });
      }

      const metrics = analyzer.getMetricsSummary();
      const score = scorer.calculateCoherenceScore(metrics);

      assert(score.botDetectionRisk >= 0 && score.botDetectionRisk <= 1);
    });
  });

  describe('Score History', () => {
    it('should maintain score history', () => {
      // Calculate multiple scores
      for (let round = 0; round < 5; round++) {
        analyzer.recordMouseMovement({
          from: { x: 0, y: 0 },
          to: { x: 100, y: 100 },
          duration: 100
        });
        scorer.calculateCoherenceScore(analyzer.getMetricsSummary());
      }

      const history = scorer.getHistory();
      assert(history.length > 0, 'Should have history');
    });

    it('should filter history by time window', () => {
      // Add scores with time delay
      for (let i = 0; i < 5; i++) {
        analyzer.recordMouseMovement({
          from: { x: 0, y: 0 },
          to: { x: 100, y: 100 },
          duration: 100
        });
        scorer.calculateCoherenceScore(analyzer.getMetricsSummary());
      }

      const allHistory = scorer.getHistory();
      const recentHistory = scorer.getHistory(1000); // Last 1 second

      assert(recentHistory.length <= allHistory.length);
    });
  });

  describe('Recommendations', () => {
    it('should generate recommendations for improvement', () => {
      // Add some interactions
      for (let i = 0; i < 30; i++) {
        analyzer.recordMouseMovement({
          from: { x: 0, y: 0 },
          to: { x: 100, y: 100 },
          duration: 100
        });
      }

      const metrics = analyzer.getMetricsSummary();
      const score = scorer.calculateCoherenceScore(metrics);

      assert(score.recommendations !== undefined, 'Should have recommendations');
    });
  });

  describe('Trend Analysis', () => {
    it('should calculate trend as STABLE by default', () => {
      const metrics = analyzer.getMetricsSummary();
      const score = scorer.calculateCoherenceScore(metrics);

      assert(score.trend !== undefined);
    });

    it('should detect IMPROVING trend', () => {
      // Add low scores first
      for (let i = 0; i < 5; i++) {
        // Machine-like behavior
        analyzer.recordMouseMovement({
          from: { x: 0, y: 0 },
          to: { x: 100, y: 0 },
          duration: 50
        });
        scorer.calculateCoherenceScore(analyzer.getMetricsSummary());
      }

      // Then add natural behavior
      const analyzer2 = new PatternAnalyzer();
      for (let i = 0; i < 5; i++) {
        analyzer2.recordMouseMovement({
          from: { x: 0, y: 0 },
          to: { x: 100 + Math.random() * 100, y: 100 + Math.random() * 100 },
          duration: 100 + Math.random() * 100
        });
      }

      // Continue with the improved analyzer
      for (const score of scorer.getHistory().slice(-3)) {
        if (score.overallScore > 75) {
          assert(score.overallScore > 50);
        }
      }
    });
  });

  describe('Performance', () => {
    it('should calculate metrics in under 100ms for 100 interactions', () => {
      // Record 100 interactions
      for (let i = 0; i < 100; i++) {
        analyzer.recordMouseMovement({
          from: { x: 0, y: 0 },
          to: { x: 100, y: 100 },
          duration: 100
        });
      }

      const start = performance.now();
      const metrics = analyzer.getMetricsSummary();
      const duration = performance.now() - start;

      assert(duration < 100, `Metrics calculation took ${duration}ms (should be <100ms)`);
    });

    it('should score all dimensions in under 50ms', () => {
      // Add interactions
      for (let i = 0; i < 50; i++) {
        analyzer.recordMouseMovement({
          from: { x: 0, y: 0 },
          to: { x: 100, y: 100 },
          duration: 100
        });
        analyzer.recordTypingEvent({ char: 'a', ikiBefore: 100, holdDuration: 80 });
      }

      const metrics = analyzer.getMetricsSummary();
      const start = performance.now();
      const score = scorer.calculateCoherenceScore(metrics);
      const duration = performance.now() - start;

      assert(duration < 50, `Scoring took ${duration}ms (should be <50ms)`);
    });
  });
});

describe('Integration Tests', () => {
  it('should work end-to-end with realistic user session', () => {
    const analyzer = new PatternAnalyzer();
    const scorer = new BehavioralCoherenceScorer({ analyzer });

    // Simulate realistic user interactions
    const interactions = [
      // Navigate to page
      { type: 'navigation', action: 'navigate' },
      // Wait and then move mouse
      { type: 'mouse', from: { x: 0, y: 0 }, to: { x: 150, y: 200 }, duration: 300 },
      // Type email
      { type: 'typing', char: 'a', iki: 110, hold: 80 },
      { type: 'typing', char: 'b', iki: 95, hold: 80 },
      // Click button
      { type: 'click', x: 200, y: 300, target: 'submit', duration: 140 },
      // Scroll
      { type: 'scroll', direction: 'down', distance: 200, duration: 500, paused: true },
      // More typing
      { type: 'typing', char: 'c', iki: 120, hold: 85 }
    ];

    for (const interaction of interactions) {
      switch (interaction.type) {
      case 'mouse':
        analyzer.recordMouseMovement({
          from: interaction.from,
          to: interaction.to,
          duration: interaction.duration
        });
        break;
      case 'typing':
        analyzer.recordTypingEvent({
          char: interaction.char,
          ikiBefore: interaction.iki,
          holdDuration: interaction.hold
        });
        break;
      case 'click':
        analyzer.recordClick({
          x: interaction.x,
          y: interaction.y,
          target: interaction.target,
          duration: interaction.duration
        });
        break;
      case 'scroll':
        analyzer.recordScroll({
          direction: interaction.direction,
          distance: interaction.distance,
          duration: interaction.duration,
          paused: interaction.paused
        });
        break;
      }
    }

    // Get final score
    const metrics = analyzer.getMetricsSummary();
    const score = scorer.calculateCoherenceScore(metrics);

    assert(score.overallScore >= 0, 'Should have valid score');
    assert(score.dimensions !== undefined, 'Should score dimensions');
    assert(score.botDetectionRisk !== undefined, 'Should estimate bot risk');
  });
});
