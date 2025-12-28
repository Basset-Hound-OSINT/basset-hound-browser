/**
 * Basset Hound Browser - Auto-Update Module
 * Entry point for the auto-update functionality
 */

const {
  UpdateManager,
  getUpdateManager,
  resetUpdateManager,
  UPDATE_STATUS
} = require('./manager');

module.exports = {
  UpdateManager,
  getUpdateManager,
  resetUpdateManager,
  UPDATE_STATUS
};
