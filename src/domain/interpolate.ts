/**
 * Piecewise-linear interpolation across anchor points, clamped at both ends.
 *
 * Lives in its own module because both the deal scorer and the market scorer
 * need it; importing it from either one would create a cycle once the deal
 * scorer started consuming market data.
 */
export function interpolate(
  anchors: ReadonlyArray<readonly [number, number]>,
  value: number,
): number {
  const first = anchors[0]
  const last = anchors[anchors.length - 1]
  if (!first || !last) return 0
  if (value <= first[0]) return first[1]
  if (value >= last[0]) return last[1]

  for (let i = 0; i < anchors.length - 1; i += 1) {
    const lo = anchors[i]
    const hi = anchors[i + 1]
    if (!lo || !hi) continue
    if (value >= lo[0] && value <= hi[0]) {
      const span = hi[0] - lo[0]
      if (span === 0) return hi[1]
      const t = (value - lo[0]) / span
      return lo[1] + t * (hi[1] - lo[1])
    }
  }
  return last[1]
}
