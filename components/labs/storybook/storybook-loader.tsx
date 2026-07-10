'use client'

import dynamic from 'next/dynamic'
import './storybook.css'
import '@fontsource-variable/grenze-gotisch'
import '@fontsource-variable/alegreya'
import '@fontsource/alegreya-sc/400.css'
import '@fontsource/alegreya-sc/700.css'
import { useStorybookStore } from './store'
import { useBookInput } from './use-book-input'
import { BookNav } from './overlay/nav'

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

/** Client entry for the lab: the WebGL stage plus the chrome that sits above it. */
export function StorybookLoader() {
  const spread = useStorybookStore((s) => s.spread)
  const turning = useStorybookStore((s) => s.turning)
  const requestTurn = useStorybookStore((s) => s.requestTurn)

  // Book view is the only view this loader ever mounts (there's no plain-
  // view branch here yet), so input is always on.
  useBookInput(true)

  return (
    <div className="sb-root fixed inset-0 overflow-hidden">
      <BookScene />
      {spread === 0 && !turning && (
        <button
          type="button"
          onClick={() => requestTurn('next')}
          className="sb-chapter-kicker absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full border border-[var(--sb-gold)] bg-black/30 px-6 py-2.5 backdrop-blur-sm transition-colors hover:bg-[var(--sb-gold)]/15"
        >
          Open the book
        </button>
      )}
      <BookNav />
      <div className="sb-vignette" />
    </div>
  )
}
