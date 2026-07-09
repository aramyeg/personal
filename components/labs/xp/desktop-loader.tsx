'use client'

import dynamic from 'next/dynamic'

/** The desktop bundle loads client-side only; museum/list pay nothing for it. */
export const XpDesktopLoader = dynamic(
  () => import('./xp-desktop').then((m) => m.XpDesktop),
  { ssr: false }
)
