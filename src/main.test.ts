import { describe, expect, it } from 'vitest'
import { getErrorMessage, parseUrlParam, parseToolbarParam, parseOutlineParam } from './main'
import type { FetchError } from './load-md'

describe('getErrorMessage', () => {
  it('returns prompt message for no_url', () => {
    const error: FetchError = { kind: 'no_url' }
    const msg = getErrorMessage(error)
    expect(msg).toContain('?url=')
    expect(msg).toContain('md文件地址')
  })

  it('returns CORS/network message for network error', () => {
    const error: FetchError = { kind: 'network' }
    const msg = getErrorMessage(error)
    expect(msg).toContain('CORS')
    expect(msg).toContain('跨域')
  })

  it('returns CORS/network message for cors error', () => {
    const error: FetchError = { kind: 'cors' }
    const msg = getErrorMessage(error)
    expect(msg).toContain('CORS')
  })

  it('returns HTTP status in message for http error', () => {
    const error: FetchError = { kind: 'http', status: 404 }
    const msg = getErrorMessage(error)
    expect(msg).toContain('404')
  })

  it('returns empty message for empty error', () => {
    const error: FetchError = { kind: 'empty' }
    const msg = getErrorMessage(error)
    expect(msg).toContain('空')
  })
})

describe('parseUrlParam', () => {
  it('returns null when no url param', () => {
    expect(parseUrlParam('')).toBeNull()
    expect(parseUrlParam('?foo=bar')).toBeNull()
  })

  it('returns null when url param is empty', () => {
    expect(parseUrlParam('?url=')).toBeNull()
  })

  it('returns the url value when present', () => {
    expect(parseUrlParam('?url=https://example.com/doc.md')).toBe('https://example.com/doc.md')
  })

  it('returns the url value when other params present', () => {
    expect(parseUrlParam('?foo=bar&url=https://example.com/doc.md&baz=1')).toBe('https://example.com/doc.md')
  })

  it('decodes URL-encoded values', () => {
    expect(parseUrlParam('?url=https%3A%2F%2Fexample.com%2Fdoc.md')).toBe('https://example.com/doc.md')
  })
})

describe('parseToolbarParam', () => {
  it('returns true for toolbar=1', () => {
    expect(parseToolbarParam('?url=xxx&toolbar=1')).toBe(true)
  })

  it('returns true for toolbar=true (case-insensitive)', () => {
    expect(parseToolbarParam('?url=xxx&toolbar=true')).toBe(true)
    expect(parseToolbarParam('?url=xxx&toolbar=TRUE')).toBe(true)
  })

  it('returns false for toolbar=0', () => {
    expect(parseToolbarParam('?url=xxx&toolbar=0')).toBe(false)
  })

  it('returns false for empty toolbar value', () => {
    expect(parseToolbarParam('?url=xxx&toolbar=')).toBe(false)
  })

  it('returns false for other values', () => {
    expect(parseToolbarParam('?url=xxx&toolbar=yes')).toBe(false)
    expect(parseToolbarParam('?url=xxx&toolbar=false')).toBe(false)
  })

  it('returns false when toolbar param is absent', () => {
    expect(parseToolbarParam('?url=xxx')).toBe(false)
  })

  it('returns false for empty search', () => {
    expect(parseToolbarParam('')).toBe(false)
  })
})

describe('parseOutlineParam', () => {
  it('returns true when outline param is absent (default show)', () => {
    expect(parseOutlineParam('?url=xxx')).toBe(true)
  })

  it('returns true for empty search', () => {
    expect(parseOutlineParam('')).toBe(true)
  })

  it('returns false for outline=0', () => {
    expect(parseOutlineParam('?url=xxx&outline=0')).toBe(false)
  })

  it('returns false for outline=false (case-insensitive)', () => {
    expect(parseOutlineParam('?url=xxx&outline=false')).toBe(false)
    expect(parseOutlineParam('?url=xxx&outline=FALSE')).toBe(false)
  })

  it('returns true for empty outline value', () => {
    expect(parseOutlineParam('?url=xxx&outline=')).toBe(true)
  })

  it('returns true for other values', () => {
    expect(parseOutlineParam('?url=xxx&outline=1')).toBe(true)
    expect(parseOutlineParam('?url=xxx&outline=yes')).toBe(true)
  })
})

