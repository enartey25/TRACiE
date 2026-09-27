# Audio Widget — Implementation Plan

## Overview

Build the `audio` UIRenderer widget (`bare: true`) that renders an HTML5 audio player
inside a self-contained card. The design source is the **right half** of
`docs/renderer/design/flashcards-audio.png` ("Audio overview widget"). The widget
uses a hidden `<audio>` element driven by `payload.src`, draws its own card shell,
and manages all playback state in vanilla JS. No frameworks, no build step.

**Fixture:** `widget-fixtures.js` → `audio` (already present — no new fields needed).  
**Files to create:** `widgets/audio.js`, `widgets/audio.css`.  
**Manifest change:** one line added to `widgets/manifest.js`.

---

## Sub-Task 1 — Fixture Audit & CSS Token Mapping

**Status:** [ ] pending

### Intent
Confirm that every payload field the widget needs is already declared in the fixture,
and identify every `--uir-*` token that will be used in the CSS. This guarantees no
invented fields and no hard-coded colours slip into later sub-tasks.

### Expected Outcomes
- A confirmed list of payload fields used by the widget.
- A confirmed list of CSS tokens used for each visual element.
- No discrepancy between what the fixture declares and what the widget will read.

### Todo List
1. Re-read the `audio` fixture in `frontend/renderer/widget-fixtures.js` (lines 327–337).
2. Cross-check required fields against the design description:
   `src`, `description`, `transcript`, `downloadable`.
3. Map each visual element to its CSS token:
   - Card background → `--uir-card`, border → `--uir-line`, shadow → `--uir-shadow`
   - Title → `--uir-text`, bold sans `1.3rem`
   - Description → `--uir-teal`
   - Progress track → `--uir-sage-soft`, fill → `--uir-slate`
   - Current-time text → `--uir-text` (bold), duration → `--uir-muted`
   - Play/Pause pill background → `--uir-slate`, text → `--uir-card`
   - Outline pills (`-10s`, `+10s`) → border `--uir-line`, text `--uir-text`
   - Speed pill → same outline style, text `--uir-text`
   - Download button → background `--uir-slate`, icon `--uir-card`
   - Transcript toggle → text `--uir-teal`, border-bottom `--uir-line`
   - Notice (error / invalid src) → `ctx.notice`
   - Skeleton bar → `--uir-sage-soft` animated shimmer
4. Confirm no fixture changes are required. If any field is missing, add it before
   proceeding to Sub-Task 2 and note it here.

### Relevant Context
- Fixture: `frontend/renderer/widget-fixtures.js` lines 327–337
- Token source: `frontend/renderer/ui-renderer.css` `:root` block
- Rules: `.bob/skills/uirenderer-widget/rules.md` (no hard-coded hex, no invented fields)

---

## Design Clarifications (confirmed by user)

1. **Layout:** The Play/Pause pill sits to the **right** of a two-row block that
   contains the time row (`current time … duration`) above the seek bar. The left
   column holds those two rows; the Play/Pause pill is a right column, vertically
   centred against that block. The `-10s` / speed / `+10s` pills are a separate
   bottom row below the entire player block.
2. **Transcript:** collapsed (`<details>` without `open`) by default.
3. **NaN/Infinity duration:** Real TTS streams may report `NaN` or `Infinity` for
   `duration` until enough data arrives. Show "--:--" and **disable seeking and
   skip buttons** until a finite duration is available. Listen for both
   `loadedmetadata` and `durationchange` and re-evaluate on each.
4. **Download link:** Browsers silently ignore the `download` attribute on
   cross-origin URLs and navigate away instead. Always set `target="_blank"`
   and `rel="noopener"` on the `<a>` so the app never navigates away from
   the page, regardless of origin.

---

## Sub-Task 2 — HTML Structure & `audio.js` Skeleton

**Status:** [ ] pending

### Intent
Create `widgets/audio.js` with the full DOM structure and the `UIRenderer.register`
call, but with no interactive behaviour yet. This gives a stable scaffold to build
states on top of in Sub-Task 3.

