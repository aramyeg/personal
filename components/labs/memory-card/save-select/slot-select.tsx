'use client'

/**
 * SlotSelect — the right half of the character-select screen: a spec-sheet of
 * six save files, one per slot, replacing the old spinning card fan and its DOM
 * `IndexRail`. Each save is a flat memory-card LABEL row (slot numeral + accent
 * tick, true-cased title, mono sub, block meter); the active row lifts into a
 * raised card that expands to the save's "small text" — a one-line story, tech
 * chips, a spec stat grid, and the LOAD control. There is no second 3D scene.
 *
 * It is still the real keyboard control (the figure hero is aria-hidden), so the
 * exact `IndexRail` contract is preserved verbatim: a roving-tabindex listbox
 * where the active row alone is focusable; Up/Down/Left/Right move the cursor
 * (wrapping) carrying real DOM focus, Home/End jump to the ends, Enter/Space
 * load the active save. A first click highlights a row, a second click on the
 * already-active row loads it (touch two-tap). Sounds fire from the handlers
 * only (`blip` on move, `select` on load), never from effects.
 *
 * Casing law: every save title renders in its true casing — no `uppercase`
 * transform anywhere near a title, so "AMIO Bank iBank" survives intact. Mono
 * labels and meters keep the lab's lowercase/caps voice. Numerals are
 * tabular-nums so the slot counter and meters never jitter.
 */

import { Fragment, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useAnimate, stagger } from 'framer-motion'
import { MC, INK, MOTION, HAIRLINE, HAIRLINE_DIM, paperAlpha, withAlpha } from '../tokens'
import { grotesk, monoFamily } from '../fonts'
import { useMemoryCardAudioActions } from '../audio-context'
import { parseMetric, formatMetricValue } from './metric'
import { WRITTEN_WITH } from '../lib/written-with'
import { siteConfig, socialLinks } from '@/lib/constants'
import { saveTitle, type SaveSlot } from './saves'

/** Teal system accent owns focus (spec §3 accent discipline). */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:-2px]'

/** Right-aligned kind tag on a resting system row (mono caps, spec-sheet voice). */
const SYSTEM_TAG: Record<string, string> = { bio: 'bio', stack: 'stack', contact: 'contact' }

/** Segments a project's block meter can show before it saturates. */
const METER_SEGS = 5

/** Project row sub-line: `category · yearRange`, mono lowercase (en-dashed). */
function rowSub(save: SaveSlot): string {
  if (save.kind !== 'project' || !save.project) return save.sub
  const years = save.project.year.toLowerCase().replace(/-/g, '–')
  return `${save.project.category} · ${years}`
}

// ---- shared row atoms -----------------------------------------------------

function BlockMeter({ blocks, accent }: { blocks: number; accent: string }) {
  const on = Math.min(blocks, METER_SEGS)
  return (
    <span className="flex items-center gap-2" aria-hidden="true">
      <span className="flex gap-[2px]">
        {Array.from({ length: METER_SEGS }, (_, i) => (
          <span
            key={i}
            style={{
              width: 9,
              height: 5,
              borderRadius: 0.5,
              background: i < on ? accent : paperAlpha(0.16),
            }}
          />
        ))}
      </span>
      <span
        className="tabular-nums"
        style={{ fontFamily: monoFamily, fontSize: '0.625rem', color: paperAlpha(0.42) }}
      >
        {blocks} blk
      </span>
    </span>
  )
}

function SystemTag({ kind }: { kind: string }) {
  return (
    <span
      aria-hidden="true"
      className="uppercase"
      style={{
        fontFamily: monoFamily,
        fontSize: '0.5625rem',
        letterSpacing: '0.14em',
        color: paperAlpha(0.34),
      }}
    >
      {SYSTEM_TAG[kind] ?? 'data'}
    </span>
  )
}

