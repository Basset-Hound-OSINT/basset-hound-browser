/**
 * Basset Hound Browser - Technology Fingerprints: content delivery networks
 * Entries: cloudflare, akamai, fastly, awscloudfront, jsdelivr, unpkg
 * Extracted verbatim from technology/fingerprints.js (modularization 2026-07-04).
 * Data only; merged by the ../fingerprints.js barrel.
 */

const { CATEGORIES } = require('./categories');

module.exports = {
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
  }
};
