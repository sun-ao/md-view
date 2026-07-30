/**
 * e-ysy 客户端容器内的链接拦截器。
 *
 * 仅在 `?inEysy=1` 时由 main 挂载。在 document 上以捕获阶段监听 click，
 * 阻止 http/https 链接的默认行为（避免 iframe 内导航或新开标签），
 * 并通过 postMessage 通知父窗口唤起系统浏览器打开外链。
 *
 * 放行：锚点（`#xxx`）、`mailto:`、`tel:`、`javascript:` 等非 http(s) 链接。
 * 注意：浏览器会把 `#xxx` 解析成绝对 URL（如 `http://host/#xxx`），
 * 单靠 `^https?://` 正则无法识别锚点，因此先用 `getAttribute('href')`
 * 取原始值判断 `#` 前缀。
 */
export function attachLinkInterceptor(): () => void {
  const handler = (e: MouseEvent) => {
    const target = e.target
    if (!(target instanceof Element)) return

    const a = target.closest('a')
    if (!a) return

    // 锚点链接放行，交由浏览器处理页内滚动
    const rawHref = a.getAttribute('href') ?? ''
    if (rawHref.startsWith('#')) return

    // href 属性已为绝对 URL
    const url = a.href
    if (!url) return

    // 只处理 http/https 外链，放行 mailto/tel/javascript 等
    if (!/^https?:\/\//i.test(url)) return

    // 阻止默认行为（避免 iframe 内导航或开新窗口）
    e.preventDefault()
    e.stopPropagation()

    // 通知父窗口唤起系统浏览器；父窗口会自行校验来源，这里放宽以兼容多种 origin
    window.parent.postMessage(
      JSON.stringify({ event: 'openExternal', url }),
      '*',
    )
  }

  document.addEventListener('click', handler, true)
  return () => document.removeEventListener('click', handler, true)
}
