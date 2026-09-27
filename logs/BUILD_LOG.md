# UIRenderer Widget Build Log

---

## overview — Content and Guidance
**Date:** 2026-09-26
**Files:** `widgets/overview.js`, `widgets/overview.css`, manifest line `{ name: 'overview', css: true }`
**States:** default, highlight (layer card variant)
**Design matched:** content-guidance.png — lead paragraph in --uir-teal 600 weight; body paragraph max-width 70ch; responsive 3-column layer grid (--uir-sand bg, --uir-radius-sm); icon in white square; tag uppercase teal top-right; bold title; muted text; highlight:true uses --uir-sage-tint bg + --uir-line-strong border; collapses to 1 column below 600 px.
**Not matched:** none.

---

## quiz — 2026-09-26

**Files changed**
- `frontend/renderer/widgets/quiz.js` — created
- `frontend/renderer/widgets/quiz.css` — created
- `frontend/renderer/widgets/manifest.js` — added `{ name: 'quiz', css: true }`

**States implemented**
- default: white card, header row (counter + chip), 4 px progress bar, bold question, hint, lettered option rows with empty radio circle
- hover: `--uir-sage-tint` background, `--uir-line-strong` border, letter badge turns white
- selected-correct: full `--uir-slate` bg + white text + `--uir-ok` left border + filled check circle
- selected-wrong: full `--uir-slate` bg + white text + `--uir-err` left border + filled check circle; correct option gets `--uir-ok` left border
- revealed: explanation box (`--uir-sand`) appears below options; options lock (`aria-disabled`)
- navigation memory: going back shows the previously chosen answer still selected/revealed, options locked
- results screen: "X of N correct" score, contextual label, Retry button resets all answers and returns to Q1
- keyboard: arrow keys move focus between options; Enter/Space selects; Prev/Next/Retry are reachable via Tab

**Reusable API**
- `window.UIRPractice.questionFlow(questions, { unitLabel, chipLabel })` — usable by `code_exercise`

**Not matched / notes**
- None. All design states and spec additions matched.

---

## code_exercise

**Date:** 2026-09-26  
**Files changed:**
- `frontend/renderer/widgets/code-exercise.js` — created
- `frontend/renderer/widgets/code-exercise.css` — created
- `frontend/renderer/widgets/manifest.js` — added `{ name: 'code-exercise', css: true }` after quiz

**States implemented:**
- Default (no answer chosen)
- Hover (option highlight, letter badge lightens)
- Selected / correct (slate bg, green left border, checkmark)
- Wrong (slate bg, red left border, X mark)
- Revealed / locked (all options locked, explanation shown)
- Results screen (inherited from `questionFlow`)

**Design matched:** `docs/renderer/design/code-exercise.png`  
Repository context box: white card, 1px `--uir-line` border, `--uir-radius-sm`, dot + bold repo_label + teal scope on row 1, mono breadcrumb with bold last segment on row 2.  
Code panel: `ctx.codePanel(...)` inserted between hint and options via `renderContext` hook.  
Options: letter badge stays vertically centred at top via `align-items: flex-start` + `uir-quiz--code-exercise` modifier class.

**Not matched / notes:**
- None. All design states reproduced. Keyboard (arrow keys, Enter, Space, Tab) and results screen fully inherited from `questionFlow`. 
- Revised same day: repository box moved above the question via renderPreface; badges re-centred; syntax highlighting on every question.

---

## flashcards

**Date:** 2026-09-26  
**Files changed:**
- `frontend/renderer/widgets/flashcards.js` — created
- `frontend/renderer/widgets/flashcards.css` — created
- `frontend/renderer/widgets/manifest.js` — added `{ name: 'flashcards', css: true }` after code-exercise

