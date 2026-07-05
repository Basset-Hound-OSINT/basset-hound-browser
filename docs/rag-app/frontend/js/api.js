/**
 * API Client for RAG Bootstrap backend
 */
const API = {
  base: window.location.origin,

  /**
   * Make an API request
   */
  async request(path, options = {}) {
    const url = `${this.base}${path}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Handle body serialization
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `Request failed: ${response.status}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }

    return response.json();
  },

  /**
   * Health check
   */
  async health() {
    return this.request('/api/health');
  },

  /**
   * List all ingested documents
   */
  async listDocuments() {
    return this.request('/api/documents');
  },

  /**
   * Get a single document by ID
   */
  async getDocument(id) {
    return this.request(`/api/documents/${id}`);
  },

  /**
   * Delete a document by ID
   */
  async deleteDocument(id) {
    return this.request(`/api/documents/${id}`, { method: 'DELETE' });
  },

  /**
   * Search documents
   */
  async search(query, mode = 'hybrid', limit = 10) {
    return this.request('/api/search', {
      method: 'POST',
      body: { query, mode, limit },
    });
  },

  /**
   * Ask a question (RAG query)
   */
  async ask(question, options = {}) {
    const body = {
      question,
      mode: options.mode || 'hybrid',
      limit: options.limit || 5,
    };

    if (options.system_prompt) {
      body.system_prompt = options.system_prompt;
    }

    return this.request('/api/ask', {
      method: 'POST',
      body,
    });
  },

  /**
   * Stream a question response (SSE)
   * Calls the callback for each event received
   */
  async askStream(question, options = {}, onEvent = null) {
    const body = {
      question,
      mode: options.mode || 'hybrid',
      limit: options.limit || 5,
    };

    if (options.system_prompt) {
      body.system_prompt = options.system_prompt;
    }

    const url = `${this.base}/api/ask/stream`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `Request failed: ${response.status}`);
    }

    // Parse SSE events
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove 'data: ' prefix
            try {
              const event = JSON.parse(data);
              if (onEvent) {
                onEvent(event);
              }
            } catch (e) {
              console.error('Failed to parse event:', data, e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  /**
   * Ingest a directory (async job)
   * POST /api/ingest/directory returns 202 with a job_id immediately;
   * polls GET /api/ingest/status/{job_id} until the job reaches a
   * terminal state (completed | failed). Resolves with the terminal job
   * (job_id, status, documents_ingested, documents, ...); rejects if the
   * job failed. Optional onProgress callback receives each polled job.
   */
  async ingestDirectory(path, onProgress = null, pollIntervalMs = 2000) {
    let job = await this.request('/api/ingest/directory', {
      method: 'POST',
      body: { path },
    });

    if (onProgress) {
      onProgress(job);
    }

    while (job.status === 'queued' || job.status === 'running') {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      job = await this.request(job.status_url || `/api/ingest/status/${job.job_id}`);
      if (onProgress) {
        onProgress(job);
      }
    }

    if (job.status === 'failed') {
      throw new Error(job.error || `Ingest job ${job.job_id} failed`);
    }

    return job;
  },

  /**
   * Ingest multiple directories
   */
  async ingestDirectories(paths) {
    return this.request('/api/ingest/directories', {
      method: 'POST',
      body: { paths },
    });
  },

  /**
   * List available LLM models
   */
  async listModels() {
    return this.request('/api/models');
  },
};

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}
