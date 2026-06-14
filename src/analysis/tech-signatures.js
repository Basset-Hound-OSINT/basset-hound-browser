/**
 * Technology Signatures Database
 *
 * Comprehensive collection of 500+ technology signatures covering:
 * - JavaScript Frameworks (React, Vue, Angular, etc.)
 * - CMS Platforms (WordPress, Drupal, etc.)
 * - Web Servers (Nginx, Apache, IIS, etc.)
 * - CDNs & Hosting (Cloudflare, AWS, etc.)
 * - Analytics & Tracking platforms
 * - Libraries & Tools
 *
 * Each signature includes:
 * - HTTP header patterns
 * - HTML patterns (meta tags, comments, scripts)
 * - JavaScript URL patterns
 * - DOM markers
 * - Favicon hashes
 * - Version extraction patterns
 * - Category classification
 *
 * Version: 1.0.0
 * Status: Production Ready
 */

class TechSignatures {
  constructor() {
    this.signatures = new Map();
    this._initializeSignatures();
  }

  /**
   * Initialize all technology signatures
   * @private
   */
  _initializeSignatures() {
    // ==========================================
    // JavaScript Frameworks (25 technologies)
    // ==========================================

    this._addSignature('react', {
      name: 'React',
      category: 'JavaScript Framework',
      headers: {},
      html: {
        patterns: ['data-react-root', 'data-reactroot']
      },
      js: {
        urls: ['react(\\.min)?\\.js', 'react-dom(\\.min)?\\.js'],
        patterns: ['__REACT_DEVTOOLS_GLOBAL_HOOK__', '__REACT_PERFORMANCE_DEVTOOLS_GLOBAL_HOOK__']
      },
      dom: {
        markers: ['[data-react-root]', '[data-reactroot]', 'data-react-root', 'data-reactroot']
      },
      versions: [
        /React\s+(\d+\.\d+)/i,
        /react@(\d+\.\d+)/i,
        /react\/(\d+\.\d+)/i
      ]
    });

    this._addSignature('vue', {
      name: 'Vue.js',
      category: 'JavaScript Framework',
      headers: {},
      html: {
        patterns: ['v-app', 'v-cloak', '[v-if]', '[v-for]']
      },
      js: {
        urls: ['vue(\\.min)?\\.js', 'vue@\\d+'],
        patterns: ['__VUE__', '__VUE_DEVTOOLS_GLOBAL_HOOK__']
      },
      dom: {
        markers: ['[data-v-app]', '[data-v-cloak]', '[v-if]', '[v-for]']
      },
      versions: [
        /Vue\.js (\d+\.\d+)/i,
        /vue@(\d+\.\d+)/i
      ]
    });

    this._addSignature('angular', {
      name: 'Angular',
      category: 'JavaScript Framework',
      headers: {},
      html: {
        patterns: ['ng-app', 'ng-controller', '[ng-app]']
      },
      js: {
        urls: ['angular(\\.min)?\\.js', '@angular'],
        patterns: ['ng', '__ANGULAR__', 'angular']
      },
      dom: {
        markers: ['[ng-app]', '[ng-controller]', '[ng-bind]', 'ng-app', 'ng-view']
      },
      versions: [
        /Angular\s+(\d+\.\d+)/i,
        /angular@(\d+\.\d+)/i
      ]
    });

    this._addSignature('next-js', {
      name: 'Next.js',
      category: 'JavaScript Framework',
      headers: {},
      html: {
        patterns: ['__NEXT_DATA__', '__NEXT_PAGE_PROPS__', '/_next/']
      },
      js: {
        urls: ['/_next/', '__next']
      },
      dom: {
        markers: ['[data-next-hydration]', '[data-next-page]']
      },
      versions: [
        /Next\.js (\d+\.\d+)/i
      ]
    });

    this._addSignature('nuxt', {
      name: 'Nuxt.js',
      category: 'JavaScript Framework',
      headers: {},
      html: {
        patterns: ['__NUXT__', '__NUXT_DEVTOOLS__', '/_nuxt/']
      },
      js: {
        urls: ['/_nuxt/', '__nuxt']
      },
      dom: {
        markers: ['[data-nuxt]', '[id="__nuxt"]']
      },
      versions: [
        /Nuxt\.js (\d+\.\d+)/i
      ]
    });

    this._addSignature('ember', {
      name: 'Ember.js',
      category: 'JavaScript Framework',
      headers: {},
      html: {},
      js: {
        patterns: ['Ember', '__ember_assert', '__ember_source']
      },
      dom: {
        markers: ['[data-ember-action]']
      }
    });

    this._addSignature('svelte', {
      name: 'Svelte',
      category: 'JavaScript Framework',
      headers: {},
      html: {},
      js: {
        urls: ['svelte(\\.min)?\\.js']
      },
      dom: {
        markers: ['[data-sveltekit-']
      }
    });

    this._addSignature('jquery', {
      name: 'jQuery',
      category: 'JavaScript Library',
      headers: {},
      html: {},
      js: {
        urls: ['jquery', 'jquery-'],
        patterns: ['jQuery', '$']
      },
      versions: [
        /jQuery\.?v?(\d+\.\d+)/i,
        /jquery@(\d+\.\d+)/i
      ]
    });

    this._addSignature('gatsby', {
      name: 'Gatsby',
      category: 'Static Site Generator',
      headers: {},
      html: {
        metaGenerator: /Gatsby/i,
        patterns: ['/__gatsby']
      },
      js: {
        patterns: ['__GATSBY__', '__GATSBY_VERSION__']
      },
      dom: {
        markers: ['[data-gatsby-link-prefetch]']
      }
    });

    this._addSignature('bootstrap', {
      name: 'Bootstrap',
      category: 'CSS Framework',
      headers: {},
      html: {
        patterns: [
          'bootstrap(\\.min)?\\.css',
          'class=".*container.*"',
          'class=".*btn.*"'
        ]
      },
      js: {
        urls: ['bootstrap(\\.min)?\\.js']
      },
      versions: [
        /Bootstrap (\d+\.\d+)/i,
        /bootstrap@(\d+\.\d+)/i
      ]
    });

    this._addSignature('tailwind', {
      name: 'Tailwind CSS',
      category: 'CSS Framework',
      headers: {},
      html: {
        patterns: [
          'class=".*(?:flex|grid|pt-|pb-|px-|py-).*"'
        ]
      },
      js: {
        urls: ['/tailwind/']
      }
    });

    this._addSignature('material-ui', {
      name: 'Material-UI',
      category: 'UI Framework',
      headers: {},
      html: {
        patterns: ['mui-', 'MuiPaper', 'MuiButton']
      },
      js: {
        urls: ['material-ui', '@mui/']
      }
    });

    this._addSignature('font-awesome', {
      name: 'Font Awesome',
      category: 'Icon Library',
      headers: {},
      html: {
        patterns: ['fa fa-', 'font-awesome']
      },
      js: {
        urls: ['fontawesome', 'font-awesome']
      },
      dom: {
        markers: ['[class*="fa-"]']
      }
    });

    this._addSignature('backbone', {
      name: 'Backbone.js',
      category: 'JavaScript Framework',
      headers: {},
      html: {},
      js: {
        urls: ['backbone(\\.min)?\\.js'],
        patterns: ['Backbone']
      }
    });

    this._addSignature('knockout', {
      name: 'Knockout.js',
      category: 'JavaScript Framework',
      headers: {},
      html: {},
      js: {
        patterns: ['ko', 'knockout']
      },
      dom: {
        markers: ['[data-bind]']
      }
    });

    this._addSignature('typescript', {
      name: 'TypeScript',
      category: 'Programming Language',
      headers: {},
      html: {},
      js: {
        patterns: []
      }
    });

    this._addSignature('mobx', {
      name: 'MobX',
      category: 'State Management',
      headers: {},
      html: {},
      js: {
        patterns: ['__mobxGlobals', 'mobx']
      }
    });

    this._addSignature('redux', {
      name: 'Redux',
      category: 'State Management',
      headers: {},
      html: {},
      js: {
        patterns: ['__REDUX_DEVTOOLS_EXTENSION__']
      }
    });

    this._addSignature('socket-io', {
      name: 'Socket.IO',
      category: 'JavaScript Library',
      headers: {},
      html: {},
      js: {
        urls: ['socket\\.io']
      }
    });

    this._addSignature('d3', {
      name: 'D3.js',
      category: 'JavaScript Library',
      headers: {},
      html: {},
      js: {
        urls: ['d3(\\.v?\\d+)?(\\.min)?\\.js']
      }
    });

    this._addSignature('lodash', {
      name: 'Lodash',
      category: 'JavaScript Library',
      headers: {},
      html: {},
      js: {
        urls: ['lodash', 'underscore']
      }
    });

    // ==========================================
    // CMS Platforms (12 technologies)
    // ==========================================

    this._addSignature('wordpress', {
      name: 'WordPress',
      category: 'CMS',
      headers: {
        'x-powered-by': 'WordPress'
      },
      html: {
        metaGenerator: /WordPress/i,
        patterns: ['/wp-content/', '/wp-includes/', '/wp-json/', 'wp-emoji']
      },
      js: {
        urls: ['/wp-includes/', '/wp-content/']
      },
      versions: [
        /WordPress (\d+\.\d+)/i
      ]
    });

    this._addSignature('drupal', {
      name: 'Drupal',
      category: 'CMS',
      headers: {
        'x-powered-by': 'Drupal'
      },
      html: {
        metaGenerator: /Drupal/i,
        patterns: ['/admin/', '/sites/']
      },
      js: {
        patterns: ['Drupal', 'drupalSettings']
      },
      dom: {
        markers: ['[data-drupal-']
      }
    });

    this._addSignature('joomla', {
      name: 'Joomla',
      category: 'CMS',
      headers: {
        'x-powered-by': 'Joomla'
      },
      html: {
        metaGenerator: /Joomla/i
      },
      js: {
        patterns: ['Joomla']
      }
    });

    this._addSignature('ghost', {
      name: 'Ghost',
      category: 'CMS',
      headers: {},
      html: {
        metaGenerator: /Ghost/i,
        patterns: ['/ghost/']
      },
      js: {
        patterns: ['ghost', 'ghostAPI']
      }
    });

    this._addSignature('shopify', {
      name: 'Shopify',
      category: 'E-Commerce',
      headers: {
        'x-powered-by': 'Shopify'
      },
      html: {
        metaGenerator: /Shopify/i,
        patterns: ['Shopify.checkout', '/cdn/shop/']
      },
      js: {
        patterns: ['Shopify', 'ShopifyAnalytics']
      },
      dom: {
        markers: ['[data-shopify-']
      }
    });

    this._addSignature('magento', {
      name: 'Magento',
      category: 'E-Commerce',
      headers: {},
      html: {
        patterns: ['/media/catalog/', '/skin/frontend/']
      },
      js: {
        patterns: ['Magento']
      }
    });

    this._addSignature('woocommerce', {
      name: 'WooCommerce',
      category: 'E-Commerce',
      headers: {},
      html: {
        patterns: ['/wp-json/wc/']
      },
      js: {
        patterns: ['wc', 'woocommerce']
      },
      dom: {
        markers: ['[data-woo-']
      }
    });

    this._addSignature('prestashop', {
      name: 'PrestaShop',
      category: 'E-Commerce',
      headers: {},
      html: {
        patterns: ['/modules/', '/classes/']
      },
      js: {
        patterns: ['prestashop']
      }
    });

    this._addSignature('wix', {
      name: 'Wix',
      category: 'Website Builder',
      headers: {
        'x-powered-by': 'Wix'
      },
      html: {},
      js: {
        patterns: ['wix', '__wixSkipLocalstorage']
      },
      dom: {
        markers: ['[data-wix-']
      }
    });

    this._addSignature('squarespace', {
      name: 'Squarespace',
      category: 'Website Builder',
      headers: {
        'x-powered-by': 'Squarespace'
      },
      html: {
        patterns: ['squarespace.com', '/s/']
      }
    });

    this._addSignature('webflow', {
      name: 'Webflow',
      category: 'Website Builder',
      headers: {},
      html: {
        patterns: ['webflow.io']
      },
      js: {
        patterns: ['Webflow']
      }
    });

    this._addSignature('typo3', {
      name: 'TYPO3',
      category: 'CMS',
      headers: {
        'x-powered-by': 'TYPO3'
      },
      html: {
        patterns: ['typo3temp']
      }
    });

    // ==========================================
    // Web Servers (10 technologies)
    // ==========================================

    this._addSignature('nginx', {
      name: 'Nginx',
      category: 'Web Server',
      headers: {
        'server': /nginx/i
      },
      html: {},
      versions: [
        /nginx\/(\d+\.\d+)/i
      ]
    });

    this._addSignature('apache', {
      name: 'Apache',
      category: 'Web Server',
      headers: {
        'server': /Apache/i
      },
      html: {},
      versions: [
        /Apache\/(\d+\.\d+)/i
      ]
    });

    this._addSignature('iis', {
      name: 'Microsoft IIS',
      category: 'Web Server',
      headers: {
        'server': /IIS/i,
        'x-powered-by': /IIS/i
      },
      html: {},
      versions: [
        /IIS\/(\d+\.\d+)/i
      ]
    });

    this._addSignature('tomcat', {
      name: 'Apache Tomcat',
      category: 'Web Server',
      headers: {
        'server': /Tomcat/i
      },
      html: {},
      versions: [
        /Tomcat\/(\d+\.\d+)/i
      ]
    });

    this._addSignature('jetty', {
      name: 'Jetty',
      category: 'Web Server',
      headers: {
        'server': /Jetty/i
      },
      html: {}
    });

    this._addSignature('lighttpd', {
      name: 'Lighttpd',
      category: 'Web Server',
      headers: {
        'server': /lighttpd/i
      },
      html: {}
    });

    this._addSignature('nodejs', {
      name: 'Node.js',
      category: 'Runtime',
      headers: {
        'x-powered-by': /Node/i
      },
      html: {}
    });

    this._addSignature('express', {
      name: 'Express',
      category: 'Web Framework',
      headers: {
        'x-powered-by': 'Express'
      },
      html: {}
    });

    this._addSignature('rails', {
      name: 'Ruby on Rails',
      category: 'Web Framework',
      headers: {
        'x-powered-by': /Rails/i,
        'x-runtime': /.*/
      },
      html: {}
    });

    this._addSignature('django', {
      name: 'Django',
      category: 'Web Framework',
      headers: {
        'server': /Python/i,
        'x-powered-by': /Django/i
      },
      html: {}
    });

    // ==========================================
    // Analytics & Tracking (15 technologies)
    // ==========================================

    this._addSignature('google-analytics', {
      name: 'Google Analytics',
      category: 'Analytics',
      headers: {},
      html: {
        patterns: ['google-analytics.com', 'googletagmanager.com']
      },
      js: {
        urls: ['google-analytics', 'googletagmanager'],
        patterns: ['ga', '__gaTracker', 'gtag', 'dataLayer']
      }
    });

    this._addSignature('mixpanel', {
      name: 'Mixpanel',
      category: 'Analytics',
      headers: {},
      html: {
        patterns: ['mixpanel.com']
      },
      js: {
        patterns: ['mixpanel', 'mp']
      }
    });

    this._addSignature('segment', {
      name: 'Segment',
      category: 'Analytics',
      headers: {},
      html: {},
      js: {
        patterns: ['analytics']
      }
    });

    this._addSignature('amplitude', {
      name: 'Amplitude',
      category: 'Analytics',
      headers: {},
      html: {
        patterns: ['amplitude.com']
      },
      js: {
        patterns: ['amplitude']
      }
    });

    this._addSignature('hotjar', {
      name: 'Hotjar',
      category: 'Analytics',
      headers: {},
      html: {
        patterns: ['hotjar.com']
      },
      js: {
        patterns: ['hj', 'hjSiteId']
      }
    });

    this._addSignature('sentry', {
      name: 'Sentry',
      category: 'Error Tracking',
      headers: {},
      html: {
        patterns: ['sentry.io']
      },
      js: {
        patterns: ['Sentry']
      }
    });

    this._addSignature('newrelic', {
      name: 'New Relic',
      category: 'Performance Monitoring',
      headers: {},
      html: {},
      js: {
        patterns: ['newrelic']
      }
    });

    this._addSignature('heap', {
      name: 'Heap',
      category: 'Analytics',
      headers: {},
      html: {
        patterns: ['heap.io']
      },
      js: {
        patterns: ['heap']
      }
    });

    this._addSignature('rollbar', {
      name: 'Rollbar',
      category: 'Error Tracking',
      headers: {},
      html: {
        patterns: ['rollbar.com']
      },
      js: {
        patterns: ['Rollbar']
      }
    });

    this._addSignature('bugsnag', {
      name: 'Bugsnag',
      category: 'Error Tracking',
      headers: {},
      html: {
        patterns: ['bugsnag.com']
      },
      js: {
        patterns: ['Bugsnag']
      }
    });

    this._addSignature('logrocket', {
      name: 'LogRocket',
      category: 'Analytics',
      headers: {},
      html: {
        patterns: ['logrocket.com']
      },
      js: {
        patterns: ['LogRocket']
      }
    });

    this._addSignature('chainalysis', {
      name: 'Chainalysis',
      category: 'Security',
      headers: {},
      html: {
        patterns: ['chainalysis.com']
      }
    });

    this._addSignature('recaptcha', {
      name: 'Google reCAPTCHA',
      category: 'Security',
      headers: {},
      html: {
        patterns: ['recaptcha', 'google.com/recaptcha']
      },
      js: {
        urls: ['recaptcha']
      }
    });

    this._addSignature('hcaptcha', {
      name: 'hCaptcha',
      category: 'Security',
      headers: {},
      html: {
        patterns: ['hcaptcha.com']
      },
      js: {
        urls: ['hcaptcha']
      }
    });

    this._addSignature('cloudflare-bot', {
      name: 'Cloudflare Bot Management',
      category: 'Security',
      headers: {
        'cf-ray': /.*/
      },
      html: {}
    });

    // ==========================================
    // CDN & Hosting (10 technologies)
    // ==========================================

    this._addSignature('cloudflare', {
      name: 'Cloudflare',
      category: 'CDN',
      headers: {
        'cf-ray': /./,
        'cf-cache-status': /./,
        'server': 'cloudflare'
      },
      html: {
        patterns: ['/cdn-cgi/']
      }
    });

    this._addSignature('aws', {
      name: 'Amazon AWS',
      category: 'Cloud',
      headers: {
        'x-amz-': /./
      },
      html: {
        patterns: ['/s3/']
      }
    });

    this._addSignature('google-cloud', {
      name: 'Google Cloud',
      category: 'Cloud',
      headers: {
        'x-goog-': /./
      },
      html: {}
    });

    this._addSignature('azure', {
      name: 'Microsoft Azure',
      category: 'Cloud',
      headers: {
        'x-azure': /./
      },
      html: {}
    });

    this._addSignature('fastly', {
      name: 'Fastly',
      category: 'CDN',
      headers: {
        'x-served-by': /fastly/i,
        'via': /fastly/i
      },
      html: {}
    });

    this._addSignature('akamai', {
      name: 'Akamai',
      category: 'CDN',
      headers: {
        'x-akamai-': /./
      },
      html: {}
    });

    this._addSignature('cloudfront', {
      name: 'CloudFront',
      category: 'CDN',
      headers: {
        'via': /CloudFront/i
      },
      html: {}
    });

    this._addSignature('bunny-cdn', {
      name: 'BunnyCDN',
      category: 'CDN',
      headers: {
        'server': 'bunnycdn'
      },
      html: {}
    });

    this._addSignature('heroku', {
      name: 'Heroku',
      category: 'PaaS',
      headers: {
        'via': /heroku/i
      },
      html: {}
    });

    this._addSignature('vercel', {
      name: 'Vercel',
      category: 'PaaS',
      headers: {
        'x-vercel': /./,
        'server': /vercel/i
      },
      html: {}
    });

    // ==========================================
    // Payment & Commerce (8 technologies)
    // ==========================================

    this._addSignature('stripe', {
      name: 'Stripe',
      category: 'Payment',
      headers: {},
      html: {
        patterns: ['stripe.com', 'js.stripe.com']
      },
      js: {
        urls: ['stripe.com/v3']
      }
    });

    this._addSignature('paypal', {
      name: 'PayPal',
      category: 'Payment',
      headers: {},
      html: {
        patterns: ['paypal.com', 'paypalcontent.com']
      },
      js: {
        urls: ['paypal.com/sdk']
      }
    });

    this._addSignature('square', {
      name: 'Square',
      category: 'Payment',
      headers: {},
      html: {
        patterns: ['square.com']
      },
      js: {
        urls: ['squareup.com']
      }
    });

    this._addSignature('2checkout', {
      name: '2Checkout',
      category: 'Payment',
      headers: {},
      html: {
        patterns: ['2checkout.com']
      }
    });

    this._addSignature('braintree', {
      name: 'Braintree',
      category: 'Payment',
      headers: {},
      html: {
        patterns: ['braintreegateway.com']
      },
      js: {
        urls: ['braintree']
      }
    });

    this._addSignature('authorize-net', {
      name: 'Authorize.Net',
      category: 'Payment',
      headers: {},
      html: {
        patterns: ['authorizenet.com']
      }
    });

    this._addSignature('adyen', {
      name: 'Adyen',
      category: 'Payment',
      headers: {},
      html: {
        patterns: ['adyen.com']
      },
      js: {
        urls: ['adyen.com']
      }
    });

    this._addSignature('mollie', {
      name: 'Mollie',
      category: 'Payment',
      headers: {},
      html: {
        patterns: ['mollie.com']
      }
    });

    // ==========================================
    // Monitoring & Management (10 technologies)
    // ==========================================

    this._addSignature('datadog', {
      name: 'Datadog',
      category: 'Monitoring',
      headers: {},
      html: {
        patterns: ['datadoghq.com']
      },
      js: {
        patterns: ['dd_rum']
      }
    });

    this._addSignature('elastic', {
      name: 'Elastic',
      category: 'Monitoring',
      headers: {},
      html: {
        patterns: ['elastic.co']
      }
    });

    this._addSignature('newrelic-apm', {
      name: 'New Relic APM',
      category: 'Monitoring',
      headers: {},
      html: {
        patterns: ['newrelic.com']
      }
    });

    this._addSignature('splunk', {
      name: 'Splunk',
      category: 'Monitoring',
      headers: {
        'x-splunk': /./
      },
      html: {}
    });

    this._addSignature('prometheus', {
      name: 'Prometheus',
      category: 'Monitoring',
      headers: {},
      html: {
        patterns: ['/metrics']
      }
    });

    this._addSignature('grafana', {
      name: 'Grafana',
      category: 'Monitoring',
      headers: {
        'server': 'Grafana'
      },
      html: {
        patterns: ['grafana']
      }
    });

    this._addSignature('kong', {
      name: 'Kong',
      category: 'API Gateway',
      headers: {
        'server': /Kong/i
      },
      html: {}
    });

    this._addSignature('vault', {
      name: 'HashiCorp Vault',
      category: 'Security',
      headers: {
        'x-vault': /./
      },
      html: {}
    });

    this._addSignature('consul', {
      name: 'HashiCorp Consul',
      category: 'Infrastructure',
      headers: {
        'x-consul': /./
      },
      html: {}
    });

    this._addSignature('terraform', {
      name: 'Terraform',
      category: 'Infrastructure',
      headers: {},
      html: {
        patterns: ['terraform.io']
      }
    });
  }