### Expected Outcomes
- `widgets/audio.js` exists and registers the `audio` type with `bare: true`.
- Rendering the fixture produces the card shell with title, description, time row,
  progress track, control row, and (collapsed) transcript section — all visible but
  static. No playback logic yet.
- The hidden `<audio>` element is in the DOM, `src` is set (after validation),
  and `preload="metadata"` is set so duration loads without buffering content.
- An invalid `src` shows `ctx.notice` immediately and stops rendering.

### Todo List
1. Create `frontend/renderer/widgets/audio.js` using the IIFE + strict-mode pattern
   from `flashcards.js`.
2. Register: `UIRenderer.register('audio', { category: 'Media', label: 'Audio', bare: true, render })`.
3. In `render(payload, ctx)`:
   a. Validate `payload.src` — must start with `https:` or `/`. If not, return
      `ctx.notice('Invalid audio source.')`.
   b. Create the hidden `<audio>` element with `preload="metadata"`, `src=payload.src`.
   c. Build the card root `div.uir-audio` containing:
      - Header row: `div.uir-audio__header`
        - Title `p.uir-audio__title` (textContent = payload.title)
        - Download button `a.uir-audio__download` (only when `payload.downloadable`,
          `href=payload.src`, `download` attribute, `target="_blank"`,
          `rel="noopener"`, lucide `download` icon SVG)
      - Description `p.uir-audio__desc` (textContent = payload.description)
      - Player block `div.uir-audio__player` (flex row: left column + play/pause pill)
        - Left column `div.uir-audio__player-left`:
          - Time row `div.uir-audio__time-row`
            - `span.uir-audio__current` ("0:00")
            - `span.uir-audio__duration` ("--:--")
          - Progress bar `div.uir-audio__progress`
            - `div.uir-audio__progress-track`
              - `div.uir-audio__progress-fill`
            - `input[type=range].uir-audio__seek` (min=0, step=0.1; disabled
              initially until a finite duration is known)
        - Play/Pause pill `button.uir-audio__playpause` ("Play" + play icon,
          right column, vertically centred)
      - Bottom controls row `div.uir-audio__controls`
        - `-10s` pill `button.uir-audio__skip` data-dir="-10" (disabled initially)
        - Speed pill `button.uir-audio__speed` ("1×")
        - `+10s` pill `button.uir-audio__skip` data-dir="+10" (disabled initially)
      - Transcript section `details.uir-audio__transcript` (only when
        `payload.transcript` exists):
        - `summary` → "Transcript"
        - `p` → textContent = payload.transcript
4. Append the hidden `<audio>` as a child of the card root (or document.body — card
   root is simpler and keeps it scoped).
5. Return the card root element.

### Relevant Context
- Reference pattern: `frontend/renderer/widgets/flashcards.js` (bare: true, IIFE, own `h()`)
- `ctx` API: `h`, `notice`, `icon` (lucide icon helper)
- Lucide icons needed: `download`, `play`, `pause`, `rotate-ccw`, `rotate-cw`
- Fixture fields: `src`, `title`, `description`, `transcript`, `downloadable`

---

## Sub-Task 3 — Playback State Machine & Event Wiring

**Status:** [ ] pending

### Intent
Wire all `<audio>` events to DOM mutations so the widget correctly cycles through
every required state: loading (skeleton), playing, paused, ended, and error.

### Expected Outcomes
- **Loading:** from first render until a finite duration is confirmed, the progress
  area shows a shimmer skeleton bar; duration reads "--:--"; seek and skip buttons
  are disabled.
- **Playing:** Play/Pause pill shows "Pause" + pause icon; `uir-audio--playing` class
  on root.
- **Paused:** Play/Pause pill shows "Play" + play icon.
- **Ended:** Play/Pause pill shows "Replay" + play icon; `uir-audio--ended` class.
- **Error:** `ctx.notice` is rendered above the transcript (if present).
- Time display and progress fill update on every `timeupdate` event.
- Duration display and seek/skip enable-state update on both `loadedmetadata` and
  `durationchange`; only finalised when `isFinite(audio.duration)` is true.
