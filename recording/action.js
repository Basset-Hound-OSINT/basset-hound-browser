/**
 * Basset Hound Browser - Action Types and Serialization
 * Defines action types for recording user interactions
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Action types for recording
 */
const ACTION_TYPES = {
  NAVIGATE: 'navigate',
  CLICK: 'click',
  TYPE: 'type',
  SCROLL: 'scroll',
  WAIT: 'wait',
  SCREENSHOT: 'screenshot',
  EXECUTE_SCRIPT: 'execute_script',
  KEY_PRESS: 'key_press',
  HOVER: 'hover',
  SELECT: 'select',
  FOCUS: 'focus',
  BLUR: 'blur',
  DRAG_DROP: 'drag_drop',
  ASSERT: 'assert',
  COMMENT: 'comment'
};

/**
 * Action class representing a single recorded action
 */
class Action {
  /**
   * Create a new Action
   * @param {Object} options - Action options
   */
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.type = options.type || ACTION_TYPES.CLICK;
    this.timestamp = options.timestamp || Date.now();
    this.timeSinceStart = options.timeSinceStart || 0;
    this.timeSincePrevious = options.timeSincePrevious || 0;
    this.data = options.data || {};
    this.metadata = options.metadata || {};
    this.pageUrl = options.pageUrl || '';
    this.pageTitle = options.pageTitle || '';
  }

  /**
   * Serialize action to plain object
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      timeSinceStart: this.timeSinceStart,
      timeSincePrevious: this.timeSincePrevious,
      data: this.data,
      metadata: this.metadata,
      pageUrl: this.pageUrl,
      pageTitle: this.pageTitle
    };
  }

  /**
   * Create Action from plain object
   * @param {Object} data
   * @returns {Action}
   */
  static fromJSON(data) {
    return new Action(data);
  }

  /**
   * Create a navigate action
   * @param {string} url - Target URL
   * @param {Object} options - Additional options
   * @returns {Action}
   */
  static navigate(url, options = {}) {
    return new Action({
      type: ACTION_TYPES.NAVIGATE,
      data: { url, waitForLoad: options.waitForLoad !== false },
      ...options
    });
  }

  /**
   * Create a click action
   * @param {string} selector - Element selector
   * @param {Object} options - Click options
   * @returns {Action}
   */
  static click(selector, options = {}) {
    return new Action({
      type: ACTION_TYPES.CLICK,
      data: {
        selector,
        x: options.x || null,
        y: options.y || null,
        button: options.button || 'left',
        clickCount: options.clickCount || 1,
        humanize: options.humanize !== false
      },
      ...options
    });
  }

  /**
   * Create a type action
   * @param {string} selector - Element selector
   * @param {string} text - Text to type
   * @param {Object} options - Type options
   * @returns {Action}
   */
  static type(selector, text, options = {}) {
    return new Action({
      type: ACTION_TYPES.TYPE,
      data: {
        selector,
        text,
        clearFirst: options.clearFirst || false,
        humanize: options.humanize !== false,
        delay: options.delay || null
      },
      ...options
    });
  }

  /**
   * Create a scroll action
   * @param {Object} scrollData - Scroll parameters
   * @param {Object} options - Additional options
   * @returns {Action}
   */
  static scroll(scrollData, options = {}) {
    return new Action({
      type: ACTION_TYPES.SCROLL,
      data: {
        x: scrollData.x || 0,
        y: scrollData.y || 0,
        selector: scrollData.selector || null,
        behavior: scrollData.behavior || 'smooth'
      },
      ...options
    });
  }

  /**
   * Create a wait action
   * @param {Object} waitData - Wait parameters
   * @param {Object} options - Additional options
   * @returns {Action}
   */
  static wait(waitData, options = {}) {
    return new Action({
      type: ACTION_TYPES.WAIT,
      data: {
        duration: waitData.duration || null,
        selector: waitData.selector || null,
        condition: waitData.condition || null,
        timeout: waitData.timeout || 30000
      },
      ...options
    });
  }

  /**
   * Create a screenshot action
   * @param {Object} screenshotData - Screenshot parameters
   * @param {Object} options - Additional options
   * @returns {Action}
   */
  static screenshot(screenshotData = {}, options = {}) {
    return new Action({
      type: ACTION_TYPES.SCREENSHOT,
      data: {
        name: screenshotData.name || `screenshot-${Date.now()}`,
        fullPage: screenshotData.fullPage || false,
        selector: screenshotData.selector || null,
        format: screenshotData.format || 'png'
      },
      ...options
    });
  }

  /**
   * Create an execute script action
   * @param {string} script - JavaScript to execute
   * @param {Object} options - Additional options
   * @returns {Action}
   */
  static executeScript(script, options = {}) {
    return new Action({
      type: ACTION_TYPES.EXECUTE_SCRIPT,
      data: {
        script,
        args: options.args || [],
        waitForResult: options.waitForResult !== false
      },
      ...options
    });
  }

  /**
   * Create a key press action
   * @param {string} key - Key to press
   * @param {Object} options - Key press options
   * @returns {Action}
   */
  static keyPress(key, options = {}) {
    return new Action({
      type: ACTION_TYPES.KEY_PRESS,
      data: {
        key,
        modifiers: options.modifiers || {},
        repeat: options.repeat || 1
      },
      ...options
    });
  }

  /**
   * Create a hover action
   * @param {string} selector - Element selector
   * @param {Object} options - Additional options
   * @returns {Action}
   */
  static hover(selector, options = {}) {
    return new Action({
      type: ACTION_TYPES.HOVER,
      data: {
        selector,
        duration: options.duration || 100
      },
      ...options
    });
  }

  /**
   * Create a select action (dropdown)
   * @param {string} selector - Element selector
   * @param {string|Array} value - Value(s) to select
   * @param {Object} options - Additional options
   * @returns {Action}
   */
  static select(selector, value, options = {}) {
    return new Action({
      type: ACTION_TYPES.SELECT,
      data: {
        selector,
        value: Array.isArray(value) ? value : [value],
        byValue: options.byValue || false,
        byIndex: options.byIndex || false
      },
      ...options
    });
  }

  /**
   * Create an assertion action
   * @param {Object} assertData - Assertion parameters
   * @param {Object} options - Additional options
   * @returns {Action}
   */
  static assert(assertData, options = {}) {
    return new Action({
      type: ACTION_TYPES.ASSERT,
      data: {
        type: assertData.type || 'exists', // exists, text, value, visible, attribute
        selector: assertData.selector,
        expected: assertData.expected,
        attribute: assertData.attribute || null,
        message: assertData.message || null
      },
      ...options
    });
  }

  /**
   * Create a comment action (for documentation)
   * @param {string} comment - Comment text
   * @param {Object} options - Additional options
   * @returns {Action}
   */
  static comment(comment, options = {}) {
    return new Action({
      type: ACTION_TYPES.COMMENT,
      data: { comment },
      ...options
    });
  }

  /**
   * Substitute variables in action data
   * @param {Object} variables - Variable mappings
   * @returns {Action} New action with substituted values
   */
  substituteVariables(variables) {
    const substituteString = (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return variables.hasOwnProperty(varName) ? variables[varName] : match;
      });
    };

    const substituteObject = (obj) => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'string') return substituteString(obj);
      if (Array.isArray(obj)) return obj.map(substituteObject);
      if (typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = substituteObject(value);
        }
        return result;
      }
      return obj;
    };

    const newAction = new Action(this.toJSON());
    newAction.data = substituteObject(newAction.data);
    return newAction;
  }
}

