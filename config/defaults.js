/**
 * Basset Hound Browser - Default Configuration
 * All default values for configuration options organized by category
 */

/**
 * Server configuration defaults
 */
const serverDefaults = {
  // WebSocket server settings
  host: '127.0.0.1',
  port: 8765,

  // SSL/TLS settings
  ssl: {
    enabled: false,
    certPath: null,
    keyPath: null,
    caPath: null
  },

  // Authentication
  auth: {
    enabled: false,
    token: null,
    requireAuth: false
  },

  // Heartbeat settings
  heartbeat: {
    interval: 30000,  // 30 seconds
    timeout: 60000    // 60 seconds
  },

  // Error recovery settings
  errorRecovery: {
    maxRetries: 3,
    retryDelay: 1000  // Base delay in ms (exponential backoff applied)
  }
};

/**
 * Browser configuration defaults
 */
const browserDefaults = {
  // Window settings
  window: {
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    randomizeSize: true,
    randomizePosition: true
  },

  // Tab settings
  tabs: {
    maxTabs: 50,
    homePage: 'https://www.google.com',
    defaultTab: true
  },

  // Session recovery
  recovery: {
    enabled: true,
    autoSaveInterval: 30000,  // 30 seconds
    maxRecoveryAttempts: 3,
    stateVersion: 1
  },

  // DevTools settings
  devTools: {
    enabled: true,
    defaultMode: 'right'  // 'right', 'bottom', 'undocked', 'detach'
  },

  // Download settings
  downloads: {
    path: null,  // Will use system downloads folder
    askBeforeDownload: false,
    maxConcurrent: 5
  },

  // History settings
  history: {
    enabled: true,
    maxEntries: 10000,
    retentionDays: 90
  }
};

/**
 * Evasion/anti-detection configuration defaults
 */
const evasionDefaults = {
  // Fingerprint settings
  fingerprint: {
    enabled: true,
    randomize: true,
    persistPerSession: true
  },

  // User agent settings
  userAgent: {
    randomize: true,
    rotateOnNavigation: false,
    category: 'desktop'  // 'desktop', 'mobile', 'bot', 'random'
  },

  // WebGL settings
  webgl: {
    spoof: true,
    noise: true
  },

  // Canvas settings
  canvas: {
    noise: true,
    noiseFactor: 5  // 0-10
  },

  // Audio context settings
  audio: {
    noise: true,
    noiseFactor: 0.0001
  },

  // Hardware spoofing
  hardware: {
    spoof: true,
    concurrency: null,  // null = random between 4-16
    memory: null        // null = random between 4-32 GB
  },

  // Timezone spoofing
  timezone: {
    spoof: false,
    value: null  // null = system timezone
  },

  // Geolocation spoofing
  geolocation: {
    enabled: false,
    latitude: null,
    longitude: null,
    accuracy: 100
  },

  // Human behavior simulation
  humanize: {
    enabled: true,
    typing: {
      enabled: true,
      minDelay: 50,
      maxDelay: 150,
      mistakeRate: 0.02
    },
    mouse: {
      enabled: true,
      curvature: 0.5,
      speed: 1.0
    },
    scroll: {
      enabled: true,
      smoothness: 0.8
    }
  }
};

/**
 * Network configuration defaults
 */
const networkDefaults = {
  // Proxy settings
  proxy: {
    enabled: false,
    type: 'http',  // 'http', 'https', 'socks4', 'socks5'
    host: null,
    port: null,
    username: null,
    password: null,
    bypassList: ['localhost', '127.0.0.1']
  },

  // Tor settings
  tor: {
    enabled: false,
    socksPort: 9050,
    controlPort: 9051,
    dataDirectory: null
  },

  // Proxy chain settings
  proxyChain: {
    enabled: false,
    proxies: []
  },

  // Network throttling
  throttling: {
    enabled: false,
    preset: null,  // 'slow3G', 'fast3G', '4G', 'offline', etc.
    download: null,  // bytes per second
    upload: null,    // bytes per second
    latency: null    // milliseconds
  },

  // Request interception
  interception: {
    enabled: false,
    blockAds: false,
    blockTrackers: false,
    blockImages: false,
    customRules: []
  },

  // SSL/Certificate settings
  certificates: {
    ignoreCertificateErrors: true,
    clientCertificates: []
  },

  // Request headers
  headers: {
    customHeaders: {},
    removeHeaders: ['Sec-Ch-Ua-Platform'],
    acceptLanguage: 'en-US,en;q=0.9',
    acceptEncoding: 'gzip, deflate, br'
  }
};

