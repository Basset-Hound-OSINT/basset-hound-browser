/**
 * Request Signing & Verification Tests
 *
 * Tests: 12+ signing scenarios
 * Coverage: HMAC signing, timestamp validation, nonce validation
 */

const RequestSigner = require('../../src/security/request-signing');
const crypto = require('crypto');

describe('Request Signing & Verification', () => {
  let signer;
  const signingKey = crypto.randomBytes(32);

  beforeEach(() => {
    // Create fresh signer for each test to avoid nonce caching issues
    signer = new RequestSigner(signingKey);
  });

  describe('Request Signing', () => {
    test('Sign request creates valid signature', () => {
      const request = { action: 'navigate', url: 'https://example.com' };
      const signed = signer.sign(request);

      expect(signed.signature).toBeDefined();
      expect(signed.timestamp).toBeDefined();
      expect(signed.nonce).toBeDefined();
      expect(typeof signed.signature).toBe('string');
    });

    test('Different requests have different signatures', () => {
      const req1 = { action: 'navigate', url: 'https://example1.com' };
      const req2 = { action: 'navigate', url: 'https://example2.com' };

      const sig1 = signer.sign(req1).signature;
      const sig2 = signer.sign(req2).signature;

      expect(sig1).not.toEqual(sig2);
    });

    test('Signature changes with different nonce', () => {
      const request = { action: 'test' };
      const nonce1 = 'nonce1';
      const nonce2 = 'nonce2';

      const sig1 = signer.sign(request, { nonce: nonce1 }).signature;
      const sig2 = signer.sign(request, { nonce: nonce2 }).signature;

      expect(sig1).not.toEqual(sig2);
    });

    test('Attach signature to request', () => {
      const request = { action: 'test' };
      const signed = signer.attachSignature(request);

      expect(signed.signature).toBeDefined();
      expect(signed.timestamp).toBeDefined();
      expect(signed.nonce).toBeDefined();
      expect(signed.action).toEqual('test');
    });

    test('Nonce is cryptographically random', () => {
      const req1 = signer.sign({ test: 1 });
      const req2 = signer.sign({ test: 1 });

      expect(req1.nonce).not.toEqual(req2.nonce);
    });
  });

  describe('Request Verification', () => {
    test('Valid signature verifies', () => {
      const request = { action: 'test' };
      const signed = signer.attachSignature(request);

      // Use same signer instance to avoid nonce conflict
      const result = signer.verify(signed);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('Modified request fails verification', () => {
      const request = { action: 'test' };
      const signed = signer.attachSignature(request);

      // Modify the request
      signed.action = 'modified';

      const result = signer.verify(signed);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Signature verification failed'))).toBe(true);
    });

    test('Modified signature fails verification', () => {
      const request = { action: 'test' };
      const signed = signer.attachSignature(request);

      // Modify the signature
      signed.signature = 'invalidsignature';

      const result = signer.verify(signed);
      expect(result.valid).toBe(false);
    });

    test('Missing signature fails verification', () => {
      const request = { action: 'test', timestamp: Date.now() };
      const result = signer.verify(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing signature');
    });

    test('Expired request fails verification', () => {
      const oldTimestamp = Date.now() - 120000; // 2 minutes ago
      const request = {
        action: 'test',
        timestamp: oldTimestamp,
        nonce: 'test-nonce',
        signature: 'test-sig'
      };

      const result = signer.verify(request);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too old'))).toBe(true);
    });

    test('Future timestamp rejected (clock skew)', () => {
      const futureTimestamp = Date.now() + 10000; // 10 seconds in future
      const request = {
        action: 'test',
        timestamp: futureTimestamp,
        nonce: 'test-nonce'
      };

      signer.config.clockSkew = 5000; // 5 second tolerance
      const signed = signer.attachSignature(request);

      const result = signer.verify(signed);
      expect(result.valid).toBe(false);
    });
  });

  describe('Nonce Validation', () => {
    test('Duplicate nonce detected', () => {
      const request = { action: 'test' };
      const nonce = 'same-nonce';

      const signed1 = signer.attachSignature(request, { nonce });
      const verified1 = signer.verify(signed1);
      expect(verified1.valid).toBe(true);

      // Try to reuse same nonce
      const signed2 = signer.attachSignature(request, { nonce });
      const verified2 = signer.verify(signed2);
      expect(verified2.valid).toBe(false);
      expect(verified2.errors.some(e => e.includes('nonce'))).toBe(true);
    });

    test('Different nonces are accepted', () => {
      const request = { action: 'test' };

      const signed1 = signer.attachSignature(request);
      const result1 = signer.verify(signed1);
      expect(result1.valid).toBe(true);

      const signed2 = signer.attachSignature(request);
      const result2 = signer.verify(signed2);
      expect(result2.valid).toBe(true);
    });

    test('Old nonces are forgotten', async () => {
      const signer2 = new RequestSigner(signingKey, { nonceWindow: 100 });
      const request = { action: 'test' };

      const nonce = 'reuse-test-nonce';
      const signed1 = signer2.attachSignature(request, { nonce });
      const verified1 = signer2.verify(signed1);
      expect(verified1.valid).toBe(true);

      // Wait for nonce to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const signed2 = signer2.attachSignature(request, { nonce });
      const verified2 = signer2.verify(signed2);
      expect(verified2.valid).toBe(true); // Nonce should be reusable after expiration
    });
  });

  describe('Timestamp Validation', () => {
    test('Recent timestamp is valid', () => {
      const request = {
        action: 'test',
        timestamp: Date.now(),
        nonce: 'test-nonce'
      };

      const signed = signer.attachSignature(request);
      const result = signer.verify(signed);
      expect(result.valid).toBe(true);
    });

    test('Old timestamp rejected', () => {
      const oldTime = Date.now() - 70000; // 70 seconds old
      const request = {
        action: 'test',
        timestamp: oldTime,
        nonce: 'test-nonce'
      };

      const signed = signer.attachSignature(request);
      const result = signer.verify(signed);
      expect(result.valid).toBe(false);
    });

    test('Clock skew tolerance works', () => {
      const signer2 = new RequestSigner(signingKey, { clockSkew: 10000 });
      const futureTime = Date.now() + 9000; // 9 seconds in future (within tolerance)

      const request = {
        action: 'test',
        timestamp: futureTime
      };

      const signed = signer2.attachSignature(request);
      const result = signer2.verify(signed);
      expect(result.valid).toBe(true);
    });
  });

  describe('Signature Extraction', () => {
    test('Extract signature from request', () => {
      const request = { action: 'test' };
      const signed = signer.attachSignature(request);

      const extracted = signer.extractSignature(signed);
      expect(extracted.signature).toBeDefined();
      expect(extracted.request.action).toEqual('test');
      expect(extracted.request.signature).toBeUndefined();
    });

    test('Extracted data can be re-verified', () => {
      const request = { action: 'test' };
      const signed = signer.attachSignature(request);

      const extracted = signer.extractSignature(signed);
      const reassembled = {
        ...extracted.request,
        ...extracted.signature
      };

      const result = signer.verify(reassembled);
      expect(result.valid).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    test('Sign batch of requests', () => {
      const requests = [
        { action: 'navigate' },
        { action: 'click' },
        { action: 'type' }
      ];

      const signed = signer.signBatch(requests);
      expect(signed.length).toBe(3);
      expect(signed[0].signature).toBeDefined();
      expect(signed[1].signature).toBeDefined();
      expect(signed[2].signature).toBeDefined();
    });

    test('Verify batch of requests', () => {
      const requests = [
        { action: 'navigate' },
        { action: 'click' },
        { action: 'type' }
      ];

      const signed = signer.signBatch(requests);
      const result = signer.verifyBatch(signed);

      expect(result.valid).toEqual(3);
      expect(result.invalid).toEqual(0);
      expect(result.total).toEqual(3);
    });

    test('Invalid requests detected in batch', () => {
      const requests = [
        { action: 'navigate' },
        { action: 'click' },
        { action: 'type' }
      ];

      const signed = signer.signBatch(requests);
      signed[1].action = 'modified'; // Corrupt one

      const result = signer.verifyBatch(signed);
      expect(result.invalid).toEqual(1);
      expect(result.errors.length).toEqual(1);
    });
  });

  describe('Nonce Cache Management', () => {
    test('Stats show nonce count', () => {
      signer.attachSignature({ test: 1 });
      signer.attachSignature({ test: 2 });

      const stats = signer.getStats();
      expect(stats.noncesCached).toBeGreaterThan(0);
    });

    test('Nonce cache can be cleared', () => {
      signer.attachSignature({ test: 1 });
      signer.clearNonceCache();

      const stats = signer.getStats();
      expect(stats.noncesCached).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('Invalid request object rejected', () => {
      expect(() => signer.sign(null)).toThrow();
      expect(() => signer.sign('not an object')).toThrow();
    });

    test('Invalid signing key rejected', () => {
      expect(() => new RequestSigner(null)).toThrow();
      expect(() => new RequestSigner(crypto.randomBytes(16))).toThrow(); // Too small
    });

    test('Invalid verification input handled gracefully', () => {
      const result = signer.verify(null);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    test('Custom max request age enforced', () => {
      const signer2 = new RequestSigner(signingKey, { maxRequestAge: 1000 });
      const oldTime = Date.now() - 2000;

      const request = {
        action: 'test',
        timestamp: oldTime
      };

      const signed = signer2.attachSignature(request);
      const result = signer2.verify(signed);

      expect(result.valid).toBe(false);
    });

    test('Nonce can be disabled', () => {
      const signer2 = new RequestSigner(signingKey, { enableNonce: false });
      const request = { action: 'test' };

      const signed = signer2.attachSignature(request);
      expect(signed.nonce).toBeUndefined();

      const result = signer2.verify(signed);
      expect(result.valid).toBe(true);
    });
  });
});
