# Troubleshooting Guide: Fix Common Issues

Systematic troubleshooting guide to diagnose and fix issues quickly.

---

## Starting Point: Diagnostic Checklist

Before diving into specific issues, run through this:

```
□ Is Basset Hound Browser running?
  curl http://localhost:8765/health
  → Should see: {"status":"healthy"}

□ Can you reach the dashboard?
  http://localhost:8765/dashboard
  → Should see: Dashboard loads without errors

□ Do you see any error messages?
  → Note them down (they help diagnosis)

□ When did the issue start?
  → Just now? After an update? Long time ago?

□ Is it affecting all monitors or just one?
  → All = system issue
  → One = monitor configuration issue
```

---

## Issue 1: Browser Won't Start

### Symptoms
- Docker container won't start
- npm start hangs or exits with error
- "Port already in use" error

### Diagnosis

**Check 1: Port conflict**
```bash
# Is port 8765 already in use?
lsof -i :8765
# OR (Windows):
netstat -ano | findstr :8765

# If something is using it, you can:
# Option A: Change the port
PORT=8766 npm start
# Option B: Kill the process using port 8765
kill -9 [PID]
```

**Check 2: Permissions**
```bash
# Can you write to the data directory?
touch /path/to/basset-hound/data/test.txt
# If not, you need permission fixes
chmod -R 755 /path/to/basset-hound/data
```

**Check 3: System resources**
```bash
# Do you have enough RAM and disk space?
free -h        # Check RAM
df -h /path/to/basset-hound    # Check disk
# Need: 1GB RAM minimum, 500MB disk
```

### Solutions

**Solution A: Change the port**
```bash
# Use a different port (e.g., 8766)
PORT=8766 npm start
# Then access at http://localhost:8766/dashboard
```

**Solution B: Check logs for errors**
```bash
# Docker
docker logs basset-hound-browser
# Look for error messages, permission issues, etc.

# npm
npm start 2>&1 | tee debug.log
# Look in debug.log
```

**Solution C: Clean restart**
```bash
# Docker
docker stop basset-hound-browser
docker rm basset-hound-browser
docker run -p 8765:8765 basset-hound-browser:latest

# npm
npm stop
npm install  # Reinstall dependencies
npm start
```

---

## Issue 2: Dashboard Won't Load

### Symptoms
- Browser shows blank page
- "Cannot connect to server" error
- Dashboard loads but shows "Loading..." forever

### Diagnosis

**Check 1: Server is running**
```bash
curl http://localhost:8765/health
# Should see: {"status":"healthy"}
```

**Check 2: Network connectivity**
```bash
# Can you reach the server?
ping localhost
# Or try from another computer:
ping [your-computer-ip]
```

**Check 3: Browser cache**
- Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
- Clear cookies: Settings → Privacy → Clear browsing data

### Solutions

**If server isn't healthy:**
```bash
# Check logs
docker logs basset-hound-browser
# Look for errors like "Connection refused" or "Port already in use"

# Restart
docker restart basset-hound-browser
```

**If browser can't reach server:**
```bash
# Are you using the right address?
# If on same computer: http://localhost:8765
# If on different computer: http://[your-ip]:8765
# To find your IP:
ip addr show  # On Linux
ifconfig      # On Mac
ipconfig      # On Windows
```

**If dashboard loads slowly:**
- Check browser console for errors: F12 → Console
- Check network tab for failed requests
- Try a different browser

---

## Issue 3: Monitor Not Running / Shows Red Status

### Symptoms
- Monitor status shows red circle (🔴)
- "Connection failed" error
- Monitor hasn't checked in hours

### Diagnosis

**Check 1: Monitor is enabled**
```
Dashboard → Left sidebar → Find monitor
Look for status icon:
  🟢 Green = Running OK
  🟡 Yellow = Warning
  🔴 Red = Error
```

**Check 2: URL is valid**
```bash
# Can you reach the URL manually?
# Try opening the exact URL in your browser
# Example: https://amazon.com/product-xyz
# If it doesn't load for you, it's down for everyone
```

**Check 3: Network connectivity**
```bash
# If using a proxy, test without it first:
Monitor Settings → Proxy: [None]
Click "Check Now"

# If that works, the proxy is the issue
```

**Check 4: Recent error message**
```
In Dashboard:
Monitor name → [View Details]
→ Look at "Last error" section
→ Error message tells you the problem
```

### Common Error Messages & Solutions

| Error | Cause | Fix |
|-------|-------|-----|
| Connection timeout | Site too slow or down | Increase timeout setting |
| Access denied (403) | Site blocking you | Use proxy or slow down |
| Not found (404) | URL doesn't exist | Fix URL, verify it works in browser |
| DNS failed | Can't reach domain | Check Internet connection |
| SSL error | HTTPS certificate issue | Usually site's problem, wait for them to fix |

