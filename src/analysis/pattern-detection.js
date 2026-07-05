/**
 * Pattern Detection & Data Correlation Engine
 *
 * Provides advanced analysis capabilities:
 * - Similarity analysis (find_similar_elements)
 * - Pattern extraction (detect_patterns)
 * - Data correlation (correlate_data)
 * - Relationship visualization (build_link_graph)
 * - Text analytics (text_analytics)
 * - Anomaly detection (anomaly_detection)
 * - Data clustering (cluster_data)
 * - Automatic insights (generate_insights)
 *
 * @module analysis/pattern-detection
 */

class PatternDetectionEngine {
  constructor(options = {}) {
    this.options = {
      similarityThreshold: options.similarityThreshold || 0.7,
      patternMinOccurrence: options.patternMinOccurrence || 3,
      anomalyDeviation: options.anomalyDeviation || 2.5,
      clusteringThreshold: options.clusteringThreshold || 0.8,
      maxPatterns: options.maxPatterns || 100,
      maxInsights: options.maxInsights || 10,
      ...options
    };

    this.cache = new Map();
    this.patterns = new Map();
    this.correlations = new Map();
  }

  /**
   * Find similar elements in dataset
   * @param {Array} elements - Elements to analyze
   * @param {string} field - Field to compare
   * @param {number} threshold - Similarity threshold (0-1)
   * @returns {Array} Grouped similar elements
   */
  findSimilarElements(elements, field, threshold = null) {
    if (!Array.isArray(elements) || elements.length === 0) {
      return [];
    }

    threshold = threshold || this.options.similarityThreshold;
    const groups = [];
    const processed = new Set();

    elements.forEach((element, idx) => {
      if (processed.has(idx)) return;

      const group = [element];
      processed.add(idx);

      const reference = this._extractFieldValue(element, field);
      if (reference === null) return;

      elements.forEach((other, otherIdx) => {
        if (idx !== otherIdx && !processed.has(otherIdx)) {
          const otherValue = this._extractFieldValue(other, field);
          const similarity = this._calculateSimilarity(reference, otherValue);

          if (similarity >= threshold) {
            group.push(other);
            processed.add(otherIdx);
          }
        }
      });

      groups.push({
        similarity: threshold,
        count: group.length,
        elements: group,
        representative: group[0]
      });
    });

    return groups.sort((a, b) => b.count - a.count);
  }

