/**
 * Basset Hound Browser - Download Manager Integration Tests
 * Tests for download management with complete session mock support
 */

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

// Create mock session with download support
const createMockSession = () => {
  const listeners = {};
  return {
    webRequest: {
      onBeforeRequest: jest.fn(),
      on: jest.fn()
    },
    on: jest.fn((event, handler) => {
      listeners[event] = handler;
    }),
    _listeners: listeners
  };
};

const mockDefaultSession = createMockSession();

jest.mock('electron', () => ({
  session: {
    defaultSession: mockDefaultSession,
    fromPartition: jest.fn(() => createMockSession())
  },
  app: {
    getPath: jest.fn().mockReturnValue('/mock/downloads')
  }
}));

const { DownloadManager, Download, DOWNLOAD_STATE, formatBytes } = require('../../downloads/manager');
const { session, app } = require('electron');
const fs = require('fs');

describe('DownloadManager Integration', () => {
  let downloadManager;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);

    // Create fresh instance
    downloadManager = new DownloadManager({
      downloadPath: '/mock/downloads',
      maxConcurrentDownloads: 3
    });
  });

  afterEach(() => {
    if (downloadManager) {
      downloadManager.cleanup();
    }
  });

  describe('Download Class', () => {
    test('should create download with default values', () => {
      const download = new Download();

      expect(download.id).toMatch(/^download-/);
      expect(download.state).toBe(DOWNLOAD_STATE.PENDING);
      expect(download.received).toBe(0);
      expect(download.size).toBe(0);
    });

    test('should create download with custom values', () => {
      const download = new Download({
        url: 'https://example.com/file.zip',
        filename: 'file.zip',
        size: 1024
      });

      expect(download.url).toBe('https://example.com/file.zip');
      expect(download.filename).toBe('file.zip');
      expect(download.size).toBe(1024);
    });

    test('should calculate progress correctly', () => {
      const download = new Download({
        size: 1000,
        received: 500
      });

      expect(download.getProgress()).toBe(50);
    });

    test('should return 0 progress for zero size', () => {
      const download = new Download({
        size: 0,
        received: 100
      });

      expect(download.getProgress()).toBe(0);
    });

    test('should calculate ETA', () => {
      const download = new Download({
        size: 1000,
        received: 500
      });
      download.speed = 100;

      const eta = download.getETA();

      expect(eta).toBe(5);
    });

    test('should return null ETA when speed is 0', () => {
      const download = new Download({
        size: 1000,
        received: 500
      });
      download.speed = 0;

      expect(download.getETA()).toBeNull();
    });

    test('should serialize to JSON', () => {
      const download = new Download({
        url: 'https://example.com/file.zip',
        filename: 'file.zip',
        size: 1024,
        received: 512
      });

      const json = download.toJSON();

      expect(json.url).toBe('https://example.com/file.zip');
      expect(json.filename).toBe('file.zip');
      expect(json.progress).toBe(50);
      expect(json).not.toHaveProperty('_downloadItem');
    });
  });

  describe('DownloadManager Initialization', () => {
    test('should initialize with custom download path', () => {
      expect(downloadManager.downloadPath).toBe('/mock/downloads');
    });

    test('should initialize with max concurrent downloads', () => {
      expect(downloadManager.maxConcurrentDownloads).toBe(3);
    });

    test('should have empty downloads map', () => {
      expect(downloadManager.downloads.size).toBe(0);
    });
  });

  describe('Download Path Management', () => {
    test('should set download path when directory exists', () => {
      fs.existsSync.mockReturnValue(true);

      const result = downloadManager.setDownloadPath('/new/path');

      expect(result.success).toBe(true);
      expect(downloadManager.downloadPath).toBe('/new/path');
    });

    test('should create directory if needed when setting path', () => {
      fs.existsSync.mockReturnValue(false);

      const result = downloadManager.setDownloadPath('/new/path');

      expect(result.success).toBe(true);
      expect(fs.mkdirSync).toHaveBeenCalledWith('/new/path', { recursive: true });
    });

    test('should get download path', () => {
      const path = downloadManager.getDownloadPath();

      expect(path).toBe('/mock/downloads');
    });
  });

  describe('Starting Downloads', () => {
    test('should start a download', () => {
      const result = downloadManager.startDownload('https://example.com/file.zip');

      expect(result.success).toBe(true);
      expect(result.download).toBeDefined();
      expect(result.download.url).toBe('https://example.com/file.zip');
      expect(downloadManager.downloads.size).toBe(1);
    });

    test('should start download with custom filename', () => {
      const result = downloadManager.startDownload('https://example.com/file.zip', {
        filename: 'custom-name.zip'
      });

      expect(result.success).toBe(true);
      expect(result.download.filename).toBe('custom-name.zip');
    });

    test('should emit download-started event', () => {
      const handler = jest.fn();
      downloadManager.on('download-started', handler);

      downloadManager.startDownload('https://example.com/file.zip');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Download Operations', () => {
    let downloadId;

    beforeEach(() => {
      const result = downloadManager.startDownload('https://example.com/file.zip');
      downloadId = result.download.id;

      // Setup mock downloadItem
      const download = downloadManager.downloads.get(downloadId);
      download.state = DOWNLOAD_STATE.IN_PROGRESS;
      download._downloadItem = {
        pause: jest.fn(),
        resume: jest.fn(),
        cancel: jest.fn(),
        canResume: jest.fn().mockReturnValue(true),
        isPaused: jest.fn().mockReturnValue(false)
      };
    });

    test('should pause a download', () => {
      const result = downloadManager.pauseDownload(downloadId);

      expect(result.success).toBe(true);
      expect(result.download.state).toBe(DOWNLOAD_STATE.PAUSED);
    });

    test('should return error when pausing non-existent download', () => {
      const result = downloadManager.pauseDownload('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should resume a paused download', () => {
      downloadManager.pauseDownload(downloadId);
      const result = downloadManager.resumeDownload(downloadId);

      expect(result.success).toBe(true);
      expect(result.download.state).toBe(DOWNLOAD_STATE.IN_PROGRESS);
    });

    test('should return error when resuming non-paused download', () => {
      const result = downloadManager.resumeDownload(downloadId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not paused');
    });

    test('should cancel a download', () => {
      const result = downloadManager.cancelDownload(downloadId);

      expect(result.success).toBe(true);
      expect(result.download.state).toBe(DOWNLOAD_STATE.CANCELLED);
    });
  });

  describe('Getting Download Info', () => {
    beforeEach(() => {
      downloadManager.startDownload('https://example.com/file1.zip');
      downloadManager.startDownload('https://example.com/file2.zip');
    });

    test('should get download by ID', () => {
      const downloads = Array.from(downloadManager.downloads.values());
      const result = downloadManager.getDownload(downloads[0].id);

      expect(result.success).toBe(true);
      expect(result.download).toBeDefined();
    });

    test('should return error for non-existent download', () => {
      const result = downloadManager.getDownload('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should get active downloads', () => {
      const downloads = Array.from(downloadManager.downloads.values());
      downloads[0].state = DOWNLOAD_STATE.IN_PROGRESS;

      const result = downloadManager.getActiveDownloads();

      expect(result.success).toBe(true);
      expect(result.downloads).toHaveLength(1);
    });

    test('should get completed downloads', () => {
      const downloads = Array.from(downloadManager.downloads.values());
      downloads[0].state = DOWNLOAD_STATE.COMPLETED;

      const result = downloadManager.getCompletedDownloads();

      expect(result.success).toBe(true);
      expect(result.downloads).toHaveLength(1);
    });

    test('should get all downloads', () => {
      const result = downloadManager.getAllDownloads();

      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
    });

    test('should filter downloads by state', () => {
      const downloads = Array.from(downloadManager.downloads.values());
      downloads[0].state = DOWNLOAD_STATE.COMPLETED;

      const result = downloadManager.getAllDownloads({ state: DOWNLOAD_STATE.COMPLETED });

      expect(result.downloads).toHaveLength(1);
    });

    test('should limit downloads returned', () => {
      const result = downloadManager.getAllDownloads({ limit: 1 });

      expect(result.downloads).toHaveLength(1);
    });
  });

  describe('Clearing Downloads', () => {
    beforeEach(() => {
      downloadManager.startDownload('https://example.com/file1.zip');
      downloadManager.startDownload('https://example.com/file2.zip');

      const downloads = Array.from(downloadManager.downloads.values());
      downloads[0].state = DOWNLOAD_STATE.COMPLETED;
      downloads[1].state = DOWNLOAD_STATE.PENDING;
    });

    test('should clear completed downloads', () => {
      const result = downloadManager.clearCompleted();

      expect(result.success).toBe(true);
      expect(result.cleared).toBe(1);
      expect(downloadManager.downloads.size).toBe(1);
    });

    test('should clear all downloads', () => {
      const result = downloadManager.clearAll();

      expect(result.success).toBe(true);
      expect(result.cleared).toBe(2);
      expect(downloadManager.downloads.size).toBe(0);
    });
  });

  describe('Download Status', () => {
    test('should get download manager status', () => {
      downloadManager.startDownload('https://example.com/file1.zip');
      downloadManager.startDownload('https://example.com/file2.zip');

      const downloads = Array.from(downloadManager.downloads.values());
      downloads[0].state = DOWNLOAD_STATE.IN_PROGRESS;
      downloads[1].state = DOWNLOAD_STATE.COMPLETED;

      const status = downloadManager.getStatus();

      expect(status.downloadPath).toBe('/mock/downloads');
      expect(status.total).toBe(2);
      expect(status.active).toBe(1);
      expect(status.completed).toBe(1);
      expect(status.maxConcurrent).toBe(3);
    });
  });

  describe('Format Bytes Utility', () => {
    test('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    test('should format bytes', () => {
      expect(formatBytes(500)).toBe('500 B');
    });

    test('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
    });

    test('should format megabytes', () => {
      expect(formatBytes(1048576)).toBe('1 MB');
    });

    test('should format gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1 GB');
    });
  });

  describe('Event Emissions', () => {
    test('should emit events on download lifecycle', () => {
      const startedHandler = jest.fn();
      const cancelledHandler = jest.fn();

      downloadManager.on('download-started', startedHandler);
      downloadManager.on('download-cancelled', cancelledHandler);

      const result = downloadManager.startDownload('https://example.com/file.zip');
      const download = downloadManager.downloads.get(result.download.id);
      download._downloadItem = { cancel: jest.fn() };

      downloadManager.cancelDownload(result.download.id);

      expect(startedHandler).toHaveBeenCalled();
      expect(cancelledHandler).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources', () => {
      downloadManager.startDownload('https://example.com/file.zip');

      downloadManager.cleanup();

      // Cleanup removes all listeners
      expect(downloadManager.listenerCount('download-started')).toBe(0);
    });
  });
});
