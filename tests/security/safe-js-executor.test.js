/**
 * Test suite for Safe JavaScript Executor
 */

const { SafeJavaScriptExecutor } = require('../../src/execution/safe-js-executor');

describe('SafeJavaScriptExecutor', () => {
  let executor;

  beforeEach(() => {
    executor = new SafeJavaScriptExecutor();
  });

  // ========== Code Validation Tests ==========

  describe('Code Validation', () => {
    it('should accept valid code', () => {
      const result = executor.validateCode('return 42;');
      expect(result.valid).toBe(true);
    });

    it('should reject non-string input', () => {
      const result = executor.validateCode(123);
      expect(result.valid).toBe(false);
    });

    it('should reject empty code', () => {
      const result = executor.validateCode('');
      expect(result.valid).toBe(false);
    });

    it('should reject code exceeding size limit', () => {
      const code = 'a'.repeat(1048577);
      const result = executor.validateCode(code);
      expect(result.valid).toBe(false);
    });
  });

  // ========== Blocklist Tests ==========

  describe('Code Blocklist', () => {
    const blocklistTests = [
      { code: 'eval("malicious")', pattern: 'eval' },
      { code: 'new Function("code")', pattern: 'Function' },
      { code: 'document.write("x")', pattern: 'document.write' },
      { code: 'window.location.href = "x"', pattern: 'window.location' },
      { code: 'fetch("url")', pattern: 'fetch' },
      { code: 'new WebSocket("url")', pattern: 'WebSocket' },
      { code: 'new Worker("code")', pattern: 'Worker' },
      { code: 'new Proxy(target, handler)', pattern: 'Proxy' },
      { code: 'require("module")', pattern: 'require' },
      { code: 'process.env', pattern: 'process' }
    ];

    blocklistTests.forEach(({ code, pattern }) => {
      it(`should block ${pattern}`, () => {
        const result = executor.validateCode(code);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Forbidden');
      });
    });
  });

  // ========== Infinite Loop Detection Tests ==========

  describe('Infinite Loop Detection', () => {
    it('should detect while(true) loops', () => {
      const result = executor.validateCode('while(true) {}');
      expect(result.valid).toBe(false);
    });

    it('should detect while (true) with spaces', () => {
      const result = executor.validateCode('while (true) {}');
      expect(result.valid).toBe(false);
    });

    it('should detect for(;;) loops', () => {
      const result = executor.validateCode('for(;;) {}');
      expect(result.valid).toBe(false);
    });

    it('should allow normal loops with conditions', () => {
      const result = executor.validateCode('for(let i = 0; i < 10; i++) {}');
      expect(result.valid).toBe(true);
    });
  });

  // ========== Sandbox Wrapping Tests ==========

  describe('Sandbox Wrapping', () => {
    it('should wrap code in sandbox', () => {
      const code = 'return 42;';
      const wrapped = executor._wrapInSandbox(code);
      expect(wrapped).toContain('function() {');
      expect(wrapped).toContain(code);
      expect(wrapped).toContain('fetch = undefined');
      expect(wrapped).toContain('eval = undefined');
    });

    it('should block fetch in sandbox', () => {
      const wrapped = executor._wrapInSandbox('return 1;');
      expect(wrapped).toContain('fetch = undefined');
    });

    it('should block XMLHttpRequest in sandbox', () => {
      const wrapped = executor._wrapInSandbox('return 1;');
      expect(wrapped).toContain('XMLHttpRequest = undefined');
    });

    it('should block WebSocket in sandbox', () => {
      const wrapped = executor._wrapInSandbox('return 1;');
      expect(wrapped).toContain('WebSocket = undefined');
    });

    it('should block Worker in sandbox', () => {
      const wrapped = executor._wrapInSandbox('return 1;');
      expect(wrapped).toContain('Worker = undefined');
    });

    it('should block require in sandbox', () => {
      const wrapped = executor._wrapInSandbox('return 1;');
      expect(wrapped).toContain('require = undefined');
    });

    it('should block process in sandbox', () => {
      const wrapped = executor._wrapInSandbox('return 1;');
      expect(wrapped).toContain('process = undefined');
    });

    it('should allow Math in sandbox', () => {
      const wrapped = executor._wrapInSandbox('return 1;');
      expect(wrapped).toContain('Math = Math');
    });

    it('should allow console in sandbox', () => {
      const wrapped = executor._wrapInSandbox('return 1;');
      expect(wrapped).toContain('console = console');
    });
  });

  // ========== Execution History Tests ==========

  describe('Execution History', () => {
    it('should maintain execution history', () => {
      expect(executor.getExecutionHistory().length).toBe(0);
      executor._logExecution('id-1', 'success', 'code-snippet', 100);
      expect(executor.getExecutionHistory().length).toBeGreaterThan(0);
    });

    it('should limit history size', () => {
      for (let i = 0; i < 1500; i++) {
        executor._logExecution(`id-${i}`, 'success', 'snippet', 100);
      }
      const history = executor.getExecutionHistory(1000);
      expect(history.length).toBeLessThanOrEqual(1000);
    });

    it('should clear execution history', () => {
      executor._logExecution('id-1', 'success', 'code', 100);
      expect(executor.getExecutionHistory().length).toBeGreaterThan(0);
      executor.clearExecutionHistory();
      expect(executor.getExecutionHistory().length).toBe(0);
    });
  });

  // ========== Statistics Tests ==========

  describe('Statistics', () => {
    it('should calculate execution statistics', () => {
      executor._logExecution('id-1', 'success', 'code', 100);
      executor._logExecution('id-2', 'error', 'code', 50, 'Error');

      const stats = executor.getStats();
      expect(stats.totalExecutions).toBe(2);
      expect(stats.successful).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.successRate).toBe('50.00%');
    });
  });

  // ========== Quick Validation Tests ==========

  describe('Quick Validation', () => {
    it('should perform quick validation', () => {
      expect(SafeJavaScriptExecutor.quickValidate('return 42;')).toBe(true);
      expect(SafeJavaScriptExecutor.quickValidate('eval("x")')).toBe(false);
      expect(SafeJavaScriptExecutor.quickValidate('')).toBe(false);
      expect(SafeJavaScriptExecutor.quickValidate(123)).toBe(false);
    });
  });

  // ========== Configuration Tests ==========

  describe('Configuration', () => {
    it('should allow custom timeout', () => {
      const customExecutor = new SafeJavaScriptExecutor({ timeout: 60000 });
      expect(customExecutor.config.timeout).toBe(60000);
    });

    it('should allow disabling blocklist', () => {
      const customExecutor = new SafeJavaScriptExecutor({ checkBlocklist: false });
      expect(customExecutor.config.checkBlocklist).toBe(false);
    });

    it('should allow custom code limit', () => {
      const customExecutor = new SafeJavaScriptExecutor({ codeLimit: 2097152 });
      expect(customExecutor.config.codeLimit).toBe(2097152);
    });
  });
});
