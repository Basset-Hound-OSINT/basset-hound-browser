/**
 * Basset Hound Browser - Recording Storage
 * Handles persistence of recording sessions to disk
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * RecordingStorage class for persisting recordings
 */
class RecordingStorage {
  /**
   * Create a new RecordingStorage
   * @param {string} basePath - Base path for recording storage
   */
  constructor(basePath) {
    this.basePath = basePath || path.join(__dirname, '..', 'recordings');
    this.indexFile = path.join(this.basePath, 'recordings-index.json');
    this.screenshotsPath = path.join(this.basePath, 'screenshots');
    this.initialized = false;
  }

  /**
   * Ensure storage directories exist
   */
  async ensureDirectory() {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.basePath, { recursive: true });
      await fs.mkdir(this.screenshotsPath, { recursive: true });
      this.initialized = true;
      console.log(`[RecordingStorage] Storage directory ready: ${this.basePath}`);
    } catch (error) {
      console.error('[RecordingStorage] Error creating storage directory:', error);
      throw error;
    }
  }

  /**
   * Ensure directory exists synchronously (for module initialization)
   */
  ensureDirectorySync() {
    if (this.initialized) return;

    try {
      if (!fsSync.existsSync(this.basePath)) {
        fsSync.mkdirSync(this.basePath, { recursive: true });
      }
      if (!fsSync.existsSync(this.screenshotsPath)) {
        fsSync.mkdirSync(this.screenshotsPath, { recursive: true });
      }
      this.initialized = true;
    } catch (error) {
      console.error('[RecordingStorage] Error creating storage directory:', error);
    }
  }

  /**
   * Get file path for a recording
   * @param {string} id - Recording ID
   * @returns {string} File path
   */
  getRecordingPath(id) {
    return path.join(this.basePath, `${id}.json`);
  }

  /**
   * Get screenshot directory for a recording
   * @param {string} recordingId
   * @returns {string}
   */
  getScreenshotDir(recordingId) {
    return path.join(this.screenshotsPath, recordingId);
  }

  /**
   * Save a recording to disk
   * @param {Object} recordingData - Recording data to save
   */
  async save(recordingData) {
    await this.ensureDirectory();

    const filePath = this.getRecordingPath(recordingData.id);

    try {
      await fs.writeFile(filePath, JSON.stringify(recordingData, null, 2), 'utf-8');
      await this.updateIndex(recordingData.id, 'add', {
        name: recordingData.name,
        createdAt: recordingData.createdAt,
        actionCount: recordingData.actionCount || recordingData.actions?.length || 0
      });
      console.log(`[RecordingStorage] Saved recording: ${recordingData.name} (${recordingData.id})`);
    } catch (error) {
      console.error(`[RecordingStorage] Error saving recording ${recordingData.id}:`, error);
      throw error;
    }
  }

  /**
   * Load a recording from disk
   * @param {string} id - Recording ID
   * @returns {Object|null} Recording data or null if not found
   */
  async load(id) {
    await this.ensureDirectory();

    const filePath = this.getRecordingPath(id);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      console.error(`[RecordingStorage] Error loading recording ${id}:`, error);
      throw error;
    }
  }

  /**
   * Load all recordings from disk
   * @returns {Object[]} Array of recording data
   */
  async loadAll() {
    await this.ensureDirectory();

    try {
      // Try to read from index first
      const index = await this.loadIndex();
      const recordings = [];

      for (const entry of index.recordings || []) {
        try {
          const recording = await this.load(entry.id);
          if (recording) {
            recordings.push(recording);
          }
        } catch (error) {
          console.error(`[RecordingStorage] Error loading recording ${entry.id}:`, error);
        }
      }

      // If no index or empty, scan directory
      if (recordings.length === 0) {
        const files = await fs.readdir(this.basePath);
        const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'recordings-index.json');

        for (const file of jsonFiles) {
          try {
            const filePath = path.join(this.basePath, file);
            const data = await fs.readFile(filePath, 'utf-8');
            recordings.push(JSON.parse(data));
          } catch (error) {
            console.error(`[RecordingStorage] Error reading file ${file}:`, error);
          }
        }

        // Rebuild index
        if (recordings.length > 0) {
          await this.rebuildIndex(recordings);
        }
      }

      console.log(`[RecordingStorage] Loaded ${recordings.length} recordings`);
      return recordings;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      console.error('[RecordingStorage] Error loading all recordings:', error);
      throw error;
    }
  }

  /**
   * Delete a recording from disk
   * @param {string} id - Recording ID
   */
  async delete(id) {
    await this.ensureDirectory();

    const filePath = this.getRecordingPath(id);

    try {
      await fs.unlink(filePath);
      await this.updateIndex(id, 'remove');

      // Also delete screenshots if any
      const screenshotDir = this.getScreenshotDir(id);
      try {
        await fs.rm(screenshotDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore if screenshots don't exist
      }

      console.log(`[RecordingStorage] Deleted recording: ${id}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`[RecordingStorage] Error deleting recording ${id}:`, error);
        throw error;
      }
    }
  }

  /**
   * Check if a recording exists on disk
   * @param {string} id - Recording ID
   * @returns {boolean}
   */
  async exists(id) {
    await this.ensureDirectory();

    const filePath = this.getRecordingPath(id);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load the recordings index
   * @returns {Object}
   */
  async loadIndex() {
    try {
      const data = await fs.readFile(this.indexFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { recordings: [], updatedAt: null };
      }
      throw error;
    }
  }

  /**
   * Save the recordings index
   * @param {Object} index
   */
  async saveIndex(index) {
    await fs.writeFile(this.indexFile, JSON.stringify(index, null, 2), 'utf-8');
  }

  /**
   * Update the recordings index
   * @param {string} id - Recording ID
   * @param {string} action - 'add' or 'remove'
   * @param {Object} metadata - Recording metadata (for add)
   */
  async updateIndex(id, action, metadata = {}) {
    const index = await this.loadIndex();

    if (action === 'add') {
      // Remove existing entry if present
      index.recordings = index.recordings.filter(r => r.id !== id);
      // Add new entry
      index.recordings.push({
        id,
        name: metadata.name || '',
        createdAt: metadata.createdAt || new Date().toISOString(),
        actionCount: metadata.actionCount || 0
      });
    } else if (action === 'remove') {
      index.recordings = index.recordings.filter(r => r.id !== id);
    }

    index.updatedAt = new Date().toISOString();
    await this.saveIndex(index);
  }

  /**
   * Rebuild the recordings index
   * @param {Object[]} recordings
   */
  async rebuildIndex(recordings) {
    const index = {
      recordings: recordings.map(r => ({
        id: r.id,
        name: r.name || '',
        createdAt: r.createdAt || new Date().toISOString(),
        actionCount: r.actionCount || r.actions?.length || 0
      })),
      updatedAt: new Date().toISOString()
    };
    await this.saveIndex(index);
  }

  /**
   * Save a screenshot for a recording
   * @param {string} recordingId
   * @param {string} screenshotName
   * @param {string} data - Base64 image data
   * @returns {string} Path to saved screenshot
   */
  async saveScreenshot(recordingId, screenshotName, data) {
    const screenshotDir = this.getScreenshotDir(recordingId);
    await fs.mkdir(screenshotDir, { recursive: true });

    const filename = `${screenshotName}.png`;
    const filePath = path.join(screenshotDir, filename);

    // Extract base64 data if it includes data URL prefix
    const base64Data = data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await fs.writeFile(filePath, buffer);

    return filePath;
  }

  /**
   * Load a screenshot for a recording
   * @param {string} recordingId
   * @param {string} screenshotName
   * @returns {string|null} Base64 image data or null
   */
  async loadScreenshot(recordingId, screenshotName) {
    const filename = screenshotName.endsWith('.png') ? screenshotName : `${screenshotName}.png`;
    const filePath = path.join(this.getScreenshotDir(recordingId), filename);

    try {
      const buffer = await fs.readFile(filePath);
      return `data:image/png;base64,${buffer.toString('base64')}`;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * List screenshots for a recording
   * @param {string} recordingId
   * @returns {string[]} Array of screenshot names
   */
  async listScreenshots(recordingId) {
    const screenshotDir = this.getScreenshotDir(recordingId);

    try {
      const files = await fs.readdir(screenshotDir);
      return files.filter(f => f.endsWith('.png'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Clear all stored recordings
   */
  async clearAll() {
    await this.ensureDirectory();

    try {
      const files = await fs.readdir(this.basePath);

      for (const file of files) {
        const filePath = path.join(this.basePath, file);
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
          await fs.rm(filePath, { recursive: true, force: true });
        } else {
          await fs.unlink(filePath);
        }
      }

      console.log('[RecordingStorage] Cleared all recordings');
    } catch (error) {
      console.error('[RecordingStorage] Error clearing recordings:', error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   * @returns {Object}
   */
  async getStats() {
    await this.ensureDirectory();

    try {
      const files = await fs.readdir(this.basePath);
      const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'recordings-index.json');

      let totalSize = 0;
      for (const file of jsonFiles) {
        const filePath = path.join(this.basePath, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }

      // Count screenshots
      let screenshotCount = 0;
      let screenshotSize = 0;
      try {
        const screenshotDirs = await fs.readdir(this.screenshotsPath);
        for (const dir of screenshotDirs) {
          const dirPath = path.join(this.screenshotsPath, dir);
          const dirStats = await fs.stat(dirPath);
          if (dirStats.isDirectory()) {
            const screenshots = await fs.readdir(dirPath);
            screenshotCount += screenshots.length;
            for (const screenshot of screenshots) {
              const screenshotStats = await fs.stat(path.join(dirPath, screenshot));
              screenshotSize += screenshotStats.size;
            }
          }
        }
      } catch (e) {
        // Screenshots dir may not exist
      }

      return {
        recordingCount: jsonFiles.length,
        totalSize,
        screenshotCount,
        screenshotSize,
        storagePath: this.basePath
      };
    } catch (error) {
      return {
        recordingCount: 0,
        totalSize: 0,
        screenshotCount: 0,
        screenshotSize: 0,
        storagePath: this.basePath,
        error: error.message
      };
    }
  }

  /**
   * Export all recordings as a bundle
   * @returns {Object}
   */
  async exportAll() {
    const recordings = await this.loadAll();
    const stats = await this.getStats();

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      stats,
      recordings
    };
  }

  /**
   * Import recordings from a bundle
   * @param {Object} bundle
   * @param {boolean} overwrite
   * @returns {Object}
   */
  async importAll(bundle, overwrite = false) {
    if (!bundle || !bundle.recordings || !Array.isArray(bundle.recordings)) {
      throw new Error('Invalid bundle format');
    }

    let imported = 0;
    let skipped = 0;

    for (const recording of bundle.recordings) {
      const exists = await this.exists(recording.id);

      if (exists && !overwrite) {
        skipped++;
        continue;
      }

      await this.save(recording);
      imported++;
    }

    return {
      imported,
      skipped,
      total: bundle.recordings.length
    };
  }
}

module.exports = RecordingStorage;
