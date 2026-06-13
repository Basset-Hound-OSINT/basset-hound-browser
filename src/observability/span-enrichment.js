/**
 * Span Enhancement for Basset Hound Browser
 *
 * Provides:
 * - Business context enrichment
 * - User action tracking
 * - Data flow monitoring
 * - Semantic span enhancement
 *
 * Features:
 * - Automatic business context injection
 * - User action correlation
 * - Data lineage tracking
 * - Span semantic analysis
 * - Custom business metrics
 */

const EventEmitter = require('events');

class SpanEnricher extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      enableBusinessContext: options.enableBusinessContext !== false,
      enableUserTracking: options.enableUserTracking !== false,
      enableDataFlow: options.enableDataFlow !== false,
      enableSemanticAnalysis: options.enableSemanticAnalysis !== false,
      maxContextSize: options.maxContextSize || 5000,
      ...options
    };

    this.spanEnrichments = new Map();
    this.businessContexts = new Map();
    this.userActions = new Map();
    this.dataFlows = new Map();
    this.spanMetadata = new Map();
    this.semanticAnalyses = new Map();
  }

  /**
   * Add business context to span
   */
  addBusinessContext(spanId, contextData) {
    const businessContext = {
      spanId,
      contextType: contextData.contextType || 'general',
      businessDomain: contextData.businessDomain || null,
      businessOperation: contextData.businessOperation || null,
      businessEntity: contextData.businessEntity || null,
      businessMetrics: contextData.businessMetrics || {},
      impactLevel: contextData.impactLevel || 'medium', // critical, high, medium, low
      severity: contextData.severity || 'info', // critical, high, medium, low, info
      relatedBusinessContexts: new Set(),
      addedAt: Date.now(),
      annotations: contextData.annotations || {}
    };

    this.businessContexts.set(spanId, businessContext);
    this._updateSpanEnrichment(spanId, 'businessContext', businessContext);

    this.emit('businessContext:added', {
      spanId,
      contextType: businessContext.contextType,
      businessDomain: businessContext.businessDomain
    });

    return businessContext;
  }

  /**
   * Track user action on span
   */
  trackUserAction(spanId, actionData) {
    const userAction = {
      spanId,
      actionId: this._generateActionId(),
      actionType: actionData.actionType || 'unknown', // click, input, navigation, etc
      userId: actionData.userId || null,
      userSessionId: actionData.userSessionId || null,
      actionTimestamp: Date.now(),
      actionDuration: actionData.actionDuration || null,
      actionTarget: actionData.actionTarget || null,
      actionResult: actionData.actionResult || null,
      actionContext: actionData.actionContext || {},
      userIntent: actionData.userIntent || null,
      userAttributes: actionData.userAttributes || {},
      impactOnSystem: actionData.impactOnSystem || 'none', // high, medium, low, none
      retryCount: 0,
      retryReason: null
    };

    if (!this.userActions.has(spanId)) {
      this.userActions.set(spanId, []);
    }
    this.userActions.get(spanId).push(userAction);
    this._updateSpanEnrichment(spanId, 'userActions', userAction);

    this.emit('userAction:tracked', {
      spanId,
      actionId: userAction.actionId,
      actionType: userAction.actionType,
      userId: userAction.userId
    });

    return userAction;
  }

  /**
   * Monitor data flow through span
   */
  trackDataFlow(spanId, flowData) {
    const dataFlow = {
      spanId,
      flowId: this._generateFlowId(),
      dataType: flowData.dataType || 'unknown', // request, response, cache, storage
      dataSize: flowData.dataSize || 0,
      dataHash: flowData.dataHash || null,
      dataSource: flowData.dataSource || null,
      dataDestination: flowData.dataDestination || null,
      transformations: flowData.transformations || [],
      flowTimestamp: Date.now(),
      flowDuration: flowData.flowDuration || null,
      dataIntegrity: flowData.dataIntegrity !== false,
      dataClassification: flowData.dataClassification || 'unclassified', // public, internal, confidential, restricted
      flowPath: flowData.flowPath || [],
      dependencies: new Set(flowData.dependencies || []),
      dataQuality: flowData.dataQuality || 'unknown', // high, medium, low, unknown
      cachedStatus: flowData.cachedStatus || false,
      compressionRatio: flowData.compressionRatio || 1.0
    };

    if (!this.dataFlows.has(spanId)) {
      this.dataFlows.set(spanId, []);
    }
    this.dataFlows.get(spanId).push(dataFlow);
    this._updateSpanEnrichment(spanId, 'dataFlows', dataFlow);

    this.emit('dataFlow:tracked', {
      spanId,
      flowId: dataFlow.flowId,
      dataType: dataFlow.dataType,
      dataSize: dataFlow.dataSize
    });

    return dataFlow;
  }

  /**
   * Add semantic metadata to span
   */
  addSemanticMetadata(spanId, metadata) {
    const semantic = {
      spanId,
      semanticType: metadata.semanticType || 'generic',
      semanticMeaning: metadata.semanticMeaning || null,
      operationType: metadata.operationType || null, // read, write, compute, transform
      resourceType: metadata.resourceType || null, // database, api, cache, file
      resourceId: metadata.resourceId || null,
      operationSuccess: metadata.operationSuccess !== false,
      operationError: metadata.operationError || null,
      relatedResources: new Set(metadata.relatedResources || []),
      prerequisites: new Set(metadata.prerequisites || []),
      postconditions: new Set(metadata.postconditions || []),
      sideEffects: new Set(metadata.sideEffects || []),
      semanticTimestamp: Date.now(),
      semanticContext: metadata.semanticContext || {},
      performanceCharacteristics: metadata.performanceCharacteristics || {}
    };

    this.spanMetadata.set(spanId, semantic);
    this._updateSpanEnrichment(spanId, 'semantic', semantic);

    this.emit('semantic:added', {
      spanId,
      semanticType: semantic.semanticType,
      operationType: semantic.operationType
    });

    return semantic;
  }

  /**
   * Perform semantic analysis on span
   */
  analyzeSpanSemantics(spanId, analysisData) {
    const analysis = {
      spanId,
      analysisId: this._generateAnalysisId(),
      analysisType: analysisData.analysisType || 'general', // pattern, anomaly, correlation, prediction
      analysisResult: analysisData.analysisResult || null,
      confidence: analysisData.confidence || 0, // 0-1
      analysisTimestamp: Date.now(),
      findings: analysisData.findings || [],
      recommendations: analysisData.recommendations || [],
      relatedSpans: new Set(analysisData.relatedSpans || []),
      patterns: analysisData.patterns || [],
      anomalies: analysisData.anomalies || [],
      correlations: analysisData.correlations || [],
      predictedBehavior: analysisData.predictedBehavior || null,
      riskScore: analysisData.riskScore || 0, // 0-100
      opportunityScore: analysisData.opportunityScore || 0 // 0-100
    };

    this.semanticAnalyses.set(spanId, analysis);
    this._updateSpanEnrichment(spanId, 'analysis', analysis);

    this.emit('analysis:completed', {
      spanId,
      analysisType: analysis.analysisType,
      confidence: analysis.confidence,
      riskScore: analysis.riskScore
    });

    return analysis;
  }

  /**
   * Get complete enriched span data
   */
  getEnrichedSpan(spanId) {
    const enrichment = this.spanEnrichments.get(spanId) || {};
    const businessContext = this.businessContexts.get(spanId);
    const userActions = this.userActions.get(spanId) || [];
    const dataFlows = this.dataFlows.get(spanId) || [];
    const metadata = this.spanMetadata.get(spanId);
    const analysis = this.semanticAnalyses.get(spanId);

    return {
      spanId,
      businessContext,
      userActions,
      userActionCount: userActions.length,
      dataFlows,
      dataFlowCount: dataFlows.length,
      semanticMetadata: metadata,
      semanticAnalysis: analysis,
      enrichmentTimestamp: Date.now(),
      totalEnrichments: Object.keys(enrichment).length
    };
  }

  /**
   * Get user action timeline
   */
  getUserActionTimeline(spanId) {
    const actions = this.userActions.get(spanId) || [];
    const timeline = actions
      .sort((a, b) => a.actionTimestamp - b.actionTimestamp)
      .map((action, index) => ({
        sequence: index + 1,
        actionId: action.actionId,
        actionType: action.actionType,
        timestamp: action.actionTimestamp,
        duration: action.actionDuration,
        result: action.actionResult,
        userId: action.userId,
        target: action.actionTarget
      }));

    return {
      spanId,
      actionCount: timeline.length,
      timeline,
      firstActionTime: timeline.length > 0 ? timeline[0].timestamp : null,
      lastActionTime: timeline.length > 0 ? timeline[timeline.length - 1].timestamp : null,
      totalDuration: timeline.reduce((sum, a) => sum + (a.duration || 0), 0)
    };
  }

  /**
   * Get data flow analysis
   */
  getDataFlowAnalysis(spanId) {
    const flows = this.dataFlows.get(spanId) || [];
    const totalDataSize = flows.reduce((sum, f) => sum + f.dataSize, 0);
    const dataTypeBreakdown = {};
    const compressionBenefits = flows.reduce((sum, f) => sum + (f.dataSize * (1 - f.compressionRatio)), 0);

    flows.forEach(flow => {
      if (!dataTypeBreakdown[flow.dataType]) {
        dataTypeBreakdown[flow.dataType] = { count: 0, totalSize: 0 };
      }
      dataTypeBreakdown[flow.dataType].count++;
      dataTypeBreakdown[flow.dataType].totalSize += flow.dataSize;
    });

    return {
      spanId,
      flowCount: flows.length,
      totalDataSize,
      totalCompressed: compressionBenefits,
      dataTypeBreakdown,
      dataClassifications: [...new Set(flows.map(f => f.dataClassification))],
      integrityStatus: flows.every(f => f.dataIntegrity) ? 'verified' : 'compromised',
      cachedFlows: flows.filter(f => f.cachedStatus).length,
      averageCompressionRatio: flows.length > 0
        ? flows.reduce((sum, f) => sum + f.compressionRatio, 0) / flows.length
        : 1.0
    };
  }

  /**
   * Get semantic analysis summary
   */
  getAnalysisSummary(spanId) {
    const analysis = this.semanticAnalyses.get(spanId);
    if (!analysis) {
      return null;
    }

    return {
      spanId,
      analysisId: analysis.analysisId,
      analysisType: analysis.analysisType,
      confidence: analysis.confidence,
      riskScore: analysis.riskScore,
      opportunityScore: analysis.opportunityScore,
      findingCount: analysis.findings.length,
      findings: analysis.findings,
      recommendations: analysis.recommendations,
      patternCount: analysis.patterns.length,
      anomalyCount: analysis.anomalies.length,
      correlationCount: analysis.correlations.length,
      predictedBehavior: analysis.predictedBehavior,
      relatedSpanCount: analysis.relatedSpans.size
    };
  }

  /**
   * Link related enrichments
   */
  linkEnrichments(spanId1, spanId2, relationshipType = 'related') {
    const context1 = this.businessContexts.get(spanId1);
    const context2 = this.businessContexts.get(spanId2);

    if (context1) {
      context1.relatedBusinessContexts.add(spanId2);
    }

    if (context2) {
      context2.relatedBusinessContexts.add(spanId1);
    }

    this.emit('enrichments:linked', {
      spanId1,
      spanId2,
      relationshipType
    });

    return { spanId1, spanId2, relationshipType };
  }

  /**
   * Export enrichment data
   */
  exportEnrichment(spanId) {
    return {
      spanId,
      businessContext: this.businessContexts.get(spanId),
      userActions: this.userActions.get(spanId) || [],
      dataFlows: this.dataFlows.get(spanId) || [],
      semanticMetadata: this.spanMetadata.get(spanId),
      semanticAnalysis: this.semanticAnalyses.get(spanId),
      exportedAt: Date.now()
    };
  }

  /**
   * Internal: Update span enrichment tracking
   */
  _updateSpanEnrichment(spanId, type, data) {
    if (!this.spanEnrichments.has(spanId)) {
      this.spanEnrichments.set(spanId, {});
    }
    const enrichment = this.spanEnrichments.get(spanId);
    if (!enrichment[type]) {
      enrichment[type] = [];
    }
    enrichment[type].push(data);
  }

  /**
   * Generate action ID
   */
  _generateActionId() {
    return `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate flow ID
   */
  _generateFlowId() {
    return `flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate analysis ID
   */
  _generateAnalysisId() {
    return `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear enrichment data
   */
  clear(spanId) {
    this.businessContexts.delete(spanId);
    this.userActions.delete(spanId);
    this.dataFlows.delete(spanId);
    this.spanMetadata.delete(spanId);
    this.semanticAnalyses.delete(spanId);
    this.spanEnrichments.delete(spanId);

    this.emit('enrichment:cleared', { spanId });
  }

  /**
   * Close system
   */
  close() {
    this.spanEnrichments.clear();
    this.businessContexts.clear();
    this.userActions.clear();
    this.dataFlows.clear();
    this.spanMetadata.clear();
    this.semanticAnalyses.clear();
    this.emit('system:closed');
  }
}

module.exports = SpanEnricher;
