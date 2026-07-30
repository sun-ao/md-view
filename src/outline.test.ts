import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { findActiveIndex, mountOutline } from './outline'

describe('findActiveIndex', () => {
  it('returns -1 for an empty array', () => {
    expect(findActiveIndex([], 80)).toBe(-1)
  })

  it('returns 0 when all headings are below the threshold', () => {
    // No heading has scrolled above the 80px line yet -> default to first.
    expect(findActiveIndex([200, 400, 600], 80)).toBe(0)
  })

  it('returns the last index when all headings are above the threshold', () => {
    expect(findActiveIndex([10, 30, 50], 80)).toBe(2)
  })

  it('returns the largest index whose top is above the threshold for mixed positions', () => {
    // tops[0]=10 (<80, crossed), tops[1]=50 (<80, crossed), tops[2]=200 (>=80, not crossed)
    expect(findActiveIndex([10, 50, 200], 80)).toBe(1)
  })

  it('returns 0 when the first heading is exactly at the threshold (not above)', () => {
    // top < threshold is strict; equal does not count as crossed.
    expect(findActiveIndex([80, 100, 200], 80)).toBe(0)
  })

  it('returns the last index when atBottom is true, even if the last heading top is below the threshold', () => {
    // Short last section can't be scrolled above the threshold line; when the
    // scroll container is at its maximum scroll, the last heading is active.
    expect(findActiveIndex([10, 50, 400], 80, true)).toBe(2)
  })
})

interface VditorFixture {
  outline: HTMLElement
  editor: HTMLElement
  preview: HTMLElement
}

function setupVditorFixture(headingsHtml: string): VditorFixture {
  document.body.innerHTML =
    '<div id="outline"></div>' +
    '<div id="editor">' +
    '<div class="vditor-preview">' +
    '<div class="vditor-reset">' +
    headingsHtml +
    '</div>' +
    '</div>' +
    '</div>'
  return {
    outline: document.getElementById('outline')!,
    editor: document.getElementById('editor')!,
    preview: document.querySelector('.vditor-preview')!,
  }
}

function stubRect(el: Element, top: number): void {
  el.getBoundingClientRect = () =>
    ({ top, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }) as DOMRect
}

