'use client'

/**
 * SaveStrips — the save index, rendered as editorial typography rather than a
 * tile grid. Each save is one designed data row: a ghost slot numeral (display
 * weight, held far back), a deterministic shimmer icon, the title in Space
 * Grotesk caps, and a dense mono stat sub-line with the slot's ▮ block meter.
 * Project saves (01–03) lead the hierarchy; the three system slots (04–06) sit
 * in a quieter, compact group beneath a hairline divider.
 *
 * It is a roving-tabindex listbox-of-buttons: exactly one strip is focusable
 * (`tabIndex 0` + `aria-current`), Up/Down move the cursor (wrapping) and carry
 * real DOM focus with them, Enter loads the highlighted save. Emphasis is by
 * weight and brightness — a teal edge rule and a brightened numeral on the
 * active strip — never a highlight box. Sounds fire from the event handlers
 * only (`blip` on every cursor move, `select` on load), never from effects.
 */

import { Fragment, useEffect, useRef, type KeyboardEvent } from 'react'
import { MC, paperAlpha } from '../tokens'
import { grotesk, monoFamily } from '../fonts'
import { useMemoryCardAudioActions } from '../audio-context'
import { makeSaveIconFrames, ICON_FRAMES } from '../lib/save-icon'
import type { SaveSlot } from './saves'

const CURSOR = MC.glyphs.triangle
const ICON_INTERVAL_MS = 480

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:-2px]'

/** Paint one icon frame into the visible strip canvas; a no-op when the 2D
 *  context is unavailable (jsdom) or the frames never built. */
function paintIcon(
  canvas: HTMLCanvasElement,
  frames: HTMLCanvasElement[] | null,
  index: number
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const src = frames?.[index]
  if (!src) return
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height)
}

/**
 * The shimmer save-icon on a small paper chip — the authentic PS1 save-icon
 * cell. Frames are built once per identity (browser-only; guarded so jsdom's
 * context-less canvas never throws); the 3-frame flicker runs ONLY while this
 * strip is active and motion is allowed, otherwise it holds on frame 0.
 */
function StripIcon({
  seed,
  accent,
  active,
  reduced,
  size,
}: {
  seed: string
  accent: string
  active: boolean
  reduced: boolean
  size: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const framesRef = useRef<HTMLCanvasElement[] | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let frames: HTMLCanvasElement[] | null = null
    try {
      frames = makeSaveIconFrames(seed, accent)
    } catch {
      frames = null
    }
    framesRef.current = frames
    paintIcon(canvas, frames, 0)
    return () => {
      framesRef.current = null
    }
  }, [seed, accent])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!active || reduced) {
      paintIcon(canvas, framesRef.current, 0)
      return
    }
    let frame = 0
    const id = window.setInterval(() => {
      frame = (frame + 1) % ICON_FRAMES
      paintIcon(canvas, framesRef.current, frame)
    }, ICON_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [active, reduced])

  return (
    <span
      aria-hidden="true"
      className="shrink-0 rounded-[2px]"
      style={{
        width: size,
        height: size,
        background: paperAlpha(active ? 0.92 : 0.82),
        boxShadow: `inset 0 0 0 1px ${paperAlpha(active ? 0.28 : 0.14)}`,
        transition: 'background 200ms ease, box-shadow 200ms ease',
      }}
    >
      <canvas
        ref={canvasRef}
        width={64}
        height={64}
        style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
      />
    </span>
  )
}

type StripProps = {
  save: SaveSlot
  index: number
  active: boolean
  compact: boolean
  reduced: boolean
  buttonRef: (el: HTMLButtonElement | null) => void
  onClick: () => void
}

