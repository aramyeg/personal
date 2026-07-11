'use client'

/**
 * StackPanel — the "written with" save (slot 05) opened onto the paper panel.
 * The save file's own metadata: the honest short stack that actually wrote THIS
 * page, one numbered row per `WRITTEN_WITH` entry — name in grotesk, the note
 * (each pointing at something real and visible here) in mono. The numbering is
 * real: this is an enumerable manifest, not decoration.
 *
 * Content-only: rendered inside `PanelShell` by the screen. All rows come from
 * `lib/written-with.ts`; nothing is invented here.
 */

import { MC, inkAlpha, withAlpha } from '../tokens'
import { grotesk, monoFamily } from '../fonts'
import { WRITTEN_WITH } from '../lib/written-with'
import type { SaveSlot } from '../save-select/saves'

export type StackPanelProps = { save: SaveSlot }

export function StackPanel({ save }: StackPanelProps) {
  const accent = save.accent
  return (
    <div className="flex flex-col" style={{ ['--mc-ring' as string]: accent }}>
      {/* Header — slot chip + label, title, scope line. */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center uppercase"
            style={{
              fontFamily: monoFamily,
              fontSize: '0.5625rem',
              letterSpacing: '0.2em',
              color: accent,
              border: `1px solid ${withAlpha(accent, 0.5)}`,
              borderRadius: 3,
              padding: '3px 7px',
            }}
          >
            save {save.slot}
          </span>
          <span
            className="lowercase"
            style={{
              fontFamily: monoFamily,
              fontSize: '0.5625rem',
              letterSpacing: '0.24em',
              color: inkAlpha(0.4),
            }}
          >
            written with
          </span>
        </div>

        <h2
          className="uppercase"
          style={{
            fontFamily: grotesk.style.fontFamily,
            fontWeight: 700,
            fontSize: 'clamp(1.6rem, 3.6vw, 2.4rem)',
            lineHeight: 1.02,
            letterSpacing: '0.005em',
            color: MC.ink,
          }}
        >
          written with
        </h2>

        <p
          className="lowercase"
          style={{
            fontFamily: monoFamily,
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
            color: inkAlpha(0.6),
          }}
        >
          {WRITTEN_WITH.length} entries · this page only
        </p>
      </header>

      {/* The manifest — one numbered row per entry. */}
      <ol aria-label="written with" className="mt-6 flex flex-col">
        {WRITTEN_WITH.map((entry, i) => (
          <li
            key={entry.name}
            className="flex items-baseline gap-3 border-t py-3 last:border-b"
            style={{ borderColor: inkAlpha(0.14) }}
          >
            <span
              aria-hidden="true"
              className="shrink-0 tabular-nums"
              style={{
                fontFamily: monoFamily,
                fontSize: '0.6875rem',
                letterSpacing: '0.06em',
                color: accent,
                width: '1.5rem',
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <span
              className="shrink-0"
              style={{
                fontFamily: grotesk.style.fontFamily,
                fontWeight: 600,
                fontSize: '0.9375rem',
                letterSpacing: '0.01em',
                color: MC.ink,
                minWidth: '8rem',
              }}
            >
              {entry.name}
            </span>
            <span
              className="min-w-0 flex-1 lowercase"
              style={{
                fontFamily: monoFamily,
                fontSize: '0.75rem',
                lineHeight: 1.45,
                letterSpacing: '0.01em',
                color: inkAlpha(0.6),
              }}
            >
              {entry.note}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default StackPanel