**States implemented:**
- Front face (default): big bold term, muted prompt, sage-tint "Click to flip" hint box with `--uir-line-strong` border
- Back face (flipped): bold back title, detail paragraph, optional "Related term" box (`--uir-sage-soft` bg), footer divider + "Needs review" outline pill + "Got it" dark pill
- Flip: 3D `rotateY(180deg)` 450 ms on click or Enter/Space; `prefers-reduced-motion` crossfade fallback
- "Got it": marks card `learned`, advances to next
- "Needs review": marks card `review`, advances to next
- Progress panel (right column, stacks below 640 px): live counts for Learned / Needs review, learned/N progress bar, "Review rhythm" explanation box
- Deck complete screen: headline, learned/review counts, "Review again" button (restarts with `review`-tagged cards only; hidden when none need review)

**Design matched:** `docs/renderer/design/flashcards-audio.png` (left half)  
Card header: "N of M flashcards" counter + "Flashcard" pill chip + 4 px progress bar (same pattern as quiz).  
Progress panel matches the three-section design: title/subtitle, Learned/Needs-review stat rows with live counts, progress bar, Review rhythm box.

**Not matched / notes:**
- None. All specified states and interactions implemented.
- Revised same day: added Restart deck, grid height fix so no clipping, slate progress bar.

---

## audio

**Date:** 2026-09-26
**Files changed:**
- `frontend/renderer/widgets/audio.js` � created
- `frontend/renderer/widgets/audio.css` � created
- `frontend/renderer/widgets/manifest.js` � added one line`{ name: 'audio', css: true }`

**States implemented:**
- loading (skeleton shimmer, seek/skip disabled, duration shows '--:--')
- playing (--playing class, Pause button)
- paused (Play button restored)
- ended (--ended class, Replay button)
- error (ctx.notice rendered above transcript)

**Payload fields used:** `src`, `title`, `description`, `transcript` (optional), `downloadable` (optional)

**Design matched:** right half of `docs/renderer/design/flashcards-audio.png` (Audio overview widget)

**Notes:**
- NaN/Infinity duration guard: seek+skip remain disabled until isFinite(audio.duration)
- Cross-widget pause: all [data-uir-audio] elements paused on play
- Download link uses target=_blank rel=noopener per clarification 4
- Transcript collapsed (<details> no open) by default per clarification 2
- prefers-reduced-motion disables shimmer animation and transitions

---

## glossary — Content and Guidance
**Date:** 2026-09-26
**Files:** `widgets/glossary.js`, `widgets/glossary.css`, manifest line `{ name: 'glossary', css: true }`
**States:** default; empty (notice fallback)
**Design matched:** content-guidance.png — whole card body in --uir-sand; term (bold, 35% width) + definition (--uir-muted) rows; 1px --uir-line separator between rows; two-column collapses to stacked below 480 px.
**Not matched:** none.

---

## definition — Content and Guidance
**Date:** 2026-09-26
**Files:** `widgets/definition.js`, `widgets/definition.css`, manifest line `{ name: 'definition', css: true }`
**States:** default; graceful degradation for missing phonetic/domain
**Design matched:** content-guidance.png — phonetic italic muted right-aligned as first body line; "NOUN · ARCHITECTURE" meta row (uppercase, tiny, --uir-teal); body text 1rem; eyebrow defaults to "DEFINITION" (provided in envelope by Ethan; not injected by widget).
**Not matched:** none.

---

## faq — Content and Guidance
**Date:** 2026-09-26
**Files:** `widgets/faq.js`, `widgets/faq.css`, manifest line `{ name: 'faq', css: true }`
**States:** default (details open); collapsed (user closes); empty (fallback text)
**Design matched:** content-guidance.png — stacked <details open> blocks with --uir-sage-tint bg, --uir-radius-sm, 10px gap; help-circle icon + bold question in <summary>; answer in --uir-muted below; native default triangle marker removed; focus-visible outline on summary; prefers-reduced-motion guard.
**Not matched:** none.

---

