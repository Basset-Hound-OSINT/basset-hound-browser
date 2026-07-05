---
title: "Obscura Deep-Dive: obscura-dom (DOM tree, HTML5 parsing, CSS selectors)"
date: 2026-07-03
researcher: Claude (Basset Hound architecture research)
status: Complete
category: reverse-engineering / architecture-comparison
---

# obscura-dom

Reverse-engineering deep-dive of the `obscura-dom` crate in the Apache-2.0 headless
browser **Obscura** (https://github.com/h4ckf0r0day/obscura). Source read on disk at
`/home/devel/tmp/obscura`, crate at `crates/obscura-dom` (git `ca71ce3`, 2026-07-03).

All claims below cite specific files and line numbers. Where the code contradicts the
crate's own name or the research brief's assumptions, I call it out explicitly.

---

## 1. Purpose & scope

`obscura-dom` is Obscura's server-side DOM. It has exactly three jobs:

1. **Parse HTML5** into a tree, by implementing `html5ever`'s `TreeSink` trait so the
   standard tokenizer/tree-builder writes directly into Obscura's own node storage
   (`src/tree_sink.rs`).
2. **Represent and mutate the tree** — an arena of nodes addressed by integer IDs, with
   sibling/parent link fix-ups for append/insert/remove (`src/tree.rs`).
3. **Match CSS selectors** against that tree by implementing the Servo `selectors`
   crate's `Element` trait, plus serialize the tree back to HTML (`src/selector.rs`,
   `src/serialize.rs`).

It is a **library crate with no `main`, no async, no I/O, no networking**. The whole
public surface is re-exported from a 10-line `lib.rs`:

```rust
// crates/obscura-dom/src/lib.rs:1-11
#[macro_use]
extern crate html5ever;
pub mod tree;
pub mod tree_sink;
pub mod selector;
pub mod serialize;
pub use tree::{Attribute, DomTree, Node, NodeData, NodeId};
pub use tree_sink::{parse_html, parse_fragment};
```

Total size is small: **2,246 lines across 5 files** (`tree.rs` 936, `selector.rs` 789,
`tree_sink.rs` 323, `serialize.rs` 188, `lib.rs` 10), much of it inline `#[cfg(test)]`
unit tests.

Per the architecture overview, this crate sits in the middle of the navigation flow:
`obscura-net` fetches HTML → `obscura-dom` parses it into the tree → `obscura-js` runs
scripts that mutate the tree through `op_dom`
(`docs/Architecture-overview.md:31-40`).

---

## 2. Data model: an arena of `Vec<Option<Node>>` indexed by `NodeId(u32)`

The single most important design fact — and one that contradicts the "arc model" framing
in the research brief — is that **nodes are NOT reference-counted `Arc` cells**. They live
in a flat vector owned by one `DomTree`, addressed by a 32-bit index:

```rust
// crates/obscura-dom/src/tree.rs:6-7
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct NodeId(pub(crate) u32);

// crates/obscura-dom/src/tree.rs:137-146
pub struct DomTree {
    inner: RefCell<DomTreeInner>,
}
pub(crate) struct DomTreeInner {
    pub(crate) nodes: Vec<Option<Node>>,
    pub(crate) free_list: Vec<u32>,
    pub(crate) document: NodeId,
    pub(crate) id_index: HashMap<String, NodeId>,
}
```

- **`nodes: Vec<Option<Node>>`** — the arena. A slot is `None` when the node has been
  freed. Index `0` is always the `Document` node, created in `DomTree::new`
  (`tree.rs:149-167`).
- **`free_list: Vec<u32>`** — freed slots for reuse. `new_node` pops a free slot before
  growing the vector (`tree.rs:177-206`), so IDs are recycled after `remove`.
- **`id_index: HashMap<String, NodeId>`** — a best-effort `id`-attribute → node lookup
  for `getElementById` / `#id` fast paths.
