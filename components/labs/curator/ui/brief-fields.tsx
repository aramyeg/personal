import type { EngineeringBrief } from '../annotations'

const FIELDS: { key: 'stack' | 'pattern' | 'rationale'; label: string }[] = [
  { key: 'stack', label: 'STACK' },
  { key: 'pattern', label: 'PATTERN' },
  { key: 'rationale', label: 'RATIONALE' },
]

/** Mono "ENGINEERING BRIEF · EB-00N" eyebrow + title. Shared by SpecChip and the Engineering handbook. */
export function BriefHeader({ brief }: { brief: EngineeringBrief }) {
  return (
    <>
      <p className="font-[family-name:var(--font-data)] text-[11px] uppercase tracking-[0.06em] text-[var(--c-text-soft)]">
        ENGINEERING BRIEF · {brief.id}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-[var(--c-text)]">{brief.title}</p>
    </>
  )
}

/** STACK / PATTERN / RATIONALE field rows. Shared by SpecChip and the Engineering handbook. */
export function BriefFields({ brief }: { brief: EngineeringBrief }) {
  return (
    <div className="mt-3 space-y-3">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <p className="font-[family-name:var(--font-data)] text-[10px] uppercase tracking-[0.06em] text-[var(--c-text-soft)]">
            {f.label}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--c-text)]">{brief[f.key]}</p>
        </div>
      ))}
    </div>
  )
}
