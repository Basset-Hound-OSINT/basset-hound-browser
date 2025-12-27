/**
 * Basset Hound Browser - Configuration Schema
 * Defines all valid configuration options, types, validation rules, and default values
 */

const { defaults } = require('./defaults');

/**
 * Type definitions for validation
 */
const Types = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  ARRAY: 'array',
  OBJECT: 'object',
  NULL: 'null',
  ANY: 'any'
};

/**
 * Schema field definition
 * @param {Object} options - Field options
 * @returns {Object} Field schema
 */
function field(options) {
  return {
    type: options.type || Types.ANY,
    required: options.required || false,
    default: options.default,
    description: options.description || '',
    enum: options.enum || null,
    min: options.min,
    max: options.max,
    pattern: options.pattern,
    items: options.items,  // For arrays
    properties: options.properties,  // For objects
    validate: options.validate,  // Custom validation function
    deprecated: options.deprecated || false,
    deprecatedMessage: options.deprecatedMessage || ''
  };
}

/**
 * Configuration schema definition
 */
const schema = {
  // Server configuration
  server: field({
    type: Types.OBJECT,
    description: 'WebSocket server configuration',
    properties: {
      host: field({
        type: Types.STRING,
        default: defaults.server.host,
        description: 'Server host address to bind to',
        pattern: /^[\w.-]+$/
      }),
      port: field({
        type: Types.NUMBER,
        default: defaults.server.port,
        description: 'Server port number',
        min: 1,
        max: 65535
      }),
      ssl: field({
        type: Types.OBJECT,
        description: 'SSL/TLS configuration',
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.server.ssl.enabled,
            description: 'Enable SSL/TLS encryption'
          }),
          certPath: field({
            type: [Types.STRING, Types.NULL],
            default: defaults.server.ssl.certPath,
            description: 'Path to SSL certificate file'
          }),
          keyPath: field({
            type: [Types.STRING, Types.NULL],
            default: defaults.server.ssl.keyPath,
            description: 'Path to SSL private key file'
          }),
          caPath: field({
            type: [Types.STRING, Types.NULL],
            default: defaults.server.ssl.caPath,
            description: 'Path to CA certificate file'
          })
        }
      }),
      auth: field({
        type: Types.OBJECT,
        description: 'Authentication configuration',
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.server.auth.enabled,
            description: 'Enable authentication'
          }),
          token: field({
            type: [Types.STRING, Types.NULL],
            default: defaults.server.auth.token,
            description: 'Authentication token'
          }),
          requireAuth: field({
            type: Types.BOOLEAN,
            default: defaults.server.auth.requireAuth,
            description: 'Require authentication for all connections'
          })
        }
      }),
      heartbeat: field({
        type: Types.OBJECT,
        description: 'Heartbeat/ping-pong configuration',
        properties: {
          interval: field({
            type: Types.NUMBER,
            default: defaults.server.heartbeat.interval,
            description: 'Heartbeat interval in milliseconds',
            min: 1000,
            max: 300000
          }),
          timeout: field({
            type: Types.NUMBER,
            default: defaults.server.heartbeat.timeout,
            description: 'Heartbeat timeout in milliseconds',
            min: 5000,
            max: 600000
          })
        }
      }),
      errorRecovery: field({
        type: Types.OBJECT,
        description: 'Error recovery configuration',
        properties: {
          maxRetries: field({
            type: Types.NUMBER,
            default: defaults.server.errorRecovery.maxRetries,
            description: 'Maximum retry attempts',
            min: 0,
            max: 10
          }),
          retryDelay: field({
            type: Types.NUMBER,
            default: defaults.server.errorRecovery.retryDelay,
            description: 'Base retry delay in milliseconds',
            min: 100,
            max: 30000
          })
        }
      })
    }
  }),

  // Browser configuration
  browser: field({
    type: Types.OBJECT,
    description: 'Browser window and behavior configuration',
    properties: {
      window: field({
        type: Types.OBJECT,
        description: 'Window configuration',
        properties: {
          width: field({
            type: Types.NUMBER,
            default: defaults.browser.window.width,
            description: 'Window width in pixels',
            min: 400,
            max: 4096
          }),
          height: field({
            type: Types.NUMBER,
            default: defaults.browser.window.height,
            description: 'Window height in pixels',
            min: 300,
            max: 2160
          }),
          minWidth: field({
            type: Types.NUMBER,
            default: defaults.browser.window.minWidth,
            description: 'Minimum window width',
            min: 200
          }),
          minHeight: field({
            type: Types.NUMBER,
            default: defaults.browser.window.minHeight,
            description: 'Minimum window height',
            min: 200
          }),
          randomizeSize: field({
            type: Types.BOOLEAN,
            default: defaults.browser.window.randomizeSize,
            description: 'Randomize window size for fingerprint evasion'
          }),
          randomizePosition: field({
            type: Types.BOOLEAN,
            default: defaults.browser.window.randomizePosition,
            description: 'Randomize window position'
          })
        }
      }),
      tabs: field({
        type: Types.OBJECT,
        description: 'Tab configuration',
        properties: {
          maxTabs: field({
            type: Types.NUMBER,
            default: defaults.browser.tabs.maxTabs,
            description: 'Maximum number of open tabs',
            min: 1,
            max: 500
          }),
          homePage: field({
            type: Types.STRING,
            default: defaults.browser.tabs.homePage,
            description: 'Home page URL'
          }),
          defaultTab: field({
            type: Types.BOOLEAN,
            default: defaults.browser.tabs.defaultTab,
            description: 'Create a default tab on startup'
          })
        }
      }),
      recovery: field({
        type: Types.OBJECT,
        description: 'Session recovery configuration',
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.browser.recovery.enabled,
            description: 'Enable session recovery'
          }),
          autoSaveInterval: field({
            type: Types.NUMBER,
            default: defaults.browser.recovery.autoSaveInterval,
            description: 'Auto-save interval in milliseconds',
            min: 5000,
            max: 300000
          }),
          maxRecoveryAttempts: field({
            type: Types.NUMBER,
            default: defaults.browser.recovery.maxRecoveryAttempts,
            description: 'Maximum recovery attempts',
            min: 1,
            max: 10
          }),
          stateVersion: field({
            type: Types.NUMBER,
            default: defaults.browser.recovery.stateVersion,
            description: 'Recovery state version'
          })
        }
      }),
      devTools: field({
        type: Types.OBJECT,
        description: 'DevTools configuration',
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.browser.devTools.enabled,
            description: 'Enable DevTools'
          }),
          defaultMode: field({
            type: Types.STRING,
            default: defaults.browser.devTools.defaultMode,
            description: 'Default DevTools dock mode',
            enum: ['right', 'bottom', 'undocked', 'detach']
          })
        }
      }),
      downloads: field({
        type: Types.OBJECT,
        description: 'Download configuration',
        properties: {
          path: field({
            type: [Types.STRING, Types.NULL],
            default: defaults.browser.downloads.path,
            description: 'Download directory path'
          }),
          askBeforeDownload: field({
            type: Types.BOOLEAN,
            default: defaults.browser.downloads.askBeforeDownload,
            description: 'Ask before each download'
          }),
          maxConcurrent: field({
            type: Types.NUMBER,
            default: defaults.browser.downloads.maxConcurrent,
            description: 'Maximum concurrent downloads',
            min: 1,
            max: 20
          })
        }
      }),
      history: field({
        type: Types.OBJECT,
        description: 'History configuration',
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.browser.history.enabled,
            description: 'Enable history tracking'
          }),
          maxEntries: field({
            type: Types.NUMBER,
            default: defaults.browser.history.maxEntries,
            description: 'Maximum history entries',
            min: 100,
            max: 1000000
          }),
          retentionDays: field({
            type: Types.NUMBER,
            default: defaults.browser.history.retentionDays,
            description: 'History retention in days',
            min: 1,
            max: 365
          })
        }
      })
    }
  }),

  // Evasion configuration
  evasion: field({
    type: Types.OBJECT,
    description: 'Bot detection evasion configuration',
    properties: {
      fingerprint: field({
        type: Types.OBJECT,
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.evasion.fingerprint.enabled,
            description: 'Enable fingerprint spoofing'
          }),
          randomize: field({
            type: Types.BOOLEAN,
            default: defaults.evasion.fingerprint.randomize,
            description: 'Randomize fingerprint on each session'
          }),
          persistPerSession: field({
            type: Types.BOOLEAN,
            default: defaults.evasion.fingerprint.persistPerSession,
            description: 'Persist fingerprint within a session'
          })
        }
      }),
      userAgent: field({
        type: Types.OBJECT,
        properties: {
          randomize: field({
            type: Types.BOOLEAN,
            default: defaults.evasion.userAgent.randomize,
            description: 'Randomize user agent'
          }),
          rotateOnNavigation: field({
            type: Types.BOOLEAN,
            default: defaults.evasion.userAgent.rotateOnNavigation,
            description: 'Rotate user agent on each navigation'
          }),
          category: field({
            type: Types.STRING,
            default: defaults.evasion.userAgent.category,
            description: 'User agent category',
            enum: ['desktop', 'mobile', 'bot', 'random']
          })
        }
      }),
      webgl: field({
        type: Types.OBJECT,
        properties: {
          spoof: field({
            type: Types.BOOLEAN,
            default: defaults.evasion.webgl.spoof,
            description: 'Spoof WebGL vendor and renderer'
          }),
          noise: field({
            type: Types.BOOLEAN,
            default: defaults.evasion.webgl.noise,
            description: 'Add noise to WebGL output'
          })
        }
      }),
      canvas: field({
        type: Types.OBJECT,
        properties: {
          noise: field({
            type: Types.BOOLEAN,
            default: defaults.evasion.canvas.noise,
            description: 'Add noise to canvas output'
          }),
          noiseFactor: field({
            type: Types.NUMBER,
            default: defaults.evasion.canvas.noiseFactor,
            description: 'Canvas noise factor',
            min: 0,
            max: 10
          })
        }
      }),
      audio: field({
        type: Types.OBJECT,
        properties: {
          noise: field({
            type: Types.BOOLEAN,
            default: defaults.evasion.audio.noise,
            description: 'Add noise to audio context'
          }),
          noiseFactor: field({
            type: Types.NUMBER,
            default: defaults.evasion.audio.noiseFactor,
            description: 'Audio noise factor',
            min: 0,
            max: 0.001
          })
        }
      }),
      hardware: field({
        type: Types.OBJECT,
        properties: {
          spoof: field({
            type: Types.BOOLEAN,
            default: defaults.evasion.hardware.spoof,
            description: 'Spoof hardware info'
          }),
          concurrency: field({
            type: [Types.NUMBER, Types.NULL],
            default: defaults.evasion.hardware.concurrency,
            description: 'CPU concurrency value',
            min: 1,
            max: 64
          }),
          memory: field({
            type: [Types.NUMBER, Types.NULL],
            default: defaults.evasion.hardware.memory,
            description: 'Device memory in GB',
            min: 1,
            max: 128
          })
        }
      }),
      timezone: field({
        type: Types.OBJECT,
        properties: {
          spoof: field({
            type: Types.BOOLEAN,
            default: defaults.evasion.timezone.spoof,
            description: 'Spoof timezone'
          }),
          value: field({
            type: [Types.STRING, Types.NULL],
            default: defaults.evasion.timezone.value,
            description: 'Timezone value (e.g., "America/New_York")'
          })
        }
      }),
      geolocation: field({
        type: Types.OBJECT,
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.evasion.geolocation.enabled,
            description: 'Enable geolocation spoofing'
          }),
          latitude: field({
            type: [Types.NUMBER, Types.NULL],
            default: defaults.evasion.geolocation.latitude,
            description: 'Latitude coordinate',
            min: -90,
            max: 90
          }),
          longitude: field({
            type: [Types.NUMBER, Types.NULL],
            default: defaults.evasion.geolocation.longitude,
            description: 'Longitude coordinate',
            min: -180,
            max: 180
          }),
          accuracy: field({
            type: Types.NUMBER,
            default: defaults.evasion.geolocation.accuracy,
            description: 'Location accuracy in meters',
            min: 1,
            max: 10000
          })
        }
      }),
      humanize: field({
        type: Types.OBJECT,
        description: 'Human behavior simulation',
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.evasion.humanize.enabled,
            description: 'Enable human behavior simulation'
          }),
          typing: field({
            type: Types.OBJECT,
            properties: {
              enabled: field({
                type: Types.BOOLEAN,
                default: defaults.evasion.humanize.typing.enabled,
                description: 'Enable human-like typing'
              }),
              minDelay: field({
                type: Types.NUMBER,
                default: defaults.evasion.humanize.typing.minDelay,
                description: 'Minimum typing delay in ms',
                min: 10,
                max: 500
              }),
              maxDelay: field({
                type: Types.NUMBER,
                default: defaults.evasion.humanize.typing.maxDelay,
                description: 'Maximum typing delay in ms',
                min: 50,
                max: 1000
              }),
              mistakeRate: field({
                type: Types.NUMBER,
                default: defaults.evasion.humanize.typing.mistakeRate,
                description: 'Typing mistake rate',
                min: 0,
                max: 0.5
              })
            }
          }),
          mouse: field({
            type: Types.OBJECT,
            properties: {
              enabled: field({
                type: Types.BOOLEAN,
                default: defaults.evasion.humanize.mouse.enabled,
                description: 'Enable human-like mouse movement'
              }),
              curvature: field({
                type: Types.NUMBER,
                default: defaults.evasion.humanize.mouse.curvature,
                description: 'Mouse movement curvature',
                min: 0,
                max: 1
              }),
              speed: field({
                type: Types.NUMBER,
                default: defaults.evasion.humanize.mouse.speed,
                description: 'Mouse movement speed multiplier',
                min: 0.1,
                max: 5
              })
            }
          }),
          scroll: field({
            type: Types.OBJECT,
            properties: {
              enabled: field({
                type: Types.BOOLEAN,
                default: defaults.evasion.humanize.scroll.enabled,
                description: 'Enable human-like scrolling'
              }),
              smoothness: field({
                type: Types.NUMBER,
                default: defaults.evasion.humanize.scroll.smoothness,
                description: 'Scroll smoothness',
                min: 0,
                max: 1
              })
            }
          })
        }
      })
    }
  }),

  // Network configuration
  network: field({
    type: Types.OBJECT,
    description: 'Network and proxy configuration',
    properties: {
      proxy: field({
        type: Types.OBJECT,
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.network.proxy.enabled,
            description: 'Enable proxy'
          }),
          type: field({
            type: Types.STRING,
            default: defaults.network.proxy.type,
            description: 'Proxy type',
            enum: ['http', 'https', 'socks4', 'socks5']
          }),
          host: field({
            type: [Types.STRING, Types.NULL],
            default: defaults.network.proxy.host,
            description: 'Proxy host'
          }),
          port: field({
            type: [Types.NUMBER, Types.NULL],
            default: defaults.network.proxy.port,
            description: 'Proxy port',
            min: 1,
            max: 65535
          }),
          username: field({
            type: [Types.STRING, Types.NULL],
            default: defaults.network.proxy.username,
            description: 'Proxy username'
          }),
          password: field({
            type: [Types.STRING, Types.NULL],
            default: defaults.network.proxy.password,
            description: 'Proxy password'
          }),
          bypassList: field({
            type: Types.ARRAY,
            default: defaults.network.proxy.bypassList,
            description: 'List of hosts to bypass proxy',
            items: { type: Types.STRING }
          })
        }
      }),
      tor: field({
        type: Types.OBJECT,
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.network.tor.enabled,
            description: 'Enable Tor'
          }),
          socksPort: field({
            type: Types.NUMBER,
            default: defaults.network.tor.socksPort,
            description: 'Tor SOCKS port',
            min: 1,
            max: 65535
          }),
          controlPort: field({
            type: Types.NUMBER,
            default: defaults.network.tor.controlPort,
            description: 'Tor control port',
            min: 1,
            max: 65535
          }),
          dataDirectory: field({
            type: [Types.STRING, Types.NULL],
            default: defaults.network.tor.dataDirectory,
            description: 'Tor data directory'
          })
        }
      }),
      proxyChain: field({
        type: Types.OBJECT,
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.network.proxyChain.enabled,
            description: 'Enable proxy chain'
          }),
          proxies: field({
            type: Types.ARRAY,
            default: defaults.network.proxyChain.proxies,
            description: 'List of proxies in chain',
            items: { type: Types.OBJECT }
          })
        }
      }),
      throttling: field({
        type: Types.OBJECT,
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.network.throttling.enabled,
            description: 'Enable network throttling'
          }),
          preset: field({
            type: [Types.STRING, Types.NULL],
            default: defaults.network.throttling.preset,
            description: 'Throttling preset',
            enum: [null, 'slow3G', 'fast3G', '4G', 'offline', 'custom']
          }),
          download: field({
            type: [Types.NUMBER, Types.NULL],
            default: defaults.network.throttling.download,
            description: 'Download speed in bytes/second'
          }),
          upload: field({
            type: [Types.NUMBER, Types.NULL],
            default: defaults.network.throttling.upload,
            description: 'Upload speed in bytes/second'
          }),
          latency: field({
            type: [Types.NUMBER, Types.NULL],
            default: defaults.network.throttling.latency,
            description: 'Network latency in milliseconds'
          })
        }
      }),
      interception: field({
        type: Types.OBJECT,
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.network.interception.enabled,
            description: 'Enable request interception'
          }),
          blockAds: field({
            type: Types.BOOLEAN,
            default: defaults.network.interception.blockAds,
            description: 'Block advertisements'
          }),
          blockTrackers: field({
            type: Types.BOOLEAN,
            default: defaults.network.interception.blockTrackers,
            description: 'Block trackers'
          }),
          blockImages: field({
            type: Types.BOOLEAN,
            default: defaults.network.interception.blockImages,
            description: 'Block images'
          }),
          customRules: field({
            type: Types.ARRAY,
            default: defaults.network.interception.customRules,
            description: 'Custom interception rules',
            items: { type: Types.OBJECT }
          })
        }
      }),
      certificates: field({
        type: Types.OBJECT,
        properties: {
          ignoreCertificateErrors: field({
            type: Types.BOOLEAN,
            default: defaults.network.certificates.ignoreCertificateErrors,
            description: 'Ignore certificate errors'
          }),
          clientCertificates: field({
            type: Types.ARRAY,
            default: defaults.network.certificates.clientCertificates,
            description: 'Client certificates',
            items: { type: Types.OBJECT }
          })
        }
      }),
      headers: field({
        type: Types.OBJECT,
        properties: {
          customHeaders: field({
            type: Types.OBJECT,
            default: defaults.network.headers.customHeaders,
            description: 'Custom headers to add'
          }),
          removeHeaders: field({
            type: Types.ARRAY,
            default: defaults.network.headers.removeHeaders,
            description: 'Headers to remove',
            items: { type: Types.STRING }
          }),
          acceptLanguage: field({
            type: Types.STRING,
            default: defaults.network.headers.acceptLanguage,
            description: 'Accept-Language header value'
          }),
          acceptEncoding: field({
            type: Types.STRING,
            default: defaults.network.headers.acceptEncoding,
            description: 'Accept-Encoding header value'
          })
        }
      })
    }
  }),

  // Logging configuration
  logging: field({
    type: Types.OBJECT,
    description: 'Logging configuration',
    properties: {
      level: field({
        type: Types.STRING,
        default: defaults.logging.level,
        description: 'Log level',
        enum: ['error', 'warn', 'info', 'debug', 'trace']
      }),
      console: field({
        type: Types.OBJECT,
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.logging.console.enabled,
            description: 'Enable console logging'
          }),
          colorize: field({
            type: Types.BOOLEAN,
            default: defaults.logging.console.colorize,
            description: 'Colorize console output'
          }),
          timestamp: field({
            type: Types.BOOLEAN,
            default: defaults.logging.console.timestamp,
            description: 'Include timestamp in logs'
          })
        }
      }),
      file: field({
        type: Types.OBJECT,
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.logging.file.enabled,
            description: 'Enable file logging'
          }),
          path: field({
            type: [Types.STRING, Types.NULL],
            default: defaults.logging.file.path,
            description: 'Log file path'
          }),
          maxSize: field({
            type: Types.STRING,
            default: defaults.logging.file.maxSize,
            description: 'Maximum log file size'
          }),
          maxFiles: field({
            type: Types.NUMBER,
            default: defaults.logging.file.maxFiles,
            description: 'Maximum log files to keep',
            min: 1,
            max: 100
          }),
          rotate: field({
            type: Types.BOOLEAN,
            default: defaults.logging.file.rotate,
            description: 'Enable log rotation'
          })
        }
      }),
      network: field({
        type: Types.OBJECT,
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.logging.network.enabled,
            description: 'Enable network logging'
          }),
          logRequests: field({
            type: Types.BOOLEAN,
            default: defaults.logging.network.logRequests,
            description: 'Log network requests'
          }),
          logResponses: field({
            type: Types.BOOLEAN,
            default: defaults.logging.network.logResponses,
            description: 'Log network responses'
          }),
          logHeaders: field({
            type: Types.BOOLEAN,
            default: defaults.logging.network.logHeaders,
            description: 'Log request/response headers'
          }),
          logBody: field({
            type: Types.BOOLEAN,
            default: defaults.logging.network.logBody,
            description: 'Log request/response body'
          })
        }
      }),
      browserConsole: field({
        type: Types.OBJECT,
        properties: {
          capture: field({
            type: Types.BOOLEAN,
            default: defaults.logging.browserConsole.capture,
            description: 'Capture browser console messages'
          }),
          maxLogs: field({
            type: Types.NUMBER,
            default: defaults.logging.browserConsole.maxLogs,
            description: 'Maximum console logs to keep',
            min: 100,
            max: 100000
          }),
          levels: field({
            type: Types.ARRAY,
            default: defaults.logging.browserConsole.levels,
            description: 'Console log levels to capture',
            items: { type: Types.STRING }
          })
        }
      }),
      performance: field({
        type: Types.OBJECT,
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.logging.performance.enabled,
            description: 'Enable performance logging'
          }),
          metrics: field({
            type: Types.BOOLEAN,
            default: defaults.logging.performance.metrics,
            description: 'Log performance metrics'
          }),
          timing: field({
            type: Types.BOOLEAN,
            default: defaults.logging.performance.timing,
            description: 'Log timing information'
          })
        }
      })
    }
  }),

  // Automation configuration
  automation: field({
    type: Types.OBJECT,
    description: 'Automation and scripting configuration',
    properties: {
      scripts: field({
        type: Types.OBJECT,
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.automation.scripts.enabled,
            description: 'Enable automation scripts'
          }),
          storagePath: field({
            type: [Types.STRING, Types.NULL],
            default: defaults.automation.scripts.storagePath,
            description: 'Scripts storage path'
          }),
          timeout: field({
            type: Types.NUMBER,
            default: defaults.automation.scripts.timeout,
            description: 'Script execution timeout in ms',
            min: 1000,
            max: 600000
          }),
          sandboxed: field({
            type: Types.BOOLEAN,
            default: defaults.automation.scripts.sandboxed,
            description: 'Run scripts in sandbox'
          })
        }
      }),
      recording: field({
        type: Types.OBJECT,
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.automation.recording.enabled,
            description: 'Enable screen recording'
          }),
          format: field({
            type: Types.STRING,
            default: defaults.automation.recording.format,
            description: 'Recording format',
            enum: ['webm', 'mp4', 'gif']
          }),
          quality: field({
            type: Types.STRING,
            default: defaults.automation.recording.quality,
            description: 'Recording quality',
            enum: ['low', 'medium', 'high', 'maximum']
          }),
          fps: field({
            type: Types.NUMBER,
            default: defaults.automation.recording.fps,
            description: 'Frames per second',
            min: 1,
            max: 60
          }),
          maxDuration: field({
            type: Types.NUMBER,
            default: defaults.automation.recording.maxDuration,
            description: 'Maximum recording duration in seconds',
            min: 1,
            max: 86400
          })
        }
      }),
      screenshots: field({
        type: Types.OBJECT,
        properties: {
          format: field({
            type: Types.STRING,
            default: defaults.automation.screenshots.format,
            description: 'Screenshot format',
            enum: ['png', 'jpeg', 'webp']
          }),
          quality: field({
            type: Types.NUMBER,
            default: defaults.automation.screenshots.quality,
            description: 'Screenshot quality (1-100)',
            min: 1,
            max: 100
          }),
          path: field({
            type: [Types.STRING, Types.NULL],
            default: defaults.automation.screenshots.path,
            description: 'Screenshots storage path'
          })
        }
      })
    }
  }),

  // Profile configuration
  profiles: field({
    type: Types.OBJECT,
    description: 'Browser profile configuration',
    properties: {
      enabled: field({
        type: Types.BOOLEAN,
        default: defaults.profiles.enabled,
        description: 'Enable profile management'
      }),
      storagePath: field({
        type: [Types.STRING, Types.NULL],
        default: defaults.profiles.storagePath,
        description: 'Profiles storage path'
      }),
      defaultProfile: field({
        type: [Types.STRING, Types.NULL],
        default: defaults.profiles.defaultProfile,
        description: 'Default profile ID'
      }),
      isolation: field({
        type: Types.OBJECT,
        properties: {
          cookies: field({
            type: Types.BOOLEAN,
            default: defaults.profiles.isolation.cookies,
            description: 'Isolate cookies per profile'
          }),
          localStorage: field({
            type: Types.BOOLEAN,
            default: defaults.profiles.isolation.localStorage,
            description: 'Isolate localStorage per profile'
          }),
          sessionStorage: field({
            type: Types.BOOLEAN,
            default: defaults.profiles.isolation.sessionStorage,
            description: 'Isolate sessionStorage per profile'
          }),
          indexedDB: field({
            type: Types.BOOLEAN,
            default: defaults.profiles.isolation.indexedDB,
            description: 'Isolate IndexedDB per profile'
          }),
          cache: field({
            type: Types.BOOLEAN,
            default: defaults.profiles.isolation.cache,
            description: 'Isolate cache per profile'
          })
        }
      })
    }
  }),

  // Headless configuration
  headless: field({
    type: Types.OBJECT,
    description: 'Headless mode configuration',
    properties: {
      enabled: field({
        type: Types.BOOLEAN,
        default: defaults.headless.enabled,
        description: 'Enable headless mode'
      }),
      disableGpu: field({
        type: Types.BOOLEAN,
        default: defaults.headless.disableGpu,
        description: 'Disable GPU acceleration'
      }),
      noSandbox: field({
        type: Types.BOOLEAN,
        default: defaults.headless.noSandbox,
        description: 'Disable sandbox (required for Docker/root)'
      }),
      virtualDisplay: field({
        type: Types.BOOLEAN,
        default: defaults.headless.virtualDisplay,
        description: 'Use virtual display (Xvfb)'
      }),
      displaySize: field({
        type: Types.STRING,
        default: defaults.headless.displaySize,
        description: 'Virtual display size',
        pattern: /^\d+x\d+$/
      }),
      displayDepth: field({
        type: Types.NUMBER,
        default: defaults.headless.displayDepth,
        description: 'Virtual display color depth',
        enum: [8, 16, 24, 32]
      }),
      offscreenRendering: field({
        type: Types.BOOLEAN,
        default: defaults.headless.offscreenRendering,
        description: 'Enable offscreen rendering'
      }),
      preset: field({
        type: [Types.STRING, Types.NULL],
        default: defaults.headless.preset,
        description: 'Headless preset',
        enum: [null, 'server', 'docker', 'ci', 'minimal']
      })
    }
  }),

  // Memory configuration
  memory: field({
    type: Types.OBJECT,
    description: 'Memory management configuration',
    properties: {
      monitoring: field({
        type: Types.OBJECT,
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.memory.monitoring.enabled,
            description: 'Enable memory monitoring'
          }),
          interval: field({
            type: Types.NUMBER,
            default: defaults.memory.monitoring.interval,
            description: 'Monitoring interval in ms',
            min: 10000,
            max: 600000
          })
        }
      }),
      thresholds: field({
        type: Types.OBJECT,
        properties: {
          warning: field({
            type: Types.NUMBER,
            default: defaults.memory.thresholds.warning,
            description: 'Warning threshold percentage',
            min: 50,
            max: 90
          }),
          critical: field({
            type: Types.NUMBER,
            default: defaults.memory.thresholds.critical,
            description: 'Critical threshold percentage',
            min: 60,
            max: 95
          }),
          emergency: field({
            type: Types.NUMBER,
            default: defaults.memory.thresholds.emergency,
            description: 'Emergency threshold percentage',
            min: 70,
            max: 99
          })
        }
      }),
      cleanup: field({
        type: Types.OBJECT,
        properties: {
          enabled: field({
            type: Types.BOOLEAN,
            default: defaults.memory.cleanup.enabled,
            description: 'Enable automatic cleanup'
          }),
          onWarning: field({
            type: Types.BOOLEAN,
            default: defaults.memory.cleanup.onWarning,
            description: 'Cleanup on warning threshold'
          }),
          onCritical: field({
            type: Types.BOOLEAN,
            default: defaults.memory.cleanup.onCritical,
            description: 'Cleanup on critical threshold'
          }),
          onEmergency: field({
            type: Types.BOOLEAN,
            default: defaults.memory.cleanup.onEmergency,
            description: 'Cleanup on emergency threshold'
          })
        }
      }),
      cache: field({
        type: Types.OBJECT,
        properties: {
          maxSize: field({
            type: [Types.NUMBER, Types.NULL],
            default: defaults.memory.cache.maxSize,
            description: 'Maximum cache size in bytes'
          }),
          clearOnMemoryPressure: field({
            type: Types.BOOLEAN,
            default: defaults.memory.cache.clearOnMemoryPressure,
            description: 'Clear cache on memory pressure'
          })
        }
      })
    }
  })
};

