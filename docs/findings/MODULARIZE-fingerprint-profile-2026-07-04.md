# Modularize `evasion/fingerprint-profile.js` — Report

**Agent:** js-dev@basset-hound-browser:modularize-fingerprint-profile
**Date:** 2026-07-04
**Plan reference:** `docs/planning/MODULARIZATION-PLAN-2026-07-04.md` §3.7
**Work zone:** `evasion/fingerprint-profile.js` + new `evasion/fingerprint-profile/` subdir (nothing else touched)

## Result

`evasion/fingerprint-profile.js` (1278 lines) split into a thin barrel + 4 sibling modules.
Every resulting file is well under the 1200-line cap. `module.exports` shape is byte-for-byte
identical to baseline. Code was **moved, not rewritten** — no logic changes.

## Module map

| File | Lines | Contents |
|------|------:|----------|
| `evasion/fingerprint-profile.js` (barrel) | 43 | Re-exports all 12 names from the modules below. |
| `evasion/fingerprint-profile/configs.js` | 277 | The 10 config consts: `PLATFORM_CONFIGS`, `CHROME_VERSIONS`, `SCREEN_CONFIGS`, `TIMEZONE_CONFIGS`, `HARDWARE_CONFIGS`, `CANVAS_NOISE_CONFIGS`, `WEBGL_NOISE_CONFIGS`, `AUDIO_NOISE_CONFIGS`, `FONT_EVASION_CONFIGS`, `COMMON_DECOY_FONTS`. |
| `evasion/fingerprint-profile/injection-script.js` | 357 | `buildInjectionScript(config)` — the ~346-line injection template string extracted verbatim. |
| `evasion/fingerprint-profile/fingerprint-profile.js` | 450 | `FingerprintProfile` class (requires `configs` + `injection-script`). `getInjectionScript()` delegates to `buildInjectionScript(this.getConfig())`. |
| `evasion/fingerprint-profile/profile-manager.js` | 243 | `FingerprintProfileManager` class (requires `FingerprintProfile`). |

All 5 files `< 1200` lines (largest = 450). Total 1370 lines (up from 1278 due to per-module
headers/require blocks/re-declared module.exports — no logic added).

## Verification

**Syntax gate** — `node -c` on all 5 files: **all OK.**

**Export-key gate** — `Object.keys(require('./evasion/fingerprint-profile.js')).sort().join(',')`:

```
AUDIO_NOISE_CONFIGS,CANVAS_NOISE_CONFIGS,CHROME_VERSIONS,COMMON_DECOY_FONTS,FONT_EVASION_CONFIGS,FingerprintProfile,FingerprintProfileManager,HARDWARE_CONFIGS,PLATFORM_CONFIGS,SCREEN_CONFIGS,TIMEZONE_CONFIGS,WEBGL_NOISE_CONFIGS
```

**Identical** to the pre-split baseline (12 keys).

**Behavior parity vs git HEAD baseline** (extra check, 5 fixed seeds `abc123`, `deadbeef`,
`0000`, `zzz`, `region-test`):
- `getConfig()` JSON — identical
- `getInjectionScript()` — **byte-for-byte identical** (lengths 17255–17318 chars matched exactly)
- `validate()` — identical
- `toJSON()` — identical
- `forRegion('EU', {seed})` config — identical
- All 10 exported config consts — deep-equal (`JSON.stringify` match)
- `FingerprintProfileManager` caching (`createProfile`/`getCachedConfig`/`getCachedInjectionScript`/`getCacheStats`) — works, stats consistent

**eslint** — 0 errors, 2 warnings, both **pre-existing** (moved verbatim from the original
`createProfile`/`_addToCache`): `no-shadow` on `id` and unused `id` param in `_addToCache`.
No new lint issues introduced.

## Notes
- The barrel imports the config consts from `./fingerprint-profile/configs` and re-exports the
  *same object references* the class module uses (single `require` cache), so `PLATFORM_CONFIGS`
  etc. are identity-equal across barrel and class.
- `getInjectionScript()` template extracted as a pure `buildInjectionScript(config)` fn taking the
  already-computed config; the class method retains its `const config = this.getConfig();` step
  then delegates, so the produced string is unchanged.
- No commits made (per work-zone constraints). smoke:mvp intentionally NOT run (lightweight gate only).
