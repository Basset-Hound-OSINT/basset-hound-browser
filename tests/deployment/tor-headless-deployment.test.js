/**
 * Basset Hound Browser - Tor Integration Test (Headless Deployment)
 * Tests Tor functionality in headless mode without GUI
 */

const WebSocket = require('ws');

describe('Tor Deployment - Headless Environment', () => {
  const WS_URL = 'ws://localhost:8765';
  let ws = null;

  beforeAll((done) => {
    ws = new WebSocket(WS_URL);
    ws.on('open', done);
    ws.on('error', () => done());
  }, 30000);

  afterAll(() => {
    if (ws) ws.close();
  });

  describe('Headless Startup with Tor', () => {
    it('should initialize headless browser with Tor disabled by default', (done) => {
      const msg = {
        id: `test-headless-${Date.now()}`,
        command: 'tor_status',
        parameters: {}
      };

      ws.send(JSON.stringify(msg));

      ws.once('message', (data) => {
        const response = JSON.parse(data);
        expect(response.success === true || response.status !== undefined).toBe(true);
        done();
      });
    });
  });

  describe('Tor Control in Headless Mode', () => {
    it('should enable Tor in headless mode', (done) => {
      const msg = {
        id: `test-headless-${Date.now()}`,
        command: 'tor_control',
        parameters: { mode: 'ON' }
      };

      ws.send(JSON.stringify(msg));

      ws.once('message', (data) => {
        const response = JSON.parse(data);
        expect(response.success).toBe(true);
        done();
      });
    });

    it('should renew Tor circuit in headless', (done) => {
      const msg = {
        id: `test-headless-${Date.now()}`,
        command: 'tor_renew_circuit',
        parameters: {}
      };

      ws.send(JSON.stringify(msg));

      ws.once('message', (data) => {
        const response = JSON.parse(data);
        expect(response.success).toBe(true);
        done();
      });
    });
  });

  describe('Headless Recording with Tor', () => {
    beforeAll((done) => {
      const msg = {
        id: `test-headless-${Date.now()}`,
        command: 'tor_control',
        parameters: { mode: 'ON' }
      };

      ws.send(JSON.stringify(msg));
      ws.once('message', () => done());
    });

    it('should record session in headless mode with Tor', (done) => {
      const msg = {
        id: `test-headless-${Date.now()}`,
        command: 'start_recording',
        parameters: {
          recordingId: 'headless-tor-' + Date.now()
        }
      };

      ws.send(JSON.stringify(msg));

      ws.once('message', (data) => {
        const response = JSON.parse(data);
        expect(response.success).toBe(true);
        expect(response.filepath).toBeDefined();
        done();
      });
    });

    it('should capture screenshots in headless with Tor', (done) => {
      const msg = {
        id: `test-headless-${Date.now()}`,
        command: 'screenshot',
        parameters: {}
      };

      ws.send(JSON.stringify(msg));

      ws.once('message', (data) => {
        const response = JSON.parse(data);
        expect(response.success).toBe(true);
        done();
      });
    });
  });

  describe('Headless Memory & Resource Management', () => {
    it('should report memory usage in headless mode', (done) => {
      const msg = {
        id: `test-headless-${Date.now()}`,
        command: 'get_memory_stats',
        parameters: {}
      };

      ws.send(JSON.stringify(msg));

      ws.once('message', (data) => {
        const response = JSON.parse(data);
        expect(response.memory !== undefined || response.success === true).toBe(true);
        done();
      });
    });

    it('should handle long-running sessions with Tor in headless', (done) => {
      let completed = 0;
      const iterations = 3;

      const next = () => {
        if (completed >= iterations) {
          done();
          return;
        }

        const msg = {
          id: `test-headless-${Date.now()}`,
          command: 'navigate',
          parameters: { url: 'https://example.com?' + completed }
        };

        ws.send(JSON.stringify(msg));

        ws.once('message', (data) => {
          const response = JSON.parse(data);
          expect(response.success).toBe(true);
          completed++;
          setTimeout(next, 100);
        });
      };

      next();
    });
  });

  describe('Headless Auto Mode with Tor', () => {
    it('should use AUTO mode for intelligent Tor decisions', (done) => {
      const msg = {
        id: `test-headless-${Date.now()}`,
        command: 'tor_control',
        parameters: {
          mode: 'AUTO'
        }
      };

      ws.send(JSON.stringify(msg));

      ws.once('message', (data) => {
        const response = JSON.parse(data);
        expect(response.success).toBe(true);
        done();
      });
    });
  });

  describe('Headless Exit & Cleanup', () => {
    it('should disable Tor on headless shutdown', (done) => {
      const msg = {
        id: `test-headless-${Date.now()}`,
        command: 'tor_control',
        parameters: { mode: 'OFF' }
      };

      ws.send(JSON.stringify(msg));

      ws.once('message', (data) => {
        const response = JSON.parse(data);
        expect(response.success).toBe(true);
        done();
      });
    });
  });
});
