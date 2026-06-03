# Best Practices Guide: Monitor Like a Pro

Master these practices to get the most value from Basset Hound Browser and avoid common pitfalls.

---

## Alert Tuning: The Most Important Skill

The difference between useful monitoring and alert fatigue is **tuning**. Here's how to master it.

### Rule #1: Only Alert on Changes You Care About

**Problem:** You're monitoring Amazon's product page for price changes, but you get alerts for:
- Every time the page reloads
- Tiny fluctuations ($0.01 changes)
- When their "Customers Also Bought" section updates
- When stock status changes

**Solution:** Use Alert Thresholds and Smart Alerts

```
Monitor Settings → Alert Threshold
────────────────────────────────────
Monitor Type: Product Price
Minimum change threshold: $5.00
Only alert if: Price decreases (not increases)
Ignore elements: .recommendations, .ads, .stock-status
```

**Now you'll only get alerts when the price drops $5 or more.** Perfect!

### Rule #2: Adjust Frequency to Your Use Case

Different monitoring scenarios need different frequencies:

```
USE CASE                    FREQUENCY       WHY
────────────────────────────────────────────────────────────
Competitor price drops      Every 15 min    Need to react quickly
News monitoring              Every 30 min    News updates hourly
Stock price tracking        Every 1 min     Highly volatile
Job postings                Every 1 hour    Don't change that fast
Company website changes     Every 4 hours   Rarely change
```

**Pro tip:** Start with frequent checks, then slow down if you're not getting useful alerts.

### Rule #3: Use Smart Alerts to Reduce Noise

Enable Smart Alerts to automatically filter out spam:

```
Monitor Settings → Smart Alerts: ✓ (enabled)
────────────────────────────────────────────────────────
Smart Alerts filters out:
  • Tiny changes below threshold
  • Duplicate consecutive changes
  • Changes that revert within 5 minutes
  • Time-sensitive content (dates, times)
  • Session-based changes (cookies, tracking IDs)
```

**Result:** Fewer alerts, but every one is actionable.

### Rule #4: Test Your Alert Thresholds

Before putting a monitor in production:

1. Set it up in your dashboard
2. Click "Check Now" manually 3-4 times
3. Make sure you're getting alerts you want
4. Adjust thresholds
5. Then let it run

**Example test run:**
```
Monitor: Nike Shoe Price
URL: https://nike.com/shoes/model-123
Initial setup:
  Frequency: Every 15 min
  Threshold: Any change (to see what happens)
  
Day 1: Got 8 alerts (too noisy!)
  Adjust: Minimum change: $10
  
Day 2: Got 1 alert (perfect price drop)
  Final setting: Keep minimum $10
```

---

## Dashboard Organization: Keep It Clean

With many monitors, organization matters.

### Group Related Monitors

Use naming conventions:

```
Monitor names:
  PRICE:Nike-Shoes
  PRICE:Adidas-Shoes
  PRICE:Amazon-Widget
  
  NEWS:TechCrunch-AI
  NEWS:Google-Blog
  NEWS:HackerNews-Security
  
  COMPETITOR:Acme-Website
  COMPETITOR:Acme-Pricing
  COMPETITOR:Acme-Blog
```

**Benefit:** You can quickly find related monitors, sort them, or pause them together.

### Create Monitoring "Projects"

Use tags in monitor names:

```
[CUSTOMER-A]:Price-Monitor
[CUSTOMER-A]:News-Monitor
[CUSTOMER-B]:Pricing-Page
[CUSTOMER-B]:Competitor-Tracking
```

**Then filter by tag when needed:**
```
Dashboard → Filter: [CUSTOMER-A] → See all customer A monitors
```

### Use Descriptive Names

Bad names:
- "Monitor 1"
- "Website"
- "Check"

Good names:
- "Amazon Widget Price - Competitor Tracking"
- "TechNews AI Articles - Research"
- "Job Board - Backend Positions"

---

## Slack Integration: Smart Alert Routing

Set up Slack so your team actually uses the alerts.

### Route Alerts by Priority

