/**
 * Background Jobs
 * Wave 16 Phase 2: Distributed Architecture
 *
 * Jobs: report generation, data export, cleanup
 * Retry logic for failed jobs
 * Job monitoring and statistics
 */

const EventEmitter = require('events');

class BackgroundJobs extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxParallelJobs: options.maxParallelJobs || 5,
      jobTimeout: options.jobTimeout || 300000, // 5 minutes
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000,
      enablePersistence: options.enablePersistence !== false,
      ...options
    };

    // Job registry
    this.jobs = new Map();
    this.jobHandlers = new Map();
    this.jobQueue = [];
    this.runningJobs = new Set();

    // Job history
    this.completedJobs = [];
    this.failedJobs = [];

    // Metrics
    this.metrics = {
      jobsCreated: 0,
      jobsCompleted: 0,
      jobsFailed: 0,
      jobsRetried: 0,
      totalExecutionTime: 0,
      executionTimes: [],
      jobTypeMetrics: new Map()
    };

    // Define built-in jobs
    this._defineBuiltInJobs();

    // Start job processor
    this._startJobProcessor();
  }

  /**
   * Define built-in job types
   * @private
   */
  _defineBuiltInJobs() {
    // Report generation job
    this.registerJobHandler('report_generation', async (payload) => {
      const { reportType, taskId, format } = payload;

      // Simulate report generation
      const reportData = {
        reportType,
        taskId,
        format: format || 'pdf',
        generatedAt: Date.now(),
        pages: Math.floor(Math.random() * 50) + 10,
        size: Math.floor(Math.random() * 5000000) + 1000000, // 1-5 MB
        status: 'ready'
      };

      return reportData;
    }, { timeout: 60000, category: 'reporting' });

    // Data export job
    this.registerJobHandler('data_export', async (payload) => {
      const { format, dataType, sessionId } = payload;

      // Simulate data export
      const exportData = {
        format: format || 'csv',
        dataType,
        sessionId,
        recordCount: Math.floor(Math.random() * 10000) + 100,
        fileSize: Math.floor(Math.random() * 50000000) + 1000000, // 1-50 MB
        exportedAt: Date.now(),
        status: 'ready',
        downloadUrl: `https://api.example.com/exports/${Date.now()}`
      };

      return exportData;
    }, { timeout: 120000, category: 'export' });

    // Session cleanup job
    this.registerJobHandler('cleanup_expired_sessions', async (payload) => {
      const { olderThanMs } = payload;

      // Simulate cleanup
      const cleanupResult = {
        sessionsDeleted: Math.floor(Math.random() * 100) + 10,
        recordsRemoved: Math.floor(Math.random() * 1000) + 100,
        spaceFreed: Math.floor(Math.random() * 100000000) + 10000000, // 10-100 MB
        cleanedAt: Date.now(),
        status: 'completed'
      };

      return cleanupResult;
    }, { timeout: 120000, category: 'maintenance' });

    // Database backup job
    this.registerJobHandler('database_backup', async (payload) => {
      const { databases } = payload;

      // Simulate backup
      const backupData = {
        databases: databases || ['monitoring', 'sessions'],
        backupSize: Math.floor(Math.random() * 1000000000) + 100000000, // 100 MB - 1 GB
        backupTime: Date.now(),
        backupId: `backup_${Date.now()}`,
        status: 'completed',
        restorePoint: Date.now()
      };

      return backupData;
    }, { timeout: 300000, category: 'maintenance' });

    // Index optimization job
    this.registerJobHandler('optimize_indices', async (payload) => {
      const { tables } = payload;

      // Simulate index optimization
      const optimizationResult = {
        tables: tables || ['tasks', 'monitoring', 'sessions'],
        indicesOptimized: (tables || []).length,
        timeSpentMs: Math.floor(Math.random() * 30000) + 5000,
        spaceRecovered: Math.floor(Math.random() * 50000000) + 5000000, // 5-50 MB
        optimizedAt: Date.now(),
        status: 'completed'
      };

      return optimizationResult;
    }, { timeout: 180000, category: 'maintenance' });

    console.log('[BackgroundJobs] Built-in job types registered');
  }

  /**
   * Register job handler
   */
  registerJobHandler(jobType, handlerFunc, options = {}) {
    try {
      const handler = {
        type: jobType,
        handler: handlerFunc,
        timeout: options.timeout || this.options.jobTimeout,
        maxRetries: options.maxRetries || this.options.maxRetries,
        category: options.category || 'general',
        enabled: options.enabled !== false,
        createdAt: Date.now()
      };

      this.jobHandlers.set(jobType, handler);

      // Initialize metrics for this job type
      this.metrics.jobTypeMetrics.set(jobType, {
        jobType,
        created: 0,
        completed: 0,
        failed: 0,
        retried: 0,
        averageExecutionTime: 0,
        executionTimes: []
      });

      this.emit('job:handler_registered', { jobType, handler });
      console.log(`[BackgroundJobs] Job handler registered: ${jobType}`);

      return handler;
    } catch (error) {
      console.error(`[BackgroundJobs] Failed to register handler for ${jobType}:`, error.message);
      throw error;
    }
  }

  /**
   * Create and enqueue job
   */
  createJob(jobType, payload, options = {}) {
    try {
      const handler = this.jobHandlers.get(jobType);
      if (!handler) {
        throw new Error(`Job type not registered: ${jobType}`);
      }

      const jobId = options.jobId || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const job = {
        id: jobId,
        type: jobType,
        payload,
        status: 'queued',
        priority: options.priority || 'normal',
        retryCount: 0,
        maxRetries: options.maxRetries || handler.maxRetries,
        createdAt: Date.now(),
        startedAt: null,
        completedAt: null,
        result: null,
        error: null,
        tags: options.tags || []
      };

      this.jobs.set(jobId, job);
      this.jobQueue.push(job);

      // Sort by priority
      this.jobQueue.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      this.metrics.jobsCreated++;

      // Update job type metrics
      const jobTypeMetrics = this.metrics.jobTypeMetrics.get(jobType);
      if (jobTypeMetrics) {
        jobTypeMetrics.created++;
      }

      this.emit('job:created', {
        jobId,
        jobType,
        priority: job.priority
      });

      console.log(`[BackgroundJobs] Job created: ${jobId} (${jobType})`);

      return job;
    } catch (error) {
      console.error(`[BackgroundJobs] Failed to create job:`, error.message);
      throw error;
    }
  }

  /**
   * Start job processor
   * @private
   */
  _startJobProcessor() {
    setInterval(() => {
      this._processNextJob();
    }, 100);
  }

  /**
   * Process next job in queue
   * @private
   */
  async _processNextJob() {
    try {
      // Check if we can run more jobs
      if (this.runningJobs.size >= this.options.maxParallelJobs) {
        return;
      }

      // Get next job from queue
      const job = this.jobQueue.shift();
      if (!job) {
        return;
      }

      this.runningJobs.add(job.id);

      // Execute job
      await this._executeJob(job);

    } catch (error) {
      console.error('[BackgroundJobs] Job processor error:', error.message);
    }
  }

  /**
   * Execute job
   * @private
   */
  async _executeJob(job) {
    const startTime = Date.now();
    job.status = 'running';
    job.startedAt = startTime;

    try {
      const handler = this.jobHandlers.get(job.type);
      if (!handler) {
        throw new Error(`Handler not found for job type: ${job.type}`);
      }

      // Execute with timeout
      const result = await Promise.race([
        handler.handler(job.payload),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Job timeout')), handler.timeout);
        })
      ]);

      // Record success
      const executionTime = Date.now() - startTime;
      job.status = 'completed';
      job.completedAt = Date.now();
      job.result = result;
      job.retryCount = 0;

      this.metrics.jobsCompleted++;
      this.metrics.totalExecutionTime += executionTime;
      this.metrics.executionTimes.push(executionTime);

      if (this.metrics.executionTimes.length > 1000) {
        this.metrics.executionTimes.shift();
      }

      // Update job type metrics
      const jobTypeMetrics = this.metrics.jobTypeMetrics.get(job.type);
      if (jobTypeMetrics) {
        jobTypeMetrics.completed++;
        jobTypeMetrics.executionTimes.push(executionTime);
        if (jobTypeMetrics.executionTimes.length > 100) {
          jobTypeMetrics.executionTimes.shift();
        }
        jobTypeMetrics.averageExecutionTime = jobTypeMetrics.executionTimes.length > 0
          ? jobTypeMetrics.executionTimes.reduce((a, b) => a + b, 0) / jobTypeMetrics.executionTimes.length
          : 0;
      }

      // Add to completed jobs
      this.completedJobs.push({
        ...job,
        executionTime
      });

      // Keep only last 100 completed jobs
      if (this.completedJobs.length > 100) {
        this.completedJobs.shift();
      }

      this.emit('job:completed', {
        jobId: job.id,
        jobType: job.type,
        executionTime,
        result
      });

      console.log(`[BackgroundJobs] Job completed: ${job.id} (${executionTime}ms)`);

    } catch (error) {
      console.error(`[BackgroundJobs] Job error for ${job.id}:`, error.message);

      job.error = error.message;
      job.retryCount++;

      if (job.retryCount < job.maxRetries) {
        // Retry with delay
        job.status = 'retrying';
        const delay = this.options.retryDelay * Math.pow(2, job.retryCount - 1);

        this.metrics.jobsRetried++;

        // Update job type metrics
        const jobTypeMetrics = this.metrics.jobTypeMetrics.get(job.type);
        if (jobTypeMetrics) {
          jobTypeMetrics.retried++;
        }

        this.emit('job:retrying', {
          jobId: job.id,
          jobType: job.type,
          attempt: job.retryCount,
          delay,
          error: error.message
        });

        // Re-queue job after delay
        setTimeout(() => {
          if (job.status === 'retrying') {
            job.status = 'queued';
            this.jobQueue.push(job);

            // Re-sort by priority
            this.jobQueue.sort((a, b) => {
              const priorityOrder = { high: 0, normal: 1, low: 2 };
              return priorityOrder[a.priority] - priorityOrder[b.priority];
            });
          }
        }, delay);

      } else {
        // Final failure
        job.status = 'failed';
        job.completedAt = Date.now();

        this.metrics.jobsFailed++;

        // Update job type metrics
        const jobTypeMetrics = this.metrics.jobTypeMetrics.get(job.type);
        if (jobTypeMetrics) {
          jobTypeMetrics.failed++;
        }

        // Add to failed jobs
        this.failedJobs.push(job);

        // Keep only last 50 failed jobs
        if (this.failedJobs.length > 50) {
          this.failedJobs.shift();
        }

        this.emit('job:failed', {
          jobId: job.id,
          jobType: job.type,
          error: error.message,
          retries: job.retryCount
        });
      }

    } finally {
      this.runningJobs.delete(job.id);
    }
  }

  /**
   * Get job status
   */
  getJobStatus(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get running jobs
   */
  getRunningJobs() {
    return Array.from(this.runningJobs).map(jobId => {
      const job = this.jobs.get(jobId);
      return {
        id: job.id,
        type: job.type,
        startedAt: job.startedAt,
        priority: job.priority,
        elapsedMs: Date.now() - job.startedAt
      };
    });
  }

  /**
   * Get queued jobs
   */
  getQueuedJobs(options = {}) {
    let jobs = this.jobQueue.filter(j => j.status === 'queued');

    if (options.jobType) {
      jobs = jobs.filter(j => j.type === options.jobType);
    }

    if (options.limit) {
      jobs = jobs.slice(0, options.limit);
    }

    return jobs.map(j => ({
      id: j.id,
      type: j.type,
      priority: j.priority,
      createdAt: j.createdAt
    }));
  }

  /**
   * Get completed jobs
   */
  getCompletedJobs(options = {}) {
    let jobs = [...this.completedJobs];

    if (options.jobType) {
      jobs = jobs.filter(j => j.type === options.jobType);
    }

    if (options.limit) {
      jobs = jobs.slice(-options.limit);
    }

    return jobs;
  }

  /**
   * Get failed jobs
   */
  getFailedJobs(options = {}) {
    let jobs = [...this.failedJobs];

    if (options.jobType) {
      jobs = jobs.filter(j => j.type === options.jobType);
    }

    if (options.limit) {
      jobs = jobs.slice(-options.limit);
    }

    return jobs;
  }

  /**
   * Cancel job
   */
  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job && (job.status === 'queued' || job.status === 'retrying')) {
      job.status = 'cancelled';

      const index = this.jobQueue.indexOf(job);
      if (index > -1) {
        this.jobQueue.splice(index, 1);
      }

      this.emit('job:cancelled', { jobId });
      console.log(`[BackgroundJobs] Job cancelled: ${jobId}`);

      return true;
    }
    return false;
  }

  /**
   * Retry failed job
   */
  retryJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'failed') {
      job.status = 'queued';
      job.retryCount = 0;
      job.error = null;

      this.jobQueue.push(job);

      // Re-sort by priority
      this.jobQueue.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      this.emit('job:retried', { jobId });
      console.log(`[BackgroundJobs] Job retried: ${jobId}`);

      return true;
    }
    return false;
  }

  /**
   * Get job type metrics
   */
  getJobTypeMetrics(jobType) {
    return this.metrics.jobTypeMetrics.get(jobType);
  }

  /**
   * Get all job metrics
   */
  getAllJobMetrics() {
    return Object.fromEntries(this.metrics.jobTypeMetrics);
  }

  /**
   * Get background jobs metrics
   */
  getMetrics() {
    const avgExecutionTime = this.metrics.jobsCompleted > 0
      ? (this.metrics.totalExecutionTime / this.metrics.jobsCompleted).toFixed(2)
      : 0;

    return {
      jobsCreated: this.metrics.jobsCreated,
      jobsCompleted: this.metrics.jobsCompleted,
      jobsFailed: this.metrics.jobsFailed,
      jobsRetried: this.metrics.jobsRetried,
      averageExecutionTime: avgExecutionTime,
      successRate: this.metrics.jobsCompleted > 0
        ? (((this.metrics.jobsCompleted - this.metrics.jobsFailed) / this.metrics.jobsCompleted) * 100).toFixed(2) + '%'
        : '0%',
      runningCount: this.runningJobs.size,
      queuedCount: this.jobQueue.filter(j => j.status === 'queued').length,
      completedCount: this.completedJobs.length,
      failedCount: this.failedJobs.length,
      handlerCount: this.jobHandlers.size
    };
  }

  /**
   * Get job queue status
   */
  getQueueStatus() {
    return {
      total: this.jobQueue.length,
      running: this.runningJobs.size,
      queued: this.jobQueue.filter(j => j.status === 'queued').length,
      maxParallel: this.options.maxParallelJobs,
      completed: this.completedJobs.length,
      failed: this.failedJobs.length
    };
  }

  /**
   * Get job handlers
   */
  getJobHandlers() {
    return Array.from(this.jobHandlers.values()).map(h => ({
      type: h.type,
      category: h.category,
      timeout: h.timeout,
      maxRetries: h.maxRetries,
      enabled: h.enabled
    }));
  }
}

module.exports = BackgroundJobs;
