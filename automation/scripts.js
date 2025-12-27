/**
 * Automation Scripts Module
 * Defines AutomationScript class and ScriptManager for managing automation scripts
 */

const { v4: uuidv4 } = require('uuid');
const ScriptStorage = require('./storage');
const ScriptRunner = require('./runner');

/**
 * Trigger types for automation scripts
 */
const TRIGGER_TYPES = {
  MANUAL: 'manual',
  ON_LOAD: 'on-load',
  ON_URL_MATCH: 'on-url-match'
};

/**
 * AutomationScript class representing a single automation script
 */
class AutomationScript {
  /**
   * Create a new AutomationScript
   * @param {Object} options - Script options
   * @param {string} options.id - Unique script ID
   * @param {string} options.name - Script name
   * @param {string} options.description - Script description
   * @param {string} options.script - JavaScript code to execute
   * @param {string} options.trigger - Trigger type (manual, on-load, on-url-match)
   * @param {string} options.urlPattern - URL pattern for on-url-match trigger
   * @param {boolean} options.enabled - Whether script is enabled for auto-run
   * @param {Date} options.createdAt - Creation timestamp
   * @param {Date} options.updatedAt - Last update timestamp
   */
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.name = options.name || 'Untitled Script';
    this.description = options.description || '';
    this.script = options.script || '';
    this.trigger = options.trigger || TRIGGER_TYPES.MANUAL;
    this.urlPattern = options.urlPattern || '';
    this.enabled = options.enabled !== undefined ? options.enabled : true;
    this.createdAt = options.createdAt ? new Date(options.createdAt) : new Date();
    this.updatedAt = options.updatedAt ? new Date(options.updatedAt) : new Date();
  }

  /**
   * Update script properties
   * @param {Object} updates - Properties to update
   * @returns {AutomationScript} Updated script
   */
  update(updates) {
    const allowedUpdates = ['name', 'description', 'script', 'trigger', 'urlPattern', 'enabled'];

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        this[key] = updates[key];
      }
    }

    this.updatedAt = new Date();
    return this;
  }

  /**
   * Serialize script to plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      script: this.script,
      trigger: this.trigger,
      urlPattern: this.urlPattern,
      enabled: this.enabled,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  /**
   * Create AutomationScript from plain object
   * @param {Object} data - Plain object data
   * @returns {AutomationScript} Script instance
   */
  static fromJSON(data) {
    return new AutomationScript(data);
  }
}

/**
 * ScriptManager class for managing automation scripts
 */
class ScriptManager {
  /**
   * Create a new ScriptManager
   * @param {Object} options - Manager options
   * @param {string} options.storagePath - Path to storage directory
   * @param {BrowserWindow} options.mainWindow - Main Electron window
   */
  constructor(options = {}) {
    this.scripts = new Map();
    this.storage = new ScriptStorage(options.storagePath);
    this.runner = new ScriptRunner(options.mainWindow);
    this.mainWindow = options.mainWindow;

    // Load scripts on initialization
    this.loadScripts();
  }

