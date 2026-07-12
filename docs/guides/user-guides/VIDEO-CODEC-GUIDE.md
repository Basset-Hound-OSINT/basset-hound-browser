# Video Codec Selection & Performance Guide

**Version:** 1.0.0  
**Date:** June 14, 2026  
**Status:** Production Ready

## Quick Selection Guide

Choose your codec based on priority:

| Priority | Recommendation | Quality Range | File Size |
|----------|---|---|---|
| **Web playback** | VP8 | Medium | Small |
| **Long-term storage** | VP9 | High | Tiny |
| **Compatibility** | H.264 | High | Medium |
| **Maximum compression** | H.265 | Excellent | Tiny |
| **Speed (default)** | VP9 | High | Tiny |

## Codec Comparison Matrix

### VP8 (Google WebM)

**Best For:** Web distribution, quick storage, speed-critical applications

```
Container:       WebM (.webm)
MIME:            video/webm;codecs="vp8"
Quality Setting: q:v (4-10, default: 6)
Encoding Speed:  200-250 fps (fastest)
Latency:         <50ms (lowest)
```

**Characteristics:**
- ✅ Excellent browser compatibility
- ✅ Fast encoding speed
- ✅ Good compression (60-75%)
- ❌ Lower quality per file size
- ❌ Less efficient than VP9

**Quality Mapping (q:v scale):**
```
q:v=4  → Highest quality, largest file
q:v=5  → High quality
q:v=6  → Good balance (DEFAULT)
q:v=7  → Lower quality
q:v=8  → Compressed
q:v=9  → Very compressed
q:v=10 → Lowest quality, smallest file
```

**Use Case Example:**
```javascript
// Recording user interactions for quick playback
new VideoEncoder({
  codec: 'vp8',
  fps: 24,
  quality: 6  // Balanced quality/speed
});

// Expected output: 180-250 MB/hour
```

---

### VP9 (Google WebM 2.0) - DEFAULT

**Best For:** Long-term storage, archival, cloud backup

```
Container:       WebM (.webm)
MIME:            video/webm;codecs="vp9"
Quality Setting: crf (0-63, default: 32)
Encoding Speed:  100-150 fps (moderate)
Latency:         ~80ms (moderate)
```

**Characteristics:**
- ✅ Excellent compression (70-85%)
- ✅ Superior quality/file size ratio
- ✅ Good browser support
- ✅ Default choice for most scenarios
- ❌ Slower than VP8
- ❌ Higher CPU usage

**Quality Mapping (crf scale):**
```
crf=0-10   → Lossless to near-lossless (huge files)
crf=15-20  → High quality, very efficient
crf=25-30  → Balanced quality (DEFAULT range)
crf=35-45  → Acceptable for web (compressed)
crf=50-63  → Heavily compressed (artifacts visible)
```

**VP9 Quality Presets:**
- **crf=20** - Forensic-grade archival
- **crf=25** - Balanced (recommended)
- **crf=32** - Default (good compression)
- **crf=40** - Heavily compressed (faster)

**Use Case Examples:**
```javascript
// High-quality forensic recording (archival)
new VideoEncoder({
  codec: 'vp9',
  fps: 30,
  quality: 20  // Forensic quality
});
// Output: 80-120 MB/hour

// Balanced storage (recommended)
new VideoEncoder({
  codec: 'vp9',
  fps: 24,
  quality: 32  // DEFAULT
});
// Output: 120-180 MB/hour

// Storage-constrained scenario
new VideoEncoder({
  codec: 'vp9',
  fps: 10,
  quality: 40  // Compressed but acceptable
});
// Output: 40-60 MB/hour
```

---

### H.264 (AVC/MPEG-4)

**Best For:** Maximum compatibility, enterprise deployments

```
Container:       MP4 (.mp4)
MIME:            video/mp4;codecs="avc1.42E01E"
Quality Setting: crf (0-51, default: 28)
Encoding Speed:  150-200 fps
Latency:         ~60ms
```

**Characteristics:**
- ✅ Universal compatibility (all devices)
- ✅ Fast encoding
- ✅ Good compression (65-80%)
- ❌ Slightly larger than VP9
- ❌ License implications for some uses
- ❌ Less efficient than newer codecs

**Quality Mapping (crf scale):**
```
crf=0-18   → Visually lossless (very large)
crf=19-25  → High quality (recommended range)
crf=23     → Default good quality
crf=28     → Balanced (our default)
crf=35-45  → Acceptable (compressed)
crf=51     → Lowest quality
```

**Use Case Examples:**
```javascript
// Maximum compatibility requirement
new VideoEncoder({
  codec: 'h264',
  fps: 24,
  quality: 23  // High quality, maximum compat
});
// Output: 200-280 MB/hour

// Balanced approach
new VideoEncoder({
  codec: 'h264',
  fps: 24,
  quality: 28  // Good balance
});
// Output: 180-240 MB/hour
```

---

### H.265 (HEVC/H.265)

**Best For:** Maximum compression, modern deployments

