/**
 * Unit tests for Pattern Detection & Data Correlation Engine
 *
 * Tests all 8 analysis features with comprehensive coverage
 */

const PatternDetectionEngine = require('../../src/analysis/pattern-detection');

describe('PatternDetectionEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new PatternDetectionEngine();
  });

  afterEach(() => {
    engine.clearCache();
  });

  // ============================================================
  // 1. Find Similar Elements Tests
  // ============================================================
  describe('findSimilarElements', () => {
    test('should group identical elements', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ];

      const groups = engine.findSimilarElements(data, 'name', 1.0);

      expect(groups).toBeDefined();
      expect(groups.length).toBeGreaterThan(0);
      expect(groups.some(g => g.count === 2)).toBe(true);
    });

    test('should group similar strings', () => {
      const data = [
        { title: 'Hello World' },
        { title: 'Hello Wrld' },
        { title: 'Goodbye' }
      ];

      const groups = engine.findSimilarElements(data, 'title', 0.8);

      expect(groups.length).toBeGreaterThan(0);
      const helloGroup = groups.find(g => g.count >= 2);
      expect(helloGroup).toBeDefined();
    });

    test('should group similar numbers', () => {
      const data = [
        { value: 100 },
        { value: 105 },
        { value: 1000 }
      ];

      const groups = engine.findSimilarElements(data, 'value', 0.9);

      expect(groups.length).toBeGreaterThan(0);
    });

    test('should handle empty array', () => {
      const groups = engine.findSimilarElements([], 'name');
      expect(groups).toEqual([]);
    });

    test('should use default threshold', () => {
      const data = [
        { text: 'test' },
        { text: 'test' },
        { text: 'other' }
      ];

      const groups = engine.findSimilarElements(data, 'text');
      expect(groups).toBeDefined();
    });

    test('should extract nested field values', () => {
      const data = [
        { user: { name: 'Alice' } },
        { user: { name: 'Alice' } },
        { user: { name: 'Bob' } }
      ];

      const groups = engine.findSimilarElements(data, 'user.name', 1.0);

      expect(groups.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // 2. Detect Patterns Tests
  // ============================================================
  describe('detectPatterns', () => {
    test('should detect sequential patterns', () => {
      const data = [1, 2, 3, 1, 2, 3, 1, 2, 3, 4, 5];

      const patterns = engine.detectPatterns(data);

      expect(patterns).toBeDefined();
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);

      const pattern = patterns.find(p => p.type === 'sequential');
      expect(pattern).toBeDefined();
    });

    test('should detect structural patterns', () => {
      const data = [
        { a: 1, b: 2 },
        { a: 3, b: 4 },
        { a: 5, b: 6 },
        { x: 7, y: 8 }
      ];

      const patterns = engine.detectPatterns(data, { minOccurrence: 2 });

      expect(patterns).toBeDefined();
      const structural = patterns.find(p => p.type === 'structural');
      expect(structural).toBeDefined();
    });

    test('should filter patterns by minimum occurrence', () => {
      const data = [1, 2, 1, 2, 3, 4];

      const patterns = engine.detectPatterns(data, { minOccurrence: 5 });

      expect(patterns).toBeDefined();
    });

    test('should include examples in patterns', () => {
      const data = [1, 2, 3, 1, 2, 3, 4];

      const patterns = engine.detectPatterns(data);

      const pattern = patterns[0];
      expect(pattern.examples).toBeDefined();
      expect(Array.isArray(pattern.examples)).toBe(true);
    });

    test('should calculate confidence score', () => {
      const data = [1, 1, 1, 1, 2];

      const patterns = engine.detectPatterns(data);

      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach(p => {
        expect(p.confidence).toBeGreaterThanOrEqual(0);
        expect(p.confidence).toBeLessThanOrEqual(1);
      });
    });

    test('should handle empty array', () => {
      const patterns = engine.detectPatterns([]);
      expect(patterns).toEqual([]);
    });
  });

  // ============================================================
  // 3. Correlate Data Tests
  // ============================================================
  describe('correlateData', () => {
    test('should find common elements', () => {
      const datasets = {
        set1: [1, 2, 3],
        set2: [2, 3, 4]
      };

      const result = engine.correlateData(datasets);

      expect(result.correlations).toBeDefined();
      expect(result.correlations.length).toBeGreaterThan(0);
      expect(result.correlationMatrix).toBeDefined();
    });

    test('should identify strong correlations', () => {
      const datasets = {
        set1: [1, 2, 3, 4, 5],
        set2: [1, 2, 3, 4, 5]
      };

      const result = engine.correlateData(datasets);

      expect(result.strongLinks).toBeDefined();
      expect(result.strongLinks.length).toBeGreaterThan(0);
    });

    test('should identify weak correlations', () => {
      const datasets = {
        set1: [1, 2, 3],
        set2: [10, 20, 30]
      };

      const result = engine.correlateData(datasets);

      expect(result.weakLinks).toBeDefined();
    });

    test('should handle multiple datasets', () => {
      const datasets = {
        set1: [1, 2],
        set2: [2, 3],
        set3: [3, 4]
      };

      const result = engine.correlateData(datasets);

      expect(result.correlations.length).toBe(3); // 3 choose 2 = 3 pairs
    });

    test('should provide summary statistics', () => {
      const datasets = {
        set1: [1, 2, 3],
        set2: [2, 3, 4]
      };

      const result = engine.correlateData(datasets);

      expect(result.summary).toBeDefined();
      expect(result.summary.totalDatasets).toBe(2);
      expect(result.summary.averageCorrelation).toBeGreaterThanOrEqual(0);
    });

    test('should handle single dataset', () => {
      const datasets = {
        set1: [1, 2, 3]
      };

      const result = engine.correlateData(datasets);

      expect(result.correlations.length).toBe(0);
    });
  });

  // ============================================================
  // 4. Build Link Graph Tests
  // ============================================================
  describe('buildLinkGraph', () => {
    test('should create nodes', () => {
      const data = [
        { id: 'A', relation: 'B' },
        { id: 'B', relation: 'C' }
      ];

      const graph = engine.buildLinkGraph(data, 'id', 'relation');

      expect(graph.nodes).toBeDefined();
      expect(graph.nodes.length).toBe(3); // A, B, C
    });

    test('should create edges', () => {
      const data = [
        { id: 'A', relation: 'B' },
        { id: 'B', relation: 'C' }
      ];

      const graph = engine.buildLinkGraph(data, 'id', 'relation');

      expect(graph.edges).toBeDefined();
      expect(graph.edges.length).toBe(2);
    });

    test('should calculate node degree', () => {
      const data = [
        { id: 'A', relation: 'B' },
        { id: 'A', relation: 'C' }
      ];

      const graph = engine.buildLinkGraph(data, 'id', 'relation');

      const nodeA = graph.nodes.find(n => n.id === 'A');
      expect(nodeA.degree).toBe(2);
    });

    test('should handle array relations', () => {
      const data = [
        { id: 'A', relations: ['B', 'C'] }
      ];

      const graph = engine.buildLinkGraph(data, 'id', 'relations');

      expect(graph.edges.length).toBe(2);
    });

    test('should calculate graph statistics', () => {
      const data = [
        { id: 'A', relation: 'B' },
        { id: 'B', relation: 'C' }
      ];

      const graph = engine.buildLinkGraph(data, 'id', 'relation');

      expect(graph.stats).toBeDefined();
      expect(graph.stats.nodeCount).toBe(3);
      expect(graph.stats.edgeCount).toBe(2);
      expect(graph.stats.density).toBeGreaterThanOrEqual(0);
      expect(graph.stats.avgDegree).toBeGreaterThanOrEqual(0);
    });

    test('should build adjacency list', () => {
      const data = [
        { id: 'A', relation: 'B' },
        { id: 'B', relation: 'C' }
      ];

      const graph = engine.buildLinkGraph(data, 'id', 'relation');

      expect(graph.adjacencyList).toBeDefined();
      expect(graph.adjacencyList['A']).toContain('B');
      expect(graph.adjacencyList['B']).toContain('C');
    });

    test('should handle empty data', () => {
      const graph = engine.buildLinkGraph([], 'id', 'relation');

      expect(graph.nodes.length).toBe(0);
      expect(graph.edges.length).toBe(0);
    });
  });

  // ============================================================
  // 5. Text Analytics Tests
  // ============================================================
  describe('textAnalytics', () => {
    test('should calculate word frequency', () => {
      const text = 'hello world hello test';

      const result = engine.textAnalytics(text);

      expect(result.wordFrequency).toBeDefined();
      expect(result.wordFrequency.hello).toBe(2);
      expect(result.wordFrequency.world).toBe(1);
    });

    test('should calculate text statistics', () => {
      const text = 'hello world';

      const result = engine.textAnalytics(text);

      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalWords).toBe(2);
      expect(result.statistics.uniqueWords).toBe(2);
      expect(result.statistics.textLength).toBeGreaterThan(0);
    });

    test('should extract phrases', () => {
      const text = 'hello world hello world test';

      const result = engine.textAnalytics(text);

      expect(result.phraseFrequency).toBeDefined();
      expect(result.phraseFrequency['hello world']).toBe(2);
    });

    test('should extract entities', () => {
      const text = 'Contact me at test@example.com or visit https://example.com';

      const result = engine.textAnalytics(text);

      expect(result.entities).toBeDefined();
      expect(result.entities.emails.length).toBeGreaterThan(0);
      expect(result.entities.urls.length).toBeGreaterThan(0);
    });

    test('should analyze sentiment', () => {
      const text = 'good amazing perfect bad terrible awful';

      const result = engine.textAnalytics(text);

      expect(result.sentiment).toBeDefined();
      expect(result.sentiment.positive).toBeGreaterThan(0);
      expect(result.sentiment.negative).toBeGreaterThan(0);
    });

    test('should handle multiple texts', () => {
      const texts = ['hello world', 'hello test'];

      const result = engine.textAnalytics(texts);

      expect(result.statistics.textCount).toBe(2);
      expect(result.wordFrequency.hello).toBe(2);
    });

    test('should extract numbers', () => {
      const text = 'I have 5 apples and 10 oranges';

      const result = engine.textAnalytics(text);

      expect(result.entities.numbers.length).toBe(2);
    });
  });

  // ============================================================
  // 6. Anomaly Detection Tests
  // ============================================================
  describe('anomalyDetection', () => {
    test('should detect outliers', () => {
      const data = [
        { value: 10 },
        { value: 12 },
        { value: 11 },
        { value: 10 },
        { value: 1000 } // outlier
      ];

      const result = engine.anomalyDetection(data, 'value', { deviation: 1.5 });

      expect(result.anomalies).toBeDefined();
      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies[0].value).toBe(1000);
    });

    test('should calculate statistics', () => {
      const data = [
        { value: 10 },
        { value: 20 },
        { value: 30 }
      ];

      const result = engine.anomalyDetection(data, 'value');

      expect(result.statistics).toBeDefined();
      expect(result.statistics.mean).toBe(20);
      expect(result.statistics.min).toBe(10);
      expect(result.statistics.max).toBe(30);
    });

    test('should use custom deviation threshold', () => {
      const data = [
        { value: 10 },
        { value: 20 },
        { value: 200 }
      ];

      const result = engine.anomalyDetection(data, 'value', { deviation: 1 });

      expect(result.anomalies.length).toBeGreaterThan(0);
    });

    test('should identify reason for anomaly', () => {
      const data = [
        { value: 10 },
        { value: 20 },
        { value: 30 },
        { value: 1000 }
      ];

      const result = engine.anomalyDetection(data, 'value');

      const anomaly = result.anomalies[0];
      expect(['above_upper_bound', 'below_lower_bound']).toContain(anomaly.reason);
    });

    test('should handle non-numeric data', () => {
      const data = [
        { value: 'text' },
        { value: 10 }
      ];

      const result = engine.anomalyDetection(data, 'value');

      expect(result.anomalies).toBeDefined();
    });

    test('should calculate anomaly percentage', () => {
      const data = [
        { value: 10 },
        { value: 11 },
        { value: 12 },
        { value: 100 }
      ];

      const result = engine.anomalyDetection(data, 'value');

      expect(result.statistics.anomalyPercentage).toBeGreaterThan(0);
      expect(result.statistics.anomalyPercentage).toBeLessThanOrEqual(100);
    });
  });

  // ============================================================
  // 7. Cluster Data Tests
  // ============================================================
  describe('clusterData', () => {
    test('should create clusters', () => {
      const data = [
        { color: 'red' },
        { color: 'red' },
        { color: 'blue' },
        { color: 'blue' }
      ];

      const clusters = engine.clusterData(data, 'color', { threshold: 0.9 });

      expect(clusters).toBeDefined();
      expect(clusters.length).toBeGreaterThan(0);
    });

    test('should assign cluster IDs', () => {
      const data = [
        { name: 'Alice' },
        { name: 'Bob' }
      ];

      const clusters = engine.clusterData(data, 'name');

      clusters.forEach((cluster, idx) => {
        expect(cluster.id).toBeDefined();
      });
    });

    test('should identify cluster representative', () => {
      const data = [
        { value: 1 },
        { value: 2 }
      ];

      const clusters = engine.clusterData(data, 'value');

      clusters.forEach(cluster => {
        expect(cluster.representative).toBeDefined();
      });
    });

    test('should use custom threshold', () => {
      const data = [
        { score: 10 },
        { score: 11 },
        { score: 20 }
      ];

      const clusters = engine.clusterData(data, 'score', { threshold: 0.95 });

      expect(clusters).toBeDefined();
    });

    test('should sort clusters by size', () => {
      const data = [
        { type: 'A' },
        { type: 'A' },
        { type: 'A' },
        { type: 'B' },
        { type: 'B' }
      ];

      const clusters = engine.clusterData(data, 'type', { threshold: 0.99 });

      if (clusters.length > 1) {
        expect(clusters[0].size).toBeGreaterThanOrEqual(clusters[1].size);
      }
    });
  });

  // ============================================================
  // 8. Generate Insights Tests
  // ============================================================
  describe('generateInsights', () => {
    test('should generate similarity insights', () => {
      const results = {
        similarElements: [
          { count: 10, similarity: 0.9 }
        ]
      };

      const insights = engine.generateInsights(results);

      expect(insights).toBeDefined();
      const similarityInsight = insights.find(i => i.type === 'similarity');
      expect(similarityInsight).toBeDefined();
    });

    test('should generate pattern insights', () => {
      const results = {
        patterns: [
          { confidence: 0.8, occurrences: 5 }
        ]
      };

      const insights = engine.generateInsights(results);

      const patternInsight = insights.find(i => i.type === 'pattern');
      expect(patternInsight).toBeDefined();
    });

    test('should generate correlation insights', () => {
      const results = {
        correlations: {
          strongLinks: [
            { dataset1: 'set1', dataset2: 'set2', strength: 0.9 }
          ]
        }
      };

      const insights = engine.generateInsights(results);

      const correlationInsight = insights.find(i => i.type === 'correlation');
      expect(correlationInsight).toBeDefined();
    });

    test('should generate anomaly insights', () => {
      const results = {
        anomalies: {
          anomalies: [1, 2, 3],
          statistics: { anomalyPercentage: 10 }
        }
      };

      const insights = engine.generateInsights(results);

      const anomalyInsight = insights.find(i => i.type === 'anomaly');
      expect(anomalyInsight).toBeDefined();
    });

    test('should mark insights as actionable', () => {
      const results = {
        patterns: [
          { confidence: 0.8, occurrences: 5 }
        ]
      };

      const insights = engine.generateInsights(results);

      insights.forEach(insight => {
        expect(insight.actionable).toBeDefined();
        expect(typeof insight.actionable).toBe('boolean');
      });
    });

    test('should limit number of insights', () => {
      const engine2 = new PatternDetectionEngine({ maxInsights: 2 });
      const results = {
        similarElements: [{ count: 5 }, { count: 4 }, { count: 3 }],
        patterns: [{ confidence: 0.8 }, { confidence: 0.7 }],
        correlations: { strongLinks: [{ dataset1: 'a', dataset2: 'b' }] }
      };

      const insights = engine2.generateInsights(results);

      expect(insights.length).toBeLessThanOrEqual(2);
    });

    test('should include suggestions', () => {
      const results = {
        patterns: [
          { confidence: 0.8, occurrences: 5 }
        ]
      };

      const insights = engine.generateInsights(results);

      insights.forEach(insight => {
        expect(insight.suggestion).toBeDefined();
        expect(typeof insight.suggestion).toBe('string');
      });
    });
  });

  // ============================================================
  // Integration & Cache Tests
  // ============================================================
  describe('Integration & Cache', () => {
    test('should clear cache', () => {
      engine.findSimilarElements([{ a: 1 }], 'a');
      engine.clearCache();

      expect(engine.cache.size).toBe(0);
      expect(engine.patterns.size).toBe(0);
      expect(engine.correlations.size).toBe(0);
    });

    test('should handle multiple operations', () => {
      const data = [
        { name: 'Alice', score: 90 },
        { name: 'Bob', score: 85 }
      ];

      const similar = engine.findSimilarElements(data, 'name');
      const patterns = engine.detectPatterns(data);
      const anomalies = engine.anomalyDetection(data, 'score');

      expect(similar).toBeDefined();
      expect(patterns).toBeDefined();
      expect(anomalies).toBeDefined();
    });

    test('should use custom engine options', () => {
      const customEngine = new PatternDetectionEngine({
        similarityThreshold: 0.5,
        patternMinOccurrence: 2,
        anomalyDeviation: 1.5
      });

      expect(customEngine.options.similarityThreshold).toBe(0.5);
      expect(customEngine.options.patternMinOccurrence).toBe(2);
      expect(customEngine.options.anomalyDeviation).toBe(1.5);
    });
  });

  // ============================================================
  // Edge Cases & Error Handling
  // ============================================================
  describe('Edge Cases & Error Handling', () => {
    test('should handle null values', () => {
      const data = [{ value: null }, { value: 5 }];

      const result = engine.anomalyDetection(data, 'value');
      expect(result).toBeDefined();
    });

    test('should handle undefined fields', () => {
      const data = [{ a: 1 }, { b: 2 }];

      const groups = engine.findSimilarElements(data, 'nonexistent');
      expect(groups).toBeDefined();
    });

    test('should handle single element', () => {
      const data = [{ value: 1 }];

      const patterns = engine.detectPatterns(data);
      expect(patterns).toBeDefined();
    });

    test('should handle very large datasets', () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({ id: i, value: i % 10 }));

      const result = engine.clusterData(data, 'value', { threshold: 0.99 });
      expect(result).toBeDefined();
    });

    test('should handle special characters in text', () => {
      const text = 'Hello!@#$% World!';

      const result = engine.textAnalytics(text);
      expect(result.wordFrequency).toBeDefined();
    });

    test('should handle mixed data types', () => {
      const data = [
        { field: 'text' },
        { field: 123 },
        { field: null }
      ];

      const groups = engine.findSimilarElements(data, 'field');
      expect(groups).toBeDefined();
    });
  });
});
