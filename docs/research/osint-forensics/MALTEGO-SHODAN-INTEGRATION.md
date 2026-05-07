# Maltego & Shodan Integration with Basset Hound

## Executive Summary

Maltego and Shodan represent the two pillars of OSINT infrastructure reconnaissance—entity relationship mapping and internet-scale device discovery. This document provides detailed integration patterns for combining these platforms with Basset Hound to create automated, forensically-sound OSINT workflows.

**Key Insight:** Maltego visualizes relationships; Shodan finds exposed devices. Basset Hound captures evidence and preserves chain of custody. Together, they enable scalable infrastructure reconnaissance with evidentiary documentation.

---

## Part 1: Maltego—Entity Relationship Mapping Architecture

### 1.1 Platform Overview

Maltego is a visual OSINT platform that transforms raw intelligence data into relationship graphs. It maps connections between:
- **Domains & Subdomains** - Infrastructure hierarchies
- **IP Addresses** - Hosting infrastructure
- **Organizations** - Corporate structures, shareholders
- **Email Addresses** - Communication patterns
- **Persons** - Social connections, employment history
- **Phone Numbers** - Contact networks
- **Social Media Accounts** - Digital footprints

### 1.2 Core Architecture for Integration

**Transform-Based Data Flow:**
1. **Source Data** → Seed entities (domains, organizations, persons)
2. **Transforms** → Automated queries to data sources
3. **Result Entities** → Enriched data points with relationships
4. **Graph Visualization** → Relationship mapping and analysis

**100+ Pre-Built Connectors:**
- Domain enumeration (WHOIS, DNS records, reverse DNS)
- Certificate authorities (CT logs, SSL certificate databases)
- Social media platforms (LinkedIn, Twitter, Facebook APIs)
- Public records (corporate registries, business records)
- Network intelligence (Shodan, Censys, IPQualityScore)
- Email discovery (Hunter.io, RocketReach, Email Permutator)

### 1.3 Custom Integration Points

**Connector Builder for Basset Hound Integration:**

```python
# Example: Maltego Connector for Basset Hound Evidence
class BassetHoundMaltegoConnector:
    """
    Transforms screenshots and extracted data from Basset Hound
    into Maltego entities with chain of custody metadata.
    """
    
    def __init__(self, basset_host='localhost', basset_port=8765):
        self.basset_ws = f"ws://{basset_host}:{basset_port}"
        self.evidence_store = {}
    
    def screenshot_to_entity(self, url, screenshot_path, metadata):
        """
        Convert Basset Hound screenshot to Maltego entity
        with forensic metadata.
        """
        entity = {
            'type': 'website.URL',
            'value': url,
            'properties': {
                'screenshot_path': screenshot_path,
                'capture_timestamp': metadata['timestamp'],
                'hash_sha256': metadata['hash'],
                'chain_of_custody_id': metadata['custody_id'],
                'bot_evasion_profile': metadata['evasion_profile'],
                'proxy_used': metadata['proxy']
            }
        }
        return entity
    
    def extracted_content_to_entities(self, url, content_data, custody_id):
        """
        Extract HTML entities from Basset Hound content
        with evidence preservation.
        """
        entities = []
        
        # Domain extraction with hosting provider
        domains = content_data.get('domains', [])
        for domain in domains:
            entity = {
                'type': 'domains.Domain',
                'value': domain,
                'properties': {
                    'source_url': url,
                    'extraction_method': 'DOM_parsing',
                    'custody_id': custody_id,
                    'extracted_timestamp': metadata['timestamp']
                }
            }
            entities.append(entity)
        
        # Email discovery
        emails = content_data.get('emails', [])
        for email in emails:
            entity = {
                'type': 'email.Email',
                'value': email,
                'properties': {
                    'discovered_on': url,
                    'context': content_data.get('email_context', {}).get(email),
                    'custody_id': custody_id
                }
            }
            entities.append(entity)
        
        return entities
    
    def create_relationship_transform(self):
        """
        Define custom transform for Basset-captured relationships.
        """
        return {
            'id': 'basset.CaptureToHosting',
            'name': 'Basset: Lookup Hosting Provider',
            'description': 'Resolve captured URL to hosting IP using Basset + Shodan',
            'input': 'website.URL',
            'output': ['ipv4-address', 'net.Organization'],
            'requires_auth': ['shodan_api_key'],
            'chain_of_custody': True
        }
```

---

## Part 2: Shodan—Internet-Scale Device Discovery

### 2.1 Shodan Search Engine Architecture

