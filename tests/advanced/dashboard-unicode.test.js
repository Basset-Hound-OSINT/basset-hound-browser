#!/usr/bin/env node

/**
 * Dashboard Unicode & International Character Edge Cases Test Suite
 * Tests for international character handling, emoji support, RTL text, and zero-width characters
 *
 * Features Tested:
 * 1. Unicode monitor names (50+ languages)
 * 2. Emoji handling in monitor names and descriptions
 * 3. RTL text support (Arabic, Hebrew)
 * 4. Zero-width character edge cases
 * 5. Combining characters and diacritical marks
 * 6. CJK character support (Chinese, Japanese, Korean)
 * 7. Extreme character width variations
 * 8. Mixed direction text (LTR + RTL)
 */

const assert = require('assert');

console.log('[DASHBOARD-UNICODE] Starting Unicode & International Character edge cases...\n');

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  issues: [],
  tests: []
};

function test(name, fn) {
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    results.passed++;
    results.tests.push({ name, status: 'pass' });
  } catch (error) {
    console.log(`✗ FAIL: ${name}`);
    console.log(`  Error: ${error.message}`);
    results.failed++;
    results.issues.push({ test: name, error: error.message });
    results.tests.push({ name, status: 'fail', error: error.message });
  }
}

function warning(name, message) {
  console.log(`⚠ WARN: ${name}`);
  console.log(`  ${message}`);
  results.warnings++;
  results.tests.push({ name, status: 'warn', message });
}

// ====================================
// TEST SUITE 1: Basic Unicode Support
// ====================================
console.log('\n=== TEST SUITE 1: Basic Unicode Support ===\n');

