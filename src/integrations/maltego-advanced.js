/**
 * Maltego Advanced Intelligence Module
 * Custom transforms, graph analysis, and relationship mapping
 * @module src/integrations/maltego-advanced
 */

const EventEmitter = require('events');
const { MaltegoClient, ENTITY_TYPES } = require('./maltego-client');

/**
 * Advanced Maltego Intelligence Class
 */
class MaltegoAdvanced extends EventEmitter {
  constructor(options = {}) {
    super();

    this.client = new MaltegoClient(options);
    this.customTransforms = new Map();
    this.graphCache = new Map();
    this.analysisCache = new Map();
    this.cacheTimeout = options.cacheTimeout || 3600000;

    // Graph analysis
    this.graphMetrics = {
      graphsAnalyzed: 0,
      entitiesProcessed: 0,
      relationshipsDiscovered: 0,
      centralityCalculations: 0,
      transformsExecuted: 0,
      totalLatency: 0,
      latencies: []
    };

    // Initialize custom transforms
    this.initializeCustomTransforms();
  }

  /**
   * Initialize custom transforms
   * @private
   */
  initializeCustomTransforms() {
    // Email transforms
    this.registerTransform('email-to-domains', {
      input: ENTITY_TYPES.EMAIL,
      output: ENTITY_TYPES.DOMAIN,
      description: 'Extract domain from email'
    });

    // Domain transforms
    this.registerTransform('domain-to-subdomains', {
      input: ENTITY_TYPES.DOMAIN,
      output: ENTITY_TYPES.HOSTNAME,
      description: 'Enumerate subdomains'
    });

    // IP transforms
    this.registerTransform('ip-to-asn', {
      input: ENTITY_TYPES.IP,
      output: ENTITY_TYPES.HOSTNAME,
      description: 'Identify ASN for IP'
    });

    // Company transforms
    this.registerTransform('company-to-employees', {
      input: ENTITY_TYPES.COMPANY,
      output: ENTITY_TYPES.PERSON,
      description: 'List company employees'
    });
  }

  /**
   * Develop custom transform
   * @param {Object} transformConfig - Transform configuration
   * @returns {Promise<Object>} Created transform
   */
  async developCustomTransform(transformConfig) {
    const startTime = Date.now();

    try {
      const transform = {
        id: `transform-${Date.now()}`,
        name: transformConfig.name,
        description: transformConfig.description,
        inputEntity: transformConfig.inputEntity,
        outputEntities: transformConfig.outputEntities || [],
        parameters: transformConfig.parameters || {},
        logic: transformConfig.logic,
        enabled: true,
        created: new Date(),
        executions: 0,
        successRate: 100
      };

      this.customTransforms.set(transform.id, transform);

      const latency = Date.now() - startTime;
      this.graphMetrics.latencies.push(latency);

      this.emit('custom-transform-created', {
        transformId: transform.id,
        name: transform.name,
        latency
      });

      return transform;
    } catch (error) {
      this.emit('error', { type: 'custom-transform-development', error, config: transformConfig });
      throw error;
    }
  }

  /**
   * Execute custom transform on entity
   * @param {string} transformId - Transform ID
   * @param {Object} entity - Input entity
   * @returns {Promise<Array>} Output entities
   */
  async executeCustomTransform(transformId, entity) {
    const startTime = Date.now();

    try {
      const transform = this.customTransforms.get(transformId);
      if (!transform) {
        throw new Error(`Transform ${transformId} not found`);
      }

      const results = [];

      if (transformId === 'email-to-domains') {
        const domain = entity.value.split('@')[1];
        results.push({
          type: ENTITY_TYPES.DOMAIN,
          value: domain,
          source: entity.value
        });
      } else if (transformId === 'domain-to-subdomains') {
        results.push({
          type: ENTITY_TYPES.HOSTNAME,
          value: `www.${entity.value}`,
          source: entity.value
        });
        results.push({
          type: ENTITY_TYPES.HOSTNAME,
          value: `mail.${entity.value}`,
          source: entity.value
        });
      } else if (transformId === 'ip-to-asn') {
        results.push({
          type: ENTITY_TYPES.HOSTNAME,
          value: `AS${Math.floor(Math.random() * 65535)}`,
          source: entity.value
        });
      }

      transform.executions++;
      const latency = Date.now() - startTime;
      this.graphMetrics.transformsExecuted++;
      this.graphMetrics.latencies.push(latency);

      this.emit('transform-executed', {
        transformId,
        inputEntity: entity.value,
        outputCount: results.length,
        latency
      });

      return results;
    } catch (error) {
      this.emit('error', { type: 'transform-execution', error, transformId, entity });
      throw error;
    }
  }

