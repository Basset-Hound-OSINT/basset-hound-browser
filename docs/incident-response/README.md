# Incident Response Procedures - Complete Documentation

**Version:** 1.0  
**Date:** June 21, 2026  
**Project:** Basset Hound Browser v12.7.0  
**Status:** READY FOR PRODUCTION USE

---

## Quick Start

### For On-Call Engineers (First Time?)

1. **Right now:** Read this README (5 min)
2. **Before your shift:** Read CONTACT-PROCEDURES.md (10 min)
3. **When an incident occurs:** Open DECISION-TREES.md for your incident type (2 min)
4. **During response:** Follow the runbook/decision tree
5. **After incident:** Read POST-INCIDENT-PROCEDURES.md

### During an Active Incident

```
STEP 1: Open decision tree (DECISION-TREES.md) for your incident type
STEP 2: Follow the decision tree to classify and respond
STEP 3: Execute the immediate actions from the tree
STEP 4: Update status in Slack #incidents every 15 min (P1) or 30 min (P2)
STEP 5: When resolved, follow post-incident checklist
```

---

## Documentation Overview

### 1. INCIDENT-RESPONSE-PROCEDURES.md (Main Document)

**Purpose:** Complete incident response framework  
**Length:** ~1,200 lines  
**Content:**
- Incident classification matrix
- Framework and roles
- 5 detailed incident types:
  - High Memory Incidents
  - High Error Rate Incidents
  - Unavailability Incidents
  - Security Incidents
  - Performance Degradation Incidents
- Decision trees (text format)
- Contact procedures
- Communication templates
- Post-incident procedures

**When to use:** During incident response for detailed guidance

---

### 2. DECISION-TREES.md (Decision Diagrams)

**Purpose:** Visual decision trees for each incident type  
**Length:** ~800 lines  
**Content:**
- Master incident classification tree
- Decision Tree 1: Unavailability
- Decision Tree 2: High Error Rate
- Decision Tree 3: High Memory
- Decision Tree 4: Performance Degradation
- Decision Tree 5: Security Incident
- Escalation matrix
- Response time SLA by severity

**When to use:** IMMEDIATELY when an incident is detected
- Print and post at your desk
- Open on second monitor during on-call
- Reference for quick decision-making

**Format:** ASCII diagrams with decision points and outcomes

---

### 3. CONTACT-PROCEDURES.md (Contact Info & Escalation)

**Purpose:** Contact information and notification procedures  
**Length:** ~500 lines  
**Content:**
- On-call schedule template
- Contact directory (Tier 1-4)
- Escalation paths for P1/P2/P3
- Notification procedures (PagerDuty, Slack, SMS)
- Slack notification format
- Phone notification script
- Communication channels (Slack, Email, Status page)
- Status page update templates
- Customer communication templates
- On-call handoff procedures
- Quick reference card

**When to use:** 
- Before your shift: Check contact directory
- During incident: Use escalation path for your severity
- To contact people: Use directory
- To notify customers: Use templates

---

### 4. POST-INCIDENT-PROCEDURES.md (RCA & Closure)

**Purpose:** Procedures for incident closure and continuous improvement  
**Length:** ~600 lines  
**Content:**
- Immediate post-incident (1 hour)
- Short-term actions (24 hours)
- Root cause analysis (RCA)
- Post-incident review meeting
- Action items and follow-up
- Continuous improvement
- Documentation and archival
- Incident report template
- Post-incident checklist

**When to use:**
- After incident is resolved
- For RCA meeting preparation
- For post-incident report

---

## Incident Type Reference

Quick lookup for your incident:

| Incident Type | Severity | Response Time | Decision Tree | Runbook Section | Escalation |
|---------------|----------|---------------|---------------|----------------|----|
| **High Memory** | P1 if >85% | ≤5 min | Tree 3 | Memory Incident | Page SRE Lead |
| Memory > 80% | P3 | ≤1 hour | Tree 3 | Memory Incident | Page on-call |
| **High Error Rate** | P1 if >10% | ≤5 min | Tree 2 | Error Rate Incident | Page SRE Lead |
| Error rate 5-10% | P2 | ≤15 min | Tree 2 | Error Rate Incident | Page SRE Lead |
| **Unavailability** | P1 if >75% down | ≤5 min | Tree 1 | Unavailability Incident | Page SRE + Tech Lead |
| Partial down | P2 | ≤15 min | Tree 1 | Unavailability Incident | Page SRE Lead |
| **Performance** | P2 if >200% | ≤15 min | Tree 4 | Performance Incident | Page SRE Lead |
| Latency >150% | P3 | ≤1 hour | Tree 4 | Performance Incident | On-call only |
| **Security** | P1 | ≤5 min | Tree 5 | Security Incident | Page Security Lead |

---

## Severity Levels

```
P1 - CRITICAL
├─ Service unavailable OR
├─ Error rate > 10% OR
├─ Data loss risk OR
├─ Security breach
├─ Response: ≤ 5 minutes
├─ Escalation: SRE Lead + Tech Lead + Manager
└─ Status updates: Every 5-10 minutes

P2 - HIGH
├─ Severe degradation OR
├─ Error rate 5-10% OR
├─ Service partially down OR
├─ Customer experience impacted
├─ Response: ≤ 15 minutes
├─ Escalation: SRE Lead
└─ Status updates: Every 15 minutes

P3 - MEDIUM
├─ Feature broken OR
├─ Errors present (< 5% rate) OR
├─ No immediate customer impact
├─ Response: ≤ 1 hour
├─ Escalation: None (on-call handles)
└─ Status updates: Every 30 minutes

P4 - LOW
├─ Minor issues OR
├─ No customer impact
├─ Response: ≤ 24 hours
├─ Escalation: None
└─ Status updates: None (tracked in system)
```

---

## Key Contacts

### Always Available

**Primary On-Call:** [See PagerDuty schedule]
**SRE Lead:** [Name] - [Phone]
**Tech Lead:** [Name] - [Phone]

### For Emergencies

**Engineering Manager:** [Name] - [Phone]
**VP Engineering:** [Name] - [Phone] (auto-paged at 30 min for P1)
**Security Lead:** [Name] - [Phone] (for security incidents)

---

## Communication Channels

| Channel | Purpose | When to Use | Frequency |
|---------|---------|-----------|-----------|
| **PagerDuty** | On-call paging | All incidents | Immediate |
| **Slack #incidents** | Incident discussion | All incidents | Every 15 min (P1) / 30 min (P2) |
| **Slack #all-hands** | Company-wide critical | P1 + customer impact | At start, resolution, 24h |
| **War Room** | Real-time coordination | P1 incidents | Established immediately |
| **Email** | Summary/update | All incidents (post) | At resolution + 24h |
| **Status Page** | Customer visibility | P1 + customer impact | At start, every 30 min, resolution |

---

## Quick Decision Matrix

```
INCIDENT DETECTED - WHAT DO I DO?

1. IDENTIFY TYPE:
   ├─ Nothing responding? → UNAVAILABILITY (Decision Tree 1)
   ├─ Errors spiking? → HIGH ERROR RATE (Decision Tree 2)
   ├─ Memory high? → HIGH MEMORY (Decision Tree 3)
   ├─ Slow/timeouts? → PERFORMANCE (Decision Tree 4)
   ├─ Suspicious activity? → SECURITY (Decision Tree 5)
   └─ Not sure? → Create ticket, consult SRE Lead

2. OPEN DECISION TREE:
   └─ Follow the tree step-by-step
   └─ Each node tells you what to check/do next
   └─ Do not skip steps

3. EXECUTE ACTIONS:
   └─ Follow decision tree guidance
   └─ Take screenshots/logs of state
   └─ Document what you did

4. COMMUNICATE:
   ├─ Post to #incidents immediately
   ├─ Update status every 15 min (P1) or 30 min (P2)
   └─ When resolved, post all-clear

5. AFTER RESOLUTION:
   └─ Read POST-INCIDENT-PROCEDURES.md
   └─ Schedule RCA meeting
   └─ Archive incident artifacts
```

