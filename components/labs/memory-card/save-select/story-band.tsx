'use client'

/**
 * StoryBand — the full-width band under the character-select stage that tells
 * the highlighted save's story in editorial type. It leads with a huge ghost
 * numeral in Anton (the lab's one display moment), sets the title in grotesk
 * caps and the role/company + data in mono, and turns each project metric into
 * an animated counter (numeric metrics) or a growing bar (text metrics). System
 * saves show their own content — the bio line, the written-with log, or the
 * contact rows — in the same frame.
 *
 * The whole band re-reveals on each selection (staggered, framer-motion), and
 * counters count up from zero — but only on client-side selection changes: the
 * first paint renders every value at rest so SSR and the first client paint are
 * byte-identical in both reduced modes (hydration law). Reduced motion skips the
 * reveal and the count entirely; content simply swaps.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAnimate, stagger } from 'framer-motion'
import { MC, paperAlpha, withAlpha } from '../tokens'
import { anton, grotesk, monoFamily } from '../fonts'
import { useMemoryCardAudioActions } from '../audio-context'
import { WRITTEN_WITH } from '../lib/written-with'
import { siteConfig, socialLinks } from '@/lib/constants'
import { parseMetric, formatMetricValue } from './metric'
import type { SaveSlot } from './saves'

const REVEAL_MS = 420
const COUNT_MS = 760

/** The Anton ghost display string per save — the band's single big moment. */
function displayWord(save: SaveSlot): string {
  if (save.kind === 'project') return (save.project?.year ?? '').split('-')[0] || save.slot
  if (save.kind === 'stack') return String(WRITTEN_WITH.length).padStart(2, '0')
  if (save.kind === 'contact') return 'SAVE'
  return 'AY'
}

/** Counts `value` up from 0 on selection changes; rests at `value` on first paint. */
function useCountUp(value: number, decimals: number, reduced: boolean, trigger: string): string {
  const [display, setDisplay] = useState(value)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      setDisplay(value)
      return
    }
    if (reduced) {
      setDisplay(value)
      return
    }
    let raf = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(value * eased)
      if (t < 1) raf = requestAnimationFrame(step)
      else setDisplay(value)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [trigger, value, reduced])

  return formatMetricValue(display, decimals)
}

function MetricTile({
  raw,
  accent,
  reduced,
  trigger,
}: {
  raw: string
  accent: string
  reduced: boolean
  trigger: string
}) {
  const parsed = useMemo(() => parseMetric(raw), [raw])
  const counted = useCountUp(parsed.value ?? 0, parsed.decimals, reduced, trigger)

  if (parsed.value === null) {
    // Text metric → a labelled bar rather than a counter.
    return (
      <div data-reveal className="flex min-w-0 flex-col justify-end gap-2">
        <span
          className="uppercase"
          style={{
            fontFamily: grotesk.style.fontFamily,
            fontWeight: 600,
            fontSize: '0.8125rem',
            lineHeight: 1.15,
            letterSpacing: '0.02em',
            color: paperAlpha(0.82),
          }}
        >
          {parsed.label}
        </span>
        <span
          aria-hidden="true"
          className="h-[3px] w-full overflow-hidden rounded-full"
          style={{ background: paperAlpha(0.1) }}
        >
          <span
            className="block h-full"
            style={{ width: '38%', background: withAlpha(accent, 0.85) }}
          />
        </span>
      </div>
    )
  }

  return (
    <div data-reveal className="flex min-w-0 flex-col gap-1">
      <span
        className="tabular-nums"
        style={{
          fontFamily: grotesk.style.fontFamily,
          fontWeight: 700,
          fontSize: 'clamp(1.9rem, 3.4vw, 2.9rem)',
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: MC.paper,
        }}
      >
        {counted}
        <span style={{ color: accent, fontSize: '0.6em', marginLeft: '0.08em' }}>
          {parsed.suffix}
        </span>
      </span>
      <span
        className="lowercase"
        style={{
          fontFamily: monoFamily,
          fontSize: '0.6875rem',
          letterSpacing: '0.1em',
          color: paperAlpha(0.5),
        }}
      >
        {parsed.label}
      </span>
    </div>
  )
}

