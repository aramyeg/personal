'use client'

import styles from './xp.module.css'

export function WinIE() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 11 }}>
      <nav className={styles.menuBar} aria-hidden>
        <span>File</span><span>Edit</span><span>View</span><span>Favorites</span><span>Tools</span><span>Help</span>
      </nav>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 6px', background: '#ece9d8', borderBottom: '1px solid #aca899' }} aria-hidden>
        <span>⬅️</span><span>➡️</span><span>🔄</span><span>🏠</span>
        <span>Address</span>
        <span style={{ flex: 1, background: '#fff', border: '1px solid #7f9db9', padding: '2px 4px' }}>https://aram.dev</span>
        <span style={{ color: '#00309c' }}>Go</span>
      </div>
      <iframe src="/" title="aram.dev" style={{ flex: 1, border: 'none', background: '#fff' }} />
      <footer style={{ padding: '2px 6px', background: '#ece9d8', borderTop: '1px solid #aca899', color: '#555' }} aria-hidden>
        🌐 Internet
      </footer>
    </div>
  )
}
