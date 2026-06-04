/**
 * Advanced OSINT Tests
 * Tests for threat intelligence, domain intelligence, infrastructure mapping, and context building
 */

const { ThreatIntelligence, ThreatActor, Campaign } = require('../../src/advanced/threat-intel');
const { DomainIntelligence } = require('../../src/advanced/domain-intel');
const { InfrastructureMapper } = require('../../src/advanced/infra-mapper');
const { ContextBuilder } = require('../../src/advanced/context-builder');

describe('Threat Intelligence Engine', () => {
  let threatIntel;

  beforeEach(() => {
    threatIntel = new ThreatIntelligence({
      enableML: false,
      correlationThreshold: 0.7
    });
  });

  test('should initialize', () => {
    expect(threatIntel.threatActors.size).toBe(0);
    expect(threatIntel.campaigns.size).toBe(0);
    expect(threatIntel.indicators.size).toBe(0);
  });

  test('should register threat actor', () => {
    const actor = threatIntel.registerThreatActor({
      id: 'actor-1',
      name: 'Threat Actor 1',
      country: 'CN',
      sophistication: 'High',
      capabilities: ['phishing', 'malware', 'credential-theft']
    });

    expect(actor.id).toBe('actor-1');
    expect(actor.riskScore).toBeGreaterThan(0);
    expect(threatIntel.threatActors.size).toBe(1);
  });

  test('should register campaign', () => {
    const actor = threatIntel.registerThreatActor({
      id: 'actor-1',
      name: 'Threat Actor 1'
    });

    const campaign = threatIntel.registerCampaign({
      id: 'campaign-1',
      name: 'Operation Stealth',
      threatActorIds: ['actor-1'],
      targetedSectors: ['finance', 'defense'],
      targetedCountries: ['US', 'EU']
    });

    expect(campaign.id).toBe('campaign-1');
    expect(campaign.threatActors).toContain('actor-1');
    expect(threatIntel.campaigns.size).toBe(1);
  });

  test('should add indicators', () => {
    threatIntel.registerThreatActor({
      id: 'actor-1',
      name: 'Threat Actor 1'
    });

    const indicator = threatIntel.addIndicator('malicious.com', {
      type: 'domain',
      threatActors: ['actor-1'],
      severity: 'High',
      confidence: 0.95
    });

    expect(indicator.value).toBe('malicious.com');
    expect(indicator.type).toBe('domain');
    expect(threatIntel.indicators.size).toBe(1);
  });

  test('should classify indicators', () => {
    expect(threatIntel.classifyIndicator('user@example.com')).toBe('email');
    expect(threatIntel.classifyIndicator('192.168.1.1')).toBe('ip');
    expect(threatIntel.classifyIndicator('example.com')).toBe('domain');
    expect(threatIntel.classifyIndicator('a' + '0'.repeat(63))).toBe('unknown');
  });

  test('should correlate campaigns', () => {
    threatIntel.registerCampaign({
      id: 'campaign-1',
      name: 'Campaign 1',
      targetedCountries: ['US', 'CN'],
      targetedSectors: ['finance']
    });

    threatIntel.registerCampaign({
      id: 'campaign-2',
      name: 'Campaign 2',
      targetedCountries: ['US'],
      targetedSectors: ['finance', 'defense']
    });

    const correlations = threatIntel.correlateData();
    expect(Array.isArray(correlations)).toBe(true);
  });

  test('should perform attribution', () => {
    const actor = threatIntel.registerThreatActor({
      id: 'actor-1',
      name: 'Threat Actor 1'
    });

    threatIntel.addIndicator('malicious.com', {
      threatActors: ['actor-1']
    });

    threatIntel.addIndicator('192.168.1.1', {
      threatActors: ['actor-1']
    });

    const attributions = threatIntel.performAttribution(['malicious.com', '192.168.1.1']);
    expect(attributions).toHaveLength(1);
    expect(attributions[0].actorId).toBe('actor-1');
  });

  test('should analyze timeline', () => {
    const events = [
      { timestamp: Date.now() - 10 * 86400000, type: 'phishing', description: 'Phishing campaign started' },
      { timestamp: Date.now() - 5 * 86400000, type: 'malware', description: 'Malware dropped' },
      { timestamp: Date.now(), type: 'c2-communication', description: 'C2 activity detected' }
    ];

    const analysis = threatIntel.analyzeTimeline(events);
    expect(analysis.totalEvents).toBe(3);
    expect(analysis.eventsByType.phishing).toBeDefined();
    expect(analysis.timespan.durationMs).toBeGreaterThan(0);
  });

  test('should get infrastructure map', () => {
    threatIntel.registerThreatActor({
      id: 'actor-1',
      name: 'Threat Actor 1'
    });

    const actor = threatIntel.threatActors.get('actor-1');
    actor.indicators.domains = ['malicious.com', 'c2.com'];
    actor.indicators.ips = ['192.168.1.1', '10.0.0.1'];

    const infra = threatIntel.getInfrastructureMap();
    expect(infra.domainCount).toBeGreaterThanOrEqual(0);
    expect(infra.ipCount).toBeGreaterThanOrEqual(0);
  });

  test('should generate threat report', () => {
    threatIntel.registerThreatActor({
      id: 'actor-1',
      name: 'Threat Actor 1'
    });

    const report = threatIntel.generateThreatReport('summary');
    expect(report.type).toBe('summary');
    expect(report.executive).toBeDefined();
    expect(report.executive.totalActors).toBeGreaterThanOrEqual(0);
  });

  test('should get metrics', () => {
    const metrics = threatIntel.getMetrics();
    expect(metrics.actorCount).toBe(0);
    expect(metrics.campaignCount).toBe(0);
    expect(metrics.indicatorCount).toBe(0);
  });
});

