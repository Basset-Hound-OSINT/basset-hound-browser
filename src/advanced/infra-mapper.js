/**
 * Infrastructure Mapper
 * Maps and analyzes network infrastructure, IP clustering, and ASN relationships
 * @module src/advanced/infra-mapper
 */

const EventEmitter = require('events');

/**
 * IP Address Range
 */
class IPRange {
  constructor(subnet, asn, org, country) {
    this.subnet = subnet;
    this.asn = asn;
    this.org = org;
    this.country = country;
    this.ips = new Set();
    this.domains = new Set();
    this.hostnames = new Set();
    this.services = [];
    this.firstSeen = Date.now();
    this.lastSeen = Date.now();
  }

  addIP(ip) {
    this.ips.add(ip);
    this.lastSeen = Date.now();
  }

  addDomain(domain) {
    this.domains.add(domain);
  }

  addHostname(hostname) {
    this.hostnames.add(hostname);
  }

  addService(service) {
    if (!this.services.find(s => s.port === service.port)) {
      this.services.push(service);
    }
  }
}

/**
 * Autonomous System
 */
class AutonomousSystem {
  constructor(asn, name, country) {
    this.asn = asn;
    this.name = name;
    this.country = country;
    this.ipRanges = [];
    this.organizations = new Set();
    this.peers = new Set();
    this.upstreams = new Set();
    this.downstreams = new Set();
    this.reputation = {
      score: 0,
      concerns: []
    };
    this.metadata = {};
  }

  addIPRange(ipRange) {
    this.ipRanges.push(ipRange);
    this.organizations.add(ipRange.org);
  }

  calculateReputation() {
    let score = 100;

    // Deduct for known issues
    if (this.reputation.concerns.includes('hosting_provider')) score -= 5;
    if (this.reputation.concerns.includes('datacenter')) score -= 3;
    if (this.reputation.concerns.includes('vps_hosting')) score -= 5;
    if (this.reputation.concerns.includes('anonymity_service')) score -= 20;
    if (this.reputation.concerns.includes('proxy')) score -= 15;
    if (this.reputation.concerns.includes('botnet')) score -= 50;

    this.reputation.score = Math.max(score, 0);
    return this.reputation.score;
  }
}

/**
 * Infrastructure Mapper Class
 */
class InfrastructureMapper extends EventEmitter {
  constructor(options = {}) {
    super();

    this.ipRanges = new Map(); // subnet -> IPRange
    this.autonomousSystems = new Map(); // asn -> AutonomousSystem
    this.hostToASN = new Map(); // ip -> asn mapping
    this.domainToIPs = new Map(); // domain -> [ips]
    this.asnPeering = new Map(); // asn -> peeringData
    this.geoLocation = new Map(); // ip -> geoData
    this.clusters = []; // IP clusters/groups

    this.enableGeolocation = options.enableGeolocation !== false;
    this.clusterDistance = options.clusterDistance || 2; // hops

    // Metrics
    this.metrics = {
      ipRangesTracked: 0,
      asnsTracked: 0,
      domainsTracked: 0,
      clustersIdentified: 0,
      totalIPs: 0,
      timestamp: Date.now()
    };
  }

  /**
   * Register IP address with ASN and organization
   * @param {string} ip - IP address
   * @param {Object} ipInfo - IP information
   * @returns {Object} Registration result
   */
  registerIP(ip, ipInfo) {
    const subnet = ipInfo.subnet || this.calculateSubnet(ip);
    const asn = ipInfo.asn || 'AS0';
    const org = ipInfo.org || 'Unknown';
    const country = ipInfo.country || 'Unknown';

    // Create or update IP range
    if (!this.ipRanges.has(subnet)) {
      const ipRange = new IPRange(subnet, asn, org, country);
      this.ipRanges.set(subnet, ipRange);

      // Create or update ASN
      if (!this.autonomousSystems.has(asn)) {
        const as = new AutonomousSystem(asn, org, country);
        this.autonomousSystems.set(asn, as);
        this.metrics.asnsTracked++;
      }

      this.autonomousSystems.get(asn).addIPRange(ipRange);
      this.metrics.ipRangesTracked++;
    }

    const ipRange = this.ipRanges.get(subnet);
    ipRange.addIP(ip);
    this.hostToASN.set(ip, asn);
    this.metrics.totalIPs++;

    // Add geolocation if available
    if (ipInfo.geo) {
      this.geoLocation.set(ip, {
        country: ipInfo.geo.country,
        city: ipInfo.geo.city,
        latitude: ipInfo.geo.latitude,
        longitude: ipInfo.geo.longitude,
        asn: asn
      });
    }

    this.emit('ip-registered', {
      ip,
      subnet,
      asn,
      org
    });

    return {
      ip,
      subnet,
      asn,
      registered: true
    };
  }

