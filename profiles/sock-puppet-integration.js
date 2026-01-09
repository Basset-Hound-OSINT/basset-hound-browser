/**
 * Sock Puppet Profile Integration
 *
 * Phase 16: Integration with basset-hound sock puppet entities
 *
 * Provides linking between browser profiles and basset-hound sock puppet identities,
 * credential management, session tracking, and activity logging.
 */

const EventEmitter = require('events');

/**
 * Configuration for basset-hound API integration
 */
const DEFAULT_CONFIG = {
  bassetHoundUrl: process.env.BASSET_HOUND_URL || 'http://localhost:3000',
  apiVersion: 'v1',
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000,
};

/**
 * Sock Puppet entity types from basset-hound
 */
const SOCK_PUPPET_FIELDS = {
  USERNAME: 'username',
  EMAIL: 'email',
  PASSWORD: 'password',
  PHONE: 'phone',
  RECOVERY_EMAIL: 'recovery_email',
  FIRST_NAME: 'first_name',
  LAST_NAME: 'last_name',
  DATE_OF_BIRTH: 'date_of_birth',
  ADDRESS: 'address',
  PROFILE_PICTURE_URL: 'profile_picture_url',
};

/**
 * Activity types for tracking sock puppet usage
 */
const ACTIVITY_TYPES = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  FORM_FILL: 'form_fill',
  SCREENSHOT: 'screenshot',
  PAGE_VISIT: 'page_visit',
  DATA_EXTRACTION: 'data_extraction',
  PROFILE_UPDATE: 'profile_update',
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
};

/**
 * SockPuppetIntegration class
 *
 * Manages the connection between browser profiles and basset-hound sock puppet entities.
 */
class SockPuppetIntegration extends EventEmitter {
  constructor(profileManager, config = {}) {
    super();
    this.profileManager = profileManager;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Cache for sock puppet data
    this.puppetCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes

    // Profile to sock puppet mapping
    this.profilePuppetMap = new Map();

    // Session tracking
    this.activeSessions = new Map();

    // Activity log (in-memory, synced to basset-hound)
    this.activityLog = [];
    this.maxActivityLogSize = 1000;
  }

  /**
   * Get basset-hound API base URL
   */
  get apiBaseUrl() {
    return `${this.config.bassetHoundUrl}/api/${this.config.apiVersion}`;
  }

