/**
 * Basset Hound Browser - Security Analyzer Module
 * Analyzes security headers, SSL/TLS certificates, and identifies security issues
 *
 * Provides comprehensive security header analysis including CSP, HSTS,
 * X-Frame-Options, and certificate validation.
 */

/**
 * Known security headers and their purposes
 */
const SECURITY_HEADERS = {
  // Content Security Policy
  'content-security-policy': {
    name: 'Content-Security-Policy',
    description: 'Controls resources the browser is allowed to load',
    importance: 'critical',
    reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP'
  },
  'content-security-policy-report-only': {
    name: 'Content-Security-Policy-Report-Only',
    description: 'CSP in report-only mode (does not enforce)',
    importance: 'medium',
    reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy-Report-Only'
  },

  // Transport Security
  'strict-transport-security': {
    name: 'Strict-Transport-Security',
    description: 'Forces HTTPS connections (HSTS)',
    importance: 'critical',
    reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security'
  },

  // Frame Protection
  'x-frame-options': {
    name: 'X-Frame-Options',
    description: 'Protects against clickjacking attacks',
    importance: 'high',
    reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options'
  },

  // Content Type Protection
  'x-content-type-options': {
    name: 'X-Content-Type-Options',
    description: 'Prevents MIME type sniffing',
    importance: 'high',
    reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options'
  },

  // XSS Protection
  'x-xss-protection': {
    name: 'X-XSS-Protection',
    description: 'Legacy XSS filter (deprecated but still seen)',
    importance: 'low',
    reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection'
  },

  // Referrer Policy
  'referrer-policy': {
    name: 'Referrer-Policy',
    description: 'Controls how much referrer info is sent',
    importance: 'medium',
    reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy'
  },

  // Permissions Policy (formerly Feature Policy)
  'permissions-policy': {
    name: 'Permissions-Policy',
    description: 'Controls browser features and APIs',
    importance: 'medium',
    reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy'
  },
  'feature-policy': {
    name: 'Feature-Policy',
    description: 'Deprecated predecessor to Permissions-Policy',
    importance: 'low',
    reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Feature-Policy'
  },

  // Cross-Origin Policies
  'cross-origin-embedder-policy': {
    name: 'Cross-Origin-Embedder-Policy',
    description: 'Controls embedding of cross-origin resources',
    importance: 'medium',
    reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy'
  },
  'cross-origin-opener-policy': {
    name: 'Cross-Origin-Opener-Policy',
    description: 'Isolates browsing context from cross-origin windows',
    importance: 'medium',
    reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy'
  },
  'cross-origin-resource-policy': {
    name: 'Cross-Origin-Resource-Policy',
    description: 'Controls who can load this resource',
    importance: 'medium',
    reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Resource-Policy'
  },

  // Cache Control
  'cache-control': {
    name: 'Cache-Control',
    description: 'Controls caching behavior',
    importance: 'medium',
    reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control'
  },

  // Public Key Pinning (deprecated)
  'public-key-pins': {
    name: 'Public-Key-Pins',
    description: 'Deprecated certificate pinning header',
    importance: 'low',
    reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Public-Key-Pins'
  },

  // Expect-CT
  'expect-ct': {
    name: 'Expect-CT',
    description: 'Certificate Transparency enforcement',
    importance: 'medium',
    reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expect-CT'
  }
};

/**
 * CSP directive definitions
 */
const CSP_DIRECTIVES = {
  'default-src': 'Default policy for loading content',
  'script-src': 'Valid sources for JavaScript',
  'style-src': 'Valid sources for stylesheets',
  'img-src': 'Valid sources for images',
  'font-src': 'Valid sources for fonts',
  'connect-src': 'Valid sources for fetch, XHR, WebSocket, EventSource',
  'media-src': 'Valid sources for audio and video',
  'object-src': 'Valid sources for plugins (object, embed)',
  'frame-src': 'Valid sources for frames',
  'child-src': 'Valid sources for web workers and frames',
  'worker-src': 'Valid sources for web workers',
  'manifest-src': 'Valid sources for web app manifests',
  'base-uri': 'Valid values for base element',
  'form-action': 'Valid targets for form submissions',
  'frame-ancestors': 'Valid parents that may embed this page',
  'report-uri': 'URL to send violation reports (deprecated)',
  'report-to': 'Reporting group for violation reports',
  'upgrade-insecure-requests': 'Upgrade HTTP to HTTPS',
  'block-all-mixed-content': 'Block all mixed content'
};

