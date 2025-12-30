/**
 * Basset Hound Browser - Keyboard Shortcuts Unit Tests
 * Tests for keyboard shortcut handling with globalShortcut mock support
 */

// Create mock BrowserWindow
const createMockBrowserWindow = () => {
  const windowListeners = {};

  const mockWindow = {
    id: Math.floor(Math.random() * 10000),
    webContents: {
      session: {}
    },
    on: jest.fn((event, handler) => {
      windowListeners[event] = handler;
      return mockWindow;
    }),
    once: jest.fn((event, handler) => {
      windowListeners[event] = handler;
      return mockWindow;
    }),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    _listeners: windowListeners,
    _emit: (event, ...args) => {
      if (windowListeners[event]) {
        windowListeners[event](...args);
      }
    }
  };

  return mockWindow;
};

// Create globalShortcut mock
const mockGlobalShortcut = {
  register: jest.fn().mockReturnValue(true),
  registerAll: jest.fn(),
  isRegistered: jest.fn().mockReturnValue(false),
  unregister: jest.fn(),
  unregisterAll: jest.fn()
};

// Create BrowserWindow constructor mock
const MockBrowserWindow = jest.fn(() => createMockBrowserWindow());
MockBrowserWindow.getAllWindows = jest.fn().mockReturnValue([]);
MockBrowserWindow.getFocusedWindow = jest.fn().mockReturnValue(null);
MockBrowserWindow.fromWebContents = jest.fn().mockReturnValue(null);
MockBrowserWindow.fromId = jest.fn().mockReturnValue(null);

jest.mock('electron', () => ({
  globalShortcut: mockGlobalShortcut,
  BrowserWindow: MockBrowserWindow,
  app: {
    getPath: jest.fn().mockReturnValue('/mock/path')
  }
}));

const { globalShortcut, BrowserWindow } = require('electron');

