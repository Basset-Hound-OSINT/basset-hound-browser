/**
 * Basset Hound Browser - Technology Fingerprints: JavaScript frameworks
 * Entries: react, vue, angular, svelte, nextjs, nuxtjs, gatsby, ember, backbone
 * Extracted verbatim from technology/fingerprints.js (modularization 2026-07-04).
 * Data only; merged by the ../fingerprints.js barrel.
 */

const { CATEGORIES } = require('./categories');

module.exports = {
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
  }
};
