'use client'

import dynamic from 'next/dynamic'

/** The game bundle loads client-side only; the museum/list pay nothing for it. */
export const SnowparkGameLoader = dynamic(
  () => import('./snowpark-game').then((m) => m.SnowparkGame),
  { ssr: false }
)
