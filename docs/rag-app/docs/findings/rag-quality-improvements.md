# RAG Quality Improvements

Investigation and fixes for search quality issues with FAA aviation documentation.

## Problem

Queries for specific aviation acronyms and terms returned irrelevant results:
- "what is a TAC?" → no relevant results (all similarity ~0.011)
- "TRAJECTORY ALTERING CLEARANCE" → wrong chunks returned
- "what is ATIS?" → no definition found

The correct definitions existed in the ingested PCG (Pilot/Controller Glossary) but were never surfaced by the search pipeline.

## Root Cause Analysis

### 1. PostgreSQL `english` text search stems acronyms

The `english` text search configuration applies stemming (Porter algorithm), which mangles short uppercase tokens. For example, `plainto_tsquery('english', 'TAC')` produces a stemmed form that doesn't match the original "TAC" in document text. This is a known limitation when indexing technical/domain-specific acronyms.

### 2. Semantic embeddings poorly encode short acronyms

nomic-embed-text (768d) produces low-quality embeddings for 2-4 character uppercase tokens like "TAC", "ATIS", "NOTAM". The semantic similarity between `embed("what is a TAC?")` and the chunk containing the TAC definition was ~0.31-0.35 (well below useful threshold), while unrelated chunks scored 0.64-0.69.

### 3. RRF fusion amplified semantic noise

With `semantic_weight=0.7` (default), irrelevant semantic results overwhelmed the few correct keyword results in Reciprocal Rank Fusion, pushing correct matches out of the top-k.

## Fixes Implemented

### Fix 1: Dual keyword search (english + simple)

**File:** `app/search.py` — `keyword_search()`

Added a second pass using PostgreSQL's `simple` text search configuration, which preserves exact tokens without stemming. Results from both configs are merged, with a 1.2x boost for chunks matching both.

```python
# 'simple' config preserves acronyms exactly
ts_query_simple = func.plainto_tsquery("simple", query)
ts_vector_simple = func.to_tsvector("simple", Chunk.content)
```

This ensures "TAC" matches chunks containing the literal string "TAC" regardless of stemming.

### Fix 2: Adaptive semantic weight

**File:** `app/search.py` — `_adaptive_semantic_weight()`

Instead of a fixed 0.7 semantic weight, the weight adapts based on query characteristics:

| Query Type | Example | Semantic Weight |
|---|---|---|
| Short acronym (1-2 words, >50% uppercase) | "TAC", "ATIS NOTAM" | 0.2 |
| Query containing any acronym (2-6 char uppercase) | "what is a TAC?", "define ATIS" | 0.3 |
| Short natural language (≤4 words) | "runway separation" | 0.5 |
| Long natural language (>4 words) | "what are the wake turbulence categories" | 0.7 |

The `_has_acronym()` helper detects uppercase tokens 2-6 characters long, handling trailing punctuation (e.g., "TAC?" → "TAC").

### Fix 3: Increased fetch multiplier

**File:** `app/search.py` — `hybrid_search()`

Changed candidate fetch from `limit * 3` to `limit * 5`, giving RRF more candidates to fuse and reducing the chance of correct keyword results falling outside the fetch window.

### Fix 4: OR-based keyword matching with stop word filtering

**File:** `app/search.py` — `_build_or_tsquery()`

`plainto_tsquery` creates AND queries — ALL terms must appear in a chunk. This works for short acronym queries but fails for natural language like "what happens when GPS is unreliable?" where stop words ("what", "is", "when") don't appear in glossary-style definitions.

Changed the `simple` text search config to use OR-based matching via `to_tsquery('simple', 'happens | GPS | unreliable')`. Common English stop words are stripped before building the OR query, so `ts_rank` naturally ranks chunks with the meaningful content words ("GPS", "unreliable") higher.

The `english` config still uses AND matching (`plainto_tsquery`), which is appropriate for its stemmed tokens.

## Results

### Baseline (before fixes): 0% on acronym queries
### After fixes 1-3: 81% pass rate (17/21)
### After fix 4: 95% pass rate (20/21)

The only remaining failure is the deliberate semantic-only test for "TAC" — this validates that pure semantic search cannot handle short acronyms, confirming the need for hybrid search.

| Query | Before | After |
|---|---|---|
| "what is a TAC?" | No relevant results | TAC definition in top 5, correct LLM answer |
| "TRAJECTORY ALTERING CLEARANCE" | Wrong chunks | Definition chunk at position 3 |
| "what is ATIS?" | No definition | Full ATIS definition, correct LLM answer |
| "what does NOTAM stand for?" | No results | NOTAM-related content found |
| "what happens when GPS is unreliable?" | No results | UNRELIABLE (GPS/WAAS) definition found |

Full test suite: `tests/test_search_quality.py` (21 test cases across 5 categories).

### Fix 5: Acronym expansion table (query-time)

**Files:** `app/search.py` — `expand_acronyms()`, `app/acronyms.json`, `scripts/extract_acronyms.py`

Built a 304-entry lookup table mapping aviation acronyms to their full terms, extracted from the ingested PCG chunks. The extraction script (`scripts/extract_acronyms.py`) uses three regex patterns to parse PCG entry formats:

1. Cross-references: `AAM− (See ADVANCED AIR MOBILITY.)` → AAM: ADVANCED AIR MOBILITY
2. Parenthetical definitions: `AUTOMATIC TERMINAL INFORMATION SERVICE (ATIS)−` → ATIS: AUTOMATIC TERMINAL INFORMATION SERVICE
3. ICAO cross-references: `ACC [ICAO]− (See ICAO term AREA CONTROL CENTER.)`

Priority: Pattern 1 first-match wins, Pattern 2 only adds new entries (longest match preferred to avoid chunk-boundary truncation), Pattern 3 only adds entries missing from both.

At query time, `expand_acronyms()` appends the full term to queries containing recognized acronyms:
- `"what is a TAC?"` → `"what is a TAC? TRAJECTORY ALTERING CLEARANCE"`
- `"ATIS and NOTAM"` → `"ATIS and NOTAM AUTOMATIC TERMINAL INFORMATION SERVICE NOTICE TO AIRMEN"`

The expanded query is used only for **semantic search** (richer embeddings). Keyword search uses the original query since exact acronym matching already works well there.

## Results

### Baseline (before fixes): 0% on acronym queries
### After fixes 1-3: 81% pass rate (17/21)
### After fix 4: 95% pass rate (20/21)
### After fix 5: 95% pass rate (20/21) — maintained, with improved semantic retrieval

Fix 5 does not change the pass/fail count (already at 95%) but improves semantic ranking for acronym queries. The expanded full-term embedding produces better cosine similarity scores against definition chunks.

The only remaining failure is the deliberate semantic-only test for "TAC" — this validates that pure semantic search cannot handle short acronyms even with expansion, confirming the need for hybrid search.

| Query | Before | After |
|---|---|---|
| "what is a TAC?" | No relevant results | TAC definition in top 5, correct LLM answer |
| "TRAJECTORY ALTERING CLEARANCE" | Wrong chunks | Definition chunk at position 3 |
| "what is ATIS?" | No definition | Full ATIS definition, correct LLM answer |
| "what does NOTAM stand for?" | No results | NOTAM-related content found |
| "what happens when GPS is unreliable?" | No results | UNRELIABLE (GPS/WAAS) definition found |

Full test suite: `tests/test_search_quality.py` (21 test cases across 5 categories).
Unit tests: `tests/test_search.py` (29 tests covering RRF, adaptive weights, OR queries, acronym expansion).

### Multi-Document Regression (Session 9)

Adding JO 7110.65BB (1,523 chunks) and JO 7210.3EE (1,054 chunks) to the index caused
quality to drop from 95% (PCG-only) to **62% (13/21)** with the full corpus (2,889 chunks).

| Query | PCG-only | Multi-doc | Root Cause |
|---|---|---|---|
| what is ARTCC? | PASS | **FAIL** | JO 7210.3 references ARTCC operations extensively; NOT in top 15 |
| PIREP | PASS | **FAIL** | JO weather reporting text outranks PCG definition; found at rank 6 |
| what is a SID? | PASS | **FAIL** | JO 7110.65 has extensive SID procedures; NOT in top 15 |
| trajectory altering clearance? | PASS | **FAIL** | JO clearance text outranks PCG definition; NOT in top 15 |
| GPS unreliable? | PASS | **FAIL** | AIM/JO GPS content at ranks 1-5; PCG at rank 5 (borderline) |
| TAC (keyword) | PASS | **FAIL** | "TAC" is too short for keyword in 2,889 chunks |
| TAC (semantic) | FAIL | FAIL | Expected failure — short acronyms vs semantic search |
| TAC (hybrid) | PASS | **FAIL** | JO content mentioning tactical operations outranks PCG definition |

**Pattern**: JO operational text that *discusses* terms in context outranks PCG glossary
*definitions* of those terms, because: (a) JO has ~8x more chunks than PCG, (b) semantic
similarity between "what is X?" and JO text about X operations is high, and (c) keyword
matching finds many JO chunks mentioning the same term.

**Immediate mitigations**:
- Increase top_k from 5 to 10 — would rescue PIREP (rank 6) and GPS (rank 5 borderline)
- Not sufficient for ARTCC, SID, trajectory (not in top 15)

**Required improvements** (midterm roadmap):
- Structure-aware chunking for PCG glossary entries (shorter, more focused chunks)
- Cross-encoder reranking to prefer definitional content over passing mentions
- Document-type boosting (glossary sources weighted higher for definition queries)
- Contextual chunk headers for PCG (prepend "PILOT/CONTROLLER GLOSSARY - " to each chunk)

## Future Improvements

1. **Structure-aware chunking** — Parse glossary entries as individual chunks instead of fixed-size windows. A PCG entry like "TRAJECTORY ALTERING CLEARANCE (TAC)– A clearance that..." should be one chunk.

2. **Cross-encoder reranking** — Add a reranking stage after RRF fusion using a cross-encoder model to score (query, chunk) pairs more accurately than bi-encoder similarity.

3. **Contextual chunk headers** — Prepend document section/chapter context to each chunk before embedding (Anthropic-style contextual retrieval). This improves embedding quality for chunks that start mid-paragraph.

4. **Document-type boosting** — Weight results from glossary/definition sources higher for definition-style queries. Detect query intent ("what is X?", "define X") and boost PCG/glossary chunks.

5. **Increase default top_k** — Quick win: increase from 5 to 10 for broader result coverage at minor cost to latency. Rescues borderline results pushed to rank 6-10 by high-volume operational documents.
