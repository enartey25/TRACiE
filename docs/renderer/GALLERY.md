# UIRenderer Component Gallery

> Auto-generated reference for the Component Gallery (SRS §7.4 FR-24).
> Source of truth: `UIRenderer.list()` at runtime.
> Labels are explicit in every `register()` call — no auto-fallback used.

## Widget Table

| Type | Label | Category | Bare | Notes |
|------|-------|----------|------|-------|
| `chat_response` | Chat response | Content and Guidance | no | Generic markdown card |
| `summary` | Summary | Content and Guidance | no | Generic markdown card |
| `explanation` | Explanation | Content and Guidance | no | Generic markdown card |
| `tip` | Tip | Content and Guidance | no | Generic markdown card |
| `warning` | Warning | Content and Guidance | no | Generic markdown card |
| `best_practice` | Best practice | Content and Guidance | no | Generic markdown card |
| `citation` | Citation | Content and Guidance | no | Generic markdown card |
| `overview` | Overview | Content and Guidance | no | Layered architecture card |
| `glossary` | Glossary | Content and Guidance | no | Term/definition list |
| `definition` | Definition | Content and Guidance | no | Dictionary-style entry |
| `faq` | FAQ | Content and Guidance | no | `<details>` accordion |
| `comparison` | Comparison table | Content and Guidance | no | Side-by-side table |
| `timeline` | Timeline | Content and Guidance | no | Alias for commit_history |
| `code_snippet` | Code snippet | Code and Files | no | Prism-highlighted code panel |
| `directory_tree` | Directory tree | Code and Files | no | Breadcrumb path display |
| `file_reference` | File reference | Code and Files | no | File + line range reference |
| `diff` | Diff | Code and Files | no | Unified diff with +/− rows |
| `request_response` | Request / Response | Code and Files | no | Two-column HTTP table |
| `commit_history` | Commit history | Code and Files | no | SHA timeline |
| `flowchart` | Flowchart | Diagrams and Architecture | no | SVG node-edge diagram |
| `architecture_diagram` | Flowchart | Diagrams and Architecture | no | Alias for flowchart |
| `class_diagram` | Class diagram | Diagrams | no | UML-style class boxes |
| `er_diagram` | ER Diagram | Diagrams | no | Entity-relationship table |
| `database_schema` | Database schema | Diagrams | no | Table + column definitions |
| `api_flow` | API flow | Diagrams | no | Grouped REST endpoint list |
| `sequence_diagram` | Sequence diagram | Diagrams and Architecture | no | Mermaid fallback notice¹ |
| `state_diagram` | State diagram | Diagrams and Architecture | no | Mermaid fallback notice¹ |
| `mindmap` | Mind map | Diagrams and Architecture | no | Mermaid fallback notice¹ |
| `dependency_graph` | Dependency graph | Diagrams and Architecture | no | Mermaid fallback notice¹ |
| `data_flow` | Data flow | Diagrams and Architecture | no | Mermaid fallback notice¹ |
| `component_diagram` | Component diagram | Diagrams and Architecture | no | Mermaid fallback notice¹ |
| `system_diagram` | System diagram | Diagrams and Architecture | no | Mermaid fallback notice¹ |
| `tutorial` | Tutorial | Workflows | no | Numbered steps |
| `learning_path` | Learning path | Workflows | no | Numbered steps with done state |
| `workflow` | Workflow | Workflows | no | Numbered steps |
| `checklist` | Checklist | Workflows | no | Checkbox list |
| `quiz` | Quiz | Practice | **yes** | Multi-question interactive quiz |
| `code_exercise` | Code exercise | Practice | **yes** | Code-reading quiz |
| `flashcards` | Flashcards | Practice | **yes** | Flip-card deck |
| `audio` | Audio | Media | **yes** | Audio player with transcript |

¹ These types are handled directly by the core when `payload.diagram_source` is present
(Mermaid is loaded and rendered). The widget's own `render()` is only reached when
`diagram_source` is absent, in which case it shows a warning notice.

---

## Mermaid Lazy-Loading Confirmation (GAP-M1)

**Status: verified — no code change required.**

Mermaid is loaded lazily from the CDN **only when a `diagram_source` string is present**
on the payload of a diagram type. The exact guard in `ui-renderer.js` (lines 169–170):

```js
if (type && DIAGRAM_TYPES.has(type) && typeof env.payload.diagram_source === 'string') {
  return { node: frame(type, env, mermaidFigure(env.payload)), badge: `${type} (mermaid)` };
}
```

`loadMermaid()` (line 218) is gated by a module-level promise (`mermaidPromise`) so the
CDN import fires at most once per page load, and only when the above condition is true.

`mermaid-diagrams.js` — the widget file for `sequence_diagram`, `state_diagram`, etc. —
does **not** call `ctx.drawMermaid()` itself. Its `render()` function is only reached
when `diagram_source` is absent; in that case it emits a warning notice without loading
Mermaid at all. When `diagram_source` is present, the core short-circuits at line 169
and never calls `render()`.

This means:
- Rendering a `flowchart`, `checklist`, `quiz`, or any non-diagram widget **never** loads Mermaid.
- Mermaid is loaded at most once, on first render of any widget with a `diagram_source` field.

Live regression fixtures: `sequence_diagram`, `mermaid_route_test`, `broken_mermaid_test`
in `renderer-lab.html`.

---

## Empty-Payload Regression (GAP-E2)

The "Run all fixtures" button in `renderer-lab.html` runs two passes:

1. **Named fixtures** — every key in `window.WIDGET_FIXTURES`.
2. **Auto empty-payload pass** — `{ type, payload: {} }` for every type in
   `UIRenderer.list()`, reported as `<type>_empty`. Any newly registered widget is
   automatically included without touching `widget-fixtures.js`.

Two explicit audio fixtures are in `widget-fixtures.js` for the security guard:
- `audio_empty` — `payload: {}` → "Invalid audio source." notice.
- `audio_bad_src` — `payload: { src: 'http://bad' }` → same notice (http: disallowed).