/**
 * Validate a single value against a field schema
 * @param {*} value - Value to validate
 * @param {Object} fieldSchema - Field schema
 * @param {string} path - Config path for error messages
 * @returns {Object} Validation result { valid: boolean, errors: string[], value: any }
 */
function validateField(value, fieldSchema, path = '') {
  const errors = [];
  let finalValue = value;

  // Handle undefined/null values
  if (value === undefined || value === null) {
    if (fieldSchema.required) {
      errors.push(`${path}: Required field is missing`);
    }
    finalValue = fieldSchema.default;
    return { valid: errors.length === 0, errors, value: finalValue };
  }

  // Get allowed types as array
  const allowedTypes = Array.isArray(fieldSchema.type) ? fieldSchema.type : [fieldSchema.type];

  // Type validation
  const valueType = getValueType(value);
  if (!allowedTypes.includes(Types.ANY) && !allowedTypes.includes(valueType)) {
    // Allow null if NULL is in allowed types
    if (!(value === null && allowedTypes.includes(Types.NULL))) {
      errors.push(`${path}: Expected type ${allowedTypes.join(' or ')}, got ${valueType}`);
      return { valid: false, errors, value: finalValue };
    }
  }

  // Enum validation
  if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
    errors.push(`${path}: Value must be one of: ${fieldSchema.enum.join(', ')}`);
  }

  // Number range validation
  if (valueType === Types.NUMBER) {
    if (fieldSchema.min !== undefined && value < fieldSchema.min) {
      errors.push(`${path}: Value must be >= ${fieldSchema.min}`);
    }
    if (fieldSchema.max !== undefined && value > fieldSchema.max) {
      errors.push(`${path}: Value must be <= ${fieldSchema.max}`);
    }
  }

  // String pattern validation
  if (valueType === Types.STRING && fieldSchema.pattern) {
    if (!fieldSchema.pattern.test(value)) {
      errors.push(`${path}: Value does not match required pattern`);
    }
  }

  // Array items validation
  if (valueType === Types.ARRAY && fieldSchema.items) {
    value.forEach((item, index) => {
      const itemResult = validateField(item, fieldSchema.items, `${path}[${index}]`);
      errors.push(...itemResult.errors);
    });
  }

  // Object properties validation
  if (valueType === Types.OBJECT && fieldSchema.properties) {
    for (const [propKey, propSchema] of Object.entries(fieldSchema.properties)) {
      const propPath = path ? `${path}.${propKey}` : propKey;
      const propValue = value[propKey];
      const propResult = validateField(propValue, propSchema, propPath);
      errors.push(...propResult.errors);
    }
  }

  // Custom validation function
  if (fieldSchema.validate) {
    const customResult = fieldSchema.validate(value, path);
    if (customResult !== true) {
      errors.push(`${path}: ${customResult}`);
    }
  }

  // Deprecation warning
  if (fieldSchema.deprecated) {
    console.warn(`[Config] Warning: ${path} is deprecated. ${fieldSchema.deprecatedMessage}`);
  }

  return { valid: errors.length === 0, errors, value: finalValue };
}

