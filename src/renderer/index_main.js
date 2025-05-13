// Tab management
const tabBar = document.getElementById('tab-bar');
const newTabButton = document.getElementById('new-tab-button');
const webviewContainer = document.getElementById('webview-container');
const addressBar = document.getElementById('address-bar');
const backBtn = document.getElementById('back');
const forwardBtn = document.getElementById('forward');
const refreshBtn = document.getElementById('refresh');
const extensionsContainer = document.getElementById('extensions-container');

let tabs = [];
let activeTabId = null;

// Generate unique ID for tabs
function generateTabId() {
    return 'tab-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

// Create a new tab
function createTab(url = 'https://www.google.com') {
    const tabId = generateTabId();
    
    // Create tab element
    const tabElement = document.createElement('div');
    tabElement.className = 'tab';
    tabElement.dataset.id = tabId;
    
    // Tab favicon
    const favicon = document.createElement('div');
    favicon.className = 'tab-favicon';
    tabElement.appendChild(favicon);
    
    // Tab title
    const tabTitle = document.createTextNode('New Tab');
    tabElement.appendChild(tabTitle);
    
    // Close button
    const closeBtn = document.createElement('div');
    closeBtn.className = 'tab-close';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(tabId);
    });
    tabElement.appendChild(closeBtn);
    
    // Switch to this tab when clicked
    tabElement.addEventListener('click', () => {
    switchToTab(tabId);
    });
    
    // Insert tab before the new tab button
    tabBar.insertBefore(tabElement, newTabButton);
    
    // Create webview container
    const webviewWrapper = document.createElement('div');
    webviewWrapper.className = 'webview-wrapper';
    webviewWrapper.dataset.id = tabId;
    
    // Create webview element
    const webview = document.createElement('webview');
    webview.setAttribute('src', url);
    webview.setAttribute('allowpopups', '');
    webview.setAttribute('allowfullscreen', '');
    webview.setAttribute('allowscripts', '');
    webview.setAttribute('webpreferences', 'contextIsolation=yes,nodeIntegration=no');
    webview.setAttribute('partition', 'persist:main');
    
    webviewWrapper.appendChild(webview);
    webviewContainer.appendChild(webviewWrapper);
    
    // Store tab information
    tabs.push({
    id: tabId,
    title: 'New Tab',
    url: url,
    element: tabElement,
    wrapper: webviewWrapper,
    webview: webview
    });
    
    // Set up webview event listeners
    setupWebviewEvents(webview, tabId);
    
    // Switch to the new tab
    switchToTab(tabId);
    
    return tabId;
}

// Close a tab
function closeTab(tabId) {
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) return;
    
    // Remove DOM elements
    tabs[tabIndex].element.remove();
    tabs[tabIndex].wrapper.remove();
    
    // Remove from tabs array
    tabs.splice(tabIndex, 1);
    
    // If we closed the active tab, switch to another tab
    if (activeTabId === tabId) {
    if (tabs.length > 0) {
        // Switch to the tab that was to the right, or the last tab if we closed the last tab
        const newIndex = Math.min(tabIndex, tabs.length - 1);
        switchToTab(tabs[newIndex].id);
    } else {
        // No tabs left, create a new one
        createTab();
    }
    }
}

// Switch to a specific tab
function switchToTab(tabId) {
    // Deactivate all tabs
    tabs.forEach(tab => {
    tab.element.classList.remove('active');
    tab.wrapper.classList.remove('active');
    });
    
    // Activate the selected tab
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    tab.element.classList.add('active');
    tab.wrapper.classList.add('active');
    activeTabId = tabId;
    
    // Update address bar
    addressBar.value = tab.url;
    
    // Update navigation buttons state
    updateNavigationState();
}

