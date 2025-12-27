/**
 * Basset Hound Browser - Window Orchestration Module
 * Exports WindowManager and WindowPool for multi-window browser automation
 */

const { WindowManager, WindowState, BrowserWindowWrapper, generateWindowId } = require('./manager');
const { WindowPool, PoolEntryState } = require('./pool');

module.exports = {
  WindowManager,
  WindowState,
  BrowserWindowWrapper,
  generateWindowId,
  WindowPool,
  PoolEntryState
};
