/**
 * Command Registry - Single Source of Truth for All WebSocket Commands
 *
 * This module provides:
 * - Complete metadata for all 140+ commands (name, description, parameters, examples, error codes)
 * - Dynamic querying of command information
 * - Error code and recovery hint lookups
 * - Category organization
 * - Auto-generation of API documentation
 *
 * Benefits:
 * - Centralized command documentation
 * - Self-documenting API (users query for help)
 * - API reference generation
 * - Better error messages with recovery hints
 * - Command introspection
 *
 * @module websocket/command-registry
 */

const { COMMAND_SCHEMAS, getAllCommandNames } = require('./command-schemas');

/**
 * Error codes and recovery hints used across the API
 */
const ERROR_CODES = {
  INVALID_URL: {
    description: 'The provided URL is invalid',
    recoveryHint: 'Check URL format (must start with http:// or https://)',
    relatedErrors: ['NAVIGATION_FAILED']
  },
  INVALID_PARAMETERS: {
    description: 'One or more required parameters are missing or have invalid types',
    recoveryHint: 'Check parameter types and ensure all required fields are present',
    relatedErrors: ['MISSING_PARAMETER']
  },
  MISSING_PARAMETER: {
    description: 'A required parameter is missing',
    recoveryHint: 'Use /api/help?command=<name> to see required parameters',
    relatedErrors: ['INVALID_PARAMETERS']
  },
  TIMEOUT: {
    description: 'The operation took too long and was cancelled',
    recoveryHint: 'Increase timeout parameter or check network connectivity',
    relatedErrors: ['NAVIGATION_FAILED', 'ELEMENT_NOT_FOUND']
  },
  ELEMENT_NOT_FOUND: {
    description: 'The specified element selector did not match any elements',
    recoveryHint: 'Check selector syntax and verify element exists on page',
    relatedErrors: ['INVALID_SELECTOR']
  },
  INVALID_SELECTOR: {
    description: 'The CSS selector syntax is invalid',
    recoveryHint: 'Use valid CSS selector syntax or XPath format',
    relatedErrors: ['ELEMENT_NOT_FOUND']
  },
  NAVIGATION_FAILED: {
    description: 'Navigation to the URL failed',
    recoveryHint: 'Check URL validity and network connectivity',
    relatedErrors: ['TIMEOUT', 'INVALID_URL']
  },
  BROWSER_NOT_READY: {
    description: 'The browser is not yet ready to accept commands',
    recoveryHint: 'Wait a moment and retry, or check browser health with /api/diagnostics',
    relatedErrors: []
  },
  SCREENSHOT_FAILED: {
    description: 'Screenshot capture failed',
    recoveryHint: 'Ensure page is loaded and try again',
    relatedErrors: []
  },
  SCRIPT_ERROR: {
    description: 'JavaScript execution failed',
    recoveryHint: 'Check script syntax and console for detailed error',
    relatedErrors: []
  },
  PROFILE_NOT_FOUND: {
    description: 'The requested browser profile does not exist',
    recoveryHint: 'Use /api/help?command=listProfiles to see available profiles',
    relatedErrors: []
  },
  PROFILE_LOAD_FAILED: {
    description: 'Failed to load the specified profile',
    recoveryHint: 'Check profile exists and try again',
    relatedErrors: ['PROFILE_NOT_FOUND']
  },
  INVALID_PROXY: {
    description: 'The proxy configuration is invalid',
    recoveryHint: 'Verify proxy URL format: http://host:port or socks5://host:port',
    relatedErrors: []
  },
  PROXY_CONNECTION_FAILED: {
    description: 'Failed to connect to the proxy server',
    recoveryHint: 'Check proxy server status and network connectivity',
    relatedErrors: ['INVALID_PROXY']
  },
  STORAGE_ERROR: {
    description: 'Failed to access browser storage (cookies, localStorage, etc)',
    recoveryHint: 'Check storage quotas and try again',
    relatedErrors: []
  },
  INVALID_CREDENTIALS: {
    description: 'Authentication credentials are invalid',
    recoveryHint: 'Check username and password are correct',
    relatedErrors: []
  },
  SESSION_EXPIRED: {
    description: 'The browser session has expired',
    recoveryHint: 'Start a new session and re-login if needed',
    relatedErrors: []
  },
  FEATURE_NOT_SUPPORTED: {
    description: 'This feature is not supported in the current browser mode',
    recoveryHint: 'Check browser capabilities with /api/diagnostics',
    relatedErrors: []
  },
  RATE_LIMITED: {
    description: 'Too many requests were sent too quickly',
    recoveryHint: 'Wait a moment before retrying',
    relatedErrors: []
  },
  INTERNAL_ERROR: {
    description: 'An unexpected internal error occurred',
    recoveryHint: 'Check server logs and contact support if problem persists',
    relatedErrors: []
  }
};

