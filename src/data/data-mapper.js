/**
 * Data Mapper
 * Maps between domain models and database/external representations
 */

const EventEmitter = require('events');

class DataMapper extends EventEmitter {
  constructor(options = {}) {
    super();
    this.mappings = new Map(); // Entity type -> mapping config
    this.typeConverters = this._initializeConverters();
    this.relationCache = new Map();
  }

  /**
   * Register a domain model mapping
   */
  registerMapping(entityType, mapping) {
    const {
      table,
      primaryKey = 'id',
      fields = {},
      computed = {},
      relations = {},
      timestamps = true,
      serializers = {},
      deserializers = {},
    } = mapping;

    this.mappings.set(entityType, {
      entityType,
      table,
      primaryKey,
      fields,
      computed,
      relations,
      timestamps,
      serializers,
      deserializers,
    });

    this.emit('mapping_registered', { entityType });
  }

  /**
   * Map raw database record to domain model
   */
  async mapToDomain(entityType, rawRecord) {
    const mapping = this._getMapping(entityType);
    if (!mapping) throw new Error(`No mapping for ${entityType}`);

    const domain = {};

    // Map fields
    for (const [domainField, fieldConfig] of Object.entries(mapping.fields)) {
      const dbField = fieldConfig.dbField || domainField;
      let value = rawRecord[dbField];

      // Apply deserializer
      if (mapping.deserializers[domainField]) {
        value = await mapping.deserializers[domainField](value, rawRecord);
      }

      // Type coercion
      if (fieldConfig.type) {
        value = this._coerceType(value, fieldConfig.type);
      }

      domain[domainField] = value;
    }

    // Add timestamps
    if (mapping.timestamps) {
      domain.createdAt = rawRecord.created_at ? new Date(rawRecord.created_at) : null;
      domain.updatedAt = rawRecord.updated_at ? new Date(rawRecord.updated_at) : null;
    }

    // Load relationships (lazy by default)
    domain._relations = mapping.relations;

    // Add computed properties
    for (const [computedField, computeFn] of Object.entries(mapping.computed)) {
      domain[computedField] = await computeFn(domain);
    }

    return domain;
  }

  /**
   * Map domain model to database representation
   */
  async mapToDatabase(entityType, domainModel) {
    const mapping = this._getMapping(entityType);
    if (!mapping) throw new Error(`No mapping for ${entityType}`);

    const dbRecord = {};

    // Map fields
    for (const [domainField, fieldConfig] of Object.entries(mapping.fields)) {
      const dbField = fieldConfig.dbField || domainField;
      let value = domainModel[domainField];

      // Apply serializer
      if (mapping.serializers[domainField]) {
        value = await mapping.serializers[domainField](value);
      }

      // Type validation
      if (fieldConfig.type && value !== null && value !== undefined) {
        const expectedType = fieldConfig.type;
        if (typeof value !== expectedType && !(expectedType === 'array' && Array.isArray(value))) {
          throw new Error(
            `Invalid type for ${domainField}: expected ${expectedType}, got ${typeof value}`
          );
        }
      }

      dbRecord[dbField] = value;
    }

    // Add timestamps
    if (mapping.timestamps) {
      dbRecord.updated_at = new Date();
      if (!domainModel.id) {
        dbRecord.created_at = new Date();
      }
    }

    // Exclude relations and computed fields
    delete dbRecord._relations;
    for (const computedField of Object.keys(mapping.computed)) {
      delete dbRecord[computedField];
    }

    return dbRecord;
  }

