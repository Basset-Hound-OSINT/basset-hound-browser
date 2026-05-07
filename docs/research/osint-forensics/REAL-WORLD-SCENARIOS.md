# Real-World OSINT Scenarios and Integration with Basset Hound

## Executive Summary

This document details practical, real-world OSINT investigation scenarios and demonstrates how Basset Hound integrates with Maltego, Shodan, Censys, FOFA, and ZoomEye to create forensically sound, comprehensive investigations. Each scenario includes step-by-step workflows, code examples, and integration patterns applicable to legitimate security research and authorized investigations.

**Key Principle:** Every scenario assumes proper authorization (warrant, written permission, or EULA compliance) and follows responsible disclosure practices.

---

## Scenario 1: Company Infrastructure Reconnaissance

### Objective
Discover and document the complete internet-facing infrastructure of a target organization during a security audit.

### Investigation Scope
- Identify all public-facing web properties
- Discover exposed management interfaces
- Detect non-standard services
- Document infrastructure timeline
- Verify active vs. inactive services

### Workflow

**Phase 1: Passive Intelligence Gathering (0-30 minutes)**

```python
class CompanyReconnaissancePhase1:
    """
    Passive intelligence gathering using certificate records,
    WHOIS data, and public network information.
    """
    
    def __init__(self, company_domain, company_name, company_asn):
        self.domain = company_domain
        self.name = company_name
        self.asn = company_asn
        self.intelligence = {}
    
    async def phase1_passive_intelligence(self):
        """Gather passive intelligence without direct contact."""
        
        print(f"[*] Phase 1: Passive Intelligence Gathering")
        print(f"    Target: {self.name} ({self.domain})")
        
        # Step 1: Certificate Transparency logs
        print("\n[*] Step 1: Certificate Transparency Analysis")
        ct_results = await self._analyze_ct_logs()
        self.intelligence['ct_subdomains'] = ct_results
        
        # Step 2: WHOIS records
        print("[*] Step 2: WHOIS Analysis")
        whois_data = await self._query_whois_records()
        self.intelligence['whois'] = whois_data
        
        # Step 3: Passive DNS
        print("[*] Step 3: Passive DNS Records")
        pdns_results = await self._query_passive_dns()
        self.intelligence['passive_dns'] = pdns_results
        
        # Step 4: Create initial target list
        self.intelligence['initial_targets'] = self._consolidate_targets()
        
        return self.intelligence
    
    async def _analyze_ct_logs(self):
        """Query Certificate Transparency logs via Censys."""
        
        ct_results = {
            'certificates_found': 0,
            'unique_domains': set(),
            'subdomains': set(),
            'dns_names': []
        }
        
        # In real implementation, would query Censys CT API
        print(f"  └─ Searching CT logs for *.{self.domain}")
        
        # Example results
        ct_results['dns_names'] = [
            f'www.{self.domain}',
            f'api.{self.domain}',
            f'admin.{self.domain}',
            f'mail.{self.domain}',
            f'vpn.{self.domain}',
            f'internal.{self.domain}'
        ]
        
        for dns_name in ct_results['dns_names']:
            ct_results['unique_domains'].add(dns_name)
            subdomain = dns_name.split('.')[0]
            ct_results['subdomains'].add(subdomain)
        
        ct_results['certificates_found'] = len(ct_results['dns_names'])
        
        print(f"  └─ Found {ct_results['certificates_found']} certificate records")
        
        return ct_results
    
    async def _query_whois_records(self):
        """Query WHOIS for domain ownership and technical contacts."""
        
        whois_data = {
            'registrant': {
                'name': f'{self.name} Inc.',
                'organization': self.name
            },
            'registrar': 'Example Registrar Inc.',
            'name_servers': [
                'ns1.example.com',
                'ns2.example.com'
            ],
            'registration_date': '2015-01-15',
            'expiration_date': '2026-01-15'
        }
        
        print(f"  └─ Registrant: {whois_data['registrant']['organization']}")
        print(f"  └─ Name servers: {', '.join(whois_data['name_servers'])}")
        
        return whois_data
    
    async def _query_passive_dns(self):
        """Query passive DNS databases (e.g., via VirusTotal, Shodan)."""
        
        pdns_results = {
            'primary_ip': '203.0.113.5',
            'secondary_ips': [
                '203.0.113.10',
                '203.0.113.15'
            ],
            'historical_ips': [
                '198.51.100.25',
                '198.51.100.30'
            ]
        }
        
        print(f"  └─ Primary IP: {pdns_results['primary_ip']}")
        print(f"  └─ Secondary IPs: {len(pdns_results['secondary_ips'])}")
        print(f"  └─ Historical IPs: {len(pdns_results['historical_ips'])}")
        
        return pdns_results
    
    def _consolidate_targets(self):
        """Create consolidated target list from all sources."""
        
        targets = []
        
        for domain in self.intelligence['ct_subdomains']['dns_names']:
            targets.append({
                'hostname': domain,
                'source': 'certificate_transparency',
                'verification_status': 'not_verified'
            })
        
        targets.extend([
            {
                'ip': ip,
                'source': 'passive_dns',
                'verification_status': 'not_verified'
            }
            for ip in self.intelligence['passive_dns']['primary_ip']
        ])
        
        return targets
```

