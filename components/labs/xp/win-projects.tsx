'use client'

import { useState } from 'react'
import { projects, categoryLabels } from '@/data/projects'
import { isCoarse, openApp } from './apps'
import styles from './xp.module.css'

export function WinProjects() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = projects.find((p) => p.id === selectedId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 11 }}>
      <nav className={styles.menuBar} aria-hidden>
        <span>File</span><span>Edit</span><span>View</span><span>Favorites</span><span>Tools</span><span>Help</span>
      </nav>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '3px 6px', borderTop: '1px solid #fff', borderBottom: '1px solid #aca899', background: '#ece9d8' }}>
        <span>Address</span>
        <span style={{ flex: 1, background: '#fff', border: '1px solid #7f9db9', padding: '2px 4px' }}>
          C:\Documents and Settings\Aram\My Projects
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <aside style={{ width: 180, padding: 10, background: 'linear-gradient(180deg,#748aff,#4057d3)', color: '#fff', overflow: 'auto' }}>
          <h3 style={{ fontSize: 11, margin: '0 0 6px' }}>Details</h3>
          {selected ? (
            <div style={{ background: 'rgba(255,255,255,.15)', borderRadius: 4, padding: 8 }}>
              <strong>{selected.title}</strong>
              <p style={{ margin: '4px 0' }}>{selected.description}</p>
              <p style={{ margin: '4px 0', opacity: 0.85 }}>{selected.role} · {selected.company} · {selected.year}</p>
              <p style={{ margin: 0, opacity: 0.85 }}>{categoryLabels[selected.category].label}</p>
            </div>
          ) : (
            <p style={{ opacity: 0.8 }}>Select a folder to see its details.</p>
          )}
        </aside>
        <ul style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 4, listStyle: 'none', margin: 0, padding: 10, background: '#fff', overflow: 'auto' }}>
          {projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => { if (isCoarse()) openApp('project-detail', p.id, p.title); else setSelectedId(p.id) }}
                onDoubleClick={() => openApp('project-detail', p.id, p.title)}
                style={{ width: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 6, background: selectedId === p.id ? '#316ac5' : 'none', color: selectedId === p.id ? '#fff' : '#000', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, textAlign: 'center' }}
              >
                <span style={{ fontSize: 32 }} aria-hidden>📁</span>
                {p.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
