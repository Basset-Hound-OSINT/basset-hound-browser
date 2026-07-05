/**
 * DOM Snapshot WebSocket Commands
 * Registers 7 new commands for complete DOM extraction
 *
 * Commands:
 * - export_dom_tree: Full DOM tree with all properties
 * - export_dom_computed_styles: All elements' computed styles
 * - export_dom_form_state: All form fields current state
 * - export_dom_text_content: All text with structure
 * - export_dom_attributes: All element attributes
 * - export_dom_event_listeners: All registered listeners
 * - export_dom_mutations: Change history since load
 */

const { DOMSnapshotManager } = require('../../src/extraction/dom-snapshot');

/**
 * Register DOM snapshot extraction commands
 * @param {Object} commandHandlers - WebSocket command handlers registry
 * @param {Object} mainWindow - Electron main window
 * @param {Object} options - Configuration options
 */
function registerDOMSnapshotCommands(commandHandlers, mainWindow, options = {}) {
  const snapshotManager = new DOMSnapshotManager();
  const logger = options.logger || console;

  /**
   * export_dom_tree - Extract full DOM tree with all properties
   * Returns: { success, tree, documentTitle, timestamp, bodyClasses }
   */
  commandHandlers.export_dom_tree = async (params = {}) => {
    try {
      if (!mainWindow || !mainWindow.webContents) {
        return { success: false, error: 'Window or webContents not available' };
      }

      const timestamp = new Date().toISOString();
      const maxDepth = (params && params.maxDepth) || 50;
      const includeText = !params || params.includeText !== false;
      const includeComments = params && params.includeComments || false;

      const script = snapshotManager.generateDOMTreeScript({
        maxDepth,
        includeText,
        includeComments
      });

      const result = await mainWindow.webContents.executeJavaScript(script);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          timestamp
        };
      }

      return {
        success: true,
        timestamp,
        tree: result.tree,
        documentTitle: result.documentTitle,
        bodyClasses: result.bodyClasses,
        url: result.url,
        depth: maxDepth
      };
    } catch (error) {
      logger.error('[DOM Snapshot] export_dom_tree error:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * export_dom_computed_styles - Extract computed styles for all elements
   * Returns: { success, styles, totalElements, processedCount, timestamp }
   */
  commandHandlers.export_dom_computed_styles = async (params = {}) => {
    try {
      if (!mainWindow || !mainWindow.webContents) {
        return { success: false, error: 'Window or webContents not available' };
      }

      const timestamp = new Date().toISOString();
      const selector = (params && params.selector) || '*';
      const limit = (params && params.limit) || 5000;

      const script = snapshotManager.generateComputedStylesScript({
        selector,
        limit
      });

      const result = await mainWindow.webContents.executeJavaScript(script);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          timestamp
        };
      }

      return {
        success: true,
        timestamp,
        selector,
        totalElements: result.totalElements,
        processedCount: result.processedCount,
        styles: result.styles
      };
    } catch (error) {
      logger.error('[DOM Snapshot] export_dom_computed_styles error:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * export_dom_form_state - Extract all form fields and their current state
   * Returns: { success, formsCount, forms, timestamp }
   */
  commandHandlers.export_dom_form_state = async (params = {}) => {
    try {
      if (!mainWindow || !mainWindow.webContents) {
        return { success: false, error: 'Window or webContents not available' };
      }

      const timestamp = new Date().toISOString();

      const script = snapshotManager.generateFormStateScript();

      const result = await mainWindow.webContents.executeJavaScript(script);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          timestamp
        };
      }

      return {
        success: true,
        timestamp,
        formsCount: result.formsCount,
        forms: result.forms
      };
    } catch (error) {
      logger.error('[DOM Snapshot] export_dom_form_state error:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * export_dom_text_content - Extract all text content with structure
   * Returns: { success, totalTextElements, textElements, timestamp }
   */
  commandHandlers.export_dom_text_content = async (params = {}) => {
    try {
      if (!mainWindow || !mainWindow.webContents) {
        return { success: false, error: 'Window or webContents not available' };
      }

      const timestamp = new Date().toISOString();
      const includeWhitespace = params && params.includeWhitespace || false;

      const script = snapshotManager.generateTextContentScript({
        includeWhitespace
      });

      const result = await mainWindow.webContents.executeJavaScript(script);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          timestamp
        };
      }

      return {
        success: true,
        timestamp,
        totalTextElements: result.totalTextElements,
        textElements: result.textElements
      };
    } catch (error) {
      logger.error('[DOM Snapshot] export_dom_text_content error:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * export_dom_attributes - Extract all element attributes
   * Returns: { success, attributes, totalElements, processedCount, timestamp }
   */
  commandHandlers.export_dom_attributes = async (params = {}) => {
    try {
      if (!mainWindow || !mainWindow.webContents) {
        return { success: false, error: 'Window or webContents not available' };
      }

      const timestamp = new Date().toISOString();
      const selector = (params && params.selector) || '*';
      const limit = (params && params.limit) || 5000;

      const script = snapshotManager.generateAttributesScript({
        selector,
        limit
      });

      const result = await mainWindow.webContents.executeJavaScript(script);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          timestamp
        };
      }

      return {
        success: true,
        timestamp,
        selector,
        totalElements: result.totalElements,
        processedCount: result.processedCount,
        attributes: result.attributes
      };
    } catch (error) {
      logger.error('[DOM Snapshot] export_dom_attributes error:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * export_dom_event_listeners - Extract registered event listeners
   * Returns: { success, listeners, elementsWithListeners, timestamp, note }
   */
  commandHandlers.export_dom_event_listeners = async (params = {}) => {
    try {
      if (!mainWindow || !mainWindow.webContents) {
        return { success: false, error: 'Window or webContents not available' };
      }

      const timestamp = new Date().toISOString();

      const script = snapshotManager.generateEventListenersScript();

      const result = await mainWindow.webContents.executeJavaScript(script);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          timestamp
        };
      }

      return {
        success: true,
        timestamp,
        elementsWithListeners: result.elementsWithListeners,
        note: result.note,
        listeners: result.listeners
      };
    } catch (error) {
      logger.error('[DOM Snapshot] export_dom_event_listeners error:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * export_dom_mutations - Get DOM mutation history
   * Requires prior call to initialize mutation tracking
   * Returns: { success, mutationCount, mutations, timestamp }
   */
  commandHandlers.export_dom_mutations = async (params = {}) => {
    try {
      if (!mainWindow || !mainWindow.webContents) {
        return { success: false, error: 'Window or webContents not available' };
      }

      const timestamp = new Date().toISOString();
      const action = (params && params.action) || 'get'; // 'init', 'get', 'stop'

      let script;
      if (action === 'init') {
        script = snapshotManager.generateMutationTrackerScript();
      } else if (action === 'stop') {
        script = snapshotManager.generateStopMutationTrackerScript();
      } else {
        script = snapshotManager.generateMutationHistoryScript();
      }

      const result = await mainWindow.webContents.executeJavaScript(script);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          timestamp
        };
      }

      return {
        success: true,
        timestamp,
        action,
        mutationCount: result.mutationCount || 0,
        mutations: result.mutations || [],
        message: result.message || 'OK'
      };
    } catch (error) {
      logger.error('[DOM Snapshot] export_dom_mutations error:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  logger.info('[DOM Snapshot] Registered 7 new DOM snapshot extraction commands');
  return commandHandlers;
}

module.exports = { registerDOMSnapshotCommands, DOMSnapshotManager };
