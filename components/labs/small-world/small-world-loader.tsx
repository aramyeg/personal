'use client'
import dynamic from 'next/dynamic'

/** The 3D bundle loads client-side only; museum/list pay nothing for it. */
export const SmallWorldLoader = dynamic(
  () => import('./small-world-experience').then((m) => m.SmallWorldExperience),
  { ssr: false }
)
