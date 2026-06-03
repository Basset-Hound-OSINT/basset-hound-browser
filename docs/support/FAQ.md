# Frequently Asked Questions (FAQ)

Quick answers to the most common questions. Can't find your answer? See "Getting Help" at the bottom.

---

## Getting Started

### Q: How do I install Basset Hound Browser?

**A:** Two options:

**Option 1: Docker (Recommended)**
```bash
docker run -p 8765:8765 basset-hound-browser:latest
```

**Option 2: From Source**
```bash
git clone https://github.com/basset-hound/browser
cd browser
npm install
npm start
```

See the QUICK-START.md guide for step-by-step instructions.

---

### Q: What are the system requirements?

**A:** Minimum:
- CPU: 2 cores (more is better for multiple monitors)
- RAM: 1 GB (2 GB recommended)
- Disk: 500 MB (more for historical data)
- OS: Linux, macOS, or Windows (Docker recommended)
- Network: Internet connection

**Recommended:**
- CPU: 4+ cores
- RAM: 4 GB
- Disk: 10+ GB (for screenshots and history)
- Bandwidth: 10 Mbps+

---

### Q: How much does it cost?

**A:** Basset Hound Browser has two versions:

| Feature | Open Source | Commercial |
|---------|-----------|-----------|
| Price | Free | $99/month |
| Monitors | Unlimited | Unlimited |
| Checks/month | Unlimited | Unlimited |
| Slack integration | ✓ | ✓ |
| Email alerts | ✓ | ✓ |
| Support | Community | Email + Slack |
| SLA | None | 99.9% uptime |
| Professional services | ✗ | ✓ |

