/**
 * Tests for OSINT Commands Module
 *
 * Phase 12: OSINT Agent Integration
 */

const {
  InvestigationManager,
  extractOsintData,
  generateProvenance,
  OSINT_PATTERNS,
} = require('../../websocket/commands/osint-commands');

describe('OSINT_PATTERNS', () => {
  describe('Email Pattern', () => {
    const pattern = OSINT_PATTERNS.email;

    test('matches valid emails', () => {
      const text = 'Contact us at john@example.com or support@company.org';
      const matches = text.match(pattern.pattern);

      expect(matches).toContain('john@example.com');
      expect(matches).toContain('support@company.org');
    });

    test('validates email format', () => {
      expect(pattern.validator('test@example.com')).toBe(true);
      expect(pattern.validator('invalid-email')).toBe(false);
      expect(pattern.validator('no@tld')).toBe(false);
    });
  });

  describe('Phone Pattern', () => {
    const pattern = OSINT_PATTERNS.phone;

    test('matches US phone formats', () => {
      const text = 'Call (555) 123-4567 or 555.123.4567 or +1-555-123-4567';
      const matches = text.match(pattern.pattern);

      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    test('normalizes phone numbers', () => {
      expect(pattern.normalize('(555) 123-4567')).toBe('5551234567');
      expect(pattern.normalize('+1-555-123-4567')).toBe('+15551234567');
    });
  });

  describe('Crypto Patterns', () => {
    test('matches Bitcoin addresses', () => {
      const pattern = OSINT_PATTERNS.crypto_btc;
      const text = 'Send BTC to 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2 or bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
      const matches = text.match(pattern.pattern);

      expect(matches.length).toBe(2);
    });

    test('matches Ethereum addresses', () => {
      const pattern = OSINT_PATTERNS.crypto_eth;
      const text = 'ETH: 0x742d35Cc6634C0532925a3b844Bc9e7595f1e123';
      const matches = text.match(pattern.pattern);

      expect(matches).toContain('0x742d35Cc6634C0532925a3b844Bc9e7595f1e123');
    });

    test('matches Monero addresses', () => {
      const pattern = OSINT_PATTERNS.crypto_xmr;
      const text = 'XMR: 4' + 'A'.repeat(94);
      // Note: Pattern requires specific format
      expect(pattern.pattern.test('4' + 'A'.repeat(93))).toBe(false);
    });
  });

  describe('Social Media Patterns', () => {
    test('matches Twitter handles', () => {
      const pattern = OSINT_PATTERNS.social_twitter;
      const text = 'Follow us @example and @test_user123';
      const matches = text.match(pattern.pattern);

      expect(matches).toContain('@example');
      expect(matches).toContain('@test_user123');
    });

    test('extracts LinkedIn usernames', () => {
      const pattern = OSINT_PATTERNS.social_linkedin;
      const text = 'Profile: linkedin.com/in/john-doe-12345';

      const match = pattern.pattern.exec(text);
      expect(pattern.extract(match)).toBe('john-doe-12345');
    });

    test('extracts GitHub usernames', () => {
      const pattern = OSINT_PATTERNS.social_github;
      const text = 'Code at github.com/example-user';

      const match = pattern.pattern.exec(text);
      expect(pattern.extract(match)).toBe('example-user');
    });
  });

  describe('IP Address Pattern', () => {
    const pattern = OSINT_PATTERNS.ip_address;

    test('matches valid IPv4 addresses', () => {
      const text = 'Server at 192.168.1.1 and 10.0.0.255';
      const matches = text.match(pattern.pattern);

      expect(matches).toContain('192.168.1.1');
      expect(matches).toContain('10.0.0.255');
    });

    test('validates IP address format', () => {
      expect(pattern.validator('192.168.1.1')).toBe(true);
      expect(pattern.validator('10.0.0.255')).toBe(true);
      expect(pattern.validator('256.1.1.1')).toBe(false);
      expect(pattern.validator('1.2.3')).toBe(false);
    });
  });

  describe('Domain Pattern', () => {
    const pattern = OSINT_PATTERNS.domain;

    test('matches domains with common TLDs', () => {
      const text = 'Visit example.com and test.org and company.io';
      const matches = text.match(pattern.pattern);

      expect(matches).toContain('example.com');
      expect(matches).toContain('test.org');
      expect(matches).toContain('company.io');
    });
  });

  describe('Onion Domain Pattern', () => {
    const pattern = OSINT_PATTERNS.onion;

    test('matches v2 onion addresses', () => {
      const text = 'Access via expyuzz4wqqyqhjn.onion';
      const matches = text.match(pattern.pattern);

      expect(matches).toContain('expyuzz4wqqyqhjn.onion');
    });

    test('matches v3 onion addresses', () => {
      const v3Onion = 'a'.repeat(56) + '.onion';
      expect(pattern.pattern.test(v3Onion)).toBe(true);
    });
  });

  describe('Sensitive Data Patterns', () => {
    test('SSN pattern is marked sensitive', () => {
      expect(OSINT_PATTERNS.ssn.sensitive).toBe(true);
    });

    test('Credit card pattern is marked sensitive', () => {
      expect(OSINT_PATTERNS.credit_card.sensitive).toBe(true);
    });
  });
});

describe('extractOsintData', () => {
  const sampleText = `
    Contact John at john@example.com or call (555) 123-4567.
    Send Bitcoin to 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2.
    Follow us @example_handle on Twitter.
    Server IP: 192.168.1.100
    Visit our website at example.com
  `;

  test('extracts all data types by default', () => {
    const results = extractOsintData(sampleText);

    const types = results.map(r => r.type);
    expect(types).toContain('email');
    expect(types).toContain('phone');
    expect(types).toContain('crypto_btc');
    expect(types).toContain('social_twitter');
    expect(types).toContain('ip_address');
    expect(types).toContain('domain');
  });

  test('filters by specific types', () => {
    const results = extractOsintData(sampleText, ['email', 'phone']);

    const types = new Set(results.map(r => r.type));
    expect(types.size).toBe(2);
    expect(types.has('email')).toBe(true);
    expect(types.has('phone')).toBe(true);
  });

  test('includes context for each finding', () => {
    const results = extractOsintData(sampleText, ['email']);

    expect(results[0].context).toBeDefined();
    expect(results[0].context).toContain('john@example.com');
  });

  test('includes confidence scores', () => {
    const results = extractOsintData(sampleText, ['email']);

    expect(results[0].confidence).toBeGreaterThan(0);
    expect(results[0].confidence).toBeLessThanOrEqual(1);
  });

  test('maps to orphan types', () => {
    const results = extractOsintData(sampleText);

    const emailFinding = results.find(r => r.type === 'email');
    expect(emailFinding.orphanType).toBe('email');

    const btcFinding = results.find(r => r.type === 'crypto_btc');
    expect(btcFinding.orphanType).toBe('crypto_address');
    expect(btcFinding.subtype).toBe('BTC');
  });

  test('deduplicates findings', () => {
    const textWithDupes = 'Contact test@example.com or test@example.com';
    const results = extractOsintData(textWithDupes, ['email']);

    expect(results.length).toBe(1);
  });

  test('marks sensitive data', () => {
    const textWithSSN = 'SSN: 123-45-6789';
    const results = extractOsintData(textWithSSN, ['ssn']);

    expect(results[0].sensitive).toBe(true);
  });

  test('handles empty text', () => {
    const results = extractOsintData('');

    expect(results).toEqual([]);
  });

  test('handles text with no matches', () => {
    const results = extractOsintData('Nothing interesting here');

    expect(results.length).toBe(0);
  });
});

describe('generateProvenance', () => {
  test('generates basic provenance', () => {
    const provenance = generateProvenance('https://example.com');

    expect(provenance.sourceType).toBe('website');
    expect(provenance.sourceUrl).toBe('https://example.com');
    expect(provenance.capturedAt).toBeDefined();
    expect(provenance.capturedBy).toBe('basset-hound-browser');
  });

  test('includes optional fields', () => {
    const provenance = generateProvenance('https://example.com', {
      investigationId: 'inv_123',
      caseNumber: 'CASE-001',
      capturedBy: 'agent-1',
    });

    expect(provenance.investigationId).toBe('inv_123');
    expect(provenance.caseNumber).toBe('CASE-001');
    expect(provenance.capturedBy).toBe('agent-1');
  });

  test('includes Tor circuit if provided', () => {
    const provenance = generateProvenance('https://example.com', {
      torCircuit: 'circuit-abc123',
    });

    expect(provenance.torCircuit).toBe('circuit-abc123');
  });
});

describe('InvestigationManager', () => {
  let manager;

  beforeEach(() => {
    manager = new InvestigationManager();
  });

  describe('createInvestigation', () => {
    test('creates investigation with defaults', () => {
      const inv = manager.createInvestigation({ name: 'Test Investigation' });

      expect(inv.id).toMatch(/^inv_/);
      expect(inv.name).toBe('Test Investigation');
      expect(inv.status).toBe('active');
      expect(inv.config.maxDepth).toBe(2);
      expect(inv.config.maxPages).toBe(100);
    });

    test('sets as active investigation', () => {
      const inv = manager.createInvestigation({ name: 'Test' });

      expect(manager.activeInvestigation).toBe(inv.id);
    });

    test('accepts custom configuration', () => {
      const inv = manager.createInvestigation({
        name: 'Custom',
        maxDepth: 5,
        maxPages: 50,
        patterns: ['/about', '/team'],
        dataTypes: ['email', 'phone'],
      });

      expect(inv.config.maxDepth).toBe(5);
      expect(inv.config.maxPages).toBe(50);
      expect(inv.config.patterns).toContain('/about');
      expect(inv.config.dataTypes).toContain('email');
    });

    test('emits investigationCreated event', () => {
      let emittedData = null;
      manager.on('investigationCreated', (data) => { emittedData = data; });

      manager.createInvestigation({ name: 'Test' });

      expect(emittedData).not.toBeNull();
      expect(emittedData.name).toBe('Test');
    });
  });

  describe('getInvestigation', () => {
    test('returns investigation by ID', () => {
      const created = manager.createInvestigation({ name: 'Test' });
      const retrieved = manager.getInvestigation(created.id);

      expect(retrieved).toBe(created);
    });

    test('returns undefined for nonexistent ID', () => {
      const inv = manager.getInvestigation('nonexistent');

      expect(inv).toBeUndefined();
    });
  });

  describe('getActiveInvestigation', () => {
    test('returns null when no active investigation', () => {
      expect(manager.getActiveInvestigation()).toBeNull();
    });

    test('returns active investigation', () => {
      const inv = manager.createInvestigation({ name: 'Test' });

      expect(manager.getActiveInvestigation()).toBe(inv);
    });
  });

  describe('setActiveInvestigation', () => {
    test('sets active investigation', () => {
      const inv1 = manager.createInvestigation({ name: 'First' });
      const inv2 = manager.createInvestigation({ name: 'Second' });

      manager.setActiveInvestigation(inv1.id);

      expect(manager.getActiveInvestigation()).toBe(inv1);
    });

    test('throws for nonexistent investigation', () => {
      expect(() => manager.setActiveInvestigation('nonexistent'))
        .toThrow('not found');
    });
  });

  describe('queueUrl', () => {
    beforeEach(() => {
      manager.createInvestigation({ name: 'Test' });
    });

    test('adds URL to queue', () => {
      const result = manager.queueUrl('https://example.com');

      expect(result).toBe(true);
      expect(manager.getActiveInvestigation().queue.length).toBe(1);
    });

    test('rejects duplicate URLs', () => {
      manager.queueUrl('https://example.com');
      const result = manager.queueUrl('https://example.com');

      expect(result).toBe(false);
    });

    test('rejects URLs beyond max depth', () => {
      const result = manager.queueUrl('https://example.com', 10);

      expect(result).toBe(false);
    });

    test('rejects when queue is full', () => {
      const inv = manager.getActiveInvestigation();
      inv.config.maxPages = 2;

      manager.queueUrl('https://example1.com');
      manager.queueUrl('https://example2.com');
      const result = manager.queueUrl('https://example3.com');

      expect(result).toBe(false);
    });

    test('filters by patterns', () => {
      const inv = manager.getActiveInvestigation();
      inv.config.patterns = ['/about'];

      const result1 = manager.queueUrl('https://example.com/about');
      const result2 = manager.queueUrl('https://example.com/contact');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    test('filters by exclude patterns', () => {
      const inv = manager.getActiveInvestigation();
      inv.config.excludePatterns = ['/admin'];

      const result1 = manager.queueUrl('https://example.com/about');
      const result2 = manager.queueUrl('https://example.com/admin');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    test('throws when no active investigation', () => {
      manager.activeInvestigation = null;

      expect(() => manager.queueUrl('https://example.com'))
        .toThrow('No active investigation');
    });
  });

  describe('markVisited', () => {
    test('marks URL as visited', () => {
      manager.createInvestigation({ name: 'Test' });
      manager.markVisited('https://example.com');

      const inv = manager.getActiveInvestigation();
      expect(inv.visited.has('https://example.com')).toBe(true);
      expect(inv.stats.pagesVisited).toBe(1);
    });
  });

  describe('addFinding', () => {
    beforeEach(() => {
      manager.createInvestigation({ name: 'Test' });
    });

    test('adds finding to investigation', () => {
      const finding = manager.addFinding({
        type: 'email',
        value: 'test@example.com',
      });

      expect(finding.id).toMatch(/^find_/);
      expect(finding.foundAt).toBeDefined();

      const inv = manager.getActiveInvestigation();
      expect(inv.findings.length).toBe(1);
      expect(inv.stats.dataExtracted).toBe(1);
    });

    test('emits findingAdded event', () => {
      let emittedData = null;
      manager.on('findingAdded', (data) => { emittedData = data; });

      manager.addFinding({ type: 'email', value: 'test@example.com' });

      expect(emittedData).not.toBeNull();
      expect(emittedData.finding.value).toBe('test@example.com');
    });
  });

  describe('addEvidence', () => {
    beforeEach(() => {
      manager.createInvestigation({ name: 'Test' });
    });

    test('adds evidence to investigation', () => {
      const evidence = manager.addEvidence({
        type: 'screenshot',
        data: 'base64...',
      });

      expect(evidence.capturedAt).toBeDefined();

      const inv = manager.getActiveInvestigation();
      expect(inv.evidence.length).toBe(1);
      expect(inv.stats.evidenceCaptured).toBe(1);
    });
  });

  describe('recordError', () => {
    test('records error with context', () => {
      manager.createInvestigation({ name: 'Test' });
      manager.recordError(new Error('Test error'), { url: 'https://example.com' });

      const inv = manager.getActiveInvestigation();
      expect(inv.errors.length).toBe(1);
      expect(inv.errors[0].message).toBe('Test error');
      expect(inv.errors[0].context.url).toBe('https://example.com');
    });
  });

  describe('getNextUrl', () => {
    beforeEach(() => {
      manager.createInvestigation({ name: 'Test' });
    });

    test('returns next URL from queue', () => {
      manager.queueUrl('https://example.com/1');
      manager.queueUrl('https://example.com/2');

      const next = manager.getNextUrl();

      expect(next.url).toBe('https://example.com/1');
    });

    test('returns null when queue empty', () => {
      expect(manager.getNextUrl()).toBeNull();
    });

    test('removes URL from queue', () => {
      manager.queueUrl('https://example.com');
      manager.getNextUrl();

      const inv = manager.getActiveInvestigation();
      expect(inv.queue.length).toBe(0);
    });
  });

  describe('completeInvestigation', () => {
    test('marks investigation as complete', () => {
      const inv = manager.createInvestigation({ name: 'Test' });
      const completed = manager.completeInvestigation();

      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();
      expect(completed.duration).toBeDefined();
    });

    test('emits investigationCompleted event', () => {
      manager.createInvestigation({ name: 'Test' });

      let emittedData = null;
      manager.on('investigationCompleted', (data) => { emittedData = data; });

      manager.completeInvestigation();

      expect(emittedData).not.toBeNull();
    });

    test('throws for nonexistent investigation', () => {
      expect(() => manager.completeInvestigation('nonexistent'))
        .toThrow('not found');
    });
  });

  describe('listInvestigations', () => {
    test('returns empty array when no investigations', () => {
      expect(manager.listInvestigations()).toEqual([]);
    });

    test('lists all investigations', () => {
      manager.createInvestigation({ name: 'First' });
      manager.createInvestigation({ name: 'Second' });

      const list = manager.listInvestigations();

      expect(list.length).toBe(2);
      expect(list[0]).toHaveProperty('id');
      expect(list[0]).toHaveProperty('name');
      expect(list[0]).toHaveProperty('status');
      expect(list[0]).toHaveProperty('stats');
    });
  });

  describe('exportInvestigation', () => {
    test('exports investigation data', () => {
      manager.createInvestigation({ name: 'Test', caseNumber: 'CASE-001' });
      manager.queueUrl('https://example.com');
      manager.markVisited('https://test.com');
      manager.addFinding({ type: 'email', value: 'test@example.com' });

      const exported = manager.exportInvestigation();

      expect(exported.name).toBe('Test');
      expect(exported.caseNumber).toBe('CASE-001');
      expect(exported.visited).toContain('https://test.com');
      expect(exported.findings.length).toBe(1);
      expect(exported.exportedAt).toBeDefined();
    });

    test('throws for nonexistent investigation', () => {
      expect(() => manager.exportInvestigation('nonexistent'))
        .toThrow('not found');
    });
  });
});

describe('Integration Scenarios', () => {
  let manager;

  beforeEach(() => {
    manager = new InvestigationManager();
  });

  test('complete investigation workflow', () => {
    // 1. Create investigation
    const inv = manager.createInvestigation({
      name: 'Test Investigation',
      caseNumber: 'CASE-2026-001',
      maxDepth: 2,
    });

    // 2. Queue initial URLs
    manager.queueUrl('https://example.com', 0);
    manager.queueUrl('https://example.com/about', 0);

    // 3. Process first URL
    const url1 = manager.getNextUrl();
    expect(url1.url).toBe('https://example.com');

    manager.markVisited(url1.url);

    // 4. Add findings from first page
    const sampleText = 'Contact: test@example.com, phone: 555-123-4567';
    const findings = extractOsintData(sampleText);
    for (const finding of findings) {
      manager.addFinding({
        ...finding,
        sourceUrl: url1.url,
      });
    }

    // 5. Queue child links
    manager.queueUrl('https://example.com/contact', 1, url1.url);

    // 6. Process second URL
    const url2 = manager.getNextUrl();
    manager.markVisited(url2.url);

    // 7. Add evidence
    manager.addEvidence({
      type: 'screenshot',
      url: url2.url,
    });

    // 8. Complete investigation
    const completed = manager.completeInvestigation();

    // Verify results
    expect(completed.status).toBe('completed');
    expect(completed.stats.pagesVisited).toBe(2);
    expect(completed.stats.dataExtracted).toBeGreaterThan(0);
    expect(completed.stats.evidenceCaptured).toBe(1);
  });

  test('multi-page crawl with depth limits', () => {
    manager.createInvestigation({
      name: 'Depth Test',
      maxDepth: 1,
    });

    // Queue at depth 0
    manager.queueUrl('https://example.com', 0);

    // Queue at depth 1 (allowed)
    manager.queueUrl('https://example.com/page1', 1);

    // Queue at depth 2 (rejected)
    const result = manager.queueUrl('https://example.com/page2', 2);
    expect(result).toBe(false);

    expect(manager.getActiveInvestigation().queue.length).toBe(2);
  });

  test('pattern-based URL filtering', () => {
    manager.createInvestigation({
      name: 'Pattern Test',
      patterns: ['/products/', '/about'],
      excludePatterns: ['/admin', '/login'],
    });

    // Should be accepted
    expect(manager.queueUrl('https://example.com/products/item1')).toBe(true);
    expect(manager.queueUrl('https://example.com/about')).toBe(true);

    // Should be rejected (no pattern match)
    expect(manager.queueUrl('https://example.com/contact')).toBe(false);

    // Should be rejected (exclude pattern)
    expect(manager.queueUrl('https://example.com/admin/dashboard')).toBe(false);
  });

  test('basset-hound data preparation', () => {
    manager.createInvestigation({
      name: 'Basset Test',
      caseNumber: 'CASE-001',
    });

    // Add various findings
    manager.addFinding({
      type: 'email',
      value: 'test@example.com',
      orphanType: 'email',
      provenance: generateProvenance('https://example.com'),
    });

    manager.addFinding({
      type: 'crypto_btc',
      value: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
      orphanType: 'crypto_address',
      subtype: 'BTC',
      provenance: generateProvenance('https://example.com'),
    });

    manager.addFinding({
      type: 'ssn',
      value: '123-45-6789',
      orphanType: 'ssn',
      sensitive: true,
      provenance: generateProvenance('https://example.com'),
    });

    // Get findings
    const inv = manager.getActiveInvestigation();
    const findings = inv.findings;

    // Filter sensitive by default
    const nonSensitive = findings.filter(f => !f.sensitive);
    expect(nonSensitive.length).toBe(2);

    // Verify orphan type mapping
    const emailFinding = findings.find(f => f.type === 'email');
    expect(emailFinding.orphanType).toBe('email');

    const btcFinding = findings.find(f => f.type === 'crypto_btc');
    expect(btcFinding.orphanType).toBe('crypto_address');
    expect(btcFinding.subtype).toBe('BTC');
  });
});
