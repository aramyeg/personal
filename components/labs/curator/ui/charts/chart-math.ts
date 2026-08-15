export type XY = { x: number; y: number }

export function scalePoints(values: number[], width: number, height: number, pad = 4): XY[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  const step = values.length > 1 ? innerW / (values.length - 1) : 0
  return values.map((v, i) => ({
    x: pad + i * step,
    y: pad + innerH - ((v - min) / span) * innerH,
  }))
}

export const linePath = (pts: XY[]): string =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

export function areaPath(pts: XY[], height: number): string {
  if (pts.length === 0) return ''
  const last = pts[pts.length - 1]
  return `${linePath(pts)} L ${last.x} ${height} L ${pts[0].x} ${height} Z`
}
