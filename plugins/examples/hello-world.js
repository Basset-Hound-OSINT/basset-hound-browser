/**
 * Hello World Plugin for Basset Hound Browser
 *
 * This example plugin demonstrates the basic structure and capabilities
 * of plugins in Basset Hound Browser. It shows how to:
 *
 * - Define plugin metadata (name, version, description)
 * - Initialize and cleanup the plugin
 * - Register commands that can be called via WebSocket
 * - Hook into browser events
 * - Use the plugin API for browser interaction
 * - Store and retrieve plugin-specific data
 *
 * Usage:
 *   1. Load this plugin via the load_plugin WebSocket command
 *   2. Call the registered commands (hello, greet, get_stats)
 *   3. The plugin will log page navigation events
 */

// Plugin metadata (required)
const name = 'hello-world';
const version = '1.0.0';
const description = 'A simple example plugin demonstrating the plugin architecture';
const author = 'Basset Hound Browser Team';

// Optional: List of dependencies (other plugins that must be loaded first)
const dependencies = [];

// Optional: Required permissions for this plugin
const permissions = {
  navigation: 1,  // Read permission for navigation
  content: 1,     // Read permission for content
  storage: 2,     // Write permission for storage
  events: 2       // Write permission for events
};

// Optional: Default configuration
const defaultConfig = {
  greeting: 'Hello from Basset Hound!',
  logNavigation: true,
  trackPageViews: true
};

// Plugin state (private)
let api = null;
let pageViewCount = 0;
let isEnabled = false;

/**
 * Initialize the plugin
 * Called when the plugin is first loaded
 *
 * @param {Object} pluginApi - The Plugin API instance
 * @returns {Promise<void>}
 */
async function init(pluginApi) {
  api = pluginApi;

  api.log.info('Initializing hello-world plugin');

  // Register commands that can be called via WebSocket
  registerCommands();

  // Register event hooks
  registerHooks();

  isEnabled = true;

  api.log.info('Hello-world plugin initialized successfully!');
}

/**
 * Register plugin commands
 * Commands can be called via WebSocket using plugin:hello-world:commandName
 */
function registerCommands() {
  // Simple hello command
  api.commands.register('hello', async (params) => {
    const message = params.message || defaultConfig.greeting;
    api.log.info(`Hello command called with message: ${message}`);

    return {
      message: message,
      timestamp: new Date().toISOString(),
      pluginVersion: version
    };
  });

  // Greet command with personalization
  api.commands.register('greet', async (params) => {
    const name = params.name || 'World';
    const greeting = `Hello, ${name}! Welcome to Basset Hound Browser.`;

    api.log.info(`Greeting: ${greeting}`);

    return {
      greeting: greeting,
      timestamp: new Date().toISOString()
    };
  });

  // Get plugin statistics
  api.commands.register('get_stats', async (params) => {
    return {
      pageViewCount: pageViewCount,
      isEnabled: isEnabled,
      version: version,
      uptime: process.uptime ? process.uptime() : 'N/A'
    };
  });

  // Get current page info
  api.commands.register('page_info', async (params) => {
    const urlResult = await api.browser.getUrl();
    const titleResult = await api.browser.getTitle();

    return {
      url: urlResult.url || 'unknown',
      title: titleResult.title || 'unknown',
      pageViews: pageViewCount
    };
  });

  // Store a value
  api.commands.register('store', async (params) => {
    const { key, value } = params;

    if (!key) {
      return { error: 'Key is required' };
    }

    await api.storage.set(key, value);
    api.log.info(`Stored value for key: ${key}`);

    return { stored: true, key };
  });

  // Retrieve a value
  api.commands.register('retrieve', async (params) => {
    const { key } = params;

    if (!key) {
      return { error: 'Key is required' };
    }

    const result = await api.storage.get(key);

    return {
      key,
      value: result.value,
      found: result.value !== undefined
    };
  });

  api.log.info('Commands registered: hello, greet, get_stats, page_info, store, retrieve');
}

/**
 * Register event hooks
 * Hooks allow the plugin to respond to browser events
 */
function registerHooks() {
  // Hook into page load events
  api.events.on('page:load', async (data) => {
    if (defaultConfig.trackPageViews) {
      pageViewCount++;
    }

    if (defaultConfig.logNavigation) {
      api.log.info(`Page loaded: ${data.url || 'unknown'}`);
    }
  });

  // Hook into navigation events
  api.events.on('page:navigate', async (data) => {
    if (defaultConfig.logNavigation) {
      api.log.info(`Navigating to: ${data.url || 'unknown'}`);
    }
  });

  // Hook into tab events
  api.events.on('tab:created', async (data) => {
    api.log.info(`New tab created: ${data.tabId || 'unknown'}`);
  });

  api.log.info('Event hooks registered');
}

/**
 * Called when the plugin is enabled
 */
function onEnable() {
  isEnabled = true;
  api.log.info('Hello-world plugin enabled');
}

/**
 * Called when the plugin is disabled
 */
function onDisable() {
  isEnabled = false;
  api.log.info('Hello-world plugin disabled');
}

/**
 * Called when plugin configuration changes
 * @param {Object} newConfig - The new configuration
 */
function onConfigChange(newConfig) {
  Object.assign(defaultConfig, newConfig);
  api.log.info('Configuration updated:', newConfig);
}

/**
 * Cleanup function called when plugin is unloaded
 * Use this to clean up any resources, timers, etc.
 */
async function cleanup() {
  api.log.info('Cleaning up hello-world plugin');

  // Unregister commands
  api.commands.unregister('hello');
  api.commands.unregister('greet');
  api.commands.unregister('get_stats');
  api.commands.unregister('page_info');
  api.commands.unregister('store');
  api.commands.unregister('retrieve');

  // Clear storage
  await api.storage.clear();

  isEnabled = false;
  api = null;

  console.log('[hello-world] Plugin cleaned up');
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