import { afterEach, beforeEach, vi } from 'vitest'
import { main } from './main'

// Mock load-md module
vi.mock('./load-md', () => ({
  loadMd: vi.fn(),
}))

// Mock vditor-instance module
vi.mock('./vditor-instance', () => ({
  createVditorInstance: vi.fn(),
}))

// Mock toolbar module
vi.mock('./toolbar', () => ({
  mountToolbar: vi.fn(),
}))

// Mock outline module
vi.mock('./outline', () => ({
  mountOutline: vi.fn(),
}))

// Mock divider module
vi.mock('./divider', () => ({
  mountResizer: vi.fn(),
}))

// Import after mock declarations
import { loadMd } from './load-md'
import { createVditorInstance } from './vditor-instance'
import { mountToolbar } from './toolbar'
import { mountOutline } from './outline'
import { mountResizer } from './divider'

const mockedLoadMd = vi.mocked(loadMd)
const mockedCreateVditor = vi.mocked(createVditorInstance)
const mockedMountToolbar = vi.mocked(mountToolbar)
const mockedMountOutline = vi.mocked(mountOutline)
const mockedMountResizer = vi.mocked(mountResizer)

function createMockToolbarHandle() {
  return { setOutlineToggleAvailable: vi.fn() }
}

function createMockVditorInstance() {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    switchToPreview: vi.fn(),
    switchToEdit: vi.fn(),
    getContent: vi.fn().mockReturnValue(''),
    setContent: vi.fn(),
    destroy: vi.fn(),
  }
}

function setupDOM() {
  document.body.className = ''
  document.body.innerHTML =
    '<div id="toolbar"></div><div id="app"><aside id="outline"></aside><div class="resizer" id="resizer"></div><div id="editor"></div></div>'
}

