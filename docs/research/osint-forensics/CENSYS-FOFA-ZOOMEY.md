# Censys, FOFA, and ZoomEye Integration with Basset Hound

## Executive Summary

Censys, FOFA, and ZoomEye represent specialized OSINT platforms with complementary capabilities for certificate analysis, IoT device discovery, and cyberspace mapping. This document details integration patterns, technical workflows, and best practices for combining these platforms with Basset Hound to create comprehensive asset discovery systems with forensic documentation.

**Key Insight:** Each platform covers different internet-scale visibility domains—Censys excels at certificate transparency and historical data, FOFA specializes in Asian-region coverage with advanced fingerprinting, and ZoomEye provides continuous cyberspace mapping. Basset Hound adds captured evidence and visual documentation.

---

## Part 1: Censys—Certificate-Based Infrastructure Intelligence

### 1.1 Platform Architecture

Censys maintains comprehensive datasets of internet-connected devices and their configurations:
- **Certificates Dataset** - 8.2+ billion SSL/TLS certificates (includes CT logs)
- **Hosts Dataset** - 4+ billion IPv4 addresses with service fingerprints
- **Autonomous Systems** - BGP routing information and network ownership
- **Domain Names** - Historical DNS records and resolutions

### 1.2 Certificate Enumeration Methodology

**Key Insight:** Every publicly trusted SSL certificate is logged in Certificate Transparency (CT) logs. By querying these logs, you can reconstruct an organization's digital expansion timeline.

