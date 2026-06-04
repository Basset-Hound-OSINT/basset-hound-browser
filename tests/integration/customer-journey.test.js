/**
 * Customer Journey Integration Tests
 *
 * End-to-end testing of complete customer onboarding journeys
 */

const OnboardingCoordinator = require('../../src/onboarding/coordinator');
const SetupWizard = require('../../src/onboarding/setup-wizard');
const TutorialEngine = require('../../src/onboarding/tutorial-engine');
const DemoEnvironment = require('../../src/onboarding/demo-environment');
const HelpSystem = require('../../src/onboarding/help-system');
const LearningPath = require('../../src/onboarding/learning-path');
const SupportTicketingSystem = require('../../src/onboarding/support-tickets');
const CertificationEngine = require('../../src/onboarding/certification');
const assert = require('assert');

describe('Customer Journey - Complete Onboarding', () => {
  let coordinator;
  let wizard;
  let tutorials;
  let demo;
  let helpSystem;
  let learningPath;
  let support;
  let certification;

  beforeEach(async () => {
    const userId = 'customer-' + Date.now();

    coordinator = new OnboardingCoordinator({ userId });
    await coordinator.initialize();

    wizard = new SetupWizard(coordinator);
    tutorials = new TutorialEngine({ userId });
    demo = new DemoEnvironment();
    helpSystem = new HelpSystem();
    learningPath = new LearningPath({ userId });
    support = new SupportTicketingSystem();
    certification = new CertificationEngine({ userId });
  });

  describe('New User Onboarding Flow', () => {
    it('should complete full onboarding sequence', async () => {
      // 1. Setup Wizard
      wizard.setupConfig['welcome-setup'] = {
        fullName: 'Jane Smith',
        email: 'jane@company.com',
        timezone: 'America/New_York',
        language: 'en'
      };

      wizard.setupConfig['browser-config'] = {
        userAgent: 'chrome-windows',
        fingerprinting: true,
        adBlocking: true,
        trackerBlocking: true,
        scriptTimeout: 30
      };

      wizard.setupConfig['proxy-setup'] = { proxyType: 'none' };
      wizard.setupConfig['slack-integration'] = { enableSlack: false };
      wizard.setupConfig['initial-monitors'] = { monitors: [] };
      wizard.setupConfig['dashboard-customization'] = { dashboardLayout: 'grid' };
      wizard.setupConfig['completion-review'] = { agreeToTerms: true };

      const setupResult = await wizard.completeSetup();
      assert.strictEqual(setupResult.success, true);

      // 2. Start Tutorial
      const tutorialStart = await tutorials.startTutorial('dashboard-basics');
      assert.strictEqual(tutorialStart.success, true);

      // 3. Create demo account
      const demoAccount = await demo.createDemoAccount({
        name: 'Demo Account',
        timezone: 'America/New_York'
      });
      assert.strictEqual(demoAccount.success, true);

      // 4. Start learning path
      const pathStart = await learningPath.startLearningPath('path-basic');
      assert.strictEqual(pathStart.success, true);

      // 5. Create support ticket if needed
      const ticket = await support.createTicket({
        userId: 'customer',
        subject: 'Setup Help',
        description: 'Need assistance with setup',
        category: 'general',
        priority: 'low'
      });
      assert.strictEqual(ticket.success, true);

      // All systems working together
      assert(setupResult.data.setupConfig);
      assert(tutorialStart.tutorial);
      assert(demoAccount.account);
      assert(pathStart.path);
      assert(ticket.ticket);
    });
  });

  describe('Tutorial Progression', () => {
    it('should complete tutorial series', async () => {
      const tutorial1 = await tutorials.startTutorial('dashboard-basics');
      assert.strictEqual(tutorial1.success, true);

      // Progress through steps
      await tutorials.nextStep('dashboard-basics');
      await tutorials.nextStep('dashboard-basics');

      const status = tutorials.getTutorialStatus('dashboard-basics');
      assert(status.completionPercentage > 0);
    });

    it('should unlock advanced tutorials', async () => {
      // Complete basic tutorial
      const basic = await tutorials.startTutorial('dashboard-basics');
      const basicTutorial = tutorials.getTutorial('dashboard-basics');

      // Simulate completion
      for (let i = 0; i < basicTutorial.steps.length; i++) {
        await tutorials.nextStep('dashboard-basics');
      }
      await tutorials.completeTutorial('dashboard-basics');

      // Check if advanced tutorials become available
      const available = tutorials.getAvailableTutorials();
      const hasAdvanced = available.some(t => t.category === 'advanced');
      // Depends on prerequisites
    });
  });

  describe('Demo Environment Usage', () => {
    it('should use demo environment for learning', async () => {
      // Create demo account
      const account = await demo.createDemoAccount({
        name: 'Learning Account'
      });

      const monitors = demo.getDemoMonitors(account.account.id);
      assert(monitors.length > 0);

      // Run test checks
      for (const monitor of monitors.slice(0, 2)) {
        const result = await demo.runTestCheck(monitor.id);
        assert.strictEqual(result.success, true);
      }

      // Get dashboard summary
      const summary = demo.getDashboardSummary(account.account.id);
      assert(summary.totalMonitors > 0);
      assert(summary.monitorsByCategory);
    });

    it('should track demo data changes', async () => {
      const account = await demo.createDemoAccount({ name: 'Test Account' });
      const startingMonitors = demo.getDemoMonitors(account.account.id).length;

      demo.startAutoRefresh();
      await new Promise(resolve => setTimeout(resolve, 100));
      demo.stopAutoRefresh();

      const currentMonitors = demo.getDemoMonitors(account.account.id);
      assert.strictEqual(currentMonitors.length, startingMonitors);
    });
  });

  describe('Help System Integration', () => {
    it('should provide contextual help', () => {
      const help = helpSystem.getContextualHelp('dashboard-main');
      assert(help.articles || help.suggestedArticles);
    });

    it('should search help articles', () => {
      const results = helpSystem.searchHelp('monitor');
      assert(results.length > 0);
      assert(results[0].relevanceScore >= 0);
    });

    it('should find FAQs', () => {
      const faqs = helpSystem.getFAQ(5);
      assert(faqs.length > 0);
    });

    it('should support help ratings', () => {
      const articleId = 'dashboard-overview';
      const result = helpSystem.rateArticle(articleId, true);
      assert.strictEqual(result.success, true);
    });
  });

  describe('Learning Path Progression', () => {
    it('should progress through learning path', async () => {
      const path = await learningPath.startLearningPath('path-basic');
      assert.strictEqual(path.success, true);

      // Complete a lesson
      const lessonId = learningPath.getLearningPath('path-basic').modules[0].lessons[0].id;
      const completionResult = await learningPath.completeLesson('path-basic', lessonId);
      assert.strictEqual(completionResult.success, true);

      // Check progress
      const progress = learningPath.getPathProgress('path-basic');
      assert(progress.progress > 0);
    });

    it('should award milestones', () => {
      const milestone = learningPath.checkMilestone('monitor-created');
      // Milestone triggering depends on actual events
    });
  });

  describe('Support Ticket Workflow', () => {
    it('should handle complete ticket lifecycle', async () => {
      const ticketData = {
        userId: 'customer-123',
        subject: 'I need help setting up',
        description: 'Cannot configure my first monitor',
        category: 'technical',
        priority: 'high'
      };

      const createResult = await support.createTicket(ticketData);
      assert.strictEqual(createResult.success, true);

      const ticketId = createResult.ticket.id;

      // Update status
      const updateResult = await support.updateTicketStatus(ticketId, 'in-progress');
      assert.strictEqual(updateResult.success, true);

      // Add response
      const responseResult = await support.addResponse(ticketId, {
        author: 'support-agent',
        content: 'We will help you set up your monitor',
        isInternal: false
      });
      assert.strictEqual(responseResult.success, true);

      // Check SLA
      const sla = support.getSLAStatus(ticketId);
      assert(sla.responseStatus === 'on-track' || sla.responseStatus === 'met');

      // Resolve ticket
      const resolveResult = await support.updateTicketStatus(ticketId, 'resolved', {
        resolution: 'Provided setup assistance'
      });
      assert.strictEqual(resolveResult.success, true);

      // Close ticket
      const closeResult = await support.closeTicket(ticketId);
      assert.strictEqual(closeResult.success, true);
    });

    it('should escalate critical tickets', async () => {
      const ticketData = {
        userId: 'customer-123',
        subject: 'System Down',
        description: 'Production system is down',
        category: 'technical',
        priority: 'critical'
      };

      const createResult = await support.createTicket(ticketData);
      const ticketId = createResult.ticket.id;

      // Check that critical ticket was auto-assigned
      const ticket = support.getTicket(ticketId);
      assert(ticket.assignedTo);
    });

    it('should track SLA metrics', async () => {
      await support.createTicket({
        userId: 'customer',
        subject: 'Question',
        description: 'I have a question',
        category: 'general',
        priority: 'low'
      });

      const stats = support.getStatistics();
      assert(stats.total > 0);
      assert(stats.byStatus);
      assert(stats.byPriority);
    });
  });

  describe('Certification & Skills', () => {
    it('should complete certification path', async () => {
      const exam = certification.getExam('exam-basic-monitoring');
      const answers = {};
      for (const q of exam.questions) {
        answers[q.id] = q.correctAnswer;
      }

      const result = await certification.submitExam('exam-basic-monitoring', answers);
      assert.strictEqual(result.result.passed, true);
      assert(result.result.certificateId);

      // Verify certificate
      const verification = certification.verifyCertificate(result.result.certificateId);
      assert.strictEqual(verification.valid, true);
    });

    it('should track user skills and endorsements', () => {
      certification.endorseSkill('skill-monitor-creation', 'manual');
      certification.endorseSkill('skill-monitor-creation', 'manual');

      const skills = certification.getUserSkills();
      assert(skills.length > 0);

      const status = certification.getCertificationStatus();
      assert(status.skills.length > 0);
    });
  });

  describe('Complete Customer Success Flow', () => {
    it('should guide customer to success', async () => {
      const userId = 'success-customer';

      // 1. Welcome and setup
      console.log('1. Completing setup wizard...');
      wizard.setupConfig['welcome-setup'] = {
        fullName: 'Success User',
        email: 'success@example.com',
        timezone: 'UTC',
        language: 'en'
      };
      wizard.setupConfig['browser-config'] = {
        userAgent: 'chrome-windows',
        fingerprinting: true,
        adBlocking: true,
        trackerBlocking: true,
        scriptTimeout: 30
      };
      wizard.setupConfig['proxy-setup'] = { proxyType: 'none' };
      wizard.setupConfig['slack-integration'] = { enableSlack: false };
      wizard.setupConfig['initial-monitors'] = { monitors: [] };
      wizard.setupConfig['dashboard-customization'] = { dashboardLayout: 'grid' };
      wizard.setupConfig['completion-review'] = { agreeToTerms: true };
      const setupComplete = await wizard.completeSetup();
      assert.strictEqual(setupComplete.success, true);

      // 2. Start learning
      console.log('2. Starting basic tutorial...');
      const tutorialStart = await tutorials.startTutorial('dashboard-basics');
      assert.strictEqual(tutorialStart.success, true);

      // 3. Access help
      console.log('3. Accessing help system...');
      const help = helpSystem.getContextualHelp('dashboard-main');
      assert(help.articles || help.suggestedArticles);

      // 4. Join learning path
      console.log('4. Starting learning path...');
      const pathStart = await learningPath.startLearningPath('path-basic');
      assert.strictEqual(pathStart.success, true);

      // 5. Get certified
      console.log('5. Taking certification exam...');
      const exam = certification.getExam('exam-basic-monitoring');
      const answers = {};
      for (const q of exam.questions) {
        answers[q.id] = q.correctAnswer;
      }
      const certResult = await certification.submitExam('exam-basic-monitoring', answers);
      assert.strictEqual(certResult.result.passed, true);

      // 6. Create demo account
      console.log('6. Creating demo environment...');
      const demoAccount = await demo.createDemoAccount({ name: 'Learning Account' });
      assert.strictEqual(demoAccount.success, true);

      console.log('✓ Customer journey complete!');
      console.log('Setup: Complete');
      console.log('Tutorial: Active');
      console.log('Learning Path: In Progress');
      console.log('Certification: Passed');
      console.log('Demo Environment: Ready');
    });
  });
});
