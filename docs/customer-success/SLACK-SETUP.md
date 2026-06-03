# Slack Integration Guide: Set Up Monitoring Alerts in Slack

Complete guide to connect Basset Hound Browser to Slack and route alerts to your team.

---

## Why Use Slack?

Slack integration lets your team see monitoring alerts without checking the dashboard:

- **Instant notifications:** Alerts appear in Slack within seconds
- **Team visibility:** Whole team sees what changed
- **Actionable alerts:** Click buttons to acknowledge, view details
- **No missed alerts:** Slack notifications are hard to miss
- **Team discussions:** Talk about alerts in Slack threads

---

## Prerequisites

- Slack workspace (you're a member)
- Admin or permission to install apps
- Basset Hound Browser running locally

---

## Step 1: Connect Basset Hound to Your Slack Workspace

### In Dashboard

1. Open http://localhost:8765/dashboard
2. Click **[Settings]** (top-right gear icon)
3. Click **[Integrations]** tab
4. Click **[Connect to Slack]** button

**A browser window will open to Slack:**

### In Slack

1. You see: "Basset Hound Browser wants to install this app"
2. Read the permissions
3. Click **[Allow]** button (bottom right)

**Back to Dashboard:**

4. Dashboard now shows:
   ```
   Slack Status: Connected ✓
   Workspace: your-workspace
   ```

**Success!** Basset Hound is now in your Slack workspace.

---

## Step 2: Create Monitoring Channels in Slack

Create dedicated Slack channels for different types of alerts.

### Recommended Channel Structure

```
#monitoring              (all alerts, for visibility)
#monitoring-critical    (only high-priority alerts)
#monitoring-price      (e-commerce alerts only)
#monitoring-news       (news/content alerts)
#monitoring-errors     (connection errors, debugging)
```

### How to Create a Channel

In Slack:

1. Click **[+]** next to "Channels" (left sidebar)
2. Click **[Create a channel]**
3. Channel name: `monitoring` (starts with #)
4. Description: "Basset Hound Browser monitoring alerts"
5. Privacy: Public (teammates can join anytime)
6. Click **[Create]**

Repeat for other channels (critical, price, news, errors).

---

## Step 3: Enable Slack for Your Monitors

### For Each Monitor

1. Open Basset Hound Dashboard
2. Find your monitor in the left sidebar
3. Click **[Settings]** (gear icon)
4. Scroll to **Notifications** section

### Configure Slack

```
Notifications
─────────────────────────────────
✓ Dashboard alerts      (checked)
✓ Slack Notifications  (check this)
  Channel: [#monitoring ▼]
  
[ ] Email Notifications
[ ] Webhook Notifications
```

1. Check the box next to **Slack Notifications**
2. Click dropdown: [#monitoring ▼]
3. Select your channel:
   - `#monitoring` - for general alerts
   - `#monitoring-critical` - for important ones
   - `#monitoring-price` - for price changes
   - etc.

4. Click **[Save Changes]**

### Test It

1. Click **[Check Now]** on the monitor
2. Open your Slack channel
3. You should see a message within 30 seconds:

```
🚨 ALERT: Amazon Widget Price Changed!
$39.99 → $24.99 (-37.6%)
Time: 2:45 PM today
[View in Dashboard] [Acknowledge]
```

---

## Slack Message Format

Here's what you'll see in Slack:

### Price Change Alert

```
📊 Amazon Widget Price Changed!
Old: $39.99 → New: $24.99
Change: -$15.00 (-37.6%)
Time: 2026-06-02 at 2:45 PM
[View Details] [Acknowledge] [Ignore]
```

### Content Change Alert

```
✏️ TechNews Headlines Updated
Added 3 new articles about AI
Time: 2026-06-02 at 1:30 PM
[View Details] [Acknowledge]
```

### Connection Error Alert

```
🔴 Monitor Failed: Connection Timeout
Amazon Widget Price monitor
Check failed: Website not responding
Last successful: 2026-06-02 at 1:25 PM
[View Details] [Retry] [Acknowledge]
```

### Click Actions

**[View Details]** - Open monitor details in dashboard

**[Acknowledge]** - Mark alert as read
- Removes from "Recent Alerts" in dashboard
- Shows as read in Slack

**[Ignore]** - Stop alerting on this type of change
- For price monitoring: ignore sub-$1 changes
- For news: ignore duplicate articles

**[Retry]** - Force a check right now

---

## Organizing Alerts by Priority

### Option 1: Multiple Channels by Type

Send different monitors to different channels:

```
Configuration
─────────────────────────────────────────────────
Monitor                         Channel
─────────────────────────────────────────────────
Amazon Widget Price             #monitoring-critical
Competitor Price Update         #monitoring-critical
TechNews Headlines              #monitoring-news
Company Blog                    #monitoring
Competitor Website              #monitoring
Job Postings                    #monitoring
```

**Setup:**
1. For each monitor, set different Slack channel in settings
2. Team members join relevant channels
3. C-suite joins #monitoring-critical
4. Everyone follows their area

### Option 2: Smart Alerts + Single Channel

Route everything to one channel, but be smart about what alerts:

```
All Monitors → #monitoring (but with smart filtering)

Each monitor's Alert Threshold:
  - Price monitor: Only alert if ≥ $5 change
  - News monitor: Only new articles (not all changes)
  - Status monitor: Only errors (not normal states)
```

**Setup:**
1. All monitors → #monitoring
2. Adjust threshold for each monitor
3. Enable Smart Alerts for all

---

## Advanced: Slack Workflows & Automation

Use Slack Workflows to automatically respond to alerts.

### Example: Create Task on Alert

Trigger: Alert message in #monitoring-critical

Then:
1. Post message: "Investigating..."
2. Create task in project management (via Zapier/Make)
3. Notify @channel with details

### Example: Auto-Acknowledge After 24 Hours

Trigger: Alert posted

Then:
1. Wait 24 hours
2. Auto-react with ✓ (acknowledge)
3. Archive to thread

### How to Set Up Workflows

In Slack:

1. Go to #monitoring channel
2. Click **[Workflow Builder]** (in channel details)
3. Click **[Create a new workflow]**
4. Choose trigger: "When someone posts a message"
5. Add actions: Create task, notify, etc.
6. Save workflow

---

## Using Slack Threads for Discussions

When an alert comes in:

1. Someone clicks it → Opens thread
2. Team discusses what to do
3. Thread keeps conversation organized
4. Easy to look back at discussions

**Example thread:**
```
Thread started by Basset Hound:
"Amazon Widget Price: $39.99 → $24.99"

John: We need to match this price

Sarah: Agree, let's update today

Mike: Checking inventory first...

John: Done! New price is $24.99 on our site
✓ Acknowledged
```

---

## Slack Bot Commands

After connecting, you can use bot commands in Slack (optional advanced feature).

Common commands:
```
/basset pause monitor-name       (pause monitoring)
/basset resume monitor-name      (resume monitoring)
/basset check monitor-name       (check right now)
/basset show-channels            (show all channels)
```

---

## Troubleshooting Slack Integration

### Issue: "Slack not connected" error

**Fix:**
1. Click **Settings** → **Integrations**
2. Click **[Reconnect to Slack]**
3. Approve in Slack again

### Issue: Not seeing alerts in Slack

**Check:**

1. Is Slack enabled for this monitor?
   - Monitor Settings → Slack: [☑ checked]
   
2. Is channel selected?
   - Monitor Settings → Channel: [#monitoring ▼]
   
3. Are you in the channel?
   - Open #monitoring in Slack
   - If you're not a member, join first
   
4. Did you actually get alerts?
   - Click "Check Now" - forces a check
   - Wait 30 seconds for alert in Slack

### Issue: Alerts going to wrong channel

**Fix:**
1. Monitor Settings → Slack → Channel
2. Select correct channel
3. Save Changes

### Issue: Slack app removed

**If you removed the Basset Hound app by mistake:**

1. Go to Slack workspace
2. Settings → Installed Apps
3. Look for "Basset Hound Browser"
4. Click **[Reinstall]** (if available)
5. Or, connect again from Dashboard

---

## Best Practices for Slack Monitoring

### 1. Keep Channels Clean

```
❌ Bad:  Everything in #general (noisy!)
✓ Good: Separate #monitoring channels
```

### 2. Mute Non-Critical Channels

If you have many monitors:

1. Join #monitoring-news
2. Right-click channel → **Mute channel**
3. Turn on notifications only for mentions

### 3. Use Threads for Discussions

Don't clutter the main channel:

1. Alert posts in channel
2. Discussions happen in reply thread
3. Channel stays clean

### 4. Set Notification Preferences

In Slack:

1. Click your name → **Preferences**
2. Notifications → **Mute in #monitoring-news**
   (so you only get critical alerts)

### 5. Archive Old Alerts

Occasionally clean up:

1. Go to #monitoring
2. View older messages
3. React with 📦 to show archived
4. Or delete if not needed

### 6. Use Slack Bookmarks

Save important alerts:

1. Right-click alert message
2. Click **Add bookmark**
3. Saves to channel bookmarks (easy to find later)

---

## Slack for Different Use Cases

### E-Commerce Price Monitoring

```
Channels:
  #price-alerts (general price changes)
  #price-critical (drops >$10)
  
Each price monitor → #price-alerts
Critical price monitors → #price-critical (also)

Slack workflow:
  Alert → Create task to update our pricing
  Alert → Notify #pricing team
```

### News Monitoring

```
Channels:
  #news-all (all articles)
  #news-mentions (articles mentioning us)
  #news-critical (urgent news)

Each monitor → appropriate channel

Slack workflow:
  Mention alert → Auto-notify PR team
  Critical → Notify CEO
```

### Security Monitoring

```
Channels:
  #security-alerts (all vulnerabilities)
  #security-critical (high/critical only)
  
All security monitors → #security-alerts
Critical vulnerabilities → #security-critical (also)

Slack workflow:
  Alert → Create ticket in security system
  Critical → Page on-call engineer
  Alert → Log to audit trail
```

---

## FAQ: Slack Integration

### Q: Can I have different channels per monitor?

**A:** Yes! Each monitor can send to a different channel. Set in Monitor Settings → Slack → Channel.

### Q: Can I send to multiple channels at once?

**A:** Not directly. But you can:
1. Configure Slack to forward important messages to other channels
2. Create one base channel and have people follow it
3. Use Slack cross-posting feature (if on Enterprise)

### Q: Will alerts spam my channel?

**A:** You control the volume:
1. Adjust Alert Threshold for each monitor
2. Enable Smart Alerts (reduces noise)
3. Slow down Check Frequency
4. Only monitor important changes

### Q: Can I see old alerts in Slack?

**A:** Yes! Slack keeps message history (default: 90 days). Search for old alerts:
```
in:#monitoring-critical "price"
```

### Q: Can I export alert history from Slack?

**A:** Limited. Best to export from Basset Hound Dashboard:
1. Monitor → [Export History]
2. Choose format (CSV, JSON)
3. Download and analyze

---

## Next Steps

1. **Set up channels** - Create #monitoring-critical, #monitoring-price, etc.
2. **Connect monitors** - Enable Slack for each monitor
3. **Test alerts** - Click "Check Now" and verify Slack messages
4. **Fine-tune** - Adjust thresholds to reduce noise
5. **Share with team** - Invite teammates to channels

---

## Need Help?

- **Slack questions:** See Slack's own help docs
- **Basset Hound questions:** See FAQ.md or TROUBLESHOOTING.md
- **Still stuck?** Email: support@basset-hound.io

**Happy monitoring in Slack!** 🚀