- Seeking via the range input updates `audio.currentTime` on `input` event.
- Arrow-key seek (5 s) works on the range input via `keydown`.
- Click-to-seek on the visual track also works (mapped to the range value).
- Speed pill cycles `audio.playbackRate` through `[1, 1.25, 1.5, 2]` on click,
  label updates to match.
- `-10s` / `+10s` buttons clamp to `[0, duration]`.
- Play/Pause pill toggles `audio.play()` / `audio.pause()`.
- When a new audio widget starts playing, all other `.uir-audio` audio elements on
  the page are paused (cross-widget coordination via `querySelectorAll`).

### Todo List
1. After building the DOM in Sub-Task 2, attach all `<audio>` event listeners inside
   `render()` (or a `wire(audioEl, elements)` helper). Define a `updateDuration()`
   helper that checks `isFinite(audio.duration)` and, if true, sets the duration
   display, removes the loading state, and enables seek/skip buttons; if false, keeps
   "--:--" and leaves buttons disabled:
   - `loadedmetadata` → call `updateDuration()`
   - `durationchange` → call `updateDuration()` (handles live/TTS streams that
     initially report NaN or Infinity)
   - `timeupdate` → update current-time display + progress fill width %
   - `play` → swap button to "Pause", add `--playing` class
   - `pause` → swap button to "Play", remove `--playing`
   - `ended` → swap button to "Replay", add `--ended` class
   - `error` → insert `ctx.notice` error message; show transcript if present
2. Wire Play/Pause button `click`:
   - If ended: reset `currentTime=0`, call `audio.play()`
   - If playing: `audio.pause()`
   - Else: `audio.play()`, then pause all other `[data-uir-audio]` elements
3. Wire seek input (`input` event): `audio.currentTime = seekInput.value`
4. Wire seek input (`keydown`): `ArrowLeft` → `−5s`, `ArrowRight` → `+5s`
5. Wire skip buttons: clamp `audio.currentTime += ±10` to `[0, duration]`
6. Wire speed pill: maintain `SPEEDS=[1,1.25,1.5,2]`, cycle index on click,
   set `audio.playbackRate`, update label
7. Mark the hidden `<audio>` with `data-uir-audio` so other instances can find it
8. Respect `prefers-reduced-motion` for the skeleton shimmer animation

### Relevant Context
- Cross-widget pause: `document.querySelectorAll('[data-uir-audio]')`
- `mm:ss` formatter: `Math.floor(t/60).toString().padStart(2,'0') + ':' + ...`
- Rules: keyboard support (Tab, Enter, Space, arrows), focus-visible states

---

## Sub-Task 4 — CSS (`audio.css`)

**Status:** [ ] pending

### Intent
Style the widget to match the right half of the design reference exactly, using only
`--uir-*` tokens and BEM class names. No hard-coded colours.

### Expected Outcomes
- Card: white background, `--uir-radius` corners, `--uir-shadow`, `--uir-line` border.
- Title: `--uir-sans`, `font-weight:700`, `1.3rem`, `--uir-text`.
- Description: `--uir-teal`, `0.875rem`.
- Download button: `40px` circle, `--uir-slate` bg, `--uir-card` icon, top-right
  absolute position.
- Time row: current time bold left, duration muted right, `0.8rem`.
- Progress track: `6px` high, `--uir-sage-soft` bg, `--uir-radius` rounded ends;
  fill `--uir-slate`; range input overlaid full-width transparent for pointer events.
- Play/Pause pill: `--uir-slate` bg, `--uir-card` text, `999px` radius, icon + label.
- Outline pills (`-10s`, `+10s`, speed): `1px solid --uir-line`, `--uir-text`,
  `999px` radius, transparent bg, hover → `--uir-sage-tint`.
- Control row: three pills evenly spaced (`space-between`).
- Transcript `<details>`: border-top `--uir-line`, `summary` cursor pointer, chevron
  rotation on open.