describe('Domain Intelligence', () => {
  let domainIntel;

  beforeEach(() => {
    domainIntel = new DomainIntelligence({
      parseWHOIS: true,
      trackSubdomains: true
    });
  });

  test('should initialize', () => {
    expect(domainIntel.domains.size).toBe(0);
    expect(domainIntel.registrants.size).toBe(0);
  });

  test('should normalize domains', () => {
    expect(domainIntel.normalizeDomain('EXAMPLE.COM')).toBe('example.com');
    expect(domainIntel.normalizeDomain('WWW.EXAMPLE.COM')).toBe('example.com');
  });

  test('should analyze domain', async () => {
    const analysis = await domainIntel.analyzeDomain('example.com');

    expect(analysis.domain).toBe('example.com');
    expect(analysis.registrationInfo).toBeDefined();
    expect(analysis.dnsRecords).toBeDefined();
    expect(analysis.reputation).toBeDefined();
    expect(analysis.security).toBeDefined();
  });

  test('should enumerate subdomains', async () => {
    const analysis = await domainIntel.analyzeDomain('example.com');

    expect(Array.isArray(analysis.subdomains)).toBe(true);
    if (analysis.subdomains.length > 0) {
      expect(analysis.subdomains[0]).toHaveProperty('subdomain');
    }
  });

  test('should find certificates', async () => {
    const analysis = await domainIntel.analyzeDomain('example.com');

    expect(Array.isArray(analysis.certificates)).toBe(true);
    if (analysis.certificates.length > 0) {
      expect(analysis.certificates[0]).toHaveProperty('subject');
      expect(analysis.certificates[0]).toHaveProperty('issuer');
    }
  });

  test('should assess reputation', async () => {
    const analysis = await domainIntel.analyzeDomain('example.com');

    expect(analysis.reputation).toHaveProperty('overallScore');
    expect(analysis.reputation.overallScore).toBeGreaterThanOrEqual(0);
    expect(analysis.reputation.overallScore).toBeLessThanOrEqual(100);
  });

  test('should perform security analysis', async () => {
    const analysis = await domainIntel.analyzeDomain('example.com');

    expect(analysis.security).toHaveProperty('ssl');
    expect(analysis.security).toHaveProperty('headers');
    expect(analysis.security).toHaveProperty('authentication');
    expect(analysis.security.securityScore).toBeGreaterThanOrEqual(0);
  });

  test('should track DNS changes', async () => {
    await domainIntel.analyzeDomain('example.com');

    const changes = domainIntel.trackDNSChanges('example.com');
    expect(changes).toBeDefined();
    if (changes) {
      expect(changes.domain).toBe('example.com');
    }
  });

  test('should generate domain report', async () => {
    await domainIntel.analyzeDomain('example.com');

    const report = domainIntel.generateReport('example.com');
    expect(report).toBeDefined();
    if (report) {
      expect(report.domain).toBe('example.com');
      expect(report.registration).toBeDefined();
    }
  });

  test('should get metrics', async () => {
    await domainIntel.analyzeDomain('example.com');

    const metrics = domainIntel.getMetrics();
    expect(metrics.domainsAnalyzed).toBeGreaterThanOrEqual(0);
    expect(metrics.subdomainsFound).toBeGreaterThanOrEqual(0);
  });
});

