/**
 * Certification Engine
 *
 * Manages user competency assessment, certification exams, certificates,
 * skill endorsements, and training validation.
 */

const EventEmitter = require('events');

class CertificationEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.userId = options.userId || null;
    this.exams = new Map();
    this.userCertifications = new Map();
    this.skillEndorsements = new Map();
    this.examResults = new Map();
    this.trainingCertificates = new Map();
    this.initializeExams();
  }

  /**
   * Initialize certification exams
   */
  initializeExams() {
    const exams = [
      {
        id: 'exam-basic-monitoring',
        name: 'Basic Monitoring Certified',
        level: 'basic',
        topic: 'Monitoring Fundamentals',
        description: 'Validates fundamental understanding of monitor creation and configuration',
        passingScore: 70,
        timeLimit: 30,
        questionCount: 20,
        examFee: 0,
        certificateValid: 12,
        skills: [
          'dashboard-navigation',
          'monitor-creation',
          'alert-configuration',
          'notification-setup'
        ],
        questions: [
          {
            id: 'q-1',
            type: 'multiple-choice',
            question: 'What is the primary purpose of a monitor?',
            options: [
              'To track website changes in real-time',
              'To block advertisements',
              'To increase website speed',
              'To manage user accounts'
            ],
            correctAnswer: 0,
            points: 1
          },
          {
            id: 'q-2',
            type: 'multiple-choice',
            question: 'Which detection type is best for monitoring price changes?',
            options: ['Visual Detection', 'Text Detection', 'Element Detection', 'All equally good'],
            correctAnswer: 1,
            points: 1
          },
          {
            id: 'q-3',
            type: 'true-false',
            question: 'You can monitor multiple URLs with a single monitor',
            correctAnswer: false,
            points: 1
          },
          {
            id: 'q-4',
            type: 'multiple-choice',
            question: 'What is the main advantage of element-specific monitoring?',
            options: [
              'Faster detection speed',
              'Lower CPU usage',
              'More precise monitoring',
              'Better accuracy'
            ],
            correctAnswer: 2,
            points: 1
          },
          {
            id: 'q-5',
            type: 'fill-in-blank',
            question:
              'The frequency at which a monitor checks for changes is called the __________',
            correctAnswer: ['check frequency', 'frequency', 'interval'],
            points: 1
          }
        ]
      },
      {
        id: 'exam-advanced-monitoring',
        name: 'Advanced Monitoring Certified',
        level: 'advanced',
        topic: 'Advanced Monitoring Techniques',
        description: 'Validates proficiency in advanced monitoring, proxies, and optimization',
        passingScore: 75,
        timeLimit: 60,
        questionCount: 30,
        examFee: 49,
        certificateValid: 12,
        prerequisites: ['exam-basic-monitoring'],
        skills: [
          'detection-methods',
          'proxy-configuration',
          'css-selectors',
          'xpath-expressions',
          'regex-patterns',
          'performance-optimization'
        ],
        questions: [
          {
            id: 'q-1',
            type: 'multiple-choice',
            question: 'What does SOCKS5 proxy stand for?',
            options: [
              'Socket Secure version 5',
              'Socket Service 5',
              'Source of Control System 5',
              'Secure Online Connection Kit 5'
            ],
            correctAnswer: 0,
            points: 1
          },
          {
            id: 'q-2',
            type: 'multiple-choice',
            question: 'Which CSS selector selects elements by class name?',
            options: ['.classname', '#classname', '@classname', '~classname'],
            correctAnswer: 0,
            points: 1
          },
          {
            id: 'q-3',
            type: 'code',
            question: 'Write a CSS selector to select all paragraphs inside a div with ID "main"',
            correctAnswers: ['#main p', '#main > p', '#main p:not(...)'],
            points: 2
          },
          {
            id: 'q-4',
            type: 'scenario',
            question:
              'You need to monitor a price that updates dynamically. What detection type would you choose and why?',
            correctAnswers: [
              'Element detection because it is precise',
              'CSS selector to target specific element',
              'Text detection to capture the price'
            ],
            points: 2
          }
        ]
      },
      {
        id: 'exam-expert-certification',
        name: 'Expert Monitoring & Optimization',
        level: 'expert',
        topic: 'System Mastery and Optimization',
        description: 'Validates expert-level knowledge of system optimization and advanced features',
        passingScore: 80,
        timeLimit: 90,
        questionCount: 40,
        examFee: 99,
        certificateValid: 24,
        prerequisites: ['exam-advanced-monitoring'],
        skills: [
          'system-architecture',
          'performance-tuning',
          'evasion-techniques',
          'api-integration',
          'automation-workflows',
          'large-scale-monitoring'
        ],
        questions: [
          {
            id: 'q-1',
            type: 'scenario',
            question:
              'Design a monitoring solution for 10,000 URLs. What architectural considerations are important?',
            correctAnswers: [
              'Distributed architecture',
              'Load balancing',
              'Caching strategy',
              'Resource optimization',
              'Scalability planning'
            ],
            points: 5
          },
          {
            id: 'q-2',
            type: 'code',
            question: 'Write a regex pattern to extract prices in the format $XX.XX',
            correctAnswers: ['\\$\\d+\\.\\d{2}', '\\$[0-9]+\\.[0-9]{2}'],
            points: 3
          }
        ]
      }
    ];

    for (const exam of exams) {
      this.exams.set(exam.id, exam);
    }
  }

  /**
   * Get exam by ID
   */
  getExam(examId) {
    return this.exams.get(examId);
  }

  /**
   * Get all exams
   */
  getAllExams() {
    return Array.from(this.exams.values());
  }

  /**
   * Get available exams for user
   */
  getAvailableExams() {
    const exams = Array.from(this.exams.values());
    const completedExams = Array.from(this.examResults.values())
      .filter(r => r.passed)
      .map(r => r.examId);

    return exams.filter(exam => {
      if (!exam.prerequisites || exam.prerequisites.length === 0) {
        return true;
      }
      return exam.prerequisites.every(prereq => completedExams.includes(prereq));
    });
  }

  /**
   * Start exam
   */
  async startExam(examId) {
    const exam = this.getExam(examId);
    if (!exam) {
      return { success: false, reason: 'Exam not found' };
    }

    // Check prerequisites
    if (exam.prerequisites && exam.prerequisites.length > 0) {
      const completedExams = Array.from(this.examResults.values())
        .filter(r => r.passed)
        .map(r => r.examId);

      const unsatisfied = exam.prerequisites.filter(prereq => !completedExams.includes(prereq));
      if (unsatisfied.length > 0) {
        return {
          success: false,
          reason: 'Prerequisites not met',
          unsatisfied
        };
      }
    }

    const examSession = {
      examId,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + exam.timeLimit * 60 * 1000),
      answers: {},
      currentQuestion: 0,
      flagged: new Set(),
      status: 'in-progress'
    };

    this.emit('exam-started', { examId, expiresAt: examSession.expiresAt });
    return {
      success: true,
      exam,
      session: examSession,
      questions: exam.questions
    };
  }

  /**
   * Submit answer to question
   */
  submitAnswer(examId, questionId, answer) {
    const exam = this.getExam(examId);
    if (!exam) {
      return { success: false, reason: 'Exam not found' };
    }

    const question = exam.questions.find(q => q.id === questionId);
    if (!question) {
      return { success: false, reason: 'Question not found' };
    }

    // Store answer
    const result = {
      questionId,
      submittedAnswer: answer,
      correct: this.checkAnswer(question, answer),
      pointsEarned: 0
    };

    if (result.correct) {
      result.pointsEarned = question.points || 1;
    }

    return { success: true, result };
  }

  /**
   * Check if answer is correct
   */
  checkAnswer(question, answer) {
    if (question.type === 'multiple-choice' || question.type === 'true-false') {
      return question.correctAnswer === answer;
    }

    if (question.type === 'fill-in-blank') {
      if (Array.isArray(question.correctAnswer)) {
        return question.correctAnswer.includes(answer.toLowerCase());
      }
      return question.correctAnswer.toLowerCase() === answer.toLowerCase();
    }

    if (question.type === 'code' || question.type === 'scenario') {
      // For code and scenario questions, would need manual grading
      return false; // Placeholder
    }

    return false;
  }

  /**
   * Flag question for review
   */
  flagQuestion(examId, questionId) {
    this.emit('question-flagged', { examId, questionId });
    return { success: true };
  }

  /**
   * Submit exam for grading
   */
  async submitExam(examId, answers) {
    const exam = this.getExam(examId);
    if (!exam) {
      return { success: false, reason: 'Exam not found' };
    }

    // Grade exam
    let totalPoints = 0;
    let earnedPoints = 0;
    const questionScores = [];

    for (const question of exam.questions) {
      const answer = answers[question.id];
      const points = question.points || 1;
      const correct = this.checkAnswer(question, answer);

      totalPoints += points;
      if (correct) {
        earnedPoints += points;
      }

      questionScores.push({
        questionId: question.id,
        correct,
        points,
        earnedPoints: correct ? points : 0
      });
    }

    const percentage = Math.round((earnedPoints / totalPoints) * 100);
    const passed = percentage >= exam.passingScore;

    const result = {
      examId,
      userId: this.userId,
      submittedAt: new Date().toISOString(),
      score: percentage,
      earnedPoints,
      totalPoints,
      passed,
      certificateId: null,
      questionScores
    };

    if (passed) {
      const certificateId = await this.issueCertificate(exam, percentage);
      result.certificateId = certificateId;

      // Award skills
      for (const skill of exam.skills) {
        this.endorseSkill(skill, 'exam-completion', exam.level);
      }
    }

    this.examResults.set(examId, result);
    this.emit('exam-submitted', result);

    return { success: true, result };
  }

  /**
   * Issue certification
   */
  async issueCertificate(exam, score) {
    const certificateId = `CERT-${exam.id}-${this.userId}-${Date.now()}`;

    const certificate = {
      id: certificateId,
      examId: exam.id,
      userId: this.userId,
      name: exam.name,
      level: exam.level,
      topic: exam.topic,
      score,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + exam.certificateValid * 30 * 24 * 60 * 60 * 1000)
        .toISOString(),
      verificationToken: this.generateToken(),
      badgeUrl: `/badges/${exam.id}.png`,
      shareable: true
    };

    this.userCertifications.set(certificateId, certificate);
    this.emit('certificate-issued', certificate);

    return certificateId;
  }

  /**
   * Verify certificate
   */
  verifyCertificate(certificateId) {
    const certificate = this.userCertifications.get(certificateId);
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
   * Endorse skill
   */
  endorseSkill(skillId, reason = 'manual', level = 'intermediate') {
    if (!this.skillEndorsements.has(skillId)) {
      this.skillEndorsements.set(skillId, {
        skillId,
        endorsements: [],
        level: 'novice',
        endorsementCount: 0
      });
    }

    const endorsement = {
      endorsedAt: new Date().toISOString(),
      reason,
      level
    };

    const skill = this.skillEndorsements.get(skillId);
    skill.endorsements.push(endorsement);
    skill.endorsementCount++;

    // Update skill level based on endorsements
    if (skill.endorsementCount >= 3) {
      skill.level = 'proficient';
    }
    if (skill.endorsementCount >= 5) {
      skill.level = 'expert';
    }

    this.emit('skill-endorsed', { skillId, level: skill.level });
    return { success: true, skill };
  }

  /**
   * Get user skills and endorsements
   */
  getUserSkills() {
    return Array.from(this.skillEndorsements.values());
  }

  /**
   * Get user certifications
   */
  getUserCertifications() {
    return Array.from(this.userCertifications.values()).filter(c => {
      const isExpired = new Date(c.expiresAt) < new Date();
      return !isExpired;
    });
  }

  /**
   * Get certification status
   */
  getCertificationStatus() {
    const exams = this.getAllExams();
    const results = Array.from(this.examResults.values());
    const certifications = this.getUserCertifications();

    const status = {
      totalExams: exams.length,
      passedExams: results.filter(r => r.passed).length,
      activeCertifications: certifications.length,
      examResults: results,
      certificates: certifications,
      skills: this.getUserSkills(),
      byLevel: {
        basic: results.filter(r => r.passed && this.getExam(r.examId).level === 'basic').length,
        advanced: results.filter(r => r.passed && this.getExam(r.examId).level === 'advanced')
          .length,
        expert: results.filter(r => r.passed && this.getExam(r.examId).level === 'expert').length
      }
    };

    return status;
  }

  /**
   * Get exam result
   */
  getExamResult(examId) {
    return this.examResults.get(examId);
  }

  /**
   * Get badge URL
   */
  getBadgeUrl(examId) {
    const exam = this.getExam(examId);
    if (!exam) {
      return null;
    }
    return `/badges/${examId}.png`;
  }

  /**
   * Generate verification token
   */
  generateToken() {
    return Buffer.from(`${this.userId}-${Date.now()}`).toString('base64');
  }

  /**
   * Share certification
   */
  shareCertification(certificateId) {
    const certificate = this.userCertifications.get(certificateId);
    if (!certificate) {
      return { success: false, reason: 'Certificate not found' };
    }

    const shareUrl = `https://verify.example.com/${certificateId}`;
    const linkedInUrl = `https://www.linkedin.com/add-to-profile/official-school-page?schoolId=XXXXX&official_school_certifications_detail_id=${certificateId}`;

    return {
      success: true,
      shareUrl,
      linkedInUrl,
      twitterShare: `I just earned the "${certificate.name}" certification! 🎓 #monitoring #certification`,
      emailShare: `I've been certified as "${certificate.name}". Learn more: ${shareUrl}`
    };
  }

  /**
   * Get certification analytics
   */
  getCertificationAnalytics() {
    const exams = this.getAllExams();
    const results = Array.from(this.examResults.values());
    const certifications = this.getUserCertifications();

    const analytics = {
      totalExamsTaken: results.length,
      totalExamsPassed: results.filter(r => r.passed).length,
      totalExamsFailed: results.filter(r => !r.passed).length,
      averageScore: this.calculateAverageScore(results),
      certificationsEarned: certifications.length,
      skillsEndorsed: this.skillEndorsements.size,
      certificationsByLevel: {
        basic: certifications.filter(c => c.level === 'basic').length,
        advanced: certifications.filter(c => c.level === 'advanced').length,
        expert: certifications.filter(c => c.level === 'expert').length
      },
      passingRate:
        results.length > 0
          ? Math.round((results.filter(r => r.passed).length / results.length) * 100)
          : 0,
      skillsByLevel: {
        novice: Array.from(this.skillEndorsements.values()).filter(s => s.level === 'novice')
          .length,
        proficient: Array.from(this.skillEndorsements.values()).filter(s => s.level === 'proficient')
          .length,
        expert: Array.from(this.skillEndorsements.values()).filter(s => s.level === 'expert')
          .length
      }
    };

    return analytics;
  }

  /**
   * Calculate average score
   */
  calculateAverageScore(results) {
    if (results.length === 0) {
      return 0;
    }
    const total = results.reduce((sum, r) => sum + r.score, 0);
    return Math.round(total / results.length);
  }

  /**
   * Export certification profile
   */
  exportProfile() {
    return {
      userId: this.userId,
      certifications: this.getUserCertifications(),
      skills: this.getUserSkills(),
      analytics: this.getCertificationAnalytics(),
      examResults: Array.from(this.examResults.values()),
      exportedAt: new Date().toISOString()
    };
  }
}

module.exports = CertificationEngine;
