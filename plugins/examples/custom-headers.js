/**
 * Custom Headers Plugin for Basset Hound Browser
 *
 * This example plugin demonstrates how to create a header modification plugin
 * that can intercept and modify HTTP request/response headers. It shows:
 *
 * - Network interception capabilities
 * - Header manipulation API usage
 * - URL pattern-based rules
 * - Conditional header modification
 *
 * Use cases:
 *   - Adding custom headers for authentication
 *   - Modifying User-Agent for specific sites
 *   - Adding/removing tracking headers
 *   - CORS handling
 *   - Privacy protection
 *
 * Usage:
 *   1. Load this plugin via the load_plugin WebSocket command
 *   2. Configure header rules using the add_rule command
 *   3. Enable/disable rules dynamically
 */

// Plugin metadata
const name = 'custom-headers';
const version = '1.0.0';
const description = 'Modify HTTP headers for requests and responses based on URL patterns';
const author = 'Basset Hound Browser Team';

// Dependencies
const dependencies = [];

// Required permissions
const permissions = {
  network: 2,    // Write permission for network/headers
  storage: 2,    // Write permission for storing rules
  events: 1      // Read permission for events
};

// Default configuration
const defaultConfig = {
  enabled: true,
  logModifications: false,
  presets: {
    // Preset header configurations
    'privacy-enhanced': {
      removeHeaders: ['X-Forwarded-For', 'X-Real-IP', 'Via'],
      addHeaders: { 'DNT': '1' }
    },
    'no-cache': {
      addHeaders: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    },
    'json-api': {
      addHeaders: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }
  }
};

// Plugin state
let api = null;
let isEnabled = false;

// Header rules storage
const headerRules = {
  request: [],   // Rules for request headers
  response: []   // Rules for response headers
};

// Statistics
const stats = {
  requestsModified: 0,
  responsesModified: 0,
  headersAdded: 0,
  headersRemoved: 0
};

/**
 * Initialize the plugin
 * @param {Object} pluginApi - The Plugin API instance
 */
async function init(pluginApi) {
  api = pluginApi;

  api.log.info('Initializing custom-headers plugin');

  // Register commands
  registerCommands();

  // Register event hooks
  registerHooks();

  // Load saved rules from storage
  await loadRules();

  isEnabled = true;

  api.log.info('Custom-headers plugin initialized');
}

/**
 * Register plugin commands
 */
