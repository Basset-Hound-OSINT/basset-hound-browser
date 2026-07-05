/**
 * WebSocket Commands for Evidence Correlation & Cross-Site Analysis
 *
 * Feature Area: Evidence Analysis - Phase 2 P0
 *
 * Provides WebSocket commands for:
 * - start_evidence_correlation (initialize correlation session)
 * - correlate_evidence_across_sites (link evidence from multiple sources)
 * - get_correlation_graph (retrieve correlation network)
 * - export_correlation_report (generate analysis report)
 * - identify_common_patterns (find cross-site patterns)
 *
 * @module websocket/commands/evidence-correlation-commands
 */

const crypto = require('crypto');

// Evidence correlation tracking state
let correlationState = {
  sessionId: null,
  startTime: null,
  siteGroups: {},
  correlations: [],
  patterns: [],
  correlationGraph: {
    nodes: [],
    edges: []
  },
  exportedReports: []
};

/**
 * Initialize evidence correlation session
 */
function _initializeCorrelationSession(sessionOptions = {}) {
  const sessionId = crypto.randomBytes(16).toString('hex');
  correlationState.sessionId = sessionId;
  correlationState.startTime = new Date().toISOString();
  correlationState.siteGroups = {};
  correlationState.correlations = [];
  correlationState.patterns = [];
  correlationState.correlationGraph = {
    nodes: [],
    edges: [],
    adjacencyMatrix: {}
  };
  return sessionId;
}

/**
 * Calculate correlation score between two datasets
 */
