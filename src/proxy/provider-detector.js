/**
 * Basset Hound Browser - Provider Detection & Evasion Scorer
 * Detects proxy type and assesses detection risk
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 *
 * Features:
 * - Accurate proxy type detection (residential, datacenter, VPN, mobile)
 * - Detection risk scoring
 * - Provider identification
 * - Evasion strength assessment
 * - Historical accuracy tracking
 */

class ProviderDetector {
  constructor(options = {}) {
    this.detectionDatabase = new Map(); // proxyId -> detectionData
    this.providerPatterns = this.initializeProviderPatterns();
    this.typeCharacteristics = this.initializeTypeCharacteristics();
    this.detectionAccuracy = new Map(); // providerType -> { correct, total }
    this.ipIntelligenceCache = new Map(); // ip -> intelligenceData
    this.detectionConfidence = options.detectionConfidence || 0.75; // 75% confidence threshold
  }

  /**
   * Initialize provider identification patterns
   */
  initializeProviderPatterns() {
    return {
      'residential': {
        commonProviders: [
          { name: 'Bright Data', ipRanges: ['5.130.0.0/16'], confidence: 0.95 },
          { name: 'Oxylabs', ipRanges: ['185.8.0.0/16'], confidence: 0.92 },
          { name: 'Smartproxy', ipRanges: ['185.212.0.0/16'], confidence: 0.90 },
          { name: 'Zyte', ipRanges: ['45.142.0.0/16'], confidence: 0.88 },
          { name: 'ScraperAPI', ipRanges: ['18.188.0.0/16'], confidence: 0.85 }
        ],
        characteristics: ['organic-isp', 'variable-speeds', 'real-browser-behavior'],
        riskScore: 1,
        riskLevel: 'very-low',
        detectionDifficulty: 'hard'
      },

      'mobile': {
        commonProviders: [
          { name: 'Bright Data Mobile', ipRanges: ['5.130.0.0/16'], confidence: 0.90 },
          { name: 'Oxylabs Mobile', ipRanges: ['185.8.0.0/16'], confidence: 0.88 },
          { name: 'Zyte Mobile', ipRanges: ['45.142.0.0/16'], confidence: 0.87 }
        ],
        characteristics: ['mobile-carrier', 'rotating-imei', 'mobile-useragent'],
        riskScore: 2,
        riskLevel: 'very-low',
        detectionDifficulty: 'very-hard'
      },

      'datacenter': {
        commonProviders: [
          { name: 'AWS', ipRanges: ['52.0.0.0/8'], confidence: 0.98 },
          { name: 'Google Cloud', ipRanges: ['35.184.0.0/13'], confidence: 0.97 },
          { name: 'DigitalOcean', ipRanges: ['45.55.0.0/16'], confidence: 0.96 },
          { name: 'Linode', ipRanges: ['45.33.0.0/16'], confidence: 0.95 },
          { name: 'Azure', ipRanges: ['13.64.0.0/11'], confidence: 0.96 }
        ],
        characteristics: ['shared-hosting', 'consistent-speed', 'datacenter-patterns'],
        riskScore: 8,
        riskLevel: 'high',
        detectionDifficulty: 'very-easy'
      },

      'vpn': {
        commonProviders: [
          { name: 'NordVPN', ipRanges: ['95.211.0.0/16'], confidence: 0.94 },
          { name: 'ExpressVPN', ipRanges: ['188.43.0.0/16'], confidence: 0.92 },
          { name: 'Windscribe', ipRanges: ['74.115.0.0/16'], confidence: 0.91 },
          { name: 'ProtonVPN', ipRanges: ['185.217.0.0/16'], confidence: 0.90 },
          { name: 'Surfshark', ipRanges: ['185.200.0.0/16'], confidence: 0.89 }
        ],
        characteristics: ['vpn-fingerprint', 'known-endpoints', 'blocklist-presence'],
        riskScore: 9,
        riskLevel: 'critical',
        detectionDifficulty: 'easy'
      }
    };
  }