```python
from censys.search import CensysData, CensysCerts
import asyncio
from datetime import datetime, timedelta

class CensysIntelligenceGathering:
    """
    Extract organizational infrastructure from certificate records.
    Useful for discovering subdomains, internal naming conventions,
    and infrastructure changes over time.
    """
    
    def __init__(self, censys_api_id, censys_api_secret):
        self.certs = CensysCerts(censys_api_id, censys_api_secret)
        self.data = CensysData(censys_api_id, censys_api_secret)
        self.intelligence = []
    
    async def enumerate_subdomains_from_certificates(self, target_domain):
        """
        Query CT logs for all certificates issued to target domain
        and extract subdomains.
        
        Timeline: Most comprehensive approach for subdomain discovery.
        Coverage: Captures every publicly trusted certificate.
        """
        print(f"[*] Enumerating subdomains for {target_domain}")
        
        query = f'"{target_domain}"'
        page = 1
        all_certificates = []
        
        while True:
            try:
                response = self.certs.query(query, page=page)
                
                if 'results' not in response:
                    break
                
                for cert in response['results']:
                    cert_data = {
                        'fingerprint': cert.get('fingerprint'),
                        'subject_names': cert.get('names', []),
                        'not_before': cert.get('not_before'),
                        'not_after': cert.get('not_after'),
                        'issuer': cert.get('issuer'),
                        'serial_number': cert.get('serial_number'),
                        'public_key_algorithm': cert.get('public_key_algorithm'),
                        'signature_algorithm': cert.get('signature_algorithm')
                    }
                    all_certificates.append(cert_data)
                
                page += 1
                
            except Exception as e:
                print(f"[!] Error querying page {page}: {e}")
                break
        
        # Extract unique subdomains
        subdomains = set()
        infrastructure_timeline = []
        
        for cert in all_certificates:
            for name in cert.get('subject_names', []):
                # Extract subdomain
                if name.startswith('*.'):
                    subdomain = name[2:]
                else:
                    subdomain = name
                
                subdomains.add(subdomain)
                
                # Timeline entry
                infrastructure_timeline.append({
                    'subdomain': subdomain,
                    'certificate_issued': cert['not_before'],
                    'certificate_expires': cert['not_after'],
                    'issuer': cert['issuer'],
                    'fingerprint': cert['fingerprint']
                })
        
        return {
            'target_domain': target_domain,
            'subdomains_discovered': len(subdomains),
            'unique_subdomains': sorted(list(subdomains)),
            'certificate_count': len(all_certificates),
            'timeline': sorted(infrastructure_timeline, key=lambda x: x['certificate_issued'])
        }
    
    async def identify_hosting_changes(self, target_domain, days_back=365):
        """
        Identify changes to hosting infrastructure over time.
        Useful for detecting migrations, transitions, or compromises.
        """
        print(f"[*] Analyzing hosting changes for {target_domain}")
        
        # Get current hosting information
        current_hosts = await self._resolve_current_hosts(target_domain)
        
        # Analyze historical patterns
        cert_results = await self.enumerate_subdomains_from_certificates(target_domain)
        
        # Reconstruct hosting timeline
        hosting_timeline = []
        for entry in cert_results['timeline']:
            hosting_timeline.append({
                'date': entry['certificate_issued'],
                'event': 'Certificate issued',
                'for_subdomain': entry['subdomain'],
                'issuer': entry['issuer']
            })
        
        return {
            'current_hosting': current_hosts,
            'historical_timeline': hosting_timeline,
            'potential_changes': self._detect_anomalies(hosting_timeline)
        }
    
    async def correlate_with_basset_hound(self, subdomains, basset_client):
        """
        Verify discovered subdomains using Basset Hound.
        Captures evidence of active vs. inactive infrastructure.
        """
        print(f"[*] Verifying {len(subdomains)} subdomains with Basset Hound")
        
        verification_results = []
        
        for subdomain in subdomains:
            # Try HTTPS
            https_url = f"https://{subdomain}"
            http_url = f"http://{subdomain}"
            
            for url in [https_url, http_url]:
                try:
                    # Capture screenshot
                    screenshot = await basset_client.take_screenshot(
                        url=url,
                        timeout=8000,
                        preserve_metadata=True,
                        bot_evasion_profile='neutral'
                    )
                    
                    # Extract content
                    content = await basset_client.extract_content(url)
                    
                    # Security headers analysis
                    headers = content.get('headers', {})
                    security_headers = {
                        'strict_transport_security': headers.get('strict-transport-security'),
                        'x_frame_options': headers.get('x-frame-options'),
                        'x_content_type_options': headers.get('x-content-type-options'),
                        'csp': headers.get('content-security-policy')
                    }
                    
                    verification_results.append({
                        'subdomain': subdomain,
                        'url': url,
                        'status': 'active',
                        'http_status': screenshot.get('http_status'),
                        'title': content.get('title'),
                        'server_header': headers.get('server'),
                        'security_headers': security_headers,
                        'screenshot_path': screenshot['path'],
                        'screenshot_hash': screenshot['hash'],
                        'timestamp': screenshot['timestamp']
                    })
                    
                    break  # Found active subdomain
                    
                except Exception as e:
                    pass  # Try next protocol
            
            if not any(r['subdomain'] == subdomain for r in verification_results):
                verification_results.append({
                    'subdomain': subdomain,
                    'status': 'inactive',
                    'timestamp': datetime.utcnow().isoformat()
                })
        
        return verification_results
    
    async def _resolve_current_hosts(self, domain):
        """Resolve domain to current IP addresses."""
        import socket
        try:
            addresses = socket.getaddrinfo(domain, 443)
            return list(set([addr[4][0] for addr in addresses]))
        except:
            return []
    
    def _detect_anomalies(self, timeline):
        """Detect unusual patterns in hosting timeline."""
        anomalies = []
        
        # Check for frequent changes
        if len(timeline) > 10:
            anomalies.append({
                'type': 'high_change_frequency',
                'severity': 'medium',
                'description': f'{len(timeline)} certificate events in timeline'
            })
        
        return anomalies
```

### 1.3 Censys Hosts Dataset Integration

**Host Search Query Language (HQL):**

```
# Find all services on IPv4 addresses in company's ASN
autonomous_system.asn: 16509 AND services.port: 443

# Find Nginx servers with specific version
services.http.response.status_code: 200 AND 
services.http.response.headers.Server: "nginx/1.18*"

# Find databases exposed to internet
services.port: [27017, 5432, 3306, 9200] AND 
services.software.product: ["mongodb", "postgresql", "mysql", "elasticsearch"]

# Historical view: find hosts seen in past 90 days
last_seen_gte: now-90d
```

---

## Part 2: FOFA—Asian OSINT Specialized Platform

### 2.1 Platform Characteristics and Advantages

FOFA (Chinese: Cyberspace Mapping) is operated by Beijing Huashun Xin'an Technology Co., Ltd., with particular strengths in:
- **Asian Coverage** - Better indexed data for Chinese, Japanese, Korean networks
- **IoT Devices** - Specialized fingerprinting for IoT and embedded systems
- **Web Fingerprinting** - Advanced pattern matching for web technologies
- **Banner Analysis** - Detailed service banner matching

