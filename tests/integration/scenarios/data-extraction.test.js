/**
 * Data Extraction Test Scenarios
 *
 * Tests content extraction functionality between extension and browser.
 */

const assert = require('assert');
const { TestServer } = require('../harness/test-server');
const { MockExtension } = require('../harness/mock-extension');
const { MockBrowser } = require('../harness/mock-browser');

// Test configuration
const TEST_PORT = 8771;
const TEST_URL = `ws://localhost:${TEST_PORT}`;

// Test state
let server = null;
let extension = null;
let browser = null;

// Mock page content
const mockContent = {
  html: `<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
  <h1 id="main-title">Welcome</h1>
  <p class="intro">This is a test page.</p>
  <div id="content">
    <ul class="items">
      <li data-id="1">Item 1</li>
      <li data-id="2">Item 2</li>
      <li data-id="3">Item 3</li>
    </ul>
  </div>
  <table id="data-table">
    <tr><th>Name</th><th>Value</th></tr>
    <tr><td>Row1</td><td>Value1</td></tr>
    <tr><td>Row2</td><td>Value2</td></tr>
  </table>
  <a href="/page1" class="link">Link 1</a>
  <a href="/page2" class="link">Link 2</a>
</body>
</html>`,
  text: 'Welcome\nThis is a test page.\nItem 1\nItem 2\nItem 3',
  title: 'Test Page',
  url: 'https://example.com/test'
};

/**
 * Test utilities
 */
