/**
 * WebSocket Commands for Multi-Page Management
 *
 * @module websocket/commands/multi-page-commands
 */

const { MultiPageManager } = require('../../multi-page/multi-page-manager');

// Global multi-page manager instance
let multiPageManager = null;

/**
 * Register multi-page management WebSocket commands
 */
function registerMultiPageCommands(server, mainWindow) {
  const commandHandlers = server.commandHandlers || server;

  /**
   * Initialize multi-page manager
   *
   * Command: init_multi_page
   * Params: { profile?: 'stealth'|'balanced'|'aggressive'|'single', config?: {} }
   * Response: { initialized: true, config: {} }
   */
  commandHandlers.init_multi_page = async (params) => {
    try {
      if (multiPageManager) {
        return { success: false, error: 'Multi-page manager already initialized' };
      }

      multiPageManager = new MultiPageManager(mainWindow, {
        profile: params.profile,
        ...params.config
      });

      // Setup event forwarding
      multiPageManager.on('page-created', (data) => {
        server.broadcast('multi_page_event', { type: 'page-created', ...data });
      });

      multiPageManager.on('page-destroyed', (data) => {
        server.broadcast('multi_page_event', { type: 'page-destroyed', ...data });
      });

      multiPageManager.on('page-loaded', (data) => {
        server.broadcast('multi_page_event', { type: 'page-loaded', ...data });
      });

      multiPageManager.on('page-load-failed', (data) => {
        server.broadcast('multi_page_event', { type: 'page-load-failed', ...data });
      });

      multiPageManager.on('active-page-changed', (data) => {
        server.broadcast('multi_page_event', { type: 'active-page-changed', ...data });
      });

      multiPageManager.on('resource-warning', (data) => {
        server.broadcast('multi_page_event', { type: 'resource-warning', ...data });
      });

      return {
        success: true,
        initialized: true,
        config: multiPageManager.config
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Create a new page
   *
   * Command: create_page
   * Params: { partition?: string, metadata?: {}, webPreferences?: {} }
   * Response: { pageId: string }
   */
  commandHandlers.create_page = async (params) => {
    try {
      if (!multiPageManager) {
        throw new Error('Multi-page manager not initialized. Call init_multi_page first.');
      }

      const pageId = await multiPageManager.createPage({
        partition: params.partition,
        metadata: params.metadata,
        webPreferences: params.webPreferences
      });

      return {
        success: true,
        pageId: pageId
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Navigate page to URL
   *
   * Command: navigate_page
   * Params: { pageId: string, url: string, options?: {} }
   * Response: { pageId: string, url: string }
   */
  commandHandlers.navigate_page = async (params) => {
    try {
      if (!multiPageManager) {
        throw new Error('Multi-page manager not initialized');
      }

      if (!params.pageId || !params.url) {
        throw new Error('pageId and url are required');
      }

      const result = await multiPageManager.navigatePage(
        params.pageId,
        params.url,
        params.options
      );

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Set active page
   *
   * Command: set_active_page
   * Params: { pageId: string }
   * Response: { pageId: string }
   */
  commandHandlers.set_active_page = async (params) => {
    try {
      if (!multiPageManager) {
        throw new Error('Multi-page manager not initialized');
      }

      if (!params.pageId) {
        throw new Error('pageId is required');
      }

      const result = multiPageManager.setActivePage(params.pageId);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get page info
   *
   * Command: get_page_info
   * Params: { pageId: string }
   * Response: { page: {} }
   */
  commandHandlers.get_page_info = async (params) => {
    try {
      if (!multiPageManager) {
        throw new Error('Multi-page manager not initialized');
      }

      if (!params.pageId) {
        throw new Error('pageId is required');
      }

      const page = multiPageManager.getPage(params.pageId);

      if (!page) {
        throw new Error(`Page not found: ${params.pageId}`);
      }

      return {
        success: true,
        page: page
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * List all pages
   *
   * Command: list_pages
   * Response: { pages: [], count: number }
   */
  commandHandlers.list_pages = async (params) => {
    try {
      if (!multiPageManager) {
        throw new Error('Multi-page manager not initialized');
      }

      const pages = multiPageManager.listPages();

      return {
        success: true,
        pages: pages,
        count: pages.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Destroy page
   *
   * Command: destroy_page
   * Params: { pageId: string }
   * Response: { success: true }
   */
  commandHandlers.destroy_page = async (params) => {
    try {
      if (!multiPageManager) {
        throw new Error('Multi-page manager not initialized');
      }

      if (!params.pageId) {
        throw new Error('pageId is required');
      }

      await multiPageManager.destroyPage(params.pageId);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Execute JavaScript on page
   *
   * Command: execute_on_page
   * Params: { pageId: string, code: string }
   * Response: { result: any }
   */
  commandHandlers.execute_on_page = async (params) => {
    try {
      if (!multiPageManager) {
        throw new Error('Multi-page manager not initialized');
      }

      if (!params.pageId || !params.code) {
        throw new Error('pageId and code are required');
      }

      const result = await multiPageManager.executeOnPage(params.pageId, params.code);

      return {
        success: true,
        result: result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get page screenshot
   *
   * Command: get_page_screenshot
   * Params: { pageId: string, options?: {} }
   * Response: { screenshot: string (base64) }
   */
  commandHandlers.get_page_screenshot = async (params) => {
    try {
      if (!multiPageManager) {
        throw new Error('Multi-page manager not initialized');
      }

      if (!params.pageId) {
        throw new Error('pageId is required');
      }

      const image = await multiPageManager.getPageScreenshot(params.pageId, params.options);
      const base64 = image.toDataURL();

      return {
        success: true,
        screenshot: base64,
        pageId: params.pageId
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Close all pages except specified ones
   *
   * Command: close_other_pages
   * Params: { keepPageIds: string[] }
   * Response: { closed: number }
   */
  commandHandlers.close_other_pages = async (params) => {
    try {
      if (!multiPageManager) {
        throw new Error('Multi-page manager not initialized');
      }

      const result = await multiPageManager.closeOtherPages(params.keepPageIds || []);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Close all pages
   *
   * Command: close_all_pages
   * Response: { closed: number }
   */
  commandHandlers.close_all_pages = async (params) => {
    try {
      if (!multiPageManager) {
        throw new Error('Multi-page manager not initialized');
      }

      const result = await multiPageManager.closeAllPages();

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get multi-page statistics
   *
   * Command: get_multi_page_stats
   * Response: { stats: {} }
   */
  commandHandlers.get_multi_page_stats = async (params) => {
    try {
      if (!multiPageManager) {
        throw new Error('Multi-page manager not initialized');
      }

      const stats = multiPageManager.getStatistics();

      return {
        success: true,
        stats: stats
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Update multi-page configuration
   *
   * Command: update_multi_page_config
   * Params: { config: {} }
   * Response: { config: {} }
   */
  commandHandlers.update_multi_page_config = async (params) => {
    try {
      if (!multiPageManager) {
        throw new Error('Multi-page manager not initialized');
      }

      if (!params.config) {
        throw new Error('config is required');
      }

      await multiPageManager.updateConfig(params.config);

      return {
        success: true,
        config: multiPageManager.config
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Navigate multiple pages concurrently
   *
   * Command: navigate_pages_batch
   * Params: { navigations: [{ pageId: string, url: string, options?: {} }] }
   * Response: { results: [] }
   */
  commandHandlers.navigate_pages_batch = async (params) => {
    try {
      if (!multiPageManager) {
        throw new Error('Multi-page manager not initialized');
      }

      if (!params.navigations || !Array.isArray(params.navigations)) {
        throw new Error('navigations array is required');
      }

      const promises = params.navigations.map(nav =>
        multiPageManager.navigatePage(nav.pageId, nav.url, nav.options)
          .then(result => ({ success: true, ...result }))
          .catch(error => ({ success: false, error: error.message, pageId: nav.pageId }))
      );

      const results = await Promise.all(promises);

      return {
        success: true,
        results: results,
        total: results.length,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Shutdown multi-page manager
   *
   * Command: shutdown_multi_page
   * Response: { success: true }
   */
  commandHandlers.shutdown_multi_page = async (params) => {
    try {
      if (!multiPageManager) {
        return { success: true, message: 'Multi-page manager not initialized' };
      }

      await multiPageManager.shutdown();
      multiPageManager = null;

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

module.exports = { registerMultiPageCommands };
