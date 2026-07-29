export function clampWidth(width: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, width))
}

export interface ResizerHandle {
  destroy(): void
}

const MIN_WIDTH = 160
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 260

// 从 inline style 读宽度;为空(CSS 默认未写到 inline)时回退 DEFAULT_WIDTH。
// 用 parseInt(style.width) 而非 offsetWidth,因为 jsdom 不做布局、offsetWidth 恒为 0。
function readCurrentWidth(el: HTMLElement): number {
  const raw = el.style.width
  if (!raw) return DEFAULT_WIDTH
  const parsed = parseInt(raw, 10)
  return Number.isNaN(parsed) ? DEFAULT_WIDTH : parsed
}

export function mountResizer(resizerEl: HTMLElement, outlineEl: HTMLElement): ResizerHandle {
  resizerEl.classList.add('mounted')

  let startX = 0
  let startWidth = 0

  const onPointerDown = (e: PointerEvent): void => {
    startX = e.clientX
    startWidth = readCurrentWidth(outlineEl)
    resizerEl.setPointerCapture(e.pointerId)
    resizerEl.classList.add('dragging')
  }

  const onPointerMove = (e: PointerEvent): void => {
    if (!resizerEl.classList.contains('dragging')) return
    const delta = e.clientX - startX
    const newWidth = clampWidth(startWidth + delta, MIN_WIDTH, MAX_WIDTH)
    outlineEl.style.width = `${newWidth}px`
  }

  const onPointerUp = (e: PointerEvent): void => {
    if (!resizerEl.classList.contains('dragging')) return
    resizerEl.releasePointerCapture(e.pointerId)
    resizerEl.classList.remove('dragging')
  }

  const onDblClick = (): void => {
    outlineEl.style.width = `${DEFAULT_WIDTH}px`
  }

  resizerEl.addEventListener('pointerdown', onPointerDown)
  resizerEl.addEventListener('pointermove', onPointerMove)
  resizerEl.addEventListener('pointerup', onPointerUp)
  // pointercancel 与 pointerup 共用处理:系统取消指针(如触摸中断)时也要释放 capture + 移除 dragging
  resizerEl.addEventListener('pointercancel', onPointerUp)
  resizerEl.addEventListener('dblclick', onDblClick)

  return {
    destroy(): void {
      resizerEl.removeEventListener('pointerdown', onPointerDown)
      resizerEl.removeEventListener('pointermove', onPointerMove)
      resizerEl.removeEventListener('pointerup', onPointerUp)
      resizerEl.removeEventListener('pointercancel', onPointerUp)
      resizerEl.removeEventListener('dblclick', onDblClick)
      resizerEl.classList.remove('mounted')
    },
  }
}