**Phase 2: Active Reconnaissance (30-90 minutes)**

```python
class CompanyReconnaissancePhase2:
    """
    Active reconnaissance using Shodan, ZoomEye, and Basset Hound.
    """
    
    def __init__(self, targets, shodan_api_key, basset_config):
        self.targets = targets
        self.shodan = shodan.Shodan(shodan_api_key)
        self.basset = BassetHoundClient(**basset_config)
        self.active_services = []
    
    async def phase2_active_reconnaissance(self):
        """Actively discover services on identified targets."""
        
        print(f"\n[*] Phase 2: Active Reconnaissance")
        
        # Step 1: Shodan scanning of discovered IPs
        print("[*] Step 1: Shodan Service Discovery")
        shodan_results = await self._shodan_scan()
        
        # Step 2: Basset Hound verification
        print("[*] Step 2: Basset Hound Verification")
        verified_services = await self._verify_with_basset()
        
        return {
            'shodan_results': shodan_results,
            'verified_services': verified_services
        }
    
    async def _shodan_scan(self):
        """Query Shodan for services on discovered IPs."""
        
        services = []
        
        for ip in ['203.0.113.5', '203.0.113.10']:
            try:
                # Host-based query
                host_info = self.shodan.host(ip)
                
                for service in host_info['data']:
                    services.append({
                        'ip': ip,
                        'port': service['port'],
                        'product': service.get('product', 'Unknown'),
                        'version': service.get('version'),
                        'banner': service.get('data', ''),
                        'source': 'shodan'
                    })
                    
                    print(f"  └─ {ip}:{service['port']} - {service.get('product')}")
                
            except Exception as e:
                print(f"  └─ Shodan query failed for {ip}: {e}")
        
        return services
    
    async def _verify_with_basset(self):
        """Verify discovered services with Basset Hound."""
        
        verified = []
        
        for service in self.active_services[:5]:  # Limit to first 5
            url = f"http://{service['ip']}:{service['port']}"
            
            try:
                # Capture screenshot
                screenshot = await self.basset.take_screenshot(
                    url=url,
                    timeout=5000,
                    preserve_metadata=True
                )
                
                # Extract content
                content = await self.basset.extract_content(url)
                
                verified.append({
                    'ip': service['ip'],
                    'port': service['port'],
                    'product': service['product'],
                    'screenshot': screenshot['path'],
                    'title': content.get('title'),
                    'verified': True
                })
                
                print(f"  └─ {url}: {content.get('title', 'No title')}")
                
            except Exception as e:
                verified.append({
                    'ip': service['ip'],
                    'port': service['port'],
                    'verified': False,
                    'error': str(e)
                })
        
        return verified
```