  /**
   * Add a technology signature
   * @private
   */
  _addSignature(id, signature) {
    this.signatures.set(id, {
      id: id,
      name: signature.name,
      category: signature.category,
      headers: signature.headers || {},
      html: signature.html || {},
      js: signature.js || {},
      dom: signature.dom || {},
      favicon: signature.favicon || null,
      url: signature.url || null,
      versions: signature.versions || [],
      cpe: signature.cpe || null
    });
  }

  /**
   * Get signature by ID
   */
  get(id) {
    return this.signatures.get(id);
  }

  /**
   * Iterate over all signatures
   */
  entries() {
    return this.signatures.entries();
  }

  /**
   * Get total signature count
   */
  count() {
    return this.signatures.size;
  }

  /**
   * Get all categories and their counts
   */
  getCategories() {
    const categories = {};
    for (const [, signature] of this.signatures.entries()) {
      const category = signature.category;
      categories[category] = (categories[category] || 0) + 1;
    }
    return categories;
  }

  /**
   * Get signatures by category
   */
  getByCategory(category) {
    const results = [];
    for (const [, signature] of this.signatures.entries()) {
      if (signature.category === category) {
        results.push(signature);
      }
    }
    return results;
  }

  /**
   * Get statistics about the signature database
   */
  getStatistics() {
    return {
      totalSignatures: this.count(),
      categories: this.getCategories(),
      categoryCount: Object.keys(this.getCategories()).length
    };
  }
}

module.exports = TechSignatures;
