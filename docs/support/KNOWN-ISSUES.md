# Known Issues & Limitations

Honest assessment of limitations and workarounds. This document is updated as issues are resolved.

---

## Current Limitations (v12.1.0)

### 1. JavaScript-Heavy Websites (Moderate Impact)

**Issue:** Sites that load content with JavaScript may not work perfectly

**Affects:**
- Single-page applications (SPAs)
- Content loaded after page load
- Dynamic DOM changes
- React/Vue/Angular sites

**Workaround:**
```
Monitor Settings:
  Execute JavaScript: ✓ (enable)
  Wait time: [5 seconds] (give JS time to run)
```

**Note:** JavaScript execution is slower (adds 2-5 seconds per check)

**Status:** Will optimize in v12.2.0

---

### 2. Password-Protected Content (High Impact)

**Issue:** Can't monitor sites that require authentication

**Reason:** We don't store passwords (for security)

**Workarounds:**
1. Monitor public pages only (login pages, blog, etc.)
2. Use public API instead (if available)
3. Send data to us via webhooks (we monitor the data)
4. Contact support for custom solution

**Example:**
```
Can't monitor: Internal company dashboard (requires login)
Can monitor: Company blog (public)
Can monitor: Public API endpoint (https://api.company.com/status)
```

**Status:** Exploring authenticated monitoring in future versions

---

### 3. Large Payloads (Low Impact)

**Issue:** Websites with very large HTML (>10MB) may load slowly

**Affects:**
- Sites with embedded large datasets
- Large PDF files
- Video/media pages

**Workaround:**
```
Monitor Settings:
  CSS Selector: [.main-content] (specific element only)
  This reduces payload from 10MB to 100KB
```

**Note:** Compression helps but doesn't solve everything

**Status:** Will add lazy-loading in v12.3.0

---

### 4. Cloudflare & WAF Blocking (Moderate Impact)

**Issue:** Some security systems block our requests

**Affects:**
- Cloudflare-protected sites
- AWS WAF (Web Application Firewall)
- DDoS protection systems

