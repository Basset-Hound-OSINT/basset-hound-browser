/**
 * Advanced Integration Tests
 * Tests for Shodan Advanced, Maltego Advanced, Censys Advanced,
 * Intelligence Synthesis, and Reconnaissance Workflows
 */

const { ShodanAdvanced } = require('../../src/integrations/shodan-advanced');
const { MaltegoAdvanced } = require('../../src/integrations/maltego-advanced');
const { CensysAdvanced } = require('../../src/integrations/censys-advanced');
const { IntelligenceSynthesis } = require('../../src/integrations/intelligence-synthesis');
const { ReconnaissanceWorkflows } = require('../../src/integrations/recon-workflows');

describe('Shodan Advanced Intelligence', () => {
  let shodanAdvanced;

  beforeEach(() => {
    shodanAdvanced = new ShodanAdvanced({
      apiKey: 'test-key'
    });
  });

  test('should initialize with proper configuration', () => {
    expect(shodanAdvanced).toBeDefined();
    expect(shodanAdvanced.metrics).toBeDefined();
    expect(shodanAdvanced.cache).toEqual(new Map());
  });

  test('should build advanced query from filters', async () => {
    const filters = {
      port: 80,
      country: 'US',
      service: 'HTTP'
    };

    const query = shodanAdvanced.buildAdvancedQuery(filters);
    expect(query).toContain('port:80');
    expect(query).toContain('country:US');
    expect(query).toContain('service:HTTP');
  });

  test('should calculate certificate risk score', () => {
    const cert = {
      vuln: { 'CVE-2024-001': {}, 'CVE-2024-002': {} },
      ports: [80, 443, 3306],
      ip_str: '192.168.1.1'
    };

    const score = shodanAdvanced.calculateRiskScore(cert);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('should identify threat level', () => {
    const testCases = [
      { riskScore: 90, expected: 'CRITICAL' },
      { riskScore: 70, expected: 'HIGH' },
      { riskScore: 50, expected: 'MEDIUM' },
      { riskScore: 20, expected: 'LOW' }
    ];

    for (const { riskScore, expected } of testCases) {
      const data = { ports: [], vuln: {} };
      // Mock risk score
      shodanAdvanced.calculateRiskScore = jest.fn(() => riskScore);
      const level = shodanAdvanced.determineThreatLevel(data);
      expect(level).toBe(expected);
    }
  });

  test('should deduplicate hosts', () => {
    const hosts = [
      { ip_str: '192.168.1.1' },
      { ip_str: '192.168.1.2' },
      { ip_str: '192.168.1.1' },
      { ip_str: '192.168.1.3' }
    ];

    const unique = shodanAdvanced.deduplicateHosts(hosts);
    expect(unique.length).toBe(3);
  });

  test('should identify critical ports', () => {
    expect(shodanAdvanced.isCriticalPort(22)).toBe(true);
    expect(shodanAdvanced.isCriticalPort(445)).toBe(true);
    expect(shodanAdvanced.isCriticalPort(8080)).toBe(false);
  });

  test('should identify exposed services', () => {
    expect(shodanAdvanced.isExposedService(80)).toBe(true);
    expect(shodanAdvanced.isExposedService(443)).toBe(true);
    expect(shodanAdvanced.isExposedService(3306)).toBe(true);
    expect(shodanAdvanced.isExposedService(22)).toBe(false);
  });

  test('should get common ports', () => {
    const ports = shodanAdvanced.getCommonPorts();
    expect(Array.isArray(ports)).toBe(true);
    expect(ports.length).toBeGreaterThan(0);
    expect(ports).toContain(80);
    expect(ports).toContain(443);
  });

  test('should track metrics', () => {
    const metrics = shodanAdvanced.getMetrics();
    expect(metrics).toHaveProperty('vulnerabilityTargets');
    expect(metrics).toHaveProperty('portReconResults');
    expect(metrics).toHaveProperty('historicalAnalysis');
    expect(metrics).toHaveProperty('threatCorrelations');
  });

  test('should reset metrics', () => {
    shodanAdvanced.metrics.vulnerabilityTargets = 10;
    shodanAdvanced.resetMetrics();
    expect(shodanAdvanced.metrics.vulnerabilityTargets).toBe(0);
  });

  test('should clear caches', () => {
    shodanAdvanced.cache.set('test', { data: 'test' });
    shodanAdvanced.correlationCache.set('corr', { data: 'test' });

    shodanAdvanced.clearCaches();

    expect(shodanAdvanced.cache.size).toBe(0);
    expect(shodanAdvanced.correlationCache.size).toBe(0);
  });

  test('should find common ports across hosts', () => {
    const hosts = [
      { ports: [22, 80, 443] },
      { ports: [22, 443, 3306] },
      { ports: [22, 80] }
    ];

    const commonPorts = shodanAdvanced.findCommonPorts(hosts);
    expect(commonPorts).toContain(22);
    expect(commonPorts.length).toBe(1);
  });

  test('should assess vulnerability risk', () => {
    const hosts = [
      { riskScore: 90 },
      { riskScore: 70 },
      { riskScore: 50 },
      { riskScore: 20 }
    ];

    const risk = shodanAdvanced.assessVulnerabilityRisk(hosts);
    expect(risk.CRITICAL).toBe(1);
    expect(risk.HIGH).toBe(1);
    expect(risk.MEDIUM).toBe(1);
    expect(risk.LOW).toBe(1);
  });
});

describe('Maltego Advanced Intelligence', () => {
  let maltegoAdvanced;

  beforeEach(() => {
    maltegoAdvanced = new MaltegoAdvanced({
      apiKey: 'test-key',
      apiSecret: 'test-secret'
    });
  });

  test('should initialize with proper configuration', () => {
    expect(maltegoAdvanced).toBeDefined();
    expect(maltegoAdvanced.customTransforms.size).toBeGreaterThan(0);
  });

  test('should register custom transform', () => {
    const transformConfig = {
      name: 'test-transform',
      inputEntity: 'maltego.EmailAddress',
      outputEntities: ['maltego.Domain'],
      logic: 'extract-domain'
    };

    maltegoAdvanced.registerTransform('test-id', transformConfig);
    expect(maltegoAdvanced.customTransforms.has('test-id')).toBe(true);
  });

  test('should get registered transforms', () => {
    const transforms = maltegoAdvanced.getTransforms();
    expect(Array.isArray(transforms)).toBe(true);
    expect(transforms.length).toBeGreaterThan(0);
  });

  test('should calculate centrality measures', async () => {
    const graph = {
      entities: {
        'e1': { value: 'entity1' },
        'e2': { value: 'entity2' },
        'e3': { value: 'entity3' }
      },
      relationships: [
        { source: 'e1', target: 'e2' },
        { source: 'e2', target: 'e3' },
        { source: 'e1', target: 'e3' }
      ]
    };

    const centrality = await maltegoAdvanced.calculateCentrality(graph);
    expect(centrality).toHaveProperty('degree');
    expect(centrality).toHaveProperty('topNodes');
  });

  test('should calculate clustering coefficient', () => {
    const graph = {
      entities: {
        'e1': { value: 'entity1' },
        'e2': { value: 'entity2' },
        'e3': { value: 'entity3' }
      },
      relationships: [
        { source: 'e1', target: 'e2' },
        { source: 'e2', target: 'e3' }
      ]
    };

    const clustering = maltegoAdvanced.calculateClustering(graph);
    expect(clustering).toBeDefined();
    expect(Object.keys(clustering).length).toBeGreaterThan(0);
  });

  test('should detect communities', () => {
    const graph = {
      entities: {
        'e1': { type: 'Email', value: 'test@example.com' },
        'e2': { type: 'Email', value: 'user@example.com' },
        'e3': { type: 'Domain', value: 'example.com' }
      },
      relationships: []
    };

    const communities = maltegoAdvanced.detectCommunities(graph);
    expect(communities).toHaveProperty('Email');
    expect(communities).toHaveProperty('Domain');
  });

  test('should identify key entities', () => {
    const graph = {
      entities: {
        'e1': { value: 'entity1' },
        'e2': { value: 'entity2' },
        'e3': { value: 'entity3' }
      },
      relationships: [
        { source: 'e1', target: 'e2' },
        { source: 'e1', target: 'e3' },
        { source: 'e2', target: 'e3' }
      ]
    };

    const keyEntities = maltegoAdvanced.identifyKeyEntities(graph);
    expect(Array.isArray(keyEntities)).toBe(true);
    expect(keyEntities.length).toBeGreaterThan(0);
  });

  test('should calculate density', () => {
    const graph = {
      entities: {
        'e1': { value: 'entity1' },
        'e2': { value: 'entity2' },
        'e3': { value: 'entity3' }
      },
      relationships: [
        { source: 'e1', target: 'e2' },
        { source: 'e1', target: 'e3' },
        { source: 'e2', target: 'e3' }
      ]
    };

    const density = maltegoAdvanced.calculateDensity(graph);
    expect(density).toBeGreaterThanOrEqual(0);
    expect(density).toBeLessThanOrEqual(1);
  });

  test('should assess graph risk', () => {
    const graph = {
      entities: {
        'e1': { type: 'maltego.IPv4Address', value: '192.168.1.1' },
        'e2': { type: 'maltego.Hostname', value: 'example.com' }
      },
      relationships: [
        { source: 'e1', target: 'e2', type: 'resolves_to' }
      ]
    };

    const risk = maltegoAdvanced.assessGraphRisk(graph);
    expect(risk).toHaveProperty('riskScore');
    expect(risk.riskScore).toBeGreaterThanOrEqual(0);
    expect(risk.riskScore).toBeLessThanOrEqual(100);
  });

  test('should convert to GraphML format', () => {
    const graph = {
      entities: {
        'e1': { value: 'entity1' },
        'e2': { value: 'entity2' }
      },
      relationships: [
        { source: 'e1', target: 'e2' }
      ]
    };

    const graphml = maltegoAdvanced.convertToGraphML(graph);
    expect(graphml).toContain('<?xml');
    expect(graphml).toContain('<graphml');
    expect(graphml).toContain('entity1');
  });

  test('should convert to CSV format', () => {
    const graph = {
      entities: {
        'e1': { value: 'entity1' },
        'e2': { value: 'entity2' }
      },
      relationships: [
        { source: 'e1', target: 'e2', type: 'related' }
      ]
    };

    const csv = maltegoAdvanced.convertToCSV(graph);
    expect(csv).toContain('Source,Target,Relationship');
    expect(csv).toContain('entity1');
  });

  test('should track metrics', () => {
    const metrics = maltegoAdvanced.getMetrics();
    expect(metrics).toHaveProperty('graphsAnalyzed');
    expect(metrics).toHaveProperty('entitiesProcessed');
    expect(metrics).toHaveProperty('relationshipsDiscovered');
  });
});

describe('Censys Advanced Intelligence', () => {
  let censysAdvanced;

  beforeEach(() => {
    censysAdvanced = new CensysAdvanced({
      apiId: 'test-id',
      apiSecret: 'test-secret'
    });
  });

  test('should initialize with proper configuration', () => {
    expect(censysAdvanced).toBeDefined();
    expect(censysAdvanced.metrics).toBeDefined();
  });

  test('should calculate certificate risk score', () => {
    const cert = {
      validity: { end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
      public_key_algorithm: 'RSA',
      public_key_bits: 2048,
      signature_algorithm: 'sha256WithRSAEncryption',
      subject: 'CN=example.com',
      issuer: 'CN=Let\'s Encrypt Authority X3'
    };

    const score = censysAdvanced.calculateCertificateRiskScore(cert);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('should identify certificate issues', () => {
    const cert = {
      validity: { end: new Date(Date.now() - 1000).toISOString() },
      public_key_algorithm: 'RSA',
      public_key_bits: 1024,
      signature_algorithm: 'md5WithRSAEncryption',
      subject: 'CN=self',
      issuer: 'CN=self'
    };

    const issues = censysAdvanced.identifyCertificateIssues(cert);
    expect(Array.isArray(issues)).toBe(true);
    expect(issues.length).toBeGreaterThan(0);
  });

  test('should check if certificate is expiring soon', () => {
    const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
    const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    expect(censysAdvanced.isExpiringSoon(futureDate)).toBe(true);
    expect(censysAdvanced.isExpiringSoon(pastDate)).toBe(false);
  });

  test('should analyze chain trust', () => {
    const certificates = [
      {
        fingerprint_sha256: 'aaa',
        issuer: 'CN=Root CA',
        parsed: { issuer_dn: 'Root CA' }
      },
      {
        fingerprint_sha256: 'bbb',
        issuer: 'CN=Let\'s Encrypt',
        parsed: { issuer_dn: 'Let\'s Encrypt Authority' }
      }
    ];

    const chain = censysAdvanced.analyzeChainTrust(certificates);
    expect(Array.isArray(chain)).toBe(true);
    expect(chain.length).toBe(2);
  });

  test('should identify service by port', () => {
    const serviceCases = [
      { port: 22, expected: 'SSH' },
      { port: 80, expected: 'HTTP' },
      { port: 443, expected: 'HTTPS' },
      { port: 3306, expected: 'MySQL' },
      { port: 9999, expected: 'Service-9999' }
    ];

    for (const { port, expected } of serviceCases) {
      expect(censysAdvanced.identifyService(port)).toBe(expected);
    }
  });

  test('should assess ASN risk', () => {
    const research = {
      asn: 'AS1234',
      hostCount: 500,
      infrastructure: {
        serviceDistribution: { SSH: 100, HTTP: 200 }
      }
    };

    const risk = censysAdvanced.assessASNRisk(research);
    expect(risk).toHaveProperty('riskScore');
    expect(risk).toHaveProperty('threatLevel');
    expect(risk).toHaveProperty('recommendations');
  });

  test('should track metrics', () => {
    const metrics = censysAdvanced.getMetrics();
    expect(metrics).toHaveProperty('certificateAnalysis');
    expect(metrics).toHaveProperty('asnResearch');
    expect(metrics).toHaveProperty('hostEnumeration');
  });
});

describe('Intelligence Synthesis', () => {
  let synthesis;

  beforeEach(() => {
    synthesis = new IntelligenceSynthesis();
  });

  test('should initialize with proper configuration', () => {
    expect(synthesis).toBeDefined();
    expect(synthesis.integrations).toEqual(new Map());
    expect(synthesis.metrics).toBeDefined();
  });

  test('should register integration source', () => {
    const client = { name: 'test-source' };
    synthesis.registerIntegration('test-source', client);

    expect(synthesis.integrations.has('test-source')).toBe(true);
    expect(synthesis.metrics.datasourcesIntegrated).toBe(1);
  });

  test('should get registered integrations', () => {
    const client1 = { name: 'source1' };
    const client2 = { name: 'source2' };

    synthesis.registerIntegration('source1', client1);
    synthesis.registerIntegration('source2', client2);

    const integrations = synthesis.getIntegrations();
    expect(integrations.length).toBe(2);
  });

  test('should assess data quality', () => {
    const quality = synthesis.assessDataQuality({});
    expect(quality).toHaveProperty('completeness');
    expect(quality).toHaveProperty('accuracy');
    expect(quality).toHaveProperty('consistency');
    expect(quality).toHaveProperty('score');
  });

  test('should assess source reputation', () => {
    const reputation = synthesis.assessSourceReputation({});
    expect(reputation).toHaveProperty('reliability');
    expect(reputation).toHaveProperty('trackRecord');
    expect(reputation).toHaveProperty('score');
  });

  test('should assess temporal validity', () => {
    const validity = synthesis.assessTemporalValidity({});
    expect(validity).toHaveProperty('freshness');
    expect(validity).toHaveProperty('relevance');
    expect(validity).toHaveProperty('score');
  });

  test('should assess context relevance', () => {
    const relevance = synthesis.assessContextRelevance({});
    expect(relevance).toHaveProperty('applicability');
    expect(relevance).toHaveProperty('contextuality');
    expect(relevance).toHaveProperty('score');
  });

  test('should track metrics', () => {
    const metrics = synthesis.getMetrics();
    expect(metrics).toHaveProperty('correlations');
    expect(metrics).toHaveProperty('threatLevelAssessments');
    expect(metrics).toHaveProperty('infrastructureMappings');
  });

  test('should reset metrics', () => {
    synthesis.metrics.correlations = 10;
    synthesis.resetMetrics();
    expect(synthesis.metrics.correlations).toBe(0);
  });
});

describe('Reconnaissance Workflows', () => {
  let workflows;

  beforeEach(() => {
    workflows = new ReconnaissanceWorkflows();
  });

  test('should initialize with default workflow templates', () => {
    expect(workflows.workflowTemplates.size).toBeGreaterThan(0);
  });

  test('should get workflow templates', () => {
    const templates = workflows.getWorkflowTemplates();
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThan(0);

    const names = templates.map(t => t.name);
    expect(names).toContain('Basic Host Reconnaissance');
    expect(names).toContain('Advanced Threat Investigation');
    expect(names).toContain('Domain Enumeration');
    expect(names).toContain('Network Reconnaissance');
  });

  test('should register custom workflow template', () => {
    const template = {
      name: 'Custom Workflow',
      description: 'A custom reconnaissance workflow',
      steps: [
        { id: 'step1', type: 'lookup', target: 'shodan' }
      ],
      estimatedTime: 60,
      outputFormat: 'detailed'
    };

    workflows.registerWorkflowTemplate('custom-workflow', template);
    expect(workflows.workflowTemplates.has('custom-workflow')).toBe(true);
  });

  test('should schedule workflow execution', () => {
    const schedule = {
      frequency: 'daily',
      time: '02:00',
      timezone: 'UTC'
    };

    const scheduled = workflows.scheduleWorkflow('basic-host-recon', schedule);
    expect(scheduled).toHaveProperty('id');
    expect(scheduled).toHaveProperty('nextRun');
    expect(scheduled.schedule.frequency).toBe('daily');
  });

  test('should get scheduled workflows', () => {
    workflows.scheduleWorkflow('basic-host-recon', { frequency: 'daily' });
    workflows.scheduleWorkflow('threat-investigation', { frequency: 'weekly' });

    const scheduled = workflows.getScheduledWorkflows();
    expect(scheduled.length).toBe(2);
  });

  test('should calculate next run time for daily frequency', () => {
    const schedule = { frequency: 'daily' };
    const nextRun = workflows.calculateNextRun(schedule);

    expect(nextRun > new Date()).toBe(true);
  });

  test('should calculate next run time for weekly frequency', () => {
    const schedule = { frequency: 'weekly' };
    const nextRun = workflows.calculateNextRun(schedule);

    const daysDifference = Math.floor((nextRun - new Date()) / (1000 * 60 * 60 * 24));
    expect(daysDifference).toBe(7);
  });

  test('should calculate next run time for monthly frequency', () => {
    const schedule = { frequency: 'monthly' };
    const nextRun = workflows.calculateNextRun(schedule);

    expect(nextRun > new Date()).toBe(true);
  });

  test('should get execution history', () => {
    expect(Array.isArray(workflows.executionHistory)).toBe(true);
  });

  test('should track metrics', () => {
    const metrics = workflows.getMetrics();
    expect(metrics).toHaveProperty('workflowsExecuted');
    expect(metrics).toHaveProperty('tasksCompleted');
    expect(metrics).toHaveProperty('resultsAggregated');
    expect(metrics).toHaveProperty('reportsGenerated');
  });

  test('should reset metrics', () => {
    workflows.metrics.workflowsExecuted = 10;
    workflows.resetMetrics();
    expect(workflows.metrics.workflowsExecuted).toBe(0);
  });

  test('should clear execution history', () => {
    workflows.executionHistory.push({ id: 'test' });
    workflows.clearExecutionHistory();
    expect(workflows.executionHistory.length).toBe(0);
  });

  test('should count threats in results', () => {
    const results = [
      { threats: 3 },
      { threats: 2 },
      { other: 'data' }
    ];

    const count = workflows.countThreats(results);
    expect(count).toBe(5);
  });

  test('should count risks in results', () => {
    const results = [
      { risk: 2 },
      { risk: 3 },
      { other: 'data' }
    ];

    const count = workflows.countRisks(results);
    expect(count).toBe(5);
  });

  test('should extract indicators from results', () => {
    const results = [
      { indicators: ['ind1', 'ind2'] },
      { indicators: ['ind3'] }
    ];

    const indicators = workflows.extractIndicators(results);
    expect(indicators).toContain('ind1');
    expect(indicators).toContain('ind2');
    expect(indicators).toContain('ind3');
  });
});

describe('Integration Tests', () => {
  test('all modules should emit events', (done) => {
    const shodan = new ShodanAdvanced({ apiKey: 'test' });
    const maltego = new MaltegoAdvanced({ apiKey: 'test', apiSecret: 'test' });
    const censys = new CensysAdvanced({ apiId: 'test', apiSecret: 'test' });

    const eventCount = 3;
    let emitted = 0;

    shodan.on('caches-cleared', () => { emitted++; });
    maltego.on('caches-cleared', () => { emitted++; });
    censys.on('caches-cleared', () => { emitted++; });

    shodan.clearCaches();
    maltego.clearCaches();
    censys.clearCaches();

    setTimeout(() => {
      expect(emitted).toBe(eventCount);
      done();
    }, 100);
  });

  test('all modules should provide metrics', () => {
    const shodan = new ShodanAdvanced({ apiKey: 'test' });
    const maltego = new MaltegoAdvanced({ apiKey: 'test', apiSecret: 'test' });
    const censys = new CensysAdvanced({ apiId: 'test', apiSecret: 'test' });
    const synthesis = new IntelligenceSynthesis();
    const workflows = new ReconnaissanceWorkflows();

    const metrics1 = shodan.getMetrics();
    const metrics2 = maltego.getMetrics();
    const metrics3 = censys.getMetrics();
    const metrics4 = synthesis.getMetrics();
    const metrics5 = workflows.getMetrics();

    expect(metrics1).toBeDefined();
    expect(metrics2).toBeDefined();
    expect(metrics3).toBeDefined();
    expect(metrics4).toBeDefined();
    expect(metrics5).toBeDefined();
  });

  test('all modules should handle cache operations', () => {
    const shodan = new ShodanAdvanced({ apiKey: 'test' });
    const maltego = new MaltegoAdvanced({ apiKey: 'test', apiSecret: 'test' });
    const censys = new CensysAdvanced({ apiId: 'test', apiSecret: 'test' });

    shodan.clearCaches();
    maltego.clearCaches();
    censys.clearCaches();

    expect(shodan.cache.size).toBe(0);
    expect(maltego.analysisCache.size).toBe(0);
    expect(censys.analysisCache.size).toBe(0);
  });
});
