/**
 * Learning Path System
 *
 * Manages guided learning paths (basic → intermediate → advanced),
 * skill assessments, certificates, and milestone rewards.
 */

const EventEmitter = require('events');

class LearningPath extends EventEmitter {
  constructor(options = {}) {
    super();
    this.userId = options.userId || null;
    this.learningPaths = new Map();
    this.userPaths = new Map();
    this.assessments = new Map();
    this.userSkills = new Map();
    this.milestones = [];
    this.certificates = new Map();
    this.initializePaths();
  }

  /**
   * Initialize learning paths
   */
  initializePaths() {
    const basicPath = {
      id: 'path-basic',
      name: 'Monitoring Essentials',
      description: 'Learn the fundamentals of competitive monitoring',
      level: 'beginner',
      estimatedHours: 4,
      modules: [
        {
          id: 'module-1',
          title: 'Getting Started',
          lessons: [
            { id: 'lesson-1-1', title: 'Dashboard Overview', type: 'video', duration: 8 },
            { id: 'lesson-1-2', title: 'Account Setup', type: 'interactive', duration: 10 }
          ]
        },
        {
          id: 'module-2',
          title: 'Creating Your First Monitor',
          lessons: [
            { id: 'lesson-2-1', title: 'Understanding Monitors', type: 'article', duration: 5 },
            {
              id: 'lesson-2-2',
              title: 'Creating a Monitor',
              type: 'interactive',
              duration: 15
            },
            { id: 'lesson-2-3', title: 'Testing Your Monitor', type: 'interactive', duration: 10 }
          ]
        },
        {
          id: 'module-3',
          title: 'Alerts and Notifications',
          lessons: [
            {
              id: 'lesson-3-1',
              title: 'Alert Configuration',
              type: 'interactive',
              duration: 12
            },
            { id: 'lesson-3-2', title: 'Notification Channels', type: 'video', duration: 8 }
          ]
        }
      ],
      assessment: {
        type: 'quiz',
        questions: 10,
        passingScore: 70,
        estimatedTime: 15
      },
      certification: {
        name: 'Monitoring Basics Certificate',
        validityMonths: 12
      }
    };

    const intermediatePath = {
      id: 'path-intermediate',
      name: 'Advanced Monitoring Techniques',
      description: 'Master advanced monitoring features and optimization',
      level: 'intermediate',
      estimatedHours: 8,
      prerequisites: ['path-basic'],
      modules: [
        {
          id: 'module-1',
          title: 'Detection Methods Deep Dive',
          lessons: [
            { id: 'lesson-1-1', title: 'Visual Detection', type: 'article', duration: 10 },
            { id: 'lesson-1-2', title: 'Text Detection', type: 'interactive', duration: 15 },
            { id: 'lesson-1-3', title: 'Element Detection', type: 'interactive', duration: 15 },
            { id: 'lesson-1-4', title: 'Comparing Methods', type: 'quiz', duration: 10 }
          ]
        },
        {
          id: 'module-2',
          title: 'Proxy and Network Setup',
          lessons: [
            { id: 'lesson-2-1', title: 'Proxy Types', type: 'article', duration: 10 },
            { id: 'lesson-2-2', title: 'Setting Up Proxies', type: 'interactive', duration: 20 },
            { id: 'lesson-2-3', title: 'Proxy Rotation', type: 'interactive', duration: 15 }
          ]
        },
        {
          id: 'module-3',
          title: 'Advanced Monitoring',
          lessons: [
            { id: 'lesson-3-1', title: 'CSS Selectors', type: 'interactive', duration: 15 },
            { id: 'lesson-3-2', title: 'XPath Expressions', type: 'interactive', duration: 15 },
            { id: 'lesson-3-3', title: 'Regular Expressions', type: 'interactive', duration: 15 }
          ]
        }
      ],
      assessment: {
        type: 'practical',
        tasks: [
          'Create a monitor with element selection',
          'Set up and test a proxy',
          'Configure advanced detection'
        ],
        estimatedTime: 60
      },
      certification: {
        name: 'Advanced Monitoring Certificate',
        validityMonths: 12
      }
    };

    const expertPath = {
      id: 'path-expert',
      name: 'Expert Monitoring & Optimization',
      description: 'Become an expert in system optimization and advanced features',
      level: 'advanced',
      estimatedHours: 12,
      prerequisites: ['path-intermediate'],
      modules: [
        {
          id: 'module-1',
          title: 'System Architecture & Optimization',
          lessons: [
            { id: 'lesson-1-1', title: 'System Architecture', type: 'article', duration: 15 },
            { id: 'lesson-1-2', title: 'Performance Tuning', type: 'interactive', duration: 20 },
            { id: 'lesson-1-3', title: 'Scaling Monitors', type: 'interactive', duration: 20 }
          ]
        },
        {
          id: 'module-2',
          title: 'Advanced Evasion Techniques',
          lessons: [
            { id: 'lesson-2-1', title: 'Fingerprinting', type: 'article', duration: 15 },
            { id: 'lesson-2-2', title: 'Bot Detection', type: 'article', duration: 15 },
            { id: 'lesson-2-3', title: 'Evasion Strategies', type: 'interactive', duration: 20 }
          ]
        },
        {
          id: 'module-3',
          title: 'Advanced Integration',
          lessons: [
            { id: 'lesson-3-1', title: 'API Integration', type: 'interactive', duration: 20 },
            { id: 'lesson-3-2', title: 'Webhooks & Automation', type: 'interactive', duration: 20 },
            { id: 'lesson-3-3', title: 'Custom Workflows', type: 'project', duration: 60 }
          ]
        }
      ],
      assessment: {
        type: 'capstone',
        project: 'Build a comprehensive monitoring solution',
        estimatedTime: 120
      },
      certification: {
        name: 'Expert Monitoring & Optimization Certificate',
        validityMonths: 24
      }
    };

    this.learningPaths.set('path-basic', basicPath);
    this.learningPaths.set('path-intermediate', intermediatePath);
    this.learningPaths.set('path-expert', expertPath);

    this.initializeSkills();
    this.initializeMilestones();
  }

