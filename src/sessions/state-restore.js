/**
 * Basset Hound Browser - Browser State Restoration Module
 * Progressive restoration of captured browser state with validation
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 *
 * Provides:
 * - Progressive restoration (cookies → storage → DOM)
 * - State validation before and after restoration
 * - Graceful degradation on partial failures
 * - Stale state detection
 * - Error recovery and logging
 */

/**
 * Browser State Restoration Handler
 * Restores previously captured browser state with validation
 *
 * @class BrowserStateRestore
 */
class BrowserStateRestore {
  constructor(options = {}) {
    this.timeout = options.timeout || 5000; // 5 second timeout for operations
    this.maxAge = options.maxAge || 12 * 3600 * 1000; // 12 hours default
    this.logger = options.logger || console;
    this.staleStateThreshold = options.staleStateThreshold || 7 * 24 * 3600 * 1000; // 7 days
  }

  /**
   * Restore complete session state
   * @param {WebContents} webContents
   * @param {Object} savedState - State captured previously
   * @param {Object} options - {partial: bool, validate: bool}
   * @returns {Promise<Object>} - {success: bool, restored: Object, failed: Object, warnings: Array}
   */
  async restoreState(webContents, savedState, options = {}) {
    if (!webContents) {
      throw new Error('WebContents object is required');
    }

    if (!savedState) {
      throw new Error('savedState is required');
    }

    const restoreStartTime = Date.now();
    const mergedOptions = { partial: true, validate: true, ...options };
    const results = {
      success: true,
      restored: {
        cookies: 0,
        storage_items: 0,
        dom_elements: 0
      },
      failed: {
        cookies: 0,
        storage_items: 0
      },
      warnings: [],
      errors: [],
      restoreTime: 0
    };

    try {
      // Phase 1: Validate state before restoration
      if (mergedOptions.validate) {
        const validation = this.validateRestoredState(savedState);
        if (!validation.valid && validation.severity === 'error') {
          throw new Error(`State validation failed: ${validation.issues.join(', ')}`);
        }
        results.warnings.push(...validation.issues);
      }

      // Check if state is stale
      const staleCheck = this.detectStaleState(savedState, this.staleStateThreshold);
      if (staleCheck.stale) {
        results.warnings.push(`State is stale (${staleCheck.reason}), proceeding with caution`);
      }

      // Phase 2: Restore cookies (priority 1 - fastest, critical for auth)
      try {
        const cookieResult = await this.restoreCookies(webContents, savedState.cookies || []);
        results.restored.cookies = cookieResult.restored;
        results.failed.cookies = cookieResult.failed;
      } catch (error) {
        results.errors.push(`Cookie restoration failed: ${error.message}`);
        if (!mergedOptions.partial) throw error;
      }

      // Phase 3: Restore storage (priority 2 - medium speed, required for app state)
      try {
        const storageResult = await this.restoreStorage(webContents, {
          localStorage: savedState.localStorage || {},
          sessionStorage: savedState.sessionStorage || {}
        });
        results.restored.storage_items = storageResult.restored;
        results.failed.storage_items = storageResult.failed;
      } catch (error) {
        results.errors.push(`Storage restoration failed: ${error.message}`);
        if (!mergedOptions.partial) throw error;
      }

      // Phase 4: Restore DOM state (priority 3 - optional)
      try {
        const domResult = await this.restoreDOMState(webContents, savedState.domState || {});
        results.restored.dom_elements = domResult.restored;
      } catch (error) {
        results.errors.push(`DOM state restoration failed: ${error.message}`);
        // DOM restoration failures are non-critical
      }

      // Phase 5: Validate restoration completeness
      if (mergedOptions.validate) {
        const postRestoreValidation = this.validateRestorationResult(results);
        results.warnings.push(...postRestoreValidation.issues);
      }

      results.success = results.failed.cookies === 0 && results.failed.storage_items === 0;
      results.restoreTime = Date.now() - restoreStartTime;

      this.logger.info(`State restoration completed in ${results.restoreTime}ms: ${results.restored.cookies} cookies, ${results.restored.storage_items} storage items`);
      return results;
    } catch (error) {
      this.logger.error(`State restoration failed: ${error.message}`);
      throw new Error(`State restoration failed: ${error.message}`);
    }
  }

