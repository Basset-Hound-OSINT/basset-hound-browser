/**
 * WebSocket Commands for Proxy Partner Management
 * 12+ commands for managing partnership integrations
 *
 * @module websocket/commands/proxy-partner-commands
 */

const { PartnerIntegrationManager } = require('../../src/proxy/partner-integration-manager');
const { PartnerSelector } = require('../../src/proxy/partner-selector');
const { PartnerFailover } = require('../../src/proxy/partner-failover');
const { OxylabsIntegration } = require('../../src/proxy/partners/oxylabs-integration');
const { BrightDataIntegration } = require('../../src/proxy/partners/brightdata-integration');
const { ZyteIntegration } = require('../../src/proxy/partners/zyte-integration');
const { ApifyIntegration } = require('../../src/proxy/partners/apify-integration');
const { LuminatiIntegration } = require('../../src/proxy/partners/luminati-integration');
const { GenericProxyAdapter } = require('../../src/proxy/partners/generic-proxy-adapter');

let partnerManager = null;
let partnerSelector = null;
let partnerFailover = null;
const partnerImplementations = new Map();

/**
 * Initialize proxy partner management system
 */
function initializePartnerManagement(server, mainWindow) {
  if (partnerManager) {
    return;
  }

  partnerManager = new PartnerIntegrationManager();
  partnerSelector = new PartnerSelector(partnerManager);
  partnerFailover = new PartnerFailover(partnerManager, partnerSelector);

  // Initialize partner implementations
  _initializePartnerImplementations();
}

/**
 * Initialize partner-specific implementations
 */
function _initializePartnerImplementations() {
  const partners = [
    {
      id: 'oxylabs',
      impl: OxylabsIntegration
    },
    {
      id: 'brightdata',
      impl: BrightDataIntegration
    },
    {
      id: 'zyte',
      impl: ZyteIntegration
    },
    {
      id: 'apify',
      impl: ApifyIntegration
    },
    {
      id: 'luminati',
      impl: LuminatiIntegration
    }
  ];

  partners.forEach(({ id, impl }) => {
    const partner = new impl(
      partnerManager.partnerAuth,
      partnerManager,
      {}
    );
    partnerImplementations.set(id, partner);
  });

  // Initialize generic adapters for other vendors
  ['smartproxy', 'geonode', 'rainforest', 'iroyal', 'netnut'].forEach(vendorId => {
    const config = partnerManager.getPartner(vendorId);
    if (config) {
      const adapter = GenericProxyAdapter.createAdapter(
        partnerManager.partnerAuth,
        partnerManager,
        vendorId,
        {
          apiEndpoint: config.apiEndpoint,
          proxyHost: 'proxy.' + vendorId + '.com'
        }
      );
      partnerImplementations.set(vendorId, adapter);
    }
  });
}

/**
 * Register proxy partner WebSocket commands
 */
