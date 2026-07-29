export function clampWidth(width: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, width))
}