/** A labelled spec tile over an accent top-rule (variant-A stat grid). */
function StatTile({ metric, accent }: { metric: string; accent: string }) {
  const parsed = parseMetric(metric)
  const isNumeric = parsed.value !== null
  return (
    <div data-reveal style={{ borderTop: `1px solid ${withAlpha(accent, 0.85)}`, paddingTop: 8 }}>
      {isNumeric ? (
        <>
          <div
            className="tabular-nums"
            style={{
              fontFamily: grotesk.style.fontFamily,
              fontWeight: 600,
              fontSize: '1.05rem',
              lineHeight: 1,
              letterSpacing: '-0.01em',
              color: MC.paper,
            }}
          >
            {formatMetricValue(parsed.value!, parsed.decimals)}
            {parsed.suffix}
          </div>
          <div
            className="mt-1 lowercase"
            style={{
              fontFamily: monoFamily,
              fontSize: '0.625rem',
              letterSpacing: '0.08em',
              color: paperAlpha(0.5),
            }}
          >
            {parsed.label}
          </div>
        </>
      ) : (
        <div
          style={{
            fontFamily: grotesk.style.fontFamily,
            fontWeight: 500,
            fontSize: '0.8125rem',
            lineHeight: 1.25,
            color: paperAlpha(0.86),
          }}
        >
          {parsed.raw}
        </div>
      )}
    </div>
  )
}

