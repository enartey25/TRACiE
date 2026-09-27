# UIRenderer Audit Plan
_Branch: feat/ui-renderer — SRS §7.4, 20.1, 23.2, 25, 26.3_
_Revised after user review_

## Overview

A four-area audit and fix pass against the UIRenderer widget library. The audit
covers accessibility (keyboard navigation), empty-payload resilience, Mermaid lazy-
loading confirmation, and Component Gallery readiness (`UIRenderer.list()` + `GALLERY.md`).

No changes to `ui-renderer.js` are required by any of the confirmed gaps.
If a gap analysis during implementation reveals one, the implementer must stop,
explain the necessity, and get approval before touching that file.

All five sub-tasks are batched into a single implementation pass.

---

## Gap Checklist (pre-implementation)

### Keyboard / Accessibility (SRS §7.4 NFR, §23.2)

- [x] GAP-K1  `audio.js` — Re-examined: all four controls (`ppBtn`, `skipBack`, `skipFwd`,
      `speedBtn`) are created as `<button type="button">`. Native `<button>` elements fire a
      synthetic click on Enter and Space; adding explicit `keydown` handlers would double-fire
      (play then instantly pause, skip 20 s). **No code change needed.**
- [x] GAP-K2  `flashcards.js` — Footer action buttons (`gotItBtn`, `reviewBtn`) are native
      `<button type="button">`. They already have `keydown` handlers that call
      `e.stopPropagation()` so Space/Enter does not also flip the card. The `flipWrap`
      element (`role="button"`, `tabindex="0"`) has its own `keydown` Enter/Space flip handler
      with `e.preventDefault()`. **No code change needed.**
- [x] GAP-K3  `quiz.js` — Arrow-key + Enter/Space option navigation confirmed. **No gap.**

### Empty Payload (SRS §25, §26.3)

- [x] GAP-E1  `code-snippet.js` — `render(p, { codePanel })` passes `p` directly to
      `codePanel(p)` with no guard. When `p` is `{}`, `codePanel` receives empty fields —
      potential blank or broken render. Fix: guard `!p || !p.code` → return
      `ctx.notice('info', 'No code to display.')`.
- [x] GAP-E2  No `*_empty` regression path exists. Instead of hand-writing 23 fixtures,
      `renderer-lab.html`'s "Run all fixtures" loop is extended to also render
      `{ type, payload: {} }` for every type in `UIRenderer.list()`, reporting each row as
      `<type>_empty`. This covers all current and future widgets automatically.
      Two named fixtures are also added to `widget-fixtures.js` for the audio security guard:
        - `audio_empty` — `{ type: 'audio', payload: {} }` (missing src → notice)
        - `audio_bad_src` — `{ type: 'audio', payload: { src: 'http://bad' } }` (http: disallowed → notice)

### Mermaid Lazy Loading (SRS §7.4 FR-21, §20.1 Decision 3)

- [x] GAP-M1  `loadMermaid()` is only reachable via `drawMermaid()`. `drawMermaid()` is only
      called from `mermaidFigure()` inside `renderOne()`, which is gated by
      `DIAGRAM_TYPES.has(type) && typeof env.payload.diagram_source === 'string'`
      (ui-renderer.js lines 169–170). The `mermaid-diagrams.js` widget's own `render()`
      function uses `ctx.notice()` — it never calls `ctx.drawMermaid()` directly; that path
      is only reached when `diagram_source` is present (the core short-circuits before
      calling the widget). **No code change needed.** Confirmed and documented in GALLERY.md.

### Component Gallery (SRS §7.4 FR-24)

- [x] GAP-G1  `docs/renderer/GALLERY.md` does not exist. Create it.
- [x] GAP-G2  `basic-text.js` registers 7 types with no explicit `label` (auto-fallback used).
      `mermaid-diagrams.js` registers 7 types with no explicit `label`. Add explicit labels
      so `UIRenderer.list()` returns human-readable strings for all types.

---

## Sub-Tasks (single implementation pass)

### Sub-Task A — Empty-payload guard for `code-snippet.js` (GAP-E1)

**Status:** `[x] done`

**Intent**
`code-snippet.js` is the reference widget. It calls `codePanel(p)` unconditionally.
`ui-renderer.js` always passes `env.payload || {}` to widget render functions (line 175),
so `p` is always at least `{}` — but `codePanel` reads `p.code`, `p.language`, and
`p.file_name`, all of which will be `undefined` on an empty payload. A two-line guard
is all that is needed.

**Expected Outcomes**
- `{ type: 'code_snippet', payload: {} }` renders a notice, THROWS 0.
- The full `code_snippet` fixture continues to render identically.

**Todo List**
1. In `frontend/renderer/widgets/code-snippet.js`, add before the `codePanel` call:
   `if (!p || !p.code) return notice('info', 'No code to display.');`
   (destructure `notice` from `ctx` in the render signature).
2. Append to `logs/BUILD_LOG.md`.

**Relevant Context**
- `frontend/renderer/widgets/code-snippet.js` lines 8–10
- `ctx.notice(tone, text)` — use `'info'` tone

---

### Sub-Task B — Extend "Run all fixtures" with auto-generated empty rows (GAP-E2)

