/**
 * Coherence Validators Tests
 * Comprehensive test suite for 5-layer coherence validation system
 */

const {
  IPNetworkValidator,
  TLSHTTPValidator,
  DeviceFingerprintValidator,
  BehavioralPatternValidator,
  SessionIdentityValidator,
  MasterCoherenceValidator
} = require('../../src/evasion/coherence-validators');

describe('Layer 1: IPNetworkValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new IPNetworkValidator();
  });

  describe('IP Consistency', () => {
    test('should accept consistent IP addresses', () => {
      const result1 = validator.validateIPConsistency({
        ip: '192.168.1.1',
        asn: 'AS12345',
        timestamp: Date.now()
      });

      expect(result1.violations.length).toBe(0);
      expect(result1.score).toBe(1.0);
    });

    test('should flag too many IP changes', () => {
      const baseTime = Date.now();

      // Simulate multiple IP changes
      for (let i = 0; i < 5; i++) {
        validator.validateIPConsistency({
          ip: `192.168.1.${i}`,
          timestamp: baseTime + (i * 60000)  // 1 minute apart
        });
      }

      expect(validator.ipHistory.length).toBe(5);
    });

    test('should detect too-quick IP changes', () => {
      validator.validateIPConsistency({
        ip: '192.168.1.1',
        timestamp: Date.now()
      });

      const result = validator.validateIPConsistency({
        ip: '192.168.1.2',
        timestamp: Date.now() + 5000  // 5 seconds later
      });

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].component).toBe('ip_change_timing');
    });

    test('should accept reasonable IP change timing', () => {
      validator.validateIPConsistency({
        ip: '192.168.1.1',
        timestamp: Date.now()
      });

      const result = validator.validateIPConsistency({
        ip: '192.168.1.2',
        timestamp: Date.now() + 60000  // 1 minute later
      });

      // Should not have timing violations
      expect(result.violations.filter(v => v.component === 'ip_change_timing').length).toBe(0);
    });

    test('should flag ASN changes', () => {
      validator.validateIPConsistency({
        ip: '192.168.1.1',
        asn: 'AS12345',
        timestamp: Date.now()
      });

      const result = validator.validateIPConsistency({
        ip: '192.168.1.2',
        asn: 'AS54321',
        timestamp: Date.now() + 60000
      });

      const asnViolations = result.violations.filter(v => v.component === 'asn_consistency');
      expect(asnViolations.length).toBeGreaterThan(0);
    });
  });

  describe('Geolocation Consistency', () => {
    test('should accept consistent geolocation', () => {
      const result = validator.validateGeolocationConsistency({
        latitude: 40.7128,
        longitude: -74.0060,
        country: 'US',
        city: 'New York'
      });

      expect(result.violations.length).toBe(0);
      expect(result.score).toBe(1.0);
    });

    test('should detect impossible travel speed', () => {
      validator.validateGeolocationConsistency({
        latitude: 40.7128,
        longitude: -74.0060,
        country: 'US',
        timestamp: Date.now()
      });

      // London coordinates
      const result = validator.validateGeolocationConsistency({
        latitude: 51.5074,
        longitude: -0.1278,
        country: 'UK',
        timestamp: Date.now() + 60000  // 1 minute later (impossible)
      });

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].component).toBe('geolocation_travel_speed');
    });

    test('should allow reasonable travel distance', () => {
      validator.validateGeolocationConsistency({
        latitude: 40.7128,
        longitude: -74.0060,
        country: 'US',
        timestamp: Date.now()
      });

      // ~100 km away (realistic driving distance)
      const result = validator.validateGeolocationConsistency({
        latitude: 40.0,
        longitude: -75.0,
        country: 'US',
        timestamp: Date.now() + 3600000  // 1 hour later
      });

      expect(result.violations.filter(v => v.component === 'geolocation_travel_speed').length).toBe(0);
    });

    test('should flag country changes', () => {
      validator.validateGeolocationConsistency({
        latitude: 40.7128,
        longitude: -74.0060,
        country: 'US',
        timestamp: Date.now()
      });

      const result = validator.validateGeolocationConsistency({
        latitude: 48.8566,
        longitude: 2.3522,
        country: 'FR',
        timestamp: Date.now() + 7200000  // 2 hours later
      });

      expect(result.violations.some(v => v.component === 'country_change')).toBe(true);
    });
  });

  describe('Haversine Distance Calculation', () => {
    test('should calculate distance between coordinates', () => {
      const distance = validator.calculateDistance(
        40.7128, -74.0060,  // NYC
        51.5074, -0.1278    // London
      );

      // ~5570 km (approximate)
      expect(distance).toBeGreaterThan(5500);
      expect(distance).toBeLessThan(5600);
    });

    test('should handle zero distance', () => {
      const distance = validator.calculateDistance(
        40.7128, -74.0060,
        40.7128, -74.0060
      );

      expect(distance).toBeLessThan(1);
    });
  });
});

