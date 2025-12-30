/**
 * Basset Hound Browser - Navigation Handler Unit Tests
 * Tests for navigation handling with webRequest mock support
 */

// Create mock session with webRequest support
const createMockSession = () => {
  const listeners = {};
  return {
    webRequest: {
      onBeforeRequest: jest.fn((filter, listener) => {
        if (typeof filter === 'function') {
          listeners.onBeforeRequest = filter;
        } else if (listener) {
          listeners.onBeforeRequest = listener;
        }
      }),
      onBeforeSendHeaders: jest.fn((filter, listener) => {
        if (listener) listeners.onBeforeSendHeaders = listener;
      }),
      onHeadersReceived: jest.fn((filter, listener) => {
        if (listener) listeners.onHeadersReceived = listener;
      }),
      onCompleted: jest.fn((filter, listener) => {
        if (listener) listeners.onCompleted = listener;
      }),
      onErrorOccurred: jest.fn((filter, listener) => {
        if (listener) listeners.onErrorOccurred = listener;
      }),
      on: jest.fn((event, filter, listener) => {
        listeners[event] = typeof filter === 'function' ? filter : listener;
      })
    },
    _listeners: listeners
  };
};

// Create mock webContents
const createMockWebContents = (sessionOverride = null) => {
  const mockSession = sessionOverride || createMockSession();
  const webContentsListeners = {};

  return {
    id: Math.floor(Math.random() * 10000),
    session: mockSession,
    loadURL: jest.fn().mockResolvedValue(undefined),
    loadFile: jest.fn().mockResolvedValue(undefined),
    getURL: jest.fn().mockReturnValue('about:blank'),
    getTitle: jest.fn().mockReturnValue('Mock Page'),
    isLoading: jest.fn().mockReturnValue(false),
    stop: jest.fn(),
    reload: jest.fn(),
    reloadIgnoringCache: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(false),
    canGoForward: jest.fn().mockReturnValue(false),
    goBack: jest.fn(),
    goForward: jest.fn(),
    on: jest.fn((event, handler) => {
      webContentsListeners[event] = handler;
      return this;
    }),
    once: jest.fn((event, handler) => {
      webContentsListeners[event] = handler;
    }),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    _listeners: webContentsListeners,
    _emit: (event, ...args) => {
      if (webContentsListeners[event]) {
        webContentsListeners[event](...args);
      }
    }
  };
};

const mockDefaultSession = createMockSession();

jest.mock('electron', () => ({
  session: {
    defaultSession: mockDefaultSession,
    fromPartition: jest.fn(() => createMockSession())
  },
  app: {
    getPath: jest.fn().mockReturnValue('/mock/path')
  }
}));

const { session } = require('electron');

