/**
 * Basset Hound Browser - Technology Fingerprints: JavaScript libraries
 * Entries: jquery, lodash, underscore, momentjs, axios, d3js, threejs, chartjs, gsap
 * Extracted verbatim from technology/fingerprints.js (modularization 2026-07-04).
 * Data only; merged by the ../fingerprints.js barrel.
 */

const { CATEGORIES } = require('./categories');

module.exports = {
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
  }
};
