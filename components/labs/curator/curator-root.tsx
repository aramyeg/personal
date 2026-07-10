'use client'

import './fonts'
import styles from './curator.module.css'
import { AppShell } from './app-shell'
import { LoginScreen } from './login-screen'

export function CuratorRoot({ session }: { session: { email: string } | null }) {
  return (
    <div className={`${styles.root} fixed inset-0 overflow-hidden`}>
      {session ? <AppShell email={session.email} /> : <LoginScreen />}
    </div>
  )
}
