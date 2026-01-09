/**
 * Sock Puppet WebSocket Commands
 *
 * Phase 16: WebSocket API for sock puppet profile integration
 *
 * Provides commands for:
 * - Linking profiles to basset-hound sock puppet entities
 * - Fetching and using credentials
 * - Activity tracking
 * - Session management
 */

const {
  SockPuppetIntegration,
  SOCK_PUPPET_FIELDS,
  ACTIVITY_TYPES,
} = require('../../profiles/sock-puppet-integration');

/**
 * Sock puppet integration instance (initialized when commands are registered)
 */
let sockPuppetIntegration = null;

/**
 * Initialize sock puppet integration
 *
 * @param {Object} profileManager - Profile manager instance
 * @param {Object} config - Configuration options
 */
function initializeSockPuppetIntegration(profileManager, config = {}) {
  sockPuppetIntegration = new SockPuppetIntegration(profileManager, config);

  // Set up event handlers
  sockPuppetIntegration.on('profileLinked', (data) => {
    console.log(`[SockPuppet] Profile ${data.profileId} linked to ${data.sockPuppetId}`);
  });

  sockPuppetIntegration.on('profileCreated', (data) => {
    console.log(`[SockPuppet] Profile created from sock puppet ${data.sockPuppetId}`);
  });

  sockPuppetIntegration.on('sessionStarted', (session) => {
    console.log(`[SockPuppet] Session ${session.id} started for profile ${session.profileId}`);
  });

  sockPuppetIntegration.on('sessionEnded', (session) => {
    console.log(`[SockPuppet] Session ${session.id} ended (duration: ${session.duration}ms)`);
  });

  sockPuppetIntegration.on('error', (error) => {
    console.error(`[SockPuppet] Error: ${error.type}`, error.error?.message || error);
  });

  return sockPuppetIntegration;
}

/**
 * Get the sock puppet integration instance
 */
function getSockPuppetIntegration() {
  if (!sockPuppetIntegration) {
    throw new Error('Sock puppet integration not initialized. Call initializeSockPuppetIntegration first.');
  }
  return sockPuppetIntegration;
}

/**
 * Register sock puppet commands with WebSocket server
 *
 * @param {Object} commandHandlers - Map of command handlers to register with
 * @param {Object} profileManager - Profile manager instance
 * @param {Function} executeInRenderer - Function to execute code in renderer
 */