- **Interior mutability via a single `RefCell`** — the entire tree is behind
  `RefCell<DomTreeInner>`, not per-node locks. Every method borrows the whole inner
  struct. Note the exact trait consequence: `RefCell<T>` makes a type `!Sync` (**not**
  `!Send`); `RefCell<T>` is `Send` whenever `T: Send`. Every field of `DomTreeInner`
  (`Vec<Option<Node>>`, `free_list`, `NodeId`, the `HashMap`, and the
  html5ever/`string_cache` atoms inside `QualName`) is `Send`, so `DomTree` itself is
  **`Send + !Sync`**. This single coarse lock is a deliberately single-threaded design
  that matches Obscura's single V8 isolate (`docs/Architecture-overview.md:44-57`). The
  runtime DOM does end up effectively `!Send` in practice — but because it is held inside
  `SharedState = Rc<RefCell<ObscuraState>>` (`crates/obscura-js/src/ops.rs:121`) and `Rc`
  is `!Send`, not because of `DomTree`'s `RefCell`.

Each `Node` is an explicit intrusive doubly-linked-list node — parent, first/last child,
prev/next sibling are all `Option<NodeId>`, not pointers:

```rust
// crates/obscura-dom/src/tree.rs:61-70
pub struct Node {
    pub id: NodeId,
    pub parent: Option<NodeId>,
    pub first_child: Option<NodeId>,
    pub last_child: Option<NodeId>,
    pub prev_sibling: Option<NodeId>,
    pub next_sibling: Option<NodeId>,
    pub data: NodeData,
}
```

`NodeData` is the discriminated union of node kinds — the six that html5ever can emit
(`tree.rs:35-59`): `Document`, `Doctype`, `Element { name: QualName, attrs, template_contents, mathml_annotation_xml_integration_point }`,
`Text`, `Comment`, `ProcessingInstruction`. Attributes are a plain
`Vec<Attribute>` where `Attribute { name: QualName, value: String }` (`tree.rs:29-33`) —
a linear scan, not a map (`get_attribute` iterates, `tree.rs:106-114`).

### `servo_arc` and `markup5ever` are declared but unused in the crate's own source

`Cargo.toml` lists `servo_arc` and `markup5ever` as dependencies, but **neither appears
anywhere in `src/`**. A grep for `servo_arc`/`markup5ever` in the crate returns nothing;
the only `Arc` in the crate is `std::sync::Arc` used to cache parsed selectors
(`selector.rs:522, 540`). `servo_arc` is pulled in transitively by the `selectors` stack,
and the `ns!`/`local_name!` macros come from html5ever's re-export of markup5ever via
`#[macro_use] extern crate html5ever` (`lib.rs:1-2`). **There is no Arc-based node
sharing** — the "arc model" is a Vec-arena model.

---

## 3. HTML5 parsing: implementing `html5ever::TreeSink`

`obscura-dom` does not write its own tokenizer or tree-construction algorithm. It relies
entirely on `html5ever` 0.29 (`Cargo.toml`; workspace pin `Cargo.toml:28`) and only
supplies the *sink* — the object html5ever calls to build nodes. `DomTree` implements
`TreeSink` directly:

```rust
// crates/obscura-dom/src/tree_sink.rs:33-37
impl TreeSink for DomTree {
    type Handle = NodeId;
    type Output = Self;
    type ElemName<'a> = ObscuraElemName<'a>;
```

The handle type is `NodeId` (a `Copy` u32), so html5ever passes cheap integer handles
around rather than `Rc<RefCell<Node>>`. The two entry points are thin wrappers over
html5ever's driver:

```rust
// crates/obscura-dom/src/tree_sink.rs:235-254
pub fn parse_html(html: &str) -> DomTree {
    let tree = DomTree::new();
    parse_document(tree, ParseOpts::default())
        .from_utf8()
        .one(html.as_bytes())
}
pub fn parse_fragment(html: &str) -> DomTree {
    let context_name = QualName::new(None, ns!(html), local_name!("body"));
    let tree = DomTree::new();
    parse_fragment(tree, ParseOpts::default(), context_name, vec![])
        .from_utf8()
        .one(html.as_bytes())
}
```

Notable `TreeSink` implementation details:

- **`create_element`** (`tree_sink.rs:64-95`) converts html5ever `Attribute`s (whose
  values are `Tendril`s) into owned `String`s, and — for `<template>` — eagerly creates a
  separate `Document` node as the template's `template_contents` (`tree_sink.rs:85-92`).
