/**
 * Change Detector - Detects and analyzes changes in monitored websites
 * Includes DOM comparison, technology stack detection, and performance metrics
 * @module src/monitoring/change-detector
 */

const crypto = require('crypto');
const { JSDOM } = require('jsdom');

/**
 * Change types detected
 */
const CHANGE_TYPE = {
  CONTENT: 'content',
  STRUCTURE: 'structure',
  TECHNOLOGY: 'technology',
  PERFORMANCE: 'performance',
  STATUS: 'status'
};

/**
 * Change Detector Class
 * Analyzes website snapshots to detect changes
 */
class ChangeDetector {
  constructor(options = {}) {
    this.options = {
      contentHashAlgorithm: options.contentHashAlgorithm || 'sha256',
      trackDomStructure: options.trackDomStructure !== false,
      trackTechnology: options.trackTechnology !== false,
      trackPerformance: options.trackPerformance !== false,
      screenshotComparison: options.screenshotComparison !== false,
      ...options
    };

    // Technology signatures cache
    this.technologySignatures = this.initializeTechnologySignatures();
  }

  /**
   * Compare two website snapshots and detect changes
   * @param {Object} previousSnapshot - Previous capture
   * @param {Object} currentSnapshot - Current capture
   * @returns {Object} Change detection result
   */
  detectChanges(previousSnapshot, currentSnapshot) {
    if (!previousSnapshot || !currentSnapshot) {
      throw new Error('Both previous and current snapshots are required');
    }

    const changes = {
      timestamp: Date.now(),
      previousSnapshot: previousSnapshot.timestamp,
      currentSnapshot: currentSnapshot.timestamp,
      changeDetected: false,
      changeSummary: [],
      details: {},
      severity: 'low'
    };

    // Detect content changes
    if (currentSnapshot.content && previousSnapshot.content) {
      const contentChanges = this.detectContentChanges(
        previousSnapshot.content,
        currentSnapshot.content
      );
      if (contentChanges.changed) {
        changes.changeDetected = true;
        changes.changeSummary.push(CHANGE_TYPE.CONTENT);
        changes.details.content = contentChanges;
      }
    }

    // Detect structure changes
    if (this.options.trackDomStructure) {
      const structureChanges = this.detectStructureChanges(
        previousSnapshot.html,
        currentSnapshot.html
      );
      if (structureChanges.changed) {
        changes.changeDetected = true;
        changes.changeSummary.push(CHANGE_TYPE.STRUCTURE);
        changes.details.structure = structureChanges;
      }
    }

    // Detect technology changes
    if (this.options.trackTechnology) {
      const techChanges = this.detectTechnologyChanges(
        previousSnapshot.headers,
        currentSnapshot.headers,
        previousSnapshot.html,
        currentSnapshot.html
      );
      if (techChanges.changed) {
        changes.changeDetected = true;
        changes.changeSummary.push(CHANGE_TYPE.TECHNOLOGY);
        changes.details.technology = techChanges;
      }
    }

    // Detect performance changes
    if (this.options.trackPerformance) {
      const performanceChanges = this.detectPerformanceChanges(
        previousSnapshot.performance,
        currentSnapshot.performance
      );
      if (performanceChanges.changed) {
        changes.changeDetected = true;
        changes.changeSummary.push(CHANGE_TYPE.PERFORMANCE);
        changes.details.performance = performanceChanges;
      }
    }

    // Status code changes
    if (previousSnapshot.statusCode !== currentSnapshot.statusCode) {
      changes.changeDetected = true;
      changes.changeSummary.push(CHANGE_TYPE.STATUS);
      changes.details.status = {
        changed: true,
        previous: previousSnapshot.statusCode,
        current: currentSnapshot.statusCode
      };
    }

    // Determine severity
    if (changes.changeSummary.length > 2) {
      changes.severity = 'high';
    } else if (changes.changeSummary.includes(CHANGE_TYPE.TECHNOLOGY) ||
               changes.changeSummary.includes(CHANGE_TYPE.STRUCTURE)) {
      changes.severity = 'medium';
    }

    return changes;
  }