  /**
   * Initialize type-specific detection characteristics
   */
  initializeTypeCharacteristics() {
    return {
      'residential': {
        speedRange: [100, 500], // ms
        ttlPatterns: [64, 128],
        asn_reputation: 'good',
        reverse_dns: 'isp-style',
        request_diversity: 'high',
        time_consistency: 'variable'
      },

      'mobile': {
        speedRange: [150, 600], // ms
        ttlPatterns: [64, 112],
        asn_reputation: 'good',
        reverse_dns: 'mobile-carrier',
        userAgentPattern: 'mobile',
        deviceVariance: 'high'
      },

      'datacenter': {
        speedRange: [10, 100], // ms
        ttlPatterns: [64],
        asn_reputation: 'cloud',
        reverse_dns: 'cloud-provider',
        request_diversity: 'low',
        time_consistency: 'very-consistent',
        abuseReports: 'many'
      },

      'vpn': {
        speedRange: [50, 300], // ms
        ttlPatterns: [64],
        asn_reputation: 'vpn-known',
        reverse_dns: 'vpn-provider',
        blocklistPresence: 'common',
        protocolEncryption: 'always'
      }
    };
  }

  /**
   * Detect proxy type from IP characteristics
   */
  detectProxyType(ipAddress, additionalSignals = {}) {
    const detection = {
      proxyId: additionalSignals.proxyId || null,
      ipAddress,
      detectedAt: Date.now(),
      detections: {},
      recommendations: null,
      confidence: null,
      finalType: null
    };

    // Run detection methods
    const signalResults = {
      patternMatch: this.detectByIPPattern(ipAddress),
      whoisAnalysis: this.analyzeWhoisData(ipAddress, additionalSignals.whoisData),
      behaviorAnalysis: this.analyzeBehavioralSignals(additionalSignals),
      asnAnalysis: this.analyzeASN(additionalSignals.asn),
      reversedns: this.analyzeReverseDns(additionalSignals.reverseDns)
    };

    detection.detections = signalResults;

    // Aggregate signals with weighted voting
    const votes = this.aggregateDetectionSignals({
      'pattern-matching': signalResults.patternMatch,
      'asn-analysis': signalResults.asnAnalysis,
      'whois-analysis': signalResults.whoisAnalysis,
      'reverse-dns-analysis': signalResults.reversedns,
      'behavioral-analysis': signalResults.behaviorAnalysis
    });
    detection.finalType = votes.winner;
    detection.confidence = votes.confidence;

    // Assess detection risk
    const riskAssessment = this.assessDetectionRisk(detection.finalType, additionalSignals);
    detection.riskAssessment = riskAssessment;

    // Store detection
    if (detection.proxyId) {
      this.detectionDatabase.set(detection.proxyId, detection);
    }

    // Cache IP intelligence
    this.ipIntelligenceCache.set(ipAddress, {
      type: detection.finalType,
      confidence: detection.confidence,
      risk: riskAssessment.riskScore,
      detectedAt: Date.now()
    });

    return detection;
  }

  /**
   * Detect by IP pattern matching
   */
  detectByIPPattern(ipAddress) {
    const results = {};

    for (const [typeKey, typeConfig] of Object.entries(this.providerPatterns)) {
      let bestMatch = null;
      let bestConfidence = 0;

      for (const provider of typeConfig.commonProviders) {
        // Simple IP range matching (would use proper CIDR in production)
        const baseOctets = ipAddress.split('.').slice(0, 2).join('.');
        const providerOctets = provider.ipRanges[0].split('.').slice(0, 2).join('.');

        if (baseOctets === providerOctets) {
          if (provider.confidence > bestConfidence) {
            bestMatch = provider.name;
            bestConfidence = provider.confidence;
          }
        }
      }

      if (bestMatch) {
        results[typeKey] = {
          matched: true,
          provider: bestMatch,
          confidence: bestConfidence
        };
      }
    }

    // Return most confident match
    let maxConfidence = 0;
    let winnerType = null;

    for (const [typeKey, match] of Object.entries(results)) {
      if (match.confidence > maxConfidence) {
        maxConfidence = match.confidence;
        winnerType = typeKey;
      }
    }

    return {
      method: 'pattern-matching',
      detectedType: winnerType,
      confidence: maxConfidence,
      allMatches: results
    };
  }

