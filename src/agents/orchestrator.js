/**
 * Basset Hound Browser - Multi-Agent Orchestration Framework
 * Enables agents to coordinate across OSINT → Basset Hound → Forensics
 *
 * Version: 1.0.0
 * Created: May 7, 2026
 */

const crypto = require('crypto');
const EventEmitter = require('events');

class Orchestrator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.agents = new Map(); // Registered agents
    this.workflows = new Map(); // Defined workflows
    this.executions = new Map(); // Active/completed executions
    this.dataStore = new Map(); // Shared data between agents
    this.executionId = null;
    this.maxConcurrentWorkflows = options.maxConcurrentWorkflows || 5;
    this.activeWorkflows = 0;
  }

  /**
   * Register an agent with the orchestrator
   */
  registerAgent(agentId, agentInstance) {
    if (!agentId || !agentInstance) {
      return { success: false, error: 'Agent ID and instance required' };
    }

    this.agents.set(agentId, {
      id: agentId,
      instance: agentInstance,
      registeredAt: Date.now(),
      executionCount: 0,
      lastExecution: null,
      status: 'ready'
    });

    return {
      success: true,
      message: `Agent ${agentId} registered`,
      agentCount: this.agents.size
    };
  }

  /**
   * Deregister an agent
   */
  deregisterAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    this.agents.delete(agentId);
    return {
      success: true,
      message: `Agent ${agentId} deregistered`,
      agentCount: this.agents.size
    };
  }

  /**
   * Define a workflow
   */
  defineWorkflow(workflowId, steps) {
    if (!workflowId || !Array.isArray(steps) || steps.length === 0) {
      return { success: false, error: 'Workflow ID and non-empty steps required' };
    }

    const validatedSteps = [];
    for (const step of steps) {
      if (!step.agent || !step.command) {
        return {
          success: false,
          error: 'Each step must have agent and command'
        };
      }

      validatedSteps.push({
        agent: step.agent,
        command: step.command,
        timeout: step.timeout || 30000,
        retries: step.retries || 1,
        resultKey: step.resultKey || step.agent,
        condition: step.condition // Optional conditional logic
      });
    }

    this.workflows.set(workflowId, {
      id: workflowId,
      steps: validatedSteps,
      createdAt: Date.now(),
      executionCount: 0
    });

    return {
      success: true,
      message: `Workflow ${workflowId} defined with ${steps.length} steps`,
      workflowCount: this.workflows.size
    };
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId, context = {}) {
    if (this.activeWorkflows >= this.maxConcurrentWorkflows) {
      return {
        success: false,
        error: `Maximum concurrent workflows (${this.maxConcurrentWorkflows}) reached`
      };
    }

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return { success: false, error: 'Workflow not found' };
    }

    const executionId = this.generateExecutionId();
    const startTime = Date.now();

    const execution = {
      id: executionId,
      workflowId,
      status: 'running',
      startTime,
      steps: [],
      data: { ...context },
      errors: []
    };

    this.executions.set(executionId, execution);
    this.activeWorkflows++;
    this.emit('execution:start', { executionId, workflowId });

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        const stepExecution = {
          stepIndex: i,
          agent: step.agent,
          command: step.command,
          status: 'pending',
          startTime: Date.now(),
          result: null,
          error: null
        };

        execution.steps.push(stepExecution);

        // Check conditional logic
        if (step.condition) {
          const conditionMet = await this.evaluateCondition(step.condition, execution.data);
          if (!conditionMet) {
            stepExecution.status = 'skipped';
            this.emit('step:skipped', { executionId, stepIndex: i, step });
            continue;
          }
        }

        // Execute step
        let result;
        try {
          result = await this.executeStep(step, execution.data, step.retries);
          stepExecution.status = 'completed';
          stepExecution.result = result;
          execution.data[step.resultKey] = result;

          this.emit('step:completed', { executionId, stepIndex: i, result });
        } catch (error) {
          stepExecution.status = 'failed';
          stepExecution.error = error.message;
          execution.errors.push({
            stepIndex: i,
            agent: step.agent,
            error: error.message
          });

          this.emit('step:failed', { executionId, stepIndex: i, error });

          execution.status = 'failed';
          break;
        }
      }

      if (execution.status !== 'failed') {
        execution.status = 'completed';
      }
    } catch (error) {
      execution.status = 'error';
      execution.errors.push({ error: error.message });
    }

    execution.endTime = Date.now();
    execution.duration = execution.endTime - startTime;
    this.activeWorkflows--;

    // Increment workflow execution count
    const wf = this.workflows.get(workflowId);
    if (wf) {
      wf.executionCount++;
    }

    this.emit('execution:end', {
      executionId,
      workflowId,
      status: execution.status
    });

    return {
      success: execution.status === 'completed',
      executionId,
      status: execution.status,
      data: execution.data,
      duration: execution.duration,
      steps: execution.steps.length,
      errors: execution.errors
    };
  }

  /**
   * Execute a single workflow step
   */
  async executeStep(step, context, retriesLeft) {
    const agent = this.agents.get(step.agent);
    if (!agent) {
      throw new Error(`Agent ${step.agent} not found`);
    }

    try {
      const method = agent.instance[step.command];
      if (typeof method !== 'function') {
        throw new Error(`Agent ${step.agent} does not have command ${step.command}`);
      }

      return await Promise.race([
        method.call(agent.instance, context),
        this.createTimeout(step.timeout)
      ]);
    } catch (error) {
      if (retriesLeft > 1) {
        await this.delay(1000); // Wait before retry
        return this.executeStep(step, context, retriesLeft - 1);
      }

      throw error;
    }
  }

  /**
   * Evaluate conditional logic
   */
  async evaluateCondition(condition, data) {
    if (typeof condition === 'function') {
      return condition(data);
    }

    if (typeof condition === 'string') {
      // Simple key existence check
      return data.hasOwnProperty(condition);
    }

    if (typeof condition === 'object') {
      // Condition object: {key, value, operator}
      const value = data[condition.key];
      const expected = condition.value;
      const op = condition.operator || 'equals';

      switch (op) {
        case 'equals': return value === expected;
        case 'contains': return String(value).includes(expected);
        case 'greaterThan': return value > expected;
        case 'lessThan': return value < expected;
        default: return true;
      }
    }

    return true;
  }

  /**
   * Get execution status
   */
  getExecutionStatus(executionId) {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return { success: false, error: 'Execution not found' };
    }

    return {
      success: true,
      executionId,
      workflowId: execution.workflowId,
      status: execution.status,
      startTime: execution.startTime,
      endTime: execution.endTime,
      duration: execution.duration,
      stepsCompleted: execution.steps.filter(s => s.status === 'completed').length,
      totalSteps: execution.steps.length,
      errors: execution.errors
    };
  }

  /**
   * Get execution data
   */
  getExecutionData(executionId) {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return { success: false, error: 'Execution not found' };
    }

    return {
      success: true,
      executionId,
      data: execution.data,
      status: execution.status
    };
  }

  /**
   * Cancel workflow execution
   */
  cancelExecution(executionId) {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return { success: false, error: 'Execution not found' };
    }

    if (execution.status === 'running') {
      execution.status = 'cancelled';
      this.activeWorkflows--;
    }

    return {
      success: true,
      executionId,
      status: execution.status
    };
  }

  /**
   * Get agent information
   */
  getAgentInfo(agentId = null) {
    if (agentId) {
      const agent = this.agents.get(agentId);
      if (!agent) {
        return { success: false, error: 'Agent not found' };
      }

      return {
        success: true,
        agent: {
          id: agent.id,
          status: agent.status,
          registeredAt: agent.registeredAt,
          executionCount: agent.executionCount,
          lastExecution: agent.lastExecution
        }
      };
    }

    const agents = [];
    for (const [id, agent] of this.agents) {
      agents.push({
        id: agent.id,
        status: agent.status,
        executionCount: agent.executionCount
      });
    }

    return {
      success: true,
      agentCount: agents.length,
      agents
    };
  }

  /**
   * Get workflow information
   */
  getWorkflowInfo(workflowId = null) {
    if (workflowId) {
      const workflow = this.workflows.get(workflowId);
      if (!workflow) {
        return { success: false, error: 'Workflow not found' };
      }

      return {
        success: true,
        workflow: {
          id: workflow.id,
          steps: workflow.steps.length,
          createdAt: workflow.createdAt,
          executionCount: workflow.executionCount
        }
      };
    }

    const workflows = [];
    for (const [id, workflow] of this.workflows) {
      workflows.push({
        id: workflow.id,
        steps: workflow.steps.length,
        executionCount: workflow.executionCount
      });
    }

    return {
      success: true,
      workflowCount: workflows.length,
      workflows
    };
  }

  /**
   * Get orchestration status
   */
  getStatus() {
    return {
      agentsRegistered: this.agents.size,
      workflowsDefined: this.workflows.size,
      activeWorkflows: this.activeWorkflows,
      maxConcurrentWorkflows: this.maxConcurrentWorkflows,
      totalExecutions: this.executions.size,
      uptime: Date.now()
    };
  }

  /**
   * Clear execution history
   */
  clearExecutionHistory(beforeTime = null) {
    let clearedCount = 0;

    for (const [id, execution] of this.executions) {
      if (beforeTime === null || execution.endTime < beforeTime) {
        this.executions.delete(id);
        clearedCount++;
      }
    }

    return {
      success: true,
      clearedExecutions: clearedCount,
      remainingExecutions: this.executions.size
    };
  }

  /**
   * Helper: Generate unique execution ID
   */
  generateExecutionId() {
    return `exec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Helper: Create a timeout promise
   */
  createTimeout(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Execution timeout')), ms);
    });
  }

  /**
   * Helper: Delay execution
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = Orchestrator;
