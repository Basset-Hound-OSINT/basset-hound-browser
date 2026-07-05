/**
 * Basset Hound Browser - Content Extraction Manager (slim orchestrator)
 * Orchestrates comprehensive content extraction capabilities for HTML pages
 * Delegates per-domain extraction to focused modules in this directory.
 *
 * @module extraction/manager/extraction-manager
 */

const {
  OpenGraphParser,
  TwitterCardParser,
  JsonLdParser,
  MicrodataParser,
  RdfaParser,
  BaseParser
} = require('../parsers');
const { ImageProcessor } = require('../image-processor');
const { FormDetector } = require('../form-detector');
const { ContentAnalyzer } = require('../content-analyzer');

// Per-domain extractor modules (pure functions taking the manager instance as `self`)
const { extractMetadata } = require('./metadata');
const { extractLinks } = require('./links');
const { extractForms } = require('./forms');
const { extractImages, parseSrcset } = require('./images');
const { extractScripts, detectScriptLibrary } = require('./scripts');
const { extractStylesheets, detectCssFramework } = require('./stylesheets');
const { extractStructuredData } = require('./structured-data');

/**
 * ExtractionManager class
 * Central orchestrator for all content extraction operations
 * Delegates specialized extraction to focused processor modules:
 * - ImageProcessor: Image extraction and analysis
 * - FormDetector: Form detection and field extraction
 * - ContentAnalyzer: Content analysis and link extraction
 * - Metadata Parsers: OG, Twitter Card, JSON-LD, Microdata, RDFa
 * - Per-domain extractors (this directory): metadata, links, forms, images,
 *   scripts, stylesheets, structured-data
 *
 * @class ExtractionManager
 * @extends BaseParser
 */
class ExtractionManager extends BaseParser {
  constructor() {
    super();

    // Initialize specialized processors
    this.imageProcessor = new ImageProcessor();
    this.formDetector = new FormDetector();
    this.contentAnalyzer = new ContentAnalyzer();

    // Initialize specialized parsers for metadata
    this.openGraphParser = new OpenGraphParser();
    this.twitterCardParser = new TwitterCardParser();
    this.jsonLdParser = new JsonLdParser();
    this.microdataParser = new MicrodataParser();
    this.rdfaParser = new RdfaParser();

    // DOM timing configuration
    this.domWaitConfig = {
      defaultWaitTime: 2000, // Default 2 seconds wait before extraction
      minWaitTime: 500, // Minimum 500ms
      maxWaitTime: 10000, // Maximum 10 seconds
      retryAttempts: 3, // Retry extraction up to 3 times
      retryDelay: 1000 // 1 second between retries
    };

    // Statistics
    this.stats = {
      totalExtractions: 0,
      metadataExtractions: 0,
      linkExtractions: 0,
      formExtractions: 0,
      imageExtractions: 0,
      scriptExtractions: 0,
      stylesheetExtractions: 0,
      structuredDataExtractions: 0,
      retriesPerformed: 0,
      incompleteDOMDetections: 0
    };
  }

  /**
   * Configure DOM wait timing
   * @param {Object} config - Configuration object
   * @returns {Object} Updated configuration
   */
  configureDomWait(config = {}) {
    const {
      defaultWaitTime = this.domWaitConfig.defaultWaitTime,
      minWaitTime = this.domWaitConfig.minWaitTime,
      maxWaitTime = this.domWaitConfig.maxWaitTime,
      retryAttempts = this.domWaitConfig.retryAttempts,
      retryDelay = this.domWaitConfig.retryDelay
    } = config;

    // Validate values
    if (typeof defaultWaitTime !== 'number' || defaultWaitTime < minWaitTime || defaultWaitTime > maxWaitTime) {
      return { success: false, error: 'defaultWaitTime must be between minWaitTime and maxWaitTime' };
    }

    this.domWaitConfig = {
      defaultWaitTime,
      minWaitTime,
      maxWaitTime,
      retryAttempts: Math.max(1, Math.floor(retryAttempts)),
      retryDelay: Math.max(100, Math.floor(retryDelay))
    };

    console.log('[ExtractionManager] DOM wait configuration updated:', this.domWaitConfig);

    return { success: true, config: this.domWaitConfig };
  }