  /**
   * Map domain model to API response
   */
  async mapToResponse(entityType, domainModel, options = {}) {
    const mapping = this._getMapping(entityType);
    if (!mapping) throw new Error(`No mapping for ${entityType}`);

    const { includeRelations = false, includeComputed = true, fields = null } = options;

    const response = {};

    // Map fields
    for (const [domainField, fieldConfig] of Object.entries(mapping.fields)) {
      if (fields && !fields.includes(domainField)) continue;

      let value = domainModel[domainField];

      // Apply response serializer if exists
      if (fieldConfig.responseSerializer) {
        value = await fieldConfig.responseSerializer(value);
      }

      response[domainField] = value;
    }

    // Add computed fields
    if (includeComputed) {
      for (const [computedField, computeFn] of Object.entries(mapping.computed)) {
        if (fields && !fields.includes(computedField)) continue;
        response[computedField] = await computeFn(domainModel);
      }
    }

    // Add relations
    if (includeRelations) {
      for (const [relationName, relationConfig] of Object.entries(mapping.relations)) {
        if (fields && !fields.includes(relationName)) continue;

        if (domainModel[relationName]) {
          if (Array.isArray(domainModel[relationName])) {
            response[relationName] = await Promise.all(
              domainModel[relationName].map((item) =>
                this.mapToResponse(relationConfig.entityType, item, options)
              )
            );
          } else {
            response[relationName] = await this.mapToResponse(
              relationConfig.entityType,
              domainModel[relationName],
              options
            );
          }
        }
      }
    }

    // Add timestamps if requested
    if (!fields || fields.includes('createdAt')) {
      response.createdAt = domainModel.createdAt;
    }
    if (!fields || fields.includes('updatedAt')) {
      response.updatedAt = domainModel.updatedAt;
    }

    return response;
  }

  /**
   * Load a relation for a domain model
   */
  async loadRelation(entityType, domainModel, relationName, repository) {
    const mapping = this._getMapping(entityType);
    if (!mapping) throw new Error(`No mapping for ${entityType}`);

    const relationConfig = mapping.relations[relationName];
    if (!relationConfig) throw new Error(`No relation ${relationName} for ${entityType}`);

    const { entityType: relatedEntityType, foreign, type } = relationConfig;

    if (type === 'one') {
      domainModel[relationName] = await repository.findById(domainModel[foreign]);
    } else if (type === 'many') {
      const query = { [foreign]: domainModel[mapping.primaryKey] };
      domainModel[relationName] = await repository.find(query);
    }

    this.relationCache.set(`${entityType}:${domainModel.id}:${relationName}`, Date.now());
    this.emit('relation_loaded', { entityType, relationName });
  }

  /**
   * Batch map records to domain models
   */
  async mapBatchToDomain(entityType, rawRecords) {
    return Promise.all(rawRecords.map((record) => this.mapToDomain(entityType, record)));
  }

  /**
   * Batch map domain models to database
   */
  async mapBatchToDatabase(entityType, domainModels) {
    return Promise.all(domainModels.map((model) => this.mapToDatabase(entityType, model)));
  }

  /**
   * Batch map to API response
   */
  async mapBatchToResponse(entityType, domainModels, options = {}) {
    return Promise.all(
      domainModels.map((model) => this.mapToResponse(entityType, model, options))
    );
  }

  /**
   * Get mapping for entity type
   */
  getMapping(entityType) {
    return this._getMapping(entityType);
  }

  /**
   * List all registered mappings
   */
  listMappings() {
    return Array.from(this.mappings.keys());
  }

  /**
   * Get mapper statistics
   */
  getStats() {
    return {
      mappingsCount: this.mappings.size,
      cachedRelations: this.relationCache.size,
      registeredMappings: this.listMappings(),
    };
  }

  // ==================== Private Methods ====================

  _getMapping(entityType) {
    return this.mappings.get(entityType);
  }

  _initializeConverters() {
    return {
      string: (value) => {
        if (value === null || value === undefined) return null;
        return String(value);
      },
      number: (value) => {
        if (value === null || value === undefined) return null;
        const num = Number(value);
        return isNaN(num) ? null : num;
      },
      boolean: (value) => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          return ['true', '1', 'yes'].includes(value.toLowerCase());
        }
        return Boolean(value);
      },
      date: (value) => {
        if (value === null || value === undefined) return null;
        if (value instanceof Date) return value;
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      },
      array: (value) => {
        if (value === null || value === undefined) return [];
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return [value];
          }
        }
        return [value];
      },
      object: (value) => {
        if (value === null || value === undefined) return {};
        if (typeof value === 'object' && !Array.isArray(value)) return value;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return {};
          }
        }
        return {};
      },
      json: (value) => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        }
        return value;
      },
    };
  }

  _coerceType(value, type) {
    if (value === null || value === undefined) return null;

    const converter = this.typeConverters[type];
    if (!converter) {
      console.warn(`Unknown type for coercion: ${type}`);
      return value;
    }

    return converter(value);
  }
}

module.exports = DataMapper;
