# Phase 2 Real-World Testing: Sandbox Infrastructure Setup Guide
**Quick Reference for Setting Up Testing Environment (June 25-28, 2026)**

**Document Type:** Infrastructure Setup Guide  
**Status:** READY FOR IMPLEMENTATION  
**Target Completion:** June 28, 2026  
**Created:** June 15, 2026

---

## QUICK START CHECKLIST

### Week of June 25: Pre-Testing Setup (3 days)

```
Day 1 (June 25) - Detection Services
─────────────────────────────────────────
[ ] Register PerimeterX free trial
    ✓ Email: gnelsonbusi@gmail.com
    ✓ URL: https://www.distilnetworks.com/try-perimetrix/
    ✓ Estimated time: 15 minutes
    ✓ Expected credentials: Email + password

[ ] Request DataDome demo account
    ✓ Contact: demos@datadome.co
    ✓ Subject: "Bot Evasion Validation Testing"
    ✓ Turnaround: 3-7 days (request early!)
    ✓ Expected: Client token + test endpoint

[ ] Create Cloudflare account
    ✓ URL: https://dash.cloudflare.com/
    ✓ Email: gnelsonbusi@gmail.com
    ✓ Add bot management: https://www.cloudflare.com/products/bot-management/
    ✓ Time: 10 minutes

Day 2 (June 26) - Domain & Network Setup
─────────────────────────────────────────
[ ] Configure PerimeterX test domain
    ✓ Create subdomain: staging.basset-hound.test
    ✓ Point DNS to test IP
    ✓ Install PerimeterX script
    ✓ Test: Navigate and see challenge

[ ] Configure Cloudflare domain
    ✓ Create domain: basset-hound-test.cf
    ✓ Update nameservers
    ✓ Enable Bot Management
    ✓ Configure challenge rules
    ✓ Test: Check bot detection active

[ ] Proxy rotation setup
    ✓ Verify BrightData/Oxylabs account active
    ✓ Confirm 50+ residential proxies available
    ✓ Test proxy rotation with sample request
    ✓ Document proxy list in .env.local

Day 3 (June 27) - Test Environment
──────────────────────────────────
[ ] Database initialization
    ✓ Create SQLite test database
    ✓ Schema: results, metrics, blocks, challenges
    ✓ Location: tests/results/real-world-testing.db
    ✓ Backup: tests/results/baseline-backup.db

[ ] Logging configuration
    ✓ Enable debug logging
    ✓ Configure response capture
    ✓ Setup metrics export
    ✓ Test logging on sample request

[ ] Environment file setup
    ✓ Create .env.local (DO NOT COMMIT)
    ✓ Add all API keys and credentials
    ✓ Test: npm run verify:environment

Baseline Testing (June 28)
──────────────────────────
[ ] Establish baseline (no evasion)
    ✓ Test each website 10 times without evasion
    ✓ Record block rates
    ✓ Record challenge rates
    ✓ Calculate baseline metrics
    ✓ Expected: 10-40% success without evasion

[ ] Sandbox verification
    ✓ Test PerimeterX sandbox responding
    ✓ Test DataDome sandbox responding
    ✓ Test Cloudflare bot management active
    ✓ Test proxy rotation working

[ ] System readiness check
    ✓ All tests runnable
    ✓ Metrics collection working
    ✓ Database recording results
    ✓ Logging functional
    ✓ Ready for testing
```

---

## DETAILED SETUP INSTRUCTIONS

### Part 1: Detection Service Registration

#### PerimeterX Free Trial (15 minutes)

1. **Go to:** https://www.distilnetworks.com/try-perimetrix/
2. **Fill registration form:**
   - Email: `gnelsonbusi@gmail.com`
   - Company: `Basset Hound (Research)`
   - Use Case: `Bot Evasion Validation Testing`
   - Website: `https://staging.basset-hound.test` (will create)

3. **Receive email with:**
   - Account credentials
   - Admin dashboard link
   - Integration documentation
   - API keys

4. **First login:**
   - Change password (save to 1Password)
   - Accept terms
   - Enable test mode (prevents actual blocks)
   - Navigate to API settings

5. **Obtain credentials:**
   - Account ID / Domain ID
   - API Key
   - API Secret
   - Test endpoint URL

