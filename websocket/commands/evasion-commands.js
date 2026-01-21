/**
 * Evasion WebSocket Commands
 *
 * Phase 17: WebSocket API for enhanced bot detection evasion
 *
 * Provides commands for:
 * - Fingerprint profile management
 * - Behavioral AI mouse/typing simulation
 * - Honeypot detection
 * - Rate limit adaptation
 */

const {
  FingerprintProfile,
  FingerprintProfileManager,
  PLATFORM_CONFIGS,
  TIMEZONE_CONFIGS,
  CANVAS_NOISE_CONFIGS,
  WEBGL_NOISE_CONFIGS,
  AUDIO_NOISE_CONFIGS,
  FONT_EVASION_CONFIGS,
} = require('../../evasion/fingerprint-profile');

const {
  BehavioralProfile,
  MouseMovementAI,
  TypingAI,
  HoneypotDetector,
  RateLimitAdapter,
} = require('../../evasion/behavioral-ai');

/**
 * Module instances (initialized when commands are registered)
 */
let fingerprintManager = null;
let behavioralProfiles = new Map();
let rateLimitAdapters = new Map();

/**
 * Initialize fingerprint manager
 */
function initializeFingerprintManager() {
  if (!fingerprintManager) {
    fingerprintManager = new FingerprintProfileManager();
  }
  return fingerprintManager;
}

/**
 * Get or create behavioral profile for a session
 */
function getBehavioralProfile(sessionId, options = {}) {
  if (!behavioralProfiles.has(sessionId)) {
    behavioralProfiles.set(sessionId, new BehavioralProfile(options));
  }
  return behavioralProfiles.get(sessionId);
}

/**
 * Get or create rate limit adapter for a domain
 */
function getRateLimitAdapter(domain) {
  if (!rateLimitAdapters.has(domain)) {
    rateLimitAdapters.set(domain, new RateLimitAdapter());
  }
  return rateLimitAdapters.get(domain);
}

/**
 * Register evasion commands with WebSocket server
 *
 * @param {Object} commandHandlers - Map of command handlers to register with
 * @param {Function} executeInRenderer - Function to execute code in renderer
 */