- **`ObscuraElemName`** (`tree_sink.rs:11-31`) is an `unsafe` wrapper holding a
  `*const QualName` plus a `Ref<'a, ()>` guard, so html5ever can borrow an element's
  qualified name without cloning while the `RefCell` stays borrowed. This is one of only
  two `unsafe` spots in the crate (`elem_name`, `tree_sink.rs:48-62`, dereferences the raw
  pointer; it `panic!`s if called on a non-element or invalid node — see §8).
- **Text coalescing on parse**: `append` with `AppendText` routes to `append_text`
  (`tree_sink.rs:110-119`), which merges into the previous text sibling instead of
  creating adjacent text nodes (`tree.rs:596-633`). `append_before_sibling` does the same
  merge for text inserted before a reference node (`tree_sink.rs:177-206`).
- **`parse_error` is a no-op** (`tree_sink.rs:42`) — parse errors are silently swallowed,
  and **`set_quirks_mode` is a no-op** (`tree_sink.rs:221-222`): the quirks mode html5ever
  computes from the doctype is discarded, and selector matching later hard-codes
  `QuirksMode::NoQuirks` (see §5). So quirks-mode-dependent behavior is not modeled.
- **`add_attrs_if_missing`, `reparent_children`, `get_template_contents`,
  `is_mathml_annotation_xml_integration_point`, `same_node`** are all implemented, so the
  full adoption-agency / foster-parenting / template machinery of html5ever works
  (`tree_sink.rs:150-232`). The tests exercise malformed HTML, doctype, and fragment
  parsing (`tree_sink.rs:299-322`).

---

## 4. Tree mutation & the cyclic-reparent hardening

The mutation API is the arena-linked-list plumbing in `tree.rs`. The interesting part is
that **a large fraction of this code exists to defend against cycles that would hang the
engine**, because none of the tree-walk functions carry a visited-set.

### `append_child` (`tree.rs:228-297`)

Two guards run before the linked-list fix-up:

1. **Self-append is a no-op** (`tree.rs:234-236`): `append_child(x, x)` would set `x`'s
   `prev_sibling` to itself and loop every later child-walk forever.
2. **Ancestor-cycle rejection** (`tree.rs:246-270`): appending an ancestor of the parent
   under that parent would make the graph cyclic. The guard walks up from the parent
   looking for the child; per the DOM spec this is a `HierarchyRequestError`, treated here
   as a no-op. Critically it is **gated on the child already having children**
   (`child_has_children`, `tree.rs:248-252`) so the common append of a fresh leaf stays
   O(1); the ancestor walk is O(depth) only when relocating a populated subtree. There is
   also a `steps > nodes.len()` circuit-breaker against pre-existing corruption
   (`tree.rs:262-264`).

After guards, it `detach`es the child, then splices it as the new last child
(`tree.rs:271-296`).

### `insert_before` (`tree.rs:299-378`)

Symmetric guards (self-insert `tree.rs:306-308`, ancestor cycle `tree.rs:322-344`). One
subtle correctness fix is documented in-code: the reference node's `prev_sibling` is
**re-read *after* detaching the new node** (`tree.rs:352-357`), because if the new node
was the reference's immediate previous sibling, a pre-detach `prev_id` would splice
`next_sibling = self` — "this is what hung ebay.com" (`tree.rs:349-351`). There is a
regression test for exactly this reorder (`test_insert_before_previous_sibling_no_cycle`,
`tree.rs:876-905`).

### `detach` / `remove_child` / `remove` (`tree.rs:380-478`)

Three levels of removal with different id-index and freeing semantics:

- **`detach`** (`tree.rs:380-413`) — unlink from siblings/parent only; the node stays in
  the arena and keeps its data.
- **`remove_child`** (`tree.rs:419-447`) — detach **and** purge the subtree's `id`s from
  `id_index` so `getElementById` stops returning them, **but does not free** the nodes
  (JS wrappers may still reference them). It snapshots ids *before* detaching so
  `get_attribute` can still see the tree (`tree.rs:422-439`).
- **`remove`** (`tree.rs:449-478`) — detach, purge ids, then null every descendant slot
  and push it onto the `free_list` for reuse (`tree.rs:472-477`).