  /**
   * Set the main window reference
   * @param {BrowserWindow} mainWindow - Main Electron window
   */
  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
    this.runner.setMainWindow(mainWindow);
  }

  /**
   * Load scripts from storage
   */
  async loadScripts() {
    try {
      const scriptsData = await this.storage.loadAll();
      for (const data of scriptsData) {
        const script = AutomationScript.fromJSON(data);
        this.scripts.set(script.id, script);
      }
      console.log(`[ScriptManager] Loaded ${this.scripts.size} scripts`);
    } catch (error) {
      console.error('[ScriptManager] Error loading scripts:', error);
    }
  }

  /**
   * Save all scripts to storage
   */
  async saveScripts() {
    try {
      const scriptsData = Array.from(this.scripts.values()).map(s => s.toJSON());
      await this.storage.saveAll(scriptsData);
    } catch (error) {
      console.error('[ScriptManager] Error saving scripts:', error);
    }
  }

  /**
   * Create a new automation script
   * @param {string} name - Script name
   * @param {string} script - JavaScript code
   * @param {Object} options - Additional options
   * @returns {Object} Result with script data
   */
  async createScript(name, script, options = {}) {
    try {
      const automationScript = new AutomationScript({
        name,
        script,
        description: options.description || '',
        trigger: options.trigger || TRIGGER_TYPES.MANUAL,
        urlPattern: options.urlPattern || '',
        enabled: options.enabled !== undefined ? options.enabled : true
      });

      this.scripts.set(automationScript.id, automationScript);
      await this.storage.save(automationScript.toJSON());

      console.log(`[ScriptManager] Created script: ${automationScript.name} (${automationScript.id})`);

      return {
        success: true,
        script: automationScript.toJSON()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update an existing script
   * @param {string} id - Script ID
   * @param {Object} updates - Properties to update
   * @returns {Object} Result with updated script data
   */
  async updateScript(id, updates) {
    try {
      const script = this.scripts.get(id);
      if (!script) {
        return {
          success: false,
          error: 'Script not found'
        };
      }

      script.update(updates);
      await this.storage.save(script.toJSON());

      console.log(`[ScriptManager] Updated script: ${script.name} (${script.id})`);

      return {
        success: true,
        script: script.toJSON()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete a script
   * @param {string} id - Script ID
   * @returns {Object} Result
   */
  async deleteScript(id) {
    try {
      const script = this.scripts.get(id);
      if (!script) {
        return {
          success: false,
          error: 'Script not found'
        };
      }

      this.scripts.delete(id);
      await this.storage.delete(id);

      console.log(`[ScriptManager] Deleted script: ${script.name} (${id})`);

      return {
        success: true,
        deletedId: id
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get a script by ID
   * @param {string} id - Script ID
   * @returns {Object} Result with script data
   */
  getScript(id) {
    const script = this.scripts.get(id);
    if (!script) {
      return {
        success: false,
        error: 'Script not found'
      };
    }

    return {
      success: true,
      script: script.toJSON()
    };
  }

  /**
   * List all scripts
   * @param {Object} options - Filter options
   * @returns {Object} Result with scripts array
   */
  listScripts(options = {}) {
    let scripts = Array.from(this.scripts.values());

    // Filter by trigger type
    if (options.trigger) {
      scripts = scripts.filter(s => s.trigger === options.trigger);
    }

    // Filter by enabled status
    if (options.enabled !== undefined) {
      scripts = scripts.filter(s => s.enabled === options.enabled);
    }

    // Sort by name or date
    const sortBy = options.sortBy || 'name';
    const sortOrder = options.sortOrder || 'asc';

    scripts.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'createdAt') {
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
      } else if (sortBy === 'updatedAt') {
        comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return {
      success: true,
      scripts: scripts.map(s => s.toJSON()),
      count: scripts.length
    };
  }

  /**
   * Run a script manually
   * @param {string} id - Script ID
   * @param {Object} context - Execution context
   * @returns {Object} Result with execution output
   */
  async runScript(id, context = {}) {
    const script = this.scripts.get(id);
    if (!script) {
      return {
        success: false,
        error: 'Script not found'
      };
    }

    console.log(`[ScriptManager] Running script: ${script.name} (${id})`);

    return await this.runner.executeScript(script, context);
  }

  /**
   * Enable a script for auto-run
   * @param {string} id - Script ID
   * @returns {Object} Result
   */
  async enableScript(id) {
    return await this.updateScript(id, { enabled: true });
  }

  /**
   * Disable a script from auto-run
   * @param {string} id - Script ID
   * @returns {Object} Result
   */
  async disableScript(id) {
    return await this.updateScript(id, { enabled: false });
  }

  /**
   * Export all scripts as JSON
   * @returns {Object} Result with exported data
   */
  exportScripts() {
    const scripts = Array.from(this.scripts.values()).map(s => s.toJSON());

    return {
      success: true,
      data: {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        scripts
      }
    };
  }

  /**
   * Import scripts from JSON
   * @param {Object} data - Imported data
   * @param {boolean} overwrite - Whether to overwrite existing scripts
   * @returns {Object} Result with import statistics
   */
  async importScripts(data, overwrite = false) {
    try {
      if (!data || !data.scripts || !Array.isArray(data.scripts)) {
        return {
          success: false,
          error: 'Invalid import data format'
        };
      }

      let imported = 0;
      let skipped = 0;
      let updated = 0;

      for (const scriptData of data.scripts) {
        const existingScript = this.scripts.get(scriptData.id);

        if (existingScript) {
          if (overwrite) {
            existingScript.update(scriptData);
            await this.storage.save(existingScript.toJSON());
            updated++;
          } else {
            skipped++;
          }
        } else {
          const script = AutomationScript.fromJSON(scriptData);
          this.scripts.set(script.id, script);
          await this.storage.save(script.toJSON());
          imported++;
        }
      }

      console.log(`[ScriptManager] Imported ${imported} scripts, updated ${updated}, skipped ${skipped}`);

      return {
        success: true,
        imported,
        updated,
        skipped,
        total: data.scripts.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get scripts that should run on page load
   * @returns {AutomationScript[]} Scripts with on-load trigger
   */
  getOnLoadScripts() {
    return Array.from(this.scripts.values()).filter(
      s => s.trigger === TRIGGER_TYPES.ON_LOAD && s.enabled
    );
  }

  /**
   * Get scripts that match a URL
   * @param {string} url - URL to match
   * @returns {AutomationScript[]} Matching scripts
   */
  getMatchingScripts(url) {
    return Array.from(this.scripts.values()).filter(s => {
      if (!s.enabled) return false;
      if (s.trigger !== TRIGGER_TYPES.ON_URL_MATCH) return false;
      return this.runner.matchesUrl(s.urlPattern, url);
    });
  }

  /**
   * Handle page navigation - run matching scripts
   * @param {string} url - Navigated URL
   */
  async onPageNavigate(url) {
    // Run on-load scripts
    const onLoadScripts = this.getOnLoadScripts();
    for (const script of onLoadScripts) {
      console.log(`[ScriptManager] Running on-load script: ${script.name}`);
      await this.runner.executeScript(script, { url, trigger: 'on-load' });
    }

    // Run URL-matching scripts
    const matchingScripts = this.getMatchingScripts(url);
    for (const script of matchingScripts) {
      console.log(`[ScriptManager] Running URL-matching script: ${script.name} for ${url}`);
      await this.runner.executeScript(script, { url, trigger: 'on-url-match' });
    }
  }

  /**
   * Cleanup manager resources
   */
  cleanup() {
    this.scripts.clear();
    console.log('[ScriptManager] Cleanup complete');
  }
}

module.exports = {
  AutomationScript,
  ScriptManager,
  TRIGGER_TYPES
};