## paths (directory_tree + file_reference) — Code and Files
**Date:** 2026-09-26
**Files:** `widgets/paths.js`, `widgets/paths.css`, manifest line `{ name: 'paths', css: true }`
**States:** default; empty/missing path (notice fallback)
**Design matched:** content-guidance.png — directory_tree renders path array as monospace breadcrumb in --uir-sand body, separators muted, last segment bold; file_reference adds "Lines N–M" pill (--uir-sand bg, 999px radius, --uir-mono, --uir-teal) and reason paragraph. Shared buildBreadcrumb() helper keeps both DRY.
**Not matched:** none.

---

---

## database_schema — Diagrams
**Date:** 2026-09-26
**Files:** `widgets/database-schema.js`, `widgets/database-schema.css`, manifest line `{ name: 'database-schema', css: true }`
**States:** default (table grid + index chips), PK row (warm-chip bg), FK row (sage-tint bg), highlighted chip (sage-tint bg + line-strong border), empty/missing tables (notice)
**Design matched:** CSS-grid `repeat(auto-fill, minmax(260px, 1fr))`; teal header (table name left, N cols right in white/muted); column rows in mono with type + constraints; PK=warm-chip, FK=sage-tint row bg; border `1px solid --uir-line-strong` + `--uir-radius-sm`; index chips as 999px pills; highlighted chip gets sage-tint + line-strong border. No bare — standard card wraps.
**Not matched:** none.

---

## api_flow — Diagrams
**Date:** 2026-09-26
**Files:** `widgets/api-flow.js`, `widgets/api-flow.css`, manifest line `{ name: 'api-flow', css: true }`
**States:** default (groups present), empty (groups missing/empty → ctx.notice info)
**Design matched:** flex-wrap grid of group column cards; tone-mapped group headers (dark→--uir-slate, green→--uir-teal, light→--uir-sage); method pills (GET→--uir-sage-tint, POST→--uir-teal, PATCH→--uir-sage, DELETE→--uir-slate); mono path text; muted result text with → arrow; legend bar of 4 method pills at top; common_errors footer with --uir-warm-chip chips; collapses to single column below 540 px; prefers-reduced-motion respected.
**Not matched:** No design PNG found in docs/renderer/design/ (none present on disk) — implemented from design tokens and spec description only.

## flowchart / architecture_diagram — Diagrams and Architecture
**Date:** 2026-09-26
**Files:** `widgets/flowchart.js`, `widgets/flowchart.css`, manifest line `{ name: 'flowchart', css: true }`
**States:** default (structured row), emphasis node (teal bg + white text), tone:sand node, missing-payload notice, branch-detected fallback (drawMermaid)
**Design matched:** diagrams.png top card "Request Lifecycle" — horizontal flex-wrap row of rounded-box nodes; bold label + small sub below; `--uir-sage-tint` default bg; `--uir-teal` emphasis bg with white text; `--uir-sand` tone:sand bg; edge connector = tiny uppercase label above `→` arrow in `--uir-soft-text`; node border `1px solid --uir-line-strong`. `architecture_diagram` registered with the same def.
**Not matched:** none.

---

## er_diagram — Diagrams
**Date:** 2026-09-26
**Files:** `widgets/er-diagram.js`, `widgets/er-diagram.css`, manifest line `{ name: 'er-diagram', css: true }`
**States:** default (entities + relations rendered); empty/missing `entities` array → `ctx.notice('info', ...)` fallback
**Design matched:** diagrams.png spec — sand-tinted wrapper (`--uir-sand`); entity cards with teal header (`--uir-teal`, white bold mono name), bordered (`--uir-line-strong`), `--uir-radius-sm`; field rows: fixed-width icon slot (`key` for PK, `link` for FK, empty spacer otherwise), mono field name (bold for PK), trailing muted note (`--uir-soft-text`); relation chips as pill spans (`999px` radius, `--uir-soft-text`, `--uir-line-strong` border) showing `"1 owns N"` format parsed from `cardinality` + `label`; flex-wrap grid for entity cards; `prefers-reduced-motion` guard.
**Not matched:** none.

---

