'use client'

import { getRoomRows } from '../adapters'
import { Badge } from '../ui/badge'
import { SpecChip } from '../ui/spec-chip'
import { useCuratorStore } from '../store'

const HEADERS: { label: string; className?: string }[] = [
  { label: 'Room' },
  { label: 'Status' },
  { label: 'Shipped' },
  { label: 'Thesis', className: 'hidden md:table-cell' },
  { label: 'Actions' },
]

export default function RoomsModule() {
  const rows = getRoomRows()
  const density = useCuratorStore((s) => s.density)
  const pad = density === 'compact' ? 'py-1.5' : 'py-3'
  const live = rows.filter((r) => r.status === 'live').length

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="text-[18px] font-semibold">Rooms</h1>
          <p className="text-[12px] text-[var(--c-text-soft)]">
            Exhibition inventory — sourced live from the labs manifest
          </p>
        </div>
        <Badge>{rows.length} total</Badge>
        <Badge tone="ok">{live} live</Badge>
        <Badge>{rows.length - live} attic</Badge>
        <SpecChip briefId="EB-003" />
      </header>
      <div className="overflow-x-auto rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--c-border)]">
              {HEADERS.map((h) => (
                <th
                  key={h.label}
                  scope="col"
                  className={`px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)] ${h.className ?? ''}`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} className="border-b border-[var(--c-border)] transition-colors duration-150 last:border-0 hover:bg-[var(--c-hover)]">
                <td className={`px-4 ${pad}`}>
                  <p className="text-[13px] font-medium">{r.title}</p>
                  <p className="font-[family-name:var(--font-data)] text-[11px] text-[var(--c-text-soft)]">{r.slug}</p>
                </td>
                <td className={`px-4 ${pad}`}><Badge tone={r.status === 'live' ? 'ok' : 'neutral'}>{r.status}</Badge></td>
                <td className={`px-4 ${pad} font-[family-name:var(--font-data)] text-[12px] tabular-nums`}>{r.date}</td>
                <td className={`hidden px-4 ${pad} max-w-[420px] truncate text-[12px] text-[var(--c-text-soft)] md:table-cell`} title={r.thesis}>{r.thesis}</td>
                <td className={`px-4 ${pad} text-right`}>
                  <a href={r.href} aria-label={`Open ${r.title}`} className="text-[12px] font-medium text-[var(--c-blue)] hover:underline">Open</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