describe('Layer 2: TLSHTTPValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new TLSHTTPValidator();
  });

  describe('TLS Consistency', () => {
    test('should accept consistent JA3 fingerprints', () => {
      const ja3 = 'abc123def456';
      const result = validator.validateTLSConsistency({
        ja3,
        tlsVersion: 'TLSv1.3',
        cipherSuite: 'TLS_AES_256_GCM_SHA384'
      });

      expect(result.violations.length).toBe(0);
      expect(result.score).toBe(1.0);
    });

    test('should flag JA3 changes', () => {
      validator.validateTLSConsistency({
        ja3: 'abc123def456',
        tlsVersion: 'TLSv1.3',
        cipherSuite: 'TLS_AES_256_GCM_SHA384'
      });

      const result = validator.validateTLSConsistency({
        ja3: 'different_ja3_xyz',
        tlsVersion: 'TLSv1.3',
        cipherSuite: 'TLS_AES_256_GCM_SHA384'
      });

      expect(result.violations.some(v => v.component === 'ja3_consistency')).toBe(true);
    });

    test('should flag cipher suite changes', () => {
      validator.validateTLSConsistency({
        ja3: 'abc123',
        tlsVersion: 'TLSv1.3',
        cipherSuite: 'TLS_AES_256_GCM_SHA384'
      });

      const result = validator.validateTLSConsistency({
        ja3: 'abc123',
        tlsVersion: 'TLSv1.3',
        cipherSuite: 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256'
      });

      expect(result.violations.some(v => v.component === 'cipher_suite')).toBe(true);
    });

    test('should flag TLS version changes', () => {
      validator.validateTLSConsistency({
        ja3: 'abc123',
        tlsVersion: 'TLSv1.3',
        cipherSuite: 'TLS_AES_256_GCM_SHA384'
      });

      const result = validator.validateTLSConsistency({
        ja3: 'abc123',
        tlsVersion: 'TLSv1.2',
        cipherSuite: 'TLS_AES_256_GCM_SHA384'
      });

      expect(result.violations.some(v => v.component === 'tls_version')).toBe(true);
    });

    test('should track unique JA3 fingerprints', () => {
      validator.validateTLSConsistency({ ja3: 'fp1' });
      validator.validateTLSConsistency({ ja3: 'fp2' });
      validator.validateTLSConsistency({ ja3: 'fp1' });

      expect(validator.ja3Fingerprints.size).toBe(2);
    });
  });

  describe('HTTP Headers', () => {
    test('should accept consistent headers', () => {
      const result = validator.validateHTTPHeaders({
        'user-agent': 'Mozilla/5.0 Chrome',
        'accept-language': 'en-US,en;q=0.9',
        'accept-encoding': 'gzip, deflate, br'
      });

      expect(result.violations.length).toBe(0);
    });

    test('should flag User-Agent changes', () => {
      validator.validateHTTPHeaders({
        'user-agent': 'Mozilla/5.0 Chrome',
        'accept-language': 'en-US,en;q=0.9'
      });

      const result = validator.validateHTTPHeaders({
        'user-agent': 'Mozilla/5.0 Firefox',
        'accept-language': 'en-US,en;q=0.9'
      });

      expect(result.violations.some(v => v.component === 'user_agent')).toBe(true);
    });

    test('should flag Accept-Language changes', () => {
      validator.validateHTTPHeaders({
        'accept-language': 'en-US,en;q=0.9'
      });

      const result = validator.validateHTTPHeaders({
        'accept-language': 'fr-FR,fr;q=0.9'
      });

      expect(result.violations.some(v => v.component === 'accept_language')).toBe(true);
    });

    test('should flag Accept-Encoding changes', () => {
      validator.validateHTTPHeaders({
        'accept-encoding': 'gzip, deflate, br'
      });

      const result = validator.validateHTTPHeaders({
        'accept-encoding': 'gzip, deflate'
      });

      expect(result.violations.some(v => v.component === 'accept_encoding')).toBe(true);
    });
  });
});