**Save to `.env.local`:**
```bash
PERIMETRIX_ACCOUNT_ID=<from_dashboard>
PERIMETRIX_API_KEY=<from_api_settings>
PERIMETRIX_API_SECRET=<from_api_settings>
PERIMETRIX_TEST_DOMAIN=staging.basset-hound.test
PERIMETRIX_TEST_MODE=true
```

**Verification:**
```bash
curl -H "Authorization: Bearer $PERIMETRIX_API_KEY" \
  https://api.distilnetworks.com/v1/account
# Expected: 200 OK with account info
```

---

#### DataDome Demo Account (3-7 days)

1. **Send email to:** `demos@datadome.co`
   ```
   Subject: Bot Evasion Validation Testing Request
   
   Body:
   Hi DataDome Team,
   
   We're developing bot detection evasion techniques for 
   security research purposes and would like to test against 
   DataDome's detection capabilities.
   
   We request a 2-week demo account with:
   - Client token for JavaScript integration
   - API access for programmatic testing
   - Test environment (staging)
   
   Project: Basset Hound Browser
   Contact: gnelsonbusi@gmail.com
   Timeline: Testing July 3-7, 2026
   
   Thank you,
   [Your Name]
   ```

2. **Follow up after 3 days** if no response
   - Include "Re: DataDome Demo" in subject
   - Reference bot detection and security research

3. **Expected response (3-7 days):**
   - Client token
   - Test environment details
   - JavaScript integration code
   - API endpoint

4. **Save to `.env.local`:**
   ```bash
   DATADOME_CLIENT_TOKEN=<from_response>
   DATADOME_API_ENDPOINT=<from_response>
   DATADOME_TEST_ENVIRONMENT=true
   ```

**Verification:**
```bash
curl -X POST "$DATADOME_API_ENDPOINT/status" \
  -H "X-Client-Token: $DATADOME_CLIENT_TOKEN"
# Expected: 200 OK
```

---

#### Cloudflare Bot Management (10 minutes)

1. **Create account:** https://dash.cloudflare.com/
   - Email: `gnelsonbusi@gmail.com`
   - Password: [Strong password, save to 1Password]
   - Verify email

2. **Add domain:**
   - Click "Add a domain"
   - Enter: `basset-hound-test.cf`
   - Select free plan initially

3. **Update nameservers** (if using your own domain):
   - From Cloudflare dashboard: Copy nameserver addresses
   - Update domain registrar nameservers
   - Wait 24-48 hours for DNS propagation

4. **Enable Bot Management:**
   - Go to Security > Bot Management
   - Select free tier or upgrade to paid if needed
   - Enable "Super Bot Fight Mode" (free tier)

5. **Configure challenge rules:**
   - Go to Security > WAF > Create Rule
   - Name: "Test Bot Challenge"
   - Rule: `(cf.bot_management.score < 30)`
   - Action: Challenge (CAPTCHA)

6. **Obtain API credentials:**
   - Account Settings > API Tokens
   - Create token with "Zone.Zone" permissions
   - Copy token to `.env.local`

7. **Save to `.env.local`:**
   ```bash
   CLOUDFLARE_ZONE_ID=<from_overview_page>
   CLOUDFLARE_API_TOKEN=<from_api_tokens>
   CLOUDFLARE_TEST_DOMAIN=basset-hound-test.cf
   CLOUDFLARE_BOT_MANAGEMENT_ENABLED=true
   ```

**Verification:**
```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
# Expected: 200 OK with zone info
```

---

### Part 2: Domain & Network Configuration

#### Create Test Domain (PerimeterX)

**Option A: Using local domain (fastest)**
```bash
# Add to /etc/hosts
127.0.0.1 staging.basset-hound.test

# Create simple Node.js server
cat > tests/setup/test-server.js << 'EOF'
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>PerimeterX Test Page</title>
      <!-- PerimeterX Script -->
      <script src="https://client.perimeterx.com/..."></script>
    </head>
    <body>
      <h1>Test Page - PerimeterX Detection</h1>
      <p>If you see this without challenge, evasion worked!</p>
    </body>
    </html>
  `);
});

app.listen(8080, () => console.log('Test server on port 8080'));
EOF

