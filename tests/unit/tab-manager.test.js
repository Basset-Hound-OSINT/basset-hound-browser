/**
 * Basset Hound Browser - Tab Manager Unit Tests
 * Tests for tab creation, management, navigation, and lifecycle
 */

const { TabManager, Tab } = require('../../tabs/manager');

describe('Tab Class', () => {
  describe('Constructor', () => {
    test('should create a tab with default values', () => {
      const tab = new Tab();

      expect(tab.id).toMatch(/^tab-\d+-[a-z0-9]+$/);
      expect(tab.url).toBe('about:blank');
      expect(tab.title).toBe('New Tab');
      expect(tab.sessionId).toBe('default');
      expect(tab.active).toBe(false);
      expect(tab.loading).toBe(true);
      expect(tab.favicon).toBeNull();
      expect(tab.canGoBack).toBe(false);
      expect(tab.canGoForward).toBe(false);
      expect(tab.zoomLevel).toBe(1.0);
      expect(tab.muted).toBe(false);
      expect(tab.pinned).toBe(false);
    });

    test('should create a tab with custom values', () => {
      const tab = new Tab({
        id: 'custom-tab-1',
        url: 'https://example.com',
        title: 'Example',
        sessionId: 'session-1',
        active: true
      });

      expect(tab.id).toBe('custom-tab-1');
      expect(tab.url).toBe('https://example.com');
      expect(tab.title).toBe('Example');
      expect(tab.sessionId).toBe('session-1');
      expect(tab.active).toBe(true);
    });
  });

  describe('toJSON', () => {
    test('should return serializable representation', () => {
      const tab = new Tab({
        url: 'https://example.com',
        title: 'Example'
      });

      const json = tab.toJSON();

      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('url', 'https://example.com');
      expect(json).toHaveProperty('title', 'Example');
      expect(json).toHaveProperty('sessionId', 'default');
      expect(json).toHaveProperty('active', false);
      expect(json).toHaveProperty('loading', true);
      expect(json).toHaveProperty('zoomLevel', 1.0);
      expect(json).not.toHaveProperty('webContents');
    });
  });

  describe('update', () => {
    test('should update allowed fields', () => {
      const tab = new Tab();
      const originalAccessed = tab.lastAccessed;

      // Small delay to ensure time difference
      tab.update({
        url: 'https://new-url.com',
        title: 'New Title',
        loading: false,
        muted: true
      });

      expect(tab.url).toBe('https://new-url.com');
      expect(tab.title).toBe('New Title');
      expect(tab.loading).toBe(false);
      expect(tab.muted).toBe(true);
    });

    test('should not update disallowed fields', () => {
      const tab = new Tab({ id: 'original-id' });

      tab.update({
        id: 'new-id',
        createdAt: 'new-date'
      });

      expect(tab.id).toBe('original-id');
    });
  });

  describe('Navigation History', () => {
    test('should add URL to history', () => {
      const tab = new Tab();

      tab.addToHistory('https://page1.com');
      expect(tab.url).toBe('https://page1.com');
      expect(tab.history).toContain('https://page1.com');
      expect(tab.historyIndex).toBe(0);
      expect(tab.canGoBack).toBe(false);

      tab.addToHistory('https://page2.com');
      expect(tab.url).toBe('https://page2.com');
      expect(tab.canGoBack).toBe(true);
    });

    test('should not add duplicate consecutive URLs', () => {
      const tab = new Tab();

      tab.addToHistory('https://page1.com');
      tab.addToHistory('https://page1.com');

      expect(tab.history.length).toBe(1);
    });

    test('should navigate back in history', () => {
      const tab = new Tab();

      tab.addToHistory('https://page1.com');
      tab.addToHistory('https://page2.com');
      tab.addToHistory('https://page3.com');

      const backUrl = tab.goBack();
      expect(backUrl).toBe('https://page2.com');
      expect(tab.canGoBack).toBe(true);
      expect(tab.canGoForward).toBe(true);

      const backUrl2 = tab.goBack();
      expect(backUrl2).toBe('https://page1.com');
      expect(tab.canGoBack).toBe(false);
    });

    test('should navigate forward in history', () => {
      const tab = new Tab();

      tab.addToHistory('https://page1.com');
      tab.addToHistory('https://page2.com');
      tab.goBack();

      const forwardUrl = tab.goForward();
      expect(forwardUrl).toBe('https://page2.com');
      expect(tab.canGoForward).toBe(false);
    });

    test('should truncate forward history when navigating from middle', () => {
      const tab = new Tab();

      tab.addToHistory('https://page1.com');
      tab.addToHistory('https://page2.com');
      tab.addToHistory('https://page3.com');

      tab.goBack();
      tab.addToHistory('https://page4.com');

      expect(tab.history).toEqual(['https://page1.com', 'https://page2.com', 'https://page4.com']);
      expect(tab.canGoForward).toBe(false);
    });

    test('should limit history size', () => {
      const tab = new Tab();

      for (let i = 0; i < 110; i++) {
        tab.addToHistory(`https://page${i}.com`);
      }

      expect(tab.history.length).toBe(100);
    });

    test('should return null when cannot go back', () => {
      const tab = new Tab();
      tab.addToHistory('https://page1.com');

      expect(tab.goBack()).toBeNull();
    });

    test('should return null when cannot go forward', () => {
      const tab = new Tab();
      tab.addToHistory('https://page1.com');

      expect(tab.goForward()).toBeNull();
    });
  });
});

