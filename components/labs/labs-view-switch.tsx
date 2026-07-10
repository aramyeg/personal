'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { resolveLabsView, type LabsView } from '@/lib/labs-view'
import { LabsList } from '@/components/labs/labs-list'
import { Curtain } from '@/components/labs/museum/curtain'

const MuseumGallery = dynamic(() => import('@/components/labs/museum/museum-gallery'), {
  ssr: false,
  loading: () => null, // the Curtain overlay covers the chunk download
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
  const [load, setLoad] = useState({ progress: 0, ready: false })
  const onLoadChange = useCallback(
    (progress: number, ready: boolean) => setLoad({ progress, ready }),
    []
  )

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
      <LabsList
        enterAction={
          view === 'list' && webgl ? (
            <button type="button" onClick={() => setView('3d')}>
              Enter the 3D gallery
            </button>
          ) : undefined
        }
      />
    )
  }

  return (
    <>
      <MuseumGallery onLoadChange={onLoadChange} />
      <Curtain ready={load.ready} progress={load.progress} />
    </>
  )
}