  /**
   * Restore cookies (Phase 1 - Priority 1)
   * @param {WebContents} webContents
   * @param {Array} cookies - Cookie array from saved state
   * @returns {Promise<Object>} - {restored: number, failed: number}
   */
  async restoreCookies(webContents, cookies) {
    const result = { restored: 0, failed: 0 };

    if (!Array.isArray(cookies) || cookies.length === 0) {
      return result;
    }

    for (const cookie of cookies) {
      try {
        // Skip cookies that are already expired
        if (cookie.expires) {
          const expiryTime = new Date(cookie.expires).getTime();
          if (expiryTime < Date.now()) {
            this.logger.debug(`Skipping expired cookie: ${cookie.name}`);
            continue;
          }
        }

        // Prepare cookie object for Electron
        const cookieObj = {
          url: cookie.secure ? 'https://example.com' : 'http://example.com',
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: cookie.secure || false,
          httpOnly: cookie.httpOnly || false,
          sameSite: this.normalizeSameSite(cookie.sameSite)
        };

        if (cookie.expires) {
          cookieObj.expirationDate = new Date(cookie.expires).getTime() / 1000;
        }

        // Attempt to set cookie
        await webContents.session.cookies.set(cookieObj);
        result.restored++;
      } catch (error) {
        this.logger.warn(`Failed to restore cookie ${cookie.name}: ${error.message}`);
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Restore storage (localStorage + sessionStorage)
   * @param {WebContents} webContents
   * @param {Object} storage - {localStorage, sessionStorage}
   * @returns {Promise<Object>} - {restored: number, failed: number}
   */
  async restoreStorage(webContents, storage) {
    const result = { restored: 0, failed: 0 };

    try {
      const storageScript = `
        (async () => {
          const result = { restored: 0, failed: 0 };
          const localStorage_data = ${JSON.stringify(storage.localStorage || {})};
          const sessionStorage_data = ${JSON.stringify(storage.sessionStorage || {})};

          // Restore localStorage
          for (const [key, value] of Object.entries(localStorage_data)) {
            try {
              localStorage.setItem(key, value);
              result.restored++;
            } catch (e) {
              console.warn('Failed to restore localStorage key:', key, e.message);
              result.failed++;
            }
          }

          // Restore sessionStorage
          for (const [key, value] of Object.entries(sessionStorage_data)) {
            try {
              sessionStorage.setItem(key, value);
              result.restored++;
            } catch (e) {
              console.warn('Failed to restore sessionStorage key:', key, e.message);
              result.failed++;
            }
          }

          return result;
        })();
      `;

      const storageResult = await webContents.executeJavaScript(storageScript, true);
      return storageResult || { restored: 0, failed: 0 };
    } catch (error) {
      this.logger.error(`Storage restoration script failed: ${error.message}`);
      return { restored: 0, failed: 0 };
    }
  }

  /**
   * Restore DOM state (focus, scroll, form data)
   * @param {WebContents} webContents
   * @param {Object} domState
   * @returns {Promise<Object>} - {restored: number}
   */
  async restoreDOMState(webContents, domState) {
    const result = { restored: 0 };

    try {
      const domScript = `
        (() => {
          const domState = ${JSON.stringify(domState)};
          let restored = 0;

          // Restore scroll position
          if (domState.scrollPosition) {
            try {
              window.scrollTo(domState.scrollPosition.x || 0, domState.scrollPosition.y || 0);
              restored++;
            } catch (e) {
              console.warn('Failed to restore scroll position:', e.message);
            }
          }

          // Restore form data
          if (domState.formData && typeof domState.formData === 'object') {
            for (const [formId, formFields] of Object.entries(domState.formData)) {
              try {
                const form = document.querySelector(formId) ||
                            document.getElementById(formId) ||
                            document.querySelector('form');

                if (form) {
                  for (const [fieldName, fieldValue] of Object.entries(formFields)) {
                    try {
                      const field = form.querySelector('[name="' + fieldName + '"]') ||
                                  form.querySelector('#' + fieldName) ||
                                  form.querySelector(fieldName);

                      if (field) {
                        if (field.type === 'checkbox' || field.type === 'radio') {
                          field.checked = fieldValue;
                        } else if (field.tagName === 'SELECT') {
                          field.value = fieldValue;
                        } else {
                          field.value = fieldValue;
                        }
                        restored++;
                      }
                    } catch (e) {
                      console.warn('Failed to restore field:', fieldName, e.message);
                    }
                  }
                }
              } catch (e) {
                console.warn('Failed to restore form:', formId, e.message);
              }
            }
          }

          // Restore focus (optional, lowest priority)
          if (domState.activeElement) {
            try {
              const elem = document.querySelector(domState.activeElement);
              if (elem && elem.focus) {
                elem.focus();
                restored++;
              }
            } catch (e) {
              console.warn('Failed to restore focus:', e.message);
            }
          }

          return restored;
        })();
      `;

      const restored = await webContents.executeJavaScript(domScript, true);
      result.restored = restored || 0;
      return result;
    } catch (error) {
      this.logger.warn(`DOM state restoration script failed: ${error.message}`);
      return { restored: 0 };
    }
  }

  /**
   * Detect if state is stale/expired
   * @param {Object} state
   * @param {number} maxAge - Max age in milliseconds
   * @returns {Object} - {stale: bool, reason: string, confidence: 0-1}
   */
  detectStaleState(state, maxAge) {
    if (!state.capturedAt) {
      return { stale: true, reason: 'No capture timestamp', confidence: 1.0 };
    }

    const capturedAt = new Date(state.capturedAt).getTime();
    const now = Date.now();
    const age = now - capturedAt;

    // Check age
    if (age > maxAge) {
      return { stale: true, reason: `State age (${Math.round(age / 3600000)} hours) exceeds max (${Math.round(maxAge / 3600000)} hours)`, confidence: 1.0 };
    }

    // Check for expired cookies
    const expiredCookies = (state.cookies || []).filter(c => {
      if (!c.expires) return false;
      return new Date(c.expires).getTime() < now;
    });

    if (expiredCookies.length > 0) {
      const ratio = expiredCookies.length / Math.max(state.cookies.length, 1);
      if (ratio > 0.5) {
        return { stale: true, reason: `${ratio * 100}% of cookies are expired`, confidence: 0.8 };
      }
    }

    // Check for very large state (likely quota exceeded)
    if (state.metadata && state.metadata.sizeBytes > 5 * 1024 * 1024) {
      return { stale: true, reason: 'State size exceeds 5MB, may cause quota issues', confidence: 0.6 };
    }

    return { stale: false, reason: 'State is fresh', confidence: 1.0 };
  }

  /**
   * Validate state structure and completeness
   * @param {Object} state
   * @returns {Object} - {valid: bool, issues: Array, severity: 'info'|'warning'|'error'}
   */
  validateRestoredState(state) {
    const issues = [];

    // Check required fields
    if (!state || typeof state !== 'object') {
      return { valid: false, issues: ['State is not a valid object'], severity: 'error' };
    }

    if (!state.capturedAt) {
      issues.push('Missing capturedAt timestamp');
    }

    if (!state.sessionId) {
      issues.push('Missing sessionId');
    }

    // Check state components
    if (!Array.isArray(state.cookies)) {
      issues.push('Cookies is not an array');
    }

    if (typeof state.localStorage !== 'object') {
      issues.push('localStorage is not an object');
    }

    if (typeof state.sessionStorage !== 'object') {
      issues.push('sessionStorage is not an object');
    }

    // Check metadata
    if (state.metadata) {
      if (!state.metadata.timestamp && !state.metadata.sizeBytes) {
        issues.push('Metadata is incomplete');
      }

      if (state.metadata.version && state.metadata.version !== 1) {
        issues.push(`Unexpected version: ${state.metadata.version}`);
      }
    } else {
      issues.push('Missing metadata');
    }

    const isCritical = issues.some(i => i.includes('sessionId') || i.includes('capturedAt'));
    const severity = isCritical ? 'error' : issues.length > 0 ? 'warning' : 'info';

    return {
      valid: !isCritical,
      issues,
      severity
    };
  }

  /**
   * Validate restoration result
   * @param {Object} result - Result from restoreState
   * @returns {Object} - {issues: Array}
   */
  validateRestorationResult(result) {
    const issues = [];

    if (result.failed.cookies > 0) {
      issues.push(`Failed to restore ${result.failed.cookies} cookies`);
    }

    if (result.failed.storage_items > 0) {
      issues.push(`Failed to restore ${result.failed.storage_items} storage items`);
    }

    if (result.errors && result.errors.length > 0) {
      issues.push(...result.errors);
    }

    return { issues };
  }

  /**
   * Normalize sameSite attribute for consistency
   * @param {string} sameSite
   * @returns {string}
   */
  normalizeSameSite(sameSite) {
    if (!sameSite || sameSite === 'Unspecified') {
      return 'None';
    }
    const normalized = sameSite.toLowerCase();
    if (normalized === 'strict') return 'Strict';
    if (normalized === 'lax') return 'Lax';
    if (normalized === 'none') return 'None';
    return 'Lax';
  }
}

module.exports = BrowserStateRestore;