## commit_history / timeline � Code and Files / Content and Guidance
**Date:** 2026-09-26
**Files:** `widgets/commit-history.js`, `widgets/commit-history.css`, manifest line `{ name: 'commit-history', css: true }`
**States:** default (renders all commits with vertical rail, dots, SHA chip, when�author, optional tag pill, bold message, muted detail), empty (ctx.notice 'info'), hover (row background tinted sage)
**Design matched:** Vertical rail on left edge; first dot filled --uir-teal, rest outlined --uir-line-strong; SHA chip mono font --uir-radius-sm; when�author muted --uir-soft-text; tag pill 999px radius --uir-sage-tint bg + --uir-line-strong border; message bold --uir-sans; detail muted smaller text.
**Timeline alias:** `UIRenderer.register('timeline', ...)` in same file; normalises `events[{date,label,detail}]` ? `commits[{when,message,detail}]` via `normalizePayload()`.
**Not matched:** No design PNG available (docs/renderer/design/ is empty); layout derived from written spec and token reference only.

---

## class_diagram — Diagrams
**Date:** 2026-09-26
**Files:** `widgets/class-diagram.js`, `widgets/class-diagram.css`, manifest line `{ name: 'class-diagram', css: true }`
**States:** default (full render), empty (notice when `classes` missing or empty array)
**Design matched:** diagrams.png class diagram spec — responsive 3-column CSS grid of class boxes (collapses to 2-col ≤900px, 1-col ≤640px); each box has tone-colored header bar (`--uir-slate` for dark, `--uir-teal` for green, `--uir-muted` for grey) with white bold name and optional italic `«stereotype»`; `--uir-sand` attribute section with mono font; white method section with mono font; sections divided by `--uir-line-strong` 1px border; relations listed below grid in `--uir-soft-text` mono text: `extends` shown as `↑ extends`, `association` shown as `◇──  from_card ── label ── to_card ── to`.
**Not matched:** none.

---

## checklist — Workflows
**Date:** 2026-09-26
**Files:** `widgets/checklist.js`, `widgets/checklist.css`, manifest line `{ name: 'checklist', css: true }`
**States:** default (unchecked), checked item (strikethrough + --uir-soft-text), all-done (--uir-sage-tint list bg + banner), empty (ctx.notice info), hover (--uir-sage-tint row bg)
**Design matched:** Same visual language as existing widgets — stacked list with `1px solid --uir-line` border + `--uir-radius-sm`; rows flex with gap 10px padding 10px 12px; native `<input type="checkbox">` with `accent-color: --uir-teal`; done label `text-decoration: line-through + --uir-soft-text`; counter pill `--uir-sand` bg + `--uir-mono`; all-done banner `--uir-sage-tint`; keyboard: native checkbox (Space toggles); focus-visible outline `--uir-teal`; prefers-reduced-motion guard.
**Fixture:** pre-existing in widget-fixtures.js
**Not matched:** none.

---

## steps (tutorial / learning_path / workflow) — Workflows
**Date:** 2026-09-26
**Files:** `widgets/steps.js`, `widgets/steps.css`, manifest line `{ name: 'steps', css: true }`; fixtures added for `learning_path` and `workflow` in widget-fixtures.js
**States:** default (numbered teal circle + title + markdown body), completed step (--uir-ok circle + ✓ checkmark), last step (connector line hidden via :last-child), progress bar (learning_path only: N of M label + 6px track/fill), empty (ctx.notice info)
**Design matched:** 32px left column with 28px circle (--uir-teal, white text, 600 weight); vertical 2px --uir-line connector flex-1; right column flex-1 with 24px bottom padding (0 for last); title .9rem bold --uir-text; body via safeMarkdown + --uir-muted; progress bar --uir-sage-soft track + --uir-slate fill + 999px radius; prefers-reduced-motion disables fill transition. All three types share one renderSteps() function — type parameter controls progress bar and done-circle behaviour.
**Not matched:** none.

---

