/**
 * Basset Hound Browser - Comprehensive Electron Mock
 * Provides complete mock implementations for Electron modules used in tests
 */

// Create a mock session with complete webRequest support
const createMockSession = () => {
  const listeners = {};

  return {
    webRequest: {
      onBeforeRequest: jest.fn((filter, listener) => {
        if (listener) {
          listeners.onBeforeRequest = listener;
        }
      }),
      onBeforeSendHeaders: jest.fn((filter, listener) => {
        if (listener) {
          listeners.onBeforeSendHeaders = listener;
        }
      }),
      onHeadersReceived: jest.fn((filter, listener) => {
        if (listener) {
          listeners.onHeadersReceived = listener;
        }
      }),
      onCompleted: jest.fn((filter, listener) => {
        if (listener) {
          listeners.onCompleted = listener;
        }
      }),
      onErrorOccurred: jest.fn((filter, listener) => {
        if (listener) {
          listeners.onErrorOccurred = listener;
        }
      }),
      // Generic on method for any webRequest event
      on: jest.fn((event, filter, listener) => {
        if (typeof filter === 'function') {
          listeners[event] = filter;
        } else {
          listeners[event] = listener;
        }
      })
    },
    cookies: {
      get: jest.fn().mockResolvedValue([]),
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      flushStore: jest.fn().mockResolvedValue(undefined),
      on: jest.fn()
    },
    setProxy: jest.fn().mockResolvedValue(undefined),
    resolveProxy: jest.fn().mockResolvedValue('DIRECT'),
    clearStorageData: jest.fn().mockResolvedValue(undefined),
    clearCache: jest.fn().mockResolvedValue(undefined),
    setPermissionRequestHandler: jest.fn(),
    setPermissionCheckHandler: jest.fn(),
    getUserAgent: jest.fn().mockReturnValue('MockUserAgent'),
    setUserAgent: jest.fn(),
    // Session events
    on: jest.fn((event, handler) => {
      listeners[`session:${event}`] = handler;
    }),
    once: jest.fn((event, handler) => {
      listeners[`session:${event}`] = handler;
    }),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    // Storage access
    getStoragePath: jest.fn().mockReturnValue('/mock/storage/path'),
    // Get registered listeners for testing
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
    isLoadingMainFrame: jest.fn().mockReturnValue(false),
    isWaitingForResponse: jest.fn().mockReturnValue(false),
    stop: jest.fn(),
    reload: jest.fn(),
    reloadIgnoringCache: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(false),
    canGoForward: jest.fn().mockReturnValue(false),
    goBack: jest.fn(),
    goForward: jest.fn(),
    goToIndex: jest.fn(),
    goToOffset: jest.fn(),
    isCrashed: jest.fn().mockReturnValue(false),
    setUserAgent: jest.fn(),
    getUserAgent: jest.fn().mockReturnValue('MockUserAgent'),
    insertCSS: jest.fn().mockResolvedValue('css-key'),
    removeInsertedCSS: jest.fn().mockResolvedValue(undefined),
    executeJavaScript: jest.fn().mockResolvedValue(undefined),
    executeJavaScriptInIsolatedWorld: jest.fn().mockResolvedValue(undefined),
    setAudioMuted: jest.fn(),
    isAudioMuted: jest.fn().mockReturnValue(false),
    isCurrentlyAudible: jest.fn().mockReturnValue(false),
    setZoomFactor: jest.fn(),
    getZoomFactor: jest.fn().mockReturnValue(1),
    setZoomLevel: jest.fn(),
    getZoomLevel: jest.fn().mockReturnValue(0),
    setVisualZoomLevelLimits: jest.fn().mockResolvedValue(undefined),
    undo: jest.fn(),
    redo: jest.fn(),
    cut: jest.fn(),
    copy: jest.fn(),
    paste: jest.fn(),
    pasteAndMatchStyle: jest.fn(),
    delete: jest.fn(),
    selectAll: jest.fn(),
    unselect: jest.fn(),
    replace: jest.fn(),
    replaceMisspelling: jest.fn(),
    insertText: jest.fn().mockResolvedValue(undefined),
    findInPage: jest.fn().mockReturnValue(1),
    stopFindInPage: jest.fn(),
    capturePage: jest.fn().mockResolvedValue(Buffer.from([])),
    isBeingCaptured: jest.fn().mockReturnValue(false),
    print: jest.fn(),
    printToPDF: jest.fn().mockResolvedValue(Buffer.from([])),
    addWorkSpace: jest.fn(),
    removeWorkSpace: jest.fn(),
    openDevTools: jest.fn(),
    closeDevTools: jest.fn(),
    isDevToolsOpened: jest.fn().mockReturnValue(false),
    isDevToolsFocused: jest.fn().mockReturnValue(false),
    toggleDevTools: jest.fn(),
    inspectElement: jest.fn(),
    inspectSharedWorker: jest.fn(),
    inspectServiceWorker: jest.fn(),
    send: jest.fn(),
    sendToFrame: jest.fn(),
    enableDeviceEmulation: jest.fn(),
    disableDeviceEmulation: jest.fn(),
    sendInputEvent: jest.fn(),
    beginFrameSubscription: jest.fn(),
    endFrameSubscription: jest.fn(),
    startDrag: jest.fn(),
    savePage: jest.fn().mockResolvedValue(undefined),
    showDefinitionForSelection: jest.fn(),
    isOffscreen: jest.fn().mockReturnValue(false),
    startPainting: jest.fn(),
    stopPainting: jest.fn(),
    isPainting: jest.fn().mockReturnValue(false),
    setFrameRate: jest.fn(),
    getFrameRate: jest.fn().mockReturnValue(60),
    invalidate: jest.fn(),
    getType: jest.fn().mockReturnValue('webview'),
    setBackgroundThrottling: jest.fn(),
    getBackgroundThrottling: jest.fn().mockReturnValue(true),
    getProcessId: jest.fn().mockReturnValue(1234),
    getOSProcessId: jest.fn().mockReturnValue(5678),
    on: jest.fn((event, handler) => {
      webContentsListeners[event] = handler;
      return this;
    }),
    once: jest.fn((event, handler) => {
      webContentsListeners[event] = handler;
    }),
    addListener: jest.fn((event, handler) => {
      webContentsListeners[event] = handler;
    }),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    // Get registered listeners for testing
    _listeners: webContentsListeners,
    // Trigger a listener for testing
    _emit: (event, ...args) => {
      if (webContentsListeners[event]) {
        webContentsListeners[event](...args);
      }
    }
  };
};

