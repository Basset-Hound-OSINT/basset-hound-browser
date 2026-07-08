# Home-dir cleanup — stray basset-hound-browser files (2026-07-06)

Swept `~/` (`/home/devel/`) for stray files belonging to the **browser** project,
collected them in `temp_mess/`, triaged each (using the docs-RAG to check
coverage), and pruned. `temp_mess/` deleted afterward.

## Moved in + triaged (all PRUNED)
- **31 `bhb-*` files/dirs** (bhb = basset hound browser): ephemeral debugging
  scratch from the "get the browser working" sessions — boot/drive harnesses
  (superseded by `scripts/smoke-mvp.js`), grep/scan outputs, env/disk/arch notes,
  RAG-setup logs (`bhb-ragup.txt`, `bhb-ragdoctor.txt`), a broken-require scan,
  `bhb-ingest/` (RAG ingest poll). Conclusions already live in the committed code
  + docs → pruned.
- **`PHASE3-LOW-PRIORITY-SPECS.md`** (87K, "SPECIFICATION — Not Yet Implemented",
  2026-06-20): specs L-001 CSS-injection validation, L-002 export rate-limiter,
  L-003 export integrity. **Superseded** — all three files exist in the repo
  (`src/dom/css-validator.js`, `src/security/export-rate-limiter.js`,
  `src/security/export-integrity.js`) and are documented
  (`docs/L-001-DELIVERY-REPORT.md`, `docs/L-001-IMPLEMENTATION-SUMMARY.md`,
  `docs/security/EXPORT-RATE-LIMITER-CONFIG.md`). Stale status → pruned.

## Left UNTOUCHED (not browser strays)
- Separate Basset-Hound-OSINT git repos: **`~/basset-hound`** (OSINT platform,
  392M), **`~/basset-mobile`** (71M), **`~/basset-verify`** (71M) — their own
  projects, not this browser.
- `~/.basset` (basset-mobile keystore), `~/.basset-hound` (empty dirs).
- Generic host files (`clone_all.sh`, `host_resource_monitor.*`, `monitor_gc.sh`,
  `save_progress.sh`, `storage_visualization.tex`, `CLAUDE_CODE_SETUP.md`) — no
  basset content.

## Result
`~/` no longer holds browser debug clutter. No docs needed merging (all strays
were ephemeral or superseded). Repo unchanged except this record.
