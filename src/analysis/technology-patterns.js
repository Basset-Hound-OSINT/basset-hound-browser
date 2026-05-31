/**
 * Technology Detection Patterns Database
 *
 * Contains detection patterns for 50+ technologies including:
 * - JavaScript frameworks (React, Vue, Angular, etc.)
 * - CMS platforms (WordPress, Drupal, Ghost, etc.)
 * - Web servers (Nginx, Apache, IIS, etc.)
 * - Analytics platforms (Google Analytics, Mixpanel, etc.)
 * - CDN providers (Cloudflare, Akamai, etc.)
 * - Libraries and tools
 *
 * Each pattern includes:
 * - HTTP header signatures
 * - Meta tag detections
 * - JavaScript global detections
 * - HTML comment patterns
 * - Cookie patterns
 * - Form action patterns
 * - Common endpoint patterns
 *
 * @module technology-patterns
 */

const TECHNOLOGY_PATTERNS = {
  // ==========================================
  // JavaScript Frameworks (17 technologies)
  // ==========================================

  'React': {
    category: 'JavaScript Framework',
    headers: {},
    metaTags: [],
    jsGlobals: [
      '__REACT_DEVTOOLS_GLOBAL_HOOK__',
      '__REACT_PERFORMANCE_DEVTOOLS_GLOBAL_HOOK__'
    ],
    domMarkers: [
      'data-reactroot',
      'data-react-root',
      '[role="presentation"][aria-hidden="true"]' // React portal markers
    ],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.95,
    versionPatterns: [
      { pattern: /React\s+(\d+\.\d+\.\d+)/i, group: 1 }
    ]
  },

  'Vue.js': {
    category: 'JavaScript Framework',
    headers: {},
    metaTags: [],
    jsGlobals: [
      '__VUE__',
      '__VUE_DEVTOOLS_GLOBAL_HOOK__'
    ],
    domMarkers: [
      'data-v-app',
      'data-v-cloak',
      '[v-if]',
      '[v-for]',
      '[v-bind]'
    ],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.90,
    versionPatterns: []
  },

  'Angular': {
    category: 'JavaScript Framework',
    headers: {},
    metaTags: [],
    jsGlobals: [
      'ng',
      '__ANGULAR__',
      'angular'
    ],
    domMarkers: [
      '[ng-app]',
      '[ng-controller]',
      '[ng-bind]',
      'ng-app',
      'ng-view'
    ],
    htmlComments: [],
    cookies: [],
    endpoints: ['/api/'],
    confidence: 0.85,
    versionPatterns: []
  },

  'Next.js': {
    category: 'JavaScript Framework',
    headers: {},
    metaTags: [],
    jsGlobals: [
      '__NEXT_DATA__',
      '__NEXT_PAGE_PROPS__',
      '__NEXT_PROPS__'
    ],
    domMarkers: [
      '[data-next-hydration]',
      '[data-next-page]'
    ],
    htmlComments: [],
    cookies: [],
    endpoints: ['/_next/'],
    confidence: 0.92,
    versionPatterns: []
  },

  'Nuxt.js': {
    category: 'JavaScript Framework',
    headers: {},
    metaTags: [],
    jsGlobals: [
      '__NUXT__',
      '__NUXT_DEVTOOLS__'
    ],
    domMarkers: [
      '[data-nuxt]',
      '[id="__nuxt"]'
    ],
    htmlComments: [],
    cookies: [],
    endpoints: ['/_nuxt/'],
    confidence: 0.90,
    versionPatterns: []
  },

  'jQuery': {
    category: 'JavaScript Library',
    headers: {},
    metaTags: [],
    jsGlobals: ['jQuery', '$'],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.88,
    versionPatterns: [
      { pattern: /jQuery\s+v?(\d+\.\d+\.\d+)/i, group: 1 }
    ]
  },

  'Ember.js': {
    category: 'JavaScript Framework',
    headers: {},
    metaTags: [],
    jsGlobals: [
      'Ember',
      '__ember_assert',
      '__ember_source'
    ],
    domMarkers: [
      '[data-ember-action]'
    ],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.85,
    versionPatterns: []
  },

  'Svelte': {
    category: 'JavaScript Framework',
    headers: {},
    metaTags: [],
    jsGlobals: [],
    domMarkers: [
      '[data-sveltekit-]'
    ],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.80,
    versionPatterns: []
  },

  'Backbone.js': {
    category: 'JavaScript Framework',
    headers: {},
    metaTags: [],
    jsGlobals: ['Backbone'],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.75,
    versionPatterns: []
  },

  'Knockout.js': {
    category: 'JavaScript Framework',
    headers: {},
    metaTags: [],
    jsGlobals: ['ko', 'knockout'],
    domMarkers: [
      '[data-bind]'
    ],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.80,
    versionPatterns: []
  },

  'TypeScript': {
    category: 'Programming Language',
    headers: {},
    metaTags: [],
    jsGlobals: [],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.70,
    versionPatterns: []
  },

  'Gatsby': {
    category: 'Static Site Generator',
    headers: {},
    metaTags: [
      { name: 'generator', content: /Gatsby/i }
    ],
    jsGlobals: [
      '__GATSBY__',
      '__GATSBY_VERSION__'
    ],
    domMarkers: [
      '[data-gatsby-link-prefetch]'
    ],
    htmlComments: [],
    cookies: [],
    endpoints: ['/.cache/'],
    confidence: 0.88,
    versionPatterns: []
  },

  'MobX': {
    category: 'State Management',
    headers: {},
    metaTags: [],
    jsGlobals: [
      '__mobxGlobals',
      'mobx'
    ],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.70,
    versionPatterns: []
  },

  'Redux': {
    category: 'State Management',
    headers: {},
    metaTags: [],
    jsGlobals: [
      '__REDUX_DEVTOOLS_EXTENSION__'
    ],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.75,
    versionPatterns: []
  },

  // ==========================================
  // CMS Platforms (10 technologies)
  // ==========================================

  'WordPress': {
    category: 'CMS',
    headers: {
      'x-powered-by': /WordPress/i,
      'x-ua-compatible': /.*/
    },
    metaTags: [
      { name: 'generator', content: /WordPress\s+(\d+\.\d+)/i }
    ],
    jsGlobals: ['wp', 'wpApiSettings'],
    domMarkers: [],
    htmlComments: [
      /<!-- wp:/,
      /wordpress/i
    ],
    cookies: [
      'wordpress_logged_in',
      'wp-settings-'
    ],
    endpoints: ['/wp-json/', '/wp-admin/', '/wp-content/'],
    confidence: 0.95,
    versionPatterns: [
      { pattern: /WordPress\s+(\d+\.\d+(?:\.\d+)?)/i, group: 1 }
    ]
  },

  'Drupal': {
    category: 'CMS',
    headers: {
      'x-powered-by': /Drupal/i,
      'x-drupal-cache': /.*/
    },
    metaTags: [
      { name: 'generator', content: /Drupal/i }
    ],
    jsGlobals: ['Drupal', 'drupalSettings'],
    domMarkers: [
      'data-drupal-messages',
      'data-drupal-theme'
    ],
    htmlComments: [
      /Drupal/
    ],
    cookies: [
      'DRUPAL_UID',
      'DRUPAL_VISITOR_'
    ],
    endpoints: ['/admin/', '/api/', '/user/'],
    confidence: 0.92,
    versionPatterns: []
  },

  'Joomla': {
    category: 'CMS',
    headers: {
      'x-powered-by': /Joomla/i,
      'x-content-encoded': /.*/
    },
    metaTags: [
      { name: 'generator', content: /Joomla/i }
    ],
    jsGlobals: ['Joomla', 'jQuerySupport'],
    domMarkers: [],
    htmlComments: [
      /Joomla/
    ],
    cookies: ['joomla_user_state'],
    endpoints: ['/administrator/', '/api/', '/index.php'],
    confidence: 0.88,
    versionPatterns: []
  },

  'Ghost': {
    category: 'CMS',
    headers: {},
    metaTags: [
      { name: 'generator', content: /Ghost/i }
    ],
    jsGlobals: ['ghost', 'ghostAPI'],
    domMarkers: [],
    htmlComments: [
      /Ghost/i
    ],
    cookies: [],
    endpoints: ['/ghost/', '/api/'],
    confidence: 0.85,
    versionPatterns: []
  },

  'Shopify': {
    category: 'E-Commerce Platform',
    headers: {
      'x-powered-by': /Shopify/i,
      'x-shopify-api-request-id': /.*/
    },
    metaTags: [
      { name: 'generator', content: /Shopify/i }
    ],
    jsGlobals: ['Shopify', 'ShopifyAnalytics'],
    domMarkers: [
      'data-shopify-app',
      'data-shopify-root'
    ],
    htmlComments: [
      /Shopify/
    ],
    cookies: ['_shopify_y'],
    endpoints: ['/cdn/', '/apps/'],
    confidence: 0.95,
    versionPatterns: []
  },

  'Magento': {
    category: 'E-Commerce Platform',
    headers: {},
    metaTags: [],
    jsGlobals: ['Magento'],
    domMarkers: [],
    htmlComments: [
      /Magento/
    ],
    cookies: ['frontend'],
    endpoints: ['/admin/', '/catalog/', '/customer/'],
    confidence: 0.85,
    versionPatterns: []
  },

  'WooCommerce': {
    category: 'E-Commerce Plugin',
    headers: {},
    metaTags: [],
    jsGlobals: ['wc', 'woocommerce'],
    domMarkers: [
      'data-woo-product',
      'data-woo-cart'
    ],
    htmlComments: [],
    cookies: [],
    endpoints: ['/wp-json/wc/', '/shop/'],
    confidence: 0.88,
    versionPatterns: []
  },

  'PrestaShop': {
    category: 'E-Commerce Platform',
    headers: {},
    metaTags: [],
    jsGlobals: ['prestashop', 'prestashopInstant'],
    domMarkers: [],
    htmlComments: [
      /prestashop/i
    ],
    cookies: ['PrestaShop-'],
    endpoints: ['/modules/', '/admin/'],
    confidence: 0.82,
    versionPatterns: []
  },

  'Wix': {
    category: 'Website Builder',
    headers: {
      'x-powered-by': /Wix/i
    },
    metaTags: [],
    jsGlobals: ['wix', '__wixSkipLocalstorage'],
    domMarkers: [
      'data-wix-root',
      'data-wix-element'
    ],
    htmlComments: [],
    cookies: ['wixUid', 'wixFreq'],
    endpoints: ['/'],
    confidence: 0.90,
    versionPatterns: []
  },

  // ==========================================
  // Web Servers (8 technologies)
  // ==========================================

  'Nginx': {
    category: 'Web Server',
    headers: {
      'server': /nginx/i,
      'x-powered-by': /nginx/i
    },
    metaTags: [],
    jsGlobals: [],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.95,
    versionPatterns: [
      { pattern: /nginx\/(\d+\.\d+\.\d+)?/i, group: 1 }
    ]
  },

  'Apache': {
    category: 'Web Server',
    headers: {
      'server': /Apache/i,
      'x-powered-by': /Apache/i
    },
    metaTags: [],
    jsGlobals: [],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.95,
    versionPatterns: [
      { pattern: /Apache\/(\d+\.\d+\.\d+)?/i, group: 1 }
    ]
  },

  'Microsoft-IIS': {
    category: 'Web Server',
    headers: {
      'server': /IIS/i,
      'x-powered-by': /IIS/i
    },
    metaTags: [],
    jsGlobals: [],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.95,
    versionPatterns: [
      { pattern: /IIS\/(\d+\.\d+)/i, group: 1 }
    ]
  },

  'Tomcat': {
    category: 'Web Server',
    headers: {
      'server': /Tomcat/i,
      'x-powered-by': /Tomcat/i
    },
    metaTags: [],
    jsGlobals: [],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: ['/'],
    confidence: 0.90,
    versionPatterns: [
      { pattern: /Tomcat\/(\d+\.\d+\.\d+)?/i, group: 1 }
    ]
  },

  'Jetty': {
    category: 'Web Server',
    headers: {
      'server': /Jetty/i
    },
    metaTags: [],
    jsGlobals: [],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.85,
    versionPatterns: []
  },

  'Lighttpd': {
    category: 'Web Server',
    headers: {
      'server': /lighttpd/i
    },
    metaTags: [],
    jsGlobals: [],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.90,
    versionPatterns: []
  },

  'Node.js': {
    category: 'Runtime',
    headers: {
      'x-powered-by': /Node/i
    },
    metaTags: [],
    jsGlobals: ['process', '__dirname', '__filename'],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.75,
    versionPatterns: []
  },

  'Python': {
    category: 'Runtime/Framework',
    headers: {
      'server': /Python|WSGI/i,
      'x-powered-by': /Python|Django|Flask/i
    },
    metaTags: [],
    jsGlobals: [],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.70,
    versionPatterns: []
  },

  // ==========================================
  // Analytics & Tracking (8 technologies)
  // ==========================================

  'Google Analytics': {
    category: 'Analytics',
    headers: {},
    metaTags: [],
    jsGlobals: ['ga', '__gaTracker', 'gtag', 'dataLayer'],
    domMarkers: [],
    htmlComments: [],
    cookies: [
      '_ga',
      '_gat_',
      '_gid'
    ],
    endpoints: [
      '/google-analytics/',
      'google-analytics.com'
    ],
    confidence: 0.92,
    versionPatterns: []
  },

  'Mixpanel': {
    category: 'Analytics',
    headers: {},
    metaTags: [],
    jsGlobals: ['mixpanel', 'mp'],
    domMarkers: [],
    htmlComments: [],
    cookies: ['mp_optout_check'],
    endpoints: ['mixpanel.com'],
    confidence: 0.85,
    versionPatterns: []
  },

  'Segment': {
    category: 'Analytics',
    headers: {},
    metaTags: [],
    jsGlobals: ['analytics'],
    domMarkers: [],
    htmlComments: [],
    cookies: ['_segment_'],
    endpoints: ['/analytics/'],
    confidence: 0.80,
    versionPatterns: []
  },

  'Amplitude': {
    category: 'Analytics',
    headers: {},
    metaTags: [],
    jsGlobals: ['amplitude'],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: ['amplitude.com'],
    confidence: 0.82,
    versionPatterns: []
  },

  'Hotjar': {
    category: 'Analytics',
    headers: {},
    metaTags: [],
    jsGlobals: ['hj', 'hjSiteId'],
    domMarkers: [],
    htmlComments: [],
    cookies: ['_hjid'],
    endpoints: ['hotjar.com'],
    confidence: 0.88,
    versionPatterns: []
  },

  'New Relic': {
    category: 'Performance Monitoring',
    headers: {},
    metaTags: [],
    jsGlobals: ['newrelic'],
    domMarkers: [],
    htmlComments: [],
    cookies: ['NRAGENT'],
    endpoints: ['/newrelic/'],
    confidence: 0.80,
    versionPatterns: []
  },

  'Sentry': {
    category: 'Error Tracking',
    headers: {},
    metaTags: [],
    jsGlobals: ['Sentry'],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: ['sentry.io'],
    confidence: 0.75,
    versionPatterns: []
  },

  'Heap Analytics': {
    category: 'Analytics',
    headers: {},
    metaTags: [],
    jsGlobals: ['heap'],
    domMarkers: [],
    htmlComments: [],
    cookies: ['_hp2_'],
    endpoints: ['heap.io'],
    confidence: 0.80,
    versionPatterns: []
  },

  // ==========================================
  // CDN & Hosting (6 technologies)
  // ==========================================

  'Cloudflare': {
    category: 'CDN',
    headers: {
      'server': /cloudflare/i,
      'cf-ray': /.*/,
      'cf-cache-status': /.*/,
      'x-content-type-options': /nosniff/i
    },
    metaTags: [],
    jsGlobals: [],
    domMarkers: [],
    htmlComments: [],
    cookies: ['__cfruid'],
    endpoints: ['/cdn-cgi/'],
    confidence: 0.95,
    versionPatterns: []
  },

  'Akamai': {
    category: 'CDN',
    headers: {
      'x-akamai-': /.*/
    },
    metaTags: [],
    jsGlobals: [],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.85,
    versionPatterns: []
  },

  'Fastly': {
    category: 'CDN',
    headers: {
      'x-served-by': /fastly/i,
      'via': /fastly/i
    },
    metaTags: [],
    jsGlobals: [],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.90,
    versionPatterns: []
  },

  'CloudFront': {
    category: 'CDN',
    headers: {
      'via': /CloudFront/i,
      'x-amz-': /.*/
    },
    metaTags: [],
    jsGlobals: [],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.85,
    versionPatterns: []
  },

  'AWS': {
    category: 'Cloud Platform',
    headers: {
      'x-amz-': /.*/
    },
    metaTags: [],
    jsGlobals: [],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: ['/s3/', '/.s3/'],
    confidence: 0.80,
    versionPatterns: []
  },

  'Google Cloud': {
    category: 'Cloud Platform',
    headers: {
      'x-goog-': /.*/
    },
    metaTags: [],
    jsGlobals: [],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.70,
    versionPatterns: []
  },

  // ==========================================
  // CSS Frameworks & UI Libraries (5 technologies)
  // ==========================================

  'Bootstrap': {
    category: 'CSS Framework',
    headers: {},
    metaTags: [],
    jsGlobals: [],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.70,
    versionPatterns: []
  },

  'Tailwind CSS': {
    category: 'CSS Framework',
    headers: {},
    metaTags: [],
    jsGlobals: [],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.60,
    versionPatterns: []
  },

  'Material-UI': {
    category: 'UI Framework',
    headers: {},
    metaTags: [],
    jsGlobals: [],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.65,
    versionPatterns: []
  },

  'Font Awesome': {
    category: 'Icon Library',
    headers: {},
    metaTags: [],
    jsGlobals: [],
    domMarkers: [
      '[class*="fa-"]'
    ],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.75,
    versionPatterns: []
  },

  'FontAwesome': {
    category: 'Icon Library',
    headers: {},
    metaTags: [],
    jsGlobals: ['FontAwesome'],
    domMarkers: [],
    htmlComments: [],
    cookies: [],
    endpoints: [],
    confidence: 0.75,
    versionPatterns: []
  }
};

module.exports = TECHNOLOGY_PATTERNS;