// Create mock BrowserWindow
const createMockBrowserWindow = (options = {}) => {
  const mockWebContents = createMockWebContents();
  const windowListeners = {};

  const mockWindow = {
    id: Math.floor(Math.random() * 10000),
    webContents: mockWebContents,
    loadURL: jest.fn().mockResolvedValue(undefined),
    loadFile: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
    destroy: jest.fn(),
    focus: jest.fn(),
    blur: jest.fn(),
    isFocused: jest.fn().mockReturnValue(true),
    isDestroyed: jest.fn().mockReturnValue(false),
    show: jest.fn(),
    showInactive: jest.fn(),
    hide: jest.fn(),
    isVisible: jest.fn().mockReturnValue(true),
    isModal: jest.fn().mockReturnValue(false),
    maximize: jest.fn(),
    unmaximize: jest.fn(),
    isMaximized: jest.fn().mockReturnValue(false),
    minimize: jest.fn(),
    restore: jest.fn(),
    isMinimized: jest.fn().mockReturnValue(false),
    setFullScreen: jest.fn(),
    isFullScreen: jest.fn().mockReturnValue(false),
    setSimpleFullScreen: jest.fn(),
    isSimpleFullScreen: jest.fn().mockReturnValue(false),
    isNormal: jest.fn().mockReturnValue(true),
    setAspectRatio: jest.fn(),
    setBackgroundColor: jest.fn(),
    previewFile: jest.fn(),
    closeFilePreview: jest.fn(),
    setBounds: jest.fn(),
    getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 1280, height: 720 }),
    getBackgroundColor: jest.fn().mockReturnValue('#ffffff'),
    setContentBounds: jest.fn(),
    getContentBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 1280, height: 720 }),
    getNormalBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 1280, height: 720 }),
    setEnabled: jest.fn(),
    isEnabled: jest.fn().mockReturnValue(true),
    setSize: jest.fn(),
    getSize: jest.fn().mockReturnValue([1280, 720]),
    setContentSize: jest.fn(),
    getContentSize: jest.fn().mockReturnValue([1280, 720]),
    setMinimumSize: jest.fn(),
    getMinimumSize: jest.fn().mockReturnValue([0, 0]),
    setMaximumSize: jest.fn(),
    getMaximumSize: jest.fn().mockReturnValue([0, 0]),
    setResizable: jest.fn(),
    isResizable: jest.fn().mockReturnValue(true),
    setMovable: jest.fn(),
    isMovable: jest.fn().mockReturnValue(true),
    setMinimizable: jest.fn(),
    isMinimizable: jest.fn().mockReturnValue(true),
    setMaximizable: jest.fn(),
    isMaximizable: jest.fn().mockReturnValue(true),
    setFullScreenable: jest.fn(),
    isFullScreenable: jest.fn().mockReturnValue(true),
    setClosable: jest.fn(),
    isClosable: jest.fn().mockReturnValue(true),
    setAlwaysOnTop: jest.fn(),
    isAlwaysOnTop: jest.fn().mockReturnValue(false),
    moveTop: jest.fn(),
    center: jest.fn(),
    setPosition: jest.fn(),
    getPosition: jest.fn().mockReturnValue([0, 0]),
    setTitle: jest.fn(),
    getTitle: jest.fn().mockReturnValue('Mock Window'),
    setSheetOffset: jest.fn(),
    flashFrame: jest.fn(),
    setSkipTaskbar: jest.fn(),
    setKiosk: jest.fn(),
    isKiosk: jest.fn().mockReturnValue(false),
    getMediaSourceId: jest.fn().mockReturnValue('mock-source-id'),
    getNativeWindowHandle: jest.fn().mockReturnValue(Buffer.alloc(0)),
    hookWindowMessage: jest.fn(),
    isWindowMessageHooked: jest.fn().mockReturnValue(false),
    unhookWindowMessage: jest.fn(),
    unhookAllWindowMessages: jest.fn(),
    setRepresentedFilename: jest.fn(),
    getRepresentedFilename: jest.fn().mockReturnValue(''),
    setDocumentEdited: jest.fn(),
    isDocumentEdited: jest.fn().mockReturnValue(false),
    focusOnWebView: jest.fn(),
    blurWebView: jest.fn(),
    capturePage: jest.fn().mockResolvedValue(Buffer.from([])),
    setMenu: jest.fn(),
    removeMenu: jest.fn(),
    setProgressBar: jest.fn(),
    setOverlayIcon: jest.fn(),
    setHasShadow: jest.fn(),
    hasShadow: jest.fn().mockReturnValue(true),
    setOpacity: jest.fn(),
    getOpacity: jest.fn().mockReturnValue(1),
    setShape: jest.fn(),
    setThumbarButtons: jest.fn().mockReturnValue(true),
    setThumbnailClip: jest.fn(),
    setThumbnailToolTip: jest.fn(),
    setAppDetails: jest.fn(),
    showDefinitionForSelection: jest.fn(),
    setIcon: jest.fn(),
    setWindowButtonVisibility: jest.fn(),
    setAutoHideMenuBar: jest.fn(),
    isMenuBarAutoHide: jest.fn().mockReturnValue(false),
    setMenuBarVisibility: jest.fn(),
    isMenuBarVisible: jest.fn().mockReturnValue(true),
    setVisibleOnAllWorkspaces: jest.fn(),
    isVisibleOnAllWorkspaces: jest.fn().mockReturnValue(false),
    setIgnoreMouseEvents: jest.fn(),
    setContentProtection: jest.fn(),
    setFocusable: jest.fn(),
    setParentWindow: jest.fn(),
    getParentWindow: jest.fn().mockReturnValue(null),
    getChildWindows: jest.fn().mockReturnValue([]),
    setAutoHideCursor: jest.fn(),
    selectPreviousTab: jest.fn(),
    selectNextTab: jest.fn(),
    mergeAllWindows: jest.fn(),
    moveTabToNewWindow: jest.fn(),
    toggleTabBar: jest.fn(),
    addTabbedWindow: jest.fn(),
    setVibrancy: jest.fn(),
    on: jest.fn((event, handler) => {
      windowListeners[event] = handler;
      return mockWindow;
    }),
    once: jest.fn((event, handler) => {
      windowListeners[event] = handler;
      return mockWindow;
    }),
    addListener: jest.fn((event, handler) => {
      windowListeners[event] = handler;
      return mockWindow;
    }),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    // Get registered listeners for testing
    _listeners: windowListeners,
    // Trigger a listener for testing
    _emit: (event, ...args) => {
      if (windowListeners[event]) {
        windowListeners[event](...args);
      }
    }
  };

  return mockWindow;
};

