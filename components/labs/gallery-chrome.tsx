'use client'

import { useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

/**
 * Shared lab shell: a quiet, style-neutral way back to the gallery.
 * Fixed "← Gallery" button top-left + Esc key → /labs.
 */
export function GalleryChrome({ children }: { children: ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (e.key === 'Escape') router.push('/labs')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  return (
    <>
      <Link
        href="/labs"
        className="fixed top-4 left-4 z-50 rounded-full bg-black/40 px-3 py-1.5 text-xs font-mono uppercase tracking-widest text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
      >
        ← Gallery
      </Link>
      {children}
    </>
  )
}