  /**
   * Analyze WHOIS data
   */
  analyzeWhoisData(ipAddress, whoisData = {}) {
    if (!whoisData || !whoisData.organization) {
      return {
        method: 'whois-analysis',
        detectedType: null,
        confidence: 0,
        reason: 'no-whois-data'
      };
    }

    const org = whoisData.organization.toLowerCase();

    // Check against known patterns
    const patterns = {
      residential: /isp|internet service|telecom|cable|wireless/i,
      datacenter: /amazon|google|microsoft|digitalocean|linode|aws|cloud|vps|hosting/i,
      vpn: /vpn|privacy|security|proxy|anonymous|cyberghost|nordvpn|expressvpn/i,
      mobile: /mobile|carrier|cellular|wireless|telecom|roaming/i
    };

    for (const [typeKey, pattern] of Object.entries(patterns)) {
      if (pattern.test(org)) {
        return {
          method: 'whois-analysis',
          detectedType: typeKey,
          confidence: 0.85,
          organization: org
        };
      }
    }

    return {
      method: 'whois-analysis',
      detectedType: null,
      confidence: 0,
      organization: org
    };
  }

  /**
   * Analyze behavioral signals
   */
  analyzeBehavioralSignals(signals = {}) {
    const results = {
      method: 'behavioral-analysis',
      indicators: {},
      detectedType: null,
      confidence: 0
    };

    // Latency pattern
    if (signals.latency) {
      if (signals.latency < 100) {
        results.indicators.latency = 'datacenter';
      } else if (signals.latency < 300) {
        results.indicators.latency = 'residential';
      } else {
        results.indicators.latency = 'mobile';
      }
    }

    // Request pattern consistency
    if (signals.requestConsistency !== undefined) {
      if (signals.requestConsistency < 0.5) {
        results.indicators.consistency = 'residential-or-mobile';
      } else {
        results.indicators.consistency = 'datacenter';
      }
    }

    // User agent diversity
    if (signals.userAgentDiversity !== undefined) {
      if (signals.userAgentDiversity > 0.7) {
        results.indicators.userAgents = 'residential-or-mobile';
      } else {
        results.indicators.userAgents = 'datacenter';
      }
    }

    return results;
  }

  /**
   * Analyze ASN (Autonomous System Number)
   */
  analyzeASN(asn = null) {
    if (!asn) {
      return {
        method: 'asn-analysis',
        detectedType: null,
        confidence: 0
      };
    }

    const asn_str = asn.toString();

    // Known ASN patterns
    const patterns = {
      datacenter: [16509, 15169, 8994, 14061], // AWS, Google, DigitalOcean, Linode ASNs
      vpn: [61175, 206480, 211571], // Common VPN provider ASNs
      residential: [] // Varies by ISP
    };

    for (const [typeKey, asns] of Object.entries(patterns)) {
      if (asns.includes(parseInt(asn_str))) {
        return {
          method: 'asn-analysis',
          detectedType: typeKey,
          confidence: 0.90,
          asn: asn_str
        };
      }
    }

    return {
      method: 'asn-analysis',
      detectedType: null,
      confidence: 0,
      asn: asn_str
    };
  }

  /**
   * Analyze reverse DNS
   */
  analyzeReverseDns(reverseDns = null) {
    if (!reverseDns) {
      return {
        method: 'reverse-dns-analysis',
        detectedType: null,
        confidence: 0
      };
    }

    const patterns = {
      datacenter: /ec2|compute|cloudflare|amazonaws|googlecloud|azure/i,
      vpn: /vpn|proxy|secure|anonymous/i,
      residential: /ppp|dial|dynamic|residential/i,
      mobile: /mobile|carrier|cellular|tata|airtel/i
    };

    for (const [typeKey, pattern] of Object.entries(patterns)) {
      if (pattern.test(reverseDns)) {
        return {
          method: 'reverse-dns-analysis',
          detectedType: typeKey,
          confidence: 0.80,
          reverseDns
        };
      }
    }

    return {
      method: 'reverse-dns-analysis',
      detectedType: null,
      confidence: 0,
      reverseDns
    };
  }

  /**
   * Aggregate detection signals with weighted voting
   */
  aggregateDetectionSignals(signals) {
    const votes = {};
    const weights = {
      'pattern-matching': 0.30,
      'asn-analysis': 0.25,
      'whois-analysis': 0.20,
      'reverse-dns-analysis': 0.15,
      'behavioral-analysis': 0.10
    };

    // Cast weighted votes
    for (const [method, weight] of Object.entries(weights)) {
      const signal = signals[method];
      if (signal && signal.detectedType) {
        const typeKey = signal.detectedType;
        votes[typeKey] = (votes[typeKey] || 0) + (signal.confidence * weight);
      }
    }

    // Find winner
    let winner = null;
    let maxScore = 0;
    const totalScore = Object.values(votes).reduce((a, b) => a + b, 0);

    for (const [typeKey, score] of Object.entries(votes)) {
      if (score > maxScore) {
        maxScore = score;
        winner = typeKey;
      }
    }

    return {
      winner,
      confidence: totalScore > 0 ? maxScore / totalScore : 0,
      allVotes: votes
    };
  }

