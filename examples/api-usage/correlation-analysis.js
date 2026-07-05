/**
 * Data Correlation & Pattern Detection - Example Usage
 *
 * This file demonstrates how to use the 8 new analysis commands
 * for data correlation, pattern detection, and insights generation.
 *
 * @example
 * node examples/correlation-analysis.js
 */

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:8765';

// ============================================================
// Example 1: Find Similar Elements
// ============================================================
async function example1_findSimilarElements() {
  console.log('\n=== Example 1: Find Similar Elements ===\n');

  const products = [
    { id: 1, name: 'iPhone 13 Pro', price: 999, category: 'Electronics' },
    { id: 2, name: 'iPhone 13 Pro', price: 999, category: 'Electronics' },
    { id: 3, name: 'iPhone 13', price: 799, category: 'Electronics' },
    { id: 4, name: 'Samsung Galaxy S21', price: 899, category: 'Electronics' },
    { id: 5, name: 'Samsung Galaxy S21', price: 899, category: 'Electronics' }
  ];

  const ws = new WebSocket(WS_URL);

  await new Promise((resolve) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({
        command: 'find_similar_elements',
        params: {
          data: products,
          field: 'name',
          threshold: 0.95
        }
      }));
    });

    ws.on('message', (data) => {
      const response = JSON.parse(data);
      console.log('Similar Groups Found:');
      response.groups.forEach((group, idx) => {
        console.log(`  Group ${idx + 1}: ${group.count} similar items`);
        console.log(`    Representative: ${JSON.stringify(group.representative)}`);
      });
      console.log(`Summary: ${response.summary.groupsFound} groups found`);
      ws.close();
      resolve();
    });
  });
}

// ============================================================
// Example 2: Detect Patterns
// ============================================================
async function example2_detectPatterns() {
  console.log('\n=== Example 2: Detect Patterns ===\n');

  const userActions = [
    { action: 'login', timestamp: '10:00' },
    { action: 'navigate', timestamp: '10:01' },
    { action: 'click', timestamp: '10:02' },
    { action: 'login', timestamp: '10:30' },
    { action: 'navigate', timestamp: '10:31' },
    { action: 'click', timestamp: '10:32' },
    { action: 'logout', timestamp: '11:00' }
  ];

  const ws = new WebSocket(WS_URL);

  await new Promise((resolve) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({
        command: 'detect_patterns',
        params: {
          data: userActions.map(a => a.action),
          options: { minOccurrence: 2 }
        }
      }));
    });

    ws.on('message', (data) => {
      const response = JSON.parse(data);
      console.log('Patterns Detected:');
      response.patterns.forEach((pattern, idx) => {
        console.log(`  Pattern ${idx + 1}: ${pattern.type}`);
        console.log(`    Occurrences: ${pattern.occurrences}`);
        console.log(`    Confidence: ${(pattern.confidence * 100).toFixed(2)}%`);
      });
      ws.close();
      resolve();
    });
  });
}

// ============================================================
// Example 3: Correlate Data
// ============================================================
async function example3_correlateData() {
  console.log('\n=== Example 3: Correlate Data ===\n');

  const datasets = {
    website_traffic: [100, 150, 200, 175, 180, 220, 210],
    sales_revenue: [50, 75, 100, 90, 95, 110, 105],
    marketing_spend: [10, 15, 20, 18, 20, 25, 22]
  };

  const ws = new WebSocket(WS_URL);

  await new Promise((resolve) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({
        command: 'correlate_data',
        params: {
          datasets: datasets
        }
      }));
    });

    ws.on('message', (data) => {
      const response = JSON.parse(data);
      console.log('Correlations Found:');
      response.correlations.forEach(corr => {
        console.log(`  ${corr.dataset1} <-> ${corr.dataset2}`);
        console.log(`    Strength: ${(corr.strength * 100).toFixed(2)}%`);
      });
      console.log(`\nStrong Links: ${response.strongLinks.length}`);
      console.log(`Weak Links: ${response.weakLinks.length}`);
      ws.close();
      resolve();
    });
  });
}

