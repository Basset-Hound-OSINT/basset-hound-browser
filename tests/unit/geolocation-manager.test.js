/**
 * Basset Hound Browser - Geolocation Manager Unit Tests
 * Tests for geolocation spoofing and timezone management
 */

const { GeolocationManager, geolocationManager } = require('../../geolocation/manager');
const {
  getAllPresets,
  findPresetByName,
  getTimezoneOffset,
  getPresetsByCountry,
  getPresetsByRegion
} = require('../../geolocation/presets');

describe('GeolocationManager', () => {
  let manager;

  beforeEach(() => {
    manager = new GeolocationManager();
  });

  describe('Constructor', () => {
    test('should initialize with default New York City location', () => {
      expect(manager.latitude).toBeCloseTo(40.7128, 4);
      expect(manager.longitude).toBeCloseTo(-74.006, 4);
      expect(manager.timezone).toBe('America/New_York');
      expect(manager.timezoneOffset).toBe(-300);
    });

    test('should initialize with default values', () => {
      expect(manager.accuracy).toBe(100);
      expect(manager.altitude).toBeNull();
      expect(manager.altitudeAccuracy).toBeNull();
      expect(manager.heading).toBeNull();
      expect(manager.speed).toBeNull();
      expect(manager.isEnabled()).toBe(false);
    });
  });

  describe('Property Setters', () => {
    describe('latitude', () => {
      test('should accept valid latitude', () => {
        manager.latitude = 45.5;
        expect(manager.latitude).toBe(45.5);
      });

      test('should accept boundary values', () => {
        manager.latitude = 90;
        expect(manager.latitude).toBe(90);

        manager.latitude = -90;
        expect(manager.latitude).toBe(-90);
      });

      test('should reject invalid latitude', () => {
        expect(() => { manager.latitude = 91; }).toThrow();
        expect(() => { manager.latitude = -91; }).toThrow();
        expect(() => { manager.latitude = 'abc'; }).toThrow();
      });
    });

    describe('longitude', () => {
      test('should accept valid longitude', () => {
        manager.longitude = 120.5;
        expect(manager.longitude).toBe(120.5);
      });

      test('should accept boundary values', () => {
        manager.longitude = 180;
        expect(manager.longitude).toBe(180);

        manager.longitude = -180;
        expect(manager.longitude).toBe(-180);
      });

      test('should reject invalid longitude', () => {
        expect(() => { manager.longitude = 181; }).toThrow();
        expect(() => { manager.longitude = -181; }).toThrow();
        expect(() => { manager.longitude = 'abc'; }).toThrow();
      });
    });

    describe('accuracy', () => {
      test('should accept positive accuracy', () => {
        manager.accuracy = 50;
        expect(manager.accuracy).toBe(50);
      });

      test('should reject non-positive accuracy', () => {
        expect(() => { manager.accuracy = 0; }).toThrow();
        expect(() => { manager.accuracy = -10; }).toThrow();
      });
    });

    describe('altitude', () => {
      test('should accept number or null', () => {
        manager.altitude = 100;
        expect(manager.altitude).toBe(100);

        manager.altitude = null;
        expect(manager.altitude).toBeNull();
      });

      test('should reject invalid values', () => {
        expect(() => { manager.altitude = 'high'; }).toThrow();
      });
    });

    describe('altitudeAccuracy', () => {
      test('should accept positive number or null', () => {
        manager.altitudeAccuracy = 10;
        expect(manager.altitudeAccuracy).toBe(10);

        manager.altitudeAccuracy = null;
        expect(manager.altitudeAccuracy).toBeNull();
      });

      test('should reject non-positive values', () => {
        expect(() => { manager.altitudeAccuracy = 0; }).toThrow();
        expect(() => { manager.altitudeAccuracy = -5; }).toThrow();
      });
    });

    describe('heading', () => {
      test('should accept valid heading', () => {
        manager.heading = 90;
        expect(manager.heading).toBe(90);

        manager.heading = 0;
        expect(manager.heading).toBe(0);

        manager.heading = null;
        expect(manager.heading).toBeNull();
      });

      test('should reject invalid heading', () => {
        expect(() => { manager.heading = 360; }).toThrow();
        expect(() => { manager.heading = -1; }).toThrow();
      });
    });

    describe('speed', () => {
      test('should accept non-negative speed', () => {
        manager.speed = 50;
        expect(manager.speed).toBe(50);

        manager.speed = 0;
        expect(manager.speed).toBe(0);

        manager.speed = null;
        expect(manager.speed).toBeNull();
      });

      test('should reject negative speed', () => {
        expect(() => { manager.speed = -10; }).toThrow();
      });
    });
  });

  describe('setLocation', () => {
    test('should set location with basic coordinates', () => {
      const result = manager.setLocation(48.8566, 2.3522);

      expect(result.success).toBe(true);
      expect(result.location.coords.latitude).toBeCloseTo(48.8566, 4);
      expect(result.location.coords.longitude).toBeCloseTo(2.3522, 4);
    });

    test('should set location with options', () => {
      const result = manager.setLocation(35.6762, 139.6503, {
        accuracy: 50,
        altitude: 40,
        altitudeAccuracy: 5,
        heading: 45,
        speed: 10,
        timezone: 'Asia/Tokyo'
      });

      expect(result.success).toBe(true);
      expect(manager.accuracy).toBe(50);
      expect(manager.altitude).toBe(40);
      expect(manager.altitudeAccuracy).toBe(5);
      expect(manager.heading).toBe(45);
      expect(manager.speed).toBe(10);
      expect(manager.timezone).toBe('Asia/Tokyo');
    });

    test('should return error for invalid coordinates', () => {
      const result = manager.setLocation(100, 200);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('setLocationByCity', () => {
    test('should set location for known city', () => {
      const result = manager.setLocationByCity('London');

      expect(result.success).toBe(true);
      expect(result.location.coords.latitude).toBeCloseTo(51.5074, 4);
      expect(result.location.coords.longitude).toBeCloseTo(-0.1278, 4);
    });

    test('should return error for unknown city', () => {
      const result = manager.setLocationByCity('NonexistentCity');

      expect(result.success).toBe(false);
      expect(result.error).toContain('City not found');
      expect(result.availableCities).toBeDefined();
    });

    test('should handle case-insensitive city names', () => {
      const result = manager.setLocationByCity('TOKYO');

      expect(result.success).toBe(true);
    });

    test('should handle partial city names', () => {
      const result = manager.setLocationByCity('New York');

      expect(result.success).toBe(true);
    });
  });

  describe('getLocation', () => {
    test('should return complete location object', () => {
      const location = manager.getLocation();

      expect(location).toHaveProperty('coords');
      expect(location).toHaveProperty('timestamp');
      expect(location).toHaveProperty('timezone');
      expect(location).toHaveProperty('timezoneOffset');
      expect(location).toHaveProperty('spoofingEnabled');

      expect(location.coords).toHaveProperty('latitude');
      expect(location.coords).toHaveProperty('longitude');
      expect(location.coords).toHaveProperty('accuracy');
      expect(location.coords).toHaveProperty('altitude');
      expect(location.coords).toHaveProperty('altitudeAccuracy');
      expect(location.coords).toHaveProperty('heading');
      expect(location.coords).toHaveProperty('speed');
    });

    test('should include current timestamp', () => {
      const before = Date.now();
      const location = manager.getLocation();
      const after = Date.now();

      expect(location.timestamp).toBeGreaterThanOrEqual(before);
      expect(location.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('enableSpoofing / disableSpoofing', () => {
    test('should enable spoofing', () => {
      const result = manager.enableSpoofing();

      expect(result.success).toBe(true);
      expect(result.enabled).toBe(true);
      expect(manager.isEnabled()).toBe(true);
    });

    test('should disable spoofing', () => {
      manager.enableSpoofing();
      const result = manager.disableSpoofing();

      expect(result.success).toBe(true);
      expect(result.enabled).toBe(false);
      expect(manager.isEnabled()).toBe(false);
    });
  });

  describe('getPresetLocations', () => {
    test('should return all presets without filter', () => {
      const presets = manager.getPresetLocations();

      expect(Array.isArray(presets)).toBe(true);
      expect(presets.length).toBeGreaterThan(0);
    });

    test('should filter by country', () => {
      const presets = manager.getPresetLocations({ country: 'Japan' });

      expect(presets.length).toBeGreaterThan(0);
      presets.forEach(p => expect(p.country).toBe('Japan'));
    });

    test('should filter by region', () => {
      const presets = manager.getPresetLocations({ region: 'europe' });

      expect(presets.length).toBeGreaterThan(0);
    });
  });

  describe('Watch Position Simulation', () => {
    test('should add watcher and return ID', () => {
      const callback = jest.fn();

      const watchId = manager.addWatcher(callback);

      expect(typeof watchId).toBe('number');
      expect(watchId).toBeGreaterThan(0);
    });

    test('should remove watcher', () => {
      const callback = jest.fn();
      const watchId = manager.addWatcher(callback);

      const result = manager.removeWatcher(watchId);

      expect(result).toBe(true);
    });

    test('should notify watchers on location change when enabled', () => {
      const callback = jest.fn();
      manager.addWatcher(callback);
      manager.enableSpoofing();

      manager.setLocation(40, -74);

      expect(callback).toHaveBeenCalled();
    });

    test('should not notify watchers when disabled', () => {
      const callback = jest.fn();
      manager.addWatcher(callback);

      manager.setLocation(40, -74);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Script Generation', () => {
    test('should return disabled comment when spoofing disabled', () => {
      const script = manager.getGeolocationSpoofScript();

      expect(script).toContain('disabled');
    });

    test('should generate geolocation spoof script when enabled', () => {
      manager.enableSpoofing();
      manager.setLocation(40, -74);

      const script = manager.getGeolocationSpoofScript();

      expect(script).toContain('40');
      expect(script).toContain('-74');
      expect(script).toContain('getCurrentPosition');
      expect(script).toContain('watchPosition');
    });

    test('should generate timezone spoof script when enabled', () => {
      manager.enableSpoofing();

      const script = manager.getTimezoneSpoofScript();

      expect(script).toContain('getTimezoneOffset');
      expect(script).toContain('Intl.DateTimeFormat');
    });

    test('should generate full spoof script', () => {
      manager.enableSpoofing();

      const script = manager.getFullSpoofScript();

      expect(script).toContain('getCurrentPosition');
      expect(script).toContain('getTimezoneOffset');
    });
  });

  describe('calculateDistance (static)', () => {
    test('should calculate distance between two points', () => {
      // New York to Los Angeles (~3940 km)
      const distance = GeolocationManager.calculateDistance(
        40.7128, -74.0060,  // NYC
        34.0522, -118.2437  // LA
      );

      expect(distance).toBeGreaterThan(3900000); // meters
      expect(distance).toBeLessThan(4000000);
    });

    test('should return 0 for same location', () => {
      const distance = GeolocationManager.calculateDistance(40, -74, 40, -74);

      expect(distance).toBe(0);
    });
  });

  describe('addNoise', () => {
    test('should add noise to coordinates', () => {
      manager.setLocation(40, -74);

      const noisy = manager.addNoise(10);

      expect(noisy.latitude).not.toBe(40);
      expect(noisy.longitude).not.toBe(-74);

      // Should be within roughly 10 meters
      expect(Math.abs(noisy.latitude - 40)).toBeLessThan(0.001);
      expect(Math.abs(noisy.longitude - (-74))).toBeLessThan(0.001);
    });
  });

  describe('getStatus', () => {
    test('should return status object', () => {
      manager.enableSpoofing();
      manager.addWatcher(() => {});

      const status = manager.getStatus();

      expect(status).toHaveProperty('enabled', true);
      expect(status).toHaveProperty('location');
      expect(status).toHaveProperty('timezone');
      expect(status).toHaveProperty('timezoneOffset');
      expect(status).toHaveProperty('activeWatchers', 1);
    });
  });

  describe('reset', () => {
    test('should reset to default location', () => {
      manager.setLocation(51.5, -0.12);
      manager.enableSpoofing();

      const result = manager.reset();

      expect(result.success).toBe(true);
      expect(manager.latitude).toBeCloseTo(40.7128, 4);
      expect(manager.longitude).toBeCloseTo(-74.006, 4);
    });

    test('should clear watchers', () => {
      manager.addWatcher(() => {});
      manager.addWatcher(() => {});

      manager.reset();

      expect(manager.getStatus().activeWatchers).toBe(0);
    });
  });

  describe('cleanup', () => {
    test('should clear all watchers', () => {
      manager.addWatcher(() => {});
      manager.addWatcher(() => {});

      manager.cleanup();

      expect(manager.getStatus().activeWatchers).toBe(0);
    });
  });
});

describe('Geolocation Presets', () => {
  describe('getAllPresets', () => {
    test('should return array of presets', () => {
      const presets = getAllPresets();

      expect(Array.isArray(presets)).toBe(true);
      expect(presets.length).toBeGreaterThan(30);
    });

    test('should include timezone offset', () => {
      const presets = getAllPresets();

      presets.forEach(p => {
        expect(p).toHaveProperty('timezoneOffset');
        expect(typeof p.timezoneOffset).toBe('number');
      });
    });
  });

  describe('findPresetByName', () => {
    test('should find exact match', () => {
      const preset = findPresetByName('London');

      expect(preset).not.toBeNull();
      expect(preset.name).toBe('London');
      expect(preset.country).toBe('United Kingdom');
    });

    test('should be case-insensitive', () => {
      const preset = findPresetByName('PARIS');

      expect(preset).not.toBeNull();
      expect(preset.name).toBe('Paris');
    });

    test('should find partial match', () => {
      const preset = findPresetByName('San Fran');

      expect(preset).not.toBeNull();
      expect(preset.name).toBe('San Francisco');
    });

    test('should return null for unknown city', () => {
      const preset = findPresetByName('Atlantis');

      expect(preset).toBeNull();
    });

    test('should return null for empty input', () => {
      expect(findPresetByName('')).toBeNull();
      expect(findPresetByName(null)).toBeNull();
    });
  });

  describe('getTimezoneOffset', () => {
    test('should return correct offset for known timezones', () => {
      expect(getTimezoneOffset('America/New_York')).toBe(-300);
      expect(getTimezoneOffset('Asia/Tokyo')).toBe(540);
      expect(getTimezoneOffset('Europe/London')).toBe(0);
      expect(getTimezoneOffset('Europe/Paris')).toBe(60);
    });

    test('should return 0 for unknown timezone', () => {
      expect(getTimezoneOffset('Unknown/Timezone')).toBe(0);
    });
  });

  describe('getPresetsByCountry', () => {
    test('should filter by country', () => {
      const presets = getPresetsByCountry('United States');

      expect(presets.length).toBeGreaterThan(0);
      presets.forEach(p => expect(p.country).toBe('United States'));
    });

    test('should be case-insensitive', () => {
      const presets = getPresetsByCountry('JAPAN');

      expect(presets.length).toBeGreaterThan(0);
    });

    test('should return empty array for unknown country', () => {
      const presets = getPresetsByCountry('Narnia');

      expect(presets).toEqual([]);
    });

    test('should return empty array for empty input', () => {
      expect(getPresetsByCountry('')).toEqual([]);
    });
  });

  describe('getPresetsByRegion', () => {
    test('should filter by region', () => {
      const europePresets = getPresetsByRegion('europe');
      expect(europePresets.length).toBeGreaterThan(0);

      const asiaPresets = getPresetsByRegion('asia');
      expect(asiaPresets.length).toBeGreaterThan(0);
    });

    test('should handle different region formats', () => {
      const na1 = getPresetsByRegion('north_america');
      const na2 = getPresetsByRegion('north-america');
      const na3 = getPresetsByRegion('North America');

      expect(na1.length).toBe(na2.length);
      expect(na2.length).toBe(na3.length);
    });

    test('should return empty array for unknown region', () => {
      const presets = getPresetsByRegion('antarctica');

      expect(presets).toEqual([]);
    });
  });
});

describe('Singleton Instance', () => {
  test('should export singleton instance', () => {
    expect(geolocationManager).toBeInstanceOf(GeolocationManager);
  });

  test('should be the same instance', () => {
    const { geolocationManager: instance1 } = require('../../geolocation/manager');
    const { geolocationManager: instance2 } = require('../../geolocation/manager');

    expect(instance1).toBe(instance2);
  });
});
