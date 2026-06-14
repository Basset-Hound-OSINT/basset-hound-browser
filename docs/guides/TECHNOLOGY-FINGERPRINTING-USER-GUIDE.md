# Technology Fingerprinting - User Guide

**Version:** v12.0.0  
**For:** Security Researchers, Developers, Threat Analysts

## What Is Technology Fingerprinting?

Technology Fingerprinting automatically detects what software technologies a website uses - frameworks, CMS platforms, analytics tools, payment processors, etc. It analyzes HTML, JavaScript, HTTP headers, cookies, and URL patterns.

**Why Useful:**
- Vulnerability assessment (known CVEs in detected tech)
- Competitive intelligence (what's competitor using?)
- Infrastructure discovery (server, CDN, hosting)
- Technology trends (who's using React vs Vue?)

## When to Use It

### Scenario 1: Assess Security Posture
"Website uses old PHP version. Are there known vulnerabilities?"

### Scenario 2: Identify Attack Surface
"What systems does this site use? What can I target?"

### Scenario 3: Monitor Technology Changes
"Website upgraded from WordPress to custom code. When?"

## Step-by-Step Tutorials

### Tutorial 1: Basic Technology Detection

**Goal:** Identify all technologies on a website

**Steps:**

1. **Fetch page content**
   ```javascript
   const url = 'https://example.com';
   const response = await fetch(url);
   const html = await response.text();
   const headers = Object.fromEntries(response.headers);
   ```

2. **Send to fingerprinter**
   ```javascript
   const detectMsg = {
     command: 'detect_technologies',
     params: {
       sessionId: 'tech_' + Date.now(),
       url: url,
       html: html,
       headers: headers
     }
   };
   
   const result = await send(detectMsg);
   ```

3. **Analyze results**
   ```javascript
   console.log(`Found ${result.data.totalDetected} technologies:\n`);
   
   for (const tech of result.data.technologies) {
     console.log(`${tech.name}`);
     console.log(`  Category: ${tech.category}`);
     console.log(`  Version: ${tech.version || 'unknown'}`);
     console.log(`  Confidence: ${tech.confidence}%`);
     console.log(`  Detection: ${tech.detection}\n`);
   }
   ```

4. **Organize by category**
   ```javascript
   const byCategory = {};
   for (const tech of result.data.technologies) {
     if (!byCategory[tech.category]) {
       byCategory[tech.category] = [];
     }
     byCategory[tech.category].push(tech.name);
   }
   
   console.log('Technology Stack:');
   for (const [category, techs] of Object.entries(byCategory)) {
     console.log(`${category}: ${techs.join(', ')}`);
   }
   ```

### Tutorial 2: Vulnerability Assessment

**Goal:** Find known vulnerabilities in detected technologies

**Steps:**

1. **Detect technologies**
   ```javascript
   const result = await detect_technologies(url);
   ```

2. **Check for known vulnerable versions**
   ```javascript
   const vulnerablePatterns = {
     'WordPress': ['3.x', '4.0-4.4', '5.0-5.1'],
     'jQuery': ['1.x', '2.x'],
     'Apache': ['2.2', '2.4.0-2.4.41'],
     'PHP': ['5.x', '7.0-7.2']
   };
   
   for (const tech of result.data.technologies) {
     if (vulnerablePatterns[tech.name]) {
       const vulnVersions = vulnerablePatterns[tech.name];
       
       if (vulnVersions.some(v => tech.version?.includes(v))) {
         console.warn(`⚠ VULNERABLE: ${tech.name} ${tech.version}`);
         console.warn(`  Check: https://www.cvedetails.com/`);
       }
     }
   }
   ```

3. **Generate security report**
   ```javascript
   const report = {
     url: url,
     scannedAt: new Date().toISOString(),
     technologies: result.data.technologies,
     potentialVulnerabilities: [],
     recommendations: []
   };
   
   // Add vulnerabilities found
   for (const tech of result.data.technologies) {
     if (isKnownVulnerable(tech.name, tech.version)) {
       report.potentialVulnerabilities.push({
         technology: tech.name,
         version: tech.version,
         risk: 'MEDIUM',
         action: 'Update to latest version'
       });
     }
   }
   
   fs.writeFileSync(
     `security_report_${new Date().toISOString()}.json`,
     JSON.stringify(report, null, 2)
   );
   ```

### Tutorial 3: Competitive Intelligence

**Goal:** Compare technology stacks of competitors

**Steps:**

1. **Scan multiple websites**
   ```javascript
   const competitors = [
     'https://competitor1.com',
     'https://competitor2.com',
     'https://competitor3.com'
   ];
   
   const results = {};
   
   for (const url of competitors) {
     const html = await fetch(url).then(r => r.text());
     const result = await send({
       command: 'detect_technologies',
       params: { sessionId: url, url, html }
     });
     
     results[url] = result.data.technologies;
   }
   ```

2. **Build comparison matrix**
   ```javascript
   // Get unique technologies across all sites
   const allTechs = new Set();
   for (const techs of Object.values(results)) {
     techs.forEach(t => allTechs.add(t.name));
   }
   
   // Build matrix
   const matrix = {};
   for (const tech of allTechs) {
     matrix[tech] = {};
     for (const [url, techs] of Object.entries(results)) {
       matrix[tech][url] = techs.some(t => t.name === tech) ? '✓' : '✗';
     }
   }
   
   console.table(matrix);
   ```

3. **Identify unique technologies**
   ```javascript
   // What does competitor1 use that others don't?
   const comp1Techs = new Set(
     results[competitors[0]].map(t => t.name)
   );
   
   const unique = [];
   for (const tech of comp1Techs) {
     let foundInOthers = false;
     for (const [i, url] of competitors.entries()) {
       if (i === 0) continue;  // Skip self
       if (results[url].some(t => t.name === tech)) {
         foundInOthers = true;
       }
     }
     if (!foundInOthers) {
       unique.push(tech);
     }
   }
   
   console.log('Unique to Competitor1:', unique);
   ```

## Best Practices

### 1. Complete Data Collection

✅ **DO:**
```javascript
// Send all available information
const detectMsg = {
  command: 'detect_technologies',
  params: {
    sessionId,
    url,
    html,           // Full HTML
    headers,        // HTTP headers
    cookies,        // Cookies (if available)
    scripts,        // Script sources
    metadata: { }   // Any additional data
  }
};
```

❌ **DON'T:**
```javascript
// Only HTML is incomplete
const detectMsg = {
  command: 'detect_technologies',
  params: {
    sessionId,
    html  // Missing headers, scripts, cookies
  }
};
```

### 2. Handle Low-Confidence Detections

✅ **DO:**
```javascript
for (const tech of result.data.technologies) {
  if (tech.confidence < 70) {
    console.log(`${tech.name}: Low confidence (${tech.confidence}%)`);
    console.log(`  Consider: ${tech.detection}`);
    console.log(`  Verify manually if critical`);
  }
}
```

❌ **DON'T:**
```javascript
// Don't rely on low-confidence detections
if (tech.confidence < 50) {
  console.log('Found: ' + tech.name);  // Likely false positive
}
```

### 3. Cross-Reference Multiple Sites

✅ **DO:**
```javascript
// Technology changes frequently
// Rescan same site weekly/monthly
const previousScan = loadPreviousScan(url);
const currentScan = await detectTechnologies(url);

