/**
 * Basset Hound Browser - Technology Fingerprints Database
 * Contains patterns for detecting web technologies from various sources:
 * - HTML content patterns
 * - HTTP header patterns
 * - Script URL patterns
 * - Cookie patterns
 * - Meta tag patterns
 * - CSS patterns
 *
 * Inspired by Wappalyzer patterns but implemented independently
 */

/**
 * Technology categories for classification
 */
const CATEGORIES = {
  JAVASCRIPT_FRAMEWORKS: 'JavaScript Frameworks',
  FRONTEND_FRAMEWORKS: 'Frontend Frameworks',
  CMS: 'Content Management Systems',
  ECOMMERCE: 'E-commerce',
  WEB_SERVERS: 'Web Servers',
  ANALYTICS: 'Analytics',
  CDN: 'CDN',
  JAVASCRIPT_LIBRARIES: 'JavaScript Libraries',
  CSS_FRAMEWORKS: 'CSS Frameworks',
  BUILD_TOOLS: 'Build Tools',
  SECURITY: 'Security',
  CACHING: 'Caching',
  HOSTING: 'Hosting',
  PAYMENT: 'Payment Processors',
  MARKETING: 'Marketing Automation',
  TAG_MANAGERS: 'Tag Managers',
  PROGRAMMING_LANGUAGES: 'Programming Languages',
  DATABASES: 'Databases',
  MESSAGE_QUEUES: 'Message Queues',
  SEARCH_ENGINES: 'Search Engines',
  WIDGETS: 'Widgets',
  FONT_SCRIPTS: 'Font Scripts',
  VIDEO_PLAYERS: 'Video Players',
  MAPS: 'Maps',
  SOCIAL: 'Social',
  AUTHENTICATION: 'Authentication'
};

/**
 * Technology fingerprint database
 * Each technology has:
 * - name: Display name
 * - category: Category from CATEGORIES
 * - website: Official website
 * - icon: Icon identifier (optional)
 * - patterns: Detection patterns organized by type
 */