/**
 * ActionSerializer for converting actions to/from various formats
 */
class ActionSerializer {
  /**
   * Serialize actions to JSON string
   * @param {Action[]} actions
   * @returns {string}
   */
  static toJSON(actions) {
    return JSON.stringify(actions.map(a => a.toJSON()), null, 2);
  }

  /**
   * Deserialize actions from JSON string
   * @param {string} json
   * @returns {Action[]}
   */
  static fromJSON(json) {
    const data = JSON.parse(json);
    return data.map(a => Action.fromJSON(a));
  }

  /**
   * Convert actions to Python Selenium script
   * @param {Action[]} actions
   * @param {Object} options
   * @returns {string}
   */
  static toPythonSelenium(actions, options = {}) {
    const {
      driverVar = 'driver',
      waitVar = 'wait',
      includeImports = true,
      includeSetup = true
    } = options;

    let script = '';

    if (includeImports) {
      script += `from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
import time

`;
    }

    if (includeSetup) {
      script += `# Initialize driver
${driverVar} = webdriver.Chrome()
${waitVar} = WebDriverWait(${driverVar}, 10)

`;
    }

    script += `# Recorded actions\n`;

    for (const action of actions) {
      script += ActionSerializer._actionToPython(action, driverVar, waitVar);
    }

    if (includeSetup) {
      script += `\n# Cleanup
${driverVar}.quit()
`;
    }

    return script;
  }