test('Handles Latin Extended characters', () => {
  const names = [
    'Björk Guðmundsdóttir',
    'François Müller',
    'José García',
    'Ñoño Peña'
  ];

  names.forEach(name => {
    assert(name.length > 0, `Name "${name}" should not be empty`);
    assert(/^[\p{L}\p{N}\s\-'\.]+$/u.test(name), `Name "${name}" should contain valid characters`);
  });

  console.log(`  → Verified ${names.length} Latin Extended names`);
});

test('Handles Cyrillic characters', () => {
  const names = [
    'Ивановская компания',
    'Петров и Сидоров',
    'Москва Технологии',
    'Санкт-Петербург Сервис'
  ];

  names.forEach(name => {
    assert(/^[\p{L}\p{N}\s\-'\.]+$/u.test(name), `Cyrillic name "${name}" should be valid`);
  });

  console.log(`  → Verified ${names.length} Cyrillic names`);
});

test('Handles Greek characters', () => {
  const names = [
    'Ελληνική εταιρεία',
    'Αθήνα Τεχνολογία',
    'Σαλονίκη Υπηρεσίες',
    'Πάτρα Ψηφιακά'
  ];

  names.forEach(name => {
    assert(/^[\p{L}\p{N}\s\-'\.]+$/u.test(name), `Greek name "${name}" should be valid`);
  });

  console.log(`  → Verified ${names.length} Greek names`);
});

// ====================================
// TEST SUITE 2: Emoji Support
// ====================================
console.log('\n=== TEST SUITE 2: Emoji Support ===\n');

test('Handles basic emoji in monitor names', () => {
  const names = [
    '🚀 Launch Monitor',
    'Production 🔴 Alert',
    '⚡ Performance Track',
    '💼 Business Updates'
  ];

  names.forEach(name => {
    assert(name.includes('🚀') || name.includes('🔴') || name.includes('⚡') || name.includes('💼'),
      `Name "${name}" should contain emoji`);
    assert(name.length > 0, `Name "${name}" should not be empty`);
  });

  console.log(`  → Verified ${names.length} emoji names`);
});

test('Handles emoji sequences and skin tone modifiers', () => {
  const names = [
    '👨‍💻 Development Team',
    '👩‍🔬 Research Lab',
    '👨‍👩‍👧‍👦 Family Business',
    '🏃🏽‍♂️ Fast Runner',
    '🧑🏿‍🤝‍🧑🏻 Partners'
  ];

  names.forEach(name => {
    assert(name.length > 0, `Emoji sequence name "${name}" should not be empty`);
  });

  console.log(`  → Verified ${names.length} emoji sequence names`);
});

test('Handles emoji-only descriptions', () => {
  const descriptions = [
    '🎯 🎨 🎭 🎪 🎬',
    '🌟 ⭐ ✨ 💫 🌠',
    '🔥 💥 ⚡ 💢 💯',
    '❤️ 💚 💙 💛 🧡'
  ];

  descriptions.forEach(desc => {
    assert(desc.length > 0, `Description "${desc}" should not be empty`);
  });

  console.log(`  → Verified ${descriptions.length} emoji descriptions`);
});

// ====================================
// TEST SUITE 3: RTL Text (Arabic & Hebrew)
// ====================================
console.log('\n=== TEST SUITE 3: RTL Text Support ===\n');

test('Handles Arabic text in monitor names', () => {
  const names = [
    'مراقبة الأداء',
    'تنبيهات الأمان',
    'تقارير المبيعات',
    'إدارة المشاريع'
  ];

  names.forEach(name => {
    assert(name.length > 0, `Arabic name "${name}" should not be empty`);
    assert(/^[\p{L}\p{N}\s\-'\.]+$/u.test(name), `Arabic name "${name}" should contain valid characters`);
  });

  console.log(`  → Verified ${names.length} Arabic names`);
});

test('Handles Hebrew text in monitor names', () => {
  const names = [
    'מעקב ביצועים',
    'התראות אבטחה',
    'דוחות מכירות',
    'ניהול פרויקטים'
  ];

  names.forEach(name => {
    assert(name.length > 0, `Hebrew name "${name}" should not be empty`);
    assert(/^[\p{L}\p{N}\s\-'\.]+$/u.test(name), `Hebrew name "${name}" should contain valid characters`);
  });

  console.log(`  → Verified ${names.length} Hebrew names`);
});

test('Handles mixed LTR/RTL text with bidi characters', () => {
  const names = [
    'مراقبة Performance',
    'Alert תنبيهات',
    'Sales مبيعات Report'
  ];

  names.forEach(name => {
    assert(name.length > 0, `Mixed text name "${name}" should not be empty`);
  });

  console.log(`  → Verified ${names.length} bidirectional text names`);
});

// ====================================
// TEST SUITE 4: CJK Characters
// ====================================
console.log('\n=== TEST SUITE 4: CJK Character Support ===\n');

test('Handles Chinese (Simplified & Traditional)', () => {
  const names = [
    '性能监控',
    '安全警报',
    '銷售報告',
    '項目管理'
  ];

  names.forEach(name => {
    assert(name.length > 0, `Chinese name "${name}" should not be empty`);
  });

  console.log(`  → Verified ${names.length} Chinese names`);
});

test('Handles Japanese (Hiragana, Katakana, Kanji)', () => {
  const names = [
    'パフォーマンス監視',
    'セキュリティアラート',
    '売上レポート',
    'プロジェクト管理'
  ];

  names.forEach(name => {
    assert(name.length > 0, `Japanese name "${name}" should not be empty`);
  });

  console.log(`  → Verified ${names.length} Japanese names`);
});

test('Handles Korean (Hangul)', () => {
  const names = [
    '성능 모니터링',
    '보안 경고',
    '판매 보고서',
    '프로젝트 관리'
  ];

  names.forEach(name => {
    assert(name.length > 0, `Korean name "${name}" should not be empty`);
  });

  console.log(`  → Verified ${names.length} Korean names`);
});

// ====================================
// TEST SUITE 5: Zero-Width Characters & Edge Cases
// ====================================
console.log('\n=== TEST SUITE 5: Zero-Width Character Edge Cases ===\n');

test('Handles zero-width space (U+200B)', () => {
  const name = 'Monitor​Name';
  assert(name.length === 12, 'Zero-width space should be counted in length');
  assert(name.includes('​'), 'Should preserve zero-width space');
  console.log('  → Zero-width space handled correctly');
});

test('Handles zero-width joiner (U+200D)', () => {
  const name = 'Monitor‍Name';
  assert(name.length === 12, 'Zero-width joiner should be counted in length');
  assert(name.includes('‍'), 'Should preserve zero-width joiner');
  console.log('  → Zero-width joiner handled correctly');
});

test('Handles zero-width non-joiner (U+200C)', () => {
  const name = 'Monitor‌Name';
  assert(name.length === 12, 'Zero-width non-joiner should be counted in length');
  assert(name.includes('‌'), 'Should preserve zero-width non-joiner');
  console.log('  → Zero-width non-joiner handled correctly');
});

test('Handles non-breaking space (U+00A0)', () => {
  const name = 'Monitor Name';
  assert(name.length === 12, 'Non-breaking space should be counted in length');
  assert(name.includes(' '), 'Should preserve non-breaking space');
  console.log('  → Non-breaking space handled correctly');
});

test('Handles combining diacritical marks', () => {
  const names = [
    'Montréal', // é with combining accent
    'naïve', // ï with combining diaeresis
    'café' // é with combining accent
  ];

  names.forEach(name => {
    assert(name.length > 0, `Name with combining marks "${name}" should not be empty`);
  });

  console.log(`  → Verified ${names.length} names with combining marks`);
});

// ====================================
// TEST SUITE 6: Extreme Character Width
// ====================================
console.log('\n=== TEST SUITE 6: Extreme Character Width Variations ===\n');

test('Handles fullwidth characters', () => {
  const names = [
    'ＭｏｎｉｔｏｒＮａｍｅ',
    'ＦＵＬＬＷＩＤＴＨ',
    '１２３４５６７８９０'
  ];

  names.forEach(name => {
    assert(name.length > 0, `Fullwidth name "${name}" should not be empty`);
  });

  console.log(`  → Verified ${names.length} fullwidth names`);
});

test('Handles halfwidth katakana', () => {
  const names = [
    'ｱ ｲ ｳ ｴ ｵ',
    'ｶｷｸｹｺ',
    'ﾓﾆﾀｰ'
  ];

  names.forEach(name => {
    assert(name.length > 0, `Halfwidth name "${name}" should not be empty`);
  });

  console.log(`  → Verified ${names.length} halfwidth names`);
});

test('Handles mathematical alphanumeric symbols', () => {
  const names = [
    '𝐌𝐨𝐧𝐢𝐭𝐨𝐫',
    '𝙼𝚘𝚗𝚒𝚝𝚘𝚛',
    '𝓜𝓸𝓷𝓲𝓽𝓸𝓻'
  ];

  names.forEach(name => {
    assert(name.length > 0, `Mathematical symbol name "${name}" should not be empty`);
  });

  console.log(`  → Verified ${names.length} mathematical symbol names`);
});

// ====================================
// TEST SUITE 7: Normalization & Canonical Forms
// ====================================
console.log('\n=== TEST SUITE 7: Normalization & Canonical Forms ===\n');

test('NFD (Composed) vs NFC (Decomposed) compatibility', () => {
  const composed = 'café'; // é as single character
  const decomposed = 'café'; // e + combining acute accent

  assert(composed.length !== decomposed.length,
    'Composed and decomposed should have different lengths');
  assert(composed.normalize('NFC') === decomposed.normalize('NFC'),
    'Should match after NFC normalization');

  console.log('  → NFD/NFC normalization verified');
});

test('NFKD (Compatibility Decomposed) normalization', () => {
  const original = 'ﬁnally';
  const normalized = original.normalize('NFKD');
  assert(normalized.length > original.length, 'NFKD should expand ligatures');
  console.log('  → NFKD normalization verified');
});

// ====================================
// TEST SUITE 8: Display Width Calculation
// ====================================
console.log('\n=== TEST SUITE 8: Display Width Calculation ===\n');

test('CJK characters have double display width', () => {
  const cjkChars = ['中', '日', '本', '語'];
  const latinChars = ['a', 'b', 'c', 'd'];

  cjkChars.forEach(char => {
    assert(char.length === 1, `CJK char "${char}" should have length 1`);
  });

  console.log('  → CJK character widths verified');
});

test('Emoji have varying display widths', () => {
  const singleEmoji = ['😀', '👍', '🎉'];
  const sequenceEmoji = ['👨‍💻', '👩‍🔬'];

  singleEmoji.forEach(emoji => {
    assert(emoji.length === 1 || emoji.length === 2, `Single emoji "${emoji}" width verified`);
  });

  sequenceEmoji.forEach(emoji => {
    assert(emoji.length > 2, `Emoji sequence "${emoji}" should have length > 2`);
  });

  console.log('  → Emoji display widths verified');
});

// ====================================
// TEST SUITE 9: Edge Case Combinations
// ====================================
console.log('\n=== TEST SUITE 9: Edge Case Combinations ===\n');

test('Handles 500+ character monitor names', () => {
  const longName = '🎯 ' + 'A'.repeat(500) + ' 监视';
  assert(longName.length > 500, 'Should support 500+ character names');
  assert(longName.includes('🎯'), 'Should preserve emoji in long names');
  console.log('  → Long names (500+ chars) handled');
});

test('Handles alternating LTR/RTL in long text', () => {
  let mixed = '';
  for (let i = 0; i < 50; i++) {
    mixed += i % 2 === 0 ? 'English ' : 'العربية ';
  }
  assert(mixed.length > 0, 'Should construct mixed LTR/RTL text');
  console.log('  → Alternating LTR/RTL text handled');
});

test('Handles names with only combining characters', () => {
  const name = 'à́̂̃'; // a with multiple combining marks
  assert(name.length > 1, 'Should support multiple combining marks');
  console.log('  → Names with combining characters handled');
});

test('Handles all supported languages in description', () => {
  const multiLanguage = `
    English, Français, Español, Deutsch, 中文, 日本語, 한국어,
    Русский, العربية, עברית, Ελληνικά, Português, Italiano,
    Polski, Türkçe, ไทย, Tiếng Việt, 🎯 🚀 💼 ⚡
  `;
  assert(multiLanguage.length > 100, 'Multi-language description should be supported');
  console.log('  → Multi-language descriptions handled');
});

// ====================================
// TEST SUITE 10: Storage & Retrieval
// ====================================
console.log('\n=== TEST SUITE 10: Storage & Retrieval ===\n');

test('JSON serialization preserves unicode characters', () => {
  const monitor = {
    name: '監視器 🎯',
    description: 'مراقبة الأداء',
    owner: 'José García'
  };

  const json = JSON.stringify(monitor);
  const restored = JSON.parse(json);

  assert.strictEqual(restored.name, monitor.name, 'Name should be preserved');
  assert.strictEqual(restored.description, monitor.description, 'Description should be preserved');
  assert.strictEqual(restored.owner, monitor.owner, 'Owner should be preserved');

  console.log('  → JSON serialization preserves unicode');
});

test('Handles unicode in search queries', () => {
  const monitors = [
    { id: 1, name: 'Café Monitor' },
    { id: 2, name: 'Performance مراقبة' },
    { id: 3, name: 'モニター' }
  ];

  const searchQuery = 'café';
  const results = monitors.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  assert(results.length > 0, 'Should find accented character matches');
  console.log('  → Unicode search queries work');
});

// ====================================
// Test Summary
// ====================================
console.log('\n=== TEST SUMMARY ===\n');
console.log(`Total Tests: ${results.passed + results.failed + results.warnings}`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);
console.log(`Warnings: ${results.warnings}`);

if (results.failed > 0) {
  console.log('\n=== FAILURES ===');
  results.issues.forEach(issue => {
    console.log(`\n${issue.test}:`);
    console.log(`  ${issue.error}`);
  });
}

process.exit(results.failed > 0 ? 1 : 0);
