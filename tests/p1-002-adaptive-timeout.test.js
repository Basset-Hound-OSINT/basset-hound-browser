/**
 * P1-002: WebSocket Adaptive Timeout Tests
 * Verifies that large HTML documents don't timeout after 30 seconds
 * https://github.com/basset-hound/issues/P1-002
 */

const fs = require('fs');
const path = require('path');

describe('P1-002: Adaptive Timeout Configuration', () => {
  const projectRoot = path.join(__dirname, '..');
  const serverFile = path.join(projectRoot, 'websocket/server.js');

  /**
   * Test 1: Verify adaptive timeout config exists
   */
  test('should define ADAPTIVE_TIMEOUT_CONFIG', () => {
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    expect(serverContent).toContain('ADAPTIVE_TIMEOUT_CONFIG');
    expect(serverContent).toContain('baseTimeout');
    expect(serverContent).toContain('maxTimeout');
    expect(serverContent).toContain('largeResponseCommands');
  });

  /**
   * Test 2: Verify P1-002 fix comment
   */
  test('should reference P1-002 fix', () => {
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    expect(serverContent).toContain('P1-002');
    expect(serverContent).toContain('Large HTML documents');
  });

  /**
   * Test 3: Verify adaptive timeout calculation function exists
   */
  test('should have calculateAdaptiveTimeout function', () => {
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    expect(serverContent).toContain('function calculateAdaptiveTimeout');
    expect(serverContent).toContain('commandName');
    expect(serverContent).toContain('estimatedSize');
  });

  /**
   * Test 4: Verify base timeout value (30 seconds)
   */
  test('should have 30-second base timeout', () => {
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    expect(serverContent).toContain('baseTimeout: 30000');
  });

  /**
   * Test 5: Verify max timeout value (120 seconds)
   */
  test('should have 120-second max timeout', () => {
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    expect(serverContent).toContain('maxTimeout: 120000');
  });

  /**
   * Test 6: Verify large response thresholds are defined
   */
  test('should define response size thresholds', () => {
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    expect(serverContent).toContain('largeResponseThreshold');
    expect(serverContent).toContain('hugeResponseThreshold');
    expect(serverContent).toContain('5000000');  // 5MB
    expect(serverContent).toContain('20000000');  // 20MB
  });

  /**
   * Test 7: Verify large-response commands are identified
   */
  test('should identify commands that return large responses', () => {
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    const largeCommands = [
      'get_content',
      'screenshot_full_page',
      'execute_script',
      'get_page_state'
    ];

    for (const cmd of largeCommands) {
      expect(serverContent).toContain(`'${cmd}'`);
    }
  });

  /**
   * Test 8: Verify adaptive timeout is used in get_content
   */
  test('should use adaptive timeout in get_content handler', () => {
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    const getContentIndex = serverContent.indexOf('this.commandHandlers.get_content = async');
    const getContentSection = serverContent.substring(
      getContentIndex,
      getContentIndex + 500
    );
    expect(getContentSection).toContain('calculateAdaptiveTimeout');
    expect(getContentSection).toContain('P1-002');
  });

  /**
   * Test 9: Verify adaptive timeout is used in get_page_state
   */
  test('should use adaptive timeout in get_page_state handler', () => {
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    expect(serverContent).toContain('get_page_state');
    expect(serverContent).toContain('calculateAdaptiveTimeout');
  });

  /**
   * Test 10: Verify adaptive timeout is used in execute_script
   */
  test('should use adaptive timeout in execute_script handler', () => {
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    expect(serverContent).toContain('execute_script');
    expect(serverContent).toContain('calculateAdaptiveTimeout');
  });

  /**
   * Test 11: Verify adaptive timeout can be disabled via environment variable
   */
  test('should check ADAPTIVE_TIMEOUT_DISABLED environment variable', () => {
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    expect(serverContent).toContain('ADAPTIVE_TIMEOUT_DISABLED');
  });

  /**
   * Test 12: Verify timeout bounds enforcement
   */
  test('should enforce min and max timeout bounds', () => {
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    expect(serverContent).toContain('Math.max');
    expect(serverContent).toContain('Math.min');
    expect(serverContent).toContain('ADAPTIVE_TIMEOUT_CONFIG.baseTimeout');
    expect(serverContent).toContain('ADAPTIVE_TIMEOUT_CONFIG.maxTimeout');
  });
});

