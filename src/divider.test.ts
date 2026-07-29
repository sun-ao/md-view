import { describe, expect, it } from 'vitest'
import { clampWidth } from './divider'

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