### Solutions

**If website is down:**
```
✓ Wait for it to come back up
✓ Monitor will resume automatically
✓ You'll get alert when it's back
```

**If monitor timeout:**
```
Monitor Settings
→ Advanced
→ Wait before checking: [5 seconds]
→ Save
→ Check Now
```

**If "Access Denied" error:**

Option 1: Slow down frequency (from every 5 min to every 15 min)
```
Monitor Settings
→ Check frequency: [Every 15 minutes]
→ Save
```

Option 2: Use a proxy
```
Monitor Settings
→ Proxy: [Select proxy]
→ Save
→ Check Now
```

Option 3: Check if site allows monitoring
```
Visit site's robots.txt:
https://website.com/robots.txt

Look for:
  Disallow: /  (whole site blocked)
  Crawl-delay: 60  (must wait 60 seconds between checks)
  
Respect these limits
```

**If certificate error:**
```
Usually this is temporary
→ Website is fixing SSL issue
→ Monitor will work again when they fix it

If persistent, try:
Monitor Settings
→ Advanced
→ Disable SSL verification: ✓ (not recommended)
```

---

## Issue 4: Not Getting Alerts

### Symptoms
- Website changes but no alert appears
- Alert shows but wasn't delivered
- Slack/Email not receiving alerts

### Diagnosis

**Check 1: Is monitor actually checking?**
```
Click "Check Now" button next to monitor
→ If it forces a check, monitor is alive
→ If nothing happens, monitor may be paused
```

**Check 2: Are alerts enabled?**
```
Monitor Settings
→ "Alert on changes": ✓ (should be checked)
→ If not, enable and save
```

**Check 3: Is threshold too high?**
```
Monitor Settings
→ "Only alert if change ≥": [Check this value]

If it says "≥ $100" and change is only $5, no alert!
→ Lower to $0 to catch all changes
```

**Check 4: Has anything actually changed?**
```
Monitor History
→ Look at recent checks
→ Do you see "Change detected"?
→ Or just "No changes"?

If no changes detected:
  → Either page didn't change
  → OR we're not detecting it correctly (needs adjustment)
```

**Check 5: Where should alerts appear?**
```
Dashboard alerts:
  → Dashboard → Recent Alerts section
  → Should show within 30 seconds

Slack alerts:
  → Check your Slack channel
  → Check spam (sometimes goes to spam)
  → Verify Slack is connected (Settings → Integrations)

Email alerts:
  → Check inbox AND spam folder
  → Verify email enabled (Monitor Settings → Email ✓)
```

### Solutions

**If threshold is blocking alerts:**
```
Monitor Settings
→ Smart Alerts
→ Minimum change: [$0] (catch everything)
→ Test with "Check Now"
→ Once you see alerts, adjust threshold to your liking
```

**If no changes detected:**
```
Two possibilities:
1. Page truly didn't change
2. We're monitoring wrong part of page

Fix:
→ Monitor Settings → CSS Selector
→ Remove selector (leave blank to monitor whole page)
→ Or try a broader selector: ".main" instead of ".price-tag"
→ Save and "Check Now"
```

**If Slack not receiving:**
```
Check 1: Is Slack connected?
  Settings → Integrations → Slack: Connected?
  
Check 2: Is Slack enabled for this monitor?
  Monitor Settings → Check "Slack Notifications"
  
Check 3: Is channel selected?
  Monitor Settings → Slack → Channel: [#monitoring ▼]
  
If all look good:
  → Click "Check Now"
  → Watch for Slack message within 30 seconds
  → Check spam channels in Slack
```

**If Email not receiving:**
```
Check 1: Email enabled?
  Monitor Settings → Email: ✓

Check 2: Correct email address?
  Settings (top-right) → Email: [your@email.com]

Check 3: Email in spam folder?
  Check spam folder in your email client

Check 4: Email address correct?
  Typo in email address = emails vanish
  → Verify in Settings
```

---

## Issue 5: Alert Spam / Too Many Alerts

### Symptoms
- Getting 50+ alerts per day
- Alerts for tiny changes (e.g., $0.01 price change)
- Slack channel flooded with notifications
- Alerts about content that changes constantly

### Diagnosis

**Check 1: What are we alerting on?**
```
Dashboard → Recent Alerts
→ Look at what's changing
→ Is everything trivial?
→ Is it the same thing over and over?
```

**Check 2: What's the threshold?**
```
Monitor Settings
→ "Only alert if change ≥": [Check current value]
→ Too low? That explains spam
```

