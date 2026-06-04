/**
 * Censys Integration Client
 * Integrates with Censys API for IPv4/IPv6, certificate, and ASN data
 * @module src/integrations/censys-client
 */

const EventEmitter = require('events');
const https = require('https');

/**
 * Censys Client Class
 */
class CensysClient extends EventEmitter {
  constructor(options = {}) {
    super();

    this.apiId = options.apiId || process.env.CENSYS_API_ID;
    this.apiSecret = options.apiSecret || process.env.CENSYS_API_SECRET;
    this.baseUrl = 'censys.io/api/v2';
    this.protocol = 'https';
    this.timeout = options.timeout || 20000;
    this.rateLimit = options.rateLimit || 2; // requests per second
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.cache = new Map();
    this.cacheTimeout = options.cacheTimeout || 3600000; // 1 hour
    this.lastRequestTime = 0;
    this.quotaInfo = {
      remaining: 0,
      reset: null
    };

    // Metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cachedRequests: 0,
      totalLatency: 0,
      hostsQueried: 0,
      certificatesQueried: 0,
      asnQueried: 0,
      apiErrors: new Map()
    };
  }

  /**
   * Search IPv4 addresses
   * @param {string} query - Censys IPv4 search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchIPv4(query, options = {}) {
    const cacheKey = `ipv4:${query}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.metrics.cachedRequests++;
        this.emit('cache-hit', { type: 'ipv4', query });
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    const body = {
      q: query,
      per_page: options.pageSize || 50,
      cursor: options.cursor
    };

    try {
      const startTime = Date.now();
      const data = await this.makeRequest('/ipv4/search', 'POST', body);
      const latency = Date.now() - startTime;

      const results = {
        query,
        total: data.total,
        pageSize: data.per_page,
        cursor: data.cursor,
        results: (data.results || []).map(result => ({
          ip: result.ip,
          autonomousSystem: result.autonomous_system || {},
          location: result.location || {},
          services: result.services || [],
          lastScan: result.last_updated_at,
          certificateIds: result.certificate_ids || [],
          operatingSystem: result.operating_system,
          timestamp: Date.now()
        })),
        timestamp: Date.now()
      };

      this.cache.set(cacheKey, {
        data: results,
        timestamp: Date.now()
      });

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;
      this.metrics.hostsQueried += results.results.length;

      this.emit('ipv4-search-completed', {
        query,
        resultCount: results.results.length,
        total: results.total,
        latency
      });

      return results;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('searchIPv4', error);
      throw error;
    }
  }

  /**
   * Get details for specific IPv4 address
   * @param {string} ipAddress - IPv4 address
   * @param {Object} options - Options
   * @returns {Promise<Object>} Host details
   */
  async getIPv4Details(ipAddress, options = {}) {
    const cacheKey = `ipv4-details:${ipAddress}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.metrics.cachedRequests++;
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    try {
      const startTime = Date.now();
      const data = await this.makeRequest(`/ipv4/${ipAddress}`, 'GET');
      const latency = Date.now() - startTime;

      const details = {
        ip: data.ip,
        autonomousSystem: {
          asn: data.autonomous_system?.asn,
          name: data.autonomous_system?.name,
          country: data.autonomous_system?.country_code
        },
        location: {
          country: data.location?.country_code,
          countryName: data.location?.country,
          city: data.location?.city,
          latitude: data.location?.latitude,
          longitude: data.location?.longitude,
          timezone: data.location?.timezone
        },
        services: (data.services || []).map(service => ({
          port: service.port,
          protocol: service.protocol,
          cipher: service.cipher,
          tlsVersion: service.tls_version,
          certificateIds: service.certificate_ids || []
        })),
        operatingSystem: data.operating_system,
        lastScan: new Date(data.last_updated_at),
        certificateIds: data.certificate_ids || [],
        reverseDns: data.reverse_dns || null,
        timestamp: Date.now()
      };

      this.cache.set(cacheKey, {
        data: details,
        timestamp: Date.now()
      });

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;
      this.metrics.hostsQueried++;

      this.emit('ipv4-details-retrieved', {
        ip: ipAddress,
        serviceCount: details.services.length,
        latency
      });

      return details;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('getIPv4Details', error);
      throw error;
    }
  }

  /**
   * Search IPv6 addresses
   * @param {string} query - Censys IPv6 search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchIPv6(query, options = {}) {
    const cacheKey = `ipv6:${query}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.metrics.cachedRequests++;
        this.emit('cache-hit', { type: 'ipv6', query });
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    const body = {
      q: query,
      per_page: options.pageSize || 50,
      cursor: options.cursor
    };

    try {
      const startTime = Date.now();
      const data = await this.makeRequest('/ipv6/search', 'POST', body);
      const latency = Date.now() - startTime;

      const results = {
        query,
        total: data.total,
        pageSize: data.per_page,
        cursor: data.cursor,
        results: (data.results || []).map(result => ({
          ip: result.ip,
          autonomousSystem: result.autonomous_system || {},
          services: result.services || [],
          lastScan: result.last_updated_at,
          timestamp: Date.now()
        })),
        timestamp: Date.now()
      };

      this.cache.set(cacheKey, {
        data: results,
        timestamp: Date.now()
      });

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;
      this.metrics.hostsQueried += results.results.length;

      this.emit('ipv6-search-completed', {
        query,
        resultCount: results.results.length,
        latency
      });

      return results;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('searchIPv6', error);
      throw error;
    }
  }

  /**
   * Search SSL/TLS certificates
   * @param {string} query - Certificate search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Certificate results
   */
  async searchCertificates(query, options = {}) {
    const cacheKey = `certs:${query}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.metrics.cachedRequests++;
        this.emit('cache-hit', { type: 'certificate', query });
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    const body = {
      q: query,
      per_page: options.pageSize || 50,
      cursor: options.cursor
    };

    try {
      const startTime = Date.now();
      const data = await this.makeRequest('/certificates/search', 'POST', body);
      const latency = Date.now() - startTime;

      const results = {
        query,
        total: data.total,
        pageSize: data.per_page,
        cursor: data.cursor,
        results: (data.results || []).map(cert => ({
          fingerprintSHA256: cert.fingerprint_sha256,
          subject: cert.subject,
          issuer: cert.issuer,
          validFrom: new Date(cert.valid_from),
          validUntil: new Date(cert.valid_to),
          domains: cert.names || [],
          keyAlgorithm: cert.key_algorithm,
          keySize: cert.key_size,
          publicKeyInfo: {
            algorithm: cert.public_key_algorithm,
            size: cert.public_key_size
          },
          timestamp: Date.now()
        })),
        timestamp: Date.now()
      };

      this.cache.set(cacheKey, {
        data: results,
        timestamp: Date.now()
      });

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;
      this.metrics.certificatesQueried += results.results.length;

      this.emit('certificate-search-completed', {
        query,
        resultCount: results.results.length,
        total: results.total,
        latency
      });

      return results;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('searchCertificates', error);
      throw error;
    }
  }

  /**
   * Get certificate details
   * @param {string} certificateId - Certificate SHA256 fingerprint
   * @returns {Promise<Object>} Certificate details
   */
  async getCertificateDetails(certificateId) {
    const cacheKey = `cert-details:${certificateId}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.metrics.cachedRequests++;
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    try {
      const startTime = Date.now();
      const data = await this.makeRequest(
        `/certificates/${certificateId}`,
        'GET'
      );
      const latency = Date.now() - startTime;

      const details = {
        fingerprintSHA256: data.fingerprint_sha256,
        fingerprintMD5: data.fingerprint_md5,
        subject: data.subject,
        issuer: data.issuer,
        validFrom: new Date(data.valid_from),
        validUntil: new Date(data.valid_to),
        domains: data.names || [],
        altNames: data.alternate_names || [],
        serialNumber: data.serial_number,
        keyAlgorithm: data.key_algorithm,
        keySize: data.key_size,
        signatureAlgorithm: data.signature_algorithm,
        publicKey: data.public_key,
        extensions: data.extensions || {},
        timestamp: Date.now()
      };

      this.cache.set(cacheKey, {
        data: details,
        timestamp: Date.now()
      });

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;

      return details;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('getCertificateDetails', error);
      throw error;
    }
  }

  /**
   * Search ASN (Autonomous System Number) data
   * @param {string} query - ASN search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} ASN results
   */
  async searchASN(query, options = {}) {
    const cacheKey = `asn:${query}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.metrics.cachedRequests++;
        this.emit('cache-hit', { type: 'asn', query });
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    const body = {
      q: query,
      per_page: options.pageSize || 50,
      cursor: options.cursor
    };

    try {
      const startTime = Date.now();
      const data = await this.makeRequest('/autonomous-systems/search', 'POST', body);
      const latency = Date.now() - startTime;

      const results = {
        query,
        total: data.total,
        results: (data.results || []).map(asn => ({
          asn: asn.asn,
          name: asn.name,
          country: asn.country_code,
          ipv4Prefixes: asn.ipv4_prefixes || [],
          ipv4Count: asn.ipv4_count,
          ipv6Prefixes: asn.ipv6_prefixes || [],
          ipv6Count: asn.ipv6_count,
          registrationDate: asn.registration_date,
          timestamp: Date.now()
        })),
        timestamp: Date.now()
      };

      this.cache.set(cacheKey, {
        data: results,
        timestamp: Date.now()
      });

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;
      this.metrics.asnQueried += results.results.length;

      this.emit('asn-search-completed', {
        query,
        resultCount: results.results.length,
        total: results.total,
        latency
      });

      return results;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('searchASN', error);
      throw error;
    }
  }

  /**
   * Get ASN details
   * @param {number} asn - ASN number
   * @returns {Promise<Object>} ASN details
   */
  async getASNDetails(asn) {
    const cacheKey = `asn-details:${asn}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.metrics.cachedRequests++;
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    try {
      const startTime = Date.now();
      const data = await this.makeRequest(
        `/autonomous-systems/${asn}`,
        'GET'
      );
      const latency = Date.now() - startTime;

      const details = {
        asn: data.asn,
        name: data.name,
        country: data.country_code,
        registrar: data.registrar,
        ipv4Prefixes: data.ipv4_prefixes || [],
        ipv4Count: data.ipv4_count,
        ipv6Prefixes: data.ipv6_prefixes || [],
        ipv6Count: data.ipv6_count,
        registrationDate: data.registration_date,
        whoisUrl: data.whois_url,
        timestamp: Date.now()
      };

      this.cache.set(cacheKey, {
        data: details,
        timestamp: Date.now()
      });

      this.metrics.totalRequests++;
      this.metrics.successfulRequests++;
      this.metrics.totalLatency += latency;

      this.emit('asn-details-retrieved', {
        asn,
        ipv4Count: details.ipv4Count,
        ipv6Count: details.ipv6Count,
        latency
      });

      return details;
    } catch (error) {
      this.metrics.totalRequests++;
      this.metrics.failedRequests++;
      this.trackError('getASNDetails', error);
      throw error;
    }
  }

  /**
   * Make HTTP request with retry logic and rate limiting
   * @private
   */
  async makeRequest(path, method = 'GET', body = null) {
    if (!this.apiId || !this.apiSecret) {
      throw new Error('Censys API credentials not configured');
    }

    const auth = Buffer.from(`${this.apiId}:${this.apiSecret}`).toString('base64');
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
          const url = new URL(`https://${this.baseUrl}${path}`);
          const options = {
            method,
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
              'User-Agent': 'BassetHoundBrowser/1.0'
            },
            timeout: this.timeout
          };

          const req = https.request(url, options, (res) => {
            let data = '';

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              // Update quota info
              if (res.headers['x-ratelimit-remaining']) {
                this.quotaInfo.remaining = parseInt(
                  res.headers['x-ratelimit-remaining']
                );
              }

              try {
                if (res.statusCode >= 400) {
                  const error = new Error(`Censys API error: ${res.statusCode}`);
                  error.statusCode = res.statusCode;
                  error.response = data;
                  reject(error);
                } else {
                  resolve(JSON.parse(data || '{}'));
                }
              } catch (err) {
                reject(err);
              }
            });
          });

          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Censys API request timeout'));
          });

          if (body) {
            req.write(JSON.stringify(body));
          }

          req.end();
        });
      } catch (error) {
        lastError = error;

        if (error.statusCode === 401) {
          throw new Error('Censys API authentication failed');
        }

        if (attempt < this.retryAttempts - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Censys API request failed');
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
      averageLatency: this.metrics.successfulRequests > 0
        ? Math.round(this.metrics.totalLatency / this.metrics.successfulRequests)
        : 0,
      hostsQueried: this.metrics.hostsQueried,
      certificatesQueried: this.metrics.certificatesQueried,
      asnQueried: this.metrics.asnQueried,
      cacheSize: this.cache.size,
      quotaRemaining: this.quotaInfo.remaining
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
      hostsQueried: 0,
      certificatesQueried: 0,
      asnQueried: 0,
      apiErrors: new Map()
    };
  }
}

module.exports = {
  CensysClient,
  createCensysClient: (options) => new CensysClient(options)
};