### 2.2 FOFA Query Language and Search Syntax

**Query Structure:**

```
field: "value"        # Exact match
field: "value*"       # Wildcard prefix match
field: value          # Numeric match
field: >= value       # Range operators
field: [value1, value2]  # Multiple values (OR)
field1: "value1" && field2: "value2"  # AND operator
field1: "value1" || field2: "value2"  # OR operator
```

**Common Search Filters:**

```fofa
# Basic HTTP/HTTPS server discovery
protocol: "http" && title: "Dashboard"

# IP-based searching
ip: "192.168.0.0/16"
ip: "1.2.3.4/24"

# Port searching
port: 8080
port: [80, 443, 8080, 8443]

# Domain and hostname searching
host: "target.com"
domain: "target.com"

# Banner/content analysis
banner: "Apache/2.4"
body: "powered by"
header: "Server: nginx"

# Icon fingerprinting (useful for service identification)
icon_hash: "-247388890"  # Specific icon hash

# HTML content patterns
html: "<title>Admin Panel</title>"

# Specific technology stacks
title: "WordPress" && body: "wp-content"
body: "Node.js"
header: "X-Powered-By: Express"

# Combined complex queries
(protocol: "http" || protocol: "https") && 
(body: "Admin" || title: "Dashboard") && 
country: "CN"
```

### 2.3 FOFA Integration with Basset Hound

```python
class FofaBassetIntegration:
    """
    Leverage FOFA's superior Asian coverage and IoT detection
    combined with Basset Hound's capture capabilities.
    """
    
    def __init__(self, fofa_email, fofa_api_key, basset_config):
        self.fofa_email = fofa_email
        self.fofa_api_key = fofa_api_key
        self.basset = BassetHoundClient(**basset_config)
        self.api_base = "https://fofa.info/api/v1"
    
    async def search_iot_devices(self, query, page=1, size=100):
        """
        Search FOFA for IoT devices matching criteria.
        FOFA's fingerprint database contains 40,000+ IoT fingerprints.
        """
        import httpx
        
        async with httpx.AsyncClient() as client:
            params = {
                'email': self.fofa_email,
                'key': self.fofa_api_key,
                'qbase64': self._base64_encode(query),  # Base64 encode query
                'page': page,
                'size': size,
                'fields': 'host,title,ip,port,protocol,country,asn'
            }
            
            response = await client.get(
                f"{self.api_base}/search",
                params=params
            )
            
            return response.json()
    
    async def identify_exposed_management_interfaces(self, organization_name):
        """
        Find exposed admin/management interfaces for target organization.
        
        Common management interfaces:
        - Web-based administration consoles
        - API gateways
        - Database administration panels
        - Network device consoles
        """
        
        # FOFA query for management interfaces
        queries = [
            f'host: "*.{organization_name.lower()}.com" && (title: "admin" || title: "dashboard" || title: "console")',
            f'(body: "admin login" || body: "management console") && asn: "{organization_name}"',
            f'port: [8080, 8443, 9000, 9200] && host: "*.{organization_name.lower()}.com"'
        ]
        
        results = []
        for query in queries:
            fofa_results = await self.search_iot_devices(query)
            
            for item in fofa_results.get('results', []):
                results.append({
                    'host': item[0],
                    'title': item[1],
                    'ip': item[2],
                    'port': item[3],
                    'protocol': item[4],
                    'country': item[5],
                    'asn': item[6],
                    'source': 'fofa'
                })
        
        return results
    
    async def detect_technology_stack(self, hosts):
        """
        Use FOFA fingerprinting to detect technology stack
        across discovered hosts.
        """
        technology_findings = []
        
        for host in hosts:
            url = f"{host['protocol']}://{host['host']}:{host['port']}"
            
            # Capture with Basset Hound
            try:
                content = await self.basset.extract_content(url, timeout=10000)
                headers = content.get('headers', {})
                html = content.get('body', '')
                
                # Detect technologies
                tech_indicators = {
                    'server_software': headers.get('server'),
                    'framework': self._detect_framework(headers, html),
                    'cms': self._detect_cms(html),
                    'analytics': self._detect_analytics(html),
                    'cdn': headers.get('via') or headers.get('cf-ray')
                }
                
                technology_findings.append({
                    'host': host['host'],
                    'technologies': tech_indicators,
                    'evidence_source': 'basset_hound_capture'
                })
                
            except Exception as e:
                print(f"[!] Failed to analyze {url}: {e}")
        
        return technology_findings
    
    async def icon_hash_based_detection(self, hosts):
        """
        Use favicon hashing for service identification.
        
        Icon hashes are stable identifiers for specific services
        and can identify services even when headers are spoofed.
        """
        icon_detections = []
        
        for host in hosts:
            url = f"{host['protocol']}://{host['host']}:{host['port']}"
            
            try:
                # Extract favicon
                favicon = await self.basset.extract_favicon(url)
                
                if favicon:
                    # Compute icon hash
                    icon_hash = await self._compute_icon_hash(favicon)
                    
                    # Query FOFA for services with this hash
                    fofa_results = await self.search_iot_devices(
                        f'icon_hash: "{icon_hash}"'
                    )
                    
                    icon_detections.append({
                        'host': host['host'],
                        'icon_hash': icon_hash,
                        'matching_services': len(fofa_results.get('results', [])),
                        'evidence': 'favicon_hash'
                    })
                    
            except Exception as e:
                pass
        
        return icon_detections
    
    def _base64_encode(self, query):
        """Encode query in base64 for FOFA API."""
        import base64
        return base64.b64encode(query.encode()).decode()
    
    def _detect_framework(self, headers, html):
        """Detect web framework from headers and HTML."""
        framework_indicators = {
            'X-Powered-By': headers.get('x-powered-by'),
            'Server': headers.get('server'),
            'X-AspNet-Version': headers.get('x-aspnet-version'),
        }
        return framework_indicators
    
    def _detect_cms(self, html):
        """Detect CMS platform from HTML content."""
        cms_patterns = {
            'wordpress': 'wp-content',
            'drupal': 'sites/default',
            'joomla': '/administrator/',
            'ghost': '__GHOST_CONFIG__'
        }
        
        detected = []
        for cms, pattern in cms_patterns.items():
            if pattern in html:
                detected.append(cms)
        return detected
    
    def _detect_analytics(self, html):
        """Detect analytics services."""
        analytics = {
            'google_analytics': 'UA-' in html or 'G-' in html,
            'mixpanel': 'mixpanel' in html,
            'segment': 'segment' in html
        }
        return analytics
```