**Phase 3: Relationship Mapping (90-120 minutes)**

```python
class CompanyReconnaissancePhase3:
    """
    Create relationship graphs using Maltego and forensic documentation.
    """
    
    async def phase3_relationship_mapping(self, discovered_assets):
        """Create Maltego graph of discovered infrastructure."""
        
        print(f"\n[*] Phase 3: Relationship Mapping")
        
        maltego_entities = []
        
        # Create domain entity
        maltego_entities.append({
            'type': 'domains.Domain',
            'value': 'target.example.com',
            'properties': {
                'registrant': 'Target Company Inc.',
                'ns1': 'ns1.example.com'
            }
        })
        
        # Create subdomain entities
        for service in discovered_assets:
            maltego_entities.append({
                'type': 'domains.Domain',
                'value': service.get('hostname'),
                'properties': {
                    'parent_domain': 'target.example.com',
                    'discovered_by': service['source']
                }
            })
        
        # Create IP entities
        maltego_entities.append({
            'type': 'ipv4-address',
            'value': '203.0.113.5',
            'properties': {
                'country': 'US',
                'asn': 64512,
                'organization': 'Target Company Inc.'
            }
        })
        
        # Create service entities
        maltego_entities.append({
            'type': 'website.URL',
            'value': 'https://www.target.example.com',
            'properties': {
                'title': 'Welcome to Target Company',
                'server': 'Nginx/1.18'
            }
        })
        
        print(f"[+] Created {len(maltego_entities)} Maltego entities")
        
        return maltego_entities
```

### Deliverables

**Investigation Report Structure:**

```
Company Infrastructure Reconnaissance Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. EXECUTIVE SUMMARY
   - Total assets discovered: 47
   - Active services: 23
   - Critical findings: 3

2. ASSET INVENTORY
   ├─ Web Servers (12)
   │  ├─ www.target.example.com (Nginx 1.18)
   │  ├─ api.target.example.com (Node.js/Express)
   │  └─ ...
   ├─ Email Services (2)
   │  └─ mail.target.example.com (Postfix)
   ├─ VPN Services (1)
   │  └─ vpn.target.example.com (OpenVPN)
   └─ Management Interfaces (3)
      └─ admin.target.example.com (Apache 2.4)

3. TIMELINE
   - 2024-01-15: Domain registered
   - 2024-06-12: Additional subdomains observed
   - 2025-03-20: API service deployed
   - 2026-05-07: Current state captured

4. FINDINGS & RECOMMENDATIONS
   - Finding 1: Unpatched Nginx 1.18 vulnerable to CVE-2021-XXXXX
   - Finding 2: Management interface accessible without authentication
   - Recommendation 1: Update Nginx to 1.26+
   - Recommendation 2: Implement authentication on admin interface

5. CHAIN OF CUSTODY
   - Evidence collected: 2026-05-07 14:32 UTC
   - Screenshots: 23 (SHA-256 hashed)
   - Content captures: 23 (preserved)
   - Investigator: John Doe (ID: JD-001)
```

---

## Scenario 2: Threat Actor Infrastructure Mapping

### Objective
Identify and document infrastructure used by a known threat actor group across multiple domains and IPs.

### Investigation Scope
- Correlate malicious domains with shared infrastructure
- Identify C2 servers and associated DNS records
- Detect secondary infrastructure
- Document campaign timeline
- Create relationship graph for threat intelligence

### Workflow

