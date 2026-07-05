/**
 * Basset Hound Browser - Technology Detection Module
 * Identifies technologies, frameworks, CMS, servers, CDN, and hosting platforms
 *
 * Version: 1.0.0
 * Created: May 7, 2026
 */

const crypto = require('crypto');
const SignatureLoader = require('./signature-loader');
const path = require('path');

class TechDetector {
  constructor(signatureDatabase = null) {
    this.signatureLoader = new SignatureLoader();
    this.signatures = signatureDatabase || this.loadDefaultSignatures();
    this.detectionCache = new Map();
    this.cacheTimeout = 3600000; // 1 hour
  }

  /**
   * Main detection method - identifies technologies in page data
   * Returns array of detected technologies with confidence scores
   */
  async detectTechnologies(pageData, networkRequests = [], headers = {}) {
    const cacheKey = this.generateCacheKey(pageData);

    // Check cache
    if (this.detectionCache.has(cacheKey)) {
      const cached = this.detectionCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    const startTime = Date.now();
    const results = {
      technologies: [],
      detectionMethods: {},
      confidence: 0,
      rawEvidence: {},
      detectionTime: null,
      timestamp: new Date().toISOString()
    };

    // Run all detection strategies in parallel
    const [
      headerDetections,
      faviconDetections,
      sslDetections,
      jsDetections,
      domDetections,
      canvasDetections
    ] = await Promise.all([
      this.detectByHeaders(headers),
      this.detectByFavicon(pageData.favicon),
      this.detectBySSL(pageData.sslCertificate, pageData.tlsDetails),
      this.detectByJavaScript(pageData.scripts, pageData.resources),
      this.detectByDOM(pageData.html, pageData.dom),
      this.detectByCanvas(pageData.canvasFingerprint)
    ]);

    // Merge all detections
    const allDetections = [
      ...headerDetections,
      ...faviconDetections,
      ...sslDetections,
      ...jsDetections,
      ...domDetections,
      ...canvasDetections
    ];

    // Consolidate duplicates and calculate confidence
    const consolidated = this.consolidateDetections(allDetections);
    results.technologies = consolidated;
    results.detectionTime = Date.now() - startTime;

    // Ensure detectionTime is a positive number
    if (results.detectionTime <= 0) {
      results.detectionTime = 1; // Minimum 1ms
    }

    // Cache result
    this.detectionCache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });

