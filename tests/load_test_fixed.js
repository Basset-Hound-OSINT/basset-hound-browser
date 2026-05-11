const WebSocket = require('ws');

const concurrentConnections = 50;
const testDuration = 30000;
const serverUrl = 'ws://localhost:8765';

let successCount = 0;
let failCount = 0;
let messageCount = 0;
let errorCount = 0;

async function runLoadTest() {
  const connections = [];
  const startTime = Date.now();

  console.log(`Creating ${concurrentConnections} concurrent WebSocket connections...`);

  for (let i = 0; i < concurrentConnections; i++) {
    const ws = new WebSocket(serverUrl);
    let lastTime = Date.now();

    ws.on('open', () => {
      successCount++;
      console.log(`[${i}] Connected (total: ${successCount})`);

      // Send ping commands
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          lastTime = Date.now();
          ws.send(JSON.stringify({
            id: `load-test-${i}-${messageCount}`,
            command: 'ping'
          }));
          messageCount++;
        }
      }, 100);

      ws.on('close', () => {
        clearInterval(pingInterval);
      });
    });

    ws.on('error', (err) => {
      errorCount++;
      console.error(`[${i}] Error: ${err.message}`);
    });

    connections.push(ws);
  }

  // Wait for test duration
  await new Promise(resolve => setTimeout(resolve, testDuration));

  // Close all connections
  connections.forEach(ws => ws.close());

  // Wait for all connections to close
  await new Promise(resolve => setTimeout(resolve, 1000));

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  console.log('\n========== LOAD TEST RESULTS ==========');
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`Successful Connections: ${successCount}/${concurrentConnections}`);
  console.log(`Connection Errors: ${errorCount}`);
  console.log(`Total Messages Sent: ${messageCount}`);
  console.log(`Success Rate: ${((successCount / concurrentConnections) * 100).toFixed(2)}%`);
  console.log(`Messages per Second: ${(messageCount / duration).toFixed(2)}`);

  const result = successCount === concurrentConnections && errorCount === 0 ? 'PASS' : 'FAIL';
  console.log(`\nResult: ${result}`);
  process.exit(result === 'PASS' ? 0 : 1);
}

runLoadTest().catch(err => {
  console.error('Load test error:', err);
  process.exit(1);
});
