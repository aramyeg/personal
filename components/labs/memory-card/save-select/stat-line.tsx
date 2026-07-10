'use client'

/**
 * StatLine — the console footer for the highlighted save: the LOAD affordance
 * (also fired by Enter on a strip) plus the memory card's hardware truth, its
 * 9-of-15 block meter, kept as a mono detail rather than turned into the page's
 * layout. The accent lands once here, on the LOAD tick, in the active save's
 * own colour; the block meter stays in paper so the region reads as one accent.
 */

import { MC, paperAlpha } from '../tokens'
import { monoFamily } from '../fonts'
import { useMemoryCardAudioActions } from '../audio-context'
import type { SaveSlot } from './saves'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:3px]'

export type StatLineProps = {
  save: SaveSlot
  used: number
  total: number
  onLoad: (save: SaveSlot) => void
}

export function StatLine({ save, used, total, onLoad }: StatLineProps) {
  const audio = useMemoryCardAudioActions()
  const free = Math.max(0, total - used)

  const onClick = () => {
    audio.select()
    onLoad(save)
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-4"
      style={{ borderTop: `1px solid ${paperAlpha(0.16)}` }}
    >
      <button
        type="button"
        data-cursor="triangle"
        onClick={onClick}
        aria-label={`load slot ${save.slot} — ${save.label}`}
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-md border px-4 uppercase transition-colors hover:border-[color:var(--mc-ring)] ${FOCUS_RING}`}
        style={{
          fontFamily: monoFamily,
          fontSize: '0.75rem',
          letterSpacing: '0.14em',
          color: MC.paper,
          borderColor: paperAlpha(0.24),
        }}
      >
        <span aria-hidden="true" style={{ color: save.accent }}>
          ▸
        </span>
        load slot {save.slot}
      </button>

      <span
        className="lowercase"
        style={{
          fontFamily: monoFamily,
          fontSize: '0.6875rem',
          letterSpacing: '0.12em',
          color: paperAlpha(0.5),
        }}
      >
        blocks {used}/{total} used
      </span>

      <span
        aria-hidden="true"
        className="tracking-[-0.05em]"
        style={{ fontFamily: monoFamily, fontSize: '0.75rem' }}
      >
        <span style={{ color: paperAlpha(0.7) }}>{'▮'.repeat(used)}</span>
        <span style={{ color: paperAlpha(0.22) }}>{'▯'.repeat(free)}</span>
      </span>
    </div>
  )
}

export default StatLine
