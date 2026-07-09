'use client'

import dynamic from 'next/dynamic'
import './storybook.css'
import '@fontsource-variable/grenze-gotisch'
import '@fontsource-variable/alegreya'
import '@fontsource/alegreya-sc/400.css'
import '@fontsource/alegreya-sc/700.css'
import { useStorybookStore } from './store'

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
  const requestTurn = useStorybookStore((s) => s.requestTurn)
  const completeTurn = useStorybookStore((s) => s.completeTurn)

  const openBook = () => {
    requestTurn('next')
    // TODO(task-10): remove snap. Task 10 adds the turn driver that calls
    // completeTurn() once the cover animation finishes; until then, snap
    // straight to the open spread so it's reachable and visually verifiable.
    completeTurn()
  }

  return (
    <div className="sb-root fixed inset-0 overflow-hidden">
      <BookScene />
      {spread === 0 && (
        <button
          type="button"
          onClick={openBook}
          className="sb-chapter-kicker absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full border border-[var(--sb-gold)] bg-black/30 px-6 py-2.5 backdrop-blur-sm transition-colors hover:bg-[var(--sb-gold)]/15"
        >
          Open the book
        </button>
      )}
      <div className="sb-vignette" />
    </div>
  )
}