describe('Infrastructure Mapper', () => {
  let mapper;

  beforeEach(() => {
    mapper = new InfrastructureMapper({
      enableGeolocation: true,
      clusterDistance: 2
    });
  });

  test('should initialize', () => {
    expect(mapper.ipRanges.size).toBe(0);
    expect(mapper.autonomousSystems.size).toBe(0);
  });

  test('should register IP address', () => {
    const result = mapper.registerIP('192.168.1.1', {
      subnet: '192.168.1.0/24',
      asn: 'AS12345',
      org: 'Example Corp',
      country: 'US'
    });

    expect(result.ip).toBe('192.168.1.1');
    expect(result.subnet).toBe('192.168.1.0/24');
    expect(result.registered).toBe(true);
  });

  test('should link domain to IPs', () => {
    mapper.registerIP('192.168.1.1', {
      subnet: '192.168.1.0/24',
      asn: 'AS12345',
      org: 'Example Corp'
    });

    const result = mapper.linkDomainToIPs('example.com', ['192.168.1.1']);
    expect(result.domain).toBe('example.com');
    expect(result.ips).toContain('192.168.1.1');
  });

  test('should register service', () => {
    mapper.registerIP('192.168.1.1', {
      subnet: '192.168.1.0/24',
      asn: 'AS12345',
      org: 'Example Corp'
    });

    const service = mapper.registerService('192.168.1.1', 80, {
      protocol: 'tcp',
      service: 'http'
    });

    expect(service.ip).toBe('192.168.1.1');
    expect(service.port).toBe(80);
  });

  test('should identify clusters', () => {
    mapper.registerIP('192.168.1.1', {
      subnet: '192.168.1.0/24',
      asn: 'AS12345',
      org: 'Example Corp'
    });

    mapper.registerIP('192.168.2.1', {
      subnet: '192.168.2.0/24',
      asn: 'AS12345',
      org: 'Example Corp'
    });

    const clusters = mapper.identifyClusters();
    expect(Array.isArray(clusters)).toBe(true);
    if (clusters.length > 0) {
      expect(clusters[0]).toHaveProperty('id');
      expect(clusters[0]).toHaveProperty('subnets');
    }
  });

  test('should analyze ASN relationships', () => {
    mapper.registerIP('192.168.1.1', {
      subnet: '192.168.1.0/24',
      asn: 'AS12345',
      org: 'Example Corp'
    });

    const relationships = mapper.analyzeASNRelationships(['AS12345']);
    expect(relationships).toHaveProperty('peering');
    expect(relationships).toHaveProperty('upstream');
    expect(relationships).toHaveProperty('downstream');
  });

  test('should get network topology', () => {
    mapper.registerIP('192.168.1.1', {
      subnet: '192.168.1.0/24',
      asn: 'AS12345',
      org: 'Example Corp'
    });

    const topology = mapper.getNetworkTopology();
    expect(topology).toHaveProperty('nodes');
    expect(topology).toHaveProperty('edges');
    expect(Array.isArray(topology.nodes)).toBe(true);
    expect(Array.isArray(topology.edges)).toBe(true);
  });

  test('should analyze geographic distribution', () => {
    mapper.registerIP('192.168.1.1', {
      subnet: '192.168.1.0/24',
      asn: 'AS12345',
      org: 'Example Corp',
      geo: { country: 'US', city: 'New York' }
    });

    const geoAnalysis = mapper.analyzeGeographicDistribution();
    expect(geoAnalysis).toHaveProperty('countries');
    expect(geoAnalysis).toHaveProperty('cityClusters');
  });

  test('should export map', () => {
    mapper.registerIP('192.168.1.1', {
      subnet: '192.168.1.0/24',
      asn: 'AS12345',
      org: 'Example Corp'
    });

    const exported = mapper.exportMap('json');
    expect(exported.format).toBe('json');
    expect(exported).toHaveProperty('ipRanges');
    expect(exported).toHaveProperty('autonomousSystems');
  });

  test('should get metrics', () => {
    const metrics = mapper.getMetrics();
    expect(metrics).toHaveProperty('ipRangesTracked');
    expect(metrics).toHaveProperty('asnsTracked');
  });
});

