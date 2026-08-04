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

const PREVIEW_TIMEOUT = 5000

export function createVditorInstance(): IVditorInstance {
  let vditor: Vditor | null = null
  let container: HTMLElement | null = null

  return {
    async init(el: HTMLElement, initialMd: string): Promise<void> {
      container = el
      await new Promise<void>((resolve) => {
        let done = false
        const finish = (): void => {
          if (!done) {
            done = true
            resolve()
          }
        }

        vditor = new Vditor(el, {
          cdn: 'https://public.yitong.com/mirrors/unpkg.com/vditor@3.11.2',
          mode: 'sv',
          value: initialMd,
          height: '100%',
          toolbarConfig: { hide: true },
          toolbar: [],
          preview: {
            hljs: { lineNumber: true, style: 'github' },
            markdown: { toc: true },
            delay: 50,
            parse: finish,
          },
          cache: { enable: false },
          after: () => {
            el.classList.add('mode-preview')
            setTimeout(finish, PREVIEW_TIMEOUT)
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