/**
 * SecurityAnalyzer class
 * Analyzes security headers and certificates
 */
class SecurityAnalyzer {
  constructor() {
    console.log('[SecurityAnalyzer] Initialized');
  }

  /**
   * Analyze all security headers from a response
   * @param {Object} headers - Response headers object
   * @param {string} url - The URL being analyzed
   * @returns {Object} - Analysis results
   */
  analyzeHeaders(headers, url) {
    if (!headers) {
      return {
        success: false,
        error: 'No headers provided'
      };
    }

    const normalizedHeaders = this.normalizeHeaders(headers);
    const present = [];
    const missing = [];
    const issues = [];
    const recommendations = [];

    // Check for each security header
    for (const [headerKey, headerInfo] of Object.entries(SECURITY_HEADERS)) {
      const headerValue = normalizedHeaders[headerKey];

      if (headerValue) {
        const analysis = this.analyzeSecurityHeader(headerKey, headerValue, url);
        present.push({
          name: headerInfo.name,
          value: headerValue,
          importance: headerInfo.importance,
          description: headerInfo.description,
          reference: headerInfo.reference,
          analysis: analysis
        });

        if (analysis.issues && analysis.issues.length > 0) {
          issues.push(...analysis.issues.map(i => ({
            header: headerInfo.name,
            ...i
          })));
        }

        if (analysis.recommendations && analysis.recommendations.length > 0) {
          recommendations.push(...analysis.recommendations.map(r => ({
            header: headerInfo.name,
            ...r
          })));
        }
      } else if (headerInfo.importance !== 'low') {
        missing.push({
          name: headerInfo.name,
          importance: headerInfo.importance,
          description: headerInfo.description,
          reference: headerInfo.reference,
          recommendation: this.getMissingHeaderRecommendation(headerKey)
        });
      }
    }

    // Calculate security score
    const score = this.calculateSecurityScore(present, missing, issues);

    return {
      success: true,
      url,
      analyzedAt: new Date().toISOString(),
      score,
      present,
      missing,
      issues,
      recommendations,
      summary: this.generateSummary(score, present, missing, issues)
    };
  }

  /**
   * Normalize headers to lowercase keys
   * @param {Object} headers - Headers object
   * @returns {Object} - Normalized headers
   */
  normalizeHeaders(headers) {
    const normalized = {};
    for (const [key, value] of Object.entries(headers)) {
      const normalizedKey = key.toLowerCase();
      // Handle array values (common in Electron)
      normalized[normalizedKey] = Array.isArray(value) ? value[0] : value;
    }
    return normalized;
  }

  /**
   * Analyze a specific security header
   * @param {string} headerKey - Header key (lowercase)
   * @param {string} value - Header value
   * @param {string} url - URL being analyzed
   * @returns {Object} - Analysis results
   */
  analyzeSecurityHeader(headerKey, value, url) {
    switch (headerKey) {
      case 'content-security-policy':
      case 'content-security-policy-report-only':
        return this.analyzeCSP(value);

      case 'strict-transport-security':
        return this.analyzeHSTS(value);

      case 'x-frame-options':
        return this.analyzeXFrameOptions(value);

      case 'x-content-type-options':
        return this.analyzeXContentTypeOptions(value);

      case 'referrer-policy':
        return this.analyzeReferrerPolicy(value);

      case 'permissions-policy':
      case 'feature-policy':
        return this.analyzePermissionsPolicy(value);

      case 'cross-origin-embedder-policy':
        return this.analyzeCOEP(value);

      case 'cross-origin-opener-policy':
        return this.analyzeCOOP(value);

      case 'cross-origin-resource-policy':
        return this.analyzeCORP(value);

      default:
        return { parsed: value, issues: [], recommendations: [] };
    }
  }

