/**
 * Basset Hound Browser - Technology Fingerprints: CSS frameworks
 * Entries: bootstrap, tailwindcss, bulma, materialui, foundation
 * Extracted verbatim from technology/fingerprints.js (modularization 2026-07-04).
 * Data only; merged by the ../fingerprints.js barrel.
 */

const { CATEGORIES } = require('./categories');

module.exports = {
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
  }
};
