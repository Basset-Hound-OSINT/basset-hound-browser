/**
 * Basset Hound Browser - Geolocation Preset Locations
 * Contains predefined locations for major cities worldwide
 */

const PRESET_LOCATIONS = [
  // North America
  {
    name: 'New York City',
    country: 'United States',
    latitude: 40.7128,
    longitude: -74.0060,
    timezone: 'America/New_York'
  },
  {
    name: 'Los Angeles',
    country: 'United States',
    latitude: 34.0522,
    longitude: -118.2437,
    timezone: 'America/Los_Angeles'
  },
  {
    name: 'Chicago',
    country: 'United States',
    latitude: 41.8781,
    longitude: -87.6298,
    timezone: 'America/Chicago'
  },
  {
    name: 'San Francisco',
    country: 'United States',
    latitude: 37.7749,
    longitude: -122.4194,
    timezone: 'America/Los_Angeles'
  },
  {
    name: 'Miami',
    country: 'United States',
    latitude: 25.7617,
    longitude: -80.1918,
    timezone: 'America/New_York'
  },
  {
    name: 'Seattle',
    country: 'United States',
    latitude: 47.6062,
    longitude: -122.3321,
    timezone: 'America/Los_Angeles'
  },
  {
    name: 'Toronto',
    country: 'Canada',
    latitude: 43.6532,
    longitude: -79.3832,
    timezone: 'America/Toronto'
  },
  {
    name: 'Vancouver',
    country: 'Canada',
    latitude: 49.2827,
    longitude: -123.1207,
    timezone: 'America/Vancouver'
  },
  {
    name: 'Mexico City',
    country: 'Mexico',
    latitude: 19.4326,
    longitude: -99.1332,
    timezone: 'America/Mexico_City'
  },

  // Europe
  {
    name: 'London',
    country: 'United Kingdom',
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London'
  },
  {
    name: 'Paris',
    country: 'France',
    latitude: 48.8566,
    longitude: 2.3522,
    timezone: 'Europe/Paris'
  },
  {
    name: 'Berlin',
    country: 'Germany',
    latitude: 52.5200,
    longitude: 13.4050,
    timezone: 'Europe/Berlin'
  },
  {
    name: 'Amsterdam',
    country: 'Netherlands',
    latitude: 52.3676,
    longitude: 4.9041,
    timezone: 'Europe/Amsterdam'
  },
  {
    name: 'Madrid',
    country: 'Spain',
    latitude: 40.4168,
    longitude: -3.7038,
    timezone: 'Europe/Madrid'
  },
  {
    name: 'Rome',
    country: 'Italy',
    latitude: 41.9028,
    longitude: 12.4964,
    timezone: 'Europe/Rome'
  },
  {
    name: 'Moscow',
    country: 'Russia',
    latitude: 55.7558,
    longitude: 37.6173,
    timezone: 'Europe/Moscow'
  },
  {
    name: 'Stockholm',
    country: 'Sweden',
    latitude: 59.3293,
    longitude: 18.0686,
    timezone: 'Europe/Stockholm'
  },
  {
    name: 'Vienna',
    country: 'Austria',
    latitude: 48.2082,
    longitude: 16.3738,
    timezone: 'Europe/Vienna'
  },

  // Asia
  {
    name: 'Tokyo',
    country: 'Japan',
    latitude: 35.6762,
    longitude: 139.6503,
    timezone: 'Asia/Tokyo'
  },
  {
    name: 'Beijing',
    country: 'China',
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 'Asia/Shanghai'
  },
  {
    name: 'Shanghai',
    country: 'China',
    latitude: 31.2304,
    longitude: 121.4737,
    timezone: 'Asia/Shanghai'
  },
  {
    name: 'Hong Kong',
    country: 'China',
    latitude: 22.3193,
    longitude: 114.1694,
    timezone: 'Asia/Hong_Kong'
  },
  {
    name: 'Singapore',
    country: 'Singapore',
    latitude: 1.3521,
    longitude: 103.8198,
    timezone: 'Asia/Singapore'
  },
  {
    name: 'Seoul',
    country: 'South Korea',
    latitude: 37.5665,
    longitude: 126.9780,
    timezone: 'Asia/Seoul'
  },
  {
    name: 'Mumbai',
    country: 'India',
    latitude: 19.0760,
    longitude: 72.8777,
    timezone: 'Asia/Kolkata'
  },
  {
    name: 'Dubai',
    country: 'United Arab Emirates',
    latitude: 25.2048,
    longitude: 55.2708,
    timezone: 'Asia/Dubai'
  },
  {
    name: 'Bangkok',
    country: 'Thailand',
    latitude: 13.7563,
    longitude: 100.5018,
    timezone: 'Asia/Bangkok'
  },

  // South America
  {
    name: 'Sao Paulo',
    country: 'Brazil',
    latitude: -23.5505,
    longitude: -46.6333,
    timezone: 'America/Sao_Paulo'
  },
  {
    name: 'Buenos Aires',
    country: 'Argentina',
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: 'America/Argentina/Buenos_Aires'
  },
  {
    name: 'Rio de Janeiro',
    country: 'Brazil',
    latitude: -22.9068,
    longitude: -43.1729,
    timezone: 'America/Sao_Paulo'
  },
  {
    name: 'Lima',
    country: 'Peru',
    latitude: -12.0464,
    longitude: -77.0428,
    timezone: 'America/Lima'
  },
  {
    name: 'Bogota',
    country: 'Colombia',
    latitude: 4.7110,
    longitude: -74.0721,
    timezone: 'America/Bogota'
  },

  // Oceania
  {
    name: 'Sydney',
    country: 'Australia',
    latitude: -33.8688,
    longitude: 151.2093,
    timezone: 'Australia/Sydney'
  },
  {
    name: 'Melbourne',
    country: 'Australia',
    latitude: -37.8136,
    longitude: 144.9631,
    timezone: 'Australia/Melbourne'
  },
  {
    name: 'Auckland',
    country: 'New Zealand',
    latitude: -36.8485,
    longitude: 174.7633,
    timezone: 'Pacific/Auckland'
  },

  // Africa
  {
    name: 'Cairo',
    country: 'Egypt',
    latitude: 30.0444,
    longitude: 31.2357,
    timezone: 'Africa/Cairo'
  },
  {
    name: 'Johannesburg',
    country: 'South Africa',
    latitude: -26.2041,
    longitude: 28.0473,
    timezone: 'Africa/Johannesburg'
  },
  {
    name: 'Lagos',
    country: 'Nigeria',
    latitude: 6.5244,
    longitude: 3.3792,
    timezone: 'Africa/Lagos'
  },
  {
    name: 'Nairobi',
    country: 'Kenya',
    latitude: -1.2921,
    longitude: 36.8219,
    timezone: 'Africa/Nairobi'
  },
  {
    name: 'Cape Town',
    country: 'South Africa',
    latitude: -33.9249,
    longitude: 18.4241,
    timezone: 'Africa/Johannesburg'
  }
];

