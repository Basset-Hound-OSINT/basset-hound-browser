# Migration Guides - From Competing Tools

Complete guides for migrating from popular competitor monitoring and automation tools to Basset Hound Browser.

---

## Migration Strategy Overview

**Five-Step Migration Process:**
1. **Assessment** - Evaluate current usage and export data
2. **Planning** - Create migration plan and timeline
3. **Setup** - Install and configure Basset Hound Browser
4. **Migration** - Import data and test functionality
5. **Cutover** - Switch to Basset Hound Browser and cleanup

---

## Migration Guide 1: From Distill Web Monitor

### Overview
Distill is a popular website monitoring tool with browser extension and cloud options. Basset Hound Browser offers superior detection accuracy and more advanced features.

### Step 1: Assessment
**What to export from Distill:**
- Monitor list (via export or API)
- Check frequency settings
- Alert configurations
- Historical data (optional)

**Distill Capabilities to Migrate:**
- Website monitoring ✓ (better in Basset Hound)
- Visual change detection ✓ (superior)
- Email alerts ✓
- Slack integration ✓ (better integration)
- Webhooks ✓ (more flexible in Basset Hound)

### Step 2: Planning
**Migration Timeline:**
- Small (< 50 monitors): 1-2 days
- Medium (50-500): 3-5 days
- Large (500+): 1-2 weeks

**Resource Requirements:**
- 1-2 people for setup and import
- Testing resources (2-3 people)
- Stakeholder communication

### Step 3: Setup
**Installation:**
```bash
docker run -p 8765:8765 basset-hound-browser:latest
```

**Initial Configuration:**
1. Open dashboard at `localhost:8765`
2. Create user account and configure profile
3. Set up integrations (Slack, webhooks, email)
4. Configure proxy settings if needed

### Step 4: Import Monitors
**Export from Distill:**
1. Go to Monitors
2. Select all monitors
3. Export to CSV (via Distill settings)

**CSV Format Expected:**
```csv
name,url,frequency_minutes,detection_type,alert_email
Competitor A Price,https://competitor-a.com,30,visual,alerts@company.com
Competitor B News,https://competitor-b.com/news,60,text,alerts@company.com
```

**Import to Basset Hound Browser:**
1. Go to Dashboard → Import
2. Upload CSV file
3. Map fields:
   - Distill "name" → Basset Hound "monitor_name"
   - Distill "frequency_minutes" → Basset Hound "check_frequency"
   - Distill "detection_type" → Basset Hound "detection_method"
4. Click Import
5. System creates monitors in batch

### Step 5: Cutover
**Testing (before cutover):**
- ☐ Verify all monitors imported successfully
- ☐ Test a few monitors for detection accuracy
- ☐ Verify alerts are delivering
- ☐ Test integrations (Slack, webhooks)
- ☐ Run 24-hour parallel monitoring

**Cutover Process:**
1. Set Distill alerts to inactive
2. Activate all Basset Hound Browser monitors
3. Monitor dashboard for 24 hours
4. Cancel Distill subscription
5. Archive old data (keep for 90 days)

### Feature Comparison

| Feature | Distill | Basset Hound | Winner |
|---------|---------|--------------|--------|
| Detection Accuracy | Good | Excellent | BHB |
| Visual Detection | Yes | Yes (better) | BHB |
| Proxy Support | Limited | Full (50+ providers) | BHB |
| Webhooks | Yes | Yes (more features) | BHB |
| Custom JavaScript | No | Yes | BHB |
| Price | $7-39/mo | Free-$99/mo | Tie |
| API | Yes | Yes (WebSocket) | Tie |

### Tips for Smooth Migration
- Start with non-critical monitors
- Use tags to identify migrated monitors
- Keep Distill running parallel for 1 week
- Document any custom configurations
- Train team on Basset Hound Browser features

---

## Migration Guide 2: From Browserless.io

### Overview
Browserless is an API-based browser automation service. Basset Hound Browser is a self-contained monitoring solution with more specialized features.

### Key Differences
- Browserless: General browser automation API
- Basset Hound Browser: Specialized website monitoring
- Basset Hound Browser: Self-hosted or cloud (coming 2027)
- Browserless: Managed service with per-API-call pricing

### Step 1: Assessment
**Browserless Usage to Migrate:**
- Website screenshots ✓ (via visual detection)
- Content extraction ✓ (text detection)
- Form submission ✓ (custom JavaScript)
- Website monitoring ✓ (native feature)
- Scheduled checks ✓ (native feature)

**What's Different:**
- Browserless: Pay-per-call model
- Basset Hound Browser: Unlimited monitoring

### Step 2: Setup
```bash
docker run -p 8765:8765 basset-hound-browser:latest
```