/** Mono eyebrow shared by every kind. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      data-reveal
      className="lowercase"
      style={{
        fontFamily: monoFamily,
        fontSize: '0.625rem',
        letterSpacing: '0.28em',
        color: paperAlpha(0.5),
      }}
    >
      {children}
    </p>
  )
}

/** Grotesk-caps title shared by every kind. */
function Title({ children }: { children: React.ReactNode }) {
  return (
    <h2
      data-reveal
      className="uppercase"
      style={{
        fontFamily: grotesk.style.fontFamily,
        fontWeight: 700,
        fontSize: 'clamp(1.5rem, 3.4vw, 2.5rem)',
        lineHeight: 1,
        letterSpacing: '0.005em',
        color: MC.paper,
      }}
    >
      {children}
    </h2>
  )
}

function TechRow({ items }: { items: string[] }) {
  return (
    <div data-reveal className="flex flex-wrap gap-x-2 gap-y-2">
      {items.map((tech) => (
        <span
          key={tech}
          className="lowercase"
          style={{
            fontFamily: monoFamily,
            fontSize: '0.625rem',
            letterSpacing: '0.08em',
            color: paperAlpha(0.62),
            border: `1px solid ${paperAlpha(0.16)}`,
            borderRadius: 3,
            padding: '4px 8px',
          }}
        >
          {tech}
        </span>
      ))}
    </div>
  )
}

function ProjectStory({ save, reduced }: { save: SaveSlot; reduced: boolean }) {
  const project = save.project!
  const metrics = (project.metrics ?? []).slice(0, 3)
  return (
    <>
      <div className="flex flex-col gap-2">
        <Eyebrow>
          save {save.slot} · loaded · {project.category}
        </Eyebrow>
        <Title>{save.label}</Title>
        <p
          data-reveal
          className="lowercase"
          style={{
            fontFamily: monoFamily,
            fontSize: '0.75rem',
            letterSpacing: '0.06em',
            color: paperAlpha(0.62),
          }}
        >
          {project.role} · {project.company}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-x-6 gap-y-4 sm:max-w-md">
        {metrics.map((metric) => (
          <MetricTile
            key={metric}
            raw={metric}
            accent={save.accent}
            reduced={reduced}
            trigger={save.slot}
          />
        ))}
      </div>

      <div className="mt-5">
        <TechRow items={project.technologies.map((t) => t.toLowerCase())} />
      </div>
    </>
  )
}

function BioStory({ save }: { save: SaveSlot }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Eyebrow>save {save.slot} · system data</Eyebrow>
        <Title>{siteConfig.name}</Title>
        <p
          data-reveal
          className="lowercase"
          style={{
            fontFamily: monoFamily,
            fontSize: '0.75rem',
            letterSpacing: '0.06em',
            color: paperAlpha(0.62),
          }}
        >
          {siteConfig.title} · {siteConfig.location}
        </p>
      </div>
      <p
        data-reveal
        className="mt-5 max-w-2xl"
        style={{
          fontFamily: grotesk.style.fontFamily,
          fontSize: 'clamp(0.95rem, 1.5vw, 1.125rem)',
          lineHeight: 1.5,
          color: paperAlpha(0.78),
        }}
      >
        {siteConfig.description}
      </p>
    </>
  )
}

