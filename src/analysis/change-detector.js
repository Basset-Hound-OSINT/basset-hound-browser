/**
 * Basset Hound Browser - Website Change Detection & Diff Analysis
 * Detect page changes, generate diff reports, track modifications over time
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class ChangeDetector {
  constructor() {
    this.snapshots = new Map();
    this.diffHistory = [];
    this.snapshotDir = path.join(require('os').homedir(), '.basset-hound', 'snapshots');
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.snapshotDir)) {
      fs.mkdirSync(this.snapshotDir, { recursive: true });
    }
  }

  /**
   * Create page snapshot for comparison
   * @param {Object} webContents - Electron webContents
   * @param {string} url - Page URL
   * @returns {Promise} Snapshot data with hash
   */
  async createSnapshot(webContents, url) {
    try {
      const snapshot = {
        url,
        timestamp: Date.now(),
        datetime: new Date().toISOString(),
        content: {},
        hashes: {}
      };

      // Capture HTML
      snapshot.content.html = await this.captureHTML(webContents);
      snapshot.hashes.html = this.hashContent(snapshot.content.html);

      // Capture text content
      snapshot.content.text = await this.captureText(webContents);
      snapshot.hashes.text = this.hashContent(snapshot.content.text);

      // Capture DOM structure
      snapshot.content.dom = await this.captureDOMStructure(webContents);
      snapshot.hashes.dom = this.hashContent(JSON.stringify(snapshot.content.dom));

      // Capture form elements
      snapshot.content.forms = await this.captureFormElements(webContents);
      snapshot.hashes.forms = this.hashContent(JSON.stringify(snapshot.content.forms));

      // Capture links
      snapshot.content.links = await this.captureLinks(webContents);
      snapshot.hashes.links = this.hashContent(JSON.stringify(snapshot.content.links));

      // Overall snapshot hash
      snapshot.hash = this.hashContent(JSON.stringify(snapshot.hashes));

      // Store in memory
      this.snapshots.set(url, snapshot);

      return snapshot;
    } catch (err) {
      throw new Error(`Snapshot creation failed: ${err.message}`);
    }
  }

  /**
   * Capture full HTML content
   */
  async captureHTML(webContents) {
    return new Promise((resolve) => {
      webContents.executeJavaScript(`
        (function() {
          return document.documentElement.outerHTML;
        })()
      `, (result) => {
        resolve(result || '');
      });
    });
  }

  /**
   * Capture plain text content
   */
  async captureText(webContents) {
    return new Promise((resolve) => {
      webContents.executeJavaScript(`
        (function() {
          return document.body.innerText;
        })()
      `, (result) => {
        resolve(result || '');
      });
    });
  }

  /**
   * Capture DOM tree structure
   */
  async captureDOMStructure(webContents) {
    return new Promise((resolve) => {
      webContents.executeJavaScript(`
        (function() {
          const structure = {
            title: document.title,
            headings: [],
            paragraphs: [],
            divs: 0,
            spans: 0,
            links: [],
            images: [],
            forms: [],
            inputs: []
          };

          structure.headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
            .map(h => ({ tag: h.tagName, text: h.innerText.substring(0, 100) }));

          structure.paragraphs = Array.from(document.querySelectorAll('p'))
            .slice(0, 10)
            .map(p => p.innerText.substring(0, 100));

          structure.divs = document.querySelectorAll('div').length;
          structure.spans = document.querySelectorAll('span').length;

          structure.links = Array.from(document.querySelectorAll('a'))
            .map(a => ({ text: a.innerText, href: a.href }));

          structure.images = Array.from(document.querySelectorAll('img'))
            .map(i => ({ alt: i.alt, src: i.src }));

          structure.forms = Array.from(document.querySelectorAll('form'))
            .map(f => ({ id: f.id, action: f.action, method: f.method }));

          structure.inputs = Array.from(document.querySelectorAll('input'))
            .map(i => ({ type: i.type, name: i.name }));

          return structure;
        })()
      `, (result) => {
        resolve(result || {});
      });
    });
  }

  /**
   * Capture form elements and attributes
   */
  async captureFormElements(webContents) {
    return new Promise((resolve) => {
      webContents.executeJavaScript(`
        (function() {
          const forms = [];

          document.querySelectorAll('form').forEach((form, idx) => {
            const formData = {
              index: idx,
              id: form.id,
              name: form.name,
              action: form.action,
              method: form.method,
              fields: [],
              buttons: []
            };

            form.querySelectorAll('input, select, textarea').forEach(field => {
              formData.fields.push({
                name: field.name,
                type: field.type || field.tagName,
                required: field.required,
                placeholder: field.placeholder,
                value: field.value ? field.value.substring(0, 50) : ''
              });
            });

            form.querySelectorAll('button').forEach(btn => {
              formData.buttons.push({
                text: btn.innerText,
                type: btn.type
              });
            });

            forms.push(formData);
          });

          return forms;
        })()
      `, (result) => {
        resolve(result || []);
      });
    });
  }

  /**
   * Capture all links on page
   */
  async captureLinks(webContents) {
    return new Promise((resolve) => {
      webContents.executeJavaScript(`
        (function() {
          return Array.from(document.querySelectorAll('a'))
            .map(a => ({
              href: a.href,
              text: a.innerText.substring(0, 100),
              title: a.title,
              target: a.target
            }));
        })()
      `, (result) => {
        resolve(result || []);
      });
    });
  }

  /**
   * Compare two snapshots and generate diff
   */
  compareSnapshots(urlA, urlB = null) {
    const url = urlB || urlA;
    const previousUrl = urlB ? urlA : url;

    const current = this.snapshots.get(url);
    const previous = this.snapshots.get(previousUrl);

    if (!current) {
      throw new Error(`No snapshot found for ${url}`);
    }

    if (!previous) {
      throw new Error(`No previous snapshot found for ${previousUrl}`);
    }

    const diff = {
      url: url,
      previous_time: previous.datetime,
      current_time: current.datetime,
      time_difference_seconds: (current.timestamp - previous.timestamp) / 1000,
      changes: {}
    };

    // Compare each content type
    diff.changes.html_changed = current.hashes.html !== previous.hashes.html;
    diff.changes.text_changed = current.hashes.text !== previous.hashes.text;
    diff.changes.dom_changed = current.hashes.dom !== previous.hashes.dom;
    diff.changes.forms_changed = current.hashes.forms !== previous.hashes.forms;
    diff.changes.links_changed = current.hashes.links !== previous.hashes.links;

    // Detailed comparisons
    if (diff.changes.text_changed) {
      diff.changes.text_diff = this.getTextDiff(previous.content.text, current.content.text);
    }

    if (diff.changes.forms_changed) {
      diff.changes.forms_diff = this.getFormsDiff(previous.content.forms, current.content.forms);
    }

    if (diff.changes.links_changed) {
      diff.changes.links_diff = this.getLinksDiff(previous.content.links, current.content.links);
    }

    // DOM structure changes
    if (diff.changes.dom_changed) {
      diff.changes.dom_diff = this.getDOMStructureDiff(previous.content.dom, current.content.dom);
    }

    // Overall change detection
    diff.overall_changed = Object.values(diff.changes).some(v => v === true || typeof v === 'object');
    diff.change_percentage = this.calculateChangePercentage(diff);

    // Store diff
    this.diffHistory.push(diff);

    return diff;
  }

  /**
   * Calculate text diff
   */
  getTextDiff(previousText, currentText) {
    const prevLines = previousText.split('\n');
    const currLines = currentText.split('\n');

    const added = currLines.filter(line => !prevLines.includes(line)).slice(0, 10);
    const removed = prevLines.filter(line => !currLines.includes(line)).slice(0, 10);

    return {
      lines_added: added.length,
      lines_removed: removed.length,
      sample_added: added,
      sample_removed: removed
    };
  }

  /**
   * Calculate forms diff
   */
  getFormsDiff(previousForms, currentForms) {
    const diff = {
      forms_added: [],
      forms_removed: [],
      forms_modified: []
    };

    // Check for new forms
    currentForms.forEach(curr => {
      const prev = previousForms.find(p => p.action === curr.action && p.method === curr.method);
      if (!prev) {
        diff.forms_added.push(curr);
      } else if (JSON.stringify(prev) !== JSON.stringify(curr)) {
        diff.forms_modified.push({
          action: curr.action,
          changes: {
            fields_added: curr.fields.length - prev.fields.length,
            buttons_added: curr.buttons.length - prev.buttons.length
          }
        });
      }
    });

    // Check for removed forms
    previousForms.forEach(prev => {
      const curr = currentForms.find(c => c.action === prev.action && c.method === prev.method);
      if (!curr) {
        diff.forms_removed.push(prev);
      }
    });

    return diff;
  }

  /**
   * Calculate links diff
   */
  getLinksDiff(previousLinks, currentLinks) {
    const diff = {
      links_added: [],
      links_removed: [],
      links_changed: 0
    };

    const prevHrefs = previousLinks.map(l => l.href);
    const currHrefs = currentLinks.map(l => l.href);

    diff.links_added = currentLinks.filter(l => !prevHrefs.includes(l.href));
    diff.links_removed = previousLinks.filter(l => !currHrefs.includes(l.href));
    diff.links_changed = diff.links_added.length + diff.links_removed.length;

    return diff;
  }

  /**
   * Calculate DOM structure diff
   */
  getDOMStructureDiff(previousDOM, currentDOM) {
    return {
      title_changed: previousDOM.title !== currentDOM.title,
      headings_count_change: currentDOM.headings.length - previousDOM.headings.length,
      paragraphs_count_change: currentDOM.paragraphs.length - previousDOM.paragraphs.length,
      divs_count_change: currentDOM.divs - previousDOM.divs,
      spans_count_change: currentDOM.spans - previousDOM.spans,
      images_count_change: currentDOM.images.length - previousDOM.images.length,
      links_count_change: currentDOM.links.length - previousDOM.links.length
    };
  }

  /**
   * Calculate change percentage
   */
  calculateChangePercentage(diff) {
    const totalChanges = Object.values(diff.changes).filter(v => v === true || (typeof v === 'object' && Object.values(v).some(val => val > 0))).length;
    return (totalChanges / 5 * 100).toFixed(1);
  }

  /**
   * Hash content for comparison
   */
  hashContent(content) {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
  }

  /**
   * Track changes over time for single URL
   */
  getChangeHistory(url) {
    const history = this.diffHistory.filter(d => d.url === url);

    return {
      url,
      total_snapshots: history.length + 1,
      changes_detected: history.filter(h => h.overall_changed).length,
      change_timeline: history.map(h => ({
        time: h.current_time,
        changed: h.overall_changed,
        change_percentage: h.change_percentage,
        types: Object.entries(h.changes)
          .filter(([_, v]) => v === true || (typeof v === 'object' && Object.values(v).some(val => val > 0)))
          .map(([k]) => k)
      }))
    };
  }

  /**
   * Get all changes across all URLs
   */
  getAllChanges() {
    return {
      total_snapshots: this.snapshots.size,
      total_diffs: this.diffHistory.length,
      urls_monitored: Array.from(this.snapshots.keys()),
      change_summary: this.diffHistory.map(d => ({
        url: d.url,
        time: d.current_time,
        changed: d.overall_changed,
        change_percentage: d.change_percentage
      }))
    };
  }

  /**
   * Generate change report
   */
  generateReport(diff) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Website Change Detection Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1, h2 { color: #333; border-bottom: 2px solid #FF6B6B; padding-bottom: 5px; }
          .timestamp { color: #666; font-size: 14px; }
          .changed { background: #FFE0E0; padding: 10px; border-left: 4px solid #FF6B6B; }
          .unchanged { background: #E0F0FF; padding: 10px; border-left: 4px solid #4CAF50; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #FF6B6B; color: white; }
          .metric { display: inline-block; margin-right: 20px; padding: 10px; background: #f5f5f5; border-radius: 3px; }
          .metric-value { font-size: 24px; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Website Change Detection Report</h1>
        <p class="timestamp">Report Generated: ${new Date().toISOString()}</p>

        <h2>Summary</h2>
        <div class="metric">
          <div class="metric-value">${diff.change_percentage}%</div>
          <div>Change Detected</div>
        </div>
        <div class="metric">
          <div class="metric-value">${diff.time_difference_seconds}s</div>
          <div>Since Last Check</div>
        </div>
        <div class="metric">
          <div class="metric-value">${diff.overall_changed ? 'YES' : 'NO'}</div>
          <div>Overall Change</div>
        </div>

        <div class="${diff.overall_changed ? 'changed' : 'unchanged'}">
          <strong>Status:</strong> ${diff.overall_changed ? 'Changes detected on this page' : 'No changes since last check'}
        </div>

        <h2>Detailed Changes</h2>
        <table>
          <tr><th>Content Type</th><th>Changed</th><th>Details</th></tr>
          ${diff.changes.html_changed ? `<tr><td>HTML</td><td>YES</td><td>Page structure modified</td></tr>` : `<tr><td>HTML</td><td>NO</td><td>No structural changes</td></tr>`}
          ${diff.changes.text_changed ? `<tr><td>Text Content</td><td>YES</td><td>Content updated (${diff.changes.text_diff.lines_added} added, ${diff.changes.text_diff.lines_removed} removed)</td></tr>` : `<tr><td>Text Content</td><td>NO</td><td>No text changes</td></tr>`}
          ${diff.changes.forms_changed ? `<tr><td>Forms</td><td>YES</td><td>Form elements modified</td></tr>` : `<tr><td>Forms</td><td>NO</td><td>No form changes</td></tr>`}
          ${diff.changes.links_changed ? `<tr><td>Links</td><td>YES</td><td>${diff.changes.links_diff.links_added.length} added, ${diff.changes.links_diff.links_removed.length} removed</td></tr>` : `<tr><td>Links</td><td>NO</td><td>No link changes</td></tr>`}
          ${diff.changes.dom_changed ? `<tr><td>DOM Structure</td><td>YES</td><td>Layout or element count changed</td></tr>` : `<tr><td>DOM Structure</td><td>NO</td><td>No DOM changes</td></tr>`}
        </table>

        ${diff.changes.text_changed && diff.changes.text_diff ? `
          <h2>Text Changes</h2>
          ${diff.changes.text_diff.sample_added.length > 0 ? `
            <h3>Added Text (Sample)</h3>
            <ul>
              ${diff.changes.text_diff.sample_added.slice(0, 5).map(t => `<li>${t.substring(0, 80)}</li>`).join('')}
            </ul>
          ` : ''}
          ${diff.changes.text_diff.sample_removed.length > 0 ? `
            <h3>Removed Text (Sample)</h3>
            <ul>
              ${diff.changes.text_diff.sample_removed.slice(0, 5).map(t => `<li>${t.substring(0, 80)}</li>`).join('')}
            </ul>
          ` : ''}
        ` : ''}

        ${diff.changes.forms_changed && diff.changes.forms_diff ? `
          <h2>Form Changes</h2>
          ${diff.changes.forms_diff.forms_added.length > 0 ? `
            <h3>New Forms: ${diff.changes.forms_diff.forms_added.length}</h3>
          ` : ''}
          ${diff.changes.forms_diff.forms_removed.length > 0 ? `
            <h3>Removed Forms: ${diff.changes.forms_diff.forms_removed.length}</h3>
          ` : ''}
          ${diff.changes.forms_diff.forms_modified.length > 0 ? `
            <h3>Modified Forms: ${diff.changes.forms_diff.forms_modified.length}</h3>
          ` : ''}
        ` : ''}

        <h2>Timeline</h2>
        <table>
          <tr><th>Timestamp</th><th>Time</th></tr>
          <tr><td>Previous Check</td><td>${diff.previous_time}</td></tr>
          <tr><td>Current Check</td><td>${diff.current_time}</td></tr>
        </table>
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Save snapshot to file
   */
  saveSnapshot(url, snapshot = null) {
    try {
      const snap = snapshot || this.snapshots.get(url);
      if (!snap) throw new Error(`No snapshot for ${url}`);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `snapshot-${url.replace(/[^\w-]/g, '_')}-${timestamp}.json`;
      const filepath = path.join(this.snapshotDir, filename);

      fs.writeFileSync(filepath, JSON.stringify(snap, null, 2));

      return {
        success: true,
        filename,
        filepath
      };
    } catch (err) {
      throw new Error(`Save snapshot failed: ${err.message}`);
    }
  }
}

module.exports = new ChangeDetector();