function Strip({ save, active, compact, reduced, buttonRef, onClick }: StripProps) {
  const numeralSize = compact
    ? 'clamp(1.35rem, 2.6vw, 1.9rem)'
    : 'clamp(2rem, 4.4vw, 3.15rem)'
  const iconSize = compact ? 26 : 38

  return (
    <li role="presentation" className="list-none">
      <button
        ref={buttonRef}
        type="button"
        aria-current={active ? 'true' : undefined}
        aria-label={`slot ${save.slot} — ${save.label}`}
        tabIndex={active ? 0 : -1}
        data-cursor="triangle"
        onClick={onClick}
        className={`flex w-full items-center gap-4 text-left sm:gap-5 ${FOCUS_RING}`}
        style={{
          minHeight: 44,
          paddingTop: compact ? 10 : 14,
          paddingBottom: compact ? 10 : 14,
          paddingLeft: 14,
          paddingRight: 8,
          borderLeft: `2px solid ${active ? CURSOR : 'transparent'}`,
          borderBottom: `1px solid ${paperAlpha(0.16)}`,
          transition: 'border-color 220ms ease',
        }}
      >
        <span
          aria-hidden="true"
          className="shrink-0 tabular-nums"
          style={{
            fontFamily: grotesk.style.fontFamily,
            fontWeight: 700,
            fontSize: numeralSize,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            width: compact ? '2.2ch' : '2.6ch',
            color: paperAlpha(active ? 0.8 : 0.24),
            transition: 'color 220ms ease',
          }}
        >
          {save.slot}
        </span>

        <StripIcon
          seed={save.project?.id ?? save.kind}
          accent={save.accent}
          active={active}
          reduced={reduced}
          size={iconSize}
        />

        <span className="flex min-w-0 flex-col gap-1">
          <span
            className="truncate uppercase"
            style={{
              fontFamily: grotesk.style.fontFamily,
              fontWeight: 700,
              fontSize: compact ? 'clamp(0.9rem, 1.6vw, 1.05rem)' : 'clamp(1.05rem, 2vw, 1.35rem)',
              letterSpacing: '0.01em',
              lineHeight: 1.05,
              color: active ? MC.paper : paperAlpha(compact ? 0.58 : 0.74),
              transition: 'color 220ms ease',
            }}
          >
            {save.label}
          </span>

          <span
            className="flex min-w-0 items-center gap-2 truncate"
            style={{
              fontFamily: monoFamily,
              fontSize: compact ? '0.625rem' : '0.6875rem',
              letterSpacing: '0.06em',
              color: paperAlpha(active ? 0.55 : 0.4),
              transition: 'color 220ms ease',
            }}
          >
            <span className="truncate lowercase">{save.sub}</span>
            {save.blocks > 0 && (
              <span
                aria-hidden="true"
                className="shrink-0 tracking-[-0.05em]"
                style={{ color: save.accent, opacity: active ? 1 : 0.5 }}
              >
                {'▮'.repeat(save.blocks)}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  )
}

export type SaveStripsProps = {
  saves: SaveSlot[]
  activeIndex: number
  onHighlight: (index: number) => void
  onActivate: (save: SaveSlot) => void
  reduced?: boolean
}

export function SaveStrips({
  saves,
  activeIndex,
  onHighlight,
  onActivate,
  reduced = false,
}: SaveStripsProps) {
  const audio = useMemoryCardAudioActions()
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  // The compact group starts at the first non-project slot.
  const firstSystemIndex = saves.findIndex((save) => save.kind !== 'project')

  const moveTo = (next: number) => {
    if (next === activeIndex) {
      buttonRefs.current[next]?.focus()
      return
    }
    buttonRefs.current[next]?.focus()
    audio.blip()
    onHighlight(next)
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
        e.preventDefault()
        activate()
        break
    }
  }

  const onStripClick = (index: number) => {
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
      id="save-strips"
      aria-label="Save files"
      className="w-full"
      style={{ borderTop: `1px solid ${paperAlpha(0.16)}` }}
      onKeyDown={onKeyDown}
    >
      {saves.map((save, index) => (
        <Fragment key={save.slot}>
          {index === firstSystemIndex && (
            <li
              role="presentation"
              aria-hidden="true"
              className="list-none select-none px-1 pb-1.5 pt-4"
              style={{
                fontFamily: monoFamily,
                fontSize: '0.5625rem',
                letterSpacing: '0.3em',
                color: paperAlpha(0.3),
              }}
            >
              system
            </li>
          )}
          <Strip
            save={save}
            index={index}
            active={index === activeIndex}
            compact={save.kind !== 'project'}
            reduced={reduced}
            buttonRef={(el) => {
              buttonRefs.current[index] = el
            }}
            onClick={() => onStripClick(index)}
          />
        </Fragment>
      ))}
    </ol>
  )
}

export default SaveStrips
