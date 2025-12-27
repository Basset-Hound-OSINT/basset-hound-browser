/**
 * Basset Hound Browser - Human-like Behavior Module
 * Simulates realistic human interactions to evade bot detection
 */

/**
 * Generate a random delay within a range
 * @param {number} min - Minimum delay in milliseconds
 * @param {number} max - Maximum delay in milliseconds
 * @returns {Promise} - Resolves after the delay
 */
function humanDelay(min = 50, max = 200) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Generate a random delay following a normal distribution
 * More realistic than uniform random
 * @param {number} mean - Mean delay in milliseconds
 * @param {number} stdDev - Standard deviation
 * @returns {Promise} - Resolves after the delay
 */
function normalDelay(mean = 100, stdDev = 30) {
  // Box-Muller transform for normal distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const delay = Math.max(10, Math.floor(mean + z * stdDev));
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Simulate human typing with realistic speed variations
 * @param {string} text - Text to type
 * @param {Object} options - Typing options
 * @returns {Promise<string>} - The typed text
 */
async function humanType(text, options = {}) {
  const {
    minDelay = 30,
    maxDelay = 150,
    mistakeRate = 0.02,
    pauseChance = 0.05,
    pauseDuration = { min: 200, max: 500 }
  } = options;

  let result = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Simulate occasional pauses (like thinking)
    if (Math.random() < pauseChance) {
      await humanDelay(pauseDuration.min, pauseDuration.max);
    }

    // Simulate typing mistakes (with correction)
    if (Math.random() < mistakeRate && result.length > 0) {
      // Type wrong character
      const wrongChar = String.fromCharCode(char.charCodeAt(0) + Math.floor(Math.random() * 3) - 1);
      result += wrongChar;
      await humanDelay(minDelay, maxDelay);

      // Pause before correcting
      await humanDelay(100, 300);

      // Delete wrong character
      result = result.slice(0, -1);
      await humanDelay(minDelay, maxDelay);
    }

    // Type the correct character
    result += char;

    // Variable delay between keystrokes
    // Faster for common letter combinations
    let delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    // Speed up for common patterns
    if (i > 0) {
      const prev = text[i - 1].toLowerCase();
      const curr = char.toLowerCase();
      const commonPairs = ['th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd'];
      if (commonPairs.includes(prev + curr)) {
        delay = Math.floor(delay * 0.7);
      }
    }

    // Slow down for punctuation
    if (['.', ',', '!', '?', ';', ':'].includes(char)) {
      delay = Math.floor(delay * 1.5);
    }

    // Slow down after space (word boundary)
    if (char === ' ') {
      delay = Math.floor(delay * 1.2);
    }

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  return result;
}

/**
 * Generate natural mouse movement path between two points
 * Uses Bezier curves for smooth, human-like motion
 * @param {Object} start - Starting point {x, y}
 * @param {Object} end - Ending point {x, y}
 * @param {number} steps - Number of intermediate points
 * @returns {Array} - Array of points along the path
 */
function generateMousePath(start, end, steps = 20) {
  const points = [];

  // Generate control points for cubic Bezier curve
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  // Random deviation for natural curve
  const deviation = Math.min(Math.abs(dx), Math.abs(dy)) * 0.3;

  const cp1 = {
    x: start.x + dx * 0.25 + (Math.random() - 0.5) * deviation,
    y: start.y + dy * 0.25 + (Math.random() - 0.5) * deviation
  };

  const cp2 = {
    x: start.x + dx * 0.75 + (Math.random() - 0.5) * deviation,
    y: start.y + dy * 0.75 + (Math.random() - 0.5) * deviation
  };

  // Generate points along the Bezier curve
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    const x = mt3 * start.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * end.x;
    const y = mt3 * start.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * end.y;

    // Add slight jitter for more realism
    const jitter = 2;
    points.push({
      x: Math.round(x + (Math.random() - 0.5) * jitter),
      y: Math.round(y + (Math.random() - 0.5) * jitter)
    });
  }

  return points;
}

