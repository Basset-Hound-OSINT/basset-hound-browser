/**
 * Data Extraction Test Scenarios
 *
 * Tests content extraction functionality between extension and browser.
 */

// Skip in CI environments - these tests require WebSocket infrastructure
const shouldSkip = process.env.CI === 'true' || process.env.SKIP_INTEGRATION_TESTS === 'true';
const describeOrSkip = shouldSkip ? describe.skip : describe;

const { TestServer } = require('../harness/test-server');
const { MockExtension } = require('../harness/mock-extension');
const { MockBrowser } = require('../harness/mock-browser');

// Test configuration
const TEST_PORT = 8783;
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

describeOrSkip('Data Extraction Test Scenarios', () => {
  beforeAll(async () => {
    server = new TestServer({ port: TEST_PORT });
    setupExtractionHandlers();
    await server.start();

    extension = new MockExtension({ url: TEST_URL });
    browser = new MockBrowser({ url: TEST_URL });

    await extension.connect();
    await browser.connect();
  });

  afterAll(async () => {
    try {
      if (extension && extension.isConnected) {
        extension.disconnect();
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    try {
      if (browser && browser.isConnected) {
        browser.disconnect();
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    try {
      if (server) {
        await server.stop();
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    // Reset references
    extension = null;
    browser = null;
    server = null;
  });

  describe('Full Page HTML Extraction', () => {
    test('should extract full HTML content', async () => {
      const response = await extension.sendCommand('get_content', { type: 'html' });

      expect(response.success).toBe(true);
      expect(response.result.content).toContain('<!DOCTYPE html>');
      expect(response.result.content).toContain('<body>');
    });
  });

  describe('Text Content Extraction', () => {
    test('should extract text content', async () => {
      const response = await extension.sendCommand('get_text', {});

      expect(response.success).toBe(true);
      expect(response.result.text).toContain('Welcome');
      expect(response.result.text).toContain('Item 1');
    });
  });

  describe('Selector-Based Extraction', () => {
    test('should extract by ID selector', async () => {
      const idResponse = await extension.sendCommand('get_content', { selector: '#main-title' });
      expect(idResponse.success).toBe(true);
      expect(idResponse.result.content).toContain('Welcome');
    });

    test('should extract by class selector', async () => {
      const classResponse = await extension.sendCommand('get_content', { selector: '.intro' });
      expect(classResponse.success).toBe(true);
    });

    test('should extract nested content', async () => {
      const nestedResponse = await extension.sendCommand('get_content', { selector: '#content' });
      expect(nestedResponse.success).toBe(true);
      expect(nestedResponse.result.content).toContain('Item');
    });
  });

  describe('Element Attribute Extraction', () => {
    test('should extract ID attribute', async () => {
      const idResponse = await extension.sendCommand('get_attribute', {
        selector: '#main-title',
        attribute: 'id'
      });
      expect(idResponse.success).toBe(true);
      expect(idResponse.result.value).toBe('main-title');
    });

    test('should extract class attribute', async () => {
      const classResponse = await extension.sendCommand('get_attribute', {
        selector: '.intro',
        attribute: 'class'
      });
      expect(classResponse.success).toBe(true);
      expect(classResponse.result.value).toBe('intro');
    });

    test('should extract data attribute', async () => {
      const dataResponse = await extension.sendCommand('get_attribute', {
        selector: '.items li:first-child',
        attribute: 'data-id'
      });
      expect(dataResponse.success).toBe(true);
      expect(dataResponse.result.value).toBe('1');
    });
  });

  describe('Multiple Elements Extraction', () => {
    test('should extract list items', async () => {
      const listResponse = await extension.sendCommand('get_elements', {
        selector: '.items li'
      });
      expect(listResponse.success).toBe(true);
      expect(listResponse.result.count).toBe(3);
    });

    test('should extract links', async () => {
      const linksResponse = await extension.sendCommand('get_elements', {
        selector: 'a.link'
      });
      expect(linksResponse.success).toBe(true);
      expect(linksResponse.result.count).toBe(2);
    });
  });

  describe('Table Data Extraction', () => {
    test('should extract table structure', async () => {
      const response = await extension.sendCommand('extract_table', {
        selector: '#data-table'
      });

      expect(response.success).toBe(true);
      expect(response.result.headers.length).toBe(2);
      expect(response.result.rows.length).toBe(2);
    });

    test('should format table data correctly', async () => {
      const response = await extension.sendCommand('extract_table', {
        selector: '#data-table'
      });

      expect(response.result.data[0].Name).toBe('Row1');
      expect(response.result.data[0].Value).toBe('Value1');
    });
  });

  describe('Link Extraction', () => {
    test('should extract absolute URLs', async () => {
      const absoluteResponse = await extension.sendCommand('extract_links', {
        absolute: true
      });
      expect(absoluteResponse.success).toBe(true);
      expect(absoluteResponse.result.count).toBe(2);
      expect(absoluteResponse.result.links[0].href.startsWith('https://')).toBe(true);
    });

    test('should extract relative URLs', async () => {
      const relativeResponse = await extension.sendCommand('extract_links', {
        absolute: false
      });
      expect(relativeResponse.success).toBe(true);
      expect(relativeResponse.result.links[0].href.startsWith('/')).toBe(true);
    });
  });

  describe('Script-Based Extraction', () => {
    test('should extract title via script', async () => {
      const titleResponse = await extension.sendCommand('execute_script', {
        script: 'return document.title'
      });
      expect(titleResponse.success).toBe(true);
      expect(titleResponse.result.result).toBe('Test Page');
    });

    test('should extract multiple items via script', async () => {
      const itemsResponse = await extension.sendCommand('execute_script', {
        script: 'return Array.from(document.querySelectorAll(".items li")).map(el => el.textContent)'
      });
      expect(itemsResponse.success).toBe(true);
      expect(Array.isArray(itemsResponse.result.result)).toBe(true);
    });
  });

  describe('Structured Data Extraction', () => {
    test('should extract JSON-LD and Open Graph data', async () => {
      const response = await extension.sendCommand('extract_structured_data', {});

      expect(response.success).toBe(true);
      expect(response.result.jsonLd).toBeTruthy();
      expect(response.result.openGraph).toBeTruthy();
    });

    test('should format JSON-LD data correctly', async () => {
      const response = await extension.sendCommand('extract_structured_data', {});

      expect(response.result.jsonLd[0]['@type']).toBe('WebPage');
    });

    test('should format Open Graph data correctly', async () => {
      const response = await extension.sendCommand('extract_structured_data', {});

      expect(response.result.openGraph.title).toBe('Test Page');
    });
  });

  describe('Page State Extraction', () => {
    test('should extract page state', async () => {
      const response = await extension.sendCommand('get_page_state', {});

      expect(response.success).toBe(true);
      expect(response.result.url).toBeTruthy();
      expect(response.result.title).toBeTruthy();
      expect(Array.isArray(response.result.links)).toBe(true);
    });

    test('should include link data in page state', async () => {
      const response = await extension.sendCommand('get_page_state', {});

      expect(response.result.links.length).toBe(2);
    });
  });

  describe('JSON Data Extraction', () => {
    test('should extract and parse JSON data', async () => {
      const response = await extension.sendCommand('execute_script', {
        script: 'return JSON.parse(\'{"key": "value", "items": [1, 2, 3]}\')'
      });

      expect(response.success).toBe(true);
      expect(typeof response.result.result).toBe('object');
      expect(response.result.result.key).toBe('value');
      expect(Array.isArray(response.result.result.items)).toBe(true);
    });
  });

  describe('Complete Extraction Flow', () => {
    test('should complete full extraction workflow', async () => {
      // 1. Get page state
      const stateResponse = await extension.sendCommand('get_page_state', {});
      expect(stateResponse.success).toBe(true);

      // 2. Extract specific content
      const contentResponse = await extension.sendCommand('get_content', {
        selector: '#content'
      });
      expect(contentResponse.success).toBe(true);

      // 3. Extract table data
      const tableResponse = await extension.sendCommand('extract_table', {
        selector: '#data-table'
      });
      expect(tableResponse.success).toBe(true);

      // 4. Extract all links
      const linksResponse = await extension.sendCommand('extract_links', {});
      expect(linksResponse.success).toBe(true);

      // 5. Run custom extraction script
      const scriptResponse = await extension.sendCommand('execute_script', {
        script: 'return { title: document.title, links: document.querySelectorAll("a").length }'
      });
      expect(scriptResponse.success).toBe(true);
    });
  });
});

// Export for external use
module.exports = { testUtils };