### Traversal helpers with cycle circuit-breakers

`children` (`tree.rs:480-493`), `descendants` (`tree.rs:495-554`), and `ancestors`
(`tree.rs:556-569`) are the read walks. `descendants` is an explicit-stack pre-order walk
that pushes children in reverse for correct order, and it carries **two independent
`len() > nodes.len()` caps** (sibling-chain cap `tree.rs:506-509, 540-543`; descendant cap
`tree.rs:525-532`) that `eprintln!` and bail on a detected cycle rather than looping
forever. The comment is explicit that on a valid tree these bounds are never reached
(`tree.rs:520-524`). This matters because `query_selector*` scans `descendants`, and the
whole thread would be pinned in native Rust where "neither tokio nor the V8 watchdog can
interrupt it" (`tree.rs:239-245`).

### Other mutation helpers

- **`append_text`** (`tree.rs:596-633`) — coalesces adjacent text nodes; guards against a
  panic if the last child vanishes between borrows (a panic here would `V8_Fatal` the
  whole engine, `tree.rs:609-611`).
- **`text_content`** (`tree.rs:575-594` + `collect_text_inner` `tree.rs:698-717`) —
  spec-correct: on a `CharacterData` node returns its own data; on an element walks
  descendants concatenating **only** `Text` nodes (Comment/PI deliberately skipped,
  `tree.rs:702-706`).
- **`import_children_from` / `import_node_from`** (`tree.rs:654-677`) — deep-clones a
  subtree from another `DomTree` (recursively), used by `set_inner_html` to graft a parsed
  fragment (see §7).
- **`find_body_or_root`** (`tree.rs:635-652`) — walks `document → html → body`, returning
  the deepest found; the import target for `innerHTML =`.
- **`update_id_index`** (`tree.rs:687-695`) — lets the JS layer keep `id_index` in sync
  when a script mutates an element's `id` attribute.

---

## 5. CSS selector matching: implementing Servo `selectors`

`selector.rs` bridges Obscura's tree to the Servo `selectors` 0.26 + `cssparser` 0.34
stack (`Cargo.toml:30, 32`). It defines a `SelectorImpl` and an `Element` adapter.

### The `SelectorImpl` and its newtype wrappers

```rust
// crates/obscura-dom/src/selector.rs:17-31
pub struct ObscuraSelector;
impl parser::SelectorImpl for ObscuraSelector {
    type ExtraMatchingData<'a> = ();
    type AttrValue = CssString;
    type Identifier = CssString;
    type LocalName = CssLocalName;
    type NamespaceUrl = CssNamespace;
    ...
    type NonTSPseudoClass = PseudoClass;
    type PseudoElement = PseudoElement;
}
```

Because the `selectors` crate requires `ToCss`, `PrecomputedHash`, `From<&str>` etc. on
these associated types, the crate wraps `String`/`LocalName`/`Namespace` in newtypes:
`CssString` (`selector.rs:33-68`), `CssLocalName` (`selector.rs:70-89`), `CssNamespace`
(`selector.rs:91-98`). `CssString` even hand-rolls a **djb2 hash** for `PrecomputedHash`
(`selector.rs:54-62`).

### Supported vs. unsupported pseudo-classes/elements

The parser recognizes a **hard-coded set of 6 non-tree-structural pseudo-classes** —
`:hover`, `:active`, `:focus`, `:enabled`, `:disabled`, `:checked` (`PseudoClass`,
`selector.rs:100-108`; parsed in `parse_non_ts_pseudo_class`, `selector.rs:179-198`).
Anything else is a parse error. And **two pseudo-elements**, `::before` / `::after`
(`selector.rs:145-162`).

The crucial gap: **`match_non_ts_pseudo_class` and `match_pseudo_element` both
unconditionally return `false`** (`selector.rs:395-409`). So `:hover`, `:checked`,
`:disabled`, etc. *parse* but **never match anything** — Obscura has no interaction state,
form state, or computed style to answer them against. `:has()` is enabled at the parser
level (`parse_has` returns `true`, `selector.rs:175-177`) and is the one relative selector
that actually works end-to-end (test `test_query_selector_has`, `selector.rs:696-702`).