  /**
   * Initialize skill definitions
   */
  initializeSkills() {
    const skills = [
      {
        id: 'skill-dashboard',
        name: 'Dashboard Navigation',
        description: 'Ability to navigate and customize the dashboard',
        level: 'beginner',
        path: 'path-basic'
      },
      {
        id: 'skill-monitor-creation',
        name: 'Monitor Creation',
        description: 'Ability to create and configure monitors',
        level: 'beginner',
        path: 'path-basic'
      },
      {
        id: 'skill-alerts',
        name: 'Alert Management',
        description: 'Ability to configure and manage alerts',
        level: 'beginner',
        path: 'path-basic'
      },
      {
        id: 'skill-detection-methods',
        name: 'Detection Methods',
        description: 'Understanding of different detection methods',
        level: 'intermediate',
        path: 'path-intermediate'
      },
      {
        id: 'skill-proxy-setup',
        name: 'Proxy Configuration',
        description: 'Ability to set up and manage proxies',
        level: 'intermediate',
        path: 'path-intermediate'
      },
      {
        id: 'skill-selectors',
        name: 'CSS/XPath Selectors',
        description: 'Proficiency with CSS and XPath selectors',
        level: 'intermediate',
        path: 'path-intermediate'
      },
      {
        id: 'skill-optimization',
        name: 'Performance Optimization',
        description: 'Ability to optimize system performance',
        level: 'advanced',
        path: 'path-expert'
      },
      {
        id: 'skill-evasion',
        name: 'Evasion Techniques',
        description: 'Understanding of bot detection evasion',
        level: 'advanced',
        path: 'path-expert'
      },
      {
        id: 'skill-integration',
        name: 'API Integration',
        description: 'Ability to integrate with external systems',
        level: 'advanced',
        path: 'path-expert'
      }
    ];

    for (const skill of skills) {
      this.assessments.set(skill.id, skill);
    }
  }

