import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clampWidth, mountResizer } from './divider'

// jsdom 不提供 PointerEvent 构造器,需 polyfill 才能用 new PointerEvent(...)。
if (typeof PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number
    pointerType: string
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
      this.pointerType = init.pointerType ?? ''
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent
}

describe('clampWidth', () => {
  it('returns the value unchanged when within range', () => {
    expect(clampWidth(300, 160, 480)).toBe(300)
  })

  it('clamps to min when below range', () => {
    expect(clampWidth(100, 160, 480)).toBe(160)
  })

  it('clamps to max when above range', () => {
    expect(clampWidth(600, 160, 480)).toBe(480)
  })

  it('returns min when value equals min', () => {
    expect(clampWidth(160, 160, 480)).toBe(160)
  })

  it('returns max when value equals max', () => {
    expect(clampWidth(480, 160, 480)).toBe(480)
  })
})

describe('mountResizer', () => {
  beforeEach(() => {
    document.body.innerHTML = '<aside id="outline"></aside><div class="resizer" id="resizer"></div>'
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  // jsdom 不实现 setPointerCapture / releasePointerCapture,需 stub。
  function setupResizerFixture(): { resizer: HTMLElement; outline: HTMLElement } {
    const resizer = document.getElementById('resizer')!
    const outline = document.getElementById('outline')!
    resizer.setPointerCapture = vi.fn()
    resizer.releasePointerCapture = vi.fn()
    // 给 outline 一个起始宽度,模拟默认 260px
    outline.style.width = '260px'
    return { resizer, outline }
  }

  it('updates outline width by the pointer delta during drag', () => {
    const { resizer, outline } = setupResizerFixture()
    mountResizer(resizer, outline)

    // pointerdown 记录起点 clientX=200,起始宽度 260
    resizer.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, pointerId: 1 }))
    // pointermove 到 clientX=250 -> delta=50 -> 新宽度 310
    resizer.dispatchEvent(new PointerEvent('pointermove', { clientX: 250, pointerId: 1 }))

    expect(outline.style.width).toBe('310px')
  })

  it('adds dragging class on pointerdown and removes on pointerup', () => {
    const { resizer, outline } = setupResizerFixture()
    mountResizer(resizer, outline)

    resizer.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, pointerId: 1 }))
    expect(resizer.classList.contains('dragging')).toBe(true)

    resizer.dispatchEvent(new PointerEvent('pointerup', { clientX: 210, pointerId: 1 }))
    expect(resizer.classList.contains('dragging')).toBe(false)
  })

  it('clamps to MAX_WIDTH when dragging far right', () => {
    const { resizer, outline } = setupResizerFixture()
    mountResizer(resizer, outline)

    resizer.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, pointerId: 1 }))
    // 起始 260 + delta 500 = 760 -> clamp 到 480
    resizer.dispatchEvent(new PointerEvent('pointermove', { clientX: 700, pointerId: 1 }))

    expect(outline.style.width).toBe('480px')
  })

  it('clamps to MIN_WIDTH when dragging far left', () => {
    const { resizer, outline } = setupResizerFixture()
    mountResizer(resizer, outline)

    resizer.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, pointerId: 1 }))
    // 起始 260 + delta(-200) = 60 -> clamp 到 160
    resizer.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, pointerId: 1 }))

    expect(outline.style.width).toBe('160px')
  })

  it('adds the mounted class on mount so CSS makes it visible', () => {
    const resizer = document.getElementById('resizer')!
    const outline = document.getElementById('outline')!
    mountResizer(resizer, outline)
    expect(resizer.classList.contains('mounted')).toBe(true)
  })

  it('resets outline width to default on dblclick', () => {
    const { resizer, outline } = setupResizerFixture()
    mountResizer(resizer, outline)

    // 先拖拽改宽度
    resizer.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, pointerId: 1 }))
    resizer.dispatchEvent(new PointerEvent('pointermove', { clientX: 300, pointerId: 1 }))
    expect(outline.style.width).toBe('360px')

    // 双击重置
    resizer.dispatchEvent(new MouseEvent('dblclick'))

    expect(outline.style.width).toBe('260px')
  })

  it('destroy removes the mounted class', () => {
    const resizer = document.getElementById('resizer')!
    const outline = document.getElementById('outline')!
    const handle = mountResizer(resizer, outline)
    handle.destroy()
    expect(resizer.classList.contains('mounted')).toBe(false)
  })
})
