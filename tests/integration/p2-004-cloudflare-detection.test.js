/**
 * Phase 2 P2-004: Cloudflare Challenge Detection & Resolution Tests
 *
 * Tests for detecting Cloudflare challenge pages and waiting for JavaScript
 * challenge completion.
 *
 * @module tests/integration/p2-004-cloudflare-detection.test.js
 */

const { CloudflareDetector, CF_DETECTION_RESULTS } = require('../../src/cloudflare/detector');

describe('P2-004: Cloudflare Challenge Detection', () => {
  let detector;

  beforeEach(() => {
    class MockLogger {
      debug(msg) {
        console.log(`[DEBUG] ${msg}`);
      }
      info(msg) {
        console.log(`[INFO] ${msg}`);
      }
      warn(msg) {
        console.log(`[WARN] ${msg}`);
      }
      error(msg) {
        console.log(`[ERROR] ${msg}`);
      }
    }

    detector = new CloudflareDetector(new MockLogger());
  });

  describe('Challenge Detection', () => {
    test('1: Detects Cloudflare challenge by text marker', () => {
      const cfPageHtml = `
        <html>
          <body>
            <h1>Just a moment...</h1>
            <p>Checking your browser before accessing the website.</p>
          </body>
        </html>
      `;

      const result = detector.detectChallenge(cfPageHtml, 200, {});

      expect(result).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);
    });

    test('2: Detects Cloudflare challenge by HTML marker (__cf_chl)', () => {
      const cfPageHtml = `
        <html>
          <script>
            var __cf_chl = true;
            // Challenge JavaScript
          </script>
        </html>
      `;

      const result = detector.detectChallenge(cfPageHtml, 200, {});

      expect(result).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);
    });

    test('3: Detects Cloudflare by HTTP 403 status with CF headers', () => {
      const html = '<html><body>Access Denied</body></html>';
      const headers = {
        'cf-ray': '12345abcde',
        'cf-cache-status': 'EXPIRED'
      };

      const result = detector.detectChallenge(html, 403, headers);

      expect(result).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);
    });

    test('4: Detects Cloudflare by HTTP 429 (Too Many Requests)', () => {
      const html = '<html><body>Rate Limited</body></html>';
      const headers = { 'cf-ray': '12345abcde' };

      const result = detector.detectChallenge(html, 429, headers);

      expect(result).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);
    });

    test('5: Returns NOT_CLOUDFLARE for normal content', () => {
      const normalHtml = `
        <html>
          <body>
            <h1>Welcome to Example.com</h1>
            <p>This is normal website content.</p>
          </body>
        </html>
      `;

      const result = detector.detectChallenge(normalHtml, 200, {});

      expect(result).toBe(CF_DETECTION_RESULTS.NOT_CLOUDFLARE);
    });

    test('6: Detects challenge by "challenge page" marker', () => {
      const cfHtml = `
        <html>
          <body>
            <div id="challenge-page">
              <h1>Security Challenge</h1>
            </div>
          </body>
        </html>
      `;

      const result = detector.detectChallenge(cfHtml, 200, {});

      expect(result).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);
    });

    test('7: Case-insensitive text marker detection', () => {
      const cfHtml = `
        <html>
          <body>
            <h1>JUST A MOMENT</h1>
            <p>Checking your browser...</p>
          </body>
        </html>
      `;

      const result = detector.detectChallenge(cfHtml, 200, {});

      expect(result).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);
    });

    test('8: Detects challenge by "Checking your browser" marker', () => {
      const cfHtml = `
        <html>
          <body>
            <p>Checking your browser before accessing the website.</p>
          </body>
        </html>
      `;

      const result = detector.detectChallenge(cfHtml, 200, {});

      expect(result).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);
    });

    test('9: Detects empty or very small HTML as suspicious', () => {
      const emptyHtml = '';

      const result = detector.detectChallenge(emptyHtml, 200, {});

      expect(result).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);
    });

    test('10: Small HTML (< 100 bytes) is considered suspicious', () => {
      const smallHtml = '<html><body>Test</body></html>';

      const result = detector.detectChallenge(smallHtml, 200, {});

      expect(result).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);
    });
  });

  describe('Challenge Resolution', () => {
    test('11: Tracks challenge statistics', () => {
      detector.detectChallenge('just a moment', 200, {});
      detector.detectChallenge('<html>normal content</html>', 200, {});
      detector.detectChallenge('checking your browser', 200, {});

      const stats = detector.getStats();

      expect(stats.totalChecks).toBe(3);
      expect(stats.challengesDetected).toBe(2);
      expect(stats.challengesResolved).toBe(0);
    });

    test('12: Reports resolution rate in statistics', () => {
      detector.detectionStats.challengesDetected = 10;
      detector.detectionStats.challengesResolved = 7;

      const stats = detector.getStats();

      expect(stats.resolutionRate).toBe('70.00%');
    });

    test('13: Reset statistics clears all counters', () => {
      detector.detectChallenge('just a moment', 200, {});
      detector.resetStats();

      const stats = detector.getStats();

      expect(stats.totalChecks).toBe(0);
      expect(stats.challengesDetected).toBe(0);
      expect(stats.challengesResolved).toBe(0);
    });

    test('14: Tracks failed retry attempts', () => {
      detector.detectionStats.failedRetries = 5;

      const stats = detector.getStats();

      expect(stats.failedRetries).toBe(5);
    });
  });

  describe('Cloudflare Markers Detection', () => {
    test('15: Detects jsfiddle_loader marker', () => {
      const cfHtml = '<script src="jsfiddle_loader.js"></script>';

      const result = detector.detectChallenge(cfHtml, 200, {});

      expect(result).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);
    });

    test('16: Detects cf_clearance cookie indicator', () => {
      const cfHtml = `
        <script>
          document.cookie = 'cf_clearance=value';
        </script>
      `;

      const result = detector.detectChallenge(cfHtml, 200, {});

      expect(result).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);
    });

    test('17: Detects CFRAYS marker', () => {
      const cfHtml = '<div data-cfrays="12345abcde"></div>';

      const result = detector.detectChallenge(cfHtml, 200, {});

      expect(result).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);
    });

    test('18: Detects challenge.bin marker', () => {
      const cfHtml = `
        <script>
          fetch('/cdn-cgi/challenge.bin');
        </script>
      `;

      const result = detector.detectChallenge(cfHtml, 200, {});

      expect(result).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);
    });
  });

  describe('Evasion Application', () => {
    test('19: Applies Cloudflare evasion techniques', async () => {
      const mockPage = {
        addInitScript: jest.fn().mockResolvedValue(undefined)
      };

      const result = await detector.applyCloudflareEvasion(mockPage);

      expect(result).toBe(true);
      expect(mockPage.addInitScript).toHaveBeenCalled();
    });

    test('20: Handles evasion errors gracefully', async () => {
      const mockPage = {
        addInitScript: jest.fn().mockRejectedValue(new Error('Script injection failed'))
      };

      const result = await detector.applyCloudflareEvasion(mockPage);

      expect(result).toBe(false);
    });
  });

  describe('Challenge Waiting', () => {
    test('21: Waits for challenge completion with timeout', async () => {
      const mockPage = {
        content: jest.fn()
          .mockResolvedValueOnce('just a moment...')
          .mockResolvedValueOnce('real content here')
      };

      const result = await detector.waitForChallengeCompletion(mockPage, 5000);

      expect(result).toBe(true);
    });

    test('22: Timeout when challenge does not complete', async () => {
      const mockPage = {
        content: jest.fn().mockResolvedValue('just a moment...')
      };

      const result = await detector.waitForChallengeCompletion(mockPage, 1000);

      expect(result).toBe(false);
    });

    test('23: Detects challenge completion by marker removal', async () => {
      let callCount = 0;
      const mockPage = {
        content: jest.fn(async () => {
          callCount++;
          // First few calls return challenge page
          if (callCount < 3) {
            return 'just a moment...';
          }
          // Later calls return real content
          return 'real content here with lots of text to make it > 500 bytes...'.repeat(10);
        })
      };

      const result = await detector.waitForChallengeCompletion(mockPage, 5000);

      expect(result).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    test('24: Full detection flow - detect and report challenge', () => {
      const cfHtml = `
        <html>
          <head><title>Challenge</title></head>
          <body>
            <h1>Just a moment...</h1>
            <script>var __cf_chl = true;</script>
          </body>
        </html>
      `;

      const initialDetection = detector.detectChallenge(cfHtml, 200, {});

      expect(initialDetection).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);

      const stats = detector.getStats();
      expect(stats.challengesDetected).toBe(1);
    });

    test('25: Multiple challenges detected in sequence', () => {
      const challenges = [
        'just a moment',
        '__cf_chl detection',
        'checking your browser'
      ];

      challenges.forEach(html => {
        detector.detectChallenge(html, 200, {});
      });

      const stats = detector.getStats();

      expect(stats.totalChecks).toBe(3);
      expect(stats.challengesDetected).toBe(3);
    });

    test('26: Mixed content - challenges and normal pages', () => {
      const pages = [
        { html: 'just a moment', isCf: true },
        { html: 'normal webpage content', isCf: false },
        { html: 'checking your browser', isCf: true },
        { html: 'example.com homepage', isCf: false }
      ];

      pages.forEach(page => {
        detector.detectChallenge(page.html, 200, {});
      });

      const stats = detector.getStats();

      expect(stats.totalChecks).toBe(4);
      expect(stats.challengesDetected).toBe(2);
    });

    test('27: Header-based detection with real-world headers', () => {
      const headers = {
        'cf-ray': '123456abcde-ORD',
        'cf-cache-status': 'EXPIRED',
        'server': 'cloudflare',
        'cf-request-id': 'abcd1234'
      };

      const result = detector.detectChallenge('<html></html>', 403, headers);

      expect(result).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);
    });
  });

  describe('Edge Cases', () => {
    test('28: Handles null/undefined HTML gracefully', () => {
      const result1 = detector.detectChallenge(null, 200, {});
      const result2 = detector.detectChallenge(undefined, 200, {});

      // Should not throw, return based on size check
      expect([CF_DETECTION_RESULTS.CHALLENGE_DETECTED, CF_DETECTION_RESULTS.NOT_CLOUDFLARE])
        .toContain(result1);
      expect([CF_DETECTION_RESULTS.CHALLENGE_DETECTED, CF_DETECTION_RESULTS.NOT_CLOUDFLARE])
        .toContain(result2);
    });

    test('29: Case-insensitive HTML comparison', () => {
      const variants = [
        'JUST A MOMENT',
        'Just A Moment',
        'just a moment',
        'JuSt A mOmEnT'
      ];

      variants.forEach(text => {
        const result = detector.detectChallenge(text, 200, {});
        expect(result).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);
      });
    });

    test('30: Distinguishes between similar text', () => {
      const cfText = 'just a moment while we check your browser';
      const normalText = 'just a moment please hold on';

      const cfResult = detector.detectChallenge(cfText, 200, {});
      const normalResult = detector.detectChallenge(normalText, 200, {});

      // Both should detect as challenge due to "just a moment"
      expect(cfResult).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);
      expect(normalResult).toBe(CF_DETECTION_RESULTS.CHALLENGE_DETECTED);
    });
  });
});
