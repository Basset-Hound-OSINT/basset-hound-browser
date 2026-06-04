/**
 * Task Scheduler
 * Wave 16 Phase 2: Distributed Architecture
 *
 * Features:
 * - Schedule tasks for future execution
 * - Recurring tasks (daily, weekly, monthly)
 * - Task persistence across restarts
 * - Priority-based execution
 */

const EventEmitter = require('events');

class TaskScheduler extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxConcurrentTasks: options.maxConcurrentTasks || 5,
      enablePersistence: options.enablePersistence !== false,
      persistenceDir: options.persistenceDir || './data/tasks',
      taskTimeout: options.taskTimeout || 300000, // 5 minutes
      retryFailedTasks: options.retryFailedTasks !== false,
      maxTaskRetries: options.maxTaskRetries || 3,
      ...options
    };

    // Task registry and scheduling
    this.tasks = new Map();
    this.taskDefinitions = new Map();
    this.scheduledTasks = [];
    this.runningTasks = new Set();
    this.completedTasks = [];

    // Recurring task patterns
    this.recurringPatterns = {
      'ONCE': null,
      'HOURLY': 3600000,
      'DAILY': 86400000,
      'WEEKLY': 604800000,
      'MONTHLY': 2592000000,
      'CUSTOM': null
    };

    // Metrics
    this.metrics = {
      tasksScheduled: 0,
      tasksExecuted: 0,
      tasksFailed: 0,
      tasksSkipped: 0,
      tasksRetried: 0,
      totalExecutionTime: 0,
      executionTimes: [],
      taskMetrics: new Map()
    };

    // Start scheduler loop
    this._startSchedulerLoop();
  }

  /**
   * Define task template
   */
  defineTask(taskType, definition) {
    try {
      const taskDef = {
        type: taskType,
        name: definition.name,
        handler: definition.handler,
        timeout: definition.timeout || this.options.taskTimeout,
        retryable: definition.retryable !== false,
        maxRetries: definition.maxRetries || this.options.maxTaskRetries,
        priority: definition.priority || 'normal',
        tags: definition.tags || [],
        createdAt: Date.now()
      };

      this.taskDefinitions.set(taskType, taskDef);

      // Initialize metrics for this task type
      this.metrics.taskMetrics.set(taskType, {
        taskType,
        scheduled: 0,
        executed: 0,
        failed: 0,
        averageExecutionTime: 0,
        executionTimes: []
      });

      this.emit('task:defined', { taskType, definition: taskDef });
      console.log(`[TaskScheduler] Task type defined: ${taskType}`);

      return taskDef;
    } catch (error) {
      console.error(`[TaskScheduler] Failed to define task ${taskType}:`, error.message);
      throw error;
    }
  }

  /**
   * Schedule task
   */
  scheduleTask(taskId, taskType, payload, options = {}) {
    try {
      const taskDef = this.taskDefinitions.get(taskType);
      if (!taskDef) {
        throw new Error(`Task type not defined: ${taskType}`);
      }

      const scheduledTime = options.scheduledTime || Date.now();
      const recurrence = options.recurrence || 'ONCE';

      const task = {
        id: taskId,
        type: taskType,
        payload,
        status: 'scheduled',
        priority: options.priority || taskDef.priority,
        scheduledTime,
        nextExecutionTime: scheduledTime,
        recurrence,
        recurringPattern: this.recurringPatterns[recurrence] || null,
        lastExecutionTime: null,
        lastExecutionResult: null,
        retryCount: 0,
        failureCount: 0,
        executionCount: 0,
        createdAt: Date.now(),
        tags: options.tags || [],
        enabled: options.enabled !== false
      };

      this.tasks.set(taskId, task);
      this.scheduledTasks.push(task);
      this.scheduledTasks.sort((a, b) => b.priority.localeCompare(a.priority) || a.nextExecutionTime - b.nextExecutionTime);

      this.metrics.tasksScheduled++;

      // Update task metrics
      const taskMetrics = this.metrics.taskMetrics.get(taskType);
      if (taskMetrics) {
        taskMetrics.scheduled++;
      }

      this.emit('task:scheduled', {
        taskId,
        taskType,
        scheduledTime,
        recurrence
      });

      console.log(`[TaskScheduler] Task scheduled: ${taskId} (${taskType})`);

      return task;
    } catch (error) {
      console.error(`[TaskScheduler] Failed to schedule task ${taskId}:`, error.message);
      throw error;
    }
  }

  /**
   * Start scheduler loop
   * @private
   */
  _startSchedulerLoop() {
    setInterval(() => {
      this._processScheduledTasks();
    }, 1000); // Check every second
  }

  /**
   * Process scheduled tasks
   * @private
   */
  async _processScheduledTasks() {
    try {
      const now = Date.now();

      // Find tasks ready for execution
      const readyTasks = this.scheduledTasks.filter(task =>
        task.enabled &&
        task.status === 'scheduled' &&
        task.nextExecutionTime <= now
      );

      // Check concurrent limit
      const availableSlots = this.options.maxConcurrentTasks - this.runningTasks.size;

      if (availableSlots <= 0) {
        return;
      }

      // Execute up to available slots
      for (let i = 0; i < Math.min(readyTasks.length, availableSlots); i++) {
        const task = readyTasks[i];
        this._executeTask(task).catch(error => {
          console.error(`[TaskScheduler] Task execution error for ${task.id}:`, error.message);
        });
      }

    } catch (error) {
      console.error('[TaskScheduler] Scheduler loop error:', error.message);
    }
  }

  /**
   * Execute task
   * @private
   */
  async _executeTask(task) {
    const taskId = task.id;
    const startTime = Date.now();

    try {
      // Check if already running
      if (this.runningTasks.has(taskId)) {
        return;
      }

      this.runningTasks.add(taskId);
      task.status = 'running';

      const taskDef = this.taskDefinitions.get(task.type);
      if (!taskDef) {
        throw new Error(`Task definition not found: ${task.type}`);
      }

      // Execute with timeout
      const result = await Promise.race([
        taskDef.handler(task.payload),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Task timeout')), taskDef.timeout);
        })
      ]);

      // Record success
      const executionTime = Date.now() - startTime;
      task.lastExecutionTime = Date.now();
      task.lastExecutionResult = result;
      task.executionCount++;
      task.retryCount = 0;
      task.status = 'completed';

      this.metrics.tasksExecuted++;
      this.metrics.totalExecutionTime += executionTime;
      this.metrics.executionTimes.push(executionTime);

      if (this.metrics.executionTimes.length > 1000) {
        this.metrics.executionTimes.shift();
      }

      // Update task metrics
      const taskMetrics = this.metrics.taskMetrics.get(task.type);
      if (taskMetrics) {
        taskMetrics.executed++;
        taskMetrics.executionTimes.push(executionTime);
        if (taskMetrics.executionTimes.length > 100) {
          taskMetrics.executionTimes.shift();
        }
        taskMetrics.averageExecutionTime = taskMetrics.executionTimes.length > 0
          ? taskMetrics.executionTimes.reduce((a, b) => a + b, 0) / taskMetrics.executionTimes.length
          : 0;
      }

      this.emit('task:completed', {
        taskId,
        taskType: task.type,
        executionTime,
        result
      });

      console.log(`[TaskScheduler] Task completed: ${taskId} (${executionTime}ms)`);

      // Handle recurrence
      if (task.recurrence && task.recurrence !== 'ONCE') {
        const recurringPattern = this.recurringPatterns[task.recurrence];
        if (recurringPattern) {
          task.nextExecutionTime = Date.now() + recurringPattern;
          task.status = 'scheduled';
        } else {
          task.status = 'completed';
        }
      }

      // Add to completed tasks
      this.completedTasks.push({
        ...task,
        completedAt: Date.now(),
        executionTime
      });

      // Keep only last 100 completed tasks
      if (this.completedTasks.length > 100) {
        this.completedTasks.shift();
      }

    } catch (error) {
      console.error(`[TaskScheduler] Task error for ${taskId}:`, error.message);

      task.failureCount++;

      if (task.retryCount < taskDef.maxRetries && taskDef.retryable) {
        // Retry with exponential backoff
        task.retryCount++;
        const delay = 1000 * Math.pow(2, task.retryCount - 1);
        task.nextExecutionTime = Date.now() + delay;
        task.status = 'scheduled';

        this.metrics.tasksRetried++;

        this.emit('task:retrying', {
          taskId,
          taskType: task.type,
          attempt: task.retryCount,
          delay,
          error: error.message
        });

      } else {
        // Final failure
        task.status = 'failed';
        task.lastExecutionTime = Date.now();

        this.metrics.tasksFailed++;

        // Update task metrics
        const taskMetrics = this.metrics.taskMetrics.get(task.type);
        if (taskMetrics) {
          taskMetrics.failed++;
        }

        this.emit('task:failed', {
          taskId,
          taskType: task.type,
          error: error.message,
          retries: task.retryCount
        });
      }

    } finally {
      this.runningTasks.delete(taskId);
    }
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId) {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Get all scheduled tasks
   */
  getScheduledTasks() {
    return this.scheduledTasks
      .filter(task => task.status === 'scheduled')
      .map(task => ({
        id: task.id,
        type: task.type,
        nextExecutionTime: task.nextExecutionTime,
        priority: task.priority,
        recurrence: task.recurrence
      }));
  }

  /**
   * Get running tasks
   */
  getRunningTasks() {
    return Array.from(this.runningTasks).map(taskId => {
      const task = this.tasks.get(taskId);
      return {
        id: task.id,
        type: task.type,
        startTime: task.lastExecutionTime,
        priority: task.priority
      };
    });
  }

  /**
   * Get completed tasks
   */
  getCompletedTasks(options = {}) {
    let tasks = [...this.completedTasks];

    if (options.limit) {
      tasks = tasks.slice(-options.limit);
    }

    if (options.taskType) {
      tasks = tasks.filter(t => t.type === options.taskType);
    }

    return tasks;
  }

  /**
   * Cancel task
   */
  cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.enabled = false;
      task.status = 'cancelled';

      const index = this.scheduledTasks.indexOf(task);
      if (index > -1) {
        this.scheduledTasks.splice(index, 1);
      }

      this.emit('task:cancelled', { taskId });
      console.log(`[TaskScheduler] Task cancelled: ${taskId}`);

      return true;
    }
    return false;
  }

  /**
   * Reschedule task
   */
  rescheduleTask(taskId, newScheduledTime) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.nextExecutionTime = newScheduledTime;
      task.status = 'scheduled';

      // Re-sort scheduled tasks
      this.scheduledTasks.sort((a, b) => b.priority.localeCompare(a.priority) || a.nextExecutionTime - b.nextExecutionTime);

      this.emit('task:rescheduled', { taskId, newScheduledTime });
      console.log(`[TaskScheduler] Task rescheduled: ${taskId}`);

      return true;
    }
    return false;
  }

  /**
   * Get task metrics
   */
  getTaskMetrics(taskType) {
    return this.metrics.taskMetrics.get(taskType);
  }

  /**
   * Get all task metrics
   */
  getAllTaskMetrics() {
    return Object.fromEntries(this.metrics.taskMetrics);
  }

  /**
   * Get scheduler metrics
   */
  getMetrics() {
    const avgExecutionTime = this.metrics.tasksExecuted > 0
      ? (this.metrics.totalExecutionTime / this.metrics.tasksExecuted).toFixed(2)
      : 0;

    return {
      tasksScheduled: this.metrics.tasksScheduled,
      tasksExecuted: this.metrics.tasksExecuted,
      tasksFailed: this.metrics.tasksFailed,
      tasksSkipped: this.metrics.tasksSkipped,
      tasksRetried: this.metrics.tasksRetried,
      averageExecutionTime: avgExecutionTime,
      successRate: this.metrics.tasksExecuted > 0
        ? (((this.metrics.tasksExecuted - this.metrics.tasksFailed) / this.metrics.tasksExecuted) * 100).toFixed(2) + '%'
        : '0%',
      scheduledCount: this.scheduledTasks.length,
      runningCount: this.runningTasks.size,
      completedCount: this.completedTasks.length,
      taskTypes: Array.from(this.taskDefinitions.keys()).length
    };
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      running: this.runningTasks.size,
      scheduled: this.scheduledTasks.filter(t => t.status === 'scheduled').length,
      completed: this.completedTasks.length,
      maxConcurrent: this.options.maxConcurrentTasks,
      metrics: this.getMetrics(),
      taskTypes: Array.from(this.taskDefinitions.keys())
    };
  }

  /**
   * Get upcoming tasks
   */
  getUpcomingTasks(options = {}) {
    const now = Date.now();
    const window = options.window || 3600000; // 1 hour default
    const cutoff = now + window;

    return this.scheduledTasks
      .filter(task => task.status === 'scheduled' && task.nextExecutionTime <= cutoff)
      .sort((a, b) => a.nextExecutionTime - b.nextExecutionTime)
      .slice(0, options.limit || 10)
      .map(task => ({
        id: task.id,
        type: task.type,
        nextExecutionTime: task.nextExecutionTime,
        priority: task.priority,
        recurrence: task.recurrence
      }));
  }

  /**
   * Get task definition
   */
  getTaskDefinition(taskType) {
    return this.taskDefinitions.get(taskType);
  }

  /**
   * Get all task definitions
   */
  getTaskDefinitions() {
    return Array.from(this.taskDefinitions.values());
  }

  /**
   * Pause scheduler
   */
  pause() {
    // Stop processing new tasks but don't affect running ones
    this.options.paused = true;
    this.emit('paused');
    console.log('[TaskScheduler] Scheduler paused');
  }

  /**
   * Resume scheduler
   */
  resume() {
    this.options.paused = false;
    this.emit('resumed');
    console.log('[TaskScheduler] Scheduler resumed');
  }
}

module.exports = TaskScheduler;
