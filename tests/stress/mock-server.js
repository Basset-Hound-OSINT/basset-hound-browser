/**
 * Mock WebSocket Server for Stress Testing
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = 8765;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

let connectionCount = 0;
let messageCount = 0;

wss.on('connection', (ws) => {
  const clientId = ++connectionCount;
  console.log(`[MockServer] Client ${clientId} connected (total: ${wss.clients.size})`);

  ws.on('message', (data) => {
    messageCount++;
    try {
      const msg = JSON.parse(data.toString());

      // Simulate realistic response times
      const responseDelay = Math.random() * 50;

      setTimeout(() => {
        const response = {
          id: msg.id,
          success: true,
          command: msg.command,
          timestamp: new Date().toISOString()
        };

        // Simulate command-specific responses
        if (msg.command === 'ping') {
          response.pong = true;
        } else if (msg.command === 'navigate') {
          response.result = { url: msg.params?.url || 'unknown' };
        } else if (msg.command === 'screenshot') {
          response.result = { path: '/tmp/screenshot.png', size: 12345 };
        } else if (msg.command === 'get_content') {
          response.result = { content: '<html><body>Test</body></html>' };
        } else if (msg.command === 'get_url') {
          response.result = { url: 'https://example.com' };
        } else if (msg.command === 'click') {
          response.result = { clicked: true };
        } else if (msg.command === 'fill') {
          response.result = { filled: true };
        } else if (msg.command === 'scroll') {
          response.result = { scrolled: true };
        } else if (msg.command === 'status') {
          response.result = { status: 'ready' };
        } else {
          response.result = { ok: true };
        }

        ws.send(JSON.stringify(response));
      }, responseDelay);

    } catch (error) {
      try {
        ws.send(JSON.stringify({
          id: Math.random(),
          success: false,
          error: 'Invalid JSON'
        }));
      } catch (e) {
        // Connection might be closed
      }
    }
  });

  ws.on('error', (error) => {
    console.log(`[MockServer] Client ${clientId} error: ${error.message}`);
  });

  ws.on('close', () => {
    console.log(`[MockServer] Client ${clientId} disconnected (total: ${wss.clients.size})`);
  });
});

server.listen(PORT, () => {
  console.log(`[MockServer] WebSocket server listening on port ${PORT}`);
  console.log(`[MockServer] Ready to accept connections`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[MockServer] Shutting down...');
  wss.clients.forEach((ws) => {
    ws.close();
  });
  server.close(() => {
    console.log('[MockServer] Server closed');
    process.exit(0);
  });
});

// Stats logging
setInterval(() => {
  console.log(`[MockServer] Connections: ${wss.clients.size}, Total messages: ${messageCount}`);
}, 10000);