const testUtils = {
  async setup() {
    server = new TestServer({ port: TEST_PORT });
    setupExtractionHandlers();
    await server.start();

    extension = new MockExtension({ url: TEST_URL });
    browser = new MockBrowser({ url: TEST_URL });

    await extension.connect();
    await browser.connect();
  },

  async teardown() {
    if (extension && extension.isConnected) {
      extension.disconnect();
    }
    if (browser && browser.isConnected) {
      browser.disconnect();
    }
    if (server && server.isRunning) {
      await server.stop();
    }
  },

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

/**
 * Setup extraction handlers
 */
function setupExtractionHandlers() {
  // Get HTML content
  server.registerHandler('get_content', async (params) => {
    const { selector, type = 'html' } = params;

    if (selector) {
      // Return content for specific selector
      const selectorContent = {
        '#main-title': '<h1 id="main-title">Welcome</h1>',
        '.intro': '<p class="intro">This is a test page.</p>',
        '#content': '<div id="content"><ul class="items"><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul></div>',
        '.items': '<ul class="items"><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>',
        '#data-table': '<table id="data-table"><tr><th>Name</th><th>Value</th></tr><tr><td>Row1</td><td>Value1</td></tr></table>'
      };

      return {
        success: true,
        selector,
        content: selectorContent[selector] || '',
        found: !!selectorContent[selector]
      };
    }

    return {
      success: true,
      content: type === 'text' ? mockContent.text : mockContent.html,
      type,
      url: mockContent.url
    };
  });

  // Get text content
  server.registerHandler('get_text', async (params) => {
    const { selector } = params;

    const textContent = {
      '#main-title': 'Welcome',
      '.intro': 'This is a test page.',
      '.items': 'Item 1\nItem 2\nItem 3',
      'body': mockContent.text
    };

    return {
      success: true,
      selector: selector || 'body',
      text: textContent[selector] || textContent['body']
    };
  });

  // Get page state
  server.registerHandler('get_page_state', async () => {
    return {
      success: true,
      url: mockContent.url,
      title: mockContent.title,
      forms: [],
      links: [
        { href: '/page1', text: 'Link 1', selector: 'a.link' },
        { href: '/page2', text: 'Link 2', selector: 'a.link' }
      ],
      buttons: []
    };
  });

  // Get element attribute
  server.registerHandler('get_attribute', async (params) => {
    const { selector, attribute } = params;

    const attributes = {
      '#main-title': { id: 'main-title', class: undefined },
      '.intro': { class: 'intro', id: undefined },
      '.items li:first-child': { 'data-id': '1' },
      'a.link': { href: '/page1', class: 'link' }
    };

    const elem = attributes[selector];
    if (!elem) {
      return { success: false, error: 'Element not found' };
    }

    return {
      success: true,
      selector,
      attribute,
      value: elem[attribute]
    };
  });

  // Get multiple elements
  server.registerHandler('get_elements', async (params) => {
    const { selector, attributes = ['text'] } = params;

    const elements = {
      '.items li': [
        { text: 'Item 1', 'data-id': '1' },
        { text: 'Item 2', 'data-id': '2' },
        { text: 'Item 3', 'data-id': '3' }
      ],
      'a.link': [
        { text: 'Link 1', href: '/page1' },
        { text: 'Link 2', href: '/page2' }
      ],
      '#data-table tr': [
        { text: 'Name\tValue' },
        { text: 'Row1\tValue1' },
        { text: 'Row2\tValue2' }
      ]
    };

    return {
      success: true,
      selector,
      elements: elements[selector] || [],
      count: (elements[selector] || []).length
    };
  });

  // Execute script for extraction
  server.registerHandler('execute_script', async (params) => {
    const { script } = params;

    // Simulate script execution results
    if (script.includes('document.title')) {
      return { success: true, result: mockContent.title };
    }
    if (script.includes('document.body.innerText')) {
      return { success: true, result: mockContent.text };
    }
    if (script.includes('querySelectorAll')) {
      return { success: true, result: ['Item 1', 'Item 2', 'Item 3'] };
    }
    if (script.includes('JSON.parse')) {
      return { success: true, result: { key: 'value', items: [1, 2, 3] } };
    }

    return { success: true, result: null };
  });

  // Extract table data
  server.registerHandler('extract_table', async (params) => {
    const { selector } = params;

    return {
      success: true,
      selector,
      headers: ['Name', 'Value'],
      rows: [
        ['Row1', 'Value1'],
        ['Row2', 'Value2']
      ],
      data: [
        { Name: 'Row1', Value: 'Value1' },
        { Name: 'Row2', Value: 'Value2' }
      ]
    };
  });

  // Extract links
  server.registerHandler('extract_links', async (params) => {
    const { selector, absolute = true } = params;

    return {
      success: true,
      links: [
        { href: absolute ? 'https://example.com/page1' : '/page1', text: 'Link 1' },
        { href: absolute ? 'https://example.com/page2' : '/page2', text: 'Link 2' }
      ],
      count: 2
    };
  });

  // Extract structured data (JSON-LD, etc.)
  server.registerHandler('extract_structured_data', async (params) => {
    return {
      success: true,
      jsonLd: [
        {
          '@type': 'WebPage',
          name: 'Test Page',
          url: 'https://example.com/test'
        }
      ],
      microdata: [],
      openGraph: {
        title: 'Test Page',
        type: 'website'
      }
    };
  });
}

/**
 * Test Suite: Full Page HTML Extraction
 */
async function testFullPageHtmlExtraction() {
  console.log('\n--- Test: Full Page HTML Extraction ---');

  const response = await extension.sendCommand('get_content', { type: 'html' });

  assert(response.success, 'HTML extraction should succeed');
  assert(response.result.content.includes('<!DOCTYPE html>'), 'Should contain DOCTYPE');
  assert(response.result.content.includes('<body>'), 'Should contain body tag');
  console.log('  Full HTML content extracted');

  console.log('PASSED: Full Page HTML Extraction');
  return true;
}

/**
 * Test Suite: Text Content Extraction
 */
async function testTextContentExtraction() {
  console.log('\n--- Test: Text Content Extraction ---');

  const response = await extension.sendCommand('get_text', {});

  assert(response.success, 'Text extraction should succeed');
  assert(response.result.text.includes('Welcome'), 'Should contain title text');
  assert(response.result.text.includes('Item 1'), 'Should contain list items');
  console.log('  Text content extracted');

  console.log('PASSED: Text Content Extraction');
  return true;
}

/**
 * Test Suite: Selector-Based Extraction
 */
async function testSelectorBasedExtraction() {
  console.log('\n--- Test: Selector-Based Extraction ---');

  // Extract by ID
  const idResponse = await extension.sendCommand('get_content', { selector: '#main-title' });
  assert(idResponse.success, 'ID selector extraction should succeed');
  assert(idResponse.result.content.includes('Welcome'), 'Should contain title');
  console.log('  Extracted by ID selector');

  // Extract by class
  const classResponse = await extension.sendCommand('get_content', { selector: '.intro' });
  assert(classResponse.success, 'Class selector extraction should succeed');
  console.log('  Extracted by class selector');

  // Extract nested content
  const nestedResponse = await extension.sendCommand('get_content', { selector: '#content' });
  assert(nestedResponse.success, 'Nested extraction should succeed');
  assert(nestedResponse.result.content.includes('Item'), 'Should contain list items');
  console.log('  Extracted nested content');

  console.log('PASSED: Selector-Based Extraction');
  return true;
}

/**
 * Test Suite: Element Attribute Extraction
 */
async function testElementAttributeExtraction() {
  console.log('\n--- Test: Element Attribute Extraction ---');

  // Get ID attribute
  const idResponse = await extension.sendCommand('get_attribute', {
    selector: '#main-title',
    attribute: 'id'
  });
  assert(idResponse.success, 'ID attribute extraction should succeed');
  assert(idResponse.result.value === 'main-title', 'ID should match');
  console.log('  Extracted ID attribute');

  // Get class attribute
  const classResponse = await extension.sendCommand('get_attribute', {
    selector: '.intro',
    attribute: 'class'
  });
  assert(classResponse.success, 'Class attribute extraction should succeed');
  assert(classResponse.result.value === 'intro', 'Class should match');
  console.log('  Extracted class attribute');

  // Get data attribute
  const dataResponse = await extension.sendCommand('get_attribute', {
    selector: '.items li:first-child',
    attribute: 'data-id'
  });
  assert(dataResponse.success, 'Data attribute extraction should succeed');
  assert(dataResponse.result.value === '1', 'Data attribute should match');
  console.log('  Extracted data attribute');

  console.log('PASSED: Element Attribute Extraction');
  return true;
}

/**
 * Test Suite: Multiple Elements Extraction
 */
async function testMultipleElementsExtraction() {
  console.log('\n--- Test: Multiple Elements Extraction ---');

  // Extract list items
  const listResponse = await extension.sendCommand('get_elements', {
    selector: '.items li'
  });
  assert(listResponse.success, 'List extraction should succeed');
  assert(listResponse.result.count === 3, 'Should find 3 items');
  console.log('  Extracted 3 list items');

  // Extract links
  const linksResponse = await extension.sendCommand('get_elements', {
    selector: 'a.link'
  });
  assert(linksResponse.success, 'Links extraction should succeed');
  assert(linksResponse.result.count === 2, 'Should find 2 links');
  console.log('  Extracted 2 links');

  console.log('PASSED: Multiple Elements Extraction');
  return true;
}

/**
 * Test Suite: Table Data Extraction
 */
async function testTableDataExtraction() {
  console.log('\n--- Test: Table Data Extraction ---');

  const response = await extension.sendCommand('extract_table', {
    selector: '#data-table'
  });

  assert(response.success, 'Table extraction should succeed');
  assert(response.result.headers.length === 2, 'Should have 2 headers');
  assert(response.result.rows.length === 2, 'Should have 2 data rows');
  console.log('  Extracted table structure');

  // Verify data
  assert(response.result.data[0].Name === 'Row1', 'First row name should match');
  assert(response.result.data[0].Value === 'Value1', 'First row value should match');
  console.log('  Table data correctly formatted');

  console.log('PASSED: Table Data Extraction');
  return true;
}

/**
 * Test Suite: Link Extraction
 */
async function testLinkExtraction() {
  console.log('\n--- Test: Link Extraction ---');

  // Extract with absolute URLs
  const absoluteResponse = await extension.sendCommand('extract_links', {
    absolute: true
  });
  assert(absoluteResponse.success, 'Link extraction should succeed');
  assert(absoluteResponse.result.count === 2, 'Should find 2 links');
  assert(absoluteResponse.result.links[0].href.startsWith('https://'), 'Should be absolute URL');
  console.log('  Extracted absolute URLs');

  // Extract with relative URLs
  const relativeResponse = await extension.sendCommand('extract_links', {
    absolute: false
  });
  assert(relativeResponse.success, 'Relative link extraction should succeed');
  assert(relativeResponse.result.links[0].href.startsWith('/'), 'Should be relative URL');
  console.log('  Extracted relative URLs');

  console.log('PASSED: Link Extraction');
  return true;
}

/**
 * Test Suite: Script-Based Extraction
 */
async function testScriptBasedExtraction() {
  console.log('\n--- Test: Script-Based Extraction ---');

  // Extract title via script
  const titleResponse = await extension.sendCommand('execute_script', {
    script: 'return document.title'
  });
  assert(titleResponse.success, 'Title script should succeed');
  assert(titleResponse.result.result === 'Test Page', 'Title should match');
  console.log('  Extracted title via script');

  // Extract multiple items via script
  const itemsResponse = await extension.sendCommand('execute_script', {
    script: 'return Array.from(document.querySelectorAll(".items li")).map(el => el.textContent)'
  });
  assert(itemsResponse.success, 'Items script should succeed');
  assert(Array.isArray(itemsResponse.result.result), 'Should return array');
  console.log('  Extracted items via script');

  console.log('PASSED: Script-Based Extraction');
  return true;
}

/**
 * Test Suite: Structured Data Extraction
 */
async function testStructuredDataExtraction() {
  console.log('\n--- Test: Structured Data Extraction ---');

  const response = await extension.sendCommand('extract_structured_data', {});

  assert(response.success, 'Structured data extraction should succeed');
  assert(response.result.jsonLd, 'Should have JSON-LD data');
  assert(response.result.openGraph, 'Should have Open Graph data');
  console.log('  Extracted JSON-LD and Open Graph data');

  // Verify JSON-LD
  assert(response.result.jsonLd[0]['@type'] === 'WebPage', 'JSON-LD type should match');
  console.log('  JSON-LD data correctly formatted');

  // Verify Open Graph
  assert(response.result.openGraph.title === 'Test Page', 'OG title should match');
  console.log('  Open Graph data correctly formatted');

  console.log('PASSED: Structured Data Extraction');
  return true;
}

/**
 * Test Suite: Page State Extraction
 */
async function testPageStateExtraction() {
  console.log('\n--- Test: Page State Extraction ---');

  const response = await extension.sendCommand('get_page_state', {});

  assert(response.success, 'Page state extraction should succeed');
  assert(response.result.url, 'Should have URL');
  assert(response.result.title, 'Should have title');
  assert(Array.isArray(response.result.links), 'Should have links array');
  console.log('  Extracted page state');

  // Verify links
  assert(response.result.links.length === 2, 'Should have 2 links');
  console.log('  Page state includes link data');

  console.log('PASSED: Page State Extraction');
  return true;
}

/**
 * Test Suite: JSON Data Extraction
 */
async function testJsonDataExtraction() {
  console.log('\n--- Test: JSON Data Extraction ---');

  const response = await extension.sendCommand('execute_script', {
    script: 'return JSON.parse(\'{"key": "value", "items": [1, 2, 3]}\')'
  });

  assert(response.success, 'JSON extraction should succeed');
  assert(typeof response.result.result === 'object', 'Should return object');
  assert(response.result.result.key === 'value', 'Key should match');
  assert(Array.isArray(response.result.result.items), 'Items should be array');
  console.log('  Extracted and parsed JSON data');

  console.log('PASSED: JSON Data Extraction');
  return true;
}

/**
 * Test Suite: Complete Extraction Flow
 */
async function testCompleteExtractionFlow() {
  console.log('\n--- Test: Complete Extraction Flow ---');

  // 1. Get page state
  const stateResponse = await extension.sendCommand('get_page_state', {});
  assert(stateResponse.success, 'Get page state should succeed');
  console.log('  Step 1: Got page state');

  // 2. Extract specific content
  const contentResponse = await extension.sendCommand('get_content', {
    selector: '#content'
  });
  assert(contentResponse.success, 'Get content should succeed');
  console.log('  Step 2: Extracted specific content');

  // 3. Extract table data
  const tableResponse = await extension.sendCommand('extract_table', {
    selector: '#data-table'
  });
  assert(tableResponse.success, 'Extract table should succeed');
  console.log('  Step 3: Extracted table data');

  // 4. Extract all links
  const linksResponse = await extension.sendCommand('extract_links', {});
  assert(linksResponse.success, 'Extract links should succeed');
  console.log('  Step 4: Extracted all links');

  // 5. Run custom extraction script
  const scriptResponse = await extension.sendCommand('execute_script', {
    script: 'return { title: document.title, links: document.querySelectorAll("a").length }'
  });
  assert(scriptResponse.success, 'Script should succeed');
  console.log('  Step 5: Ran custom extraction script');

  console.log('PASSED: Complete Extraction Flow');
  return true;
}

/**
 * Run all data extraction tests
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Data Extraction Test Scenarios');
  console.log('='.repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const tests = [
    { name: 'Full Page HTML Extraction', fn: testFullPageHtmlExtraction },
    { name: 'Text Content Extraction', fn: testTextContentExtraction },
    { name: 'Selector-Based Extraction', fn: testSelectorBasedExtraction },
    { name: 'Element Attribute Extraction', fn: testElementAttributeExtraction },
    { name: 'Multiple Elements Extraction', fn: testMultipleElementsExtraction },
    { name: 'Table Data Extraction', fn: testTableDataExtraction },
    { name: 'Link Extraction', fn: testLinkExtraction },
    { name: 'Script-Based Extraction', fn: testScriptBasedExtraction },
    { name: 'Structured Data Extraction', fn: testStructuredDataExtraction },
    { name: 'Page State Extraction', fn: testPageStateExtraction },
    { name: 'JSON Data Extraction', fn: testJsonDataExtraction },
    { name: 'Complete Extraction Flow', fn: testCompleteExtractionFlow }
  ];

  try {
    await testUtils.setup();

    for (const test of tests) {
      try {
        await test.fn();
        results.passed++;
        results.tests.push({ name: test.name, status: 'PASSED' });
      } catch (error) {
        results.failed++;
        results.tests.push({ name: test.name, status: 'FAILED', error: error.message });
        console.log(`FAILED: ${test.name} - ${error.message}`);
      }
    }
  } finally {
    await testUtils.teardown();
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Data Extraction Test Summary');
  console.log('='.repeat(60));
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total:  ${results.tests.length}`);

  if (results.failed > 0) {
    console.log('\nFailed tests:');
    results.tests
      .filter(t => t.status === 'FAILED')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
  }

  return results.failed === 0;
}

// Export for external use
module.exports = { runTests, testUtils };

// Run if called directly
if (require.main === module) {
  runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}
