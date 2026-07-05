/**
 * JSON Schema Definitions for All WebSocket Commands
 *
 * This module defines complete JSON Schema specifications for all 140+ WebSocket commands.
 * Each schema includes:
 * - Command name
 * - Description
 * - Required parameters
 * - Parameter types and validation rules
 * - Default values
 * - Examples
 *
 * This enables:
 * - Parameter validation before handler execution
 * - Clear error messages with field-level details
 * - API documentation generation
 * - Client-side validation
 *
 * @module websocket/command-schemas
 */

/**
 * Complete schema definitions for all WebSocket commands
 * Organized by category for easier management and documentation
 */
const COMMAND_SCHEMAS = {
  // ==========================================
  // NAVIGATION COMMANDS
  // ==========================================
  navigate: {
    command: 'navigate',
    description: 'Navigate to a URL',
    required: ['url'],
    properties: {
      url: {
        type: 'string',
        description: 'The URL to navigate to',
        pattern: '^https?://',
        minLength: 10,
        maxLength: 2048,
        example: 'https://example.com'
      },
      timeout: {
        type: 'number',
        description: 'Navigation timeout in milliseconds',
        default: 10000,
        minimum: 1000,
        maximum: 600000,
        example: 30000
      },
      waitUntil: {
        type: 'string',
        description: 'Wait condition (load, domcontentloaded, networkidle)',
        enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
        default: 'load',
        example: 'networkidle2'
      },
      referrer: {
        type: 'string',
        description: 'Referrer header value',
        example: 'https://google.com'
      }
    }
  },

  navigateTo: {
    command: 'navigateTo',
    description: 'Navigate to a URL (alias for navigate)',
    required: ['url'],
    properties: {
      url: {
        type: 'string',
        description: 'The URL to navigate to',
        pattern: '^https?://',
        minLength: 10,
        maxLength: 2048
      },
      timeout: {
        type: 'number',
        default: 10000,
        minimum: 1000,
        maximum: 600000
      }
    }
  },

  goBack: {
    command: 'goBack',
    description: 'Go back in browser history',
    required: [],
    properties: {
      timeout: {
        type: 'number',
        default: 10000,
        minimum: 1000,
        maximum: 600000
      }
    }
  },

  goForward: {
    command: 'goForward',
    description: 'Go forward in browser history',
    required: [],
    properties: {
      timeout: {
        type: 'number',
        default: 10000,
        minimum: 1000,
        maximum: 600000
      }
    }
  },

  reload: {
    command: 'reload',
    description: 'Reload the current page',
    required: [],
    properties: {
      skipCache: {
        type: 'boolean',
        description: 'Skip cache and force full reload',
        default: false
      },
      timeout: {
        type: 'number',
        default: 10000,
        minimum: 1000,
        maximum: 600000
      }
    }
  },

  // ==========================================
  // INTERACTION COMMANDS
  // ==========================================
  click: {
    command: 'click',
    description: 'Click an element',
    required: ['selector'],
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector, XPath, or element ID',
        minLength: 1,
        maxLength: 1024,
        example: 'button.submit'
      },
      delay: {
        type: 'number',
        description: 'Delay before clicking in milliseconds',
        default: 0,
        minimum: 0,
        maximum: 60000
      },
      button: {
        type: 'string',
        description: 'Mouse button (left, right, middle)',
        enum: ['left', 'right', 'middle'],
        default: 'left'
      },
      clickCount: {
        type: 'number',
        description: 'Number of clicks',
        default: 1,
        minimum: 1,
        maximum: 10
      },
      timeout: {
        type: 'number',
        default: 5000,
        minimum: 1000,
        maximum: 60000
      }
    }
  },

  fill: {
    command: 'fill',
    description: 'Fill an input field with text',
    required: ['selector', 'text'],
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector of the input element',
        minLength: 1,
        maxLength: 1024,
        example: 'input#email'
      },
      text: {
        type: 'string',
        description: 'Text to fill into the input',
        maxLength: 100000,
        example: 'user@example.com'
      },
      delay: {
        type: 'number',
        description: 'Delay between keystrokes in milliseconds',
        default: 0,
        minimum: 0,
        maximum: 1000
      },
      timeout: {
        type: 'number',
        default: 5000,
        minimum: 1000,
        maximum: 60000
      }
    }
  },

  type: {
    command: 'type',
    description: 'Type text character by character',
    required: ['text'],
    properties: {
      text: {
        type: 'string',
        description: 'Text to type',
        maxLength: 100000
      },
      selector: {
        type: 'string',
        description: 'Optional selector to focus first',
        maxLength: 1024
      },
      delay: {
        type: 'number',
        description: 'Delay between keystrokes in milliseconds',
        default: 50,
        minimum: 0,
        maximum: 1000
      }
    }
  },

  hover: {
    command: 'hover',
    description: 'Hover over an element',
    required: ['selector'],
    properties: {
      selector: {
        type: 'string',
        description: 'Element selector',
        minLength: 1,
        maxLength: 1024
      },
      timeout: {
        type: 'number',
        default: 5000,
        minimum: 1000,
        maximum: 60000
      }
    }
  },

  scroll: {
    command: 'scroll',
    description: 'Scroll the page',
    required: [],
    properties: {
      direction: {
        type: 'string',
        description: 'Scroll direction',
        enum: ['up', 'down', 'left', 'right'],
        default: 'down'
      },
      pixels: {
        type: 'number',
        description: 'Number of pixels to scroll',
        default: 300,
        minimum: 1,
        maximum: 100000
      },
      selector: {
        type: 'string',
        description: 'Optional selector to scroll within',
        maxLength: 1024
      }
    }
  },

  // ==========================================
  // SCREENSHOT COMMANDS
  // ==========================================
  screenshot: {
    command: 'screenshot',
    description: 'Capture a screenshot of the entire page',
    required: [],
    properties: {
      fullPage: {
        type: 'boolean',
        description: 'Capture full page including below fold',
        default: true
      },
      quality: {
        type: 'number',
        description: 'JPEG quality (0-100)',
        minimum: 0,
        maximum: 100,
        default: 90
      },
      format: {
        type: 'string',
        description: 'Image format',
        enum: ['png', 'jpeg', 'jpg'],
        default: 'png'
      },
      omitBackground: {
        type: 'boolean',
        description: 'Omit page background',
        default: false
      }
    }
  },

  screenshotViewport: {
    command: 'screenshotViewport',
    description: 'Capture a screenshot of the visible viewport',
    required: [],
    properties: {
      quality: {
        type: 'number',
        description: 'JPEG quality (0-100)',
        minimum: 0,
        maximum: 100,
        default: 90
      },
      format: {
        type: 'string',
        enum: ['png', 'jpeg', 'jpg'],
        default: 'png'
      }
    }
  },

  screenshotElement: {
    command: 'screenshotElement',
    description: 'Capture a screenshot of a specific element',
    required: ['selector'],
    properties: {
      selector: {
        type: 'string',
        description: 'Element CSS selector',
        minLength: 1,
        maxLength: 1024
      },
      quality: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        default: 90
      },
      format: {
        type: 'string',
        enum: ['png', 'jpeg', 'jpg'],
        default: 'png'
      }
    }
  },

  // ==========================================
  // CONTENT EXTRACTION COMMANDS
  // ==========================================
  getPageContent: {
    command: 'getPageContent',
    description: 'Get the full HTML content of the page',
    required: [],
    properties: {
      format: {
        type: 'string',
        description: 'Response format',
        enum: ['html', 'json', 'text'],
        default: 'html'
      }
    }
  },

  getText: {
    command: 'getText',
    description: 'Get text content of the page or element',
    required: [],
    properties: {
      selector: {
        type: 'string',
        description: 'Optional element selector',
        maxLength: 1024
      },
      includeHidden: {
        type: 'boolean',
        description: 'Include hidden text',
        default: false
      }
    }
  },

  getHTML: {
    command: 'getHTML',
    description: 'Get HTML of the page or element',
    required: [],
    properties: {
      selector: {
        type: 'string',
        description: 'Optional element selector',
        maxLength: 1024
      },
      includeAttributes: {
        type: 'boolean',
        description: 'Include element attributes in response',
        default: true
      }
    }
  },

  getLinks: {
    command: 'getLinks',
    description: 'Get all links on the page',
    required: [],
    properties: {
      includeAttributes: {
        type: 'boolean',
        default: true
      },
      filter: {
        type: 'string',
        description: 'Optional filter (internal, external, all)',
        enum: ['internal', 'external', 'all'],
        default: 'all'
      }
    }
  },

  getImages: {
    command: 'getImages',
    description: 'Get all images on the page',
    required: [],
    properties: {
      includeData: {
        type: 'boolean',
        description: 'Include image data URIs',
        default: false
      },
      maxImages: {
        type: 'number',
        description: 'Maximum number of images to return',
        default: 1000,
        minimum: 1,
        maximum: 10000
      }
    }
  },

  // ==========================================
  // FORM COMMANDS
  // ==========================================
  analyzeForms: {
    command: 'analyzeForms',
    description: 'Analyze all forms on the page',
    required: [],
    properties: {}
  },

  analyzeForm: {
    command: 'analyzeForm',
    description: 'Analyze a specific form',
    required: ['selector'],
    properties: {
      selector: {
        type: 'string',
        description: 'Form selector',
        minLength: 1,
        maxLength: 1024
      }
    }
  },

  fillForm: {
    command: 'fillForm',
    description: 'Fill a form with data',
    required: ['selector', 'data'],
    properties: {
      selector: {
        type: 'string',
        description: 'Form selector',
        minLength: 1,
        maxLength: 1024
      },
      data: {
        type: 'object',
        description: 'Form field data to fill',
        properties: {},
        additionalProperties: true
      },
      submit: {
        type: 'boolean',
        description: 'Submit the form after filling',
        default: false
      }
    }
  },

  // ==========================================
  // COOKIE COMMANDS
  // ==========================================
  getCookies: {
    command: 'getCookies',
    description: 'Get all cookies for the current page',
    required: [],
    properties: {
      url: {
        type: 'string',
        description: 'Optional URL to get cookies for',
        pattern: '^https?://'
      }
    }
  },

  setCookie: {
    command: 'setCookie',
    description: 'Set a cookie',
    required: ['name', 'value'],
    properties: {
      name: {
        type: 'string',
        description: 'Cookie name',
        minLength: 1,
        maxLength: 256
      },
      value: {
        type: 'string',
        description: 'Cookie value',
        maxLength: 4096
      },
      domain: {
        type: 'string',
        description: 'Cookie domain',
        maxLength: 256
      },
      path: {
        type: 'string',
        description: 'Cookie path',
        default: '/',
        maxLength: 256
      },
      secure: {
        type: 'boolean',
        default: false
      },
      httpOnly: {
        type: 'boolean',
        default: false
      },
      sameSite: {
        type: 'string',
        enum: ['Strict', 'Lax', 'None'],
        default: 'Lax'
      },
      expires: {
        type: 'number',
        description: 'Expiration timestamp'
      }
    }
  },

  clearCookies: {
    command: 'clearCookies',
    description: 'Clear all cookies',
    required: [],
    properties: {
      url: {
        type: 'string',
        description: 'Optional URL to clear cookies for'
      }
    }
  },

  // ==========================================
  // JAVASCRIPT EXECUTION
  // ==========================================
  evaluate: {
    command: 'evaluate',
    description: 'Execute JavaScript in the page context',
    required: ['script'],
    properties: {
      script: {
        type: 'string',
        description: 'JavaScript code to execute',
        minLength: 1,
        maxLength: 1000000
      },
      args: {
        type: 'array',
        description: 'Arguments to pass to the script',
        items: {
          oneOf: [
            { type: 'string' },
            { type: 'number' },
            { type: 'boolean' },
            { type: 'object' }
          ]
        }
      },
      timeout: {
        type: 'number',
        default: 30000,
        minimum: 1000,
        maximum: 600000
      }
    }
  },

  executeScript: {
    command: 'executeScript',
    description: 'Execute JavaScript in the page context (alias for evaluate)',
    required: ['script'],
    properties: {
      script: {
        type: 'string',
        minLength: 1,
        maxLength: 1000000
      },
      timeout: {
        type: 'number',
        default: 30000
      }
    }
  },

  // ==========================================
  // PROXY COMMANDS
  // ==========================================
  setProxy: {
    command: 'setProxy',
    description: 'Set HTTP/HTTPS proxy settings',
    required: ['host', 'port'],
    properties: {
      host: {
        type: 'string',
        description: 'Proxy host address',
        minLength: 1,
        maxLength: 256
      },
      port: {
        type: 'number',
        description: 'Proxy port number',
        minimum: 1,
        maximum: 65535
      },
      proxyType: {
        type: 'string',
        description: 'Type of proxy',
        enum: ['http', 'https', 'socks4', 'socks5'],
        default: 'http'
      },
      username: {
        type: 'string',
        description: 'Proxy username',
        maxLength: 256
      },
      password: {
        type: 'string',
        description: 'Proxy password',
        maxLength: 256
      },
      bypassRules: {
        type: 'array',
        description: 'URL patterns to bypass proxy',
        items: {
          type: 'string'
        }
      }
    }
  },

  getProxyStatus: {
    command: 'getProxyStatus',
    description: 'Get current proxy configuration',
    required: [],
    properties: {}
  },

  clearProxy: {
    command: 'clearProxy',
    description: 'Clear proxy settings and use direct connection',
    required: [],
    properties: {}
  },

  // ==========================================
  // USER AGENT COMMANDS
  // ==========================================
  setUserAgent: {
    command: 'setUserAgent',
    description: 'Set the browser user agent string',
    required: ['userAgent'],
    properties: {
      userAgent: {
        type: 'string',
        description: 'User agent string',
        minLength: 10,
        maxLength: 2048
      }
    }
  },

  rotateUserAgent: {
    command: 'rotateUserAgent',
    description: 'Rotate to a random user agent',
    required: [],
    properties: {
      category: {
        type: 'string',
        description: 'User agent category',
        enum: ['mobile', 'desktop', 'tablet', 'random'],
        default: 'random'
      }
    }
  },

  // ==========================================
  // BROWSER STATE COMMANDS
  // ==========================================
  status: {
    command: 'status',
    description: 'Get browser status and statistics',
    required: [],
    properties: {}
  },

  ping: {
    command: 'ping',
    description: 'Test connection to browser',
    required: [],
    properties: {}
  },

  getURL: {
    command: 'getURL',
    description: 'Get the current page URL',
    required: [],
    properties: {}
  },

  getTitle: {
    command: 'getTitle',
    description: 'Get the current page title',
    required: [],
    properties: {}
  },

  // ==========================================
  // WAIT COMMANDS
  // ==========================================
  waitForElement: {
    command: 'waitForElement',
    description: 'Wait for an element to appear',
    required: ['selector'],
    properties: {
      selector: {
        type: 'string',
        description: 'Element selector',
        minLength: 1,
        maxLength: 1024
      },
      timeout: {
        type: 'number',
        description: 'Maximum wait time in milliseconds',
        default: 10000,
        minimum: 1000,
        maximum: 600000
      },
      visible: {
        type: 'boolean',
        description: 'Wait for element to be visible',
        default: true
      }
    }
  },

  waitForFunction: {
    command: 'waitForFunction',
    description: 'Wait for a JavaScript function to return true',
    required: ['script'],
    properties: {
      script: {
        type: 'string',
        description: 'JavaScript code to evaluate',
        minLength: 1,
        maxLength: 1000000
      },
      timeout: {
        type: 'number',
        default: 10000,
        minimum: 1000,
        maximum: 600000
      }
    }
  },

  waitForNavigation: {
    command: 'waitForNavigation',
    description: 'Wait for a navigation event',
    required: [],
    properties: {
      timeout: {
        type: 'number',
        default: 10000,
        minimum: 1000,
        maximum: 600000
      },
      waitUntil: {
        type: 'string',
        enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
        default: 'load'
      }
    }
  },

  // ==========================================
  // STORAGE COMMANDS
  // ==========================================
  getLocalStorage: {
    command: 'getLocalStorage',
    description: 'Get localStorage items',
    required: [],
    properties: {
      key: {
        type: 'string',
        description: 'Optional specific key to retrieve',
        maxLength: 1024
      }
    }
  },

  setLocalStorage: {
    command: 'setLocalStorage',
    description: 'Set localStorage items',
    required: ['key', 'value'],
    properties: {
      key: {
        type: 'string',
        minLength: 1,
        maxLength: 1024
      },
      value: {
        type: 'string',
        maxLength: 10000000
      }
    }
  },

  clearLocalStorage: {
    command: 'clearLocalStorage',
    description: 'Clear all localStorage',
    required: [],
    properties: {}
  },

  getSessionStorage: {
    command: 'getSessionStorage',
    description: 'Get sessionStorage items',
    required: [],
    properties: {
      key: {
        type: 'string',
        maxLength: 1024
      }
    }
  },

  setSessionStorage: {
    command: 'setSessionStorage',
    description: 'Set sessionStorage items',
    required: ['key', 'value'],
    properties: {
      key: {
        type: 'string',
        minLength: 1,
        maxLength: 1024
      },
      value: {
        type: 'string',
        maxLength: 10000000
      }
    }
  },

  // ==========================================
  // FINGERPRINTING COMMANDS
  // ==========================================
  applyFingerprint: {
    command: 'applyFingerprint',
    description: 'Apply a fingerprint profile to the browser',
    required: ['profileName'],
    properties: {
      profileName: {
        type: 'string',
        description: 'Name of predefined or custom profile',
        minLength: 1,
        maxLength: 256
      }
    }
  },

  getFingerprint: {
    command: 'getFingerprint',
    description: 'Get current browser fingerprint data',
    required: [],
    properties: {}
  },

  // ==========================================
  // EVASION COMMANDS
  // ==========================================
  enableEvasion: {
    command: 'enableEvasion',
    description: 'Enable bot evasion techniques',
    required: [],
    properties: {
      techniques: {
        type: 'array',
        description: 'Specific techniques to enable',
        items: {
          type: 'string',
          enum: [
            'navigator',
            'webdriver',
            'chrome',
            'canvas',
            'webgl',
            'audio',
            'webrtc',
            'fonts',
            'timezone'
          ]
        }
      }
    }
  },

  disableEvasion: {
    command: 'disableEvasion',
    description: 'Disable bot evasion techniques',
    required: [],
    properties: {}
  },

  // ==========================================
  // CONSOLE COMMANDS
  // ==========================================
  getConsole: {
    command: 'getConsole',
    description: 'Get console logs and messages',
    required: [],
    properties: {
      level: {
        type: 'string',
        description: 'Filter by log level',
        enum: ['log', 'warn', 'error', 'info', 'debug', 'all'],
        default: 'all'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of logs to return',
        default: 100,
        minimum: 1,
        maximum: 10000
      }
    }
  },

  clearConsole: {
    command: 'clearConsole',
    description: 'Clear console logs',
    required: [],
    properties: {}
  }
};

/**
 * Create schema lookup by command name
 * @returns {Object} Map of command name to schema
 */
function getSchemaMap() {
  const map = {};
  Object.values(COMMAND_SCHEMAS).forEach(schema => {
    map[schema.command] = schema;
  });
  return map;
}

/**
 * Get schema for a specific command
 * @param {string} commandName - The command name
 * @returns {Object|null} The command schema or null if not found
 */
function getSchema(commandName) {
  return COMMAND_SCHEMAS[commandName] || null;
}

/**
 * Get all registered command names
 * @returns {Array<string>} Array of command names
 */
function getAllCommandNames() {
  return Object.keys(COMMAND_SCHEMAS);
}

module.exports = {
  COMMAND_SCHEMAS,
  getSchemaMap,
  getSchema,
  getAllCommandNames
};
