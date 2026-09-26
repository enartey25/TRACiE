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
