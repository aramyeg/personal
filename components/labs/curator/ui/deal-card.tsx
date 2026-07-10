import { OPEN_DEAL_ID, type DealCard } from '../adapters'
import { Badge } from './badge'

export function DealCardView({ deal, dragging = false }: { deal: DealCard; dragging?: boolean }) {
  return (
    <div
      data-testid="deal-card"
      className={`rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-3 transition-opacity duration-150 ${dragging ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-medium">{deal.company}</p>
        {deal.id === OPEN_DEAL_ID
          ? <Badge tone="warn">open</Badge>
          : <Badge tone="ok">won</Badge>}
      </div>
      <p className="mt-0.5 truncate text-[12px] text-[var(--c-text-soft)]">{deal.role}</p>
      <div className="mt-2 flex items-center justify-between font-[family-name:var(--font-data)] text-[11px] text-[var(--c-text-soft)]">
        <span>{deal.period}</span>
        {deal.tenureMonths > 0 && <span className="tabular-nums">{deal.tenureMonths} mo</span>}
      </div>
    </div>
  )
}