// Setup event listeners for a webview
function setupWebviewEvents(webview, tabId) {
    // Update title when page title changes
    webview.addEventListener('page-title-updated', (event) => {
    updateTabTitle(tabId, event.title);
    });
    
    // Update favicon when page favicon changes
    webview.addEventListener('page-favicon-updated', (event) => {
    if (event.favicons && event.favicons.length > 0) {
        updateTabFavicon(tabId, event.favicons[0]);
    }
    });
    
    // Update URL when navigation happens
    webview.addEventListener('did-navigate', (event) => {
    updateTabUrl(tabId, event.url);
    });
    
    webview.addEventListener('did-navigate-in-page', (event) => {
    updateTabUrl(tabId, event.url);
    });
    
    // Handle new window requests (open in new tab instead)
    webview.addEventListener('new-window', (e) => {
        e.preventDefault();
        const url = e.url;
        if (url) {
            createTab(url);
        }
    });
    
    // Listen for messages from webview content
    webview.addEventListener('ipc-message', (event) => {
        if (event.channel === 'open-in-new-tab' && event.args && event.args[0]) {
            createTab(event.args[0]);
        }
    });
    
    // Handle form submissions with target="_blank"
    // In the setupWebviewEvents function, enhance the dom-ready listener:
    webview.addEventListener('dom-ready', () => {
        // Enhanced form submission handling
        webview.executeJavaScript(`
            // Listen for form submissions
            document.addEventListener('submit', function(event) {
                const form = event.target;
                if (form.target === '_blank') {
                    event.preventDefault();
                    
                    // Create a URL from the form action
                    const url = new URL(form.action);
                    
                    // For GET requests
                    if (form.method.toLowerCase() === 'get') {
                        const formData = new FormData(form);
                        for (const [key, value] of formData.entries()) {
                            url.searchParams.append(key, value);
                        }
                        window.postMessage({ type: 'electron-new-tab', url: url.toString() }, '*');
                        return;
                    }
                    
                    // For POST requests (like the Flask app)
                    if (form.method.toLowerCase() === 'post') {
                        // Create a hidden iframe to capture the response
                        const iframe = document.createElement('iframe');
                        iframe.name = 'form-target-' + Date.now();
                        iframe.style.display = 'none';
                        document.body.appendChild(iframe);
                        
                        // Change form target to the iframe
                        form.target = iframe.name;
                        
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
                        
                        // Submit the form normally (it will target the iframe)
                        return;
                    }
                }
            }, true);
        `);
    });
    
    // Handle DOM events sent from webview content scripts
    webview.addEventListener('dom-ready', () => {
        webview.addEventListener('console-message', (e) => {
            console.log('Webview console:', e.message);
        });
        
        // Create a communication channel between webview and main window
        webview.executeJavaScript(`
            // Listen for form submissions with target="_blank"
            document.addEventListener('submit', function(event) {
                if (event.target.target === '_blank') {
                    window.postMessage({ 
                        type: 'electron-tab-request',
                        url: event.target.action
                    }, '*');
                    console.log('Form submit with target=_blank intercepted:', event.target.action);
                }
            });
            
            // Forward messages to the parent
            window.addEventListener('message', function(event) {
                if (event.data && event.data.type === 'electron-tab-request') {
                    console.log('Sending IPC message to open new tab:', event.data.url);
                    // This only works if we have access to Electron IPC
                    if (window.top === window) {
                        const customEvent = new Event('electron-new-tab');
                        customEvent.url = event.data.url;
                        document.dispatchEvent(customEvent);
                    }
                }
            });
        `);
    });
    
    webview.addEventListener('will-download', (event) => {
        // You might want to implement download handling here
        console.log('Download started:', event);
    });

    // Handle errors
    webview.addEventListener('did-fail-load', (event) => {
    const { errorCode, errorDescription, validatedURL } = event;
    console.error(`Failed to load: ${validatedURL}`, errorCode, errorDescription);
    
    // Only show error page for major errors (ignore -3 which is often just navigation interruption)
    if (errorCode !== -3) {
        webview.executeJavaScript(`
        document.body.innerHTML = \`
            <div style="padding: 20px; font-family: system-ui, -apple-system, sans-serif;">
            <h2>Page failed to load</h2>
            <p>URL: ${validatedURL}</p>
            <p>Error: ${errorDescription} (${errorCode})</p>
            <p>Possible solutions:</p>
            <ul>
                <li>Check your internet connection</li>
                <li>Verify the URL is correct</li>
                <li>For localhost addresses, try using http:// instead of https://</li>
            </ul>
            </div>
        \`;
        `);
    }
    });
}

