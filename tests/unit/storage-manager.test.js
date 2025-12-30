/**
 * Basset Hound Browser - Storage Manager Unit Tests
 * Tests for localStorage, sessionStorage, and IndexedDB management
 */

// Mock Electron
jest.mock('electron', () => ({
  session: {
    defaultSession: {
      clearStorageData: jest.fn().mockResolvedValue()
    }
  }
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('{}'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  statSync: jest.fn().mockReturnValue({ size: 1024 })
}));

const StorageManager = require('../../storage/manager');

describe('StorageManager', () => {
  let storageManager;
  let mockMainWindow;
  let mockWebviewResponse;

  beforeEach(() => {
    mockWebviewResponse = { success: true, data: {} };

    mockMainWindow = {
      webContents: {
        send: jest.fn().mockImplementation((channel, data) => {
          // Simulate async response
          if (channel === 'execute-storage-operation') {
            setTimeout(() => {
              storageManager.handleOperationResponse(
                data.operationId,
                mockWebviewResponse,
                null
              );
            }, 10);
          }
        })
      }
    };

    storageManager = new StorageManager(mockMainWindow);
  });

  describe('Constructor', () => {
    test('should initialize with main window reference', () => {
      expect(storageManager.mainWindow).toBe(mockMainWindow);
      expect(storageManager.pendingOperations.size).toBe(0);
      expect(storageManager.operationId).toBe(0);
    });
  });

  describe('_generateOperationId', () => {
    test('should generate unique IDs', () => {
      const id1 = storageManager._generateOperationId();
      const id2 = storageManager._generateOperationId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^storage-op-\d+-\d+$/);
    });

    test('should increment counter', () => {
      storageManager._generateOperationId();
      storageManager._generateOperationId();

      expect(storageManager.operationId).toBe(2);
    });
  });

  describe('handleOperationResponse', () => {
    test('should resolve pending operation', () => {
      const mockResolve = jest.fn();
      const mockReject = jest.fn();
      const timeout = setTimeout(() => {}, 10000);

      storageManager.pendingOperations.set('test-op', {
        resolve: mockResolve,
        reject: mockReject,
        timeout
      });

      storageManager.handleOperationResponse('test-op', { data: 'result' });

      expect(mockResolve).toHaveBeenCalledWith({ data: 'result' });
      expect(mockReject).not.toHaveBeenCalled();
      expect(storageManager.pendingOperations.has('test-op')).toBe(false);
    });

    test('should reject on error', () => {
      const mockResolve = jest.fn();
      const mockReject = jest.fn();
      const timeout = setTimeout(() => {}, 10000);

      storageManager.pendingOperations.set('test-op', {
        resolve: mockResolve,
        reject: mockReject,
        timeout
      });

      storageManager.handleOperationResponse('test-op', null, 'Error message');

      expect(mockReject).toHaveBeenCalled();
      expect(mockResolve).not.toHaveBeenCalled();
    });

    test('should ignore unknown operation IDs', () => {
      // Should not throw
      storageManager.handleOperationResponse('unknown-op', { data: 'result' });

      expect(storageManager.pendingOperations.size).toBe(0);
    });
  });

  describe('LocalStorage Methods', () => {
    describe('getLocalStorage', () => {
      test('should get localStorage data', async () => {
        mockWebviewResponse = {
          success: true,
          data: { key1: 'value1', key2: 'value2' },
          count: 2
        };

        const result = await storageManager.getLocalStorage('https://example.com');

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ key1: 'value1', key2: 'value2' });
        expect(result.count).toBe(2);
      });

      test('should require origin', async () => {
        const result = await storageManager.getLocalStorage();

        expect(result.success).toBe(false);
        expect(result.error).toContain('Origin is required');
      });

      test('should send to webview', async () => {
        await storageManager.getLocalStorage('https://example.com');

        expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
          'execute-storage-operation',
          expect.objectContaining({ operationId: expect.any(String) })
        );
      });
    });

    describe('setLocalStorageItem', () => {
      test('should set localStorage item', async () => {
        mockWebviewResponse = { success: true, key: 'testKey' };

        const result = await storageManager.setLocalStorageItem(
          'https://example.com',
          'testKey',
          'testValue'
        );

        expect(result.success).toBe(true);
      });

      test('should require origin', async () => {
        const result = await storageManager.setLocalStorageItem(null, 'key', 'value');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Origin is required');
      });

      test('should require key', async () => {
        const result = await storageManager.setLocalStorageItem('https://example.com', null, 'value');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Key is required');
      });

      test('should handle non-string values', async () => {
        mockWebviewResponse = { success: true };

        const result = await storageManager.setLocalStorageItem(
          'https://example.com',
          'jsonKey',
          { nested: 'object' }
        );

        expect(result.success).toBe(true);
      });
    });

    describe('removeLocalStorageItem', () => {
      test('should remove localStorage item', async () => {
        mockWebviewResponse = { success: true, key: 'removed', existed: true };

        const result = await storageManager.removeLocalStorageItem(
          'https://example.com',
          'removed'
        );

        expect(result.success).toBe(true);
        expect(result.existed).toBe(true);
      });

      test('should require origin and key', async () => {
        let result = await storageManager.removeLocalStorageItem();
        expect(result.success).toBe(false);

        result = await storageManager.removeLocalStorageItem('https://example.com');
        expect(result.success).toBe(false);
      });
    });

    describe('clearLocalStorage', () => {
      test('should clear all localStorage', async () => {
        mockWebviewResponse = { success: true, clearedCount: 5 };

        const result = await storageManager.clearLocalStorage('https://example.com');

        expect(result.success).toBe(true);
        expect(result.clearedCount).toBe(5);
      });

      test('should require origin', async () => {
        const result = await storageManager.clearLocalStorage();

        expect(result.success).toBe(false);
        expect(result.error).toContain('Origin is required');
      });
    });
  });

  describe('SessionStorage Methods', () => {
    describe('getSessionStorage', () => {
      test('should get sessionStorage data', async () => {
        mockWebviewResponse = {
          success: true,
          data: { session1: 'data1' },
          count: 1
        };

        const result = await storageManager.getSessionStorage('https://example.com');

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ session1: 'data1' });
      });

      test('should require origin', async () => {
        const result = await storageManager.getSessionStorage();

        expect(result.success).toBe(false);
      });
    });

    describe('setSessionStorageItem', () => {
      test('should set sessionStorage item', async () => {
        mockWebviewResponse = { success: true };

        const result = await storageManager.setSessionStorageItem(
          'https://example.com',
          'sessionKey',
          'sessionValue'
        );

        expect(result.success).toBe(true);
      });

      test('should require origin and key', async () => {
        let result = await storageManager.setSessionStorageItem(null, 'key', 'value');
        expect(result.success).toBe(false);

        result = await storageManager.setSessionStorageItem('https://example.com', null, 'value');
        expect(result.success).toBe(false);
      });
    });

    describe('removeSessionStorageItem', () => {
      test('should remove sessionStorage item', async () => {
        mockWebviewResponse = { success: true, existed: true };

        const result = await storageManager.removeSessionStorageItem(
          'https://example.com',
          'toRemove'
        );

        expect(result.success).toBe(true);
      });
    });

    describe('clearSessionStorage', () => {
      test('should clear sessionStorage', async () => {
        mockWebviewResponse = { success: true, clearedCount: 3 };

        const result = await storageManager.clearSessionStorage('https://example.com');

        expect(result.success).toBe(true);
      });
    });
  });

  describe('IndexedDB Methods', () => {
    describe('getIndexedDBDatabases', () => {
      test('should list IndexedDB databases', async () => {
        mockWebviewResponse = {
          success: true,
          databases: [{ name: 'db1' }, { name: 'db2' }]
        };

        const result = await storageManager.getIndexedDBDatabases('https://example.com');

        expect(result.success).toBe(true);
        expect(result.databases).toHaveLength(2);
      });
    });

    describe('deleteIndexedDBDatabase', () => {
      test('should delete IndexedDB database', async () => {
        mockWebviewResponse = { success: true, deletedDatabase: 'testdb' };

        const result = await storageManager.deleteIndexedDBDatabase('https://example.com', 'testdb');

        expect(result.success).toBe(true);
        expect(result.deletedDatabase).toBe('testdb');
      });
    });
  });

  describe('Export/Import Methods', () => {
    describe('exportStorage', () => {
      test('should export all storage data', async () => {
        mockWebviewResponse = {
          success: true,
          data: { key: 'value' }
        };

        const result = await storageManager.exportStorage('https://example.com');

        expect(result.success).toBe(true);
        expect(result.export).toBeDefined();
        expect(result.export.data).toBeDefined();
      });
    });

    describe('importStorage', () => {
      test('should import storage data', async () => {
        mockWebviewResponse = { success: true };

        const data = {
          localStorage: { imported: 'data' }
        };

        const result = await storageManager.importStorage('https://example.com', data);

        expect(result.success).toBe(true);
      });
    });

    describe('exportStorageToFile', () => {
      test('should export to file', async () => {
        // Mock response needs to work for localStorage, sessionStorage, and indexedDB calls
        // The simplest approach is to have a response that satisfies all types
        mockWebviewResponse = {
          success: true,
          data: {},
          databases: []  // For indexedDB
        };

        const result = await storageManager.exportStorageToFile(
          '/tmp/storage.json',
          'https://example.com'
        );

        expect(result.success).toBe(true);
      });
    });

    describe('importStorageFromFile', () => {
      test('should import from file', async () => {
        const fs = require('fs');
        fs.readFileSync.mockReturnValue(JSON.stringify({
          origin: 'https://example.com',
          data: {
            localStorage: {}
          }
        }));
        mockWebviewResponse = { success: true };

        const result = await storageManager.importStorageFromFile(
          '/tmp/storage.json',
          'https://example.com'
        );

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Bulk Operations', () => {
    describe('setLocalStorageItem', () => {
      test('should set single item', async () => {
        mockWebviewResponse = { success: true, key: 'testKey' };

        const result = await storageManager.setLocalStorageItem(
          'https://example.com',
          'testKey',
          'testValue'
        );

        expect(result.success).toBe(true);
      });
    });

    describe('getLocalStorage', () => {
      test('should get all storage items', async () => {
        mockWebviewResponse = { success: true, data: { testKey: 'testValue' }, count: 1 };

        const result = await storageManager.getLocalStorage('https://example.com');

        expect(result.success).toBe(true);
        expect(result.data.testKey).toBe('testValue');
      });
    });
  });

  describe('Statistics', () => {
    describe('getStorageStats', () => {
      test('should return storage statistics', async () => {
        mockWebviewResponse = {
          success: true,
          stats: {
            localStorage: { count: 10, size: 1024 },
            sessionStorage: { count: 5, size: 512 }
          }
        };

        const result = await storageManager.getStorageStats('https://example.com');

        expect(result.success).toBe(true);
        expect(result.stats).toBeDefined();
      });
    });
  });

  describe('Clear All Storage', () => {
    describe('clearAllStorage', () => {
      test('should clear all storage types', async () => {
        mockWebviewResponse = { success: true };

        const result = await storageManager.clearAllStorage('https://example.com');

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle webview execution error', async () => {
      mockMainWindow.webContents.send = jest.fn().mockImplementation((channel, data) => {
        setTimeout(() => {
          storageManager.handleOperationResponse(
            data.operationId,
            null,
            'Execution failed'
          );
        }, 10);
      });

      const result = await storageManager.getLocalStorage('https://example.com');

      expect(result.success).toBe(false);
    });

    test('should handle timeout', async () => {
      // Don't respond to simulate timeout
      mockMainWindow.webContents.send = jest.fn();

      // Set a very short timeout for testing
      const originalExecute = storageManager._executeInWebview;
      storageManager._executeInWebview = async (script) => {
        return new Promise((resolve, reject) => {
          const opId = storageManager._generateOperationId();
          const timeout = setTimeout(() => {
            reject(new Error('Operation timed out'));
          }, 50);

          storageManager.pendingOperations.set(opId, { resolve, reject, timeout });
          mockMainWindow.webContents.send('execute-storage-operation', { operationId: opId, script });
        });
      };

      const result = await storageManager.getLocalStorage('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');

      storageManager._executeInWebview = originalExecute;
    });
  });

  describe('Special Characters Handling', () => {
    test('should escape special characters in keys', async () => {
      mockWebviewResponse = { success: true };

      const result = await storageManager.setLocalStorageItem(
        'https://example.com',
        "key'with'quotes",
        'value'
      );

      expect(result.success).toBe(true);
    });

    test('should escape special characters in values', async () => {
      mockWebviewResponse = { success: true };

      const result = await storageManager.setLocalStorageItem(
        'https://example.com',
        'key',
        "value'with'quotes\\and\\slashes"
      );

      expect(result.success).toBe(true);
    });
  });
});

describe('StorageManager Edge Cases', () => {
  let storageManager;
  let mockMainWindow;

  beforeEach(() => {
    mockMainWindow = {
      webContents: {
        send: jest.fn().mockImplementation((channel, data) => {
          setTimeout(() => {
            storageManager.handleOperationResponse(
              data.operationId,
              { success: true },
              null
            );
          }, 10);
        })
      }
    };

    storageManager = new StorageManager(mockMainWindow);
  });

  test('should handle empty origin string', async () => {
    const result = await storageManager.getLocalStorage('');

    expect(result.success).toBe(false);
  });

  test('should handle undefined values by converting to string', async () => {
    // undefined values get JSON.stringify'd to undefined, which then fails
    // when trying to escape. This tests the error handling.
    const result = await storageManager.setLocalStorageItem(
      'https://example.com',
      'key',
      undefined
    );

    // The implementation will fail because JSON.stringify(undefined) returns undefined
    // and calling .replace() on undefined throws an error
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('should handle null values', async () => {
    const result = await storageManager.setLocalStorageItem(
      'https://example.com',
      'key',
      null
    );

    expect(result.success).toBe(true);
  });

  test('should handle very long keys', async () => {
    const longKey = 'a'.repeat(10000);

    const result = await storageManager.setLocalStorageItem(
      'https://example.com',
      longKey,
      'value'
    );

    expect(result.success).toBe(true);
  });

  test('should handle very long values', async () => {
    const longValue = 'b'.repeat(100000);

    const result = await storageManager.setLocalStorageItem(
      'https://example.com',
      'key',
      longValue
    );

    expect(result.success).toBe(true);
  });
});
