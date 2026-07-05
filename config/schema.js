/**
 * Basset Hound Browser - Configuration Schema (barrel)
 * Defines all valid configuration options, types, validation rules, and default values.
 *
 * BOOT-CRITICAL: config validation runs at startup. This file was split into per-section
 * modules under config/schema/ (see docs/planning/MODULARIZATION-PLAN-2026-07-04.md §3.5).
 * The exported surface — { Types, schema, field, validateField, validateConfig, getDefault,
 * getSchema, getValueType } — is byte-for-byte equivalent to the pre-split monolith.
 */

const { Types, field } = require('./schema/field');

/**
 * Configuration schema definition
 * Assembled from the per-section modules (each is a field({ type: OBJECT, ... }) definition).
 * Key order is preserved to match the original monolithic schema.
 */
const schema = {
  // Server configuration
  server: require('./schema/sections/server'),

  // Browser configuration
  browser: require('./schema/sections/browser'),

  // Evasion configuration
  evasion: require('./schema/sections/evasion'),

  // Network configuration
  network: require('./schema/sections/network'),

  // Logging configuration
  logging: require('./schema/sections/logging'),

  // Automation configuration
  automation: require('./schema/sections/automation'),

  // Profile configuration
  profiles: require('./schema/sections/profiles'),

  // Headless configuration
  headless: require('./schema/sections/headless'),

  // Memory configuration
  memory: require('./schema/sections/memory'),

  // Auto-updater configuration
  updater: require('./schema/sections/updater')
};

/**
 * Validate a single value against a field schema
 * @param {*} value - Value to validate
 * @param {Object} fieldSchema - Field schema
 * @param {string} path - Config path for error messages
 * @returns {Object} Validation result { valid: boolean, errors: string[], value: any }
 */
function validateField(value, fieldSchema, path = '') {
  const errors = [];
  let finalValue = value;

  // Handle undefined/null values
  if (value === undefined || value === null) {
    if (fieldSchema.required) {
      errors.push(`${path}: Required field is missing`);
    }
    finalValue = fieldSchema.default;
    return { valid: errors.length === 0, errors, value: finalValue };
  }

  // Get allowed types as array
  const allowedTypes = Array.isArray(fieldSchema.type) ? fieldSchema.type : [fieldSchema.type];

  // Type validation
  const valueType = getValueType(value);
  if (!allowedTypes.includes(Types.ANY) && !allowedTypes.includes(valueType)) {
    // Allow null if NULL is in allowed types
    if (!(value === null && allowedTypes.includes(Types.NULL))) {
      errors.push(`${path}: Expected type ${allowedTypes.join(' or ')}, got ${valueType}`);
      return { valid: false, errors, value: finalValue };
    }
  }

  // Enum validation
  if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
    errors.push(`${path}: Value must be one of: ${fieldSchema.enum.join(', ')}`);
  }

  // Number range validation
  if (valueType === Types.NUMBER) {
    if (fieldSchema.min !== undefined && value < fieldSchema.min) {
      errors.push(`${path}: Value must be >= ${fieldSchema.min}`);
    }
    if (fieldSchema.max !== undefined && value > fieldSchema.max) {
      errors.push(`${path}: Value must be <= ${fieldSchema.max}`);
    }
  }

  // String pattern validation
  if (valueType === Types.STRING && fieldSchema.pattern) {
    if (!fieldSchema.pattern.test(value)) {
      errors.push(`${path}: Value does not match required pattern`);
    }
  }

  // Array items validation
  if (valueType === Types.ARRAY && fieldSchema.items) {
    value.forEach((item, index) => {
      const itemResult = validateField(item, fieldSchema.items, `${path}[${index}]`);
      errors.push(...itemResult.errors);
    });
  }

  // Object properties validation
  if (valueType === Types.OBJECT && fieldSchema.properties) {
    for (const [propKey, propSchema] of Object.entries(fieldSchema.properties)) {
      const propPath = path ? `${path}.${propKey}` : propKey;
      const propValue = value[propKey];
      const propResult = validateField(propValue, propSchema, propPath);
      errors.push(...propResult.errors);
    }
  }

  // Custom validation function
  if (fieldSchema.validate) {
    const customResult = fieldSchema.validate(value, path);
    if (customResult !== true) {
      errors.push(`${path}: ${customResult}`);
    }
  }

  // Deprecation warning
  if (fieldSchema.deprecated) {
    console.warn(`[Config] Warning: ${path} is deprecated. ${fieldSchema.deprecatedMessage}`);
  }

  return { valid: errors.length === 0, errors, value: finalValue };
}

/**
 * Get the type of a value
 * @param {*} value - Value to check
 * @returns {string} Type string
 */
function getValueType(value) {
  if (value === null) {
    return Types.NULL;
  }
  if (Array.isArray(value)) {
    return Types.ARRAY;
  }
  return typeof value;
}

/**
 * Validate entire configuration against schema
 * @param {Object} config - Configuration object to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
function validateConfig(config) {
  const errors = [];

  for (const [key, fieldSchema] of Object.entries(schema)) {
    const result = validateField(config[key], fieldSchema, key);
    errors.push(...result.errors);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get the default value for a config path
 * @param {string} path - Dot-notation path
 * @returns {*} Default value
 */
function getDefault(path) {
  const parts = path.split('.');
  let schemaNode = schema;
  let defaultValue;

  for (const part of parts) {
    if (schemaNode.properties && schemaNode.properties[part]) {
      schemaNode = schemaNode.properties[part];
      defaultValue = schemaNode.default;
    } else if (schemaNode[part]) {
      schemaNode = schemaNode[part];
      defaultValue = schemaNode.default;
    } else {
      return undefined;
    }
  }

  return defaultValue;
}

/**
 * Get schema for a config path
 * @param {string} path - Dot-notation path
 * @returns {Object|null} Field schema or null
 */
function getSchema(path) {
  const parts = path.split('.');
  let schemaNode = schema;

  for (const part of parts) {
    if (schemaNode.properties && schemaNode.properties[part]) {
      schemaNode = schemaNode.properties[part];
    } else if (schemaNode[part]) {
      schemaNode = schemaNode[part];
    } else {
      return null;
    }
  }

  return schemaNode;
}

module.exports = {
  Types,
  schema,
  field,
  validateField,
  validateConfig,
  getDefault,
  getSchema,
  getValueType
};
