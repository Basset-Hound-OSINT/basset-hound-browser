/**
 * WebSocket handlers for technology detection commands
 * Integrates TechDetector with WebSocket API
 */

const TechDetector = require('../../src/analysis/tech-detector');
const path = require('path');
const fs = require('fs').promises;

class TechDetectionHandler {
  constructor() {
    this.detectors = new Map(); // Store detectors per session
    this.signaturePath = path.join(__dirname, '../../data/technology-signatures.json');
  }

  /**
   * Get or create detector for session
   */
  async getDetector(sessionId) {
    if (!this.detectors.has(sessionId)) {
      const detector = new TechDetector();
      // Load signature database
      try {
        const sigData = await fs.readFile(this.signaturePath, 'utf-8');
        detector.signatures = JSON.parse(sigData).technologies;
      } catch (err) {
        console.error('Failed to load signatures:', err);
        // Use built-in defaults
      }
      this.detectors.set(sessionId, detector);
    }
    return this.detectors.has(sessionId) ? this.detectors.get(sessionId) : null;
  }

  /**
   * Handle: detect_technologies command
   * Analyzes page and identifies all technologies
   */
  async handleDetectTechnologies(params, pageData, sessionId) {
    try {
      const detector = await this.getDetector(sessionId);
      if (!detector) throw new Error('Detector not initialized');

      const result = await detector.detectTechnologies(
        pageData,
        params.networkRequests || [],
        params.headers || {}
      );

      return {
        success: true,
        technologies: result.technologies,
        summary: {
          total: result.technologies.length,
          byCategory: this.groupByCategory(result.technologies),
          averageConfidence: this.calculateAverageConfidence(result.technologies)
        },
        detectionTime: result.detectionTime,
        timestamp: result.timestamp
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Handle: get_tech_cache command
   * Returns cached detection results
   */
  async handleGetTechCache(params, pageData, sessionId) {
    try {
      const detector = await this.getDetector(sessionId);
      if (!detector) throw new Error('Detector not initialized');

      const cacheKey = params.cacheKey;
      if (!cacheKey) throw new Error('Cache key required');

      const cached = detector.getCachedResults(cacheKey);
      if (!cached) {
        return {
          success: false,
          cached: false,
          message: 'Cache miss'
        };
      }

      return {
        success: true,
        cached: true,
        data: cached.data,
        age: Date.now() - cached.timestamp
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle: tech_detection_status command
   * Returns detection progress/status
   */
  async handleTechDetectionStatus(params, pageData, sessionId) {
    try {
      const detector = await this.getDetector(sessionId);
      if (!detector) throw new Error('Detector not initialized');

      return {
        success: true,
        status: 'ready',
        signaturesLoaded: Object.keys(detector.signatures).length,
        cacheSize: detector.detectionCache.size,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle: clear_tech_cache command
   * Clears detection cache
   */
  async handleClearTechCache(params, sessionId) {
    try {
      const detector = await this.getDetector(sessionId);
      if (!detector) throw new Error('Detector not initialized');

      detector.clearCache();

      return {
        success: true,
        message: 'Cache cleared',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Register handlers with WebSocket server
   */
  registerHandlers(wsServer) {
    wsServer.on('command:detect_technologies', async (params, pageData, sessionId) => {
      return this.handleDetectTechnologies(params, pageData, sessionId);
    });

    wsServer.on('command:get_tech_cache', async (params, pageData, sessionId) => {
      return this.handleGetTechCache(params, pageData, sessionId);
    });

    wsServer.on('command:tech_detection_status', async (params, pageData, sessionId) => {
      return this.handleTechDetectionStatus(params, pageData, sessionId);
    });

    wsServer.on('command:clear_tech_cache', async (params, sessionId) => {
      return this.handleClearTechCache(params, sessionId);
    });
  }

  /**
   * Helper: Group technologies by category
   */
  groupByCategory(technologies) {
    const grouped = {};
    for (const tech of technologies) {
      const cat = tech.category || 'Unknown';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(tech);
    }
    return grouped;
  }

  /**
   * Helper: Calculate average confidence
   */
  calculateAverageConfidence(technologies) {
    if (technologies.length === 0) return 0;
    const sum = technologies.reduce((acc, t) => acc + t.confidence, 0);
    return Math.round(sum / technologies.length);
  }

  /**
   * Cleanup: Remove detector for session
   */
  removeDetector(sessionId) {
    this.detectors.delete(sessionId);
  }
}

module.exports = TechDetectionHandler;
