/**
 * WebSocket Commands for Data Correlation & Pattern Detection
 *
 * Feature Area: Export & Analysis - Category 4
 *
 * Provides WebSocket commands for:
 * - Similarity analysis (find_similar_elements)
 * - Pattern extraction (detect_patterns)
 * - Data correlation (correlate_data)
 * - Relationship visualization (build_link_graph)
 * - Text analytics (text_analytics)
 * - Anomaly detection (anomaly_detection)
 * - Data clustering (cluster_data)
 * - Automatic insights (generate_insights)
 *
 * @module websocket/commands/correlation-commands
 */

const PatternDetectionEngine = require('../../../../src/analysis/pattern-detection');

// Global pattern detection instance
let patternEngine = null;

/**
 * Initialize pattern engine if needed
 */
function _initPatternEngine(options = {}) {
  if (!patternEngine) {
    patternEngine = new PatternDetectionEngine(options);
  }
  return patternEngine;
}

/**
 * Register data correlation & pattern detection WebSocket commands
 */
function registerCorrelationCommands(server, mainWindow) {
  const commandHandlers = server.commandHandlers || server;

  /**
   * Find similar elements in dataset
   *
   * Command: find_similar_elements
   * Params: {
   *   data: Array,
   *   field: string,
   *   threshold?: number (0-1),
   *   options?: {}
   * }
   * Response: {
   *   groups: [{
   *     similarity: number,
   *     count: number,
   *     elements: Array,
   *     representative: object
   *   }],
   *   summary: {}
   * }
   */
  commandHandlers.find_similar_elements = async (params) => {
    try {
      if (!params.data || !Array.isArray(params.data)) {
        throw new Error('data must be an array');
      }
      if (!params.field || typeof params.field !== 'string') {
        throw new Error('field must be a string');
      }

      const engine = _initPatternEngine();
      const groups = engine.findSimilarElements(
        params.data,
        params.field,
        params.threshold
      );

      return {
        success: true,
        groups: groups,
        summary: {
          totalElements: params.data.length,
          groupsFound: groups.length,
          largestGroup: groups.length > 0 ? groups[0].count : 0,
          averageGroupSize: groups.length > 0
            ? groups.reduce((sum, g) => sum + g.count, 0) / groups.length
            : 0
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Detect patterns in data
   *
   * Command: detect_patterns
   * Params: {
   *   data: Array,
   *   options?: {
   *     minOccurrence?: number,
   *     maxPatterns?: number
   *   }
   * }
   * Response: {
   *   patterns: [{
   *     id: string,
   *     type: string,
   *     pattern: any,
   *     occurrences: number,
   *     confidence: number,
   *     examples: Array
   *   }],
   *   summary: {}
   * }
   */
  commandHandlers.detect_patterns = async (params) => {
    try {
      if (!params.data || !Array.isArray(params.data)) {
        throw new Error('data must be an array');
      }

      const engine = _initPatternEngine();
      const patterns = engine.detectPatterns(params.data, params.options);

      return {
        success: true,
        patterns: patterns,
        summary: {
          totalDataPoints: params.data.length,
          patternsDetected: patterns.length,
          topConfidence: patterns.length > 0 ? patterns[0].confidence : 0,
          averageConfidence: patterns.length > 0
            ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
            : 0
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Correlate data across multiple datasets
   *
   * Command: correlate_data
   * Params: {
   *   datasets: {
   *     [name: string]: Array
   *   },
   *   options?: {}
   * }
   * Response: {
   *   correlations: Array,
   *   strongLinks: Array,
   *   weakLinks: Array,
   *   correlationMatrix: {},
   *   summary: {}
   * }
   */
  commandHandlers.correlate_data = async (params) => {
    try {
      if (!params.datasets || typeof params.datasets !== 'object') {
        throw new Error('datasets must be an object with named arrays');
      }

      const engine = _initPatternEngine();
      const result = engine.correlateData(params.datasets, params.options);

      return {
        success: true,
        correlations: result.correlations,
        strongLinks: result.strongLinks,
        weakLinks: result.weakLinks,
        correlationMatrix: result.correlationMatrix,
        summary: result.summary
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Build link graph from data
   *
   * Command: build_link_graph
   * Params: {
   *   data: Array,
   *   idField: string,
   *   relationField: string
   * }
   * Response: {
   *   nodes: Array,
   *   edges: Array,
   *   adjacencyList: {},
   *   stats: {}
   * }
   */
  commandHandlers.build_link_graph = async (params) => {
    try {
      if (!params.data || !Array.isArray(params.data)) {
        throw new Error('data must be an array');
      }
      if (!params.idField || typeof params.idField !== 'string') {
        throw new Error('idField must be a string');
      }
      if (!params.relationField || typeof params.relationField !== 'string') {
        throw new Error('relationField must be a string');
      }

      const engine = _initPatternEngine();
      const graph = engine.buildLinkGraph(
        params.data,
        params.idField,
        params.relationField
      );

      return {
        success: true,
        nodes: graph.nodes,
        edges: graph.edges,
        adjacencyList: graph.adjacencyList,
        stats: graph.stats
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Text analytics
   *
   * Command: text_analytics
   * Params: {
   *   text: string|Array,
   *   options?: {
   *     extractEntities?: boolean,
   *     extractPhrases?: boolean
   *   }
   * }
   * Response: {
   *   wordFrequency: {},
   *   phraseFrequency: {},
   *   statistics: {},
   *   sentiment: {},
   *   entities: {}
   * }
   */
  commandHandlers.text_analytics = async (params) => {
    try {
      if (!params.text) {
        throw new Error('text is required');
      }

      const engine = _initPatternEngine();
      const analysis = engine.textAnalytics(params.text, params.options);

      return {
        success: true,
        wordFrequency: analysis.wordFrequency,
        phraseFrequency: analysis.phraseFrequency,
        statistics: analysis.statistics,
        sentiment: analysis.sentiment,
        entities: analysis.entities
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Detect anomalies in data
   *
   * Command: anomaly_detection
   * Params: {
   *   data: Array,
   *   field: string,
   *   options?: {
   *     deviation?: number
   *   }
   * }
   * Response: {
   *   anomalies: Array,
   *   statistics: {}
   * }
   */
  commandHandlers.anomaly_detection = async (params) => {
    try {
      if (!params.data || !Array.isArray(params.data)) {
        throw new Error('data must be an array');
      }
      if (!params.field || typeof params.field !== 'string') {
        throw new Error('field must be a string');
      }

      const engine = _initPatternEngine();
      const result = engine.anomalyDetection(
        params.data,
        params.field,
        params.options
      );

      return {
        success: true,
        anomalies: result.anomalies,
        statistics: result.statistics
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Cluster similar data
   *
   * Command: cluster_data
   * Params: {
   *   data: Array,
   *   field: string,
   *   options?: {
   *     threshold?: number
   *   }
   * }
   * Response: {
   *   clusters: Array,
   *   summary: {}
   * }
   */
  commandHandlers.cluster_data = async (params) => {
    try {
      if (!params.data || !Array.isArray(params.data)) {
        throw new Error('data must be an array');
      }
      if (!params.field || typeof params.field !== 'string') {
        throw new Error('field must be a string');
      }

      const engine = _initPatternEngine();
      const clusters = engine.clusterData(params.data, params.field, params.options);

      return {
        success: true,
        clusters: clusters,
        summary: {
          totalElements: params.data.length,
          clustersCreated: clusters.length,
          largestCluster: clusters.length > 0 ? clusters[0].size : 0,
          averageClusterSize: clusters.length > 0
            ? clusters.reduce((sum, c) => sum + c.size, 0) / clusters.length
            : 0
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Generate insights from analysis
   *
   * Command: generate_insights
   * Params: {
   *   analysisResults: {
   *     similarElements?: Array,
   *     patterns?: Array,
   *     correlations?: Object,
   *     anomalies?: Object
   *   }
   * }
   * Response: {
   *   insights: Array,
   *   summary: {}
   * }
   */
  commandHandlers.generate_insights = async (params) => {
    try {
      if (!params.analysisResults || typeof params.analysisResults !== 'object') {
        throw new Error('analysisResults must be an object');
      }

      const engine = _initPatternEngine();
      const insights = engine.generateInsights(params.analysisResults);

      // Categorize insights
      const categorized = {
        similarity: insights.filter(i => i.type === 'similarity'),
        pattern: insights.filter(i => i.type === 'pattern'),
        correlation: insights.filter(i => i.type === 'correlation'),
        anomaly: insights.filter(i => i.type === 'anomaly')
      };

      return {
        success: true,
        insights: insights,
        categorized: categorized,
        summary: {
          totalInsights: insights.length,
          byCategory: {
            similarity: categorized.similarity.length,
            pattern: categorized.pattern.length,
            correlation: categorized.correlation.length,
            anomaly: categorized.anomaly.length
          },
          actionableInsights: insights.filter(i => i.actionable).length
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Clear pattern engine cache
   *
   * Command: clear_correlation_cache
   * Params: {}
   * Response: { success: true }
   */
  commandHandlers.clear_correlation_cache = async (params) => {
    try {
      const engine = _initPatternEngine();
      engine.clearCache();

      return { success: true, message: 'Cache cleared' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get correlation engine status
   *
   * Command: get_correlation_status
   * Params: {}
   * Response: { status: string, cacheSize: number }
   */
  commandHandlers.get_correlation_status = async (params) => {
    try {
      const engine = _initPatternEngine();

      return {
        success: true,
        status: 'ready',
        engine: {
          initialized: true,
          cacheSize: engine.cache.size,
          patternsStored: engine.patterns.size,
          correlationsStored: engine.correlations.size
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

module.exports = {
  registerCorrelationCommands,
  PatternDetectionEngine
};