### The `DomElement<'a>` adapter

`DomElement { tree: &'a DomTree, node_id: NodeId }` (`selector.rs:201-211`) is a `Copy`
adapter implementing `selectors::Element`. It answers structural queries by reading the
arena: `parent_element` (element parents only, `selector.rs:245-254`), sibling walks that
skip non-elements (`selector.rs:272-309`), `has_local_name`/`has_namespace`
(`selector.rs:321-339`), `is_empty` (`selector.rs:470-489`), `is_root` (parent is the
Document, `selector.rs:491-503`).

Attribute/class/id matching all funnel through the linear `get_attribute` scan:
`has_id` (`selector.rs:434-442`), `has_class` splits the `class` attribute on whitespace
(`selector.rs:444-456`), `attr_matches` handles namespace constraints and
`operation.eval_str` (`selector.rs:354-378`). `is_link` recognizes `a`/`area`/`link` with
an `href` (`selector.rs:413-424`).

A documented subtlety: **`opaque()` must be stable per node** for `:has()` anchor matching.
Since `DomElement` is `Copy` and gets a fresh stack address each traversal step, it keys
`OpaqueElement` off the node's stable arena slot address rather than `self`
(`selector.rs:230-243`).

Shadow DOM / slots / custom state / parts are all stubbed to `None`/`false`:
`parent_node_is_shadow_root`, `containing_shadow_host`, `assigned_slot`,
`is_html_slot_element`, `has_custom_state`, `is_part`, `imported_part`
(`selector.rs:256-266, 426-432, 458-468`). `add_element_unique_hashes` returns `false`
(`selector.rs:509-511`), so the bloom-filter fast-reject optimization is disabled.

### Query entry points, caching, and the `#id` fast path

`query_selector*` and `query_selector*_from` (`selector.rs:570-650`) build a fresh
`MatchingContext` (`MatchingMode::Normal`, hard-coded `QuirksMode::NoQuirks`,
`NeedsSelectorFlags::No`, `selector.rs:596-604`) and then **linearly scan
`self.descendants(root)`**, testing each element with
`selectors::matching::matches_selector_list` (`selector.rs:606-618`). There is **no index,
no bloom filter, no right-to-left descendant optimization** beyond what the `selectors`
crate does per-element — it is an O(n) tree scan per query.

Two optimizations mitigate this:

1. **Thread-local parsed-selector LRU cache** (`selector.rs:514-552`): a
   `thread_local! HashMap<String, Arc<SelectorList>>` capped at 256 entries. On overflow
   it crudely `clear()`s the whole table (`selector.rs:544-550`) — the comment concedes "a
   real LRU would be more memory-friendly." This avoids re-parsing the same selector on
   every `querySelector` call.
2. **Bare `#id` fast path** (`simple_id_selector`, `selector.rs:557-568`, used at
   `selector.rs:583-594`): a conservatively-validated `#name` selector resolves through
   `id_index` in O(1) instead of scanning, but only after confirming the indexed node has
   `root` among its ancestors (so scoped `querySelectorFrom` stays correct), falling
   through to the full scan on a miss/stale entry.

`query_selector_from` correctly **excludes the root itself** (matches strict descendants
only) — verified by `test_query_selector_from_excludes_self` (`selector.rs:777-788`).

---

## 6. Serialization back to HTML (`serialize.rs`)

`outer_html`/`inner_html` (`serialize.rs:4-14`) drive a recursive `serialize_node`
(`serialize.rs:16-96`). It is a **hand-written serializer, not html5ever's serializer**.
Notable behaviors:

- **Void elements** (`area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr`)
  emit no children and no closing tag (`is_void_element`, `serialize.rs:126-132`, used
  `serialize.rs:47-54`).
- **Raw-text elements** (`script,style,textarea,title`) emit their text children
  **unescaped** (`is_raw_text_element`, `serialize.rs:134-136`, used `serialize.rs:56-72`);
  everything else escapes `& < >` in text (`escape_text`, `serialize.rs:105-114`) and
  `& "` in attribute values (`escape_attr`, `serialize.rs:116-124`).