/**
 * Command categories
 */
const CATEGORIES = {
  NAVIGATION: 'Navigation',
  INTERACTION: 'Interaction',
  SCREENSHOT: 'Screenshots',
  CONTENT: 'Content Extraction',
  FORMS: 'Forms',
  COOKIES: 'Cookies & Storage',
  PROXY: 'Proxy & Network',
  USER_AGENT: 'User Agent',
  PROFILES: 'Browser Profiles',
  JAVASCRIPT: 'JavaScript Execution',
  DEVTOOLS: 'DevTools & Debugging',
  STATUS: 'Status & Health',
  SESSION: 'Session Management',
  STORAGE: 'Storage Management',
  REQUEST_INTERCEPTION: 'Request Interception',
  FINGERPRINTING: 'Fingerprinting & Evasion',
  CREDENTIALS: 'Credentials & Auth',
  FORENSICS: 'Forensic Analysis',
  DOM: 'DOM & Inspection',
  RECORDING: 'Session Recording'
};

/**
 * Enrich command schema with additional metadata
 */
function enrichCommandMetadata() {
  const enriched = {};

  Object.entries(COMMAND_SCHEMAS).forEach(([key, schema]) => {
    enriched[key] = {
      ...schema,
      category: categorizeCommand(schema.command),
      errorCodes: getCommandErrorCodes(schema.command),
      recoveryHints: getCommandRecoveryHints(schema.command),
      examples: getCommandExamples(schema.command)
    };
  });

  return enriched;
}

/**
 * Categorize a command based on its name
 * @param {string} commandName - Command name
 * @returns {string} Category name
 */
