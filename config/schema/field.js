/**
 * Basset Hound Browser - Configuration Schema Field Helper
 * Shared type definitions and the field() factory used by every schema section.
 * Extracted from config/schema.js (see docs/planning/MODULARIZATION-PLAN-2026-07-04.md §3.5).
 */

/**
 * Type definitions for validation
 */
const Types = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  ARRAY: 'array',
  OBJECT: 'object',
  NULL: 'null',
  ANY: 'any'
};

/**
 * Schema field definition
 * @param {Object} options - Field options
 * @returns {Object} Field schema
 */
function field(options) {
  return {
    type: options.type || Types.ANY,
    required: options.required || false,
    default: options.default,
    description: options.description || '',
    enum: options.enum || null,
    min: options.min,
    max: options.max,
    pattern: options.pattern,
    items: options.items, // For arrays
    properties: options.properties, // For objects
    validate: options.validate, // Custom validation function
    deprecated: options.deprecated || false,
    deprecatedMessage: options.deprecatedMessage || ''
  };
}

module.exports = {
  Types,
  field
};
