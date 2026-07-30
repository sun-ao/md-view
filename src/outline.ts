export interface OutlineHandle {
  destroy(): void
}

/**
 * Pick the active outline index given heading tops (relative to the scroll
 * container viewport) and a threshold line. The active heading is the last one
 * whose top has scrolled above the threshold. If none have crossed, default to
 * the first heading. When `atBottom` is true (the scroll container is at its
 * maximum scroll), the last heading is forced active so short trailing sections
 * that can't reach the threshold line still highlight correctly. Returns -1
 * for an empty array.
 */
export function findActiveIndex(tops: number[], threshold: number, atBottom = false): number {
  if (tops.length === 0) return -1
  if (atBottom) return tops.length - 1
  let active = 0
  for (let i = 0; i < tops.length; i++) {
    if (tops[i] < threshold) {
      active = i
    }
  }
  return active
}

const HEADING_SELECTOR =
  '.vditor-reset h1, .vditor-reset h2, .vditor-reset h3, ' +
  '.vditor-reset h4, .vditor-reset h5, .vditor-reset h6'

const ACTIVE_THRESHOLD = 80
const POLL_INTERVAL = 100
const POLL_TIMEOUT = 5000

function queryHeadings(sourceEl: HTMLElement): HTMLElement[] {
  return Array.from(sourceEl.querySelectorAll<HTMLElement>(HEADING_SELECTOR))
}

/**
 * Vditor renders the preview HTML asynchronously after init() resolves, so the
 * headings may not exist in the DOM yet. Poll until they appear or the timeout
 * elapses, returning whatever was found (possibly empty).
 */
async function waitForHeadings(sourceEl: HTMLElement): Promise<HTMLElement[]> {
  const start = Date.now()
  while (Date.now() - start < POLL_TIMEOUT) {
    const headings = queryHeadings(sourceEl)
    if (headings.length > 0) return headings
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
  }
  return queryHeadings(sourceEl)
}

/**
 * Build a clickable, scroll-spy outline of the rendered headings inside
 * `sourceEl` into `container`. Returns null when there are no headings.
 */
export async function mountOutline(
  container: HTMLElement,
  sourceEl: HTMLElement,
): Promise<OutlineHandle | null> {
  const headings = await waitForHeadings(sourceEl)
  if (headings.length === 0) return null

  let clickedIndex: number | null = null

  const items: HTMLElement[] = []
  headings.forEach((heading, i) => {
    const level = heading.tagName.toLowerCase().substring(1)
    const text = heading.textContent ?? ''
    const item = document.createElement('div')
    item.className = `outline-item outline-level-${level}`
    item.textContent = text
    // Native tooltip so truncated long headings reveal full text on hover.
    item.title = text
    item.addEventListener('click', () => {
      clickedIndex = i
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Update immediately: when the preview is already at the bottom (or the
      // heading can't scroll further), no 'scroll' event fires, so update()
      // would never run and the highlight would stay on the wrong item.
      update()
    })
    container.appendChild(item)
    items.push(item)
  })

  const scrollContainer = sourceEl.querySelector<HTMLElement>('.vditor-preview')

  const update = (): void => {
    if (!scrollContainer) return
    const baseTop = scrollContainer.getBoundingClientRect().top
    const tops = headings.map((h) => h.getBoundingClientRect().top - baseTop)
    // Bottom detection: when the preview is scrolled to its maximum, a short
    // trailing heading can't cross the threshold line, so force the last one
    // active. Guard with scrollHeight > clientHeight so non-scrollable content
    // (and jsdom's zero metrics) isn't falsely treated as "at the bottom".
    const atBottom =
      scrollContainer.scrollHeight > scrollContainer.clientHeight &&
      scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 1
    // Honor a click: a smooth scroll from a click may not bring the heading
    // above the threshold (short trailing sections at the document bottom).
    // Keep the clicked heading active until the user scrolls manually.
    const idx =
      clickedIndex !== null ? clickedIndex : findActiveIndex(tops, ACTIVE_THRESHOLD, atBottom)
    items.forEach((it, i) => it.classList.toggle('outline-active', i === idx))
    if (idx >= 0) {
      items[idx].scrollIntoView({ block: 'nearest' })
    }
  }

  const clearClickLock = (): void => {
    clickedIndex = null
  }

  update()
  scrollContainer?.addEventListener('scroll', update, { passive: true })
  // Manual scroll (wheel/touch) ends the click lock so scroll-spy resumes.
  scrollContainer?.addEventListener('wheel', clearClickLock, { passive: true })
  scrollContainer?.addEventListener('touchstart', clearClickLock, { passive: true })

  return {
    destroy(): void {
      scrollContainer?.removeEventListener('scroll', update)
      scrollContainer?.removeEventListener('wheel', clearClickLock)
      scrollContainer?.removeEventListener('touchstart', clearClickLock)
      container.innerHTML = ''
    },
  }
}