/**
 * Get the type of a value
 * @param {*} value - Value to check
 * @returns {string} Type string
 */
function getValueType(value) {
  if (value === null) return Types.NULL;
  if (Array.isArray(value)) return Types.ARRAY;
  return typeof value;
}

/**
 * Validate entire configuration against schema
 * @param {Object} config - Configuration object to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
function validateConfig(config) {
  const errors = [];

  for (const [key, fieldSchema] of Object.entries(schema)) {
    const result = validateField(config[key], fieldSchema, key);
    errors.push(...result.errors);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get the default value for a config path
 * @param {string} path - Dot-notation path
 * @returns {*} Default value
 */
function getDefault(path) {
  const parts = path.split('.');
  let schemaNode = schema;
  let defaultValue;

  for (const part of parts) {
    if (schemaNode.properties && schemaNode.properties[part]) {
      schemaNode = schemaNode.properties[part];
      defaultValue = schemaNode.default;
    } else if (schemaNode[part]) {
      schemaNode = schemaNode[part];
      defaultValue = schemaNode.default;
    } else {
      return undefined;
    }
  }

  return defaultValue;
}

/**
 * Get schema for a config path
 * @param {string} path - Dot-notation path
 * @returns {Object|null} Field schema or null
 */
function getSchema(path) {
  const parts = path.split('.');
  let schemaNode = schema;

  for (const part of parts) {
    if (schemaNode.properties && schemaNode.properties[part]) {
      schemaNode = schemaNode.properties[part];
    } else if (schemaNode[part]) {
      schemaNode = schemaNode[part];
    } else {
      return null;
    }
  }

  return schemaNode;
}

module.exports = {
  Types,
  schema,
  field,
  validateField,
  validateConfig,
  getDefault,
  getSchema,
  getValueType
};
