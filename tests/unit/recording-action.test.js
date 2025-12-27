/**
 * Basset Hound Browser - Recording Action Unit Tests
 * Tests for action types, Action class, and ActionSerializer exports
 */

// Mock uuid module
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234')
}));

const { Action, ActionSerializer, ACTION_TYPES } = require('../../recording/action');

describe('ACTION_TYPES Enumeration', () => {
  test('should define all action types', () => {
    expect(ACTION_TYPES).toHaveProperty('NAVIGATE');
    expect(ACTION_TYPES).toHaveProperty('CLICK');
    expect(ACTION_TYPES).toHaveProperty('TYPE');
    expect(ACTION_TYPES).toHaveProperty('SCROLL');
    expect(ACTION_TYPES).toHaveProperty('WAIT');
    expect(ACTION_TYPES).toHaveProperty('SCREENSHOT');
    expect(ACTION_TYPES).toHaveProperty('EXECUTE_SCRIPT');
    expect(ACTION_TYPES).toHaveProperty('KEY_PRESS');
    expect(ACTION_TYPES).toHaveProperty('HOVER');
    expect(ACTION_TYPES).toHaveProperty('SELECT');
    expect(ACTION_TYPES).toHaveProperty('FOCUS');
    expect(ACTION_TYPES).toHaveProperty('BLUR');
    expect(ACTION_TYPES).toHaveProperty('DRAG_DROP');
    expect(ACTION_TYPES).toHaveProperty('ASSERT');
    expect(ACTION_TYPES).toHaveProperty('COMMENT');
  });

  test('should have correct action type values', () => {
    expect(ACTION_TYPES.NAVIGATE).toBe('navigate');
    expect(ACTION_TYPES.CLICK).toBe('click');
    expect(ACTION_TYPES.TYPE).toBe('type');
    expect(ACTION_TYPES.SCROLL).toBe('scroll');
    expect(ACTION_TYPES.WAIT).toBe('wait');
    expect(ACTION_TYPES.SCREENSHOT).toBe('screenshot');
    expect(ACTION_TYPES.EXECUTE_SCRIPT).toBe('execute_script');
    expect(ACTION_TYPES.KEY_PRESS).toBe('key_press');
    expect(ACTION_TYPES.HOVER).toBe('hover');
    expect(ACTION_TYPES.SELECT).toBe('select');
    expect(ACTION_TYPES.ASSERT).toBe('assert');
    expect(ACTION_TYPES.COMMENT).toBe('comment');
  });
});

