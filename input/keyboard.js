/**
 * Basset Hound Browser - Advanced Keyboard Simulation Module
 * Provides human-like keyboard input simulation for evasion and automation
 */

const { humanDelay, normalDelay } = require('../evasion/humanize');

/**
 * Key codes for special keys and modifiers
 */
const KEY_CODES = {
  // Modifier keys
  Shift: { key: 'Shift', code: 'ShiftLeft', keyCode: 16 },
  Control: { key: 'Control', code: 'ControlLeft', keyCode: 17 },
  Alt: { key: 'Alt', code: 'AltLeft', keyCode: 18 },
  Meta: { key: 'Meta', code: 'MetaLeft', keyCode: 91 },

  // Special keys
  Enter: { key: 'Enter', code: 'Enter', keyCode: 13 },
  Tab: { key: 'Tab', code: 'Tab', keyCode: 9 },
  Escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
  Backspace: { key: 'Backspace', code: 'Backspace', keyCode: 8 },
  Delete: { key: 'Delete', code: 'Delete', keyCode: 46 },
  Space: { key: ' ', code: 'Space', keyCode: 32 },

  // Arrow keys
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },

  // Navigation keys
  Home: { key: 'Home', code: 'Home', keyCode: 36 },
  End: { key: 'End', code: 'End', keyCode: 35 },
  PageUp: { key: 'PageUp', code: 'PageUp', keyCode: 33 },
  PageDown: { key: 'PageDown', code: 'PageDown', keyCode: 34 },
  Insert: { key: 'Insert', code: 'Insert', keyCode: 45 },

  // Function keys
  F1: { key: 'F1', code: 'F1', keyCode: 112 },
  F2: { key: 'F2', code: 'F2', keyCode: 113 },
  F3: { key: 'F3', code: 'F3', keyCode: 114 },
  F4: { key: 'F4', code: 'F4', keyCode: 115 },
  F5: { key: 'F5', code: 'F5', keyCode: 116 },
  F6: { key: 'F6', code: 'F6', keyCode: 117 },
  F7: { key: 'F7', code: 'F7', keyCode: 118 },
  F8: { key: 'F8', code: 'F8', keyCode: 119 },
  F9: { key: 'F9', code: 'F9', keyCode: 120 },
  F10: { key: 'F10', code: 'F10', keyCode: 121 },
  F11: { key: 'F11', code: 'F11', keyCode: 122 },
  F12: { key: 'F12', code: 'F12', keyCode: 123 },

  // Lock keys
  CapsLock: { key: 'CapsLock', code: 'CapsLock', keyCode: 20 },
  NumLock: { key: 'NumLock', code: 'NumLock', keyCode: 144 },
  ScrollLock: { key: 'ScrollLock', code: 'ScrollLock', keyCode: 145 }
};

/**
 * International keyboard layouts for realistic typing simulation
 */
const KEYBOARD_LAYOUTS = {
  'en-US': {
    name: 'US English',
    shiftMap: {
      '1': '!', '2': '@', '3': '#', '4': '$', '5': '%',
      '6': '^', '7': '&', '8': '*', '9': '(', '0': ')',
      '-': '_', '=': '+', '[': '{', ']': '}', '\\': '|',
      ';': ':', "'": '"', ',': '<', '.': '>', '/': '?',
      '`': '~'
    }
  },
  'en-GB': {
    name: 'UK English',
    shiftMap: {
      '1': '!', '2': '"', '3': '#', '4': '$', '5': '%',
      '6': '^', '7': '&', '8': '*', '9': '(', '0': ')',
      '-': '_', '=': '+', '[': '{', ']': '}', '#': '~',
      ';': ':', "'": '@', ',': '<', '.': '>', '/': '?',
      '`': '|', '\\': '|'
    }
  },
  'de-DE': {
    name: 'German',
    shiftMap: {
      '1': '!', '2': '"', '3': '#', '4': '$', '5': '%',
      '6': '&', '7': '/', '8': '(', '9': ')', '0': '=',
      '-': '?', '+': '*', '#': "'"
    },
    specialChars: {
      'y': 'z', 'z': 'y' // QWERTZ layout
    }
  },
  'fr-FR': {
    name: 'French',
    shiftMap: {
      '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
      '6': '6', '7': '7', '8': '8', '9': '9', '0': '0',
      '-': '_'
    },
    specialChars: {
      'a': 'q', 'q': 'a', 'w': 'z', 'z': 'w', 'm': ',' // AZERTY layout
    }
  },
  'es-ES': {
    name: 'Spanish',
    shiftMap: {
      '1': '!', '2': '"', '3': '#', '4': '$', '5': '%',
      '6': '&', '7': '/', '8': '(', '9': ')', '0': '='
    }
  }
};