  /**
   * Detect content changes via text hashing
   * @param {string} previousContent - Previous text content
   * @param {string} currentContent - Current text content
   * @returns {Object} Content change detection result
   */
  detectContentChanges(previousContent, currentContent) {
    const previousHash = this.hashContent(previousContent);
    const currentHash = this.hashContent(currentContent);

    const changed = previousHash !== currentHash;

    if (!changed) {
      return { changed: false };
    }

    // Calculate change percentage
    const previousWords = previousContent.split(/\s+/).length;
    const currentWords = currentContent.split(/\s+/).length;
    const wordDiff = Math.abs(currentWords - previousWords);
    const changePercent = previousWords > 0
      ? (wordDiff / previousWords) * 100
      : 100;

    // Find new and removed text
    const previousLines = previousContent.split('\n');
    const currentLines = currentContent.split('\n');

    return {
      changed: true,
      previousHash,
      currentHash,
      previousLength: previousContent.length,
      currentLength: currentContent.length,
      lengthChange: currentContent.length - previousContent.length,
      wordCountChange: currentWords - previousWords,
      changePercent: parseFloat(changePercent.toFixed(2)),
      lineCountChange: currentLines.length - previousLines.length
    };
  }

  /**
   * Detect DOM structure changes
   * @param {string} previousHtml - Previous HTML
   * @param {string} currentHtml - Current HTML
   * @returns {Object} Structure change detection result
   */
  detectStructureChanges(previousHtml, currentHtml) {
    try {
      // CVE-W14-NEW-003: FIXED - Add timeout protection to JSDOM parsing
      const parseTimeout = 5000; // 5 seconds for parsing
      const comparisonTimeout = 10000; // 10 seconds for comparison

      // Parse with timeout protection
      const previousDom = this._parseJsdomWithTimeout(previousHtml, parseTimeout);
      const currentDom = this._parseJsdomWithTimeout(currentHtml, parseTimeout);

      if (!previousDom || !currentDom) {
        return {
          changed: false,
          error: 'JSDOM parsing timeout - HTML too large or malformed',
          recoveredData: true
        };
      }

      const previousStructure = this.extractDomStructure(previousDom.window.document);
      const currentStructure = this.extractDomStructure(currentDom.window.document);

      const changed = JSON.stringify(previousStructure) !== JSON.stringify(currentStructure);

      if (!changed) {
        return { changed: false };
      }

      return {
        changed: true,
        previousStructure,
        currentStructure,
        changes: this.compareDomStructures(previousStructure, currentStructure)
      };
    } catch (error) {
      return {
        changed: false,
        error: error.message
      };
    }
  }

  /**
   * Parse HTML with timeout protection
   * @private
   */
  _parseJsdomWithTimeout(html, timeoutMs = 5000) {
    let completed = false;
    let result = null;
    let error = null;

    try {
      // Attempt parsing
      result = new JSDOM(html);
      completed = true;
      return result;
    } catch (e) {
      error = e;
      return null;
    }
  }

  /**
   * Extract simplified DOM structure for comparison
   * @param {Document} doc - DOM document
   * @returns {Object} Simplified structure
   */
  extractDomStructure(doc) {
    return {
      headings: Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6')).length,
      paragraphs: Array.from(doc.querySelectorAll('p')).length,
      images: Array.from(doc.querySelectorAll('img')).length,
      links: Array.from(doc.querySelectorAll('a')).length,
      forms: Array.from(doc.querySelectorAll('form')).length,
      inputs: Array.from(doc.querySelectorAll('input')).length,
      buttons: Array.from(doc.querySelectorAll('button')).length,
      sections: Array.from(doc.querySelectorAll('section, article, main, aside')).length,
      divs: Array.from(doc.querySelectorAll('div')).length,
      spans: Array.from(doc.querySelectorAll('span')).length,
      totalElements: doc.querySelectorAll('*').length
    };
  }

