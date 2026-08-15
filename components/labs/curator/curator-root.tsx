'use client'

import './fonts'
import styles from './curator.module.css'
import { AppShell } from './app-shell'
import { LoginScreen } from './login-screen'
import { useCuratorStore } from './store'

export function CuratorRoot({ session }: { session: { email: string } | null }) {
  const reduceMotion = useCuratorStore((s) => s.preferences.reduceMotion)

  return (
    <div className={`${styles.root} fixed inset-0 overflow-hidden`} data-reduce-motion={reduceMotion ? '' : undefined}>
      {session ? <AppShell email={session.email} /> : <LoginScreen />}
    </div>
  )
}
