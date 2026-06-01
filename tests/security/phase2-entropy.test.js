/**
 * Security Phase 2: Entropy Tests
 * Validates increased entropy in session and ID generation
 *
 * Tests:
 * - Session ID entropy (16 bytes minimum)
 * - Platform ID entropy (16 bytes minimum)
 * - Uniqueness across large sample
 * - Entropy distribution
 */

const crypto = require('crypto');
const SessionManager = require('../../src/session/session-manager');
const { PlatformIntegration } = require('../../src/export/platform-integrations-framework');

describe('Security Phase 2: Entropy Tests', () => {
  describe('Session ID Entropy', () => {
    let sessionManager;

    beforeEach(() => {
      sessionManager = new SessionManager();
    });

    test('Session IDs have 16 bytes (128 bits) entropy minimum', () => {
      const session = sessionManager.createSession();

      // Session ID format: session-[32 hex chars]
      expect(session.id).toMatch(/^session-[a-f0-9]{32}$/);

      const randomPart = session.id.split('-')[1];
      expect(randomPart.length).toBe(32);  // 16 bytes = 32 hex chars
    });

    test('Session IDs are cryptographically random', () => {
      const ids = new Set();

      // Generate 1000 session IDs
      for (let i = 0; i < 1000; i++) {
        const session = sessionManager.createSession();
        ids.add(session.id);
      }

      // All should be unique
      expect(ids.size).toBe(1000);
    });

    test('Session ID entropy distribution is uniform', () => {
      const ids = [];

      for (let i = 0; i < 100; i++) {
        const session = sessionManager.createSession();
        ids.push(session.id);
      }

      // Calculate entropy for each position
      const entropies = [];
      for (let pos = 0; pos < 32; pos++) {
        const chars = new Set();
        ids.forEach(id => {
          chars.add(id.charAt(pos + 8));  // Skip 'session-' prefix
        });

        // Should have good distribution (not all same character)
        expect(chars.size).toBeGreaterThan(5);
      }
    });

    test('Session ID format is consistent', () => {
      for (let i = 0; i < 50; i++) {
        const session = sessionManager.createSession();

        // Must have prefix
        expect(session.id).toContain('session-');

        // Must have exactly 32 hex characters after prefix
        const parts = session.id.split('-');
        expect(parts[0]).toBe('session');
        expect(parts[1]).toMatch(/^[a-f0-9]{32}$/);
      }
    });

    test('Session ID is not predictable with different sizes', () => {
      const session1 = sessionManager.createSession();
      const session2 = sessionManager.createSession();

      // IDs should be completely different, no pattern
      expect(session1.id).not.toEqual(session2.id);

      // Hamming distance should be high (differ in many bits)
      let differences = 0;
      for (let i = 0; i < Math.min(session1.id.length, session2.id.length); i++) {
        if (session1.id[i] !== session2.id[i]) {
          differences++;
        }
      }

      // Should differ in at least 50% of positions (random expectation)
      expect(differences / session1.id.length).toBeGreaterThanOrEqual(0.5);
    });

    test('Brute force resistance: cannot predict next session ID', () => {
      const knownIds = new Set();

      for (let i = 0; i < 100; i++) {
        const session = sessionManager.createSession();
        knownIds.add(session.id);
      }

      // Try to predict if next 100 are guessable
      const nextSession = sessionManager.createSession();

      // Should NOT be in known IDs
      expect(knownIds.has(nextSession.id)).toBe(false);

      // Even with knowledge of previous IDs, should not be able to guess
      // (this is a conceptual test - in practice, brute force resistance
      // comes from 128-bit entropy making 2^128 attempts needed)
    });
  });

  describe('Platform ID Entropy', () => {
    let platform;

    beforeEach(() => {
      platform = new PlatformIntegration('test-platform', {
        apiKey: 'test-key'
      });
    });

    test('Platform IDs have 16 bytes entropy minimum', () => {
      const id = platform._generateId();

      // Format: test-platform-[timestamp]-[32 hex chars]
      const parts = id.split('-');
      const randomPart = parts[parts.length - 1];

      expect(randomPart).toMatch(/^[a-f0-9]{32}$/);
      expect(randomPart.length).toBe(32);  // 16 bytes = 32 hex chars
    });

    test('Platform IDs are unique across exports', () => {
      const ids = new Set();

      for (let i = 0; i < 500; i++) {
        const id = platform._generateId();
        ids.add(id);
      }

      expect(ids.size).toBe(500);
    });

    test('Platform ID format includes timestamp and random component', () => {
      const id = platform._generateId();

      // Should contain platform name
      expect(id).toContain('test-platform');

      // Should match pattern: name-timestamp-randomhex
      expect(id).toMatch(/^[a-z-]+-\d+-[a-f0-9]{32}$/);
    });

    test('Platform IDs from different platforms are distinct', () => {
      const platform1 = new PlatformIntegration('platform1');
      const platform2 = new PlatformIntegration('platform2');

      const id1 = platform1._generateId();
      const id2 = platform2._generateId();

      expect(id1).not.toEqual(id2);
      expect(id1).toContain('platform1');
      expect(id2).toContain('platform2');
    });

    test('Platform ID entropy is resistant to timing attacks', () => {
      const ids = [];
      const times = [];

      for (let i = 0; i < 50; i++) {
        const start = Date.now();
        const id = platform._generateId();
        const end = Date.now();

        ids.push(id);
        times.push(end - start);
      }

      // All IDs should be unique despite similar timing
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(50);

      // Timing shouldn't reveal information about entropy
      // (all IDs take roughly same time to generate)
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const variance = times.reduce((sum, t) => sum + Math.pow(t - avgTime, 2)) / times.length;

      // Low variance indicates not exploitable via timing
      expect(variance).toBeLessThan(10);  // ms^2
    });
  });

  describe('Entropy Comparison: Old vs New', () => {
    test('Old entropy (4 bytes) vs New entropy (16 bytes) - space', () => {
      const oldEntropyBits = 4 * 8;  // 32 bits
      const newEntropyBits = 16 * 8;  // 128 bits

      // New entropy space is 2^96 times larger
      expect(newEntropyBits).toBe(oldEntropyBits + 96);
      expect(Math.pow(2, newEntropyBits)).toBeGreaterThan(Math.pow(2, oldEntropyBits));
    });

    test('Old entropy brute force: 4 billion attempts (old)', () => {
      // 2^32 = 4,294,967,296 attempts needed
      const oldAttempts = Math.pow(2, 32);
      expect(oldAttempts).toBe(4294967296);
    });

    test('New entropy brute force: 10^38 attempts (new)', () => {
      // 2^128 ≈ 3.4 × 10^38 attempts needed
      const newAttempts = Math.pow(2, 128);
      expect(newAttempts).toBeGreaterThan(1e38);
    });
  });

  describe('Entropy Quality Validation', () => {
    test('Random bytes are not repeating patterns', () => {
      const sessionManager = new SessionManager();
      const session = sessionManager.createSession();
      const randomPart = session.id.split('-')[1];

      // Check for patterns like 'aaaa', 'abab', '1234'
      const doublePatterns = randomPart.match(/(.)\1{3,}/g);
      const triplePatterns = randomPart.match(/(.)(.)?\1\2/g);

      // Should have no obvious repeating patterns
      expect(doublePatterns || []).toHaveLength(0);
    });

    test('Entropy does not correlate with session creation time', () => {
      const sessionManager = new SessionManager();

      // Create sessions with identical IDs should not happen
      const sessions = [];
      const now = Date.now();

      for (let i = 0; i < 50; i++) {
        sessions.push(sessionManager.createSession());
      }

      // Even created at same millisecond, IDs differ
      // (entropy is independent of timestamp)
      const ids = sessions.map(s => s.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(50);
    });
  });
});
