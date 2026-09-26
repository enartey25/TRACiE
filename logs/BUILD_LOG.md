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