// ============================================================
// Example 4: Build Link Graph
// ============================================================
async function example4_buildLinkGraph() {
  console.log('\n=== Example 4: Build Link Graph ===\n');

  const users = [
    { userId: 'alice', follows: 'bob' },
    { userId: 'bob', follows: 'charlie' },
    { userId: 'charlie', follows: 'alice' },
    { userId: 'alice', follows: 'charlie' },
    { userId: 'dave', follows: 'eve' },
    { userId: 'eve', follows: 'dave' }
  ];

  const ws = new WebSocket(WS_URL);

  await new Promise((resolve) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({
        command: 'build_link_graph',
        params: {
          data: users,
          idField: 'userId',
          relationField: 'follows'
        }
      }));
    });

    ws.on('message', (data) => {
      const response = JSON.parse(data);
      console.log('Graph Statistics:');
      console.log(`  Nodes: ${response.stats.nodeCount}`);
      console.log(`  Edges: ${response.stats.edgeCount}`);
      console.log(`  Density: ${response.stats.density.toFixed(4)}`);
      console.log(`  Average Degree: ${response.stats.avgDegree.toFixed(2)}`);
      console.log('\nNodes:');
      response.nodes.slice(0, 3).forEach(node => {
        console.log(`  ${node.id} (degree: ${node.degree})`);
      });
      ws.close();
      resolve();
    });
  });
}

// ============================================================
// Example 5: Text Analytics
// ============================================================
async function example5_textAnalytics() {
  console.log('\n=== Example 5: Text Analytics ===\n');

  const reviews = [
    'This product is amazing and excellent quality!',
    'Great service and fast shipping, very happy',
    'Terrible quality, poor customer support',
    'Awful experience, would not recommend'
  ];

  const ws = new WebSocket(WS_URL);

  await new Promise((resolve) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({
        command: 'text_analytics',
        params: {
          text: reviews
        }
      }));
    });

    ws.on('message', (data) => {
      const response = JSON.parse(data);
      console.log('Text Statistics:');
      console.log(`  Total Words: ${response.statistics.totalWords}`);
      console.log(`  Unique Words: ${response.statistics.uniqueWords}`);
      console.log(`  Avg Word Length: ${response.statistics.averageWordLength.toFixed(2)}`);
      console.log('\nTop 5 Words:');
      Object.entries(response.wordFrequency)
        .slice(0, 5)
        .forEach(([word, count]) => {
          console.log(`  "${word}": ${count}`);
        });
      console.log('\nSentiment:');
      console.log(`  Positive: ${response.sentiment.positive}`);
      console.log(`  Negative: ${response.sentiment.negative}`);
      console.log(`  Neutral: ${response.sentiment.neutral}`);
      ws.close();
      resolve();
    });
  });
}

// ============================================================
// Example 6: Anomaly Detection
// ============================================================
async function example6_anomalyDetection() {
  console.log('\n=== Example 6: Anomaly Detection ===\n');

  const transactions = [
    { id: 1, amount: 100, timestamp: '2024-01-01' },
    { id: 2, amount: 105, timestamp: '2024-01-02' },
    { id: 3, amount: 95, timestamp: '2024-01-03' },
    { id: 4, amount: 98, timestamp: '2024-01-04' },
    { id: 5, amount: 5000, timestamp: '2024-01-05' }, // Anomaly
    { id: 6, amount: 102, timestamp: '2024-01-06' }
  ];

  const ws = new WebSocket(WS_URL);

  await new Promise((resolve) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({
        command: 'anomaly_detection',
        params: {
          data: transactions,
          field: 'amount',
          options: { deviation: 2.5 }
        }
      }));
    });

    ws.on('message', (data) => {
      const response = JSON.parse(data);
      console.log('Anomaly Detection Results:');
      console.log(`  Mean: $${response.statistics.mean.toFixed(2)}`);
      console.log(`  Std Dev: $${response.statistics.stdDev.toFixed(2)}`);
      console.log(`  Anomalies Found: ${response.statistics.anomalyCount}`);
      console.log(`  Anomaly Percentage: ${response.statistics.anomalyPercentage.toFixed(2)}%`);
      console.log('\nAnomalous Transactions:');
      response.anomalies.slice(0, 3).forEach(anomaly => {
        console.log(`  Transaction ${anomaly.index}: $${anomaly.value} (deviation: ${anomaly.deviation.toFixed(2)}σ)`);
      });
      ws.close();
      resolve();
    });
  });
}

