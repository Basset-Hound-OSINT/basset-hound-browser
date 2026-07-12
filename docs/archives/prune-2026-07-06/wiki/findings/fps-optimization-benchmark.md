# FPS Optimization Benchmark Report
Generated: 2026-06-22T14:40:10.111Z

## Benchmark 1: Single Frame Compression

**Single Frame Compression Time:** 192ms
**Compression Ratio:** 78.73%
**Original Size:** 7.91MB
**Compressed Size:** 1.68MB
**FPS Equivalent:** 5.21 fps
**Target Achievement:** ❌ FAIL
## Benchmark 2: Batch vs Sequential Processing

**Sequential Processing (4 frames):** 676ms
**Batch Processing (4 frames):** 223ms
**Speedup:** 3.03x
**Performance Gain:** 67.0%
**Target Achievement:** ✅ PASS
## Benchmark 3: Worker Pool Efficiency

**Concurrent Frames:** 8
**Total Duration:** 251ms
**Average per Frame:** 31.38ms
**Worker Success Rate:** 100%
**Completed Tasks:** 8/8
**Target Achievement:** ✅ PASS
## Benchmark 4: Sustained FPS Test

**Frames Processed:** 30
**Total Duration:** 8628ms
**FPS Achieved:** 3.48
**Average Frame Time:** 287.60ms
**Min Frame Time:** 259.00ms
**Max Frame Time:** 340.00ms
**Jitter (Max-Min):** 81.00ms
**Target Achievement:** ❌ FAIL
## Benchmark 5: Frame Size Variations

| Resolution | Time | FPS | Compression Ratio |
|---|---|---|---|
| QVGA (320x240) | 41ms | 24.39 fps | 78.73% |
| VGA (640x480) | 56ms | 17.86 fps | 78.74% |
| 720p (1280x720) | 70ms | 14.29 fps | 78.73% |
| 1080p (1920x1080) | 145ms | 6.90 fps | 78.74% |
## Benchmark 6: Memory Efficiency

**Pool Acquisitions:** 10
**Pool Reuses:** 10
**Direct Allocations:** 10
**Pool Hit Rate:** 44.4%
**Memory Efficiency:** ✅ PASS
## Summary

- Test Date: 2026-06-22T14:40:23.523Z
- Target FPS: 30+
- Frame Size: 1920x1080 RGBA (8.3MB)
- Compression Strategy: Deflate(2) with worker parallelization
- Workers: 4