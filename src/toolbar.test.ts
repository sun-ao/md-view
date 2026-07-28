import { describe, expect, it } from 'vitest'
import { extractFilename } from './toolbar'

describe('extractFilename', () => {
  it('extracts last path segment with .md extension', () => {
    expect(extractFilename('https://example.com/docs/readme.md')).toBe('readme.md')
  })

  it('strips query string', () => {
    expect(extractFilename('https://example.com/readme.md?foo=bar&baz=1')).toBe('readme.md')
  })

  it('strips hash fragment', () => {
    expect(extractFilename('https://example.com/readme.md#section')).toBe('readme.md')
  })

  it('returns last segment even without .md extension', () => {
    expect(extractFilename('https://example.com/path/readme')).toBe('readme')
  })

  it('returns document.md for URL with empty last segment (trailing slash)', () => {
    expect(extractFilename('https://example.com/path/')).toBe('document.md')
  })

  it('returns document.md for URL with no path', () => {
    expect(extractFilename('https://example.com')).toBe('document.md')
  })

  it('decodes URL-encoded characters', () => {
    expect(extractFilename('https://example.com/path/my%20file.md')).toBe('my file.md')
  })

  it('returns document.md for invalid URL string', () => {
    expect(extractFilename('not-a-url')).toBe('document.md')
  })
})
