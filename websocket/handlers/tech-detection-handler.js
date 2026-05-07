/**
 * WebSocket Handler - Technology Detection Module
 * Provides advanced technology stack detection capabilities
 *
 * Version: 1.0.0
 * Created: May 7, 2026
 */

const TechDetector = require('../../src/analysis/tech-detector');

class TechDetectionHandler {
  constructor() {
    this.detector = new TechDetector();
    this.detectionHistory = [];
  }

  /**
   * Handle WebSocket commands for technology detection
   */
  async handleCommand(command, params) {
    const startTime = Date.now();

    try {
      let result;

      switch (command) {
        case 'detect_technologies':
          result = await this.detectTechnologies(params);
          break;

        case 'detect_batch':
          result = await this.detectBatch(params);
          break;

        case 'get_detection_cache':
          result = this.getDetectionCache();
          break;

        case 'get_cached_result':
          result = this.getCachedResult(params);
          break;

        case 'clear_cache':
          result = this.clearCache();
          break;

        case 'clear_cache_entry':
          result = this.clearCacheEntry(params);
          break;

        case 'get_detection_history':
          result = this.getDetectionHistory(params);
          break;

        case 'get_tech_stats':
          result = this.getTechStats(params);
          break;

        case 'filter_detections':
          result = this.filterDetections(params);
          break;

        case 'get_detector_status':
          result = this.getDetectorStatus();
          break;

        case 'load_signatures':
          result = await this.loadSignatures(params);
          break;

        default:
          return {
            success: false,
            error: `Unknown command: ${command}`,
            command,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime
          };
      }

      return {
        success: true,
        command,
        result,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        command,
        error: error.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Detect technologies in page data
   */
  async detectTechnologies(params = {}) {
    const { pageData, networkRequests = [], headers = {} } = params;

    if (!pageData) {
      throw new Error('pageData is required');
    }

    // Ensure pageData has required structure
    const normalizedPageData = {
      html: pageData.html || '',
      scripts: pageData.scripts || [],
      resources: pageData.resources || [],
      favicon: pageData.favicon || null,
      dom: pageData.dom || null,
      canvasFingerprint: pageData.canvasFingerprint || null,
      sslCertificate: pageData.sslCertificate || null,
      tlsDetails: pageData.tlsDetails || {}
    };

    const result = await this.detector.detectTechnologies(normalizedPageData, networkRequests, headers);

    // Store in history
    this.detectionHistory.push({
      timestamp: Date.now(),
      pageUrl: pageData.url || 'unknown',
      technologiesFound: result.technologies.length,
      detectionTime: result.detectionTime,
      result
    });

    return {
      technologiesDetected: result.technologies.length,
      detectionTime: result.detectionTime,
      timestamp: result.timestamp,
      technologies: result.technologies.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        confidence: t.confidence,
        version: t.version || null,
        detectionMethods: t.detectionMethods || [],
        evidence: t.evidence || {}
      }))
    };
  }

  /**
   * Detect technologies in multiple pages (batch)
   */
  async detectBatch(params = {}) {
    const { pages = [] } = params;

    if (!Array.isArray(pages) || pages.length === 0) {
      throw new Error('pages array is required with at least one page');
    }

    const results = [];
    let totalTime = 0;

    for (const pageData of pages) {
      const result = await this.detectTechnologies({ pageData });
      results.push({
        pageUrl: pageData.url || 'unknown',
        technologiesDetected: result.technologiesDetected,
        detectionTime: result.detectionTime,
        technologies: result.technologies
      });
      totalTime += result.detectionTime;
    }

    return {
      pagesProcessed: results.length,
      totalTechnologies: results.reduce((sum, r) => sum + r.technologiesDetected, 0),
      averageDetectionTime: Math.round(totalTime / results.length),
      totalTime,
      results
    };
  }

  /**
   * Get detection cache info
   */
  getDetectionCache() {
    return {
      cacheSize: this.detector.detectionCache.size,
      cacheEntries: Array.from(this.detector.detectionCache.keys()).map(key => ({
        key: key.substring(0, 16) + '...',
        cached: true
      })),
      cacheTimeout: '1 hour',
      totalCacheSize: this.detector.detectionCache.size
    };
  }

