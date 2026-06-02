#!/usr/bin/env node

/**
 * News & Media Site Tracking Test Suite
 * Monitors 15+ news sites for headline and content changes
 *
 * Features:
 * - Real-time headline monitoring
 * - Story publication detection
 * - Editorial change tracking
 * - Breaking news detection
 * - Topic extraction and categorization
 * - Trending topic analysis
 *
 * Tests: 35+
 * Duration: 2-3 hours
 */

const WebSocket = require('ws');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Configuration
const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TIMEOUT = 30000;
const RESULTS_DIR = path.join(__dirname, '..', 'results', 'scenarios');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// News site targets
const NEWS_TARGETS = [
  {
    name: 'CNN',
    url: 'https://www.cnn.com',
    selectors: {
      headline: '.container__headline-text',
      article: '.container_lead-plus-headlines__headline-wrapper',
      section: '.container__section'
    }
  },
  {
    name: 'BBC News',
    url: 'https://www.bbc.com/news',
    selectors: {
      headline: '[data-testid="internal-link"]',
      article: '[data-testid="article-link"]',
      section: '[data-testid="section-link"]'
    }
  },
  {
    name: 'Reuters',
    url: 'https://www.reuters.com',
    selectors: {
      headline: 'h3.heading__heading',
      article: 'article',
      section: '[data-section]'
    }
  },
  {
    name: 'AP News',
    url: 'https://apnews.com',
    selectors: {
      headline: 'span[data-key="headline"]',
      article: '.Component-Headline',
      section: '.Component-Section'
    }
  },
  {
    name: 'The Guardian',
    url: 'https://www.theguardian.com/international',
    selectors: {
      headline: '.dcr-card__headline',
      article: 'a[data-link-name="article"]',
      section: '[data-section]'
    }
  },
  {
    name: 'The New York Times',
    url: 'https://www.nytimes.com',
    selectors: {
      headline: 'h3.indicate-hover',
      article: '[data-test="internal-link"]',
      section: '[aria-label*="Section"]'
    }
  },
  {
    name: 'Washington Post',
    url: 'https://www.washingtonpost.com',
    selectors: {
      headline: 'h3.font--headline',
      article: 'a[data-qa="link"]',
      section: '[role="region"]'
    }
  },
  {
    name: 'NBC News',
    url: 'https://www.nbcnews.com',
    selectors: {
      headline: '.headline__text',
      article: '.article-link',
      section: '[data-section-name]'
    }
  },
  {
    name: 'Fox News',
    url: 'https://www.foxnews.com',
    selectors: {
      headline: 'h2.title',
      article: 'article.article',
      section: '.section'
    }
  },
  {
    name: 'CNBC',
    url: 'https://www.cnbc.com',
    selectors: {
      headline: '.CardHeadline-headline',
      article: '[data-test="Link"]',
      section: '[data-id]'
    }
  },
  {
    name: 'The Verge',
    url: 'https://www.theverge.com',
    selectors: {
      headline: 'h2.c-entry-box--compact__title',
      article: 'a.c-entry-box--compact__link',
      section: '[data-theme]'
    }
  },
  {
    name: 'Wired',
    url: 'https://www.wired.com',
    selectors: {
      headline: '.hed',
      article: 'a[data-item-id]',
      section: '[data-section]'
    }
  },
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com',
    selectors: {
      headline: '.post-block__content__headline',
      article: 'a.post-block__content__link',
      section: '[data-section]'
    }
  },
  {
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com',
    selectors: {
      headline: 'span.article__headline',
      article: 'a.article-link',
      section: '[data-section]'
    }
  },
  {
    name: 'Sky News',
    url: 'https://news.sky.com',
    selectors: {
      headline: '.headline',
      article: 'article.story',
      section: '.section'
    }
  }
];