beforeEach(() => {
  vi.clearAllMocks()
  setupDOM()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('main orchestration', () => {
  it('renders no_url error when ?url= param is missing', async () => {
    // Simulate no url param
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    })

    await main()

    expect(mockedLoadMd).not.toHaveBeenCalled()
    const editor = document.getElementById('editor')!
    expect(editor.textContent).toContain('?url=')
  })

  it('renders no_url error when ?url= is empty', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?url=' },
      writable: true,
    })

    await main()

    expect(mockedLoadMd).not.toHaveBeenCalled()
    const editor = document.getElementById('editor')!
    expect(editor.textContent).toContain('?url=')
  })

  it('inits Vditor and mounts toolbar on successful load, enables outline toggle when headings exist', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?url=https://example.com/doc.md&toolbar=1' },
      writable: true,
    })

    const mockVditor = createMockVditorInstance()
    mockedCreateVditor.mockReturnValue(mockVditor)
    mockedLoadMd.mockResolvedValue({
      ok: true,
      md: '# Hello',
      url: 'https://example.com/doc.md',
    })
    const toolbarHandle = createMockToolbarHandle()
    mockedMountToolbar.mockReturnValue(toolbarHandle)
    const outlineHandle = { destroy: vi.fn() }
    mockedMountOutline.mockResolvedValue(outlineHandle)

    await main()

    expect(mockedLoadMd).toHaveBeenCalledWith('https://example.com/doc.md')
    expect(mockedCreateVditor).toHaveBeenCalled()
    expect(mockVditor.init).toHaveBeenCalledWith(
      document.getElementById('editor'),
      '# Hello',
    )
    expect(mockedMountToolbar).toHaveBeenCalledWith(
      document.getElementById('toolbar'),
      {
        vditor: mockVditor,
        sourceUrl: 'https://example.com/doc.md',
        outlineEl: document.getElementById('outline'),
      },
    )
    expect(mockedMountOutline).toHaveBeenCalledWith(
      document.getElementById('outline'),
      document.getElementById('editor'),
    )
    expect(toolbarHandle.setOutlineToggleAvailable).toHaveBeenCalled()
    expect(mockedMountResizer).toHaveBeenCalledWith(
      document.getElementById('resizer'),
      document.getElementById('outline'),
    )
  })

  it('does not enable outline toggle when document has no headings', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?url=https://example.com/doc.md&toolbar=1' },
      writable: true,
    })

    const mockVditor = createMockVditorInstance()
    mockedCreateVditor.mockReturnValue(mockVditor)
    mockedLoadMd.mockResolvedValue({
      ok: true,
      md: 'plain text without headings',
      url: 'https://example.com/doc.md',
    })
    const toolbarHandle = createMockToolbarHandle()
    mockedMountToolbar.mockReturnValue(toolbarHandle)
    // mountOutline returns null when no headings found
    mockedMountOutline.mockResolvedValue(null)

    await main()

    expect(toolbarHandle.setOutlineToggleAvailable).not.toHaveBeenCalled()
    // 无标题 -> mountOutline 返回 null -> 不挂载 resizer
    expect(mockedMountResizer).not.toHaveBeenCalled()
  })

  it('does not mount toolbar and skips show-toolbar class when toolbar param is absent', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?url=https://example.com/doc.md' },
      writable: true,
    })

    const mockVditor = createMockVditorInstance()
    mockedCreateVditor.mockReturnValue(mockVditor)
    mockedLoadMd.mockResolvedValue({
      ok: true,
      md: '# Hello',
      url: 'https://example.com/doc.md',
    })
    const outlineHandle = { destroy: vi.fn() }
    mockedMountOutline.mockResolvedValue(outlineHandle)

    await main()

    expect(mockedMountToolbar).not.toHaveBeenCalled()
    expect(document.body.classList.contains('show-toolbar')).toBe(false)
    // outline still mounts even without toolbar
    expect(mockedMountOutline).toHaveBeenCalled()
  })

  it('adds show-toolbar class and mounts toolbar when toolbar=1', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?url=https://example.com/doc.md&toolbar=1' },
      writable: true,
    })

    const mockVditor = createMockVditorInstance()
    mockedCreateVditor.mockReturnValue(mockVditor)
    mockedLoadMd.mockResolvedValue({
      ok: true,
      md: '# Hello',
      url: 'https://example.com/doc.md',
    })
    const toolbarHandle = createMockToolbarHandle()
    mockedMountToolbar.mockReturnValue(toolbarHandle)
    const outlineHandle = { destroy: vi.fn() }
    mockedMountOutline.mockResolvedValue(outlineHandle)

    await main()

    expect(document.body.classList.contains('show-toolbar')).toBe(true)
    expect(mockedMountToolbar).toHaveBeenCalled()
  })

  it('skips outline mounting when outline=0 even if document has headings', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?url=https://example.com/doc.md&outline=0' },
      writable: true,
    })

    const mockVditor = createMockVditorInstance()
    mockedCreateVditor.mockReturnValue(mockVditor)
    mockedLoadMd.mockResolvedValue({
      ok: true,
      md: '# Hello\n## World',
      url: 'https://example.com/doc.md',
    })
    const outlineHandle = { destroy: vi.fn() }
    mockedMountOutline.mockResolvedValue(outlineHandle)

    await main()

    expect(mockedMountOutline).not.toHaveBeenCalled()
    expect(mockedMountResizer).not.toHaveBeenCalled()
  })

  it('renders HTTP error on 404', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?url=https://example.com/missing.md' },
      writable: true,
    })

    mockedLoadMd.mockResolvedValue({
      ok: false,
      error: { kind: 'http', status: 404 },
    })

    await main()

    expect(mockedCreateVditor).not.toHaveBeenCalled()
    const editor = document.getElementById('editor')!
    expect(editor.textContent).toContain('404')
  })

  it('renders network/CORS error on network failure', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?url=https://example.com/doc.md' },
      writable: true,
    })

    mockedLoadMd.mockResolvedValue({
      ok: false,
      error: { kind: 'network' },
    })

    await main()

    const editor = document.getElementById('editor')!
    expect(editor.textContent).toContain('CORS')
  })

  it('renders empty error on empty content', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?url=https://example.com/empty.md' },
      writable: true,
    })

    mockedLoadMd.mockResolvedValue({
      ok: false,
      error: { kind: 'empty' },
    })

    await main()

    const editor = document.getElementById('editor')!
    expect(editor.textContent).toContain('空')
  })
})
