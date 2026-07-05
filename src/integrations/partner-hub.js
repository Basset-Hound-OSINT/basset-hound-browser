/**
 * Partner Hub - Unified Partner API Interface
 * Coordinates requests across multiple OSINT partner APIs
 * @module src/integrations/partner-hub
 */

const EventEmitter = require('events');
const { ShodanClient } = require('./shodan-client');
const { MaltegoClient } = require('./maltego-client');
const { CensysClient } = require('./censys-client');

/**
 * Partner Hub Class
 */
class PartnerHub extends EventEmitter {
  constructor(options = {}) {
    super();

    this.providers = new Map();
    this.requestQueue = [];
    this.isProcessing = false;
    this.maxConcurrentRequests = options.maxConcurrentRequests || 5;
    this.requestTimeout = options.requestTimeout || 30000;
    this.enableCaching = options.enableCaching !== false;
    this.cacheTTL = options.cacheTTL || 3600000;

    // Initialize providers
    this.initializeProviders(options);

    // Metrics and quota tracking
    this.quotas = new Map();
    this.metrics = {
      totalRequests: 0,
      totalLatency: 0,
      providerStats: new Map(),
      errors: new Map(),
      startTime: Date.now()
    };

    // Request coordination
    this.activeRequests = 0;
    this.completedRequests = 0;
  }

  /**
   * Initialize partner API clients
   * @private
   */
  initializeProviders(options) {
    // Initialize Shodan
    if (options.shodanApiKey) {
      this.providers.set('shodan', new ShodanClient({
        apiKey: options.shodanApiKey,
        timeout: options.timeout || 15000
      }));
      this.quotas.set('shodan', {
        remaining: 1,
        reset: null,
        requests: 0
      });
    }

    // Initialize Maltego
    if (options.maltegoApiKey && options.maltegoApiSecret) {
      this.providers.set('maltego', new MaltegoClient({
        apiKey: options.maltegoApiKey,
        apiSecret: options.maltegoApiSecret,
        timeout: options.timeout || 20000
      }));
      this.quotas.set('maltego', {
        remaining: null,
        reset: null,
        requests: 0
      });
    }

    // Initialize Censys
    if (options.censysApiId && options.censysApiSecret) {
      this.providers.set('censys', new CensysClient({
        apiId: options.censysApiId,
        apiSecret: options.censysApiSecret,
        timeout: options.timeout || 20000
      }));
      this.quotas.set('censys', {
        remaining: 1,
        reset: null,
        requests: 0
      });
    }

    this.emit('providers-initialized', {
      count: this.providers.size,
      providers: Array.from(this.providers.keys())
    });
  }

  /**
   * Execute coordinated search across providers
   * @param {string} searchType - Type of search (host, domain, certificate, etc)
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Aggregated results
   */
  async coordinatedSearch(searchType, query, options = {}) {
    const startTime = Date.now();
    const results = {
      query,
      searchType,
      timestamp: Date.now(),
      providers: {},
      aggregated: {
        totalResults: 0,
        uniqueResults: 0,
        sources: []
      },
      latency: 0
    };

    const searchPromises = [];
    const enabledProviders = this.getEnabledProviders(options.providers);

    for (const providerName of enabledProviders) {
      const promise = this.executeProviderSearch(
        providerName,
        searchType,
        query,
        options
      ).then(result => {
        results.providers[providerName] = result;
        if (result.success) {
          results.aggregated.sources.push(providerName);
        }
      }).catch(error => {
        results.providers[providerName] = {
          success: false,
          error: error.message,
          timestamp: Date.now()
        };
        this.trackProviderError(providerName, error);
      });

      searchPromises.push(promise);
    }

    // Execute all searches in parallel with concurrency limit
    await this.executeWithConcurrency(searchPromises, this.maxConcurrentRequests);

    // Aggregate results
    this.aggregateResults(results);

    results.latency = Date.now() - startTime;
    this.metrics.totalRequests++;
    this.metrics.totalLatency += results.latency;

    this.emit('coordinated-search-completed', {
      searchType,
      query,
      sourceCount: results.aggregated.sources.length,
      resultCount: results.aggregated.uniqueResults,
      latency: results.latency
    });

    return results;
  }