describe('Layer 3: DeviceFingerprintValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new DeviceFingerprintValidator();
  });

  describe('Device Fingerprint Stability', () => {
    test('should accept stable device fingerprints', () => {
      const result = validator.validateDeviceFingerprint({
        canvas: 'canvas_hash_1234',
        webgl: 'webgl_hash_5678',
        audio: 'audio_hash_9999'
      });

      expect(result.violations.length).toBe(0);
      expect(result.score).toBe(1.0);
    });

    test('should flag fingerprint component changes', () => {
      validator.validateDeviceFingerprint({
        canvas: 'canvas_hash_1234',
        webgl: 'webgl_hash_5678'
      });

      const result = validator.validateDeviceFingerprint({
        canvas: 'canvas_hash_different',
        webgl: 'webgl_hash_5678'
      });

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].component).toBe('canvas');
    });

    test('should track individual component scores', () => {
      const result = validator.validateDeviceFingerprint({
        canvas: 'hash1',
        webgl: 'hash2'
      });

      expect(result.componentScores).toBeDefined();
      expect(result.componentScores.canvas).toBe(1.0);
      expect(result.componentScores.webgl).toBe(1.0);
    });

    test('should handle partial fingerprints', () => {
      const result = validator.validateDeviceFingerprint({
        canvas: 'hash1'
      });

      expect(result.violations.length).toBe(0);
      expect(result.componentScores.canvas).toBe(1.0);
    });
  });

  describe('Fingerprint Comparison', () => {
    test('should compare string fingerprints', () => {
      validator.fingerprints.canvas = 'hash1';
      const similarity = validator.compareFingerprints('hash1', 'hash1');
      expect(similarity).toBe(1.0);
    });

    test('should detect string fingerprint differences', () => {
      const similarity = validator.compareFingerprints('hash1', 'hash2');
      expect(similarity).toBe(0.0);
    });

    test('should compare object fingerprints', () => {
      const similarity = validator.compareFingerprints(
        { a: 1, b: 2, c: 3 },
        { a: 1, b: 2, c: 3 }
      );
      expect(similarity).toBe(1.0);
    });

    test('should handle partial object matches', () => {
      const similarity = validator.compareFingerprints(
        { a: 1, b: 2, c: 3 },
        { a: 1, b: 99, c: 3 }
      );
      expect(similarity).toBe(2 / 3);
    });
  });
});

