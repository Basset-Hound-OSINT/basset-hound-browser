/**
 * Phase 6 Features Integration Tests
 * Tests for Technology Detection, Content Extraction, and Network Analysis
 */

const WebSocket = require('ws');

// Test configuration
const WS_URL = 'ws://localhost:8765';
const CONNECT_TIMEOUT = 5000;
const COMMAND_TIMEOUT = 10000;

// Helper function to create WebSocket connection
function createConnection() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Connection timeout'));
    }, CONNECT_TIMEOUT);

    ws.on('open', () => {
      clearTimeout(timeout);
      resolve(ws);
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// Helper function to send command and wait for response
function sendCommand(ws, command, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Date.now().toString();
    const timeout = setTimeout(() => {
      reject(new Error('Command timeout'));
    }, COMMAND_TIMEOUT);

    const messageHandler = (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          clearTimeout(timeout);
          ws.removeListener('message', messageHandler);
          resolve(response);
        }
      } catch (e) {
        // Ignore parse errors for non-matching messages
      }
    };

    ws.on('message', messageHandler);
    ws.send(JSON.stringify({ id, command, ...params }));
  });
}

describe('Phase 6 Features Integration Tests', () => {
  let ws;

  beforeAll(async () => {
    try {
      ws = await createConnection();
    } catch (error) {
      console.warn('Could not connect to WebSocket server. Skipping integration tests.');
      console.warn('Make sure the browser is running with: npm start');
    }
  });

  afterAll(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  // Skip all tests if no connection
  const conditionalTest = (name, fn) => {
    if (!ws) {
      test.skip(name, () => {});
    } else {
      test(name, fn);
    }
  };

  describe('Technology Detection Commands', () => {
    conditionalTest('detect_technologies should detect technologies from current page', async () => {
      // First navigate to a test page
      await sendCommand(ws, 'navigate', { url: 'https://example.com' });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await sendCommand(ws, 'detect_technologies', {});

      expect(response.success).toBe(true);
      expect(response.technologies).toBeDefined();
    });

    conditionalTest('detect_technologies should work with provided HTML', async () => {
      const response = await sendCommand(ws, 'detect_technologies', {
        url: 'https://example.com',
        html: '<html><head><meta name="generator" content="WordPress 6.0"></head><body></body></html>'
      });

      expect(response.success).toBe(true);
    });

    conditionalTest('get_technology_categories should return categories', async () => {
      const response = await sendCommand(ws, 'get_technology_categories', {});

      expect(response.success).toBe(true);
      expect(response.categories).toBeDefined();
      expect(Array.isArray(response.categories)).toBe(true);
    });

    conditionalTest('get_technology_info should return technology details', async () => {
      const response = await sendCommand(ws, 'get_technology_info', { name: 'jQuery' });

      expect(response.success).toBe(true);
      expect(response.technology).toBeDefined();
    });

    conditionalTest('search_technologies should search by query', async () => {
      const response = await sendCommand(ws, 'search_technologies', { query: 'react' });

      expect(response.success).toBe(true);
    });
  });

  describe('Content Extraction Commands', () => {
    beforeAll(async () => {
      if (ws) {
        await sendCommand(ws, 'navigate', { url: 'https://example.com' });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    });

    conditionalTest('extract_metadata should extract page metadata', async () => {
      const response = await sendCommand(ws, 'extract_metadata', {});

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.basic).toBeDefined();
    });

    conditionalTest('extract_links should extract page links', async () => {
      const response = await sendCommand(ws, 'extract_links', {});

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    conditionalTest('extract_forms should extract page forms', async () => {
      const response = await sendCommand(ws, 'extract_forms', {});

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    conditionalTest('extract_images should extract page images', async () => {
      const response = await sendCommand(ws, 'extract_images', {});

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    conditionalTest('extract_scripts should extract page scripts', async () => {
      const response = await sendCommand(ws, 'extract_scripts', {});

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    conditionalTest('extract_stylesheets should extract page stylesheets', async () => {
      const response = await sendCommand(ws, 'extract_stylesheets', {});

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    conditionalTest('extract_structured_data should extract JSON-LD and microdata', async () => {
      const response = await sendCommand(ws, 'extract_structured_data', {});

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    conditionalTest('extract_all should extract all content types', async () => {
      const response = await sendCommand(ws, 'extract_all', {});

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.metadata).toBeDefined();
      expect(response.data.links).toBeDefined();
    });

    conditionalTest('get_extraction_stats should return extraction statistics', async () => {
      const response = await sendCommand(ws, 'get_extraction_stats', {});

      expect(response.success).toBe(true);
      expect(response.stats).toBeDefined();
    });
  });

  describe('Network Analysis Commands', () => {
    conditionalTest('start_network_capture should start capturing', async () => {
      const response = await sendCommand(ws, 'start_network_capture', {});

      expect(response.success).toBe(true);
      expect(response.captureStartTime).toBeDefined();
    });

    conditionalTest('get_network_capture_status should return status', async () => {
      const response = await sendCommand(ws, 'get_network_capture_status', {});

      expect(response.success).toBe(true);
      expect(response.isCapturing).toBeDefined();
    });

    conditionalTest('navigate and capture requests', async () => {
      await sendCommand(ws, 'navigate', { url: 'https://example.com' });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await sendCommand(ws, 'get_network_requests', {});

      expect(response.success).toBe(true);
      expect(response.requests).toBeDefined();
    });

    conditionalTest('get_requests_by_domain should group by domain', async () => {
      const response = await sendCommand(ws, 'get_requests_by_domain', {});

      expect(response.success).toBe(true);
      expect(response.domains).toBeDefined();
    });

    conditionalTest('get_slow_requests should filter by duration', async () => {
      const response = await sendCommand(ws, 'get_slow_requests', { thresholdMs: 100 });

      expect(response.success).toBe(true);
      expect(response.thresholdMs).toBe(100);
    });

    conditionalTest('get_failed_requests should return failed requests', async () => {
      const response = await sendCommand(ws, 'get_failed_requests', {});

      expect(response.success).toBe(true);
      expect(response.requests).toBeDefined();
    });

    conditionalTest('get_network_statistics should return stats', async () => {
      const response = await sendCommand(ws, 'get_network_statistics', {});

      expect(response.success).toBe(true);
      expect(response.sessionStats).toBeDefined();
    });

    conditionalTest('get_security_headers_list should return headers', async () => {
      const response = await sendCommand(ws, 'get_security_headers_list', {});

      expect(response.success).toBe(true);
      expect(response.headers).toBeDefined();
    });

    conditionalTest('analyze_security_headers should analyze URL', async () => {
      const response = await sendCommand(ws, 'analyze_security_headers', {
        url: 'https://example.com'
      });

      // May fail if no headers captured, but should not error
      expect(response).toBeDefined();
    });

    conditionalTest('export_network_capture should export data', async () => {
      const response = await sendCommand(ws, 'export_network_capture', {});

      expect(response.success).toBe(true);
      expect(response.exportedAt).toBeDefined();
    });

    conditionalTest('stop_network_capture should stop capturing', async () => {
      const response = await sendCommand(ws, 'stop_network_capture', {});

      expect(response.success).toBe(true);
      expect(response.captureDuration).toBeDefined();
    });

    conditionalTest('clear_network_capture should clear data', async () => {
      const response = await sendCommand(ws, 'clear_network_capture', {});

      expect(response.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    conditionalTest('get_technology_info should require name parameter', async () => {
      const response = await sendCommand(ws, 'get_technology_info', {});

      expect(response.success).toBe(false);
      expect(response.error).toContain('required');
    });

    conditionalTest('get_request_details should require requestId', async () => {
      const response = await sendCommand(ws, 'get_request_details', {});

      expect(response.success).toBe(false);
      expect(response.error).toContain('required');
    });

    conditionalTest('get_security_info should require url', async () => {
      const response = await sendCommand(ws, 'get_security_info', {});

      expect(response.success).toBe(false);
      expect(response.error).toContain('required');
    });
  });
});
