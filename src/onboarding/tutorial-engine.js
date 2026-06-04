/**
 * Tutorial Engine
 *
 * Provides interactive step-by-step guides with progress checkpoints,
 * contextual help, and completion tracking.
 */

const EventEmitter = require('events');

class TutorialEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.userId = options.userId || null;
    this.tutorials = new Map();
    this.activeTutorials = new Map();
    this.completedTutorials = new Set();
    this.userProgress = new Map();
    this.initializeTutorials();
  }

  /**
   * Initialize built-in tutorials
   */
  initializeTutorials() {
    this.registerTutorial({
      id: 'dashboard-basics',
      title: 'Dashboard Basics',
      description: 'Learn how to navigate and use the main dashboard',
      category: 'dashboard',
      difficulty: 'beginner',
      estimatedTime: 8,
      prerequisites: [],
      steps: [
        {
          id: 'dashboard-1',
          title: 'Welcome to the Dashboard',
          content: 'The dashboard is your command center for monitoring competitors and tracking changes.',
          tips: ['Use the sidebar to navigate between sections', 'Click on any monitor to see details'],
          media: { type: 'screenshot', path: 'dashboard-overview.png' },
          checkpoint: false
        },
        {
          id: 'dashboard-2',
          title: 'Understanding the Main Widgets',
          content: 'Your dashboard contains several key widgets that display important information.',
          tips: [
            'Summary widget shows your monitor status',
            'Recent changes widget displays latest detections',
            'Alerts widget shows active notifications'
          ],
          media: { type: 'video', path: 'dashboard-widgets.mp4' },
          checkpoint: false
        },
        {
          id: 'dashboard-3',
          title: 'Customizing Your View',
          content: 'You can customize your dashboard to show the information most important to you.',
          tips: ['Drag widgets to rearrange', 'Remove unused widgets', 'Add new widgets from settings'],
          interactive: {
            type: 'guide',
            action: 'customizeDashboard',
            target: 'dashboard-settings'
          },
          checkpoint: true
        },
        {
          id: 'dashboard-4',
          title: 'Using Filters and Search',
          content: 'Filter your monitors by category, status, or custom tags.',
          tips: ['Use the search bar for quick lookup', 'Apply filters to reduce clutter'],
          interactive: {
            type: 'guide',
            action: 'filterMonitors',
            target: 'filter-panel'
          },
          checkpoint: true
        }
      ]
    });

    this.registerTutorial({
      id: 'monitor-creation',
      title: 'Creating Your First Monitor',
      description: 'Step-by-step guide to creating and configuring a monitor',
      category: 'monitoring',
      difficulty: 'beginner',
      estimatedTime: 12,
      prerequisites: ['dashboard-basics'],
      steps: [
        {
          id: 'monitor-1',
          title: 'Getting Started with Monitors',
          content: 'Monitors track specific URLs and detect changes in real-time.',
          tips: ['One monitor per target URL', 'Configure frequency based on your needs'],
          checkpoint: false
        },
        {
          id: 'monitor-2',
          title: 'Adding a New Monitor',
          content: 'Click the Add Monitor button to begin creating a new monitor.',
          tips: ['Enter the URL you want to monitor', 'Name your monitor descriptively'],
          interactive: {
            type: 'guide',
            action: 'createMonitor',
            target: 'monitor-form'
          },
          checkpoint: true
        },
        {
          id: 'monitor-3',
          title: 'Configuring Detection Settings',
          content: 'Set up what changes to detect and how to respond.',
          tips: [
            'Choose detection type (visual, text, element)',
            'Set sensitivity level',
            'Configure notification rules'
          ],
          checkpoint: true
        },
        {
          id: 'monitor-4',
          title: 'Testing Your Monitor',
          content: 'Run a test to ensure your monitor is working correctly.',
          tips: ['Test immediately after setup', 'Check notification delivery'],
          interactive: {
            type: 'guide',
            action: 'testMonitor',
            target: 'monitor-test-button'
          },
          checkpoint: true
        }
      ]
    });

    this.registerTutorial({
      id: 'slack-notifications',
      title: 'Slack Notifications Setup',
      description: 'Configure Slack to receive real-time notifications',
      category: 'integrations',
      difficulty: 'beginner',
      estimatedTime: 6,
      prerequisites: [],
      steps: [
        {
          id: 'slack-1',
          title: 'Why Use Slack Integration?',
          content: 'Get instant notifications directly in Slack when changes are detected.',
          tips: ['Never miss important updates', 'Integrate with your team workflow'],
          checkpoint: false
        },
        {
          id: 'slack-2',
          title: 'Creating a Slack App',
          content: 'Set up a Slack app to authenticate the integration.',
          tips: ['Go to api.slack.com', 'Create an incoming webhook'],
          media: { type: 'guide', title: 'Slack App Setup Guide' },
          checkpoint: true
        },
        {
          id: 'slack-3',
          title: 'Connecting Your Workspace',
          content: 'Enter your webhook URL and configure notification channels.',
          tips: ['Copy webhook URL from Slack', 'Select default channel'],
          interactive: {
            type: 'guide',
            action: 'configureSlack',
            target: 'slack-settings'
          },
          checkpoint: true
        }
      ]
    });

    this.registerTutorial({
      id: 'proxy-configuration',
      title: 'Proxy and Network Setup',
      description: 'Configure proxies for privacy and access control',
      category: 'network',
      difficulty: 'intermediate',
      estimatedTime: 15,
      prerequisites: ['dashboard-basics'],
      steps: [
        {
          id: 'proxy-1',
          title: 'Understanding Proxies',
          content: 'Proxies route your traffic through intermediary servers for privacy and access.',
          tips: [
            'HTTP proxies for web traffic',
            'SOCKS5 for all protocols',
            'Residential proxies for high evasion'
          ],
          checkpoint: false
        },
        {
          id: 'proxy-2',
          title: 'Selecting Proxy Type',
          content: 'Choose the right proxy type for your use case.',
          tips: ['Consider speed vs. anonymity trade-offs'],
          interactive: {
            type: 'guide',
            action: 'selectProxyType',
            target: 'proxy-type-selector'
          },
          checkpoint: true
        },
        {
          id: 'proxy-3',
          title: 'Adding Proxy Credentials',
          content: 'Configure authentication if your proxy requires it.',
          tips: ['Store credentials securely', 'Use proxy manager for rotation'],
          checkpoint: true
        },
        {
          id: 'proxy-4',
          title: 'Testing Your Proxy Connection',
          content: 'Verify that your proxy is working correctly.',
          tips: ['Check IP address changes', 'Monitor connection stability'],
          interactive: {
            type: 'guide',
            action: 'testProxy',
            target: 'proxy-test-button'
          },
          checkpoint: true
        }
      ]
    });

    this.registerTutorial({
      id: 'advanced-monitoring',
      title: 'Advanced Monitoring Techniques',
      description: 'Master advanced monitoring features and techniques',
      category: 'monitoring',
      difficulty: 'advanced',
      estimatedTime: 20,
      prerequisites: ['monitor-creation'],
      steps: [
        {
          id: 'adv-1',
          title: 'Custom Element Selection',
          content: 'Monitor specific elements on a page rather than the entire page.',
          tips: ['Use CSS selectors', 'Test selectors before saving'],
          interactive: {
            type: 'guide',
            action: 'selectElement',
            target: 'element-selector'
          },
          checkpoint: true
        },
        {
          id: 'adv-2',
          title: 'Regular Expression Matching',
          content: 'Use regex patterns to match dynamic content.',
          tips: ['Test patterns in the regex tester', 'Document your patterns'],
          checkpoint: true
        },
        {
          id: 'adv-3',
          title: 'Threshold-based Alerts',
          content: 'Create alerts based on numeric thresholds.',
          tips: ['Set sensitivity levels', 'Configure escalation policies'],
          checkpoint: true
        },
        {
          id: 'adv-4',
          title: 'Monitor Groups and Automation',
          content: 'Group related monitors and automate responses.',
          tips: ['Create monitor hierarchies', 'Set up automation rules'],
          checkpoint: true
        }
      ]
    });
  }

  /**
   * Register a new tutorial
   */
  registerTutorial(tutorialConfig) {
    const tutorial = {
      id: tutorialConfig.id,
      title: tutorialConfig.title,
      description: tutorialConfig.description,
      category: tutorialConfig.category,
      difficulty: tutorialConfig.difficulty,
      estimatedTime: tutorialConfig.estimatedTime,
      prerequisites: tutorialConfig.prerequisites || [],
      steps: tutorialConfig.steps || [],
      createdAt: new Date().toISOString(),
      metadata: tutorialConfig.metadata || {}
    };

    this.tutorials.set(tutorial.id, tutorial);
    this.emit('tutorial-registered', { tutorialId: tutorial.id });
    return this;
  }

  /**
   * Get tutorial by ID
   */
  getTutorial(tutorialId) {
    return this.tutorials.get(tutorialId);
  }

  /**
   * Get all tutorials
   */
  getAllTutorials() {
    return Array.from(this.tutorials.values());
  }

  /**
   * Get tutorials by category
   */
  getTutorialsByCategory(category) {
    return Array.from(this.tutorials.values()).filter(t => t.category === category);
  }

  /**
   * Get tutorials by difficulty
   */
  getTutorialsByDifficulty(difficulty) {
    return Array.from(this.tutorials.values()).filter(t => t.difficulty === difficulty);
  }

  /**
   * Get available tutorials for user
   */
  getAvailableTutorials() {
    return Array.from(this.tutorials.values()).filter(tutorial => {
      // Check prerequisites
      if (tutorial.prerequisites.length === 0) return true;
      return tutorial.prerequisites.every(prereq => this.completedTutorials.has(prereq));
    });
  }

  /**
   * Start a tutorial
   */
  async startTutorial(tutorialId) {
    const tutorial = this.getTutorial(tutorialId);
    if (!tutorial) {
      return { success: false, reason: 'Tutorial not found' };
    }

    // Check prerequisites
    if (tutorial.prerequisites.length > 0) {
      const unsatisfied = tutorial.prerequisites.filter(
        prereq => !this.completedTutorials.has(prereq)
      );
      if (unsatisfied.length > 0) {
        return {
          success: false,
          reason: 'Prerequisites not satisfied',
          unsatisfied
        };
      }
    }

    const activeTutorial = {
      tutorialId,
      startedAt: new Date(),
      currentStepIndex: 0,
      completedSteps: new Set(),
      checkpointsPassed: 0,
      progress: 0
    };

    this.activeTutorials.set(tutorialId, activeTutorial);
    this.userProgress.set(tutorialId, {
      tutorialId,
      status: 'in-progress',
      startTime: Date.now(),
      currentStep: 0
    });

    this.emit('tutorial-started', { tutorialId });
    return {
      success: true,
      tutorial,
      currentStep: tutorial.steps[0]
    };
  }

  /**
   * Get current tutorial status
   */
  getTutorialStatus(tutorialId) {
    const activeTutorial = this.activeTutorials.get(tutorialId);
    if (!activeTutorial) {
      return { status: 'not-started' };
    }

    const tutorial = this.getTutorial(tutorialId);
    const currentStep = tutorial.steps[activeTutorial.currentStepIndex];
    const completionPercentage = (activeTutorial.completedSteps.size / tutorial.steps.length) * 100;

    return {
      status: 'in-progress',
      tutorialId,
      currentStep: currentStep.id,
      currentStepIndex: activeTutorial.currentStepIndex,
      completedSteps: Array.from(activeTutorial.completedSteps),
      checkpointsPassed: activeTutorial.checkpointsPassed,
      completionPercentage: Math.round(completionPercentage),
      elapsedTime: Date.now() - activeTutorial.startedAt.getTime(),
      estimatedTimeRemaining:
        tutorial.estimatedTime * 60000 - (Date.now() - activeTutorial.startedAt.getTime())
    };
  }

  /**
   * Get current step
   */
  getCurrentStep(tutorialId) {
    const activeTutorial = this.activeTutorials.get(tutorialId);
    if (!activeTutorial) return null;

    const tutorial = this.getTutorial(tutorialId);
    return tutorial.steps[activeTutorial.currentStepIndex];
  }

  /**
   * Complete current step
   */
  async completeStep(tutorialId) {
    const activeTutorial = this.activeTutorials.get(tutorialId);
    if (!activeTutorial) {
      return { success: false, reason: 'Tutorial not started' };
    }

    const tutorial = this.getTutorial(tutorialId);
    const currentStep = tutorial.steps[activeTutorial.currentStepIndex];

    if (!currentStep) {
      return { success: false, reason: 'No current step' };
    }

    activeTutorial.completedSteps.add(currentStep.id);
    if (currentStep.checkpoint) {
      activeTutorial.checkpointsPassed++;
    }

    this.emit('step-completed', { tutorialId, stepId: currentStep.id });

    // Check if tutorial is complete
    if (activeTutorial.currentStepIndex === tutorial.steps.length - 1) {
      return this.completeTutorial(tutorialId);
    }

    return { success: true, stepId: currentStep.id };
  }

  /**
   * Move to next step
   */
  async nextStep(tutorialId) {
    const activeTutorial = this.activeTutorials.get(tutorialId);
    if (!activeTutorial) {
      return { success: false, reason: 'Tutorial not started' };
    }

    const tutorial = this.getTutorial(tutorialId);
    if (activeTutorial.currentStepIndex < tutorial.steps.length - 1) {
      // First complete current step
      await this.completeStep(tutorialId);

      activeTutorial.currentStepIndex++;
      const nextStep = tutorial.steps[activeTutorial.currentStepIndex];

      this.emit('step-changed', { tutorialId, stepId: nextStep.id });
      return {
        success: true,
        currentStep: nextStep,
        progress: this.getTutorialStatus(tutorialId)
      };
    }

    return { success: false, reason: 'No more steps' };
  }

  /**
   * Go to previous step
   */
  previousStep(tutorialId) {
    const activeTutorial = this.activeTutorials.get(tutorialId);
    if (!activeTutorial) {
      return { success: false, reason: 'Tutorial not started' };
    }

    if (activeTutorial.currentStepIndex > 0) {
      activeTutorial.currentStepIndex--;
      const prevStep = this.getTutorial(tutorialId).steps[activeTutorial.currentStepIndex];

      this.emit('step-changed', { tutorialId, stepId: prevStep.id });
      return { success: true, currentStep: prevStep };
    }

    return { success: false, reason: 'Already on first step' };
  }

  /**
   * Skip tutorial
   */
  async skipTutorial(tutorialId) {
    const activeTutorial = this.activeTutorials.get(tutorialId);
    if (!activeTutorial) {
      return { success: false, reason: 'Tutorial not started' };
    }

    this.activeTutorials.delete(tutorialId);
    this.userProgress.set(tutorialId, {
      tutorialId,
      status: 'skipped',
      startTime: activeTutorial.startedAt.getTime(),
      skipTime: Date.now()
    });

    this.emit('tutorial-skipped', { tutorialId });
    return { success: true };
  }

  /**
   * Complete tutorial
   */
  async completeTutorial(tutorialId) {
    const activeTutorial = this.activeTutorials.get(tutorialId);
    if (!activeTutorial) {
      return { success: false, reason: 'Tutorial not started' };
    }

    const tutorial = this.getTutorial(tutorialId);
    const elapsedTime = Date.now() - activeTutorial.startedAt.getTime();

    this.completedTutorials.add(tutorialId);
    this.activeTutorials.delete(tutorialId);

    const completionData = {
      tutorialId,
      completedAt: new Date().toISOString(),
      totalTime: elapsedTime,
      stepsCompleted: activeTutorial.completedSteps.size,
      checkpointsPassed: activeTutorial.checkpointsPassed,
      certificateId: `TUT-CERT-${tutorialId}-${Date.now()}`
    };

    this.userProgress.set(tutorialId, {
      ...completionData,
      status: 'completed'
    });

    this.emit('tutorial-completed', completionData);
    return { success: true, completionData };
  }

  /**
   * Get tutorial progress
   */
  getTutorialProgress(tutorialId) {
    return this.userProgress.get(tutorialId) || null;
  }

  /**
   * Get all tutorial progress
   */
  getAllProgress() {
    return Object.fromEntries(this.userProgress);
  }

  /**
   * Get completion statistics
   */
  getCompletionStats() {
    const allTutorials = this.getAllTutorials();
    const completed = this.completedTutorials.size;
    const active = this.activeTutorials.size;
    const totalTime = Array.from(this.userProgress.values()).reduce(
      (sum, p) => sum + (p.totalTime || 0),
      0
    );

    return {
      totalTutorials: allTutorials.length,
      completedTutorials: completed,
      activeTutorials: active,
      completionPercentage: allTutorials.length > 0 ? (completed / allTutorials.length) * 100 : 0,
      totalTimeSpent: totalTime,
      averageTimePerTutorial: completed > 0 ? totalTime / completed : 0,
      byCategory: this.getStatsByCategory(),
      byDifficulty: this.getStatsByDifficulty()
    };
  }

  /**
   * Get statistics by category
   */
  getStatsByCategory() {
    const stats = {};
    for (const tutorial of this.getAllTutorials()) {
      if (!stats[tutorial.category]) {
        stats[tutorial.category] = { total: 0, completed: 0 };
      }
      stats[tutorial.category].total++;
      if (this.completedTutorials.has(tutorial.id)) {
        stats[tutorial.category].completed++;
      }
    }
    return stats;
  }

  /**
   * Get statistics by difficulty
   */
  getStatsByDifficulty() {
    const stats = {};
    for (const tutorial of this.getAllTutorials()) {
      if (!stats[tutorial.difficulty]) {
        stats[tutorial.difficulty] = { total: 0, completed: 0 };
      }
      stats[tutorial.difficulty].total++;
      if (this.completedTutorials.has(tutorial.id)) {
        stats[tutorial.difficulty].completed++;
      }
    }
    return stats;
  }

  /**
   * Get contextual help for feature
   */
  getContextualHelp(featureId) {
    const helpArticles = {
      'monitor-creation': {
        title: 'Creating a Monitor',
        content: 'A monitor tracks a specific URL and alerts you when changes are detected.',
        relatedTutorials: ['monitor-creation', 'advanced-monitoring'],
        tips: [
          'Start with a single URL',
          'Test your monitor before deploying',
          'Set appropriate check frequency'
        ],
        videoUrl: 'https://example.com/video/monitor-creation'
      },
      'proxy-setup': {
        title: 'Setting Up Proxies',
        content: 'Proxies route your requests through intermediary servers.',
        relatedTutorials: ['proxy-configuration'],
        tips: ['Choose the right proxy type', 'Test connectivity', 'Monitor performance'],
        videoUrl: 'https://example.com/video/proxy-setup'
      }
    };

    return helpArticles[featureId] || null;
  }
}

module.exports = TutorialEngine;
