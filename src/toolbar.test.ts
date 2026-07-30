import { describe, expect, it } from 'vitest'
import { extractFilename } from './toolbar'

describe('extractFilename', () => {
  it('extracts last path segment with .md extension', () => {
    expect(extractFilename('https://example.com/docs/readme.md')).toBe('readme.md')
  })

  it('strips query string', () => {
    expect(extractFilename('https://example.com/readme.md?foo=bar&baz=1')).toBe('readme.md')
  })

  it('strips hash fragment', () => {
    expect(extractFilename('https://example.com/readme.md#section')).toBe('readme.md')
  })

  it('returns last segment even without .md extension', () => {
    expect(extractFilename('https://example.com/path/readme')).toBe('readme')
  })

  it('returns document.md for URL with empty last segment (trailing slash)', () => {
    expect(extractFilename('https://example.com/path/')).toBe('document.md')
  })

  it('returns document.md for URL with no path', () => {
    expect(extractFilename('https://example.com')).toBe('document.md')
  })

  it('decodes URL-encoded characters', () => {
    expect(extractFilename('https://example.com/path/my%20file.md')).toBe('my file.md')
  })

  it('returns document.md for invalid URL string', () => {
    expect(extractFilename('not-a-url')).toBe('document.md')
  })
})

import { afterEach, beforeEach, vi } from 'vitest'
import { mountToolbar } from './toolbar'
import type { IVditorInstance } from './vditor-instance'

function createMockVditor(): IVditorInstance {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    switchToPreview: vi.fn(),
    switchToEdit: vi.fn(),
    getContent: vi.fn(() => '# Hello'),
    setContent: vi.fn(),
    destroy: vi.fn(),
  } as unknown as IVditorInstance
}

