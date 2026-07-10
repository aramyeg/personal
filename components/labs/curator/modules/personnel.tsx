'use client'

import { Fragment, useMemo, useState, type ChangeEvent } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import { getPersonnelRows, type PersonnelRow } from '../adapters'
import { filterRows, paginate, sortRows, toCsv, type SortDir } from '../ui/table-core'
import { Badge } from '../ui/badge'
import { SpecChip } from '../ui/spec-chip'
import { useCuratorStore } from '../store'

const PAGE_SIZE = 3
const FILTER_KEYS: (keyof PersonnelRow)[] = ['company', 'role', 'location', 'technologies']
const TH_CLS = 'px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]'
const PAGER_BTN_CLS =
  'rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--c-text)] transition-colors duration-150 hover:bg-[var(--c-hover)] disabled:cursor-not-allowed disabled:opacity-40'

type PersonnelUiState = {
  sortKey: keyof PersonnelRow
  sortDir: SortDir
  query: string
  page: number
  expandedId: string | null
}

const EXPORT_COLUMNS: { key: keyof PersonnelRow; header: string }[] = [
  { key: 'company', header: 'Company' },
  { key: 'role', header: 'Role' },
  { key: 'location', header: 'Location' },
  { key: 'period', header: 'Period' },
  { key: 'tenureMonths', header: 'Tenure (months)' },
  { key: 'description', header: 'Description' },
]

function SortButton({
  label, active, dir, onClick,
}: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Sort by ${label}`}
      onClick={onClick}
      className="inline-flex items-center gap-1 hover:text-[var(--c-text)]"
    >
      {label}
      {active && <span aria-hidden>{dir === 'asc' ? '▲' : '▼'}</span>}
    </button>
  )
}

function exportCsv(rows: PersonnelRow[]) {
  const csv = toCsv(rows, EXPORT_COLUMNS)
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'personnel-records.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function PersonnelModule() {
  const density = useCuratorStore((s) => s.density)
  const pad = density === 'compact' ? 'py-1.5' : 'py-3'
  const [state, setState] = useState<PersonnelUiState>({
    sortKey: 'startDate', sortDir: 'desc', query: '', page: 0, expandedId: null,
  })

  const allRows = useMemo(() => getPersonnelRows(), [])
  const activeCount = useMemo(() => allRows.filter((r) => r.endDate === null).length, [allRows])

  const { sorted, paged } = useMemo(() => {
    const filtered = filterRows(allRows, state.query, FILTER_KEYS)
    const sortedRows = sortRows(filtered, state.sortKey, state.sortDir)
    return { sorted: sortedRows, paged: paginate(sortedRows, state.page, PAGE_SIZE) }
  }, [allRows, state.query, state.sortKey, state.sortDir, state.page])

  function toggleSort(key: keyof PersonnelRow) {
    setState((s) => ({
      ...s,
      sortKey: key,
      sortDir: s.sortKey === key ? (s.sortDir === 'asc' ? 'desc' : 'asc') : 'asc',
    }))
  }

  function handleQueryChange(e: ChangeEvent<HTMLInputElement>) {
    setState((s) => ({ ...s, query: e.target.value, page: 0 }))
  }

  function toggleExpand(id: string) {
    setState((s) => ({ ...s, expandedId: s.expandedId === id ? null : id }))
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="text-[18px] font-semibold">Personnel</h1>
          <p className="text-[12px] text-[var(--c-text-soft)]">
            Workforce records — {activeCount} active resource{activeCount === 1 ? '' : 's'}
          </p>
        </div>
        <SpecChip briefId="EB-007" />
        <input
          type="text"
          placeholder="Filter records…"
          value={state.query}
          onChange={handleQueryChange}
          className="w-[240px] rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5 text-[12px] text-[var(--c-text)] placeholder:text-[var(--c-text-soft)]"
        />
        <button
          type="button"
          onClick={() => exportCsv(sorted)}
          className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--c-text)] transition-colors duration-150 hover:bg-[var(--c-hover)]"
        >
          <Download aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Export CSV
        </button>
      </header>

      <div className="overflow-x-auto rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--c-border)]">
              <th scope="col" className={TH_CLS}>
                <SortButton label="Company" active={state.sortKey === 'company'} dir={state.sortDir} onClick={() => toggleSort('company')} />
              </th>
              <th scope="col" className={TH_CLS}>Role</th>
              <th scope="col" className={`hidden md:table-cell ${TH_CLS}`}>Location</th>
              <th scope="col" className={`hidden md:table-cell ${TH_CLS}`}>
                <SortButton label="Start" active={state.sortKey === 'startDate'} dir={state.sortDir} onClick={() => toggleSort('startDate')} />
              </th>
              <th scope="col" className={TH_CLS}>
                <SortButton label="Tenure" active={state.sortKey === 'tenureMonths'} dir={state.sortDir} onClick={() => toggleSort('tenureMonths')} />
              </th>
              <th scope="col" className={TH_CLS}>Status</th>
              <th scope="col" className={TH_CLS}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((row) => {
              const expanded = state.expandedId === row.id
              return (
                <Fragment key={row.id}>
                  <tr
                    data-testid="personnel-row"
                    className="border-b border-[var(--c-border)] transition-colors duration-150 last:border-0 hover:bg-[var(--c-hover)]"
                  >
                    <td className={`px-4 ${pad} text-[13px] font-medium`}>{row.company}</td>
                    <td className={`px-4 ${pad} text-[12px] text-[var(--c-text-soft)]`}>{row.role}</td>
                    <td className={`hidden px-4 ${pad} text-[12px] text-[var(--c-text-soft)] md:table-cell`}>{row.location}</td>
                    <td className={`hidden px-4 ${pad} font-[family-name:var(--font-data)] text-[12px] tabular-nums md:table-cell`}>{row.startDate}</td>
                    <td className={`px-4 ${pad} font-[family-name:var(--font-data)] text-[12px] tabular-nums`}>{row.tenureMonths} mo</td>
                    <td className={`px-4 ${pad}`}>
                      <Badge tone={row.endDate === null ? 'ok' : 'neutral'}>{row.endDate === null ? 'active' : 'archived'}</Badge>
                    </td>
                    <td className={`px-4 ${pad} text-right`}>
                      <button
                        type="button"
                        aria-label={`Expand record — ${row.company}`}
                        aria-expanded={expanded}
                        onClick={() => toggleExpand(row.id)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] text-[var(--c-text-soft)] transition-colors duration-150 hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]"
                      >
                        <ChevronDown
                          aria-hidden
                          className={`h-4 w-4 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
                          strokeWidth={1.75}
                        />
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-[var(--c-border)] bg-[var(--c-hover)] last:border-0">
                      <td colSpan={7} className="px-4 py-4">
                        <p className="text-[12px] text-[var(--c-text-soft)]">{row.description}</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px]">
                          {row.highlights.map((h) => (
                            <li key={h}>{h}</li>
                          ))}
                        </ul>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {row.technologies.map((t) => (
                            <Badge key={t} tone="neutral">{t}</Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="font-[family-name:var(--font-data)] text-[11px] text-[var(--c-text-soft)]">
          Page {paged.page + 1} of {paged.pageCount}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={paged.page === 0}
            onClick={() => setState((s) => ({ ...s, page: s.page - 1 }))}
            className={PAGER_BTN_CLS}
          >
            Previous page
          </button>
          <button
            type="button"
            disabled={paged.page === paged.pageCount - 1}
            onClick={() => setState((s) => ({ ...s, page: s.page + 1 }))}
            className={PAGER_BTN_CLS}
          >
            Next page
          </button>
        </div>
      </div>
    </div>
  )
}
