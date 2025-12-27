/**
 * Basset Hound Browser - Tab Manager
 * Manages multiple browser tabs within a session
 */

const { EventEmitter } = require('events');

// Import logger (lazy initialization to avoid circular dependencies)
let logger = null;
function getLogger() {
  if (!logger) {
    try {
      const { defaultLogger } = require('../logging');
      logger = defaultLogger.child('tabs');
    } catch (e) {
      // Fallback to console if logging not available
      logger = {
        info: (...args) => console.log('[TabManager]', ...args),
        debug: (...args) => console.log('[TabManager]', ...args),
        warn: (...args) => console.warn('[TabManager]', ...args),
        error: (...args) => console.error('[TabManager]', ...args)
      };
    }
  }
  return logger;
}

/**
 * Generate a unique tab ID
 * @returns {string} Unique tab identifier
 */
function generateTabId() {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Tab Class - Represents an individual browser tab
 * Encapsulates tab state and provides methods for tab manipulation
 */
class Tab {
  /**
   * Create a new Tab instance
   * @param {Object} options - Tab configuration options
   * @param {string} [options.id] - Unique tab identifier (auto-generated if not provided)
   * @param {string} [options.url] - Initial URL for the tab
   * @param {string} [options.title] - Tab title
   * @param {string} [options.sessionId] - Session this tab belongs to
   * @param {Object} [options.webContents] - Electron webContents reference
   * @param {boolean} [options.active] - Whether this tab is active
   */
  constructor(options = {}) {
    this.id = options.id || generateTabId();
    this.url = options.url || 'about:blank';
    this.title = options.title || 'New Tab';
    this.sessionId = options.sessionId || 'default';
    this.webContents = options.webContents || null;
    this.active = options.active || false;

    // Tab metadata
    this.createdAt = new Date().toISOString();
    this.lastAccessed = new Date().toISOString();
    this.loading = true;
    this.favicon = null;

    // Navigation state
    this.canGoBack = false;
    this.canGoForward = false;
    this.history = [];
    this.historyIndex = -1;

    // Tab properties
    this.zoomLevel = 1.0;
    this.muted = false;
    this.pinned = false;
  }

  /**
   * Get a serializable representation of the tab
   * @returns {Object} Tab data object
   */
  toJSON() {
    return {
      id: this.id,
      url: this.url,
      title: this.title,
      sessionId: this.sessionId,
      active: this.active,
      createdAt: this.createdAt,
      lastAccessed: this.lastAccessed,
      loading: this.loading,
      favicon: this.favicon,
      canGoBack: this.canGoBack,
      canGoForward: this.canGoForward,
      zoomLevel: this.zoomLevel,
      muted: this.muted,
      pinned: this.pinned
    };
  }

  /**
   * Update tab properties
   * @param {Object} updates - Properties to update
   */
  update(updates) {
    const allowedFields = [
      'url', 'title', 'loading', 'favicon', 'canGoBack',
      'canGoForward', 'zoomLevel', 'muted', 'pinned', 'active', 'webContents'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        this[field] = updates[field];
      }
    }

    this.lastAccessed = new Date().toISOString();
  }

  /**
   * Add URL to navigation history
   * @param {string} url - URL to add
   */
  addToHistory(url) {
    if (url === this.url) return;

    // Truncate forward history if navigating from middle
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(url);
    this.historyIndex = this.history.length - 1;

    // Limit history size
    if (this.history.length > 100) {
      this.history.shift();
      this.historyIndex--;
    }

    this.url = url;
    this.canGoBack = this.historyIndex > 0;
    this.canGoForward = false;
  }

  /**
   * Navigate back in history
   * @returns {string|null} Previous URL or null if cannot go back
   */
  goBack() {
    if (this.historyIndex <= 0) return null;

    this.historyIndex--;
    this.url = this.history[this.historyIndex];
    this.canGoBack = this.historyIndex > 0;
    this.canGoForward = true;
    this.loading = true;

    return this.url;
  }

  /**
   * Navigate forward in history
   * @returns {string|null} Next URL or null if cannot go forward
   */
  goForward() {
    if (this.historyIndex >= this.history.length - 1) return null;

    this.historyIndex++;
    this.url = this.history[this.historyIndex];
    this.canGoBack = true;
    this.canGoForward = this.historyIndex < this.history.length - 1;
    this.loading = true;

    return this.url;
  }
}

