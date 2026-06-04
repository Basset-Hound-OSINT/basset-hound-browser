const WebSocket = require('ws');

const concurrentConnections = 50;
const testDuration = 30000; // 30 seconds
const serverUrl = 'ws://localhost:8765';

let successCount = 0;
let failCount = 0;
let totalLatency = 0;
let messageCount = 0;

async function runLoadTest() {
  const connections = [];
  const startTime = Date.now();

  // Create concurrent connections
  console.log(`Creating ${concurrentConnections} concurrent WebSocket connections...`);

  for (let i = 0; i < concurrentConnections; i++) {
    const ws = new WebSocket(serverUrl);

    ws.on('open', () => {
      successCount++;
      console.log(`[${i}] Connected (total: ${successCount})`);

      // Send ping commands
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const msgStart = Date.now();
          ws.send(JSON.stringify({
            id: `load-test-${i}-${messageCount}`,
            command: 'ping'
          }));
          messageCount++;
        }
      }, 100);

      ws.on('message', (data) => {
        const latency = Date.now() - msgStart;
        totalLatency += latency;
      });

      ws.on('close', () => {
        clearInterval(pingInterval);
      });
    });

    ws.on('error', (err) => {
      failCount++;
      console.error(`[${i}] Connection error: ${err.message}`);
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
  console.log(`Failed Connections: ${failCount}`);
  console.log(`Total Messages: ${messageCount}`);
  console.log(`Success Rate: ${((successCount / concurrentConnections) * 100).toFixed(2)}%`);

  if (messageCount > 0) {
    const avgLatency = totalLatency / messageCount;
    console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
  }

  const result = successCount === concurrentConnections && failCount === 0 ? 'PASS' : 'FAIL';
  console.log(`\nResult: ${result}`);
  process.exit(result === 'PASS' ? 0 : 1);
}

runLoadTest().catch(err => {
  console.error('Load test error:', err);
  process.exit(1);
});
