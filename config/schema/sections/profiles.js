/**
 * Basset Hound Browser - Configuration Schema Section
 * Extracted verbatim from config/schema.js (see docs/planning/MODULARIZATION-PLAN-2026-07-04.md §3.5).
 * NOTE: This module's field({...}) body is moved, not rewritten — byte-identical to the original.
 */

const { field, Types } = require('../field');
const { defaults } = require('../../defaults');

module.exports = field({
  type: Types.OBJECT,
  description: 'Browser profile configuration',
  properties: {
    enabled: field({
      type: Types.BOOLEAN,
      default: defaults.profiles.enabled,
      description: 'Enable profile management'
    }),
    storagePath: field({
      type: [Types.STRING, Types.NULL],
      default: defaults.profiles.storagePath,
      description: 'Profiles storage path'
    }),
    defaultProfile: field({
      type: [Types.STRING, Types.NULL],
      default: defaults.profiles.defaultProfile,
      description: 'Default profile ID'
    }),
    isolation: field({
      type: Types.OBJECT,
      properties: {
        cookies: field({
          type: Types.BOOLEAN,
          default: defaults.profiles.isolation.cookies,
          description: 'Isolate cookies per profile'
        }),
        localStorage: field({
          type: Types.BOOLEAN,
          default: defaults.profiles.isolation.localStorage,
          description: 'Isolate localStorage per profile'
        }),
        sessionStorage: field({
          type: Types.BOOLEAN,
          default: defaults.profiles.isolation.sessionStorage,
          description: 'Isolate sessionStorage per profile'
        }),
        indexedDB: field({
          type: Types.BOOLEAN,
          default: defaults.profiles.isolation.indexedDB,
          description: 'Isolate IndexedDB per profile'
        }),
        cache: field({
          type: Types.BOOLEAN,
          default: defaults.profiles.isolation.cache,
          description: 'Isolate cache per profile'
        })
      }
    })
  }
});
