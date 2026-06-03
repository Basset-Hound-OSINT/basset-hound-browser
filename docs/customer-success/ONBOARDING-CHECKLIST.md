# Onboarding Checklist: Your First Day with Basset Hound Browser

Complete this checklist in order. Should take 1-2 hours for full setup. Each section is independent - do as many as you need!

---

## Phase 1: Installation & Access (15 minutes)

**Goal:** Get the browser running and access the dashboard.

### Step 1.1: Install Basset Hound Browser
- [ ] Choose installation method:
  - [ ] Docker (recommended): `docker run -p 8765:8765 basset-hound-browser:latest`
  - [ ] npm: `npm install && npm start`
- [ ] Wait for startup message: "WebSocket server listening on port 8765"
- [ ] **Time taken:** ____ minutes

### Step 1.2: Open Dashboard
- [ ] Open http://localhost:8765/dashboard in your browser
- [ ] You see the dashboard welcome screen
- [ ] Dashboard is loading without errors
- [ ] **Time taken:** ____ minutes

### Step 1.3: Verify Health Check
- [ ] In terminal/command prompt, run:
  ```bash
  curl http://localhost:8765/health
  ```
- [ ] Response includes `"status":"healthy"`
- [ ] **Troubleshooting:** If this fails, see TROUBLESHOOTING.md - "Issue 1"

**Phase 1 Status:** 
- [ ] Complete ✓ (Ready for Phase 2)
- [ ] Issues found (see TROUBLESHOOTING.md)

---

## Phase 2: Create Your First Monitor (15 minutes)

**Goal:** Set up one monitor and see how it works.

### Step 2.1: Choose Your First Website
- [ ] Decide what to monitor:
  - [ ] A competitor's product page (price)
  - [ ] A news site (new articles)
  - [ ] Your own website (changes)
  - [ ] A tech blog (updates)
  - [ ] Other: ______________

- [ ] Verify the URL works:
  - [ ] Open it in your browser
  - [ ] Page loads without errors
  - [ ] Example URL: ________________________

### Step 2.2: Create Monitor
In Dashboard:
- [ ] Click blue **[+ New Monitor]** button
- [ ] Fill in the form:
  - [ ] **Name:** _________________ (e.g., "Amazon Widget Price")
  - [ ] **URL:** _________________ (paste the URL from step 2.1)
  - [ ] **Check Frequency:** [Every 15 minutes ▼]
  - [ ] **Monitor Type:** [Detect any changes ▼]
- [ ] Click **[Create Monitor]**
- [ ] Monitor appears in the left sidebar
- [ ] **Time taken:** ____ minutes

