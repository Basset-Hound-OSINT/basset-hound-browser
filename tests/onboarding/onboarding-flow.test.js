/**
 * Onboarding Flow Tests
 *
 * Comprehensive testing of the onboarding coordinator functionality
 */

const OnboardingCoordinator = require('../../src/onboarding/coordinator');
const assert = require('assert');

describe('OnboardingCoordinator', () => {
  let coordinator;

  beforeEach(() => {
    coordinator = new OnboardingCoordinator({ userId: 'test-user-1' });
  });

  describe('Initialization', () => {
    it('should initialize coordinator', async () => {
      await coordinator.initialize();
      assert.strictEqual(coordinator.initialized, true);
    });

    it('should emit initialized event', async () => {
      let emitted = false;
      coordinator.on('initialized', () => {
        emitted = true;
      });

      await coordinator.initialize();
      assert.strictEqual(emitted, true);
    });
  });

  describe('Step Registration', () => {
    it('should register a step', () => {
      coordinator.registerStep('step-1', {
        name: 'First Step',
        handler: () => {}
      });

      const step = coordinator.getStep('step-1');
      assert.strictEqual(step.name, 'First Step');
    });

    it('should throw error if name missing', () => {
      assert.throws(() => {
        coordinator.registerStep('step-1', { handler: () => {} });
      });
    });

    it('should throw error if handler missing', () => {
      assert.throws(() => {
        coordinator.registerStep('step-1', { name: 'Test' });
      });
    });

    it('should register multiple steps', () => {
      coordinator.registerStep('step-1', {
        name: 'Step 1',
        handler: () => {}
      });
      coordinator.registerStep('step-2', {
        name: 'Step 2',
        prerequisites: ['step-1'],
        handler: () => {}
      });

      assert.strictEqual(coordinator.getAllSteps().length, 2);
    });
  });

  describe('Prerequisites Validation', () => {
    it('should validate met prerequisites', () => {
      coordinator.registerStep('step-1', {
        name: 'Step 1',
        handler: () => {}
      });
      coordinator.registerStep('step-2', {
        name: 'Step 2',
        prerequisites: ['step-1'],
        handler: () => {}
      });

      coordinator.completedSteps.add('step-1');
      const result = coordinator.validatePrerequisites('step-2');
      assert.strictEqual(result.valid, true);
    });

    it('should detect unmet prerequisites', () => {
      coordinator.registerStep('step-1', {
        name: 'Step 1',
        handler: () => {}
      });
      coordinator.registerStep('step-2', {
        name: 'Step 2',
        prerequisites: ['step-1'],
        handler: () => {}
      });

      const result = coordinator.validatePrerequisites('step-2');
      assert.strictEqual(result.valid, false);
      assert.deepStrictEqual(result.unsatisfied, ['step-1']);
    });

    it('should allow navigation if prerequisites satisfied', async () => {
      coordinator.registerStep('step-1', {
        name: 'Step 1',
        handler: () => {}
      });
      coordinator.registerStep('step-2', {
        name: 'Step 2',
        prerequisites: ['step-1'],
        handler: () => {}
      });

      coordinator.completedSteps.add('step-1');
      const result = await coordinator.goToStep('step-2');
      assert.strictEqual(result.success, true);
    });
  });

  describe('Step Navigation', () => {
    beforeEach(() => {
      coordinator.registerStep('step-1', {
        name: 'Step 1',
        handler: () => {}
      });
      coordinator.registerStep('step-2', {
        name: 'Step 2',
        handler: () => {}
      });
      coordinator.registerStep('step-3', {
        name: 'Step 3',
        handler: () => {}
      });
    });

    it('should navigate to first step', async () => {
      const result = await coordinator.goToStep('step-1');
      assert.strictEqual(result.success, true);
      assert.strictEqual(coordinator.currentStep, 'step-1');
    });

    it('should move to next step', async () => {
      await coordinator.goToStep('step-1');
      await coordinator.completeStep('step-1', {});
      const result = await coordinator.nextStep();
      assert.strictEqual(result.success, true);
      assert.strictEqual(coordinator.currentStep, 'step-2');
    });

    it('should emit step-changed event', async () => {
      let changed = false;
      coordinator.on('step-changed', () => {
        changed = true;
      });

      await coordinator.goToStep('step-1');
      assert.strictEqual(changed, true);
    });
  });

  describe('Step Completion', () => {
    beforeEach(() => {
      coordinator.registerStep('step-1', {
        name: 'Step 1',
        handler: () => {}
      });
    });

    it('should mark step as completed', async () => {
      await coordinator.completeStep('step-1', { data: 'test' });
      assert(coordinator.completedSteps.has('step-1'));
    });

    it('should prevent completing same step twice', async () => {
      await coordinator.completeStep('step-1', {});
      const result = await coordinator.goToStep('step-1');
      assert.strictEqual(result.success, false);
    });

    it('should emit step-completed event', async () => {
      let completed = false;
      coordinator.on('step-completed', () => {
        completed = true;
      });

      await coordinator.completeStep('step-1', {});
      assert.strictEqual(completed, true);
    });

    it('should track step duration', async () => {
      await coordinator.goToStep('step-1');
      await new Promise(resolve => setTimeout(resolve, 100));
      await coordinator.completeStep('step-1', {});

      const progress = coordinator.stepProgress.get('step-1');
      assert(progress.duration >= 100);
    });

    it('should run validation before completing', async () => {
      coordinator.registerStep('validated-step', {
        name: 'Validated Step',
        handler: () => {},
        validation: async results => {
          return results.valid ? { valid: true } : { valid: false, errors: ['Invalid data'] };
        }
      });

      const result = await coordinator.completeStep('validated-step', { valid: false });
      assert.strictEqual(result.success, false);
    });
  });

  describe('Step Skipping', () => {
    it('should skip skippable step', async () => {
      coordinator.registerStep('skip-step', {
        name: 'Skippable Step',
        skippable: true,
        handler: () => {}
      });

      const result = await coordinator.skipStep('skip-step', 'Not needed');
      assert.strictEqual(result.success, true);
      assert(coordinator.skipMarkers.has('skip-step'));
    });

    it('should prevent skipping non-skippable step', async () => {
      coordinator.registerStep('required-step', {
        name: 'Required Step',
        skippable: false,
        handler: () => {}
      });

      const result = await coordinator.skipStep('required-step');
      assert.strictEqual(result.success, false);
    });

    it('should emit step-skipped event', async () => {
      coordinator.registerStep('skip-step', {
        name: 'Skippable Step',
        skippable: true,
        handler: () => {}
      });

      let skipped = false;
      coordinator.on('step-skipped', () => {
        skipped = true;
      });

      await coordinator.skipStep('skip-step', 'Reason');
      assert.strictEqual(skipped, true);
    });
  });

  describe('Completion Status', () => {
    beforeEach(() => {
      coordinator.registerStep('step-1', {
        name: 'Step 1',
        handler: () => {}
      });
      coordinator.registerStep('step-2', {
        name: 'Step 2',
        handler: () => {}
      });
      coordinator.registerStep('step-3', {
        name: 'Step 3',
        skippable: true,
        handler: () => {}
      });
    });

    it('should calculate completion percentage', async () => {
      await coordinator.completeStep('step-1', {});
      const status = coordinator.getCompletionStatus();
      assert.strictEqual(status.percentage, 33);
    });

    it('should track completed steps', async () => {
      await coordinator.completeStep('step-1', {});
      await coordinator.completeStep('step-2', {});
      const status = coordinator.getCompletionStatus();
      assert.strictEqual(status.completed, 2);
    });

    it('should identify remaining steps', async () => {
      await coordinator.completeStep('step-1', {});
      const status = coordinator.getCompletionStatus();
      assert(status.remainingSteps.includes('step-2'));
      assert(!status.remainingSteps.includes('step-1'));
    });
  });

  describe('Certificate Generation', () => {
    beforeEach(() => {
      coordinator.registerStep('step-1', {
        name: 'Step 1',
        skippable: false,
        handler: () => {}
      });
    });

    it('should prevent certificate if not complete', async () => {
      const result = await coordinator.generateCertificate();
      assert.strictEqual(result.success, false);
    });

    it('should generate certificate when complete', async () => {
      await coordinator.completeStep('step-1', {});
      const result = await coordinator.generateCertificate();
      assert.strictEqual(result.success, true);
      assert(result.certificate.certificateId);
    });

    it('should set correct certification level', async () => {
      await coordinator.completeStep('step-1', {});
      const result = await coordinator.generateCertificate();
      assert(
        ['basic', 'intermediate', 'advanced', 'expert'].includes(
          result.certificate.certificationLevel
        )
      );
    });

    it('should generate verification token', async () => {
      await coordinator.completeStep('step-1', {});
      const result = await coordinator.generateCertificate();
      assert(result.certificate.verificationToken);
    });
  });

  describe('Certificate Verification', () => {
    it('should verify valid certificate', async () => {
      coordinator.registerStep('step-1', {
        name: 'Step 1',
        handler: () => {}
      });

      await coordinator.completeStep('step-1', {});
      const certResult = await coordinator.generateCertificate();
      const certId = certResult.certificate.certificateId;

      const verification = coordinator.verifyCertificate(certId);
      assert.strictEqual(verification.valid, true);
    });

    it('should reject invalid certificate', () => {
      const verification = coordinator.verifyCertificate('INVALID');
      assert.strictEqual(verification.valid, false);
    });
  });

  describe('Preferences', () => {
    it('should set preference', () => {
      coordinator.setPreference('theme', 'dark');
      assert.strictEqual(coordinator.getPreference('theme'), 'dark');
    });

    it('should get default value if preference not set', () => {
      const value = coordinator.getPreference('missing', 'default');
      assert.strictEqual(value, 'default');
    });

    it('should get all preferences', () => {
      coordinator.setPreference('theme', 'dark');
      coordinator.setPreference('language', 'en');
      const prefs = coordinator.getPreferences();
      assert.strictEqual(prefs.theme, 'dark');
      assert.strictEqual(prefs.language, 'en');
    });

    it('should emit preference-changed event', () => {
      let changed = false;
      coordinator.on('preference-changed', () => {
        changed = true;
      });

      coordinator.setPreference('theme', 'dark');
      assert.strictEqual(changed, true);
    });
  });

  describe('Progress Export', () => {
    it('should export progress', () => {
      coordinator.registerStep('step-1', {
        name: 'Step 1',
        handler: () => {}
      });

      const exported = coordinator.exportProgress();
      assert(exported.userId);
      assert(exported.completionStatus);
      assert(exported.preferences);
    });
  });

  describe('Progress Reset', () => {
    it('should reset progress', async () => {
      coordinator.registerStep('step-1', {
        name: 'Step 1',
        handler: () => {}
      });

      await coordinator.completeStep('step-1', {});
      await coordinator.resetProgress();

      assert.strictEqual(coordinator.completedSteps.size, 0);
      assert.strictEqual(coordinator.currentStep, null);
    });
  });
});
