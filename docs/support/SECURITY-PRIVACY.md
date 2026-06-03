# Security & Privacy Guide

Your data safety and privacy are our top priority. This guide explains how we protect your information.

---

## Data We Collect

### What We Store

We store:
- Monitor configurations (URL, frequency, check timing)
- Alert history (what changed, when, old/new values)
- Screenshots (if enabled)
- User account information (email, API tokens)
- Aggregated metrics (success rate, uptime, etc.)

### What We DON'T Store

We never store:
- Your passwords or credentials
- Personally identifiable information (PII)
- Credit card or payment information
- Full page HTML (unless explicitly captured)
- Sensitive data from monitored websites

### Data Retention

Default retention policy:

| Type | Keep For | Reason |
|------|----------|--------|
| Alerts | 90 days | Trend analysis |
| Screenshots | 30 days | Proof of changes |
| Account data | Indefinitely | Account management |
| Metrics | 1 year | Performance tracking |
| Logs | 7 days | Debugging |

You can adjust retention per monitor (Settings → Keep history).

---

## Encryption & Security

### In Transit

All data is encrypted:

**HTTP**
```
❌ Not recommended
http://localhost:8765/dashboard  (unencrypted)
```

**HTTPS/WSS**
```
✓ Recommended
https://localhost:8765/dashboard  (encrypted)
wss://localhost:8765  (encrypted websocket)
```

**TLS Version:** 1.2+ (industry standard)

**Cipher Suites:** All strong (no weak/deprecated ciphers)

### At Rest

Database encryption:

```
Encryption: AES-256
Location: Data stored in encrypted database
Key management: Managed by hosting provider
Backups: Encrypted backups only
```

---

## Authentication & Access Control

### API Tokens

Your API token:
- 64-character random string
- Never shared or logged
- Can be rotated anytime
- Expires: Never (until you rotate)

**Keep your token safe:**
```javascript
// Good
const token = process.env.BASSET_API_TOKEN;  // From env var

// Bad (don't do this!)
const token = 'ghp_xyz123...';  // Hardcoded in code
```

### Dashboard Password

Optional password protection:
```
Settings → Security → Enable Password
Set: [Your password]
```

### Session Management

Dashboard sessions:
- Expire: 24 hours of inactivity
- Cookies: Secure, HttpOnly, SameSite
- CSRF protection: Enabled
- Token storage: Secure (not localStorage)

---

## Data Protection Practices

### Principle of Least Privilege

We only collect data we need:
- Don't store full HTML (extract what's needed)
- Don't store HTML headers/metadata
- Don't log sensitive values
- Delete old data automatically

### Data Minimization

Reduced storage and exposure:
- Compression: 70-93% size reduction
- Only changed data stored
- Automatic cleanup (after retention period)

### Access Control

Who can access your data:

```
You: Full access (owner)
  ├─ Dashboard: All monitors, alerts, settings
  ├─ API: All endpoints
  └─ Exports: Download all data

Team members (optional sharing):
  ├─ Read-only: View monitors/alerts
  ├─ Edit: Modify monitor settings
  └─ Admin: Full access (you grant)

Basset team: Limited access
  ├─ No automatic access to your data
  ├─ Can only see if you grant permission
  ├─ Used for debugging if you request help
  └─ Never shared with third parties
```

---

## Privacy Compliance

### GDPR (General Data Protection Regulation)

We're GDPR compliant:

**Your rights:**
- [ ] Right to access: Export all your data
- [ ] Right to deletion: Delete accounts and data
- [ ] Right to portability: Download data in standard format
- [ ] Right to object: Stop processing (pause monitors)

**How to use your rights:**
```
Access data: Dashboard → [Export History]
Delete account: Settings → [Delete Account]
Download data: Dashboard → [Export All Data]
```

### CCPA (California Consumer Privacy Act)

We're CCPA compliant:

- Disclose what data we collect: ✓
- Allow you to delete data: ✓
- Don't sell your data: ✓
- You can opt-out: ✓

