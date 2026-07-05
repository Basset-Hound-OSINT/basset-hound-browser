/**
 * Fingerprint Profile Configurations
 *
 * Platform, screen, timezone, hardware and evasion-noise configuration constants
 * shared by the FingerprintProfile system.
 */

/**
 * Platform-specific configurations
 * Each platform has consistent sets of values
 */
const PLATFORM_CONFIGS = {
  windows: {
    platforms: ['Win32', 'Win64'],
    navigatorPlatforms: ['Win32'],
    oscpus: ['Windows NT 10.0; Win64; x64', 'Windows NT 10.0'],
    webglVendors: [
      'Google Inc. (NVIDIA)',
      'Google Inc. (AMD)',
      'Google Inc. (Intel)'
    ],
    webglRenderers: {
      'Google Inc. (NVIDIA)': [
        'ANGLE (NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)'
      ],
      'Google Inc. (AMD)': [
        'ANGLE (AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (AMD Radeon RX 5700 XT Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0)'
      ],
      'Google Inc. (Intel)': [
        'ANGLE (Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)'
      ]
    },
    fonts: [
      'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS',
      'Consolas', 'Courier New', 'Georgia', 'Impact', 'Lucida Console',
      'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'
    ],
    userAgentTemplate: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chromeVersion} Safari/537.36'
  },

  macos: {
    platforms: ['MacIntel'],
    navigatorPlatforms: ['MacIntel'],
    oscpus: ['Intel Mac OS X 10_15_7', 'Intel Mac OS X 11_0', 'Intel Mac OS X 12_0'],
    webglVendors: [
      'Apple Inc.',
      'Google Inc. (AMD)',
      'Google Inc. (Intel)'
    ],
    webglRenderers: {
      'Apple Inc.': [
        'Apple M1',
        'Apple M1 Pro',
        'Apple M1 Max',
        'Apple M2',
        'Apple M2 Pro',
        'Apple M3',
        'AMD Radeon Pro 5500M OpenGL Engine'
      ],
      'Google Inc. (AMD)': [
        'ANGLE (AMD Radeon Pro 5500M OpenGL Engine)',
        'ANGLE (AMD Radeon Pro 580 OpenGL Engine)'
      ],
      'Google Inc. (Intel)': [
        'ANGLE (Intel(R) Iris(TM) Plus Graphics OpenGL Engine)',
        'ANGLE (Intel(R) UHD Graphics 630 OpenGL Engine)'
      ]
    },
    fonts: [
      'Arial', 'Arial Black', 'Avenir', 'Avenir Next', 'Courier', 'Courier New',
      'Geneva', 'Georgia', 'Helvetica', 'Helvetica Neue', 'Lucida Grande',
      'Menlo', 'Monaco', 'Optima', 'Palatino', 'San Francisco', 'Times'
    ],
    userAgentTemplate: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chromeVersion} Safari/537.36'
  },

  linux: {
    platforms: ['Linux x86_64', 'Linux i686'],
    navigatorPlatforms: ['Linux x86_64'],
    oscpus: ['Linux x86_64', 'Linux i686'],
    webglVendors: [
      'Google Inc. (NVIDIA Corporation)',
      'Google Inc. (AMD)',
      'Google Inc. (Intel)',
      'Mesa/X.org'
    ],
    webglRenderers: {
      'Google Inc. (NVIDIA Corporation)': [
        'ANGLE (NVIDIA GeForce GTX 1080/PCIe/SSE2)',
        'ANGLE (NVIDIA GeForce RTX 3070/PCIe/SSE2)'
      ],
      'Google Inc. (AMD)': [
        'ANGLE (AMD Radeon RX 580 Series (POLARIS10, DRM 3.40.0))',
        'ANGLE (AMD Radeon RX 6700 XT (NAVI22))'
      ],
      'Google Inc. (Intel)': [
        'ANGLE (Intel(R) UHD Graphics 630)',
        'ANGLE (Intel(R) Iris(R) Xe Graphics)'
      ],
      'Mesa/X.org': [
        'Mesa Intel(R) UHD Graphics 630 (CFL GT2)',
        'Mesa AMD Radeon RX 580 (polaris10)'
      ]
    },
    fonts: [
      'DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono', 'Liberation Sans',
      'Liberation Serif', 'Liberation Mono', 'Ubuntu', 'Ubuntu Mono',
      'Noto Sans', 'Noto Serif', 'Droid Sans', 'Droid Serif'
    ],
    userAgentTemplate: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chromeVersion} Safari/537.36'
  }
};

/**
 * Chrome version ranges for realistic UAs
 */
const CHROME_VERSIONS = [
  '120.0.0.0', '121.0.0.0', '122.0.0.0', '123.0.0.0', '124.0.0.0',
  '125.0.0.0', '126.0.0.0', '127.0.0.0', '128.0.0.0', '129.0.0.0'
];

/**
 * Screen configurations by resolution tier
 */