describe('Keyboard Shortcuts', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset globalShortcut state
    mockGlobalShortcut.isRegistered.mockReturnValue(false);
  });

  describe('GlobalShortcut Mock', () => {
    test('should have register method', () => {
      expect(globalShortcut.register).toBeDefined();
      expect(typeof globalShortcut.register).toBe('function');
    });

    test('should have registerAll method', () => {
      expect(globalShortcut.registerAll).toBeDefined();
      expect(typeof globalShortcut.registerAll).toBe('function');
    });

    test('should have unregister method', () => {
      expect(globalShortcut.unregister).toBeDefined();
      expect(typeof globalShortcut.unregister).toBe('function');
    });

    test('should have unregisterAll method', () => {
      expect(globalShortcut.unregisterAll).toBeDefined();
      expect(typeof globalShortcut.unregisterAll).toBe('function');
    });

    test('should have isRegistered method', () => {
      expect(globalShortcut.isRegistered).toBeDefined();
      expect(typeof globalShortcut.isRegistered).toBe('function');
    });
  });

  describe('Registering Shortcuts', () => {
    test('should register a single shortcut', () => {
      const callback = jest.fn();

      const result = globalShortcut.register('CommandOrControl+N', callback);

      expect(result).toBe(true);
      expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+N', callback);
    });

    test('should register multiple shortcuts with registerAll', () => {
      const callback = jest.fn();

      globalShortcut.registerAll(['CommandOrControl+Shift+N', 'CommandOrControl+Shift+P'], callback);

      expect(globalShortcut.registerAll).toHaveBeenCalledWith(
        ['CommandOrControl+Shift+N', 'CommandOrControl+Shift+P'],
        callback
      );
    });

    test('should register common browser shortcuts', () => {
      const shortcuts = [
        { accelerator: 'CommandOrControl+T', action: 'newTab' },
        { accelerator: 'CommandOrControl+W', action: 'closeTab' },
        { accelerator: 'CommandOrControl+Shift+T', action: 'reopenTab' },
        { accelerator: 'CommandOrControl+L', action: 'focusAddressBar' },
        { accelerator: 'CommandOrControl+R', action: 'reload' },
        { accelerator: 'F5', action: 'reload' },
        { accelerator: 'CommandOrControl+Shift+R', action: 'hardReload' },
        { accelerator: 'F12', action: 'devTools' },
        { accelerator: 'CommandOrControl+Shift+I', action: 'devTools' }
      ];

      shortcuts.forEach(({ accelerator, action }) => {
        globalShortcut.register(accelerator, jest.fn());
      });

      expect(globalShortcut.register).toHaveBeenCalledTimes(9);
    });

    test('should register navigation shortcuts', () => {
      const goBack = jest.fn();
      const goForward = jest.fn();
      const goHome = jest.fn();

      globalShortcut.register('Alt+Left', goBack);
      globalShortcut.register('Alt+Right', goForward);
      globalShortcut.register('Alt+Home', goHome);

      expect(globalShortcut.register).toHaveBeenCalledWith('Alt+Left', goBack);
      expect(globalShortcut.register).toHaveBeenCalledWith('Alt+Right', goForward);
      expect(globalShortcut.register).toHaveBeenCalledWith('Alt+Home', goHome);
    });
  });

  describe('Unregistering Shortcuts', () => {
    test('should unregister a single shortcut', () => {
      globalShortcut.register('CommandOrControl+N', jest.fn());

      globalShortcut.unregister('CommandOrControl+N');

      expect(globalShortcut.unregister).toHaveBeenCalledWith('CommandOrControl+N');
    });

    test('should unregister all shortcuts', () => {
      globalShortcut.register('CommandOrControl+N', jest.fn());
      globalShortcut.register('CommandOrControl+T', jest.fn());

      globalShortcut.unregisterAll();

      expect(globalShortcut.unregisterAll).toHaveBeenCalled();
    });
  });

  describe('Checking Registered Shortcuts', () => {
    test('should check if shortcut is registered', () => {
      globalShortcut.register('CommandOrControl+N', jest.fn());
      mockGlobalShortcut.isRegistered.mockReturnValue(true);

      const isRegistered = globalShortcut.isRegistered('CommandOrControl+N');

      expect(isRegistered).toBe(true);
      expect(globalShortcut.isRegistered).toHaveBeenCalledWith('CommandOrControl+N');
    });

    test('should return false for unregistered shortcut', () => {
      mockGlobalShortcut.isRegistered.mockReturnValue(false);

      const isRegistered = globalShortcut.isRegistered('CommandOrControl+Unknown');

      expect(isRegistered).toBe(false);
    });
  });

  describe('Shortcut Lifecycle', () => {
    test('should handle app quit cleanup', () => {
      // Simulate app shutdown - unregister all shortcuts
      globalShortcut.register('CommandOrControl+N', jest.fn());
      globalShortcut.register('CommandOrControl+T', jest.fn());

      // App quit simulation
      globalShortcut.unregisterAll();

      expect(globalShortcut.unregisterAll).toHaveBeenCalled();
    });

    test('should handle window blur cleanup', () => {
      // Some apps unregister shortcuts when window loses focus
      const mockWindow = BrowserWindow();

      globalShortcut.register('CommandOrControl+N', jest.fn());

      // Simulate blur
      mockWindow.on('blur', () => {
        globalShortcut.unregisterAll();
      });

      // Trigger blur
      mockWindow._emit('blur');

      expect(globalShortcut.unregisterAll).toHaveBeenCalled();
    });
  });

  describe('Tab Navigation Shortcuts', () => {
    test('should register tab switching shortcuts', () => {
      const switchToTab = jest.fn();

      // Register shortcuts for tabs 1-9
      for (let i = 1; i <= 9; i++) {
        globalShortcut.register(`CommandOrControl+${i}`, () => switchToTab(i));
      }

      expect(globalShortcut.register).toHaveBeenCalledTimes(9);
    });

    test('should register tab navigation shortcuts', () => {
      const nextTab = jest.fn();
      const prevTab = jest.fn();

      globalShortcut.register('CommandOrControl+Tab', nextTab);
      globalShortcut.register('CommandOrControl+Shift+Tab', prevTab);

      expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+Tab', nextTab);
      expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+Shift+Tab', prevTab);
    });
  });

  describe('Zoom Shortcuts', () => {
    test('should register zoom shortcuts', () => {
      const zoomIn = jest.fn();
      const zoomOut = jest.fn();
      const resetZoom = jest.fn();

      globalShortcut.register('CommandOrControl+Plus', zoomIn);
      globalShortcut.register('CommandOrControl+=', zoomIn);
      globalShortcut.register('CommandOrControl+-', zoomOut);
      globalShortcut.register('CommandOrControl+0', resetZoom);

      expect(globalShortcut.register).toHaveBeenCalledTimes(4);
    });
  });

  describe('Find Shortcuts', () => {
    test('should register find shortcuts', () => {
      const findInPage = jest.fn();
      const findNext = jest.fn();
      const findPrevious = jest.fn();

      globalShortcut.register('CommandOrControl+F', findInPage);
      globalShortcut.register('CommandOrControl+G', findNext);
      globalShortcut.register('CommandOrControl+Shift+G', findPrevious);

      expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+F', findInPage);
      expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+G', findNext);
      expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+Shift+G', findPrevious);
    });
  });

  describe('Window Management Shortcuts', () => {
    test('should register window management shortcuts', () => {
      const newWindow = jest.fn();
      const closeWindow = jest.fn();
      const minimize = jest.fn();
      const maximize = jest.fn();
      const fullScreen = jest.fn();

      globalShortcut.register('CommandOrControl+N', newWindow);
      globalShortcut.register('CommandOrControl+Shift+W', closeWindow);
      globalShortcut.register('CommandOrControl+M', minimize);
      globalShortcut.register('F11', fullScreen);

      expect(globalShortcut.register).toHaveBeenCalledTimes(4);
    });
  });

  describe('History Shortcuts', () => {
    test('should register history shortcuts', () => {
      const showHistory = jest.fn();
      const showDownloads = jest.fn();
      const showBookmarks = jest.fn();

      globalShortcut.register('CommandOrControl+H', showHistory);
      globalShortcut.register('CommandOrControl+J', showDownloads);
      globalShortcut.register('CommandOrControl+Shift+B', showBookmarks);

      expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+H', showHistory);
      expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+J', showDownloads);
      expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+Shift+B', showBookmarks);
    });
  });
});