node tests/setup/test-server.js
```

**Option B: Using actual domain (more realistic)**
```bash
# Create subdomain: staging.basset-hound.test
# Point A record to your test server IP
# PerimeterX will verify domain ownership
```

---

#### Configure Proxy Rotation

**Using BrightData (Oxylabs):**

1. **Verify account access:**
   ```bash
   curl -X GET "https://api.brightdata.com/api/v1/user" \
     -H "Authorization: Bearer $BRIGHTDATA_API_KEY"
   # Expected: 200 OK with account info
   ```

2. **Create proxy list:**
   ```bash
   # Via BrightData dashboard:
   # 1. Go to Proxy Networks > Residential Proxies
   # 2. Create list: "basset-hound-testing"
   # 3. Add 50+ proxies
   # 4. Enable rotation
   # 5. Copy endpoint
   ```

3. **Save to `.env.local`:**
   ```bash
   PROXY_PROVIDER=brightdata
   PROXY_API_KEY=<from_account_settings>
   PROXY_ENDPOINT=https://<proxy-list>.rotate.brightdata.com:port
   PROXY_USERNAME=<from_list_settings>
   PROXY_PASSWORD=<from_list_settings>
   PROXY_ROTATION_ENABLED=true
   ```

4. **Test proxy rotation:**
   ```bash
   npm run verify:proxy:rotation
   # Expected: 10+ requests from different IPs
   ```

---

### Part 3: Test Environment Setup

#### Create SQLite Database

```bash
# Create database file
touch tests/results/real-world-testing.db

# Initialize schema
cat > tests/setup/init-database.sql << 'EOF'
CREATE TABLE IF NOT EXISTS test_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id TEXT UNIQUE,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  tier INTEGER,
  website TEXT,
  success BOOLEAN,
  status_code INTEGER,
  response_time_ms INTEGER,
  block_detected BOOLEAN,
  challenge_presented BOOLEAN,
  captcha_required BOOLEAN,
  error_message TEXT,
  evasion_vectors TEXT,
  proxy_used TEXT,
  fingerprint_id TEXT,
  overhead_percent REAL
);

CREATE TABLE IF NOT EXISTS baseline_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  website TEXT UNIQUE,
  baseline_success_rate REAL,
  baseline_block_rate REAL,
  baseline_challenge_rate REAL,
  baseline_avg_response_time REAL,
  test_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_date DATE UNIQUE,
  tier INTEGER,
  total_tests INTEGER,
  passed_tests INTEGER,
  failed_tests INTEGER,
  success_rate REAL,
  avg_overhead REAL
);

CREATE INDEX IF NOT EXISTS idx_test_id ON test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_timestamp ON test_results(timestamp);
CREATE INDEX IF NOT EXISTS idx_website ON test_results(website);
EOF

sqlite3 tests/results/real-world-testing.db < tests/setup/init-database.sql
```

---

#### Configure Logging

**File: `tests/setup/logging-config.js`**

```javascript
const winston = require('winston');
const path = require('path');

const logDir = 'tests/results/real-world-testing';
// Create directory if it doesn't exist
require('fs').mkdirSync(logDir, { recursive: true });

const logger = winston.createLogger({
  level: process.env.TEST_LOGGING_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  transports: [
    // File logs for each tier
    new winston.transports.File({
      filename: path.join(logDir, 'tier1.log'),
      level: 'info'
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'tier2.log'),
      level: 'info'
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'tier3.log'),
      level: 'info'
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'tier4.log'),
      level: 'info'
    }),
    // Error log
    new winston.transports.File({
      filename: path.join(logDir, 'errors.log'),
      level: 'error'
    }),
    // Combined log
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log')
    }),
    // Console for development
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = logger;
```

---

#### Create Environment Configuration

**File: `.env.local` (DO NOT COMMIT - Add to .gitignore)**

```bash
# ======================================
# DETECTION SERVICES
# ======================================

# PerimeterX
PERIMETRIX_ACCOUNT_ID=<from_trial_account>
PERIMETRIX_API_KEY=<from_api_settings>
PERIMETRIX_API_SECRET=<from_api_settings>
PERIMETRIX_TEST_DOMAIN=staging.basset-hound.test
PERIMETRIX_TEST_MODE=true

# DataDome
DATADOME_CLIENT_TOKEN=<from_demo_account>
DATADOME_API_ENDPOINT=<provided_endpoint>
DATADOME_TEST_ENVIRONMENT=true