[Compare plans](https://basset-hound.io/pricing)

---

### Q: Can I try before buying?

**A:** Yes! 

- **Open source version:** Free forever, no signup needed
- **Commercial version:** 30-day free trial, no credit card required

Sign up: https://basset-hound.io/signup

---

## Monitoring & Alerts

### Q: How often can I check websites?

**A:** As often as you want! Common frequencies:

```
Every 1 minute:  (High volume - be respectful)
Every 5 minutes: (Competitive monitoring)
Every 15 min:    (Most common)
Every 1 hour:    (Moderate frequency)
Every 4 hours:   (Low frequency)
Every 24 hours:  (Daily check)
```

**Note:** Respect website rate limits and robots.txt. Some sites block frequent scrapers.

---

### Q: Why am I not getting alerts?

**A:** Check these in order:

1. **Is the monitor running?** 
   - Dashboard left sidebar should show green status icon
   - If red, click "Check Now" to diagnose

2. **Are alerts enabled?**
   - Click monitor → Settings → "Alert on changes: ✓"

3. **Is the threshold too high?**
   - Set to minimum ($0) temporarily to test
   - Try: "Alert on any change"

4. **Are you checking the right place for alerts?**
   - Dashboard: Check "Recent Alerts" section
   - Slack: Is the channel connected? (Settings → Integrations)
   - Email: Check spam folder

5. **Has anything actually changed?**
   - Click "Check Now" to force a manual check
   - Wait 5 minutes after monitor creation for first check

See TROUBLESHOOTING.md for more detailed diagnosis.

---

### Q: How do I reduce alert spam?

**A:** Try these in order:

1. **Enable Smart Alerts**
   - Dashboard Settings → Smart Alerts: ✓
   - Filters out duplicate/time-based changes

2. **Increase minimum change threshold**
   - Monitor Settings → "Only alert if change ≥ $5"
   - Ignores tiny fluctuations

3. **Slow down frequency**
   - Every 5 min → Every 15 min
   - Every 15 min → Every 1 hour

4. **Narrow what you monitor**
   - Monitor `.price-tag` instead of whole page
   - Monitor specific elements only

5. **Ignore noisy elements**
   - Settings → Ignore patterns
   - Exclude ads, timestamps, recommendations

See BEST-PRACTICES.md for alert tuning details.

---

### Q: Can I monitor password-protected sites?

**A:** Not directly (for security reasons), but you can:

1. **Monitor the dashboard/reports page:**
   - Many sites show data on public dashboards
   - Monitor that page instead of login-required content

2. **Use API access:**
   - Some services offer public APIs
   - Monitor the API endpoint instead
   - (See API-INTEGRATION.md)

3. **Custom solution:**
   - Use webhooks to send data to us
   - We can monitor your data
   - (Contact support)

---

## Dashboard

### Q: How do I organize many monitors?

**A:** Use naming conventions:

```
[PROJECT]:Monitor-Name
  [AMAZON]:Price-Widget
  [AMAZON]:Stock-Status
  [COMPETITOR]:Pricing-Page
  [NEWS]:TechNews-AI
  [NEWS]:SecurityNews
```

Then:
- Filter by project in Dashboard
- Bulk pause/resume by name pattern
- Export by category

See BEST-PRACTICES.md for organization tips.

---

### Q: Can I share monitors with my team?

**A:** Yes! Three ways:

1. **Shared Dashboard** (Commercial plan)
   - Everyone sees same monitors
   - Shared Slack channel for alerts
   - Team-based access control

2. **Shared Slack Channel** (All plans)
   - Send alerts to shared Slack
   - Team gets notified together
   - Everyone can acknowledge alerts

3. **API Access** (All plans)
   - Export monitor data
   - Build custom dashboard
   - Integrate with other tools

See API-INTEGRATION.md for sharing via API.

---

### Q: Can I export my monitor data?

**A:** Yes!

**From Dashboard:**
- Click monitor name → [Export History]
- Format: CSV, JSON, PDF
- Date range: Custom or preset
- [Download]

**Via API:**
```bash
curl http://localhost:8765/api/monitors/[monitor-id]/history \
  -o history.csv
```

See API-INTEGRATION.md for more export options.

---

## Integrations

### Q: How do I connect Slack?

**A:** Three steps:

1. Dashboard → Settings → Integrations
2. Click "Connect to Slack"
3. Approve the connection in Slack
4. Select channel: [#monitoring ▼]

Then for each monitor:
- Monitor Settings → Check "Slack Notifications"
- Choose channel
- Save

See SLACK-SETUP.md for detailed Slack guide.

---

### Q: How do I set up webhooks?

**A:** 

1. Dashboard → Settings → Integrations → Webhooks
2. Enter your webhook URL: `https://yourapp.com/webhook`
3. Choose event types: price changes, errors, etc.
4. Save

You'll receive POST requests like:
```json
{
  "event": "alert",
  "monitor_id": "amazon-price",
  "timestamp": "2026-06-02T14:45:00Z",
  "old_value": "$29.99",
  "new_value": "$24.99"
}
```

See WEBHOOKS-GUIDE.md for detailed webhook setup.

---

### Q: Can I use the API instead of the dashboard?

**A:** Yes! The API is fully featured:

```bash
# Create a monitor
curl -X POST http://localhost:8765/api/monitors \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","url":"https://example.com"}'

# Get results
curl http://localhost:8765/api/monitors/test/alerts
```

See API-REFERENCE.md for full API documentation.

---

## Proxies & Network

### Q: When do I need a proxy?

**A:** Use a proxy if:

```
❌ Don't need:         ✓ Do need:
- Public websites    - Geo-blocked content
- Your own sites     - High-volume monitoring
- Slow sites         - Rate-limited sites
- One-off monitors   - Sneaker/ticket sites
                      - Competitor data (ethical)
```

---

### Q: Which proxy should I use?

**A:** Proxy types:

| Type | Speed | Price | Detectability | Best For |
|------|-------|-------|----------------|----------|
| Datacenter | Fast | $ | Easy to detect | Speed-critical |
| Residential | Slow | $$$ | Hard to detect | Evasion |
| ISP | Medium | $$ | Medium | Balance |
| Mobile | Slow | $$$ | Very hard | Mobile content |

**Recommendation:** Start without proxy. Add only if needed.

See PROXY-PARTNERS-GUIDE.md for partner options.

---

### Q: How do I rotate proxies?

**A:** 

In Monitor Settings:
```
Proxy Configuration
  Use proxy: ✓
  Proxy: [Select proxy ▼]
  Rotation: [Every check ▼] or [Every 5 checks ▼]
  Fallback: [Rotate if failed ▼]
```

- Every check: Different proxy each time (slower)
- Every 5 checks: Same proxy for 5 checks, then rotate (balanced)
- Smart rotation: Rotate only if site blocks us (fastest)

---

## Performance & Reliability

### Q: How reliable is Basset Hound Browser?

**A:** Very reliable!

- **Uptime:** 99.9% (commercial plan)
- **Monitor success rate:** 99.7% (across all monitors)
- **Alert delivery:** 99.99% (Slack/Email/Webhook)

In English: Out of 1,000 checks, ~997 succeed. Out of 1,000 alerts, 999+ deliver.

See the SECURITY-PRIVACY.md guide for more details.

---

### Q: Why is monitoring slow?

**A:** Slowness usually comes from:

1. **Screenshots:** Disable if you don't need them
   - Screenshot: 2-5 seconds per check
   - No screenshot: 0.5-1 second per check

2. **JavaScript execution:** Disable if not needed
   - With JS: 3-5 seconds per check
   - Without JS: 0.5-1 second per check

3. **Proxy:** Slower than direct connection
   - Direct: 0.5 seconds
   - Proxy: 2-5 seconds

4. **Network:** Check your Internet speed
   - Required: 1+ Mbps
   - Recommended: 10+ Mbps

**Fix:** Disable unnecessary features, increase check frequency (e.g., from every 5 min to every 15 min).

---

### Q: What's the maximum number of monitors?

**A:** No hard limit! But:

```
1-10 monitors:    Any hardware works
10-100 monitors:  Need 2+ CPU cores, 2GB RAM
100-500 monitors: Need 4+ CPU cores, 4GB RAM
500+ monitors:    Need 8+ CPU cores, 8GB RAM
```

Use the API for large-scale setups. See API-INTEGRATION.md.

---

## Troubleshooting

### Q: Monitor shows "Connection Timeout" error

**A:** Try these:

1. **Is the website working?**
   - Open it in your browser
   - If it doesn't load for you, it's down

2. **Try without proxy:**
   - Monitor Settings → Proxy: [None ▼]
   - Save and "Check Now"

3. **Increase timeout:**
   - Monitor Settings → Wait before check: [5 seconds]
   - Some sites are slow to load

4. **Check URL:**
   - Is it correct? Try pasting exact URL from browser

5. **Check network:**
   - Is your Internet working?
   - Can you reach other sites?

See TROUBLESHOOTING.md for more solutions.

---

### Q: I'm getting "Access Denied" errors

**A:** Website is probably blocking your requests. Try:

1. **Use a proxy**
   - Monitor Settings → Proxy: [Residential proxy ▼]
   - Slower but looks like real user

2. **Slow down frequency**
   - Website might rate-limit
   - Every 5 min → Every 15 min

3. **Check robots.txt**
   - https://website.com/robots.txt
   - Respect Crawl-delay and Disallow rules

4. **Contact website**
   - Some sites allow monitoring with permission
   - Explain your use case

See TROUBLESHOOTING.md for more details.

---

### Q: How do I delete a monitor?

**A:** 

In Dashboard:
1. Find monitor in left sidebar
2. Click monitor name to open it
3. Click "Delete" (trash icon)
4. Confirm deletion

**Note:** Deletion is permanent. Export data first if you need it.

---

## Security & Privacy

### Q: Is my data safe?

**A:** Yes! We:

- Encrypt all data in transit (HTTPS/WSS)
- Encrypt sensitive data at rest
- Never store passwords or credentials
- Comply with GDPR, CCPA, SOC 2
- Regular security audits

See SECURITY-PRIVACY.md for full details.

---

### Q: What data do you collect?

**A:** We store:

- Monitor configurations (URL, frequency, etc.)
- Alert history (what changed, when)
- Screenshots (if enabled)
- Aggregated metrics (performance, uptime)

We DON'T store:
- Passwords or credentials
- Personally identifiable information (PII)
- Full page HTML (unless specifically enabled)

See SECURITY-PRIVACY.md for data handling details.

---

### Q: Can I use this for scraping?

**A:** Not really. We:

- Limit data retention (default: 90 days)
- Block bulk data exports
- Monitor for scraping patterns
- Respect robots.txt

If you need bulk data:
- Use public APIs (official)
- Request permission from website
- Use specialized scraping tools

See KNOWN-ISSUES.md for limitations.

---

## Getting Help

### Q: How do I get support?

**A:** Multiple options:

| Channel | Response Time | Best For |
|---------|----------------|----------|
| Email | 24 hours | General questions |
| Slack | 2 hours | Urgent issues |
| GitHub | 48 hours | Bug reports |
| Chat | Real-time | Quick questions |
| Community Forum | 12 hours | Tips & tricks |

**Contact:**
- Email: support@basset-hound.io
- Slack: [Join community Slack](https://basset-hound.io/slack)
- GitHub: [Report issue](https://github.com/basset-hound/browser/issues)
- Web: [Chat with support](https://basset-hound.io/chat)

---

### Q: I found a bug. How do I report it?

**A:** Great! Please:

1. **Check if it's already reported:**
   - GitHub Issues: https://github.com/basset-hound/browser/issues

2. **Create a detailed report:**
   - What happened?
   - What did you expect?
   - Steps to reproduce
   - Your environment (OS, version, etc.)
   - Screenshots (if applicable)

3. **Send to:**
   - GitHub Issues (for bugs)
   - Email (for security issues)
   - Slack (for urgent issues)

---

### Q: How do I request a feature?

**A:** 

1. Check if already requested: [GitHub Issues](https://github.com/basset-hound/browser/issues)
2. Create a feature request with:
   - What feature?
   - Why do you need it?
   - How would you use it?
   - Example scenario
3. Share in:
   - GitHub Issues (public voting)
   - Email (direct to product team)
   - Slack (community discussion)

---

### Q: Are there any guides or tutorials?

**A:** Yes! See:

- **QUICK-START.md** - 10-minute setup
- **DASHBOARD-GUIDE.md** - Complete dashboard walkthrough
- **BEST-PRACTICES.md** - Pro monitoring tips
- **USE-CASES.md** - Real-world examples
- **API-INTEGRATION.md** - API documentation
- **TROUBLESHOOTING.md** - Fix common issues
- **SLACK-SETUP.md** - Slack integration
- **VIDEO-GUIDES.md** - Tutorial transcripts

---

## Still Have Questions?

**Docs:** Browse our [complete documentation](https://basset-hound.io/docs)

**Community:** Join our [Slack community](https://basset-hound.io/slack)

**Email:** [support@basset-hound.io](mailto:support@basset-hound.io)

**GitHub:** [Report issues or request features](https://github.com/basset-hound/browser/issues)

We're here to help! 🎯
