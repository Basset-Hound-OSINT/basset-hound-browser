const WebSocket = require('ws');
const zlib = require('zlib');

// Create a WebSocket server for testing compression
const server = new WebSocket.Server({
  port: 8765,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024
  }
});

let connectionCount = 0;

server.on('connection', (ws) => {
  connectionCount++;
  console.log(`Client ${connectionCount} connected`);

  ws.on('message', (message) => {
    // Echo back
    ws.send(JSON.stringify({
      received: true,
      size: message.length,
      timestamp: Date.now()
    }));
  });

  ws.on('close', () => {
    console.log(`Client ${connectionCount} disconnected`);
  });
});

console.log('WebSocket server listening on ws://localhost:8765');
console.log('Compression enabled with 1KB threshold');
