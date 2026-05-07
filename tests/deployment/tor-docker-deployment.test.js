/**
 * Basset Hound Browser - Tor Integration Test (Docker Deployment)
 * Tests Tor connectivity in containerized environment
 */

const WebSocket = require('ws');

describe('Tor Deployment - Docker Environment', () => {
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

  describe('Docker Network Isolation', () => {
    it('should connect to browser over Docker bridge network', (done) => {
      const msg = {
        id: `test-docker-${Date.now()}`,
        command: 'ping',
        parameters: {}
      };

      ws.send(JSON.stringify(msg));

      ws.once('message', (data) => {
        const response = JSON.parse(data);
        expect(response.success === true || response.pong !== undefined).toBe(true);
        done();
      });
    });
  });

  describe('Tor in Docker Container', () => {
    it('should initialize Tor in Docker environment', (done) => {
      const msg = {
        id: `test-docker-${Date.now()}`,
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

    it('should establish Tor circuit in container', (done) => {
      const msg = {
        id: `test-docker-${Date.now()}`,
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

  describe('Tor with Docker Volumes (Recording)', () => {
    beforeAll((done) => {
      const msg = {
        id: `test-docker-${Date.now()}`,
        command: 'tor_control',
        parameters: { mode: 'ON' }
      };

      ws.send(JSON.stringify(msg));
      ws.once('message', () => done());
    });

    it('should record to Docker mounted volume while using Tor', (done) => {
      const msg = {
        id: `test-docker-${Date.now()}`,
        command: 'start_recording',
        parameters: {
          recordingId: 'docker-tor-' + Date.now()
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

    it('should take screenshot and save to Docker volume', (done) => {
      const msg = {
        id: `test-docker-${Date.now()}`,
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

  describe('Tor Circuit Management in Docker', () => {
    beforeAll((done) => {
      const msg = {
        id: `test-docker-${Date.now()}`,
        command: 'tor_control',
        parameters: { mode: 'ON' }
      };

      ws.send(JSON.stringify(msg));
      ws.once('message', () => done());
    });

    it('should renew Tor circuit in Docker', (done) => {
      const msg = {
        id: `test-docker-${Date.now()}`,
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

  describe('Docker Cleanup', () => {
    it('should properly disable Tor on container shutdown', (done) => {
      const msg = {
        id: `test-docker-${Date.now()}`,
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
