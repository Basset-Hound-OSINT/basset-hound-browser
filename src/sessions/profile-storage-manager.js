/**
 * Basset Hound Browser - Profile State Storage Manager
 * Per-profile session state persistence with versioning and lifecycle integration
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 *
 * Provides:
 * - Per-profile state storage and retrieval
 * - State versioning and compatibility checking
 * - Automatic cleanup of old states
 * - Lifecycle integration with profile management
 */

const crypto = require('crypto');

/**
 * Profile-based Session State Storage Manager
 * Manages storage, versioning, and lifecycle of session states
 *
 * @class ProfileStateStorageManager
 */
class ProfileStateStorageManager {
  constructor(options = {}) {
    this.sessionStorage = options.sessionStorage || null; // External SessionStorage instance
    this.profileManager = options.profileManager || null;
    this.sessionManager = options.sessionManager || null;
    this.compressionManager = options.compressionManager || null;
    this.logger = options.logger || console;

    // Default cleanup rules
    this.defaultCleanupRules = {
      maxAge: 7 * 24 * 3600 * 1000, // 7 days
      maxCount: 10, // Keep last 10 states
      maxSize: 500 * 1024 * 1024 // 500 MB total per profile
    };

    // State metadata storage
    this.stateMetadata = new Map(); // profileId -> {states: Array, lastCleanup: timestamp}
  }

  /**
   * Initialize with external dependencies
   * @param {SessionStorage} sessionStorage
   * @param {ProfileManager} profileManager
   * @param {SessionManager} sessionManager
   * @param {SessionCompressionManager} compressionManager
   */
  initialize(sessionStorage, profileManager, sessionManager, compressionManager) {
    this.sessionStorage = sessionStorage;
    this.profileManager = profileManager;
    this.sessionManager = sessionManager;
    this.compressionManager = compressionManager;
  }