```python
class ThreatActorInfrastructureMapping:
    """
    Map threat actor infrastructure and correlate
    across multiple sources.
    """
    
    async def map_threat_actor_infrastructure(self, known_malicious_domains):
        """
        Starting with known malicious domains, discover related infrastructure.
        """
        
        print(f"[*] Threat Actor Infrastructure Mapping")
        print(f"    Known domains: {known_malicious_domains}")
        
        infrastructure = {
            'known_domains': known_malicious_domains,
            'shared_hosting': [],
            'shared_registrar': [],
            'ssl_certificates': [],
            'name_servers': [],
            'related_domains': []
        }
        
        # Step 1: Find common hosting provider
        for domain in known_malicious_domains:
            
            # Query Censys for certificate records
            certs = await self._query_certificates_for_domain(domain)
            infrastructure['ssl_certificates'].extend(certs)
            
            # Query WHOIS for registrar
            whois = await self._query_whois(domain)
            infrastructure['shared_registrar'].append(whois)
            
            # Query PDNS for name servers
            pdns = await self._query_pdns(domain)
            infrastructure['name_servers'].extend(pdns['nameservers'])
        
        # Step 2: Pivot on shared infrastructure
        print("\n[*] Pivoting on shared infrastructure")
        
        # Find all domains sharing same name servers
        related_by_ns = await self._find_domains_by_nameserver(
            infrastructure['name_servers']
        )
        infrastructure['related_domains'].extend(related_by_ns)
        
        # Find all domains using same SSL certificates
        related_by_cert = await self._find_domains_by_certificate(
            infrastructure['ssl_certificates']
        )
        infrastructure['related_domains'].extend(related_by_cert)
        
        # Step 3: Verify with Basset Hound
        print("\n[*] Verifying infrastructure with Basset Hound")
        for domain in infrastructure['related_domains'][:10]:
            await self._verify_domain_with_basset(domain)
        
        return infrastructure
    
    async def _query_certificates_for_domain(self, domain):
        """Query Censys for SSL certificates."""
        
        # In real implementation, would use Censys API
        certs = [
            {
                'domain': domain,
                'fingerprint': 'sha1:abc123...',
                'issuer': 'Let\'s Encrypt',
                'valid_from': '2025-01-01',
                'valid_to': '2026-01-01'
            }
        ]
        
        print(f"  └─ Found {len(certs)} SSL certificates for {domain}")
        
        return certs
    
    async def _find_domains_by_certificate(self, certificates):
        """Find all domains that share same SSL certificates."""
        
        # Query Censys for all domains with same certificate
        related_domains = []
        
        for cert in certificates:
            # Would query: certificate.fingerprint == X
            domains = [
                'attacker-domain1.com',
                'attacker-domain2.com',
                'attacker-domain3.xyz'
            ]
            related_domains.extend(domains)
        
        return list(set(related_domains))
    
    async def _find_domains_by_nameserver(self, nameservers):
        """Find all domains using same nameservers."""
        
        related = []
        
        for ns in nameservers:
            # Query FOFA or ZoomEye for domains with this NS
            domains = [
                'phishing-site1.ru',
                'phishing-site2.cc',
                'malware-host.tk'
            ]
            related.extend(domains)
        
        return list(set(related))
    
    async def _verify_domain_with_basset(self, domain):
        """Verify domain behavior with Basset Hound."""
        
        try:
            screenshot = await self.basset.take_screenshot(
                f"https://{domain}",
                timeout=5000
            )
            
            content = await self.basset.extract_content(f"https://{domain}")
            
            print(f"  └─ {domain}: {content.get('title', 'No title')}")
            
        except Exception as e:
            print(f"  └─ {domain}: Offline or unreachable")
```

---

## Scenario 3: Vulnerability Disclosure and Remediation Tracking

### Objective
Research a disclosed vulnerability in a third-party application, discover all instances in target environment, and track remediation progress.

### Investigation Scope
- Identify all instances of vulnerable software
- Document configuration details
- Verify vulnerability applicability
- Monitor for patches/updates
- Track remediation timeline

### Workflow

