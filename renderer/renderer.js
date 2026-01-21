// Basset Hound Browser - Renderer Process
// Handles navigation, UI updates, tab management, and communication with main process

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const tabsContainer = document.getElementById('tabs-container');
  const webviewContainer = document.getElementById('webview-container');
  const btnNewTab = document.getElementById('btn-new-tab');
  const sessionName = document.getElementById('session-name');
  const urlInput = document.getElementById('url-input');
  const btnBack = document.getElementById('btn-back');
  const btnForward = document.getElementById('btn-forward');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnHome = document.getElementById('btn-home');
  const btnGo = document.getElementById('btn-go');
  const loadingOverlay = document.getElementById('loading-overlay');
  const wsStatusDot = document.getElementById('ws-status-dot');
  const wsStatusText = document.getElementById('ws-status-text');
  const pageStatusDot = document.getElementById('page-status-dot');
  const pageStatusText = document.getElementById('page-status-text');
  const clientsCount = document.getElementById('clients-count');
  const currentUrlDisplay = document.getElementById('current-url');

  // State
  let tabs = new Map(); // Map of tabId -> { element, webview, data }
  let activeTabId = null;
  let isLoading = false;
  let evasionScript = '';

  // Initialize
  async function init() {
    // Get evasion script from main process
    if (window.evasionHelpers) {
      evasionScript = window.evasionHelpers.getWebviewEvasionScript();
    }

    // Setup event listeners
    setupNavigationListeners();
    setupTabListeners();
    setupIPCListeners();
    setupDownloadListeners();

    // Start WebSocket status polling
    pollWebSocketStatus();

    // Create initial tab (will be triggered by main process)
    // The main process creates the first tab, so we wait for the tab-created event
  }

  // ==========================================
  // Tab Management
  // ==========================================

  function createTab(tabData) {
    const { id, url, title, loading, pinned } = tabData;

    // Create tab element
    const tabElement = document.createElement('div');
    tabElement.className = 'tab' + (pinned ? ' pinned' : '');
    tabElement.dataset.tabId = id;

    tabElement.innerHTML = `
      ${loading ? '<div class="tab-loading"></div>' : '<img class="tab-favicon" src="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><circle cx=%2212%22 cy=%2212%22 r=%228%22 fill=%22%23666%22/></svg>" alt="">'}
      <span class="tab-title">${escapeHtml(title || 'New Tab')}</span>
      ${!pinned ? '<button class="tab-close" title="Close Tab">x</button>' : ''}
    `;

    // Tab click handler
    tabElement.addEventListener('click', (e) => {
      if (!e.target.classList.contains('tab-close')) {
        switchToTab(id);
      }
    });

    // Close button handler
    const closeBtn = tabElement.querySelector('.tab-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(id);
      });
    }

    // Add to container
    tabsContainer.appendChild(tabElement);

    // Create webview for this tab
    const webview = document.createElement('webview');
    webview.id = `webview-${id}`;
    webview.src = url || 'about:blank';
    webview.setAttribute('allowpopups', '');
    webview.setAttribute('webpreferences', 'contextIsolation=no, nodeIntegration=no');
    webviewContainer.appendChild(webview);

    // Setup webview listeners
    setupWebviewListeners(webview, id);

    // Store tab data
    tabs.set(id, {
      element: tabElement,
      webview: webview,
      data: tabData
    });

    // Activate if it's the active tab or first tab
    if (tabData.isActive || tabs.size === 1) {
      switchToTab(id);
    }

    return tabElement;
  }

  function switchToTab(tabId) {
    if (activeTabId === tabId) return;

    // Deactivate current tab
    if (activeTabId && tabs.has(activeTabId)) {
      const currentTab = tabs.get(activeTabId);
      currentTab.element.classList.remove('active');
      currentTab.webview.classList.remove('active');
    }

    // Activate new tab
    if (tabs.has(tabId)) {
      const newTab = tabs.get(tabId);
      newTab.element.classList.add('active');
      newTab.webview.classList.add('active');
      activeTabId = tabId;

      // Update URL bar
      try {
        const url = newTab.webview.getURL();
        updateUrlDisplay(url);
        updateNavigationButtons(newTab.webview);
      } catch (e) {
        // Webview not ready yet
      }

      // Notify main process
      if (window.electronAPI) {
        window.electronAPI.switchTab(tabId);
      }
    }
  }

  function closeTab(tabId) {
    if (!tabs.has(tabId)) return;

    const tab = tabs.get(tabId);

    // Remove elements
    tab.element.remove();
    tab.webview.remove();

    // Remove from map
    tabs.delete(tabId);

    // Notify main process
    if (window.electronAPI) {
      window.electronAPI.closeTab(tabId);
    }

    // If closing active tab, switch to another
    if (tabId === activeTabId) {
      activeTabId = null;
      if (tabs.size > 0) {
        const nextTabId = tabs.keys().next().value;
        switchToTab(nextTabId);
      }
    }
  }

  function updateTab(tabId, updates) {
    if (!tabs.has(tabId)) return;

    const tab = tabs.get(tabId);
    Object.assign(tab.data, updates);

    // Update tab element
    if (updates.title !== undefined) {
      const titleEl = tab.element.querySelector('.tab-title');
      if (titleEl) {
        titleEl.textContent = updates.title;
      }
    }

    if (updates.loading !== undefined) {
      const loadingEl = tab.element.querySelector('.tab-loading');
      const faviconEl = tab.element.querySelector('.tab-favicon');

      if (updates.loading) {
        if (!loadingEl) {
          const loading = document.createElement('div');
          loading.className = 'tab-loading';
          tab.element.insertBefore(loading, tab.element.firstChild);
        }
        if (faviconEl) faviconEl.style.display = 'none';
      } else {
        if (loadingEl) loadingEl.remove();
        if (faviconEl) faviconEl.style.display = '';
      }
    }

    if (updates.favicon !== undefined && updates.favicon) {
      const faviconEl = tab.element.querySelector('.tab-favicon');
      if (faviconEl) {
        faviconEl.src = updates.favicon;
      }
    }
  }

  function getActiveWebview() {
    if (activeTabId && tabs.has(activeTabId)) {
      return tabs.get(activeTabId).webview;
    }
    return null;
  }

  // ==========================================
  // Navigation Functions
  // ==========================================

  function navigateTo(url) {
    const webview = getActiveWebview();
    if (!webview) return;

    // Add protocol if missing
    if (url && !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
      if (url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
      }
    }

    if (url) {
      showLoading(true);
      webview.src = url;
      urlInput.value = url;
    }
  }

  function goBack() {
    const webview = getActiveWebview();
    if (webview && webview.canGoBack()) {
      webview.goBack();
    }
  }

  function goForward() {
    const webview = getActiveWebview();
    if (webview && webview.canGoForward()) {
      webview.goForward();
    }
  }

  function refresh() {
    const webview = getActiveWebview();
    if (webview) {
      webview.reload();
    }
  }

  function goHome() {
    navigateTo('https://www.google.com');
  }

  // ==========================================
  // UI Helpers
  // ==========================================

  function showLoading(show) {
    isLoading = show;
    loadingOverlay.classList.toggle('active', show);
    pageStatusDot.classList.toggle('loading', show);
    pageStatusText.textContent = show ? 'Loading...' : 'Ready';

    if (activeTabId) {
      updateTab(activeTabId, { loading: show });
    }
  }

  function updateNavigationButtons(webview) {
    if (webview) {
      btnBack.disabled = !webview.canGoBack();
      btnForward.disabled = !webview.canGoForward();
    }
  }

  function updateUrlDisplay(url) {
    urlInput.value = url;
    currentUrlDisplay.textContent = url.length > 50 ? url.substring(0, 50) + '...' : url;
  }

  function updateWebSocketStatus(status) {
    const connected = status && status.clients > 0;
    wsStatusDot.classList.toggle('connected', connected);
    wsStatusDot.classList.toggle('disconnected', !connected);
    wsStatusText.textContent = connected ? 'WebSocket: Connected' : 'WebSocket: Disconnected';
    clientsCount.textContent = `Clients: ${status ? status.clients : 0}`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==========================================
  // Setup Navigation Listeners
  // ==========================================

  function setupNavigationListeners() {
    btnBack.addEventListener('click', goBack);
    btnForward.addEventListener('click', goForward);
    btnRefresh.addEventListener('click', refresh);
    btnHome.addEventListener('click', goHome);
    btnGo.addEventListener('click', () => navigateTo(urlInput.value));

    urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        navigateTo(urlInput.value);
      }
    });
  }

  // ==========================================
  // Setup Tab Listeners
  // ==========================================

  function setupTabListeners() {
    btnNewTab.addEventListener('click', async () => {
      if (window.electronAPI) {
        await window.electronAPI.newTab({ url: 'https://www.google.com', active: true });
      }
    });

    // Keyboard shortcuts for tabs
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 't') {
          e.preventDefault();
          btnNewTab.click();
        } else if (e.key === 'w') {
          e.preventDefault();
          if (activeTabId) closeTab(activeTabId);
        } else if (e.key === 'Tab' && e.shiftKey) {
          e.preventDefault();
          if (window.electronAPI) window.electronAPI.previousTab();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          if (window.electronAPI) window.electronAPI.nextTab();
        } else if (e.key >= '1' && e.key <= '9') {
          e.preventDefault();
          const tabIndex = parseInt(e.key);
          const tabIds = Array.from(tabs.keys());
          if (e.key === '9') {
            if (tabIds.length > 0) switchToTab(tabIds[tabIds.length - 1]);
          } else if (tabIndex <= tabIds.length) {
            switchToTab(tabIds[tabIndex - 1]);
          }
        }
      }
    });
  }

  // ==========================================
  // Setup Webview Listeners (per tab)
  // ==========================================

  function setupWebviewListeners(webview, tabId) {
    webview.addEventListener('did-start-loading', () => {
      if (tabId === activeTabId) {
        showLoading(true);
      } else {
        updateTab(tabId, { loading: true });
      }
    });

    webview.addEventListener('did-stop-loading', () => {
      if (tabId === activeTabId) {
        showLoading(false);
        updateNavigationButtons(webview);
      } else {
        updateTab(tabId, { loading: false });
      }
      injectEvasionScript(webview);
    });

    webview.addEventListener('did-navigate', (e) => {
      updateTab(tabId, { url: e.url });
      if (tabId === activeTabId) {
        updateUrlDisplay(e.url);
      }

      // Add to history
      if (window.electronAPI) {
        window.electronAPI.addToHistory({ url: e.url, title: '' });
        window.electronAPI.updateTab(tabId, { url: e.url });
      }
    });

    webview.addEventListener('did-navigate-in-page', (e) => {
      updateTab(tabId, { url: e.url });
      if (tabId === activeTabId) {
        updateUrlDisplay(e.url);
      }
    });

    webview.addEventListener('page-title-updated', (e) => {
      updateTab(tabId, { title: e.title });
      if (tabId === activeTabId) {
        document.title = `${e.title} - Basset Hound`;
      }

      // Update history and tab
      if (window.electronAPI) {
        window.electronAPI.updateTab(tabId, { title: e.title });
      }
    });

    webview.addEventListener('page-favicon-updated', (e) => {
      if (e.favicons && e.favicons.length > 0) {
        updateTab(tabId, { favicon: e.favicons[0] });
        if (window.electronAPI) {
          window.electronAPI.updateTab(tabId, { favicon: e.favicons[0] });
        }
      }
    });

    webview.addEventListener('did-fail-load', (e) => {
      if (tabId === activeTabId) {
        showLoading(false);
        if (e.errorCode !== -3) {
          console.error('Failed to load:', e.errorDescription);
          pageStatusText.textContent = `Error: ${e.errorDescription}`;
        }
      } else {
        updateTab(tabId, { loading: false });
      }
    });

    webview.addEventListener('new-window', (e) => {
      // Open in new tab
      if (window.electronAPI) {
        window.electronAPI.newTab({ url: e.url, active: true });
      }
    });

    webview.addEventListener('console-message', (e) => {
      console.log(`[Webview ${tabId}]:`, e.message);
    });
  }

  // Inject evasion script into webview
  async function injectEvasionScript(webview) {
    if (evasionScript && webview) {
      try {
        await webview.executeJavaScript(evasionScript);
        console.log('Evasion script injected successfully');
      } catch (error) {
        console.error('Failed to inject evasion script:', error);
      }
    }
  }

  // ==========================================
  // Setup IPC Listeners from main process
  // ==========================================

  function setupIPCListeners() {
    const api = window.electronAPI;
    if (!api) {
      console.error('electronAPI not available');
      return;
    }

    // Tab events from main process
    api.onTabCreated((tab) => {
      createTab(tab);
    });

    api.onTabClosed((data) => {
      const { closedTabId, activeTabId: newActiveTabId } = data;
      if (tabs.has(closedTabId)) {
        const tab = tabs.get(closedTabId);
        tab.element.remove();
        tab.webview.remove();
        tabs.delete(closedTabId);
      }
      if (newActiveTabId && tabs.has(newActiveTabId)) {
        switchToTab(newActiveTabId);
      }
    });

    api.onTabSwitched((data) => {
      const { tabId } = data;
      if (tabId !== activeTabId && tabs.has(tabId)) {
        switchToTab(tabId);
      }
    });

    api.onTabUpdated((data) => {
      const { tabId, updates } = data;
      updateTab(tabId, updates);
    });

    api.onTabNavigate((data) => {
      const { tabId, url } = data;
      if (tabs.has(tabId)) {
        const tab = tabs.get(tabId);
        tab.webview.src = url;
      }
    });

    api.onTabReload((data) => {
      const { tabId } = data;
      if (tabs.has(tabId)) {
        const tab = tabs.get(tabId);
        tab.webview.reload();
      }
    });

    // Session events
    api.onSessionChanged((data) => {
      sessionName.textContent = data.sessionId;
    });

    // Navigate command (for WebSocket)
    api.onNavigateWebview((url) => {
      navigateTo(url);
    });

    // Get webview URL
    api.onGetWebviewUrl(() => {
      const webview = getActiveWebview();
      api.sendWebviewUrlResponse(webview ? webview.getURL() : 'about:blank');
    });

    // Execute script in webview
    api.onExecuteInWebview(async (script) => {
      const webview = getActiveWebview();
      if (!webview) {
        api.sendExecuteResponse({ success: false, error: 'No active webview' });
        return;
      }
      try {
        const result = await webview.executeJavaScript(script);
        api.sendExecuteResponse({ success: true, result });
      } catch (error) {
        api.sendExecuteResponse({ success: false, error: error.message });
      }
    });

    // Get page content
    api.onGetPageContent(async () => {
      const webview = getActiveWebview();
      if (!webview) {
        api.sendPageContentResponse({ success: false, error: 'No active webview' });
        return;
      }
      try {
        const content = await webview.executeJavaScript(`
          ({
            html: document.documentElement.outerHTML,
            text: document.body.innerText,
            title: document.title,
            url: window.location.href
          })
        `);
        api.sendPageContentResponse({ success: true, content });
      } catch (error) {
        api.sendPageContentResponse({ success: false, error: error.message });
      }
    });

    // Capture screenshot (basic viewport)
    api.onCaptureScreenshot(async () => {
      const webview = getActiveWebview();
      if (!webview) {
        api.sendScreenshotResponse({ success: false, error: 'No active webview' });
        return;
      }
      try {
        // Ensure webview has valid dimensions before capturing
        const bounds = webview.getBoundingClientRect();
        if (bounds.width === 0 || bounds.height === 0) {
          api.sendScreenshotResponse({
            success: false,
            error: 'Webview has zero dimensions - cannot capture screenshot'
          });
          return;
        }

        const image = await webview.capturePage();

        // Check if the captured image is empty (common in headless mode)
        if (image.isEmpty()) {
          // In headless/offscreen mode, webview.capturePage() may return empty image
          // Try to capture page content as a fallback using executeJavaScript
          try {
            const screenshotData = await webview.executeJavaScript(`
              (function() {
                return new Promise((resolve, reject) => {
                  try {
                    // Create a canvas with the page dimensions
                    const scrollWidth = Math.max(
                      document.documentElement.scrollWidth,
                      document.body.scrollWidth
                    );
                    const scrollHeight = Math.max(
                      document.documentElement.scrollHeight,
                      document.body.scrollHeight
                    );
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;

                    // Use html2canvas-like approach or return error for main process fallback
                    resolve({
                      needsMainProcessCapture: true,
                      viewport: { width: viewportWidth, height: viewportHeight },
                      scroll: { width: scrollWidth, height: scrollHeight }
                    });
                  } catch (e) {
                    reject(e);
                  }
                });
              })()
            `);

            // Signal to main process that it should capture via its own webContents
            api.sendScreenshotResponse({
              success: false,
              error: 'Webview capturePage returned empty image in headless mode - use screenshot_viewport command instead',
              needsMainProcessCapture: true,
              dimensions: screenshotData
            });
          } catch (jsError) {
            api.sendScreenshotResponse({
              success: false,
              error: 'Screenshot capture failed in headless mode: webview.capturePage() returned empty image'
            });
          }
          return;
        }

        const dataUrl = image.toDataURL();

        // Verify we got actual image data, not just the header
        // A minimal valid PNG data URL is about 100+ chars, empty would be ~22 chars
        if (dataUrl.length < 100) {
          api.sendScreenshotResponse({
            success: false,
            error: 'Screenshot capture returned minimal data - possible headless rendering issue'
          });
          return;
        }

        api.sendScreenshotResponse({ success: true, data: dataUrl });
      } catch (error) {
        api.sendScreenshotResponse({ success: false, error: error.message });
      }
    });

    // Click element
    api.onClickElement(async (selector) => {
      const webview = getActiveWebview();
      if (!webview) {
        api.sendClickResponse({ success: false, error: 'No active webview' });
        return;
      }
      try {
        const safeSelector = JSON.stringify(selector);
        const result = await webview.executeJavaScript(`
          (function() {
            const element = document.querySelector(${safeSelector});
            if (element) {
              element.click();
              return { success: true };
            }
            return { success: false, error: 'Element not found' };
          })()
        `);
        api.sendClickResponse(result);
      } catch (error) {
        api.sendClickResponse({ success: false, error: error.message });
      }
    });

    // Fill field
    api.onFillField(async ({ selector, value }) => {
      const webview = getActiveWebview();
      if (!webview) {
        api.sendFillResponse({ success: false, error: 'No active webview' });
        return;
      }
      try {
        const safeSelector = JSON.stringify(selector);
        const safeValue = JSON.stringify(value);
        const result = await webview.executeJavaScript(`
          (function() {
            const element = document.querySelector(${safeSelector});
            if (element) {
              element.value = ${safeValue};
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
              return { success: true };
            }
            return { success: false, error: 'Element not found' };
          })()
        `);
        api.sendFillResponse(result);
      } catch (error) {
        api.sendFillResponse({ success: false, error: error.message });
      }
    });

    // Get page state
    api.onGetPageState(async () => {
      const webview = getActiveWebview();
      if (!webview) {
        api.sendPageStateResponse({ success: false, error: 'No active webview' });
        return;
      }
      try {
        const state = await webview.executeJavaScript(`
          (function() {
            const forms = Array.from(document.forms).map((form, index) => ({
              index,
              id: form.id,
              name: form.name,
              action: form.action,
              method: form.method,
              fields: Array.from(form.elements).map(el => ({
                type: el.type,
                name: el.name,
                id: el.id,
                value: el.type !== 'password' ? el.value : '***',
                placeholder: el.placeholder
              }))
            }));

            const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 100).map(a => ({
              href: a.href,
              text: a.innerText.trim().substring(0, 100),
              title: a.title
            }));

            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]')).map(btn => ({
              type: btn.type,
              text: btn.innerText || btn.value,
              id: btn.id,
              name: btn.name,
              disabled: btn.disabled
            }));

            const inputs = Array.from(document.querySelectorAll('input, textarea, select')).map(el => ({
              type: el.type || el.tagName.toLowerCase(),
              name: el.name,
              id: el.id,
              placeholder: el.placeholder,
              value: el.type !== 'password' ? el.value : '***'
            }));

            return {
              url: window.location.href,
              title: document.title,
              forms,
              links,
              buttons,
              inputs
            };
          })()
        `);
        api.sendPageStateResponse({ success: true, state });
      } catch (error) {
        api.sendPageStateResponse({ success: false, error: error.message });
      }
    });

    // Wait for element
    api.onWaitForElement(async ({ selector, timeout = 10000 }) => {
      const webview = getActiveWebview();
      if (!webview) {
        api.sendWaitResponse({ success: false, error: 'No active webview' });
        return;
      }
      try {
        const safeSelector = JSON.stringify(selector);
        const safeTimeout = Number.isFinite(timeout) ? timeout : 10000;
        const result = await webview.executeJavaScript(`
          new Promise((resolve) => {
            const startTime = Date.now();
            const check = () => {
              const element = document.querySelector(${safeSelector});
              if (element) {
                resolve({ success: true, found: true });
              } else if (Date.now() - startTime > ${safeTimeout}) {
                resolve({ success: false, error: 'Timeout waiting for element' });
              } else {
                requestAnimationFrame(check);
              }
            };
            check();
          })
        `);
        api.sendWaitResponse(result);
      } catch (error) {
        api.sendWaitResponse({ success: false, error: error.message });
      }
    });

    // Scroll
    api.onScroll(async ({ x, y, selector }) => {
      const webview = getActiveWebview();
      if (!webview) {
        api.sendScrollResponse({ success: false, error: 'No active webview' });
        return;
      }
      try {
        let result;
        if (selector) {
          const safeSelector = JSON.stringify(selector);
          result = await webview.executeJavaScript(`
            (function() {
              const element = document.querySelector(${safeSelector});
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return { success: true };
              }
              return { success: false, error: 'Element not found' };
            })()
          `);
        } else {
          const safeX = Number.isFinite(x) ? x : 0;
          const safeY = Number.isFinite(y) ? y : 0;
          result = await webview.executeJavaScript(`
            (function() {
              window.scrollTo({ top: ${safeY}, left: ${safeX}, behavior: 'smooth' });
              return { success: true };
            })()
          `);
        }
        api.sendScrollResponse(result);
      } catch (error) {
        api.sendScrollResponse({ success: false, error: error.message });
      }
    });

    // Enhanced screenshot - viewport with options
    api.onScreenshotViewport(async (data) => {
      const { requestId, format = 'png', quality = 1.0 } = data;
      const webview = getActiveWebview();

      if (!webview) {
        api.sendScreenshotViewportResponse({
          requestId,
          success: false,
          error: 'No active webview'
        });
        return;
      }

      try {
        // Ensure webview has valid dimensions
        const bounds = webview.getBoundingClientRect();
        if (bounds.width === 0 || bounds.height === 0) {
          api.sendScreenshotViewportResponse({
            requestId,
            success: false,
            error: 'Webview has zero dimensions - cannot capture screenshot'
          });
          return;
        }

        const image = await webview.capturePage();

        // Check if the captured image is empty (common in headless mode)
        if (image.isEmpty()) {
          api.sendScreenshotViewportResponse({
            requestId,
            success: false,
            error: 'Webview capturePage returned empty image - likely headless mode issue',
            needsMainProcessCapture: true
          });
          return;
        }

        // Get data URL in requested format
        let dataUrl;
        if (format === 'jpeg' || format === 'jpg') {
          dataUrl = image.toDataURL({ scaleFactor: 1.0 });
          // For JPEG we need to re-encode via canvas if quality matters
          // For now, just use PNG
          dataUrl = image.toDataURL();
        } else {
          dataUrl = image.toDataURL();
        }

        // Verify we got actual data
        if (dataUrl.length < 100) {
          api.sendScreenshotViewportResponse({
            requestId,
            success: false,
            error: 'Screenshot capture returned minimal data'
          });
          return;
        }

        api.sendScreenshotViewportResponse({
          requestId,
          success: true,
          data: dataUrl,
          format: 'png',
          width: image.getSize().width,
          height: image.getSize().height
        });
      } catch (error) {
        api.sendScreenshotViewportResponse({
          requestId,
          success: false,
          error: error.message
        });
      }
    });

    // Enhanced screenshot - full page (scroll and stitch)
    api.onScreenshotFullPage(async (data) => {
      const { requestId, format = 'png', quality = 1.0, scrollDelay = 100, maxHeight = 32000 } = data;
      const webview = getActiveWebview();

      if (!webview) {
        api.sendScreenshotFullPageResponse({
          requestId,
          success: false,
          error: 'No active webview'
        });
        return;
      }

      try {
        // Get page dimensions
        const dimensions = await webview.executeJavaScript(`
          ({
            scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
            scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
            currentScrollY: window.scrollY
          })
        `);

        // For now, just capture viewport in headless mode
        // Full page stitching requires more complex implementation
        const image = await webview.capturePage();

        if (image.isEmpty()) {
          api.sendScreenshotFullPageResponse({
            requestId,
            success: false,
            error: 'Screenshot capture returned empty image in headless mode',
            needsMainProcessCapture: true
          });
          return;
        }

        const dataUrl = image.toDataURL();

        api.sendScreenshotFullPageResponse({
          requestId,
          success: true,
          data: dataUrl,
          format: 'png',
          width: image.getSize().width,
          height: image.getSize().height,
          pageHeight: dimensions.scrollHeight,
          pageWidth: dimensions.scrollWidth,
          note: 'Captured viewport only - full page stitching not available in headless mode'
        });
      } catch (error) {
        api.sendScreenshotFullPageResponse({
          requestId,
          success: false,
          error: error.message
        });
      }
    });

    // Enhanced screenshot - element
    api.onScreenshotElement(async (data) => {
      const { requestId, selector, format = 'png', quality = 1.0, padding = 0 } = data;
      const webview = getActiveWebview();

      if (!webview) {
        api.sendScreenshotElementResponse({
          requestId,
          success: false,
          error: 'No active webview'
        });
        return;
      }

      if (!selector) {
        api.sendScreenshotElementResponse({
          requestId,
          success: false,
          error: 'Selector is required'
        });
        return;
      }

      try {
        // Get element bounds
        const safeSelector = JSON.stringify(selector);
        const elementBounds = await webview.executeJavaScript(`
          (function() {
            const element = document.querySelector(${safeSelector});
            if (!element) {
              return null;
            }
            const rect = element.getBoundingClientRect();
            return {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            };
          })()
        `);

        if (!elementBounds) {
          api.sendScreenshotElementResponse({
            requestId,
            success: false,
            error: 'Element not found: ' + selector
          });
          return;
        }

        // Capture the page and crop to element bounds
        const image = await webview.capturePage({
          x: Math.max(0, Math.floor(elementBounds.x - padding)),
          y: Math.max(0, Math.floor(elementBounds.y - padding)),
          width: Math.ceil(elementBounds.width + padding * 2),
          height: Math.ceil(elementBounds.height + padding * 2)
        });

        if (image.isEmpty()) {
          api.sendScreenshotElementResponse({
            requestId,
            success: false,
            error: 'Screenshot capture returned empty image',
            needsMainProcessCapture: true
          });
          return;
        }

        const dataUrl = image.toDataURL();

        api.sendScreenshotElementResponse({
          requestId,
          success: true,
          data: dataUrl,
          format: 'png',
          width: image.getSize().width,
          height: image.getSize().height,
          elementBounds
        });
      } catch (error) {
        api.sendScreenshotElementResponse({
          requestId,
          success: false,
          error: error.message
        });
      }
    });

    // Enhanced screenshot - area (specific coordinates)
    api.onScreenshotArea(async (data) => {
      const { requestId, area, format = 'png', quality = 1.0 } = data;
      const webview = getActiveWebview();

      if (!webview) {
        api.sendScreenshotAreaResponse({
          requestId,
          success: false,
          error: 'No active webview'
        });
        return;
      }

      if (!area || typeof area.x !== 'number' || typeof area.y !== 'number' ||
          typeof area.width !== 'number' || typeof area.height !== 'number') {
        api.sendScreenshotAreaResponse({
          requestId,
          success: false,
          error: 'Invalid area coordinates. Required: x, y, width, height'
        });
        return;
      }

      try {
        const image = await webview.capturePage({
          x: Math.max(0, Math.floor(area.x)),
          y: Math.max(0, Math.floor(area.y)),
          width: Math.ceil(area.width),
          height: Math.ceil(area.height)
        });

        if (image.isEmpty()) {
          api.sendScreenshotAreaResponse({
            requestId,
            success: false,
            error: 'Screenshot capture returned empty image',
            needsMainProcessCapture: true
          });
          return;
        }

        const dataUrl = image.toDataURL();

        api.sendScreenshotAreaResponse({
          requestId,
          success: true,
          data: dataUrl,
          format: 'png',
          width: image.getSize().width,
          height: image.getSize().height
        });
      } catch (error) {
        api.sendScreenshotAreaResponse({
          requestId,
          success: false,
          error: error.message
        });
      }
    });
  }

  // ==========================================
  // Download Management
  // ==========================================

  // Download state tracking
  let activeDownloads = new Map();

  function setupDownloadListeners() {
    const api = window.electronAPI;
    if (!api) return;

    // Download event listeners
    api.onDownloadStarted((download) => {
      activeDownloads.set(download.id, download);
      updateDownloadIndicator();
      showDownloadNotification('Download Started', download.filename, 'info');
    });

    api.onDownloadProgress((download) => {
      activeDownloads.set(download.id, download);
      updateDownloadIndicator();
    });

    api.onDownloadCompleted((download) => {
      activeDownloads.delete(download.id);
      updateDownloadIndicator();
      showDownloadNotification('Download Completed', download.filename, 'success');
    });

    api.onDownloadFailed((download) => {
      activeDownloads.delete(download.id);
      updateDownloadIndicator();
      showDownloadNotification('Download Failed', download.filename + ': ' + (download.error || 'Unknown error'), 'error');
    });

    api.onDownloadCancelled((download) => {
      activeDownloads.delete(download.id);
      updateDownloadIndicator();
      showDownloadNotification('Download Cancelled', download.filename, 'info');
    });
  }

  function updateDownloadIndicator() {
    const indicator = document.getElementById('download-indicator');
    const statusText = document.getElementById('download-status-text');
    const progressFill = document.getElementById('download-progress-fill');

    if (!indicator || !statusText || !progressFill) return;

    const count = activeDownloads.size;

    if (count === 0) {
      indicator.style.display = 'none';
      return;
    }

    indicator.style.display = 'flex';

    // Calculate total progress
    let totalProgress = 0;
    let activeCount = 0;

    activeDownloads.forEach((download) => {
      if (download.progress !== undefined) {
        totalProgress += download.progress;
        activeCount++;
      }
    });

    const avgProgress = activeCount > 0 ? Math.round(totalProgress / activeCount) : 0;

    statusText.textContent = count === 1
      ? `Downloading: ${avgProgress}%`
      : `${count} downloads: ${avgProgress}%`;

    progressFill.style.width = avgProgress + '%';
  }

  function showDownloadNotification(title, message, type = 'info') {
    // Remove existing notification if any
    const existingNotification = document.querySelector('.download-notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `download-notification ${type}`;
    notification.innerHTML = `
      <div class="download-notification-title">${escapeHtml(title)}</div>
      <div class="download-notification-filename">${escapeHtml(message)}</div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }
    }, 4000);
  }

  // ==========================================
  // Poll WebSocket status
  // ==========================================

  async function pollWebSocketStatus() {
    const api = window.electronAPI;
    if (api) {
      try {
        const status = await api.getWsStatus();
        updateWebSocketStatus(status);
      } catch (error) {
        updateWebSocketStatus(null);
      }
    }
    setTimeout(pollWebSocketStatus, 2000);
  }

  // Start initialization
  init();
});
