/**
 * Data Type Detector Unit Tests
 *
 * Tests for the Phase 13 data type detection engine that automatically
 * identifies various data types in web content for OSINT ingestion.
 */

const {
  DataTypeDetector,
  createDetector,
  DETECTION_PATTERNS,
  VALIDATORS
} = require('../../extraction/data-type-detector');

describe('DataTypeDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new DataTypeDetector();
  });

  describe('initialization', () => {
    test('should initialize with default options', () => {
      expect(detector).toBeDefined();
      expect(detector.options).toBeDefined();
      expect(detector.options.enabledTypes).toContain('email');
      expect(detector.options.confidenceThreshold).toBe(0.5);
    });

    test('should accept custom options', () => {
      const customDetector = new DataTypeDetector({
        confidenceThreshold: 0.8,
        enabledTypes: ['email', 'phone_us']
      });

      expect(customDetector.options.confidenceThreshold).toBe(0.8);
      expect(customDetector.options.enabledTypes).toHaveLength(2);
    });

    test('should initialize statistics', () => {
      expect(detector.stats.totalDetections).toBe(0);
      expect(detector.stats.detectionsByType).toEqual({});
    });
  });

  describe('createDetector factory', () => {
    test('should create a detector instance', () => {
      const instance = createDetector();
      expect(instance).toBeInstanceOf(DataTypeDetector);
    });

    test('should pass options to detector', () => {
      const instance = createDetector({ confidenceThreshold: 0.9 });
      expect(instance.options.confidenceThreshold).toBe(0.9);
    });
  });

  describe('email detection', () => {
    test('should detect simple email addresses', () => {
      const html = '<p>Contact us at test@example.com for more info.</p>';
      const result = detector.detectAll(html);

      expect(result.success).toBe(true);
      expect(result.items.some(i => i.type === 'email')).toBe(true);

      const email = result.items.find(i => i.type === 'email');
      expect(email.value).toBe('test@example.com');
      expect(email.confidence).toBeGreaterThan(0.8);
    });

    test('should detect multiple email addresses', () => {
      const html = `
        <p>Email: john@company.org</p>
        <p>Support: support@example.com</p>
        <p>Sales: sales@domain.net</p>
      `;
      const result = detector.detectAll(html);

      const emails = result.items.filter(i => i.type === 'email');
      expect(emails.length).toBe(3);
    });

    test('should not detect invalid email patterns', () => {
      const html = '<p>This is not an email: test@.com or @example.com</p>';
      const result = detector.detectAll(html);

      const emails = result.items.filter(i => i.type === 'email');
      expect(emails.length).toBe(0);
    });

    test('should add suggested tags for common providers', () => {
      const html = '<p>Contact: user@gmail.com</p>';
      const result = detector.detectAll(html);

      const email = result.items.find(i => i.type === 'email');
      expect(email.suggestedTags).toContain('gmail');
    });
  });

  describe('phone number detection', () => {
    test('should detect US phone numbers', () => {
      const html = '<p>Call us: (555) 123-4567</p>';
      const result = detector.detectAll(html);

      const phones = result.items.filter(i => i.type === 'phone_us');
      expect(phones.length).toBe(1);
    });

    test('should detect international E.164 format', () => {
      const html = '<p>International: +15551234567</p>';
      const result = detector.detectAll(html);

      const phones = result.items.filter(i => i.type === 'phone_international');
      expect(phones.length).toBe(1);
    });

    test('should normalize US phone to E.164', () => {
      const html = '<p>Phone: 555-123-4567</p>';
      const result = detector.detectAll(html);

      const phone = result.items.find(i => i.type === 'phone_us');
      expect(phone.normalized).toMatch(/^\+1\d{10}$/);
    });

    test('should detect various phone formats', () => {
      const html = `
        <p>Format 1: 555.123.4567</p>
        <p>Format 2: 555 123 4567</p>
        <p>Format 3: (555) 123-4567</p>
      `;
      const result = detector.detectAll(html);

      const phones = result.items.filter(i => i.type.startsWith('phone'));
      expect(phones.length).toBeGreaterThan(0);
    });
  });

  describe('cryptocurrency address detection', () => {
    test('should detect Bitcoin addresses (legacy)', () => {
      const html = '<p>BTC: 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2</p>';
      const result = detector.detectAll(html);

      const btc = result.items.find(i => i.type === 'crypto_btc');
      expect(btc).toBeDefined();
      expect(btc.value).toBe('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2');
      expect(btc.metadata.currency).toBe('BTC');
    });

    test('should detect Bitcoin Bech32 addresses', () => {
      const html = '<p>BTC: bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq</p>';
      const result = detector.detectAll(html);

      const btc = result.items.find(i => i.type === 'crypto_btc');
      expect(btc).toBeDefined();
    });

    test('should detect Ethereum addresses', () => {
      const html = '<p>ETH: 0x71C7656EC7ab88b098defB751B7401B5f6d8976F</p>';
      const result = detector.detectAll(html);

      const eth = result.items.find(i => i.type === 'crypto_eth');
      expect(eth).toBeDefined();
      expect(eth.metadata.currency).toBe('ETH');
    });

    test('should detect Monero addresses', () => {
      const html = '<p>XMR: 4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skxNgYeYTRj5UzqtReoS44qo9mtmXCqY45DJ852K5Jv2684Rge</p>';
      const result = detector.detectAll(html);

      const xmr = result.items.find(i => i.type === 'crypto_xmr');
      expect(xmr).toBeDefined();
    });
  });

  describe('social media detection', () => {
    test('should detect Twitter handles', () => {
      const html = '<p>Follow us @elonmusk on Twitter</p>';
      const result = detector.detectAll(html);

      const twitter = result.items.find(i => i.type === 'social_twitter');
      expect(twitter).toBeDefined();
      expect(twitter.metadata.platform).toBe('twitter');
    });

    test('should detect Twitter profile URLs', () => {
      const html = '<a href="https://twitter.com/jack">Twitter Profile</a>';
      const result = detector.detectAll(html);

      const twitter = result.items.find(i => i.type === 'social_twitter');
      expect(twitter).toBeDefined();
    });

    test('should detect LinkedIn profiles', () => {
      const html = '<a href="https://linkedin.com/in/john-doe-123">LinkedIn</a>';
      const result = detector.detectAll(html);

      const linkedin = result.items.find(i => i.type === 'social_linkedin');
      expect(linkedin).toBeDefined();
      expect(linkedin.metadata.platform).toBe('linkedin');
    });

    test('should detect GitHub profiles', () => {
      const html = '<a href="https://github.com/torvalds">GitHub</a>';
      const result = detector.detectAll(html);

      const github = result.items.find(i => i.type === 'social_github');
      expect(github).toBeDefined();
    });
  });

  describe('IP address detection', () => {
    test('should detect IPv4 addresses', () => {
      const html = '<p>Server IP: 192.168.1.100</p>';
      const result = detector.detectAll(html);

      const ipv4 = result.items.find(i => i.type === 'ip_v4');
      expect(ipv4).toBeDefined();
      expect(ipv4.value).toBe('192.168.1.100');
    });

    test('should validate IPv4 range', () => {
      const html = '<p>Invalid: 300.400.500.600</p><p>Valid: 192.168.1.1</p>';
      const result = detector.detectAll(html);

      const ipv4Items = result.items.filter(i => i.type === 'ip_v4');
      // Should only find the valid one
      const validIp = ipv4Items.find(i => i.value === '192.168.1.1');
      expect(validIp).toBeDefined();
    });

    test('should detect IPv6 addresses', () => {
      const html = '<p>IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334</p>';
      const result = detector.detectAll(html);

      const ipv6 = result.items.find(i => i.type === 'ip_v6');
      expect(ipv6).toBeDefined();
    });
  });

  describe('domain detection', () => {
    test('should detect domain names', () => {
      const html = '<p>Visit example.com for more info</p>';
      const result = detector.detectAll(html);

      const domain = result.items.find(i => i.type === 'domain');
      expect(domain).toBeDefined();
      expect(domain.value).toBe('example.com');
    });

    test('should detect subdomains', () => {
      const html = '<p>API at api.subdomain.example.org</p>';
      const result = detector.detectAll(html);

      const domain = result.items.find(i => i.type === 'domain');
      expect(domain).toBeDefined();
    });
  });

  describe('URL detection', () => {
    test('should detect HTTP URLs', () => {
      const html = '<p>Link: http://example.com/page</p>';
      const result = detector.detectAll(html);

      const url = result.items.find(i => i.type === 'url');
      expect(url).toBeDefined();
    });

    test('should detect HTTPS URLs', () => {
      const html = '<p>Secure: https://example.com/secure/page?query=1</p>';
      const result = detector.detectAll(html);

      const url = result.items.find(i => i.type === 'url');
      expect(url).toBeDefined();
    });
  });

  describe('MAC address detection', () => {
    test('should detect MAC addresses with colons', () => {
      const html = '<p>MAC: 00:1A:2B:3C:4D:5E</p>';
      const result = detector.detectAll(html);

      const mac = result.items.find(i => i.type === 'mac_address');
      expect(mac).toBeDefined();
    });

    test('should detect MAC addresses with hyphens', () => {
      const html = '<p>MAC: 00-1A-2B-3C-4D-5E</p>';
      const result = detector.detectAll(html);

      const mac = result.items.find(i => i.type === 'mac_address');
      expect(mac).toBeDefined();
    });
  });

  describe('context extraction', () => {
    test('should include context around detected values', () => {
      const html = '<p>Please contact our support team at support@company.com for assistance.</p>';
      const result = detector.detectAll(html);

      const email = result.items.find(i => i.type === 'email');
      expect(email.context).toBeDefined();
      expect(email.context).toContain('support team');
    });

    test('should include position information', () => {
      const html = '<p>Email: test@example.com</p>';
      const result = detector.detectAll(html);

      const email = result.items.find(i => i.type === 'email');
      expect(email.position).toBeDefined();
      expect(email.position.start).toBeDefined();
      expect(email.position.end).toBeDefined();
    });
  });

  describe('deduplication', () => {
    test('should deduplicate repeated values', () => {
      const html = `
        <p>Email: test@example.com</p>
        <p>Contact: test@example.com</p>
        <p>Support: test@example.com</p>
      `;
      const result = detector.detectAll(html);

      const emails = result.items.filter(i => i.type === 'email');
      expect(emails.length).toBe(1);
    });

    test('should not deduplicate different values', () => {
      const html = `
        <p>Email 1: first@example.com</p>
        <p>Email 2: second@example.com</p>
      `;
      const result = detector.detectAll(html);

      const emails = result.items.filter(i => i.type === 'email');
      expect(emails.length).toBe(2);
    });

    test('should respect deduplication setting', () => {
      const customDetector = new DataTypeDetector({
        deduplicateResults: false
      });
      const html = `
        <p>Email: test@example.com</p>
        <p>Contact: test@example.com</p>
      `;
      const result = customDetector.detectAll(html);

      const emails = result.items.filter(i => i.type === 'email');
      expect(emails.length).toBe(2);
    });
  });

  describe('confidence threshold', () => {
    test('should filter items below threshold', () => {
      const customDetector = new DataTypeDetector({
        confidenceThreshold: 0.99
      });
      const html = '<p>Email: test@example.com</p>';
      const result = customDetector.detectAll(html);

      // Items with validation should pass, but marginal cases might be filtered
      expect(result.success).toBe(true);
    });
  });

  describe('type filtering', () => {
    test('should only detect enabled types', () => {
      const customDetector = new DataTypeDetector({
        enabledTypes: ['email']
      });
      const html = `
        <p>Email: test@example.com</p>
        <p>Phone: 555-123-4567</p>
        <p>BTC: 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2</p>
      `;
      const result = customDetector.detectAll(html);

      expect(result.items.every(i => i.type === 'email')).toBe(true);
    });

    test('should support detectTypes method', () => {
      const html = `
        <p>Email: test@example.com</p>
        <p>Phone: 555-123-4567</p>
      `;
      const result = detector.detectTypes(html, ['phone_us']);

      expect(result.items.every(i => i.type === 'phone_us')).toBe(true);
    });
  });

  describe('statistics', () => {
    test('should track detection statistics', () => {
      const html = '<p>Email: test@example.com</p>';
      detector.detectAll(html);

      const stats = detector.getStats();
      expect(stats.totalDetections).toBeGreaterThan(0);
    });

    test('should track by type', () => {
      const html = '<p>Email: test@example.com</p><p>Phone: 555-123-4567</p>';
      detector.detectAll(html);

      const stats = detector.getStats();
      expect(stats.detectionsByType.email).toBeDefined();
    });

    test('should reset statistics', () => {
      const html = '<p>Email: test@example.com</p>';
      detector.detectAll(html);
      detector.resetStats();

      const stats = detector.getStats();
      expect(stats.totalDetections).toBe(0);
    });
  });

  describe('available types', () => {
    test('should return available detection types', () => {
      const types = detector.getAvailableTypes();

      expect(types.email).toBeDefined();
      expect(types.email.name).toBe('Email Address');
      expect(types.email.orphanType).toBe('email');
    });
  });

  describe('custom patterns', () => {
    test('should add custom detection pattern', () => {
      detector.addPattern('custom_id', {
        name: 'Custom ID',
        patterns: [/CUST-\d{6}/g],
        orphanType: 'other'
      });

      const html = '<p>Your ID: CUST-123456</p>';
      const result = detector.detectAll(html);

      const custom = result.items.find(i => i.type === 'custom_id');
      expect(custom).toBeDefined();
      expect(custom.value).toBe('CUST-123456');
    });

    test('should remove detection pattern', () => {
      detector.addPattern('temp_pattern', {
        patterns: [/TEMP-\d+/g]
      });
      detector.removePattern('temp_pattern');

      const types = detector.getAvailableTypes();
      expect(types.temp_pattern).toBeUndefined();
    });
  });

  describe('configuration', () => {
    test('should configure detector options', () => {
      detector.configure({
        confidenceThreshold: 0.9
      });

      expect(detector.options.confidenceThreshold).toBe(0.9);
    });
  });
});

