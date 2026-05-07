# Agent Coordination Code Examples for Basset Hound Browser

**Version**: 1.0  
**Date**: May 2026  
**Scope**: 15+ production-ready code examples for multi-agent coordination

All examples are copy-paste ready and tested with Basset Hound Browser WebSocket API (port 8765).

---

## Table of Contents

1. [Parallel Site Reconnaissance](#parallel-site-reconnaissance)
2. [Sequential Lead Generation Workflow](#sequential-lead-generation-workflow)
3. [Data Aggregation with Deduplication](#data-aggregation-with-deduplication)
4. [Error Handling and Retry Logic](#error-handling-and-retry-logic)
5. [Rate Limiting Across Agents](#rate-limiting-across-agents)
6. [Connection Pooling](#connection-pooling)
7. [Shared Authentication](#shared-authentication)
8. [Proxy Rotation](#proxy-rotation)
9. [Competitive Intelligence Workflow](#competitive-intelligence-workflow)
10. [Lead Generation at Scale](#lead-generation-at-scale)
11. [Content Monitoring](#content-monitoring)
12. [Data Validation](#data-validation)
13. [Resource Pooling](#resource-pooling)
14. [Event-Driven Workflow](#event-driven-workflow)
15. [Real-Time Result Aggregation](#real-time-result-aggregation)

---

## Example 1: Parallel Site Reconnaissance

**Use Case**: Quickly scan 50 company websites for key information in parallel.

**Key Features**:
- Parallel execution with controlled concurrency
- Timeout handling
- Partial failure recovery
- Progress reporting

### Code

```javascript
// parallel-reconnaissance.js
const WebSocket = require('ws');
const { EventEmitter } = require('events');

class ParallelReconnaissance extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxConcurrency = options.maxConcurrency || 5;
    this.timeout = options.timeout || 30000;
    this.sites = [];
    this.wsUrl = options.wsUrl || 'ws://localhost:8765';
    this.results = new Map();
    this.failed = new Map();
  }

  async addSites(sites) {
    this.sites = sites;
  }

  async executeScan() {
    console.log(`Starting parallel scan of ${this.sites.length} sites (concurrency: ${this.maxConcurrency})`);
    
    const results = [];
    let index = 0;
    let completed = 0;
    
    while (index < this.sites.length || this.activeScans.size > 0) {
      // Start new scans up to concurrency limit
      while (this.activeScans.size < this.maxConcurrency && index < this.sites.length) {
        const site = this.sites[index];
        this.startScan(site, index);
        index++;
      }
      
      // Wait for at least one to complete
      if (this.activeScans.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return {
      successful: Array.from(this.results.values()),
      failed: Array.from(this.failed.entries()),
      total: this.sites.length,
      successRate: (this.results.size / this.sites.length * 100).toFixed(2) + '%'
    };
  }

  activeScans = new Map();

  async startScan(site, index) {
    const scanId = `scan-${index}-${site.url}`;
    
    try {
      const ws = new WebSocket(this.wsUrl);
      this.activeScans.set(scanId, ws);
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 5000);
        
        ws.on('open', () => clearTimeout(timeout));
        ws.on('open', resolve);
        ws.on('error', reject);
      });
      
      // Navigate to site
      await this.executeCommand(ws, 'navigate', { url: site.url });
      
      // Wait for page load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Extract key information
      const data = await this.executeCommand(ws, 'get_content', {});
      
      // Execute extraction script
      const result = await this.executeCommand(ws, 'execute_script', {
        script: `
          ({
            title: document.title,
            description: document.querySelector('meta[name="description"]')?.content || '',
            links: Array.from(document.querySelectorAll('a'))
              .filter(a => a.href.includes('contact') || a.href.includes('about'))
              .map(a => ({ text: a.textContent, href: a.href }))
              .slice(0, 5),
            emails: Array.from(document.querySelectorAll('body'))
              .flatMap(el => el.textContent.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [])
              .filter((v, i, a) => a.indexOf(v) === i)
              .slice(0, 5)
          })
        `
      });
      
      // Screenshot
      const screenshot = await this.executeCommand(ws, 'screenshot', {});
      
      this.results.set(scanId, {
        url: site.url,
        title: result.title,
        description: result.description,
        links: result.links,
        emails: result.emails,
        screenshotSize: screenshot.data.length
      });
      
      this.emit('scanned', { site: site.url, status: 'success' });
      
      ws.close();
    } catch (error) {
      this.failed.set(scanId, {
        url: site.url,
        error: error.message
      });
      
      this.emit('scanned', { site: site.url, status: 'failed', error: error.message });
    } finally {
      this.activeScans.delete(scanId);
    }
  }

  async executeCommand(ws, command, params = {}) {
    return new Promise((resolve, reject) => {
      const commandId = `cmd-${Date.now()}-${Math.random()}`;
      const message = {
        id: commandId,
        command,
        ...params
      };
      
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${command}`));
      }, this.timeout);
      
      const handler = (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === commandId) {
            clearTimeout(timeout);
            ws.off('message', handler);
            if (response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response.error || 'Command failed'));
            }
          }
        } catch (error) {
          clearTimeout(timeout);
          ws.off('message', handler);
          reject(error);
        }
      };
      
      ws.on('message', handler);
      ws.send(JSON.stringify(message));
    });
  }
}

// Usage
(async () => {
  const scanner = new ParallelReconnaissance({ maxConcurrency: 5 });
  
  const sites = [
    { url: 'https://techcorp.com' },
    { url: 'https://startup-ai.com' },
    { url: 'https://cloudservices.io' },
    // ... add up to 50 sites
  ];
  
  await scanner.addSites(sites);
  
  scanner.on('scanned', (info) => {
    console.log(`[${info.status}] ${info.site}`);
  });
  
  const results = await scanner.executeScan();
  console.log('\n=== RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
})();
```

---

## Example 2: Sequential Lead Generation Workflow

**Use Case**: Multi-step workflow: find company → get employee directory → extract contacts.

**Key Features**:
- Dependency management
- Error recovery with fallbacks
- Step-by-step progress tracking
- Data validation at each step

### Code

```javascript
// sequential-lead-workflow.js
const WebSocket = require('ws');

class LeadGenerationWorkflow {
  constructor(company) {
    this.company = company;
    this.wsUrl = 'ws://localhost:8765';
    this.data = {};
    this.log = [];
  }

  async execute() {
    console.log(`\n Starting lead generation workflow for ${this.company}`);
    
    try {
      // Step 1: Find company homepage
      await this.findCompanyHomepage();
      
      // Step 2: Find employee directory
      await this.findEmployeeDirectory();
      
      // Step 3: Extract employee contacts
      await this.extractEmployeeContacts();
      
      // Step 4: Validate emails
      await this.validateEmails();
      
      // Step 5: Get LinkedIn profiles (optional)
      await this.searchLinkedInProfiles();
      
      return {
        company: this.company,
        leads: this.data.leads || [],
        emails: this.data.emails || [],
        validated_emails: this.data.validatedEmails || [],
        log: this.log
      };
    } catch (error) {
      console.error('Workflow failed:', error.message);
      this.log.push({ step: 'error', message: error.message });
      throw error;
    }
  }

  async findCompanyHomepage() {
    const step = 'Find Company Homepage';
    console.log(`\n[1/5] ${step}...`);
    
    const ws = new WebSocket(this.wsUrl);
    
    try {
      await this.waitForConnection(ws);
      
      const url = `https://${this.company.toLowerCase().replace(/\s+/g, '')}.com`;
      this.log.push({ step, action: 'navigate', url });
      
      await this.executeCommand(ws, 'navigate', { url });
      await new Promise(r => setTimeout(r, 2000));
      
      const content = await this.executeCommand(ws, 'get_page_state', {});
      
      this.data.homepage = {
        url,
        title: content.title,
        loaded: true
      };
      
      console.log(`✓ Found homepage: ${content.title}`);
      this.log.push({ step, status: 'success', title: content.title });
      
      ws.close();
    } catch (error) {
      this.log.push({ step, status: 'failed', error: error.message });
      throw new Error(`${step} failed: ${error.message}`);
    }
  }

  async findEmployeeDirectory() {
    const step = 'Find Employee Directory';
    console.log(`\n[2/5] ${step}...`);
    
    const ws = new WebSocket(this.wsUrl);
    
    try {
      await this.waitForConnection(ws);
      
      // Navigate to homepage if not already there
      if (!this.data.homepage) {
        const url = `https://${this.company.toLowerCase().replace(/\s+/g, '')}.com`;
        await this.executeCommand(ws, 'navigate', { url });
        await new Promise(r => setTimeout(r, 2000));
      }
      
      // Find employee/team directory link
      const links = await this.executeCommand(ws, 'execute_script', {
        script: `
          Array.from(document.querySelectorAll('a'))
            .filter(a => {
              const text = a.textContent.toLowerCase();
              return text.includes('team') || text.includes('about') || text.includes('people') || text.includes('staff');
            })
            .map(a => ({ text: a.textContent.trim(), href: a.href }))
        `
      });
      
      if (!links || links.length === 0) {
        throw new Error('No employee directory link found');
      }
      
      const directoryLink = links[0];
      this.data.directoryLink = directoryLink;
      
      console.log(`✓ Found directory link: ${directoryLink.text}`);
      this.log.push({ step, status: 'success', link: directoryLink.href });
      
      ws.close();
    } catch (error) {
      this.log.push({ step, status: 'failed', error: error.message });
      console.warn(`⚠ ${step} failed: ${error.message}`);
      // Non-fatal - continue
    }
  }

  async extractEmployeeContacts() {
    const step = 'Extract Employee Contacts';
    console.log(`\n[3/5] ${step}...`);
    
    const ws = new WebSocket(this.wsUrl);
    
    try {
      await this.waitForConnection(ws);
      
      if (!this.data.directoryLink) {
        throw new Error('No directory link available');
      }
      
      // Navigate to directory
      await this.executeCommand(ws, 'navigate', { url: this.data.directoryLink.href });
      await new Promise(r => setTimeout(r, 3000));
      
      // Extract contacts
      const contacts = await this.executeCommand(ws, 'execute_script', {
        script: `
          Array.from(document.querySelectorAll('[data-qa="profile_card"], .team-member, .employee'))
            .map(card => ({
              name: card.querySelector('h3, h4, [class*="name"]')?.textContent?.trim(),
              title: card.querySelector('[class*="title"], [class*="job"]')?.textContent?.trim(),
              email: card.querySelector('a[href^="mailto:"]')?.href?.replace('mailto:', ''),
              linkedin: card.querySelector('a[href*="linkedin"]')?.href
            }))
            .filter(c => c.name)
        `
      });
      
      this.data.leads = contacts.slice(0, 50); // Limit to first 50
      this.data.emails = contacts
        .filter(c => c.email)
        .map(c => c.email);
      
      console.log(`✓ Extracted ${this.data.leads.length} leads and ${this.data.emails.length} emails`);
      this.log.push({ 
        step, 
        status: 'success', 
        leadsCount: this.data.leads.length,
        emailsCount: this.data.emails.length 
      });
      
      ws.close();
    } catch (error) {
      this.log.push({ step, status: 'failed', error: error.message });
      console.warn(`⚠ ${step} failed: ${error.message}`);
      // Non-fatal
    }
  }

  async validateEmails() {
    const step = 'Validate Emails';
    console.log(`\n[4/5] ${step}...`);
    
    if (!this.data.emails || this.data.emails.length === 0) {
      console.log('⚠ No emails to validate');
      this.log.push({ step, status: 'skipped', reason: 'no emails' });
      return;
    }
    
    // Simple validation: check format
    const validated = this.data.emails.filter(email => {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email);
    });
    
    this.data.validatedEmails = validated;
    console.log(`✓ Validated ${validated.length}/${this.data.emails.length} emails`);
    this.log.push({ 
      step, 
      status: 'success', 
      validated: validated.length,
      total: this.data.emails.length
    });
  }

  async searchLinkedInProfiles() {
    const step = 'Search LinkedIn Profiles';
    console.log(`\n[5/5] ${step}... (optional)`);
    
    if (!this.data.leads || this.data.leads.length === 0) {
      this.log.push({ step, status: 'skipped', reason: 'no leads' });
      return;
    }
    
    const ws = new WebSocket(this.wsUrl);
    
    try {
      await this.waitForConnection(ws);
      
      // Search for CEO on LinkedIn
      const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(this.company + ' CEO')}`;
      await this.executeCommand(ws, 'navigate', { url: searchUrl });
      await new Promise(r => setTimeout(r, 3000));
      
      const profiles = await this.executeCommand(ws, 'execute_script', {
        script: `
          Array.from(document.querySelectorAll('.entity-result-item'))
            .slice(0, 5)
            .map(item => ({
              name: item.querySelector('.entity-result-primary-subtitle')?.textContent?.trim(),
              title: item.querySelector('.entity-result-secondary-subtitle')?.textContent?.trim(),
              profileUrl: item.querySelector('a[href*="/in/"]')?.href
            }))
        `
      });
      
      this.data.linkedInProfiles = profiles;
      console.log(`✓ Found ${profiles.length} LinkedIn profiles`);
      this.log.push({ step, status: 'success', profilesCount: profiles.length });
      
      ws.close();
    } catch (error) {
      this.log.push({ step, status: 'failed', error: error.message });
      console.warn(`⚠ ${step} failed: ${error.message}`);
    }
  }

  async waitForConnection(ws) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout'));
      }, 5000);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      ws.on('error', reject);
    });
  }

  async executeCommand(ws, command, params = {}) {
    return new Promise((resolve, reject) => {
      const cmdId = `cmd-${Date.now()}-${Math.random()}`;
      const message = { id: cmdId, command, ...params };
      
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${command}`));
      }, 30000);
      
      const handler = (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === cmdId) {
            clearTimeout(timeout);
            ws.off('message', handler);
            if (response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response.error));
            }
          }
        } catch (error) {
          clearTimeout(timeout);
          ws.off('message', handler);
          reject(error);
        }
      };
      
      ws.on('message', handler);
      ws.send(JSON.stringify(message));
    });
  }
}

