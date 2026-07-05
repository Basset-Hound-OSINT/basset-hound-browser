/**
 * Visualization Data Module - Data Formatting and Processing
 *
 * Handles:
 * - Time-series data formatting for charts
 * - Aggregation and downsampling
 * - Percentile calculations
 * - Heatmap generation
 * - Data normalization
 *
 * @module src/dashboards/visualization-data
 */

/**
 * Visualization Data Processor
 */
class VisualizationDataProcessor {
  constructor(options = {}) {
    this.options = {
      defaultBucketSize: options.defaultBucketSize || 60000,
      maxDataPoints: options.maxDataPoints || 1000,
      ...options
    };

    // Percentile buckets for distribution analysis
    this.percentileBuckets = [
      0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1.0
    ];
  }

  /**
   * Format time-series data for line chart
   */
  formatTimeSeriesForChart(data, options = {}) {
    const {
      timeField = 'timestamp',
      valueField = 'value',
      labelField = null,
      bucketSize = this.options.defaultBucketSize,
      aggregationType = 'avg'
    } = options;

    if (!data || data.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    // Group data into buckets
    const buckets = this.bucketizeData(data, bucketSize, timeField, valueField);
    const aggregated = this.aggregateBuckets(buckets, aggregationType);

    const labels = aggregated.map(item =>
      new Date(item.time).toLocaleTimeString()
    );

    const datasets = [
      {
        label: labelField || 'Value',
        data: aggregated.map(item => item.value),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointHoverRadius: 6
      }
    ];

    return { labels, datasets };
  }

  /**
   * Format multi-series data for comparison
   */
  formatMultiSeriesChart(dataSeries, options = {}) {
    const {
      timeField = 'timestamp',
      valueField = 'value',
      seriesField = 'series',
      bucketSize = this.options.defaultBucketSize,
      aggregationType = 'avg'
    } = options;

    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
      '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'
    ];

    // Group by series
    const grouped = {};
    dataSeries.forEach(item => {
      const series = item[seriesField] || 'default';
      if (!grouped[series]) {
        grouped[series] = [];
      }
      grouped[series].push(item);
    });

    // Get time labels from first series
    const firstSeries = Object.values(grouped)[0] || [];
    const buckets = this.bucketizeData(firstSeries, bucketSize, timeField, valueField);
    const labels = buckets.map(item =>
      new Date(item.time).toLocaleTimeString()
    );

    // Format datasets
    const datasets = Object.entries(grouped).map(([series, data], index) => {
      const seriesBuckets = this.bucketizeData(data, bucketSize, timeField, valueField);
      const aggregated = this.aggregateBuckets(seriesBuckets, aggregationType);

      return {
        label: series,
        data: aggregated.map(item => item.value),
        borderColor: colors[index % colors.length],
        backgroundColor: this.hexToRgba(colors[index % colors.length], 0.1),
        tension: 0.4,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 5
      };
    });

    return { labels, datasets };
  }

  /**
   * Format data for bar chart
   */
  formatBarChart(data, options = {}) {
    const {
      categoryField = 'category',
      valueField = 'value',
      colorField = null
    } = options;

    const labels = data.map(item => item[categoryField]);
    const values = data.map(item => item[valueField]);

    const colors = colorField
      ? data.map((item, index) => this.getCategoryColor(item[colorField], index))
      : '#3b82f6';

    return {
      labels,
      datasets: [
        {
          label: 'Value',
          data: values,
          backgroundColor: colors,
          borderColor: '#fff',
          borderWidth: 1
        }
      ]
    };
  }

