/**
 * Shodan Export Integration
 * Export findings to Shodan format
 */

const { PlatformIntegration } = require('../platform-integrations-framework');

class ShodanExport extends PlatformIntegration {
  constructor(config = {}) {
    super('shodan', {
      apiUrl: 'https://api.shodan.io',
      ...config
    });
  }

  /**
   * Export data to Shodan
   * @param {object} data - Session data to export
   * @param {object} options - Export options
   */
  async export(data, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('Shodan API key required. Authenticate first.');
      }

      const {
        tags = [],
        confidence = 1.0,
        saveQuery = false
      } = options;

      // Extract relevant data for Shodan
      const shodanData = {
        type: 'osint_findings',
        timestamp: this.formatTimestamp(),
        source: 'Basset Hound Browser',
        findings: []
      };

      // Add host information
      if (data.networkData?.ip) {
        shodanData.findings.push({
          type: 'host',
          ip: data.networkData.ip,
          port: data.networkData.port || 443,
          hostname: data.networkData.hostname || data.domain,
          tags: ['basset-hound', ...tags],
          confidence: this.formatConfidence(confidence)
        });
      }

      // Add service information
      if (data.technologies && Array.isArray(data.technologies)) {
        const services = data.technologies.map(tech => ({
          name: tech.name,
          category: tech.category,
          version: tech.version || null,
          confidence: this.formatConfidence(tech.confidence)
        }));

        shodanData.findings.push({
          type: 'technologies',
          services,
          count: services.length
        });
      }

      // Add domain information
      if (data.domain) {
        shodanData.findings.push({
          type: 'domain',
          value: data.domain,
          confidence: this.formatConfidence(1.0)
        });
      }

      // Add URL information
      if (data.url) {
        shodanData.findings.push({
          type: 'url',
          value: data.url,
          confidence: this.formatConfidence(1.0)
        });
      }

      // Build search query if requested
      if (saveQuery && data.networkData?.ip) {
        shodanData.query = this._buildShodanQuery(data);
      }

      // Track the export
      this._trackExport(shodanData);

      // Send webhook notification if configured
      if (this.webhookUrl) {
        await this.sendWebhookNotification({
          event: 'export.shodan',
          platform: 'shodan',
          itemCount: shodanData.findings.length,
          timestamp: shodanData.timestamp
        });
      }

      return {
        success: true,
        platform: 'shodan',
        format: 'json',
        data: shodanData,
        itemCount: shodanData.findings.length,
        timestamp: shodanData.timestamp
      };
    } catch (error) {
      return {
        success: false,
        platform: 'shodan',
        error: error.message
      };
    }
  }

  /**
   * Build Shodan search query from data
   * @private
   */
  _buildShodanQuery(data) {
    const queryParts = [];

    // IP query
    if (data.networkData?.ip) {
      queryParts.push(`ip:${data.networkData.ip}`);
    }

    // Hostname query
    if (data.networkData?.hostname) {
      queryParts.push(`hostname:${data.networkData.hostname}`);
    }

    // Port query
    if (data.networkData?.port) {
      queryParts.push(`port:${data.networkData.port}`);
    }

    // Technology query
    if (data.technologies && data.technologies.length > 0) {
      const techs = data.technologies.slice(0, 3).map(t => `"${t.name}"`).join(' ');
      if (techs) {
        queryParts.push(`${techs}`);
      }
    }

    return queryParts.join(' ');
  }

  /**
   * Generate Shodan JSON export format
   */
  static formatAsJSON(data, options = {}) {
    return {
      format: 'shodan-json',
      exportedAt: new Date().toISOString(),
      source: 'Basset Hound Browser',
      data: {
        ip: data.networkData?.ip || null,
        hostname: data.networkData?.hostname || data.domain || null,
        port: data.networkData?.port || 443,
        services: data.technologies || [],
        url: data.url || null,
        metadata: data.metadata || {},
        tags: options.tags || ['basset-hound']
      }
    };
  }

  /**
   * Generate Shodan CSV export format
   */
  static formatAsCSV(data, options = {}) {
    const rows = ['IP,Hostname,Port,Service,Version,Confidence'];

    if (data.networkData?.ip) {
      if (data.technologies && data.technologies.length > 0) {
        data.technologies.forEach(tech => {
          rows.push(`${data.networkData.ip},"${data.networkData.hostname || data.domain}",${data.networkData.port || 443},"${tech.name}","${tech.version || 'N/A'}",${Math.round(tech.confidence * 100)}`);
        });
      } else {
        rows.push(`${data.networkData.ip},"${data.networkData.hostname || data.domain}",${data.networkData.port || 443},"Unknown","Unknown",0`);
      }
    }

    return rows.join('\n');
  }
}

module.exports = ShodanExport;