```
Container:       MP4 (.mp4)
MIME:            video/mp4;codecs="hev1.1.2.L120.B0"
Quality Setting: crf (0-51, default: 28)
Encoding Speed:  80-120 fps (slowest)
Latency:         ~100ms
```

**Characteristics:**
- ✅ Excellent compression (75-93%)
- ✅ Best quality/size ratio
- ✅ Future-proof
- ❌ Slower encoding
- ❌ Limited device support
- ❌ Patent considerations
- ❌ Requires modern browser/player

**Quality Mapping:** Same as H.264 (crf 0-51)

**Use Case Examples:**
```javascript
// Maximum compression for cloud storage
new VideoEncoder({
  codec: 'h265',
  fps: 30,
  quality: 25  // High quality with H.265 efficiency
});
// Output: 80-120 MB/hour

// Space-constrained scenario (mobile/edge)
new VideoEncoder({
  codec: 'h265',
  fps: 10,
  quality: 32
});
// Output: 30-50 MB/hour
```

---

## Performance Comparison

### Encoding Speed (frames/second)

```
VP8:    ████████████████████████ 250 fps
H.264:  ████████████████████░░░░ 180 fps
VP9:    ██████████████░░░░░░░░░░ 120 fps
H.265:  ███████████░░░░░░░░░░░░░  95 fps
```

### Compression Ratio (1hr @ 1920x1080 @ 24fps)

```
H.265:   ████████████████████░░░░ 100 MB (82%)
VP9:     ███████████████░░░░░░░░░ 140 MB (76%)
H.264:   ████████████░░░░░░░░░░░░ 240 MB (60%)
VP8:     ██████████░░░░░░░░░░░░░░ 200 MB (64%)
```

### CPU Usage (relative, 1 unit = 10%)

```
VP8:    ░░░░░░░░░░ 1.0 (lowest)
H.264:  ░░░░░░░░░░ 1.2
VP9:    ░░░░░░░░░░░░░░░░░░░░ 2.5
H.265:  ░░░░░░░░░░░░░░░░░░░░░░░░░░ 3.0 (highest)
```

### Quality-at-Size Ratio (higher is better)

```
H.265:   ████████████████████░░░ 4.5
VP9:     ███████████████░░░░░░░░ 3.8
H.264:   ██████████░░░░░░░░░░░░░ 2.1
VP8:     █████░░░░░░░░░░░░░░░░░░ 1.8
```

## Real-World File Size Examples

### 1-Hour Recording @ 1920x1080 @ 24fps

#### Quality Scenarios

**High Quality (Forensic Archive):**
```
VP8 (q:v=4):    380 MB
VP9 (crf=20):   110 MB
H.264 (crf=19): 200 MB
H.265 (crf=19):  85 MB
```

**Balanced (Recommended):**
```
VP8 (q:v=6):    220 MB
VP9 (crf=32):   145 MB  ← RECOMMENDED
H.264 (crf=28): 240 MB
H.265 (crf=28): 105 MB
```

**Compressed (Storage-Limited):**
```
VP8 (q:v=8):    150 MB
VP9 (crf=40):    95 MB
H.264 (crf=38): 180 MB
H.265 (crf=40):  70 MB
```

## Selection Decision Tree

```
START
  │
  ├─ Do you need universal compatibility?
  │  │
  │  ├─ YES → Use H.264
  │  │        • Plays everywhere
  │  │        • Reliable for enterprise
  │  │        • Quality: crf=23 (high)
  │  │
  │  └─ NO
  │     │
  │     └─ Is storage space critical?
  │        │
  │        ├─ YES → Use H.265
  │        │        • Maximum compression
  │        │        • 80-120 MB/hour
  │        │        • Trade-off: slower encode
  │        │
  │        └─ NO
  │           │
  │           └─ What's your primary use case?
  │              │
  │              ├─ Web playback?
  │              │  └─ Use VP8 (crf=6)
  │              │     • Fast encoding
  │              │     • Good compatibility
  │              │
  │              └─ Long-term archive/default?
  │                 └─ Use VP9 (crf=32) ← RECOMMENDED
  │                    • Best balance
  │                    • Good compression
  │                    • Good quality
```

## Performance Tuning

### For Maximum Speed (Live Preview)

```javascript
new VideoEncoder({
  codec: 'vp8',
  fps: 10,        // Lower frame rate
  quality: 8,     // Lower quality
  maxWidth: 1280,
  maxHeight: 720  // Lower resolution
});
// ~20-30 MB/hour, 250+ fps encode speed
```

### For Balanced Performance (Recommended)

```javascript
new VideoEncoder({
  codec: 'vp9',      // DEFAULT
  fps: 24,           // Standard rate
  quality: 32,       // Default quality
  maxWidth: 1920,
  maxHeight: 1080
});
// ~140-180 MB/hour, 120 fps encode speed
```

### For Archive Quality

```javascript
new VideoEncoder({
  codec: 'vp9',
  fps: 30,           // Higher frame rate
  quality: 20,       // Better quality
  maxWidth: 1920,
  maxHeight: 1080
});
// ~100-140 MB/hour, 80 fps encode speed
```

