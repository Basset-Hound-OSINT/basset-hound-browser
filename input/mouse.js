/**
 * Basset Hound Browser - Advanced Mouse Simulation Module
 * Provides human-like mouse input simulation for evasion and automation
 */

const { humanDelay, normalDelay, generateMousePath } = require('../evasion/humanize');

/**
 * Mouse button constants
 */
const MOUSE_BUTTONS = {
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2,
  BACK: 3,
  FORWARD: 4
};

/**
 * Default timing configurations for human-like behavior
 */
const TIMING_CONFIG = {
  click: {
    mousedownDelay: { min: 50, max: 150 },
    mouseupDelay: { min: 80, max: 200 },
    doubleClickInterval: { min: 80, max: 200 }
  },
  move: {
    stepDelay: { min: 5, max: 20 },
    overshootChance: 0.15,
    overshootCorrection: { min: 50, max: 150 }
  },
  scroll: {
    stepDelay: { min: 10, max: 30 },
    momentumDecay: 0.92,
    jitterAmount: 3
  },
  drag: {
    pickupDelay: { min: 100, max: 300 },
    dropDelay: { min: 50, max: 150 }
  },
  hover: {
    enterDelay: { min: 50, max: 200 },
    dwellTime: { min: 200, max: 800 }
  }
};

/**
 * Generate a random value within a range
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Random value
 */
function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Generate Bezier curve control points for natural movement
 * @param {Object} start - Start point {x, y}
 * @param {Object} end - End point {x, y}
 * @param {number} curvature - How much to curve (0-1)
 * @returns {Object} - Control points {cp1, cp2}
 */
function generateControlPoints(start, end, curvature = 0.3) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Random perpendicular deviation
  const perpX = -dy / dist;
  const perpY = dx / dist;

  // Randomize control point positions
  const offset1 = (Math.random() - 0.5) * dist * curvature;
  const offset2 = (Math.random() - 0.5) * dist * curvature;

  const cp1 = {
    x: start.x + dx * 0.25 + perpX * offset1,
    y: start.y + dy * 0.25 + perpY * offset1
  };

  const cp2 = {
    x: start.x + dx * 0.75 + perpX * offset2,
    y: start.y + dy * 0.75 + perpY * offset2
  };

  return { cp1, cp2 };
}

/**
 * Generate points along a cubic Bezier curve
 * @param {Object} start - Start point
 * @param {Object} cp1 - Control point 1
 * @param {Object} cp2 - Control point 2
 * @param {Object} end - End point
 * @param {number} steps - Number of points
 * @returns {Array} - Array of points
 */
function bezierCurve(start, cp1, cp2, end, steps) {
  const points = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    points.push({
      x: mt3 * start.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * end.x,
      y: mt3 * start.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * end.y
    });
  }

  return points;
}

/**
 * Add natural jitter to a point
 * @param {Object} point - Point {x, y}
 * @param {number} amount - Maximum jitter amount
 * @returns {Object} - Jittered point
 */
function addJitter(point, amount = 1) {
  return {
    x: point.x + (Math.random() - 0.5) * amount * 2,
    y: point.y + (Math.random() - 0.5) * amount * 2
  };
}

/**
 * Generate a human-like mouse path between two points
 * @param {Object} start - Start point {x, y}
 * @param {Object} end - End point {x, y}
 * @param {Object} options - Path options
 * @returns {Array} - Array of path points with timing
 */
function generateHumanMousePath(start, end, options = {}) {
  const {
    steps = null,
    curvature = 0.3,
    jitter = 1.5,
    overshoot = true,
    overshootChance = 0.15
  } = options;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Calculate number of steps based on distance
  const numSteps = steps || Math.max(10, Math.min(50, Math.floor(distance / 10)));

  // Generate main curve
  const { cp1, cp2 } = generateControlPoints(start, end, curvature);
  let path = bezierCurve(start, cp1, cp2, end, numSteps);

  // Add jitter to each point
  path = path.map((p, i) => {
    // Less jitter at start and end
    const edgeFactor = Math.min(i / 5, (path.length - 1 - i) / 5, 1);
    return addJitter(p, jitter * edgeFactor);
  });

  // Add overshoot correction occasionally
  if (overshoot && distance > 50 && Math.random() < overshootChance) {
    const overshootDist = 3 + Math.random() * 10;
    const overshootPoint = {
      x: end.x + (dx / distance) * overshootDist,
      y: end.y + (dy / distance) * overshootDist
    };

    // Add overshoot path
    const overshootPath = bezierCurve(path[path.length - 1], overshootPoint, end, end, 5);
    path = path.concat(overshootPath.slice(1));
  }

  // Round all coordinates
  return path.map(p => ({
    x: Math.round(p.x),
    y: Math.round(p.y)
  }));
}

