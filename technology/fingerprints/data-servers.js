/**
 * Basset Hound Browser - Technology Fingerprints: web servers
 * Entries: nginx, apache, iis, litespeed, caddy
 * Extracted verbatim from technology/fingerprints.js (modularization 2026-07-04).
 * Data only; merged by the ../fingerprints.js barrel.
 */

const { CATEGORIES } = require('./categories');

module.exports = {
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
  }
};
