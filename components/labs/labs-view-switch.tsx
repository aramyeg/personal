'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { resolveLabsView, type LabsView } from '@/lib/labs-view'
import { LabsList } from '@/components/labs/labs-list'

const MuseumGallery = dynamic(() => import('@/components/labs/museum/museum-gallery'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black font-mono text-xs uppercase tracking-widest text-white/60">
      Entering the gallery…
    </div>
  ),
})

function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

/** Decides and renders the /labs experience; lets the user override it. */
export function LabsViewSwitch() {
  const params = useSearchParams()
  const [view, setView] = useState<LabsView | null>(null)
  const [webgl, setWebgl] = useState(false)

  useEffect(() => {
    const webglSupported = detectWebGL()
    setWebgl(webglSupported)
    setView(
      resolveLabsView({
        param: params.get('view'),
        coarsePointer: window.matchMedia('(pointer: coarse)').matches,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        webglSupported,
        wideViewport: window.innerWidth >= 1024,
      })
    )
  }, [params])

  // Server render + first client paint: the list (fast, accessible, SEO)
  if (view !== '3d') {
    return (
      <>
        <LabsList />
        {view === 'list' && webgl && (
          <div className="section-container max-w-3xl pb-16">
            <button
              type="button"
              onClick={() => setView('3d')}
              className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium hover:border-primary/50 transition-colors"
            >
              Enter the 3D gallery
            </button>
          </div>
        )}
      </>
    )
  }

  return <MuseumGallery />
}
