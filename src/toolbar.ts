import type { IVditorInstance } from './vditor-instance'

export interface ToolbarConfig {
  vditor: IVditorInstance
  sourceUrl: string | null
}

export function extractFilename(url: string): string {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/')
    const last = decodeURIComponent(segments[segments.length - 1])
    return last.length > 0 ? last : 'document.md'
  } catch {
    return 'document.md'
  }
}

export function mountToolbar(container: HTMLElement, config: ToolbarConfig): void {
  // Implemented in Part B below
}
