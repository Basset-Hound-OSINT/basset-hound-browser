/**
 * Full-Text Search Engine
 * Supports Elasticsearch/Opensearch integration with query parsing, scoring, and faceting
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class SearchEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.elasticsearchClient = options.elasticsearchClient || null;
    this.indices = new Map(); // Index name -> config
    this.queryParsers = new Map();
    this.scoringProfiles = new Map();
    this.facets = new Map();
    this.searchMetrics = {
      totalSearches: 0,
      totalResults: 0,
      avgSearchTime: 0,
      totalSearchTime: 0
    };

    this._initializeDefaultParsers();
  }

  /**
   * Create or update a search index
   */
  async createIndex(indexName, mapping = {}) {
    if (this.indices.has(indexName)) {
      throw new Error(`Index already exists: ${indexName}`);
    }

    const indexConfig = {
      name: indexName,
      mapping,
      documents: 0,
      createdAt: new Date(),
      shards: 5,
      replicas: 1
    };

    this.indices.set(indexName, indexConfig);

    // Create in Elasticsearch if configured
    if (this.elasticsearchClient) {
      try {
        await this.elasticsearchClient.indices.create({
          index: indexName,
          body: {
            settings: {
              number_of_shards: indexConfig.shards,
              number_of_replicas: indexConfig.replicas
            },
            mappings: { properties: mapping }
          }
        });
      } catch (err) {
        this.emit('error', { type: 'index_creation', index: indexName, error: err.message });
        throw err;
      }
    }

    this.emit('index_created', { index: indexName });
    return indexConfig;
  }

  /**
   * Delete an index
   */
  async deleteIndex(indexName) {
    if (!this.indices.has(indexName)) {
      throw new Error(`Index not found: ${indexName}`);
    }

    this.indices.delete(indexName);

    if (this.elasticsearchClient) {
      try {
        await this.elasticsearchClient.indices.delete({ index: indexName });
      } catch (err) {
        this.emit('error', { type: 'index_deletion', index: indexName, error: err.message });
        throw err;
      }
    }

    this.emit('index_deleted', { index: indexName });
    return true;
  }

  /**
   * Index a document
   */
  async indexDocument(indexName, docId, document, options = {}) {
    const index = this.indices.get(indexName);
    if (!index) {
      throw new Error(`Index not found: ${indexName}`);
    }

    const doc = {
      _id: docId,
      ...document,
      _indexed_at: new Date()
    };

    // Index in Elasticsearch if configured
    if (this.elasticsearchClient) {
      try {
        await this.elasticsearchClient.index({
          index: indexName,
          id: docId,
          body: doc
        });
      } catch (err) {
        this.emit('error', { type: 'document_index', index: indexName, error: err.message });
        throw err;
      }
    }

    index.documents++;
    this.emit('document_indexed', { index: indexName, docId });
    return true;
  }

  /**
   * Delete a document
   */
  async deleteDocument(indexName, docId) {
    const index = this.indices.get(indexName);
    if (!index) {
      throw new Error(`Index not found: ${indexName}`);
    }

    if (this.elasticsearchClient) {
      try {
        await this.elasticsearchClient.delete({
          index: indexName,
          id: docId
        });
      } catch (err) {
        this.emit('error', { type: 'document_delete', index: indexName, error: err.message });
        throw err;
      }
    }

    index.documents = Math.max(0, index.documents - 1);
    this.emit('document_deleted', { index: indexName, docId });
    return true;
  }

  /**
   * Bulk index documents
   */
  async bulkIndex(indexName, documents) {
    const index = this.indices.get(indexName);
    if (!index) {
      throw new Error(`Index not found: ${indexName}`);
    }

    const bulkOps = [];
    for (const [docId, doc] of Object.entries(documents)) {
      bulkOps.push({ index: { _index: indexName, _id: docId } });
      bulkOps.push({ ...doc, _indexed_at: new Date() });
    }

    if (this.elasticsearchClient) {
      try {
        const response = await this.elasticsearchClient.bulk({ body: bulkOps });
        if (response.errors) {
          this.emit('error', { type: 'bulk_index_errors', errors: response.errors });
        }
      } catch (err) {
        this.emit('error', { type: 'bulk_index', index: indexName, error: err.message });
        throw err;
      }
    }

    index.documents += Object.keys(documents).length;
    this.emit('bulk_indexed', { index: indexName, count: Object.keys(documents).length });
    return true;
  }

  /**
   * Search the index
   */
  async search(indexName, query, options = {}) {
    const index = this.indices.get(indexName);
    if (!index) {
      throw new Error(`Index not found: ${indexName}`);
    }

    const startTime = Date.now();

    const {
      limit = 20,
      offset = 0,
      fields = null,
      facets = [],
      sort = [],
      scoringProfile = null
    } = options;

    // Parse query
    const parsedQuery = this._parseQuery(query);

    // Build Elasticsearch query
    const esQuery = this._buildElasticsearchQuery(parsedQuery, {
      limit,
      offset,
      sort,
      scoringProfile
    });

    let results = [];
    let total = 0;
    const facetResults = {};

    if (this.elasticsearchClient) {
      try {
        const response = await this.elasticsearchClient.search({
          index: indexName,
          body: esQuery
        });

        total = response.hits.total.value;
        results = response.hits.hits.map((hit) => ({
          id: hit._id,
          score: hit._score,
          ...hit._source
        }));

        // Extract facets
        if (response.aggregations) {
          for (const [facetName, facetData] of Object.entries(response.aggregations)) {
            facetResults[facetName] = facetData.buckets || [];
          }
        }
      } catch (err) {
        this.emit('error', { type: 'search_error', index: indexName, error: err.message });
        throw err;
      }
    }

    const searchTime = Date.now() - startTime;
    this._recordMetric(results.length, searchTime);

    return {
      query,
      results,
      total,
      limit,
      offset,
      facets: facetResults,
      took: searchTime
    };
  }

  /**
   * Get search suggestions (autocomplete)
   */
  async suggest(indexName, prefix, options = {}) {
    const { limit = 10, field = 'title' } = options;

    if (!this.elasticsearchClient) {
      return [];
    }

    try {
      const response = await this.elasticsearchClient.search({
        index: indexName,
        body: {
          query: {
            match_phrase_prefix: {
              [field]: {
                query: prefix,
                boost: 2
              }
            }
          },
          size: limit,
          _source: [field]
        }
      });

      return response.hits.hits.map((hit) => hit._source[field]);
    } catch (err) {
      this.emit('error', { type: 'suggest_error', index: indexName, error: err.message });
      return [];
    }
  }

  /**
   * Highlight matching terms in results
   */
  async searchWithHighlight(indexName, query, options = {}) {
    const index = this.indices.get(indexName);
    if (!index) {
      throw new Error(`Index not found: ${indexName}`);
    }

    const { highlightField = 'content', fragmentSize = 150, numFragments = 3 } = options;

    if (!this.elasticsearchClient) {
      return this.search(indexName, query, options);
    }

    const parsedQuery = this._parseQuery(query);
    const esQuery = this._buildElasticsearchQuery(parsedQuery, options);

    try {
      const response = await this.elasticsearchClient.search({
        index: indexName,
        body: {
          ...esQuery,
          highlight: {
            fields: {
              [highlightField]: {
                fragment_size: fragmentSize,
                number_of_fragments: numFragments
              }
            }
          }
        }
      });

      const results = response.hits.hits.map((hit) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
        highlights: hit.highlight || {}
      }));

      return {
        query,
        results,
        total: response.hits.total.value,
        ...options
      };
    } catch (err) {
      this.emit('error', {
        type: 'highlight_search_error',
        index: indexName,
        error: err.message
      });
      throw err;
    }
  }

  /**
   * Register a scoring profile
   */
  registerScoringProfile(profileName, profile) {
    this.scoringProfiles.set(profileName, profile);
    this.emit('scoring_profile_registered', { profile: profileName });
  }

  /**
   * Register a facet
   */
  registerFacet(facetName, facetConfig) {
    this.facets.set(facetName, facetConfig);
    this.emit('facet_registered', { facet: facetName });
  }

  /**
   * Reindex all documents
   */
  async reindex(sourceIndex, targetIndex) {
    if (!this.indices.has(sourceIndex)) {
      throw new Error(`Source index not found: ${sourceIndex}`);
    }
    if (!this.indices.has(targetIndex)) {
      throw new Error(`Target index not found: ${targetIndex}`);
    }

    if (this.elasticsearchClient) {
      try {
        await this.elasticsearchClient.reindex({
          body: {
            source: { index: sourceIndex },
            dest: { index: targetIndex }
          }
        });
      } catch (err) {
        this.emit('error', {
          type: 'reindex_error',
          source: sourceIndex,
          target: targetIndex,
          error: err.message
        });
        throw err;
      }
    }

    this.emit('reindex_completed', { source: sourceIndex, target: targetIndex });
    return true;
  }

  /**
   * Get search statistics
   */
  getMetrics() {
    const avgSearchTime = this.searchMetrics.totalSearches > 0
      ? this.searchMetrics.totalSearchTime / this.searchMetrics.totalSearches
      : 0;

    return {
      ...this.searchMetrics,
      avgSearchTime: avgSearchTime.toFixed(2) + 'ms',
      indexCount: this.indices.size
    };
  }

  /**
   * Get index information
   */
  getIndexInfo(indexName) {
    const index = this.indices.get(indexName);
    if (!index) {
      return null;
    }

    return {
      ...index,
      facetCount: this.facets.size,
      scoringProfileCount: this.scoringProfiles.size
    };
  }

  // ==================== Private Methods ====================

  _initializeDefaultParsers() {
    // Simple query parser
    this.queryParsers.set('simple', (query) => {
      return {
        type: 'match_all',
        terms: query.split(/\s+/)
      };
    });

    // Phrase query parser
    this.queryParsers.set('phrase', (query) => {
      return {
        type: 'match_phrase',
        phrase: query
      };
    });

    // Boolean query parser
    this.queryParsers.set('boolean', (query) => {
      const parts = query.match(/(\+|-)?(\w+:)?("[^"]*"|[^\s]+)/g) || [];
      return {
        type: 'bool',
        clauses: parts.map((part) => ({
          operator: part.startsWith('+') ? 'must' : part.startsWith('-') ? 'must_not' : 'should',
          field: part.match(/(\w+):/)?.[1] || '_all',
          value: part.replace(/^[+-]/, '').replace(/\w+:/, '').replace(/"/g, '')
        }))
      };
    });
  }

  _parseQuery(query) {
    if (typeof query === 'string') {
      return this.queryParsers.get('simple')(query);
    }
    return query;
  }

  _buildElasticsearchQuery(parsedQuery, options) {
    const { limit = 20, offset = 0, sort = [] } = options;

    const query = {};

    if (parsedQuery.type === 'match_all') {
      query.query = { match_all: {} };
    } else if (parsedQuery.type === 'match_phrase') {
      query.query = { match_phrase: { _all: parsedQuery.phrase } };
    } else if (parsedQuery.type === 'bool') {
      const must = [];
      const must_not = [];
      const should = [];

      for (const clause of parsedQuery.clauses) {
        const clauseQuery = { match: { [clause.field]: clause.value } };
        if (clause.operator === 'must') {
          must.push(clauseQuery);
        } else if (clause.operator === 'must_not') {
          must_not.push(clauseQuery);
        } else {
          should.push(clauseQuery);
        }
      }

      query.query = { bool: { must, must_not, should } };
    } else {
      query.query = parsedQuery;
    }

    query.from = offset;
    query.size = limit;

    if (sort.length > 0) {
      query.sort = sort;
    }

    return query;
  }

  _recordMetric(resultCount, searchTime) {
    this.searchMetrics.totalSearches++;
    this.searchMetrics.totalResults += resultCount;
    this.searchMetrics.totalSearchTime += searchTime;
  }
}

module.exports = SearchEngine;
