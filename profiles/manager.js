/**
 * Basset Hound Browser - Profile Manager
 * Manages browser profiles with isolated fingerprints, cookies, and storage
 */

const { session } = require('electron');
const { v4: uuidv4 } = require('uuid');
const ProfileStorage = require('./storage');
const {
  getEvasionScriptWithConfig,
  VIEWPORT_SIZES,
  USER_AGENTS,
  PLATFORMS,
  LANGUAGES,
  TIMEZONES,
  SCREEN_CONFIGS,
  WEBGL_RENDERERS,
  WEBGL_VENDORS
} = require('../evasion/fingerprint');

/**
 * Profile class
 * Represents a single browser profile with all its settings
 */
class Profile {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.name = options.name || `Profile ${Date.now()}`;
    this.createdAt = options.createdAt || new Date().toISOString();
    this.updatedAt = options.updatedAt || this.createdAt;

    // User agent
    this.userAgent = options.userAgent || this.generateRandomUserAgent();

    // Fingerprint settings
    this.fingerprint = options.fingerprint || this.generateRandomFingerprint();

    // Proxy settings
    this.proxy = options.proxy || null;

    // Stored data (will be populated from storage)
    this.cookies = options.cookies || [];
    this.localStorage = options.localStorage || {};

    // Electron session partition
    this.partition = options.partition || `persist:profile-${this.id}`;

    // Active state
    this.isActive = false;
  }

  /**
   * Generate a random user agent
   * @returns {string} Random user agent
   */
  generateRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  /**
   * Generate random fingerprint settings
   * @returns {Object} Fingerprint configuration
   */
  generateRandomFingerprint() {
    const viewport = VIEWPORT_SIZES[Math.floor(Math.random() * VIEWPORT_SIZES.length)];
    const screen = SCREEN_CONFIGS[Math.floor(Math.random() * SCREEN_CONFIGS.length)];

    return {
      // Screen and viewport
      viewport: {
        width: viewport.width + Math.floor(Math.random() * 20) - 10,
        height: viewport.height + Math.floor(Math.random() * 20) - 10
      },
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.colorDepth
      },

      // Platform and language
      platform: PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)],
      languages: LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)],

      // Timezone
      timezone: TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)],

      // WebGL
      webgl: {
        vendor: WEBGL_VENDORS[Math.floor(Math.random() * WEBGL_VENDORS.length)],
        renderer: WEBGL_RENDERERS[Math.floor(Math.random() * WEBGL_RENDERERS.length)]
      },

      // Hardware
      hardwareConcurrency: [4, 8, 12, 16][Math.floor(Math.random() * 4)],
      deviceMemory: [4, 8, 16, 32][Math.floor(Math.random() * 4)],

      // Canvas noise factor (for canvas fingerprint randomization)
      canvasNoise: Math.floor(Math.random() * 10),

      // Audio context noise
      audioNoise: (Math.random() * 0.0001).toFixed(10)
    };
  }

  /**
   * Update profile settings
   * @param {Object} updates - Settings to update
   */
  update(updates) {
    if (updates.name !== undefined) this.name = updates.name;
    if (updates.userAgent !== undefined) this.userAgent = updates.userAgent;
    if (updates.fingerprint !== undefined) {
      this.fingerprint = { ...this.fingerprint, ...updates.fingerprint };
    }
    if (updates.proxy !== undefined) this.proxy = updates.proxy;
    if (updates.cookies !== undefined) this.cookies = updates.cookies;
    if (updates.localStorage !== undefined) this.localStorage = updates.localStorage;

    this.updatedAt = new Date().toISOString();
  }

  /**
   * Convert to a plain object for serialization
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      userAgent: this.userAgent,
      fingerprint: this.fingerprint,
      proxy: this.proxy,
      partition: this.partition
    };
  }

  /**
   * Create a Profile instance from stored data
   * @param {Object} data - Stored profile data
   * @returns {Profile} Profile instance
   */
  static fromJSON(data) {
    return new Profile({
      id: data.id,
      name: data.name,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      userAgent: data.userAgent,
      fingerprint: data.fingerprint,
      proxy: data.proxy,
      partition: data.partition
    });
  }
}

/**
 * ProfileManager class
 * Manages multiple browser profiles
 */