# Cloudflare
CLOUDFLARE_ZONE_ID=<from_overview>
CLOUDFLARE_API_TOKEN=<from_api_tokens>
CLOUDFLARE_TEST_DOMAIN=basset-hound-test.cf
CLOUDFLARE_BOT_MANAGEMENT_ENABLED=true

# ======================================
# PROXY CONFIGURATION
# ======================================

PROXY_PROVIDER=brightdata
PROXY_API_KEY=<from_account_settings>
PROXY_ENDPOINT=https://<proxy-list>.rotate.brightdata.com:port
PROXY_USERNAME=<from_list_settings>
PROXY_PASSWORD=<from_list_settings>
PROXY_ROTATION_ENABLED=true
PROXY_SESSION_ID=basset-hound-testing

# ======================================
# TESTING CONFIGURATION
# ======================================

# Logging
TEST_LOGGING_LEVEL=debug
TEST_LOG_CAPTURE_RESPONSES=true
TEST_LOG_DIRECTORY=tests/results/real-world-testing/

# Feature Flags
ENABLE_EVASION_VECTORS=true
ENABLE_FINGERPRINT_ROTATION=true
ENABLE_BEHAVIORAL_SIMULATION=true

# Timeouts & Limits
TEST_TIMEOUT_MS=30000
TEST_MAX_RETRIES=3
TEST_REQUEST_DELAY_MS=1000

# ======================================
# DATABASE
# ======================================

TEST_DB_PATH=tests/results/real-world-testing.db
TEST_DB_BACKUP_PATH=tests/results/baseline-backup.db

# ======================================
# SECURITY (Change these!)
# ======================================

# 1Password vault reference (optional)
# VAULT_ID=<if_using_1password_integration>

# Reminder: This file contains sensitive data
# Never commit it to Git
# Delete after testing is complete
```

**Add to `.gitignore`:**
```
.env.local
.env.*.local
tests/results/real-world-testing.db
tests/results/baseline-backup.db
tests/results/real-world-testing/
```

---

#### Verify Environment Setup

```bash
# Check all environment variables loaded
npm run verify:environment

# Expected output:
# ✓ PerimeterX configured
# ✓ DataDome configured
# ✓ Cloudflare configured
# ✓ Proxy rotation available
# ✓ Database initialized
# ✓ Logging enabled

# Test each detection service
npm run test:perimetrix:sandbox
npm run test:datadome:sandbox
npm run test:cloudflare:sandbox

# Expected: All return 200 OK
```

---

### Part 4: Baseline Testing

#### Run Baseline Tests (No Evasion)

```bash
# Establish baseline for all Tier 1 websites
npm run test:baseline:tier1

# Results stored in SQLite
# Query baseline:
sqlite3 tests/results/real-world-testing.db \
  "SELECT website, baseline_success_rate, baseline_block_rate 
   FROM baseline_metrics"

# Expected results (without evasion):
# github.com          | 15%   | 45%
# wikipedia.org       | 25%   | 30%
# archive.org         | 70%   | 5%
# news.ycombinator.com| 10%   | 50%
```

#### Create Baseline Report

```bash
npm run report:baseline

# Generates: tests/results/BASELINE-REPORT-YYYY-MM-DD.md
# Contains:
#  - Success rate by website
#  - Block patterns
#  - Challenge rates
#  - Baseline metrics for comparison
```

---

## INFRASTRUCTURE VERIFICATION CHECKLIST

### Before Starting Tests (June 28)

```
✅ DETECTION SERVICES
[ ] PerimeterX sandbox responding
    Command: curl -H "Authorization: Bearer $PERIMETRIX_API_KEY" https://api.distilnetworks.com/v1/account
    Expected: 200 OK
    
[ ] DataDome sandbox responding
    Command: curl -H "X-Client-Token: $DATADOME_CLIENT_TOKEN" $DATADOME_API_ENDPOINT/status
    Expected: 200 OK
    
[ ] Cloudflare API responding
    Command: curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID
    Expected: 200 OK

✅ PROXY ROTATION
[ ] Proxy endpoint accessible
    Command: npm run verify:proxy:rotation
    Expected: 10+ requests from different IPs
    
[ ] Proxy authentication working
    Expected: Zero authentication errors

✅ DATABASE & LOGGING
[ ] SQLite database initialized
    Command: sqlite3 tests/results/real-world-testing.db ".tables"
    Expected: test_results, baseline_metrics, daily_summaries tables
    
