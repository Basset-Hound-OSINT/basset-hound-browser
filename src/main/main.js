const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url');
const Store = require('electron-store');
const crypto = require('crypto');
const fs = require('fs');

// Enable more detailed logs for troubleshooting
console.log('Starting Electron application...');

// Configure Electron
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.disableHardwareAcceleration();

// Initialize storage
const store = new Store();

// Define extensions path
const EXTENSIONS_DIR = path.join(app.getAppPath(), 'extensions');
console.log('Extensions directory:', EXTENSIONS_DIR);

// Get all extension directories
function getExtensionPaths() {
  try {
    if (!fs.existsSync(EXTENSIONS_DIR)) {
      console.log('Creating extensions directory');
      fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
      return [];
    }
    
    return fs.readdirSync(EXTENSIONS_DIR)
      .map(name => path.join(EXTENSIONS_DIR, name))
      .filter(extPath => fs.statSync(extPath).isDirectory());
  } catch (err) {
    console.error('Error reading extensions directory:', err);
    return [];
  }
}

// Get all extension paths
const EXTENSIONS = getExtensionPaths();
console.log('Found extension paths:', EXTENSIONS);

// Load extensions on startup
let loadedExtensions = [];

// Helper function to get all files in a directory recursively
function getAllFiles(dir, fileList = []) {
  try {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        getAllFiles(fullPath, fileList);
      } else {
        fileList.push(fullPath);
      }
    });
    return fileList;
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
    return fileList;
  }
}

// Find all possible icon paths for an extension
function findExtensionIcons(extensionPath) {
  try {
    const manifestPath = path.join(extensionPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return [];
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const iconPaths = [];
    
    // Check manifest icons
    if (manifest.icons) {
      const sizes = Object.keys(manifest.icons).sort((a, b) => parseInt(b) - parseInt(a));
      sizes.forEach(size => {
        iconPaths.push(path.join(extensionPath, manifest.icons[size]));
      });
    }
    
    // Look for common icon filenames
    const commonIconNames = ['icon.png', 'icon.jpg', 'icon.svg', 'logo.png', 'logo.jpg', 'logo.svg'];
    commonIconNames.forEach(name => {
      const iconPath = path.join(extensionPath, name);
      if (fs.existsSync(iconPath)) {
        iconPaths.push(iconPath);
      }
    });
    
    return iconPaths;
  } catch (err) {
    console.error('Error finding extension icons:', err);
    return [];
  }
}

// Verify extension integrity and structure
async function verifyExtension(extPath) {
  console.log('Verifying extension at:', extPath);
  const manifestPath = path.join(extPath, 'manifest.json');
  
  try {
    if (!fs.existsSync(manifestPath)) {
      console.error('No manifest.json found at:', manifestPath);
      return false;
    }
    
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    
    if (!manifest.name || !manifest.version) {
      console.error('Invalid manifest.json - missing name or version:', manifest);
      return false;
    }
    
    // Calculate extension hash for integrity check
    const files = getAllFiles(extPath);
    const hash = crypto.createHash('sha256');
    for (const file of files) {
      const data = fs.readFileSync(file);
      hash.update(data);
    }
    const extensionHash = hash.digest('hex');
    console.log(`Extension ${manifest.name} (v${manifest.version}) - Hash: ${extensionHash}`);
    
    // Find icons
    const icons = findExtensionIcons(extPath);
    
    return {
      id: manifest.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: manifest.name,
      version: manifest.version,
      path: extPath,
      hash: extensionHash,
      icons: icons
    };
  } catch (err) {
    console.error('Extension verification failed:', err);
    return false;
  }
}

// Window state management
function restoreWindowState() {
  const defaultState = { width: 1200, height: 800, x: undefined, y: undefined };
  const state = store.get('windowState', defaultState);
  return {
    ...state,
    isMaximized: state.isMaximized || false
  };
}

function saveWindowState(window) {
  if (!window.isDestroyed()) {
    const bounds = window.getBounds();
    store.set('windowState', {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: window.isMaximized()
    });
  }
}

// Main window reference
let mainWindow = null;

// Create the browser window
async function createWindow() {
  const windowState = restoreWindowState();
  
  // Create main browser window
  mainWindow = new BrowserWindow({
    ...windowState,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Needed for some extension APIs
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true // Enable webview tag
    },
    title: 'Basset Hound Browser',
    icon: path.join(__dirname, '..', 'assets', 'icon.png')
  });
  
  // Restore maximized state if needed
  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Load and verify extensions
  try {
    for (const extPath of EXTENSIONS) {
      const extInfo = await verifyExtension(extPath);
      if (extInfo) {
        console.log(`Loading extension: ${extInfo.name}`);
        const extension = await session.defaultSession.loadExtension(extPath);
        console.log(`Extension loaded: ${extension.name} (${extension.id})`);
        loadedExtensions.push({
          ...extInfo,
          id: extension.id
        });
      }
    }
  } catch (err) {
    console.error('Failed to load extensions:', err);
    dialog.showErrorBox('Extension Error', 
      `Failed to load extensions: ${err.message}\n\nCheck console for details.`);
  }

  // Determine the start URL
  const startUrl = url.format({
    pathname: path.join(__dirname, '..', 'renderer', 'index.html'),
    protocol: 'file:',
    slashes: true
  });
  
  console.log('Loading renderer from:', startUrl);
  
  // Configure webview session
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    // Parse referrer to detect form submissions
    const referrer = details.requestHeaders['Referer'];
    
    // Logic to detect form submissions and handle them
    callback({ requestHeaders: details.requestHeaders });
  });
  
  // Handle permission requests
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'clipboard-read') {
      callback(false); // Deny clipboard access for security
    } else {
      callback(true); // Allow other permissions
    }
  });

  // Handle new window creation - intercept to create tabs instead
  mainWindow.webContents.setWindowOpenHandler((details) => {
      // Always log the window open attempt for debugging
      console.log('Window open request:', {
          url: details.url,
          disposition: details.disposition,
          frameName: details.frameName,
          features: details.features
      });

      // Conditions for opening in new tab instead of new window
      const shouldOpenInTab = (
          // Standard cases for new tab behavior
          details.disposition === 'foreground-tab' ||
          details.disposition === 'new-window' ||
          details.frameName === '_blank' ||
          
          // Special cases that indicate form submission
          (details.features.includes('noopener') && details.features.includes('noreferrer')) ||
          
          // POST form submissions often have these characteristics
          (details.referrer && details.referrer.policy === 'no-referrer')
      );

      if (shouldOpenInTab) {
          console.log('Redirecting to new tab:', details.url);
          mainWindow.webContents.send('open-in-new-tab', details.url);
          return { action: 'deny' };
      }

      // Default deny - we want all new windows to be handled as tabs
      return { action: 'deny' };
  });

  // Handle redirect events that might be from form submissions
  mainWindow.webContents.on('did-navigate', (event, url, httpResponseCode, httpStatusText) => {
    // This is not needed for our specific use case, but could be useful for other scenarios
    console.log(`Main window navigated: ${url}, code: ${httpResponseCode}`);
  });

  mainWindow.webContents.on('did-create-window', (newWindow) => {
        // This ensures any new windows are closed immediately
        newWindow.close();
        console.log('Prevented new window from opening');
    });
  // Load the index.html
  try {
    await mainWindow.loadURL(startUrl);
    console.log('Main window loaded successfully');
  } catch (err) {
    console.error('Failed to load renderer:', err);
    dialog.showErrorBox('Renderer Error', 
      `Failed to load browser UI: ${err.message}\n\nCheck console for details.`);
  }

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Save window state on close
  mainWindow.on('close', () => saveWindowState(mainWindow));
  
  // Clear reference when window is closed
  mainWindow.on('closed', () => { 
    mainWindow = null; 
  });
}

