'use client'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { girlGlbHandoff } from './loader/glb-handoff'
import { PlanetLoader } from './loader/planet-loader'
import { GIRL_GLB_BYTES, GIRL_URL } from './scene/girl-url'

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
 * Rendered non-lazily by the page, so the loader plate paints on the FIRST frame
 * (server-rendered too) and covers the chunk download + canvas warm-up — the
 * server fallback never flashes before the 3D scene.
 *
 * The loader's arc is HONEST bytes: this component stream-prefetches the girl
 * GLB (the dominant asset) and reports the byte fraction; the Experience mount
 * is gated on that prefetch settling, so the GLB is fetched exactly once — the
 * scene's own request then revalidates out of the HTTP cache. If the stream
 * can't be measured (no content-length, fetch error), the LoadSignal's chunk
 * progress remains the fallback and the loader's failsafe reveal covers us.
 *
 * On the no-WebGL / reduced-motion paths (which never mount a canvas) a mount
 * effect dismisses the loader so the fallback becomes the real UI, and a
 * <noscript> guard hides it entirely when JS is off so crawlers see the fallback.
 */
export function SmallWorldLoader() {
  const [show, setShow] = useState(true)
  const [load, setLoad] = useState({ progress: 0, ready: false })
  const [bytePct, setBytePct] = useState<number | null>(null)
  const [prefetched, setPrefetched] = useState(false)

  const onLoadChange = useCallback(
    (progress: number, ready: boolean) => setLoad({ progress, ready }),
    []
  )

  useEffect(() => {
    if (!willRender3D()) {
      // Fallback path: no canvas will ever mount — dismiss the loader and let
      // the Experience mount immediately (it renders nothing 3D on this path).
      setShow(false)
      setPrefetched(true)
      return
    }
    const controller = new AbortController()
    let cancelled = false
    const prefetch = async () => {
      try {
        const res = await fetch(GIRL_URL, { signal: controller.signal })
        const body = res.body
        if (!res.ok || !body) return
        // The production server gzips the GLB as a chunked stream, so the
        // browser response usually has NO content-length — fall back to the
        // build-pinned file size (girl-url.test.ts keeps it truthful). The
        // reader yields decompressed bytes, so the file size is the right
        // total in both the compressed and identity cases.
        const headerTotal = Number(res.headers.get('content-length'))
        const total =
          Number.isFinite(headerTotal) && headerTotal > 0 ? headerTotal : GIRL_GLB_BYTES
        const measurable = total > 0
        const reader = body.getReader()
        // Throttle: only surface a new fraction every ~2% or ≥60ms.
        const chunks: Uint8Array[] = []
        let received = 0
        let sentPct = 0
        let sentAt = 0
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          received += value.byteLength
          if (!measurable || cancelled) continue
          const pct = Math.min(100, (received / total) * 100)
          const now = Date.now()
          if (pct - sentPct < 2 && now - sentAt < 60) continue
          sentPct = pct
          sentAt = now
          setBytePct(pct)
        }
        // Assemble the bytes and park them for the scene chunk — this, not the
        // HTTP cache, is what guarantees the GLB crosses the wire exactly once
        // (see glb-handoff.ts for the measurement that forced it).
        if (received > 0 && !cancelled) {
          const assembled = new Uint8Array(received)
          let offset = 0
          for (const chunk of chunks) {
            assembled.set(chunk, offset)
            offset += chunk.byteLength
          }
          girlGlbHandoff.buffer = assembled.buffer
        }
        if (measurable && !cancelled) setBytePct(100)
      } catch {
        // Swallowed on purpose: a failed prefetch only means the loader's
        // failsafe reveal (SW_LOADER_MAX_WAIT_MS) covers us.
      } finally {
        if (!cancelled) setPrefetched(true)
      }
    }
    void prefetch()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  return (
    <>
      <noscript>
        <style>{`[data-sw-loader]{display:none!important}`}</style>
      </noscript>
      {prefetched && <Experience onLoadChange={onLoadChange} />}
      {show && <PlanetLoader ready={load.ready} progress={bytePct ?? load.progress} />}
    </>
  )
}
