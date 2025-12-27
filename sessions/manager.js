/**
 * Basset Hound Browser - Session Manager
 * Manages multiple isolated browser sessions with separate cookies, storage, and history
 */

const { session } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Session Manager Class
 * Handles creation, switching, persistence, and isolation of browser sessions
 */
class SessionManager {
  constructor(dataPath) {
    // Directory for persisting session data
    this.dataPath = dataPath || path.join(process.cwd(), 'session-data');

    // Map of session ID to session data
    this.sessions = new Map();

    // Currently active session ID
    this.activeSessionId = 'default';

    // Navigation history per session
    this.history = new Map();

    // Download tracking per session
    this.downloads = new Map();

    // Ensure data directory exists
    this.ensureDataDirectory();

    // Load persisted sessions
    this.loadPersistedSessions();

    // Initialize default session
    this.initializeSession('default', { name: 'Default Session' });
  }

  /**
   * Ensure the data directory exists
   */
  ensureDataDirectory() {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  /**
   * Load persisted sessions from disk
   */
  loadPersistedSessions() {
    const sessionsFile = path.join(this.dataPath, 'sessions.json');

    if (fs.existsSync(sessionsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));

        // Restore session metadata
        if (data.sessions) {
          for (const [id, sessionData] of Object.entries(data.sessions)) {
            if (id !== 'default') {
              this.sessions.set(id, {
                ...sessionData,
                electronSession: null // Will be created on demand
              });
            }
          }
        }

        // Restore history
        if (data.history) {
          for (const [id, historyData] of Object.entries(data.history)) {
            this.history.set(id, historyData);
          }
        }

        console.log(`[SessionManager] Loaded ${this.sessions.size} sessions from disk`);
      } catch (error) {
        console.error('[SessionManager] Error loading persisted sessions:', error);
      }
    }
  }

  /**
   * Save sessions to disk
   */
  persistSessions() {
    const sessionsFile = path.join(this.dataPath, 'sessions.json');

    try {
      const sessionsData = {};
      for (const [id, sessionData] of this.sessions.entries()) {
        sessionsData[id] = {
          id: sessionData.id,
          name: sessionData.name,
          createdAt: sessionData.createdAt,
          userAgent: sessionData.userAgent,
          fingerprint: sessionData.fingerprint
        };
      }

      const historyData = {};
      for (const [id, history] of this.history.entries()) {
        historyData[id] = history;
      }

      const data = {
        sessions: sessionsData,
        history: historyData,
        lastModified: new Date().toISOString()
      };

      fs.writeFileSync(sessionsFile, JSON.stringify(data, null, 2));
      console.log('[SessionManager] Sessions persisted to disk');
    } catch (error) {
      console.error('[SessionManager] Error persisting sessions:', error);
    }
  }

  /**
   * Initialize a new session
   * @param {string} sessionId - Unique session identifier
   * @param {Object} options - Session options
   * @returns {Object} Session data
   */
  initializeSession(sessionId, options = {}) {
    const { name, userAgent, fingerprint } = options;

    // Create isolated partition for the session
    const partition = sessionId === 'default' ? '' : `persist:session-${sessionId}`;
    const electronSession = session.fromPartition(partition);

    // Configure session
    this.configureSession(electronSession, options);

    // Create session data object
    const sessionData = {
      id: sessionId,
      name: name || `Session ${sessionId}`,
      createdAt: new Date().toISOString(),
      partition,
      userAgent,
      fingerprint,
      electronSession
    };

    // Store session
    this.sessions.set(sessionId, sessionData);

    // Initialize history for session
    if (!this.history.has(sessionId)) {
      this.history.set(sessionId, []);
    }

    // Initialize downloads for session
    if (!this.downloads.has(sessionId)) {
      this.downloads.set(sessionId, []);
    }

    // Setup download handler for this session
    this.setupDownloadHandler(electronSession, sessionId);

    console.log(`[SessionManager] Initialized session: ${sessionId}`);

    return sessionData;
  }

  /**
   * Configure session with evasion and privacy settings
   * @param {Session} electronSession - Electron session object
   * @param {Object} options - Configuration options
   */
  configureSession(electronSession, options = {}) {
    const { userAgent } = options;

    // Set user agent if provided
    if (userAgent) {
      electronSession.setUserAgent(userAgent);
    }

    // Modify headers to appear more human
    electronSession.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.9';
      details.requestHeaders['Accept-Encoding'] = 'gzip, deflate, br';
      details.requestHeaders['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
      // Remove automation indicators
      delete details.requestHeaders['Sec-Ch-Ua-Platform'];
      callback({ requestHeaders: details.requestHeaders });
    });

    // Remove CSP headers that might interfere with evasion scripts
    electronSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [''],
        },
      });
    });
  }

  /**
   * Setup download handler for a session
   * @param {Session} electronSession - Electron session object
   * @param {string} sessionId - Session identifier
   */
  setupDownloadHandler(electronSession, sessionId) {
    electronSession.on('will-download', (event, item, webContents) => {
      const downloadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const downloadInfo = {
        id: downloadId,
        sessionId,
        filename: item.getFilename(),
        url: item.getURL(),
        totalBytes: item.getTotalBytes(),
        receivedBytes: 0,
        state: 'progressing',
        startTime: new Date().toISOString(),
        savePath: null,
        mimeType: item.getMimeType()
      };

      // Add to downloads list
      const sessionDownloads = this.downloads.get(sessionId) || [];
      sessionDownloads.push(downloadInfo);
      this.downloads.set(sessionId, sessionDownloads);

      // Set save path
      const downloadsDir = path.join(this.dataPath, 'downloads', sessionId);
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
      }
      const savePath = path.join(downloadsDir, item.getFilename());
      item.setSavePath(savePath);
      downloadInfo.savePath = savePath;

      // Track progress
      item.on('updated', (event, state) => {
        downloadInfo.receivedBytes = item.getReceivedBytes();
        downloadInfo.state = state;
      });

      // Handle completion
      item.once('done', (event, state) => {
        downloadInfo.state = state;
        downloadInfo.endTime = new Date().toISOString();
        console.log(`[SessionManager] Download ${state}: ${downloadInfo.filename}`);
      });

      console.log(`[SessionManager] Download started: ${downloadInfo.filename}`);
    });
  }

  /**
   * Create a new session
   * @param {Object} options - Session options
   * @returns {Object} Created session data
   */
  createSession(options = {}) {
    const sessionId = options.id || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (this.sessions.has(sessionId)) {
      return { success: false, error: 'Session already exists' };
    }

    const sessionData = this.initializeSession(sessionId, options);
    this.persistSessions();

    return {
      success: true,
      session: {
        id: sessionData.id,
        name: sessionData.name,
        createdAt: sessionData.createdAt
      }
    };
  }

  /**
   * Switch to a different session
   * @param {string} sessionId - Session to switch to
   * @returns {Object} Result
   */
  switchSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      // Try to initialize from persisted data
      const persisted = this.sessions.get(sessionId);
      if (!persisted) {
        return { success: false, error: 'Session not found' };
      }
      this.initializeSession(sessionId, persisted);
    }

    this.activeSessionId = sessionId;
    console.log(`[SessionManager] Switched to session: ${sessionId}`);

    return {
      success: true,
      sessionId,
      session: this.getSessionInfo(sessionId)
    };
  }

  /**
   * Delete a session
   * @param {string} sessionId - Session to delete
   * @returns {Object} Result
   */
  async deleteSession(sessionId) {
    if (sessionId === 'default') {
      return { success: false, error: 'Cannot delete default session' };
    }

    if (!this.sessions.has(sessionId)) {
      return { success: false, error: 'Session not found' };
    }

    const sessionData = this.sessions.get(sessionId);

    // Clear session data
    if (sessionData.electronSession) {
      try {
        await sessionData.electronSession.clearStorageData();
        await sessionData.electronSession.clearCache();
      } catch (error) {
        console.error(`[SessionManager] Error clearing session data: ${error.message}`);
      }
    }

    // Remove session files
    const sessionDir = path.join(this.dataPath, 'sessions', sessionId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }

    // Remove from maps
    this.sessions.delete(sessionId);
    this.history.delete(sessionId);
    this.downloads.delete(sessionId);

    // Switch to default if we deleted the active session
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = 'default';
    }

    this.persistSessions();

    console.log(`[SessionManager] Deleted session: ${sessionId}`);

    return { success: true };
  }

  /**
   * List all sessions
   * @returns {Array} List of session info
   */
  listSessions() {
    const sessions = [];

    for (const [id, data] of this.sessions.entries()) {
      sessions.push({
        id: data.id,
        name: data.name,
        createdAt: data.createdAt,
        isActive: id === this.activeSessionId,
        historyCount: (this.history.get(id) || []).length,
        downloadCount: (this.downloads.get(id) || []).length
      });
    }

    return { success: true, sessions };
  }

  /**
   * Get session info
   * @param {string} sessionId - Session identifier
   * @returns {Object} Session info
   */
  getSessionInfo(sessionId) {
    const data = this.sessions.get(sessionId);

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      createdAt: data.createdAt,
      isActive: sessionId === this.activeSessionId,
      historyCount: (this.history.get(sessionId) || []).length,
      downloadCount: (this.downloads.get(sessionId) || []).length
    };
  }

  /**
   * Get the active Electron session
   * @returns {Session} Active Electron session
   */
  getActiveSession() {
    const sessionData = this.sessions.get(this.activeSessionId);

    if (!sessionData || !sessionData.electronSession) {
      return session.defaultSession;
    }

    return sessionData.electronSession;
  }

  /**
   * Get the partition string for the active session
   * @returns {string} Partition string
   */
  getActivePartition() {
    const sessionData = this.sessions.get(this.activeSessionId);

    if (!sessionData) {
      return '';
    }

    return sessionData.partition;
  }

  /**
   * Add navigation entry to history
   * @param {string} sessionId - Session identifier
   * @param {Object} entry - Navigation entry
   */
  addToHistory(sessionId, entry) {
    const id = sessionId || this.activeSessionId;
    const history = this.history.get(id) || [];

    const historyEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url: entry.url,
      title: entry.title || '',
      timestamp: new Date().toISOString(),
      favicon: entry.favicon || null
    };

    history.push(historyEntry);

    // Limit history to last 1000 entries
    if (history.length > 1000) {
      history.shift();
    }

    this.history.set(id, history);

    // Persist periodically (every 10 entries)
    if (history.length % 10 === 0) {
      this.persistSessions();
    }
  }

  /**
   * Get history for a session
   * @param {string} sessionId - Session identifier
   * @param {Object} options - Query options
   * @returns {Object} History entries
   */
  getHistory(sessionId, options = {}) {
    const id = sessionId || this.activeSessionId;
    const history = this.history.get(id) || [];

    const { limit = 100, offset = 0, search } = options;

    let filteredHistory = history;

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      filteredHistory = history.filter(entry =>
        entry.url.toLowerCase().includes(searchLower) ||
        (entry.title && entry.title.toLowerCase().includes(searchLower))
      );
    }

    // Sort by timestamp descending (most recent first)
    filteredHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    const paginated = filteredHistory.slice(offset, offset + limit);

    return {
      success: true,
      sessionId: id,
      total: filteredHistory.length,
      history: paginated
    };
  }

  /**
   * Search history across all sessions or a specific session
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} Search results
   */
  searchHistory(query, options = {}) {
    const { sessionId, limit = 100 } = options;
    const queryLower = query.toLowerCase();

    const results = [];
    const sessionsToSearch = sessionId
      ? [sessionId]
      : Array.from(this.history.keys());

    for (const sid of sessionsToSearch) {
      const history = this.history.get(sid) || [];

      for (const entry of history) {
        if (entry.url.toLowerCase().includes(queryLower) ||
            (entry.title && entry.title.toLowerCase().includes(queryLower))) {
          results.push({
            ...entry,
            sessionId: sid
          });
        }
      }
    }

    // Sort by timestamp descending
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      success: true,
      query,
      total: results.length,
      results: results.slice(0, limit)
    };
  }

  /**
   * Clear history for a session
   * @param {string} sessionId - Session identifier
   * @returns {Object} Result
   */
  clearHistory(sessionId) {
    const id = sessionId || this.activeSessionId;

    this.history.set(id, []);
    this.persistSessions();

    console.log(`[SessionManager] Cleared history for session: ${id}`);

    return { success: true, sessionId: id };
  }

  /**
   * Get downloads for a session
   * @param {string} sessionId - Session identifier
   * @param {Object} options - Query options
   * @returns {Object} Downloads list
   */
  getDownloads(sessionId, options = {}) {
    const id = sessionId || this.activeSessionId;
    const downloads = this.downloads.get(id) || [];

    const { limit = 50, state } = options;

    let filteredDownloads = downloads;

    // Filter by state if provided
    if (state) {
      filteredDownloads = downloads.filter(d => d.state === state);
    }

    // Sort by start time descending
    filteredDownloads.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    return {
      success: true,
      sessionId: id,
      total: filteredDownloads.length,
      downloads: filteredDownloads.slice(0, limit)
    };
  }

  /**
   * Initiate a download
   * @param {string} url - URL to download
   * @param {Object} options - Download options
   * @returns {Object} Result
   */
  downloadFile(url, options = {}) {
    const { sessionId, filename } = options;
    const id = sessionId || this.activeSessionId;
    const sessionData = this.sessions.get(id);

    if (!sessionData || !sessionData.electronSession) {
      return { success: false, error: 'Session not found' };
    }

    // The download will be handled by the will-download event
    return {
      success: true,
      message: 'Download initiated',
      url,
      sessionId: id
    };
  }

  /**
   * Cancel a download
   * @param {string} downloadId - Download identifier
   * @returns {Object} Result
   */
  cancelDownload(downloadId) {
    for (const [sessionId, downloads] of this.downloads.entries()) {
      const download = downloads.find(d => d.id === downloadId);

      if (download) {
        download.state = 'cancelled';
        download.endTime = new Date().toISOString();

        console.log(`[SessionManager] Cancelled download: ${download.filename}`);

        return { success: true, downloadId };
      }
    }

    return { success: false, error: 'Download not found' };
  }

  /**
   * Export session data
   * @param {string} sessionId - Session to export
   * @returns {Object} Session export data
   */
  async exportSession(sessionId) {
    const id = sessionId || this.activeSessionId;
    const sessionData = this.sessions.get(id);

    if (!sessionData) {
      return { success: false, error: 'Session not found' };
    }

    // Get cookies
    let cookies = [];
    if (sessionData.electronSession) {
      try {
        cookies = await sessionData.electronSession.cookies.get({});
      } catch (error) {
        console.error(`[SessionManager] Error getting cookies: ${error.message}`);
      }
    }

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      session: {
        id: sessionData.id,
        name: sessionData.name,
        createdAt: sessionData.createdAt,
        userAgent: sessionData.userAgent,
        fingerprint: sessionData.fingerprint
      },
      cookies,
      history: this.history.get(id) || []
    };

    return {
      success: true,
      data: exportData
    };
  }

  /**
   * Import session data
   * @param {Object} importData - Session data to import
   * @returns {Object} Result
   */
  async importSession(importData) {
    try {
      const { session: sessionInfo, cookies, history } = importData;

      if (!sessionInfo) {
        return { success: false, error: 'Invalid import data: missing session info' };
      }

      // Generate new ID to avoid conflicts
      const newId = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create the session
      const sessionData = this.initializeSession(newId, {
        name: `${sessionInfo.name} (Imported)`,
        userAgent: sessionInfo.userAgent,
        fingerprint: sessionInfo.fingerprint
      });

      // Import cookies
      if (cookies && Array.isArray(cookies) && sessionData.electronSession) {
        for (const cookie of cookies) {
          try {
            await sessionData.electronSession.cookies.set(cookie);
          } catch (error) {
            console.error(`[SessionManager] Error setting cookie: ${error.message}`);
          }
        }
      }

      // Import history
      if (history && Array.isArray(history)) {
        this.history.set(newId, history);
      }

      this.persistSessions();

      console.log(`[SessionManager] Imported session as: ${newId}`);

      return {
        success: true,
        sessionId: newId,
        session: this.getSessionInfo(newId)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get cookies for a session
   * @param {string} sessionId - Session identifier
   * @param {string} url - Optional URL to filter cookies
   * @returns {Object} Cookies
   */
  async getCookies(sessionId, url) {
    const id = sessionId || this.activeSessionId;
    const sessionData = this.sessions.get(id);

    if (!sessionData || !sessionData.electronSession) {
      return { success: false, error: 'Session not found' };
    }

    try {
      const filter = url ? { url } : {};
      const cookies = await sessionData.electronSession.cookies.get(filter);

      return { success: true, cookies };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Set cookies for a session
   * @param {string} sessionId - Session identifier
   * @param {Array} cookies - Cookies to set
   * @returns {Object} Result
   */
  async setCookies(sessionId, cookies) {
    const id = sessionId || this.activeSessionId;
    const sessionData = this.sessions.get(id);

    if (!sessionData || !sessionData.electronSession) {
      return { success: false, error: 'Session not found' };
    }

    try {
      for (const cookie of cookies) {
        await sessionData.electronSession.cookies.set(cookie);
      }

      return { success: true, count: cookies.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all data for a session (cookies, cache, storage)
   * @param {string} sessionId - Session identifier
   * @returns {Object} Result
   */
  async clearSessionData(sessionId) {
    const id = sessionId || this.activeSessionId;
    const sessionData = this.sessions.get(id);

    if (!sessionData || !sessionData.electronSession) {
      return { success: false, error: 'Session not found' };
    }

    try {
      await sessionData.electronSession.clearStorageData();
      await sessionData.electronSession.clearCache();

      console.log(`[SessionManager] Cleared all data for session: ${id}`);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Cleanup and close all sessions
   */
  async cleanup() {
    this.persistSessions();

    for (const [id, sessionData] of this.sessions.entries()) {
      if (sessionData.electronSession && id !== 'default') {
        try {
          await sessionData.electronSession.clearCache();
        } catch (error) {
          console.error(`[SessionManager] Error cleaning up session ${id}: ${error.message}`);
        }
      }
    }

    console.log('[SessionManager] Cleanup complete');
  }
}

module.exports = SessionManager;
