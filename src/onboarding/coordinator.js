/**
 * Onboarding Coordinator
 *
 * Orchestrates multi-step onboarding flow, managing step progress,
 * state persistence, prerequisite validation, and completion certification.
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class OnboardingCoordinator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.userId = options.userId || null;
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'onboarding');
    this.userPreferences = {};
    this.stepRegistry = new Map();
    this.completedSteps = new Set();
    this.currentStep = null;
    this.stepProgress = new Map();
    this.skipMarkers = new Set();
    this.certificateData = null;
    this.sessionStartTime = Date.now();
    this.initialized = false;
  }

  /**
   * Initialize coordinator and load user data
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await this.ensureDataDirectory();
      await this.loadUserData();
      this.initialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', { phase: 'initialization', error });
      throw error;
    }
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Load user data from storage
   */
  async loadUserData() {
    if (!this.userId) {
      return;
    }

    const userDataFile = path.join(this.dataDir, `${this.userId}.json`);
    try {
      const data = await fs.readFile(userDataFile, 'utf-8');
      const parsed = JSON.parse(data);
      this.completedSteps = new Set(parsed.completedSteps || []);
      this.userPreferences = parsed.preferences || {};
      this.certificateData = parsed.certificateData || null;
      this.skipMarkers = new Set(parsed.skipMarkers || []);
      this.emit('user-data-loaded', { completedSteps: Array.from(this.completedSteps) });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.emit('warning', { message: 'Failed to load user data', error });
      }
    }
  }

  /**
   * Register an onboarding step
   */
  registerStep(stepId, stepConfig) {
    if (!stepConfig.name) {
      throw new Error(`Step ${stepId} missing required name`);
    }
    if (!stepConfig.handler) {
      throw new Error(`Step ${stepId} missing required handler`);
    }

    this.stepRegistry.set(stepId, {
      id: stepId,
      name: stepConfig.name,
      description: stepConfig.description || '',
      handler: stepConfig.handler,
      prerequisites: stepConfig.prerequisites || [],
      skippable: stepConfig.skippable !== false,
      estimatedTime: stepConfig.estimatedTime || 5,
      category: stepConfig.category || 'general',
      resources: stepConfig.resources || [],
      validation: stepConfig.validation || null,
      metadata: stepConfig.metadata || {}
    });

    this.emit('step-registered', { stepId });
    return this;
  }

  /**
   * Get registered step
   */
  getStep(stepId) {
    return this.stepRegistry.get(stepId);
  }

  /**
   * Get all registered steps
   */
  getAllSteps() {
    return Array.from(this.stepRegistry.values());
  }

  /**
   * Get step registry as ordered array
   */
  getStepSequence() {
    return Array.from(this.stepRegistry.keys());
  }

  /**
   * Check if step prerequisites are satisfied
   */
  validatePrerequisites(stepId) {
    const step = this.getStep(stepId);
    if (!step) {
      return { valid: false, reason: 'Step not found' };
    }

    if (!step.prerequisites || step.prerequisites.length === 0) {
      return { valid: true };
    }

    const unsatisfied = step.prerequisites.filter(
      prereq => !this.completedSteps.has(prereq)
    );

    if (unsatisfied.length > 0) {
      return {
        valid: false,
        reason: 'Prerequisites not satisfied',
        unsatisfied
      };
    }

    return { valid: true };
  }

  /**
   * Advance to next step
   */
  async nextStep() {
    const sequence = this.getStepSequence();
    const currentIndex = this.currentStep ? sequence.indexOf(this.currentStep) : -1;
    const nextIndex = currentIndex + 1;

    if (nextIndex >= sequence.length) {
      return { success: false, reason: 'No more steps available' };
    }

    const nextStepId = sequence[nextIndex];
    return this.goToStep(nextStepId);
  }

  /**
   * Navigate to specific step
   */
  async goToStep(stepId) {
    const step = this.getStep(stepId);
    if (!step) {
      return { success: false, reason: `Step ${stepId} not found` };
    }

    // Check if already completed
    if (this.completedSteps.has(stepId)) {
      return {
        success: false,
        reason: 'Step already completed',
        stepId
      };
    }

    // Validate prerequisites
    const prereqCheck = this.validatePrerequisites(stepId);
    if (!prereqCheck.valid && !this.userPreferences.ignorePrerequisites) {
      return {
        success: false,
        reason: prereqCheck.reason,
        unsatisfied: prereqCheck.unsatisfied
      };
    }

    this.currentStep = stepId;
    this.stepProgress.set(stepId, {
      startTime: Date.now(),
      status: 'in-progress'
    });

    this.emit('step-changed', { fromStep: this.currentStep, toStep: stepId });
    return { success: true, step };
  }

  /**
   * Complete current step with validation
   */
  async completeStep(stepId, results = {}) {
    const step = this.getStep(stepId);
    if (!step) {
      return { success: false, reason: `Step ${stepId} not found` };
    }

    // Run validation if provided
    if (step.validation && typeof step.validation === 'function') {
      try {
        const validationResult = await step.validation(results);
        if (!validationResult.valid) {
          return {
            success: false,
            reason: 'Step validation failed',
            validationErrors: validationResult.errors || []
          };
        }
      } catch (error) {
        return {
          success: false,
          reason: 'Validation error',
          error: error.message
        };
      }
    }

    this.completedSteps.add(stepId);
    const progress = this.stepProgress.get(stepId) || {};
    progress.endTime = Date.now();
    progress.status = 'completed';
    progress.results = results;
    progress.duration = progress.endTime - progress.startTime;
    this.stepProgress.set(stepId, progress);

    this.emit('step-completed', {
      stepId,
      duration: progress.duration,
      results
    });

    await this.persistUserData();
    return { success: true, stepId };
  }

  /**
   * Skip step if allowed
   */
  async skipStep(stepId, reason = '') {
    const step = this.getStep(stepId);
    if (!step) {
      return { success: false, reason: `Step ${stepId} not found` };
    }

    if (!step.skippable) {
      return {
        success: false,
        reason: 'Step cannot be skipped'
      };
    }

    this.skipMarkers.add(stepId);
    const progress = this.stepProgress.get(stepId) || {};
    progress.status = 'skipped';
    progress.skipReason = reason;
    progress.skippedAt = Date.now();
    this.stepProgress.set(stepId, progress);

    this.emit('step-skipped', { stepId, reason });
    await this.persistUserData();

    return { success: true, stepId };
  }

  /**
   * Get completion status
   */
  getCompletionStatus() {
    const sequence = this.getStepSequence();
    const total = sequence.length;
    const completed = this.completedSteps.size;
    const skipped = this.skipMarkers.size;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      completed,
      skipped,
      total,
      percentage,
      completedSteps: Array.from(this.completedSteps),
      skippedSteps: Array.from(this.skipMarkers),
      remainingSteps: sequence.filter(s => !this.completedSteps.has(s) && !this.skipMarkers.has(s))
    };
  }

  /**
   * Check if onboarding is complete
   */
  isOnboardingComplete() {
    const sequence = this.getStepSequence();
    if (sequence.length === 0) {
      return false;
    }

    const requiredSteps = sequence.filter(id => {
      const step = this.getStep(id);
      return !step.skippable;
    });

    return requiredSteps.every(stepId => this.completedSteps.has(stepId));
  }

  /**
   * Generate onboarding certificate
   */
  async generateCertificate() {
    if (!this.isOnboardingComplete()) {
      return {
        success: false,
        reason: 'Onboarding not yet complete'
      };
    }

    const certificateId = `CERT-${this.userId}-${Date.now()}`;
    const totalDuration = Date.now() - this.sessionStartTime;
    const durationMinutes = Math.round(totalDuration / 60000);

    this.certificateData = {
      certificateId,
      userId: this.userId,
      issuedAt: new Date().toISOString(),
      completionDate: new Date(),
      totalDuration,
      durationMinutes,
      completedSteps: Array.from(this.completedSteps),
      stepDetails: this.buildStepDetails(),
      certificationLevel: this.determineCertificationLevel(),
      verificationToken: this.generateVerificationToken()
    };

    this.emit('certificate-generated', this.certificateData);
    await this.persistUserData();

    return {
      success: true,
      certificate: this.certificateData
    };
  }

  /**
   * Build step completion details for certificate
   */
  buildStepDetails() {
    const details = {};
    for (const [stepId, progress] of this.stepProgress.entries()) {
      const step = this.getStep(stepId);
      details[stepId] = {
        name: step.name,
        completedAt: new Date(progress.endTime).toISOString(),
        duration: progress.duration,
        status: progress.status
      };
    }
    return details;
  }

  /**
   * Determine certification level based on completion metrics
   */
  determineCertificationLevel() {
    const status = this.getCompletionStatus();
    const avgStepTime = this.calculateAverageStepTime();
    const completionRate = status.percentage;

    if (completionRate === 100 && avgStepTime < 300000) {
      return 'expert';
    } else if (completionRate === 100 && avgStepTime < 600000) {
      return 'advanced';
    } else if (completionRate >= 75) {
      return 'intermediate';
    }
    return 'basic';
  }

  /**
   * Calculate average time per step
   */
  calculateAverageStepTime() {
    if (this.stepProgress.size === 0) {
      return 0;
    }

    let totalTime = 0;
    let count = 0;

    for (const progress of this.stepProgress.values()) {
      if (progress.duration) {
        totalTime += progress.duration;
        count++;
      }
    }

    return count > 0 ? totalTime / count : 0;
  }

  /**
   * Generate verification token for certificate
   */
  generateVerificationToken() {
    const data = `${this.userId}-${Date.now()}-onboarding`;
    return Buffer.from(data).toString('base64');
  }

  /**
   * Verify certificate authenticity
   */
  verifyCertificate(certificateId) {
    if (!this.certificateData) {
      return { valid: false, reason: 'No certificate issued' };
    }

    if (this.certificateData.certificateId !== certificateId) {
      return { valid: false, reason: 'Certificate ID mismatch' };
    }

    const isExpired = Date.now() - new Date(this.certificateData.issuedAt).getTime() > 31536000000; // 1 year
    if (isExpired) {
      return { valid: false, reason: 'Certificate expired' };
    }

    return {
      valid: true,
      certificate: this.certificateData,
      expiresAt: new Date(new Date(this.certificateData.issuedAt).getTime() + 31536000000)
    };
  }

  /**
   * Update user preference
   */
  setPreference(key, value) {
    this.userPreferences[key] = value;
    this.emit('preference-changed', { key, value });
    return this;
  }

  /**
   * Get user preference
   */
  getPreference(key, defaultValue = null) {
    return this.userPreferences[key] ?? defaultValue;
  }

  /**
   * Get all preferences
   */
  getPreferences() {
    return { ...this.userPreferences };
  }

  /**
   * Persist user data to storage
   */
  async persistUserData() {
    if (!this.userId) {
      return;
    }

    const userDataFile = path.join(this.dataDir, `${this.userId}.json`);
    const data = {
      userId: this.userId,
      completedSteps: Array.from(this.completedSteps),
      skipMarkers: Array.from(this.skipMarkers),
      preferences: this.userPreferences,
      certificateData: this.certificateData,
      lastUpdated: new Date().toISOString()
    };

    try {
      await fs.writeFile(userDataFile, JSON.stringify(data, null, 2));
      this.emit('data-persisted');
    } catch (error) {
      this.emit('error', { phase: 'persistence', error });
      throw error;
    }
  }

  /**
   * Get progress summary
   */
  getProgressSummary() {
    const status = this.getCompletionStatus();
    const estimatedRemaining = status.remainingSteps.reduce((sum, stepId) => {
      const step = this.getStep(stepId);
      return sum + (step?.estimatedTime || 5);
    }, 0);

    return {
      status,
      currentStep: this.currentStep,
      estimatedRemainingTime: estimatedRemaining,
      averageStepTime: this.calculateAverageStepTime(),
      certificateEligible: this.isOnboardingComplete(),
      certificate: this.certificateData
    };
  }

  /**
   * Reset onboarding progress
   */
  async resetProgress() {
    this.completedSteps.clear();
    this.skipMarkers.clear();
    this.stepProgress.clear();
    this.currentStep = null;
    this.certificateData = null;
    this.sessionStartTime = Date.now();

    this.emit('progress-reset');
    await this.persistUserData();
    return { success: true };
  }

  /**
   * Export progress data
   */
  exportProgress() {
    return {
      userId: this.userId,
      completionStatus: this.getCompletionStatus(),
      progressSummary: this.getProgressSummary(),
      preferences: this.getPreferences(),
      stepDetails: Object.fromEntries(this.stepProgress),
      certificate: this.certificateData,
      exportedAt: new Date().toISOString()
    };
  }
}

module.exports = OnboardingCoordinator;
