/**
 * FingerprintProfileManager
 *
 * Manages multiple fingerprint profiles with persistence and caching.
 */

const crypto = require('crypto');

const { FingerprintProfile } = require('./fingerprint-profile');

/**
 * FingerprintProfileManager
 *
 * Manages multiple fingerprint profiles with persistence and caching
 */
class FingerprintProfileManager {
  constructor() {
    this.profiles = new Map();
    this.activeProfileId = null;

    // Profile caching layer (by seed for reproducible profiles)
    this.profileCache = new Map();
    this.configCache = new Map();
    this.scriptCache = new Map();

    // Cache statistics
    this.cacheStats = {
      hits: 0,
      misses: 0,
      size: 0,
      maxSize: 1000 // Maximum number of cached profiles
    };
  }

  /**
   * Create a new profile with caching support
   */
  createProfile(options = {}) {
    // Check cache first if seed is provided
    if (options.seed && this.profileCache.has(options.seed)) {
      this.cacheStats.hits++;
      const cachedProfile = this.profileCache.get(options.seed);
      const id = options.id || `fp_${crypto.randomBytes(8).toString('hex')}`;
      this.profiles.set(id, cachedProfile);
      return { id, profile: cachedProfile };
    }

    this.cacheStats.misses++;

    const profile = new FingerprintProfile(options);
    const id = options.id || `fp_${crypto.randomBytes(8).toString('hex')}`;

    this.profiles.set(id, profile);

    // Cache the profile by seed if reproducible
    if (profile.seed) {
      this._addToCache(profile.seed, profile, id);
    }

    return { id, profile };
  }

  /**
   * Add profile to cache with size management
   * @private
   */
  _addToCache(seed, profile, id) {
    // Check cache size before adding
    if (this.cacheStats.size >= this.cacheStats.maxSize) {
      // Remove oldest entries (first created)
      const firstKey = this.profileCache.keys().next().value;
      if (firstKey) {
        this.profileCache.delete(firstKey);
        this.configCache.delete(firstKey);
        this.scriptCache.delete(firstKey);
        this.cacheStats.size--;
      }
    }

    this.profileCache.set(seed, profile);
    this.cacheStats.size++;
  }

  /**
   * Get a profile by ID
   */
  getProfile(id) {
    return this.profiles.get(id);
  }

  /**
   * Set the active profile
   */
  setActiveProfile(id) {
    if (!this.profiles.has(id)) {
      throw new Error(`Profile ${id} not found`);
    }
    this.activeProfileId = id;
    return this.profiles.get(id);
  }

  /**
   * Get the active profile
   */
  getActiveProfile() {
    if (!this.activeProfileId) {
      return null;
    }
    return this.profiles.get(this.activeProfileId);
  }

  /**
   * List all profiles
   */
  listProfiles() {
    return Array.from(this.profiles.entries()).map(([id, profile]) => ({
      id,
      platformType: profile.platformType,
      timezone: profile.timezone,
      tier: profile.tier,
      isActive: id === this.activeProfileId
    }));
  }

  /**
   * Delete a profile
   */
  deleteProfile(id) {
    if (id === this.activeProfileId) {
      this.activeProfileId = null;
    }
    return this.profiles.delete(id);
  }

  /**
   * Export all profiles
   */
  exportProfiles() {
    const exported = {};
    for (const [id, profile] of this.profiles) {
      exported[id] = profile.getConfig();
    }
    return exported;
  }

  /**
   * Import profiles
   */
  importProfiles(data) {
    for (const [id, config] of Object.entries(data)) {
      const profile = FingerprintProfile.fromJSON(config);
      this.profiles.set(id, profile);
      // Add to cache for future lookups (without counting as miss)
      if (profile.seed && !this.profileCache.has(profile.seed)) {
        this.profileCache.set(profile.seed, profile);
        this.cacheStats.size++;
      }
    }
  }

  /**
   * Get cached profile config (or compute and cache)
   */
  getCachedConfig(id) {
    const profile = this.profiles.get(id);
    if (!profile) {
      return null;
    }

    // Check config cache first
    const cacheKey = `config:${profile.seed}`;
    if (this.configCache.has(cacheKey)) {
      this.cacheStats.hits++;
      return this.configCache.get(cacheKey);
    }

    this.cacheStats.misses++;
    const config = profile.getConfig();

    // Cache the config
    if (profile.seed) {
      this.configCache.set(cacheKey, config);
    }

    return config;
  }

  /**
   * Get cached injection script (or compute and cache)
   */
  getCachedInjectionScript(id) {
    const profile = this.profiles.get(id);
    if (!profile) {
      return null;
    }

    // Check script cache first
    const cacheKey = `script:${profile.seed}`;
    if (this.scriptCache.has(cacheKey)) {
      this.cacheStats.hits++;
      return this.scriptCache.get(cacheKey);
    }

    this.cacheStats.misses++;
    const script = profile.getInjectionScript();

    // Cache the script
    if (profile.seed) {
      this.scriptCache.set(cacheKey, script);
    }

    return script;
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.profileCache.clear();
    this.configCache.clear();
    this.scriptCache.clear();
    this.cacheStats.size = 0;
    this.cacheStats.hits = 0;
    this.cacheStats.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const hitRate = this.cacheStats.hits + this.cacheStats.misses > 0
      ? (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100).toFixed(2)
      : 'N/A';

    return {
      ...this.cacheStats,
      hitRate: `${hitRate}%`,
      totalRequests: this.cacheStats.hits + this.cacheStats.misses
    };
  }
}

module.exports = { FingerprintProfileManager };
