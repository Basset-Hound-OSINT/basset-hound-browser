# Dashboard Guide: Master Your Monitoring Dashboard

The Basset Hound Browser Dashboard is where you manage all your monitors, view alerts, and configure your notifications. This guide walks you through every feature.

---

## Dashboard Overview

When you first open the dashboard at `http://localhost:8765/dashboard`, you'll see:

```
┌─────────────────────────────────────────────────────┐
│  Basset Hound Browser          [Menu] [Settings]   │
├──────────────┬──────────────────────────────────────┤
│              │  Dashboard                           │
│ My Monitors  │  ┌─────────────────────────────────┐│
│              │  │ 📊 Monitoring Stats              ││
│ [+ New]      │  │ Active: 5 monitors               ││
│              │  │ Today's alerts: 12               ││
│ • Amazon     │  │ Last check: 2 min ago            ││
│   Prices     │  └─────────────────────────────────┘│
│              │                                       │
│ • News       │  Recent Alerts                       │
│   Headlines  │  ┌─────────────────────────────────┐│
│              │  │ ✏️ Amazon Widget Price changed  ││
│ • Tech News  │  │    $29.99 → $24.99 (2 hrs ago)  ││
│              │  │                                   ││
│ • Company    │  │ ✏️ Competitor Blog Updated      ││
│   Website    │  │    3 new posts (1 hour ago)     ││
│              │  │                                   ││
│ • Stock Data │  │ 🔄 More alerts...               ││
│              │  └─────────────────────────────────┘│
└──────────────┴──────────────────────────────────────┘
```

---

## Left Sidebar: Your Monitors List

### Creating a New Monitor

Click the **[+ New]** button at the top of the monitors list.

**Fields in the New Monitor form:**

| Field | Description | Example |
|-------|-------------|---------|
| **Name** | What to call this monitor (for your reference) | "Amazon Widget Price" |
| **URL** | The website to monitor | `https://amazon.com/widget` |
| **Check Frequency** | How often to check for changes | Every 5 minutes |
| **Monitor Type** | What kind of changes to watch for | Price changes, new articles, status changes |
| **Specific Elements** | Optional: monitor just one part of the page | "div.price-tag" (CSS selector) |
| **Alert Threshold** | Optional: only alert on major changes | Minimum price change: $5 |

### Managing Your Monitors

Each monitor in the list shows:
- **Monitor name** (click to view full history)
- **Status icon**: 
  - 🟢 Green = healthy, checking normally
  - 🟡 Yellow = warnings (e.g., temporary connection issue)
  - 🔴 Red = error (e.g., website down)
- **Last check time** (e.g., "2 min ago")
- **Action buttons**:
  - **Check Now** = Force immediate check (blue button)
  - **Settings** = Edit this monitor (gear icon)
  - **History** = View all previous alerts (calendar icon)
  - **Delete** = Remove this monitor (trash icon)

### Monitor Settings

Click the **Settings** (gear icon) to adjust:

```
Monitor: Amazon Widget Price
───────────────────────────
URL: https://amazon.com/widget
Status: Active ✓

Frequency & Timing
  Check every: [5 minutes ▼]
  Pause monitoring: [ ] (toggle off to pause)
  
What to Monitor
  Monitor: [Product Price ▼]
  Include: [Full page ▼]
  CSS Selector: [.price] (optional)

Alerts & Notifications
  Alert on changes: ✓
  Minimum change: [$5.00 price difference ▼]
  Smart alerts: ✓ (no spam from tiny changes)
  
Notifications (choose one or more)
  ☑ Dashboard alerts
  ☐ Slack
  ☐ Email
  ☐ Webhook
  
Advanced
  Use proxy: [No ▼]
  Follow redirects: ✓
  Capture screenshots: ☐
  Keep history: [Last 90 days ▼]

[Save Changes] [Cancel]
```

---

## Main Dashboard Area: Alerts & Statistics

### Statistics Panel

At the top of the main area:

```
📊 Monitoring at a Glance
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Active Monitors    5 (all running)
Today's Alerts    12 (3 critical, 9 normal)
Active Alerts     2 (unresolved issues)
Last Full Check   2 minutes ago
```

Click any statistic to filter the alerts list:
- Click "12" to see all today's alerts
- Click "2" to see only unresolved alerts
- Click "5" to see all monitors