/**
 * Generate speed curve for movement (ease-in-out)
 * @param {number} t - Progress (0-1)
 * @returns {number} - Speed multiplier
 */
function speedCurve(t) {
  // Ease-in-out curve
  if (t < 0.5) {
    return 2 * t * t;
  }
  return 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Generate script for mouse move to coordinates
 * @param {number} x - Target X coordinate
 * @param {number} y - Target Y coordinate
 * @param {Object} options - Move options
 * @returns {string} - JavaScript code
 */
function getMouseMoveScript(x, y, options = {}) {
  const {
    steps = 20,
    duration = null,
    curvature = 0.3,
    jitter = 1.5,
    overshoot = true
  } = options;

  return `
    (async function() {
      // Get current mouse position (estimated from last known position or center)
      let currentPos = window.__lastMousePos || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const targetPos = { x: ${x}, y: ${y} };

      const dx = targetPos.x - currentPos.x;
      const dy = targetPos.y - currentPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 5) {
        window.__lastMousePos = targetPos;
        return { success: true, x: ${x}, y: ${y}, moved: false };
      }

      // Generate path
      const steps = ${steps || 'Math.max(10, Math.min(50, Math.floor(distance / 10))'});
      const curvature = ${curvature};

      // Generate control points
      const perpX = -dy / distance;
      const perpY = dx / distance;
      const offset1 = (Math.random() - 0.5) * distance * curvature;
      const offset2 = (Math.random() - 0.5) * distance * curvature;

      const cp1 = {
        x: currentPos.x + dx * 0.25 + perpX * offset1,
        y: currentPos.y + dy * 0.25 + perpY * offset1
      };
      const cp2 = {
        x: currentPos.x + dx * 0.75 + perpX * offset2,
        y: currentPos.y + dy * 0.75 + perpY * offset2
      };

      // Generate Bezier curve points
      const path = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;

        let x = mt3 * currentPos.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * targetPos.x;
        let y = mt3 * currentPos.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * targetPos.y;

        // Add jitter (less at endpoints)
        const edgeFactor = Math.min(i / 3, (steps - i) / 3, 1);
        x += (Math.random() - 0.5) * ${jitter} * 2 * edgeFactor;
        y += (Math.random() - 0.5) * ${jitter} * 2 * edgeFactor;

        path.push({ x: Math.round(x), y: Math.round(y) });
      }

      ${overshoot ? `
      // Occasionally overshoot
      if (distance > 50 && Math.random() < 0.15) {
        const overshootDist = 3 + Math.random() * 10;
        const lastPoint = path[path.length - 1];
        const overshootPoint = {
          x: targetPos.x + (dx / distance) * overshootDist,
          y: targetPos.y + (dy / distance) * overshootDist
        };

        // Quick move to overshoot
        path.push({ x: Math.round(overshootPoint.x), y: Math.round(overshootPoint.y) });

        // Correct back
        for (let i = 1; i <= 3; i++) {
          const t = i / 3;
          path.push({
            x: Math.round(overshootPoint.x + (targetPos.x - overshootPoint.x) * t),
            y: Math.round(overshootPoint.y + (targetPos.y - overshootPoint.y) * t)
          });
        }
      }
      ` : ''}

      // Animate through path
      const baseDuration = ${duration || 'distance * 2'};
      const stepDelay = baseDuration / path.length;

      for (let i = 0; i < path.length; i++) {
        const point = path[i];

        // Speed curve (ease-in-out)
        const t = i / path.length;
        let speedFactor;
        if (t < 0.5) {
          speedFactor = 0.5 + t;
        } else {
          speedFactor = 1.5 - t;
        }

        const delay = stepDelay / speedFactor;

        const event = new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: point.x,
          clientY: point.y,
          screenX: point.x + window.screenX,
          screenY: point.y + window.screenY,
          movementX: i > 0 ? point.x - path[i-1].x : 0,
          movementY: i > 0 ? point.y - path[i-1].y : 0
        });

        const target = document.elementFromPoint(point.x, point.y) || document.body;
        target.dispatchEvent(event);

        await new Promise(r => setTimeout(r, delay));
      }

      window.__lastMousePos = targetPos;
      return { success: true, x: ${x}, y: ${y}, moved: true, pathLength: path.length };
    })();
  `;
}

/**
 * Generate script for mouse click
 * @param {number} x - Click X coordinate
 * @param {number} y - Click Y coordinate
 * @param {Object} options - Click options
 * @returns {string} - JavaScript code
 */
function getMouseClickScript(x, y, options = {}) {
  const {
    button = 'left',
    clickCount = 1,
    moveFirst = true
  } = options;

  const buttonCode = {
    'left': 0,
    'middle': 1,
    'right': 2
  }[button] || 0;

  return `
    (async function() {
      const x = ${x};
      const y = ${y};
      const button = ${buttonCode};
      const clickCount = ${clickCount};

      ${moveFirst ? `
      // Move to position first
      ${getMouseMoveScript(x, y)}
      ` : ''}

      const target = document.elementFromPoint(x, y);
      if (!target) {
        return { success: false, error: 'No element at coordinates' };
      }

      for (let click = 0; click < clickCount; click++) {
        // Random offset within small area for natural variation
        const offsetX = x + (Math.random() - 0.5) * 4;
        const offsetY = y + (Math.random() - 0.5) * 4;

        // Mouse enter/over if needed
        if (click === 0) {
          target.dispatchEvent(new MouseEvent('mouseenter', {
            bubbles: false,
            cancelable: false,
            view: window,
            clientX: offsetX,
            clientY: offsetY,
            button
          }));

          target.dispatchEvent(new MouseEvent('mouseover', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: offsetX,
            clientY: offsetY,
            button
          }));

          await new Promise(r => setTimeout(r, 10 + Math.random() * 30));
        }

        // Mouse down
        const mousedownEvent = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window,
          detail: click + 1,
          clientX: offsetX,
          clientY: offsetY,
          screenX: offsetX + window.screenX,
          screenY: offsetY + window.screenY,
          button,
          buttons: 1 << button
        });
        target.dispatchEvent(mousedownEvent);

        // Hold duration
        await new Promise(r => setTimeout(r, 50 + Math.random() * 100));

        // Mouse up
        const mouseupEvent = new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          view: window,
          detail: click + 1,
          clientX: offsetX,
          clientY: offsetY,
          screenX: offsetX + window.screenX,
          screenY: offsetY + window.screenY,
          button,
          buttons: 0
        });
        target.dispatchEvent(mouseupEvent);

        await new Promise(r => setTimeout(r, 5 + Math.random() * 15));

        // Click event
        const clickEvent = new MouseEvent(button === 2 ? 'contextmenu' : 'click', {
          bubbles: true,
          cancelable: true,
          view: window,
          detail: click + 1,
          clientX: offsetX,
          clientY: offsetY,
          screenX: offsetX + window.screenX,
          screenY: offsetY + window.screenY,
          button
        });
        target.dispatchEvent(clickEvent);

        // Double-click event if applicable
        if (clickCount >= 2 && click === 1 && button === 0) {
          await new Promise(r => setTimeout(r, 5 + Math.random() * 10));
          target.dispatchEvent(new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            view: window,
            detail: 2,
            clientX: offsetX,
            clientY: offsetY,
            button: 0
          }));
        }

        // Delay between clicks for double/triple click
        if (click < clickCount - 1) {
          await new Promise(r => setTimeout(r, 80 + Math.random() * 120));
        }
      }

      window.__lastMousePos = { x, y };
      return { success: true, x, y, button, clickCount, element: target.tagName };
    })();
  `;
}

/**
 * Generate script for mouse double-click
 * @param {number} x - Click X coordinate
 * @param {number} y - Click Y coordinate
 * @param {Object} options - Click options
 * @returns {string} - JavaScript code
 */
function getMouseDoubleClickScript(x, y, options = {}) {
  return getMouseClickScript(x, y, { ...options, clickCount: 2 });
}

/**
 * Generate script for mouse right-click
 * @param {number} x - Click X coordinate
 * @param {number} y - Click Y coordinate
 * @param {Object} options - Click options
 * @returns {string} - JavaScript code
 */
function getMouseRightClickScript(x, y, options = {}) {
  return getMouseClickScript(x, y, { ...options, button: 'right' });
}

/**
 * Generate script for drag and drop
 * @param {Object} start - Start point {x, y}
 * @param {Object} end - End point {x, y}
 * @param {Object} options - Drag options
 * @returns {string} - JavaScript code
 */
function getMouseDragScript(start, end, options = {}) {
  const {
    steps = 25,
    holdTime = 100,
    releaseTime = 50
  } = options;

  return `
    (async function() {
      const startX = ${start.x};
      const startY = ${start.y};
      const endX = ${end.x};
      const endY = ${end.y};

      // Move to start position
      ${getMouseMoveScript(start.x, start.y)}

      const startTarget = document.elementFromPoint(startX, startY);
      if (!startTarget) {
        return { success: false, error: 'No element at start coordinates' };
      }

      // Mouse down to start drag
      startTarget.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: startX,
        clientY: startY,
        button: 0,
        buttons: 1
      }));

      // Hold before moving
      await new Promise(r => setTimeout(r, ${holdTime} + Math.random() * 100));

      // Generate drag path
      const dx = endX - startX;
      const dy = endY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const steps = ${steps};

      // Slight curve for natural drag
      const perpX = -dy / (distance || 1);
      const perpY = dx / (distance || 1);
      const curveOffset = (Math.random() - 0.5) * distance * 0.1;

      for (let i = 1; i <= steps; i++) {
        const t = i / steps;

        // Slight curve in the middle
        const curveFactor = Math.sin(t * Math.PI) * curveOffset;
        const x = startX + dx * t + perpX * curveFactor;
        const y = startY + dy * t + perpY * curveFactor;

        // Add slight jitter
        const jitterX = (Math.random() - 0.5) * 2;
        const jitterY = (Math.random() - 0.5) * 2;

        const currentTarget = document.elementFromPoint(x + jitterX, y + jitterY) || document.body;

        currentTarget.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x + jitterX,
          clientY: y + jitterY,
          button: 0,
          buttons: 1,
          movementX: dx / steps,
          movementY: dy / steps
        }));

        // Dispatch drag event
        const dragEvent = new DragEvent('drag', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x + jitterX,
          clientY: y + jitterY
        });
        startTarget.dispatchEvent(dragEvent);

        // Variable speed during drag
        const speedFactor = 0.7 + Math.sin(t * Math.PI) * 0.3;
        await new Promise(r => setTimeout(r, (10 + Math.random() * 20) / speedFactor));
      }

      // Small pause before release
      await new Promise(r => setTimeout(r, ${releaseTime} + Math.random() * 50));

      const endTarget = document.elementFromPoint(endX, endY) || document.body;

      // Dragend on source
      startTarget.dispatchEvent(new DragEvent('dragend', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: endX,
        clientY: endY
      }));

      // Drop on target
      endTarget.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: endX,
        clientY: endY
      }));

      // Mouse up to finish
      endTarget.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: endX,
        clientY: endY,
        button: 0,
        buttons: 0
      }));

      window.__lastMousePos = { x: endX, y: endY };
      return { success: true, start: { x: startX, y: startY }, end: { x: endX, y: endY } };
    })();
  `;
}

/**
 * Generate script for hover
 * @param {number} x - Hover X coordinate
 * @param {number} y - Hover Y coordinate
 * @param {Object} options - Hover options
 * @returns {string} - JavaScript code
 */
function getMouseHoverScript(x, y, options = {}) {
  const {
    duration = 500,
    moveFirst = true
  } = options;

  return `
    (async function() {
      const x = ${x};
      const y = ${y};

      ${moveFirst ? `
      // Move to position
      ${getMouseMoveScript(x, y)}
      ` : ''}

      const target = document.elementFromPoint(x, y);
      if (!target) {
        return { success: false, error: 'No element at coordinates' };
      }

      // Mouse enter
      target.dispatchEvent(new MouseEvent('mouseenter', {
        bubbles: false,
        cancelable: false,
        view: window,
        clientX: x,
        clientY: y
      }));

      // Mouse over
      target.dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y
      }));

      // Small movements during hover
      const hoverDuration = ${duration} + Math.random() * 200;
      const startTime = Date.now();

      while (Date.now() - startTime < hoverDuration) {
        const jitterX = x + (Math.random() - 0.5) * 3;
        const jitterY = y + (Math.random() - 0.5) * 3;

        target.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: jitterX,
          clientY: jitterY
        }));

        await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
      }

      window.__lastMousePos = { x, y };
      return { success: true, x, y, duration: hoverDuration, element: target.tagName };
    })();
  `;
}

/**
 * Generate script for scroll with momentum
 * @param {Object} options - Scroll options
 * @returns {string} - JavaScript code
 */
function getMouseScrollScript(options = {}) {
  const {
    x = null,
    y = null,
    deltaY = 300,
    deltaX = 0,
    momentum = true,
    smooth = true,
    selector = null
  } = options;

  return `
    (async function() {
      let target;
      let scrollX = ${x !== null ? x : 'window.innerWidth / 2'};
      let scrollY = ${y !== null ? y : 'window.innerHeight / 2'};

      ${selector ? `
      target = document.querySelector('${selector.replace(/'/g, "\\'")}');
      if (!target) {
        return { success: false, error: 'Selector not found' };
      }
      const rect = target.getBoundingClientRect();
      scrollX = rect.left + rect.width / 2;
      scrollY = rect.top + rect.height / 2;
      ` : `
      target = document.elementFromPoint(scrollX, scrollY) || document.documentElement;
      `}

      // Find scrollable parent
      let scrollableTarget = target;
      while (scrollableTarget && scrollableTarget !== document.documentElement) {
        const style = window.getComputedStyle(scrollableTarget);
        if (style.overflowY === 'scroll' || style.overflowY === 'auto') {
          if (scrollableTarget.scrollHeight > scrollableTarget.clientHeight) {
            break;
          }
        }
        scrollableTarget = scrollableTarget.parentElement;
      }
      scrollableTarget = scrollableTarget || document.documentElement;

      const totalDeltaY = ${deltaY};
      const totalDeltaX = ${deltaX};
      const momentum = ${momentum};
      const smooth = ${smooth};

      if (!momentum) {
        // Simple scroll
        if (scrollableTarget === document.documentElement) {
          window.scrollBy({
            top: totalDeltaY,
            left: totalDeltaX,
            behavior: smooth ? 'smooth' : 'auto'
          });
        } else {
          scrollableTarget.scrollBy({
            top: totalDeltaY,
            left: totalDeltaX,
            behavior: smooth ? 'smooth' : 'auto'
          });
        }
        return { success: true, deltaY: totalDeltaY, deltaX: totalDeltaX };
      }

      // Momentum-based scroll
      const steps = 10 + Math.floor(Math.random() * 10);
      let remainingY = totalDeltaY;
      let remainingX = totalDeltaX;

      // Initial velocity
      let velocityY = totalDeltaY / steps * 2;
      let velocityX = totalDeltaX / steps * 2;
      const decay = 0.85 + Math.random() * 0.1;

      for (let i = 0; i < steps && (Math.abs(remainingY) > 1 || Math.abs(remainingX) > 1); i++) {
        // Add jitter for realism
        const jitterY = (Math.random() - 0.5) * 3;
        const jitterX = (Math.random() - 0.5) * 3;

        const stepY = Math.round(velocityY + jitterY);
        const stepX = Math.round(velocityX + jitterX);

        // Dispatch wheel event
        const wheelEvent = new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: scrollX + (Math.random() - 0.5) * 10,
          clientY: scrollY + (Math.random() - 0.5) * 10,
          deltaX: stepX,
          deltaY: stepY,
          deltaMode: 0 // pixels
        });
        target.dispatchEvent(wheelEvent);

        // Apply scroll
        if (scrollableTarget === document.documentElement) {
          window.scrollBy(stepX, stepY);
        } else {
          scrollableTarget.scrollBy(stepX, stepY);
        }

        remainingY -= stepY;
        remainingX -= stepX;

        // Apply momentum decay
        velocityY *= decay;
        velocityX *= decay;

        // Variable timing
        await new Promise(r => setTimeout(r, 15 + Math.random() * 25));
      }

      return {
        success: true,
        deltaY: totalDeltaY - remainingY,
        deltaX: totalDeltaX - remainingX,
        steps
      };
    })();
  `;
}

