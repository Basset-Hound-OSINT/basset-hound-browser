/**
 * Mock Data Generator for Technology Fingerprinting & Session Coherence Tests
 * Provides realistic test data for unit, integration, and performance tests
 */

class MockDataGenerator {
  /**
   * Generate realistic technology detection result
   */
  static generateTechnologyDetection(overrides = {}) {
    const defaults = {
      id: 'wordpress',
      category: 'cms',
      name: 'WordPress',
      version: '6.4.1',
      confidence: 0.98,
      detectionMethods: [
        'wp-content header',
        'wp-version comment',
        'theme detection'
      ],
      evidence: {
        headers: {
          'X-Powered-By': 'WordPress',
          'Server': 'Apache/2.4.41'
        },
        patterns: ['/wp-includes/', '/wp-content/'],
        html_patterns: ['wp-emoji-release.min.js']
      },
      website: 'https://wordpress.org',
      icon: '/icons/wordpress.svg'
    };
    return { ...defaults, ...overrides };
  }

  /**
   * Generate multiple technology detections
   */
  static generateTechnologyStack(count = 5, categories = ['frameworks', 'cms', 'servers', 'cdn', 'analytics']) {
    const technologies = [];
    const techIds = ['wordpress', 'react', 'nginx', 'cloudflare', 'google-analytics', 'jquery', 'bootstrap', 'php', 'apache', 'aws'];

    for (let i = 0; i < count && i < techIds.length; i++) {
      technologies.push(this.generateTechnologyDetection({
        id: techIds[i],
        category: categories[i % categories.length],
        confidence: 0.85 + (Math.random() * 0.15)
      }));
    }
    return technologies;
  }

  /**
   * Generate technology signature database entry
   */
  static generateTechnologySignature(overrides = {}) {
    const defaults = {
      id: 'wordpress',
      name: 'WordPress',
      category: 'cms',
      website: 'https://wordpress.org',
      icon: '/icons/wordpress.svg',
      icon_hash: 'sha256:abc123def456...',
      headers: {
        'X-Powered-By': ['WordPress', 'WordPress.*'],
        'Server': ['WordPress/.*']
      },
      js: ['wp-emoji-release.min.js', 'wp-includes/js/.*'],
      scripts: ['/wp-includes/', '/wp-content/'],
      html: ['wp-emoji', 'wp-version', 'wp-includes'],
      dom: ['wp-admin', 'wp-login'],
      css: ['/wp-content/themes/.*'],
      meta: {
        'generator': ['WordPress.*'],
        'description': ['.*WordPress.*']
      },
      implies: [],
      version_patterns: {
        js: 'WordPress\\s+([\\d.]+)'
      },
      confidence_weights: {
        headers: 0.9,
        js: 0.8,
        favicon: 0.85,
        dom: 0.6
      }
    };
    return { ...defaults, ...overrides };
  }

  /**
   * Generate session fingerprint data
   */
  static generateFingerprint(overrides = {}) {
    const defaults = {
      timestamp: new Date().toISOString(),
      canvas: 'sha256:canvas_hash_' + Math.random().toString(36).substr(2, 9),
      webgl: 'sha256:webgl_hash_' + Math.random().toString(36).substr(2, 9),
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      language: 'en-US',
      timezone: 'UTC-5',
      screenResolution: '1920x1080',
      colorDepth: 32,
      fonts: ['Arial', 'Times New Roman', 'Courier New'],
      plugins: ['Chrome PDF Plugin', 'Chrome PDF Viewer'],
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      localStorage: true,
      sessionStorage: true,
      indexedDB: true,
      webRTC: true
    };
    return { ...defaults, ...overrides };
  }