### Other Regulations

- **SOC 2:** Compliant (Type II, audit in progress)
- **HIPAA:** Not applicable (not healthcare)
- **PCI DSS:** Not applicable (don't handle payments)

---

## Third-Party Services

### Infrastructure Providers

We use:

| Service | Purpose | Privacy |
|---------|---------|---------|
| AWS | Database hosting | [AWS Privacy](https://aws.amazon.com/privacy/) |
| Slack | Notifications | [Slack Privacy](https://slack.com/privacy) |
| SendGrid | Email | [SendGrid Privacy](https://sendgrid.com/legal/privacy/) |

**All have data processing agreements (DPA).**

### Analytics

We use (anonymized):
- Server logs (IP, endpoint, error rate - no personal data)
- Feature usage (which features used - no user data)

**Never tracked:**
- Individual monitor details
- Alert contents
- Website URLs
- User behavior

---

## Vulnerability Reporting

Found a security issue?

**Please report responsibly:**

1. Email: security@basset-hound.io
2. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (optional)

3. We'll:
   - Acknowledge within 24 hours
   - Fix within 7 days
   - Credit you (if desired)
   - Update users

**Don't:** Publicize vulnerability before fix

---

## Security Best Practices for Users

### 1. Protect Your API Token

**Do:**
- [ ] Store token in environment variables
- [ ] Rotate token regularly (Settings → API)
- [ ] Use different tokens for different apps
- [ ] Never commit token to GitHub

**Don't:**
- [ ] Hardcode token in code
- [ ] Share token via email/Slack
- [ ] Use same token for multiple apps
- [ ] Log token in debug output

### 2. Use HTTPS

**In production:**
```
https://your-domain.com:8765  (required)
wss://your-domain.com:8765    (required)
```

**Locally (development):**
```
http://localhost:8765  (OK for development)
ws://localhost:8765    (OK for development)
```

### 3. Set a Dashboard Password

```
Settings → Security → Enable Password
Create strong password: [16+ characters, mixed case, symbols]
```

### 4. Monitor Access Logs

Check who accessed your dashboard:
```
Settings → Security → Recent Activity
  June 2, 2:45 PM: Chrome on Mac
  June 2, 2:30 PM: Firefox on Windows
  June 2, 2:15 PM: Safari on iPhone
```

### 5. Secure Your Webhooks

When sending to external webhooks:

```javascript
// Good: Verify webhook signature
const crypto = require('crypto');
const hash = crypto
  .createHmac('sha256', SECRET)
  .update(req.body)
  .digest('hex');

if (hash === req.headers['x-basset-signature']) {
  // Valid webhook from Basset Hound
  processAlert(req.body);
}

// Bad: Accept any POST without verification
app.post('/webhook', (req, res) => {
  processAlert(req.body);  // No verification!
});
```

---

## Incident Response

### If Your Account is Compromised

1. **Immediately:**
   - Change your dashboard password
   - Rotate your API token
   - Review "Recent Activity"

2. **Then:**
   - Check for unauthorized monitors
   - Review recent alerts/exports
   - Report to support

3. **Email:** support@basset-hound.io
   - Include: When you noticed, what changed
   - We'll investigate and help secure

### If We Have a Breach

We'll notify:
- **Directly:** Email to account address
- **Timeline:** Within 24 hours of discovery
- **Details:** What data was accessed
- **Next steps:** How to protect yourself

**Note:** We maintain cyber insurance and incident response plan.

---

## Monitoring Ethically

Before you monitor, ask:

### Legal Questions

- [ ] Is the website public (not private)?
- [ ] Does the site allow monitoring (check robots.txt)?
- [ ] Does the site allow this in Terms of Service?
- [ ] Is monitoring legal in my jurisdiction?

### Ethical Questions

- [ ] Do I have a legitimate reason to monitor?
- [ ] Am I being respectful (not overloading)?
- [ ] Would the site owner approve?
- [ ] Am I respecting privacy regulations?

### Best Practices

**Do:**
- ✓ Monitor public websites
- ✓ Monitor your own properties
- ✓ Get explicit permission if possible
- ✓ Respect robots.txt
- ✓ Use reasonable check frequencies

**Don't:**
- ✗ Monitor private/internal content
- ✗ Bypass access controls
- ✗ Overload websites (spam requests)
- ✗ Use data for malicious purposes
- ✗ Ignore Terms of Service

---

## Data Subject Rights (GDPR/CCPA)

### Right to Access

Download all your data:
```
Dashboard → Settings → [Export All Data]
→ Choose format: JSON, CSV, PDF
→ Download (takes 5-10 minutes for large datasets)
```

### Right to Deletion

Delete your account and all data:
```
Dashboard → Settings → [Delete Account]
→ Confirm by typing account email
→ All data deleted within 30 days
```

**Note:** Some data may be retained for legal/audit reasons (anonymized, encrypted)

### Right to Rectification

Correct inaccurate data:
```
Dashboard → Settings → Update account info
```

### Right to Restrict

Pause monitoring temporarily:
```
Monitor Settings → Pause Monitoring
→ Monitor stops checking but data is kept
```

### Right to Portability

Export data in standard format:
```
Dashboard → Settings → [Export All Data]
→ JSON or CSV format (import to other tools)
```

---

## Transparency

### What We Know About You

```
Account information:
  ├─ Email address
  ├─ API tokens
  ├─ Dashboard password (hashed)
  ├─ Subscription plan
  └─ Billing info (if paid)

Usage information:
  ├─ Number of monitors created
  ├─ Check frequency patterns
  ├─ Alert types (price, content, etc.)
  ├─ Integrations used (Slack, webhooks, etc.)
  └─ API usage statistics

Device information:
  ├─ IP address (when accessing dashboard)
  ├─ Browser type
  ├─ Operating system
  └─ Approximate location (by IP)
```

### What We DON'T Know

```
Monitor details:
  ├─ Specific URLs monitored (we know site exists, not your selection)
  ├─ Alert contents (what changed)
  ├─ Screenshots (stored encrypted)
  └─ Your business logic

Personal information:
  ├─ Names of people you monitor
  ├─ Other passwords/credentials
  ├─ Financial data
  └─ Health/medical information
```

---

## Third-Party Integrations

### Slack Integration

When you connect Slack:
- We get permission to post in your chosen channel
- We post alerts containing: monitor name, values, timestamp
- We don't: Access your Slack history, read other messages, etc.

**Slack sees:**
- Your workspace information
- Your chosen channel name
- Our integration is installed

**You control:**
- Which channel we post to (change anytime)
- Whether to disconnect (removes all access)

### Webhook Integration

When you set up a webhook:
- We send HTTP POST with alert data
- You receive: monitor info, old/new values, timestamp
- We don't: Store webhook responses, access your systems

**Your webhook server receives:**
```json
{
  "event": "alert",
  "timestamp": "...",
  "alert": {
    "monitor_id": "...",
    "monitor_name": "...",
    "old_value": "...",
    "new_value": "..."
  }
}
```

**Best practice:** Verify webhook signature before processing

---

## Compliance Checklist

Before using in enterprise:

- [ ] Read this entire document
- [ ] Review GDPR/CCPA sections (if applicable)
- [ ] Check your jurisdiction's regulations
- [ ] Get legal approval (if required)
- [ ] Configure security settings (password, HTTPS)
- [ ] Review data retention policies
- [ ] Test disaster recovery (export data)
- [ ] Set up access logs review schedule

---

## Questions?

**About security:** security@basset-hound.io

**About privacy:** privacy@basset-hound.io

**General:** support@basset-hound.io

---

## Document Info

**Last Updated:** June 2, 2026

**Next Review:** June 9, 2026

This document will be updated as:
- Regulations change
- Our practices evolve
- New features are added
- Security measures improve

**Subscribe to updates:** security@basset-hound.io

---

**Thank you for trusting us with your data.** We take security and privacy seriously. 🔒
