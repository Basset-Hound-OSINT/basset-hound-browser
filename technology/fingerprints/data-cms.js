/**
 * Basset Hound Browser - Technology Fingerprints: CMS and e-commerce platforms
 * Entries: wordpress, drupal, joomla, shopify, wix, squarespace, ghost, magento, woocommerce
 * Extracted verbatim from technology/fingerprints.js (modularization 2026-07-04).
 * Data only; merged by the ../fingerprints.js barrel.
 */

const { CATEGORIES } = require('./categories');

module.exports = {
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
  }
};