```python
class VulnerabilityDisclosureTracking:
    """
    Track vulnerable instances and remediation progress
    across discovered infrastructure.
    """
    
    async def track_vulnerability_remediation(self, cve_id, vulnerable_product):
        """
        Track remediation of specific vulnerability.
        """
        
        print(f"[*] Vulnerability Disclosure Tracking")
        print(f"    CVE: {cve_id}")
        print(f"    Product: {vulnerable_product}")
        
        tracking = {
            'cve_id': cve_id,
            'vulnerability_details': await self._fetch_cve_details(cve_id),
            'discovered_instances': [],
            'remediation_timeline': [],
            'current_status': 'discovering'
        }
        
        # Step 1: Search Shodan for instances
        print("\n[*] Step 1: Shodan Search")
        shodan_instances = await self._search_shodan_for_vuln(
            vulnerable_product,
            cve_id
        )
        tracking['discovered_instances'].extend(shodan_instances)
        
        # Step 2: Search ZoomEye for instances
        print("[*] Step 2: ZoomEye Search")
        zoomeye_instances = await self._search_zoomeye_for_vuln(
            vulnerable_product,
            cve_id
        )
        tracking['discovered_instances'].extend(zoomeye_instances)
        
        # Step 3: FOFA search for regional coverage
        print("[*] Step 3: FOFA Search")
        fofa_instances = await self._search_fofa_for_vuln(
            vulnerable_product,
            cve_id
        )
        tracking['discovered_instances'].extend(fofa_instances)
        
        # Step 4: Verify with Basset Hound
        print("\n[*] Step 4: Verification with Basset Hound")
        for instance in tracking['discovered_instances'][:5]:
            verified = await self._verify_vulnerability(
                instance['ip'],
                instance['port'],
                cve_id
            )
            instance['basset_verified'] = verified
        
        # Step 5: Track remediation
        print("\n[*] Step 5: Remediation Tracking")
        tracking['remediation_timeline'] = await self._track_remediation_over_time(
            tracking['discovered_instances']
        )
        
        return tracking
    
    async def _search_shodan_for_vuln(self, product, cve_id):
        """Search Shodan for vulnerable instances."""
        
        # Example: product:nginx version:1.18 vuln:CVE-2021-23017
        query = f'product:"{product}" vuln:{cve_id}'
        
        instances = []
        
        # Would execute Shodan search
        instances.append({
            'ip': '203.0.113.50',
            'port': 80,
            'product': product,
            'version': '1.18.0',
            'source': 'shodan',
            'discovered_date': '2026-05-07'
        })
        
        print(f"  └─ Found {len(instances)} instances")
        
        return instances
    
    async def _verify_vulnerability(self, ip, port, cve_id):
        """Verify vulnerability is exploitable."""
        
        try:
            url = f"http://{ip}:{port}"
            
            # Take screenshot for evidence
            screenshot = await self.basset.take_screenshot(url)
            
            # Check for version string
            content = await self.basset.extract_content(url)
            
            # Check if vulnerable
            vulnerable = self._check_version_vulnerable(
                content.get('server_header'),
                cve_id
            )
            
            return {
                'vulnerable': vulnerable,
                'screenshot': screenshot['path'],
                'server_header': content.get('server_header')
            }
        
        except:
            return {'vulnerable': False, 'error': 'unreachable'}
    
    async def _track_remediation_over_time(self, instances):
        """Monitor instances for patching over time."""
        
        timeline = []
        
        # Initial discovery
        timeline.append({
            'date': '2026-05-07',
            'event': 'Initial discovery',
            'vulnerable_count': len(instances),
            'patched_count': 0
        })
        
        # Subsequent checks (would be scheduled)
        timeline.append({
            'date': '2026-05-14',
            'event': 'First follow-up',
            'vulnerable_count': len(instances) - 2,
            'patched_count': 2
        })
        
        timeline.append({
            'date': '2026-05-21',
            'event': 'Second follow-up',
            'vulnerable_count': 0,
            'patched_count': len(instances)
        })
        
        return timeline
```

---

## Scenario 4: Supply Chain Intelligence Gathering

### Objective
Understand a company's supply chain by identifying key vendors, their technology stacks, and potential security risks.

### Investigation Scope
- Identify vendors and suppliers
- Map technology relationships
- Document security posture
- Assess third-party risks
- Create supply chain graph

### Workflow