```
Create Slack channels:
  #monitoring-critical      (only high-priority alerts)
  #monitoring-price-changes (e-commerce alerts)
  #monitoring-news          (news and content)
  #monitoring-debug         (errors and issues)

Then configure monitors:
  Amazon Price Drop → #monitoring-critical
  Competitor Blog → #monitoring-news
  Our Website Status → #monitoring-critical
  News Feeds → #monitoring-news
```

**Result:** Team only sees relevant alerts, no noise.

### Slack Message Formatting

Our Slack alerts include:

```
🚨 CRITICAL: Amazon Widget Price dropped!
$39.99 → $24.99 (-37.6%)
Time: 2:45 PM today
[View in Dashboard] [Acknowledge] [Ignore]
```

Click **[Acknowledge]** to mark it as read in Slack (also updates dashboard).

### Slack Workflows

Use Slack Workflows to automate responses:

```
When: @basset alert in #monitoring-critical
Then: 
  1. Add reaction: 👀 (eyes)
  2. Create task in your project management tool
  3. Notify @channel
```

---

## Managing Monitor Load: Don't Overwhelm Yourself

### How Many Monitors is Too Many?

```
1-5 monitors:     Easy to manage, manual checks OK
5-20 monitors:    Need good organization, probably want Slack
20-50 monitors:   Need alert tuning and smart alerts, use webhooks
50+ monitors:     Need automation, consider grouping by project
```

### Scaling Strategy: Think in Tiers

```
TIER 1: Critical (get instant alerts)
  • Competitor price drops
  • Security alerts
  • System status pages
  Frequency: Every 5-15 minutes
  Alert to: Slack #critical + email

TIER 2: Important (get daily alerts)
  • Competitor website changes
  • News updates
  • Job postings
  Frequency: Every 1-4 hours
  Alert to: Slack #general or daily email

TIER 3: Nice-to-have (weekly summaries)
  • Market trends
  • Industry news
  • Archive data
  Frequency: Daily or weekly
  Alert to: Weekly email digest
```

---

## Proxy Usage: When to Use Them

### When You Need a Proxy

```
IF monitoring:                          THEN use:
────────────────────────────────────────────────────────
Geo-restricted content                  Geo proxy
High-volume monitoring (>100 req/min)   Rotating proxy
Corporate networks                      Corporate proxy
International content                   Country-specific proxy
Sneaker/ticket sites                    Residential proxy
```

### Proxy Best Practices

1. **Test without proxy first**
   - Is the site blocking you?
   - If it loads fine without proxy, don't add one

2. **Use the right proxy type**
   - Datacenter proxies: Faster, cheaper, obvious
   - Residential proxies: Slower, expensive, look like real users
   - ISP proxies: Good middle ground

3. **Monitor proxy health**
   ```
   In Monitor Settings:
   Proxy: [Select proxy]
   Health check: [Test proxy]
   → If proxy dies, monitor will use backup
   ```

4. **Rotate proxies with caution**
   - More rotation = look less suspicious
   - But also = higher latency and cost
   - Find your balance

---

## Screenshot Capture: Use Strategically

Screenshots consume more storage and bandwidth. Use them wisely.

### When to Enable Screenshots

```
Enable screenshots for:
  ✓ Price/product monitoring (visual proof)
  ✓ Design change detection
  ✓ Competitor research (legal proof of changes)
  ✓ One-off monitors (not high-volume)

Disable screenshots for:
  ✗ News content (text is enough)
  ✗ High-frequency monitors (too much storage)
  ✗ Text-only content
  ✗ If you're on a tight budget
```

**In Monitor Settings:**
```
Capture options:
  ☐ Capture screenshot on every check (heavy)
  ☑ Capture screenshot only on change (recommended)
  ☐ Never capture (light)
  
Screenshot quality: [High ▼]
Keep screenshots: [Last 30 days ▼]
```

---

## Historical Data Management: Keep It Lean

### Retention Strategy

```
Monitor Type              Keep for      Why
────────────────────────────────────────────────────────
Price/Product            90 days       Show trends
News/Content             30 days       Historical reference
System Status            7 days        Just need recent
Competitor Changes       90+ days      Legal proof
Research/Testing         7 days        Clean up when done
```