### Step 3: Migrate Custom Automations
**Convert Browserless scripts to Basset Hound monitors:**

**Before (Browserless):**
```javascript
// Scheduled job calling Browserless API
const response = await fetch('https://chrome.browserless.io/screenshot', {
  method: 'POST',
  body: JSON.stringify({
    url: 'https://example.com',
    waitForSelector: '.product-price'
  })
});
```

**After (Basset Hound Browser):**
```
1. Create monitor for https://example.com
2. Set detection method: Element Detection
3. Set selector: .product-price
4. Set frequency: Per your needs
5. Enable webhooks to process results
```

### Step 4: Set Up Webhooks
**Instead of calling Browserless API, receive webhooks:**

```javascript
// Your webhook receiver
app.post('/webhook/detection', (req, res) => {
  const detection = req.body;
  console.log('New detection:', detection);
  // Process detection (same as your Browserless processing)
  res.json({ success: true });
});
```

**Configure in Basset Hound Browser:**
- Go to Monitor → Advanced
- Enable Webhooks
- Set endpoint to your receiver URL
- Choose which detections to send

### Cost Comparison
| Usage | Browserless | Basset Hound |
|-------|------------|--------------|
| 1,000 checks/month | $20-50 | Free/tier-based |
| 10,000 checks/month | $100-200 | Free-$99 |
| 100,000 checks/month | $500-1000 | $99-299 (self-hosted) |

---

## Migration Guide 3: From Selenium Grid

### Overview
Selenium Grid is for distributed test automation. Basset Hound Browser is specialized for monitoring.

### When to Migrate
- Monitoring work instead of testing
- Want simpler setup
- Need better detection accuracy
- Want built-in alerting and dashboards

### When NOT to Migrate
- Still doing heavy test automation
- Need complex multi-page workflows
- Cross-browser testing required
- Better to keep Selenium Grid

### Step 1: Assess Current Use
**Monitoring-focused Selenium use:**
✓ Periodic website checks
✓ Simple form filling and submission
✓ Status page monitoring
✓ Health checks

**Automation-focused Selenium use:**
✗ Complex multi-step workflows
✗ Cross-browser testing
✗ Dynamic testing scenarios
✗ Complex assertions

### Step 2: If Suitable for Migration
**Setup Basset Hound Browser:**
```bash
docker run -p 8765:8765 basset-hound-browser:latest
```

### Step 3: Convert Selenium Tests to Monitors
**Before (Selenium):**
```python
from selenium import webdriver
from selenium.webdriver.common.by import By

driver = webdriver.Remote('http://grid:4444/wd/hub')
driver.get('https://example.com')
price = driver.find_element(By.CLASS_NAME, 'price').text
print(f"Price: {price}")
driver.quit()
```

**After (Basset Hound Browser):**
```
1. Create monitor for https://example.com
2. Detection method: Element detection
3. Selector: .price
4. Webhook receives price changes automatically
```

### Step 4: Custom JavaScript for Complex Logic
**If you need more than basic monitoring:**

```javascript
// Custom JavaScript in monitor
// This executes before monitoring

// Wait for dynamic content
await new Promise(resolve => {
  const checkPrice = () => {
    const priceEl = document.querySelector('.price');
    if (priceEl && priceEl.textContent) {
      resolve();
    } else {
      setTimeout(checkPrice, 100);
    }
  };
  checkPrice();
});

// If you need to simulate user behavior
document.querySelector('.expand-details').click();
await new Promise(r => setTimeout(r, 1000));
```

---

## Migration Guide 4: From Phantom Buster / Apify

### Overview
Phantom Buster and Apify are web scraping and automation platforms. Basset Hound Browser is specialized for monitoring.

### Key Scenarios
**Monitoring Use Cases (migrate to Basset Hound):**
- Product price tracking
- Job listing monitoring
- Real estate monitoring
- Competitor tracking
- Public data monitoring

**Scraping Use Cases (keep Apify):**
- Large-scale data extraction
- Complex multi-page scraping
- Database seeding
- Data migration
- Research data collection

### If Migrating Monitoring Workloads

**Before (Apify):**
```javascript
// Actor that runs periodically
const { apifyClient } = Apify;
const priceHistory = [];

while(true) {
  const data = await scrapePrice();
  priceHistory.push(data);
  await sleep(3600000); // 1 hour
}
```

**After (Basset Hound Browser):**
```
1. Create monitor for price URL
2. Set frequency: 1 hour
3. Enable webhooks
4. Receive changes automatically
```

### Cost Comparison
| Monitoring Workload | Apify | Basset Hound |
|-------------------|-------|--------------|
| 30 checks/day | $10-50 | Free |
| 100 checks/day | $50-200 | Free-$99 |
| 1000 checks/day | $200-500 | $99-299 |

