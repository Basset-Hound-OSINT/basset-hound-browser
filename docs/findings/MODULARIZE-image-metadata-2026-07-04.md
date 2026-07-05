# Modularization — `extraction/image-metadata-extractor.js`

**Agent:** js-dev@basset-hound-browser:modularize-image-metadata
**Date:** 2026-07-04
**Plan reference:** `docs/planning/MODULARIZATION-PLAN-2026-07-04.md` §3.6
**Work zone:** `extraction/image-metadata-extractor.js` + new `extraction/image-metadata/` (nothing else touched)

## Goal

Split the 1475-line `extraction/image-metadata-extractor.js` (single class
`ImageMetadataExtractor` + 2 consts + factory) so every source file is < 1200 lines, while keeping
the original path's `module.exports` shape byte-identical. Code was **moved, not rewritten** — no
logic changes.

## Approach

The whole file is one 1390-line class (`extends BaseParser`). A single class can't be a pure barrel,
so cohesive method clusters were extracted into sibling modules that export **plain objects of
functions**, then mixed onto the class prototype with `Object.assign` in the core file. `this`
binding is preserved because the functions become real prototype methods (private `_`-prefixed
methods are just convention in JS, so the mixin is transparent). The original path is now a **thin
barrel** re-exporting the same 4 names.

## Module map

| File | Lines | Contents |
|------|------:|----------|
| `extraction/image-metadata-extractor.js` (barrel) | 33 | Re-exports `{ ImageMetadataExtractor, createImageExtractor, DEFAULT_OPTIONS, IMAGE_ORPHAN_MAPPINGS }` from the two modules below. |
| `extraction/image-metadata/constants.js` | 56 | `DEFAULT_OPTIONS`, `IMAGE_ORPHAN_MAPPINGS`. |
| `extraction/image-metadata/lazy-loaders.js` | 107 | Prototype mixin: `_loadExifr`, `_loadExifReader`, `_loadTesseract`, `_loadSharp`, `_loadJimp`. |
| `extraction/image-metadata/exif-normalizers.js` | 248 | Prototype mixin: `_extractExifWithExifr`, `_normalizeExif`, `_extractGps`, `_extractWithExifReader`, `_normalizeIptc`, `_normalizeXmp`, `_normalizeArray`. |
| `extraction/image-metadata/osint-extractors.js` | 202 | Prototype mixin: `_extractOsintFromText`, `_extractOsintFromMetadata`, `generateOrphanData` (public). |
| `extraction/image-metadata/webcontents-capture.js` | 446 | Prototype mixin: `captureCanvasElements`, `extractSVGElements`, `extractFaviconAndOGImages`. |
| `extraction/image-metadata/extractor.js` | 509 | Core class: constructor, `extract` orchestration, image ops (`_extractThumbnail`, `_getDimensions`, `_generatePerceptualHash`, `_extractText`, `_detectFaces`), `_getSourceInfo`, `cleanup`, `getStats`; `Object.assign` of the 4 mixins; `createImageExtractor` factory. |

Largest file is now `extractor.js` at **509 lines** — all well under the 1200 cap.

Notes:
- `require('./parsers')` in the original became `require('../parsers')` in `extractor.js` (moved one
  level deeper); resolves to `extraction/parsers.js`.
- `constants.js`, the 4 mixins, and `extractor.js` are **side-effect-free at import** (only define
  and export).

## Verification (lightweight — no smoke:mvp, per task)

**`node -c` — all 7 files parse OK:**
```
OK  extraction/image-metadata-extractor.js
OK  extraction/image-metadata/constants.js
OK  extraction/image-metadata/lazy-loaders.js
OK  extraction/image-metadata/exif-normalizers.js
OK  extraction/image-metadata/osint-extractors.js
OK  extraction/image-metadata/webcontents-capture.js
OK  extraction/image-metadata/extractor.js
```

**Export keys — identical to baseline:**
```
baseline: DEFAULT_OPTIONS,IMAGE_ORPHAN_MAPPINGS,ImageMetadataExtractor,createImageExtractor
current:  DEFAULT_OPTIONS,IMAGE_ORPHAN_MAPPINGS,ImageMetadataExtractor,createImageExtractor
```

**Functional smoke** (`node -e`): `createImageExtractor()` instance passes `instanceof
ImageMetadataExtractor`; all 27 expected methods (own class + all 4 mixins) present on the instance;
pure methods behave as before (`_getSourceInfo`, `_normalizeExif(null)`, `_extractOsintFromText`,
`generateOrphanData`, `getStats`) and const values intact (`DEFAULT_OPTIONS.chunkSize=65536`,
`IMAGE_ORPHAN_MAPPINGS.author='person'`).

**ESLint:** 2 findings (1 error `no-useless-escape` on the URL regex `\[`; 1 warning `no-unused-vars`
on `input` in `_detectFaces`). **Both are pre-existing, moved verbatim** — confirmed by linting the
HEAD version of the original file (same 2 findings at original lines 815 and 767). **No new lint
problems introduced.**

**Unit test** (`tests/unit/image-metadata-extractor.test.js`): identical result before and after the
split — **41 passed / 24 failed / 65 total** in both. The 24 failures are pre-existing and unrelated:
they come from a `cheerio`→`undici` require-time crash flowing through `extraction/manager/` (another
agent's concurrent in-progress split), not from this module. Split is behavior-neutral for this
suite.

## Summary

`extraction/image-metadata-extractor.js` split into a 33-line barrel + 6 modules under
`extraction/image-metadata/`, each < 1200 lines (max 509). `module.exports` shape unchanged
(`ImageMetadataExtractor, createImageExtractor, DEFAULT_OPTIONS, IMAGE_ORPHAN_MAPPINGS`). Logic moved,
not rewritten. Consumers (`extraction/index.js`, `tests/unit/image-metadata-extractor.test.js`)
unaffected — both destructure the same 4 keys from the barrel. No commits made.