  /**
   * Initialize milestones
   */
  initializeMilestones() {
    this.milestones = [
      {
        id: 'milestone-first-monitor',
        name: 'First Monitor Created',
        description: 'Create your first monitor',
        points: 50,
        badge: 'first-monitor-badge',
        trigger: 'monitor-created',
        reward: 'Pro tip: Use visual detection for immediate results'
      },
      {
        id: 'milestone-path-basic',
        name: 'Monitoring Basics Certified',
        description: 'Complete the Monitoring Essentials path',
        points: 200,
        badge: 'basic-certified-badge',
        trigger: 'path-completed',
        condition: { pathId: 'path-basic' },
        reward: 'Unlock intermediate learning path'
      },
      {
        id: 'milestone-five-monitors',
        name: 'Five Monitors Active',
        description: 'Create 5 active monitors',
        points: 100,
        badge: 'five-monitors-badge',
        trigger: 'monitor-count',
        condition: { count: 5 },
        reward: 'Access to advanced detection methods'
      },
      {
        id: 'milestone-path-intermediate',
        name: 'Advanced Techniques Certified',
        description: 'Complete the Advanced Monitoring Techniques path',
        points: 300,
        badge: 'intermediate-certified-badge',
        trigger: 'path-completed',
        condition: { pathId: 'path-intermediate' },
        reward: 'Unlock expert learning path'
      },
      {
        id: 'milestone-proxy-configured',
        name: 'Proxy Master',
        description: 'Successfully configure and test a proxy',
        points: 150,
        badge: 'proxy-master-badge',
        trigger: 'proxy-tested',
        reward: 'Access to advanced proxy features'
      },
      {
        id: 'milestone-path-expert',
        name: 'Expert Certified',
        description: 'Complete the Expert Monitoring & Optimization path',
        points: 500,
        badge: 'expert-certified-badge',
        trigger: 'path-completed',
        condition: { pathId: 'path-expert' },
        reward: 'Expert support and custom configurations'
      },
      {
        id: 'milestone-1000-checks',
        name: 'Thousand Checks',
        description: 'Perform 1000 monitor checks',
        points: 250,
        badge: 'thousand-checks-badge',
        trigger: 'check-count',
        condition: { count: 1000 },
        reward: 'Performance optimization consultation'
      }
    ];
  }

  /**
   * Get learning path by ID
   */
  getLearningPath(pathId) {
    return this.learningPaths.get(pathId);
  }

  /**
   * Get all learning paths
   */
  getAllLearningPaths() {
    return Array.from(this.learningPaths.values());
  }

  /**
   * Get available paths for user
   */
  getAvailablePaths() {
    const paths = Array.from(this.learningPaths.values());
    const completedPaths = Array.from(this.userPaths.values())
      .filter(p => p.status === 'completed')
      .map(p => p.pathId);

    return paths.filter(path => {
      if (!path.prerequisites || path.prerequisites.length === 0) {
        return true;
      }
      return path.prerequisites.every(prereq => completedPaths.includes(prereq));
    });
  }

  /**
   * Start learning path
   */
  async startLearningPath(pathId) {
    const path = this.getLearningPath(pathId);
    if (!path) {
      return { success: false, reason: 'Path not found' };
    }

    // Check prerequisites
    if (path.prerequisites && path.prerequisites.length > 0) {
      const completedPaths = Array.from(this.userPaths.values())
        .filter(p => p.status === 'completed')
        .map(p => p.pathId);

      const unsatisfied = path.prerequisites.filter(prereq => !completedPaths.includes(prereq));
      if (unsatisfied.length > 0) {
        return {
          success: false,
          reason: 'Prerequisites not satisfied',
          unsatisfied
        };
      }
    }

    const userPath = {
      pathId,
      startedAt: new Date().toISOString(),
      status: 'in-progress',
      progress: 0,
      completedModules: [],
      completedLessons: new Set(),
      assessmentResults: null,
      certificateId: null
    };

    this.userPaths.set(pathId, userPath);
    this.emit('path-started', { pathId });

    return { success: true, path };
  }