**Status:** `[x] done`

**Intent**
Instead of hand-writing one fixture per widget, the lab's regression loop is extended to
run a second pass over `UIRenderer.list()`, rendering `{ type, payload: {} }` for every
registered type. Each row is labelled `<type>_empty` in the report. This means any newly
added widget is automatically covered without touching `widget-fixtures.js`.

Two explicit fixtures are added to `widget-fixtures.js` for the audio security guard edge
cases, because those require a specific `src` value to exercise the right code path.

**Expected Outcomes**
- After clicking "Run all fixtures", the report shows both named fixture rows AND one
  `<type>_empty` row per registered type — all either `ok` or `TODO`, THROWS 0.
- `audio_empty` (no src) shows the "Invalid audio source." notice.
- `audio_bad_src` (http: URL) shows the same notice.
- Adding any future widget automatically gets an empty-payload row with no further changes.

**Todo List**
1. Add to `frontend/renderer/widget-fixtures.js` (after `audio`, before `checklist`):
   ```js
   audio_empty:   { type: 'audio', payload: {} },
   audio_bad_src: { type: 'audio', payload: { src: 'http://bad' } },
   ```
2. In `frontend/renderer/renderer-lab.html`, extend the `$('all').onclick` handler to run
   a second pass after the named-fixtures loop:
   - Call `UIRenderer.list()` to get `[{ type, label, category }]`.
   - For each entry render `{ type, payload: {} }` into `scratch`.
   - Label the row `<type>_empty` (padded to same width).
   - Accumulate into the same `ok`/`todo`/`bad` counters and `lines` array.
   - The combined report header already shows the totals.
3. Append to `logs/BUILD_LOG.md`.

**Relevant Context**
- `frontend/renderer/renderer-lab.html` lines 76–87 (the `$('all').onclick` block)
- `UIRenderer.list()` is available at that point (`await UIRendererReady` has resolved)
- `frontend/renderer/widget-fixtures.js` — audio section ~line 327

---

### Sub-Task C — Confirm Mermaid lazy-loading (GAP-M1)

**Status:** `[x] done — no code change`

Confirmed by code reading (see gap checklist above). Findings documented in Sub-Task D.

---

### Sub-Task D — Explicit labels + `GALLERY.md` (GAP-G1, GAP-G2)

**Status:** `[x] done`

**Intent**
`basic-text.js` and `mermaid-diagrams.js` both register multiple types in a `forEach` loop
without a `label` field, so `UIRenderer.list()` returns the auto-generated fallback for
those 14 types. Adding explicit labels makes the gallery unambiguous. Then `GALLERY.md` is
written from the confirmed registration data.

**Expected Outcomes**
- `UIRenderer.list()` returns a human-readable `label` for every registered type.
- `docs/renderer/GALLERY.md` exists with a full widget table and a Mermaid section.

**Todo List**
1. In `frontend/renderer/widgets/basic-text.js`, add `label` to each type's registration
   using a lookup map (one label per type: `chat_response` → `'Chat response'`,
   `summary` → `'Summary'`, `explanation` → `'Explanation'`, `tip` → `'Tip'`,
   `warning` → `'Warning'`, `best_practice` → `'Best practice'`, `citation` → `'Citation'`).
   The cleanest approach is to replace the `forEach` with a map of `{ type, label }` pairs.
2. In `frontend/renderer/widgets/mermaid-diagrams.js`, do the same:
   `sequence_diagram` → `'Sequence diagram'`, `state_diagram` → `'State diagram'`,
   `mindmap` → `'Mind map'`, `dependency_graph` → `'Dependency graph'`,
   `data_flow` → `'Data flow'`, `component_diagram` → `'Component diagram'`,
   `system_diagram` → `'System diagram'`.
3. Write `docs/renderer/GALLERY.md` with:
   - A table: Type | Label | Category | Bare | Notes
   - One row per registered type (all 28+ types from the full widget audit)
   - A "Mermaid lazy-loading" section confirming GAP-M1 with the exact guard condition
4. Append to `logs/BUILD_LOG.md`.

**Relevant Context**
- `frontend/renderer/widgets/basic-text.js` (7 types, no label)
- `frontend/renderer/widgets/mermaid-diagrams.js` (7 types, no label)
- `frontend/renderer/ui-renderer.js` line 260 (`labelFromType` fallback)
- `frontend/renderer/ui-renderer.js` line 267 (`list()` return shape)
- All other widgets confirmed to have explicit labels

---

## Implementation Notes

- **Order:** A → B → D. Sub-Task C is already resolved (no code change).
- **Do not edit `ui-renderer.js`** — no gap requires it.
- **Scope boundary:** `frontend/renderer/widgets/code-snippet.js`,
  `frontend/renderer/widgets/basic-text.js`, `frontend/renderer/widgets/mermaid-diagrams.js`,
  `frontend/renderer/widget-fixtures.js`, `frontend/renderer/renderer-lab.html`,
  `docs/renderer/GALLERY.md`, `logs/BUILD_LOG.md`.
- **After implementation:** open `renderer-lab.html`, click "Run all fixtures", confirm THROWS = 0.