  /**
   * Analyze Content-Security-Policy header
   * @param {string} value - CSP header value
   * @returns {Object} - Analysis results
   */
  analyzeCSP(value) {
    const issues = [];
    const recommendations = [];
    const directives = {};

    // Parse CSP directives
    const parts = value.split(';').map(p => p.trim()).filter(p => p);

    for (const part of parts) {
      const [directive, ...values] = part.split(/\s+/);
      const directiveLower = directive.toLowerCase();
      directives[directiveLower] = values;

      // Check for unsafe values
      if (values.includes("'unsafe-inline'")) {
        issues.push({
          severity: 'high',
          message: `${directive} contains 'unsafe-inline' which weakens CSP protection`
        });
      }

      if (values.includes("'unsafe-eval'")) {
        issues.push({
          severity: 'high',
          message: `${directive} contains 'unsafe-eval' which allows code execution from strings`
        });
      }

      if (values.includes('*')) {
        issues.push({
          severity: 'medium',
          message: `${directive} uses wildcard (*) which allows any source`
        });
      }

      // Check for data: URIs
      if (values.includes('data:')) {
        if (['script-src', 'object-src', 'default-src'].includes(directiveLower)) {
          issues.push({
            severity: 'medium',
            message: `${directive} allows data: URIs which can be risky`
          });
        }
      }
    }

    // Check for missing critical directives
    if (!directives['default-src'] && !directives['script-src']) {
      recommendations.push({
        priority: 'high',
        message: 'Consider adding default-src or script-src directive'
      });
    }

    if (!directives['frame-ancestors']) {
      recommendations.push({
        priority: 'medium',
        message: 'Consider adding frame-ancestors to prevent clickjacking'
      });
    }

    if (!directives['upgrade-insecure-requests'] && !directives['block-all-mixed-content']) {
      recommendations.push({
        priority: 'low',
        message: 'Consider adding upgrade-insecure-requests directive'
      });
    }

    return {
      parsed: directives,
      directiveDescriptions: this.getDirectiveDescriptions(directives),
      issues,
      recommendations
    };
  }

  /**
   * Get descriptions for CSP directives
   * @param {Object} directives - Parsed directives
   * @returns {Object} - Directives with descriptions
   */
  getDirectiveDescriptions(directives) {
    const result = {};
    for (const directive of Object.keys(directives)) {
      result[directive] = CSP_DIRECTIVES[directive] || 'Unknown directive';
    }
    return result;
  }

  /**
   * Analyze Strict-Transport-Security header
   * @param {string} value - HSTS header value
   * @returns {Object} - Analysis results
   */
  analyzeHSTS(value) {
    const issues = [];
    const recommendations = [];
    const parsed = {
      maxAge: null,
      includeSubDomains: false,
      preload: false
    };

    // Parse HSTS directives
    const parts = value.toLowerCase().split(';').map(p => p.trim());

    for (const part of parts) {
      if (part.startsWith('max-age=')) {
        parsed.maxAge = parseInt(part.split('=')[1], 10);
      } else if (part === 'includesubdomains') {
        parsed.includeSubDomains = true;
      } else if (part === 'preload') {
        parsed.preload = true;
      }
    }

    // Check max-age value
    if (parsed.maxAge === null || parsed.maxAge === 0) {
      issues.push({
        severity: 'high',
        message: 'HSTS max-age is not set or is zero, HSTS is disabled'
      });
    } else if (parsed.maxAge < 31536000) { // Less than 1 year
      issues.push({
        severity: 'medium',
        message: 'HSTS max-age is less than 1 year (31536000 seconds)'
      });
      recommendations.push({
        priority: 'medium',
        message: 'Consider increasing max-age to at least 1 year (31536000)'
      });
    }

    // Check for includeSubDomains
    if (!parsed.includeSubDomains) {
      recommendations.push({
        priority: 'medium',
        message: 'Consider adding includeSubDomains for complete protection'
      });
    }

    // Check for preload
    if (!parsed.preload && parsed.maxAge >= 31536000 && parsed.includeSubDomains) {
      recommendations.push({
        priority: 'low',
        message: 'Consider adding preload directive and submitting to HSTS preload list'
      });
    }

    return { parsed, issues, recommendations };
  }

