#!/usr/bin/env node

/**
 * Mock WebSocket Server for Stress Testing (Configurable Port)
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 9999;
const server = http.createServer();
const wss = new WebSocket.Server({ server, perMessageDeflate: false });

let connectionCount = 0;
let messageCount = 0;
const startTime = Date.now();

wss.on('connection', (ws) => {
  const clientId = ++connectionCount;
  console.log(`[${new Date().toISOString()}] Client ${clientId} connected (total: ${wss.clients.size})`);

  ws.on('message', (data) => {
    messageCount++;
    try {
      const msg = JSON.parse(data.toString());

      // Simulate realistic response times
      const responseDelay = Math.random() * 10;

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

        try {
          ws.send(JSON.stringify(response));
        } catch (e) {
          // Connection might be closed
        }
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
    console.log(`[${new Date().toISOString()}] Client ${clientId} error: ${error.message}`);
  });

  ws.on('close', () => {
    console.log(`[${new Date().toISOString()}] Client ${clientId} disconnected (total: ${wss.clients.size})`);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[${new Date().toISOString()}] MockServer listening on ws://127.0.0.1:${PORT}`);
  console.log(`[${new Date().toISOString()}] Ready to accept connections`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`[${new Date().toISOString()}] Shutting down...`);
  wss.clients.forEach((ws) => {
    ws.close();
  });
  server.close(() => {
    console.log(`[${new Date().toISOString()}] Server closed`);
    process.exit(0);
  });
});

// Stats logging
setInterval(() => {
  const uptime = Math.round((Date.now() - startTime) / 1000);
  console.log(`[${new Date().toISOString()}] Connections: ${wss.clients.size}, Messages: ${messageCount}, Uptime: ${uptime}s`);
}, 5000);
