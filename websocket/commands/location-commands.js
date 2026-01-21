/**
 * WebSocket Commands for Geolocation/Location Simulation
 *
 * Phase 30: Geofencing/Location Simulation
 *
 * Provides commands for spoofing geolocation, timezone, and locale
 * to simulate different geographic locations for testing and OSINT.
 *
 * @module websocket/commands/location-commands
 */

const { LocationManager, LOCATION_PROFILES } = require('../../geolocation/location-manager');

// Global location manager instance
let locationManager = null;

/**
 * Register location simulation WebSocket commands
 */
function registerLocationCommands(server, mainWindow) {
  const commandHandlers = server.commandHandlers || server;

  /**
   * Set geolocation coordinates
   *
   * Command: set_geolocation
   * Params: {
   *   latitude: number,
   *   longitude: number,
   *   accuracy?: number,
   *   altitude?: number,
   *   altitudeAccuracy?: number
   * }
   * Response: { coordinates: {} }
   */
  commandHandlers.set_geolocation = async (params) => {
    try {
      if (!locationManager) {
        locationManager = new LocationManager(mainWindow.webContents);
      }

      if (params.latitude === undefined || params.longitude === undefined) {
        throw new Error('latitude and longitude are required');
      }

      // Validate coordinates
      if (params.latitude < -90 || params.latitude > 90) {
        throw new Error('latitude must be between -90 and 90');
      }
      if (params.longitude < -180 || params.longitude > 180) {
        throw new Error('longitude must be between -180 and 180');
      }

      const coordinates = await locationManager.setGeolocation(
        params.latitude,
        params.longitude,
        params.accuracy,
        params.altitude,
        params.altitudeAccuracy
      );

      return {
        success: true,
        coordinates: coordinates
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Set location using pre-configured profile
   *
   * Command: set_location_profile
   * Params: { profile: string }
   * Response: { location: {} }
   */
  commandHandlers.set_location_profile = async (params) => {
    try {
      if (!locationManager) {
        locationManager = new LocationManager(mainWindow.webContents);
      }

      if (!params.profile) {
        throw new Error('profile is required');
      }

      const location = await locationManager.setLocationProfile(params.profile);

      return {
        success: true,
        location: location
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Set timezone
   *
   * Command: set_timezone
   * Params: { timezone: string }
   * Response: { timezone: string }
   */
  commandHandlers.set_timezone = async (params) => {
    try {
      if (!locationManager) {
        locationManager = new LocationManager(mainWindow.webContents);
      }

      if (!params.timezone) {
        throw new Error('timezone is required');
      }

      const result = await locationManager.setTimezone(params.timezone);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Set locale
   *
   * Command: set_locale
   * Params: { locale: string, languages?: string[] }
   * Response: { locale: string, languages: string[] }
   */
  commandHandlers.set_locale = async (params) => {
    try {
      if (!locationManager) {
        locationManager = new LocationManager(mainWindow.webContents);
      }

      if (!params.locale) {
        throw new Error('locale is required');
      }

      const result = await locationManager.setLocale(params.locale, params.languages);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Enable location spoofing
   *
   * Command: enable_location_spoofing
   * Response: { enabled: true }
   */
  commandHandlers.enable_location_spoofing = async (params) => {
    try {
      if (!locationManager) {
        locationManager = new LocationManager(mainWindow.webContents);
      }

      const result = await locationManager.enableLocationSpoofing();

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Disable location spoofing
   *
   * Command: disable_location_spoofing
   * Response: { enabled: false }
   */
  commandHandlers.disable_location_spoofing = async (params) => {
    try {
      if (!locationManager) {
        return { success: true, enabled: false, message: 'Location manager not initialized' };
      }

      const result = await locationManager.disableLocationSpoofing();

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get location status
   *
   * Command: get_location_status
   * Response: { enabled: boolean, coordinates: {}, timezone: string, locale: string, profile: string }
   */
  commandHandlers.get_location_status = async (params) => {
    try {
      if (!locationManager) {
        return {
          success: true,
          enabled: false,
          coordinates: null,
          timezone: null,
          locale: null,
          profile: null
        };
      }

      const status = locationManager.getLocationStatus();

      return {
        success: true,
        ...status
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Match location to proxy
   *
   * Command: match_location_to_proxy
   * Params: { country: string, city?: string }
   * Response: { location: {} }
   */
  commandHandlers.match_location_to_proxy = async (params) => {
    try {
      if (!locationManager) {
        locationManager = new LocationManager(mainWindow.webContents);
      }

      if (!params.country) {
        throw new Error('country is required');
      }

      const location = await locationManager.matchLocationToProxy(params.country, params.city);

      return {
        success: true,
        location: location
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Reset location
   *
   * Command: reset_location
   * Response: { reset: true }
   */
  commandHandlers.reset_location = async (params) => {
    try {
      if (!locationManager) {
        return { success: true, reset: true, message: 'Location manager not initialized' };
      }

      const result = await locationManager.resetLocation();

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * List available location profiles
   *
   * Command: list_location_profiles
   * Response: { profiles: [] }
   */
  commandHandlers.list_location_profiles = async (params) => {
    try {
      if (!locationManager) {
        locationManager = new LocationManager(mainWindow.webContents);
      }

      const profiles = locationManager.getAvailableProfiles();

      return {
        success: true,
        profiles: profiles,
        count: profiles.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get location statistics
   *
   * Command: get_location_stats
   * Response: { stats: {} }
   */
  commandHandlers.get_location_stats = async (params) => {
    try {
      if (!locationManager) {
        return {
          success: true,
          stats: { locationsSet: 0, profilesApplied: 0, injectionsPerformed: 0 }
        };
      }

      const stats = locationManager.getStatistics();

      return {
        success: true,
        stats: stats
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Setup event forwarding
  const setupEventForwarding = () => {
    if (locationManager) {
      locationManager.on('location-changed', (data) => {
        server.broadcast('location_event', { type: 'location-changed', ...data });
      });

      locationManager.on('profile-applied', (data) => {
        server.broadcast('location_event', { type: 'profile-applied', ...data });
      });

      locationManager.on('timezone-changed', (data) => {
        server.broadcast('location_event', { type: 'timezone-changed', ...data });
      });

      locationManager.on('locale-changed', (data) => {
        server.broadcast('location_event', { type: 'locale-changed', ...data });
      });

      locationManager.on('spoofing-enabled', () => {
        server.broadcast('location_event', { type: 'spoofing-enabled' });
      });

      locationManager.on('spoofing-disabled', () => {
        server.broadcast('location_event', { type: 'spoofing-disabled' });
      });

      locationManager.on('location-reset', () => {
        server.broadcast('location_event', { type: 'location-reset' });
      });
    }
  };

  // Setup events on first command that creates manager
  const originalSetGeolocation = server.commandHandlers.set_geolocation;
  server.commandHandlers.set_geolocation = async function(...args) {
    const result = await originalSetGeolocation.apply(this, args);
    setupEventForwarding();
    return result;
  };
}

module.exports = { registerLocationCommands };
