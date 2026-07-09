'use client'

import { openApp } from './apps'
import type { XpAppId } from './store'

const SHORTCUTS: { app: XpAppId; label: string; icon: string }[] = [
  { app: 'my-projects', label: 'My Projects', icon: '📁' },
  { app: 'resume', label: 'resume.doc', icon: '📝' },
  { app: 'about', label: 'about-me.txt', icon: '🗒️' },
  { app: 'add-remove', label: 'Add or Remove Programs', icon: '🧩' },
]

export function WinMyComputer() {
  return (
    <div style={{ padding: 12, fontSize: 11 }}>
      <h3 style={{ margin: '0 0 6px', borderBottom: '1px solid #aca899', paddingBottom: 3 }}>Hard Disk Drives</h3>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 28 }} aria-hidden>💽</span>
          <div>
            Local Disk (C:)
            <div style={{ width: 90, height: 10, border: '1px solid #7f9db9', marginTop: 2 }}>
              <div style={{ width: '78%', height: '100%', background: '#3168d5' }} />
            </div>
          </div>
        </div>
      </div>
      <h3 style={{ margin: '0 0 6px', borderBottom: '1px solid #aca899', paddingBottom: 3 }}>Files Stored on This Computer</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {SHORTCUTS.map((s) => (
          <button
            key={s.app}
            type="button"
            onDoubleClick={() => openApp(s.app)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, padding: 4 }}
          >
            <span style={{ fontSize: 24 }} aria-hidden>{s.icon}</span> {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
