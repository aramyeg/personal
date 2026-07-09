'use client'

import { atticLabs } from '@/lib/labs-manifest'

export function WinRecycleBin() {
  return (
    <div style={{ padding: 12, fontSize: 11, userSelect: 'text' }}>
      {atticLabs.length === 0 && <p>The Recycle Bin is empty.</p>}
      {atticLabs.map((lab) => (
        <article key={lab.slug} style={{ display: 'flex', gap: 10, borderBottom: '1px solid #d6d3ce', padding: '8px 2px' }}>
          <span style={{ fontSize: 28 }} aria-hidden>🗑️</span>
          <div>
            <strong>{lab.title}</strong> <span style={{ color: '#777' }}>— deleted {lab.date}</span>
            <p style={{ margin: '4px 0' }}>{lab.retrospective}</p>
            <a href={lab.href ?? `/labs/${lab.slug}`} aria-label={`Restore ${lab.title}`} style={{ color: '#0026b8' }}>
              Restore
            </a>
          </div>
        </article>
      ))}
    </div>
  )
}
