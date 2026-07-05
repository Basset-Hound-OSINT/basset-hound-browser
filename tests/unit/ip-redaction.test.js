/**
 * Basset Hound Browser - IP Redaction Unit Tests
 * Tests for WebRTC IP address masking and privacy
 */

const { IPRedactionManager } = require('../../evasion/ip-redaction');

describe('IPRedactionManager', () => {
  let manager;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    manager = new IPRedactionManager({
      logger: mockLogger
    });
  });

  describe('Constructor', () => {
    test('should initialize with default settings', () => {
      expect(manager.enabled).toBe(true);
      expect(manager.privacyMode).toBe('mask');
      expect(manager.consistentMasking).toBe(true);
      expect(manager.preserveNetworkInfo).toBe(true);
    });

    test('should accept custom privacy modes', () => {
      const modes = ['mask', 'remove', 'obfuscate'];

      modes.forEach(mode => {
        const m = new IPRedactionManager({ privacyMode: mode });
        expect(m.privacyMode).toBe(mode);
      });
    });

    test('should disable consistent masking if requested', () => {
      manager = new IPRedactionManager({ consistentMasking: false });
      expect(manager.consistentMasking).toBe(false);
    });

    test('should respect enabled flag', () => {
      manager = new IPRedactionManager({ enabled: false });
      expect(manager.enabled).toBe(false);
    });
  });

  describe('Fingerprint Redaction', () => {
    test('should redact WebRTC data from fingerprint', () => {
      const fingerprint = {
        webrtc: {
          ipv4: '203.0.113.42',
          ipv6: '2001:db8::1'
        },
        canvas: 'hash123'
      };

      const redacted = manager.redactFingerprint(fingerprint);

      expect(redacted.webrtc.ipv4).not.toBe('203.0.113.42');
      expect(redacted.canvas).toBe('hash123'); // Unrelated data unchanged
    });

    test('should handle null fingerprint gracefully', () => {
      const result = manager.redactFingerprint(null);
      expect(result).toBeNull();
    });

    test('should return unchanged fingerprint when disabled', () => {
      manager = new IPRedactionManager({ enabled: false });
      const fingerprint = {
        webrtc: { ipv4: '203.0.113.42' }
      };

      const redacted = manager.redactFingerprint(fingerprint);

      expect(redacted.webrtc.ipv4).toBe('203.0.113.42');
    });

    test('should deep copy fingerprint to avoid mutation', () => {
      const fingerprint = {
        webrtc: { ipv4: '203.0.113.42' }
      };

      const redacted = manager.redactFingerprint(fingerprint);

      expect(fingerprint.webrtc.ipv4).toBe('203.0.113.42');
      expect(redacted.webrtc.ipv4).not.toBe('203.0.113.42');
    });

    test('should redact standalone IPv4 and IPv6 fields', () => {
      const fingerprint = {
        ipv4: '203.0.113.42',
        ipv6: '2001:db8::1',
        other: 'data'
      };

      const redacted = manager.redactFingerprint(fingerprint);

      expect(redacted.ipv4).not.toBe('203.0.113.42');
      expect(redacted.ipv6).not.toBe('2001:db8::1');
      expect(redacted.other).toBe('data');
    });
  });

  describe('WebRTC Redaction', () => {
    test('should redact WebRTC IPv4 addresses', () => {
      const webrtcData = {
        ipv4: '203.0.113.42'
      };

      const redacted = manager.redactWebRTC(webrtcData);

      expect(redacted.ipv4).not.toBe('203.0.113.42');
      expect(/^[0-9.]+$/.test(redacted.ipv4)).toBe(true); // Still an IP format
    });

    test('should redact WebRTC candidates array', () => {
      const webrtcData = {
        candidates: [
          'candidate:1 1 udp 1234567 203.0.113.42 54321 typ srflx raddr 192.168.1.1 rport 54320',
          'candidate:2 1 udp 1234567 192.168.1.1 54320 typ host'
        ]
      };

      const redacted = manager.redactWebRTC(webrtcData);

      expect(redacted.candidates[0]).not.toContain('203.0.113.42');
      expect(redacted.candidates[1]).not.toContain('192.168.1.1');
    });

    test('should handle null WebRTC data', () => {
      const result = manager.redactWebRTC(null);
      expect(result).toBeNull();
    });
  });

  describe('IPv4 Redaction', () => {
    test('should redact IPv4 addresses in mask mode', () => {
      const ip = '203.0.113.42';
      const redacted = manager.redactIPv4(ip);

      expect(redacted).not.toBe(ip);
      expect(/^[0-9.]+$/.test(redacted)).toBe(true);
    });

    test('should remove IPv4 addresses in remove mode', () => {
      manager = new IPRedactionManager({ privacyMode: 'remove' });
      const ip = '203.0.113.42';
      const redacted = manager.redactIPv4(ip);

      expect(redacted).toBeNull();
    });

    test('should handle null IPv4', () => {
      const result = manager.redactIPv4(null);
      expect(result).toBeNull();
    });

    test('should use consistent masking for same IP', () => {
      const ip = '203.0.113.42';
      const masked1 = manager.redactIPv4(ip);
      const masked2 = manager.redactIPv4(ip);

      expect(masked1).toBe(masked2);
    });

    test('should mask different IPs differently', () => {
      const ip1 = '203.0.113.42';
      const ip2 = '198.51.100.89';

      const masked1 = manager.redactIPv4(ip1);
      const masked2 = manager.redactIPv4(ip2);

      expect(masked1).not.toBe(masked2);
    });
  });

  describe('IPv6 Redaction', () => {
    test('should redact IPv6 addresses in mask mode', () => {
      const ip = '2001:db8::1';
      const redacted = manager.redactIPv6(ip);

      expect(redacted).not.toBe(ip);
      expect(redacted).toContain(':'); // Still IPv6 format
    });

    test('should remove IPv6 addresses in remove mode', () => {
      manager = new IPRedactionManager({ privacyMode: 'remove' });
      const ip = '2001:db8::1';
      const redacted = manager.redactIPv6(ip);

      expect(redacted).toBeNull();
    });

    test('should use consistent masking for same IPv6', () => {
      const ip = '2001:db8::1';
      const masked1 = manager.redactIPv6(ip);
      const masked2 = manager.redactIPv6(ip);

      expect(masked1).toBe(masked2);
    });
  });

  describe('ICE Candidate Redaction', () => {
    test('should redact IP from candidate string', () => {
      const candidate = 'candidate:1 1 udp 1234567 203.0.113.42 54321 typ srflx raddr 192.168.1.1 rport 54320';
      const redacted = manager.redactCandidate(candidate);

      expect(redacted).not.toContain('203.0.113.42');
      expect(redacted).toContain('typ srflx'); // Type preserved
    });

    test('should handle non-string candidates', () => {
      const result = manager.redactCandidate(null);
      expect(result).toBeNull();
    });

    test('should handle candidates without IP addresses', () => {
      const candidate = 'candidate: type srflx';
      const result = manager.redactCandidate(candidate);

      expect(result).toBe(candidate); // Unchanged if no IP found
    });

    test('should redact multiple IPs in candidate', () => {
      const candidate = 'candidate:1 1 udp 203.0.113.42 54321 raddr 192.168.1.1 rport 54320';
      const redacted = manager.redactCandidate(candidate);

      expect(redacted).not.toContain('203.0.113.42');
      expect(redacted).not.toContain('192.168.1.1');
    });
  });

  describe('IP String Redaction', () => {
    test('should redact all IPv4 addresses in a string', () => {
      const str = 'Connection from 203.0.113.42 to 198.51.100.89';
      const redacted = manager.redactIPsInString(str);

      expect(redacted).not.toContain('203.0.113.42');
      expect(redacted).not.toContain('198.51.100.89');
    });

    test('should handle non-string inputs', () => {
      const result = manager.redactIPsInString(null);
      expect(result).toBeNull();

      const result2 = manager.redactIPsInString(123);
      expect(result2).toBe(123);
    });

    test('should preserve non-IP content', () => {
      const str = 'Server logs with IP 203.0.113.42 and text';
      const redacted = manager.redactIPsInString(str);

      expect(redacted).toContain('Server logs');
      expect(redacted).toContain('and text');
      expect(redacted).not.toContain('203.0.113.42');
    });

    test('should redact IPv6 in strings', () => {
      const str = 'IPv6 address: 2001:db8::1 is connected';
      const redacted = manager.redactIPsInString(str);

      expect(redacted).not.toContain('2001:db8::1');
      expect(redacted).toContain('is connected');
    });
  });

  describe('Private IP Handling', () => {
    test('should identify private IPv4 ranges', () => {
      const privateIPs = [
        '10.0.0.1',
        '172.16.0.1',
        '172.31.255.255',
        '192.168.1.1',
        '127.0.0.1',
        '169.254.1.1'
      ];

      privateIPs.forEach(ip => {
        expect(manager._isPrivateIP(ip)).toBe(true);
      });
    });

    test('should identify public IPs', () => {
      const publicIPs = [
        '8.8.8.8',
        '203.0.113.42',
        '198.51.100.89',
        '1.1.1.1'
      ];

      publicIPs.forEach(ip => {
        expect(manager._isPrivateIP(ip)).toBe(false);
      });
    });

    test('should mask private IPs differently from public', () => {
      const privateIP = '192.168.1.1';
      const publicIP = '203.0.113.42';

      const maskedPrivate = manager._getMaskedIP(privateIP);
      const maskedPublic = manager._getMaskedIP(publicIP);

      expect(maskedPrivate).not.toEqual(maskedPublic);
    });

    test('should preserve private IP prefix when masking', () => {
      const privateIP = '192.168.1.1';
      const masked = manager._getMaskedIP(privateIP);

      expect(masked).toMatch(/^192\.168\./);
    });
  });

  describe('Privacy Modes', () => {
    test('mask mode should preserve IP format', () => {
      manager = new IPRedactionManager({ privacyMode: 'mask' });
      const ip = '203.0.113.42';
      const masked = manager._getMaskedIP(ip);

      expect(/^\d+\.\d+\.\d+\.\d+$/.test(masked)).toBe(true);
    });

    test('remove mode should return null or default', () => {
      manager = new IPRedactionManager({ privacyMode: 'remove' });
      const ip = '203.0.113.42';
      const result = manager._getMaskedIP(ip);

      expect(result).toMatch(/^\d+\.\d+\.\d+\.\d+$/); // Returns placeholder
    });

    test('obfuscate mode should randomize all octets', () => {
      manager = new IPRedactionManager({ privacyMode: 'obfuscate' });
      const ip = '203.0.113.42';
      const obfuscated = manager._getMaskedIP(ip);

      expect(obfuscated).not.toBe(ip);
      expect(/^\d+\.\d+\.\d+\.\d+$/.test(obfuscated)).toBe(true);
    });
  });

  describe('Session Mapping', () => {
    test('should maintain consistent mapping across calls', () => {
      const ip = '203.0.113.42';

      const masked1 = manager._getMaskedIP(ip);
      const masked2 = manager._getMaskedIP(ip);
      const masked3 = manager._getMaskedIP(ip);

      expect(masked1).toBe(masked2);
      expect(masked2).toBe(masked3);
    });

    test('should reset mapping when requested', () => {
      const ip = '203.0.113.42';

      const masked1 = manager._getMaskedIP(ip);
      manager.resetMapping();
      const masked2 = manager._getMaskedIP(ip);

      // After reset, same IP may get different mask (depends on implementation)
      // But mapping should be active again
      expect(manager.ipMappings.size).toBe(1);
    });

    test('should track multiple IP mappings', () => {
      const ips = ['203.0.113.42', '198.51.100.89', '192.0.2.1'];

      ips.forEach(ip => {
        manager._getMaskedIP(ip);
      });

      expect(manager.ipMappings.size).toBe(3);
    });

    test('should disable consistent mapping when requested', () => {
      manager = new IPRedactionManager({ consistentMasking: false });
      const ip = '203.0.113.42';

      const masked1 = manager._getMaskedIP(ip);
      const masked2 = manager._getMaskedIP(ip);

      // Without consistent masking, might differ (but implementation dependent)
      expect(manager.ipMappings.size).toBe(0); // No mappings stored
    });
  });

  describe('Statistics', () => {
    test('should report redaction statistics', () => {
      manager._getMaskedIP('203.0.113.42');
      manager._getMaskedIP('198.51.100.89');

      const stats = manager.getStats();

      expect(stats.enabled).toBe(true);
      expect(stats.privacyMode).toBe('mask');
      expect(stats.mappedIPCount).toBe(2);
      expect(stats.consistentMasking).toBe(true);
    });

    test('should reflect updates in statistics', () => {
      const stats1 = manager.getStats();
      expect(stats1.mappedIPCount).toBe(0);

      manager._getMaskedIP('203.0.113.42');
      const stats2 = manager.getStats();
      expect(stats2.mappedIPCount).toBe(1);

      manager.resetMapping();
      const stats3 = manager.getStats();
      expect(stats3.mappedIPCount).toBe(0);
    });
  });

  describe('IPv6 Validation', () => {
    test('should identify valid IPv6 addresses', () => {
      const validIpv6 = [
        '2001:db8::1',
        'fe80::1',
        '::1',
        '2001:0db8:0000:0000:0000:0000:0000:0001'
      ];

      validIpv6.forEach(ip => {
        expect(manager._isValidIPv6(ip)).toBe(true);
      });
    });

    test('should reject invalid IPv6 addresses', () => {
      const invalidIpv6 = [
        '203.0.113.42',
        'not-an-ip',
        'gggg::1',
        ':::'
      ];

      invalidIpv6.forEach(ip => {
        expect(manager._isValidIPv6(ip)).toBe(false);
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle mixed IPv4 and IPv6 in same string', () => {
      const str = 'IPv4: 203.0.113.42 and IPv6: 2001:db8::1';
      const redacted = manager.redactIPsInString(str);

      expect(redacted).not.toContain('203.0.113.42');
      expect(redacted).not.toContain('2001:db8::1');
    });

    test('should handle multiple occurrences of same IP', () => {
      const str = '203.0.113.42 connects to 203.0.113.42';
      const redacted = manager.redactIPsInString(str);

      const parts = redacted.split(' ');
      const ipLike = parts.filter(p => /^\d+\.\d+\.\d+\.\d+$/.test(p));

      // Both occurrences should be masked consistently
      expect(ipLike.length).toBe(2);
    });

    test('should handle empty strings', () => {
      const result = manager.redactIPsInString('');
      expect(result).toBe('');
    });

    test('should handle very large fingerprint objects', () => {
      const fingerprint = {
        webrtc: { ipv4: '203.0.113.42' },
        // Create many properties
        ...Array(100).fill(0).reduce((acc, _, i) => {
          acc[`field${i}`] = `value${i}`;
          return acc;
        }, {})
      };

      const redacted = manager.redactFingerprint(fingerprint);

      expect(redacted.webrtc.ipv4).not.toBe('203.0.113.42');
      expect(Object.keys(redacted).length).toBeGreaterThan(100);
    });
  });
});