describe('mountToolbar', () => {
  let container: HTMLElement
  let outlineEl: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    outlineEl = document.createElement('aside')
    document.body.appendChild(container)
    document.body.appendChild(outlineEl)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders 5 buttons (mode, export, copy, source, outline) when sourceUrl is provided', () => {
    const vditor = createMockVditor()
    mountToolbar(container, { vditor, sourceUrl: 'https://example.com/doc.md', outlineEl })
    const buttons = container.querySelectorAll('button, a')
    expect(buttons.length).toBe(5)
  })

  it('hides source-link button when sourceUrl is null', () => {
    const vditor = createMockVditor()
    mountToolbar(container, { vditor, sourceUrl: null, outlineEl })
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(4)
  })

  it('mode button shows "编辑" in preview state', () => {
    const vditor = createMockVditor()
    mountToolbar(container, { vditor, sourceUrl: 'https://example.com/doc.md', outlineEl })
    const modeBtn = container.querySelector('[data-action="mode"]') as HTMLButtonElement
    expect(modeBtn.textContent).toBe('编辑')
  })

  it('clicking mode button calls switchToEdit from preview state', () => {
    const vditor = createMockVditor()
    mountToolbar(container, { vditor, sourceUrl: null, outlineEl })
    const modeBtn = container.querySelector('[data-action="mode"]') as HTMLButtonElement
    modeBtn.click()
    expect(vditor.switchToEdit).toHaveBeenCalled()
    expect(modeBtn.textContent).toBe('预览')
  })

  it('clicking mode button calls switchToPreview from edit state', () => {
    const vditor = createMockVditor()
    mountToolbar(container, { vditor, sourceUrl: null, outlineEl })
    const modeBtn = container.querySelector('[data-action="mode"]') as HTMLButtonElement
    // First click: preview -> edit
    modeBtn.click()
    // Second click: edit -> preview
    modeBtn.click()
    expect(vditor.switchToPreview).toHaveBeenCalled()
    expect(modeBtn.textContent).toBe('编辑')
  })

  it('clicking export triggers blob download with correct filename', () => {
    const vditor = createMockVditor()
    mountToolbar(container, { vditor, sourceUrl: 'https://example.com/docs/readme.md', outlineEl })

    // jsdom doesn't have URL.createObjectURL/revokeObjectURL, stub them before spying
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = (() => 'blob:fake') as typeof URL.createObjectURL
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL
    }

    const urlCreateSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake')
    const urlRevokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clickSpy = vi.fn()
    const originalCreateElement = document.createElement.bind(document) as typeof document.createElement
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = { click: clickSpy, href: '', download: '' } as unknown as HTMLAnchorElement
        return el
      }
      return originalCreateElement(tag as keyof HTMLElementTagNameMap)
    })

    const exportBtn = container.querySelector('[data-action="export"]') as HTMLButtonElement
    exportBtn.click()

    expect(vditor.getContent).toHaveBeenCalled()
    expect(urlCreateSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(urlRevokeSpy).toHaveBeenCalled()

    urlCreateSpy.mockRestore()
    urlRevokeSpy.mockRestore()
  })

  it('clicking copy calls navigator.clipboard.writeText with content', async () => {
    const vditor = createMockVditor()
    const writeTextSpy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
    })

    mountToolbar(container, { vditor, sourceUrl: null, outlineEl })
    const copyBtn = container.querySelector('[data-action="copy"]') as HTMLButtonElement
    copyBtn.click()

    await vi.waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith('# Hello')
    })
  })

  it('source-link button is an anchor with href = sourceUrl and target=_blank', () => {
    const vditor = createMockVditor()
    mountToolbar(container, { vditor, sourceUrl: 'https://example.com/doc.md', outlineEl })
    const sourceLink = container.querySelector('[data-action="source"]') as HTMLAnchorElement
    expect(sourceLink.tagName).toBe('A')
    expect(sourceLink.href).toBe('https://example.com/doc.md')
    expect(sourceLink.target).toBe('_blank')
  })

  it('outline toggle button is hidden initially', () => {
    const vditor = createMockVditor()
    mountToolbar(container, { vditor, sourceUrl: null, outlineEl })
    const outlineBtn = container.querySelector('[data-action="outline"]') as HTMLButtonElement
    expect(outlineBtn.style.display).toBe('none')
  })

  it('setOutlineToggleAvailable unhides the outline button', () => {
    const vditor = createMockVditor()
    const handle = mountToolbar(container, { vditor, sourceUrl: null, outlineEl })
    const outlineBtn = container.querySelector('[data-action="outline"]') as HTMLButtonElement
    expect(outlineBtn.style.display).toBe('none')
    handle.setOutlineToggleAvailable()
    expect(outlineBtn.style.display).toBe('')
  })

  it('clicking outline button toggles outline-hidden class and label', () => {
    const vditor = createMockVditor()
    mountToolbar(container, { vditor, sourceUrl: null, outlineEl })
    const outlineBtn = container.querySelector('[data-action="outline"]') as HTMLButtonElement

    // Initially visible -> click hides
    outlineBtn.click()
    expect(outlineEl.classList.contains('outline-hidden')).toBe(true)
    expect(outlineBtn.textContent).toBe('显示大纲')

    // Hidden -> click shows
    outlineBtn.click()
    expect(outlineEl.classList.contains('outline-hidden')).toBe(false)
    expect(outlineBtn.textContent).toBe('隐藏大纲')
  })

  it('outline button is positioned after source link', () => {
    const vditor = createMockVditor()
    mountToolbar(container, { vditor, sourceUrl: 'https://example.com/doc.md', outlineEl })
    const buttons = Array.from(container.querySelectorAll('button, a'))
    const sourceIdx = buttons.findIndex((b) => b.getAttribute('data-action') === 'source')
    const outlineIdx = buttons.findIndex((b) => b.getAttribute('data-action') === 'outline')
    expect(sourceIdx).toBeGreaterThanOrEqual(0)
    expect(outlineIdx).toBe(sourceIdx + 1)
  })

  it('does not render outline button when outlineEl is not provided', () => {
    const vditor = createMockVditor()
    mountToolbar(container, { vditor, sourceUrl: 'https://example.com/doc.md' })
    const outlineBtn = container.querySelector('[data-action="outline"]')
    expect(outlineBtn).toBeNull()
  })
})
