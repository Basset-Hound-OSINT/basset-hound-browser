/**
 * Span Enrichment Tests
 */

const SpanEnricher = require('../../src/observability/span-enrichment');

describe('SpanEnricher', () => {
  let enricher;

  beforeEach(() => {
    enricher = new SpanEnricher();
  });

  afterEach(() => {
    enricher.close();
  });

  describe('Business Context', () => {
    test('should add business context to span', () => {
      const businessContext = enricher.addBusinessContext('span-123', {
        businessDomain: 'user_management',
        businessOperation: 'create_user',
        businessEntity: 'User',
        impactLevel: 'high'
      });

      expect(businessContext.spanId).toBe('span-123');
      expect(businessContext.businessDomain).toBe('user_management');
      expect(businessContext.businessOperation).toBe('create_user');
    });

    test('should emit business context event', (done) => {
      enricher.on('businessContext:added', (data) => {
        expect(data.spanId).toBe('span-123');
        expect(data.businessDomain).toBe('payment');
        done();
      });

      enricher.addBusinessContext('span-123', {
        businessDomain: 'payment',
        businessOperation: 'process_payment'
      });
    });
  });

  describe('User Action Tracking', () => {
    test('should track user action on span', () => {
      const action = enricher.trackUserAction('span-123', {
        actionType: 'click',
        userId: 'user-456',
        actionTarget: 'submit-button'
      });

      expect(action.actionId).toBeDefined();
      expect(action.actionType).toBe('click');
      expect(action.userId).toBe('user-456');
    });

    test('should track multiple user actions', () => {
      enricher.trackUserAction('span-123', { actionType: 'click' });
      enricher.trackUserAction('span-123', { actionType: 'input' });
      const action3 = enricher.trackUserAction('span-123', { actionType: 'submit' });

      const actions = enricher.userActions.get('span-123');
      expect(actions.length).toBe(3);
      expect(actions[2].actionType).toBe('submit');
    });

    test('should get user action timeline', () => {
      enricher.trackUserAction('span-123', { actionType: 'click' });
      enricher.trackUserAction('span-123', { actionType: 'input' });
      enricher.trackUserAction('span-123', { actionType: 'submit' });

      const timeline = enricher.getUserActionTimeline('span-123');

      expect(timeline.actionCount).toBe(3);
      expect(timeline.timeline[0].actionType).toBe('click');
      expect(timeline.timeline[2].actionType).toBe('submit');
    });
  });

  describe('Data Flow Tracking', () => {
    test('should track data flow through span', () => {
      const flow = enricher.trackDataFlow('span-123', {
        dataType: 'request',
        dataSize: 1024,
        dataSource: 'client',
        dataDestination: 'server'
      });

      expect(flow.flowId).toBeDefined();
      expect(flow.dataType).toBe('request');
      expect(flow.dataSize).toBe(1024);
    });

    test('should track multiple data flows', () => {
      enricher.trackDataFlow('span-123', { dataType: 'request', dataSize: 1024 });
      enricher.trackDataFlow('span-123', { dataType: 'response', dataSize: 2048 });

      const flows = enricher.dataFlows.get('span-123');
      expect(flows.length).toBe(2);
    });

    test('should get data flow analysis', () => {
      enricher.trackDataFlow('span-123', {
        dataType: 'request',
        dataSize: 1024,
        dataClassification: 'internal'
      });
      enricher.trackDataFlow('span-123', {
        dataType: 'response',
        dataSize: 2048,
        dataClassification: 'internal'
      });

      const analysis = enricher.getDataFlowAnalysis('span-123');

      expect(analysis.flowCount).toBe(2);
      expect(analysis.totalDataSize).toBe(3072);
      expect(analysis.dataTypeBreakdown['request']).toBeDefined();
      expect(analysis.dataTypeBreakdown['response']).toBeDefined();
    });
  });

  describe('Semantic Metadata', () => {
    test('should add semantic metadata to span', () => {
      const semantic = enricher.addSemanticMetadata('span-123', {
        semanticType: 'database_operation',
        operationType: 'read',
        resourceType: 'database',
        resourceId: 'users_table',
        operationSuccess: true
      });

      expect(semantic.semanticType).toBe('database_operation');
      expect(semantic.operationType).toBe('read');
      expect(semantic.resourceId).toBe('users_table');
    });

    test('should track prerequisites and postconditions', () => {
      const semantic = enricher.addSemanticMetadata('span-123', {
        semanticType: 'transaction',
        prerequisites: ['auth_check', 'permission_check'],
        postconditions: ['commit_transaction', 'log_event']
      });

      expect(semantic.prerequisites.size).toBe(2);
      expect(semantic.postconditions.size).toBe(2);
    });
  });

  describe('Semantic Analysis', () => {
    test('should perform semantic analysis', () => {
      const analysis = enricher.analyzeSpanSemantics('span-123', {
        analysisType: 'pattern',
        findings: ['high_latency', 'resource_contention'],
        confidence: 0.85
      });

      expect(analysis.analysisId).toBeDefined();
      expect(analysis.analysisType).toBe('pattern');
      expect(analysis.confidence).toBe(0.85);
      expect(analysis.findings.length).toBe(2);
    });

    test('should get analysis summary', () => {
      enricher.analyzeSpanSemantics('span-123', {
        analysisType: 'anomaly',
        findings: ['unexpected_latency'],
        riskScore: 75,
        opportunityScore: 20
      });

      const summary = enricher.getAnalysisSummary('span-123');

      expect(summary.analysisType).toBe('anomaly');
      expect(summary.riskScore).toBe(75);
      expect(summary.opportunityScore).toBe(20);
    });
  });

  describe('Enrichment Linking', () => {
    test('should link related enrichments', () => {
      enricher.addBusinessContext('span-1', { businessDomain: 'user' });
      enricher.addBusinessContext('span-2', { businessDomain: 'user' });

      enricher.linkEnrichments('span-1', 'span-2', 'related');

      const context1 = enricher.businessContexts.get('span-1');
      const context2 = enricher.businessContexts.get('span-2');

      expect(context1.relatedBusinessContexts.has('span-2')).toBe(true);
      expect(context2.relatedBusinessContexts.has('span-1')).toBe(true);
    });
  });

  describe('Complete Enrichment Profile', () => {
    test('should get complete enriched span', () => {
      enricher.addBusinessContext('span-123', { businessDomain: 'payment' });
      enricher.trackUserAction('span-123', { actionType: 'click' });
      enricher.trackDataFlow('span-123', { dataType: 'request', dataSize: 1024 });
      enricher.addSemanticMetadata('span-123', { semanticType: 'api_call' });

      const enriched = enricher.getEnrichedSpan('span-123');

      expect(enriched.spanId).toBe('span-123');
      expect(enriched.businessContext).toBeDefined();
      expect(enriched.userActionCount).toBe(1);
      expect(enriched.dataFlowCount).toBe(1);
      expect(enriched.semanticMetadata).toBeDefined();
    });
  });

  describe('Export', () => {
    test('should export enrichment data', () => {
      enricher.addBusinessContext('span-123', { businessDomain: 'order' });
      enricher.trackUserAction('span-123', { actionType: 'submit' });

      const exported = enricher.exportEnrichment('span-123');

      expect(exported.spanId).toBe('span-123');
      expect(exported.businessContext).toBeDefined();
      expect(exported.userActions.length).toBe(1);
      expect(exported.exportedAt).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    test('should clear enrichment data', () => {
      enricher.addBusinessContext('span-123', { businessDomain: 'user' });
      enricher.trackUserAction('span-123', { actionType: 'click' });

      enricher.clear('span-123');

      const enriched = enricher.getEnrichedSpan('span-123');
      expect(enriched.businessContext).toBeUndefined();
      expect(enriched.userActionCount).toBe(0);
    });
  });
});
