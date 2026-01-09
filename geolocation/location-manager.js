/**
 * Location Manager
 *
 * Phase 30: Geofencing/Location Simulation
 *
 * Provides geolocation spoofing, timezone simulation, and locale management
 * for realistic location-based testing and OSINT operations.
 *
 * Features:
 * - HTML5 Geolocation API override
 * - Timezone simulation (automatic based on coordinates)
 * - Language/locale simulation
 * - Pre-configured location profiles
 * - GPS coordinate simulation with realistic accuracy
 * - Integration with proxy location matching
 *
 * @module geolocation/location-manager
 */

const EventEmitter = require('events');

/**
 * Pre-configured location profiles
 */
const LOCATION_PROFILES = {
  // United States
  'us-new-york': {
    name: 'New York, USA',
    coordinates: { latitude: 40.7128, longitude: -74.0060, accuracy: 50 },
    timezone: 'America/New_York',
    locale: 'en-US',
    country: 'US',
    region: 'New York'
  },
  'us-los-angeles': {
    name: 'Los Angeles, USA',
    coordinates: { latitude: 34.0522, longitude: -118.2437, accuracy: 50 },
    timezone: 'America/Los_Angeles',
    locale: 'en-US',
    country: 'US',
    region: 'California'
  },
  'us-chicago': {
    name: 'Chicago, USA',
    coordinates: { latitude: 41.8781, longitude: -87.6298, accuracy: 50 },
    timezone: 'America/Chicago',
    locale: 'en-US',
    country: 'US',
    region: 'Illinois'
  },
  'us-miami': {
    name: 'Miami, USA',
    coordinates: { latitude: 25.7617, longitude: -80.1918, accuracy: 50 },
    timezone: 'America/New_York',
    locale: 'en-US',
    country: 'US',
    region: 'Florida'
  },

  // Europe
  'uk-london': {
    name: 'London, UK',
    coordinates: { latitude: 51.5074, longitude: -0.1278, accuracy: 50 },
    timezone: 'Europe/London',
    locale: 'en-GB',
    country: 'GB',
    region: 'England'
  },
  'france-paris': {
    name: 'Paris, France',
    coordinates: { latitude: 48.8566, longitude: 2.3522, accuracy: 50 },
    timezone: 'Europe/Paris',
    locale: 'fr-FR',
    country: 'FR',
    region: 'Île-de-France'
  },
  'germany-berlin': {
    name: 'Berlin, Germany',
    coordinates: { latitude: 52.5200, longitude: 13.4050, accuracy: 50 },
    timezone: 'Europe/Berlin',
    locale: 'de-DE',
    country: 'DE',
    region: 'Berlin'
  },
  'spain-madrid': {
    name: 'Madrid, Spain',
    coordinates: { latitude: 40.4168, longitude: -3.7038, accuracy: 50 },
    timezone: 'Europe/Madrid',
    locale: 'es-ES',
    country: 'ES',
    region: 'Madrid'
  },
  'italy-rome': {
    name: 'Rome, Italy',
    coordinates: { latitude: 41.9028, longitude: 12.4964, accuracy: 50 },
    timezone: 'Europe/Rome',
    locale: 'it-IT',
    country: 'IT',
    region: 'Lazio'
  },
  'netherlands-amsterdam': {
    name: 'Amsterdam, Netherlands',
    coordinates: { latitude: 52.3676, longitude: 4.9041, accuracy: 50 },
    timezone: 'Europe/Amsterdam',
    locale: 'nl-NL',
    country: 'NL',
    region: 'North Holland'
  },

  // Asia Pacific
  'japan-tokyo': {
    name: 'Tokyo, Japan',
    coordinates: { latitude: 35.6762, longitude: 139.6503, accuracy: 50 },
    timezone: 'Asia/Tokyo',
    locale: 'ja-JP',
    country: 'JP',
    region: 'Tokyo'
  },
  'china-beijing': {
    name: 'Beijing, China',
    coordinates: { latitude: 39.9042, longitude: 116.4074, accuracy: 50 },
    timezone: 'Asia/Shanghai',
    locale: 'zh-CN',
    country: 'CN',
    region: 'Beijing'
  },
  'china-shanghai': {
    name: 'Shanghai, China',
    coordinates: { latitude: 31.2304, longitude: 121.4737, accuracy: 50 },
    timezone: 'Asia/Shanghai',
    locale: 'zh-CN',
    country: 'CN',
    region: 'Shanghai'
  },
  'singapore': {
    name: 'Singapore',
    coordinates: { latitude: 1.3521, longitude: 103.8198, accuracy: 50 },
    timezone: 'Asia/Singapore',
    locale: 'en-SG',
    country: 'SG',
    region: 'Singapore'
  },
  'australia-sydney': {
    name: 'Sydney, Australia',
    coordinates: { latitude: -33.8688, longitude: 151.2093, accuracy: 50 },
    timezone: 'Australia/Sydney',
    locale: 'en-AU',
    country: 'AU',
    region: 'New South Wales'
  },
  'india-mumbai': {
    name: 'Mumbai, India',
    coordinates: { latitude: 19.0760, longitude: 72.8777, accuracy: 50 },
    timezone: 'Asia/Kolkata',
    locale: 'en-IN',
    country: 'IN',
    region: 'Maharashtra'
  },

  // Other regions
  'brazil-sao-paulo': {
    name: 'São Paulo, Brazil',
    coordinates: { latitude: -23.5505, longitude: -46.6333, accuracy: 50 },
    timezone: 'America/Sao_Paulo',
    locale: 'pt-BR',
    country: 'BR',
    region: 'São Paulo'
  },
  'canada-toronto': {
    name: 'Toronto, Canada',
    coordinates: { latitude: 43.6532, longitude: -79.3832, accuracy: 50 },
    timezone: 'America/Toronto',
    locale: 'en-CA',
    country: 'CA',
    region: 'Ontario'
  },
  'russia-moscow': {
    name: 'Moscow, Russia',
    coordinates: { latitude: 55.7558, longitude: 37.6173, accuracy: 50 },
    timezone: 'Europe/Moscow',
    locale: 'ru-RU',
    country: 'RU',
    region: 'Moscow'
  },
  'uae-dubai': {
    name: 'Dubai, UAE',
    coordinates: { latitude: 25.2048, longitude: 55.2708, accuracy: 50 },
    timezone: 'Asia/Dubai',
    locale: 'ar-AE',
    country: 'AE',
    region: 'Dubai'
  }
};