  /**
   * Get cached result by key
   */
  getCachedResult(params = {}) {
    const { cacheKey } = params;

    if (!cacheKey) {
      throw new Error('cacheKey is required');
    }

    const cached = this.detector.getCachedResults(cacheKey);

    if (!cached) {
      return {
        found: false,
        message: 'Cache entry not found',
        cacheKey
      };
    }

    return {
      found: true,
      cachedAt: new Date(cached.timestamp).toISOString(),
      data: cached.data
    };
  }

  /**
   * Clear entire detection cache
   */
  clearCache() {
    this.detector.clearCache();

    return {
      message: 'Detection cache cleared',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear specific cache entry
   */
  clearCacheEntry(params = {}) {
    const { cacheKey } = params;

    if (!cacheKey) {
      throw new Error('cacheKey is required');
    }

    this.detector.detectionCache.delete(cacheKey);

    return {
      message: 'Cache entry removed',
      cacheKey,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get detection history
   */
  getDetectionHistory(params = {}) {
    const { limit = 20, filter = {} } = params;

    let history = this.detectionHistory.slice(-limit);

    if (filter.minConfidence) {
      history = history.filter(h =>
        h.result.technologies.some(t => t.confidence >= filter.minConfidence)
      );
    }

    return {
      count: history.length,
      limit,
      history: history.map(h => ({
        timestamp: new Date(h.timestamp).toISOString(),
        pageUrl: h.pageUrl,
        technologiesFound: h.technologiesFound,
        detectionTime: h.detectionTime,
        topTechnologies: h.result.technologies.slice(0, 5).map(t => t.name)
      }))
    };
  }

  /**
   * Get technology statistics
   */
  getTechStats(params = {}) {
    const { category = null } = params;

    const allTechs = [];
    for (const history of this.detectionHistory) {
      allTechs.push(...history.result.technologies);
    }

    let filtered = allTechs;
    if (category) {
      filtered = filtered.filter(t => t.category === category);
    }

    const stats = {};
    for (const tech of filtered) {
      if (!stats[tech.name]) {
        stats[tech.name] = {
          name: tech.name,
          category: tech.category,
          count: 0,
          totalConfidence: 0,
          avgConfidence: 0
        };
      }
      stats[tech.name].count++;
      stats[tech.name].totalConfidence += tech.confidence;
    }

    // Calculate averages
    for (const name in stats) {
      stats[name].avgConfidence = Math.round(stats[name].totalConfidence / stats[name].count);
    }

    // Sort by count
    const sorted = Object.values(stats).sort((a, b) => b.count - a.count);

    return {
      category: category || 'all',
      totalDetections: allTechs.length,
      uniqueTechnologies: sorted.length,
      topTechnologies: sorted.slice(0, 10)
    };
  }

  /**
   * Filter detections
   */
  filterDetections(params = {}) {
    const { category = null, minConfidence = 0, includeVersions = true } = params;

    const allTechs = [];
    for (const history of this.detectionHistory) {
      allTechs.push(...history.result.technologies);
    }

    let filtered = allTechs;

    if (category) {
      filtered = filtered.filter(t => t.category === category);
    }

    if (minConfidence > 0) {
      filtered = filtered.filter(t => t.confidence >= minConfidence);
    }

    return {
      criteria: {
        category,
        minConfidence
      },
      count: filtered.length,
      technologies: filtered.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        confidence: t.confidence,
        version: includeVersions ? t.version : undefined
      }))
    };
  }

  /**
   * Get detector status
   */
  getDetectorStatus() {
    return {
      moduleName: 'TechDetectionHandler',
      version: '1.0.0',
      signaturesLoaded: Object.keys(this.detector.signatures).length,
      cacheSize: this.detector.detectionCache.size,
      detectionHistoryCount: this.detectionHistory.length,
      cacheTimeout: '1 hour',
      supportedCommands: [
        'detect_technologies',
        'detect_batch',
        'get_detection_cache',
        'get_cached_result',
        'clear_cache',
        'clear_cache_entry',
        'get_detection_history',
        'get_tech_stats',
        'filter_detections',
        'load_signatures'
      ]
    };
  }

  /**
   * Load external signatures (async)
   */
  async loadSignatures(params = {}) {
    const { filePath } = params;

    if (!filePath) {
      throw new Error('filePath is required');
    }

    const success = await this.detector.loadSignatures(filePath);

    if (!success) {
      throw new Error(`Failed to load signatures from ${filePath}`);
    }

    return {
      success: true,
      signaturesLoaded: Object.keys(this.detector.signatures).length,
      filePath,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = TechDetectionHandler;