### Recent Alerts List

Displays the latest changes detected:

```
Recent Alerts (Last 24 Hours)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Filter: All ▼] [Sort: Newest ▼] [Export ▼]

✏️  Amazon Widget Price Changed       🔴 CRITICAL
    Old: $29.99 → New: $24.99
    Change: -$5.00 (16.7% decrease)
    Time: Today at 2:45 PM
    [View Details] [Acknowledge] [Ignore]

✏️  TechNews Headlines Updated       🟡 NORMAL
    Added 3 new articles about AI
    Time: Today at 1:30 PM
    [View Details] [Acknowledge]

🔄 Monitor Connection Lost          🔴 CRITICAL
    Amazon Widget Price monitor
    Check failed: Connection timeout
    Last successful: Today at 1:25 PM
    [View Details] [Retry]

📄 Competitor Blog Post Updated     🟢 INFO
    New post: "Q3 Plans Announced"
    Time: Today at 12:15 PM
    [View Details]
```

### Alert Actions

For each alert, you can:

| Action | What It Does |
|--------|-------------|
| **View Details** | See full before/after comparison with screenshots |
| **Acknowledge** | Mark as read (removes from "Active Alerts" count) |
| **Ignore** | Stop alerting about this specific change type |
| **Retry** | Force a check now for this monitor |
| **Export** | Download alert history as CSV |

---

## Viewing Alert Details

Click **View Details** on any alert to see:

```
Alert Details: Amazon Widget Price Changed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Monitor:    Amazon Widget Price
Time:       June 2, 2026 at 2:45 PM
Type:       Price Change
Severity:   Critical (price dropped 16.7%)

Previous Value:  $29.99
Current Value:   $24.99
Change:          -$5.00

Before Screenshot:  [Click to view]
After Screenshot:   [Click to view]

Full URL: https://amazon.com/widget
HTML Changed:  
  <div class="price old">$29.99</div>
  ↓
  <div class="price">$24.99</div>

Actions:
[Acknowledge] [Create Task] [View on Website] [Ignore Type]
```

---

## Viewing Monitor History

Click a **monitor name** in the left sidebar to view its complete history:

```
Monitor: Amazon Widget Price
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: Active & Healthy
Created: May 20, 2026
Total Changes: 42
Current Value: $24.99

Recent Changes (Last 30 Days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Calendar view showing changes by date]

May 20: $39.99  (initial value)
May 21: $39.99  (no changes)
May 22: $34.99  ↓ (-$5.00) [Alert]
May 23: $34.99  (no changes)
May 24: $29.99  ↓ (-$5.00) [Alert]
...
June 2: $24.99  ↓ (-$5.00) [Alert]

[Export History] [View Timeline] [Analyze Trends]
```

---

## Configuring Notifications

### Dashboard Notifications

Enabled by default. Alerts appear:
- In the "Recent Alerts" section
- As a popup notification (top-right)
- With a sound alert (optional)

**Settings:**
```
Dashboard Notifications
  Show alerts: ✓
  Sound: ✓
  Popup notifications: ✓
  Notification timeout: [10 seconds ▼]
```

### Slack Integration

Send alerts to Slack for your team.

**Setup:**
1. In Dashboard, click **Settings** (top-right) → **Integrations**
2. Click **Connect to Slack**
3. Approve the request in Slack
4. Select which channel receives alerts