  /**
   * Generate coherence validation result
   */
  static generateCoherenceValidation(overrides = {}) {
    const defaults = {
      sessionId: 'sess_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      overallCoherence: 94.2,
      isCoherent: true,
      layers: {
        temporal: {
          score: 96.1,
          status: 'COHERENT',
          fingerprintDrift: 0.01,
          violations: [],
          evidence: {
            initialFingerprint: this.generateFingerprint(),
            driftAnalysis: 'Fingerprint stable within 1% tolerance'
          }
        },
        behavioral: {
          score: 93.8,
          status: 'COHERENT',
          patternConsistency: 0.938,
          violations: [],
          evidence: {
            mousePattern: 'Bezier curves with natural acceleration',
            typingPattern: 'WPM consistent 65-75 throughout session'
          }
        },
        network: {
          score: 92.4,
          status: 'COHERENT',
          requestPatternMatch: 0.924,
          violations: [],
          evidence: {
            requestTiming: 'Matches 1920x1080 display bandwidth expectations',
            headerConsistency: 'All requests claim same browser version'
          }
        },
        device: {
          score: 95.7,
          status: 'COHERENT',
          contradictions: 0,
          violations: [],
          evidence: {
            osConsistency: 'macOS 13.4 consistent across 45 claims',
            browserConsistency: 'Chrome 114 consistent across 45 claims',
            screenConsistency: '1920x1080 never contradicted'
          }
        },
        timeline: {
          score: 94.1,
          status: 'COHERENT',
          gaps: [],
          violations: [],
          evidence: {
            totalEventCount: 234,
            eventSequenceValid: true,
            noTimeTravel: true
          }
        }
      },
      history: []
    };
    return { ...defaults, ...overrides };
  }

  /**
   * Generate coherence violation for testing
   */
  static generateCoherenceViolation(layerType = 'temporal', overrides = {}) {
    const violations = {
      temporal: {
        type: 'FINGERPRINT_DRIFT',
        description: 'Fingerprint changed more than 2% between requests',
        severity: 'CRITICAL',
        layer: 'temporal',
        timestamp: new Date().toISOString()
      },
      behavioral: {
        type: 'BEHAVIOR_ANOMALY',
        description: 'Mouse movement pattern changed suddenly',
        severity: 'WARNING',
        layer: 'behavioral',
        timestamp: new Date().toISOString()
      },
      network: {
        type: 'REQUEST_PATTERN_MISMATCH',
        description: 'Request timing does not match claimed device specs',
        severity: 'WARNING',
        layer: 'network',
        timestamp: new Date().toISOString()
      },
      device: {
        type: 'DEVICE_CONTRADICTION',
        description: 'Screen resolution contradicts previous claims',
        severity: 'CRITICAL',
        layer: 'device',
        timestamp: new Date().toISOString()
      },
      timeline: {
        type: 'IMPOSSIBLE_TIMELINE',
        description: 'Event sequence contains time-travel or gaps',
        severity: 'CRITICAL',
        layer: 'timeline',
        timestamp: new Date().toISOString()
      }
    };
    return { ...violations[layerType], ...overrides };
  }

  /**
   * Generate sample HTML pages for tech detection testing
   */
  static generateSampleHTML(techStack = 'wordpress') {
    const pages = {
      wordpress: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="generator" content="WordPress 6.4.1" />
          <link rel="stylesheet" href="/wp-content/themes/theme/style.css" />
        </head>
        <body>
          <script src="/wp-includes/js/wp-emoji-release.min.js"></script>
          <div class="wp-admin">Admin Content</div>
        </body>
        </html>
      `,
      react: `
        <!DOCTYPE html>
        <html>
        <head>
          <script>const React = require('react');</script>
        </head>
        <body>
          <div id="root"></div>
          <script src="/_next/static/chunks/main.js"></script>
        </body>
        </html>
      `,
      drupal: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="generator" content="Drupal 10" />
        </head>
        <body>
          <script src="/sites/default/files/js/drupal.js"></script>
        </body>
        </html>
      `
    };
    return pages[techStack] || pages.wordpress;
  }

