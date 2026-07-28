# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # Production build to dist/
npm run preview      # Preview built dist/
npm test             # Run all tests once (vitest run)
npm run test:watch   # Watch mode

# Run a single test file / by pattern
npx vitest run src/load-md.test.ts
npx vitest run -t "returns ok with md content"
```

Tests use Vitest with `globals: true` (no need to import `describe`/`it`/`expect` in most cases) and `jsdom` environment.

## Architecture

The app is a single-page static tool: read `?url=` from the query string, fetch a remote Markdown file, render it with Vditor, and let the user toggle between read-only preview and edit mode.

### Data flow

`main.ts` orchestrates a linear pipeline:

```
window.location.search
  -> parseUrlParam() -> string | null
  -> loadMd(url) -> FetchResult (discriminated union: { ok: true, md } | { ok: false, error: FetchError })
  -> on error: renderError() with getErrorMessage(error)
  -> on ok: createVditorInstance().init(editorEl, md) + mountToolbar(toolbarEl, { vditor, sourceUrl })
```

### FetchError discriminated union is the backbone

`load-md.ts` defines `FetchError` as a tagged union (`kind`: `no_url` | `network` | `cors` | `http` | `empty`). This single type flows through `loadMd` -> `main` -> `getErrorMessage`, which `switch`es on `kind` to produce Chinese user-facing messages. When adding new failure modes, extend the union and the `switch` in `getErrorMessage` together — the compiler will flag the missing case.

### Vditor mode switching (key design choice)

Vditor is instantiated **once** in `sv` (split-view) mode. Preview/edit toggling is done by **adding/removing CSS classes** (`mode-preview` / `mode-edit`) on the editor container — NOT by calling Vditor's API to switch modes or re-instantiating. The CSS in `style.css` shows/hides `.vditor-sv` accordingly and hides Vditor's built-in `.vditor-preview__action` toolbar. Avoid re-creating the Vditor instance on mode switch; this is intentional for performance.

### Module boundaries

- `load-md.ts` — pure fetch + error classification, no DOM. 10s `AbortController` timeout. Easy to test by mocking `global.fetch`.
- `vditor-instance.ts` — wraps `Vditor` behind `IVditorInstance` interface so tests can mock it without loading the real Vditor (which needs a real DOM).
- `toolbar.ts` — pure DOM manipulation. `mountToolbar` builds buttons imperatively; `extractFilename` is exported separately for unit testing.
- `main.ts` — the only module that touches `window.location` and ties everything together.

### Testing patterns

- **Co-located tests**: every `src/*.ts` has a `*.test.ts` next to it.
- **Module isolation in `main.test.ts`**: `vi.mock('./load-md', ...)`, `vi.mock('./vditor-instance', ...)`, `vi.mock('./toolbar', ...)` — mocks must be declared before the imports of those modules.
- **`load-md.test.ts`**: replaces `global.fetch` per test; uses `vi.useFakeTimers()` for the timeout case.
- **jsdom gaps**: `URL.createObjectURL` / `revokeObjectURL` are not implemented — stub them before testing the export button. `navigator.clipboard` must be defined via `Object.defineProperty` for copy tests.
- **Mock Vditor factory**: `createMockVditor()` / `createMockVditorInstance()` return an `IVditorInstance` with `vi.fn()` methods; reuse this pattern rather than mocking the real Vditor.

## Build / Deploy

`vite.config.ts` sets `base: './'` so the build uses relative paths — `dist/` can be dropped onto any static host (GitHub Pages, Netlify, Nginx) without path configuration. No server component; all fetching happens client-side and is subject to browser CORS — only CORS-friendly sources work (GitHub raw, jsdelivr, etc.).