const FINGERPRINTS = {
  // ==========================================
  // JavaScript Frameworks
  // ==========================================
  react: {
    name: 'React',
    category: CATEGORIES.JAVASCRIPT_FRAMEWORKS,
    website: 'https://reactjs.org',
    description: 'A JavaScript library for building user interfaces',
    patterns: {
      html: [
        /<div[^>]+id=["'](?:root|app|__next)["']/i,
        /data-reactroot/i,
        /data-reactid/i,
        /__NEXT_DATA__/
      ],
      scripts: [
        /react(?:\.production)?(?:\.min)?\.js/i,
        /react-dom(?:\.production)?(?:\.min)?\.js/i,
        /unpkg\.com\/react/i,
        /cdnjs\.cloudflare\.com\/ajax\/libs\/react/i
      ],
      js: [
        /React\.createElement/,
        /ReactDOM\.render/,
        /_reactRootContainer/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  vue: {
    name: 'Vue.js',
    category: CATEGORIES.JAVASCRIPT_FRAMEWORKS,
    website: 'https://vuejs.org',
    description: 'The Progressive JavaScript Framework',
    patterns: {
      html: [
        /data-v-[a-f0-9]+/i,
        /id=["']app["'][^>]*>[\s\S]*?<\/div>\s*<script/i,
        /__NUXT__/
      ],
      scripts: [
        /vue(?:\.runtime)?(?:\.esm)?(?:\.min)?\.js/i,
        /unpkg\.com\/vue/i,
        /cdnjs\.cloudflare\.com\/ajax\/libs\/vue/i,
        /cdn\.jsdelivr\.net\/npm\/vue/i
      ],
      js: [
        /Vue\.component/,
        /new Vue\(/,
        /__vue__/
      ],
      meta: [
        { name: 'generator', content: /nuxt/i }
      ],
      headers: [],
      cookies: []
    }
  },

  angular: {
    name: 'Angular',
    category: CATEGORIES.JAVASCRIPT_FRAMEWORKS,
    website: 'https://angular.io',
    description: 'Platform for building mobile and desktop web applications',
    patterns: {
      html: [
        /ng-version=["'][0-9]+/i,
        /<app-root/i,
        /ng-app=/i,
        /_nghost-/,
        /_ngcontent-/
      ],
      scripts: [
        /angular(?:\.min)?\.js/i,
        /zone(?:\.min)?\.js/i,
        /runtime(?:-es\d+)?(?:\.[\da-f]+)?\.js/i,
        /polyfills(?:-es\d+)?(?:\.[\da-f]+)?\.js/i
      ],
      js: [
        /angular\.module/,
        /\$scope/,
        /ng\.probe/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  svelte: {
    name: 'Svelte',
    category: CATEGORIES.JAVASCRIPT_FRAMEWORKS,
    website: 'https://svelte.dev',
    description: 'Cybernetically enhanced web apps',
    patterns: {
      html: [
        /svelte-[a-z0-9]+/i,
        /__svelte/
      ],
      scripts: [
        /svelte(?:\.min)?\.js/i,
        /@sveltejs/i
      ],
      js: [],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  nextjs: {
    name: 'Next.js',
    category: CATEGORIES.JAVASCRIPT_FRAMEWORKS,
    website: 'https://nextjs.org',
    description: 'The React Framework for Production',
    patterns: {
      html: [
        /__NEXT_DATA__/,
        /_next\/static/,
        /id=["']__next["']/
      ],
      scripts: [
        /_next\/static\/chunks/i,
        /next\/dist/i
      ],
      js: [],
      meta: [
        { name: 'generator', content: /next\.js/i }
      ],
      headers: [
        { name: 'x-powered-by', value: /next\.js/i }
      ],
      cookies: []
    }
  },

  nuxtjs: {
    name: 'Nuxt.js',
    category: CATEGORIES.JAVASCRIPT_FRAMEWORKS,
    website: 'https://nuxtjs.org',
    description: 'The Intuitive Vue Framework',
    patterns: {
      html: [
        /__NUXT__/,
        /_nuxt\//,
        /id=["']__nuxt["']/
      ],
      scripts: [
        /_nuxt\//i
      ],
      js: [],
      meta: [
        { name: 'generator', content: /nuxt/i }
      ],
      headers: [],
      cookies: []
    }
  },

  gatsby: {
    name: 'Gatsby',
    category: CATEGORIES.JAVASCRIPT_FRAMEWORKS,
    website: 'https://www.gatsbyjs.com',
    description: 'Build blazing fast, modern apps and websites with React',
    patterns: {
      html: [
        /id=["']___gatsby["']/,
        /gatsby-/
      ],
      scripts: [
        /gatsby-/i,
        /page-data\.json/i
      ],
      js: [],
      meta: [
        { name: 'generator', content: /gatsby/i }
      ],
      headers: [],
      cookies: []
    }
  },

  ember: {
    name: 'Ember.js',
    category: CATEGORIES.JAVASCRIPT_FRAMEWORKS,
    website: 'https://emberjs.com',
    description: 'A framework for ambitious web developers',
    patterns: {
      html: [
        /ember-view/i,
        /data-ember-action/i
      ],
      scripts: [
        /ember(?:\.min)?\.js/i
      ],
      js: [
        /Ember\.Application/,
        /Ember\.Component/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  backbone: {
    name: 'Backbone.js',
    category: CATEGORIES.JAVASCRIPT_FRAMEWORKS,
    website: 'https://backbonejs.org',
    description: 'Give your JS App some Backbone with Models, Views, Collections, and Events',
    patterns: {
      html: [],
      scripts: [
        /backbone(?:\.min)?\.js/i
      ],
      js: [
        /Backbone\.Model/,
        /Backbone\.View/,
        /Backbone\.Collection/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  // ==========================================
  // JavaScript Libraries
  // ==========================================
  jquery: {
    name: 'jQuery',
    category: CATEGORIES.JAVASCRIPT_LIBRARIES,
    website: 'https://jquery.com',
    description: 'A fast, small, and feature-rich JavaScript library',
    patterns: {
      html: [],
      scripts: [
        /jquery[.-]?(\d+(?:\.\d+)*)?(?:\.min)?\.js/i,
        /code\.jquery\.com/i,
        /ajax\.googleapis\.com\/ajax\/libs\/jquery/i,
        /cdnjs\.cloudflare\.com\/ajax\/libs\/jquery/i
      ],
      js: [
        /jQuery\.fn\.jquery/,
        /\$\.fn\.jquery/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  lodash: {
    name: 'Lodash',
    category: CATEGORIES.JAVASCRIPT_LIBRARIES,
    website: 'https://lodash.com',
    description: 'A modern JavaScript utility library delivering modularity, performance & extras',
    patterns: {
      html: [],
      scripts: [
        /lodash(?:\.min)?\.js/i,
        /cdnjs\.cloudflare\.com\/ajax\/libs\/lodash/i
      ],
      js: [
        /_.VERSION/,
        /lodash/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  underscore: {
    name: 'Underscore.js',
    category: CATEGORIES.JAVASCRIPT_LIBRARIES,
    website: 'https://underscorejs.org',
    description: 'JavaScript library that provides functional programming helpers',
    patterns: {
      html: [],
      scripts: [
        /underscore(?:\.min)?\.js/i
      ],
      js: [
        /_.VERSION/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  momentjs: {
    name: 'Moment.js',
    category: CATEGORIES.JAVASCRIPT_LIBRARIES,
    website: 'https://momentjs.com',
    description: 'Parse, validate, manipulate, and display dates and times in JavaScript',
    patterns: {
      html: [],
      scripts: [
        /moment(?:\.min)?\.js/i,
        /cdnjs\.cloudflare\.com\/ajax\/libs\/moment/i
      ],
      js: [
        /moment\.version/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  axios: {
    name: 'Axios',
    category: CATEGORIES.JAVASCRIPT_LIBRARIES,
    website: 'https://axios-http.com',
    description: 'Promise based HTTP client for the browser and node.js',
    patterns: {
      html: [],
      scripts: [
        /axios(?:\.min)?\.js/i,
        /cdnjs\.cloudflare\.com\/ajax\/libs\/axios/i
      ],
      js: [
        /axios\.create/,
        /axios\.get/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  d3js: {
    name: 'D3.js',
    category: CATEGORIES.JAVASCRIPT_LIBRARIES,
    website: 'https://d3js.org',
    description: 'Data-Driven Documents',
    patterns: {
      html: [],
      scripts: [
        /d3(?:\.min)?\.js/i,
        /d3js\.org/i
      ],
      js: [
        /d3\.version/,
        /d3\.select/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  threejs: {
    name: 'Three.js',
    category: CATEGORIES.JAVASCRIPT_LIBRARIES,
    website: 'https://threejs.org',
    description: 'JavaScript 3D Library',
    patterns: {
      html: [],
      scripts: [
        /three(?:\.min)?\.js/i
      ],
      js: [
        /THREE\.REVISION/,
        /THREE\.Scene/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  chartjs: {
    name: 'Chart.js',
    category: CATEGORIES.JAVASCRIPT_LIBRARIES,
    website: 'https://www.chartjs.org',
    description: 'Simple yet flexible JavaScript charting for designers & developers',
    patterns: {
      html: [],
      scripts: [
        /chart(?:\.min)?\.js/i,
        /cdnjs\.cloudflare\.com\/ajax\/libs\/Chart/i
      ],
      js: [
        /Chart\.version/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  gsap: {
    name: 'GSAP',
    category: CATEGORIES.JAVASCRIPT_LIBRARIES,
    website: 'https://greensock.com/gsap/',
    description: 'Professional-grade JavaScript animation for the modern web',
    patterns: {
      html: [],
      scripts: [
        /gsap(?:\.min)?\.js/i,
        /TweenMax(?:\.min)?\.js/i,
        /TweenLite(?:\.min)?\.js/i
      ],
      js: [
        /gsap\.version/,
        /TweenMax/,
        /TweenLite/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  // ==========================================
  // CSS Frameworks
  // ==========================================
  bootstrap: {
    name: 'Bootstrap',
    category: CATEGORIES.CSS_FRAMEWORKS,
    website: 'https://getbootstrap.com',
    description: 'The most popular HTML, CSS, and JS library in the world',
    patterns: {
      html: [
        /class=["'][^"']*\b(?:container|container-fluid|row|col-(?:xs|sm|md|lg|xl)-\d+)\b/i,
        /class=["'][^"']*\bbtn\s+btn-(?:primary|secondary|success|danger|warning|info|light|dark)\b/i
      ],
      scripts: [
        /bootstrap(?:\.bundle)?(?:\.min)?\.js/i,
        /cdnjs\.cloudflare\.com\/ajax\/libs\/twitter-bootstrap/i,
        /maxcdn\.bootstrapcdn\.com/i
      ],
      css: [
        /bootstrap(?:\.min)?\.css/i
      ],
      js: [],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  tailwindcss: {
    name: 'Tailwind CSS',
    category: CATEGORIES.CSS_FRAMEWORKS,
    website: 'https://tailwindcss.com',
    description: 'A utility-first CSS framework',
    patterns: {
      html: [
        /class=["'][^"']*\b(?:flex|grid|hidden|block|inline-block|items-center|justify-center|p-\d+|m-\d+|text-\w+-\d+|bg-\w+-\d+|rounded-\w+)\b/i
      ],
      scripts: [
        /tailwind(?:css)?(?:\.min)?\.js/i
      ],
      css: [
        /tailwind(?:css)?(?:\.min)?\.css/i
      ],
      js: [],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  bulma: {
    name: 'Bulma',
    category: CATEGORIES.CSS_FRAMEWORKS,
    website: 'https://bulma.io',
    description: 'The modern CSS framework that just works',
    patterns: {
      html: [
        /class=["'][^"']*\b(?:is-primary|is-link|is-info|is-success|is-warning|is-danger|is-light|is-dark)\b/i,
        /class=["'][^"']*\bcolumns?\b/i
      ],
      scripts: [],
      css: [
        /bulma(?:\.min)?\.css/i
      ],
      js: [],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  materialui: {
    name: 'Material-UI',
    category: CATEGORIES.CSS_FRAMEWORKS,
    website: 'https://mui.com',
    description: 'React components for faster and easier web development',
    patterns: {
      html: [
        /class=["'][^"']*\bMui[A-Z]/,
        /class=["'][^"']*\bmui-/i
      ],
      scripts: [
        /@mui\/material/i,
        /@material-ui/i
      ],
      css: [],
      js: [],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  foundation: {
    name: 'Foundation',
    category: CATEGORIES.CSS_FRAMEWORKS,
    website: 'https://get.foundation',
    description: 'The most advanced responsive front-end framework in the world',
    patterns: {
      html: [
        /class=["'][^"']*\b(?:small|medium|large)-\d+\s+columns?\b/i
      ],
      scripts: [
        /foundation(?:\.min)?\.js/i
      ],
      css: [
        /foundation(?:\.min)?\.css/i
      ],
      js: [
        /Foundation\.version/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  // ==========================================
  // CMS
  // ==========================================
  wordpress: {
    name: 'WordPress',
    category: CATEGORIES.CMS,
    website: 'https://wordpress.org',
    description: 'Open source software you can use to create a beautiful website, blog, or app',
    patterns: {
      html: [
        /wp-content/i,
        /wp-includes/i,
        /wp-json/i,
        /class=["'][^"']*\bwordpress\b/i
      ],
      scripts: [
        /wp-includes/i,
        /wp-content\/plugins/i,
        /wp-content\/themes/i
      ],
      css: [
        /wp-content\/themes/i
      ],
      js: [],
      meta: [
        { name: 'generator', content: /wordpress/i }
      ],
      headers: [
        { name: 'x-powered-by', value: /wordpress/i },
        { name: 'link', value: /wp-json/i }
      ],
      cookies: [
        /wordpress/i,
        /wp-settings/i
      ]
    }
  },

  drupal: {
    name: 'Drupal',
    category: CATEGORIES.CMS,
    website: 'https://www.drupal.org',
    description: 'Open source content management platform',
    patterns: {
      html: [
        /\/sites\/default\/files/i,
        /\/sites\/all\/themes/i,
        /Drupal\.settings/i,
        /drupal\.js/i
      ],
      scripts: [
        /drupal\.js/i,
        /\/sites\/all\/modules/i
      ],
      css: [
        /\/sites\/all\/themes/i
      ],
      js: [
        /Drupal\./
      ],
      meta: [
        { name: 'generator', content: /drupal/i }
      ],
      headers: [
        { name: 'x-drupal-cache', value: /.+/ },
        { name: 'x-generator', value: /drupal/i }
      ],
      cookies: [
        /Drupal/i,
        /SESS[a-f0-9]+/i
      ]
    }
  },

  joomla: {
    name: 'Joomla',
    category: CATEGORIES.CMS,
    website: 'https://www.joomla.org',
    description: 'Content management system (CMS) - open source platform',
    patterns: {
      html: [
        /\/media\/jui\//i,
        /\/media\/system\/js/i,
        /Joomla\./i
      ],
      scripts: [
        /\/media\/jui\/js/i,
        /\/media\/system\/js/i
      ],
      css: [],
      js: [
        /Joomla\./
      ],
      meta: [
        { name: 'generator', content: /joomla/i }
      ],
      headers: [],
      cookies: [
        /joomla/i
      ]
    }
  },

  shopify: {
    name: 'Shopify',
    category: CATEGORIES.ECOMMERCE,
    website: 'https://www.shopify.com',
    description: 'E-commerce platform for online stores and retail point-of-sale systems',
    patterns: {
      html: [
        /cdn\.shopify\.com/i,
        /Shopify\.theme/i,
        /shopify-section/i
      ],
      scripts: [
        /cdn\.shopify\.com/i,
        /shopify.*\.js/i
      ],
      css: [
        /cdn\.shopify\.com/i
      ],
      js: [
        /Shopify\./,
        /ShopifyAnalytics/
      ],
      meta: [],
      headers: [
        { name: 'x-shopify-stage', value: /.+/ },
        { name: 'x-shopid', value: /.+/ }
      ],
      cookies: [
        /_shopify/i,
        /cart_sig/i
      ]
    }
  },

  wix: {
    name: 'Wix',
    category: CATEGORIES.CMS,
    website: 'https://www.wix.com',
    description: 'Create a free website with Wix',
    patterns: {
      html: [
        /static\.wixstatic\.com/i,
        /wix-code-/i
      ],
      scripts: [
        /static\.parastorage\.com/i,
        /wix/i
      ],
      css: [],
      js: [],
      meta: [
        { name: 'generator', content: /wix/i }
      ],
      headers: [
        { name: 'x-wix-request-id', value: /.+/ }
      ],
      cookies: [
        /wix/i
      ]
    }
  },

  squarespace: {
    name: 'Squarespace',
    category: CATEGORIES.CMS,
    website: 'https://www.squarespace.com',
    description: 'Website builder and hosting platform',
    patterns: {
      html: [
        /static\.squarespace\.com/i,
        /squarespace-cdn/i
      ],
      scripts: [
        /static\.squarespace\.com/i
      ],
      css: [
        /static\.squarespace\.com/i
      ],
      js: [],
      meta: [
        { name: 'generator', content: /squarespace/i }
      ],
      headers: [],
      cookies: [
        /ss_/i
      ]
    }
  },

  ghost: {
    name: 'Ghost',
    category: CATEGORIES.CMS,
    website: 'https://ghost.org',
    description: 'Independent technology for modern publishing',
    patterns: {
      html: [
        /ghost-/i
      ],
      scripts: [],
      css: [],
      js: [],
      meta: [
        { name: 'generator', content: /ghost/i }
      ],
      headers: [
        { name: 'x-ghost-cache-status', value: /.+/ }
      ],
      cookies: [
        /ghost/i
      ]
    }
  },

  magento: {
    name: 'Magento',
    category: CATEGORIES.ECOMMERCE,
    website: 'https://magento.com',
    description: 'eCommerce Platforms and Solutions',
    patterns: {
      html: [
        /\/static\/version/i,
        /mage\/cookies/i,
        /Mage\.Cookies/i
      ],
      scripts: [
        /mage\/cookies/i,
        /requirejs-config/i
      ],
      css: [],
      js: [
        /Mage\./,
        /mage\//
      ],
      meta: [],
      headers: [
        { name: 'x-magento-vary', value: /.+/ }
      ],
      cookies: [
        /mage-/i,
        /PHPSESSID/i
      ]
    }
  },

  woocommerce: {
    name: 'WooCommerce',
    category: CATEGORIES.ECOMMERCE,
    website: 'https://woocommerce.com',
    description: 'Open-source eCommerce platform built on WordPress',
    patterns: {
      html: [
        /woocommerce/i,
        /wc-/i
      ],
      scripts: [
        /woocommerce/i,
        /wc-/i
      ],
      css: [
        /woocommerce/i
      ],
      js: [
        /wc_add_to_cart/,
        /woocommerce/
      ],
      meta: [
        { name: 'generator', content: /woocommerce/i }
      ],
      headers: [],
      cookies: [
        /woocommerce/i,
        /wc_/i
      ]
    }
  },

  // ==========================================
  // Web Servers
  // ==========================================
  nginx: {
    name: 'Nginx',
    category: CATEGORIES.WEB_SERVERS,
    website: 'https://nginx.org',
    description: 'High Performance Load Balancer, Web Server, & Reverse Proxy',
    patterns: {
      html: [],
      scripts: [],
      css: [],
      js: [],
      meta: [],
      headers: [
        { name: 'server', value: /nginx/i },
        { name: 'x-server', value: /nginx/i }
      ],
      cookies: []
    }
  },

  apache: {
    name: 'Apache',
    category: CATEGORIES.WEB_SERVERS,
    website: 'https://httpd.apache.org',
    description: 'The Apache HTTP Server Project',
    patterns: {
      html: [],
      scripts: [],
      css: [],
      js: [],
      meta: [],
      headers: [
        { name: 'server', value: /apache/i },
        { name: 'x-powered-by', value: /apache/i }
      ],
      cookies: []
    }
  },

  iis: {
    name: 'Microsoft IIS',
    category: CATEGORIES.WEB_SERVERS,
    website: 'https://www.iis.net',
    description: 'Internet Information Services',
    patterns: {
      html: [],
      scripts: [],
      css: [],
      js: [],
      meta: [],
      headers: [
        { name: 'server', value: /iis/i },
        { name: 'server', value: /microsoft/i },
        { name: 'x-aspnet-version', value: /.+/ },
        { name: 'x-powered-by', value: /asp\.net/i }
      ],
      cookies: [
        /ASP\.NET/i
      ]
    }
  },

  litespeed: {
    name: 'LiteSpeed',
    category: CATEGORIES.WEB_SERVERS,
    website: 'https://www.litespeedtech.com',
    description: 'High-Performance Web Server',
    patterns: {
      html: [],
      scripts: [],
      css: [],
      js: [],
      meta: [],
      headers: [
        { name: 'server', value: /litespeed/i },
        { name: 'x-litespeed-cache', value: /.+/ }
      ],
      cookies: []
    }
  },

  caddy: {
    name: 'Caddy',
    category: CATEGORIES.WEB_SERVERS,
    website: 'https://caddyserver.com',
    description: 'Fast, multi-platform web server with automatic HTTPS',
    patterns: {
      html: [],
      scripts: [],
      css: [],
      js: [],
      meta: [],
      headers: [
        { name: 'server', value: /caddy/i }
      ],
      cookies: []
    }
  },

  // ==========================================
  // Analytics
  // ==========================================
  googleanalytics: {
    name: 'Google Analytics',
    category: CATEGORIES.ANALYTICS,
    website: 'https://analytics.google.com',
    description: 'Web analytics service offered by Google',
    patterns: {
      html: [
        /google-analytics\.com\/analytics/i,
        /googletagmanager\.com\/gtag/i,
        /UA-\d+-\d+/,
        /G-[A-Z0-9]+/
      ],
      scripts: [
        /google-analytics\.com/i,
        /googletagmanager\.com\/gtag/i,
        /gtag\//i
      ],
      css: [],
      js: [
        /ga\(/,
        /gtag\(/,
        /_gaq/
      ],
      meta: [],
      headers: [],
      cookies: [
        /_ga/i,
        /_gid/i,
        /_gat/i
      ]
    }
  },

  googletagmanager: {
    name: 'Google Tag Manager',
    category: CATEGORIES.TAG_MANAGERS,
    website: 'https://tagmanager.google.com',
    description: 'Tag management system by Google',
    patterns: {
      html: [
        /googletagmanager\.com\/gtm\.js/i,
        /GTM-[A-Z0-9]+/
      ],
      scripts: [
        /googletagmanager\.com/i
      ],
      css: [],
      js: [
        /dataLayer/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  mixpanel: {
    name: 'Mixpanel',
    category: CATEGORIES.ANALYTICS,
    website: 'https://mixpanel.com',
    description: 'Product analytics for mobile, web, and beyond',
    patterns: {
      html: [],
      scripts: [
        /cdn\.mxpnl\.com/i,
        /mixpanel/i
      ],
      css: [],
      js: [
        /mixpanel\./
      ],
      meta: [],
      headers: [],
      cookies: [
        /mp_/i,
        /mixpanel/i
      ]
    }
  },

  hotjar: {
    name: 'Hotjar',
    category: CATEGORIES.ANALYTICS,
    website: 'https://www.hotjar.com',
    description: 'Website heatmaps and behavior analytics',
    patterns: {
      html: [],
      scripts: [
        /static\.hotjar\.com/i,
        /hotjar/i
      ],
      css: [],
      js: [
        /hj\(/,
        /Hotjar/
      ],
      meta: [],
      headers: [],
      cookies: [
        /_hj/i
      ]
    }
  },

  segment: {
    name: 'Segment',
    category: CATEGORIES.ANALYTICS,
    website: 'https://segment.com',
    description: 'Customer data platform',
    patterns: {
      html: [],
      scripts: [
        /cdn\.segment\.com/i,
        /analytics\.js/i
      ],
      css: [],
      js: [
        /analytics\.track/,
        /analytics\.identify/
      ],
      meta: [],
      headers: [],
      cookies: [
        /ajs_/i
      ]
    }
  },

  amplitude: {
    name: 'Amplitude',
    category: CATEGORIES.ANALYTICS,
    website: 'https://amplitude.com',
    description: 'Product analytics platform',
    patterns: {
      html: [],
      scripts: [
        /cdn\.amplitude\.com/i,
        /amplitude/i
      ],
      css: [],
      js: [
        /amplitude\./
      ],
      meta: [],
      headers: [],
      cookies: [
        /amplitude/i
      ]
    }
  },

  heap: {
    name: 'Heap',
    category: CATEGORIES.ANALYTICS,
    website: 'https://heap.io',
    description: 'Digital insights platform',
    patterns: {
      html: [],
      scripts: [
        /cdn\.heapanalytics\.com/i,
        /heap-/i
      ],
      css: [],
      js: [
        /heap\./
      ],
      meta: [],
      headers: [],
      cookies: [
        /_hp/i
      ]
    }
  },

  plausible: {
    name: 'Plausible Analytics',
    category: CATEGORIES.ANALYTICS,
    website: 'https://plausible.io',
    description: 'Simple and privacy-friendly alternative to Google Analytics',
    patterns: {
      html: [],
      scripts: [
        /plausible\.io/i
      ],
      css: [],
      js: [
        /plausible/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  // ==========================================
  // CDN
  // ==========================================
  cloudflare: {
    name: 'Cloudflare',
    category: CATEGORIES.CDN,
    website: 'https://www.cloudflare.com',
    description: 'Web performance & security company',
    patterns: {
      html: [
        /cdnjs\.cloudflare\.com/i
      ],
      scripts: [
        /cdnjs\.cloudflare\.com/i
      ],
      css: [
        /cdnjs\.cloudflare\.com/i
      ],
      js: [],
      meta: [],
      headers: [
        { name: 'cf-ray', value: /.+/ },
        { name: 'cf-cache-status', value: /.+/ },
        { name: 'server', value: /cloudflare/i }
      ],
      cookies: [
        /__cf/i,
        /cf_clearance/i
      ]
    }
  },

  akamai: {
    name: 'Akamai',
    category: CATEGORIES.CDN,
    website: 'https://www.akamai.com',
    description: 'Content delivery network and cloud service provider',
    patterns: {
      html: [],
      scripts: [],
      css: [],
      js: [],
      meta: [],
      headers: [
        { name: 'x-akamai-transformed', value: /.+/ },
        { name: 'x-akamai-session-info', value: /.+/ },
        { name: 'server', value: /akamai/i }
      ],
      cookies: [
        /ak_bmsc/i,
        /bm_sz/i
      ]
    }
  },

  fastly: {
    name: 'Fastly',
    category: CATEGORIES.CDN,
    website: 'https://www.fastly.com',
    description: 'Edge cloud platform',
    patterns: {
      html: [],
      scripts: [],
      css: [],
      js: [],
      meta: [],
      headers: [
        { name: 'x-served-by', value: /cache-/i },
        { name: 'x-cache', value: /.+/ },
        { name: 'via', value: /varnish/i },
        { name: 'x-fastly-request-id', value: /.+/ }
      ],
      cookies: []
    }
  },

  awscloudfront: {
    name: 'Amazon CloudFront',
    category: CATEGORIES.CDN,
    website: 'https://aws.amazon.com/cloudfront/',
    description: 'Content delivery network by Amazon Web Services',
    patterns: {
      html: [
        /cloudfront\.net/i
      ],
      scripts: [
        /cloudfront\.net/i
      ],
      css: [
        /cloudfront\.net/i
      ],
      js: [],
      meta: [],
      headers: [
        { name: 'x-amz-cf-id', value: /.+/ },
        { name: 'x-amz-cf-pop', value: /.+/ },
        { name: 'via', value: /cloudfront/i }
      ],
      cookies: []
    }
  },

  jsdelivr: {
    name: 'jsDelivr',
    category: CATEGORIES.CDN,
    website: 'https://www.jsdelivr.com',
    description: 'Free CDN for open source projects',
    patterns: {
      html: [
        /cdn\.jsdelivr\.net/i
      ],
      scripts: [
        /cdn\.jsdelivr\.net/i
      ],
      css: [
        /cdn\.jsdelivr\.net/i
      ],
      js: [],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  unpkg: {
    name: 'UNPKG',
    category: CATEGORIES.CDN,
    website: 'https://unpkg.com',
    description: 'Fast, global content delivery network for everything on npm',
    patterns: {
      html: [
        /unpkg\.com/i
      ],
      scripts: [
        /unpkg\.com/i
      ],
      css: [
        /unpkg\.com/i
      ],
      js: [],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  // ==========================================
  // Security
  // ==========================================
  recaptcha: {
    name: 'reCAPTCHA',
    category: CATEGORIES.SECURITY,
    website: 'https://www.google.com/recaptcha/',
    description: 'Protect your website from spam and abuse',
    patterns: {
      html: [
        /g-recaptcha/i,
        /recaptcha\/api/i
      ],
      scripts: [
        /google\.com\/recaptcha/i,
        /recaptcha/i
      ],
      css: [],
      js: [
        /grecaptcha/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  hcaptcha: {
    name: 'hCaptcha',
    category: CATEGORIES.SECURITY,
    website: 'https://www.hcaptcha.com',
    description: 'Stop bots. Start protecting user privacy',
    patterns: {
      html: [
        /h-captcha/i,
        /hcaptcha\.com/i
      ],
      scripts: [
        /hcaptcha\.com/i
      ],
      css: [],
      js: [
        /hcaptcha/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  // ==========================================
  // Payment Processors
  // ==========================================
  stripe: {
    name: 'Stripe',
    category: CATEGORIES.PAYMENT,
    website: 'https://stripe.com',
    description: 'Online payment processing for internet businesses',
    patterns: {
      html: [],
      scripts: [
        /js\.stripe\.com/i,
        /stripe/i
      ],
      css: [],
      js: [
        /Stripe\(/
      ],
      meta: [],
      headers: [],
      cookies: [
        /__stripe/i
      ]
    }
  },

  paypal: {
    name: 'PayPal',
    category: CATEGORIES.PAYMENT,
    website: 'https://www.paypal.com',
    description: 'Online payments system',
    patterns: {
      html: [
        /paypalobjects\.com/i
      ],
      scripts: [
        /paypal\.com/i,
        /paypalobjects\.com/i
      ],
      css: [],
      js: [
        /paypal\./
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  // ==========================================
  // Fonts
  // ==========================================
  googlefonts: {
    name: 'Google Fonts',
    category: CATEGORIES.FONT_SCRIPTS,
    website: 'https://fonts.google.com',
    description: 'Library of free and open source font families',
    patterns: {
      html: [
        /fonts\.googleapis\.com/i,
        /fonts\.gstatic\.com/i
      ],
      scripts: [],
      css: [
        /fonts\.googleapis\.com/i
      ],
      js: [],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  fontawesome: {
    name: 'Font Awesome',
    category: CATEGORIES.FONT_SCRIPTS,
    website: 'https://fontawesome.com',
    description: 'Vector icons and social logos',
    patterns: {
      html: [
        /class=["'][^"']*\bfa\s+fa-/i,
        /class=["'][^"']*\bfas\s+fa-/i,
        /class=["'][^"']*\bfar\s+fa-/i,
        /class=["'][^"']*\bfab\s+fa-/i
      ],
      scripts: [
        /fontawesome/i,
        /kit\.fontawesome\.com/i
      ],
      css: [
        /fontawesome/i,
        /font-awesome/i
      ],
      js: [],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  // ==========================================
  // Video Players
  // ==========================================
  youtube: {
    name: 'YouTube',
    category: CATEGORIES.VIDEO_PLAYERS,
    website: 'https://www.youtube.com',
    description: 'Video sharing platform',
    patterns: {
      html: [
        /youtube\.com\/embed/i,
        /youtube-nocookie\.com/i,
        /ytimg\.com/i
      ],
      scripts: [
        /youtube\.com/i,
        /ytimg\.com/i
      ],
      css: [],
      js: [
        /YT\.Player/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  vimeo: {
    name: 'Vimeo',
    category: CATEGORIES.VIDEO_PLAYERS,
    website: 'https://vimeo.com',
    description: 'High-quality video hosting and sharing',
    patterns: {
      html: [
        /player\.vimeo\.com/i,
        /vimeocdn\.com/i
      ],
      scripts: [
        /player\.vimeo\.com/i
      ],
      css: [],
      js: [
        /Vimeo\.Player/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  // ==========================================
  // Maps
  // ==========================================
  googlemaps: {
    name: 'Google Maps',
    category: CATEGORIES.MAPS,
    website: 'https://maps.google.com',
    description: 'Web mapping platform by Google',
    patterns: {
      html: [
        /maps\.googleapis\.com/i,
        /maps\.google\.com/i
      ],
      scripts: [
        /maps\.googleapis\.com/i,
        /maps\.google\.com/i
      ],
      css: [],
      js: [
        /google\.maps\./
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  mapbox: {
    name: 'Mapbox',
    category: CATEGORIES.MAPS,
    website: 'https://www.mapbox.com',
    description: 'Maps and location for developers',
    patterns: {
      html: [
        /api\.mapbox\.com/i
      ],
      scripts: [
        /api\.mapbox\.com/i,
        /mapbox-gl/i
      ],
      css: [
        /api\.mapbox\.com/i,
        /mapbox-gl/i
      ],
      js: [
        /mapboxgl\./
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  leaflet: {
    name: 'Leaflet',
    category: CATEGORIES.MAPS,
    website: 'https://leafletjs.com',
    description: 'JavaScript library for mobile-friendly interactive maps',
    patterns: {
      html: [
        /leaflet-/i
      ],
      scripts: [
        /leaflet(?:\.min)?\.js/i
      ],
      css: [
        /leaflet(?:\.min)?\.css/i
      ],
      js: [
        /L\.map/,
        /L\.marker/
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  // ==========================================
  // Social
  // ==========================================
  facebookpixel: {
    name: 'Facebook Pixel',
    category: CATEGORIES.MARKETING,
    website: 'https://www.facebook.com/business/tools/meta-pixel',
    description: 'Analytics tool from Facebook for advertising',
    patterns: {
      html: [],
      scripts: [
        /connect\.facebook\.net/i,
        /fbevents\.js/i
      ],
      css: [],
      js: [
        /fbq\(/
      ],
      meta: [],
      headers: [],
      cookies: [
        /_fbp/i
      ]
    }
  },

  twitter: {
    name: 'Twitter',
    category: CATEGORIES.SOCIAL,
    website: 'https://twitter.com',
    description: 'Social networking and microblogging service',
    patterns: {
      html: [
        /platform\.twitter\.com/i,
        /twitter\.com\/widgets/i
      ],
      scripts: [
        /platform\.twitter\.com/i
      ],
      css: [],
      js: [
        /twttr\./
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  // ==========================================
  // Authentication
  // ==========================================
  auth0: {
    name: 'Auth0',
    category: CATEGORIES.AUTHENTICATION,
    website: 'https://auth0.com',
    description: 'Authentication and authorization as a service',
    patterns: {
      html: [],
      scripts: [
        /cdn\.auth0\.com/i,
        /auth0/i
      ],
      css: [],
      js: [
        /auth0\./
      ],
      meta: [],
      headers: [],
      cookies: [
        /auth0/i
      ]
    }
  },

  firebase: {
    name: 'Firebase',
    category: CATEGORIES.HOSTING,
    website: 'https://firebase.google.com',
    description: 'Google platform for creating mobile and web apps',
    patterns: {
      html: [],
      scripts: [
        /firebase(?:app)?(?:\.min)?\.js/i,
        /firebaseapp\.com/i,
        /__\/firebase/i
      ],
      css: [],
      js: [
        /firebase\./
      ],
      meta: [],
      headers: [],
      cookies: []
    }
  },

  // ==========================================
  // Programming Languages / Runtimes
  // ==========================================
  php: {
    name: 'PHP',
    category: CATEGORIES.PROGRAMMING_LANGUAGES,
    website: 'https://www.php.net',
    description: 'Popular general-purpose scripting language',
    patterns: {
      html: [],
      scripts: [],
      css: [],
      js: [],
      meta: [],
      headers: [
        { name: 'x-powered-by', value: /php/i }
      ],
      cookies: [
        /PHPSESSID/i
      ]
    }
  },

  aspnet: {
    name: 'ASP.NET',
    category: CATEGORIES.PROGRAMMING_LANGUAGES,
    website: 'https://dotnet.microsoft.com/apps/aspnet',
    description: 'Open source web framework for .NET',
    patterns: {
      html: [
        /__VIEWSTATE/i,
        /__VIEWSTATEGENERATOR/i
      ],
      scripts: [],
      css: [],
      js: [],
      meta: [],
      headers: [
        { name: 'x-aspnet-version', value: /.+/ },
        { name: 'x-powered-by', value: /asp\.net/i }
      ],
      cookies: [
        /ASP\.NET_SessionId/i,
        /\.ASPXAUTH/i
      ]
    }
  },

  nodejs: {
    name: 'Node.js',
    category: CATEGORIES.PROGRAMMING_LANGUAGES,
    website: 'https://nodejs.org',
    description: 'JavaScript runtime built on Chrome V8 JavaScript engine',
    patterns: {
      html: [],
      scripts: [],
      css: [],
      js: [],
      meta: [],
      headers: [
        { name: 'x-powered-by', value: /express/i }
      ],
      cookies: [
        /connect\.sid/i
      ]
    }
  },

  ruby: {
    name: 'Ruby on Rails',
    category: CATEGORIES.PROGRAMMING_LANGUAGES,
    website: 'https://rubyonrails.org',
    description: 'Server-side web application framework written in Ruby',
    patterns: {
      html: [
        /csrf-token/i,
        /csrf-param/i
      ],
      scripts: [],
      css: [],
      js: [],
      meta: [
        { name: 'csrf-token', content: /.+/ }
      ],
      headers: [
        { name: 'x-powered-by', value: /phusion/i }
      ],
      cookies: [
        /_session_id/i
      ]
    }
  },

  django: {
    name: 'Django',
    category: CATEGORIES.PROGRAMMING_LANGUAGES,
    website: 'https://www.djangoproject.com',
    description: 'High-level Python web framework',
    patterns: {
      html: [
        /csrfmiddlewaretoken/i
      ],
      scripts: [],
      css: [],
      js: [],
      meta: [],
      headers: [],
      cookies: [
        /csrftoken/i,
        /sessionid/i
      ]
    }
  },

  flask: {
    name: 'Flask',
    category: CATEGORIES.PROGRAMMING_LANGUAGES,
    website: 'https://flask.palletsprojects.com',
    description: 'Micro web framework written in Python',
    patterns: {
      html: [],
      scripts: [],
      css: [],
      js: [],
      meta: [],
      headers: [
        { name: 'x-powered-by', value: /flask/i }
      ],
      cookies: [
        /session/i
      ]
    }
  },

  laravel: {
    name: 'Laravel',
    category: CATEGORIES.PROGRAMMING_LANGUAGES,
    website: 'https://laravel.com',
    description: 'PHP web application framework',
    patterns: {
      html: [],
      scripts: [],
      css: [],
      js: [],
      meta: [],
      headers: [],
      cookies: [
        /laravel_session/i,
        /XSRF-TOKEN/i
      ]
    }
  }
};

/**
 * Get all technology fingerprints
 * @returns {Object} All technology fingerprints
 */
function getFingerprints() {
  return FINGERPRINTS;
}

/**
 * Get all categories
 * @returns {Object} All category definitions
 */
function getCategories() {
  return CATEGORIES;
}

/**
 * Get a specific technology fingerprint by key
 * @param {string} key - Technology key
 * @returns {Object|null} Technology fingerprint or null
 */
function getFingerprint(key) {
  return FINGERPRINTS[key.toLowerCase()] || null;
}

/**
 * Get technologies by category
 * @param {string} category - Category name
 * @returns {Array} Array of technology objects in the category
 */
function getTechnologiesByCategory(category) {
  const technologies = [];
  for (const [key, tech] of Object.entries(FINGERPRINTS)) {
    if (tech.category === category) {
      technologies.push({
        key,
        ...tech
      });
    }
  }
  return technologies;
}

/**
 * Get the count of all technologies
 * @returns {number} Total number of technologies
 */
function getTechnologyCount() {
  return Object.keys(FINGERPRINTS).length;
}

/**
 * Search technologies by name
 * @param {string} query - Search query
 * @returns {Array} Array of matching technology objects
 */
function searchTechnologies(query) {
  const searchLower = query.toLowerCase();
  const results = [];

  for (const [key, tech] of Object.entries(FINGERPRINTS)) {
    if (key.includes(searchLower) ||
        tech.name.toLowerCase().includes(searchLower) ||
        (tech.description && tech.description.toLowerCase().includes(searchLower))) {
      results.push({
        key,
        ...tech
      });
    }
  }

  return results;
}

module.exports = {
  FINGERPRINTS,
  CATEGORIES,
  getFingerprints,
  getCategories,
  getFingerprint,
  getTechnologiesByCategory,
  getTechnologyCount,
  searchTechnologies
};
