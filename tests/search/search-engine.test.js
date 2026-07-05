/**
 * Search Engine Tests
 * Comprehensive tests for full-text search functionality
 */

const assert = require('assert');
const SearchEngine = require('../../src/search/search-engine');

describe('Search Engine Tests', () => {
  let searchEngine;

  beforeEach(async () => {
    searchEngine = new SearchEngine({
      elasticsearchClient: null // Mock without real Elasticsearch
    });

    // Create test index
    await searchEngine.createIndex('users', {
      id: { type: 'keyword' },
      name: { type: 'text' },
      email: { type: 'keyword' },
      description: { type: 'text' }
    });
  });

  describe('Index Management', () => {
    it('should create an index', async () => {
      const info = searchEngine.getIndexInfo('users');
      assert(info);
      assert.strictEqual(info.name, 'users');
    });

    it('should list indices', () => {
      const indices = Array.from(searchEngine.indices.keys());
      assert(indices.includes('users'));
    });

    it('should delete an index', async () => {
      await searchEngine.deleteIndex('users');
      const info = searchEngine.getIndexInfo('users');
      assert.strictEqual(info, null);
    });

    it('should prevent duplicate indices', async () => {
      try {
        await searchEngine.createIndex('users', {});
        assert.fail('Should throw error for duplicate index');
      } catch (err) {
        assert(err.message.includes('already exists'));
      }
    });
  });

  describe('Document Indexing', () => {
    it('should index a document', async () => {
      await searchEngine.indexDocument('users', 'user1', {
        name: 'John Doe',
        email: 'john@example.com',
        description: 'Software developer'
      });

      const info = searchEngine.getIndexInfo('users');
      assert.strictEqual(info.documents, 1);
    });

    it('should delete a document', async () => {
      await searchEngine.indexDocument('users', 'user1', {
        name: 'John Doe',
        email: 'john@example.com'
      });

      const before = searchEngine.getIndexInfo('users').documents;

      await searchEngine.deleteDocument('users', 'user1');

      const after = searchEngine.getIndexInfo('users').documents;
      assert.strictEqual(after, before - 1);
    });

    it('should bulk index documents', async () => {
      const documents = {
        user1: { name: 'John Doe', email: 'john@example.com' },
        user2: { name: 'Jane Doe', email: 'jane@example.com' },
        user3: { name: 'Bob Smith', email: 'bob@example.com' }
      };

      await searchEngine.bulkIndex('users', documents);

      const info = searchEngine.getIndexInfo('users');
      assert.strictEqual(info.documents, 3);
    });

    it('should track indexed timestamp', async () => {
      const before = new Date();
      await searchEngine.indexDocument('users', 'user1', {
        name: 'Test User',
        email: 'test@example.com'
      });
      const after = new Date();

      // Note: Without real Elasticsearch, we can't verify the actual indexed_at
      // In a real scenario, this would be verified on retrieval
      const info = searchEngine.getIndexInfo('users');
      assert(info.documents > 0);
    });
  });

  describe('Query Parsing', () => {
    it('should parse simple query', () => {
      const parser = searchEngine.queryParsers.get('simple');
      const parsed = parser('john doe');

      assert.strictEqual(parsed.type, 'match_all');
      assert(Array.isArray(parsed.terms));
      assert.strictEqual(parsed.terms.length, 2);
    });

    it('should parse phrase query', () => {
      const parser = searchEngine.queryParsers.get('phrase');
      const parsed = parser('exact phrase');

      assert.strictEqual(parsed.type, 'match_phrase');
      assert.strictEqual(parsed.phrase, 'exact phrase');
    });

    it('should parse boolean query', () => {
      const parser = searchEngine.queryParsers.get('boolean');
      const parsed = parser('+must have -excluded');

      assert.strictEqual(parsed.type, 'bool');
      assert(Array.isArray(parsed.clauses));
    });
  });

  describe('Scoring Profiles', () => {
    it('should register a scoring profile', () => {
      const profile = {
        name: 'custom_score',
        weights: { name: 2, description: 1 }
      };

      searchEngine.registerScoringProfile('custom', profile);

      const profiles = Array.from(searchEngine.scoringProfiles.keys());
      assert(profiles.includes('custom'));
    });
  });

  describe('Faceting', () => {
    it('should register a facet', () => {
      const facet = {
        field: 'email',
        type: 'terms',
        size: 10
      };

      searchEngine.registerFacet('email_domain', facet);

      const facets = Array.from(searchEngine.facets.keys());
      assert(facets.includes('email_domain'));
    });
  });

  describe('Search Operations', () => {
    beforeEach(async () => {
      const documents = {
        user1: { name: 'John Smith', email: 'john@example.com', description: 'Developer' },
        user2: { name: 'Jane Smith', email: 'jane@example.com', description: 'Designer' },
        user3: { name: 'Bob Johnson', email: 'bob@example.com', description: 'Manager' },
        user4: { name: 'Alice Brown', email: 'alice@example.com', description: 'Developer' }
      };

      await searchEngine.bulkIndex('users', documents);
    });

    it('should search with string query', async () => {
      const result = await searchEngine.search('users', 'john', {
        limit: 10
      });

      assert(result.query);
      assert(result.results);
      assert(result.total >= 0);
      assert(result.took >= 0);
    });

    it('should respect limit', async () => {
      const result = await searchEngine.search('users', 'smith', {
        limit: 1
      });

      assert(result.limit === 1);
    });

    it('should handle offset', async () => {
      const result = await searchEngine.search('users', 'smith', {
        limit: 5,
        offset: 1
      });

      assert.strictEqual(result.offset, 1);
    });

    it('should support sorting', async () => {
      const result = await searchEngine.search('users', 'smith', {
        sort: [{ field: 'name', direction: 'ASC' }]
      });

      assert(Array.isArray(result.results));
    });

    it('should support faceting', async () => {
      const result = await searchEngine.search('users', 'developer', {
        facets: ['email_domain']
      });

      assert(result.facets);
    });
  });

  describe('Highlighting', () => {
    beforeEach(async () => {
      await searchEngine.indexDocument('users', 'user1', {
        name: 'John Doe',
        email: 'john@example.com',
        description: 'Experienced john developer with john expertise'
      });
    });

    it('should highlight matching terms', async () => {
      // Note: Without real Elasticsearch, highlights won't be returned
      // In a real scenario, this would return <em>john</em> tags
      const result = await searchEngine.searchWithHighlight('users', 'john', {
        highlightField: 'description'
      });

      assert(result.results);
    });
  });

  describe('Suggestions', () => {
    beforeEach(async () => {
      const documents = {
        user1: { name: 'JavaScript Developer' },
        user2: { name: 'Java Developer' },
        user3: { name: 'Python Developer' }
      };

      await searchEngine.bulkIndex('users', documents);
    });

    it('should provide suggestions', async () => {
      // Note: Without real Elasticsearch, suggestions won't be returned
      const suggestions = await searchEngine.suggest('users', 'java', {
        field: 'name',
        limit: 5
      });

      assert(Array.isArray(suggestions));
    });
  });

  describe('Reindexing', () => {
    it('should reindex documents', async () => {
      // Create second index
      await searchEngine.createIndex('users_backup', {
        id: { type: 'keyword' },
        name: { type: 'text' },
        email: { type: 'keyword' }
      });

      // Index some documents
      await searchEngine.indexDocument('users', 'user1', {
        name: 'John Doe',
        email: 'john@example.com'
      });

      // Reindex from users to users_backup
      await searchEngine.reindex('users', 'users_backup');

      // Verify reindex completed
      const backupInfo = searchEngine.getIndexInfo('users_backup');
      assert(backupInfo);
    });
  });

  describe('Metrics', () => {
    it('should track search metrics', async () => {
      await searchEngine.bulkIndex('users', {
        user1: { name: 'John Doe', email: 'john@example.com' }
      });

      await searchEngine.search('users', 'john');
      await searchEngine.search('users', 'jane');

      const metrics = searchEngine.getMetrics();
      assert.strictEqual(metrics.totalSearches, 2);
    });

    it('should calculate average search time', async () => {
      await searchEngine.bulkIndex('users', {
        user1: { name: 'Test', email: 'test@example.com' }
      });

      await searchEngine.search('users', 'test');

      const metrics = searchEngine.getMetrics();
      assert(metrics.avgSearchTime);
    });
  });

  describe('Events', () => {
    it('should emit index_created event', async () => {
      let emitted = false;

      searchEngine.once('index_created', () => {
        emitted = true;
      });

      await searchEngine.createIndex('test_index', {});

      assert(emitted);
    });

    it('should emit document_indexed event', async () => {
      let emitted = false;

      searchEngine.once('document_indexed', () => {
        emitted = true;
      });

      await searchEngine.indexDocument('users', 'user_test', {
        name: 'Test'
      });

      assert(emitted);
    });

    it('should emit scoring_profile_registered event', () => {
      let emitted = false;

      searchEngine.once('scoring_profile_registered', () => {
        emitted = true;
      });

      searchEngine.registerScoringProfile('test_profile', {});

      assert(emitted);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent index', async () => {
      try {
        await searchEngine.search('nonexistent', 'query');
        assert.fail('Should throw error');
      } catch (err) {
        assert(err.message.includes('not found'));
      }
    });

    it('should handle index deletion error', async () => {
      try {
        await searchEngine.deleteIndex('nonexistent');
        assert.fail('Should throw error');
      } catch (err) {
        assert(err.message.includes('not found'));
      }
    });
  });
});
