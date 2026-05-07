/**
 * Basset Hound Browser - Full Forensic Workflow Integration Test
 * Tests complete end-to-end workflow combining all forensic modules
 */

const WebSocket = require('ws');

describe('Full Forensic Workflow Integration', () => {
  const WS_URL = 'ws://localhost:8765';
  let ws = null;
  const sessionId = `forensic-workflow-${Date.now()}`;

  beforeAll((done) => {
    ws = new WebSocket(WS_URL);
    ws.on('open', done);
    ws.on('error', () => done());
  }, 30000);

  afterAll(() => {
    if (ws) ws.close();
  });

  describe('Complete Investigation Workflow', () => {
    it('should initialize recording session', (done) => {
      const msg = {
        id: `init-${Date.now()}`,
        command: 'start_recording',
        parameters: { recordingId: sessionId }
      };

      ws.send(JSON.stringify(msg));

      ws.once('message', (data) => {
        const response = JSON.parse(data);
        expect(response.success).toBe(true);
        expect(response.recordingId).toBe(sessionId);
        done();
      });
    });

    it('should enable Tor for anonymous investigation', (done) => {
      const msg = {
        id: `tor-${Date.now()}`,
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

    it('should navigate to target URL', (done) => {
      const msg = {
        id: `nav-${Date.now()}`,
        command: 'navigate',
        parameters: {
          url: 'https://example.com',
          timeout: 15000
        }
      };

      ws.send(JSON.stringify(msg));

      ws.once('message', (data) => {
        const response = JSON.parse(data);
        expect(response.success).toBe(true);
        done();
      });
    });

    it('should capture initial screenshot', (done) => {
      const msg = {
        id: `ss1-${Date.now()}`,
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

    it('should perform deep site analysis', (done) => {
      const msg = {
        id: `analyze-${Date.now()}`,
        command: 'analyze_site',
        parameters: {}
      };

      ws.send(JSON.stringify(msg));

      ws.once('message', (data) => {
        const response = JSON.parse(data);
        expect(response.success === true || response.analysis !== undefined).toBe(true);
        done();
      });
    });

    it('should end recording session', (done) => {
      const msg = {
        id: `end-record-${Date.now()}`,
        command: 'stop_recording',
        parameters: { recordingId: sessionId }
      };

      ws.send(JSON.stringify(msg));

      ws.once('message', (data) => {
        const response = JSON.parse(data);
        expect(response.success).toBe(true);
        done();
      });
    });

    it('should disable Tor after investigation', (done) => {
      const msg = {
        id: `tor-off-${Date.now()}`,
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

  describe('Data Validation & Integrity', () => {
    it('should validate memory usage', (done) => {
      const msg = {
        id: `mem-${Date.now()}`,
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
  });
});
