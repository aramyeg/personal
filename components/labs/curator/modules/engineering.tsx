import { briefs, type EngineeringBrief } from '../annotations'
import { BriefFields, BriefHeader } from '../ui/brief-fields'

type AreaGroup = { area: EngineeringBrief['area']; items: EngineeringBrief[] }

function groupByArea(list: EngineeringBrief[]): AreaGroup[] {
  const groups: AreaGroup[] = []
  for (const brief of list) {
    const group = groups.find((g) => g.area === brief.area)
    if (group) group.items.push(brief)
    else groups.push({ area: brief.area, items: [brief] })
  }
  return groups
}

function BriefCard({ brief }: { brief: EngineeringBrief }) {
  return (
    <div className="rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
      <BriefHeader brief={brief} />
      <BriefFields brief={brief} />
    </div>
  )
}

export default function EngineeringModule() {
  const groups = groupByArea(briefs)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[18px] font-semibold">Engineering</h1>
        <p className="mt-1 text-[12px] text-[var(--c-text-soft)]">Implementation handbook — how this console is built</p>
      </header>

      {groups.map((group) => (
        <section key={group.area} className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">{group.area}</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {group.items.map((brief) => (
              <BriefCard key={brief.id} brief={brief} />
            ))}
          </div>
        </section>
      ))}

      <p className="font-[family-name:var(--font-data)] text-[11px] text-[var(--c-text-soft)]">
        Handbook generated from annotations.ts — the same source that powers every SPEC chip.
      </p>
    </div>
  )
}
