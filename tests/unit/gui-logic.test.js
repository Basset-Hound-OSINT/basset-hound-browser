/**
 * Basset Hound Browser - GUI logic unit tests
 *
 * Merge gate for the opt-in GUI toggle (Feature B). smoke:mvp is headless and cannot
 * render a real window, so the extracted non-DOM logic in renderer/gui-logic.js is
 * verified here instead: toolbar actions -> WS command frames, URL resolution, and the
 * connection-state reducer.
 *
 * @module tests/unit/gui-logic.test.js
 */

const GuiLogic = require('../../renderer/gui-logic');
const {
  resolveNavigationUrl,
  toolbarActionToCommand,
  connectionStateReducer,
  CONNECTION_STATES,
  DEFAULT_HOME
} = GuiLogic;

describe('gui-logic module', () => {
  it('exposes the expected pure helpers and constants', () => {
    expect(typeof resolveNavigationUrl).toBe('function');
    expect(typeof toolbarActionToCommand).toBe('function');
    expect(typeof connectionStateReducer).toBe('function');
    expect(DEFAULT_HOME).toBe('https://www.google.com');
    expect(CONNECTION_STATES).toEqual({
      DISCONNECTED: 'disconnected',
      CONNECTING: 'connecting',
      CONNECTED: 'connected'
    });
  });

  it('registers itself on globalThis for the renderer', () => {
    expect(globalThis.GuiLogic).toBeDefined();
    expect(globalThis.GuiLogic.resolveNavigationUrl).toBe(resolveNavigationUrl);
  });
});

describe('resolveNavigationUrl', () => {
  it('passes through supported schemes verbatim', () => {
    const passthrough = [
      'http://example.com',
      'https://example.com/path?q=1',
      'about:blank',
      'data:text/html,<h1>hi</h1>',
      'file:///etc/hosts',
      'blob:https://x/abc',
      'view-source:https://example.com'
    ];
    for (const url of passthrough) {
      expect(resolveNavigationUrl(url)).toBe(url);
    }
  });

  it('prefixes bare hostnames with https://', () => {
    expect(resolveNavigationUrl('example.com')).toBe('https://example.com');
    expect(resolveNavigationUrl('sub.domain.co.uk/page')).toBe('https://sub.domain.co.uk/page');
  });

  it('turns free text into a Google search', () => {
    expect(resolveNavigationUrl('basset hound')).toBe(
      'https://www.google.com/search?q=basset%20hound'
    );
    // No dot, no scheme -> search
    expect(resolveNavigationUrl('hello')).toBe(
      'https://www.google.com/search?q=hello'
    );
  });

  it('returns falsy input unchanged', () => {
    expect(resolveNavigationUrl('')).toBe('');
    expect(resolveNavigationUrl(undefined)).toBeUndefined();
    expect(resolveNavigationUrl(null)).toBeNull();
  });
});

describe('toolbarActionToCommand', () => {
  it('maps navigate/go to a navigate frame with a resolved url', () => {
    expect(toolbarActionToCommand('navigate', { url: 'example.com' })).toEqual({
      command: 'navigate',
      url: 'https://example.com'
    });
    expect(toolbarActionToCommand('go', { url: 'https://a.test' })).toEqual({
      command: 'navigate',
      url: 'https://a.test'
    });
  });

  it('maps home to a navigate frame at the default/overridden home', () => {
    expect(toolbarActionToCommand('home')).toEqual({
      command: 'navigate',
      url: DEFAULT_HOME
    });
    expect(toolbarActionToCommand('home', { homeUrl: 'https://start.test' })).toEqual({
      command: 'navigate',
      url: 'https://start.test'
    });
  });

  it('maps back to navigate_back', () => {
    expect(toolbarActionToCommand('back')).toEqual({ command: 'navigate_back' });
  });

  it('maps reload/refresh to reload_page', () => {
    expect(toolbarActionToCommand('reload')).toEqual({ command: 'reload_page' });
    expect(toolbarActionToCommand('refresh')).toEqual({ command: 'reload_page' });
  });

  it('returns null for local-only or unknown actions', () => {
    expect(toolbarActionToCommand('forward')).toBeNull();
    expect(toolbarActionToCommand('unknown-action')).toBeNull();
  });
});

describe('connectionStateReducer', () => {
  it('defaults to disconnected', () => {
    expect(connectionStateReducer(undefined, { type: 'noop' })).toBe(
      CONNECTION_STATES.DISCONNECTED
    );
  });

  it('transitions to connecting', () => {
    expect(
      connectionStateReducer(CONNECTION_STATES.DISCONNECTED, { type: 'connecting' })
    ).toBe(CONNECTION_STATES.CONNECTING);
  });

  it('is connected only when a client is attached', () => {
    expect(
      connectionStateReducer(CONNECTION_STATES.CONNECTING, {
        type: 'status',
        status: { clients: 1 }
      })
    ).toBe(CONNECTION_STATES.CONNECTED);

    expect(
      connectionStateReducer(CONNECTION_STATES.CONNECTED, {
        type: 'status',
        status: { clients: 0 }
      })
    ).toBe(CONNECTION_STATES.DISCONNECTED);

    // Missing/invalid status -> disconnected
    expect(
      connectionStateReducer(CONNECTION_STATES.CONNECTED, { type: 'status' })
    ).toBe(CONNECTION_STATES.DISCONNECTED);
  });

  it('drops to disconnected on error/disconnect', () => {
    expect(
      connectionStateReducer(CONNECTION_STATES.CONNECTED, { type: 'error' })
    ).toBe(CONNECTION_STATES.DISCONNECTED);
    expect(
      connectionStateReducer(CONNECTION_STATES.CONNECTED, { type: 'disconnect' })
    ).toBe(CONNECTION_STATES.DISCONNECTED);
  });

  it('keeps the current state for unknown events', () => {
    expect(
      connectionStateReducer(CONNECTION_STATES.CONNECTED, { type: 'weird' })
    ).toBe(CONNECTION_STATES.CONNECTED);
    expect(connectionStateReducer(CONNECTION_STATES.CONNECTING, null)).toBe(
      CONNECTION_STATES.CONNECTING
    );
  });
});