const added = currentScan.filter(t =>
  !previousScan.some(p => p.name === t.name)
);
const removed = previousScan.filter(t =>
  !currentScan.some(c => c.name === t.name)
);

if (added.length > 0) {
  console.log('New technologies: ' + added.map(t => t.name));
}
```

## Common Scenarios

### Scenario 1: Website Redesign Detection

**Question:** When did competitor redesign their website?

**Solution:**
```javascript
// Rescan website weekly
const history = [];

for (let i = 0; i < 52; i++) {  // 52 weeks
  const result = await detectTechnologies(url);
  history.push({
    week: i,
    date: new Date(Date.now() - (52-i)*7*24*60*60*1000),
    technologies: result.data.technologies.map(t => t.name)
  });
  
  await sleep(7*24*60*60*1000);  // Wait a week
}

// Find when tech stack changed
for (let i = 1; i < history.length; i++) {
  const prev = new Set(history[i-1].technologies);
  const curr = new Set(history[i].technologies);
  
  if (prev.size !== curr.size) {
    console.log(`Technology change on ${history[i].date}:`);
    console.log('  Added:', [...curr].filter(t => !prev.has(t)));
    console.log('  Removed:', [...prev].filter(t => !curr.has(t)));
  }
}
```

### Scenario 2: Vulnerability Hotspot

**Question:** Which competitors are vulnerable?

**Solution:**
```javascript
const competitorVulnerabilities = [];