---

## Migration Guide 5: From Custom In-House Solution

### Overview
Organizations using custom monitoring scripts or tools can benefit from Basset Hound Browser's reliability and features.

### Assessment Framework
**Rate Your Current Solution (1-5, 5=best):**
- Reliability: ___ (Basset Hound: 5)
- Detection accuracy: ___ (Basset Hound: 5)
- Alert reliability: ___ (Basset Hound: 5)
- Ease of use: ___ (Basset Hound: 5)
- Scalability: ___ (Basset Hound: 5)
- Maintenance effort: ___ (Basset Hound: Minimal)

**If any score < 4, migration benefits you significantly.**

### Step 1: Evaluate Custom Solution
**Document:**
- How many monitors: ___
- Check frequency: ___
- Detection methods: ___
- Alert delivery: ___
- Maintenance burden: ___ hours/month
- Downtime incidents: ___ in past year

### Step 2: Plan Migration
**Resource Requirements:**
- Time to migrate: 1 hour per 50 monitors
- Testing time: 1 day
- Parallel run: 1 week (optional)

### Step 3: Implement Migration
**Option A: Full Switch**
1. Export all monitor configurations
2. Create Basset Hound Browser monitors
3. Test all monitors
4. Switch monitoring overnight
5. Retire old solution

**Option B: Gradual Migration**
1. Start with 10% of monitors
2. Run parallel for 1 week
3. Migrate another 25%
4. Repeat until all migrated

### Step 4: Benefits Realized
**Typical improvements:**
- Maintenance time: 80% reduction
- Infrastructure costs: 60% reduction
- Monitoring uptime: 99.99% SLA
- Detection accuracy: +20-40%
- Alert latency: <1 second
- Team productivity: +30-50%

---

## General Migration Checklist

### Pre-Migration (1 week before)
- [ ] Identify all monitoring workloads
- [ ] Export current configuration
- [ ] Document alert rules and workflows
- [ ] Identify special requirements
- [ ] Plan team training
- [ ] Schedule cutover window
- [ ] Notify stakeholders

### Migration Week
- [ ] Install Basset Hound Browser
- [ ] Set up integrations
- [ ] Configure proxies/credentials
- [ ] Import monitor list
- [ ] Test critical monitors
- [ ] Perform parallel monitoring (24-48 hours)
- [ ] Validate all alerts working
- [ ] Complete team training

### Post-Migration (1 week after)
- [ ] Monitor system stability (24/7)
- [ ] Review detection accuracy
- [ ] Gather team feedback
- [ ] Document any issues
- [ ] Optimize configurations
- [ ] Cancel old service subscription
- [ ] Archive old data

### Success Criteria
- ☐ All monitors working
- ☐ Alerts delivering reliably
- ☐ Detection accuracy acceptable
- ☐ Team confident in tool
- ☐ Performance acceptable
- ☐ No critical issues

---

## Common Migration Issues & Solutions

### Issue 1: Detection Rate Mismatch
**Problem:** Basset Hound Browser detects more/fewer changes than old tool

**Solution:**
- Adjust detection threshold
- Change detection method
- Review filter settings
- Run side-by-side tests
- Tune AI detection settings

### Issue 2: Alert Delivery Delays
**Problem:** Alerts slower than expected

**Solution:**
- Check notification queue
- Verify email/Slack integration
- Review system resources
- Check network connectivity
- Scale monitoring resources

### Issue 3: Authentication Issues
**Problem:** Can't access password-protected sites

**Solution:**
- Re-enter credentials securely
- Check session timeout settings
- Verify authentication method
- Test with simple credentials first
- Check for 2FA requirements

### Issue 4: Proxy Configuration
**Problem:** Proxies not working as expected

**Solution:**
- Test proxy connectivity
- Verify proxy credentials
- Check IP whitelisting
- Try different proxy provider
- Test without proxy first

### Issue 5: High Resource Usage
**Problem:** Monitoring using too much CPU/memory

**Solution:**
- Reduce concurrent monitors
- Lower check frequency
- Switch to lighter detection methods
- Distribute across multiple instances
- Archive old historical data

---

## Migration Support

**Basset Hound Browser Migration Support:**
- Free for all customers
- Dedicated migration specialist available
- Custom migration planning
- Data import assistance
- Parallel testing support
- 30-day post-migration support

**Contact Migration Support:**
- Email: migrations@basset-hound-browser.com
- Support Portal: [Link]
- Chat: Available during business hours

---

*Status: Comprehensive migration guides for major competing tools | Last Updated: June 13, 2026*
