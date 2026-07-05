/**
 * Basset Hound Browser - Technology Fingerprints: analytics and tag managers
 * Entries: googleanalytics, googletagmanager, mixpanel, hotjar, segment, amplitude, heap, plausible
 * Extracted verbatim from technology/fingerprints.js (modularization 2026-07-04).
 * Data only; merged by the ../fingerprints.js barrel.
 */

const { CATEGORIES } = require('./categories');

module.exports = {
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
  }
};