// IPC handlers for extensions
ipcMain.handle('list-extensions', async () => {
  console.log('Extension list requested by renderer', loadedExtensions);
  return loadedExtensions;
});

ipcMain.handle('get-extension-icon', async (event, extensionId) => {
  const extension = loadedExtensions.find(ext => ext.id === extensionId);
  if (!extension) return null;
  
  // Return first available icon
  if (extension.icons && extension.icons.length > 0) {
    return extension.icons[0];
  }
  
  // Fallback to default icon path
  const defaultIconPath = path.join(__dirname, 'assets', 'default-extension-icon.png');
  if (fs.existsSync(defaultIconPath)) {
    return defaultIconPath;
  }
  
  return null;
});

ipcMain.handle('open-extension-popup', async (event, extensionId) => {
  const extension = loadedExtensions.find(ext => ext.id === extensionId);
  if (!extension) return { success: false, error: 'Extension not found' };
  
  try {
    // Try to find popup.html or options.html
    const popupPath = path.join(extension.path, 'popup.html');
    const optionsPath = path.join(extension.path, 'options.html');
    
    if (fs.existsSync(popupPath)) {
      return { success: true, url: `file://${popupPath}` };
    } else if (fs.existsSync(optionsPath)) {
      return { success: true, url: `file://${optionsPath}` };
    } else {
      return { success: false, error: 'No popup or options page found' };
    }
  } catch (err) {
    console.error('Error opening extension popup:', err);
    return { success: false, error: err.message };
  }
});

// IPC handler for creating new tabs
ipcMain.handle('create-tab', async (event, url) => {
  try {
    console.log('Main process received create-tab request for URL:', url);
    
    // Forward the URL to the renderer to open in a new tab
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('open-in-new-tab', url);
    }
    
    return { success: true };
  } catch (err) {
    console.error('Error creating tab:', err);
    return { success: false, error: err.message };
  }
});

// Main app lifecycle events
app.whenReady().then(() => {
  console.log('App is ready, creating window...');
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  console.log('Application is quitting');
});