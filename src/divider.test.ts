import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clampWidth, mountResizer } from './divider'

describe('clampWidth', () => {
  it('returns the value unchanged when within range', () => {
    expect(clampWidth(300, 160, 480)).toBe(300)
  })

  it('clamps to min when below range', () => {
    expect(clampWidth(100, 160, 480)).toBe(160)
  })

  it('clamps to max when above range', () => {
    expect(clampWidth(600, 160, 480)).toBe(480)
  })

  it('returns min when value equals min', () => {
    expect(clampWidth(160, 160, 480)).toBe(160)
  })

  it('returns max when value equals max', () => {
    expect(clampWidth(480, 160, 480)).toBe(480)
  })
})

describe('mountResizer', () => {
  beforeEach(() => {
    document.body.innerHTML = '<aside id="outline"></aside><div class="resizer" id="resizer"></div>'
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('adds the mounted class on mount so CSS makes it visible', () => {
    const resizer = document.getElementById('resizer')!
    const outline = document.getElementById('outline')!
    mountResizer(resizer, outline)
    expect(resizer.classList.contains('mounted')).toBe(true)
  })

  it('destroy removes the mounted class', () => {
    const resizer = document.getElementById('resizer')!
    const outline = document.getElementById('outline')!
    const handle = mountResizer(resizer, outline)
    handle.destroy()
    expect(resizer.classList.contains('mounted')).toBe(false)
  })
})