---

## Most Common Incidents

### Incident #1: High Memory (P1)

**Happens ~2x per month**

**Quick response:**
1. Verify memory > 85%: `docker stats basset-hound-browser --no-stream`
2. Notify: Post to #incidents
3. Restart: `docker restart basset-hound-browser`
4. Wait 30 sec, verify: `docker stats`
5. Success? Post all-clear. Investigate later.

**Decision Tree:** DECISION-TREES.md → Decision Tree 3 → HIGH MEMORY RESPONSE

**Full Procedure:** INCIDENT-RESPONSE-PROCEDURES.md → High Memory Incident

---

### Incident #2: High Error Rate (P2)

**Happens ~1x per month**

**Quick response:**
1. Get error rate: Prometheus query or logs
2. Get error types: `docker logs --tail=100 | grep ERROR`
3. Notify: Post to #incidents
4. Determine cause (see tree):
   - External dependency down? Wait
   - Code bug? Restart or rollback
   - Resource issue? Restart
5. Execute action
6. Monitor for recovery

**Decision Tree:** DECISION-TREES.md → Decision Tree 2 → HIGH ERROR RESPONSE

**Full Procedure:** INCIDENT-RESPONSE-PROCEDURES.md → High Error Rate Incident

---

### Incident #3: Service Unavailable (P1)

**Happens ~1-2x per quarter**

**Quick response:**
1. Verify: `curl http://localhost:8765/health`
2. Check container: `docker ps`
3. Notify: Post to #incidents #all-hands
4. Restart: `docker restart basset-hound-browser`
5. Wait 30 sec, verify
6. If still down, escalate

**Decision Tree:** DECISION-TREES.md → Decision Tree 1 → UNAVAILABILITY

**Full Procedure:** INCIDENT-RESPONSE-PROCEDURES.md → Unavailability Incident

---

## Training & Preparation

### Before Going On-Call

**Read these in order:**
1. README.md (this file) - 10 min
2. DECISION-TREES.md - 20 min (skim decision trees)
3. CONTACT-PROCEDURES.md - 10 min
4. Print DECISION-TREES.md and post at your desk

**Total prep time:** ~40 minutes

### Monthly Drills

First Friday of each month:
- Random incident scenario
- Page on-call (real page, with context)
- Simulate 5 minutes of response
- Feedback from SRE Lead

### Quarterly Training

Deep dive on:
- Specific incident type
- Root cause analysis skills
- Communication techniques
- Escalation decision-making

---

## Integration with Other Systems

### Monitoring & Alerts

These procedures assume you have monitoring configured (see PRODUCTION-MONITORING.md):
- Prometheus for metrics
- Elasticsearch for logs
- Grafana for dashboards
- AlertManager for alert routing

### Deployment & Rollback

For incident response, you'll reference:
- ROLLBACK-RUNBOOK.md (to rollback deployments)
- DEPLOYMENT-GUIDE.md (to deploy fixes)

### Runbooks

These procedures work with existing runbooks:
- CANARY-DEPLOYMENT-RUNBOOK.md
- ROLLBACK-RUNBOOK.md
- PRODUCTION-MONITORING.md

---

## Success Metrics

### Response Time Targets

| Severity | Target | Stretch | Current (V12.7.0) |
|----------|--------|---------|-------------------|
| P1 | ≤ 5 min | ≤ 3 min | 8 min (baseline) |
| P2 | ≤ 15 min | ≤ 10 min | 12 min (baseline) |
| P3 | ≤ 1 hour | ≤ 30 min | 45 min (baseline) |

### Resolution Time Targets

| Severity | Target | Current |
|----------|--------|---------|
| P1 | ≤ 1 hour | ~30 min (varies) |
| P2 | ≤ 4 hours | ~2 hours (varies) |
| P3 | ≤ 24 hours | ~8 hours (varies) |

