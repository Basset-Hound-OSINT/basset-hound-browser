/**
 * Basset Hound Browser - Interaction Recorder Script Exporters
 *
 * Extracted verbatim from recording/interaction-recorder.js
 * (modularization 2026-07-04). Pure code-generation helpers that turn a
 * recording into Selenium / Puppeteer / Playwright automation scripts.
 *
 * These were originally the InteractionRecorder methods:
 *   _generateSeleniumScript  -> buildSelenium
 *   _generatePuppeteerScript -> buildPuppeteer
 *   _generatePlaywrightScript-> buildPlaywright
 *   _getEventComment         -> getEventComment
 *   _escape                  -> escape
 *   _mapKeyToSelenium        -> mapKeyToSelenium
 * All logic is unchanged; `this.<helper>` calls became local function calls.
 */

const { INTERACTION_TYPES } = require('./constants');

/**
 * Generate Selenium script
 */
function buildSelenium(recording, options = {}) {
  const includeHeader = options.includeHeader !== false;
  const includeSetup = options.includeSetup !== false;
  const includeWaits = options.includeWaits !== false;

  let script = '';

  if (includeHeader) {
    script += `#!/usr/bin/env python3
"""
${recording.name}
${recording.description}

Generated from interaction recording: ${recording.id}
Duration: ${recording.duration}ms
Events: ${recording.events.length}
"""

`;
  }

  if (includeSetup) {
    script += `from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

# Initialize driver
driver = webdriver.Chrome()
wait = WebDriverWait(driver, 10)
actions = ActionChains(driver)

try:
`;
  }

  // Process events
  let indent = includeSetup ? '    ' : '';
  let lastUrl = recording.startUrl;

  for (const event of recording.events) {
    const comment = getEventComment(event);
    if (comment) {
      script += `${indent}# ${comment}\n`;
    }

    switch (event.type) {
      case INTERACTION_TYPES.NAVIGATION:
        script += `${indent}driver.get("${escape(event.data.url)}")\n`;
        lastUrl = event.data.url;
        if (includeWaits) {
          script += `${indent}time.sleep(0.5)\n`;
        }
        break;

      case INTERACTION_TYPES.MOUSE_CLICK:
        if (event.element && event.element.selector) {
          script += `${indent}element = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "${escape(event.element.selector)}")))\n`;
          script += `${indent}element.click()\n`;
        }
        break;

      case INTERACTION_TYPES.INPUT:
      case INTERACTION_TYPES.CHANGE:
        if (event.element && event.element.selector && !event.masked) {
          script += `${indent}element = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "${escape(event.element.selector)}")))\n`;
          script += `${indent}element.clear()\n`;
          script += `${indent}element.send_keys("${escape(event.data.value || '')}")\n`;
        }
        break;

      case INTERACTION_TYPES.KEY_PRESS:
        if (!event.masked) {
          const key = mapKeyToSelenium(event.data.key);
          script += `${indent}actions.send_keys(${key}).perform()\n`;
        }
        break;

      case INTERACTION_TYPES.SCROLL:
        script += `${indent}driver.execute_script("window.scrollTo(${event.data.scrollX}, ${event.data.scrollY})")\n`;
        break;

      case INTERACTION_TYPES.HOVER:
        if (event.element && event.element.selector) {
          script += `${indent}element = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "${escape(event.element.selector)}")))\n`;
          script += `${indent}actions.move_to_element(element).perform()\n`;
        }
        break;

      case INTERACTION_TYPES.SELECT:
        if (event.element && event.element.selector) {
          script += `${indent}from selenium.webdriver.support.ui import Select\n`;
          script += `${indent}select = Select(wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "${escape(event.element.selector)}"))))\n`;
          script += `${indent}select.select_by_value("${escape(event.data.value)}")\n`;
        }
        break;

      case INTERACTION_TYPES.CHECKPOINT:
        script += `${indent}# Checkpoint: ${event.data.name || 'Unnamed'}\n`;
        if (event.data.description) {
          script += `${indent}# ${event.data.description}\n`;
        }
        break;
    }
  }

  if (includeSetup) {
    script += `
finally:
    # Cleanup
    driver.quit()
`;
  }

  return script;
}

