export function clampWidth(width: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, width))
}

export interface ResizerHandle {
  destroy(): void
}

export function mountResizer(resizerEl: HTMLElement, outlineEl: HTMLElement): ResizerHandle {
  resizerEl.classList.add('mounted')

  return {
    destroy(): void {
      resizerEl.classList.remove('mounted')
    },
  }
}
