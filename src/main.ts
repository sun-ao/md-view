import './style.css'
import { loadMd, type FetchError } from './load-md'
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

// Orchestrator - implemented in Part B below
export async function main(): Promise<void> {
  // placeholder
}