  /**
   * Analyze X-Frame-Options header
   * @param {string} value - Header value
   * @returns {Object} - Analysis results
   */
  analyzeXFrameOptions(value) {
    const issues = [];
    const recommendations = [];
    const upperValue = value.toUpperCase().trim();

    const parsed = {
      directive: upperValue,
      allowFrom: null
    };

    if (upperValue.startsWith('ALLOW-FROM')) {
      parsed.directive = 'ALLOW-FROM';
      parsed.allowFrom = value.substring(11).trim();
      issues.push({
        severity: 'medium',
        message: 'ALLOW-FROM is deprecated and not supported by modern browsers'
      });
      recommendations.push({
        priority: 'high',
        message: 'Use CSP frame-ancestors directive instead of X-Frame-Options ALLOW-FROM'
      });
    } else if (upperValue !== 'DENY' && upperValue !== 'SAMEORIGIN') {
      issues.push({
        severity: 'high',
        message: `Invalid X-Frame-Options value: ${value}`
      });
    }

    // Recommend CSP frame-ancestors
    recommendations.push({
      priority: 'low',
      message: 'Consider using CSP frame-ancestors directive as a modern replacement'
    });

    return { parsed, issues, recommendations };
  }

  /**
   * Analyze X-Content-Type-Options header
   * @param {string} value - Header value
   * @returns {Object} - Analysis results
   */
  analyzeXContentTypeOptions(value) {
    const issues = [];
    const recommendations = [];

    if (value.toLowerCase().trim() !== 'nosniff') {
      issues.push({
        severity: 'high',
        message: `Invalid X-Content-Type-Options value: ${value}. Expected: nosniff`
      });
    }

    return { parsed: value.toLowerCase().trim(), issues, recommendations };
  }

  /**
   * Analyze Referrer-Policy header
   * @param {string} value - Header value
   * @returns {Object} - Analysis results
   */
  analyzeReferrerPolicy(value) {
    const issues = [];
    const recommendations = [];
    const validPolicies = [
      'no-referrer',
      'no-referrer-when-downgrade',
      'origin',
      'origin-when-cross-origin',
      'same-origin',
      'strict-origin',
      'strict-origin-when-cross-origin',
      'unsafe-url'
    ];

    const lowerValue = value.toLowerCase().trim();

    if (!validPolicies.includes(lowerValue)) {
      issues.push({
        severity: 'medium',
        message: `Unknown Referrer-Policy value: ${value}`
      });
    }

    if (lowerValue === 'unsafe-url') {
      issues.push({
        severity: 'high',
        message: 'Referrer-Policy "unsafe-url" exposes full URL including query parameters'
      });
      recommendations.push({
        priority: 'high',
        message: 'Consider using strict-origin-when-cross-origin or no-referrer'
      });
    }

    if (lowerValue === 'no-referrer-when-downgrade') {
      recommendations.push({
        priority: 'low',
        message: 'Consider using strict-origin-when-cross-origin for better privacy'
      });
    }

    return { parsed: lowerValue, issues, recommendations };
  }

  /**
   * Analyze Permissions-Policy header
   * @param {string} value - Header value
   * @returns {Object} - Analysis results
   */
  analyzePermissionsPolicy(value) {
    const issues = [];
    const recommendations = [];
    const policies = {};

    // Parse Permissions-Policy
    const parts = value.split(',').map(p => p.trim());

    for (const part of parts) {
      const match = part.match(/^([a-z-]+)=\((.*)\)$/i);
      if (match) {
        const [, feature, allowList] = match;
        policies[feature] = allowList ? allowList.split(/\s+/) : [];
      }
    }

    // Check for dangerous permissions
    const sensitiveFeatures = ['camera', 'microphone', 'geolocation', 'payment'];
    for (const feature of sensitiveFeatures) {
      if (policies[feature] && policies[feature].includes('*')) {
        issues.push({
          severity: 'medium',
          message: `${feature} permission is allowed for all origins`
        });
      }
    }

    return { parsed: policies, issues, recommendations };
  }

  /**
   * Analyze Cross-Origin-Embedder-Policy header
   * @param {string} value - Header value
   * @returns {Object} - Analysis results
   */
  analyzeCOEP(value) {
    const issues = [];
    const recommendations = [];
    const lowerValue = value.toLowerCase().trim();

    const validValues = ['unsafe-none', 'require-corp', 'credentialless'];
    if (!validValues.includes(lowerValue)) {
      issues.push({
        severity: 'medium',
        message: `Unknown COEP value: ${value}`
      });
    }

    return { parsed: lowerValue, issues, recommendations };
  }

