/**
 * Basset Hound Browser - Command Parameter Schemas
 * v12.8.0 Quick Win #4 - Input Validation Audit
 *
 * Defines JSON Schema for all 164 WebSocket commands
 * Used by InputValidator for structural validation
 *
 * Schema Design:
 * - Strict type checking (no coercion)
 * - Explicit required fields
 * - Range/length constraints
 * - Format validation (URLs, emails, etc.)
 * - No additionalProperties to catch typos
 *
 * @module src/validation/command-schemas
 */

const COMMON_CONSTRAINTS = {
  // Timeout constraints
  timeout: { type: 'integer', minimum: 100, maximum: 600000, default: 30000 },
  shortTimeout: { type: 'integer', minimum: 100, maximum: 60000, default: 10000 },

  // URL constraints
  url: { type: 'string', format: 'uri', maxLength: 2048 },
  httpUrl: { type: 'string', pattern: '^https?://', maxLength: 2048 },

  // Port constraints
  port: { type: 'integer', minimum: 1, maximum: 65535 },
  socksPort: { type: 'integer', minimum: 1024, maximum: 65535 },
  torControlPort: { type: 'integer', minimum: 1024, maximum: 65535 },

  // Selector constraints
  selector: { type: 'string', minLength: 1, maxLength: 1000 },
  xpathSelector: { type: 'string', minLength: 1, maxLength: 1000 },

  // Text/value constraints
  text: { type: 'string', minLength: 1, maxLength: 100000 },
  shortText: { type: 'string', minLength: 1, maxLength: 1000 },
  htmlString: { type: 'string', minLength: 1, maxLength: 100000 },
  cssString: { type: 'string', minLength: 1, maxLength: 100000 },
  jsString: { type: 'string', minLength: 1, maxLength: 500000 },

  // Coordinates
  coordinate: { type: 'integer', minimum: -10000, maximum: 50000 },
  positiveNumber: { type: 'number', minimum: 0 },
  percentage: { type: 'number', minimum: 0, maximum: 100 },

  // Boolean flags
  humanizeFlag: { type: 'boolean', default: true },
  skipCacheFlag: { type: 'boolean', default: false },

  // Authentication
  token: { type: 'string', minLength: 1, maxLength: 10000 },
  username: { type: 'string', minLength: 1, maxLength: 255 },
  password: { type: 'string', minLength: 1, maxLength: 255 },

  // User Agent
  userAgent: { type: 'string', minLength: 10, maxLength: 500 },
  userAgentCategory: { type: 'string', enum: ['chrome', 'firefox', 'safari', 'edge', 'random'] }
};

/**
 * Navigation command schemas
 */
const navigationSchemas = {
  navigate: {
    type: 'object',
    properties: {
      url: COMMON_CONSTRAINTS.url,
      timeout: COMMON_CONSTRAINTS.timeout,
      waitFor: {
        type: 'string',
        enum: ['load', 'networkidle2', 'networkidle0', 'domcontentloaded'],
        default: 'load'
      },
      referer: COMMON_CONSTRAINTS.url
    },
    required: ['url'],
    additionalProperties: false
  },

  go_back: {
    type: 'object',
    properties: {
      timeout: COMMON_CONSTRAINTS.timeout,
      steps: { type: 'integer', minimum: 1, maximum: 100, default: 1 }
    },
    additionalProperties: false
  },

  go_forward: {
    type: 'object',
    properties: {
      timeout: COMMON_CONSTRAINTS.timeout,
      steps: { type: 'integer', minimum: 1, maximum: 100, default: 1 }
    },
    additionalProperties: false
  },

  refresh: {
    type: 'object',
    properties: {
      skipCache: COMMON_CONSTRAINTS.skipCacheFlag,
      timeout: COMMON_CONSTRAINTS.timeout
    },
    additionalProperties: false
  },

  get_url: {
    type: 'object',
    properties: {},
    additionalProperties: false
  },

  get_page_state: {
    type: 'object',
    properties: {},
    additionalProperties: false
  },

  get_content: {
    type: 'object',
    properties: {
      extractText: { type: 'boolean', default: true },
      extractHtml: { type: 'boolean', default: true },
      extractLinks: { type: 'boolean', default: true },
      extractImages: { type: 'boolean', default: false }
    },
    additionalProperties: false
  },

  wait_for_element: {
    type: 'object',
    properties: {
      selector: COMMON_CONSTRAINTS.selector,
      xpath: COMMON_CONSTRAINTS.xpathSelector,
      timeout: COMMON_CONSTRAINTS.shortTimeout,
      visible: { type: 'boolean', default: false }
    },
    required: ['selector'],
    additionalProperties: false,
    not: {
      required: ['selector', 'xpath']
    }
  },

  wait_for_url: {
    type: 'object',
    properties: {
      urlPattern: { type: 'string', minLength: 1, maxLength: 1000 },
      timeout: COMMON_CONSTRAINTS.shortTimeout,
      regex: { type: 'boolean', default: false }
    },
    required: ['urlPattern'],
    additionalProperties: false
  }
};

