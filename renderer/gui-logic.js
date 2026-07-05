// Basset Hound Browser - GUI non-DOM logic
//
// Pure, DOM-free helpers extracted from renderer.js so they can be unit-tested
// without a real browser window (smoke:mvp is headless and cannot render the GUI).
// This module is the merge-gate surface: see tests/unit/gui-logic.test.js.
//
// Loaded two ways (UMD, mirrors renderer/update-manager.js):
//   - jest / Node:   require('./gui-logic.js')      -> module.exports
//   - Electron renderer: import('./gui-logic.js')    -> registers globalThis.GuiLogic
// It contains NO DOM access, NO Electron access, and NO side effects beyond the
// export/registration below, so it is safe to load in either environment.

(function () {
  'use strict';

  // Default home / new-tab target. Kept here so both the toolbar "home" action and
  // the URL resolver agree on one value.
  const DEFAULT_HOME = 'https://www.google.com';

  // Schemes we navigate to verbatim (notably data:/file: used for deterministic
  // capture and testing). Anything else that looks like a host gets https://, and
  // free text becomes a Google search.
  const PASSTHROUGH_SCHEMES = ['http://', 'https://', 'about:', 'data:', 'file:', 'blob:', 'view-source:'];

  /**
   * Resolve a user/API-supplied navigation target into a concrete URL.
   * Mirrors the behaviour documented in renderer.js's navigateTo().
   * @param {string} url raw address-bar input
   * @returns {string} concrete navigable URL (unchanged for falsy input)
   */
  function resolveNavigationUrl(url) {
    if (!url) {
      return url;
    }
    const hasScheme = PASSTHROUGH_SCHEMES.some((scheme) => url.startsWith(scheme));
    if (!hasScheme) {
      if (url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
      }
    }
    return url;
  }

  /**
   * Map a toolbar action into the WebSocket command frame the control surface
   * understands. Actions without a server-side command (e.g. forward, which the
   * <webview> handles locally) return null.
   *
   * Command names match the live WS API: 'navigate', 'navigate_back', 'reload_page'.
   * @param {string} action  one of: navigate|go|home|back|reload|refresh|forward
   * @param {Object} [payload] { url?, homeUrl? }
   * @returns {Object|null} WS command frame, or null for local-only actions
   */
  function toolbarActionToCommand(action, payload = {}) {
    switch (action) {
      case 'navigate':
      case 'go':
        return { command: 'navigate', url: resolveNavigationUrl(payload.url) };
      case 'home':
        return { command: 'navigate', url: payload.homeUrl || DEFAULT_HOME };
      case 'back':
        return { command: 'navigate_back' };
      case 'reload':
      case 'refresh':
        return { command: 'reload_page' };
      // 'forward' has no server command; the webview handles it locally.
      default:
        return null;
    }
  }

  // Connection lifecycle states surfaced in the status bar.
  const CONNECTION_STATES = Object.freeze({
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected'
  });

  /**
   * Pure reducer for the WebSocket connection indicator.
   * Mirrors updateWebSocketStatus(): "connected" only when a client is attached.
   * @param {string} state   current state
   * @param {Object} event   { type: 'connecting'|'status'|'error'|'disconnect', status? }
   * @returns {string} next state
   */
  function connectionStateReducer(state = CONNECTION_STATES.DISCONNECTED, event) {
    switch (event && event.type) {
      case 'connecting':
        return CONNECTION_STATES.CONNECTING;
      case 'status': {
        const clients = event.status && typeof event.status.clients === 'number'
          ? event.status.clients
          : 0;
        return clients > 0 ? CONNECTION_STATES.CONNECTED : CONNECTION_STATES.DISCONNECTED;
      }
      case 'error':
      case 'disconnect':
        return CONNECTION_STATES.DISCONNECTED;
      default:
        return state;
    }
  }

  const GuiLogic = {
    DEFAULT_HOME,
    PASSTHROUGH_SCHEMES,
    CONNECTION_STATES,
    resolveNavigationUrl,
    toolbarActionToCommand,
    connectionStateReducer
  };

  // CommonJS export (jest / Node).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GuiLogic;
  }

  // Browser/global registration (Electron renderer via import(), or a <script> tag).
  if (typeof globalThis !== 'undefined') {
    globalThis.GuiLogic = GuiLogic;
  }
})();