---

## Part 3: ZoomEye—Continuous Cyberspace Mapping

### 3.1 Platform Architecture

ZoomEye maintains continuous scanning infrastructure with:
- **40,000+ Fingerprints** - Device and software identification
- **Global Coverage** - Full port scanning of public internet
- **Historical Data** - Asset change tracking over time
- **Component Detection** - Identification of specific software versions
- **Recent MCP Integration** - AI-native query interface

### 3.2 ZoomEye Query Language

**Query Filters:**

```
# Basic queries
app: "Joomla"           # Application identification
os: "Linux"             # Operating system
port: 22                # Service ports
service: "SSH"          # Service type

# Geographic filtering
country: "US"
city: "California"
asn: 16509

# Multiple conditions (AND)
app: "Apache" && version: "2.4" && country: "US"

# OR conditions
(service: "SSH" || service: "Telnet") && port: [22, 23]

# Negation
app: "Apache" && -port: 80

# Wildcard and pattern matching
title: "*admin*"
header: "*Apache*"

# Advanced filters
protocol: "http" && status_code: 200
banner: "*Windows*"

# Organization-based
organization: "Amazon"
asn: [16509, 16510, 16511]
```

### 3.3 ZoomEye Integration Implementation

```python
from zoomeye.sdk import ZoomEye as ZoomEyeAPI
import asyncio

class ZoomEyeBassetIntegration:
    """
    Leverage ZoomEye's continuous scanning and MCP integration
    with Basset Hound's verification and evidence capture.
    """
    
    def __init__(self, zoomeye_api_key, basset_config):
        self.zoomeye = ZoomEyeAPI()
        self.zoomeye.api_key = zoomeye_api_key
        self.basset = BassetHoundClient(**basset_config)
    
    async def continuous_asset_monitoring(self, organization_name, scan_interval=86400):
        """
        Monitor organizational assets continuously using ZoomEye scanning
        combined with Basset Hound verification.
        
        Useful for:
        - Detecting unauthorized services
        - Monitoring infrastructure changes
        - Identifying exposure windows
        """
        
        monitoring_log = []
        
        while True:
            scan_results = await self._perform_scan(organization_name)
            
            for asset in scan_results:
                # Get baseline (previous scan)
                baseline = await self._get_baseline(asset['ip'])
                
                # Detect changes
                changes = self._detect_changes(baseline, asset)
                
                if changes:
                    # Alert and verify with Basset
                    verification = await self._verify_change(asset, changes)
                    
                    monitoring_log.append({
                        'timestamp': datetime.utcnow().isoformat(),
                        'asset': asset,
                        'changes': changes,
                        'verification': verification,
                        'action': 'alert_issued'
                    })
            
            # Wait for next scan interval
            await asyncio.sleep(scan_interval)
    
    async def map_technology_footprint(self, organization_asn):
        """
        Create comprehensive technology footprint of organization
        using ZoomEye's application fingerprinting.
        """
        
        # Query ZoomEye for all services in org's ASN
        query = f'asn: {organization_asn}'
        results = self.zoomeye.search(query)
        
        technology_inventory = {
            'web_servers': {},
            'databases': {},
            'cms_platforms': {},
            'development_frameworks': {},
            'cloud_services': {},
            'network_devices': {}
        }
        
        for result in results:
            service = result.get('app', 'Unknown')
            version = result.get('version')
            port = result.get('port')
            
            # Categorize service
            category = self._categorize_service(service)
            
            if category not in technology_inventory:
                technology_inventory[category] = {}
            
            if service not in technology_inventory[category]:
                technology_inventory[category][service] = {
                    'version': version,
                    'count': 0,
                    'ports': [],
                    'examples': []
                }
            
            technology_inventory[category][service]['count'] += 1
            if port not in technology_inventory[category][service]['ports']:
                technology_inventory[category][service]['ports'].append(port)
            
            if len(technology_inventory[category][service]['examples']) < 3:
                technology_inventory[category][service]['examples'].append({
                    'ip': result['ip'],
                    'port': port
                })
        
        return technology_inventory
    
    async def detect_unauthorized_services(self, organization_asn, baseline_services):
        """
        Compare current ZoomEye scan against baseline of approved services.
        Identify unauthorized services that may indicate compromise or misuse.
        """
        
        query = f'asn: {organization_asn}'
        current_services = self.zoomeye.search(query)
        
        unauthorized = []
        
        for service in current_services:
            service_key = (service['app'], service['version'], service['port'])
            
            if service_key not in baseline_services:
                # Verify with Basset before flagging
                try:
                    verification = await self.basset.take_screenshot(
                        url=f"http://{service['ip']}:{service['port']}",
                        timeout=5000
                    )
                    
                    unauthorized.append({
                        'ip': service['ip'],
                        'service': service['app'],
                        'version': service['version'],
                        'port': service['port'],
                        'first_seen': service.get('timestamp'),
                        'verification_screenshot': verification['path'],
                        'risk_level': self._assess_risk(service['app'])
                    })
                    
                except Exception as e:
                    pass  # Service offline or unreachable
        
        return unauthorized
    
    async def identify_vulnerable_components(self, organization_asn, vulnerability_feed):
        """
        Cross-reference ZoomEye component inventory against
        known vulnerability database.
        """
        
        tech_footprint = await self.map_technology_footprint(organization_asn)
        vulnerable_assets = []
        
        for category, services in tech_footprint.items():
            for service_name, service_info in services.items():
                # Check if service/version is vulnerable
                for vuln in vulnerability_feed:
                    if (vuln['product'] == service_name and 
                        vuln['affected_versions'] and 
                        service_info['version'] in vuln['affected_versions']):
                        
                        vulnerable_assets.append({
                            'service': service_name,
                            'version': service_info['version'],
                            'instances': service_info['count'],
                            'ports': service_info['ports'],
                            'vulnerability': vuln['cve_id'],
                            'severity': vuln['severity'],
                            'remediation': vuln['remediation']
                        })
        
        return vulnerable_assets
    
    async def _perform_scan(self, organization_identifier):
        """Execute ZoomEye scan for organization."""
        query = f'organization: "{organization_identifier}"'
        return self.zoomeye.search(query)
    
    async def _get_baseline(self, ip):
        """Get previous scan baseline for IP."""
        # Implementation depends on persistent storage
        pass
    
    def _detect_changes(self, baseline, current):
        """Detect differences between scans."""
        changes = []
        
        if baseline is None:
            return ['new_asset']
        
        if baseline.get('app') != current.get('app'):
            changes.append('service_change')
        
        if baseline.get('version') != current.get('version'):
            changes.append('version_update')
        
        return changes
    
    async def _verify_change(self, asset, changes):
        """Verify changes using Basset Hound."""
        url = f"http://{asset['ip']}:{asset['port']}"
        
        try:
            screenshot = await self.basset.take_screenshot(url, timeout=5000)
            return {'verified': True, 'screenshot': screenshot['path']}
        except:
            return {'verified': False, 'error': 'unreachable'}
    
    def _categorize_service(self, service_name):
        """Categorize service into inventory bucket."""
        categories = {
            'web_servers': ['Apache', 'Nginx', 'IIS', 'Tomcat'],
            'databases': ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis'],
            'cms_platforms': ['WordPress', 'Drupal', 'Joomla'],
            'development_frameworks': ['Node.js', 'Django', 'Flask', 'Spring'],
            'cloud_services': ['AWS', 'Azure', 'GCP'],
            'network_devices': ['Cisco', 'Fortinet', 'Juniper']
        }
        
        for category, services in categories.items():
            if any(s in service_name for s in services):
                return category
        
        return 'other'
    
    def _assess_risk(self, service_name):
        """Assess risk level of unauthorized service."""
        high_risk = ['SSH', 'RDP', 'Telnet', 'FTP', 'MySQL', 'PostgreSQL']
        medium_risk = ['HTTP', 'HTTPS', 'VPN']
        
        if any(s in service_name for s in high_risk):
            return 'HIGH'
        elif any(s in service_name for s in medium_risk):
            return 'MEDIUM'
        return 'LOW'
```

