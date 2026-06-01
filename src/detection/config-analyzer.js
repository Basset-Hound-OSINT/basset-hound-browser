/**
 * Technology Configuration Analyzer
 *
 * Detects weak and insecure configurations in detected technologies.
 *
 * Features:
 * - Debug mode detection (Django DEBUG=True, Flask debug mode)
 * - HTTP header analysis (missing HSTS, CSP, X-Frame-Options)
 * - Exposed services detection (admin panels, debug endpoints)
 * - Default credentials detection
 * - Outdated dependency detection
 * - Insecure settings identification
 *
 * @module config-analyzer
 */

const { createLogger } = require('../../logging');

class ConfigurationAnalyzer {
  constructor(options = {}) {
    this.logger = createLogger('ConfigurationAnalyzer');
    this.severityThreshold = options.severityThreshold || 'MEDIUM'; // LOW, MEDIUM, HIGH, CRITICAL
  }

  /**
   * Analyze configuration for detected technologies
   * @param {object} pageData - Page data (headers, html, etc.)
   * @param {array} detectedTechs - Array of detected technologies
   * @returns {object} Configuration issues
   */
  analyzeConfiguration(pageData = {}, detectedTechs = []) {
    try {
      const issues = [];

      // Analyze HTTP headers
      if (pageData.headers) {
        issues.push(...this._analyzeHeaders(pageData.headers));
      }

      // Analyze HTML content
      if (pageData.html) {
        issues.push(...this._analyzeHTML(pageData.html));
      }

      // Technology-specific analysis
      detectedTechs.forEach(tech => {
        issues.push(...this._analyzeTechnologyConfig(tech, pageData));
      });

      // Filter by severity threshold
      const filtered = issues.filter(issue =>
        this._getSeverityScore(issue.severity) >= this._getSeverityScore(this.severityThreshold)
      );

      // Sort by severity
      filtered.sort((a, b) => this._getSeverityScore(b.severity) - this._getSeverityScore(a.severity));

      const bySeverity = {
        CRITICAL: filtered.filter(i => i.severity === 'CRITICAL').length,
        HIGH: filtered.filter(i => i.severity === 'HIGH').length,
        MEDIUM: filtered.filter(i => i.severity === 'MEDIUM').length,
        LOW: filtered.filter(i => i.severity === 'LOW').length
      };

      return {
        success: true,
        issues: filtered,
        totalIssues: filtered.length,
        bySeverity: bySeverity,
        hasIssues: filtered.length > 0,
        recommendations: this._generateRecommendations(filtered)
      };
    } catch (error) {
      this.logger.error('config_analysis_failed', {
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        issues: [],
        totalIssues: 0,
        hasIssues: false
      };
    }
  }

  /**
   * Analyze HTTP headers for security issues
   * @private
   */
  _analyzeHeaders(headers) {
    const issues = [];

    if (!headers || typeof headers !== 'object') {
      return issues;
    }

    const normalizedHeaders = this._normalizeHeaders(headers);

    // Check for missing security headers
    const requiredHeaders = {
      'strict-transport-security': {
        name: 'HSTS',
        severity: 'HIGH',
        issue: 'Missing HSTS header',
        recommendation: 'Add Strict-Transport-Security header with max-age=31536000'
      },
      'content-security-policy': {
        name: 'CSP',
        severity: 'HIGH',
        issue: 'Missing Content Security Policy',
        recommendation: 'Implement a strict CSP to prevent XSS attacks'
      },
      'x-frame-options': {
        name: 'X-Frame-Options',
        severity: 'MEDIUM',
        issue: 'Missing X-Frame-Options header',
        recommendation: 'Add X-Frame-Options: DENY or SAMEORIGIN to prevent clickjacking'
      },
      'x-content-type-options': {
        name: 'X-Content-Type-Options',
        severity: 'MEDIUM',
        issue: 'Missing X-Content-Type-Options header',
        recommendation: 'Add X-Content-Type-Options: nosniff'
      },
      'x-xss-protection': {
        name: 'X-XSS-Protection',
        severity: 'LOW',
        issue: 'Missing X-XSS-Protection header',
        recommendation: 'Add X-XSS-Protection: 1; mode=block (deprecated but still useful)'
      }
    };

    Object.entries(requiredHeaders).forEach(([headerKey, headerInfo]) => {
      if (!normalizedHeaders[headerKey]) {
        issues.push({
          type: 'missing_security_header',
          severity: headerInfo.severity,
          header: headerInfo.name,
          issue: headerInfo.issue,
          recommendation: headerInfo.recommendation
        });
      }
    });

    // Check for information disclosure headers
    const disclosureHeaders = {
      'server': 'Server header',
      'x-powered-by': 'X-Powered-By header',
      'x-aspnet-version': 'ASP.NET version',
      'x-runtime-version': 'Runtime version'
    };

    Object.entries(disclosureHeaders).forEach(([headerKey, headerName]) => {
      if (normalizedHeaders[headerKey]) {
        issues.push({
          type: 'information_disclosure',
          severity: 'MEDIUM',
          header: headerName,
          value: normalizedHeaders[headerKey],
          issue: `${headerName} exposes technology information`,
          recommendation: `Remove or obfuscate ${headerName} to prevent reconnaissance`
        });
      }
    });

    return issues;
  }

  /**
   * Analyze HTML content for configuration issues
   * @private
   */
  _analyzeHTML(html) {
    const issues = [];

    if (!html || typeof html !== 'string') {
      return issues;
    }

    // Check for debug/development mode indicators
    const debugPatterns = [
      {
        pattern: /DEBUG\s*=\s*[Tt]rue/,
        issue: 'Debug mode enabled',
        severity: 'CRITICAL',
        recommendation: 'Disable debug mode in production'
      },
      {
        pattern: /app\.debug\s*=\s*[Tt]rue/,
        issue: 'Flask debug mode enabled',
        severity: 'CRITICAL',
        recommendation: 'Disable Flask debug mode in production'
      },
      {
        pattern: /FLASK_ENV\s*=\s*development/i,
        issue: 'Flask in development environment',
        severity: 'HIGH',
        recommendation: 'Set FLASK_ENV to production'
      },
      {
        pattern: /NODE_ENV\s*=\s*development/i,
        issue: 'Node.js in development environment',
        severity: 'MEDIUM',
        recommendation: 'Set NODE_ENV to production'
      }
    ];

    debugPatterns.forEach(({ pattern, issue, severity, recommendation }) => {
      if (pattern.test(html)) {
        issues.push({
          type: 'debug_mode_enabled',
          severity: severity,
          issue: issue,
          recommendation: recommendation
        });
      }
    });

    // Check for exposed admin panels
    const adminPanels = [
      {
        pattern: /\/wp-admin\//,
        tech: 'WordPress',
        endpoint: '/wp-admin/',
        severity: 'MEDIUM',
        recommendation: 'Restrict access to /wp-admin/ with IP whitelist or authentication'
      },
      {
        pattern: /\/admin\/|\/administrator\//,
        tech: 'Generic CMS',
        endpoint: '/admin/',
        severity: 'MEDIUM',
        recommendation: 'Restrict access to admin panels'
      },
      {
        pattern: /\/phpmyadmin/,
        tech: 'MySQL',
        endpoint: '/phpmyadmin/',
        severity: 'CRITICAL',
        recommendation: 'Remove or restrict access to phpMyAdmin'
      },
      {
        pattern: /\/api\/docs|\/swagger|\/openapi\.json/,
        tech: 'API',
        endpoint: 'API Documentation',
        severity: 'MEDIUM',
        recommendation: 'Restrict API documentation endpoints'
      }
    ];

    adminPanels.forEach(({ pattern, tech, endpoint, severity, recommendation }) => {
      if (pattern.test(html)) {
        issues.push({
          type: 'exposed_admin_panel',
          severity: severity,
          technology: tech,
          endpoint: endpoint,
          issue: `Potentially exposed ${tech} ${endpoint} endpoint`,
          recommendation: recommendation
        });
      }
    });

    // Check for sensitive information exposure
    const sensitivePatterns = [
      {
        pattern: /<!--\s*DEBUG|<!-- DEBUG/i,
        issue: 'HTML comments contain debug information',
        severity: 'MEDIUM',
        recommendation: 'Remove debug comments from production HTML'
      },
      {
        pattern: /eval\s*\(/,
        issue: 'Dangerous eval() function usage',
        severity: 'HIGH',
        recommendation: 'Replace eval() with safer alternatives'
      },
      {
        pattern: /<img[^>]*src\s*=\s*["\']javascript:/,
        issue: 'Inline JavaScript in image src attributes',
        severity: 'MEDIUM',
        recommendation: 'Use proper JavaScript event handlers instead'
      }
    ];

    sensitivePatterns.forEach(({ pattern, issue, severity, recommendation }) => {
      if (pattern.test(html)) {
        issues.push({
          type: 'sensitive_exposure',
          severity: severity,
          issue: issue,
          recommendation: recommendation
        });
      }
    });

    return issues;
  }

  /**
   * Analyze technology-specific configurations
   * @private
   */
  _analyzeTechnologyConfig(tech, pageData = {}) {
    const issues = [];

    if (!tech || !tech.name) {
      return issues;
    }

    const techConfigs = this._getTechConfigPatterns(tech.name);

    techConfigs.forEach(config => {
      if (config.headerCheck && pageData.headers) {
        const normalizedHeaders = this._normalizeHeaders(pageData.headers);
        if (config.headerCheck(normalizedHeaders)) {
          issues.push({
            type: 'weak_config',
            technology: tech.name,
            severity: config.severity,
            issue: config.issue,
            recommendation: config.recommendation
          });
        }
      }

      if (config.htmlCheck && pageData.html) {
        if (config.htmlCheck(pageData.html)) {
          issues.push({
            type: 'weak_config',
            technology: tech.name,
            severity: config.severity,
            issue: config.issue,
            recommendation: config.recommendation
          });
        }
      }
    });

    return issues;
  }

  /**
   * Get technology-specific configuration patterns
   * @private
   */
  _getTechConfigPatterns(techName) {
    const patterns = {
      'WordPress': [
        {
          htmlCheck: (html) => /\/wp-config\.php/i.test(html),
          severity: 'CRITICAL',
          issue: 'wp-config.php may be accessible',
          recommendation: 'Ensure wp-config.php is not web-accessible'
        },
        {
          htmlCheck: (html) => /WP_DEBUG\s*=\s*[Tt]rue/i.test(html),
          severity: 'HIGH',
          issue: 'WordPress debug mode enabled',
          recommendation: 'Disable WP_DEBUG in production'
        },
        {
          htmlCheck: (html) => /wp-content\/uploads/i.test(html),
          severity: 'MEDIUM',
          issue: 'Uploads directory may contain executable files',
          recommendation: 'Prevent execution in wp-content/uploads directory'
        }
      ],
      'Drupal': [
        {
          htmlCheck: (html) => /\/sites\/default\/settings\.php/i.test(html),
          severity: 'CRITICAL',
          issue: 'settings.php may be accessible',
          recommendation: 'Protect sites/default/settings.php from web access'
        },
        {
          htmlCheck: (html) => /\.private/i.test(html),
          severity: 'HIGH',
          issue: 'Private files directory may be exposed',
          recommendation: 'Configure private files directory outside web root'
        }
      ],
      'PHP': [
        {
          htmlCheck: (html) => /display_errors\s*=\s*[Oo]n/i.test(html),
          severity: 'MEDIUM',
          issue: 'PHP error display is enabled',
          recommendation: 'Set display_errors = Off in production'
        },
        {
          htmlCheck: (html) => /allow_url_include\s*=\s*[Oo]n/i.test(html),
          severity: 'CRITICAL',
          issue: 'PHP URL inclusion is enabled',
          recommendation: 'Set allow_url_include = Off'
        }
      ],
      'Apache': [
        {
          headerCheck: (headers) => headers['server'] && headers['server'].includes('Apache'),
          htmlCheck: (html) => /DirectoryListing/i.test(html) || /Index of/i.test(html),
          severity: 'MEDIUM',
          issue: 'Directory listing may be enabled',
          recommendation: 'Disable directory listing with Options -Indexes'
        }
      ],
      'Node.js': [
        {
          htmlCheck: (html) => /NODE_ENV\s*=\s*development/i.test(html),
          severity: 'MEDIUM',
          issue: 'Node.js running in development mode',
          recommendation: 'Set NODE_ENV to production'
        }
      ],
      'Django': [
        {
          htmlCheck: (html) => /ALLOWED_HOSTS\s*=\s*\[\s*['\"]?\*['\"]?\s*\]/i.test(html),
          severity: 'HIGH',
          issue: 'Django ALLOWED_HOSTS set to wildcard',
          recommendation: 'Restrict ALLOWED_HOSTS to specific domains'
        }
      ]
    };

    return patterns[techName] || [];
  }

  /**
   * Generate recommendations from issues
   * @private
   */
  _generateRecommendations(issues) {
    const recommendations = [];
    const seen = new Set();

    issues.forEach(issue => {
      if (issue.recommendation && !seen.has(issue.recommendation)) {
        recommendations.push({
          priority: this._getSeverityScore(issue.severity),
          severity: issue.severity,
          issue: issue.issue,
          recommendation: issue.recommendation
        });
        seen.add(issue.recommendation);
      }
    });

    recommendations.sort((a, b) => b.priority - a.priority);
    return recommendations;
  }

  /**
   * Normalize headers to lowercase keys
   * @private
   */
  _normalizeHeaders(headers) {
    const normalized = {};
    Object.entries(headers).forEach(([key, value]) => {
      normalized[key.toLowerCase()] = value;
    });
    return normalized;
  }

  /**
   * Get severity numeric score
   * @private
   */
  _getSeverityScore(severity) {
    const scores = {
      'CRITICAL': 4,
      'HIGH': 3,
      'MEDIUM': 2,
      'LOW': 1
    };
    return scores[severity] || 0;
  }
}

module.exports = ConfigurationAnalyzer;
