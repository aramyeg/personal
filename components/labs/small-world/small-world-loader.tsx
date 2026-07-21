'use client'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { PlanetLoader } from './loader/planet-loader'

/** The 3D bundle loads client-side only; museum/list pay nothing for it. */
const Experience = dynamic(
  () => import('./small-world-experience').then((m) => m.SmallWorldExperience),
  { ssr: false }
)

/** Mirrors SmallWorldExperience's own gate: the themed loader only covers the
 *  paths that will actually mount the 3D scene. Reduced-motion / no-WebGL fall
 *  straight through to the server fallback (unchanged), so no loader flashes
 *  before a page that was never going to render a canvas. */
function willRender3D(): boolean {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * Owns the load handshake between the (lazy) 3D chunk and the (eager) DOM loader.
 * Rendered non-lazily by the page, so the planet loader paints on the FIRST frame
 * (server-rendered too) and covers the chunk download + canvas warm-up — the
 * server fallback never flashes before the 3D scene. The scene's LoadSignal
 * reports progress/ready back up; the loader reveals into the live scene, then
 * unmounts. On the no-WebGL / reduced-motion paths (which never mount a canvas)
 * a mount effect dismisses the loader so the fallback becomes the real UI, and a
 * <noscript> guard hides it entirely when JS is off so crawlers see the fallback.
 */
export function SmallWorldLoader() {
  const [show, setShow] = useState(true)
  const [load, setLoad] = useState({ progress: 0, ready: false })

  const onLoadChange = useCallback(
    (progress: number, ready: boolean) => setLoad({ progress, ready }),
    []
  )

  useEffect(() => {
    if (!willRender3D()) setShow(false)
  }, [])

  return (
    <>
      <noscript>
        <style>{`[data-sw-loader]{display:none!important}`}</style>
      </noscript>
      <Experience onLoadChange={onLoadChange} />
      {show && <PlanetLoader ready={load.ready} progress={load.progress} />}
    </>
  )
}