---

## Part 4: Comparative Analysis and Use Cases

### 4.1 Platform Comparison Matrix

| Feature | Censys | FOFA | ZoomEye |
|---------|--------|------|---------|
| **Primary Strength** | Certificates & Historical Data | Asian Coverage & IoT | Continuous Scanning |
| **Certificate Data** | Comprehensive | Limited | Limited |
| **Asia-Pacific Coverage** | Good | Excellent | Good |
| **Fingerprint Database** | ~5,000 | ~40,000 | ~40,000 |
| **API Rate Limit** | 25 req/minute (free) | 10 req/minute (free) | 50 req/minute (free) |
| **Historical Data** | 90+ days | 30 days | 7 days |
| **Cost** | Freemium | Freemium | Freemium |
| **Best For** | Infrastructure archaeology | IoT/webshell detection | Real-time monitoring |

### 4.2 Investigation Scenarios

**Scenario 1: Infrastructure Archaeology (Use Censys)**
```
Goal: Understand how target organization's infrastructure
evolved over the past 2 years

Approach:
1. Extract all subdomains from CT logs
2. Create timeline of certificate issuance
3. Identify infrastructure transitions
4. Verify with Basset Hound current state
```

**Scenario 2: IoT Device Discovery (Use FOFA)**
```
Goal: Identify all exposed IoT and management devices
in target's internet-facing infrastructure

Approach:
1. Use FOFA's IoT fingerprinting
2. Search for common management interfaces
3. Filter by organization ASN
4. Verify with Basset Hound screenshots
5. Document hardware/firmware versions
```

