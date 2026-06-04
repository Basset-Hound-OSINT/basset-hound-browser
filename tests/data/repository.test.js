/**
 * Repository Pattern Tests
 * Comprehensive tests for data access layer
 */

const assert = require('assert');
const { Repository } = require('../../src/data/repository');

// Mock data store for testing
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

    // Simple query filter
    for (const [field, value] of Object.entries(query)) {
      results = results.filter((entity) => entity[field] === value);
    }

    // Sorting
    if (options.sort && options.sort.length > 0) {
      results.sort((a, b) => {
        for (const { field, direction } of options.sort) {
          if (a[field] < b[field]) return direction === 'ASC' ? -1 : 1;
          if (a[field] > b[field]) return direction === 'ASC' ? 1 : -1;
        }
        return 0;
      });
    }

    // Pagination
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

describe('Repository Pattern Tests', () => {
  let dataStore;
  let repository;

  beforeEach(() => {
    dataStore = new MockDataStore();
    repository = new Repository(dataStore, 'user', {
      primaryKey: 'id',
      schema: {
        name: { type: 'string', required: true },
        email: { type: 'string', required: true },
        age: { type: 'number' },
      },
    });
  });

  describe('CRUD Operations', () => {
    it('should create an entity', async () => {
      const user = await repository.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      });

      assert(user.id);
      assert.strictEqual(user.name, 'John Doe');
      assert.strictEqual(user.email, 'john@example.com');
    });

    it('should find entity by ID', async () => {
      const created = await repository.create({
        name: 'Jane Doe',
        email: 'jane@example.com',
      });

      const found = await repository.findById(created.id);
      assert.strictEqual(found.name, 'Jane Doe');
    });

    it('should find entities', async () => {
      await repository.create({ name: 'User 1', email: 'user1@example.com' });
      await repository.create({ name: 'User 2', email: 'user2@example.com' });
      await repository.create({ name: 'User 3', email: 'user3@example.com' });

      const users = await repository.find({}, { limit: 10 });
      assert.strictEqual(users.length, 3);
    });

    it('should find one entity', async () => {
      await repository.create({ name: 'Unique User', email: 'unique@example.com' });
      const user = await repository.findOne({ name: 'Unique User' });
      assert.strictEqual(user.name, 'Unique User');
    });

    it('should update an entity', async () => {
      const created = await repository.create({
        name: 'Original Name',
        email: 'original@example.com',
      });

      const updated = await repository.update(created.id, { name: 'Updated Name' });
      assert.strictEqual(updated.name, 'Updated Name');
      assert.strictEqual(updated.email, 'original@example.com');
    });

    it('should soft delete an entity', async () => {
      const created = await repository.create({
        name: 'To Delete',
        email: 'delete@example.com',
      });

      await repository.delete(created.id, { soft: true });
      const found = await repository.findById(created.id);
      assert(found.deletedAt);
    });

    it('should hard delete an entity', async () => {
      const created = await repository.create({
        name: 'To Delete',
        email: 'delete@example.com',
      });

      await repository.delete(created.id, { soft: false });
      const found = await repository.findById(created.id);
      assert.strictEqual(found, null);
    });
  });

  describe('Batch Operations', () => {
    it('should create batch entities', async () => {
      const entities = [
        { name: 'User 1', email: 'user1@example.com' },
        { name: 'User 2', email: 'user2@example.com' },
        { name: 'User 3', email: 'user3@example.com' },
      ];

      const { results, errors } = await repository.createBatch(entities);
      assert.strictEqual(results.length, 3);
      assert.strictEqual(errors.length, 0);
    });

    it('should handle batch creation errors', async () => {
      const entities = [
        { name: 'Valid User', email: 'valid@example.com' },
        { name: null, email: 'invalid@example.com' }, // Missing required field
        { name: 'Another User', email: 'another@example.com' },
      ];

      const { results, errors } = await repository.createBatch(entities);
      assert(results.length >= 2); // At least 2 valid
      assert(errors.length >= 1); // At least 1 invalid
    });

    it('should update batch entities', async () => {
      const user1 = await repository.create({
        name: 'User 1',
        email: 'user1@example.com',
      });
      const user2 = await repository.create({
        name: 'User 2',
        email: 'user2@example.com',
      });

      const updates = [
        { id: user1.id, name: 'Updated User 1' },
        { id: user2.id, name: 'Updated User 2' },
      ];

      const { results } = await repository.updateBatch(updates);
      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].name, 'Updated User 1');
    });

    it('should delete batch entities', async () => {
      const user1 = await repository.create({
        name: 'User 1',
        email: 'user1@example.com',
      });
      const user2 = await repository.create({
        name: 'User 2',
        email: 'user2@example.com',
      });

      const { results } = await repository.deleteBatch([user1.id, user2.id]);
      assert.strictEqual(results.length, 2);
    });
  });

  describe('Query Builder', () => {
    it('should build and execute query', async () => {
      await repository.create({ name: 'John', email: 'john@example.com', age: 30 });
      await repository.create({ name: 'Jane', email: 'jane@example.com', age: 25 });
      await repository.create({ name: 'Bob', email: 'bob@example.com', age: 35 });

      const results = await repository
        .query()
        .where('age', 'gte', 30)
        .sort('age', 'ASC')
        .execute();

      assert(results.length >= 2);
    });

    it('should paginate results', async () => {
      for (let i = 0; i < 15; i++) {
        await repository.create({ name: `User ${i}`, email: `user${i}@example.com` });
      }

      const page1 = await repository
        .query()
        .limit(5)
        .offset(0)
        .execute();
      const page2 = await repository
        .query()
        .limit(5)
        .offset(5)
        .execute();

      assert.strictEqual(page1.length, 5);
      assert.strictEqual(page2.length, 5);
    });

    it('should get first result', async () => {
      await repository.create({ name: 'John', email: 'john@example.com' });
      await repository.create({ name: 'Jane', email: 'jane@example.com' });

      const user = await repository
        .query()
        .where('name', 'eq', 'John')
        .first();

      assert.strictEqual(user.name, 'John');
    });

    it('should count results', async () => {
      await repository.create({ name: 'User 1', email: 'user1@example.com' });
      await repository.create({ name: 'User 2', email: 'user2@example.com' });

      const count = await repository.query().count();
      assert.strictEqual(count, 2);
    });
  });

  describe('Hooks', () => {
    it('should execute before create hook', async () => {
      let hookCalled = false;

      repository.registerHook('beforeCreate', async (entity) => {
        hookCalled = true;
        entity.hookApplied = true;
        return entity;
      });

      const user = await repository.create({ name: 'Test', email: 'test@example.com' });

      assert(hookCalled);
      assert(user.hookApplied);
    });

    it('should execute after create hook', async () => {
      let hookCalled = false;

      repository.registerHook('afterCreate', async (entity) => {
        hookCalled = true;
      });

      await repository.create({ name: 'Test', email: 'test@example.com' });

      assert(hookCalled);
    });

    it('should execute before update hook', async () => {
      const created = await repository.create({ name: 'Original', email: 'test@example.com' });

      repository.registerHook('beforeUpdate', async (updates) => {
        updates.updated = true;
        return updates;
      });

      const updated = await repository.update(created.id, { name: 'Modified' });
      assert(updated.updated);
    });
  });

  describe('Indexes', () => {
    it('should create and use indexes', async () => {
      repository.createIndex('email', { unique: true });

      const user1 = await repository.create({
        name: 'User 1',
        email: 'unique@example.com',
      });

      assert(user1.id);

      const metadata = repository.getMetadata();
      assert.strictEqual(metadata.indexCount, 1);
    });
  });

  describe('Validation', () => {
    it('should validate required fields', async () => {
      try {
        await repository.create({ name: 'Test' }); // Missing email
        assert.fail('Should throw validation error');
      } catch (err) {
        assert(err.message.includes('Required'));
      }
    });

    it('should validate field types', async () => {
      try {
        await repository.create({
          name: 'Test',
          email: 'test@example.com',
          age: 'not a number', // Should be number
        });
        assert.fail('Should throw validation error');
      } catch (err) {
        assert(err.message.includes('Invalid'));
      }
    });
  });

  describe('Metadata', () => {
    it('should track entity versions', async () => {
      const created = await repository.create({
        name: 'Test',
        email: 'test@example.com',
      });
      assert.strictEqual(created.version, 1);

      const updated = await repository.update(created.id, { name: 'Updated' });
      assert.strictEqual(updated.version, 2);
    });

    it('should track timestamps', async () => {
      const created = await repository.create({
        name: 'Test',
        email: 'test@example.com',
      });

      assert(created.createdAt);
      assert(created.updatedAt);
    });
  });

  describe('Events', () => {
    it('should emit entity_created event', async () => {
      let emitted = false;

      repository.once('entity_created', () => {
        emitted = true;
      });

      await repository.create({ name: 'Test', email: 'test@example.com' });

      assert(emitted);
    });

    it('should emit entity_updated event', async () => {
      const created = await repository.create({
        name: 'Test',
        email: 'test@example.com',
      });

      let emitted = false;

      repository.once('entity_updated', () => {
        emitted = true;
      });

      await repository.update(created.id, { name: 'Updated' });

      assert(emitted);
    });

    it('should emit batch operations events', async () => {
      let batchCreatedEmitted = false;

      repository.once('batch_created', () => {
        batchCreatedEmitted = true;
      });

      await repository.createBatch([
        { name: 'User 1', email: 'user1@example.com' },
        { name: 'User 2', email: 'user2@example.com' },
      ]);

      assert(batchCreatedEmitted);
    });
  });
});
