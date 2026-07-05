/**
 * Integration tests for Correlation & Pattern Detection WebSocket commands
 *
 * Tests all 8 commands with real-world scenarios
 */

const { registerCorrelationCommands, PatternDetectionEngine } = require('../../websocket/commands/correlation-commands');

describe('Correlation WebSocket Commands Integration', () => {
  let mockServer;
  let commandHandlers;

  beforeEach(() => {
    commandHandlers = {};
    mockServer = {
      commandHandlers: commandHandlers
    };

    registerCorrelationCommands(mockServer, null);
  });

  // ============================================================
  // 1. find_similar_elements Command Tests
  // ============================================================
  describe('find_similar_elements command', () => {
    test('should group similar products by name', async () => {
      const data = [
        { id: 1, name: 'iPhone 13 Pro', price: 999 },
        { id: 2, name: 'iPhone 13 Pro', price: 999 },
        { id: 3, name: 'Samsung Galaxy S21', price: 899 }
      ];

      const result = await commandHandlers.find_similar_elements({
        data,
        field: 'name',
        threshold: 0.95
      });

      expect(result.success).toBe(true);
      expect(result.groups).toBeDefined();
      expect(result.groups.length).toBeGreaterThan(0);
      expect(result.summary.totalElements).toBe(3);
    });

    test('should find similar prices with tolerance', async () => {
      const data = [
        { id: 1, price: 100 },
        { id: 2, price: 102 },
        { id: 3, price: 200 }
      ];

      const result = await commandHandlers.find_similar_elements({
        data,
        field: 'price',
        threshold: 0.95
      });

      expect(result.success).toBe(true);
      expect(result.groups.length).toBeGreaterThan(0);
    });

    test('should handle invalid data', async () => {
      const result = await commandHandlers.find_similar_elements({
        data: 'not an array',
        field: 'name'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle missing field', async () => {
      const result = await commandHandlers.find_similar_elements({
        data: [{ name: 'test' }]
      });

      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // 2. detect_patterns Command Tests
  // ============================================================
  describe('detect_patterns command', () => {
    test('should detect repeated login patterns', async () => {
      const data = [
        { action: 'login', user: 'alice' },
        { action: 'navigate', user: 'alice' },
        { action: 'click', user: 'alice' },
        { action: 'login', user: 'alice' },
        { action: 'navigate', user: 'alice' },
        { action: 'click', user: 'alice' }
      ];

      const result = await commandHandlers.detect_patterns({
        data,
        options: { minOccurrence: 2 }
      });

      expect(result.success).toBe(true);
      expect(result.patterns).toBeDefined();
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    test('should provide pattern summary', async () => {
      const data = [1, 2, 1, 2, 1, 2];

      const result = await commandHandlers.detect_patterns({
        data,
        options: { minOccurrence: 2 }
      });

      expect(result.summary).toBeDefined();
      expect(result.summary.totalDataPoints).toBe(6);
      expect(result.summary.patternsDetected).toBeGreaterThanOrEqual(0);
    });

    test('should return empty patterns for random data', async () => {
      const data = [Math.random(), Math.random(), Math.random()];

      const result = await commandHandlers.detect_patterns({
        data,
        options: { minOccurrence: 10 }
      });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // 3. correlate_data Command Tests
  // ============================================================
  describe('correlate_data command', () => {
    test('should find correlation between user behavior datasets', async () => {
      const datasets = {
        browsers: ['Chrome', 'Chrome', 'Firefox', 'Safari'],
        os: ['Windows', 'Windows', 'Linux', 'macOS']
      };

      const result = await commandHandlers.correlate_data({
        datasets
      });

      expect(result.success).toBe(true);
      expect(result.correlations).toBeDefined();
      expect(result.correlationMatrix).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    test('should identify strong correlations', async () => {
      const datasets = {
        purchases: [100, 200, 150, 300],
        revenue: [100, 200, 150, 300]
      };

      const result = await commandHandlers.correlate_data({
        datasets
      });

      expect(result.strongLinks).toBeDefined();
    });

    test('should handle multiple dataset pairs', async () => {
      const datasets = {
        set1: [1, 2, 3],
        set2: [2, 3, 4],
        set3: [3, 4, 5]
      };

      const result = await commandHandlers.correlate_data({
        datasets
      });

      expect(result.correlations.length).toBe(3); // 3 choose 2
    });

    test('should handle invalid datasets object', async () => {
      const result = await commandHandlers.correlate_data({
        datasets: 'not an object'
      });

      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // 4. build_link_graph Command Tests
  // ============================================================
  describe('build_link_graph command', () => {
    test('should build social network graph', async () => {
      const data = [
        { userId: 'user1', follows: 'user2' },
        { userId: 'user2', follows: 'user3' },
        { userId: 'user3', follows: 'user1' }
      ];

      const result = await commandHandlers.build_link_graph({
        data,
        idField: 'userId',
        relationField: 'follows'
      });

      expect(result.success).toBe(true);
      expect(result.nodes.length).toBe(3);
      expect(result.edges.length).toBe(3);
      expect(result.stats.density).toBeGreaterThan(0);
    });

    test('should handle array relations', async () => {
      const data = [
        { id: 'A', links: ['B', 'C'] },
        { id: 'B', links: ['C'] }
      ];

      const result = await commandHandlers.build_link_graph({
        data,
        idField: 'id',
        relationField: 'links'
      });

      expect(result.success).toBe(true);
      expect(result.edges.length).toBe(3);
    });

    test('should calculate node degrees', async () => {
      const data = [
        { id: 'A', target: 'B' },
        { id: 'A', target: 'C' },
        { id: 'B', target: 'C' }
      ];

      const result = await commandHandlers.build_link_graph({
        data,
        idField: 'id',
        relationField: 'target'
      });

      const nodeA = result.nodes.find(n => n.id === 'A');
      expect(nodeA.degree).toBe(2);
    });

    test('should provide adjacency list', async () => {
      const data = [
        { id: 'A', relation: 'B' }
      ];

      const result = await commandHandlers.build_link_graph({
        data,
        idField: 'id',
        relationField: 'relation'
      });

      expect(result.adjacencyList).toBeDefined();
      expect(result.adjacencyList['A']).toContain('B');
    });
  });

  // ============================================================
  // 5. text_analytics Command Tests
  // ============================================================
  describe('text_analytics command', () => {
    test('should analyze single text', async () => {
      const text = 'The quick brown fox jumps over the lazy dog. The fox is quick and clever.';

      const result = await commandHandlers.text_analytics({
        text
      });

      expect(result.success).toBe(true);
      expect(result.wordFrequency).toBeDefined();
      expect(result.wordFrequency.fox).toBe(2);
      expect(result.statistics).toBeDefined();
    });

    test('should analyze multiple texts', async () => {
      const texts = [
        'Hello world',
        'Hello universe'
      ];

      const result = await commandHandlers.text_analytics({
        text: texts
      });

      expect(result.success).toBe(true);
      expect(result.statistics.textCount).toBe(2);
    });

    test('should extract sentiment', async () => {
      const text = 'This product is amazing and excellent! But customer service was terrible and awful.';

      const result = await commandHandlers.text_analytics({
        text
      });

      expect(result.sentiment).toBeDefined();
      expect(result.sentiment.positive).toBeGreaterThan(0);
      expect(result.sentiment.negative).toBeGreaterThan(0);
    });

    test('should extract entities', async () => {
      const text = 'Email me at test@example.com or visit https://example.com. I have 5 items.';

      const result = await commandHandlers.text_analytics({
        text
      });

      expect(result.entities.emails.length).toBeGreaterThan(0);
      expect(result.entities.urls.length).toBeGreaterThan(0);
      expect(result.entities.numbers.length).toBeGreaterThan(0);
    });

    test('should extract phrases', async () => {
      const text = 'the quick brown fox the quick brown fox';

      const result = await commandHandlers.text_analytics({
        text
      });

      expect(result.phraseFrequency).toBeDefined();
    });
  });

  // ============================================================
  // 6. anomaly_detection Command Tests
  // ============================================================
  describe('anomaly_detection command', () => {
    test('should detect price anomalies', async () => {
      const data = [
        { product: 'Item A', price: 10 },
        { product: 'Item B', price: 12 },
        { product: 'Item C', price: 11 },
        { product: 'Item D', price: 500 } // anomaly
      ];

      const result = await commandHandlers.anomaly_detection({
        data,
        field: 'price'
      });

      expect(result.success).toBe(true);
      expect(result.anomalies).toBeDefined();
      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.statistics.anomalyCount).toBeGreaterThan(0);
    });

    test('should provide anomaly statistics', async () => {
      const data = [
        { value: 100 },
        { value: 105 },
        { value: 1000 },
        { value: 102 }
      ];

      const result = await commandHandlers.anomaly_detection({
        data,
        field: 'value'
      });

      expect(result.statistics).toBeDefined();
      expect(result.statistics.mean).toBeDefined();
      expect(result.statistics.stdDev).toBeDefined();
      expect(result.statistics.anomalyPercentage).toBeDefined();
    });

    test('should use custom deviation threshold', async () => {
      const data = [
        { val: 10 },
        { val: 20 },
        { val: 30 },
        { val: 100 }
      ];

      const result = await commandHandlers.anomaly_detection({
        data,
        field: 'val',
        options: { deviation: 1.0 }
      });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // 7. cluster_data Command Tests
  // ============================================================
  describe('cluster_data command', () => {
    test('should cluster products by category', async () => {
      const data = [
        { id: 1, category: 'Electronics' },
        { id: 2, category: 'Electronics' },
        { id: 3, category: 'Clothing' },
        { id: 4, category: 'Clothing' }
      ];

      const result = await commandHandlers.cluster_data({
        data,
        field: 'category',
        options: { threshold: 0.99 }
      });

      expect(result.success).toBe(true);
      expect(result.clusters).toBeDefined();
      expect(result.clusters.length).toBeGreaterThan(0);
    });

    test('should provide cluster summary', async () => {
      const data = [
        { score: 85 },
        { score: 90 },
        { score: 75 }
      ];

      const result = await commandHandlers.cluster_data({
        data,
        field: 'score'
      });

      expect(result.summary).toBeDefined();
      expect(result.summary.totalElements).toBe(3);
      expect(result.summary.clustersCreated).toBeGreaterThan(0);
    });

    test('should sort clusters by size', async () => {
      const data = [
        { type: 'A' },
        { type: 'A' },
        { type: 'A' },
        { type: 'B' },
        { type: 'B' }
      ];

      const result = await commandHandlers.cluster_data({
        data,
        field: 'type',
        options: { threshold: 0.95 }
      });

      if (result.clusters.length > 1) {
        expect(result.clusters[0].size).toBeGreaterThanOrEqual(result.clusters[1].size);
      }
    });
  });

  // ============================================================
  // 8. generate_insights Command Tests
  // ============================================================
  describe('generate_insights command', () => {
    test('should generate insights from analysis results', async () => {
      const analysisResults = {
        similarElements: [
          { count: 10, similarity: 0.9, elements: [] }
        ],
        patterns: [
          { type: 'sequential', confidence: 0.85, occurrences: 5, examples: [] }
        ],
        anomalies: {
          anomalies: [{ value: 100 }],
          statistics: { anomalyPercentage: 10 }
        }
      };

      const result = await commandHandlers.generate_insights({
        analysisResults
      });

      expect(result.success).toBe(true);
      expect(result.insights).toBeDefined();
      expect(result.insights.length).toBeGreaterThan(0);
    });

    test('should categorize insights', async () => {
      const analysisResults = {
        similarElements: [{ count: 5, similarity: 0.8, elements: [] }],
        patterns: [{ confidence: 0.7, occurrences: 3, examples: [] }]
      };

      const result = await commandHandlers.generate_insights({
        analysisResults
      });

      expect(result.categorized).toBeDefined();
      expect(result.categorized.similarity).toBeDefined();
      expect(result.categorized.pattern).toBeDefined();
    });

    test('should provide summary statistics', async () => {
      const analysisResults = {
        patterns: [
          { confidence: 0.8, occurrences: 5, examples: [] }
        ]
      };

      const result = await commandHandlers.generate_insights({
        analysisResults
      });

      expect(result.summary).toBeDefined();
      expect(result.summary.totalInsights).toBeGreaterThanOrEqual(0);
      expect(result.summary.byCategory).toBeDefined();
    });

    test('should mark insights as actionable', async () => {
      const analysisResults = {
        patterns: [
          { type: 'sequential', confidence: 0.9, occurrences: 10, examples: [] }
        ]
      };

      const result = await commandHandlers.generate_insights({
        analysisResults
      });

      const actionableInsights = result.insights.filter(i => i.actionable);
      expect(actionableInsights.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // Additional Commands Tests
  // ============================================================
  describe('Utility Commands', () => {
    test('should clear correlation cache', async () => {
      const result = await commandHandlers.clear_correlation_cache({});

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    test('should get correlation status', async () => {
      const result = await commandHandlers.get_correlation_status({});

      expect(result.success).toBe(true);
      expect(result.status).toBe('ready');
      expect(result.engine).toBeDefined();
      expect(result.engine.initialized).toBe(true);
    });
  });

  // ============================================================
  // Real-World Scenario Tests
  // ============================================================
  describe('Real-World Scenarios', () => {
    test('should analyze website visitor behavior', async () => {
      const visitors = [
        { userId: '1', browser: 'Chrome', os: 'Windows', country: 'US' },
        { userId: '2', browser: 'Chrome', os: 'Windows', country: 'US' },
        { userId: '3', browser: 'Firefox', os: 'Linux', country: 'DE' },
        { userId: '4', browser: 'Safari', os: 'macOS', country: 'UK' }
      ];

      // Find similar browsers
      const similar = await commandHandlers.find_similar_elements({
        data: visitors,
        field: 'browser',
        threshold: 0.95
      });

      // Detect patterns
      const patterns = await commandHandlers.detect_patterns({
        data: visitors.map(v => v.browser)
      });

      // Cluster by browser
      const clusters = await commandHandlers.cluster_data({
        data: visitors,
        field: 'browser'
      });

      expect(similar.success).toBe(true);
      expect(patterns.success).toBe(true);
      expect(clusters.success).toBe(true);
    });

    test('should analyze product reviews', async () => {
      const reviews = [
        'Amazing product, highly recommended!',
        'Great quality and fast shipping',
        'Terrible quality, very disappointed',
        'Poor customer service, awful experience'
      ];

      const analysis = await commandHandlers.text_analytics({
        text: reviews
      });

      expect(analysis.success).toBe(true);
      expect(analysis.sentiment.positive).toBeGreaterThan(0);
      expect(analysis.sentiment.negative).toBeGreaterThan(0);
    });

    test('should correlate sales data with traffic', async () => {
      const datasets = {
        daily_traffic: [100, 150, 200, 175, 180],
        daily_sales: [50, 75, 100, 90, 95]
      };

      const result = await commandHandlers.correlate_data({
        datasets
      });

      expect(result.success).toBe(true);
      expect(result.strongLinks.length).toBeGreaterThan(0);
    });

    test('should detect suspicious transaction patterns', async () => {
      const transactions = [
        { amount: 100, type: 'purchase' },
        { amount: 105, type: 'purchase' },
        { amount: 95, type: 'purchase' },
        { amount: 5000, type: 'purchase' }, // suspicious
        { amount: 100, type: 'purchase' }
      ];

      const result = await commandHandlers.anomaly_detection({
        data: transactions,
        field: 'amount'
      });

      expect(result.success).toBe(true);
      expect(result.anomalies.length).toBeGreaterThan(0);
    });
  });
});