  /**
   * Convert single action to Python code
   * @private
   */
  static _actionToPython(action, driverVar, waitVar) {
    const escapeStr = (str) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

    switch (action.type) {
      case ACTION_TYPES.NAVIGATE:
        return `${driverVar}.get("${escapeStr(action.data.url)}")\n`;

      case ACTION_TYPES.CLICK:
        return `${waitVar}.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "${escapeStr(action.data.selector)}"))).click()\n`;

      case ACTION_TYPES.TYPE:
        let typeCode = '';
        if (action.data.clearFirst) {
          typeCode += `element = ${waitVar}.until(EC.presence_of_element_located((By.CSS_SELECTOR, "${escapeStr(action.data.selector)}")))\n`;
          typeCode += `element.clear()\n`;
          typeCode += `element.send_keys("${escapeStr(action.data.text)}")\n`;
        } else {
          typeCode += `${waitVar}.until(EC.presence_of_element_located((By.CSS_SELECTOR, "${escapeStr(action.data.selector)}"))).send_keys("${escapeStr(action.data.text)}")\n`;
        }
        return typeCode;

      case ACTION_TYPES.SCROLL:
        if (action.data.selector) {
          return `${driverVar}.execute_script("document.querySelector('${escapeStr(action.data.selector)}').scrollIntoView()")\n`;
        }
        return `${driverVar}.execute_script("window.scrollTo(${action.data.x}, ${action.data.y})")\n`;

      case ACTION_TYPES.WAIT:
        if (action.data.duration) {
          return `time.sleep(${action.data.duration / 1000})\n`;
        }
        if (action.data.selector) {
          return `${waitVar}.until(EC.presence_of_element_located((By.CSS_SELECTOR, "${escapeStr(action.data.selector)}")))\n`;
        }
        return '';

      case ACTION_TYPES.SCREENSHOT:
        return `${driverVar}.save_screenshot("${escapeStr(action.data.name)}.png")\n`;

      case ACTION_TYPES.EXECUTE_SCRIPT:
        return `${driverVar}.execute_script("""${action.data.script}""")\n`;

      case ACTION_TYPES.KEY_PRESS:
        const keyMap = {
          'Enter': 'Keys.ENTER',
          'Tab': 'Keys.TAB',
          'Escape': 'Keys.ESCAPE',
          'Backspace': 'Keys.BACKSPACE',
          'Delete': 'Keys.DELETE',
          'ArrowUp': 'Keys.UP',
          'ArrowDown': 'Keys.DOWN',
          'ArrowLeft': 'Keys.LEFT',
          'ArrowRight': 'Keys.RIGHT'
        };
        const pyKey = keyMap[action.data.key] || `"${action.data.key}"`;
        return `ActionChains(${driverVar}).send_keys(${pyKey}).perform()\n`;

      case ACTION_TYPES.HOVER:
        return `ActionChains(${driverVar}).move_to_element(${waitVar}.until(EC.presence_of_element_located((By.CSS_SELECTOR, "${escapeStr(action.data.selector)}")))).perform()\n`;

      case ACTION_TYPES.SELECT:
        return `from selenium.webdriver.support.ui import Select
Select(${waitVar}.until(EC.presence_of_element_located((By.CSS_SELECTOR, "${escapeStr(action.data.selector)}")))).select_by_value("${escapeStr(action.data.value[0])}")\n`;

      case ACTION_TYPES.COMMENT:
        return `# ${action.data.comment}\n`;

      default:
        return `# Unsupported action: ${action.type}\n`;
    }
  }

