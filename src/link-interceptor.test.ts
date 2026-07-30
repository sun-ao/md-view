import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attachLinkInterceptor } from './link-interceptor'

describe('attachLinkInterceptor', () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>
  let detach: () => void

  beforeEach(() => {
    document.body.innerHTML = ''
    // jsdom 顶层 window.parent === window；postMessage 被 mock 拦截，不真正派发消息
    postMessageSpy = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => {})
    // 放行测试中 <a> 的默认激活会排队一个导航 setTimeout，jsdom 不支持导航
    // 会打印 "Not implemented: navigation" 噪声；用假时钟阻止其触发
    vi.useFakeTimers()
  })

  afterEach(() => {
    detach()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // 在 target 上派发真实 click，并 spy 其 preventDefault / stopPropagation
  function click(target: Element) {
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true })
    const preventSpy = vi.spyOn(evt, 'preventDefault')
    const stopSpy = vi.spyOn(evt, 'stopPropagation')
    target.dispatchEvent(evt)
    return { preventSpy, stopSpy }
  }

  it('拦截 https 链接：preventDefault + stopPropagation + 向父窗口 postMessage', () => {
    const a = document.createElement('a')
    a.href = 'https://example.com/path/doc.md'
    document.body.appendChild(a)

    detach = attachLinkInterceptor()
    const { preventSpy, stopSpy } = click(a)

    expect(preventSpy).toHaveBeenCalled()
    expect(stopSpy).toHaveBeenCalled()
    expect(postMessageSpy).toHaveBeenCalledTimes(1)
    const [payload, origin] = postMessageSpy.mock.calls[0]
    expect(origin).toBe('*')
    expect(JSON.parse(payload)).toEqual({
      event: 'openExternal',
      url: 'https://example.com/path/doc.md',
    })
  })

  it('拦截 http 链接', () => {
    const a = document.createElement('a')
    a.href = 'http://example.com/foo'
    document.body.appendChild(a)

    detach = attachLinkInterceptor()
    click(a)

    expect(postMessageSpy).toHaveBeenCalledTimes(1)
    expect(JSON.parse(postMessageSpy.mock.calls[0][0])).toEqual({
      event: 'openExternal',
      url: 'http://example.com/foo',
    })
  })

  it('点击 <a> 内部的子元素也能命中拦截（closest 向上找）', () => {
    const a = document.createElement('a')
    a.href = 'https://example.com'
    a.innerHTML = '<span class="inner">链接文字</span>'
    document.body.appendChild(a)

    detach = attachLinkInterceptor()
    click(a.querySelector('.inner')!)

    expect(postMessageSpy).toHaveBeenCalledTimes(1)
    expect(JSON.parse(postMessageSpy.mock.calls[0][0])).toEqual({
      event: 'openExternal',
      url: 'https://example.com/',
    })
  })

  it('放行锚点链接（#xxx），不拦截、不 postMessage', () => {
    const a = document.createElement('a')
    a.href = '#section-1'
    document.body.appendChild(a)

    detach = attachLinkInterceptor()
    const { preventSpy } = click(a)

    expect(preventSpy).not.toHaveBeenCalled()
    expect(postMessageSpy).not.toHaveBeenCalled()
  })

  it('放行 mailto: 链接', () => {
    const a = document.createElement('a')
    a.href = 'mailto:user@example.com'
    document.body.appendChild(a)

    detach = attachLinkInterceptor()
    click(a)

    expect(postMessageSpy).not.toHaveBeenCalled()
  })

  it('放行 javascript: 链接', () => {
    const a = document.createElement('a')
    a.href = 'javascript:void(0)'
    document.body.appendChild(a)

    detach = attachLinkInterceptor()
    click(a)

    expect(postMessageSpy).not.toHaveBeenCalled()
  })

  it('点击非 <a> 元素不触发拦截', () => {
    const p = document.createElement('p')
    p.textContent = '普通段落'
    document.body.appendChild(p)

    detach = attachLinkInterceptor()
    const { preventSpy } = click(p)

    expect(preventSpy).not.toHaveBeenCalled()
    expect(postMessageSpy).not.toHaveBeenCalled()
  })

  it('detach 后不再拦截', () => {
    const a = document.createElement('a')
    a.href = 'https://example.com'
    document.body.appendChild(a)

    detach = attachLinkInterceptor()
    detach()
    click(a)

    expect(postMessageSpy).not.toHaveBeenCalled()
  })
})
