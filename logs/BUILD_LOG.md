# UIRenderer Widget Build Log

---

## code_exercise

**Date:** 2025-07  
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

---

## flashcards

**Date:** 2025-07  
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
