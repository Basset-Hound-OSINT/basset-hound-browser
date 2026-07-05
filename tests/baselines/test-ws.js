const WebSocket = require('ws');

console.log('Attempting to connect to ws://localhost:8765...');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  console.log('Connected!');
  
  const cmd = {
    id: 'test-1',
    cmd: 'get-title'
  };
  
  console.log('Sending command:', JSON.stringify(cmd));
  ws.send(JSON.stringify(cmd));
  
  const handler = (data) => {
    console.log('Response received:', data.toString().substring(0, 100));
    ws.close();
    process.exit(0);
  };
  
  ws.on('message', handler);
  
  setTimeout(() => {
    console.log('Timeout waiting for response');
    ws.close();
    process.exit(1);
  }, 3000);
});

ws.on('error', (error) => {
  console.error('Error:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('Connection closed');
});

setTimeout(() => {
  console.error('Connection timeout');
  process.exit(1);
}, 5000);