**Check 3: Is the page changing naturally?**
```
Some websites change constantly:
  ✗ Timestamps update every minute
  ✗ Stock tickers update constantly
  ✗ "Recently viewed" updates on every visit
  ✗ Advertisement content changes

These need special handling
```

### Solutions

**Solution 1: Raise the threshold** (most effective)
```
Monitor Settings
→ "Minimum change for alert": [$1.00]
→ Anything under $1.00 is ignored
→ Reduces alerts by 80%+
```

**Solution 2: Enable Smart Alerts**
```
Monitor Settings
→ Smart Alerts: ✓ (enable)
→ This filters out:
  ✓ Duplicate consecutive changes
  ✓ Changes that revert quickly
  ✓ Time-sensitive content
  ✓ Session IDs and tracking
```

**Solution 3: Slow down frequency**
```
Monitor Settings
→ Check frequency: [Every 15 minutes] (instead of 5)
→ Fewer checks = fewer potential alerts
→ Even if page changes, you only check every 15 min
```

**Solution 4: Monitor specific element only**
```
Instead of monitoring whole page:

Monitor Settings
→ CSS Selector: [.price-tag]  (just the price)
→ This ignores ads, timestamps, etc.
```

**Solution 5: Ignore noisy elements**
```
Monitor Settings
→ Advanced
→ Ignore patterns: [.timestamp, .ad, .recommendations]
→ These elements are ignored in comparisons
```

**Solution 6: Use different alert channels by priority**
```
High priority alerts → Slack #critical (instant)
Low priority → Slack #monitoring (less noisy)
Trivial → Disabled or email digest only
```

---

## Issue 6: Screenshot Storage / Disk Space

### Symptoms
- Disk running out of space
- Monitoring slowing down
- Error: "No space left on device"

### Diagnosis

**Check disk usage:**
```bash
# How much disk space do we have?
df -h /path/to/basset-hound/

# How much is data using?
du -sh /path/to/basset-hound/data/
```

**Screenshots use space:**
```
No screenshots:     ~100 KB per check
With screenshots:   ~500 KB - 2 MB per check

Example:
  Monitor checking every 15 minutes
  Over 30 days: 2,880 checks
  = 288 MB to 5.7 GB (with screenshots!)
```

### Solutions

**Solution 1: Delete old screenshots** (fastest)
```
Monitor Settings
→ Keep history: [Last 30 days]
→ Old data auto-deletes
→ Reclaims space immediately
```

**Solution 2: Disable screenshots for this monitor**
```
Monitor Settings
→ Capture screenshots: ☐ (disable)
→ Reduces storage by 80%
→ Saves bandwidth too
```

**Solution 3: Disable screenshots globally**
```
Dashboard Settings
→ Data & Privacy
→ Store screenshots: ☐
→ Applies to all new monitors
```

**Solution 4: Archive data before deleting**
```
Before deleting, export for records:

Monitor → [Export History]
→ Format: [CSV]
→ Save to external storage
→ Then you can safely delete old data
```

---

## Issue 7: Slack Integration Not Working

### Symptoms
- Slack says "Permission denied"
- Alerts not appearing in Slack
- "Slack not connected" error

### Diagnosis

**Check 1: Is Slack connected?**
```
Dashboard Settings → Integrations → Slack
→ Should show "Connected" with checkmark
```

**Check 2: Did you approve the app?**
```
When you click "Connect to Slack":
→ Browser opens Slack
→ You need to approve the app
→ Then select workspace
→ Then select channel
```

**Check 3: Is app still valid?**
```
Slack can revoke permissions if:
  - You revoked the app
  - Admin disabled the app
  - Token expired (after 6 months)
```

### Solutions

**Solution 1: Reconnect to Slack**
```
Settings → Integrations → Slack
→ Click "Disconnect" (if shown)
→ Click "Connect to Slack" again
→ Approve in Slack
→ Select channel again
```

**Solution 2: Check Slack workspace permissions**
```
In Slack workspace:
  Settings → Apps → Basset Hound Browser
  → Make sure app is enabled
  → Check it has permission to post
```

**Solution 3: Try different channel**
```
Monitor Settings
→ Slack Channel: [Try #general] (different channel)
→ Save
→ Click "Check Now"
→ See if alert appears in new channel
```

**Solution 4: Check Slack for hidden alerts**
```
Slack might put our messages in spam/hidden channels
→ Slack workspace → All Unreads
→ Look for messages from Basset Hound
→ Might be in unexpected channel
```

---

## Issue 8: API Connection Issues

### Symptoms
- API requests fail
- 401 Unauthorized error
- Webhooks not being called

### Diagnosis

**Check 1: Server is running**
```bash
curl http://localhost:8765/health
```

**Check 2: API endpoint exists**
```bash
curl http://localhost:8765/api/monitors
# Should return list of monitors
```

