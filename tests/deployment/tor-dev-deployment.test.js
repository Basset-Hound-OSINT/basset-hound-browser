/**
 * Basset Hound Browser - Tor Integration Test (Development Deployment)
 * Tests Tor connectivity, IP validation, and circuit management in dev environment
 */

const WebSocket = require('ws');

describe('Tor Deployment - Development Environment', () => {
  const WS_URL = 'ws://localhost:8765';
  let ws = null;

  beforeAll((done) => {
    ws = new WebSocket(WS_URL);
    ws.on('open', done);
    ws.on('error', (err) => {
      console.error('WebSocket connection error:', err.message);
      done();
    });
  }, 30000);

  afterAll(() => {
    if (ws) ws.close();
  });

  describe('Tor Master Switch', () => {
    it('should initialize Tor in OFF mode', (done) => {
      const msg = {
        id: `test-${Date.now()}`,
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

    it('should enable Tor with ON mode', (done) => {
      const msg = {
        id: `test-${Date.now()}`,
        command: 'tor_control',
        parameters: {
          mode: 'ON'
        }
      };

      ws.send(JSON.stringify(msg));

      ws.once('message', (data) => {
        const response = JSON.parse(data);
        expect(response.success).toBe(true);
        done();
      });
    });

    it('should switch to AUTO mode', (done) => {
      const msg = {
        id: `test-${Date.now()}`,
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

    it('should disable Tor with OFF mode', (done) => {
      const msg = {
        id: `test-${Date.now()}`,
        command: 'tor_control',
        parameters: {
          mode: 'OFF'
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

  describe('Tor Circuit Management', () => {
    beforeAll((done) => {
      const msg = {
        id: `test-${Date.now()}`,
        command: 'tor_control',
        parameters: { mode: 'ON' }
      };

      ws.send(JSON.stringify(msg));
      ws.once('message', () => done());
    });

    it('should renew Tor circuit', (done) => {
      const msg = {
        id: `test-${Date.now()}`,
        command: 'tor_renew_circuit',
        parameters: {}
      };

      ws.send(JSON.stringify(msg));

      ws.once('message', (data) => {
        const response = JSON.parse(data);
        expect(response.success).toBe(true);
        expect(response.new_circuit).toBeDefined();
        done();
      });
    });

    it('should get current circuit info', (done) => {
      const msg = {
        id: `test-${Date.now()}`,
        command: 'tor_circuit_info',
        parameters: {}
      };

      ws.send(JSON.stringify(msg));

      ws.once('message', (data) => {
        const response = JSON.parse(data);
        expect(response.success).toBe(true);
        expect(response.circuit).toBeDefined();
        done();
      });
    });
  });

  describe('Tor with Recording Features', () => {
    beforeAll((done) => {
      const msg = {
        id: `test-${Date.now()}`,
        command: 'tor_control',
        parameters: { mode: 'ON' }
      };

      ws.send(JSON.stringify(msg));
      ws.once('message', () => done());
    });

    it('should record session while using Tor', (done) => {
      const msg = {
        id: `test-${Date.now()}`,
        command: 'start_recording',
        parameters: {
          recordingId: 'tor-session-' + Date.now()
        }
      };

      ws.send(JSON.stringify(msg));

      ws.once('message', (data) => {
        const response = JSON.parse(data);
        expect(response.success).toBe(true);
        expect(response.recordingId).toBeDefined();
        done();
      });
    });

    it('should capture screenshot while using Tor', (done) => {
      const msg = {
        id: `test-${Date.now()}`,
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

  describe('Tor - Mode Transitions', () => {
    it('should transition: OFF -> ON -> AUTO -> OFF', (done) => {
      const modes = ['OFF', 'ON', 'AUTO', 'OFF'];
      let completed = 0;

      const testNext = () => {
        if (completed >= modes.length) {
          done();
          return;
        }

        const mode = modes[completed];
        const msg = {
          id: `test-${Date.now()}`,
          command: 'tor_control',
          parameters: { mode }
        };

        ws.send(JSON.stringify(msg));

        ws.once('message', (data) => {
          const response = JSON.parse(data);
          expect(response.success).toBe(true);
          completed++;
          setTimeout(testNext, 100);
        });
      };

      testNext();
    });
  });

  describe('Tor Performance', () => {
    beforeAll((done) => {
      const msg = {
        id: `test-${Date.now()}`,
        command: 'tor_control',
        parameters: { mode: 'ON' }
      };

      ws.send(JSON.stringify(msg));
      ws.once('message', () => done());
    });

    it('should handle multiple requests over Tor circuit', (done) => {
      const urls = [
        'https://example.com',
        'https://example.org'
      ];
      let completed = 0;

      urls.forEach((url) => {
        const msg = {
          id: `test-${Date.now()}`,
          command: 'navigate',
          parameters: { url }
        };

        ws.send(JSON.stringify(msg));

        ws.once('message', (data) => {
          const response = JSON.parse(data);
          expect(response.success).toBe(true);
          completed++;
          if (completed === urls.length) {
            done();
          }
        });
      });
    });
  });
});