**Core Capabilities:**
- **Device Fingerprinting** - Banner analysis, service identification
- **Geographic Targeting** - Country, city, ASN filtering
- **Vulnerability Discovery** - Known CVE tracking
- **Internet Census** - 8+ billion indexed services
- **Time-Series Analysis** - Historical device tracking

### 2.2 Shodan Dork Syntax for Infrastructure Reconnaissance

**Common Dork Categories:**

**A. Web Server Discovery**
```
product:nginx version:1.18+ country:US
product:Apache ssl certificate:* port:443
product:IIS version:10.0 org:"Company Name"
```

**B. Database Exposure**
```
product:MongoDB port:27017 -authentication
product:PostgreSQL port:5432 country:US
product:MySQL port:3306 password: -protected
```

**C. Network Device Scanning**
```
product:Cisco ASA port:443
product:FortiGate SSL VPN
product:Citrix NetScaler gateway
```

**D. Vulnerability Targeting**
```
vuln:CVE-2021-44228 product:log4j
port:7001 product:Oracle WebLogic
port:9200 product:Elasticsearch -protected
```

**E. Industrial Control Systems (ICS)**
```
product:"Siemens S7" country:US
product:"Allen Bradley PLC" port:2222
product:Modbus port:502
```

### 2.3 Shodan API Integration with Basset Hound

**API Workflow Architecture:**

```python
import shodan
import asyncio
from basset_hound_client import BassetHoundClient

class ShodanBassetIntegration:
    """
    Automated infrastructure reconnaissance using Shodan + Basset Hound.
    Preserves chain of custody for all discovered assets.
    """
    
    def __init__(self, shodan_api_key, basset_config):
        self.shodan = shodan.Shodan(shodan_api_key)
        self.basset = BassetHoundClient(**basset_config)
        self.evidence_log = []
    
    async def discover_target_infrastructure(self, organization_name, dork):
        """
        Phase 1: Discover exposed infrastructure using Shodan dorks.
        """
        print(f"[*] Searching Shodan for organization: {organization_name}")
        
        try:
            results = self.shodan.search(dork)
            discovered_hosts = []
            
            for match in results['matches']:
                host_info = {
                    'ip': match['ip_str'],
                    'port': match['port'],
                    'service': match.get('product', 'Unknown'),
                    'version': match.get('version', 'Unknown'),
                    'banner': match.get('data', ''),
                    'timestamp': match.get('timestamp'),
                    'organization': organization_name,
                    'source': 'shodan_dork_search',
                    'query': dork
                }
                discovered_hosts.append(host_info)
                
                # Log evidence
                self.evidence_log.append({
                    'event_type': 'host_discovery',
                    'source': 'shodan',
                    'target': f"{match['ip_str']}:{match['port']}",
                    'timestamp': match.get('timestamp'),
                    'chain_of_custody': self._generate_custody_id()
                })
            
            return discovered_hosts
        
        except shodan.APIError as e:
            print(f"[!] Shodan API Error: {e}")
            return []
    
    async def verify_with_basset_hound(self, hosts, verify_http=False):
        """
        Phase 2: Verify discovered hosts using Basset Hound screenshots.
        This creates forensic evidence of the actual exposed interface.
        """
        print(f"[*] Verifying {len(hosts)} discovered hosts with Basset Hound")
        
        verified_hosts = []
        
        for host in hosts:
            # Construct URL for verification
            scheme = 'https' if host['port'] == 443 else 'http'
            url = f"{scheme}://{host['ip']}:{host['port']}"
            
            try:
                # Capture screenshot of exposed service
                screenshot = await self.basset.take_screenshot(
                    url=url,
                    full_page=False,
                    timeout=10000,
                    bot_evasion_profile='forensic_neutral',  # Neutral fingerprint
                    preserve_metadata=True
                )
                
                # Extract content
                content = await self.basset.extract_content(url, timeout=10000)
                
                # Build forensic evidence record
                verification_record = {
                    'host': host,
                    'screenshot': {
                        'path': screenshot['path'],
                        'hash_sha256': screenshot['hash'],
                        'timestamp': screenshot['timestamp'],
                        'dimensions': screenshot['dimensions']
                    },
                    'content': {
                        'title': content['title'],
                        'server_header': content.get('headers', {}).get('server'),
                        'content_type': content.get('headers', {}).get('content-type'),
                        'body_preview': content['body'][:1000]
                    },
                    'verified': True,
                    'verification_timestamp': self._get_iso_timestamp()
                }
                
                verified_hosts.append(verification_record)
                
                # Log evidence
                self.evidence_log.append({
                    'event_type': 'host_verification',
                    'source': 'basset_hound',
                    'target': url,
                    'screenshot_hash': screenshot['hash'],
                    'verification_success': True,
                    'chain_of_custody': self._generate_custody_id()
                })
                
            except Exception as e:
                print(f"[!] Verification failed for {url}: {e}")
                
                # Log failed verification attempt
                self.evidence_log.append({
                    'event_type': 'host_verification_failed',
                    'source': 'basset_hound',
                    'target': url,
                    'error': str(e),
                    'chain_of_custody': self._generate_custody_id()
                })
        
        return verified_hosts
    
    async def correlate_with_maltego(self, verified_hosts, maltego_transform_api):
        """
        Phase 3: Push verified hosts to Maltego for relationship mapping.
        """
        print(f"[*] Correlating {len(verified_hosts)} hosts with Maltego")
        
        maltego_entities = []
        
        for record in verified_hosts:
            host = record['host']
            
            # Create IP entity
            ip_entity = {
                'type': 'ipv4-address',
                'value': host['ip'],
                'properties': {
                    'port': host['port'],
                    'service': host['service'],
                    'version': host['version'],
                    'discovered_by': 'shodan_dork_search',
                    'verified_by_basset': True,
                    'screenshot_hash': record['screenshot']['hash_sha256'],
                    'server_header': record['content']['server_header']
                }
            }
            maltego_entities.append(ip_entity)
            
            # Create website entity
            if record['content']['title']:
                website_entity = {
                    'type': 'website.URL',
                    'value': f"http://{host['ip']}:{host['port']}",
                    'properties': {
                        'title': record['content']['title'],
                        'server': record['content']['server_header'],
                        'basset_screenshot': record['screenshot']['path']
                    }
                }
                maltego_entities.append(website_entity)
        
        # Push to Maltego API
        await maltego_transform_api.create_entities(maltego_entities)
        
        return maltego_entities
    
    def export_evidence_report(self, output_format='json'):
        """
        Export structured evidence report with full chain of custody.
        """
        report = {
            'investigation_metadata': {
                'start_time': self.evidence_log[0]['timestamp'] if self.evidence_log else None,
                'end_time': self._get_iso_timestamp(),
                'event_count': len(self.evidence_log),
                'source_platforms': ['shodan', 'basset_hound', 'maltego']
            },
            'evidence_chain': self.evidence_log,
            'summary': {
                'hosts_discovered': sum(1 for e in self.evidence_log if e['event_type'] == 'host_discovery'),
                'hosts_verified': sum(1 for e in self.evidence_log if e['event_type'] == 'host_verification' and e['verification_success']),
                'verification_failures': sum(1 for e in self.evidence_log if e['event_type'] == 'host_verification_failed')
            }
        }
        
        return report
    
    def _generate_custody_id(self):
        """Generate unique chain of custody identifier."""
        import uuid
        return f"COC-{uuid.uuid4().hex[:12]}"
    
    def _get_iso_timestamp(self):
        """Get current timestamp in ISO format."""
        from datetime import datetime
        return datetime.utcnow().isoformat() + 'Z'
```

