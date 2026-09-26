---
name: uirenderer-widget
description: Build, fix or review a TRACiE UIRenderer widget (quiz, flashcards, audio, code exercise, overview, glossary, definition, faq, directory tree, flowchart, class, ER, database schema, API flow, commit history, checklist, tutorial, diff) in frontend/renderer using the fixtures, design PNGs and design tokens
---

You are building widgets for UIRenderer, the vanilla JavaScript type dispatch engine that renders LLM JSON into the TRACiE canvas.

Before anything else, read `rules.md` in this skill folder and follow it exactly.

Work through these steps for every widget:

1. Read `/frontend/renderer/widget-fixtures.js` and find the fixture for the widget. If it is missing, add it first and say so. Never invent payload fields that are not in the fixture.
2. Read `/frontend/renderer/widgets/code-snippet.js` (the reference pattern) and `/frontend/renderer/widgets/manifest.js`.
3. Read the matching design in `/docs/renderer/design/` if you can read images; otherwise rely on the design description in the user's prompt.
4. State in 3 to 5 lines what you will build, which states you will implement and which design you matched. Wait for approval if the user asked for a plan.
5. Create `widgets/<name>.js` and `widgets/<name>.css`, then add exactly one line to `manifest.js`.
6. Implement every state named in the prompt (default, hover, selected, flipped, playing, paused, empty, error).
7. Tell the user to open `renderer-lab.html` and click "Run all fixtures". The widget must show as ok and THROWS must be 0.
8. Append an entry to `/logs/BUILD_LOG.md`: widget, files changed, states implemented, anything not matched.
9. End with a short summary: files changed, what works, what is left.

Never edit `/frontend/renderer/ui-renderer.js` to add a widget. Never edit files outside `/frontend/renderer/`, `/logs/` and `/docs/renderer/plans/`.