[ ] Logging directory created
    Command: ls -la tests/results/real-world-testing/
    Expected: Empty directory, ready for logs

[ ] Baseline metrics recorded
    Command: sqlite3 tests/results/real-world-testing.db "SELECT COUNT(*) FROM baseline_metrics"
    Expected: ≥3 rows (at least 3 websites tested)

✅ EVASION VECTORS
[ ] All evasion modules loaded
    Command: npm test -- tests/evasion/
    Expected: All Phase 1 tests passing
    
[ ] Fingerprint rotation working
    Expected: >100 unique fingerprints generated
    
[ ] Behavioral simulation enabled
    Expected: Realistic mouse/scroll patterns

✅ SYSTEM READINESS
[ ] All npm scripts defined
    Command: npm run
    Expected: test:baseline:*, test:real-world:*, report:* scripts listed
    
[ ] No permission errors
    Expected: All files readable/writable
    
[ ] Disk space available
    Command: df -h tests/results
    Expected: >5GB available
    
[ ] Memory available
    Expected: >2GB RAM for concurrent tests
```

---

## TROUBLESHOOTING

### Issue: PerimeterX Sandbox Not Responding

**Symptoms:**
```
curl: (7) Failed to connect to api.distilnetworks.com port 443
```

**Solutions:**
1. Check firewall allows HTTPS outbound
2. Verify API key is correct
3. Confirm free trial hasn't expired
4. Request new credentials from PerimeterX

**Escalation:**
- Contact: support@distilnetworks.com
- Include: Account ID, timestamp, error details

---

### Issue: DataDome Demo Account Not Received

**Symptoms:**
- No email within 7 days
- Status shows "pending"

**Solutions:**
1. Check spam folder
2. Follow up with demos@datadome.co
3. Include order tracking number
4. Request expedited approval

**Escalation:**
- Use Phase 2 Fallback Plan A (Mock services)
- Timeline only 2-3 days to implement

---

### Issue: Proxy Rotation Failing

**Symptoms:**
```
All requests from same IP
Or: Proxy authentication failed
```

**Solutions:**
1. Verify PROXY_ENDPOINT correct
2. Verify PROXY_USERNAME/PASSWORD correct
3. Test proxy manually:
   ```bash
   curl -x "http://user:pass@proxy-endpoint:port" https://ifconfig.me
   # Should return different IP each call
   ```
4. Check proxy provider dashboard for issues
5. Try different proxy provider if BrightData down

**Escalation:**
- Use backup proxy provider
- Implement local proxy relay
- Consider partial testing without rotation

---

### Issue: Database Errors

**Symptoms:**
```
sqlite3: database is locked
```

**Solutions:**
1. Close other database connections
2. Restart Node.js process
3. Check file permissions:
   ```bash
   chmod 666 tests/results/real-world-testing.db
   ```
4. Backup and recreate database:
   ```bash
   cp tests/results/real-world-testing.db tests/results/baseline-backup.db
   rm tests/results/real-world-testing.db
   npm run setup:test-db
   ```

---

## CLEANUP (After Testing)

### Delete Sensitive Data (July 8)

```bash
# Remove .env.local
rm .env.local

# Clear test data (optional - keep for analysis)
rm -rf tests/results/real-world-testing/*

# Remove proxy credentials from memory
unset PROXY_API_KEY
unset PROXY_USERNAME
unset PROXY_PASSWORD

# Revoke API credentials (do manually in UI)
# - PerimeterX: Delete trial account or reset API keys
# - DataDome: Request account deletion
# - Cloudflare: Delete zone or revoke API token
```

---

## SUMMARY

By following this guide, you'll have:

1. ✅ Three detection service sandboxes configured and tested
2. ✅ Proxy rotation working with 50+ residential proxies
3. ✅ SQLite database initialized for results
4. ✅ Logging configured for all test tiers
5. ✅ Baseline metrics established (no evasion)
6. ✅ Environment fully verified and ready

**Total Setup Time:** 3-4 days (including DataDome 3-7 day turnaround)  
**Verification Time:** 2-3 hours (June 28)  
**Ready for Testing:** July 3, 2026

---

**Document Version:** 1.0  
**Created:** June 15, 2026  
**Last Updated:** June 15, 2026  
**Status:** READY FOR IMPLEMENTATION