/**
 * Generate script for wheel event
 * @param {Object} options - Wheel options
 * @returns {string} - JavaScript code
 */
function getMouseWheelScript(options = {}) {
  const {
    x = null,
    y = null,
    deltaY = 100,
    deltaX = 0,
    deltaMode = 0 // 0 = pixels, 1 = lines, 2 = pages
  } = options;

  return `
    (function() {
      const x = ${x !== null ? x : 'window.innerWidth / 2'};
      const y = ${y !== null ? y : 'window.innerHeight / 2'};

      const target = document.elementFromPoint(x, y) || document.body;

      const wheelEvent = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        deltaX: ${deltaX},
        deltaY: ${deltaY},
        deltaMode: ${deltaMode}
      });

      const cancelled = !target.dispatchEvent(wheelEvent);

      if (!cancelled) {
        // If not cancelled, scroll the document
        window.scrollBy(${deltaX}, ${deltaY});
      }

      return { success: true, deltaX: ${deltaX}, deltaY: ${deltaY}, cancelled };
    })();
  `;
}

/**
 * Generate script for click on element by selector
 * @param {string} selector - CSS selector
 * @param {Object} options - Click options
 * @returns {string} - JavaScript code
 */
function getClickElementScript(selector, options = {}) {
  const {
    button = 'left',
    clickCount = 1,
    offset = { x: 0.5, y: 0.5 } // Position within element (0-1)
  } = options;

  const buttonCode = { 'left': 0, 'middle': 1, 'right': 2 }[button] || 0;

  return `
    (async function() {
      const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
      if (!element) {
        return { success: false, error: 'Element not found' };
      }

      const rect = element.getBoundingClientRect();

      // Random position within element with bias towards center
      const offsetX = ${offset.x} + (Math.random() - 0.5) * 0.3;
      const offsetY = ${offset.y} + (Math.random() - 0.5) * 0.3;

      const x = rect.left + rect.width * Math.max(0.1, Math.min(0.9, offsetX));
      const y = rect.top + rect.height * Math.max(0.1, Math.min(0.9, offsetY));

      // Move to element first
      ${getMouseMoveScript('x', 'y', { duration: 'null' })}

      // Perform click
      const clickResult = await (${getMouseClickScript('x', 'y', { button, clickCount, moveFirst: false })});

      return { ...clickResult, selector: '${selector.replace(/'/g, "\\'")}' };
    })();
  `;
}

/**
 * Get the current mouse position tracking script
 * @returns {string} - JavaScript code
 */
function getMousePositionTrackingScript() {
  return `
    (function() {
      if (!window.__mouseTrackingEnabled) {
        window.__lastMousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        document.addEventListener('mousemove', function(e) {
          window.__lastMousePos = { x: e.clientX, y: e.clientY };
        }, { passive: true });
        window.__mouseTrackingEnabled = true;
      }
      return window.__lastMousePos;
    })();
  `;
}

module.exports = {
  MOUSE_BUTTONS,
  TIMING_CONFIG,
  generateControlPoints,
  bezierCurve,
  addJitter,
  generateHumanMousePath,
  speedCurve,
  getMouseMoveScript,
  getMouseClickScript,
  getMouseDoubleClickScript,
  getMouseRightClickScript,
  getMouseDragScript,
  getMouseHoverScript,
  getMouseScrollScript,
  getMouseWheelScript,
  getClickElementScript,
  getMousePositionTrackingScript
};