    return results;
  }

  /**
   * HTTP header analysis - detect from Server, X-Powered-By, etc.
   */
  async detectByHeaders(headers = {}) {
    const detections = [];
    const headerMap = this.normalizeHeaders(headers);

    for (const [techId, tech] of Object.entries(this.signatures)) {
      if (!tech.headers || typeof tech.headers !== 'object') {
        continue;
      }

      for (const [headerName, headerSignature] of Object.entries(tech.headers)) {
        const headerValue = headerMap.get(headerName.toLowerCase()) || '';

        // Skip if no value in headers
        if (!headerValue) {
          continue;
        }

        // Check for match
        let matched = false;
        if (typeof headerSignature === 'string') {
          // Exact or partial string match
          matched = headerValue.toLowerCase().includes(headerSignature.toLowerCase());
        } else if (headerSignature instanceof RegExp) {
          matched = headerSignature.test(headerValue);
        }

        if (matched) {
          detections.push({
            id: techId,
            name: tech.name,
            category: tech.category,
            confidence: 100,
            method: 'HTTP_HEADER',
            evidence: {
              header: headerName,
              value: headerValue
            },
            version: this.extractVersion(headerValue, tech.versions)
          });
        }
      }
    }

    return detections;
  }

  /**
   * Favicon hash analysis - match against known favicon hashes
   * Uses SHA256 only (MD5 is cryptographically broken)
   */
  async detectByFavicon(faviconBuffer) {
    const detections = [];
    if (!faviconBuffer) {
      return detections;
    }

    const sha256Hash = crypto.createHash('sha256').update(faviconBuffer).digest('hex');

    for (const [techId, tech] of Object.entries(this.signatures)) {
      if (!tech.favicon) {
        continue;
      }

      if (tech.favicon.sha256 === sha256Hash) {
        detections.push({
          id: techId,
          name: tech.name,
          category: tech.category,
          confidence: 95,
          method: 'FAVICON_HASH',
          evidence: {
            hashType: 'SHA256',
            hash: sha256Hash
          }
        });
      }
    }

    return detections;
  }

  /**
   * SSL/TLS certificate analysis
   */
  async detectBySSL(certificate, tlsDetails = {}) {
    const detections = [];
    if (!certificate) {
      return detections;
    }

    // Extract issuer, subject, organization
    const issuer = certificate.issuer?.O || '';
    const organization = certificate.subject?.O || '';

    // Match common hosting providers from certificate info
    const hostingSignatures = {
      'CloudFlare': 'cloudflare',
      'Amazon': 'aws',
      'Google': 'google-cloud',
      'Microsoft': 'azure',
      'Fastly': 'fastly',
      'Akamai': 'akamai'
    };

    for (const [certOrg, techId] of Object.entries(hostingSignatures)) {
      if (issuer.includes(certOrg) || organization.includes(certOrg)) {
        const tech = this.signatures[techId];
        if (tech) {
          detections.push({
            id: techId,
            name: tech.name,
            category: tech.category,
            confidence: 90,
            method: 'SSL_CERTIFICATE',
            evidence: {
              issuer: issuer,
              organization: organization
            }
          });
        }
      }
    }

    return detections;
  }

  /**
   * JavaScript library detection - from loaded scripts and globals
   */
  async detectByJavaScript(scripts = [], resources = []) {
    const detections = [];

    for (const [techId, tech] of Object.entries(this.signatures)) {
      if (!tech.js) {
        continue;
      }

      // Check script URLs
      if (tech.js.urls) {
        for (const url of scripts) {
          for (const urlPattern of tech.js.urls) {
            if (this.matchPattern(url, urlPattern)) {
              detections.push({
                id: techId,
                name: tech.name,
                category: tech.category,
                confidence: 90,
                method: 'JAVASCRIPT_URL',
                evidence: {
                  scriptUrl: url,
                  pattern: urlPattern
                }
              });
              break;
            }
          }
        }
      }

      // Check for global variables (would be detected via JS injection)
      if (tech.js.patterns) {
        // These would be checked via JavaScript injection in actual implementation
        // Placeholder for pattern matching
      }
    }

    return detections;
  }

  /**
   * DOM and HTML analysis - meta tags, comments, structure
   */
  async detectByDOM(html = '', dom = {}) {
    const detections = [];

    // Parse meta tags
    const metaGenerator = this.extractMetaTag(html, 'generator');
    const metaPoweredBy = this.extractMetaTag(html, 'powered-by');

    // Check signatures that have HTML patterns
    for (const [techId, tech] of Object.entries(this.signatures)) {
      if (!tech.html) {
        continue;
      }

      // Meta tag detection
      if (tech.html.metaGenerator && metaGenerator) {
        if (this.matchSignature(metaGenerator, tech.html.metaGenerator)) {
          detections.push({
            id: techId,
            name: tech.name,
            category: tech.category,
            confidence: 95,
            method: 'META_TAG',
            evidence: {
              metaTag: 'generator',
              value: metaGenerator
            }
          });
          continue;
        }
      }

      // HTML patterns detection (comments, class names, etc.)
      if (tech.html.patterns && Array.isArray(tech.html.patterns)) {
        for (const pattern of tech.html.patterns) {
          // Check as string literal or regex
          let found = false;
          if (typeof pattern === 'string') {
            found = html.includes(pattern);
          } else if (pattern instanceof RegExp) {
            found = pattern.test(html);
          }

          if (found) {
            detections.push({
              id: techId,
              name: tech.name,
              category: tech.category,
              confidence: 85,
              method: 'HTML_PATTERN',
              evidence: {
                pattern: pattern.toString()
              }
            });
            break;
          }
        }
      }
    }

    return detections;
  }

  /**
   * Canvas fingerprinting detection (advanced)
   */
  async detectByCanvas(canvasData) {
    const detections = [];
    // Canvas fingerprint matching would go here
    // This is a placeholder for advanced fingerprinting
    return detections;
  }

  /**
   * Consolidate duplicate detections and calculate confidence scores
   */
  consolidateDetections(detections) {
    const techMap = new Map();

    for (const detection of detections) {
      const key = detection.id;

      if (techMap.has(key)) {
        const existing = techMap.get(key);
        // Increase confidence if multiple detection methods agree
        existing.confidence = Math.min(100, existing.confidence + 5);
        existing.detectionMethods = existing.detectionMethods || [];
        existing.detectionMethods.push(detection.method);
        existing.evidence[detection.method] = detection.evidence;
      } else {
        detection.detectionMethods = [detection.method];
        techMap.set(key, detection);
      }
    }

    // Sort by confidence
    return Array.from(techMap.values()).sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Helper: Normalize headers to lowercase map
   */
  normalizeHeaders(headers) {
    const map = new Map();
    if (!headers) {
      return map;
    }
    for (const [key, value] of Object.entries(headers)) {
      map.set(key.toLowerCase(), value);
    }
    return map;
  }

  /**
   * Helper: Match signature (string or regex)
   */
  matchSignature(value, signature) {
    if (typeof signature === 'string') {
      return value.toLowerCase().includes(signature.toLowerCase());
    } else if (signature instanceof RegExp) {
      return signature.test(value);
    }
    return false;
  }

  /**
   * Helper: Match pattern (handles wildcards)
   */
  matchPattern(value, pattern) {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(value);
  }

  /**
   * Helper: Extract version from value
   */
  extractVersion(value, versionPatterns) {
    if (!versionPatterns) {
      return null;
    }

    for (const pattern of versionPatterns) {
      const regex = new RegExp(pattern);
      const match = value.match(regex);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Helper: Extract meta tag value
   */
  extractMetaTag(html, name) {
    const regex = new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']+)["']`, 'i');
    const match = html.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Helper: Generate cache key
   */
  generateCacheKey(pageData) {
    const combined = JSON.stringify({
      html: pageData.html?.substring(0, 1000),
      favicon: pageData.favicon
    });
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Load default signature database
   * In production, this would load from data/technology-signatures.json
   */
  loadDefaultSignatures() {
    return {
      // Framework examples
      'react': {
        name: 'React',
        category: 'JavaScript Framework',
        js: {
          patterns: ['React.version', 'ReactDOM'],
          urls: ['/.*react.*\\.js']
        },
        html: {
          patterns: ['data-react-root', 'data-reactroot']
        }
      },
      'vue': {
        name: 'Vue.js',
        category: 'JavaScript Framework',
        js: {
          patterns: ['Vue']
        }
      },
      'angular': {
        name: 'Angular',
        category: 'JavaScript Framework',
        js: {
          urls: ['/angular\\.js', '/angular\\.min\\.js']
        }
      },
      // Server examples
      'apache': {
        name: 'Apache',
        category: 'Web Server',
        headers: {
          'server': 'Apache'
        }
      },
      'nginx': {
        name: 'Nginx',
        category: 'Web Server',
        headers: {
          'server': 'nginx'
        }
      },
      // CMS examples
      'wordpress': {
        name: 'WordPress',
        category: 'CMS',
        headers: {
          'x-powered-by': 'WordPress'
        },
        html: {
          metaGenerator: 'WordPress',
          patterns: ['/wp-content/', '/wp-includes/']
        }
      }
    };
  }

  /**
   * Get cached results
   */
  getCachedResults(cacheKey) {
    return this.detectionCache.get(cacheKey);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.detectionCache.clear();
  }

  /**
   * Load external signature database using SignatureLoader
   */
  async loadSignatures(filePath) {
    try {
      const result = await this.signatureLoader.loadFromFile(filePath);
      if (result.success) {
        this.signatures = this.signatureLoader.getSignatures();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to load signatures:', error);
      return false;
    }
  }

  /**
   * Load seed database (100+ pre-configured technologies)
   */
  async loadSeedDatabase() {
    const seedPath = path.join(__dirname, '../../data/technology-signatures-seed.json');
    return this.loadSignatures(seedPath);
  }

  /**
   * Get signature loader instance
   */
  getSignatureLoader() {
    return this.signatureLoader;
  }

  /**
   * Get current signature count
   */
  getSignatureCount() {
    return Object.keys(this.signatures).length;
  }
}

module.exports = TechDetector;
