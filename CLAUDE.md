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

The app is a single-page static tool: read `?url=` from the query string, fetch a remote Markdown file, render it with Vditor, and let the user toggle between read-only preview and edit mode. Two optional query params (`?toolbar=1`, `?outline=0`) control whether the toolbar and outline mount; see Data flow below for defaults.

### Data flow

`main.ts` orchestrates the pipeline. Query-string params drive which optional UI mounts:

- `?url=` (required) - md source URL
- `?toolbar=1` (default **off**) - show the toolbar; `parseToolbarParam` only accepts `1`/`true`
- `?outline=0` (default **on**) - disable the outline; `parseOutlineParam` treats absence as on, `0`/`false` as off

```
window.location.search
  -> parseUrlParam() -> string | null
  -> loadMd(url) -> FetchResult ({ ok: true, md } | { ok: false, error: FetchError })
  -> on error: renderError() with getErrorMessage(error)
  -> on ok: vditor.init(editorEl, md)
       ├─ parseToolbarParam? -> mountToolbar(toolbarEl, { vditor, sourceUrl, outlineEl })
       │                       + body.show-toolbar; returns ToolbarHandle
       └─ parseOutlineParam(默认开) -> mountOutline(outlineEl, editorEl)
             ├─ 有标题 -> ToolbarHandle.setOutlineToggleAvailable()
             │           + mountResizer(resizerEl, outlineEl)
             └─ 无标题 -> outline.classList.add('outline-hidden')
```

### DOM skeleton

`index.html` ships a fixed skeleton that `main.ts` queries by id:

```
#toolbar                 (mountToolbar fills this; hidden until body.show-toolbar)
#app
  ├─ #outline            (mountOutline target)
  ├─ .resizer#resizer    (mountResizer drag handle)
  └─ #editor             (Vditor mounts here)
```

### FetchError discriminated union is the backbone

`load-md.ts` defines `FetchError` as a tagged union (`kind`: `no_url` | `network` | `cors` | `http` | `empty`). This single type flows through `loadMd` -> `main` -> `getErrorMessage`, which `switch`es on `kind` to produce Chinese user-facing messages. When adding new failure modes, extend the union and the `switch` in `getErrorMessage` together — the compiler will flag the missing case.

### Vditor mode switching (key design choice)

Vditor is instantiated **once** in `sv` (split-view) mode. Preview/edit toggling is done by **adding/removing CSS classes** (`mode-preview` / `mode-edit`) on the editor container — NOT by calling Vditor's API to switch modes or re-instantiating. The CSS in `style.css` shows/hides `.vditor-sv` accordingly and hides Vditor's built-in `.vditor-preview__action` toolbar. Avoid re-creating the Vditor instance on mode switch; this is intentional for performance.

### Module boundaries

- `load-md.ts` — pure fetch + error classification, no DOM. 10s `AbortController` timeout. Easy to test by mocking `global.fetch`.
- `vditor-instance.ts` — wraps `Vditor` behind `IVditorInstance` interface so tests can mock it without loading the real Vditor (which needs a real DOM).
- `toolbar.ts` — pure DOM manipulation. `mountToolbar` builds buttons imperatively (mode toggle / export / copy / source link / outline toggle); `extractFilename` is exported separately for unit testing. Accepts an optional `outlineEl` and returns a `ToolbarHandle` whose `setOutlineToggleAvailable()` unhides the outline toggle button (called by `main` after headings are confirmed).
- `outline.ts` — scroll-spy outline. `findActiveIndex(tops, threshold, atBottom)` is a **pure function** (testable without jsdom layout). `waitForHeadings` polls every 100ms up to 5s (`POLL_TIMEOUT`) because Vditor renders preview HTML asynchronously. Returns `OutlineHandle.destroy()` to detach scroll/wheel/touch listeners.
- `divider.ts` — pointer-drag resizer for the outline width. `clampWidth` is a pure function. Uses pointer capture + `pointercancel` fallback; dblclick resets to `DEFAULT_WIDTH` (260px, clamped to 160-480). Reads width from `el.style.width` (string), **not** `offsetWidth` — jsdom does no layout so `offsetWidth` is always 0.
- `main.ts` — the only module that touches `window.location` and ties everything together. Exports pure helpers `parseUrlParam` / `parseToolbarParam` / `parseOutlineParam` / `getErrorMessage` for unit testing. Toolbar is **off by default**; outline is **on by default**.

### Testing patterns

- **Co-located tests**: every `src/*.ts` has a `*.test.ts` next to it.
- **Module isolation in `main.test.ts`**: mocks **five** modules — `./load-md`, `./vditor-instance`, `./toolbar`, `./outline`, `./divider`. Mocks must be declared before the imports of those modules.
- **`load-md.test.ts`**: replaces `global.fetch` per test; uses `vi.useFakeTimers()` for the timeout case.
- **Outline without layout**: jsdom does no layout, so `outline.test.ts` exercises `findActiveIndex(tops, threshold, atBottom)` directly with synthetic numbers rather than driving real scroll metrics.
- **Divider width assertions**: `divider.test.ts` asserts on `outlineEl.style.width` (the inline string set by `mountResizer`), never on `offsetWidth`/`clientWidth` (both 0 in jsdom).
- **jsdom gaps**: `URL.createObjectURL` / `revokeObjectURL` are not implemented — stub them before testing the export button. `navigator.clipboard` must be defined via `Object.defineProperty` for copy tests.
- **Mock Vditor factory**: `createMockVditor()` / `createMockVditorInstance()` return an `IVditorInstance` with `vi.fn()` methods; reuse this pattern rather than mocking the real Vditor.

## Build / Deploy

`vite.config.ts` sets `base: './'` so the build uses relative paths — `dist/` can be dropped onto any static host (GitHub Pages, Netlify, Nginx) without path configuration. No server component; all fetching happens client-side and is subject to browser CORS — only CORS-friendly sources work (GitHub raw, jsdelivr, etc.).
