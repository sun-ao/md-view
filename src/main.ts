import './style.css'
import { loadMd, type FetchError } from './load-md'
import { mountOutline } from './outline'
import { mountResizer } from './divider'
import { mountToolbar } from './toolbar'
import { createVditorInstance, type IVditorInstance } from './vditor-instance'

export function getErrorMessage(error: FetchError): string {
  switch (error.kind) {
    case 'no_url':
      return '请在 URL 加 ?url=md文件地址,示例:?url=https://example.com/doc.md'
    case 'cors':
    case 'network':
      return '加载失败,可能是跨域限制(CORS)。请确认源允许跨域,或使用 CORS 友好源(GitHub raw、jsdelivr 等)'
    case 'http':
      return `加载失败:HTTP ${error.status}`
    case 'empty':
      return '文件内容为空'
  }
}

export function parseUrlParam(search: string): string | null {
  const params = new URLSearchParams(search)
  const url = params.get('url')
  if (!url) return null
  return url
}

export function parseToolbarParam(search: string): boolean {
  const params = new URLSearchParams(search)
  const value = params.get('toolbar')
  if (!value) return false
  const lower = value.toLowerCase()
  return lower === '1' || lower === 'true'
}

function renderError(container: HTMLElement, error: FetchError): void {
  const msg = getErrorMessage(error)
  container.innerHTML = `<div class="error-state">${msg}</div>`
}

function renderLoading(container: HTMLElement): void {
  container.innerHTML = '<div class="loading">加载中…</div>'
}

export async function main(): Promise<void> {
  const toolbarEl = document.getElementById('toolbar')
  const editorEl = document.getElementById('editor')
  if (!toolbarEl || !editorEl) return

  const url = parseUrlParam(window.location.search)
  if (!url) {
    renderError(editorEl, { kind: 'no_url' })
    return
  }

  renderLoading(editorEl)

  const result = await loadMd(url)
  if (!result.ok) {
    renderError(editorEl, result.error)
    return
  }

  const vditor = createVditorInstance()
  await vditor.init(editorEl, result.md)
  const outlineEl = document.getElementById('outline')

  const showToolbar = parseToolbarParam(window.location.search)
  const toolbarHandle = showToolbar
    ? mountToolbar(toolbarEl, { vditor, sourceUrl: url, outlineEl })
    : undefined

  if (showToolbar) {
    document.body.classList.add('show-toolbar')
  }

  if (outlineEl) {
    const outlineHandle = await mountOutline(outlineEl, editorEl)
    if (outlineHandle) {
      toolbarHandle?.setOutlineToggleAvailable()
      const resizerEl = document.getElementById('resizer')
      if (resizerEl) mountResizer(resizerEl, outlineEl)
    }
  }
}

main()
