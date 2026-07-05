/**
 * Main Application - RAG Bootstrap Frontend
 */
const App = {
  documents: [],

  /**
   * Initialize the application
   */
  async init() {
    // Initialize chat
    Chat.init();

    // Bind sidebar events
    this.bindSidebarEvents();

    // Bind health overlay events
    this.bindHealthOverlay();

    // Load documents
    await this.loadDocuments();
  },

  /**
   * Bind sidebar events
   */
  bindSidebarEvents() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const openBtn = document.getElementById('sidebar-open-btn');
    const refreshBtn = document.getElementById('refresh-docs-btn');

    // Collapse sidebar
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.add('collapsed');
      openBtn.classList.remove('hidden');
    });

    // Open sidebar
    openBtn.addEventListener('click', () => {
      sidebar.classList.remove('collapsed');
      openBtn.classList.add('hidden');
    });

    // Refresh documents
    refreshBtn.addEventListener('click', () => this.loadDocuments());
  },

  /**
   * Bind health overlay events
   */
  bindHealthOverlay() {
    const overlay = document.getElementById('health-overlay');
    const healthBtn = document.getElementById('health-btn');
    const closeBtn = overlay.querySelector('.overlay-close');

    // Open overlay
    healthBtn.addEventListener('click', () => {
      overlay.classList.remove('hidden');
      this.loadHealth();
    });

    // Close overlay
    closeBtn.addEventListener('click', () => {
      overlay.classList.add('hidden');
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
        overlay.classList.add('hidden');
      }
    });
  },

  /**
   * Load and display documents
   */
  async loadDocuments() {
    const treeEl = document.getElementById('document-tree');
    const statsEl = document.getElementById('document-stats');

    treeEl.innerHTML = '<div class="loading-placeholder">Loading documents...</div>';

    try {
      this.documents = await API.listDocuments();

      if (this.documents.length === 0) {
        treeEl.innerHTML = '<div class="empty-placeholder">No documents ingested yet.<br>Use the deploy script to ingest documents.</div>';
        statsEl.innerHTML = '';
        return;
      }

      // Group by file type
      const byType = this.groupByType(this.documents);

      // Render tree
      treeEl.innerHTML = '';
      for (const [type, docs] of Object.entries(byType)) {
        const group = this.renderTypeGroup(type, docs);
        treeEl.appendChild(group);
      }

      // Render stats
      const totalChunks = this.documents.reduce((sum, d) => sum + d.chunk_count, 0);
      const totalSize = this.documents.reduce((sum, d) => sum + d.file_size, 0);

      statsEl.innerHTML = `
        <div class="stat">
          <span>Documents</span>
          <span class="stat-value">${this.documents.length}</span>
        </div>
        <div class="stat">
          <span>Chunks</span>
          <span class="stat-value">${totalChunks.toLocaleString()}</span>
        </div>
        <div class="stat">
          <span>Total Size</span>
          <span class="stat-value">${this.formatSize(totalSize)}</span>
        </div>
      `;

    } catch (error) {
      console.error('Failed to load documents:', error);
      treeEl.innerHTML = `<div class="empty-placeholder">Failed to load documents.<br>${error.message}</div>`;
    }
  },

  /**
   * Group documents by file type
   */
  groupByType(documents) {
    const groups = {};

    for (const doc of documents) {
      const type = doc.file_type || 'other';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(doc);
    }

    // Sort each group by filename
    for (const type of Object.keys(groups)) {
      groups[type].sort((a, b) => a.filename.localeCompare(b.filename));
    }

    return groups;
  },

  /**
   * Render a type group
   */
  renderTypeGroup(type, docs) {
    const group = document.createElement('div');
    group.className = 'folder-group';

    const icons = {
      pdf: '&#128196;',
      md: '&#128221;',
      txt: '&#128196;',
      json: '&#128203;',
      yaml: '&#128203;',
      log: '&#128203;',
    };

    const icon = icons[type] || '&#128196;';
    const label = type.toUpperCase();

    group.innerHTML = `
      <div class="folder-header">
        <span class="folder-icon">&#9660;</span>
        <span>${icon}</span>
        <span>${label}</span>
        <span style="margin-left: auto; color: var(--text-muted); font-size: 11px;">${docs.length}</span>
      </div>
      <div class="folder-contents"></div>
    `;

    const contents = group.querySelector('.folder-contents');
    for (const doc of docs) {
      const item = this.renderFileItem(doc);
      contents.appendChild(item);
    }

    // Toggle collapse
    const header = group.querySelector('.folder-header');
    header.addEventListener('click', () => {
      group.classList.toggle('collapsed');
    });

    return group;
  },

  /**
   * Render a file item
   */
  renderFileItem(doc) {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.dataset.id = doc.id;

    const icons = {
      pdf: '&#128196;',
      md: '&#128221;',
      txt: '&#128196;',
      json: '&#128203;',
      yaml: '&#128203;',
      log: '&#128203;',
    };

    const icon = icons[doc.file_type] || '&#128196;';

    item.innerHTML = `
      <span class="file-icon ${doc.file_type}">${icon}</span>
      <span class="file-name" title="${this.escapeHtml(doc.filepath)}">${this.escapeHtml(doc.filename)}</span>
      <span class="file-chunks" title="${doc.chunk_count} chunks">${doc.chunk_count}</span>
    `;

    // Click to select
    item.addEventListener('click', () => {
      document.querySelectorAll('.file-item.selected').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
    });

    return item;
  },

  /**
   * Load and display health status
   */
  async loadHealth() {
    const body = document.getElementById('health-body');
    body.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

    try {
      const health = await API.health();

      body.innerHTML = `
        <div class="health-item">
          <span class="health-label">Overall Status</span>
          <span class="health-status ${health.status === 'healthy' ? 'healthy' : 'unhealthy'}">
            <span class="health-dot"></span>
            ${health.status.toUpperCase()}
          </span>
        </div>
        <div class="health-item">
          <span class="health-label">Database (PostgreSQL)</span>
          <span class="health-status ${health.database ? 'healthy' : 'unhealthy'}">
            <span class="health-dot"></span>
            ${health.database ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div class="health-item">
          <span class="health-label">Cache (Redis)</span>
          <span class="health-status ${health.redis ? 'healthy' : 'unhealthy'}">
            <span class="health-dot"></span>
            ${health.redis ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div class="health-item">
          <span class="health-label">Embedding Service</span>
          <span class="health-status ${health.embedding_service ? 'healthy' : 'unhealthy'}">
            <span class="health-dot"></span>
            ${health.embedding_service ? 'Ready' : 'Unavailable'}
          </span>
        </div>
        <div class="health-item">
          <span class="health-label">LLM (Ollama)</span>
          <span class="health-status ${health.llm ? 'healthy' : 'unhealthy'}">
            <span class="health-dot"></span>
            ${health.llm ? 'Connected' : 'Unavailable'}
          </span>
        </div>
      `;

    } catch (error) {
      console.error('Health check failed:', error);
      body.innerHTML = `<div class="error-message">Failed to check health: ${error.message}</div>`;
    }
  },

  /**
   * Format file size
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  /**
   * Escape HTML entities
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
