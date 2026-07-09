'use client'

import { siteConfig } from '@/lib/constants'
import styles from './xp.module.css'

export function WinAbout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <nav className={styles.menuBar} aria-hidden>
        <span>File</span><span>Edit</span><span>Format</span><span>View</span><span>Help</span>
      </nav>
      <pre style={{ flex: 1, margin: 0, padding: 8, fontFamily: '"Lucida Console", monospace', fontSize: 12, whiteSpace: 'pre-wrap', userSelect: 'text' }}>
{`${siteConfig.name}
${siteConfig.title} — ${siteConfig.location}

${siteConfig.description}

Currently ${siteConfig.available ? 'open to interesting conversations.' : 'heads-down building.'}
`}
      </pre>
    </div>
  )
}
