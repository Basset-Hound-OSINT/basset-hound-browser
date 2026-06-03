# Quick Start Guide: Get Your First Monitor Running in 10 Minutes

Welcome to Basset Hound Browser! This guide will have you monitoring your first website in 10 minutes or less.

---

## What You'll Need

- Basset Hound Browser installed (v12.1.0+)
- A website you want to monitor
- 10 minutes of your time
- Optional: Slack account for alerts

---

## Step 1: Start the Browser (1 minute)

### On Your Computer

```bash
# Option A: Using Docker (recommended)
docker run -p 8765:8765 basset-hound-browser:latest

# Option B: Using npm
npm install
npm start
```

**Success indicator:** You see "WebSocket server listening on port 8765"

---

## Step 2: Open the Dashboard (1 minute)

Open your web browser and go to:

```
http://localhost:8765/dashboard
```

**What you should see:**
- A welcome screen with "Create Your First Monitor" button
- An empty monitors list on the left
- Navigation menu at the top

---

## Step 3: Create Your First Monitor (3 minutes)

### In the Dashboard

1. Click the blue **+ New Monitor** button in the top-right
2. You'll see a form with these fields:
   - **Name**: What you're monitoring (e.g., "My Competitor's Pricing")
   - **URL**: The website to monitor (e.g., https://example.com/pricing)
   - **Check Frequency**: How often to check (every 1, 5, 15, 60 minutes)
   - **What to Monitor**: What changes matter to you

### Example: E-Commerce Price Monitoring

```
Name: "Amazon Widget Price"
URL: https://www.amazon.com/product-widget
Check Frequency: Every 5 minutes
What to Monitor: Price changes (select "Product Price")
```

### Example: News Monitoring

```
Name: "AI News Headlines"
URL: https://news.google.com/?q=artificial+intelligence
Check Frequency: Every 15 minutes
What to Monitor: New articles (select "Headlines")
```

3. Click **Create Monitor**

**Success indicator:** Your monitor appears in the list on the left side

---

## Step 4: Get Your First Alert (3 minutes)

### Wait for a Change

The monitor will start checking your website. To see how alerts work quickly:

**Option A: Manual Check** (immediate)
- Find your monitor in the list
- Click the **Check Now** button
- An alert will appear if anything changed

**Option B: Wait for Automatic Check** (1-5 minutes)
- Your monitor will check automatically
- If something changed, an alert appears

### What an Alert Looks Like

When a change is detected, you'll see:

```
Alert: Price change detected on Amazon Widget Price
Old value: $29.99
New value: $24.99
Time: 2:45 PM
```

---

## Step 5: Connect to Slack (Optional, 2 minutes)

Get alerts sent to Slack instead of (or in addition to) the dashboard.

### In the Dashboard

1. Find your monitor in the list
2. Click the **Settings** (gear icon)
3. Scroll to "Notifications"
4. Toggle **Slack Notifications** ON
5. Click **Connect to Slack**
6. Approve the connection in Slack
7. Select which Slack channel gets alerts

**Success indicator:** You see "Connected to Slack" and a green checkmark

---

## What Happens Next?

Your monitor is now live. Here's what you can do:

### Monitor Your Dashboard

- **View Alerts**: See all changes in the "Recent Alerts" section
- **Check History**: Click your monitor name to see the change history
- **Adjust Frequency**: Change how often it checks (dashboard > monitor settings)

### Common Next Steps

1. **Create More Monitors**: Repeat Steps 3-4 for other websites
2. **Set Up Slack**: Get alerts sent to your team
3. **Explore Advanced Features**: Check out the Dashboard Guide for more options
4. **Configure Webhooks**: Send alerts to other tools (see API Integration guide)

---

## Troubleshooting: 10-Minute Setup Not Working?

### Issue: Dashboard Won't Open

**Try this:**
```bash
# Check if server is running
curl http://localhost:8765/health

# You should see: {"status":"healthy"}
```

If you don't see this, restart the browser:
```bash
docker restart basset-hound-browser
# OR
npm stop && npm start
```

### Issue: Monitor Won't Create

**Check:**
- Is the URL valid? (Try opening it in your regular browser first)
- Is the URL reachable from where you're running Basset Hound Browser?
- Are you seeing any error messages? Take a screenshot and check the Troubleshooting Guide

### Issue: Monitor Created But Not Checking

**What to do:**
- Click "Check Now" to force an immediate check
- Wait 2 minutes - automatic checks may just be starting
- Check monitor settings - verify the frequency isn't set to "Paused"

### Issue: Getting Alerts But They're Not Useful

**Tips:**
- You might be monitoring too much content
- Try narrowing what you're monitoring (just the product price, not the whole page)
- Increase the check frequency if you're getting too many alerts
- See the Best Practices Guide for alert tuning

---

## Next: Explore More Features

You've completed the 10-minute setup! Ready to learn more?

- **Dashboard Guide** (`DASHBOARD-GUIDE.md`) - Learn the dashboard thoroughly
- **Best Practices** (`BEST-PRACTICES.md`) - Monitor like a pro
- **Troubleshooting** (support/`TROUBLESHOOTING.md`) - Fix common issues
- **Use Cases** (`USE-CASES.md`) - Real-world monitoring examples

---

## Need Help?

- **Quick questions?** Check the FAQ in support/`FAQ.md`
- **Something broken?** See support/`TROUBLESHOOTING.md`
- **Want to talk to a human?** Email: support@basset-hound.io

**You're all set!** Your first monitor is running. 🎉