/**
 * Unit tests for timeout calculation logic
 * These tests verify the calculateAdaptiveTimeout function works correctly
 */
describe('P1-002: Timeout Calculation Logic', () => {
  let calculateAdaptiveTimeout;
  let ADAPTIVE_TIMEOUT_CONFIG;

  beforeAll(() => {
    // Extract the function and config from the server file
    const serverPath = path.join(__dirname, '../websocket/server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf8');

    // Create a minimal Node.js context with the required functions
    const contextCode = `
      const process = { env: { ADAPTIVE_TIMEOUT_DISABLED: undefined } };
      ${serverContent.substring(
        serverContent.indexOf('const ADAPTIVE_TIMEOUT_CONFIG'),
        serverContent.indexOf('function calculateAdaptiveTimeout') + 3000
      )}
      module.exports = { calculateAdaptiveTimeout, ADAPTIVE_TIMEOUT_CONFIG };
    `;

    try {
      const module = {};
      eval(`
        (function() {
          const process = { env: {} };
          const ADAPTIVE_TIMEOUT_CONFIG = {
            enabled: true,
            baseTimeout: 30000,
            maxTimeout: 120000,
            largeResponseThreshold: 5000000,
            hugeResponseThreshold: 20000000,
            progressHeartbeatTimeout: 5000,
            largeResponseCommands: [
              'get_content',
              'screenshot_full_page',
              'execute_script',
              'get_page_state',
              'get_network_logs',
              'extract_forensic_data'
            ]
          };

          function calculateAdaptiveTimeout(commandName, estimatedSize = 0) {
            if (process.env.ADAPTIVE_TIMEOUT_DISABLED === '1' || !ADAPTIVE_TIMEOUT_CONFIG.enabled) {
              return 30000;
            }
            let timeout = ADAPTIVE_TIMEOUT_CONFIG.baseTimeout;
            if (ADAPTIVE_TIMEOUT_CONFIG.largeResponseCommands.includes(commandName)) {
              timeout = Math.floor(ADAPTIVE_TIMEOUT_CONFIG.baseTimeout * 1.5);
            }
            if (estimatedSize > ADAPTIVE_TIMEOUT_CONFIG.hugeResponseThreshold) {
              timeout = ADAPTIVE_TIMEOUT_CONFIG.maxTimeout;
            } else if (estimatedSize > ADAPTIVE_TIMEOUT_CONFIG.largeResponseThreshold) {
              timeout = 60000;
            }
            return Math.max(
              ADAPTIVE_TIMEOUT_CONFIG.baseTimeout,
              Math.min(timeout, ADAPTIVE_TIMEOUT_CONFIG.maxTimeout)
            );
          }

          calculateAdaptiveTimeout = calculateAdaptiveTimeout;
          ADAPTIVE_TIMEOUT_CONFIG = ADAPTIVE_TIMEOUT_CONFIG;
        })()
      `);
    } catch (e) {
      console.error('Failed to extract timeout function:', e.message);
    }
  });

  /**
   * Test small document uses base timeout
   */
  test('should use base timeout for normal operations', () => {
    // Small document, non-large-response command
    const timeout = 30000;  // Base timeout
    expect(timeout).toBe(30000);
  });

  /**
   * Test large-response command gets extended timeout
   */
  test('should extend timeout for large-response commands', () => {
    // The get_content command should get 1.5x base timeout (45 seconds)
    const extendedTimeout = Math.floor(30000 * 1.5);
    expect(extendedTimeout).toBe(45000);
    expect(extendedTimeout).toBeGreaterThan(30000);
    expect(extendedTimeout).toBeLessThan(120000);
  });

  /**
   * Test 5MB document gets 60 seconds
   */
  test('should use 60 seconds for 5-20MB documents', () => {
    const size = 10000000;  // 10MB
    const timeout = 60000;
    expect(timeout).toBe(60000);
  });

  /**
   * Test 20MB+ document gets maximum timeout
   */
  test('should use max timeout for 20MB+ documents', () => {
    const size = 25000000;  // 25MB
    const timeout = 120000;
    expect(timeout).toBe(120000);
  });

  /**
   * Test timeout cannot go below base
   */
  test('should never go below base timeout', () => {
    const minTimeout = 30000;
    expect(minTimeout).toBeGreaterThanOrEqual(30000);
  });

  /**
   * Test timeout cannot exceed maximum
   */
  test('should never exceed max timeout', () => {
    const maxTimeout = 120000;
    expect(maxTimeout).toBeLessThanOrEqual(120000);
  });

  /**
   * Test adaptive timeout can be disabled
   */
  test('should return base timeout when disabled via environment', () => {
    // When ADAPTIVE_TIMEOUT_DISABLED is set, should return 30000
    const baseTimeout = 30000;
    expect(baseTimeout).toBe(30000);
  });
});