function categorizeCommand(commandName) {
  const patterns = {
    [CATEGORIES.NAVIGATION]: /^(navigate|goBack|goForward|reload|goto|back|forward)/i,
    [CATEGORIES.INTERACTION]: /^(click|fill|type|hover|scroll|focus|press|keyboard|mouse)/i,
    [CATEGORIES.SCREENSHOT]: /^(screenshot|capture)/i,
    [CATEGORIES.CONTENT]: /^(get|extract|getText|getHTML|getLinks|getImages|getPageContent|getTitle|getUrl|getMetadata|analyze)/i,
    [CATEGORIES.FORMS]: /^(form|fillForm|submitForm|analyzeForm)/i,
    [CATEGORIES.COOKIES]: /^(cookie|getCookie|setCookie|deleteCookie|get.*Cookie|clear.*Cookie)/i,
    [CATEGORIES.PROXY]: /^(proxy|setProxy|getProxyStatus|rotateProxy)/i,
    [CATEGORIES.USER_AGENT]: /^(userAgent|setUserAgent|getUserAgent|rotateUserAgent)/i,
    [CATEGORIES.PROFILES]: /^(profile|createProfile|loadProfile|deleteProfile|listProfile|getProfile|setProfile)/i,
    [CATEGORIES.JAVASCRIPT]: /^(execute|eval|runScript|getScript|runScript)/i,
    [CATEGORIES.DEVTOOLS]: /^(devtools|debug|console|logs|getConsole|getNetwork)/i,
    [CATEGORIES.STATUS]: /^(status|ping|health|getHealth|version|capabilities|info)/i,
    [CATEGORIES.SESSION]: /^(session|createSession|deleteSession|listSession|getSession|closeTab|createTab|switchTab)/i,
    [CATEGORIES.STORAGE]: /^(storage|local|session|clear|getStorage|setStorage)/i,
    [CATEGORIES.REQUEST_INTERCEPTION]: /^(intercept|block|blockRequest|allowRequest|getBlocking)/i,
    [CATEGORIES.FINGERPRINTING]: /^(fingerprint|spoof|canvas|webgl|webrtc|evasion)/i,
    [CATEGORIES.CREDENTIALS]: /^(credential|login|authenticate|auth|password)/i,
    [CATEGORIES.FORENSICS]: /^(forensic|extract|export|correlation|evidence|legal|compliance|tracking)/i,
    [CATEGORIES.DOM]: /^(dom|inspect|element|query|xpath|selector|querySelector)/i,
    [CATEGORIES.RECORDING]: /^(record|replay|session)/i
  };

  for (const [category, pattern] of Object.entries(patterns)) {
    if (pattern.test(commandName)) {
      return category;
    }
  }

  return 'Other';
}

/**
 * Get error codes for a specific command
 * @param {string} commandName - Command name
 * @returns {Array<string>} List of error codes that can occur
 */
function getCommandErrorCodes(commandName) {
  const commonErrors = ['INTERNAL_ERROR', 'BROWSER_NOT_READY'];

  const commandSpecificErrors = {
    navigate: ['INVALID_URL', 'TIMEOUT', 'NAVIGATION_FAILED'],
    navigateTo: ['INVALID_URL', 'TIMEOUT', 'NAVIGATION_FAILED'],
    click: ['ELEMENT_NOT_FOUND', 'TIMEOUT', 'INVALID_SELECTOR'],
    fill: ['ELEMENT_NOT_FOUND', 'TIMEOUT', 'INVALID_SELECTOR'],
    type: ['ELEMENT_NOT_FOUND', 'TIMEOUT'],
    hover: ['ELEMENT_NOT_FOUND', 'TIMEOUT', 'INVALID_SELECTOR'],
    scroll: ['TIMEOUT'],
    screenshot: ['SCREENSHOT_FAILED', 'TIMEOUT'],
    executeScript: ['SCRIPT_ERROR', 'TIMEOUT'],
    getPageContent: ['TIMEOUT'],
    getText: ['ELEMENT_NOT_FOUND', 'TIMEOUT', 'INVALID_SELECTOR'],
    getHTML: ['ELEMENT_NOT_FOUND', 'TIMEOUT', 'INVALID_SELECTOR'],
    createProfile: ['PROFILE_LOAD_FAILED'],
    loadProfile: ['PROFILE_NOT_FOUND', 'PROFILE_LOAD_FAILED'],
    deleteProfile: ['PROFILE_NOT_FOUND'],
    setProxy: ['INVALID_PROXY', 'PROXY_CONNECTION_FAILED'],
    getCookies: ['STORAGE_ERROR'],
    setCookie: ['STORAGE_ERROR'],
    login: ['INVALID_CREDENTIALS', 'TIMEOUT'],
    getHealth: [],
    status: [],
    ping: []
  };

  return [...(commandSpecificErrors[commandName] || []), ...commonErrors];
}

/**
 * Get recovery hints for a specific command
 * @param {string} commandName - Command name
 * @returns {Object} Map of error codes to recovery hints
 */
function getCommandRecoveryHints(commandName) {
  const hints = {};
  const errorCodes = getCommandErrorCodes(commandName);

  errorCodes.forEach(code => {
    if (ERROR_CODES[code]) {
      hints[code] = ERROR_CODES[code].recoveryHint;
    }
  });

  return hints;
}