- **Comment terminator neutralization** (`serialize.rs:73-87`): because
  `document.createComment("a-->b")` can inject a `-->`, the serializer replaces `-->` with
  `--&gt;` so output round-trips as one comment.

Gaps in the serializer (things a full HTML serializer does that this does not):

- **Attribute values are always double-quoted and always emitted with `="..."`** — no
  boolean-attribute minimization, no single-quote selection.
- **No namespace/prefix handling on output** — only `name.local` is written
  (`serialize.rs:32, 38`), so SVG/MathML foreign-content prefixes are dropped.
- **`<!DOCTYPE>` emits only the name** (`serialize.rs:26-30`) — public/system IDs are
  discarded on serialize.
- **No entity encoding beyond the 3–4 characters above** (no `&nbsp;` etc.; raw chars pass
  through).

---

## 7. How obscura-dom connects to the rest of Obscura

`obscura-dom` is a dependency of five other crates:
`obscura-cli`, `obscura-cdp`, `obscura-browser`, `obscura-mcp`, `obscura-js`
(grep of `Cargo.toml` files). The connections:

### Ownership: the tree is *moved*, not shared

There is **no `Arc<DomTree>` / `Rc<DomTree>` shared across owners**. The tree is a plain
`Option<DomTree>` that is **handed back and forth by value** between the browser page and
the JS runtime:

- `obscura-browser/src/page.rs:153` holds `pub dom: Option<DomTree>`. After fetching and
  parsing (`page.rs:1012` `parse_html(&body_text)` → `page.rs:1097` `self.dom = Some(dom)`),
  it `take()`s the tree and installs it into the JS runtime before running scripts
  (`page.rs:336-337` `if let Some(dom) = self.dom.take() { rt.set_dom(dom); }`).
- `obscura-js` stores it in `ObscuraState { dom: Option<DomTree>, ... }`
  (`crates/obscura-js/src/ops.rs:49-50`), reachable as
  `SharedState = Rc<RefCell<ObscuraState>>` (`ops.rs:121`). After scripts run, the page
  pulls it back with `js.take_dom()` (`page.rs:1511-1512`; `runtime.rs:958`).
- Read-only access from the page side goes through `with_dom` which prefers the JS-held
  copy when present (`page.rs:1222-1226`).

This value-move model works precisely because the whole engine is single-threaded around
one V8 isolate (`docs/Architecture-overview.md:44-57`).

### The JS boundary: everything goes through `op_dom`

The JS `document`/`Element` API in `bootstrap.js` never touches Rust structs directly.
Every DOM operation is a stringly-typed call to a single deno_core op,
`op_dom(cmd, arg1, arg2) -> String` (`crates/obscura-js/src/ops.rs:125-139`;
`docs/Architecture-overview.md:110` "All DOM ops go through `op_dom`"). Node handles cross
the boundary as **the arena index as a decimal string** (`NodeId::index()`), and results
come back as JSON or bare numbers.

`op_dom_inner` (`ops.rs:141-449`) is effectively the DOM's public JS ABI. Its dispatch
match (`ops.rs:149-446`) maps ~47 distinct command strings onto `DomTree` methods, e.g.:

- reads: `query_selector`, `query_selector_all`, `query_selector_scoped`,
  `get_element_by_id`, `text_content`, `inner_html`, `outer_html`, `get_attribute`,
  `node_type`/`node_name`/`tag_name`, sibling/child navigation.
- writes: `append_child`, `insert_before`, `remove_child`, `set_attribute`,
  `remove_attribute`, `set_inner_html`, `set_text_content`, and the `create_*` factories
  (`create_element`, `create_text_node`, `create_comment_node`,
  `create_processing_instruction`, `create_doctype`, `create_document_fragment`).

Several correctness/robustness behaviors live in `op_dom` rather than the crate:

- **The whole op is wrapped in `catch_unwind`** (`ops.rs:125-139`, `catch_unwind` at
  `ops.rs:132`) so a DOM-op panic (e.g. the `elem_name` panics, §8) degrades to `"null"`
  instead of aborting via `V8_Fatal`. This is the safety net that makes the crate's own
  `panic!`/`expect` survivable in production.