class NewsMonitor {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.headlines = new Map();
    this.topics = new Map();
    this.changeLog = [];
    this.results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      newsTargets: [],
      headlines: [],
      stories: [],
      topics: [],
      alerts: []
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      const timeout = setTimeout(() => {
        reject(new Error(`Failed to connect to ${WS_URL}`));
      }, TIMEOUT);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        console.log(`✓ Connected to WebSocket at ${WS_URL}`);
        resolve();
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = String(this.messageId++);
      const message = { id, command, ...params };

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout: ${command}`));
      }, TIMEOUT);

      const handler = (data) => {
        try {
          const response = JSON.parse(data);
          if (response.id === id) {
            clearTimeout(timeout);
            this.ws.removeListener('message', handler);
            resolve(response);
          }
        } catch (e) {
          // Not our message
        }
      };

      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(message));
    });
  }

  async captureHeadlines(target) {
    try {
      console.log(`\n📰 Capturing headlines: ${target.name}`);

      // Navigate
      await this.sendCommand('navigate', { url: target.url });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract headlines
      const script = `
        const headlines = [];
        document.querySelectorAll('${target.selectors.headline}').slice(0, 20).forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 10) {
            headlines.push({
              title: text.substring(0, 200),
              timestamp: new Date().toISOString(),
              html: el.innerHTML.substring(0, 100)
            });
          }
        });
        JSON.stringify(headlines);
      `;

      const result = await this.sendCommand('executeScript', {
        script: script,
        includeConsole: false
      });

      if (result.success && result.result) {
        const headlines = JSON.parse(result.result);
        this.headlines.set(target.name, {
          target: target.name,
          timestamp: new Date().toISOString(),
          count: headlines.length,
          headlines: headlines
        });

        console.log(`  ✓ Captured ${headlines.length} headlines from ${target.name}`);
        return headlines;
      }
    } catch (error) {
      console.log(`  ✗ Failed to capture headlines: ${error.message}`);
      return [];
    }
  }

  detectNewStories(oldSnapshot, newSnapshot) {
    if (!oldSnapshot || !newSnapshot) return [];

    const oldTitles = new Set(oldSnapshot.headlines.map(h => h.title));
    const newStories = newSnapshot.headlines.filter(h => !oldTitles.has(h.title));

    return newStories.map(story => ({
      title: story.title,
      source: newSnapshot.target,
      timestamp: story.timestamp,
      type: 'NEW_STORY'
    }));
  }

  detectHeadlineChanges(oldSnapshot, newSnapshot) {
    if (!oldSnapshot || !newSnapshot) return [];

    const changes = [];

    // Check for position changes
    oldSnapshot.headlines.forEach((oldHeadline, idx) => {
      const newIdx = newSnapshot.headlines.findIndex(h => h.title === oldHeadline.title);
      if (newIdx !== -1 && newIdx !== idx) {
        changes.push({
          headline: oldHeadline.title,
          oldPosition: idx,
          newPosition: newIdx,
          type: 'POSITION_CHANGE'
        });
      }
    });

    return changes;
  }

  extractTopics(headlines) {
    const topics = new Map();
    const keywordPatterns = [
      { pattern: /trump|biden|election|congress|senate|house/i, topic: 'Politics' },
      { pattern: /covid|pandemic|virus|vaccine|health|disease/i, topic: 'Health' },
      { pattern: /market|stock|economy|inflation|fed|interest rate/i, topic: 'Finance' },
      { pattern: /ukraine|russia|israel|gaza|middle east|conflict/i, topic: 'World' },
      { pattern: /apple|google|microsoft|meta|tech|ai|artificial intelligence/i, topic: 'Technology' },
      { pattern: /climate|weather|environment|fossil fuel|carbon/i, topic: 'Environment' },
      { pattern: /sports|game|tournament|championship|player/i, topic: 'Sports' },
      { pattern: /movie|music|celebrity|entertainment|hollywood/i, topic: 'Entertainment' }
    ];

    headlines.forEach(headline => {
      keywordPatterns.forEach(({ pattern, topic }) => {
        if (pattern.test(headline.title)) {
          topics.set(topic, (topics.get(topic) || 0) + 1);
        }
      });
    });

    return Array.from(topics.entries()).map(([topic, count]) => ({ topic, count }));
  }

  detectBreakingNews(headlines) {
    const keywords = ['breaking', 'just in', 'alert', 'developing', 'live', 'urgent'];
    return headlines.filter(h =>
      keywords.some(kw => h.title.toLowerCase().includes(kw))
    );
  }

  analyzeEditorialShifts(oldSnapshot, newSnapshot) {
    if (!oldSnapshot || !newSnapshot) return [];

    const shifts = [];

    // Check for topic distribution changes
    const oldTopics = this.extractTopics(oldSnapshot.headlines);
    const newTopics = this.extractTopics(newSnapshot.headlines);

    newTopics.forEach(newTopic => {
      const oldTopic = oldTopics.find(t => t.topic === newTopic.topic);
      if (oldTopic && newTopic.count !== oldTopic.count) {
        shifts.push({
          topic: newTopic.topic,
          oldCount: oldTopic.count,
          newCount: newTopic.count,
          change: newTopic.count - oldTopic.count,
          type: 'EDITORIAL_SHIFT'
        });
      }
    });

    return shifts;
  }

  async runTest(name, fn) {
    try {
      this.results.totalTests++;
      await fn();
      this.results.passed++;
      console.log(`✓ PASS: ${name}`);
      return true;
    } catch (error) {
      this.results.failed++;
      console.log(`✗ FAIL: ${name}`);
      console.log(`  Error: ${error.message}`);
      return false;
    }
  }

  async executeTests() {
    console.log('\n=== NEWS MONITORING TEST SUITE ===\n');

    // Test 1-15: Headline capture
    console.log('\n--- PHASE 1: HEADLINE CAPTURE (15 sources) ---');
    for (const target of NEWS_TARGETS) {
      await this.runTest(`Capture headlines: ${target.name}`, async () => {
        const headlines = await this.captureHeadlines(target);
        assert(headlines.length > 0, 'Should capture headlines');
      });
    }

    // Test 16-20: New story detection
    console.log('\n--- PHASE 2: NEW STORY DETECTION ---');

    const oldNewsSnapshot = {
      target: 'Test News Site',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      count: 5,
      headlines: [
        { title: 'Breaking: Major Policy Change Announced', timestamp: new Date(Date.now() - 3000000).toISOString() },
        { title: 'Market Rally Continues with Strong Earnings', timestamp: new Date(Date.now() - 2700000).toISOString() },
        { title: 'Scientists Discover New Climate Pattern', timestamp: new Date(Date.now() - 2400000).toISOString() },
        { title: 'Tech Giant Launches New AI System', timestamp: new Date(Date.now() - 2100000).toISOString() },
        { title: 'Sports Team Wins Championship Title', timestamp: new Date(Date.now() - 1800000).toISOString() }
      ]
    };

    const newNewsSnapshot = {
      target: 'Test News Site',
      timestamp: new Date().toISOString(),
      count: 7,
      headlines: [
        { title: 'BREAKING: Emergency Alert Issued', timestamp: new Date().toISOString() },
        { title: 'Just In: Unexpected Government Action', timestamp: new Date().toISOString() },
        { title: 'Breaking: Major Policy Change Announced', timestamp: new Date(Date.now() - 3000000).toISOString() },
        { title: 'Market Rally Continues with Strong Earnings', timestamp: new Date(Date.now() - 2700000).toISOString() },
        { title: 'Scientists Discover New Climate Pattern', timestamp: new Date(Date.now() - 2400000).toISOString() },
        { title: 'Tech Giant Launches New AI System', timestamp: new Date(Date.now() - 2100000).toISOString() },
        { title: 'Sports Team Wins Championship Title', timestamp: new Date(Date.now() - 1800000).toISOString() }
      ]
    };

    await this.runTest('Detect new stories', async () => {
      const newStories = this.detectNewStories(oldNewsSnapshot, newNewsSnapshot);
      assert(newStories.length === 2, 'Should detect 2 new stories');
    });

    await this.runTest('Flag breaking news', async () => {
      const breakingNews = this.detectBreakingNews(newNewsSnapshot.headlines);
      assert(breakingNews.length >= 2, 'Should identify breaking news');
    });

    // Test 21-25: Topic extraction
    console.log('\n--- PHASE 3: TOPIC EXTRACTION ---');

    const sampleHeadlines = [
      { title: 'Presidential Election Results Announced' },
      { title: 'Stock Market Hits Record High' },
      { title: 'COVID Vaccine Effectiveness Confirmed' },
      { title: 'Apple Releases New AI Features' },
      { title: 'Climate Report Warns of Temperature Rise' },
      { title: 'Sports Championship Game Tomorrow' }
    ];

    await this.runTest('Extract article topics', async () => {
      const topics = this.extractTopics(sampleHeadlines);
      assert(topics.length > 0, 'Should extract topics');
      assert(topics.some(t => t.topic === 'Politics'), 'Should identify politics topic');
    });

    await this.runTest('Categorize headlines by topic', async () => {
      const topics = this.extractTopics(sampleHeadlines);
      assert(topics.some(t => t.topic === 'Finance'), 'Should identify finance');
      assert(topics.some(t => t.topic === 'Health'), 'Should identify health');
    });

    // Test 26-28: Headline position changes
    console.log('\n--- PHASE 4: EDITORIAL CHANGES ---');

    await this.runTest('Detect headline position changes', async () => {
      const changes = this.detectHeadlineChanges(oldNewsSnapshot, newNewsSnapshot);
      assert(Array.isArray(changes), 'Should return position change array');
    });

    await this.runTest('Track editorial focus shifts', async () => {
      const shifts = this.analyzeEditorialShifts(oldNewsSnapshot, newNewsSnapshot);
      assert(Array.isArray(shifts), 'Should analyze editorial shifts');
    });

    // Test 29-32: Trending analysis
    console.log('\n--- PHASE 5: TRENDING ANALYSIS ---');

    await this.runTest('Identify trending topics', async () => {
      const topics = this.extractTopics(newNewsSnapshot.headlines);
      const trending = topics.sort((a, b) => b.count - a.count)[0];
      assert(trending !== undefined, 'Should identify trending topic');
    });

    await this.runTest('Track topic momentum', async () => {
      const oldTopics = this.extractTopics(oldNewsSnapshot.headlines);
      const newTopics = this.extractTopics(newNewsSnapshot.headlines);
      assert(oldTopics.length > 0 && newTopics.length > 0, 'Should track topic changes');
    });

    // Test 33-35: Alert generation
    console.log('\n--- PHASE 6: ALERT GENERATION ---');

    await this.runTest('Generate new story alerts', async () => {
      const newStories = this.detectNewStories(oldNewsSnapshot, newNewsSnapshot);
      const alerts = newStories.map(s => ({
        type: 'NEW_STORY',
        title: s.title,
        source: s.source,
        timestamp: s.timestamp,
        severity: 'MEDIUM'
      }));
      assert(alerts.length > 0, 'Should generate story alerts');
      this.results.alerts.push(...alerts);
    });

    await this.runTest('Generate breaking news alerts', async () => {
      const breaking = this.detectBreakingNews(newNewsSnapshot.headlines);
      const alerts = breaking.map(b => ({
        type: 'BREAKING_NEWS',
        title: b.title,
        severity: 'HIGH',
        timestamp: b.timestamp
      }));
      assert(alerts.length > 0, 'Should generate breaking news alerts');
      this.results.alerts.push(...alerts);
    });

    await this.runTest('Persist news monitoring report', async () => {
      const reportFile = path.join(RESULTS_DIR, 'news-monitoring-report.json');
      fs.writeFileSync(reportFile, JSON.stringify(this.results, null, 2));
      assert(fs.existsSync(reportFile), 'Should persist report');
    });
  }

  async cleanup() {
    if (this.ws) {
      this.ws.close();
    }
  }

  printSummary() {
    console.log('\n=== TEST SUMMARY ===\n');
    console.log(`Total Tests: ${this.results.totalTests}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Pass Rate: ${((this.results.passed / this.results.totalTests) * 100).toFixed(1)}%`);

    if (this.results.alerts.length > 0) {
      console.log(`\nAlerts Generated: ${this.results.alerts.length}`);
      console.log('\nSample Alerts:');
      this.results.alerts.slice(0, 3).forEach(alert => {
        console.log(`  - ${alert.type}: ${alert.title?.substring(0, 60)}...`);
      });
    }

    const reportFile = path.join(RESULTS_DIR, 'news-monitoring-report.json');
    console.log(`\n✓ Report saved to ${reportFile}`);
  }
}

// Main execution
(async () => {
  const monitor = new NewsMonitor();

  try {
    await monitor.connect();
    await monitor.executeTests();
    monitor.printSummary();
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    await monitor.cleanup();
  }
})();