/**
 * Common typing patterns for human-like behavior
 */
const TYPING_PATTERNS = {
  // Common digraphs that are typed faster
  fastPairs: ['th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd', 'ti', 'es', 'or', 'te', 'of', 'ed', 'is', 'it', 'al', 'ar', 'st', 'to', 'nt', 'ng', 'se', 'ha', 'as', 'ou', 'io', 'le', 've', 'co', 'me', 'de', 'hi', 'ri', 'ro', 'ic', 'ne', 'ea', 'ra', 'ce'],

  // Characters that are often mistyped
  errorProne: {
    'a': ['s', 'q', 'z'],
    's': ['a', 'd', 'w', 'x'],
    'd': ['s', 'f', 'e', 'c'],
    'f': ['d', 'g', 'r', 'v'],
    'g': ['f', 'h', 't', 'b'],
    'e': ['w', 'r', 'd'],
    'r': ['e', 't', 'f'],
    't': ['r', 'y', 'g'],
    'i': ['u', 'o', 'k'],
    'o': ['i', 'p', 'l'],
    'n': ['b', 'm', 'h'],
    'm': ['n', 'k', 'j']
  }
};

/**
 * Get key information for a character
 * @param {string} char - Character to get info for
 * @param {string} layout - Keyboard layout
 * @returns {Object} - Key information
 */
function getKeyInfo(char, layout = 'en-US') {
  const layoutData = KEYBOARD_LAYOUTS[layout] || KEYBOARD_LAYOUTS['en-US'];

  // Check if it's a special key
  if (KEY_CODES[char]) {
    return KEY_CODES[char];
  }

  // Check if shift is needed
  let needsShift = false;
  let baseChar = char;

  if (char >= 'A' && char <= 'Z') {
    needsShift = true;
    baseChar = char.toLowerCase();
  } else if (layoutData.shiftMap) {
    for (const [base, shifted] of Object.entries(layoutData.shiftMap)) {
      if (shifted === char) {
        needsShift = true;
        baseChar = base;
        break;
      }
    }
  }

  // Generate key code
  let code;
  if (baseChar >= 'a' && baseChar <= 'z') {
    code = `Key${baseChar.toUpperCase()}`;
  } else if (baseChar >= '0' && baseChar <= '9') {
    code = `Digit${baseChar}`;
  } else {
    // Map special characters to codes
    const specialCodes = {
      ' ': 'Space',
      '-': 'Minus',
      '=': 'Equal',
      '[': 'BracketLeft',
      ']': 'BracketRight',
      '\\': 'Backslash',
      ';': 'Semicolon',
      "'": 'Quote',
      '`': 'Backquote',
      ',': 'Comma',
      '.': 'Period',
      '/': 'Slash'
    };
    code = specialCodes[baseChar] || `Key${baseChar.toUpperCase()}`;
  }

  return {
    key: char,
    code,
    keyCode: char.charCodeAt(0),
    needsShift
  };
}

/**
 * Generate key timing for realistic typing
 * @param {string} char - Current character
 * @param {string} prevChar - Previous character
 * @param {Object} options - Timing options
 * @returns {Object} - Timing values
 */
