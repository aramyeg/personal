'use client'

import './fonts'
import styles from './curator.module.css'
import { AppShell } from './app-shell'

export function CuratorRoot() {
  return (
    <div className={`${styles.root} fixed inset-0 overflow-hidden`}>
      <AppShell />
    </div>
  )
}
