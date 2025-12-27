/**
 * Element Highlighter for DOM Inspector
 * Provides visual highlighting of DOM elements
 */

class ElementHighlighter {
  constructor() {
    // Default highlight style
    this.defaultStyle = {
      backgroundColor: 'rgba(255, 165, 0, 0.3)',
      border: '2px solid #ff6600',
      outline: 'none',
      transition: 'all 0.2s ease-in-out'
    };

    // Highlight overlay ID prefix
    this.overlayPrefix = '__basset_highlight_';
    this.overlayClass = '__basset_highlight_overlay';
  }

  /**
   * Highlight a single element
   * @param {string} selector - CSS selector for the element
   * @param {string} color - Highlight color (optional)
   * @returns {string} JavaScript to execute in browser
   */
  highlight(selector, color = null) {
    const style = color ? this.getColorStyle(color) : this.defaultStyle;
    const styleString = this.styleToString(style);

    return `
      (function() {
        try {
          // Remove any existing highlights first
          const existingOverlays = document.querySelectorAll('.${this.overlayClass}');
          existingOverlays.forEach(el => el.remove());

          const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!element) {
            return { success: false, error: 'Element not found' };
          }

          const rect = element.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

          // Create highlight overlay
          const overlay = document.createElement('div');
          overlay.id = '${this.overlayPrefix}' + Date.now();
          overlay.className = '${this.overlayClass}';
          overlay.style.cssText = \`
            position: absolute;
            top: \${rect.top + scrollTop}px;
            left: \${rect.left + scrollLeft}px;
            width: \${rect.width}px;
            height: \${rect.height}px;
            ${styleString}
            pointer-events: none;
            z-index: 999999;
            box-sizing: border-box;
          \`;

          // Add element info tooltip
          const tooltip = document.createElement('div');
          tooltip.style.cssText = \`
            position: absolute;
            bottom: 100%;
            left: 0;
            background: #333;
            color: #fff;
            padding: 4px 8px;
            font-size: 12px;
            font-family: monospace;
            white-space: nowrap;
            border-radius: 3px;
            margin-bottom: 4px;
          \`;
          tooltip.textContent = element.tagName.toLowerCase() +
            (element.id ? '#' + element.id : '') +
            (element.className ? '.' + element.className.split(' ')[0] : '');
          overlay.appendChild(tooltip);

          document.body.appendChild(overlay);

          return {
            success: true,
            element: {
              tagName: element.tagName,
              id: element.id,
              className: element.className,
              rect: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
              }
            }
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Highlight multiple elements
   * @param {Array} selectors - Array of CSS selectors
   * @returns {string} JavaScript to execute in browser
   */
  highlightMultiple(selectors) {
    const selectorsJson = JSON.stringify(selectors);
    const styleString = this.styleToString(this.defaultStyle);

    return `
      (function() {
        try {
          // Remove any existing highlights first
          const existingOverlays = document.querySelectorAll('.${this.overlayClass}');
          existingOverlays.forEach(el => el.remove());

          const selectors = ${selectorsJson};
          const results = [];
          const colors = [
            'rgba(255, 165, 0, 0.3)',
            'rgba(0, 165, 255, 0.3)',
            'rgba(165, 255, 0, 0.3)',
            'rgba(255, 0, 165, 0.3)',
            'rgba(0, 255, 165, 0.3)'
          ];
          const borderColors = [
            '#ff6600',
            '#0066ff',
            '#66ff00',
            '#ff0066',
            '#00ff66'
          ];

          selectors.forEach((selector, index) => {
            try {
              const elements = document.querySelectorAll(selector);
              const colorIndex = index % colors.length;

              elements.forEach((element, elIndex) => {
                const rect = element.getBoundingClientRect();
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

                const overlay = document.createElement('div');
                overlay.id = '${this.overlayPrefix}' + Date.now() + '_' + index + '_' + elIndex;
                overlay.className = '${this.overlayClass}';
                overlay.style.cssText = \`
                  position: absolute;
                  top: \${rect.top + scrollTop}px;
                  left: \${rect.left + scrollLeft}px;
                  width: \${rect.width}px;
                  height: \${rect.height}px;
                  background-color: \${colors[colorIndex]};
                  border: 2px solid \${borderColors[colorIndex]};
                  pointer-events: none;
                  z-index: 999999;
                  box-sizing: border-box;
                  transition: all 0.2s ease-in-out;
                \`;

                document.body.appendChild(overlay);
              });

              results.push({
                selector: selector,
                count: elements.length,
                success: true
              });
            } catch (e) {
              results.push({
                selector: selector,
                count: 0,
                success: false,
                error: e.message
              });
            }
          });

          return {
            success: true,
            results: results,
            totalHighlighted: results.reduce((sum, r) => sum + r.count, 0)
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Remove all highlights
   * @returns {string} JavaScript to execute in browser
   */
  clear() {
    return `
      (function() {
        try {
          const overlays = document.querySelectorAll('.${this.overlayClass}');
          const count = overlays.length;
          overlays.forEach(el => el.remove());
          return { success: true, removed: count };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Set highlight style options
   * @param {Object} options - Style options
   * @returns {Object} Updated style configuration
   */
  setStyle(options) {
    if (options.backgroundColor) {
      this.defaultStyle.backgroundColor = options.backgroundColor;
    }
    if (options.border) {
      this.defaultStyle.border = options.border;
    }
    if (options.borderColor) {
      this.defaultStyle.border = `2px solid ${options.borderColor}`;
    }
    if (options.borderWidth) {
      const currentColor = this.defaultStyle.border.match(/solid\s+(.+)$/)?.[1] || '#ff6600';
      this.defaultStyle.border = `${options.borderWidth}px solid ${currentColor}`;
    }
    if (options.opacity !== undefined) {
      // Adjust background color opacity
      const match = this.defaultStyle.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        this.defaultStyle.backgroundColor = `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${options.opacity})`;
      }
    }

    return { success: true, style: this.defaultStyle };
  }

  /**
   * Get color-based style
   * @param {string} color - Color name or hex value
   * @returns {Object} Style object
   */
  getColorStyle(color) {
    const colorMap = {
      red: { bg: 'rgba(255, 0, 0, 0.3)', border: '#ff0000' },
      green: { bg: 'rgba(0, 255, 0, 0.3)', border: '#00ff00' },
      blue: { bg: 'rgba(0, 0, 255, 0.3)', border: '#0000ff' },
      yellow: { bg: 'rgba(255, 255, 0, 0.3)', border: '#ffff00' },
      orange: { bg: 'rgba(255, 165, 0, 0.3)', border: '#ff6600' },
      purple: { bg: 'rgba(128, 0, 128, 0.3)', border: '#800080' },
      cyan: { bg: 'rgba(0, 255, 255, 0.3)', border: '#00ffff' },
      magenta: { bg: 'rgba(255, 0, 255, 0.3)', border: '#ff00ff' }
    };

    if (colorMap[color.toLowerCase()]) {
      const c = colorMap[color.toLowerCase()];
      return {
        backgroundColor: c.bg,
        border: `2px solid ${c.border}`,
        transition: 'all 0.2s ease-in-out'
      };
    }

    // Assume it's a hex color
    const hexToRgba = (hex, alpha) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    if (color.startsWith('#')) {
      return {
        backgroundColor: hexToRgba(color, 0.3),
        border: `2px solid ${color}`,
        transition: 'all 0.2s ease-in-out'
      };
    }

    return this.defaultStyle;
  }

  /**
   * Convert style object to CSS string
   * @param {Object} style - Style object
   * @returns {string} CSS string
   */
  styleToString(style) {
    return Object.entries(style)
      .map(([key, value]) => {
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${cssKey}: ${value};`;
      })
      .join(' ');
  }

  /**
   * Highlight element with pulsing animation
   * @param {string} selector - CSS selector
   * @param {number} duration - Duration in milliseconds
   * @returns {string} JavaScript to execute
   */
  highlightPulse(selector, duration = 2000) {
    return `
      (function() {
        try {
          const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!element) {
            return { success: false, error: 'Element not found' };
          }

          const rect = element.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

          const overlay = document.createElement('div');
          overlay.id = '${this.overlayPrefix}pulse_' + Date.now();
          overlay.className = '${this.overlayClass}';

          // Add keyframe animation
          const styleSheet = document.createElement('style');
          styleSheet.textContent = \`
            @keyframes basset_pulse {
              0%, 100% { opacity: 0.3; transform: scale(1); }
              50% { opacity: 0.6; transform: scale(1.02); }
            }
          \`;
          document.head.appendChild(styleSheet);

          overlay.style.cssText = \`
            position: absolute;
            top: \${rect.top + scrollTop}px;
            left: \${rect.left + scrollLeft}px;
            width: \${rect.width}px;
            height: \${rect.height}px;
            background-color: rgba(255, 165, 0, 0.3);
            border: 2px solid #ff6600;
            pointer-events: none;
            z-index: 999999;
            box-sizing: border-box;
            animation: basset_pulse 0.5s ease-in-out infinite;
          \`;

          document.body.appendChild(overlay);

          // Auto-remove after duration
          setTimeout(() => {
            overlay.remove();
            styleSheet.remove();
          }, ${duration});

          return {
            success: true,
            duration: ${duration},
            element: {
              tagName: element.tagName,
              id: element.id
            }
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Highlight element with info box
   * @param {string} selector - CSS selector
   * @returns {string} JavaScript to execute
   */
  highlightWithInfo(selector) {
    return `
      (function() {
        try {
          // Remove existing highlights
          const existingOverlays = document.querySelectorAll('.${this.overlayClass}');
          existingOverlays.forEach(el => el.remove());

          const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!element) {
            return { success: false, error: 'Element not found' };
          }

          const rect = element.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
          const computedStyle = window.getComputedStyle(element);

          // Create main overlay
          const overlay = document.createElement('div');
          overlay.id = '${this.overlayPrefix}info_' + Date.now();
          overlay.className = '${this.overlayClass}';
          overlay.style.cssText = \`
            position: absolute;
            top: \${rect.top + scrollTop}px;
            left: \${rect.left + scrollLeft}px;
            width: \${rect.width}px;
            height: \${rect.height}px;
            background-color: rgba(255, 165, 0, 0.2);
            border: 2px solid #ff6600;
            pointer-events: none;
            z-index: 999999;
            box-sizing: border-box;
          \`;

          // Create info box
          const infoBox = document.createElement('div');
          infoBox.style.cssText = \`
            position: absolute;
            top: \${rect.bottom + scrollTop + 5}px;
            left: \${rect.left + scrollLeft}px;
            background: #1a1a1a;
            color: #fff;
            padding: 10px;
            font-size: 12px;
            font-family: monospace;
            border-radius: 4px;
            z-index: 1000000;
            max-width: 400px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          \`;

          const tagName = element.tagName.toLowerCase();
          const id = element.id ? '#' + element.id : '';
          const classes = element.className ? '.' + element.className.split(' ').join('.') : '';

          infoBox.innerHTML = \`
            <div style="color: #ff6600; font-weight: bold; margin-bottom: 5px;">
              \${tagName}\${id}\${classes.substring(0, 50)}
            </div>
            <div style="color: #888; font-size: 11px;">
              Size: \${Math.round(rect.width)} x \${Math.round(rect.height)}px<br>
              Position: \${Math.round(rect.left)}, \${Math.round(rect.top)}<br>
              Display: \${computedStyle.display}<br>
              Visibility: \${computedStyle.visibility}
            </div>
          \`;

          overlay.className = '${this.overlayClass}';
          infoBox.className = '${this.overlayClass}';

          document.body.appendChild(overlay);
          document.body.appendChild(infoBox);

          return {
            success: true,
            element: {
              tagName: element.tagName,
              id: element.id,
              className: element.className,
              rect: {
                width: rect.width,
                height: rect.height,
                top: rect.top,
                left: rect.left
              }
            }
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }
}

module.exports = { ElementHighlighter };
