/**
 * WebSocket Commands for Advanced Cookie Management
 *
 * @module websocket/commands/cookie-commands
 */

const { CookieManager } = require('../../cookies/cookie-manager');

// Global cookie manager instance
let cookieManager = null;

/**
 * Register cookie management WebSocket commands
 */
function registerCookieCommands(server, mainWindow) {
  const commandHandlers = server.commandHandlers || server;

  // Initialize manager
  if (!cookieManager) {
    cookieManager = new CookieManager(mainWindow.webContents);
  }

  /**
   * Create cookie jar
   *
   * Command: create_cookie_jar
   * Params: { name: string, isolated?: boolean, syncEnabled?: boolean, metadata?: {} }
   * Response: { jar: {} }
   */
  commandHandlers.create_cookie_jar = async (params) => {
    try {
      if (!params.name) {
        throw new Error('name is required');
      }

      const jar = cookieManager.createJar(params.name, {
        isolated: params.isolated,
        syncEnabled: params.syncEnabled,
        metadata: params.metadata
      });

      return {
        success: true,
        jar: jar
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Delete cookie jar
   *
   * Command: delete_cookie_jar
   * Params: { name: string }
   * Response: { success: true }
   */
  commandHandlers.delete_cookie_jar = async (params) => {
    try {
      if (!params.name) {
        throw new Error('name is required');
      }

      await cookieManager.deleteJar(params.name);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * List cookie jars
   *
   * Command: list_cookie_jars
   * Response: { jars: [] }
   */
  commandHandlers.list_cookie_jars = async (params) => {
    try {
      const jars = cookieManager.listJars();

      return {
        success: true,
        jars: jars,
        count: jars.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Switch cookie jar
   *
   * Command: switch_cookie_jar
   * Params: { name: string, saveCurrent?: boolean, loadTarget?: boolean }
   * Response: { previousJar: string, currentJar: string, cookiesLoaded: number }
   */
  commandHandlers.switch_cookie_jar = async (params) => {
    try {
      if (!params.name) {
        throw new Error('name is required');
      }

      const result = await cookieManager.switchJar(params.name, {
        saveCurrent: params.saveCurrent,
        loadTarget: params.loadTarget
      });

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Save cookies to jar
   *
   * Command: save_to_cookie_jar
   * Params: { jar: string }
   * Response: { jarName: string, cookieCount: number }
   */
  commandHandlers.save_to_cookie_jar = async (params) => {
    try {
      if (!params.jar) {
        throw new Error('jar is required');
      }

      const result = await cookieManager.saveToJar(params.jar);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Load cookies from jar
   *
   * Command: load_from_cookie_jar
   * Params: { jar: string }
   * Response: { jarName: string, loaded: number, failed: number }
   */
  commandHandlers.load_from_cookie_jar = async (params) => {
    try {
      if (!params.jar) {
        throw new Error('jar is required');
      }

      const result = await cookieManager.loadFromJar(params.jar);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Sync cookie jars
   *
   * Command: sync_cookie_jars
   * Params: { source: string, target: string, mode?: 'merge'|'replace'|'update', filter?: {} }
   * Response: { added: number, updated: number, skipped: number }
   */
  commandHandlers.sync_cookie_jars = async (params) => {
    try {
      if (!params.source || !params.target) {
        throw new Error('source and target are required');
      }

      let filter = undefined;
      if (params.filter) {
        // Create filter function from options
        filter = (cookie) => {
          if (params.filter.domain && !cookie.domain.includes(params.filter.domain)) {
            return false;
          }
          if (params.filter.name && !cookie.name.includes(params.filter.name)) {
            return false;
          }
          if (params.filter.secure !== undefined && cookie.secure !== params.filter.secure) {
            return false;
          }
          return true;
        };
      }

      const result = await cookieManager.syncJars(params.source, params.target, {
        mode: params.mode,
        filter: filter
      });

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Analyze cookie security
   *
   * Command: analyze_cookie_security
   * Params: { name?: string, domain?: string }
   * Response: { analysis: {} }
   */
  commandHandlers.analyze_cookie_security = async (params) => {
    try {
      const cookies = await mainWindow.webContents.session.cookies.get({
        name: params.name,
        domain: params.domain
      });

      if (cookies.length === 0) {
        throw new Error('Cookie not found');
      }

      const analysis = cookieManager.analyzeCookieSecurity(cookies[0]);

      return {
        success: true,
        analysis: analysis
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Analyze all cookies
   *
   * Command: analyze_all_cookies
   * Params: { includeDetails?: boolean }
   * Response: { summary: {}, analyses: [], overallScore: number }
   */
  commandHandlers.analyze_all_cookies = async (params) => {
    try {
      const analysis = await cookieManager.analyzeAllCookies({
        includeDetails: params.includeDetails
      });

      return {
        success: true,
        ...analysis
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Export cookies
   *
   * Command: export_cookies
   * Params: { format?: 'json'|'netscape'|'csv'|'curl', jar?: string, includeMetadata?: boolean }
   * Response: { data: string|object, format: string }
   */
  commandHandlers.export_cookies = async (params) => {
    try {
      const data = await cookieManager.exportCookies({
        format: params.format,
        jar: params.jar,
        includeMetadata: params.includeMetadata,
        url: params.url,
        stringify: params.stringify
      });

      return {
        success: true,
        data: data,
        format: params.format || 'json'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Import cookies
   *
   * Command: import_cookies
   * Params: { data: string|object, format?: 'json'|'netscape'|'csv', jar?: string, mode?: 'merge'|'replace' }
   * Response: { imported: number, failed?: number }
   */
  commandHandlers.import_cookies = async (params) => {
    try {
      if (!params.data) {
        throw new Error('data is required');
      }

      const result = await cookieManager.importCookies(params.data, {
        format: params.format,
        jar: params.jar,
        mode: params.mode
      });

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get cookie history
   *
   * Command: get_cookie_history
   * Params: { action?: string, domain?: string, jar?: string, limit?: number }
   * Response: { history: [], count: number }
   */
  commandHandlers.get_cookie_history = async (params) => {
    try {
      const history = cookieManager.getHistory({
        action: params.action,
        domain: params.domain,
        jar: params.jar,
        limit: params.limit
      });

      return {
        success: true,
        history: history,
        count: history.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Clear all cookies
   *
   * Command: clear_all_cookies
   * Response: { cleared: number }
   */
  commandHandlers.clear_all_cookies = async (params) => {
    try {
      const result = await cookieManager.clearAllCookies();

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get cookie manager statistics
   *
   * Command: get_cookie_manager_stats
   * Response: { stats: {} }
   */
  commandHandlers.get_cookie_manager_stats = async (params) => {
    try {
      const stats = cookieManager.getStatistics();

      return {
        success: true,
        stats: stats
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Find insecure cookies
   *
   * Command: find_insecure_cookies
   * Response: { insecure: [] }
   */
  commandHandlers.find_insecure_cookies = async (params) => {
    try {
      const analysis = await cookieManager.analyzeAllCookies({ includeDetails: true });
      const insecure = analysis.analyses.filter(a =>
        a.issues.length > 0 || a.securityLevel !== 'none'
      );

      return {
        success: true,
        insecure: insecure,
        count: insecure.length,
        total: analysis.summary.total
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get cookies by classification
   *
   * Command: get_cookies_by_classification
   * Params: { classification: string }
   * Response: { cookies: [] }
   */
  commandHandlers.get_cookies_by_classification = async (params) => {
    try {
      if (!params.classification) {
        throw new Error('classification is required');
      }

      const analysis = await cookieManager.analyzeAllCookies({ includeDetails: true });
      const filtered = analysis.analyses.filter(a =>
        a.classification === params.classification
      );

      return {
        success: true,
        cookies: filtered,
        count: filtered.length,
        classification: params.classification
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

module.exports = { registerCookieCommands };