describe('Layer 4: BehavioralPatternValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new BehavioralPatternValidator();
  });

  describe('Behavioral Consistency', () => {
    test('should accept consistent behavior', () => {
      const result = validator.validateBehavioralPattern({
        mouseSpeed: 50,
        typingSpeed: 45,
        pauseTiming: 800
      });

      expect(result.violations.length).toBe(0);
      expect(result.score).toBe(1.0);
    });

    test('should flag excessive mouse speed deviation', () => {
      validator.validateBehavioralPattern({ mouseSpeed: 50 });

      const result = validator.validateBehavioralPattern({
        mouseSpeed: 150  // 3x faster
      });

      expect(result.violations.some(v => v.component === 'mouse_speed')).toBe(true);
    });

    test('should flag typing speed deviation', () => {
      validator.validateBehavioralPattern({ typingSpeed: 50 });

      const result = validator.validateBehavioralPattern({
        typingSpeed: 150  // 3x faster
      });

      expect(result.violations.some(v => v.component === 'typing_speed')).toBe(true);
    });

    test('should track behavior history', () => {
      validator.validateBehavioralPattern({ mouseSpeed: 50 });
      validator.validateBehavioralPattern({ mouseSpeed: 55 });
      validator.validateBehavioralPattern({ mouseSpeed: 48 });

      expect(validator.behaviors.length).toBe(3);
      expect(validator.patterns.mouseSpeed.length).toBe(3);
    });
  });

  describe('Deviation Calculation', () => {
    test('should calculate zero deviation for identical values', () => {
      const deviation = validator.calculateDeviation([50, 50, 50], 50);
      expect(deviation).toBe(0);
    });

    test('should calculate deviation from baseline', () => {
      const history = [100, 100, 100];
      const deviation = validator.calculateDeviation(history, 150);
      expect(deviation).toBe(0.5);  // 50% deviation
    });

    test('should handle empty history', () => {
      const deviation = validator.calculateDeviation([], 50);
      expect(deviation).toBe(0);
    });

    test('should handle zero mean', () => {
      const deviation = validator.calculateDeviation([0, 0, 0], 10);
      expect(deviation).toBe(0);
    });
  });
});

describe('Layer 5: SessionIdentityValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new SessionIdentityValidator();
  });

  describe('Cookie Consistency', () => {
    test('should accept consistent cookies', () => {
      const result = validator.validateCookieConsistency([
        { name: 'session_id', value: 'abc123', domain: 'example.com' },
        { name: 'user_pref', value: 'dark_mode', domain: 'example.com' }
      ]);

      expect(result.violations.length).toBe(0);
    });

    test('should flag important cookie changes', () => {
      validator.validateCookieConsistency([
        { name: 'session_token', value: 'token1', domain: 'example.com' }
      ]);

      const result = validator.validateCookieConsistency([
        { name: 'session_token', value: 'token2', domain: 'example.com' }
      ]);

      expect(result.violations.some(v => v.component === 'cookie_change')).toBe(true);
    });

    test('should identify important cookies', () => {
      const isImportant1 = validator.isImportantCookie('session_token');
      const isImportant2 = validator.isImportantCookie('auth_state');
      const isImportant3 = validator.isImportantCookie('theme');

      expect(isImportant1).toBe(true);
      expect(isImportant2).toBe(true);
      expect(isImportant3).toBe(false);
    });

    test('should track cookie count', () => {
      const result = validator.validateCookieConsistency([
        { name: 'cookie1', value: 'val1' },
        { name: 'cookie2', value: 'val2' },
        { name: 'cookie3', value: 'val3' }
      ]);

      expect(result.cookieCount).toBe(3);
    });
  });

  describe('LocalStorage Persistence', () => {
    test('should accept persistent storage', () => {
      const result = validator.validateLocalStoragePersistence([
        { key: 'user_data', value: 'data1' },
        { key: 'preferences', value: 'prefs1' }
      ]);

      expect(result.violations.length).toBe(0);
    });

    test('should flag storage value changes', () => {
      validator.validateLocalStoragePersistence([
        { key: 'user_data', value: 'data1' }
      ]);

      const result = validator.validateLocalStoragePersistence([
        { key: 'user_data', value: 'data2' }
      ]);

      expect(result.violations.some(v => v.component === 'localstorage_change')).toBe(true);
    });

    test('should track storage item count', () => {
      const result = validator.validateLocalStoragePersistence([
        { key: 'item1', value: 'val1' },
        { key: 'item2', value: 'val2' }
      ]);

      expect(result.itemCount).toBe(2);
    });
  });

  describe('Cache Behavior', () => {
    test('should accept stable cache', () => {
      const result = validator.validateCacheBehavior({
        size: 1024,
        items: 10
      });

      expect(result.violations.length).toBe(0);
    });

    test('should flag unexpected cache size decrease', () => {
      validator.validateCacheBehavior({ size: 2048, items: 20 });

      const result = validator.validateCacheBehavior({
        size: 1024,  // Decreased
        items: 10,
        cleared: false
      });

      expect(result.violations.some(v => v.component === 'cache_behavior')).toBe(true);
    });

    test('should allow cache size decrease if cleared', () => {
      validator.validateCacheBehavior({ size: 2048 });

      const result = validator.validateCacheBehavior({
        size: 512,
        cleared: true
      });

      expect(result.violations.length).toBe(0);
    });
  });
});