  /**
   * Assess detection risk for proxy type
   */
  assessDetectionRisk(proxyType, additionalSignals = {}) {
    const typeConfig = this.providerPatterns[proxyType];

    if (!typeConfig) {
      return {
        proxyType: 'unknown',
        riskScore: 5,
        riskLevel: 'medium',
        detectionDifficulty: 'unknown'
      };
    }

    // Adjust risk based on additional signals
    let riskScore = typeConfig.riskScore;

    // Reputation impact
    if (additionalSignals.abuseReports > 5) {
      riskScore += 2;
    }

    // Age impact (older IPs are riskier)
    if (additionalSignals.ipAge && additionalSignals.ipAge > 365 * 5) {
      riskScore += 1;
    }

    return {
      proxyType,
      riskScore: Math.min(10, riskScore),
      riskLevel: this.calculateRiskLevel(riskScore),
      detectionDifficulty: typeConfig.detectionDifficulty,
      evasionRating: this.calculateEvasionRating(proxyType),
      recommendations: this.getEvasionRecommendations(proxyType)
    };
  }

  /**
   * Calculate risk level from score
   */
  calculateRiskLevel(score) {
    if (score <= 2) {
      return 'very-low';
    }
    if (score <= 4) {
      return 'low';
    }
    if (score <= 6) {
      return 'medium';
    }
    if (score <= 8) {
      return 'high';
    }
    return 'critical';
  }

  /**
   * Calculate evasion rating (how good this proxy is at evading detection)
   */
  calculateEvasionRating(proxyType) {
    const ratings = {
      'residential': 0.95,
      'mobile': 0.98,
      'datacenter': 0.30,
      'vpn': 0.20
    };

    return ratings[proxyType] || 0.50;
  }

  /**
   * Get evasion recommendations for proxy type
   */
  getEvasionRecommendations(proxyType) {
    const recommendations = {
      'residential': [
        'Excellent for general use',
        'Rotate user agents frequently',
        'Vary request timing patterns',
        'Best for sensitive operations'
      ],
      'mobile': [
        'Highest evasion effectiveness',
        'Realistic mobile behavior patterns',
        'Best for strict geo-fencing',
        'Ideal for authentication flows'
      ],
      'datacenter': [
        'High detection risk',
        'Use for non-sensitive operations',
        'Combine with behavioral AI',
        'Rotate every 10-20 requests'
      ],
      'vpn': [
        'Very high detection risk',
        'Easily identifiable',
        'Last resort option',
        'Use only for clearnet fallback'
      ]
    };

    return recommendations[proxyType] || [];
  }

  /**
   * Recommend proxy type for use case
   */
  recommendProxyType(useCase = 'general') {
    const recommendations = {
      'general': 'residential',
      'sensitive': 'mobile',
      'competitor-monitoring': 'residential',
      'content-scraping': 'datacenter',
      'fast-rotation': 'datacenter',
      'geo-strict': 'mobile'
    };

    return recommendations[useCase] || 'residential';
  }

  /**
   * Get detection accuracy statistics
   */
  getDetectionAccuracy() {
    const accuracy = {};

    for (const [typeKey, stats] of this.detectionAccuracy) {
      const correctRate = stats.total > 0
        ? (stats.correct / stats.total * 100).toFixed(1)
        : 0;

      accuracy[typeKey] = {
        correctDetections: stats.correct,
        totalDetections: stats.total,
        accuracyRate: parseFloat(correctRate)
      };
    }

    return accuracy;
  }

  /**
   * Record detection for accuracy tracking
   */
  recordDetectionAccuracy(detectedType, actualType) {
    if (!this.detectionAccuracy.has(detectedType)) {
      this.detectionAccuracy.set(detectedType, { correct: 0, total: 0 });
    }

    const stats = this.detectionAccuracy.get(detectedType);
    stats.total++;

    if (detectedType === actualType) {
      stats.correct++;
    }
  }
}

module.exports = ProviderDetector;