  /**
   * Fetch sock puppet data from basset-hound
   *
   * @param {string} sockPuppetId - The basset-hound entity ID
   * @param {boolean} forceRefresh - Bypass cache
   * @returns {Object} Sock puppet entity data
   */
  async fetchSockPuppet(sockPuppetId, forceRefresh = false) {
    // Check cache first
    if (!forceRefresh && this.puppetCache.has(sockPuppetId)) {
      const cached = this.puppetCache.get(sockPuppetId);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    const url = `${this.apiBaseUrl}/entities/${sockPuppetId}`;

    try {
      const response = await this._fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch sock puppet: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Validate entity type
      if (data.type !== 'SOCK_PUPPET') {
        throw new Error(`Entity ${sockPuppetId} is not a SOCK_PUPPET (got: ${data.type})`);
      }

      // Cache the result
      this.puppetCache.set(sockPuppetId, {
        data,
        timestamp: Date.now(),
      });

      this.emit('puppetFetched', { sockPuppetId, data });
      return data;
    } catch (error) {
      this.emit('error', { type: 'fetchSockPuppet', sockPuppetId, error });
      throw error;
    }
  }

  /**
   * List all sock puppets from basset-hound
   *
   * @param {Object} options - Query options
   * @returns {Array} List of sock puppet entities
   */
  async listSockPuppets(options = {}) {
    const { limit = 100, offset = 0, search = '' } = options;

    const params = new URLSearchParams({
      type: 'SOCK_PUPPET',
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (search) {
      params.set('search', search);
    }

    const url = `${this.apiBaseUrl}/entities?${params}`;

    try {
      const response = await this._fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list sock puppets: ${response.status}`);
      }

      const data = await response.json();
      return data.entities || [];
    } catch (error) {
      this.emit('error', { type: 'listSockPuppets', error });
      throw error;
    }
  }

  /**
   * Link a browser profile to a sock puppet entity
   *
   * @param {string} profileId - Browser profile ID
   * @param {string} sockPuppetId - Basset-hound entity ID
   * @returns {Object} Link result
   */
  async linkProfileToSockPuppet(profileId, sockPuppetId) {
    // Verify profile exists
    const profile = await this.profileManager.getProfile(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    // Fetch sock puppet to verify it exists
    const sockPuppet = await this.fetchSockPuppet(sockPuppetId);

    // Create the link
    this.profilePuppetMap.set(profileId, sockPuppetId);

    // Update profile metadata with sock puppet reference
    const updatedProfile = await this.profileManager.updateProfile(profileId, {
      metadata: {
        ...(profile.metadata || {}),
        sockPuppetId,
        sockPuppetName: sockPuppet.name,
        linkedAt: new Date().toISOString(),
      },
    });

    // Sync fingerprint if sock puppet has fingerprint config
    if (sockPuppet.fingerprint_config) {
      await this.syncFingerprintFromSockPuppet(profileId, sockPuppet);
    }

    // Sync proxy if sock puppet has proxy config
    if (sockPuppet.proxy_config) {
      await this.profileManager.updateProfile(profileId, {
        proxy: sockPuppet.proxy_config,
      });
    }

    this.emit('profileLinked', { profileId, sockPuppetId, sockPuppet });

    return {
      success: true,
      profileId,
      sockPuppetId,
      profile: updatedProfile,
      sockPuppetName: sockPuppet.name,
    };
  }

  /**
   * Unlink a browser profile from its sock puppet
   *
   * @param {string} profileId - Browser profile ID
   */
  async unlinkProfile(profileId) {
    const sockPuppetId = this.profilePuppetMap.get(profileId);
    this.profilePuppetMap.delete(profileId);

    // Update profile metadata
    const profile = await this.profileManager.getProfile(profileId);
    if (profile) {
      await this.profileManager.updateProfile(profileId, {
        metadata: {
          ...(profile.metadata || {}),
          sockPuppetId: null,
          sockPuppetName: null,
          unlinkedAt: new Date().toISOString(),
        },
      });
    }

    this.emit('profileUnlinked', { profileId, sockPuppetId });

    return { success: true, profileId, previousSockPuppetId: sockPuppetId };
  }

  /**
   * Get the sock puppet ID linked to a profile
   *
   * @param {string} profileId - Browser profile ID
   * @returns {string|null} Sock puppet ID or null
   */
  getSockPuppetIdForProfile(profileId) {
    return this.profilePuppetMap.get(profileId) || null;
  }

  /**
   * Get the profile ID linked to a sock puppet
   *
   * @param {string} sockPuppetId - Basset-hound entity ID
   * @returns {string|null} Profile ID or null
   */
  getProfileIdForSockPuppet(sockPuppetId) {
    for (const [profileId, puppetId] of this.profilePuppetMap.entries()) {
      if (puppetId === sockPuppetId) {
        return profileId;
      }
    }
    return null;
  }

  /**
   * Create a new profile from a sock puppet entity
   *
   * @param {string} sockPuppetId - Basset-hound entity ID
   * @returns {Object} Created profile
   */
  async createProfileFromSockPuppet(sockPuppetId) {
    const sockPuppet = await this.fetchSockPuppet(sockPuppetId);

    // Generate profile configuration from sock puppet
    const profileConfig = {
      name: sockPuppet.name || `puppet_${sockPuppetId.substring(0, 8)}`,
      metadata: {
        sockPuppetId,
        sockPuppetName: sockPuppet.name,
        createdFromSockPuppet: true,
        linkedAt: new Date().toISOString(),
      },
    };

    // Apply fingerprint config if present
    if (sockPuppet.fingerprint_config) {
      profileConfig.fingerprint = sockPuppet.fingerprint_config;
    }

    // Apply proxy config if present
    if (sockPuppet.proxy_config) {
      profileConfig.proxy = sockPuppet.proxy_config;
    }

    // Apply user agent if specified
    if (sockPuppet.user_agent) {
      profileConfig.userAgent = sockPuppet.user_agent;
    }

    // Create the profile
    const profile = await this.profileManager.createProfile(profileConfig);

    // Link it
    this.profilePuppetMap.set(profile.id, sockPuppetId);

    this.emit('profileCreated', { profile, sockPuppetId, sockPuppet });

    return {
      success: true,
      profile,
      sockPuppetId,
      sockPuppetName: sockPuppet.name,
    };
  }

  /**
   * Sync fingerprint configuration from sock puppet to profile
   *
   * @param {string} profileId - Browser profile ID
   * @param {Object} sockPuppet - Sock puppet entity data
   */
  async syncFingerprintFromSockPuppet(profileId, sockPuppet = null) {
    if (!sockPuppet) {
      const sockPuppetId = this.getSockPuppetIdForProfile(profileId);
      if (!sockPuppetId) {
        throw new Error(`Profile ${profileId} is not linked to a sock puppet`);
      }
      sockPuppet = await this.fetchSockPuppet(sockPuppetId);
    }

    if (!sockPuppet.fingerprint_config) {
      return { success: true, synced: false, reason: 'No fingerprint config in sock puppet' };
    }

    await this.profileManager.updateProfile(profileId, {
      fingerprint: sockPuppet.fingerprint_config,
    });

    return { success: true, synced: true, fingerprint: sockPuppet.fingerprint_config };
  }

  /**
   * Get credentials for a sock puppet (fetched fresh, never cached)
   *
   * @param {string} sockPuppetId - Basset-hound entity ID
   * @param {Array} fields - Which credential fields to fetch
   * @returns {Object} Credential data
   */
  async getCredentials(sockPuppetId, fields = null) {
    const url = `${this.apiBaseUrl}/entities/${sockPuppetId}/credentials`;

    const body = {};
    if (fields && fields.length > 0) {
      body.fields = fields;
    }

    try {
      const response = await this._fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch credentials: ${response.status}`);
      }

      const data = await response.json();

      // Log this credential access
      await this.logActivity(sockPuppetId, ACTIVITY_TYPES.FORM_FILL, {
        fieldsRequested: fields || 'all',
        timestamp: new Date().toISOString(),
      });

      return data;
    } catch (error) {
      this.emit('error', { type: 'getCredentials', sockPuppetId, error });
      throw error;
    }
  }

  /**
   * Fill form fields using sock puppet credentials
   *
   * @param {string} profileId - Browser profile ID
   * @param {Object} fieldMapping - Map of form selectors to credential fields
   * @param {Function} fillFunction - Function to fill form fields
   * @returns {Object} Fill result
   */
  async fillFormWithCredentials(profileId, fieldMapping, fillFunction) {
    const sockPuppetId = this.getSockPuppetIdForProfile(profileId);
    if (!sockPuppetId) {
      throw new Error(`Profile ${profileId} is not linked to a sock puppet`);
    }

    // Determine which credential fields we need
    const neededFields = Object.values(fieldMapping);

    // Fetch credentials
    const credentials = await this.getCredentials(sockPuppetId, neededFields);

    // Fill each field
    const results = {};
    for (const [selector, field] of Object.entries(fieldMapping)) {
      const value = credentials[field];
      if (value !== undefined) {
        try {
          await fillFunction(selector, value);
          results[selector] = { success: true, field };
        } catch (error) {
          results[selector] = { success: false, field, error: error.message };
        }
      } else {
        results[selector] = { success: false, field, error: 'Field not found in credentials' };
      }
    }

    return {
      success: Object.values(results).every((r) => r.success),
      sockPuppetId,
      results,
    };
  }

  /**
   * Start a session for a sock puppet profile
   *
   * @param {string} profileId - Browser profile ID
   * @param {Object} metadata - Session metadata
   * @returns {Object} Session info
   */
  async startSession(profileId, metadata = {}) {
    const sockPuppetId = this.getSockPuppetIdForProfile(profileId);

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const session = {
      id: sessionId,
      profileId,
      sockPuppetId,
      startedAt: new Date().toISOString(),
      metadata,
      activities: [],
    };

    this.activeSessions.set(profileId, session);

    await this.logActivity(sockPuppetId, ACTIVITY_TYPES.SESSION_START, {
      sessionId,
      profileId,
      ...metadata,
    });

    this.emit('sessionStarted', session);

    return session;
  }

  /**
   * End a session for a sock puppet profile
   *
   * @param {string} profileId - Browser profile ID
   * @returns {Object} Session summary
   */
  async endSession(profileId) {
    const session = this.activeSessions.get(profileId);
    if (!session) {
      return { success: false, error: 'No active session for profile' };
    }

    session.endedAt = new Date().toISOString();
    session.duration = new Date(session.endedAt) - new Date(session.startedAt);

    await this.logActivity(session.sockPuppetId, ACTIVITY_TYPES.SESSION_END, {
      sessionId: session.id,
      profileId,
      duration: session.duration,
      activityCount: session.activities.length,
    });

    // Sync activities to basset-hound
    if (session.sockPuppetId) {
      await this.syncActivitiesToBassetHound(session.sockPuppetId, session.activities);
    }

    this.activeSessions.delete(profileId);

    this.emit('sessionEnded', session);

    return {
      success: true,
      session,
    };
  }

  /**
   * Log an activity for a sock puppet
   *
   * @param {string} sockPuppetId - Basset-hound entity ID
   * @param {string} activityType - Type of activity
   * @param {Object} details - Activity details
   */
  async logActivity(sockPuppetId, activityType, details = {}) {
    const activity = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      sockPuppetId,
      type: activityType,
      timestamp: new Date().toISOString(),
      details,
    };

    // Add to in-memory log
    this.activityLog.push(activity);

    // Trim log if too large
    if (this.activityLog.length > this.maxActivityLogSize) {
      this.activityLog = this.activityLog.slice(-this.maxActivityLogSize);
    }

    // Add to active session if applicable
    for (const session of this.activeSessions.values()) {
      if (session.sockPuppetId === sockPuppetId) {
        session.activities.push(activity);
      }
    }

    this.emit('activityLogged', activity);

    return activity;
  }

