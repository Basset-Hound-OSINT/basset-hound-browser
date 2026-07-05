/**
 * Basset Hound Browser - Page Monitoring Change Detectors
 *
 * Snapshot comparison and change-detection logic for the PageMonitor class.
 *
 * These functions are mixed into `PageMonitor.prototype` (via Object.assign)
 * and are therefore invoked with `this` bound to the PageMonitor instance.
 * Their bodies are unchanged from the original monolithic implementation.
 */

const { DETECTION_METHODS, CHANGE_TYPES } = require('./constants');

/**
 * Compare two snapshots
 * @param {Object} snapshot1 - First snapshot
 * @param {Object} snapshot2 - Second snapshot
 * @param {Object} options - Comparison options
 * @returns {Promise<Object>} Comparison result
 */
async function compareSnapshots(snapshot1, snapshot2, options = {}) {
  const {
    methods = [DETECTION_METHODS.HYBRID],
    threshold = 0.1,
    zones = []
  } = options;

  const changes = [];
  let hasChanges = false;

  // Apply each detection method
  for (const method of methods) {
    let methodChanges = [];

    switch (method) {
    case DETECTION_METHODS.CONTENT_HASH:
      methodChanges = this.detectHashChanges(snapshot1, snapshot2, zones);
      break;

    case DETECTION_METHODS.DOM_DIFF:
      methodChanges = this.detectDOMChanges(snapshot1, snapshot2, zones);
      break;

    case DETECTION_METHODS.TEXT_DIFF:
      methodChanges = this.detectTextChanges(snapshot1, snapshot2, zones);
      break;

    case DETECTION_METHODS.ATTRIBUTE_DIFF:
      methodChanges = this.detectAttributeChanges(snapshot1, snapshot2, zones);
      break;

    case DETECTION_METHODS.STRUCTURE_DIFF:
      methodChanges = this.detectStructureChanges(snapshot1, snapshot2, zones);
      break;

    case DETECTION_METHODS.SCREENSHOT_DIFF:
      methodChanges = await this.detectVisualChanges(snapshot1, snapshot2, threshold);
      break;

    case DETECTION_METHODS.HYBRID:
      // Combine multiple methods
      const hashChanges = this.detectHashChanges(snapshot1, snapshot2, zones);
      const domChanges = this.detectDOMChanges(snapshot1, snapshot2, zones);
      const textChanges = this.detectTextChanges(snapshot1, snapshot2, zones);
      methodChanges = [...hashChanges, ...domChanges, ...textChanges];
      break;
    }

    if (methodChanges.length > 0) {
      hasChanges = true;
      changes.push(...methodChanges);
    }
  }

  // Deduplicate and categorize changes
  const uniqueChanges = this.deduplicateChanges(changes);
  const categorizedChanges = this.categorizeChanges(uniqueChanges);
  const summary = this.generateChangeSummary(categorizedChanges);
  const significance = this.calculateSignificance(categorizedChanges);

  return {
    hasChanges,
    changes: categorizedChanges,
    summary,
    significance,
    timestamp: new Date().toISOString()
  };
}

/**
 * Detect hash-based changes
 */
function detectHashChanges(snapshot1, snapshot2, zones = []) {
  const changes = [];

  // Compare full page hash
  if (snapshot1.contentHash !== snapshot2.contentHash) {
    changes.push({
      type: CHANGE_TYPES.CONTENT,
      method: DETECTION_METHODS.CONTENT_HASH,
      scope: 'page',
      description: 'Page content hash changed',
      oldValue: snapshot1.contentHash,
      newValue: snapshot2.contentHash
    });
  }

  // Compare zone hashes
  if (zones.length > 0 && snapshot1.zones && snapshot2.zones) {
    zones.forEach(zone => {
      const zone1 = snapshot1.zones.find(z => z.selector === zone.selector);
      const zone2 = snapshot2.zones.find(z => z.selector === zone.selector);

      if (zone1 && zone2 && zone1.hash !== zone2.hash) {
        changes.push({
          type: CHANGE_TYPES.CONTENT,
          method: DETECTION_METHODS.CONTENT_HASH,
          scope: 'zone',
          selector: zone.selector,
          description: `Zone content changed: ${zone.selector}`,
          oldValue: zone1.hash,
          newValue: zone2.hash
        });
      }
    });
  }

  return changes;
}

/**
 * Detect DOM changes
 */
function detectDOMChanges(snapshot1, snapshot2, zones = []) {
  const changes = [];

  // Compare DOM structure
  if (snapshot1.dom && snapshot2.dom) {
    const dom1 = snapshot1.dom;
    const dom2 = snapshot2.dom;

    // Check element count changes
    if (dom1.elementCount !== dom2.elementCount) {
      changes.push({
        type: CHANGE_TYPES.STRUCTURE,
        method: DETECTION_METHODS.DOM_DIFF,
        scope: 'page',
        description: 'Element count changed',
        oldValue: dom1.elementCount,
        newValue: dom2.elementCount,
        delta: dom2.elementCount - dom1.elementCount
      });
    }

    // Check for added/removed elements
    if (dom1.elements && dom2.elements) {
      const tags1 = new Set(dom1.elements.map(e => e.tagName));
      const tags2 = new Set(dom2.elements.map(e => e.tagName));

      tags2.forEach(tag => {
        if (!tags1.has(tag)) {
          changes.push({
            type: CHANGE_TYPES.ADDED,
            method: DETECTION_METHODS.DOM_DIFF,
            scope: 'element',
            description: `New element type added: ${tag}`,
            newValue: tag
          });
        }
      });

      tags1.forEach(tag => {
        if (!tags2.has(tag)) {
          changes.push({
            type: CHANGE_TYPES.REMOVED,
            method: DETECTION_METHODS.DOM_DIFF,
            scope: 'element',
            description: `Element type removed: ${tag}`,
            oldValue: tag
          });
        }
      });
    }
  }

  return changes;
}

