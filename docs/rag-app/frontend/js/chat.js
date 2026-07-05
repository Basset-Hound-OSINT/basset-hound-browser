/**
 * Chat Manager for RAG Bootstrap
 */
const Chat = {
  messages: [],
  currentMode: 'hybrid',
  isLoading: false,

  /**
   * Initialize the chat interface
   */
  init() {
    this.messagesEl = document.getElementById('messages');
    this.inputEl = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('send-btn');
    this.welcomeEl = document.getElementById('welcome-message');
    this.copyAllBtn = document.getElementById('copy-all-btn');
    this.clearBtn = document.getElementById('clear-chat-btn');

    this.bindEvents();
    this.loadMode();
  },

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Send button
    this.sendBtn.addEventListener('click', () => this.sendMessage());

    // Enter to send (Shift+Enter for newline)
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-expand textarea
    this.inputEl.addEventListener('input', () => {
      this.inputEl.style.height = 'auto';
      this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 120) + 'px';
    });

    // Search mode toggles
    document.querySelectorAll('.toggle-chip[data-feature]').forEach(chip => {
      chip.addEventListener('click', () => {
        const feature = chip.dataset.feature;
        if (['hybrid', 'semantic', 'keyword'].includes(feature)) {
          this.setMode(feature);
        }
      });
    });

    // Quick actions
    document.querySelectorAll('.quick-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const prompt = btn.dataset.prompt;
        this.inputEl.value = prompt;
        this.inputEl.focus();
      });
    });

    // Copy all button
    this.copyAllBtn.addEventListener('click', () => this.copyAllMessages());

    // Clear chat button
    this.clearBtn.addEventListener('click', () => this.clearChat());
  },

  /**
   * Load saved search mode from localStorage
   */
  loadMode() {
    const saved = localStorage.getItem('rag-search-mode');
    if (saved && ['hybrid', 'semantic', 'keyword'].includes(saved)) {
      this.setMode(saved, false);
    }
  },

  /**
   * Set the search mode
   */
  setMode(mode, save = true) {
    this.currentMode = mode;

    // Update UI
    document.querySelectorAll('.toggle-chip[data-feature]').forEach(chip => {
      const feature = chip.dataset.feature;
      if (['hybrid', 'semantic', 'keyword'].includes(feature)) {
        chip.classList.toggle('active', feature === mode);
      }
    });

    // Save preference
    if (save) {
      localStorage.setItem('rag-search-mode', mode);
    }
  },

  /**
   * Send a message with streaming
   */
  async sendMessage() {
    const text = this.inputEl.value.trim();
    if (!text || this.isLoading) return;

    // Hide welcome message
    if (this.welcomeEl) {
      this.welcomeEl.style.display = 'none';
    }

    // Clear input
    this.inputEl.value = '';
    this.inputEl.style.height = 'auto';

    // Add user message
    this.addMessage('user', text);

    // Show loading
    this.setLoading(true);
    const loadingEl = this.addLoadingMessage();
    let assistantMessageEl = null;
    let currentContent = '';
    let sources = [];
    let tokenCount = 0;

    try {
      // Call the streaming RAG API
      await API.askStream(text, {
        mode: this.currentMode,
        limit: 5,
      }, (event) => {
        if (event.type === 'sources') {
          // Save sources from first event
          sources = event.sources || [];
        } else if (event.type === 'token') {
          // Remove loading message on first token
          if (assistantMessageEl === null) {
            loadingEl.remove();
            assistantMessageEl = this.createStreamingMessage();
          }

          // Append token to content
          currentContent += event.token;
          tokenCount = event.token_count || (tokenCount + 1);

          // Update the message display
          const bodyEl = assistantMessageEl.querySelector('.message-body');
          bodyEl.innerHTML = Markdown.render(currentContent);

          // Update token count in UI
          const countEl = assistantMessageEl.querySelector('.token-count');
          if (countEl) {
            countEl.textContent = `${tokenCount} tokens`;
          }

          // Scroll to bottom
          this.scrollToBottom();
        } else if (event.type === 'done') {
          // Mark completion
          if (assistantMessageEl) {
            const countEl = assistantMessageEl.querySelector('.token-count');
            if (countEl) {
              countEl.textContent = `${event.total_tokens} tokens`;
            }
          }
        } else if (event.type === 'error') {
          // Handle error
          this.addErrorMessage(event.message || 'An error occurred');
        }
      });

      // Ensure message is added if not already
      if (assistantMessageEl === null) {
        this.addMessage('assistant', currentContent, sources);
      } else if (sources.length > 0) {
        // Add sources if we have them
        const sourcesHtml = this.renderSources(sources);
        if (sourcesHtml) {
          const container = assistantMessageEl.querySelector('.message-content');
          container.innerHTML += sourcesHtml;
        }
      }

      // Update messages array with final content
      if (currentContent) {
        this.messages[this.messages.length - 1] = {
          role: 'assistant',
          content: currentContent,
          sources: sources,
          timestamp: Date.now(),
        };
      }

    } catch (error) {
      console.error('Chat error:', error);
      if (assistantMessageEl) {
        loadingEl.remove();
      } else {
        loadingEl.remove();
      }
      this.addErrorMessage(error.message || 'Failed to get response. Please try again.');
    } finally {
      this.setLoading(false);
    }
  },

  /**
   * Create a streaming message element (without sources initially)
   */
  createStreamingMessage() {
    const el = document.createElement('div');
    el.className = 'message assistant streaming';

    const avatar = '&#129302;';
    const label = 'ASSISTANT';

    el.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-label">${label}</span>
          <span class="token-count" style="font-size: 0.85em; color: #888;">0 tokens</span>
          <button class="copy-msg-btn" title="Copy message">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
          </button>
        </div>
        <div class="message-body"></div>
      </div>
    `;

    // Bind copy button
    const copyBtn = el.querySelector('.copy-msg-btn');
    copyBtn.addEventListener('click', () => {
      const content = el.querySelector('.message-body').textContent;
      this.copyMessage(copyBtn, content);
    });

    this.messagesEl.appendChild(el);
    this.scrollToBottom();

    return el;
  },

  /**
   * Add a message to the chat
   */
  addMessage(role, content, sources = []) {
    const message = { role, content, sources, timestamp: Date.now() };
    this.messages.push(message);

    const el = this.renderMessage(message);
    this.messagesEl.appendChild(el);
    this.scrollToBottom();

    return el;
  },

  /**
   * Render a message element
   */
  renderMessage(message) {
    const { role, content, sources } = message;

    const el = document.createElement('div');
    el.className = `message ${role}`;

    const avatar = role === 'user' ? '&#128100;' : '&#129302;';
    const label = role === 'user' ? 'YOU' : 'ASSISTANT';

    el.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-label">${label}</span>
          <button class="copy-msg-btn" title="Copy message">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
          </button>
        </div>
        <div class="message-body">${Markdown.render(content)}</div>
        ${sources && sources.length > 0 ? this.renderSources(sources) : ''}
      </div>
    `;

    // Bind copy button
    const copyBtn = el.querySelector('.copy-msg-btn');
    copyBtn.addEventListener('click', () => this.copyMessage(copyBtn, content));

    return el;
  },

  /**
   * Render sources section
   */
  renderSources(sources) {
    if (!sources || sources.length === 0) return '';

    const items = sources.map(s => `
      <div class="source-item">
        <span class="source-file">${this.escapeHtml(s.document_filename)}</span>
        <span class="source-score">${(s.score * 100).toFixed(0)}% match</span>
      </div>
    `).join('');

    return `
      <div class="message-sources">
        <div class="sources-header">SOURCES</div>
        ${items}
      </div>
    `;
  },

  /**
   * Add a loading message
   */
  addLoadingMessage() {
    const el = document.createElement('div');
    el.className = 'message assistant loading';
    el.innerHTML = `
      <div class="message-avatar">&#129302;</div>
      <div class="message-content">
        <div class="message-body">
          <div class="loading-dots"><span></span><span></span><span></span></div>
        </div>
      </div>
    `;
    this.messagesEl.appendChild(el);
    this.scrollToBottom();
    return el;
  },

  /**
   * Add an error message
   */
  addErrorMessage(text) {
    const el = document.createElement('div');
    el.className = 'error-message';
    el.textContent = text;
    this.messagesEl.appendChild(el);
    this.scrollToBottom();
  },

  /**
   * Copy a single message
   */
  async copyMessage(btn, content) {
    try {
      await navigator.clipboard.writeText(content);
      btn.classList.add('copied');
      btn.innerHTML = 'Copied!';

      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
        `;
      }, 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  },

  /**
   * Copy all messages
   */
  async copyAllMessages() {
    if (this.messages.length === 0) return;

    const text = this.messages.map(m => {
      const role = m.role === 'user' ? 'User' : 'Assistant';
      let content = `${role}: ${m.content}`;

      if (m.sources && m.sources.length > 0) {
        const sourceList = m.sources.map(s => `  - ${s.document_filename}`).join('\n');
        content += `\n\nSources:\n${sourceList}`;
      }

      return content;
    }).join('\n\n---\n\n');

    try {
      await navigator.clipboard.writeText(text);
      this.copyAllBtn.classList.add('copied');
      this.copyAllBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        Copied!
      `;

      setTimeout(() => {
        this.copyAllBtn.classList.remove('copied');
        this.copyAllBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          Copy All
        `;
      }, 2000);
    } catch (err) {
      console.error('Copy all failed:', err);
    }
  },

  /**
   * Clear the chat
   */
  clearChat() {
    this.messages = [];
    this.messagesEl.innerHTML = '';

    // Show welcome message again
    if (this.welcomeEl) {
      this.welcomeEl.style.display = '';
      this.messagesEl.appendChild(this.welcomeEl);
    }
  },

  /**
   * Set loading state
   */
  setLoading(loading) {
    this.isLoading = loading;
    this.sendBtn.disabled = loading;
    this.inputEl.disabled = loading;
  },

  /**
   * Scroll to the bottom of the chat
   */
  scrollToBottom() {
    const chatArea = document.getElementById('chat-area');
    chatArea.scrollTop = chatArea.scrollHeight;
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

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Chat;
}
