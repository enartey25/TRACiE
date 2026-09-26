# UIRenderer Widget Build Log

---

## overview — Content and Guidance
**Date:** 2025-07-10
**Files:** `widgets/overview.js`, `widgets/overview.css`, manifest line `{ name: 'overview', css: true }`
**States:** default, highlight (layer card variant)
**Design matched:** content-guidance.png — lead paragraph in --uir-teal 600 weight; body paragraph max-width 70ch; responsive 3-column layer grid (--uir-sand bg, --uir-radius-sm); icon in white square; tag uppercase teal top-right; bold title; muted text; highlight:true uses --uir-sage-tint bg + --uir-line-strong border; collapses to 1 column below 600 px.
**Not matched:** none.

---

## glossary — Content and Guidance
**Date:** 2025-07-10
**Files:** `widgets/glossary.js`, `widgets/glossary.css`, manifest line `{ name: 'glossary', css: true }`
**States:** default; empty (notice fallback)
**Design matched:** content-guidance.png — whole card body in --uir-sand; term (bold, 35% width) + definition (--uir-muted) rows; 1px --uir-line separator between rows; two-column collapses to stacked below 480 px.
**Not matched:** none.

---

## definition — Content and Guidance
**Date:** 2025-07-10
**Files:** `widgets/definition.js`, `widgets/definition.css`, manifest line `{ name: 'definition', css: true }`
**States:** default; graceful degradation for missing phonetic/domain
**Design matched:** content-guidance.png — phonetic italic muted right-aligned as first body line; "NOUN · ARCHITECTURE" meta row (uppercase, tiny, --uir-teal); body text 1rem; eyebrow defaults to "DEFINITION" (provided in envelope by Ethan; not injected by widget).
**Not matched:** none.

---

## faq — Content and Guidance
**Date:** 2025-07-10
**Files:** `widgets/faq.js`, `widgets/faq.css`, manifest line `{ name: 'faq', css: true }`
**States:** default (details open); collapsed (user closes); empty (fallback text)
**Design matched:** content-guidance.png — stacked <details open> blocks with --uir-sage-tint bg, --uir-radius-sm, 10px gap; help-circle icon + bold question in <summary>; answer in --uir-muted below; native default triangle marker removed; focus-visible outline on summary; prefers-reduced-motion guard.
**Not matched:** none.

---

## paths (directory_tree + file_reference) — Code and Files
**Date:** 2025-07-10
**Files:** `widgets/paths.js`, `widgets/paths.css`, manifest line `{ name: 'paths', css: true }`
**States:** default; empty/missing path (notice fallback)
**Design matched:** content-guidance.png — directory_tree renders path array as monospace breadcrumb in --uir-sand body, separators muted, last segment bold; file_reference adds "Lines N–M" pill (--uir-sand bg, 999px radius, --uir-mono, --uir-teal) and reason paragraph. Shared buildBreadcrumb() helper keeps both DRY.
**Not matched:** none.

---

---

## database_schema — Diagrams
**Date:** 2025-07-14
**Files:** `widgets/database-schema.js`, `widgets/database-schema.css`, manifest line `{ name: 'database-schema', css: true }`
**States:** default (table grid + index chips), PK row (warm-chip bg), FK row (sage-tint bg), highlighted chip (sage-tint bg + line-strong border), empty/missing tables (notice)
**Design matched:** CSS-grid `repeat(auto-fill, minmax(260px, 1fr))`; teal header (table name left, N cols right in white/muted); column rows in mono with type + constraints; PK=warm-chip, FK=sage-tint row bg; border `1px solid --uir-line-strong` + `--uir-radius-sm`; index chips as 999px pills; highlighted chip gets sage-tint + line-strong border. No bare — standard card wraps.
**Not matched:** none.

---

## api_flow — Diagrams
**Date:** 2025-07-14
**Files:** `widgets/api-flow.js`, `widgets/api-flow.css`, manifest line `{ name: 'api-flow', css: true }`
**States:** default (groups present), empty (groups missing/empty → ctx.notice info)
**Design matched:** flex-wrap grid of group column cards; tone-mapped group headers (dark→--uir-slate, green→--uir-teal, light→--uir-sage); method pills (GET→--uir-sage-tint, POST→--uir-teal, PATCH→--uir-sage, DELETE→--uir-slate); mono path text; muted result text with → arrow; legend bar of 4 method pills at top; common_errors footer with --uir-warm-chip chips; collapses to single column below 540 px; prefers-reduced-motion respected.
**Not matched:** No design PNG found in docs/renderer/design/ (none present on disk) — implemented from design tokens and spec description only.

## flowchart / architecture_diagram — Diagrams and Architecture
**Date:** 2025-07-14
**Files:** `widgets/flowchart.js`, `widgets/flowchart.css`, manifest line `{ name: 'flowchart', css: true }`
**States:** default (structured row), emphasis node (teal bg + white text), tone:sand node, missing-payload notice, branch-detected fallback (drawMermaid)
**Design matched:** diagrams.png top card "Request Lifecycle" — horizontal flex-wrap row of rounded-box nodes; bold label + small sub below; `--uir-sage-tint` default bg; `--uir-teal` emphasis bg with white text; `--uir-sand` tone:sand bg; edge connector = tiny uppercase label above `→` arrow in `--uir-soft-text`; node border `1px solid --uir-line-strong`. `architecture_diagram` registered with the same def.
**Not matched:** none.

---

## er_diagram — Diagrams
**Date:** 2025-07-14
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
**Date:** 2025-07-14
**Files:** `widgets/class-diagram.js`, `widgets/class-diagram.css`, manifest line `{ name: 'class-diagram', css: true }`
**States:** default (full render), empty (notice when `classes` missing or empty array)
**Design matched:** diagrams.png class diagram spec — responsive 3-column CSS grid of class boxes (collapses to 2-col ≤900px, 1-col ≤640px); each box has tone-colored header bar (`--uir-slate` for dark, `--uir-teal` for green, `--uir-muted` for grey) with white bold name and optional italic `«stereotype»`; `--uir-sand` attribute section with mono font; white method section with mono font; sections divided by `--uir-line-strong` 1px border; relations listed below grid in `--uir-soft-text` mono text: `extends` shown as `↑ extends`, `association` shown as `◇──  from_card ── label ── to_card ── to`.
**Not matched:** none.
