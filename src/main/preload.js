const { contextBridge, ipcRenderer } = require('electron');

// Securely expose specific IPC functions to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Extension management
  listExtensions: () => ipcRenderer.invoke('list-extensions'),
  getExtensionIcon: (extensionId) => ipcRenderer.invoke('get-extension-icon', extensionId),
  
  // Extension interactions
  openExtensionPopup: (extensionId) => ipcRenderer.invoke('open-extension-popup', extensionId),
  
  // Tab management
  createTab: (url) => ipcRenderer.invoke('create-tab', url),
  onOpenInNewTab: (callback) => ipcRenderer.on('open-in-new-tab', (_, url) => callback(url)),
  
  // System functions
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});

// Set up a listener for 'open-in-new-tab' messages
ipcRenderer.on('open-in-new-tab', (event, url) => {
  // Forward to any active webview
  const activeWebview = document.querySelector('webview.active');
  if (activeWebview) {
    activeWebview.send('open-in-new-tab', url);
  } else {
    // If no active webview, store the URL to be opened later
    window.openInNewTabURL = url;
  }
});

console.log('Preload script executed successfully');