// ============================================================
// Example 7: Cluster Data
// ============================================================
async function example7_clusterData() {
  console.log('\n=== Example 7: Cluster Data ===\n');

  const items = [
    { id: 1, category: 'Electronics', name: 'Laptop' },
    { id: 2, category: 'Electronics', name: 'Phone' },
    { id: 3, category: 'Electronics', name: 'Tablet' },
    { id: 4, category: 'Clothing', name: 'Shirt' },
    { id: 5, category: 'Clothing', name: 'Pants' },
    { id: 6, category: 'Home', name: 'Bed' }
  ];

  const ws = new WebSocket(WS_URL);

  await new Promise((resolve) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({
        command: 'cluster_data',
        params: {
          data: items,
          field: 'category',
          options: { threshold: 0.95 }
        }
      }));
    });

    ws.on('message', (data) => {
      const response = JSON.parse(data);
      console.log('Clustering Results:');
      console.log(`  Total Elements: ${response.summary.totalElements}`);
      console.log(`  Clusters Created: ${response.summary.clustersCreated}`);
      console.log(`  Largest Cluster: ${response.summary.largestCluster} items`);
      console.log(`  Avg Cluster Size: ${response.summary.averageClusterSize.toFixed(2)}`);
      console.log('\nClusters:');
      response.clusters.slice(0, 3).forEach((cluster, idx) => {
        console.log(`  Cluster ${cluster.id}: ${cluster.size} items (centroid: ${cluster.centroid})`);
      });
      ws.close();
      resolve();
    });
  });
}

// ============================================================
// Example 8: Generate Insights
// ============================================================
async function example8_generateInsights() {
  console.log('\n=== Example 8: Generate Insights ===\n');

  const analysisResults = {
    similarElements: [
      { count: 10, similarity: 0.92, elements: [] }
    ],
    patterns: [
      { type: 'sequential', confidence: 0.85, occurrences: 5, examples: [] },
      { type: 'structural', confidence: 0.70, occurrences: 3, examples: [] }
    ],
    correlations: {
      strongLinks: [
        { dataset1: 'traffic', dataset2: 'sales', strength: 0.88 }
      ]
    },
    anomalies: {
      anomalies: [
        { value: 5000, deviation: 3.2 },
        { value: 8000, deviation: 4.1 }
      ],
      statistics: { anomalyPercentage: 15 }
    }
  };

  const ws = new WebSocket(WS_URL);

  await new Promise((resolve) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({
        command: 'generate_insights',
        params: {
          analysisResults: analysisResults
        }
      }));
    });

    ws.on('message', (data) => {
      const response = JSON.parse(data);
      console.log('Generated Insights:');
      console.log(`  Total Insights: ${response.summary.totalInsights}`);
      console.log(`  Actionable: ${response.summary.actionableInsights}`);
      console.log('\nInsights by Category:');
      Object.entries(response.summary.byCategory).forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count}`);
      });
      console.log('\nTop Insights:');
      response.insights.slice(0, 3).forEach((insight, idx) => {
        console.log(`\n  ${idx + 1}. ${insight.title}`);
        console.log(`     Type: ${insight.type} | Severity: ${insight.severity}`);
        console.log(`     ${insight.description}`);
        console.log(`     Suggestion: ${insight.suggestion}`);
      });
      ws.close();
      resolve();
    });
  });
}

// ============================================================
// Main: Run All Examples
// ============================================================
async function main() {
  console.log('Data Correlation & Pattern Detection Examples');
  console.log('=============================================');

  try {
    await example1_findSimilarElements();
    await example2_detectPatterns();
    await example3_correlateData();
    await example4_buildLinkGraph();
    await example5_textAnalytics();
    await example6_anomalyDetection();
    await example7_clusterData();
    await example8_generateInsights();

    console.log('\n=== All Examples Completed ===\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  example1_findSimilarElements,
  example2_detectPatterns,
  example3_correlateData,
  example4_buildLinkGraph,
  example5_textAnalytics,
  example6_anomalyDetection,
  example7_clusterData,
  example8_generateInsights
};
