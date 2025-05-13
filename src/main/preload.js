const { contextBridge, ipcRenderer } = require('electron');

// Securely expose specific IPC functions to renderer
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
    if (window.electronAPI) {
        window.electronAPI.onOpenInNewTab && window.electronAPI.onOpenInNewTab(url);
    } else {
        window.openInNewTabURL = url;
    }
});

// Intercept form submissions with target="_blank"
window.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes) {
                mutation.addedNodes.forEach((node) => {
                    if (node.tagName === 'WEBVIEW') {
                        attachWebviewListeners(node);
                    }
                });
            }
        });
    });

    const webviewContainer = document.getElementById('webview-container');
    if (webviewContainer) {
        observer.observe(webviewContainer, { childList: true, subtree: true });
    }

    document.querySelectorAll('webview').forEach(attachWebviewListeners);
});

// Function to attach listeners to webviews
function attachWebviewListeners(webview) {
    webview.addEventListener('dom-ready', () => {
        // Enhanced form interception for Flask app compatibility
        if (webview.executeJavaScript) {
            webview.executeJavaScript(`
                // Intercept form submissions with target="_blank"
                const originalSubmit = HTMLFormElement.prototype.submit;
                
                HTMLFormElement.prototype.submit = function() {
                    if (this.target === '_blank') {
                        // Handle Flask form submission
                        const formData = new FormData(this);
                        const url = new URL(this.action);
                        
                        // For GET requests
                        if (this.method.toLowerCase() === 'get') {
                            for (const [key, value] of formData.entries()) {
                                url.searchParams.append(key, value);
                            }
                            window.postMessage({ type: 'electron-new-tab', url: url.toString() }, '*');
                            return;
                        }
                        
                        // For POST requests (like the Flask app)
                        if (this.method.toLowerCase() === 'post') {
                            // Create a hidden iframe to capture the response
                            const iframe = document.createElement('iframe');
                            iframe.name = 'form-target-' + Date.now();
                            iframe.style.display = 'none';
                            document.body.appendChild(iframe);
                            
                            // Change form target to the iframe
                            const originalTarget = this.target;
                            this.target = iframe.name;
                            
                            // Listen for iframe load to capture redirect
                            iframe.addEventListener('load', function() {
                                try {
                                    const redirectUrl = iframe.contentWindow.location.href;
                                    window.postMessage({ 
                                        type: 'electron-new-tab', 
                                        url: redirectUrl 
                                    }, '*');
                                    document.body.removeChild(iframe);
                                } catch(e) {
                                    console.error("Failed to capture redirect:", e);
                                    document.body.removeChild(iframe);
                                }
                            });
                        }
                    }
                    
                    // Call original submit
                    return originalSubmit.apply(this, arguments);
                };
                
                // Listen for messages from the webview
                window.addEventListener('message', function(event) {
                    if (event.data && event.data.type === 'electron-new-tab') {
                        // Forward to Electron
                        window.postMessage({ 
                            type: 'electron-tab-request',
                            url: event.data.url 
                        }, '*');
                    }
                });
            `);
        } else {
            console.error('Webview not properly initialized');
        }
    });

    // Handle messages from webview content
    webview.addEventListener('ipc-message', (event) => {
        if (event.channel === 'open-in-new-tab' && event.args && event.args[0]) {
            ipcRenderer.send('open-in-new-tab', event.args[0]);
        }
    });
}

console.log('Preload script executed successfully');