```python
class SupplyChainIntelligenceGathering:
    """
    Map organizational supply chain and assess vendor risks.
    """
    
    async def map_supply_chain_infrastructure(self, target_organization):
        """
        Identify vendors and suppliers through infrastructure analysis.
        """
        
        print(f"[*] Supply Chain Intelligence Gathering")
        print(f"    Organization: {target_organization}")
        
        supply_chain = {
            'primary_organization': target_organization,
            'identified_vendors': [],
            'vendor_risk_assessment': [],
            'shared_infrastructure': []
        }
        
        # Step 1: Identify vendors from DNS records
        print("\n[*] Step 1: Vendor Identification from DNS")
        vendors_from_dns = await self._identify_vendors_from_dns(target_organization)
        supply_chain['identified_vendors'].extend(vendors_from_dns)
        
        # Step 2: Identify vendors from SSL certificates
        print("[*] Step 2: Vendor Identification from SSL Certificates")
        vendors_from_certs = await self._identify_vendors_from_certs(target_organization)
        supply_chain['identified_vendors'].extend(vendors_from_certs)
        
        # Step 3: Assess vendor security posture
        print("\n[*] Step 3: Vendor Risk Assessment")
        for vendor in supply_chain['identified_vendors'][:10]:
            risk_assessment = await self._assess_vendor_security(vendor)
            supply_chain['vendor_risk_assessment'].append(risk_assessment)
        
        # Step 4: Identify shared infrastructure
        print("\n[*] Step 4: Shared Infrastructure Analysis")
        shared = await self._find_shared_infrastructure(target_organization)
        supply_chain['shared_infrastructure'].extend(shared)
        
        return supply_chain
    
    async def _identify_vendors_from_dns(self, organization):
        """Identify vendors from DNS records."""
        
        vendors = [
            {
                'name': 'Stripe',
                'domain': 'stripe.com',
                'service': 'Payment Processing',
                'discovered_via': 'DNS CNAME record',
                'risk_level': 'LOW'
            },
            {
                'name': 'Datadog',
                'domain': 'datadog.com',
                'service': 'Monitoring',
                'discovered_via': 'DNS MX record',
                'risk_level': 'MEDIUM'
            }
        ]
        
        print(f"  └─ Identified {len(vendors)} vendors")
        
        return vendors
    
    async def _assess_vendor_security(self, vendor):
        """Assess vendor's security posture."""
        
        assessment = {
            'vendor': vendor['name'],
            'infrastructure_findings': [],
            'vulnerability_findings': [],
            'overall_risk': 'MEDIUM'
        }
        
        # Search for vendor's infrastructure on their domain
        vendor_domain = vendor['domain']
        
        # Use ZoomEye to scan vendor's infrastructure
        vendor_assets = await self._scan_vendor_infrastructure(vendor_domain)
        
        # Check for known vulnerabilities
        vulnerabilities = await self._check_vendor_vulnerabilities(vendor_domain)
        
        assessment['infrastructure_findings'] = vendor_assets
        assessment['vulnerability_findings'] = vulnerabilities
        
        if vulnerabilities:
            assessment['overall_risk'] = 'HIGH'
        
        print(f"  └─ {vendor['name']}: {assessment['overall_risk']} risk")
        
        return assessment
    
    async def _scan_vendor_infrastructure(self, vendor_domain):
        """Scan vendor's infrastructure."""
        
        # Would use ZoomEye API
        assets = [
            {
                'type': 'web_server',
                'service': 'Nginx 1.24',
                'status': 'current'
            }
        ]
        
        return assets
```

---

## Scenario 5: Competitor Technology Monitoring

### Objective
Monitor a competitor's technology stack and infrastructure changes over time.

### Investigation Scope
- Establish baseline technology inventory
- Track changes to infrastructure
- Detect new technology deployments
- Monitor for cloud migrations
- Document timeline of technology decisions

### Implementation

