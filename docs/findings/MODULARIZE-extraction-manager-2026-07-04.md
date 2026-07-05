# Modularization Report — `extraction/manager.js`

**Agent:** js-dev @ `modularize-extraction-manager`
**Date:** 2026-07-04
**Plan ref:** `docs/planning/MODULARIZATION-PLAN-2026-07-04.md` §3.3
**Work zone:** `extraction/manager.js` + new `extraction/manager/` subdirectory (nothing else touched)

## Goal
Split `extraction/manager.js` (1555 lines) into modules each < 1200 lines, moving code (not
rewriting logic), while keeping the public `module.exports` surface byte-for-byte identical.

## Approach
Delegation pattern (per plan §3.3, chosen over prototype surgery to preserve `this`-binding
semantics with zero risk): each heavy per-domain method was moved verbatim into its own module as
a pure function `fn(html[, baseUrl], self)` where `self` is the manager instance (supplying shared
`BaseParser` helpers `decodeHtmlEntities`/`extractAttribute`/`hasAttribute`, plus `resolveUrl`,
`getHostname`, `stats`, and the specialized parsers). The only source transformation was
`this.` → `self.` inside the moved bodies. The class retains one-line delegating wrappers.

`extraction/manager.js` is now a thin barrel: `module.exports = require('./manager/index.js')`.
`index.js` assembles the historical export object. The parser re-exports still come from
`../parsers`, so all 6 export keys are unchanged.

## Module map

| File | Lines | Contents |
|------|------:|----------|
| `extraction/manager.js` | 12 | Thin barrel → `require('./manager/index.js')` |
| `extraction/manager/index.js` | 27 | Assembles `{ ExtractionManager, OpenGraphParser, TwitterCardParser, JsonLdParser, MicrodataParser, RdfaParser }` |
| `extraction/manager/extraction-manager.js` | 582 | Slim `ExtractionManager` class: constructor, `configureDomWait`, `detectIncompleteDom`, `resolveUrl`, `getHostname`, `getStats`, `resetStats`, `extractAll`, `extractAllWithRetry`, + delegating wrappers |
| `extraction/manager/metadata.js` | 183 | `extractMetadata` |
| `extraction/manager/links.js` | 167 | `extractLinks` |
| `extraction/manager/forms.js` | 200 | `extractForms` |
| `extraction/manager/images.js` | 200 | `extractImages`, `parseSrcset` |
| `extraction/manager/scripts.js` | 145 | `extractScripts`, `detectScriptLibrary` |
| `extraction/manager/stylesheets.js` | 154 | `extractStylesheets`, `detectCssFramework` |
| `extraction/manager/structured-data.js` | 103 | `extractStructuredData` |

Largest file: **582 lines** (`extraction-manager.js`) — all files well under the 1200 limit.
(Original was 1555 lines.)

## Verification (lightweight, no smoke:mvp)

1. **`node -c`** on every new/changed file (10 files) → all **OK**.
2. **Export keys unchanged.**
   `node -e "…require('./extraction/manager.js'); Object.keys(m).sort().join(',')"`
   → `ExtractionManager,JsonLdParser,MicrodataParser,OpenGraphParser,RdfaParser,TwitterCardParser`
   — **identical** to the pre-split baseline.
   (A `globalThis.File` shim is needed only to run `require` under Node 18.20 because
   `content-analyzer`/`form-detector` load cheerio→undici, which references a missing `File`
   global — this is a pre-existing environment quirk unrelated to this change.)
3. **Functional equivalence** — reconstructed the old manager from `git HEAD` and diffed
   `JSON.stringify` output of OLD vs NEW across **20 cases** on a rich sample page
   (`extractMetadata`, `extractLinks`, `extractForms`, `extractImages`, `extractScripts`,
   `extractStylesheets`, `extractStructuredData`, `parseSrcset`, `detectScriptLibrary`,
   `detectCssFramework`, `detectIncompleteDom`, `resolveUrl` ×2, `getHostname`,
   `configureDomWait`, `extractAll`, `getStats`, `resetStats`, `extractAllWithRetry`) →
   **ALL byte-for-byte identical.**
   (An `[ImageProcessor] this.parseAttributes is not a function` warning appears identically in
   BOTH old and new during `extractAll` — a pre-existing bug in `ImageProcessor`, out of scope,
   not a regression.)
4. **ESLint** (`npx eslint`) → **0 errors, 5 warnings**, all carried over verbatim from the
   original (3× `no-console`, unused `property` in the meta loop, unused `waitTime` destructure in
   `extractAllWithRetry`). No new warnings introduced.
5. **Consumer check** — `extraction/index.js` still resolves all 6 manager exports and
   `new ExtractionManager()` instantiates with working methods.

## Notes / caveats
- `resetStats()` intentionally left as-is: it resets only 8 of the 10 stat keys (omits
  `retriesPerformed`, `incompleteDOMDetections`), exactly matching the original — preserved to
  avoid changing behavior.
- Did **not** touch `extraction/image-metadata-extractor.js` (owned by another agent). It appears
  modified in `git status` due to that concurrent agent, not this work.
- No commits made.