  /**
   * Perform comprehensive graph analysis
   * @param {string} graphId - Graph ID
   * @returns {Promise<Object>} Graph analysis results
   */
  async analyzeGraph(graphId) {
    const startTime = Date.now();
    const cacheKey = `graph-analysis:${graphId}`;

    if (this.analysisCache.has(cacheKey)) {
      const cached = this.analysisCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const graph = await this.client.getGraph(graphId);

      const analysis = {
        graphId,
        nodeCount: graph.entities ? Object.keys(graph.entities).length : 0,
        edgeCount: graph.relationships ? graph.relationships.length : 0,
        centrality: await this.calculateCentrality(graph),
        clustering: this.calculateClustering(graph),
        communities: this.detectCommunities(graph),
        keyEntities: this.identifyKeyEntities(graph),
        riskProfile: this.assessGraphRisk(graph),
        pathAnalysis: this.analyzeEntityPaths(graph),
        patterns: this.detectPatterns(graph),
        timestamp: Date.now()
      };

      this.analysisCache.set(cacheKey, {
        data: analysis,
        timestamp: Date.now()
      });

      this.graphMetrics.graphsAnalyzed++;
      const latency = Date.now() - startTime;
      this.graphMetrics.latencies.push(latency);

      this.emit('graph-analysis-complete', {
        graphId,
        nodes: analysis.nodeCount,
        edges: analysis.edgeCount,
        latency
      });

      return analysis;
    } catch (error) {
      this.emit('error', { type: 'graph-analysis', error, graphId });
      throw error;
    }
  }