  /**
   * Detect if DOM is likely incomplete
   * Looks for indicators that page is still loading
   * @param {string} html - HTML content
   * @returns {Object} Detection result with confidence
   */
  detectIncompleteDom(html) {
    if (!html || typeof html !== 'string') {
      return { incomplete: false, confidence: 0, indicators: [] };
    }

    const indicators = [];
    let incompletenessScore = 0;

    // Check for loading placeholders
    if (html.includes('class="loading"') || html.includes('class="skeleton"') ||
        html.includes('class="spinner"') || html.includes('aria-busy="true"')) {
      indicators.push('loading_placeholders_detected');
      incompletenessScore += 40;
    }

    // Check for empty main content areas
    const mainMatches = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatches && mainMatches[1].trim().length < 100) {
      indicators.push('main_content_minimal');
      incompletenessScore += 40;
    }

    // Check for pending scripts (defer/async suggests late loading)
    if (html.includes('defer')) {
      indicators.push('deferred_scripts_present');
      incompletenessScore += 45;
    }

    // Check readyState indicators
    if (html.includes('document.readyState') || html.includes('DOMContentLoaded')) {
      indicators.push('dynamic_content_detected');
      incompletenessScore += 50;
    }

    // Check for service workers or lazy loading
    if (html.includes('data-src') || html.includes('data-lazy') || html.includes('IntersectionObserver')) {
      indicators.push('lazy_loading_detected');
      incompletenessScore += 50;
    }

    const isIncomplete = incompletenessScore >= 40;
    const confidence = Math.min(100, incompletenessScore);