  /**
   * Link domain to IP addresses
   * @param {string} domain - Domain name
   * @param {Array} ips - IP addresses
   * @returns {Object} Linking result
   */
  linkDomainToIPs(domain, ips) {
    const normalizedDomain = domain.toLowerCase();

    if (!this.domainToIPs.has(normalizedDomain)) {
      this.domainToIPs.set(normalizedDomain, []);
      this.metrics.domainsTracked++;
    }

    const ipSet = this.domainToIPs.get(normalizedDomain);

    for (const ip of ips) {
      if (!ipSet.includes(ip)) {
        ipSet.push(ip);

        // Link domain to IP range
        const asn = this.hostToASN.get(ip);
        const subnet = this.findSubnet(ip);

        if (subnet) {
          const ipRange = this.ipRanges.get(subnet);
          ipRange.addDomain(normalizedDomain);
        }
      }
    }

    this.emit('domain-linked', {
      domain: normalizedDomain,
      ipCount: ipSet.length
    });

    return {
      domain: normalizedDomain,
      ips: ipSet,
      linked: true
    };
  }

  /**
   * Register service on IP/port
   * @param {string} ip - IP address
   * @param {number} port - Port number
   * @param {Object} serviceInfo - Service information
   * @returns {Object} Service registration
   */
  registerService(ip, port, serviceInfo) {
    const subnet = this.findSubnet(ip);
    if (!subnet) {
      throw new Error(`IP ${ip} not registered in any range`);
    }

    const ipRange = this.ipRanges.get(subnet);
    const service = {
      ip,
      port,
      protocol: serviceInfo.protocol || 'tcp',
      service: serviceInfo.service || 'unknown',
      banner: serviceInfo.banner || null,
      product: serviceInfo.product || null,
      version: serviceInfo.version || null,
      timestamp: Date.now()
    };

    ipRange.addService(service);

    this.emit('service-registered', {
      ip,
      port,
      service: serviceInfo.service
    });

    return service;
  }

  /**
   * Identify IP clusters (closely related infrastructure)
   * @returns {Array} Clusters
   */
  identifyClusters() {
    const clusters = [];
    const visited = new Set();

    for (const [subnet, ipRange] of this.ipRanges) {
      if (visited.has(subnet)) continue;

      const cluster = {
        id: `cluster-${clusters.length}`,
        subnets: [subnet],
        asns: new Set([ipRange.asn]),
        organizations: new Set([ipRange.org]),
        domains: new Set(ipRange.domains),
        totalIPs: ipRange.ips.size,
        services: ipRange.services.length,
        countries: new Set([ipRange.country]),
        relationships: [],
        timestamp: Date.now()
      };

      visited.add(subnet);

      // Find related subnets (same ASN or closely related)
      for (const [otherSubnet, otherRange] of this.ipRanges) {
        if (visited.has(otherSubnet)) continue;

        // Same ASN = related
        if (otherRange.asn === ipRange.asn) {
          cluster.subnets.push(otherSubnet);
          cluster.asns.add(otherRange.asn);
          cluster.organizations.add(otherRange.org);
          cluster.totalIPs += otherRange.ips.size;
          otherRange.domains.forEach(d => cluster.domains.add(d));
          cluster.countries.add(otherRange.country);
          visited.add(otherSubnet);
        }

        // Shared domains = related
        for (const domain of ipRange.domains) {
          if (otherRange.domains.has(domain)) {
            if (!cluster.subnets.includes(otherSubnet)) {
              cluster.subnets.push(otherSubnet);
              cluster.asns.add(otherRange.asn);
              cluster.organizations.add(otherRange.org);
              cluster.totalIPs += otherRange.ips.size;
              otherRange.domains.forEach(d => cluster.domains.add(d));
              cluster.countries.add(otherRange.country);
              visited.add(otherSubnet);
            }
          }
        }
      }

      // Convert sets to arrays for storage
      cluster.asns = Array.from(cluster.asns);
      cluster.organizations = Array.from(cluster.organizations);
      cluster.countries = Array.from(cluster.countries);
      cluster.domains = Array.from(cluster.domains);

      clusters.push(cluster);
    }

    this.clusters = clusters;
    this.metrics.clustersIdentified = clusters.length;

    this.emit('clustering-completed', {
      clusterCount: clusters.length,
      totalSubnets: this.ipRanges.size
    });

    return clusters;
  }

  /**
   * Analyze ASN relationships
   * @param {Array} asns - ASNs to analyze (optional)
   * @returns {Object} ASN relationship data
   */
  analyzeASNRelationships(asns = null) {
    const targetASNs = asns || Array.from(this.autonomousSystems.keys());
    const relationships = {
      peering: new Map(),
      upstream: new Map(),
      downstream: new Map(),
      siblings: new Map(),
      timestamp: Date.now()
    };

    // Simulate relationship discovery
    for (const asn of targetASNs) {
      if (!this.autonomousSystems.has(asn)) continue;

      const as = this.autonomousSystems.get(asn);

      // Find peers (shared peering points - simulated)
      const peersCount = Math.floor(Math.random() * 5) + 1;
      for (let i = 0; i < peersCount; i++) {
        const peerASN = `AS${Math.floor(Math.random() * 65000)}`;
        as.peers.add(peerASN);
      }

      // Find upstreams (providers)
      const upstreamCount = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < upstreamCount; i++) {
        const upstreamASN = `AS${Math.floor(Math.random() * 10000)}`; // Larger ASNs are typically providers
        as.upstreams.add(upstreamASN);
      }

      // Find downstreams (customers)
      const downstreamCount = Math.floor(Math.random() * 10);
      for (let i = 0; i < downstreamCount; i++) {
        const downstreamASN = `AS${Math.floor(Math.random() * 65000)}`;
        as.downstreams.add(downstreamASN);
      }

      relationships.peering.set(asn, Array.from(as.peers));
      relationships.upstream.set(asn, Array.from(as.upstreams));
      relationships.downstream.set(asn, Array.from(as.downstreams));
    }