  /**
   * Detect patterns in data
   * @param {Array} data - Data to analyze
   * @param {Object} options - Detection options
   * @returns {Array} Detected patterns
   */
  detectPatterns(data, options = {}) {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    const minOccurrence = options.minOccurrence || this.options.patternMinOccurrence;
    const patterns = [];
    const patternMap = new Map();

    // Detect sequential patterns
    this._detectSequentialPatterns(data, minOccurrence, patternMap);

    // Detect structural patterns
    this._detectStructuralPatterns(data, minOccurrence, patternMap);

    // Convert to result format
    patternMap.forEach((pattern, key) => {
      if (pattern.occurrences >= minOccurrence) {
        patterns.push({
          id: key,
          type: pattern.type,
          pattern: pattern.pattern,
          occurrences: pattern.occurrences,
          confidence: Math.min(1, pattern.occurrences / Math.max(data.length, 1)),
          examples: pattern.examples && pattern.examples.length > 0
            ? pattern.examples.slice(0, 3)
            : []
        });
      }
    });

    return patterns
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.options.maxPatterns);
  }

  /**
   * Correlate data across multiple datasets
   * @param {Object} datasets - Named datasets to correlate
   * @param {Object} options - Correlation options
   * @returns {Object} Correlation results
   */
  correlateData(datasets, options = {}) {
    const results = {
      correlations: [],
      strongLinks: [],
      weakLinks: [],
      correlationMatrix: {},
      summary: {}
    };

    const datasetNames = Object.keys(datasets);
    if (datasetNames.length < 2) {
      return results;
    }

    // Build correlation matrix
    for (let i = 0; i < datasetNames.length; i++) {
      for (let j = i + 1; j < datasetNames.length; j++) {
        const name1 = datasetNames[i];
        const name2 = datasetNames[j];
        const data1 = datasets[name1];
        const data2 = datasets[name2];

        const correlation = this._computeCorrelation(data1, data2, options);
        const matrixKey = `${name1}-${name2}`;

        results.correlationMatrix[matrixKey] = correlation.strength;
        results.correlations.push({
          dataset1: name1,
          dataset2: name2,
          strength: correlation.strength,
          commonElements: correlation.commonElements,
          commonValues: correlation.commonValues,
          sharedPatterns: correlation.sharedPatterns
        });

        if (correlation.strength >= 0.7) {
          results.strongLinks.push({
            dataset1: name1,
            dataset2: name2,
            strength: correlation.strength
          });
        } else if (correlation.strength > 0.3) {
          results.weakLinks.push({
            dataset1: name1,
            dataset2: name2,
            strength: correlation.strength
          });
        }
      }
    }

    // Summary statistics
    results.summary = {
      totalDatasets: datasetNames.length,
      strongCorrelations: results.strongLinks.length,
      weakCorrelations: results.weakLinks.length,
      averageCorrelation: results.correlations.length > 0
        ? results.correlations.reduce((sum, c) => sum + c.strength, 0) / results.correlations.length
        : 0
    };

    return results;
  }

  /**
   * Build link graph from data
   * @param {Array} elements - Elements with relationships
   * @param {string} idField - Field containing element IDs
   * @param {string} relationField - Field containing relationships
   * @returns {Object} Graph structure
   */
  buildLinkGraph(elements, idField, relationField) {
    const graph = {
      nodes: [],
      edges: [],
      adjacencyList: {},
      stats: {
        nodeCount: 0,
        edgeCount: 0,
        density: 0,
        avgDegree: 0
      }
    };

    if (!Array.isArray(elements) || elements.length === 0) {
      return graph;
    }

    const nodeMap = new Map();
    const edgeSet = new Set();

    // First pass: collect all node IDs (both sources and targets)
    const allIds = new Set();
    elements.forEach((element) => {
      const id = this._extractFieldValue(element, idField);
      if (id !== null) {
        allIds.add(id);
      }

      const relations = this._extractFieldValue(element, relationField);
      if (Array.isArray(relations)) {
        relations.forEach(r => {
          if (r !== null) allIds.add(r);
        });
      } else if (relations !== null) {
        allIds.add(relations);
      }
    });

    // Create nodes for all IDs
    allIds.forEach((id) => {
      const node = {
        id: String(id),
        label: String(id),
        data: null,
        degree: 0
      };
      nodeMap.set(id, node);
      graph.nodes.push(node);
      graph.adjacencyList[String(id)] = [];
    });

    // Create edges
    elements.forEach((element) => {
      const sourceId = this._extractFieldValue(element, idField);
      if (sourceId === null) return;

      const sourceIdStr = String(sourceId);
      const relations = this._extractFieldValue(element, relationField);

      if (Array.isArray(relations)) {
        relations.forEach((target) => {
          if (target !== null) {
            const targetId = String(target);
            if (nodeMap.has(target)) {
              const edgeKey = `${sourceIdStr}->${targetId}`;
              if (!edgeSet.has(edgeKey)) {
                graph.edges.push({
                  source: sourceIdStr,
                  target: targetId,
                  weight: 1
                });
                graph.adjacencyList[sourceIdStr].push(targetId);
                edgeSet.add(edgeKey);

                const sourceNode = nodeMap.get(sourceId);
                if (sourceNode) sourceNode.degree++;
              }
            }
          }
        });
      } else if (relations !== null) {
        const targetId = String(relations);
        if (nodeMap.has(relations)) {
          const edgeKey = `${sourceIdStr}->${targetId}`;
          if (!edgeSet.has(edgeKey)) {
            graph.edges.push({
              source: sourceIdStr,
              target: targetId,
              weight: 1
            });
            graph.adjacencyList[sourceIdStr].push(targetId);
            edgeSet.add(edgeKey);

            const sourceNode = nodeMap.get(sourceId);
            if (sourceNode) sourceNode.degree++;
          }
        }
      }
    });

    // Calculate statistics
    graph.stats.nodeCount = graph.nodes.length;
    graph.stats.edgeCount = graph.edges.length;
    graph.stats.avgDegree = graph.nodes.length > 0
      ? graph.nodes.reduce((sum, n) => sum + n.degree, 0) / graph.nodes.length
      : 0;
    graph.stats.density = (graph.nodes.length > 1)
      ? graph.edges.length / (graph.nodes.length * (graph.nodes.length - 1))
      : 0;

    return graph;
  }

  /**
   * Text analytics - analyze text content
   * @param {string|Array} text - Text or texts to analyze
   * @param {Object} options - Analysis options
   * @returns {Object} Text analysis results
   */
  textAnalytics(text, options = {}) {
    const texts = Array.isArray(text) ? text : [text];
    const combined = texts.join(' ');

    const results = {
      wordFrequency: {},
      phraseFrequency: {},
      statistics: {
        totalWords: 0,
        uniqueWords: 0,
        averageWordLength: 0,
        textLength: combined.length,
        textCount: texts.length
      },
      sentiment: {
        positive: 0,
        negative: 0,
        neutral: 0
      },
      entities: {
        numbers: [],
        urls: [],
        emails: [],
        mentions: []
      }
    };

    // Word frequency
    const words = combined.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0);

    results.statistics.totalWords = words.length;

    const wordMap = new Map();
    words.forEach(word => {
      wordMap.set(word, (wordMap.get(word) || 0) + 1);
    });

    results.statistics.uniqueWords = wordMap.size;
    results.statistics.averageWordLength = words.length > 0
      ? words.reduce((sum, w) => sum + w.length, 0) / words.length
      : 0;

    // Top words
    Array.from(wordMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .forEach(([word, count]) => {
        results.wordFrequency[word] = count;
      });

    // Phrases (2-3 word sequences)
    const phraseMap = new Map();
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = words.slice(i, i + 2).join(' ');
      phraseMap.set(phrase, (phraseMap.get(phrase) || 0) + 1);
    }

    Array.from(phraseMap.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([phrase, count]) => {
        results.phraseFrequency[phrase] = count;
      });

    // Entity extraction
    const urlPattern = /https?:\/\/[^\s]+/gi;
    const emailPattern = /[^\s@]+@[^\s@]+\.[^\s@]+/gi;
    const numberPattern = /\b\d+\b/g;
    const mentionPattern = /@\w+/g;

    results.entities.urls = combined.match(urlPattern) || [];
    results.entities.emails = combined.match(emailPattern) || [];
    results.entities.numbers = combined.match(numberPattern) || [];
    results.entities.mentions = combined.match(mentionPattern) || [];

    // Basic sentiment (simple word matching)
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'perfect', 'awesome'];
    const negativeWords = ['bad', 'terrible', 'awful', 'poor', 'horrible', 'worst'];

    results.sentiment.positive = positiveWords.filter(w =>
      results.wordFrequency[w] ? results.wordFrequency[w] : 0
    ).reduce((sum, w) => sum + (results.wordFrequency[w] || 0), 0);

    results.sentiment.negative = negativeWords.filter(w =>
      results.wordFrequency[w] ? results.wordFrequency[w] : 0
    ).reduce((sum, w) => sum + (results.wordFrequency[w] || 0), 0);

    results.sentiment.neutral = results.statistics.totalWords -
      results.sentiment.positive - results.sentiment.negative;

    return results;
  }

  /**
   * Detect anomalies in numerical data
   * @param {Array} data - Data to analyze
   * @param {string} field - Field to check for anomalies
   * @param {Object} options - Detection options
   * @returns {Object} Anomaly detection results
   */
  anomalyDetection(data, field, options = {}) {
    if (!Array.isArray(data) || data.length === 0) {
      return { anomalies: [], statistics: {} };
    }

    // Extract all values with their original indices
    const valuesList = data.map((item, idx) => ({
      value: this._extractFieldValue(item, field),
      index: idx,
      item: item
    })).filter(v => typeof v.value === 'number' && !isNaN(v.value));

    if (valuesList.length === 0) {
      return { anomalies: [], statistics: {} };
    }

    const values = valuesList.map(v => v.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const deviation = options.deviation || this.options.anomalyDeviation;

    const anomalies = [];
    const upperBound = mean + (deviation * stdDev);
    const lowerBound = mean - (deviation * stdDev);

    valuesList.forEach((item) => {
      const value = item.value;
      if (value > upperBound || value < lowerBound) {
        anomalies.push({
          index: item.index,
          value: value,
          deviation: stdDev > 0 ? (value - mean) / stdDev : 0,
          reason: value > upperBound ? 'above_upper_bound' : 'below_lower_bound',
          data: item.item
        });
      }
    });

    return {
      anomalies: anomalies.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation)),
      statistics: {
        mean,
        stdDev,
        variance,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
        anomalyCount: anomalies.length,
        anomalyPercentage: values.length > 0 ? (anomalies.length / values.length) * 100 : 0
      }
    };
  }

  /**
   * Cluster similar data points
   * @param {Array} data - Data to cluster
   * @param {string} field - Field to cluster on
   * @param {Object} options - Clustering options
   * @returns {Array} Clusters
   */
  clusterData(data, field, options = {}) {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    const threshold = options.threshold || this.options.clusteringThreshold;
    const clusters = [];
    const assigned = new Set();

    data.forEach((item, idx) => {
      if (assigned.has(idx)) return;

      const cluster = [item];
      assigned.add(idx);
      const reference = this._extractFieldValue(item, field);

      data.forEach((other, otherIdx) => {
        if (idx !== otherIdx && !assigned.has(otherIdx)) {
          const otherValue = this._extractFieldValue(other, field);
          const similarity = this._calculateSimilarity(reference, otherValue);

          if (similarity >= threshold) {
            cluster.push(other);
            assigned.add(otherIdx);
          }
        }
      });

      clusters.push({
        id: clusters.length,
        size: cluster.length,
        representative: cluster[0],
        members: cluster,
        centroid: reference
      });
    });

    return clusters.sort((a, b) => b.size - a.size);
  }

  /**
   * Generate automatic insights from analysis
   * @param {Object} analysisResults - Results from various analyses
   * @returns {Array} Generated insights
   */
  generateInsights(analysisResults) {
    const insights = [];

    // Similarity insights
    if (analysisResults.similarElements) {
      const largeGroups = analysisResults.similarElements
        .filter(g => g.count >= 3)
        .slice(0, 2);
      largeGroups.forEach(group => {
        insights.push({
          type: 'similarity',
          severity: 'info',
          title: `Found ${group.count} similar elements`,
          description: `Detected ${group.count} elements with ${(group.similarity * 100).toFixed(0)}% similarity`,
          actionable: true,
          suggestion: 'Review consolidated elements for redundancy'
        });
      });
    }

    // Pattern insights
    if (analysisResults.patterns) {
      const topPatterns = analysisResults.patterns
        .filter(p => p.confidence >= 0.5)
        .slice(0, 2);
      topPatterns.forEach(pattern => {
        insights.push({
          type: 'pattern',
          severity: 'info',
          title: `Detected ${pattern.type} pattern`,
          description: `Pattern occurs ${pattern.occurrences} times with ${(pattern.confidence * 100).toFixed(0)}% confidence`,
          actionable: true,
          suggestion: 'Review pattern examples for consistency'
        });
      });
    }

    // Correlation insights
    if (analysisResults.correlations && analysisResults.correlations.strongLinks) {
      analysisResults.correlations.strongLinks.slice(0, 2).forEach(link => {
        insights.push({
          type: 'correlation',
          severity: 'warning',
          title: `Strong correlation detected`,
          description: `${link.dataset1} and ${link.dataset2} show ${(link.strength * 100).toFixed(0)}% correlation`,
          actionable: true,
          suggestion: 'Investigate relationship between datasets'
        });
      });
    }

    // Anomaly insights
    if (analysisResults.anomalies && analysisResults.anomalies.anomalies) {
      const anomalyCount = analysisResults.anomalies.anomalies.length;
      if (anomalyCount > 0) {
        insights.push({
          type: 'anomaly',
          severity: anomalyCount > 5 ? 'warning' : 'info',
          title: `Detected ${anomalyCount} anomalies`,
          description: `Found ${anomalyCount} unusual values (${(analysisResults.anomalies.statistics.anomalyPercentage || 0).toFixed(2)}%)`,
          actionable: true,
          suggestion: 'Review anomalous values for data quality issues'
        });
      }
    }

    return insights.slice(0, this.options.maxInsights);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.patterns.clear();
    this.correlations.clear();
  }

  // ============ PRIVATE METHODS ============

  /**
   * Extract value from nested field
   * @private
   */
  _extractFieldValue(obj, field) {
    if (!obj || !field) return null;
    if (typeof field === 'string' && field.includes('.')) {
      return field.split('.').reduce((val, key) => val?.[key], obj);
    }
    return obj[field];
  }

  /**
   * Calculate similarity between two values
   * @private
   */
  _calculateSimilarity(val1, val2) {
    if (val1 === val2) return 1;
    if (typeof val1 !== typeof val2) return 0;

    if (typeof val1 === 'string') {
      return this._stringSimilarity(String(val1), String(val2));
    }

    if (typeof val1 === 'number') {
      const diff = Math.abs(val1 - val2);
      const avg = (Math.abs(val1) + Math.abs(val2)) / 2;
      return avg === 0 ? 1 : Math.max(0, 1 - (diff / avg));
    }

    return 0;
  }

  /**
   * Calculate string similarity (Levenshtein-based)
   * @private
   */
  _stringSimilarity(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1;

    const editDistance = this._levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   * @private
   */
  _levenshteinDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  /**
   * Detect sequential patterns
   * @private
   */
  _detectSequentialPatterns(data, minOccurrence, patternMap) {
    if (data.length < minOccurrence) return;

    // Focus on finding repeated subsequences
    for (let len = 1; len <= Math.min(3, Math.floor(data.length / minOccurrence)); len++) {
      for (let i = 0; i <= data.length - len; i++) {
        const sequence = data.slice(i, i + len);
        const key = `seq:${JSON.stringify(sequence)}`;

        if (!patternMap.has(key)) {
          patternMap.set(key, {
            type: 'sequential',
            pattern: sequence,
            occurrences: 0,
            examples: []
          });
        }

        const pattern = patternMap.get(key);
        pattern.occurrences++;
        if (pattern.examples.length < 3) {
          pattern.examples.push({ start: i, data: sequence });
        }
      }
    }
  }

  /**
   * Detect structural patterns
   * @private
   */
  _detectStructuralPatterns(data, minOccurrence, patternMap) {
    if (data.length < minOccurrence) return;

    data.forEach((item, idx) => {
      if (typeof item === 'object') {
        const keys = Object.keys(item).sort();
        const structure = keys.join('|');
        const key = `struct:${structure}`;

        if (!patternMap.has(key)) {
          patternMap.set(key, {
            type: 'structural',
            pattern: { keys },
            occurrences: 0,
            examples: []
          });
        }

        const pattern = patternMap.get(key);
        pattern.occurrences++;
        if (pattern.examples.length < 3) {
          pattern.examples.push({ index: idx, data: item });
        }
      }
    });
  }

  /**
   * Compute correlation between two datasets
   * @private
   */
  _computeCorrelation(data1, data2, options) {
    const result = {
      strength: 0,
      commonElements: 0,
      commonValues: 0,
      sharedPatterns: 0
    };

    if (!Array.isArray(data1) || !Array.isArray(data2)) {
      return result;
    }

    // Find common values
    const set1 = new Set(data1.map(d => JSON.stringify(d)));
    const set2 = new Set(data2.map(d => JSON.stringify(d)));

    const common = Array.from(set1).filter(v => set2.has(v));
    result.commonElements = common.length;

    // Find shared patterns
    const flatData1 = data1.flat();
    const flatData2 = data2.flat();
    const flatSet1 = new Set(flatData1.map(d => String(d)));
    const flatSet2 = new Set(flatData2.map(d => String(d)));

    const commonFlat = Array.from(flatSet1).filter(v => flatSet2.has(v));
    result.commonValues = commonFlat.length;
    result.sharedPatterns = Math.min(result.commonElements, result.commonValues);

    // Calculate strength
    const maxSize = Math.max(set1.size, set2.size);
    result.strength = maxSize > 0 ? result.commonElements / maxSize : 0;

    return result;
  }
}

module.exports = PatternDetectionEngine;