// Update tab title
function updateTabTitle(tabId, title) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    tab.title = title;
    
    // Find the text node (second child after favicon) and update it
    const textNode = tab.element.childNodes[1];
    if (textNode) {
    textNode.nodeValue = title;
    }
    
    // Update tab tooltip
    tab.element.title = title;
}

// Update tab favicon
function updateTabFavicon(tabId, faviconUrl) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    // Find the favicon element (first child) and update it
    const favicon = tab.element.querySelector('.tab-favicon');
    if (favicon) {
    favicon.style.backgroundImage = `url('${faviconUrl}')`;
    }
}

// Update tab URL
function updateTabUrl(tabId, url) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    tab.url = url;
    
    // Update address bar if this is the active tab
    if (activeTabId === tabId) {
    addressBar.value = url;
    }
}

// Get the active webview
function getActiveWebview() {
    if (!activeTabId) return null;
    const tab = tabs.find(t => t.id === activeTabId);
    return tab ? tab.webview : null;
}

// Update navigation buttons state
function updateNavigationState() {
    const webview = getActiveWebview();
    if (!webview) return;
    
    // We have to wait for the webview to be properly initialized
    setTimeout(() => {
    try {
        backBtn.disabled = !webview.canGoBack();
        forwardBtn.disabled = !webview.canGoForward();
    } catch (err) {
        console.error('Error updating navigation state:', err);
    }
    }, 100);
}

// Navigation controls
backBtn.addEventListener('click', () => {
    const webview = getActiveWebview();
    if (webview && webview.canGoBack()) {
    webview.goBack();
    }
});

forwardBtn.addEventListener('click', () => {
    const webview = getActiveWebview();
    if (webview && webview.canGoForward()) {
    webview.goForward();
    }
});

refreshBtn.addEventListener('click', () => {
    const webview = getActiveWebview();
    if (webview) {
    webview.reload();
    }
});

// Handle Enter key in address bar
addressBar.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
    const webview = getActiveWebview();
    if (!webview) return;
    
    let url = addressBar.value.trim();
    
    // Handle localhost URLs specially
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
        // For localhost, prefer http:// by default
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url;
        }
    } else {
        // For all other URLs, use https://
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
        }
    }
    
    try {
        webview.loadURL(url);
    } catch (error) {
        console.error('Failed to load URL:', error);
        // Show error message in webview
        webview.loadURL(`data:text/html,<html><body><h2>Error loading URL</h2><p>${error.message || error}</p></body></html>`);
    }
    }
});

// Create a new tab when the button is clicked
newTabButton.addEventListener('click', () => {
    createTab();
});

// Listen for messages from the main process to open URLs in new tabs
window.electronAPI.onOpenInNewTab((url) => {
    console.log("Received request to open URL in new tab:", url);
    createTab(url);
});

// Listen for form target="_blank" events
window.addEventListener('form-target-blank', (event) => {
    if (event.detail && event.detail.url) {
        createTab(event.detail.url);
    }
});

// Intercept form submissions with target="_blank"
function setupFormInterception() {
    // Create a style to highlight forms with target="_blank" for debugging
    const debugStyle = document.createElement('style');
    debugStyle.textContent = `
        form[target="_blank"] {
            /* For debugging - highlight forms with target="_blank" */
            /* border: 2px dashed #ff5722 !important; */
        }
    `;
    document.head.appendChild(debugStyle);
    
    // Global handler for all webviews
    document.addEventListener('electron-new-tab', (event) => {
        if (event.url) {
            console.log('Creating new tab from event:', event.url);
            createTab(event.url);
        }
    });
}

