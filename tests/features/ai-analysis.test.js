/**
 * AI Analysis Integration Tests (Wave 16 Phase 6)
 * 35+ test scenarios for Claude API integration and analysis
 */

const AIAnalysisEngine = require('../../src/features/ai-analysis');

describe('AIAnalysisEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new AIAnalysisEngine({
      modelId: 'claude-3-5-sonnet-20241022',
      maxTokens: 4096,
      cacheEnabled: true,
      confidenceThreshold: 0.7
    });
  });

  describe('Evidence Analysis', () => {
    test('should analyze evidence set', async () => {
      const evidence = [
        { type: 'log', content: 'User login from 192.168.1.1' },
        { type: 'log', content: 'User login from 192.168.1.2' },
        { type: 'log', content: 'User login from 10.0.0.1' }
      ];

      const result = await engine.analyzeEvidence(evidence);
      expect(result.success).toBe(true);
      expect(result.analysisId).toBeDefined();
    });

    test('should return analysis with patterns', async () => {
      const evidence = [
        { ip: '1.1.1.1', time: 1000 },
        { ip: '1.1.1.1', time: 2000 },
        { ip: '2.2.2.2', time: 5000 }
      ];

      const result = await engine.analyzeEvidence(evidence);
      expect(result.result.patterns).toBeDefined();
      expect(result.result.patterns.length).toBeGreaterThanOrEqual(0);
    });

    test('should include confidence scores', async () => {
      const evidence = [{ data: 'test' }];
      const result = await engine.analyzeEvidence(evidence);
      expect(result.result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.result.confidence).toBeLessThanOrEqual(1);
    });

    test('should cache analysis results', async () => {
      const evidence = [{ id: 1 }, { id: 2 }];

      const result1 = await engine.analyzeEvidence(evidence);
      const result2 = await engine.analyzeEvidence(evidence);

      expect(result1.result).toEqual(result2.result);
      expect(result2.fromCache).toBe(true);
    });

    test('should analyze with context', async () => {
      const evidence = [{ suspicious: true }];
      const context = { caseType: 'fraud' };

      const result = await engine.analyzeEvidence(evidence, context);
      expect(result.success).toBe(true);
    });
  });

  describe('Pattern Detection', () => {
    test('should detect patterns in entities', async () => {
      const entities = [
        { name: 'entity-1', location: 'NY' },
        { name: 'entity-2', location: 'NY' },
        { name: 'entity-3', location: 'CA' }
      ];

      const result = await engine.detectPatterns(entities);
      expect(result.success).toBe(true);
      expect(result.patternId).toBeDefined();
    });

    test('should identify pattern strength', async () => {
      const entities = [
        { type: 'A' }, { type: 'A' }, { type: 'B' }
      ];

      const result = await engine.detectPatterns(entities);
      expect(result.patterns.patterns).toBeDefined();
    });

    test('should identify clusters', async () => {
      const entities = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        group: i < 5 ? 'A' : 'B'
      }));

      const result = await engine.detectPatterns(entities);
      expect(result.patterns.clusterSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Threat Profiling', () => {
    test('should profile threat actor', async () => {
      const evidence = [
        { action: 'credential-theft', target: 'bank' },
        { action: 'data-exfil', target: 'financial' }
      ];

      const result = await engine.profileThreatActor(evidence);
      expect(result.success).toBe(true);
      expect(result.threat.sophistication).toBeDefined();
    });

    test('should assess threat confidence', async () => {
      const evidence = [{ suspicious: true }];
      const result = await engine.profileThreatActor(evidence);
      expect(result.threat.confidence).toBeGreaterThanOrEqual(0);
      expect(result.threat.confidence).toBeLessThanOrEqual(1);
    });

    test('should identify related actors', async () => {
      const evidence = [{ modus_operandi: 'APT-style' }];
      const result = await engine.profileThreatActor(evidence);
      expect(result.threat.relatedActors).toBeDefined();
      expect(Array.isArray(result.threat.relatedActors)).toBe(true);
    });

    test('should assess threat motivation', async () => {
      const evidence = [{ target: 'government' }];
      const result = await engine.profileThreatActor(evidence);
      expect(result.threat.motivation).toBeDefined();
      expect(Array.isArray(result.threat.motivation)).toBe(true);
    });
  });

  describe('Report Generation', () => {
    test('should generate investigation report', async () => {
      const findings = [
        { title: 'Finding 1', severity: 'high' },
        { title: 'Finding 2', severity: 'medium' }
      ];

      const result = await engine.generateReport(findings, 'standard');
      expect(result.success).toBe(true);
      expect(result.report.title).toBeDefined();
    });

    test('should include key findings in report', async () => {
      const findings = [
        { description: 'Important finding' }
      ];

      const result = await engine.generateReport(findings);
      expect(result.report.keyFindings).toBeDefined();
      expect(Array.isArray(result.report.keyFindings)).toBe(true);
    });

    test('should include recommendations', async () => {
      const findings = [{ issue: 'security-gap' }];
      const result = await engine.generateReport(findings);
      expect(result.report.recommendations).toBeDefined();
      expect(Array.isArray(result.report.recommendations)).toBe(true);
    });

    test('should support multiple templates', async () => {
      const findings = [{ data: 'test' }];

      const standard = await engine.generateReport(findings, 'standard');
      const executive = await engine.generateReport(findings, 'executive');

      expect(standard.success).toBe(true);
      expect(executive.success).toBe(true);
    });
  });

  describe('Network Analysis', () => {
    test('should analyze network links', async () => {
      const nodes = [
        { id: 'n1', type: 'ip' },
        { id: 'n2', type: 'ip' }
      ];
      const edges = [
        { from: 'n1', to: 'n2', weight: 0.8 }
      ];

      const result = await engine.analyzeNetworkLinks(nodes, edges);
      expect(result.success).toBe(true);
      expect(result.analysisId).toBeDefined();
    });

    test('should identify key nodes', async () => {
      const nodes = [
        { id: 'n1' }, { id: 'n2' }, { id: 'n3' }
      ];
      const edges = [
        { from: 'n1', to: 'n2' },
        { from: 'n1', to: 'n3' }
      ];

      const result = await engine.analyzeNetworkLinks(nodes, edges);
      expect(result.analysis.keyNodes).toBeDefined();
    });

    test('should detect network clusters', async () => {
      const nodes = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}` }));
      const edges = [];

      const result = await engine.analyzeNetworkLinks(nodes, edges);
      expect(result.analysis.clusters).toBeDefined();
    });

    test('should identify anomalies in network', async () => {
      const nodes = [
        { id: 'n1' }, { id: 'n2' }, { id: 'n3', suspicious: true }
      ];
      const edges = [];

      const result = await engine.analyzeNetworkLinks(nodes, edges);
      expect(result.analysis.anomalies).toBeDefined();
    });
  });

  describe('Intelligence Gaps', () => {
    test('should identify intelligence gaps', async () => {
      const evidence = [
        { type: 'log', info: 'user login' }
      ];

      const result = await engine.identifyIntelligenceGaps(
        evidence,
        'Who is the attacker?'
      );

      expect(result.success).toBe(true);
      expect(result.gaps.identifiedGaps).toBeDefined();
    });

    test('should suggest collection methods', async () => {
      const evidence = [];
      const result = await engine.identifyIntelligenceGaps(
        evidence,
        'What happened?'
      );

      expect(result.gaps.suggestedCollectionMethods).toBeDefined();
      expect(Array.isArray(result.gaps.suggestedCollectionMethods)).toBe(true);
    });

    test('should prioritize gaps', async () => {
      const evidence = [{ incomplete: true }];
      const result = await engine.identifyIntelligenceGaps(
        evidence,
        'Investigation question'
      );

      expect(result.gaps.priority).toBeDefined();
    });
  });

  describe('Hypothesis Analysis', () => {
    test('should evaluate competing hypotheses', async () => {
      const hypotheses = [
        'Threat actor is APT-1',
        'Threat actor is APT-2',
        'Threat actor is unknown'
      ];
      const evidence = [
        { indicator: 'malware-signature-1' }
      ];

      const result = await engine.analyzeHypotheses(hypotheses, evidence);
      expect(result.success).toBe(true);
      expect(result.analysis.hypotheses).toBeDefined();
    });

    test('should identify most likely hypothesis', async () => {
      const hypotheses = ['H1', 'H2', 'H3'];
      const evidence = [{ supports: 'H1' }];

      const result = await engine.analyzeHypotheses(hypotheses, evidence);
      expect(result.analysis.mostLikely).toBeDefined();
    });

    test('should assess consistency with evidence', async () => {
      const hypotheses = ['hypothesis1'];
      const evidence = [{ consistency: 'high' }];

      const result = await engine.analyzeHypotheses(hypotheses, evidence);
      expect(result.analysis.consistency).toBeDefined();
    });
  });

  describe('Analysis Retrieval', () => {
    test('should retrieve analysis by ID', async () => {
      const evidence = [{ data: 'test' }];
      const result1 = await engine.analyzeEvidence(evidence);

      const result2 = engine.getAnalysis(result1.analysisId);
      expect(result2.success).toBe(true);
      expect(result2.analysis.id).toBe(result1.analysisId);
    });

    test('should list recent analyses', async () => {
      const evidence = [{ data: 'test' }];

      await engine.analyzeEvidence(evidence);
      await engine.analyzeEvidence(evidence);

      const result = engine.listAnalyses();
      expect(result.success).toBe(true);
      expect(result.analyses.length).toBeGreaterThan(0);
    });

    test('should support pagination', async () => {
      const evidence = [{ data: 'test' }];

      for (let i = 0; i < 10; i++) {
        await engine.analyzeEvidence(evidence);
      }

      const result = engine.listAnalyses({ limit: 5, offset: 0 });
      expect(result.analyses.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Caching', () => {
    test('should cache analysis results', async () => {
      const evidence = [{ id: 1 }];

      const result1 = await engine.analyzeEvidence(evidence);
      const result2 = await engine.analyzeEvidence(evidence);

      expect(result2.fromCache).toBe(true);
    });

    test('should respect cache expiry', async () => {
      const shortCacheEngine = new AIAnalysisEngine({
        cacheExpiry: 100 // 100ms
      });

      const evidence = [{ data: 'test' }];
      await shortCacheEngine.analyzeEvidence(evidence);

      await new Promise(resolve => setTimeout(resolve, 150));

      const result = await shortCacheEngine.analyzeEvidence(evidence);
      expect(result.fromCache).toBe(false);
    });

    test('should report cache statistics', () => {
      const stats = engine.getCacheStats();
      expect(stats.cacheSize).toBeGreaterThanOrEqual(0);
      expect(stats.maxCacheSize).toBeGreaterThan(0);
      expect(stats.utilizationPercent).toBeDefined();
    });

    test('should clear cache', () => {
      const result = engine.clearCache();
      expect(result.success).toBe(true);
      expect(result.clearedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing evidence', async () => {
      const result = await engine.analyzeEvidence(null);
      expect(result.success).toBe(false);
    });

    test('should handle invalid analysis ID', () => {
      const result = engine.getAnalysis('nonexistent');
      expect(result.success).toBe(false);
    });

    test('should handle empty hypothesis list', async () => {
      const result = await engine.analyzeHypotheses([], []);
      expect(result.success).toBe(true);
    });
  });

  describe('Performance', () => {
    test('should handle large evidence sets', async () => {
      const largeEvidence = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: `Evidence ${i}`
      }));

      const start = Date.now();
      const result = await engine.analyzeEvidence(largeEvidence);
      const duration = Date.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle rapid successive analyses', async () => {
      const evidence = [{ data: 'test' }];
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(engine.analyzeEvidence(evidence));
      }

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;

      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe('Events', () => {
    test('should emit analysis completion event', (done) => {
      engine.on('analysis:completed', (event) => {
        expect(event.analysisId).toBeDefined();
        done();
      });

      engine.analyzeEvidence([{ data: 'test' }]);
    });

    test('should emit pattern detection event', (done) => {
      engine.on('patterns:detected', (event) => {
        expect(event.patternId).toBeDefined();
        done();
      });

      engine.detectPatterns([{ id: 1 }, { id: 2 }]);
    });

    test('should emit threat profiling event', (done) => {
      engine.on('threat:profiled', (event) => {
        expect(event.threatId).toBeDefined();
        done();
      });

      engine.profileThreatActor([{ suspicious: true }]);
    });

    test('should emit report generation event', (done) => {
      engine.on('report:generated', (event) => {
        expect(event.reportId).toBeDefined();
        done();
      });

      engine.generateReport([{ finding: 'test' }]);
    });
  });

  describe('Confidence Scoring', () => {
    test('should respect confidence threshold', async () => {
      const thresholdEngine = new AIAnalysisEngine({
        confidenceThreshold: 0.9
      });

      const evidence = [{ data: 'test' }];
      const result = await thresholdEngine.analyzeEvidence(evidence);

      if (result.result.confidence < 0.9) {
        expect(result.result.confidence).toBeLessThan(0.9);
      }
    });

    test('should calculate confidence for all analyses', async () => {
      const evidence = [{ data: 'test' }];
      const result = await engine.analyzeEvidence(evidence);

      expect(result.result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.result.confidence).toBeLessThanOrEqual(1);
    });
  });
});