  /**
   * Sync activities to basset-hound
   *
   * @param {string} sockPuppetId - Basset-hound entity ID
   * @param {Array} activities - Activities to sync
   */
  async syncActivitiesToBassetHound(sockPuppetId, activities) {
    if (!activities || activities.length === 0) {
      return { success: true, synced: 0 };
    }

    const url = `${this.apiBaseUrl}/entities/${sockPuppetId}/activity`;

    try {
      const response = await this._fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ activities }),
      });

      if (!response.ok) {
        throw new Error(`Failed to sync activities: ${response.status}`);
      }

      return { success: true, synced: activities.length };
    } catch (error) {
      this.emit('error', { type: 'syncActivities', sockPuppetId, error });
      // Don't throw - activities are logged locally even if sync fails
      return { success: false, synced: 0, error: error.message };
    }
  }

  /**
   * Get activity log for a sock puppet
   *
   * @param {string} sockPuppetId - Basset-hound entity ID
   * @param {Object} options - Query options
   * @returns {Array} Activity log entries
   */
  getActivityLog(sockPuppetId, options = {}) {
    const { limit = 100, type = null, since = null } = options;

    let activities = this.activityLog.filter((a) => a.sockPuppetId === sockPuppetId);

    if (type) {
      activities = activities.filter((a) => a.type === type);
    }

    if (since) {
      const sinceDate = new Date(since);
      activities = activities.filter((a) => new Date(a.timestamp) >= sinceDate);
    }

    return activities.slice(-limit);
  }

  /**
   * Record a page visit for the active profile
   *
   * @param {string} profileId - Browser profile ID
   * @param {string} url - Visited URL
   * @param {string} title - Page title
   */
  async recordPageVisit(profileId, url, title) {
    const sockPuppetId = this.getSockPuppetIdForProfile(profileId);
    if (!sockPuppetId) return;

    await this.logActivity(sockPuppetId, ACTIVITY_TYPES.PAGE_VISIT, {
      url,
      title,
      profileId,
    });
  }

  /**
   * Record a screenshot capture
   *
   * @param {string} profileId - Browser profile ID
   * @param {string} url - Current URL
   * @param {Object} screenshotInfo - Screenshot metadata
   */
  async recordScreenshot(profileId, url, screenshotInfo) {
    const sockPuppetId = this.getSockPuppetIdForProfile(profileId);
    if (!sockPuppetId) return;

    await this.logActivity(sockPuppetId, ACTIVITY_TYPES.SCREENSHOT, {
      url,
      profileId,
      ...screenshotInfo,
    });
  }

  /**
   * Record data extraction from a page
   *
   * @param {string} profileId - Browser profile ID
   * @param {string} url - Source URL
   * @param {Object} extractionInfo - Extraction metadata
   */
  async recordDataExtraction(profileId, url, extractionInfo) {
    const sockPuppetId = this.getSockPuppetIdForProfile(profileId);
    if (!sockPuppetId) return;

    await this.logActivity(sockPuppetId, ACTIVITY_TYPES.DATA_EXTRACTION, {
      url,
      profileId,
      ...extractionInfo,
    });
  }

  /**
   * Validate fingerprint consistency for a sock puppet
   *
   * @param {string} sockPuppetId - Basset-hound entity ID
   * @returns {Object} Validation result
   */
  async validateFingerprintConsistency(sockPuppetId) {
    const sockPuppet = await this.fetchSockPuppet(sockPuppetId);
    const profileId = this.getProfileIdForSockPuppet(sockPuppetId);

    if (!profileId) {
      return { valid: false, reason: 'No profile linked to sock puppet' };
    }

    const profile = await this.profileManager.getProfile(profileId);
    if (!profile) {
      return { valid: false, reason: 'Linked profile not found' };
    }

    const issues = [];

    // Check fingerprint consistency
    const fp = profile.fingerprint || {};
    const config = sockPuppet.fingerprint_config || {};

    // Platform vs User-Agent consistency
    if (fp.platform && profile.userAgent) {
      const ua = profile.userAgent.toLowerCase();
      if (fp.platform === 'Win64' && !ua.includes('windows')) {
        issues.push('Platform is Win64 but User-Agent does not indicate Windows');
      }
      if (fp.platform === 'MacIntel' && !ua.includes('mac')) {
        issues.push('Platform is MacIntel but User-Agent does not indicate macOS');
      }
      if (fp.platform.includes('Linux') && !ua.includes('linux')) {
        issues.push('Platform is Linux but User-Agent does not indicate Linux');
      }
    }

    // WebGL vendor/renderer vs platform
    if (fp.webgl) {
      const vendor = fp.webgl.vendor?.toLowerCase() || '';
      if (fp.platform === 'Win64' && vendor.includes('apple')) {
        issues.push('WebGL vendor is Apple but platform is Windows');
      }
    }

    // Timezone vs expected location (if geolocation is set)
    if (fp.timezone && sockPuppet.expected_location) {
      // This would need a timezone database to fully validate
      // Simplified check
    }

    return {
      valid: issues.length === 0,
      issues,
      profile: profile.name,
      sockPuppet: sockPuppet.name,
    };
  }

  /**
   * Get statistics about sock puppet usage
   *
   * @returns {Object} Usage statistics
   */
  getStats() {
    const stats = {
      linkedProfiles: this.profilePuppetMap.size,
      activeSessions: this.activeSessions.size,
      cachedPuppets: this.puppetCache.size,
      totalActivitiesLogged: this.activityLog.length,
      activityBreakdown: {},
    };

    // Count activities by type
    for (const activity of this.activityLog) {
      stats.activityBreakdown[activity.type] = (stats.activityBreakdown[activity.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Clean up stale cache entries
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.puppetCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.puppetCache.delete(key);
      }
    }
  }

  /**
   * Fetch with retry logic
   *
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Response} Fetch response
   */
  async _fetchWithRetry(url, options) {
    let lastError;
    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        lastError = error;
        if (attempt < this.config.retryAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay * (attempt + 1)));
        }
      }
    }
    throw lastError;
  }
}

// Export for use in other modules
module.exports = {
  SockPuppetIntegration,
  SOCK_PUPPET_FIELDS,
  ACTIVITY_TYPES,
  DEFAULT_CONFIG,
};