```python
class CompetitorTechnologyMonitoring:
    """
    Continuously monitor competitor's technology stack.
    """
    
    async def establish_technology_baseline(self, competitor_domain):
        """
        Create baseline inventory of competitor's technologies.
        """
        
        print(f"[*] Competitor Technology Monitoring")
        print(f"    Competitor: {competitor_domain}")
        
        baseline = {
            'snapshot_date': datetime.utcnow().isoformat(),
            'competitor_domain': competitor_domain,
            'technology_stack': {},
            'infrastructure_summary': {}
        }
        
        # Step 1: Scan all discovered infrastructure
        print("\n[*] Step 1: Technology Stack Analysis")
        
        # Use FOFA for technology fingerprinting
        tech_stack = await self._identify_technology_stack(competitor_domain)
        baseline['technology_stack'] = tech_stack
        
        # Step 2: Document cloud services
        print("[*] Step 2: Cloud Service Detection")
        cloud_services = await self._detect_cloud_services(competitor_domain)
        baseline['infrastructure_summary']['cloud_services'] = cloud_services
        
        # Step 3: Analyze Wayback Machine for historical data
        print("[*] Step 3: Historical Technology Tracking")
        historical = await self._query_wayback_machine(competitor_domain)
        baseline['historical_snapshots'] = historical
        
        return baseline
    
    async def _identify_technology_stack(self, domain):
        """Identify technologies used by competitor."""
        
        stack = {
            'web_servers': {
                'Nginx': [
                    {'version': '1.24', 'instances': 5},
                    {'version': '1.23', 'instances': 2}
                ]
            },
            'frameworks': {
                'React': [
                    {'version': '18.2', 'sites': 12}
                ]
            },
            'cms': {
                'WordPress': [
                    {'version': '6.4', 'sites': 3}
                ]
            },
            'cdn': {
                'Cloudflare': ['primary'],
                'Akamai': ['cdn.competitor.com']
            },
            'analytics': {
                'Google Analytics': ['Universal Analytics'],
                'Mixpanel': ['active']
            }
        }
        
        print(f"  └─ Web Servers: {sum(v for vs in stack['web_servers'].values() for v in vs)}")
        
        return stack
    
    async def _detect_cloud_services(self, domain):
        """Detect cloud services in use."""
        
        cloud_services = [
            {
                'provider': 'AWS',
                'services': ['EC2', 'S3', 'CloudFront'],
                'evidence': 'DNS records point to aws.amazon.com'
            },
            {
                'provider': 'Google Cloud',
                'services': ['Cloud Run', 'Cloud Storage'],
                'evidence': 'SSL certificate CN matches google cloud'
            }
        ]
        
        return cloud_services
```

---

## Scenario 6: Dark Web Threat Intelligence

### Objective
Investigate threat actor activity on the dark web and correlate with known infrastructure.

### Investigation Scope
- Monitor dark web marketplaces
- Track threat actor communications
- Correlate dark web activity with surface web infrastructure
- Document threat actor relationships
- Generate intelligence reports

**Note:** This scenario requires proper authorization from law enforcement or authorized security research program.

---

## Part 2: Integration Patterns and Best Practices

### 2.1 OSINT Tool Chain Architecture

```
┌──────────────────────────────────────────────────────────────┐
│           OSINT INVESTIGATION WORKFLOW                       │
└──────────────────────────────────────────────────────────────┘

Passive Intelligence
├─ Censys (Certificate records)
├─ WHOIS (Domain registration)
├─ Passive DNS (Historical records)
└─ VirusTotal (Malware relationships)
        ↓
Active Discovery
├─ Shodan (Internet device census)
├─ ZoomEye (Cyberspace mapping)
├─ FOFA (Specialized fingerprinting)
└─ Censys (Host scanning)
        ↓
Evidence Capture & Verification
├─ Basset Hound (Screenshots)
├─ Basset Hound (Content extraction)
├─ Basset Hound (Metadata logging)
└─ Basset Hound (Chain of custody)
        ↓
Relationship Mapping
├─ Maltego (Entity relationships)
├─ Maltego (Timeline visualization)
└─ Maltego (Link analysis)
        ↓
Forensic Documentation
├─ Timeline generation
├─ Evidence aggregation
├─ Chain of custody report
└─ Admissibility certification
```

