import { describe, expect, it } from 'vitest'
import { SimulatedAnalyticsSource, mulberry32 } from '@/components/labs/curator/analytics-source'

const END = new Date('2026-07-10T12:00:00Z')

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42); const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe('SimulatedAnalyticsSource', () => {
  it('returns one point per day, dated, deterministic', () => {
    const s1 = new SimulatedAnalyticsSource(END).getTraffic(90)
    const s2 = new SimulatedAnalyticsSource(END).getTraffic(90)
    expect(s1).toHaveLength(90)
    expect(s1[89].date).toBe('2026-07-10')
    expect(s1).toEqual(s2)
    expect(s1.every((p) => p.visitors > 0)).toBe(true)
  })
  it('spikes on lab ship dates', () => {
    const series = new SimulatedAnalyticsSource(END).getTraffic(90)
    const byDate = Object.fromEntries(series.map((p) => [p.date, p.visitors]))
    // xp shipped 2026-07-09 (a Thursday); compare to the plain Monday before
    expect(byDate['2026-07-09']).toBeGreaterThan(byDate['2026-07-06'] * 1.5)
  })
  it('computes weekly KPI with delta', () => {
    const kpi = new SimulatedAnalyticsSource(END).getVisitorKpi()
    expect(kpi.weekly).toBeGreaterThan(0)
    expect(Number.isFinite(kpi.deltaPct)).toBe(true)
  })
})