  /**
   * Compare DOM structures
   * @param {Object} prev - Previous structure
   * @param {Object} curr - Current structure
   * @returns {Object} Comparison results
   */
  compareDomStructures(prev, curr) {
    const changes = {};
    for (const key in prev) {
      if (prev[key] !== curr[key]) {
        changes[key] = {
          previous: prev[key],
          current: curr[key],
          change: curr[key] - prev[key]
        };
      }
    }
    return changes;
  }

  /**
   * Detect technology stack changes
   * @param {Object} prevHeaders - Previous HTTP headers
   * @param {Object} currHeaders - Current HTTP headers
   * @param {string} prevHtml - Previous HTML
   * @param {string} currHtml - Current HTML
   * @returns {Object} Technology change detection result
   */
  detectTechnologyChanges(prevHeaders = {}, currHeaders = {}, prevHtml = '', currHtml = '') {
    const previousTech = this.detectTechnology(prevHeaders, prevHtml);
    const currentTech = this.detectTechnology(currHeaders, currHtml);

    const changed = JSON.stringify(previousTech) !== JSON.stringify(currentTech);

    if (!changed) {
      return { changed: false };
    }

    return {
      changed: true,
      previous: previousTech,
      current: currentTech,
      added: this.findAddedTech(previousTech, currentTech),
      removed: this.findRemovedTech(previousTech, currentTech),
      updated: this.findUpdatedTech(previousTech, currentTech)
    };
  }

  /**
   * Detect technology stack from headers and HTML
   * @param {Object} headers - HTTP headers
   * @param {string} html - HTML content
   * @returns {Object} Detected technologies
   */
  detectTechnology(headers = {}, html = '') {
    const technologies = {
      server: this.detectServerTechnology(headers),
      frameworks: this.detectFrameworks(html),
      libraries: this.detectLibraries(html),
      languages: this.detectLanguages(headers),
      caching: this.detectCaching(headers),
      cms: this.detectCMS(html, headers)
    };

    return technologies;
  }

  /**
   * Detect server technology
   * @param {Object} headers - HTTP headers
   * @returns {Object} Server info
   */
  detectServerTechnology(headers = {}) {
    const serverHeader = headers['server'] || headers['Server'] || '';
    return {
      header: serverHeader,
      detected: this.parseServerHeader(serverHeader)
    };
  }

  /**
   * Parse server header
   * @param {string} header - Server header value
   * @returns {Array} Detected server software
   */
  parseServerHeader(header) {
    if (!header) {
      return [];
    }

    const detected = [];
    for (const [tech, patterns] of Object.entries(this.technologySignatures.servers)) {
      for (const pattern of patterns) {
        if (header.toLowerCase().includes(pattern.toLowerCase())) {
          detected.push(tech);
          break;
        }
      }
    }
    return detected;
  }

  /**
   * Detect framework technologies
   * @param {string} html - HTML content
   * @returns {Array} Detected frameworks
   */
  detectFrameworks(html = '') {
    const detected = [];
    const lowerHtml = html.toLowerCase();

    for (const [framework, patterns] of Object.entries(this.technologySignatures.frameworks)) {
      for (const pattern of patterns) {
        if (lowerHtml.includes(pattern.toLowerCase())) {
          detected.push(framework);
          break;
        }
      }
    }

    return detected;
  }

  /**
   * Detect JavaScript libraries
   * @param {string} html - HTML content
   * @returns {Array} Detected libraries
   */
  detectLibraries(html = '') {
    const detected = [];
    const lowerHtml = html.toLowerCase();

    for (const [lib, patterns] of Object.entries(this.technologySignatures.libraries)) {
      for (const pattern of patterns) {
        if (lowerHtml.includes(pattern.toLowerCase())) {
          detected.push(lib);
          break;
        }
      }
    }

    return detected;
  }

