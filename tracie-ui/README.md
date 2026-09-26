# Tracy

Tracy is a project-intelligence interface with chat, canvas previews, pending document updates, practice tools, and a component gallery.

## Requirements

- Node.js 18.18 or newer
- pnpm 12 or newer

## Install

```bash
pnpm install
```

## Run locally

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The app uses Next.js development mode with hot reload. Changes made in `app/` and `public/` are reflected automatically.

## Production run

Build the application:

```bash
pnpm build
```

Start the production server:

```bash
pnpm start
```

The production app is available at [http://localhost:3000](http://localhost:3000) by default.

## API integration

Chat requests are sent from the interface to:

```text
POST /api/query
```

The current request body is:

```json
{
  "query": "Get me a database schema of the project",
  "repoId": "TRACiE",
  "sessionId": "tracie-session"
}
```

The UI accepts a response containing either `widgets` or a single `widget`, plus an optional `answer` or `message`:

```json
{
  "answer": "Here is the requested project output.",
  "widgets": [
    {
      "type": "schema",
      "title": "Database schema",
      "data": {}
    }
  ]
}
```

Returned widget JSON is displayed in the canvas. If the API is unavailable, the interface displays an error state while preserving the submitted request.

## Main project files

- `app/page.tsx` — Tracy workspace UI and interactions
- `app/globals.css` — Tracy layout, colors, responsive styles, and widget styles
- `app/layout.tsx` — application metadata and root layout
- `public/` — static assets

## Available scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Run the production build |

## Notes

- The project uses pnpm; keep `pnpm-lock.yaml` committed when dependencies change.
- The frontend currently uses local UI state for the prototype interactions. Connect persistent chat, repository, document, and widget data through the API contract above as backend endpoints become available.
- Use the app settings to switch between light and dark mode.
- Use Component Gallery to inspect the default widget forms and open an explanation for each widget.