describe('MasterCoherenceValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new MasterCoherenceValidator();
  });

  describe('5-Layer Validation', () => {
    test('should validate all layers', () => {
      const result = validator.validateAllLayers({
        network: {
          ip: '192.168.1.1',
          timestamp: Date.now()
        },
        tls: {
          ja3: 'test_ja3',
          tlsVersion: 'TLSv1.3'
        },
        device: {
          canvas: 'canvas_hash'
        },
        behavior: {
          mouseSpeed: 50
        },
        cookies: [
          { name: 'session', value: 'abc123' }
        ]
      });

      expect(result.layers).toBeDefined();
      expect(result.overallScore).toBeDefined();
      expect(result.violations).toBeDefined();
    });

    test('should calculate overall coherence score', () => {
      const result = validator.validateAllLayers({
        network: { ip: '192.168.1.1' },
        device: { canvas: 'hash1' }
      });

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
    });

    test('should generate recommendations', () => {
      const result = validator.validateAllLayers({
        tls: {
          ja3: 'old_ja3',
          tlsVersion: 'TLSv1.2'
        }
      });

      // Record second validation with different JA3
      validator.validateAllLayers({
        tls: {
          ja3: 'new_ja3',
          tlsVersion: 'TLSv1.2'
        }
      });

      const secondResult = validator.validateAllLayers({
        tls: {
          ja3: 'another_ja3',
          tlsVersion: 'TLSv1.2'
        }
      });

      expect(secondResult.recommendations).toBeDefined();
    });

    test('should track validation history', () => {
      validator.validateAllLayers({ network: { ip: '1.1.1.1' } });
      validator.validateAllLayers({ network: { ip: '2.2.2.2' } });
      validator.validateAllLayers({ network: { ip: '3.3.3.3' } });

      expect(validator.validationHistory.length).toBe(3);
    });
  });

  describe('Recommendation Generation', () => {
    test('should recommend restart on critical violations', () => {
      validator.validateAllLayers({
        network: { ip: '1.1.1.1' }
      });

      // Simulate critical violation by directly adding
      validator.validationHistory[0].violations.push({
        severity: 'critical',
        component: 'os_change'
      });

      const recommendations = validator.generateRecommendations(
        validator.validationHistory[0].violations
      );

      expect(recommendations.some(r => r.action.includes('Restart'))).toBe(true);
    });

    test('should recommend evasion recovery on multiple violations', () => {
      const violations = [
        { severity: 'high', component: 'ip_consistency' },
        { severity: 'high', component: 'user_agent' }
      ];

      const recommendations = validator.generateRecommendations(violations);

      expect(recommendations.some(r => r.action.includes('recovery'))).toBe(true);
    });

    test('should recommend IP stabilization', () => {
      const violations = [
        { severity: 'high', component: 'ip_consistency' }
      ];

      const recommendations = validator.generateRecommendations(violations);

      expect(recommendations.some(r => r.action.includes('IP'))).toBe(true);
    });
  });

  describe('Report Generation', () => {
    test('should generate coherence report', () => {
      validator.validateAllLayers({ network: { ip: '1.1.1.1' } });
      const report = validator.getReport();

      expect(report.currentScore).toBeDefined();
      expect(report.validationCount).toBe(1);
      expect(report.scoreHistory).toBeDefined();
    });

    test('should include recent validations in report', () => {
      for (let i = 0; i < 10; i++) {
        validator.validateAllLayers({ network: { ip: '1.1.1.1' } });
      }

      const report = validator.getReport();

      expect(report.recentValidations.length).toBeLessThanOrEqual(5);
    });

    test('should track score history', () => {
      validator.validateAllLayers({ network: { ip: '1.1.1.1' } });
      validator.validateAllLayers({ network: { ip: '1.1.1.1' } });

      const report = validator.getReport();

      expect(report.scoreHistory.length).toBe(2);
      expect(report.scoreHistory[0].score).toBeDefined();
      expect(report.scoreHistory[0].timestamp).toBeDefined();
    });
  });

  describe('Validator Reset', () => {
    test('should reset validator state', () => {
      validator.validateAllLayers({ network: { ip: '1.1.1.1' } });
      expect(validator.validationHistory.length).toBe(1);

      validator.reset();

      expect(validator.validationHistory.length).toBe(0);
      expect(validator.overallScore).toBe(1.0);
    });

    test('should create new layer instances on reset', () => {
      const layer1Before = validator.layer1;
      validator.reset();
      const layer1After = validator.layer1;

      expect(layer1Before).not.toBe(layer1After);
    });
  });
});

