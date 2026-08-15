import { labs } from '@/lib/labs-manifest'

export type TrafficPoint = { date: string; visitors: number }
export interface AnalyticsSource {
  getTraffic(days: number): TrafficPoint[]
  getVisitorKpi(): { weekly: number; deltaPct: number }
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

export class SimulatedAnalyticsSource implements AnalyticsSource {
  private end: Date
  constructor(endDate?: Date) {
    this.end = endDate ?? new Date()
  }

  getTraffic(days: number): TrafficPoint[] {
    const shipDates = new Set(labs.map((l) => l.date))
    const points: TrafficPoint[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(this.end)
      d.setUTCDate(d.getUTCDate() - i)
      const date = iso(d)
      // Seed noise from the DATE, not the loop index, so a given calendar
      // day has the same value in any window length.
      const daySeed = Number(date.replaceAll('-', ''))
      const rand = mulberry32(daySeed)
      const dow = d.getUTCDay()
      const weekend = dow === 0 || dow === 6 ? 0.62 : 1
      const noise = 0.82 + rand() * 0.36
      const spike = shipDates.has(date) ? 2.6 + rand() * 0.8 : 1
      points.push({ date, visitors: Math.round(140 * weekend * noise * spike) })
    }
    return points
  }

  getVisitorKpi() {
    const t = this.getTraffic(14)
    const sum = (ps: TrafficPoint[]) => ps.reduce((n, p) => n + p.visitors, 0)
    const thisWeek = sum(t.slice(7))
    const lastWeek = sum(t.slice(0, 7))
    return { weekly: thisWeek, deltaPct: lastWeek === 0 ? 0 : ((thisWeek - lastWeek) / lastWeek) * 100 }
  }
}

export const analytics: AnalyticsSource = new SimulatedAnalyticsSource()