**Set it in Monitor Settings:**
```
Keep history: [Last 90 days ▼]
→ Automatically deletes old data
→ Reduces storage costs
```

### Exporting Important Data

Before you delete old data, export what matters:

```
Monitor name → [Export History]
→ Format: [CSV ▼] (easy to analyze in Excel)
→ Date range: [Custom] (select what you want)
→ [Download]
```

---

## API Usage: For Power Users

### When to Use the API Instead of Dashboard

Dashboard: Fine for 1-10 monitors
API: Better for:
- 20+ monitors
- Automated workflows
- Custom integrations
- Batch operations

### API Example: Create Multiple Monitors

Instead of clicking "New Monitor" 50 times, use the API:

```bash
# Create 50 monitors from a CSV file
for monitor in $(cat monitors.csv); do
  curl -X POST http://localhost:8765/api/monitors \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"$monitor\",
      \"url\": \"https://example.com/$monitor\",
      \"frequency\": \"every_15_minutes\"
    }"
done
```

See API-INTEGRATION.md for full details.

---

## Performance Tuning: Speed Up Your Monitoring

### If Monitoring is Slow

1. **Check frequency:** Reduce it slightly
   - Every 1 minute → Every 5 minutes (usually fine)
   
2. **Disable unnecessary features:**
   - Screenshots: Often the slowest part
   - JavaScript execution: Only use if needed
   - Proxy rotation: More rotation = slower

3. **Monitor less content:**
   - Instead of full page: use CSS selector for specific element
   - Monitor: `.price-tag` instead of `body`

4. **Use compression:**
   - Dashboard → Settings → Enable compression (default: on)
   - Saves bandwidth, slightly slower locally

---

## Troubleshooting Common Scenarios

### Scenario: Too Many Alerts, Not Enough Signal

```
Problem: Getting 50+ alerts per day, all noise
Solution:
  1. Enable Smart Alerts (Settings → Smart Alerts: ✓)
  2. Increase minimum change threshold ($1 → $10)
  3. Slow down frequency (Every 5 min → Every 30 min)
  4. Disable screenshots (save resources)
  5. Filter out noisy elements (ads, recommendations)
```

### Scenario: Missing Important Alerts

```
Problem: I know the website changed, but no alert
Check:
  1. Is monitor enabled? (Check left sidebar)
  2. Is threshold too high? (Set to $0 to catch everything)
  3. Is URL correct? (Try opening it in your browser)
  4. Click "Check Now" - does it detect the change?
  5. Is it a JavaScript-heavy site? (May need to wait longer)
```

### Scenario: Monitor Keeps Failing

```
Problem: Status shows red, "Connection timeout"
Try:
  1. Is the website working? (Open in your browser)
  2. Try without a proxy (Settings → Proxy: None)
  3. Increase wait timeout (Settings → Wait before check: 5 sec)
  4. Check your network (is Internet working?)
  5. If site blocks scrapers, use residential proxy
```

---

## Legal & Ethical Considerations

### Monitoring Best Practices

**Do:**
- ✓ Monitor public websites
- ✓ Monitor your own properties
- ✓ Monitor content you have permission to monitor
- ✓ Respect rate limits and robots.txt

**Don't:**
- ✗ Monitor competitors' internal/private content
- ✗ Overload websites (use reasonable check frequency)
- ✗ Ignore robots.txt directives
- ✗ Use scraped data for malicious purposes

**Check robots.txt:**
```
Before monitoring a website, check:
  https://website.com/robots.txt

Look for lines like:
  Disallow: /private
  Crawl-delay: 60  (wait 60 seconds between checks)

Respect these limits in your monitor frequency.
```

---

## Summary: The Five Rules of Professional Monitoring

1. **Tune, then launch** - Test alerts before relying on them
2. **Organize by project** - Keep your monitors grouped and named clearly
3. **Route by importance** - Different channels for different priority levels
4. **Track trends** - Export data before deleting, look for patterns
5. **Respect boundaries** - Monitor ethically and respect website rate limits

Follow these practices and you'll get alerts you actually use instead of noise you ignore.

**Happy monitoring!** 🎯
