import Vditor from 'vditor'
import 'vditor/dist/index.css'

export interface IVditorInstance {
  init(container: HTMLElement, initialMd: string): Promise<void>
  switchToPreview(): void
  switchToEdit(): void
  getContent(): string
  setContent(md: string): void
  destroy(): void
}

export function createVditorInstance(): IVditorInstance {
  let vditor: Vditor | null = null
  let container: HTMLElement | null = null

  return {
    async init(el: HTMLElement, initialMd: string): Promise<void> {
      container = el
      await new Promise<void>((resolve) => {
        vditor = new Vditor(el, {
          mode: 'sv',
          value: initialMd,
          height: '100%',
          toolbarConfig: { hide: true },
          toolbar: [],
          preview: {
            hljs: { lineNumber: true, style: 'github' },
            markdown: { toc: true },
          },
          cache: { enable: false },
          after: () => {
            el.classList.add('mode-preview')
            resolve()
          },
        })
      })
    },

    switchToPreview(): void {
      container?.classList.remove('mode-edit')
      container?.classList.add('mode-preview')
    },

    switchToEdit(): void {
      container?.classList.remove('mode-preview')
      container?.classList.add('mode-edit')
    },

    getContent(): string {
      return vditor?.getValue() ?? ''
    },

    setContent(md: string): void {
      vditor?.setValue(md)
    },

    destroy(): void {
      vditor?.destroy()
      vditor = null
      container = null
    },
  }
}