  /**
   * Save session state for profile
   * @param {string} profileId
   * @param {Object} state - Captured state
   * @param {Object} metadata - {description, tags}
   * @returns {Promise<string>} - State ID
   */
  async saveSessionState(profileId, state, metadata = {}) {
    if (!profileId || !state) {
      throw new Error('profileId and state are required');
    }

    try {
      // Validate profile exists
      if (this.profileManager && !await this.isValidProfile(profileId)) {
        this.logger.warn(`Profile ${profileId} may not exist, continuing anyway`);
      }

      // Generate unique state ID
      const stateId = crypto.randomBytes(8).toString('hex');
      const now = Date.now();

      // Prepare state for storage
      const stateForStorage = {
        stateId,
        profileId,
        createdAt: now,
        state: state,
        metadata: {
          ...metadata,
          version: 1,
          description: metadata.description || '',
          tags: metadata.tags || [],
          url: state.url || '',
          timestamp: now
        }
      };

      // Calculate size
      const stateJson = JSON.stringify(state);
      const sizeBytes = Buffer.byteLength(stateJson, 'utf8');
      stateForStorage.metadata.sizeBytes = sizeBytes;

      // Store in session storage
      const storageKey = this.buildStorageKey(profileId, stateId);
      await this.sessionStorage.save(storageKey, stateForStorage);

      // Update metadata index
      await this.updateStateMetadata(profileId, stateId, sizeBytes);

      // Perform auto-cleanup if needed
      await this.autocleanup(profileId);

      this.logger.info(`Saved session state ${stateId} for profile ${profileId} (${sizeBytes} bytes)`);
      return stateId;
    } catch (error) {
      this.logger.error(`Failed to save session state: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load most recent state for profile
   * @param {string} profileId
   * @param {string} stateId - Optional, loads most recent if omitted
   * @returns {Promise<Object>} - {state, metadata, id}
   */
  async loadSessionState(profileId, stateId = null) {
    if (!profileId) {
      throw new Error('profileId is required');
    }

    try {
      // If stateId is provided, load that specific state
      if (stateId) {
        const storageKey = this.buildStorageKey(profileId, stateId);
        const stored = await this.sessionStorage.get(storageKey);

        if (!stored) {
          throw new Error(`State not found: ${stateId}`);
        }

        return {
          state: stored.state,
          metadata: stored.metadata,
          id: stateId
        };
      }

      // Otherwise, load most recent state
      const states = await this.listSessionStates(profileId);
      if (states.length === 0) {
        throw new Error(`No saved states found for profile: ${profileId}`);
      }

      // States are sorted by creation time (newest first)
      const mostRecent = states[0];
      const storageKey = this.buildStorageKey(profileId, mostRecent.state_id);
      const stored = await this.sessionStorage.get(storageKey);

      return {
        state: stored.state,
        metadata: stored.metadata,
        id: mostRecent.state_id
      };
    } catch (error) {
      this.logger.error(`Failed to load session state: ${error.message}`);
      throw error;
    }
  }

  /**
   * List all saved states for profile
   * @param {string} profileId
   * @returns {Promise<Array>} - Array of {state_id, created, size_bytes, url, description, tags}
   */
  async listSessionStates(profileId) {
    if (!profileId) {
      throw new Error('profileId is required');
    }

    try {
      const metadataKey = `session:state:${profileId}:history`;
      const historyData = await this.sessionStorage.get(metadataKey);

      if (!historyData || !Array.isArray(historyData.states)) {
        return [];
      }

      // Sort by creation time (newest first)
      return historyData.states.sort((a, b) => (b.created || 0) - (a.created || 0)).map(item => ({
        state_id: item.stateId,
        created: new Date(item.created).toISOString(),
        age_seconds: Math.round((Date.now() - item.created) / 1000),
        size_bytes: item.sizeBytes || 0,
        url: item.url || '',
        description: item.description || '',
        tags: item.tags || [],
        compressed: item.compressed || false
      }));
    } catch (error) {
      this.logger.warn(`Failed to list session states: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete specific state
   * @param {string} profileId
   * @param {string} stateId
   * @returns {Promise<boolean>}
   */
  async deleteSessionState(profileId, stateId) {
    if (!profileId || !stateId) {
      throw new Error('profileId and stateId are required');
    }

    try {
      const storageKey = this.buildStorageKey(profileId, stateId);
      await this.sessionStorage.delete(storageKey);

      // Update metadata index
      const metadataKey = `session:state:${profileId}:history`;
      const historyData = await this.sessionStorage.get(metadataKey);

      if (historyData && Array.isArray(historyData.states)) {
        historyData.states = historyData.states.filter(s => s.stateId !== stateId);
        await this.sessionStorage.save(metadataKey, historyData);
      }

      this.logger.info(`Deleted session state ${stateId} for profile ${profileId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete session state: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get state metadata (size, age, version)
   * @param {string} profileId
   * @param {string} stateId
   * @returns {Promise<Object>} - {size, age, version, created, compressed}
   */
  async getStateMetadata(profileId, stateId) {
    if (!profileId || !stateId) {
      throw new Error('profileId and stateId are required');
    }

    try {
      const storageKey = this.buildStorageKey(profileId, stateId);
      const stored = await this.sessionStorage.get(storageKey);

      if (!stored) {
        throw new Error(`State not found: ${stateId}`);
      }

      const created = stored.metadata.timestamp || stored.createdAt;
      const age = Date.now() - created;

      return {
        size: stored.metadata.sizeBytes || 0,
        age: Math.round(age / 1000),
        version: stored.metadata.version || 1,
        created: new Date(created).toISOString(),
        compressed: stored.metadata.compressed || false,
        url: stored.metadata.url || '',
        description: stored.metadata.description || '',
        tags: stored.metadata.tags || []
      };
    } catch (error) {
      this.logger.error(`Failed to get state metadata: ${error.message}`);
      throw error;
    }
  }

  /**
   * Auto-cleanup old states
   * @param {string} profileId
   * @param {Object} rules - {maxAge: ms, maxCount: int, maxSize: bytes}
   * @returns {Promise<number>} - States deleted
   */
  async autocleanup(profileId, rules = {}) {
    const mergedRules = { ...this.defaultCleanupRules, ...rules };

    try {
      const states = await this.listSessionStates(profileId);
      let deleted = 0;
      let totalSize = 0;

      // Check size first
      for (const state of states) {
        totalSize += state.size_bytes || 0;
      }

      // Delete oldest states if total size exceeded
      if (totalSize > mergedRules.maxSize) {
        for (let i = states.length - 1; i >= 0 && totalSize > mergedRules.maxSize; i--) {
          const state = states[i];
          await this.deleteSessionState(profileId, state.state_id);
          totalSize -= (state.size_bytes || 0);
          deleted++;
        }
      }

      // Delete old states beyond maxAge
      const now = Date.now();
      for (const state of states) {
        const ageMs = now - new Date(state.created).getTime();
        if (ageMs > mergedRules.maxAge) {
          await this.deleteSessionState(profileId, state.state_id);
          deleted++;
        }
      }

      // Keep only last maxCount states
      if (states.length > mergedRules.maxCount) {
        for (let i = mergedRules.maxCount; i < states.length; i++) {
          await this.deleteSessionState(profileId, states[i].state_id);
          deleted++;
        }
      }

      if (deleted > 0) {
        this.logger.info(`Auto-cleanup deleted ${deleted} states for profile ${profileId}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Auto-cleanup failed: ${error.message}`);
      return 0;
    }
  }

  /**
   * Validate state before restore
   * @param {Object} state
   * @returns {Object} - {valid, errors, warnings}
   */
  validateStateIntegrity(state) {
    const errors = [];
    const warnings = [];

    if (!state || typeof state !== 'object') {
      errors.push('State is not a valid object');
      return { valid: false, errors, warnings };
    }

    // Check required fields
    if (!state.capturedAt) {
      errors.push('Missing capturedAt timestamp');
    }

    if (!state.sessionId) {
      errors.push('Missing sessionId');
    }

    // Check components
    if (!Array.isArray(state.cookies)) {
      warnings.push('Cookies field is missing or not an array');
    }

    if (!state.localStorage || typeof state.localStorage !== 'object') {
      warnings.push('localStorage field is missing or invalid');
    }

    if (!state.sessionStorage || typeof state.sessionStorage !== 'object') {
      warnings.push('sessionStorage field is missing or invalid');
    }

    if (!state.metadata) {
      warnings.push('Metadata field is missing');
    } else if (state.metadata.version && state.metadata.version !== 1) {
      warnings.push(`Unexpected version: ${state.metadata.version}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Update state metadata index
   * @private
   * @param {string} profileId
   * @param {string} stateId
   * @param {number} sizeBytes
   */
  async updateStateMetadata(profileId, stateId, sizeBytes) {
    try {
      const metadataKey = `session:state:${profileId}:history`;
      const historyData = await this.sessionStorage.get(metadataKey) || { states: [] };

      if (!Array.isArray(historyData.states)) {
        historyData.states = [];
      }

      // Add new state to history
      historyData.states.push({
        stateId,
        created: Date.now(),
        sizeBytes,
        compressed: false
      });

      // Keep history clean (limit to last 50)
      if (historyData.states.length > 50) {
        historyData.states = historyData.states.slice(-50);
      }

      await this.sessionStorage.save(metadataKey, historyData);
    } catch (error) {
      this.logger.warn(`Failed to update state metadata: ${error.message}`);
    }
  }

  /**
   * Check if profile is valid
   * @private
   * @param {string} profileId
   */
  async isValidProfile(profileId) {
    if (!this.profileManager) return true; // No validation if profileManager not available

    try {
      const profile = await this.profileManager.getProfile(profileId);
      return !!profile;
    } catch (e) {
      return false;
    }
  }

  /**
   * Build storage key for state
   * @private
   * @param {string} profileId
   * @param {string} stateId
   * @returns {string}
   */
  buildStorageKey(profileId, stateId) {
    return `session:state:data:${profileId}:${stateId}`;
  }
}

module.exports = ProfileStateStorageManager;