const SCREEN_CONFIGS = {
  standard: [
    { width: 1920, height: 1080, availHeight: 1040, colorDepth: 24, pixelDepth: 24 },
    { width: 1366, height: 768, availHeight: 728, colorDepth: 24, pixelDepth: 24 },
    { width: 1536, height: 864, availHeight: 824, colorDepth: 24, pixelDepth: 24 },
    { width: 1440, height: 900, availHeight: 860, colorDepth: 24, pixelDepth: 24 }
  ],
  high: [
    { width: 2560, height: 1440, availHeight: 1400, colorDepth: 30, pixelDepth: 30 },
    { width: 3840, height: 2160, availHeight: 2120, colorDepth: 30, pixelDepth: 30 },
    { width: 2560, height: 1600, availHeight: 1560, colorDepth: 30, pixelDepth: 30 }
  ],
  retina: [
    { width: 2880, height: 1800, availHeight: 1760, colorDepth: 30, pixelDepth: 30, devicePixelRatio: 2 },
    { width: 3024, height: 1964, availHeight: 1920, colorDepth: 30, pixelDepth: 30, devicePixelRatio: 2 }
  ]
};

/**
 * Timezone configurations by region
 */
const TIMEZONE_CONFIGS = {
  'America/Los_Angeles': { offset: -480, locale: 'en-US', country: 'US' },
  'America/Denver': { offset: -420, locale: 'en-US', country: 'US' },
  'America/Chicago': { offset: -360, locale: 'en-US', country: 'US' },
  'America/New_York': { offset: -300, locale: 'en-US', country: 'US' },
  'Europe/London': { offset: 0, locale: 'en-GB', country: 'GB' },
  'Europe/Paris': { offset: 60, locale: 'fr-FR', country: 'FR' },
  'Europe/Berlin': { offset: 60, locale: 'de-DE', country: 'DE' },
  'Europe/Moscow': { offset: 180, locale: 'ru-RU', country: 'RU' },
  'Asia/Tokyo': { offset: 540, locale: 'ja-JP', country: 'JP' },
  'Asia/Shanghai': { offset: 480, locale: 'zh-CN', country: 'CN' },
  'Australia/Sydney': { offset: 660, locale: 'en-AU', country: 'AU' }
};

/**
 * Hardware concurrency options by system type
 */
const HARDWARE_CONFIGS = {
  low: { hardwareConcurrency: 4, deviceMemory: 4 },
  medium: { hardwareConcurrency: 8, deviceMemory: 8 },
  high: { hardwareConcurrency: 12, deviceMemory: 16 },
  workstation: { hardwareConcurrency: 16, deviceMemory: 32 }
};

/**
 * Canvas noise configuration
 * Controls how canvas fingerprint randomization is applied
 */
const CANVAS_NOISE_CONFIGS = {
  disabled: { enabled: false, intensity: 0 },
  subtle: { enabled: true, intensity: 0.00005, affectedChannels: ['r', 'g', 'b'], maxPixelShift: 1 },
  moderate: { enabled: true, intensity: 0.0001, affectedChannels: ['r', 'g', 'b'], maxPixelShift: 2 },
  aggressive: { enabled: true, intensity: 0.0005, affectedChannels: ['r', 'g', 'b', 'a'], maxPixelShift: 3 }
};

/**
 * WebGL noise configuration
 * Controls WebGL parameter randomization
 */
const WEBGL_NOISE_CONFIGS = {
  disabled: { enabled: false },
  subtle: {
    enabled: true,
    randomizeExtensions: true,
    extensionRemovalChance: 0.05,
    parameterNoise: 0.01,
    precisionNoise: true
  },
  moderate: {
    enabled: true,
    randomizeExtensions: true,
    extensionRemovalChance: 0.1,
    parameterNoise: 0.02,
    precisionNoise: true
  },
  aggressive: {
    enabled: true,
    randomizeExtensions: true,
    extensionRemovalChance: 0.2,
    parameterNoise: 0.05,
    precisionNoise: true
  }
};

/**
 * Audio fingerprint noise configuration
 * Controls AudioContext fingerprint randomization
 */
const AUDIO_NOISE_CONFIGS = {
  disabled: { enabled: false, intensity: 0 },
  subtle: { enabled: true, intensity: 0.00001, noiseType: 'white', affectOscillator: true },
  moderate: { enabled: true, intensity: 0.00005, noiseType: 'white', affectOscillator: true },
  aggressive: { enabled: true, intensity: 0.0001, noiseType: 'pink', affectOscillator: true }
};

/**
 * Font evasion configuration
 * Controls font enumeration evasion
 */
const FONT_EVASION_CONFIGS = {
  disabled: { enabled: false },
  subtle: {
    enabled: true,
    randomizeOrder: true,
    removeCommonFonts: 0.05,
    addDecoyFonts: 0
  },
  moderate: {
    enabled: true,
    randomizeOrder: true,
    removeCommonFonts: 0.1,
    addDecoyFonts: 2
  },
  aggressive: {
    enabled: true,
    randomizeOrder: true,
    removeCommonFonts: 0.2,
    addDecoyFonts: 5
  }
};

/**
 * Common fonts across all platforms (for decoy purposes)
 */
const COMMON_DECOY_FONTS = [
  'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Source Sans Pro',
  'Raleway', 'PT Sans', 'Nunito', 'Ubuntu', 'Merriweather',
  'Playfair Display', 'Oswald', 'Quicksand', 'Poppins', 'Work Sans'
];

module.exports = {
  PLATFORM_CONFIGS,
  CHROME_VERSIONS,
  SCREEN_CONFIGS,
  TIMEZONE_CONFIGS,
  HARDWARE_CONFIGS,
  CANVAS_NOISE_CONFIGS,
  WEBGL_NOISE_CONFIGS,
  AUDIO_NOISE_CONFIGS,
  FONT_EVASION_CONFIGS,
  COMMON_DECOY_FONTS
};