    return {
      incomplete: isIncomplete,
      confidence,
      score: incompletenessScore,
      indicators
    };
  }

  /**
   * Resolve a relative URL to an absolute URL
   * @param {string} url - URL to resolve (may be relative)
   * @param {string} baseUrl - Base URL for resolution
   * @returns {string} Resolved absolute URL
   */
  resolveUrl(url, baseUrl) {
    if (!url || typeof url !== 'string') {
      return '';
    }

    // Already absolute
    if (url.match(/^https?:\/\//i) || url.match(/^\/\//)) {
      if (url.startsWith('//')) {
        const baseProtocol = baseUrl ? baseUrl.split(':')[0] : 'https';
        return `${baseProtocol}:${url}`;
      }
      return url;
    }

    // Data URL or javascript
    if (url.match(/^(data:|javascript:|mailto:|tel:|#)/i)) {
      return url;
    }

    if (!baseUrl) {
      return url;
    }

    try {
      const base = new URL(baseUrl);

      if (url.startsWith('/')) {
        return `${base.protocol}//${base.host}${url}`;
      }

      // Relative path
      const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
      return `${base.protocol}//${base.host}${basePath}${url}`;
    } catch (e) {
      return url;
    }
  }

  /**
   * Extract hostname from URL
   * @param {string} url - URL to parse
   * @returns {string} Hostname or empty string
   */
  getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return '';
    }
  }

  // ==========================================
  // Metadata Extraction (delegated → ./metadata)
  // ==========================================

  /**
   * Extract all metadata from HTML
   * @param {string} html - HTML content
   * @param {string} url - Page URL (for context)
   * @returns {Object} Extracted metadata
   */
  extractMetadata(html, url = '') {
    return extractMetadata(html, url, this);
  }

  // ==========================================
  // Link Extraction (delegated → ./links)
  // ==========================================

  /**
   * Extract all links from HTML with categorization
   * @param {string} html - HTML content
   * @param {string} baseUrl - Base URL for relative link resolution
   * @returns {Object} Extracted and categorized links
   */
  extractLinks(html, baseUrl = '') {
    return extractLinks(html, baseUrl, this);
  }

  // ==========================================
  // Form Extraction (delegated → ./forms)
  // ==========================================

  /**
   * Extract all forms and their fields from HTML
   * @param {string} html - HTML content
   * @returns {Object} Extracted form data
   */
  extractForms(html) {
    return extractForms(html, this);
  }

  // ==========================================
  // Image Extraction (delegated → ./images)
  // ==========================================

  /**
   * Extract all images from HTML
   * @param {string} html - HTML content
   * @param {string} baseUrl - Base URL for relative image resolution
   * @returns {Object} Extracted image data
   */
  extractImages(html, baseUrl = '') {
    return extractImages(html, baseUrl, this);
  }

  /**
   * Parse srcset attribute into structured data
   * @param {string} srcset - srcset attribute value
   * @param {string} baseUrl - Base URL for resolution
   * @returns {Array} Parsed srcset entries
   */
  parseSrcset(srcset, baseUrl) {
    return parseSrcset(srcset, baseUrl, this);
  }

  // ==========================================
  // Script Extraction (delegated → ./scripts)
  // ==========================================

  /**
   * Extract all scripts from HTML
   * @param {string} html - HTML content
   * @param {string} baseUrl - Base URL for relative script resolution
   * @returns {Object} Extracted script data
   */
  extractScripts(html, baseUrl = '') {
    return extractScripts(html, baseUrl, this);
  }

  /**
   * Detect common JavaScript libraries from script URL
   * @param {string} src - Script source URL
   * @returns {string|null} Detected library name or null
   */
  detectScriptLibrary(src) {
    return detectScriptLibrary(src);
  }

  // ==========================================
  // Stylesheet Extraction (delegated → ./stylesheets)
  // ==========================================

  /**
   * Extract all stylesheets from HTML
   * @param {string} html - HTML content
   * @param {string} baseUrl - Base URL for relative stylesheet resolution
   * @returns {Object} Extracted stylesheet data
   */
  extractStylesheets(html, baseUrl = '') {
    return extractStylesheets(html, baseUrl, this);
  }

  /**
   * Detect common CSS frameworks from stylesheet URL
   * @param {string} href - Stylesheet URL
   * @returns {string|null} Detected framework name or null
   */
  detectCssFramework(href) {
    return detectCssFramework(href);
  }

  // ==========================================
  // Structured Data Extraction (delegated → ./structured-data)
  // ==========================================

  /**
   * Extract all structured data from HTML
   * Includes JSON-LD, Microdata, and RDFa
   * @param {string} html - HTML content
   * @returns {Object} Extracted structured data
   */
  extractStructuredData(html) {
    return extractStructuredData(html, this);
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  /**
   * Get current extraction statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset extraction statistics
   * @returns {Object} Previous stats before reset
   */
  resetStats() {
    const previousStats = { ...this.stats };
    this.stats = {
      totalExtractions: 0,
      metadataExtractions: 0,
      linkExtractions: 0,
      formExtractions: 0,
      imageExtractions: 0,
      scriptExtractions: 0,
      stylesheetExtractions: 0,
      structuredDataExtractions: 0
    };
    return { success: true, previousStats };
  }

  /**
   * Extract all content types from HTML at once with automatic DOM wait
   * Detects incomplete DOM and retries extraction if needed
   * @param {string} html - HTML content
   * @param {string} url - Page URL
   * @param {Object} options - Extraction options
   * @returns {Object} All extracted data
   */
  /**
   * Extract all content using modular processors
   * Orchestrates specialized extraction using delegated processors and parsers
   *
   * @param {string} html - HTML content to extract from
   * @param {string} url - Page URL for context and URL resolution
   * @param {Object} options - Extraction options
   * @param {boolean} options.waitForDom - Wait for DOM completion check
   * @param {number} options.waitTime - Time to wait before extraction
   * @param {boolean} options.autoRetry - Enable automatic retry on incomplete DOM
   * @param {boolean} options.retryOnIncomplete - Retry if DOM incomplete
   * @param {string} options.baseUrl - Base URL for resolving relative URLs
   * @returns {Object} Complete extraction result with all content types
   *
   * @example
   * const extraction = manager.extractAll(html, 'https://example.com', {
   *   waitForDom: true,
   *   baseUrl: 'https://example.com'
   * });
   */
  extractAll(html, url = '', options = {}) {
    const {
      waitForDom = true,
      waitTime = this.domWaitConfig.defaultWaitTime,
      autoRetry = true,
      retryOnIncomplete = true,
      baseUrl = url
    } = options;

    // Check if DOM appears incomplete
    const domStatus = this.detectIncompleteDom(html);

    if (waitForDom && (domStatus.incomplete || domStatus.confidence > 30)) {
      this.stats.incompleteDOMDetections++;
      console.log(`[ExtractionManager] Incomplete DOM detected (confidence: ${domStatus.confidence}%, indicators: ${domStatus.indicators.join(', ')})`);
    }

    // Use delegated processors for specialized extraction
    const imageData = this.imageProcessor.processImages(html, {
      baseUrl,
      includeMetadata: true
    });

    const formData = this.formDetector.detectForms(html, {
      includeHidden: true,
      detectCSRF: true
    });

    const contentData = this.contentAnalyzer.analyzeMainContent(html);
    const linksData = this.contentAnalyzer.extractLinks(html, { baseUrl });
    const structureData = this.contentAnalyzer.analyzeStructure(html);

    const result = {
      success: true,
      url: url,
      metadata: this.extractMetadata(html, url),
      content: {
        main: contentData,
        structure: structureData,
        readability: this.contentAnalyzer.calculateReadability(contentData.text)
      },
      links: linksData,
      forms: formData,
      images: imageData,
      scripts: this.extractScripts(html, url),
      stylesheets: this.extractStylesheets(html, url),
      structuredData: this.extractStructuredData(html),
      extractedAt: new Date().toISOString(),
      processors: {
        images: this.imageProcessor.getStats(),
        forms: this.formDetector.getStats(),
        content: this.contentAnalyzer.getStats()
      },
      domStatus: {
        waitForDomEnabled: waitForDom,
        waitTimeMs: waitTime,
        incompleteDetected: domStatus.incomplete,
        incompletenessConfidence: domStatus.confidence,
        indicators: domStatus.indicators
      }
    };

    // Add retry information if applicable
    if (autoRetry && retryOnIncomplete && domStatus.incomplete) {
      result.recommendation = `Incomplete DOM detected. Consider waiting ${waitTime}ms and retrying extraction.`;
      result.retryHint = {
        waitTimeMs: waitTime,
        maxRetries: this.domWaitConfig.retryAttempts,
        retryDelayMs: this.domWaitConfig.retryDelay
      };
    }

    this.stats.totalExtractions++;
    return result;
  }

  /**
   * Extract with automatic DOM wait and retry (async version)
   * Designed to work with browser automation that provides waitForNavigation
   * @param {Function} getHtmlFunction - Async function that returns current HTML
   * @param {string} url - Page URL
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} All extracted data with retry info
   */
  async extractAllWithRetry(getHtmlFunction, url = '', options = {}) {
    const {
      waitTime = this.domWaitConfig.defaultWaitTime,
      maxRetries = this.domWaitConfig.retryAttempts,
      retryDelay = this.domWaitConfig.retryDelay
    } = options;

    let currentHtml = null;
    let lastDomStatus = null;
    let attempt = 1;
    const attempts = [];

    // Try extraction up to maxRetries times
    while (attempt <= maxRetries) {
      try {
        // Get current HTML
        currentHtml = await getHtmlFunction();

        if (!currentHtml) {
          throw new Error('Failed to retrieve HTML');
        }

        // Check DOM status
        lastDomStatus = this.detectIncompleteDom(currentHtml);
        attempts.push({
          attempt,
          timestamp: new Date().toISOString(),
          htmlLength: currentHtml.length,
          domIncomplete: lastDomStatus.incomplete,
          confidence: lastDomStatus.confidence
        });

        // If DOM is complete or last attempt, extract and return
        if (!lastDomStatus.incomplete || attempt === maxRetries) {
          this.stats.retriesPerformed += (attempt - 1);
          const result = this.extractAll(currentHtml, url, { waitForDom: false });

          result.extractionAttempts = attempts;
          result.domStatusAtExtraction = lastDomStatus;
          result.finalAttempt = attempt;

          if (attempt > 1) {
            result.note = `Extraction succeeded on attempt ${attempt} after waiting for DOM`;
          }

          return result;
        }

        // Wait before retry
        console.log(`[ExtractionManager] DOM incomplete (confidence: ${lastDomStatus.confidence}%), retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        attempt++;

      } catch (error) {
        attempts.push({
          attempt,
          timestamp: new Date().toISOString(),
          error: error.message
        });

        if (attempt < maxRetries) {
          console.warn(`[ExtractionManager] Extraction attempt ${attempt} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          attempt++;
        } else {
          return {
            success: false,
            error: error.message,
            attempts,
            failurePoint: 'extraction_failed_all_retries'
          };
        }
      }
    }

    // Fallback (should not reach here)
    return {
      success: false,
      error: 'Extraction failed after all retry attempts',
      attempts
    };
  }
}

module.exports = { ExtractionManager };
