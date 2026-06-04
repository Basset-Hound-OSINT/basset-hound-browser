/**
 * Repository Pattern Implementation
 * Generic repository for all data types with CRUD, query builder, and batch operations
 */

const EventEmitter = require('events');

class Repository extends EventEmitter {
  constructor(dataStore, entityType, options = {}) {
    super();
    this.dataStore = dataStore;
    this.entityType = entityType;
    this.primaryKey = options.primaryKey || 'id';
    this.schema = options.schema || {};
    this.relations = options.relations || {};
    this.hooks = {
      beforeCreate: [],
      afterCreate: [],
      beforeUpdate: [],
      afterUpdate: [],
      beforeDelete: [],
      afterDelete: [],
    };
    this.indexes = new Map(); // Field -> index
    this.metadata = new Map(); // Entity ID -> metadata
  }

  /**
   * Create a new entity
   */
  async create(data) {
    // Validate schema
    await this._validateData(data, true);

    // Execute before hooks
    let entity = data;
    for (const hook of this.hooks.beforeCreate) {
      entity = await hook(entity);
    }

    // Generate ID if not provided
    if (!entity[this.primaryKey]) {
      entity[this.primaryKey] = this._generateId();
    }

    // Add metadata
    const now = new Date();
    const metadata = {
      createdAt: now,
      updatedAt: now,
      createdBy: null,
      deletedAt: null,
      version: 1,
    };

    // Persist
    const result = await this.dataStore.create(this.entityType, entity, metadata);

    // Update indexes
    this._updateIndexes(entity);

    // Execute after hooks
    for (const hook of this.hooks.afterCreate) {
      await hook(result);
    }

    this.emit('entity_created', { entityType: this.entityType, id: entity[this.primaryKey] });
    return result;
  }

  /**
   * Find entity by ID
   */
  async findById(id, options = {}) {
    const { loadRelations = false, lockForUpdate = false } = options;

    const entity = await this.dataStore.findById(this.entityType, id);
    if (!entity) return null;

    if (loadRelations) {
      await this._loadRelations(entity, options);
    }

    if (lockForUpdate) {
      this.metadata.set(id, { locked: true, lockTime: Date.now() });
    }

    return entity;
  }

  /**
   * Find all entities matching query
   */
  async find(query = {}, options = {}) {
    const { limit = 100, offset = 0, sort = [], loadRelations = false } = options;

    const entities = await this.dataStore.find(this.entityType, query, {
      limit,
      offset,
      sort,
    });

    if (loadRelations) {
      for (const entity of entities) {
        await this._loadRelations(entity, options);
      }
    }

    return entities;
  }

  /**
   * Find one entity
   */
  async findOne(query = {}, options = {}) {
    const entities = await this.find(query, { ...options, limit: 1 });
    return entities.length > 0 ? entities[0] : null;
  }

  /**
   * Update an entity
   */
  async update(id, updates) {
    // Get existing entity
    const entity = await this.dataStore.findById(this.entityType, id);
    if (!entity) throw new Error(`Entity not found: ${id}`);

    // Check lock
    const meta = this.metadata.get(id);
    if (meta?.locked && Date.now() - meta.lockTime > 30000) {
      this.metadata.delete(id); // Release stale lock
    } else if (meta?.locked) {
      throw new Error(`Entity is locked: ${id}`);
    }

    // Validate updates
    await this._validateData(updates);

    // Execute before hooks
    let updateData = updates;
    for (const hook of this.hooks.beforeUpdate) {
      updateData = await hook(updateData, entity);
    }

    // Merge with existing
    const merged = { ...entity, ...updateData };
    merged.version = (entity.version || 1) + 1;

    // Persist
    const result = await this.dataStore.update(this.entityType, id, merged);

    // Update indexes
    this._updateIndexes(merged);

    // Execute after hooks
    for (const hook of this.hooks.afterUpdate) {
      await hook(result);
    }

    this.emit('entity_updated', { entityType: this.entityType, id });
    return result;
  }

  /**
   * Delete an entity
   */
  async delete(id, options = {}) {
    const { soft = true } = options;

    const entity = await this.dataStore.findById(this.entityType, id);
    if (!entity) throw new Error(`Entity not found: ${id}`);

    // Execute before hooks
    for (const hook of this.hooks.beforeDelete) {
      await hook(entity);
    }

    if (soft) {
      // Soft delete (mark as deleted)
      const deleted = await this.dataStore.update(this.entityType, id, {
        ...entity,
        deletedAt: new Date(),
      });

      // Execute after hooks
      for (const hook of this.hooks.afterDelete) {
        await hook(deleted);
      }

      this.emit('entity_deleted', { entityType: this.entityType, id, soft: true });
      return true;
    } else {
      // Hard delete
      const result = await this.dataStore.delete(this.entityType, id);

      // Remove from indexes
      this._removeFromIndexes(entity);

      // Clear metadata
      this.metadata.delete(id);

      // Execute after hooks
      for (const hook of this.hooks.afterDelete) {
        await hook(entity);
      }

      this.emit('entity_deleted', { entityType: this.entityType, id, soft: false });
      return result;
    }
  }

  /**
   * Batch create
   */
  async createBatch(entities) {
    const results = [];
    const errors = [];

    for (let i = 0; i < entities.length; i++) {
      try {
        const result = await this.create(entities[i]);
        results.push(result);
      } catch (err) {
        errors.push({ index: i, error: err.message });
      }
    }

    this.emit('batch_created', { count: results.length, errors: errors.length });
    return { results, errors };
  }

