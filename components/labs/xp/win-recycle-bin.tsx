'use client'

import { useEffect } from 'react'
import { atticLabs, labHref } from '@/lib/labs-manifest'
import { playSound } from './sounds'

export function WinRecycleBin() {
  useEffect(() => {
    playSound('recycle')
  }, [])

  return (
    <div style={{ padding: 12, fontSize: 11, userSelect: 'text' }}>
      {atticLabs.length === 0 && <p>The Recycle Bin is empty.</p>}
      {atticLabs.map((lab) => {
        const href = labHref(lab)
        return (
          <article key={lab.slug} style={{ display: 'flex', gap: 10, borderBottom: '1px solid #d6d3ce', padding: '8px 2px' }}>
            <span style={{ fontSize: 28 }} aria-hidden>🗑️</span>
            <div>
              <strong>{lab.title}</strong> <span style={{ color: '#777' }}>— deleted {lab.date}</span>
              <p style={{ margin: '4px 0' }}>{lab.retrospective}</p>
              {/* A remnant kept its entry in the bin but has nothing to restore
                  to — Windows greying out the action it cannot perform. */}
              {href ? (
                <a href={href} aria-label={`Restore ${lab.title}`} style={{ color: '#0026b8' }}>
                  Restore
                </a>
              ) : (
                <span style={{ color: '#9a9a9a' }} title="The original location is no longer available.">
                  Restore
                </span>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
