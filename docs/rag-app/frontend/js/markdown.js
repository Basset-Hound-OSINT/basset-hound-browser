/**
 * Lightweight Markdown renderer
 * Supports: headers, bold, italic, code, links, lists, blockquotes, tables
 */
const Markdown = {
  render(text) {
    if (!text) return '';

    let html = this.escapeHtml(text);

    // Code blocks (must be first to protect code content)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang || 'plaintext'}">${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    // Merge consecutive blockquotes
    html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

    // Unordered lists
    html = this.parseLists(html);

    // Tables
    html = this.parseTables(html);

    // Paragraphs (must be last)
    html = this.parseParagraphs(html);

    return html;
  },

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
    };
    return text.replace(/[&<>]/g, char => map[char]);
  },

  parseLists(html) {
    const lines = html.split('\n');
    const result = [];
    let inList = false;
    let listType = null;

    for (const line of lines) {
      const ulMatch = line.match(/^[-*+] (.+)$/);
      const olMatch = line.match(/^\d+\. (.+)$/);

      if (ulMatch) {
        if (!inList || listType !== 'ul') {
          if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>');
          result.push('<ul>');
          inList = true;
          listType = 'ul';
        }
        result.push(`<li>${ulMatch[1]}</li>`);
      } else if (olMatch) {
        if (!inList || listType !== 'ol') {
          if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>');
          result.push('<ol>');
          inList = true;
          listType = 'ol';
        }
        result.push(`<li>${olMatch[1]}</li>`);
      } else {
        if (inList) {
          result.push(listType === 'ul' ? '</ul>' : '</ol>');
          inList = false;
          listType = null;
        }
        result.push(line);
      }
    }

    if (inList) {
      result.push(listType === 'ul' ? '</ul>' : '</ol>');
    }

    return result.join('\n');
  },

  parseTables(html) {
    const tableRegex = /(\|.+\|)\n(\|[-:| ]+\|)\n((?:\|.+\|\n?)+)/g;

    return html.replace(tableRegex, (match, headerRow, separator, bodyRows) => {
      const headers = headerRow.split('|').slice(1, -1).map(h => h.trim());
      const rows = bodyRows.trim().split('\n').map(row =>
        row.split('|').slice(1, -1).map(cell => cell.trim())
      );

      let table = '<table><thead><tr>';
      headers.forEach(h => { table += `<th>${h}</th>`; });
      table += '</tr></thead><tbody>';

      rows.forEach(row => {
        table += '<tr>';
        row.forEach(cell => { table += `<td>${cell}</td>`; });
        table += '</tr>';
      });

      table += '</tbody></table>';
      return table;
    });
  },

  parseParagraphs(html) {
    // Split by double newlines or block elements
    const blocks = html.split(/\n\n+/);
    const blockElements = /^<(h[1-4]|ul|ol|pre|blockquote|table)/;

    return blocks
      .map(block => {
        block = block.trim();
        if (!block) return '';
        if (blockElements.test(block)) return block;
        // Wrap in paragraph if it's plain text
        if (!block.startsWith('<')) {
          return `<p>${block.replace(/\n/g, '<br>')}</p>`;
        }
        return block;
      })
      .filter(Boolean)
      .join('\n');
  }
};

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Markdown;
}
