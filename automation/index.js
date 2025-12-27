/**
 * Automation Module
 * Exports all automation-related classes and utilities
 */

const { AutomationScript, ScriptManager, TRIGGER_TYPES } = require('./scripts');
const ScriptStorage = require('./storage');
const ScriptRunner = require('./runner');

module.exports = {
  AutomationScript,
  ScriptManager,
  ScriptStorage,
  ScriptRunner,
  TRIGGER_TYPES
};
