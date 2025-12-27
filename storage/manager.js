const { session } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * StorageManager - Comprehensive local storage management for the Basset Hound Browser
 * Provides methods for managing localStorage, sessionStorage, and IndexedDB
 * across different origins with export/import capabilities.
 */
class StorageManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.pendingOperations = new Map();
    this.operationId = 0;
  }

  /**
   * Generate unique operation ID for async operations
   * @returns {string} Unique operation ID
   */
  _generateOperationId() {
    return `storage-op-${++this.operationId}-${Date.now()}`;
  }

  /**
   * Execute JavaScript in the webview context and return result
   * @param {string} script - JavaScript to execute
   * @returns {Promise<any>} Script execution result
   */
  async _executeInWebview(script) {
    return new Promise((resolve, reject) => {
      const opId = this._generateOperationId();
      const timeout = setTimeout(() => {
        this.pendingOperations.delete(opId);
        reject(new Error('Operation timed out'));
      }, 30000);

      this.pendingOperations.set(opId, { resolve, reject, timeout });

      // Send to renderer which will forward to webview
      this.mainWindow.webContents.send('execute-storage-operation', {
        operationId: opId,
        script
      });
    });
  }

  /**
   * Handle storage operation response from renderer
   * @param {string} operationId - Operation ID
   * @param {any} result - Operation result
   * @param {string|null} error - Error message if failed
   */
  handleOperationResponse(operationId, result, error = null) {
    const operation = this.pendingOperations.get(operationId);
    if (operation) {
      clearTimeout(operation.timeout);
      this.pendingOperations.delete(operationId);

      if (error) {
        operation.reject(new Error(error));
      } else {
        operation.resolve(result);
      }
    }
  }

  // ==========================================
  // LocalStorage Methods
  // ==========================================

  /**
   * Get all localStorage items for a specific origin
   * @param {string} origin - The origin URL (e.g., 'https://example.com')
   * @returns {Promise<Object>} Object containing success status and storage data
   */
  async getLocalStorage(origin) {
    if (!origin) {
      return { success: false, error: 'Origin is required' };
    }

    try {
      const script = `
        (function() {
          try {
            const storage = {};
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              const value = localStorage.getItem(key);
              storage[key] = value;
            }
            return { success: true, data: storage, count: localStorage.length };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `;

      const result = await this._executeInWebview(script);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Set a localStorage item for a specific origin
   * @param {string} origin - The origin URL
   * @param {string} key - Storage key
   * @param {string} value - Value to store (will be converted to string)
   * @returns {Promise<Object>} Operation result
   */
  async setLocalStorageItem(origin, key, value) {
    if (!origin) {
      return { success: false, error: 'Origin is required' };
    }
    if (!key) {
      return { success: false, error: 'Key is required' };
    }

    try {
      // Convert value to string if not already
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      const escapedKey = key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const escapedValue = stringValue.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

      const script = `
        (function() {
          try {
            localStorage.setItem('${escapedKey}', '${escapedValue}');
            return { success: true, key: '${escapedKey}' };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `;

      const result = await this._executeInWebview(script);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove a localStorage item for a specific origin
   * @param {string} origin - The origin URL
   * @param {string} key - Storage key to remove
   * @returns {Promise<Object>} Operation result
   */
  async removeLocalStorageItem(origin, key) {
    if (!origin) {
      return { success: false, error: 'Origin is required' };
    }
    if (!key) {
      return { success: false, error: 'Key is required' };
    }

    try {
      const escapedKey = key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

      const script = `
        (function() {
          try {
            const existed = localStorage.getItem('${escapedKey}') !== null;
            localStorage.removeItem('${escapedKey}');
            return { success: true, key: '${escapedKey}', existed };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `;

      const result = await this._executeInWebview(script);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all localStorage for a specific origin
   * @param {string} origin - The origin URL
   * @returns {Promise<Object>} Operation result
   */
  async clearLocalStorage(origin) {
    if (!origin) {
      return { success: false, error: 'Origin is required' };
    }

    try {
      const script = `
        (function() {
          try {
            const count = localStorage.length;
            localStorage.clear();
            return { success: true, clearedCount: count };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `;

      const result = await this._executeInWebview(script);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // SessionStorage Methods
  // ==========================================

  /**
   * Get all sessionStorage items for a specific origin
   * @param {string} origin - The origin URL
   * @returns {Promise<Object>} Object containing success status and storage data
   */
  async getSessionStorage(origin) {
    if (!origin) {
      return { success: false, error: 'Origin is required' };
    }

    try {
      const script = `
        (function() {
          try {
            const storage = {};
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              const value = sessionStorage.getItem(key);
              storage[key] = value;
            }
            return { success: true, data: storage, count: sessionStorage.length };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `;

      const result = await this._executeInWebview(script);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Set a sessionStorage item for a specific origin
   * @param {string} origin - The origin URL
   * @param {string} key - Storage key
   * @param {string} value - Value to store
   * @returns {Promise<Object>} Operation result
   */
  async setSessionStorageItem(origin, key, value) {
    if (!origin) {
      return { success: false, error: 'Origin is required' };
    }
    if (!key) {
      return { success: false, error: 'Key is required' };
    }

    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      const escapedKey = key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const escapedValue = stringValue.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

      const script = `
        (function() {
          try {
            sessionStorage.setItem('${escapedKey}', '${escapedValue}');
            return { success: true, key: '${escapedKey}' };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `;

      const result = await this._executeInWebview(script);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove a sessionStorage item for a specific origin
   * @param {string} origin - The origin URL
   * @param {string} key - Storage key to remove
   * @returns {Promise<Object>} Operation result
   */
  async removeSessionStorageItem(origin, key) {
    if (!origin) {
      return { success: false, error: 'Origin is required' };
    }
    if (!key) {
      return { success: false, error: 'Key is required' };
    }

    try {
      const escapedKey = key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

      const script = `
        (function() {
          try {
            const existed = sessionStorage.getItem('${escapedKey}') !== null;
            sessionStorage.removeItem('${escapedKey}');
            return { success: true, key: '${escapedKey}', existed };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `;

      const result = await this._executeInWebview(script);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all sessionStorage for a specific origin
   * @param {string} origin - The origin URL
   * @returns {Promise<Object>} Operation result
   */
  async clearSessionStorage(origin) {
    if (!origin) {
      return { success: false, error: 'Origin is required' };
    }

    try {
      const script = `
        (function() {
          try {
            const count = sessionStorage.length;
            sessionStorage.clear();
            return { success: true, clearedCount: count };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `;

      const result = await this._executeInWebview(script);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // IndexedDB Methods
  // ==========================================

  /**
   * Get list of IndexedDB databases for a specific origin
   * @param {string} origin - The origin URL
   * @returns {Promise<Object>} Object containing success status and database list
   */
  async getIndexedDBDatabases(origin) {
    if (!origin) {
      return { success: false, error: 'Origin is required' };
    }

    try {
      const script = `
        (function() {
          return new Promise(async (resolve) => {
            try {
              if (!indexedDB.databases) {
                // Fallback for browsers that don't support indexedDB.databases()
                resolve({
                  success: true,
                  databases: [],
                  warning: 'indexedDB.databases() not supported in this browser'
                });
                return;
              }

              const databases = await indexedDB.databases();
              const dbList = databases.map(db => ({
                name: db.name,
                version: db.version
              }));
              resolve({ success: true, databases: dbList, count: dbList.length });
            } catch (e) {
              resolve({ success: false, error: e.message });
            }
          });
        })();
      `;

      const result = await this._executeInWebview(script);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete an IndexedDB database for a specific origin
   * @param {string} origin - The origin URL
   * @param {string} name - Database name to delete
   * @returns {Promise<Object>} Operation result
   */
  async deleteIndexedDBDatabase(origin, name) {
    if (!origin) {
      return { success: false, error: 'Origin is required' };
    }
    if (!name) {
      return { success: false, error: 'Database name is required' };
    }

    try {
      const escapedName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

      const script = `
        (function() {
          return new Promise((resolve) => {
            try {
              const request = indexedDB.deleteDatabase('${escapedName}');

              request.onsuccess = () => {
                resolve({ success: true, deletedDatabase: '${escapedName}' });
              };

              request.onerror = (e) => {
                resolve({ success: false, error: e.target.error?.message || 'Failed to delete database' });
              };

              request.onblocked = () => {
                resolve({ success: false, error: 'Database deletion blocked - close all connections first' });
              };
            } catch (e) {
              resolve({ success: false, error: e.message });
            }
          });
        })();
      `;

      const result = await this._executeInWebview(script);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get IndexedDB database contents (object stores and their data)
   * @param {string} origin - The origin URL
   * @param {string} name - Database name
   * @returns {Promise<Object>} Database contents
   */
  async getIndexedDBContents(origin, name) {
    if (!origin) {
      return { success: false, error: 'Origin is required' };
    }
    if (!name) {
      return { success: false, error: 'Database name is required' };
    }

    try {
      const escapedName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

      const script = `
        (function() {
          return new Promise((resolve) => {
            try {
              const request = indexedDB.open('${escapedName}');

              request.onerror = (e) => {
                resolve({ success: false, error: e.target.error?.message || 'Failed to open database' });
              };

              request.onsuccess = async (event) => {
                const db = event.target.result;
                const result = {
                  name: db.name,
                  version: db.version,
                  objectStores: {}
                };

                const storeNames = Array.from(db.objectStoreNames);

                for (const storeName of storeNames) {
                  try {
                    const transaction = db.transaction(storeName, 'readonly');
                    const store = transaction.objectStore(storeName);

                    const getAllRequest = store.getAll();
                    const storeData = await new Promise((res, rej) => {
                      getAllRequest.onsuccess = () => res(getAllRequest.result);
                      getAllRequest.onerror = () => rej(getAllRequest.error);
                    });

                    result.objectStores[storeName] = {
                      keyPath: store.keyPath,
                      autoIncrement: store.autoIncrement,
                      indexes: Array.from(store.indexNames),
                      data: storeData,
                      count: storeData.length
                    };
                  } catch (storeError) {
                    result.objectStores[storeName] = { error: storeError.message };
                  }
                }

                db.close();
                resolve({ success: true, database: result });
              };
            } catch (e) {
              resolve({ success: false, error: e.message });
            }
          });
        })();
      `;

      const result = await this._executeInWebview(script);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // Export/Import Methods
  // ==========================================

  /**
   * Export storage data for a specific origin
   * @param {string} origin - The origin URL
   * @param {string[]} types - Types to export: ['localStorage', 'sessionStorage', 'indexedDB']
   * @returns {Promise<Object>} Exported storage data
   */
  async exportStorage(origin, types = ['localStorage', 'sessionStorage', 'indexedDB']) {
    if (!origin) {
      return { success: false, error: 'Origin is required' };
    }

    try {
      const exportData = {
        origin,
        exportedAt: new Date().toISOString(),
        version: '1.0',
        data: {}
      };

      // Export localStorage
      if (types.includes('localStorage')) {
        const localStorageResult = await this.getLocalStorage(origin);
        if (localStorageResult.success) {
          exportData.data.localStorage = localStorageResult.data;
        } else {
          exportData.data.localStorage = { error: localStorageResult.error };
        }
      }

      // Export sessionStorage
      if (types.includes('sessionStorage')) {
        const sessionStorageResult = await this.getSessionStorage(origin);
        if (sessionStorageResult.success) {
          exportData.data.sessionStorage = sessionStorageResult.data;
        } else {
          exportData.data.sessionStorage = { error: sessionStorageResult.error };
        }
      }

      // Export IndexedDB
      if (types.includes('indexedDB')) {
        const indexedDBResult = await this.getIndexedDBDatabases(origin);
        if (indexedDBResult.success && indexedDBResult.databases) {
          exportData.data.indexedDB = {};
          for (const db of indexedDBResult.databases) {
            const dbContents = await this.getIndexedDBContents(origin, db.name);
            if (dbContents.success) {
              exportData.data.indexedDB[db.name] = dbContents.database;
            } else {
              exportData.data.indexedDB[db.name] = { error: dbContents.error };
            }
          }
        } else {
          exportData.data.indexedDB = { error: indexedDBResult.error || 'Failed to get databases' };
        }
      }

      return { success: true, export: exportData };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Import storage data for a specific origin
   * @param {string} origin - The origin URL
   * @param {Object} data - Storage data to import (from exportStorage)
   * @returns {Promise<Object>} Import result
   */
  async importStorage(origin, data) {
    if (!origin) {
      return { success: false, error: 'Origin is required' };
    }
    if (!data) {
      return { success: false, error: 'Import data is required' };
    }

    try {
      const results = {
        localStorage: null,
        sessionStorage: null,
        indexedDB: null
      };

      // Get the data object (handle both wrapped and unwrapped formats)
      const storageData = data.data || data;

      // Import localStorage
      if (storageData.localStorage && !storageData.localStorage.error) {
        let localStorageImported = 0;
        let localStorageErrors = [];

        for (const [key, value] of Object.entries(storageData.localStorage)) {
          const result = await this.setLocalStorageItem(origin, key, value);
          if (result.success) {
            localStorageImported++;
          } else {
            localStorageErrors.push({ key, error: result.error });
          }
        }

        results.localStorage = {
          imported: localStorageImported,
          total: Object.keys(storageData.localStorage).length,
          errors: localStorageErrors
        };
      }

      // Import sessionStorage
      if (storageData.sessionStorage && !storageData.sessionStorage.error) {
        let sessionStorageImported = 0;
        let sessionStorageErrors = [];

        for (const [key, value] of Object.entries(storageData.sessionStorage)) {
          const result = await this.setSessionStorageItem(origin, key, value);
          if (result.success) {
            sessionStorageImported++;
          } else {
            sessionStorageErrors.push({ key, error: result.error });
          }
        }

        results.sessionStorage = {
          imported: sessionStorageImported,
          total: Object.keys(storageData.sessionStorage).length,
          errors: sessionStorageErrors
        };
      }

      // Import IndexedDB (more complex - requires recreating databases)
      if (storageData.indexedDB && !storageData.indexedDB.error) {
        results.indexedDB = await this._importIndexedDB(origin, storageData.indexedDB);
      }

      return { success: true, results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Import IndexedDB data
   * @param {string} origin - The origin URL
   * @param {Object} indexedDBData - IndexedDB data to import
   * @returns {Promise<Object>} Import result
   */
  async _importIndexedDB(origin, indexedDBData) {
    const results = {};

    for (const [dbName, dbData] of Object.entries(indexedDBData)) {
      if (dbData.error) {
        results[dbName] = { error: dbData.error };
        continue;
      }

      try {
        const escapedDbName = dbName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const dbDataJson = JSON.stringify(dbData).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        const script = `
          (function() {
            return new Promise((resolve) => {
              try {
                const dbData = JSON.parse('${dbDataJson}');
                const storeNames = Object.keys(dbData.objectStores || {});

                if (storeNames.length === 0) {
                  resolve({ success: true, message: 'No object stores to import' });
                  return;
                }

                const request = indexedDB.open('${escapedDbName}', dbData.version || 1);

                request.onupgradeneeded = (event) => {
                  const db = event.target.result;

                  for (const [storeName, storeData] of Object.entries(dbData.objectStores)) {
                    if (storeData.error) continue;

                    if (!db.objectStoreNames.contains(storeName)) {
                      const storeOptions = {};
                      if (storeData.keyPath) storeOptions.keyPath = storeData.keyPath;
                      if (storeData.autoIncrement) storeOptions.autoIncrement = storeData.autoIncrement;

                      const store = db.createObjectStore(storeName, storeOptions);

                      // Create indexes
                      if (storeData.indexes) {
                        for (const indexName of storeData.indexes) {
                          try {
                            store.createIndex(indexName, indexName);
                          } catch (e) {
                            // Index might already exist or be invalid
                          }
                        }
                      }
                    }
                  }
                };

                request.onsuccess = async (event) => {
                  const db = event.target.result;
                  const importResults = {};

                  for (const [storeName, storeData] of Object.entries(dbData.objectStores)) {
                    if (storeData.error || !storeData.data) {
                      importResults[storeName] = { skipped: true, reason: storeData.error || 'No data' };
                      continue;
                    }

                    try {
                      const transaction = db.transaction(storeName, 'readwrite');
                      const store = transaction.objectStore(storeName);

                      let imported = 0;
                      for (const item of storeData.data) {
                        try {
                          store.put(item);
                          imported++;
                        } catch (e) {
                          // Skip invalid items
                        }
                      }

                      importResults[storeName] = {
                        imported,
                        total: storeData.data.length
                      };
                    } catch (e) {
                      importResults[storeName] = { error: e.message };
                    }
                  }

                  db.close();
                  resolve({ success: true, stores: importResults });
                };

                request.onerror = (e) => {
                  resolve({ success: false, error: e.target.error?.message || 'Failed to open database' });
                };
              } catch (e) {
                resolve({ success: false, error: e.message });
              }
            });
          })();
        `;

        const result = await this._executeInWebview(script);
        results[dbName] = result;
      } catch (error) {
        results[dbName] = { error: error.message };
      }
    }

    return results;
  }

  /**
   * Export storage to a file
   * @param {string} filepath - Path to save the export file
   * @param {string} origin - The origin URL
   * @param {string[]} types - Types to export
   * @returns {Promise<Object>} Export result
   */
  async exportStorageToFile(filepath, origin, types = ['localStorage', 'sessionStorage', 'indexedDB']) {
    if (!filepath) {
      return { success: false, error: 'Filepath is required' };
    }

    try {
      const exportResult = await this.exportStorage(origin, types);

      if (!exportResult.success) {
        return exportResult;
      }

      // Ensure directory exists
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write to file
      fs.writeFileSync(filepath, JSON.stringify(exportResult.export, null, 2), 'utf8');

      return {
        success: true,
        filepath,
        origin,
        exportedTypes: types,
        size: fs.statSync(filepath).size
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Import storage from a file
   * @param {string} filepath - Path to the import file
   * @param {string} origin - The origin URL (overrides file origin if provided)
   * @returns {Promise<Object>} Import result
   */
  async importStorageFromFile(filepath, origin = null) {
    if (!filepath) {
      return { success: false, error: 'Filepath is required' };
    }

    try {
      // Check file exists
      if (!fs.existsSync(filepath)) {
        return { success: false, error: 'File not found' };
      }

      // Read file
      const fileContent = fs.readFileSync(filepath, 'utf8');
      let importData;

      try {
        importData = JSON.parse(fileContent);
      } catch (e) {
        return { success: false, error: 'Invalid JSON in file' };
      }

      // Use provided origin or file's origin
      const targetOrigin = origin || importData.origin;

      if (!targetOrigin) {
        return { success: false, error: 'Origin not specified and not found in file' };
      }

      // Import the data
      const importResult = await this.importStorage(targetOrigin, importData);

      return {
        ...importResult,
        filepath,
        origin: targetOrigin,
        fileVersion: importData.version,
        originalExportDate: importData.exportedAt
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  /**
   * Get storage usage statistics for an origin
   * @param {string} origin - The origin URL
   * @returns {Promise<Object>} Storage statistics
   */
  async getStorageStats(origin) {
    if (!origin) {
      return { success: false, error: 'Origin is required' };
    }

    try {
      const script = `
        (function() {
          return new Promise(async (resolve) => {
            try {
              const stats = {
                localStorage: {
                  count: localStorage.length,
                  estimatedSize: 0
                },
                sessionStorage: {
                  count: sessionStorage.length,
                  estimatedSize: 0
                },
                indexedDB: {
                  databases: 0
                }
              };

              // Calculate localStorage size
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                stats.localStorage.estimatedSize += (key.length + value.length) * 2; // UTF-16
              }

              // Calculate sessionStorage size
              for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                const value = sessionStorage.getItem(key);
                stats.sessionStorage.estimatedSize += (key.length + value.length) * 2;
              }

              // Count IndexedDB databases
              if (indexedDB.databases) {
                try {
                  const dbs = await indexedDB.databases();
                  stats.indexedDB.databases = dbs.length;
                  stats.indexedDB.databaseNames = dbs.map(db => db.name);
                } catch (e) {
                  stats.indexedDB.error = e.message;
                }
              }

              // Try to get storage estimate if available
              if (navigator.storage && navigator.storage.estimate) {
                try {
                  const estimate = await navigator.storage.estimate();
                  stats.quota = {
                    usage: estimate.usage,
                    quota: estimate.quota,
                    usagePercentage: ((estimate.usage / estimate.quota) * 100).toFixed(2) + '%'
                  };
                } catch (e) {
                  stats.quota = { error: e.message };
                }
              }

              resolve({ success: true, stats });
            } catch (e) {
              resolve({ success: false, error: e.message });
            }
          });
        })();
      `;

      const result = await this._executeInWebview(script);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all storage for an origin
   * @param {string} origin - The origin URL
   * @param {string[]} types - Types to clear
   * @returns {Promise<Object>} Clear result
   */
  async clearAllStorage(origin, types = ['localStorage', 'sessionStorage', 'indexedDB']) {
    if (!origin) {
      return { success: false, error: 'Origin is required' };
    }

    try {
      const results = {};

      if (types.includes('localStorage')) {
        results.localStorage = await this.clearLocalStorage(origin);
      }

      if (types.includes('sessionStorage')) {
        results.sessionStorage = await this.clearSessionStorage(origin);
      }

      if (types.includes('indexedDB')) {
        const dbResult = await this.getIndexedDBDatabases(origin);
        if (dbResult.success && dbResult.databases) {
          results.indexedDB = {};
          for (const db of dbResult.databases) {
            results.indexedDB[db.name] = await this.deleteIndexedDBDatabase(origin, db.name);
          }
        } else {
          results.indexedDB = { error: dbResult.error || 'Failed to get databases' };
        }
      }

      return { success: true, results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Cleanup pending operations
   */
  cleanup() {
    for (const [opId, operation] of this.pendingOperations) {
      clearTimeout(operation.timeout);
      operation.reject(new Error('Operation cancelled - cleanup'));
    }
    this.pendingOperations.clear();
  }
}

module.exports = StorageManager;