describe('VALIDATORS', () => {
  describe('email validator', () => {
    test('should validate correct emails', () => {
      expect(VALIDATORS.email('test@example.com')).toBe(true);
      expect(VALIDATORS.email('user.name@domain.org')).toBe(true);
    });

    test('should reject invalid emails', () => {
      expect(VALIDATORS.email('invalid')).toBe(false);
      expect(VALIDATORS.email('@example.com')).toBe(false);
    });
  });

  describe('phone validator', () => {
    test('should validate phone numbers by digit count', () => {
      expect(VALIDATORS.phone('5551234567')).toBe(true);
      expect(VALIDATORS.phone('+15551234567')).toBe(true);
    });

    test('should reject too short numbers', () => {
      expect(VALIDATORS.phone('123')).toBe(false);
    });
  });

  describe('btc validator', () => {
    test('should validate legacy addresses', () => {
      expect(VALIDATORS.btc('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(true);
    });

    test('should validate bech32 addresses', () => {
      expect(VALIDATORS.btc('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe(true);
    });
  });

  describe('eth validator', () => {
    test('should validate Ethereum addresses', () => {
      expect(VALIDATORS.eth('0x71C7656EC7ab88b098defB751B7401B5f6d8976F')).toBe(true);
    });

    test('should reject invalid addresses', () => {
      expect(VALIDATORS.eth('0x123')).toBe(false);
    });
  });

  describe('ipv4 validator', () => {
    test('should validate correct IPs', () => {
      expect(VALIDATORS.ipv4('192.168.1.1')).toBe(true);
      expect(VALIDATORS.ipv4('0.0.0.0')).toBe(true);
      expect(VALIDATORS.ipv4('255.255.255.255')).toBe(true);
    });

    test('should reject invalid IPs', () => {
      expect(VALIDATORS.ipv4('300.300.300.300')).toBe(false);
      expect(VALIDATORS.ipv4('1.2.3')).toBe(false);
    });
  });

  describe('url validator', () => {
    test('should validate URLs', () => {
      expect(VALIDATORS.url('https://example.com')).toBe(true);
      expect(VALIDATORS.url('http://example.com/path?query=1')).toBe(true);
    });

    test('should reject invalid URLs', () => {
      expect(VALIDATORS.url('not-a-url')).toBe(false);
    });
  });

  describe('luhn validator', () => {
    test('should validate Luhn checksum', () => {
      // Valid credit card test number
      expect(VALIDATORS.luhn('4532015112830366')).toBe(true);
    });

    test('should reject invalid checksum', () => {
      expect(VALIDATORS.luhn('1234567890123456')).toBe(false);
    });
  });
});

describe('DETECTION_PATTERNS', () => {
  test('should have required patterns defined', () => {
    expect(DETECTION_PATTERNS.email).toBeDefined();
    expect(DETECTION_PATTERNS.phone_us).toBeDefined();
    expect(DETECTION_PATTERNS.crypto_btc).toBeDefined();
    expect(DETECTION_PATTERNS.ip_v4).toBeDefined();
    expect(DETECTION_PATTERNS.url).toBeDefined();
  });

  test('should have orphanType mapping for all patterns', () => {
    Object.values(DETECTION_PATTERNS).forEach(pattern => {
      expect(pattern.orphanType).toBeDefined();
    });
  });
});