function registerPartnerCommands(server, mainWindow) {
  initializePartnerManagement(server, mainWindow);

  const commandHandlers = server.commandHandlers || server;

  /**
   * List all proxy partners
   *
   * Command: list_proxy_partners
   * Params: { enabledOnly?: boolean, region?: string, feature?: string }
   * Response: { partners: [] }
   */
  commandHandlers.list_proxy_partners = async (params) => {
    try {
      const partners = partnerManager.listPartners(params || {});

      return {
        success: true,
        count: partners.length,
        partners: partners.map(p => ({
          id: p.id,
          name: p.name,
          enabled: p.enabled,
          priority: p.priority,
          regions: p.regions,
          features: p.features,
          concurrentLimit: p.concurrentLimit,
          costPerRequest: p.costPerRequest
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get partner status
   *
   * Command: get_partner_status
   * Params: { partnerId: string }
   * Response: { partnerId, health, metrics }
   */
  commandHandlers.get_partner_status = async (params) => {
    try {
      if (!params.partnerId) {
        throw new Error('partnerId is required');
      }

      const health = partnerManager.getHealthStatus(params.partnerId);
      const metrics = partnerManager.getPartnerMetrics(params.partnerId);
      const partner = partnerManager.getPartner(params.partnerId);

      if (!health || !metrics) {
        throw new Error(`Partner ${params.partnerId} not found`);
      }

      return {
        success: true,
        partnerId: params.partnerId,
        name: partner.name,
        health,
        metrics
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get partner pricing
   *
   * Command: get_partner_pricing
   * Params: { partnerId?: string }
   * Response: { pricing }
   */
  commandHandlers.get_partner_pricing = async (params) => {
    try {
      if (params.partnerId) {
        const impl = partnerImplementations.get(params.partnerId);
        if (!impl) {
          throw new Error(`No implementation for ${params.partnerId}`);
        }

        return {
          success: true,
          pricing: impl.getPricing()
        };
      }

      // Return all pricing
      const pricing = {};
      partnerManager.listPartners({ enabledOnly: true }).forEach(partner => {
        const impl = partnerImplementations.get(partner.id);
        if (impl) {
          pricing[partner.id] = impl.getPricing();
        }
      });

      return {
        success: true,
        pricing
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Configure partner authentication
   *
   * Command: configure_partner
   * Params: { partnerId, credentials, authType }
   * Response: { success, partnerId }
   */
  commandHandlers.configure_partner = async (params) => {
    try {
      if (!params.partnerId || !params.credentials || !params.authType) {
        throw new Error('partnerId, credentials, and authType are required');
      }

      const result = partnerManager.partnerAuth.registerCredentials(
        params.partnerId,
        params.credentials,
        params.authType
      );

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Test partner proxy connection
   *
   * Command: test_partner_proxy
   * Params: { partnerId, country?: string, proxyType?: string }
   * Response: { success, proxy, testResult }
   */
  commandHandlers.test_partner_proxy = async (params) => {
    try {
      if (!params.partnerId) {
        throw new Error('partnerId is required');
      }

      const impl = partnerImplementations.get(params.partnerId);
      if (!impl) {
        throw new Error(`No implementation for ${params.partnerId}`);
      }

      const proxyResult = await impl.getProxy({
        country: params.country,
        proxyType: params.proxyType
      });

      if (!proxyResult.success) {
        throw new Error(proxyResult.error);
      }

      const testResult = await impl.testProxy(proxyResult.proxy.url);

      return {
        success: true,
        partnerId: params.partnerId,
        proxy: proxyResult.proxy,
        testResult
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Set preferred partner
   *
   * Command: set_preferred_partner
   * Params: { partnerId, priority: number }
   * Response: { success, partnerId }
   */
  commandHandlers.set_preferred_partner = async (params) => {
    try {
      if (!params.partnerId) {
        throw new Error('partnerId is required');
      }

      const result = partnerManager.updatePartnerConfig(params.partnerId, {
        priority: params.priority || 1
      });

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Set partner region
   *
   * Command: set_partner_region
   * Params: { partnerId, region }
   * Response: { success }
   */
  commandHandlers.set_partner_region = async (params) => {
    try {
      if (!params.partnerId || !params.region) {
        throw new Error('partnerId and region are required');
      }

      const partner = partnerManager.getPartner(params.partnerId);
      if (!partner) {
        throw new Error(`Partner ${params.partnerId} not found`);
      }

      if (!partner.regions.includes(params.region)) {
        partner.regions.push(params.region);
      }

      return {
        success: true,
        partnerId: params.partnerId,
        regions: partner.regions
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get partner metrics
   *
   * Command: get_partner_metrics
   * Params: { partnerId: string }
   * Response: { metrics }
   */
  commandHandlers.get_partner_metrics = async (params) => {
    try {
      if (!params.partnerId) {
        throw new Error('partnerId is required');
      }

      const metrics = partnerManager.getPartnerMetrics(params.partnerId);
      if (!metrics) {
        throw new Error(`Partner ${params.partnerId} not found`);
      }

      return {
        success: true,
        partnerId: params.partnerId,
        metrics
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Set failover policy
   *
   * Command: failover_policy
   * Params: { partnerId, failoverPartnerIds: string[], threshold?: number }
   * Response: { success }
   */
  commandHandlers.failover_policy = async (params) => {
    try {
      if (!params.partnerId || !Array.isArray(params.failoverPartnerIds)) {
        throw new Error('partnerId and failoverPartnerIds array are required');
      }

      const result = partnerManager.setFailoverChain(
        params.partnerId,
        params.failoverPartnerIds
      );

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Cost optimization mode
   *
   * Command: cost_optimization_mode
   * Params: { mode: 'cheapest' | 'balanced' | 'fastest' }
   * Response: { success, mode }
   */
  commandHandlers.cost_optimization_mode = async (params) => {
    try {
      if (!params.mode || !['cheapest', 'balanced', 'fastest'].includes(params.mode)) {
        throw new Error('mode must be cheapest, balanced, or fastest');
      }

      const modeMap = {
        'cheapest': 'cost',
        'balanced': 'balanced',
        'fastest': 'performance'
      };

      partnerSelector.config.defaultPreference = modeMap[params.mode];

      return {
        success: true,
        mode: params.mode,
        message: `Optimization mode set to ${params.mode}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get partner performance report
   *
   * Command: partner_performance_report
   * Params: { detailed?: boolean }
   * Response: { summary, partners }
   */
  commandHandlers.partner_performance_report = async (params) => {
    try {
      const summary = partnerManager.getSummary();
      const stats = partnerSelector.getSelectionStats();
      const failoverStats = partnerFailover.getFailoverStats();

      return {
        success: true,
        summary,
        selectionStats: stats,
        failoverStats,
        timestamp: Date.now()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Reset partner cache
   *
   * Command: reset_partner_cache
   * Params: { partnerId?: string }
   * Response: { success }
   */
  commandHandlers.reset_partner_cache = async (params) => {
    try {
      partnerSelector.clearCache();
      partnerManager.partnerAuth.clearTokenCache(params.partnerId);

      return {
        success: true,
        message: 'Partner caches cleared'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Select best partner for request
   *
   * Command: select_best_partner
   * Params: { region?: string, proxyType?: string, preference?: string }
   * Response: { partnerId, partner, score, ranking }
   */
  commandHandlers.select_best_partner = async (params) => {
    try {
      const selection = partnerSelector.selectPartner(params || {});
      return selection;
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get available countries for partner
   *
   * Command: get_partner_countries
   * Params: { partnerId: string }
   * Response: { countries }
   */
  commandHandlers.get_partner_countries = async (params) => {
    try {
      if (!params.partnerId) {
        throw new Error('partnerId is required');
      }

      const impl = partnerImplementations.get(params.partnerId);
      if (!impl || !impl.getAvailableCountries) {
        throw new Error(`No country list available for ${params.partnerId}`);
      }

      return {
        success: true,
        ...impl.getAvailableCountries()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

module.exports = {
  registerPartnerCommands,
  initializePartnerManagement
};