  /**
   * Batch update
   */
  async updateBatch(updates) {
    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const id = update[this.primaryKey];
        const data = { ...update };
        delete data[this.primaryKey];
        const result = await this.update(id, data);
        results.push(result);
      } catch (err) {
        errors.push({ id: update[this.primaryKey], error: err.message });
      }
    }

    this.emit('batch_updated', { count: results.length, errors: errors.length });
    return { results, errors };
  }

  /**
   * Batch delete
   */
  async deleteBatch(ids, options = {}) {
    const results = [];
    const errors = [];

    for (const id of ids) {
      try {
        await this.delete(id, options);
        results.push({ id, deleted: true });
      } catch (err) {
        errors.push({ id, error: err.message });
      }
    }

    this.emit('batch_deleted', { count: results.length, errors: errors.length });
    return { results, errors };
  }

  /**
   * Create a query builder
   */
  query() {
    return new QueryBuilder(this);
  }

  /**
   * Register a hook
   */
  registerHook(hookName, handler) {
    if (this.hooks[hookName]) {
      this.hooks[hookName].push(handler);
      return true;
    }
    return false;
  }

  /**
   * Create an index on a field
   */
  createIndex(fieldName, options = {}) {
    this.indexes.set(fieldName, {
      field: fieldName,
      unique: options.unique || false,
      sparse: options.sparse || false,
      values: new Map(),
    });
  }

  /**
   * Count entities
   */
  async count(query = {}) {
    return this.dataStore.count(this.entityType, query);
  }

  /**
   * Get repository metadata
   */
  getMetadata() {
    return {
      entityType: this.entityType,
      primaryKey: this.primaryKey,
      indexCount: this.indexes.size,
      relationCount: Object.keys(this.relations).length,
      hookCount: Object.values(this.hooks).reduce((sum, arr) => sum + arr.length, 0),
    };
  }

  // ==================== Private Methods ====================

  async _validateData(data, isCreate = false) {
    for (const [field, rules] of Object.entries(this.schema)) {
      if (isCreate && rules.required && data[field] === undefined) {
        throw new Error(`Required field missing: ${field}`);
      }

      if (data[field] !== undefined && rules.type) {
        const type = typeof data[field];
        if (type !== rules.type) {
          throw new Error(`Invalid type for ${field}: expected ${rules.type}, got ${type}`);
        }
      }

      if (data[field] !== undefined && rules.validate) {
        const isValid = await rules.validate(data[field]);
        if (!isValid) {
          throw new Error(`Validation failed for ${field}`);
        }
      }
    }
  }

  async _loadRelations(entity, options) {
    for (const [relationName, relationConfig] of Object.entries(this.relations)) {
      if (!relationConfig.enabled) continue;

      const { repository, foreign, type } = relationConfig;
      const foreignId = entity[foreign];

      if (type === 'one') {
        entity[relationName] = await repository.findById(foreignId);
      } else if (type === 'many') {
        const query = { [foreign]: entity[this.primaryKey] };
        entity[relationName] = await repository.find(query);
      }
    }
  }

  _updateIndexes(entity) {
    for (const [fieldName, index] of this.indexes.entries()) {
      const value = entity[fieldName];
      if (value !== undefined) {
        if (!index.values.has(value)) {
          index.values.set(value, new Set());
        }
        index.values.get(value).add(entity[this.primaryKey]);
      }
    }
  }

  _removeFromIndexes(entity) {
    for (const [fieldName, index] of this.indexes.entries()) {
      const value = entity[fieldName];
      if (value !== undefined && index.values.has(value)) {
        index.values.get(value).delete(entity[this.primaryKey]);
      }
    }
  }

  _generateId() {
    return `${this.entityType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Query Builder for fluent query construction
 */
class QueryBuilder {
  constructor(repository) {
    this.repository = repository;
    this.filters = [];
    this.sortBy = [];
    this.limitValue = 100;
    this.offsetValue = 0;
    this.loadRelationsFlag = false;
  }

  where(field, operator, value) {
    this.filters.push({ field, operator, value });
    return this;
  }

  whereIn(field, values) {
    this.filters.push({ field, operator: 'in', value: values });
    return this;
  }

  whereBetween(field, min, max) {
    this.filters.push({ field, operator: 'between', min, max });
    return this;
  }

  sort(field, direction = 'ASC') {
    this.sortBy.push({ field, direction });
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  offset(value) {
    this.offsetValue = value;
    return this;
  }

  withRelations() {
    this.loadRelationsFlag = true;
    return this;
  }

  async execute() {
    const query = this._buildQuery();
    return this.repository.find(query, {
      limit: this.limitValue,
      offset: this.offsetValue,
      sort: this.sortBy,
      loadRelations: this.loadRelationsFlag,
    });
  }

  async first() {
    const results = await this.limit(1).execute();
    return results.length > 0 ? results[0] : null;
  }

  async count() {
    const query = this._buildQuery();
    return this.repository.count(query);
  }

  _buildQuery() {
    const query = {};
    for (const filter of this.filters) {
      if (filter.operator === 'eq') {
        query[filter.field] = filter.value;
      } else {
        if (!query[filter.field]) {
          query[filter.field] = {};
        }
        query[filter.field][filter.operator] = filter.value;
      }
    }
    return query;
  }
}

module.exports = { Repository, QueryBuilder };