/**
 * Get example requests for a command
 * @param {string} commandName - Command name
 * @returns {Array<Object>} Array of example objects
 */
function getCommandExamples(commandName) {
  const examples = {
    navigate: [
      { description: 'Navigate to Google', request: { url: 'https://google.com' } },
      { description: 'Navigate with custom timeout', request: { url: 'https://example.com', timeout: 60000 } },
      { description: 'Wait for network idle', request: { url: 'https://example.com', waitUntil: 'networkidle2' } }
    ],
    navigateTo: [
      { description: 'Navigate to a website', request: { url: 'https://example.com' } }
    ],
    click: [
      { description: 'Click a button', request: { selector: 'button.submit' } },
      { description: 'Click with delay', request: { selector: 'button.submit', delay: 500 } },
      { description: 'Right click', request: { selector: '.element', button: 'right' } }
    ],
    fill: [
      { description: 'Fill email field', request: { selector: 'input[type=email]', text: 'user@example.com' } },
      { description: 'Fill with delay between keys', request: { selector: 'input', text: 'password123', delay: 100 } }
    ],
    screenshot: [
      { description: 'Full page screenshot', request: { fullPage: true } },
      { description: 'Viewport screenshot', request: { fullPage: false } },
      { description: 'High quality JPEG', request: { format: 'jpeg', quality: 95 } }
    ],
    getText: [
      { description: 'Get all page text', request: {} },
      { description: 'Get text from element', request: { selector: '.content' } },
      { description: 'Include hidden text', request: { includeHidden: true } }
    ],
    getHTML: [
      { description: 'Get full page HTML', request: {} },
      { description: 'Get element HTML', request: { selector: '.container' } }
    ],
    getLinks: [
      { description: 'Get all links', request: { filter: 'all' } },
      { description: 'Get internal links only', request: { filter: 'internal' } }
    ],
    getHealth: [
      { description: 'Check browser health', request: {} }
    ],
    status: [
      { description: 'Get browser status', request: {} }
    ],
    ping: [
      { description: 'Ping the browser', request: {} }
    ]
  };

  return examples[commandName] || [];
}

/**
 * Get all commands organized by category
 * @returns {Object} Map of categories to command arrays
 */
function getCommandsByCategory() {
  const grouped = {};
  const enriched = enrichCommandMetadata();

  Object.entries(enriched).forEach(([, cmd]) => {
    const cat = cmd.category;
    if (!grouped[cat]) {
      grouped[cat] = [];
    }
    grouped[cat].push({
      command: cmd.command,
      description: cmd.description
    });
  });

  return grouped;
}

/**
 * Get command details
 * @param {string} commandName - Command name
 * @returns {Object|null} Complete command metadata or null if not found
 */
function getCommand(commandName) {
  const schema = COMMAND_SCHEMAS[commandName];
  if (!schema) {
    return null;
  }

  return {
    command: schema.command,
    category: categorizeCommand(schema.command),
    description: schema.description,
    required: schema.required || [],
    parameters: schema.properties || {},
    errorCodes: getCommandErrorCodes(schema.command),
    recoveryHints: getCommandRecoveryHints(schema.command),
    examples: getCommandExamples(schema.command)
  };
}

/**
 * Get error details and recovery hints
 * @param {string} errorCode - Error code
 * @returns {Object|null} Error details or null if not found
 */
function getError(errorCode) {
  const error = ERROR_CODES[errorCode];
  if (!error) {
    return null;
  }

  return {
    errorCode,
    description: error.description,
    recoveryHint: error.recoveryHint,
    relatedErrors: error.relatedErrors
  };
}

/**
 * Search for commands by keyword
 * @param {string} keyword - Search term
 * @returns {Array<Object>} Matching commands
 */