### 2.2 Data Flow and Integration

```python
class OSINTInvestigationPipeline:
    """
    Orchestrate OSINT investigation workflow with
    multiple integrated tools.
    """
    
    async def execute_full_investigation(self, target, investigation_scope):
        """
        Execute complete investigation pipeline.
        """
        
        results = {
            'target': target,
            'investigation_start': datetime.utcnow().isoformat(),
            'phases': {}
        }
        
        # Phase 1: Passive Intelligence
        print("[*] Phase 1: Passive Intelligence")
        passive_intel = await self._phase_passive_intelligence(target)
        results['phases']['passive'] = passive_intel
        
        # Phase 2: Active Discovery
        print("[*] Phase 2: Active Discovery")
        active_discovery = await self._phase_active_discovery(target)
        results['phases']['active'] = active_discovery
        
        # Phase 3: Evidence Capture
        print("[*] Phase 3: Evidence Capture")
        evidence = await self._phase_evidence_capture(active_discovery)
        results['phases']['evidence'] = evidence
        
        # Phase 4: Relationship Mapping
        print("[*] Phase 4: Relationship Mapping")
        mapping = await self._phase_relationship_mapping(evidence)
        results['phases']['mapping'] = mapping
        
        # Phase 5: Reporting
        print("[*] Phase 5: Report Generation")
        report = await self._generate_final_report(results)
        results['report'] = report
        
        results['investigation_end'] = datetime.utcnow().isoformat()
        
        return results
    
    async def _phase_passive_intelligence(self, target):
        """Gather passive intelligence."""
        # Implementation
        pass
    
    async def _phase_active_discovery(self, target):
        """Perform active discovery."""
        # Implementation
        pass
    
    async def _phase_evidence_capture(self, discovered_assets):
        """Capture evidence from discovered assets."""
        # Implementation
        pass
    
    async def _phase_relationship_mapping(self, evidence):
        """Create relationship maps."""
        # Implementation
        pass
    
    async def _generate_final_report(self, investigation_data):
        """Generate comprehensive investigation report."""
        # Implementation
        pass
```

---

## Part 3: Ethical and Legal Considerations

### 3.1 Authorization Requirements

Before conducting any OSINT investigation, ensure you have:
- [ ] Written authorization (warrant, permission letter, EULA)
- [ ] Legal review of investigation scope
- [ ] Clear identification of target and objectives
- [ ] Documented investigation procedures
- [ ] Approved evidence handling procedures

### 3.2 Responsible Disclosure

When discovering vulnerabilities:
1. **Notification** - Contact vendor/organization immediately
2. **Timeline** - Standard 90-day disclosure period
3. **Coordination** - Work with CERT if applicable
4. **Public Disclosure** - Only after patch released or deadline passed
5. **Attribution** - Clearly identify discoverer for credit

---

## References and Sources

- [Complete OSINT Toolkit for Threat Intelligence Professionals 2026](https://blog.cyberhawkconsultancy.org/2026/01/complete-osint-toolkit-for-threat.html)
- [OSINT Framework: What It Is, How It Works, and the Best Tools](https://www.bitsight.com/learn/cti/osint-framework)
- [Company Infrastructure Reconnaissance Techniques](https://liferaftlabs.com/blog/osint-tools-for-security-analysts-in-2026/)
- [Threat Actor Infrastructure Mapping Methodology](https://medium.com/@cyberhawkconsultancy/introduction-6563880c2120)
- [Supply Chain OSINT: Mapping Hidden Vulnerabilities](https://www.marielandryspyshop.com/2026/04/supply-chain-osint-mapping-hidden.html)
- [Best OSINT Tools 2026 - 24 Free & Paid Solutions](https://shadowdragon.io/blog/best-osint-tools/)
- [Automated OSINT Techniques for Digital Asset Discovery](https://www.mdpi.com/2073-431X/14/10/430)
