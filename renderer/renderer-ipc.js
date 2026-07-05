// Basset Hound Browser - Renderer IPC command handlers
//
// The bulk of setupIPCListeners() extracted from renderer.js: the tab/session events
// from the main process plus the WebSocket-driven command handlers (navigate, get URL,
// execute JS, get content, storage ops, wait-for-Cloudflare, click, fill, page-state,
// wait-for-element, scroll). Screenshot capture lives in renderer/renderer-screenshots.js.
//
// The whole renderer is ONE DOMContentLoaded closure, so these handlers cannot be moved
// out by `require` (they'd lose the closure scope). Instead they receive an explicit
// `ctx` object (same convention as renderer/gui-logic.js) with the DOM refs, tab-map,
// tab operations and shared helpers they need. Mutable state that is reassigned in the
// closure (activeTabId) is read live via ctx.getActiveTabId() so this module always sees
// the current active tab.
//
// Loaded via a <script> tag in index.html BEFORE renderer.js and registered on
// globalThis.RendererIPC; renderer.js's init() builds ctx and calls setup(ctx).

(function () {
  'use strict';

  function setup(ctx) {
    const {
      api,
      tabs,
      createTab,
      switchToTab,
      updateTab,
      getActiveWebview,
      getActiveTabId,
      resolveNavigationUrl,
      showLoading,
      urlInput,
      sessionName
    } = ctx;

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
      if (tabId !== getActiveTabId() && tabs.has(tabId)) {
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

    // Navigate command (for WebSocket).
    // Drive the active webview to the requested URL and emit navigation-complete tied to
    // THIS specific load. Using webview.loadURL() (promise-based) correlates completion to
    // the navigation we started, so a stray/background load can never resolve the caller's
    // navigate command early. Always emit a completion so the server's IPC never hangs.
    api.onNavigateWebview(async (url) => {
      const webview = getActiveWebview();
      const emit = (u, extra) => {
        if (window.electronAPI) {
          window.electronAPI.emitNavigationComplete(Object.assign({
            tabId: getActiveTabId(),
            url: u,
            timestamp: Date.now()
          }, extra || {}));
        }
      };

      if (!webview) {
        emit('about:blank', { error: 'No active webview' });
        return;
      }

      const target = resolveNavigationUrl(url);
      showLoading(true);
      urlInput.value = target;

      try {
        await webview.loadURL(target);
      } catch (e) {
        // ERR_ABORTED (-3) means the load was superseded by a newer navigation; not an error.
        if (!/ERR_ABORTED|-3/.test(e && e.message ? e.message : '')) {
          console.error('[Navigate] loadURL failed:', e && e.message);
        }
      } finally {
        showLoading(false);
        let current = target;
        try { current = webview.getURL() || target; } catch (e2) { /* keep target */ }
        emit(current);
      }
    });

    // Get webview URL
    api.onGetWebviewUrl(async () => {
      const webview = getActiveWebview();
      if (!webview) {
        api.sendWebviewUrlResponse('about:blank');
        return;
      }
      // webview.getURL() can throw if the guest WebContents is not yet attached;
      // never leave the request unanswered (that would hang the caller's IPC).
      try {
        const url = webview.getURL();
        if (url) {
          api.sendWebviewUrlResponse(url);
          return;
        }
      } catch (e) {
        // fall through to executeJavaScript fallback
      }
      try {
        const href = await webview.executeJavaScript('window.location.href');
        api.sendWebviewUrlResponse(href || 'about:blank');
      } catch (e2) {
        api.sendWebviewUrlResponse('about:blank');
      }
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
        const result = await webview.executeJavaScript(`
          ({
            html: document.documentElement.outerHTML,
            text: document.body.innerText,
            title: document.title,
            url: window.location.href
          })
        `);
        api.sendPageContentResponse({
          success: true,
          content: result.html,
          html: result.html,
          text: result.text,
          title: result.title,
          url: result.url
        });
      } catch (error) {
        api.sendPageContentResponse({ success: false, error: error.message });
      }
    });

    // Execute storage operations (localStorage / sessionStorage / IndexedDB) in the
    // active <webview> guest. StorageManager (storage/manager.js) sends
    // 'execute-storage-operation' to the renderer; without this consumer that IPC was
    // never answered, so every storage command hung for 30s and never reached the page.
    // Mirrors onGetPageContent: route through getActiveWebview(), not the browser shell.
    if (typeof api.onExecuteStorageOperation === 'function') {
      api.onExecuteStorageOperation(async (data) => {
        const { operationId, script } = data || {};
        const webview = getActiveWebview();
        if (!webview) {
          api.sendStorageOperationResponse(operationId, null, 'No active webview');
          return;
        }
        try {
          // webview.executeJavaScript resolves the value (and awaits a returned Promise,
          // as the IndexedDB storage scripts rely on).
          const result = await webview.executeJavaScript(script);
          api.sendStorageOperationResponse(operationId, result, null);
        } catch (error) {
          api.sendStorageOperationResponse(operationId, null, error.message);
        }
      });
    }

    // P2-004: Wait for Cloudflare challenge to complete
    api.onWaitForCloudflare(async (options) => {
      const webview = getActiveWebview();
      if (!webview) {
        api.sendCloudflareResolvedResponse({ success: false, error: 'No active webview' });
        return;
      }

      const timeout = (options && options.timeout) || 10000;
      const startTime = Date.now();
      let lastHtml = '';
      let resolved = false;

      try {
        // Poll for Cloudflare challenge to complete
        while (Date.now() - startTime < timeout && !resolved) {
          try {
            const result = await webview.executeJavaScript(`
              ({
                html: document.documentElement.outerHTML,
                text: document.body.innerText,
                title: document.title,
                url: window.location.href
              })
            `);

            const htmlLower = result.html.toLowerCase();

            // Check if Cloudflare challenge markers are gone
            const cfMarkers = ['just a moment', 'checking your browser', 'challenge page', '__cf_chl', 'jsfiddle_loader'];
            let hasChallengeMarkers = false;

            for (const marker of cfMarkers) {
              if (htmlLower.includes(marker)) {
                hasChallengeMarkers = true;
                break;
              }
            }

            // If no challenge markers and content changed, challenge is complete
            if (!hasChallengeMarkers && result.html !== lastHtml && result.html.length > 500) {
              resolved = true;
              api.sendCloudflareResolvedResponse({
                success: true,
                content: result.html,
                html: result.html,
                text: result.text,
                title: result.title,
                url: result.url
              });
              return;
            }

            lastHtml = result.html;

            // Wait before next check
            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (checkError) {
            // Ignore check errors and retry
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // Timeout reached, return whatever we have
        try {
          const finalResult = await webview.executeJavaScript(`
            ({
              html: document.documentElement.outerHTML,
              text: document.body.innerText,
              title: document.title,
              url: window.location.href
            })
          `);
          api.sendCloudflareResolvedResponse({
            success: true,
            content: finalResult.html,
            html: finalResult.html,
            text: finalResult.text,
            title: finalResult.title,
            url: finalResult.url,
            timeout: true
          });
        } catch (finalError) {
          api.sendCloudflareResolvedResponse({
            success: false,
            error: `Cloudflare wait timeout: ${finalError.message}`
          });
        }

      } catch (error) {
        api.sendCloudflareResolvedResponse({ success: false, error: error.message });
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
  }

  const RendererIPC = { setup };

  // CommonJS export (parity with renderer/gui-logic.js; harmless in the renderer).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RendererIPC;
  }
  // Browser/global registration for the <script>-tag load path.
  if (typeof globalThis !== 'undefined') {
    globalThis.RendererIPC = RendererIPC;
  }
})();
