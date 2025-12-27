/**
 * Basset Hound Browser - Geolocation Manager
 * Provides geolocation spoofing capabilities for browser automation
 */

const { getAllPresets, findPresetByName, getTimezoneOffset, getPresetsByCountry, getPresetsByRegion } = require('./presets');

/**
 * GeolocationManager class for managing geolocation spoofing
 */
class GeolocationManager {
  constructor() {
    // Default location (New York City)
    this._latitude = 40.7128;
    this._longitude = -74.0060;
    this._accuracy = 100; // meters
    this._altitude = null;
    this._altitudeAccuracy = null;
    this._heading = null;
    this._speed = null;
    this._timezone = 'America/New_York';
    this._timezoneOffset = -300;
    this._enabled = false;
    this._watchCallbacks = new Map();
    this._watchIdCounter = 0;
  }

  // ==========================================
  // Properties (getters and setters)
  // ==========================================

  get latitude() {
    return this._latitude;
  }

  set latitude(value) {
    if (typeof value === 'number' && value >= -90 && value <= 90) {
      this._latitude = value;
    } else {
      throw new Error('Latitude must be a number between -90 and 90');
    }
  }

  get longitude() {
    return this._longitude;
  }

  set longitude(value) {
    if (typeof value === 'number' && value >= -180 && value <= 180) {
      this._longitude = value;
    } else {
      throw new Error('Longitude must be a number between -180 and 180');
    }
  }

  get accuracy() {
    return this._accuracy;
  }

  set accuracy(value) {
    if (typeof value === 'number' && value > 0) {
      this._accuracy = value;
    } else {
      throw new Error('Accuracy must be a positive number');
    }
  }

  get altitude() {
    return this._altitude;
  }

  set altitude(value) {
    if (value === null || typeof value === 'number') {
      this._altitude = value;
    } else {
      throw new Error('Altitude must be a number or null');
    }
  }

  get altitudeAccuracy() {
    return this._altitudeAccuracy;
  }

  set altitudeAccuracy(value) {
    if (value === null || (typeof value === 'number' && value > 0)) {
      this._altitudeAccuracy = value;
    } else {
      throw new Error('Altitude accuracy must be a positive number or null');
    }
  }

  get heading() {
    return this._heading;
  }

  set heading(value) {
    if (value === null || (typeof value === 'number' && value >= 0 && value < 360)) {
      this._heading = value;
    } else {
      throw new Error('Heading must be a number between 0 and 360, or null');
    }
  }

  get speed() {
    return this._speed;
  }

  set speed(value) {
    if (value === null || (typeof value === 'number' && value >= 0)) {
      this._speed = value;
    } else {
      throw new Error('Speed must be a non-negative number or null');
    }
  }

  get timezone() {
    return this._timezone;
  }

  get timezoneOffset() {
    return this._timezoneOffset;
  }

  // ==========================================
  // Core Methods
  // ==========================================