**Scenario 3: Real-Time Threat Monitoring (Use ZoomEye)**
```
Goal: Continuously monitor for unauthorized services
or infrastructure changes

Approach:
1. Baseline organization's service inventory
2. Schedule daily ZoomEye scans
3. Alert on service additions/changes
4. Verify changes with Basset Hound
5. Generate incident reports
```

---

## Part 5: Evidence Integration and Preservation

### 5.1 Multi-Source Evidence Correlation

```python
class MultiSourceEvidenceCorrelation:
    """
    Correlate findings from Censys, FOFA, and ZoomEye
    with Basset Hound captured evidence to build
    comprehensive forensic record.
    """
    
    def __init__(self):
        self.evidence_store = {}
        self.correlations = []
    
    def correlate_findings(self, censys_result, fofa_result, zoomeye_result, basset_screenshot):
        """
        Create correlated evidence record from all sources.
        """
        
        correlation_record = {
            'correlation_id': self._generate_id(),
            'timestamp': datetime.utcnow().isoformat(),
            'sources': {
                'censys': {
                    'data': censys_result,
                    'confidence': 0.95,  # CT logs are authoritative
                    'evidence_type': 'certificate_transparency'
                },
                'fofa': {
                    'data': fofa_result,
                    'confidence': 0.85,  # Active scanning
                    'evidence_type': 'service_fingerprint'
                },
                'zoomeye': {
                    'data': zoomeye_result,
                    'confidence': 0.85,  # Active scanning
                    'evidence_type': 'service_fingerprint'
                },
                'basset_hound': {
                    'screenshot': basset_screenshot,
                    'confidence': 0.95,  # Actual captured state
                    'evidence_type': 'visual_capture'
                }
            },
            'consensus': self._calculate_consensus([
                censys_result, fofa_result, zoomeye_result
            ]),
            'chain_of_custody': {
                'created_by': 'multi_source_correlation',
                'timestamp': datetime.utcnow().isoformat(),
                'hash': self._hash_correlation(
                    censys_result, fofa_result, zoomeye_result, basset_screenshot
                )
            }
        }
        
        return correlation_record
    
    def _calculate_consensus(self, results):
        """Determine consensus across multiple sources."""
        # Implementation calculates agreement level
        pass
    
    def _hash_correlation(self, *args):
        """Create hash of entire correlation for integrity."""
        import hashlib
        combined = str(args)
        return hashlib.sha256(combined.encode()).hexdigest()
    
    def _generate_id(self):
        """Generate unique correlation ID."""
        import uuid
        return f"CORR-{uuid.uuid4().hex[:12]}"
```

