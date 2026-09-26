# UIRenderer: Plan and Bob Prompt Pack (Romel)

Deadline: **Sunday 27 Sep, 3:00 PM GMT** (Ghana time = GMT, no conversion).
Feature freeze: **Sunday 9:00 AM GMT**. After that: bug fixes, screenshots, statements, video only.

---

## 0. The strategy in one paragraph

The demo shows maybe 6 widgets. Build those first and make them excellent, then widen.
Every widget follows the same loop: fixture (contract) → Bob builds it in one precise task → you check it in the lab → screenshot the Bob summary → commit.
Families run as parallel Bob subtasks, because the challenge explicitly rewards parallel tasks and subagents.

### Demo path (build in this order of importance)
1. "Give me an overview of this project" → **composite**: overview + flowchart + checklist
2. "How does auth work?" → **flowchart** or sequence diagram + **code_snippet** with citations
3. "Show me the database" → **database_schema** or **er_diagram** (matches the "Get database schema" card)
4. Practice tools menu → **quiz**, **code_exercise**, **flashcards**, **audio**

---

## 1. One time setup (20 min)

1. **Check your Bob version** (Help / About). The hackathon is Bob 2.0; make sure you are on 2.0.2 or later.
2. Unzip this kit into the repo root on branch `feat/ui-renderer`. Commit it before any Bob work:
   `renderer: scaffold (written outside Bob)`. This keeps your Bob evidence honest.
3. Put the SRS docx in `docs/`. Create an empty `logs/BUILD_LOG.md`.
4. Open the Bob chat: `Ctrl + Alt + B` (Windows) or `Option + Command + B` (Mac).
5. **Permissions** (bottom right of the chat): auto approve **Read only**. Approve edits and commands yourself.
   Turn on auto approve for **Skills** so the widget skill loads without asking every time.
6. **Settings → Chat → Task retention:** your tasks delete after 14 days by default. Pin important tasks.
   Do not set it to 0 unless you are on 2.0.3 or later.
7. **Settings → Skills tab:** confirm `uirenderer-widget` is listed (it lives in `.bob/skills/`).
8. **AGENTS.md:** check if the repo already has one. If not, run `/init` once and push immediately,
   so four teammates do not generate four conflicting copies.
9. Serve the lab: `npx serve frontend/renderer`, open `/renderer-lab.html`, click Run all fixtures.
   Expected: 11 ok, 14 TODO, 0 THROWS.

---

## 2. How to get the best UI out of Bob

1. **Right mode for the job.** Bob has three modes. **Ask** reads only (safe exploring). **Plan** designs before coding.
   **Agent** writes code. Switch with the dropdown or `/ask`, `/plan`, `/agent`.
2. **Plan, then new task, then Agent.** For complex widgets: Plan mode writes a plan file, you read it,
   then click **+** (new task) so the planning chatter does not eat context, switch to Agent and say
   "Implement the plan in `/docs/renderer/plans/<widget>.md`".
3. **Fixture first, always.** Bob copies shapes it can see. The fixture removes all guessing.
4. **Name every state** in the prompt. Silence gets you one state.
5. **Use @ mentions with a leading slash:** `@/frontend/renderer/widget-fixtures.js`. The SRS docx can be
   attached directly. Try attaching the design PNG; if Bob rejects images, the prompts describe the design.
6. **One widget per task for Tier 1.** Start a new task (+) for each widget. Fresh context, sharper output.
7. **Subagents for families.** Say "use subagents to build these in parallel". You approve each spawn.
   This is exactly the "parallel tasks and subagents" the judges look for.
8. **Bob cannot see the browser.** You are the visual check. Give feedback in numbers:
   "option padding 14px, gap 10px, letter badge 28px", never "make it nicer".
9. **Bad output? Roll back, do not argue.** Hover the prompt you want to return to and click **Rollback**,
   then rephrase. Correcting flawed output with more instructions wastes Bobcoins.
10. **Watch the Bobcoin gauge** (top right of the Bob panel). Precise prompts are cheap; vague ones are expensive.
11. **Screenshot the task summary the moment a task finishes** into `bob_sessions/romel/NN-widget.png`.
12. **Commit after every working widget:** `renderer: quiz (Bob)`.

---

## 3. The prompts (in order; start a new task for each)

Every prompt starts with "Use the uirenderer-widget skill." so Bob loads your rules.

### P0. Orientation (Ask mode, 5 min, no code)
```
Use the uirenderer-widget skill.
Read @/frontend/renderer/ui-renderer.js, @/frontend/renderer/widgets/manifest.js,
@/frontend/renderer/widgets/code-snippet.js, @/frontend/renderer/widget-fixtures.js
and @/.bob/skills/uirenderer-widget/rules.md. Also read section 23 of
@/docs/SRS_Codebase_AI_Onboarding_Assistant.docx.
Summarise in 10 lines: the envelope, how a widget registers, bare vs framed
widgets, and how diagram_source routing works. Do not write code.
```