function registerSockPuppetCommands(commandHandlers, profileManager, executeInRenderer) {
  // Initialize integration if not already done
  if (!sockPuppetIntegration) {
    initializeSockPuppetIntegration(profileManager);
  }

  /**
   * List all sock puppets from basset-hound
   *
   * Command: list_sock_puppets
   * Params:
   *   - limit: number (default 100)
   *   - offset: number (default 0)
   *   - search: string (optional)
   */
  commandHandlers.list_sock_puppets = async (params) => {
    try {
      const integration = getSockPuppetIntegration();
      const sockPuppets = await integration.listSockPuppets({
        limit: params.limit || 100,
        offset: params.offset || 0,
        search: params.search || '',
      });

      return {
        success: true,
        sockPuppets,
        count: sockPuppets.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get sock puppet details
   *
   * Command: get_sock_puppet
   * Params:
   *   - sockPuppetId: string (required)
   *   - forceRefresh: boolean (default false)
   */
  commandHandlers.get_sock_puppet = async (params) => {
    if (!params.sockPuppetId) {
      return { success: false, error: 'sockPuppetId is required' };
    }

    try {
      const integration = getSockPuppetIntegration();
      const sockPuppet = await integration.fetchSockPuppet(
        params.sockPuppetId,
        params.forceRefresh || false
      );

      return {
        success: true,
        sockPuppet,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Link a browser profile to a sock puppet
   *
   * Command: link_profile_to_sock_puppet
   * Params:
   *   - profileId: string (required)
   *   - sockPuppetId: string (required)
   */
  commandHandlers.link_profile_to_sock_puppet = async (params) => {
    if (!params.profileId) {
      return { success: false, error: 'profileId is required' };
    }
    if (!params.sockPuppetId) {
      return { success: false, error: 'sockPuppetId is required' };
    }

    try {
      const integration = getSockPuppetIntegration();
      const result = await integration.linkProfileToSockPuppet(
        params.profileId,
        params.sockPuppetId
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Unlink a browser profile from its sock puppet
   *
   * Command: unlink_profile_from_sock_puppet
   * Params:
   *   - profileId: string (required)
   */
  commandHandlers.unlink_profile_from_sock_puppet = async (params) => {
    if (!params.profileId) {
      return { success: false, error: 'profileId is required' };
    }

    try {
      const integration = getSockPuppetIntegration();
      const result = await integration.unlinkProfile(params.profileId);

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Create a new profile from a sock puppet entity
   *
   * Command: create_profile_from_sock_puppet
   * Params:
   *   - sockPuppetId: string (required)
   */
  commandHandlers.create_profile_from_sock_puppet = async (params) => {
    if (!params.sockPuppetId) {
      return { success: false, error: 'sockPuppetId is required' };
    }

    try {
      const integration = getSockPuppetIntegration();
      const result = await integration.createProfileFromSockPuppet(params.sockPuppetId);

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get the sock puppet linked to a profile
   *
   * Command: get_linked_sock_puppet
   * Params:
   *   - profileId: string (required)
   */
  commandHandlers.get_linked_sock_puppet = async (params) => {
    if (!params.profileId) {
      return { success: false, error: 'profileId is required' };
    }

    try {
      const integration = getSockPuppetIntegration();
      const sockPuppetId = integration.getSockPuppetIdForProfile(params.profileId);

      if (!sockPuppetId) {
        return {
          success: true,
          linked: false,
          sockPuppetId: null,
        };
      }

      const sockPuppet = await integration.fetchSockPuppet(sockPuppetId);

      return {
        success: true,
        linked: true,
        sockPuppetId,
        sockPuppet,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get credentials for a sock puppet
   *
   * Command: get_sock_puppet_credentials
   * Params:
   *   - sockPuppetId: string (required)
   *   - fields: string[] (optional, specific fields to fetch)
   */
  commandHandlers.get_sock_puppet_credentials = async (params) => {
    if (!params.sockPuppetId) {
      return { success: false, error: 'sockPuppetId is required' };
    }

    try {
      const integration = getSockPuppetIntegration();
      const credentials = await integration.getCredentials(
        params.sockPuppetId,
        params.fields || null
      );

      return {
        success: true,
        sockPuppetId: params.sockPuppetId,
        credentials,
        // Note: credentials should NOT include password in plain text unless specifically requested
        // The actual implementation should handle encryption/decryption
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Fill form using sock puppet credentials
   *
   * Command: fill_form_with_sock_puppet
   * Params:
   *   - profileId: string (optional, uses active profile if not specified)
   *   - fieldMapping: object (required) - maps form selectors to credential fields
   *     Example: { "#email": "email", "#password": "password", "#username": "username" }
   */
  commandHandlers.fill_form_with_sock_puppet = async (params) => {
    if (!params.fieldMapping || Object.keys(params.fieldMapping).length === 0) {
      return { success: false, error: 'fieldMapping is required' };
    }

    try {
      const integration = getSockPuppetIntegration();

      // Get profile ID (use active profile if not specified)
      const profileId = params.profileId || profileManager.getActiveProfileId();
      if (!profileId) {
        return { success: false, error: 'No active profile and no profileId specified' };
      }

      // Define the fill function that uses the renderer
      const fillFunction = async (selector, value) => {
        return executeInRenderer(`
          (async () => {
            const element = document.querySelector(${JSON.stringify(selector)});
            if (!element) {
              throw new Error('Element not found: ${selector}');
            }

            // Clear existing value
            element.value = '';
            element.dispatchEvent(new Event('input', { bubbles: true }));

            // Type with humanized delays
            const text = ${JSON.stringify(value)};
            for (const char of text) {
              element.value += char;
              element.dispatchEvent(new Event('input', { bubbles: true }));
              await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50));
            }

            element.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          })()
        `);
      };

      const result = await integration.fillFormWithCredentials(
        profileId,
        params.fieldMapping,
        fillFunction
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Start a session for tracking sock puppet activity
   *
   * Command: start_sock_puppet_session
   * Params:
   *   - profileId: string (optional, uses active profile)
   *   - metadata: object (optional)
   */
  commandHandlers.start_sock_puppet_session = async (params) => {
    try {
      const integration = getSockPuppetIntegration();
      const profileId = params.profileId || profileManager.getActiveProfileId();

      if (!profileId) {
        return { success: false, error: 'No active profile and no profileId specified' };
      }

      const session = await integration.startSession(profileId, params.metadata || {});

      return {
        success: true,
        session,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * End a sock puppet session
   *
   * Command: end_sock_puppet_session
   * Params:
   *   - profileId: string (optional, uses active profile)
   */
  commandHandlers.end_sock_puppet_session = async (params) => {
    try {
      const integration = getSockPuppetIntegration();
      const profileId = params.profileId || profileManager.getActiveProfileId();

      if (!profileId) {
        return { success: false, error: 'No active profile and no profileId specified' };
      }

      const result = await integration.endSession(profileId);

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Log an activity for a sock puppet
   *
   * Command: log_sock_puppet_activity
   * Params:
   *   - profileId: string (optional, uses active profile)
   *   - activityType: string (required) - one of ACTIVITY_TYPES
   *   - details: object (optional)
   */
  commandHandlers.log_sock_puppet_activity = async (params) => {
    if (!params.activityType) {
      return { success: false, error: 'activityType is required' };
    }

    try {
      const integration = getSockPuppetIntegration();
      const profileId = params.profileId || profileManager.getActiveProfileId();

      if (!profileId) {
        return { success: false, error: 'No active profile and no profileId specified' };
      }

      const sockPuppetId = integration.getSockPuppetIdForProfile(profileId);
      if (!sockPuppetId) {
        return { success: false, error: 'Profile not linked to a sock puppet' };
      }

      const activity = await integration.logActivity(
        sockPuppetId,
        params.activityType,
        params.details || {}
      );

      return {
        success: true,
        activity,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get activity log for a sock puppet
   *
   * Command: get_sock_puppet_activity_log
   * Params:
   *   - sockPuppetId: string (required)
   *   - limit: number (default 100)
   *   - type: string (optional, filter by activity type)
   *   - since: string (optional, ISO timestamp)
   */
  commandHandlers.get_sock_puppet_activity_log = async (params) => {
    if (!params.sockPuppetId) {
      return { success: false, error: 'sockPuppetId is required' };
    }

    try {
      const integration = getSockPuppetIntegration();
      const activities = integration.getActivityLog(params.sockPuppetId, {
        limit: params.limit || 100,
        type: params.type || null,
        since: params.since || null,
      });

      return {
        success: true,
        sockPuppetId: params.sockPuppetId,
        activities,
        count: activities.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Sync fingerprint from sock puppet to profile
   *
   * Command: sync_fingerprint_from_sock_puppet
   * Params:
   *   - profileId: string (required)
   */
  commandHandlers.sync_fingerprint_from_sock_puppet = async (params) => {
    if (!params.profileId) {
      return { success: false, error: 'profileId is required' };
    }

    try {
      const integration = getSockPuppetIntegration();
      const result = await integration.syncFingerprintFromSockPuppet(params.profileId);

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Validate fingerprint consistency for a sock puppet
   *
   * Command: validate_sock_puppet_fingerprint
   * Params:
   *   - sockPuppetId: string (required)
   */
  commandHandlers.validate_sock_puppet_fingerprint = async (params) => {
    if (!params.sockPuppetId) {
      return { success: false, error: 'sockPuppetId is required' };
    }

    try {
      const integration = getSockPuppetIntegration();
      const result = await integration.validateFingerprintConsistency(params.sockPuppetId);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get sock puppet integration statistics
   *
   * Command: get_sock_puppet_stats
   */
  commandHandlers.get_sock_puppet_stats = async () => {
    try {
      const integration = getSockPuppetIntegration();
      const stats = integration.getStats();

      return {
        success: true,
        stats,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get available credential fields
   *
   * Command: get_sock_puppet_credential_fields
   */
  commandHandlers.get_sock_puppet_credential_fields = async () => {
    return {
      success: true,
      fields: SOCK_PUPPET_FIELDS,
    };
  };

  /**
   * Get available activity types
   *
   * Command: get_sock_puppet_activity_types
   */
  commandHandlers.get_sock_puppet_activity_types = async () => {
    return {
      success: true,
      activityTypes: ACTIVITY_TYPES,
    };
  };

  console.log('[WebSocket] Registered 16 sock puppet commands');

  return {
    initializeSockPuppetIntegration,
    getSockPuppetIntegration,
    SOCK_PUPPET_FIELDS,
    ACTIVITY_TYPES,
  };
}

module.exports = {
  registerSockPuppetCommands,
  initializeSockPuppetIntegration,
  getSockPuppetIntegration,
  SOCK_PUPPET_FIELDS,
  ACTIVITY_TYPES,
};
