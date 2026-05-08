/**
 * WebSocket Connection Cleanup Stress Test
 * Tests cleanup of dangling connections under rapid connect/disconnect
 */

const WebSocket = require('ws');
const http = require('http');

describe('WebSocket Connection Cleanup Stress Test', () => {
  let server;
  let wss;
  const port = 9999;
  const cleanup = [];

  beforeAll((done) => {
    server = http.createServer();
    wss = new WebSocket.Server({ server });

    // Track client state
    const clientMetrics = {
      connected: 0,
      disconnected: 0,
      errors: 0,
      maxConcurrent: 0
    };

    wss.on('connection', (ws, req) => {
      clientMetrics.connected++;
      clientMetrics.maxConcurrent = Math.max(
        clientMetrics.maxConcurrent,
        wss.clients.size
      );

      ws.on('close', () => {
        clientMetrics.disconnected++;
      });

      ws.on('error', () => {
        clientMetrics.errors++;
      });
    });

    wss.on('error', (error) => {
      console.error('Server error:', error.message);
    });

    server.listen(port, () => {
      done();
    });

    cleanup.push({ server, wss, metrics: clientMetrics });
  });

  afterAll((done) => {
    cleanup.forEach(({ server, wss }) => {
      wss.close();
      server.close();
    });
    done();
  });

  test('500+ rapid connect/disconnect cycles should cleanup properly', (done) => {
    const cycles = 500;
    let completed = 0;
    let errors = 0;

    const performCycle = () => {
      const ws = new WebSocket(`ws://localhost:${port}`);

      ws.on('open', () => {
        ws.close();
      });

      ws.on('close', () => {
        completed++;
        if (completed % 50 === 0) {
          console.log(`Completed ${completed}/${cycles} cycles`);
        }

        if (completed < cycles) {
          setImmediate(performCycle);
        } else {
          // Verify cleanup
          setTimeout(() => {
            expect(wss.clients.size).toBe(0);
            expect(errors).toBeLessThan(10); // Allow some transient errors
            done();
          }, 100);
        }
      });

      ws.on('error', (error) => {
        errors++;
        completed++;
        if (completed < cycles) {
          setImmediate(performCycle);
        }
      });
    };

    performCycle();
  });

  test('concurrent connect/disconnect should not deadlock', (done) => {
    const concurrency = 50;
    const connections = [];
    let connected = 0;
    let closed = 0;

    const connect = () => {
      const ws = new WebSocket(`ws://localhost:${port}`);

      ws.on('open', () => {
        connected++;

        if (connected === concurrency) {
          // All connected, now close all
          connections.forEach(w => w.close());
        }
      });

      ws.on('close', () => {
        closed++;
        if (closed === concurrency) {
          expect(wss.clients.size).toBe(0);
          done();
        }
      });

      connections.push(ws);
    };

    for (let i = 0; i < concurrency; i++) {
      setImmediate(connect);
    }
  });

  test('connection cleanup under message flood', (done) => {
    const numConnections = 20;
    const messagesPerConnection = 50;
    let completed = 0;

    const createConnection = () => {
      const ws = new WebSocket(`ws://localhost:${port}`);

      ws.on('open', () => {
        let sent = 0;

        const sendMessage = () => {
          if (sent < messagesPerConnection) {
            ws.send(JSON.stringify({ test: 'data', index: sent }), (error) => {
              if (!error) {
                sent++;
                setImmediate(sendMessage);
              } else {
                ws.close();
              }
            });
          } else {
            ws.close();
          }
        };

        sendMessage();
      });

      ws.on('close', () => {
        completed++;
        if (completed === numConnections) {
          setTimeout(() => {
            expect(wss.clients.size).toBe(0);
            done();
          }, 100);
        }
      });

      ws.on('error', () => {
        completed++;
        if (completed === numConnections) {
          setTimeout(() => {
            expect(wss.clients.size).toBeLessThanOrEqual(1);
            done();
          }, 100);
        }
      });
    };

    for (let i = 0; i < numConnections; i++) {
      setImmediate(createConnection);
    }
  });

  test('connection cleanup should measure resource release', (done) => {
    const numTests = 10;
    const timings = [];
    let testCompleted = 0;

    const runTest = () => {
      const start = Date.now();
      const connections = [];

      const createMultiple = () => {
        for (let i = 0; i < 100; i++) {
          const ws = new WebSocket(`ws://localhost:${port}`);
          connections.push(ws);
        }

        setTimeout(() => {
          // Close all
          connections.forEach(w => {
            try {
              w.close();
            } catch (e) {
              // Ignore
            }
          });

          setTimeout(() => {
            const duration = Date.now() - start;
            timings.push(duration);

            testCompleted++;
            if (testCompleted < numTests) {
              runTest();
            } else {
              const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
              const max = Math.max(...timings);
              console.log(`Cleanup cycle time: avg=${avg.toFixed(2)}ms, max=${max}ms`);
              expect(avg).toBeLessThan(500);
              done();
            }
          }, 50);
        }, 50);
      };

      createMultiple();
    };

    runTest();
  });

  test('error handling should cleanup even on connection errors', (done) => {
    let errorOccurred = false;
    const ws = new WebSocket(`ws://localhost:${port}`);

    ws.on('open', () => {
      // Force an error by sending invalid data
      ws.send(Buffer.from([0xFF, 0xFE]), { fin: false }, (error) => {
        if (error) {
          errorOccurred = true;
        }
        ws.close();
      });
    });

    ws.on('close', () => {
      // Verify connection was cleaned up
      setTimeout(() => {
        expect(wss.clients.size).toBe(0);
        done();
      }, 50);
    });

    ws.on('error', () => {
      // Expected
      ws.close();
    });
  });

  test('server should handle multiple sequential cleanup cycles', (done) => {
    const cycles = 5;
    let currentCycle = 0;

    const runCycle = () => {
      const ws = new WebSocket(`ws://localhost:${port}`);

      ws.on('open', () => {
        ws.close();
      });

      ws.on('close', () => {
        currentCycle++;
        if (currentCycle < cycles) {
          setTimeout(runCycle, 100);
        } else {
          expect(wss.clients.size).toBe(0);
          done();
        }
      });

      ws.on('error', () => {
        currentCycle++;
        if (currentCycle < cycles) {
          setTimeout(runCycle, 100);
        } else {
          done();
        }
      });
    };

    runCycle();
  });
});