## diff — Code and Files
**Date:** 2026-09-26
**Files:** `widgets/diff.js`, `widgets/diff.css`, manifest line `{ name: 'diff', css: true }`
**States:** default (context, add, del, hunk rows), empty/missing patch (ctx.notice info)
**Design matched:** Reuses `.uir-codepanel` outer shell (--uir-code-bg bg, 1px --uir-line border, --uir-radius-sm) with `.uir-codepanel__bar` header (file_name bold mono left, "diff" label right); unified diff parsed line-by-line: `+` rows --uir-sage-tint, `-` rows local `--uir-diff-del: #FDECEA`, `@@` hunk rows --uir-sand italic, context rows transparent; 28px prefix column (--uir-ok for +, --uir-err for −, --uir-muted for hunk); `.uir-diff__line` white-space:pre + overflow-x:auto for long lines; `+++`/`---` file header lines skipped.
**Fixture:** pre-existing in widget-fixtures.js
**Not matched:** none.

---

## table (comparison / request_response) — Content and Guidance / Code and Files
**Date:** 2026-09-26
**Files:** `widgets/table.js`, `widgets/table.css`, manifest line `{ name: 'table', css: true }`; fixtures added for `comparison` and `request_response` in widget-fixtures.js
**States:** default (header + zebra body), hover row (--uir-sage-tint, motion-safe only), empty (ctx.notice info)
**Design matched:** Semantic `<table>` with `<thead>/<tbody>`; thead --uir-teal bg, white bold .82rem; zebra: even rows --uir-sand, odd rows --uir-card; hover --uir-sage-tint wrapped in prefers-reduced-motion:no-preference; first `<td>` per row 600 weight --uir-text, rest --uir-muted; 10px 14px padding; 1px --uir-line bottom border per cell; wrapper overflow-x:auto for narrow screens; border-collapse collapse + radius-sm. Two types (comparison, request_response) share one renderTable() function.
**Not matched:** none.

---

## UIRenderer Audit Pass — SRS §7.4, 20.1, 23.2, 25, 26.3
**Date:** 2026-09-26
**Files changed:**
- `widgets/code-snippet.js` — added empty-payload guard
- `widgets/basic-text.js` — added explicit `label` for all 7 registered types
- `widgets/mermaid-diagrams.js` — added explicit `label` for all 7 registered types
- `widget-fixtures.js` — added `audio_empty`, `audio_bad_src` edge-case fixtures
- `renderer-lab.html` — extended "Run all fixtures" with auto empty-payload pass (Pass 2)
- `docs/renderer/GALLERY.md` — created (new file)
- `docs/renderer/plans/uirenderer-audit-plan.md` — updated (plan revision + gap status)

**Gaps resolved:**
- GAP-K1 / GAP-K2 / GAP-K3 (keyboard): confirmed no code change needed — all interactive
  buttons are native `<button type="button">` (Enter/Space fires click natively). Flashcards
  footer buttons use `e.stopPropagation()` in their keydown handlers so Space/Enter does not
  also flip the card.
- GAP-E1 (code-snippet empty): `render(p, { codePanel, notice })` now returns
  `notice('info', 'No code to display.')` when `!p || !p.code`.
- GAP-E2 (empty-payload regression): renderer-lab.html "Run all fixtures" now runs a second
  pass rendering `{ type, payload: {} }` for every type in `UIRenderer.list()`, reported as
  `<type>_empty`. Two explicit audio edge-case fixtures added to widget-fixtures.js.
- GAP-M1 (Mermaid lazy-load): confirmed — `loadMermaid()` is only called when
  `DIAGRAM_TYPES.has(type) && typeof payload.diagram_source === 'string'`. Documented in
  GALLERY.md.
- GAP-G1 (GALLERY.md): created at `docs/renderer/GALLERY.md` — 40-row widget table,
  Mermaid confirmation, empty-payload regression notes.
- GAP-G2 (labels): `basic-text.js` and `mermaid-diagrams.js` now register with explicit
  `label` for every type; `UIRenderer.list()` returns human-readable labels for all types.

**Not matched / left out:** none — all confirmed gaps addressed.