- `append_child`/`remove_child`/`insert_before` **reject non-numeric handles** (`"undefined"`)
  rather than defaulting to node 0 = the document root (`ops.rs:291-310`).
- `set_inner_html` refuses `nid == 0` (won't clear the document), then detaches existing
  children and grafts a parsed fragment via `import_children_from`/`find_body_or_root`
  (`ops.rs:320-338`) — the tree's `parse_fragment` + import path.
- `set_attribute` on `id` keeps `id_index` in sync via `update_id_index`
  (`ops.rs:269-282`), compensating for the crate's best-effort index (see §8).
- `get_element_by_id` **verifies the indexed node is still attached to the live document**
  and falls back to an attribute selector scan on a stale/detached hit (`ops.rs:179-195`),
  because `id_index` is not maintained on reparent.

### Other consumers (read paths, no JS)

- **CDP `DOM` domain** (`obscura-cdp/src/domains/dom.rs`) surfaces the tree to Puppeteer/
  Playwright: `getDocument`, `querySelector`/`querySelectorAll` (→ `dom.query_selector*`,
  `dom.rs:50-66`), `getOuterHTML`, `describeNode`, `resolveNode`, `focus`, `getBoxModel`
  (`dom.rs:40-251`). Related CDP domains build on it: `accessibility.rs`,
  `domsnapshot.rs`.
- **CLI & MCP** consume `obscura-dom` by walking a `DomTree` for offline text/asset
  extraction — they read the tree, they do not (at runtime) parse HTML themselves. In the
  CLI, `extract_readable_text` (`obscura-cli/src/main.rs:940`) and `extract_assets`
  (`main.rs:1327`) operate over the live page's tree, obtained via `page.with_dom(...)`
  (callers at `main.rs:927, 1356`). The CLI's only `parse_html` calls live in its own
  `#[cfg(test)]` module (`main.rs:1749, 1886, 1973`), building fixture trees to drive
  those pure extraction functions without standing up a browser. In MCP, `extract_text`
  (`obscura-mcp/src/lib.rs:1567`) likewise receives a `DomTree` produced by the browser
  page; `obscura-mcp` never calls `parse_html`/`parse_fragment` (a grep of its source
  returns zero matches). Both crates list `obscura-dom` as a workspace dependency and
  treat it as the tree type they read.

---

## 8. Limitations, gaps, and sharp edges

This is deliberately thorough — for the Basset Hound comparison, what the crate *omits* is
as informative as what it implements.

**Standards / DOM coverage gaps**

- **Interaction & form-state pseudo-classes are inert.** `:hover`, `:active`, `:focus`,
  `:enabled`, `:disabled`, `:checked` parse but always fail to match
  (`selector.rs:395-401`). No `:nth-child` state issues (that's handled by the `selectors`
  crate structurally), but anything needing runtime state is absent.
- **No Shadow DOM, slots, custom elements state, or `::part`** — all stubbed
  (`selector.rs:256-266, 458-468`). No `Range`/`Selection` types in this crate (the
  `compare_order`/`node_index` helpers that a `Range` needs live in `obscura-js/ops.rs`,
  not here).
- **Quirks mode is discarded.** `set_quirks_mode` is a no-op (`tree_sink.rs:221-222`) and
  matching hard-codes `NoQuirks` (`selector.rs:600`), so quirks-mode class/id
  case-insensitivity and layout quirks are not modeled.
- **No live collections / `MutationObserver` in this crate.** `children()`/`descendants()`
  return **owned `Vec<NodeId>` snapshots** (`tree.rs:480-554`), not live NodeLists; any
  observer semantics live in `bootstrap.js`.
- **No computed style, layout, or box model here.** `getBoxModel`/`getContentQuads` are
  synthesized in the CDP layer (`dom.rs:183-251`), not from real layout.
- **Serializer is lossy** (§6): drops doctype public/system IDs, foreign-content
  namespaces/prefixes, and does no attribute minimization.

**Structural / performance limits**

- **`id_index` is best-effort and can go stale.** It is populated only at node *creation*
  and keeps the **first** element per duplicate id (`new_node`, `tree.rs:187-194`); it is
  **not updated on reparent**, so callers must verify liveness themselves (as `op_dom` and
  `query_selector_from` both do, `ops.rs:179-195`, `selector.rs:583-594`). `set_attribute`
  keeps it in sync only because `op_dom` calls `update_id_index` explicitly, not the crate.
- **`query_selector*` is an O(n) descendant scan** with no bloom-filter reject
  (`add_element_unique_hashes` returns `false`, `selector.rs:509-511`). Only the parsed
  selector is cached, not results.
- **Attribute lookup is a linear scan** of a `Vec<Attribute>` (`tree.rs:106-114`) — fine
  for typical element attribute counts, but not a map.
- **Selector cache eviction is "dump the whole table" at 256 entries**
  (`selector.rs:544-550`).
- **Single `RefCell` coarse lock.** Every op borrows all of `DomTreeInner`; there is no
  fine-grained concurrency, by design (single V8 isolate).

**Panic surface (mitigated externally)**

- The crate contains raw `panic!`/`expect` that can fire on inconsistent trees:
  `elem_name` (`tree_sink.rs:52, 55`), `get_template_contents` (`tree_sink.rs:214`). These
  are only safe in production because **`op_dom` wraps every call in `catch_unwind`**
  (`ops.rs:125-139`) and the CDP command watchdog bounds runaway work
  (`docs/Architecture-overview.md:60-61`). Inside the crate itself there is no such
  guard — a direct library user (CLI/MCP) could theoretically hit these.
- Two `unsafe` blocks (`ObscuraElemName` raw-pointer deref, `tree_sink.rs:18-30, 48-62`)
  rely on the `RefCell` staying borrowed for the pointer's lifetime.

**Robustness features that *are* present**

- Cyclic-reparent rejection in `append_child`/`insert_before` and the `descendants` cycle
  circuit-breakers (§4) — a deliberate anti-DoS measure so a malicious/ buggy script
  cannot wedge the single-threaded engine (`tree.rs:238-245, 520-532`; called out in
  `docs/Architecture-overview.md:61`).
- Spec-correct text coalescing, `textContent` semantics, and first-in-tree-order id
  resolution on duplicates (`tree.rs:187-192`).

---

## 9. Comparison notes for Basset Hound

- **Model:** Obscura's DOM is a **Rust-native arena** (`Vec<Option<Node>>` + `NodeId(u32)`
  + free list) behind one `RefCell`, moved by value between the page and a single V8
  isolate. Basset Hound is Electron/Chromium-backed, so its "DOM" is Chromium's real Blink
  DOM accessed over CDP/WebSocket — a fundamentally heavier but far more complete engine
  (real layout, styles, shadow DOM, live collections, quirks mode).
