# Security Incident Playbook

**Document Version:** 1.0  
**Last Updated:** June 13, 2026  
**Classification:** Internal Operations  
**Severity:** P1 (Critical)  

---

## Executive Summary

This playbook provides procedures for responding to security incidents (unauthorized access, data breach, malware, DDoS, etc.).

**Key Principles:**
1. **Contain first** - Stop the attack, isolate affected systems
2. **Preserve evidence** - Don't lose logs or artifacts
3. **Communicate carefully** - Legal & PR involvement required
4. **Investigate thoroughly** - Find root cause and extent of breach

---

## Incident Severity Classification

### Level 1 - Critical Breach
- Confirmed unauthorized access to production data
- Customer data exposed
- Malware/ransomware present
- DDoS attack preventing service

**Response:** Immediate containment, CEO notification, legal involvement

### Level 2 - High Security Issue
- Unauthorized access attempt detected
- Privilege escalation attempt
- Suspicious code deployment
- Significant vulnerability discovered

**Response:** Rapid investigation, containment, security team alert

### Level 3 - Medium Security Event
- Unusual access patterns
- Failed intrusion attempts
- Minor vulnerability
- Security policy violation

**Response:** Investigation, mitigation, monitoring

### Level 4 - Low Security Note
- Misconfiguration found
- Best practice violation
- Minor suspicious activity
- Policy training needed

---

## Immediate Response (0-5 minutes)

### 1.1 Incident Verification

- [ ] Incident confirmed by Security Officer or Ops Lead
- [ ] Severity level assessed: Level __________
- [ ] Incident type: __________
- [ ] Time of discovery: __________

### 1.2 Executive Notification (If Level 1-2)

- [ ] CEO notified
  - Time: __________
  - By: __________

- [ ] CISO/Security Lead notified
  - Time: __________
  - By: __________

- [ ] Legal counsel notified
  - Time: __________
  - By: __________

- [ ] VP Engineering notified
  - Time: __________
  - By: __________

### 1.3 War Room Activation

- [ ] War room opened
  - Channel: #security-incident
  - Conference line: __________
  - Video: __________

- [ ] Core team assembled
  - Security Lead: __________
  - Operations Lead: __________
  - Engineer Lead: __________
  - CISO: __________

---

## Investigation & Containment (5-30 minutes)

### 2.1 Immediate Containment Actions

**Do NOT attempt cleanup until incident fully understood:**

#### 2.1.1 Breach Containment

- [ ] Isolate affected system (if Level 1-2)
  - Command: Disconnect from network OR revoke API keys
  - System: __________
  - Time: __________
  - Impact on users: __________

- [ ] Revoke compromised credentials
  - Type: __________
  - Count: __________
  - Time: __________
  - Notify users: [ ] Yes [ ] No

- [ ] Block suspicious IP/user
  - IP: __________
  - User: __________
  - Method: Firewall / WAF rule
  - Time: __________

#### 2.1.2 Evidence Preservation

- [ ] Preserve logs
  - Capture auth logs: [ ] Yes [ ] No
  - Capture application logs: [ ] Yes [ ] No
  - Capture system logs: [ ] Yes [ ] No
  - Location: __________

- [ ] Preserve system state
  - Snapshot: [ ] Yes [ ] No
  - Forensic image: [ ] Yes [ ] No
  - Time: __________

- [ ] Notify legal of preservation
  - Email sent: [ ] Yes [ ] No
  - Time: __________

### 2.2 Investigation - Unauthorized Access

#### Attack Indicators

```bash
# Check failed login attempts
grep "authentication failed" /var/log/auth.log

# Check successful logins from suspicious locations
grep "Accepted password\|Accepted publickey" /var/log/auth.log

# Check privilege escalation
grep "sudo\|su:" /var/log/auth.log

# Check SSH key additions
grep "authorized_keys" /var/log/secure

# Check network connections
netstat -an | grep ESTABLISHED
```

- [ ] Unauthorized access confirmed
  - Access type: [ ] SSH [ ] API [ ] Database [ ] Other
  - Duration: __________
  - Actions taken: __________

#### 2.2.1 Attack Timeline

- [ ] First access: __________
- [ ] Last access: __________
- [ ] Duration: __________
- [ ] Source IP(s): __________
- [ ] Account(s) accessed: __________