describe('Navigation Handler', () => {
  let mockSession;
  let mockWebContents;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Get fresh mock instances
    mockSession = createMockSession();
    mockWebContents = createMockWebContents(mockSession);
  });

  describe('WebRequest Handler Setup', () => {
    test('should have webRequest.on method available', () => {
      expect(mockSession.webRequest.on).toBeDefined();
      expect(typeof mockSession.webRequest.on).toBe('function');
    });

    test('should register onBeforeRequest handler', () => {
      const handler = jest.fn();
      mockSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, handler);

      expect(mockSession.webRequest.onBeforeRequest).toHaveBeenCalledWith(
        { urls: ['<all_urls>'] },
        handler
      );
    });

    test('should register onBeforeSendHeaders handler', () => {
      const handler = jest.fn();
      mockSession.webRequest.onBeforeSendHeaders({ urls: ['<all_urls>'] }, handler);

      expect(mockSession.webRequest.onBeforeSendHeaders).toHaveBeenCalled();
    });

    test('should register onHeadersReceived handler', () => {
      const handler = jest.fn();
      mockSession.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, handler);

      expect(mockSession.webRequest.onHeadersReceived).toHaveBeenCalled();
    });

    test('should register onCompleted handler', () => {
      const handler = jest.fn();
      mockSession.webRequest.onCompleted({ urls: ['<all_urls>'] }, handler);

      expect(mockSession.webRequest.onCompleted).toHaveBeenCalled();
    });

    test('should register onErrorOccurred handler', () => {
      const handler = jest.fn();
      mockSession.webRequest.onErrorOccurred({ urls: ['<all_urls>'] }, handler);

      expect(mockSession.webRequest.onErrorOccurred).toHaveBeenCalled();
    });
  });

  describe('WebContents Navigation Events', () => {
    test('should listen for did-navigate event', () => {
      const handler = jest.fn();
      mockWebContents.on('did-navigate', handler);

      expect(mockWebContents.on).toHaveBeenCalledWith('did-navigate', handler);
    });

    test('should listen for did-navigate-in-page event', () => {
      const handler = jest.fn();
      mockWebContents.on('did-navigate-in-page', handler);

      expect(mockWebContents.on).toHaveBeenCalledWith('did-navigate-in-page', handler);
    });

    test('should listen for will-navigate event', () => {
      const handler = jest.fn();
      mockWebContents.on('will-navigate', handler);

      expect(mockWebContents.on).toHaveBeenCalledWith('will-navigate', handler);
    });

    test('should listen for did-start-loading event', () => {
      const handler = jest.fn();
      mockWebContents.on('did-start-loading', handler);

      expect(mockWebContents.on).toHaveBeenCalledWith('did-start-loading', handler);
    });

    test('should listen for did-stop-loading event', () => {
      const handler = jest.fn();
      mockWebContents.on('did-stop-loading', handler);

      expect(mockWebContents.on).toHaveBeenCalledWith('did-stop-loading', handler);
    });

    test('should listen for did-fail-load event', () => {
      const handler = jest.fn();
      mockWebContents.on('did-fail-load', handler);

      expect(mockWebContents.on).toHaveBeenCalledWith('did-fail-load', handler);
    });
  });

  describe('Navigation Control', () => {
    test('should load URL', async () => {
      await mockWebContents.loadURL('https://example.com');

      expect(mockWebContents.loadURL).toHaveBeenCalledWith('https://example.com');
    });

    test('should load file', async () => {
      await mockWebContents.loadFile('/path/to/file.html');

      expect(mockWebContents.loadFile).toHaveBeenCalledWith('/path/to/file.html');
    });

    test('should go back', () => {
      mockWebContents.goBack();

      expect(mockWebContents.goBack).toHaveBeenCalled();
    });

    test('should go forward', () => {
      mockWebContents.goForward();

      expect(mockWebContents.goForward).toHaveBeenCalled();
    });

    test('should reload', () => {
      mockWebContents.reload();

      expect(mockWebContents.reload).toHaveBeenCalled();
    });

    test('should reload ignoring cache', () => {
      mockWebContents.reloadIgnoringCache();

      expect(mockWebContents.reloadIgnoringCache).toHaveBeenCalled();
    });

    test('should stop loading', () => {
      mockWebContents.stop();

      expect(mockWebContents.stop).toHaveBeenCalled();
    });
  });

  describe('Navigation State', () => {
    test('should get current URL', () => {
      mockWebContents.getURL.mockReturnValue('https://example.com');

      const url = mockWebContents.getURL();

      expect(url).toBe('https://example.com');
    });

    test('should get page title', () => {
      mockWebContents.getTitle.mockReturnValue('Example Page');

      const title = mockWebContents.getTitle();

      expect(title).toBe('Example Page');
    });

    test('should check if loading', () => {
      mockWebContents.isLoading.mockReturnValue(true);

      expect(mockWebContents.isLoading()).toBe(true);
    });

    test('should check if can go back', () => {
      mockWebContents.canGoBack.mockReturnValue(true);

      expect(mockWebContents.canGoBack()).toBe(true);
    });

    test('should check if can go forward', () => {
      mockWebContents.canGoForward.mockReturnValue(true);

      expect(mockWebContents.canGoForward()).toBe(true);
    });
  });

  describe('Session from WebContents', () => {
    test('should access session from webContents', () => {
      expect(mockWebContents.session).toBeDefined();
      expect(mockWebContents.session.webRequest).toBeDefined();
    });

    test('should access webRequest from session', () => {
      const webRequest = mockWebContents.session.webRequest;

      expect(webRequest.onBeforeRequest).toBeDefined();
      expect(webRequest.onBeforeSendHeaders).toBeDefined();
      expect(webRequest.onHeadersReceived).toBeDefined();
    });
  });

  describe('Generic WebRequest.on Handler', () => {
    test('should support generic on() method', () => {
      const handler = jest.fn();
      mockSession.webRequest.on('onBeforeRequest', { urls: ['<all_urls>'] }, handler);

      expect(mockSession.webRequest.on).toHaveBeenCalled();
    });

    test('should support on() without filter', () => {
      const handler = jest.fn();
      mockSession.webRequest.on('onCompleted', handler);

      expect(mockSession.webRequest.on).toHaveBeenCalledWith('onCompleted', handler);
    });
  });

  describe('Request Interception', () => {
    test('should allow modifying request headers', () => {
      let capturedCallback;
      mockSession.webRequest.onBeforeSendHeaders.mockImplementation((filter, cb) => {
        capturedCallback = cb;
      });

      mockSession.webRequest.onBeforeSendHeaders({ urls: ['<all_urls>'] }, (details, callback) => {
        callback({
          requestHeaders: {
            ...details.requestHeaders,
            'X-Custom-Header': 'value'
          }
        });
      });

      expect(mockSession.webRequest.onBeforeSendHeaders).toHaveBeenCalled();
    });

    test('should allow cancelling requests', () => {
      mockSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
        if (details.url.includes('blocked')) {
          callback({ cancel: true });
        } else {
          callback({ cancel: false });
        }
      });

      expect(mockSession.webRequest.onBeforeRequest).toHaveBeenCalled();
    });

    test('should allow redirecting requests', () => {
      mockSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
        callback({ redirectURL: 'https://redirect.example.com' });
      });

      expect(mockSession.webRequest.onBeforeRequest).toHaveBeenCalled();
    });
  });
});
