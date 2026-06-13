# Playbook Training Guide

**Document Version:** 1.0  
**Last Updated:** June 13, 2026  
**Classification:** Internal Operations  

---

## Executive Summary

This guide provides training paths for different roles and team members to become proficient with operational playbooks.

---

## Training Paths by Role

### Path 1: On-Call Engineer (L1)

**Duration:** 4 hours  
**Frequency:** Quarterly refresher

#### Learning Objectives

- [ ] Understand incident severity levels
- [ ] Know when to escalate (timing & criteria)
- [ ] Perform initial triage of common issues
- [ ] Use diagnostic tools effectively
- [ ] Communicate clearly in war rooms
- [ ] Document incidents properly

#### Curriculum

**Module 1: Incident Basics (30 min)**
- Read: `/docs/operations/INCIDENT-RESPONSE-PLAN.md`
- Learn: Severity levels, response SLAs, escalation paths
- Quiz: Can you define P1/P2/P3?

**Module 2: Common Issues Diagnosis (1.5 hours)**
- Read: `/docs/operations/ON-CALL-EXTENDED-RUNBOOK.md`
- Lab: Run diagnostic commands on test environment
  - [ ] Check API health
  - [ ] Review application logs
  - [ ] Monitor CPU/memory
  - [ ] Check database connectivity
- Exercise: "API returns 503" - walk through diagnosis

**Module 3: Specific Incident Playbooks (1.5 hours)**
- Read (choose 2):
  - `/docs/operations/HIGH-LATENCY-INCIDENT.md`
  - `/docs/operations/HIGH-ERROR-RATE-INCIDENT.md`
- Lab: Run through scenario on test system
- Exercise: Respond to simulated alert

**Module 4: War Room Fundamentals (30 min)**
- Read: `/docs/operations/WAR-ROOM-PROCEDURES.md`
- Learn: Your role in war room, communication expectations
- Watch: Recording of previous incident (if available)
- Exercise: Mock war room (15 min)

**Module 5: Escalation & Judgment (30 min)**
- Read: Escalation matrix in playbooks
- Learn: How to decide when to escalate
- Exercise: Case studies (when to escalate?)

#### Verification

**Certification requirements:**
- [ ] Pass incident severity quiz (90%+)
- [ ] Complete diagnostic lab
- [ ] Participate in mock incident
- [ ] Shadow one real incident

---

### Path 2: Engineering Lead / L2

**Duration:** 6 hours  
**Frequency:** Quarterly refresher

#### Additional Learning Objectives

- [ ] Deep diagnostic of application issues
- [ ] Root cause analysis (5 whys)
- [ ] Decision-making during incidents
- [ ] Running effective war rooms
- [ ] Postmortem facilitation
- [ ] Coaching L1 engineers

#### Curriculum

**All L1 modules, plus:**

**Module 6: Advanced Diagnostics (2 hours)**
- Code review of recent incidents
- Profiling tools (CPU, memory, network)
- Database query optimization
- Performance analysis techniques

**Module 7: War Room Leadership (1 hour)**
- Incident command system (ICS)
- Decision-making frameworks
- Risk assessment
- Escalation judgment

**Module 8: Postmortem Leadership (1 hour)**
- Blameless postmortem culture
- 5-why root cause analysis
- Identifying prevention measures
- Tracking action items

#### Verification

- [ ] Pass all L1 requirements
- [ ] Lead a war room (supervised)
- [ ] Conduct a postmortem
- [ ] Mentor an L1 engineer

---

### Path 3: Infrastructure Lead / L3

**Duration:** 8 hours  
**Frequency:** Quarterly refresher

#### Additional Learning Objectives

- [ ] Emergency change authorization
- [ ] System architecture understanding
- [ ] Rollback decisions
- [ ] Database recovery procedures
- [ ] Crisis communication
- [ ] Team leadership during incidents

#### Curriculum

**All L2 modules, plus:**

**Module 9: Deployment & Rollback (2 hours)**
- Read: Deployment playbooks
- Lab: Test rollback procedures
- Exercise: Rollback decision simulation

**Module 10: Database Emergency Procedures (1.5 hours)**
- Read: Database Migration Playbook, Data Loss Incident
- Lab: Test backup/restore procedures
- Exercise: Recovery scenario

**Module 11: Security & Legal (1 hour)**
- Read: Security Incident Playbook
- Learn: Legal obligations, breach notification
- Coordinate with legal team

**Module 12: Executive Communication (1 hour)**
- Crisis communication templates
- What to tell CEO vs. customers
- Managing expectations

#### Verification

- [ ] Pass all L2 requirements
- [ ] Authorize an emergency rollback
- [ ] Run a data recovery drill
- [ ] Lead incident with external communication

---

### Path 4: Manager / Incident Coordinator

**Duration:** 4 hours  
**Frequency:** Quarterly

#### Learning Objectives

- [ ] Understand all incident types
- [ ] Manage incident progression
- [ ] Communicate with executives
- [ ] Allocate resources
- [ ] Track postmortem action items

#### Curriculum

**Module 1: Incident Framework (1 hour)**
- Overview of all incident types
- Severity levels and escalation
- Your role as coordinator

**Module 2: Stakeholder Management (1 hour)**
- Executive communication
- Customer communication
- Team coordination

**Module 3: Postmortem & Learning (1 hour)**
- Postmortem process
- Action item tracking
- Prevention planning