/**
 * Timezone mappings for automatic timezone detection
 */
const TIMEZONE_MAPPINGS = {
  'America/New_York': { offset: -5, dst: true },
  'America/Chicago': { offset: -6, dst: true },
  'America/Los_Angeles': { offset: -8, dst: true },
  'America/Toronto': { offset: -5, dst: true },
  'America/Sao_Paulo': { offset: -3, dst: false },
  'Europe/London': { offset: 0, dst: true },
  'Europe/Paris': { offset: 1, dst: true },
  'Europe/Berlin': { offset: 1, dst: true },
  'Europe/Madrid': { offset: 1, dst: true },
  'Europe/Rome': { offset: 1, dst: true },
  'Europe/Amsterdam': { offset: 1, dst: true },
  'Europe/Moscow': { offset: 3, dst: false },
  'Asia/Tokyo': { offset: 9, dst: false },
  'Asia/Shanghai': { offset: 8, dst: false },
  'Asia/Singapore': { offset: 8, dst: false },
  'Asia/Kolkata': { offset: 5.5, dst: false },
  'Asia/Dubai': { offset: 4, dst: false },
  'Australia/Sydney': { offset: 10, dst: true }
};

/**
 * Location Manager
 * Manages geolocation spoofing and location simulation
 */
class LocationManager extends EventEmitter {
  constructor(webContents) {
    super();

    this.webContents = webContents;
    this.enabled = false;

    // Current location settings
    this.currentLocation = {
      coordinates: null,
      timezone: null,
      locale: null,
      profile: null
    };

    // Statistics
    this.stats = {
      locationsSet: 0,
      profilesApplied: 0,
      injectionsPerformed: 0
    };
  }