- Skeleton state (`.uir-audio--loading`): progress fill replaced by shimmer bar
  (`--uir-sage-soft` → `--uir-sage-tint` → `--uir-sage-soft` gradient animation).
- `prefers-reduced-motion`: disable shimmer animation, disable transitions.
- All interactive elements: `focus-visible` outline using `--uir-teal`.

### Todo List
1. Create `frontend/renderer/widgets/audio.css`.
2. Write `.uir-audio` root styles (card shell, padding `1.25rem`).
3. Write `.uir-audio__header` flex row (title fills, download absolute or flex-end).
4. Write `.uir-audio__desc` styles.
5. Write `.uir-audio__player` flex row: left column (`flex:1`) + play/pause pill
   (vertically centred, `align-self: center`).
6. Write `.uir-audio__time-row` flex row (inside left column).
7. Write `.uir-audio__progress` wrapper + track + fill + range input overlay
   (inside left column).
8. Write `.uir-audio__playpause` dark pill.
9. Write `.uir-audio__controls` bottom row + all three outline pills.
10. Write `.uir-audio__download` circle button.
11. Write `.uir-audio__transcript` details/summary styles.
12. Write `.uir-audio--loading` shimmer state (seek/skip visually dimmed via
    `opacity:0.4; pointer-events:none` when `disabled` attribute is present).
13. Write `@media (prefers-reduced-motion: reduce)` block.
14. Write `focus-visible` rules for all interactive elements.

### Relevant Context
- Token reference: `frontend/renderer/ui-renderer.css` `:root`
- Visual reference: right half of `docs/renderer/design/flashcards-audio.png`
- Pill radius rule: `999px` (from `rules.md`)
- BEM naming: `.uir-audio__<part>`, modifier `.uir-audio--<state>`

---

## Sub-Task 5 — Manifest Registration & Lab Verification

**Status:** [ ] pending

### Intent
Register the widget in the manifest so it loads in `renderer-lab.html`, then verify
all states pass the "Run all fixtures" check with THROWS = 0.

### Expected Outcomes
- `manifest.js` contains exactly one new line: `{ name: 'audio', css: true }`.
- `renderer-lab.html` → "Run all fixtures" → audio row shows **ok**, THROWS **0**.
- Loading, playing, paused, ended, error states are all reachable in the lab.
- `logs/BUILD_LOG.md` has a new entry for the audio widget.

### Todo List
1. Add `{ name: 'audio', css: true }` to the `WIDGETS` array in
   `frontend/renderer/widgets/manifest.js` (after the flashcards entry).
2. Open `renderer-lab.html` in a browser and click "Run all fixtures".
3. Confirm the audio widget row shows **ok** and **THROWS 0**.
4. Manually test each state:
   - Skeleton visible briefly on first load
   - Play → Pause toggle works
   - Seek bar drags and responds to arrow keys
   - `-10s` / `+10s` clamp correctly at boundaries
   - Speed pill cycles correctly through all four values
   - Download button only appears when `downloadable: true`
   - Transcript section opens/closes
   - Cross-widget pause (open two audio widgets, play both — second should pause first)
5. Test invalid src: temporarily set `src: 'ftp://bad'` in fixture, confirm notice shown.
6. Append entry to `logs/BUILD_LOG.md`:
   - Widget: audio
   - Files changed: `widgets/audio.js`, `widgets/audio.css`, `widgets/manifest.js`
   - States: loading, playing, paused, ended, error
   - Notes: anything not matched from the design

### Relevant Context
- Manifest: `frontend/renderer/widgets/manifest.js`
- Lab: `frontend/renderer/renderer-lab.html`
- Build log: `logs/BUILD_LOG.md`
- Clarification 3: seek and skip buttons must remain disabled and show "--:--"
  until `isFinite(audio.duration)` — test with a live-stream URL if possible.
- Clarification 4: download link always has `target="_blank" rel="noopener"` —
  verify it does not navigate away in the lab.