### Step 2.3: Test Your Monitor
- [ ] Find your new monitor in the left sidebar
- [ ] Click **[Check Now]** button (blue)
- [ ] Wait 5 seconds for check to complete
- [ ] You see either:
  - [ ] "No changes detected" (website hasn't changed since we checked)
  - [ ] "Changes detected!" (website changed, see alert)
- [ ] Click on alert (if any) to see what changed

**Phase 2 Status:**
- [ ] Complete ✓ (Ready for Phase 3)
- [ ] Monitor not checking (see TROUBLESHOOTING.md - "Issue 3")
- [ ] Website keeps erroring (see TROUBLESHOOTING.md)

---

## Phase 3: Receive Your First Alert (10 minutes)

**Goal:** Understand how alerts work.

### Step 3.1: Set Alert Threshold
In Dashboard:
- [ ] Click your monitor name in the sidebar
- [ ] Click **[Settings]** (gear icon)
- [ ] Scroll to "Alert Threshold"
- [ ] Set to: [Minimum change: $0.00] (to catch any change)
- [ ] Click **[Save Changes]**

### Step 3.2: Wait for or Trigger an Alert
- [ ] Click **[Check Now]** on your monitor
- [ ] Wait 5 seconds
- [ ] Look in "Recent Alerts" section at top
- [ ] You should see:
  - [ ] "No changes detected" (still no change)
  - [ ] "Changes detected!" (got an alert!)

### Step 3.3: View Alert Details
- [ ] If you got an alert, click it to view details:
  - [ ] See what changed
  - [ ] See old vs. new values
  - [ ] See before/after (if screenshots enabled)

**Phase 3 Status:**
- [ ] Complete ✓ (Ready for Phase 4)
- [ ] Not getting alerts (see TROUBLESHOOTING.md - "Issue 4")

---

## Phase 4: Set Up Slack Alerts (Optional, 10 minutes)

**Goal:** Send alerts to Slack instead of just the dashboard.

### Step 4.1: Connect to Slack (if you use Slack)
In Dashboard:
- [ ] Click **[Settings]** (top-right gear icon)
- [ ] Click **[Integrations]**
- [ ] Click **[Connect to Slack]**
- [ ] Browser opens Slack
- [ ] Click **[Allow]** to approve the app
- [ ] Select Slack workspace: _______________
- [ ] Select channel: [#monitoring ▼]
- [ ] Back in dashboard, you see "Slack Connected ✓"

### Step 4.2: Enable Slack for Your Monitor
- [ ] In monitor settings (gear icon)
- [ ] Scroll to "Notifications"
- [ ] Check **[☑ Slack Notifications]**
- [ ] Choose channel: [#monitoring ▼]
- [ ] Click **[Save Changes]**

### Step 4.3: Test Slack Alert
- [ ] Click **[Check Now]** on your monitor
- [ ] Check your Slack channel in 30 seconds
- [ ] You should see a message from Basset Hound

**Phase 4 Status:**
- [ ] Slack alerts working ✓
- [ ] Slack not connected (see TROUBLESHOOTING.md - "Issue 7")
- [ ] Skipping Slack (OK, you can use dashboard alerts only)

---

## Phase 5: Understand Your Dashboard (15 minutes)

**Goal:** Get comfortable with the dashboard interface.

### Step 5.1: Review Dashboard Sections
- [ ] **Left Sidebar:** Shows all your monitors
  - [ ] Understand status icons:
    - [ ] 🟢 Green = healthy
    - [ ] 🟡 Yellow = warnings
    - [ ] 🔴 Red = error
  - [ ] Find your monitor, note its status

- [ ] **Main Area - Recent Alerts:**
  - [ ] See list of all alerts today
  - [ ] Click one to see details
  - [ ] Understand what changed

- [ ] **Statistics Panel (top):**
  - [ ] Active Monitors: ___ (how many running)
  - [ ] Today's Alerts: ___ (how many changes today)
  - [ ] Last Full Check: ___ (how recently checked)

### Step 5.2: Explore Monitor Settings
- [ ] Click your monitor → **[Settings]** (gear icon)
- [ ] Review each section:
  - [ ] URL and Check Frequency
  - [ ] Alert Threshold
  - [ ] Notifications (Slack, Email, etc.)
  - [ ] Advanced options

- [ ] For now, just review - don't change anything
- [ ] Click **[Cancel]** to close without changes

### Step 5.3: View Monitor History
- [ ] Click your monitor **name** (not settings)
- [ ] You see a timeline/history view
- [ ] See all previous checks and changes
- [ ] This is your audit trail

**Phase 5 Status:**
- [ ] Dashboard understood ✓
- [ ] Need more help (see DASHBOARD-GUIDE.md)

---

## Phase 6: Fine-Tune Your Monitor (15 minutes)

**Goal:** Adjust settings to get useful alerts (not spam).

### Step 6.1: Review Your Alerts
- [ ] Click your monitor → **[History]**
- [ ] Ask yourself:
  - [ ] Are the alerts useful?
  - [ ] Too many alerts? (spam)
  - [ ] Too few? (missing important changes)
  - [ ] Detecting wrong things?

### Step 6.2: Adjust Frequency if Needed
If getting too many alerts:
- [ ] Monitor Settings → Check Frequency
- [ ] Increase: [Every 15 min ▼] → [Every 1 hour ▼]
- [ ] Save and wait (fewer checks = fewer potential alerts)

If getting too few alerts:
- [ ] Make sure monitor is running (green status)
- [ ] Lower threshold to catch smaller changes

### Step 6.3: Adjust Alert Threshold
- [ ] Monitor Settings → Alert Threshold
- [ ] Current setting: ________________
- [ ] Adjustment notes: ________________
- [ ] Save

### Step 6.4: Enable Smart Alerts (reduce spam)
- [ ] Monitor Settings → Smart Alerts: ☐ or ☑
- [ ] If not checked, enable it
- [ ] This filters out most false positives
- [ ] Save

**Phase 6 Status:**
- [ ] Settings tuned ✓
- [ ] Still getting spam (see BEST-PRACTICES.md - "Alert Tuning")
- [ ] Not getting enough alerts (see TROUBLESHOOTING.md)

---

## Phase 7: Create Your Second Monitor (10 minutes)

**Goal:** Confirm you can set up multiple monitors.

### Step 7.1: Choose Website #2
- [ ] Different website to monitor: _________________
- [ ] Verify it loads: [ ]

### Step 7.2: Create Monitor #2
- [ ] Dashboard → **[+ New Monitor]**
- [ ] Fill in:
  - [ ] Name: _________________
  - [ ] URL: _________________
  - [ ] Frequency: [Every 15 minutes ▼]
  - [ ] Type: [Detect any changes ▼]
- [ ] Click **[Create Monitor]**

### Step 7.3: Test It
- [ ] Click **[Check Now]**
- [ ] Verify it's checking
- [ ] You should see results in 5 seconds

**Phase 7 Status:**
- [ ] Monitor #2 created and running ✓
- [ ] Issues (see TROUBLESHOOTING.md)

---

## Phase 8: Organize Your Monitors (5 minutes)

**Goal:** Set up good naming so managing monitors is easy.

### Step 8.1: Review Current Names
- [ ] Current monitor names:
  1. _________________
  2. _________________
  3. _________________

### Step 8.2: Use Naming Convention (optional but recommended)
- [ ] Consider using categories:
  - [ ] PRICE:Amazon-Widget
  - [ ] PRICE:Competitor-Website
  - [ ] NEWS:TechCrunch-AI
  - [ ] etc.

- [ ] Edit your monitors if needed:
  - [ ] Monitor Settings → Change Name
  - [ ] Save

**Phase 8 Status:**
- [ ] Naming decided ✓ (or skip if not needed)

---

## Phase 9: Set Up Additional Notifications (Optional, 10 minutes)

**Goal:** Add Email or Webhook alerts (optional).

### Step 9.1: Email Alerts (Optional)
- [ ] Dashboard → **[Settings]** (top-right)
- [ ] Click **[Notifications]**
- [ ] Email Alerts: [your@email.com]
- [ ] Frequency: [Daily digest ▼]
- [ ] Save

### Step 9.2: Webhooks (Optional - Advanced)
- [ ] Dashboard → **[Settings]** → **[Integrations]**
- [ ] Webhooks: [Enter your webhook URL]
- [ ] Event types: Choose what to alert on
- [ ] Save

**Phase 9 Status:**
- [ ] Email alerts working (or skipped)
- [ ] Webhooks set up (or skipped)

---

## Phase 10: Create a Backup / Export Settings (5 minutes)

**Goal:** Back up your configuration.

### Step 10.1: Export Monitor Settings
- [ ] Monitor → **[Settings]**
- [ ] Look for **[Export Settings]** button
- [ ] Save the JSON file: `monitors-backup-[date].json`
- [ ] Store it safely (cloud storage, email, etc.)

### Step 10.2: Document Your Setup
- [ ] Create a simple document:
  ```
  Basset Hound Browser Setup
  ─────────────────────────
  Install Date: _________
  Monitors Created:
    1. _________________ (monitoring: ______)
    2. _________________ (monitoring: ______)
  
  Alerts go to:
    - Dashboard: ✓
    - Slack: [ ] (#__________)
    - Email: [ ] (________@______)
    - Webhooks: [ ] (________)
  
  Important Notes:
    • _______________
    • _______________
  ```

**Phase 10 Status:**
- [ ] Backup created ✓

---

## Success: You're Ready!

Congratulations! You've completed onboarding. You now:

- [ ] Have Basset Hound Browser running
- [ ] Have created at least one monitor
- [ ] Understand how alerts work
- [ ] Know how to access the dashboard
- [ ] Have set up your preferred alert methods
- [ ] Can create and manage monitors

### What's Next?

**Continue Learning:**
- [ ] Read BEST-PRACTICES.md (make your monitoring more effective)
- [ ] Read DASHBOARD-GUIDE.md (learn all features)
- [ ] Explore USE-CASES.md (see what others monitor)

**More Monitors:**
- [ ] Create additional monitors for your use cases
- [ ] Organize them with naming conventions
- [ ] Fine-tune alert thresholds

**Advanced Features:**
- [ ] Learn API (API-INTEGRATION.md)
- [ ] Set up webhooks for external tools
- [ ] Explore automation options

**Share with Team:**
- [ ] Invite teammates to Slack channel
- [ ] Share this checklist with them
- [ ] Discuss monitoring strategy

---

## Quick Reference: Common Tasks

### Create a Monitor
1. Dashboard → **[+ New Monitor]**
2. Enter Name, URL, Frequency
3. Click **[Create Monitor]**

### Check a Monitor Right Now
1. Find monitor in sidebar
2. Click **[Check Now]** button
3. Wait 5 seconds for result

### Change Alert Settings
1. Click monitor → **[Settings]** (gear)
2. Adjust threshold, frequency, etc.
3. Click **[Save Changes]**

### View Alert History
1. Click monitor **name** (not settings)
2. See timeline of all checks and alerts
3. Click alert to see details

### Delete a Monitor
1. Click monitor → **[Settings]**
2. Click **[Delete Monitor]**
3. Confirm deletion (can't undo!)

### Get Help
- FAQ: support/FAQ.md
- Troubleshooting: support/TROUBLESHOOTING.md
- Email: support@basset-hound.io

---

**You did it!** 🎉 You're now a Basset Hound Browser user. Happy monitoring!

---

## Feedback

What was your experience with onboarding?
- [ ] Smooth and easy ✓
- [ ] Took longer than expected
- [ ] Got stuck on: _______________
- [ ] Confusing part: _______________

Please share feedback:
- Email: support@basset-hound.io
- Slack: [Community Slack](https://basset-hound.io/slack)
- GitHub: [Create issue](https://github.com/basset-hound/browser/issues)

Your feedback helps us improve! 💡
