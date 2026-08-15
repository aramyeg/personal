export function BarChart({ data, title, unit = '' }: {
  data: { label: string; value: number }[]; title: string; unit?: string
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">{title}</p>
      <ul className="mt-3 space-y-2.5">
        {data.map((d) => (
          <li key={d.label} className="grid grid-cols-[110px_1fr_44px] items-center gap-3">
            <span className="truncate text-[12px]">{d.label}</span>
            <span className="h-2 rounded-full bg-[#eef1f6]">
              <span
                className="block h-2 rounded-full bg-[var(--c-navy)] transition-[width] duration-150"
                style={{ width: `${(d.value / max) * 100}%` }}
              />
            </span>
            <span className="text-right font-[family-name:var(--font-data)] text-[11px] tabular-nums text-[var(--c-text-soft)]">
              {d.value}{unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