/**
 * Detect text content changes
 */
function detectTextChanges(snapshot1, snapshot2, zones = []) {
  const changes = [];

  // Compare text content
  if (snapshot1.textContent !== snapshot2.textContent) {
    const oldLength = snapshot1.textContent?.length || 0;
    const newLength = snapshot2.textContent?.length || 0;

    changes.push({
      type: CHANGE_TYPES.CONTENT,
      method: DETECTION_METHODS.TEXT_DIFF,
      scope: 'page',
      description: 'Text content changed',
      oldValue: oldLength,
      newValue: newLength,
      delta: newLength - oldLength
    });
  }

  return changes;
}

/**
 * Detect attribute changes
 */
function detectAttributeChanges(snapshot1, snapshot2, zones = []) {
  const changes = [];

  if (snapshot1.dom?.elements && snapshot2.dom?.elements) {
    const elements1 = snapshot1.dom.elements;
    const elements2 = snapshot2.dom.elements;

    // Compare common elements
    for (let i = 0; i < Math.min(elements1.length, elements2.length); i++) {
      const el1 = elements1[i];
      const el2 = elements2[i];

      if (el1.id === el2.id || el1.selector === el2.selector) {
        // Check attribute differences
        if (JSON.stringify(el1.attributes) !== JSON.stringify(el2.attributes)) {
          changes.push({
            type: CHANGE_TYPES.ATTRIBUTE,
            method: DETECTION_METHODS.ATTRIBUTE_DIFF,
            scope: 'element',
            selector: el1.selector || el1.id,
            description: `Attributes changed on element`,
            oldValue: el1.attributes,
            newValue: el2.attributes
          });
        }
      }
    }
  }

  return changes;
}

/**
 * Detect structure changes
 */
function detectStructureChanges(snapshot1, snapshot2, zones = []) {
  const changes = [];

  if (snapshot1.dom && snapshot2.dom) {
    const structure1 = JSON.stringify(snapshot1.dom.structure || {});
    const structure2 = JSON.stringify(snapshot2.dom.structure || {});

    if (structure1 !== structure2) {
      changes.push({
        type: CHANGE_TYPES.STRUCTURE,
        method: DETECTION_METHODS.STRUCTURE_DIFF,
        scope: 'page',
        description: 'DOM structure changed'
      });
    }
  }

  return changes;
}

/**
 * Detect visual changes (screenshot comparison)
 */
async function detectVisualChanges(snapshot1, snapshot2, threshold) {
  const changes = [];

  if (snapshot1.screenshot && snapshot2.screenshot) {
    const requestId = this.generateRequestId();

    const result = await new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);

      this.mainWindow.webContents.send('compare-page-screenshots', {
        requestId,
        imageData1: snapshot1.screenshot,
        imageData2: snapshot2.screenshot,
        threshold
      });

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ success: false, error: 'Screenshot comparison timeout' });
        }
      }, 60000);
    });

    if (result.success && result.different) {
      changes.push({
        type: CHANGE_TYPES.VISUAL,
        method: DETECTION_METHODS.SCREENSHOT_DIFF,
        scope: 'page',
        description: 'Visual appearance changed',
        similarity: result.similarity,
        differencePercentage: result.differencePercentage,
        diffImage: result.diffImage
      });
    }
  }

  return changes;
}

/**
 * Deduplicate changes
 */
function deduplicateChanges(changes) {
  const seen = new Set();
  return changes.filter(change => {
    const key = `${change.type}-${change.scope}-${change.selector || 'page'}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Categorize changes by type
 */
function categorizeChanges(changes) {
  const categorized = {
    content: [],
    structure: [],
    style: [],
    attribute: [],
    added: [],
    removed: [],
    modified: [],
    visual: []
  };

  changes.forEach(change => {
    const category = change.type.toLowerCase();
    if (categorized[category]) {
      categorized[category].push(change);
    }
  });

  return categorized;
}

/**
 * Generate change summary
 */
function generateChangeSummary(categorizedChanges) {
  const summary = {
    total: 0,
    byType: {},
    description: []
  };

  Object.entries(categorizedChanges).forEach(([type, changes]) => {
    const count = changes.length;
    if (count > 0) {
      summary.total += count;
      summary.byType[type] = count;
      summary.description.push(`${count} ${type} change${count > 1 ? 's' : ''}`);
    }
  });

  return summary;
}

/**
 * Calculate change significance (0-1)
 */
function calculateSignificance(categorizedChanges) {
  let significance = 0;
  const weights = {
    structure: 0.8,
    content: 0.6,
    visual: 0.5,
    attribute: 0.3,
    style: 0.2,
    added: 0.7,
    removed: 0.7,
    modified: 0.5
  };

  Object.entries(categorizedChanges).forEach(([type, changes]) => {
    const weight = weights[type] || 0.1;
    significance += changes.length * weight;
  });

  return Math.min(significance / 10, 1); // Normalize to 0-1
}

module.exports = {
  compareSnapshots,
  detectHashChanges,
  detectDOMChanges,
  detectTextChanges,
  detectAttributeChanges,
  detectStructureChanges,
  detectVisualChanges,
  deduplicateChanges,
  categorizeChanges,
  generateChangeSummary,
  calculateSignificance
};
