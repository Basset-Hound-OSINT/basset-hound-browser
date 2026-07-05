// Basset Hound Browser - Renderer Process
// Handles navigation, UI updates, tab management, and communication with main process

// Import shared, unit-tested GUI logic (renderer/gui-logic.js; tests/unit/gui-logic.test.js).
// Registers globalThis.GuiLogic for reuse; safe no-op if unavailable.
import('./gui-logic.js').catch(() => {});

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
  const tabs = new Map(); // Map of tabId -> { element, webview, data }
  let activeTabId = null;
  let isLoading = false;
  let evasionScript = '';

  // Initialize
  async function init() {
    // Prefer the coherent evasion script from the main process: it derives navigator.platform
    // from the SAME clean Chrome UA applied to session.defaultSession, so the injected identity
    // (platform / plugins / window.chrome) stays consistent with the UA the page and the wire
    // show. Fall back to the preload's built-in script only if that IPC path is unavailable.
    try {
      if (window.electronAPI && typeof window.electronAPI.getEvasionScript === 'function') {
        evasionScript = await window.electronAPI.getEvasionScript();
      }
    } catch (e) {
      // fall through to the preload fallback below
    }
    if (!evasionScript && window.evasionHelpers) {
      evasionScript = window.evasionHelpers.getWebviewEvasionScript();
    }

    // Build the shared context handed to the extracted renderer modules (ctx-passing
    // pattern; the whole renderer is one DOMContentLoaded closure, so cooperating scripts
    // receive DOM refs + live-state getters + shared helpers instead of capturing the
    // closure). See renderer/renderer-ipc.js, renderer-screenshots.js, renderer-downloads.js.
    // Reassigned scalars (activeTabId) are read live via a getter so modules see current state.
    const ctx = {
      api: window.electronAPI,
      tabs,
      createTab,
      switchToTab,
      updateTab,
      getActiveWebview,
      getActiveTabId: () => activeTabId,
      resolveNavigationUrl,
      showLoading,
      escapeHtml,
      urlInput,
      sessionName
    };

    // Setup event listeners
    setupNavigationListeners();
    setupTabListeners();
    if (globalThis.RendererIPC && typeof globalThis.RendererIPC.setup === 'function') {
      globalThis.RendererIPC.setup(ctx);
    }
    if (globalThis.RendererScreenshots && typeof globalThis.RendererScreenshots.setup === 'function') {
      globalThis.RendererScreenshots.setup(ctx);
    }
    if (globalThis.RendererDownloads && typeof globalThis.RendererDownloads.setup === 'function') {
      globalThis.RendererDownloads.setup(ctx);
    }

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
    if (activeTabId === tabId) {
      return;
    }

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
    if (!tabs.has(tabId)) {
      return;
    }

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
    if (!tabs.has(tabId)) {
      return;
    }

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
        if (faviconEl) {
          faviconEl.style.display = 'none';
        }
      } else {
        if (loadingEl) {
          loadingEl.remove();
        }
        if (faviconEl) {
          faviconEl.style.display = '';
        }
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

  // Resolve a user/API-supplied navigation target into a concrete URL.
  // URLs that already carry an explicit scheme we support directly
  // (http/https/about/data/file/blob/view-source) are passed through unchanged —
  // notably `data:` URLs used for deterministic capture/testing. Bare hostnames get
  // https://, and free text becomes a Google search.
  function resolveNavigationUrl(url) {
    if (!url) {
      return url;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://') &&
        !url.startsWith('about:') && !url.startsWith('data:') &&
        !url.startsWith('file:') && !url.startsWith('blob:') &&
        !url.startsWith('view-source:')) {
      if (url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
      }
    }
    return url;
  }

  function navigateTo(url) {
    const webview = getActiveWebview();
    if (!webview) {
      return;
    }

    url = resolveNavigationUrl(url);

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
          if (activeTabId) {
            closeTab(activeTabId);
          }
        } else if (e.key === 'Tab' && e.shiftKey) {
          e.preventDefault();
          if (window.electronAPI) {
            window.electronAPI.previousTab();
          }
        } else if (e.key === 'Tab') {
          e.preventDefault();
          if (window.electronAPI) {
            window.electronAPI.nextTab();
          }
        } else if (e.key >= '1' && e.key <= '9') {
          e.preventDefault();
          const tabIndex = parseInt(e.key);
          const tabIds = Array.from(tabs.keys());
          if (e.key === '9') {
            if (tabIds.length > 0) {
              switchToTab(tabIds[tabIds.length - 1]);
            }
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
      // NOTE: navigation-complete is intentionally NOT emitted here. It used to fire on
      // every did-navigate (including background/startup loads), which let a WebSocket
      // `navigate` command resolve on a stale, unrelated navigation. Completion is now
      // emitted only by the dedicated onNavigateWebview handler, tied to the specific
      // load it initiated (see onNavigateWebview in renderer/renderer-ipc.js).
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
    if (!webview) {
      return;
    }
    // Re-fetch the coherent script from main per injection so a runtime `set_user_agent`
    // keeps navigator.platform coherent with the new UA. Main memoizes it per active UA, so
    // the per-session fingerprint stays stable and this call is cheap. Fall back to the cached
    // script (from init) if the IPC path is momentarily unavailable.
    let script = evasionScript;
    try {
      if (window.electronAPI && typeof window.electronAPI.getEvasionScript === 'function') {
        const fresh = await window.electronAPI.getEvasionScript();
        if (fresh) {
          script = fresh;
        }
      }
    } catch (e) {
      // use the cached script
    }
    if (script) {
      try {
        await webview.executeJavaScript(script);
        console.log('Evasion script injected successfully');
      } catch (error) {
        console.error('Failed to inject evasion script:', error);
      }
    }
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
