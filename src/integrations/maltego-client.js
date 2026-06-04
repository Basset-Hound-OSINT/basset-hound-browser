/**
 * Maltego Integration Client
 * Integrates with Maltego Graph API for OSINT data transformation and analysis
 * @module src/integrations/maltego-client
 */

const EventEmitter = require('events');
const https = require('https');

/**
 * Entity Types in Maltego
 */
const ENTITY_TYPES = {
  EMAIL: 'maltego.EmailAddress',
  DOMAIN: 'maltego.Domain',
  HOSTNAME: 'maltego.Hostname',
  IP: 'maltego.IPv4Address',
  PHONE: 'maltego.PhoneNumber',
  PERSON: 'maltego.Person',
  COMPANY: 'maltego.Company',
  DOCUMENT: 'maltego.Document',
  WEBSITE: 'maltego.Website',
  URL: 'maltego.URL',
  HASH: 'maltego.Hash',
  FILE: 'maltego.File'
};

/**
 * Maltego Client Class
 */
class MaltegoClient extends EventEmitter {
  constructor(options = {}) {
    super();

    this.baseUrl = options.baseUrl || 'https://caseapi.maltego.com/api';
    this.apiKey = options.apiKey || process.env.MALTEGO_API_KEY;
    this.apiSecret = options.apiSecret || process.env.MALTEGO_API_SECRET;
    this.timeout = options.timeout || 20000;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.cache = new Map();
    this.cacheTimeout = options.cacheTimeout || 3600000; // 1 hour
    this.workspaces = new Map(); // workspaceId -> workspace data
    this.graphs = new Map(); // graphId -> graph data
    this.entities = new Map(); // entityId -> entity data

    // Metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cachedRequests: 0,
      totalLatency: 0,
      transformsExecuted: 0,
      entitiesProcessed: 0,
      apiErrors: new Map()
    };
  }

  /**
   * Create or get workspace
   * @param {Object} workspaceConfig - Workspace configuration
   * @returns {Promise<Object>} Workspace object
   */
  async createWorkspace(workspaceConfig) {
    const payload = {
      name: workspaceConfig.name || `workspace-${Date.now()}`,
      description: workspaceConfig.description || 'OSINT Analysis Workspace'
    };

    try {
      const startTime = Date.now();
      const workspace = await this.makeRequest('/workspaces', 'POST', payload);
      const latency = Date.now() - startTime;

      this.workspaces.set(workspace.id, {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        created: new Date(),
        graphs: [],
        metadata: {
          totalEntities: 0,
          totalRelationships: 0
        }
      });

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;

      this.emit('workspace-created', {
        workspaceId: workspace.id,
        name: workspace.name,
        latency
      });

      return workspace;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('createWorkspace', error);
      throw error;
    }
  }

  /**
   * Create a graph/investigation in a workspace
   * @param {string} workspaceId - Workspace ID
   * @param {Object} graphConfig - Graph configuration
   * @returns {Promise<Object>} Graph object
   */
  async createGraph(workspaceId, graphConfig) {
    if (!this.workspaces.has(workspaceId)) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const payload = {
      name: graphConfig.name || `graph-${Date.now()}`,
      description: graphConfig.description || 'Analysis Graph'
    };

    try {
      const startTime = Date.now();
      const graph = await this.makeRequest(
        `/workspaces/${workspaceId}/graphs`,
        'POST',
        payload
      );
      const latency = Date.now() - startTime;

      const graphData = {
        id: graph.id,
        workspaceId,
        name: graph.name,
        description: graph.description,
        created: new Date(),
        entities: [],
        links: [],
        metadata: {
          entityCount: 0,
          linkCount: 0
        }
      };

      this.graphs.set(graph.id, graphData);

      const workspace = this.workspaces.get(workspaceId);
      if (!workspace.graphs.includes(graph.id)) {
        workspace.graphs.push(graph.id);
      }

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;

      this.emit('graph-created', {
        graphId: graph.id,
        workspaceId,
        name: graph.name,
        latency
      });

      return graphData;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('createGraph', error);
      throw error;
    }
  }

  /**
   * Add entity to graph
   * @param {string} graphId - Graph ID
   * @param {Object} entityConfig - Entity configuration
   * @returns {Promise<Object>} Entity object
   */
  async addEntity(graphId, entityConfig) {
    if (!this.graphs.has(graphId)) {
      throw new Error(`Graph ${graphId} not found`);
    }

    const payload = {
      type: entityConfig.type || ENTITY_TYPES.DOMAIN,
      value: entityConfig.value,
      label: entityConfig.label || entityConfig.value,
      color: entityConfig.color || '#4a90e2',
      notes: entityConfig.notes || '',
      properties: entityConfig.properties || {}
    };

    try {
      const startTime = Date.now();
      const entity = await this.makeRequest(
        `/graphs/${graphId}/entities`,
        'POST',
        payload
      );
      const latency = Date.now() - startTime;

      const entityData = {
        id: entity.id,
        graphId,
        type: payload.type,
        value: payload.value,
        label: payload.label,
        color: payload.color,
        created: new Date(),
        properties: payload.properties,
        relationships: []
      };

      this.entities.set(entity.id, entityData);

      const graph = this.graphs.get(graphId);
      if (!graph.entities.includes(entity.id)) {
        graph.entities.push(entity.id);
        graph.metadata.entityCount++;
      }

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;
      this.metrics.entitiesProcessed++;

      this.emit('entity-added', {
        entityId: entity.id,
        graphId,
        type: payload.type,
        value: payload.value,
        latency
      });

      return entityData;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('addEntity', error);
      throw error;
    }
  }

  /**
   * Run transformation on entity
   * @param {string} entityId - Entity ID
   * @param {string} transformName - Transform name/ID
   * @param {Object} options - Transform options
   * @returns {Promise<Object>} Transform results
   */
  async runTransform(entityId, transformName, options = {}) {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity ${entityId} not found`);
    }

    const entity = this.entities.get(entityId);
    const payload = {
      transform: transformName,
      parameters: options.parameters || {},
      config: {
        executeInBackground: options.background !== false,
        timeout: options.timeout || 30000
      }
    };

    try {
      const startTime = Date.now();
      const result = await this.makeRequest(
        `/entities/${entityId}/transforms`,
        'POST',
        payload
      );
      const latency = Date.now() - startTime;

      const transformResult = {
        entityId,
        transformName,
        status: result.status || 'completed',
        entities: result.entities || [],
        links: result.links || [],
        newEntityCount: (result.entities || []).length,
        newLinkCount: (result.links || []).length,
        timestamp: Date.now(),
        latency
      };

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;
      this.metrics.transformsExecuted++;

      // Store new entities
      const graphId = entity.graphId;
      if (graphId && this.graphs.has(graphId)) {
        const graph = this.graphs.get(graphId);
        result.entities?.forEach(newEntity => {
          this.entities.set(newEntity.id, {
            ...newEntity,
            graphId,
            created: new Date(),
            relationships: []
          });
          graph.entities.push(newEntity.id);
          graph.metadata.entityCount++;
        });
      }

      this.emit('transform-completed', {
        entityId,
        transformName,
        resultCount: transformResult.newEntityCount,
        latency
      });

      return transformResult;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('runTransform', error);
      throw error;
    }
  }

  /**
   * Create relationship/link between entities
   * @param {string} graphId - Graph ID
   * @param {string} fromEntityId - From entity ID
   * @param {string} toEntityId - To entity ID
   * @param {Object} linkConfig - Link configuration
   * @returns {Promise<Object>} Link object
   */
  async createLink(graphId, fromEntityId, toEntityId, linkConfig = {}) {
    if (!this.graphs.has(graphId)) {
      throw new Error(`Graph ${graphId} not found`);
    }

    const payload = {
      from: fromEntityId,
      to: toEntityId,
      type: linkConfig.type || 'relates-to',
      label: linkConfig.label || linkConfig.type || 'relates to',
      color: linkConfig.color || '#999999',
      strength: linkConfig.strength || 1.0
    };

    try {
      const startTime = Date.now();
      const link = await this.makeRequest(
        `/graphs/${graphId}/links`,
        'POST',
        payload
      );
      const latency = Date.now() - startTime;

      const linkData = {
        id: link.id,
        graphId,
        from: fromEntityId,
        to: toEntityId,
        type: payload.type,
        label: payload.label,
        color: payload.color,
        strength: payload.strength,
        created: new Date()
      };

      const graph = this.graphs.get(graphId);
      if (!graph.links.find(l => l.from === fromEntityId && l.to === toEntityId)) {
        graph.links.push(linkData);
        graph.metadata.linkCount++;
      }

      // Update entity relationships
      if (this.entities.has(fromEntityId)) {
        this.entities.get(fromEntityId).relationships.push(toEntityId);
      }

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;

      this.emit('link-created', {
        linkId: link.id,
        graphId,
        type: payload.type,
        latency
      });

      return linkData;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('createLink', error);
      throw error;
    }
  }

  /**
   * Bulk import entities from file or array
   * @param {string} graphId - Graph ID
   * @param {Array} entities - Array of entity objects
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async bulkImportEntities(graphId, entities, options = {}) {
    if (!this.graphs.has(graphId)) {
      throw new Error(`Graph ${graphId} not found`);
    }

    const payload = {
      entities: entities.map(e => ({
        type: e.type || ENTITY_TYPES.DOMAIN,
        value: e.value,
        label: e.label || e.value,
        properties: e.properties || {}
      })),
      strategy: options.strategy || 'append', // append, replace
      deduplicateByValue: options.deduplicateByValue !== false
    };

    try {
      const startTime = Date.now();
      const result = await this.makeRequest(
        `/graphs/${graphId}/bulk-import`,
        'POST',
        payload
      );
      const latency = Date.now() - startTime;

      const importResult = {
        graphId,
        totalImported: result.imported || 0,
        totalSkipped: result.skipped || 0,
        totalErrors: result.errors || 0,
        details: result.details || [],
        timestamp: Date.now(),
        latency
      };

      const graph = this.graphs.get(graphId);
      graph.metadata.entityCount += importResult.totalImported;

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;
      this.metrics.entitiesProcessed += importResult.totalImported;

      this.emit('bulk-import-completed', {
        graphId,
        imported: importResult.totalImported,
        skipped: importResult.totalSkipped,
        latency
      });

      return importResult;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('bulkImportEntities', error);
      throw error;
    }
  }

  /**
   * Get graph analysis/statistics
   * @param {string} graphId - Graph ID
   * @returns {Promise<Object>} Analysis data
   */
  async getGraphAnalysis(graphId) {
    if (!this.graphs.has(graphId)) {
      throw new Error(`Graph ${graphId} not found`);
    }

    try {
      const startTime = Date.now();
      const analysis = await this.makeRequest(
        `/graphs/${graphId}/analysis`,
        'GET'
      );
      const latency = Date.now() - startTime;

      const graphData = this.graphs.get(graphId);
      const analysisResult = {
        graphId,
        entityCount: graphData.metadata.entityCount,
        linkCount: graphData.metadata.linkCount,
        density: graphData.metadata.linkCount /
                 (graphData.metadata.entityCount * (graphData.metadata.entityCount - 1)),
        centrality: analysis.centrality || {},
        communities: analysis.communities || [],
        keyEntities: analysis.keyEntities || [],
        patterns: analysis.patterns || [],
        timestamp: Date.now(),
        latency
      };

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;

      this.emit('graph-analysis-completed', {
        graphId,
        entityCount: analysisResult.entityCount,
        communityCount: analysisResult.communities.length,
        latency
      });

      return analysisResult;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('getGraphAnalysis', error);
      throw error;
    }
  }

  /**
   * Export graph in various formats
   * @param {string} graphId - Graph ID
   * @param {string} format - Export format (json, xml, graphml, etc)
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export data
   */
  async exportGraph(graphId, format = 'json', options = {}) {
    if (!this.graphs.has(graphId)) {
      throw new Error(`Graph ${graphId} not found`);
    }

    const payload = {
      format: format,
      includeAnalysis: options.includeAnalysis !== false,
      includeNotes: options.includeNotes !== false,
      compressed: options.compressed !== false
    };

    try {
      const startTime = Date.now();
      const exportData = await this.makeRequest(
        `/graphs/${graphId}/export`,
        'POST',
        payload
      );
      const latency = Date.now() - startTime;

      const result = {
        graphId,
        format,
        size: exportData.size || 0,
        data: exportData.data || {},
        timestamp: Date.now(),
        latency
      };

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;

      this.emit('graph-exported', {
        graphId,
        format,
        size: result.size,
        latency
      });

      return result;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('exportGraph', error);
      throw error;
    }
  }

  /**
   * Get available transforms
   * @param {string} entityType - Entity type (optional filter)
   * @returns {Promise<Array>} Available transforms
   */
  async getAvailableTransforms(entityType = null) {
    const params = entityType ? `?entityType=${entityType}` : '';

    try {
      const startTime = Date.now();
      const transforms = await this.makeRequest(
        `/transforms${params}`,
        'GET'
      );
      const latency = Date.now() - startTime;

      const transformList = Array.isArray(transforms) ? transforms : transforms.transforms || [];

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;

      this.emit('transforms-retrieved', {
        count: transformList.length,
        latency
      });

      return transformList;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('getAvailableTransforms', error);
      throw error;
    }
  }

  /**
   * Make HTTP request with retry logic
   * @private
   */
  async makeRequest(path, method = 'GET', body = null) {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Maltego API credentials not configured');
    }

    let lastError;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          const url = new URL(this.baseUrl + path);
          const options = {
            method,
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'User-Agent': 'BassetHoundBrowser/1.0'
            },
            timeout: this.timeout
          };

          const req = https.request(url, options, (res) => {
            let data = '';

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                if (res.statusCode >= 400) {
                  const error = new Error(`Maltego API error: ${res.statusCode}`);
                  error.statusCode = res.statusCode;
                  error.response = data;
                  reject(error);
                } else {
                  resolve(JSON.parse(data || '{}'));
                }
              } catch (err) {
                reject(err);
              }
            });
          });

          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Maltego API request timeout'));
          });

          if (body) {
            req.write(JSON.stringify(body));
          }

          req.end();
        });
      } catch (error) {
        lastError = error;

        if (error.statusCode === 401) {
          throw new Error('Maltego API authentication failed');
        }

        if (attempt < this.retryAttempts - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Maltego API request failed');
  }

  /**
   * Track API errors
   * @private
   */
  trackError(method, error) {
    const errorKey = `${method}:${error.message}`;
    const count = this.metrics.apiErrors.get(errorKey) || 0;
    this.metrics.apiErrors.set(errorKey, count + 1);

    this.emit('error', {
      method,
      error: error.message,
      timestamp: Date.now()
    });
  }

  /**
   * Get metrics summary
   */
  getMetrics() {
    return {
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      cachedRequests: this.metrics.cachedRequests,
      averageLatency: this.metrics.successfulRequests > 0
        ? Math.round(this.metrics.totalLatency / this.metrics.successfulRequests)
        : 0,
      transformsExecuted: this.metrics.transformsExecuted,
      entitiesProcessed: this.metrics.entitiesProcessed,
      workspaceCount: this.workspaces.size,
      graphCount: this.graphs.size,
      entityCount: this.entities.size
    };
  }

  /**
   * Get entity types for reference
   */
  getEntityTypes() {
    return ENTITY_TYPES;
  }
}

module.exports = {
  MaltegoClient,
  ENTITY_TYPES,
  createMaltegoClient: (options) => new MaltegoClient(options)
};