for (const url of competitors) {
  const result = await detectTechnologies(url);
  const vulns = [];
  
  for (const tech of result.data.technologies) {
    if (isVulnerable(tech.name, tech.version)) {
      vulns.push({
        technology: tech.name,
        version: tech.version,
        cves: getCVEs(tech.name, tech.version)
      });
    }
  }
  
  if (vulns.length > 0) {
    competitorVulnerabilities.push({ url, vulns });
  }
}

console.log('Vulnerable competitors:');
competitorVulnerabilities.forEach(item => {
  console.log(`${item.url}: ${item.vulns.length} vulnerabilities`);
});
```

### Scenario 3: Technology Migration

**Question:** Is this site moving from framework X to framework Y?

**Solution:**
```javascript
// Track single technology over time
const techHistory = [];

for (const scan of historicalScans) {
  const react = scan.technologies.find(t => t.name === 'React');
  const vue = scan.technologies.find(t => t.name === 'Vue');
  
  techHistory.push({
    date: scan.date,
    react: react ? react.version : null,
    vue: vue ? vue.version : null
  });
}

// Analyze trend
console.log('React → Vue migration?');
techHistory.forEach((entry, i) => {
  if (i > 0) {
    const prev = techHistory[i-1];
    if (prev.react && !entry.react && entry.vue) {
      console.log(`Migrated on ${entry.date}`);
    }
  }
});
```

## Troubleshooting

### Q: Detection confidence is low for some techs. Why?

**Reasons:**
1. **Minified/obfuscated code** - Hard to detect
2. **Custom implementation** - Not using standard patterns
3. **Shadow DOM/hidden scripts** - Not in HTML
4. **Multiple versions** - Can't determine which

**Solution:**
```javascript
if (tech.confidence < 80) {
  // Manual verification needed
  console.log(`${tech.name}: Manual verification needed`);
  console.log(`Detection: ${tech.detection}`);
  console.log('Manual check: Look in Network tab for requests');
}
```

### Q: I know a technology is used but it's not detected. Why?

**Reasons:**
1. **Pattern database incomplete** - 80+ coverage but not 100%
2. **Custom branding** - Using custom names/paths
3. **Removed from public view** - Loaded from hidden iframe
4. **Version too new** - Not in pattern database yet

**Solution:**
```javascript
// Verify manually
console.log('Manual verification:');
console.log('1. Check Network tab for known scripts');
console.log('2. Look at HTML source for meta tags');
console.log('3. Check for framework-specific globals');
console.log('4. Look for CSS framework classes');
```

---

## Quick Reference

### Technologies Detectable

**JavaScript Frameworks:** React, Vue, Angular, Svelte, Next.js, Nuxt.js, Gatsby

**CMS:** WordPress, Drupal, Joomla, Magento, Ghost, Contentful

**Analytics:** Google Analytics, Mixpanel, Segment, Heap

**CDN:** Cloudflare, Akamai, AWS CloudFront, Fastly

**Payment:** Stripe, PayPal, Square, Authorize.net

**Servers:** Apache, Nginx, IIS, Node.js, LiteSpeed

**And 20+ more categories...**

### Command Reference

```javascript
// Detect
detect_technologies(url, html, headers)

// Get categories
get_technology_categories()

// Get details
get_technology_fingerprint(technology)

// Search
search_technologies(query, searchIn)
```

---

## Related Documentation

- [Technology Fingerprinting - Integration Guide](../integration/TECHNOLOGY-FINGERPRINTING-INTEGRATION-GUIDE.md)
- [Technology Fingerprinting - API Reference](../api/TECHNOLOGY-FINGERPRINTING-API-REFERENCE.md)