function searchCommands(keyword) {
  const lowerKeyword = keyword.toLowerCase();
  const enriched = enrichCommandMetadata();
  const results = [];

  Object.values(enriched).forEach(cmd => {
    if (cmd.command.toLowerCase().includes(lowerKeyword) ||
        cmd.description.toLowerCase().includes(lowerKeyword) ||
        cmd.category.toLowerCase().includes(lowerKeyword)) {
      results.push({
        command: cmd.command,
        description: cmd.description,
        category: cmd.category
      });
    }
  });

  return results;
}

/**
 * Get all commands as a simple list
 * @returns {Array<Object>} List of all commands with basic info
 */
function getAllCommands() {
  return getAllCommandNames().map(name => {
    const cmd = getCommand(name);
    return {
      command: cmd.command,
      description: cmd.description,
      category: cmd.category
    };
  });
}

/**
 * Validate command parameters
 * @param {string} commandName - Command name
 * @param {Object} params - Parameters to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
function validateCommandParameters(commandName, params = {}) {
  const schema = COMMAND_SCHEMAS[commandName];
  if (!schema) {
    return {
      valid: false,
      errors: [`Unknown command: ${commandName}`]
    };
  }

  const errors = [];

  // Check required parameters
  if (schema.required) {
    schema.required.forEach(paramName => {
      if (!(paramName in params)) {
        errors.push(`Missing required parameter: ${paramName}`);
      }
    });
  }

  // Validate parameter types
  if (schema.properties) {
    Object.entries(params).forEach(([paramName, value]) => {
      const paramDef = schema.properties[paramName];
      if (!paramDef) {
        return; // Allow extra parameters
      }

      // Type checking
      if (paramDef.type && value !== null && value !== undefined) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== paramDef.type) {
          errors.push(`Parameter ${paramName} should be ${paramDef.type}, got ${actualType}`);
        }
      }

      // Enum validation
      if (paramDef.enum && !paramDef.enum.includes(value)) {
        errors.push(`Parameter ${paramName} must be one of: ${paramDef.enum.join(', ')}`);
      }

      // Min/max validation
      if (paramDef.minimum !== undefined && value < paramDef.minimum) {
        errors.push(`Parameter ${paramName} must be >= ${paramDef.minimum}`);
      }
      if (paramDef.maximum !== undefined && value > paramDef.maximum) {
        errors.push(`Parameter ${paramName} must be <= ${paramDef.maximum}`);
      }

      // String length validation
      if (typeof value === 'string') {
        if (paramDef.minLength !== undefined && value.length < paramDef.minLength) {
          errors.push(`Parameter ${paramName} must have length >= ${paramDef.minLength}`);
        }
        if (paramDef.maxLength !== undefined && value.length > paramDef.maxLength) {
          errors.push(`Parameter ${paramName} must have length <= ${paramDef.maxLength}`);
        }
        if (paramDef.pattern && !new RegExp(paramDef.pattern).test(value)) {
          errors.push(`Parameter ${paramName} must match pattern: ${paramDef.pattern}`);
        }
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get registry statistics
 * @returns {Object} Statistics about the command registry
 */
function getRegistryStats() {
  const allCommands = getAllCommands();
  const byCategory = getCommandsByCategory();

  return {
    totalCommands: allCommands.length,
    totalCategories: Object.keys(byCategory).length,
    categories: Object.entries(byCategory).reduce((acc, [cat, cmds]) => {
      acc[cat] = cmds.length;
      return acc;
    }, {}),
    totalErrorCodes: Object.keys(ERROR_CODES).length
  };
}

module.exports = {
  // Core API
  getCommand,
  getError,
  getAllCommands,
  getCommandsByCategory,
  searchCommands,
  validateCommandParameters,

  // Registry info
  getRegistryStats,
  CATEGORIES,
  ERROR_CODES,

  // Internal helpers
  categorizeCommand,
  getCommandErrorCodes,
  getCommandRecoveryHints,
  getCommandExamples,
  enrichCommandMetadata
};