**Module 4: Tools & Systems (1 hour)**
- Incident management system
- Status page updates
- Communication channels

---

## Training Delivery Methods

### Classroom Training (2 hours)

**Quarterly training sessions:**
- Review key concepts
- Walk through recent incidents
- Answer questions
- Practice war room communication

**Attendance:** Required for all on-call staff

### Self-Paced Learning (4 hours)

**Available anytime:**
- Read all playbooks
- Work through labs
- Watch incident recordings
- Study case studies

### Hands-On Labs (2 hours)

**Monthly rotating schedule:**
- Set up test environment
- Practice diagnostics
- Simulate incidents
- Try recovery procedures

**Lab scenarios:**
1. **API crashes** - Restart, debug, verify
2. **High latency** - Identify bottleneck, optimize
3. **Error spike** - Diagnose root cause, implement fix
4. **Database issues** - Connection pool, slow queries, locks
5. **Deployment rollback** - Trigger, execute, verify

### Incident Participation

**Real incident experience:**
- Shadow experienced responder (2 incidents)
- Participate as L1 (with mentor) (2 incidents)
- Run incident independently (supervised) (1 incident)
- Full authority (after certification)

### Quarterly Drills

**Mock incidents:**
- Every quarter: 30-minute simulated incident
- All on-call staff participate
- Graded on response, communication, decision-making
- Feedback session afterward

**Drill scenarios:**
- Q1: High latency incident
- Q2: Application error spike
- Q3: Database emergency
- Q4: Multi-system cascade failure

---

## Certification Requirements

### L1 (On-Call Engineer) Certification

**Requirements:**
- [ ] Pass severity level quiz (90%+)
- [ ] Complete diagnostic lab exercises
- [ ] Pass war room simulation
- [ ] Shadow 1 real incident
- [ ] Certifier approval (L2 engineer)

**Valid for:** 1 year  
**Renewal:** Quarterly refresher + re-test

### L2 (Engineering Lead) Certification

**Requirements:**
- [ ] Complete L1 + L2 curriculum
- [ ] Pass advanced diagnostics lab
- [ ] Lead supervised war room
- [ ] Conduct postmortem
- [ ] Certifier approval (L3 engineer)

**Valid for:** 1 year  
**Renewal:** Quarterly refresher + participation audit

### L3 (Infrastructure Lead) Certification

**Requirements:**
- [ ] Complete all curriculum
- [ ] Authorize emergency change (supervised)
- [ ] Lead data recovery drill
- [ ] Participate in quarterly executive briefing
- [ ] Certifier approval (VP Engineering or CTO)

**Valid for:** 2 years  
**Renewal:** Annual recertification + training update

---

## Learning Resources

### Documentation

- **Incident Response Plan:** `/docs/operations/INCIDENT-RESPONSE-PLAN.md`
- **Specific Playbooks:** `/docs/operations/[INCIDENT]-INCIDENT.md`
- **Deployment Playbooks:** `/docs/deployment/[TYPE]-PLAYBOOK.md`
- **On-Call Runbook:** `/docs/operations/ON-CALL-EXTENDED-RUNBOOK.md`
- **War Room Procedures:** `/docs/operations/WAR-ROOM-PROCEDURES.md`

### Online Tools

- **Status Page:** https://status.basset-hound.io
- **Incident Tracker:** [Link to system]
- **Monitoring Dashboard:** https://grafana.prod.example.com
- **Log Aggregation:** https://kibana.prod.example.com

### Recordings

- **Incident Walkthroughs:** [Video archive]
- **Postmortem Recordings:** [Video archive]
- **War Room Examples:** [Video archive]

### Contacts

- **Training Coordinator:** __________
- **L2 Mentor:** __________
- **L3 Mentor:** __________

---

## Feedback & Improvement

### Feedback Collection

After each incident:
- [ ] L1 fills out response survey
- [ ] War room participants complete evaluation
- [ ] Feedback reviewed in postmortem

**Survey questions:**
1. Did playbooks help? (1-5)
2. Missing information? (text)
3. What was confusing? (text)
4. How to improve? (text)

### Continuous Improvement

**Quarterly review:**
- Aggregate feedback from all incidents
- Update playbooks based on feedback
- Highlight new lessons learned
- Share improvements with team

---

## New Hire Onboarding

### Week 1: Orientation

- [ ] Read incident response plan
- [ ] Overview of severity levels
- [ ] Introduction to tools
- [ ] Meet mentors

### Week 2-3: Training

- [ ] Start L1 curriculum
- [ ] Set up dev environment
- [ ] Practice diagnostics
- [ ] Shadow incident (if available)

### Week 4: Evaluation

- [ ] Certification quiz (with help)
- [ ] Supervised war room
- [ ] Ready for L1 status (with on-call mentor)

### Month 2-3: Experience

- [ ] Participate in incidents (with mentor)
- [ ] Build proficiency
- [ ] Clear certification

### Month 3+: Full Duty

- [ ] Independent L1 on-call
- [ ] Continue quarterly training
- [ ] Path to L2/L3

---

## Knowledge Base Development

**As team grows, document:**
- [ ] Common issues specific to your system
- [ ] Historical incidents and lessons
- [ ] Custom diagnostic scripts
- [ ] Team-specific decision frameworks

**Update quarterly:**
- [ ] Incident trends analysis
- [ ] New technical knowledge
- [ ] Improved procedures
- [ ] Training based on recent incidents

