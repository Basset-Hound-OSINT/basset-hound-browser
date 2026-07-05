/**
 * Basset Hound Browser - Technology Fingerprints Database (barrel)
 * Contains patterns for detecting web technologies from various sources:
 * - HTML content patterns
 * - HTTP header patterns
 * - Script URL patterns
 * - Cookie patterns
 * - Meta tag patterns
 * - CSS patterns
 *
 * Inspired by Wappalyzer patterns but implemented independently.
 *
 * The fingerprint data was split into ./fingerprints/*.js modules
 * (modularization 2026-07-04) to keep every file under 1200 lines.
 * This barrel re-assembles the full FINGERPRINTS object and preserves the
 * original module.exports surface so existing consumers keep working unchanged.
 */

const { CATEGORIES } = require('./fingerprints/categories');

/**
 * Technology fingerprint database
 * Each technology has:
 * - name: Display name
 * - category: Category from CATEGORIES
 * - website: Official website
 * - icon: Icon identifier (optional)
 * - patterns: Detection patterns organized by type
 *
 * Assembled from the partitioned data modules (order preserved for stable
 * iteration order in getTechnologiesByCategory / searchTechnologies).
 */
const FINGERPRINTS = {
  ...require('./fingerprints/data-frameworks'),
  ...require('./fingerprints/data-libraries'),
  ...require('./fingerprints/data-css'),
  ...require('./fingerprints/data-cms'),
  ...require('./fingerprints/data-servers'),
  ...require('./fingerprints/data-analytics'),
  ...require('./fingerprints/data-cdn'),
  ...require('./fingerprints/data-services'),
  ...require('./fingerprints/data-backend')
};

/**
 * Get all technology fingerprints
 * @returns {Object} All technology fingerprints
 */
function getFingerprints() {
  return FINGERPRINTS;
}

/**
 * Get all categories
 * @returns {Object} All category definitions
 */
function getCategories() {
  return CATEGORIES;
}

/**
 * Get a specific technology fingerprint by key
 * @param {string} key - Technology key
 * @returns {Object|null} Technology fingerprint or null
 */
function getFingerprint(key) {
  return FINGERPRINTS[key.toLowerCase()] || null;
}

/**
 * Get technologies by category
 * @param {string} category - Category name
 * @returns {Array} Array of technology objects in the category
 */
function getTechnologiesByCategory(category) {
  const technologies = [];
  for (const [key, tech] of Object.entries(FINGERPRINTS)) {
    if (tech.category === category) {
      technologies.push({
        key,
        ...tech
      });
    }
  }
  return technologies;
}

/**
 * Get the count of all technologies
 * @returns {number} Total number of technologies
 */
function getTechnologyCount() {
  return Object.keys(FINGERPRINTS).length;
}

/**
 * Search technologies by name
 * @param {string} query - Search query
 * @returns {Array} Array of matching technology objects
 */
function searchTechnologies(query) {
  const searchLower = query.toLowerCase();
  const results = [];

  for (const [key, tech] of Object.entries(FINGERPRINTS)) {
    if (key.includes(searchLower) ||
        tech.name.toLowerCase().includes(searchLower) ||
        (tech.description && tech.description.toLowerCase().includes(searchLower))) {
      results.push({
        key,
        ...tech
      });
    }
  }

  return results;
}

module.exports = {
  FINGERPRINTS,
  CATEGORIES,
  getFingerprints,
  getCategories,
  getFingerprint,
  getTechnologiesByCategory,
  getTechnologyCount,
  searchTechnologies
};
