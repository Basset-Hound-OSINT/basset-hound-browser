/**
 * Censys Export Integration
 * Export findings in Censys-compatible formats
 */

const { PlatformIntegration } = require('../platform-integrations-framework');

class CensysExport extends PlatformIntegration {
  constructor(config = {}) {
    super('censys', {
      apiUrl: 'https://api.censys.io/v1',
      ...config
    });
  }

  /**
   * Export data to Censys format
   * @param {object} data - Session data to export
   * @param {object} options - Export options
   */
  async export(data, options = {}) {
    try {
      const { format = 'json' } = options;

      let result;
      if (format === 'csv') {
        result = this._exportAsCSV(data, options);
      } else {
        result = this._exportAsJSON(data, options);
      }

      // Track export
      this._trackExport(result);

      // Send webhook if configured
      if (this.webhookUrl) {
        await this.sendWebhookNotification({
          event: 'export.censys',
          platform: 'censys',
          format,
          recordCount: result.recordCount,
          timestamp: result.timestamp
        });
      }

      return {
        success: true,
        platform: 'censys',
        format,
        data: result,
        recordCount: result.recordCount,
        timestamp: result.timestamp
      };
    } catch (error) {
      return {
        success: false,
        platform: 'censys',
        error: error.message
      };
    }
  }

  /**
   * Export as JSON format (Censys research format)
   * @private
   */
  _exportAsJSON(data, options = {}) {
    const records = [];

    // Create IP record
    if (data.networkData?.ip) {
      records.push({
        type: 'ipv4',
        ip: data.networkData.ip,
        hostname: data.networkData.hostname || data.domain,
        port: data.networkData.port || 443,
        protocol: data.networkData.protocol || 'https',
        timestamp: this.formatTimestamp(),
        metadata: {
          source: 'Basset Hound Browser',
          confidence: this.formatConfidence(options.confidence || 1.0)
        },
        services: this._extractServices(data),
        certificates: this._extractCertificates(data),
        http_headers: this._extractHeaders(data),
        protocols: data.protocols || ['https']
      });
    }

    // Create domain record
    if (data.domain) {
      records.push({
        type: 'domain',
        domain: data.domain,
        timestamp: this.formatTimestamp(),
        metadata: {
          source: 'Basset Hound Browser',
          confidence: 100
        },
        dns_records: this._extractDNSRecords(data),
        websites: data.url ? [data.url] : []
      });
    }

    // Create certificate record if available
    if (data.certificates && Array.isArray(data.certificates)) {
      data.certificates.forEach(cert => {
        records.push({
          type: 'certificate',
          fingerprint: cert.fingerprint,
          subject: cert.subject,
          issuer: cert.issuer,
          validFrom: cert.validFrom,
          validTo: cert.validTo,
          timestamp: this.formatTimestamp(),
          metadata: {
            source: 'Basset Hound Browser'
          }
        });
      });
    }

    return {
      format: 'censys-json',
      records,
      recordCount: records.length,
      timestamp: this.formatTimestamp()
    };
  }

  /**
   * Export as CSV format
   * @private
   */
  _exportAsCSV(data, options = {}) {
    const rows = [];

    // Header for IP/Host records
    if (data.networkData?.ip) {
      rows.push('Type,Value,Port,Protocol,Service,Version,Timestamp');

      const addRecord = (type, value, port = '', protocol = '', service = '', version = '') => {
        rows.push(`${type},"${value}","${port}","${protocol}","${service}","${version}","${this.formatTimestamp()}"`);
      };

      if (data.technologies && data.technologies.length > 0) {
        data.technologies.forEach(tech => {
          addRecord(
            'Host',
            data.networkData.ip,
            data.networkData.port || 443,
            data.networkData.protocol || 'https',
            tech.name,
            tech.version || 'unknown'
          );
        });
      } else {
        addRecord(
          'Host',
          data.networkData.ip,
          data.networkData.port || 443,
          data.networkData.protocol || 'https',
          'Unknown',
          'Unknown'
        );
      }

      // Domain record
      if (data.domain) {
        addRecord('Domain', data.domain, '', '', '', '');
      }
    }

    return rows.join('\n');
  }

  /**
   * Extract services from session data
   * @private
   */
  _extractServices(data) {
    if (!data.technologies) {
      return [];
    }

    return data.technologies.map(tech => ({
      name: tech.name,
      category: tech.category,
      version: tech.version || null,
      confidence: this.formatConfidence(tech.confidence)
    }));
  }

  /**
   * Extract certificates from session data
   * @private
   */
  _extractCertificates(data) {
    if (!data.certificates || !Array.isArray(data.certificates)) {
      return [];
    }

    return data.certificates.map(cert => ({
      fingerprint: cert.fingerprint || cert.sha256 || null,
      subject: cert.subject || null,
      issuer: cert.issuer || null,
      validFrom: cert.validFrom || null,
      validTo: cert.validTo || null
    }));
  }

  /**
   * Extract DNS records from session data
   * @private
   */
  _extractDNSRecords(data) {
    const records = [];

    if (data.networkData?.ip) {
      records.push({
        type: 'A',
        value: data.networkData.ip
      });
    }

    if (data.domain && data.networkData?.ip) {
      records.push({
        type: 'A',
        name: data.domain,
        value: data.networkData.ip
      });
    }

    if (data.networkData?.mxRecords && Array.isArray(data.networkData.mxRecords)) {
      data.networkData.mxRecords.forEach(mx => {
        records.push({
          type: 'MX',
          value: mx
        });
      });
    }

    if (data.networkData?.nameServers && Array.isArray(data.networkData.nameServers)) {
      data.networkData.nameServers.forEach(ns => {
        records.push({
          type: 'NS',
          value: ns
        });
      });
    }

    return records;
  }

  /**
   * Extract headers from session data
   * @private
   */
  _extractHeaders(data) {
    const headers = {};

    if (data.headers) {
      // Copy relevant headers
      const relevantHeaders = ['server', 'x-powered-by', 'x-aspnet-version', 'x-frame-options', 'content-type'];
      relevantHeaders.forEach(header => {
        if (data.headers[header]) {
          headers[header] = data.headers[header];
        }
      });
    }

    return Object.keys(headers).length > 0 ? headers : null;
  }

  /**
   * Query Censys for IP information (mock)
   */
  async queryIPInfo(ip) {
    if (!this.apiKey) {
      throw new Error('Censys API key required');
    }

    return {
      ip,
      autonomous_system: {
        asn: null,
        name: null,
        routed_prefix: null
      },
      location: {
        city: null,
        country: null,
        latitude: null,
        longitude: null,
        timezone: null
      },
      services: []
    };
  }

  /**
   * Format as Censys API request body
   */
  static formatForAPI(data, options = {}) {
    return {
      dataset: 'ipv4',
      query: data.networkData?.ip || null,
      fields: [
        'ip',
        'protocols',
        'services',
        'autonomous_system',
        'location'
      ],
      ...options
    };
  }
}

module.exports = CensysExport;
