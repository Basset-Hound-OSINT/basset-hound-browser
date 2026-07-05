// Basset Hound Browser - Renderer screenshot capture handlers
//
// Cohesive group extracted from renderer.js's setupIPCListeners(): every
// webview.capturePage()-based screenshot command (basic viewport, enhanced viewport,
// full-page, element, area). Because the whole renderer is ONE DOMContentLoaded
// closure, these handlers cannot be pulled out by `require`; instead they receive an
// explicit `ctx` object (the same pattern as renderer/gui-logic.js) carrying the DOM /
// state accessors they need — here just `api` (window.electronAPI) and the live
// `getActiveWebview()`.
//
// Loaded via a <script> tag in index.html BEFORE renderer.js, and registered on
// globalThis.RendererScreenshots; renderer.js's init() builds ctx and calls setup(ctx).

(function () {
  'use strict';

  function setup(ctx) {
    const { api, getActiveWebview } = ctx;
    if (!api) {
      return;
    }

    // Capture screenshot (basic viewport)
    api.onCaptureScreenshot(async () => {
      const webview = getActiveWebview();
      if (!webview) {
        api.sendScreenshotResponse({ success: false, error: 'No active webview' });
        return;
      }
      try {
        // Ensure webview has valid dimensions before capturing
        const bounds = webview.getBoundingClientRect();
        if (bounds.width === 0 || bounds.height === 0) {
          api.sendScreenshotResponse({
            success: false,
            error: 'Webview has zero dimensions - cannot capture screenshot'
          });
          return;
        }

        const image = await webview.capturePage();

        // Check if the captured image is empty (common in headless mode)
        if (image.isEmpty()) {
          // In headless/offscreen mode, webview.capturePage() may return empty image
          // Try to capture page content as a fallback using executeJavaScript
          try {
            const screenshotData = await webview.executeJavaScript(`
              (function() {
                return new Promise((resolve, reject) => {
                  try {
                    // Create a canvas with the page dimensions
                    const scrollWidth = Math.max(
                      document.documentElement.scrollWidth,
                      document.body.scrollWidth
                    );
                    const scrollHeight = Math.max(
                      document.documentElement.scrollHeight,
                      document.body.scrollHeight
                    );
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;

                    // Use html2canvas-like approach or return error for main process fallback
                    resolve({
                      needsMainProcessCapture: true,
                      viewport: { width: viewportWidth, height: viewportHeight },
                      scroll: { width: scrollWidth, height: scrollHeight }
                    });
                  } catch (e) {
                    reject(e);
                  }
                });
              })()
            `);

            // Signal to main process that it should capture via its own webContents
            api.sendScreenshotResponse({
              success: false,
              error: 'Webview capturePage returned empty image in headless mode - use screenshot_viewport command instead',
              needsMainProcessCapture: true,
              dimensions: screenshotData
            });
          } catch (jsError) {
            api.sendScreenshotResponse({
              success: false,
              error: 'Screenshot capture failed in headless mode: webview.capturePage() returned empty image'
            });
          }
          return;
        }

        const dataUrl = image.toDataURL();

        // Verify we got actual image data, not just the header
        // A minimal valid PNG data URL is about 100+ chars, empty would be ~22 chars
        if (dataUrl.length < 100) {
          api.sendScreenshotResponse({
            success: false,
            error: 'Screenshot capture returned minimal data - possible headless rendering issue'
          });
          return;
        }

        api.sendScreenshotResponse({ success: true, data: dataUrl });
      } catch (error) {
        api.sendScreenshotResponse({ success: false, error: error.message });
      }
    });

    // Enhanced screenshot - viewport with options
    api.onScreenshotViewport(async (data) => {
      const { requestId, format = 'png', quality = 1.0 } = data;
      const webview = getActiveWebview();

      if (!webview) {
        api.sendScreenshotViewportResponse({
          requestId,
          success: false,
          error: 'No active webview'
        });
        return;
      }

      try {
        // Ensure webview has valid dimensions
        const bounds = webview.getBoundingClientRect();
        if (bounds.width === 0 || bounds.height === 0) {
          api.sendScreenshotViewportResponse({
            requestId,
            success: false,
            error: 'Webview has zero dimensions - cannot capture screenshot'
          });
          return;
        }

        const image = await webview.capturePage();

        // Check if the captured image is empty (common in headless mode)
        if (image.isEmpty()) {
          api.sendScreenshotViewportResponse({
            requestId,
            success: false,
            error: 'Webview capturePage returned empty image - likely headless mode issue',
            needsMainProcessCapture: true
          });
          return;
        }

        // Get data URL in requested format
        let dataUrl;
        if (format === 'jpeg' || format === 'jpg') {
          dataUrl = image.toDataURL({ scaleFactor: 1.0 });
          // For JPEG we need to re-encode via canvas if quality matters
          // For now, just use PNG
          dataUrl = image.toDataURL();
        } else {
          dataUrl = image.toDataURL();
        }

        // Verify we got actual data
        if (dataUrl.length < 100) {
          api.sendScreenshotViewportResponse({
            requestId,
            success: false,
            error: 'Screenshot capture returned minimal data'
          });
          return;
        }

        api.sendScreenshotViewportResponse({
          requestId,
          success: true,
          data: dataUrl,
          format: 'png',
          width: image.getSize().width,
          height: image.getSize().height
        });
      } catch (error) {
        api.sendScreenshotViewportResponse({
          requestId,
          success: false,
          error: error.message
        });
      }
    });

    // Enhanced screenshot - full page (scroll and stitch)
    api.onScreenshotFullPage(async (data) => {
      const { requestId, format = 'png', quality = 1.0, scrollDelay = 100, maxHeight = 32000 } = data;
      const webview = getActiveWebview();

      if (!webview) {
        api.sendScreenshotFullPageResponse({
          requestId,
          success: false,
          error: 'No active webview'
        });
        return;
      }

      try {
        // Get page dimensions
        const dimensions = await webview.executeJavaScript(`
          ({
            scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
            scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
            currentScrollY: window.scrollY
          })
        `);

        // For now, just capture viewport in headless mode
        // Full page stitching requires more complex implementation
        const image = await webview.capturePage();

        if (image.isEmpty()) {
          api.sendScreenshotFullPageResponse({
            requestId,
            success: false,
            error: 'Screenshot capture returned empty image in headless mode',
            needsMainProcessCapture: true
          });
          return;
        }

        const dataUrl = image.toDataURL();

        api.sendScreenshotFullPageResponse({
          requestId,
          success: true,
          data: dataUrl,
          format: 'png',
          width: image.getSize().width,
          height: image.getSize().height,
          pageHeight: dimensions.scrollHeight,
          pageWidth: dimensions.scrollWidth,
          note: 'Captured viewport only - full page stitching not available in headless mode'
        });
      } catch (error) {
        api.sendScreenshotFullPageResponse({
          requestId,
          success: false,
          error: error.message
        });
      }
    });

    // Enhanced screenshot - element
    api.onScreenshotElement(async (data) => {
      const { requestId, selector, format = 'png', quality = 1.0, padding = 0 } = data;
      const webview = getActiveWebview();

      if (!webview) {
        api.sendScreenshotElementResponse({
          requestId,
          success: false,
          error: 'No active webview'
        });
        return;
      }

      if (!selector) {
        api.sendScreenshotElementResponse({
          requestId,
          success: false,
          error: 'Selector is required'
        });
        return;
      }

      try {
        // Get element bounds
        const safeSelector = JSON.stringify(selector);
        const elementBounds = await webview.executeJavaScript(`
          (function() {
            const element = document.querySelector(${safeSelector});
            if (!element) {
              return null;
            }
            const rect = element.getBoundingClientRect();
            return {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            };
          })()
        `);

        if (!elementBounds) {
          api.sendScreenshotElementResponse({
            requestId,
            success: false,
            error: 'Element not found: ' + selector
          });
          return;
        }

        // Capture the page and crop to element bounds
        const image = await webview.capturePage({
          x: Math.max(0, Math.floor(elementBounds.x - padding)),
          y: Math.max(0, Math.floor(elementBounds.y - padding)),
          width: Math.ceil(elementBounds.width + padding * 2),
          height: Math.ceil(elementBounds.height + padding * 2)
        });

        if (image.isEmpty()) {
          api.sendScreenshotElementResponse({
            requestId,
            success: false,
            error: 'Screenshot capture returned empty image',
            needsMainProcessCapture: true
          });
          return;
        }

        const dataUrl = image.toDataURL();

        api.sendScreenshotElementResponse({
          requestId,
          success: true,
          data: dataUrl,
          format: 'png',
          width: image.getSize().width,
          height: image.getSize().height,
          elementBounds
        });
      } catch (error) {
        api.sendScreenshotElementResponse({
          requestId,
          success: false,
          error: error.message
        });
      }
    });

    // Enhanced screenshot - area (specific coordinates)
    api.onScreenshotArea(async (data) => {
      const { requestId, area, format = 'png', quality = 1.0 } = data;
      const webview = getActiveWebview();

      if (!webview) {
        api.sendScreenshotAreaResponse({
          requestId,
          success: false,
          error: 'No active webview'
        });
        return;
      }

      if (!area || typeof area.x !== 'number' || typeof area.y !== 'number' ||
          typeof area.width !== 'number' || typeof area.height !== 'number') {
        api.sendScreenshotAreaResponse({
          requestId,
          success: false,
          error: 'Invalid area coordinates. Required: x, y, width, height'
        });
        return;
      }

      try {
        const image = await webview.capturePage({
          x: Math.max(0, Math.floor(area.x)),
          y: Math.max(0, Math.floor(area.y)),
          width: Math.ceil(area.width),
          height: Math.ceil(area.height)
        });

        if (image.isEmpty()) {
          api.sendScreenshotAreaResponse({
            requestId,
            success: false,
            error: 'Screenshot capture returned empty image',
            needsMainProcessCapture: true
          });
          return;
        }

        const dataUrl = image.toDataURL();

        api.sendScreenshotAreaResponse({
          requestId,
          success: true,
          data: dataUrl,
          format: 'png',
          width: image.getSize().width,
          height: image.getSize().height
        });
      } catch (error) {
        api.sendScreenshotAreaResponse({
          requestId,
          success: false,
          error: error.message
        });
      }
    });
  }

  const RendererScreenshots = { setup };

  // CommonJS export (parity with renderer/gui-logic.js; harmless in the renderer).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RendererScreenshots;
  }
  // Browser/global registration for the <script>-tag load path.
  if (typeof globalThis !== 'undefined') {
    globalThis.RendererScreenshots = RendererScreenshots;
  }
})();
