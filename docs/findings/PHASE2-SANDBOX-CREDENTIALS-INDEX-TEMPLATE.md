# Phase 2 Sandbox Credentials Index - Template

**SENSITIVE - ENCRYPTED STORAGE REQUIRED**  
**Access:** Only authorized Phase 2 team members  
**Last Updated:** [Will be updated during Week 1]  
**Encryption:** AES-256 with GPG signature

---

## ⚠️ SECURITY NOTICE

This document contains API credentials and sensitive account information. 

**DO NOT:**
- Store in plaintext version control
- Share via email or chat
- Screenshot or copy to clipboard without encryption
- Commit to repository (should be in `.gitignore`)

**DO:**
- Store in encrypted file: `.phase2-credentials.enc`
- Decrypt only when needed with GPG key
- Rotate credentials monthly
- Log all access attempts in audit trail

---

## ENCRYPTION INSTRUCTIONS

### Encrypt this file (after filling credentials)
```bash
gpg --symmetric --cipher-algo AES256 \
    PHASE2-SANDBOX-CREDENTIALS-INDEX-TEMPLATE.md \
    -o PHASE2-SANDBOX-CREDENTIALS-INDEX.md.enc
# Enter passphrase when prompted
```

### Decrypt for reading
```bash
gpg --decrypt PHASE2-SANDBOX-CREDENTIALS-INDEX.md.enc > temp-creds.md
# View in editor, then securely delete:
# shred -fvz -n 10 temp-creds.md
```

---

## 1. PerimeterX Credentials

**Account Status:** [To be completed during Week 1]  
**Account Created:** [Date - TBD]  
**Verification Status:** ☐ Pending ☐ Verified

### Account Information
```
Login Email: gnelsonbusi@gmail.com
Organization Name: Basset Hound Security Research
Account Type: Free Trial
Trial Start Date: [TBD]
Trial Expiration: [TBD - typically 14-30 days]
```

### API Credentials
```
Organization ID: [TO BE INSERTED]
API Key: [TO BE INSERTED - treat as password]
API Base URL: https://api.perimeterx.com/v3/
API Version: 3.0
```

### Dashboard Access
```
Dashboard URL: https://[ACCOUNT_NAME].perimeterx.com/
Dashboard Login Email: gnelsonbusi@gmail.com
Dashboard Password: [SECURELY STORED SEPARATELY]
2FA Method: Authenticator App
2FA Backup Codes: [ENCRYPTED STORAGE]
```

### Test Environment Configuration
```
Test Domain: phase2-test.basset-hound.local
Risk Mode: Log Only (no blocking)
Bot Score Threshold: 95 (log-only mode)
Logging Level: DEBUG
Data Retention: 30 days
Max Test Domains: 2
```

### Rate Limits
```
API Calls per Minute: 100
API Calls per Day: 50,000
Concurrent Dashboard Sessions: 5
Test Domains Allowed: 2
Phase 2 Target Rate: 50 req/min (50% of limit)
Backoff Strategy: 2 minute pause on 429 error
```

### Support Contact
```
Support Email: support@perimeterx.com
Support Portal: https://support.perimeterx.com
Account Manager: [To be assigned]
Manager Email: [To be assigned]
Emergency Escalation: [To be assigned]
```

### Integration Notes
```
Webhook Configured: ☐ No ☐ Yes
Webhook URL: https://phase2-monitor.basset-hound.local:8765/perimeterx-webhook
Events Subscribed: bot_detected, risk_score_updated, api_call_failed
Webhook Retry Policy: 3 retries, 5-second intervals
Last Webhook Test: [TBD]
```

---

## 2. DataDome Credentials

**Account Status:** [To be completed during Week 1]  
**Account Created:** [Date - TBD]  
**Demo Activated:** ☐ No ☐ Yes

### Account Information
```
Login Email: gnelsonbusi@gmail.com
Organization Name: Basset Hound Security Research
Account Type: Demo/Sandbox
Demo Start Date: [TBD]
Demo Expiration: [TBD - typically 30 days]
Extension Available: ☐ Yes (upon request)
```