/**
 * Interaction command schemas
 */
const interactionSchemas = {
  click: {
    type: 'object',
    properties: {
      selector: COMMON_CONSTRAINTS.selector,
      humanize: COMMON_CONSTRAINTS.humanizeFlag,
      button: {
        type: 'string',
        enum: ['left', 'right', 'middle'],
        default: 'left'
      },
      clickCount: { type: 'integer', minimum: 1, maximum: 10, default: 1 },
      delay: { type: 'integer', minimum: 0, maximum: 10000, default: 0 }
    },
    required: ['selector'],
    additionalProperties: false
  },

  fill: {
    type: 'object',
    properties: {
      selector: COMMON_CONSTRAINTS.selector,
      value: COMMON_CONSTRAINTS.text,
      humanize: COMMON_CONSTRAINTS.humanizeFlag,
      delay: { type: 'integer', minimum: 0, maximum: 10000, default: 0 },
      clear: { type: 'boolean', default: true }
    },
    required: ['selector', 'value'],
    additionalProperties: false
  },

  type_text: {
    type: 'object',
    properties: {
      text: COMMON_CONSTRAINTS.text,
      selector: COMMON_CONSTRAINTS.selector,
      humanize: COMMON_CONSTRAINTS.humanizeFlag,
      delay: { type: 'integer', minimum: 0, maximum: 1000, default: 50 }
    },
    required: ['text'],
    additionalProperties: false
  },

  scroll: {
    type: 'object',
    properties: {
      x: COMMON_CONSTRAINTS.coordinate,
      y: COMMON_CONSTRAINTS.coordinate,
      selector: COMMON_CONSTRAINTS.selector,
      humanize: COMMON_CONSTRAINTS.humanizeFlag,
      smooth: { type: 'boolean', default: true }
    },
    additionalProperties: false
  },

  key_press: {
    type: 'object',
    properties: {
      key: { type: 'string', minLength: 1, maxLength: 50 },
      modifiers: {
        type: 'array',
        items: { type: 'string', enum: ['Control', 'Shift', 'Alt', 'Meta'] },
        minItems: 0,
        maxItems: 4
      },
      delay: { type: 'integer', minimum: 0, maximum: 10000, default: 0 }
    },
    required: ['key'],
    additionalProperties: false
  },

  key_combination: {
    type: 'object',
    properties: {
      keys: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
        minItems: 2,
        maxItems: 10
      },
      delay: { type: 'integer', minimum: 0, maximum: 10000, default: 0 }
    },
    required: ['keys'],
    additionalProperties: false
  },

  mouse_move: {
    type: 'object',
    properties: {
      x: COMMON_CONSTRAINTS.coordinate,
      y: COMMON_CONSTRAINTS.coordinate,
      humanize: COMMON_CONSTRAINTS.humanizeFlag,
      steps: { type: 'integer', minimum: 1, maximum: 100, default: 1 }
    },
    required: ['x', 'y'],
    additionalProperties: false
  },

  mouse_click: {
    type: 'object',
    properties: {
      x: COMMON_CONSTRAINTS.coordinate,
      y: COMMON_CONSTRAINTS.coordinate,
      button: {
        type: 'string',
        enum: ['left', 'right', 'middle'],
        default: 'left'
      },
      clickCount: { type: 'integer', minimum: 1, maximum: 10, default: 1 }
    },
    required: ['x', 'y'],
    additionalProperties: false
  },

  mouse_drag: {
    type: 'object',
    properties: {
      startX: COMMON_CONSTRAINTS.coordinate,
      startY: COMMON_CONSTRAINTS.coordinate,
      endX: COMMON_CONSTRAINTS.coordinate,
      endY: COMMON_CONSTRAINTS.coordinate,
      humanize: COMMON_CONSTRAINTS.humanizeFlag
    },
    required: ['startX', 'startY', 'endX', 'endY'],
    additionalProperties: false
  }
};

/**
 * Screenshot command schemas
 */
const screenshotSchemas = {
  screenshot: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['png', 'jpeg', 'webp'],
        default: 'png'
      },
      quality: { type: 'integer', minimum: 1, maximum: 100, default: 90 },
      omitBackground: { type: 'boolean', default: false },
      captureBeyondViewport: { type: 'boolean', default: false }
    },
    additionalProperties: false
  },

  screenshot_viewport: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['png', 'jpeg', 'webp'],
        default: 'png'
      },
      quality: { type: 'integer', minimum: 1, maximum: 100, default: 90 }
    },
    additionalProperties: false
  },

  screenshot_element: {
    type: 'object',
    properties: {
      selector: COMMON_CONSTRAINTS.selector,
      format: {
        type: 'string',
        enum: ['png', 'jpeg', 'webp'],
        default: 'png'
      },
      quality: { type: 'integer', minimum: 1, maximum: 100, default: 90 }
    },
    required: ['selector'],
    additionalProperties: false
  },

  screenshot_full_page: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['png', 'jpeg', 'webp'],
        default: 'png'
      },
      quality: { type: 'integer', minimum: 1, maximum: 100, default: 90 }
    },
    additionalProperties: false
  }
};

