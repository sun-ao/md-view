export type FetchResult =
  | { ok: true; md: string; url: string }
  | { ok: false; error: FetchError }

export type FetchError =
  | { kind: 'no_url' }
  | { kind: 'network' }
  | { kind: 'cors' }
  | { kind: 'http'; status: number }
  | { kind: 'empty' }

const TIMEOUT_MS = 10_000

function isHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

export async function loadMd(url: string): Promise<FetchResult> {
  if (!isHttpUrl(url)) {
    return { ok: false, error: { kind: 'no_url' } }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/plain, text/markdown' },
      signal: controller.signal,
    })

    if (!response.ok) {
      return { ok: false, error: { kind: 'http', status: response.status } }
    }

    const raw = await response.text()
    const md = raw.trim()
    if (md.length === 0) {
      return { ok: false, error: { kind: 'empty' } }
    }

    return { ok: true, md, url }
  } catch (err) {
    return { ok: false, error: { kind: 'network' } }
  } finally {
    clearTimeout(timeoutId)
  }
}
