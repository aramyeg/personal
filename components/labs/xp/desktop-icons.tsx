'use client'

import { useState } from 'react'
import { DESKTOP_ICONS, openApp } from './apps'
import { useXpStore, type XpAppId } from './store'
import styles from './xp.module.css'

export function DesktopIcons() {
  const [selected, setSelected] = useState<string | null>(null)

  const activate = (app: XpAppId | 'chaos') => {
    if (app === 'chaos') useXpStore.getState().startChaos()
    else openApp(app)
  }

  return (
    <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', flexWrap: 'wrap', gap: 6, maxHeight: 'calc(100% - 60px)' }}>
      {DESKTOP_ICONS.map((it) => (
        <button
          key={it.label}
          type="button"
          className={`${styles.icon} ${selected === it.label ? styles.iconSelected : ''}`}
          style={{ background: selected === it.label ? undefined : 'transparent', border: selected === it.label ? undefined : '1px solid transparent' }}
          onClick={() => setSelected(it.label)}
          onDoubleClick={() => activate(it.app)}
          onKeyDown={(e) => e.key === 'Enter' && activate(it.app)}
        >
          <span className={styles.iconGlyph} aria-hidden>{it.icon}</span>
          <span className={styles.iconLabel}>{it.label}</span>
        </button>
      ))}
    </div>
  )
}