  /**
   * Complete lesson
   */
  async completeLesson(pathId, lessonId) {
    const userPath = this.userPaths.get(pathId);
    if (!userPath) {
      return { success: false, reason: 'Path not started' };
    }

    const path = this.getLearningPath(pathId);
    const lesson = this.findLessonInPath(path, lessonId);

    if (!lesson) {
      return { success: false, reason: 'Lesson not found' };
    }

    userPath.completedLessons.add(lessonId);
    userPath.progress = this.calculatePathProgress(path, userPath);

    this.emit('lesson-completed', { pathId, lessonId });

    return { success: true, progress: userPath.progress };
  }

  /**
   * Complete module
   */
  async completeModule(pathId, moduleId) {
    const userPath = this.userPaths.get(pathId);
    if (!userPath) {
      return { success: false, reason: 'Path not started' };
    }

    const path = this.getLearningPath(pathId);
    const module = path.modules.find(m => m.id === moduleId);

    if (!module) {
      return { success: false, reason: 'Module not found' };
    }

    // Check if all lessons in module are completed
    const allLessonsComplete = module.lessons.every(lesson =>
      userPath.completedLessons.has(lesson.id)
    );

    if (!allLessonsComplete) {
      return {
        success: false,
        reason: 'Not all lessons completed in this module'
      };
    }

    userPath.completedModules.push(moduleId);
    userPath.progress = this.calculatePathProgress(path, userPath);

    this.emit('module-completed', { pathId, moduleId });

    return { success: true, progress: userPath.progress };
  }

  /**
   * Take assessment
   */
  async takeAssessment(pathId, answers) {
    const userPath = this.userPaths.get(pathId);
    if (!userPath) {
      return { success: false, reason: 'Path not started' };
    }

    const path = this.getLearningPath(pathId);

    // Simulate assessment grading
    const score = this.gradeAssessment(answers);
    const passed = score >= (path.assessment.passingScore || 70);

    userPath.assessmentResults = {
      score,
      passed,
      completedAt: new Date().toISOString(),
      answers
    };

    if (passed) {
      userPath.status = 'completed';
      const certificateId = await this.issueCertificate(pathId);
      userPath.certificateId = certificateId;
      this.emit('path-completed', { pathId, score, certificateId });
    }

    return {
      success: true,
      score,
      passed,
      certificateId: passed ? userPath.certificateId : null
    };
  }

  /**
   * Grade assessment
   */
  gradeAssessment(answers) {
    // Simulate grading - in real implementation, compare against correct answers
    const correct = Object.values(answers).filter(a => Math.random() > 0.2).length;
    const total = Object.keys(answers).length;
    return Math.round((correct / total) * 100);
  }

  /**
   * Issue certificate
   */
  async issueCertificate(pathId) {
    const path = this.getLearningPath(pathId);
    const certificateId = `CERT-${pathId}-${Date.now()}`;

    const certificate = {
      id: certificateId,
      pathId,
      userId: this.userId,
      name: path.certification.name,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + path.certification.validityMonths * 30 * 24 * 60 * 60 * 1000)
        .toISOString(),
      verificationToken: this.generateToken(),
      level: path.level
    };

    this.certificates.set(certificateId, certificate);
    this.emit('certificate-issued', certificate);