#### 2.2.2 Data Accessed

- [ ] Determine what data was accessed
  - Tables/endpoints: __________
  - Records affected: __________
  - Sensitivity: Low / Medium / High

- [ ] Determine if data was exfiltrated
  - Large downloads: [ ] Yes [ ] No
  - Data copied: [ ] Yes [ ] No
  - Evidence: __________

### 2.3 Investigation - Malware/Compromise

```bash
# Check for unusual processes
ps aux | sort -rnk 3 | head -20

# Check for listening ports
netstat -tuln | grep LISTEN

# Check cron jobs for additions
crontab -l

# Check file modifications
find / -mtime -1 -type f 2>/dev/null
```

- [ ] Malware/backdoor detected
  - Artifact: __________
  - Location: __________
  - Signature: __________
  - Threat level: __________

- [ ] System compromise scope
  - Infected systems: __________
  - Compromise method: __________
  - Attacker access level: __________

### 2.4 Investigation - DDoS Attack

```bash
# Check traffic patterns
iftop
tcpdump -i eth0 'tcp port 80'

# Check packet drop rate
netstat -s | grep dropped
```

- [ ] DDoS attack characteristics
  - Source IP(s): __________
  - Target: __________
  - Attack rate: __________req/s
  - Vector: [ ] HTTP flood [ ] TCP SYN [ ] UDP [ ] Other

- [ ] Mitigation enabled
  - WAF rules activated: [ ] Yes [ ] No
  - Rate limiting: [ ] Yes [ ] No
  - DDoS service engaged: [ ] Yes [ ] No

---

## Containment & Remediation (30-60 minutes)

### 3.1 Remediation Actions

#### 3.1.1 For Unauthorized Access

- [ ] Reset all passwords
  - Command: Force password reset for all users
  - Notification sent: [ ] Yes [ ] No
  - Time: __________

- [ ] Rotate API keys
  - Old keys: Revoked
  - New keys: Generated
  - Notify integrations: [ ] Yes [ ] No

- [ ] Audit account permissions
  - Excessive permissions found: __________
  - Permissions reduced: [ ] Yes [ ] No

- [ ] Enable MFA/2FA
  - MFA enforced: [ ] Yes [ ] No
  - User notification: [ ] Yes [ ] No

#### 3.1.2 For Malware/Compromise

- [ ] Remove malware
  - Tool used: __________
  - Files removed: __________
  - Systems cleaned: __________

- [ ] Patch vulnerability
  - Vulnerability: __________
  - Patch applied: [ ] Yes [ ] No
  - Systems updated: __________
  - Restart required: [ ] Yes [ ] No

- [ ] Verify system integrity
  - File integrity check: [ ] Clean [ ] Issues
  - System scan: [ ] Clean [ ] Issues

#### 3.1.3 For DDoS Attack

- [ ] Activate DDoS protection
  - Service: __________
  - Enabled: [ ] Yes [ ] No
  - Time: __________

- [ ] Implement traffic shaping
  - Rate limit: __________req/s per IP
  - Geo-blocking: [ ] Yes [ ] No
  - Regions blocked: __________

- [ ] Monitor attack progress
  - Current traffic: __________req/s
  - Blocked traffic: __________req/s
  - Service availability: __________%

### 3.2 Service Recovery

- [ ] Service restored
  - Time: __________
  - Availability: __________%
  - Customer impact: __________

- [ ] Continuous monitoring
  - Alerts on unusual activity: [ ] Yes [ ] No
  - Real-time monitoring: [ ] Yes [ ] No
  - Duration: __________ hours

---

## Customer Communication

### 4.1 Breach Disclosure (If Data Exposed)

**If customer data was potentially exposed:**

- [ ] Legal review completed
  - Notification required: [ ] Yes [ ] No
  - Timing: Immediately / 24 hours / 30 days
  - By: __________

- [ ] Customer notification prepared
  - Content reviewed by: Legal, PR
  - Message: Breach details, data exposed, actions taken, next steps
  - Tone: Professional, transparent, apologetic

- [ ] Customer notification sent
  - Method: Email, phone (high-value customers)
  - Time: __________
  - Delivery confirmed: [ ] Yes [ ] No