  /**
   * Analyze Cross-Origin-Opener-Policy header
   * @param {string} value - Header value
   * @returns {Object} - Analysis results
   */
  analyzeCOOP(value) {
    const issues = [];
    const recommendations = [];
    const lowerValue = value.toLowerCase().trim();

    const validValues = ['unsafe-none', 'same-origin-allow-popups', 'same-origin'];
    if (!validValues.includes(lowerValue)) {
      issues.push({
        severity: 'medium',
        message: `Unknown COOP value: ${value}`
      });
    }

    return { parsed: lowerValue, issues, recommendations };
  }

  /**
   * Analyze Cross-Origin-Resource-Policy header
   * @param {string} value - Header value
   * @returns {Object} - Analysis results
   */
  analyzeCORP(value) {
    const issues = [];
    const recommendations = [];
    const lowerValue = value.toLowerCase().trim();

    const validValues = ['same-site', 'same-origin', 'cross-origin'];
    if (!validValues.includes(lowerValue)) {
      issues.push({
        severity: 'medium',
        message: `Unknown CORP value: ${value}`
      });
    }

    return { parsed: lowerValue, issues, recommendations };
  }

  /**
   * Get recommendation for missing security header
   * @param {string} headerKey - Header key
   * @returns {string} - Recommendation
   */
  getMissingHeaderRecommendation(headerKey) {
    const recommendations = {
      'content-security-policy': "Add a Content-Security-Policy header to control resource loading",
      'strict-transport-security': "Add Strict-Transport-Security header to enforce HTTPS",
      'x-frame-options': "Add X-Frame-Options: DENY or SAMEORIGIN to prevent clickjacking",
      'x-content-type-options': "Add X-Content-Type-Options: nosniff to prevent MIME sniffing",
      'referrer-policy': "Add Referrer-Policy to control referrer information",
      'permissions-policy': "Consider adding Permissions-Policy to control browser features",
      'cross-origin-embedder-policy': "Consider adding COEP for cross-origin isolation",
      'cross-origin-opener-policy': "Consider adding COOP for cross-origin isolation",
      'cross-origin-resource-policy': "Consider adding CORP to control resource loading"
    };

    return recommendations[headerKey] || `Consider adding ${headerKey} header`;
  }

  /**
   * Calculate overall security score
   * @param {Array} present - Present headers
   * @param {Array} missing - Missing headers
   * @param {Array} issues - Security issues
   * @returns {Object} - Score object
   */
  calculateSecurityScore(present, missing, issues) {
    let score = 100;
    let grade = 'A+';

    // Deduct for missing critical headers
    const criticalMissing = missing.filter(h => h.importance === 'critical');
    const highMissing = missing.filter(h => h.importance === 'high');
    const mediumMissing = missing.filter(h => h.importance === 'medium');

    score -= criticalMissing.length * 20;
    score -= highMissing.length * 10;
    score -= mediumMissing.length * 5;

    // Deduct for issues
    const highIssues = issues.filter(i => i.severity === 'high');
    const mediumIssues = issues.filter(i => i.severity === 'medium');

    score -= highIssues.length * 10;
    score -= mediumIssues.length * 5;

    // Ensure score is between 0 and 100
    score = Math.max(0, Math.min(100, score));

    // Determine grade
    if (score >= 90) grade = 'A+';
    else if (score >= 80) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 60) grade = 'C';
    else if (score >= 50) grade = 'D';
    else grade = 'F';

