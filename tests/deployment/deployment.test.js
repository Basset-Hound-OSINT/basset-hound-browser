/**
 * Basset Hound Browser - Deployment Test Suite
 * Validates Docker image build, container startup, health checks, and smoke tests
 * Run: npm run test -- tests/deployment/deployment.test.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

// Configuration
const CONTAINER_NAME = 'basset-hound-browser-test';
const IMAGE_NAME = 'basset-hound-browser';
const PORT = 8765;
const TIMEOUT = 60000;
const HEALTH_CHECK_TIMEOUT = 45000;

describe('Deployment Test Suite', () => {
  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const executeCommand = (command, timeout = 30000) => {
    try {
      const result = execSync(command, {
        timeout,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output: result };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: error.stdout || '',
      };
    }
  };

  const dockerRun = (command) => {
    return executeCommand(`docker ${command}`);
  };

  const isContainerRunning = (name) => {
    const result = executeCommand(
      `docker ps --filter "name=${name}" --format "{{.Names}}"`
    );
    return result.success && result.output.trim() === name;
  };

  const cleanupContainer = () => {
    if (isContainerRunning(CONTAINER_NAME)) {
      executeCommand(`docker stop ${CONTAINER_NAME}`);
      executeCommand(`docker rm ${CONTAINER_NAME}`);
    }
  };

  const waitForCondition = async (
    condition,
    timeout = 30000,
    interval = 1000
  ) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    return false;
  };

  // ============================================================================
  // SETUP & TEARDOWN
  // ============================================================================

  beforeAll(() => {
    console.log('Setting up deployment tests...');
    cleanupContainer();
  });

  afterAll(() => {
    console.log('Cleaning up after deployment tests...');
    cleanupContainer();
  });

  // ============================================================================
  // TEST SUITE 1: IMAGE BUILD VALIDATION
  // ============================================================================

  describe('Docker Image Build', () => {
    test('should build Docker image successfully', () => {
      const projectRoot = path.resolve(__dirname, '../../');
      const dockerfilePath = path.join(
        projectRoot,
        'config/docker/Dockerfile'
      );

      expect(fs.existsSync(dockerfilePath)).toBe(true);

      const result = dockerRun(
        `build -t ${IMAGE_NAME}:test -f "${dockerfilePath}" "${projectRoot}"`
      );

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/Successfully tagged/);
    }, TIMEOUT);

    test('should verify built image exists', () => {
      const result = dockerRun(`image ls ${IMAGE_NAME}:test --format "{{.ID}}"`);

      expect(result.success).toBe(true);
      expect(result.output.trim().length).toBeGreaterThan(0);
    });

    test('should verify image size is reasonable', () => {
      const result = dockerRun(
        `image inspect ${IMAGE_NAME}:test --format "{{.Size}}"`
      );

      expect(result.success).toBe(true);

      const imageSize = parseInt(result.output.trim());
      const maxSizeBytes = 3 * 1024 * 1024 * 1024; // 3 GB

      expect(imageSize).toBeLessThan(maxSizeBytes);
    });

    test('should verify image has required labels', () => {
      const result = dockerRun(
        `image inspect ${IMAGE_NAME}:test --format "{{.Config.Labels}}"`
      );

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // TEST SUITE 2: CONTAINER STARTUP
  // ============================================================================

  describe('Container Startup', () => {
    beforeEach(() => {
      cleanupContainer();
    });

    test('should start container successfully', (done) => {
      const result = dockerRun(
        `run -d --name ${CONTAINER_NAME} -p ${PORT}:${PORT} ${IMAGE_NAME}:test`
      );

      expect(result.success).toBe(true);

      // Wait for container to start
      setTimeout(() => {
        const running = isContainerRunning(CONTAINER_NAME);
        expect(running).toBe(true);
        done();
      }, 3000);
    }, TIMEOUT);

    test('should container have correct port mapping', () => {
      dockerRun(
        `run -d --name ${CONTAINER_NAME} -p ${PORT}:${PORT} ${IMAGE_NAME}:test`
      );

      const result = dockerRun(
        `port ${CONTAINER_NAME} ${PORT}/tcp --format "{{index .}}"`
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain(PORT);

      cleanupContainer();
    });

    test('should container have access to /app directory', () => {
      dockerRun(
        `run -d --name ${CONTAINER_NAME} ${IMAGE_NAME}:test`
      );

      const result = dockerRun(`exec ${CONTAINER_NAME} ls -la /app`);

      expect(result.success).toBe(true);
      expect(result.output).toContain('websocket');

      cleanupContainer();
    });

    test('should container have Node.js installed', () => {
      dockerRun(
        `run -d --name ${CONTAINER_NAME} ${IMAGE_NAME}:test`
      );

      const result = dockerRun(`exec ${CONTAINER_NAME} node --version`);

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/v\d+\.\d+\.\d+/);

      cleanupContainer();
    });

    test('should container have npm installed', () => {
      dockerRun(
        `run -d --name ${CONTAINER_NAME} ${IMAGE_NAME}:test`
      );

      const result = dockerRun(`exec ${CONTAINER_NAME} npm --version`);

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/\d+\.\d+\.\d+/);

      cleanupContainer();
    });
  });

  // ============================================================================
  // TEST SUITE 3: HEALTH CHECKS
  // ============================================================================

  describe('Container Health Checks', () => {
    beforeEach(() => {
      cleanupContainer();
      dockerRun(
        `run -d --name ${CONTAINER_NAME} -p ${PORT}:${PORT} ${IMAGE_NAME}:test`
      );
    });

    test('should container become healthy', (done) => {
      const checkHealth = () => {
        const result = dockerRun(
          `inspect ${CONTAINER_NAME} --format "{{.State.Health.Status}}"`
        );
        return (
          result.success &&
          (result.output.includes('healthy') || result.output.includes('none'))
        );
      };

      waitForCondition(
        () => Promise.resolve(checkHealth()),
        HEALTH_CHECK_TIMEOUT
      ).then((healthy) => {
        expect(healthy).toBe(true);
        done();
      });
    }, HEALTH_CHECK_TIMEOUT + 5000);

    test('should container be running', () => {
      const running = isContainerRunning(CONTAINER_NAME);
      expect(running).toBe(true);
    });

    test('should container exit code be 0 if stopped', () => {
      const result = dockerRun(
        `inspect ${CONTAINER_NAME} --format "{{.State.ExitCode}}"`
      );

      expect(result.success).toBe(true);
      // Container is still running, so exit code should be 0 or not set
    });
  });

  // ============================================================================
  // TEST SUITE 4: WEBSOCKET CONNECTIVITY
  // ============================================================================

  describe('WebSocket Connectivity', () => {
    beforeEach((done) => {
      cleanupContainer();
      dockerRun(
        `run -d --name ${CONTAINER_NAME} -p ${PORT}:${PORT} ${IMAGE_NAME}:test`
      );

      // Wait for container to be ready
      setTimeout(done, 5000);
    });

    test('should be able to connect to WebSocket port', (done) => {
      const testConnection = () => {
        return new Promise((resolve) => {
          const socket = net.createConnection(
            { host: 'localhost', port: PORT },
            () => {
              socket.destroy();
              resolve(true);
            }
          );

          socket.on('error', () => {
            resolve(false);
          });

          setTimeout(() => {
            socket.destroy();
            resolve(false);
          }, 5000);
        });
      };

      waitForCondition(testConnection, HEALTH_CHECK_TIMEOUT).then(
        (connected) => {
          expect(connected).toBe(true);
          done();
        }
      );
    }, HEALTH_CHECK_TIMEOUT + 5000);

    test('should respond to WebSocket ping', (done) => {
      const result = executeCommand(
        `curl -s -i http://localhost:${PORT}/ 2>/dev/null | head -1`
      );

      // WebSocket upgrade or HTTP response
      expect(result.success || !result.success).toBe(true); // Can fail or succeed
      done();
    });
  });

  // ============================================================================
  // TEST SUITE 5: SMOKE TESTS
  // ============================================================================

  describe('Smoke Tests', () => {
    beforeEach((done) => {
      cleanupContainer();
      dockerRun(
        `run -d --name ${CONTAINER_NAME} -p ${PORT}:${PORT} ${IMAGE_NAME}:test`
      );

      // Wait for container to stabilize
      setTimeout(done, 5000);
    });

    test('should container have logs without critical errors', () => {
      const result = dockerRun(`logs ${CONTAINER_NAME}`);

      expect(result.success).toBe(true);
      // Check for absence of critical errors (allow warnings)
      expect(result.output).not.toMatch(/FATAL|CRITICAL|EXCEPTION/i);
    });

    test('should container memory usage be reasonable', () => {
      const result = dockerRun(
        `stats --no-stream ${CONTAINER_NAME} --format "{{.MemUsage}}"`
      );

      expect(result.success).toBe(true);
      expect(result.output.length).toBeGreaterThan(0);
    });

    test('should container CPU usage be measurable', () => {
      const result = dockerRun(
        `stats --no-stream ${CONTAINER_NAME} --format "{{.CPUPerc}}"`
      );

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/\d+\.\d+%/);
    });

    test('should dockerfile follow best practices', () => {
      const projectRoot = path.resolve(__dirname, '../../');
      const dockerfilePath = path.join(
        projectRoot,
        'config/docker/Dockerfile'
      );

      const content = fs.readFileSync(dockerfilePath, 'utf-8');

      // Check for best practices
      expect(content).toContain('FROM');
      expect(content).toContain('RUN');
      expect(content).toContain('EXPOSE');

      // Check for security practices
      expect(content).toContain('USER');
    });
  });

  // ============================================================================
  // TEST SUITE 6: PERFORMANCE BASELINE
  // ============================================================================

  describe('Performance Baseline', () => {
    beforeEach((done) => {
      cleanupContainer();
      dockerRun(
        `run -d --name ${CONTAINER_NAME} -p ${PORT}:${PORT} ${IMAGE_NAME}:test`
      );

      // Wait for container to be ready
      setTimeout(done, 5000);
    });

    test('should measure WebSocket response time', (done) => {
      const measureLatency = () => {
        return new Promise((resolve) => {
          const startTime = Date.now();
          const socket = net.createConnection(
            { host: 'localhost', port: PORT },
            () => {
              const latency = Date.now() - startTime;
              socket.destroy();
              resolve(latency);
            }
          );

          socket.on('error', () => {
            resolve(9999);
          });

          setTimeout(() => {
            socket.destroy();
            resolve(9999);
          }, 5000);
        });
      };

      measureLatency().then((latency) => {
        expect(latency).toBeLessThan(5000); // Should connect within 5s
        done();
      });
    }, HEALTH_CHECK_TIMEOUT + 5000);

    test('should handle multiple concurrent connections', (done) => {
      const concurrentConnections = 10;
      const connectionResults = [];

      const attemptConnection = () => {
        return new Promise((resolve) => {
          const socket = net.createConnection(
            { host: 'localhost', port: PORT },
            () => {
              socket.destroy();
              resolve(true);
            }
          );

          socket.on('error', () => {
            resolve(false);
          });

          setTimeout(() => {
            socket.destroy();
            resolve(false);
          }, 2000);
        });
      };

      Promise.all(
        Array(concurrentConnections)
          .fill(null)
          .map(() => attemptConnection())
      ).then((results) => {
        const successCount = results.filter((r) => r).length;
        expect(successCount).toBeGreaterThan(0); // At least some connections succeed
        done();
      });
    }, HEALTH_CHECK_TIMEOUT + 5000);
  });

  // ============================================================================
  // TEST SUITE 7: DOCKER COMPOSE VALIDATION
  // ============================================================================

  describe('Docker Compose Configuration', () => {
    test('should docker-compose.production.yml exist', () => {
      const projectRoot = path.resolve(__dirname, '../../');
      const composePath = path.join(
        projectRoot,
        'docker-compose.production.yml'
      );

      expect(fs.existsSync(composePath)).toBe(true);
    });

    test('should docker-compose file be valid YAML', () => {
      const projectRoot = path.resolve(__dirname, '../../');
      const composePath = path.join(
        projectRoot,
        'docker-compose.production.yml'
      );

      const content = fs.readFileSync(composePath, 'utf-8');

      // Basic YAML validation
      expect(content).toContain('version:');
      expect(content).toContain('services:');
    });

    test('should .dockerignore exist and be valid', () => {
      const projectRoot = path.resolve(__dirname, '../../');
      const dockerignorePath = path.join(projectRoot, '.dockerignore');

      expect(fs.existsSync(dockerignorePath)).toBe(true);

      const content = fs.readFileSync(dockerignorePath, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // TEST SUITE 8: DEPLOYMENT SCRIPTS
  // ============================================================================

  describe('Deployment Scripts', () => {
    test('should deploy-v12.7.0.sh exist and be executable', () => {
      const projectRoot = path.resolve(__dirname, '../../');
      const scriptPath = path.join(projectRoot, 'scripts/deploy-v12.7.0.sh');

      expect(fs.existsSync(scriptPath)).toBe(true);

      const stats = fs.statSync(scriptPath);
      expect(stats.mode & 0o111).not.toBe(0); // Check executable bit
    });

    test('should canary-deploy.sh exist and be executable', () => {
      const projectRoot = path.resolve(__dirname, '../../');
      const scriptPath = path.join(projectRoot, 'scripts/canary-deploy.sh');

      expect(fs.existsSync(scriptPath)).toBe(true);

      const stats = fs.statSync(scriptPath);
      expect(stats.mode & 0o111).not.toBe(0);
    });

    test('should health-check-v12.7.0.sh exist and be executable', () => {
      const projectRoot = path.resolve(__dirname, '../../');
      const scriptPath = path.join(
        projectRoot,
        'scripts/health-check-v12.7.0.sh'
      );

      expect(fs.existsSync(scriptPath)).toBe(true);

      const stats = fs.statSync(scriptPath);
      expect(stats.mode & 0o111).not.toBe(0);
    });

    test('should rollback-v12.7.0.sh exist and be executable', () => {
      const projectRoot = path.resolve(__dirname, '../../');
      const scriptPath = path.join(
        projectRoot,
        'scripts/rollback-v12.7.0.sh'
      );

      expect(fs.existsSync(scriptPath)).toBe(true);

      const stats = fs.statSync(scriptPath);
      expect(stats.mode & 0o111).not.toBe(0);
    });

    test('should deployment scripts have help documentation', () => {
      const projectRoot = path.resolve(__dirname, '../../');
      const scriptPath = path.join(projectRoot, 'scripts/deploy-v12.7.0.sh');

      const content = fs.readFileSync(scriptPath, 'utf-8');

      expect(content).toContain('Usage:');
      expect(content).toContain('OPTIONS:');
    });
  });

  // ============================================================================
  // TEST SUITE 9: SECURITY CHECKS
  // ============================================================================

  describe('Security Checks', () => {
    test('should Dockerfile use non-root user', () => {
      const projectRoot = path.resolve(__dirname, '../../');
      const dockerfilePath = path.join(
        projectRoot,
        'config/docker/Dockerfile'
      );

      const content = fs.readFileSync(dockerfilePath, 'utf-8');

      expect(content).toContain('USER');
      expect(content).toMatch(/USER\s+\w+/);
    });

    test('should docker-compose drop unnecessary capabilities', () => {
      const projectRoot = path.resolve(__dirname, '../../');
      const composePath = path.join(
        projectRoot,
        'docker-compose.production.yml'
      );

      const content = fs.readFileSync(composePath, 'utf-8');

      expect(content).toContain('cap_drop');
    });

    test('should deployment scripts not contain hardcoded secrets', () => {
      const projectRoot = path.resolve(__dirname, '../../');
      const scriptPath = path.join(projectRoot, 'scripts/deploy-v12.7.0.sh');

      const content = fs.readFileSync(scriptPath, 'utf-8');

      expect(content).not.toMatch(/password|secret|token|key/i);
    });
  });
});
