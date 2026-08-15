import type { ReactNode } from 'react'

/**
 * Parallel-route layout for the Memory Card lab. The implicit `children` slot is
 * the character-select screen (`page.tsx`, which keeps the lab's metadata and
 * its GalleryChrome/Audio/Cursor composition); the `@panel` slot is the
 * intercepting save overlay, empty (`@panel/default.tsx` → null) until a save is
 * loaded via client navigation. Kept a bare fragment so it never re-wraps that
 * composition — the overlay owns its own audio provider.
 */
export default function MemoryCardLabLayout({
  children,
  panel,
}: {
  children: ReactNode
  panel: ReactNode
}) {
  return (
    <>
      {children}
      {panel}
    </>
  )
}