describe('mountOutline', () => {
  beforeEach(() => {
    // jsdom doesn't implement scrollIntoView; stub it globally so any call is safe.
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('returns null and leaves container empty when there are no headings', async () => {
    vi.useFakeTimers()
    const { outline, editor } = setupVditorFixture('<p>no headings here</p>')
    const promise = mountOutline(outline, editor)
    await vi.advanceTimersByTimeAsync(6000)
    await expect(promise).resolves.toBeNull()
    expect(outline.children.length).toBe(0)
  })

  it('builds one item per heading with level class, text, and title tooltip', async () => {
    const { outline, editor } = setupVditorFixture(
      '<h1>First</h1><p>x</p><h2>Second</h2><h3>Third</h3>',
    )
    await mountOutline(outline, editor)
    const items = outline.querySelectorAll<HTMLElement>('.outline-item')
    expect(items.length).toBe(3)
    expect(items[0].classList.contains('outline-level-1')).toBe(true)
    expect(items[0].textContent).toBe('First')
    expect(items[0].title).toBe('First')
    expect(items[1].classList.contains('outline-level-2')).toBe(true)
    expect(items[1].textContent).toBe('Second')
    expect(items[1].title).toBe('Second')
    expect(items[2].classList.contains('outline-level-3')).toBe(true)
    expect(items[2].textContent).toBe('Third')
    expect(items[2].title).toBe('Third')
  })

  it('sets title to full heading text so long truncated items show a tooltip on hover', async () => {
    const longText = '这是一个非常非常长的标题文本用来验证省略时悬浮能否显示完整内容'
    const { outline, editor } = setupVditorFixture(`<h2>${longText}</h2>`)
    await mountOutline(outline, editor)
    const item = outline.querySelector<HTMLElement>('.outline-item')!
    expect(item.title).toBe(longText)
  })

  it('clicking an item scrolls the matching heading into view with smooth/start', async () => {
    const { outline, editor } = setupVditorFixture('<h1>First</h1><h2>Second</h2><h3>Third</h3>')
    const headings = editor.querySelectorAll('h1, h2, h3')
    const headingSpies = Array.from(headings).map((h) => {
      const spy = vi.fn()
      ;(h as HTMLElement).scrollIntoView = spy
      return spy
    })
    await mountOutline(outline, editor)

    const items = outline.querySelectorAll('.outline-item')
    ;(items[1] as HTMLElement).click()

    expect(headingSpies[1]).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(headingSpies[0]).not.toHaveBeenCalled()
    expect(headingSpies[2]).not.toHaveBeenCalled()
  })

  it('attaches a passive scroll listener to .vditor-preview', async () => {
    const { outline, editor, preview } = setupVditorFixture('<h1>First</h1><h2>Second</h2>')
    const addSpy = vi.spyOn(preview, 'addEventListener')
    await mountOutline(outline, editor)
    expect(addSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })
  })

  it('highlights the active item based on scroll position and updates on scroll', async () => {
    const { outline, editor, preview } = setupVditorFixture('<h1>A</h1><h2>B</h2><h3>C</h3>')
    const headings = editor.querySelectorAll('h1, h2, h3')
    stubRect(preview, 0)
    stubRect(headings[0], 10) // above threshold
    stubRect(headings[1], 50) // above threshold
    stubRect(headings[2], 200) // below threshold
    await mountOutline(outline, editor)

    const items = outline.querySelectorAll('.outline-item')
    // Initial mount update: findActiveIndex([10,50,200],80) = 1
    expect(items[1].classList.contains('outline-active')).toBe(true)

    // Scroll: move h2 below threshold too -> only h1 crossed -> active becomes 0
    stubRect(headings[1], 200)
    preview.dispatchEvent(new Event('scroll'))
    expect(items[0].classList.contains('outline-active')).toBe(true)
    expect(items[1].classList.contains('outline-active')).toBe(false)
  })

  it('activates the last heading when scrolled to the bottom, even if its top stays below the threshold', async () => {
    // Reproduces the "short last section" bug: clicking the last outline item
    // scrolls the preview to its maximum, but the last heading can't reach the
    // 80px threshold line. Without bottom detection the active highlight jumps
    // to the previous heading.
    const { outline, editor, preview } = setupVditorFixture('<h1>A</h1><h2>B</h2><h3>C</h3>')
    const headings = editor.querySelectorAll('h1, h2, h3')
    stubRect(preview, 0)
    stubRect(headings[0], -500) // above threshold
    stubRect(headings[1], -200) // above threshold
    stubRect(headings[2], 400) // below threshold (can't scroll any higher)
    Object.defineProperty(preview, 'scrollTop', { value: 1000, configurable: true })
    Object.defineProperty(preview, 'clientHeight', { value: 600, configurable: true })
    Object.defineProperty(preview, 'scrollHeight', { value: 1600, configurable: true }) // 1000+600=1600 -> at bottom
    await mountOutline(outline, editor)

    const items = outline.querySelectorAll('.outline-item')
    expect(items[2].classList.contains('outline-active')).toBe(true)
    expect(items[1].classList.contains('outline-active')).toBe(false)

    // Scroll handler should also respect bottom detection on subsequent scrolls.
    stubRect(headings[2], 350)
    preview.dispatchEvent(new Event('scroll'))
    expect(items[2].classList.contains('outline-active')).toBe(true)
  })

  it('keeps the clicked item highlighted when its scroll reaches the bottom (short trailing section)', async () => {
    // Clicking the second-to-last item triggers a smooth scroll that can only
    // reach the document bottom (not enough content below to bring the heading
    // to the top). The highlight must stay on the clicked item, NOT jump to the
    // last heading.
    const { outline, editor, preview } = setupVditorFixture('<h1>A</h1><h2>B</h2><h3>C</h3>')
    const headings = editor.querySelectorAll('h1, h2, h3')
    stubRect(preview, 0)
    // Before click: not at bottom, B above threshold.
    stubRect(headings[0], -500)
    stubRect(headings[1], 50)
    stubRect(headings[2], 400)
    Object.defineProperty(preview, 'scrollTop', { value: 0, configurable: true, writable: true })
    Object.defineProperty(preview, 'clientHeight', { value: 600, configurable: true })
    Object.defineProperty(preview, 'scrollHeight', { value: 2000, configurable: true })
    await mountOutline(outline, editor)

    const items = outline.querySelectorAll('.outline-item')
    // Click the second-to-last item (B).
    ;(items[1] as HTMLElement).click()

    // Smooth scroll reaches the bottom: B can't reach the 80px line.
    stubRect(headings[1], 300) // below threshold
    stubRect(headings[2], 500) // below threshold
    Object.defineProperty(preview, 'scrollTop', { value: 1400, configurable: true, writable: true }) // 1400+600=2000 -> at bottom
    preview.dispatchEvent(new Event('scroll'))

    // Clicked item (B, index 1) stays active; highlight does NOT jump to C.
    expect(items[1].classList.contains('outline-active')).toBe(true)
    expect(items[2].classList.contains('outline-active')).toBe(false)
  })

  it('highlights the clicked item immediately when already at the bottom (no scroll occurs)', async () => {
    // Already at the document bottom with several trailing headings visible.
    // Clicking one of them triggers scrollIntoView, but the preview can't
    // scroll any further, so no 'scroll' event fires. The clicked item must
    // still become active right away.
    const { outline, editor, preview } = setupVditorFixture('<h1>A</h1><h2>B</h2><h3>C</h3>')
    const headings = editor.querySelectorAll('h1, h2, h3')
    stubRect(preview, 0)
    stubRect(headings[0], -1000)
    stubRect(headings[1], 300) // visible near the bottom, below threshold
    stubRect(headings[2], 500) // visible at the bottom, below threshold
    Object.defineProperty(preview, 'scrollTop', { value: 1400, configurable: true, writable: true })
    Object.defineProperty(preview, 'clientHeight', { value: 600, configurable: true })
    Object.defineProperty(preview, 'scrollHeight', { value: 2000, configurable: true }) // at bottom
    await mountOutline(outline, editor)

    const items = outline.querySelectorAll('.outline-item')
    // Click B (index 1) - no scroll event dispatched (preview can't scroll).
    ;(items[1] as HTMLElement).click()

    expect(items[1].classList.contains('outline-active')).toBe(true)
    expect(items[2].classList.contains('outline-active')).toBe(false)
  })

  it('clears the click lock on manual scroll so scroll-spy resumes', async () => {
    const { outline, editor, preview } = setupVditorFixture('<h1>A</h1><h2>B</h2><h3>C</h3>')
    const headings = editor.querySelectorAll('h1, h2, h3')
    stubRect(preview, 0)
    stubRect(headings[0], -500)
    stubRect(headings[1], 300) // below threshold (click lock keeps it active)
    stubRect(headings[2], 500) // below threshold
    Object.defineProperty(preview, 'scrollTop', { value: 1400, configurable: true, writable: true })
    Object.defineProperty(preview, 'clientHeight', { value: 600, configurable: true })
    Object.defineProperty(preview, 'scrollHeight', { value: 2000, configurable: true })
    await mountOutline(outline, editor)

    const items = outline.querySelectorAll('.outline-item')
    ;(items[1] as HTMLElement).click()
    preview.dispatchEvent(new Event('scroll'))
    expect(items[1].classList.contains('outline-active')).toBe(true)

    // User scrolls manually (wheel) -> click lock cleared -> scroll-spy resumes
    // and, at the bottom, forces the last heading active.
    preview.dispatchEvent(new WheelEvent('wheel'))
    preview.dispatchEvent(new Event('scroll'))
    expect(items[2].classList.contains('outline-active')).toBe(true)
  })

  it('destroy clears the container and removes the scroll listener', async () => {
    const { outline, editor, preview } = setupVditorFixture('<h1>First</h1><h2>Second</h2>')
    const addSpy = vi.spyOn(preview, 'addEventListener')
    const removeSpy = vi.spyOn(preview, 'removeEventListener')
    const handle = (await mountOutline(outline, editor))!

    const scrollHandler = addSpy.mock.calls[0][1] as EventListener
    handle.destroy()

    expect(outline.children.length).toBe(0)
    expect(removeSpy).toHaveBeenCalledWith('scroll', scrollHandler)
  })

  it('waits for headings to render before building the outline (Vditor async preview)', async () => {
    vi.useFakeTimers()
    const { outline, editor, preview } = setupVditorFixture('')
    const reset = preview.querySelector('.vditor-reset')!

    // Simulate Vditor's async preview render: inject headings after 200ms
    setTimeout(() => {
      reset.innerHTML = '<h1>Loaded</h1><h2>Sub</h2>'
    }, 200)

    const promise = mountOutline(outline, editor)
    // Before the render completes, the outline is still empty
    await vi.advanceTimersByTimeAsync(50)
    expect(outline.querySelectorAll('.outline-item').length).toBe(0)
    // Advance past the injection; outline should now be built
    await vi.advanceTimersByTimeAsync(300)
    await promise

    const items = outline.querySelectorAll('.outline-item')
    expect(items.length).toBe(2)
    expect(items[0].textContent).toBe('Loaded')
    expect(items[1].textContent).toBe('Sub')
  })
})
