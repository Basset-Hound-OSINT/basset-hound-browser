/**
 * Basset Hound Browser - Technology Fingerprints: security, payments, media, maps, social and auth services
 * Entries: recaptcha, hcaptcha, stripe, paypal, googlefonts, fontawesome, youtube, vimeo, googlemaps, mapbox, leaflet, facebookpixel, twitter, auth0, firebase
 * Extracted verbatim from technology/fingerprints.js (modularization 2026-07-04).
 * Data only; merged by the ../fingerprints.js barrel.
 */

const { CATEGORIES } = require('./categories');

module.exports = {
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
  }
};