// Default session instance
const defaultSession = createMockSession();

// BrowserWindow constructor mock
const BrowserWindow = jest.fn((options) => createMockBrowserWindow(options));
BrowserWindow.getAllWindows = jest.fn().mockReturnValue([]);
BrowserWindow.getFocusedWindow = jest.fn().mockReturnValue(null);
BrowserWindow.fromWebContents = jest.fn().mockReturnValue(null);
BrowserWindow.fromBrowserView = jest.fn().mockReturnValue(null);
BrowserWindow.fromId = jest.fn().mockReturnValue(null);

// Session mock
const session = {
  defaultSession,
  fromPartition: jest.fn((partition) => createMockSession())
};

// App mock
const app = {
  getName: jest.fn().mockReturnValue('basset-hound-browser'),
  getVersion: jest.fn().mockReturnValue('1.0.0'),
  getPath: jest.fn((name) => {
    const paths = {
      home: '/mock/home',
      appData: '/mock/appData',
      userData: '/mock/userData',
      temp: '/mock/temp',
      exe: '/mock/exe',
      module: '/mock/module',
      desktop: '/mock/desktop',
      documents: '/mock/documents',
      downloads: '/mock/downloads',
      music: '/mock/music',
      pictures: '/mock/pictures',
      videos: '/mock/videos',
      recent: '/mock/recent',
      logs: '/mock/logs',
      crashDumps: '/mock/crashDumps'
    };
    return paths[name] || '/mock/path';
  }),
  setPath: jest.fn(),
  getLocale: jest.fn().mockReturnValue('en-US'),
  getLocaleCountryCode: jest.fn().mockReturnValue('US'),
  addRecentDocument: jest.fn(),
  clearRecentDocuments: jest.fn(),
  setAsDefaultProtocolClient: jest.fn().mockReturnValue(true),
  removeAsDefaultProtocolClient: jest.fn().mockReturnValue(true),
  isDefaultProtocolClient: jest.fn().mockReturnValue(false),
  getApplicationNameForProtocol: jest.fn().mockReturnValue(''),
  setUserTasks: jest.fn().mockReturnValue(true),
  getJumpListSettings: jest.fn().mockReturnValue({ minItems: 10, removedItems: [] }),
  setJumpList: jest.fn(),
  requestSingleInstanceLock: jest.fn().mockReturnValue(true),
  hasSingleInstanceLock: jest.fn().mockReturnValue(true),
  releaseSingleInstanceLock: jest.fn(),
  setUserActivity: jest.fn(),
  getCurrentActivityType: jest.fn().mockReturnValue(''),
  invalidateCurrentActivity: jest.fn(),
  resignCurrentActivity: jest.fn(),
  updateCurrentActivity: jest.fn(),
  setAppUserModelId: jest.fn(),
  setActivationPolicy: jest.fn(),
  importCertificate: jest.fn(),
  disableHardwareAcceleration: jest.fn(),
  disableDomainBlockingFor3DAPIs: jest.fn(),
  getAppMetrics: jest.fn().mockReturnValue([]),
  getGPUFeatureStatus: jest.fn().mockReturnValue({}),
  getGPUInfo: jest.fn().mockResolvedValue({}),
  setBadgeCount: jest.fn().mockReturnValue(true),
  getBadgeCount: jest.fn().mockReturnValue(0),
  isUnityRunning: jest.fn().mockReturnValue(false),
  getLoginItemSettings: jest.fn().mockReturnValue({ openAtLogin: false }),
  setLoginItemSettings: jest.fn(),
  isAccessibilitySupportEnabled: jest.fn().mockReturnValue(false),
  setAccessibilitySupportEnabled: jest.fn(),
  showAboutPanel: jest.fn(),
  setAboutPanelOptions: jest.fn(),
  isEmojiPanelSupported: jest.fn().mockReturnValue(true),
  showEmojiPanel: jest.fn(),
  startAccessingSecurityScopedResource: jest.fn().mockReturnValue(jest.fn()),
  enableSandbox: jest.fn(),
  isInApplicationsFolder: jest.fn().mockReturnValue(true),
  moveToApplicationsFolder: jest.fn().mockReturnValue(true),
  isSecureKeyboardEntryEnabled: jest.fn().mockReturnValue(false),
  setSecureKeyboardEntryEnabled: jest.fn(),
  dock: {
    bounce: jest.fn().mockReturnValue(0),
    cancelBounce: jest.fn(),
    downloadFinished: jest.fn(),
    setBadge: jest.fn(),
    getBadge: jest.fn().mockReturnValue(''),
    hide: jest.fn(),
    show: jest.fn().mockResolvedValue(undefined),
    isVisible: jest.fn().mockReturnValue(true),
    setMenu: jest.fn(),
    getMenu: jest.fn().mockReturnValue(null),
    setIcon: jest.fn()
  },
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  quit: jest.fn(),
  exit: jest.fn(),
  relaunch: jest.fn(),
  isReady: jest.fn().mockReturnValue(true),
  whenReady: jest.fn().mockResolvedValue(undefined),
  focus: jest.fn(),
  hide: jest.fn(),
  show: jest.fn(),
  setAppLogsPath: jest.fn(),
  getAppPath: jest.fn().mockReturnValue('/mock/app'),
  getFileIcon: jest.fn().mockResolvedValue(null),
  isPackaged: false
};