class ProfileManager {
  constructor(dataPath, mainWindow = null) {
    this.storage = new ProfileStorage(dataPath);
    this.mainWindow = mainWindow;

    // Map of profile ID to Profile instance
    this.profiles = new Map();

    // Currently active profile
    this.activeProfileId = null;
    this.activeSession = null;

    // Load profiles from storage
    this.loadProfiles();
  }

  /**
   * Set the main window reference
   * @param {BrowserWindow} mainWindow - Main browser window
   */
  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * Load all profiles from storage
   */
  loadProfiles() {
    const profileList = this.storage.listProfiles();

    for (const profileMeta of profileList) {
      const profileData = this.storage.loadProfile(profileMeta.id);

      if (profileData) {
        const profile = Profile.fromJSON(profileData);

        // Load associated data
        profile.cookies = this.storage.loadCookies(profile.id);
        profile.localStorage = this.storage.loadLocalStorage(profile.id);

        this.profiles.set(profile.id, profile);
      }
    }

    // Load active profile from index
    const index = this.storage.loadIndex();
    if (index.activeProfileId && this.profiles.has(index.activeProfileId)) {
      this.activeProfileId = index.activeProfileId;
    }

    console.log(`[ProfileManager] Loaded ${this.profiles.size} profiles`);
  }