  /**
   * Set geolocation coordinates
   */
  async setGeolocation(latitude, longitude, accuracy = 50, altitude = null, altitudeAccuracy = null) {
    this.currentLocation.coordinates = {
      latitude,
      longitude,
      accuracy,
      altitude,
      altitudeAccuracy,
      heading: null,
      speed: null
    };

    this.stats.locationsSet++;

    // Auto-detect timezone if not set
    if (!this.currentLocation.timezone) {
      this.currentLocation.timezone = this._detectTimezone(latitude, longitude);
    }

    await this._injectGeolocation();

    this.emit('location-changed', {
      coordinates: this.currentLocation.coordinates,
      timezone: this.currentLocation.timezone
    });

    return this.currentLocation.coordinates;
  }

  /**
   * Set location using pre-configured profile
   */
  async setLocationProfile(profileName) {
    const profile = LOCATION_PROFILES[profileName];

    if (!profile) {
      throw new Error(`Unknown location profile: ${profileName}`);
    }

    this.currentLocation.profile = profileName;
    this.currentLocation.coordinates = { ...profile.coordinates };
    this.currentLocation.timezone = profile.timezone;
    this.currentLocation.locale = profile.locale;

    this.stats.profilesApplied++;

    await this._injectGeolocation();
    await this._injectTimezone();
    await this._injectLocale();

    this.emit('profile-applied', {
      profile: profileName,
      location: profile
    });

    return profile;
  }

  /**
   * Set timezone
   */
  async setTimezone(timezone) {
    if (!TIMEZONE_MAPPINGS[timezone]) {
      console.warn(`Unknown timezone: ${timezone}, using anyway`);
    }

    this.currentLocation.timezone = timezone;
    await this._injectTimezone();

    this.emit('timezone-changed', { timezone });

    return { timezone };
  }

  /**
   * Set locale
   */
  async setLocale(locale, languages = null) {
    this.currentLocation.locale = locale;

    if (!languages) {
      // Auto-generate language array from locale
      const lang = locale.split('-')[0];
      languages = [locale, lang, 'en'];
    }

    await this._injectLocale(languages);

    this.emit('locale-changed', { locale, languages });

    return { locale, languages };
  }

  /**
   * Enable location spoofing
   */
  async enableLocationSpoofing() {
    this.enabled = true;

    if (this.currentLocation.coordinates) {
      await this._injectGeolocation();
    }
    if (this.currentLocation.timezone) {
      await this._injectTimezone();
    }
    if (this.currentLocation.locale) {
      await this._injectLocale();
    }

    this.emit('spoofing-enabled');

    return { enabled: true };
  }

  /**
   * Disable location spoofing
   */
  async disableLocationSpoofing() {
    this.enabled = false;

    // Remove overrides
    await this._removeGeolocationOverride();
    await this._removeTimezoneOverride();
    await this._removeLocaleOverride();

    this.emit('spoofing-disabled');

    return { enabled: false };
  }

  /**
   * Get current location status
   */
  getLocationStatus() {
    return {
      enabled: this.enabled,
      coordinates: this.currentLocation.coordinates,
      timezone: this.currentLocation.timezone,
      locale: this.currentLocation.locale,
      profile: this.currentLocation.profile
    };
  }

