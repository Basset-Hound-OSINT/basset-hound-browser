/**
 * Data Pipeline Integration Tests
 * Tests for complete data layer workflow
 */

const assert = require('assert');
const CacheManager = require('../../src/cache/cache-manager');
const QueryCache = require('../../src/cache/query-cache');
const { Repository } = require('../../src/data/repository');
const DataMapper = require('../../src/data/data-mapper');
const SearchEngine = require('../../src/search/search-engine');
const AnalyticsStore = require('../../src/data/analytics-store');
const ReportGenerator = require('../../src/data/report-generator');
const SchemaValidator = require('../../src/data/schema-validator');

// Mock data store
class MockDataStore {
  constructor() {
    this.data = new Map();
  }

  async create(entityType, entity, metadata) {
    if (!this.data.has(entityType)) {
      this.data.set(entityType, new Map());
    }
    this.data.get(entityType).set(entity.id, { ...entity, ...metadata });
    return { ...entity, ...metadata };
  }

  async findById(entityType, id) {
    const entities = this.data.get(entityType);
    return entities ? entities.get(id) : null;
  }

  async find(entityType, query, options = {}) {
    const entities = this.data.get(entityType);
    if (!entities) return [];
    let results = Array.from(entities.values());

    for (const [field, value] of Object.entries(query)) {
      results = results.filter((entity) => entity[field] === value);
    }

    const start = options.offset || 0;
    const end = start + (options.limit || 100);
    return results.slice(start, end);
  }

  async count(entityType, query = {}) {
    const entities = await this.find(entityType, query);
    return entities.length;
  }

  async update(entityType, id, data) {
    const entities = this.data.get(entityType);
    if (entities && entities.has(id)) {
      entities.set(id, { ...entities.get(id), ...data });
      return entities.get(id);
    }
    return null;
  }

  async delete(entityType, id) {
    const entities = this.data.get(entityType);
    if (entities) {
      entities.delete(id);
      return true;
    }
    return false;
  }
}