function getKeyTiming(char, prevChar = null, options = {}) {
  const {
    baseDelay = 80,
    variation = 40,
    fastPairSpeedup = 0.6,
    punctuationSlowdown = 1.5,
    spaceSlowdown = 1.2
  } = options;

  let delay = baseDelay + (Math.random() - 0.5) * variation * 2;

  // Speed up for common digraphs
  if (prevChar) {
    const pair = (prevChar + char).toLowerCase();
    if (TYPING_PATTERNS.fastPairs.includes(pair)) {
      delay *= fastPairSpeedup;
    }
  }

  // Slow down for punctuation
  if (['.', ',', '!', '?', ';', ':', '-', "'", '"'].includes(char)) {
    delay *= punctuationSlowdown;
  }

  // Slight slowdown after spaces (word boundary)
  if (prevChar === ' ') {
    delay *= spaceSlowdown;
  }

  // Space itself is typed with slight pause
  if (char === ' ') {
    delay *= 1.1;
  }

  // Key down/up timing
  const keyDownDuration = 20 + Math.random() * 40;

  return {
    preDelay: Math.max(10, Math.floor(delay)),
    keyDownDuration: Math.floor(keyDownDuration),
    postDelay: Math.floor(5 + Math.random() * 15)
  };
}

/**
 * Generate script for key down event
 * @param {Object} keyInfo - Key information
 * @param {Object} modifiers - Active modifiers
 * @returns {string} - JavaScript code
 */
function getKeyDownScript(keyInfo, modifiers = {}) {
  const { key, code, keyCode } = keyInfo;
  const { shift = false, ctrl = false, alt = false, meta = false } = modifiers;

  return `
    (function() {
      const event = new KeyboardEvent('keydown', {
        key: '${key.replace(/'/g, "\\'")}',
        code: '${code}',
        keyCode: ${keyCode || key.charCodeAt(0)},
        which: ${keyCode || key.charCodeAt(0)},
        shiftKey: ${shift},
        ctrlKey: ${ctrl},
        altKey: ${alt},
        metaKey: ${meta},
        bubbles: true,
        cancelable: true,
        composed: true
      });
      const target = document.activeElement || document.body;
      target.dispatchEvent(event);
      return { success: true, key: '${key.replace(/'/g, "\\'")}', type: 'keydown' };
    })();
  `;
}

/**
 * Generate script for key up event
 * @param {Object} keyInfo - Key information
 * @param {Object} modifiers - Active modifiers
 * @returns {string} - JavaScript code
 */
function getKeyUpScript(keyInfo, modifiers = {}) {
  const { key, code, keyCode } = keyInfo;
  const { shift = false, ctrl = false, alt = false, meta = false } = modifiers;

  return `
    (function() {
      const event = new KeyboardEvent('keyup', {
        key: '${key.replace(/'/g, "\\'")}',
        code: '${code}',
        keyCode: ${keyCode || key.charCodeAt(0)},
        which: ${keyCode || key.charCodeAt(0)},
        shiftKey: ${shift},
        ctrlKey: ${ctrl},
        altKey: ${alt},
        metaKey: ${meta},
        bubbles: true,
        cancelable: true,
        composed: true
      });
      const target = document.activeElement || document.body;
      target.dispatchEvent(event);
      return { success: true, key: '${key.replace(/'/g, "\\'")}', type: 'keyup' };
    })();
  `;
}

/**
 * Generate script for key press event (deprecated but still used by some sites)
 * @param {Object} keyInfo - Key information
 * @param {Object} modifiers - Active modifiers
 * @returns {string} - JavaScript code
 */
function getKeyPressScript(keyInfo, modifiers = {}) {
  const { key, keyCode } = keyInfo;
  const { shift = false, ctrl = false, alt = false, meta = false } = modifiers;

  return `
    (function() {
      const event = new KeyboardEvent('keypress', {
        key: '${key.replace(/'/g, "\\'")}',
        charCode: ${key.charCodeAt(0)},
        keyCode: ${keyCode || key.charCodeAt(0)},
        which: ${keyCode || key.charCodeAt(0)},
        shiftKey: ${shift},
        ctrlKey: ${ctrl},
        altKey: ${alt},
        metaKey: ${meta},
        bubbles: true,
        cancelable: true,
        composed: true
      });
      const target = document.activeElement || document.body;
      target.dispatchEvent(event);
      return { success: true, key: '${key.replace(/'/g, "\\'")}', type: 'keypress' };
    })();
  `;
}

/**
 * Generate complete key press script (down + press + up + input update)
 * @param {string} key - Key to press
 * @param {Object} options - Options
 * @returns {string} - JavaScript code
 */