/**
 * Simulate natural mouse movement
 * @param {Object} start - Starting point {x, y}
 * @param {Object} end - Ending point {x, y}
 * @param {Object} options - Movement options
 * @returns {Promise<Array>} - Path taken
 */
async function humanMouseMove(start, end, options = {}) {
  const {
    steps = 20,
    minDelay = 5,
    maxDelay = 15,
    overshoot = true
  } = options;

  let path = generateMousePath(start, end, steps);

  // Occasionally overshoot and correct
  if (overshoot && Math.random() < 0.2) {
    const overshootDist = 5 + Math.random() * 15;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 50) {
      const overshootPoint = {
        x: end.x + (dx / dist) * overshootDist,
        y: end.y + (dy / dist) * overshootDist
      };

      // Add overshoot
      const overshootPath = generateMousePath(path[path.length - 1], overshootPoint, 5);
      path = path.concat(overshootPath);

      // Correct back to target
      const correctionPath = generateMousePath(overshootPoint, end, 5);
      path = path.concat(correctionPath);
    }
  }

  // Simulate the movement with delays
  for (const point of path) {
    await humanDelay(minDelay, maxDelay);
    // The actual mouse movement would be dispatched here
  }

  return path;
}

/**
 * Generate script for simulating mouse movement in browser context
 * @param {Object} start - Starting point {x, y}
 * @param {Object} end - Ending point {x, y}
 * @returns {string} - JavaScript code to execute
 */
function getMouseMoveScript(start, end) {
  const path = generateMousePath(start, end);

  return `
    (async function() {
      const path = ${JSON.stringify(path)};
      for (const point of path) {
        const event = new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: point.x,
          clientY: point.y
        });
        document.elementFromPoint(point.x, point.y)?.dispatchEvent(event);
        await new Promise(r => setTimeout(r, ${5 + Math.floor(Math.random() * 10)}));
      }
    })();
  `;
}

/**
 * Simulate human-like scrolling
 * @param {Object} options - Scroll options
 * @returns {Promise}
 */
async function humanScroll(options = {}) {
  const {
    direction = 'down',
    amount = null,
    duration = { min: 500, max: 1500 }
  } = options;

  // Random scroll amount if not specified
  const scrollAmount = amount || Math.floor(Math.random() * 300) + 100;

  // Random duration
  const scrollDuration = Math.floor(Math.random() * (duration.max - duration.min)) + duration.min;

  // Add slight pause before scrolling
  await humanDelay(50, 200);

  return {
    scrollAmount,
    scrollDuration,
    direction
  };
}

/**
 * Generate script for human-like scrolling in browser context
 * @param {Object} options - Scroll options
 * @returns {string} - JavaScript code to execute
 */
function getScrollScript(options = {}) {
  const { y = 300, smooth = true, jitter = true } = options;

  if (jitter) {
    return `
      (async function() {
        const targetY = ${y} + (Math.random() - 0.5) * 50;
        const steps = 10 + Math.floor(Math.random() * 10);
        const stepSize = targetY / steps;

        for (let i = 0; i < steps; i++) {
          const scrollY = stepSize * (1 + (Math.random() - 0.5) * 0.3);
          window.scrollBy({
            top: scrollY,
            behavior: 'auto'
          });
          await new Promise(r => setTimeout(r, 20 + Math.random() * 30));
        }
      })();
    `;
  }

  return `window.scrollTo({ top: ${y}, behavior: '${smooth ? 'smooth' : 'auto'}' });`;
}

/**
 * Generate realistic click timing
 * @returns {Object} - Click timing parameters
 */
function getClickTiming() {
  return {
    mousedownDelay: Math.floor(Math.random() * 50) + 10,
    mouseupDelay: Math.floor(Math.random() * 100) + 50,
    clickDelay: Math.floor(Math.random() * 30) + 5
  };
}