    return relationships;
  }

  /**
   * Get network topology visualization data
   * @returns {Object} Topology data
   */
  getNetworkTopology() {
    const topology = {
      nodes: [],
      edges: [],
      clusters: this.clusters,
      timestamp: Date.now()
    };

    // Add IP range nodes
    for (const [subnet, ipRange] of this.ipRanges) {
      topology.nodes.push({
        id: subnet,
        type: 'subnet',
        label: subnet,
        asn: ipRange.asn,
        org: ipRange.org,
        country: ipRange.country,
        ipCount: ipRange.ips.size,
        serviceCount: ipRange.services.length,
        domainCount: ipRange.domains.size
      });
    }

    // Add ASN nodes
    for (const [asn, as] of this.autonomousSystems) {
      topology.nodes.push({
        id: asn,
        type: 'asn',
        label: `${asn} - ${as.name}`,
        country: as.country,
        rangeCount: as.ipRanges.length,
        reputationScore: as.calculateReputation()
      });
    }

    // Add edges between subnets and ASNs
    for (const [subnet, ipRange] of this.ipRanges) {
      topology.edges.push({
        source: subnet,
        target: ipRange.asn,
        type: 'contains',
        weight: ipRange.ips.size
      });
    }

    // Add edges between ASNs
    for (const [asn, as] of this.autonomousSystems) {
      for (const peerASN of as.peers) {
        topology.edges.push({
          source: asn,
          target: peerASN,
          type: 'peer',
          weight: 1
        });
      }

      for (const upstreamASN of as.upstreams) {
        topology.edges.push({
          source: asn,
          target: upstreamASN,
          type: 'upstream',
          weight: 2
        });
      }
    }

    return topology;
  }

  /**
   * Analyze geographic distribution
   * @returns {Object} Geographic analysis
   */
  analyzeGeographicDistribution() {
    const geoAnalysis = {
      countries: {},
      cityClusters: [],
      distribution: {
        continental: {},
        countryLevel: {}
      },
      timestamp: Date.now()
    };

    // Count by country
    for (const [ip, geo] of this.geoLocation) {
      if (!geoAnalysis.countries[geo.country]) {
        geoAnalysis.countries[geo.country] = {
          country: geo.country,
          ipCount: 0,
          cities: new Set(),
          asns: new Set()
        };
      }

      geoAnalysis.countries[geo.country].ipCount++;
      if (geo.city) {
        geoAnalysis.countries[geo.country].cities.add(geo.city);
      }
      geoAnalysis.countries[geo.country].asns.add(geo.asn);
    }

    // Convert sets to arrays
    for (const [country, data] of Object.entries(geoAnalysis.countries)) {
      data.cities = Array.from(data.cities);
      data.asns = Array.from(data.asns);
    }

    return geoAnalysis;
  }

  /**
   * Helper: Calculate subnet from IP
   * @private
   */
  calculateSubnet(ip) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }

  /**
   * Helper: Find subnet for IP
   * @private
   */
  findSubnet(ip) {
    for (const subnet of this.ipRanges.keys()) {
      const parts = subnet.split('/');
      const base = parts[0];
      const baseParts = base.split('.').slice(0, 3).join('.');
      const ipParts = ip.split('.').slice(0, 3).join('.');

      if (baseParts === ipParts) {
        return subnet;
      }
    }
    return null;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      ipRangesTracked: this.ipRanges.size,
      asnsTracked: this.autonomousSystems.size,
      domainsTracked: this.domainToIPs.size,
      clustersIdentified: this.clusters.length
    };
  }

  /**
   * Export infrastructure map
   */
  exportMap(format = 'json') {
    const map = {
      format,
      ipRanges: Array.from(this.ipRanges).map(([subnet, range]) => ({
        subnet,
        asn: range.asn,
        org: range.org,
        country: range.country,
        ips: Array.from(range.ips),
        domains: Array.from(range.domains),
        services: range.services
      })),
      autonomousSystems: Array.from(this.autonomousSystems).map(([asn, as]) => ({
        asn,
        name: as.name,
        country: as.country,
        rangeCount: as.ipRanges.length,
        reputationScore: as.reputation.score
      })),
      clusters: this.clusters,
      topology: this.getNetworkTopology(),
      timestamp: Date.now()
    };

    return map;
  }
}

module.exports = {
  InfrastructureMapper,
  createInfrastructureMapper: (options) => new InfrastructureMapper(options)
};
