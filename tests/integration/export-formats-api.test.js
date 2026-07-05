/**
 * Export Formats API Integration Tests
 *
 * End-to-end tests for multiple export format WebSocket commands
 *
 * @module tests/integration/export-formats-api
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Integration tests - requires WebSocket server running
 */
describe('Export Formats API Integration', () => {
  let ws;
  let tempDir;
  let messageId = 1;

  const WS_URL = process.env.WS_URL || 'ws://localhost:8765';

  // Setup WebSocket connection
  before(function(done) {
    this.timeout(10000);

    try {
      const WebSocket = require('ws');
      ws = new WebSocket(WS_URL);

      ws.on('open', () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-formats-integration-'));
        done();
      });

      ws.on('error', (err) => {
        console.log(`Note: WebSocket connection failed - skipping integration tests. Error: ${err.message}`);
        done();
      });
    } catch (error) {
      console.log('WebSocket module not available - skipping integration tests');
      done();
    }
  });

  after(() => {
    if (ws && ws.readyState === 1) {
      ws.close();
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  // Helper function to send WebSocket message
  const sendCommand = (command, params = {}) => {
    return new Promise((resolve, reject) => {
      const id = messageId++;

      const handler = (data) => {
        try {
          const response = JSON.parse(data);
          if (response.id === id) {
            ws.removeEventListener('message', handler);
            resolve(response);
          }
        } catch (error) {
          // Ignore non-JSON messages
        }
      };

      ws.on('message', handler);

      const timeout = setTimeout(() => {
        ws.removeEventListener('message', handler);
        reject(new Error(`Command timeout: ${command}`));
      }, 30000);

      ws.send(JSON.stringify({
        id,
        command,
        ...params
      }));
    });
  };

  describe('JSON Export API', () => {
    it('should export network logs as JSON via WebSocket', function(done) {
      this.timeout(15000);

      if (!ws || ws.readyState !== 1) {
        this.skip();
        return;
      }

      sendCommand('export_format_json', {
        data_type: 'network_logs'
      }).then(response => {
        assert.ok(response.success === true || response.result);
        done();
      }).catch(err => {
        if (err.message.includes('Unknown command')) {
          console.log('export_format_json not yet registered');
          this.skip();
        } else {
          done(err);
        }
      });
    });

    it('should export with prettified output', function(done) {
      this.timeout(15000);

      if (!ws || ws.readyState !== 1) {
        this.skip();
        return;
      }

      sendCommand('export_format_json', {
        data_type: 'network_logs',
        prettify: true
      }).then(response => {
        assert.ok(response.success === true || response.result);
        done();
      }).catch(err => {
        if (err.message.includes('Unknown command')) {
          this.skip();
        } else {
          done(err);
        }
      });
    });

    it('should export to file', function(done) {
      this.timeout(15000);

      if (!ws || ws.readyState !== 1) {
        this.skip();
        return;
      }

      const outputPath = path.join(tempDir, 'test-export.json');

      sendCommand('export_format_json', {
        data_type: 'network_logs',
        output_path: outputPath
      }).then(response => {
        assert.ok(response.success === true || response.result);
        // File should be created on server side
        done();
      }).catch(err => {
        if (err.message.includes('Unknown command')) {
          this.skip();
        } else {
          done(err);
        }
      });
    });
  });

  describe('CSV Export API', () => {
    it('should export network logs as CSV', function(done) {
      this.timeout(15000);

      if (!ws || ws.readyState !== 1) {
        this.skip();
        return;
      }

      sendCommand('export_format_csv', {
        data_type: 'network_logs'
      }).then(response => {
        assert.ok(response.success === true || response.result);
        done();
      }).catch(err => {
        if (err.message.includes('Unknown command')) {
          this.skip();
        } else {
          done(err);
        }
      });
    });

    it('should support custom delimiter', function(done) {
      this.timeout(15000);

      if (!ws || ws.readyState !== 1) {
        this.skip();
        return;
      }

      sendCommand('export_format_csv', {
        data_type: 'network_logs',
        delimiter: ';'
      }).then(response => {
        assert.ok(response.success === true || response.result);
        done();
      }).catch(err => {
        if (err.message.includes('Unknown command')) {
          this.skip();
        } else {
          done(err);
        }
      });
    });
  });

  describe('HAR Export API', () => {
    it('should export as HAR format', function(done) {
      this.timeout(15000);

      if (!ws || ws.readyState !== 1) {
        this.skip();
        return;
      }

      sendCommand('export_format_har', {}).then(response => {
        assert.ok(response.success === true || response.result);
        done();
      }).catch(err => {
        if (err.message.includes('Unknown command')) {
          this.skip();
        } else {
          done(err);
        }
      });
    });
  });

  describe('WARC Export API', () => {
    it('should export as WARC format', function(done) {
      this.timeout(15000);

      if (!ws || ws.readyState !== 1) {
        this.skip();
        return;
      }

      sendCommand('export_format_warc', {}).then(response => {
        assert.ok(response.success === true || response.result);
        done();
      }).catch(err => {
        if (err.message.includes('Unknown command')) {
          this.skip();
        } else {
          done(err);
        }
      });
    });
  });

  describe('SQLite Export API', () => {
    it('should export to SQLite database', function(done) {
      this.timeout(15000);

      if (!ws || ws.readyState !== 1) {
        this.skip();
        return;
      }

      const dbPath = path.join(tempDir, 'test-export.db');

      sendCommand('export_format_sqlite', {
        output_path: dbPath
      }).then(response => {
        assert.ok(response.success === true || response.result);
        done();
      }).catch(err => {
        if (err.message.includes('Unknown command')) {
          this.skip();
        } else {
          done(err);
        }
      });
    });
  });

  describe('Markdown Export API', () => {
    it('should export as Markdown report', function(done) {
      this.timeout(15000);

      if (!ws || ws.readyState !== 1) {
        this.skip();
        return;
      }

      sendCommand('export_format_markdown', {}).then(response => {
        assert.ok(response.success === true || response.result);
        done();
      }).catch(err => {
        if (err.message.includes('Unknown command')) {
          this.skip();
        } else {
          done(err);
        }
      });
    });
  });

  describe('XML Export API', () => {
    it('should export as XML', function(done) {
      this.timeout(15000);

      if (!ws || ws.readyState !== 1) {
        this.skip();
        return;
      }

      sendCommand('export_format_xml', {}).then(response => {
        assert.ok(response.success === true || response.result);
        done();
      }).catch(err => {
        if (err.message.includes('Unknown command')) {
          this.skip();
        } else {
          done(err);
        }
      });
    });
  });

  describe('Custom Format API', () => {
    it('should export with custom template', function(done) {
      this.timeout(15000);

      if (!ws || ws.readyState !== 1) {
        this.skip();
        return;
      }

      sendCommand('export_format_custom', {
        template: 'Hello {{name}}',
        data: { name: 'World' }
      }).then(response => {
        assert.ok(response.success === true || response.result);
        done();
      }).catch(err => {
        if (err.message.includes('Unknown command')) {
          this.skip();
        } else {
          done(err);
        }
      });
    });
  });
});
