import './style.css'
import { loadMd, type FetchError } from './load-md'
import { mountOutline } from './outline'
import { mountResizer } from './divider'
import { mountToolbar } from './toolbar'
import { attachLinkInterceptor } from './link-interceptor'
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

export function parseOutlineParam(search: string): boolean {
  const params = new URLSearchParams(search)
  const value = params.get('outline')
  if (value === null) return true
  const lower = value.toLowerCase()
  return lower !== '0' && lower !== 'false'
}

export function parseInEysyParam(search: string): boolean {
  const params = new URLSearchParams(search)
  return params.get('inEysy') === '1'
}

function renderError(container: HTMLElement, error: FetchError): void {
  const msg = getErrorMessage(error)
  container.innerHTML = `<div class="error-state">${msg}</div>`
}

function showLoading(): HTMLElement {
  const overlay = document.createElement('div')
  overlay.className = 'loading-overlay'
  overlay.innerHTML =
    '<div class="loading-spinner"></div><div class="loading-text">加载中…</div>'
  document.body.appendChild(overlay)
  return overlay
}

export async function main(): Promise<void> {
  const toolbarEl = document.getElementById('toolbar')
  const editorEl = document.getElementById('editor')
  if (!toolbarEl || !editorEl) return

  // e-ysy 客户端容器：拦截外链点击，交由父窗口唤起系统浏览器
  if (parseInEysyParam(window.location.search)) {
    attachLinkInterceptor()
  }

  const url = parseUrlParam(window.location.search)
  if (!url) {
    renderError(editorEl, { kind: 'no_url' })
    return
  }

  const loadingOverlay = showLoading()

  const result = await loadMd(url)
  if (!result.ok) {
    loadingOverlay.remove()
    renderError(editorEl, result.error)
    return
  }

  const vditor = createVditorInstance()
  await vditor.init(editorEl, result.md)
  loadingOverlay.remove()
  const outlineEl = document.getElementById('outline')

  const showToolbar = parseToolbarParam(window.location.search)
  const toolbarHandle = showToolbar
    ? mountToolbar(toolbarEl, { vditor, sourceUrl: url, outlineEl })
    : undefined

  if (showToolbar) {
    document.body.classList.add('show-toolbar')
  }

  if (outlineEl && parseOutlineParam(window.location.search)) {
    const outlineHandle = await mountOutline(outlineEl, editorEl)
    if (outlineHandle) {
      toolbarHandle?.setOutlineToggleAvailable()
      const resizerEl = document.getElementById('resizer')
      if (resizerEl) mountResizer(resizerEl, outlineEl)
    }
  } else if (outlineEl) {
    outlineEl.classList.add('outline-hidden')
  }
}

main()