function StackStory({ save }: { save: SaveSlot }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Eyebrow>save {save.slot} · written with · this page only</Eyebrow>
        <Title>{save.label}</Title>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {WRITTEN_WITH.map((entry) => (
          <div data-reveal key={entry.name} className="flex items-baseline gap-3">
            <span
              className="shrink-0"
              style={{
                fontFamily: grotesk.style.fontFamily,
                fontWeight: 600,
                fontSize: '0.8125rem',
                letterSpacing: '0.02em',
                color: MC.paper,
                minWidth: '7.5rem',
              }}
            >
              {entry.name}
            </span>
            <span
              className="truncate lowercase"
              style={{
                fontFamily: monoFamily,
                fontSize: '0.6875rem',
                letterSpacing: '0.04em',
                color: paperAlpha(0.5),
              }}
            >
              {entry.note}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

function ContactStory({ save }: { save: SaveSlot }) {
  const rows = [
    { label: 'email', value: siteConfig.email, href: `mailto:${siteConfig.email}` },
    ...socialLinks.map((link) => ({
      label: link.name.toLowerCase(),
      value: link.url.replace(/^https?:\/\//, ''),
      href: link.url,
    })),
  ]
  return (
    <>
      <div className="flex flex-col gap-2">
        <Eyebrow>save {save.slot} · save your progress</Eyebrow>
        <Title>Get in touch</Title>
      </div>
      <div className="mt-5 flex flex-col gap-1">
        {rows.map((row) => (
          <a
            data-reveal
            key={row.label}
            href={row.href}
            data-cursor="triangle"
            className="group inline-flex min-h-[44px] items-center gap-4 focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:2px]"
          >
            <span
              className="uppercase"
              style={{
                fontFamily: monoFamily,
                fontSize: '0.625rem',
                letterSpacing: '0.2em',
                color: paperAlpha(0.45),
                minWidth: '4.5rem',
              }}
            >
              {row.label}
            </span>
            <span
              className="lowercase transition-colors group-hover:text-[color:var(--mc-ring)]"
              style={{
                fontFamily: grotesk.style.fontFamily,
                fontWeight: 600,
                fontSize: 'clamp(0.95rem, 1.6vw, 1.15rem)',
                letterSpacing: '0.01em',
                color: paperAlpha(0.82),
              }}
            >
              {row.value}
            </span>
          </a>
        ))}
      </div>
    </>
  )
}

export type StoryBandProps = {
  save: SaveSlot
  reduced?: boolean
  onLoad?: (save: SaveSlot) => void
}

export function StoryBand({ save, reduced = false, onLoad }: StoryBandProps) {
  const audio = useMemoryCardAudioActions()
  const [scope, animate] = useAnimate()
  const first = useRef(true)

  // Re-reveal the band on each selection change (client only; never on the first
  // paint, so the initial markup stays byte-identical across reduced modes).
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (reduced) return
    animate(
      '[data-reveal]',
      { opacity: [0, 1], y: [10, 0] },
      { duration: REVEAL_MS / 1000, delay: stagger(0.05), ease: [0, 0, 0.2, 1] }
    )
  }, [save.slot, reduced, animate])

  const onLoadClick = () => {
    // Every save now loads something on activation — project saves open their
    // panel, system saves open their dialog — so the select() sound fires for
    // all kinds.
    audio.select()
    onLoad?.(save)
  }

  return (
    <section
      ref={scope}
      aria-label={`Story — ${save.label}`}
      className="relative w-full overflow-hidden"
    >
      {/* Anton ghost display — the one big type moment, held far back at the edge. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 select-none leading-none lg:block"
        style={{
          fontFamily: anton.style.fontFamily,
          fontSize: 'clamp(6rem, 13vw, 12rem)',
          color: paperAlpha(0.05),
          letterSpacing: '-0.01em',
        }}
      >
        {displayWord(save)}
      </span>

      <div className="relative z-10">
        {save.kind === 'project' && <ProjectStory save={save} reduced={reduced} />}
        {save.kind === 'bio' && <BioStory save={save} />}
        {save.kind === 'stack' && <StackStory save={save} />}
        {save.kind === 'contact' && <ContactStory save={save} />}
      </div>

      {/* LOAD seam — project saves route to their panel, system saves open their dialog. */}
      <div className="relative z-10 mt-6 flex items-center gap-4">
        <button
          type="button"
          data-cursor="triangle"
          onClick={onLoadClick}
          aria-label={`load slot ${save.slot} — ${save.label}`}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-md border px-4 uppercase transition-colors hover:border-[color:var(--mc-ring)] focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:3px]"
          style={{
            fontFamily: monoFamily,
            fontSize: '0.6875rem',
            letterSpacing: '0.16em',
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
          className="hidden lowercase sm:inline"
          style={{
            fontFamily: monoFamily,
            fontSize: '0.625rem',
            letterSpacing: '0.14em',
            color: paperAlpha(0.4),
          }}
        >
          press enter to load
        </span>
      </div>
    </section>
  )
}

export default StoryBand