### P1. Quiz engine + quiz (Agent mode, Tier 1)
```
Use the uirenderer-widget skill. Build the quiz widget. Design: @/docs/renderer/design/quiz.png. Fixture: quiz in
widget-fixtures.js. Pattern: @/frontend/renderer/widgets/code-snippet.js.

Create widgets/quiz.js and widgets/quiz.css, add { name: 'quiz', css: true }
to manifest.js. Register as bare: true.

Structure: a reusable question flow exposed as window.UIRPractice.questionFlow(
questions, { unitLabel, chipLabel, renderContext }) so code_exercise can reuse it.
The quiz widget calls it with unitLabel 'quizzes' and chipLabel 'Quiz'.

Card: white, 1px --uir-line border, --uir-radius, padding 22px.
Header row: "1 of N quizzes" (600 weight, small) left, pill chip "Quiz" right
(--uir-sage-soft background). Under it a 4px progress bar: track --uir-sage-soft,
fill --uir-slate, width = current/N.
Question: sans, 1.35rem, 700 weight. Hint below in --uir-soft-text.
Options: full width rows, 1px --uir-line border, radius --uir-radius-sm, gap 10px.
Each row: square letter badge A to D (--uir-sage-soft bg), option text, empty
radio circle on the right.
States:
- default as above
- hover: background --uir-sage-tint, border --uir-line-strong, letter badge white
- selected: background --uir-slate, text white, letter badge dark with white
  letter, radio becomes a filled check circle
- after selection, reveal: correct option gets a green left border (--uir-ok),
  a wrong choice gets --uir-err, and the explanation appears below the options
  in a --uir-sand box. Options lock after answering.
Footer: divider line, "Previous Question" outline pill left, "Next Question"
dark pill right. Previous disabled on the first question. On the last question
Next becomes "See results": show score "X of N correct" and a "Retry" button.
Keyboard: options are buttons, arrow keys move focus, Enter/Space selects.
Remember the selected answer per question when navigating back.
Follow the definition of done in the rules.
```

### P2. Code exercise (Agent mode, reuses the engine)
```
Use the uirenderer-widget skill. Build code_exercise. Design: @/docs/renderer/design/code-exercise.png. Fixture:
code_exercise. Reuse window.UIRPractice.questionFlow from widgets/quiz.js with
unitLabel 'code exercises', chipLabel 'Code review' and a renderContext(q) hook.

renderContext draws, above the question:
1. A repository box (white, 1px --uir-line border, --uir-radius-sm):
   row 1 = dot + bold repo_label left, scope right in --uir-teal;
   row 2 = breadcrumb from q.path joined with " / ", last segment bold.
And between the hint and the options:
2. ctx.codePanel({ file_name, language, code }) exactly as the core provides.
Options may wrap to two lines; keep the letter badge vertically centred.
Add { name: 'code-exercise', css: true } AFTER quiz in manifest.js.
Same states, reveal and keyboard behaviour as quiz. Definition of done applies.
```

### P3. Flashcards (Agent mode, Tier 1)
```
Use the uirenderer-widget skill. Build flashcards. Design: left half of @/docs/renderer/design/flashcards-audio.png.
Fixture: flashcards. bare: true. Files widgets/flashcards.js + .css, manifest line.

Layout: the card on the left, a "Progress summary" panel on the right
(stacks below on narrow widths).
Card header: "1 of N flashcards" + pill chip "Flashcard" + 4px progress bar
(same as quiz).
FRONT: big bold term (front), prompt below in muted text, then a "Click to flip"
box (--uir-sage-tint bg, --uir-line-strong border) with helper text.
BACK: bold title (back), detail paragraph, optional "Related term" box
(--uir-sage-soft bg) showing related.term and related.text. Footer: divider,
"Needs review" outline pill left, "Got it" dark pill right.
Flip: 3D rotateY 180deg, 450ms, on click or Enter/Space. Reduced motion: crossfade.
"Got it" marks learned, "Needs review" marks review; both advance to the next card.
Progress panel: "Progress summary", "Out of N flashcards in this deck", rows
Learned / Needs review with counts, a progress bar of learned/N, and a
"Review rhythm" box with a one line explanation. Counts update live.
At the end show "Deck complete" with the counts and a "Review again" button that
restarts with only the "needs review" cards. Definition of done applies.
```

