export type SortDir = 'asc' | 'desc'

export function sortRows<T>(rows: T[], key: keyof T, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = a[key]; const bv = b[key]
    if (av === null || av === undefined) return 1
    if (bv === null || bv === undefined) return -1
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign
    return String(av).localeCompare(String(bv), 'en', { sensitivity: 'base' }) * sign
  })
}

export function filterRows<T>(rows: T[], query: string, keys: (keyof T)[]): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((r) => keys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)))
}

export function paginate<T>(rows: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const clamped = Math.min(Math.max(page, 0), pageCount - 1)
  return { rows: rows.slice(clamped * pageSize, (clamped + 1) * pageSize), page: clamped, pageCount }
}

const quote = (v: unknown): string => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export function toCsv<T extends object>(rows: T[], columns: { key: keyof T; header: string }[]): string {
  const head = columns.map((c) => quote(c.header)).join(',')
  const body = rows.map((r) => columns.map((c) => quote(r[c.key])).join(','))
  return [head, ...body].join('\r\n')
}
