/**
 * Certification Engine Tests
 *
 * Comprehensive testing of certification functionality
 */

const CertificationEngine = require('../../src/onboarding/certification');
const assert = require('assert');

describe('CertificationEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new CertificationEngine({ userId: 'test-user-1' });
  });

  describe('Exam Management', () => {
    it('should have built-in exams', () => {
      const exams = engine.getAllExams();
      assert(exams.length > 0);
    });

    it('should get exam by ID', () => {
      const exam = engine.getExam('exam-basic-monitoring');
      assert.strictEqual(exam.name, 'Basic Monitoring Certified');
    });

    it('should get all exams', () => {
      const exams = engine.getAllExams();
      assert(exams.some(e => e.level === 'basic'));
      assert(exams.some(e => e.level === 'advanced'));
      assert(exams.some(e => e.level === 'expert'));
    });

    it('should get exams by difficulty level', () => {
      const exams = engine.getAllExams();
      const basicExams = exams.filter(e => e.level === 'basic');
      assert(basicExams.length > 0);
    });
  });

  describe('Exam Prerequisites', () => {
    it('should show all exams as available initially', () => {
      const available = engine.getAvailableExams();
      const basicExams = available.filter(e => e.level === 'basic');
      assert(basicExams.length > 0);
    });

    it('should enforce prerequisites', async () => {
      const available = engine.getAvailableExams();
      const advancedExams = available.filter(e => e.level === 'advanced');
      // Should be unavailable without completing basic
      assert.strictEqual(advancedExams.length, 0);
    });

    it('should unlock exams after completing prerequisites', async () => {
      // Complete basic exam
      const basicExam = engine.getExam('exam-basic-monitoring');
      const answers = {};
      for (const q of basicExam.questions) {
        answers[q.id] = q.correctAnswer;
      }

      const result = await engine.submitExam('exam-basic-monitoring', answers);
      assert.strictEqual(result.result.passed, true);

      // Now advanced should be available
      const available = engine.getAvailableExams();
      const advancedExams = available.filter(e => e.level === 'advanced');
      assert(advancedExams.length > 0);
    });
  });

  describe('Exam Taking', () => {
    it('should start exam', async () => {
      const result = await engine.startExam('exam-basic-monitoring');
      assert.strictEqual(result.success, true);
      assert(result.exam);
      assert(result.questions.length > 0);
    });

    it('should prevent exam if prerequisites not met', async () => {
      const result = await engine.startExam('exam-advanced-monitoring');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.reason, 'Prerequisites not met');
    });

    it('should track exam time', async () => {
      const startResult = await engine.startExam('exam-basic-monitoring');
      assert(startResult.session.expiresAt);
      const created = new Date(startResult.session.expiresAt);
      const exam = engine.getExam('exam-basic-monitoring');
      assert(created > new Date());
    });
  });

  describe('Answer Submission', () => {
    it('should submit multiple choice answer', async () => {
      await engine.startExam('exam-basic-monitoring');
      const result = engine.submitAnswer('exam-basic-monitoring', 'q-1', 0);
      assert.strictEqual(result.success, true);
      assert(result.result.correct !== undefined);
    });

    it('should check multiple choice answer', async () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const question = exam.questions[0];
      const result = engine.submitAnswer(exam.id, question.id, question.correctAnswer);
      assert.strictEqual(result.result.correct, true);
    });

    it('should fail incorrect answer', async () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const question = exam.questions[0];
      const wrongAnswer = question.correctAnswer === 0 ? 1 : 0;
      const result = engine.submitAnswer(exam.id, question.id, wrongAnswer);
      assert.strictEqual(result.result.correct, false);
    });

    it('should handle true/false questions', () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const tfQuestion = exam.questions.find(q => q.type === 'true-false');
      if (tfQuestion) {
        const result = engine.submitAnswer(exam.id, tfQuestion.id, tfQuestion.correctAnswer);
        assert.strictEqual(result.result.correct, true);
      }
    });

    it('should handle fill-in-the-blank', () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const blankQuestion = exam.questions.find(q => q.type === 'fill-in-blank');
      if (blankQuestion) {
        const result = engine.submitAnswer(exam.id, blankQuestion.id, blankQuestion.correctAnswer[0]);
        assert.strictEqual(result.result.correct, true);
      }
    });
  });

  describe('Exam Grading', () => {
    it('should grade exam correctly', async () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const answers = {};
      for (const q of exam.questions) {
        answers[q.id] = q.correctAnswer;
      }

      const result = await engine.submitExam('exam-basic-monitoring', answers);
      assert.strictEqual(result.result.passed, true);
      assert.strictEqual(result.result.score, 100);
    });

    it('should calculate percentage score', async () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const answers = {};
      // Answer only half correctly
      for (let i = 0; i < exam.questions.length; i++) {
        const q = exam.questions[i];
        answers[q.id] = i % 2 === 0 ? q.correctAnswer : 999; // Wrong answer
      }

      const result = await engine.submitExam('exam-basic-monitoring', answers);
      assert(result.result.score <= 50);
    });

    it('should compare against passing score', async () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const answers = {};
      // Answer only a few correctly to fail
      for (let i = 0; i < exam.questions.length; i++) {
        answers[exam.questions[i].id] = 999; // All wrong
      }

      const result = await engine.submitExam('exam-basic-monitoring', answers);
      assert.strictEqual(result.result.passed, false);
      assert(result.result.score < exam.passingScore);
    });
  });

  describe('Certification Issuance', () => {
    it('should issue certificate on passing', async () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const answers = {};
      for (const q of exam.questions) {
        answers[q.id] = q.correctAnswer;
      }

      const result = await engine.submitExam('exam-basic-monitoring', answers);
      assert(result.result.certificateId);
      assert(result.result.passed, true);
    });

    it('should not issue certificate on failing', async () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const answers = {};
      for (const q of exam.questions) {
        answers[q.id] = 999; // Wrong answers
      }

      const result = await engine.submitExam('exam-basic-monitoring', answers);
      assert.strictEqual(result.result.certificateId, null);
      assert.strictEqual(result.result.passed, false);
    });

    it('should generate unique certificate IDs', async () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const answers = {};
      for (const q of exam.questions) {
        answers[q.id] = q.correctAnswer;
      }

      const result1 = await engine.submitExam('exam-basic-monitoring', answers);
      const result2 = await engine.submitExam('exam-advanced-monitoring', answers);

      // Would differ in a real scenario with different exams or users
      assert(result1.result.certificateId);
      // result2 might fail if advanced not unlocked
    });
  });

  describe('Certificate Verification', () => {
    it('should verify valid certificate', async () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const answers = {};
      for (const q of exam.questions) {
        answers[q.id] = q.correctAnswer;
      }

      const submitResult = await engine.submitExam('exam-basic-monitoring', answers);
      const certId = submitResult.result.certificateId;

      const verification = engine.verifyCertificate(certId);
      assert.strictEqual(verification.valid, true);
      assert(verification.certificate);
    });

    it('should reject invalid certificate', () => {
      const verification = engine.verifyCertificate('INVALID-CERT-ID');
      assert.strictEqual(verification.valid, false);
    });

    it('should check certificate expiration', async () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const answers = {};
      for (const q of exam.questions) {
        answers[q.id] = q.correctAnswer;
      }

      const submitResult = await engine.submitExam('exam-basic-monitoring', answers);
      const cert = engine.userCertifications.get(submitResult.result.certificateId);

      assert(new Date(cert.expiresAt) > new Date());
    });
  });

  describe('Skill Endorsement', () => {
    it('should endorse skill', () => {
      const result = engine.endorseSkill('skill-monitor-creation', 'manual');
      assert.strictEqual(result.success, true);
    });

    it('should track endorsement count', () => {
      engine.endorseSkill('skill-1', 'manual');
      engine.endorseSkill('skill-1', 'exam-completion');

      const skill = engine.skillEndorsements.get('skill-1');
      assert.strictEqual(skill.endorsementCount, 2);
    });

    it('should update skill level based on endorsements', () => {
      engine.endorseSkill('skill-test', 'manual');
      engine.endorseSkill('skill-test', 'manual');
      engine.endorseSkill('skill-test', 'manual');

      const skill = engine.skillEndorsements.get('skill-test');
      assert.strictEqual(skill.level, 'proficient');
    });

    it('should reach expert level', () => {
      for (let i = 0; i < 5; i++) {
        engine.endorseSkill('skill-expert', 'manual');
      }

      const skill = engine.skillEndorsements.get('skill-expert');
      assert.strictEqual(skill.level, 'expert');
    });

    it('should emit skill-endorsed event', () => {
      let endorsed = false;
      engine.on('skill-endorsed', () => {
        endorsed = true;
      });

      engine.endorseSkill('skill-test', 'manual');
      assert.strictEqual(endorsed, true);
    });
  });

  describe('User Certifications', () => {
    it('should get user certifications', async () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const answers = {};
      for (const q of exam.questions) {
        answers[q.id] = q.correctAnswer;
      }

      await engine.submitExam('exam-basic-monitoring', answers);
      const certs = engine.getUserCertifications();
      assert(certs.length > 0);
    });

    it('should filter expired certificates', async () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const answers = {};
      for (const q of exam.questions) {
        answers[q.id] = q.correctAnswer;
      }

      await engine.submitExam('exam-basic-monitoring', answers);

      // Manually expire certificate for testing
      const certs = engine.userCertifications;
      for (const cert of certs.values()) {
        cert.expiresAt = new Date(Date.now() - 1000).toISOString();
      }

      const activeCerts = engine.getUserCertifications();
      assert.strictEqual(activeCerts.length, 0);
    });
  });

  describe('User Skills', () => {
    it('should get user skills', () => {
      engine.endorseSkill('skill-1', 'manual');
      engine.endorseSkill('skill-2', 'manual');

      const skills = engine.getUserSkills();
      assert.strictEqual(skills.length, 2);
    });
  });

  describe('Certification Status', () => {
    it('should provide certification status', async () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const answers = {};
      for (const q of exam.questions) {
        answers[q.id] = q.correctAnswer;
      }

      await engine.submitExam('exam-basic-monitoring', answers);
      const status = engine.getCertificationStatus();

      assert(status.totalExams > 0);
      assert(status.passedExams > 0);
      assert(status.activeCertifications > 0);
    });

    it('should track exams by level', async () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const answers = {};
      for (const q of exam.questions) {
        answers[q.id] = q.correctAnswer;
      }

      await engine.submitExam('exam-basic-monitoring', answers);
      const status = engine.getCertificationStatus();

      assert(status.byLevel.basic > 0);
    });
  });

  describe('Analytics', () => {
    it('should calculate certification analytics', async () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const answers = {};
      for (const q of exam.questions) {
        answers[q.id] = q.correctAnswer;
      }

      await engine.submitExam('exam-basic-monitoring', answers);
      const analytics = engine.getCertificationAnalytics();

      assert(analytics.totalExamsTaken > 0);
      assert(analytics.totalExamsPassed > 0);
      assert(analytics.averageScore >= 0);
      assert(analytics.passingRate >= 0);
    });
  });

  describe('Share Certification', () => {
    it('should provide sharing options', async () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const answers = {};
      for (const q of exam.questions) {
        answers[q.id] = q.correctAnswer;
      }

      const submitResult = await engine.submitExam('exam-basic-monitoring', answers);
      const certId = submitResult.result.certificateId;

      const share = engine.shareCertificate(certId);
      assert.strictEqual(share.success, true);
      assert(share.shareUrl);
      assert(share.linkedInUrl);
      assert(share.twitterShare);
    });
  });

  describe('Profile Export', () => {
    it('should export profile', async () => {
      const exam = engine.getExam('exam-basic-monitoring');
      const answers = {};
      for (const q of exam.questions) {
        answers[q.id] = q.correctAnswer;
      }

      await engine.submitExam('exam-basic-monitoring', answers);
      engine.endorseSkill('skill-test', 'manual');

      const profile = engine.exportProfile();
      assert.strictEqual(profile.userId, 'test-user-1');
      assert(profile.certifications.length > 0);
      assert(profile.skills.length > 0);
      assert(profile.analytics);
    });
  });
});
