'use client'

import { skillCategories, getSkillsByCategory } from '@/data'
import type { Skill } from '@/types'
import styles from './xp.module.css'

const LEVEL_MB = { expert: 128, advanced: 64, intermediate: 32 } as const

export function sizeOnDisk(skill: Skill): string {
  const mb = skill.years * LEVEL_MB[skill.level]
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb} MB`
}

export function WinAddRemove() {
  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#ece9d8', padding: 10, fontSize: 11 }}>
      <p style={{ margin: '0 0 8px' }}>Currently installed programs:</p>
      {skillCategories.map((cat) => (
        <section key={cat.id} style={{ marginBottom: 10 }}>
          <h3 style={{ fontSize: 11, margin: '0 0 4px', color: '#00309c' }}>{cat.label}</h3>
          {getSkillsByCategory(cat.id).map((s) => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #d6d3ce', padding: '6px 8px', marginBottom: 2 }}>
              <span aria-hidden>🧩</span>
              <strong style={{ flex: 1 }}>{s.name}</strong>
              <span style={{ color: '#555' }}>Size: {sizeOnDisk(s)}</span>
              <span style={{ color: '#555' }}>Used: {s.years} {s.years === 1 ? 'year' : 'years'}</span>
              <button type="button" className={styles.bevelBtn} disabled style={{ opacity: 0.55, cursor: 'default' }}>Change/Remove</button>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