  /**
   * Convert actions to JavaScript Puppeteer script
   * @param {Action[]} actions
   * @param {Object} options
   * @returns {string}
   */
  static toJavaScriptPuppeteer(actions, options = {}) {
    const {
      pageVar = 'page',
      browserVar = 'browser',
      includeImports = true,
      includeSetup = true
    } = options;

    let script = '';

    if (includeImports) {
      script += `const puppeteer = require('puppeteer');

`;
    }

    if (includeSetup) {
      script += `(async () => {
  const ${browserVar} = await puppeteer.launch({ headless: false });
  const ${pageVar} = await ${browserVar}.newPage();

`;
    }

    script += `  // Recorded actions\n`;

    for (const action of actions) {
      script += ActionSerializer._actionToJavaScript(action, pageVar);
    }

    if (includeSetup) {
      script += `
  await ${browserVar}.close();
})();
`;
    }

    return script;
  }

  /**
   * Convert single action to JavaScript code
   * @private
   */
  static _actionToJavaScript(action, pageVar) {
    const escapeStr = (str) => str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    const indent = '  ';

    switch (action.type) {
      case ACTION_TYPES.NAVIGATE:
        return `${indent}await ${pageVar}.goto('${escapeStr(action.data.url)}', { waitUntil: 'networkidle0' });\n`;

      case ACTION_TYPES.CLICK:
        return `${indent}await ${pageVar}.click('${escapeStr(action.data.selector)}');\n`;

      case ACTION_TYPES.TYPE:
        let typeCode = '';
        if (action.data.clearFirst) {
          typeCode += `${indent}await ${pageVar}.click('${escapeStr(action.data.selector)}', { clickCount: 3 });\n`;
        }
        typeCode += `${indent}await ${pageVar}.type('${escapeStr(action.data.selector)}', '${escapeStr(action.data.text)}');\n`;
        return typeCode;

      case ACTION_TYPES.SCROLL:
        if (action.data.selector) {
          return `${indent}await ${pageVar}.$eval('${escapeStr(action.data.selector)}', el => el.scrollIntoView());\n`;
        }
        return `${indent}await ${pageVar}.evaluate(() => window.scrollTo(${action.data.x}, ${action.data.y}));\n`;

      case ACTION_TYPES.WAIT:
        if (action.data.duration) {
          return `${indent}await ${pageVar}.waitForTimeout(${action.data.duration});\n`;
        }
        if (action.data.selector) {
          return `${indent}await ${pageVar}.waitForSelector('${escapeStr(action.data.selector)}');\n`;
        }
        return '';

      case ACTION_TYPES.SCREENSHOT:
        const screenshotOpts = action.data.fullPage ? ', { fullPage: true }' : '';
        return `${indent}await ${pageVar}.screenshot({ path: '${escapeStr(action.data.name)}.png'${screenshotOpts} });\n`;

      case ACTION_TYPES.EXECUTE_SCRIPT:
        return `${indent}await ${pageVar}.evaluate(() => { ${action.data.script} });\n`;

      case ACTION_TYPES.KEY_PRESS:
        return `${indent}await ${pageVar}.keyboard.press('${escapeStr(action.data.key)}');\n`;

      case ACTION_TYPES.HOVER:
        return `${indent}await ${pageVar}.hover('${escapeStr(action.data.selector)}');\n`;

      case ACTION_TYPES.SELECT:
        return `${indent}await ${pageVar}.select('${escapeStr(action.data.selector)}', '${escapeStr(action.data.value[0])}');\n`;

      case ACTION_TYPES.COMMENT:
        return `${indent}// ${action.data.comment}\n`;

      default:
        return `${indent}// Unsupported action: ${action.type}\n`;
    }
  }

