/**
 * Test suite for HMAC Message Authentication
 */

const { HMACSignerMessage } = require('../../src/security/hmac-signer');

describe('HMACSignerMessage', () => {
  let signer;
  const testKey = 'a'.repeat(64);  // 32 bytes

  beforeEach(() => {
    signer = new HMACSignerMessage(testKey);
  });

  afterEach(() => {
    if (signer) signer.destroy();
  });

  // ========== Initialization Tests ==========

  describe('Initialization', () => {
    it('should create signer with secret key', () => {
      expect(signer).toBeDefined();
    });

    it('should reject missing secret key', () => {
      expect(() => new HMACSignerMessage()).toThrow();
    });

    it('should reject key shorter than 32 bytes', () => {
      const shortKey = 'a'.repeat(30);
      expect(() => new HMACSignerMessage(shortKey)).toThrow();
    });

    it('should accept hex string keys', () => {
      const hexKey = 'a'.repeat(64);
      expect(() => new HMACSignerMessage(hexKey)).not.toThrow();
    });

    it('should accept Buffer keys', () => {
      const bufferKey = Buffer.alloc(32, 'a');
      expect(() => new HMACSignerMessage(bufferKey)).not.toThrow();
    });
  });

  // ========== Message Signing Tests ==========

  describe('Message Signing', () => {
    it('should sign a message', () => {
      const signature = signer.signMessage('test message');
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64);  // SHA-256 hex = 64 chars
    });

    it('should produce consistent signatures', () => {
      const sig1 = signer.signMessage('test');
      const sig2 = signer.signMessage('test');
      expect(sig1).toBe(sig2);
    });

    it('should produce different signatures for different messages', () => {
      const sig1 = signer.signMessage('message1');
      const sig2 = signer.signMessage('message2');
      expect(sig1).not.toBe(sig2);
    });

    it('should handle object messages', () => {
      const obj = { key: 'value', number: 42 };
      const signature = signer.signMessage(obj);
      expect(typeof signature).toBe('string');
    });
  });

  // ========== Authenticated Message Envelope Tests ==========

  describe('Authenticated Message Envelope', () => {
    it('should create authenticated message', () => {
      const payload = { command: 'navigate', url: 'https://example.com' };
      const envelope = signer.createAuthenticatedMessage(payload);

      expect(envelope.payload).toEqual(payload);
      expect(envelope.signature).toBeDefined();
      expect(envelope.timestamp).toBeDefined();
    });

    it('should include nonce when enabled', () => {
      const signer2 = new HMACSignerMessage(testKey, { enableNonce: true });
      const envelope = signer2.createAuthenticatedMessage({ data: 'test' });
      expect(envelope.nonce).toBeDefined();
      signer2.destroy();
    });

    it('should not include nonce when disabled', () => {
      const signer2 = new HMACSignerMessage(testKey, { enableNonce: false });
      const envelope = signer2.createAuthenticatedMessage({ data: 'test' });
      expect(envelope.nonce).toBeUndefined();
      signer2.destroy();
    });
  });

  // ========== Message Verification Tests ==========

  describe('Message Verification', () => {
    it('should verify valid message', () => {
      const payload = { command: 'test' };
      const envelope = signer.createAuthenticatedMessage(payload);
      const result = signer.verifyMessage(envelope);

      expect(result.valid).toBe(true);
      expect(result.data).toEqual(payload);
    });

    it('should reject invalid signature', () => {
      const payload = { command: 'test' };
      const envelope = signer.createAuthenticatedMessage(payload);
      envelope.signature = 'badsignature'.repeat(6);  // Invalid hex

      const result = signer.verifyMessage(envelope);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('signature');
    });

    it('should reject modified payload', () => {
      const payload = { command: 'test' };
      const envelope = signer.createAuthenticatedMessage(payload);
      envelope.payload.command = 'execute_javascript';

      const result = signer.verifyMessage(envelope);
      expect(result.valid).toBe(false);
    });

    it('should reject missing signature', () => {
      const envelope = { payload: { data: 'test' }, timestamp: Date.now() };
      const result = signer.verifyMessage(envelope);
      expect(result.valid).toBe(false);
    });

    it('should reject missing payload', () => {
      const envelope = { signature: 'abc', timestamp: Date.now() };
      const result = signer.verifyMessage(envelope);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid envelope structure', () => {
      const result = signer.verifyMessage('not-an-object');
      expect(result.valid).toBe(false);
    });
  });

  // ========== Timestamp Validation Tests ==========

  describe('Timestamp Validation', () => {
    it('should reject expired messages', () => {
      const signer2 = new HMACSignerMessage(testKey, { maxMessageAge: 1000 });
      const envelope = signer2.createAuthenticatedMessage({ data: 'test' });

      // Simulate message age
      envelope.timestamp = Date.now() - 2000;

      const result = signer2.verifyMessage(envelope);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
      signer2.destroy();
    });

    it('should reject messages from the future', () => {
      const envelope = signer.createAuthenticatedMessage({ data: 'test' });
      envelope.timestamp = Date.now() + 60000;

      const result = signer.verifyMessage(envelope);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('future');
    });

    it('should accept fresh messages', () => {
      const envelope = signer.createAuthenticatedMessage({ data: 'test' });
      const result = signer.verifyMessage(envelope);
      expect(result.valid).toBe(true);
    });
  });

  // ========== Nonce Replay Prevention Tests ==========

  describe('Nonce Replay Prevention', () => {
    it('should detect nonce replay', () => {
      const signer2 = new HMACSignerMessage(testKey, { enableNonce: true });
      const envelope = signer2.createAuthenticatedMessage({ data: 'test' });

      // First verification succeeds
      expect(signer2.verifyMessage(envelope).valid).toBe(true);

      // Replay same message
      const result = signer2.verifyMessage(envelope);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('replay');
      signer2.destroy();
    });

    it('should allow different nonces', () => {
      const signer2 = new HMACSignerMessage(testKey, { enableNonce: true });
      const env1 = signer2.createAuthenticatedMessage({ data: 'test' });
      const env2 = signer2.createAuthenticatedMessage({ data: 'test' });

      expect(signer2.verifyMessage(env1).valid).toBe(true);
      expect(signer2.verifyMessage(env2).valid).toBe(true);
      signer2.destroy();
    });
  });

  // ========== Signed Response Tests ==========

  describe('Signed Response', () => {
    it('should create signed response', () => {
      const response = signer.createSignedResponse({ status: 'ok' });
      expect(response.data).toBeDefined();
      expect(response.signature).toBeDefined();
      expect(response.timestamp).toBeDefined();
    });

    it('should include request nonce in response', () => {
      const response = signer.createSignedResponse({ status: 'ok' }, 'nonce-123');
      expect(response.requestNonce).toBe('nonce-123');
    });

    it('should verify signed response', () => {
      const response = signer.createSignedResponse({ status: 'ok' });
      const result = signer.verifySignedResponse(response);
      expect(result.valid).toBe(true);
    });

    it('should verify nonce pairing', () => {
      const response = signer.createSignedResponse({ status: 'ok' }, 'nonce-123');
      const result = signer.verifySignedResponse(response, 'nonce-123');
      expect(result.valid).toBe(true);
    });

    it('should reject mismatched nonce pairing', () => {
      const response = signer.createSignedResponse({ status: 'ok' }, 'nonce-123');
      const result = signer.verifySignedResponse(response, 'nonce-wrong');
      expect(result.valid).toBe(false);
    });
  });

  // ========== Request Deduplication Tests ==========

  describe('Request Deduplication', () => {
    it('should detect duplicate requests', () => {
      const signer2 = new HMACSignerMessage(testKey, { enableRequestDedup: true });
      const result1 = signer2.checkRequestDedup('request-1');
      const result2 = signer2.checkRequestDedup('request-1');

      expect(result1.isDuplicate).toBe(false);
      expect(result2.isDuplicate).toBe(true);
      signer2.destroy();
    });

    it('should allow different request IDs', () => {
      const signer2 = new HMACSignerMessage(testKey, { enableRequestDedup: true });
      const result1 = signer2.checkRequestDedup('request-1');
      const result2 = signer2.checkRequestDedup('request-2');

      expect(result1.isDuplicate).toBe(false);
      expect(result2.isDuplicate).toBe(false);
      signer2.destroy();
    });

    it('should skip dedup when disabled', () => {
      const signer2 = new HMACSignerMessage(testKey, { enableRequestDedup: false });
      const result = signer2.checkRequestDedup('request-1');
      expect(result.isDuplicate).toBe(false);
      signer2.destroy();
    });
  });

  // ========== Statistics Tests ==========

  describe('Statistics', () => {
    it('should return statistics', () => {
      const stats = signer.getStats();
      expect(stats.usedNonces).toBeDefined();
      expect(stats.seenRequests).toBeDefined();
      expect(stats.config).toBeDefined();
    });
  });

  // ========== Key Generation Tests ==========

  describe('Static Helpers', () => {
    it('should generate random secret key', () => {
      const key = HMACSignerMessage.generateSecretKey();
      expect(typeof key).toBe('string');
      expect(key.length).toBe(64);  // 32 bytes as hex
    });

    it('should create signer with generated key', () => {
      const signer2 = HMACSignerMessage.createWithGeneratedKey();
      expect(signer2).toBeDefined();
      signer2.destroy();
    });
  });

  // ========== Cleanup Tests ==========

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const signer2 = new HMACSignerMessage(testKey);
      signer2.destroy();
      // Verify no memory leaks (intervals cleared)
      expect(signer2.nonceCleanupInterval).toBeUndefined();
    });
  });
});