  /**
   * Match location to proxy (Phase 24 integration)
   */
  async matchLocationToProxy(proxyCountry, proxyCity = null) {
    // Try to find matching profile
    const countryCode = proxyCountry.toLowerCase();

    for (const [profileName, profile] of Object.entries(LOCATION_PROFILES)) {
      if (profile.country.toLowerCase() === countryCode) {
        // If city specified, try to match it
        if (proxyCity) {
          if (profile.name.toLowerCase().includes(proxyCity.toLowerCase())) {
            return await this.setLocationProfile(profileName);
          }
        } else {
          // Use first matching country
          return await this.setLocationProfile(profileName);
        }
      }
    }

    throw new Error(`No location profile found for country: ${proxyCountry}`);
  }

  /**
   * Reset location to default
   */
  async resetLocation() {
    this.currentLocation = {
      coordinates: null,
      timezone: null,
      locale: null,
      profile: null
    };

    this.enabled = false;

    await this._removeGeolocationOverride();
    await this._removeTimezoneOverride();
    await this._removeLocaleOverride();

    this.emit('location-reset');

    return { reset: true };
  }

  /**
   * Get available location profiles
   */
  getAvailableProfiles() {
    return Object.keys(LOCATION_PROFILES).map(key => ({
      id: key,
      ...LOCATION_PROFILES[key]
    }));
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return { ...this.stats };
  }

  /**
   * Inject geolocation override
   */
  async _injectGeolocation() {
    if (!this.enabled || !this.currentLocation.coordinates) {
      return;
    }

    const coords = this.currentLocation.coordinates;

    const injectionScript = `
      (function() {
        const mockPosition = {
          coords: {
            latitude: ${coords.latitude},
            longitude: ${coords.longitude},
            accuracy: ${coords.accuracy},
            altitude: ${coords.altitude !== null ? coords.altitude : 'null'},
            altitudeAccuracy: ${coords.altitudeAccuracy !== null ? coords.altitudeAccuracy : 'null'},
            heading: null,
            speed: null
          },
          timestamp: Date.now()
        };

        // Override geolocation API
        if (navigator.geolocation) {
          const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
          const originalWatchPosition = navigator.geolocation.watchPosition;

          navigator.geolocation.getCurrentPosition = function(success, error, options) {
            if (success) {
              success(mockPosition);
            }
          };

          navigator.geolocation.watchPosition = function(success, error, options) {
            if (success) {
              success(mockPosition);
            }
            return Math.floor(Math.random() * 10000);
          };

          // Store original for debugging
          navigator.geolocation._originalGetCurrentPosition = originalGetCurrentPosition;
          navigator.geolocation._originalWatchPosition = originalWatchPosition;
        }
      })();
    `;

    await this.webContents.executeJavaScript(injectionScript);
    this.stats.injectionsPerformed++;
  }

  /**
   * Inject timezone override
   */
  async _injectTimezone() {
    if (!this.enabled || !this.currentLocation.timezone) {
      return;
    }

    const timezone = this.currentLocation.timezone;
    const tzInfo = TIMEZONE_MAPPINGS[timezone] || { offset: 0, dst: false };

    const injectionScript = `
      (function() {
        const timezoneOffset = ${tzInfo.offset * 60};

        // Override Date methods
        const OriginalDate = Date;
        const DateProxy = new Proxy(Date, {
          construct(target, args) {
            return new OriginalDate(...args);
          },
          apply(target, thisArg, args) {
            return OriginalDate(...args);
          }
        });

        DateProxy.prototype = OriginalDate.prototype;

        // Override getTimezoneOffset
        const originalGetTimezoneOffset = DateProxy.prototype.getTimezoneOffset;
        DateProxy.prototype.getTimezoneOffset = function() {
          return -timezoneOffset;
        };

        // Override toLocaleString to use timezone
        const originalToLocaleString = DateProxy.prototype.toLocaleString;
        DateProxy.prototype.toLocaleString = function(...args) {
          if (!args[1]) args[1] = {};
          args[1].timeZone = '${timezone}';
          return originalToLocaleString.apply(this, args);
        };

        // Set global Date
        window.Date = DateProxy;

        // Set Intl.DateTimeFormat default timezone
        const OriginalDateTimeFormat = Intl.DateTimeFormat;
        Intl.DateTimeFormat = function(...args) {
          if (!args[1]) args[1] = {};
          if (!args[1].timeZone) args[1].timeZone = '${timezone}';
          return new OriginalDateTimeFormat(...args);
        };
        Intl.DateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
      })();
    `;

    await this.webContents.executeJavaScript(injectionScript);
  }