  /**
   * Generate HTTP headers for detection
   */
  static generateHTTPHeaders(withSignatures = true) {
    const headers = {
      'Server': 'Apache/2.4.41',
      'X-Powered-By': 'PHP/7.4.0',
      'Content-Type': 'text/html; charset=UTF-8',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff'
    };

    if (withSignatures) {
      headers['X-Powered-By'] = 'WordPress';
      headers['Link'] = '</wp-includes/theme-compat/header.php>; rel="stylesheet"';
    }

    return headers;
  }

  /**
   * Generate behavioral metrics for coherence testing
   */
  static generateBehavioralMetrics(overrides = {}) {
    const defaults = {
      mouseVelocity: 245.3,
      mousePauses: 0.23,
      mouseDirectness: 0.87,
      typingWPM: 68.5,
      interKeystrokeTime: 125,
      typingPauses: 0.18,
      typingErrors: 0.02,
      scrollVelocity: 320,
      scrollPauses: 3,
      clickDuration: 145,
      clickInterval: 2340,
      idleDuration: 8400,
      navigationAwareness: 0.92,
      formInteractionTime: 4560,
      focusToTypeDelay: 340
    };
    return { ...defaults, ...overrides };
  }

  /**
   * Generate session request sequence
   */
  static generateRequestSequence(count = 10) {
    const requests = [];
    for (let i = 0; i < count; i++) {
      requests.push({
        id: `req_${i}`,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        method: 'GET',
        url: `https://example.com/page${i}`,
        headers: this.generateHTTPHeaders(),
        fingerprint: this.generateFingerprint(),
        behavioral: this.generateBehavioralMetrics(),
        responseTime: 200 + Math.random() * 100
      });
    }
    return requests;
  }

  /**
   * Generate multiple coherence samples over time
   */
  static generateCoherenceTimeSeries(count = 10, intervalMs = 1000) {
    const series = [];
    for (let i = 0; i < count; i++) {
      series.push(this.generateCoherenceValidation({
        timestamp: new Date(Date.now() + i * intervalMs).toISOString(),
        overallCoherence: 94 + (Math.random() * 4) - 2
      }));
    }
    return series;
  }

  /**
   * Generate page state for tech detection
   */
  static generatePageState(url = 'https://example.com', detectedTechs = []) {
    return {
      url,
      title: 'Example Page',
      html: this.generateSampleHTML('wordpress'),
      headers: this.generateHTTPHeaders(),
      scripts: [
        { src: '/wp-includes/js/wp-emoji-release.min.js', inline: false },
        { src: 'https://cdn.example.com/analytics.js', inline: false }
      ],
      images: 5,
      css: 3,
      links: 12,
      forms: 2,
      detectedTechnologies: detectedTechs.length > 0 ? detectedTechs : this.generateTechnologyStack(),
      metadata: {
        description: 'Example page description',
        keywords: 'example, test, page',
        charset: 'UTF-8',
        viewport: 'width=device-width, initial-scale=1'
      }
    };
  }

  /**
   * Generate test scenario configuration
   */
  static generateTestScenario(type = 'basic') {
    const scenarios = {
      basic: {
        name: 'Basic Detection',
        pages: 1,
        technologies: 5,
        coherenceCheckInterval: 'after_each_request',
        expectedViolations: 0
      },
      complex: {
        name: 'Complex Multi-Page',
        pages: 10,
        technologies: 25,
        coherenceCheckInterval: 'every_2_requests',
        expectedViolations: 0,
        withBehavioralVariation: true
      },
      stressful: {
        name: 'Stress Test',
        pages: 100,
        technologies: 100,
        coherenceCheckInterval: 'every_5_requests',
        expectedViolations: 0,
        concurrentSessions: 10
      },
      withViolations: {
        name: 'Detection with Violations',
        pages: 5,
        technologies: 10,
        coherenceCheckInterval: 'after_each_request',
        expectedViolations: 3,
        injectedViolations: ['temporal', 'behavioral', 'device']
      }
    };
    return scenarios[type] || scenarios.basic;
  }
}

module.exports = MockDataGenerator;