  /**
   * Convert actions to Playwright JavaScript script
   * @param {Action[]} actions
   * @param {Object} options
   * @returns {string}
   */
  static toPlaywright(actions, options = {}) {
    const {
      pageVar = 'page',
      browserVar = 'browser',
      contextVar = 'context',
      includeImports = true,
      includeSetup = true
    } = options;

    let script = '';

    if (includeImports) {
      script += `const { chromium } = require('playwright');

`;
    }

    if (includeSetup) {
      script += `(async () => {
  const ${browserVar} = await chromium.launch({ headless: false });
  const ${contextVar} = await ${browserVar}.newContext();
  const ${pageVar} = await ${contextVar}.newPage();

`;
    }

    script += `  // Recorded actions\n`;

    for (const action of actions) {
      script += ActionSerializer._actionToPlaywright(action, pageVar);
    }

    if (includeSetup) {
      script += `
  await ${browserVar}.close();
})();
`;
    }

    return script;
  }

  /**
   * Convert single action to Playwright code
   * @private
   */
  static _actionToPlaywright(action, pageVar) {
    const escapeStr = (str) => str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    const indent = '  ';

    switch (action.type) {
      case ACTION_TYPES.NAVIGATE:
        return `${indent}await ${pageVar}.goto('${escapeStr(action.data.url)}');\n`;

      case ACTION_TYPES.CLICK:
        return `${indent}await ${pageVar}.click('${escapeStr(action.data.selector)}');\n`;

      case ACTION_TYPES.TYPE:
        if (action.data.clearFirst) {
          return `${indent}await ${pageVar}.fill('${escapeStr(action.data.selector)}', '${escapeStr(action.data.text)}');\n`;
        }
        return `${indent}await ${pageVar}.type('${escapeStr(action.data.selector)}', '${escapeStr(action.data.text)}');\n`;

      case ACTION_TYPES.SCROLL:
        if (action.data.selector) {
          return `${indent}await ${pageVar}.locator('${escapeStr(action.data.selector)}').scrollIntoViewIfNeeded();\n`;
        }
        return `${indent}await ${pageVar}.evaluate(() => window.scrollTo(${action.data.x}, ${action.data.y}));\n`;

      case ACTION_TYPES.WAIT:
        if (action.data.duration) {
          return `${indent}await ${pageVar}.waitForTimeout(${action.data.duration});\n`;
        }
        if (action.data.selector) {
          return `${indent}await ${pageVar}.waitForSelector('${escapeStr(action.data.selector)}');\n`;
        }
        return '';

      case ACTION_TYPES.SCREENSHOT:
        const screenshotOpts = action.data.fullPage ? ', { fullPage: true }' : '';
        return `${indent}await ${pageVar}.screenshot({ path: '${escapeStr(action.data.name)}.png'${screenshotOpts} });\n`;

      case ACTION_TYPES.EXECUTE_SCRIPT:
        return `${indent}await ${pageVar}.evaluate(() => { ${action.data.script} });\n`;

      case ACTION_TYPES.KEY_PRESS:
        return `${indent}await ${pageVar}.keyboard.press('${escapeStr(action.data.key)}');\n`;

      case ACTION_TYPES.HOVER:
        return `${indent}await ${pageVar}.hover('${escapeStr(action.data.selector)}');\n`;

      case ACTION_TYPES.SELECT:
        return `${indent}await ${pageVar}.selectOption('${escapeStr(action.data.selector)}', '${escapeStr(action.data.value[0])}');\n`;

      case ACTION_TYPES.COMMENT:
        return `${indent}// ${action.data.comment}\n`;

      default:
        return `${indent}// Unsupported action: ${action.type}\n`;
    }
  }
}

module.exports = {
  Action,
  ActionSerializer,
  ACTION_TYPES
};
