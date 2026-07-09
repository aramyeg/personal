'use client'

import { experiences } from '@/data'
import { siteConfig } from '@/lib/constants'
import styles from './xp.module.css'

export function WinResume() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <nav className={styles.menuBar} aria-hidden>
        <span>File</span><span>Edit</span><span>View</span><span>Insert</span><span>Format</span><span>Help</span>
      </nav>
      <div style={{ flex: 1, overflow: 'auto', background: '#c0c0c0', padding: 12 }}>
        <article style={{ background: '#fff', maxWidth: 560, margin: '0 auto', padding: '32px 40px', boxShadow: '1px 1px 4px rgba(0,0,0,.4)', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 13, userSelect: 'text' }}>
          <h1 style={{ fontSize: 22, marginBottom: 0 }}>{siteConfig.name}</h1>
          <p style={{ marginTop: 2, fontStyle: 'italic' }}>{siteConfig.title} · {siteConfig.location}</p>
          <hr />
          {experiences.map((e) => (
            <section key={e.id} style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, marginBottom: 0 }}>{e.role} — {e.company}</h2>
              <p style={{ margin: '2px 0', color: '#444', fontSize: 12 }}>{e.period} · {e.location}</p>
              <p style={{ margin: '4px 0' }}>{e.description}</p>
              <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                {e.highlights.map((h) => <li key={h}>{h}</li>)}
              </ul>
            </section>
          ))}
        </article>
      </div>
    </div>
  )
}