---

## Part 3: Integrated Reconnaissance Workflow

### 3.1 Complete Investigation Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  TARGET ORGANIZATION INFRASTRUCTURE RECONNAISSANCE          │
└─────────────────────────────────────────────────────────────┘
        │
        ├─────────────────────────────────────────────────┐
        │                                                 │
    ┌───▼────┐                                    ┌──────▼──────┐
    │ SHODAN │  ◄────────────────────────────────►│   MALTEGO   │
    └───┬────┘  Dork Search Results              └──────┬──────┘
        │       (IPs, Ports, Services)                  │
        │                                                │
        │  [Device Discovery]                    [Relationship Mapping]
        │  [Exposure Analysis]                   [Entity Enrichment]
        │                                                │
        └─────────────────────┬──────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  BASSET HOUND      │
                    │  ──────────────    │
                    │ Screenshot         │
                    │ Content Extraction │
                    │ Evidence Logging   │
                    │ CoC Metadata       │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ FORENSIC REPORT    │
                    │ ──────────────     │
                    │ Timeline           │
                    │ Evidence Chain     │
                    │ Hash Verification  │
                    │ Admissibility      │
                    └────────────────────┘
```

### 3.2 Real-World Reconnaissance Scenario

**Objective:** Investigate disclosed security vulnerabilities in target organization's infrastructure.

**Step 1: Initial Shodan Reconnaissance (5-10 minutes)**
```bash
# Query 1: Find web servers hosted by company
shodan search "org:\"ACME Corporation\" product:nginx"