### API Credentials
```
Client ID: [TO BE INSERTED]
Client Secret: [TO BE INSERTED - treat as password]
API Base URL: https://api.datadome.co/v1/
Account ID: [TO BE INSERTED]
```

### Dashboard Access
```
Dashboard URL: https://console.datadome.co/
Login Email: gnelsonbusi@gmail.com
Dashboard Password: [SECURELY STORED SEPARATELY]
2FA Method: Authenticator App
2FA Backup Codes: [ENCRYPTED STORAGE]
```

### Test Environment Configuration
```
Test Domain: datadome-phase2.basset-hound.local
Mode: Report Only (no blocking)
Bot Probability Threshold: 90%
Logging Level: All events, all attributes
Session Window: 60 minutes
Max Concurrent Sessions: 10 per domain
```

### Rate Limits
```
API Requests per Minute: 60
Concurrent Sessions: 10
Events Logged per Day: Unlimited
API Keys Allowed: 2
Phase 2 Target Rate: 30 req/min (50% of limit)
Backoff Strategy: Exponential (1s, 2s, 4s, 8s, stop)
```

### Support Contact
```
Support Email: support@datadome.co
Support Portal: https://support.datadome.co
Account Manager: [To be assigned]
Manager Email: [To be assigned]
Demo Renewal: [Contact manager for extension]
```

### Integration Notes
```
Webhook Configured: ☐ No ☐ Yes
Webhook URL: https://phase2-monitor.basset-hound.local:8765/datadome-webhook
Events Subscribed: session_analyzed, bot_detected, risk_updated
Batch Interval: Every 5 minutes or 100 events (whichever first)
Last Webhook Test: [TBD]
```

---

## 3. Cloudflare Credentials

**Account Status:** [To be completed during Week 1]  
**Account Created:** [Date - TBD]  
**Verification Status:** ☐ Pending ☐ Verified

### Account Information
```
Login Email: gnelsonbusi@gmail.com
Account Type: Free Tier
Billing Status: No charges (free tier)
Payment Method: Not required
2FA Enabled: ☐ No ☐ Yes
```

### API Credentials
```
API Token: [TO BE INSERTED - treat as password]
Zone ID: [TO BE INSERTED]
Account ID: [TO BE INSERTED]
API Base URL: https://api.cloudflare.com/client/v4/
API Version: v4
```

### Dashboard Access
```
Dashboard URL: https://dash.cloudflare.com/
Login Email: gnelsonbusi@gmail.com
Dashboard Password: [SECURELY STORED SEPARATELY]
2FA Method: [To be configured]
2FA Backup Codes: [ENCRYPTED STORAGE]
```

### Test Environment Configuration
```
Test Domain: cf-phase2.basset-hound.local
WAF Enabled: ☐ No ☐ Yes
Bot Management: Not available in free tier
Managed Rules: Cloudflare OWASP ModSecurity Core Ruleset
Paranoia Level: 2 (standard)
WAF Action: Challenge (JavaScript - no blocking)
Analytics Retention: 3 days (free tier)
```

### Rate Limits
```
API Calls per Minute: 30 (free tier)
API Calls per Day: ~40,000 (fair-use estimate)
WAF Rule Evaluations: Unlimited (all traffic)
JavaScript Challenges: Unlimited
Phase 2 Target Rate: 10 API calls/min (33% of limit)
Backoff Strategy: Pause all API calls for 60s on 429
Alternative: Use dashboard analytics instead of API
```

### Support Contact
```
Support Email: support@cloudflare.com
Support Portal: https://support.cloudflare.com
Community Forum: https://community.cloudflare.com
Free Tier Support: Email and community only
```

### Integration Notes
```
Logpush Configured: ☐ No ☐ Yes (requires paid tier)
GraphQL API Enabled: ☐ No ☐ Yes
Query Used: AccessLogs filtered by BotManagementScore
Last API Test: [TBD]
Notes: Free tier WAF has limited bot detection; use for baseline WAF testing only
```

---

## 4. AWS WAF (Optional - If Enabled)

**Account Status:** [To be completed if selected]  
**Account Created:** [Date - TBD]  
**Free Tier Enabled:** ☐ No ☐ Yes