**Symptoms:**
- Error: "Access Denied (403)"
- Error: "Connection Blocked"
- Inconsistent failures (sometimes works, sometimes doesn't)

**Workarounds:**
1. Use residential proxy (looks like real user)
2. Slow down check frequency
3. Contact site admin for whitelist
4. Try without JavaScript enabled

**Monitor Settings:**
```
Proxy: [Residential Proxy ▼]
Check Frequency: [Every 15 minutes] (slower)
Execute JavaScript: ☐ (try disabled)
```

**Note:** Residential proxies are slower and more expensive

**Status:** Building evasion improvements in v12.2.0

---

### 5. Rate Limiting (Low-Moderate Impact)

**Issue:** Websites that block rapid requests

**Affects:**
- E-commerce sites
- APIs with rate limits
- Sites protecting against scrapers

**Symptoms:**
- Sudden "Access Denied" after several checks
- Intermittent failures
- Error: "Too Many Requests (429)"

**Workarounds:**
1. Reduce check frequency (every 5 min → every 15 min)
2. Add delays between checks
3. Use proxy rotation
4. Respect robots.txt Crawl-delay

**Example robots.txt:**
```
User-agent: *
Crawl-delay: 60
```
= Wait 60 seconds between checks

**Monitor Settings:**
```
Check Frequency: [Every 2 hours] (much slower)
Proxy Rotation: [Smart - rotate if needed]
```

**Status:** Adding smart rate limit detection in v12.2.0

---

## Known Bugs (Being Fixed)

### Bug #1: Connection Timeout on Slow Networks

**Status:** Low Priority (affects <1% of users)

**Issue:** Very slow websites sometimes timeout even with 5-second wait

**Workaround:**
```
Monitor Settings:
  Wait before check: [10 seconds]
  (instead of default 5)
```

**Fix planned:** v12.2.0 (add adaptive timeouts)

---

### Bug #2: Webhook Delivery Delays

**Status:** Low Priority

**Issue:** Webhooks sometimes deliver 30-60 seconds late

**Cause:** High load on system can queue webhooks

**Workaround:**
- For critical alerts, use Slack (more reliable)
- For non-critical, webhooks are fine
- Adjust check frequency to reduce load

**Fix planned:** v12.3.0 (better queue management)

---

### Bug #3: Screenshot Corruption (Rare)

**Status:** Very Low Priority (<0.01% of users)

**Issue:** Rare instances of corrupted screenshots

**Workaround:**
```
Monitor Settings:
  Capture screenshots: ☐ (disable)
  (or just accept occasional bad screenshots)
```

**Fix planned:** v12.2.0

---

## Limitations by Design

These are NOT bugs - they're intentional design choices.

### 1. No Bot Detection Evasion Guarantee

**Design Choice:** We evade common detection, but not all

**What we evade:**
- Basic bot detection (User-Agent checks)
- Common fingerprinting (Canvas, WebGL)
- Some WAF systems

**What we DON'T evade:**
- Sophisticated ML-based detection
- Behavioral analysis (if you monitor 1,000x per day)
- Custom security systems
- Sites that explicitly forbid scraping

**Note:** We respect robots.txt and website Terms of Service

---

### 2. No Storage of Full HTML

**Design Choice:** We only store extracted data, not full HTML

**Reason:** Privacy and storage efficiency

**How it works:**
```
Website HTML: 2MB → Extract: price tag, 5KB → Store: 5KB
(saves 99.75% space, keeps what matters)
```

**Limitation:** You can't go back and extract different data from old alerts

**Workaround:** Export data while still monitoring, or use webhooks to store full HTML externally

---

### 3. No Direct Page Interaction (Limited)

**Design Choice:** Can click/fill/type, but can't fully automate complex workflows

**What we CAN do:**
- Click buttons
- Fill forms
- Scroll pages
- Type text

**What we CAN'T do:**
- Multi-step authentication flows
- CAPTCHA solving
- Complex page interactions requiring reasoning
- File uploads to websites

**Workaround:** For complex tasks, use JavaScript execution or contact support

---

### 4. No Historical Comparison Across Versions

**Design Choice:** We compare current to previous, not to any past version

**Limitation:**
```
Can compare: Version A → Version B (latest)
Can't compare: Version A → Version C (from 6 months ago)
```

**Reason:** Storage and performance

**Workaround:** Export historical data, do analysis in Excel/SQL

---

## Future Improvements Roadmap

### v12.2.0 (Coming Late June)
- [ ] Improved WAF evasion
- [ ] Smarter rate limit detection
- [ ] Better JavaScript handling
- [ ] Faster screenshot capture

### v12.3.0 (Coming July)
- [ ] Authenticated monitoring (beta)
- [ ] Lazy-loading for large payloads
- [ ] Better webhook reliability
- [ ] Historical comparison across versions

### v13.0.0 (Coming Q3 2026)
- [ ] Advanced bot detection evasion
- [ ] Multi-step automation workflows
- [ ] Full proxy management console
- [ ] Machine learning for anomaly detection

---

## Workarounds by Use Case

### Use Case: E-Commerce Price Monitoring

**Common issues:**
- Cloudflare blocking
- Rate limiting after many checks
- JavaScript rendering needed

**Workaround setup:**
```
Monitor Settings:
  Execute JavaScript: ✓
  CSS Selector: [.price]
  Proxy: [Residential if Cloudflare blocks]
  Frequency: [Every 15 minutes] (not too aggressive)
  Wait time: [5 seconds]
  Smart Alerts: ✓
```

---

### Use Case: News Monitoring

**Common issues:**
- JavaScript-heavy sites
- No issues usually

**Workaround setup:**
```
Monitor Settings:
  Execute JavaScript: ☐ (usually not needed)
  Monitor Type: [Headlines/text]
  CSS Selector: [.article-title] (just titles)
  Frequency: [Every 1 hour]
```

---

### Use Case: Security Monitoring

**Common issues:**
- Access denied errors
- Rate limiting

**Workaround setup:**
```
Monitor Settings:
  Proxy: [ISP proxy] (if access denied)
  Frequency: [Every 4 hours] (respect rate limits)
  Execute JavaScript: ☐
  Smart Alerts: ✓
  Minimum threshold: [Critical only]
```

---

## Reporting New Issues

Found a bug not listed here? Please report it!

### How to Report

1. **Check if already reported:**
   - GitHub Issues: https://github.com/basset-hound/browser/issues

2. **Provide detailed info:**
   ```
   Title: Brief description
   
   What happened:
   [Detailed explanation]
   
   Steps to reproduce:
   1. [Step 1]
   2. [Step 2]
   3. [Step 3]
   
   Expected behavior:
   [What should happen]
   
   Actual behavior:
   [What actually happened]
   
   Your setup:
   - OS: [Linux/Mac/Windows]
   - Version: [12.1.0]
   - Monitor type: [Price/News/etc]
   - Website: [example.com]
   ```

3. **Report to:**
   - GitHub Issues (public, preferred)
   - Email: support@basset-hound.io (private)
   - Slack: Community channel

---

## Getting Help with Limitations

**Question:** "Will you fix X?"

**Answer:** Check the roadmap above, or:
- Ask in GitHub issues
- Ask in Slack community
- Email support@basset-hound.io

**Question:** "Is there a workaround for X?"

**Answer:** Check the workarounds section above, or:
- Check FAQ.md
- Check TROUBLESHOOTING.md
- Ask in Slack community

**Question:** "Can you build custom solution for X?"

**Answer:** Maybe! Contact our sales team:
- Email: sales@basset-hound.io
- We offer professional services for enterprise needs

---

## Limitation Acceptance

By using Basset Hound Browser, you acknowledge:

- It's designed for public website monitoring
- It respects robots.txt and Terms of Service
- It's not a replacement for official APIs
- It's subject to website blocking/changes
- We maintain best-effort support

This is an honest product that works well for its intended purpose, with known limitations we're transparent about.

---

## Legal & Ethical Note

**Before you monitor:**

1. **Check robots.txt** - Respect crawl-delay and disallow rules
2. **Check Terms of Service** - Does the site allow monitoring?
3. **Check local laws** - Some monitoring may have legal implications
4. **Be respectful** - Don't hammer sites with requests
5. **Have a reason** - Don't monitor just to monitor

**If unsure, ask permission first.** Most websites are happy to help legitimate monitoring requests.

---

## Updates to This Document

This document is updated regularly as:
- Bugs are fixed
- New limitations are discovered
- Workarounds are found
- Roadmap evolves

**Last updated:** June 2, 2026

**Next review:** June 9, 2026

Check back periodically for updates!

---

**Still have questions?** See FAQ.md or contact support@basset-hound.io