- **Parsing:** Obscura leans entirely on `html5ever` for spec-conformant HTML5 tree
  construction but supplies a minimal sink; there is no CSS *cascade*/style system at all,
  only selector *matching* for `querySelector`. Basset Hound inherits Blink's full CSS
  engine.
- **JS boundary:** Obscura funnels the entire DOM API through one stringly-typed
  `op_dom` op with integer-string handles — a narrow, auditable, but low-fidelity bridge.
  This is the opposite of Basset Hound's approach of driving a real browser's JS engine
  directly.
- **What to borrow:** the cyclic-reparent guards and traversal circuit-breakers
  (`tree.rs`) are a clean, well-commented pattern for making a hand-rolled tree
  DoS-resistant; and the `catch_unwind` + watchdog layering shows how a panic-prone native
  DOM can be made production-safe behind a scripting boundary.

---

## Appendix: file map

| File | Lines | Role |
|------|-------|------|
| `src/lib.rs` | 10 | Module wiring + public re-exports (`tree.rs:9-10` of lib) |
| `src/tree.rs` | 936 | Arena, `Node`/`NodeData`/`NodeId`, mutation, traversal, id-index, text |
| `src/tree_sink.rs` | 323 | `html5ever::TreeSink` impl + `parse_html`/`parse_fragment` |
| `src/selector.rs` | 789 | `SelectorImpl`, `DomElement` (`selectors::Element`), query + cache |
| `src/serialize.rs` | 188 | Hand-written `outer_html`/`inner_html` serializer |
