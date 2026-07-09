'use client'

import './storybook.css'
import '@fontsource-variable/grenze-gotisch'
import '@fontsource-variable/alegreya'
import '@fontsource/alegreya-sc/400.css'
import '@fontsource/alegreya-sc/700.css'

/** Client entry for the lab; Task 10 swaps the placeholder for the book. */
export function StorybookLoader() {
  return (
    <div className="sb-root fixed inset-0 overflow-hidden">
      <div className="grid h-full place-items-center">
        <p className="sb-chapter-title" style={{ color: 'var(--sb-paper)' }}>
          A Tale of Six Kingdoms
        </p>
      </div>
      <div className="sb-vignette" />
    </div>
  )
}
