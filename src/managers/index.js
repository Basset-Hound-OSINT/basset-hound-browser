/**
 * Basset Hound Browser - Managers Module
 *
 * Central hub for manager classes and registry.
 *
 * @module managers
 */

const { BaseManager, ManagerState } = require('./base-manager');
const { ManagerRegistry } = require('./manager-registry');

module.exports = {
  BaseManager,
  ManagerState,
  ManagerRegistry
};
