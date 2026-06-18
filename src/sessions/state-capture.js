/**
 * Basset Hound Browser - Browser State Capture Module
 * Comprehensive serialization of browser state including cookies, storage, DOM state
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 *
 * Provides:
 * - Complete cookie extraction with attributes
 * - Storage snapshot (localStorage, sessionStorage, IndexedDB enumeration)
 * - DOM state capture (focus, scroll, form data)
 * - Navigation state preservation
 * - Gzip compression for serialized state
 * - State validation and size estimation
 */

const zlib = require('zlib');
const { promisify } = require('util');
const { pipeline } = require('stream/promises');
const crypto = require('crypto');
const fs = require('fs');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Browser State Capture Handler
 * Captures complete browser state across all domains
 *
 * @class BrowserStateCapture
 */
class BrowserStateCapture {
  constructor(options = {}) {
    this.timeout = options.timeout || 5000; // 5 second timeout for IPC
    this.includeDOM = options.includeDOM !== false;
    this.includeShadowDOM = options.includeShadowDOM || false;
    this.compressionEnabled = options.compressionEnabled !== false;
    this.logger = options.logger || console;
  }

  /**
   * Capture complete browser state
   * @param {WebContents} webContents - Electron WebContents object
   * @param {Object} options - {includeDOM: bool, includeShadowDOM: bool}
   * @returns {Promise<Object>} - Complete state snapshot
   */
  async captureState(webContents, options = {}) {
    if (!webContents) {
      throw new Error('WebContents object is required');
    }

    const captureStartTime = Date.now();
    const mergedOptions = { ...this.getDefaults(), ...options };

    try {
      const [cookies, storage, domState, navigationState] = await Promise.all([
        this.captureCookies(webContents),
        this.captureStorage(webContents),
        mergedOptions.includeDOM ? this.captureDOMState(webContents) : {},
        this.captureNavigationState(webContents)
      ]);

      // Assemble complete state
      const completeState = {
        // Metadata
        capturedAt: new Date().toISOString(),
        sessionId: this.generateSessionId(),
        profileId: options.profileId || 'default',
        url: navigationState.currentUrl,
        title: navigationState.title,

        // Browser State
        cookies,
        localStorage: storage.localStorage || {},
        sessionStorage: storage.sessionStorage || {},
        indexedDB: storage.indexedDB || {},

        // DOM State
        domState,

        // Navigation
        navigationState,

        // Metadata
        metadata: {
          sizeBytes: JSON.stringify({ cookies, localStorage: storage.localStorage }).length,
          compressed: false,
          compressionRatio: 0,
          timestamp: Date.now(),
          version: 1,
          captureTime: Date.now() - captureStartTime
        }
      };

      // Calculate uncompressed size
      const uncompressedJson = JSON.stringify(completeState);
      completeState.metadata.sizeBytes = Buffer.byteLength(uncompressedJson, 'utf8');

      // Compress if enabled
      if (this.compressionEnabled) {
        const compressed = await this.compressState(uncompressedJson);
        completeState.metadata.compressedBytes = compressed.length;
        completeState.metadata.compressionRatio = (1 - compressed.length / completeState.metadata.sizeBytes).toFixed(2);
        completeState.metadata.compressed = true;
      }

      // Validate state completeness
      const validation = this.validateState(completeState);
      if (!validation.valid) {
        this.logger.warn(`State validation issues: ${validation.warnings.join(', ')}`);
      }

      return completeState;
    } catch (error) {
      this.logger.error(`Failed to capture state: ${error.message}`);
      throw new Error(`State capture failed: ${error.message}`);
    }
  }