---

## Part 6: Implementation Timeline

### Phase 1: Foundation (Weeks 1-2)
- [ ] Obtain API credentials for Censys, FOFA, ZoomEye
- [ ] Review platform documentation and query languages
- [ ] Set up Python client libraries
- [ ] Create test environment

### Phase 2: Individual Platform Integration (Weeks 3-5)
- [ ] Implement Censys certificate enumeration
- [ ] Implement FOFA IoT discovery
- [ ] Implement ZoomEye continuous scanning
- [ ] Build Basset Hound verification layer

### Phase 3: Cross-Platform Correlation (Weeks 6-7)
- [ ] Implement multi-source correlation logic
- [ ] Build evidence aggregation system
- [ ] Create timeline generation
- [ ] Develop reporting functions

### Phase 4: Production Deployment (Weeks 8-10)
- [ ] Deploy integrated system to production
- [ ] Implement monitoring and alerting
- [ ] Train analysts on workflows
- [ ] Establish operational procedures

---

## References and Sources

- [Censys Documentation](https://docs.censys.com/)
- [Legacy Search API - Censys Documentation](https://docs.censys.com/docs/ls-api)
- [Censys Python SDK](https://github.com/0xbharath/censys-enumeration)
- [Certificate Transparency Logs for Advanced OSINT](https://secybers.com/blog-details/mastering-certificate-transparency-logs-for-advanced-osint-a-2026-reconnaissance-guide)
- [FOFA | OSINT Tools Library](https://tools.osintnewsletter.com/osint-tools/fofa)
- [FOFA Syntax Guide for OSINT Queries](https://github.com/H4ckD4d/FOFA-Syntax-Guide-for-OSINT-Queries)
- [OT Hunt: Finding ICS/OT with FOFA](https://alhasawi.medium.com/ot-hunt-finding-ics-ot-with-fofa-030851c75624)
- [ZoomEye: Search Cyberspace Assets](https://www.x-cmd.com/pkg/zoomeye/)
- [Advanced ZoomEye Dorking Techniques](https://undercodetesting.com/advanced-zoomeye-dorking-techniques-for-enhanced-reconnaissance/)
- [ZoomEye MCP Server](https://github.com/zoomeye-ai/mcp_zoomeye)
- [Company Infrastructure Reconnaissance - OSINT Techniques 2026](https://liferaftlabs.com/blog/osint-tools-for-security-analysts-in-2026/)
