import { sortRows, filterRows, paginate, toCsv } from '@/components/labs/curator/ui/table-core'

type Row = { name: string; years: number; end: string | null }
const rows: Row[] = [
  { name: 'beta', years: 3, end: '2023-06' },
  { name: 'Alpha', years: 8, end: null },
  { name: 'gamma', years: 5, end: '2021-10' },
]

describe('sortRows', () => {
  it('sorts strings case-insensitively, returns a new array', () => {
    const out = sortRows(rows, 'name', 'asc')
    expect(out.map((r) => r.name)).toEqual(['Alpha', 'beta', 'gamma'])
    expect(out).not.toBe(rows)
    expect(rows[0].name).toBe('beta') // input untouched
  })
  it('sorts numbers desc', () => {
    expect(sortRows(rows, 'years', 'desc').map((r) => r.years)).toEqual([8, 5, 3])
  })
  it('sorts nulls last regardless of direction', () => {
    expect(sortRows(rows, 'end', 'asc').at(-1)?.end).toBeNull()
    expect(sortRows(rows, 'end', 'desc').at(-1)?.end).toBeNull()
  })
})

describe('filterRows', () => {
  it('matches case-insensitive substrings across keys', () => {
    expect(filterRows(rows, 'ALPH', ['name'])).toHaveLength(1)
    expect(filterRows(rows, '2021', ['name', 'end'])).toHaveLength(1)
    expect(filterRows(rows, '', ['name'])).toHaveLength(3)
  })
})

describe('paginate', () => {
  it('slices pages and reports pageCount', () => {
    const p0 = paginate(rows, 0, 2)
    expect(p0.rows).toHaveLength(2)
    expect(p0.pageCount).toBe(2)
    expect(paginate(rows, 1, 2).rows).toHaveLength(1)
  })
  it('clamps out-of-range pages', () => {
    expect(paginate(rows, 99, 2).page).toBe(1)
    expect(paginate([], 0, 2).pageCount).toBe(1)
  })
})

describe('toCsv', () => {
  it('serializes with quoting', () => {
    const csv = toCsv(
      [{ a: 'plain', b: 'has, comma' }, { a: 'has "quote"', b: 'line\nbreak' }],
      [{ key: 'a', header: 'A' }, { key: 'b', header: 'B' }]
    )
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('A,B')
    expect(lines[1]).toBe('plain,"has, comma"')
    expect(lines[2]).toBe('"has ""quote""","line\nbreak"') // the \n stays inside the quoted field
  })
})
