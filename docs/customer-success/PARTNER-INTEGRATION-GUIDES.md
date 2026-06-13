# Partner Integration Guides - 12+ Integration Tutorials

Complete guides for integrating Basset Hound Browser with popular platforms and services.

---

## Integration Categories

1. **Communication Platforms** (3): Slack, Microsoft Teams, Discord
2. **Automation Platforms** (3): Zapier, Make (Integromat), n8n
3. **Data & Analytics** (3): Datadog, Segment, Mixpanel
4. **Business Tools** (3): HubSpot, Salesforce, Monday.com

---

## COMMUNICATION INTEGRATIONS

## Integration 1: Slack

### Overview
Send Basset Hound Browser detections to Slack channels for real-time team notifications.

### Benefits
- Real-time alerts in team communication tool
- Customizable message formatting
- Thread-based discussions
- Searchable notification history
- Multi-channel routing
- User mentions and escalation

### Prerequisites
- Basset Hound Browser instance running
- Slack workspace admin access
- Slack channel to receive notifications

### Setup Instructions

**Step 1: Create Slack App**
1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name: "Basset Hound Browser"
4. Select workspace
5. Click "Create App"

**Step 2: Enable Incoming Webhooks**
1. Go to "Incoming Webhooks"
2. Toggle "Activate Incoming Webhooks"
3. Click "Add New Webhook to Workspace"
4. Select channel (e.g., #basset-hound-alerts)
5. Click "Allow"
6. Copy Webhook URL (format: `https://hooks.slack.com/services/...`)

**Step 3: Configure in Basset Hound Browser**
1. Open Dashboard
2. Go to Settings → Integrations → Slack
3. Paste Webhook URL
4. Click "Test Connection"
5. Verify message appears in Slack

**Step 4: Create Alert Rules**
1. Go to Monitor → Alerts
2. Click "Add Alert"
3. Select "Slack"
4. Choose channel
5. Configure message template:

```json
{
  "channel": "#basset-hound-alerts",
  "username": "Basset Hound Browser",
  "icon_emoji": ":detective:",
  "text": "Detection Alert",
  "attachments": [
    {
      "color": "danger",
      "title": "{monitor_name}",
      "title_link": "{dashboard_link}",
      "text": "{change_description}",
      "fields": [
        {
          "title": "URL",
          "value": "{monitor_url}",
          "short": false
        },
        {
          "title": "Time",
          "value": "{detection_time}",
          "short": true
        },
        {
          "title": "Change Type",
          "value": "{change_type}",
          "short": true
        }
      ],
      "image_url": "{screenshot_url}",
      "ts": {unix_timestamp}
    }
  ]
}
```

6. Click Save

### Advanced Slack Features

**Multiple Channels**
Route different monitor types to different channels:
```
Prices → #sales-alerts
Security → #security-team
Internal → #operations
```

**Slack Threads**
Group related detections in threads:
```
1. Enable "Thread Replies" in settings
2. Use monitor tag as thread key
3. Recent detections appear in same thread
```

**User Mentions**
Alert specific users:
```
Configuration:
- High priority → @here
- Critical → @channel
- Standard → no mention
```

**Rich Formatting**
Use Slack formatting in message templates:
```
*Bold text*
_Italic text_
~Strikethrough~
`Code`
```

### Troubleshooting

**Q: Webhook URL not working**
A: 
1. Regenerate URL
2. Verify workspace is correct
3. Check URL formatting (no extra spaces)
4. Test with curl: `curl -X POST https://hooks.slack.com/... -H 'Content-type: application/json' --data '{"text":"Test"}'`

**Q: Messages not appearing**
A:
1. Verify webhook channel still exists
2. Check bot has access to channel
3. Verify message not filtered by Slack
4. Check Slack app activity log

**Q: Too many notifications**
A:
1. Create alert rules to filter
2. Use digest mode (batch notifications)
3. Create quiet hours
4. Use different channels by priority

---

## Integration 2: Microsoft Teams

### Overview
Integrate with Microsoft Teams for enterprise communication.

### Prerequisites
- Microsoft Teams workspace
- Admin access to Teams
- Basset Hound Browser instance

### Setup Instructions

**Step 1: Create Incoming Webhook**
1. In Teams, go to your channel
2. Click ⋯ (More options) → "Connectors"
3. Search for "Webhook"
4. Click "Configure"
5. Name: "Basset Hound Browser"
6. Optionally upload logo
7. Click "Create"
8. Copy Webhook URL

**Step 2: Configure in Basset Hound Browser**
1. Settings → Integrations → Microsoft Teams
2. Paste Webhook URL
3. Click "Test"
4. Verify message in Teams

**Step 3: Message Template**
```json
{
  "@type": "MessageCard",
  "@context": "https://schema.org/extensions",
  "summary": "{monitor_name} - Change Detected",
  "themeColor": "0078D4",
  "title": "Basset Hound Browser Detection",
  "sections": [
    {
      "activityTitle": "{monitor_name}",
      "activitySubtitle": "{monitor_url}",
      "facts": [
        {
          "name": "Change Type:",
          "value": "{change_type}"
        },
        {
          "name": "Detection Time:",
          "value": "{detection_time}"
        },
        {
          "name": "Change Details:",
          "value": "{change_description}"
        }
      ],
      "markdown": true,
      "image": "{screenshot_url}"
    }
  ],
  "potentialAction": [
    {
      "@type": "OpenUri",
      "name": "View in Dashboard",
      "targets": [
        {
          "os": "default",
          "uri": "{dashboard_link}"
        }
      ]
    }
  ]
}
```

### Teams-Specific Features
- Channel mentions
- @channel and @here
- Cards with action buttons
- Rich formatting support
- Adaptive cards

---

## Integration 3: Discord

### Overview
Notify Discord servers of website changes in real-time.

### Prerequisites
- Discord server
- Server admin access
- Basset Hound Browser instance

### Setup Instructions

**Step 1: Create Discord Webhook**
1. Open Discord server
2. Right-click channel → "Edit Channel"
3. Go to "Integrations" → "Webhooks"
4. Click "New Webhook"
5. Name: "Basset Hound Browser"
6. Copy Webhook URL
7. Click Save

**Step 2: Configure Basset Hound Browser**
1. Settings → Integrations → Discord
2. Paste Webhook URL
3. Test connection

**Step 3: Message Template**
```json
{
  "username": "Basset Hound Browser",
  "avatar_url": "https://example.com/logo.png",
  "embeds": [
    {
      "title": "{monitor_name}",
      "url": "{dashboard_link}",
      "description": "{change_description}",
      "color": 3447003,
      "fields": [
        {
          "name": "URL",
          "value": "{monitor_url}",
          "inline": false
        },
        {
          "name": "Change Type",
          "value": "{change_type}",
          "inline": true
        },
        {
          "name": "Time",
          "value": "{detection_time}",
          "inline": true
        }
      ],
      "image": {
        "url": "{screenshot_url}"
      }
    }
  ]
}
```

### Discord Features
- Rich embeds with images
- User/role mentions (@user, @role)
- Code block formatting
- Link previews

---

## AUTOMATION INTEGRATIONS

## Integration 4: Zapier

### Overview
Connect Basset Hound Browser to 5,000+ apps via Zapier.

### How It Works
1. Basset Hound Browser sends webhook when detection occurs
2. Zapier receives and parses data
3. Zapier triggers actions in other apps

### Prerequisites
- Basset Hound Browser instance
- Zapier account (free or paid)
- Connected apps (e.g., Gmail, Google Sheets, Slack)

### Setup Instructions

**Step 1: Create Zapier Zap**
1. Log in to Zapier
2. Click "Create" → "Zap"
3. Trigger: "Webhooks by Zapier" → "Catch Hook"
4. Copy Webhook URL

**Step 2: Configure Basset Hound Browser**
1. Go to Monitor → Advanced
2. Enable Webhooks
3. Endpoint: Zapier webhook URL
4. Test webhook (should show in Zapier)

**Step 3: Set Up Action**
Example: Create Google Sheets row on detection
1. Click "Continue"
2. Action: "Google Sheets" → "Create Spreadsheet Row"
3. Authenticate with Google
4. Select spreadsheet and sheet
5. Map fields:
   - Monitor Name → Column A
   - Detection Time → Column B
   - Change Description → Column C
   - Screenshot URL → Column D
6. Test action
7. Publish Zap

### Example Zaps

**Zap 1: Email Notification + Spreadsheet**
1. Trigger: Basset Hound webhook
2. Action 1: Send email (Gmail)
3. Action 2: Add row to Google Sheets
4. Action 3: Send Slack message
5. Result: Email, spreadsheet record, and Slack alert

**Zap 2: Create Tickets on Price Drop**
1. Trigger: Basset Hound webhook
2. Filter: Change contains "price" AND amount > 5%
3. Action: Create Jira ticket
4. Result: Automatic ticket for significant price drops

**Zap 3: Update CRM on Competitor Change**
1. Trigger: Basset Hound webhook
2. Filter: Detection is competitor-related
3. Action 1: Update HubSpot company record
4. Action 2: Create activity in Salesforce
5. Result: Competitor data automatically in CRM

### Webhook Payload for Zapier
```json
{
  "monitor_id": "mon_123456",
  "monitor_name": "Competitor ABC Price",
  "monitor_url": "https://competitor.com/product",
  "detection_time": "2026-06-13T10:30:00Z",
  "change_type": "visual",
  "change_description": "Price changed from $99 to $89",
  "change_magnitude": "10%",
  "screenshot_before": "https://cdn.example.com/before.png",
  "screenshot_after": "https://cdn.example.com/after.png",
  "tags": ["competitor", "pricing"]
}
```

---

## Integration 5: Make (Integromat)

### Overview
Powerful workflow automation platform with more advanced features than Zapier.

### Prerequisites
- Make account
- Basset Hound Browser instance
- Connected apps

### Setup Instructions

**Step 1: Create Make Scenario**
1. Go to Make.com
2. Create new scenario
3. Add module: Webhooks → "Custom Webhook"
4. Copy webhook URL

**Step 2: Configure Basset Hound Browser**
1. Monitor → Advanced → Webhooks
2. Set endpoint to Make webhook URL
3. Test webhook

**Step 3: Add Action Modules**
Example scenario with conditional routing:

```
1. Trigger: Custom Webhook (Basset Hound)
   ↓
2. Router: 
   Route 1: If price change
   Route 2: If competitor change
   Route 3: Other changes
   ↓
3. Route 1 Actions:
   - Update Google Sheets (prices)
   - Send email to sales
   - Update Shopify products
   ↓
4. Route 2 Actions:
   - Create Asana task
   - Update HubSpot
   - Send Slack notification
```

### Advanced Make Features
- **Complex Routing:** Based on detection content
- **Parallel Actions:** Multiple simultaneous actions
- **Data Transformation:** Parse and format data
- **Error Handling:** Retry or alternative paths
- **Scheduling:** Delayed actions
- **Loops:** Process multiple items

### Example Scenario: Competitive Price Monitoring
```
Trigger: Basset Hound webhook
  ↓
Parse JSON from webhook
  ↓
Router:
  Price drop > 10%?
    YES → Create high-priority task
         → Send urgent email
         → Update inventory
    NO  → Add to spreadsheet
       → Send summary email
  ↓
All paths → Archive scenario data
```

---

## Integration 6: n8n

### Overview
Open-source workflow automation (self-hosted or cloud).

### Prerequisites
- n8n instance (self-hosted or cloud)
- Basset Hound Browser instance

### Setup Instructions

**Step 1: Create n8n Workflow**
1. Create new workflow
2. Add trigger: "Webhook"
3. Method: POST
4. Copy webhook URL

**Step 2: Configure Basset Hound Browser**
1. Monitor → Advanced → Webhooks
2. Set endpoint to n8n webhook URL
3. Test webhook

**Step 3: Add Nodes**
Example workflow:

```
Webhook (Trigger)
  ↓
HTTP Request (optional: transform data)
  ↓
IF Detection Type = Price?
  YES:
    ├→ Update Google Sheets
    ├→ Send Slack
    └→ Webhook to your API
  NO:
    └→ Send email
```

### n8n Advantages
- Self-hosted (full control)
- No vendor lock-in
- Advanced data transformation
- Complex conditional logic
- Custom code support
- Open source

---

## DATA & ANALYTICS INTEGRATIONS

## Integration 7: Datadog

### Overview
Send monitoring data to Datadog for advanced analytics and correlation.

### Prerequisites
- Datadog account
- Datadog API key
- Basset Hound Browser instance

### Setup Instructions

**Step 1: Create Datadog API Key**
1. Go to Datadog dashboard
2. Settings → Integrations → API
3. Create new key
4. Copy API key and Application key

**Step 2: Configure Basset Hound Browser**
1. Settings → Integrations → Datadog
2. Paste API key
3. Set Datadog region (US, EU, etc.)
4. Click Test

**Step 3: Metrics Configuration**
Map detections to Datadog metrics:

```
- Detection count by monitor
- Detection count by type
- Average detection latency
- Alert delivery latency
- System resource usage
```

**Step 4: Create Dashboards**
In Datadog:
1. Create dashboard
2. Add widgets:
   - Detection rate over time
   - Detection heatmap
   - Alert success rate
   - Competitor activity
3. Set up alerts on metrics

### Use Cases
- **Performance Monitoring:** Detect if monitoring is degrading
- **Trend Analysis:** See detection patterns over time
- **Anomaly Detection:** Datadog AI detects unusual activity
- **Correlation:** See if detections correlate with business events
- **Capacity Planning:** Predict resource needs

---

## Integration 8: Segment

### Overview
Send detection events to Segment for customer data platform integrations.

### Prerequisites
- Segment account
- Basset Hound Browser instance
- Destination apps (Amplitude, Mixpanel, etc.)

### Setup Instructions

**Step 1: Create Segment Source**
1. Go to Segment workspace
2. Create source (JavaScript/Node.js)
3. Copy write key

**Step 2: Configure Basset Hound Browser**
1. Settings → Integrations → Segment
2. Paste write key
3. Test connection

**Step 3: Event Mapping**
Configure which events to send:

```
Event: "Detection Occurred"
Properties:
  - monitor_name
  - detection_type
  - change_magnitude
  - tags

Event: "Alert Sent"
Properties:
  - alert_method
  - recipient
  - success
```

**Step 4: Configure Destinations**
In Segment, route events to:
- Analytics (Amplitude, Mixpanel)
- Advertising (Google Ads, Facebook)
- Warehouses (BigQuery, Redshift)
- CRM (Salesforce, HubSpot)

### Advanced Features
- **Identity Resolution:** Track users across tools
- **Event Enrichment:** Add context to events
- **Selective Sync:** Choose which destinations get which events
- **Custom Mappings:** Transform data between systems

---

## Integration 9: Mixpanel

### Overview
Track detection events for product analytics and funnel analysis.

### Prerequisites
- Mixpanel account
- Basset Hound Browser instance

### Setup Instructions

**Step 1: Get Mixpanel Token**
1. Go to Mixpanel project settings
2. Copy project token

**Step 2: Configure Basset Hound Browser**
1. Settings → Integrations → Mixpanel
2. Paste project token
3. Test

**Step 3: Track Events**
Automatically tracked events:
- Detection occurred
- Alert sent
- User viewed results
- Monitor created/updated/deleted

**Step 4: Set Up Funnels**
Example funnel: Competitor Alert Funnel
1. Monitor created
2. Detection occurred
3. Alert sent
4. Alert viewed
5. Action taken

### Analytics Insights
- Detection velocity by monitor
- Most active monitors
- Alert-to-action rate
- User engagement metrics
- Feature adoption

---

## BUSINESS TOOL INTEGRATIONS

## Integration 10: HubSpot

### Overview
Integrate with HubSpot CRM to track competitive intelligence and automate sales workflows.

### Prerequisites
- HubSpot account (free or paid)
- Basset Hound Browser instance

### Setup Instructions

**Step 1: Create HubSpot Private App**
1. Go to Settings → Private apps
2. Create app with scope: contacts, companies, deals
3. Copy access token

**Step 2: Configure Basset Hound Browser**
1. Settings → Integrations → HubSpot
2. Paste access token
3. Test connection

**Step 3: Sync Configurations**
Map Basset Hound Browser data to HubSpot objects:

```
Monitor → Company:
  Monitor name → Company name
  URL → Website
  Tags → Custom fields

Detection → Activity:
  Detection time → Activity date
  Change → Activity description
  Monitor → Associated company
```

**Step 4: Create Workflows**
In HubSpot, create workflows:

Example 1: Competitor Price Drop
1. Trigger: Custom object created (detection)
2. Filter: Monitor is competitor, change is price
3. Action 1: Create deal (opportunity)
4. Action 2: Notify sales team
5. Action 3: Create task (follow up)

Example 2: Win Intelligence
1. Trigger: Competitor feature added
2. Action: Create note on customer record
3. Alert: Sales rep about competitive threat

---

## Integration 11: Salesforce

### Overview
Sync competitive intelligence to Salesforce for sales team access.

### Prerequisites
- Salesforce org
- Basset Hound Browser instance

### Setup Instructions

**Step 1: Create Salesforce Connected App**
1. Setup → Apps → New Connected App
2. Name: "Basset Hound Browser"
3. Enable OAuth
4. Scopes: api, refresh_token
5. Save and get client ID/secret

**Step 2: Configure Basset Hound Browser**
1. Settings → Integrations → Salesforce
2. Enter instance URL, client ID, client secret
3. Authorize
4. Test

**Step 3: Create Custom Objects**
In Salesforce:
1. Setup → Custom Objects
2. Create "Competitor Monitor"
   - Name, URL, tags, frequency
3. Create "Detection" object
   - Linked to Competitor Monitor
   - Detection time, changes, magnitude

**Step 4: Create Processes**
Example process: Auto-update opportunities

```
Trigger: Detection created for competitor
Criteria: Match to active opportunities
Actions:
  - Update Opportunity: Last Competitive Activity
  - Create Task: Follow up with customer
  - Send email to sales rep
```

---

## Integration 12: Monday.com

### Overview
Track monitors and detections as Monday.com tasks for team coordination.

### Prerequisites
- Monday.com workspace
- Basset Hound Browser instance

### Setup Instructions

**Step 1: Create Monday.com API Token**
1. Account → Developers → API tokens
2. Create token
3. Copy token

**Step 2: Configure Basset Hound Browser**
1. Settings → Integrations → Monday.com
2. Paste API token
3. Test

**Step 3: Create Boards**
In Monday.com:

**Board 1: Monitors**
```
Columns:
- Monitor Name (text)
- URL (text)
- Frequency (dropdown)
- Detection Count (number)
- Last Detection (date)
- Status (status)
- Tags (tags)
- Owner (person)
```

**Board 2: Detections**
```
Columns:
- Monitor (link to Monitors board)
- Detection Time (date)
- Type (dropdown)
- Description (text)
- Magnitude (number)
- Action Taken (status)
- Owner (person)
```

**Step 4: Sync Data**
Enable automated syncing:
- New monitor → Create Board row
- Detection → Create Task
- Detection → Update Monitor row

---

## Integration Templates Summary

| Integration | Category | Complexity | Use Case |
|------------|----------|-----------|----------|
| Slack | Communication | Easy | Team alerts |
| Teams | Communication | Easy | Enterprise alerts |
| Discord | Communication | Easy | Community alerts |
| Zapier | Automation | Medium | Multi-app workflows |
| Make | Automation | High | Complex automation |
| n8n | Automation | High | Self-hosted automation |
| Datadog | Analytics | Medium | Performance monitoring |
| Segment | Analytics | Medium | Customer data platform |
| Mixpanel | Analytics | Easy | Product analytics |
| HubSpot | Business | Medium | Sales enablement |
| Salesforce | Business | High | Enterprise CRM |
| Monday.com | Business | Easy | Team coordination |

---

## Common Integration Patterns

### Pattern 1: Real-Time Alert
```
Basset Hound → Webhook → Slack/Teams → User notified
(Latency: <1 second)
```

### Pattern 2: Batch Processing
```
Basset Hound → Zapier → Data transformation → Google Sheets → Analysis
(Latency: 1-5 minutes)
```

### Pattern 3: Analytics Pipeline
```
Basset Hound → Webhook → Segment → Multiple destinations
(Latency: 1-2 minutes)
```

### Pattern 4: CRM Sync
```
Basset Hound → API → HubSpot/Salesforce → Sales team uses data
(Latency: 1-10 minutes)
```

---

## Integration Best Practices

1. **Start Simple:** Begin with one integration
2. **Test Thoroughly:** Verify before production use
3. **Monitor Health:** Check integration status regularly
4. **Document Mapping:** Keep field mappings documented
5. **Handle Errors:** Implement retry logic
6. **Secure Credentials:** Never commit API keys
7. **Rate Limiting:** Respect API rate limits
8. **Data Privacy:** Ensure compliance with regulations

---

## Support & Resources

- **Integration Documentation:** [Link to each integration]
- **API Documentation:** [Link to Basset Hound API docs]
- **Community Integrations:** Share your custom integrations
- **Support:** integrations@basset-hound-browser.com

---

*Status: 12 comprehensive integration guides ready for deployment | Last Updated: June 13, 2026*
