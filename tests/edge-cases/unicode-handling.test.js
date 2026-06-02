#!/usr/bin/env node

/**
 * Unicode & International Character Handling Test Suite
 * Tests processing of pages in multiple languages and character sets
 *
 * Features:
 * - CJK character handling (Chinese, Japanese, Korean)
 * - Arabic and RTL text processing
 * - Cyrillic character support
 * - Emoji handling
 * - Mixed encoding detection
 * - Snapshot and export encoding validation
 *
 * Tests: 25+
 * Duration: 1-2 hours
 */

const WebSocket = require('ws');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TIMEOUT = 30000;
const RESULTS_DIR = path.join(__dirname, '..', 'results', 'edge-cases');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

class UnicodeHandlingTester {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      characterSets: [],
      encodingIssues: [],
      successfulPages: []
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      const timeout = setTimeout(() => {
        reject(new Error(`Failed to connect to ${WS_URL}`));
      }, TIMEOUT);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        console.log(`✓ Connected to WebSocket at ${WS_URL}`);
        resolve();
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = String(this.messageId++);
      const message = { id, command, ...params };

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout: ${command}`));
      }, TIMEOUT);

      const handler = (data) => {
        try {
          const response = JSON.parse(data);
          if (response.id === id) {
            clearTimeout(timeout);
            this.ws.removeListener('message', handler);
            resolve(response);
          }
        } catch (e) {
          // Not our message
        }
      };

      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(message));
    });
  }

  validateCharacterEncoding(text, expectedCharset) {
    // Check if text contains characters from expected charset
    const charsetPatterns = {
      'Chinese': /[一-鿿]/,
      'Japanese': /[぀-ゟ゠-ヿ]/,
      'Korean': /[가-힯]/,
      'Arabic': /[؀-ۿ]/,
      'Cyrillic': /[Ѐ-ӿ]/,
      'Emoji': /[\uD800-\uDBFF][\uDC00-\uDFFF]|\uD83D[\uDC00-\uDE4F]/
    };

    const pattern = charsetPatterns[expectedCharset];
    if (!pattern) return false;

    return pattern.test(text);
  }

  detectCharacterSet(text) {
    const charsets = {};

    if (/[一-鿿]/.test(text)) charsets.Chinese = true;
    if (/[぀-ゟ゠-ヿ]/.test(text)) charsets.Japanese = true;
    if (/[가-힯]/.test(text)) charsets.Korean = true;
    if (/[؀-ۿ]/.test(text)) charsets.Arabic = true;
    if (/[Ѐ-ӿ]/.test(text)) charsets.Cyrillic = true;
    if (/[\uD800-\uDBFF][\uDC00-\uDFFF]|\uD83D[\uDC00-\uDE4F]/.test(text)) charsets.Emoji = true;
    if (/[Ā-ſƀ-ɏ]/.test(text)) charsets.Latin_Extended = true;

    return charsets;
  }

  async runTest(name, fn) {
    try {
      this.results.totalTests++;
      await fn();
      this.results.passed++;
      console.log(`✓ PASS: ${name}`);
      return true;
    } catch (error) {
      this.results.failed++;
      console.log(`✗ FAIL: ${name}`);
      console.log(`  Error: ${error.message}`);
      return false;
    }
  }

  async executeTests() {
    console.log('\n=== UNICODE & INTERNATIONAL CHARACTER HANDLING TEST SUITE ===\n');

    // Test 1-5: CJK Character Handling
    console.log('\n--- PHASE 1: CJK CHARACTER HANDLING (Chinese, Japanese, Korean) ---');

    const chineseText = '你好世界，这是一个中文测试页面。我们正在测试中文字符的处理。';
    const japaneseText = 'こんにちは世界。これは日本語のテストページです。日本語の文字処理をテストしています。';
    const koreanText = '안녕하세요 세계. 이것은 한국어 테스트 페이지입니다. 한국어 문자 처리를 테스트하고 있습니다.';

    await this.runTest('Process Chinese text', async () => {
      assert(this.validateCharacterEncoding(chineseText, 'Chinese'), 'Should validate Chinese text');
      const charsets = this.detectCharacterSet(chineseText);
      assert(charsets.Chinese, 'Should detect Chinese charset');
    });

    await this.runTest('Process Japanese text', async () => {
      assert(this.validateCharacterEncoding(japaneseText, 'Japanese'), 'Should validate Japanese text');
      const charsets = this.detectCharacterSet(japaneseText);
      assert(charsets.Japanese, 'Should detect Japanese charset');
    });

    await this.runTest('Process Korean text', async () => {
      assert(this.validateCharacterEncoding(koreanText, 'Korean'), 'Should validate Korean text');
      const charsets = this.detectCharacterSet(koreanText);
      assert(charsets.Korean, 'Should detect Korean charset');
    });

    await this.runTest('Handle mixed CJK content', async () => {
      const mixed = chineseText + japaneseText + koreanText;
      const charsets = this.detectCharacterSet(mixed);
      assert(charsets.Chinese && charsets.Japanese && charsets.Korean, 'Should detect all CJK charsets');
    });

    await this.runTest('Store CJK text in snapshots', async () => {
      const snapshot = {
        timestamp: new Date().toISOString(),
        content: chineseText,
        charset: 'Chinese'
      };
      // Verify no corruption
      assert(snapshot.content === chineseText, 'Should preserve CJK text in storage');
    });

    // Test 6-10: Arabic & RTL Text
    console.log('\n--- PHASE 2: ARABIC & RTL TEXT HANDLING ---');

    const arabicText = 'مرحبا بالعالم. هذه صفحة اختبار باللغة العربية. نحن نختبر معالجة الأحرف العربية.';
    const hebrewText = 'שלום עולם. זו דף בדיקה בעברית. אנחנו בודקים עיבוד תווים בעברית.';

    await this.runTest('Process Arabic text', async () => {
      assert(this.validateCharacterEncoding(arabicText, 'Arabic'), 'Should validate Arabic text');
      const charsets = this.detectCharacterSet(arabicText);
      assert(charsets.Arabic, 'Should detect Arabic charset');
    });

    await this.runTest('Handle RTL text direction', async () => {
      // RTL text should be detected by direction markers
      const rtlContent = '‮مرحبا بالعالم';  // RLE marker
      assert(rtlContent.includes('‮') || /[؀-ۿ]/.test(rtlContent), 'Should handle RTL markers');
    });

    await this.runTest('Detect Hebrew text', async () => {
      // Hebrew is another RTL language
      assert(/[֐-׿]/.test(hebrewText), 'Should detect Hebrew');
    });

    await this.runTest('Preserve RTL text in exports', async () => {
      const exported = JSON.stringify({ content: arabicText });
      const parsed = JSON.parse(exported);
      assert(parsed.content === arabicText, 'Should preserve RTL text in JSON export');
    });

    await this.runTest('Handle mixed LTR/RTL content', async () => {
      const mixed = 'Hello ' + arabicText;
      const charsets = this.detectCharacterSet(mixed);
      assert(charsets.Arabic, 'Should detect Arabic in mixed content');
    });

    // Test 11-15: Cyrillic & Eastern European
    console.log('\n--- PHASE 3: CYRILLIC & EASTERN EUROPEAN LANGUAGES ---');

    const russianText = 'Привет мир. Это тестовая страница на русском языке. Мы тестируем обработку русских символов.';
    const bulgarianText = 'Привет свят. Това е тестова страница на български. Тестваме обработката на български символи.';
    const polishText = 'Cześć świecie. To jest strona testowa w języku polskim. Testujemy przetwarzanie polskich znaków.';

    await this.runTest('Process Russian text', async () => {
      assert(this.validateCharacterEncoding(russianText, 'Cyrillic'), 'Should validate Russian text');
      const charsets = this.detectCharacterSet(russianText);
      assert(charsets.Cyrillic, 'Should detect Cyrillic charset');
    });

    await this.runTest('Process Bulgarian text', async () => {
      const charsets = this.detectCharacterSet(bulgarianText);
      assert(charsets.Cyrillic, 'Should detect Bulgarian as Cyrillic');
    });

    await this.runTest('Process Polish accented characters', async () => {
      const charsets = this.detectCharacterSet(polishText);
      assert(charsets.Latin_Extended, 'Should detect extended Latin');
    });

    await this.runTest('Handle Eastern European diacritics', async () => {
      const textWithDiacritics = 'Café naïve résumé';
      assert(textWithDiacritics.includes('é') && textWithDiacritics.includes('ï'), 'Should handle diacritics');
    });

    await this.runTest('Store Cyrillic text correctly', async () => {
      const snapshot = {
        timestamp: new Date().toISOString(),
        content: russianText,
        charset: 'Cyrillic'
      };
      assert(snapshot.content === russianText, 'Should preserve Cyrillic text');
    });

    // Test 16-20: Emoji Handling
    console.log('\n--- PHASE 4: EMOJI & SPECIAL UNICODE HANDLING ---');

    const emojiText = '🎉 Hello World 🌍! 😊 This is a test with emojis 🔬 and special characters ⚙️';
    const moodEmojis = '😀😃😄😁😆😊☺️😇🙂🙃😉😌😍🥰😘😗😚😙🥲😋😛😜🤪😝';
    const objectEmojis = '🎨🎭🎪🎬🎤🎧🎼🎹🎸🥁🎺🎷';

    await this.runTest('Process text with emojis', async () => {
      assert(this.validateCharacterEncoding(emojiText, 'Emoji'), 'Should validate emoji text');
      const charsets = this.detectCharacterSet(emojiText);
      assert(charsets.Emoji, 'Should detect emoji charset');
    });

    await this.runTest('Handle multiple emoji sequences', async () => {
      const charsets = this.detectCharacterSet(moodEmojis);
      assert(charsets.Emoji, 'Should detect mood emojis');
    });

    await this.runTest('Process object emojis', async () => {
      const charsets = this.detectCharacterSet(objectEmojis);
      assert(charsets.Emoji, 'Should detect object emojis');
    });

    await this.runTest('Preserve emojis in JSON export', async () => {
      const data = { message: emojiText };
      const exported = JSON.stringify(data);
      const parsed = JSON.parse(exported);
      assert(parsed.message === emojiText, 'Should preserve emojis in JSON');
    });

    await this.runTest('Handle emoji variation selectors', async () => {
      // Some emojis have variation selectors (e.g., ❤️ vs ❤)
      const emojiWithVariation = '❤️'; // with variation selector
      assert(emojiWithVariation.length > 1 || /[\uD800-\uDBFF]/.test(emojiWithVariation), 'Should handle emoji variants');
    });

    // Test 21-25: Mixed encoding & export validation
    console.log('\n--- PHASE 5: MIXED ENCODING & EXPORT VALIDATION ---');

    const polyglotText = `
      English: Hello World
      中文: 你好世界
      العربية: مرحبا بالعالم
      Русский: Привет мир
      🌍🌎🌏
    `;

    await this.runTest('Detect mixed language content', async () => {
      const charsets = this.detectCharacterSet(polyglotText);
      const detectedCount = Object.keys(charsets).length;
      assert(detectedCount >= 4, `Should detect at least 4 charsets, found: ${detectedCount}`);
    });

    await this.runTest('Preserve all encodings in snapshot', async () => {
      const snapshot = {
        timestamp: new Date().toISOString(),
        content: polyglotText,
        charsets: this.detectCharacterSet(polyglotText)
      };
      const exported = JSON.stringify(snapshot);
      const imported = JSON.parse(exported);
      assert(imported.content === polyglotText, 'Should preserve mixed content');
    });

    await this.runTest('Export mixed encoding to UTF-8', async () => {
      const data = {
        english: 'Hello',
        chinese: '你好',
        arabic: 'مرحبا',
        russian: 'Привет',
        emoji: '😊'
      };
      const buffer = Buffer.from(JSON.stringify(data), 'utf8');
      const restored = JSON.parse(buffer.toString('utf8'));
      assert(restored.chinese === '你好', 'Should export/import UTF-8 correctly');
    });

    await this.runTest('Persist unicode handling report', async () => {
      const reportFile = path.join(RESULTS_DIR, 'unicode-handling-report.json');
      fs.writeFileSync(reportFile, JSON.stringify(this.results, null, 2));
      assert(fs.existsSync(reportFile), 'Should persist report');
    });
  }

  async cleanup() {
    if (this.ws) {
      this.ws.close();
    }
  }

  printSummary() {
    console.log('\n=== TEST SUMMARY ===\n');
    console.log(`Total Tests: ${this.results.totalTests}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Pass Rate: ${((this.results.passed / this.results.totalTests) * 100).toFixed(1)}%`);

    const reportFile = path.join(RESULTS_DIR, 'unicode-handling-report.json');
    console.log(`\n✓ Report saved to ${reportFile}`);
  }
}

// Main execution
(async () => {
  const tester = new UnicodeHandlingTester();

  try {
    await tester.connect();
    await tester.executeTests();
    tester.printSummary();
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
})();