/**
 * Generate script for human-like clicking in browser context
 * @param {string} selector - Element selector
 * @returns {string} - JavaScript code to execute
 */
function getClickScript(selector) {
  const timing = getClickTiming();

  return `
    (async function() {
      const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
      if (!element) return { success: false, error: 'Element not found' };

      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width * (0.3 + Math.random() * 0.4);
      const y = rect.top + rect.height * (0.3 + Math.random() * 0.4);

      // Mousedown
      element.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y
      }));

      await new Promise(r => setTimeout(r, ${timing.mousedownDelay}));

      // Mouseup
      element.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y
      }));

      await new Promise(r => setTimeout(r, ${timing.clickDelay}));

      // Click
      element.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y
      }));

      return { success: true };
    })();
  `;
}

/**
 * Generate script for human-like form filling in browser context
 * @param {string} selector - Input element selector
 * @param {string} value - Value to type
 * @returns {string} - JavaScript code to execute
 */
function getTypeScript(selector, value) {
  return `
    (async function() {
      const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
      if (!element) return { success: false, error: 'Element not found' };

      // Focus the element
      element.focus();
      await new Promise(r => setTimeout(r, 50 + Math.random() * 100));

      // Clear existing value
      element.value = '';

      const text = '${value.replace(/'/g, "\\'")}';
      for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // Random delay between keystrokes
        const delay = 30 + Math.random() * 120;

        // Dispatch keydown
        element.dispatchEvent(new KeyboardEvent('keydown', {
          key: char,
          code: 'Key' + char.toUpperCase(),
          bubbles: true
        }));

        // Update value
        element.value += char;

        // Dispatch input event
        element.dispatchEvent(new Event('input', { bubbles: true }));

        // Dispatch keyup
        element.dispatchEvent(new KeyboardEvent('keyup', {
          key: char,
          code: 'Key' + char.toUpperCase(),
          bubbles: true
        }));

        await new Promise(r => setTimeout(r, delay));

        // Occasional longer pause
        if (Math.random() < 0.05) {
          await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
        }
      }

      // Dispatch change event
      element.dispatchEvent(new Event('change', { bubbles: true }));

      return { success: true };
    })();
  `;
}

/**
 * Generate random pause pattern like a human would make
 * @returns {Promise}
 */
async function humanPause() {
  const pauseTypes = [
    { min: 500, max: 1500, probability: 0.7 },   // Short pause (reading)
    { min: 1500, max: 3000, probability: 0.2 },  // Medium pause (thinking)
    { min: 3000, max: 6000, probability: 0.1 }   // Long pause (distraction)
  ];

  const rand = Math.random();
  let cumulative = 0;

  for (const pauseType of pauseTypes) {
    cumulative += pauseType.probability;
    if (rand < cumulative) {
      await humanDelay(pauseType.min, pauseType.max);
      break;
    }
  }
}

/**
 * Get a random action sequence to mimic human browsing
 * @returns {Array} - Array of actions
 */
function getRandomActionSequence() {
  const actions = [
    { type: 'scroll', weight: 3 },
    { type: 'mousemove', weight: 2 },
    { type: 'pause', weight: 2 },
    { type: 'none', weight: 3 }
  ];

  const totalWeight = actions.reduce((sum, a) => sum + a.weight, 0);
  const rand = Math.random() * totalWeight;

  let cumulative = 0;
  for (const action of actions) {
    cumulative += action.weight;
    if (rand < cumulative) {
      return action.type;
    }
  }

  return 'none';
}

module.exports = {
  humanDelay,
  normalDelay,
  humanType,
  generateMousePath,
  humanMouseMove,
  getMouseMoveScript,
  humanScroll,
  getScrollScript,
  getClickTiming,
  getClickScript,
  getTypeScript,
  humanPause,
  getRandomActionSequence
};