/**
 * Logging configuration defaults
 */
const loggingDefaults = {
  // General logging
  level: 'info',  // 'error', 'warn', 'info', 'debug', 'trace'

  // Console logging
  console: {
    enabled: true,
    colorize: true,
    timestamp: true
  },

  // File logging
  file: {
    enabled: false,
    path: null,  // Will use userData/logs directory
    maxSize: '10m',
    maxFiles: 5,
    rotate: true
  },

  // Network logging
  network: {
    enabled: false,
    logRequests: true,
    logResponses: true,
    logHeaders: false,
    logBody: false
  },

  // Console capture (browser console)
  browserConsole: {
    capture: true,
    maxLogs: 1000,
    levels: ['error', 'warn', 'info', 'log']
  },

  // Performance logging
  performance: {
    enabled: false,
    metrics: true,
    timing: true
  }
};

/**
 * Automation configuration defaults
 */
const automationDefaults = {
  // Script execution
  scripts: {
    enabled: true,
    storagePath: null,  // Will use app directory
    timeout: 30000,
    sandboxed: true
  },

  // Recording
  recording: {
    enabled: true,
    format: 'webm',
    quality: 'high',
    fps: 30,
    maxDuration: 3600  // 1 hour
  },

  // Screenshots
  screenshots: {
    format: 'png',  // 'png', 'jpeg', 'webp'
    quality: 90,    // 1-100, for jpeg/webp
    path: null      // Will use app directory
  }
};

/**
 * Profile configuration defaults
 */
const profileDefaults = {
  // Profile management
  enabled: true,
  storagePath: null,  // Will use userData/profiles

  // Default profile settings
  defaultProfile: null,

  // Profile isolation
  isolation: {
    cookies: true,
    localStorage: true,
    sessionStorage: true,
    indexedDB: true,
    cache: true
  }
};

/**
 * Headless mode configuration defaults
 */
const headlessDefaults = {
  // Headless operation
  enabled: false,

  // GPU settings
  disableGpu: true,

  // Sandbox settings
  noSandbox: false,

  // Virtual display
  virtualDisplay: false,
  displaySize: '1920x1080',
  displayDepth: 24,

  // Offscreen rendering
  offscreenRendering: false,

  // Preset mode
  preset: null  // 'server', 'docker', 'ci', 'minimal'
};

/**
 * Memory management configuration defaults
 */
const memoryDefaults = {
  // Memory monitoring
  monitoring: {
    enabled: true,
    interval: 60000  // 60 seconds
  },

  // Memory thresholds (percentage of available memory)
  thresholds: {
    warning: 70,
    critical: 85,
    emergency: 95
  },

  // Automatic cleanup
  cleanup: {
    enabled: true,
    onWarning: false,
    onCritical: true,
    onEmergency: true
  },

  // Cache settings
  cache: {
    maxSize: null,  // null = auto
    clearOnMemoryPressure: true
  }
};

/**
 * Complete default configuration object
 */
const defaults = {
  server: serverDefaults,
  browser: browserDefaults,
  evasion: evasionDefaults,
  network: networkDefaults,
  logging: loggingDefaults,
  automation: automationDefaults,
  profiles: profileDefaults,
  headless: headlessDefaults,
  memory: memoryDefaults
};

module.exports = {
  defaults,
  serverDefaults,
  browserDefaults,
  evasionDefaults,
  networkDefaults,
  loggingDefaults,
  automationDefaults,
  profileDefaults,
  headlessDefaults,
  memoryDefaults
};
