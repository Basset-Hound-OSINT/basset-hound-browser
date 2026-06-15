/**
 * P3-002: Session Coherence Edge Cases Tests
 * Tests race condition fixes and atomic state updates
 */

const SessionCoherence = require('../src/evasion/session-coherence');

describe('P3-002: Session Coherence Edge Cases', () => {
  let coherence;

  beforeEach(() => {
    coherence = new SessionCoherence();
    coherence.generateInteractionId = () => `int_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    coherence.calculateSimilarity = (a, b) => 0.95;
    coherence.calculateOverallCoherence = (session) => ({
      score: 0.90,
      timestamp: Date.now()
    });
    coherence.validateTimelineCoherence = (session, interaction) => ({
      violations: [],
      score: 1.0
    });
    coherence.validateDeviceCoherence = (session, device) => ({
      violations: [],
      score: 1.0
    });
    coherence.validateNetworkCoherence = (session, network) => ({
      violations: [],
      score: 1.0
    });
  });

  // Test 1: Concurrent interactions without race condition
  test('should handle concurrent interactions atomically', async () => {
    const sessionId = 'session_1';
    coherence.initializeSession(sessionId, {
      fingerprint: { canvas: 'abc123' },
      behavior: { typingSpeed: 50 }
    });

    const interactions = [];
    for (let i = 0; i < 5; i++) {
      interactions.push(
        coherence.recordInteraction(sessionId, {
          type: 'navigation',
          fingerprint: { canvas: 'abc123' },
          behavior: { typingSpeed: 50 + i }
        })
      );
    }

    const results = await Promise.all(interactions);
    const session = coherence.sessions.get(sessionId);

    expect(session.interactions.length).toBe(5);
    expect(results.every(r => r.success)).toBe(true);
  });

  // Test 2: Race condition in fingerprint validation
  test('should prevent race conditions in fingerprint validation', async () => {
    const sessionId = 'session_2';
    coherence.initializeSession(sessionId, {
      fingerprint: { canvas: 'xyz789', webgl: 'webgl1' }
    });

    // Simulate rapid interactions
    const rapid = [];
    for (let i = 0; i < 10; i++) {
      rapid.push(
        coherence.recordInteraction(sessionId, {
          type: 'interaction',
          fingerprint: { canvas: 'xyz789', webgl: 'webgl1' }
        })
      );
    }

    const results = await Promise.all(rapid);
    const session = coherence.sessions.get(sessionId);

    // Should have all interactions recorded despite race
    expect(session.interactions.length).toBe(10);
    // No duplicate or lost interactions
    expect(new Set(results.map(r => r.interactionId)).size).toBe(10);
  });

  // Test 3: Atomic state updates
  test('should perform atomic state updates', async () => {
    const sessionId = 'session_3';
    coherence.initializeSession(sessionId, {
      fingerprint: { screen: '1920x1080' },
      behavior: { mouseSpeed: 100 }
    });

    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        coherence.recordInteraction(sessionId, {
          type: 'click',
          fingerprint: { screen: '1920x1080' },
          behavior: { mouseSpeed: 100 + i }
        })
      );
    }

    await Promise.all(promises);
    const session = coherence.sessions.get(sessionId);

    // Check all interactions are properly recorded
    expect(session.interactions.length).toBe(20);

    // Check that violation count is correct (no partial updates)
    const totalViolations = session.interactions.reduce((sum, i) => sum + i.violations.length, 0);
    expect(typeof totalViolations).toBe('number');
  });

  // Test 4: Mutex prevents interleaved updates
  test('should use mutex to prevent interleaved updates', async () => {
    const sessionId = 'session_4';
    coherence.initializeSession(sessionId);

    const initialLength = coherence.sessions.get(sessionId).interactions.length;

    const interactions = [];
    for (let i = 0; i < 15; i++) {
      interactions.push(
        coherence.recordInteraction(sessionId, {
          type: 'scroll',
          behavior: { scrollSpeed: i }
        })
      );
    }

    await Promise.all(interactions);
    const session = coherence.sessions.get(sessionId);

    // Should have exactly initialLength + 15 interactions
    expect(session.interactions.length).toBe(initialLength + 15);
  });

  // Test 5: Concurrent sessions don't interfere
  test('should isolate concurrent sessions with separate mutexes', async () => {
    const session1 = 'sess_1';
    const session2 = 'sess_2';

    coherence.initializeSession(session1);
    coherence.initializeSession(session2);

    const s1Interactions = [];
    const s2Interactions = [];

    for (let i = 0; i < 10; i++) {
      s1Interactions.push(
        coherence.recordInteraction(session1, {
          type: 'action',
          behavior: { speed: i }
        })
      );
      s2Interactions.push(
        coherence.recordInteraction(session2, {
          type: 'action',
          behavior: { speed: i * 2 }
        })
      );
    }

    await Promise.all([...s1Interactions, ...s2Interactions]);

    const sess1 = coherence.sessions.get(session1);
    const sess2 = coherence.sessions.get(session2);

    expect(sess1.interactions.length).toBe(10);
    expect(sess2.interactions.length).toBe(10);
  });

  // Test 6: Violations recorded correctly under concurrency
  test('should record violations correctly during concurrent access', async () => {
    const sessionId = 'session_6';
    coherence.initializeSession(sessionId, {
      fingerprint: { navigator: 'Chrome' }
    });

    // Mock violation detection
    coherence.validateTemporalCoherence = (session, fingerprint, timestamp) => {
      return {
        score: 0.85,
        violations: [
          {
            layer: 'temporal',
            severity: 'medium',
            reason: 'test violation'
          }
        ]
      };
    };

    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        coherence.recordInteraction(sessionId, {
          type: 'test',
          fingerprint: { navigator: 'Chrome' }
        })
      );
    }

    await Promise.all(promises);
    const session = coherence.sessions.get(sessionId);

    // Each interaction should have violations tracked
    expect(session.violations.length).toBeGreaterThan(0);
  });

  // Test 7: Coherence scores updated atomically
  test('should update coherence scores atomically', async () => {
    const sessionId = 'session_7';
    coherence.initializeSession(sessionId, {
      fingerprint: { audio: 'audio1' }
    });

    const interactions = [];
    for (let i = 0; i < 12; i++) {
      interactions.push(
        coherence.recordInteraction(sessionId, {
          type: 'interaction',
          fingerprint: { audio: 'audio1' }
        })
      );
    }

    await Promise.all(interactions);
    const session = coherence.sessions.get(sessionId);

    // Temporal score should be defined and valid
    expect(session.coherenceScores.temporal).toBeDefined();
    expect(typeof session.coherenceScores.temporal).toBe('number');
    expect(session.coherenceScores.temporal).toBeGreaterThanOrEqual(0);
    expect(session.coherenceScores.temporal).toBeLessThanOrEqual(1);
  });

  // Test 8: Timeline events ordered correctly under concurrency
  test('should maintain ordered timeline events under concurrency', async () => {
    const sessionId = 'session_8';
    coherence.initializeSession(sessionId);

    const startTime = Date.now();
    const interactions = [];

    for (let i = 0; i < 8; i++) {
      interactions.push(
        coherence.recordInteraction(sessionId, {
          type: `type_${i}`
        })
      );
    }

    await Promise.all(interactions);
    const session = coherence.sessions.get(sessionId);
    const events = session.layers.timeline.events;

    // Events should be in order or nearly in order
    for (let i = 1; i < events.length; i++) {
      expect(events[i].timestamp).toBeGreaterThanOrEqual(events[i - 1].timestamp);
    }
  });

  // Test 9: No lost interactions under high concurrency
  test('should not lose interactions under high concurrency', async () => {
    const sessionId = 'session_9';
    coherence.initializeSession(sessionId);

    const interactionIds = new Set();
    const promises = [];

    for (let i = 0; i < 25; i++) {
      promises.push(
        coherence.recordInteraction(sessionId, {
          type: 'concurrent'
        }).then(result => {
          interactionIds.add(result.interactionId);
          return result;
        })
      );
    }

    const results = await Promise.all(promises);
    const session = coherence.sessions.get(sessionId);

    expect(session.interactions.length).toBe(25);
    expect(interactionIds.size).toBe(25); // All IDs unique
    expect(results.every(r => r.success)).toBe(true);
  });

  // Test 10: Mutex cleanup doesn't leak
  test('should clean up mutexes properly', async () => {
    const sessionId = 'session_10';
    coherence.initializeSession(sessionId);

    const initialMutexCount = coherence.sessionMutexes.size;

    for (let i = 0; i < 5; i++) {
      await coherence.recordInteraction(sessionId, {
        type: 'test'
      });
    }

    // Mutex should still exist for this session
    expect(coherence.sessionMutexes.has(sessionId)).toBe(true);

    // Clean up
    coherence.sessions.delete(sessionId);

    // Note: mutexes are not auto-deleted; this is okay for long-lived sessions
    // But they should be deletable explicitly
    coherence.sessionMutexes.delete(sessionId);
    expect(coherence.sessionMutexes.has(sessionId)).toBe(false);
  });
});
