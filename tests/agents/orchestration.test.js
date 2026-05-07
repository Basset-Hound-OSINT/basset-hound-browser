/**
 * Unit tests for Multi-Agent Orchestration Framework
 * Tests workflow definition, execution, agent coordination, and data flow
 */

const Orchestrator = require('../../src/agents/orchestrator');
const OSINTIntegration = require('../../src/agents/osint-integration');
const ForensicIntegration = require('../../src/agents/forensic-integration');

describe('Multi-Agent Orchestration Framework', () => {
  let orchestrator;
  let mockOSINTAgent;
  let mockForensicAgent;

  beforeEach(() => {
    orchestrator = new Orchestrator();

    // Create mock agents
    mockOSINTAgent = {
      queryTarget: async (context) => ({
        success: true,
        results: { ip: '192.168.1.1', ports: [80, 443] }
      }),
      enrichData: async (context) => ({
        success: true,
        enriched: true,
        additionalInfo: 'Mock enrichment'
      })
    };

    mockForensicAgent = {
      captureScreenshot: async (context) => ({
        success: true,
        screenshotId: 'screenshot_123',
        hash: 'abc123'
      }),
      captureNetwork: async (context) => ({
        success: true,
        networkId: 'network_456',
        requestCount: 10
      })
    };

    // Register agents
    orchestrator.registerAgent('osint', mockOSINTAgent);
    orchestrator.registerAgent('forensic', mockForensicAgent);
  });

  describe('Agent Registration', () => {
    test('should register agent successfully', () => {
      const agent = { testMethod: async () => ({}) };
      const result = orchestrator.registerAgent('test-agent', agent);

      expect(result.success).toBe(true);
      expect(result.agentCount).toBe(3); // osint, forensic, test-agent
    });

    test('should reject registration without agent ID', () => {
      const result = orchestrator.registerAgent(null, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    test('should deregister agent successfully', () => {
      const result = orchestrator.deregisterAgent('osint');

      expect(result.success).toBe(true);
      expect(result.agentCount).toBe(1);
    });

    test('should fail to deregister non-existent agent', () => {
      const result = orchestrator.deregisterAgent('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should track agent information', () => {
      const info = orchestrator.getAgentInfo('osint');

      expect(info.success).toBe(true);
      expect(info.agent.id).toBe('osint');
      expect(info.agent.status).toBe('ready');
    });

    test('should list all agents', () => {
      const info = orchestrator.getAgentInfo();

      expect(info.success).toBe(true);
      expect(info.agentCount).toBe(2);
      expect(info.agents).toHaveLength(2);
    });
  });

  describe('Workflow Definition', () => {
    test('should define workflow successfully', () => {
      const result = orchestrator.defineWorkflow('test-workflow', [
        { agent: 'osint', command: 'queryTarget' },
        { agent: 'forensic', command: 'captureScreenshot' }
      ]);

      expect(result.success).toBe(true);
      expect(result.workflowCount).toBe(1);
    });

    test('should validate workflow structure', () => {
      const result = orchestrator.defineWorkflow('bad-workflow', [
        { agent: 'osint' } // missing command
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('command');
    });

    test('should require non-empty workflow steps', () => {
      const result = orchestrator.defineWorkflow('empty-workflow', []);

      expect(result.success).toBe(false);
    });

    test('should store workflow configuration', () => {
      orchestrator.defineWorkflow('my-workflow', [
        { agent: 'osint', command: 'queryTarget', timeout: 5000 },
        { agent: 'forensic', command: 'captureScreenshot' }
      ]);

      const info = orchestrator.getWorkflowInfo('my-workflow');

      expect(info.success).toBe(true);
      expect(info.workflow.steps).toBe(2);
    });

    test('should list all workflows', () => {
      orchestrator.defineWorkflow('workflow1', [
        { agent: 'osint', command: 'queryTarget' }
      ]);

      orchestrator.defineWorkflow('workflow2', [
        { agent: 'forensic', command: 'captureScreenshot' }
      ]);

      const info = orchestrator.getWorkflowInfo();

      expect(info.success).toBe(true);
      expect(info.workflowCount).toBe(2);
    });
  });

  describe('Workflow Execution', () => {
    beforeEach(() => {
      orchestrator.defineWorkflow('simple-workflow', [
        { agent: 'osint', command: 'queryTarget' },
        { agent: 'forensic', command: 'captureScreenshot' }
      ]);
    });

    test('should execute workflow successfully', async () => {
      const result = await orchestrator.executeWorkflow('simple-workflow');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.steps).toBe(2);
    });

    test('should return execution ID', async () => {
      const result = await orchestrator.executeWorkflow('simple-workflow');

      expect(result.executionId).toBeDefined();
      expect(result.executionId).toMatch(/^exec_/);
    });

    test('should track execution status', async () => {
      const result = await orchestrator.executeWorkflow('simple-workflow');
      const status = orchestrator.getExecutionStatus(result.executionId);

      expect(status.success).toBe(true);
      expect(status.status).toBe('completed');
      expect(status.stepsCompleted).toBe(2);
    });

    test('should fail when workflow not found', async () => {
      const result = await orchestrator.executeWorkflow('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should respect max concurrent workflows', async () => {
      const limited = new Orchestrator({ maxConcurrentWorkflows: 1 });
      limited.registerAgent('osint', mockOSINTAgent);

      limited.defineWorkflow('slow-workflow', [
        { agent: 'osint', command: 'queryTarget', timeout: 10000 }
      ]);

      // Start first execution
      const exec1 = limited.executeWorkflow('slow-workflow');

      // Try to start second (should fail)
      const exec2 = limited.executeWorkflow('slow-workflow');

      await exec1;
      expect((await exec2).success).toBe(false);
    });

    test('should pass context through workflow', async () => {
      orchestrator.defineWorkflow('context-workflow', [
        { agent: 'osint', command: 'queryTarget' }
      ]);

      const result = await orchestrator.executeWorkflow('context-workflow', {
        target: 'example.com'
      });

      expect(result.data).toBeDefined();
    });
  });

  describe('Data Flow Between Agents', () => {
    test('should pass data from first to second step', async () => {
      orchestrator.defineWorkflow('data-flow-workflow', [
        { agent: 'osint', command: 'queryTarget', resultKey: 'osintResults' },
        { agent: 'forensic', command: 'captureScreenshot', resultKey: 'forensicResults' }
      ]);

      const result = await orchestrator.executeWorkflow('data-flow-workflow');

      expect(result.data.osintResults).toBeDefined();
      expect(result.data.osintResults.results).toBeDefined();
    });

    test('should retrieve execution data', async () => {
      orchestrator.defineWorkflow('data-retrieval-workflow', [
        { agent: 'osint', command: 'queryTarget' }
      ]);

      const execResult = await orchestrator.executeWorkflow('data-retrieval-workflow');
      const dataResult = orchestrator.getExecutionData(execResult.executionId);

      expect(dataResult.success).toBe(true);
      expect(dataResult.data).toBeDefined();
    });

    test('should accumulate data across multiple steps', async () => {
      orchestrator.defineWorkflow('multi-step-workflow', [
        { agent: 'osint', command: 'queryTarget' },
        { agent: 'osint', command: 'enrichData' }
      ]);

      const result = await orchestrator.executeWorkflow('multi-step-workflow');

      expect(result.data).toBeDefined();
      expect(Object.keys(result.data).length).toBeGreaterThan(0);
    });
  });

  describe('Conditional Execution', () => {
    test('should support conditional steps', async () => {
      orchestrator.defineWorkflow('conditional-workflow', [
        { agent: 'osint', command: 'queryTarget', resultKey: 'queryResult' },
        {
          agent: 'forensic',
          command: 'captureScreenshot',
          condition: 'queryResult'
        }
      ]);

      const result = await orchestrator.executeWorkflow('conditional-workflow');

      expect(result.status).toBe('completed');
    });

    test('should skip step if condition not met', async () => {
      orchestrator.defineWorkflow('skip-workflow', [
        {
          agent: 'forensic',
          command: 'captureScreenshot',
          condition: { key: 'nonExistent', value: true }
        }
      ]);

      const result = await orchestrator.executeWorkflow('skip-workflow');

      expect(result.steps).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle step failure', async () => {
      const failingAgent = {
        failCommand: async () => {
          throw new Error('Intentional failure');
        }
      };

      orchestrator.registerAgent('failing-agent', failingAgent);
      orchestrator.defineWorkflow('failing-workflow', [
        { agent: 'failing-agent', command: 'failCommand' }
      ]);

      const result = await orchestrator.executeWorkflow('failing-workflow');

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should stop execution on failure', async () => {
      const failingAgent = {
        failCommand: async () => {
          throw new Error('Failed');
        }
      };

      orchestrator.registerAgent('failing', failingAgent);
      orchestrator.defineWorkflow('stop-on-failure', [
        { agent: 'failing', command: 'failCommand' },
        { agent: 'osint', command: 'queryTarget' }
      ]);

      const result = await orchestrator.executeWorkflow('stop-on-failure');

      expect(result.success).toBe(false);
      expect(result.steps).toBe(1); // Only first step executed
    });

    test('should provide error details', async () => {
      const failingAgent = {
        failCommand: async () => {
          throw new Error('Test error message');
        }
      };

      orchestrator.registerAgent('failing', failingAgent);
      orchestrator.defineWorkflow('error-details', [
        { agent: 'failing', command: 'failCommand' }
      ]);

      const result = await orchestrator.executeWorkflow('error-details');

      expect(result.errors[0]).toBeDefined();
      expect(result.errors[0].error).toContain('Test error message');
    });
  });

  describe('Execution Management', () => {
    test('should track execution count', async () => {
      orchestrator.defineWorkflow('tracked-workflow', [
        { agent: 'osint', command: 'queryTarget' }
      ]);

      await orchestrator.executeWorkflow('tracked-workflow');
      const info = orchestrator.getWorkflowInfo('tracked-workflow');

      expect(info.workflow.executionCount).toBeGreaterThanOrEqual(1);
    });

    test('should cancel execution', async () => {
      orchestrator.defineWorkflow('cancellable-workflow', [
        { agent: 'osint', command: 'queryTarget' }
      ]);

      const result = await orchestrator.executeWorkflow('cancellable-workflow');
      const cancelResult = orchestrator.cancelExecution(result.executionId);

      expect(cancelResult.success).toBe(true);
    });

    test('should provide orchestration status', () => {
      const status = orchestrator.getStatus();

      expect(status.agentsRegistered).toBe(2);
      expect(status.activeWorkflows).toBeGreaterThanOrEqual(0);
      expect(status.maxConcurrentWorkflows).toBe(5);
    });
  });

  describe('History Management', () => {
    test('should clear execution history', async () => {
      orchestrator.defineWorkflow('history-workflow', [
        { agent: 'osint', command: 'queryTarget' }
      ]);

      await orchestrator.executeWorkflow('history-workflow');

      const result = orchestrator.clearExecutionHistory();

      expect(result.success).toBe(true);
      expect(result.remainingExecutions).toBe(0);
    });

    test('should preserve execution history', async () => {
      orchestrator.defineWorkflow('persistence-workflow', [
        { agent: 'osint', command: 'queryTarget' }
      ]);

      const result = await orchestrator.executeWorkflow('persistence-workflow');

      // Clear history with a past date (keeps recent executions)
      const past = Date.now() - 1000000;
      const clearResult = orchestrator.clearExecutionHistory(past);

      expect(clearResult.success).toBe(true);
      expect(clearResult.remainingExecutions).toBe(1);
    });
  });

  describe('Event Emission', () => {
    test('should emit execution start event', async () => {
      orchestrator.defineWorkflow('event-workflow', [
        { agent: 'osint', command: 'queryTarget' }
      ]);

      const events = [];
      orchestrator.on('execution:start', (event) => {
        events.push('start');
      });

      await orchestrator.executeWorkflow('event-workflow');

      expect(events).toContain('start');
    });

    test('should emit step completed event', async () => {
      orchestrator.defineWorkflow('step-event-workflow', [
        { agent: 'osint', command: 'queryTarget' }
      ]);

      const events = [];
      orchestrator.on('step:completed', () => {
        events.push('completed');
      });

      await orchestrator.executeWorkflow('step-event-workflow');

      expect(events).toContain('completed');
    });
  });

  describe('OSINT Integration', () => {
    test('should integrate OSINT agent', async () => {
      const osintIntegration = new OSINTIntegration();
      orchestrator.registerAgent('osint-full', {
        queryShodan: async (context) => osintIntegration.queryShodan(context.target),
        queryDNS: async (context) => osintIntegration.queryDNS(context.target)
      });

      orchestrator.defineWorkflow('osint-workflow', [
        { agent: 'osint-full', command: 'queryShodan' }
      ]);

      const result = await orchestrator.executeWorkflow('osint-workflow', {
        target: 'example.com'
      });

      expect(result.status).toBe('completed');
    });
  });

  describe('Forensic Integration', () => {
    test('should integrate Forensic agent', async () => {
      const forensicIntegration = new ForensicIntegration();
      orchestrator.registerAgent('forensic-full', {
        captureScreenshot: async (context) =>
          forensicIntegration.captureScreenshot(Buffer.from('test'), context),
        captureNetwork: async (context) =>
          forensicIntegration.captureNetworkTraffic({}, {}, context)
      });

      orchestrator.defineWorkflow('forensic-workflow', [
        { agent: 'forensic-full', command: 'captureScreenshot' }
      ]);

      const result = await orchestrator.executeWorkflow('forensic-workflow');

      expect(result.status).toBe('completed');
    });
  });
});