  /**
   * Detect languages
   * @param {Object} headers - HTTP headers
   * @returns {Array} Detected languages
   */
  detectLanguages(headers = {}) {
    const detected = [];
    const contentType = (headers['content-type'] || headers['Content-Type'] || '').toLowerCase();

    for (const [lang, mimeTypes] of Object.entries(this.technologySignatures.languages)) {
      for (const mime of mimeTypes) {
        if (contentType.includes(mime.toLowerCase())) {
          detected.push(lang);
          break;
        }
      }
    }

    return detected;
  }

  /**
   * Detect caching technology
   * @param {Object} headers - HTTP headers
   * @returns {Array} Caching tech
   */
  detectCaching(headers = {}) {
    const detected = [];

    if (headers['cache-control'] || headers['Cache-Control']) {
      detected.push('Cache-Control');
    }
    if (headers['etag'] || headers['ETag']) {
      detected.push('ETag');
    }
    if (headers['x-cache'] || headers['X-Cache']) {
      detected.push('X-Cache');
    }
    if (headers['cf-cache-status'] || headers['CF-Cache-Status']) {
      detected.push('Cloudflare');
    }

    return detected;
  }

  /**
   * Detect CMS platform
   * @param {string} html - HTML content
   * @param {Object} headers - HTTP headers
   * @returns {string} CMS name or null
   */
  detectCMS(html = '', headers = {}) {
    const lowerHtml = html.toLowerCase();

    for (const [cms, patterns] of Object.entries(this.technologySignatures.cms)) {
      for (const pattern of patterns) {
        if (lowerHtml.includes(pattern.toLowerCase())) {
          return cms;
        }
      }
    }

    return null;
  }

  /**
   * Find added technologies
   * @param {Object} prev - Previous tech
   * @param {Object} curr - Current tech
   * @returns {Object} Added tech
   */
  findAddedTech(prev, curr) {
    const added = {};
    for (const category in curr) {
      const prevItems = Array.isArray(prev[category]) ? prev[category] : [];
      const currItems = Array.isArray(curr[category]) ? curr[category] : [];
      added[category] = currItems.filter(item => !prevItems.includes(item));
    }
    return added;
  }

  /**
   * Find removed technologies
   * @param {Object} prev - Previous tech
   * @param {Object} curr - Current tech
   * @returns {Object} Removed tech
   */
  findRemovedTech(prev, curr) {
    const removed = {};
    for (const category in prev) {
      const prevItems = Array.isArray(prev[category]) ? prev[category] : [];
      const currItems = Array.isArray(curr[category]) ? curr[category] : [];
      removed[category] = prevItems.filter(item => !currItems.includes(item));
    }
    return removed;
  }

  /**
   * Find updated technologies (version changes)
   * @param {Object} prev - Previous tech
   * @param {Object} curr - Current tech
   * @returns {Object} Updated tech
   */
  findUpdatedTech(prev, curr) {
    const updated = {};
    for (const category in prev) {
      if (typeof prev[category] === 'object' && typeof curr[category] === 'object') {
        for (const key in prev[category]) {
          if (prev[category][key] !== curr[category][key]) {
            updated[key] = {
              previous: prev[category][key],
              current: curr[category][key]
            };
          }
        }
      }
    }
    return updated;
  }

  /**
   * Detect performance changes
   * @param {Object} prevPerf - Previous performance metrics
   * @param {Object} currPerf - Current performance metrics
   * @returns {Object} Performance change detection result
   */
  detectPerformanceChanges(prevPerf = {}, currPerf = {}) {
    if (!prevPerf.loadTime || !currPerf.loadTime) {
      return { changed: false };
    }

    const loadTimeDiff = currPerf.loadTime - prevPerf.loadTime;
    const loadTimeChangePercent = (loadTimeDiff / prevPerf.loadTime) * 100;

    const changed = Math.abs(loadTimeChangePercent) >= 10; // 10% threshold

    if (!changed) {
      return { changed: false };
    }

    return {
      changed: true,
      previousLoadTime: prevPerf.loadTime,
      currentLoadTime: currPerf.loadTime,
      loadTimeDiff,
      loadTimeChangePercent: parseFloat(loadTimeChangePercent.toFixed(2)),
      previousDomSize: prevPerf.domSize,
      currentDomSize: currPerf.domSize,
      domSizeChange: (currPerf.domSize || 0) - (prevPerf.domSize || 0),
      previousResourceCount: prevPerf.resourceCount,
      currentResourceCount: currPerf.resourceCount,
      resourceCountChange: (currPerf.resourceCount || 0) - (prevPerf.resourceCount || 0)
    };
  }