    return certificateId;
  }

  /**
   * Verify certificate
   */
  verifyCertificate(certificateId) {
    const certificate = this.certificates.get(certificateId);
    if (!certificate) {
      return { valid: false, reason: 'Certificate not found' };
    }

    const isExpired = new Date(certificate.expiresAt) < new Date();
    if (isExpired) {
      return { valid: false, reason: 'Certificate expired' };
    }

    return {
      valid: true,
      certificate,
      expiresAt: certificate.expiresAt
    };
  }

  /**
   * Award skill
   */
  awardSkill(skillId) {
    if (!this.assessments.has(skillId)) {
      return { success: false, reason: 'Skill not found' };
    }

    this.userSkills.set(skillId, {
      skillId,
      acquiredAt: new Date().toISOString(),
      proficiency: 'beginner'
    });

    this.emit('skill-awarded', { skillId });
    return { success: true };
  }

  /**
   * Get user skills
   */
  getUserSkills() {
    return Array.from(this.userSkills.values());
  }

  /**
   * Get skill by ID
   */
  getSkill(skillId) {
    return this.assessments.get(skillId);
  }

  /**
   * Get path progress
   */
  getPathProgress(pathId) {
    const userPath = this.userPaths.get(pathId);
    if (!userPath) {
      return null;
    }

    const path = this.getLearningPath(pathId);
    return {
      pathId,
      progress: userPath.progress,
      status: userPath.status,
      completedModules: userPath.completedModules.length,
      totalModules: path.modules.length,
      completedLessons: userPath.completedLessons.size,
      totalLessons: path.modules.reduce((sum, m) => sum + m.lessons.length, 0),
      assessmentResults: userPath.assessmentResults,
      certificateId: userPath.certificateId,
      startedAt: userPath.startedAt
    };
  }

  /**
   * Calculate path progress
   */
  calculatePathProgress(path, userPath) {
    const totalLessons = path.modules.reduce((sum, m) => sum + m.lessons.length, 0);
    const completedLessons = userPath.completedLessons.size;
    return Math.round((completedLessons / totalLessons) * 100);
  }

  /**
   * Find lesson in path
   */
  findLessonInPath(path, lessonId) {
    for (const module of path.modules) {
      const lesson = module.lessons.find(l => l.id === lessonId);
      if (lesson) {
        return lesson;
      }
    }
    return null;
  }

  /**
   * Check milestone
   */
  checkMilestone(trigger, data = {}) {
    const earned = [];

    for (const milestone of this.milestones) {
      if (milestone.trigger === trigger) {
        // Check condition if exists
        if (milestone.condition) {
          let conditionMet = true;
          for (const [key, value] of Object.entries(milestone.condition)) {
            if (data[key] !== value) {
              conditionMet = false;
              break;
            }
          }
          if (!conditionMet) {
            continue;
          }
        }

        earned.push(milestone);
        this.emit('milestone-earned', milestone);
      }
    }

    return earned;
  }

  /**
   * Get learning statistics
   */
  getLearningStats() {
    const stats = {
      pathsStarted: this.userPaths.size,
      pathsCompleted: Array.from(this.userPaths.values()).filter(
        p => p.status === 'completed'
      ).length,
      certificatesEarned: this.certificates.size,
      skillsAcquired: this.userSkills.size,
      totalPointsEarned: this.calculateTotalPoints(),
      averagePathProgress: this.calculateAverageProgress(),
      by_difficulty: this.getStatsByDifficulty()
    };

    return stats;
  }

  /**
   * Calculate total points
   */
  calculateTotalPoints() {
    let points = 0;
    for (const userPath of this.userPaths.values()) {
      if (userPath.status === 'completed') {
        // Find path and add milestone points
        const path = this.getLearningPath(userPath.pathId);
        const milestone = this.milestones.find(m => m.condition?.pathId === userPath.pathId);
        if (milestone) {
          points += milestone.points;
        }
      }
    }
    return points;
  }

  /**
   * Calculate average progress
   */
  calculateAverageProgress() {
    if (this.userPaths.size === 0) {
      return 0;
    }

    const totalProgress = Array.from(this.userPaths.values()).reduce((sum, p) => sum + p.progress, 0);
    return Math.round(totalProgress / this.userPaths.size);
  }

  /**
   * Get statistics by difficulty
   */
  getStatsByDifficulty() {
    const stats = {
      beginner: { started: 0, completed: 0 },
      intermediate: { started: 0, completed: 0 },
      advanced: { started: 0, completed: 0 }
    };

    for (const userPath of this.userPaths.values()) {
      const path = this.getLearningPath(userPath.pathId);
      if (stats[path.level]) {
        stats[path.level].started++;
        if (userPath.status === 'completed') {
          stats[path.level].completed++;
        }
      }
    }

    return stats;
  }

  /**
   * Generate verification token
   */
  generateToken() {
    return Buffer.from(`${this.userId}-${Date.now()}`).toString('base64');
  }

  /**
   * Export learning profile
   */
  exportProfile() {
    return {
      userId: this.userId,
      paths: this.getLearningStats(),
      skills: this.getUserSkills(),
      certificates: Array.from(this.certificates.values()),
      milestones: this.milestones.filter(m => m.earned),
      exportedAt: new Date().toISOString()
    };
  }
}

module.exports = LearningPath;