  /**
   * Execute search on specific provider
   * @private
   */
  async executeProviderSearch(providerName, searchType, query, options) {
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`Provider ${providerName} not initialized`);
    }

    const quota = this.quotas.get(providerName);
    if (quota && quota.remaining === 0) {
      throw new Error(`${providerName} quota exhausted`);
    }

    try {
      this.activeRequests++;
      const startTime = Date.now();
      let result;

      switch (providerName) {
      case 'shodan':
        result = await this.executeShodanSearch(provider, searchType, query, options);
        break;
      case 'maltego':
        result = await this.executeMaltegoSearch(provider, searchType, query, options);
        break;
      case 'censys':
        result = await this.executeCensysSearch(provider, searchType, query, options);
        break;
      default:
        throw new Error(`Unknown provider: ${providerName}`);
      }

      const latency = Date.now() - startTime;
      this.completedRequests++;

      // Update quota info
      const providerMetrics = provider.getMetrics();
      quota.remaining = providerMetrics.quotaRemaining || providerMetrics.queriesLeft;
      quota.requests++;

      this.updateProviderStats(providerName, latency, true);

      return {
        success: true,
        provider: providerName,
        data: result,
        latency,
        timestamp: Date.now()
      };
    } catch (error) {
      this.updateProviderStats(providerName, 0, false);
      throw error;
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Execute Shodan search
   * @private
   */
  async executeShodanSearch(provider, searchType, query, options) {
    switch (searchType) {
    case 'host':
      return await provider.getHost(query);
    case 'search':
      return await provider.search(query, options);
    case 'vulnerabilities':
      return await provider.getVulnerabilities(query);
    case 'dns':
      return await provider.getDnsRecords(query);
    default:
      throw new Error(`Shodan does not support ${searchType} search`);
    }
  }

  /**
   * Execute Maltego search
   * @private
   */
  async executeMaltegoSearch(provider, searchType, query, options) {
    // Create or get workspace
    let workspace = Array.from(provider.workspaces.values())[0];
    if (!workspace) {
      workspace = await provider.createWorkspace({
        name: `search-${Date.now()}`,
        description: `Coordinated search for ${query}`
      });
    }

    // Create graph for this search
    const graph = await provider.createGraph(workspace.id, {
      name: `graph-${query.substring(0, 10)}`,
      description: `Graph for ${searchType} search`
    });

    // Add entity and run transforms
    const entity = await provider.addEntity(graph.id, {
      type: this.getEntityTypeForQuery(query),
      value: query,
      label: query
    });

    return {
      workspaceId: workspace.id,
      graphId: graph.id,
      entityId: entity.id,
      entity: entity,
      timestamp: Date.now()
    };
  }

  /**
   * Execute Censys search
   * @private
   */
  async executeCensysSearch(provider, searchType, query, options) {
    switch (searchType) {
    case 'ipv4':
      return await provider.searchIPv4(query, options);
    case 'ipv6':
      return await provider.searchIPv6(query, options);
    case 'certificate':
      return await provider.searchCertificates(query, options);
    case 'asn':
      return await provider.searchASN(query, options);
    case 'ipv4-details':
      return await provider.getIPv4Details(query);
    case 'certificate-details':
      return await provider.getCertificateDetails(query);
    case 'asn-details':
      return await provider.getASNDetails(query);
    default:
      throw new Error(`Censys does not support ${searchType} search`);
    }
  }

  /**
   * Execute multiple promises with concurrency limit
   * @private
   */
  async executeWithConcurrency(promises, maxConcurrent) {
    const results = [];
    const executing = new Set();

    for (const promise of promises) {
      // Wait if we've hit the limit
      if (executing.size >= maxConcurrent) {
        await Promise.race(executing);
      }

      const exec = promise.finally(() => executing.delete(exec));
      executing.add(exec);
      results.push(exec);
    }

    await Promise.all(results);
  }

  /**
   * Aggregate results from multiple sources
   * @private
   */
  aggregateResults(results) {
    const resultSet = new Set();
    let totalResults = 0;

    for (const [provider, result] of Object.entries(results.providers)) {
      if (result.success && result.data) {
        // Count results based on data structure
        if (Array.isArray(result.data)) {
          totalResults += result.data.length;
        } else if (result.data.results && Array.isArray(result.data.results)) {
          totalResults += result.data.results.length;
          result.data.results.forEach(item => {
            const key = JSON.stringify(item);
            resultSet.add(key);
          });
        } else if (result.data.matches && Array.isArray(result.data.matches)) {
          totalResults += result.data.matches.length;
          result.data.matches.forEach(item => {
            const key = JSON.stringify(item);
            resultSet.add(key);
          });
        }
      }
    }

    results.aggregated.totalResults = totalResults;
    results.aggregated.uniqueResults = resultSet.size;
  }

  /**
   * Get enabled providers
   * @private
   */
  getEnabledProviders(requestedProviders) {
    if (requestedProviders && Array.isArray(requestedProviders)) {
      return requestedProviders.filter(p => this.providers.has(p));
    }
    return Array.from(this.providers.keys());
  }

  /**
   * Get entity type for Maltego based on query pattern
   * @private
   */
  getEntityTypeForQuery(query) {
    const { ENTITY_TYPES } = require('./maltego-client');

    if (query.includes('@')) {
      return ENTITY_TYPES.EMAIL;
    }
    if (query.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
      return ENTITY_TYPES.IP;
    }
    if (query.match(/^[a-f0-9]{64}$/)) {
      return ENTITY_TYPES.HASH;
    }
    if (query.match(/^\+?[\d\s\-()]+$/)) {
      return ENTITY_TYPES.PHONE;
    }
    if (query.includes('.')) {
      return ENTITY_TYPES.DOMAIN;
    }

    return ENTITY_TYPES.HOSTNAME;
  }

  /**
   * Update provider statistics
   * @private
   */
  updateProviderStats(providerName, latency, success) {
    if (!this.metrics.providerStats.has(providerName)) {
      this.metrics.providerStats.set(providerName, {
        requests: 0,
        successful: 0,
        failed: 0,
        totalLatency: 0,
        averageLatency: 0
      });
    }

    const stats = this.metrics.providerStats.get(providerName);
    stats.requests++;
    if (success) {
      stats.successful++;
      stats.totalLatency += latency;
      stats.averageLatency = Math.round(stats.totalLatency / stats.successful);
    } else {
      stats.failed++;
    }
  }

  /**
   * Track provider errors
   * @private
   */
  trackProviderError(providerName, error) {
    if (!this.metrics.errors.has(providerName)) {
      this.metrics.errors.set(providerName, []);
    }
    this.metrics.errors.get(providerName).push({
      error: error.message,
      timestamp: Date.now()
    });
  }

  /**
   * Get quota status for all providers
   */
  getQuotaStatus() {
    const status = {};
    for (const [provider, quota] of this.quotas) {
      status[provider] = {
        remaining: quota.remaining,
        reset: quota.reset,
        requests: quota.requests
      };
    }
    return status;
  }

  /**
   * Get metrics summary
   */
  getMetrics() {
    return {
      uptime: Date.now() - this.metrics.startTime,
      totalRequests: this.metrics.totalRequests,
      completedRequests: this.completedRequests,
      activeRequests: this.activeRequests,
      averageLatency: this.metrics.totalRequests > 0
        ? Math.round(this.metrics.totalLatency / this.metrics.totalRequests)
        : 0,
      providerStats: Object.fromEntries(this.metrics.providerStats),
      errorCounts: Object.fromEntries(this.metrics.errors),
      quotaStatus: this.getQuotaStatus()
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    const health = {
      timestamp: Date.now(),
      providers: {}
    };

    for (const [name, provider] of this.providers) {
      try {
        const metrics = provider.getMetrics();
        health.providers[name] = {
          status: 'healthy',
          metrics
        };
      } catch (error) {
        health.providers[name] = {
          status: 'error',
          error: error.message
        };
      }
    }

    return health;
  }
}

module.exports = {
  PartnerHub,
  createPartnerHub: (options) => new PartnerHub(options)
};
