/**
 * Shodan Integration Client
 * Integrates with Shodan API for internet-wide host and service scanning
 * @module src/integrations/shodan-client
 */

const EventEmitter = require('events');
const https = require('https');
const http = require('http');

/**
 * Shodan Client Class
 */
class ShodanClient extends EventEmitter {
  constructor(options = {}) {
    super();

    this.apiKey = options.apiKey || process.env.SHODAN_API_KEY;
    this.baseUrl = 'api.shodan.io';
    this.protocol = 'https';
    this.timeout = options.timeout || 15000;
    this.rateLimit = options.rateLimit || 1; // requests per second
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.cache = new Map();
    this.cacheTimeout = options.cacheTimeout || 3600000; // 1 hour
    this.requestQueue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
    this.quotaInfo = {
      queriesLeft: 0,
      queriesUsed: 0,
      resetTime: null
    };

    // Metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cachedRequests: 0,
      totalLatency: 0,
      apiErrors: new Map()
    };
  }

  /**
   * Get host information from Shodan
   * @param {string} hostIp - IP address or hostname
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Host information
   */
  async getHost(hostIp, options = {}) {
    const cacheKey = `host:${hostIp}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.metrics.cachedRequests++;
        this.emit('cache-hit', { type: 'host', key: cacheKey });
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    const params = new URLSearchParams({
      key: this.apiKey,
      history: options.history ? 'true' : 'false',
      minify: options.minify !== false ? 'true' : 'false'
    });

    try {
      const startTime = Date.now();
      const data = await this.makeRequest(`/shodan/host/${hostIp}`, params);
      const latency = Date.now() - startTime;

      // Parse response
      const hostInfo = {
        ip: data.ip_str,
        country: data.country_code,
        countryName: data.country_name,
        city: data.city,
        latitude: data.latitude,
        longitude: data.longitude,
        org: data.org,
        isp: data.isp,
        asn: data.asn,
        ports: data.ports || [],
        services: this.parseServices(data),
        vulnCount: data.vuln ? Object.keys(data.vuln).length : 0,
        vulnerabilities: data.vuln ? Object.keys(data.vuln) : [],
        banners: data.data || [],
        hostnames: data.hostnames || [],
        lastUpdate: new Date(data.last_update),
        timestamp: Date.now()
      };

      // Cache result
      this.cache.set(cacheKey, {
        data: hostInfo,
        timestamp: Date.now()
      });

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;

      this.emit('host-info-retrieved', {
        ip: hostIp,
        serviceCount: hostInfo.ports.length,
        vulnCount: hostInfo.vulnCount,
        latency
      });

      return hostInfo;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('getHost', error);
      throw error;
    }
  }

  /**
   * Search for hosts by query
   * @param {string} query - Shodan search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async search(query, options = {}) {
    const cacheKey = `search:${query}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.metrics.cachedRequests++;
        this.emit('cache-hit', { type: 'search', query });
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    const params = new URLSearchParams({
      key: this.apiKey,
      query: query,
      page: options.page || 1,
      minify: options.minify !== false ? 'true' : 'false'
    });

    try {
      const startTime = Date.now();
      const data = await this.makeRequest('/shodan/host/search', params);
      const latency = Date.now() - startTime;

      const results = {
        query,
        total: data.total,
        matches: (data.matches || []).map(match => ({
          ip: match.ip_str,
          port: match.port,
          protocol: match._shodan?.module || 'unknown',
          product: match.product,
          version: match.version,
          banner: match.data,
          timestamp: match.timestamp,
          organization: match.org,
          location: {
            country: match.country_code,
            city: match.city,
            latitude: match.latitude,
            longitude: match.longitude
          },
          hostnames: match.hostnames || [],
          domains: match.domains || []
        })),
        facets: data.facets || {},
        timestamp: Date.now()
      };

      // Cache result
      this.cache.set(cacheKey, {
        data: results,
        timestamp: Date.now()
      });

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;

      this.emit('search-completed', {
        query,
        resultCount: results.matches.length,
        total: results.total,
        latency
      });

      return results;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('search', error);
      throw error;
    }
  }

  /**
   * Get vulnerability data for a host
   * @param {string} hostIp - IP address
   * @param {Object} options - Options
   * @returns {Promise<Object>} Vulnerability data
   */
  async getVulnerabilities(hostIp, options = {}) {
    try {
      const hostInfo = await this.getHost(hostIp, { includeVulnerabilities: true });

      const vulnData = {
        ip: hostIp,
        vulnerabilities: hostInfo.vulnerabilities.map(vuln => ({
          cveId: vuln,
          severity: this.parseVulnSeverity(vuln),
          timestamp: Date.now()
        })),
        totalCount: hostInfo.vulnCount,
        ports: hostInfo.ports,
        services: hostInfo.services,
        riskScore: this.calculateRiskScore(hostInfo),
        timestamp: Date.now()
      };

      this.emit('vulnerabilities-retrieved', {
        ip: hostIp,
        vulnCount: vulnData.totalCount,
        riskScore: vulnData.riskScore
      });

      return vulnData;
    } catch (error) {
      this.trackError('getVulnerabilities', error);
      throw error;
    }
  }

  /**
   * Get DNS records via Shodan
   * @param {string} domain - Domain name
   * @param {Object} options - Options
   * @returns {Promise<Object>} DNS records
   */
  async getDnsRecords(domain, options = {}) {
    const cacheKey = `dns:${domain}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.metrics.cachedRequests++;
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    const params = new URLSearchParams({
      key: this.apiKey,
      domain: domain
    });

    try {
      const startTime = Date.now();
      const data = await this.makeRequest('/dns/resolve', params);
      const latency = Date.now() - startTime;

      const dnsInfo = {
        domain,
        records: data,
        resolvedIps: Object.values(data).filter(ip => this.isValidIp(ip)),
        timestamp: Date.now()
      };

      this.cache.set(cacheKey, {
        data: dnsInfo,
        timestamp: Date.now()
      });

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;

      return dnsInfo;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('getDnsRecords', error);
      throw error;
    }
  }

  /**
   * Get real-time alerts for a query
   * @param {string} alertId - Alert ID or query
   * @param {Object} options - Options
   * @returns {Promise<Object>} Alert data
   */
  async getAlert(alertId, options = {}) {
    const params = new URLSearchParams({
      key: this.apiKey
    });

    try {
      const startTime = Date.now();
      const data = await this.makeRequest(`/shodan/alert/${alertId}`, params);
      const latency = Date.now() - startTime;

      const alertData = {
        id: data.id,
        name: data.name,
        query: data.query,
        created: new Date(data.created),
        expires: data.expires ? new Date(data.expires) : null,
        matches: data.matches || [],
        notifiers: data.notifiers || [],
        triggers: data.triggers || [],
        timestamp: Date.now()
      };

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;

      this.emit('alert-retrieved', {
        alertId,
        matchCount: alertData.matches.length,
        latency
      });

      return alertData;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('getAlert', error);
      throw error;
    }
  }

  /**
   * Create a real-time alert
   * @param {Object} alertConfig - Alert configuration
   * @returns {Promise<Object>} Created alert
   */
  async createAlert(alertConfig) {
    if (!alertConfig.name || !alertConfig.query) {
      throw new Error('Alert name and query are required');
    }

    const params = new URLSearchParams({
      key: this.apiKey,
      name: alertConfig.name,
      query: alertConfig.query,
      expiration: alertConfig.expiration || 30
    });

    try {
      const startTime = Date.now();
      const data = await this.makeRequest('/shodan/alert', params, 'POST');
      const latency = Date.now() - startTime;

      const alert = {
        id: data.id,
        name: data.name,
        query: data.query,
        created: new Date(data.created),
        expiration: alertConfig.expiration,
        timestamp: Date.now()
      };

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;

      this.emit('alert-created', {
        alertId: alert.id,
        name: alert.name,
        latency
      });

      return alert;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('createAlert', error);
      throw error;
    }
  }

  /**
   * Get account profile and API quota info
   * @returns {Promise<Object>} Profile and quota data
   */
  async getProfile() {
    const params = new URLSearchParams({
      key: this.apiKey
    });

    try {
      const startTime = Date.now();
      const data = await this.makeRequest('/shodan/profile', params);
      const latency = Date.now() - startTime;

      this.quotaInfo = {
        queriesLeft: data.query_credits,
        queriesUsed: data.query_credits_used,
        resetTime: data.credits_reset_time,
        scanCredits: data.scan_credits,
        member: data.member,
        membershipType: data.membership
      };

      const profile = {
        username: data.username || 'unknown',
        email: data.email || 'unknown',
        membership: data.membership,
        organization: data.organization,
        credits: {
          queryCredits: data.query_credits,
          queryCreditsUsed: data.query_credits_used,
          scanCredits: data.scan_credits,
          crawlCredits: data.crawl_credits
        },
        timestamp: Date.now()
      };

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;

      this.emit('profile-retrieved', {
        username: profile.username,
        queriesLeft: profile.credits.queryCredits,
        latency
      });

      return profile;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('getProfile', error);
      throw error;
    }
  }

  /**
   * Make HTTP request with retry logic and rate limiting
   * @private
   */
  async makeRequest(path, params, method = 'GET') {
    if (!this.apiKey) {
      throw new Error('Shodan API key not configured');
    }

    const fullUrl = `${path}?${params.toString()}`;
    let lastError;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        // Rate limiting
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minInterval = 1000 / this.rateLimit;

        if (timeSinceLastRequest < minInterval) {
          await new Promise(resolve =>
            setTimeout(resolve, minInterval - timeSinceLastRequest)
          );
        }

        this.lastRequestTime = Date.now();

        return await new Promise((resolve, reject) => {
          const requestUrl = `https://${this.baseUrl}${fullUrl}`;
          const lib = this.protocol === 'https' ? https : http;

          const req = lib.request(requestUrl, {
            method,
            timeout: this.timeout
          }, (res) => {
            let body = '';

            res.on('data', chunk => body += chunk);
            res.on('end', () => {
              try {
                if (res.statusCode >= 400) {
                  const error = new Error(`Shodan API error: ${res.statusCode}`);
                  error.statusCode = res.statusCode;
                  error.response = body;
                  reject(error);
                } else {
                  resolve(JSON.parse(body));
                }
              } catch (err) {
                reject(err);
              }
            });
          });

          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Shodan API request timeout'));
          });

          req.end();
        });
      } catch (error) {
        lastError = error;

        // Check if retry-able
        if (error.statusCode === 403) {
          throw new Error('Shodan API key invalid or insufficient quota');
        }

        if (attempt < this.retryAttempts - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Shodan API request failed');
  }

  /**
   * Helper: Parse services from host data
   * @private
   */
  parseServices(data) {
    return (data.data || []).map((banner, index) => ({
      port: data.ports[index] || null,
      protocol: banner.split('\r\n')[0],
      banner: banner.substring(0, 200),
      service: this.identifyService(data.ports[index] || 0)
    }));
  }

  /**
   * Helper: Identify service by port
   * @private
   */
  identifyService(port) {
    const commonServices = {
      21: 'FTP',
      22: 'SSH',
      23: 'Telnet',
      25: 'SMTP',
      53: 'DNS',
      80: 'HTTP',
      110: 'POP3',
      143: 'IMAP',
      443: 'HTTPS',
      445: 'SMB',
      3306: 'MySQL',
      3389: 'RDP',
      5432: 'PostgreSQL',
      5900: 'VNC',
      8080: 'HTTP-Alt',
      8443: 'HTTPS-Alt',
      27017: 'MongoDB'
    };
    return commonServices[port] || 'Unknown';
  }

  /**
   * Helper: Check if valid IP address
   * @private
   */
  isValidIp(str) {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    return ipv4Regex.test(str);
  }

  /**
   * Helper: Parse vulnerability severity from CVE ID
   * @private
   */
  parseVulnSeverity(cveId) {
    // Simplified severity based on CVE year
    const year = parseInt(cveId.split('-')[1]);
    if (year > 2022) return 'high';
    if (year > 2020) return 'medium';
    return 'low';
  }

  /**
   * Helper: Calculate risk score based on vulnerabilities and services
   * @private
   */
  calculateRiskScore(hostInfo) {
    let score = 0;

    // Base score from vulnerability count
    score += Math.min(hostInfo.vulnCount * 10, 50);

    // Add points for exposed services
    score += hostInfo.ports.length * 2;

    // Add points for common attack surface
    const highRiskPorts = [21, 23, 445, 3306, 3389, 27017];
    const exposedHighRiskPorts = hostInfo.ports.filter(p => highRiskPorts.includes(p));
    score += exposedHighRiskPorts.length * 15;

    return Math.min(score, 100);
  }

  /**
   * Track API errors
   * @private
   */
  trackError(method, error) {
    const errorKey = `${method}:${error.message}`;
    const count = this.metrics.apiErrors.get(errorKey) || 0;
    this.metrics.apiErrors.set(errorKey, count + 1);

    this.emit('error', {
      method,
      error: error.message,
      timestamp: Date.now()
    });
  }

  /**
   * Get metrics summary
   */
  getMetrics() {
    return {
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      cachedRequests: this.metrics.cachedRequests,
      averageLatency: this.metrics.totalRequests > 0
        ? Math.round(this.metrics.totalLatency / this.metrics.successfulRequests)
        : 0,
      cacheSize: this.cache.size,
      quotaInfo: this.quotaInfo
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.emit('cache-cleared');
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cachedRequests: 0,
      totalLatency: 0,
      apiErrors: new Map()
    };
  }
}

module.exports = {
  ShodanClient,
  createShodanClient: (options) => new ShodanClient(options)
};
