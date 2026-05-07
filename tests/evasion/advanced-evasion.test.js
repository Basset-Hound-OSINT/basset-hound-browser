/**
 * Unit tests for Advanced Evasion Techniques
 * Tests AudioContext, Font Enumeration, and WebRTC IP leak prevention
 */

const AudioContextEvasion = require('../../src/evasion/audio-context-evasion');
const FontEnumerationEvasion = require('../../src/evasion/font-enumeration-evasion');
const WebRTCEvasion = require('../../src/evasion/webrtc-evasion');

describe('Advanced Evasion Techniques', () => {
  describe('AudioContext Evasion', () => {
    let audioEvasion;

    beforeEach(() => {
      audioEvasion = new AudioContextEvasion();
    });

    test('should initialize with default settings', () => {
      expect(audioEvasion.enabled).toBe(true);
      expect(audioEvasion.technique).toBe('frequency-randomization');
      expect(audioEvasion.baseFrequency).toBe(440);
    });

    test('should perform frequency randomization', () => {
      const result = audioEvasion.frequencyRandomization({});

      expect(result.technique).toBe('frequency-randomization');
      expect(result.baseFrequency).toBeDefined();
      expect(result.variation).toBeDefined();
      expect(result.effectiveness).toContain('%');
    });

    test('should maintain frequency consistency across calls', () => {
      audioEvasion.frequencyRandomization({});
      const result1 = audioEvasion.frequencyRandomization({});
      const result2 = audioEvasion.frequencyRandomization({});

      expect(result1.baseFrequency).toBe(result2.baseFrequency);
    });

    test('should perform sample rate variation', () => {
      const result = audioEvasion.sampleRateVariation({ sampleRate: 48000 });

      expect(result.technique).toBe('sample-rate-variation');
      expect([44100, 48000, 96000]).toContain(result.reportedSampleRate);
    });

    test('should perform analyzer data manipulation', () => {
      const result = audioEvasion.analyzerDataManipulation({});

      expect(result.technique).toBe('analyzer-data-manipulation');
      expect(result.frequencyBinCount).toBeGreaterThan(0);
      expect(result.timeDomainDataLength).toBeGreaterThan(0);
    });

    test('should perform oscillator output variation', () => {
      const result = audioEvasion.oscillatorOutputVariation({});

      expect(result.technique).toBe('oscillator-output-variation');
      expect(['sine', 'square', 'sawtooth', 'triangle']).toContain(result.waveformType);
    });

    test('should perform compressor variation', () => {
      const result = audioEvasion.compressorVariation({});

      expect(result.technique).toBe('compressor-variation');
      expect(result.threshold).toBeDefined();
      expect(result.knee).toBeDefined();
      expect(result.ratio).toBeGreaterThan(1);
    });

    test('should apply selected technique', () => {
      audioEvasion.setTechnique('sample-rate-variation');
      const result = audioEvasion.apply({ sampleRate: 44100 });

      expect(result.technique).toBe('sample-rate-variation');
    });

    test('should apply combined techniques', () => {
      audioEvasion.setTechnique('combined');
      const result = audioEvasion.apply({});

      expect(result.technique).toBe('combined');
      expect(Array.isArray(result.techniques)).toBe(true);
      expect(result.techniques.length).toBeGreaterThan(0);
    });

    test('should list available techniques', () => {
      const techniques = audioEvasion.getAvailableTechniques();

      expect(Array.isArray(techniques)).toBe(true);
      expect(techniques.length).toBeGreaterThan(0);
      expect(techniques).toContain('frequency-randomization');
      expect(techniques).toContain('combined');
    });

    test('should report status', () => {
      const status = audioEvasion.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.technique).toBeDefined();
      expect(status.estimatedEffectiveness).toBeDefined();
      expect(status.baseFrequency).toBe(440);
    });

    test('should reset consistency', () => {
      const result1 = audioEvasion.frequencyRandomization({});
      expect(result1.baseFrequency).toBeDefined();

      audioEvasion.resetConsistency();
      expect(audioEvasion.consistency.size).toBe(0);

      // After reset, should generate new value
      const result2 = audioEvasion.frequencyRandomization({});
      expect(result2.baseFrequency).toBeDefined();
    });
  });

  describe('Font Enumeration Evasion', () => {
    let fontEvasion;

    beforeEach(() => {
      fontEvasion = new FontEnumerationEvasion();
    });

    test('should initialize with default settings', () => {
      expect(fontEvasion.enabled).toBe(true);
      expect(fontEvasion.technique).toBe('realistic-subset');
    });

    test('should detect platform correctly', () => {
      const evasion = new FontEnumerationEvasion({ platformProfile: 'windows' });
      expect(evasion.platformProfile).toBe('windows');
    });

    test('should get system fonts for platform', () => {
      const fonts = fontEvasion.getSystemFonts();

      expect(Array.isArray(fonts)).toBe(true);
      expect(fonts.length).toBeGreaterThan(0);
    });

    test('should get web-safe fonts', () => {
      const fonts = fontEvasion.getWebSafeFonts();

      expect(Array.isArray(fonts)).toBe(true);
      expect(fonts).toContain('Arial');
      expect(fonts).toContain('Verdana');
    });

    test('should generate realistic subset', () => {
      const subset = fontEvasion.realisticSubset();

      expect(Array.isArray(subset)).toBe(true);
      expect(subset.length).toBeGreaterThan(0);
    });

    test('should maintain subset consistency', () => {
      const subset1 = fontEvasion.realisticSubset();
      const subset2 = fontEvasion.realisticSubset();

      expect(subset1).toEqual(subset2);
    });

    test('should align with browser defaults', () => {
      const defaults = fontEvasion.browserDefaultAlignment();

      expect(Array.isArray(defaults)).toBe(true);
      expect(defaults.length).toBeGreaterThan(0);
    });

    test('should provide monospace font variation', () => {
      const monospace = fontEvasion.monospaceVariation();

      expect(typeof monospace).toBe('string');
      expect(monospace.length).toBeGreaterThan(0);
    });

    test('should provide font feature variation', () => {
      const features = fontEvasion.fontFeatureVariation();

      expect(features).toBeDefined();
      expect(typeof features.supportsOpenType).toBe('boolean');
      expect(typeof features.supportsWOFF).toBe('boolean');
    });

    test('should provide generic family fallback', () => {
      const fallback = fontEvasion.genericFamilyFallback();

      expect(fallback).toBeDefined();
      expect(fallback.serif).toBeDefined();
      expect(fallback.sansSerif).toBeDefined();
      expect(fallback.monospace).toBeDefined();
    });

    test('should apply selected technique', () => {
      fontEvasion.setTechnique('browser-defaults');
      const result = fontEvasion.apply();

      expect(result.technique).toBe('browser-defaults');
      expect(result.defaultFonts).toBeDefined();
    });

    test('should apply combined techniques', () => {
      fontEvasion.setTechnique('combined');
      const result = fontEvasion.apply();

      expect(result.technique).toBe('combined');
      expect(result.fonts).toBeDefined();
      expect(result.defaultFonts).toBeDefined();
      expect(result.effectiveness).toContain('%');
    });

    test('should list available techniques', () => {
      const techniques = fontEvasion.getAvailableTechniques();

      expect(Array.isArray(techniques)).toBe(true);
      expect(techniques).toContain('realistic-subset');
      expect(techniques).toContain('combined');
    });

    test('should report status', () => {
      const status = fontEvasion.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.technique).toBeDefined();
      expect(status.platformProfile).toBeDefined();
      expect(status.estimatedEffectiveness).toBeDefined();
    });
  });

  describe('WebRTC Evasion', () => {
    let webrtcEvasion;

    beforeEach(() => {
      webrtcEvasion = new WebRTCEvasion();
    });

    test('should initialize with default settings', () => {
      expect(webrtcEvasion.enabled).toBe(true);
      expect(webrtcEvasion.technique).toBe('candidate-filtering');
      expect(webrtcEvasion.leakSeverity).toBe('prevent-all');
    });

    test('should perform mDNS obfuscation', () => {
      const candidates = ['candidate-1 1 udp 1 192.168.1.100 51234', 'candidate-2 1 udp 2 abcd.local 51234'];
      const result = webrtcEvasion.mdnsObfuscation(candidates);

      expect(result.success).toBe(true);
      expect(result.filtered.length).toBeLessThan(candidates.length);
    });

    test('should filter local IP addresses', () => {
      const candidates = ['10.0.0.1', '192.168.1.1', '8.8.8.8', '1.1.1.1'];
      const result = webrtcEvasion.localIPFiltering(candidates);

      expect(result.success).toBe(true);
      expect(result.filtered.length).toBeGreaterThan(0);
      expect(result.filtered).toContain('8.8.8.8');
      expect(result.filtered).toContain('1.1.1.1');
      expect(result.removed.length).toBeGreaterThan(0);
    });

    test('should filter by candidate type', () => {
      const candidates = [
        'candidate-1 1 udp 1 192.168.1.100 51234 typ host',
        'candidate-2 1 udp 2 1.2.3.4 51234 typ srflx',
        'candidate-3 1 udp 3 5.6.7.8 51234 typ relay'
      ];
      const result = webrtcEvasion.candidateTypeFiltering(candidates);

      expect(result.success).toBe(true);
      expect(result.filtered.length).toBeGreaterThan(0);
      expect(result.statistics.hostCandidates).toBe(1);
    });

    test('should manage connection state', () => {
      const peerConnection = {};
      const result = webrtcEvasion.connectionStateManagement(peerConnection);

      expect(result.success).toBe(true);
      expect(result.reportedState).toBeDefined();
      expect(result.reportedState.iceConnectionState).toBe('connected');
    });

    test('should prefer relay candidates', () => {
      const candidates = [
        'candidate-1 1 udp 1 1.2.3.4 51234 typ srflx',
        'candidate-2 1 udp 2 5.6.7.8 51234 typ relay',
        'candidate-3 1 udp 3 192.168.1.100 51234 typ host'
      ];
      const result = webrtcEvasion.relayCandidatePreference(candidates);

      expect(result.success).toBe(true);
      expect(result.preferred[0]).toContain('typ relay');
    });

    test('should apply selected technique', () => {
      const candidates = ['candidate-1 1 udp 1 192.168.1.100 51234 typ host'];
      const result = webrtcEvasion.apply({ candidates });

      expect(result.success).toBe(true);
    });

    test('should apply combined techniques', () => {
      const candidates = [
        'candidate-1 1 udp 1 192.168.1.100 51234 typ host',
        'candidate-2 1 udp 2 abcd.local 51234',
        'candidate-3 1 udp 3 8.8.8.8 51234 typ relay'
      ];
      webrtcEvasion.setTechnique('combined');
      const result = webrtcEvasion.apply({ candidates });

      expect(result.technique).toBe('combined');
      expect(result.filters).toContain('mdns-obfuscation');
    });

    test('should detect IP leaks', () => {
      const candidates = [
        'candidate-1 1 udp 1 192.168.1.100 51234 typ host',
        'candidate-2 1 udp 2 abcd.local 51234'
      ];
      const result = webrtcEvasion.detectLeaks(candidates);

      expect(result.leaksDetected).toBe(true);
      expect(result.leaks.localIPs.length).toBeGreaterThan(0);
      expect(result.leaks.mdnsNames.length).toBeGreaterThan(0);
    });

    test('should not report leaks when prevented', () => {
      const candidates = ['candidate-1 1 udp 1 8.8.8.8 51234 typ relay'];
      const result = webrtcEvasion.detectLeaks(candidates);

      expect(result.leaksDetected).toBe(false);
    });

    test('should list available techniques', () => {
      const techniques = webrtcEvasion.getAvailableTechniques();

      expect(Array.isArray(techniques)).toBe(true);
      expect(techniques).toContain('mdns-obfuscation');
      expect(techniques).toContain('combined');
    });

    test('should set leak severity', () => {
      const result = webrtcEvasion.setLeakSeverity('prevent-local');

      expect(result).toBe(true);
      expect(webrtcEvasion.leakSeverity).toBe('prevent-local');
    });

    test('should reject invalid leak severity', () => {
      const result = webrtcEvasion.setLeakSeverity('invalid');

      expect(result).toBe(false);
    });

    test('should report status', () => {
      const status = webrtcEvasion.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.technique).toBeDefined();
      expect(status.leakSeverity).toBeDefined();
      expect(status.estimatedEffectiveness).toBeDefined();
    });

    test('should reset consistency', () => {
      webrtcEvasion.connectionStateManagement({});
      expect(webrtcEvasion.consistencyMap.size).toBeGreaterThan(0);

      webrtcEvasion.resetConsistency();
      expect(webrtcEvasion.consistencyMap.size).toBe(0);
    });
  });

  describe('Cross-Technique Effectiveness', () => {
    test('combined techniques should have highest effectiveness', () => {
      const audioStatus = new AudioContextEvasion({ technique: 'combined' }).getStatus();
      const fontStatus = new FontEnumerationEvasion({ technique: 'combined' }).getStatus();
      const webrtcStatus = new WebRTCEvasion({ technique: 'combined' }).getStatus();

      // Extract percentage from effectiveness strings
      const getPercentage = (effStr) => parseInt(effStr.split('-')[1]);

      expect(getPercentage(audioStatus.estimatedEffectiveness.combined))
        .toBeGreaterThanOrEqual(75);
      expect(getPercentage(fontStatus.estimatedEffectiveness.combined))
        .toBeGreaterThanOrEqual(75);
      expect(getPercentage(webrtcStatus.estimatedEffectiveness.combined))
        .toBeGreaterThanOrEqual(75);
    });

    test('all techniques should report consistent effectiveness ranges', () => {
      const audioEvasion = new AudioContextEvasion();
      const fontEvasion = new FontEnumerationEvasion();
      const webrtcEvasion = new WebRTCEvasion();

      const audioTechs = audioEvasion.getAvailableTechniques();
      const fontTechs = fontEvasion.getAvailableTechniques();
      const webrtcTechs = webrtcEvasion.getAvailableTechniques();

      // All should have at least 'combined' technique
      expect(audioTechs).toContain('combined');
      expect(fontTechs).toContain('combined');
      expect(webrtcTechs).toContain('combined');
    });
  });
});
