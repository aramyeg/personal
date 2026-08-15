export function KpiCard({
  label, value, delta, caption,
}: { label: string; value: string; delta?: number; caption?: string }) {
  return (
    <div className="rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-data)] text-[28px] font-semibold leading-none tabular-nums">
          {value}
        </span>
        {delta !== undefined && (
          <span
            className={`text-[12px] font-medium ${delta >= 0 ? 'text-[var(--c-ok)]' : 'text-[var(--c-bad)]'}`}
          >
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      {caption && <p className="mt-1 text-[11px] text-[var(--c-text-soft)]">{caption}</p>}
    </div>
  )
}