### Account Information
```
AWS Account ID: [TO BE INSERTED]
Region: us-east-1
Free Tier Eligibility: 1 year from account creation
```

### API Credentials
```
Access Key ID: [TO BE INSERTED]
Secret Access Key: [TO BE INSERTED - treat as password]
IAM User: phase2-testing
IAM Policy: WAF and CloudWatch limited access
```

### WAF Configuration
```
Web ACL Name: phase2-test-acl
IP Reputation Rules: Enabled
Rate-Based Rules: 2000 requests per 5 minutes
Logging: CloudWatch Logs
Log Group: /aws/waf/phase2-testing
```

### Rate Limits
```
API Requests per Second: Very high (not a constraint)
Rules Evaluated per Second: 10,000+ (easily sufficient)
CloudWatch Logs Retention: 7 days (configurable)
Phase 2 Usage: Minimal (backup only if needed)
```

---

## 5. Public Detection Services (Free, No Auth)

**Note:** These don't require credentials but are useful for baseline testing

### CreepJS
```
URL: https://www.creepjs.com
Type: Browser fingerprinting detection
Usage: Baseline fingerprint validation
Results: Real-time, no storage
Cost: Free
```

### BrowserLeaks.com
```
URL: https://browserleaks.com
Type: WebGL, Canvas, WebRTC leak detection
Usage: Validate evasion effectiveness
Results: Real-time, no storage
Cost: Free
```

### FingerPrintJS (Demo)
```
URL: https://fingerprint.com/products/demo/
Type: Browser fingerprinting as a service
Usage: Compare detection approach
Results: Real-time comparison, no storage
Cost: Free demo
```

### Bot.Sannysoft
```
URL: https://bot.sannysoft.com
Type: Bot detection verification
Usage: Quick evasion check
Results: Real-time JSON response
Cost: Free
API: Direct, no authentication required
```

---

## 6. Credential Rotation Schedule

**Monthly Rotation (First Sunday of each month):**
- [ ] PerimeterX API Key
- [ ] DataDome Client Secret
- [ ] Cloudflare API Token
- [ ] AWS Secret Access Key (if enabled)
- [ ] All passwords

**After Phase 2 Completion (July 15):**
- [ ] Invalidate all temporary credentials
- [ ] Remove test domains
- [ ] Reset accounts to read-only (if possible)
- [ ] Archive encrypted credentials for future reference

---

## 7. Emergency Access Procedure

**If account access lost:**

1. **PerimeterX:** Email support@perimeterx.com with account verification
2. **DataDome:** Contact assigned account manager or support@datadome.co
3. **Cloudflare:** Use account recovery email at https://dash.cloudflare.com/
4. **AWS:** Use account recovery at https://console.aws.amazon.com/

**Estimated Recovery Time:** 2-24 hours depending on service

---

## 8. Audit Log

**Access Record (to be updated during Phase 2):**

| Date | Time | User | Action | Details |
|------|------|------|--------|---------|
| 2026-06-18 | 09:00 | [NAME] | Created | Template prepared |
| [TBD] | [TBD] | [NAME] | Updated | PerimeterX credentials inserted |
| [TBD] | [TBD] | [NAME] | Updated | DataDome credentials inserted |
| [TBD] | [TBD] | [NAME] | Updated | Cloudflare credentials inserted |
| [TBD] | [TBD] | [NAME] | Encrypted | Document encrypted with GPG |
| [TBD] | [TBD] | [NAME] | Accessed | [Describe reason for access] |

---

## 9. Document Control

**File Location:** `/home/devel/basset-hound-browser/docs/findings/`  
**Filename:** `PHASE2-SANDBOX-CREDENTIALS-INDEX.md.enc` (encrypted)  
**Plaintext:** Never stored on disk (decrypt only in memory)  
**Owner:** Phase 2 Project Lead  
**Access:** Phase 2 team members only  
**Classification:** CONFIDENTIAL - INTERNAL USE ONLY

---

**Template Version:** 1.0  
**Last Updated:** June 15, 2026  
**Status:** Ready for Week 1 account setup  
**Prepared by:** Basset Hound DevOps Planning Agent
