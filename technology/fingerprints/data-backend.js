/**
 * Basset Hound Browser - Technology Fingerprints: programming languages and backend frameworks
 * Entries: php, aspnet, nodejs, ruby, django, flask, laravel
 * Extracted verbatim from technology/fingerprints.js (modularization 2026-07-04).
 * Data only; merged by the ../fingerprints.js barrel.
 */

const { CATEGORIES } = require('./categories');

module.exports = {
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