function getFullKeyPressScript(key, options = {}) {
  const { modifiers = {}, updateInput = true, layout = 'en-US' } = options;
  const keyInfo = KEY_CODES[key] || getKeyInfo(key, layout);
  const timing = getKeyTiming(key);

  const needsShift = keyInfo.needsShift || modifiers.shift;
  const mods = { ...modifiers, shift: needsShift };

  return `
    (async function() {
      const target = document.activeElement || document.body;
      const key = '${keyInfo.key.replace(/'/g, "\\'")}';
      const code = '${keyInfo.code}';
      const keyCode = ${keyInfo.keyCode || keyInfo.key.charCodeAt(0)};

      // Key down
      target.dispatchEvent(new KeyboardEvent('keydown', {
        key,
        code,
        keyCode,
        which: keyCode,
        shiftKey: ${mods.shift || false},
        ctrlKey: ${mods.ctrl || false},
        altKey: ${mods.alt || false},
        metaKey: ${mods.meta || false},
        bubbles: true,
        cancelable: true,
        composed: true
      }));

      await new Promise(r => setTimeout(r, ${timing.keyDownDuration}));

      // Key press (for character keys)
      ${!KEY_CODES[key] ? `
      target.dispatchEvent(new KeyboardEvent('keypress', {
        key,
        charCode: key.charCodeAt(0),
        keyCode: key.charCodeAt(0),
        which: key.charCodeAt(0),
        shiftKey: ${mods.shift || false},
        ctrlKey: ${mods.ctrl || false},
        altKey: ${mods.alt || false},
        metaKey: ${mods.meta || false},
        bubbles: true,
        cancelable: true,
        composed: true
      }));
      ` : ''}

      // Update input value if target is input/textarea
      ${updateInput ? `
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        const start = target.selectionStart || 0;
        const end = target.selectionEnd || 0;
        const value = target.value;

        if ('${key}' === 'Backspace') {
          if (start !== end) {
            target.value = value.substring(0, start) + value.substring(end);
            target.selectionStart = target.selectionEnd = start;
          } else if (start > 0) {
            target.value = value.substring(0, start - 1) + value.substring(start);
            target.selectionStart = target.selectionEnd = start - 1;
          }
        } else if ('${key}' === 'Delete') {
          if (start !== end) {
            target.value = value.substring(0, start) + value.substring(end);
          } else if (end < value.length) {
            target.value = value.substring(0, start) + value.substring(start + 1);
          }
          target.selectionStart = target.selectionEnd = start;
        } else if (!${!!KEY_CODES[key]}) {
          target.value = value.substring(0, start) + key + value.substring(end);
          target.selectionStart = target.selectionEnd = start + 1;
        }

        // Dispatch input event
        target.dispatchEvent(new InputEvent('input', {
          inputType: ${KEY_CODES[key] ? "'deleteContentBackward'" : "'insertText'"},
          data: ${KEY_CODES[key] ? 'null' : 'key'},
          bubbles: true,
          cancelable: true
        }));
      }
      ` : ''}

      await new Promise(r => setTimeout(r, ${timing.postDelay}));

      // Key up
      target.dispatchEvent(new KeyboardEvent('keyup', {
        key,
        code,
        keyCode,
        which: keyCode,
        shiftKey: ${mods.shift || false},
        ctrlKey: ${mods.ctrl || false},
        altKey: ${mods.alt || false},
        metaKey: ${mods.meta || false},
        bubbles: true,
        cancelable: true,
        composed: true
      }));

      return { success: true, key, targetTag: target.tagName };
    })();
  `;
}

/**
 * Generate script for key combination (e.g., Ctrl+C)
 * @param {Array} keys - Array of keys in the combination
 * @param {Object} options - Options
 * @returns {string} - JavaScript code
 */
