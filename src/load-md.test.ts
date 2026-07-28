import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadMd } from './load-md'

describe('loadMd', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns no_url for non-http(s) protocol', async () => {
    const result = await loadMd('ftp://example.com/doc.md')
    expect(result).toEqual({ ok: false, error: { kind: 'no_url' } })
  })

  it('returns no_url for javascript: protocol', async () => {
    const result = await loadMd('javascript:alert(1)')
    expect(result).toEqual({ ok: false, error: { kind: 'no_url' } })
  })

  it('returns ok with md content on 200 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('# Hello World'),
    })

    const result = await loadMd('https://example.com/doc.md')
    expect(result).toEqual({
      ok: true,
      md: '# Hello World',
      url: 'https://example.com/doc.md',
    })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/doc.md',
      expect.objectContaining({
        headers: { Accept: 'text/plain, text/markdown' },
      }),
    )
  })

  it('returns http error with status on 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not Found'),
    })

    const result = await loadMd('https://example.com/missing.md')
    expect(result).toEqual({ ok: false, error: { kind: 'http', status: 404 } })
  })

  it('returns http error with status on 500', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server Error'),
    })

    const result = await loadMd('https://example.com/doc.md')
    expect(result).toEqual({ ok: false, error: { kind: 'http', status: 500 } })
  })

  it('returns empty when body is empty string', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
    })

    const result = await loadMd('https://example.com/empty.md')
    expect(result).toEqual({ ok: false, error: { kind: 'empty' } })
  })

  it('returns empty when body is whitespace only', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('   \n  \t  '),
    })

    const result = await loadMd('https://example.com/blank.md')
    expect(result).toEqual({ ok: false, error: { kind: 'empty' } })
  })

  it('returns network when fetch throws TypeError', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await loadMd('https://example.com/doc.md')
    expect(result).toEqual({ ok: false, error: { kind: 'network' } })
  })

  it('returns network on timeout (10 seconds)', async () => {
    vi.useFakeTimers()
    global.fetch = vi.fn().mockImplementation(
      (_url: string, opts: RequestInit) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )

    const promise = loadMd('https://example.com/slow.md')
    vi.advanceTimersByTime(10000)
    const result = await promise
    expect(result).toEqual({ ok: false, error: { kind: 'network' } })
  })

  it('trims content before checking emptiness', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('  # Hello  '),
    })

    const result = await loadMd('https://example.com/doc.md')
    expect(result).toEqual({
      ok: true,
      md: '# Hello',
      url: 'https://example.com/doc.md',
    })
  })
})