/**
 * Generate Puppeteer script
 */
function buildPuppeteer(recording, options = {}) {
  const includeHeader = options.includeHeader !== false;
  const includeSetup = options.includeSetup !== false;
  const includeWaits = options.includeWaits !== false;

  let script = '';

  if (includeHeader) {
    script += `/**
 * ${recording.name}
 * ${recording.description}
 *
 * Generated from interaction recording: ${recording.id}
 * Duration: ${recording.duration}ms
 * Events: ${recording.events.length}
 */

`;
  }

  if (includeSetup) {
    script += `const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
`;
  }

  // Process events
  let indent = includeSetup ? '    ' : '';

  for (const event of recording.events) {
    const comment = getEventComment(event);
    if (comment) {
      script += `${indent}// ${comment}\n`;
    }

    switch (event.type) {
      case INTERACTION_TYPES.NAVIGATION:
        script += `${indent}await page.goto('${escape(event.data.url)}', { waitUntil: 'networkidle0' });\n`;
        break;

      case INTERACTION_TYPES.MOUSE_CLICK:
        if (event.element && event.element.selector) {
          script += `${indent}await page.waitForSelector('${escape(event.element.selector)}');\n`;
          script += `${indent}await page.click('${escape(event.element.selector)}');\n`;
        } else if (event.data.x !== undefined && event.data.y !== undefined) {
          script += `${indent}await page.mouse.click(${event.data.x}, ${event.data.y});\n`;
        }
        break;

      case INTERACTION_TYPES.INPUT:
      case INTERACTION_TYPES.CHANGE:
        if (event.element && event.element.selector && !event.masked) {
          script += `${indent}await page.waitForSelector('${escape(event.element.selector)}');\n`;
          script += `${indent}await page.type('${escape(event.element.selector)}', '${escape(event.data.value || '')}');\n`;
        }
        break;

      case INTERACTION_TYPES.KEY_PRESS:
        if (!event.masked) {
          script += `${indent}await page.keyboard.press('${escape(event.data.key)}');\n`;
        }
        break;

      case INTERACTION_TYPES.SCROLL:
        script += `${indent}await page.evaluate(() => window.scrollTo(${event.data.scrollX}, ${event.data.scrollY}));\n`;
        break;

      case INTERACTION_TYPES.HOVER:
        if (event.element && event.element.selector) {
          script += `${indent}await page.waitForSelector('${escape(event.element.selector)}');\n`;
          script += `${indent}await page.hover('${escape(event.element.selector)}');\n`;
        }
        break;

      case INTERACTION_TYPES.SELECT:
        if (event.element && event.element.selector) {
          script += `${indent}await page.select('${escape(event.element.selector)}', '${escape(event.data.value)}');\n`;
        }
        break;

      case INTERACTION_TYPES.CHECKPOINT:
        script += `${indent}// Checkpoint: ${event.data.name || 'Unnamed'}\n`;
        if (event.data.description) {
          script += `${indent}// ${event.data.description}\n`;
        }
        break;
    }

    if (includeWaits && [INTERACTION_TYPES.MOUSE_CLICK, INTERACTION_TYPES.INPUT, INTERACTION_TYPES.NAVIGATION].includes(event.type)) {
      script += `${indent}await page.waitForTimeout(500);\n`;
    }
  }

  if (includeSetup) {
    script += `  } finally {
    await browser.close();
  }
})();
`;
  }

  return script;
}

/**
 * Generate Playwright script
 */
