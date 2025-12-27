/**
 * Script Storage Module
 * Handles saving and loading automation scripts to/from disk
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * ScriptStorage class for persisting automation scripts
 */
class ScriptStorage {
  /**
   * Create a new ScriptStorage
   * @param {string} basePath - Base path for script storage
   */
  constructor(basePath) {
    this.basePath = basePath || path.join(__dirname, 'saved');
    this.indexFile = path.join(this.basePath, 'scripts-index.json');
    this.initialized = false;
  }

  /**
   * Ensure storage directory exists
   */
  async ensureDirectory() {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.basePath, { recursive: true });
      this.initialized = true;
      console.log(`[ScriptStorage] Storage directory ready: ${this.basePath}`);
    } catch (error) {
      console.error('[ScriptStorage] Error creating storage directory:', error);
      throw error;
    }
  }

  /**
   * Get file path for a script
   * @param {string} id - Script ID
   * @returns {string} File path
   */
  getScriptPath(id) {
    return path.join(this.basePath, `${id}.json`);
  }

  /**
   * Save a script to disk
   * @param {Object} scriptData - Script data to save
   */
  async save(scriptData) {
    await this.ensureDirectory();

    const filePath = this.getScriptPath(scriptData.id);

    try {
      await fs.writeFile(filePath, JSON.stringify(scriptData, null, 2), 'utf-8');
      await this.updateIndex(scriptData.id, 'add');
      console.log(`[ScriptStorage] Saved script: ${scriptData.name} (${scriptData.id})`);
    } catch (error) {
      console.error(`[ScriptStorage] Error saving script ${scriptData.id}:`, error);
      throw error;
    }
  }

  /**
   * Load a script from disk
   * @param {string} id - Script ID
   * @returns {Object|null} Script data or null if not found
   */
  async load(id) {
    await this.ensureDirectory();

    const filePath = this.getScriptPath(id);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      console.error(`[ScriptStorage] Error loading script ${id}:`, error);
      throw error;
    }
  }

  /**
   * Load all scripts from disk
   * @returns {Object[]} Array of script data
   */
  async loadAll() {
    await this.ensureDirectory();

    try {
      // Try to read from index first
      const index = await this.loadIndex();
      const scripts = [];

      for (const id of index.scripts || []) {
        try {
          const script = await this.load(id);
          if (script) {
            scripts.push(script);
          }
        } catch (error) {
          console.error(`[ScriptStorage] Error loading script ${id}:`, error);
        }
      }

      // If no index or empty, scan directory
      if (scripts.length === 0) {
        const files = await fs.readdir(this.basePath);
        const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'scripts-index.json');

        for (const file of jsonFiles) {
          try {
            const filePath = path.join(this.basePath, file);
            const data = await fs.readFile(filePath, 'utf-8');
            scripts.push(JSON.parse(data));
          } catch (error) {
            console.error(`[ScriptStorage] Error reading file ${file}:`, error);
          }
        }

        // Rebuild index
        if (scripts.length > 0) {
          await this.rebuildIndex(scripts.map(s => s.id));
        }
      }

      console.log(`[ScriptStorage] Loaded ${scripts.length} scripts`);
      return scripts;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      console.error('[ScriptStorage] Error loading all scripts:', error);
      throw error;
    }
  }

  /**
   * Save all scripts to disk
   * @param {Object[]} scriptsData - Array of script data
   */
  async saveAll(scriptsData) {
    await this.ensureDirectory();

    const ids = [];
    for (const scriptData of scriptsData) {
      await this.save(scriptData);
      ids.push(scriptData.id);
    }

    await this.rebuildIndex(ids);
    console.log(`[ScriptStorage] Saved ${scriptsData.length} scripts`);
  }

  /**
   * Delete a script from disk
   * @param {string} id - Script ID
   */
  async delete(id) {
    await this.ensureDirectory();

    const filePath = this.getScriptPath(id);

    try {
      await fs.unlink(filePath);
      await this.updateIndex(id, 'remove');
      console.log(`[ScriptStorage] Deleted script: ${id}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`[ScriptStorage] Error deleting script ${id}:`, error);
        throw error;
      }
    }
  }

  /**
   * Check if a script exists on disk
   * @param {string} id - Script ID
   * @returns {boolean} Whether script exists
   */
  async exists(id) {
    await this.ensureDirectory();

    const filePath = this.getScriptPath(id);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load the scripts index
   * @returns {Object} Index data
   */
  async loadIndex() {
    try {
      const data = await fs.readFile(this.indexFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { scripts: [], updatedAt: null };
      }
      throw error;
    }
  }

  /**
   * Save the scripts index
   * @param {Object} index - Index data
   */
  async saveIndex(index) {
    await fs.writeFile(this.indexFile, JSON.stringify(index, null, 2), 'utf-8');
  }

  /**
   * Update the scripts index
   * @param {string} id - Script ID
   * @param {string} action - 'add' or 'remove'
   */
  async updateIndex(id, action) {
    const index = await this.loadIndex();

    if (action === 'add') {
      if (!index.scripts.includes(id)) {
        index.scripts.push(id);
      }
    } else if (action === 'remove') {
      index.scripts = index.scripts.filter(s => s !== id);
    }

    index.updatedAt = new Date().toISOString();
    await this.saveIndex(index);
  }

  /**
   * Rebuild the scripts index
   * @param {string[]} ids - Array of script IDs
   */
  async rebuildIndex(ids) {
    const index = {
      scripts: ids,
      updatedAt: new Date().toISOString()
    };
    await this.saveIndex(index);
  }

  /**
   * Clear all stored scripts
   */
  async clearAll() {
    await this.ensureDirectory();

    try {
      const files = await fs.readdir(this.basePath);

      for (const file of files) {
        const filePath = path.join(this.basePath, file);
        await fs.unlink(filePath);
      }

      console.log('[ScriptStorage] Cleared all scripts');
    } catch (error) {
      console.error('[ScriptStorage] Error clearing scripts:', error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage stats
   */
  async getStats() {
    await this.ensureDirectory();

    try {
      const files = await fs.readdir(this.basePath);
      const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'scripts-index.json');

      let totalSize = 0;
      for (const file of jsonFiles) {
        const filePath = path.join(this.basePath, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }

      return {
        scriptCount: jsonFiles.length,
        totalSize,
        storagePath: this.basePath
      };
    } catch (error) {
      return {
        scriptCount: 0,
        totalSize: 0,
        storagePath: this.basePath,
        error: error.message
      };
    }
  }
}

module.exports = ScriptStorage;