describe('Performance Tests', () => {
  test('should validate all layers efficiently', () => {
    const validator = new MasterCoherenceValidator();
    const start = Date.now();

    for (let i = 0; i < 100; i++) {
      validator.validateAllLayers({
        network: { ip: '192.168.1.1' },
        tls: { ja3: 'test' },
        device: { canvas: 'hash' },
        behavior: { mouseSpeed: 50 },
        cookies: [{ name: 'test', value: 'val' }]
      });
    }

    const duration = Date.now() - start;

    // 100 validations should complete in < 500ms
    expect(duration).toBeLessThan(500);
  });

  test('should handle large validation history efficiently', () => {
    const validator = new MasterCoherenceValidator();

    // Build history
    for (let i = 0; i < 1000; i++) {
      validator.validateAllLayers({
        network: { ip: '1.1.1.1' }
      });
    }

    const start = Date.now();
    const report = validator.getReport();
    const duration = Date.now() - start;

    expect(report.validationCount).toBe(1000);
    expect(duration).toBeLessThan(100);
  });
});

describe('Integration Tests', () => {
  test('should coordinate validators across layers', () => {
    const validator = new MasterCoherenceValidator();

    // Simulate a complete request with data from all layers
    const result = validator.validateAllLayers({
      network: {
        ip: '192.168.1.1',
        asn: 'AS12345',
        geolocation: {
          latitude: 40.7128,
          longitude: -74.0060,
          country: 'US'
        }
      },
      tls: {
        ja3: 'abc123',
        tlsVersion: 'TLSv1.3',
        cipherSuite: 'TLS_AES_256_GCM_SHA384'
      },
      headers: {
        'user-agent': 'Mozilla/5.0',
        'accept-language': 'en-US'
      },
      device: {
        canvas: 'canvas_hash1',
        webgl: 'webgl_hash1',
        audio: 'audio_hash1'
      },
      behavior: {
        mouseSpeed: 50,
        typingSpeed: 45,
        pauseTiming: 800
      },
      cookies: [
        { name: 'session_id', value: 'token123' }
      ]
    });

    expect(result.layers.layer1).toBeDefined();
    expect(result.layers.layer2).toBeDefined();
    expect(result.layers.layer3).toBeDefined();
    expect(result.layers.layer4).toBeDefined();
    expect(result.layers.layer5).toBeDefined();
    expect(result.overallScore).toBeGreaterThan(0.8);
  });
});