    return {
      score,
      grade,
      criticalMissingCount: criticalMissing.length,
      highMissingCount: highMissing.length,
      highIssuesCount: highIssues.length,
      mediumIssuesCount: mediumIssues.length
    };
  }

  /**
   * Generate human-readable summary
   * @param {Object} score - Score object
   * @param {Array} present - Present headers
   * @param {Array} missing - Missing headers
   * @param {Array} issues - Issues found
   * @returns {string} - Summary text
   */
  generateSummary(score, present, missing, issues) {
    const parts = [];

    parts.push(`Security Score: ${score.score}/100 (Grade: ${score.grade})`);
    parts.push(`Security Headers Present: ${present.length}`);
    parts.push(`Missing Headers: ${missing.length}`);
    parts.push(`Issues Found: ${issues.length}`);

    if (score.criticalMissingCount > 0) {
      parts.push(`WARNING: ${score.criticalMissingCount} critical security header(s) missing`);
    }

    if (score.highIssuesCount > 0) {
      parts.push(`WARNING: ${score.highIssuesCount} high-severity issue(s) detected`);
    }

    return parts.join('\n');
  }

  /**
   * Analyze SSL/TLS certificate information
   * @param {Object} certificate - Certificate object from Electron
   * @returns {Object} - Certificate analysis
   */
  analyzeCertificate(certificate) {
    if (!certificate) {
      return {
        success: false,
        error: 'No certificate provided'
      };
    }

    const issues = [];
    const now = new Date();

    // Parse certificate dates
    const validFrom = new Date(certificate.validStart * 1000);
    const validTo = new Date(certificate.validExpiry * 1000);
    const daysUntilExpiry = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

    // Check validity
    if (now < validFrom) {
      issues.push({
        severity: 'critical',
        message: 'Certificate is not yet valid'
      });
    }

    if (now > validTo) {
      issues.push({
        severity: 'critical',
        message: 'Certificate has expired'
      });
    } else if (daysUntilExpiry < 30) {
      issues.push({
        severity: 'high',
        message: `Certificate expires in ${daysUntilExpiry} days`
      });
    } else if (daysUntilExpiry < 90) {
      issues.push({
        severity: 'medium',
        message: `Certificate expires in ${daysUntilExpiry} days`
      });
    }

    // Check issuer
    const issuer = certificate.issuerName || certificate.issuer;
    const subject = certificate.subjectName || certificate.subject;

    // Check for self-signed
    if (issuer === subject) {
      issues.push({
        severity: 'high',
        message: 'Certificate appears to be self-signed'
      });
    }

    return {
      success: true,
      certificate: {
        subject,
        issuer,
        validFrom: validFrom.toISOString(),
        validTo: validTo.toISOString(),
        daysUntilExpiry,
        serialNumber: certificate.serialNumber,
        fingerprint: certificate.fingerprint
      },
      issues,
      isValid: now >= validFrom && now <= validTo && issues.filter(i => i.severity === 'critical').length === 0
    };
  }

  /**
   * Get comprehensive security info for a URL
   * @param {string} url - URL to analyze
   * @param {Object} headers - Response headers
   * @param {Object} certificate - SSL certificate
   * @returns {Object} - Complete security analysis
   */
  getSecurityInfo(url, headers, certificate) {
    const headerAnalysis = this.analyzeHeaders(headers, url);
    const certAnalysis = certificate ? this.analyzeCertificate(certificate) : null;

    // Determine if URL uses HTTPS
    const isHttps = url.startsWith('https://');

    const allIssues = [...(headerAnalysis.issues || [])];
    if (certAnalysis && certAnalysis.issues) {
      allIssues.push(...certAnalysis.issues.map(i => ({ ...i, category: 'certificate' })));
    }

    if (!isHttps) {
      allIssues.push({
        severity: 'critical',
        category: 'transport',
        message: 'Connection is not using HTTPS'
      });
    }

    return {
      success: true,
      url,
      isHttps,
      analyzedAt: new Date().toISOString(),
      headers: headerAnalysis,
      certificate: certAnalysis,
      allIssues,
      overallSecure: isHttps &&
        (certAnalysis ? certAnalysis.isValid : true) &&
        allIssues.filter(i => i.severity === 'critical').length === 0
    };
  }

  /**
   * Get list of known security headers
   * @returns {Object} - Security headers info
   */
  getSecurityHeadersList() {
    return {
      success: true,
      headers: Object.entries(SECURITY_HEADERS).map(([key, info]) => ({
        key,
        ...info
      }))
    };
  }

  /**
   * Get CSP directive list
   * @returns {Object} - CSP directives info
   */
  getCSPDirectivesList() {
    return {
      success: true,
      directives: Object.entries(CSP_DIRECTIVES).map(([directive, description]) => ({
        directive,
        description
      }))
    };
  }
}

module.exports = {
  SecurityAnalyzer,
  SECURITY_HEADERS,
  CSP_DIRECTIVES
};