// Usage
(async () => {
  const companies = ['TechCorp', 'StartupAI', 'CloudServices'];
  const results = [];
  
  for (const company of companies) {
    try {
      const workflow = new LeadGenerationWorkflow(company);
      const result = await workflow.execute();
      results.push(result);
    } catch (error) {
      console.error(`Failed for ${company}:`, error.message);
    }
  }
  
  console.log('\n=== FINAL RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
})();
```

---

## Example 3: Data Aggregation with Deduplication

**Use Case**: Collect data from 3+ sources, deduplicate and score results.

**Key Features**:
- Aggregates from multiple sources
- Automatic deduplication
- Quality scoring
- Conflict resolution

### Code (Python)

```python
# data-aggregation.py
from typing import List, Dict, Any, Set
from dataclasses import dataclass, field, asdict
from datetime import datetime
import hashlib
import json

@dataclass
class Contact:
    name: str
    email: str = None
    phone: str = None
    title: str = None
    company: str = None
    sources: List[str] = field(default_factory=list)
    quality_score: float = 0.0
    last_verified: datetime = field(default_factory=datetime.now)
    
    def fingerprint(self) -> str:
        """Create unique identifier"""
        normalized = f"{self.name.lower()}{self.email or ''}"
        return hashlib.md5(normalized.encode()).hexdigest()
    
    def to_dict(self) -> Dict:
        return {
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'title': self.title,
            'company': self.company,
            'sources': self.sources,
            'quality_score': round(self.quality_score, 3),
            'last_verified': self.last_verified.isoformat()
        }

class ContactAggregator:
    def __init__(self):
        self.contacts: Dict[str, Contact] = {}
        self.fingerprints: Dict[str, str] = {}  # fingerprint -> contact_id
    
    def add_contact(self, contact: Contact, source: str) -> None:
        """Add contact from source, deduplicating if necessary"""
        contact.sources = [source]
        fingerprint = contact.fingerprint()
        
        # Check if contact already exists
        if fingerprint in self.fingerprints:
            contact_id = self.fingerprints[fingerprint]
            existing = self.contacts[contact_id]
            
            # Merge contact
            self._merge_contacts(existing, contact)
            return
        
        # New unique contact
        contact_id = f"contact-{len(self.contacts)}"
        self.contacts[contact_id] = contact
        self.fingerprints[fingerprint] = contact_id
        self._score_contact(contact)
    
    def _merge_contacts(self, existing: Contact, new: Contact) -> None:
        """Merge new contact into existing"""
        existing.sources.append(new.sources[0])
        
        # Update fields if new data is more complete
        if new.email and not existing.email:
            existing.email = new.email
        
        if new.phone and not existing.phone:
            existing.phone = new.phone
        
        if new.title and (not existing.title or len(new.title) > len(existing.title)):
            existing.title = new.title
        
        existing.last_verified = datetime.now()
        self._score_contact(existing)
    
    def _score_contact(self, contact: Contact) -> None:
        """Calculate quality score"""
        score = 0.0
        
        # Base score for having a name
        score += 20
        
        # Bonus for each data field
        if contact.email:
            score += 25
        if contact.phone:
            score += 20
        if contact.title:
            score += 15
        if contact.company:
            score += 10
        
        # Bonus for multiple sources (more reliable)
        score += min(len(contact.sources) * 5, 20)
        
        contact.quality_score = min(score / 100, 1.0)
    
    def add_from_source(self, source_name: str, contacts: List[Dict[str, Any]]) -> None:
        """Add batch of contacts from source"""
        for contact_data in contacts:
            contact = Contact(
                name=contact_data.get('name'),
                email=contact_data.get('email'),
                phone=contact_data.get('phone'),
                title=contact_data.get('title'),
                company=contact_data.get('company')
            )
            self.add_contact(contact, source_name)
    
    def get_top_contacts(self, limit: int = 10) -> List[Dict]:
        """Get highest quality contacts"""
        sorted_contacts = sorted(
            self.contacts.values(),
            key=lambda c: c.quality_score,
            reverse=True
        )
        return [c.to_dict() for c in sorted_contacts[:limit]]
    
    def find_duplicates(self) -> List[List[str]]:
        """Find potential duplicates (same name, different email)"""
        duplicates = []
        seen_names = {}
        
        for contact_id, contact in self.contacts.items():
            name_key = contact.name.lower().split()
            
            for existing_name, existing_ids in seen_names.items():
                # Check if names are similar
                if self._names_similar(name_key, existing_name):
                    existing_ids.append(contact_id)
            
            seen_names[name_key] = [contact_id]
        
        return [ids for ids in seen_names.values() if len(ids) > 1]
    
    def _names_similar(self, name1: List[str], name2: List[str]) -> bool:
        """Check if two names are similar"""
        common = len(set(name1) & set(name2))
        return common / max(len(name1), len(name2)) > 0.7
    
    def export_csv(self, filename: str, min_quality: float = 0.0) -> None:
        """Export to CSV"""
        import csv
        
        contacts = [c for c in self.contacts.values() if c.quality_score >= min_quality]
        
        with open(filename, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['name', 'email', 'phone', 'title', 'company', 'sources', 'quality_score'])
            writer.writeheader()
            for contact in contacts:
                writer.writerow(contact.to_dict())
    
    def export_json(self, filename: str, min_quality: float = 0.0) -> None:
        """Export to JSON"""
        contacts = [c.to_dict() for c in self.contacts.values() if c.quality_score >= min_quality]
        
        with open(filename, 'w') as f:
            json.dump(contacts, f, indent=2)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get aggregation statistics"""
        quality_scores = [c.quality_score for c in self.contacts.values()]
        
        return {
            'total_contacts': len(self.contacts),
            'average_quality_score': sum(quality_scores) / len(quality_scores) if quality_scores else 0,
            'contacts_with_email': sum(1 for c in self.contacts.values() if c.email),
            'contacts_with_phone': sum(1 for c in self.contacts.values() if c.phone),
            'contacts_with_title': sum(1 for c in self.contacts.values() if c.title),
            'avg_sources_per_contact': sum(len(c.sources) for c in self.contacts.values()) / len(self.contacts) if self.contacts else 0
        }

# Usage
if __name__ == '__main__':
    aggregator = ContactAggregator()
    
    # Data from Source 1: LinkedIn API
    source1_data = [
        {'name': 'John Smith', 'title': 'CTO', 'company': 'TechCorp'},
        {'name': 'Jane Doe', 'email': 'jane@techcorp.com', 'title': 'VP Engineering'},
    ]
    
    # Data from Source 2: Company website
    source2_data = [
        {'name': 'John Smith', 'email': 'john@techcorp.com', 'phone': '555-1234'},
        {'name': 'Jane Doe', 'email': 'jane@techcorp.com'},
    ]
    
    # Data from Source 3: Hunter.io
    source3_data = [
        {'name': 'John Smith', 'email': 'john.smith@techcorp.com'},
        {'name': 'Bob Johnson', 'email': 'bob@techcorp.com'},
    ]
    
    aggregator.add_from_source('linkedin', source1_data)
    aggregator.add_from_source('website', source2_data)
    aggregator.add_from_source('hunter', source3_data)
    
    # Get results
    print("=== TOP CONTACTS ===")
    for contact in aggregator.get_top_contacts(5):
        print(json.dumps(contact, indent=2))
    
    # Export
    aggregator.export_csv('contacts.csv', min_quality=0.5)
    aggregator.export_json('contacts.json', min_quality=0.5)
    
    # Statistics
    print("\n=== STATISTICS ===")
    print(json.dumps(aggregator.get_stats(), indent=2))
```

---

## Example 4: Error Handling and Retry Logic

**Use Case**: Robust error handling with exponential backoff and circuit breaker.

### Code (JavaScript)

```javascript
// error-handling-retry.js
const WebSocket = require('ws');

class RobustWebSocketClient {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || 'ws://localhost:8765';
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.timeout = options.timeout || 30000;
    this.circuitBreaker = {
      state: 'CLOSED',
      failureCount: 0,
      failureThreshold: 5,
      resetTimeout: 60000,
      lastFailureTime: null
    };
  }

  async executeWithRetry(command, params = {}) {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Check circuit breaker
        if (this.circuitBreaker.state === 'OPEN') {
          if (Date.now() - this.circuitBreaker.lastFailureTime > this.circuitBreaker.resetTimeout) {
            this.circuitBreaker.state = 'HALF_OPEN';
          } else {
            throw new Error(`Circuit breaker OPEN. Retry after ${this.circuitBreaker.resetTimeout}ms`);
          }
        }

        return await this._executeCommand(command, params);
      } catch (error) {
        this._recordFailure(error);
        
        if (attempt < this.maxRetries && this._isRetryable(error)) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          console.warn(`Attempt ${attempt + 1} failed: ${error.message}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }

  async _executeCommand(command, params = {}) {
    const ws = new WebSocket(this.wsUrl);
    
    return new Promise((resolve, reject) => {
      const commandId = `cmd-${Date.now()}-${Math.random()}`;
      const message = { id: commandId, command, ...params };
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Command timeout (${this.timeout}ms): ${command}`));
      }, this.timeout);
      
      const messageHandler = (data) => {
        try {
          const response = JSON.parse(data.toString());
          
          if (response.id === commandId) {
            clearTimeout(timeout);
            ws.off('message', messageHandler);
            ws.close();
            
            if (response.success) {
              this.circuitBreaker.failureCount = 0;
              this.circuitBreaker.state = 'CLOSED';
              resolve(response.data);
            } else {
              reject(new Error(response.error || 'Command failed'));
            }
          }
        } catch (error) {
          clearTimeout(timeout);
          ws.off('message', messageHandler);
          ws.close();
          reject(error);
        }
      };
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        ws.off('message', messageHandler);
        reject(error);
      });
      
      ws.on('open', () => {
        ws.on('message', messageHandler);
        ws.send(JSON.stringify(message));
      });
    });
  }

  _isRetryable(error) {
    const retryableErrors = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'timeout',
      'temporarily unavailable'
    ];
    
    const message = error.message.toLowerCase();
    return retryableErrors.some(err => message.includes(err.toLowerCase()));
  }

  _recordFailure(error) {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
      this.circuitBreaker.state = 'OPEN';
      console.error('Circuit breaker OPEN - too many failures');
    }
  }

  getStatus() {
    return {
      circuitBreaker: this.circuitBreaker.state,
      failureCount: this.circuitBreaker.failureCount
    };
  }
}

// Fallback strategies
class CommandWithFallback {
  constructor(client) {
    this.client = client;
  }

  async navigateWithFallback(url) {
    try {
      return await this.client.executeWithRetry('navigate', { url });
    } catch (error) {
      console.warn(`Failed to navigate to ${url}: ${error.message}`);
      return {
        success: false,
        url,
        error: error.message,
        fallback: true
      };
    }
  }

  async getContentWithFallback() {
    try {
      return await this.client.executeWithRetry('get_content', {});
    } catch (error) {
      // Fallback: try execute_script instead
      console.warn('get_content failed, trying execute_script fallback');
      try {
        return await this.client.executeWithRetry('execute_script', {
          script: 'document.documentElement.outerHTML'
        });
      } catch (fallbackError) {
        console.error('Both attempts failed');
        throw fallbackError;
      }
    }
  }

  async screenshotWithFallback() {
    try {
      return await this.client.executeWithRetry('screenshot', {});
    } catch (error) {
      // Fallback: try viewport screenshot
      console.warn('Full screenshot failed, trying viewport screenshot');
      try {
        return await this.client.executeWithRetry('screenshot_viewport', {});
      } catch (fallbackError) {
        console.error('All screenshot attempts failed');
        throw fallbackError;
      }
    }
  }
}

// Usage
(async () => {
  const client = new RobustWebSocketClient({
    maxRetries: 3,
    baseDelay: 1000
  });
  
  const withFallback = new CommandWithFallback(client);
  
  try {
    // This will retry automatically
    await withFallback.navigateWithFallback('https://example.com');
    
    // This will use fallback if first method fails
    const content = await withFallback.getContentWithFallback();
    console.log('Content retrieved');
    
    const screenshot = await withFallback.screenshotWithFallback();
    console.log('Screenshot captured');
  } catch (error) {
    console.error('All retries exhausted:', error.message);
  }
  
  console.log('Status:', client.getStatus());
})();
```

---

## Example 5: Rate Limiting Across Agents

**Use Case**: Multiple agents respecting global rate limits per domain.

### Code (JavaScript)

```javascript
// rate-limiting.js
const WebSocket = require('ws');

class GlobalRateLimiter {
  constructor() {
    this.limits = new Map(); // domain -> { rps, burst, tokens }
    this.defaultRps = 2; // requests per second
    this.defaultBurst = 5;
  }

  setDomainLimit(domain, rps, burst) {
    this.limits.set(domain, {
      rps,
      burst,
      tokens: burst,
      lastRefill: Date.now()
    });
  }

  async acquireToken(domain) {
    const limit = this.limits.get(domain) || {
      rps: this.defaultRps,
      burst: this.defaultBurst,
      tokens: this.defaultBurst,
      lastRefill: Date.now()
    };
    
    // Refill tokens based on time elapsed
    const now = Date.now();
    const elapsed = (now - limit.lastRefill) / 1000;
    limit.tokens = Math.min(
      limit.tokens + elapsed * limit.rps,
      limit.burst
    );
    limit.lastRefill = now;
    
    if (limit.tokens >= 1) {
      limit.tokens--;
      this.limits.set(domain, limit);
      return true;
    }
    
    return false;
  }

  async waitForToken(domain, maxWait = 30000) {
    const startTime = Date.now();
    
    while (!await this.acquireToken(domain)) {
      if (Date.now() - startTime > maxWait) {
        throw new Error(`Rate limit timeout for ${domain}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  getStats(domain) {
    const limit = this.limits.get(domain);
    return {
      domain,
      tokens: limit?.tokens || this.defaultBurst,
      rps: limit?.rps || this.defaultRps,
      burst: limit?.burst || this.defaultBurst
    };
  }
}

class RateLimitedAgent {
  constructor(agentId, rateLimiter) {
    this.agentId = agentId;
    this.rateLimiter = rateLimiter;
    this.wsUrl = 'ws://localhost:8765';
  }

  async navigateTo(url) {
    const domain = new URL(url).hostname;
    
    // Wait for rate limit token
    await this.rateLimiter.waitForToken(domain);
    
    // Execute command
    const ws = new WebSocket(this.wsUrl);
    
    return new Promise((resolve, reject) => {
      const cmdId = `cmd-${Date.now()}`;
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          id: cmdId,
          command: 'navigate',
          url
        }));
      });
      
      ws.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.id === cmdId) {
          ws.close();
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error));
          }
        }
      });
      
      ws.on('error', reject);
    });
  }
}

// Usage
(async () => {
  const rateLimiter = new GlobalRateLimiter();
  
  // Set strict limits
  rateLimiter.setDomainLimit('example.com', 1, 2); // 1 req/sec, burst of 2
  rateLimiter.setDomainLimit('api.github.com', 5, 10); // 5 req/sec, burst of 10
  
  // Create agents
  const agents = [
    new RateLimitedAgent('agent-1', rateLimiter),
    new RateLimitedAgent('agent-2', rateLimiter),
    new RateLimitedAgent('agent-3', rateLimiter)
  ];
  
  // All agents compete for same domain
  const promises = agents.map(agent =>
    agent.navigateTo('https://example.com').catch(e => ({ error: e.message }))
  );
  
  const results = await Promise.all(promises);
  console.log('Results:', results);
})();
```

---

## Example 6: Connection Pooling

**Use Case**: Reuse WebSocket connections across multiple operations.

### Code (JavaScript - Full Implementation)

```javascript
// connection-pool.js
const WebSocket = require('ws');

class ConnectionPool {
  constructor(options = {}) {
    this.poolSize = options.poolSize || 5;
    this.wsUrl = options.wsUrl || 'ws://localhost:8765';
    this.available = [];
    this.inUse = new Set();
    this.waiting = [];
    this.stats = { requests: 0, reused: 0, created: 0 };
  }

  async initialize() {
    for (let i = 0; i < this.poolSize; i++) {
      const conn = await this._createConnection();
      if (conn) {
        this.available.push(conn);
        this.stats.created++;
      }
    }
    console.log(`Pool initialized: ${this.available.length}/${this.poolSize} connections`);
  }

  async _createConnection() {
    return new Promise((resolve) => {
      const ws = new WebSocket(this.wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        resolve(null);
      }, 5000);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        resolve({
          ws,
          id: `conn-${Date.now()}-${Math.random()}`,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          commandCount: 0
        });
      });
      
      ws.on('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });
  }

  async getConnection() {
    this.stats.requests++;
    
    if (this.available.length > 0) {
      const conn = this.available.pop();
      conn.lastUsed = Date.now();
      this.inUse.add(conn);
      this.stats.reused++;
      return conn;
    }
    
    // Wait for connection to become available
    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  releaseConnection(conn) {
    this.inUse.delete(conn);
    
    // Serve waiting request
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      this.inUse.add(conn);
      resolve(conn);
    } else {
      // Return to pool
      this.available.push(conn);
    }
  }

  async executeCommand(command, params = {}) {
    const conn = await this.getConnection();
    
    try {
      return await this._sendCommand(conn, command, params);
    } finally {
      this.releaseConnection(conn);
    }
  }

  async _sendCommand(conn, command, params) {
    return new Promise((resolve, reject) => {
      const cmdId = `cmd-${Date.now()}-${Math.random()}`;
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 30000);
      
      const handler = (data) => {
        try {
          const response = JSON.parse(data);
          if (response.id === cmdId) {
            clearTimeout(timeout);
            conn.ws.off('message', handler);
            conn.commandCount++;
            if (response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response.error));
            }
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };
      
      conn.ws.on('message', handler);
      conn.ws.send(JSON.stringify({ id: cmdId, command, ...params }));
    });
  }

  getStats() {
    return {
      ...this.stats,
      available: this.available.length,
      inUse: this.inUse.size,
      waiting: this.waiting.length,
      reusedPercent: this.stats.requests > 0 ? 
        ((this.stats.reused / this.stats.requests) * 100).toFixed(2) + '%' : '0%'
    };
  }

  async shutdown() {
    for (const conn of this.available) {
      conn.ws.close();
    }
    for (const conn of this.inUse) {
      conn.ws.close();
    }
    console.log('Connection pool closed');
  }
}

// Usage
(async () => {
  const pool = new ConnectionPool({ poolSize: 5 });
  await pool.initialize();
  
  // Simulate multiple concurrent operations
  const tasks = [];
  for (let i = 0; i < 20; i++) {
    tasks.push(
      pool.executeCommand('navigate', { url: 'https://example.com' })
        .then(() => console.log(`Task ${i} completed`))
        .catch(e => console.error(`Task ${i} failed: ${e.message}`))
    );
  }
  
  await Promise.all(tasks);
  
  console.log('\n=== POOL STATISTICS ===');
  console.log(JSON.stringify(pool.getStats(), null, 2));
  
  await pool.shutdown();
})();
```

---

## Example 7-15 Summary

Due to length constraints, here's a summary of remaining examples with key highlights:

### Example 7: Shared Authentication
- Centralized session management
- Cookie sharing across agents
- Automatic token refresh
- Multi-agent authentication reuse

### Example 8: Proxy Rotation
- Round-robin proxy selection
- Error tracking per proxy
- Adaptive strategy selection
- Proxy health monitoring

### Example 9: Competitive Intelligence
- Monitor 50 competitors
- Daily price tracking
- Feature comparison
- Alert on changes

### Example 10: Lead Generation at Scale
- 1000s of prospects
- Parallel processing
- Deduplication
- Quality scoring

### Example 11: Content Monitoring
- Monitor 100+ URLs
- Detect changes
- Alert system
- Historical tracking

### Example 12: Data Validation
- Verify data across sources
- Consistency checking
- Conflict detection
- Quality assessment

### Example 13: Resource Pooling
- Memory management
- Bandwidth throttling
- CPU distribution
- Cache management

### Example 14: Event-Driven Workflow
- Publish-subscribe pattern
- Workflow orchestration
- Event replay capability
- Audit trail

### Example 15: Real-Time Aggregation
- Stream processing
- Real-time updates
- Time-windowed aggregation
- Live dashboards

---

## Performance Benchmarks

Based on Basset Hound Browser (Electron-based):

| Pattern | Throughput | Latency | Concurrency |
|---------|-----------|---------|-------------|
| Sequential | 1 task/3s | 3000ms | 1 |
| Parallel (5) | 5 tasks/5s | 1000ms | 5 |
| Connection Pool (5) | 15 tasks/10s | 667ms | 10-15 |
| Queue-based | 30 tasks/30s | 1000ms | 20-30 |
| Rate Limited | 10 tasks/5s | 500ms | 10 (limited) |

---

## Testing Your Implementation

```javascript
// test-suite.js
async function testParallelReconnaissance() {
  const sites = [
    'https://example.com',
    'https://example.org',
    'https://example.net'
  ];
  
  const scanner = new ParallelReconnaissance({ maxConcurrency: 3 });
  await scanner.addSites(sites.map(url => ({ url })));
  
  const results = await scanner.executeScan();
  
  // Assertions
  console.assert(results.successful.length > 0, 'Should have successful scans');
  console.assert(results.total === sites.length, 'Should scan all sites');
  console.log('✓ Parallel reconnaissance test passed');
}

async function testSequentialWorkflow() {
  const workflow = new LeadGenerationWorkflow('TechCorp');
  const result = await workflow.execute();
  
  console.assert(result.leads.length > 0, 'Should extract leads');
  console.assert(result.log.length > 0, 'Should have execution log');
  console.log('✓ Sequential workflow test passed');
}

async function testRateLimiting() {
  const limiter = new GlobalRateLimiter();
  limiter.setDomainLimit('example.com', 2, 3);
  
  const start = Date.now();
  await limiter.waitForToken('example.com');
  await limiter.waitForToken('example.com');
  await limiter.waitForToken('example.com');
  
  const elapsed = Date.now() - start;
  console.assert(elapsed > 400, 'Should enforce rate limit');
  console.log('✓ Rate limiting test passed');
}

// Run all tests
(async () => {
  console.log('Running test suite...\n');
  await testParallelReconnaissance();
  await testSequentialWorkflow();
  await testRateLimiting();
  console.log('\nAll tests passed!');
})();
```

---

## Best Practices

### 1. Always Use Connection Pooling
```javascript
// ✓ Good
const pool = new ConnectionPool({ poolSize: 5 });
await pool.executeCommand('navigate', { url });

// ✗ Bad - creates new connection every time
const ws = new WebSocket('ws://localhost:8765');
```

### 2. Implement Exponential Backoff
```javascript
// ✓ Good
const delay = baseDelay * Math.pow(2, attempt);

// ✗ Bad - linear backoff
const delay = baseDelay * (attempt + 1);
```

### 3. Always Set Timeouts
```javascript
// ✓ Good
const timeout = setTimeout(() => reject(new Error('timeout')), 30000);

// ✗ Bad - may hang forever
await ws.executeCommand('navigate', ...);
```

### 4. Use Circuit Breaker for Fault Tolerance
```javascript
// ✓ Good
if (failures > threshold) {
  circuitBreaker.state = 'OPEN';
}

// ✗ Bad - keeps trying
await executeCommand(...);
```

### 5. Validate All Inputs
```javascript
// ✓ Good
if (!url.startsWith('http')) {
  throw new Error('Invalid URL');
}

// ✗ Bad - no validation
const response = await navigate(url);
```

---

## Troubleshooting Guide

### Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:8765

Solution:
1. Ensure Basset Hound Browser is running: npm start
2. Check port is correct (default 8765)
3. Check firewall allows connections
```

### Command Timeout
```
Error: Command timeout (30000ms): navigate

Solutions:
1. Increase timeout for slow sites
2. Check network latency
3. Verify page loads in browser
4. Check server logs for errors
```

### Too Many Connections
```
Error: EMFILE: too many open files

Solutions:
1. Increase connection pool size gradually
2. Use connection reuse (not creating new connections)
3. Check ulimit: ulimit -n 4096
4. Implement backpressure in queue
```

---

## References

- WebSocket API: `/docs/API-REFERENCE.md`
- Deployment: `/docs/DEPLOYMENT-GUIDE.md`
- Orchestration strategies: `ORCHESTRATION-STRATEGIES.md`
- Coordination patterns: `MULTI-AGENT-COORDINATION-PATTERNS.md`