// IpcMain mock
const ipcMain = {
  on: jest.fn(),
  once: jest.fn(),
  handle: jest.fn(),
  handleOnce: jest.fn(),
  removeHandler: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn()
};

// IpcRenderer mock
const ipcRenderer = {
  on: jest.fn(),
  once: jest.fn(),
  send: jest.fn(),
  sendSync: jest.fn().mockReturnValue(null),
  sendTo: jest.fn(),
  sendToHost: jest.fn(),
  invoke: jest.fn().mockResolvedValue(null),
  postMessage: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn()
};

// GlobalShortcut mock
const globalShortcut = {
  register: jest.fn().mockReturnValue(true),
  registerAll: jest.fn(),
  isRegistered: jest.fn().mockReturnValue(false),
  unregister: jest.fn(),
  unregisterAll: jest.fn()
};

// Dialog mock
const dialog = {
  showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: [] }),
  showOpenDialogSync: jest.fn().mockReturnValue([]),
  showSaveDialog: jest.fn().mockResolvedValue({ canceled: false, filePath: '' }),
  showSaveDialogSync: jest.fn().mockReturnValue(''),
  showMessageBox: jest.fn().mockResolvedValue({ response: 0, checkboxChecked: false }),
  showMessageBoxSync: jest.fn().mockReturnValue(0),
  showErrorBox: jest.fn(),
  showCertificateTrustDialog: jest.fn().mockResolvedValue(undefined)
};