  /**
   * Set a custom location
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {Object} options - Additional options
   * @returns {Object} - Success status and current location
   */
  setLocation(lat, lng, options = {}) {
    try {
      this.latitude = lat;
      this.longitude = lng;

      if (options.accuracy !== undefined) {
        this.accuracy = options.accuracy;
      }

      if (options.altitude !== undefined) {
        this.altitude = options.altitude;
      }

      if (options.altitudeAccuracy !== undefined) {
        this.altitudeAccuracy = options.altitudeAccuracy;
      }

      if (options.heading !== undefined) {
        this.heading = options.heading;
      }

      if (options.speed !== undefined) {
        this.speed = options.speed;
      }

      if (options.timezone) {
        this._timezone = options.timezone;
        this._timezoneOffset = getTimezoneOffset(options.timezone);
      }

      // Notify watch callbacks of location change
      this._notifyWatchers();

      return {
        success: true,
        location: this.getLocation()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Set location by city name
   * @param {string} cityName - Name of the city
   * @returns {Object} - Success status and location data
   */
  setLocationByCity(cityName) {
    const preset = findPresetByName(cityName);

    if (!preset) {
      return {
        success: false,
        error: `City not found: ${cityName}`,
        availableCities: getAllPresets().map(p => p.name)
      };
    }

    return this.setLocation(preset.latitude, preset.longitude, {
      timezone: preset.timezone,
      accuracy: 100 // Default accuracy for city-level location
    });
  }

  /**
   * Get the current spoofed location
   * @returns {Object} - Current location data
   */
  getLocation() {
    return {
      coords: {
        latitude: this._latitude,
        longitude: this._longitude,
        accuracy: this._accuracy,
        altitude: this._altitude,
        altitudeAccuracy: this._altitudeAccuracy,
        heading: this._heading,
        speed: this._speed
      },
      timestamp: Date.now(),
      timezone: this._timezone,
      timezoneOffset: this._timezoneOffset,
      spoofingEnabled: this._enabled
    };
  }

  /**
   * Enable geolocation spoofing
   * @returns {Object} - Success status
   */
  enableSpoofing() {
    this._enabled = true;
    console.log('[GeolocationManager] Spoofing enabled');
    return {
      success: true,
      enabled: true,
      location: this.getLocation()
    };
  }

  /**
   * Disable geolocation spoofing (use real location)
   * @returns {Object} - Success status
   */
  disableSpoofing() {
    this._enabled = false;
    console.log('[GeolocationManager] Spoofing disabled');
    return {
      success: true,
      enabled: false
    };
  }

  /**
   * Check if spoofing is currently active
   * @returns {boolean} - True if spoofing is enabled
   */
  isEnabled() {
    return this._enabled;
  }

  /**
   * Get list of preset locations
   * @param {Object} filter - Optional filter (country or region)
   * @returns {Array} - List of preset locations
   */
  getPresetLocations(filter = {}) {
    if (filter.country) {
      return getPresetsByCountry(filter.country);
    }
    if (filter.region) {
      return getPresetsByRegion(filter.region);
    }
    return getAllPresets();
  }

  // ==========================================
  // Watch Position Simulation
  // ==========================================

  /**
   * Register a watch callback (simulates watchPosition)
   * @param {Function} callback - Callback function
   * @returns {number} - Watch ID
   */
  addWatcher(callback) {
    const watchId = ++this._watchIdCounter;
    this._watchCallbacks.set(watchId, callback);
    return watchId;
  }

  /**
   * Remove a watch callback
   * @param {number} watchId - Watch ID to remove
   * @returns {boolean} - True if removed successfully
   */
  removeWatcher(watchId) {
    return this._watchCallbacks.delete(watchId);
  }

  /**
   * Notify all watchers of location change
   * @private
   */
  _notifyWatchers() {
    if (this._enabled) {
      const location = this.getLocation();
      this._watchCallbacks.forEach((callback) => {
        try {
          callback(location);
        } catch (error) {
          console.error('[GeolocationManager] Watcher callback error:', error);
        }
      });
    }
  }

  // ==========================================
  // Script Generation for Injection
  // ==========================================

  /**
   * Generate the geolocation spoofing script for injection into pages
   * @returns {string} - JavaScript code to inject
   */
  getGeolocationSpoofScript() {
    if (!this._enabled) {
      return '// Geolocation spoofing disabled';
    }

    const location = this.getLocation();
    const coords = location.coords;

    return `
      (function() {
        'use strict';

        // Store original geolocation
        const originalGeolocation = navigator.geolocation;
        const originalGetCurrentPosition = originalGeolocation.getCurrentPosition.bind(originalGeolocation);
        const originalWatchPosition = originalGeolocation.watchPosition.bind(originalGeolocation);
        const originalClearWatch = originalGeolocation.clearWatch.bind(originalGeolocation);

        // Spoofed position data
        const spoofedPosition = {
          coords: {
            latitude: ${coords.latitude},
            longitude: ${coords.longitude},
            accuracy: ${coords.accuracy},
            altitude: ${coords.altitude === null ? 'null' : coords.altitude},
            altitudeAccuracy: ${coords.altitudeAccuracy === null ? 'null' : coords.altitudeAccuracy},
            heading: ${coords.heading === null ? 'null' : coords.heading},
            speed: ${coords.speed === null ? 'null' : coords.speed}
          },
          timestamp: Date.now()
        };

        // Store watch callbacks
        const watchCallbacks = new Map();
        let watchIdCounter = 0;

        // Override getCurrentPosition
        navigator.geolocation.getCurrentPosition = function(successCallback, errorCallback, options) {
          if (typeof successCallback === 'function') {
            // Add slight delay to simulate real geolocation
            setTimeout(() => {
              successCallback({
                ...spoofedPosition,
                timestamp: Date.now()
              });
            }, Math.random() * 100 + 50);
          }
        };

        // Override watchPosition
        navigator.geolocation.watchPosition = function(successCallback, errorCallback, options) {
          const watchId = ++watchIdCounter;

          if (typeof successCallback === 'function') {
            // Store callback
            watchCallbacks.set(watchId, successCallback);

            // Initial position update
            setTimeout(() => {
              successCallback({
                ...spoofedPosition,
                timestamp: Date.now()
              });
            }, Math.random() * 100 + 50);

            // Simulate periodic updates (every 5 seconds)
            const intervalId = setInterval(() => {
              if (watchCallbacks.has(watchId)) {
                // Add slight random variation to position
                const variation = 0.00001;
                successCallback({
                  coords: {
                    ...spoofedPosition.coords,
                    latitude: spoofedPosition.coords.latitude + (Math.random() - 0.5) * variation,
                    longitude: spoofedPosition.coords.longitude + (Math.random() - 0.5) * variation
                  },
                  timestamp: Date.now()
                });
              } else {
                clearInterval(intervalId);
              }
            }, 5000);
          }

          return watchId;
        };

        // Override clearWatch
        navigator.geolocation.clearWatch = function(watchId) {
          watchCallbacks.delete(watchId);
        };

        // Override permissions for geolocation
        const originalPermissionsQuery = navigator.permissions.query;
        navigator.permissions.query = function(permissionDesc) {
          if (permissionDesc.name === 'geolocation') {
            return Promise.resolve({
              state: 'granted',
              onchange: null
            });
          }
          return originalPermissionsQuery.call(this, permissionDesc);
        };

        console.log('[Basset Hound] Geolocation spoofing active: ${coords.latitude}, ${coords.longitude}');
      })();
    `;
  }

  /**
   * Generate timezone spoofing script to match location
   * @returns {string} - JavaScript code for timezone spoofing
   */
  getTimezoneSpoofScript() {
    if (!this._enabled) {
      return '// Timezone spoofing disabled';
    }

    return `
      (function() {
        'use strict';

        // Override Date.prototype.getTimezoneOffset
        const targetOffset = ${this._timezoneOffset};

        Date.prototype.getTimezoneOffset = function() {
          return -targetOffset; // getTimezoneOffset returns negative of actual offset
        };

        // Override Intl.DateTimeFormat for timezone
        const originalDateTimeFormat = Intl.DateTimeFormat;
        Intl.DateTimeFormat = function(locale, options) {
          const format = new originalDateTimeFormat(locale, options);
          const originalResolvedOptions = format.resolvedOptions.bind(format);
          format.resolvedOptions = function() {
            const resolved = originalResolvedOptions();
            resolved.timeZone = '${this._timezone}';
            return resolved;
          };
          return format;
        };
        Intl.DateTimeFormat.prototype = originalDateTimeFormat.prototype;
        Intl.DateTimeFormat.supportedLocalesOf = originalDateTimeFormat.supportedLocalesOf;

        console.log('[Basset Hound] Timezone spoofing active: ${this._timezone}');
      })();
    `;
  }

  /**
   * Get combined geolocation and timezone spoofing script
   * @returns {string} - Combined JavaScript code
   */
  getFullSpoofScript() {
    return `
      ${this.getGeolocationSpoofScript()}
      ${this.getTimezoneSpoofScript()}
    `;
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  /**
   * Calculate distance between two coordinates (in meters)
   * @param {number} lat1 - Latitude of first point
   * @param {number} lng1 - Longitude of first point
   * @param {number} lat2 - Latitude of second point
   * @param {number} lng2 - Longitude of second point
   * @returns {number} - Distance in meters
   */
  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Add random noise to coordinates for more realistic spoofing
   * @param {number} meters - Maximum deviation in meters
   * @returns {Object} - Coordinates with noise added
   */
  addNoise(meters = 10) {
    // Convert meters to approximate degrees
    const latNoise = (Math.random() - 0.5) * (meters / 111000);
    const lngNoise = (Math.random() - 0.5) * (meters / (111000 * Math.cos(this._latitude * Math.PI / 180)));

    return {
      latitude: this._latitude + latNoise,
      longitude: this._longitude + lngNoise
    };
  }

  /**
   * Get status summary
   * @returns {Object} - Status information
   */
  getStatus() {
    return {
      enabled: this._enabled,
      location: {
        latitude: this._latitude,
        longitude: this._longitude,
        accuracy: this._accuracy,
        altitude: this._altitude,
        altitudeAccuracy: this._altitudeAccuracy,
        heading: this._heading,
        speed: this._speed
      },
      timezone: this._timezone,
      timezoneOffset: this._timezoneOffset,
      activeWatchers: this._watchCallbacks.size
    };
  }

  /**
   * Reset to default location (New York City)
   * @returns {Object} - Success status
   */
  reset() {
    this._latitude = 40.7128;
    this._longitude = -74.0060;
    this._accuracy = 100;
    this._altitude = null;
    this._altitudeAccuracy = null;
    this._heading = null;
    this._speed = null;
    this._timezone = 'America/New_York';
    this._timezoneOffset = -300;
    this._watchCallbacks.clear();

    return {
      success: true,
      location: this.getLocation()
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this._watchCallbacks.clear();
    console.log('[GeolocationManager] Cleanup complete');
  }
}

// Export singleton instance and class
const geolocationManager = new GeolocationManager();

module.exports = {
  GeolocationManager,
  geolocationManager
};
