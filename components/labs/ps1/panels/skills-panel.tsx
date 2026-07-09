'use client'

import { skillCategories, skills } from '@/data/skills'
import type { Skill } from '@/types'
import { PanelShell, PSX_UI } from './panel-shell'

const SEGMENTS = 5
const LEVEL_FILL: Record<Skill['level'], number> = {
  expert: 5,
  advanced: 4,
  intermediate: 3,
}

/** Segmented HP-bar: filled blocks for the skill's level, empty for the rest. */
function LevelBar({ level }: { level: Skill['level'] }) {
  const filled = LEVEL_FILL[level]
  return (
    <span className="flex items-center gap-[3px]" aria-label={level}>
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="h-3 w-2.5"
          style={{
            background: i < filled ? PSX_UI.teal : 'transparent',
            boxShadow: `inset 0 0 0 1px ${i < filled ? PSX_UI.teal : PSX_UI.borderSoft}`,
          }}
        />
      ))}
    </span>
  )
}

export function SkillsPanel({ onClose }: { onClose: () => void }) {
  return (
    <PanelShell title="skills · stack" onClose={onClose} sticker="lvl">
      <div className="flex flex-col gap-5">
        {skillCategories.map((cat) => {
          const rows = skills.filter((s) => s.category === cat.id)
          if (rows.length === 0) return null
          return (
            <section key={cat.id}>
              <h3
                className="mb-2 border-b-2 pb-1 text-[12px] font-black uppercase tracking-[0.2em]"
                style={{
                  color: PSX_UI.teal,
                  borderColor: PSX_UI.borderSoft,
                  fontFamily: "'Arial Black','Helvetica Neue',Arial,sans-serif",
                }}
              >
                {cat.label}
              </h3>
              <ul className="flex flex-col">
                {rows.map((skill) => (
                  <li
                    key={skill.name}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-1.5"
                  >
                    <span
                      className="text-[13px] uppercase tracking-[0.04em]"
                      style={{ color: PSX_UI.ink }}
                    >
                      {skill.name}
                    </span>
                    <span
                      className="font-mono text-[10px] tabular-nums lowercase tracking-[0.1em]"
                      style={{ color: PSX_UI.inkDim }}
                    >
                      {skill.years}y
                    </span>
                    <LevelBar level={skill.level} />
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </PanelShell>
  )
}