/**
 * Get timezone offset in minutes for a timezone name
 * @param {string} timezone - IANA timezone name
 * @returns {number} - Offset in minutes
 */
function getTimezoneOffset(timezone) {
  const offsets = {
    'America/New_York': -300,
    'America/Los_Angeles': -480,
    'America/Chicago': -360,
    'America/Denver': -420,
    'America/Toronto': -300,
    'America/Vancouver': -480,
    'America/Mexico_City': -360,
    'America/Sao_Paulo': -180,
    'America/Argentina/Buenos_Aires': -180,
    'America/Lima': -300,
    'America/Bogota': -300,
    'Europe/London': 0,
    'Europe/Paris': 60,
    'Europe/Berlin': 60,
    'Europe/Amsterdam': 60,
    'Europe/Madrid': 60,
    'Europe/Rome': 60,
    'Europe/Moscow': 180,
    'Europe/Stockholm': 60,
    'Europe/Vienna': 60,
    'Asia/Tokyo': 540,
    'Asia/Shanghai': 480,
    'Asia/Hong_Kong': 480,
    'Asia/Singapore': 480,
    'Asia/Seoul': 540,
    'Asia/Kolkata': 330,
    'Asia/Dubai': 240,
    'Asia/Bangkok': 420,
    'Australia/Sydney': 600,
    'Australia/Melbourne': 600,
    'Pacific/Auckland': 720,
    'Africa/Cairo': 120,
    'Africa/Johannesburg': 120,
    'Africa/Lagos': 60,
    'Africa/Nairobi': 180
  };

  return offsets[timezone] || 0;
}

/**
 * Find a preset location by name (case-insensitive)
 * @param {string} name - City name to search for
 * @returns {Object|null} - Preset location or null if not found
 */
function findPresetByName(name) {
  if (!name) return null;
  const searchName = name.toLowerCase().trim();
  return PRESET_LOCATIONS.find(
    loc => loc.name.toLowerCase() === searchName ||
           loc.name.toLowerCase().includes(searchName)
  ) || null;
}

/**
 * Get all preset locations
 * @returns {Array} - Array of preset locations
 */
function getAllPresets() {
  return PRESET_LOCATIONS.map(loc => ({
    ...loc,
    timezoneOffset: getTimezoneOffset(loc.timezone)
  }));
}

/**
 * Get presets filtered by country
 * @param {string} country - Country name
 * @returns {Array} - Filtered preset locations
 */
function getPresetsByCountry(country) {
  if (!country) return [];
  const searchCountry = country.toLowerCase().trim();
  return PRESET_LOCATIONS.filter(
    loc => loc.country.toLowerCase() === searchCountry ||
           loc.country.toLowerCase().includes(searchCountry)
  ).map(loc => ({
    ...loc,
    timezoneOffset: getTimezoneOffset(loc.timezone)
  }));
}

/**
 * Get presets filtered by continent/region
 * @param {string} region - Region name (e.g., 'europe', 'asia', 'north_america')
 * @returns {Array} - Filtered preset locations
 */
function getPresetsByRegion(region) {
  const regions = {
    'north_america': ['United States', 'Canada', 'Mexico'],
    'south_america': ['Brazil', 'Argentina', 'Peru', 'Colombia'],
    'europe': ['United Kingdom', 'France', 'Germany', 'Netherlands', 'Spain', 'Italy', 'Russia', 'Sweden', 'Austria'],
    'asia': ['Japan', 'China', 'Singapore', 'South Korea', 'India', 'United Arab Emirates', 'Thailand'],
    'oceania': ['Australia', 'New Zealand'],
    'africa': ['Egypt', 'South Africa', 'Nigeria', 'Kenya']
  };

  const searchRegion = region.toLowerCase().replace(/[- ]/g, '_').trim();
  const countries = regions[searchRegion] || [];

  return PRESET_LOCATIONS.filter(loc => countries.includes(loc.country))
    .map(loc => ({
      ...loc,
      timezoneOffset: getTimezoneOffset(loc.timezone)
    }));
}

module.exports = {
  PRESET_LOCATIONS,
  getTimezoneOffset,
  findPresetByName,
  getAllPresets,
  getPresetsByCountry,
  getPresetsByRegion
};