// Menu mock
const Menu = jest.fn();
Menu.setApplicationMenu = jest.fn();
Menu.getApplicationMenu = jest.fn().mockReturnValue(null);
Menu.buildFromTemplate = jest.fn().mockReturnValue({});

// MenuItem mock
const MenuItem = jest.fn();

// Tray mock
const Tray = jest.fn(() => ({
  setImage: jest.fn(),
  setToolTip: jest.fn(),
  setContextMenu: jest.fn(),
  on: jest.fn(),
  destroy: jest.fn()
}));

// Notification mock
const Notification = jest.fn(() => ({
  show: jest.fn(),
  close: jest.fn(),
  on: jest.fn()
}));
Notification.isSupported = jest.fn().mockReturnValue(true);

// Shell mock
const shell = {
  showItemInFolder: jest.fn(),
  openPath: jest.fn().mockResolvedValue(''),
  openExternal: jest.fn().mockResolvedValue(undefined),
  trashItem: jest.fn().mockResolvedValue(undefined),
  beep: jest.fn(),
  writeShortcutLink: jest.fn().mockReturnValue(true),
  readShortcutLink: jest.fn().mockReturnValue({})
};

// Clipboard mock
const clipboard = {
  readText: jest.fn().mockReturnValue(''),
  writeText: jest.fn(),
  readHTML: jest.fn().mockReturnValue(''),
  writeHTML: jest.fn(),
  readImage: jest.fn().mockReturnValue(null),
  writeImage: jest.fn(),
  readRTF: jest.fn().mockReturnValue(''),
  writeRTF: jest.fn(),
  readBookmark: jest.fn().mockReturnValue({ title: '', url: '' }),
  writeBookmark: jest.fn(),
  readFindText: jest.fn().mockReturnValue(''),
  writeFindText: jest.fn(),
  clear: jest.fn(),
  availableFormats: jest.fn().mockReturnValue([]),
  has: jest.fn().mockReturnValue(false),
  read: jest.fn().mockReturnValue(''),
  readBuffer: jest.fn().mockReturnValue(Buffer.alloc(0)),
  writeBuffer: jest.fn()
};

