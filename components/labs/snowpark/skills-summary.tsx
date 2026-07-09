import { skillCategories, skills } from '@/data/skills'
import { palette } from './palette'

/** Skill categories that map to slope stretches (the joke category is excluded). */
const CATEGORIES = skillCategories.filter((c) => c.id !== 'fun')
const NON_FUN_SKILLS = skills.filter((s) => s.category !== 'fun')

export type SkillMarks = Map<string, 'collected' | 'missed'>

const MARK_GLYPH: Record<'collected' | 'missed', string> = {
  collected: '●',
  missed: '○',
}

const MARK_COLOR: Record<'collected' | 'missed', string> = {
  collected: palette.amber,
  missed: palette.ink,
}

/**
 * Pure presentational skill list — no hooks, no client directive — so it
 * renders on the server (crawlable sr-only section) as well as inside client
 * overlays (reduced-motion/skip sheet, recap). `marks` overlays a
 * collected/missed glyph per skill name; omitted, it's a plain reference list.
 */
export function SkillsSummary({
  marks,
  className,
}: {
  marks?: SkillMarks
  className?: string
}) {
  return (
    <div className={className}>
      <h2 className="font-mono text-3xl lowercase" style={{ color: palette.ink }}>
        skills
      </h2>
      <div className="mt-6 flex flex-col gap-6">
        {CATEGORIES.map((cat) => {
          const group = NON_FUN_SKILLS.filter((s) => s.category === cat.id)
          if (group.length === 0) return null
          return (
            <div key={cat.id}>
              <h3
                className="font-mono text-[11px] uppercase tracking-widest"
                style={{ color: palette.blueDeep }}
              >
                {cat.label}
              </h3>
              <ul className="mt-2 flex flex-col gap-1">
                {group.map((s) => {
                  const mark = marks?.get(s.name)
                  return (
                    <li key={s.name} className="font-mono text-xs" style={{ color: palette.ink }}>
                      {mark && (
                        <span aria-hidden style={{ color: MARK_COLOR[mark] }}>
                          {MARK_GLYPH[mark]}{' '}
                        </span>
                      )}
                      <span>{s.name}</span> <span>{s.years} yrs · {s.level}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
