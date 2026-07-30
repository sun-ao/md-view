import type { IVditorInstance } from './vditor-instance'

export interface ToolbarConfig {
  vditor: IVditorInstance
  sourceUrl: string | null
  outlineEl?: HTMLElement | null
}

export interface ToolbarHandle {
  /** Unhide the outline toggle button. Called after headings are confirmed. */
  setOutlineToggleAvailable(): void
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

function exportMd(md: string, filename: string): void {
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      return true
    } catch {
      return false
    }
  }
}

export function mountToolbar(container: HTMLElement, config: ToolbarConfig): ToolbarHandle {
  const { vditor, sourceUrl, outlineEl } = config
  let isPreviewMode = true
  let outlineVisible = true

  container.innerHTML = ''

  // Mode toggle button
  const modeBtn = document.createElement('button')
  modeBtn.dataset.action = 'mode'
  modeBtn.textContent = '编辑'
  modeBtn.addEventListener('click', () => {
    if (isPreviewMode) {
      vditor.switchToEdit()
      isPreviewMode = false
      modeBtn.textContent = '预览'
    } else {
      vditor.switchToPreview()
      isPreviewMode = true
      modeBtn.textContent = '编辑'
    }
  })
  container.appendChild(modeBtn)

  // Export button
  const exportBtn = document.createElement('button')
  exportBtn.dataset.action = 'export'
  exportBtn.textContent = '导出'
  exportBtn.addEventListener('click', () => {
    const md = vditor.getContent()
    const filename = sourceUrl ? extractFilename(sourceUrl) : 'document.md'
    exportMd(md, filename)
  })
  container.appendChild(exportBtn)

  // Copy button
  const copyBtn = document.createElement('button')
  copyBtn.dataset.action = 'copy'
  copyBtn.textContent = '复制'
  copyBtn.addEventListener('click', async () => {
    const md = vditor.getContent()
    const ok = await copyToClipboard(md)
    if (ok) {
      const original = copyBtn.textContent
      copyBtn.textContent = '已复制'
      setTimeout(() => { copyBtn.textContent = original }, 2000)
    }
  })
  container.appendChild(copyBtn)

  // Source link (only if sourceUrl provided)
  if (sourceUrl) {
    const sourceLink = document.createElement('a')
    sourceLink.dataset.action = 'source'
    sourceLink.textContent = '原文链接'
    sourceLink.href = sourceUrl
    sourceLink.target = '_blank'
    sourceLink.rel = 'noopener noreferrer'
    container.appendChild(sourceLink)
  }

  // Outline toggle button (hidden until setOutlineToggleAvailable is called,
  // which happens after mountOutline confirms headings exist)
  let outlineBtn: HTMLButtonElement | null = null
  if (outlineEl) {
    outlineBtn = document.createElement('button')
    outlineBtn.dataset.action = 'outline'
    outlineBtn.textContent = '隐藏大纲'
    outlineBtn.style.display = 'none'
    outlineBtn.addEventListener('click', () => {
      outlineVisible = !outlineVisible
      outlineEl.classList.toggle('outline-hidden', !outlineVisible)
      outlineBtn!.textContent = outlineVisible ? '隐藏大纲' : '显示大纲'
    })
    container.appendChild(outlineBtn)
  }

  return {
    setOutlineToggleAvailable(): void {
      if (outlineBtn) outlineBtn.style.display = ''
    },
  }
}