function getKeyCombinationScript(keys, options = {}) {
  const { holdTime = 50 } = options;

  // Normalize key names
  const normalizedKeys = keys.map(k => {
    const upper = k.charAt(0).toUpperCase() + k.slice(1).toLowerCase();
    return KEY_CODES[upper] ? upper : (KEY_CODES[k] ? k : k);
  });

  // Separate modifiers from main keys
  const modifierNames = ['Shift', 'Control', 'Alt', 'Meta', 'Ctrl', 'Cmd', 'Command'];
  const modifiers = normalizedKeys.filter(k =>
    modifierNames.includes(k) || modifierNames.includes(k.replace('Left', '').replace('Right', ''))
  );
  const mainKeys = normalizedKeys.filter(k => !modifiers.includes(k));

  // Map common aliases
  const modifierMap = {
    'Ctrl': 'Control',
    'Cmd': 'Meta',
    'Command': 'Meta'
  };

  const resolvedModifiers = modifiers.map(m => modifierMap[m] || m);

  return `
    (async function() {
      const target = document.activeElement || document.body;
      const modifiers = ${JSON.stringify(resolvedModifiers)};
      const mainKeys = ${JSON.stringify(mainKeys)};

      const modState = {
        shiftKey: modifiers.includes('Shift'),
        ctrlKey: modifiers.includes('Control'),
        altKey: modifiers.includes('Alt'),
        metaKey: modifiers.includes('Meta')
      };

      // Press modifiers
      for (const mod of modifiers) {
        const keyInfo = {
          'Shift': { key: 'Shift', code: 'ShiftLeft', keyCode: 16 },
          'Control': { key: 'Control', code: 'ControlLeft', keyCode: 17 },
          'Alt': { key: 'Alt', code: 'AltLeft', keyCode: 18 },
          'Meta': { key: 'Meta', code: 'MetaLeft', keyCode: 91 }
        }[mod];

        if (keyInfo) {
          target.dispatchEvent(new KeyboardEvent('keydown', {
            key: keyInfo.key,
            code: keyInfo.code,
            keyCode: keyInfo.keyCode,
            which: keyInfo.keyCode,
            ...modState,
            bubbles: true,
            cancelable: true
          }));
          await new Promise(r => setTimeout(r, 10 + Math.random() * 20));
        }
      }

      // Press main keys
      for (const key of mainKeys) {
        const keyInfo = ${JSON.stringify(KEY_CODES)}[key] || {
          key: key.length === 1 ? key : key,
          code: key.length === 1 ? 'Key' + key.toUpperCase() : key,
          keyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0
        };

        target.dispatchEvent(new KeyboardEvent('keydown', {
          key: keyInfo.key,
          code: keyInfo.code,
          keyCode: keyInfo.keyCode,
          which: keyInfo.keyCode,
          ...modState,
          bubbles: true,
          cancelable: true
        }));

        await new Promise(r => setTimeout(r, ${holdTime}));

        target.dispatchEvent(new KeyboardEvent('keyup', {
          key: keyInfo.key,
          code: keyInfo.code,
          keyCode: keyInfo.keyCode,
          which: keyInfo.keyCode,
          ...modState,
          bubbles: true,
          cancelable: true
        }));
      }

      // Release modifiers in reverse order
      for (const mod of modifiers.reverse()) {
        const keyInfo = {
          'Shift': { key: 'Shift', code: 'ShiftLeft', keyCode: 16 },
          'Control': { key: 'Control', code: 'ControlLeft', keyCode: 17 },
          'Alt': { key: 'Alt', code: 'AltLeft', keyCode: 18 },
          'Meta': { key: 'Meta', code: 'MetaLeft', keyCode: 91 }
        }[mod];

        if (keyInfo) {
          await new Promise(r => setTimeout(r, 5 + Math.random() * 15));
          target.dispatchEvent(new KeyboardEvent('keyup', {
            key: keyInfo.key,
            code: keyInfo.code,
            keyCode: keyInfo.keyCode,
            which: keyInfo.keyCode,
            ...modState,
            bubbles: true,
            cancelable: true
          }));
        }
      }

      return { success: true, combination: modifiers.concat(mainKeys).join('+') };
    })();
  `;
}

/**
 * Generate script for typing text with human-like timing
 * @param {string} text - Text to type
 * @param {Object} options - Typing options
 * @returns {string} - JavaScript code
 */