- [ ] Public disclosure (if required)
  - Press release: [ ] Required [ ] Not required
  - Media statement: [ ] Prepared [ ] Not needed
  - Time: __________

### 4.2 Status Page Update

- [ ] Status page updated
  - Message: Incident details, status, next steps
  - Time: __________
  - Updates provided: Every 30 minutes

---

## Post-Incident (Hours - Days After)

### 5.1 Forensics & Investigation

- [ ] Detailed forensic analysis
  - Method of entry: __________
  - Persistence mechanisms: __________
  - Tools used by attacker: __________
  - Likely attacker: __________

- [ ] Root cause analysis
  - Why was breach successful: __________
  - Why wasn't it detected: __________
  - What failed: __________

### 5.2 Security Improvements

- [ ] Security controls hardened
  - [ ] Network segmentation improved
  - [ ] Access controls strengthened
  - [ ] Monitoring enhanced
  - [ ] Encryption improved
  - [ ] Vulnerability patched

- [ ] Detection/Prevention enhanced
  - [ ] IDS/IPS rules added
  - [ ] WAF rules updated
  - [ ] Alert thresholds adjusted
  - [ ] Threat intel integrated

### 5.3 Postmortem

- [ ] Postmortem meeting scheduled
  - Participants: Security, Engineering, Operations, Management
  - Time: __________
  - Duration: 2 hours

- [ ] Postmortem documented
  - Timeline: Clear sequence of events
  - Root cause: Why it happened
  - Impact: Full scope of damage
  - Prevention: How to prevent recurrence

### 5.4 Regulatory Compliance

- [ ] Regulatory notifications sent (if required)
  - [ ] GDPR (EU customers)
  - [ ] CCPA (California)
  - [ ] Industry-specific (PCI-DSS, HIPAA, etc.)
  - Time: __________

- [ ] Compliance audit triggered
  - Audit firm: __________
  - Scope: Full security review
  - Expected completion: __________

---

## Appendix A: Detection Rules

**Add to monitoring/alerting immediately after incident:**

```
Rule: Multiple failed login attempts from same IP
- Threshold: >5 failures in 10 minutes
- Action: Alert and block IP

Rule: SSH key additions
- Monitor: /root/.ssh/authorized_keys changes
- Alert: New key added
- Action: Require approval

Rule: Privilege escalation attempts
- Monitor: sudo logs
- Alert: Non-admin sudo attempt
- Action: Investigate

Rule: Large data downloads
- Monitor: Network data volume
- Alert: >1GB in 1 hour
- Action: Investigate

Rule: Unusual outbound connections
- Monitor: DNS, HTTP, HTTPS
- Alert: Connection to known malicious IP
- Action: Block and investigate

Rule: Process execution anomalies
- Monitor: Unusual processes
- Alert: Process from /tmp
- Action: Kill and investigate

Rule: File system modifications
- Monitor: System files in /etc, /var
- Alert: Unexpected modification
- Action: Alert and check integrity
```

---

## Appendix B: Incident Response Checklist

**Day 1 (Incident Day):**
- [ ] Incident detected and verified
- [ ] Executives notified
- [ ] War room activated
- [ ] System isolated/contained
- [ ] Evidence preserved
- [ ] Initial investigation completed
- [ ] Customers notified
- [ ] Remediation started

**Day 2-3 (Investigation):**
- [ ] Forensics completed
- [ ] Root cause identified
- [ ] All affected systems patched
- [ ] System integrity verified
- [ ] Services restored
- [ ] Monitoring enhanced
- [ ] Post-incident review scheduled

**Day 7 (Follow-up):**
- [ ] Postmortem completed
- [ ] Action items assigned
- [ ] Regulatory notifications sent
- [ ] Security improvements implemented
- [ ] Team debriefing completed
- [ ] Customer follow-up communications sent

---

## Appendix C: Contact Information

| Role | Name | Phone | Email |
|------|------|-------|-------|
| CISO | _________ | _________ | _________ |
| Security Lead | _________ | _________ | _________ |
| Legal Counsel | _________ | _________ | _________ |
| VP Engineering | _________ | _________ | _________ |
| IR Firm | _________ | _________ | _________ |
| Law Enforcement | _________ | _________ | _________ |
