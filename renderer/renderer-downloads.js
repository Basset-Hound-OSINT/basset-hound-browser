// Basset Hound Browser - Renderer download management
//
// Cohesive group extracted from renderer.js: the download event wiring plus the
// status-bar indicator and toast notification for downloads. Self-contained apart from
// the shared `escapeHtml` helper (which touches the DOM and so cannot live in the
// DOM-free renderer/gui-logic.js) and `api` (window.electronAPI), both passed via ctx.
// The active-downloads map is module-private.
//
// Loaded via a <script> tag in index.html BEFORE renderer.js and registered on
// globalThis.RendererDownloads; renderer.js's init() builds ctx and calls setup(ctx).

(function () {
  'use strict';

  function setup(ctx) {
    const { api, escapeHtml } = ctx;
    if (!api) {
      return;
    }

    // Download state tracking
    const activeDownloads = new Map();

    function updateDownloadIndicator() {
      const indicator = document.getElementById('download-indicator');
      const statusText = document.getElementById('download-status-text');
      const progressFill = document.getElementById('download-progress-fill');

      if (!indicator || !statusText || !progressFill) {
        return;
      }

      const count = activeDownloads.size;

      if (count === 0) {
        indicator.style.display = 'none';
        return;
      }

      indicator.style.display = 'flex';

      // Calculate total progress
      let totalProgress = 0;
      let activeCount = 0;

      activeDownloads.forEach((download) => {
        if (download.progress !== undefined) {
          totalProgress += download.progress;
          activeCount++;
        }
      });

      const avgProgress = activeCount > 0 ? Math.round(totalProgress / activeCount) : 0;

      statusText.textContent = count === 1
        ? `Downloading: ${avgProgress}%`
        : `${count} downloads: ${avgProgress}%`;

      progressFill.style.width = avgProgress + '%';
    }

    function showDownloadNotification(title, message, type = 'info') {
      // Remove existing notification if any
      const existingNotification = document.querySelector('.download-notification');
      if (existingNotification) {
        existingNotification.remove();
      }

      // Create notification element
      const notification = document.createElement('div');
      notification.className = `download-notification ${type}`;
      notification.innerHTML = `
        <div class="download-notification-title">${escapeHtml(title)}</div>
        <div class="download-notification-filename">${escapeHtml(message)}</div>
      `;

      document.body.appendChild(notification);

      // Auto-remove after 4 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'slideIn 0.3s ease reverse';
          setTimeout(() => {
            if (notification.parentNode) {
              notification.remove();
            }
          }, 300);
        }
      }, 4000);
    }

    // Download event listeners
    api.onDownloadStarted((download) => {
      activeDownloads.set(download.id, download);
      updateDownloadIndicator();
      showDownloadNotification('Download Started', download.filename, 'info');
    });

    api.onDownloadProgress((download) => {
      activeDownloads.set(download.id, download);
      updateDownloadIndicator();
    });

    api.onDownloadCompleted((download) => {
      activeDownloads.delete(download.id);
      updateDownloadIndicator();
      showDownloadNotification('Download Completed', download.filename, 'success');
    });

    api.onDownloadFailed((download) => {
      activeDownloads.delete(download.id);
      updateDownloadIndicator();
      showDownloadNotification('Download Failed', download.filename + ': ' + (download.error || 'Unknown error'), 'error');
    });

    api.onDownloadCancelled((download) => {
      activeDownloads.delete(download.id);
      updateDownloadIndicator();
      showDownloadNotification('Download Cancelled', download.filename, 'info');
    });
  }

  const RendererDownloads = { setup };

  // CommonJS export (parity with renderer/gui-logic.js; harmless in the renderer).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RendererDownloads;
  }
  // Browser/global registration for the <script>-tag load path.
  if (typeof globalThis !== 'undefined') {
    globalThis.RendererDownloads = RendererDownloads;
  }
})();