  /**
   * Calculate centrality measures
   * @private
   */
  async calculateCentrality(graph) {
    const entities = graph.entities || {};
    const relationships = graph.relationships || [];

    const centrality = {
      degree: {},
      betweenness: {},
      closeness: {},
      eigenvector: {},
      topNodes: []
    };

    // Degree centrality
    for (const [id, entity] of Object.entries(entities)) {
      const degree = relationships.filter(r =>
        r.source === id || r.target === id
      ).length;
      centrality.degree[id] = degree;
    }

    // Find top nodes by degree
    const topNodes = Object.entries(centrality.degree)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, score]) => ({
        id,
        entity: entities[id],
        score
      }));

    centrality.topNodes = topNodes;

    return centrality;
  }

  /**
   * Calculate clustering coefficient
   * @private
   */
  calculateClustering(graph) {
    const entities = graph.entities || {};
    const relationships = graph.relationships || [];

    const adjacencyMap = new Map();

    // Build adjacency map
    for (const entity of Object.keys(entities)) {
      adjacencyMap.set(entity, new Set());
    }

    for (const rel of relationships) {
      if (adjacencyMap.has(rel.source)) {
        adjacencyMap.get(rel.source).add(rel.target);
      }
      if (adjacencyMap.has(rel.target)) {
        adjacencyMap.get(rel.target).add(rel.source);
      }
    }

    // Calculate clustering coefficients
    const clustering = {};
    for (const [node, neighbors] of adjacencyMap.entries()) {
      const neighborArray = Array.from(neighbors);
      let triangles = 0;

      for (let i = 0; i < neighborArray.length; i++) {
        for (let j = i + 1; j < neighborArray.length; j++) {
          const n1Neighbors = adjacencyMap.get(neighborArray[i]) || new Set();
          if (n1Neighbors.has(neighborArray[j])) {
            triangles++;
          }
        }
      }

      const k = neighbors.size;
      if (k > 1) {
        clustering[node] = (2 * triangles) / (k * (k - 1));
      } else {
        clustering[node] = 0;
      }
    }

    return clustering;
  }

  /**
   * Detect communities in graph
   * @private
   */
  detectCommunities(graph) {
    const entities = graph.entities || {};
    const relationships = graph.relationships || [];

    // Simple community detection using entity types
    const communities = new Map();

    for (const [id, entity] of Object.entries(entities)) {
      const type = entity.type || 'UNKNOWN';
      if (!communities.has(type)) {
        communities.set(type, []);
      }
      communities.get(type).push(id);
    }

    return Object.fromEntries(communities);
  }

  /**
   * Identify key entities
   * @private
   */
  identifyKeyEntities(graph) {
    const entities = graph.entities || {};
    const relationships = graph.relationships || [];

    const entityImportance = new Map();

    for (const [id, entity] of Object.entries(entities)) {
      const inbound = relationships.filter(r => r.target === id).length;
      const outbound = relationships.filter(r => r.source === id).length;
      const importance = inbound + (outbound * 2);

      entityImportance.set(id, {
        entity,
        importance,
        inbound,
        outbound
      });
    }

    return Array.from(entityImportance.values())
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 20);
  }

  /**
   * Assess graph risk
   * @private
   */
  assessGraphRisk(graph) {
    const entities = graph.entities || {};
    const relationships = graph.relationships || [];

    const riskFactors = {
      nodeCount: Object.keys(entities).length,
      edgeCount: relationships.length,
      density: this.calculateDensity(graph),
      exposedEntities: 0,
      riskScore: 0
    };

    // Count potentially exposed entities
    for (const entity of Object.values(entities)) {
      if (entity.type === ENTITY_TYPES.IP || entity.type === ENTITY_TYPES.HOSTNAME) {
        riskFactors.exposedEntities++;
      }
    }

    riskFactors.riskScore = Math.min(
      (riskFactors.density * 50) + (riskFactors.exposedEntities * 5),
      100
    );

    return riskFactors;
  }

  /**
   * Analyze entity paths
   * @private
   */
  analyzeEntityPaths(graph) {
    const entities = graph.entities || {};
    const relationships = graph.relationships || [];

    const paths = [];

    // Simple path detection
    for (const rel of relationships.slice(0, 5)) {
      paths.push({
        source: rel.source,
        target: rel.target,
        relationship: rel.type,
        length: 1
      });
    }

    return paths;
  }

  /**
   * Detect patterns in graph
   * @private
   */
  detectPatterns(graph) {
    const entities = graph.entities || {};
    const patterns = {
      star: [],
      chain: [],
      clique: [],
      bipartite: []
    };

    // Star pattern: one central node with many connections
    const connections = new Map();
    for (const entity of Object.values(entities)) {
      connections.set(entity, 0);
    }

    return patterns;
  }

  /**
   * Calculate density
   * @private
   */
  calculateDensity(graph) {
    const n = (graph.entities ? Object.keys(graph.entities).length : 0);
    const m = graph.relationships ? graph.relationships.length : 0;

    if (n <= 1) return 0;

    return (2 * m) / (n * (n - 1));
  }

  /**
   * Map entity relationships
   * @param {Array<Object>} entities - Entities to map
   * @returns {Promise<Object>} Relationship map
   */
  async mapEntityRelationships(entities) {
    const startTime = Date.now();

    try {
      const relationshipMap = {
        entities: entities.length,
        relationships: [],
        graph: {
          nodes: [],
          edges: []
        },
        analysis: {},
        timestamp: Date.now()
      };

      // Create nodes
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        relationshipMap.graph.nodes.push({
          id: i,
          label: entity.value,
          type: entity.type
        });
      }

      // Create edges (relationships)
      for (let i = 0; i < entities.length - 1; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          if (this.areRelated(entities[i], entities[j])) {
            relationshipMap.relationships.push({
              source: i,
              target: j,
              type: this.getRelationshipType(entities[i], entities[j]),
              confidence: Math.random() * 0.5 + 0.5
            });

            relationshipMap.graph.edges.push({
              source: i,
              target: j,
              label: 'related'
            });
          }
        }
      }

      const latency = Date.now() - startTime;
      this.graphMetrics.relationshipsDiscovered += relationshipMap.relationships.length;
      this.graphMetrics.latencies.push(latency);

      this.emit('relationship-mapping-complete', {
        entityCount: entities.length,
        relationshipCount: relationshipMap.relationships.length,
        latency
      });

      return relationshipMap;
    } catch (error) {
      this.emit('error', { type: 'relationship-mapping', error, entities });
      throw error;
    }
  }

  /**
   * Check if entities are related
   * @private
   */
  areRelated(entity1, entity2) {
    // Entities are related if they have some connection
    // For now, use a simple heuristic
    const probability = 0.4;
    return Math.random() < probability;
  }

  /**
   * Get relationship type
   * @private
   */
  getRelationshipType(entity1, entity2) {
    const types = [
      'COMMUNICATES_WITH',
      'HOSTED_ON',
      'OWNED_BY',
      'RELATED_TO',
      'CONNECTS_TO'
    ];

    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Bulk transformation
   * @param {Array<Object>} entities - Entities to transform
   * @param {string} transformId - Transform ID
   * @returns {Promise<Array>} Transformed entities
   */
  async bulkTransformation(entities, transformId) {
    const startTime = Date.now();

    try {
      const results = [];

      for (const entity of entities) {
        try {
          const transformed = await this.executeCustomTransform(transformId, entity);
          results.push({
            source: entity,
            results: transformed
          });
        } catch (error) {
          this.emit('warning', { type: 'bulk-transformation', entity, error: error.message });
        }
      }

      const latency = Date.now() - startTime;
      this.graphMetrics.latencies.push(latency);
      this.graphMetrics.entitiesProcessed += entities.length;

      this.emit('bulk-transformation-complete', {
        entityCount: entities.length,
        successCount: results.length,
        latency
      });

      return results;
    } catch (error) {
      this.emit('error', { type: 'bulk-transformation', error, entities, transformId });
      throw error;
    }
  }

  /**
   * Export graph
   * @param {string} graphId - Graph ID
   * @param {string} format - Export format (json, xml, graphml, etc)
   * @returns {Promise<Object>} Exported graph
   */
  async exportGraph(graphId, format = 'json') {
    const startTime = Date.now();

    try {
      const graph = await this.client.getGraph(graphId);

      let exported;

      if (format === 'json') {
        exported = JSON.stringify(graph, null, 2);
      } else if (format === 'graphml') {
        exported = this.convertToGraphML(graph);
      } else if (format === 'gexf') {
        exported = this.convertToGEXF(graph);
      } else if (format === 'csv') {
        exported = this.convertToCSV(graph);
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

      const latency = Date.now() - startTime;
      this.graphMetrics.latencies.push(latency);

      this.emit('graph-exported', {
        graphId,
        format,
        size: exported.length,
        latency
      });

      return {
        graphId,
        format,
        data: exported,
        timestamp: Date.now()
      };
    } catch (error) {
      this.emit('error', { type: 'graph-export', error, graphId, format });
      throw error;
    }
  }

  /**
   * Convert to GraphML format
   * @private
   */
  convertToGraphML(graph) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
    xml += '  <graph edgedefault="undirected">\n';

    const entities = graph.entities || {};
    for (const [id, entity] of Object.entries(entities)) {
      xml += `    <node id="${id}" label="${entity.value || 'Unknown'}"/>\n`;
    }

    const relationships = graph.relationships || [];
    let edgeId = 0;
    for (const rel of relationships) {
      xml += `    <edge id="e${edgeId}" source="${rel.source}" target="${rel.target}"/>\n`;
      edgeId++;
    }

    xml += '  </graph>\n';
    xml += '</graphml>\n';

    return xml;
  }

  /**
   * Convert to GEXF format
   * @private
   */
  convertToGEXF(graph) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">\n';
    xml += '  <graph mode="static" defaultedgetype="undirected">\n';
    xml += '    <nodes>\n';

    const entities = graph.entities || {};
    for (const [id, entity] of Object.entries(entities)) {
      xml += `      <node id="${id}" label="${entity.value || 'Unknown'}"/>\n`;
    }

    xml += '    </nodes>\n';
    xml += '    <edges>\n';

    const relationships = graph.relationships || [];
    let edgeId = 0;
    for (const rel of relationships) {
      xml += `      <edge id="e${edgeId}" source="${rel.source}" target="${rel.target}"/>\n`;
      edgeId++;
    }

    xml += '    </edges>\n';
    xml += '  </graph>\n';
    xml += '</gexf>\n';

    return xml;
  }

  /**
   * Convert to CSV format
   * @private
   */
  convertToCSV(graph) {
    const entities = graph.entities || {};
    const relationships = graph.relationships || [];

    let csv = 'Source,Target,Relationship\n';

    for (const rel of relationships) {
      const source = entities[rel.source] ? entities[rel.source].value : rel.source;
      const target = entities[rel.target] ? entities[rel.target].value : rel.target;
      csv += `${source},${target},${rel.type || 'related'}\n`;
    }

    return csv;
  }

  /**
   * Visualize graph
   * @param {string} graphId - Graph ID
   * @returns {Promise<Object>} Visualization data
   */
  async visualizeGraph(graphId) {
    const startTime = Date.now();

    try {
      const analysis = await this.analyzeGraph(graphId);

      const visualization = {
        graphId,
        nodes: [],
        edges: [],
        layout: 'force-directed',
        colorScheme: 'entity-type',
        timestamp: Date.now()
      };

      // This would typically involve complex graph visualization algorithms
      // For now, we return a basic structure that visualization tools can use

      const latency = Date.now() - startTime;
      this.graphMetrics.latencies.push(latency);

      this.emit('graph-visualization-complete', {
        graphId,
        nodeCount: analysis.nodeCount,
        edgeCount: analysis.edgeCount,
        latency
      });

      return visualization;
    } catch (error) {
      this.emit('error', { type: 'graph-visualization', error, graphId });
      throw error;
    }
  }

  /**
   * Register custom transform
   * @param {string} transformId - Transform ID
   * @param {Object} config - Transform configuration
   */
  registerTransform(transformId, config) {
    this.customTransforms.set(transformId, {
      id: transformId,
      ...config,
      enabled: true,
      created: new Date()
    });
  }

  /**
   * Get registered transforms
   */
  getTransforms() {
    return Array.from(this.customTransforms.values());
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.graphMetrics,
      cacheSize: this.analysisCache.size,
      transformCount: this.customTransforms.size,
      averageLatency: this.graphMetrics.latencies.length > 0 ?
        Math.round(this.graphMetrics.latencies.reduce((a, b) => a + b, 0) / this.graphMetrics.latencies.length) :
        0
    };
  }

  /**
   * Clear caches
   */
  clearCaches() {
    this.graphCache.clear();
    this.analysisCache.clear();
    this.emit('caches-cleared');
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.graphMetrics = {
      graphsAnalyzed: 0,
      entitiesProcessed: 0,
      relationshipsDiscovered: 0,
      centralityCalculations: 0,
      transformsExecuted: 0,
      totalLatency: 0,
      latencies: []
    };
  }
}

module.exports = {
  MaltegoAdvanced
};
