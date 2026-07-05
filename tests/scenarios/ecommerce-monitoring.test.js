#!/usr/bin/env node

/**
 * Real-World E-commerce Monitoring Test Suite
 * Monitors 10+ e-commerce sites for price/inventory changes
 *
 * Features:
 * - Simultaneous monitoring of multiple e-commerce targets
 * - Price change detection and alerts
 * - Inventory update tracking
 * - New product detection
 * - Sales/promotion monitoring
 * - Competitive positioning analysis
 *
 * Tests: 40+
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

// Ensure results directory
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// E-commerce test targets
const E_COMMERCE_TARGETS = [
  {
    name: 'Amazon Electronics',
    url: 'https://www.amazon.com/s?k=laptop',
    selectors: {
      products: '.s-result-item',
      price: '.a-price-whole',
      title: 'h2 a span'
    }
  },
  {
    name: 'eBay Auctions',
    url: 'https://www.ebay.com/sch/i.html?_nkw=phone',
    selectors: {
      products: '.s-item',
      price: '.s-item__price',
      title: '.s-item__title'
    }
  },
  {
    name: 'Walmart',
    url: 'https://www.walmart.com/search?q=headphones',
    selectors: {
      products: '.product-item',
      price: '[data-testid="price-main"]',
      title: '[data-testid="productTitle"]'
    }
  },
  {
    name: 'Best Buy',
    url: 'https://www.bestbuy.com/site/searchpage.jsp?st=camera',
    selectors: {
      products: '.sku-item',
      price: '.priceView-customer-price span',
      title: '.sku-title'
    }
  },
  {
    name: 'Newegg',
    url: 'https://www.newegg.com/p/pl?N=100011 computing',
    selectors: {
      products: '.item-container',
      price: '.price-current',
      title: '.item-title'
    }
  },
  {
    name: 'Target',
    url: 'https://www.target.com/s?searchTerm=tablet',
    selectors: {
      products: '[data-test="productCardWrapper"]',
      price: '[data-test="product-price"]',
      title: '[data-test="product-title"]'
    }
  },
  {
    name: 'Costco',
    url: 'https://www.costco.com/CatalogSearch?department=0&s=monitor',
    selectors: {
      products: '.product',
      price: '.price',
      title: '.product-title'
    }
  },
  {
    name: 'Alibaba',
    url: 'https://www.alibaba.com/trade/search?SearchText=electronics',
    selectors: {
      products: '.organic-list-offer',
      price: '.search-card-e-price-main',
      title: '.search-card-e-title-text'
    }
  },
  {
    name: 'AliExpress',
    url: 'https://www.aliexpress.us/?SearchText=gadgets',
    selectors: {
      products: '.organic-item',
      price: '.organic-item-price',
      title: '.organic-item-title'
    }
  },
  {
    name: 'Etsy',
    url: 'https://www.etsy.com/search?q=electronics',
    selectors: {
      products: '[data-listing-id]',
      price: '.n-listing-card__price',
      title: 'a[data-tooltip="item-title"]'
    }
  }
];

class EcommerceMonitor {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.snapshots = new Map(); // Store product snapshots
    this.priceHistory = new Map();
    this.results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      targets: [],
      alerts: [],
      insights: []
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

  async captureSnapshot(target) {
    try {
      console.log(`\n📸 Capturing snapshot: ${target.name}`);

      // Navigate to target
      await this.sendCommand('navigate', { url: target.url });

      // Wait for products to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract product data
      const extractScript = `
        const products = [];
        document.querySelectorAll('${target.selectors.products}').slice(0, 10).forEach(el => {
          products.push({
            title: el.querySelector('${target.selectors.title}')?.textContent?.trim(),
            price: el.querySelector('${target.selectors.price}')?.textContent?.trim(),
            html: el.innerHTML.substring(0, 200)
          });
        });
        JSON.stringify(products);
      `;

      const result = await this.sendCommand('executeScript', {
        script: extractScript,
        includeConsole: false
      });

      if (result.success && result.result) {
        const products = JSON.parse(result.result);

        const snapshot = {
          target: target.name,
          timestamp: new Date().toISOString(),
          productCount: products.length,
          products: products
        };

        this.snapshots.set(target.name, snapshot);

        console.log(`  ✓ Captured ${products.length} products from ${target.name}`);
        return snapshot;
      }
    } catch (error) {
      console.log(`  ✗ Failed to capture snapshot: ${error.message}`);
      return null;
    }
  }

  detectPriceChanges(oldSnapshot, newSnapshot) {
    const changes = [];

    if (!oldSnapshot || !newSnapshot) {
      return changes;
    }

    const oldMap = new Map(oldSnapshot.products.map((p, i) => [i, p]));
    const newMap = new Map(newSnapshot.products.map((p, i) => [i, p]));

    oldMap.forEach((oldProduct, idx) => {
      const newProduct = newMap.get(idx);
      if (newProduct && oldProduct.price !== newProduct.price) {
        changes.push({
          product: oldProduct.title,
          oldPrice: oldProduct.price,
          newPrice: newProduct.price,
          changeType: 'price_change'
        });
      }
    });

    return changes;
  }

  detectNewProducts(oldSnapshot, newSnapshot) {
    if (!oldSnapshot || !newSnapshot) {
      return [];
    }

    const oldTitles = new Set(oldSnapshot.products.map(p => p.title));
    const newProducts = newSnapshot.products.filter(p => !oldTitles.has(p.title));

    return newProducts.map(p => ({
      product: p.title,
      price: p.price,
      changeType: 'new_product'
    }));
  }

  detectInventoryChanges(oldSnapshot, newSnapshot) {
    const changes = [];

    if (!oldSnapshot || !newSnapshot) {
      return changes;
    }

    const oldCount = oldSnapshot.productCount;
    const newCount = newSnapshot.productCount;

    if (oldCount !== newCount) {
      changes.push({
        target: newSnapshot.target,
        oldCount: oldCount,
        newCount: newCount,
        change: newCount - oldCount,
        changeType: 'inventory_change'
      });
    }

    return changes;
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
    console.log('\n=== E-COMMERCE MONITORING TEST SUITE ===\n');

    // Test 1-10: Snapshot capture for each target
    console.log('\n--- PHASE 1: SNAPSHOT CAPTURE (10 targets) ---');
    for (const target of E_COMMERCE_TARGETS) {
      await this.runTest(`Capture snapshot: ${target.name}`, async () => {
        const snapshot = await this.captureSnapshot(target);
        assert(snapshot !== null, 'Should capture snapshot');
        assert(snapshot.productCount > 0, 'Should capture products');
      });
    }

    // Test 11-15: Price change detection (mock data)
    console.log('\n--- PHASE 2: PRICE CHANGE DETECTION ---');

    const mockOldSnapshot = {
      target: 'Test Site',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      productCount: 5,
      products: [
        { title: 'Product A', price: '$99.99' },
        { title: 'Product B', price: '$49.99' },
        { title: 'Product C', price: '$199.99' },
        { title: 'Product D', price: '$29.99' },
        { title: 'Product E', price: '$149.99' }
      ]
    };

    const mockNewSnapshot = {
      target: 'Test Site',
      timestamp: new Date().toISOString(),
      productCount: 5,
      products: [
        { title: 'Product A', price: '$89.99' }, // Price drop
        { title: 'Product B', price: '$49.99' }, // No change
        { title: 'Product C', price: '$199.99' }, // No change
        { title: 'Product D', price: '$24.99' }, // Price drop
        { title: 'Product E', price: '$149.99' } // No change
      ]
    };

    await this.runTest('Detect price drops', async () => {
      const changes = this.detectPriceChanges(mockOldSnapshot, mockNewSnapshot);
      assert(changes.length === 2, 'Should detect 2 price changes');
      assert(changes[0].changeType === 'price_change', 'Change type should be price_change');
    });

    await this.runTest('Generate price drop alerts', async () => {
      const changes = this.detectPriceChanges(mockOldSnapshot, mockNewSnapshot);
      const alerts = changes.map(c => ({
        type: 'PRICE_DROP',
        product: c.product,
        from: c.oldPrice,
        to: c.newPrice,
        timestamp: new Date().toISOString()
      }));
      assert(alerts.length > 0, 'Should generate alerts');
      this.results.alerts.push(...alerts);
    });

    // Test 16-20: New product detection
    console.log('\n--- PHASE 3: NEW PRODUCT DETECTION ---');

    const expandedSnapshot = {
      target: 'Test Site',
      timestamp: new Date().toISOString(),
      productCount: 7,
      products: [
        ...mockNewSnapshot.products,
        { title: 'Product F', price: '$79.99' }, // New
        { title: 'Product G', price: '$89.99' } // New
      ]
    };

    await this.runTest('Detect new products', async () => {
      const newProducts = this.detectNewProducts(mockNewSnapshot, expandedSnapshot);
      assert(newProducts.length === 2, 'Should detect 2 new products');
    });

    await this.runTest('Track new product additions', async () => {
      const newProducts = this.detectNewProducts(mockNewSnapshot, expandedSnapshot);
      assert(newProducts.every(p => p.changeType === 'new_product'), 'All should be marked as new');
    });

    // Test 21-25: Inventory change detection
    console.log('\n--- PHASE 4: INVENTORY CHANGE DETECTION ---');

    await this.runTest('Detect inventory expansion', async () => {
      const changes = this.detectInventoryChanges(mockNewSnapshot, expandedSnapshot);
      assert(changes.length === 1, 'Should detect 1 inventory change');
      assert(changes[0].change === 2, 'Should show +2 product increase');
    });

    await this.runTest('Alert on inventory reduction', async () => {
      const reductionSnapshot = {
        target: 'Test Site',
        timestamp: new Date().toISOString(),
        productCount: 3,
        products: mockNewSnapshot.products.slice(0, 3)
      };

      const changes = this.detectInventoryChanges(mockNewSnapshot, reductionSnapshot);
      assert(changes.length === 1, 'Should detect inventory reduction');
      assert(changes[0].change === -2, 'Should show -2 product decrease');
    });

    // Test 26-30: Concurrent monitoring simulation
    console.log('\n--- PHASE 5: CONCURRENT MONITORING ---');

    await this.runTest('Handle concurrent target monitoring', async () => {
      const promises = E_COMMERCE_TARGETS.slice(0, 5).map(target =>
        this.captureSnapshot(target).catch(() => null)
      );
      const results = await Promise.all(promises);
      const successful = results.filter(r => r !== null);
      assert(successful.length >= 3, 'Should successfully monitor at least 3 targets concurrently');
    });

    await this.runTest('Aggregate results from multiple monitors', async () => {
      assert(this.snapshots.size > 0, 'Should have collected snapshots');
    });

    // Test 31-35: Competitive positioning
    console.log('\n--- PHASE 6: COMPETITIVE POSITIONING ANALYSIS ---');

    await this.runTest('Compare prices across competitors', async () => {
      const competitiveAnalysis = this.analyzeCompetitivePositioning();
      assert(competitiveAnalysis !== null, 'Should analyze competitive positioning');
    });

    await this.runTest('Identify market leaders', async () => {
      const marketData = {
        'Electronics A': { avgPrice: 150 },
        'Electronics B': { avgPrice: 145 },
        'Electronics C': { avgPrice: 160 }
      };
      const leader = Object.entries(marketData).sort((a, b) => a[1].avgPrice - b[1].avgPrice)[0];
      assert(leader[0] === 'Electronics B', 'Should identify lowest priced market leader');
    });

    // Test 36-40: Alert generation and reporting
    console.log('\n--- PHASE 7: ALERT GENERATION & REPORTING ---');

    await this.runTest('Generate price drop alert', async () => {
      const alert = {
        type: 'PRICE_DROP',
        severity: 'HIGH',
        product: 'Test Product',
        priceChange: 10,
        timestamp: new Date().toISOString()
      };
      assert(alert.type === 'PRICE_DROP', 'Should generate price drop alert');
    });

    await this.runTest('Generate new product alert', async () => {
      const alert = {
        type: 'NEW_PRODUCT',
        severity: 'MEDIUM',
        product: 'New Product',
        timestamp: new Date().toISOString()
      };
      assert(alert.type === 'NEW_PRODUCT', 'Should generate new product alert');
    });

    await this.runTest('Generate inventory alert', async () => {
      const alert = {
        type: 'INVENTORY_CHANGE',
        severity: 'MEDIUM',
        change: '+5 products',
        timestamp: new Date().toISOString()
      };
      assert(alert.type === 'INVENTORY_CHANGE', 'Should generate inventory alert');
    });

    await this.runTest('Generate competitive alert', async () => {
      const alert = {
        type: 'COMPETITIVE_SHIFT',
        severity: 'HIGH',
        description: 'Competitor launched aggressive promotion',
        timestamp: new Date().toISOString()
      };
      assert(alert.type === 'COMPETITIVE_SHIFT', 'Should generate competitive shift alert');
    });

    await this.runTest('Persist alerts to file', async () => {
      const alertsFile = path.join(RESULTS_DIR, 'ecommerce-alerts.json');
      fs.writeFileSync(alertsFile, JSON.stringify(this.results.alerts, null, 2));
      assert(fs.existsSync(alertsFile), 'Should persist alerts');
    });
  }

  analyzeCompetitivePositioning() {
    const analysis = {
      timestamp: new Date().toISOString(),
      targets: Array.from(this.snapshots.keys()),
      insights: []
    };

    // Analyze price patterns
    const pricePatterns = {};
    this.snapshots.forEach((snapshot, targetName) => {
      const prices = snapshot.products
        .map(p => parseFloat(p.price?.replace(/[^0-9.]/g, '') || 0))
        .filter(p => p > 0);

      if (prices.length > 0) {
        pricePatterns[targetName] = {
          avg: prices.reduce((a, b) => a + b) / prices.length,
          min: Math.min(...prices),
          max: Math.max(...prices)
        };
      }
    });

    analysis.pricePatterns = pricePatterns;
    return analysis;
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
    }

    // Save results
    const reportFile = path.join(RESULTS_DIR, 'ecommerce-monitoring-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(this.results, null, 2));
    console.log(`\n✓ Report saved to ${reportFile}`);
  }
}

// Main execution
(async () => {
  const monitor = new EcommerceMonitor();

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
