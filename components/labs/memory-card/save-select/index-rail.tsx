'use client'

/**
 * IndexRail — the DOM save index that sits beside the spinning card arc. The
 * cards are the visual index but live inside an aria-hidden canvas, so this is
 * the real control: a compact roving-tabindex listbox of the six saves that
 * carries keyboard + assistive-tech users and doubles as the on-screen "which
 * file" readout.
 *
 * Exactly one row is focusable (`tabIndex 0` + `aria-current`); Up/Down and
 * Left/Right move the cursor (wrapping) carrying real DOM focus, Home/End jump
 * to the ends, Enter loads the highlighted save. Emphasis is by brightness and a
 * short accent rule on the active row — never a filled box. Sounds fire from the
 * handlers only (`blip` on move, `select` on load), never from effects.
 */

import { Fragment, useRef, type KeyboardEvent } from 'react'
import { MC, paperAlpha, withAlpha } from '../tokens'
import { grotesk, monoFamily } from '../fonts'
import { useMemoryCardAudioActions } from '../audio-context'
import type { SaveSlot } from './saves'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:-2px]'

/** One short caps word for each system save's rail label (kept tight). */
const SYSTEM_SHORT: Record<string, string> = {
  bio: 'system data',
  stack: 'written with',
  contact: 'save?',
}

function railLabel(save: SaveSlot): string {
  return save.kind === 'project' ? save.label : (SYSTEM_SHORT[save.kind] ?? save.label)
}

type RowProps = {
  save: SaveSlot
  active: boolean
  buttonRef: (el: HTMLButtonElement | null) => void
  onClick: () => void
}

function Row({ save, active, buttonRef, onClick }: RowProps) {
  return (
    <li role="presentation" className="list-none">
      <button
        ref={buttonRef}
        type="button"
        aria-current={active ? 'true' : undefined}
        aria-label={`slot ${save.slot} — ${railLabel(save)}`}
        tabIndex={active ? 0 : -1}
        data-cursor="triangle"
        onClick={onClick}
        className={`group flex w-full items-center gap-3 text-left ${FOCUS_RING}`}
        style={{ minHeight: 44, paddingTop: 6, paddingBottom: 6, paddingRight: 4 }}
      >
        {/* Active cursor tick — the one accent hit per row, in the save's colour. */}
        <span
          aria-hidden="true"
          className="shrink-0"
          style={{
            width: 14,
            fontFamily: monoFamily,
            fontSize: '0.7rem',
            lineHeight: 1,
            color: save.accent,
            opacity: active ? 1 : 0,
            transition: 'opacity 200ms ease',
          }}
        >
          ▸
        </span>

        <span
          aria-hidden="true"
          className="shrink-0 tabular-nums"
          style={{
            fontFamily: monoFamily,
            fontSize: '0.8125rem',
            letterSpacing: '0.08em',
            color: active ? MC.paper : paperAlpha(0.34),
            transition: 'color 220ms ease',
          }}
        >
          {save.slot}
        </span>

        <span
          className="min-w-0 flex-1 truncate uppercase"
          style={{
            fontFamily: grotesk.style.fontFamily,
            fontWeight: 600,
            fontSize: '0.8125rem',
            letterSpacing: '0.04em',
            color: active ? MC.paper : paperAlpha(0.42),
            transition: 'color 220ms ease',
          }}
        >
          {railLabel(save)}
        </span>

        {/* Short active rule — draws in under the active row only. */}
        <span
          aria-hidden="true"
          className="shrink-0"
          style={{
            width: active ? 22 : 0,
            height: 2,
            background: withAlpha(save.accent, 0.9),
            transition: 'width 260ms cubic-bezier(0,0,0.2,1)',
          }}
        />
      </button>
    </li>
  )
}

export type IndexRailProps = {
  saves: SaveSlot[]
  activeIndex: number
  onHighlight: (index: number) => void
  onActivate: (save: SaveSlot) => void
}

export function IndexRail({ saves, activeIndex, onHighlight, onActivate }: IndexRailProps) {
  const audio = useMemoryCardAudioActions()
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  const firstSystemIndex = saves.findIndex((save) => save.kind !== 'project')

  const moveTo = (next: number) => {
    buttonRefs.current[next]?.focus()
    if (next !== activeIndex) {
      audio.blip()
      onHighlight(next)
    }
  }

  const activate = () => {
    audio.select()
    onActivate(saves[activeIndex])
  }

  const onKeyDown = (e: KeyboardEvent<HTMLOListElement>) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault()
        moveTo((activeIndex + 1) % saves.length)
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault()
        moveTo((activeIndex - 1 + saves.length) % saves.length)
        break
      case 'Home':
        e.preventDefault()
        moveTo(0)
        break
      case 'End':
        e.preventDefault()
        moveTo(saves.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        activate()
        break
    }
  }

  const onRowClick = (index: number) => {
    if (index === activeIndex) {
      activate()
      return
    }
    buttonRefs.current[index]?.focus()
    audio.blip()
    onHighlight(index)
  }

  return (
    <ol
      id="save-index"
      aria-label="Save files"
      className="flex w-full flex-col"
      onKeyDown={onKeyDown}
    >
      {saves.map((save, index) => (
        <Fragment key={save.slot}>
          {index === firstSystemIndex && (
            <li
              role="presentation"
              aria-hidden="true"
              className="mb-1 mt-2 list-none select-none"
              style={{
                fontFamily: monoFamily,
                fontSize: '0.5rem',
                letterSpacing: '0.34em',
                color: paperAlpha(0.26),
                borderTop: `1px solid ${paperAlpha(0.12)}`,
                paddingTop: 8,
              }}
            >
              SYSTEM
            </li>
          )}
          <Row
            save={save}
            active={index === activeIndex}
            buttonRef={(el) => {
              buttonRefs.current[index] = el
            }}
            onClick={() => onRowClick(index)}
          />
        </Fragment>
      ))}
    </ol>
  )
}

export default IndexRail