**Then, for each monitor:**
1. Click monitor **Settings** (gear icon)
2. Check **Slack Notifications**
3. Choose channel: [#monitoring ▼]
4. Click **Save Changes**

**In Slack, you'll see:**
```
🚨 Basset Hound Alert
Amazon Widget Price changed!
Old: $29.99 → New: $24.99
Time: 2:45 PM today
[View in Dashboard] [Acknowledge]
```

### Email Alerts

Send summary emails.

**Setup:**
1. Click **Settings** → **Notifications**
2. Enter your email
3. Choose frequency:
   - Every alert (high volume)
   - Daily digest (all changes from today)
   - Weekly digest (summary)
   - Critical only (high-importance changes)

### Webhooks (Advanced)

Send alerts to other tools via HTTP webhooks.

**Setup:**
1. Click **Settings** → **Integrations** → **Webhooks**
2. Enter webhook URL: `https://yourapp.com/webhooks/alerts`
3. Choose event types: price changes, new content, errors, etc.

**You'll receive:**
```json
{
  "event": "alert",
  "monitor_id": "amazon-widget-price",
  "monitor_name": "Amazon Widget Price",
  "timestamp": "2026-06-02T14:45:00Z",
  "alert_type": "price_change",
  "old_value": "$29.99",
  "new_value": "$24.99",
  "url": "https://amazon.com/widget"
}
```

---

## Dashboard Settings

Click **Settings** (top-right gear icon) for dashboard-wide options:

```
Dashboard Settings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User & Account
  Display Name: [Your Name]
  Email: [your@email.com]
  Time Zone: [America/New_York ▼]

Display Preferences
  Theme: [Light ▼] (Dark, Light, Auto)
  Alerts per page: [25 ▼]
  Default sort order: [Newest ▼]
  Compact mode: ☐

Notifications
  Default alert frequency: [All ▼]
  Sound enabled: ✓
  Notification timeout: [10 seconds ▼]
  Quiet hours: ☐ (toggle to set time range)

Data & Privacy
  Auto-delete old alerts: [90 days ▼]
  Store screenshots: ☑
  Store HTML: ☑
  GDPR Mode: ☐ (strict privacy)

Integrations
  Slack: Connected ✓
  Webhooks: Configured (2)
  API Token: [Show/Hide]

Advanced
  Export all data: [Click to export]
  API documentation: [Open]
  Debug mode: ☐
```

---

## Common Dashboard Tasks

### Task: Bulk Pause Monitoring During Maintenance

```
Left Sidebar → Select monitors (checkboxes)
→ "Bulk Actions" → "Pause Selected" → [Confirm]
```

### Task: Find All Alerts from Yesterday

```
Click on "Recent Alerts" header
→ [Filter: All ▼] → "Last 24-48 hours"
→ Scroll down to view
```

### Task: Export Alert History for a Report

```
Click monitor name → [Export History] → [Format ▼] (CSV, JSON, PDF)
→ [Download]
```

### Task: Set Up Smart Alerts (No Spam)

```
Monitor Settings → "Alert Threshold"
→ [Only alert if change is bigger than:] $5.00
→ [Save Changes]
```

### Task: Track Price Trend

```
Monitor name (Amazon Widget Price) → History view
→ [Analyze Trends] → View price over time
→ See low: $24.99, high: $39.99, avg: $31.45
```

---

## Keyboard Shortcuts

Speed up your monitoring with these shortcuts:

| Shortcut | Action |
|----------|--------|
| **C** | Create new monitor |
| **?** | Show all shortcuts |
| **N** | Next alert |
| **P** | Previous alert |
| **A** | Acknowledge current alert |
| **F** | Filter alerts |
| **S** | Search monitors |
| **/esc** | Close any popup |

---

## Mobile Dashboard

The dashboard works on phones and tablets. Key differences:

- Sidebar slides out with menu icon (☰)
- Alerts show one per screen
- Touch "View Details" for full information
- Swipe to acknowledge alerts

---

## Troubleshooting Dashboard Issues

### Alerts Not Showing

**Check:**
1. Click **Settings** → **Notifications** → Is "Show alerts" enabled?
2. Are your monitors actually running? (Check status icons in left sidebar)
3. Refresh the page: press F5

### Monitor Status Showing Red

**Usually means:**
- Website is temporarily down
- Network connection issue
- Monitor URL is wrong

**Fix:**
1. Try the URL in your browser - does it load?
2. Click monitor Settings and verify the URL is correct
3. Click "Check Now" to test the connection
4. If still failing, see Troubleshooting guide

### Not Receiving Slack Alerts

**Check:**
1. Is Slack connected? (Settings → Integrations)
2. Is Slack enabled for this specific monitor? (Monitor Settings → check Slack box)
3. Did you select a Slack channel?
4. Test: click "Check Now" on the monitor, you should see a Slack message

---

## Next Steps

- **Need to monitor more websites?** See the QUICK-START guide
- **Want to fine-tune alerts?** See BEST-PRACTICES guide
- **Having issues?** Check support/TROUBLESHOOTING.md
- **Ready for advanced features?** See ADVANCED-USAGE.md

**You're a dashboard expert now!** 🎯