  /**
   * Capture cookies with all attributes
   * @param {WebContents} webContents
   * @returns {Promise<Array>} - Cookie array
   */
  async captureCookies(webContents) {
    try {
      const allCookies = await webContents.session.cookies.get({});

      return allCookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || '',
        path: cookie.path || '/',
        expires: cookie.expirationDate
          ? new Date(cookie.expirationDate * 1000).toISOString()
          : undefined,
        httpOnly: cookie.httpOnly || false,
        secure: cookie.secure || false,
        sameSite: cookie.sameSite || 'Unspecified',
        session: cookie.session || false
      })).filter(cookie => cookie.name && cookie.value);
    } catch (error) {
      this.logger.warn(`Cookie capture failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Capture storage (localStorage, sessionStorage, IndexedDB)
   * @param {WebContents} webContents
   * @returns {Promise<Object>} - Storage snapshot
   */
  async captureStorage(webContents) {
    try {
      // Execute script in renderer process to capture storage
      const storageScript = `
        (async () => {
          const result = {
            localStorage: {},
            sessionStorage: {},
            indexedDB: {}
          };

          // Capture localStorage
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              result.localStorage[key] = localStorage.getItem(key);
            }
          } catch (e) {
            console.warn('localStorage capture failed:', e.message);
          }

          // Capture sessionStorage
          try {
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              result.sessionStorage[key] = sessionStorage.getItem(key);
            }
          } catch (e) {
            console.warn('sessionStorage capture failed:', e.message);
          }

          // Enumerate IndexedDB databases
          try {
            if (typeof indexedDB !== 'undefined') {
              const dbs = await indexedDB.databases?.();
              if (dbs && Array.isArray(dbs)) {
                for (const db of dbs) {
                  result.indexedDB[db.name] = {
                    version: db.version,
                    object_stores: ['enumerated']
                  };
                }
              }
            }
          } catch (e) {
            console.warn('IndexedDB enumeration failed:', e.message);
          }

          return result;
        })();
      `;

      const storage = await webContents.executeJavaScript(storageScript, true);
      return storage || { localStorage: {}, sessionStorage: {}, indexedDB: {} };
    } catch (error) {
      this.logger.warn(`Storage capture failed: ${error.message}`);
      return { localStorage: {}, sessionStorage: {}, indexedDB: {} };
    }
  }

  /**
   * Capture DOM state (focus, scroll, form data)
   * @param {WebContents} webContents
   * @returns {Promise<Object>} - DOM state snapshot
   */
  async captureDOMState(webContents) {
    try {
      const domScript = `
        (() => {
          const result = {
            activeElement: null,
            scrollPosition: { x: 0, y: 0 },
            formData: {},
            focusPath: []
          };

          // Capture active element
          if (document.activeElement && document.activeElement !== document.body) {
            const elem = document.activeElement;
            result.activeElement = this.getElementSelector(elem);
          }

          // Capture scroll position
          result.scrollPosition = {
            x: window.scrollX || 0,
            y: window.scrollY || 0
          };

          // Capture form data
          const forms = document.querySelectorAll('form');
          forms.forEach(form => {
            const formId = form.id || form.name || this.getElementSelector(form);
            result.formData[formId] = {};

            // Get all form inputs
            const inputs = form.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
              const inputId = input.id || input.name || input.type;
              if (input.type === 'checkbox' || input.type === 'radio') {
                result.formData[formId][inputId] = input.checked;
              } else if (input.type === 'file') {
                // Skip file inputs (security)
              } else if (input.tagName === 'SELECT') {
                result.formData[formId][inputId] = input.value;
              } else {
                result.formData[formId][inputId] = input.value;
              }
            });
          });

          // Helper to get element selector
          window.getElementSelector = (elem) => {
            if (elem.id) return '#' + elem.id;
            if (elem.name) return elem.tagName.toLowerCase() + '[name="' + elem.name + '"]';
            if (elem.className) return elem.tagName.toLowerCase() + '.' + elem.className.split(' ').join('.');
            return elem.tagName.toLowerCase();
          };

          // Capture focus path (simplified)
          if (document.activeElement) {
            let elem = document.activeElement;
            while (elem && elem !== document.body) {
              result.focusPath.push(this.getElementSelector(elem));
              elem = elem.parentElement;
            }
          }

          return result;
        }).call(window);
      `;

      const domState = await webContents.executeJavaScript(domScript, true);
      return domState || { activeElement: null, scrollPosition: { x: 0, y: 0 }, formData: {}, focusPath: [] };
    } catch (error) {
      this.logger.warn(`DOM state capture failed: ${error.message}`);
      return { activeElement: null, scrollPosition: { x: 0, y: 0 }, formData: {}, focusPath: [] };
    }
  }

  /**
   * Capture navigation state (URL, history, history state)
   * @param {WebContents} webContents
   * @returns {Promise<Object>} - Navigation state
   */
  async captureNavigationState(webContents) {
    try {
      const navigationScript = `
        (() => {
          return {
            currentUrl: window.location.href,
            title: document.title,
            scrollRestoration: history.scrollRestoration || 'auto',
            historyLength: history.length
          };
        })();
      `;

      const navState = await webContents.executeJavaScript(navigationScript, true);
      return navState || { currentUrl: '', title: '', scrollRestoration: 'auto', historyLength: 0 };
    } catch (error) {
      this.logger.warn(`Navigation state capture failed: ${error.message}`);
      return { currentUrl: '', title: '', scrollRestoration: 'auto', historyLength: 0 };
    }
  }

  /**
   * Compress state using gzip
   * @param {string} stateJson - Stringified state
   * @returns {Promise<Buffer>} - Compressed buffer
   */
  async compressState(stateJson) {
    try {
      return await gzip(Buffer.from(stateJson, 'utf8'));
    } catch (error) {
      this.logger.warn(`Compression failed: ${error.message}, returning uncompressed`);
      return Buffer.from(stateJson, 'utf8');
    }
  }

  /**
   * Compress state using streaming (for large payloads >5MB)
   * @param {string} stateJson - Stringified state
   * @param {Stream} writeStream - Destination write stream
   * @returns {Promise<void>}
   */
  async compressStateStream(stateJson, writeStream) {
    try {
      const sourceStream = require('stream').Readable.from([stateJson]);
      const gzipTransform = zlib.createGzip({
        level: zlib.constants.Z_DEFAULT_COMPRESSION
      });

      await pipeline(sourceStream, gzipTransform, writeStream);
    } catch (error) {
      this.logger.warn(`Streaming compression failed: ${error.message}`);
      throw new Error(`Streaming compression failed: ${error.message}`);
    }
  }

  /**
   * Decompress state
   * @param {Buffer} compressedData - Compressed buffer
   * @returns {Promise<Object>} - Decompressed state
   */
  async decompressState(compressedData) {
    try {
      const decompressed = await gunzip(compressedData);
      return JSON.parse(decompressed.toString('utf8'));
    } catch (error) {
      this.logger.error(`Decompression failed: ${error.message}`);
      throw new Error(`State decompression failed: ${error.message}`);
    }
  }

  /**
   * Estimate serialized size without compression
   * @param {Object} state
   * @returns {number} - Size in bytes
   */
  estimateSize(state) {
    try {
      const json = JSON.stringify(state);
      return Buffer.byteLength(json, 'utf8');
    } catch (error) {
      return 0;
    }
  }

  /**
   * Validate state completeness
   * @param {Object} state
   * @returns {Object} - {valid: bool, missing: Array, warnings: Array}
   */
  validateState(state) {
    const warnings = [];
    const missing = [];

    // Check required fields
    if (!state.capturedAt) missing.push('capturedAt');
    if (!state.sessionId) missing.push('sessionId');
    if (!state.url) warnings.push('url is missing or empty');

    // Check state components
    if (!Array.isArray(state.cookies)) warnings.push('cookies is not an array');
    if (typeof state.localStorage !== 'object') warnings.push('localStorage is not an object');
    if (typeof state.sessionStorage !== 'object') warnings.push('sessionStorage is not an object');
    if (!state.metadata) warnings.push('metadata is missing');

    // Check metadata
    if (state.metadata) {
      if (!state.metadata.timestamp) warnings.push('metadata.timestamp is missing');
      if (state.metadata.version !== 1) warnings.push(`Unexpected version: ${state.metadata.version}`);
    }

    return {
      valid: missing.length === 0,
      missing,
      warnings,
      severity: missing.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'info'
    };
  }

  /**
   * Generate unique session ID
   * @returns {string}
   */
  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Get default options
   * @returns {Object}
   */
  getDefaults() {
    return {
      includeDOM: true,
      includeShadowDOM: false
    };
  }

  /**
   * Calculate checksum of state
   * @param {Object} state
   * @returns {string} - SHA256 hex
   */
  calculateChecksum(state) {
    const json = JSON.stringify(state);
    return crypto.createHash('sha256').update(json).digest('hex');
  }
}

module.exports = BrowserStateCapture;
