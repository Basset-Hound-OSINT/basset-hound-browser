/**
 * Technology Signature Database
 *
 * Contains detection signatures for 50+ web technologies including:
 * - JavaScript frameworks (React, Vue, Angular, Next.js, etc.)
 * - CMS platforms (WordPress, Drupal, Joomla, Ghost, etc.)
 * - Web servers (Nginx, Apache, IIS, Node.js, Caddy)
 * - Analytics platforms (Google Analytics, Mixpanel, Segment, Amplitude)
 * - CDN providers (Cloudflare, Akamai, AWS CloudFront, Fastly)
 * - JavaScript libraries (jQuery, Lodash, D3.js, Three.js, etc.)
 * - CSS frameworks (Bootstrap, Tailwind, Foundation, etc.)
 * - E-commerce platforms (Shopify, WooCommerce, Magento)
 * - And 15+ more categories
 *
 * Each signature includes:
 * - name: Display name of the technology
 * - category: Category classification
 * - version: Version detection patterns
 * - accuracy: Confidence weight (0-1 scale)
 * - detection: Array of detection rules
 *   - type: 'header' | 'html' | 'meta' | 'script' | 'cookie' | 'endpoint' | 'js-global'
 *   - pattern: String or RegExp to match
 *   - group: Optional regex group for version extraction
 *
 * @module tech-signatures
 */