### P4. Audio overview (Plan mode first, then new task in Agent mode)
```
Use the uirenderer-widget skill. Write a plan to /docs/renderer/plans/audio.md for the audio widget. Do not code yet. Design: right half of
@/docs/renderer/design/flashcards-audio.png. Fixture: audio. bare: true.

Use a hidden HTML5 <audio> element with payload.src. Reject src unless it
starts with https: or / (show a notice).
Card: title (bold sans, 1.3rem), description below in --uir-teal, round
download icon button top right (lucide 'download', only if downloadable true,
uses an <a download> link).
Row: current time left (mm:ss, bold) and total duration right (muted), a
seekable progress bar under it (track --uir-sage-soft, fill --uir-slate,
click and drag to seek, arrow keys seek 5s), and a dark pill button right:
"Pause" with pause icon while playing, "Play" with play icon while paused.
Bottom row: "-10s" outline pill left (lucide 'rotate-ccw'), speed pill centre
cycling 1× → 1.25× → 1.5× → 2× → 1×, "+10s" outline pill right (lucide 'rotate-cw').
States: loading (skeleton bar until loadedmetadata), playing, paused, ended
(button shows "Replay"), error (notice + transcript text if provided).
Show the transcript in a collapsible "Transcript" section if present.
Pause any other playing uir audio when one starts. Definition of done applies.
```

Then click **+** (new task), switch to **Agent**, and send:
```
Use the uirenderer-widget skill. Implement the plan in @/docs/renderer/plans/audio.md.
```

### P5. Content family (Agent mode, subagents)
```
Use the uirenderer-widget skill. Use subagents to build these in parallel, one subagent per widget. Each: fixture already exists, one widget file
plus css, one manifest line, framed widget (bare: false, the core draws eyebrow,
serif title, subtitle and badge). Design: @/docs/renderer/design/content-guidance.png.
Pattern: @/frontend/renderer/widgets/code-snippet.js.

1) overview: payload.lead in --uir-teal 600 weight, payload.body paragraph
   (max width 70ch), then a responsive 3 column grid of layer cards
   (--uir-sand bg, radius sm). Each: icon via ctx.icon(layer.icon) in a small
   white square, tag right aligned (uppercase, tiny, --uir-teal), bold title,
   muted text. highlight: true uses --uir-sage-tint bg and --uir-line-strong border.
2) glossary: the whole card body uses --uir-sand. Rows: term (bold, 35% width)
   and definition (muted), separated by 1px --uir-line. Two columns collapse to
   stacked on narrow widths.
3) definition: phonetic in italic muted text top right of the header area
   (render it as the first line of the body aligned right if simpler), then
   "NOUN · ARCHITECTURE" (part_of_speech + domain, uppercase tiny --uir-teal),
   then body at 1rem. Eyebrow defaults to DEFINITION.
4) faq: items as stacked blocks (--uir-sage-tint bg, radius sm, gap 10px). Each
   block: help-circle icon + bold question, answer below in muted text.
   Blocks are <details> open by default so they collapse with keyboard.
Then a 5th subtask:
5) directory_tree and file_reference in one file widgets/paths.js:
   directory_tree renders payload.path as a breadcrumb ("repository / backend /
   auth / session.ts"), separators muted, last segment bold; card uses --uir-sand.
   file_reference renders the same breadcrumb, then "Lines start–end" as a mono
   pill, then payload.reason as text.
Report which subtasks passed "Run all fixtures".
```

### P6. Diagram family (Agent mode, subagents)
```
Use the uirenderer-widget skill. Use subagents to build these in parallel, one subagent per widget. All framed widgets, structured JSON only (Mermaid
text is already handled by the core). Design: @/docs/renderer/design/diagrams.png.
If a payload is missing its structured fields, show a notice.

1) flowchart (also register architecture_diagram with the same renderer):
   horizontal row of nodes in edge order, wrapping on narrow widths. Node: rounded
   box, 1px --uir-line-strong, --uir-sage-tint bg, bold label + small sub.
   emphasis: true → --uir-teal bg, white text. tone 'sand' → --uir-sand bg.
   Between nodes: edge label (tiny, --uir-soft-text) above a → arrow.
   If edges branch (a node with 2+ outgoing edges), convert nodes/edges to
   Mermaid flowchart text and call ctx.drawMermaid instead.
2) class_diagram: grid of class boxes. Header bar: tone dark → --uir-slate,
   green → --uir-teal, grey → --uir-muted, white text, "«abstract» Name" when
   stereotype set. Attribute section on --uir-sand, method section white,
   mono font. Relations listed under the grid as a line of text:
   "Repository ◇── 0..* ── Collaborator ── 1 ── User", "extends" shown as
   "↑ extends" between rows.
3) er_diagram: the card body uses --uir-sand. Entity cards: header --uir-teal
   with white bold name, fields list with key icons (lucide 'key' for PK, 'link'
   for FK), note text muted. Relations as small labels "1 owns N" between cards.
4) database_schema: a column per table (3 across, wrapping). Table header
   --uir-teal bg, white name, "N cols" right. Rows: name left, "type constraints"
   right in tiny muted mono. PK row --uir-warm-chip bg, FK row --uir-sage-tint.
   Under the tables: index chips, highlight: true gets --uir-sage-tint + border.
5) api_flow: columns of groups. Group header by tone (dark → --uir-slate,
   green → --uir-teal, light → --uir-sage). Rows: method pill + mono path +
   "→ result" muted. Method pills: GET --uir-sage-tint, POST --uir-teal white,
   PATCH --uir-sage, DELETE --uir-slate white. Footer: "Common errors:" then
   --uir-warm-chip pills. Also show the 4 method legend pills in the header badge area.
6) commit_history (also register timeline with the same renderer, mapping
   events {date,label,detail} to commits {when,message,detail}): vertical line
   with dots, first dot filled --uir-teal. Row: mono SHA chip, "when · author"
   muted, optional tag pill; bold message; detail muted.
```