function getTypeTextScript(text, options = {}) {
  const {
    minDelay = 30,
    maxDelay = 150,
    mistakeRate = 0.02,
    pauseChance = 0.03,
    pauseDuration = { min: 200, max: 500 },
    layout = 'en-US',
    clearFirst = false
  } = options;

  // Escape special characters in text
  const escapedText = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');

  return `
    (async function() {
      const target = document.activeElement;
      if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable)) {
        return { success: false, error: 'No input element focused' };
      }

      const text = '${escapedText}';
      const minDelay = ${minDelay};
      const maxDelay = ${maxDelay};
      const mistakeRate = ${mistakeRate};
      const pauseChance = ${pauseChance};
      const pauseMin = ${pauseDuration.min};
      const pauseMax = ${pauseDuration.max};

      // Common fast pairs
      const fastPairs = ${JSON.stringify(TYPING_PATTERNS.fastPairs)};

      // Error-prone keys
      const errorProne = ${JSON.stringify(TYPING_PATTERNS.errorProne)};

      ${clearFirst ? `
      // Clear existing content
      if (target.isContentEditable) {
        target.innerHTML = '';
      } else {
        target.value = '';
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
      ` : ''}

      let typedText = '';
      let prevChar = null;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // Random thinking pause
        if (Math.random() < pauseChance) {
          await new Promise(r => setTimeout(r, pauseMin + Math.random() * (pauseMax - pauseMin)));
        }

        // Simulate occasional typo
        if (Math.random() < mistakeRate && errorProne[char.toLowerCase()]) {
          const wrongChars = errorProne[char.toLowerCase()];
          const wrongChar = wrongChars[Math.floor(Math.random() * wrongChars.length)];

          // Type wrong character
          await typeChar(target, wrongChar);
          typedText += wrongChar;
          await new Promise(r => setTimeout(r, minDelay + Math.random() * (maxDelay - minDelay)));

          // Pause before correction
          await new Promise(r => setTimeout(r, 100 + Math.random() * 200));

          // Backspace
          await typeBackspace(target);
          typedText = typedText.slice(0, -1);
          await new Promise(r => setTimeout(r, minDelay + Math.random() * (maxDelay - minDelay)));
        }

        // Type the correct character
        await typeChar(target, char);
        typedText += char;

        // Calculate delay
        let delay = minDelay + Math.random() * (maxDelay - minDelay);

        // Speed up for common pairs
        if (prevChar) {
          const pair = (prevChar + char).toLowerCase();
          if (fastPairs.includes(pair)) {
            delay *= 0.6;
          }
        }

        // Slow down for punctuation
        if (['.', ',', '!', '?', ';', ':'].includes(char)) {
          delay *= 1.5;
        }

        // Slight pause after space
        if (char === ' ') {
          delay *= 1.2;
        }

        prevChar = char;
        await new Promise(r => setTimeout(r, delay));
      }

      // Dispatch change event when done
      target.dispatchEvent(new Event('change', { bubbles: true }));

      return { success: true, typed: text.length, text: typedText };

      async function typeChar(target, char) {
        const isShift = char !== char.toLowerCase() && char === char.toUpperCase();
        const code = char.length === 1 && char >= 'a' && char <= 'z' ? 'Key' + char.toUpperCase() :
                    char.length === 1 && char >= 'A' && char <= 'Z' ? 'Key' + char :
                    char >= '0' && char <= '9' ? 'Digit' + char : 'Key' + char;

        // Key down
        target.dispatchEvent(new KeyboardEvent('keydown', {
          key: char,
          code,
          keyCode: char.charCodeAt(0),
          which: char.charCodeAt(0),
          shiftKey: isShift,
          bubbles: true,
          cancelable: true
        }));

        await new Promise(r => setTimeout(r, 10 + Math.random() * 30));

        // Key press
        target.dispatchEvent(new KeyboardEvent('keypress', {
          key: char,
          charCode: char.charCodeAt(0),
          keyCode: char.charCodeAt(0),
          which: char.charCodeAt(0),
          shiftKey: isShift,
          bubbles: true,
          cancelable: true
        }));

        // Update value
        if (target.isContentEditable) {
          document.execCommand('insertText', false, char);
        } else {
          const start = target.selectionStart || target.value.length;
          const end = target.selectionEnd || target.value.length;
          target.value = target.value.substring(0, start) + char + target.value.substring(end);
          target.selectionStart = target.selectionEnd = start + 1;
        }

        // Input event
        target.dispatchEvent(new InputEvent('input', {
          inputType: 'insertText',
          data: char,
          bubbles: true
        }));

        await new Promise(r => setTimeout(r, 5 + Math.random() * 15));

        // Key up
        target.dispatchEvent(new KeyboardEvent('keyup', {
          key: char,
          code,
          keyCode: char.charCodeAt(0),
          which: char.charCodeAt(0),
          shiftKey: isShift,
          bubbles: true,
          cancelable: true
        }));
      }

      async function typeBackspace(target) {
        target.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Backspace',
          code: 'Backspace',
          keyCode: 8,
          which: 8,
          bubbles: true,
          cancelable: true
        }));

        await new Promise(r => setTimeout(r, 10 + Math.random() * 20));

        if (target.isContentEditable) {
          document.execCommand('delete', false);
        } else {
          const start = target.selectionStart || 0;
          const end = target.selectionEnd || 0;
          if (start !== end) {
            target.value = target.value.substring(0, start) + target.value.substring(end);
            target.selectionStart = target.selectionEnd = start;
          } else if (start > 0) {
            target.value = target.value.substring(0, start - 1) + target.value.substring(start);
            target.selectionStart = target.selectionEnd = start - 1;
          }
        }

        target.dispatchEvent(new InputEvent('input', {
          inputType: 'deleteContentBackward',
          bubbles: true
        }));

        await new Promise(r => setTimeout(r, 5 + Math.random() * 10));

        target.dispatchEvent(new KeyboardEvent('keyup', {
          key: 'Backspace',
          code: 'Backspace',
          keyCode: 8,
          which: 8,
          bubbles: true,
          cancelable: true
        }));
      }
    })();
  `;
}

/**
 * Generate script for pressing special keys
 * @param {string} key - Special key name
 * @param {Object} options - Options
 * @returns {string} - JavaScript code
 */
function getSpecialKeyScript(key, options = {}) {
  const { repeat = 1, delay = 100 } = options;
  const keyInfo = KEY_CODES[key];

  if (!keyInfo) {
    throw new Error(`Unknown special key: ${key}`);
  }

  return `
    (async function() {
      const target = document.activeElement || document.body;
      const keyInfo = ${JSON.stringify(keyInfo)};
      const repeat = ${repeat};
      const delay = ${delay};

      for (let i = 0; i < repeat; i++) {
        // Key down
        target.dispatchEvent(new KeyboardEvent('keydown', {
          key: keyInfo.key,
          code: keyInfo.code,
          keyCode: keyInfo.keyCode,
          which: keyInfo.keyCode,
          bubbles: true,
          cancelable: true
        }));

        await new Promise(r => setTimeout(r, 20 + Math.random() * 40));

        // Key up
        target.dispatchEvent(new KeyboardEvent('keyup', {
          key: keyInfo.key,
          code: keyInfo.code,
          keyCode: keyInfo.keyCode,
          which: keyInfo.keyCode,
          bubbles: true,
          cancelable: true
        }));

        if (i < repeat - 1) {
          await new Promise(r => setTimeout(r, delay + Math.random() * 50));
        }
      }

      return { success: true, key: keyInfo.key, repeat };
    })();
  `;
}

/**
 * Calculate typing duration for a given text
 * @param {string} text - Text to type
 * @param {Object} options - Timing options
 * @returns {number} - Estimated duration in milliseconds
 */
function estimateTypingDuration(text, options = {}) {
  const { baseDelay = 80, variation = 40 } = options;
  let duration = 0;

  for (let i = 0; i < text.length; i++) {
    let delay = baseDelay;

    if (i > 0) {
      const pair = (text[i-1] + text[i]).toLowerCase();
      if (TYPING_PATTERNS.fastPairs.includes(pair)) {
        delay *= 0.6;
      }
    }

    if (['.', ',', '!', '?'].includes(text[i])) {
      delay *= 1.5;
    }

    duration += delay;
  }

  // Add some random variation
  return Math.floor(duration * (1 + (Math.random() - 0.5) * 0.2));
}

module.exports = {
  KEY_CODES,
  KEYBOARD_LAYOUTS,
  TYPING_PATTERNS,
  getKeyInfo,
  getKeyTiming,
  getKeyDownScript,
  getKeyUpScript,
  getKeyPressScript,
  getFullKeyPressScript,
  getKeyCombinationScript,
  getTypeTextScript,
  getSpecialKeyScript,
  estimateTypingDuration
};