// Screen mock
const screen = {
  getCursorScreenPoint: jest.fn().mockReturnValue({ x: 0, y: 0 }),
  getPrimaryDisplay: jest.fn().mockReturnValue({
    id: 1,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    accelerometerSupport: 'unknown',
    monochrome: false,
    colorDepth: 24,
    colorSpace: '{primaries:BT709, transfer:SRGB, matrix:RGB, range:FULL}',
    depthPerComponent: 8,
    displayFrequency: 60,
    size: { width: 1920, height: 1080 },
    workAreaSize: { width: 1920, height: 1040 },
    scaleFactor: 1,
    rotation: 0,
    internal: true,
    touchSupport: 'unknown'
  }),
  getAllDisplays: jest.fn().mockReturnValue([]),
  getDisplayNearestPoint: jest.fn().mockReturnValue(null),
  getDisplayMatching: jest.fn().mockReturnValue(null),
  on: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn()
};

// NativeImage mock - create empty image factory first to avoid circular reference
const createEmptyImage = () => ({
  toPNG: jest.fn().mockReturnValue(Buffer.alloc(0)),
  toJPEG: jest.fn().mockReturnValue(Buffer.alloc(0)),
  toBitmap: jest.fn().mockReturnValue(Buffer.alloc(0)),
  toDataURL: jest.fn().mockReturnValue(''),
  getBitmap: jest.fn().mockReturnValue(Buffer.alloc(0)),
  getNativeHandle: jest.fn().mockReturnValue(Buffer.alloc(0)),
  isEmpty: jest.fn().mockReturnValue(true),
  getSize: jest.fn().mockReturnValue({ width: 0, height: 0 }),
  setTemplateImage: jest.fn(),
  isTemplateImage: jest.fn().mockReturnValue(false),
  crop: jest.fn().mockImplementation(function() { return this; }),
  resize: jest.fn().mockImplementation(function() { return this; }),
  getAspectRatio: jest.fn().mockReturnValue(1),
  getScaleFactors: jest.fn().mockReturnValue([1]),
  addRepresentation: jest.fn()
});

const nativeImage = {
  createEmpty: jest.fn().mockImplementation(createEmptyImage),
  createFromPath: jest.fn().mockImplementation(createEmptyImage),
  createFromBitmap: jest.fn().mockImplementation(createEmptyImage),
  createFromBuffer: jest.fn().mockImplementation(createEmptyImage),
  createFromDataURL: jest.fn().mockImplementation(createEmptyImage),
  createFromNamedImage: jest.fn().mockImplementation(createEmptyImage),
  createThumbnailFromPath: jest.fn().mockImplementation(() => Promise.resolve(createEmptyImage()))
};

// WebContents mock (static methods)
const webContents = {
  getAllWebContents: jest.fn().mockReturnValue([]),
  getFocusedWebContents: jest.fn().mockReturnValue(null),
  fromId: jest.fn().mockReturnValue(null)
};

// Net mock
const net = {
  request: jest.fn().mockReturnValue({
    on: jest.fn(),
    once: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    abort: jest.fn(),
    setHeader: jest.fn(),
    getHeader: jest.fn().mockReturnValue(''),
    removeHeader: jest.fn()
  })
};

