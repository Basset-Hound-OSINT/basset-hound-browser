/**
 * Basset Hound Browser - Advanced Raw HTML Capture Manager
 * Provides 4 specialized HTML extraction commands:
 * 1. export_html_with_metadata - HTML + all meta tags, timing, resources
 * 2. export_html_formatted - Pretty-printed HTML with comments
 * 3. export_html_raw - Exact raw response bytes
 * 4. export_html_diff - HTML snapshot with change tracking
 */

const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class HtmlCaptureManager {
  constructor() {
    this.snapshots = new Map(); // Store historical snapshots for diff tracking
    this.stats = {
      totalCaptures: 0,
      metadataCaptures: 0,
      formattedCaptures: 0,
      rawCaptures: 0,
      diffCaptures: 0,
      totalBytesProcessed: 0,
      totalCompressionRatio: 0
    };
    this.maxSnapshotHistory = 100; // Keep last 100 snapshots per URL
  }

  /**
   * Generate unique snapshot ID
   * @param {string} url - Page URL
   * @param {string} html - HTML content
   * @returns {string} Snapshot ID
   */
  generateSnapshotId(url, html) {
    const hash = crypto.createHash('sha256')
      .update(url + html)
      .digest('hex')
      .substring(0, 16);
    return hash;
  }

  /**
   * Extract metadata from response headers and HTML
   * @param {string} html - HTML content
   * @param {Object} headers - Response headers
   * @param {string} url - Page URL
   * @returns {Object} Extracted metadata
   */
  extractMetadata(html, headers = {}, url = '') {
    const metadata = {
      url: url,
      timestamp: new Date().toISOString(),
      charset: this.extractCharset(html, headers),
      contentLength: html ? html.length : 0,
      contentType: headers['content-type'] || 'text/html',
      serverHeader: headers['server'] || 'unknown',
      cacheControl: headers['cache-control'] || 'not-set',
      lastModified: headers['last-modified'] || null,
      etag: headers['etag'] || null,
      expires: headers['expires'] || null,
      language: this.extractLanguage(html),
      doctype: this.extractDoctype(html),
      metaTags: this.extractMetaTags(html),
      resources: this.extractResources(html, url),
      timing: {
        capturedAt: Date.now(),
        htmlSize: html ? html.length : 0
      }
    };

    return metadata;
  }

  /**
   * Extract charset from HTML or headers
   * @private
   */
  extractCharset(html, headers) {
    // Check headers first
    const contentType = headers['content-type'] || '';
    const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
    if (charsetMatch) {
      return charsetMatch[1];
    }

    // Check meta tags
    if (html && typeof html === 'string') {
      const metaCharset = html.match(/<meta[^>]+charset\s*=\s*["']?([^\s"'>;]+)/i);
      if (metaCharset) {
        return metaCharset[1];
      }
    }

    return 'utf-8'; // Default
  }

  /**
   * Extract HTML language attribute
   * @private
   */
  extractLanguage(html) {
    if (!html || typeof html !== 'string') {
      return 'unknown';
    }
    const langMatch = html.match(/<html[^>]+lang\s*=\s*["']?([^\s"'>;]+)/i);
    return langMatch ? langMatch[1] : 'unknown';
  }

  /**
   * Extract DOCTYPE
   * @private
   */
  extractDoctype(html) {
    if (!html || typeof html !== 'string') {
      return 'unknown';
    }
    const doctypeMatch = html.match(/<!DOCTYPE\s+([^\s>]+)/i);
    return doctypeMatch ? doctypeMatch[1] : 'unknown';
  }

  /**
   * Extract all meta tags
   * @private
   */
  extractMetaTags(html) {
    const metaTags = [];
    if (!html || typeof html !== 'string') {
      return metaTags;
    }

    const metaRegex = /<meta\s+([^>]+)>/gi;
    let match;

    while ((match = metaRegex.exec(html)) !== null) {
      const tagAttrs = match[1];
      const nameMatch = tagAttrs.match(/name\s*=\s*["']?([^\s"'>;]+)/i);
      const propertyMatch = tagAttrs.match(/property\s*=\s*["']?([^\s"'>;]+)/i);
      const contentMatch = tagAttrs.match(/content\s*=\s*["']?([^"'>;]+)/i);

      const metaTag = {};
      if (nameMatch) metaTag.name = nameMatch[1];
      if (propertyMatch) metaTag.property = propertyMatch[1];
      if (contentMatch) metaTag.content = contentMatch[1];

      if (Object.keys(metaTag).length > 0) {
        metaTags.push(metaTag);
      }
    }

    return metaTags;
  }

  /**
   * Extract all resources (scripts, stylesheets, images)
   * @private
   */
  extractResources(html, baseUrl) {
    const resources = {
      scripts: [],
      stylesheets: [],
      images: [],
      iframes: [],
      videos: [],
      audio: []
    };

    if (!html || typeof html !== 'string') {
      return resources;
    }

    // Extract script sources
    const scriptRegex = /<script[^>]+src\s*=\s*["']?([^\s"'>;]+)/gi;
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
      resources.scripts.push(this.resolveUrl(match[1], baseUrl));
    }

    // Extract stylesheets
    const linkRegex = /<link[^>]+rel\s*=\s*["']?stylesheet["']?[^>]+href\s*=\s*["']?([^\s"'>;]+)/gi;
    while ((match = linkRegex.exec(html)) !== null) {
      resources.stylesheets.push(this.resolveUrl(match[1], baseUrl));
    }

    // Extract images
    const imgRegex = /<img[^>]+src\s*=\s*["']?([^\s"'>;]+)/gi;
    while ((match = imgRegex.exec(html)) !== null) {
      resources.images.push(this.resolveUrl(match[1], baseUrl));
    }

    // Extract iframes
    const iframeRegex = /<iframe[^>]+src\s*=\s*["']?([^\s"'>;]+)/gi;
    while ((match = iframeRegex.exec(html)) !== null) {
      resources.iframes.push(this.resolveUrl(match[1], baseUrl));
    }

    // Extract videos
    const videoRegex = /<source[^>]+src\s*=\s*["']?([^\s"'>;]+)/gi;
    while ((match = videoRegex.exec(html)) !== null) {
      resources.videos.push(this.resolveUrl(match[1], baseUrl));
    }

    // Extract audio
    const audioRegex = /<audio[^>]+src\s*=\s*["']?([^\s"'>;]+)/gi;
    while ((match = audioRegex.exec(html)) !== null) {
      resources.audio.push(this.resolveUrl(match[1], baseUrl));
    }

    return resources;
  }

  /**
   * Resolve relative URL to absolute
   * @private
   */
  resolveUrl(url, baseUrl) {
    if (!url || typeof url !== 'string') return url;

    // Already absolute
    if (url.match(/^https?:\/\//i) || url.match(/^\/\//)) {
      if (url.startsWith('//')) {
        const baseProtocol = baseUrl ? baseUrl.split(':')[0] : 'https';
        return `${baseProtocol}:${url}`;
      }
      return url;
    }

    // Special URLs
    if (url.match(/^(data:|javascript:|mailto:|tel:|#)/i)) {
      return url;
    }

    if (!baseUrl) return url;

    try {
      const base = new URL(baseUrl);
      if (url.startsWith('/')) {
        return `${base.protocol}//${base.host}${url}`;
      }
      const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
      return `${base.protocol}//${base.host}${basePath}${url}`;
    } catch (e) {
      return url;
    }
  }

  /**
   * Format HTML with pretty printing and comments
   * @param {string} html - HTML to format
   * @param {Object} options - Formatting options
   * @returns {string} Formatted HTML
   */
  formatHtml(html, options = {}) {
    const {
      indentSize = 2,
      addComments = true,
      wrapWidth = 120,
      includeSourceMap = false
    } = options;

    const indent = ' '.repeat(indentSize);
    let formatted = '';
    let indentLevel = 0;
    let i = 0;

    // Self-closing tags
    const selfClosing = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wasi)$/i;

    while (i < html.length) {
      // Skip whitespace
      let start = i;
      while (i < html.length && /\s/.test(html[i])) {
        i++;
      }

      // Text content
      if (html[i] !== '<') {
        let text = '';
        while (i < html.length && html[i] !== '<') {
          text += html[i];
          i++;
        }
        text = text.trim();
        if (text) {
          formatted += indent.repeat(indentLevel) + text + '\n';
        }
        continue;
      }

      // HTML tag
      start = i;
      let tagEnd = html.indexOf('>', i);
      if (tagEnd === -1) {
        formatted += html.substring(i);
        break;
      }

      const tag = html.substring(i, tagEnd + 1);
      const tagName = this.extractTagName(tag);

      // Closing tag
      if (tag.startsWith('</')) {
        indentLevel = Math.max(0, indentLevel - 1);
        formatted += indent.repeat(indentLevel) + tag + '\n';
      } else if (tag.startsWith('<!')) {
        // Doctype or comment
        formatted += tag + '\n';
      } else {
        // Opening tag
        formatted += indent.repeat(indentLevel) + tag + '\n';
        if (!selfClosing.test(tagName) && !tag.endsWith('/>')) {
          indentLevel++;
        }
      }

      i = tagEnd + 1;
    }

    return formatted;
  }

  /**
   * Extract tag name from HTML tag
   * @private
   */
  extractTagName(tag) {
    const match = tag.match(/<\/?(\w+)/);
    return match ? match[1].toLowerCase() : '';
  }

  /**
   * Capture HTML with full metadata
   * @param {string} html - HTML content
   * @param {Object} options - Capture options
   * @returns {Object} Capture result
   */
  async captureWithMetadata(html, options = {}) {
    const {
      url = '',
      headers = {},
      includeFormatted = false,
      compress = false
    } = options;

    const startTime = Date.now();

    try {
      // Validate HTML parameter
      if (html === null || html === undefined || html === '') {
        return {
          success: false,
          error: 'HTML parameter must be a non-empty string',
          errorCode: 'INVALID_HTML_PARAM'
        };
      }

      const metadata = this.extractMetadata(html, headers, url);
      const snapshotId = this.generateSnapshotId(url, html);

      // Store snapshot for diff tracking
      this.storeSnapshot(url, snapshotId, html);

      const result = {
        success: true,
        snapshotId: snapshotId,
        html: html,
        metadata: metadata,
        formatted: includeFormatted ? this.formatHtml(html) : null,
        size: {
          raw: html ? html.length : 0,
          compressed: 0,
          compressionRatio: 0
        },
        processingTime: Date.now() - startTime
      };

      // Compress if requested
      if (compress) {
        const compressed = await gzip(Buffer.from(html, 'utf-8'));
        result.size.compressed = compressed.length;
        result.size.compressionRatio = (1 - (compressed.length / (html ? html.length : 1))) * 100;
        result.htmlCompressed = compressed.toString('base64');
      }

      this.stats.totalCaptures++;
      this.stats.metadataCaptures++;
      this.stats.totalBytesProcessed += html ? html.length : 0;

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'METADATA_CAPTURE_FAILED'
      };
    }
  }

  /**
   * Capture formatted HTML with comments
   * @param {string} html - HTML content
   * @param {Object} options - Format options
   * @returns {Object} Formatted capture result
   */
  captureFormatted(html, options = {}) {
    const startTime = Date.now();

    try {
      const {
        url = '',
        indentSize = 2,
        includeComments = true
      } = options;

      const formatted = this.formatHtml(html, {
        indentSize,
        addComments: includeComments
      });

      const snapshotId = this.generateSnapshotId(url, html);

      const result = {
        success: true,
        snapshotId: snapshotId,
        url: url,
        html: formatted,
        metadata: {
          originalSize: html ? html.length : 0,
          formattedSize: formatted.length,
          indentSize: indentSize,
          includeComments: includeComments
        },
        processingTime: Date.now() - startTime
      };

      this.stats.totalCaptures++;
      this.stats.formattedCaptures++;

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'FORMATTED_CAPTURE_FAILED'
      };
    }
  }

  /**
   * Capture raw HTML exactly as received
   * @param {string} html - HTML content
   * @param {Object} responseInfo - Response information
   * @returns {Object} Raw capture result
   */
  async captureRaw(html, responseInfo = {}) {
    const startTime = Date.now();

    try {
      const buffer = Buffer.from(html || '', 'utf-8');
      const snapshotId = this.generateSnapshotId(responseInfo.url || '', html);

      // Store snapshot
      this.storeSnapshot(responseInfo.url || '', snapshotId, html);

      const result = {
        success: true,
        snapshotId: snapshotId,
        url: responseInfo.url || '',
        html: html,
        bytes: {
          raw: buffer.length,
          sha256: crypto.createHash('sha256').update(html).digest('hex'),
          md5: crypto.createHash('md5').update(html).digest('hex')
        },
        response: {
          statusCode: responseInfo.statusCode || 200,
          statusText: responseInfo.statusText || 'OK',
          headers: responseInfo.headers || {},
          timing: {
            fetchStart: responseInfo.fetchStart || Date.now(),
            fetchEnd: responseInfo.fetchEnd || Date.now(),
            duration: responseInfo.duration || 0
          }
        },
        processingTime: Date.now() - startTime
      };

      this.stats.totalCaptures++;
      this.stats.rawCaptures++;
      this.stats.totalBytesProcessed += buffer.length;

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'RAW_CAPTURE_FAILED'
      };
    }
  }

  /**
   * Store snapshot for diff tracking
   * @private
   */
  storeSnapshot(url, snapshotId, html) {
    if (!url) return;

    if (!this.snapshots.has(url)) {
      this.snapshots.set(url, []);
    }

    const snapshots = this.snapshots.get(url);
    snapshots.unshift({
      id: snapshotId,
      timestamp: Date.now(),
      size: html ? html.length : 0,
      hash: crypto.createHash('sha256').update(html).digest('hex')
    });

    // Maintain max history
    if (snapshots.length > this.maxSnapshotHistory) {
      snapshots.pop();
    }
  }

  /**
   * Capture with change tracking
   * @param {string} html - Current HTML
   * @param {Object} options - Diff options
   * @returns {Object} Diff capture result
   */
  captureDiff(html, options = {}) {
    const startTime = Date.now();

    try {
      const {
        url = '',
        previousSnapshotId = null,
        includeFullHtml = false
      } = options;

      const currentSnapshotId = this.generateSnapshotId(url, html);
      const currentSize = html ? html.length : 0;

      // Get previous snapshot info BEFORE storing new one
      const snapshots = this.snapshots.get(url) || [];
      const previousSnapshot = previousSnapshotId
        ? snapshots.find(s => s.id === previousSnapshotId)
        : snapshots.length > 0 ? snapshots[0] : null;

      // Store current snapshot
      this.storeSnapshot(url, currentSnapshotId, html);

      // Get updated snapshots list for history (now includes current)
      const updatedSnapshots = this.snapshots.get(url) || [];

      const diff = {
        snapshotId: currentSnapshotId,
        url: url,
        timestamp: new Date().toISOString(),
        current: {
          size: currentSize,
          hash: crypto.createHash('sha256').update(html).digest('hex')
        },
        previous: previousSnapshot ? {
          snapshotId: previousSnapshot.id,
          size: previousSnapshot.size,
          hash: previousSnapshot.hash,
          timestamp: new Date(previousSnapshot.timestamp).toISOString(),
          ageSinceCapture: Date.now() - previousSnapshot.timestamp
        } : null,
        changes: {
          sizeChanged: !previousSnapshot || currentSize !== previousSnapshot.size,
          sizeChange: previousSnapshot ? currentSize - previousSnapshot.size : 0,
          sizeChangePercent: previousSnapshot
            ? ((currentSize - previousSnapshot.size) / previousSnapshot.size * 100).toFixed(2)
            : 0,
          hashChanged: !previousSnapshot || crypto.createHash('sha256').update(html).digest('hex') !== previousSnapshot.hash
        },
        history: updatedSnapshots.slice(0, 10).map(s => ({
          snapshotId: s.id,
          timestamp: new Date(s.timestamp).toISOString(),
          size: s.size,
          hash: s.hash
        }))
      };

      // Include full HTML if requested
      if (includeFullHtml) {
        diff.html = html;
      }

      this.stats.totalCaptures++;
      this.stats.diffCaptures++;

      return {
        success: true,
        ...diff,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'DIFF_CAPTURE_FAILED'
      };
    }
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      snapshotCount: Array.from(this.snapshots.values())
        .reduce((sum, snaps) => sum + snaps.length, 0),
      trackedUrls: this.snapshots.size
    };
  }

  /**
   * Clear snapshots for a URL
   * @param {string} url - URL to clear
   * @returns {boolean} Success
   */
  clearSnapshots(url) {
    if (!url) {
      this.snapshots.clear();
      return true;
    }
    return this.snapshots.delete(url);
  }
}

module.exports = { HtmlCaptureManager };