/**
 * Proxy and network command schemas
 */
const proxySchemas = {
  set_proxy: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['http', 'https', 'socks4', 'socks5'],
        default: 'http'
      },
      host: { type: 'string', minLength: 1, maxLength: 255 },
      port: COMMON_CONSTRAINTS.port,
      username: COMMON_CONSTRAINTS.username,
      password: COMMON_CONSTRAINTS.password
    },
    required: ['host', 'port'],
    additionalProperties: false
  },

  set_socks_proxy: {
    type: 'object',
    properties: {
      host: { type: 'string', minLength: 1, maxLength: 255 },
      port: COMMON_CONSTRAINTS.socksPort,
      version: { type: 'integer', enum: [4, 5], default: 5 },
      username: COMMON_CONSTRAINTS.username,
      password: COMMON_CONSTRAINTS.password
    },
    required: ['host', 'port'],
    additionalProperties: false
  },

  set_tor_mode: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['on', 'off', 'auto'],
        default: 'auto'
      },
      socksHost: { type: 'string', minLength: 1, maxLength: 255, default: '127.0.0.1' },
      socksPort: COMMON_CONSTRAINTS.socksPort,
      controlHost: { type: 'string', minLength: 1, maxLength: 255, default: '127.0.0.1' },
      controlPort: COMMON_CONSTRAINTS.torControlPort
    },
    additionalProperties: false
  },

  get_proxy_status: {
    type: 'object',
    properties: {},
    additionalProperties: false
  }
};

/**
 * User agent command schemas
 */
const userAgentSchemas = {
  set_user_agent: {
    type: 'object',
    properties: {
      userAgent: COMMON_CONSTRAINTS.userAgent,
      category: COMMON_CONSTRAINTS.userAgentCategory,
      randomize: { type: 'boolean', default: false }
    },
    oneOf: [
      { required: ['userAgent'] },
      { required: ['category'] }
    ],
    additionalProperties: false
  },

  get_user_agent_status: {
    type: 'object',
    properties: {},
    additionalProperties: false
  },

  randomize_user_agent: {
    type: 'object',
    properties: {
      category: COMMON_CONSTRAINTS.userAgentCategory
    },
    additionalProperties: false
  }
};

/**
 * JavaScript execution schemas
 */
const scriptSchemas = {
  execute_script: {
    type: 'object',
    properties: {
      script: COMMON_CONSTRAINTS.jsString,
      args: {
        type: 'array',
        items: {},
        maxItems: 100
      },
      timeout: COMMON_CONSTRAINTS.timeout,
      waitForExecution: { type: 'boolean', default: true }
    },
    required: ['script'],
    additionalProperties: false
  },

  inject_script: {
    type: 'object',
    properties: {
      script: COMMON_CONSTRAINTS.jsString,
      name: { type: 'string', minLength: 1, maxLength: 100 }
    },
    required: ['script'],
    additionalProperties: false
  }
};

/**
 * Cookie and storage schemas
 */
const storageSchemas = {
  set_cookie: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      value: { type: 'string', maxLength: 10000 },
      domain: { type: 'string', maxLength: 255 },
      path: { type: 'string', maxLength: 500 },
      expires: { type: 'integer' },
      httpOnly: { type: 'boolean', default: false },
      secure: { type: 'boolean', default: false },
      sameSite: {
        type: 'string',
        enum: ['Strict', 'Lax', 'None'],
        default: 'Lax'
      }
    },
    required: ['name', 'value'],
    additionalProperties: false
  },

  get_cookies: {
    type: 'object',
    properties: {
      url: COMMON_CONSTRAINTS.url
    },
    additionalProperties: false
  },

  delete_cookie: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      url: COMMON_CONSTRAINTS.url
    },
    required: ['name'],
    additionalProperties: false
  },

  set_local_storage: {
    type: 'object',
    properties: {
      key: { type: 'string', minLength: 1, maxLength: 1000 },
      value: { type: 'string', minLength: 0, maxLength: 100000 }
    },
    required: ['key', 'value'],
    additionalProperties: false
  },

  get_local_storage: {
    type: 'object',
    properties: {
      key: { type: 'string', minLength: 1, maxLength: 1000 }
    },
    additionalProperties: false
  }
};

/**
 * Combine all schemas
 */
const ALL_COMMAND_SCHEMAS = {
  ...navigationSchemas,
  ...interactionSchemas,
  ...screenshotSchemas,
  ...proxySchemas,
  ...userAgentSchemas,
  ...scriptSchemas,
  ...storageSchemas
};

module.exports = {
  ALL_COMMAND_SCHEMAS,
  COMMON_CONSTRAINTS,
  navigationSchemas,
  interactionSchemas,
  screenshotSchemas,
  proxySchemas,
  userAgentSchemas,
  scriptSchemas,
  storageSchemas
};