const TECH_SIGNATURES = {
  // ==========================================
  // JavaScript Frameworks (17 technologies)
  // ==========================================

  'React': {
    category: 'JavaScript Framework',
    version: /React\s*(\d+\.\d+\.\d+)/i,
    accuracy: 0.95,
    detection: [
      { type: 'js-global', pattern: '__REACT_DEVTOOLS_GLOBAL_HOOK__' },
      { type: 'html', pattern: 'data-reactroot' },
      { type: 'html', pattern: 'data-react-root' },
      { type: 'script', pattern: /\/react(@|\.js|\/umd)/ },
      { type: 'meta', pattern: 'generator', value: /React/i }
    ]
  },

  'Vue.js': {
    category: 'JavaScript Framework',
    version: /Vue\s*(\d+\.\d+\.\d+)/i,
    accuracy: 0.90,
    detection: [
      { type: 'js-global', pattern: '__VUE__' },
      { type: 'html', pattern: 'v-if' },
      { type: 'html', pattern: 'v-for' },
      { type: 'html', pattern: 'v-bind' },
      { type: 'html', pattern: '[data-v-' },
      { type: 'script', pattern: /\/vue(@|\.js|\/dist)/ }
    ]
  },

  'Angular': {
    category: 'JavaScript Framework',
    version: /Angular\s*(\d+\.\d+\.\d+)/i,
    accuracy: 0.88,
    detection: [
      { type: 'js-global', pattern: 'ng' },
      { type: 'html', pattern: 'ng-app' },
      { type: 'html', pattern: 'ng-controller' },
      { type: 'html', pattern: '[ng-' },
      { type: 'script', pattern: /\/angular(@|\.js|\/dist)/ }
    ]
  },

  'Next.js': {
    category: 'JavaScript Framework',
    version: /Next\s*(\d+\.\d+\.\d+)/i,
    accuracy: 0.92,
    detection: [
      { type: 'js-global', pattern: '__NEXT_DATA__' },
      { type: 'html', pattern: '__next' },
      { type: 'endpoint', pattern: '/_next/' },
      { type: 'script', pattern: /_next\/static/ }
    ]
  },

  'Nuxt.js': {
    category: 'JavaScript Framework',
    version: /Nuxt\s*(\d+\.\d+\.\d+)/i,
    accuracy: 0.90,
    detection: [
      { type: 'js-global', pattern: '__NUXT__' },
      { type: 'html', pattern: '__nuxt' },
      { type: 'endpoint', pattern: '/_nuxt/' },
      { type: 'script', pattern: /_nuxt\/dist/ }
    ]
  },

  'Gatsby': {
    category: 'JavaScript Framework',
    version: /Gatsby\s*(\d+\.\d+\.\d+)/i,
    accuracy: 0.88,
    detection: [
      { type: 'js-global', pattern: '__GATSBY__' },
      { type: 'meta', pattern: 'generator', value: /Gatsby/i },
      { type: 'endpoint', pattern: '/.cache/' }
    ]
  },

  'Ember.js': {
    category: 'JavaScript Framework',
    version: /Ember\s*(\d+\.\d+\.\d+)/i,
    accuracy: 0.82,
    detection: [
      { type: 'js-global', pattern: 'Ember' },
      { type: 'html', pattern: '[data-ember-action]' },
      { type: 'script', pattern: /\/ember(@|\.js|\/dist)/ }
    ]
  },

  'Svelte': {
    category: 'JavaScript Framework',
    version: /Svelte\s*(\d+\.\d+\.\d+)/i,
    accuracy: 0.80,
    detection: [
      { type: 'html', pattern: '[data-sveltekit-]' },
      { type: 'endpoint', pattern: '/_app/' }
    ]
  },

  'Backbone.js': {
    category: 'JavaScript Framework',
    version: /Backbone\s*(\d+\.\d+\.\d+)/i,
    accuracy: 0.75,
    detection: [
      { type: 'js-global', pattern: 'Backbone' },
      { type: 'script', pattern: /backbone(@|\.js|\/backbone)/ }
    ]
  },

  'Knockout.js': {
    category: 'JavaScript Framework',
    version: /Knockout\s*(\d+\.\d+\.\d+)/i,
    accuracy: 0.78,
    detection: [
      { type: 'js-global', pattern: 'ko' },
      { type: 'html', pattern: '[data-bind]' }
    ]
  },

  'jQuery': {
    category: 'JavaScript Library',
    version: /jQuery[\s\/v]*(\d+\.\d+\.\d+)/i,
    accuracy: 0.92,
    detection: [
      { type: 'js-global', pattern: 'jQuery' },
      { type: 'js-global', pattern: '$' },
      { type: 'script', pattern: /jquery(\.min)?\.js/ }
    ]
  },

  'Lodash': {
    category: 'JavaScript Library',
    version: /Lodash\s*(\d+\.\d+\.\d+)/i,
    accuracy: 0.70,
    detection: [
      { type: 'js-global', pattern: '_' },
      { type: 'script', pattern: /lodash(\.min)?\.js/ }
    ]
  },

  'D3.js': {
    category: 'JavaScript Library',
    version: /d3\s*v?(\d+\.\d+\.\d+)/i,
    accuracy: 0.75,
    detection: [
      { type: 'js-global', pattern: 'd3' },
      { type: 'script', pattern: /d3(\.min)?\.js/ }
    ]
  },

  'Three.js': {
    category: 'JavaScript Library',
    version: /three\s*v?(\d+\.\d+\.\d+)/i,
    accuracy: 0.72,
    detection: [
      { type: 'js-global', pattern: 'THREE' },
      { type: 'script', pattern: /three(\.min)?\.js/ }
    ]
  },

  'Chart.js': {
    category: 'JavaScript Library',
    version: /Chart\s*v?(\d+\.\d+\.\d+)/i,
    accuracy: 0.75,
    detection: [
      { type: 'js-global', pattern: 'Chart' },
      { type: 'script', pattern: /chart(\.min)?\.js/ }
    ]
  },

  // ==========================================
  // CMS Platforms (10 technologies)
  // ==========================================

  'WordPress': {
    category: 'CMS',
    version: /WordPress\s*(\d+\.\d+(?:\.\d+)?)/i,
    accuracy: 0.98,
    detection: [
      { type: 'header', pattern: 'x-powered-by', value: /WordPress/i },
      { type: 'meta', pattern: 'generator', value: /WordPress/i },
      { type: 'endpoint', pattern: '/wp-json/' },
      { type: 'endpoint', pattern: '/wp-admin/' },
      { type: 'endpoint', pattern: '/wp-content/' },
      { type: 'html', pattern: 'wp-' },
      { type: 'cookie', pattern: 'wordpress_logged_in' }
    ]
  },

  'Drupal': {
    category: 'CMS',
    version: /Drupal\s*(\d+\.\d+(?:\.\d+)?)/i,
    accuracy: 0.95,
    detection: [
      { type: 'header', pattern: 'x-powered-by', value: /Drupal/i },
      { type: 'meta', pattern: 'generator', value: /Drupal/i },
      { type: 'endpoint', pattern: '/admin/' },
      { type: 'html', pattern: '[data-drupal-' },
      { type: 'cookie', pattern: 'DRUPAL_UID' }
    ]
  },

  'Joomla': {
    category: 'CMS',
    version: /Joomla\s*(\d+\.\d+(?:\.\d+)?)/i,
    accuracy: 0.92,
    detection: [
      { type: 'header', pattern: 'x-powered-by', value: /Joomla/i },
      { type: 'meta', pattern: 'generator', value: /Joomla/i },
      { type: 'endpoint', pattern: '/administrator/' },
      { type: 'html', pattern: 'joomla_' }
    ]
  },

  'Ghost': {
    category: 'CMS',
    version: /Ghost\s*(\d+\.\d+(?:\.\d+)?)/i,
    accuracy: 0.88,
    detection: [
      { type: 'meta', pattern: 'generator', value: /Ghost/i },
      { type: 'endpoint', pattern: '/ghost/' },
      { type: 'endpoint', pattern: '/api/v' },
      { type: 'html', pattern: 'ghost-' }
    ]
  },

  'Shopify': {
    category: 'E-Commerce',
    version: null,
    accuracy: 0.98,
    detection: [
      { type: 'header', pattern: 'x-powered-by', value: /Shopify/i },
      { type: 'meta', pattern: 'generator', value: /Shopify/i },
      { type: 'js-global', pattern: 'Shopify' },
      { type: 'html', pattern: '[data-shopify-' },
      { type: 'endpoint', pattern: '/cdn/' }
    ]
  },

  'WooCommerce': {
    category: 'E-Commerce',
    version: null,
    accuracy: 0.90,
    detection: [
      { type: 'endpoint', pattern: '/wp-json/wc/' },
      { type: 'endpoint', pattern: '/wp-json/wc-admin/' },
      { type: 'html', pattern: 'woocommerce-' },
      { type: 'script', pattern: /woocommerce/ }
    ]
  },

  'Magento': {
    category: 'E-Commerce',
    version: /Magento\s*(\d+\.\d+(?:\.\d+)?)/i,
    accuracy: 0.85,
    detection: [
      { type: 'js-global', pattern: 'Magento' },
      { type: 'endpoint', pattern: '/magento/' },
      { type: 'script', pattern: /magento.*\.js/ }
    ]
  },

  'Squarespace': {
    category: 'CMS',
    version: null,
    accuracy: 0.88,
    detection: [
      { type: 'header', pattern: 'x-powered-by', value: /Squarespace/i },
      { type: 'meta', pattern: 'generator', value: /Squarespace/i },
      { type: 'html', pattern: '[data-squarespace-' }
    ]
  },

  'Wix': {
    category: 'CMS',
    version: null,
    accuracy: 0.92,
    detection: [
      { type: 'html', pattern: '[data-wix-' },
      { type: 'endpoint', pattern: '/_wix' },
      { type: 'script', pattern: /wixcode/ }
    ]
  },

  // ==========================================
  // Web Servers (8 technologies)
  // ==========================================

  'Nginx': {
    category: 'Web Server',
    version: /nginx\/(\d+\.\d+(?:\.\d+)?)/i,
    accuracy: 0.95,
    detection: [
      { type: 'header', pattern: 'server', value: /nginx/i }
    ]
  },

  'Apache': {
    category: 'Web Server',
    version: /Apache\/(\d+\.\d+(?:\.\d+)?)/i,
    accuracy: 0.93,
    detection: [
      { type: 'header', pattern: 'server', value: /Apache/i }
    ]
  },

  'IIS': {
    category: 'Web Server',
    version: /IIS\/(\d+\.\d+)/i,
    accuracy: 0.92,
    detection: [
      { type: 'header', pattern: 'server', value: /IIS/i },
      { type: 'header', pattern: 'x-powered-by', value: /ASP\.NET/i }
    ]
  },

  'Node.js': {
    category: 'Web Server',
    version: /Node\s*v?(\d+\.\d+\.\d+)/i,
    accuracy: 0.80,
    detection: [
      { type: 'header', pattern: 'server', value: /Node/i },
      { type: 'js-global', pattern: '__dirname' }
    ]
  },

  'Caddy': {
    category: 'Web Server',
    version: /Caddy\/(\d+\.\d+(?:\.\d+)?)/i,
    accuracy: 0.90,
    detection: [
      { type: 'header', pattern: 'server', value: /Caddy/i }
    ]
  },

  'LiteSpeed': {
    category: 'Web Server',
    version: /LiteSpeed\/(\d+\.\d+(?:\.\d+)?)/i,
    accuracy: 0.88,
    detection: [
      { type: 'header', pattern: 'server', value: /LiteSpeed/i }
    ]
  },

  'PHP': {
    category: 'Programming Language',
    version: /PHP\/(\d+\.\d+(?:\.\d+)?)/i,
    accuracy: 0.85,
    detection: [
      { type: 'header', pattern: 'x-powered-by', value: /PHP/i },
      { type: 'script', pattern: /\.php/ }
    ]
  },

  'Python': {
    category: 'Programming Language',
    version: /Python\/(\d+\.\d+(?:\.\d+)?)/i,
    accuracy: 0.75,
    detection: [
      { type: 'header', pattern: 'server', value: /Python/i }
    ]
  },

  // ==========================================
  // CSS Frameworks (8 technologies)
  // ==========================================

  'Bootstrap': {
    category: 'CSS Framework',
    version: /Bootstrap\s*v?(\d+\.\d+\.\d+)/i,
    accuracy: 0.88,
    detection: [
      { type: 'html', pattern: 'class=".*\\bbootstrap' },
      { type: 'script', pattern: /bootstrap(\.min)?\.js/ },
      { type: 'script', pattern: /bootstrap@/ }
    ]
  },

  'Tailwind CSS': {
    category: 'CSS Framework',
    version: null,
    accuracy: 0.80,
    detection: [
      { type: 'html', pattern: 'class=".*\\b[a-z]+-' },
      { type: 'script', pattern: /tailwindcss/ }
    ]
  },

  'Foundation': {
    category: 'CSS Framework',
    version: null,
    accuracy: 0.75,
    detection: [
      { type: 'html', pattern: '[data-foundation-' },
      { type: 'script', pattern: /foundation(@|\.js)/ }
    ]
  },

  'Bulma': {
    category: 'CSS Framework',
    version: null,
    accuracy: 0.70,
    detection: [
      { type: 'html', pattern: 'class=".*\\bbulma' },
      { type: 'script', pattern: /bulma/ }
    ]
  },

  'Materialize': {
    category: 'CSS Framework',
    version: null,
    accuracy: 0.75,
    detection: [
      { type: 'html', pattern: 'class=".*\\bmaterialize' },
      { type: 'script', pattern: /materialize(@|\.js)/ }
    ]
  },

  'Font Awesome': {
    category: 'Icon Library',
    version: null,
    accuracy: 0.85,
    detection: [
      { type: 'script', pattern: /font.*awesome/ },
      { type: 'html', pattern: 'class=".*\\bfa' }
    ]
  },

  'Google Fonts': {
    category: 'Font Library',
    version: null,
    accuracy: 0.80,
    detection: [
      { type: 'script', pattern: /fonts\.google\.com/ },
      { type: 'endpoint', pattern: '/fonts.googleapis.com/' }
    ]
  },

  // ==========================================
  // Analytics & Monitoring (12 technologies)
  // ==========================================

  'Google Analytics': {
    category: 'Analytics',
    version: null,
    accuracy: 0.92,
    detection: [
      { type: 'js-global', pattern: 'ga' },
      { type: 'js-global', pattern: 'gtag' },
      { type: 'script', pattern: /google-analytics|analytics\.js/ },
      { type: 'endpoint', pattern: '/google-analytics/' }
    ]
  },

  'Google Tag Manager': {
    category: 'Tag Manager',
    version: null,
    accuracy: 0.88,
    detection: [
      { type: 'script', pattern: /gtm\.js|googletagmanager/ },
      { type: 'html', pattern: 'GTM-' }
    ]
  },

  'Mixpanel': {
    category: 'Analytics',
    version: null,
    accuracy: 0.85,
    detection: [
      { type: 'js-global', pattern: 'mixpanel' },
      { type: 'script', pattern: /mixpanel/ }
    ]
  },

  'Amplitude': {
    category: 'Analytics',
    version: null,
    accuracy: 0.82,
    detection: [
      { type: 'js-global', pattern: 'amplitude' },
      { type: 'script', pattern: /amplitude/ }
    ]
  },

  'Segment': {
    category: 'Analytics',
    version: null,
    accuracy: 0.80,
    detection: [
      { type: 'js-global', pattern: 'analytics' },
      { type: 'script', pattern: /cdn\.segment\.com/ }
    ]
  },

  'Hotjar': {
    category: 'Analytics',
    version: null,
    accuracy: 0.88,
    detection: [
      { type: 'js-global', pattern: 'hj' },
      { type: 'script', pattern: /hotjar/ }
    ]
  },

  'Plausible': {
    category: 'Analytics',
    version: null,
    accuracy: 0.85,
    detection: [
      { type: 'script', pattern: /plausible/ }
    ]
  },

  'New Relic': {
    category: 'Monitoring',
    version: null,
    accuracy: 0.80,
    detection: [
      { type: 'js-global', pattern: 'newrelic' },
      { type: 'script', pattern: /nr-.*\.js/ }
    ]
  },

  'Sentry': {
    category: 'Error Tracking',
    version: null,
    accuracy: 0.85,
    detection: [
      { type: 'js-global', pattern: 'Sentry' },
      { type: 'script', pattern: /sentry.*\.js/ }
    ]
  },

  'Heap': {
    category: 'Analytics',
    version: null,
    accuracy: 0.82,
    detection: [
      { type: 'js-global', pattern: 'heap' },
      { type: 'script', pattern: /heap/ }
    ]
  },

  // ==========================================
  // CDN & Content Delivery (8 technologies)
  // ==========================================

  'Cloudflare': {
    category: 'CDN',
    version: null,
    accuracy: 0.90,
    detection: [
      { type: 'header', pattern: 'cf-ray', value: /./ },
      { type: 'header', pattern: 'server', value: /Cloudflare/i },
      { type: 'script', pattern: /cdn-cgi/ }
    ]
  },

  'AWS CloudFront': {
    category: 'CDN',
    version: null,
    accuracy: 0.88,
    detection: [
      { type: 'header', pattern: 'x-amz-cf-', value: /./ },
      { type: 'endpoint', pattern: 'd.cloudfront.net' }
    ]
  },

  'Akamai': {
    category: 'CDN',
    version: null,
    accuracy: 0.85,
    detection: [
      { type: 'header', pattern: 'x-akamai-', value: /./ },
      { type: 'script', pattern: /akamai/ }
    ]
  },

  'Fastly': {
    category: 'CDN',
    version: null,
    accuracy: 0.88,
    detection: [
      { type: 'header', pattern: 'x-fastly-request-id', value: /./ },
      { type: 'header', pattern: 'via', value: /Fastly/i }
    ]
  },

  'jsDelivr': {
    category: 'CDN',
    version: null,
    accuracy: 0.75,
    detection: [
      { type: 'endpoint', pattern: 'cdn.jsdelivr.net' },
      { type: 'script', pattern: /cdn\.jsdelivr/ }
    ]
  },

  'unpkg': {
    category: 'CDN',
    version: null,
    accuracy: 0.72,
    detection: [
      { type: 'endpoint', pattern: 'unpkg.com' },
      { type: 'script', pattern: /unpkg\.com/ }
    ]
  },

  // ==========================================
  // Security & Authentication (8 technologies)
  // ==========================================

  'reCAPTCHA': {
    category: 'Security',
    version: null,
    accuracy: 0.92,
    detection: [
      { type: 'script', pattern: /recaptcha.*\.js/ },
      { type: 'html', pattern: 'g-recaptcha' }
    ]
  },

  'hCaptcha': {
    category: 'Security',
    version: null,
    accuracy: 0.90,
    detection: [
      { type: 'script', pattern: /hcaptcha.*\.js/ },
      { type: 'html', pattern: 'h-captcha' }
    ]
  },

  'Auth0': {
    category: 'Authentication',
    version: null,
    accuracy: 0.88,
    detection: [
      { type: 'js-global', pattern: 'auth0' },
      { type: 'script', pattern: /auth0/ },
      { type: 'endpoint', pattern: 'auth0.com' }
    ]
  },

  'Firebase': {
    category: 'Backend-as-a-Service',
    version: null,
    accuracy: 0.85,
    detection: [
      { type: 'js-global', pattern: 'firebase' },
      { type: 'script', pattern: /firebase/ },
      { type: 'endpoint', pattern: 'firebaseapp.com' }
    ]
  },

  'PayPal': {
    category: 'Payment Processor',
    version: null,
    accuracy: 0.88,
    detection: [
      { type: 'script', pattern: /paypal.*\.js/ },
      { type: 'js-global', pattern: 'paypal' }
    ]
  },

  'Stripe': {
    category: 'Payment Processor',
    version: null,
    accuracy: 0.90,
    detection: [
      { type: 'script', pattern: /stripe.*\.js/ },
      { type: 'js-global', pattern: 'Stripe' }
    ]
  },

  // ==========================================
  // Other Frameworks & Platforms (8+ technologies)
  // ==========================================

  'Django': {
    category: 'Web Framework',
    version: /Django\s*(\d+\.\d+(?:\.\d+)?)/i,
    accuracy: 0.75,
    detection: [
      { type: 'header', pattern: 'x-powered-by', value: /Django/i },
      { type: 'endpoint', pattern: '/admin/' }
    ]
  },

  'Flask': {
    category: 'Web Framework',
    version: null,
    accuracy: 0.70,
    detection: [
      { type: 'header', pattern: 'server', value: /Werkzeug/i }
    ]
  },

  'Laravel': {
    category: 'Web Framework',
    version: null,
    accuracy: 0.78,
    detection: [
      { type: 'header', pattern: 'x-powered-by', value: /Laravel/i },
      { type: 'endpoint', pattern: '/laravel' }
    ]
  },

  'Ruby on Rails': {
    category: 'Web Framework',
    version: null,
    accuracy: 0.75,
    detection: [
      { type: 'header', pattern: 'x-powered-by', value: /Rails/i },
      { type: 'header', pattern: 'x-runtime', value: /./ }
    ]
  },

  'ASP.NET': {
    category: 'Web Framework',
    version: /ASP\.NET\/(\d+\.\d+(?:\.\d+)?)/i,
    accuracy: 0.85,
    detection: [
      { type: 'header', pattern: 'x-powered-by', value: /ASP\.NET/i },
      { type: 'endpoint', pattern: '/aspnet_client/' }
    ]
  },

  // ==========================================
  // Additional Frameworks & Tools (30+ technologies)
  // ==========================================

  'Express': {
    category: 'Web Framework',
    version: /Express[\s\/]+([\d.]+)/i,
    accuracy: 0.80,
    detection: [
      { type: 'header', pattern: 'x-powered-by', value: /Express/i },
      { type: 'js-global', pattern: 'Express' }
    ]
  },

  'Fastify': {
    category: 'Web Framework',
    version: /Fastify[\s\/]+([\d.]+)/i,
    accuracy: 0.82,
    detection: [
      { type: 'header', pattern: 'x-powered-by', value: /Fastify/i }
    ]
  },

  'Spring Boot': {
    category: 'Web Framework',
    version: /Spring.Boot[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'header', pattern: 'x-powered-by', value: /Spring/i },
      { type: 'endpoint', pattern: '/actuator' }
    ]
  },

  'Tomcat': {
    category: 'Web Server',
    version: /Apache.Tomcat[\s\/]+([\d.]+)/i,
    accuracy: 0.90,
    detection: [
      { type: 'header', pattern: 'server', value: /Tomcat/i },
      { type: 'endpoint', pattern: '/manager/html' }
    ]
  },

  'Jetty': {
    category: 'Web Server',
    version: /Jetty[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'header', pattern: 'server', value: /Jetty/i }
    ]
  },

  'Caddy': {
    category: 'Web Server',
    version: /Caddy[\s\/]+([\d.]+)/i,
    accuracy: 0.88,
    detection: [
      { type: 'header', pattern: 'server', value: /Caddy/i }
    ]
  },

  'LiteSpeed': {
    category: 'Web Server',
    version: /LiteSpeed[\s\/]+([\d.]+)/i,
    accuracy: 0.90,
    detection: [
      { type: 'header', pattern: 'server', value: /LiteSpeed/i }
    ]
  },

  'Lightbend': {
    category: 'Runtime',
    version: /Lightbend[\s\/]+([\d.]+)/i,
    accuracy: 0.80,
    detection: [
      { type: 'header', pattern: 'x-powered-by', value: /Lightbend/i }
    ]
  },

  'Elixir': {
    category: 'Language',
    version: /Elixir[\s\/]+([\d.]+)/i,
    accuracy: 0.75,
    detection: [
      { type: 'header', pattern: 'x-powered-by', value: /Elixir/i }
    ]
  },

  'Go': {
    category: 'Language',
    version: /Go[\s\/]+([\d.]+)/i,
    accuracy: 0.75,
    detection: [
      { type: 'header', pattern: 'x-powered-by', value: /Go/i }
    ]
  },

  'Rust': {
    category: 'Language',
    version: /Rust[\s\/]+([\d.]+)/i,
    accuracy: 0.75,
    detection: [
      { type: 'header', pattern: 'x-powered-by', value: /Rust/i }
    ]
  },

  'Grafana': {
    category: 'Monitoring',
    version: /Grafana[\s\/]+([\d.]+)/i,
    accuracy: 0.92,
    detection: [
      { type: 'html', pattern: 'grafana-app' },
      { type: 'script', pattern: /grafana.*\.js/ },
      { type: 'endpoint', pattern: '/api/datasources' }
    ]
  },

  'Prometheus': {
    category: 'Monitoring',
    version: /Prometheus[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'endpoint', pattern: '/metrics' },
      { type: 'endpoint', pattern: '/api/v1/query' }
    ]
  },

  'New Relic': {
    category: 'APM',
    version: /NewRelic[\s\/]+([\d.]+)/i,
    accuracy: 0.88,
    detection: [
      { type: 'script', pattern: /newrelic.*\.js/ },
      { type: 'js-global', pattern: 'newrelic' }
    ]
  },

  'Datadog': {
    category: 'APM',
    version: /Datadog[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'script', pattern: /datadog.*\.js/ },
      { type: 'js-global', pattern: 'datadog' }
    ]
  },

  'Sentry': {
    category: 'Error Tracking',
    version: /Sentry[\s\/]+([\d.]+)/i,
    accuracy: 0.88,
    detection: [
      { type: 'script', pattern: /sentry.*\.js/ },
      { type: 'js-global', pattern: 'Sentry' }
    ]
  },

  'Rollbar': {
    category: 'Error Tracking',
    version: /Rollbar[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'script', pattern: /rollbar.*\.js/ },
      { type: 'js-global', pattern: 'Rollbar' }
    ]
  },

  'Segment': {
    category: 'Analytics',
    version: /Segment[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'script', pattern: /segment.*\.js/ },
      { type: 'js-global', pattern: 'analytics' }
    ]
  },

  'Amplitude': {
    category: 'Analytics',
    version: /Amplitude[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'script', pattern: /amplitude.*\.js/ },
      { type: 'js-global', pattern: 'amplitude' }
    ]
  },

  'Mixpanel': {
    category: 'Analytics',
    version: /Mixpanel[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'script', pattern: /mixpanel.*\.js/ },
      { type: 'js-global', pattern: 'mixpanel' }
    ]
  },

  'Matomo': {
    category: 'Analytics',
    version: /Matomo[\s\/]+([\d.]+)/i,
    accuracy: 0.88,
    detection: [
      { type: 'script', pattern: /matomo.*\.js/ },
      { type: 'endpoint', pattern: '/matomo.php' }
    ]
  },

  'Typeform': {
    category: 'Form Builder',
    version: /Typeform[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'script', pattern: /typeform.*\.js/ },
      { type: 'html', pattern: 'data-typeform' }
    ]
  },

  'Intercom': {
    category: 'Customer Support',
    version: /Intercom[\s\/]+([\d.]+)/i,
    accuracy: 0.88,
    detection: [
      { type: 'script', pattern: /intercom.*\.js/ },
      { type: 'js-global', pattern: 'Intercom' }
    ]
  },

  'Zendesk': {
    category: 'Customer Support',
    version: /Zendesk[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'script', pattern: /zendesk.*\.js/ },
      { type: 'html', pattern: 'zendesk_widget' }
    ]
  },

  'Auth0': {
    category: 'Authentication',
    version: /Auth0[\s\/]+([\d.]+)/i,
    accuracy: 0.90,
    detection: [
      { type: 'script', pattern: /auth0.*\.js/ },
      { type: 'js-global', pattern: 'auth0' },
      { type: 'endpoint', pattern: '/.well-known/openid-configuration' }
    ]
  },

  'Okta': {
    category: 'Authentication',
    version: /Okta[\s\/]+([\d.]+)/i,
    accuracy: 0.90,
    detection: [
      { type: 'script', pattern: /okta.*\.js/ },
      { type: 'js-global', pattern: 'okta' }
    ]
  },

  'Stripe': {
    category: 'Payment Processing',
    version: /Stripe[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'script', pattern: /stripe.*\.js/ },
      { type: 'js-global', pattern: 'Stripe' }
    ]
  },

  'PayPal': {
    category: 'Payment Processing',
    version: /PayPal[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'script', pattern: /paypal.*\.js/ },
      { type: 'js-global', pattern: 'paypal' }
    ]
  },

  'Elasticsearch': {
    category: 'Search Engine',
    version: /Elasticsearch[\s\/]+([\d.]+)/i,
    accuracy: 0.92,
    detection: [
      { type: 'endpoint', pattern: '/_cat/health' },
      { type: 'header', pattern: 'x-elastic-product', value: /Elasticsearch/i }
    ]
  },

  'Solr': {
    category: 'Search Engine',
    version: /Apache.Solr[\s\/]+([\d.]+)/i,
    accuracy: 0.90,
    detection: [
      { type: 'endpoint', pattern: '/solr/admin' }
    ]
  },

  'Sphinx': {
    category: 'Search Engine',
    version: /Sphinx[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'endpoint', pattern: '/sphinx' }
    ]
  },

  'Redis': {
    category: 'Cache',
    version: /Redis[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'endpoint', pattern: '/:6379' }
    ]
  },

  'Memcached': {
    category: 'Cache',
    version: /Memcached[\s\/]+([\d.]+)/i,
    accuracy: 0.80,
    detection: [
      { type: 'endpoint', pattern: '/:11211' }
    ]
  },

  'MongoDB': {
    category: 'Database',
    version: /MongoDB[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'endpoint', pattern: '/:27017' }
    ]
  },

  'PostgreSQL': {
    category: 'Database',
    version: /PostgreSQL[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'endpoint', pattern: '/:5432' }
    ]
  },

  'MySQL': {
    category: 'Database',
    version: /MySQL[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'endpoint', pattern: '/:3306' }
    ]
  },

  'SQLite': {
    category: 'Database',
    version: /SQLite[\s\/]+([\d.]+)/i,
    accuracy: 0.80,
    detection: [
      { type: 'endpoint', pattern: '.sqlite' }
    ]
  },

  'MariaDB': {
    category: 'Database',
    version: /MariaDB[\s\/]+([\d.]+)/i,
    accuracy: 0.85,
    detection: [
      { type: 'endpoint', pattern: '/:3306' }
    ]
  }
};