// Protocol mock
const protocol = {
  registerSchemesAsPrivileged: jest.fn(),
  registerFileProtocol: jest.fn().mockReturnValue(true),
  registerBufferProtocol: jest.fn().mockReturnValue(true),
  registerStringProtocol: jest.fn().mockReturnValue(true),
  registerHttpProtocol: jest.fn().mockReturnValue(true),
  registerStreamProtocol: jest.fn().mockReturnValue(true),
  unregisterProtocol: jest.fn().mockReturnValue(true),
  isProtocolRegistered: jest.fn().mockReturnValue(false),
  interceptFileProtocol: jest.fn().mockReturnValue(true),
  interceptStringProtocol: jest.fn().mockReturnValue(true),
  interceptBufferProtocol: jest.fn().mockReturnValue(true),
  interceptHttpProtocol: jest.fn().mockReturnValue(true),
  interceptStreamProtocol: jest.fn().mockReturnValue(true),
  uninterceptProtocol: jest.fn().mockReturnValue(true),
  isProtocolIntercepted: jest.fn().mockReturnValue(false),
  handle: jest.fn()
};

// PowerMonitor mock
const powerMonitor = {
  getSystemIdleState: jest.fn().mockReturnValue('active'),
  getSystemIdleTime: jest.fn().mockReturnValue(0),
  isOnBatteryPower: jest.fn().mockReturnValue(false),
  on: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn()
};

// PowerSaveBlocker mock
const powerSaveBlocker = {
  start: jest.fn().mockReturnValue(1),
  stop: jest.fn(),
  isStarted: jest.fn().mockReturnValue(false)
};

// SystemPreferences mock
const systemPreferences = {
  isDarkMode: jest.fn().mockReturnValue(false),
  isSwipeTrackingFromScrollEventsEnabled: jest.fn().mockReturnValue(false),
  postNotification: jest.fn(),
  postLocalNotification: jest.fn(),
  postWorkspaceNotification: jest.fn(),
  subscribeNotification: jest.fn().mockReturnValue(1),
  subscribeLocalNotification: jest.fn().mockReturnValue(1),
  subscribeWorkspaceNotification: jest.fn().mockReturnValue(1),
  unsubscribeNotification: jest.fn(),
  unsubscribeLocalNotification: jest.fn(),
  unsubscribeWorkspaceNotification: jest.fn(),
  registerDefaults: jest.fn(),
  getUserDefault: jest.fn().mockReturnValue(null),
  setUserDefault: jest.fn(),
  removeUserDefault: jest.fn(),
  isAeroGlassEnabled: jest.fn().mockReturnValue(true),
  getAccentColor: jest.fn().mockReturnValue(''),
  getColor: jest.fn().mockReturnValue(''),
  getSystemColor: jest.fn().mockReturnValue(''),
  isInvertedColorScheme: jest.fn().mockReturnValue(false),
  isHighContrastColorScheme: jest.fn().mockReturnValue(false),
  getEffectiveAppearance: jest.fn().mockReturnValue('light'),
  getAppLevelAppearance: jest.fn().mockReturnValue('light'),
  setAppLevelAppearance: jest.fn(),
  canPromptTouchID: jest.fn().mockReturnValue(false),
  promptTouchID: jest.fn().mockResolvedValue(undefined),
  isTrustedAccessibilityClient: jest.fn().mockReturnValue(true),
  getMediaAccessStatus: jest.fn().mockReturnValue('granted'),
  askForMediaAccess: jest.fn().mockResolvedValue(true),
  getAnimationSettings: jest.fn().mockReturnValue({
    shouldRenderRichAnimation: true,
    scrollAnimationsEnabledBySystem: true,
    prefersReducedMotion: false
  }),
  on: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn()
};

// ContentTracing mock
const contentTracing = {
  getCategories: jest.fn().mockResolvedValue([]),
  startRecording: jest.fn().mockResolvedValue(undefined),
  stopRecording: jest.fn().mockResolvedValue(''),
  getTraceBufferUsage: jest.fn().mockResolvedValue({ value: 0, percentage: 0 })
};

// Export all mocks
module.exports = {
  // Main exports
  app,
  BrowserWindow,
  session,
  ipcMain,
  ipcRenderer,
  globalShortcut,
  dialog,
  Menu,
  MenuItem,
  Tray,
  Notification,
  shell,
  clipboard,
  screen,
  nativeImage,
  webContents,
  net,
  protocol,
  powerMonitor,
  powerSaveBlocker,
  systemPreferences,
  contentTracing,

  // Factory functions for creating new mocks
  createMockSession,
  createMockWebContents,
  createMockBrowserWindow
};