# Query 2: Find databases with potentially exposed credentials
shodan search "org:\"ACME Corporation\" product:MongoDB port:27017"

# Query 3: Search for known vulnerable versions
shodan search "org:\"ACME Corporation\" vuln:CVE-2024-XXXXX"

# Query 4: Identify network infrastructure
shodan search "org:\"ACME Corporation\" product:Cisco product:Fortinet"
```

**Step 2: Certificate Transparency Analysis (10-15 minutes)**
```
Maltego Transform: "Passive DNS" on discovered domains
Output: Subdomains, IP addresses, hosting providers
Temporal Analysis: Identify new infrastructure deployments
```

**Step 3: Basset Hound Verification (20-30 minutes)**
```python
# Capture live evidence of exposed services
for ip, port in discovered_hosts:
    basset.take_screenshot(f"https://{ip}:{port}")
    basset.extract_content(f"https://{ip}:{port}")
    basset.analyze_security_headers(f"https://{ip}:{port}")
```

**Step 4: Forensic Evidence Compilation (10 minutes)**
```
Evidence Record:
├─ Screenshots (with hash verification)
├─ HTML content (with extraction timestamp)
├─ Server banners (for CVE correlation)
├─ SSL certificates (for actor attribution)
├─ Response headers (for software identification)
└─ Chain of custody log
```

---

## Part 4: Integration Best Practices

### 4.1 Evidence Preservation During Investigation

**Critical Requirements:**
1. **Non-Destructive Access** - Use bot evasion profiles to avoid triggering security alerts
2. **Cryptographic Hashing** - Hash all captured content (SHA-256 minimum)
3. **Timestamping** - Record UTC timestamps for all actions
4. **Metadata Preservation** - Store execution environment details
5. **Audit Logging** - Maintain complete audit trail of access

**Implementation Pattern:**
```python
class ForensicInvestigationRecord:
    """
    Maintains forensically sound investigation records
    meeting legal admissibility standards.
    """
    
    def __init__(self, case_number):
        self.case_number = case_number
        self.records = []
        self.start_timestamp = self._get_utc_timestamp()
    
    def add_evidence(self, evidence_type, data, metadata):
        """
        Add evidence record with complete chain of custody.
        """
        record = {
            'record_id': self._generate_record_id(),
            'case_number': self.case_number,
            'timestamp': self._get_utc_timestamp(),
            'evidence_type': evidence_type,  # screenshot, content, banner, etc.
            'data': data,
            'metadata': {
                'investigator': metadata.get('investigator'),
                'tool_version': metadata.get('tool_version'),
                'source_ip': metadata.get('source_ip'),
                'target_url': metadata.get('target_url'),
                'http_status': metadata.get('http_status'),
                'content_hash_sha256': self._compute_hash(data),
                'chain_of_custody_id': self._generate_custody_id(),
                'acquisition_method': metadata.get('acquisition_method'),
                'evasion_profile_used': metadata.get('evasion_profile'),
                'note': metadata.get('note', '')
            }
        }
        
        self.records.append(record)
        return record['record_id']
    
    def verify_integrity(self, record_id):
        """
        Verify that evidence has not been modified.
        """
        record = next((r for r in self.records if r['record_id'] == record_id), None)
        if not record:
            return False, "Record not found"
        
        current_hash = self._compute_hash(record['data'])
        stored_hash = record['metadata']['content_hash_sha256']
        
        if current_hash == stored_hash:
            return True, "Integrity verified"
        else:
            return False, f"Hash mismatch: {stored_hash} != {current_hash}"
    
    def generate_custody_document(self):
        """
        Generate formal chain of custody document.
        """
        custody_doc = {
            'document_type': 'Digital Forensics Chain of Custody',
            'case_number': self.case_number,
            'investigation_period': {
                'start': self.start_timestamp,
                'end': self._get_utc_timestamp()
            },
            'evidence_summary': {
                'total_records': len(self.records),
                'by_type': self._count_by_type(),
                'by_source': self._count_by_source()
            },
            'custody_log': [
                {
                    'record_id': r['record_id'],
                    'timestamp': r['timestamp'],
                    'evidence_type': r['evidence_type'],
                    'target': r['metadata']['target_url'],
                    'hash': r['metadata']['content_hash_sha256'],
                    'investigator': r['metadata']['investigator'],
                    'custody_id': r['metadata']['chain_of_custody_id']
                }
                for r in self.records
            ],
            'verification': self._verify_all_records(),
            'certifications': {
                'no_modifications': all(
                    self.verify_integrity(r['record_id'])[0] 
                    for r in self.records
                ),
                'complete_logging': len(self.records) > 0,
                'timestamp_integrity': self._verify_timestamps()
            }
        }
        
        return custody_doc
    
    def _compute_hash(self, data):
        """Compute SHA-256 hash of data."""
        import hashlib
        if isinstance(data, str):
            data = data.encode('utf-8')
        return hashlib.sha256(data).hexdigest()
    
    def _generate_custody_id(self):
        """Generate unique custody identifier."""
        import uuid
        return f"CUSTODY-{self.case_number}-{uuid.uuid4().hex[:8]}"
    
    def _get_utc_timestamp(self):
        """Get current UTC timestamp."""
        from datetime import datetime
        return datetime.utcnow().isoformat() + 'Z'
