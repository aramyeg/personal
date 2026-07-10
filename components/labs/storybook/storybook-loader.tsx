'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import './storybook.css'
import './storybook-overlay.css'
import './storybook-responsive.css'
import '@fontsource-variable/grenze-gotisch'
import '@fontsource-variable/alegreya'
import '@fontsource/alegreya-sc/400.css'
import '@fontsource/alegreya-sc/700.css'
import { PlainTale } from './plain-tale'
import { resolveSbView, type SbView } from './resolve-view'
import { useStorybookStore } from './store'
import { useBookInput } from './use-book-input'
import { BookNav } from './overlay/nav'
import { QuillCursor } from './overlay/quill-cursor'
import { SoundToggle } from './overlay/sound-toggle'
import { SpreadOverlay } from './overlay/spread-overlay'

// three.js only ever reaches the browser: ssr is off and nothing outside
// book-scene.tsx (and its book/ neighbors) may import it, so the route's
// server-rendered chunk stays free of the WebGL bundle.
const BookScene = dynamic(() => import('./book/book-scene'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      <p className="sb-chapter-kicker" style={{ color: 'var(--sb-paper)' }}>
        Opening the book…
      </p>
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

/** First-client-paint state, before the view (book vs. plain) resolves —
 *  same desk backdrop as the book so there's no flash of unstyled content. */
function VellumLoading() {
  return (
    <div className="sb-root fixed inset-0 grid place-items-center">
      <p className="sb-chapter-kicker" style={{ color: 'var(--sb-paper)' }}>
        Unrolling the vellum…
      </p>
    </div>
  )
}

/** The WebGL book: canvas, pop-up overlay text, nav, cursor and sound chrome. */
function BookTale() {
  const spread = useStorybookStore((s) => s.spread)
  const turning = useStorybookStore((s) => s.turning)
  const requestTurn = useStorybookStore((s) => s.requestTurn)

  useBookInput(true)

  return (
    <div className="sb-root fixed inset-0 overflow-hidden">
      <div className="sb-canvas-wrap">
        <BookScene />
        {spread === 0 && !turning && (
          <button
            type="button"
            onClick={() => requestTurn('next')}
            data-sb-hover
            className="sb-chapter-kicker absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full border border-[var(--sb-gold)] bg-black/30 px-6 py-2.5 backdrop-blur-sm transition-colors hover:bg-[var(--sb-gold)]/15"
          >
            Open the book
          </button>
        )}
        <div className="sb-vignette" />
      </div>
      <SpreadOverlay />
      <BookNav />
      <QuillCursor />
      <SoundToggle />
    </div>
  )
}

/** Client entry for the lab: resolves book vs. plain (Task 4's `resolveSbView`)
 *  from the `?view` param, WebGL support, and `prefers-reduced-motion`, then
 *  mounts the matching experience. Mirrors `labs-view-switch.tsx`'s pattern. */
export function StorybookLoader() {
  const params = useSearchParams()
  const [view, setView] = useState<SbView | null>(null)

  useEffect(() => {
    setView(
      resolveSbView({
        param: params.get('view'),
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        webglSupported: detectWebGL(),
      })
    )
  }, [params])

  // Server render + first client paint: a themed loading state (fast, no
  // flash of the wrong view) until capabilities are known.
  if (view === null) return <VellumLoading />
  if (view === 'plain') return <PlainTale />
  return <BookTale />
}