**Check 3: Authentication if required**
```bash
# If you have a token
curl http://localhost:8765/api/monitors \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Solutions

**If 401 (Unauthorized):**
```bash
# Check your token
→ Settings → API Token
→ Copy the full token (including "Bearer " if shown)

# Try again with correct format
curl -H "Authorization: Bearer YOUR_FULL_TOKEN" \
  http://localhost:8765/api/monitors
```

**If webhook not being called:**
```
Check 1: Webhook URL is correct
  Monitor Settings → Webhooks → URL

Check 2: Webhook server is reachable
  curl https://your-webhook-url
  → Should not return "Connection refused"

Check 3: Webhook is enabled
  Monitor Settings → Webhooks: ✓

Check 4: Event type is selected
  Monitor Settings → Webhooks → Event types
  → Check "All alerts" or specific types
```

See API-INTEGRATION.md for full API documentation.

---

## Issue 9: Performance / Slowness

### Symptoms
- Checks take 10+ seconds
- Dashboard is slow
- Many monitors = server gets sluggish

### Diagnosis

**Check what's slow:**
```
Is it:
  A) Individual monitor checks (slow)
  B) Dashboard UI (slow)
  C) Overall system (sluggish)
```

**If individual checks slow:**
```
Monitor Settings → Advanced
Look for:
  - Capture screenshots: ✓ (slow!)
  - Execute JavaScript: ✓ (slow!)
  - Wait time: 5 seconds (increase = slower)
```

**If dashboard slow:**
```
You might have too many monitors or alerts
→ Try filtering to smaller set
→ Try different browser
→ Try hard refresh: Ctrl+Shift+R
```

**If overall system slow:**
```
Check system resources:
  free -h        (RAM usage)
  top            (CPU usage)
  df -h          (Disk space)
  
May need:
  → More RAM
  → Fewer monitors
  → Slower check frequency
```

### Solutions

**Solution 1: Disable screenshots** (most effective)
```
Monitor Settings
→ Capture screenshots: [☐ Disable]
→ Checks go from 3-5s to 0.5-1s
```

**Solution 2: Disable JavaScript execution**
```
Monitor Settings
→ Execute JavaScript: [☐ Disable]
→ Only use if you don't need it
```

**Solution 3: Increase check frequency** (paradoxically helps)
```
Every 5 min → Every 15 min
→ Fewer checks happening concurrently
→ Overall load is lower
```

**Solution 4: Batch operations** (for API)
```
Instead of creating 100 monitors individually:
  POST /api/batch with 100 monitors at once
  → Faster than 100 individual requests
```

See API-INTEGRATION.md for batch operations.

---

## Issue 10: Getting "Page Load" Errors

### Symptoms
- "Page failed to load" error
- Website works in browser but monitor fails
- JavaScript not executing properly

### Diagnosis

**Check 1: Does page load in your browser?**
```
Open the exact URL in your browser
→ If it loads for you but monitor fails, it's a compatibility issue
```

**Check 2: Is it a JavaScript-heavy site?**
```
Some sites need JavaScript to load content
→ Without JS: Page appears empty
→ With JS: Page loads fully

Current setting:
  Monitor Settings → Execute JavaScript: [☐ or ✓]
```

**Check 3: Does site require login?**
```
We can't monitor password-protected pages
→ But you can monitor public parts
→ Or use public API endpoints
```

### Solutions

**If site needs JavaScript:**
```
Monitor Settings
→ Execute JavaScript: ✓ (enable)
→ Wait time: [5 seconds] (give JS time to run)
→ Save
→ Check Now
```

**If you're getting blank pages:**
```
Options:
1. Monitor a different URL (public one)
2. Monitor an API endpoint instead
3. Contact website about monitoring permissions
4. Use a custom JavaScript to extract what you need
```

**If site requires authentication:**
```
We don't store passwords (for security)
Options:
1. Monitor public parts of the site
2. Use an API token (if site provides public API)
3. Use a webhook: push data to us instead
4. Ask site for monitoring/API access
```

---

## Still Stuck?

### Getting Help

**Check these first:**
1. See FAQ.md for common questions
2. Check KNOWN-ISSUES.md for known limitations
3. Search GitHub issues: https://github.com/basset-hound/browser/issues

**Then contact support:**
- Email: support@basset-hound.io
- Slack: [Community Slack](https://basset-hound.io/slack)
- GitHub: [Create issue](https://github.com/basset-hound/browser/issues/new)

**Include in your report:**
```
- What's happening (clear description)
- What you expected to happen
- Steps to reproduce the issue
- Screenshots if possible
- Monitor settings (URL, frequency, etc.)
- Your system info (OS, version, etc.)
- Error messages from logs
```

**We'll help you fix it!** 🚀
