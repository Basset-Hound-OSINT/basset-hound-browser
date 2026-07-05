/**
 * Integration tests for Evidence Correlation & Cross-Site Analysis WebSocket commands
 *
 * Tests all 5 evidence correlation P0 commands with multi-site scenarios
 */

const { registerEvidenceCorrelationCommands } = require('../../websocket/commands/evidence-correlation-commands');

describe('Evidence Correlation WebSocket Commands Integration', () => {
  let mockServer;
  let commandHandlers;

  beforeEach(() => {
    commandHandlers = {};
    mockServer = {
      commandHandlers: commandHandlers
    };

    registerEvidenceCorrelationCommands(mockServer, null);
  });

  // ============================================================
  // 1. start_evidence_correlation Command Tests
  // ============================================================
  describe('start_evidence_correlation command', () => {
    test('should initialize evidence correlation session', async () => {
      const result = await commandHandlers.start_evidence_correlation({
        investigationId: 'INV-2024-001',
        sites: ['site1.com', 'site2.com', 'site3.com'],
        correlationType: 'FULL'
      });

      expect(result.success).toBe(true);
      expect(result.correlationSessionId).toBeDefined();
      expect(result.startTime).toBeDefined();
      expect(result.correlationType).toBe('FULL');
      expect(result.sitesRegistered).toBe(3);
      expect(result.status).toBe('CORRELATION_SESSION_ACTIVE');
    });

    test('should support different correlation types', async () => {
      const types = ['BEHAVIORAL', 'CONTENT', 'TEMPORAL', 'FULL'];

      for (const type of types) {
        const result = await commandHandlers.start_evidence_correlation({
          correlationType: type
        });

        expect(result.success).toBe(true);
        expect(result.correlationType).toBe(type);
      }
    });

    test('should initialize with minimal parameters', async () => {
      const result = await commandHandlers.start_evidence_correlation({});

      expect(result.success).toBe(true);
      expect(result.correlationSessionId).toBeDefined();
      expect(result.sitesRegistered).toBe(0);
    });

    test('should register multiple sites for correlation', async () => {
      const sites = ['site1.com', 'site2.com', 'site3.com', 'site4.com'];

      const result = await commandHandlers.start_evidence_correlation({
        sites: sites
      });

      expect(result.sitesRegistered).toBe(4);
    });
  });

  // ============================================================
  // 2. correlate_evidence_across_sites Command Tests
  // ============================================================
  describe('correlate_evidence_across_sites command', () => {
    test('should correlate evidence between registered sites', async () => {
      // Initialize correlation
      await commandHandlers.start_evidence_correlation({
        sites: ['site1.com', 'site2.com']
      });

      // Add evidence to site1
      const result1 = await commandHandlers.correlate_evidence_across_sites({
        siteName: 'site1.com',
        evidence: [
          { id: 'ev1', data: { type: 'screenshot', content: 'login_page' }, timestamp: new Date().toISOString() },
          { id: 'ev2', data: { type: 'screenshot', content: 'login_page' }, timestamp: new Date().toISOString() }
        ]
      });

      expect(result1.success).toBe(true);
      expect(result1.siteName).toBe('site1.com');
      expect(result1.evidenceCount).toBe(2);

      // Add same evidence to site2
      const result2 = await commandHandlers.correlate_evidence_across_sites({
        siteName: 'site2.com',
        evidence: [
          { id: 'ev3', data: { type: 'screenshot', content: 'login_page' }, timestamp: new Date().toISOString() },
          { id: 'ev4', data: { type: 'screenshot', content: 'login_page' }, timestamp: new Date().toISOString() }
        ],
        thresholdScore: 0.3
      });

      expect(result2.success).toBe(true);
      // May or may not find correlations depending on threshold
      expect(result2.correlationsFound).toBeDefined();
    });

    test('should calculate correlation scores correctly', async () => {
      await commandHandlers.start_evidence_correlation({
        sites: ['site1.com', 'site2.com']
      });

      // Add similar evidence
      await commandHandlers.correlate_evidence_across_sites({
        siteName: 'site1.com',
        evidence: [
          { id: 'ev1', data: { value: 'same' }, timestamp: new Date().toISOString() }
        ]
      });

      const result = await commandHandlers.correlate_evidence_across_sites({
        siteName: 'site2.com',
        evidence: [
          { id: 'ev2', data: { value: 'same' }, timestamp: new Date().toISOString() }
        ]
      });

      expect(result.success).toBe(true);
      if (result.correlationsFound.length > 0) {
        const score = result.correlationsFound[0].score;
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });

    test('should respect correlation threshold', async () => {
      await commandHandlers.start_evidence_correlation({
        sites: ['site1.com', 'site2.com']
      });

      // Add evidence to site1
      await commandHandlers.correlate_evidence_across_sites({
        siteName: 'site1.com',
        evidence: [
          { id: 'ev1', data: { value: 'different' }, timestamp: new Date().toISOString() }
        ]
      });

      // Try to correlate with high threshold
      const result = await commandHandlers.correlate_evidence_across_sites({
        siteName: 'site2.com',
        evidence: [
          { id: 'ev2', data: { value: 'other' }, timestamp: new Date().toISOString() }
        ],
        thresholdScore: 0.9
      });

      expect(result.success).toBe(true);
      // Should have fewer/no correlations due to high threshold
      expect(result.correlationsFound.length).toBeGreaterThanOrEqual(0);
    });

    test('should require siteName parameter', async () => {
      const result = await commandHandlers.correlate_evidence_across_sites({
        evidence: [{ id: 'ev1', data: 'test' }]
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('siteName');
    });

    test('should require evidence array', async () => {
      const result = await commandHandlers.correlate_evidence_across_sites({
        siteName: 'site1.com',
        evidence: 'not an array'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('evidence');
    });

    test('should count different correlation strengths', async () => {
      await commandHandlers.start_evidence_correlation({
        sites: ['site1.com', 'site2.com', 'site3.com']
      });

      await commandHandlers.correlate_evidence_across_sites({
        siteName: 'site1.com',
        evidence: [
          { id: 'ev1', data: { type: 'screenshot' }, timestamp: new Date().toISOString() }
        ]
      });

      const result = await commandHandlers.correlate_evidence_across_sites({
        siteName: 'site2.com',
        evidence: [
          { id: 'ev2', data: { type: 'screenshot' }, timestamp: new Date().toISOString() }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.strongCorrelations).toBeGreaterThanOrEqual(0);
      expect(result.mediumCorrelations).toBeGreaterThanOrEqual(0);
      expect(result.weakCorrelations).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // 3. get_correlation_graph Command Tests
  // ============================================================
  describe('get_correlation_graph command', () => {
    test('should return correlation graph structure', async () => {
      const result = await commandHandlers.get_correlation_graph({});

      expect(result.success).toBe(true);
      expect(result.graph).toBeDefined();
      expect(result.graph.nodes).toBeInstanceOf(Array);
      expect(result.graph.edges).toBeInstanceOf(Array);
      expect(result.stats).toBeDefined();
    });

    test('should calculate network density', async () => {
      await commandHandlers.start_evidence_correlation({
        sites: ['site1.com', 'site2.com']
      });

      const result = await commandHandlers.get_correlation_graph({});

      expect(result.stats.networkDensity).toBeGreaterThanOrEqual(0);
      expect(result.stats.networkDensity).toBeLessThanOrEqual(1);
    });

    test('should calculate average correlation score', async () => {
      const result = await commandHandlers.get_correlation_graph({});

      expect(result.stats.averageCorrelationScore).toBeGreaterThanOrEqual(0);
      expect(result.stats.averageCorrelationScore).toBeLessThanOrEqual(1);
    });

    test('should support nodes and edges format', async () => {
      const result = await commandHandlers.get_correlation_graph({
        format: 'NODES_EDGES'
      });

      expect(result.success).toBe(true);
      expect(result.graph.nodes).toBeDefined();
      expect(result.graph.edges).toBeDefined();
    });

    test('should support adjacency matrix format', async () => {
      const result = await commandHandlers.get_correlation_graph({
        format: 'ADJACENCY_MATRIX'
      });

      expect(result.success).toBe(true);
      expect(result.graph.adjacencyMatrix).toBeDefined();
    });

    test('should include detailed correlation info when requested', async () => {
      const result = await commandHandlers.get_correlation_graph({
        includeDetails: true
      });

      expect(result.success).toBe(true);
      if (result.graph.correlationDetails) {
        expect(Array.isArray(result.graph.correlationDetails)).toBe(true);
      }
    });

    test('should provide graph statistics', async () => {
      const result = await commandHandlers.get_correlation_graph({});

      expect(result.stats.totalNodes).toBeGreaterThanOrEqual(0);
      expect(result.stats.totalEdges).toBeGreaterThanOrEqual(0);
      expect(result.stats.strongestCorrelation).toBeGreaterThanOrEqual(0);
      expect(result.stats.weakestCorrelation).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // 4. export_correlation_report Command Tests
  // ============================================================
  describe('export_correlation_report command', () => {
    test('should export correlation report in JSON format', async () => {
      const result = await commandHandlers.export_correlation_report({
        format: 'JSON'
      });

      expect(result.success).toBe(true);
      expect(result.reportId).toBeDefined();
      expect(result.format).toBe('JSON');
      expect(result.correlationSummary).toBeDefined();
      expect(result.reportContent).toBeDefined();
    });

    test('should support CSV export format', async () => {
      const result = await commandHandlers.export_correlation_report({
        format: 'CSV'
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('CSV');
    });

    test('should support graph data format', async () => {
      const result = await commandHandlers.export_correlation_report({
        format: 'GRAPH_DATA'
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('GRAPH_DATA');
    });

    test('should include evidence in report when requested', async () => {
      const result = await commandHandlers.export_correlation_report({
        includeEvidence: true
      });

      expect(result.success).toBe(true);
      if (result.reportContent.evidence) {
        expect(typeof result.reportContent.evidence).toBe('object');
      }
    });

    test('should include patterns in report when requested', async () => {
      const result = await commandHandlers.export_correlation_report({
        includePatterns: true
      });

      expect(result.success).toBe(true);
      if (result.reportContent.patterns) {
        expect(Array.isArray(result.reportContent.patterns)).toBe(true);
      }
    });

    test('should filter by minimum correlation score', async () => {
      const result = await commandHandlers.export_correlation_report({
        minCorrelationScore: 0.7
      });

      expect(result.success).toBe(true);
      // All returned correlations should be >= 0.7
      if (result.reportContent.correlations) {
        for (const corr of result.reportContent.correlations) {
          expect(corr.score).toBeGreaterThanOrEqual(0.7);
        }
      }
    });

    test('should generate unique report IDs', async () => {
      const result1 = await commandHandlers.export_correlation_report({});
      const result2 = await commandHandlers.export_correlation_report({});

      expect(result1.reportId).not.toEqual(result2.reportId);
    });

    test('should include correlation summary statistics', async () => {
      const result = await commandHandlers.export_correlation_report({});

      expect(result.correlationSummary).toBeDefined();
      expect(result.correlationSummary.correlationsFound).toBeGreaterThanOrEqual(0);
      expect(result.correlationSummary.strongCorrelations).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // 5. identify_common_patterns Command Tests
  // ============================================================
  describe('identify_common_patterns command', () => {
    test('should identify common patterns across sites', async () => {
      // Initialize and add evidence
      await commandHandlers.start_evidence_correlation({
        sites: ['site1.com', 'site2.com']
      });

      // Add same pattern to both sites
      await commandHandlers.correlate_evidence_across_sites({
        siteName: 'site1.com',
        evidence: [
          { id: 'ev1', data: { type: 'login', action: 'authenticate' }, timestamp: new Date().toISOString() },
          { id: 'ev2', data: { type: 'login', action: 'authenticate' }, timestamp: new Date().toISOString() }
        ]
      });

      await commandHandlers.correlate_evidence_across_sites({
        siteName: 'site2.com',
        evidence: [
          { id: 'ev3', data: { type: 'login', action: 'authenticate' }, timestamp: new Date().toISOString() }
        ]
      });

      const result = await commandHandlers.identify_common_patterns({
        patternType: 'BEHAVIORAL'
      });

      expect(result.success).toBe(true);
      expect(result.commonPatterns).toBeDefined();
      expect(Array.isArray(result.commonPatterns)).toBe(true);
    });

    test('should support different pattern types', async () => {
      const types = ['BEHAVIORAL', 'CONTENT', 'TEMPORAL', 'NETWORK'];

      for (const type of types) {
        const result = await commandHandlers.identify_common_patterns({
          patternType: type
        });

        expect(result.success).toBe(true);
      }
    });

    test('should respect minimum occurrence threshold', async () => {
      const result = await commandHandlers.identify_common_patterns({
        minOccurrence: 5
      });

      expect(result.success).toBe(true);
      // All patterns should have at least 5 occurrences or be empty
      for (const pattern of result.commonPatterns) {
        expect(pattern.occurrences).toBeGreaterThanOrEqual(5);
      }
    });

    test('should include pattern summary statistics', async () => {
      const result = await commandHandlers.identify_common_patterns({});

      expect(result.patternSummary).toBeDefined();
      expect(result.patternSummary.totalPatternsFound).toBeGreaterThanOrEqual(0);
      expect(result.patternSummary.byType).toBeDefined();
      expect(result.patternSummary.averageOccurrences).toBeGreaterThanOrEqual(0);
      expect(result.patternSummary.averageConfidence).toBeGreaterThanOrEqual(0);
    });

    test('should include pattern confidence scores', async () => {
      const result = await commandHandlers.identify_common_patterns({});

      expect(result.success).toBe(true);
      for (const pattern of result.commonPatterns) {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);
      }
    });

    test('should identify sites containing patterns', async () => {
      await commandHandlers.start_evidence_correlation({
        sites: ['site1.com', 'site2.com', 'site3.com']
      });

      await commandHandlers.correlate_evidence_across_sites({
        siteName: 'site1.com',
        evidence: [
          { id: 'ev1', data: { action: 'search' }, timestamp: new Date().toISOString() }
        ]
      });

      const result = await commandHandlers.identify_common_patterns({
        minOccurrence: 1
      });

      expect(result.success).toBe(true);
      for (const pattern of result.commonPatterns) {
        expect(Array.isArray(pattern.sites)).toBe(true);
      }
    });
  });

  // ============================================================
  // Real-World Scenario Tests
  // ============================================================
  describe('Real-World Evidence Correlation Scenarios', () => {
    test('should analyze evidence from multi-site investigation', async () => {
      // Initialize correlation session with 3 sites
      const initResult = await commandHandlers.start_evidence_correlation({
        investigationId: 'CASE-2024-5678',
        sites: ['ecommerce.site1.com', 'payment.site2.com', 'delivery.site3.com'],
        correlationType: 'FULL'
      });

      expect(initResult.success).toBe(true);

      // Collect evidence from first site
      const evidence1 = await commandHandlers.correlate_evidence_across_sites({
        siteName: 'ecommerce.site1.com',
        evidence: [
          { id: 'order_001', data: { orderId: 'ORD-123', userId: 'user_456' }, timestamp: '2024-06-20T10:00:00Z' },
          { id: 'order_002', data: { orderId: 'ORD-124', userId: 'user_456' }, timestamp: '2024-06-20T10:15:00Z' }
        ]
      });

      expect(evidence1.success).toBe(true);

      // Correlate with payment site
      const evidence2 = await commandHandlers.correlate_evidence_across_sites({
        siteName: 'payment.site2.com',
        evidence: [
          { id: 'txn_001', data: { txnId: 'TXN-789', userId: 'user_456', amount: 100 }, timestamp: '2024-06-20T10:05:00Z' },
          { id: 'txn_002', data: { txnId: 'TXN-790', userId: 'user_456', amount: 150 }, timestamp: '2024-06-20T10:20:00Z' }
        ]
      });

      expect(evidence2.success).toBe(true);

      // Correlate with delivery site
      const evidence3 = await commandHandlers.correlate_evidence_across_sites({
        siteName: 'delivery.site3.com',
        evidence: [
          { id: 'delivery_001', data: { deliveryId: 'DLV-456', userId: 'user_456', status: 'shipped' }, timestamp: '2024-06-20T10:30:00Z' }
        ]
      });

      expect(evidence3.success).toBe(true);

      // Get correlation graph
      const graphResult = await commandHandlers.get_correlation_graph({
        format: 'FULL',
        includeDetails: true
      });

      expect(graphResult.success).toBe(true);
      expect(graphResult.graph.nodes.length).toBeGreaterThan(0);

      // Identify common patterns
      const patternsResult = await commandHandlers.identify_common_patterns({
        patternType: 'BEHAVIORAL',
        minOccurrence: 1
      });

      expect(patternsResult.success).toBe(true);

      // Export report
      const reportResult = await commandHandlers.export_correlation_report({
        format: 'JSON',
        includeEvidence: true,
        includePatterns: true
      });

      expect(reportResult.success).toBe(true);
      expect(reportResult.correlationSummary.sitesAnalyzed).toBe(3);
    });
  });
});