function buildPlaywright(recording, options = {}) {
  const includeHeader = options.includeHeader !== false;
  const includeSetup = options.includeSetup !== false;
  const includeWaits = options.includeWaits !== false;

  let script = '';

  if (includeHeader) {
    script += `/**
 * ${recording.name}
 * ${recording.description}
 *
 * Generated from interaction recording: ${recording.id}
 * Duration: ${recording.duration}ms
 * Events: ${recording.events.length}
 */

`;
  }

  if (includeSetup) {
    script += `const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
`;
  }

  // Process events
  let indent = includeSetup ? '    ' : '';

  for (const event of recording.events) {
    const comment = getEventComment(event);
    if (comment) {
      script += `${indent}// ${comment}\n`;
    }

    switch (event.type) {
      case INTERACTION_TYPES.NAVIGATION:
        script += `${indent}await page.goto('${escape(event.data.url)}');\n`;
        break;

      case INTERACTION_TYPES.MOUSE_CLICK:
        if (event.element && event.element.selector) {
          script += `${indent}await page.click('${escape(event.element.selector)}');\n`;
        } else if (event.data.x !== undefined && event.data.y !== undefined) {
          script += `${indent}await page.mouse.click(${event.data.x}, ${event.data.y});\n`;
        }
        break;

      case INTERACTION_TYPES.INPUT:
      case INTERACTION_TYPES.CHANGE:
        if (event.element && event.element.selector && !event.masked) {
          script += `${indent}await page.fill('${escape(event.element.selector)}', '${escape(event.data.value || '')}');\n`;
        }
        break;

      case INTERACTION_TYPES.KEY_PRESS:
        if (!event.masked) {
          script += `${indent}await page.keyboard.press('${escape(event.data.key)}');\n`;
        }
        break;

      case INTERACTION_TYPES.SCROLL:
        script += `${indent}await page.evaluate(() => window.scrollTo(${event.data.scrollX}, ${event.data.scrollY}));\n`;
        break;

      case INTERACTION_TYPES.HOVER:
        if (event.element && event.element.selector) {
          script += `${indent}await page.hover('${escape(event.element.selector)}');\n`;
        }
        break;

      case INTERACTION_TYPES.SELECT:
        if (event.element && event.element.selector) {
          script += `${indent}await page.selectOption('${escape(event.element.selector)}', '${escape(event.data.value)}');\n`;
        }
        break;

      case INTERACTION_TYPES.CHECKPOINT:
        script += `${indent}// Checkpoint: ${event.data.name || 'Unnamed'}\n`;
        if (event.data.description) {
          script += `${indent}// ${event.data.description}\n`;
        }
        break;
    }

    if (includeWaits && [INTERACTION_TYPES.MOUSE_CLICK, INTERACTION_TYPES.INPUT, INTERACTION_TYPES.NAVIGATION].includes(event.type)) {
      script += `${indent}await page.waitForTimeout(500);\n`;
    }
  }

  if (includeSetup) {
    script += `  } finally {
    await browser.close();
  }
})();
`;
  }

  return script;
}

/**
 * Get event comment for script generation
 */
function getEventComment(event) {
  const time = (event.relativeTime / 1000).toFixed(2);
  switch (event.type) {
    case INTERACTION_TYPES.NAVIGATION:
      return `Navigate to ${event.data.url} (${time}s)`;
    case INTERACTION_TYPES.MOUSE_CLICK:
      return `Click ${event.element?.tagName || 'element'} (${time}s)`;
    case INTERACTION_TYPES.INPUT:
      return `Input to ${event.element?.tagName || 'field'} (${time}s)`;
    case INTERACTION_TYPES.SCROLL:
      return `Scroll to (${event.data.scrollX}, ${event.data.scrollY}) (${time}s)`;
    case INTERACTION_TYPES.CHECKPOINT:
      return null; // Handled separately
    default:
      return null;
  }
}

/**
 * Escape string for script generation
 */
function escape(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Map key to Selenium Keys constant
 */
function mapKeyToSelenium(key) {
  const keyMap = {
    'Enter': 'Keys.ENTER',
    'Tab': 'Keys.TAB',
    'Escape': 'Keys.ESCAPE',
    'Backspace': 'Keys.BACKSPACE',
    'Delete': 'Keys.DELETE',
    'ArrowUp': 'Keys.UP',
    'ArrowDown': 'Keys.DOWN',
    'ArrowLeft': 'Keys.LEFT',
    'ArrowRight': 'Keys.RIGHT',
    'Home': 'Keys.HOME',
    'End': 'Keys.END',
    'PageUp': 'Keys.PAGE_UP',
    'PageDown': 'Keys.PAGE_DOWN',
    'Space': 'Keys.SPACE'
  };
  return keyMap[key] || `"${key}"`;
}

module.exports = {
  buildSelenium,
  buildPuppeteer,
  buildPlaywright,
  getEventComment,
  escape,
  mapKeyToSelenium
};
