# UIRenderer rules (part of the uirenderer-widget skill)

## Project
TRACiE: a codebase aware onboarding assistant for the IBM Bob 2.0 Hackathon.
The LLM returns typed JSON. UIRenderer turns it into widgets inside the canvas panel.
Spec: docs/SRS_Codebase_AI_Onboarding_Assistant.docx (sections 7.4, 20.1, 23.2, 23.3, 26.3).
Designs: docs/renderer/design/*.png. Match them closely.

## Scope
Only edit files under frontend/renderer/, logs/ and docs/renderer/plans/. Never edit the app shell, the backend or anything in .bob/.
If a change is needed elsewhere, stop and say what is needed and why.

## Architecture (do not change)
- Core: frontend/renderer/ui-renderer.js. Do not edit it to add a widget.
- A widget = widgets/<name>.js (+ widgets/<name>.css) and ONE line in widgets/manifest.js.
- Register with UIRenderer.register(type, { category, label, bare, render(payload, ctx, env) }).
- ctx gives: h, safeMarkdown, codeBlock, codePanel, notice, icon, drawMermaid, prettyLang.
- bare: true only for quiz, code_exercise, flashcards, audio (they draw their own card). Everything else uses the core card.
- Payload shapes are defined in widget-fixtures.js. That file is the contract. Never invent fields; if a field is needed, add it to the fixture first and say so in your summary.
- Widgets must accept missing optional fields without crashing.

## Visual rules
- Use only the --uir-* CSS variables from ui-renderer.css. No hard coded hex colours in widget CSS.
- Serif (--uir-serif) for card titles and big headings only. Sans (--uir-sans) everywhere else. Mono (--uir-mono) for code, SHAs and paths.
- Class names: .uir-<widget>__<part> (BEM style). Never style bare element selectors globally.
- Radius: --uir-radius for cards, --uir-radius-sm for inner blocks, 999px for pills and buttons.
- Interactive elements need hover, focus-visible and selected/active states, plus keyboard support (Tab, Enter, Space, arrow keys where natural).
- Respect prefers-reduced-motion.
- Vanilla HTML, CSS and JavaScript only. No frameworks, no npm packages, no build step.

## Security
- LLM text goes into the DOM with textContent (via ctx.h) or ctx.safeMarkdown. Never assign payload strings to innerHTML.
- URLs from payloads (audio src, links) must start with https: or be relative; otherwise show a notice.

## Definition of done for every widget
1. Fixture exists in widget-fixtures.js and matches the design content.
2. widgets/<name>.js and widgets/<name>.css created, manifest line added.
3. Every state from the design is implemented (default, hover, selected, flipped, playing, paused, and so on).
4. Missing or malformed payload shows a notice, never an exception.
5. In renderer-lab.html, "Run all fixtures" shows the widget as ok and THROWS 0.
6. Append one entry to logs/BUILD_LOG.md: widget, files, states implemented, anything not done.

## Behaviour
- Before coding a widget, state in 3 to 5 lines what you will build and which design file you matched.
- After coding, list files changed and anything you could not match in the design.
- When unsure, ask one question instead of guessing.