### For Storage Constraint

```javascript
new VideoEncoder({
  codec: 'h265',
  fps: 24,
  quality: 35,       // Compressed
  maxWidth: 1280,
  maxHeight: 720
});
// ~50-70 MB/hour, 100 fps encode speed
```

## Compatibility Matrix

### Browser Support

| Codec | Chrome | Firefox | Safari | Edge | Mobile |
|-------|--------|---------|--------|------|--------|
| VP8   | ✅ | ✅ | ❌ | ✅ | ✅ (some) |
| VP9   | ✅ | ✅ | ❌ | ✅ | ✅ (some) |
| H.264 | ✅ | ❌ | ✅ | ✅ | ✅ |
| H.265 | ⚠️ (some) | ❌ | ✅ | ⚠️ (some) | ✅ (some) |

**Legend:** ✅ Full support | ⚠️ Partial/conditional | ❌ No support

### Device Support

| Device | VP8 | VP9 | H.264 | H.265 |
|--------|-----|-----|-------|-------|
| Desktop (modern) | ✅ | ✅ | ✅ | ⚠️ |
| Laptop | ✅ | ✅ | ✅ | ⚠️ |
| iPhone/iPad | ❌ | ❌ | ✅ | ✅ |
| Android (new) | ✅ | ✅ | ✅ | ✅ |
| Smart TV | ⚠️ | ⚠️ | ✅ | ✅ |

## Recommended Configurations by Use Case

### Forensic Investigation (High Fidelity)
```javascript
{
  codec: 'vp9',
  fps: 30,
  quality: 20,
  enableCompression: true,
  tags: ['forensic', 'archive']
}
// Output: 100-140 MB/hour
// Maintains maximum detail for legal proceedings
```

### OSINT Research (Balanced)
```javascript
{
  codec: 'vp9',
  fps: 24,
  quality: 32,
  enableCompression: true,
  tags: ['osint', 'research']
}
// Output: 140-180 MB/hour
// Recommended default
```

### Evidence Capture (Compliance)
```javascript
{
  codec: 'h264',
  fps: 24,
  quality: 23,
  enableCompression: true,
  tags: ['evidence', 'legal']
}
// Output: 200-280 MB/hour
// Maximum compatibility for legal systems
```

### Quick Analysis (Low Bandwidth)
```javascript
{
  codec: 'vp9',
  fps: 10,
  quality: 40,
  enableCompression: true,
  tags: ['analysis', 'preview']
}
// Output: 40-60 MB/hour
// Fast encoding, acceptable quality
```

### Long-Term Archive (Minimal Space)
```javascript
{
  codec: 'h265',
  fps: 24,
  quality: 28,
  enableCompression: true,
  tags: ['archive', 'storage']
}
// Output: 80-120 MB/hour
// Maximum compression for cold storage
```

## Codec Licensing & Patent Status

### VP8 & VP9
- **License:** Royalty-free
- **Patent Pool:** None
- **Status:** Open standard (AV1 successor)
- **Best For:** Long-term open projects

### H.264
- **License:** MPEG LA licensing pool
- **Status:** Patent protection until 2030+
- **Cost:** Royalties may apply for commercial use
- **Best For:** Enterprise/compatibility needs

### H.265
- **License:** Multiple patent pools
- **Status:** Patent protection through 2030s
- **Cost:** Licensing required for some uses
- **Best For:** Maximum compression only

## Troubleshooting

### Problem: Large File Sizes
**Solution:** Increase quality setting or use H.265
```javascript
codec: 'h265'  // 20-30% smaller files
quality: 35    // More aggressive compression
```

### Problem: Slow Encoding
**Solution:** Reduce quality or use VP8
```javascript
codec: 'vp8'   // Fastest encoding
quality: 8     // Lower quality, faster
fps: 10        // Reduce frame rate
```

### Problem: Poor Playback Compatibility
**Solution:** Switch to H.264
```javascript
codec: 'h264'  // Universal compatibility
quality: 23    // High quality
```

### Problem: Browser Playback Issues
**Solution:** Check browser support and re-export
```javascript
export_video({
  format: 'mp4',  // Universally supported
  quality: 23
})
```

## Conclusion

| Priority | Recommendation |
|----------|---|
| **Default/Recommended** | VP9 (crf=32) |
| **Speed-Critical** | VP8 (q:v=6) |
| **Universal Compat** | H.264 (crf=28) |
| **Maximum Compression** | H.265 (crf=28) |
| **Forensic Archive** | VP9 (crf=20) |

For most use cases, **VP9 with default quality (32)** provides the best balance of quality, compression, and compatibility.

---

**See Also:**
- [Video API Reference](../../archive/deprecated/VIDEO-API-REFERENCE.md)
- [Implementation Guide](../../handoffs/VIDEO-RECORDING-IMPLEMENTATION-COMPLETE.md)
- Performance Tuning Guide