  /**
   * Create a new profile
   * @param {Object} options - Profile options
   * @returns {Object} Result with created profile
   */
  createProfile(options = {}) {
    try {
      const profile = new Profile(options);

      // Save to storage
      this.storage.saveProfile(profile.id, profile.toJSON());

      // Update index
      const index = this.storage.loadIndex();
      if (!index.profiles.includes(profile.id)) {
        index.profiles.push(profile.id);
        this.storage.saveIndex(index);
      }

      // Add to memory
      this.profiles.set(profile.id, profile);

      console.log(`[ProfileManager] Created profile: ${profile.name} (${profile.id})`);

      return {
        success: true,
        profile: profile.toJSON()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete a profile
   * @param {string} profileId - Profile identifier
   * @returns {Object} Result
   */
  async deleteProfile(profileId) {
    if (!this.profiles.has(profileId)) {
      return { success: false, error: 'Profile not found' };
    }

    try {
      const profile = this.profiles.get(profileId);

      // Clear Electron session data if exists
      try {
        const electronSession = session.fromPartition(profile.partition);
        await electronSession.clearStorageData();
        await electronSession.clearCache();
      } catch (error) {
        console.error(`[ProfileManager] Error clearing session: ${error.message}`);
      }

      // Remove from storage
      this.storage.deleteProfile(profileId);

      // Update index
      const index = this.storage.loadIndex();
      index.profiles = index.profiles.filter(id => id !== profileId);
      if (index.activeProfileId === profileId) {
        index.activeProfileId = null;
      }
      this.storage.saveIndex(index);

      // Remove from memory
      this.profiles.delete(profileId);

      // Clear active if this was the active profile
      if (this.activeProfileId === profileId) {
        this.activeProfileId = null;
        this.activeSession = null;
      }

      console.log(`[ProfileManager] Deleted profile: ${profileId}`);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get a profile by ID
   * @param {string} profileId - Profile identifier
   * @returns {Object} Result with profile
   */
  getProfile(profileId) {
    const profile = this.profiles.get(profileId);

    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    return {
      success: true,
      profile: {
        ...profile.toJSON(),
        isActive: profile.id === this.activeProfileId,
        cookieCount: profile.cookies.length,
        localStorageKeys: Object.keys(profile.localStorage).length
      }
    };
  }

  /**
   * List all profiles
   * @returns {Object} Result with profiles list
   */
  listProfiles() {
    const profiles = [];

    for (const [id, profile] of this.profiles.entries()) {
      profiles.push({
        id: profile.id,
        name: profile.name,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        isActive: id === this.activeProfileId,
        userAgent: profile.userAgent.substring(0, 50) + '...',
        hasProxy: !!profile.proxy
      });
    }

    return {
      success: true,
      profiles,
      activeProfileId: this.activeProfileId,
      totalCount: profiles.length
    };
  }

  /**
   * Switch to a profile
   * @param {string} profileId - Profile identifier
   * @returns {Object} Result
   */
  async switchProfile(profileId) {
    const profile = this.profiles.get(profileId);

    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    try {
      // Save current profile state if there's an active one
      if (this.activeProfileId && this.activeSession) {
        await this.saveActiveProfileState();
      }

      // Create or get the Electron session for this profile
      const electronSession = session.fromPartition(profile.partition);

      // Apply profile settings to the session
      await this.applyProfileToSession(profile, electronSession);

      // Update active profile
      this.activeProfileId = profileId;
      this.activeSession = electronSession;
      profile.isActive = true;

      // Update index
      const index = this.storage.loadIndex();
      index.activeProfileId = profileId;
      this.storage.saveIndex(index);

      // Notify main window
      if (this.mainWindow) {
        this.mainWindow.webContents.send('profile-changed', {
          profileId,
          profile: profile.toJSON()
        });
      }

      console.log(`[ProfileManager] Switched to profile: ${profile.name} (${profileId})`);

      return {
        success: true,
        profile: profile.toJSON(),
        partition: profile.partition
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Apply profile settings to an Electron session
   * @param {Profile} profile - Profile to apply
   * @param {Session} electronSession - Electron session
   */
  async applyProfileToSession(profile, electronSession) {
    // Set user agent
    electronSession.setUserAgent(profile.userAgent);

    // Set proxy if configured
    if (profile.proxy) {
      const proxyRules = this.buildProxyRules(profile.proxy);
      await electronSession.setProxy({ proxyRules });
    } else {
      await electronSession.setProxy({ proxyRules: '' });
    }

    // Load cookies
    if (profile.cookies && profile.cookies.length > 0) {
      for (const cookie of profile.cookies) {
        try {
          await electronSession.cookies.set(cookie);
        } catch (error) {
          console.error(`[ProfileManager] Error setting cookie: ${error.message}`);
        }
      }
    }

    // Apply Accept-Language header based on profile language settings
    const languages = profile.fingerprint.languages || ['en-US', 'en'];
    const acceptLanguage = languages.map((lang, i) => {
      if (i === 0) return lang;
      const q = (1 - i * 0.1).toFixed(1);
      return `${lang};q=${q}`;
    }).join(',');

    electronSession.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['Accept-Language'] = acceptLanguage;
      details.requestHeaders['Accept-Encoding'] = 'gzip, deflate, br';
      details.requestHeaders['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
      delete details.requestHeaders['Sec-Ch-Ua-Platform'];
      callback({ requestHeaders: details.requestHeaders });
    });

    // Remove CSP headers
    electronSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ['']
        }
      });
    });
  }

  /**
   * Build proxy rules string from proxy config
   * @param {Object} proxy - Proxy configuration
   * @returns {string} Proxy rules string
   */
  buildProxyRules(proxy) {
    if (!proxy || !proxy.host || !proxy.port) {
      return '';
    }

    const type = proxy.type || 'http';
    let proxyUrl = `${type}://${proxy.host}:${proxy.port}`;

    if (proxy.auth && proxy.auth.username && proxy.auth.password) {
      proxyUrl = `${type}://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`;
    }

    return proxyUrl;
  }

  /**
   * Save the current active profile state
   */
  async saveActiveProfileState() {
    if (!this.activeProfileId || !this.activeSession) {
      return;
    }

    const profile = this.profiles.get(this.activeProfileId);
    if (!profile) return;

    try {
      // Get current cookies
      const cookies = await this.activeSession.cookies.get({});
      profile.cookies = cookies;

      // Save to storage
      this.storage.saveProfile(profile.id, profile.toJSON());
      this.storage.saveCookies(profile.id, cookies);

      console.log(`[ProfileManager] Saved state for profile: ${profile.name}`);
    } catch (error) {
      console.error(`[ProfileManager] Error saving profile state: ${error.message}`);
    }
  }

  /**
   * Update a profile
   * @param {string} profileId - Profile identifier
   * @param {Object} updates - Updates to apply
   * @returns {Object} Result
   */
  updateProfile(profileId, updates) {
    const profile = this.profiles.get(profileId);

    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    try {
      profile.update(updates);

      // Save to storage
      this.storage.saveProfile(profile.id, profile.toJSON());

      // If this is the active profile, apply changes
      if (profileId === this.activeProfileId && this.activeSession) {
        this.applyProfileToSession(profile, this.activeSession);
      }

      console.log(`[ProfileManager] Updated profile: ${profile.name}`);

      return {
        success: true,
        profile: profile.toJSON()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Export a profile
   * @param {string} profileId - Profile identifier
   * @returns {Object} Result with export data
   */
  async exportProfile(profileId) {
    const profile = this.profiles.get(profileId);

    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    try {
      // Get current cookies if this is the active profile
      let cookies = profile.cookies;
      if (profileId === this.activeProfileId && this.activeSession) {
        cookies = await this.activeSession.cookies.get({});
      }

      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        profile: profile.toJSON(),
        cookies,
        localStorage: profile.localStorage
      };

      return {
        success: true,
        data: exportData
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Import a profile
   * @param {Object} importData - Profile data to import
   * @returns {Object} Result with imported profile
   */
  async importProfile(importData) {
    try {
      if (!importData || !importData.profile) {
        return { success: false, error: 'Invalid import data: missing profile' };
      }

      // Create a new profile with a new ID
      const newId = uuidv4();
      const profileData = {
        ...importData.profile,
        id: newId,
        name: importData.profile.name + ' (Imported)',
        partition: `persist:profile-${newId}`,
        createdAt: new Date().toISOString(),
        importedAt: new Date().toISOString(),
        originalId: importData.profile.id
      };

      const profile = new Profile(profileData);

      // Set imported data
      if (importData.cookies) {
        profile.cookies = importData.cookies;
      }
      if (importData.localStorage) {
        profile.localStorage = importData.localStorage;
      }

      // Save to storage
      this.storage.saveProfile(profile.id, profile.toJSON());
      this.storage.saveCookies(profile.id, profile.cookies);
      this.storage.saveLocalStorage(profile.id, profile.localStorage);

      // Update index
      const index = this.storage.loadIndex();
      if (!index.profiles.includes(profile.id)) {
        index.profiles.push(profile.id);
        this.storage.saveIndex(index);
      }

      // Add to memory
      this.profiles.set(profile.id, profile);

      console.log(`[ProfileManager] Imported profile: ${profile.name} (${profile.id})`);

      return {
        success: true,
        profile: profile.toJSON()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the fingerprint evasion script for a profile
   * @param {string} profileId - Profile identifier (optional, uses active if not provided)
   * @returns {string} Evasion script
   */
  getEvasionScript(profileId = null) {
    const id = profileId || this.activeProfileId;
    const profile = id ? this.profiles.get(id) : null;

    if (profile) {
      return getEvasionScriptWithConfig(profile.fingerprint);
    }

    // Return default evasion script if no profile
    const { getEvasionScript } = require('../evasion/fingerprint');
    return getEvasionScript();
  }

  /**
   * Get the active profile's partition
   * @returns {string} Partition string or empty string
   */
  getActivePartition() {
    if (!this.activeProfileId) {
      return '';
    }

    const profile = this.profiles.get(this.activeProfileId);
    return profile ? profile.partition : '';
  }

  /**
   * Get the active profile
   * @returns {Profile|null} Active profile or null
   */
  getActiveProfile() {
    if (!this.activeProfileId) {
      return null;
    }
    return this.profiles.get(this.activeProfileId);
  }

  /**
   * Randomize a profile's fingerprint
   * @param {string} profileId - Profile identifier
   * @returns {Object} Result with new fingerprint
   */
  randomizeFingerprint(profileId) {
    const profile = this.profiles.get(profileId);

    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Generate new random fingerprint
    profile.fingerprint = profile.generateRandomFingerprint();
    profile.userAgent = profile.generateRandomUserAgent();
    profile.updatedAt = new Date().toISOString();

    // Save to storage
    this.storage.saveProfile(profile.id, profile.toJSON());

    // Apply if active
    if (profileId === this.activeProfileId && this.activeSession) {
      this.applyProfileToSession(profile, this.activeSession);
    }

    console.log(`[ProfileManager] Randomized fingerprint for: ${profile.name}`);

    return {
      success: true,
      profile: profile.toJSON()
    };
  }

  /**
   * Cleanup and save all profiles
   */
  async cleanup() {
    // Save active profile state
    await this.saveActiveProfileState();

    // Save all profiles
    for (const [id, profile] of this.profiles.entries()) {
      this.storage.saveProfile(id, profile.toJSON());
    }

    console.log('[ProfileManager] Cleanup complete');
  }
}

module.exports = {
  Profile,
  ProfileManager
};
