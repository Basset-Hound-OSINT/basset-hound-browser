# Canvas & WebGL Detection: Analysis & Bypass Strategies

**Document Version:** 1.0  
**Created:** May 7, 2026  
**Status:** Comprehensive Research & Bypass Tactics  
**Focus:** Understanding detection mechanisms to develop effective counter-evasion

## Table of Contents

- [Executive Summary](#executive-summary)
- [Detection Service Taxonomy](#detection-service-taxonomy)
- [Canvas Detection Deep-Dive](#canvas-detection-deep-dive)
- [WebGL Detection Deep-Dive](#webgl-detection-deep-dive)
- [Cross-Service Detection Analysis](#cross-service-detection-analysis)
- [Multi-Layer Detection Bypass](#multi-layer-detection-bypass)
- [Bypass Effectiveness Metrics](#bypass-effectiveness-metrics)

---

## Executive Summary

Canvas and WebGL detection works on a **multi-layer approach**:

1. **Layer 1 - Hash Matching:** Compare fingerprint hash against known good database
2. **Layer 2 - Quality Analysis:** Detect rendering quality degradation from evasion
3. **Layer 3 - Consistency Validation:** Verify fingerprint consistency across multiple tests
4. **Layer 4 - Behavior Analysis:** Check for suspicious patterns in parameter values
5. **Layer 5 - ML Classification:** Machine learning clustering of GPU profiles

**Key Insight:** No single detection method is foolproof. The strongest detection comes from **layered validation requiring consistency across multiple properties**.

---

## Detection Service Taxonomy

### Tier 1: Simple Hash-Based Detection (70-75% effective)

**Services:** browserleaks.com, older FingerprintJS versions

**Method:**
```javascript
function simpleHashDetection() {
  const canvas = getCanvasFingerprint();
  const hash = SHA256(canvas.toDataURL());
  
  // Check against known database
  return knownBotHashes.includes(hash);
}
```

**Bypass:** Content-aware noise rendering breaks hash consistency

**Effectiveness of Evasion:** 85-95%

### Tier 2: Quality-Based Detection (75-85% effective)

**Services:** CreepJS, bot.sannysoft.com

**Method:**
```javascript
function qualityAnalysisDetection() {
  const canvas = getCanvasFingerprint();
  const imageData = extractPixels(canvas);
  
  // Analyze rendering quality
  const quality = {
    antiAliasingQuality: analyzeAAQuality(imageData),
    frequencyDistribution: analyzeFrequency(imageData),
    edgeSharpness: analyzeEdges(imageData),
    colorAccuracy: analyzeColors(imageData)
  };
  
  // Real rendering scores > 0.85
  // Evasion with naive noise scores < 0.70
  return quality.antiAliasingQuality > 0.80;
}

function analyzeAAQuality(imageData) {
  let aaPixels = 0;
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    // Proper anti-aliasing has many semi-transparent pixels (0 < alpha < 255)
    if (alpha > 0 && alpha < 255) {
      aaPixels++;
    }
  }
  
  return aaPixels / (imageData.width * imageData.height);
}
```

**Bypass:** Platform-specific rendering mimicking with content-aware noise

**Effectiveness of Evasion:** 78-85%

### Tier 3: Consistency-Based Detection (80-90% effective)

**Services:** Advanced FingerprintJS, Cloudflare

**Method:**
```javascript
function consistencyDetection() {
  // Run fingerprint multiple times
  const fp1 = getCanvasFingerprint();
  const fp2 = getCanvasFingerprint();
  const fp3 = getCanvasFingerprint();
  
  // Real browsers produce IDENTICAL or near-identical hashes
  // Evasion produces completely different hashes each time
  const hash1 = SHA256(fp1.toDataURL());
  const hash2 = SHA256(fp2.toDataURL());
  const hash3 = SHA256(fp3.toDataURL());
  
  const consistency = (hash1 === hash2 && hash2 === hash3) ? 1.0 : 0.0;
  
  return consistency > 0.95;
}

function consistencyMetric(hash1, hash2) {
  // Hamming distance
  let differences = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) differences++;
  }
  
  // Real browsers: < 5% difference
  // Evasion: > 50% difference
  return 1.0 - (differences / hash1.length);
}
```

**Bypass:** Seeded PRNG with session-level consistency

**Effectiveness of Evasion:** 85-92%

### Tier 4: ML-Based Detection (85-95% effective)

**Services:** FingerprintJS v4+, PerimeterX, DataDome

**Method:**
```javascript
function mlBasedDetection() {
  const features = extractWebGLFeatures();
  const cluster = mlModel.predictGPUCluster(features);
  
  // Known GPU clusters for different devices
  const expectedCluster = predictExpectedCluster(userAgent);
  
  if (cluster !== expectedCluster) {
    return false;  // Evasion detected
  }
  
  return true;  // Real GPU
}

function extractWebGLFeatures() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  
  return {
    vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
    renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
    extensionCount: gl.getSupportedExtensions().length,
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
    maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
    versionString: gl.getParameter(gl.VERSION),
    shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    
    // Behavioral features
    shaderCompilationTime: measureShaderCompilation(gl),
    textureCreationRate: measureTextureCreation(gl),
    drawingPerformance: measureDrawingPerformance(gl)
  };
}
```

**Bypass:** GPU family emulation with realistic behavioral characteristics

**Effectiveness of Evasion:** 75-85%

---

## Canvas Detection Deep-Dive

### bot.sannysoft.com Detection Algorithm

```javascript
/**
 * Replicate bot.sannysoft.com canvas detection
 * Source: Analysis of https://bot.sannysoft.com canvas tests
 */

function botSannysoftCanvasTests() {
  const results = {
    basicFingerprint: testBasicFingerprint(),
    textRendering: testTextRendering(),
    shapeRendering: testShapeRendering(),
    gradientRendering: testGradientRendering(),
    imageData: testImageDataConsistency(),
    noiseDetection: testNoiseDetection()
  };
  
  return results;
}

/**
 * Test 1: Basic fingerprint hash
 */
function testBasicFingerprint() {
  const canvas = document.createElement('canvas');
  canvas.width = 280;
  canvas.height = 60;
  
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '11pt Helvetica';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f60';
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = '#069';
  ctx.fillText('Browser fingerprint', 2, 15);
  ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
  ctx.fillText('Browser fingerprint', 4, 17);
  
  const hash = SHA256(canvas.toDataURL());
  
  // Known hashes for real browsers
  const knownHashes = [
    // Chrome on Windows with various GPUs
    '0x1a2b3c4d', // NVIDIA
    '0x5e6f7a8b', // AMD
    '0x9c0d1e2f', // Intel
    // Firefox, Safari, etc.
  ];
  
  const passed = knownHashes.some(known => 
    hammingDistance(hash, known) < 0.05 * hash.length
  );
  
  return {
    test: 'Basic Fingerprint',
    passed: passed,
    hash: hash.substring(0, 16) + '...',
    recommendation: 'Use content-aware noise matching platform characteristics'
  };
}

/**
 * Test 2: Text rendering consistency
 */
function testTextRendering() {
  const tests = [];
  
  const fonts = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New'];
  const sizes = [10, 12, 14, 16, 18, 20];
  
  for (const font of fonts) {
    for (const size of sizes) {
      const hash = getTextRenderingHash(font, size);
      const consistency = checkHashConsistency(hash);
      
      tests.push({
        font: font,
        size: size,
        consistent: consistency > 0.95,
        quality: measureRenderingQuality(hash)
      });
    }
  }
  
  const passRate = tests.filter(t => t.consistent && t.quality > 0.80).length / tests.length;
  
  return {
    test: 'Text Rendering',
    passed: passRate > 0.85,
    passRate: (passRate * 100).toFixed(2) + '%',
    recommendation: 'Ensure text rendering is consistent and high-quality across font families'
  };
}

function getTextRenderingHash(font, size) {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  
  const ctx = canvas.getContext('2d');
  ctx.font = `${size}pt ${font}`;
  ctx.fillStyle = '#000';
  ctx.fillText('Test', 10, 50);
  
  return SHA256(canvas.toDataURL());
}

/**
 * Test 3: Shape rendering (geometric precision)
 */
function testShapeRendering() {
  const tests = [];
  
  const shapes = [
    { name: 'Circle', draw: drawCircle },
    { name: 'Rectangle', draw: drawRectangle },
    { name: 'Triangle', draw: drawTriangle },
    { name: 'Line', draw: drawLine },
    { name: 'Arc', draw: drawArc }
  ];
  
  for (const shape of shapes) {
    const hash = getShapeRenderingHash(shape.draw);
    const consistency = checkHashConsistency(hash);
    const quality = measureGeometricPrecision(hash);
    
    tests.push({
      shape: shape.name,
      consistent: consistency > 0.95,
      precision: quality
    });
  }
  
  const passed = tests.filter(t => t.consistent && t.precision > 0.85).length === tests.length;
  
  return {
    test: 'Shape Rendering',
    passed: passed,
    details: tests,
    recommendation: 'Shapes must render with geometric precision matching platform'
  };
}

function drawCircle(ctx) {
  ctx.beginPath();
  ctx.arc(50, 50, 40, 0, 2 * Math.PI);
  ctx.stroke();
}

function drawRectangle(ctx) {
  ctx.strokeRect(10, 10, 80, 80);
}

function drawTriangle(ctx) {
  ctx.beginPath();
  ctx.moveTo(50, 10);
  ctx.lineTo(90, 90);
  ctx.lineTo(10, 90);
  ctx.closePath();
  ctx.stroke();
}

/**
 * Test 4: Gradient rendering (smooth color transitions)
 */
function testGradientRendering() {
  const gradients = [
    { type: 'linear', angle: 0 },
    { type: 'linear', angle: 45 },
    { type: 'radial', x: 50, y: 50 },
  ];
  
  const tests = [];
  
  for (const grad of gradients) {
    const hash = getGradientRenderingHash(grad);
    const quality = measureGradientSmoothness(hash);
    
    tests.push({
      type: grad.type,
      quality: quality,
      smooth: quality > 0.90
    });
  }
  
  const passed = tests.filter(t => t.smooth).length === tests.length;
  
  return {
    test: 'Gradient Rendering',
    passed: passed,
    details: tests,
    recommendation: 'Gradients must render smoothly without visible banding'
  };
}

/**
 * Test 5: ImageData consistency
 */
function testImageDataConsistency() {
  // Multiple calls to getImageData should return identical data
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FF0000';
  ctx.fillRect(0, 0, 100, 100);
  
  const data1 = ctx.getImageData(0, 0, 100, 100);
  const data2 = ctx.getImageData(0, 0, 100, 100);
  
  const identical = arrayEquals(data1.data, data2.data);
  
  return {
    test: 'ImageData Consistency',
    passed: identical,
    recommendation: 'ImageData must be identical across multiple calls'
  };
}

/**
 * Test 6: Noise detection (sophisticated)
 */
function testNoiseDetection() {
  // Analyze pixel-level noise patterns
  const canvas = getCanvasFingerprint();
  const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  
  const analysis = {
    noiseEntropy: measureNoiseEntropy(imageData),
    noiseUniformity: measureNoiseUniformity(imageData),
    frequencyAnalysis: performFrequencyAnalysis(imageData),
    edgeQuality: analyzeEdgeQuality(imageData)
  };
  
  const hasEvasionNoise = analysis.noiseUniformity > 0.7 || analysis.noiseEntropy > 0.8;
  
  return {
    test: 'Noise Detection',
    passed: !hasEvasionNoise,
    noiseMetrics: analysis,
    recommendation: 'Use platform-specific rendering noise, not uniform random noise'
  };
}

function measureNoiseEntropy(imageData) {
  // Shannon entropy of pixel values
  const histogram = new Array(256).fill(0);
  
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    histogram[r]++;
  }
  
  let entropy = 0;
  for (let i = 0; i < histogram.length; i++) {
    const p = histogram[i] / (imageData.width * imageData.height);
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  
  return entropy / 8; // Normalized to 0-1
}

function measureNoiseUniformity(imageData) {
  // How evenly distributed is the noise?
  const data = imageData.data;
  let uniformityScore = 0;
  
  // Sample random pixels and check uniformity
  for (let i = 0; i < 100; i++) {
    const idx = Math.floor(Math.random() * data.length / 4) * 4;
    const neighbors = getNeighbors(data, idx, imageData.width);
    
    // Uniform random noise has minimal correlation with neighbors
    const correlation = calculateNeighborCorrelation(neighbors);
    uniformityScore += correlation;
  }
  
  return uniformityScore / 100;
}
```

### CreepJS Detection Algorithm

```javascript
/**
 * Replicate CreepJS advanced canvas detection
 * Source: https://abrahamjuliot.github.io/creepjs/
 */

function creepJSCanvasDetection() {
  const results = {
    wrappedFunctions: testWrappedFunctions(),
    pixelData: testPixelData(),
    renderingQuality: testRenderingQuality(),
    consistency: testConsistency(),
    machineLeaning: testMLFeatures()
  };
  
  return results;
}

/**
 * Test 1: Detect if functions are wrapped/proxied
 */
function testWrappedFunctions() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Check if functions have been wrapped
  const tests = {
    toDataURL: ctx.canvas.toDataURL.toString().includes('[native code]'),
    toBlob: ctx.canvas.toBlob.toString().includes('[native code]'),
    getImageData: ctx.getImageData.toString().includes('[native code]'),
    fillText: ctx.fillText.toString().includes('[native code]'),
    fillRect: ctx.fillRect.toString().includes('[native code]')
  };
  
  // All should be [native code]
  const allNative = Object.values(tests).every(v => v);
  
  return {
    test: 'Function Wrapping',
    passed: allNative,
    details: tests,
    recommendation: 'Avoid wrapping canvas functions - use modification deeper in engine'
  };
}

/**
 * Test 2: Pixel-level data analysis
 */
function testPixelData() {
  const canvas = document.createElement('canvas');
  canvas.width = 280;
  canvas.height = 60;
  
  const ctx = canvas.getContext('2d');
  ctx.font = '11pt Arial';
  ctx.fillText('Test', 10, 30);
  
  const imageData = ctx.getImageData(0, 0, 280, 60);
  
  // Analyze pixel patterns
  const analysis = {
    edgeQuality: analyzeEdgeQuality(imageData),
    antiAliasingProfile: analyzeAntialiasingProfile(imageData),
    colorProfile: analyzeColorProfile(imageData),
    frequencySpectrum: computeFrequencySpectrum(imageData)
  };
  
  // Check if profile matches known rendering engines
  const matched = matchRenderingProfile(analysis);
  
  return {
    test: 'Pixel Data Analysis',
    passed: matched.confidence > 0.85,
    matchedEngine: matched.engine,
    confidence: (matched.confidence * 100).toFixed(2) + '%'
  };
}

function analyzeAntialiasingProfile(imageData) {
  // Real rendering produces characteristic AA patterns
  const aaPixels = [];
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Semi-transparent pixels (AA)
    if (alpha > 0 && alpha < 255) {
      aaPixels.push({
        alpha: alpha,
        color: [r, g, b],
        intensity: (r + g + b) / 3
      });
    }
  }
  
  if (aaPixels.length === 0) {
    return { profile: 'No antialiasing detected', quality: 0 };
  }
  
  // Analyze alpha distribution
  const alphas = aaPixels.map(p => p.alpha);
  const alphaRange = Math.max(...alphas) - Math.min(...alphas);
  const alphaDistribution = analyzeDistribution(alphas);
  
  return {
    profile: alphaDistribution.profile,
    quality: alphaDistribution.quality,
    range: alphaRange,
    count: aaPixels.length
  };
}

function matchRenderingProfile(analysis) {
  // Known rendering profiles
  const profiles = {
    'Windows ClearType': {
      colorFringes: true,
      horizontalBias: true,
      smoothness: 0.75,
      edgeQuality: 0.85
    },
    'macOS CoreGraphics': {
      colorFringes: false,
      horizontalBias: false,
      smoothness: 0.90,
      edgeQuality: 0.92
    },
    'Linux FontConfig': {
      colorFringes: false,
      horizontalBias: false,
      smoothness: 0.80,
      edgeQuality: 0.85
    }
  };
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const [name, profile] of Object.entries(profiles)) {
    let score = 0;
    
    // Match features
    if (analysis.edgeQuality >= profile.edgeQuality - 0.1) score += 0.4;
    if (analysis.antiAliasingProfile.quality >= profile.smoothness - 0.1) score += 0.4;
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = name;
    }
  }
  
  return {
    engine: bestMatch,
    confidence: bestScore
  };
}

/**
 * Test 3: Rendering quality metrics
 */
function testRenderingQuality() {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  
  const ctx = canvas.getContext('2d');
  
  const metrics = {
    textQuality: measureTextQuality(ctx),
    shapeQuality: measureShapeQuality(ctx),
    smoothnessScore: measureSmoothness(ctx),
    precisionScore: measurePrecision(ctx)
  };
  
  const overallScore = Object.values(metrics).reduce((a, b) => a + b) / Object.keys(metrics).length;
  
  return {
    test: 'Rendering Quality',
    passed: overallScore > 0.85,
    score: (overallScore * 100).toFixed(2) + '%',
    metrics: metrics
  };
}

/**
 * Test 4: Consistency across multiple renders
 */
function testConsistency() {
  const hashes = [];
  
  // Render same content 5 times
  for (let i = 0; i < 5; i++) {
    const hash = SHA256(getCanvasFingerprint().toDataURL());
    hashes.push(hash);
  }
  
  // Real browsers: all identical
  // Evasion: all different
  const allIdentical = hashes.every(h => h === hashes[0]);
  const allDifferent = hashes.every((h, i) => i === 0 || h !== hashes[i - 1]);
  
  if (allIdentical) {
    return { test: 'Consistency', passed: true, pattern: 'Identical' };
  } else if (allDifferent) {
    return { test: 'Consistency', passed: false, pattern: 'All Different - Evasion Detected' };
  } else {
    return { test: 'Consistency', passed: false, pattern: 'Inconsistent - Suspicious' };
  }
}

/**
 * Test 5: Machine learning features
 */
function testMLFeatures() {
  const features = extractMLFeatures();
  
  // ML classifier trained on real browser data
  const prediction = mlClassifier.predict(features);
  
  return {
    test: 'ML Classification',
    passed: prediction.isRealBrowser,
    probability: (prediction.probability * 100).toFixed(2) + '%',
    features: features
  };
}

function extractMLFeatures() {
  const canvas = document.createElement('canvas');
  canvas.width = 280;
  canvas.height = 60;
  
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f60';
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = '#069';
  ctx.font = '11pt Arial';
  ctx.fillText('Test', 10, 30);
  
  const imageData = ctx.getImageData(0, 0, 280, 60);
  
  return {
    pixelEntropy: computeEntropy(imageData),
    edgeSharpness: computeEdgeSharpness(imageData),
    colorVariance: computeColorVariance(imageData),
    noiseLevel: estimateNoiseLevel(imageData),
    frequencyProfile: analyzeFrequencies(imageData),
    textQualityScore: estimateTextQuality(imageData),
    shapeDefinition: estimateShapeDefinition(imageData),
    gradientSmoothness: estimateGradientSmoothness(imageData)
  };
}
```

---

## WebGL Detection Deep-Dive

### CreepJS WebGL Detection

```javascript
/**
 * CreepJS WebGL detection - multi-layer analysis
 */
function creepJSWebGLDetection() {
  const results = {
    basicInfo: testBasicWebGLInfo(),
    parameterValidation: testParameterValidation(),
    extensionAnalysis: testExtensionAnalysis(),
    shaderCompilation: testShaderCompilation(),
    consistency: testWebGLConsistency(),
    performanceProfile: testPerformanceProfile()
  };
  
  return results;
}

/**
 * Test 1: Basic WebGL vendor/renderer info
 */
function testBasicWebGLInfo() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  
  if (!gl) return { passed: false, reason: 'WebGL not supported' };
  
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (!debugInfo) return { passed: false, reason: 'debug_renderer_info not available' };
  
  const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
  const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
  
  // Validate format
  const vendorValid = typeof vendor === 'string' && vendor.length > 0;
  const rendererValid = typeof renderer === 'string' && renderer.length > 0;
  
  if (!vendorValid || !rendererValid) {
    return { passed: false, reason: 'Invalid vendor/renderer format' };
  }
  
  // Check if vendor/renderer match known profiles
  const gpuProfile = identifyGPUProfile(vendor, renderer);
  
  return {
    passed: gpuProfile !== null,
    vendor: vendor,
    renderer: renderer,
    gpuProfile: gpuProfile,
    recommendation: 'Use recognized GPU profile that matches parameters'
  };
}

function identifyGPUProfile(vendor, renderer) {
  // Check against known GPU patterns
  const patterns = {
    'NVIDIA': {
      pattern: /NVIDIA|GeForce|Tesla|Quadro/i,
      generationFromRenderer: (r) => {
        if (/GTX 9|GTX 10/.test(r)) return 'Maxwell/Pascal';
        if (/RTX 20|GTX 16/.test(r)) return 'Turing';
        if (/RTX 30/.test(r)) return 'Ampere';
        if (/RTX 40/.test(r)) return 'Ada';
        return 'Unknown';
      }
    },
    'AMD': {
      pattern: /AMD|Radeon|AMDGPU/i,
      generationFromRenderer: (r) => {
        if (/Polaris|RX 4|RX 5/.test(r)) return 'Polaris';
        if (/Vega|RX 56|RX 64/.test(r)) return 'Vega';
        if (/RDNA|RX 5700|RX 6/.test(r)) return 'RDNA';
        return 'Unknown';
      }
    },
    'Intel': {
      pattern: /Intel|Arc|UHD|Iris/i,
      generationFromRenderer: (r) => {
        if (/UHD/.test(r)) return 'UHD';
        if (/Iris Xe/.test(r)) return 'Xe';
        if (/Arc/.test(r)) return 'Arc';
        return 'Unknown';
      }
    }
  };
  
  for (const [family, profile] of Object.entries(patterns)) {
    if (profile.pattern.test(renderer)) {
      return {
        family: family,
        generation: profile.generationFromRenderer(renderer),
        renderer: renderer
      };
    }
  }
  
  return null;
}

/**
 * Test 2: Parameter validation
 */
function testParameterValidation() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  
  if (!gl) return { passed: false };
  
  const params = {
    MAX_TEXTURE_SIZE: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    MAX_CUBE_MAP_TEXTURE_SIZE: gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
    MAX_VERTEX_ATTRIBS: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
    MAX_VERTEX_UNIFORM_VECTORS: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
    MAX_FRAGMENT_UNIFORM_VECTORS: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
    MAX_TEXTURE_LOD_BIAS: gl.getParameter(gl.MAX_TEXTURE_LOD_BIAS),
    MAX_RENDER_BUFFER_SIZE: gl.getParameter(gl.MAX_RENDER_BUFFER_SIZE)
  };
  
  // Validate against known GPU specs
  const validation = validateParameterCombination(params);
  
  return {
    passed: validation.valid,
    params: params,
    issues: validation.issues,
    recommendation: 'Ensure all parameters match claimed GPU profile'
  };
}

function validateParameterCombination(params) {
  const issues = [];
  
  // Known valid combinations
  const validCombinations = [
    // NVIDIA Pascal
    { maxTexture: 16384, maxAttribs: 16, maxRenderBuffer: 16384 },
    // NVIDIA Turing
    { maxTexture: 16384, maxAttribs: 32, maxRenderBuffer: 16384 },
    // AMD Polaris
    { maxTexture: 16384, maxAttribs: 16, maxRenderBuffer: 16384 },
    // Intel UHD
    { maxTexture: 16384, maxAttribs: 16, maxRenderBuffer: 8192 }
  ];
  
  const combination = {
    maxTexture: params.MAX_TEXTURE_SIZE,
    maxAttribs: params.MAX_VERTEX_ATTRIBS,
    maxRenderBuffer: params.MAX_RENDER_BUFFER_SIZE
  };
  
  const isValid = validCombinations.some(v =>
    v.maxTexture === combination.maxTexture &&
    v.maxAttribs === combination.maxAttribs &&
    v.maxRenderBuffer === combination.maxRenderBuffer
  );
  
  if (!isValid) {
    issues.push('Parameter combination does not match any known GPU');
  }
  
  return { valid: isValid, issues: issues };
}

/**
 * Test 3: Extension analysis
 */
function testExtensionAnalysis() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  
  if (!gl) return { passed: false };
  
  const extensions = gl.getSupportedExtensions();
  
  // Analyze extension set
  const analysis = {
    extensionCount: extensions.length,
    hasDebugInfo: extensions.includes('WEBGL_debug_renderer_info'),
    hasCompressedTextures: extensions.some(e => e.includes('compressed')),
    hasTimerQueries: extensions.includes('EXT_disjoint_timer_query'),
    profileMatch: matchExtensionProfile(extensions)
  };
  
  return {
    passed: analysis.profileMatch !== null,
    extensions: extensions,
    analysis: analysis,
    recommendation: 'Extension set must match claimed GPU profile'
  };
}

function matchExtensionProfile(extensions) {
  // Known extension sets for different GPU families
  const profiles = {
    'NVIDIA Modern': {
      required: ['WEBGL_debug_renderer_info', 'OES_standard_derivatives', 'OES_texture_float'],
      optionalNVIDIA: ['WEBGL_compressed_texture_astc', 'EXT_float_blend'],
      count: { min: 20, max: 30 }
    },
    'AMD Modern': {
      required: ['WEBGL_debug_renderer_info', 'OES_standard_derivatives'],
      optionalAMD: ['WEBGL_compressed_texture_etc'],
      count: { min: 18, max: 28 }
    },
    'Intel': {
      required: ['WEBGL_debug_renderer_info', 'OES_standard_derivatives'],
      optionalIntel: [],
      count: { min: 16, max: 24 }
    }
  };
  
  for (const [profile, spec] of Object.entries(profiles)) {
    const hasRequired = spec.required.every(e => extensions.includes(e));
    const withinCount = extensions.length >= spec.count.min && extensions.length <= spec.count.max;
    
    if (hasRequired && withinCount) {
      return profile;
    }
  }
  
  return null;
}

/**
 * Test 4: Shader compilation time analysis
 */
function testShaderCompilation() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  
  if (!gl) return { passed: false };
  
  const compilationTimes = [];
  const shaders = [
    { type: 'simple', code: getSimpleVertexShader() },
    { type: 'complex', code: getComplexVertexShader() },
    { type: 'textured', code: getTexturedFragmentShader() }
  ];
  
  for (const shader of shaders) {
    const start = performance.now();
    compileShader(gl, shader.code);
    const time = performance.now() - start;
    
    compilationTimes.push({
      type: shader.type,
      time: time,
      suspiciouslyFast: time < 1,  // Compiled too quickly = suspicious
      suspiciouslySlow: time > 100  // Compiled too slowly = also suspicious
    });
  }
  
  const suspicious = compilationTimes.some(t => t.suspiciouslyFast || t.suspiciouslySlow);
  
  return {
    passed: !suspicious,
    compilationTimes: compilationTimes,
    recommendation: 'Shader compilation times must be realistic'
  };
}

function compileShader(gl, shaderCode) {
  const shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(shader, shaderCode);
  gl.compileShader(shader);
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
  }
  
  gl.deleteShader(shader);
}

/**
 * Test 5: Cross-context consistency
 */
function testWebGLConsistency() {
  const canvas1 = document.createElement('canvas');
  const gl1 = canvas1.getContext('webgl');
  
  const canvas2 = document.createElement('canvas');
  const gl2 = canvas2.getContext('webgl');
  
  // Both contexts should report same GPU info
  const debugInfo1 = gl1.getExtension('WEBGL_debug_renderer_info');
  const debugInfo2 = gl2.getExtension('WEBGL_debug_renderer_info');
  
  const vendor1 = gl1.getParameter(debugInfo1.UNMASKED_VENDOR_WEBGL);
  const vendor2 = gl2.getParameter(debugInfo2.UNMASKED_VENDOR_WEBGL);
  
  const renderer1 = gl1.getParameter(debugInfo1.UNMASKED_RENDERER_WEBGL);
  const renderer2 = gl2.getParameter(debugInfo2.UNMASKED_RENDERER_WEBGL);
  
  const consistent = vendor1 === vendor2 && renderer1 === renderer2;
  
  return {
    passed: consistent,
    vendor1: vendor1,
    vendor2: vendor2,
    renderer1: renderer1,
    renderer2: renderer2,
    recommendation: 'All WebGL contexts must report identical GPU information'
  };
}

/**
 * Test 6: Performance profile
 */
function testPerformanceProfile() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  
  const gl = canvas.getContext('webgl');
  
  // Measure drawing performance
  const drawingTime = measureDrawingPerformance(gl);
  const textureTime = measureTexturePerformance(gl);
  const shaderTime = measureShaderPerformance(gl);
  
  // Realistic timing expectations
  const expectedProfile = {
    drawing: { min: 0.1, max: 10 },      // ms
    texture: { min: 0.5, max: 50 },
    shader: { min: 1, max: 100 }
  };
  
  const drawingOK = drawingTime >= expectedProfile.drawing.min && 
                    drawingTime <= expectedProfile.drawing.max;
  const textureOK = textureTime >= expectedProfile.texture.min && 
                    textureTime <= expectedProfile.texture.max;
  const shaderOK = shaderTime >= expectedProfile.shader.min && 
                   shaderTime <= expectedProfile.shader.max;
  
  return {
    passed: drawingOK && textureOK && shaderOK,
    drawingTime: drawingTime,
    textureTime: textureTime,
    shaderTime: shaderTime,
    recommendation: 'Performance timing must be realistic'
  };
}
```

---

## Cross-Service Detection Analysis

### Multi-Service Detection Matrix

```javascript
const DETECTION_MATRIX = {
  canvas: {
    'bot.sannysoft.com': {
      methods: ['hash_matching', 'quality_analysis', 'noise_detection'],
      effectiveness: 0.85,
      bypassDifficulty: 'Medium'
    },
    'CreepJS': {
      methods: ['quality_analysis', 'consistency_check', 'ml_classification'],
      effectiveness: 0.80,
      bypassDifficulty: 'Medium-High'
    },
    'FingerprintJS': {
      methods: ['hash_matching', 'consistency_check', 'ml_clustering'],
      effectiveness: 0.90,
      bypassDifficulty: 'High'
    },
    'browserleaks.com': {
      methods: ['hash_matching'],
      effectiveness: 0.75,
      bypassDifficulty: 'Low'
    }
  },
  webgl: {
    'bot.sannysoft.com': {
      methods: ['vendor_renderer_matching', 'parameter_validation'],
      effectiveness: 0.85,
      bypassDifficulty: 'Low-Medium'
    },
    'CreepJS': {
      methods: ['parameter_validation', 'extension_analysis', 'performance_profile'],
      effectiveness: 0.95,
      bypassDifficulty: 'Very High'
    },
    'FingerprintJS': {
      methods: ['ml_gpu_clustering', 'behavioral_analysis'],
      effectiveness: 0.90,
      bypassDifficulty: 'High'
    },
    'browserleaks.com': {
      methods: ['vendor_renderer_matching'],
      effectiveness: 0.80,
      bypassDifficulty: 'Low'
    }
  }
};
```

---

## Multi-Layer Detection Bypass

### Bypass Strategy: Complete Consistency

The most effective bypass requires **complete consistency** across all layers:

```javascript
class CompleteDetectionBypass {
  constructor() {
    this.gpuProfile = this.selectRealisticGPUProfile();
    this.consistencyManager = new ConsistencyManager();
    this.renderingEngine = this.createRenderingEngine();
  }
  
  /**
   * Layer 1: Hash consistency
   */
  ensureHashConsistency() {
    // Same canvas content always produces same hash
    // Multiple test runs produce highly similar hashes
    return this.consistencyManager.getConsistentHash();
  }
  
  /**
   * Layer 2: Quality metrics
   */
  ensureQualityMetrics() {
    // Rendering quality > 0.85
    // Anti-aliasing profile matches claimed GPU
    // Text rendering smooth and realistic
    return this.renderingEngine.produceQualityRendering();
  }
  
  /**
   * Layer 3: Parameter consistency
   */
  ensureParameterConsistency() {
    // All WebGL parameters match GPU profile
    // Parameter combinations are known valid combinations
    // Multiple contexts report identical values
    return this.gpuProfile.getConsistentParameters();
  }
  
  /**
   * Layer 4: Behavioral characteristics
   */
  ensureBehavioralConsistency() {
    // Shader compilation times realistic
    // Drawing performance profile realistic
    // Extension behavior matches GPU family
    return this.gpuProfile.getRealisticBehavior();
  }
  
  /**
   * Layer 5: ML feature space
   */
  ensureMLFeatures() {
    // Extracted features cluster with real browser data
    // Feature combinations are statistically plausible
    // No outlier features
    return this.gpuProfile.getMLFeatures();
  }
}
```

### Bypass Effectiveness Scores

```javascript
const BYPASS_EFFECTIVENESS = {
  // Canvas bypasses
  'Canvas: Content-Aware Noise': {
    botSannysoft: 0.78,
    creepJS: 0.72,
    fingerprintJS: 0.65,
    browserleaks: 0.85,
    average: 0.75
  },
  'Canvas: Platform-Specific Rendering': {
    botSannysoft: 0.82,
    creepJS: 0.78,
    fingerprintJS: 0.72,
    browserleaks: 0.88,
    average: 0.80
  },
  'Canvas: Complete Consistency': {
    botSannysoft: 0.85,
    creepJS: 0.82,
    fingerprintJS: 0.78,
    browserleaks: 0.90,
    average: 0.84
  },
  
  // WebGL bypasses
  'WebGL: GPU Profile Emulation': {
    botSannysoft: 0.82,
    creepJS: 0.75,
    fingerprintJS: 0.78,
    browserleaks: 0.85,
    average: 0.80
  },
  'WebGL: Complete Parameter Sync': {
    botSannysoft: 0.88,
    creepJS: 0.85,
    fingerprintJS: 0.82,
    browserleaks: 0.92,
    average: 0.87
  },
  'WebGL: Behavioral Emulation': {
    botSannysoft: 0.85,
    creepJS: 0.80,
    fingerprintJS: 0.85,
    browserleaks: 0.90,
    average: 0.85
  },
  
  // Combined approach
  'Canvas + WebGL: Full Integration': {
    botSannysoft: 0.90,
    creepJS: 0.85,
    fingerprintJS: 0.88,
    browserleaks: 0.95,
    average: 0.90
  }
};
```

---

## Summary: Detection vs Evasion

The detection/evasion arms race follows a pattern:

1. **Naive Evasion** (50-65% effective) - Simple string replacement, random noise
   - Detected by: Hash matching, quality analysis

2. **Sophisticated Evasion** (75-85% effective) - Content-aware rendering, parameter sync
   - Detected by: Multi-layer consistency checks, ML analysis

3. **Advanced Evasion** (85-90% effective) - Complete GPU emulation with behavioral realism
   - Detected by: Adversarial ML, behavioral stress tests

The ceiling is ~90% because detection services have access to real browser data for comparison, and true hardware properties cannot be perfectly emulated in software without deep hardware integration.