function registerEvasionCommands(commandHandlers, executeInRenderer) {
  initializeFingerprintManager();

  // ==========================================
  // FINGERPRINT PROFILE COMMANDS
  // ==========================================

  /**
   * Create a new fingerprint profile
   *
   * Command: create_fingerprint_profile
   * Params:
   *   - id: string (optional)
   *   - platform: 'windows' | 'macos' | 'linux' (optional)
   *   - timezone: string IANA timezone (optional)
   *   - tier: 'low' | 'medium' | 'high' | 'workstation' (optional)
   *   - seed: string (optional, for reproducibility)
   *   - canvasNoiseLevel: 'disabled' | 'subtle' | 'moderate' | 'aggressive' (optional)
   *   - webglNoiseLevel: 'disabled' | 'subtle' | 'moderate' | 'aggressive' (optional)
   *   - audioNoiseLevel: 'disabled' | 'subtle' | 'moderate' | 'aggressive' (optional)
   *   - fontEvasionLevel: 'disabled' | 'subtle' | 'moderate' | 'aggressive' (optional)
   */
  commandHandlers.create_fingerprint_profile = async (params) => {
    try {
      const { id, profile } = fingerprintManager.createProfile({
        id: params.id,
        platform: params.platform,
        timezone: params.timezone,
        tier: params.tier,
        seed: params.seed,
        canvasNoiseLevel: params.canvasNoiseLevel,
        webglNoiseLevel: params.webglNoiseLevel,
        audioNoiseLevel: params.audioNoiseLevel,
        fontEvasionLevel: params.fontEvasionLevel,
      });

      return {
        success: true,
        profileId: id,
        profile: profile.getConfig(),
        validation: profile.validate(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Create fingerprint profile for specific region
   *
   * Command: create_regional_fingerprint
   * Params:
   *   - region: 'US' | 'UK' | 'EU' | 'RU' | 'JP' | 'CN' | 'AU'
   *   - id: string (optional)
   */
  commandHandlers.create_regional_fingerprint = async (params) => {
    try {
      const profile = FingerprintProfile.forRegion(params.region || 'US');
      const id = params.id || `fp_${Date.now()}`;

      fingerprintManager.profiles.set(id, profile);

      return {
        success: true,
        profileId: id,
        profile: profile.getConfig(),
        region: params.region || 'US',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get fingerprint profile by ID
   *
   * Command: get_fingerprint_profile
   * Params:
   *   - profileId: string
   */
  commandHandlers.get_fingerprint_profile = async (params) => {
    try {
      const profile = fingerprintManager.getProfile(params.profileId);
      if (!profile) {
        return {
          success: false,
          error: `Profile ${params.profileId} not found`,
        };
      }

      return {
        success: true,
        profileId: params.profileId,
        profile: profile.getConfig(),
        validation: profile.validate(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * List all fingerprint profiles
   *
   * Command: list_fingerprint_profiles
   */
  commandHandlers.list_fingerprint_profiles = async () => {
    try {
      const profiles = fingerprintManager.listProfiles();
      return {
        success: true,
        profiles,
        count: profiles.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Set active fingerprint profile
   *
   * Command: set_active_fingerprint
   * Params:
   *   - profileId: string
   */
  commandHandlers.set_active_fingerprint = async (params) => {
    try {
      const profile = fingerprintManager.setActiveProfile(params.profileId);
      return {
        success: true,
        profileId: params.profileId,
        profile: profile.getConfig(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get active fingerprint profile
   *
   * Command: get_active_fingerprint
   */
  commandHandlers.get_active_fingerprint = async () => {
    try {
      const profile = fingerprintManager.getActiveProfile();
      if (!profile) {
        return {
          success: true,
          active: false,
          profile: null,
        };
      }

      return {
        success: true,
        active: true,
        profileId: fingerprintManager.activeProfileId,
        profile: profile.getConfig(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Apply fingerprint to page
   *
   * Command: apply_fingerprint
   * Params:
   *   - profileId: string (optional, uses active if not specified)
   */
  commandHandlers.apply_fingerprint = async (params, context) => {
    try {
      const profileId = params.profileId || fingerprintManager.activeProfileId;
      if (!profileId) {
        return {
          success: false,
          error: 'No profile specified and no active profile',
        };
      }

      const profile = fingerprintManager.getProfile(profileId);
      if (!profile) {
        return {
          success: false,
          error: `Profile ${profileId} not found`,
        };
      }

      const script = profile.getInjectionScript();

      // Execute in renderer if available
      if (executeInRenderer) {
        await executeInRenderer(script);
      }

      return {
        success: true,
        profileId,
        applied: true,
        platformType: profile.platformType,
        timezone: profile.timezone,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Delete fingerprint profile
   *
   * Command: delete_fingerprint_profile
   * Params:
   *   - profileId: string
   */
  commandHandlers.delete_fingerprint_profile = async (params) => {
    try {
      const deleted = fingerprintManager.deleteProfile(params.profileId);
      return {
        success: deleted,
        profileId: params.profileId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get available platforms and timezones
   *
   * Command: get_fingerprint_options
   */
  commandHandlers.get_fingerprint_options = async () => {
    return {
      success: true,
      platforms: Object.keys(PLATFORM_CONFIGS),
      timezones: Object.keys(TIMEZONE_CONFIGS),
      tiers: ['low', 'medium', 'high', 'workstation'],
      evasionLevels: ['disabled', 'subtle', 'moderate', 'aggressive'],
    };
  };

  // ==========================================
  // ADVANCED EVASION CONFIGURATION COMMANDS
  // ==========================================

  /**
   * Configure canvas fingerprint noise
   *
   * Command: configure_canvas_noise
   * Params:
   *   - profileId: string (optional, uses active if not specified)
   *   - level: 'disabled' | 'subtle' | 'moderate' | 'aggressive'
   *   - customConfig: object (optional, for custom configuration)
   *     - enabled: boolean
   *     - intensity: number (0-0.001)
   *     - affectedChannels: array of 'r', 'g', 'b', 'a'
   *     - maxPixelShift: number (1-5)
   */
  commandHandlers.configure_canvas_noise = async (params) => {
    try {
      const profileId = params.profileId || fingerprintManager.activeProfileId;
      if (!profileId) {
        return {
          success: false,
          error: 'No profile specified and no active profile',
        };
      }

      const profile = fingerprintManager.getProfile(profileId);
      if (!profile) {
        return {
          success: false,
          error: `Profile ${profileId} not found`,
        };
      }

      // Update canvas noise configuration
      if (params.level && CANVAS_NOISE_CONFIGS[params.level]) {
        profile.canvasNoiseLevel = params.level;
        profile.canvasNoiseConfig = { ...CANVAS_NOISE_CONFIGS[params.level] };
      }

      // Apply custom configuration overrides
      if (params.customConfig) {
        profile.canvasNoiseConfig = {
          ...profile.canvasNoiseConfig,
          ...params.customConfig,
        };
      }

      return {
        success: true,
        profileId,
        canvasNoise: {
          level: profile.canvasNoiseLevel,
          config: profile.canvasNoiseConfig,
        },
        availableLevels: Object.keys(CANVAS_NOISE_CONFIGS),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Configure WebGL fingerprint noise
   *
   * Command: configure_webgl_noise
   * Params:
   *   - profileId: string (optional, uses active if not specified)
   *   - level: 'disabled' | 'subtle' | 'moderate' | 'aggressive'
   *   - customConfig: object (optional, for custom configuration)
   *     - enabled: boolean
   *     - randomizeExtensions: boolean
   *     - extensionRemovalChance: number (0-0.5)
   *     - parameterNoise: number (0-0.1)
   *     - precisionNoise: boolean
   */
  commandHandlers.configure_webgl_noise = async (params) => {
    try {
      const profileId = params.profileId || fingerprintManager.activeProfileId;
      if (!profileId) {
        return {
          success: false,
          error: 'No profile specified and no active profile',
        };
      }

      const profile = fingerprintManager.getProfile(profileId);
      if (!profile) {
        return {
          success: false,
          error: `Profile ${profileId} not found`,
        };
      }

      // Update WebGL noise configuration
      if (params.level && WEBGL_NOISE_CONFIGS[params.level]) {
        profile.webglNoiseLevel = params.level;
        profile.webglNoiseConfig = { ...WEBGL_NOISE_CONFIGS[params.level] };
      }

      // Apply custom configuration overrides
      if (params.customConfig) {
        profile.webglNoiseConfig = {
          ...profile.webglNoiseConfig,
          ...params.customConfig,
        };
      }

      return {
        success: true,
        profileId,
        webglNoise: {
          level: profile.webglNoiseLevel,
          config: profile.webglNoiseConfig,
        },
        availableLevels: Object.keys(WEBGL_NOISE_CONFIGS),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Configure audio fingerprint noise
   *
   * Command: configure_audio_noise
   * Params:
   *   - profileId: string (optional, uses active if not specified)
   *   - level: 'disabled' | 'subtle' | 'moderate' | 'aggressive'
   *   - customConfig: object (optional, for custom configuration)
   *     - enabled: boolean
   *     - intensity: number (0-0.001)
   *     - noiseType: 'white' | 'pink'
   *     - affectOscillator: boolean
   */
  commandHandlers.configure_audio_noise = async (params) => {
    try {
      const profileId = params.profileId || fingerprintManager.activeProfileId;
      if (!profileId) {
        return {
          success: false,
          error: 'No profile specified and no active profile',
        };
      }

      const profile = fingerprintManager.getProfile(profileId);
      if (!profile) {
        return {
          success: false,
          error: `Profile ${profileId} not found`,
        };
      }

      // Update audio noise configuration
      if (params.level && AUDIO_NOISE_CONFIGS[params.level]) {
        profile.audioNoiseLevel = params.level;
        profile.audioNoiseConfig = { ...AUDIO_NOISE_CONFIGS[params.level] };
      }

      // Apply custom configuration overrides
      if (params.customConfig) {
        profile.audioNoiseConfig = {
          ...profile.audioNoiseConfig,
          ...params.customConfig,
        };
      }

      return {
        success: true,
        profileId,
        audioNoise: {
          level: profile.audioNoiseLevel,
          config: profile.audioNoiseConfig,
        },
        availableLevels: Object.keys(AUDIO_NOISE_CONFIGS),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Configure font enumeration evasion
   *
   * Command: configure_font_evasion
   * Params:
   *   - profileId: string (optional, uses active if not specified)
   *   - level: 'disabled' | 'subtle' | 'moderate' | 'aggressive'
   *   - customConfig: object (optional, for custom configuration)
   *     - enabled: boolean
   *     - randomizeOrder: boolean
   *     - removeCommonFonts: number (0-0.5 probability)
   *     - addDecoyFonts: number (0-10)
   */
  commandHandlers.configure_font_evasion = async (params) => {
    try {
      const profileId = params.profileId || fingerprintManager.activeProfileId;
      if (!profileId) {
        return {
          success: false,
          error: 'No profile specified and no active profile',
        };
      }

      const profile = fingerprintManager.getProfile(profileId);
      if (!profile) {
        return {
          success: false,
          error: `Profile ${profileId} not found`,
        };
      }

      // Update font evasion configuration
      if (params.level && FONT_EVASION_CONFIGS[params.level]) {
        profile.fontEvasionLevel = params.level;
        profile.fontEvasionConfig = { ...FONT_EVASION_CONFIGS[params.level] };
        // Regenerate fonts with new configuration
        profile.fonts = profile._generateFonts();
      }

      // Apply custom configuration overrides
      if (params.customConfig) {
        profile.fontEvasionConfig = {
          ...profile.fontEvasionConfig,
          ...params.customConfig,
        };
        // Regenerate fonts with new configuration
        profile.fonts = profile._generateFonts();
      }

      return {
        success: true,
        profileId,
        fontEvasion: {
          level: profile.fontEvasionLevel,
          config: profile.fontEvasionConfig,
          fontCount: profile.fonts.length,
          fonts: profile.fonts,
        },
        availableLevels: Object.keys(FONT_EVASION_CONFIGS),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get current evasion configuration for a profile
   *
   * Command: get_evasion_config
   * Params:
   *   - profileId: string (optional, uses active if not specified)
   */
  commandHandlers.get_evasion_config = async (params) => {
    try {
      const profileId = params.profileId || fingerprintManager.activeProfileId;
      if (!profileId) {
        return {
          success: false,
          error: 'No profile specified and no active profile',
        };
      }

      const profile = fingerprintManager.getProfile(profileId);
      if (!profile) {
        return {
          success: false,
          error: `Profile ${profileId} not found`,
        };
      }

      return {
        success: true,
        profileId,
        evasion: {
          canvas: {
            level: profile.canvasNoiseLevel,
            config: profile.canvasNoiseConfig,
          },
          webgl: {
            level: profile.webglNoiseLevel,
            config: profile.webglNoiseConfig,
          },
          audio: {
            level: profile.audioNoiseLevel,
            config: profile.audioNoiseConfig,
          },
          fonts: {
            level: profile.fontEvasionLevel,
            config: profile.fontEvasionConfig,
            fontCount: profile.fonts.length,
          },
        },
        availableLevels: {
          canvas: Object.keys(CANVAS_NOISE_CONFIGS),
          webgl: Object.keys(WEBGL_NOISE_CONFIGS),
          audio: Object.keys(AUDIO_NOISE_CONFIGS),
          fonts: Object.keys(FONT_EVASION_CONFIGS),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Set all evasion levels at once
   *
   * Command: set_evasion_levels
   * Params:
   *   - profileId: string (optional, uses active if not specified)
   *   - level: 'disabled' | 'subtle' | 'moderate' | 'aggressive' (applies to all)
   *   - canvas: string (optional, override for canvas)
   *   - webgl: string (optional, override for webgl)
   *   - audio: string (optional, override for audio)
   *   - fonts: string (optional, override for fonts)
   */
  commandHandlers.set_evasion_levels = async (params) => {
    try {
      const profileId = params.profileId || fingerprintManager.activeProfileId;
      if (!profileId) {
        return {
          success: false,
          error: 'No profile specified and no active profile',
        };
      }

      const profile = fingerprintManager.getProfile(profileId);
      if (!profile) {
        return {
          success: false,
          error: `Profile ${profileId} not found`,
        };
      }

      const defaultLevel = params.level || 'subtle';

      // Set canvas noise
      const canvasLevel = params.canvas || defaultLevel;
      if (CANVAS_NOISE_CONFIGS[canvasLevel]) {
        profile.canvasNoiseLevel = canvasLevel;
        profile.canvasNoiseConfig = { ...CANVAS_NOISE_CONFIGS[canvasLevel] };
      }

      // Set WebGL noise
      const webglLevel = params.webgl || defaultLevel;
      if (WEBGL_NOISE_CONFIGS[webglLevel]) {
        profile.webglNoiseLevel = webglLevel;
        profile.webglNoiseConfig = { ...WEBGL_NOISE_CONFIGS[webglLevel] };
      }

      // Set audio noise
      const audioLevel = params.audio || defaultLevel;
      if (AUDIO_NOISE_CONFIGS[audioLevel]) {
        profile.audioNoiseLevel = audioLevel;
        profile.audioNoiseConfig = { ...AUDIO_NOISE_CONFIGS[audioLevel] };
      }

      // Set font evasion
      const fontsLevel = params.fonts || defaultLevel;
      if (FONT_EVASION_CONFIGS[fontsLevel]) {
        profile.fontEvasionLevel = fontsLevel;
        profile.fontEvasionConfig = { ...FONT_EVASION_CONFIGS[fontsLevel] };
        profile.fonts = profile._generateFonts();
      }

      return {
        success: true,
        profileId,
        evasionLevels: {
          canvas: profile.canvasNoiseLevel,
          webgl: profile.webglNoiseLevel,
          audio: profile.audioNoiseLevel,
          fonts: profile.fontEvasionLevel,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // ==========================================
  // BEHAVIORAL AI COMMANDS
  // ==========================================

  /**
   * Create behavioral profile for session
   *
   * Command: create_behavioral_profile
   * Params:
   *   - sessionId: string
   *   - seed: string (optional)
   *   - speedMultiplier: number (optional, 0.5-1.5)
   *   - accuracyLevel: number (optional, 0.8-1.0)
   */
  commandHandlers.create_behavioral_profile = async (params) => {
    try {
      const sessionId = params.sessionId || `session_${Date.now()}`;
      const profile = new BehavioralProfile({
        seed: params.seed,
        speedMultiplier: params.speedMultiplier,
        accuracyLevel: params.accuracyLevel,
        fatigueRate: params.fatigueRate,
      });

      behavioralProfiles.set(sessionId, profile);

      return {
        success: true,
        sessionId,
        profile: profile.getConfig(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Generate human-like mouse path
   *
   * Command: generate_mouse_path
   * Params:
   *   - sessionId: string
   *   - start: { x: number, y: number }
   *   - end: { x: number, y: number }
   *   - targetWidth: number (optional, default 20)
   */
  commandHandlers.generate_mouse_path = async (params) => {
    try {
      const profile = getBehavioralProfile(params.sessionId);
      const mouseAI = new MouseMovementAI(profile);

      const path = mouseAI.generatePath(
        params.start,
        params.end,
        params.targetWidth || 20
      );

      return {
        success: true,
        path: path.points,
        duration: path.duration,
        pointCount: path.points.length,
        fittsTime: path.fittsTime,
        distance: path.distance,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Generate human-like scroll behavior
   *
   * Command: generate_scroll_behavior
   * Params:
   *   - sessionId: string
   *   - distance: number (pixels)
   *   - direction: 'up' | 'down'
   */
  commandHandlers.generate_scroll_behavior = async (params) => {
    try {
      const profile = getBehavioralProfile(params.sessionId);
      const mouseAI = new MouseMovementAI(profile);

      const events = mouseAI.generateScrollBehavior(
        params.distance,
        params.direction || 'down'
      );

      return {
        success: true,
        events,
        eventCount: events.length,
        totalDuration: events.length > 0 ? events[events.length - 1].t : 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Generate human-like typing events
   *
   * Command: generate_typing_events
   * Params:
   *   - sessionId: string
   *   - text: string
   */
  commandHandlers.generate_typing_events = async (params) => {
    try {
      const profile = getBehavioralProfile(params.sessionId);
      const typingAI = new TypingAI(profile);

      const events = typingAI.generateTypingEvents(params.text);
      const wpm = typingAI.calculateTypingSpeed(events, params.text.length);

      return {
        success: true,
        events,
        eventCount: events.length,
        totalDuration: events.length > 0 ? events[events.length - 1].t : 0,
        effectiveWPM: wpm.toFixed(1),
        characterCount: params.text.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get behavioral profile info
   *
   * Command: get_behavioral_profile
   * Params:
   *   - sessionId: string
   */
  commandHandlers.get_behavioral_profile = async (params) => {
    try {
      if (!behavioralProfiles.has(params.sessionId)) {
        return {
          success: false,
          error: `No behavioral profile for session ${params.sessionId}`,
        };
      }

      const profile = behavioralProfiles.get(params.sessionId);
      return {
        success: true,
        sessionId: params.sessionId,
        profile: profile.getConfig(),
        fatigueFactor: profile.getFatigueFactor(),
        actionCount: profile.actionCount,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * List all behavioral sessions
   *
   * Command: list_behavioral_sessions
   */
  commandHandlers.list_behavioral_sessions = async () => {
    try {
      const sessions = [];
      for (const [sessionId, profile] of behavioralProfiles) {
        sessions.push({
          sessionId,
          typingWPM: profile.typingWPM,
          fatigueFactor: profile.getFatigueFactor(),
          actionCount: profile.actionCount,
        });
      }

      return {
        success: true,
        sessions,
        count: sessions.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // ==========================================
  // HONEYPOT DETECTION COMMANDS
  // ==========================================

  /**
   * Check if element is a honeypot
   *
   * Command: check_honeypot
   * Params:
   *   - element: object with style, name, id, etc.
   */
  commandHandlers.check_honeypot = async (params) => {
    try {
      const result = HoneypotDetector.isHoneypot(params.element);
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
   * Filter honeypots from form fields
   *
   * Command: filter_honeypots
   * Params:
   *   - fields: array of field objects
   */
  commandHandlers.filter_honeypots = async (params) => {
    try {
      const result = HoneypotDetector.filterHoneypots(params.fields || []);
      return {
        success: true,
        safeFieldCount: result.safeFields.length,
        honeypotCount: result.honeypots.length,
        safeFields: result.safeFields,
        honeypots: result.honeypots.map(h => ({
          field: h.field,
          indicators: h.indicators,
          confidence: h.confidence,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // ==========================================
  // RATE LIMIT ADAPTATION COMMANDS
  // ==========================================

  /**
   * Get rate limit adapter for domain
   *
   * Command: get_rate_limit_state
   * Params:
   *   - domain: string
   */
  commandHandlers.get_rate_limit_state = async (params) => {
    try {
      const adapter = getRateLimitAdapter(params.domain);
      return {
        success: true,
        domain: params.domain,
        state: adapter.getState(),
        recommendedDelay: adapter.getDelay(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Record successful request
   *
   * Command: record_request_success
   * Params:
   *   - domain: string
   */
  commandHandlers.record_request_success = async (params) => {
    try {
      const adapter = getRateLimitAdapter(params.domain);
      adapter.recordSuccess();
      return {
        success: true,
        domain: params.domain,
        state: adapter.getState(),
        recommendedDelay: adapter.getDelay(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Record rate limit hit
   *
   * Command: record_rate_limit
   * Params:
   *   - domain: string
   *   - retryAfter: number (optional, from header)
   */
  commandHandlers.record_rate_limit = async (params) => {
    try {
      const adapter = getRateLimitAdapter(params.domain);
      adapter.recordRateLimit({
        retryAfter: params.retryAfter,
      });
      return {
        success: true,
        domain: params.domain,
        state: adapter.getState(),
        recommendedDelay: adapter.getDelay(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Check if response indicates rate limiting
   *
   * Command: is_rate_limited
   * Params:
   *   - statusCode: number
   */
  commandHandlers.is_rate_limited = async (params) => {
    return {
      success: true,
      isRateLimited: RateLimitAdapter.isRateLimited(params.statusCode),
      statusCode: params.statusCode,
    };
  };

  /**
   * Reset rate limit adapter for domain
   *
   * Command: reset_rate_limit
   * Params:
   *   - domain: string
   */
  commandHandlers.reset_rate_limit = async (params) => {
    try {
      rateLimitAdapters.delete(params.domain);
      return {
        success: true,
        domain: params.domain,
        reset: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * List all rate limit adapters
   *
   * Command: list_rate_limit_adapters
   */
  commandHandlers.list_rate_limit_adapters = async () => {
    try {
      const adapters = [];
      for (const [domain, adapter] of rateLimitAdapters) {
        adapters.push({
          domain,
          state: adapter.getState(),
          recommendedDelay: adapter.getDelay(),
        });
      }

      return {
        success: true,
        adapters,
        count: adapters.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  console.log('[Evasion] 30 evasion commands registered (including 6 advanced evasion commands)');
}

module.exports = {
  registerEvasionCommands,
  initializeFingerprintManager,
  getBehavioralProfile,
  getRateLimitAdapter,
};