/**
 * Get technology signature by name
 * @param {string} name - Technology name
 * @returns {object|null} Technology signature or null if not found
 */
function getSignature(name) {
  return TECH_SIGNATURES[name] || null;
}

/**
 * Get all technology signatures
 * @returns {object} All signatures keyed by name
 */
function getAllSignatures() {
  return TECH_SIGNATURES;
}

/**
 * Get all technology names
 * @returns {array} Array of technology names
 */
function getTechnologyNames() {
  return Object.keys(TECH_SIGNATURES).sort((a, b) => a.localeCompare(b));
}

/**
 * Get technologies by category
 * @param {string} category - Category name
 * @returns {array} Array of technology names in that category
 */
function getTechnologiesByCategory(category) {
  return Object.entries(TECH_SIGNATURES)
    .filter(([_, sig]) => sig.category === category)
    .map(([name, _]) => name)
    .sort();
}

/**
 * Get all unique categories
 * @returns {array} Array of category names
 */
function getCategories() {
  const categories = new Set();
  Object.values(TECH_SIGNATURES).forEach(sig => {
    categories.add(sig.category);
  });
  return Array.from(categories).sort((a, b) => a.localeCompare(b));
}

module.exports = {
  TECH_SIGNATURES,
  getSignature,
  getAllSignatures,
  getTechnologyNames,
  getTechnologiesByCategory,
  getCategories
};