### Quality Metrics

- **Communication:** Status update posted within 2 min ✓
- **Decision-making:** Correct decision per tree ✓
- **Action effectiveness:** Issues resolved by action taken ✓
- **Learning:** RCA completed within 1 week ✓

---

## Common Issues & Solutions

### "I don't know what's wrong"

**Solution:** Don't panic. Use the decision tree:
1. Look at DECISION-TREES.md master classification tree
2. Identify closest match
3. Follow that tree step-by-step
4. Trees tell you what to check
5. If still stuck, escalate to SRE Lead

### "Is this P1 or P2?"

**Solution:** Check the severity matrix in each decision tree
- **P1:** User-facing, multiple customers, data at risk
- **P2:** Service degraded but partially working
- **P3:** Feature issue, no customer impact yet

### "How do I contact the SRE Lead?"

**Solution:** See CONTACT-PROCEDURES.md
- Phone number
- Email
- Slack handle
- PagerDuty (will auto-page for escalations)

### "Should I restart or rollback?"

**Solution:** Decision Tree 2 (High Error Rate) walks through this
- Restart if: Resource issue, cache corruption
- Rollback if: Code bug in recent deployment

### "What should I write in the status update?"

**Solution:** See CONTACT-PROCEDURES.md for templates
- What we found
- What we're doing
- ETA to resolution
- Next status update time

---

## Feedback & Improvements

### How to Report Issues with These Procedures

1. **During incident:** @SRE Lead in Slack
2. **After incident:** Post in #incidents or email SRE Lead
3. **Format:** What was unclear? What would have helped?

### How to Request Updates

1. File issue: "Documentation: [Improvement needed]"
2. Or: Reply to post-incident review with feedback
3. Changes reviewed quarterly and incorporated

---

## File Organization

```
/docs/incident-response/
├── README.md (this file)
│   └─ Overview and quick reference
├── INCIDENT-RESPONSE-PROCEDURES.md
│   └─ Main document: 5 incident types + framework
├── DECISION-TREES.md
│   └─ Visual decision trees (5 types + master classification)
├── CONTACT-PROCEDURES.md
│   └─ Contact info, escalation, communication
└── POST-INCIDENT-PROCEDURES.md
    └─ RCA, action items, follow-up, closure

Related Documents:
/docs/monitoring/PRODUCTION-MONITORING.md
    └─ Monitoring setup (metrics, alerts, dashboards)
/docs/runbooks/DEPLOYMENT-RUNBOOKS-INDEX.md
    └─ Links to deployment/rollback runbooks
/docs/SCOPE.md
    └─ System architecture and boundaries
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-21 | Initial IR procedures - Complete framework for all 5 incident types |

---

## Next Steps

1. **Save this:** Bookmark /docs/incident-response/ in your browser
2. **Print Decision Trees:** Print DECISION-TREES.md for your desk
3. **Add to Phone:** Save contact numbers (CONTACT-PROCEDURES.md)
4. **Read Thoroughly:** Schedule 1 hour to read all docs before on-call
5. **Practice:** Participate in monthly drills
6. **Ask Questions:** Reach out to SRE Lead with any confusion

---

## Questions?

**Who to ask:**
- **General questions:** SRE Lead in #incidents-dev
- **During incident:** @incident-commander in #incidents
- **About procedures:** Ask in post-incident review meeting
- **After hours:** Page on-call SRE via PagerDuty

---

**Status:** ✅ READY FOR PRODUCTION USE  
**Last Updated:** June 21, 2026  
**Next Review:** September 21, 2026  
**Maintained By:** Incident Response Team / SRE

---

## Document Stats

- **Total Pages:** ~100 pages (single-spaced)
- **Total Words:** ~22,000 words
- **Decision Trees:** 5 comprehensive trees
- **Incident Types Covered:** 5 major categories
- **Templates:** 20+ communication and action templates
- **Procedures:** 15+ step-by-step procedures

---

**Welcome to the Incident Response Program. We're better together.**