function registerCommands() {
  // Add a header rule
  api.commands.register('add_rule', async (params) => {
    const {
      type = 'request',     // 'request' or 'response'
      pattern = '*',        // URL pattern (supports wildcards)
      action = 'set',       // 'set', 'remove', or 'append'
      headerName,           // Header name
      headerValue,          // Header value (optional for 'remove')
      priority = 0,         // Higher priority rules are applied first
      description = ''      // Optional description
    } = params;

    if (!headerName) {
      return { error: 'headerName is required' };
    }

    if (action !== 'remove' && !headerValue) {
      return { error: 'headerValue is required for set/append actions' };
    }

    const rule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type,
      pattern,
      action,
      headerName,
      headerValue,
      priority,
      description,
      enabled: true,
      createdAt: new Date().toISOString()
    };

    // Add to appropriate rules array
    if (type === 'request') {
      headerRules.request.push(rule);
      headerRules.request.sort((a, b) => b.priority - a.priority);
    } else {
      headerRules.response.push(rule);
      headerRules.response.sort((a, b) => b.priority - a.priority);
    }

    // Apply the rule via header manager
    await applyRule(rule);

    // Save rules
    await saveRules();

    api.log.info(`Added ${type} header rule: ${action} ${headerName}`);

    return { success: true, rule };
  });

  // Remove a header rule
  api.commands.register('remove_rule', async (params) => {
    const { ruleId } = params;

    if (!ruleId) {
      return { error: 'ruleId is required' };
    }

    let removed = false;

    // Search in request rules
    const reqIndex = headerRules.request.findIndex(r => r.id === ruleId);
    if (reqIndex >= 0) {
      const rule = headerRules.request[reqIndex];
      headerRules.request.splice(reqIndex, 1);
      await unapplyRule(rule);
      removed = true;
    }

    // Search in response rules
    const respIndex = headerRules.response.findIndex(r => r.id === ruleId);
    if (respIndex >= 0) {
      const rule = headerRules.response[respIndex];
      headerRules.response.splice(respIndex, 1);
      await unapplyRule(rule);
      removed = true;
    }

    if (!removed) {
      return { error: 'Rule not found' };
    }

    await saveRules();

    api.log.info(`Removed header rule: ${ruleId}`);

    return { success: true, ruleId };
  });

  // Enable/disable a rule
  api.commands.register('toggle_rule', async (params) => {
    const { ruleId, enabled } = params;

    if (!ruleId) {
      return { error: 'ruleId is required' };
    }

    let rule = headerRules.request.find(r => r.id === ruleId);
    if (!rule) {
      rule = headerRules.response.find(r => r.id === ruleId);
    }

    if (!rule) {
      return { error: 'Rule not found' };
    }

    const newEnabled = enabled !== undefined ? enabled : !rule.enabled;
    rule.enabled = newEnabled;

    if (newEnabled) {
      await applyRule(rule);
    } else {
      await unapplyRule(rule);
    }

    await saveRules();

    api.log.info(`Rule ${ruleId} ${newEnabled ? 'enabled' : 'disabled'}`);

    return { success: true, ruleId, enabled: newEnabled };
  });

  // List all rules
  api.commands.register('list_rules', async (params) => {
    const { type } = params;

    let rules = [];

    if (!type || type === 'request') {
      rules = rules.concat(headerRules.request.map(r => ({ ...r, type: 'request' })));
    }

    if (!type || type === 'response') {
      rules = rules.concat(headerRules.response.map(r => ({ ...r, type: 'response' })));
    }

    return {
      success: true,
      count: rules.length,
      rules
    };
  });

  // Apply a preset
  api.commands.register('apply_preset', async (params) => {
    const { preset, pattern = '*' } = params;

    if (!preset) {
      return { error: 'preset name is required' };
    }

    const presetConfig = defaultConfig.presets[preset];
    if (!presetConfig) {
      return { error: `Unknown preset: ${preset}. Available: ${Object.keys(defaultConfig.presets).join(', ')}` };
    }

    const addedRules = [];

    // Add headers from preset
    if (presetConfig.addHeaders) {
      for (const [headerName, headerValue] of Object.entries(presetConfig.addHeaders)) {
        const result = await api.commands.register('add_rule', {
          type: 'request',
          pattern,
          action: 'set',
          headerName,
          headerValue,
          description: `Preset: ${preset}`
        });

        if (result.success) {
          addedRules.push(result.rule);
        }
      }
    }

    // Remove headers from preset
    if (presetConfig.removeHeaders) {
      for (const headerName of presetConfig.removeHeaders) {
        const result = await api.commands.register('add_rule', {
          type: 'request',
          pattern,
          action: 'remove',
          headerName,
          description: `Preset: ${preset}`
        });

        if (result.success) {
          addedRules.push(result.rule);
        }
      }
    }

    api.log.info(`Applied preset: ${preset} with ${addedRules.length} rules`);

    return {
      success: true,
      preset,
      rulesAdded: addedRules.length,
      rules: addedRules
    };
  });

  // Get available presets
  api.commands.register('list_presets', async (params) => {
    const presets = Object.keys(defaultConfig.presets).map(name => ({
      name,
      ...defaultConfig.presets[name]
    }));

    return {
      success: true,
      presets
    };
  });

  // Clear all rules
  api.commands.register('clear_rules', async (params) => {
    const { type } = params;

    let clearedCount = 0;

    if (!type || type === 'request') {
      for (const rule of headerRules.request) {
        await unapplyRule(rule);
      }
      clearedCount += headerRules.request.length;
      headerRules.request = [];
    }

    if (!type || type === 'response') {
      for (const rule of headerRules.response) {
        await unapplyRule(rule);
      }
      clearedCount += headerRules.response.length;
      headerRules.response = [];
    }

    await saveRules();

    api.log.info(`Cleared ${clearedCount} header rules`);

    return {
      success: true,
      cleared: clearedCount
    };
  });

  // Get statistics
  api.commands.register('get_stats', async (params) => {
    return {
      success: true,
      stats: { ...stats },
      ruleCount: {
        request: headerRules.request.length,
        response: headerRules.response.length,
        total: headerRules.request.length + headerRules.response.length
      }
    };
  });

  // Set a single header (shortcut)
  api.commands.register('set_header', async (params) => {
    const { name: headerName, value: headerValue, pattern = '*', type = 'request' } = params;

    if (!headerName || !headerValue) {
      return { error: 'name and value are required' };
    }

    // Use the network API directly
    const result = await api.network.setRequestHeader(headerName, headerValue);

    if (result.success) {
      stats.headersAdded++;
      api.log.info(`Set ${type} header: ${headerName}`);
    }

    return result;
  });

  // Remove a single header (shortcut)
  api.commands.register('remove_header', async (params) => {
    const { name: headerName, type = 'request' } = params;

    if (!headerName) {
      return { error: 'name is required' };
    }

    const result = await api.network.removeRequestHeader(headerName);

    if (result.success) {
      stats.headersRemoved++;
      api.log.info(`Removed ${type} header: ${headerName}`);
    }

    return result;
  });

  // Get current headers
  api.commands.register('get_headers', async (params) => {
    return await api.network.getHeaders();
  });

  api.log.info('Commands registered');
}