  /**
   * Format data for pie/doughnut chart
   */
  formatPieChart(data, options = {}) {
    const {
      labelField = 'label',
      valueField = 'value'
    } = options;

    const labels = data.map(item => item[labelField]);
    const values = data.map(item => item[valueField]);

    const backgroundColor = labels.map((_, index) =>
      this.getCategoryColor('', index)
    );

    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor,
          borderColor: '#fff',
          borderWidth: 2
        }
      ]
    };
  }

  /**
   * Generate heatmap data
   */
  generateHeatmap(data, options = {}) {
    const {
      timeField = 'timestamp',
      categoryField = 'category',
      valueField = 'value',
      timeRange = 3600000,
      categoryCount = 10
    } = options;

    if (!data || data.length === 0) {
      return {
        xLabels: [],
        yLabels: [],
        data: []
      };
    }

    // Extract time range
    const sortedByTime = [...data].sort((a, b) =>
      a[timeField] - b[timeField]
    );
    const minTime = sortedByTime[0][timeField];
    const maxTime = sortedByTime[sortedByTime.length - 1][timeField];
    const actualRange = maxTime - minTime || timeRange;

    // Create time buckets
    const timeBucketSize = actualRange / 20;
    const timeBuckets = new Map();

    for (let i = 0; i < 20; i++) {
      const bucketTime = minTime + (i * timeBucketSize);
      timeBuckets.set(i, {
        time: bucketTime,
        categories: new Map()
      });
    }

    // Group data into buckets
    data.forEach(item => {
      const bucketIndex = Math.min(
        19,
        Math.floor((item[timeField] - minTime) / timeBucketSize)
      );
      const category = item[categoryField] || 'other';

      if (!timeBuckets.get(bucketIndex).categories.has(category)) {
        timeBuckets.get(bucketIndex).categories.set(category, 0);
      }

      const current = timeBuckets.get(bucketIndex).categories.get(category);
      timeBuckets.get(bucketIndex).categories.set(category, current + item[valueField]);
    });

    // Extract unique categories
    const categories = new Set();
    timeBuckets.forEach(bucket => {
      bucket.categories.forEach((_, cat) => categories.add(cat));
    });

    const yLabels = Array.from(categories).slice(0, categoryCount);
    const xLabels = Array.from(timeBuckets.values()).map(bucket =>
      new Date(bucket.time).toLocaleTimeString()
    );

    // Build heatmap data
    const heatmapData = [];
    Array.from(timeBuckets.entries()).forEach(([timeIndex, bucket]) => {
      yLabels.forEach((category, categoryIndex) => {
        const value = bucket.categories.get(category) || 0;
        heatmapData.push({
          x: timeIndex,
          y: categoryIndex,
          value
        });
      });
    });

    return {
      xLabels,
      yLabels,
      data: heatmapData,
      min: Math.min(...heatmapData.map(d => d.value)),
      max: Math.max(...heatmapData.map(d => d.value))
    };
  }

  /**
   * Calculate percentile distribution
   */
  calculatePercentileDistribution(values) {
    if (!values || values.length === 0) {
      return {};
    }

    const sorted = [...values].sort((a, b) => a - b);
    const distribution = {};

    this.percentileBuckets.forEach(p => {
      const index = Math.ceil(sorted.length * p) - 1;
      distribution[`p${Math.round(p * 100)}`] = sorted[Math.max(0, index)];
    });

    return distribution;
  }

  /**
   * Generate latency distribution data
   */
  generateLatencyDistribution(latencies, options = {}) {
    const {
      bucketSize = 10,
      maxBuckets = 50
    } = options;

    if (!latencies || latencies.length === 0) {
      return {
        buckets: [],
        distribution: []
      };
    }

    const maxValue = Math.max(...latencies);
    const actualBucketSize = Math.ceil(maxValue / maxBuckets);

    const buckets = {};
    for (let i = 0; i <= maxBuckets; i++) {
      const bucketStart = i * actualBucketSize;
      buckets[bucketStart] = 0;
    }

    latencies.forEach(value => {
      const bucketIndex = Math.floor(value / actualBucketSize);
      const bucketStart = bucketIndex * actualBucketSize;
      buckets[bucketStart]++;
    });

    const labels = Object.keys(buckets)
      .map(Number)
      .sort((a, b) => a - b);

    const data = labels.map(label => buckets[label]);

    return {
      labels: labels.map(l => `${l}-${l + actualBucketSize}ms`),
      data,
      bucketSize: actualBucketSize
    };
  }

  /**
   * Bucketize time-series data
   */
  bucketizeData(data, bucketSize, timeField, valueField) {
    const buckets = new Map();

    data.forEach(item => {
      const time = item[timeField];
      const bucketTime = Math.floor(time / bucketSize) * bucketSize;

      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, []);
      }

      buckets.get(bucketTime).push(item[valueField]);
    });

    // Convert to sorted array
    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([time, values]) => ({
        time,
        values
      }));
  }

  /**
   * Aggregate bucketed data
   */
  aggregateBuckets(buckets, aggregationType = 'avg') {
    return buckets.map(bucket => {
      const values = bucket.values;
      let value;

      switch (aggregationType) {
      case 'avg':
        value = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case 'max':
        value = Math.max(...values);
        break;
      case 'min':
        value = Math.min(...values);
        break;
      case 'sum':
        value = values.reduce((a, b) => a + b, 0);
        break;
      case 'count':
        value = values.length;
        break;
      case 'p95':
        value = this.percentile(values, 0.95);
        break;
      case 'p99':
        value = this.percentile(values, 0.99);
        break;
      default:
        value = values[values.length - 1];
      }

      return {
        time: bucket.time,
        value: parseFloat(value.toFixed(2))
      };
    });
  }

  /**
   * Calculate percentile from values
   */
  percentile(values, p) {
    if (values.length === 0) {
      return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Normalize data to 0-100 range
   */
  normalizeData(values) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return values.map(v => ((v - min) / range) * 100);
  }

  /**
   * Downsample data for performance
   */
  downsampleData(data, targetPointCount) {
    if (data.length <= targetPointCount) {
      return data;
    }

    const bucketSize = Math.ceil(data.length / targetPointCount);
    const downsampled = [];

    for (let i = 0; i < data.length; i += bucketSize) {
      const bucket = data.slice(i, i + bucketSize);
      const avgValue = bucket.reduce((a, b) => a + b.value, 0) / bucket.length;
      downsampled.push({
        ...bucket[0],
        value: avgValue
      });
    }

    return downsampled;
  }

  /**
   * Calculate moving average
   */
  calculateMovingAverage(values, windowSize = 5) {
    if (values.length < windowSize) {
      return values;
    }

    const result = [];

    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(values.length, i + Math.ceil(windowSize / 2));
      const window = values.slice(start, end);
      const avg = window.reduce((a, b) => a + b, 0) / window.length;
      result.push(avg);
    }

    return result;
  }

  /**
   * Detect anomalies using standard deviation
   */
  detectAnomalies(values, stdDevMultiplier = 2) {
    if (values.length < 3) {
      return [];
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const threshold = stdDevMultiplier * stdDev;
    const anomalies = [];

    values.forEach((value, index) => {
      if (Math.abs(value - mean) > threshold) {
        anomalies.push({
          index,
          value,
          deviation: ((value - mean) / stdDev).toFixed(2)
        });
      }
    });

    return anomalies;
  }

  /**
   * Get category color
   */
  getCategoryColor(category, index) {
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
      '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1',
      '#14b8a6', '#f97316'
    ];

    return colors[index % colors.length];
  }

  /**
   * Convert hex to rgba
   */
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Format large numbers
   */
  formatNumber(value, decimals = 2) {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(decimals) + 'M';
    } else if (value >= 1000) {
      return (value / 1000).toFixed(decimals) + 'K';
    }
    return value.toFixed(decimals);
  }

  /**
   * Format percentage
   */
  formatPercentage(value, decimals = 1) {
    return (value * 100).toFixed(decimals) + '%';
  }

  /**
   * Format duration
   */
  formatDuration(milliseconds) {
    if (milliseconds < 1000) {
      return milliseconds.toFixed(0) + 'ms';
    } else if (milliseconds < 60000) {
      return (milliseconds / 1000).toFixed(1) + 's';
    } else {
      return (milliseconds / 60000).toFixed(1) + 'm';
    }
  }
}

module.exports = VisualizationDataProcessor;
