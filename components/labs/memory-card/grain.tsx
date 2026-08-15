'use client'

/**
 * Grain — the single full-page grain field (spec §3). A static `feTurbulence`
 * noise layer at low opacity in `overlay` blend, laid over the whole viewport:
 * it kills the gradient banding and the flat-black "cheap" tell the R4 audit
 * called out, without adding any colour of its own.
 *
 * Fixed and `pointer-events:none` so it never intercepts input; z-index sits
 * above the page content but below the system dialogs (paper panels stay clean)
 * and the boot beat. The markup is deterministic — no window/reduced-motion
 * reads — so server and first client paint are byte-identical (hydration law).
 */

import { GRAIN } from './tokens'

const FILTER_ID = 'mc-grain'

export function Grain() {
  return (
    <>
      {/* Zero-box filter def — kept in the DOM so `filter: url(#…)` resolves. */}
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <filter id={FILTER_ID}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency={GRAIN.baseFrequency}
            numOctaves={GRAIN.numOctaves}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[45]"
        style={{
          filter: `url(#${FILTER_ID})`,
          opacity: GRAIN.opacity,
          mixBlendMode: GRAIN.blendMode,
        }}
      />
    </>
  )
}

export default Grain