/**
 * Register event hooks
 */
function registerHooks() {
  // Monitor request events if logging is enabled
  api.events.on('request:beforeSend', async (data) => {
    if (defaultConfig.logModifications) {
      api.log.debug(`Request to: ${data.url}`);
    }
  });

  api.events.on('response:received', async (data) => {
    if (defaultConfig.logModifications) {
      api.log.debug(`Response from: ${data.url}`);
    }
  });
}

/**
 * Apply a header rule using the header manager
 * @param {Object} rule - Header rule to apply
 */
async function applyRule(rule) {
  if (!rule.enabled) return;

  try {
    if (rule.type === 'request') {
      if (rule.action === 'set' || rule.action === 'append') {
        await api.network.setRequestHeader(rule.headerName, rule.headerValue);
        stats.headersAdded++;
      } else if (rule.action === 'remove') {
        await api.network.removeRequestHeader(rule.headerName);
        stats.headersRemoved++;
      }
    }
    // Note: Response header modification would be similar but using response header methods

    stats.requestsModified++;
  } catch (error) {
    api.log.error(`Failed to apply rule ${rule.id}: ${error.message}`);
  }
}

/**
 * Unapply a header rule
 * @param {Object} rule - Header rule to unapply
 */
async function unapplyRule(rule) {
  try {
    if (rule.type === 'request' && (rule.action === 'set' || rule.action === 'append')) {
      // Remove the header that was added
      await api.network.removeRequestHeader(rule.headerName);
    }
    // For 'remove' actions, we can't easily restore the original header
  } catch (error) {
    api.log.error(`Failed to unapply rule ${rule.id}: ${error.message}`);
  }
}

/**
 * Save rules to plugin storage
 */
async function saveRules() {
  await api.storage.set('headerRules', headerRules);
}

/**
 * Load rules from plugin storage
 */
async function loadRules() {
  const result = await api.storage.get('headerRules');

  if (result.value) {
    headerRules.request = result.value.request || [];
    headerRules.response = result.value.response || [];

    // Apply all enabled rules
    for (const rule of [...headerRules.request, ...headerRules.response]) {
      if (rule.enabled) {
        await applyRule(rule);
      }
    }

    api.log.info(`Loaded ${headerRules.request.length + headerRules.response.length} saved rules`);
  }
}

/**
 * Called when plugin is enabled
 */
function onEnable() {
  isEnabled = true;

  // Re-apply all enabled rules
  for (const rule of [...headerRules.request, ...headerRules.response]) {
    if (rule.enabled) {
      applyRule(rule);
    }
  }

  api.log.info('Custom-headers plugin enabled');
}

/**
 * Called when plugin is disabled
 */
function onDisable() {
  isEnabled = false;

  // Unapply all rules
  for (const rule of [...headerRules.request, ...headerRules.response]) {
    unapplyRule(rule);
  }

  api.log.info('Custom-headers plugin disabled');
}

/**
 * Called when configuration changes
 * @param {Object} newConfig - New configuration
 */
function onConfigChange(newConfig) {
  Object.assign(defaultConfig, newConfig);
  api.log.info('Configuration updated');
}

/**
 * Cleanup function
 */
async function cleanup() {
  api.log.info('Cleaning up custom-headers plugin');

  // Save rules before cleanup
  await saveRules();

  // Unapply all rules
  for (const rule of [...headerRules.request, ...headerRules.response]) {
    await unapplyRule(rule);
  }

  // Unregister commands
  const commands = [
    'add_rule', 'remove_rule', 'toggle_rule', 'list_rules',
    'apply_preset', 'list_presets', 'clear_rules', 'get_stats',
    'set_header', 'remove_header', 'get_headers'
  ];

  for (const cmd of commands) {
    api.commands.unregister(cmd);
  }

  isEnabled = false;
  api = null;

  console.log('[custom-headers] Plugin cleaned up');
}

// Export plugin interface
module.exports = {
  // Required metadata
  name,
  version,
  description,
  author,

  // Optional metadata
  dependencies,
  permissions,
  defaultConfig,

  // Lifecycle functions
  init,
  cleanup,
  onEnable,
  onDisable,
  onConfigChange
};