```

### 4.2 API Rate Limiting and Throttling

**Shodan API Quotas:**
- Free tier: 1 query/month
- Paid tier: 10,000 queries/month
- Rate limit: 1 request/second

**Integration Strategy:**
```python
class RateLimitedShodanClient:
    """Respectfully throttle Shodan queries."""
    
    def __init__(self, api_key, queries_per_minute=30):
        self.shodan = shodan.Shodan(api_key)
        self.qpm = queries_per_minute
        self.query_queue = asyncio.Queue()
        self.last_query_time = 0
    
    async def search(self, query):
        """Execute query with rate limiting."""
        import time
        
        # Calculate minimum delay between queries
        min_delay = 60.0 / self.qpm
        
        # Wait if necessary to maintain rate limit
        time_since_last = time.time() - self.last_query_time
        if time_since_last < min_delay:
            await asyncio.sleep(min_delay - time_since_last)
        
        # Execute query
        result = self.shodan.search(query)
        self.last_query_time = time.time()
        
        return result
```

---

## Part 5: Legal and Ethical Considerations

### 5.1 Responsible Disclosure

**Key Principles:**
1. **Authorized Access Only** - Obtain written permission before investigating
2. **Vulnerability Reporting** - Report findings through proper disclosure channels
3. **Timeline Adherence** - Follow responsible disclosure timelines (typically 90 days)
4. **Privacy Preservation** - Minimize collection of PII data

### 5.2 Evidence Admissibility

**Requirements for Court Acceptance:**
1. **Authentication** - Demonstrate that evidence is what it claims to be
2. **Chain of Custody** - Document complete handling history
3. **Relevance** - Show connection to facts in issue
4. **Reliability** - Establish that collection method is technically sound
5. **Lack of Unfair Prejudice** - Ensure prejudicial effect doesn't outweigh probative value

---

## Part 6: Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up Shodan API access and account
- [ ] Deploy Maltego platform
- [ ] Integrate Basset Hound WebSocket API
- [ ] Create initial Python client for coordination

### Phase 2: Integration (Weeks 3-4)
- [ ] Build Shodan dork library for target organization
- [ ] Develop Maltego transform for Basset data
- [ ] Implement evidence logging system
- [ ] Create chain of custody tracking

### Phase 3: Validation (Weeks 5-6)
- [ ] Test full reconnaissance pipeline on test infrastructure
- [ ] Verify evidence preservation mechanisms
- [ ] Document audit trails and logs
- [ ] Legal review of collection methods

### Phase 4: Deployment (Weeks 7-8)
- [ ] Production deployment of integrated system
- [ ] Team training on OSINT workflows
- [ ] Establish ongoing monitoring procedures
- [ ] Create incident response playbooks

---

## References and Sources

- [Building Integrations for Maltego](https://docs.maltego.com/en/support/solutions/articles/15000053545-building-integrations-for-maltego)
- [Shodan API Documentation](https://shodan.io/)
- [OSINT with Maltego — A Complete Guide for Ethical Hackers](https://redfoxsecurity.medium.com/osint-with-maltego-a-complete-guide-for-ethical-hackers-73756ad9ada0)
- [Leveraging Shodan for Security Research](https://www.query.ai/resources/blogs/leveraging-shodan-for-security-research/)
- [Shodan Search Queries Cheat Sheet](https://vespersec.net/docs/osint-reconnaissance/shodan-search-queries-cheat-sheet/)
- [ShodanX: The Essential Terminal Tool for Cyber Reconnaissance](https://www.blog.brightcoding.dev/2026/03/24/shodanx-the-essential-terminal-tool-for-cyber-recon)
- [OSINT Framework: What It Is, How It Works, and the Best Tools](https://www.bitsight.com/learn/cti/osint-framework)
- [Best OSINT Tools (2026): 24 Free & Paid for Investigations](https://shadowdragon.io/blog/best-osint-tools/)