describe('TabManager', () => {
  let tabManager;

  beforeEach(() => {
    tabManager = new TabManager();
  });

  describe('Constructor', () => {
    test('should initialize with default values', () => {
      expect(tabManager.tabs.size).toBe(0);
      expect(tabManager.activeTabId).toBeNull();
      expect(tabManager.tabOrder).toEqual([]);
      expect(tabManager.maxTabs).toBe(50);
      expect(tabManager.homePage).toBe('https://www.google.com');
    });

    test('should accept custom options', () => {
      const customManager = new TabManager({
        maxTabs: 10,
        homePage: 'https://custom.com'
      });

      expect(customManager.maxTabs).toBe(10);
      expect(customManager.homePage).toBe('https://custom.com');
    });
  });

  describe('createTab', () => {
    test('should create a new tab', () => {
      const result = tabManager.createTab({
        url: 'https://example.com',
        title: 'Example'
      });

      expect(result.success).toBe(true);
      expect(result.tab).toBeDefined();
      expect(result.tab.url).toBe('https://example.com');
      expect(result.tab.title).toBe('Example');
      expect(tabManager.tabs.size).toBe(1);
    });

    test('should use home page as default URL', () => {
      const result = tabManager.createTab();

      expect(result.tab.url).toBe('https://www.google.com');
    });

    test('should make first tab active by default', () => {
      const result = tabManager.createTab();

      expect(result.tab.isActive).toBe(true);
      expect(tabManager.activeTabId).toBe(result.tab.id);
    });

    test('should respect active option', () => {
      tabManager.createTab({ active: true });
      const result = tabManager.createTab({ active: false });

      expect(result.tab.isActive).toBe(false);
    });

    test('should fail when max tabs reached', () => {
      const manager = new TabManager({ maxTabs: 2 });

      manager.createTab();
      manager.createTab();
      const result = manager.createTab();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum number of tabs');
    });

    test('should emit tab-created event', () => {
      const handler = jest.fn();
      tabManager.on('tab-created', handler);

      tabManager.createTab();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('closeTab', () => {
    test('should close an existing tab', () => {
      const { tab } = tabManager.createTab();

      const result = tabManager.closeTab(tab.id);

      expect(result.success).toBe(true);
      expect(tabManager.tabs.size).toBe(0);
    });

    test('should fail for non-existent tab', () => {
      const result = tabManager.closeTab('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tab not found');
    });

    test('should not close pinned tab', () => {
      const { tab } = tabManager.createTab();
      tabManager.pinTab(tab.id, true);

      const result = tabManager.closeTab(tab.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot close pinned tab');
    });

    test('should switch to adjacent tab when closing active tab', () => {
      const tab1 = tabManager.createTab().tab;
      const tab2 = tabManager.createTab().tab;

      tabManager.switchTab(tab1.id);
      tabManager.closeTab(tab1.id);

      expect(tabManager.activeTabId).toBe(tab2.id);
    });

    test('should emit tab-closed event', () => {
      const handler = jest.fn();
      tabManager.on('tab-closed', handler);

      const { tab } = tabManager.createTab();
      tabManager.closeTab(tab.id);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('switchTab', () => {
    test('should switch to existing tab', () => {
      const tab1 = tabManager.createTab().tab;
      const tab2 = tabManager.createTab({ active: false }).tab;

      const result = tabManager.switchTab(tab2.id);

      expect(result.success).toBe(true);
      expect(tabManager.activeTabId).toBe(tab2.id);
    });

    test('should fail for non-existent tab', () => {
      const result = tabManager.switchTab('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tab not found');
    });

    test('should emit tab-switched event', () => {
      const handler = jest.fn();
      tabManager.on('tab-switched', handler);

      const tab1 = tabManager.createTab().tab;
      const tab2 = tabManager.createTab({ active: false }).tab;
      tabManager.switchTab(tab2.id);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        tabId: tab2.id,
        previousTabId: tab1.id
      }));
    });
  });

  describe('listTabs', () => {
    test('should list all tabs', () => {
      tabManager.createTab({ url: 'https://page1.com' });
      tabManager.createTab({ url: 'https://page2.com' });

      const result = tabManager.listTabs();

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.tabs.length).toBe(2);
    });

    test('should filter by session ID', () => {
      tabManager.createTab({ sessionId: 'session-1' });
      tabManager.createTab({ sessionId: 'session-2' });

      const result = tabManager.listTabs({ sessionId: 'session-1' });

      expect(result.tabs.length).toBe(1);
      expect(result.tabs[0].sessionId).toBe('session-1');
    });
  });

  describe('getTabInfo', () => {
    test('should return tab info', () => {
      const { tab } = tabManager.createTab({ url: 'https://example.com' });

      const info = tabManager.getTabInfo(tab.id);

      expect(info).not.toBeNull();
      expect(info.url).toBe('https://example.com');
      expect(info.isActive).toBe(true);
      expect(info.index).toBe(0);
    });

    test('should return null for non-existent tab', () => {
      const info = tabManager.getTabInfo('non-existent');

      expect(info).toBeNull();
    });
  });

  describe('getTab', () => {
    test('should be alias for getTabInfo', () => {
      const { tab } = tabManager.createTab();

      expect(tabManager.getTab(tab.id)).toEqual(tabManager.getTabInfo(tab.id));
    });
  });

  describe('getAllTabs', () => {
    test('should return array of all tabs', () => {
      tabManager.createTab();
      tabManager.createTab();

      const tabs = tabManager.getAllTabs();

      expect(Array.isArray(tabs)).toBe(true);
      expect(tabs.length).toBe(2);
    });
  });

  describe('updateTab', () => {
    test('should update tab properties', () => {
      const { tab } = tabManager.createTab();

      const result = tabManager.updateTab(tab.id, {
        url: 'https://new-url.com',
        title: 'New Title',
        loading: false
      });

      expect(result.success).toBe(true);
      expect(result.tab.url).toBe('https://new-url.com');
      expect(result.tab.title).toBe('New Title');
    });

    test('should fail for non-existent tab', () => {
      const result = tabManager.updateTab('non-existent', { title: 'Test' });

      expect(result.success).toBe(false);
    });

    test('should emit tab-updated event', () => {
      const handler = jest.fn();
      tabManager.on('tab-updated', handler);

      const { tab } = tabManager.createTab();
      tabManager.updateTab(tab.id, { title: 'Updated' });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('navigateTab', () => {
    test('should navigate tab to URL', () => {
      const { tab } = tabManager.createTab();

      const result = tabManager.navigateTab(tab.id, 'https://new-site.com');

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://new-site.com');
    });

    test('should normalize URL without protocol', () => {
      const { tab } = tabManager.createTab();

      const result = tabManager.navigateTab(tab.id, 'example.com');

      expect(result.url).toBe('https://example.com');
    });

    test('should search for text without dots', () => {
      const { tab } = tabManager.createTab();

      const result = tabManager.navigateTab(tab.id, 'search term');

      expect(result.url).toContain('google.com/search');
      expect(result.url).toContain('search%20term');
    });

    test('should use active tab if no tabId provided', () => {
      const { tab } = tabManager.createTab();

      const result = tabManager.navigateTab(null, 'https://test.com');

      expect(result.success).toBe(true);
      expect(result.tabId).toBe(tab.id);
    });
  });

  describe('goBack / goForward', () => {
    test('should go back in history', () => {
      const { tab } = tabManager.createTab();
      tabManager.updateTab(tab.id, { url: 'https://page1.com' });
      tabManager.updateTab(tab.id, { url: 'https://page2.com' });

      const result = tabManager.goBack(tab.id);

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://page1.com');
    });

    test('should go forward in history', () => {
      const { tab } = tabManager.createTab();
      tabManager.updateTab(tab.id, { url: 'https://page1.com' });
      tabManager.updateTab(tab.id, { url: 'https://page2.com' });
      tabManager.goBack(tab.id);

      const result = tabManager.goForward(tab.id);

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://page2.com');
    });
  });

  describe('reloadTab', () => {
    test('should reload tab', () => {
      const { tab } = tabManager.createTab();
      tabManager.updateTab(tab.id, { loading: false });

      const result = tabManager.reloadTab(tab.id);

      expect(result.success).toBe(true);
    });
  });

  describe('duplicateTab', () => {
    test('should create duplicate of tab', () => {
      const original = tabManager.createTab({
        url: 'https://example.com',
        title: 'Example'
      }).tab;

      const result = tabManager.duplicateTab(original.id);

      expect(result.success).toBe(true);
      expect(result.tab.url).toBe('https://example.com');
      expect(result.tab.id).not.toBe(original.id);
      expect(tabManager.tabs.size).toBe(2);
    });
  });

  describe('pinTab', () => {
    test('should pin a tab', () => {
      const { tab } = tabManager.createTab();

      const result = tabManager.pinTab(tab.id, true);

      expect(result.success).toBe(true);
      expect(result.tab.pinned).toBe(true);
    });

    test('should unpin a tab', () => {
      const { tab } = tabManager.createTab();
      tabManager.pinTab(tab.id, true);

      const result = tabManager.pinTab(tab.id, false);

      expect(result.success).toBe(true);
      expect(result.tab.pinned).toBe(false);
    });

    test('should move pinned tab to beginning', () => {
      const tab1 = tabManager.createTab().tab;
      const tab2 = tabManager.createTab().tab;

      tabManager.pinTab(tab2.id, true);

      expect(tabManager.tabOrder[0]).toBe(tab2.id);
    });
  });

  describe('muteTab', () => {
    test('should mute a tab', () => {
      const { tab } = tabManager.createTab();

      const result = tabManager.muteTab(tab.id, true);

      expect(result.success).toBe(true);
      expect(result.tab.muted).toBe(true);
    });
  });

  describe('setZoom', () => {
    test('should set zoom level', () => {
      const { tab } = tabManager.createTab();

      const result = tabManager.setZoom(tab.id, 1.5);

      expect(result.success).toBe(true);
      expect(result.zoomLevel).toBe(1.5);
    });

    test('should clamp zoom level', () => {
      const { tab } = tabManager.createTab();

      tabManager.setZoom(tab.id, 10);
      expect(tabManager.getTabInfo(tab.id).zoomLevel).toBe(5.0);

      tabManager.setZoom(tab.id, 0.1);
      expect(tabManager.getTabInfo(tab.id).zoomLevel).toBe(0.25);
    });
  });

  describe('moveTab', () => {
    test('should move tab to new position', () => {
      const tab1 = tabManager.createTab().tab;
      const tab2 = tabManager.createTab().tab;
      const tab3 = tabManager.createTab().tab;

      tabManager.moveTab(tab3.id, 0);

      expect(tabManager.tabOrder[0]).toBe(tab3.id);
    });
  });

  describe('closeOtherTabs', () => {
    test('should close all tabs except specified', () => {
      const tab1 = tabManager.createTab().tab;
      tabManager.createTab();
      tabManager.createTab();

      const result = tabManager.closeOtherTabs(tab1.id);

      expect(result.success).toBe(true);
      expect(result.closedCount).toBe(2);
      expect(tabManager.tabs.size).toBe(1);
    });

    test('should not close pinned tabs', () => {
      const tab1 = tabManager.createTab().tab;
      const tab2 = tabManager.createTab().tab;
      tabManager.pinTab(tab2.id, true);

      tabManager.closeOtherTabs(tab1.id);

      expect(tabManager.tabs.size).toBe(2);
    });
  });

  describe('closeTabsToRight', () => {
    test('should close tabs to the right', () => {
      const tab1 = tabManager.createTab().tab;
      tabManager.createTab();
      tabManager.createTab();

      const result = tabManager.closeTabsToRight(tab1.id);

      expect(result.success).toBe(true);
      expect(result.closedCount).toBe(2);
      expect(tabManager.tabs.size).toBe(1);
    });
  });

  describe('getActiveTab', () => {
    test('should return active tab', () => {
      const { tab } = tabManager.createTab();

      const active = tabManager.getActiveTab();

      expect(active).not.toBeNull();
      expect(active.id).toBe(tab.id);
    });

    test('should return null when no tabs', () => {
      const active = tabManager.getActiveTab();

      expect(active).toBeNull();
    });
  });

  describe('nextTab / previousTab', () => {
    test('should switch to next tab', () => {
      const tab1 = tabManager.createTab().tab;
      const tab2 = tabManager.createTab({ active: false }).tab;

      tabManager.nextTab();

      expect(tabManager.activeTabId).toBe(tab2.id);
    });

    test('should wrap around to first tab', () => {
      const tab1 = tabManager.createTab().tab;
      tabManager.createTab({ active: false });

      tabManager.nextTab();
      tabManager.nextTab();

      expect(tabManager.activeTabId).toBe(tab1.id);
    });

    test('should switch to previous tab', () => {
      const tab1 = tabManager.createTab().tab;
      const tab2 = tabManager.createTab().tab;

      tabManager.previousTab();

      expect(tabManager.activeTabId).toBe(tab1.id);
    });
  });

  describe('switchToTabIndex', () => {
    test('should switch to tab at index', () => {
      tabManager.createTab();
      const tab2 = tabManager.createTab({ active: false }).tab;

      tabManager.switchToTabIndex(2);

      expect(tabManager.activeTabId).toBe(tab2.id);
    });

    test('should switch to last tab with index 0', () => {
      tabManager.createTab();
      const tab2 = tabManager.createTab({ active: false }).tab;

      tabManager.switchToTabIndex(0);

      expect(tabManager.activeTabId).toBe(tab2.id);
    });
  });

  describe('serialize / restore', () => {
    test('should serialize tabs', () => {
      tabManager.createTab({ url: 'https://page1.com' });
      tabManager.createTab({ url: 'https://page2.com' });

      const data = tabManager.serialize();

      expect(data.activeTabId).toBeDefined();
      expect(data.tabs.length).toBe(2);
    });

    test('should restore tabs', () => {
      tabManager.createTab({ url: 'https://page1.com' });
      const data = tabManager.serialize();

      const newManager = new TabManager();
      const result = newManager.restore(data);

      expect(result.success).toBe(true);
      expect(result.restoredCount).toBe(1);
    });

    test('should fail with invalid data', () => {
      const result = tabManager.restore(null);

      expect(result.success).toBe(false);
    });
  });

  describe('cleanup', () => {
    test('should clear all tabs', () => {
      tabManager.createTab();
      tabManager.createTab();

      tabManager.cleanup();

      expect(tabManager.tabs.size).toBe(0);
      expect(tabManager.activeTabId).toBeNull();
      expect(tabManager.tabOrder).toEqual([]);
    });
  });
});