function Chips({ items }: { items: string[] }) {
  return (
    <div data-reveal className="flex flex-wrap gap-[6px]">
      {items.map((item) => (
        <span
          key={item}
          className="lowercase"
          style={{
            fontFamily: monoFamily,
            fontSize: '0.625rem',
            letterSpacing: '0.06em',
            color: paperAlpha(0.7),
            border: `1px solid ${HAIRLINE}`,
            borderRadius: 2,
            padding: '4px 8px',
          }}
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function Story({ children }: { children: ReactNode }) {
  return (
    <p
      data-reveal
      style={{
        fontFamily: grotesk.style.fontFamily,
        fontSize: '0.875rem',
        lineHeight: 1.55,
        color: paperAlpha(0.74),
        maxWidth: '54ch',
      }}
    >
      {children}
    </p>
  )
}

/** The one shared LOAD control — loads the active save (routes a project to its
 *  panel, opens a system dialog). A plain button so keyboard users can reach it,
 *  but it carries NO literal `tabindex` so it never joins the roving cursor. */
function LoadRow({ save, onLoad }: { save: SaveSlot; onLoad: () => void }) {
  return (
    <div
      data-reveal
      className="flex flex-wrap items-center gap-4"
      style={{ paddingTop: 14, borderTop: `1px solid ${HAIRLINE_DIM}` }}
    >
      <button
        type="button"
        data-cursor="triangle"
        onClick={onLoad}
        aria-label={`load slot ${save.slot} — ${saveTitle(save)}`}
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-[2px] px-4 uppercase transition-transform hover:-translate-y-px ${FOCUS_RING}`}
        style={{
          fontFamily: monoFamily,
          fontSize: '0.6875rem',
          letterSpacing: '0.14em',
          fontWeight: 500,
          color: INK[900],
          background: save.accent,
        }}
      >
        <span aria-hidden="true">▸</span>
        load slot {save.slot}
      </button>
      <span
        className="hidden lowercase sm:inline"
        style={{
          fontFamily: monoFamily,
          fontSize: '0.65rem',
          letterSpacing: '0.1em',
          color: paperAlpha(0.4),
        }}
      >
        press enter to load
      </span>
    </div>
  )
}

// ---- per-kind expanded bodies (folds the old StoryBand content) -----------

function ProjectDetail({ save }: { save: SaveSlot }) {
  const project = save.project!
  const metrics = (project.metrics ?? []).slice(0, 3)
  return (
    <>
      <Story>{project.longDescription}</Story>
      <Chips items={project.technologies.map((t) => t.toLowerCase())} />
      <div data-reveal className="grid grid-cols-3 gap-x-5 gap-y-3">
        {metrics.map((metric) => (
          <StatTile key={metric} metric={metric} accent={save.accent} />
        ))}
      </div>
    </>
  )
}

function BioDetail({ save }: { save: SaveSlot }) {
  return (
    <>
      <Story>{siteConfig.description}</Story>
      <div data-reveal className="grid grid-cols-2 gap-x-5 gap-y-3">
        <div style={{ borderTop: `1px solid ${withAlpha(save.accent, 0.85)}`, paddingTop: 8 }}>
          <div style={{ fontFamily: grotesk.style.fontFamily, fontWeight: 500, fontSize: '0.8125rem', color: paperAlpha(0.86) }}>
            {siteConfig.title}
          </div>
          <div className="mt-1 lowercase" style={{ fontFamily: monoFamily, fontSize: '0.625rem', letterSpacing: '0.08em', color: paperAlpha(0.5) }}>
            role
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${withAlpha(save.accent, 0.85)}`, paddingTop: 8 }}>
          <div style={{ fontFamily: grotesk.style.fontFamily, fontWeight: 500, fontSize: '0.8125rem', color: paperAlpha(0.86) }}>
            {siteConfig.location}
          </div>
          <div className="mt-1 lowercase" style={{ fontFamily: monoFamily, fontSize: '0.625rem', letterSpacing: '0.08em', color: paperAlpha(0.5) }}>
            based
          </div>
        </div>
      </div>
    </>
  )
}

function StackDetail({ save }: { save: SaveSlot }) {
  return (
    <>
      <Story>Every library and tool this page itself is written with — the stack behind the lab you are reading.</Story>
      <Chips items={WRITTEN_WITH.map((entry) => entry.name.toLowerCase())} />
      <p
        data-reveal
        className="lowercase"
        style={{ fontFamily: monoFamily, fontSize: '0.65rem', letterSpacing: '0.06em', color: paperAlpha(0.42) }}
      >
        {save.sub}
      </p>
    </>
  )
}

function ContactDetail() {
  const channels = ['email', ...socialLinks.map((link) => link.name.toLowerCase())]
  return (
    <>
      <Story>Save your progress — the ways to reach me, one prompt away.</Story>
      <Chips items={channels} />
      <p
        data-reveal
        className="lowercase"
        style={{ fontFamily: monoFamily, fontSize: '0.65rem', letterSpacing: '0.06em', color: paperAlpha(0.42) }}
      >
        {siteConfig.email}
      </p>
    </>
  )
}

function ActiveDetail({ save, onLoad }: { save: SaveSlot; onLoad: () => void }) {
  return (
    <div className="flex flex-col gap-4" style={{ paddingLeft: 52, paddingTop: 12, paddingBottom: 14 }}>
      {save.kind === 'project' && <ProjectDetail save={save} />}
      {save.kind === 'bio' && <BioDetail save={save} />}
      {save.kind === 'stack' && <StackDetail save={save} />}
      {save.kind === 'contact' && <ContactDetail />}
      <LoadRow save={save} onLoad={onLoad} />
    </div>
  )
}

// ---- the row + list -------------------------------------------------------

type RowProps = {
  save: SaveSlot
  index: number
  active: boolean
  first: boolean
  buttonRef: (el: HTMLButtonElement | null) => void
  onClick: () => void
  onLoad: () => void
}

function Row({ save, active, first, buttonRef, onClick, onLoad }: RowProps) {
  const title = saveTitle(save)
  const isProject = save.kind === 'project'
  return (
    <li
      className="list-none"
      style={{
        borderTop: first || active ? 'none' : `1px solid ${HAIRLINE_DIM}`,
        borderRadius: active ? 2 : 0,
        background: active ? INK[700] : 'transparent',
        boxShadow: active ? `inset 3px 0 0 ${save.accent}` : 'none',
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-current={active ? 'true' : undefined}
        aria-label={`slot ${save.slot} — ${title}`}
        tabIndex={active ? 0 : -1}
        data-cursor="triangle"
        onClick={onClick}
        className={`grid w-full items-center gap-4 text-left ${FOCUS_RING}`}
        style={{
          gridTemplateColumns: '36px 1fr auto',
          minHeight: 46,
          padding: active ? '13px 8px 8px 12px' : '11px 8px 11px 12px',
        }}
      >
        {/* slot numeral + accent tick (the row's own owned colour) */}
        <span className="flex items-center" style={{ fontFamily: monoFamily, fontSize: '0.6875rem', fontWeight: 500 }}>
          <span
            aria-hidden="true"
            style={{ width: 3, height: 15, borderRadius: 1, background: save.accent, opacity: 0.85, marginRight: 9 }}
          />
          <span className="tabular-nums" style={{ color: active ? save.accent : paperAlpha(0.6) }}>
            {save.slot}
          </span>
        </span>

        <span className="min-w-0">
          <span
            className="block truncate"
            style={{
              fontFamily: grotesk.style.fontFamily,
              fontWeight: active ? 600 : 500,
              fontSize: '1.0625rem',
              letterSpacing: '-0.005em',
              color: active ? MC.paper : paperAlpha(0.8),
            }}
          >
            {title}
          </span>
          <span
            className="mt-[3px] block truncate lowercase"
            style={{
              fontFamily: monoFamily,
              fontSize: '0.625rem',
              letterSpacing: '0.09em',
              color: paperAlpha(0.4),
            }}
          >
            {rowSub(save)}
          </span>
        </span>

        {isProject ? <BlockMeter blocks={save.blocks} accent={save.accent} /> : <SystemTag kind={save.kind} />}
      </button>

      {active && <ActiveDetail save={save} onLoad={onLoad} />}
    </li>
  )
}

export type SlotSelectProps = {
  saves: SaveSlot[]
  activeIndex: number
  reduced?: boolean
  onHighlight: (index: number) => void
  onActivate: (save: SaveSlot) => void
}

export function SlotSelect({
  saves,
  activeIndex,
  reduced = false,
  onHighlight,
  onActivate,
}: SlotSelectProps) {
  const audio = useMemoryCardAudioActions()
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [scope, animate] = useAnimate()
  const firstReveal = useRef(true)

  const firstSystemIndex = saves.findIndex((save) => save.kind !== 'project')
  const activeSave = saves[activeIndex]

  // Signature select reveal — the newly-expanded card's parts cascade in on each
  // selection change. Client-only (skips the first paint so SSR and hydration
  // stay byte-identical) and skipped entirely under reduced motion (content just
  // swaps). Shares the spec's entrance ease + timing.
  useEffect(() => {
    if (firstReveal.current) {
      firstReveal.current = false
      return
    }
    if (reduced) return
    animate(
      '[data-reveal]',
      { opacity: [0, 1], y: [MOTION.rise, 0] },
      { duration: MOTION.select, delay: stagger(MOTION.stagger), ease: MOTION.easeEntranceArr }
    )
  }, [activeIndex, reduced, animate])

  const moveTo = (next: number) => {
    buttonRefs.current[next]?.focus()
    if (next !== activeIndex) {
      audio.blip()
      onHighlight(next)
    }
  }

  const activate = () => {
    // Every save loads something on activation — projects route to their panel,
    // system saves open their dialog — so select() fires for all kinds.
    audio.select()
    onActivate(saves[activeIndex])
  }

  const onKeyDown = (e: KeyboardEvent<HTMLOListElement>) => {
    // Enter/Space call preventDefault, which suppresses the focused control's
    // native click — so navigating from a row (or loading from the LOAD button,
    // both inside the list) resolves to a single activate(), never a double.
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
    <div ref={scope} className="flex w-full flex-col">
      {/* spec-sheet header — SELECT SAVE / FILE nn / total */}
      <div
        className="flex items-baseline justify-between uppercase"
        style={{
          fontFamily: monoFamily,
          fontSize: '0.6875rem',
          letterSpacing: '0.2em',
          color: paperAlpha(0.6),
          marginBottom: 6,
        }}
      >
        <span>select save</span>
        <span className="tabular-nums" style={{ color: MC.glyphs.triangle }}>
          file {activeSave.slot} / {String(saves.length).padStart(2, '0')}
        </span>
      </div>
      <div style={{ height: 1, background: HAIRLINE, marginBottom: 2 }} />

      <ol id="save-index" aria-label="Save files" className="flex flex-col" onKeyDown={onKeyDown}>
        {saves.map((save, index) => (
          <Fragment key={save.slot}>
            {index === firstSystemIndex && (
              <li
                role="presentation"
                aria-hidden="true"
                className="list-none select-none uppercase"
                style={{
                  fontFamily: monoFamily,
                  fontSize: '0.5625rem',
                  letterSpacing: '0.34em',
                  color: paperAlpha(0.32),
                  borderTop: `1px solid ${HAIRLINE_DIM}`,
                  padding: '12px 2px 6px',
                }}
              >
                system
              </li>
            )}
            <Row
              save={save}
              index={index}
              active={index === activeIndex}
              first={index === 0}
              buttonRef={(el) => {
                buttonRefs.current[index] = el
              }}
              onClick={() => onRowClick(index)}
              onLoad={activate}
            />
          </Fragment>
        ))}
      </ol>
    </div>
  )
}

export default SlotSelect
