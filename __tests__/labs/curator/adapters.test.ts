import {
  tenureMonths, getRoomRows, getPersonnelRows, getDealCards, getActivity, getRealKpis, OPEN_DEAL_ID,
} from '@/components/labs/curator/adapters'
import { labs } from '@/lib/labs-manifest'
import { experiences } from '@/data/experience'

const NOW = new Date('2026-07-10')

describe('tenureMonths', () => {
  it('computes closed ranges', () => {
    expect(tenureMonths('2022-02', '2023-06')).toBe(16)
  })
  it('uses now for open ranges', () => {
    expect(tenureMonths('2023-05', null, NOW)).toBe(38)
  })
})

describe('adapters', () => {
  it('maps every manifest lab to a room row with resolved href', () => {
    const rows = getRoomRows()
    expect(rows).toHaveLength(labs.length)
    expect(rows.find((r) => r.slug === 'main')?.href).toBe('/')
    expect(rows.find((r) => r.slug === 'xp')?.href).toBe('/labs/xp')
  })
  it('maps every experience to a personnel row', () => {
    const rows = getPersonnelRows(NOW)
    expect(rows).toHaveLength(experiences.length)
    expect(rows[0].tenureMonths).toBeGreaterThan(0)
  })
  it('builds deals: all past roles closed-won plus one open card in sourced', () => {
    const deals = getDealCards(NOW)
    expect(deals).toHaveLength(experiences.length + 1)
    const open = deals.find((d) => d.id === OPEN_DEAL_ID)
    expect(open?.defaultColumn).toBe('sourced')
    expect(deals.filter((d) => d.defaultColumn === 'closed-won')).toHaveLength(experiences.length)
  })
  it('derives activity from manifest, newest first', () => {
    const events = getActivity()
    expect(events.length).toBeGreaterThanOrEqual(labs.length)
    const dates = events.map((e) => e.date)
    expect([...dates].sort().reverse()).toEqual(dates)
  })
  it('real KPIs count manifest and compute years', () => {
    const k = getRealKpis(NOW)
    expect(k.rooms).toBe(labs.length)
    expect(k.attic).toBe(labs.filter((l) => l.status === 'attic').length)
    expect(k.yearsInProduction).toBe(10) // 2016-01 → 2026-07
  })
})