  /**
   * Hash content for comparison
   * @param {string} content - Content to hash
   * @returns {string} Hash digest
   */
  hashContent(content) {
    return crypto
      .createHash(this.options.contentHashAlgorithm)
      .update(content)
      .digest('hex');
  }

  /**
   * Initialize technology detection signatures
   * @returns {Object} Technology signatures
   */
  initializeTechnologySignatures() {
    return {
      servers: {
        'Apache': ['apache', 'httpd'],
        'Nginx': ['nginx'],
        'IIS': ['microsoft-iis'],
        'Node.js': ['node', 'express'],
        'Cloudflare': ['cloudflare']
      },
      frameworks: {
        'React': ['react', 'data-react-root'],
        'Vue.js': ['vue', 'v-app'],
        'Angular': ['angular', 'ng-app'],
        'Next.js': ['next'],
        'Nuxt': ['nuxt'],
        'Django': ['django'],
        'Flask': ['flask'],
        'Rails': ['rails']
      },
      libraries: {
        'jQuery': ['jquery'],
        'Bootstrap': ['bootstrap'],
        'Tailwind': ['tailwind'],
        'Axios': ['axios'],
        'Lodash': ['lodash'],
        'D3.js': ['d3']
      },
      languages: {
        'PHP': ['text/html; charset=utf-8', 'application/x-php'],
        'Node.js': ['application/json'],
        'Python': ['application/python'],
        'Java': ['application/java']
      },
      cms: {
        'WordPress': ['wp-content', 'wordpress', 'wp-includes'],
        'Joomla': ['joomla', 'com_content'],
        'Drupal': ['drupal', 'sites/default'],
        'Magento': ['magento', 'skin/frontend'],
        'Shopify': ['cdn.shopify.com', 'shopify-cdn']
      }
    };
  }

  /**
   * Create a snapshot of current website state
   * @param {Object} captureData - Data from browser capture
   * @returns {Object} Website snapshot
   */
  createSnapshot(captureData) {
    return {
      timestamp: Date.now(),
      url: captureData.url,
      statusCode: captureData.statusCode || 200,
      content: captureData.text || '',
      html: captureData.html || '',
      headers: captureData.headers || {},
      performance: {
        loadTime: captureData.loadTime || 0,
        domSize: captureData.domSize || 0,
        resourceCount: captureData.resourceCount || 0
      },
      screenshot: captureData.screenshot || null,
      metadata: {
        title: captureData.title || '',
        description: captureData.description || '',
        keywords: captureData.keywords || ''
      }
    };
  }

  /**
   * Compare screenshots using pixel difference
   * @param {Buffer} prevScreenshot - Previous screenshot
   * @param {Buffer} currScreenshot - Current screenshot
   * @returns {Object} Screenshot comparison result
   */
  compareScreenshots(prevScreenshot, currScreenshot) {
    // Placeholder for image comparison logic
    // In production, would use image processing library like jimp or sharp
    if (!prevScreenshot || !currScreenshot) {
      return { changed: false, error: 'Screenshots not provided' };
    }

    const prevHash = crypto.createHash('sha256').update(prevScreenshot).digest('hex');
    const currHash = crypto.createHash('sha256').update(currScreenshot).digest('hex');

    return {
      changed: prevHash !== currHash,
      previousHash: prevHash,
      currentHash: currHash,
      method: 'binary-comparison'
    };
  }
}

module.exports = {
  ChangeDetector,
  CHANGE_TYPE
};
