import { describe, expect, it } from 'vitest'
import { getErrorMessage, parseUrlParam } from './main'
import type { FetchError } from './load-md'

describe('getErrorMessage', () => {
  it('returns prompt message for no_url', () => {
    const error: FetchError = { kind: 'no_url' }
    const msg = getErrorMessage(error)
    expect(msg).toContain('?url=')
    expect(msg).toContain('md文件地址')
  })

  it('returns CORS/network message for network error', () => {
    const error: FetchError = { kind: 'network' }
    const msg = getErrorMessage(error)
    expect(msg).toContain('CORS')
    expect(msg).toContain('跨域')
  })

  it('returns CORS/network message for cors error', () => {
    const error: FetchError = { kind: 'cors' }
    const msg = getErrorMessage(error)
    expect(msg).toContain('CORS')
  })

  it('returns HTTP status in message for http error', () => {
    const error: FetchError = { kind: 'http', status: 404 }
    const msg = getErrorMessage(error)
    expect(msg).toContain('404')
  })

  it('returns empty message for empty error', () => {
    const error: FetchError = { kind: 'empty' }
    const msg = getErrorMessage(error)
    expect(msg).toContain('空')
  })
})

describe('parseUrlParam', () => {
  it('returns null when no url param', () => {
    expect(parseUrlParam('')).toBeNull()
    expect(parseUrlParam('?foo=bar')).toBeNull()
  })

  it('returns null when url param is empty', () => {
    expect(parseUrlParam('?url=')).toBeNull()
  })

  it('returns the url value when present', () => {
    expect(parseUrlParam('?url=https://example.com/doc.md')).toBe('https://example.com/doc.md')
  })

  it('returns the url value when other params present', () => {
    expect(parseUrlParam('?foo=bar&url=https://example.com/doc.md&baz=1')).toBe('https://example.com/doc.md')
  })

  it('decodes URL-encoded values', () => {
    expect(parseUrlParam('?url=https%3A%2F%2Fexample.com%2Fdoc.md')).toBe('https://example.com/doc.md')
  })
})