// Load extensions
async function loadExtensions() {
    try {
        const extensions = await window.electronAPI.listExtensions();
        
        // Clear existing extensions
        extensionsContainer.innerHTML = '';
        
        // Add extension icons
        extensions.forEach(extension => {
            const extensionElement = document.createElement('div');
            extensionElement.className = 'extension-icon';
            extensionElement.title = `${extension.name} v${extension.version}`;
            extensionElement.dataset.id = extension.id;
            
            // Try to load extension icon
            window.electronAPI.getExtensionIcon(extension.id)
            .then(iconPath => {
                if (iconPath) {
                    extensionElement.style.backgroundImage = `url('file://${iconPath}')`;
                } else {
                    // Default icon if none found
                    extensionElement.textContent = extension.name.charAt(0).toUpperCase();
                }
            });
            
            // Create popup container
            const popupContainer = document.createElement('div');
            popupContainer.className = 'extension-popup-container';
            popupContainer.style.display = 'none';
            
            // Create iframe for extension popup
            const popupFrame = document.createElement('iframe');
            popupFrame.className = 'extension-popup-frame';
            popupFrame.sandbox = 'allow-scripts allow-same-origin';
            popupContainer.appendChild(popupFrame);
            document.body.appendChild(popupContainer);
            
            // Handle click on extension icon
            extensionElement.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                // Close any other open popups
                document.querySelectorAll('.extension-popup-container').forEach(p => {
                    if (p !== popupContainer) {
                        p.style.display = 'none';
                    }
                });
                
                // Toggle this popup
                if (popupContainer.style.display === 'block') {
                    popupContainer.style.display = 'none';
                } else {
                    // Load the popup content
                    try {
                        const result = await window.electronAPI.openExtensionPopup(extension.id);
                        if (result.success) {
                            popupFrame.src = result.url;
                            
                            // Position the popup
                            const rect = extensionElement.getBoundingClientRect();
                            popupContainer.style.position = 'absolute';
                            popupContainer.style.top = `${rect.bottom + window.scrollY}px`;
                            popupContainer.style.right = `${window.innerWidth - rect.right}px`;
                            popupContainer.style.width = '300px';
                            popupContainer.style.height = '400px';
                            popupContainer.style.backgroundColor = 'white';
                            popupContainer.style.border = '1px solid #ddd';
                            popupContainer.style.borderRadius = '4px';
                            popupContainer.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
                            popupContainer.style.zIndex = '1000';
                            popupContainer.style.display = 'block';
                        } else {
                            console.error('Failed to open extension popup:', result.error);
                        }
                    } catch (err) {
                        console.error('Error opening extension popup:', err);
                    }
                }
            });
            
            extensionsContainer.appendChild(extensionElement);
        });
        
        // Close popups when clicking elsewhere
        document.addEventListener('click', (e) => {
            if (!extensionsContainer.contains(e.target)) {
                document.querySelectorAll('.extension-popup-container').forEach(popup => {
                    popup.style.display = 'none';
                });
            }
        });
        
    } catch (error) {
        console.error('Failed to load extensions:', error);
    }
}

// Initialize browser
document.addEventListener('DOMContentLoaded', () => {
    // Set up form interception
    setupFormInterception();
    
    // Create first tab
    createTab();
    
    // Load extensions
    loadExtensions();
    
    // Check if there's a URL to open in a new tab
    if (window.openInNewTabURL) {
        createTab(window.openInNewTabURL);
        delete window.openInNewTabURL;
    }
    
    // Listen for open-in-new-tab events from main process
    window.electronAPI.onOpenInNewTab && window.electronAPI.onOpenInNewTab((url) => {
        createTab(url);
    });
});