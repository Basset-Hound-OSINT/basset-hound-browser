/**
 * Analysis Module
 *
 * Provides website analysis capabilities:
 * - Technology detection (frameworks, CMS, servers, etc.)
 * - Metadata extraction
 * - Content analysis
 *
 * @module analysis
 */

const TechnologyDetector = require('./technology-detector');

/**
 * Create and export the main analysis module
 */
class AnalysisManager {
  constructor(options = {}) {
    this.technologyDetector = new TechnologyDetector(options);
  }

  /**
   * Detect technologies on a webpage
   * @param {object} options - Detection options
   * @returns {Promise<object>} Detection results
   */
  async detectTechnologies(options) {
    return this.technologyDetector.detect(options);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.technologyDetector.cleanup();
  }
}

module.exports = AnalysisManager;
