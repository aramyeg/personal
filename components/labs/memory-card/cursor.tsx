'use client'

/**
 * GlyphCursor — a fixed, `mix-blend-mode: difference` overlay that follows
 * the pointer as a 6px paper dot (spring stiffness 400, damping 40) and
 * morphs into a stroked 22px glyph, in the hovered element's section accent,
 * whenever the pointer sits over anything carrying `data-cursor`.
 *
 * Accompaniment, not replacement (navigation-clarity law) — the native
 * cursor is never hidden. Entirely absent under `(pointer: coarse)`, reduced
 * motion, or once the pointer leaves the window; the glyph lookup itself is
 * plain event delegation on `window`, so no section needs to know the cursor
 * exists to be seen by it.
 *
 * Hydration-safe by construction: SSR and the first client paint both render
 * nothing (`mounted` starts false, and even once true the dot stays hidden
 * until a real `pointermove` arrives) — no `data-cursor` inspection ever runs
 * outside a browser event.
 */

import { useEffect, useState } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import { GLYPH_PATHS, MC, type GlyphName } from './tokens'

const DOT_SIZE = 6
const GLYPH_SIZE = 22
const SPRING = { stiffness: 400, damping: 40 }

function readGlyph(target: EventTarget | null): GlyphName | null {
  if (!(target instanceof Element)) return null
  const el = target.closest('[data-cursor]')
  const value = el?.getAttribute('data-cursor')
  return value === 'triangle' || value === 'circle' || value === 'cross' || value === 'square'
    ? value
    : null
}

export function GlyphCursor() {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [glyph, setGlyph] = useState<GlyphName | null>(null)
  const reducedMotion = useReducedMotion()

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, SPRING)
  const springY = useSpring(y, SPRING)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted || reducedMotion) return
    if (window.matchMedia('(pointer: coarse)').matches) return

    const onMove = (e: PointerEvent) => {
      x.set(e.clientX)
      y.set(e.clientY)
      setVisible(true)
      setGlyph(readGlyph(e.target))
    }
    const onLeaveWindow = () => setVisible(false)

    window.addEventListener('pointermove', onMove)
    document.documentElement.addEventListener('mouseleave', onLeaveWindow)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeaveWindow)
    }
  }, [mounted, reducedMotion, x, y])

  if (!mounted || reducedMotion || !visible) return null

  const accent = glyph ? MC.glyphs[glyph] : MC.paper

  return (
    <motion.div
      data-testid="glyph-cursor"
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[100]"
      style={{
        x: springX,
        y: springY,
        translateX: '-50%',
        translateY: '-50%',
        mixBlendMode: 'difference',
      }}
    >
      {glyph ? (
        <svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24" fill="none">
          <path
            d={GLYPH_PATHS[glyph]}
            stroke={accent}
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <div
          style={{
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: '50%',
            background: MC.paper,
          }}
        />
      )}
    </motion.div>
  )
}

export default GlyphCursor