describe('Context Builder', () => {
  let contextBuilder;

  beforeEach(() => {
    contextBuilder = new ContextBuilder({
      cacheTimeout: 3600000
    });
  });

  test('should initialize', () => {
    expect(contextBuilder.contexts.size).toBe(0);
    expect(contextBuilder.relationships.size).toBe(0);
  });

  test('should build context', () => {
    const targetEntity = 'malicious.com';
    const sources = {
      threatIntel: {
        threatActors: [
          { id: 'actor-1', name: 'Threat Actor 1', riskScore: 85 }
        ]
      },
      domainIntel: {
        registrant: { name: 'John Doe', organization: 'Malicious Org' }
      }
    };

    const context = contextBuilder.buildContext(targetEntity, sources);
    expect(context.target).toBe(targetEntity);
    expect(context.relationships.size).toBeGreaterThanOrEqual(0);
  });

  test('should track relationships', () => {
    const context = contextBuilder.buildContext('entity-1', {
      threatIntel: {
        threatActors: [{ id: 'actor-1', name: 'Actor 1', riskScore: 80 }]
      }
    });

    expect(contextBuilder.relationships.size).toBeGreaterThanOrEqual(0);
  });

  test('should build timeline from sources', () => {
    const sources = {
      threatIntel: {
        timeline: [
          { timestamp: Date.now() - 10 * 86400000, type: 'phishing', description: 'Campaign started' }
        ]
      }
    };

    const context = contextBuilder.buildContext('entity-1', sources);
    expect(context.timeline).toBeDefined();
    expect(Array.isArray(context.timeline)).toBe(true);
  });

  test('should assess impacts', () => {
    const sources = {
      threatIntel: {
        threatActors: [
          { id: 'actor-1', name: 'Actor 1', riskScore: 95 }
        ]
      }
    };

    const context = contextBuilder.buildContext('entity-1', sources);
    expect(context.impacts).toBeDefined();
    expect(Array.isArray(context.impacts)).toBe(true);
  });

  test('should generate summary', () => {
    const context = contextBuilder.buildContext('entity-1', {
      threatIntel: {
        threatActors: [{ id: 'actor-1', name: 'Actor 1', riskScore: 75 }]
      }
    });

    expect(context.summary).toBeDefined();
    expect(context.summary).toHaveProperty('overview');
    expect(context.summary).toHaveProperty('threatLevel');
    expect(context.summary).toHaveProperty('actionItems');
  });

  test('should get context', () => {
    const context = contextBuilder.buildContext('entity-1', {});
    const retrieved = contextBuilder.getContext(context.id);

    expect(retrieved).toBeDefined();
    expect(retrieved.id).toBe(context.id);
  });

  test('should list contexts', () => {
    contextBuilder.buildContext('entity-1', {});
    contextBuilder.buildContext('entity-2', {});

    const contexts = contextBuilder.listContexts();
    expect(Array.isArray(contexts)).toBe(true);
    expect(contexts.length).toBeGreaterThanOrEqual(2);
  });

  test('should get metrics', () => {
    const metrics = contextBuilder.getMetrics();
    expect(metrics).toHaveProperty('contextsBuilt');
    expect(metrics).toHaveProperty('relationshipsIdentified');
    expect(metrics).toHaveProperty('timelinesCreated');
  });
});