  /**
   * Inject locale override
   */
  async _injectLocale(languages = null) {
    if (!this.enabled || !this.currentLocation.locale) {
      return;
    }

    const locale = this.currentLocation.locale;

    if (!languages) {
      const lang = locale.split('-')[0];
      languages = [locale, lang, 'en'];
    }

    const injectionScript = `
      (function() {
        // Override navigator.language
        Object.defineProperty(navigator, 'language', {
          get: function() { return '${locale}'; }
        });

        // Override navigator.languages
        Object.defineProperty(navigator, 'languages', {
          get: function() { return ${JSON.stringify(languages)}; }
        });

        // Override Intl.DateTimeFormat().resolvedOptions().locale
        const OriginalDateTimeFormat = Intl.DateTimeFormat;
        Intl.DateTimeFormat = function(...args) {
          if (!args[0]) args[0] = '${locale}';
          return new OriginalDateTimeFormat(...args);
        };
        Intl.DateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
      })();
    `;

    await this.webContents.executeJavaScript(injectionScript);
  }

  /**
   * Remove geolocation override
   */
  async _removeGeolocationOverride() {
    const removalScript = `
      (function() {
        if (navigator.geolocation && navigator.geolocation._originalGetCurrentPosition) {
          navigator.geolocation.getCurrentPosition = navigator.geolocation._originalGetCurrentPosition;
          navigator.geolocation.watchPosition = navigator.geolocation._originalWatchPosition;
          delete navigator.geolocation._originalGetCurrentPosition;
          delete navigator.geolocation._originalWatchPosition;
        }
      })();
    `;

    try {
      await this.webContents.executeJavaScript(removalScript);
    } catch (error) {
      // Ignore errors if page is not loaded
    }
  }

  /**
   * Remove timezone override
   */
  async _removeTimezoneOverride() {
    // Timezone override requires page reload to fully remove
    // This is a limitation of how Date is implemented
  }

  /**
   * Remove locale override
   */
  async _removeLocaleOverride() {
    // Locale override requires page reload to fully remove
  }

  /**
   * Detect timezone from coordinates (simplified)
   */
  _detectTimezone(latitude, longitude) {
    // Simplified timezone detection based on longitude
    // In production, use a proper timezone library

    if (longitude >= -180 && longitude < -52.5) {
      // Americas
      if (latitude > 45) return 'America/Toronto';
      if (longitude >= -125) return 'America/Los_Angeles';
      if (longitude >= -105) return 'America/Chicago';
      if (longitude >= -75) return 'America/New_York';
      return 'America/Sao_Paulo';
    } else if (longitude >= -52.5 && longitude < 37.5) {
      // Europe/Africa
      if (latitude > 50) return 'Europe/London';
      if (longitude < 15) return 'Europe/Paris';
      return 'Europe/Berlin';
    } else if (longitude >= 37.5 && longitude < 142.5) {
      // Asia
      if (longitude < 75) return 'Asia/Dubai';
      if (longitude < 90) return 'Asia/Kolkata';
      if (longitude < 120) return 'Asia/Singapore';
      return 'Asia/Tokyo';
    } else {
      // Pacific
      return 'Australia/Sydney';
    }
  }
}

module.exports = {
  LocationManager,
  LOCATION_PROFILES,
  TIMEZONE_MAPPINGS
};