/**
 * Tab Manager Class
 * Handles creation, switching, and management of browser tabs
 * Extends EventEmitter to provide tab-created, tab-closed, tab-switched, tab-updated events
 */
class TabManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // Tab storage: Map of tabId to Tab instance
    this.tabs = new Map();

    // Currently active tab ID
    this.activeTabId = null;

    // Tab order (for maintaining display order)
    this.tabOrder = [];

    // Event callbacks (legacy support)
    this.onTabCreated = options.onTabCreated || (() => {});
    this.onTabClosed = options.onTabClosed || (() => {});
    this.onTabSwitched = options.onTabSwitched || (() => {});
    this.onTabUpdated = options.onTabUpdated || (() => {});

    // Maximum number of tabs allowed
    this.maxTabs = options.maxTabs || 50;

    // Default home page
    this.homePage = options.homePage || 'https://www.google.com';

    getLogger().info('TabManager initialized', { maxTabs: this.maxTabs });
  }

  /**
   * Create a new tab
   * @param {Object} options - Tab options
   * @param {string} [options.url] - Initial URL for the tab
   * @param {string} [options.title] - Tab title
   * @param {string} [options.sessionId] - Session this tab belongs to
   * @param {Object} [options.webContents] - Electron webContents reference
   * @param {boolean} [options.active=true] - Whether to activate the tab immediately
   * @returns {Object} Created tab info
   */
  createTab(options = {}) {
    const { url, title, sessionId, webContents, active = true } = options;

    // Check if max tabs reached
    if (this.tabs.size >= this.maxTabs) {
      return { success: false, error: `Maximum number of tabs (${this.maxTabs}) reached` };
    }

    const initialUrl = url || this.homePage;

    // Create Tab instance
    const tab = new Tab({
      url: initialUrl,
      title: title || 'New Tab',
      sessionId: sessionId || 'default',
      webContents: webContents || null,
      active: active
    });

    // Store tab
    this.tabs.set(tab.id, tab);
    this.tabOrder.push(tab.id);

    // Make active if requested
    if (active) {
      this.activeTabId = tab.id;
    }

    const tabInfo = this.getTabInfo(tab.id);

    // Emit event and call legacy callback
    this.emit('tab-created', tabInfo);
    this.onTabCreated(tabInfo);

    getLogger().info(`Created tab: ${tab.id}`, { url: initialUrl });

    return {
      success: true,
      tab: tabInfo
    };
  }

  /**
   * Close a tab
   * @param {string} tabId - Tab to close
   * @returns {Object} Result
   */
  closeTab(tabId) {
    if (!this.tabs.has(tabId)) {
      return { success: false, error: 'Tab not found' };
    }

    const tab = this.tabs.get(tabId);

    // Don't close pinned tabs without confirmation
    if (tab.pinned) {
      return { success: false, error: 'Cannot close pinned tab. Unpin first.' };
    }

    // If closing active tab, switch to adjacent tab
    if (tabId === this.activeTabId) {
      const currentIndex = this.tabOrder.indexOf(tabId);

      // Try to switch to next tab, otherwise previous
      if (this.tabOrder.length > 1) {
        const newIndex = currentIndex < this.tabOrder.length - 1 ? currentIndex + 1 : currentIndex - 1;
        this.activeTabId = this.tabOrder[newIndex];
      } else {
        this.activeTabId = null;
      }
    }

    // Remove from storage
    this.tabs.delete(tabId);
    this.tabOrder = this.tabOrder.filter(id => id !== tabId);

    const eventData = { tabId, newActiveTabId: this.activeTabId };

    // Emit event and call legacy callback
    this.emit('tab-closed', eventData);
    this.onTabClosed(eventData);

    getLogger().info(`Closed tab: ${tabId}`);

    return {
      success: true,
      closedTabId: tabId,
      activeTabId: this.activeTabId
    };
  }

  /**
   * Switch to a tab
   * @param {string} tabId - Tab to switch to
   * @returns {Object} Result
   */
  switchTab(tabId) {
    if (!this.tabs.has(tabId)) {
      return { success: false, error: 'Tab not found' };
    }

    const previousTabId = this.activeTabId;
    this.activeTabId = tabId;

    // Update active state on tabs
    if (previousTabId && this.tabs.has(previousTabId)) {
      this.tabs.get(previousTabId).active = false;
    }

    // Update last accessed time and active state
    const tab = this.tabs.get(tabId);
    tab.lastAccessed = new Date().toISOString();
    tab.active = true;

    const eventData = { tabId, previousTabId };

    // Emit event and call legacy callback
    this.emit('tab-switched', eventData);
    this.onTabSwitched(eventData);

    getLogger().debug(`Switched to tab: ${tabId}`);

    return {
      success: true,
      tab: this.getTabInfo(tabId),
      previousTabId
    };
  }

  /**
   * List all tabs
   * @param {Object} options - List options
   * @returns {Object} Tabs list
   */
  listTabs(options = {}) {
    const { sessionId } = options;

    let tabsList = this.tabOrder.map(tabId => {
      const tab = this.tabs.get(tabId);
      return this.getTabInfo(tabId);
    });

    // Filter by session if specified
    if (sessionId) {
      tabsList = tabsList.filter(tab => tab.sessionId === sessionId);
    }

    return {
      success: true,
      activeTabId: this.activeTabId,
      count: tabsList.length,
      tabs: tabsList
    };
  }

  /**
   * Get info for a specific tab
   * @param {string} tabId - Tab identifier
   * @returns {Object} Tab info
   */
  getTabInfo(tabId) {
    const tab = this.tabs.get(tabId);

    if (!tab) {
      return null;
    }

    return {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      sessionId: tab.sessionId,
      createdAt: tab.createdAt,
      lastAccessed: tab.lastAccessed,
      loading: tab.loading,
      favicon: tab.favicon,
      canGoBack: tab.canGoBack,
      canGoForward: tab.canGoForward,
      zoomLevel: tab.zoomLevel,
      muted: tab.muted,
      pinned: tab.pinned,
      isActive: tab.id === this.activeTabId,
      index: this.tabOrder.indexOf(tab.id)
    };
  }

  /**
   * Get a tab by ID (alias for getTabInfo)
   * @param {string} tabId - Tab identifier
   * @returns {Object} Tab info or null if not found
   */
  getTab(tabId) {
    return this.getTabInfo(tabId);
  }

  /**
   * Get all tabs
   * @param {Object} options - Options for filtering tabs
   * @param {string} [options.sessionId] - Filter by session ID
   * @returns {Array} Array of tab info objects
   */
  getAllTabs(options = {}) {
    const result = this.listTabs(options);
    return result.tabs || [];
  }

  /**
   * Update tab data
   * @param {string} tabId - Tab to update
   * @param {Object} updates - Updates to apply
   * @returns {Object} Result
   */
  updateTab(tabId, updates) {
    const tab = this.tabs.get(tabId);

    if (!tab) {
      return { success: false, error: 'Tab not found' };
    }

    // Apply allowed updates
    const allowedFields = ['url', 'title', 'loading', 'favicon', 'canGoBack', 'canGoForward', 'zoomLevel', 'muted', 'pinned'];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        tab[field] = updates[field];
      }
    }

    // Track navigation history
    if (updates.url && updates.url !== tab.url) {
      // Add to tab's internal history
      if (tab.history.length === 0 || tab.history[tab.history.length - 1] !== updates.url) {
        // Truncate forward history if we're navigating from middle
        if (tab.historyIndex < tab.history.length - 1) {
          tab.history = tab.history.slice(0, tab.historyIndex + 1);
        }
        tab.history.push(updates.url);
        tab.historyIndex = tab.history.length - 1;

        // Limit history size
        if (tab.history.length > 100) {
          tab.history.shift();
          tab.historyIndex--;
        }
      }

      // Update navigation capability
      tab.canGoBack = tab.historyIndex > 0;
      tab.canGoForward = tab.historyIndex < tab.history.length - 1;
    }

    const tabInfo = this.getTabInfo(tabId);
    const eventData = { tabId, updates, tab: tabInfo };

    // Emit event and call legacy callback
    this.emit('tab-updated', eventData);
    this.onTabUpdated(eventData);

    return {
      success: true,
      tab: tabInfo
    };
  }

  /**
   * Navigate a tab to a URL
   * @param {string} tabId - Tab to navigate
   * @param {string} url - URL to navigate to
   * @returns {Object} Result
   */
  navigateTab(tabId, url) {
    const tab = this.tabs.get(tabId || this.activeTabId);

    if (!tab) {
      return { success: false, error: 'Tab not found' };
    }

    // Normalize URL
    let normalizedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
      if (url.includes('.') && !url.includes(' ')) {
        normalizedUrl = 'https://' + url;
      } else {
        normalizedUrl = 'https://www.google.com/search?q=' + encodeURIComponent(url);
      }
    }

    this.updateTab(tab.id, {
      url: normalizedUrl,
      loading: true,
      title: 'Loading...'
    });

    return {
      success: true,
      tabId: tab.id,
      url: normalizedUrl
    };
  }

  /**
   * Go back in tab history
   * @param {string} tabId - Tab identifier
   * @returns {Object} Result
   */
  goBack(tabId) {
    const tab = this.tabs.get(tabId || this.activeTabId);

    if (!tab) {
      return { success: false, error: 'Tab not found' };
    }

    if (tab.historyIndex <= 0) {
      return { success: false, error: 'Cannot go back' };
    }

    tab.historyIndex--;
    const url = tab.history[tab.historyIndex];

    tab.url = url;
    tab.canGoBack = tab.historyIndex > 0;
    tab.canGoForward = true;
    tab.loading = true;

    return {
      success: true,
      tabId: tab.id,
      url,
      canGoBack: tab.canGoBack,
      canGoForward: tab.canGoForward
    };
  }

  /**
   * Go forward in tab history
   * @param {string} tabId - Tab identifier
   * @returns {Object} Result
   */
  goForward(tabId) {
    const tab = this.tabs.get(tabId || this.activeTabId);

    if (!tab) {
      return { success: false, error: 'Tab not found' };
    }

    if (tab.historyIndex >= tab.history.length - 1) {
      return { success: false, error: 'Cannot go forward' };
    }

    tab.historyIndex++;
    const url = tab.history[tab.historyIndex];

    tab.url = url;
    tab.canGoBack = true;
    tab.canGoForward = tab.historyIndex < tab.history.length - 1;
    tab.loading = true;

    return {
      success: true,
      tabId: tab.id,
      url,
      canGoBack: tab.canGoBack,
      canGoForward: tab.canGoForward
    };
  }

  /**
   * Reload a tab
   * @param {string} tabId - Tab identifier
   * @returns {Object} Result
   */
  reloadTab(tabId) {
    const tab = this.tabs.get(tabId || this.activeTabId);

    if (!tab) {
      return { success: false, error: 'Tab not found' };
    }

    tab.loading = true;

    return {
      success: true,
      tabId: tab.id,
      url: tab.url
    };
  }

  /**
   * Duplicate a tab
   * @param {string} tabId - Tab to duplicate
   * @returns {Object} Result with new tab
   */
  duplicateTab(tabId) {
    const tab = this.tabs.get(tabId);

    if (!tab) {
      return { success: false, error: 'Tab not found' };
    }

    return this.createTab({
      url: tab.url,
      title: tab.title,
      sessionId: tab.sessionId,
      active: false
    });
  }

  /**
   * Pin/unpin a tab
   * @param {string} tabId - Tab to pin/unpin
   * @param {boolean} pinned - Pin state
   * @returns {Object} Result
   */
  pinTab(tabId, pinned = true) {
    const tab = this.tabs.get(tabId);

    if (!tab) {
      return { success: false, error: 'Tab not found' };
    }

    tab.pinned = pinned;

    // Move pinned tabs to the beginning
    if (pinned) {
      this.tabOrder = this.tabOrder.filter(id => id !== tabId);
      const firstUnpinnedIndex = this.tabOrder.findIndex(id => !this.tabs.get(id).pinned);
      if (firstUnpinnedIndex === -1) {
        this.tabOrder.push(tabId);
      } else {
        this.tabOrder.splice(firstUnpinnedIndex, 0, tabId);
      }
    }

    return {
      success: true,
      tab: this.getTabInfo(tabId)
    };
  }

  /**
   * Mute/unmute a tab
   * @param {string} tabId - Tab to mute/unmute
   * @param {boolean} muted - Mute state
   * @returns {Object} Result
   */
  muteTab(tabId, muted = true) {
    const tab = this.tabs.get(tabId);

    if (!tab) {
      return { success: false, error: 'Tab not found' };
    }

    tab.muted = muted;

    return {
      success: true,
      tab: this.getTabInfo(tabId)
    };
  }

  /**
   * Set zoom level for a tab
   * @param {string} tabId - Tab identifier
   * @param {number} zoomLevel - Zoom level (1.0 = 100%)
   * @returns {Object} Result
   */
  setZoom(tabId, zoomLevel) {
    const tab = this.tabs.get(tabId || this.activeTabId);

    if (!tab) {
      return { success: false, error: 'Tab not found' };
    }

    // Clamp zoom level
    tab.zoomLevel = Math.max(0.25, Math.min(5.0, zoomLevel));

    return {
      success: true,
      tabId: tab.id,
      zoomLevel: tab.zoomLevel
    };
  }

  /**
   * Move a tab to a new position
   * @param {string} tabId - Tab to move
   * @param {number} newIndex - New position index
   * @returns {Object} Result
   */
  moveTab(tabId, newIndex) {
    if (!this.tabs.has(tabId)) {
      return { success: false, error: 'Tab not found' };
    }

    const currentIndex = this.tabOrder.indexOf(tabId);
    const targetIndex = Math.max(0, Math.min(this.tabOrder.length - 1, newIndex));

    // Remove from current position
    this.tabOrder.splice(currentIndex, 1);

    // Insert at new position
    this.tabOrder.splice(targetIndex, 0, tabId);

    return {
      success: true,
      tabId,
      oldIndex: currentIndex,
      newIndex: targetIndex
    };
  }

  /**
   * Close all tabs except the specified one
   * @param {string} tabId - Tab to keep
   * @returns {Object} Result
   */
  closeOtherTabs(tabId) {
    if (!this.tabs.has(tabId)) {
      return { success: false, error: 'Tab not found' };
    }

    const tabsToClose = this.tabOrder.filter(id => id !== tabId && !this.tabs.get(id).pinned);
    let closedCount = 0;

    for (const id of tabsToClose) {
      this.closeTab(id);
      closedCount++;
    }

    // Ensure the kept tab is active
    this.activeTabId = tabId;

    return {
      success: true,
      closedCount,
      remainingTabs: this.tabs.size
    };
  }

  /**
   * Close all tabs to the right of the specified tab
   * @param {string} tabId - Reference tab
   * @returns {Object} Result
   */
  closeTabsToRight(tabId) {
    const index = this.tabOrder.indexOf(tabId);

    if (index === -1) {
      return { success: false, error: 'Tab not found' };
    }

    const tabsToClose = this.tabOrder.slice(index + 1).filter(id => !this.tabs.get(id).pinned);
    let closedCount = 0;

    for (const id of tabsToClose) {
      this.closeTab(id);
      closedCount++;
    }

    return {
      success: true,
      closedCount,
      remainingTabs: this.tabs.size
    };
  }

  /**
   * Get the active tab
   * @returns {Object} Active tab info
   */
  getActiveTab() {
    if (!this.activeTabId) {
      return null;
    }

    return this.getTabInfo(this.activeTabId);
  }

  /**
   * Switch to next tab
   * @returns {Object} Result
   */
  nextTab() {
    if (this.tabOrder.length === 0) {
      return { success: false, error: 'No tabs available' };
    }

    const currentIndex = this.tabOrder.indexOf(this.activeTabId);
    const nextIndex = (currentIndex + 1) % this.tabOrder.length;

    return this.switchTab(this.tabOrder[nextIndex]);
  }

  /**
   * Switch to previous tab
   * @returns {Object} Result
   */
  previousTab() {
    if (this.tabOrder.length === 0) {
      return { success: false, error: 'No tabs available' };
    }

    const currentIndex = this.tabOrder.indexOf(this.activeTabId);
    const prevIndex = currentIndex === 0 ? this.tabOrder.length - 1 : currentIndex - 1;

    return this.switchTab(this.tabOrder[prevIndex]);
  }

  /**
   * Switch to tab at specific index
   * @param {number} index - Tab index (1-based for keyboard shortcuts, 0 = last tab)
   * @returns {Object} Result
   */
  switchToTabIndex(index) {
    if (this.tabOrder.length === 0) {
      return { success: false, error: 'No tabs available' };
    }

    let targetIndex;
    if (index === 0) {
      // 0 means last tab
      targetIndex = this.tabOrder.length - 1;
    } else if (index >= 1 && index <= this.tabOrder.length) {
      targetIndex = index - 1;
    } else {
      return { success: false, error: 'Invalid tab index' };
    }

    return this.switchTab(this.tabOrder[targetIndex]);
  }

  /**
   * Serialize tabs for persistence
   * @returns {Object} Serialized tabs data
   */
  serialize() {
    const tabs = [];

    for (const tabId of this.tabOrder) {
      const tab = this.tabs.get(tabId);
      tabs.push({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        sessionId: tab.sessionId,
        pinned: tab.pinned,
        muted: tab.muted,
        zoomLevel: tab.zoomLevel
      });
    }

    return {
      activeTabId: this.activeTabId,
      tabs
    };
  }

  /**
   * Restore tabs from serialized data
   * @param {Object} data - Serialized tabs data
   */
  restore(data) {
    if (!data || !data.tabs) {
      return { success: false, error: 'Invalid restore data' };
    }

    // Clear existing tabs
    this.tabs.clear();
    this.tabOrder = [];
    this.activeTabId = null;

    // Restore tabs
    for (const tabData of data.tabs) {
      this.createTab({
        url: tabData.url,
        title: tabData.title,
        sessionId: tabData.sessionId,
        active: false
      });

      // Apply additional properties
      const restoredTab = this.tabs.get(this.tabOrder[this.tabOrder.length - 1]);
      if (restoredTab) {
        restoredTab.pinned = tabData.pinned || false;
        restoredTab.muted = tabData.muted || false;
        restoredTab.zoomLevel = tabData.zoomLevel || 1.0;
      }
    }

    // Restore active tab
    if (data.activeTabId && this.tabs.has(data.activeTabId)) {
      this.activeTabId = data.activeTabId;
    } else if (this.tabOrder.length > 0) {
      this.activeTabId = this.tabOrder[0];
    }

    getLogger().info(`Restored ${this.tabs.size} tabs`);

    return {
      success: true,
      restoredCount: this.tabs.size
    };
  }

  /**
   * Cleanup and close all tabs
   */
  cleanup() {
    this.tabs.clear();
    this.tabOrder = [];
    this.activeTabId = null;

    getLogger().info('Cleanup complete');
  }
}

module.exports = { TabManager, Tab };