describe('Action Class', () => {
  describe('Constructor', () => {
    test('should create action with default values', () => {
      const action = new Action();

      expect(action.id).toBe('mock-uuid-1234');
      expect(action.type).toBe(ACTION_TYPES.CLICK);
      expect(action.timestamp).toBeDefined();
      expect(action.timeSinceStart).toBe(0);
      expect(action.timeSincePrevious).toBe(0);
      expect(action.data).toEqual({});
      expect(action.metadata).toEqual({});
      expect(action.pageUrl).toBe('');
      expect(action.pageTitle).toBe('');
    });

    test('should create action with custom values', () => {
      const action = new Action({
        id: 'custom-id',
        type: ACTION_TYPES.NAVIGATE,
        timestamp: 1234567890,
        timeSinceStart: 1000,
        timeSincePrevious: 500,
        data: { url: 'https://example.com' },
        metadata: { recorded: true },
        pageUrl: 'https://test.com',
        pageTitle: 'Test Page'
      });

      expect(action.id).toBe('custom-id');
      expect(action.type).toBe(ACTION_TYPES.NAVIGATE);
      expect(action.timestamp).toBe(1234567890);
      expect(action.timeSinceStart).toBe(1000);
      expect(action.timeSincePrevious).toBe(500);
      expect(action.data.url).toBe('https://example.com');
      expect(action.metadata.recorded).toBe(true);
      expect(action.pageUrl).toBe('https://test.com');
      expect(action.pageTitle).toBe('Test Page');
    });
  });

  describe('toJSON', () => {
    test('should serialize action to plain object', () => {
      const action = new Action({
        type: ACTION_TYPES.CLICK,
        data: { selector: '#button' },
        pageUrl: 'https://example.com'
      });

      const json = action.toJSON();

      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('type', ACTION_TYPES.CLICK);
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('data');
      expect(json.data.selector).toBe('#button');
      expect(json).toHaveProperty('pageUrl', 'https://example.com');
    });
  });

  describe('fromJSON', () => {
    test('should create Action from plain object', () => {
      const data = {
        id: 'action-1',
        type: ACTION_TYPES.TYPE,
        timestamp: Date.now(),
        data: { selector: '#input', text: 'hello' }
      };

      const action = Action.fromJSON(data);

      expect(action).toBeInstanceOf(Action);
      expect(action.id).toBe('action-1');
      expect(action.type).toBe(ACTION_TYPES.TYPE);
      expect(action.data.text).toBe('hello');
    });
  });

  describe('Static factory methods', () => {
    describe('navigate', () => {
      test('should create navigate action', () => {
        const action = Action.navigate('https://example.com');

        expect(action.type).toBe(ACTION_TYPES.NAVIGATE);
        expect(action.data.url).toBe('https://example.com');
        expect(action.data.waitForLoad).toBe(true);
      });

      test('should accept waitForLoad option', () => {
        const action = Action.navigate('https://example.com', { waitForLoad: false });

        expect(action.data.waitForLoad).toBe(false);
      });
    });

    describe('click', () => {
      test('should create click action', () => {
        const action = Action.click('#submit-button');

        expect(action.type).toBe(ACTION_TYPES.CLICK);
        expect(action.data.selector).toBe('#submit-button');
        expect(action.data.button).toBe('left');
        expect(action.data.clickCount).toBe(1);
        expect(action.data.humanize).toBe(true);
      });

      test('should accept click options', () => {
        const action = Action.click('#button', {
          x: 100,
          y: 200,
          button: 'right',
          clickCount: 2,
          humanize: false
        });

        expect(action.data.x).toBe(100);
        expect(action.data.y).toBe(200);
        expect(action.data.button).toBe('right');
        expect(action.data.clickCount).toBe(2);
        expect(action.data.humanize).toBe(false);
      });
    });

    describe('type', () => {
      test('should create type action', () => {
        const action = Action.type('#email', 'test@example.com');

        expect(action.type).toBe(ACTION_TYPES.TYPE);
        expect(action.data.selector).toBe('#email');
        expect(action.data.text).toBe('test@example.com');
        expect(action.data.clearFirst).toBe(false);
        expect(action.data.humanize).toBe(true);
      });

      test('should accept type options', () => {
        const action = Action.type('#input', 'text', {
          clearFirst: true,
          humanize: false,
          delay: 100
        });

        expect(action.data.clearFirst).toBe(true);
        expect(action.data.humanize).toBe(false);
        expect(action.data.delay).toBe(100);
      });
    });

    describe('scroll', () => {
      test('should create scroll action', () => {
        const action = Action.scroll({ x: 0, y: 500 });

        expect(action.type).toBe(ACTION_TYPES.SCROLL);
        expect(action.data.x).toBe(0);
        expect(action.data.y).toBe(500);
        expect(action.data.behavior).toBe('smooth');
      });

      test('should accept selector for element scroll', () => {
        const action = Action.scroll({ selector: '#content' });

        expect(action.data.selector).toBe('#content');
      });
    });

    describe('wait', () => {
      test('should create wait action with duration', () => {
        const action = Action.wait({ duration: 2000 });

        expect(action.type).toBe(ACTION_TYPES.WAIT);
        expect(action.data.duration).toBe(2000);
        expect(action.data.timeout).toBe(30000);
      });

      test('should create wait action with selector', () => {
        const action = Action.wait({ selector: '#element' });

        expect(action.data.selector).toBe('#element');
      });

      test('should create wait action with condition', () => {
        const action = Action.wait({ condition: 'networkIdle' });

        expect(action.data.condition).toBe('networkIdle');
      });
    });

    describe('screenshot', () => {
      test('should create screenshot action', () => {
        const action = Action.screenshot();

        expect(action.type).toBe(ACTION_TYPES.SCREENSHOT);
        expect(action.data.fullPage).toBe(false);
        expect(action.data.format).toBe('png');
      });

      test('should accept screenshot options', () => {
        const action = Action.screenshot({
          name: 'my-screenshot',
          fullPage: true,
          selector: '#element',
          format: 'jpeg'
        });

        expect(action.data.name).toBe('my-screenshot');
        expect(action.data.fullPage).toBe(true);
        expect(action.data.selector).toBe('#element');
        expect(action.data.format).toBe('jpeg');
      });
    });

    describe('executeScript', () => {
      test('should create execute script action', () => {
        const action = Action.executeScript('return document.title');

        expect(action.type).toBe(ACTION_TYPES.EXECUTE_SCRIPT);
        expect(action.data.script).toBe('return document.title');
        expect(action.data.args).toEqual([]);
        expect(action.data.waitForResult).toBe(true);
      });

      test('should accept script options', () => {
        const action = Action.executeScript('console.log(arg)', {
          args: ['test'],
          waitForResult: false
        });

        expect(action.data.args).toEqual(['test']);
        expect(action.data.waitForResult).toBe(false);
      });
    });

    describe('keyPress', () => {
      test('should create key press action', () => {
        const action = Action.keyPress('Enter');

        expect(action.type).toBe(ACTION_TYPES.KEY_PRESS);
        expect(action.data.key).toBe('Enter');
        expect(action.data.modifiers).toEqual({});
        expect(action.data.repeat).toBe(1);
      });

      test('should accept key press options', () => {
        const action = Action.keyPress('a', {
          modifiers: { ctrl: true },
          repeat: 3
        });

        expect(action.data.modifiers).toEqual({ ctrl: true });
        expect(action.data.repeat).toBe(3);
      });
    });

    describe('hover', () => {
      test('should create hover action', () => {
        const action = Action.hover('#menu-item');

        expect(action.type).toBe(ACTION_TYPES.HOVER);
        expect(action.data.selector).toBe('#menu-item');
        expect(action.data.duration).toBe(100);
      });
    });

    describe('select', () => {
      test('should create select action', () => {
        const action = Action.select('#dropdown', 'option1');

        expect(action.type).toBe(ACTION_TYPES.SELECT);
        expect(action.data.selector).toBe('#dropdown');
        expect(action.data.value).toEqual(['option1']);
      });

      test('should accept array of values', () => {
        const action = Action.select('#multi-select', ['opt1', 'opt2']);

        expect(action.data.value).toEqual(['opt1', 'opt2']);
      });
    });

    describe('assert', () => {
      test('should create assert action', () => {
        const action = Action.assert({
          type: 'exists',
          selector: '#element'
        });

        expect(action.type).toBe(ACTION_TYPES.ASSERT);
        expect(action.data.type).toBe('exists');
        expect(action.data.selector).toBe('#element');
      });

      test('should accept assertion options', () => {
        const action = Action.assert({
          type: 'text',
          selector: '#heading',
          expected: 'Welcome',
          message: 'Heading should contain welcome text'
        });

        expect(action.data.type).toBe('text');
        expect(action.data.expected).toBe('Welcome');
        expect(action.data.message).toBe('Heading should contain welcome text');
      });
    });

    describe('comment', () => {
      test('should create comment action', () => {
        const action = Action.comment('This is a test step');

        expect(action.type).toBe(ACTION_TYPES.COMMENT);
        expect(action.data.comment).toBe('This is a test step');
      });
    });
  });

  describe('substituteVariables', () => {
    test('should substitute variables in string data', () => {
      const action = new Action({
        type: ACTION_TYPES.TYPE,
        data: {
          selector: '#username',
          text: '{{username}}'
        }
      });

      const substituted = action.substituteVariables({ username: 'john_doe' });

      expect(substituted.data.text).toBe('john_doe');
    });

    test('should substitute multiple variables', () => {
      const action = new Action({
        type: ACTION_TYPES.NAVIGATE,
        data: {
          url: 'https://{{host}}/{{path}}'
        }
      });

      const substituted = action.substituteVariables({
        host: 'example.com',
        path: 'login'
      });

      expect(substituted.data.url).toBe('https://example.com/login');
    });

    test('should preserve unmatched variables', () => {
      const action = new Action({
        type: ACTION_TYPES.TYPE,
        data: { text: '{{unknown}}' }
      });

      const substituted = action.substituteVariables({ other: 'value' });

      expect(substituted.data.text).toBe('{{unknown}}');
    });

    test('should return new Action instance', () => {
      const action = new Action({
        type: ACTION_TYPES.CLICK,
        data: { selector: '#btn' }
      });

      const substituted = action.substituteVariables({});

      expect(substituted).not.toBe(action);
      expect(substituted).toBeInstanceOf(Action);
    });

    test('should handle nested objects', () => {
      const action = new Action({
        type: ACTION_TYPES.ASSERT,
        data: {
          type: 'attribute',
          selector: '#input',
          expected: '{{expectedValue}}'
        }
      });

      const substituted = action.substituteVariables({ expectedValue: 'test' });

      expect(substituted.data.expected).toBe('test');
    });

    test('should handle arrays', () => {
      const action = new Action({
        type: ACTION_TYPES.SELECT,
        data: {
          selector: '#multi',
          value: ['{{opt1}}', '{{opt2}}']
        }
      });

      const substituted = action.substituteVariables({ opt1: 'a', opt2: 'b' });

      expect(substituted.data.value).toEqual(['a', 'b']);
    });
  });
});

