# UIRenderer Widget Build Log

---

## quiz — 2025-07-01

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