function _calculateCorrelationScore(dataset1, dataset2) {
  if (!Array.isArray(dataset1) || !Array.isArray(dataset2)) return 0;

  const set1 = new Set(dataset1.map(JSON.stringify));
  const set2 = new Set(dataset2.map(JSON.stringify));

  let intersection = 0;
  for (const item of set1) {
    if (set2.has(item)) intersection++;
  }

  const union = set1.size + set2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Find common elements between datasets
 */
function _findCommonElements(datasets) {
  if (!datasets || Object.keys(datasets).length === 0) return [];

  const arrays = Object.values(datasets).filter(Array.isArray);
  if (arrays.length === 0) return [];

  const firstSet = new Set(arrays[0].map(JSON.stringify));
  let commonElements = [...firstSet];

  for (let i = 1; i < arrays.length; i++) {
    const currentSet = new Set(arrays[i].map(JSON.stringify));
    commonElements = commonElements.filter(item => currentSet.has(item));
  }

  return commonElements.map(JSON.parse);
}

/**
 * Register evidence correlation WebSocket commands
 */
function registerEvidenceCorrelationCommands(server, mainWindow) {
  const commandHandlers = server.commandHandlers || server;

  /**
   * Start Evidence Correlation Session
   *
   * Command: start_evidence_correlation
   * Params: {
   *   investigationId?: string,
   *   sites?: Array<string>,
   *   timeframe?: { start: ISO8601, end: ISO8601 },
   *   correlationType?: 'BEHAVIORAL' | 'CONTENT' | 'TEMPORAL' | 'FULL'
   * }
   * Response: {
   *   success: true,
   *   correlationSessionId: string,
   *   startTime: ISO8601,
   *   correlationType: string
   * }
   */
  commandHandlers.start_evidence_correlation = async (params) => {
    try {
      const sessionId = _initializeCorrelationSession(params);

      if (params.sites && Array.isArray(params.sites)) {
        for (const site of params.sites) {
          correlationState.siteGroups[site] = {
            siteUrl: site,
            evidence: [],
            patterns: [],
            correlations: []
          };
        }
      }

      return {
        success: true,
        correlationSessionId: sessionId,
        startTime: correlationState.startTime,
        correlationType: params.correlationType || 'FULL',
        sitesRegistered: params.sites ? params.sites.length : 0,
        status: 'CORRELATION_SESSION_ACTIVE'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Correlate Evidence Across Multiple Sites
   *
   * Command: correlate_evidence_across_sites
   * Params: {
   *   siteName: string,
   *   evidence: Array<{ id: string, data: any, timestamp: ISO8601 }>,
   *   correlationTargets?: Array<string>,
   *   thresholdScore?: number (0-1)
   * }
   * Response: {
   *   success: true,
   *   siteName: string,
   *   evidenceCount: number,
   *   correlationsFound: Array<{
   *     targetSite: string,
   *     score: number,
   *     commonElements: number,
   *     evidenceMatches: Array
   *   }>,
   *   totalCorrelations: number
   * }
   */
  commandHandlers.correlate_evidence_across_sites = async (params) => {
    try {
      if (!params.siteName || typeof params.siteName !== 'string') {
        throw new Error('siteName is required');
      }
      if (!params.evidence || !Array.isArray(params.evidence)) {
        throw new Error('evidence must be an array');
      }

      const threshold = params.thresholdScore || 0.3;
      const correlationsFound = [];

      // Initialize site group if not exists
      if (!correlationState.siteGroups[params.siteName]) {
        correlationState.siteGroups[params.siteName] = {
          siteUrl: params.siteName,
          evidence: [],
          patterns: [],
          correlations: []
        };
      }

      // Store evidence for this site
      correlationState.siteGroups[params.siteName].evidence.push(...params.evidence);

      // Correlate with other sites
      const targetSites = params.correlationTargets ||
        Object.keys(correlationState.siteGroups).filter(s => s !== params.siteName);

      for (const targetSite of targetSites) {
        if (correlationState.siteGroups[targetSite]) {
          const targetEvidence = correlationState.siteGroups[targetSite].evidence;
          const score = _calculateCorrelationScore(params.evidence, targetEvidence);

          if (score >= threshold) {
            const commonElements = _findCommonElements({
              current: params.evidence.map(e => e.data),
              target: targetEvidence.map(e => e.data)
            });

            const correlation = {
              sourceSite: params.siteName,
              targetSite: targetSite,
              score: parseFloat(score.toFixed(4)),
              commonElementCount: commonElements.length,
              correlationId: crypto.randomBytes(8).toString('hex'),
              timestamp: new Date().toISOString(),
              evidenceMatches: commonElements.slice(0, 5) // Top 5 matches
            };

            correlationsFound.push(correlation);
            correlationState.correlations.push(correlation);

            // Update graph
            _updateCorrelationGraph(params.siteName, targetSite, score);
          }
        }
      }

      return {
        success: true,
        siteName: params.siteName,
        evidenceCount: params.evidence.length,
        correlationsFound: correlationsFound,
        totalCorrelations: correlationsFound.length,
        strongCorrelations: correlationsFound.filter(c => c.score >= 0.7).length,
        mediumCorrelations: correlationsFound.filter(c => c.score >= 0.5 && c.score < 0.7).length,
        weakCorrelations: correlationsFound.filter(c => c.score >= threshold && c.score < 0.5).length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get Correlation Graph
   *
   * Command: get_correlation_graph
   * Params: {
   *   format?: 'NODES_EDGES' | 'ADJACENCY_MATRIX' | 'FULL',
   *   includeDetails?: boolean
   * }
   * Response: {
   *   success: true,
   *   graph: {
   *     nodes: Array<{ id: string, siteUrl: string, evidenceCount: number, patternCount: number }>,
   *     edges: Array<{ source: string, target: string, weight: number, correlationId: string }>,
   *     adjacencyMatrix?: {}
   *   },
   *   stats: {
   *     totalNodes: number,
   *     totalEdges: number,
   *     networkDensity: number,
   *     averageCorrelationScore: number
   *   }
   * }
   */
  commandHandlers.get_correlation_graph = async (params) => {
    try {
      const format = params.format || 'NODES_EDGES';

      // Build nodes from site groups
      const nodes = Object.entries(correlationState.siteGroups).map(([siteUrl, group]) => ({
        id: siteUrl,
        siteUrl: siteUrl,
        evidenceCount: group.evidence.length,
        patternCount: group.patterns.length,
        correlationCount: group.correlations.length
      }));

      // Build edges from correlations
      const edges = correlationState.correlations.map(corr => ({
        source: corr.sourceSite,
        target: corr.targetSite,
        weight: corr.score,
        correlationId: corr.correlationId,
        commonElements: corr.commonElementCount,
        timestamp: corr.timestamp
      }));

      // Calculate graph statistics
      const totalEdges = edges.length;
      const maxPossibleEdges = nodes.length > 1 ? (nodes.length * (nodes.length - 1)) / 2 : 0;
      const networkDensity = maxPossibleEdges > 0 ? totalEdges / maxPossibleEdges : 0;
      const averageScore = edges.length > 0
        ? edges.reduce((sum, e) => sum + e.weight, 0) / edges.length
        : 0;

      const response = {
        success: true,
        graph: {
          nodes: nodes,
          edges: edges
        },
        stats: {
          totalNodes: nodes.length,
          totalEdges: totalEdges,
          networkDensity: parseFloat(networkDensity.toFixed(4)),
          averageCorrelationScore: parseFloat(averageScore.toFixed(4)),
          strongestCorrelation: edges.length > 0 ? Math.max(...edges.map(e => e.weight)) : 0,
          weakestCorrelation: edges.length > 0 ? Math.min(...edges.map(e => e.weight)) : 0
        }
      };

      // Include adjacency matrix if requested
      if (format === 'ADJACENCY_MATRIX' || format === 'FULL') {
        const matrix = {};
        for (const node of nodes) {
          matrix[node.id] = {};
          for (const otherNode of nodes) {
            if (node.id === otherNode.id) {
              matrix[node.id][otherNode.id] = 1;
            } else {
              const edge = edges.find(e =>
                (e.source === node.id && e.target === otherNode.id) ||
                (e.source === otherNode.id && e.target === node.id)
              );
              matrix[node.id][otherNode.id] = edge ? edge.weight : 0;
            }
          }
        }
        response.graph.adjacencyMatrix = matrix;
      }

      if (params.includeDetails) {
        response.graph.correlationDetails = correlationState.correlations;
      }

      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Export Correlation Report
   *
   * Command: export_correlation_report
   * Params: {
   *   format?: 'JSON' | 'CSV' | 'GRAPH_DATA',
   *   includeEvidence?: boolean,
   *   includePatterns?: boolean,
   *   minCorrelationScore?: number
   * }
   * Response: {
   *   success: true,
   *   reportId: string,
   *   format: string,
   *   correlationSummary: {},
   *   reportContent: {}
   * }
   */
  commandHandlers.export_correlation_report = async (params) => {
    try {
      const reportId = crypto.randomBytes(16).toString('hex');
      const format = params.format || 'JSON';
      const minScore = params.minCorrelationScore || 0;

      // Filter correlations by minimum score
      const filteredCorrelations = correlationState.correlations.filter(
        c => c.score >= minScore
      );

      const reportContent = {
        reportId: reportId,
        generatedAt: new Date().toISOString(),
        correlationSessionId: correlationState.sessionId,
        summary: {
          sitesAnalyzed: Object.keys(correlationState.siteGroups).length,
          totalEvidenceItems: Object.values(correlationState.siteGroups)
            .reduce((sum, g) => sum + g.evidence.length, 0),
          correlationsFound: filteredCorrelations.length,
          strongCorrelations: filteredCorrelations.filter(c => c.score >= 0.7).length,
          mediumCorrelations: filteredCorrelations.filter(c => c.score >= 0.5 && c.score < 0.7).length,
          averageScore: filteredCorrelations.length > 0
            ? filteredCorrelations.reduce((sum, c) => sum + c.score, 0) / filteredCorrelations.length
            : 0
        },
        correlations: filteredCorrelations,
        siteBreakdown: Object.entries(correlationState.siteGroups).map(([site, group]) => ({
          site: site,
          evidenceCount: group.evidence.length,
          correlationsInitiated: group.correlations.length,
          patterns: group.patterns.length
        }))
      };

      if (params.includeEvidence) {
        reportContent.evidence = correlationState.siteGroups;
      }

      if (params.includePatterns) {
        reportContent.patterns = correlationState.patterns;
      }

      correlationState.exportedReports.push(reportContent);

      return {
        success: true,
        reportId: reportId,
        format: format,
        generatedAt: reportContent.generatedAt,
        correlationSummary: reportContent.summary,
        reportContent: reportContent
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Identify Common Patterns Across Sites
   *
   * Command: identify_common_patterns
   * Params: {
   *   patternType?: 'BEHAVIORAL' | 'CONTENT' | 'TEMPORAL' | 'NETWORK',
   *   minOccurrence?: number,
   *   options?: {}
   * }
   * Response: {
   *   success: true,
   *   commonPatterns: Array<{
   *     patternId: string,
   *     type: string,
   *     pattern: any,
   *     occurrences: number,
   *     sites: Array<string>,
   *     confidence: number
   *   }>,
   *   patternSummary: {}
   * }
   */
  commandHandlers.identify_common_patterns = async (params) => {
    try {
      const patternType = params.patternType || 'BEHAVIORAL';
      const minOccurrence = params.minOccurrence || 2;
      const commonPatterns = [];

      // Extract patterns from evidence across all sites
      const allEvidence = Object.entries(correlationState.siteGroups).flatMap(
        ([site, group]) => group.evidence.map(e => ({ ...e, site }))
      );

      // Find common behavioral patterns (repeated sequences)
      if (patternType === 'BEHAVIORAL' || patternType === 'NETWORK') {
        const behaviorMap = new Map();

        for (const item of allEvidence) {
          const behavior = JSON.stringify({
            type: item.data?.type,
            action: item.data?.action,
            category: item.data?.category
          });

          const existing = behaviorMap.get(behavior) || { count: 0, sites: new Set(), examples: [] };
          existing.count++;
          existing.sites.add(item.site);
          existing.examples.push(item.data);
          behaviorMap.set(behavior, existing);
        }

        for (const [behavior, details] of behaviorMap) {
          if (details.count >= minOccurrence && details.sites.size > 1) {
            const pattern = {
              patternId: crypto.randomBytes(8).toString('hex'),
              type: 'BEHAVIORAL',
              pattern: JSON.parse(behavior),
              occurrences: details.count,
              sites: [...details.sites],
              confidence: Math.min(1.0, details.count / allEvidence.length),
              timestamp: new Date().toISOString()
            };
            commonPatterns.push(pattern);
            correlationState.patterns.push(pattern);
          }
        }
      }

      // Find temporal patterns
      if (patternType === 'TEMPORAL' || patternType === 'NETWORK') {
        const timeRanges = new Map();

        for (const item of allEvidence) {
          if (item.timestamp) {
            const hour = new Date(item.timestamp).getHours();
            const key = `HOUR_${hour}`;
            const existing = timeRanges.get(key) || { count: 0, sites: new Set() };
            existing.count++;
            existing.sites.add(item.site);
            timeRanges.set(key, existing);
          }
        }

        for (const [timeRange, details] of timeRanges) {
          if (details.count >= minOccurrence && details.sites.size > 1) {
            commonPatterns.push({
              patternId: crypto.randomBytes(8).toString('hex'),
              type: 'TEMPORAL',
              pattern: { timeRange },
              occurrences: details.count,
              sites: [...details.sites],
              confidence: Math.min(1.0, details.count / allEvidence.length),
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      // Find content patterns
      if (patternType === 'CONTENT' || patternType === 'NETWORK') {
        const contentMap = new Map();

        for (const item of allEvidence) {
          const content = item.data?.content || item.data?.text || '';
          const contentType = typeof content === 'string' ? content.substring(0, 50) : JSON.stringify(content);

          const existing = contentMap.get(contentType) || { count: 0, sites: new Set() };
          existing.count++;
          existing.sites.add(item.site);
          contentMap.set(contentType, existing);
        }

        for (const [content, details] of contentMap) {
          if (details.count >= minOccurrence && details.sites.size > 1) {
            commonPatterns.push({
              patternId: crypto.randomBytes(8).toString('hex'),
              type: 'CONTENT',
              pattern: { contentSample: content },
              occurrences: details.count,
              sites: [...details.sites],
              confidence: Math.min(1.0, details.count / allEvidence.length),
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      return {
        success: true,
        commonPatterns: commonPatterns,
        patternSummary: {
          totalPatternsFound: commonPatterns.length,
          byType: commonPatterns.reduce((acc, p) => {
            acc[p.type] = (acc[p.type] || 0) + 1;
            return acc;
          }, {}),
          averageOccurrences: commonPatterns.length > 0
            ? commonPatterns.reduce((sum, p) => sum + p.occurrences, 0) / commonPatterns.length
            : 0,
          averageConfidence: commonPatterns.length > 0
            ? commonPatterns.reduce((sum, p) => sum + p.confidence, 0) / commonPatterns.length
            : 0
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Helper: Update correlation graph with new correlation
   */
  function _updateCorrelationGraph(source, target, score) {
    // Check if nodes exist
    let sourceNode = correlationState.correlationGraph.nodes.find(n => n.id === source);
    let targetNode = correlationState.correlationGraph.nodes.find(n => n.id === target);

    if (!sourceNode) {
      sourceNode = { id: source, siteUrl: source };
      correlationState.correlationGraph.nodes.push(sourceNode);
    }
    if (!targetNode) {
      targetNode = { id: target, siteUrl: target };
      correlationState.correlationGraph.nodes.push(targetNode);
    }

    // Add or update edge
    const existingEdge = correlationState.correlationGraph.edges.find(
      e => (e.source === source && e.target === target) || (e.source === target && e.target === source)
    );

    if (existingEdge) {
      existingEdge.weight = Math.max(existingEdge.weight, score);
    } else {
      correlationState.correlationGraph.edges.push({
        source: source,
        target: target,
        weight: score
      });
    }
  }
}

module.exports = {
  registerEvidenceCorrelationCommands
};