describe('ActionSerializer', () => {
  describe('toJSON / fromJSON', () => {
    test('should serialize actions to JSON string', () => {
      const actions = [
        Action.navigate('https://example.com'),
        Action.click('#button')
      ];

      const json = ActionSerializer.toJSON(actions);

      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    test('should deserialize actions from JSON string', () => {
      const actions = [
        Action.navigate('https://example.com'),
        Action.click('#button')
      ];

      const json = ActionSerializer.toJSON(actions);
      const restored = ActionSerializer.fromJSON(json);

      expect(restored).toHaveLength(2);
      expect(restored[0]).toBeInstanceOf(Action);
      expect(restored[0].type).toBe(ACTION_TYPES.NAVIGATE);
      expect(restored[1].type).toBe(ACTION_TYPES.CLICK);
    });
  });

  describe('toPythonSelenium', () => {
    test('should generate Python Selenium script with imports', () => {
      const actions = [Action.navigate('https://example.com')];

      const script = ActionSerializer.toPythonSelenium(actions);

      expect(script).toContain('from selenium import webdriver');
      expect(script).toContain('from selenium.webdriver.common.by import By');
      expect(script).toContain('from selenium.webdriver.support.ui import WebDriverWait');
    });

    test('should generate setup code', () => {
      const actions = [];

      const script = ActionSerializer.toPythonSelenium(actions);

      expect(script).toContain('driver = webdriver.Chrome()');
      expect(script).toContain('wait = WebDriverWait(driver, 10)');
    });

    test('should generate cleanup code', () => {
      const actions = [];

      const script = ActionSerializer.toPythonSelenium(actions);

      expect(script).toContain('driver.quit()');
    });

    test('should convert navigate action', () => {
      const actions = [Action.navigate('https://example.com')];

      const script = ActionSerializer.toPythonSelenium(actions);

      expect(script).toContain('driver.get("https://example.com")');
    });

    test('should convert click action', () => {
      const actions = [Action.click('#button')];

      const script = ActionSerializer.toPythonSelenium(actions);

      expect(script).toContain('wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#button"))).click()');
    });

    test('should convert type action', () => {
      const actions = [Action.type('#input', 'hello')];

      const script = ActionSerializer.toPythonSelenium(actions);

      expect(script).toContain('send_keys("hello")');
    });

    test('should convert type action with clearFirst', () => {
      const actions = [Action.type('#input', 'hello', { clearFirst: true })];

      const script = ActionSerializer.toPythonSelenium(actions);

      expect(script).toContain('element.clear()');
    });

    test('should convert scroll action', () => {
      const actions = [Action.scroll({ x: 0, y: 500 })];

      const script = ActionSerializer.toPythonSelenium(actions);

      expect(script).toContain('execute_script("window.scrollTo(0, 500)")');
    });

    test('should convert scroll to element action', () => {
      const actions = [Action.scroll({ selector: '#element' })];

      const script = ActionSerializer.toPythonSelenium(actions);

      expect(script).toContain("scrollIntoView");
    });

    test('should convert wait duration action', () => {
      const actions = [Action.wait({ duration: 2000 })];

      const script = ActionSerializer.toPythonSelenium(actions);

      expect(script).toContain('time.sleep(2)');
    });

    test('should convert wait selector action', () => {
      const actions = [Action.wait({ selector: '#element' })];

      const script = ActionSerializer.toPythonSelenium(actions);

      expect(script).toContain('presence_of_element_located');
    });

    test('should convert screenshot action', () => {
      const actions = [Action.screenshot({ name: 'test' })];

      const script = ActionSerializer.toPythonSelenium(actions);

      expect(script).toContain('save_screenshot("test.png")');
    });

    test('should convert key press action', () => {
      const actions = [Action.keyPress('Enter')];

      const script = ActionSerializer.toPythonSelenium(actions);

      expect(script).toContain('Keys.ENTER');
    });

    test('should convert hover action', () => {
      const actions = [Action.hover('#menu')];

      const script = ActionSerializer.toPythonSelenium(actions);

      expect(script).toContain('ActionChains');
      expect(script).toContain('move_to_element');
    });

    test('should convert select action', () => {
      const actions = [Action.select('#dropdown', 'value1')];

      const script = ActionSerializer.toPythonSelenium(actions);

      expect(script).toContain('Select(');
      expect(script).toContain('select_by_value');
    });

    test('should convert comment action', () => {
      const actions = [Action.comment('This is a step')];

      const script = ActionSerializer.toPythonSelenium(actions);

      expect(script).toContain('# This is a step');
    });

    test('should use custom variable names', () => {
      const actions = [Action.navigate('https://example.com')];

      const script = ActionSerializer.toPythonSelenium(actions, {
        driverVar: 'browser',
        waitVar: 'waiter'
      });

      expect(script).toContain('browser = webdriver.Chrome()');
      expect(script).toContain('waiter = WebDriverWait(browser, 10)');
      expect(script).toContain('browser.get(');
    });

    test('should exclude imports when specified', () => {
      const actions = [];

      const script = ActionSerializer.toPythonSelenium(actions, {
        includeImports: false
      });

      expect(script).not.toContain('from selenium import');
    });

    test('should exclude setup when specified', () => {
      const actions = [];

      const script = ActionSerializer.toPythonSelenium(actions, {
        includeSetup: false
      });

      expect(script).not.toContain('driver = webdriver.Chrome()');
      expect(script).not.toContain('driver.quit()');
    });

    test('should escape special characters in strings', () => {
      const actions = [Action.navigate('https://example.com/path?q="test"')];

      const script = ActionSerializer.toPythonSelenium(actions);

      expect(script).toContain('\\"test\\"');
    });
  });

  describe('toJavaScriptPuppeteer', () => {
    test('should generate Puppeteer script with imports', () => {
      const actions = [];

      const script = ActionSerializer.toJavaScriptPuppeteer(actions);

      expect(script).toContain("const puppeteer = require('puppeteer')");
    });

    test('should generate async IIFE wrapper', () => {
      const actions = [];

      const script = ActionSerializer.toJavaScriptPuppeteer(actions);

      expect(script).toContain('(async () => {');
      expect(script).toContain('})();');
    });

    test('should generate browser launch and page creation', () => {
      const actions = [];

      const script = ActionSerializer.toJavaScriptPuppeteer(actions);

      expect(script).toContain('await puppeteer.launch');
      expect(script).toContain('await browser.newPage()');
    });

    test('should convert navigate action', () => {
      const actions = [Action.navigate('https://example.com')];

      const script = ActionSerializer.toJavaScriptPuppeteer(actions);

      expect(script).toContain("await page.goto('https://example.com'");
    });

    test('should convert click action', () => {
      const actions = [Action.click('#button')];

      const script = ActionSerializer.toJavaScriptPuppeteer(actions);

      expect(script).toContain("await page.click('#button')");
    });

    test('should convert type action', () => {
      const actions = [Action.type('#input', 'hello')];

      const script = ActionSerializer.toJavaScriptPuppeteer(actions);

      expect(script).toContain("await page.type('#input', 'hello')");
    });

    test('should convert type with clearFirst', () => {
      const actions = [Action.type('#input', 'hello', { clearFirst: true })];

      const script = ActionSerializer.toJavaScriptPuppeteer(actions);

      expect(script).toContain('clickCount: 3');
    });

    test('should convert scroll action', () => {
      const actions = [Action.scroll({ x: 0, y: 500 })];

      const script = ActionSerializer.toJavaScriptPuppeteer(actions);

      expect(script).toContain('page.evaluate');
      expect(script).toContain('scrollTo(0, 500)');
    });

    test('should convert wait duration action', () => {
      const actions = [Action.wait({ duration: 2000 })];

      const script = ActionSerializer.toJavaScriptPuppeteer(actions);

      expect(script).toContain('waitForTimeout(2000)');
    });

    test('should convert wait selector action', () => {
      const actions = [Action.wait({ selector: '#element' })];

      const script = ActionSerializer.toJavaScriptPuppeteer(actions);

      expect(script).toContain("waitForSelector('#element')");
    });

    test('should convert screenshot action', () => {
      const actions = [Action.screenshot({ name: 'test', fullPage: true })];

      const script = ActionSerializer.toJavaScriptPuppeteer(actions);

      expect(script).toContain("screenshot({ path: 'test.png'");
      expect(script).toContain('fullPage: true');
    });

    test('should convert key press action', () => {
      const actions = [Action.keyPress('Enter')];

      const script = ActionSerializer.toJavaScriptPuppeteer(actions);

      expect(script).toContain("keyboard.press('Enter')");
    });

    test('should convert hover action', () => {
      const actions = [Action.hover('#menu')];

      const script = ActionSerializer.toJavaScriptPuppeteer(actions);

      expect(script).toContain("await page.hover('#menu')");
    });

    test('should convert select action', () => {
      const actions = [Action.select('#dropdown', 'value1')];

      const script = ActionSerializer.toJavaScriptPuppeteer(actions);

      expect(script).toContain("await page.select('#dropdown', 'value1')");
    });

    test('should convert comment action', () => {
      const actions = [Action.comment('Test step')];

      const script = ActionSerializer.toJavaScriptPuppeteer(actions);

      expect(script).toContain('// Test step');
    });

    test('should use custom variable names', () => {
      const actions = [Action.click('#btn')];

      const script = ActionSerializer.toJavaScriptPuppeteer(actions, {
        pageVar: 'myPage',
        browserVar: 'myBrowser'
      });

      expect(script).toContain('const myBrowser = await puppeteer.launch');
      expect(script).toContain("await myPage.click('#btn')");
    });

    test('should close browser at end', () => {
      const actions = [];

      const script = ActionSerializer.toJavaScriptPuppeteer(actions);

      expect(script).toContain('await browser.close()');
    });
  });

  describe('toPlaywright', () => {
    test('should generate Playwright script with imports', () => {
      const actions = [];

      const script = ActionSerializer.toPlaywright(actions);

      expect(script).toContain("const { chromium } = require('playwright')");
    });

    test('should generate browser context and page', () => {
      const actions = [];

      const script = ActionSerializer.toPlaywright(actions);

      expect(script).toContain('await chromium.launch');
      expect(script).toContain('await browser.newContext()');
      expect(script).toContain('await context.newPage()');
    });

    test('should convert navigate action', () => {
      const actions = [Action.navigate('https://example.com')];

      const script = ActionSerializer.toPlaywright(actions);

      expect(script).toContain("await page.goto('https://example.com')");
    });

    test('should convert click action', () => {
      const actions = [Action.click('#button')];

      const script = ActionSerializer.toPlaywright(actions);

      expect(script).toContain("await page.click('#button')");
    });

    test('should convert type action', () => {
      const actions = [Action.type('#input', 'hello')];

      const script = ActionSerializer.toPlaywright(actions);

      expect(script).toContain("await page.type('#input', 'hello')");
    });

    test('should use fill for type with clearFirst', () => {
      const actions = [Action.type('#input', 'hello', { clearFirst: true })];

      const script = ActionSerializer.toPlaywright(actions);

      expect(script).toContain("await page.fill('#input', 'hello')");
    });

    test('should convert scroll to element with locator', () => {
      const actions = [Action.scroll({ selector: '#element' })];

      const script = ActionSerializer.toPlaywright(actions);

      expect(script).toContain("page.locator('#element').scrollIntoViewIfNeeded()");
    });

    test('should convert wait duration action', () => {
      const actions = [Action.wait({ duration: 2000 })];

      const script = ActionSerializer.toPlaywright(actions);

      expect(script).toContain('waitForTimeout(2000)');
    });

    test('should convert wait selector action', () => {
      const actions = [Action.wait({ selector: '#element' })];

      const script = ActionSerializer.toPlaywright(actions);

      expect(script).toContain("waitForSelector('#element')");
    });

    test('should convert screenshot action', () => {
      const actions = [Action.screenshot({ name: 'test' })];

      const script = ActionSerializer.toPlaywright(actions);

      expect(script).toContain("screenshot({ path: 'test.png'");
    });

    test('should convert key press action', () => {
      const actions = [Action.keyPress('Enter')];

      const script = ActionSerializer.toPlaywright(actions);

      expect(script).toContain("keyboard.press('Enter')");
    });

    test('should convert hover action', () => {
      const actions = [Action.hover('#menu')];

      const script = ActionSerializer.toPlaywright(actions);

      expect(script).toContain("await page.hover('#menu')");
    });

    test('should convert select action with selectOption', () => {
      const actions = [Action.select('#dropdown', 'value1')];

      const script = ActionSerializer.toPlaywright(actions);

      expect(script).toContain("await page.selectOption('#dropdown', 'value1')");
    });

    test('should convert comment action', () => {
      const actions = [Action.comment('Test step')];

      const script = ActionSerializer.toPlaywright(actions);

      expect(script).toContain('// Test step');
    });

    test('should use custom variable names', () => {
      const actions = [Action.click('#btn')];

      const script = ActionSerializer.toPlaywright(actions, {
        pageVar: 'myPage',
        browserVar: 'myBrowser',
        contextVar: 'myContext'
      });

      expect(script).toContain('const myBrowser = await chromium.launch');
      expect(script).toContain('const myContext = await myBrowser.newContext()');
      expect(script).toContain('const myPage = await myContext.newPage()');
      expect(script).toContain("await myPage.click('#btn')");
    });

    test('should close browser at end', () => {
      const actions = [];

      const script = ActionSerializer.toPlaywright(actions);

      expect(script).toContain('await browser.close()');
    });

    test('should exclude imports when specified', () => {
      const actions = [];

      const script = ActionSerializer.toPlaywright(actions, {
        includeImports: false
      });

      expect(script).not.toContain("require('playwright')");
    });

    test('should exclude setup when specified', () => {
      const actions = [Action.click('#btn')];

      const script = ActionSerializer.toPlaywright(actions, {
        includeSetup: false
      });

      expect(script).not.toContain('chromium.launch');
      expect(script).not.toContain('browser.close()');
      expect(script).toContain("await page.click('#btn')");
    });
  });

  describe('Edge cases', () => {
    test('should handle empty action list', () => {
      const actions = [];

      const python = ActionSerializer.toPythonSelenium(actions);
      const puppeteer = ActionSerializer.toJavaScriptPuppeteer(actions);
      const playwright = ActionSerializer.toPlaywright(actions);

      expect(python).toContain('# Recorded actions');
      expect(puppeteer).toContain('// Recorded actions');
      expect(playwright).toContain('// Recorded actions');
    });

    test('should handle unsupported action types', () => {
      const action = new Action({ type: 'unsupported_type' });

      const python = ActionSerializer.toPythonSelenium([action]);
      const puppeteer = ActionSerializer.toJavaScriptPuppeteer([action]);
      const playwright = ActionSerializer.toPlaywright([action]);

      expect(python).toContain('# Unsupported action: unsupported_type');
      expect(puppeteer).toContain('// Unsupported action: unsupported_type');
      expect(playwright).toContain('// Unsupported action: unsupported_type');
    });

    test('should escape quotes in strings', () => {
      const actions = [Action.type('#input', "it's a \"test\"")];

      const python = ActionSerializer.toPythonSelenium(actions);
      expect(python).toContain('\\"test\\"');

      const puppeteer = ActionSerializer.toJavaScriptPuppeteer(actions);
      expect(puppeteer).toContain("\\'");

      const playwright = ActionSerializer.toPlaywright(actions);
      expect(playwright).toContain("\\'");
    });

    test('should escape newlines in strings', () => {
      const actions = [Action.type('#input', "line1\nline2")];

      const python = ActionSerializer.toPythonSelenium(actions);
      expect(python).toContain('\\n');

      const puppeteer = ActionSerializer.toJavaScriptPuppeteer(actions);
      expect(puppeteer).toContain('\\n');
    });
  });
});
