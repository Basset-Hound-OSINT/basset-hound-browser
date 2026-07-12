# FPS Optimization Quick Test Report
Date: 2026-06-22T14:45:04.671Z


## Test 1: Small Frame Compression

- Time: 4ms
- Ratio: 78.64%
- Size: 40KB

## Test 2: 720p Frame Compression

- Time: 75ms
- Ratio: 78.74%
- FPS: 13.33
- Size: 3.68MB

## Test 3: 1080p Frame Compression

- Time: 150ms
- Ratio: 78.73%
- FPS: 6.67
- Size: 8.3MB

## Test 4: Crypto ID Generation

- Time: 44ms
- Count: 10000
- Unique: 10000
- Rate: 227/ms

## Test 5: Sustained FPS (10 frames @ 720p)

- FPS: 8.05
- Average: 124.20ms
- Total: 1242ms
- Min: 107ms
- Max: 146ms

## Summary

- All compression targets: IN PROGRESS
- FPS Target (30+): IN PROGRESS
- Crypto Random: PASS
- Config: deflate(2) with 4 workers