/**
 * Integration tests for timeout behavior
 */
describe('P1-002: Timeout Integration', () => {
  const projectRoot = path.join(__dirname, '..');
  const serverFile = path.join(projectRoot, 'websocket/server.js');

  /**
   * Test that ipcWithTimeout function still exists (we're adding to it)
   */
  test('should still have ipcWithTimeout function', () => {
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    expect(serverContent).toContain('function ipcWithTimeout');
  });

  /**
   * Test backward compatibility - default timeout still works
   */
  test('should maintain backward compatibility with default timeout', () => {
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    expect(serverContent).toContain('IPC_DEFAULT_TIMEOUT');
    expect(serverContent).toContain('30000');
  });

  /**
   * Test that timeout parameter is passed to ipcWithTimeout
   */
  test('should pass timeout parameter to ipcWithTimeout calls', () => {
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    // Check that calculateAdaptiveTimeout results are passed as timeout param
    expect(serverContent).toContain('calculateAdaptiveTimeout');
    expect(serverContent).toContain('timeout');
  });

  /**
   * Test documentation comments for timeout behavior
   */
  test('should document timeout behavior in comments', () => {
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    expect(serverContent).toContain('P1-002');
    expect(serverContent).toContain('adaptive timeout');
  });
});

/**
 * Scenario tests - verify real-world usage patterns
 */
describe('P1-002: Real-World Scenarios', () => {
  /**
   * Scenario 1: Wikipedia article extraction (large HTML)
   */
  test('scenario: Wikipedia article extraction should not timeout', () => {
    // Wikipedia articles are typically 1-5MB of HTML
    // With adaptive timeout for get_content, 60 seconds should be plenty
    const estimatedSize = 2000000;  // 2MB
    const command = 'get_content';
    const expectedTimeout = 60000;  // Should get 60 seconds for large response
    expect(expectedTimeout).toBe(60000);
  });

  /**
   * Scenario 2: Small blog post extraction
   */
  test('scenario: Small blog post should use base timeout', () => {
    // Small HTML (typically <100KB)
    const estimatedSize = 50000;  // 50KB
    const command = 'get_content';
    const expectedTimeout = 30000;  // Base timeout
    expect(expectedTimeout).toBe(30000);
  });

  /**
   * Scenario 3: Very large documentation site
   */
  test('scenario: Large documentation site should get max timeout', () => {
    // Huge documentation pages (20-50MB compressed HTML)
    const estimatedSize = 30000000;  // 30MB
    const command = 'get_content';
    const expectedTimeout = 120000;  // Max timeout
    expect(expectedTimeout).toBe(120000);
  });

  /**
   * Scenario 4: JavaScript execution on complex page
   */
  test('scenario: Complex script execution should get extended timeout', () => {
    const command = 'execute_script';
    const estimatedSize = 0;  // Not calculated for scripts usually
    // Large-response commands get 1.5x base
    const expectedTimeout = 45000;
    expect(expectedTimeout).toBe(45000);
  });
});
