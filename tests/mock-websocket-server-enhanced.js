/**
 * Enhanced Mock WebSocket Server for Testing
 * Improved response handling for all test scenarios
 */

const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

let torMode = 'OFF';
let recordings = new Map();

wss.on('connection', (ws) => {
  console.log('[MockServer] Client connected');

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      console.log(`[MockServer] ${msg.command}`);

      let response = { success: false, error: 'Unknown command' };

      switch (msg.command) {
        case 'ping':
          response = { success: true, pong: true };
          break;

        case 'tor_status':
          response = { success: true, status: torMode };
          break;

        case 'tor_control':
          torMode = msg.parameters?.mode || 'OFF';
          response = { success: true, mode: torMode };
          break;

        case 'tor_renew_circuit':
          response = { 
            success: true, 
            new_circuit: `circuit-${Date.now()}`,
            timestamp: new Date().toISOString()
          };
          break;

        case 'tor_circuit_info':
          response = { 
            success: true, 
            circuit: `circuit-${Date.now()}`,
            hops: 3
          };
          break;

        case 'start_recording':
          recordings.set(msg.parameters.recordingId, {
            startTime: Date.now(),
            status: 'recording'
          });
          response = {
            success: true,
            recordingId: msg.parameters.recordingId,
            filepath: `/tmp/recording-${msg.parameters.recordingId}.webm`,
            path: `/tmp/recording-${msg.parameters.recordingId}.webm`
          };
          break;

        case 'stop_recording':
          const recording = recordings.get(msg.parameters.recordingId);
          response = {
            success: true,
            recordingId: msg.parameters.recordingId,
            duration: recording ? Date.now() - recording.startTime : 0,
            sha256: 'abc123def456789' + Math.random().toString(36).substring(7)
          };
          break;

        case 'screenshot':
          response = {
            success: true,
            filepath: `/tmp/screenshot-${Date.now()}.png`,
            path: `/tmp/screenshot-${Date.now()}.png`,
            data: 'base64imagedata',
            filename: `screenshot-${Date.now()}.png`
          };
          break;

        case 'navigate':
          response = {
            success: true,
            url: msg.parameters.url,
            title: 'Example Page',
            status: 200
          };
          break;

        case 'analyze_site':
          response = {
            success: true,
            analysis: {
              url: msg.parameters.url || 'https://example.com',
              technologies: {
                frameworks: ['React'],
                cms: [],
                servers: ['Nginx'],
                languages: ['JavaScript'],
                analytics: ['Google Analytics']
              },
              forms: [],
              security: { score: 85 },
              score: 85
            }
          };
          break;

        case 'get_memory_stats':
          response = {
            success: true,
            memory: {
              rss: 350 * 1024 * 1024,
              heapUsed: 180 * 1024 * 1024
            }
          };
          break;

        case 'get_network_analysis':
          response = {
            success: true,
            analysis: {
              total_requests: 42,
              total_data_transferred: 1024 * 1024 * 2.5
            }
          };
          break;

        default:
          response = { success: true, message: `Mock response for ${msg.command}` };
      }

      ws.send(JSON.stringify({
        ...response,
        id: msg.id
      }));
    } catch (err) {
      ws.send(JSON.stringify({
        success: false,
        error: err.message
      }));
    }
  });

  ws.on('close', () => {
    console.log('[MockServer] Client disconnected');
  });
});

server.listen(8765, () => {
  console.log('[MockServer] Enhanced WebSocket listening on ws://localhost:8765');
});

process.on('SIGINT', () => {
  console.log('[MockServer] Shutting down');
  server.close();
  process.exit(0);
});
