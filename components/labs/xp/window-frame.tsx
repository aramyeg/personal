'use client'

import { useRef, type ReactNode } from 'react'
import { useXpStore, type XpWindow } from './store'
import { isCoarse } from './apps'
import styles from './xp.module.css'

export function WindowFrame({ win, children }: { win: XpWindow; children: ReactNode }) {
  const { closeWindow, clickTaskButton, toggleMaximize, focusWindow, moveWindow } = useXpStore.getState()
  const active = useXpStore((s) => s.activeId === win.id)
  const drag = useRef<{ dx: number; dy: number } | null>(null)

  const onTitleDown = (e: React.PointerEvent) => {
    if (win.maximized || isCoarse()) return
    drag.current = { dx: e.clientX - win.x, dy: e.clientY - win.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onTitleMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    moveWindow(win.id, Math.max(-win.w + 80, e.clientX - drag.current.dx), Math.max(0, e.clientY - drag.current.dy))
  }
  const onTitleUp = () => { drag.current = null }

  const geometry = win.maximized
    ? { left: 0, top: 0, width: '100%', height: 'calc(100% - 30px)' }
    : { left: win.x, top: win.y, width: win.w, height: win.h }

  if (win.minimized) return null
  return (
    <section
      data-testid={`window-${win.id}`}
      className={`${styles.windowFrame} ${active ? styles.windowActive : ''}`}
      style={{ ...geometry, zIndex: win.z }}
      onPointerDown={() => focusWindow(win.id)}
      aria-label={win.title}
    >
      <header
        className={styles.titleBar}
        onPointerDown={onTitleDown}
        onPointerMove={onTitleMove}
        onPointerUp={onTitleUp}
        onDoubleClick={() => toggleMaximize(win.id)}
      >
        <span className={styles.titleText}>{win.title}</span>
        <span className={styles.titleButtons}>
          <button type="button" className={styles.titleBtn} aria-label="Minimize" onClick={() => clickTaskButton(win.id)}>_</button>
          <button type="button" className={styles.titleBtn} aria-label="Maximize" onClick={() => toggleMaximize(win.id)}>□</button>
          <button type="button" className={`${styles.titleBtn} ${styles.closeBtn}`} aria-label="Close" onClick={() => closeWindow(win.id)}>✕</button>
        </span>
      </header>
      <div className={styles.windowBody}>{children}</div>
    </section>
  )
}