describe('Data Pipeline Integration Tests', () => {
  let cacheManager;
  let queryCache;
  let dataStore;
  let repository;
  let mapper;
  let searchEngine;
  let analytics;
  let validator;

  beforeEach(async () => {
    cacheManager = new CacheManager({ maxMemorySize: 50 * 1024 * 1024 });
    queryCache = new QueryCache(cacheManager);
    dataStore = new MockDataStore();
    repository = new Repository(dataStore, 'user', {
      primaryKey: 'id',
      schema: {
        name: { type: 'string', required: true },
        email: { type: 'string', required: true },
        age: { type: 'number' },
      },
    });

    mapper = new DataMapper();
    mapper.registerMapping('user', {
      table: 'users',
      primaryKey: 'id',
      fields: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        age: { type: 'number' },
      },
    });

    searchEngine = new SearchEngine();
    await searchEngine.createIndex('users', {
      id: { type: 'keyword' },
      name: { type: 'text' },
      email: { type: 'keyword' },
    });

    analytics = new AnalyticsStore();
    analytics.configureAggregation('user_operations', {
      intervals: ['hourly'],
      retentionDays: 365,
    });

    validator = new SchemaValidator({ enableCache: true });
    validator.registerSchema('user', {
      properties: {
        name: { type: 'string', required: true },
        email: { type: 'string', required: true },
        age: { type: 'number', minimum: 0, maximum: 150 },
      },
    });
  });

  afterEach(async () => {
    await cacheManager.clear();
  });

  describe('Complete Workflow', () => {
    it('should execute complete create-search-analyze workflow', async () => {
      // 1. Validate data
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      };

      const validationResult = await validator.validate(userData, 'user');
      assert(validationResult.valid);

      // 2. Create entity
      const user = await repository.create(userData);
      assert(user.id);

      // 3. Record operation in analytics
      analytics.record('user_operations', 1, {
        tags: { operation: 'create', userId: user.id },
      });

      // 4. Map to API response
      const apiResponse = await mapper.mapToResponse('user', user);
      assert.strictEqual(apiResponse.name, 'John Doe');

      // 5. Index in search
      await searchEngine.indexDocument('users', user.id, {
        id: user.id,
        name: user.name,
        email: user.email,
      });

      // 6. Cache the result
      await cacheManager.set(`user:${user.id}`, user, {
        ttl: 3600000,
        tags: ['user', `user:${user.id}`],
      });

      // 7. Verify cache hit
      const cached = await cacheManager.get(`user:${user.id}`);
      assert.strictEqual(cached.name, 'John Doe');
    });

    it('should execute query cache workflow', async () => {
      // Register a query type
      queryCache.registerQuery('get_users_by_age', {
        ttl: 300000,
        tags: ['users', 'age_filter'],
        dependencies: ['user'],
      });

      // Create test data
      const user1 = await repository.create({
        name: 'User 1',
        email: 'user1@example.com',
        age: 25,
      });
      const user2 = await repository.create({
        name: 'User 2',
        email: 'user2@example.com',
        age: 35,
      });

      // Execute query with caching
      let executionCount = 0;
      const executor = async () => {
        executionCount++;
        return repository.find({ age: 25 });
      };

      // First execution (cache miss)
      const result1 = await queryCache.execute('get_users_by_age', { age: 25 }, executor);
      assert.strictEqual(executionCount, 1);

      // Second execution (cache hit)
      const result2 = await queryCache.execute('get_users_by_age', { age: 25 }, executor);
      assert.strictEqual(executionCount, 1); // Should not increment

      // Invalidate on data change
      await queryCache.invalidateOnDataChange('user');

      // Third execution (cache miss after invalidation)
      const result3 = await queryCache.execute('get_users_by_age', { age: 25 }, executor);
      assert.strictEqual(executionCount, 2);

      // Check metrics
      const metrics = queryCache.getAllMetrics();
      assert(metrics.get_users_by_age);
    });

    it('should execute batch operations with validation', async () => {
      // Prepare batch data
      const batchData = [
        { name: 'User 1', email: 'user1@example.com', age: 25 },
        { name: 'User 2', email: 'user2@example.com', age: 35 },
        { name: 'User 3', email: 'user3@example.com', age: 45 },
      ];

      // Validate batch
      const validationResults = await validator.validateBatch(batchData, 'user');
      assert.strictEqual(validationResults.validCount, 3);

      // Create batch
      const { results } = await repository.createBatch(batchData);
      assert.strictEqual(results.length, 3);

      // Index in search
      for (const user of results) {
        await searchEngine.indexDocument('users', user.id, {
          id: user.id,
          name: user.name,
          email: user.email,
        });
      }

      // Record batch operation
      analytics.record('user_operations', results.length, {
        tags: { operation: 'batch_create' },
      });

      // Verify search index
      const index = searchEngine.getIndexInfo('users');
      assert.strictEqual(index.documents, 3);
    });

    it('should execute search with analytics', async () => {
      // Create and index users
      const users = [];
      for (let i = 0; i < 5; i++) {
        const user = await repository.create({
          name: `Search User ${i}`,
          email: `search${i}@example.com`,
        });
        users.push(user);

        await searchEngine.indexDocument('users', user.id, {
          id: user.id,
          name: user.name,
          email: user.email,
        });

        // Record search operation
        analytics.record('user_operations', 1, {
          tags: { operation: 'index', userId: user.id },
        });
      }

      // Perform search
      const searchResults = await searchEngine.search('users', 'Search', {
        limit: 10,
      });

      // Record search metric
      analytics.record('search_metrics', searchResults.results.length, {
        tags: { query: 'Search' },
      });

      // Verify
      assert(searchResults.results.length > 0);

      // Get analytics stats
      const stats = await analytics.getStats('user_operations', Date.now() - 3600000, Date.now());
      assert(stats.count > 0);
    });

    it('should handle data update with cache invalidation', async () => {
      // Create user
      const user = await repository.create({
        name: 'Original Name',
        email: 'original@example.com',
      });

      // Cache user
      await cacheManager.set(`user:${user.id}`, user, {
        tags: ['user', `user:${user.id}`],
      });

      // Verify cached
      let cached = await cacheManager.get(`user:${user.id}`);
      assert.strictEqual(cached.name, 'Original Name');

      // Update user
      const updated = await repository.update(user.id, { name: 'Updated Name' });

      // Invalidate cache by tag
      await cacheManager.invalidateTag(`user:${user.id}`);

      // Verify cache cleared
      cached = await cacheManager.get(`user:${user.id}`);
      assert.strictEqual(cached, null);

      // Record update in analytics
      analytics.record('user_operations', 1, {
        tags: { operation: 'update', userId: user.id },
      });
    });

    it('should generate reports from analytics data', async () => {
      // Record some analytics data
      const now = Date.now();
      for (let i = 0; i < 60; i++) {
        analytics.record('http_requests', 100 + Math.random() * 50, {
          timestamp: now - i * 60000,
        });
      }

      // Create report generator
      const reportGenerator = new ReportGenerator(analytics);

      // Generate report
      const report = await reportGenerator.generateReport({
        name: 'test_report',
        title: 'HTTP Request Analysis',
        seriesNames: ['http_requests'],
        startTime: now - 3600000,
        endTime: now,
        formats: ['json'],
      });

      assert(report.json);
      assert(report.json.includes('.json'));
    });

    it('should validate nested data structures', async () => {
      // Create complex schema
      validator.registerSchema('complex_user', {
        properties: {
          name: { type: 'string', required: true },
          email: { type: 'string', required: true },
          profile: {
            type: 'object',
            properties: {
              bio: { type: 'string' },
              settings: {
                type: 'object',
                properties: {
                  notifications: { type: 'boolean' },
                  language: { type: 'string' },
                },
              },
            },
          },
        },
      });

      // Validate complex data
      const complexData = {
        name: 'John Doe',
        email: 'john@example.com',
        profile: {
          bio: 'Developer',
          settings: {
            notifications: true,
            language: 'en',
          },
        },
      };

      const result = await validator.validate(complexData, 'complex_user');
      assert(result.valid);
    });

    it('should handle concurrent operations', async () => {
      // Create multiple users concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          repository.create({
            name: `Concurrent User ${i}`,
            email: `concurrent${i}@example.com`,
            age: 20 + i,
          })
        );
      }

      const users = await Promise.all(promises);
      assert.strictEqual(users.length, 10);

      // Index concurrently
      const indexPromises = users.map((user) =>
        searchEngine.indexDocument('users', user.id, {
          id: user.id,
          name: user.name,
          email: user.email,
        })
      );

      await Promise.all(indexPromises);

      const index = searchEngine.getIndexInfo('users');
      assert.strictEqual(index.documents, 10);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const invalidData = {
        name: 'No Email User',
        age: 'not a number', // Wrong type
      };

      const result = await validator.validate(invalidData, 'user');
      assert(!result.valid);
      assert(result.errors.length > 0);
    });

    it('should handle repository errors', async () => {
      try {
        // Try to update non-existent user
        await repository.update('nonexistent_id', { name: 'Test' });
        assert.fail('Should throw error');
      } catch (err) {
        assert(err.message.includes('not found'));
      }
    });

    it('should handle cache eviction under pressure', async () => {
      const smallCache = new CacheManager({ maxMemorySize: 1024 }); // 1KB

      // Try to cache large data
      for (let i = 0; i < 20; i++) {
        await smallCache.set(`key${i}`, 'x'.repeat(500));
      }

      const metrics = smallCache.getMetrics();
      assert(metrics.evictions > 0);
    });
  });

  describe('Performance', () => {
    it('should achieve fast cache lookups', async () => {
      await cacheManager.set('perf_test', 'value'.repeat(1000));

      const start = process.hrtime.bigint();
      for (let i = 0; i < 1000; i++) {
        await cacheManager.get('perf_test');
      }
      const end = process.hrtime.bigint();

      const duration = Number(end - start) / 1000000; // Convert to ms
      const avgLookupTime = duration / 1000;

      // Average lookup should be very fast (< 1ms on modern hardware)
      assert(avgLookupTime < 10);
    });

    it('should handle large batch operations', async () => {
      const batchSize = 100;
      const batchData = Array.from({ length: batchSize }, (_, i) => ({
        name: `Batch User ${i}`,
        email: `batch${i}@example.com`,
      }));

      const start = Date.now();
      const { results } = await repository.createBatch(batchData);
      const duration = Date.now() - start;

      assert.strictEqual(results.length, batchSize);
      console.log(`Batch operation completed in ${duration}ms`);
    });
  });
});