### P7. Tier 2 fill (Agent mode, subagents)
```
Use the uirenderer-widget skill. Use subagents in parallel, one per item. Framed widgets in the same visual language, fixtures exist
or add them first:
1) checklist: interactive checkboxes, done items struck through, "X of N done".
2) steps renderer in widgets/steps.js registering tutorial, learning_path and
   workflow: numbered circles joined by a vertical line, title + markdown body.
   learning_path shows a progress bar of completed steps.
3) diff: unified diff lines, + rows --uir-sage-tint, - rows light red tint,
   mono, line prefix column, file_name header like codePanel.
4) table renderer in widgets/table.js registering comparison and
   request_response: payload { columns: [], rows: [[]] }, zebra rows --uir-sand.
Add fixtures for any type missing one.
```

### P8. Hardening (Plan mode, then new task in Agent mode)
```
Use the uirenderer-widget skill. Review frontend/renderer against SRS sections 7.4, 20.1, 23.2, 25 and 26.3.
List gaps as a checklist before changing anything. Then:
1) Keyboard: every interactive widget reachable and usable with Tab/Enter/Space.
2) Every widget handles an empty payload with a notice (add *_empty fixtures).
3) Confirm Mermaid only loads when a diagram_source is rendered.
4) Make UIRenderer.list() return label and category for every type (for the
   Component Gallery) and write docs/renderer/GALLERY.md listing them.
Do not edit ui-renderer.js unless a gap truly requires it; if so, explain first.
```

Then new task, **Agent** mode: "Use the uirenderer-widget skill. Fix the gaps in the checklist above, one at a time."

---

## 4. Integration with Newlove's shell (send him this)

```html
<!-- in <head> -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:wght@500;600&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/line-numbers/prism-line-numbers.min.css" rel="stylesheet">
<link href="/renderer/ui-renderer.css" rel="stylesheet">
<!-- before </body> -->
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/line-numbers/prism-line-numbers.min.js"></script>
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<script src="/renderer/ui-renderer.js"></script>
<script src="/renderer/widgets/manifest.js"></script>
```
```js
await window.UIRendererReady;
UIRenderer.setCanvas(document.querySelector('#canvas-body'))   // the panel body, not the whole panel
          .setOptions({ hideHeader: true });                    // his panel already shows the title
// when a response arrives:
chatBubble.textContent = UIRenderer.messageOf(json);            // short sentence for the bubble
panelTitle.textContent  = json.title || 'Result';
UIRenderer.render(json);                                        // widget into the canvas
```
Paths depend on how the backend serves `frontend/`. Adjust `/renderer/` to match.

## 5. Contract note for Ethan (send him this)

- Every response: `{ type, message, title, payload, citations }`. `message` is one sentence for the chat bubble.
- Allowed types = the keys used in `widget-fixtures.js`. Never emit `video`, `sandbox` or `api_explorer`.
- Diagrams: prefer the structured payloads in the fixtures (nodes/edges, tables, entities). Mermaid text in `payload.diagram_source` is accepted as a fallback and for sequence, state and mind map diagrams.
- Audio: `payload.src` = the IBM TTS file URL (https), plus `description` and `transcript`.
- Paste the fixtures into the system prompt as examples. The model copies shapes it sees.

## 6. Evidence (do not skip)
- `bob_sessions/romel/` with one screenshot per prompt above, numbered.
- `logs/BUILD_LOG.md` filled by Bob per widget.
- Commit messages: `renderer: <widget> (Bob)`.
- Bob Usage Statement: core scaffold written outside Bob; all widgets built with Bob using a project skill (uirenderer-widget), Plan mode for complex widgets, subagents for the content and diagram families, and Ask mode for the SRS review.
